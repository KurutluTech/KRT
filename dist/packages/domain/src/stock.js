const ALLOWED_TRANSITIONS = {
    WIP: ['FG', 'SCRAP', 'HOLD'],
    FG: ['AVAILABLE', 'HOLD', 'SCRAP'],
    AVAILABLE: ['RESERVED', 'HOLD', 'SCRAP'],
    RESERVED: ['STAGED', 'AVAILABLE', 'HOLD'],
    STAGED: ['SHIPPED', 'RESERVED', 'HOLD'],
    HOLD: ['AVAILABLE', 'SCRAP'],
    SHIPPED: [],
    SCRAP: [],
};
/** The canonical stock state machine — the ONE place stock-state transitions are validated. */
export function canTransitionStockState(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/**
 * A stock lot can only be CREATED from a work order's finished output once that work order
 * has produced something real to move — COMPLETED is the normal case, but a long-running work
 * order may also release partial good qty while still IN_PROGRESS (e.g. shippable sub-lots).
 * ON_HOLD/CANCELLED/PLANNED/MACHINE_ASSIGNED have no produced qty eligible for stock yet.
 */
export function canCreateStockLot(workOrderStatus, qty, qtyProducedAvailable) {
    const eligibleStatuses = ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED', 'COMPLETED'];
    if (!eligibleStatuses.includes(workOrderStatus)) {
        return { ok: false, reason: `NOT_ELIGIBLE_IN_STATUS:${workOrderStatus}` };
    }
    if (qty <= 0)
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (qty > qtyProducedAvailable)
        return { ok: false, reason: 'EXCEEDS_AVAILABLE_PRODUCED_QTY' };
    return { ok: true };
}
/**
 * A stock lot can ALSO be created from a purchasing goods receipt (raw material coming into the
 * warehouse) — same canonical kmi_next.stock_lots table/kmi_next.stock_movements ledger as
 * work-order-sourced lots, never a second stock source (owner talimatı §2). Such a lot starts
 * life in HOLD (pending incoming quality decision) — this REUSES the existing
 * HOLD -> AVAILABLE/SCRAP transitions already in ALLOWED_TRANSITIONS above, no new states
 * invented. qty must not exceed what was actually received on this PO line, net of any
 * already-lotted qty (same "available-to-lot" discipline as the work-order path).
 */
export function canCreateStockLotFromGoodsReceipt(qty, qtyReceivedAvailable) {
    if (qty <= 0)
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (qty > qtyReceivedAvailable)
        return { ok: false, reason: 'EXCEEDS_AVAILABLE_RECEIVED_QTY' };
    return { ok: true };
}
