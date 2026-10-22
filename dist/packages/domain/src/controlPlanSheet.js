// Kontrol planı Excel/CSV okuma (saf fonksiyon — ağ yok, tahmin yok).
// Kural: nominal ve iki tolerans sayı değilse satır PLANA GİRMEZ; "açık madde" olarak listelenir ve onayı engeller. Hiçbir değer uydurulmaz.
// Toleranslar nominale göre FARKtır (örn. 4.2 · −0.05 · +0.05), konum/doğrusallık gibi için nominal 0, alt 0, üst limit.
const fold = (s) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/\s+/g, ' ').trim();
/** '4,2' '+0.05' '−0.05' '−0,05' → number; '' → null; anything else → NaN. */
export function parseNum(raw) {
    const s = String(raw ?? '').replace(/[−–—]/g, '-').replace(/\s/g, '').replace(',', '.').replace(/^\+/, '');
    if (s === '')
        return null;
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
function colOf(h) {
    const f = fold(h);
    if (f === 'karakteristik kodu' || f === 'kod' || f === 'karakteristik' || f === 'no kodu')
        return 'code';
    if (f === 'tanim' || f === 'aciklama')
        return 'description';
    if (f === 'ozellik')
        return 'feature';
    if (f === 'nominal')
        return 'nominal';
    if (f.startsWith('alt tol'))
        return 'lo';
    if (f.startsWith('ust tol'))
        return 'hi';
    if (f === 'birim')
        return 'unit';
    if (f.startsWith('olcum yontemi') || f === 'yontem')
        return 'method';
    if (f.startsWith('siklik'))
        return 'frequency';
    if (f === 'guven')
        return 'confidence';
    return null;
}
export function parseControlPlanGrid(grid) {
    const out = { headerFound: false, rows: [], openItems: [], toVerify: [], sourceRows: 0 };
    let hi = -1;
    const cols = {};
    for (let i = 0; i < Math.min(grid.length, 20); i++) {
        const m = {};
        (grid[i] ?? []).forEach((c, j) => { const k = colOf(String(c ?? '')); if (k && m[k] === undefined)
            m[k] = j; });
        if (m.nominal !== undefined && m.lo !== undefined && m.hi !== undefined) {
            hi = i;
            Object.assign(cols, m);
            break;
        }
    }
    if (hi < 0)
        return out;
    out.headerFound = true;
    const seen = new Set();
    const get = (r, k) => { const j = cols[k]; return j === undefined ? '' : String(r[j] ?? '').trim(); };
    for (let i = hi + 1; i < grid.length; i++) {
        const r = grid[i] ?? [];
        const code = get(r, 'code');
        const desc = get(r, 'description');
        if (!code && !desc && !get(r, 'nominal'))
            continue;
        out.sourceRows += 1;
        const label = code || `satır ${i + 1}`;
        if (!code) {
            out.openItems.push({ code: label, text: `${desc || 'Kodsuz satır'}: karakteristik kodu yok` });
            continue;
        }
        const nom = parseNum(get(r, 'nominal'));
        const lo = parseNum(get(r, 'lo'));
        const up = parseNum(get(r, 'hi'));
        const bad = nom === null || lo === null || up === null || Number.isNaN(nom) || Number.isNaN(lo) || Number.isNaN(up);
        if (bad) {
            out.openItems.push({ code, text: `${desc || code}: nominal veya tolerans eksik / okunamadı` });
            continue;
        }
        if (lo > up) {
            out.openItems.push({ code, text: `${desc || code}: alt tolerans üst toleransdan büyük` });
            continue;
        }
        if (seen.has(code)) {
            out.openItems.push({ code, text: `${desc || code}: kod listede tekrar ediyor` });
            continue;
        }
        seen.add(code);
        out.rows.push({ code, description: desc || null, feature: get(r, 'feature') || null, nominal: nom, tol_lower: lo, tol_upper: up, unit: get(r, 'unit') || 'mm', method: get(r, 'method') || null, frequency: get(r, 'frequency') || null });
        const conf = fold(get(r, 'confidence'));
        if (conf.includes('dogrulanmadi') || conf.includes('olasi'))
            out.toVerify.push(code);
    }
    return out;
}
