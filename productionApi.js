export function createProductionApi(client, session) {
    return {
        async declareProduction(workOrderId, qtyGood, qtyScrap, isFirstPiece) {
            return client.rpc('declare_production', { p_work_order_id: workOrderId, p_qty_good: qtyGood, p_qty_scrap: qtyScrap, p_is_first_piece: isFirstPiece }, session);
        },
        async openQualityHold(workOrderId, reason) {
            return client.rpc('open_quality_hold', { p_work_order_id: workOrderId, p_reason: reason }, session);
        },
        async releaseQualityHold(holdId, releaseReason) {
            return client.rpc('release_quality_hold', { p_hold_id: holdId, p_release_reason: releaseReason }, session);
        },
        async listHoldsForWorkOrder(workOrderId) {
            return client.select('quality_holds', { columns: 'id,work_order_id,reason,status,opened_at', filters: { work_order_id: `eq.${workOrderId}` }, order: 'opened_at.desc' }, session);
        },
        async createProductionCorrection(workOrderId, qtyGoodDelta, qtyScrapDelta, reason, clientRequestId = null) {
            return client.rpc('create_production_correction', {
                p_work_order_id: workOrderId,
                p_qty_good_delta: qtyGoodDelta,
                p_qty_scrap_delta: qtyScrapDelta,
                p_reason: reason,
                p_client_request_id: clientRequestId,
            }, session);
        },
        async listNcrs(workOrderId) {
            return client.select('quality_ncrs', { columns: 'id,work_order_id,qty,reason,status', filters: { work_order_id: `eq.${workOrderId}` }, order: 'opened_at.asc' }, session);
        },
        async openNcr(workOrderId, qty, reason, clientRequestId) {
            return client.rpc('open_quality_ncr', { p_work_order_id: workOrderId, p_qty: qty, p_reason: reason, p_client_request_id: clientRequestId }, session);
        },
        async transitionNcr(ncrId, toStatus, reason) {
            return client.rpc('transition_quality_ncr', { p_ncr_id: ncrId, p_to_status: toStatus, p_reason: reason }, session);
        },
    };
}
