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
        async move(workOrderId, stockLotId, kind, qty, clientRequestId) {
            await client.rpc('record_material_movement', { p_work_order_id: workOrderId, p_stock_lot_id: stockLotId, p_kind: kind, p_qty: qty, p_client_request_id: clientRequestId }, session);
        },
    };
}
