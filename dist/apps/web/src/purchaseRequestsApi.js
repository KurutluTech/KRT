export function createPurchaseRequestsApi(client, session) {
    return {
        async list() {
            return client.select('purchase_requests', { columns: 'id,material_code,qty,reason,status,source_work_order_id', order: 'requested_at.desc' }, session);
        },
        async create(materialCode, qty, reason, neededBy) {
            return client.rpc('create_purchase_request', { p_material_code: materialCode, p_qty: qty, p_reason: reason, ...(neededBy ? { p_needed_by: neededBy } : {}) }, session);
        },
        async materials() {
            const [pm, pr] = await Promise.all([
                client.select('product_master', { columns: 'material', limit: 2000 }, session).catch(() => []),
                client.select('purchase_requests', { columns: 'material_code', limit: 2000 }, session).catch(() => []),
            ]);
            return [...new Set([...pm.map((x) => x.material ?? ''), ...pr.map((x) => x.materialCode)].map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
        },
        async suppliers() {
            const r = await client.select('suppliers', { columns: 'id,name,active', order: 'name.asc' }, session);
            return r.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name }));
        },
        async openWorkOrders() {
            const wos = await client.select('work_orders', { columns: 'id,order_item_id,status,qty_planned', order: 'created_at.desc', limit: 300 }, session);
            const open = wos.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED');
            if (!open.length)
                return [];
            const [items, orders, products] = await Promise.all([
                client.select('order_items', { columns: 'id,order_id,product_id', limit: 2000 }, session),
                client.select('orders', { columns: 'id,customer_po', limit: 2000 }, session),
                client.select('products', { columns: 'id,code', limit: 2000 }, session),
            ]);
            const it = new Map(items.map((i) => [i.id, i]));
            const od = new Map(orders.map((o) => [o.id, o.customerPo]));
            const pr = new Map(products.map((x) => [x.id, x.code]));
            return open.map((w) => { const i = it.get(w.orderItemId); return { id: w.id, label: `${(i && od.get(i.orderId)) || `İş emri ${w.id.slice(0, 6)}`} · ${(i && pr.get(i.productId)) || 'ürün'} · ${w.qtyPlanned} adet` }; });
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
