// KMI NEXT — Accounting screen (Item 9, ACCOUNTING_MUTATION): per-shipment invoices, payments
// (tahsilat) and the order item's remaining delivery obligation. Same h()/full-re-render pattern
// as the other screens; every rule is re-enforced server-side (migration 0014).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canCreateInvoiceForShipment, INVOICE_CURRENCIES } from '../../../../packages/domain/src/accounting.js';
import { errorText as sharedErrorText } from '../errorText.js';
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
            h("td", { "data-testid": "ship-status" }, s.status),
            h("td", { "data-testid": "ship-qty" }, String(s.lotQty)),
            h("td", null,
                canInvoice
                    ? h('button', { type: 'button', 'data-testid': 'invoice-btn', onClick: () => handleInvoice(s.id) }, 'Fatura Kes')
                    : null,
                invoice ? h('span', { 'data-testid': 'invoiced-badge' }, 'FATURALI') : null)));
    }
    function invoiceRow(inv) {
        const amountInput = h('input', { type: 'number', step: '0.01', 'data-testid': 'payment-amount-input' });
        return (h("tr", { "data-testid": "invoice-row", "data-invoice-id": inv.id },
            h("td", { "data-testid": "invoice-amount" }, `${inv.amount} ${inv.currency}`),
            h("td", { "data-testid": "invoice-paid" }, String(paid[inv.id] ?? 0)),
            h("td", { "data-testid": "invoice-status" }, inv.status),
            h("td", null, inv.status !== 'PAID'
                ? h(Fragment, {}, amountInput, h('button', { type: 'button', 'data-testid': 'payment-btn', onClick: () => handlePayment(inv.id, amountInput) }, 'Tahsilat Kaydet'))
                : null)));
    }
    const screen = (h("div", { class: "accounting-screen" },
        h("h1", { "data-testid": "acc-heading" },
            "Muhasebe \u2014 Fatura / Tahsilat (Sipari\u015F Kalemi: ",
            orderItemId,
            ")"),
        banner ? (h("div", { "data-testid": "acc-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError || !obligation ? (h("div", { "data-testid": "acc-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { "data-testid": "obligation" },
                h("span", { "data-testid": "obl-ordered" }, String(obligation.qtyOrdered)),
                h("span", { "data-testid": "obl-shipped" }, String(obligation.qtyShipped)),
                h("span", { "data-testid": "obl-remaining" }, String(obligation.qtyRemaining))),
            currencySelect,
            h("table", { "data-testid": "shipments-table" },
                h("tbody", null, shipments.map(shipmentRow))),
            h("table", { "data-testid": "invoices-table" },
                h("tbody", null, invoices.map(invoiceRow)))))));
    mount(container, screen);
}
