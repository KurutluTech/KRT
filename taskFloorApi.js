export function createTaskFloorApi(client, session) {
    return {
        floor: (scope) => client.rpc('task_floor', { p_scope: scope }, session),
        people: () => client.rpc('task_assignable_people', {}, session),
        create: (t) => client.rpc('create_task', { p_title: t.title, p_description: t.description || null, p_assignee_user: t.assigneeUser, p_assignee_role: t.assigneeRole, p_starts_at: null,
            p_due_at: t.dueAt, p_source_type: t.sourceType, p_source_id: t.sourceId, p_requires_evidence: t.requiresEvidence, p_client_request_id: t.clientRequestId }, session),
        start: (id) => client.rpc('start_task', { p_task_id: id }, session),
        complete: (id, note, evidenceRef) => client.rpc('complete_task', { p_task_id: id, p_note: note, p_evidence_ref: evidenceRef || null }, session),
        approve: (id, note) => client.rpc('approve_task', { p_task_id: id, p_note: note }, session),
        reopen: (id, reason) => client.rpc('reopen_task', { p_task_id: id, p_reason: reason }, session),
        cancel: (id, reason) => client.rpc('cancel_task', { p_task_id: id, p_reason: reason }, session),
    };
}
