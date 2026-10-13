const crid = () => crypto.randomUUID();
export function createManagementApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    const sel = (table, columns, filters, limit = 1000) => client.select(table, { columns, ...(filters ? { filters } : {}), limit }, session);
    return {
        kpiSnapshot: (from, to) => rpc('management_kpi_snapshot', { p_from: from, p_to: to }),
        strategy: (period) => rpc('management_strategy_overview', { p_period: period }),
        risks: () => rpc('management_risk_register', {}),
        meetings: () => rpc('management_meetings', {}),
        recHistory: () => rpc('management_recommendation_history', {}),
        owners: async () => (await sel('personnel', 'id,name', { active: 'eq.true' }, 500)).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
        async peopleData() {
            const [people, skills, cat, reqs, machines, academy, awards] = await Promise.all([
                sel('personnel', 'id,name,department,active,shift_code', undefined, 1000),
                sel('personnel_skills', 'personnel_id,skill_code,level,valid_until', undefined, 5000),
                sel('skill_catalog', 'code,name', undefined, 500),
                sel('machine_skill_requirements', 'machine_id,skill_code,min_level', undefined, 2000),
                sel('machines', 'id,code', undefined, 500),
                sel('academy_enrollments', 'status', undefined, 5000),
                sel('badge_awards', 'tier', undefined, 5000),
            ]);
            const code = new Map(machines.map((m) => [m.id, m.code]));
            const badgeTiers = {};
            for (const a of awards)
                badgeTiers[String(a.tier)] = (badgeTiers[String(a.tier)] ?? 0) + 1;
            return { people, skills, reqs: reqs.map((r) => ({ machineId: r.machineId, machineCode: code.get(r.machineId) ?? r.machineId.slice(0, 8), skillCode: r.skillCode, minLevel: r.minLevel })), skillNames: Object.fromEntries(cat.map((c) => [c.code, c.name])), academy, badgeTiers };
        },
        async createObjective(i) { await rpc('create_objective', { p_perspective: i.perspective, p_title: i.title, p_description: i.description || null, p_owner: i.ownerId, p_from: i.from, p_to: i.to, p_client_request_id: crid() }); },
        async setObjectiveStatus(id, status, reason) { await rpc('set_objective_status', { p_objective_id: id, p_status: status, p_reason: reason }); },
        async createKpi(i) { await rpc('create_kpi', { p_objective_id: i.objectiveId, p_name: i.name, p_unit: i.unit, p_direction: i.direction, p_target: i.target, p_baseline: i.baseline, p_source_kind: i.sourceKind, p_system_metric: i.systemMetric, p_client_request_id: crid() }); },
        async recordReading(i) { await rpc('record_kpi_reading', { p_kpi_id: i.kpiId, p_period: i.period, p_actual: i.actual, p_source: i.source, p_evidence_ref: i.evidenceRef || null, p_note: i.note || null, p_client_request_id: crid() }); },
        async createAction(i) { await rpc('create_mgmt_action', { p_objective_id: i.objectiveId, p_risk_id: i.riskId, p_title: i.title, p_owner: i.ownerId, p_due: i.due, p_client_request_id: crid() }); },
        async setActionStatus(id, status, note) { await rpc('set_mgmt_action_status', { p_action_id: id, p_status: status, p_result_note: note || null }); },
        async createRisk(i) { await rpc('create_risk', { p_title: i.title, p_category: i.category, p_description: i.description || null, p_likelihood: i.likelihood, p_impact: i.impact, p_owner: i.ownerId, p_review_date: i.reviewDate, p_client_request_id: crid() }); },
        async reassessRisk(i) { await rpc('reassess_risk', { p_risk_id: i.id, p_likelihood: i.likelihood, p_impact: i.impact, p_status: i.status, p_review_date: i.reviewDate, p_reason: i.reason }); },
        async createMeeting(i) { return rpc('create_meeting', { p_held_at: i.heldAt, p_title: i.title, p_kind: i.kind, p_attendees: i.attendeeIds, p_agenda: i.agenda || null, p_minutes: i.minutes || null, p_client_request_id: crid() }); },
        async addDecision(i) { await rpc('add_meeting_decision', { p_meeting_id: i.meetingId, p_text: i.text, p_owner: i.ownerId, p_due: i.due, p_linked_type: i.linkedType, p_linked_id: i.linkedId, p_client_request_id: crid() }); },
        async setDecisionStatus(id, status, note) { await rpc('set_decision_status', { p_decision_id: id, p_status: status, p_follow_up_note: note }); },
        async recordRecommendation(i) { await rpc('record_recommendation_decision', { p_rec_key: i.key, p_rule_code: i.rule, p_decision: i.decision, p_note: i.note, p_postponed_until: i.until, p_evidence: i.evidence }); },
    };
}
