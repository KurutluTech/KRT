export function createTahsisApi(client, session) {
    return {
        cases: () => client.select('quality_ncrs', { columns: 'id,work_order_id,qty,reason,status,kind,detection_source,opened_at', filters: { kind: 'eq.TAHSIS' }, order: 'opened_at.desc', limit: 200 }, session),
        characteristics: (ncrId) => client.select('quality_ncr_characteristics', { columns: 'id,operation_no,characteristic_code,feature,nominal,tol_lower,tol_upper,measured,oversize_excess,unit,qty,machine_id,tool_id,operator_id,evidence_ref,instructions,recorded_at', filters: { ncr_id: `eq.${ncrId}` }, order: 'recorded_at.asc', limit: 200 }, session),
        workOrders: async () => (await client.select('work_orders', { columns: 'id,status,qty_produced', filters: { status: 'in.(IN_PROGRESS,FIRST_PIECE_PENDING,FIRST_PIECE_APPROVED,ON_HOLD)' }, order: 'created_at.desc', limit: 200 }, session)).map((w) => ({ id: w.id, label: `İE ${w.id.slice(0, 8)} · ${w.status} · üretilen ${w.qtyProduced}` })),
        revisionOf: async (id) => (await client.select('work_orders', { columns: 'product_revision_id', filters: { id: `eq.${id}` }, limit: 1 }, session))[0]?.productRevisionId ?? null,
        machines: async () => (await client.select('machines', { columns: 'id,code', order: 'code.asc', limit: 200 }, session)).map((m) => ({ id: m.id, label: m.code })),
        tools: async () => (await client.select('tools', { columns: 'id,code', order: 'code.asc', limit: 500 }, session)).map((m) => ({ id: m.id, label: m.code })),
        people: async () => (await client.select('personnel', { columns: 'id,name', filters: { active: 'eq.true' }, order: 'name.asc', limit: 500 }, session)).map((m) => ({ id: m.id, label: m.name })),
        async open(workOrderId, qty, reason, source) { await client.rpc('open_tahsis_ncr', { p_work_order_id: workOrderId, p_qty: qty, p_reason: reason, p_detection_source: source, p_client_request_id: crypto.randomUUID() }, session); },
        async addCharacteristic(ncrId, revisionId, c) {
            await client.rpc('add_tahsis_characteristic', { p_ncr_id: ncrId, p_product_revision_id: revisionId, p_operation_no: c.operationNo, p_characteristic_code: c.code, p_feature: c.feature || null, p_nominal: c.nominal, p_tol_lower: c.tolLower, p_tol_upper: c.tolUpper, p_measured: c.measured, p_qty: c.qty, p_machine_id: c.machineId, p_tool_id: c.toolId, p_operator_id: c.operatorId, p_evidence_ref: c.evidenceRef || null, p_instructions: c.instructions || null }, session);
        },
        async transition(ncrId, to, reason) { await client.rpc('transition_quality_ncr', { p_ncr_id: ncrId, p_to_status: to, p_reason: reason }, session); },
    };
}
