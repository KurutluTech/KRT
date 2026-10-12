// KMI NEXT — Purchasing/Warehouse screen (owner talimatı 2026-10-10, Öncelik 2). Same h()/JSX/
// full-re-render pattern as every other screen. Shows PO lines with a goods-receipt input, and
// submit/approve controls — the goods receipt call is the real RPC that also creates the
// warehouse stock lot server-side (see maintenanceApi-style thin adapter, purchasingApi.ts).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
const PO_TR = { DRAFT: ['Taslak', ''], SUBMITTED: ['Onay bekliyor', 'warn'], APPROVED: ['Onaylandı', 'info'], SENT: ['Tedarikçiye gönderildi', 'info'], PARTIALLY_RECEIVED: ['Kısmen teslim alındı', 'warn'], RECEIVED: ['Teslim alındı', 'ok'], CLOSED: ['Kapandı', 'ok'], CANCELLED: ['İptal', 'bad'] };
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
    const screen = (h("div", { class: "purchasing-screen kd" },
        h("style", null, DS_CSS + '.kd table{border-collapse:collapse;width:100%;font-size:14px}.kd td{padding:8px;border-top:1px solid #1e293b;vertical-align:middle}.kd td:last-child{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'),
        h("h1", { "data-testid": "purchasing-heading" }, "Sat\u0131nalma / Depo"),
        banner ? (h("div", { class: `banner ${banner.kind}`, "data-testid": "purchasing-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { class: "banner error", "data-testid": "purchasing-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "panel" },
                h("h2", null, "Sat\u0131nalma sipari\u015Fleri"),
                h("table", { "data-testid": "purchase-orders-table" },
                    h("tbody", { "data-testid": "purchase-orders-tbody" }, orders.map((po) => (h("tr", { "data-testid": "po-row", "data-po-id": po.id },
                        h("td", null,
                            h("span", { class: `pill ${(PO_TR[po.status] ?? ['', ''])[1]}`, "data-testid": "po-status", "data-code": po.status }, (PO_TR[po.status] ?? [po.status])[0])),
                        h("td", null,
                            po.status === 'DRAFT'
                                ? h('button', { type: 'button', class: 'primary', 'data-testid': 'submit-po-btn', 'data-po-id': po.id, onClick: () => handleSubmit(po.id) }, 'Onaya Gönder')
                                : null,
                            po.status === 'SUBMITTED'
                                ? h('button', { type: 'button', class: 'okb', 'data-testid': 'approve-po-btn', 'data-po-id': po.id, onClick: () => handleApprove(po.id) }, 'Onayla')
                                : null,
                            po.status === 'APPROVED'
                                ? h('button', { type: 'button', class: 'primary', 'data-testid': 'send-po-btn', 'data-po-id': po.id, onClick: () => handleSend(po.id) }, 'Tedarikçiye Gönder')
                                : null)))))),
                orders.length === 0 ? h("div", { class: "empty", "data-testid": "po-empty" }, "Hen\u00FCz sat\u0131nalma sipari\u015Fi yok.") : null),
            h("div", { class: "panel" },
                h("h2", null, "Sipari\u015F kalemleri / mal kabul"),
                h("table", { "data-testid": "po-lines-table" },
                    h("tbody", { "data-testid": "po-lines-tbody" }, lines.map((line) => (h("tr", { "data-testid": "po-line-row", "data-line-id": line.id },
                        h("td", { "data-testid": "line-material" }, line.materialCode),
                        h("td", { "data-testid": "line-qty-ordered" }, String(line.qtyOrdered)),
                        h("td", { "data-testid": "line-qty-received" }, String(line.qtyReceived)),
                        h("td", null, receiveInputFor(line.id)),
                        h("td", null, h('button', { type: 'button', class: 'okb', 'data-testid': 'receive-btn', 'data-line-id': line.id, onClick: () => handleReceive(line.id) }, 'Mal Kabul Et'))))))),
                lines.length === 0 ? h("div", { class: "empty", "data-testid": "po-lines-empty" }, "Mal kabul edilecek kalem yok.") : null)))));
    mount(container, screen);
}
