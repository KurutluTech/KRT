// KMI NEXT — Product revision BOM, raw-material requirement, reservation -> issue to
// production -> actual consumption, and the material-shortage start gate.
// (Owner talimatı 2026-10-10: "BOM / Raw Material"; Golden Thread "Hammadde yetersizliği".)
//
// No second stock engine: raw material lives in the SAME kmi_next.stock_lots rows that goods
// receipt creates (purchase_order_line_id set, material identified by the PO line's
// material_code). Partial quantities move through an append-only ledger on those lots
// (kmi_next.material_movements); every balance below is DERIVED from that ledger:
//
//   RESERVE   : free -> reserved (for one work order)
//   UNRESERVE : reserved -> free
//   ISSUE     : reserved -> issued (physically handed to production)
//   RETURN    : issued -> free (unused material back to the warehouse)
//   CONSUME   : issued -> consumed (actually used)
//
//   free = lot qty - reserved - issued - consumed     (never negative)
//
// A work order with a released BOM revision cannot start (-> IN_PROGRESS) unless every BOM
// material is covered (reserved + issued + consumed for that work order >= requirement).
// Mirrored by supabase/migrations/0016_kmi_next_bom_material.sql.
export function canReleaseRevision(status, bomLineCount) {
    if (status !== 'DRAFT')
        return { ok: false, reason: `REVISION_NOT_DRAFT:${status}` };
    if (bomLineCount < 1)
        return { ok: false, reason: 'BOM_EMPTY' };
    return { ok: true };
}
export function canAddBomLine(status, qtyPerUnit, scrapAllowancePct) {
    if (status !== 'DRAFT')
        return { ok: false, reason: 'REVISION_LOCKED' };
    if (!(qtyPerUnit > 0))
        return { ok: false, reason: 'QTY_PER_UNIT_MUST_BE_POSITIVE' };
    if (scrapAllowancePct < 0 || scrapAllowancePct > 100)
        return { ok: false, reason: 'INVALID_SCRAP_ALLOWANCE' };
    return { ok: true };
}
/** Requirement for a work order, rounded up to 3 decimals so it is never under-stated. */
export function computeMaterialRequirement(qtyPlanned, line) {
    const raw = qtyPlanned * line.qtyPerUnit * (1 + line.scrapAllowancePct / 100);
    return Math.ceil(raw * 1000 - 1e-9) / 1000;
}
export function applyMovement(balance, kind, qty) {
    const b = { ...balance };
    if (kind === 'RESERVE')
        b.reserved += qty;
    else if (kind === 'UNRESERVE')
        b.reserved -= qty;
    else if (kind === 'ISSUE') {
        b.reserved -= qty;
        b.issued += qty;
    }
    else if (kind === 'RETURN')
        b.issued -= qty;
    else if (kind === 'CONSUME') {
        b.issued -= qty;
        b.consumed += qty;
    }
    return b;
}
export function lotFreeQty(lotQty, lotBalance) {
    return lotQty - lotBalance.reserved - lotBalance.issued - lotBalance.consumed;
}
/**
 * Validates one movement on one lot for one work order.
 * `lotBalance` = totals over ALL work orders on the lot; `woBalance` = this work order's share.
 */
export function canApplyMaterialMovement(kind, qty, lotQty, lotState, lotBalance, woBalance) {
    if (!(qty > 0))
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (kind === 'RESERVE') {
        if (lotState !== 'AVAILABLE')
            return { ok: false, reason: `LOT_NOT_AVAILABLE:${lotState}` };
        if (qty > lotFreeQty(lotQty, lotBalance))
            return { ok: false, reason: 'INSUFFICIENT_FREE_MATERIAL' };
        return { ok: true };
    }
    if ((kind === 'UNRESERVE' || kind === 'ISSUE') && qty > woBalance.reserved) {
        return { ok: false, reason: 'EXCEEDS_RESERVED' };
    }
    if ((kind === 'RETURN' || kind === 'CONSUME') && qty > woBalance.issued) {
        return { ok: false, reason: 'EXCEEDS_ISSUED' };
    }
    return { ok: true };
}
/** The material-shortage start gate. Returns the first uncovered material code. */
export function canStartWithMaterials(requirements, coveredByMaterial) {
    for (const r of requirements) {
        const covered = coveredByMaterial[r.materialCode] ?? 0;
        if (covered + 1e-9 < r.required)
            return { ok: false, reason: `MATERIAL_SHORTAGE:${r.materialCode}` };
    }
    return { ok: true };
}
/** Actual vs standard consumption for a material (positive = more used than standard). */
export function computeConsumptionVariance(consumed, qtyProducedPlusScrap, line) {
    const standard = qtyProducedPlusScrap * line.qtyPerUnit;
    return { standard, variance: Math.round((consumed - standard) * 1000) / 1000 };
}
