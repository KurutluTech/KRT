// KMI NEXT — Dokümanlar (Document Intelligence, matrix 37). Migration 0035.
// Her doküman bir türe ve GERÇEK bir kayda bağlıdır; sürümler silinmez, her sürümün sha256 parmak izi
// vardır. Aynı içerik aynı dokümana ikinci kez yüklenemez; dosyanın gerçek türü adıyla uyuşmazsa
// (ör. adı .pdf olan program dosyası) sunucu reddeder; indirirken bütünlük tekrar kontrol edilir.
// "Zorunlu doküman" kuralları öneri olarak gelir, owner onaylayana kadar pasiftir (D-015).
// Fatura / müşteri siparişi belgeleri yalnız muhasebe yetkisi olanlara açıktır (sunucuda).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { DOCUMENT_ENTITY_TYPES, DOCUMENT_TYPES, ENTITY_TR, MAX_DOCUMENT_BYTES, bytesToHex, canUploadDocument, documentType, } from '../../../../packages/domain/src/documents.js';
import { CONSISTENCY_TR, EXTRACTION_FLAG_TR, GATE_TR } from '../../../../packages/domain/src/asBuilt.js';
import { errorText as sharedErrorText } from '../errorText.js';
const STATE_TR = { PRESENT: 'VAR', MISSING: 'EKSİK', EXPIRED: 'SÜRESİ DOLMUŞ' };
const EXPIRY_TR = { NO_EXPIRY: '', VALID: 'geçerli', EXPIRING_SOON: 'süresi doluyor', EXPIRED: 'SÜRESİ DOLDU' };
const typeTr = (code) => documentType(code)?.titleTr ?? code;
const errText = (e) => sharedErrorText(e);
const kb = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function guessMime(fileName, declared) {
    if (declared && declared !== 'application/octet-stream')
        return declared;
    const ext = fileName.toLowerCase().split('.').pop() ?? '';
    const map = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
        txt: 'text/plain', csv: 'text/csv', dxf: 'application/dxf', step: 'model/step', stp: 'model/step', nc: 'text/plain', tap: 'text/plain' };
    return map[ext] ?? 'application/octet-stream';
}
function toBase64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}
function fromBase64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(new ArrayBuffer(s.length));
    for (let i = 0; i < s.length; i += 1)
        out[i] = s.charCodeAt(i);
    return out;
}
export async function renderDocumentsScreen(container, api, state = {}) {
    const go = (next) => void renderDocumentsScreen(container, api, { ...state, ...next });
    const ok = (text) => go({ banner: { kind: 'ok', text } });
    const fail = (err) => go({ banner: { kind: 'error', text: errText(err) } });
    let data = null;
    let expiring = [];
    let machines = [];
    let loadError = null;
    let extractions = [];
    let flags = [];
    let rules = [];
    try {
        [expiring, machines] = await Promise.all([api.expiring(30), api.machines()]);
        if (state.entityType && state.entityId)
            data = await api.entityDocuments(state.entityType, state.entityId);
        if (data) {
            [extractions, flags] = await Promise.all([api.extractions(data.documents.flatMap((d) => d.versions.map((v) => v.id))),
                api.consistency(state.entityType, state.entityId).then((c) => c.flags)]);
        }
        rules = await api.gateRules();
    }
    catch (err) {
        loadError = errText(err);
    }
    const FIELD_TR = { revision: 'Revizyon', drawing_no: 'Resim no', heat_no: 'Şarj / heat no', cert_type: 'EN 10204 tipi', valid_until: 'Geçerlilik' };
    const extractionView = (versionId) => {
        const e = extractions.find((x) => x.versionId === versionId) ?? null;
        if (!e)
            return h('button', { type: 'button', 'data-testid': 'dc-analyse', onClick: async () => { try {
                    await api.propose(versionId);
                    ok('Öneri çıkarıldı — doğrulama bekliyor.');
                }
                catch (err) {
                    fail(err);
                } } }, 'Analiz et');
        const shown = e.status === 'VERIFIED' ? e.verifiedFields ?? {} : e.fields;
        const inputs = Object.keys(FIELD_TR).map((k) => h('input', { 'data-testid': 'dc-ex-field', 'data-field': k, value: e.fields[k] ?? '', placeholder: FIELD_TR[k], style: 'width:8em' }));
        const note = h('input', { 'data-testid': 'dc-ex-note', placeholder: 'Doğrulama notu', style: 'flex:1 1 120px;min-width:0' });
        const corrected = () => { const o = {}; for (const i of inputs)
            if (i.value.trim())
                o[i.dataset.field] = i.value.trim(); return o; };
        return h('div', { 'data-testid': 'dc-extraction', 'data-status': e.status, style: 'margin:4px 0 4px 10px;padding:6px;border-left:3px solid #c7d2fe;font-size:12px' }, h('div', {}, h('b', {}, e.status === 'PROPOSED' ? 'ÖNERİ (doğrulanmadı)' : e.status === 'VERIFIED' ? 'DOĞRULANDI' : 'REDDEDİLDİ'), ` · ${e.method === 'TEXT_RULES' ? 'metin kuralları' : 'dosya adı kuralları'}` + (e.suggestedDocType ? ` · tür önerisi: ${typeTr(e.suggestedDocType)}` : '')), h('div', { 'data-testid': 'dc-ex-fields' }, Object.entries(shown).map(([k, v]) => `${FIELD_TR[k] ?? k}: ${v}`).join(' · ') || 'Alan bulunamadı'), e.flags.length ? h('div', { 'data-testid': 'dc-ex-flags', style: 'color:#b45309' }, e.flags.map((f) => EXTRACTION_FLAG_TR[f] ?? f).join(' · ')) : null, e.status === 'PROPOSED' ? h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:4px' }, ...inputs, note, h('button', { type: 'button', 'data-testid': 'dc-ex-verify', onClick: async () => { try {
                await api.verify(e.id, true, corrected(), note.value.trim());
                ok('Bilgiler doğrulandı.');
            }
            catch (err) {
                fail(err);
            } } }, 'Doğrula'), h('button', { type: 'button', 'data-testid': 'dc-ex-reject', onClick: async () => { try {
                await api.verify(e.id, false, null, note.value.trim());
                ok('Öneri reddedildi.');
            }
            catch (err) {
                fail(err);
            } } }, 'Reddet')) : null);
    };
    // ---- record chooser ----
    const typeSel = h('select', { 'data-testid': 'dc-entity-type' }, ...DOCUMENT_ENTITY_TYPES.map((t) => h('option', { value: t, ...(t === state.entityType ? { selected: 'selected' } : {}) }, ENTITY_TR[t])));
    const idIn = h('input', { 'data-testid': 'dc-entity-id', value: state.entityId ?? '', placeholder: 'Kayıt no (pasaporttan gelir)', style: 'flex:1;min-width:0' });
    const machineSel = h('select', { 'data-testid': 'dc-machine' }, h('option', { value: '' }, '— makine seç —'), ...machines.map((m) => h('option', { value: m.id }, `${m.code} ${m.name}`)));
    machineSel.addEventListener('change', () => { if (machineSel.value)
        go({ entityType: 'MACHINE', entityId: machineSel.value, banner: null }); });
    // ---- upload (new document or new version) ----
    const uploadForm = (documentId, fixedType) => {
        const docTypeSel = h('select', { 'data-testid': 'dc-doc-type' }, ...DOCUMENT_TYPES.map((t) => h('option', { value: t.code, ...(t.code === fixedType ? { selected: 'selected' } : {}) }, t.titleTr)));
        if (fixedType)
            docTypeSel.disabled = true;
        const title = h('input', { 'data-testid': 'dc-title', placeholder: 'Başlık (ör. Flanş teknik resmi)' });
        const file = h('input', { type: 'file', 'data-testid': 'dc-file' });
        const until = h('input', { type: 'date', 'data-testid': 'dc-valid-until' });
        const note = h('input', { 'data-testid': 'dc-note', placeholder: 'Not (isteğe bağlı)' });
        const save = async () => {
            const f = file.files?.[0];
            if (!f)
                return fail(new Error('CONTENT_REQUIRED'));
            const bytes = new Uint8Array(await f.arrayBuffer());
            const mime = guessMime(f.name, f.type);
            const docType = fixedType ?? docTypeSel.value;
            const existing = documentId ? data?.documents.find((d) => d.id === documentId) : null;
            const sha = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
            const pre = canUploadDocument({
                docType, entityType: state.entityType, entityExists: true, title: documentId ? null : title.value, fileName: f.name, mime, bytes,
                validUntil: until.value || null, today: today(), canSeeSensitivity: () => true,
                existing: existing ? { status: existing.status, docType: existing.docType, hashes: existing.versions.map((v) => v.sha256) } : null, sha256Hex: sha,
            });
            if (!pre.ok)
                return fail(new Error(pre.reason));
            try {
                const r = await api.upload({ docType, entityType: state.entityType, entityId: state.entityId, title: documentId ? null : title.value.trim(),
                    fileName: f.name, mimeType: mime, contentBase64: toBase64(bytes), validUntil: until.value || null, note: note.value.trim() || null, documentId });
                ok(`Yüklendi: sürüm ${r.versionNo} · parmak izi ${r.sha256.slice(0, 12)}…${r.sameContentElsewhere.length ? ` · aynı dosya başka yerde de var: ${r.sameContentElsewhere.map((d) => d.title).join(', ')}` : ''}`);
            }
            catch (err) {
                fail(err);
            }
        };
        return h('div', { 'data-testid': documentId ? 'dc-version-form' : 'dc-upload', style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0' }, documentId ? null : docTypeSel, documentId ? null : title, file, h('label', {}, 'Geçerlilik sonu: ', until), note, h('button', { type: 'button', 'data-testid': documentId ? 'dc-version-save' : 'dc-upload-save', onClick: () => void save() }, documentId ? 'Yeni sürüm yükle' : 'Yükle'));
    };
    const docBox = (d) => {
        const reason = h('input', { 'data-testid': 'dc-withdraw-reason', placeholder: 'Geri çekme nedeni' });
        const integrity = h('span', { 'data-testid': 'dc-integrity' });
        const download = async (versionId) => {
            try {
                const c = await api.content(versionId);
                const bytes = fromBase64(c.contentBase64);
                const local = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
                const okBoth = c.integrityOk && local === c.sha256;
                integrity.textContent = okBoth ? ' · bütünlük doğrulandı' : ' · BÜTÜNLÜK HATASI';
                integrity.dataset.ok = String(okBoth);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([bytes], { type: c.mimeType }));
                a.download = c.fileName;
                a.dataset.testid = 'dc-download-link';
                a.textContent = c.fileName;
                integrity.appendChild(document.createTextNode(' '));
                integrity.appendChild(a);
            }
            catch (err) {
                fail(err);
            }
        };
        return h('div', { 'data-testid': 'dc-doc', 'data-id': d.id, 'data-status': d.status, 'data-type': d.docType,
            style: `border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:6px 0;${d.status === 'WITHDRAWN' ? 'opacity:.6' : ''}` }, h('div', {}, h('b', {}, d.title), ` · ${typeTr(d.docType)}`, d.status === 'WITHDRAWN' ? h('span', { style: 'color:#b91c1c' }, ` · GERİ ÇEKİLDİ (${d.withdrawnReason ?? ''})`) : null), ...d.versions.map((v) => h('div', { 'data-testid': 'dc-version', 'data-no': String(v.versionNo), 'data-expiry': v.expiry, style: 'font-size:13px' }, `Sürüm ${v.versionNo} · ${v.fileName} · ${kb(v.sizeBytes)} · ${v.sha256.slice(0, 12)}…`, v.validUntil ? h('span', { style: v.expiry === 'EXPIRED' ? 'color:#b91c1c;font-weight:700' : v.expiry === 'EXPIRING_SOON' ? 'color:#b45309' : '' }, ` · ${v.validUntil} ${EXPIRY_TR[v.expiry]}`) : null, v.note ? ` · ${v.note}` : '', ' ', h('button', { type: 'button', 'data-testid': 'dc-download', onClick: () => void download(v.id) }, 'İndir'), extractionView(v.id))), integrity, d.status === 'ACTIVE' ? uploadForm(d.id, d.docType) : null, d.status === 'ACTIVE' ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, reason, h('button', { type: 'button', 'data-testid': 'dc-withdraw', onClick: async () => {
                if (reason.value.trim().length < 5)
                    return fail(new Error('REASON_REQUIRED'));
                try {
                    await api.withdraw(d.id, reason.value.trim());
                    ok('Doküman geri çekildi (sürümler saklanır).');
                }
                catch (err) {
                    fail(err);
                }
            } }, 'Geri çek')) : null);
    };
    const reqNote = h('input', { 'data-testid': 'dc-req-note', placeholder: 'Neden zorunlu? (yetkili)' });
    const completenessBox = data
        ? h('section', { 'data-testid': 'dc-completeness', style: 'border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;margin:10px 0' }, h('h3', { style: 'margin:0 0 4px;font-size:15px' }, 'Zorunlu dokümanlar'), data.completeness.length === 0 ? h('div', { 'data-testid': 'dc-no-rules', style: 'color:#64748b' }, 'Bu kayıt türü için zorunlu doküman kuralı etkin değil.') : null, ...data.completeness.map((c) => h('div', { 'data-testid': 'dc-req', 'data-doc': c.docType, 'data-state': c.state,
            style: c.state === 'PRESENT' ? 'color:#15803d' : 'color:#b91c1c;font-weight:700' }, `${typeTr(c.docType)}: ${STATE_TR[c.state]}`)), data.proposed.length ? h('div', { style: 'margin-top:6px;font-size:13px' }, 'Öneri (owner onayı bekliyor): ', ...data.proposed.map((p) => h('button', { type: 'button', 'data-testid': 'dc-req-activate', 'data-doc': p, style: 'margin:2px', onClick: async () => {
                if (reqNote.value.trim().length < 5)
                    return fail(new Error('REASON_REQUIRED'));
                try {
                    await api.setRequirement(state.entityType, p, true, reqNote.value.trim());
                    ok(`${typeTr(p)} artık zorunlu.`);
                }
                catch (err) {
                    fail(err);
                }
            } }, `${typeTr(p)} zorunlu yap`)), reqNote) : null)
        : null;
    const consistencyBox = data
        ? h('section', { 'data-testid': 'dc-consistency', style: 'border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;margin:10px 0' }, h('h3', { style: 'margin:0 0 4px;font-size:15px' }, 'Tutarlılık kontrolü'), flags.length ? null : h('div', { 'data-testid': 'dc-consistency-ok', style: 'color:#64748b' }, 'İşaretlenen sorun yok (yalnız doğrulanmış bilgiler karşılaştırılır).'), ...flags.map((f) => h('div', { 'data-testid': 'dc-flag', 'data-kind': f.kind, style: ['EXPIRED', 'REVISION_MISMATCH', 'CHANGED_AFTER_PRODUCTION', 'GATE_DOCUMENT_MISSING'].includes(f.kind) ? 'color:#b91c1c;font-weight:700' : 'color:#475569' }, `${CONSISTENCY_TR[f.kind] ?? f.kind}: ${typeTr(f.docType)}` + (f.detail && typeof f.detail === 'object' ? ` (${Object.entries(f.detail).map(([k, v]) => `${k}: ${String(v)}`).join(', ')})` : f.detail ? ` (${String(f.detail)})` : ''))))
        : null;
    const gGate = h('select', { 'data-testid': 'dc-gate' }, ...Object.keys(GATE_TR).map((g) => h('option', { value: g }, GATE_TR[g])));
    const gType = h('select', { 'data-testid': 'dc-gate-doc' }, ...DOCUMENT_TYPES.filter((t) => t.sensitivity === 'GENERAL').map((t) => h('option', { value: t.code }, t.titleTr)));
    const gLevel = h('select', { 'data-testid': 'dc-gate-level' }, ...['PRODUCT_REVISION', 'WORK_ORDER', 'STOCK_LOT', 'SHIPMENT'].map((l) => h('option', { value: l }, ENTITY_TR[l] ?? l)));
    const gOp = h('input', { type: 'number', 'data-testid': 'dc-gate-op', placeholder: 'op no', style: 'width:5em' });
    const gNote = h('input', { 'data-testid': 'dc-gate-note', placeholder: 'Gerekçe', style: 'flex:1 1 140px;min-width:0' });
    const gatesBox = h('section', { 'data-testid': 'dc-gates', style: 'margin:14px 0' }, h('h3', { style: 'font-size:15px' }, 'Belge kapıları (sunucuda uygulanır)'), rules.length ? null : h('div', { 'data-testid': 'dc-gates-none', style: 'color:#64748b' }, 'Etkin kural yok — üretim ve sevkiyat belge şartı olmadan çalışır.'), ...rules.map((r) => h('div', { 'data-testid': 'dc-gate-rule', 'data-gate': r.gate, 'data-doc': r.docType, style: 'font-size:13px;display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, `${GATE_TR[r.gate]}: ${typeTr(r.docType)} (${ENTITY_TR[r.entityLevel] ?? r.entityLevel}${r.opNo ? `, op ${r.opNo}` : ''}) — ${r.note}`, h('button', { type: 'button', 'data-testid': 'dc-gate-off', onClick: async () => { try {
            await api.deactivateGateRule(r.id, gNote.value.trim() || 'kural kaldırıldı');
            ok('Kural kaldırıldı.');
        }
        catch (err) {
            fail(err);
        } } }, 'Kaldır'))), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, gGate, gType, gLevel, gOp, gNote, h('button', { type: 'button', 'data-testid': 'dc-gate-add', onClick: async () => {
            try {
                await api.setGateRule({ gate: gGate.value, docType: gType.value, entityLevel: gLevel.value, productId: null, opNo: gOp.value ? Number(gOp.value) : null, note: gNote.value.trim() });
                ok('Kural eklendi.');
            }
            catch (err) {
                fail(err);
            }
        } }, 'Kural ekle')));
    mount(container, h('div', { class: 'documents-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'dc-heading' }, 'Dokümanlar'), h('p', { style: 'font-size:12px;color:#555' }, `Dosyalar KMI NEXT içinde saklanır (en fazla ${MAX_DOCUMENT_BYTES / 1048576} MB). Sürümler silinmez; her sürümün parmak izi vardır.`), state.banner ? h('div', { 'data-testid': 'dc-banner', 'data-kind': state.banner.kind, style: `padding:10px;border-radius:8px;background:${state.banner.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.banner.text) : null, loadError ? h('div', { 'data-testid': 'dc-load-error' }, `Yüklenemedi: ${loadError}`) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, typeSel, idIn, h('button', { type: 'button', 'data-testid': 'dc-open', onClick: () => go({ entityType: typeSel.value, entityId: idIn.value.trim(), banner: null }) }, 'Aç'), machineSel), data ? h('div', { 'data-testid': 'dc-entity', 'data-type': state.entityType }, h('h2', { style: 'font-size:16px;margin:10px 0 4px' }, `${ENTITY_TR[state.entityType]} dokümanları`), completenessBox, consistencyBox, ...data.documents.map(docBox), data.documents.length === 0 ? h('div', { 'data-testid': 'dc-empty', style: 'color:#64748b' }, 'Bu kayda bağlı doküman yok.') : null, h('h3', { style: 'font-size:15px' }, 'Yeni doküman'), uploadForm(null, null)) : null, h('section', { 'data-testid': 'dc-expiring', style: 'margin:14px 0' }, h('h3', { style: 'font-size:15px' }, 'Süresi dolan / dolmak üzere (30 gün)'), ...(expiring.length ? expiring.map((e) => h('div', { 'data-testid': 'dc-expiring-row', 'data-expiry': e.expiry }, `${e.title} · ${typeTr(e.docType)} · ${ENTITY_TR[e.entityType]} · ${e.validUntil} ${EXPIRY_TR[e.expiry]}`)) : [h('div', { style: 'color:#64748b' }, 'Yok.')])), gatesBox));
}
