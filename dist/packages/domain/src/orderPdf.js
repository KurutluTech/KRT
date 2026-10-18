export const fold = (s) => s.replace(/İ/g, 'I').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
/** Turkish/European/US number: "1.500"→1500 (dot+3 digits, no comma), "256.620,00"→256620, "1,234.50"→1234.5, "12,5"→12.5. null if not a number. */
export function parseNumber(raw) {
    let s = raw.trim().replace(/^[^\d-]+|[^\d]+$/g, '');
    if (!/^-?\d[\d.,]*$/.test(s))
        return null;
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
        s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    }
    else if (lastComma >= 0) {
        s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    }
    else if (lastDot >= 0) {
        s = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
/** dd.mm.yyyy | dd/mm/yyyy | dd-mm-yyyy | yyyy-mm-dd → ISO date, or null when not a REAL calendar date (OCR "45.01.2026" is rejected). */
export function parseDate(raw) {
    let d, m, y;
    let r = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
    if (r) {
        y = +r[1];
        m = +r[2];
        d = +r[3];
    }
    else {
        r = /(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/.exec(raw);
        if (!r)
            return null;
        d = +r[1];
        m = +r[2];
        y = +r[3];
        if (y < 100)
            y += 2000;
    }
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (m < 1 || m > 12 || y < 2000 || y > 2100 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
        return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const CUR = [[/\bEUR\b|€/, 'EUR'], [/\bUSD\b|\$/, 'USD'], [/\bGBP\b|£/, 'GBP'], [/\bTRY\b|\bTL\b|₺/, 'TRY']];
const UNITS = new Set(['ADET', 'AD', 'ADT', 'PCS', 'PC', 'EA', 'KG', 'M', 'MT', 'SET', 'TAKIM']);
const DATE_TOKEN = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
const NUM_TOKEN = /^-?\d[\d.,]*$/;
const field = (value, confidence) => ({ value, confidence });
export function parseOrderText(inputLines, extractor = 'text-layer') {
    const warnings = [];
    const raw = inputLines.map((l) => l.replace(/\s+$/g, '')).filter((l) => l.trim() !== '');
    const F = raw.map(fold);
    const header = { po_number: null, po_date: null, currency: null, payment_terms: null, delivery_terms: null, customer_name: null, customer_no: null, delivery_date: null, notes: null };
    const after = (i, re) => { const m = re.exec(F[i]); if (!m)
        return null; return raw[i].slice(m.index + m[0].length).replace(/^[\s:.\-–]+/, '').trim() || (raw[i + 1]?.trim() ?? null); };
    for (let i = 0; i < raw.length; i++) {
        if (!header.po_number) {
            const v = after(i, /(SIPARIS\s*(NO|NUMARASI)|PO\s*(NO|NUMBER|#)|PURCHASE\s*ORDER(\s*NO)?|ORDER\s*(NO|NUMBER))\b\.?/);
            const tok = v?.match(/[A-Z0-9][A-Z0-9\-/_.]{2,}/i)?.[0];
            if (tok)
                header.po_number = field(tok, 0.9);
        }
        if (!header.po_date) {
            const m = /(SIPARIS\s*TARIHI|ORDER\s*DATE|PO\s*DATE|BELGE\s*TARIHI)/.exec(F[i]);
            if (m) {
                const d = parseDate(raw[i].slice(m.index)) ?? (raw[i + 1] ? parseDate(raw[i + 1]) : null);
                if (d)
                    header.po_date = field(d, 0.9);
                else
                    warnings.push('PO_DATE_UNREADABLE');
            }
        }
        if (!header.delivery_date) {
            const m = /(TESLIM\s*(TARIHI|TARIHLERI)?|TERMIN|DELIVERY\s*DATE)/.exec(F[i]);
            if (m && !/SEKLI/.test(F[i])) {
                const d = parseDate(raw[i].slice(m.index));
                if (d)
                    header.delivery_date = field(d, 0.7);
            }
        }
        if (!header.customer_no) {
            const v = after(i, /(MUSTERI\s*(NO|KODU)|CUSTOMER\s*(NO|ID|CODE))\b\.?/);
            const tok = v?.match(/[A-Z0-9][A-Z0-9\-/_.]{1,}/i)?.[0];
            if (tok)
                header.customer_no = field(tok, 0.8);
        }
        if (!header.payment_terms) {
            const v = after(i, /(ODEME(\s*(SEKLI|KOSULU|KOSULLARI|VADESI))?|PAYMENT(\s*TERMS)?)\b/);
            if (v && v.length > 2)
                header.payment_terms = field(v, 0.7);
        }
        if (!header.delivery_terms) {
            const v = after(i, /(TESLIM\s*SEKLI|INCOTERMS?|DELIVERY\s*TERMS)\b/);
            if (v && v.length > 1)
                header.delivery_terms = field(v, 0.7);
        }
        if (!header.notes && /(GECIKME|CEZA|PENALTY|LATE\s*DELIVERY)/.test(F[i]))
            header.notes = field(raw[i].trim(), 0.6);
    }
    if (!header.po_number) {
        const i = F.findIndex((l) => /\b[A-Z]{1,3}\d{4,}\b/.test(l) && !/KURUTLU/.test(l));
        const tok = i >= 0 ? /\b[A-Z]{1,3}\d{4,}\b/.exec(F[i])?.[0] : null;
        if (tok) {
            header.po_number = field(tok, 0.5);
            warnings.push('PO_NUMBER_UNLABELED');
        }
        else
            warnings.push('PO_NUMBER_MISSING');
    }
    if (!header.po_date) {
        for (const l of raw) {
            const t = l.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/)?.[0];
            const d = t ? parseDate(t) : null;
            if (d) {
                header.po_date = field(d, 0.5);
                warnings.push('PO_DATE_UNLABELED');
                break;
            }
        }
        if (!header.po_date)
            warnings.push('PO_DATE_MISSING');
    }
    const whole = raw.join('\n');
    for (const [re, cur] of CUR)
        if (re.test(whole.toUpperCase().replace(/İ/g, 'I'))) {
            header.currency = field(cur, 0.7);
            break;
        }
    if (!header.currency)
        warnings.push('CURRENCY_MISSING');
    const co = raw.findIndex((l, i) => /\b(A\.?\s?S\.?|LTD|LIMITED|SAN\.|TIC\.|INC|GMBH|S\.A\.|CO\.|SPA|SRL|AG)\b/.test(F[i]) && !/KURUTLU/.test(F[i]) && l.length < 90);
    if (co >= 0)
        header.customer_name = field(raw[co].trim(), 0.6);
    else
        warnings.push('CUSTOMER_NAME_MISSING');
    if (header.po_date && header.delivery_date && header.delivery_date.value < header.po_date.value)
        warnings.push('DELIVERY_BEFORE_ORDER_DATE');
    const lines = [];
    for (let i = 0; i < raw.length; i++) {
        if (/TOPLAM|TOTAL|KDV|VAT|ARA\s*TOP|GENEL/.test(F[i]))
            continue;
        const toks = raw[i].trim().split(/\s+/);
        if (toks.length < 4)
            continue;
        let k = 0;
        let lineNo = null;
        if (/^\d{1,3}$/.test(toks[0]) && toks.length > 4) {
            lineNo = +toks[0];
            k = 1;
        }
        const code = toks[k];
        if (!/\d/.test(code) || code.length < 3 || DATE_TOKEN.test(code) || NUM_TOKEN.test(code) && !/^\d{5,}$/.test(code))
            continue;
        let dueDate = null;
        const tail = [];
        let end = toks.length;
        while (end > k + 1) {
            const t = toks[end - 1];
            if (DATE_TOKEN.test(t)) {
                dueDate = parseDate(t);
                end--;
                if (!dueDate)
                    warnings.push(`LINE_${lineNo ?? lines.length + 1}_DATE_UNREADABLE`);
                continue;
            }
            if (NUM_TOKEN.test(t) && parseNumber(t) !== null) {
                tail.unshift(t);
                end--;
                continue;
            }
            if (/^(TL|TRY|EUR|USD|GBP|€|\$|₺|£)$/i.test(t) && tail.length) {
                end--;
                continue;
            }
            break;
        }
        let unit = null;
        if (end > k + 1 && UNITS.has(fold(toks[end - 1]))) {
            unit = toks[end - 1];
            end--;
        }
        if (tail.length < 2 || tail.length > 4)
            continue;
        const nums = tail.map((t) => parseNumber(t));
        const qty = nums[0];
        let price = nums[1];
        const total = nums.length >= 3 ? nums[nums.length - 1] : null;
        if (!(qty > 0))
            continue;
        const no = lineNo ?? lines.length + 1;
        let conf = 0.85;
        let derived = false;
        if (total !== null && Math.abs(qty * price - total) > Math.max(0.05, total * 0.005)) {
            const dp = Math.round((total / qty) * 10000) / 10000;
            warnings.push(`LINE_${no}_PRICE_TOTAL_MISMATCH`);
            price = dp;
            derived = true;
            conf = 0.5;
        }
        let lineTotal = total;
        if (tail.length === 2) { // only qty + one amount: that amount is most likely the line TOTAL → price derived and flagged, never trusted
            lineTotal = nums[1];
            price = Math.round((lineTotal / qty) * 10000) / 10000;
            derived = true;
            conf = 0.5;
            warnings.push(`LINE_${no}_PRICE_DERIVED_FROM_TOTAL`);
        }
        const desc = toks.slice(k + 1, end).join(' ');
        lines.push({ line_no: no, customer_part_no: code, description: desc, qty, unit, unit_price: price, line_total: lineTotal, due_date: dueDate, confidence: conf, ...(derived ? { price_derived: true } : {}), raw: raw[i].trim() });
    }
    if (!lines.length)
        warnings.push('NO_LINES_FOUND');
    const seen = new Set();
    for (const l of lines) {
        if (seen.has(l.line_no)) {
            warnings.push(`DUPLICATE_LINE_NO_${l.line_no}`);
        }
        seen.add(l.line_no);
    }
    return { extractor, header, lines, warnings };
}
// ---- OCR path -------------------------------------------------------------------------------
// OCR output is NEVER verified data: every field is capped at a low confidence, the extraction carries
// OCR_UNVERIFIED, and the manager must confirm each value. Only systematic, well-known OCR confusions are repaired
// (table borders read as "|"/"_", a stray "!" after a number, O for 0 inside a part code).
const PART_CODE = /^([A-Z]\d{3}[A-Z]{3})([0-9O]{2})$/;
export function normalizeOcrText(text) {
    return text.split(/\r?\n/).map((line) => line
        .replace(/[|_¦]+/g, ' ')
        .split(/\s+/).filter(Boolean)
        .map((t) => {
        const core = t.replace(/[!:;]+$/, '');
        const m = PART_CODE.exec(fold(core));
        if (m)
            return core.slice(0, 7) + m[2].replace(/O/g, '0');
        return /^[\d.,]+$/.test(core) ? core : t;
    }).join(' ')).filter((l) => l.trim() !== '');
}
export const OCR_MAX_CONFIDENCE = 0.5;
export function parseOcrText(text, engine = 'tesseract') {
    const ex = parseOrderText(normalizeOcrText(text), `ocr:${engine}`);
    const cap = (f) => { if (f)
        f.confidence = Math.min(f.confidence, OCR_MAX_CONFIDENCE); };
    for (const k of Object.keys(ex.header))
        cap(ex.header[k]);
    for (const l of ex.lines)
        l.confidence = Math.min(l.confidence, OCR_MAX_CONFIDENCE);
    ex.warnings.unshift('OCR_UNVERIFIED');
    const gl = normalizeOcrText(text).find((l) => /GENEL\s*TOPLAM|GRAND\s*TOTAL/.test(fold(l)));
    const gt = gl ? parseNumber((gl.match(/([\d.,]+)\s*(?:TRY|TL|EUR|USD|€|\$|₺)?\s*$/i)?.[1] ?? '').trim()) : null;
    if (gl && gt === null)
        ex.warnings.push('GRAND_TOTAL_UNREADABLE');
    if (gt !== null) {
        const sum = ex.lines.reduce((a, l) => a + (l.line_total ?? 0), 0);
        if (Math.abs(sum - gt) > Math.max(0.05, gt * 0.001))
            ex.warnings.push('GRAND_TOTAL_MISMATCH');
    }
    return ex;
}
