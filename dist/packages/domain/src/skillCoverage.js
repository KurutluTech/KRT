// Operatör yetkinliği kapsama özeti — SAF fonksiyon. Operasyon / makine / vardiya bazında genişletilebilir.
// Ayrım: yetkin (seviye ≥ 3, aktif) ≠ görevlendirilebilir (yetkin + seçili makinede geçerli yetki [+ seçili vardiyada]) ≠ yedek var (görevlendirilebilir ≥ 2).
// Veri uydurmaz: şart yoksa "şart tanımlı değil"; makine/vardiya bilgisi verilmediyse görevlendirilebilirlik "hesaplanmadı" (null) olur.
export const QUALIFIED = 3;
export const COVERAGE_TR = { NO_REQUIREMENT: 'şart tanımlı değil', NO_ONE: 'yetkin kimse yok', NO_ASSIGNABLE: 'yetkin var ama görevlendirilebilir kimse yok', THIN: 'tek kişi — yedek yok', OK: 'yedekli' };
const today = (d) => (d ?? new Date().toISOString().slice(0, 10));
/** clearance geçerli mi: iptal edilmemiş ve süresi dolmamış. */
export const clearanceValid = (c, on) => !!c && !c.revokedAt && (!c.validUntil || String(c.validUntil).slice(0, 10) >= today(on));
/**
 * opts: { qualified=3, machineId, shiftCode, clearances:[{personnelId,machineId,revokedAt,validUntil}], people:[{id,active,shiftCode}], on }
 * matrix: competency_matrix satırları [{personnelId, personActive, skillCode, effectiveLevel}] (camelCase).
 */
export function skillCoverage(codes, matrix, opts = {}) {
    const q = typeof opts === 'number' ? opts : (opts.qualified ?? QUALIFIED);
    const o = typeof opts === 'number' ? {} : opts;
    const req = [...new Set((codes ?? []).filter(Boolean))];
    if (!req.length) return { state: 'NO_REQUIREMENT', skills: [], machineKnown: !!o.machineId, shiftKnown: !!o.shiftCode };
    const peopleById = new Map((o.people ?? []).map((p) => [p.id, p]));
    const machineKnown = !!o.machineId, shiftKnown = !!o.shiftCode && (o.people ?? []).length > 0;
    const cleared = (pid) => (o.clearances ?? []).some((c) => c.personnelId === pid && c.machineId === o.machineId && clearanceValid(c, o.on));
    const skills = req.map((code) => {
        const ids = [...new Set((matrix ?? []).filter((r) => r.skillCode === code && r.personActive !== false && Number(r.effectiveLevel ?? r.level ?? 0) >= q).map((r) => r.personnelId))];
        const active = ids.filter((id) => peopleById.get(id)?.active !== false);
        let assignable = null;
        if (machineKnown) assignable = active.filter((id) => cleared(id) && (!shiftKnown || peopleById.get(id)?.shiftCode === o.shiftCode));
        const nQ = active.length, nA = assignable ? assignable.length : null;
        const basis = nA === null ? nQ : nA;
        const state = nQ === 0 ? 'NO_ONE' : (nA === 0) ? 'NO_ASSIGNABLE' : basis === 1 ? 'THIN' : 'OK';
        return { code, qualified: nQ, assignable: nA, backup: basis >= 2, state };
    });
    const rank = { NO_ONE: 0, NO_ASSIGNABLE: 1, THIN: 2, OK: 3 };
    const worst = skills.reduce((a, s) => (rank[s.state] < rank[a] ? s.state : a), 'OK');
    return { state: worst, skills, machineKnown, shiftKnown };
}
