// KMI NEXT — Mastery / Badge Ladder (matrix item 33). Twin of migration 0040. RECOGNITION, never authority:
// nothing here grants a machine or a skill. Criteria are measured from canonical records only; a missing
// metric (null) never meets a criterion; tiers are earned in order and an award is permanent (append-only),
// withdrawn only by a reasoned record.
export const TIER_TR = { 1: 'BRONZ', 2: 'GÜMÜŞ', 3: 'ALTIN', 4: 'PLATİN', 5: 'USTA' };
export const METRIC_TR = {
    first_pass_qc_ops: 'İlk seferde kaliteden geçen operasyon', ops_done: 'Biten operasyon', scrap_rate_pct: 'Fire oranı %',
    first_piece_first_try: 'İlk denemede onaylanan ilk parça', first_piece_first_try_pct: 'İlk parça ilk deneme oranı %',
    measurement_skill_max: 'En yüksek ölçüm yetkinliği', academy_passes: 'Geçilen akademi değerlendirmesi', tool_wear_records: 'Takım aşınma kaydı',
    confirmed_fault_reports: 'Onarımla doğrulanan arıza bildirimi', improvements_adopted: 'Uygulanan iyileştirme',
};
/** Same as kmi_next.badge_criteria_met: all criteria must hold; a null metric never meets one; empty list = false. */
export function criteriaMet(criteria, metrics) {
    if (!criteria.length)
        return false;
    return criteria.every((c) => {
        const v = metrics[c.metric];
        if (v === null || v === undefined)
            return false;
        return c.op === '>=' ? v >= c.value : v <= c.value;
    });
}
/** Same loop as evaluate_badges: in order, skip held tiers, stop at the first unmet one; no data source → nothing. */
export function newTiers(family, held, metrics, skillOk) {
    if (!family.dataSourceAvailable)
        return [];
    const out = [];
    for (const t of [...family.tiers].sort((a, b) => a.tier - b.tier)) {
        if (held.has(t.tier))
            continue;
        if (!(criteriaMet(t.criteria, metrics) && (!t.requiresSkill || skillOk(t.requiresSkill.category, t.requiresSkill.level))))
            break;
        if (t.tier > 1 && !held.has(t.tier - 1) && !out.includes(t.tier - 1))
            break;
        out.push(t.tier);
    }
    return out;
}
/** Progress toward a tier, 0..1 per criterion (for the bar); null metric = 0 and flagged unknown. */
export function criterionProgress(c, v) {
    if (v === null || v === undefined)
        return { ratio: 0, unknown: true };
    if (c.op === '>=')
        return { ratio: c.value <= 0 ? 1 : Math.max(0, Math.min(1, v / c.value)), unknown: false };
    return { ratio: v <= c.value ? 1 : Math.max(0, Math.min(1, c.value / v)), unknown: false };
}
