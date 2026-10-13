// KMI-COST-INTELLIGENCE-001 — deterministic cost engines (Item 36). PURE functions: no I/O, no clock, no randomness, so every figure is replayable and explainable.
// Rule of this module: a missing input yields UNKNOWN (with the list of what is missing), NEVER 0 and never a guessed rate. A live provisional figure is never
// labelled final. Item 36 owns management cost calculations; operational truth (production, stock, machine state) stays in its canonical tables.
// NOT a ledger: it computes projections over facts handed in by the caller.
export const FIGURE_STATUS_TR = { ACTUAL: 'GERÇEK', PROVISIONAL: 'GEÇİCİ', ESTIMATED: 'TAHMİNİ', UNKNOWN: 'BİLİNMİYOR', RECONCILIATION_REQUIRED: 'MUTABAKAT GEREKLİ' };
const unknown = (missing, note) => ({ value: null, status: 'UNKNOWN', missing, ...(note ? { note } : {}) });
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const r4 = (n) => Math.round(n * 10000) / 10000;
/** Safe division: unknown or non-positive denominator -> UNKNOWN, never Infinity/NaN/0. */
export function safeDivide(num, den, label) {
    const missing = [];
    if (!isNum(num))
        missing.push(`${label}: pay`);
    if (!isNum(den) || den <= 0)
        missing.push(`${label}: payda (${isNum(den) ? den : 'yok'})`);
    return missing.length ? unknown(missing) : { value: r4(num / den), status: 'ACTUAL', missing: [] };
}
const DAY = 86400000;
const parseDay = (d) => { const t = Date.parse(`${d}T00:00:00Z`); return Number.isNaN(t) ? null : t; };
export function daysInclusive(start, end) { const a = parseDay(start), b = parseDay(end); return a === null || b === null || b < a ? null : Math.round((b - a) / DAY) + 1; }
/** Spread one expense over calendar months by service days (not by payment date). Capital items are NOT operating expense (depreciation is a separate entry). */
export function attributeToMonths(e) {
    if (e.capital)
        return { months: [], excluded: 'CAPITAL_ITEM: amortisman/depreciation girişi ile giderleştirilir' };
    if (e.status === 'REVERSED' || e.status === 'DRAFT')
        return { months: [], excluded: `STATUS_${e.status}` };
    const total = daysInclusive(e.servicePeriodStart, e.servicePeriodEnd);
    if (total === null || !isNum(e.amount))
        return { months: [], excluded: 'INVALID_PERIOD_OR_AMOUNT' };
    const out = new Map();
    let cursor = parseDay(e.servicePeriodStart);
    const end = parseDay(e.servicePeriodEnd);
    while (cursor <= end) {
        const m = new Date(cursor).toISOString().slice(0, 7);
        out.set(m, (out.get(m) ?? 0) + 1);
        cursor += DAY;
    }
    let assigned = 0;
    const keys = [...out.keys()];
    const res = [];
    keys.forEach((m, i) => { const amt = i === keys.length - 1 ? Math.round((e.amount - assigned) * 100) / 100 : Math.round((e.amount * out.get(m) / total) * 100) / 100; assigned += amt; res.push({ month: m, amount: amt }); });
    return { months: res, excluded: null };
}
/** Split `amount` over targets by non-negative driver weights. Largest-remainder rounding so the parts sum EXACTLY to the amount. Zero/unknown total weight -> nothing is invented, the whole amount stays unallocated. */
export function allocateByDriver(amount, weights) {
    const missing = weights.filter((w) => !isNum(w.weight) || w.weight < 0).map((w) => `${w.targetId}: sürücü verisi yok`);
    if (missing.length || !weights.length)
        return { allocations: [], unallocated: amount, status: 'UNKNOWN', missing: missing.length ? missing : ['hedef yok'] };
    const total = weights.reduce((s, w) => s + w.weight, 0);
    if (total <= 0)
        return { allocations: [], unallocated: amount, status: 'UNKNOWN', missing: ['toplam sürücü ağırlığı 0'] };
    const cents = Math.round(amount * 100);
    const raw = weights.map((w) => ({ id: w.targetId, exact: (cents * w.weight) / total }));
    const floor = raw.map((r) => ({ id: r.id, c: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
    let left = cents - floor.reduce((s, f) => s + f.c, 0);
    [...floor].sort((a, b) => b.rem - a.rem).forEach((f) => { if (left > 0) {
        f.c += 1;
        left -= 1;
    } });
    return { allocations: floor.map((f) => ({ targetId: f.id, amount: f.c / 100, share: r4(f.c / (cents || 1)) })), unallocated: 0, status: 'ACTUAL', missing: [] };
}
/** Double-allocation guard: the sum of everything already allocated from one expense plus the new request must not exceed the expense. */
export function canAllocate(expenseAmount, alreadyAllocated, requested) {
    if (![expenseAmount, alreadyAllocated, requested].every(isNum) || requested < 0)
        return { ok: false, reason: 'INVALID_AMOUNT' };
    return Math.round((alreadyAllocated + requested) * 100) > Math.round(expenseAmount * 100) ? { ok: false, reason: 'DOUBLE_ALLOCATION' } : { ok: true, reason: null };
}
/** Pool = sum of the cost components that are KNOWN; if any component is unknown the pool is UNKNOWN (we do not quietly treat a missing component as 0). */
export function machineHourCost(i) {
    const comps = [['sabit sahiplik', i.fixedOwnership], ['amortisman', i.depreciation], ['bakım', i.maintenance], ['enerji', i.energy], ['sarf', i.consumables], ['dağıtılan genel gider', i.allocatedOverhead], ['operatör/kaynak', i.operatorResource]];
    const missing = comps.filter(([, v]) => !isNum(v) || v < 0).map(([n]) => `${n}: veri yok`);
    const pool = missing.length ? unknown(missing) : { value: r4(comps.reduce((s, [, v]) => s + v, 0)), status: 'ACTUAL', missing: [] };
    const per = (den, label) => pool.value === null ? unknown(pool.missing) : safeDivide(pool.value, den, label);
    const perProductive = per(i.periodHours.productive, 'üretken saat');
    const perAvailable = per(i.periodHours.available, 'kullanılabilir saat');
    const idle = pool.value === null || !isNum(i.periodHours.available) || !isNum(i.periodHours.productive) || i.periodHours.available <= 0 || i.periodHours.productive > i.periodHours.available
        ? unknown(['kullanılabilir/üretken saat tutarlı değil veya eksik'])
        : { value: r4(pool.value * (1 - i.periodHours.productive / i.periodHours.available)), status: 'ACTUAL', missing: [] };
    return { machineId: i.machineId, costPool: pool, perProductiveHour: perProductive, perAvailableHour: perAvailable, idleCapacityCost: idle, missing };
}
/** Each minute of a person is split EQUALLY across the machines they ran in that minute — the person's total never exceeds their wall time. */
export function allocateLaborMinutes(intervals) {
    const byMachine = {};
    const byPerson = {};
    const people = [...new Set(intervals.map((i) => i.personId))];
    for (const p of people) {
        const mine = intervals.filter((i) => i.personId === p && i.end > i.start);
        const cuts = [...new Set(mine.flatMap((i) => [i.start, i.end]))].sort((a, b) => a - b);
        for (let k = 0; k + 1 < cuts.length; k += 1) {
            const a = cuts[k], b = cuts[k + 1];
            const active = [...new Set(mine.filter((i) => i.start <= a && i.end >= b).map((i) => i.machineId))];
            if (!active.length)
                continue;
            const minutes = (b - a) / 60000;
            byPerson[p] = (byPerson[p] ?? 0) + minutes;
            for (const m of active)
                byMachine[m] = (byMachine[m] ?? 0) + minutes / active.length;
        }
    }
    return { byMachine, byPerson };
}
export function toolingCost(t) {
    const missing = [];
    if (!isNum(t.toolPrice) || t.toolPrice < 0)
        missing.push('takım fiyatı');
    if (!isNum(t.usedCuttingSeconds) || t.usedCuttingSeconds < 0)
        missing.push('kullanılan kesme saniyesi');
    const price = isNum(t.toolPrice) ? t.toolPrice / Math.max(1, t.edgesPerTool ?? 1) : null;
    const status = t.cuttingSecondsEvidence === 'ACTUAL' ? 'ACTUAL' : t.cuttingSecondsEvidence === 'ESTIMATED' ? 'ESTIMATED' : 'UNKNOWN';
    const wrap = (f) => f.value === null ? f : t.cuttingSecondsEvidence === 'UNVERIFIED' ? { ...f, status: 'UNKNOWN', note: 'kesme süresi doğrulanmadı' } : { ...f, status };
    const rawPerSec = !missing.length && isNum(t.ratedCuttingSeconds) && t.ratedCuttingSeconds > 0 ? price / t.ratedCuttingSeconds : null; // unrounded: rounding happens only on the displayed figure
    const perSec = missing.length ? unknown(missing) : (rawPerSec !== null ? wrap({ value: r4(rawPerSec), status, missing: [] }) : unknown(['nominal takım ömrü (kesme saniyesi)']));
    const perPart = rawPerSec === null || !isNum(t.partsInWindow) || t.partsInWindow <= 0 || !isNum(t.usedCuttingSeconds) ? unknown([...perSec.missing, ...(isNum(t.partsInWindow) && t.partsInWindow > 0 ? [] : ['parça adedi'])])
        : wrap({ value: r4((rawPerSec * t.usedCuttingSeconds) / t.partsInWindow), status, missing: [] });
    const scale = (k) => perPart.value === null ? unknown(perPart.missing) : { ...perPart, value: r4(perPart.value * k) };
    const wear = !isNum(t.ratedCuttingSeconds) || !isNum(t.usedCuttingSeconds) || t.cuttingSecondsEvidence === 'UNVERIFIED' ? 'UNKNOWN' : t.usedCuttingSeconds < t.ratedCuttingSeconds * 0.5 ? 'PREMATURE' : 'NORMAL';
    return { costPerPart: perPart, costPer100: scale(100), costPer1000: scale(1000), costPerCuttingSecond: perSec, wear };
}
export function unitCost(i) {
    const comps = [['malzeme', i.material], ['hazırlık', i.setup], ['makine', i.machine], ['işçilik', i.labor], ['takım', i.tooling], ['enerji', i.energy], ['fason', i.outsideProcessing], ['kalite', i.quality], ['hurda kaybı', i.scrapLoss], ['genel gider', i.overhead]];
    const missing = comps.filter(([, v]) => !isNum(v) || v < 0).map(([n]) => `${n}: veri yok`);
    if (!i.productRevisionId)
        missing.push('ürün revizyonu');
    if (!i.routingRevisionId)
        missing.push('rota revizyonu');
    const known = comps.every(([, v]) => isNum(v) && v >= 0);
    const finalOk = i.mode === 'FINAL_ACTUAL' && i.periodClosed; // a final figure requires a closed period; otherwise it is only provisional
    const status = missing.length ? 'UNKNOWN' : i.mode === 'ESTIMATED_QUOTE' ? 'ESTIMATED' : finalOk ? 'ACTUAL' : i.mode === 'FINAL_ACTUAL' ? 'RECONCILIATION_REQUIRED' : 'PROVISIONAL';
    const sum = known ? r4(comps.reduce((s, [, v]) => s + v, 0)) : null;
    const total = { value: sum, status, missing };
    const per = (q, label) => { const f = safeDivide(sum, q, label); return f.value === null ? f : { ...f, status }; };
    return { total, perStarted: per(i.qtyStarted, 'başlanan adet'), perGood: per(i.qtyGood, 'iyi adet'), perShipped: per(i.qtyShipped, 'sevk edilen adet'), breakdown: comps.map(([component, value]) => ({ component, value })), status, missing };
}
export function orderMargins(o) {
    const needFx = o.revenueCurrency !== o.costCurrency;
    const missing = [];
    if (!isNum(o.revenue))
        missing.push('gelir');
    if (!isNum(o.variableCost))
        missing.push('değişken maliyet');
    if (needFx && (!isNum(o.fxRate) || o.fxRate <= 0))
        missing.push(`kur ${o.revenueCurrency}/${o.costCurrency}`);
    if (missing.length)
        return { contributionMargin: unknown(missing), grossMargin: unknown(missing), contributionPct: unknown(missing) };
    const rev = needFx ? o.revenue * o.fxRate : o.revenue;
    const cm = r4(rev - o.variableCost);
    const gm = isNum(o.fixedAllocated) ? { value: r4(cm - o.fixedAllocated), status: 'PROVISIONAL', missing: [] } : unknown(['dağıtılan sabit maliyet']);
    return { contributionMargin: { value: cm, status: 'PROVISIONAL', missing: [] }, grossMargin: gm, contributionPct: safeDivide(cm * 100, rev, 'gelir') };
}
// ---- 8. Scenarios: visible assumptions, deterministic -------------------------------------------------------------------------------------------
export function energyPriceScenario(monthlyEnergyCost, increasePct) {
    const assumption = `Elektrik birim fiyatı %${increasePct} artar; tüketim değişmez.`;
    return !isNum(monthlyEnergyCost) ? { ...unknown(['aylık enerji gideri']), assumption } : { value: r4(monthlyEnergyCost * increasePct / 100), status: 'ESTIMATED', missing: [], assumption };
}
export function breakEvenUnits(fixedCostPerPeriod, pricePerUnit, variableCostPerUnit) {
    const missing = [];
    if (!isNum(fixedCostPerPeriod))
        missing.push('dönem sabit maliyeti');
    if (!isNum(pricePerUnit))
        missing.push('birim fiyat');
    if (!isNum(variableCostPerUnit))
        missing.push('birim değişken maliyet');
    if (missing.length)
        return unknown(missing);
    const cm = pricePerUnit - variableCostPerUnit;
    if (cm <= 0)
        return unknown(['birim katkı payı ≤ 0: başa baş noktası yok']);
    return { value: Math.ceil(fixedCostPerPeriod / cm), status: 'ESTIMATED', missing: [] };
}
