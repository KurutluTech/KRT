// KMI NEXT — İş emri merkezi: Altın Hat'ın kayıt-merkezli girişi (CONTINUATION-003 §6/§9). Liste → iş emri → (atama,
// üretim/kalite, stok) → stok lotu → (sevkiyat, ticari onay). Adım ekranları yeniden yazılmadı; burada yalnız kimlik
// yazdırmadan (seçim listeleriyle) birbirine bağlanır. Sunucu yetkisi her adımda ayrıca denetler.
import { passportHref } from '../passport/registry.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionWorkOrderStatus } from '../../../../packages/domain/src/workOrder.js';
import { renderProductionScreen } from './ProductionScreen.js';
import { renderStockScreen } from './StockScreen.js';
import { renderShipmentScreen } from './ShipmentScreen.js';
import { renderCommercialApprovalScreen } from './CommercialApprovalScreen.js';
import { errorText } from '../errorText.js';
import { collectBlockers, readinessHeadline } from '../woReadiness.js';
export const WO_STATUS_TR = { PLANNED: 'Plana alındı', MACHINE_ASSIGNED: 'Makine atandı', PRODUCTION_DONE: 'Üretim bitti · onay bekliyor', IN_PROGRESS: 'Üretimde', FIRST_PIECE_PENDING: 'İlk parça bekliyor',
    FIRST_PIECE_APPROVED: 'İlk parça onaylı', COMPLETED: 'Tamamlandı', ON_HOLD: 'Bekletmede (HOLD)', CANCELLED: 'İptal' };
