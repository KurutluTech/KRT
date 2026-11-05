// NC analizinden takım listesi satırları (saf fonksiyonlar). NC'de olmayan değer ÜRETİLMEZ; boş kalır.
import { csvFromRows, guessMapping, normalizeSheet, readCsvGrid } from './toolListSheet.js';
import { matchKmiTools } from './ncAnalysis.js';

/** analysis.toolDraft → düzenlenebilir satırlar. Ofset yalnız NC'de TEK bir H varsa (freze) ya da torna T kodundan okunur. */
export function draftRows(analysis, kmiTools = []) {
    const seen = new Set(); const draft = (analysis?.toolDraft ?? []).filter((d) => (seen.has(d.t) ? false : seen.add(d.t)));
    const matches = matchKmiTools(draft, kmiTools);
    return draft.map((d, i) => {
        const hs = [...new Set((d.hCodes ?? []).map((x) => String(x).replace(/^H/i, '')))];
        const offset = d.lathe ? String(d.lathe.offset) : hs.length === 1 ? hs[0] : '';
        return {
            t: d.t, desc: d.description ?? '', dia: d.diameterMm != null ? String(d.diameterMm) : '', len: d.lengthMm != null ? String(d.lengthMm) : '',
            holder: d.holderText && d.holderText !== d.description ? d.holderText : '', offset, type: d.typeGuess ?? '', code: d.libraryRef ?? '',
            inferredType: !!d.typeGuess, usedInProgram: !!d.usedInProgram, match: matches[i].status, cardCode: matches[i].cardCode,
            ambiguousOffset: !d.lathe && hs.length > 1,
            holderSuggestion: holderSuggestion(d.description ?? ''), taper: taperOf(d.description ?? ''),
        };
    });
}
const clean = (v) => String(v ?? '').replace(/[;\r\n"]/g, ' ').trim();
/** Yüklenecek dosya (T;Açıklama;Çap;Boy;Tutucu;Offset;Tip;Kod) — mevcut takım listesi okuyucusunun başlık takma adlarıyla uyumlu. */
export function rowsToCsv(rows) {
    const head = ['T', 'Açıklama', 'Çap', 'Boy', 'Tutucu', 'Offset', 'Tip', 'Kod'];
    return '﻿' + [head, ...rows.map((r) => [r.t, r.desc, r.dia, r.len, r.holder, r.offset, r.type, r.code].map(clean))].map((x) => x.join(';')).join('\r\n') + '\r\n';
}
/** Sunucuya kaydedilen normalize içerik + eşleme (toolist_content_save girdisi). Aynı yol: mevcut "eşle ve kaydet". */
export function normalizedContent(rows) {
    const g = readCsvGrid(rowsToCsv(rows)); const m = guessMapping(g); const n = normalizeSheet(g, m);
    return { csv: n.csv, rows: n.rows, mapping: { headerRow: m.headerRow, cols: m.cols, diaFromDesc: m.diaFromDesc, rows: n.rows.length } };
}
/** Eski kayıtlı içerik ile yeni satırlar arasındaki fark (T bazında). */
export function diffContent(oldCsv, rows) {
    const g = readCsvGrid(oldCsv ?? ''); const m = guessMapping(g); const o = normalizeSheet(g, m).rows;
    const nw = normalizedContent(rows).rows; const key = (r) => `${r.dia}|${r.len}|${r.holder}|${r.offset}|${r.type}`;
    const oldBy = new Map(o.map((r) => [r.t, r])); const newBy = new Map(nw.map((r) => [r.t, r]));
    return { added: nw.filter((r) => !oldBy.has(r.t)).map((r) => r.t), removed: o.filter((r) => !newBy.has(r.t)).map((r) => r.t), changed: nw.filter((r) => oldBy.has(r.t) && key(oldBy.get(r.t)) !== key(r)).map((r) => r.t) };
}
export { csvFromRows };

/** NC açıklamasından TUTUCU / bağlama bilgisi önerisi (yalnız metinde yazan; doğrulanmamıştır). BT40/CAT40/SK/HSK/ER… ile başlayan kısım; "BOY nn" kuyruğu atılır. */
export function holderSuggestion(desc) {
    const t = String(desc ?? '').replace(/\s+/g, ' ').trim();
    const m = /(?:^|\s)((?:CAT|BT|SK|HSK|ISO)\s?-?\d{2,3}[A-Z]?\b|ER\s?-?\d{1,2}\b)/i.exec(t);
    if (!m) return '';
    let s = t.slice(m.index).trim().replace(/\s+BOY\s+\d+(?:[.,]\d+)?\s*$/i, '').trim();
    return s.length >= 3 ? s : '';
}
/** NC takım açıklamasından tutucu bilgisini AYRI parçalara böler (yalnız metinde yazan; yorum/çıkarım yok). */
export function holderParts(desc) {
    const t = String(desc ?? '').replace(/\s+/g, ' ').trim();
    const taper = taperOf(t);
    const er = /\bER\s?-?(\d{1,2})\b/i.exec(t);
    const pens = /\bPENS\s+(.+?)(?=\s+BOY\b|$)/i.exec(t);
    const cat = /\b([A-Z]\d[A-Z]\d-\d{4})\b/.exec(t);
    const boy = /\bBOY\s+(\d+(?:[.,]\d+)?)/i.exec(t);
    const o = {};
    if (taper) o.taper = taper;
    if (er) o.clamp = `ER${er[1]}`;
    if (pens) o.collet = pens[1].trim();
    if (cat) o.holderCode = cat[1];
    if (boy) o.gaugeLen = boy[1];
    return o;
}
/** Makine bağlantı standardı (açıklamadaki BT/CAT/SK/HSK + boyut). Yoksa null. */
export function taperOf(text) {
    const m = /\b(CAT|BT|SK|HSK|ISO)\s?-?(\d{2,3})([A-Z])?\b/i.exec(String(text ?? ''));
    return m ? `${m[1].toUpperCase()}${m[2]}` : null;
}
/** Sunucudaki CONTENT_STRUCTURE kuralının aynısı: satır başına eksik/geçersiz alan. Satır no = dosyadaki satır (başlık=1). */
export function rowProblems(rows) {
    const out = []; const seen = new Map();
    const num = (v) => /^[0-9]+(\.[0-9]+)?$/.test(String(v).trim().replace(',', '.')) && Number(String(v).trim().replace(',', '.')) > 0;
    rows.forEach((r, i) => {
        const missing = []; const bad = [];
        if (!String(r.t ?? '').trim() || !/\d/.test(r.t)) missing.push('T no');
        for (const [k, lbl] of [['dia', 'çap'], ['len', 'boy'], ['holder', 'tutucu'], ['offset', 'offset']]) if (!String(r[k] ?? '').trim()) missing.push(lbl);
        if (String(r.dia ?? '').trim() && !num(r.dia)) bad.push('çap sayı değil');
        if (String(r.len ?? '').trim() && !num(r.len)) bad.push('boy sayı değil');
        if (String(r.offset ?? '').trim() && !/\d/.test(r.offset)) bad.push('offset sayı içermiyor');
        const tn = /\d+/.exec(r.t ?? '')?.[0]; const key = tn != null ? Number(tn) : null;
        if (key != null) { if (seen.has(key)) bad.push(`tekrarlı T${key} (satır ${seen.get(key)})`); else seen.set(key, i + 2); }
        if (missing.length || bad.length) out.push({ t: r.t, rowNo: i + 2, missing, bad });
    });
    return out;
}
/** Listedeki bağlantı standartları: 1'den çoksa uyumsuzluk uyarısı. Makine mil standardı KMI'de tanımlı olmadığı için makineyle karşılaştırılmaz. */
export function taperMix(rows) {
    const set = new Map();
    for (const r of rows) { const t = taperOf(r.holder) ?? r.taper ?? taperOf(r.desc); if (t) set.set(t, [...(set.get(t) ?? []), r.t]); }
    return { tapers: [...set.keys()], by: Object.fromEntries(set), mixed: set.size > 1 };
}
/** Kayıtlı takım listesi içeriğinden (CSV) düzenlenebilir satırlar — açıklama ve kod sütunları korunur. */
export function rowsFromCsv(csv, kmiTools = []) {
    const g = readCsvGrid(csv ?? ''); const m = guessMapping(g); const n = normalizeSheet(g, m);
    const draft = n.rows.map((r) => ({ t: r.t, libraryRef: r.code || null }));
    const mt = matchKmiTools(draft, kmiTools ?? []);
    return n.rows.map((r, i) => ({ t: r.t, desc: r.desc ?? '', dia: r.dia, len: r.len, holder: r.holder, offset: r.offset, type: r.type, code: r.code ?? '', inferredType: false, match: mt[i].status, cardCode: mt[i].cardCode, ambiguousOffset: false, holderSuggestion: r.holder ? '' : holderSuggestion(r.desc ?? ''), taper: taperOf(r.desc ?? '') }));
}
