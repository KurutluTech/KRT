// KMI NEXT — Frozen Master Item 1: B/C Yeni Sipariş Kesimi
// Owner decision (resolved, baseline 04.10.2026): Option 3 — System C Order/Order Item is the
// ONE canonical order truth. System B's machine/date/capacity recommendations survive ONLY as a
// read-only derived "planning projection" — never a second writer, never a competing truth.
//
// This module is the canonical Order domain: types + pure state-machine functions. The
// Supabase RPC in supabase/migrations/0001_kmi_next_foundation.sql enforces the SAME rules
// server-side (the real, non-bypassable authority) — this package exists so the UI can predict
// outcomes instantly and so these rules are unit-testable without a live database.
/**
 * Computes a read-only planning projection for an order item. This is Frozen Master Item 1's
 * core guarantee made concrete: whatever this function returns can NEVER be persisted as an
 * order fact. It is advisory only — the real due-date/qty/customer truth always comes from the
 * CanonicalOrder itself, never from this projection.
 */
export function projectPlanning(item, candidateWindows) {
    const remaining = item.qty - item.qtyProduced;
    if (remaining <= 0) {
        return {
            orderItemId: item.id,
            suggestedMachineId: null,
            suggestedStartAt: null,
            suggestedEndAt: null,
            capacityRisk: 'OK',
            basis: 'DERIVED_FROM_CANONICAL_ORDER',
        };
    }
    const best = candidateWindows
        .slice()
        .sort((a, b) => new Date(a.availableFrom).getTime() - new Date(b.availableFrom).getTime())
        .find((w) => w.freeCapacityMinutes > 0);
    if (!best) {
        return {
            orderItemId: item.id,
            suggestedMachineId: null,
            suggestedStartAt: null,
            suggestedEndAt: null,
            capacityRisk: 'UNKNOWN',
            basis: 'DERIVED_FROM_CANONICAL_ORDER',
        };
    }
    const due = new Date(item.dueDate).getTime();
    const windowEnd = new Date(best.availableTo).getTime();
    const risk = windowEnd > due ? 'AT_RISK' : windowEnd > due - 1000 * 60 * 60 * 24 * 2 ? 'TIGHT' : 'OK';
    return {
        orderItemId: item.id,
        suggestedMachineId: best.machineId,
        suggestedStartAt: best.availableFrom,
        suggestedEndAt: best.availableTo,
        capacityRisk: risk,
        basis: 'DERIVED_FROM_CANONICAL_ORDER',
    };
}
const ALLOWED_TRANSITIONS = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
    IN_PRODUCTION: ['PARTIALLY_SHIPPED', 'SHIPPED', 'CANCELLED'],
    PARTIALLY_SHIPPED: ['SHIPPED'],
    SHIPPED: ['CLOSED'],
    CLOSED: [],
    CANCELLED: [],
};
/** The canonical order status state machine — the ONE place order transitions are validated. */
export function canTransitionOrderStatus(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/** Open production need = qty not yet produced and not yet covered by an active work order. */
export function computeOpenProductionNeed(item, activeWorkOrderQty) {
    const remaining = item.qty - item.qtyProduced;
    return Math.max(0, remaining - activeWorkOrderQty);
}
// ---- 0054: the shipping part of the order status is DERIVED from dispatched shipments, never set by hand ----
export const DERIVED_ORDER_STATUSES = ['PARTIALLY_SHIPPED', 'SHIPPED'];
/** Same rule as kmi_next.recompute_order_item_facts: CLOSED / CANCELLED / DRAFT are never touched. */
export function derivedShippingStatus(current, items) {
    if (!['CONFIRMED', 'IN_PRODUCTION', 'PARTIALLY_SHIPPED', 'SHIPPED'].includes(current))
        return current;
    const all = items.length > 0 && items.every((i) => i.qtyShipped >= i.qty);
    const any = items.some((i) => i.qtyShipped > 0);
    return all ? 'SHIPPED' : any ? 'PARTIALLY_SHIPPED' : current === 'SHIPPED' ? 'PARTIALLY_SHIPPED' : current;
}
