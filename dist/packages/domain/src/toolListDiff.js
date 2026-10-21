export const TOOL_FIELDS = ['type', 'dia', 'len', 'holder', 'offset', 'desc'];
export const normToolNo = (t) => { const m = /^T?\s*0*(\d{1,4})$/i.exec(t.trim()); return m ? `T${Number(m[1])}` : null; };
/** Same normalisation as the SQL function: decimal comma → dot, no trailing zeros, offset = digits of "H7"/"D7"/"7", type upper-case. */
export function normValue(field, raw) {
    const v = raw.trim();
    if (v === '')
        return '';
    if (field === 'dia' || field === 'len') {
        const x = v.replace(',', '.');
        if (!/^\d{1,4}(\.\d{1,4})?$/.test(x) || Number(x) <= 0)
            return v;
        return x.includes('.') ? x.replace(/0+$/, '').replace(/\.$/, '') : x;
    }
    if (field === 'offset') {
        const m = /^[HD]?\s*(\d{1,3})$/i.exec(v);
        return m ? String(Number(m[1])) : v;
    }
    if (field === 'type')
        return v.toUpperCase().slice(0, 40);
    if (field === 'holder')
        return v.slice(0, 60);
    return v.slice(0, 120);
}
export const isValidValue = (field, raw) => {
    const v = raw.trim();
    if (v === '')
        return true;
    if (field === 'dia' || field === 'len')
        return /^\d{1,4}([.,]\d{1,4})?$/.test(v) && Number(v.replace(',', '.')) > 0;
    if (field === 'offset')
        return /^[HD]?\s*\d{1,3}$/i.test(v);
    return true;
};
export const CRITICAL = ['dia', 'len', 'holder', 'offset'];
export function missingCells(rows) {
    return Object.values(rows).flatMap((r) => CRITICAL.filter((f) => (r[f] ?? '').trim() === '').map((f) => ({ t: r.t, field: f })));
}
export function diffExcel(current, incoming) {
    const out = { changes: [], newTools: [], unmatched: [], same: 0, blankIgnored: 0 };
    const seen = new Set();
    for (const r of incoming) {
        const t = normToolNo(r.t);
        if (!t || seen.has(t))
            continue;
        seen.add(t);
        const cur = current[t];
        if (!cur)
            out.newTools.push(t);
        const inc = { desc: r.desc, type: r.type, dia: r.dia, len: r.len, holder: r.holder, offset: r.offset };
        for (const f of TOOL_FIELDS) {
            const next = normValue(f, inc[f]);
            const old = cur ? (cur[f] ?? '') : '';
            if (next === '') {
                out.blankIgnored += 1;
                continue;
            }
            if (next === old) {
                out.same += 1;
                continue;
            }
            const protectedByKmi = !!cur && old !== '' && cur.src?.[f] === 'KMI';
            out.changes.push({ t, field: f, old, next, newTool: !cur, conflict: old !== '', protectedByKmi, selected: !protectedByKmi });
        }
    }
    out.unmatched = Object.keys(current).filter((t) => !seen.has(t)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    return out;
}
export const sortedTools = (rows) => Object.values(rows).sort((a, b) => Number(a.t.slice(1)) - Number(b.t.slice(1)));
