// KMI NEXT — Smart Assignment (matrix item 34). Twin of migration 0032.
//
// ÖNERİ ≠ KARAR: suggest_operators only ranks; the decision is commit_work_order_plan by an
// authorized manager. The server computes which operator it would have suggested and stores
// whether the manager followed it (the client can no longer just claim "followed").
//
// One canonical eligibility rule for planning an operator (planOperatorRefusal) used by both the
// suggestion and the commit, and one for starting (startQualificationRefusal). Ranking among
// eligible operators (all from real records, nothing invented):
//   1. competency on the machine's required skills (sum of effective levels) — higher first
//   2. experience on the same product (work orders with output) — more first
//   3. past scrap rate on that product — lower first, no history last
//   4. already planned minutes in that slot — less first
//   5. name (tr) — deterministic tie-break
// Presence (GEÇKO) is shown but NEVER ranks: it depends on who is looking (D-010) and on feed
// freshness, and a suggestion must be the same for every manager.
import { MULTI_MACHINE_HARD_CAP } from './operatorAssignment.js';
/** Same codes and order as kmi_next.plan_operator_refusal. */
export function planOperatorRefusal(o, shiftCode) {
    if (!o.exists)
        return 'PERSON_NOT_FOUND';
    if (!o.active)
        return 'PERSON_INACTIVE';
    if (!o.roles.includes('OPERATOR'))
        return 'PERSON_NOT_OPERATOR';
    if (o.shiftCode !== shiftCode)
        return 'OPERATOR_NOT_IN_SHIFT';
    if (o.qualificationRefusal)
        return o.qualificationRefusal;
    if (o.otherMachinesSameSlot > 0) {
        const requested = o.otherMachinesSameSlot + 1;
        if (requested > MULTI_MACHINE_HARD_CAP)
            return 'HARD_CAP_EXCEEDED';
        if (Math.max(1, o.authorizedLevel) < requested)
            return 'MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT';
    }
    return null;
}
/** Start gate addition (after readiness, before multi-machine): kmi_next.work_order_start_preview v4. */
export function startQualificationRefusal(machineHasRequirements, operatorId, qualificationRefusal) {
    if (operatorId === null)
        return machineHasRequirements ? 'OPERATOR_REQUIRED_FOR_QUALIFIED_MACHINE' : null;
    return qualificationRefusal;
}
export function compareCandidates(a, b) {
    const ea = a.refusal === null ? 0 : 1;
    const eb = b.refusal === null ? 0 : 1;
    if (ea !== eb)
        return ea - eb;
    if (a.skillScore !== b.skillScore)
        return b.skillScore - a.skillScore;
    if (a.productExperience !== b.productExperience)
        return b.productExperience - a.productExperience;
    if (a.scrapRate !== b.scrapRate) {
        if (a.scrapRate === null)
            return 1;
        if (b.scrapRate === null)
            return -1;
        return a.scrapRate - b.scrapRate;
    }
    if (a.loadMinutes !== b.loadMinutes)
        return a.loadMinutes - b.loadMinutes;
    return a.name.localeCompare(b.name, 'tr');
}
export function rankOperatorCandidates(cands) {
    return [...cands].sort(compareCandidates).map((c, i) => ({ ...c, rank: i + 1, eligible: c.refusal === null }));
}
/** The operator the server would suggest (first eligible), or null. */
export function suggestedOperator(ranked) {
    return ranked.find((r) => r.eligible)?.personnelId ?? null;
}
/** Scrap rate exactly as SQL: round(scrap / (good + scrap), 4); null when nothing produced. */
export function scrapRate(good, scrap) {
    const total = good + scrap;
    return total > 0 ? Math.round((scrap / total) * 10000) / 10000 : null;
}
export const SA_REASON_TR = {
    PERSON_INACTIVE: 'pasif',
    PERSON_NOT_OPERATOR: 'operatör değil',
    OPERATOR_REMOVAL_NOT_ALLOWED_IN_STATUS: 'üretimdeki iş emrinde operatör ataması kaldırılamaz',
    OPERATOR_NOT_FOUND_OR_INACTIVE: 'personel bulunamadı veya pasif',
    OPERATOR_NOT_IN_SHIFT: 'bu vardiyada değil',
    HARD_CAP_EXCEEDED: 'en fazla 3 makine',
    MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT: 'çoklu makine yetkisi yetersiz',
    OPERATOR_REQUIRED_FOR_QUALIFIED_MACHINE: 'bu makinede adı belli, yetkin operatör şart',
};
export function refusalLabelTr(code) {
    if (code.startsWith('OPERATOR_NOT_QUALIFIED:'))
        return `yetkinlik yok: ${code.split(':')[1]}`;
    if (code.startsWith('OPERATOR_QUALIFICATION_EXPIRED:'))
        return `yetkinlik süresi dolmuş: ${code.split(':')[1]}`;
    return SA_REASON_TR[code] ?? code;
}
