// KMI NEXT — Golden Thread step 7 screen: Shipment (Sevkiyat) for a single stock lot. Same
// h()/JSX/full-re-render pattern as the other Golden Thread screens. This is the final named
// ring in the owner's chain (Sipariş → ... → Ticari Onay → Sevkiyat).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canCreateShipment, canDispatchShipment, canDeliverShipment, canCancelShipment } from '../../../../packages/domain/src/shipment.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderShipmentScreen(container, stockLotId, deps, banner) {
    let lotState = null;
    let shipments = [];
    let loadError = null;
    try {
        lotState = await deps.getStockLotState();
        shipments = await deps.api.listForStockLot(stockLotId);
    }
    catch (err) {
        loadError = errorText(err);
    }
    async function handleCreate() {
        try {
            await deps.api.create(stockLotId);
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Sevkiyat oluşturuldu.' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleDispatch(shipmentId) {
        try {
            await deps.api.transition(shipmentId, 'DISPATCHED', `DN-${shipmentId.slice(0, 8)}`);
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Sevkiyat sevk edildi (DISPATCHED) — stok lotu SHIPPED oldu.' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleDeliver(shipmentId) {
        try {
            await deps.api.transition(shipmentId, 'DELIVERED');
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Sevkiyat teslim edildi (DELIVERED).' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleCancel(shipmentId) {
        try {
            await deps.api.transition(shipmentId, 'CANCELLED');
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Sevkiyat iptal edildi.' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = (h("div", { class: "shipment-screen" },
        h("h1", { "data-testid": "ship-heading" },
            "Sevkiyat (Stok Lotu: ",
            stockLotId,
            ")"),
        banner ? (h("div", { "data-testid": "ship-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError || !lotState ? (h("div", { "data-testid": "ship-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("span", { "data-testid": "ship-lot-state" }, lotState),
            canCreateShipment(lotState).ok ? (h('button', { type: 'button', 'data-testid': 'create-shipment-btn', onClick: handleCreate }, 'Sevkiyat Oluştur')) : (h("div", { "data-testid": "create-shipment-disabled" },
                "Bu durumda sevkiyat olu\u015Fturulamaz: ",
                lotState)),
            h("table", { "data-testid": "shipments-table" },
                h("tbody", { "data-testid": "shipments-tbody" }, shipments.map((shipment) => (h("tr", { "data-testid": "shipment-row", "data-shipment-id": shipment.id },
                    h("td", { "data-testid": "shipment-status" }, shipment.status),
                    h("td", { "data-testid": "shipment-delivery-note" }, shipment.deliveryNoteNo ?? ''),
                    h("td", { "data-testid": "shipment-actions" },
                        canDispatchShipment(shipment.status).ok
                            ? h('button', { type: 'button', 'data-testid': 'dispatch-btn', 'data-shipment-id': shipment.id, onClick: () => handleDispatch(shipment.id) }, 'Sevk Et')
                            : null,
                        canDeliverShipment(shipment.status).ok
                            ? h('button', { type: 'button', 'data-testid': 'deliver-btn', 'data-shipment-id': shipment.id, onClick: () => handleDeliver(shipment.id) }, 'Teslim Edildi')
                            : null,
                        canCancelShipment(shipment.status).ok
                            ? h('button', { type: 'button', 'data-testid': 'cancel-shipment-btn', 'data-shipment-id': shipment.id, onClick: () => handleCancel(shipment.id) }, 'İptal Et')
                            : null))))))))));
    mount(container, screen);
}
