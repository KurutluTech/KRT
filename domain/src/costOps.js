/** ids of expenses that already have a REVERSAL (their own amount stays on the books; the reversal row nets it out) */
export const reversedIds = (xs) => new Set(xs.filter((x) => x.kind === 'REVERSAL' && x.reversalOf).map((x) => x.reversalOf));
const add = (m, cur, v) => { m[cur] = Math.round(((m[cur] ?? 0) + v) * 100) / 100; };
/** Net = ENTRY + ADJUSTMENT + REVERSAL (reversals are negative). Per currency, rounded to 2 decimals. */
export function netByCurrency(xs) { const m = {}; for (const x of xs)
    add(m, x.currency, x.amount); return m; }
export function netByCategory(xs) {
    const k = new Map();
    for (const x of xs) {
        const key = `${x.categoryCode}|${x.currency}`;
        const r = k.get(key) ?? { category: x.categoryCode, currency: x.currency, amount: 0, entries: 0 };
        r.amount = Math.round((r.amount + x.amount) * 100) / 100;
        r.entries += 1;
        k.set(key, r);
    }
    return [...k.values()].sort((a, b) => a.currency.localeCompare(b.currency) || Math.abs(b.amount) - Math.abs(a.amount));
}
/** month key 'YYYY-MM' of the service start; the trend never invents empty months' values — a month without rows is simply absent from `byMonth` and flagged in `gaps`. */
export function monthlyTrend(xs, months) {
    const byMonth = {};
    for (const x of xs) {
        const m = x.serviceStart.slice(0, 7);
        if (!months.includes(m))
            continue;
        byMonth[m] ??= {};
        add(byMonth[m], x.currency, x.amount);
    }
    return { byMonth, gaps: months.filter((m) => !byMonth[m]) };
}
export function allocatedByCenter(allocs, currencyOf) {
    const k = new Map();
    for (const a of allocs) {
        const cur = a.currency ?? currencyOf(a.expenseId);
        if (!cur)
            continue;
        const key = `${a.costCenterId}|${cur}`;
        const r = k.get(key) ?? { costCenterId: a.costCenterId, currency: cur, amount: 0 };
        r.amount = Math.round((r.amount + a.amount) * 100) / 100;
        k.set(key, r);
    }
    return [...k.values()];
}
/** remaining (unallocated) positive amount of an ENTRY/ADJUSTMENT expense; reversed or negative rows have none */
export function unallocatedOf(x, allocs, reversed) {
    if (x.kind === 'REVERSAL' || x.amount <= 0 || reversed.has(x.id))
        return null;
    return Math.round((x.amount - allocs.filter((a) => a.expenseId === x.id).reduce((s, a) => s + a.amount, 0)) * 100) / 100;
}
/** A spreadsheet treats a cell starting with = + - @ (or tab / CR) as a formula. Text cells are neutralised with a leading apostrophe; numbers stay numbers. */
export function csvCell(v) {
    if (v === null || v === undefined)
        return '';
    if (typeof v === 'number')
        return String(v);
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s))
        s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function expensesToCsv(xs, categoryName, centerCode) {
    const head = ['Tür', 'Kategori', 'Tutar', 'Para birimi', 'Hizmet başı', 'Hizmet sonu', 'Belge no', 'Maliyet merkezi', 'Açıklama', 'Kayıt no'];
    const kind = { ENTRY: 'GİDER', ADJUSTMENT: 'DÜZELTME', REVERSAL: 'İPTAL' };
    return [head, ...xs.map((x) => [kind[x.kind], categoryName(x.categoryCode), x.amount, x.currency, x.serviceStart, x.serviceEnd, x.documentRef, centerCode(x.costCenterId), x.description, x.id])].map((r) => r.map(csvCell).join(';')).join('\r\n');
}
/** Template for the Excel/CSV import (TR number format). Header names are the ones the importer auto-maps; no sample VALUES that could be mistaken for real data. */
export const IMPORT_TEMPLATE_HEADER = ['Kategori', 'Tutar', 'Para birimi', 'Dönem başı', 'Dönem sonu', 'Belge no', 'Maliyet merkezi', 'Açıklama'];
export const importTemplateCsv = () => `${IMPORT_TEMPLATE_HEADER.join(';')}\r\n`;
