export function createDocumentsApi(client, session) {
    return {
        extractions: (ids) => ids.length ? client.select('document_extractions', { columns: 'id,version_id,method,suggested_doc_type,fields,flags,status,verified_fields,note', filters: { version_id: `in.(${ids.join(',')})` }, order: 'created_at.desc' }, session) : Promise.resolve([]),
        propose: (v) => client.rpc('propose_document_metadata', { p_version_id: v }, session),
        async verify(id, accept, corrected, note) { await client.rpc('verify_document_metadata', { p_extraction_id: id, p_accept: accept, p_corrected: corrected, p_note: note }, session); },
        consistency: (t, id) => client.rpc('document_consistency', { p_entity_type: t, p_entity_id: id }, session),
        gateRules: () => client.select('document_gate_rules', { columns: 'id,gate,doc_type,entity_level,product_id,customer_id,op_no,active,note', filters: { active: 'is.true' }, order: 'set_at.desc' }, session),
        async setGateRule(r) { await client.rpc('set_document_gate_rule', { p_gate: r.gate, p_doc_type: r.docType, p_entity_level: r.entityLevel, p_product_id: r.productId, p_customer_id: null, p_op_no: r.opNo, p_active: true, p_note: r.note }, session); },
        async deactivateGateRule(id, note) { await client.rpc('deactivate_document_gate_rule', { p_rule_id: id, p_note: note }, session); },
        entityDocuments: (t, id) => client.rpc('entity_documents', { p_entity_type: t, p_entity_id: id }, session),
        upload: (i) => client.rpc('upload_document', {
            p_doc_type: i.docType, p_entity_type: i.entityType, p_entity_id: i.entityId, p_title: i.title, p_file_name: i.fileName,
            p_mime_type: i.mimeType, p_content_base64: i.contentBase64, p_valid_until: i.validUntil, p_note: i.note, p_document_id: i.documentId,
        }, session),
        content: (id) => client.rpc('document_version_content', { p_version_id: id }, session),
        async withdraw(id, reason) {
            await client.rpc('withdraw_document', { p_document_id: id, p_reason: reason }, session);
        },
        async setRequirement(t, d, active, note) {
            await client.rpc('set_document_requirement', { p_entity_type: t, p_doc_type: d, p_active: active, p_note: note }, session);
        },
        expiring: (days) => client.rpc('expiring_documents', { p_days: days }, session),
        machines: () => client.select('machines', { columns: 'id,code,name', order: 'code.asc' }, session),
    };
}
