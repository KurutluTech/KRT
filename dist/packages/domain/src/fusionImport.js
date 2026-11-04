// Fusion 360 CAM verisi içe aktarma (SALT OKUNUR, saf). Yalnız KMI içe aktarma ŞABLONU (CSV/JSON) ayrıştırılır.
// .f3d / .f3z ikili dosyaları AYRIŞTIRILMAZ (desteklenmeyen içerik tahmin edilmez). Gerçek Fusion export örneği (setup sheet / takım kütüphanesi)
// sağlanırsa aynı satır modeline eşleyen ayrı bir okuyucu eklenir; bu modül çalışmayan otomasyonu "tamam" göstermez.

export const FUSION_SOURCE_LABEL = 'FUSION CAM SİMÜLASYONU / EXPORT — NC analiz tahmini ve makine ölçümü değildir';
export const FUSION_TEMPLATE_COLUMNS = ['setup', 'op_no', 'operation', 'program_file', 'tool_no', 'tool_description', 'diameter_mm', 'length_mm', 'holder', 'sim_seconds'];

export function fusionTemplateCsv() {
    const rows = [FUSION_TEMPLATE_COLUMNS, ['Setup1', '10', '2D Contour', 'op10.nc', 'T1', 'Ø10 parmak freze', '10', '60', 'ER25', '125.4'], ['Setup1', '10', 'Drill', 'op10.nc', 'T5', 'Ø4 matkap', '4', '80', 'ER25', '18.2']];
    return '﻿' + rows.map((r) => r.join(';')).join('\r\n') + '\r\n# ÖRNEK satırlardır — silip Fusion setup sheet / simülasyon çıktınızdaki gerçek değerleri yazın. sim_seconds boş bırakılırsa "CAM simülasyonu yapılmadı" görünür.\r\n';
}

const num = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

