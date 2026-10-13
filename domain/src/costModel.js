// KMI NEXT — D-013 cost model + D-007 owner binding rules. Twin of migration 0044 (work_order_cost,
// cost_parameter_at, claim_owner_binding).
//
// Rules (owner-only parameters, economic access to read; every parameter version is append-only and
// effective-dated — a correction is a NEW version, never an edit):
//   machine  = Σ run minutes on a machine (status / operation ledgers) ÷ 60 × that machine's hour rate valid that day
//   labour   = run minutes ÷ 60 × plant labour hour rate
//   tool     = run minutes × plant tool-wear rate per minute (a rule, labelled as such)
//   overhead = (machine + labour) × plant overhead %
//   material = the real issued lots × their PO unit price (returns subtracted)
//   FX       = every non-TRY amount × the recorded CUR/TRY rate valid that day (source + source date required)
// ANY missing component → INCOMPLETE "TAM MALİYET HESAPLANAMADI" with the missing list, NO total, NO margin.
/** Effective-dated lookup: latest validFrom ≤ day, then latest setAt (same as kmi_next.cost_parameter_at). */
export function parameterAt(versions, kind, scopeKey, day) {
    let best = null;
    for (const v of versions) {
        if (v.kind !== kind || v.scopeKey !== scopeKey || v.validFrom > day)
            continue;
        if (!best || v.validFrom > best.validFrom || (v.validFrom === best.validFrom && v.setAt > best.setAt))
            best = v;
    }
    return best;
}
/** Validation the table CHECKs enforce (INVALID_COST_PARAMETER). */
export function costParameterValid(p) {
    if (!(p.value > 0))
        return false;
    if ((p.kind === 'OVERHEAD_PCT') !== (p.currency === null))
        return false;
    if (p.kind === 'OVERHEAD_PCT' && p.value > 500)
        return false;
    if (p.kind === 'FX_RATE')
        return p.currency === 'TRY' && ['EUR/TRY', 'USD/TRY', 'GBP/TRY'].includes(p.scopeKey) && (p.source ?? '').trim().length >= 3 && p.sourceDate !== null;
    if (p.kind === 'LABOUR_HOUR' || p.kind === 'TOOL_MINUTE' || p.kind === 'OVERHEAD_PCT')
        return p.scopeKey === 'PLANT';
    return true;
}
const r2 = (n) => Math.round(n * 100) / 100;
export function workOrderCost(c) {
    const missing = new Set();
    const comps = [];
    const fx = (currency, day) => (currency === 'TRY' ? 1 : parameterAt(c.parameters, 'FX_RATE', `${currency}/TRY`, day)?.value ?? null);
    let run = 0;
    let machine = 0;
    const byMachineDay = new Map();
    for (const x of c.runs) {
        const k = `${x.machineCode}|${x.day}`;
        const e = byMachineDay.get(k) ?? { machineCode: x.machineCode, day: x.day, minutes: 0 };
        e.minutes += x.minutes;
        byMachineDay.set(k, e);
    }
    for (const x of [...byMachineDay.values()].sort((a, b) => (a.machineCode + a.day < b.machineCode + b.day ? -1 : 1))) {
        run += x.minutes;
        const p = parameterAt(c.parameters, 'MACHINE_HOUR', x.machineCode, x.day);
        if (!p) {
            missing.add(`MACHINE_TIME:${x.machineCode}`);
            continue;
        }
        const rate = fx(p.currency, x.day);
        if (rate === null) {
            missing.add(`EXCHANGE_RATE:${p.currency}`);
            continue;
        }
        machine += (x.minutes / 60) * p.value * rate;
        comps.push({ component: 'MACHINE_TIME', machine: x.machineCode, try: r2((x.minutes / 60) * p.value * rate) });
    }
    if (run === 0)
        missing.add('RUN_TIME');
    let labour = null;
    const lp = parameterAt(c.parameters, 'LABOUR_HOUR', 'PLANT', c.costDay);
    if (!lp)
        missing.add('LABOUR');
    else {
        const rate = fx(lp.currency, c.costDay);
        if (rate === null)
            missing.add(`EXCHANGE_RATE:${lp.currency}`);
        else {
            labour = (run / 60) * lp.value * rate;
            comps.push({ component: 'LABOUR', try: r2(labour) });
        }
    }
    let tool = null;
    const tp = parameterAt(c.parameters, 'TOOL_MINUTE', 'PLANT', c.costDay);
    if (!tp)
        missing.add('TOOL_WEAR');
    else {
        const rate = fx(tp.currency, c.costDay);
        if (rate === null)
            missing.add(`EXCHANGE_RATE:${tp.currency}`);
        else {
            tool = run * tp.value * rate;
            comps.push({ component: 'TOOL_WEAR', try: r2(tool) });
        }
    }
    if (c.materialUnpriced)
        missing.add('MATERIAL_PRICE');
    if (c.materialNotIssued)
        missing.add('MATERIAL_ISSUE');
    let material = 0;
    for (const m of c.material) {
        const rate = fx(m.currency, m.day);
        if (rate === null) {
            missing.add(`EXCHANGE_RATE:${m.currency}`);
            continue;
        }
        material += m.amount * rate;
        comps.push({ component: 'MATERIAL', try: r2(m.amount * rate) });
    }
    let overhead = null;
    const op = parameterAt(c.parameters, 'OVERHEAD_PCT', 'PLANT', c.costDay);
    if (!op)
        missing.add('OVERHEAD');
    else if (labour !== null) {
        overhead = ((machine + labour) * op.value) / 100;
        comps.push({ component: 'OVERHEAD', try: r2(overhead) });
    }
    const miss = [...missing].sort();
    const total = miss.length === 0 ? machine + (labour ?? 0) + (tool ?? 0) + (overhead ?? 0) + material : null;
    return {
        status: miss.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
        statusTr: miss.length === 0 ? 'TAM MALİYET' : 'TAM MALİYET HESAPLANAMADI',
        missing: miss,
        runMinutes: run,
        components: comps,
        totalTry: total === null ? null : r2(total),
        unitCostTry: total !== null && c.good > 0 ? Math.round((total / c.good) * 10000) / 10000 : null,
        scrapCostTry: total !== null && c.good + c.scrap > 0 ? r2((total * c.scrap) / (c.good + c.scrap)) : null,
    };
}
/** Margin only for a COMPLETE cost and a revenue fully convertible to TRY; otherwise null (never a guess). */
export function marginTry(cost, revenueTry) {
    if (cost.status !== 'COMPLETE' || cost.totalTry === null || revenueTry === null)
        return null;
    return r2(revenueTry - cost.totalTry);
}
/** Same order of checks as kmi_next.claim_owner_binding. The code is compared case-insensitively, trimmed. */
export function bindingClaim(s) {
    if (s.ownerBound)
        return 'OWNER_ALREADY_BOUND';
    if (!s.activeCode || s.activeCode.expired)
        return 'NO_ACTIVE_BINDING_CODE';
    if (s.activeCode.attempts >= 5)
        return 'BINDING_CODE_LOCKED';
    if (s.entered.trim().toUpperCase() !== s.activeCode.code)
        return s.activeCode.attempts + 1 >= 5 ? 'BINDING_CODE_LOCKED' : 'BINDING_CODE_INVALID';
    return 'BOUND';
}
/** Same order of checks as kmi_next.request_owner_binding: the signed-in account itself is the subject (never a
 *  name or an e-mail guess); another account's open request at the same time voids every open request. */