const TARGETS = ['MACHINE_ASSIGNED', 'IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const OPEN_ST = ['PLANNED', 'MACHINE_ASSIGNED', 'IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED', 'ON_HOLD'];
const link = (q, text, testid) => h('a', { href: `#/is-emirleri${q}`, ...(testid ? { 'data-testid': testid } : {}), class: 'woc-link' }, text);
const STATUS_TONE = { PRODUCTION_DONE: 'warn', PLANNED: 'mut', MACHINE_ASSIGNED: 'info', IN_PROGRESS: 'info', FIRST_PIECE_PENDING: 'warn', FIRST_PIECE_APPROVED: 'ok', COMPLETED: 'ok', ON_HOLD: 'bad', CANCELLED: 'mut' };
const istanbulToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
const isLate = (w) => !!w.dueDate && OPEN_ST.includes(w.status) && w.dueDate < istanbulToday();
const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
const WOC_CSS = `
.woc{max-width:1080px;margin:0 auto;padding:0 16px 40px;box-sizing:border-box;color:var(--kmi-text,#e2e8f0)}
.woc h1{font-size:24px;margin:8px 0 4px;color:var(--kmi-text,#fff)}.woc h2{font-size:12px;letter-spacing:.14em;font-weight:800;color:var(--kmi-mut,#94a3b8);margin:22px 0 8px;text-transform:uppercase}
.woc-link{color:var(--kmi-info,#38bdf8);font-weight:700;text-decoration:none}.woc-link:hover{text-decoration:underline}
.woc-sub{color:var(--kmi-text2,#cbd5e1);font-size:14px;margin:0 0 10px}
.woc-msg{padding:10px 14px;border-radius:12px;margin:8px 0;font-weight:700;border:1px solid}.woc-msg.ok{color:var(--kmi-ok,#4ade80);background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.4)}.woc-msg.error{color:var(--kmi-bad,#f87171);background:rgba(248,113,113,.12);border-color:rgba(248,113,113,.45)}
.woc-card{display:block;border:1px solid var(--kmi-line,#1e2d4a);border-top:3px solid var(--wc,#64748b);border-radius:16px;padding:14px;background:linear-gradient(180deg,rgba(15,23,42,.9),rgba(10,16,32,.9));color:inherit;text-decoration:none;margin:0;min-width:0}
a.woc-card:hover{border-color:var(--wc,#38bdf8)}a.woc-card:focus-visible,.woc button:focus-visible,.woc select:focus-visible,.woc a:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.woc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}@media (max-width:520px){.woc-grid{grid-template-columns:1fr}}
.woc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}.woc-title{font-size:17px;font-weight:800;color:#fff;overflow-wrap:anywhere}
.woc-pill{font-size:12px;font-weight:800;letter-spacing:.05em;padding:3px 10px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.woc-pill.ok,.woc-tone-ok{color:var(--kmi-ok,#4ade80)}.woc-pill.warn,.woc-tone-warn{color:var(--kmi-warn,#fbbf24)}.woc-pill.bad,.woc-tone-bad{color:var(--kmi-bad,#f87171)}.woc-pill.info,.woc-tone-info{color:var(--kmi-info,#38bdf8)}.woc-pill.mut,.woc-tone-mut{color:var(--kmi-mut,#94a3b8)}
.woc-meta{font-size:13px;color:var(--kmi-text2,#cbd5e1);margin:6px 0;overflow-wrap:anywhere}
.woc-bar{height:8px;border-radius:99px;background:rgba(148,163,184,.2);overflow:hidden;margin:8px 0 2px}.woc-bar i{display:block;height:100%;background:var(--kmi-info,#38bdf8)}.woc-bar.ok i{background:var(--kmi-ok,#4ade80)}
.woc-head{border:1px solid var(--kmi-line,#1e2d4a);border-top:4px solid var(--wc,#64748b);border-radius:18px;padding:16px;background:linear-gradient(180deg,rgba(15,23,42,.95),rgba(10,16,32,.95))}
.woc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 16px;margin-top:12px}.woc-kpi{min-width:0}.woc-l{font-size:11px;letter-spacing:.1em;font-weight:800;color:var(--kmi-mut,#94a3b8)}.woc-v{font-size:17px;font-weight:800;overflow-wrap:break-word;hyphens:auto}.woc-v.unk{color:var(--kmi-mut,#64748b);font-weight:500;font-size:13px}
.woc-ready{border-radius:16px;padding:14px;border:1px solid;margin:14px 0}.woc-ready.ok{color:var(--kmi-ok,#4ade80);background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.4)}.woc-ready.bad{color:var(--kmi-bad,#f87171);background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.45)}.woc-ready.mut{color:var(--kmi-mut,#94a3b8);border-color:var(--kmi-line,#1e2d4a)}
.woc-ready h3{margin:0 0 8px;font-size:17px;letter-spacing:.02em}.woc-block{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid rgba(148,163,184,.18);color:var(--kmi-text,#e2e8f0)}.woc-block b{display:block}.woc-block span{font-size:13px;color:var(--kmi-text2,#cbd5e1)}
.woc details{margin-top:8px;font-size:12px;color:var(--kmi-mut,#94a3b8)}
.woc-panel{border:1px solid var(--kmi-line,#1e2d4a);border-radius:16px;padding:14px;background:rgba(15,23,42,.6);margin:10px 0}
.woc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.woc select,.woc input[type=text]{min-height:40px;padding:6px 10px;border-radius:10px;border:1px solid var(--kmi-line,#334155);background:#0b1220;color:var(--kmi-text,#e2e8f0);font-size:14px;max-width:100%}
.woc button{min-height:40px;padding:6px 14px;border-radius:10px;border:1px solid var(--kmi-info,#38bdf8);background:rgba(56,189,248,.12);color:var(--kmi-info,#38bdf8);font-weight:800;cursor:pointer}.woc button:hover{background:rgba(56,189,248,.22)}
.woc button:disabled{opacity:.45;cursor:not-allowed;border-color:var(--kmi-line,#334155);color:var(--kmi-mut,#94a3b8);background:transparent}
.woc-acts{display:flex;gap:8px;flex-wrap:wrap}.woc-nav{display:flex;gap:6px 16px;flex-wrap:wrap;margin:12px 0}
.woc-sec{margin-top:6px}
@media (max-width:520px){.woc h1{font-size:20px}.woc-kpis{grid-template-columns:repeat(2,1fr)}.woc select{width:100%}.woc button{flex:1 1 auto}}
`;
export async function renderWorkOrderHubScreen(container, deps, view = {}) {
    const redo = (v) => void renderWorkOrderHubScreen(container, deps, v);
    const msg = view.message ? h('div', { 'data-testid': 'hub-message', 'data-kind': view.message.kind, class: `woc-msg ${view.message.kind}`, role: view.message.kind === 'error' ? 'alert' : 'status' }, view.message.text) : null;
    const shell = (...kids) => mount(container, h('div', { class: 'hub-screen woc' }, h('style', {}, WOC_CSS), h('h1', { 'data-testid': 'hub-heading' }, 'İş emri merkezi'), msg, ...kids));
    let list = [];
    try {
        list = await deps.hub.list();
    }
    catch (e) {
        shell(h('div', { 'data-testid': 'hub-load-error', class: 'woc-msg error' }, errorText(e)));
        return;
    }
    // ---- stock lot view: shipment + commercial approval
    if (view.lot) {
        const lotId = view.lot;
        let woId = '';
        try {
            woId = await deps.hub.lotWorkOrder(lotId);
        }
        catch (e) {
            shell(h('div', { 'data-testid': 'hub-load-error', class: 'woc-msg error' }, errorText(e)));
            return;
        }
        const a = h('div', { 'data-testid': 'hub-commercial' });
        const b = h('div', { 'data-testid': 'hub-shipment' });
        shell(link(`?wo=${woId}`, '← İş emrine dön', 'hub-back'), h('h2', {}, 'Stok lotu: ticari onay ve sevkiyat'), a, b);
        await renderCommercialApprovalScreen(a, lotId, { api: deps.commercial, getStockLotState: () => deps.hub.lotState(lotId) });
        await renderShipmentScreen(b, lotId, { api: deps.shipment, getStockLotState: () => deps.hub.lotState(lotId) });
        return;
    }
    // ---- work order view (digital-passport standard: identity header, "can it start?" with one-click fixes, grouped actions)
    if (view.wo) {
        const w = list.find((x) => x.id === view.wo);
        if (!w) {
            shell(link('', '← Liste'), h('div', { 'data-testid': 'hub-load-error', class: 'woc-msg error' }, 'İş emri bulunamadı.'));
            return;
        }
        let machines = [];
        let people = [];
        try {
            [machines, people] = await Promise.all([deps.hub.machines(), deps.hub.operators()]);
        }
        catch { /* pick-lists optional */ }
        const act = async (fn, ok) => { try {
            await fn();
            redo({ wo: w.id, message: { kind: 'ok', text: ok } });
        }
        catch (e) {
            redo({ wo: w.id, message: { kind: 'error', text: errorText(e) } });
        } };
        const mSel = h('select', { 'data-testid': 'hub-machine', 'aria-label': 'Makine' }, h('option', { value: '' }, 'Makine seçin'), ...machines.map((m) => h('option', { value: m.id, ...(m.id === w.machineId ? { selected: true } : {}) }, `${m.code} · ${m.name}`)));
        const oSel = h('select', { 'data-testid': 'hub-operator', 'aria-label': 'Operatör' }, h('option', { value: '' }, 'Operatör seçin'), ...people.map((p) => h('option', { value: p.id, ...(p.id === w.operatorId ? { selected: true } : {}) }, p.name)));
        const next = TARGETS.filter((t) => canTransitionWorkOrderStatus(w.status, t).ok);
        let ready = null;
        try {
            ready = await deps.hub.readiness(w.id);
        }
        catch { /* panel optional */ }
        let rows = null;
        try {
            rows = deps.hub.readinessRows ? await deps.hub.readinessRows(w.id) : null;
        }
        catch {
            rows = null;
        }
        const blockers = ready ? collectBlockers(w.id, rows, ready.startRefusal) : null;
        const editable = w.status === 'PLANNED' || w.status === 'MACHINE_ASSIGNED';
        const rSel = h('select', { 'data-testid': 'hub-revision', 'aria-label': 'Ürün revizyonu' }, h('option', { value: '' }, 'Yayınlı revizyon seçin'), ...(ready?.revisions ?? []).map((r) => h('option', { value: r.id, ...(r.id === ready?.revisionId ? { selected: true } : {}) }, `Rev ${r.revision}`)));
        const cSel = h('select', { 'data-testid': 'hub-cam', 'aria-label': 'CAM programı' }, h('option', { value: '' }, 'Yayınlı CAM programı seçin'), ...(ready?.programs ?? []).map((r) => h('option', { value: r.id, ...(r.id === ready?.camProgramId ? { selected: true } : {}) }, `${r.programNo} · ${r.revision}`)));
        const focusMap = { machine: mSel, operator: oSel, revision: rSel, cam: cSel };
        const fixBtn = (b) => !b.fix ? null : b.fix.type === 'link'
            ? h('a', { href: b.fix.href, class: 'woc-link', 'data-testid': 'hub-fix' }, `${b.fixLabel} →`)
            : h('button', { type: 'button', 'data-testid': 'hub-fix', 'data-focus': b.fix.id, onClick: () => { const el = focusMap[b.fix.id]; el?.scrollIntoView({ block: 'center' }); el?.focus(); } }, `${b.fixLabel}`);
        const head = blockers ? readinessHeadline(blockers.length) : readinessHeadline(null);
        const readyCard = h('section', { 'data-testid': 'hub-readiness', class: `woc-ready ${head.tone}` }, h('h3', { 'data-testid': 'hub-ready-headline' }, head.text), h('div', { 'data-testid': 'hub-ready-state', 'data-ready': ready ? (ready.startRefusal ? 'no' : 'yes') : 'unknown' }, ...(blockers ?? []).map((b) => h('div', { class: 'woc-block', 'data-testid': 'hub-blocker', 'data-code': b.code }, h('div', {}, h('b', {}, b.title), b.detail ? h('span', {}, b.detail) : null), fixBtn(b))), ready && !blockers?.length ? h('div', { class: 'woc-meta' }, 'Makine, operatör, revizyon, CAM, malzeme ve takım kontrolleri sunucuda geçti.') : null, !ready ? h('div', { class: 'woc-meta' }, 'Hazırlık sunucudan okunamadı; durum bilinmiyor.') : null, blockers?.length ? h('details', {}, h('summary', {}, 'Teknik ayrıntı (destek için)'), h('div', {}, blockers.map((b) => b.code).join(' · '))) : null));
        const startBlocked = !!blockers && blockers.length > 0;
        const exemptions = (ready?.exemptions ?? []).map((x) => {
            const why = h('input', { type: 'text', placeholder: 'İptal gerekçesi (en az 10 karakter)', 'data-testid': 'hub-exempt-reason', 'aria-label': 'Muafiyet iptal gerekçesi' });
            return h('div', { 'data-testid': 'hub-exemption', class: 'woc-row' }, `Muafiyet ${x.kind === 'MATERIAL' ? '(malzeme)' : '(takım)'}: ${x.reason}`, why, h('button', { type: 'button', 'data-testid': 'hub-exempt-revoke', onClick: () => void act(() => deps.hub.revokeExemption(x.id, why.value), 'Muafiyet kaldırıldı.') }, 'Muafiyeti kaldır'));
        });
        const prod = h('div', { 'data-testid': 'hub-production' });
        const stock = h('div', { 'data-testid': 'hub-stock' });
        const lots = h('div', { 'data-testid': 'hub-lots' });
        const mName = machines.find((m) => m.id === w.machineId);
        const oName = people.find((p) => p.id === w.operatorId);
        const late = isLate(w);
        const remaining = Math.max(0, w.qtyPlanned - w.qtyProduced);
        const kpi = (l, v, tone) => h('div', { class: 'woc-kpi' }, h('div', { class: 'woc-l' }, l), h('div', { class: `woc-v${v === null ? ' unk' : ''}${tone ? ` woc-tone-${tone}` : ''}` }, v ?? 'BİLİNMİYOR'));
        const revNow = ready ? (ready.revisions.find((r) => r.id === ready.revisionId)?.revision ?? null) : null;
        const camNow = ready ? (ready.programs.find((r) => r.id === ready.camProgramId)) : null;
        shell(link('', '← İş emirleri', 'hub-back'), h('section', { 'data-testid': 'hub-summary', class: 'woc-head', style: `--wc:var(--kmi-${STATUS_TONE[w.status] === 'mut' ? 'mut' : STATUS_TONE[w.status]},#64748b)` }, h('div', { class: 'woc-top' }, h('div', { class: 'woc-title' }, `${w.productCode} · ${w.productName}`), h('span', { 'data-testid': 'hub-status', 'data-status': w.status, class: `woc-pill ${STATUS_TONE[w.status]}` }, `Durum: ${WO_STATUS_TR[w.status]}`)), h('div', { class: 'woc-meta' }, `Sipariş ${w.customerPo}${w.dueDate ? ` · termin ${w.dueDate}` : ''}`, late ? h('b', { class: 'woc-tone-bad', 'data-testid': 'hub-late' }, '  · TERMİN GEÇTİ') : null), h('div', { class: 'woc-bar' + (w.qtyProduced >= w.qtyPlanned && w.qtyPlanned > 0 ? ' ok' : '') }, h('i', { style: `width:${pct(w.qtyProduced, w.qtyPlanned)}%` })), h('div', { class: 'woc-kpis' }, kpi('PLANLANAN', String(w.qtyPlanned)), kpi('SAĞLAM', String(w.qtyProduced), w.qtyProduced > 0 ? 'ok' : undefined), kpi('HURDA', String(w.qtyScrap), w.qtyScrap > 0 ? 'warn' : undefined), kpi('KALAN', String(remaining), remaining > 0 && late ? 'bad' : undefined), kpi('MAKİNE', mName ? `${mName.code} · ${mName.name}` : (w.machineId ? null : 'Atanmadı'), mName ? undefined : (w.machineId ? undefined : 'warn')), kpi('OPERATÖR', oName ? oName.name : (w.operatorId ? null : 'Atanmadı'), oName || w.operatorId ? undefined : 'warn'), kpi('REVİZYON', ready ? (revNow ? `Rev ${revNow}` : 'Bağlı değil') : null, ready && !revNow ? 'warn' : undefined), kpi('CAM PROGRAMI', ready ? (camNow ? `${camNow.programNo} · ${camNow.revision}` : 'Bağlı değil') : null, ready && !camNow ? 'warn' : undefined), kpi('PLAN TARİHİ', w.plannedDate ?? 'Planlanmamış')), h('div', { class: 'woc-nav' }, h('a', { href: passportHref('WORK_ORDER', w.id), 'data-testid': 'hub-passport', class: 'woc-link' }, 'İş emri pasaportu →'), h('a', { href: `#/gorevler?kaynak=WORK_ORDER&id=${w.id}`, 'data-testid': 'hub-task', class: 'woc-link' }, 'Bu iş emri için görev ata →'), h('a', { href: `#/muhasebe?kalem=${w.orderItemId}`, 'data-testid': 'hub-accounting', class: 'woc-link' }, 'Muhasebe / fatura (yetkililer) →'))), readyCard, h('h2', {}, 'Hazırlık ve atama'), h('section', { class: 'woc-panel', 'data-testid': 'hub-assign' }, h('div', { class: 'woc-row' }, mSel, h('button', { type: 'button', 'data-testid': 'hub-assign-machine', onClick: () => { if (!mSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce makine seçin.' } }); void act(() => deps.workOrders.assignMachine(w.id, mSel.value), 'Makine atandı.'); } }, 'Makine ata')), h('div', { class: 'woc-row' }, oSel, h('button', { type: 'button', 'data-testid': 'hub-assign-operator', onClick: () => { if (!oSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce operatör seçin.' } }); void act(() => deps.workOrders.assignOperator(w.id, oSel.value), 'Operatör atandı.'); } }, 'Operatör ata')), ready ? (editable ? h('div', { class: 'woc-row' }, rSel, h('button', { type: 'button', 'data-testid': 'hub-set-revision', onClick: () => { if (!rSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce revizyon seçin.' } }); void act(() => deps.hub.setRevision(w.id, rSel.value), 'Revizyon bağlandı.'); } }, 'Revizyonu bağla')) : h('div', { class: 'woc-meta' }, `Revizyon: ${revNow ?? (ready.revisionId ? 'bağlı' : 'yok')} (bu durumda değiştirilemez)`)) : null, ready && editable ? h('div', { class: 'woc-row' }, cSel, h('button', { type: 'button', 'data-testid': 'hub-set-cam', onClick: () => { if (!cSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce CAM programı seçin.' } }); void act(() => deps.hub.setCamProgram(w.id, cSel.value), 'CAM programı bağlandı.'); } }, 'Programı bağla')) : null, ...exemptions, h('div', { class: 'woc-nav' }, h('a', { href: `#/malzeme?is=${w.id}`, 'data-testid': 'hub-material', class: 'woc-link' }, 'Malzeme durumu →'), h('a', { href: `#/takim-hazirlik?is=${w.id}`, 'data-testid': 'hub-tools', class: 'woc-link' }, 'Takım hazırlığı →'), h('a', { href: '#/muhendislik', 'data-testid': 'hub-eng', class: 'woc-link' }, 'Mühendislik →'))), h('h2', {}, 'Durum geçişi'), h('section', { class: 'woc-panel' }, h('div', { class: 'woc-acts' }, next.length ? next.map((t) => {
            const blocked = t === 'IN_PROGRESS' && startBlocked;
            return h('button', { type: 'button', 'data-testid': `hub-to-${t}`, ...(blocked ? { disabled: true, title: 'Önce yukarıdaki eksikler giderilmeli (sunucu da doğrular)' } : {}), onClick: () => void act(() => deps.workOrders.transition(w.id, t, `İş emri merkezi: ${t}`), `Durum: ${WO_STATUS_TR[t]}`) }, `→ ${WO_STATUS_TR[t]}`);
        }) : [h('span', { class: 'woc-meta' }, 'Bu durumdan geçiş yok.')]), startBlocked && next.includes('IN_PROGRESS') ? h('div', { class: 'woc-meta', 'data-testid': 'hub-start-blocked' }, '“Üretimde” geçişi, hazırlık eksikleri bitene kadar kapalıdır.') : null), h('h2', {}, 'Üretim ve kalite kaydı'), prod, h('h2', {}, 'Stok lotları'), lots, stock);
        try {
            const ls = await deps.stock.listForWorkOrder(w.id);
            lots.append(...(ls.length ? ls.map((l) => h('div', { 'data-testid': 'hub-lot', class: 'woc-meta' }, `${l.qty} adet · ${l.state} · `, link(`?lot=${l.id}`, 'Ticari onay ve sevkiyat →', 'hub-lot-link'))) : [h('div', { class: 'woc-meta' }, 'Henüz stok lotu yok.')]));
        }
        catch { /* shown by stock screen */ }
        await renderProductionScreen(prod, w.id, { api: deps.production, getWorkOrder: () => deps.hub.snapshot(w.id) });
        await renderStockScreen(stock, w.id, { api: deps.stock, getWorkOrder: () => deps.hub.snapshot(w.id) });
        // embedded screens print the raw work-order id in their headings: inside the hub the header card already names the order
        const rename = (root, sel, text) => { const el = root.querySelector(sel); if (el)
            el.textContent = text; };
        rename(prod, '[data-testid="prod-heading"]', 'Üretim bildirimi');
        rename(stock, '[data-testid="stock-heading"]', 'Stok ve sevkiyat işlemleri');
        prod.querySelectorAll('[data-testid="wo-snapshot"]').forEach((e) => e.setAttribute('hidden', ''));
        return;
    }
    // ---- list view
    const open = list.filter((w) => OPEN_ST.includes(w.status));
    const done = list.filter((w) => !OPEN_ST.includes(w.status));
    let mNames = new Map();
    try {
        mNames = new Map((await deps.hub.machines()).map((m) => [m.id, m.code]));
    }
    catch { /* optional */ }
    const card = (w) => h('a', { href: `#/is-emirleri?wo=${w.id}`, 'data-testid': 'hub-card', 'data-status': w.status, class: 'woc-card', style: `--wc:var(--kmi-${STATUS_TONE[w.status]},#64748b)` }, h('div', { class: 'woc-top' }, h('div', { class: 'woc-title' }, `${w.productCode} · ${w.productName}`), h('span', { class: `woc-pill ${STATUS_TONE[w.status]}` }, WO_STATUS_TR[w.status])), h('div', { class: 'woc-meta' }, `Sipariş ${w.customerPo}`), h('div', { class: 'woc-bar' }, h('i', { style: `width:${pct(w.qtyProduced, w.qtyPlanned)}%` })), h('div', { class: 'woc-meta' }, `${w.qtyProduced}/${w.qtyPlanned} adet`, w.dueDate ? ` · termin ${w.dueDate}` : '', isLate(w) ? h('b', { class: 'woc-tone-bad' }, ' · TERMİN GEÇTİ') : null, OPEN_ST.includes(w.status) ? (w.machineId ? ` · makine ${mNames.get(w.machineId) ?? ''}`.trimEnd() : h('b', { class: 'woc-tone-warn' }, ' · makine yok')) : null));
    shell(h('p', { class: 'woc-sub' }, 'Sipariş kaleminden açılan iş emirleri. Bir iş emrini açarak “üretime hazır mı?” durumunu görün, makine/operatör atayın, üretim ve kalite kaydını girin, stok lotuna ve sevkiyata ilerleyin.'), h('a', { href: '#/siparisler', 'data-testid': 'hub-create-link', class: 'woc-link', style: 'display:inline-block;margin:4px 0 12px;font-size:15px' }, '＋ İŞ EMRİ AÇ — Siparişler’e git'), open.length ? null : h('div', { 'data-testid': 'hub-empty', class: 'woc-meta' }, 'Açık iş emri yok. Siparişler ekranında sipariş kaleminin yanındaki “İŞ EMRİ AÇ” ile başlatın.'), h('div', { class: 'woc-grid' }, ...open.map(card)), done.length ? h('h2', {}, `Tamamlanan / iptal (${done.length})`) : null, h('div', { class: 'woc-grid' }, ...done.slice(0, 30).map(card)));
}
