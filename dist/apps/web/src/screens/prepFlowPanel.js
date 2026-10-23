// KMI Ürün Çalışma Alanı V2 — tek akışlı "Üretime hazırlık" katmanı: A başlık/sipariş · B yedi adım · C malzeme ve süre · D sürükle-bırak rota · E iş emri kapısı.
// Bu katman KARAR VERMEZ ve veri YAZMAZ (rota sırası ve revizyon yayını hariç, ikisi de mevcut sunucu işlevidir); her şeyi mevcut kanonik kayıtlardan okur, ayrıntılı düzenleme mevcut kartlardadır.
import { h } from '../../../../packages/ui/src/h.js';
import { buildSteps, cncTime, materialSummary, moveId, overallStatus, renumber, reorderErrorText, sameOrder, workOrderGate } from '../prepLogic.js';
import { chip, fmt } from '../kx.js';
import { errorText } from '../errorText.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids.filter((k) => k !== null && k !== undefined && k !== false));
export const PREP_CSS = `
.pv2{display:flex;flex-direction:column;gap:14px;min-width:0}.pv2 *{min-width:0}
.pv2 .sec{border:1px solid #1e293b;border-radius:14px;background:linear-gradient(180deg,#111c2e,#0f172a);padding:16px}
.pv2 .sec>h2{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:0 0 10px}
.pv2 .a-title{font-size:20px;font-weight:800;color:#fff;line-height:1.25;overflow-wrap:anywhere}.pv2 .a-sub{color:#cbd5e1;font-size:13px;margin-top:2px;overflow-wrap:anywhere}
.pv2 .a-top{display:flex;flex-wrap:wrap;gap:10px 14px;justify-content:space-between;align-items:flex-start}
.pv2 .big-chip{font-size:14px;font-weight:800;padding:6px 14px;border-radius:999px}
.pv2 .pvsteps{display:flex;flex-direction:column;gap:8px;align-items:stretch;width:100%}
.pv2 .pvstep{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:4px 12px;align-items:center;padding:10px 12px;border:1px solid #1e293b;border-radius:12px;background:#0b1220}
.pv2 .pvstep .no{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;background:#1e293b;color:#e2e8f0}
.pv2 .pvstep[data-status=DONE] .no{background:#15803d;color:#fff}.pv2 .pvstep[data-status=TODO]{border-color:#b45309}.pv2 .pvstep[data-status=TODO] .no{background:#b45309;color:#fff}.pv2 .pvstep[data-status=WAIT]{border-color:#1d4ed8}.pv2 .pvstep[data-status=WAIT] .no{background:#1d4ed8;color:#fff}.pv2 .pvstep[data-status=LOCKED]{opacity:.7}
.pv2 .pvstep.next{box-shadow:0 0 0 2px #2563eb55}
.pv2 .pvstep .tt{font-weight:700;color:#fff;overflow-wrap:anywhere}.pv2 .pvstep .ln{color:#94a3b8;font-size:13px;overflow-wrap:anywhere}
.pv2 .pvstep .go{justify-self:end}
.pv2 button.pbtn,.pv2 summary.pbtn{min-height:44px;padding:0 16px;border-radius:10px;border:0;font-weight:700;font-size:14px;cursor:pointer;background:#2563eb;color:#fff}.pv2 button.pbtn.ghost,.pv2 summary.pbtn.ghost{background:#1e293b;color:#e2e8f0}.pv2 button.pbtn:disabled{opacity:.45;cursor:not-allowed}
.pv2 .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.pv2 .kpi{border:1px solid #1e293b;border-radius:12px;padding:12px;background:#0b1220}.pv2 .kpi .k{color:#94a3b8;font-size:12px}.pv2 .kpi .v{font-size:20px;font-weight:800;color:#fff;overflow-wrap:anywhere}.pv2 .kpi .s{color:#94a3b8;font-size:12px;margin-top:2px}
.pv2 .ops{display:flex;flex-direction:column;gap:10px}
.pv2 .opcard{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:6px 12px;align-items:center;border:1px solid #1e293b;border-radius:12px;background:#0b1220;padding:12px}
.pv2 .opcard.drag{opacity:.5}.pv2 .opcard.over{border-color:#2563eb}.pv2 .opcard .grip{cursor:grab;color:#64748b;font-size:20px;text-align:center;user-select:none}
.pv2 .opcard .nm{font-weight:700;color:#fff;overflow-wrap:anywhere}.pv2 .opcard .meta{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:6px;font-size:12px;color:#94a3b8}
.pv2 .opcard .mv{display:flex;gap:6px}.pv2 .opcard .mv button{min-width:44px}
.pv2 .pv2-editor{grid-column:1/-1;margin-top:10px;border-top:1px dashed #334155;padding-top:10px;display:flex;flex-direction:column;gap:12px;min-width:0;overflow-wrap:anywhere}.pv2 .pv2-editor .edbar{display:flex;justify-content:space-between;gap:8px;align-items:center}.pv2 .opmenu{position:relative}.pv2 .opmenu summary{list-style:none;display:flex;align-items:center;justify-content:center;min-width:44px}.pv2 .opmenu summary::-webkit-details-marker{display:none}.pv2 .opmenu .menu{position:absolute;right:0;top:48px;z-index:5;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:6px;min-width:150px}.pv2 .opcard .newno{font-weight:800;color:#93c5fd}
.pv2 .wo{display:flex;flex-direction:column;gap:10px}.pv2 .wo .why{display:flex;flex-direction:column;gap:4px;color:#fca5a5;font-size:13px}
.pv2 select,.pv2 input{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;max-width:100%}
.pv2 details.tech{margin-top:10px}.pv2 details.tech summary{cursor:pointer;color:#93c5fd}.pv2 .tech .kv{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 12px;margin-top:8px;font-size:13px}
@media (max-width:900px){.pv2 .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.pv2 .kpi .v{font-size:14px;overflow-wrap:anywhere}.pv2 .sec{padding:12px}.pv2 .pvstep{grid-template-columns:30px minmax(0,1fr)}.pv2 .pvstep .go{grid-column:1/-1;justify-self:stretch}.pv2 .pvstep .go button{width:100%}.pv2 .opcard{grid-template-columns:24px minmax(0,1fr)}.pv2 .opcard .mv{grid-column:1/-1}.pv2 .kpi .v{font-size:18px}.pv2 .tech .kv{grid-template-columns:1fr}}
`;
const TONE = { DONE: 'ok', TODO: 'warn', WAIT: 'info', LOCKED: '' };
const trH = (v) => (v == null ? 'VERİ YOK' : `${fmt(v, 1)} saat`);
/** Loads the real records once, then draws A–E into `host`. Order selection / quantity changes redraw only what depends on them. */
export async function drawPrepFlow(host, c) {
    const { api, ws } = c;
    const rev = ws.revision;
    host.replaceChildren(E('div', { class: 'mut', 'data-testid': 'pv2-loading' }, 'Hazırlık durumu okunuyor…'));
    const safe = async (f) => { try {
        return await f();
    }
    catch {
        return null;
    } };
    const [chain, orders] = await Promise.all([rev ? safe(() => api.techChain(rev.id)) : Promise.resolve(null), api.orderLines ? safe(() => api.orderLines(ws.product.id)) : Promise.resolve(null)]);
    // CAM record older than the NC in force (same read-only comparison as the chain panel; unknown = no claim)
    const staleOps = [];
    for (const op of chain?.operations ?? []) {
        if (op.nc.status !== 'YÜRÜRLÜKTE' || op.cam.status !== 'YÜRÜRLÜKTE' || !op.nc.documentId || !op.cam.ncSha256)
            continue;
        const f = await safe(() => api.documentFile(op.nc.documentId));
        if (f && f.effective && f.content.sha256 && f.content.sha256 !== op.cam.ncSha256)
            staleOps.push(op.routingOperationId);
    }
    let toolCount = null;
    const ov = rev ? await safe(() => api.toolistOverview(rev.id)) : null;
    const tv = ov?.documents[0]?.versions[0];
    if (tv && api.toolistWorkGet) {
        const w = await safe(() => api.toolistWorkGet(tv.versionId));
        const rows = (w?.draft ?? w?.published)?.rows;
        if (rows)
            toolCount = Object.keys(rows).length;
    }
    let plan = null;
    const cp = rev && api.controlPlanList ? await safe(() => api.controlPlanList(rev.id)) : null;
    if (cp) {
        const latest = [...cp.plans].sort((a, b) => b.version - a.version)[0];
        const rel = cp.plans.find((p) => p.status === 'RELEASED');
        const p0 = rel ?? latest;
        plan = p0 ? { released: !!rel, characteristics: p0.rows.length, openItems: p0.openItems.length } : null;
    }
    const lines = orders ?? [];
    let itemId = lines.find((l) => ['CONFIRMED', 'IN_PRODUCTION'].includes(l.status))?.itemId ?? lines[0]?.itemId ?? null;
    let manualQty = c.initialQty && c.initialQty > 0 ? c.initialQty : 1;
    let pendingOrder = null;
    let dragIdx = -1;
    let bar = null;
    let est = null;
    let seq = 0;
    // Adım / operasyon editörü: aynı anda yalnız biri, ilgili satırın hemen altında. Düğümler bir kez üretilir ve yeniden çizimde yalnız taşınır (yazılanlar kaybolmaz).
    const EDK = `kmi.pw.editor.${ws.product.id}`;
    let ed = null;
    let edNodes = [];
    let dirty = false;
    let confirmDeact = null;
    c.bindOpenOp((code) => openEd({ slot: `op:${code}`, target: 'routing', op: code }));
    const saveEd = () => { try {
        if (ed)
            sessionStorage.setItem(EDK, JSON.stringify(ed));
        else
            sessionStorage.removeItem(EDK);
    }
    catch { /* private mode */ } };
    const openEd = (n) => {
        if (ed && ed.slot === n.slot) {
            closeEd();
            return;
        }
        if (ed && dirty && !window.confirm('Açık editörde kaydedilmemiş değişiklik var. Kapatılsın mı?'))
            return;
        ed = n;
        edNodes = c.editors(n.target, n.op);
        dirty = false;
        saveEd();
        draw();
        setTimeout(() => host.querySelector(`[data-testid="pv2-editor-${n.slot}"]`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 30);
    };
    const closeEd = () => { if (ed && dirty && !window.confirm('Açık editörde kaydedilmemiş değişiklik var. Kapatılsın mı?'))
        return; ed = null; edNodes = []; dirty = false; saveEd(); draw(); };
    const edBox = (slot) => {
        const box = E('div', { class: 'pv2-editor', 'data-testid': `pv2-editor-${slot}` }, E('div', { class: 'edbar' }, E('span', { class: 'mut' }, 'Düzenleme aynı sayfada açık'), E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': 'pv2-editor-close', onClick: closeEd }, 'Kapat')), ...edNodes);
        box.addEventListener('input', () => { dirty = true; });
        return box;
    };
    const cur = () => lines.find((l) => l.itemId === itemId) ?? null;
    const qtyNow = () => cur()?.qty ?? manualQty;
    const input = () => ({ ws, chain, order: cur(), toolCount, plan, staleOps });
    const loadCalc = async () => {
        if (!rev)
            return;
        const my = ++seq;
        const q = qtyNow();
        if (!(q > 0))
            return;
        const [b, e] = await Promise.all([ws.bom.length ? safe(() => api.barNeed(rev.id, q)) : Promise.resolve(null), ws.routing.length ? safe(() => api.estimate(rev.id, q)) : Promise.resolve(null)]);
        if (my !== seq)
            return;
        bar = b;
        est = e;
        draw();
    };
    function draw() {
        const steps = buildSteps(input());
        const st = overallStatus(steps);
        const o = cur();
        const gate = workOrderGate(input(), steps[5]);
        const next = steps.find((s) => s.status !== 'DONE' && s.key !== 'wo');
        const tone = st.kind === 'READY' ? 'ok' : st.kind === 'CHECK' ? 'bad' : 'warn';
        const sel = lines.length ? E('select', { 'data-testid': 'pv2-order-select', 'aria-label': 'Sipariş kalemi' }, ...lines.map((l) => E('option', { value: l.itemId, ...(l.itemId === itemId ? { selected: 'selected' } : {}) }, `${l.orderNo} · ${fmt(l.qty)} adet · ${l.customer}`)), E('option', { value: '', ...(itemId === null ? { selected: 'selected' } : {}) }, 'Siparişsiz çalış')) : null;
        sel?.addEventListener('change', () => { itemId = sel.value || null; void loadCalc(); draw(); });
        // A ---------------------------------------------------------------------------------------------
        const A = E('section', { class: 'sec', 'data-testid': 'pv2-a' }, E('div', { class: 'a-top' }, E('div', { style: 'flex:1 1 320px' }, c.backBtn, E('div', { class: 'a-title', 'data-testid': 'pv2-title' }, `${ws.product.code} · ${ws.product.name}`), E('div', { class: 'a-sub', 'data-testid': 'pv2-sub' }, [ws.product.customerName ?? o?.customer, o?.orderNo, o ? `${fmt(o.qty)} adet` : null, o ? `Termin ${o.dueDate.split('-').reverse().join('.')}` : null, rev ? `Rev ${rev.revision}` : 'Revizyon yok'].filter(Boolean).join(' · '))), E('div', { style: 'display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:0' }, chip(st.text, tone, { class: `chip ${tone} big-chip`, 'data-testid': 'pv2-status', 'data-kind': st.kind }), c.revSelect, sel)), rev ? E('div', { class: 'mut', style: 'margin-top:6px' }, `Ürün durumu: ${ws.product.status === 'ACTIVE' ? 'Aktif' : ws.product.status} · Rev ${rev.revision}: ${rev.status === 'DRAFT' ? 'Taslak' : rev.status === 'RELEASED' ? 'Yürürlükte' : 'Eski'} · ${ws.can.editRouting ? 'Düzenleme yetkiniz var' : 'Yalnız görüntüleme'}`) : null, !lines.length ? E('div', { class: 'mut', style: 'margin-top:6px' }, 'Bu ürün için sipariş kalemi yok: siparişsiz hazırlık yapabilirsiniz.') : null);
        // B ---------------------------------------------------------------------------------------------
        const stepEl = (s) => E('div', { class: `pvstep${next === s ? ' next' : ''}`, 'data-testid': `pv2-step-${s.key}`, 'data-status': s.status }, E('div', { class: 'no' }, s.status === 'DONE' ? '✓' : String(s.no)), E('div', {}, E('div', { class: 'tt' }, s.title, ' ', chip(s.label, TONE[s.status] ?? '', { 'data-testid': `pv2-label-${s.key}` })), E('div', { class: 'ln', 'data-testid': `pv2-line-${s.key}` }, s.line)), s.action && s.key !== 'wo' ? E('div', { class: 'go' }, E('button', { class: s.secondary ? 'pbtn ghost' : 'pbtn', type: 'button', 'data-testid': `pv2-act-${s.key}`, onClick: () => void stepAct(s) }, s.action)) : null, ed?.slot === s.key ? edBox(s.key) : null);
        const B = E('section', { class: 'sec', 'data-testid': 'pv2-b' }, E('h2', {}, 'Hazırlık adımları'), E('div', { class: 'pvsteps' }, ...steps.map(stepEl)));
        // C ---------------------------------------------------------------------------------------------
        const line = bar?.lines[0] ?? null;
        const ms = materialSummary(qtyNow(), line);
        const ct = est ? cncTime(qtyNow(), est.operations) : null;
        const qtyBox = !o ? E('input', { 'data-testid': 'pv2-qty', type: 'number', min: '1', inputmode: 'numeric', value: String(manualQty), 'aria-label': 'Adet', style: 'width:140px' }) : null;
        qtyBox?.addEventListener('change', () => { manualQty = Math.max(1, Math.floor(Number(qtyBox.value) || 1)); void loadCalc(); draw(); });
        const kpi = (tid, k, v, s) => E('div', { class: 'kpi', 'data-testid': tid }, E('div', { class: 'k' }, k), E('div', { class: 'v' }, v), E('div', { class: 's' }, s));
        const tech = ms && line ? E('details', { class: 'tech', 'data-testid': 'pv2-tech' }, E('summary', {}, 'Teknik ayrıntılar'), E('div', { class: 'kv' }, E('div', {}, `Malzeme: ${line.materialCode} · Ø${fmt(line.diaMm)} × ${fmt(line.barLengthMm)} mm çubuk`), E('div', {}, `Kesim ${fmt(line.cutLengthMm)} mm · testere payı ${fmt(line.kerfMm)} mm${line.kerfSource === 'EXCEPTION' ? ' (istisna kaydı)' : ' (varsayılan)'}`), E('div', {}, `Çubuktan çıkan: ⌊${fmt(line.barLengthMm)} ÷ (${fmt(line.cutLengthMm)} + ${fmt(line.kerfMm)})⌋ = ${ms.perBar} parça`), E('div', {}, `Gerekli çubuk: ⌈${fmt(ms.qty)} ÷ ${ms.perBar}⌉ = ${ms.bars}`), E('div', {}, `Kesilebilir kapasite: ${fmt(ms.capacity)} parça; sipariş üstü ${fmt(ms.extra)} parça`), E('div', {}, 'Bu fark üretilmiş stok veya fiilen kesilmiş parça değildir.'), E('div', {}, `Çubuk başına kalan ${fmt(line.plan.remainderMmPerBar)} mm · ham parça ${fmt(line.plan.pieceMassG, 1)} g · çubuk ${fmt(line.plan.barMassKg, 2)} kg · toplam ham ${fmt(line.plan.blankTotalKg, 1)} kg`), E('div', {}, `Yoğunluk ${fmt(line.densityGCm3)} g/cm³ (${line.densitySource === 'SPEC' ? 'kayıtlı' : 'varsayılan'})`), ct?.cycleSecPerPiece != null ? E('div', {}, `CNC: ${fmt(ms.qty)} × ${fmt(ct.cycleSecPerPiece)} sn = ${trH(ct.cncHours)} · hazırlık ${ct.setupMin != null ? `${fmt(ct.setupMin)} dk / parti` : 'VERİ YOK'} · kalite muayenesi CNC ile paralel, süreye eklenmez`) : E('div', {}, 'CNC süresi: çevrim standardı eksik.'))) : null;
        const C = E('section', { class: 'sec', 'data-testid': 'pv2-c' }, E('h2', {}, 'Malzeme ve süre'), qtyBox ? E('div', { class: 'row', style: 'margin-bottom:10px' }, E('span', { class: 'mut' }, 'Siparişsiz çalışma — adet:'), qtyBox) : null, E('div', { class: 'kpis' }, kpi('pv2-k-qty', 'Sipariş miktarı', `${fmt(qtyNow())} adet`, o ? `${o.orderNo}` : 'siparişsiz'), kpi('pv2-k-bars', 'Gerekli çubuk', ms ? `${ms.bars} çubuk` : ws.bom.length ? 'Hesaplanıyor / VERİ YOK' : 'BOM yok', ms ? `${fmt(ms.qty)} adet → ${ms.bars} çubuk (${ms.perBar} parça/çubuk)` : 'Hammadde tanımı gerekli'), kpi('pv2-k-stock', 'Stok durumu', 'Stok doğrulanamadı', 'Depo kaydı okunmadı'), kpi('pv2-k-cnc', 'Tahmini CNC süresi', ct?.cncHours != null ? trH(ct.cncHours) : 'VERİ YOK', ct?.cycleSecPerPiece != null ? `${fmt(qtyNow())} × ${fmt(ct.cycleSecPerPiece)} sn · ${ws.routing.filter((x) => x.active).length} operasyon toplamı` : 'çevrim standardı tamamlanacak')), tech);
        // D ---------------------------------------------------------------------------------------------
        const act = ws.routing.filter((x) => x.active).sort((a, b) => a.opNo - b.opNo);
        const baseIds = act.map((x) => x.id);
        const ids = pendingOrder ?? baseIds;
        const nn = renumber(ids);
        const canSort = ws.can.editStructure && rev?.status === 'DRAFT' && act.length > 1;
        const byId = new Map(act.map((x) => [x.id, x]));
        const chainOf = (id) => chain?.operations.find((x) => x.routingOperationId === id);
        const wc = (lbl, w) => chip(`${lbl}: ${w ?? 'VERİ YOK'}`, w === 'YÜRÜRLÜKTE' ? 'ok' : w ? 'warn' : '');
        const mvBtn = (i, d, lbl) => E('button', { class: 'pbtn ghost', type: 'button', 'aria-label': lbl, 'data-testid': `pv2-${d < 0 ? 'up' : 'down'}-${byId.get(ids[i]).opCode}`, ...(i + d < 0 || i + d >= ids.length ? { disabled: 'disabled' } : {}), onClick: () => { pendingOrder = moveId(ids, i, i + d); if (sameOrder(pendingOrder, baseIds))
                pendingOrder = null; draw(); } }, d < 0 ? '↑' : '↓');
        const opEl = (id, i) => {
            const x = byId.get(id);
            const ch = chainOf(id);
            const changed = !!pendingOrder && nn.get(id) !== x.opNo;
            const el = E('div', { class: 'opcard', 'data-testid': 'pv2-op', 'data-op': x.opCode, 'data-op-id': id, ...(canSort ? { draggable: 'true' } : {}) }, E('div', { class: 'grip', title: canSort ? 'Sürükleyerek sırala' : '' }, canSort ? '⠿' : ''), E('div', {}, E('div', { class: 'nm' }, changed ? E('span', { class: 'newno', 'data-testid': 'pv2-newno' }, `OP${nn.get(id)} `) : `OP${x.opNo} `, changed ? E('span', { class: 'mut' }, `(şimdi ${x.opCode}) `) : null, x.name), E('div', { class: 'meta' }, E('span', {}, x.machines.length ? `Makine: ${x.machines.map((m) => (m.primary ? `★${m.code}` : m.code)).join(', ')}` : 'Makine: VERİ YOK'), E('span', {}, `Hazırlık ${x.setupMinutes != null ? `${fmt(x.setupMinutes)} dk` : 'VERİ YOK'}`), E('span', {}, `Çevrim ${x.cycleSeconds != null ? `${fmt(x.cycleSeconds)} sn` : 'VERİ YOK'}`)), E('div', { class: 'meta' }, wc('NC', ch?.nc.status), wc('CAM', ch?.cam.status), wc('Takım listesi', ch?.toolList.status), chip(`Kalite: ${x.qcPoints.some((p) => !!p.controlPlanId) ? 'plana bağlı' : 'bağlı değil'}`, x.qcPoints.some((p) => !!p.controlPlanId) ? 'ok' : 'warn'))), E('div', { class: 'mv' }, canSort ? mvBtn(i, -1, `${x.opCode} yukarı`) : null, canSort ? mvBtn(i, 1, `${x.opCode} aşağı`) : null, E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': `pv2-edit-${x.opCode}`, onClick: () => openEd({ slot: `op:${x.opCode}`, target: 'routing', op: x.opCode }) }, ed?.slot === `op:${x.opCode}` ? 'Kapat' : 'Düzenle'), ws.can.editStructure && x.active ? E('details', { class: 'opmenu', 'data-testid': `pv2-menu-${x.opCode}` }, E('summary', { class: 'pbtn ghost', 'aria-label': `${x.opCode} işlem menüsü`, role: 'button' }, '···'), E('div', { class: 'menu' }, E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': `pv2-deact-${x.opCode}`, onClick: () => { confirmDeact = id; draw(); } }, 'Pasife al'))) : null), confirmDeact === id ? E('div', { class: 'banner', style: 'grid-column:1/-1', 'data-testid': 'pv2-deact-ask' }, E('b', {}, `${x.opCode} pasife alınacak. `), 'Silinmez, geçmişi korunur; rotadan çıkar.', E('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap' }, E('button', { class: 'pbtn', type: 'button', 'data-testid': 'pv2-deact-go', onClick: () => { confirmDeact = null; void c.setActive(x, false); } }, 'Evet, pasife al'), E('button', { class: 'pbtn ghost', type: 'button', onClick: () => { confirmDeact = null; draw(); } }, 'Vazgeç'))) : null, ed?.slot === `op:${x.opCode}` ? edBox(`op:${x.opCode}`) : null);
            if (canSort) {
                el.addEventListener('dragstart', (ev) => { dragIdx = i; el.classList.add('drag'); try {
                    ev.dataTransfer?.setData('text/plain', id);
                    ev.dataTransfer.effectAllowed = 'move';
                }
                catch { /* synthetic */ } });
                el.addEventListener('dragend', () => { el.classList.remove('drag'); host.querySelectorAll('.opcard.over').forEach((n) => n.classList.remove('over')); });
                el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.classList.add('over'); });
                el.addEventListener('dragleave', () => el.classList.remove('over'));
                el.addEventListener('drop', (ev) => { ev.preventDefault(); if (dragIdx < 0)
                    return; pendingOrder = moveId(ids, dragIdx, i); dragIdx = -1; if (sameOrder(pendingOrder, baseIds))
                    pendingOrder = null; draw(); });
            }
            return el;
        };
        const D = E('section', { class: 'sec', 'data-testid': 'pv2-d' }, E('h2', {}, 'Operasyon rotası', ws.can.editStructure && rev?.status === 'DRAFT' ? E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': 'pv2-add-op', onClick: () => openEd({ slot: 'new', target: 'routing', op: 'NEW' }) }, '+ Operasyon') : null), act.length ? E('div', { class: 'ops' }, ...ids.map(opEl)) : E('div', { class: 'mut' }, 'Rota yok: ilk operasyonu ekleyin.'), ed?.slot === 'new' ? edBox('new') : null, ws.routing.some((x) => !x.active) ? E('details', { class: 'inactive', 'data-testid': 'pv2-inactive' }, E('summary', { class: 'mut' }, `Pasif operasyonlar (${ws.routing.filter((x) => !x.active).length})`), ...ws.routing.filter((x) => !x.active).map((x) => E('div', { class: 'meta', 'data-testid': 'pv2-inactive-op', 'data-op': x.opCode, style: 'display:flex;gap:8px;align-items:center;margin-top:6px' }, E('span', { class: 'nm' }, `${x.opCode} ${x.name}`), chip('Pasif', 'bad'), ws.can.editStructure && rev?.status === 'DRAFT' ? E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': `pv2-activate-${x.opCode}`, onClick: () => void c.setActive(x, true) }, 'Etkinleştir') : null))) : null, pendingOrder ? E('div', { class: 'banner', 'data-testid': 'pv2-route-preview', style: 'margin-top:10px' }, E('b', {}, 'Yeni sıra: '), pendingOrder.map((id) => `OP${nn.get(id)} ${byId.get(id).name}`).join(' → '), E('div', { class: 'mut', style: 'margin-top:4px' }, 'OP numaraları sıradan yeniden verilir. Operasyonun kimliği değişmez; NC, CAM, takım listesi ve kalite planı aynı operasyona bağlı kalır.'), E('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap' }, E('button', { class: 'pbtn', type: 'button', 'data-testid': 'pv2-route-save', onClick: () => void saveOrder() }, 'Sırayı kaydet'), E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': 'pv2-route-cancel', onClick: () => { pendingOrder = null; draw(); } }, 'Vazgeç'))) : null, act.length > 1 && !canSort ? E('div', { class: 'mut', style: 'margin-top:8px', 'data-testid': 'pv2-route-locked' }, rev?.status === 'DRAFT' ? 'Sıralama yetkiniz yok.' : 'Yürürlükteki veya iş emrinde kullanılmış rotanın geçmişi değişmez: sıralamak için yeni rota revizyonu açılmalı.') : null);
        // E ---------------------------------------------------------------------------------------------
        const prim = act.flatMap((x) => x.machines.filter((m) => m.primary).map((m) => m.code))[0];
        const E_ = E('section', { class: 'sec wo', 'data-testid': 'pv2-e' }, E('button', { class: 'pbtn', type: 'button', style: 'min-height:56px;font-size:16px', 'data-testid': 'pv2-wo-btn', ...(gate.open ? {} : { disabled: 'disabled' }), onClick: () => { if (o)
                c.navigate(`#/siparis-komuta?siparis=${o.orderId}`); } }, o ? `${o.orderNo} için İş Emri Oluştur` : 'İş Emri Oluştur'), gate.open ? E('div', { class: 'mut', 'data-testid': 'pv2-wo-info' }, `İş emri ekranı açılır; sipariş kalemi, Rev ${rev?.revision}, ${fmt(qtyNow())} adet ve rota taşınır. ${prim ? `Önerilen makine: ${prim} (rotadaki öncelikli makine).` : ''} Operatör ve makine ataması yetki ve uygunluk kontrolünden geçmeden kesinleşmez. İş emri kendiliğinden oluşturulmaz.`)
            : E('div', { class: 'why', 'data-testid': 'pv2-wo-why' }, ...gate.reasons.map((r) => E('div', {}, `• ${r}`)), next?.target ? E('div', { style: 'margin-top:6px' }, E('button', { class: 'pbtn ghost', type: 'button', 'data-testid': 'pv2-wo-goto', onClick: () => void stepAct(next) }, `İlgili adıma git: ${next.title}`)) : null));
        host.replaceChildren(A, B, C, D, E_);
    }
    async function stepAct(s) {
        if (s.target === 'release') {
            await doRelease();
            return;
        }
        if (s.target)
            openEd({ slot: s.key, target: s.target });
    }
    async function doRelease() {
        if (!api.releaseRevision || !rev) {
            c.fail(new Error('Revizyon yayını bu oturumda kullanılamıyor.'));
            return;
        }
        try {
            await api.releaseRevision(rev.id);
            await c.reload(`Rev ${rev.revision} yürürlüğe alındı.`);
        }
        catch (e) {
            c.fail(e);
        }
    }
    async function saveOrder() {
        if (!pendingOrder || !rev)
            return;
        const act = ws.routing.filter((x) => x.active).sort((a, b) => a.opNo - b.opNo);
        if (sameOrder(pendingOrder, act.map((x) => x.id))) {
            pendingOrder = null;
            draw();
            return;
        }
        const nn = renumber(pendingOrder);
        const why = `Rota sırası değişti: ${pendingOrder.map((id) => { const x = act.find((y) => y.id === id); return `${x.opCode}→OP${nn.get(id)}`; }).join(', ')}`.slice(0, 400);
        try {
            await api.reorder(rev.id, pendingOrder, why);
            pendingOrder = null;
            await c.reload('Operasyon sırası kaydedildi; OP numaraları yeniden verildi.');
        }
        catch (e) {
            c.fail(new Error(reorderErrorText(errorText(e))));
        }
    }
    // Yeniden yüklemeden sonra (kayıt işlemleri sayfayı tazeler) açık editör geri gelir; yeni operasyon kaydı sonrası o operasyon açılır.
    try {
        const io = c.initialOp && c.initialOp !== 'NEW' ? ws.routing.find((x) => x.id === c.initialOp) : null;
        if (io)
            ed = { slot: `op:${io.opCode}`, target: 'routing', op: io.opCode };
        else {
            const raw = sessionStorage.getItem(EDK);
            const r = raw ? JSON.parse(raw) : null;
            if (r && r.slot !== 'new' && (!r.op || ws.routing.some((x) => x.opCode === r.op)))
                ed = r;
        }
        if (ed)
            edNodes = c.editors(ed.target, ed.op);
    }
    catch {
        ed = null;
    }
    draw();
    void loadCalc();
}
