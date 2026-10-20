// Fail-closed work-order readiness (migration 0021) — shared by the material and tool screens.
// The server function kmi_next.work_order_readiness is the ONE source; screens never decide
// "nothing needed" themselves.
import { fetchPilotFlags } from './pilotMark.js';
export function createReadinessApi(client, session) {
    return {
        isPilot: async (workOrderId) => (await fetchPilotFlags(client, session, [workOrderId])).has(workOrderId),
        async readiness(workOrderId) {
            return client.rpc('work_order_readiness', { p_work_order_id: workOrderId }, session);
        },
        async grantExemption(workOrderId, kind, reason) {
            await client.rpc('grant_readiness_exemption', { p_work_order_id: workOrderId, p_kind: kind, p_reason: reason }, session);
        },
    };
}
