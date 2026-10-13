// KURUTLU LIVE 2.0 — pure KPI helpers. Every number is derived from canonical rows handed in; nothing is estimated.
// Period sums use Istanbul day/week/month boundaries (temporal.resolveRange); missing source ⇒ the caller shows "BİLİNMİYOR", never 0.
import { resolveRange } from './temporal.js';
export function sumPeriods(rows, nowIso) {
    const out = { today: { good: 0, scrap: 0, declarations: 0 }, week: { good: 0, scrap: 0, declarations: 0 }, month: { good: 0, scrap: 0, declarations: 0 } };
    const rng = { today: resolveRange('TODAY', nowIso), week: resolveRange('THIS_WEEK', nowIso), month: resolveRange('THIS_MONTH', nowIso) };
    for (const r of rows) {
        const t = Date.parse(r.declaredAt);
        if (Number.isNaN(t))
            continue;
        for (const k of ['today', 'week', 'month']) {
            if (t >= Date.parse(rng[k].from) && t < Date.parse(rng[k].to)) {
                out[k].good += Number(r.qtyGood) || 0;
                out[k].scrap += Number(r.qtyScrap) || 0;
                out[k].declarations += 1;
            }
        }
    }
    return out;
}
/** Month-start (UTC ISO) — the single lower bound the adapter needs to fetch today/week/month in ONE query (week may start in the previous month: take the earlier). */
export function periodFetchFrom(nowIso) {
    const w = resolveRange('THIS_WEEK', nowIso).from, m = resolveRange('THIS_MONTH', nowIso).from;
    return Date.parse(w) < Date.parse(m) ? w : m;
}
export const distinctActiveWorkOrders = (ms) => new Set(ms.flatMap((m) => m.active.map((a) => a.wo))).size;
export const rankMachines = (ms) => [...ms].sort((a, b) => b.shiftGood - a.shiftGood || a.code.localeCompare(b.code));
export const deadlineRisk = (orders) => orders.filter((o) => o.state === 'LATE' || o.state === 'DUE_SOON').length;
/** Scrap share of what was declared; null when nothing was declared (not 0 %). */
export const scrapShare = (good, scrap) => (good + scrap > 0 ? scrap / (good + scrap) : null);
/** Mean of the machines that HAVE an OEE value; null when none do (no fabricated 100 / 0). */
export function meanOee(ms) {
    const v = ms.map((m) => m.oeeToday).filter((x) => typeof x === 'number');
    return { value: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, counted: v.length, of: ms.length };
}
