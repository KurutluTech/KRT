const inList = (ids) => `in.(${ids.join(',')})`;
export function createAccountingQueueApi(client, session) {
    const LOT_COLS = 'id,work_order_id,qty,state';
    const withProducts = async (rows) => {
        const out = rows.map((r) => ({ ...r, productCode: null }));
        if (out.length === 0)
            return out;
        try { // product code is a convenience label; if any hop fails the lot is shown by id
            const wos = await client.select('work_orders', { columns: 'id,order_item_id', filters: { id: inList([...new Set(rows.map((r) => r.workOrderId))]) } }, session);
            const items = await client.select('order_items', { columns: 'id,product_id', filters: { id: inList([...new Set(wos.map((w) => w.orderItemId))]) } }, session);
            const prods = await client.select('products', { columns: 'id,code', filters: { id: inList([...new Set(items.map((i) => i.productId))]) } }, session);
            for (const l of out) {
                const wo = wos.find((w) => w.id === l.workOrderId);
                const it = items.find((i) => i.id === wo?.orderItemId);
                l.productCode = prods.find((p) => p.id === it?.productId)?.code ?? null;
            }
        }
        catch { /* label only */ }
        return out;
    };
    return {
        approvals: () => client.select('commercial_approvals', { columns: 'id,stock_lot_id,status,requested_at,management_released_at,decided_at,decision_reason', order: 'requested_at.desc', limit: 200 }, session),
        async lots(ids) { return ids.length ? withProducts(await client.select('stock_lots', { columns: LOT_COLS, filters: { id: inList(ids) } }, session)) : []; },
        async availableLots() { return withProducts(await client.select('stock_lots', { columns: LOT_COLS, filters: { state: 'in.(AVAILABLE,RESERVED)' }, order: 'created_at.desc', limit: 200 }, session)); },
        async request(stockLotId) { await client.rpc('request_commercial_approval', { p_stock_lot_id: stockLotId }, session); },
        async grantManagementRelease(approvalId, reason) { await client.rpc('grant_management_release', { p_approval_id: approvalId, p_reason: reason }, session); },
        async decide(approvalId, decision, reason) { await client.rpc('decide_commercial_approval', { p_approval_id: approvalId, p_decision: decision, p_reason: reason }, session); },
    };
}
