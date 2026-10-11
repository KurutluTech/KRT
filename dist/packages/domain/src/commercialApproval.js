/**
 * A commercial approval can only be REQUESTED for a stock lot that is actually available to
 * ship — a lot still in WIP/FG/HOLD/SCRAP/SHIPPED has nothing ready for commercial release yet.
 */
export function canRequestCommercialApproval(lotState) {
    return lotState === 'AVAILABLE' || lotState === 'RESERVED';
}
/** A decision (approve/reject) can only be made once, on a still-PENDING request. */
export function canDecideCommercialApproval(status) {
    if (status !== 'PENDING')
        return { ok: false, reason: `ALREADY_DECIDED:${status}` };
    return { ok: true };
}
/**
 * A stock lot may only be staged for shipment (RESERVED -> STAGED, per the ONE stock state
 * machine in packages/domain/src/stock.ts — AVAILABLE cannot skip straight to STAGED there)
 * once it carries an APPROVED commercial approval. This is the single rule tying the Stock and
 * Commercial-Approval modules together — neither module re-derives or stores the other's
 * truth, this function just reads both and decides, and it deliberately matches
 * stock.ts's own ALLOWED_TRANSITIONS rather than inventing a shortcut path.
 */
export function canStageForShipment(lotState, approvalStatus) {
    if (lotState !== 'RESERVED') {
        return { ok: false, reason: `LOT_NOT_STAGEABLE_IN_STATE:${lotState}` };
    }
    if (approvalStatus !== 'APPROVED') {
        return { ok: false, reason: `NO_APPROVED_COMMERCIAL_APPROVAL:${approvalStatus ?? 'NONE'}` };
    }
    return { ok: true };
}
// --- Management Release (MANAGEMENT_RELEASE critical action) -------------------------------
//
// Provenance: old KMI's live commercial-release evaluator (/home/claude/kmi/src/index.html,
// read-only) blocks commercial release with reasonCode MANAGEMENT_RELEASE_MISSING until a
// management ("Yönetim/İşletme") release has been given — the stage order there is
// "Yönetim Onayı Bekliyor" -> "Muhasebe Onayı Bekliyor". KMI NEXT keeps the same order on the
// SAME commercial_approvals record (no second approval table): a PENDING request first needs a
// management release (MANAGEMENT_RELEASE), and only then may COMMERCIAL_RELEASE approve it.
// Rejecting never requires a management release — refusing to ship is always allowed.
export function canGrantManagementRelease(status, alreadyReleased) {
    if (status !== 'PENDING')
        return { ok: false, reason: `ALREADY_DECIDED:${status}` };
    if (alreadyReleased)
        return { ok: false, reason: 'MANAGEMENT_RELEASE_ALREADY_GIVEN' };
    return { ok: true };
}
export function canDecideCommercialApprovalWithRelease(status, decision, managementReleased) {
    const base = canDecideCommercialApproval(status);
    if (!base.ok)
        return base;
    if (decision === 'APPROVED' && !managementReleased)
        return { ok: false, reason: 'MANAGEMENT_RELEASE_MISSING' };
    return { ok: true };
}