export function ownerRequestOutcome(s) {
    if (s.ownerBound)
        return 'OWNER_ALREADY_BOUND';
    if (!s.account.exists || s.account.deleted || s.account.anonymous || s.account.banned)
        return 'ACCOUNT_NOT_ELIGIBLE';
    if (!s.account.emailConfirmed)
        return 'EMAIL_NOT_CONFIRMED';
    return s.otherAccountsOpenRequests > 0 ? 'VOIDED_CONFLICT' : 'PENDING';
}
/** Same order as kmi_next.approve_owner_binding_request (database level, out of band). */
export function ownerApproval(s) {
    if (s.note.trim().length < 5)
        return 'NOTE_REQUIRED';
    if (s.decided)
        return 'REQUEST_ALREADY_DECIDED';
    if (s.expired)
        return 'REQUEST_EXPIRED';
    if (s.ownerBound)
        return 'OWNER_ALREADY_BOUND';
    if (s.otherOpenRequests > 0)
        return 'CONFLICTING_REQUEST';
    if (s.currentAuthEmail === null || s.currentAuthEmail.toLowerCase() !== s.requestEmail || s.confirmedEmail.trim().toLowerCase() !== s.requestEmail)
        return 'IDENTITY_MISMATCH';
    return 'BOUND';
}
/** A grant counts only while its grantor is the active owner (revoking the owner ends every grant). */
export function economicAccess(s) {
    if (!s.uid || !s.ownerUid)
        return 'NONE';
    if (s.uid === s.ownerUid)
        return 'OWNER';
    return s.grants.some((g) => g.userId === s.uid && !g.revoked && g.grantedBy === s.ownerUid) ? 'GRANTED' : 'NONE';
}
