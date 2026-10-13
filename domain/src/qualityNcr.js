// KMI NEXT — Quality REJECT / Scrap / Rework / Re-inspection (owner talimatı: Golden Thread
// "Kalite RED, açık HOLD ve yeniden işleme").
//
// Provenance (old KMI, read-only): a quality reject always needs a written reason and sends
// the work back to production ("Kalite Reddetti - Üretime İade"); returned/rejected parts are
// dispositioned REWORK or SCRAP and a rework is re-inspected before it counts again
// ("Rework Kalite Bekliyor"). KMI NEXT models this as a nonconformance record (NCR) against a
// work order, on the SAME canonical quantities — no second stock or production counter:
//
//   reject  : qty leaves qty_produced (it is no longer good) and is held on the open NCR;
//             the work order goes ON_HOLD through the existing quality-hold mechanism.
//   SCRAP   : the NCR qty moves to qty_scrap. Terminal.
//   REWORK  : the parts go back for rework -> RECHECK_PENDING -> re-inspection:
//             ACCEPTED returns the qty to qty_produced, SCRAPPED moves it to qty_scrap.
//
// Invariant kept everywhere (declare / correct / NCR): qty_produced + qty_scrap + open NCR
// qty <= qty_planned. A rejected qty can never exceed what is good and not yet turned into a
// stock lot (a lot already in the warehouse is rejected through the stock HOLD -> SCRAP path).
// Mirrored by supabase/migrations/0015_kmi_next_quality_ncr.sql.
const ALLOWED = {
    OPEN: ['SCRAPPED', 'REWORK'],
    REWORK: ['RECHECK_PENDING'],
    RECHECK_PENDING: ['ACCEPTED', 'SCRAPPED'],
    ACCEPTED: [],
    SCRAPPED: [],
};
export function canTransitionNcr(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    if (!ALLOWED[from].includes(to))
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    return { ok: true };
}
/** NCRs still carrying quantity that is neither good nor scrap. */
export function isNcrOpen(status) {
    return status === 'OPEN' || status === 'REWORK' || status === 'RECHECK_PENDING';
}
export function canOpenNcr(qty, reason, qtyProduced, qtyProducedAlreadyLotted) {
    if (!reason || reason.trim().length === 0)
        return { ok: false, reason: 'REASON_REQUIRED' };
    if (!(qty > 0))
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (qty > qtyProduced - qtyProducedAlreadyLotted)
        return { ok: false, reason: 'EXCEEDS_REJECTABLE_QTY' };
    return { ok: true };
}
/** Quantity effect of each NCR step on the work order's running totals. */
export function ncrQtyEffect(to, qty) {
    if (to === 'OPEN')
        return { qtyProducedDelta: -qty, qtyScrapDelta: 0 };
    if (to === 'SCRAPPED')
        return { qtyProducedDelta: 0, qtyScrapDelta: qty };
    if (to === 'ACCEPTED')
        return { qtyProducedDelta: qty, qtyScrapDelta: 0 };
    return { qtyProducedDelta: 0, qtyScrapDelta: 0 }; // REWORK / RECHECK_PENDING: still held on the NCR
}
/** A quality hold may only be released once every NCR on the work order has a disposition
 * (nothing still OPEN) — releasing with an undecided reject would let production run on. */
export function canReleaseHoldWithNcrs(ncrStatuses) {
    if (ncrStatuses.some((s) => s === 'OPEN'))
        return { ok: false, reason: 'NCR_DISPOSITION_PENDING' };
    return { ok: true };
}
/** Final production release is blocked while any NCR still holds quantity (rework or re-check
 * not finished). */
export function canFinalReleaseWithNcrs(ncrStatuses) {
    if (ncrStatuses.some(isNcrOpen))
        return { ok: false, reason: 'OPEN_NCR' };
    return { ok: true };
}
