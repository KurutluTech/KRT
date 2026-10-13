/** Real implementation: calls the live kmi_next RPCs/table through the data-client. */
export function createOrdersApi(client, session) {
    return {
        async list() {
            return client.select('orders', { columns: 'id,customer_id,customer_po,status,created_at', order: 'created_at.desc' }, session);
        },
        customers: () => client.select('customers', { columns: 'id,code,name,active', order: 'name.asc' }, session),
        products: () => client.select('products', { columns: 'id,code,name', order: 'code.asc' }, session),
        items: () => client.select('order_items', { columns: 'id,order_id,product_id,qty,due_date', order: 'due_date.asc' }, session),
        addItem: (orderId, productId, qty, unitPrice, dueDate, clientRequestId) => client.rpc('add_order_item', {
            p_order_id: orderId, p_product_id: productId, p_qty: qty, p_unit_price: unitPrice, p_due_date: dueDate, p_client_request_id: clientRequestId
        }, session),
        createWorkOrder: (orderItemId, qty) => client.rpc('create_work_order', { p_order_item_id: orderItemId, p_qty_planned: qty }, session),
        async create(customerId, customerPo) {
            return client.rpc('create_order', { p_customer_id: customerId, p_customer_po: customerPo }, session);
        },
        async transition(orderId, toStatus, reason) {
            return client.rpc('transition_order_status', { p_order_id: orderId, p_to_status: toStatus, p_reason: reason }, session);
        },
    };
}
