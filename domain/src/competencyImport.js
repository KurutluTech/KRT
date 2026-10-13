// KMI NEXT — competency history import (D-011, migration 0038). Twin of stage_competency_import /
// verify_competency_import. The old KMI keeps skills only in a browser; nothing is moved by guessing:
// a person is identified ONLY by id (a name is kept as text and never matched), the skill must be a
// catalog code, level 1–4, evidence required, an expired validity is not an active qualification.
// Rows wait in PENDING_VERIFICATION until a second approver (not the stager, not the person) verifies.
export const IMPORT_PROBLEM_TR = {
    PERSON_NOT_IDENTIFIED: 'Personel kimliği yok (isimle eşleştirme yapılmaz)',
    SKILL_UNKNOWN: 'Yetkinlik kataloğunda yok',
    LEVEL_INVALID: 'Seviye 1–4 olmalı',
    VALID_UNTIL_INVALID: 'Geçerlilik tarihi okunamadı',
    ALREADY_EXPIRED: 'Süresi dolmuş — aktif yetki olarak alınamaz',
    EVIDENCE_MISSING: 'Kanıt / belge açıklaması yok',
};
/** Same checks, same order as the SQL staging loop. */
export function stageProblems(r, ctx) {
    const out = [];
    const id = (r.personnelId ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id) || !ctx.personExists(id))
        out.push('PERSON_NOT_IDENTIFIED');
    const code = (r.skill ?? '').trim().toUpperCase();
    if (!code || !ctx.skillExists(code))
        out.push('SKILL_UNKNOWN');
    const lvl = typeof r.level === 'number' ? r.level : /^-?\d+$/.test(String(r.level ?? '').trim()) ? Number(String(r.level).trim()) : NaN;
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 4)
        out.push('LEVEL_INVALID');
    const vu = (r.validUntil ?? '').trim();
    if (vu) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(vu) || Number.isNaN(Date.parse(`${vu}T00:00:00Z`)))
            out.push('VALID_UNTIL_INVALID');
        else if (vu < ctx.today)
            out.push('ALREADY_EXPIRED');
    }
    const ev = (r.evidence ?? '').trim();
    if (ev.length < 5)
        out.push('EVIDENCE_MISSING');
    return out;
}
/** Same per-row results as verify_competency_import (before the skill-level write). */
export function verifyRowResult(row, actor, decision) {
    if (row.status !== 'PENDING_VERIFICATION')
        return `NOT_PENDING:${row.status}`;
    if (row.stagedBy === actor)
        return 'FOUR_EYES_REQUIRED';
    if (decision === 'VERIFIED' && row.personAuthUserId === actor)
        return 'SELF_APPROVAL_NOT_ALLOWED';
    return decision;
}
/** Paste format: one row per line, ";"-separated: personnelId;skill;level;validUntil;evidence;personName (header optional). */
export function parseCompetencyImport(text) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^personnelid;/i.test(l)).map((l) => {
        const [personnelId, skill, level, validUntil, evidence, personName] = l.split(';').map((x) => x.trim());
        return { personnelId: personnelId || null, skill: skill || null, level: level ?? null, validUntil: validUntil || null, evidence: evidence || null, personName: personName || null };
    });
}
