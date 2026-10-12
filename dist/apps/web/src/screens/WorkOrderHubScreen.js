// KMI NEXT — İş emri merkezi: Altın Hat'ın kayıt-merkezli girişi (CONTINUATION-003 §6/§9). Liste → iş emri → (atama,
// üretim/kalite, stok) → stok lotu → (sevkiyat, ticari onay). Adım ekranları yeniden yazılmadı; burada yalnız kimlik
// yazdırmadan (seçim listeleriyle) birbirine bağlanır. Sunucu yetkisi her adımda ayrıca denetler.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionWorkOrderStatus } from '../../../../packages/domain/src/workOrder.js';
import { renderProductionScreen } from './ProductionScreen.js';
import { renderStockScreen } from './StockScreen.js';
import { renderShipmentScreen } from './ShipmentScreen.js';
import { renderCommercialApprovalScreen } from './CommercialApprovalScreen.js';
import { errorText } from '../errorText.js';
export const WO_STATUS_TR = { PLANNED: 'Planlandı', MACHINE_ASSIGNED: 'Makine atandı', IN_PROGRESS: 'Üretimde', FIRST_PIECE_PENDING: 'İlk parça bekliyor',
    FIRST_PIECE_APPROVED: 'İlk parça onaylı', COMPLETED: 'Tamamlandı', ON_HOLD: 'Bekletmede (HOLD)', CANCELLED: 'İptal' };
