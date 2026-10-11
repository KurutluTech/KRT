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
        async transition(shipmentId, toStatus, deliveryNoteNo) {
            return client.rpc('transition_shipment_status', { p_shipment_id: shipmentId, p_to_status: toStatus, p_delivery_note_no: deliveryNoteNo ?? null }, session);
        },
    };
}
