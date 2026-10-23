// KMI-011 Ürün Çalışma Alanı adapter — migration 0107 (draft). Sunucu karar verir (yetki, revizyon sınıfı, parametre geçerliliği, hesap durumu); bu dosya yalnız çağırır.
import { fetchPilotFlags, selReal } from './pilotMark.js';
import { createDocumentControlApi } from './documentControlApi.js';
export function createProductWorkspaceApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    const dc = createDocumentControlApi(client, session);
    return {
        search: (q) => rpc('product_search', { p_q: q || null, p_family: null, p_status: 'ACTIVE', p_limit: 30 }),
        createRevision: (id, rev) => rpc('revision_create', { p_product: id, p_revision: rev, p_copy_from: null }),
        load: (p, r) => rpc('product_workspace', { p_product: p, p_revision: r }),
        machines: () => selReal(client, 'machines', { columns: 'id,code,name', order: 'code.asc' }, session),
        saveOperation: (i) => rpc('routing_op_save', { p_revision: i.revisionId, p_op_no: i.opNo, p_name: i.name, p_machine_ids: i.machineIds, p_primary: i.primaryId, p_skill_code: i.skillCode,
            p_skill_level: i.skillLevel, p_cam: i.camId, p_setup: i.setup, p_cycle: i.cycle, p_first_piece: i.firstPiece, p_qc: i.qc, p_instructions: i.instructions, p_reason: i.reason }),
        async setActive(o, a, r) { await rpc('routing_op_set_active', { p_op: o, p_active: a, p_reason: r }); },
        async reorder(rev, order, r) { await rpc('routing_reorder', { p_revision: rev, p_order: order, p_reason: r }); },
        async setResource(o, kind, code, label, qty, note, active, r) { await rpc('routing_op_resource_set', { p_op: o, p_kind: kind, p_code: code, p_label: label, p_qty: qty, p_note: note, p_active: active, p_reason: r }); },
        async setDependency(o, d, present, r) { await rpc('routing_op_dependency_set', { p_op: o, p_depends_on: d, p_present: present, p_reason: r }); },
        async setQcPoint(o, no, label, kind, plan, freq, active, r) { await rpc('routing_qc_point_set', { p_op: o, p_point_no: no, p_label: label, p_kind: kind, p_control_plan: plan, p_frequency: freq, p_active: active, p_reason: r }); },
        saveBomLine: (rev, code, qty, scrap, r) => rpc('bom_line_save', { p_revision: rev, p_material_code: code, p_qty: qty, p_scrap: scrap, p_reason: r }),
        async removeBomLine(rev, code, r) { await rpc('bom_line_remove', { p_revision: rev, p_material_code: code, p_reason: r }); },
        controlPlanList: (rev) => rpc('control_plan_list', { p_revision: rev }),
        async controlPlanSave(rev, op, rows, open, file) { const r = await rpc('control_plan_save', { p_revision: rev, p_op_no: op, p_rows: rows, p_open_items: open, p_source_file: file?.name ?? null, p_source_sha256: file?.sha256 ?? null }); return { plan_id: r.planId, version: r.version }; },
        async controlPlanApprove(plan, verified, note) { await rpc('control_plan_approve', { p_plan: plan, p_verified: verified, p_note: note }); },
        toolistOverview: (rev) => rpc('toolist_overview', { p_rev: rev }),
        toolistChecks: (v) => rpc('toolist_checks', { p_version: v }),
        async toolistAttest(v, items, note) { await rpc('toolist_attest', { p_version: v, p_items: items, p_note: note }); },
        barNeed: (rev, q) => rpc('bar_material_need', { p_revision: rev, p_qty: q }),
        async barSpecSave(rev, m, d, b, c, k, kr, den, r) { await rpc('bom_bar_spec_save', { p_revision: rev, p_material_code: m, p_dia: d, p_bar_length: b, p_cut_length: c, p_kerf: k, p_kerf_reason: kr, p_density: den, p_reason: r }); },
        toolistFile: (v) => dc.content(v),
        async toolistContentGet(v) { const r = await rpc('toolist_content_get', { p_version: v }); return { saved: r.saved === true, csv: r.csv }; },
        async toolistContentSave(v, csv, mapping) { const r = await rpc('toolist_content_save', { p_version: v, p_csv: csv, p_mapping: mapping }); return r.checks; },
        toolistWorkGet: (v) => rpc('toolist_work_get', { p_version: v }),
        async toolistWorkApply(v, changes, source, reason, file) { const r = await rpc('toolist_work_apply', { p_version: v, p_changes: changes, p_source: source, p_reason: reason, p_file: file ?? null }); return r; },
        async toolistWorkSubmit(id, note) { await rpc('toolist_work_submit', { p_work: id, p_note: note }); },
        async toolistWorkPublish(id, items, note) { await rpc('toolist_work_publish', { p_work: id, p_items: items, p_note: note }); },
        async toolistWorkDiscard(id, reason) { await rpc('toolist_work_discard', { p_work: id, p_reason: reason }); },
        async toolistRecheckDone(id, note) { await rpc('toolist_recheck_done', { p_recheck: id, p_note: note }); },
        techChain: (rev) => rpc('op_technical_chain', { p_rev: rev }),
        camFromNc: (op, nc, m) => rpc('cam_program_from_nc', { p_routing_operation: op, p_nc_version: nc, p_machine: m }),
        async releaseCam(id) { await rpc('release_cam_program', { p_program_id: id }); },
        async docSubmit(v, reason, label) { await dc.submit(v, reason, label); },
        async docReview(v, note) { await dc.review(v, true, note); },
        async docApprove(v, note) { await dc.approve(v, true, note); },
        async docPublish(v, reason) { await dc.publish(v, reason); },
        async linkDocumentToOp(d, opNo) { await rpc('document_link_operation', { p_document: d, p_op_no: opNo, p_on: true }); },
        cncProgramMatch: (m, c) => rpc('cnc_program_match', { p_machine: m, p_cam_program: c }),
        async copyRouting(f, t, r) { await rpc('routing_copy', { p_from: f, p_to: t, p_reason: r }); },
        setParameter: (d, s, v, from, to, r) => rpc('param_set', { p_def: d, p_scope: s, p_value: v, p_valid_from: from, p_valid_to: to, p_reason: r }),
        parameterHistory: (d, s) => rpc('param_history', { p_def: d, p_scope: s }),
        opHistory: async (o) => (await rpc('routing_op_history', { p_op: o })).versions,
        estimate: (r, q) => rpc('routing_estimate', { p_revision: r, p_qty: q, p_on: null }),
        runCalc: (r, q, why) => rpc('calc_run_routing', { p_revision: r, p_qty: q, p_reason: why }),
        reevaluate: (run, r) => rpc('calc_reevaluate', { p_run: run, p_reason: r }),
        upload: (i) => rpc('upload_document', { p_doc_type: i.docType, p_entity_type: i.entityType, p_entity_id: i.entityId, p_title: i.title, p_file_name: i.fileName, p_mime_type: i.mimeType,
            p_content_base64: i.contentBase64, p_valid_until: i.validUntil, p_note: i.note, p_document_id: i.documentId }),
        async documentFile(documentId) {
            const lc = await dc.lifecycle(documentId);
            const eff = lc.versions.find((v) => v.control?.state === 'EFFECTIVE');
            const v = eff ?? [...lc.versions].sort((a, b) => b.versionNo - a.versionNo)[0];
            if (!v)
                throw new Error('VERSION_NOT_FOUND');
            return { versionNo: v.versionNo, effective: !!eff, content: await dc.content(v.id) };
        },
    };
}
export const jobCardFor = async (client, session, wo) => {
    const jc = await client.rpc('job_card', { p_wo: wo }, session);
    const f = await fetchPilotFlags(client, session, [wo]);
    return f.has(wo) ? { ...jc, isPilot: true, pilotRetired: f.retired(wo) } : jc;
};
/** KMI-013 (0124): operation QR through the central scan log (operation_scan). Until 0124 is applied the old non-logging check answers instead — the screen never breaks. Refusals come back as ok:false answers. */
export async function scanCheckLogged(client, session, input, wo, requestId) {
    try {
        const r = await client.rpc('operation_scan', { p_input: input, p_work_order: wo, p_source: 'MANUAL', p_client_request_id: requestId }, session);
        if (!r.ok)
            throw new Error(`${r.code ?? 'OPERATION_SCAN_UNKNOWN'}: ${r.message ?? ''}`);
        return { ok: true, operationId: r.operationId ?? '', workOrderId: r.workOrderId ?? '', opCode: r.opCode ?? '', name: r.name ?? '', status: r.status ?? '', routingVersionNo: r.routingVersionNo ?? null, logged: true };
    }
    catch (e) {
        if (/PGRST202|42883|Could not find the function|does not exist|schema cache/i.test(String(e instanceof Error ? e.message : e)) && /operation_scan/i.test(String(e instanceof Error ? e.message : e)) && !/OPERATION_SCAN_|OPERATION_NOT_FOUND/.test(String(e))) {
            const o = await scanCheck(client, session, input, wo);
            return { ...o, logged: false };
        }
        throw e;
    }
}
export const scanCheck = (client, session, input, wo) => client.rpc('operation_scan_check', { p_input: input, p_work_order: wo }, session);
