// KMI NEXT — Tedarikçi Faturası & Ödeme (#679 A). One purchase order: ordered / received /
// incoming-QC accepted / rejected / pending / invoiced / invoiceable per line (3-way match),
// invoice entry, partial payments. Every rule is enforced again on the server (migration 0023);
// the screen never decides money on its own. Mobile-friendly: tables scroll horizontally.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
function requestId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
const STATUS_TR = { OPEN: 'AÇIK', PARTIAL: 'KISMİ ÖDENDİ', PAID: 'ÖDENDİ' };
export async function renderSupplierInvoiceScreen(container, po, api, banner) {
    let lines = [];
    let invoices = [];
    let loadError = null;
    try {
        [lines, invoices] = await Promise.all([api.matchStatus(po.id), api.balances(po.id)]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const rerender = (b) => renderSupplierInvoiceScreen(container, po, api, b);
    // One request id per rendered form: a double click / network retry sends the SAME id and the
    // server returns the already-recorded invoice/payment instead of creating a second one.
    const invoiceRequestId = requestId('ui-sinv');
    const invoiceNoInput = h('input', { type: 'text', 'data-testid': 'sinv-no-input', placeholder: 'Fatura no' });
    const dueDateInput = h('input', { type: 'date', 'data-testid': 'sinv-due-input' });
    const qtyInputs = new Map();
    const priceInputs = new Map();
    for (const l of lines) {
        qtyInputs.set(l.poLineId, h('input', { type: 'number', step: '0.001', min: '0', 'data-testid': 'sinv-qty-input', value: '' }));
        priceInputs.set(l.poLineId, h('input', { type: 'number', step: '0.0001', 'data-testid': 'sinv-price-input', value: l.unitPrice === null ? '' : String(l.unitPrice) }));
    }
    async function handleInvoice() {
        const invLines = lines
            .map((l) => ({ poLineId: l.poLineId, qty: Number(qtyInputs.get(l.poLineId)?.value || 0), unitPrice: Number(priceInputs.get(l.poLineId)?.value || 0) }))
            .filter((l) => l.qty > 0);
        try {
            await api.recordInvoice(po.id, invoiceNoInput.value, po.currency, invLines, invoiceRequestId, dueDateInput.value || null);
            await rerender({ kind: 'info', text: 'Tedarikçi faturası kaydedildi (3\'lü eşleşme sunucuda doğrulandı).' });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    const payInputs = new Map();
    const payRequestIds = new Map();
    async function handlePay(inv) {
        try {
            await api.recordPayment(inv.invoiceId, Number(payInputs.get(inv.invoiceId)?.value || 0), payRequestIds.get(inv.invoiceId) ?? requestId('ui-spay'));
            await rerender({ kind: 'info', text: `Ödeme kaydedildi: ${inv.invoiceNo}` });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    const cell = (testid, text) => h('td', { 'data-testid': testid }, text);
    const screen = h('div', { class: 'supplier-invoice-screen', style: 'max-width:100%;padding:0 16px;box-sizing:border-box' }, h('h1', { 'data-testid': 'sinv-heading' }, `Tedarikçi Faturası & Ödeme — ${po.label} (${po.currency})`), banner ? h('div', { 'data-testid': 'sinv-banner', 'data-kind': banner.kind }, banner.text) : null, loadError
        ? h('div', { 'data-testid': 'sinv-load-error' }, loadError.includes('FORBIDDEN') ? 'Bu ekranı görme yetkiniz yok (muhasebe / satınalma onay yetkisi gerekir).' : `Yüklenemedi: ${loadError}`)
        : h('div', {}, h('h2', {}, 'Sipariş satırları — 3\'lü eşleşme'), h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'sinv-match-table' }, h('thead', {}, h('tr', {}, ...['Malzeme', 'Birim fiyat', 'Sipariş', 'Teslim', 'Kalite kabul', 'Red', 'Kalite bekliyor', 'Faturalı', 'Faturalanabilir', 'Fatura miktarı', 'Fatura fiyatı'].map((t) => h('th', {}, t)))), h('tbody', {}, ...lines.map((l) => h('tr', { 'data-testid': 'sinv-line', 'data-material': l.materialCode }, cell('sinv-material', l.materialCode), cell('sinv-unit-price', l.unitPrice === null ? 'FİYAT YOK' : String(l.unitPrice)), cell('sinv-ordered', String(l.qtyOrdered)), cell('sinv-received', String(l.qtyReceived)), cell('sinv-accepted', String(l.qtyAccepted)), cell('sinv-rejected', String(l.qtyRejected)), cell('sinv-qc-pending', String(l.qtyQcPending)), cell('sinv-invoiced', String(l.qtyInvoiced)), cell('sinv-invoiceable', String(l.qtyInvoiceable)), h('td', {}, qtyInputs.get(l.poLineId)), h('td', {}, priceInputs.get(l.poLineId))))))), h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0' }, invoiceNoInput, dueDateInput, h('button', { type: 'button', 'data-testid': 'sinv-save-btn', onClick: () => void handleInvoice() }, 'Faturayı Kaydet')), h('h2', {}, 'Faturalar ve ödemeler'), h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'sinv-invoices-table' }, h('thead', {}, h('tr', {}, ...['Fatura no', 'Tutar', 'Ödenen', 'Kalan', 'Durum', 'Vade', 'Ödeme'].map((t) => h('th', {}, t)))), h('tbody', {}, ...invoices.map((inv) => {
            const payInput = h('input', { type: 'number', step: '0.01', min: '0', 'data-testid': 'spay-amount-input' });
            payInputs.set(inv.invoiceId, payInput);
            payRequestIds.set(inv.invoiceId, requestId('ui-spay'));
            return h('tr', { 'data-testid': 'sinv-invoice', 'data-invoice-no': inv.invoiceNo, 'data-overdue': String(inv.overdue) }, cell('sinv-inv-no', inv.invoiceNo), cell('sinv-amount', fmt(inv.amount)), cell('sinv-paid', fmt(inv.paid)), cell('sinv-remaining', fmt(inv.remaining)), cell('sinv-status', STATUS_TR[inv.status] ?? inv.status), cell('sinv-due', inv.dueDate ? `${inv.dueDate}${inv.overdue ? ' — VADESİ GEÇTİ' : ''}` : '—'), h('td', {}, inv.status === 'PAID'
                ? '—'
                : h('span', {}, payInput, h('button', { type: 'button', 'data-testid': 'spay-btn', onClick: () => void handlePay(inv) }, 'Ödeme Kaydet'))));
        }))))));
    mount(container, screen);
}
