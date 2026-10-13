/** Production can only be declared while a work order is actually running or awaiting first-piece sign-off. */
export function canDeclareProduction(status) {
    return status === 'IN_PROGRESS' || status === 'FIRST_PIECE_PENDING';
}
/**
 * Validates a proposed declaration against the work order's current totals. Mirrors the
 * server-side check in kmi_next.declare_production() exactly — a declaration can never push
 * (qtyProduced + qtyScrap) past qtyPlanned, and negative/zero declarations are refused.
 */
export function canDeclare(wo, qtyGood, qtyScrap, 
/** Quantity held on open quality NCRs (packages/domain/src/qualityNcr.ts) — still counts
 * against qty_planned even though it is neither good nor scrap yet. */
openNcrQty = 0) {
    if (!canDeclareProduction(wo.status)) {
        return { ok: false, reason: `NOT_DECLARABLE_IN_STATUS:${wo.status}` };
    }
    if (qtyGood < 0 || qtyScrap < 0)
        return { ok: false, reason: 'NEGATIVE_QTY' };
    if (qtyGood + qtyScrap <= 0)
        return { ok: false, reason: 'ZERO_DECLARATION' };
    const totalAfter = wo.qtyProduced + wo.qtyScrap + openNcrQty + qtyGood + qtyScrap;
    if (totalAfter > wo.qtyPlanned) {
        return { ok: false, reason: 'EXCEEDS_QTY_PLANNED' };
    }
    return { ok: true };
}
/** Pure projection of a work order's new running totals after a declaration — never mutates the input. */
export function applyDeclaration(wo, qtyGood, qtyScrap) {
    return {
        qtyProduced: wo.qtyProduced + qtyGood,
        qtyScrap: wo.qtyScrap + qtyScrap,
    };
}
/**
 * Validates a proposed correction against the work order's current totals AND against how much
 * of its produced qty has already been materialized into stock lots
 * (`qtyProducedAlreadyLotted`, the sum of kmi_next.stock_lots.qty sourced from this work order,
 * computed server-side) — a correction must never retroactively invalidate stock that already
 * exists in the warehouse. This is the same "never a second stock source, never silently
 * invalidate downstream data" discipline already applied to Purchasing/Toolroom.
 */
export function canCreateProductionCorrection(wo, qtyGoodDelta, qtyScrapDelta, reason, qtyProducedAlreadyLotted, openNcrQty = 0) {
    if (!reason || reason.trim().length === 0)
        return { ok: false, reason: 'REASON_REQUIRED' };
    if (qtyGoodDelta === 0 && qtyScrapDelta === 0)
        return { ok: false, reason: 'ZERO_CORRECTION' };
    const newQtyProduced = wo.qtyProduced + qtyGoodDelta;
    const newQtyScrap = wo.qtyScrap + qtyScrapDelta;
    if (newQtyProduced < 0 || newQtyScrap < 0)
        return { ok: false, reason: 'NEGATIVE_RESULT' };
    if (newQtyProduced < qtyProducedAlreadyLotted) {
        return { ok: false, reason: 'BELOW_ALREADY_LOTTED_QTY' };
    }
    if (newQtyProduced + newQtyScrap + openNcrQty > wo.qtyPlanned)
        return { ok: false, reason: 'EXCEEDS_QTY_PLANNED' };
    return { ok: true };
}
/** Pure projection, mirrors applyDeclaration() but allows either sign — a correction can reduce
 * (the common case: a mis-declared qty) or increase (a previously under-declared qty) a total. */
export function applyCorrection(wo, qtyGoodDelta, qtyScrapDelta) {
    return {
        qtyProduced: wo.qtyProduced + qtyGoodDelta,
        qtyScrap: wo.qtyScrap + qtyScrapDelta,
    };
}
/** Same client_request_id dedup pattern as kmi_next.tool_movements (packages/domain/src/
 * toolroom.ts) — a resubmitted correction request (network retry, double-click) must never be
 * applied twice. */
export function isDuplicateProductionCorrection(clientRequestId, existingClientRequestIds) {
    if (clientRequestId === null)
        return false;
    return existingClientRequestIds.has(clientRequestId);
}