/** @returns {{ok:boolean, error?:string, rows:object[], bySetup:object, warnings:string[]}} */
export function parseFusionExport(text, fileName = '') {
    const warnings = [];
    if (/\.(f3d|f3z|step|stp)$/i.test(fileName)) return { ok: false, error: 'Fusion ikili/CAD dosyası (.f3d/.f3z) ayrıştırılmaz. Setup sheet veya şablon (CSV/JSON) kullanın.', rows: [], bySetup: {}, warnings };
    const t = String(text ?? '').replace(/^﻿/, '').trim();
    if (!t) return { ok: false, error: 'Boş dosya.', rows: [], bySetup: {}, warnings };
    let rows = [];
    if (t.startsWith('{') || t.startsWith('[')) {
        let j; try { j = JSON.parse(t); } catch { return { ok: false, error: 'JSON okunamadı.', rows: [], bySetup: {}, warnings }; }
        const setups = Array.isArray(j) ? j : j.setups;
        if (!Array.isArray(setups)) return { ok: false, error: 'JSON "setups" dizisi bulunamadı (KMI şablonu).', rows: [], bySetup: {}, warnings };
        for (const s of setups) for (const o of (s.operations ?? [{}])) rows.push({ setup: s.name ?? '', op_no: s.opNo ?? o.opNo ?? null, operation: o.name ?? '', program_file: o.program ?? s.program ?? '', tool_no: o.tool ?? '', tool_description: o.toolDescription ?? '', diameter_mm: num(o.diameter), length_mm: num(o.length), holder: o.holder ?? '', sim_seconds: num(o.seconds ?? s.simulationSeconds) });
    } else {
        const lines = t.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
        const d = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
        const head = lines[0].split(d).map((h) => h.trim().replace(/"/g, '').toLowerCase());
        const miss = ['setup', 'tool_no'].filter((c) => !head.includes(c));
        if (miss.length) return { ok: false, error: `Şablon başlığı eksik: ${miss.join(', ')}. Beklenen sütunlar: ${FUSION_TEMPLATE_COLUMNS.join(', ')}`, rows: [], bySetup: {}, warnings };
        for (const l of lines.slice(1)) { const c = l.split(d).map((x) => x.trim().replace(/"/g, '')); const o = Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])); rows.push({ setup: o.setup, op_no: num(o.op_no), operation: o.operation ?? '', program_file: o.program_file ?? '', tool_no: o.tool_no, tool_description: o.tool_description ?? '', diameter_mm: num(o.diameter_mm), length_mm: num(o.length_mm), holder: o.holder ?? '', sim_seconds: num(o.sim_seconds) }); }
    }
    rows = rows.filter((r) => r.setup || r.tool_no);
    for (const r of rows) { if (Number.isNaN(r.sim_seconds) || Number.isNaN(r.diameter_mm) || Number.isNaN(r.length_mm)) { warnings.push(`Sayı okunamadı: ${r.setup}/${r.tool_no}`); for (const k of ['sim_seconds', 'diameter_mm', 'length_mm']) if (Number.isNaN(r[k])) r[k] = null; } r.tool_no = String(r.tool_no ?? '').toUpperCase().replace(/\s+/g, '').replace(/^(\d+)$/, 'T$1'); }
    const bySetup = {};
    for (const r of rows) { const k = r.setup || '—'; (bySetup[k] ??= { setup: k, opNo: r.op_no, programs: new Set(), tools: new Map(), simSeconds: 0, simKnown: false, ops: 0 }); const b = bySetup[k]; b.ops++; if (r.program_file) b.programs.add(r.program_file); if (r.tool_no) b.tools.set(r.tool_no, r); if (r.sim_seconds != null) { b.simSeconds += r.sim_seconds; b.simKnown = true; } }
    for (const b of Object.values(bySetup)) { b.programs = [...b.programs]; b.tools = [...b.tools.values()]; }
    return { ok: true, rows, bySetup, warnings };
}

/** Fusion setup → KMI operasyonu: op_no eşleşmesi, yoksa program dosya adı = bağlı NC dosya adı. Belirsiz → eşlenmez. */
export function mapFusionToRoute(parsed, routeOps) {
    return Object.values(parsed.bySetup).map((s) => {
        const byNo = s.opNo != null ? routeOps.filter((o) => o.opNo === s.opNo) : [];
        const byFile = routeOps.filter((o) => s.programs.some((p) => o.ncFileName && o.ncFileName.toLowerCase() === p.toLowerCase()));
        const cand = byNo.length === 1 ? byNo : byFile.length === 1 ? byFile : [];
        return { setup: s.setup, opNo: s.opNo, matched: cand.length === 1 ? cand[0] : null, status: cand.length === 1 ? (byNo.length === 1 && byFile.length === 1 && byNo[0].id !== byFile[0].id ? 'CELISKI' : 'ESLESTI') : (byNo.length > 1 || byFile.length > 1 ? 'BELIRSIZ' : 'ESLESME_YOK'), simSeconds: s.simKnown ? s.simSeconds : null, tools: s.tools, programs: s.programs };
    });
}

/** Kalite planı TASLAK şablonu (kaynak referanslı). KMI çizimden değer ÇIKARMAZ/UYDURMAZ: satırları kalite personeli doldurur; kaynak_ref zorunlu kanıt alanıdır. */
export const QUALITY_DRAFT_COLUMNS = ['operation', 'characteristic_code', 'description', 'feature', 'nominal', 'tol_lower', 'tol_upper', 'unit', 'method', 'frequency', 'source_ref', 'operation_evidence', 'user_verified'];
export function qualityDraftCsv({ opCode, drawingDocNo, drawingFileName, ncProgram, tools = [] }) {
    const ev = tools.slice(0, 6).map((t) => `${t.t}${t.description ? ' ' + t.description : ''}`).join(' | ');
    const rows = [QUALITY_DRAFT_COLUMNS, [opCode ?? '', '', '', '', '', '', '', 'mm', '', '', `${drawingDocNo ?? '?'} ${drawingFileName ?? ''} (sayfa/bölge yazın)`, ev ? `NC: ${ncProgram ?? ''} — ${ev}` : '', 'HAYIR']];
    return '﻿' + rows.map((r) => r.join(';')).join('\r\n') + '\r\n# KALİTE PLANI TASLAĞI — onaylı değildir. Ölçü/tolerans çizimden elle ve kaynak referansıyla girilir; hangi operasyonun hangi karakteristiği oluşturduğu kanıtlanamıyorsa user_verified=HAYIR kalır. Onay, ilk parça ve ölçüm kapıları kalite personeline aittir.\r\n';
}
