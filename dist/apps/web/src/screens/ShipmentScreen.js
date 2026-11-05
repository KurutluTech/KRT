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
    let readiness = [];
    let confirmations = [];
    const val = (id, sel) => { const el = container.querySelector(`[data-ship-form="${id}"] ${sel}`); return el; };
    const readyOf = (id) => readiness.find((r) => r.shipmentId === id && r.status === 'READY' || r.shipment_id === id && r.status === 'READY');
    const confOf = (id) => confirmations.find((c) => (c.shipmentId ?? c.shipment_id) === id);
    try {
        lotState = await deps.getStockLotState();
        shipments = await deps.api.listForStockLot(stockLotId);
        const ids = shipments.map((x) => x.id);
        readiness = deps.api.readinessForShipments ? await deps.api.readinessForShipments(ids) : [];
        confirmations = deps.api.deliveryConfirmations ? await deps.api.deliveryConfirmations(ids) : [];
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
            await deps.api.transition(shipmentId, 'DISPATCHED', null); // irsaliye no sunucuda onaylı belgeden gelir
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Ürün tesisten çıktı (DISPATCHED). Müşteri teslimi henüz teyit edilmedi.' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleDeliver(shipmentId) {
        const src = val(shipmentId, '[data-testid="deliver-source"]'); const ref = val(shipmentId, '[data-testid="deliver-ref"]'); const note = val(shipmentId, '[data-testid="deliver-note"]');
        try {
            await deps.api.confirmDelivery(shipmentId, src ? src.value : '', ref ? ref.value : '', note ? note.value : '');
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Müşteri teslim teyidi kaydedildi; sevkiyat DELIVERED.' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleReadiness(shipmentId) {
        const g = (t) => val(shipmentId, `[data-testid="${t}"]`);
        const num = Number(String(g('ready-qty').value).replace(',', '.'));
        try {
            await deps.api.recordReadiness(shipmentId, { packedQty: num, packagingRef: g('ready-pack').value, productOk: g('ready-product').checked, qtyOk: g('ready-qtyok').checked, packagingOk: g('ready-packok').checked, docsOk: g('ready-docs').checked, note: g('ready-note').value });
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Sevkiyata hazırlık kararı kaydedildi. Stok hareketi OLUŞMADI; ürün henüz sevk edilmedi.' });
        }
        catch (err) {
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleRevokeReadiness(shipmentId, readinessId) {
        const r = val(shipmentId, '[data-testid="ready-revoke-reason"]');
        try {
            await deps.api.revokeReadiness(readinessId, r ? r.value : '');
            await renderShipmentScreen(container, stockLotId, deps, { kind: 'info', text: 'Hazırlık kararı iptal edildi.' });
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
                    h("td", { "data-testid": "shipment-actions", "data-ship-form": shipment.id },
                        shipment.status === 'DRAFT' ? (readyOf(shipment.id)
                            ? h(Fragment, null,
                                h('span', { 'data-testid': 'readiness-state' }, 'Sevkiyata hazır (depo kararı verildi)'),
                                h('input', { type: 'text', 'data-testid': 'ready-revoke-reason', placeholder: 'İptal gerekçesi' }),
                                h('button', { type: 'button', 'data-testid': 'readiness-revoke-btn', onClick: () => handleRevokeReadiness(shipment.id, readyOf(shipment.id).id) }, 'Hazırlığı İptal Et'))
                            : h(Fragment, null,
                                h('span', { 'data-testid': 'readiness-state' }, 'Depo hazırlık kararı yok'),
                                h('input', { type: 'number', 'data-testid': 'ready-qty', placeholder: 'Paketlenen adet' }),
                                h('input', { type: 'text', 'data-testid': 'ready-pack', placeholder: 'Paket / palet referansı' }),
                                h('label', null, h('input', { type: 'checkbox', 'data-testid': 'ready-product' }), ' Ürün doğru'),
                                h('label', null, h('input', { type: 'checkbox', 'data-testid': 'ready-qtyok' }), ' Miktar doğru'),
                                h('label', null, h('input', { type: 'checkbox', 'data-testid': 'ready-packok' }), ' Paketleme tamam'),
                                h('label', null, h('input', { type: 'checkbox', 'data-testid': 'ready-docs' }), ' Fatura/irsaliye kontrol edildi'),
                                h('input', { type: 'text', 'data-testid': 'ready-note', placeholder: 'Not' }),
                                h('button', { type: 'button', 'data-testid': 'readiness-record-btn', onClick: () => handleReadiness(shipment.id) }, 'Sevkiyata Hazır Kararı Ver'))) : null,
                        canDispatchShipment(shipment.status).ok
                            ? h('button', { type: 'button', 'data-testid': 'dispatch-btn', 'data-shipment-id': shipment.id, onClick: () => handleDispatch(shipment.id) }, 'Sevk Et (tesisten çıkış)')
                            : null,
                        canDeliverShipment(shipment.status).ok
                            ? (confOf(shipment.id) ? h('span', { 'data-testid': 'delivery-confirmed' }, 'Teslim teyit edildi') : h(Fragment, null,
                                h('select', { 'data-testid': 'deliver-source' },
                                    h('option', { value: 'CARRIER_POD' }, 'Taşıyıcı teslim belgesi (POD)'),
                                    h('option', { value: 'CUSTOMER_SIGNATURE' }, 'Müşteri imzası'),
                                    h('option', { value: 'CUSTOMER_EMAIL' }, 'Müşteri e-postası'),
                                    h('option', { value: 'OTHER' }, 'Diğer')),
                                h('input', { type: 'text', 'data-testid': 'deliver-ref', placeholder: 'Teyit referansı (zorunlu)' }),
                                h('input', { type: 'text', 'data-testid': 'deliver-note', placeholder: 'Not' }),
                                h('button', { type: 'button', 'data-testid': 'deliver-btn', 'data-shipment-id': shipment.id, onClick: () => handleDeliver(shipment.id) }, 'Müşteri Teslimini Teyit Et')))
                            : null,
                        canCancelShipment(shipment.status).ok
                            ? h('button', { type: 'button', 'data-testid': 'cancel-shipment-btn', 'data-shipment-id': shipment.id, onClick: () => handleCancel(shipment.id) }, 'İptal Et')
                            : null))))))))));
    mount(container, screen);
}
