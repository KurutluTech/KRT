// KMI NEXT — Satınalma Talepleri: create / from work-order shortage / approve-reject /
// convert approved requests into a priced PO. Every rule re-enforced server-side (0018).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionPurchaseRequest } from '../../../../packages/domain/src/purchasing.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderPurchaseRequestsScreen(container, api, banner) {
    let rows = [];
    let loadError = null;
    try {
        rows = await api.list();
    }
    catch (err) {
        loadError = errorText(err);
    }
    const rerender = (b) => renderPurchaseRequestsScreen(container, api, b);
    const materialInput = h('input', { type: 'text', 'data-testid': 'pr-material-input', placeholder: 'Malzeme kodu' });
    const qtyInput = h('input', { type: 'number', 'data-testid': 'pr-qty-input' });
    const reasonInput = h('input', { type: 'text', 'data-testid': 'pr-reason-input', placeholder: 'Talep nedeni' });
    const woInput = h('input', { type: 'text', 'data-testid': 'pr-wo-input', placeholder: 'İş emri ID (eksikten talep)' });
    const supplierInput = h('input', { type: 'text', 'data-testid': 'po-supplier-input', placeholder: 'Tedarikçi ID' });
    const currencyInput = h('input', { type: 'text', 'data-testid': 'po-currency-input', placeholder: 'Para birimi (TRY/EUR/USD/GBP)' });
    const priceInputs = new Map();
    const priceFor = (id) => {
        let el = priceInputs.get(id);
        if (!el) {
            el = h('input', { type: 'number', step: '0.0001', 'data-testid': 'pr-price-input' });
            priceInputs.set(id, el);
        }
        return el;
    };
    async function run(fn, ok) {
        try {
            await fn();
            await rerender({ kind: 'info', text: ok });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    const approved = rows.filter((r) => r.status === 'APPROVED');
    const screen = h('div', { class: 'purchase-requests-screen' }, h('h1', { 'data-testid': 'pr-heading' }, 'Satınalma Talepleri'), banner ? h('div', { 'data-testid': 'pr-banner', 'data-kind': banner.kind }, banner.text) : null, loadError
        ? h('div', { 'data-testid': 'pr-load-error' }, `Yüklenemedi: ${loadError}`)
        : h('div', {}, materialInput, qtyInput, reasonInput, h('button', { type: 'button', 'data-testid': 'pr-create-btn', onClick: () => run(() => api.create(materialInput.value.trim(), Number(qtyInput.value), reasonInput.value.trim()), 'Talep oluşturuldu.') }, 'Talep Oluştur'), woInput, h('button', { type: 'button', 'data-testid': 'pr-shortage-btn', onClick: () => run(() => api.fromShortage(woInput.value.trim()), 'Malzeme eksiğinden talepler oluşturuldu.') }, 'İş Emri Eksiğinden Talep'), h('table', { 'data-testid': 'pr-table' }, h('tbody', {}, ...rows.map((r) => h('tr', { 'data-testid': 'pr-row', 'data-request-id': r.id }, h('td', { 'data-testid': 'pr-material' }, r.materialCode), h('td', { 'data-testid': 'pr-qty' }, String(r.qty)), h('td', { 'data-testid': 'pr-status' }, r.status), h('td', {}, canTransitionPurchaseRequest(r.status, 'APPROVED').ok
            ? h('button', { type: 'button', 'data-testid': 'pr-approve-btn', onClick: () => run(() => api.decide(r.id, 'APPROVED', 'KMI NEXT UI onayı'), 'Talep onaylandı.') }, 'Onayla')
            : null, canTransitionPurchaseRequest(r.status, 'REJECTED').ok
            ? h('button', { type: 'button', 'data-testid': 'pr-reject-btn', onClick: () => run(() => api.decide(r.id, 'REJECTED', 'KMI NEXT UI reddi'), 'Talep reddedildi.') }, 'Reddet')
            : null, r.status === 'APPROVED' ? priceFor(r.id) : null))))), supplierInput, currencyInput, h('button', {
            type: 'button',
            'data-testid': 'po-from-requests-btn',
            onClick: () => run(() => api.convertToPo(supplierInput.value.trim(), currencyInput.value.trim(), approved.map((r) => ({ requestId: r.id, unitPrice: Number(priceFor(r.id).value) }))), 'Onaylı taleplerden satınalma siparişi oluşturuldu.'),
        }, 'Onaylı Taleplerden PO Oluştur')));
    mount(container, screen);
}
