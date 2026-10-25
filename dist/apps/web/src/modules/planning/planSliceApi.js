// Plan dilimi (0155) ve kısa kapama/miktar defteri (0156) RPC adaptörü — TASLAK, dağıtılmadı. Yetki sunucuda (queue_can_reorder / can_short_close).
export function createPlanSliceApi(client, session) {
  const rpc = (fn, a) => client.rpc(fn, a, session);
  const need = (r) => { if (!r || String(r).trim().length < 3) throw new Error('REASON_REQUIRED'); return String(r).trim(); };
  return {
    canPlan: () => rpc('queue_can_reorder', {}),
    readiness: (sliceId) => rpc('plan_slice_readiness', { p_slice: sliceId }),
    reassignChecks: (sliceId, toId) => rpc('plan_reassign_checks', { p_slice: sliceId, p_to: toId }),
    machineQueue: (machineId) => rpc('machine_slice_queue', { p_machine: machineId }),
    opSummary: (opId) => rpc('op_plan_summary', { p_op: opId }),
    capacity: (machineId, from, to) => rpc('plan_capacity_load', { p_machine: machineId, p_from: from, p_to: to }),
    deliveryImpact: (wo, sliceId = null, newDate = null) => rpc('plan_delivery_impact', { p_wo: wo, p_slice: sliceId, p_new_date: newDate }),
    create: (i) => rpc('plan_slice_create', { p_op: i.opId, p_qty: i.qty, p_date: i.date, p_shift: i.shift, p_machine: i.machineId ?? null, p_reason: need(i.reason) }),
    move: (i) => rpc('plan_slice_move', { p_slice: i.sliceId, p_date: i.date, p_shift: i.shift, p_expected_version: i.version, p_reason: need(i.reason) }),
    split: (i) => rpc('plan_slice_split', { p_slice: i.sliceId, p_qty_first: i.qtyFirst, p_expected_version: i.version, p_reason: need(i.reason) }),
    merge: (i) => rpc('plan_slice_merge', { p_a: i.a, p_b: i.b, p_expected_version_a: i.versionA, p_expected_version_b: i.versionB, p_reason: need(i.reason) }),
    cancel: (i) => rpc('plan_slice_cancel', { p_slice: i.sliceId, p_expected_version: i.version, p_reason: need(i.reason) }),
    reorder: (i) => rpc('plan_slice_reorder', { p_machine: i.machineId, p_ordered: i.ordered, p_expected_version: i.version, p_reason: need(i.reason) }),
    reassign: (i) => rpc('plan_slice_reassign', { p_slice: i.sliceId, p_to_machine: i.toMachineId, p_expected_version: i.version, p_expected_version_to: i.versionTo, p_reason: need(i.reason) }),
    start: (sliceId, version) => rpc('plan_slice_start', { p_slice: sliceId, p_expected_version: version }),
    close: (i) => rpc('plan_slice_close', { p_slice: i.sliceId, p_expected_version: i.version, p_reason: need(i.reason) }),
    deferRemaining: (i) => rpc('plan_slice_defer_remaining', { p_slice: i.sliceId, p_date: i.date, p_shift: i.shift, p_expected_version: i.version, p_reason: need(i.reason) }),
    ledger: (wo) => rpc('op_quantity_ledger', { p_wo: wo }),
    shortClose: (opId, reason, requestId) => { if (!reason || String(reason).trim().length < 10) throw new Error('REASON_REQUIRED'); return rpc('operation_short_close', { p_op: opId, p_reason: String(reason).trim(), p_client_request_id: requestId }); },
  };
}
// Planlanan toplam hedefi aşmasın; kalan ayrı gösterilir (sunucu da zorlar).
export function checkSplit(target, qtys) {
  if (!qtys.length || qtys.some((q) => !(q > 0) || q !== Math.trunc(q))) return { ok: false, code: 'BAD_QTY' };
  const sum = qtys.reduce((a, b) => a + b, 0);
  return sum > target ? { ok: false, code: 'OVER_PLANNED', over: sum - target } : { ok: true, planned: sum, unplanned: target - sum };
}
