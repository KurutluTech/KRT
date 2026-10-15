// KMI-005 — Evrensel Arama: the pure part (no I/O). The SERVER decides what a caller may see (kmi_next.universal_search, migration 0059); this module only
//   (1) classifies what was typed (text / KMI QR / label code / object id) so a code is resolved by the ONE scan standard (KMI-081) and never by a second index,
//   (2) orders and filters the rows the server already returned, and (3) says WHY a row matched. It can never add a row the server did not return.
import { parseScan } from './scan.js';
export const MIN_QUERY = 2;
export const MAX_QUERY = 60; // same limit as universal_search (QUERY_TOO_LONG)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL = /^KL\d{6}$/i;
/** Turkish fold identical to kmi_next.fold_tr (İ/ı, ş, ğ, ü, ö, ç → ASCII, lower case). */
export const foldTr = (s) => String(s ?? '').replace(/[İIıŞşĞğÜüÖöÇç]/g, (c) => ({ 'İ': 'i', 'I': 'i', 'ı': 'i', 'Ş': 's', 'ş': 's', 'Ğ': 'g', 'ğ': 'g', 'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c' }[c] ?? c)).toLowerCase();
export function classifyQuery(raw) {
    const q = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!q)
        return { kind: 'EMPTY', q };
    const scan = parseScan(q);
    if (scan.kind === 'KMI')
        return { kind: 'SCAN_CODE', q, scan, hint: 'Bu bir KMI QR kodu: tarama standardıyla (KMI SCAN) çözülür, arama dizini kullanılmaz.' };
    if (LABEL.test(q))
        return { kind: 'LABEL_CODE', q: q.toUpperCase(), hint: 'Bu bir etiket kodu: tarama standardıyla (KMI SCAN) çözülür.' };
    if (UUID.test(q))
        return { kind: 'OBJECT_ID', q: q.toLowerCase(), hint: 'Nesne kimliği: kaydın kendi ekranında aranır.' };
    if (q.length > MAX_QUERY)
        return { kind: 'TOO_LONG', q };
    if (q.length < MIN_QUERY)
        return { kind: 'TOO_SHORT', q };
    return { kind: 'TEXT', q };
}
/** The scan screen link for a code query (the ONE resolver); null for plain text. */
export function scanHref(c) {
    return c.kind === 'SCAN_CODE' || c.kind === 'LABEL_CODE' ? `#/tara?kod=${encodeURIComponent(c.q)}` : null;
}
export function facets(hits, typeTr, selected) {
    const n = new Map();
    for (const h of hits)
        n.set(h.type, (n.get(h.type) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => (typeTr[a[0]] ?? a[0]).localeCompare(typeTr[b[0]] ?? b[0], 'tr')).map(([type, count]) => ({ type, label: typeTr[type] ?? type, count, on: selected.includes(type) }));
}
/** No selection = everything the server returned. A selection only narrows; an unknown type yields nothing (never invents a row). */
export const filterByTypes = (hits, selected) => (selected.length ? hits.filter((h) => selected.includes(h.type)) : [...hits]);
export const MATCH_TR = { EXACT_CODE: 'Kodu birebir eşleşti', STARTS_WITH: 'Başlığı bu yazıyla başlıyor', CONTAINS: 'Başlıkta geçiyor', OBJECT_ID: 'Nesne kimliği eşleşti', OTHER_FIELD: 'Kayıttaki başka bir alanda eşleşti (müşteri PO, ad…)' };
export function matchWhy(hit, rawQuery) {
    const q = foldTr(rawQuery.trim());
    const title = foldTr(hit.title);
    const code = title.split(' · ')[0] ?? title;
    if (hit.id && q.length >= 4 && foldTr(hit.id).startsWith(q))
        return 'OBJECT_ID';
    if (code === q || title === q)
        return 'EXACT_CODE';
    if (title.startsWith(q) || code.startsWith(q))
        return 'STARTS_WITH';
    if (title.includes(q))
        return 'CONTAINS';
    return 'OTHER_FIELD';
}
const WHY_ORDER = { EXACT_CODE: 0, OBJECT_ID: 1, STARTS_WITH: 2, CONTAINS: 3, OTHER_FIELD: 4 };
/** Stable order: why-matched, then the server rank, then title (Turkish collation). Pure re-ordering of the given rows. */
export function orderHits(hits, rawQuery) {
    return hits.map((h, i) => ({ h, i, w: WHY_ORDER[matchWhy(h, rawQuery)] })).sort((a, b) => a.w - b.w || a.h.rank - b.h.rank || a.h.title.localeCompare(b.h.title, 'tr') || a.i - b.i).map((x) => x.h);
}
/** 005.07: the record-history link for a hit (single audit source). Entity filter + the object id as the text filter, widest preset. */
export function historyHref(auditEntityType, id) {
    return auditEntityType && id ? `#/gecmis?p=THIS_YEAR&e=${encodeURIComponent(auditEntityType)}&q=${encodeURIComponent(id)}` : null;
}
/** Parse the history deep link. Only whitelisted preset / entity values are accepted; free text is capped. Returns undefined when nothing usable was given. */
export function parseHistoryQuery(q, presets, entities) {
    const p = q.get('p');
    const e = q.get('e');
    const t = (q.get('q') ?? '').trim();
    const preset = p && presets.includes(p) ? p : undefined;
    const entityType = e && entities.includes(e) ? e : undefined;
    if (!preset && !entityType && !t)
        return undefined;
    return { preset: preset ?? 'TODAY', basis: 'RECORDED', ...(entityType ? { entityType } : {}), ...(t ? { text: t.slice(0, 80) } : {}) };
}
