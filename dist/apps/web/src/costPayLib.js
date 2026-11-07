// KMI NEXT — Ücret Excel yardımcıları (saf fonksiyonlar; test edilebilir). Kolon adları SABİT varsayılmaz: yalnız ÖNERİ üretilir, kullanıcı onaylar.
export const slug = (s) => String(s ?? '').replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i').toLowerCase().replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, ' ').trim();
export const IDENT = [{ key: 'employee_no', label: 'Personel sicil no (güvenilir kimlik)', syn: ['sicil no', 'sicil numarasi', 'sicil', 'personel no', 'personel numarasi'] }, { key: 'name', label: 'Ad-soyad (yalnız yardımcı; tek başına kimlik sayılmaz)', syn: ['adi soyadi', 'ad soyad', 'calisan adi', 'isim'] }, { key: 'surname', label: 'Soyad (ayrı sütunsa)', syn: ['soyadi', 'soyad'], optional: true }];
export const COMPONENTS = [
    { code: 'NET', label: 'Net ücret', syn: ['net ucret', 'net maas', 'net odenen', '=net'] }, { code: 'GROSS', label: 'Brüt ücret', syn: ['brut toplam', 'aylik brut ucret', 'brut ucret', 'brut maas', '=brut'] },
    { code: 'OVERTIME', label: 'Fazla mesai tutarı (brüt DIŞINDA ek ödeme ise)', syn: [] }, { code: 'OVERTIME_INCLUDED', label: 'Brüt içindeki fazla mesai (bilgi)', syn: [] },
    { code: 'EXTRA_BENEFIT', label: 'Yan hak', syn: ['yan hak', 'yemek', 'yol'] }, { code: 'EXTRA_PAYMENT', label: 'Ek ödeme', syn: ['ek odeme', 'ilave odeme'] },
    { code: 'SGK_EMPLOYEE', label: 'SGK işçi payı', syn: ['sgk isci', 'sigorta kesintisi', 'sgk primi isci'] }, { code: 'UNEMP_EMPLOYEE', label: 'İşsizlik işçi payı', syn: ['issizlik isci'] },
    { code: 'INCOME_TAX', label: 'Gelir vergisi', syn: ['gelir vergisi'] }, { code: 'STAMP_TAX', label: 'Damga vergisi', syn: ['damga vrg', 'damga'] }, { code: 'BES', label: 'BES kesintisi', syn: ['bes kesintisi', '=bes'] },
    { code: 'SGK_EMPLOYER', label: 'SGK işveren payı', syn: ['sgk isveren', 'isv sgk hissesi', 'isveren sgk'] }, { code: 'UNEMP_EMPLOYER', label: 'İşsizlik işveren payı', syn: ['issizlik isveren'] },
    { code: 'EMPLOYER_COST_TOTAL', label: 'Toplam işveren maliyeti (dosyadaki)', syn: ['toplam isveren maliyeti', 'isveren maliyeti'] }, { code: 'TOTAL_PAID', label: 'Toplam yatan (bilgi)', syn: ['toplam yatacak', 'toplam yatan', 'toplam odenen'] }, { code: 'ADVANCE', label: 'Avans (bilgi)', syn: ['avans'] },
];
// Başlık satırı: ilk 30 satırda en çok metin hücresi olan satır (üst gruplama satırları daha az metin içerir)
export function detectHeaderRow(rows) { let best = 0, bn = -1; for (let i = 0; i < Math.min(rows.length, 30); i++) { const n = (rows[i] || []).filter((c) => typeof c === 'string' && c.trim() !== '' && !/^[\d\s.,-]+$/.test(c)).length; if (n > bn) { bn = n; best = i; } } return best; }
const MONTHS = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
export function periodFromSheetName(name) { const s = slug(name); const y = (s.match(/\b(20\d{2})\b/) || [])[1]; const m = Object.keys(MONTHS).find((k) => s.includes(k)); return y && m ? `${y}-${String(MONTHS[m]).padStart(2, '0')}` : ''; }
// önerilen eşleme: { alan: sütun indeksi } — emin değilse boş bırakır
export function suggestMapping(headers) {
    const hs = headers.map(slug); const out = {}; const used = new Set();
    const pick = (key, syn) => { for (const raw of syn) { const exact = raw.startsWith('='), sy = exact ? raw.slice(1) : raw; const i = hs.findIndex((h, ix) => !used.has(ix) && (exact ? h === sy : (h === sy || h.startsWith(sy + ' ') || h.includes(sy)))); if (i >= 0) { out[key] = i; used.add(i); return; } } };
    for (const f of IDENT) pick(f.key, f.key === 'surname' ? f.syn.map((x) => '=' + x) : f.syn);
    for (const c of COMPONENTS) pick(c.code, c.syn);
    return out;
}
// satırlar: yalnız EŞLENEN sütunlar okunur. Diğer sütunlar (TC no, IBAN, adres vb.) hiç okunmaz/gönderilmez.
export function buildRows(rows, headerRow, mapping, firstDataRow) {
    const out = []; const skipped = [];
    for (let i = firstDataRow ?? headerRow + 1; i < rows.length; i++) {
        const r = rows[i] || []; const g = (k) => (mapping[k] === undefined || mapping[k] === '' || mapping[k] === null ? undefined : r[+mapping[k]]);
        const eno = g('employee_no'); const n1 = g('name'), n2 = g('surname'); const t1 = n1 === undefined || n1 === null ? '' : String(n1).trim(), t2 = n2 === undefined || n2 === null ? '' : String(n2).trim();
        const nm = t2 && !slug(t1).endsWith(slug(t2)) ? (t1 + ' ' + t2).trim() : t1 || t2; // 'Adı Soyadı' sütunu zaten tam ad ise soyad ikinci kez eklenmez
        const amounts = {}; let any = false;
        for (const c of COMPONENTS) { const v = g(c.code); if (v !== undefined && v !== null && String(v).trim() !== '') { amounts[c.code] = v; any = true; } }
        const hasId = (eno !== undefined && eno !== null && String(eno).trim() !== '') || nm !== '';
        if (!hasId && !any) continue; // tamamen boş satır
        out.push({ row_no: i + 1, employee_no: eno === undefined || eno === null ? '' : String(eno).trim(), name: nm, amounts });
    }
    return out;
}
export const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function errorReportCsv(preview) {
    const head = ['satir', 'sicil', 'ad', 'eslesme', 'sorunlar']; const lines = [head.join(';')];
    for (const r of preview.rows || []) { if (r.match_status === 'MATCHED' && r.row_ok) continue; lines.push([r.row_no, r.employee_no, r.name, r.match_status, (r.issues || []).map((x) => x.code + (x.field ? ':' + x.field : '')).join(' | ')].map(csvCell).join(';')); }
    return lines.join('\n');
}
