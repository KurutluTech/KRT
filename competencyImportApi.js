export function createCompetencyImportApi(client, session) {
    return {
        batches: () => client.select('competency_import_batches', { columns: 'id,source_label,source_kind,staged_at', order: 'staged_at.desc', limit: 20 }, session),
        stage: (label, kind, note, rows) => client.rpc('stage_competency_import', { p_source_label: label, p_source_kind: kind, p_note: note, p_rows: rows }, session),
        preview: (id) => client.rpc('competency_import_preview', { p_batch_id: id }, session),
        verify: (ids, decision, note) => client.rpc('verify_competency_import', { p_row_ids: ids, p_decision: decision, p_note: note }, session),
    };
}
