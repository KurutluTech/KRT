// KMI NEXT — Golden Thread step 2: Work Order (Sipariş → İş Emri).
// A WorkOrder is created FROM a canonical OrderItem (packages/domain/src/order.ts) and is
// itself the ONE canonical truth for "how much of this order item has actually been put into
// production, on which machine, by whom, and is it quality-released yet." Same single-writer
// discipline as Item 1: the Supabase RPC in supabase/migrations/0003_kmi_next_work_orders.sql
// enforces the identical rules server-side.
const ALLOWED_TRANSITIONS = {
    PLANNED: ['MACHINE_ASSIGNED', 'CANCELLED'],
    MACHINE_ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['FIRST_PIECE_PENDING', 'PRODUCTION_DONE', 'ON_HOLD', 'CANCELLED'],
    FIRST_PIECE_PENDING: ['FIRST_PIECE_APPROVED', 'ON_HOLD', 'CANCELLED'],
    FIRST_PIECE_APPROVED: ['IN_PROGRESS', 'PRODUCTION_DONE', 'COMPLETED', 'ON_HOLD'],
    PRODUCTION_DONE: ['COMPLETED', 'ON_HOLD'],
    ON_HOLD: ['IN_PROGRESS', 'MACHINE_ASSIGNED', 'PRODUCTION_DONE', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
};
/** The canonical work order status state machine — the ONE place transitions are validated. */
export function canTransitionWorkOrderStatus(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/** A work order cannot move IN_PROGRESS without a machine assigned first (fail-closed, not implicit). */
export function canAssignMachine(status) {
    return status === 'PLANNED' || status === 'ON_HOLD';
}
/** Open qty on a work order = planned minus (produced + scrap), never negative. */
export function computeRemainingWorkOrderQty(wo) {
    return Math.max(0, wo.qtyPlanned - wo.qtyProduced - wo.qtyScrap);
}
/**
 * Golden Thread discipline check: a WorkOrder's qtyPlanned must never exceed the open
 * production need of the OrderItem it was created from (computeOpenProductionNeed in
 * order.ts). This function is the domain-layer guard the UI/RPC both call before creating a
 * work order — it does not itself know about Order/OrderItem shapes (no import cycle), it
 * just takes the already-computed open-need number.
 */
export function canCreateWorkOrder(qtyPlanned, openProductionNeed) {
    if (qtyPlanned <= 0)
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (qtyPlanned > openProductionNeed)
        return { ok: false, reason: 'EXCEEDS_OPEN_PRODUCTION_NEED' };
    return { ok: true };
}
// --- Final Production Release (FINAL_PRODUCTION_RELEASE critical action, owner talimatı §2) ---
//
// Moving a work order to COMPLETED is the final production release. The state machine already
// forces COMPLETED to come only from FIRST_PIECE_APPROVED (so "missing first-piece approval"
// can never reach COMPLETED); this adds the remaining release gates, mirrored exactly by
// kmi_next.transition_work_order_status() in migration 0013:
//   - no OPEN quality hold may exist on the work order (a held job is never released),
//   - at least one good part must have been declared (an empty job is cancelled, not completed).
// The FINAL_PRODUCTION_RELEASE role check itself is server-side only (authorize_critical_action).
export function canFinalReleaseWorkOrder(wo, openQualityHoldCount) {
    const transition = canTransitionWorkOrderStatus(wo.status, 'COMPLETED');
    if (!transition.ok)
        return transition;
    if (openQualityHoldCount > 0)
        return { ok: false, reason: 'OPEN_QUALITY_HOLD' };
    if (wo.qtyProduced <= 0)
        return { ok: false, reason: 'NOTHING_PRODUCED' };
    return { ok: true };
}
