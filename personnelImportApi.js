export function createPersonnelImportApi(client, session) {
    return {
        batches: () => client.select('personnel_import_batches', { columns: 'id,note,staged_at', order: 'staged_at.desc', limit: 10 }, session),
        stage: (note) => client.rpc('stage_personnel_import', { p_note: note }, session),
        preview: (batchId) => client.rpc('personnel_import_preview', { p_batch_id: batchId }, session),
        apply: (batchId, decisions, note) => client.rpc('apply_personnel_import', {
            p_batch_id: batchId,
            p_decisions: decisions.map((d) => ({ row_id: d.rowId, decision: d.decision, ...(d.department ? { department: d.department } : {}), ...(d.roles ? { roles: d.roles } : {}) })),
            p_note: note,
        }, session),
    };
}
