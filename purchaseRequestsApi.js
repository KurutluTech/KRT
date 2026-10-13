export function createPurchaseRequestsApi(client, session) {
    return {
        async list() {
            return client.select('purchase_requests', { columns: 'id,material_code,qty,reason,status,source_work_order_id', order: 'requested_at.desc' }, session);
        },
        async create(materialCode, qty, reason) {
            return client.rpc('create_purchase_request', { p_material_code: materialCode, p_qty: qty, p_reason: reason }, session);
        },
        async fromShortage(workOrderId) {
            return client.rpc('create_purchase_requests_for_shortage', { p_work_order_id: workOrderId }, session);
        },
        async decide(requestId, decision, reason) {
            return client.rpc('decide_purchase_request', { p_request_id: requestId, p_decision: decision, p_reason: reason }, session);
        },
        async convertToPo(supplierId, currency, lines) {
            return client.rpc('create_purchase_order_from_requests', { p_supplier_id: supplierId, p_currency: currency, p_lines: lines.map((l) => ({ request_id: l.requestId, unit_price: l.unitPrice })) }, session);
        },
    };
}
