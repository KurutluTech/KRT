// KMI NEXT — ROTA HAZIRLIK: 101 CUT/PREP (OP numarası dışı) · operasyon makine/kurulum/çevrim · uç payı · rotayı iş emrine uygula.
// Gerçek değer ÖNERİLMEZ/uydurulmaz: alanlar boş başlar. Revizyon durumu/kurallar sunucuda uygulanır; uç payı yayınlı Rev A'da hazırlık parametresi olarak denetimle düzeltilir.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `.rp{max-width:980px;margin:0 auto;padding:0 16px 40px;color:var(--kmi-text,#e2e8f0)}.rp h1{font-size:22px}.rp h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--kmi-mut,#94a3b8);margin:22px 0 8px}
.rp-panel{border:1px solid var(--kmi-line,#1e2d4a);border-radius:14px;padding:12px;margin:8px 0;background:rgba(15,23,42,.6)}.rp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}
.rp input[type=text],.rp input[type=number],.rp select{min-height:40px;border-radius:10px;border:1px solid var(--kmi-line,#334155);padding:6px 10px;background:transparent;color:inherit}
.rp button{min-height:40px;border-radius:10px;border:1px solid var(--kmi-info,#38bdf8);padding:6px 14px;background:rgba(56,189,248,.12);color:var(--kmi-info,#38bdf8);font-weight:800}.rp button:disabled{opacity:.45}
.rp-msg{padding:10px 14px;border-radius:12px;margin:8px 0;font-weight:700;border:1px solid}.rp-msg.ok{color:#4ade80}.rp-msg.error{color:#f87171}.rp table{width:100%;border-collapse:collapse;font-size:13px}.rp th,.rp td{text-align:left;padding:4px 8px;border-top:1px solid rgba(148,163,184,.2)}
.rp-wrap{overflow-x:auto}@media (max-width:520px){.rp input,.rp select{width:100%}}`;
const num = (v) => { const s = String(v ?? '').trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
export async function renderRoutePrepScreen(container, { api, goto = (href) => { location.hash = href; } }, view = {}) {
    const redo = (v) => void renderRoutePrepScreen(container, { api, goto }, { ...view, ...v });
    let revs = [], prods = [], machines = [];
    try { [revs, prods, machines] = await Promise.all([api.revisions(), api.products(), api.machines()]); }
    catch (e) { mount(container, h('div', { class: 'rp' }, h('div', { 'data-testid': 'rp-load-error', class: 'rp-msg error', role: 'alert' }, errorText(e)))); return; }
    const pc = new Map(prods.map((p) => [p.id, p.code]));
    const revSel = h('select', { 'data-testid': 'rp-revision', 'aria-label': 'Ürün revizyonu', onChange: (ev) => redo({ rev: ev.target.value, message: null, editOp: null }) },
        h('option', { value: '' }, 'Ürün / revizyon seçin'), ...revs.map((r) => h('option', { value: r.id, ...(r.id === view.rev ? { selected: true } : {}) }, `${pc.get(r.productId) ?? '?'} · Rev ${r.revision} · ${r.status === 'RELEASED' ? 'yayınlı' : 'taslak'}`)));
    const msg = view.message ? h('div', { 'data-testid': 'rp-message', class: `rp-msg ${view.message.kind}`, role: view.message.kind === 'error' ? 'alert' : 'status' }, view.message.text) : null;
    const head = [h('style', {}, CSS), h('h1', { 'data-testid': 'rp-heading' }, 'Rota hazırlık — CUT/PREP · operasyonlar · uç payı'), msg, revSel];
    if (!view.rev) { mount(container, h('div', { class: 'rp' }, ...head)); return; }
    const rev = revs.find((r) => r.id === view.rev);
    let ops = [], lines = [], specs = [], cams = [], wos = [];
    try { [ops, lines, cams, wos] = await Promise.all([api.routeOps(view.rev), api.bomLines(view.rev), api.camPrograms(view.rev), api.workOrders()]); specs = await api.barSpecs(lines.map((l) => l.id)); }
    catch (e) { mount(container, h('div', { class: 'rp' }, ...head, h('div', { 'data-testid': 'rp-load-error', class: 'rp-msg error', role: 'alert' }, errorText(e)))); return; }
    const mname = (id) => machines.find((m) => m.id === id)?.code ?? '?';
    const m101 = machines.find((m) => m.code === '101');
    const run = async (fn, okText, again = {}) => { try { const r = await fn(); redo({ message: { kind: 'ok', text: typeof okText === 'function' ? okText(r) : okText }, ...again }); } catch (e) { redo({ message: { kind: 'error', text: `Kaydedilemedi: ${errorText(e)}` }, ...again }); } };
    const reason = (tid) => h('input', { type: 'text', 'data-testid': tid, placeholder: 'Gerekçe (en az 10 karakter — denetim kaydı)', 'aria-label': 'Gerekçe', size: 38 });
    // --- mevcut rota
    const table = h('div', { class: 'rp-wrap' }, h('table', { 'data-testid': 'rp-ops' }, h('thead', {}, h('tr', {}, ...['Op', 'Ad', 'Makine', 'Kurulum dk', 'Çevrim sn', 'CAM', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...ops.filter((o) => o.active !== false).map((o) => h('tr', { 'data-testid': 'rp-op', 'data-opno': String(o.opNo) },
            h('td', {}, o.opKind === 'CUT_PREP' ? 'CUT/PREP' : `OP${o.opNo}`), h('td', {}, o.name), h('td', {}, (o.allowedMachineIds ?? []).map(mname).join(', ')),
            h('td', {}, o.setupMinutesTarget ?? '—'), h('td', {}, o.cycleSecondsTarget ?? '—'), h('td', {}, o.opKind === 'CUT_PREP' ? 'gerekmiyor' : (o.camProgramId ? 'bağlı' : 'yok')),
            h('td', {}, o.opKind === 'CUT_PREP' ? null : h('button', { type: 'button', 'data-testid': 'rp-edit', onClick: () => redo({ editOp: o.opNo, message: null }) }, 'Düzenle')))))));
    // --- CUT/PREP
    const cp = ops.find((o) => o.opKind === 'CUT_PREP');
    const cpSetup = h('input', { type: 'number', step: 'any', min: '0', 'data-testid': 'cp-setup', placeholder: 'Kurulum (dk)', 'aria-label': 'CUT/PREP kurulum dk', value: cp?.setupMinutesTarget ?? '' });
    const cpCycle = h('input', { type: 'number', step: 'any', min: '0', 'data-testid': 'cp-cycle', placeholder: 'Çevrim (sn/parça)', 'aria-label': 'CUT/PREP çevrim sn', value: cp?.cycleSecondsTarget ?? '' });
    const cpReason = reason('cp-reason');
    const cpBtn = h('button', { type: 'button', 'data-testid': 'cp-save', ...(m101 ? {} : { disabled: true }), onClick: () => {
        const s = num(cpSetup.value), c = num(cpCycle.value);
        if (Number.isNaN(s) || Number.isNaN(c) || (s !== null && s < 0) || (c !== null && c <= 0)) return redo({ message: { kind: 'error', text: 'Süre değerleri geçersiz.' } });
        if (cpReason.value.trim().length < 10) return redo({ message: { kind: 'error', text: 'Gerekçe en az 10 karakter olmalı.' } });
        void run(() => api.saveCutPrep({ revisionId: view.rev, machineId: m101.id, setup: s, cycle: c, reason: cpReason.value.trim() }), 'CUT/PREP kaydedildi (101).'); } }, cp ? 'CUT/PREP güncelle' : 'CUT/PREP tanımla');
    // --- operasyon
    const eo = view.editOp != null ? ops.find((o) => o.opNo === view.editOp && o.opKind !== 'CUT_PREP') : null;
    const f = { no: h('input', { type: 'number', min: '10', step: '10', 'data-testid': 'op-no', placeholder: 'Op no (10,20,30…)', 'aria-label': 'Operasyon no', value: eo?.opNo ?? '' }),
        name: h('input', { type: 'text', 'data-testid': 'op-name', placeholder: 'Operasyon adı', 'aria-label': 'Operasyon adı', value: eo?.name ?? '' }),
        setup: h('input', { type: 'number', step: 'any', min: '0', 'data-testid': 'op-setup', placeholder: 'Kurulum (dk)', 'aria-label': 'Kurulum dk', value: eo?.setupMinutesTarget ?? '' }),
        cycle: h('input', { type: 'number', step: 'any', min: '0', 'data-testid': 'op-cycle', placeholder: 'Çevrim (sn/parça)', 'aria-label': 'Çevrim sn', value: eo?.cycleSecondsTarget ?? '' }),
        fp: h('input', { type: 'checkbox', 'data-testid': 'op-fp', ...((eo?.firstPieceRequired ?? true) ? { checked: true } : {}) }),
        qc: h('input', { type: 'checkbox', 'data-testid': 'op-qc', ...((eo?.qcRequired ?? true) ? { checked: true } : {}) }),
        cam: h('select', { 'data-testid': 'op-cam', 'aria-label': 'CAM programı' }, h('option', { value: '' }, 'CAM programı (isteğe bağlı)'), ...cams.map((c) => h('option', { value: c.id, ...(eo?.camProgramId === c.id ? { selected: true } : {}) }, `${c.programNo} · ${c.revision}`))),
        primary: h('select', { 'data-testid': 'op-primary', 'aria-label': 'Birincil makine' }, h('option', { value: '' }, 'Birincil makine'), ...machines.filter((m) => m.code !== '101').map((m) => h('option', { value: m.id, ...(eo?.primaryMachineId === m.id ? { selected: true } : {}) }, m.code))),
        reason: reason('op-reason') };
    const mchk = machines.filter((m) => m.code !== '101').map((m) => h('label', { class: 'rp-row' }, h('input', { type: 'checkbox', 'data-testid': 'op-machine', value: m.id, ...(eo?.allowedMachineIds?.includes(m.id) ? { checked: true } : {}) }), `${m.code} ${m.name ?? ''}`));
    const opBtn = h('button', { type: 'button', 'data-testid': 'op-save', onClick: () => {
        const no = num(f.no.value), s = num(f.setup.value), c = num(f.cycle.value); const ids = [...container.querySelectorAll('[data-testid="op-machine"]:checked')].map((x) => x.value);
        if (!Number.isInteger(no) || no < 10) return redo({ message: { kind: 'error', text: 'Operasyon no 10 veya üstü olmalı (CUT/PREP ayrı tanımlanır).' }, editOp: view.editOp });
        if (!f.name.value.trim() || !ids.length) return redo({ message: { kind: 'error', text: 'Ad ve en az bir makine gerekli.' }, editOp: view.editOp });
        if (Number.isNaN(s) || Number.isNaN(c)) return redo({ message: { kind: 'error', text: 'Süre değerleri geçersiz.' }, editOp: view.editOp });
        if (f.reason.value.trim().length < 10) return redo({ message: { kind: 'error', text: 'Gerekçe en az 10 karakter olmalı.' }, editOp: view.editOp });
        void run(() => api.saveOp({ revisionId: view.rev, opNo: no, name: f.name.value.trim(), machineIds: ids, primary: f.primary.value || (ids.length === 1 ? ids[0] : null), camId: f.cam.value || null, setup: s, cycle: c, firstPiece: f.fp.checked, qc: f.qc.checked, reason: f.reason.value.trim() }), `OP${no} kaydedildi.`, { editOp: null }); } }, eo ? `OP${eo.opNo} güncelle` : 'Operasyon ekle');
    // --- uç payı
    const specRows = lines.map((l) => ({ l, s: specs.find((x) => x.bomLineId === l.id) })).filter((x) => x.s);
    const et = specRows.map(({ l, s }) => {
        const inp = h('input', { type: 'number', step: 'any', min: '0', 'data-testid': 'et-value', placeholder: 'Ölçülen uç payı (mm)', 'aria-label': 'Uç payı mm', value: s.endTrimMm ?? '' });
        const rs = reason('et-reason');
        return h('div', { class: 'rp-panel', 'data-testid': 'et-panel', 'data-material': l.materialCode },
            h('div', { class: 'rp-row', 'data-testid': 'et-spec' }, `${l.materialCode}: Ø${s.diaMm ?? '?'} · çubuk ${s.barLengthMm ?? '?'} · kesim ${s.cutLengthMm ?? '?'} · testere payı ${s.kerfMm ?? '?'} mm · uç payı ${s.endTrimMm ?? 'TANIMSIZ'} · reçete ${l.qtyPerUnit > 0 ? Math.round(1 / l.qtyPerUnit) : '?'} adet/çubuk`),
            h('div', { class: 'rp-row' }, inp, rs, h('button', { type: 'button', 'data-testid': 'et-save', onClick: () => {
                const v = num(inp.value); if (v === null || Number.isNaN(v) || v < 0) return redo({ message: { kind: 'error', text: 'Uç payı sıfır veya pozitif bir sayı olmalı (gerçek ölçüm).' } });
                if (rs.value.trim().length < 10) return redo({ message: { kind: 'error', text: 'Gerekçe en az 10 karakter olmalı.' } });
                void run(() => api.setEndTrim({ revisionId: view.rev, material: l.materialCode, endTrim: v, reason: rs.value.trim() }), (r) => `Uç payı kaydedildi: ${r.endTrimMm} mm → ${r.piecesPerBar} adet/çubuk${r.recipeMismatch ? ` (UYARI: kayıtlı reçete ${r.recipePiecesPerBar} adet/çubuk; otomatik değiştirilmedi)` : ''}. Revizyon durumu değişmedi.`); } }, 'Uç payını kaydet')));
    });
    const woSel = h('select', { 'data-testid': 'ap-wo', 'aria-label': 'İş emri' }, h('option', { value: '' }, 'İş emri seçin'), ...wos.filter((w) => w.productRevisionId === view.rev).map((w) => h('option', { value: w.id }, `${w.id.slice(0, 8)} · ${w.qtyPlanned} adet · ${w.status}`)));
    const apBtn = h('button', { type: 'button', 'data-testid': 'ap-apply', onClick: () => { if (!woSel.value) return redo({ message: { kind: 'error', text: 'Önce iş emri seçin.' } }); void run(() => api.applyRoute(woSel.value), 'Rota iş emrine uygulandı (operasyonlar BEKLEMEDE doğdu; üretim başlamadı).'); } }, 'Rotayı iş emrine uygula');
    mount(container, h('div', { class: 'rp' }, ...head,
        rev?.status === 'RELEASED' ? h('div', { class: 'woc-meta', 'data-testid': 'rp-released-note' }, 'Yayınlı revizyon: rota ve hazırlık değişiklikleri sunucu kurallarıyla, gerekçe + denetim kaydıyla yapılır; yeni revizyon (Rev B) AÇILMAZ.') : null,
        h('h2', {}, 'Mevcut rota'), table,
        h('h2', {}, '101 CUT/PREP (OP numarası dışı)'), h('div', { class: 'rp-panel' }, h('div', { class: 'rp-row' }, 'Makine: 101 (sabit) · CAM gerekmez'), h('div', { class: 'rp-row' }, cpSetup, cpCycle), h('div', { class: 'rp-row' }, cpReason, cpBtn)),
        h('h2', {}, eo ? `OP${eo.opNo} düzenle` : 'Operasyon ekle (OP10, OP20, …)'), h('div', { class: 'rp-panel' }, h('div', { class: 'rp-row' }, f.no, f.name), h('div', { class: 'rp-row' }, 'Makine(ler):', ...mchk), h('div', { class: 'rp-row' }, f.primary, f.cam), h('div', { class: 'rp-row' }, f.setup, f.cycle),
            h('div', { class: 'rp-row' }, h('label', {}, f.fp, ' İlk parça şart'), h('label', {}, f.qc, ' Kalite kontrol şart')), h('div', { class: 'rp-row' }, f.reason, opBtn)),
        h('h2', {}, 'Uç payı ve testere payı'), ...(et.length ? et : [h('div', { class: 'woc-meta', 'data-testid': 'et-none' }, 'Bu revizyonda çubuk/kesim kaydı yok; önce Ürün çalışma alanında çubuk kaydı girilmeli.')]),
        h('h2', {}, 'Rotayı iş emrine uygula'), h('div', { class: 'rp-row' }, woSel, apBtn)));
}
