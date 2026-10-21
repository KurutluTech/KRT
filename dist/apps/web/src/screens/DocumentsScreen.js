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
import { KX_CSS, card, chip, emptyState, fold } from '../kx.js';
const STATE_TR = { PRESENT: 'VAR', MISSING: 'EKSİK', EXPIRED: 'SÜRESİ DOLMUŞ', NOT_EFFECTIVE: 'ONAYLI / YÜRÜRLÜKTE DEĞİL' };
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
        txt: 'text/plain', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', dxf: 'application/dxf', step: 'model/step', stp: 'model/step', nc: 'text/plain', tap: 'text/plain' };
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
        return h('div', { 'data-testid': 'dc-extraction', 'data-status': e.status, style: 'flex-basis:100%;margin:4px 0;padding:6px 10px;border-left:3px solid #6366f1;font-size:12px;color:#cbd5e1' }, h('div', {}, h('b', {}, e.status === 'PROPOSED' ? 'ÖNERİ (doğrulanmadı)' : e.status === 'VERIFIED' ? 'DOĞRULANDI' : 'REDDEDİLDİ'), ` · ${e.method === 'TEXT_RULES' ? 'metin kuralları' : 'dosya adı kuralları'}` + (e.suggestedDocType ? ` · tür önerisi: ${typeTr(e.suggestedDocType)}` : '')), h('div', { 'data-testid': 'dc-ex-fields' }, Object.entries(shown).map(([k, v]) => `${FIELD_TR[k] ?? k}: ${v}`).join(' · ') || 'Alan bulunamadı'), e.flags.length ? h('div', { 'data-testid': 'dc-ex-flags', style: 'color:#fcd34d' }, e.flags.map((f) => EXTRACTION_FLAG_TR[f] ?? f).join(' · ')) : null, e.status === 'PROPOSED' ? h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:4px' }, ...inputs, note, h('button', { type: 'button', 'data-testid': 'dc-ex-verify', onClick: async () => { try {
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
    const revSel = h('select', { 'data-testid': 'dc-revision', 'aria-label': 'Ürün ve revizyon', style: 'flex:1;min-width:220px' }, h('option', { value: '' }, '— ürün / revizyon seçin —'), ...(state.revisionOptions ?? []).map((o) => h('option', { value: o.id, ...(o.id === state.entityId ? { selected: 'selected' } : {}) }, o.label)));
    const usePicker = () => typeSel.value === 'PRODUCT_REVISION' && (state.revisionOptions?.length ?? 0) > 0;
    const syncPicker = () => { revSel.style.display = usePicker() ? '' : 'none'; idIn.style.display = usePicker() ? 'none' : ''; idIn.placeholder = 'Kayıt no (kartın “Dokümanlar” bağlantısından gelir)'; };
    typeSel.addEventListener('change', syncPicker);
    revSel.addEventListener('change', () => { if (revSel.value)
        go({ entityType: 'PRODUCT_REVISION', entityId: revSel.value, banner: null }); });
    queueMicrotask(syncPicker);
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
        const f = (t, el, hint) => h('label', { class: 'f' }, t, el, hint ? h('span', { class: 'hint' }, hint) : null);
        const fileName = h('span', { class: 'mut', 'data-testid': 'dc-file-name' }, 'Dosya seçilmedi');
        file.addEventListener('change', () => { fileName.textContent = file.files?.[0] ? `${file.files[0].name} · ${kb(file.files[0].size)}` : 'Dosya seçilmedi'; });
        note.placeholder = 'ör. çizim güncellendi';
        title.placeholder = 'ör. Flanş teknik resmi';
        return h('div', { 'data-testid': documentId ? 'dc-version-form' : 'dc-upload', class: 'formbox' }, h('div', { class: 'fgrid w2' }, documentId ? null : f('Doküman türü', docTypeSel), documentId ? null : f('Başlık', title), f('Dosya', file, `En fazla ${MAX_DOCUMENT_BYTES / 1048576} MB`), f('Geçerlilik sonu (varsa)', until)), fileName, fold('Not ekle (isteğe bağlı)', [f('Not', note)]), h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', 'data-testid': documentId ? 'dc-version-save' : 'dc-upload-save', onClick: () => void save() }, documentId ? 'Yeni sürüm yükle' : 'Yükle'), h('span', { class: 'mut' }, 'Yükleme yalnızca dosyayı kaydeder; onay / yürürlük işlemi Doküman Kontrol ekranındadır.')));
    };
    const docBox = (d) => {
        const reason = h('input', { 'data-testid': 'dc-withdraw-reason', placeholder: 'Geri çekme nedeni (zorunlu)', 'aria-label': 'Geri çekme nedeni' });
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
        const withdrawn = d.status === 'WITHDRAWN';
        return h('div', { 'data-testid': 'dc-doc', 'data-id': d.id, 'data-status': d.status, 'data-type': d.docType, class: 'kx-sub', style: withdrawn ? 'opacity:.6' : '' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('b', { style: 'color:#fff' }, d.title), h('span', { class: 'mut' }, ` · ${typeTr(d.docType)}`)), withdrawn ? chip(`Geri çekildi${d.withdrawnReason ? ` · ${d.withdrawnReason}` : ''}`, 'bad') : chip('Etkin', 'ok')), ...d.versions.map((v) => h('div', { 'data-testid': 'dc-version', 'data-no': String(v.versionNo), 'data-expiry': v.expiry, class: 'row', style: 'margin-top:6px;font-size:13px' }, h('span', {}, `Sürüm ${v.versionNo} · ${v.fileName} · ${kb(v.sizeBytes)}`), v.validUntil ? chip(`${v.validUntil} ${EXPIRY_TR[v.expiry]}`, v.expiry === 'EXPIRED' ? 'bad' : v.expiry === 'EXPIRING_SOON' ? 'warn' : 'off') : null, v.note ? h('span', { class: 'mut' }, v.note) : null, h('button', { type: 'button', class: 'ghost sm', 'data-testid': 'dc-download', onClick: () => void download(v.id) }, 'İndir'), extractionView(v.id), h('span', { class: 'mut', title: v.sha256 }, `parmak izi ${v.sha256.slice(0, 8)}…`))), integrity, d.status === 'ACTIVE' ? fold('Yeni sürüm yükle', [uploadForm(d.id, d.docType)]) : null, d.status === 'ACTIVE' ? fold('Geri çek (neden zorunlu)', [h('div', { class: 'row' }, h('div', { class: 'grow' }, reason), h('button', { type: 'button', class: 'danger', 'data-testid': 'dc-withdraw', onClick: async () => {
                    if (reason.value.trim().length < 5)
                        return fail(new Error('REASON_REQUIRED'));
                    try {
                        await api.withdraw(d.id, reason.value.trim());
                        ok('Doküman geri çekildi (sürümler saklanır).');
                    }
                    catch (err) {
                        fail(err);
                    }
                } }, 'Geri çek'))]) : null);
    };
    const reqNote = h('input', { 'data-testid': 'dc-req-note', placeholder: 'Neden zorunlu? (yetkili)', 'aria-label': 'Neden zorunlu' });
    const missingReq = data ? data.completeness.filter((c) => c.state !== 'PRESENT').length : 0;
    const completenessBox = data
        ? h('section', { 'data-testid': 'dc-completeness' }, data.completeness.length === 0 ? h('div', { 'data-testid': 'dc-no-rules', class: 'mut' }, 'Bu kayıt türü için zorunlu doküman kuralı etkin değil.') : null, ...data.completeness.map((c) => h('div', { 'data-testid': 'dc-req', 'data-doc': c.docType, 'data-state': c.state, class: 'row', style: 'margin:3px 0' }, chip(STATE_TR[c.state] ?? c.state, c.state === 'PRESENT' ? 'ok' : 'bad'), h('span', {}, typeTr(c.docType)))), data.proposed.length ? h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'mut' }, 'Öneri (yönetici onayı bekliyor):'), ...data.proposed.map((p) => h('button', { type: 'button', class: 'ghost sm', 'data-testid': 'dc-req-activate', 'data-doc': p, onClick: async () => {
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
        ? h('section', { 'data-testid': 'dc-consistency' }, flags.length ? null : h('div', { 'data-testid': 'dc-consistency-ok', class: 'mut' }, 'İşaretlenen sorun yok (yalnız doğrulanmış bilgiler karşılaştırılır).'), ...flags.map((f) => h('div', { 'data-testid': 'dc-flag', 'data-kind': f.kind, class: 'row', style: 'margin:3px 0' }, chip(CONSISTENCY_TR[f.kind] ?? f.kind, ['EXPIRED', 'REVISION_MISMATCH', 'CHANGED_AFTER_PRODUCTION', 'GATE_DOCUMENT_MISSING'].includes(f.kind) ? 'bad' : 'warn'), h('span', {}, typeTr(f.docType) + (f.detail && typeof f.detail === 'object' ? ` (${Object.entries(f.detail).map(([k, v]) => `${k}: ${String(v)}`).join(', ')})` : f.detail ? ` (${String(f.detail)})` : '')))))
        : null;
    const gGate = h('select', { 'data-testid': 'dc-gate' }, ...Object.keys(GATE_TR).map((g) => h('option', { value: g }, GATE_TR[g])));
    const gType = h('select', { 'data-testid': 'dc-gate-doc' }, ...DOCUMENT_TYPES.filter((t) => t.sensitivity === 'GENERAL').map((t) => h('option', { value: t.code }, t.titleTr)));
    const gLevel = h('select', { 'data-testid': 'dc-gate-level' }, ...['PRODUCT_REVISION', 'WORK_ORDER', 'STOCK_LOT', 'SHIPMENT'].map((l) => h('option', { value: l }, ENTITY_TR[l] ?? l)));
    const gOp = h('input', { type: 'number', 'data-testid': 'dc-gate-op', placeholder: 'ör. 30' });
    const gNote = h('input', { 'data-testid': 'dc-gate-note', placeholder: 'Gerekçe (zorunlu)' });
    const lf = (t, el) => h('label', { class: 'f' }, t, el);
    const gatesBox = fold(`Yönetici: belge kapısı kuralları${rules.length ? ` (${rules.length} etkin)` : ''}`, [
        h('section', { 'data-testid': 'dc-gates' }, h('div', { class: 'mut' }, 'Üretim ve sevkiyat için hangi belgenin şart olduğunu belirler; sunucuda uygulanır. Günlük belge yüklemeyle ilgisi yoktur.'), rules.length ? null : h('div', { 'data-testid': 'dc-gates-none', class: 'mut', style: 'margin-top:6px' }, 'Etkin kural yok — üretim ve sevkiyat belge şartı olmadan çalışır.'), ...rules.map((r) => h('div', { 'data-testid': 'dc-gate-rule', 'data-gate': r.gate, 'data-doc': r.docType, class: 'row', style: 'margin-top:6px;font-size:13px' }, `${GATE_TR[r.gate]}: ${typeTr(r.docType)} (${ENTITY_TR[r.entityLevel] ?? r.entityLevel}${r.opNo ? `, op ${r.opNo}` : ''}) — ${r.note}`, h('button', { type: 'button', class: 'danger sm', 'data-testid': 'dc-gate-off', onClick: async () => { try {
                await api.deactivateGateRule(r.id, gNote.value.trim() || 'kural kaldırıldı');
                ok('Kural kaldırıldı.');
            }
            catch (err) {
                fail(err);
            } } }, 'Kaldır'))), h('div', { class: 'fgrid', style: 'margin-top:10px' }, lf('Kapı', gGate), lf('Belge türü', gType), lf('Kayıt düzeyi', gLevel), lf('Operasyon no (varsa)', gOp), lf('Gerekçe', gNote)), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'dc-gate-add', onClick: async () => {
                try {
                    await api.setGateRule({ gate: gGate.value, docType: gType.value, entityLevel: gLevel.value, productId: null, opNo: gOp.value ? Number(gOp.value) : null, note: gNote.value.trim() });
                    ok('Kural eklendi.');
                }
                catch (err) {
                    fail(err);
                }
            } }, 'Kural ekle'))),
    ], false, 'dc-gates-fold');
    // seçili kaydın okunur adı (ID gösterilmez)
    const recordLabel = state.entityType === 'PRODUCT_REVISION' ? (state.revisionOptions ?? []).find((o) => o.id === state.entityId)?.label ?? 'Ürün revizyonu'
        : state.entityType === 'MACHINE' ? (machines.find((m) => m.id === state.entityId) ? `${machines.find((m) => m.id === state.entityId).code} ${machines.find((m) => m.id === state.entityId).name}` : 'Makine')
            : state.entityType ? `${ENTITY_TR[state.entityType]} kaydı` : '';
    const sf = (n, t, el) => h('label', { class: 'f' }, h('span', {}, h('b', { style: 'color:#67e8f9' }, `${n}. `), t), el);
    idIn.placeholder = 'Kayıt numarası';
    const chooser = card({ title: 'Doküman yükle / görüntüle', testid: 'dc-chooser', chip: chip('Önce kaydı seçin', 'info') }, h('div', { class: 'fgrid w2' }, sf(1, 'Kayıt türü', typeSel), sf(2, 'Kayıt', h('div', { class: 'row' }, revSel, machineSel, idIn, h('button', { type: 'button', class: 'primary', 'data-testid': 'dc-open', onClick: () => go({ entityType: typeSel.value, entityId: (typeSel.value === 'PRODUCT_REVISION' && usePicker() ? revSel.value : idIn.value).trim(), banner: null }) }, 'Aç')))), h('div', { class: 'mut', style: 'margin-top:6px' }, 'Ürün revizyonu için listeden seçin; makine için makine listesinden seçin. Diğer kayıtlarda kayıt numarası kartın “Dokümanlar” bağlantısıyla gelir.'));
    mount(container, h('div', { class: 'documents-screen kx' }, h('style', {}, KX_CSS), h('div', { class: 'page-head' }, h('div', { class: 'ttl' }, h('h1', { 'data-testid': 'dc-heading' }, 'Dokümanlar'), h('div', { class: 'mut' }, 'Dosyalar KMI içinde saklanır; sürümler silinmez ve her sürümün parmak izi vardır. Onay ve yürürlük: Doküman Kontrol.')), h('div', { class: 'acts' }, h('a', { class: 'btn ghost', href: '#/dokuman-kontrol' }, 'Doküman Kontrol →'))), state.banner ? h('div', { 'data-testid': 'dc-banner', 'data-kind': state.banner.kind, class: `banner ${state.banner.kind === 'ok' ? 'ok' : 'bad'}` }, state.banner.text) : null, loadError ? h('div', { 'data-testid': 'dc-load-error', class: 'banner bad' }, `Yüklenemedi: ${loadError}`) : null, h('div', { class: 'stack' }, chooser, data ? h('div', { 'data-testid': 'dc-entity', 'data-type': state.entityType, class: 'stack' }, card({ title: `Seçili kayıt: ${recordLabel}`, testid: 'dc-record', chip: chip(`${data.documents.length} doküman`, 'off') }, ...data.documents.map(docBox), data.documents.length === 0 ? h('div', { 'data-testid': 'dc-empty' }, emptyState('Bu kayda bağlı doküman yok', 'Aşağıdaki formla ilk dosyayı yükleyin.')) : null), card({ title: '3 · Yeni doküman yükle', testid: 'dc-card-upload', chip: chip(recordLabel, 'info') }, uploadForm(null, null)), fold(`Zorunlu dokümanlar${missingReq ? ` — ${missingReq} eksik` : ''}`, [completenessBox], missingReq > 0), fold(`Tutarlılık kontrolü${flags.length ? ` — ${flags.length} uyarı` : ''}`, [consistencyBox], flags.length > 0)) : null, card({ title: 'Süresi dolan / dolmak üzere (30 gün)', testid: 'dc-expiring', chip: chip(expiring.length ? `${expiring.length}` : 'Yok', expiring.length ? 'warn' : 'ok') }, ...(expiring.length ? expiring.map((e) => h('div', { 'data-testid': 'dc-expiring-row', 'data-expiry': e.expiry, class: 'row', style: 'margin:3px 0' }, chip(EXPIRY_TR[e.expiry] ?? e.expiry, e.expiry === 'EXPIRED' ? 'bad' : 'warn'), h('span', {}, `${e.title} · ${typeTr(e.docType)} · ${ENTITY_TR[e.entityType]} · ${e.validUntil}`))) : [h('div', { class: 'mut' }, 'Süresi dolan belge yok.')])), gatesBox)));
}
