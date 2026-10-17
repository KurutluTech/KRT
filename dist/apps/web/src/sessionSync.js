/** A "session expired" signal ends the CURRENT session only if it comes from that very session. A straggler request of an OLD session (signed out, idle-closed or replaced by a new
 *  login on a shared terminal) must never log the new user out. */
export function expiryAppliesTo(current, failed) {
    if (!current)
        return false;
    if (!failed)
        return true; // legacy callers without the argument keep the old behaviour
    return failed === current;
}
/** Duplicated browser tabs copy sessionStorage, so two tabs can hold the SAME refresh token. When one rotates it, the sibling adopts the successor (same user, same previous token)
 *  instead of presenting a spent token later (which makes the auth service revoke the whole session). Returns true when the sibling's session object was updated in place. */
export function adoptSiblingRefresh(current, msg) {
    if (!current || !current.refreshToken || !msg || typeof msg !== 'object')
        return false;
    const m = msg;
    const next = m.session;
    if (typeof m.prev !== 'string' || !next || typeof next.accessToken !== 'string' || typeof next.refreshToken !== 'string' || !next.user)
        return false;
    if (m.prev !== current.refreshToken || next.user.id !== current.user.id)
        return false;
    current.accessToken = next.accessToken;
    current.refreshToken = next.refreshToken;
    return true;
}
