// KMI NEXT — Purchasing/Warehouse screen (owner talimatı 2026-10-10, Öncelik 2). Same h()/JSX/
// full-re-render pattern as every other screen. Shows PO lines with a goods-receipt input, and
// submit/approve controls — the goods receipt call is the real RPC that also creates the
// warehouse stock lot server-side (see maintenanceApi-style thin adapter, purchasingApi.ts).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderPurchasingScreen(container, deps, banner) {
    let orders = [];
    let lines = [];
    let loadError = null;
    try {
        [orders, lines] = await Promise.all([deps.api.listPurchaseOrders(), deps.api.listLines()]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const receiveInputs = new Map();
    function receiveInputFor(lineId) {
        let input = receiveInputs.get(lineId);
        if (!input) {
            input = h('input', { type: 'number', 'data-testid': 'receive-qty-input', 'data-line-id': lineId });
            receiveInputs.set(lineId, input);
        }
        return input;
    }
    async function handleSubmit(poId) {
        try {
            await deps.api.transition(poId, 'SUBMITTED');
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Sipariş onaya gönderildi.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleApprove(poId) {
        try {
            await deps.api.approve(poId);
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Satınalma siparişi onaylandı.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleSend(poId) {
        try {
            await deps.api.transition(poId, 'SENT');
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Sipariş tedarikçiye gönderildi.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleReceive(lineId) {
        const qty = Number(receiveInputFor(lineId).value);
        try {
            await deps.api.recordGoodsReceipt(lineId, qty);
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Mal kabul kaydedildi, depo lotu HOLD olarak açıldı.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = (h("div", { class: "purchasing-screen" },
        h("h1", { "data-testid": "purchasing-heading" }, "Sat\u0131nalma / Depo"),
        banner ? (h("div", { "data-testid": "purchasing-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { "data-testid": "purchasing-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("table", { "data-testid": "purchase-orders-table" },
                h("tbody", { "data-testid": "purchase-orders-tbody" }, orders.map((po) => (h("tr", { "data-testid": "po-row", "data-po-id": po.id },
                    h("td", { "data-testid": "po-status" }, po.status),
                    h("td", null,
                        po.status === 'DRAFT'
                            ? h('button', { type: 'button', 'data-testid': 'submit-po-btn', 'data-po-id': po.id, onClick: () => handleSubmit(po.id) }, 'Onaya Gönder')
                            : null,
                        po.status === 'SUBMITTED'
                            ? h('button', { type: 'button', 'data-testid': 'approve-po-btn', 'data-po-id': po.id, onClick: () => handleApprove(po.id) }, 'Onayla')
                            : null,
                        po.status === 'APPROVED'
                            ? h('button', { type: 'button', 'data-testid': 'send-po-btn', 'data-po-id': po.id, onClick: () => handleSend(po.id) }, 'Tedarikçiye Gönder')
                            : null)))))),
            h("table", { "data-testid": "po-lines-table" },
                h("tbody", { "data-testid": "po-lines-tbody" }, lines.map((line) => (h("tr", { "data-testid": "po-line-row", "data-line-id": line.id },
                    h("td", { "data-testid": "line-material" }, line.materialCode),
                    h("td", { "data-testid": "line-qty-ordered" }, String(line.qtyOrdered)),
                    h("td", { "data-testid": "line-qty-received" }, String(line.qtyReceived)),
                    h("td", null, receiveInputFor(line.id)),
                    h("td", null, h('button', { type: 'button', 'data-testid': 'receive-btn', 'data-line-id': line.id, onClick: () => handleReceive(line.id) }, 'Mal Kabul Et')))))))))));
    mount(container, screen);
}
