export function createOrderCommandApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    return {
        overview: () => rpc('order_cc_overview', {}),
        detail: (id) => rpc('order_cc_detail', { p_order_id: id }),
        change: (itemId, p, reason, requestId) => rpc('order_item_change', { p_order_item_id: itemId, p_qty: p.qty ?? null, p_due_date: p.dueDate ?? null, p_unit_price: p.unitPrice ?? null, p_reason: reason, p_client_request_id: requestId }),
        print: (id) => rpc('order_cc_print', { p_order_id: id }),
        find: (text) => rpc('order_cc_find', { p_text: text }),
        transition: async (orderId, to, reason) => { await rpc('transition_order_status', { p_order_id: orderId, p_to_status: to, p_reason: reason }); },
        createWorkOrder: async (itemId, qty) => { await rpc('create_work_order', { p_order_item_id: itemId, p_qty_planned: qty }); },
    };
}
