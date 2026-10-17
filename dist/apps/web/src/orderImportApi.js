/** The data client camel-cases every result key; the extraction JSON contract (0110) and this adapter's types are snake_case, so results are restored here (only keys, never values). */
export function snakeKeys(v) {
    if (Array.isArray(v))
        return v.map((x) => snakeKeys(x));
    if (v !== null && typeof v === 'object') {
        const o = {};
        for (const [k, x] of Object.entries(v))
            o[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = snakeKeys(x);
        return o;
    }
    return v;
}
export function createOrderImportApi(client, session) {
    const rpc = async (fn, args) => snakeKeys(await client.rpc(fn, args, session));
    const rpcRaw = (fn, args) => client.rpc(fn, args, session);
    return {
        list: () => rpc('order_import_list', {}),
        get: (id) => rpc('order_import_get', { p_import_id: id }),
        start: () => rpc('order_import_new', {}),
        uploadPdf: (id, fileName, b64, note) => rpcRaw('upload_document', { p_doc_type: 'ORDER_SOURCE_PDF', p_entity_type: 'ORDER_IMPORT', p_entity_id: id, p_title: `Müşteri siparişi ${fileName}`,
            p_file_name: fileName, p_mime_type: 'application/pdf', p_content_base64: b64, p_valid_until: null, p_note: note, p_document_id: null }),
        attach: (id, dv, ex) => rpc('order_import_attach', { p_import_id: id, p_document_version_id: dv, p_extraction: ex }),
        suggest: (id, v) => rpc('order_import_suggest', { p_import_id: id, p_version_no: v }),
        verify: (id, v, header, lines, note) => rpc('order_import_verify', { p_import_id: id, p_version_no: v, p_header: header, p_lines: lines, p_note: note }),
        createOrder: (id) => rpc('order_import_create_order', { p_import_id: id }),
        decideDiff: (id, v, a, r) => rpc('order_import_decide_diff', { p_import_id: id, p_version_no: v, p_approve: a, p_reason: r }),
        async cancel(id, r) { await rpc('order_import_cancel', { p_import_id: id, p_reason: r }); },
        content: (v) => rpcRaw('document_version_content', { p_version_id: v }),
        productSearch: (q) => rpcRaw('product_search', { p_q: q || null, p_family: null, p_status: 'ACTIVE', p_limit: 15 }),
        customers: () => client.select('customers', { columns: 'id,code,name', order: 'name.asc' }, session),
    };
}
