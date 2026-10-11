// KMI NEXT — Golden Thread step 5 screen: Stock lots for a single work order. Same
// h()/JSX/full-re-render pattern as Orders/WorkOrders/Production screens.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canCreateStockLot, canTransitionStockState } from '../../../../packages/domain/src/stock.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
const NEXT_STATES = ['WIP', 'FG', 'AVAILABLE', 'RESERVED', 'STAGED', 'SHIPPED', 'HOLD', 'SCRAP'];
export async function renderStockScreen(container, workOrderId, deps, banner) {
    let wo = null;
    let lots = [];
    let loadError = null;
    try {
        wo = await deps.getWorkOrder();
        lots = await deps.api.listForWorkOrder(workOrderId);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const alreadyLotted = lots.reduce((sum, lot) => sum + lot.qty, 0);
    const available = wo ? wo.qtyProduced - alreadyLotted : 0;
    const qtyInput = h('input', { type: 'number', min: '0', 'data-testid': 'lot-qty-input' });
    async function handleCreateLot(e) {
        e.preventDefault();
        const qty = Number(qtyInput.value) || 0;
        try {
            await deps.api.createLot(workOrderId, qty);
            await renderStockScreen(container, workOrderId, deps, { kind: 'info', text: 'Stok lotu oluşturuldu.' });
        }
        catch (err) {
            await renderStockScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleTransition(lotId, toState) {
        try {
            await deps.api.transition(lotId, toState, 'KMI NEXT UI: state change');
            await renderStockScreen(container, workOrderId, deps, { kind: 'info', text: `Lot durumu güncellendi: ${toState}` });
        }
        catch (err) {
            await renderStockScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = (h("div", { class: "stock-screen" },
        h("h1", { "data-testid": "stock-heading" },
            "Stok (\u0130\u015F Emri: ",
            workOrderId,
            ")"),
        banner ? (h("div", { "data-testid": "stock-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError || !wo ? (h("div", { "data-testid": "stock-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { "data-testid": "wo-produced-summary" },
                h("span", { "data-testid": "wo-status" }, wo.status),
                h("span", { "data-testid": "wo-qty-produced" }, String(wo.qtyProduced)),
                h("span", { "data-testid": "wo-qty-available" }, String(available))),
            wo && canCreateStockLot(wo.status, 1, Math.max(available, 0.000001)).ok ? (h("form", { "data-testid": "create-lot-form", onSubmit: handleCreateLot },
                qtyInput,
                h("button", { type: "submit", "data-testid": "create-lot-btn" }, "Stok Lotu Olu\u015Ftur"))) : (h("div", { "data-testid": "create-lot-disabled" },
                "Bu durumda stok lotu olu\u015Fturulamaz: ",
                wo?.status)),
            h("table", { "data-testid": "lots-table" },
                h("tbody", { "data-testid": "lots-tbody" }, lots.map((lot) => (h("tr", { "data-testid": "lot-row", "data-lot-id": lot.id },
                    h("td", { "data-testid": "lot-qty" }, String(lot.qty)),
                    h("td", { "data-testid": "lot-state" }, lot.state),
                    h("td", { "data-testid": "lot-actions" }, NEXT_STATES.filter((to) => canTransitionStockState(lot.state, to).ok).map((to) => h('button', {
                        type: 'button',
                        'data-testid': `lot-transition-${to}`,
                        'data-lot-id': lot.id,
                        onClick: () => handleTransition(lot.id, to),
                    }, to))))))))))));
    mount(container, screen);
}
