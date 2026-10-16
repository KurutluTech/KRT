export function createQuotesApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    const none = async (fn, args) => { await rpc(fn, args); };
    return {
        lookups: () => rpc('quote_lookups', {}),
        dashboard: () => rpc('quote_dashboard', {}),
        rfqList: () => rpc('rfq_list', {}),
        rfqDetail: (id) => rpc('rfq_detail', { p_rfq_id: id }),
        rfqCreate: (customerId, customerRef, title, receivedOn, respondBy, note, lines, requestId) => rpc('rfq_create', {
            p_customer_id: customerId, p_customer_ref: customerRef, p_title: title, p_received_on: receivedOn, p_respond_by: respondBy, p_note: note, p_client_request_id: requestId,
            p_lines: lines.map((l) => ({ part_name: l.partName, qty_tiers: l.qtyTiers, product_id: l.productId ?? null, product_revision_id: l.productRevisionId ?? null, required_by: l.requiredBy ?? null, material_note: l.materialNote ?? null, note: l.note ?? null }))
        }),
        rfqLinkProduct: (lineId, productId, revisionId) => none('rfq_line_link_product', { p_rfq_line_id: lineId, p_product_id: productId, p_revision_id: revisionId }),
        rfqCreateProduct: (lineId, code, name, revision) => none('rfq_line_create_product', { p_rfq_line_id: lineId, p_code: code, p_name: name, p_revision: revision }),
        rfqAssess: (lineId, f) => none('rfq_assess_feasibility', { p_rfq_line_id: lineId, p_verdict: f.verdict, p_machine_ids: f.machineIds, p_summary: f.summary, p_risks: f.risks, p_tooling: f.tooling, p_quality: f.quality, p_external: f.external }),
        rfqSetStatus: (rfqId, status, reason) => none('rfq_set_status', { p_rfq_id: rfqId, p_status: status, p_reason: reason }),
        quoteCreateFromRfq: (rfqId, currency, requestId) => rpc('quote_create_from_rfq', { p_rfq_id: rfqId, p_currency: currency, p_client_request_id: requestId }),
        quoteCreateBlank: (customerId, currency, customerRef, requestId) => rpc('quote_create_blank', { p_customer_id: customerId, p_currency: currency, p_customer_ref: customerRef, p_client_request_id: requestId }),
        quoteList: () => rpc('quote_list', {}),
        quoteDetail: (id) => rpc('quote_detail', { p_quote_id: id }),
        headerSave: (id, h) => none('quote_header_save', { p_quote_id: id, p_valid_until: h.validUntil, p_payment: h.payment, p_delivery: h.delivery, p_note: h.note, p_customer_ref: h.customerRef, p_internal_note: h.internalNote }),
        lineSave: (quoteId, lineId, description, productId, productRevisionId, inputs, qtys) => {
            const snake = {};
            const map = { materialCostPerPart: 'material_cost_per_part', toolCostOverride: 'tool_cost_override', qualityMinutesPerPart: 'quality_minutes_per_part', externalCostPerPart: 'external_cost_per_part', scrapPct: 'scrap_pct', materialLeadDays: 'material_lead_days', hasExternalOps: 'has_external_ops', externalLeadDays: 'external_lead_days' };
            for (const [k, v] of Object.entries(inputs))
                snake[map[k]] = v;
            return rpc('quote_line_save', { p_quote_id: quoteId, p_line_id: lineId, p_description: description, p_product_id: productId, p_product_revision_id: productRevisionId, p_inputs: snake, p_qtys: qtys });
        },
        lineDelete: (quoteId, lineId) => none('quote_line_delete', { p_quote_id: quoteId, p_line_id: lineId }),
        opsSave: (quoteId, lineId, ops) => none('quote_line_ops_save', { p_quote_id: quoteId, p_line_id: lineId, p_ops: ops.map((o) => ({ name: o.name, machine_id: o.machineId, setup_minutes: o.setupMinutes, cycle_seconds: o.cycleSeconds, source: o.source })) }),
        recomputeCosts: (quoteId) => rpc('quote_recompute_costs', { p_quote_id: quoteId }),
        estimateLead: (quoteId) => rpc('quote_estimate_lead_times', { p_quote_id: quoteId }),
        setPrice: (tierId, basis, unitPrice, marginPct, reason) => rpc('quote_tier_set_price', { p_tier_id: tierId, p_basis: basis, p_unit_price: unitPrice, p_margin_pct: marginPct, p_reason: reason }),
        submit: (quoteId) => none('quote_submit', { p_quote_id: quoteId }),
        decide: (quoteId, decision, reason, ack) => none('quote_decide', { p_quote_id: quoteId, p_decision: decision, p_reason: reason, p_ack_unknown_cost: ack }),
        newRevision: (quoteId, reason) => rpc('quote_new_revision', { p_quote_id: quoteId, p_reason: reason }),
        customerResponse: (quoteId, response, note) => none('quote_customer_response', { p_quote_id: quoteId, p_response: response, p_note: note }),
        cancel: (quoteId, reason) => none('quote_cancel', { p_quote_id: quoteId, p_reason: reason }),
        convert: (quoteId, customerPo, selection, requestId) => rpc('quote_convert_to_order', { p_quote_id: quoteId, p_customer_po: customerPo, p_client_request_id: requestId,
            p_selection: selection.map((s) => ({ line_id: s.lineId, qty: s.qty, ...(s.dueDate ? { due_date: s.dueDate } : {}) })) }),
        diff: (quoteId, from, to) => rpc('quote_revision_diff', { p_quote_id: quoteId, p_from: from, p_to: to }),
        print: (quoteId) => rpc('quote_print', { p_quote_id: quoteId }),
        setPolicy: (p, reason) => none('quote_policy_set', { p_min_margin_pct: p.minMarginPct, p_validity_days: p.validityDays, p_second_approver: p.secondApprover, p_labour_attendance_pct: p.labourAttendancePct, p_working_days: p.workingDays, p_reason: reason }),
    };
}
