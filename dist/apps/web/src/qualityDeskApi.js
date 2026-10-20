import { createRoutingApi } from './routingApi.js';
import { createProductionApi } from './productionApi.js';
import { createPurchasingApi } from './purchasingApi.js';
import { createWorkOrdersApi } from './workOrdersApi.js';
import { createWorkOrderHubApi } from './workOrderHubApi.js';
import { fetchPilotFlags } from './pilotMark.js';
const attempt = async (f) => { try {
    return await f();
}
catch {
    return null;
} };
export function createQualityDeskApi(c, s) {
    const routing = createRoutingApi(c, s), prod = createProductionApi(c, s), pur = createPurchasingApi(c, s), wos = createWorkOrdersApi(c, s), hub = createWorkOrderHubApi(c, s);
    return {
        async load() {
            const [workOrders, ops, holds, ncrs, opTashih, receipts, machines, people] = await Promise.all([
                attempt(() => hub.list()),
                attempt(() => c.select('work_order_operations', { columns: 'id,work_order_id,op_no,name,status,machine_id,operator_id,started_at,run_finished_at,qty_in,qty_good,qty_scrap', order: 'work_order_id.asc', limit: 5000 }, s)),
                attempt(() => c.select('quality_holds', { columns: 'id,work_order_id,reason,status,opened_at,released_at,release_reason', order: 'opened_at.desc', limit: 400 }, s)),
                attempt(async () => { try {
                    return await c.select('quality_ncrs', { columns: 'id,work_order_id,qty,reason,status,opened_at,operation_id,parent_ncr_id', order: 'opened_at.desc', limit: 400 }, s);
                }
                catch {
                    return c.select('quality_ncrs', { columns: 'id,work_order_id,qty,reason,status,opened_at', order: 'opened_at.desc', limit: 400 }, s);
                } }),
                attempt(async () => (await c.rpc('operation_tashih_queue', {}, s)) ?? []),
                attempt(() => c.select('goods_receipts', { columns: 'id,stock_lot_id,qty_received,received_at,qc_decision', filters: { qc_decision: 'is.null' }, order: 'received_at.asc', limit: 300 }, s)),
                attempt(() => hub.machines()), attempt(() => hub.operators()),
            ]);
            let incoming = null;
            if (receipts) {
                const lots = await attempt(() => c.select('stock_lots', { columns: 'id,state', filters: { state: 'eq.HOLD' }, limit: 1000 }, s));
                incoming = lots ? receipts.filter((r) => r.stockLotId).map((r) => ({ receiptId: r.id, stockLotId: r.stockLotId, qty: r.qtyReceived, receivedAt: r.receivedAt, lotState: lots.some((l) => l.id === r.stockLotId) ? 'HOLD' : 'DECIDED' })) : null;
            }
            const woIds = [...(workOrders ?? []).map((w) => w.id), ...(ops ?? []).map((o) => o.workOrderId), ...(holds ?? []).map((x) => x.workOrderId), ...(ncrs ?? []).map((x) => x.workOrderId), ...(opTashih ?? []).map((r) => r.workOrderId)];
            const pf = await fetchPilotFlags(c, s, woIds);
            const pilot = new Set(woIds.filter((id) => pf.has(id)));
            return { pilot, workOrders: workOrders, ops, holds, ncrs, incoming, machines: new Map((machines ?? []).map((m) => [m.id, m.code])), people: new Map((people ?? []).map((p) => [p.id, p.name])), opTashih };
        },
        firstPiece: (op, ok, note) => routing.firstPiece(op, ok, note),
        qc: (op, r, note) => routing.qc(op, r, note),
        releaseHold: async (id, reason) => { await prod.releaseQualityHold(id, reason); },
        openHold: async (wo, reason) => { await prod.openQualityHold(wo, reason); },
        openNcr: async (wo, qty, reason, rid) => { await prod.openNcr(wo, qty, reason, rid); },
        moveNcr: async (id, to, reason) => { await prod.transitionNcr(id, to, reason); },
        splitNcr: async (id, qty, reason) => { await c.rpc('split_quality_ncr', { p_ncr_id: id, p_split_qty: qty, p_reason: reason }, s); },
        openOperationCase: async (op, qty, reason, src) => { await c.rpc('open_operation_tahsis_ncr', { p_operation_id: op, p_qty: qty, p_reason: reason, p_detection_source: src, p_client_request_id: crypto.randomUUID() }, s); },
        incomingDecision: async (lot, d, reason) => { await pur.recordIncomingQualityDecision(lot, d, reason || undefined); },
        finalRelease: async (wo, reason) => { await wos.transition(wo, 'COMPLETED', reason); },
    };
}
