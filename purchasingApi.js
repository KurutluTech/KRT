/** Real implementation: calls the live kmi_next purchasing RPCs/tables through the data-client. */
export function createPurchasingApi(client, session) {
    return {
        async listSuppliers() {
            return client.select('suppliers', { columns: 'id,name,active', order: 'name.asc' }, session);
        },
        async listPurchaseOrders() {
            return client.select('purchase_orders', { columns: 'id,supplier_id,status', order: 'created_at.desc' }, session);
        },
        async listLines() {
            return client.select('purchase_order_lines', { columns: 'id,purchase_order_id,material_code,qty_ordered,qty_received', order: 'created_at.asc' }, session);
        },
        async createPurchaseOrder(supplierId, lines) {
            return client.rpc('create_purchase_order', { p_supplier_id: supplierId, p_lines: lines.map((l) => ({ material_code: l.materialCode, qty_ordered: l.qtyOrdered })) }, session);
        },
        async transition(purchaseOrderId, toStatus) {
            return client.rpc('transition_purchase_order_status', { p_purchase_order_id: purchaseOrderId, p_to_status: toStatus }, session);
        },
        async approve(purchaseOrderId) {
            return client.rpc('approve_purchase_order', { p_purchase_order_id: purchaseOrderId }, session);
        },
        async recordGoodsReceipt(purchaseOrderLineId, qty) {
            return client.rpc('record_goods_receipt', { p_purchase_order_line_id: purchaseOrderLineId, p_qty: qty }, session);
        },
        async recordIncomingQualityDecision(stockLotId, decision, reason) {
            return client.rpc('record_incoming_quality_decision', { p_stock_lot_id: stockLotId, p_decision: decision, p_reason: reason ?? null }, session);
        },
    };
}
