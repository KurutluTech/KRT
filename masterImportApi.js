export function createMasterImportApi(client, session) {
    return {
        batches: () => client.select('master_import_batches', { columns: 'id,label,staged_at', order: 'staged_at.desc', limit: 10 }, session),
        stage: (label, source, payload) => client.rpc('stage_master_import', { p_label: label, p_source: source, p_payload: payload }, session),
        preview: (batchId) => client.rpc('master_import_preview', { p_batch_id: batchId }, session),
        exportBatch: (batchId) => client.rpc('master_import_export', { p_batch_id: batchId }, session),
        rollbackPlan: (batchId) => client.rpc('master_import_rollback_plan', { p_batch_id: batchId }, session),
        apply: (batchId, decisions, note) => client.rpc('apply_master_import', {
            p_batch_id: batchId,
            p_decisions: decisions.map((d) => ({ row_id: d.rowId, decision: d.decision, ...(d.confirmReal ? { confirm_real: true } : {}), ...(d.code ? { code: d.code } : {}), ...(d.name ? { name: d.name } : {}) })),
            p_note: note,
        }, session),
    };
}
export function createCatalogApi(client, session) {
    return {
        customers: () => client.select('customers', { columns: 'id,code,name,country,active', order: 'name.asc' }, session),
        suppliers: () => client.select('suppliers', { columns: 'id,name,active', order: 'name.asc' }, session),
        products: () => client.select('products', { columns: 'id,code,name', order: 'code.asc' }, session),
        createCustomer: (code, name, country) => client.rpc('create_customer', { p_code: code, p_name: name, p_country: country || null }, session),
        setCustomerActive: (id, active, reason) => client.rpc('set_customer_active', { p_customer_id: id, p_active: active, p_reason: reason }, session),
        createSupplier: (name, contact) => client.rpc('create_supplier', { p_name: name, p_contact_info: contact || null }, session),
    };
}
