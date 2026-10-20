import { fetchPilotFlags } from './pilotMark.js';
export function createWorkOrderHubApi(client, session) {
    return {
        async list() {
            const wos = await client.select('work_orders', { columns: 'id,order_item_id,status,qty_planned,qty_produced,qty_scrap,machine_id,operator_id,planned_date', order: 'created_at.desc', limit: 300 }, session);
            if (!wos.length)
                return [];
            const [items, orders, products] = await Promise.all([
                client.select('order_items', { columns: 'id,order_id,product_id,due_date', limit: 2000 }, session),
                client.select('orders', { columns: 'id,customer_po', limit: 2000 }, session),
                client.select('products', { columns: 'id,code,name', limit: 2000 }, session),
            ]);
            const pf = await fetchPilotFlags(client, session, wos.map((w) => w.id));
            const it = new Map(items.map((i) => [i.id, i]));
            const od = new Map(orders.map((o) => [o.id, o]));
            const pr = new Map(products.map((p) => [p.id, p]));
            return wos.map((w) => {
                const i = it.get(w.orderItemId);
                const p = i ? pr.get(i.productId) : undefined;
                return { ...w, productCode: p?.code ?? '?', productName: p?.name ?? '?', customerPo: (i && od.get(i.orderId)?.customerPo) || `İE ${w.id.slice(0, 8)}`, dueDate: i?.dueDate ?? null, ...(pf.has(w.id) ? { isPilot: true, pilotRetired: pf.retired(w.id) } : {}) };
            });
        },
        async readiness(id) {
            const wo = (await client.select('work_orders', { columns: 'order_item_id,product_revision_id,cam_program_id', filters: { id: `eq.${id}` } }, session))[0];
            if (!wo)
                throw new Error('WORK_ORDER_NOT_FOUND');
            const item = (await client.select('order_items', { columns: 'product_id', filters: { id: `eq.${wo.orderItemId}` } }, session))[0];
            const revisions = item ? await client.select('product_revisions', { columns: 'id,revision', filters: { product_id: `eq.${item.productId}`, status: 'eq.RELEASED' }, order: 'created_at.asc' }, session) : [];
            const programs = wo.productRevisionId ? await client.select('cam_programs', { columns: 'id,program_no,revision', filters: { product_revision_id: `eq.${wo.productRevisionId}`, status: 'eq.RELEASED' }, order: 'program_no.asc' }, session) : [];
            const exemptions = await client.select('work_order_readiness_exemptions', { columns: 'id,kind,reason', filters: { work_order_id: `eq.${id}`, revoked_at: 'is.null' } }, session);
            let startRefusal = null;
            try {
                const r = await client.rpc('work_order_start_preview', { p_work_order_id: id }, session);
                startRefusal = r ?? null;
            }
            catch {
                startRefusal = null;
            }
            return { revisionId: wo.productRevisionId, camProgramId: wo.camProgramId, revisions, programs, exemptions, startRefusal };
        },
        async readinessRows(id) { return client.rpc('work_order_readiness', { p_work_order_id: id }, session); },
        async setRevision(id, rev) { await client.rpc('set_work_order_revision', { p_work_order_id: id, p_revision_id: rev }, session); },
        async setCamProgram(id, prog) { await client.rpc('set_work_order_cam_program', { p_work_order_id: id, p_program_id: prog }, session); },
        async revokeExemption(id, reason) { await client.rpc('revoke_readiness_exemption', { p_exemption_id: id, p_reason: reason }, session); },
        async machines() {
            const ms = await client.select('machines', { columns: 'id,code,name', order: 'code.asc' }, session);
            const pf = await fetchPilotFlags(client, session, ms.map((m) => m.id));
            return ms.map((m) => (pf.has(m.id) ? { ...m, isPilot: true } : m));
        },
        operators: () => client.select('personnel', { columns: 'id,name', filters: { active: 'eq.true' }, order: 'name.asc' }, session),
        async snapshot(id) {
            const r = await client.select('work_orders', { columns: 'id,status,qty_planned,qty_produced,qty_scrap', filters: { id: `eq.${id}` } }, session);
            if (!r[0])
                throw new Error('WORK_ORDER_NOT_FOUND');
            return r[0];
        },
        async lotState(id) {
            const r = await client.select('stock_lots', { columns: 'state', filters: { id: `eq.${id}` } }, session);
            if (!r[0])
                throw new Error('STOCK_LOT_NOT_FOUND');
            return r[0].state;
        },
        async lotWorkOrder(id) {
            const r = await client.select('stock_lots', { columns: 'work_order_id', filters: { id: `eq.${id}` } }, session);
            if (!r[0])
                throw new Error('STOCK_LOT_NOT_FOUND');
            return r[0].workOrderId;
        },
    };
}
