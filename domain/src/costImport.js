// KMI-COST-INTELLIGENCE-001 §14 — spreadsheet/CSV import staging logic. PURE. Upload -> Preview -> Mapping -> Validation -> Duplicate detection -> (approval) -> import.
// Nothing here writes anything: it turns raw cells into validated staging rows with row-level errors. Formulas are NEVER evaluated: a cell that starts with = + - @ is
// treated as text (and flagged), so a spreadsheet cannot execute as application code. Locale/decimal/date handling is explicit, never guessed silently.
/** TR: 1.234,56  EN: 1,234.56. Returns null for anything that is not unambiguously a number in the declared locale. */
export function parseLocaleNumber(raw, locale) {
    if (typeof raw === 'number')
        return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string')
        return null;
    let s = raw.trim().replace(/[\s ]/g, '').replace(/^[₺$€£]|[₺$€£]$/g, '').replace(/(TRY|TL|EUR|USD|GBP)$/i, '');
    if (!s || /^=/.test(s))
        return null;
    const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
    s = s.replace(/^\(|\)$/g, '').replace(/^-/, '');
    const [thou, dec] = locale === 'TR' ? ['.', ','] : [',', '.'];
    const re = new RegExp(`^\\d{1,3}(\\${thou}\\d{3})*(\\${dec}\\d+)?$|^\\d+(\\${dec}\\d+)?$`);
    if (!re.test(s))
        return null;
    const n = Number(s.split(thou).join('').replace(dec, '.'));
    return Number.isFinite(n) ? (neg ? -n : n) : null;
}
/** Accepts DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD only (no US M/D guessing). Returns ISO date or null; rejects impossible dates (31.02.2026). */
export function parseDateStrict(raw) {
    if (typeof raw !== 'string')
        return null;
    const s = raw.trim();
    let y, m, d;
    let x;
    if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
        y = +x[1];
        m = +x[2];
        d = +x[3];
    }
    else if ((x = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) {
        d = +x[1];
        m = +x[2];
        y = +x[3];
    }
    else
        return null;
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}
export const isFormulaLike = (v) => typeof v === 'string' && /^[=+\-@]/.test(v.trim()) && !/^-?\d/.test(v.trim());
/** Stable non-cryptographic fingerprint (FNV-1a 64-bit as two 32-bit halves) used for duplicate detection of staged rows. The database re-derives it with md5. */
export function rowFingerprint(parts) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x9e3779b9;
    const s = parts.map((p) => (p === null ? '∅' : String(p).trim().toLowerCase())).join('␟');
    for (let i = 0; i < s.length; i += 1) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
