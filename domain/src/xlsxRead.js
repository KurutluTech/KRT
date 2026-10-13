export const DEFAULT_XLSX_LIMITS = { maxEntries: 400, maxEntryBytes: 25_000_000, maxTotalBytes: 60_000_000, maxRows: 50_000, maxCols: 200 };
export class XlsxError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'XlsxError';
    }
}
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const utf8 = (b) => new TextDecoder('utf-8').decode(b);
function readZipDirectory(z, lim) {
    if (z.length < 22 || u32(z, 0) !== 0x04034b50)
        throw new XlsxError('NOT_XLSX', 'Dosya bir .xlsx (zip) değil');
    let eocd = -1;
    for (let i = z.length - 22; i >= Math.max(0, z.length - 22 - 65535); i -= 1)
        if (u32(z, i) === 0x06054b50) {
            eocd = i;
            break;
        }
    if (eocd < 0)
        throw new XlsxError('CORRUPT', 'Zip bitiş kaydı bulunamadı');
    const count = u16(z, eocd + 10);
    let p = u32(z, eocd + 16);
    if (count > lim.maxEntries)
        throw new XlsxError('TOO_LARGE', `Çok fazla zip girdisi (${count})`);
    const out = new Map();
    let total = 0;
    for (let i = 0; i < count; i += 1) {
        if (p + 46 > z.length || u32(z, p) !== 0x02014b50)
            throw new XlsxError('CORRUPT', 'Zip dizini bozuk');
        const flags = u16(z, p + 8), method = u16(z, p + 10), csize = u32(z, p + 20), usize = u32(z, p + 24), nl = u16(z, p + 28), el = u16(z, p + 30), cl = u16(z, p + 32), offset = u32(z, p + 42);
        const name = utf8(z.subarray(p + 46, p + 46 + nl));
        if (usize > lim.maxEntryBytes)
            throw new XlsxError('TOO_LARGE', `${name} çok büyük`);
        total += usize;
        if (total > lim.maxTotalBytes)
            throw new XlsxError('TOO_LARGE', 'Toplam açılmış boyut sınırı aşıldı');
        out.set(name, { name, method, csize, usize, offset, flags });
        p += 46 + nl + el + cl;
    }
    return out;
}
async function readEntry(z, e, inflate) {
    if (e.flags & 1)
        throw new XlsxError('ENCRYPTED', 'Şifreli dosya desteklenmez');
    if (u32(z, e.offset) !== 0x04034b50)
        throw new XlsxError('CORRUPT', 'Yerel başlık bozuk');
    const start = e.offset + 30 + u16(z, e.offset + 26) + u16(z, e.offset + 28);
    const data = z.subarray(start, start + e.csize);
    const raw = e.method === 0 ? data : e.method === 8 ? await inflate(data) : (() => { throw new XlsxError('CORRUPT', `Desteklenmeyen sıkıştırma ${e.method}`); })();
    if (raw.length > e.usize + 8 || raw.length > 25_000_000)
        throw new XlsxError('TOO_LARGE', `${e.name} beyan edilenden büyük açıldı`);
    return raw;
}
const unesc = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? unesc(m[1]) : null; };
const textOf = (xml) => { let s = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(xml)))
    s += m[1]; return unesc(s); };
/** "C12" -> zero-based column index 2 */
export function colIndex(ref) { const m = /^([A-Z]+)/.exec(ref); if (!m)
    return -1; let n = 0; for (const ch of m[1])
    n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
export async function readXlsx(bytes, inflate, limits = DEFAULT_XLSX_LIMITS) {
    const dir = readZipDirectory(bytes, limits);
    if (!dir.has('xl/workbook.xml'))
        throw new XlsxError('NOT_XLSX', 'xl/workbook.xml yok — bu bir Excel çalışma kitabı değil');
    const get = async (n) => { const e = dir.get(n); return e ? utf8(await readEntry(bytes, e, inflate)) : null; };
    const wb = (await get('xl/workbook.xml'));
    const rels = (await get('xl/_rels/workbook.xml.rels')) ?? '';
    const relTarget = new Map();
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
        const id = attr(m[0], 'Id'), t = attr(m[0], 'Target');
        if (id && t)
            relTarget.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`);
    }
    const shared = [];
    const ss = await get('xl/sharedStrings.xml');
    if (ss)
        for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
            shared.push(textOf(m[1]));
    const sheets = [];
    for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
        const name = attr(m[0], 'name');
        const rid = attr(m[0], 'r:id') ?? attr(m[0], 'id');
        const target = rid ? relTarget.get(rid) : undefined;
        if (!name || !target)
            continue;
        const xml = await get(target);
        if (xml === null)
            continue;
        const rows = [];
        for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
            const rowNo = Number(attr(`<x${rm[1]}`, 'r') ?? rows.length + 1);
            if (rowNo > limits.maxRows)
                throw new XlsxError('TOO_LARGE', `Satır sınırı ${limits.maxRows} aşıldı`);
            const cells = [];
            let next = 0;
            for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
                const ref = attr(`<x${cm[1]}`, 'r');
                const t = attr(`<x${cm[1]}`, 't');
                const idx = ref ? colIndex(ref) : next;
                if (idx < 0 || idx >= limits.maxCols)
                    continue;
                const inner = cm[2] ?? '';
                const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
                let val = '';
                if (t === 's')
                    val = v === undefined ? '' : (shared[Number(v)] ?? '');
                else if (t === 'inlineStr')
                    val = textOf(inner);
                else if (t === 'b')
                    val = v === '1' ? 'TRUE' : 'FALSE';
                else if (t === 'e')
                    val = ''; // error cell (#DIV/0!…) is NOT a value
                else
                    val = v === undefined ? '' : unesc(v); // numbers and str (formula cache) — the formula text (<f>) is never read
                while (cells.length < idx)
                    cells.push('');
                cells[idx] = val;
                next = idx + 1;
            }
            while (rows.length < rowNo - 1)
                rows.push([]);
            rows[rowNo - 1] = cells;
        }
        sheets.push({ name, rows });
    }
    if (!sheets.length)
        throw new XlsxError('NO_SHEET', 'Çalışma kitabında okunabilir sayfa yok');
    return sheets;
}
/** Excel stores dates as serial days (1900 system). Returns ISO date or null. Only for cells the caller knows are dates. */
export function excelSerialToIso(serial) {
    if (!Number.isFinite(serial) || serial < 1 || serial > 2958465)
        return null;
    const ms = Math.round((serial - (serial >= 60 ? 25569 : 25568)) * 86400000);
    const d = new Date(ms);
    return d.toISOString().slice(0, 10);
}
