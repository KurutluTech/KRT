// KMI NEXT — first real Golden Thread screen: Orders (list / create / confirm / cancel).
// Built entirely on the dependency-free h()/JSX runtime (packages/ui) — no React, no bundler.
//
// There is no virtual DOM here, so this uses the simplest honest pattern available: every
// action (create, transition) re-fetches from the OrdersApi and fully re-renders the screen
// into the same container. For a screen this size that's a fine trade — see
// docs/ARCHITECTURE.md for why a bundler/React isn't available in this sandbox at all.
//
// Client-side button enablement uses packages/domain's OWN canTransitionOrderStatus() so the
// UI predicts the same outcome the server-side kmi_next.is_allowed_order_transition() RPC
// will enforce (Truth Mode: client-side checks are a UX nicety, never the real authority —
// the RPC is still what actually decides, and this screen never bypasses it).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionOrderStatus } from '../../../../packages/domain/src/order.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
const STATUS_TR = { DRAFT: 'Taslak', CONFIRMED: 'Onaylandı', IN_PRODUCTION: 'Üretimde', PARTIALLY_SHIPPED: 'Kısmen sevk edildi',
    SHIPPED: 'Sevk edildi', CLOSED: 'Kapandı', CANCELLED: 'İptal' };
// PARTIALLY_SHIPPED / SHIPPED are derived from dispatched shipments (0054) — never offered as a manual button
const TRANSITION_TARGETS = ['CONFIRMED', 'IN_PRODUCTION', 'CLOSED', 'CANCELLED'];
export async function renderOrdersScreen(container, api, banner) {
    let orders = [];
    let loadError = null;
    let customers = [];
    let products = [];
    let items = [];
    try {
        orders = await api.list();
        [customers, products, items] = await Promise.all([api.customers(), api.products(), api.items()]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const customerName = (id) => customers.find((c) => c.id === id)?.name ?? id;
    const customerIdInput = h('select', { 'data-testid': 'customer-select' }, h('option', { value: '' }, customers.some((c) => c.active) ? 'Müşteri seçin' : 'Önce Katalog’dan müşteri ekleyin'), ...customers.filter((c) => c.active).map((c) => h('option', { value: c.id }, `${c.name} (${c.code})`)));
    const customerPoInput = h('input', {
        type: 'text',
        'data-testid': 'customer-po-input',
        placeholder: 'Müşteri PO',
    });
    async function handleCreate(e) {
        e.preventDefault();
        const customerId = customerIdInput.value.trim();
        const customerPo = customerPoInput.value.trim();
        if (!customerId || !customerPo) {
            await renderOrdersScreen(container, api, { kind: 'error', text: 'Müşteri seçimi ve Müşteri PO zorunludur.' });
            return;
        }
        try {
            await api.create(customerId, customerPo);
            await renderOrdersScreen(container, api, { kind: 'info', text: 'Sipariş oluşturuldu (Taslak).' });
        }
        catch (err) {
            await renderOrdersScreen(container, api, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleTransition(orderId, toStatus) {
        try {
            await api.transition(orderId, toStatus, `KMI NEXT UI: ${toStatus}`);
            await renderOrdersScreen(container, api, { kind: 'info', text: `Sipariş "${STATUS_TR[toStatus]}" durumuna geçti.` });
        }
        catch (err) {
            await renderOrdersScreen(container, api, { kind: 'error', text: errorText(err) });
        }
    }
    function orderRow(order) {
        const nextOptions = TRANSITION_TARGETS.filter((to) => canTransitionOrderStatus(order.status, to).ok);
        return (h("tr", { "data-testid": "order-row", "data-order-id": order.id },
            h("td", { "data-testid": "order-po" }, order.customerPo),
            h("td", { "data-testid": "order-customer" }, customerName(order.customerId)),
            h("td", { "data-testid": "order-status", "data-status": order.status }, STATUS_TR[order.status] ?? order.status),
            h("td", null, nextOptions.length === 0
                ? h('span', { 'data-testid': 'order-terminal' }, 'kesin durum')
                : nextOptions.map((to) => h('button', {
                    type: 'button',
                    'data-testid': `transition-${to}`,
                    'data-order-id': order.id,
                    onClick: () => handleTransition(order.id, to),
                }, `→ ${STATUS_TR[to]}`)))));
    }
    const orderOf = (id) => orders.find((o) => o.id === id);
    const editable = orders.filter((o) => ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION'].includes(o.status));
    const orderSel = h('select', { 'data-testid': 'item-order' }, ...editable.map((o) => h('option', { value: o.id }, `${o.customerPo} · ${customerName(o.customerId)}`)));
    const prodSel = h('select', { 'data-testid': 'item-product' }, h('option', { value: '' }, products.length ? 'Ürün seçin' : 'Önce Katalog’dan ürün ekleyin'), ...products.map((p) => h('option', { value: p.id }, `${p.code} · ${p.name}`)));
    const qtyIn = h('input', { type: 'number', min: '1', step: 'any', 'data-testid': 'item-qty', placeholder: 'Adet' });
    const priceIn = h('input', { type: 'number', min: '0', step: 'any', 'data-testid': 'item-price', placeholder: 'Birim fiyat' });
    const dueIn = h('input', { type: 'date', 'data-testid': 'item-due' });
    let pendingReq = `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    async function handleAddItem(e) {
        e.preventDefault();
        if (!orderSel.value || !prodSel.value || !(Number(qtyIn.value) > 0) || priceIn.value === '' || !dueIn.value) {
            await renderOrdersScreen(container, api, { kind: 'error', text: 'Sipariş, ürün, adet, birim fiyat ve termin zorunludur.' });
            return;
        }
        try {
            await api.addItem(orderSel.value, prodSel.value, Number(qtyIn.value), Number(priceIn.value), dueIn.value, pendingReq);
            pendingReq = '';
            await renderOrdersScreen(container, api, { kind: 'info', text: 'Sipariş kalemi eklendi.' });
        }
        catch (err) {
            await renderOrdersScreen(container, api, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleWorkOrder(item, qty) {
        try {
            await api.createWorkOrder(item.id, qty);
            await renderOrdersScreen(container, api, { kind: 'info', text: 'İş emri açıldı.' });
        }
        catch (err) {
            await renderOrdersScreen(container, api, { kind: 'error', text: errorText(err) });
        }
    }
    const productName = (id) => products.find((p) => p.id === id)?.code ?? id;
    function itemRow(it) {
        const q = h('input', { type: 'number', min: '1', step: 'any', value: String(it.qty), 'data-testid': 'wo-qty', style: 'width:80px' });
        return h('div', { 'data-testid': 'item-row', 'data-item-id': it.id, style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:4px 0;font-size:13px' }, h('span', {}, `${orderOf(it.orderId)?.customerPo ?? '?'} · ${productName(it.productId)} · ${it.qty} adet · termin ${it.dueDate}`), q, h('button', { type: 'button', 'data-testid': 'wo-create', onClick: () => void handleWorkOrder(it, Number(q.value)), style: 'background:#1d4ed8;color:#fff;font-weight:700;border-radius:8px;padding:8px 14px' }, 'İŞ EMRİ AÇ'));
    }
    const screen = (h("div", { class: "orders-screen" },
        h("h1", { "data-testid": "orders-heading" }, "Sipari\u015Fler"),
        banner ? (h("div", { "data-testid": "banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { "data-testid": "load-error" },
            "Sipari\u015F listesi y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("form", { "data-testid": "create-order-form", onSubmit: handleCreate },
                customerIdInput,
                customerPoInput,
                h("button", { type: "submit", "data-testid": "create-order-btn" }, "Sipari\u015F Olu\u015Ftur")),
            h("section", { "data-testid": "items-section", style: "margin:12px 0" },
                h("h2", { style: "font-size:16px" }, "Sipari\u015F kalemleri"),
                h("form", { "data-testid": "add-item-form", onSubmit: handleAddItem, style: "display:flex;gap:6px;flex-wrap:wrap" },
                    orderSel,
                    prodSel,
                    qtyIn,
                    priceIn,
                    dueIn,
                    h("button", { type: "submit", "data-testid": "add-item-btn" }, "Kalem ekle")),
                h("div", { "data-testid": "items-list" }, items.length === 0 ? h('div', { 'data-testid': 'items-empty', style: 'color:#64748b' }, 'Henüz kalem yok.') : items.map(itemRow))),
            h("table", { "data-testid": "orders-table" },
                h("thead", null,
                    h("tr", null,
                        h("th", null, "PO"),
                        h("th", null, "M\u00FC\u015Fteri"),
                        h("th", null, "Durum"),
                        h("th", null, "\u0130\u015Flemler"))),
                h("tbody", { "data-testid": "orders-tbody" }, orders.length === 0
                    ? h('tr', null, h('td', { colspan: '4', 'data-testid': 'orders-empty' }, 'Henüz sipariş yok.'))
                    : orders.map(orderRow)))))));
    mount(container, screen);
}
