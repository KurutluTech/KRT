export const MULTI_MACHINE_HARD_CAP = 3;
/** Work-order statuses in which an operator is actually running a machine (old KMI counted
 * running sessions, not mere plans — MACHINE_ASSIGNED is a plan, not a running machine). */
export const RUNNING_WORK_ORDER_STATUSES = [
    'IN_PROGRESS',
    'FIRST_PIECE_PENDING',
    'FIRST_PIECE_APPROVED',
];
export function canGrantMultiMachineAuthorization(level) {
    if (!Number.isInteger(level) || level < 2 || level > MULTI_MACHINE_HARD_CAP) {
        return { ok: false, reason: 'INVALID_MULTI_MACHINE_LEVEL' };
    }
    return { ok: true };
}
export function evaluateOperatorAssignment(input) {
    const activeCount = new Set(input.otherRunningMachineIds).size;
    const requestedLevel = activeCount + 1;
    if (!input.personActive)
        return { ok: false, reason: 'PERSON_INACTIVE', requestedLevel };
    if (!input.personRoles.includes('OPERATOR'))
        return { ok: false, reason: 'PERSON_NOT_OPERATOR', requestedLevel };
    if (!input.targetMachineProductionEligible)
        return { ok: false, reason: 'MACHINE_NOT_PRODUCTION_ELIGIBLE', requestedLevel };
    if (activeCount === 0)
        return { ok: true, requestedLevel };
    if (requestedLevel > MULTI_MACHINE_HARD_CAP)
        return { ok: false, reason: 'HARD_CAP_EXCEEDED', requestedLevel };
    if (input.authorizedLevel >= requestedLevel)
        return { ok: true, requestedLevel };
    return { ok: false, reason: 'MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT', requestedLevel };
}
