// KMI NEXT — OEE / KPI from canonical data (Owner order #679 D).
//
//   OEE = Availability × Performance × Quality
//   Availability = run time / planned production time
//   Performance  = ideal time (count × ideal cycle) / run time
//   Quality      = good count / total count
//
// The ONE calculation: every screen gets its numbers from kmi_next.oee_rollup (migration 0026),
// which sums the per machine × date × shift components (never averages ratios) and applies the
// formula below; this TypeScript mirror exists for the UI label + tests and is proven equal to
// the SQL with golden components captured from the live database (test/oee.test.ts).
//
// Never a fake 100 %: any missing input makes that factor — and OEE — UNKNOWN / VERİ GEREKLİ,
// with the missing input named.
const r4 = (x) => Math.round(x * 10000) / 10000;
export function computeOee(c) {
    const missing = [];
    if (!(c.plannedMinutes > 0))
        return { availability: null, performance: null, quality: null, oee: null, missing: ['PLANNED_TIME'] };
    const availability = r4(c.runMinutes / c.plannedMinutes);
    let performance = null;
    if (!(c.runMinutes > 0))
        missing.push('RUN_TIME');
    else if (c.idealMinutes === null)
        missing.push('IDEAL_CYCLE_TIME');
    else
        performance = r4(c.idealMinutes / c.runMinutes);
    let quality = null;
    if (!(c.totalCount > 0))
        missing.push('COUNT');
    else
        quality = r4(c.goodCount / c.totalCount);
    const oee = performance !== null && quality !== null ? r4(availability * performance * quality) : null;
    return { availability, performance, quality, oee, missing };
}
export function sumOeeComponents(list) {
    const zero = { setup: 0, tool: 0, fault: 0, materialWait: 0, maintenance: 0, other: 0 };
    return list.reduce((acc, c) => ({
        plannedMinutes: acc.plannedMinutes + c.plannedMinutes,
        runMinutes: acc.runMinutes + c.runMinutes,
        idealMinutes: acc.idealMinutes === null || c.idealMinutes === null ? null : acc.idealMinutes + c.idealMinutes,
        totalCount: acc.totalCount + c.totalCount,
        goodCount: acc.goodCount + c.goodCount,
        losses: {
            setup: acc.losses.setup + c.losses.setup,
            tool: acc.losses.tool + c.losses.tool,
            fault: acc.losses.fault + c.losses.fault,
            materialWait: acc.losses.materialWait + c.losses.materialWait,
            maintenance: acc.losses.maintenance + c.losses.maintenance,
            other: acc.losses.other + c.losses.other,
        },
    }), { plannedMinutes: 0, runMinutes: 0, idealMinutes: 0, totalCount: 0, goodCount: 0, losses: zero });
}
export function percentLabel(v) {
    return v === null ? 'UNKNOWN / VERİ GEREKLİ' : `%${(v * 100).toFixed(1)}`;
}
export const HOLD_LOSS_CATEGORIES = ['SETUP', 'TOOL', 'MATERIAL_WAIT', 'OTHER', 'QUALITY_WAIT', 'OPERATOR_CAUSED', 'PLANNED_STOP'];
export const LOSS_LABEL_TR = {
    setup: 'Ayar / hazırlık',
    tool: 'Takım',
    fault: 'Arıza',
    materialWait: 'Malzeme bekleme',
    maintenance: 'Bakım',
    other: 'Diğer / iş yok',
};
