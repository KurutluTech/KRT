import { fetchPilotFlags } from './pilotMark.js';
export function createDocumentControlApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    return {
        list: (q, state, all) => rpc('dc_list', { p_q: q || null, p_state: state || null, p_product: null, p_all: all, p_limit: 200 }),
        lifecycle: async (d) => { const lc = await rpc('document_lifecycle', { p_document: d }); const pf = await fetchPilotFlags(client, session, (lc.distributions ?? []).map((x) => x.workOrderId)); return pf.size ? { ...lc, distributions: lc.distributions.map((x) => (pf.has(x.workOrderId) ? { ...x, isPilot: true } : x)) } : lc; },
        impact: (v) => rpc('document_impact', { p_version: v }),
        async submit(v, reason, label) { await rpc('document_submit', { p_version: v, p_reason: reason, p_label: label }); },
        async review(v, ok, note) { await rpc('document_review', { p_version: v, p_ok: ok, p_note: note }); },
        approve: (v, ok, note) => rpc('document_approve', { p_version: v, p_ok: ok, p_note: note }),
        publish: (v, reason) => rpc('document_publish', { p_version: v, p_reason: reason }),
        async obsolete(v, reason) { await rpc('document_obsolete', { p_version: v, p_reason: reason }); },
        async ack(d, decision, reason) { await rpc('document_ack_distribution', { p_dist: d, p_decision: decision, p_reason: reason }); },
        async linkOperation(d, opNo, on) { await rpc('document_link_operation', { p_document: d, p_op_no: opNo, p_on: on }); },
        printBegin: (v, purpose, reason) => rpc('document_print_begin', { p_version: v, p_purpose: purpose, p_reason: reason }),
        verify: (ref) => rpc('document_verify', { p_ref: ref }),
        content: (v) => rpc('document_version_content', { p_version_id: v }),
        upload: (i) => rpc('upload_document', { p_doc_type: i.docType, p_entity_type: i.entityType, p_entity_id: i.entityId, p_title: i.title, p_file_name: i.fileName, p_mime_type: i.mimeType,
            p_content_base64: i.contentBase64, p_valid_until: i.validUntil, p_note: i.note, p_document_id: i.documentId }),
        products: (q) => rpc('product_search', { p_q: q || null, p_family: null, p_status: 'ACTIVE', p_limit: 30 }),
        revisions: async (p) => (await rpc('product_card', { p_product: p })).revisions,
        forWorkOrder: (wo) => rpc('dc_for_work_order', { p_wo: wo }),
    };
}
