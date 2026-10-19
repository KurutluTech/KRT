export function createTerminalApi(client, session) {
    return {
        machines: () => client.rpc('machine_eligibility', {}, session),
        terminal: (machineId) => client.rpc('operator_terminal', { p_machine_id: machineId }, session),
        async start(id, rid) {
            await client.rpc('wo_start_run', { p_work_order_id: id, p_client_request_id: rid }, session);
        },
        async finish(id, good, scrap, tashih, note, rid) {
            await client.rpc('wo_finish_run', { p_work_order_id: id, p_qty_good: good, p_qty_scrap: scrap, p_qty_tashih: tashih, p_note: note, p_client_request_id: rid }, session);
        },
        async opStart(opId, machineId, operatorId, rid) {
            await client.rpc('op_start_run', { p_operation_id: opId, p_machine_id: machineId, p_operator_id: operatorId, p_client_request_id: rid }, session);
        },
        async opDeclare(opId, good, scrap, rid, tashih) {
            await client.rpc('declare_operation_output', tashih && tashih > 0
                ? { p_operation_id: opId, p_good: good, p_scrap: scrap, p_qty_tashih: tashih, p_client_request_id: rid }
                : { p_operation_id: opId, p_good: good, p_scrap: scrap, p_client_request_id: rid }, session);
        },
        async opReportTashihCause(opId, c, rid) {
            await client.rpc('report_operation_tashih_cause', { p_operation_id: opId, p_kind: c.kind, p_characteristic_code: c.characteristicCode ?? '', p_feature: c.feature, p_nominal: c.nominal ?? null, p_tol_lower: c.tolLower ?? null,
                p_tol_upper: c.tolUpper ?? null, p_measured: c.measured ?? null, p_qty: c.qty, p_note: c.note ?? null, p_client_request_id: rid }, session);
        },
        async opFinish(opId, rid) {
            await client.rpc('op_finish_run', { p_operation_id: opId, p_client_request_id: rid }, session);
        },
        async requestFirstPiece(id) {
            await client.rpc('transition_work_order_status', { p_work_order_id: id, p_to_status: 'FIRST_PIECE_PENDING', p_reason: 'terminal' }, session);
        },
        async declare(id, good, scrap, rid) {
            await client.rpc('declare_production_idempotent', { p_work_order_id: id, p_qty_good: good, p_qty_scrap: scrap, p_is_first_piece: false, p_client_request_id: rid }, session);
        },
        async hold(machineId, reason, category) {
            await client.rpc('set_machine_hold_categorized', { p_machine_id: machineId, p_reason: reason, p_category: category }, session);
        },
        async resume(machineId, reason) {
            await client.rpc('resume_machine_from_hold', { p_machine_id: machineId, p_reason: reason }, session);
        },
        async toolChange(machineId, workOrderId, toolCode, rid) {
            await client.rpc('report_operator_tool_event', { p_machine_id: machineId, p_work_order_id: workOrderId, p_kind: 'CHANGE', p_tool_code: toolCode, p_note: null, p_client_request_id: rid }, session);
        },
        async reportTashihCause(workOrderId, c, rid) {
            await client.rpc('report_tashih_cause', { p_work_order_id: workOrderId, p_kind: c.kind, p_characteristic_code: c.characteristicCode ?? '', p_feature: c.feature, p_nominal: c.nominal ?? null, p_tol_lower: c.tolLower ?? null,
                p_tol_upper: c.tolUpper ?? null, p_measured: c.measured ?? null, p_qty: c.qty, p_note: c.note ?? null, p_client_request_id: rid }, session);
        },
        async declareTashih(workOrderId, qty, reasonText, rid) {
            await client.rpc('open_tahsis_ncr', { p_work_order_id: workOrderId, p_qty: qty, p_reason: reasonText, p_detection_source: 'OPERATOR_SELF_DECLARED', p_client_request_id: rid }, session);
        },
        async reportFault(machineId, reason) {
            await client.rpc('report_machine_fault', { p_machine_id: machineId, p_reason: reason, p_severity: 'MEDIUM' }, session);
        },
    };
}
