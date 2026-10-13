/** Real implementation: calls the live kmi_next work-order RPCs/table through the data-client. */
export function createWorkOrdersApi(client, session) {
    return {
        async listForOrderItem(orderItemId) {
            return client.select('work_orders', {
                columns: 'id,order_item_id,machine_id,operator_id,status,qty_planned,qty_produced,qty_scrap,created_at',
                filters: { order_item_id: `eq.${orderItemId}` },
                order: 'created_at.desc',
            }, session);
        },
        async create(orderItemId, qtyPlanned) {
            return client.rpc('create_work_order', { p_order_item_id: orderItemId, p_qty_planned: qtyPlanned }, session);
        },
        async assignMachine(workOrderId, machineId) {
            return client.rpc('assign_work_order_machine', { p_work_order_id: workOrderId, p_machine_id: machineId }, session);
        },
        async assignOperator(workOrderId, personId) {
            return client.rpc('assign_work_order_operator', { p_work_order_id: workOrderId, p_person_id: personId }, session);
        },
        async transition(workOrderId, toStatus, reason) {
            return client.rpc('transition_work_order_status', { p_work_order_id: workOrderId, p_to_status: toStatus, p_reason: reason }, session);
        },
    };
}
