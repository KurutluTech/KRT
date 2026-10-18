const num = (v) => Number(v);
const numOrNull = (v) => (v === null || v === undefined ? null : Number(v));
export function createPlanCockpitApi(client, session) {
    return {
        async blocks(from, to) {
            const rows = await client.rpc('plan_blocks', { p_from: from, p_to: to }, session);
            return rows.map((r) => ({ ...r, qtyPlanned: num(r.qtyPlanned), qtyProduced: num(r.qtyProduced), qtyScrap: num(r.qtyScrap), plannedMinutes: numOrNull(r.plannedMinutes), estMinutes: numOrNull(r.estMinutes),
                openNcrQty: num(r.openNcrQty), actualRunMinutes: numOrNull(r.actualRunMinutes) }));
        },
        async slots(from, to) {
            const rows = await client.rpc('plan_slot_capacity', { p_from: from, p_to: to }, session);
            return rows.map((r) => ({ ...r, shiftMinutes: num(r.shiftMinutes), capacityMinutes: num(r.capacityMinutes), plannedMinutes: num(r.plannedMinutes), plannedWoCount: num(r.plannedWoCount),
                unknownMinutesWoCount: num(r.unknownMinutesWoCount), runMinutes: numOrNull(r.runMinutes) }));
        },
        async operators(from, to) {
            const rows = await client.rpc('plan_operator_load', { p_from: from, p_to: to }, session);
            return rows.map((r) => ({ ...r, machinesPlanned: num(r.machinesPlanned), plannedMinutes: num(r.plannedMinutes), maxMachines: num(r.maxMachines) }));
        },
        async decisions(limit) {
            const rows = await client.select('work_order_plan_decisions', { columns: 'id,work_order_id,machine_id,operator_id,planned_date,planned_shift_code,planned_minutes,followed_suggestion,warnings,reason,decided_at', order: 'decided_at.desc', limit }, session);
            return rows.map((r) => ({ ...r, plannedMinutes: num(r.plannedMinutes), warnings: Array.isArray(r.warnings) ? r.warnings : [] }));
        },
        async replan(i) {
            await client.rpc('plan_replan', { p_work_order_id: i.workOrderId, p_machine_id: i.machineId, p_operator_id: i.operatorId, p_planned_date: i.plannedDate, p_shift_code: i.shiftCode, p_planned_minutes: i.plannedMinutes, p_reason: i.reason }, session);
        },
        async scenarios() {
            const rows = await client.rpc('plan_scenarios_list', {}, session);
            return (rows ?? []).map((s) => ({ ...s, moves: (s.moves ?? []).map((m) => ({ ...m, plannedMinutes: num(m.plannedMinutes) })) }));
        },
        async scenarioCreate(name, note) {
            const r = await client.rpc('plan_scenario_create', { p_name: name, p_note: note }, session);
            return r.id;
        },
        async scenarioSetMove(m) {
            await client.rpc('plan_scenario_set_move', { p_scenario: m.scenarioId, p_work_order_id: m.workOrderId, p_machine_id: m.machineId, p_operator_id: m.operatorId, p_planned_date: m.plannedDate, p_shift_code: m.shiftCode, p_planned_minutes: m.plannedMinutes, p_reason: m.reason }, session);
        },
        async scenarioRemoveMove(scenarioId, workOrderId) { await client.rpc('plan_scenario_remove_move', { p_scenario: scenarioId, p_work_order_id: workOrderId }, session); },
        async scenarioEvaluate(scenarioId) { return client.rpc('plan_scenario_evaluate', { p_scenario: scenarioId }, session); },
        async scenarioApply(scenarioId, reason) { await client.rpc('plan_scenario_apply', { p_scenario: scenarioId, p_reason: reason }, session); },
        async scenarioDiscard(scenarioId, reason) { await client.rpc('plan_scenario_discard', { p_scenario: scenarioId, p_reason: reason }, session); },
        async createTask(workOrderId, title, description, requestId) {
            await client.rpc('create_task', { p_title: title, p_description: description, p_assignee_user: null, p_assignee_role: 'MANAGEMENT', p_starts_at: null, p_due_at: null, p_source_type: 'WORK_ORDER', p_source_id: workOrderId, p_requires_evidence: false, p_client_request_id: requestId }, session);
        },
    };
}
