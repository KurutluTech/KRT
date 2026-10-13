/** A person must carry at least one role — an empty role list is a fail-closed authorization
 * dead end (checkAuthorization() in authorization.ts already denies on no matching role, but a
 * person with zero roles can never match anything, which is worth catching at creation time
 * rather than discovering it as a silent permanent lockout later). */
export function canCreatePerson(roles, puantajMultiplier) {
    if (roles.length === 0)
        return { ok: false, reason: 'PERSON_MUST_HAVE_AT_LEAST_ONE_ROLE' };
    if (puantajMultiplier < 0.5 || puantajMultiplier > 2)
        return { ok: false, reason: 'PUANTAJ_MULTIPLIER_OUT_OF_RANGE' };
    return { ok: true };
}
/** Toggling active status is only meaningful as an actual change — mirrors the no-op guard
 * used by every other state machine in this codebase (order.ts, workOrder.ts, stock.ts, ...). */
export function canSetPersonActive(currentActive, nextActive) {
    if (currentActive === nextActive)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    return { ok: true };
}
export function canUpdatePuantajMultiplier(nextMultiplier) {
    if (nextMultiplier < 0.5 || nextMultiplier > 2)
        return { ok: false, reason: 'PUANTAJ_MULTIPLIER_OUT_OF_RANGE' };
    return { ok: true };
}
export function hasRole(person, role) {
    return person.roles.includes(role);
}
export function classifySkillTier(skillCount) {
    if (skillCount >= 10)
        return 'TIER_10';
    if (skillCount >= 8)
        return 'TIER_8';
    return 'BASE';
}
