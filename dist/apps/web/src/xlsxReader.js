// KMI NEXT — Bağımlılıksız XLSX okuyucu (tarayıcıda çalışır; dosya SUNUCUYA GÖNDERİLMEZ). Yalnız istenen sayfayı açar.
// ZIP merkezi dizini + DecompressionStream('deflate-raw') + basit XML ayrıştırma. Formül hücrelerinde saklı değeri okur.
// Sınırlar mevcut KMI okuyucusuyla (packages/domain/src/xlsxRead.js) aynıdır; fark: yalnız seçilen sayfa açılır (aylık 100+ sayfalı bordro dosyaları için).
export const LIMITS = { maxEntries: 400, maxEntryBytes: 25_000_000, maxRows: 50_000, maxCols: 200 };
const dec = new TextDecoder('utf-8');
const u16 = (d, o) => d[o] | (d[o + 1] << 8), u32 = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
async function inflateRaw(bytes) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
export function listZip(buf) {
    const d = new Uint8Array(buf); let e = -1;
    for (let i = d.length - 22; i >= Math.max(0, d.length - 65558); i--) if (u32(d, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('XLSX_INVALID: ZIP bulunamadı (dosya .xlsx olmayabilir)');
    const n = u16(d, e + 10); let p = u32(d, e + 16); const out = new Map(); if (n > LIMITS.maxEntries) throw new Error('XLSX_TOO_LARGE: çok fazla zip girdisi');
    for (let i = 0; i < n; i++) {
        if (u32(d, p) !== 0x02014b50) throw new Error('XLSX_INVALID: bozuk dizin');
        const method = u16(d, p + 10), csize = u32(d, p + 20), usize = u32(d, p + 24), nl = u16(d, p + 28), el = u16(d, p + 30), cl = u16(d, p + 32), lho = u32(d, p + 42);
        if (usize > LIMITS.maxEntryBytes) throw new Error('XLSX_TOO_LARGE: açılmış boyut sınırı aşıldı'); const name = dec.decode(d.subarray(p + 46, p + 46 + nl)); out.set(name, { method, csize, usize, lho }); p += 46 + nl + el + cl;
    }
    return { d, entries: out };
}
async function readEntry(z, name) {
    const en = z.entries.get(name); if (!en) return null; const o = en.lho, nl = u16(z.d, o + 26), el = u16(z.d, o + 28); const start = o + 30 + nl + el;
    const raw = z.d.subarray(start, start + en.csize); const bytes = en.method === 0 ? raw : en.method === 8 ? await inflateRaw(raw) : null;
    if (!bytes) throw new Error('XLSX_INVALID: desteklenmeyen sıkıştırma'); return dec.decode(bytes);
}
const ent = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const textOf = (x) => { let t = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(x))) t += m[1]; return ent(t); };
const colIdx = (ref) => { const l = ref.match(/^[A-Z]+/)[0]; let n = 0; for (const ch of l) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
export async function openXlsx(buf) {
    const z = listZip(buf);
    const wb = await readEntry(z, 'xl/workbook.xml'); if (!wb) throw new Error('XLSX_INVALID: workbook.xml yok');
    const rels = await readEntry(z, 'xl/_rels/workbook.xml.rels') || '';
    const relMap = {}; for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const t = m[0]; const id = (t.match(/\bId="([^"]*)"/) || [])[1], tg = (t.match(/\bTarget="([^"]*)"/) || [])[1]; if (id && tg) relMap[id] = tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, ''); }
    const sheets = []; for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) { const t = m[0]; const name = ent((t.match(/\bname="([^"]*)"/) || [])[1] || ''); const rid = (t.match(/\br:id="([^"]*)"/) || [])[1]; if (name && rid && relMap[rid]) sheets.push({ name, path: relMap[rid] }); }
    let shared = null;
    const getShared = async () => { if (shared) return shared; shared = []; const x = await readEntry(z, 'xl/sharedStrings.xml'); if (x) for (const m of x.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1])); return shared; };
    return {
        sheetNames: sheets.map((s) => s.name),
        async readSheet(name, maxRows = LIMITS.maxRows) {
            const sh = sheets.find((s) => s.name === name); if (!sh) throw new Error('SHEET_NOT_FOUND'); const xml = await readEntry(z, sh.path); const ss = await getShared(); const rows = [];
            for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
                const rn = +((rm[1].match(/\br="(\d+)"/) || [])[1] || rows.length + 1); if (rn > maxRows) break; const arr = [];
                for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
                    const a = cm[1], body = cm[2] || ''; const ref = (a.match(/\br="([A-Z]+\d+)"/) || [])[1]; if (!ref) continue; const t = (a.match(/\bt="([^"]*)"/) || [])[1]; const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
                    let val = null;
                    if (t === 'inlineStr') val = textOf(body); else if (v === undefined) val = null; else if (t === 's') val = ss[+v] ?? null; else if (t === 'str') val = ent(v); else if (t === 'b') val = v === '1'; else if (t === 'e') val = null; else { const n = Number(v); val = Number.isFinite(n) ? n : ent(v); }
                    const ci = colIdx(ref); if (ci < LIMITS.maxCols) arr[ci] = val;
                }
                rows[rn - 1] = arr;
            }
            for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
            return rows;
        },
    };
}
export async function sha256Hex(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
