export function createPlanningApi(client, session) {
    return {
        async board() {
            const rows = await client.rpc('planning_board', {}, session);
            return rows.map((r) => ({ ...r, qtyPlanned: Number(r.qtyPlanned), plannedMinutes: r.plannedMinutes === null ? null : Number(r.plannedMinutes), openNcrQty: Number(r.openNcrQty) }));
        },
        async load(from, to) {
            const rows = await client.rpc('machine_shift_load', { p_from: from, p_to: to }, session);
            return rows.map((r) => ({ ...r, plannedMinutes: Number(r.plannedMinutes) }));
        },
        async machines() {
            return client.rpc('machine_eligibility', {}, session);
        },
        async operators() {
            return client.select('personnel', { columns: 'id,name,active,roles,shift_code', order: 'name.asc' }, session);
        },
        async suggestOperators(workOrderId, machineId, date, shiftCode) {
            const rows = await client.rpc('suggest_operators', { p_work_order_id: workOrderId, p_machine_id: machineId, p_date: date, p_shift_code: shiftCode }, session);
            return rows.map((r) => ({ ...r, scrapRate: r.scrapRate === null ? null : Number(r.scrapRate), loadMinutes: Number(r.loadMinutes) }));
        },
        async commit(p) {
            await client.rpc('commit_work_order_plan', {
                p_work_order_id: p.workOrderId,
                p_machine_id: p.machineId,
                p_operator_id: p.operatorId,
                p_planned_date: p.plannedDate,
                p_shift_code: p.shiftCode,
                p_planned_minutes: p.plannedMinutes,
                p_followed_suggestion: p.followedSuggestion,
                p_reason: p.reason,
            }, session);
        },
    };
}
