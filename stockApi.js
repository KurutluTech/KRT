/** Real implementation: calls the live kmi_next stock RPCs/table through the data-client. */
export function createStockApi(client, session) {
    return {
        async listForWorkOrder(workOrderId) {
            return client.select('stock_lots', {
                columns: 'id,work_order_id,qty,state,created_at',
                filters: { work_order_id: `eq.${workOrderId}` },
                order: 'created_at.desc',
            }, session);
        },
        async createLot(workOrderId, qty) {
            return client.rpc('create_stock_lot', { p_work_order_id: workOrderId, p_qty: qty }, session);
        },
        async transition(stockLotId, toState, reason) {
            return client.rpc('transition_stock_lot', { p_stock_lot_id: stockLotId, p_to_state: toState, p_reason: reason }, session);
        },
    };
}
