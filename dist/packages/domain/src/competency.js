// KMI NEXT — Competency (yetkinlik), mastery ladder and KMI Academy (matrix items 32/33).
//
// Provenance: old KMI keeps a skill catalog (18 defaults + Tesviye/Vibrasyon, src/index.html
// DEFAULT_SKILLS / kmiEnsureOpSkills — read-only) and assigns skills as a flat checkbox, "only a
// manager, only after training is completed", stored in the BROWSER (localStorage) — so there is
// no server record to migrate. KMI NEXT keeps the same rule (only an authorized approver changes a
// competency) and makes it auditable: a level (1–4), an optional expiry, append-only history, and
// an Academy path (module → enrollment → training → assessment) whose PASS raises the level.
//
// Twin of migration 0031 (same codes, same order of checks). Puantaj: the approved-skill count is
// shown for information only and is NOT wired into the locked V47 formula (D-001).
export const MASTERY_LEVELS = [1, 2, 3, 4];
export const MASTERY_TR = { 1: 'ÖĞRENCİ', 2: 'GÖZETİMLİ', 3: 'BAĞIMSIZ', 4: 'USTA' };
/** Level from which a person may work alone on that skill (and counts as "approved"). */
export const QUALIFIED_LEVEL = 3;
/** Level required to train others in a skill. */
export const TRAINER_LEVEL = 4;
export const EXPIRING_SOON_DAYS = 30;
export const SKILL_CATEGORIES = ['MACHINE', 'MEASUREMENT', 'PROCESS', 'SOFTWARE', 'MAINTENANCE', 'OTHER'];
/** Old KMI's catalog, names verbatim, with stable codes (seeded by migration 0031). */
export const SEED_SKILLS = [
    { code: 'CAD', name: 'CAD', category: 'SOFTWARE' },
    { code: 'CAM', name: 'CAM', category: 'SOFTWARE' },
    { code: 'AXIS3_OPERATOR', name: '3 eksen operatörü', category: 'MACHINE' },
    { code: 'AXIS4_OPERATOR', name: '4 eksen operatörü', category: 'MACHINE' },
    { code: 'AXIS5_OPERATOR', name: '5 eksen operatörü', category: 'MACHINE' },
    { code: 'CMM_OPERATOR', name: 'CMM Operatörü', category: 'MEASUREMENT' },
    { code: 'FIXTURING', name: 'parça bağlama ve sökme', category: 'PROCESS' },
    { code: 'DEBURRING', name: 'tesviye', category: 'PROCESS' },
    { code: 'GAUGE_CHECK', name: 'mastar kontrol', category: 'MEASUREMENT' },
    { code: 'OFFSET_SETTING', name: 'ofset verebilme', category: 'MACHINE' },
    { code: 'TOOL_MEASURING', name: 'takım ölçme', category: 'MEASUREMENT' },
    { code: 'TOOL_BACKUP', name: 'takım yedekleme', category: 'PROCESS' },
    { code: 'PHOTO_QUALITY', name: 'Fotoğraflı Kalite Ölçümü', category: 'MEASUREMENT' },
    { code: 'CALIPER', name: 'Kumpasla ölçüm', category: 'MEASUREMENT' },
    { code: 'MAINTENANCE', name: 'Bakım', category: 'MAINTENANCE' },
    { code: 'ALL_MACHINES', name: 'tüm tezgahları kullanabilme', category: 'MACHINE' },
    { code: 'LATHE_OPERATOR', name: 'torna operatörü', category: 'MACHINE' },
    { code: 'ROBOT_OPERATOR', name: 'robot operatörü', category: 'MACHINE' },
    { code: 'VIBRATORY', name: 'Vibrasyon', category: 'PROCESS' },
];
const ok = { ok: true };
const no = (reason) => ({ ok: false, reason });
export function isValidSkillCode(code) {
    return /^[A-Z0-9_]{2,40}$/.test(code);
}
function addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
/** Same rule as kmi_next.competency_state: expired the day AFTER valid_until. */
export function competencyState(validUntil, today) {
    if (validUntil === null)
        return 'VALID';
    if (validUntil < today)
        return 'EXPIRED';
    if (validUntil <= addDays(today, EXPIRING_SOON_DAYS))
        return 'EXPIRING_SOON';
    return 'VALID';
}
/** Effective level: an expired competency counts as nothing (fail-closed). */
export function effectiveLevel(held, today) {
    if (!held)
        return 0;
    return competencyState(held.validUntil, today) === 'EXPIRED' ? 0 : held.level;
}
/** Informational only (NOT the puantaj input — D-001). */
export function approvedSkillCount(skills, today) {
    return skills.filter((s) => effectiveLevel(s, today) >= QUALIFIED_LEVEL).length;
}
/** Same codes and order as kmi_next.set_personnel_skill_level. */
export function canChangeSkillLevel(r) {
    if (!r.actorIsApprover)
        return no('FORBIDDEN: COMPETENCY_APPROVE');
    if (!r.reason || r.reason.trim().length < 10)
        return no('REASON_REQUIRED');
    if (!r.person)
        return no('PERSONNEL_NOT_FOUND');
    if (!r.skill)
        return no('SKILL_NOT_FOUND');
    if (r.actorPersonnelId !== null && r.actorPersonnelId === r.person.id)
        return no('SELF_APPROVAL_NOT_ALLOWED');
    if (r.newLevel !== null) {
        if (!MASTERY_LEVELS.includes(r.newLevel))
            return no('INVALID_LEVEL');
        if (!r.person.active)
            return no('PERSON_INACTIVE');
        if (!r.skill.active)
            return no('SKILL_INACTIVE');
        if (r.validUntil !== null && r.validUntil < r.today)
            return no('VALID_UNTIL_IN_PAST');
    }
    if (r.newLevel === r.currentLevel && (r.newLevel === null || r.validUntil === r.currentValidUntil))
        return no('LEVEL_UNCHANGED');
    return ok;
}
export const ENROLLMENT_TR = {
    ENROLLED: 'KAYITLI',
    IN_TRAINING: 'EĞİTİMDE',
    ASSESSMENT_PENDING: 'DEĞERLENDİRME BEKLİYOR',
    PASSED: 'BAŞARILI',
    FAILED: 'BAŞARISIZ',
    CANCELLED: 'İPTAL',
};
/** Advanced by advance_enrollment; PASSED/FAILED only by an assessment. FAILED → IN_TRAINING = retry. */
export const ENROLLMENT_TRANSITIONS = {
    ENROLLED: ['IN_TRAINING', 'CANCELLED'],
    IN_TRAINING: ['ASSESSMENT_PENDING', 'CANCELLED'],
    ASSESSMENT_PENDING: ['CANCELLED'],
    FAILED: ['IN_TRAINING', 'CANCELLED'],
    PASSED: [],
    CANCELLED: [],
};
export const ACTIVE_ENROLLMENT = ['ENROLLED', 'IN_TRAINING', 'ASSESSMENT_PENDING', 'FAILED'];
export function canAdvanceEnrollment(from, to, reason) {
    if (!ENROLLMENT_TRANSITIONS[from].includes(to))
        return no(`ILLEGAL_ENROLLMENT_TRANSITION:${from}->${to}`);
    if (to === 'CANCELLED' && (!reason || reason.trim().length < 5))
        return no('REASON_REQUIRED');
    return ok;
}
/** Same codes and order as kmi_next.enroll_in_module (after authorization). */
export function canEnroll(r) {
    if (!r.module)
        return no('MODULE_NOT_FOUND');
    if (!r.module.active)
        return no('MODULE_INACTIVE');
    if (!r.person)
        return no('PERSONNEL_NOT_FOUND');
    if (!r.person.active)
        return no('PERSON_INACTIVE');
    if (r.hasActiveEnrollment)
        return no('ALREADY_ENROLLED');
    if (effectiveLevel(r.personHeld, r.today) >= r.module.targetLevel)
        return no('ALREADY_AT_TARGET_LEVEL');
    if (r.trainer) {
        if (r.trainer.id === r.person.id)
            return no('TRAINER_IS_TRAINEE');
        if (!r.trainer.active || effectiveLevel(r.trainer.held, r.today) < TRAINER_LEVEL)
            return no('TRAINER_NOT_QUALIFIED');
    }
    return ok;
}
/** Same codes and order as kmi_next.record_academy_assessment. */
export function canRecordAssessment(r) {
    if (!r.actorIsApprover)
        return no('FORBIDDEN: COMPETENCY_APPROVE');
    if (r.status !== 'ASSESSMENT_PENDING')
        return no('ASSESSMENT_NOT_PENDING');
    if (r.actorPersonnelId !== null && r.actorPersonnelId === r.traineeId)
        return no('SELF_APPROVAL_NOT_ALLOWED');
    if (!r.evidence || r.evidence.trim().length < 10)
        return no('EVIDENCE_REQUIRED');
    if (r.score !== null && (r.score < 0 || r.score > 100))
        return no('SCORE_OUT_OF_RANGE');
    if (r.result === 'PASS' && r.passMark !== null) {
        if (r.score === null)
            return no('SCORE_REQUIRED');
        if (r.score < r.passMark)
            return no('BELOW_PASS_MARK');
    }
    return ok;
}
/** Level/expiry after a PASS: never lowers a level; expiry restarts from today. */
export function levelAfterPass(current, module, today) {
    const level = Math.max(current?.level ?? 0, module.targetLevel);
    let validUntil = null;
    if (module.validityMonths !== null) {
        const d = new Date(`${today}T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + module.validityMonths);
        validUntil = d.toISOString().slice(0, 10);
    }
    return { skillCode: module.skillCode, level, validUntil };
}
/**
 * First unmet requirement (requirements in skill-code order), same as
 * kmi_next.operator_qualification_refusal. null = qualified for every DEFINED requirement.
 */
export function qualificationRefusal(requirements, held, today) {
    const sorted = [...requirements].sort((a, b) => (a.skillCode < b.skillCode ? -1 : a.skillCode > b.skillCode ? 1 : 0));
    for (const req of sorted) {
        const h = held.find((x) => x.skillCode === req.skillCode);
        if (!h || h.level < req.minLevel)
            return `OPERATOR_NOT_QUALIFIED:${req.skillCode}`;
        if (competencyState(h.validUntil, today) === 'EXPIRED')
            return `OPERATOR_QUALIFICATION_EXPIRED:${req.skillCode}`;
    }
    return null;
}
