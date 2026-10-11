/** Real implementation: calls the live kmi_next commercial-approval RPCs/table through the data-client. */
export function createCommercialApprovalApi(client, session) {
    return {
        async listForStockLot(stockLotId) {
            return client.select('commercial_approvals', {
                columns: 'id,stock_lot_id,status,requested_at,management_released_at',
                filters: { stock_lot_id: `eq.${stockLotId}` },
                order: 'requested_at.desc',
            }, session);
        },
        async request(stockLotId) {
            return client.rpc('request_commercial_approval', { p_stock_lot_id: stockLotId }, session);
        },
        async grantManagementRelease(approvalId, reason) {
            return client.rpc('grant_management_release', { p_approval_id: approvalId, p_reason: reason }, session);
        },
        async decide(approvalId, decision, reason) {
            return client.rpc('decide_commercial_approval', { p_approval_id: approvalId, p_decision: decision, p_reason: reason }, session);
        },
        async stageForShipment(stockLotId, approvalId) {
            return client.rpc('stage_stock_lot_for_shipment', { p_stock_lot_id: stockLotId, p_approval_id: approvalId }, session);
        },
    };
}
