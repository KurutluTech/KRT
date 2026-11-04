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
