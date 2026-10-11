const ALLOWED_TRANSITIONS = {
    DRAFT: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
};
/** The canonical shipment status state machine — the ONE place shipment transitions are validated. */
export function canTransitionShipmentStatus(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/**
 * A shipment can only be CREATED from a stock lot that has actually been staged for shipment
 * (the Commercial Approval module's own gate — see canStageForShipment()). Nothing earlier in
 * the lot's lifecycle (WIP/FG/AVAILABLE/RESERVED/HOLD/SCRAP) nor the terminal SHIPPED state is
 * eligible — SHIPPED means a shipment already exists for this lot.
 */
export function canCreateShipment(lotState) {
    if (lotState !== 'STAGED')
        return { ok: false, reason: `LOT_NOT_SHIPPABLE_IN_STATE:${lotState}` };
    return { ok: true };
}
/** Dispatching is the one action that also drives the underlying stock lot to SHIPPED. */
export function canDispatchShipment(status) {
    return canTransitionShipmentStatus(status, 'DISPATCHED');
}
export function canDeliverShipment(status) {
    return canTransitionShipmentStatus(status, 'DELIVERED');
}
export function canCancelShipment(status) {
    return canTransitionShipmentStatus(status, 'CANCELLED');
}
