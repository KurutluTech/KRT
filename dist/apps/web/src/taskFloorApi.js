// Task Floor adapter — migration 0058. Keys arrive camelCased from the data-client.
import { isSetupPending } from './errorText.js';
export function createTaskFloorApi(client, session) {
    let historyMissing = false;
    let evidenceMissing = false;
    let qrMissing = false; // schema capability, detected once per page load (not user data)
    return {
        async history(id) {
            if (historyMissing)
                return null;
            try {
                const r = await client.rpc('task_history', { p_task_id: id }, session);
                return Array.isArray(r) ? r : [];
            }
            catch (e) {
                if (isSetupPending(e)) {
                    historyMissing = true;
                    return null;
                }
                throw e;
            }
        },
        async evidence(id) {
            if (evidenceMissing)
                return null;
            try {
                const r = await client.rpc('task_evidence_list', { p_task_id: id }, session);
                return Array.isArray(r) ? r : [];
            }
            catch (e) {
                if (isSetupPending(e)) {
                    evidenceMissing = true;
                    return null;
                }
                throw e;
            }
        },
        addEvidence: (id, f) => client.rpc('task_evidence_add', { p_task_id: id, p_file_name: f.fileName, p_mime_type: f.mimeType, p_content_base64: f.contentBase64 }, session),
        evidenceContent: (v) => client.rpc('task_evidence_content', { p_version_id: v }, session),
        async qrOpened(id) {
            if (qrMissing)
                return;
            try {
                await client.rpc('task_qr_opened', { p_task_id: id }, session);
            }
            catch (e) {
                if (isSetupPending(e))
                    qrMissing = true; /* audit is best effort: never blocks opening the task */
            }
        },
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
