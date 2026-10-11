export function createReadinessApi(client, session) {
    return {
        async readiness(workOrderId) {
            return client.rpc('work_order_readiness', { p_work_order_id: workOrderId }, session);
        },
        async grantExemption(workOrderId, kind, reason) {
            await client.rpc('grant_readiness_exemption', { p_work_order_id: workOrderId, p_kind: kind, p_reason: reason }, session);
        },
    };
}
