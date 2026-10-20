import { createReadinessApi } from './readinessApi.js';
export function createMaterialApi(client, session) {
    return {
        ...createReadinessApi(client, session),
        async getStatus(workOrderId) {
            const rows = await client.rpc('work_order_material_status', { p_work_order_id: workOrderId }, session);
            return rows.map((r) => ({
                ...r,
                required: Number(r.required),
                reserved: Number(r.reserved),
                issued: Number(r.issued),
                consumed: Number(r.consumed),
                covered: Number(r.covered),
                shortage: Number(r.shortage),
            }));
        },
        async autoReserve(workOrderId) {
            const r = await client.rpc('wo_reserve_materials', { p_wo: workOrderId }, session);
            const pick = (o, a, b) => o[a] ?? o[b];
            const list = (v) => (Array.isArray(v) ? v : []);
            return {
                reserved: list(r['reserved']).map((x) => ({ materialCode: String(pick(x, 'materialCode', 'material_code')), stockLotId: String(pick(x, 'stockLotId', 'stock_lot_id')), qty: Number(x['qty']) })),
                shortage: list(r['shortage']).map((x) => ({ materialCode: String(pick(x, 'materialCode', 'material_code')), missing: Number(x['missing']) })),
                complete: r['complete'] === true,
            };
        },
        async chain(workOrderId) {
            const r = await client.rpc('wo_material_chain', { p_wo: workOrderId }, session);
            const g = (o, a, b) => o[a] ?? o[b];
            const n = (v) => (v === null || v === undefined ? null : Number(v));
            const mats = Array.isArray(r['materials']) ? r['materials'] : [];
            return {
                qtyPlanned: Number(g(r, 'qtyPlanned', 'qty_planned') ?? 0),
                qtyGoodLastOp: Number(g(r, 'qtyGoodLastOp', 'qty_good_last_op') ?? 0),
                qtyScrapAllOps: Number(g(r, 'qtyScrapAllOps', 'qty_scrap_all_ops') ?? 0),
                materials: mats.map((m) => ({
                    materialCode: String(g(m, 'materialCode', 'material_code')),
                    barsRequired: Number(g(m, 'barsRequired', 'bars_required')), barsReserved: Number(g(m, 'barsReserved', 'bars_reserved')),
                    barsInHand: Number(g(m, 'barsInHand', 'bars_in_hand')), barsCut: Number(g(m, 'barsCut', 'bars_cut')), shortage: Number(m['shortage']),
                    barSpec: g(m, 'barSpec', 'bar_spec') === true, piecesPerBar: n(g(m, 'piecesPerBar', 'pieces_per_bar')), cutCapacityPieces: n(g(m, 'cutCapacityPieces', 'cut_capacity_pieces')),
                    exceedsCutCapacity: g(m, 'exceedsCutCapacity', 'exceeds_cut_capacity') === null || g(m, 'exceedsCutCapacity', 'exceeds_cut_capacity') === undefined ? null : g(m, 'exceedsCutCapacity', 'exceeds_cut_capacity') === true,
                })),
                note: String(r['note'] ?? ''),
            };
        },
        async move(workOrderId, stockLotId, kind, qty, clientRequestId) {
            await client.rpc('record_material_movement', { p_work_order_id: workOrderId, p_stock_lot_id: stockLotId, p_kind: kind, p_qty: qty, p_client_request_id: clientRequestId }, session);
        },
    };
}
