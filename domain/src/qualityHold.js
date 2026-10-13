/** A hold can be opened on any work order that is actually active (not PLANNED, not terminal). */
export function canOpenQualityHold(status) {
    return status === 'MACHINE_ASSIGNED' || status === 'IN_PROGRESS' || status === 'FIRST_PIECE_PENDING';
}
/** A hold can only be released while it is still OPEN — never twice, never a hold that's already released. */
export function canReleaseQualityHold(hold) {
    if (hold.status !== 'OPEN') {
        return { ok: false, reason: `HOLD_NOT_OPEN:${hold.status}` };
    }
    return { ok: true };
}
