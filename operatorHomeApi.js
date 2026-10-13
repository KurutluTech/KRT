export function createOperatorHomeApi(client, session) {
    return {
        home: () => client.rpc('operator_home', {}, session),
        daySummary: () => client.rpc('operator_day_summary', { p_date: null }, session),
        async confirmShiftEnd(note) {
            await client.rpc('confirm_shift_end', { p_date: null, p_note: note || null }, session);
        },
        async toolEvent(machineId, workOrderId, kind, toolCode, note, rid) {
            await client.rpc('report_operator_tool_event', { p_machine_id: machineId, p_work_order_id: workOrderId, p_kind: kind, p_tool_code: toolCode, p_note: note || null, p_client_request_id: rid }, session);
        },
    };
}
