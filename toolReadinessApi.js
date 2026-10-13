import { createReadinessApi } from './readinessApi.js';
export function createToolReadinessApi(client, session) {
    return {
        ...createReadinessApi(client, session),
        async status(workOrderId) {
            return client.rpc('work_order_tool_status', { p_work_order_id: workOrderId }, session);
        },
        async mountForWorkOrder(toolId, machineId, workOrderId, clientRequestId) {
            await client.rpc('transition_tool_location', { p_tool_id: toolId, p_to_location: 'MOUNTED', p_machine_id: machineId, p_work_order_id: workOrderId, p_client_request_id: clientRequestId }, session);
        },
    };
}
