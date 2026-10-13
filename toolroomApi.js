/** Real implementation: calls the live kmi_next toolroom RPCs/tables through the data-client. */
export function createToolroomApi(client, session) {
    return {
        operatorEvents: () => client.rpc('toolroom_operator_tool_events', { p_days: 7 }, session),
        async listTools() {
            return client.select('tools', { columns: 'id,code,tool_type,location,machine_id,issued_to_personnel_id,life_minutes_used,life_minutes_rated', order: 'code.asc' }, session);
        },
        async mount(toolId, machineId, workOrderId, clientRequestId) {
            return client.rpc('transition_tool_location', { p_tool_id: toolId, p_to_location: 'MOUNTED', p_machine_id: machineId, p_work_order_id: workOrderId ?? null, p_client_request_id: clientRequestId ?? null }, session);
        },
        async unmount(toolId, reason) {
            return client.rpc('transition_tool_location', { p_tool_id: toolId, p_to_location: 'CABINET', p_reason: reason ?? null }, session);
        },
        async issue(toolId, personnelId) {
            return client.rpc('transition_tool_location', { p_tool_id: toolId, p_to_location: 'ISSUED', p_personnel_id: personnelId }, session);
        },
        async returnTool(toolId) {
            return client.rpc('transition_tool_location', { p_tool_id: toolId, p_to_location: 'CABINET' }, session);
        },
        async scrap(toolId, reason) {
            return client.rpc('transition_tool_location', { p_tool_id: toolId, p_to_location: 'SCRAP', p_reason: reason }, session);
        },
        async recordWear(toolId, additionalMinutes) {
            return client.rpc('record_tool_wear', { p_tool_id: toolId, p_additional_minutes: additionalMinutes }, session);
        },
    };
}
