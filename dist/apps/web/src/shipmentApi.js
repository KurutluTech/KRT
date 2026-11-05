/** Real implementation: calls the live kmi_next shipment RPCs/table through the data-client. */
export function createShipmentApi(client, session) {
    return {
        async listForStockLot(stockLotId) {
            return client.select('shipments', {
                columns: 'id,stock_lot_id,status,delivery_note_no,created_at',
                filters: { stock_lot_id: `eq.${stockLotId}` },
                order: 'created_at.desc',
            }, session);
        },
        async create(stockLotId) {
            return client.rpc('create_shipment', { p_stock_lot_id: stockLotId }, session);
        },
        async readinessForShipments(shipmentIds) {
            if (!shipmentIds.length) return [];
            return client.select('shipping_readiness', {
                columns: 'id,shipment_id,status,packed_qty,packaging_ref,decided_at,revoke_reason',
                filters: { shipment_id: `in.(${shipmentIds.join(',')})` },
                order: 'decided_at.desc',
            }, session);
        },
        async deliveryConfirmations(shipmentIds) {
            if (!shipmentIds.length) return [];
            return client.select('shipment_delivery_confirmations', {
                columns: 'shipment_id,source,confirmation_ref,confirmed_at',
                filters: { shipment_id: `in.(${shipmentIds.join(',')})` },
            }, session);
        },
        async recordReadiness(shipmentId, f) {
            return client.rpc('shipping_readiness_record', { p_ship: shipmentId, p_packed_qty: f.packedQty, p_packaging_ref: f.packagingRef, p_product_ok: !!f.productOk, p_qty_ok: !!f.qtyOk, p_packaging_ok: !!f.packagingOk, p_docs_ok: !!f.docsOk, p_note: f.note || null }, session);
        },
        async revokeReadiness(readinessId, reason) {
            return client.rpc('shipping_readiness_revoke', { p_id: readinessId, p_reason: reason }, session);
        },
        async confirmDelivery(shipmentId, source, ref, note) {
            return client.rpc('shipment_delivery_confirm', { p_ship: shipmentId, p_source: source, p_ref: ref, p_note: note || null }, session);
        },
        async transition(shipmentId, toStatus, deliveryNoteNo) {
            return client.rpc('transition_shipment_status', { p_shipment_id: shipmentId, p_to_status: toStatus, p_delivery_note_no: deliveryNoteNo ?? null }, session);
        },
    };
}