const TARGETS = ['MACHINE_ASSIGNED', 'IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const OPEN_ST = ['PLANNED', 'MACHINE_ASSIGNED', 'IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED', 'ON_HOLD'];
const link = (q, text, testid) => h('a', { href: `#/is-emirleri${q}`, ...(testid ? { 'data-testid': testid } : {}), style: 'color:#1d4ed8' }, text);
export async function renderWorkOrderHubScreen(container, deps, view = {}) {
    const redo = (v) => void renderWorkOrderHubScreen(container, deps, v);
    const msg = view.message ? h('div', { 'data-testid': 'hub-message', 'data-kind': view.message.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${view.message.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, view.message.text) : null;
    const shell = (...kids) => mount(container, h('div', { class: 'hub-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'hub-heading' }, 'İş emri merkezi'), msg, ...kids));
    let list = [];
    try {
        list = await deps.hub.list();
    }
    catch (e) {
        shell(h('div', { 'data-testid': 'hub-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, errorText(e)));
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
            shell(h('div', { 'data-testid': 'hub-load-error' }, errorText(e)));
            return;
        }
        const a = h('div', { 'data-testid': 'hub-commercial' });
        const b = h('div', { 'data-testid': 'hub-shipment' });
        shell(link(`?wo=${woId}`, '← İş emrine dön', 'hub-back'), h('h2', { style: 'font-size:16px' }, 'Stok lotu: ticari onay ve sevkiyat'), a, b);
        await renderCommercialApprovalScreen(a, lotId, { api: deps.commercial, getStockLotState: () => deps.hub.lotState(lotId) });
        await renderShipmentScreen(b, lotId, { api: deps.shipment, getStockLotState: () => deps.hub.lotState(lotId) });
        return;
    }
    // ---- work order view
    if (view.wo) {
        const w = list.find((x) => x.id === view.wo);
        if (!w) {
            shell(link('', '← Liste'), h('div', { 'data-testid': 'hub-load-error' }, 'İş emri bulunamadı.'));
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
        const mSel = h('select', { 'data-testid': 'hub-machine' }, h('option', { value: '' }, 'Makine seçin'), ...machines.map((m) => h('option', { value: m.id, ...(m.id === w.machineId ? { selected: true } : {}) }, `${m.code} · ${m.name}`)));
        const oSel = h('select', { 'data-testid': 'hub-operator' }, h('option', { value: '' }, 'Operatör seçin'), ...people.map((p) => h('option', { value: p.id, ...(p.id === w.operatorId ? { selected: true } : {}) }, p.name)));
        const next = TARGETS.filter((t) => canTransitionWorkOrderStatus(w.status, t).ok);
        let ready = null;
        try {
            ready = await deps.hub.readiness(w.id);
        }
        catch { /* panel optional */ }
        const editable = w.status === 'PLANNED' || w.status === 'MACHINE_ASSIGNED';
        const rSel = h('select', { 'data-testid': 'hub-revision' }, h('option', { value: '' }, 'Yayınlı revizyon seçin'), ...(ready?.revisions ?? []).map((r) => h('option', { value: r.id, ...(r.id === ready?.revisionId ? { selected: true } : {}) }, `Rev ${r.revision}`)));
        const cSel = h('select', { 'data-testid': 'hub-cam' }, h('option', { value: '' }, 'Yayınlı CAM programı seçin'), ...(ready?.programs ?? []).map((r) => h('option', { value: r.id, ...(r.id === ready?.camProgramId ? { selected: true } : {}) }, `${r.programNo} · ${r.revision}`)));
        const readyPanel = ready ? h('section', { 'data-testid': 'hub-readiness', style: 'border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin:8px 0' }, h('h2', { style: 'font-size:16px;margin:0 0 6px' }, 'Üretim hazırlığı'), h('div', { 'data-testid': 'hub-ready-state', 'data-ready': ready.startRefusal ? 'no' : 'yes', style: 'font-size:13px;margin-bottom:6px' }, ready.startRefusal ? `Başlatılamaz: ${ready.startRefusal}` : 'Başlatmaya hazır.'), editable ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0' }, rSel, h('button', { type: 'button', 'data-testid': 'hub-set-revision', onClick: () => { if (!rSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce revizyon seçin.' } }); void act(() => deps.hub.setRevision(w.id, rSel.value), 'Revizyon bağlandı.'); } }, 'Revizyonu bağla')) : h('div', { style: 'font-size:13px' }, `Revizyon: ${ready.revisions.find((r) => r.id === ready.revisionId)?.revision ?? (ready.revisionId ? 'bağlı' : 'yok')}`), editable ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0' }, cSel, h('button', { type: 'button', 'data-testid': 'hub-set-cam', onClick: () => { if (!cSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce CAM programı seçin.' } }); void act(() => deps.hub.setCamProgram(w.id, cSel.value), 'CAM programı bağlandı.'); } }, 'Programı bağla')) : null, ...ready.exemptions.map((x) => {
            const why = h('input', { type: 'text', placeholder: 'İptal gerekçesi (en az 10 karakter)', 'data-testid': 'hub-exempt-reason' });
            return h('div', { 'data-testid': 'hub-exemption', style: 'font-size:13px;margin:4px 0' }, `Muafiyet ${x.kind}: ${x.reason} `, why, h('button', { type: 'button', 'data-testid': 'hub-exempt-revoke', onClick: () => void act(() => deps.hub.revokeExemption(x.id, why.value), 'Muafiyet kaldırıldı.') }, 'Muafiyeti kaldır'));
        }), h('div', { style: 'font-size:13px;margin-top:6px' }, h('a', { href: `#/malzeme?is=${w.id}`, 'data-testid': 'hub-material', style: 'color:#1d4ed8' }, 'Malzeme durumu →'), h('a', { href: `#/takim-hazirlik?is=${w.id}`, 'data-testid': 'hub-tools', style: 'color:#1d4ed8;margin-left:12px' }, 'Takım hazırlığı →'), h('a', { href: '#/muhendislik', 'data-testid': 'hub-eng', style: 'color:#1d4ed8;margin-left:12px' }, 'Mühendislik →'))) : null;
        const prod = h('div', { 'data-testid': 'hub-production' });
        const stock = h('div', { 'data-testid': 'hub-stock' });
        const lots = h('div', { 'data-testid': 'hub-lots', style: 'margin:6px 0' });
        shell(link('', '← İş emirleri', 'hub-back'), h('section', { 'data-testid': 'hub-summary', style: 'border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin:8px 0' }, h('div', { style: 'font-weight:600' }, `${w.productCode} · ${w.productName}`), h('div', { style: 'font-size:13px;color:#475569' }, `Sipariş ${w.customerPo}${w.dueDate ? ` · termin ${w.dueDate}` : ''} · plan ${w.qtyPlanned} · üretilen ${w.qtyProduced} · fire ${w.qtyScrap}`), h('div', { 'data-testid': 'hub-status', 'data-status': w.status, style: 'margin-top:4px' }, `Durum: ${WO_STATUS_TR[w.status]}`), h('a', { href: `#/muhasebe?kalem=${w.orderItemId}`, 'data-testid': 'hub-accounting', style: 'color:#1d4ed8;font-size:13px' }, 'Muhasebe / fatura (yetkililer) →'), h('a', { href: `#/gorevler?kaynak=WORK_ORDER&id=${w.id}`, 'data-testid': 'hub-task', style: 'color:#1d4ed8;font-size:13px;margin-left:12px' }, 'Bu iş emri için görev ata →')), h('section', { style: 'margin:8px 0' }, h('h2', { style: 'font-size:16px' }, 'Atama ve durum'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0' }, mSel, h('button', { type: 'button', 'data-testid': 'hub-assign-machine', onClick: () => { if (!mSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce makine seçin.' } }); void act(() => deps.workOrders.assignMachine(w.id, mSel.value), 'Makine atandı.'); } }, 'Makine ata')), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0' }, oSel, h('button', { type: 'button', 'data-testid': 'hub-assign-operator', onClick: () => { if (!oSel.value)
                return redo({ wo: w.id, message: { kind: 'error', text: 'Önce operatör seçin.' } }); void act(() => deps.workOrders.assignOperator(w.id, oSel.value), 'Operatör atandı.'); } }, 'Operatör ata')), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, next.length ? next.map((t) => h('button', { type: 'button', 'data-testid': `hub-to-${t}`, onClick: () => void act(() => deps.workOrders.transition(w.id, t, `İş emri merkezi: ${t}`), `Durum: ${WO_STATUS_TR[t]}`) }, `→ ${WO_STATUS_TR[t]}`)) : [h('span', { style: 'color:#64748b' }, 'Bu durumdan geçiş yok.')])), readyPanel, prod, h('h2', { style: 'font-size:16px;margin-top:14px' }, 'Stok lotları'), lots, stock);
        try {
            const ls = await deps.stock.listForWorkOrder(w.id);
            lots.append(...(ls.length ? ls.map((l) => h('div', { 'data-testid': 'hub-lot', style: 'font-size:13px;padding:4px 0' }, `${l.qty} adet · ${l.state} · `, link(`?lot=${l.id}`, 'Ticari onay ve sevkiyat →', 'hub-lot-link'))) : [h('div', { style: 'color:#64748b' }, 'Henüz stok lotu yok.')]));
        }
        catch { /* shown by stock screen */ }
        await renderProductionScreen(prod, w.id, { api: deps.production, getWorkOrder: () => deps.hub.snapshot(w.id) });
        await renderStockScreen(stock, w.id, { api: deps.stock, getWorkOrder: () => deps.hub.snapshot(w.id) });
        return;
    }
    // ---- list view
    const open = list.filter((w) => OPEN_ST.includes(w.status));
    const done = list.filter((w) => !OPEN_ST.includes(w.status));
    const card = (w) => h('a', { href: `#/is-emirleri?wo=${w.id}`, 'data-testid': 'hub-card', 'data-status': w.status, style: 'display:block;border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin:6px 0;text-decoration:none;color:inherit' }, h('div', { style: 'display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap' }, h('b', {}, `${w.productCode} · ${w.productName}`), h('span', {}, WO_STATUS_TR[w.status])), h('div', { style: 'font-size:13px;color:#475569' }, `Sipariş ${w.customerPo} · ${w.qtyProduced}/${w.qtyPlanned}${w.dueDate ? ` · termin ${w.dueDate}` : ''}${w.machineId ? '' : ' · makine yok'}`));
    shell(h('p', { style: 'font-size:13px;color:#475569' }, 'Sipariş kaleminden açılan iş emirleri. Bir iş emrini açarak makine/operatör atayın, üretim ve kalite kaydını girin, stok lotuna ve sevkiyata ilerleyin.'), h('a', { href: '#/siparisler', 'data-testid': 'hub-create-link', style: 'display:inline-block;background:#1d4ed8;color:#fff;border-radius:8px;padding:10px 16px;font-weight:700;text-decoration:none;margin:6px 0' }, '＋ İŞ EMRİ AÇ — Siparişler’e git'), open.length ? null : h('div', { 'data-testid': 'hub-empty', style: 'color:#64748b' }, 'Açık iş emri yok. Siparişler ekranında sipariş kaleminin yanındaki “İŞ EMRİ AÇ” ile başlatın.'), ...open.map(card), done.length ? h('h2', { style: 'font-size:15px;margin-top:14px' }, `Tamamlanan / iptal (${done.length})`) : null, ...done.slice(0, 30).map(card));
}
