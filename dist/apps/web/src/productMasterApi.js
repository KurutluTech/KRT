export function createProductMasterApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    return {
        search: (q, family, status) => rpc('product_search', { p_q: q || null, p_family: family || null, p_status: status || null, p_limit: 100 }),
        card: (id) => rpc('product_card', { p_product: id }),
        create: (i, rid) => rpc('product_create_full', { p_code: i.code, p_name: i.name, p_customer: i.customerId, p_customer_part_no: i.customerPartNo, p_family: i.family, p_description: i.description, p_material: i.material, p_client_request_id: rid }),
        update: (id, i, reason) => rpc('product_master_update', { p_product: id, p_name: i.name, p_customer: i.customerId, p_customer_part_no: i.customerPartNo, p_family: i.family, p_description: i.description, p_material: i.material, p_status: i.status, p_reason: reason }),
        customers: async () => (await client.select('customers', { columns: 'id,code,name', order: 'name.asc' }, session)),
        createRevision: (id, rev, copy) => rpc('revision_create', { p_product: id, p_revision: rev, p_copy_from: copy }),
        compare: (a, b) => rpc('revision_compare', { p_a: a, p_b: b }),
        submit: (rev, note, rid) => rpc('revision_submit', { p_revision: rev, p_note: note, p_client_request_id: rid }),
        decide: (req, ok, reason) => rpc('revision_decide', { p_request: req, p_approve: ok, p_reason: reason }),
        requests: (id) => rpc('revision_requests', { p_product: id }),
        readiness: (rev) => rpc('revision_readiness', { p_rev: rev }),
        openWork: (id) => rpc('product_open_work', { p_product: id }),
        history: (id) => rpc('product_history', { p_product: id, p_limit: 150 }),
        durations: (id) => rpc('product_duration_analysis', { p_product: id, p_family: null }),
        passport: (id, rev) => rpc('product_passport', { p_product: id, p_revision: rev }),
        bomDrafts: (rev) => rpc('bom_draft_list', { p_revision: rev }),
        bomDraftCreate: (rev, origin, prov, lines, rid) => rpc('bom_draft_create', { p_revision: rev, p_origin: origin, p_provenance: prov, p_lines: lines, p_client_request_id: rid }),
        bomDraftReview: (d, ok, reason) => rpc('bom_draft_review', { p_draft: d, p_approve: ok, p_reason: reason }),
        bomDraftApply: (d) => rpc('bom_draft_apply', { p_draft: d }),
        addBomLine: async (rev, mat, qty, scrap) => { await rpc('add_bom_line', { p_revision_id: rev, p_material_code: mat, p_qty_per_unit: qty, p_scrap_allowance_pct: scrap }); },
    };
}
