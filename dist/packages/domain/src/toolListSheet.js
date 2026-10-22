export function readCsvGrid(text) {
    const t = text.replace(/^﻿/, '');
    const lines = t.split(/\r?\n/).filter((l) => l.trim() !== '');
    const first = lines[0] ?? '';
    const d = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
    return lines.map((l) => l.split(d).map((c) => c.replace(/"/g, '').trim()));
}
const norm = (s) => s.toLowerCase().replace(/[çğıöşüâîİ]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', İ: 'i' }[c])).replace(/[^a-z0-9]/g, '');
const ALIAS = {
    no: ['t', 'tno', 'tool', 'toolno', 'toolnumber', 'takimno', 'takim', 'takimnumarasi', 'pozisyon', 'pocket', 'tnumber'],
    desc: ['aciklama', 'tanim', 'description', 'takimadi', 'takimtanimi', 'ad', 'adi'],
    dia: ['dia', 'diameter', 'diametermm', 'cap', 'capmm', 'capi', 'toolcap', 'takimcapi'],
    len: ['l', 'length', 'uzunluk', 'boy', 'boymm', 'oal', 'toollength', 'takimboyu', 'takimuzunlugu', 'gaugelength', 'baglamaboyu'],
    holder: ['holder', 'holdercode', 'tutucu', 'tutucukodu', 'tutucuadi', 'kovan', 'collet', 'takimtutucu'],
    offset: ['offset', 'ofset', 'offsetno', 'ofsetno', 'hno', 'hoffset', 'lengthoffset', 'duzeltme', 'dno', 'hd', 'hdno', 'hduzeltme'],
    type: ['type', 'tip', 'tipi', 'tur', 'tooltype', 'takimtipi'], code: ['takimkodu', 'kod', 'code', 'katalogkodu', 'toolcode'],
};
const isT = (s) => /^T\s*0*\d{1,4}$/i.test(s.trim());
/** A tool number cell: "T8", or — only when the header said so — a plain number (Fusion / engineer sheets write 8, 24 …; "8.0" from a numeric cell too). */
const isTool = (s, plain) => isT(s) || (plain === true && /^\d{1,4}(\.0+)?$/.test(s.trim()));
const toolNo = (s) => { const v = s.trim(); return /^\d/.test(v) ? 'T' + Number(v) : v.toUpperCase().replace(/\s+/g, ''); };
/** Looks for the header row (first rows) and the data columns. Header text decides; the description column is the one that carries "Ø…" patterns when no header says so. */
export function guessMapping(g) {
    const none = { no: null, desc: null, dia: null, len: null, holder: null, offset: null, type: null, code: null };
    let best = { headerRow: 0, cols: none, diaFromDesc: false };
    let bestScore = -1;
    for (let r = 0; r < Math.min(g.length, 30); r++) {
        const cols = { ...none };
        let score = 0;
        (g[r] ?? []).forEach((cell, c) => { const n = norm(cell ?? ''); if (!n)
            return; for (const key of Object.keys(ALIAS))
            if (cols[key] === null && ALIAS[key].includes(n)) {
                cols[key] = c;
                score += key === 'no' ? 5 : 1;
            } });
        if (cols.no !== null && score > bestScore) {
            best = { headerRow: r, cols, diaFromDesc: false };
            bestScore = score;
        }
    }
    best.plainNo = best.cols.no !== null;
    const dataRows = g.slice(best.headerRow + 1).filter((row) => best.cols.no !== null && isTool(row[best.cols.no] ?? '', best.plainNo));
    if (best.cols.no === null) { // no usable header: fall back to the column that holds T-codes
        const width = Math.max(0, ...g.map((r) => r.length));
        for (let c = 0; c < width; c++)
            if (g.filter((r) => isT(r[c] ?? '')).length >= 2) {
                best.cols.no = c;
                best.plainNo = false;
                break;
            }
    }
    if (best.cols.no !== null && best.cols.desc === null && best.cols.dia === null) {
        const width = Math.max(0, ...dataRows.map((r) => r.length));
        let top = 0;
        for (let c = 0; c < width; c++) {
            const hit = dataRows.filter((r) => /Ø\s*\d/.test(r[c] ?? '')).length;
            if (hit > top) {
                top = hit;
                best.cols.desc = c;
            }
        }
    }
    best.diaFromDesc = best.cols.dia === null && best.cols.desc !== null && dataRows.some((r) => /Ø\s*\d/.test(r[best.cols.desc] ?? ''));
    return best;
}
export function normalizeSheet(g, m) {
    const c = m.cols;
    const rows = [];
    if (c.no === null)
        return { csv: '', rows, header: [], missing: ['takım no'] };
    for (const r of g.slice(m.headerRow + 1)) {
        const t = (r[c.no] ?? '').trim();
        if (!isTool(t, m.plainNo))
            continue;
        const cell = (i) => (i === null ? '' : (r[i] ?? '').trim());
        const desc = cell(c.desc);
        const dia = c.dia !== null ? cell(c.dia) : m.diaFromDesc ? (/Ø\s*(\d+(?:[.,]\d+)?)/.exec(desc)?.[1] ?? '') : '';
        rows.push({ t: toolNo(t), dia, len: cell(c.len), holder: cell(c.holder), offset: cell(c.offset), type: cell(c.type), desc, code: cell(c.code) });
    }
    const cols = [['T', 't', true], ['Cap', 'dia', c.dia !== null || m.diaFromDesc], ['Boy', 'len', c.len !== null], ['Tutucu', 'holder', c.holder !== null], ['Offset', 'offset', c.offset !== null], ['Tip', 'type', c.type !== null]];
    const used = cols.filter((x) => x[2]);
    const header = used.map((x) => x[0]);
    const csv = [header.join(';'), ...rows.map((r) => used.map((x) => r[x[1]].replace(/[;\r\n]/g, ' ')).join(';'))].join('\n');
    const missing = cols.filter((x) => !x[2]).map((x) => ({ Cap: 'çap', Boy: 'boy', Tutucu: 'tutucu', Offset: 'offset', Tip: 'takım türü' }[x[0]]));
    return { csv, rows, header, missing };
}
/** Tool-change → length-offset pairs read from NC text. Only what the program itself states: the tool in force is the one named by the last T word at an M6/M06 (same block or a later one); an offset is the H of a G43/G43.1/G44 block. A tool with exactly ONE distinct H gets a suggestion; zero or several → no suggestion (never a guess). */
export function ncToolOffsets(text) {
    const order = [];
    const hs = new Map();
    let pending = null;
    let cur = null;
    const lines = text.replace(/\([^)]*\)/g, ' ').split(/\r?\n/).map((l) => l.split(';')[0].replace(/^\s*N\d+\s*/i, '').toUpperCase());
    for (const l of lines) {
        const t = /(?:^|[^A-Z0-9])T\s*0*(\d{1,4})(?![0-9.])/.exec(l);
        if (t)
            pending = 'T' + t[1];
        if (/(?:^|[^A-Z0-9])M\s*0*6(?![0-9])/.test(l) && pending) {
            cur = pending;
            if (!order.includes(cur)) {
                order.push(cur);
                hs.set(cur, new Set());
            }
        }
        if (cur && /(?:^|[^A-Z0-9])G\s*0*(43|44)(?:\.1)?(?![0-9])/.test(l)) {
            const h = /(?:^|[^A-Z0-9])H\s*0*(\d{1,3})(?![0-9.])/.exec(l);
            if (h && h[1] !== '0')
                hs.get(cur).add(h[1]);
        }
    }
    return order.map((t) => { const h = [...(hs.get(t) ?? [])]; return { t, h, suggestion: h.length === 1 ? h[0] : null }; });
}
/** Rebuilds the normalized text from (possibly completed) rows. A column is written only when at least one row has a value in it, so an empty column is never faked. */
export function csvFromRows(rows) {
    const defs = [['T', 't'], ['Cap', 'dia'], ['Boy', 'len'], ['Tutucu', 'holder'], ['Offset', 'offset'], ['Tip', 'type']];
    const used = defs.filter(([, k]) => k === 't' || rows.some((r) => r[k].trim() !== ''));
    const header = used.map((x) => x[0]);
    return { csv: [header.join(';'), ...rows.map((r) => used.map(([, k]) => r[k].replace(/[;\r\n]/g, ' ')).join(';'))].join('\n'), header };
}
/** Header texts of columns that carry data but were NOT mapped to a tool field — shown in the preview, never silently dropped. */
export function unmappedColumns(g, m) {
    const used = new Set(Object.values(m.cols).filter((x) => x !== null));
    const head = g[m.headerRow] ?? [];
    const out = [];
    head.forEach((h, i) => { const name = (h ?? '').replace(/\s+/g, ' ').trim().replace(/:$/, ''); if (!name || used.has(i))
        return; if (g.slice(m.headerRow + 1).some((r) => (r[i] ?? '').trim() !== ''))
        out.push(name); });
    return out;
}
/** Nominal diameters the NC program itself declares in its tool comments, e.g. "(T7  D=3.8 CR=0. TAPER=40deg - …)". A cross-check only: never filled in, never a measurement. */
export function ncDeclaredDiameters(text) {
    const out = new Map();
    const re = /\(\s*T\s*0*(\d{1,4})\s+D\s*=\s*(\d+(?:[.,]\d+)?)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        const t = 'T' + Number(m[1]);
        if (!out.has(t))
            out.set(t, m[2].replace(',', '.'));
    }
    return out;
}