export const REQUIRED_FIELDS = ['categoryCode', 'amount', 'currency', 'periodStart', 'periodEnd'];
export const ALLOWED_CURRENCIES = ['TRY', 'EUR', 'USD', 'GBP'];
export function stageExpenseRows(cells, mapping, opts) {
    const missingMapping = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);
    const seen = new Set();
    const rows = [];
    cells.forEach((r, idx) => {
        const get = (f) => (mapping[f] === undefined ? undefined : r[mapping[f]]);
        const issues = [];
        const text = (f) => { const v = get(f); if (v === undefined || v === null || String(v).trim() === '')
            return null; if (isFormulaLike(v)) {
            issues.push({ code: 'FORMULA_NEUTRALISED', field: f, message: 'Formül/komut benzeri hücre metin olarak alındı, çalıştırılmadı.' });
            return String(v).trim().replace(/^[=+\-@]+/, '');
        } return String(v).trim(); };
        const categoryCode = text('categoryCode');
        const currency = (text('currency') ?? '').toUpperCase() || null;
        const amountRaw = get('amount');
        const amount = amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === '' ? null : parseLocaleNumber(amountRaw, opts.locale);
        const ps = parseDateStrict(String(get('periodStart') ?? ''));
        const pe = parseDateStrict(String(get('periodEnd') ?? ''));
        for (const f of REQUIRED_FIELDS) {
            const v = get(f);
            if (mapping[f] !== undefined && (v === undefined || v === null || String(v).trim() === ''))
                issues.push({ code: 'MISSING_REQUIRED', field: f, message: `${f} boş` });
        }
        if (amountRaw !== undefined && amountRaw !== null && String(amountRaw).trim() !== '' && amount === null)
            issues.push({ code: 'BAD_NUMBER', field: 'amount', message: `"${String(amountRaw)}" ${opts.locale} biçiminde sayı değil` });
        if (get('periodStart') && ps === null)
            issues.push({ code: 'BAD_DATE', field: 'periodStart', message: 'Tarih GG.AA.YYYY, GG/AA/YYYY veya YYYY-AA-GG olmalı' });
        if (get('periodEnd') && pe === null)
            issues.push({ code: 'BAD_DATE', field: 'periodEnd', message: 'Tarih GG.AA.YYYY, GG/AA/YYYY veya YYYY-AA-GG olmalı' });
        if (ps && pe && pe < ps)
            issues.push({ code: 'PERIOD_ORDER', message: 'Hizmet dönemi bitişi başlangıçtan önce' });
        if (currency && !ALLOWED_CURRENCIES.includes(currency))
            issues.push({ code: 'BAD_CURRENCY', field: 'currency', message: `Desteklenmeyen para birimi ${currency}` });
        if (categoryCode && !opts.knownCategories.has(categoryCode.toUpperCase()))
            issues.push({ code: 'UNKNOWN_CATEGORY', field: 'categoryCode', message: `Tanımsız gider kategorisi ${categoryCode}` });
        const documentRef = text('documentRef');
        const fingerprint = rowFingerprint([categoryCode?.toUpperCase() ?? null, amount, currency, ps, pe, documentRef]);
        if (seen.has(fingerprint))
            issues.push({ code: 'DUPLICATE_IN_FILE', message: 'Aynı satır dosyada tekrar' });
        seen.add(fingerprint);
        if (opts.existingFingerprints?.has(fingerprint))
            issues.push({ code: 'DUPLICATE_OF_EXISTING', message: 'Bu satır daha önce içe aktarılmış (aynı parmak izi)' });
        rows.push({ rowNo: idx + 1, fingerprint, ok: !issues.some((i) => i.code !== 'FORMULA_NEUTRALISED'), issues, values: { categoryCode: categoryCode?.toUpperCase() ?? null, amount, currency, periodStart: ps, periodEnd: pe, documentRef, costCenter: text('costCenter'), description: text('description') } });
    });
    return { batchFingerprint: rowFingerprint(rows.map((r) => r.fingerprint)), rows, okCount: rows.filter((r) => r.ok).length, errorCount: rows.filter((r) => !r.ok).length, missingMapping };
}
/** Minimal RFC-4180-style CSV reader (quotes, embedded delimiters/newlines). Delimiter auto-detected from the header line: ; (TR Excel) , or tab. */
export function parseCsv(text) {
    const t = text.replace(/^﻿/, '');
    const head = t.split(/\r?\n/, 1)[0] ?? '';
    const counts = [[';', head.split(';').length], [',', head.split(',').length], ['\t', head.split('\t').length]];
    const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
    const out = [];
    let row = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < t.length; i += 1) {
        const c = t[i];
        if (q) {
            if (c === '"' && t[i + 1] === '"') {
                cur += '"';
                i += 1;
            }
            else if (c === '"')
                q = false;
            else
                cur += c;
        }
        else if (c === '"')
            q = true;
        else if (c === delim) {
            row.push(cur);
            cur = '';
        }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && t[i + 1] === '\n')
                i += 1;
            row.push(cur);
            out.push(row);
            row = [];
            cur = '';
        }
        else
            cur += c;
    }
    if (cur !== '' || row.length) {
        row.push(cur);
        out.push(row);
    }
    return out.filter((r) => r.some((c) => c.trim() !== ''));
}
