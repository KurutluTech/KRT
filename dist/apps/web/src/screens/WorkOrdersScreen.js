// KMI NEXT — Golden Thread step 2 screen: Work Orders for a single order item.
// Same pattern as OrdersScreen.tsx (full re-render on action, no virtual DOM) — see that
// file's header comment for why. Machine assignment button is only shown when
// canAssignMachine() (packages/domain) predicts the server will allow it; the real
// authorization/state check still happens server-side in
// kmi_next.assign_work_order_machine() (Truth Mode: client prediction is UX only).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionWorkOrderStatus, canAssignMachine } from '../../../../packages/domain/src/workOrder.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
const TRANSITION_TARGETS = [
    'MACHINE_ASSIGNED',
    'IN_PROGRESS',
    'FIRST_PIECE_PENDING',
    'FIRST_PIECE_APPROVED',
    'COMPLETED',
    'ON_HOLD',
    'CANCELLED',
];
export async function renderWorkOrdersScreen(container, orderItemId, api, banner) {
    let workOrders = [];
    let loadError = null;
    try {
        workOrders = await api.listForOrderItem(orderItemId);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const qtyInput = h('input', { type: 'number', min: '1', 'data-testid': 'wo-qty-input' });
    const machineIdInput = h('input', { type: 'text', 'data-testid': 'wo-machine-id-input', placeholder: 'Makine ID' });
    const operatorIdInput = h('input', { type: 'text', 'data-testid': 'wo-operator-id-input', placeholder: 'Operatör (personel) ID' });
    async function handleCreate(e) {
        e.preventDefault();
        const qty = Number(qtyInput.value);
        if (!Number.isFinite(qty) || qty <= 0) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: 'Geçerli bir miktar girin.' });
            return;
        }
        try {
            await api.create(orderItemId, qty);
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'info', text: 'İş emri oluşturuldu (PLANNED).' });
        }
        catch (err) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleAssignMachine(workOrderId) {
        const machineId = machineIdInput.value.trim();
        if (!machineId) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: 'Makine ID zorunludur.' });
            return;
        }
        try {
            await api.assignMachine(workOrderId, machineId);
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'info', text: 'Makine atandı.' });
        }
        catch (err) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleAssignOperator(workOrderId) {
        const personId = operatorIdInput.value.trim();
        if (!personId) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: 'Operatör ID zorunludur.' });
            return;
        }
        try {
            await api.assignOperator(workOrderId, personId);
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'info', text: 'Operatör atandı.' });
        }
        catch (err) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleTransition(workOrderId, toStatus) {
        try {
            await api.transition(workOrderId, toStatus, `KMI NEXT UI: ${toStatus}`);
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'info', text: `İş emri ${toStatus} durumuna geçti.` });
        }
        catch (err) {
            await renderWorkOrdersScreen(container, orderItemId, api, { kind: 'error', text: errorText(err) });
        }
    }
    function workOrderRow(wo) {
        const nextOptions = TRANSITION_TARGETS.filter((to) => canTransitionWorkOrderStatus(wo.status, to).ok);
        return (h("tr", { "data-testid": "wo-row", "data-wo-id": wo.id },
            h("td", { "data-testid": "wo-status" }, wo.status),
            h("td", { "data-testid": "wo-qty-planned" }, String(wo.qtyPlanned)),
            h("td", { "data-testid": "wo-machine" }, wo.machineId ?? '—'),
            h("td", { "data-testid": "wo-operator" }, wo.operatorId ?? '—'),
            h("td", null,
                canAssignMachine(wo.status)
                    ? h('button', { type: 'button', 'data-testid': 'wo-assign-machine-btn', 'data-wo-id': wo.id, onClick: () => handleAssignMachine(wo.id) }, 'Makine Ata')
                    : null,
                wo.machineId !== null && wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED'
                    ? h('button', { type: 'button', 'data-testid': 'wo-assign-operator-btn', 'data-wo-id': wo.id, onClick: () => handleAssignOperator(wo.id) }, 'Operatör Ata')
                    : null,
                nextOptions
                    .filter((to) => to !== 'MACHINE_ASSIGNED') // machine assignment has its own dedicated action above
                    .map((to) => h('button', { type: 'button', 'data-testid': `wo-transition-${to}`, 'data-wo-id': wo.id, onClick: () => handleTransition(wo.id, to) }, to)))));
    }
    const screen = (h("div", { class: "work-orders-screen" },
        h("h1", { "data-testid": "wo-heading" }, "\u0130\u015F Emirleri"),
        banner ? (h("div", { "data-testid": "wo-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { "data-testid": "wo-load-error" },
            "\u0130\u015F emri listesi y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("form", { "data-testid": "create-wo-form", onSubmit: handleCreate },
                qtyInput,
                h("button", { type: "submit", "data-testid": "create-wo-btn" }, "\u0130\u015F Emri Olu\u015Ftur")),
            machineIdInput,
            operatorIdInput,
            h("table", { "data-testid": "wo-table" },
                h("thead", null,
                    h("tr", null,
                        h("th", null, "Durum"),
                        h("th", null, "Planlanan Miktar"),
                        h("th", null, "Makine"),
                        h("th", null, "Operat\u00F6r"),
                        h("th", null, "\u0130\u015Flemler"))),
                h("tbody", { "data-testid": "wo-tbody" }, workOrders.length === 0
                    ? h('tr', null, h('td', { colspan: '5', 'data-testid': 'wo-empty' }, 'Henüz iş emri yok.'))
                    : workOrders.map(workOrderRow)))))));
    mount(container, screen);
}
