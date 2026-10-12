// KMI NEXT — Accounting screen (Item 9, ACCOUNTING_MUTATION): per-shipment invoices, payments
// (tahsilat) and the order item's remaining delivery obligation. Same h()/full-re-render pattern
// as the other screens; every rule is re-enforced server-side (migration 0014).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canCreateInvoiceForShipment, INVOICE_CURRENCIES } from '../../../../packages/domain/src/accounting.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
const SHIP_TR = { DRAFT: ['Taslak', ''], DISPATCHED: ['Yolda / sevk edildi', 'info'], DELIVERED: ['Teslim edildi', 'ok'], CANCELLED: ['İptal', 'bad'] };
const INV_TR = { OPEN: ['Açık', 'warn'], PARTIAL: ['Kısmi ödendi', 'info'], PAID: ['Ödendi', 'ok'] };
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderAccountingScreen(container, orderItemId, api, banner) {
    let obligation = null;
    let shipments = [];
    let invoices = [];
    const paid = {};
    let loadError = null;
    try {
        obligation = await api.getObligation(orderItemId);
        shipments = await api.listShipments(orderItemId);
        invoices = await api.listInvoices(orderItemId);
        for (const inv of invoices)
            paid[inv.id] = await api.paidAmount(inv.id);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const currencySelect = h('select', { 'data-testid': 'currency-select' }, ...INVOICE_CURRENCIES.map((c) => h('option', { value: c }, c)));
    const rerender = (b) => renderAccountingScreen(container, orderItemId, api, b);
    async function handleInvoice(shipmentId) {
        try {
            await api.createInvoice(shipmentId, currencySelect.value);
            await rerender({ kind: 'info', text: 'Fatura oluşturuldu.' });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    async function handlePayment(invoiceId, input) {
        const amount = Number(input.value);
        try {
            // One request id per click: a network retry of the same click is deduplicated server-side.
            await api.recordPayment(invoiceId, amount, `ui-${invoiceId}-${Date.now()}`);
            await rerender({ kind: 'info', text: 'Tahsilat kaydedildi.' });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    function shipmentRow(s) {
        const invoice = invoices.find((i) => i.shipmentId === s.id);
        const canInvoice = !invoice && canCreateInvoiceForShipment(s.status, 'WORK_ORDER', currencySelect.value).ok;
        return (h("tr", { "data-testid": "ship-row", "data-shipment-id": s.id },
            h("td", null,
                h("span", { class: `pill ${(SHIP_TR[s.status] ?? ['', ''])[1]}`, "data-testid": "ship-status", "data-code": s.status }, (SHIP_TR[s.status] ?? [s.status])[0])),
            h("td", null,
                h("span", { "data-testid": "ship-qty" }, String(s.lotQty)),
                " ",
                h("span", { class: "mut" }, "adet")),
            h("td", null,
                canInvoice
                    ? h('button', { type: 'button', class: 'primary', 'data-testid': 'invoice-btn', onClick: () => handleInvoice(s.id) }, 'Fatura Kes')
                    : null,
                invoice ? h('span', { class: 'pill ok', 'data-testid': 'invoiced-badge' }, 'FATURALI') : null)));
    }
    function invoiceRow(inv) {
        const amountInput = h('input', { type: 'number', step: '0.01', placeholder: 'Tutar', 'data-testid': 'payment-amount-input' });
        return (h("tr", { "data-testid": "invoice-row", "data-invoice-id": inv.id },
            h("td", { "data-testid": "invoice-amount" }, `${inv.amount} ${inv.currency}`),
            h("td", null,
                h("span", { class: "mut" }, "\u00D6denen:"),
                " ",
                h("span", { "data-testid": "invoice-paid" }, String(paid[inv.id] ?? 0))),
            h("td", null,
                h("span", { class: `pill ${(INV_TR[inv.status] ?? ['', ''])[1]}`, "data-testid": "invoice-status", "data-code": inv.status }, (INV_TR[inv.status] ?? [inv.status])[0])),
            h("td", null, inv.status !== 'PAID'
                ? h(Fragment, {}, amountInput, h('button', { type: 'button', class: 'okb', 'data-testid': 'payment-btn', onClick: () => handlePayment(inv.id, amountInput) }, 'Tahsilat Kaydet'))
                : null)));
    }
    const screen = (h("div", { class: "accounting-screen kd" },
        h("style", null, DS_CSS + '.kd table{border-collapse:collapse;width:100%;font-size:14px}.kd td{padding:8px;border-top:1px solid #1e293b;vertical-align:middle}.kd td:last-child{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'),
        h("h1", { "data-testid": "acc-heading" },
            "Muhasebe \u2014 Fatura / Tahsilat (Sipari\u015F Kalemi: ",
            orderItemId,
            ")"),
        banner ? (h("div", { class: `banner ${banner.kind}`, "data-testid": "acc-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError || !obligation ? (h("div", { class: "banner error", "data-testid": "acc-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "kpis", "data-testid": "obligation" },
                h("div", { class: "kpi" },
                    h("div", { class: "n", "data-testid": "obl-ordered" }, String(obligation.qtyOrdered)),
                    h("div", { class: "l" }, "S\u0130PAR\u0130\u015E ADED\u0130")),
                h("div", { class: "kpi" },
                    h("div", { class: "n", "data-testid": "obl-shipped" }, String(obligation.qtyShipped)),
                    h("div", { class: "l" }, "SEVK ED\u0130LEN")),
                h("div", { class: "kpi" },
                    h("div", { class: "n", "data-testid": "obl-remaining" }, String(obligation.qtyRemaining)),
                    h("div", { class: "l" }, "KALAN TESL\u0130MAT"))),
            h("div", { class: "panel" },
                h("h2", null, "Sevkiyatlar"),
                h("div", { class: "head" },
                    h("span", { class: "mut" }, "Fatura para birimi"),
                    currencySelect),
                h("table", { "data-testid": "shipments-table" },
                    h("tbody", null, shipments.map(shipmentRow))),
                shipments.length === 0 ? h("div", { class: "empty" }, "Bu kalem i\u00E7in sevkiyat yok.") : null),
            h("div", { class: "panel" },
                h("h2", null, "Faturalar ve tahsilat"),
                h("table", { "data-testid": "invoices-table" },
                    h("tbody", null, invoices.map(invoiceRow))),
                invoices.length === 0 ? h("div", { class: "empty" }, "Hen\u00FCz fatura yok.") : null)))));
    mount(container, screen);
}
