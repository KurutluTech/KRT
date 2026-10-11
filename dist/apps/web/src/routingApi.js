export function createRoutingApi(client, session) {
    const call = async (fn, args) => { await client.rpc(fn, args, session); };
    return {
        matrix: () => client.rpc('machine_skill_matrix', {}, session),
        suggestAssignment: (op) => client.rpc('suggest_operation_assignment', { p_operation_id: op }, session),
        recordAssignment: (op, m, o, reason) => client.rpc('record_operation_assignment', { p_operation_id: op, p_machine_id: m, p_operator_id: o, p_reason: reason }, session),
        async routedWorkOrders() {
            const rows = await client.select('work_order_operations', { columns: 'work_order_id', order: 'work_order_id.asc' }, session);
            return [...new Set(rows.map((r) => r.workOrderId))];
        },
        workOrderRouting: (id) => client.rpc('work_order_routing', { p_work_order_id: id }, session),
        people: () => client.select('personnel', { columns: 'id,name,active', order: 'name.asc' }, session),
        revisions: () => client.select('product_revisions', { columns: 'id,revision,status,product_id', order: 'created_at.desc' }, session),
        routingDefs: (rev) => client.select('routing_operations', { columns: 'id,product_revision_id,op_no,name,allowed_machine_ids,required_skill_code,required_skill_level,first_piece_required,qc_required', filters: { product_revision_id: `eq.${rev}` }, order: 'op_no.asc' }, session),
        setRoutingOperation: (i) => call('set_routing_operation', { p_revision_id: i.revisionId, p_op_no: i.opNo, p_name: i.name, p_allowed_machine_ids: i.machineIds, p_skill_code: i.skillCode,
            p_skill_level: i.skillLevel, p_cam_program_id: null, p_setup_minutes: null, p_cycle_seconds: null, p_first_piece_required: i.firstPiece, p_qc_required: i.qc, p_instructions: null, p_reason: i.reason }),
        applyRouting: (id) => call('apply_routing_to_work_order', { p_work_order_id: id }),
        startRefusal: (op, m, o) => client.rpc('operation_start_refusal', { p_operation_id: op, p_machine_id: m, p_operator_id: o }, session),
        start: (op, m, o) => call('start_operation', { p_operation_id: op, p_machine_id: m, p_operator_id: o }),
        firstPiece: (op, approve, note) => call('decide_operation_first_piece', { p_operation_id: op, p_approve: approve, p_note: note }),
        declare: (op, g, s, id) => call('declare_operation_output', { p_operation_id: op, p_good: g, p_scrap: s, p_client_request_id: id }),
        finish: (op) => call('finish_operation_run', { p_operation_id: op }),
        qc: (op, r, note) => call('record_operation_qc', { p_operation_id: op, p_result: r, p_note: note }),
        setReview: (m, r, note) => call('set_machine_skill_review', { p_machine_id: m, p_review: r, p_note: note }),
        grantClearance: (p, m, d, reason) => call('grant_operator_machine_clearance', { p_personnel_id: p, p_machine_id: m, p_valid_days: d, p_reason: reason }),
    };
}
