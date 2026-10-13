export function createCostOpsApi(client, session) {
    const sel = (table, columns, filters, order, limit = 2000) => client.select(table, { columns, filters, order, limit }, session);
    const rpc = (fn, args) => client.rpc(fn, args, session);
    const EXP = 'id,kind,category_code,amount,currency,service_start,service_end,payment_date,tax_treatment,cost_center_id,document_ref,description,reversal_of,import_batch_id,created_at';
    return {
        categories: () => sel('cost_categories', 'code,name_tr,behaviour,traceability,capital,active', undefined, 'code.asc'),
        centers: () => sel('cost_centers', 'id,code,name,kind,parent_id,machine_id,active', undefined, 'code.asc'),
        periods: () => sel('cost_periods', 'period,status,closed_at,note', undefined, 'period.desc'),
        expenses: (fromMonth, toMonth) => sel('cost_expenses', EXP, { service_start: `gte.${fromMonth}-01`, ...{} }, 'service_start.desc,created_at.desc').then((rows) => rows.filter((r) => r.serviceStart.slice(0, 7) >= fromMonth && r.serviceStart.slice(0, 7) <= toMonth)),
        allocations: (ids) => (ids.length ? sel('cost_allocations', 'id,expense_id,cost_center_id,amount,driver,rule_version', { expense_id: `in.(${ids.join(',')})` }) : Promise.resolve([])),
        snapshots: (period) => sel('cost_snapshots', 'id,period,calc_version,period_status,expense_count,content_hash,note,taken_at,payload', { period: `eq.${period}` }, 'taken_at.desc', 50),
        verifySnapshot: (id) => rpc('verify_cost_snapshot', { p_snapshot_id: id }),
        reconciliation: (period) => rpc('cost_reconciliation', { p_period: period }),
        importBatches: () => sel('cost_import_batches', 'id,source_name,locale,status,row_count,ok_count,error_count,staged_at,decision_note', undefined, 'staged_at.desc', 50),
        recordExpense: (e, requestId) => rpc('record_cost_expense', { p_category: e.category, p_amount: e.amount, p_currency: e.currency, p_start: e.start, p_end: e.end, p_payment: e.payment, p_tax: e.tax, p_center: e.centerId, p_document_ref: e.documentRef || null, p_description: e.description || null, p_client_request_id: requestId }),
        async reverseExpense(id, reason) { await rpc('reverse_cost_expense', { p_expense_id: id, p_reason: reason }); },
        async adjustExpense(id, delta, reason) { await rpc('adjust_cost_expense', { p_original_id: id, p_delta: delta, p_reason: reason }); },
        allocate: (expenseId, lines, driver) => rpc('allocate_cost_expense', { p_expense_id: expenseId, p_lines: lines, p_driver: driver }),
        createCenter: (c) => rpc('create_cost_center', { p_code: c.code, p_name: c.name, p_kind: c.kind, p_parent_id: c.parentId, p_machine_id: c.machineId }),
        takeSnapshot: (period, note) => rpc('take_cost_snapshot', { p_period: period, p_note: note || null }),
        async closePeriod(period, note) { await rpc('close_cost_period', { p_period: period, p_note: note }); },
        async reopenPeriod(period, note) { await rpc('reopen_cost_period', { p_period: period, p_note: note }); },
        stageImport: (source, locale, fingerprint, rows) => rpc('stage_cost_import', { p_source: source, p_locale: locale, p_fingerprint: fingerprint, p_rows: rows }),
        async decideImport(batchId, approve, note) { await rpc('decide_cost_import', { p_batch_id: batchId, p_approve: approve, p_note: note }); },
        async logExport(scope, format, rows) { await rpc('log_cost_export', { p_scope: scope, p_format: format, p_row_count: rows }); },
    };
}
