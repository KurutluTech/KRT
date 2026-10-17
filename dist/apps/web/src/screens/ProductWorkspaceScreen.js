// KMI-011 — Ürün Çalışma Alanı: ürün pasaportu + mühendislik kartları (kimlik, resim, CAD, CAM/NC, takım, BOM, rota/operasyon, parametre, kalite, hesap, geçmiş).
// Aynı kanonik kaynaklara bağlanır (KMI-009/010); yetki, revizyon sınıfı, geçerlilik, hesap durumu SUNUCUDA. Boş değer 0 yazılmaz (VERİ YOK). Gerçek üretim ölçümü bu ekrandan değiştirilemez.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { CARD_STATE_TR, changeText } from '../../../../packages/domain/src/parameters.js';
import { guessMime } from './DocumentsScreen.js';
import { errorText } from '../errorText.js';
const CSS = `
.pw{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:1100px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.pw h1{color:#fff;font-size:20px;margin:6px 0}.pw h2{color:#fff;font-size:16px;margin:0 0 6px}.pw h3{color:#cbd5e1;font-size:14px;margin:8px 0 4px}
.pw button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}
.pw input,.pw textarea,.pw select{min-height:44px !important;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.pw textarea{padding:8px 10px;min-height:64px !important}.pw input[type=checkbox]{width:24px;min-height:24px !important}
.pw .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0;overflow-wrap:anywhere}
.pw .cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.pw .cards .card{margin:0}
.pw .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.pw .row>*{min-width:0}.pw .grid{display:grid;gap:8px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.pw .primary{background:#1d4ed8;color:#fff}.pw .ghost{background:#1e293b;color:#e2e8f0}.pw .danger{background:#7f1d1d;color:#fecaca}
.pw .chip{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:11px;background:#1e293b;color:#e6edf7}
.pw .ok{background:#14532d;color:#bbf7d0}.pw .warn{background:#78350f;color:#fde68a}.pw .bad{background:#7f1d1d;color:#fecaca}.pw .info{background:#1e3a8a;color:#dbeafe}
.pw .card.bad{background:#0f172a;border-color:#b91c1c}.pw .card.info{background:#0f172a;border-color:#1d4ed8}.pw .card.ok{background:#0f172a;border-color:#15803d}
.pw .mut{color:#94a3b8;font-size:12px}.pw label{font-size:12px;color:#94a3b8;display:block}.pw .op{border:1px solid #1e293b;border-radius:12px;padding:10px;margin:8px 0;background:#0b1220}
.pw .op.off{opacity:.65}.pw .tw{overflow-x:auto}.pw table{border-collapse:collapse;width:100%;font-size:13px}.pw th,.pw td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left}.pw th{color:#94a3b8}
.pw a{color:#93c5fd}
`;
const NA = 'VERİ YOK';
const STATE_CLS = { MISSING: 'bad', DRAFT: 'info', APPROVED: 'ok', INVALID: 'warn' };
const REV_TR = { DRAFT: 'Taslak', RELEASED: 'Yürürlükte', OBSOLETE: 'Eski' };
const CALC_TR = { CURRENT: 'Güncel', STALE: 'Eskimiş', SUPERSEDED: 'Yenilendi' };
const CALC_CLS = { CURRENT: 'ok', STALE: 'warn', SUPERSEDED: '' };
const KIND_TR = { FIXTURE: 'Fikstür', TOOL: 'Takım', GAUGE: 'Mastar/Ölçü', RESOURCE: 'Kaynak', FIRST_PIECE: 'İlk parça', IN_PROCESS: 'Proses içi', FINAL: 'Son kontrol' };
const DOC_TR = { DRAWING: 'Teknik resim', CAD_MODEL: 'CAD/STEP', NC_PROGRAM: 'NC programı', CAM_SETUP_SHEET: 'CAM setup', TOOL_LIST: 'Takım listesi', CONTROL_PLAN: 'Kontrol planı', WORK_INSTRUCTION: 'İş talimatı' };
const CTL_TR = { DRAFT: 'Taslak', IN_REVIEW: 'İncelemede', APPROVED: 'Onaylandı', EFFECTIVE: 'Yürürlükte', SUPERSEDED: 'Geçersiz', REJECTED: 'Reddedildi' };
const val = (x) => x.value;
const checked = (x) => x.checked;
const n = (v) => (v === null || v === undefined ? NA : v.toLocaleString('tr-TR', { maximumFractionDigits: 3 }));
const num = (s) => { const t = s.trim().replace(',', '.'); if (t === '')
    return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const when = (s) => (s ? s.slice(0, 16).replace('T', ' ') : '—');
const isoToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
export async function renderProductWorkspaceScreen(container, api, state = {}) {
    const go = (s) => renderProductWorkspaceScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'pw', 'data-testid': 'pw-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : state.banner.kind === 'ok' ? 'ok' : 'info'}`, 'data-testid': 'pw-banner', 'data-kind': state.banner.kind }, state.banner.text) : null;
    const fail = (e) => {
        const text = errorText(e);
        let b = container.querySelector('[data-testid="pw-banner"]');
        if (!b) {
            const root = container.querySelector('[data-testid="pw-root"]');
            b = h('div', { class: 'card bad', 'data-testid': 'pw-banner', 'data-kind': 'error' });
            const first = root ? [...root.children].find((c) => c.tagName !== 'STYLE') : null;
            if (root)
                root.insertBefore(b, first ?? null);
        }
        b.textContent = text;
        b.className = 'card bad';
        b.setAttribute('data-kind', 'error');
        try {
            b.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    const chip = (s) => h('span', { class: `chip ${STATE_CLS[s]}`, 'data-state': s }, CARD_STATE_TR[s]);
    const reasonBox = (tid, ph = 'Gerekçe (en az 10 karakter)') => h('input', { 'data-testid': tid, placeholder: ph, maxlength: 400 });
    if (!state.product)
        return renderHome();
    return renderWorkspace(state.product);
    async function renderHome() {
        let rows = [];
        try {
            rows = await api.search(state.q ?? '');
        }
        catch (e) {
            state = { ...state, banner: { kind: 'error', text: errorText(e) } };
        }
        const q = h('input', { 'data-testid': 'pw-search', placeholder: 'Ürün kodu / adı', value: state.q ?? '' });
        q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter')
            void go({ q: val(q) }); });
        shell(h('h1', {}, 'Ürün Çalışma Alanı'), state.banner ? h('div', { class: 'card bad', 'data-testid': 'pw-banner', 'data-kind': 'error' }, state.banner.text) : null, h('div', { class: 'card' }, h('div', { class: 'row' }, q, h('button', { class: 'primary', type: 'button', 'data-testid': 'pw-search-go', onClick: () => void go({ q: val(q) }) }, 'Ara')), h('div', { class: 'mut' }, 'Ürünün resim, CAD, CAM/NC, takım, BOM, rota, operasyon, süre, kalite ve değişiklik geçmişi tek yerde.')), ...rows.map((r) => h('div', { class: 'card row', 'data-testid': 'pw-product', 'data-code': r.code }, h('b', {}, r.code), h('span', {}, r.name), h('span', { class: 'mut' }, r.currentRevision ? `Rev ${r.currentRevision}` : 'revizyon yok'), h('button', { class: 'ghost', type: 'button', 'data-testid': `pw-open-${r.code}`, onClick: () => void go({ product: r.id }) }, 'Aç'))));
    }
    async function renderWorkspace(productId) {
        let ws;
        let machines = [];
        try {
            ws = await api.load(productId, state.rev ?? null);
        }
        catch (e) {
            return go({ banner: { kind: 'error', text: errorText(e) } });
        }
        try {
            machines = await api.machines();
        }
        catch {
            machines = [];
        }
        const rev = ws.revision;
        const can = ws.can;
        const editable = !!rev && rev.status !== 'OBSOLETE';
        const reload = (text, kind = 'ok', extra = {}) => go({ product: productId, rev: rev?.id ?? null, openOp: state.openOp, qty: state.qty, ...extra, banner: text ? { kind, text } : undefined });
        const revSel = h('select', { 'data-testid': 'pw-rev' }, ...ws.revisions.map((r) => h('option', { value: r.id, selected: r.id === rev?.id }, `Rev ${r.revision} · ${REV_TR[r.status] ?? r.status}`)));
        revSel.addEventListener('change', () => void go({ product: productId, rev: val(revSel) }));
        // ---------------------------------------------------------------------------------------- document cards (resim / CAD / CAM / takım / kalite dokümanları)
        const docCard = (tid, title, card, docType) => {
            const st = (card?.state ?? 'MISSING');
            const file = h('input', { type: 'file', 'data-testid': `pw-${tid}-file` });
            const note = h('input', { 'data-testid': `pw-${tid}-note`, placeholder: 'Not / değişiklik (isteğe bağlı)' });
            const upload = async () => {
                const f = file.files?.[0];
                if (!f || !rev)
                    return fail(new Error('CONTENT_REQUIRED'));
                try {
                    const bytes = new Uint8Array(await f.arrayBuffer());
                    const existing = card?.documents.find((d) => d.docType === docType);
                    const r = await api.upload({ docType: docType, entityType: 'PRODUCT_REVISION', entityId: rev.id, title: existing ? null : `${title} ${ws.product.code}`, fileName: f.name, mimeType: guessMime(f.name, f.type), contentBase64: toBase64(bytes), validUntil: null, note: val(note).trim() || null, documentId: existing?.id ?? null });
                    await reload(`Yüklendi: sürüm ${r.versionNo} — TASLAK. Üretimde geçerli olması için Doküman Kontrol'den onay ve yürürlüğe alma gerekir.`);
                }
                catch (e) {
                    fail(e);
                }
            };
            return h('div', { class: 'card', 'data-testid': `pw-card-${tid}`, 'data-state': st }, h('div', { class: 'row' }, h('h2', {}, title), chip(st)), ...(card?.documents ?? []).map((d) => h('div', { class: 'row', 'data-testid': 'pw-doc', 'data-doc-no': d.docNo ?? '' }, h('b', {}, d.docNo ?? '—'), h('span', {}, DOC_TR[d.docType] ?? d.docType), h('span', { class: `chip ${d.controlState === 'EFFECTIVE' ? 'ok' : ''}` }, CTL_TR[d.controlState ?? ''] ?? '—'), h('span', { class: 'mut' }, `v${d.versionNo ?? '—'}${d.effectiveVersionNo ? ` · yürürlükte v${d.effectiveVersionNo}` : ''}`), d.opNos.length ? h('span', { class: 'mut' }, `OP${d.opNos.join(', OP')}`) : null)), st === 'MISSING' ? h('div', { class: 'mut' }, `${NA} — bu revizyonda ${title.toLowerCase()} yok`) : null, docType && can.manageDocuments && editable ? h('div', { class: 'row', style: 'margin-top:8px' }, file, note, h('button', { class: 'ghost', type: 'button', 'data-testid': `pw-${tid}-upload`, onClick: () => void upload() }, 'Yükle (TASLAK)')) : null, h('div', { class: 'mut' }, h('a', { href: '#/dokuman-kontrol' }, 'Doküman Kontrol: onay, yürürlük, geçmiş')));
        };
        // ---------------------------------------------------------------------------------------- routing
        const activeOps = ws.routing.filter((o) => o.active);
        const opEditor = (o) => {
            const op = o;
            const structural = !op || !op.active;
            const noIn = h('input', { 'data-testid': 'pw-op-no', type: 'number', min: 1, value: op ? String(op.opNo) : String((activeOps.at(-1)?.opNo ?? 0) + 10), disabled: !!op });
            const name = h('input', { 'data-testid': 'pw-op-name', value: op?.name ?? '' });
            const mach = machines.map((m) => ({ m, box: h('input', { type: 'checkbox', 'data-testid': `pw-op-m-${m.code}`, checked: !!op?.machines.some((x) => x.id === m.id) }) }));
            const primary = h('select', { 'data-testid': 'pw-op-primary' }, h('option', { value: '' }, '— öncelikli makine yok —'), ...machines.map((m) => h('option', { value: m.id, selected: !!op?.machines.some((x) => x.id === m.id && x.primary) }, m.code)));
            const skill = h('input', { 'data-testid': 'pw-op-skill', value: op?.skillCode ?? '', placeholder: 'Yeterlilik kodu' });
            const level = h('input', { 'data-testid': 'pw-op-level', type: 'number', min: 1, max: 5, value: op?.skillLevel != null ? String(op.skillLevel) : '' });
            const setup = h('input', { 'data-testid': 'pw-op-setup', inputmode: 'decimal', value: op?.setupMinutes != null ? String(op.setupMinutes) : '' });
            const cycle = h('input', { 'data-testid': 'pw-op-cycle', inputmode: 'decimal', value: op?.cycleSeconds != null ? String(op.cycleSeconds) : '' });
            const fp = h('input', { type: 'checkbox', 'data-testid': 'pw-op-fp', checked: op?.firstPieceRequired ?? true });
            const qc = h('input', { type: 'checkbox', 'data-testid': 'pw-op-qc', checked: op?.qcRequired ?? false });
            const ins = h('textarea', { 'data-testid': 'pw-op-instr', placeholder: 'Operatör talimatı' });
            ins.value = op?.instructions ?? '';
            const reason = reasonBox('pw-op-reason');
            const save = async () => {
                const ids = mach.filter((x) => checked(x.box)).map((x) => x.m.id);
                const setupV = num(val(setup));
                const cycleV = num(val(cycle));
                const no = Number(val(noIn));
                const diffs = [];
                if (op) {
                    if (setupV !== op.setupMinutes)
                        diffs.push(`Hazırlık: ${changeText(op.setupMinutes, setupV, 'dk')}`);
                    if (cycleV !== op.cycleSeconds)
                        diffs.push(`Çevrim: ${changeText(op.cycleSeconds, cycleV, 'sn')}`);
                    if (val(name).trim() !== op.name)
                        diffs.push(`Ad: ${changeText(op.name, val(name).trim())}`);
                }
                try {
                    const r = await api.saveOperation({ revisionId: rev.id, opNo: no, name: val(name).trim(), machineIds: ids, primaryId: val(primary) || null, skillCode: val(skill).trim() || null, skillLevel: num(val(level)),
                        camId: op?.camProgramId ?? null, setup: setupV, cycle: cycleV, firstPiece: checked(fp), qc: checked(qc), instructions: val(ins).trim() || null, reason: val(reason).trim() });
                    await reload(`${r.opCode} ${r.created ? 'eklendi' : 'kaydedildi'} (sürüm ${r.versionNo}).${diffs.length ? ' ' + diffs.join(' · ') + '.' : ''}${r.recalculatedRuns ? ` ${r.recalculatedRuns} etkilenen hesap yeniden değerlendirildi (eski hesaplar korunur).` : ''}`, 'ok', { openOp: r.operationId });
                }
                catch (e) {
                    fail(e);
                }
            };
            return h('div', { class: 'op', 'data-testid': op ? 'pw-op-edit' : 'pw-op-new' }, h('div', { class: 'grid' }, h('div', {}, h('label', {}, 'Operasyon no'), noIn), h('div', {}, h('label', {}, 'Ad'), name), h('div', {}, h('label', {}, 'Hazırlık (dk)'), setup), h('div', {}, h('label', {}, 'Çevrim (sn/adet)'), cycle), h('div', {}, h('label', {}, 'Yeterlilik'), skill), h('div', {}, h('label', {}, 'Seviye (1-5)'), level), h('div', {}, h('label', {}, 'Öncelikli makine'), primary)), h('h3', {}, 'İzinli makineler'), h('div', { class: 'row' }, ...mach.map((x) => h('label', { class: 'row', style: 'color:#e2e8f0;font-size:14px' }, x.box, x.m.code))), h('div', { class: 'row', style: 'margin-top:6px' }, h('label', { class: 'row', style: 'color:#e2e8f0;font-size:14px' }, fp, 'İlk parça kontrolü şart'), h('label', { class: 'row', style: 'color:#e2e8f0;font-size:14px' }, qc, 'Kalite kontrolü şart')), h('div', { style: 'margin-top:6px' }, ins), !can.editStructure && structural ? h('div', { class: 'mut' }, 'Yeni operasyon eklemek için taslak revizyon gerekir.') : null, h('div', { class: 'row', style: 'margin-top:8px' }, reason, h('button', { class: 'primary', type: 'button', 'data-testid': 'pw-op-save', onClick: () => void save() }, 'Kaydet ve etkilenen hesapları yeniden değerlendir')));
        };
        const move = async (o, dir) => {
            const ids = activeOps.map((x) => x.id);
            const i = ids.indexOf(o.id);
            const j = i + dir;
            if (j < 0 || j >= ids.length)
                return;
            [ids[i], ids[j]] = [ids[j], ids[i]];
            const why = prompt0('pw-reorder-reason');
            if (why === null)
                return;
            try {
                await api.reorder(rev.id, ids, why);
                await reload('Operasyon sırası değişti.');
            }
            catch (e) {
                fail(e);
            }
        };
        // "reason" for quick actions comes from the shared reason box of the routing card (no browser dialogs)
        const quickReason = reasonBox('pw-quick-reason', 'Hızlı işlem gerekçesi (sırala / pasife al / bağımlılık / kalite noktası)');
        const prompt0 = (_tid) => { const v = val(quickReason).trim(); if (v.length < 10) {
            fail(new Error('REASON_REQUIRED: gerekçe en az 10 karakter'));
            return null;
        } return v; };
        const opCard = (o) => {
            const open = state.openOp === o.id;
            const insp = h('input', { 'data-testid': 'pw-insp-value', inputmode: 'decimal', placeholder: 'Muayene sn/adet', value: o.inspectionSeconds != null ? String(o.inspectionSeconds) : '' });
            const from = h('input', { 'data-testid': 'pw-insp-from', type: 'date', value: isoToday(), min: isoToday() });
            const preason = reasonBox('pw-insp-reason');
            const hist = h('div', { 'data-testid': 'pw-op-history' });
            const phist = h('div', { 'data-testid': 'pw-param-history' });
            const resKind = h('select', { 'data-testid': 'pw-res-kind' }, ...['FIXTURE', 'TOOL', 'GAUGE', 'RESOURCE'].map((k) => h('option', { value: k }, KIND_TR[k])));
            const resCode = h('input', { 'data-testid': 'pw-res-code', placeholder: 'Kod (ör. T12)' });
            const qcNo = h('input', { 'data-testid': 'pw-qc-no', type: 'number', min: 1, placeholder: 'No' });
            const qcLabel = h('input', { 'data-testid': 'pw-qc-label', placeholder: 'Kontrol (ör. Çap Ø20 H7)' });
            const plans = ws.quality.filter((q) => q.operationNo === null || q.operationNo === o.opNo);
            const qcPlan = h('select', { 'data-testid': 'pw-qc-plan' }, h('option', { value: '' }, '— kontrol planı seçilmedi —'), ...plans.map((q) => h('option', { value: q.id }, `${q.operationNo != null ? 'OP' + q.operationNo : 'Genel'} v${q.version} (${q.status}) · ${q.characteristics} karakteristik`)));
            const qcKind = h('select', { 'data-testid': 'pw-qc-kind' }, ...['FIRST_PIECE', 'IN_PROCESS', 'FINAL'].map((k) => h('option', { value: k }, KIND_TR[k])));
            const depSel = h('select', { 'data-testid': 'pw-dep-sel' }, h('option', { value: '' }, '— ön koşul operasyon —'), ...activeOps.filter((x) => x.opNo < o.opNo && !o.dependsOn.some((d) => d.operationId === x.id)).map((x) => h('option', { value: x.id }, x.opCode)));
            const act = async (fn, text) => { const why = prompt0('x'); if (why === null)
                return; try {
                await fn();
                await reload(text, 'ok', { openOp: o.id });
            }
            catch (e) {
                fail(e);
            } };
            const showHist = async () => {
                try {
                    const rows = await api.opHistory(o.id);
                    hist.replaceChildren(h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Sürüm', 'Tür', 'Kim / Ne zaman', 'Ad', 'Hazırlık', 'Çevrim', 'Gerekçe'].map((c) => h('th', {}, c)))), h('tbody', {}, ...rows.map((r, i) => {
                        const prev = rows[i + 1];
                        return h('tr', { 'data-testid': 'pw-op-hist-row' }, h('td', {}, `v${r.versionNo}`), h('td', {}, r.kind), h('td', {}, `${r.by ?? '—'} · ${when(r.at)}`), h('td', {}, r.name ?? '—'), h('td', {}, prev ? changeText(prev.setupMinutes, r.setupMinutes) : n(r.setupMinutes)), h('td', {}, prev ? changeText(prev.cycleSeconds, r.cycleSeconds) : n(r.cycleSeconds)), h('td', {}, r.reason ?? '—'));
                    })))));
                }
                catch (e) {
                    fail(e);
                }
            };
            const showParam = async () => {
                try {
                    const ph = await api.parameterHistory('OP_INSPECTION_SEC', o.id);
                    phist.replaceChildren(h('div', { class: 'mut' }, `${ph.def.canonicalSource} · sahip: ${ph.def.ownerDomain}`), ...ph.versions.map((v) => h('div', { 'data-testid': 'pw-param-row', class: 'row' }, h('b', {}, `v${v.versionNo}`), h('span', {}, changeText(v.prevValue, v.value, ph.def.unit)), h('span', { class: 'mut' }, `${v.validFrom}${v.validTo ? ' → ' + v.validTo : ' →'} · ${v.setBy ?? '—'} · ${v.reason}`), v.inForce ? h('span', { class: 'chip ok' }, 'Yürürlükte') : null)));
                    if (!ph.versions.length)
                        phist.replaceChildren(h('div', { class: 'mut' }, `${NA} — hiç değer girilmemiş`));
                }
                catch (e) {
                    fail(e);
                }
            };
            const setInsp = async () => {
                const v = num(val(insp));
                if (v === null)
                    return fail(new Error('VALUE_OUT_OF_RANGE'));
                try {
                    const r = await api.setParameter('OP_INSPECTION_SEC', o.id, v, val(from) || null, null, val(preason).trim());
                    await reload(`Muayene süresi ${o.opCode}: ${changeText(r.oldValue, r.newValue, 'sn')} (sürüm ${r.versionNo}, ${r.validFrom} itibarıyla). Eski hesaplar eski parametre sürümüyle korunur; etkilenenler "Eskimiş" görünür.`, 'ok', { openOp: o.id });
                }
                catch (e) {
                    fail(e);
                }
            };
            const st = o.state;
            return h('div', { class: `op ${o.active ? '' : 'off'}`, 'data-testid': 'pw-op', 'data-op': o.opCode, 'data-active': String(o.active), 'data-state': st }, h('div', { class: 'row' }, h('b', {}, o.opCode), h('span', {}, o.name), chip(st), o.active ? null : h('span', { class: 'chip bad' }, 'Pasif'), h('span', { class: 'mut' }, `v${o.versionNo ?? '—'}${o.usedInWorkOrders ? ` · ${o.usedInWorkOrders} iş emrinde` : ''}`)), h('div', { class: 'row mut' }, h('span', {}, `Makine: ${o.machines.length ? o.machines.map((m) => (m.primary ? `★${m.code}` : m.code)).join(', ') : NA}`), h('span', {}, `Hazırlık ${n(o.setupMinutes)} dk`), h('span', {}, `Çevrim ${n(o.cycleSeconds)} sn`), h('span', {}, `Muayene ${n(o.inspectionSeconds)} sn`), o.camProgram ? h('span', {}, `CAM ${o.camProgram}`) : h('span', {}, 'CAM yok'), o.firstPieceRequired ? h('span', { class: 'chip warn' }, 'İlk parça') : null, o.qcRequired ? h('span', { class: 'chip warn' }, 'Kalite') : null), o.resources.length || o.qcPoints.length || o.dependsOn.length || o.documents.length ? h('div', { class: 'mut' }, o.resources.length ? `Kaynak: ${o.resources.map((r) => `${KIND_TR[r.kind] ?? r.kind} ${r.code}`).join(', ')}. ` : '', o.dependsOn.length ? `Ön koşul: ${o.dependsOn.map((d) => d.opCode).join(', ')}. ` : '', o.qcPoints.length ? `Kalite noktaları: ${o.qcPoints.map((q) => `${q.pointNo}-${q.label}${q.controlPlan ? ' [plan ' + q.controlPlan + ']' : ''}`).join('; ')}. ` : '', o.documents.length ? `Belgeler: ${o.documents.map((d) => d.docNo).join(', ')}.` : '') : null, h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'ghost', type: 'button', 'data-testid': `pw-op-toggle-${o.opCode}`, onClick: () => void go({ product: productId, rev: rev?.id ?? null, openOp: open ? null : o.id, qty: state.qty }) }, open ? 'Kapat' : (can.editRouting && editable ? 'Aç / düzenle' : 'Aç')), can.editStructure && o.active ? h('button', { class: 'ghost', type: 'button', 'data-testid': `pw-op-up-${o.opCode}`, onClick: () => void move(o, -1) }, '↑') : null, can.editStructure && o.active ? h('button', { class: 'ghost', type: 'button', 'data-testid': `pw-op-down-${o.opCode}`, onClick: () => void move(o, 1) }, '↓') : null, can.editStructure ? h('button', { class: o.active ? 'danger' : 'ghost', type: 'button', 'data-testid': `pw-op-active-${o.opCode}`, onClick: () => void act(() => api.setActive(o.id, !o.active, val(quickReason).trim()), o.active ? `${o.opCode} pasife alındı (silinmez, geçmişi korunur).` : `${o.opCode} etkinleştirildi.`) }, o.active ? 'Pasife al' : 'Etkinleştir') : null), open ? h('div', {}, can.editRouting && editable && o.active ? opEditor(o) : h('div', { class: 'mut' }, o.active ? 'Bu revizyonu düzenleme yetkiniz yok ya da revizyon kapalı.' : 'Pasif operasyon düzenlenmez.'), o.active && can.editRouting && editable ? h('div', {}, h('h3', {}, 'Muayene süresi (parametre standardı)'), h('div', { class: 'grid' }, h('div', {}, h('label', {}, 'Değer (sn/adet)'), insp), h('div', {}, h('label', {}, 'Geçerlilik başlangıcı'), from), h('div', {}, h('label', {}, 'Gerekçe'), preason)), h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'primary', type: 'button', 'data-testid': 'pw-insp-save', onClick: () => void setInsp() }, 'Parametreyi kaydet'), h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-param-hist-btn', onClick: () => void showParam() }, 'Parametre geçmişi')), phist, h('h3', {}, 'Kaynak / fikstür / takım'), h('div', { class: 'row' }, resKind, resCode, h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-res-add', onClick: () => void act(() => api.setResource(o.id, val(resKind), val(resCode).trim(), null, null, null, true, val(quickReason).trim()), 'Kaynak eklendi.') }, 'Ekle'), ...o.resources.map((r) => h('button', { class: 'ghost', type: 'button', 'data-testid': `pw-res-del-${r.code}`, onClick: () => void act(() => api.setResource(o.id, r.kind, r.code, r.label, r.qty, r.note, false, val(quickReason).trim()), `${r.code} kaldırıldı.`) }, `✕ ${r.code}`))), h('h3', {}, 'Kalite kontrol noktaları'), h('div', { class: 'row' }, qcNo, qcLabel, qcKind, qcPlan, h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-qc-add', onClick: () => void act(() => api.setQcPoint(o.id, Number(val(qcNo)), val(qcLabel).trim(), val(qcKind), val(qcPlan) || null, null, true, val(quickReason).trim()), 'Kalite noktası kaydedildi.') }, 'Ekle / güncelle')), ...(can.editStructure ? [h('h3', {}, 'Bağımlılık (ön koşul)'), h('div', { class: 'row' }, depSel, h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-dep-add', onClick: () => void act(() => api.setDependency(o.id, val(depSel), true, val(quickReason).trim()), 'Bağımlılık eklendi.') }, 'Ekle'), ...o.dependsOn.map((d) => h('button', { class: 'ghost', type: 'button', onClick: () => void act(() => api.setDependency(o.id, d.operationId, false, val(quickReason).trim()), `${d.opCode} bağımlılığı kaldırıldı.`) }, `✕ ${d.opCode}`)))] : [])) : null, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-op-hist-btn', onClick: () => void showHist() }, 'Operasyon geçmişi (önce → sonra)')), hist) : null);
        };
        const checks = Array.isArray(ws.routingCheck) ? ws.routingCheck : ws.routingCheck?.checks ?? [];
        const routingCard = h('div', { class: 'card', 'data-testid': 'pw-card-routing', style: 'grid-column:1/-1' }, h('div', { class: 'row' }, h('h2', {}, 'Rota ve operasyonlar'), chip(ws.routing.length ? (rev?.state ?? 'MISSING') : 'MISSING')), h('div', { class: 'row mut' }, ...checks.map((c) => h('span', { class: `chip ${c.status === 'OK' ? 'ok' : c.status === 'NA' ? '' : 'warn'}`, 'data-testid': 'pw-route-check', 'data-code': c.code, 'data-status': c.status, title: c.detail }, `${c.label}: ${c.detail}`))), can.editRouting && editable ? h('div', { class: 'row', style: 'margin-top:6px' }, quickReason) : null, !ws.routing.length ? h('div', { class: 'mut', 'data-testid': 'pw-route-empty' }, `${NA} — bu revizyonda operasyon yok`) : null, ...ws.routing.map(opCard), can.editStructure ? h('div', { style: 'margin-top:8px' }, state.openOp === 'NEW' ? opEditor(null) : h('button', { class: 'primary', type: 'button', 'data-testid': 'pw-op-add', onClick: () => void go({ product: productId, rev: rev?.id ?? null, openOp: 'NEW', qty: state.qty }) }, '+ Operasyon ekle')) : null, can.editRouting && rev?.status === 'RELEASED' ? h('div', { class: 'mut' }, 'Yürürlükteki revizyonda operasyon ekleme/sıralama/pasife alma yapılmaz; makine, süre, kaynak ve talimat güncellenir (sürümlenir). Yapısal değişiklik için taslak revizyon açın.') : null);
        // ---------------------------------------------------------------------------------------- estimate & calculations
        const qty = h('input', { 'data-testid': 'pw-calc-qty', type: 'number', min: 1, value: String(state.qty ?? 1) });
        const out = h('div', { 'data-testid': 'pw-calc-out' });
        const creason = reasonBox('pw-calc-reason', 'Yeniden değerlendirme gerekçesi (≥10)');
        const doEstimate = async () => {
            try {
                const e = await api.estimate(rev.id, Number(val(qty)));
                out.replaceChildren(h('div', { class: `chip ${e.complete ? 'ok' : 'warn'}`, 'data-testid': 'pw-calc-total', 'data-complete': String(e.complete) }, e.complete ? `Toplam ${n(e.totalMinutes)} dk` : `EKSİK VERİ — kısmi ${n(e.partialMinutes)} dk (toplam hesaplanamadı)`));
            }
            catch (e) {
                fail(e);
            }
        };
        const saveCalc = async () => { try {
            await api.runCalc(rev.id, Number(val(qty)), null);
            await reload('Hesap kaydedildi (değişmez kayıt).', 'ok', { qty: Number(val(qty)) });
        }
        catch (e) {
            fail(e);
        } };
        const reeval = async (runId) => { const why = val(creason).trim(); try {
            const r = await api.reevaluate(runId, why);
            await reload(`Hesap yenilendi: ${changeText(r.oldTotalMinutes, r.newTotalMinutes, 'dk')}. Eski kayıt silinmedi.`);
        }
        catch (e) {
            fail(e);
        } };
        const calcCard = h('div', { class: 'card', 'data-testid': 'pw-card-calc' }, h('h2', {}, 'Süre hesabı ve geçmişi'), rev ? h('div', { class: 'row' }, qty, h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-calc-run', onClick: () => void doEstimate() }, 'Hesapla'), can.editRouting ? h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-calc-save', onClick: () => void saveCalc() }, 'Hesabı kaydet') : null) : null, out, h('div', { class: 'mut' }, 'Formül: Σ (hazırlık + adet × (çevrim + muayene) / 60). Eksik standart VERİ YOK sayılır, 0 yazılmaz. Gerçek üretim ölçümü (ProductionSession) bu ekrandan değiştirilemez.'), ...(ws.calculations.length ? [creason] : []), ...ws.calculations.map((c) => h('div', { class: 'row', 'data-testid': 'pw-calc-row', 'data-state': c.state ?? '' }, h('span', { class: `chip ${CALC_CLS[c.state ?? ''] ?? ''}` }, CALC_TR[c.state ?? ''] ?? '—'), h('span', {}, `${c.qty} adet`), h('b', {}, c.complete ? `${n(c.totalMinutes)} dk` : 'EKSİK'), h('span', { class: 'mut' }, when(c.computedAt)), c.state === 'STALE' && can.editRouting ? h('button', { class: 'primary', type: 'button', 'data-testid': 'pw-calc-reeval', onClick: () => void reeval(c.runId) }, 'Yeniden değerlendir') : null)));
        const idCard = h('div', { class: 'card', 'data-testid': 'pw-card-identity' }, h('div', { class: 'row' }, h('h2', {}, 'Kimlik'), chip((rev?.state ?? 'MISSING'))), h('div', { class: 'grid' }, ...[['Kod', ws.product.code], ['Ad', ws.product.name], ['Aile', ws.product.family], ['Malzeme', ws.product.material], ['Durum', ws.product.status], ['Revizyon', rev ? `Rev ${rev.revision} · ${REV_TR[rev.status]}` : null],
            ...(ws.product.customerName ? [['Müşteri', ws.product.customerName], ['Müşteri parça no', ws.product.customerPartNo ?? null]] : [])]
            .map(([k, v]) => h('div', {}, h('label', {}, k), h('b', {}, v ?? NA)))), h('div', { class: 'mut' }, h('a', { href: `#/urun-master?urun=${ws.product.id}` }, 'Pasaport / QR / hazırlık kontrolü')));
        const bomCode = h('input', { 'data-testid': 'pw-bom-code', placeholder: 'Malzeme kodu' });
        const bomQty = h('input', { 'data-testid': 'pw-bom-qty', inputmode: 'decimal', placeholder: 'Adet başına' });
        const bomScrap = h('input', { 'data-testid': 'pw-bom-scrap', inputmode: 'decimal', placeholder: 'Fire %', value: '0' });
        const bomReason = reasonBox('pw-bom-reason');
        const bomEditable = can.manageBom && rev?.status === 'DRAFT';
        const bomSave = async (code, qty, scrap, before) => {
            if (qty === null || scrap === null)
                return fail(new Error('QTY_PER_UNIT_MUST_BE_POSITIVE'));
            try {
                const r = await api.saveBomLine(rev.id, code, qty, scrap, val(bomReason).trim());
                await reload(r.created ? `BOM satırı eklendi: ${code} ${n(qty)} /adet.` : `BOM satırı güncellendi: ${code} — adet ${changeText(before?.q, qty)}, fire % ${changeText(before?.s, scrap)}.`);
            }
            catch (e) {
                fail(e);
            }
        };
        const bomRows = ws.bom.map((b) => {
            const q = h('input', { 'data-testid': 'pw-bom-row-qty', inputmode: 'decimal', value: String(b.qtyPerUnit), style: 'max-width:110px' });
            const sc = h('input', { 'data-testid': 'pw-bom-row-scrap', inputmode: 'decimal', value: String(b.scrapAllowancePct ?? 0), style: 'max-width:90px' });
            return h('div', { class: 'row', 'data-testid': 'pw-bom-row', 'data-code': b.materialCode }, h('b', {}, b.materialCode), bomEditable ? h('span', { class: 'row' }, q, sc, h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-bom-row-save', onClick: () => void bomSave(b.materialCode, num(val(q)), num(val(sc)), { q: b.qtyPerUnit, s: b.scrapAllowancePct }) }, 'Güncelle'), h('button', { class: 'danger', type: 'button', 'data-testid': 'pw-bom-row-del', onClick: async () => { try {
                    await api.removeBomLine(rev.id, b.materialCode, val(bomReason).trim());
                    await reload(`BOM satırı kaldırıldı: ${b.materialCode} (geçmişte kalır).`);
                }
                catch (e) {
                    fail(e);
                } } }, 'Kaldır'))
                : h('span', {}, `${n(b.qtyPerUnit)} /adet${b.scrapAllowancePct != null ? ` · fire %${n(b.scrapAllowancePct)}` : ''}`));
        });
        const bomCard = h('div', { class: 'card', 'data-testid': 'pw-card-bom' }, h('div', { class: 'row' }, h('h2', {}, 'BOM'), chip(ws.bom.length ? (rev?.state ?? 'MISSING') : 'MISSING')), ...(bomRows.length ? bomRows : [h('div', { class: 'mut' }, `${NA} — bu revizyonda BOM yok`)]), bomEditable ? h('div', { style: 'margin-top:8px' }, h('div', { class: 'grid' }, h('div', {}, h('label', {}, 'Malzeme'), bomCode), h('div', {}, h('label', {}, 'Adet başına'), bomQty), h('div', {}, h('label', {}, 'Fire %'), bomScrap), h('div', {}, h('label', {}, 'Gerekçe'), bomReason)), h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'primary', type: 'button', 'data-testid': 'pw-bom-add', onClick: () => void bomSave(val(bomCode).trim(), num(val(bomQty)), num(val(bomScrap))) }, 'Satır ekle')))
            : h('div', { class: 'mut', 'data-testid': 'pw-bom-note' }, !can.manageBom ? 'BOM düzenleme yetkiniz yok.' : rev?.status === 'RELEASED' ? 'Yürürlükteki revizyonun BOM’u teknik veridir: değişiklik için yeni (taslak) revizyon açın — kaynak aynı BOM’dur, ikinci reçete oluşmaz.' : ''), h('div', { class: 'mut' }, h('a', { href: `#/urun-master?urun=${ws.product.id}` }, 'Yeni revizyon / BOM taslağı / yayın: Ürün Master')));
        const qualityCard = h('div', { class: 'card', 'data-testid': 'pw-card-quality' }, h('div', { class: 'row' }, h('h2', {}, 'Kalite planı'), chip(ws.quality.length ? (rev?.state ?? 'MISSING') : 'MISSING')), ...(ws.quality.length ? ws.quality.map((q) => {
            const linked = ws.routing.flatMap((o) => o.qcPoints.filter((p) => p.controlPlanId === q.id).map((p) => `${o.opCode} KN${p.pointNo}`));
            return h('div', { class: 'row', 'data-testid': 'pw-plan', 'data-linked': String(linked.length) }, h('b', {}, q.operationNo != null ? `OP${q.operationNo}` : 'Genel'), h('span', {}, `v${q.version} · ${q.status}`), h('span', { class: 'mut' }, `${q.characteristics} karakteristik`), h('span', { class: `chip ${linked.length ? 'ok' : ''}` }, linked.length ? `Bağlı: ${linked.join(', ')}` : 'Operasyona bağlı değil'));
        }) : [h('div', { class: 'mut' }, `${NA} — kontrol planı yok`)]), h('div', { class: 'mut' }, 'Kontrol planı kaynağı Kalite’dir; burada yalnız mevcut plan seçilir ve operasyonun kalite noktasına bağlanır (yeni kalite verisi oluşmaz). Bağlama: ilgili operasyonu açın → Kalite kontrol noktaları.'), h('div', { class: 'mut' }, h('a', { href: '#/kalite' }, 'Kontrol planı düzenleme: Kalite')));
        const paramCard = h('div', { class: 'card', 'data-testid': 'pw-card-params' }, h('h2', {}, 'Parametre standardı'), ...ws.parameterDefs.map((d) => h('div', { 'data-testid': 'pw-param-def', 'data-code': d.code, style: 'margin:4px 0' }, h('b', {}, `${d.name} (${d.unit})`), h('span', { class: `chip ${d.changeClass === 'TECHNICAL' ? 'warn' : ''}`, style: 'margin-left:6px' }, d.changeClass === 'TECHNICAL' ? 'Teknik: revizyon+onay' : 'Operasyonel'), h('div', { class: 'mut' }, `Sahip: ${d.ownerDomain} · Kaynak: ${d.canonicalSource}${d.min != null || d.max != null ? ` · aralık ${n(d.min)}–${n(d.max)}` : ''}`))), h('div', { class: 'mut' }, 'Her değer: sürüm, geçerlilik başlangıç/bitişi, kim/ne zaman/neden, eski→yeni. Geçmişe dönük değişmez; eski hesaplar eski sürümle kalır.'));
        const histCard = h('div', { class: 'card', 'data-testid': 'pw-card-history' }, h('h2', {}, 'Değişiklik geçmişi'), h('div', { class: 'mut' }, 'Revizyon, doküman, operasyon ve parametre değişiklikleri ürünün olay kaydında tutulur.'), h('a', { href: `#/urun-master?urun=${ws.product.id}&sekme=gecmis` }, 'Olay kaydını aç'));
        shell(h('div', { class: 'row' }, h('h1', {}, `${ws.product.code} — ${ws.product.name}`), h('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-back', onClick: () => void go({}) }, '← Ürünler')), banner, h('div', { class: 'row' }, revSel, rev ? chip(rev.state) : null, h('span', { class: 'mut' }, can.editRouting ? 'Düzenleme yetkiniz var' : 'Yalnız görüntüleme')), h('div', { class: 'cards' }, idCard, docCard('drawing', 'Teknik resim', ws.cards.drawing, 'DRAWING'), docCard('cad', 'CAD / STEP', ws.cards.cad, 'CAD_MODEL'), docCard('cam', 'CAM / NC', ws.cards.cam, 'NC_PROGRAM'), docCard('tools', 'Takım listesi', ws.cards.tools, 'TOOL_LIST'), bomCard, routingCard, paramCard, qualityCard, calcCard, histCard));
    }
}
