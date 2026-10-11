// KMI NEXT — explainable assignment suggestion for routed operations. Twin of migration 0041.
// The suggestion NEVER assigns; presence (GEÇKO) is shown but never ranks; a missing factor is UNKNOWN.
const nullsLast = (a, b, dir) => (a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : dir * (a - b));
/** Same ORDER BY as suggest_operation_assignment. */
export function rankCandidates(c) {
    return [...c].sort((a, b) => Number(b.eligible) - Number(a.eligible)
        || b.sameStep - a.sameStep
        || nullsLast(a.skillLevel, b.skillLevel, -1)
        || b.sameSkill - a.sameSkill
        || nullsLast(a.scrapPct, b.scrapPct, 1)
        || nullsLast(a.setupMinutes, b.setupMinutes, 1)
        || a.machineQueue - b.machineQueue
        || a.machineCode.localeCompare(b.machineCode)
        || a.operatorName.localeCompare(b.operatorName, 'tr'));
}
/** record_operation_assignment: followed is computed against the server's top eligible candidate. */
export function assignmentDecisionCheck(top, chosen, reason) {
    if (!chosen.eligible)
        return { ok: false, reason: chosen.refusal ?? 'NOT_ELIGIBLE' };
    const followed = !!top && top.machine === chosen.machine && top.operator === chosen.operator;
    if (!followed && (!reason || reason.trim().length < 5))
        return { ok: false, reason: 'REASON_REQUIRED_WHEN_NOT_FOLLOWING' };
    return { ok: true, followed };
}
export const FACTOR_TR = {
    IN_CURRENT_SHIFT: 'Bu vardiyada', OTHER_SHIFT: 'Başka vardiyada', UNKNOWN: 'BİLİNMİYOR', INSIDE: 'İçeride', OUTSIDE: 'Dışarıda',
    OWN_HISTORY: 'kendi geçmişinden', NOT_REQUIRED: 'gerekmiyor', READY: 'hazır', NOT_READY: 'HAZIR DEĞİL',
};
/** Multi-machine rule (operator_multi_machine_refusal): hard cap 3, else needs authorization ≥ machines. */
export function multiMachineRefusal(otherActiveMachines, authorizedMax) {
    if (otherActiveMachines === 0)
        return null;
    if (otherActiveMachines + 1 > 3)
        return 'HARD_CAP_EXCEEDED';
    if (Math.max(1, authorizedMax ?? 1) < otherActiveMachines + 1)
        return 'MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT';
    return null;
}
