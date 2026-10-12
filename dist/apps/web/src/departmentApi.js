export function createDepartmentApi(client, session, hub) {
    return {
        workOrders: () => hub.list(),
        stockLots: () => client.select('stock_lots', { columns: 'id,work_order_id,qty,state,created_at', order: 'created_at.desc', limit: 500 }, session),
    };
}
