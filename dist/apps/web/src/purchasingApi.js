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
        async customers() {
            return client.select('customers', { columns: 'id,code,name,active', filters: { active: 'eq.true' }, order: 'name.asc' }, session);
        },
        async materialCodes() {
            const r = await client.select('bom_lines', { columns: 'material_code', order: 'material_code.asc' }, session);
            return [...new Set(r.map((x) => x.material_code).filter(Boolean))];
        },
        async receiveCustomerMaterial(customerId, materialCode, bars, reference) {
            return client.rpc('record_customer_material_receipt', { p_customer_id: customerId, p_material_code: materialCode, p_bars: bars, p_reference: reference }, session);
        },
        async recordIncomingQualityDecision(stockLotId, decision, reason) {
            return client.rpc('record_incoming_quality_decision', { p_stock_lot_id: stockLotId, p_decision: decision, p_reason: reason ?? null }, session);
        },
    };
}
