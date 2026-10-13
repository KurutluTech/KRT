export function headcount(people) {
    const act = people.filter((p) => p.active);
    const byDepartment = {};
    const byShift = {};
    let shiftUnknown = 0;
    for (const p of act) {
        byDepartment[p.department] = (byDepartment[p.department] ?? 0) + 1;
        if (p.shiftCode)
            byShift[p.shiftCode] = (byShift[p.shiftCode] ?? 0) + 1;
        else
            shiftUnknown += 1;
    }
    return { total: act.length, byDepartment, byShift, shiftUnknown };
}
const valid = (s, today) => s.validUntil === null || s.validUntil >= today;
/** A person is qualified for a machine when they are ACTIVE and hold EVERY required skill of that machine at ≥ min level, not expired. Machines without any requirement are not rated (UNKNOWN requirement, not "covered"). */
export function machineCoverage(people, skills, reqs, today) {
    const byMachine = new Map();
    for (const r of reqs) {
        const a = byMachine.get(r.machineId) ?? [];
        a.push(r);
        byMachine.set(r.machineId, a);
    }
    const active = people.filter((p) => p.active);
    const out = [];
    for (const [machineId, rs] of byMachine) {
        const names = active.filter((p) => rs.every((r) => skills.some((s) => s.personnelId === p.id && s.skillCode === r.skillCode && s.level >= r.minLevel && valid(s, today)))).map((p) => p.name).sort((a, b) => a.localeCompare(b, 'tr'));
        out.push({ machineId, machineCode: rs[0].machineCode, required: [...new Set(rs.map((r) => r.skillCode))].sort(), qualified: names.length, names, singlePoint: names.length === 1, uncovered: names.length === 0 });
    }
    return out.sort((a, b) => a.qualified - b.qualified || a.machineCode.localeCompare(b.machineCode, 'tr'));
}
export function expiringSkills(skills, today, days) {
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + days);
    const lim = limit.toISOString().slice(0, 10);
    return skills.filter((s) => s.validUntil !== null && s.validUntil >= today && s.validUntil <= lim);
}
export function academyStatus(rows) { const o = {}; for (const r of rows)
    o[r.status] = (o[r.status] ?? 0) + 1; return o; }
