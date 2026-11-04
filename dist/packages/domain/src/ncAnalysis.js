// NC dosyası ANALİZİ (saf, salt okunur). Hiçbir şey çalıştırmaz, makineye göndermez, kayıt yazmaz.
// Kural: NC'den çıkarılmayan bilgi UYDURULMAZ. Desteklenmeyen yapı varsa süre "kesin" gösterilmez (ALT SINIR / HESAPLANAMADI).
// NC ANALİZ TAHMİNİ ≠ CAM SİMÜLASYONU ≠ GERÇEK MAKİNE ÇEVRİMİ — bu modül yalnız ilkini üretir.

export const NC_ESTIMATE_LABEL = 'NC ANALİZ TAHMİNİ — CAM simülasyonu değildir, makine ölçümü değildir';

/** Makine parametresi YOKSA kullanılan açık varsayım aralıkları (ekranda "varsayım" diye gösterilir). */
export const DEFAULT_MACHINE = Object.freeze({ rapidMmMin: [10000, 30000], toolChangeSec: [3, 10], homeMoveSec: [0.5, 4], source: 'VARSAYIM' });

const TYPE_WORDS = [
    [/punta\s*matkab|center\s*drill/i, 'PUNTA MATKABI'], [/delgi|matkap|drill/i, 'MATKAP'], [/oluk\s*frez|groove/i, 'OLUK FREZESİ'], [/bicimlendirme|biçimlendirme|form/i, 'FORM FREZE'],
    [/koniklestirilmis|koniklestirilmi|taper/i, 'KONİK FREZE'], [/yuva\s*frez|slot/i, 'YUVA FREZE'], [/duz\s*uclu|düz\s*uçlu|end\s*mill/i, 'PARMAK FREZE'], [/kilavuz|tap\b/i, 'KILAVUZ'],
    [/boring|ic\s*tornalama/i, 'İÇ TORNALAMA'], [/general\s*turning|dis\s*tornalama/i, 'DIŞ TORNALAMA'], [/frez/i, 'FREZE'],
];
const guessType = (d) => { for (const [re, t] of TYPE_WORDS) if (re.test(d)) return t; return null; };

const num = (s) => { const v = Number(s); return Number.isFinite(v) ? v : null; };
const r2 = (x) => Math.round(x * 100) / 100;

/** "(T1 duz uclu freze … CAP9.5-L80.-…-Z3-SAFT9.5 TM084)" (frez, Fusion/Haas post) ve "(T101 D=22. CR=0. TAPER=170deg - ZMIN=-70. - punta matkabi)" (torna). */
export function parseToolComment(text) {
    const m = /^T\s*0*(\d{1,4})\b\s*(.*)$/i.exec(text.trim());
    if (!m) return null;
    const rest = m[2];
    const out = { t: `T${Number(m[1])}`, raw: text.trim(), description: null, diameterMm: null, lengthMm: null, flutes: null, angleDeg: null, libraryRef: null, extra: {}, source: 'NC_YORUMU' };
    const cap = /\bCAP\s*([0-9]+\.?[0-9]*)/i.exec(rest);
    if (cap) { // frez formatı
        out.diameterMm = num(cap[1]);
        const L = /-L\s*([0-9]+\.?[0-9]*)/i.exec(rest); if (L) out.lengthMm = num(L[1]);
        const Z = /-Z\s*(\d+)/i.exec(rest); if (Z) out.flutes = num(Z[1]);
        const A = /-A\s*([0-9.]+)\s*deg/i.exec(rest); if (A) out.angleDeg = num(A[1]);
        const TM = /\bTM\s*(\d+)/i.exec(rest); if (TM) out.libraryRef = `TM${TM[1]}`;
        for (const k of ['BB', 'DB', 'HB', 'SAFT']) { const v = new RegExp(`-${k}\\s*([0-9]+\\.?[0-9]*)`, 'i').exec(rest); if (v) out.extra[k] = num(v[1]); }
        const head = rest.slice(0, cap.index).trim();
        out.description = head || null;
        out.holderText = head || null; // serbest metin: tutucu/boy bilgisi içerebilir — DOĞRULANMALI
        out.kind = 'MILL';
    } else if (/\b(D|CR|NR|TAPER|ZMIN)\s*=/i.test(rest)) { // torna formatı
        const kv = {}; for (const mm of rest.matchAll(/\b(D|CR|NR|TAPER|ZMIN)\s*=\s*(-?[0-9]+\.?[0-9]*)(deg)?/gi)) kv[mm[1].toUpperCase()] = num(mm[2]);
        if (kv.D != null) out.diameterMm = kv.D;
        if (kv.TAPER != null) out.angleDeg = kv.TAPER;
        out.extra = kv;
        const tail = rest.split(/\s-\s/).slice(-1)[0]; out.description = /=/.test(tail) ? null : tail.trim() || null;
        out.kind = 'LATHE';
    } else { out.description = rest.trim() || null; }
    out.typeGuess = out.description ? guessType(out.description) : null; // açıklamadaki kelimeden ÇIKARIM
    return out;
}

/** Haas tipi torna T kodu: T101 → istasyon 1 / ofset 01; T1010 → 10 / 10 (kontrole göre değişir; çıkarım). */
export function splitLatheT(tCode) {
    const d = String(tCode).replace(/^T/i, '');
    if (d.length < 3) return null;
    return { station: Number(d.slice(0, d.length - 2)), offset: Number(d.slice(-2)) };
}

function stripComments(line, comments, lineNo) {
    let out = ''; let depth = 0; let cur = '';
    for (const ch of line) {
        if (ch === '(') { depth++; if (depth === 1) { cur = ''; continue; } }
        if (ch === ')' && depth > 0) { depth--; if (depth === 0) { comments.push({ line: lineNo, text: cur }); continue; } }
        if (depth > 0) cur += ch; else out += ch;
    }
    const semi = out.indexOf(';'); if (semi >= 0) { comments.push({ line: lineNo, text: out.slice(semi + 1).trim() }); out = out.slice(0, semi); }
    return out;
}

const UNSUPPORTED = [
    ['SUBPROGRAM', 'Alt program/makro çağrısı (M98/M97/G65)', /\b(M98|M97|G65)\b/],
    ['MACRO', 'Makro değişken/ifade (#, [ ], IF/WHILE/GOTO)', /(#\d+|\bIF\b|\bWHILE\b|\bGOTO\b|\[)/],
    ['CANNED_CYCLE', 'Sabit çevrim (G73/G74/G76/G81–G89, torna G70–G76)', /\b(G7[0-6]|G8[1-9])\b/],
    ['TRANSFORM', 'Koordinat dönüşümü (G68/G51/G52/G92/G10/G54.1)', /\b(G68|G69|G51|G52|G92|G10|G54\.1|G68\.2)\b/],
    ['ROTARY', 'Döner eksen hareketi (A/B/C)', null],
];

/**
 * @param {string} text NC metni
 * @param {{machine?: {rapidMmMin:[number,number], toolChangeSec:[number,number], source?:string}, unitsDefault?:'mm'|'inch'}} opts
 */
export function analyzeNc(text, opts = {}) {
    const machine = opts.machine ?? DEFAULT_MACHINE;
    const raw = String(text ?? '').replace(/^﻿/, '');
    const lines = raw.split(/\r\n|\r|\n/);
    const result = {
        supported: true, unsupportedReason: null, control: 'FANUC_BENZERİ_ISO', kind: 'UNKNOWN', programNumber: null, programName: null, lineCount: lines.length,
        postComments: [], commentTools: [], toolSegments: [], gcodes: {}, mcodes: {}, spindle: { rpm: new Set(), css: new Set(), dirs: new Set(), smax: null }, coolant: new Set(),
        feeds: { min: null, max: null }, motion: { rapid: 0, linear: 0, arc: 0, dwell: 0, rapidMm: 0, feedMm: 0 }, unsupported: [], notes: [], estimate: null,
    };
    // --- denetleyici ailesi (desteklenmeyenleri açıkça reddet)
    if (/BEGIN\s+PGM|TOOL\s+CALL|\bCYCL\s+DEF\b/i.test(raw)) { result.supported = false; result.control = 'HEIDENHAIN'; result.unsupportedReason = 'Heidenhain Klartext/ISO-dışı biçim desteklenmiyor.'; result.estimate = noEstimate(result.unsupportedReason); return finish(result); }
    if (/\bTRANS\b|\bCYCLE\d+\(|\bMCALL\b|\bSUPA\b/i.test(raw)) { result.supported = false; result.control = 'SIEMENS'; result.unsupportedReason = 'Siemens Sinumerik biçimi desteklenmiyor.'; result.estimate = noEstimate(result.unsupportedReason); return finish(result); }

    const comments = [];
    const prog = []; // {n, words:[{c,v}], txt}
    lines.forEach((ln, i) => {
        const t = ln.trim(); if (!t || t === '%') return;
        const body = stripComments(t.replace(/^\//, ''), comments, i + 1).toUpperCase().replace(/^N\d+\s*/, '');
        if (!body.trim()) return;
        const words = []; for (const m of body.matchAll(/([A-Z])\s*(-?(?:\d+\.?\d*|\.\d+))/g)) words.push({ c: m[1], v: Number(m[2]), raw: m[2] });
        prog.push({ n: i + 1, words, txt: body.trim() });
    });
    // --- program kimliği ve yorumlar
    const o = lines.map((l) => /^\s*O\s*0*(\d+)\s*(?:\((.*)\))?/i.exec(l)).find(Boolean);
    if (o) { result.programNumber = `O${o[1].padStart(5, '0')}`; result.programName = (o[2] ?? '').trim() || null; }
    for (const c of comments) { const tc = parseToolComment(c.text); if (tc) { if (!result.commentTools.some((x) => x.t === tc.t)) result.commentTools.push({ ...tc, line: c.line }); } else if (c.line < 40 && c.text.trim()) result.postComments.push(c.text.trim()); }

    // --- tür tahmini
    const hasM6 = prog.some((p) => p.words.some((w) => w.c === 'M' && w.v === 6));
    const hasLatheWords = prog.some((p) => p.words.some((w) => w.c === 'G' && (w.v === 96 || w.v === 99 || w.v === 50 || w.v === 18)));
    const hasG18 = prog.some((p) => p.words.some((w) => w.c === 'G' && w.v === 18));
    const lathe = !hasM6 && hasLatheWords && hasG18;
    result.kind = hasM6 ? 'FREZE/İŞLEME MERKEZİ' : lathe ? 'TORNA' : 'BELİRSİZ';

    // --- durum makinesi
    const st = { abs: true, inch: !!(opts.unitsDefault === 'inch'), plane: 17, mode: 0, feedPerRev: false, css: false, S: null, Smax: null, F: null, pos: { x: null, y: null, z: null }, tool: null, pendingT: null, cyc: false };
    const un = {}; const note = (k) => { un[k] = (un[k] ?? 0) + 1; };
    let toolSeg = null; const segs = [];
    const openSeg = (t, line) => { toolSeg = { t, line, blocks: 0, rapidMm: 0, feedMm: 0, cutSec: 0, rapidMoves: 0, feedMoves: 0, rpm: new Set(), css: new Set(), feedMin: null, feedMax: null, coolant: new Set(), notes: [], hCodes: new Set(), dCodes: new Set() }; segs.push(toolSeg); };
    let homeBlocks = 0, changes = 0, dwellMin = 0, dwellMax = 0, rapidMmTot = 0, cutSecTot = 0, stops = 0, g94 = false, noFeed = 0, cssNoDia = 0, rpmUnknown = 0;
    const toMm = (v) => (st.inch ? v * 25.4 : v);
    const diaMode = lathe; // torna: X çaptır
    const axVal = (w, a) => { const x = w.find((q) => q.c === a); return x ? toMm(x.v) : null; };

    for (const p of prog) {
        const w = p.words; const has = (c, v) => w.some((q) => q.c === c && q.v === v);
        const gs = w.filter((q) => q.c === 'G').map((q) => q.v); const ms = w.filter((q) => q.c === 'M').map((q) => q.v);
        for (const g of gs) result.gcodes[`G${g}`] = (result.gcodes[`G${g}`] ?? 0) + 1; for (const m of ms) result.mcodes[`M${m}`] = (result.mcodes[`M${m}`] ?? 0) + 1;
        for (const [key, , re] of UNSUPPORTED) if (re && re.test(p.txt)) note(key);
        if (/(?:^|\s)[ABC]\s*-?\d/.test(p.txt) && !lathe) note('ROTARY');
        // birimler / düzlem / mutlak-artımlı / besleme modu
        if (gs.includes(21)) st.inch = false; if (gs.includes(20)) st.inch = true; if (gs.includes(90)) st.abs = true; if (gs.includes(91)) st.abs = false;
        for (const g of gs) { if (g === 17 || g === 18 || g === 19) st.plane = g; }
        if (lathe) { if (gs.includes(99)) st.feedPerRev = true; if (gs.includes(98)) st.feedPerRev = false; } else { if (gs.includes(95)) st.feedPerRev = true; if (gs.includes(94)) st.feedPerRev = false; }
        if (gs.includes(96)) st.css = true; if (gs.includes(97)) st.css = false;
        const s = w.find((q) => q.c === 'S'); const g50 = gs.includes(50);
        if (s) { if (g50) { st.Smax = s.v; result.spindle.smax = s.v; } else { st.S = s.v; if (st.css) result.spindle.css.add(s.v); else result.spindle.rpm.add(s.v); if (toolSeg) (st.css ? toolSeg.css : toolSeg.rpm).add(s.v); } }
        const f = w.find((q) => q.c === 'F'); if (f) st.F = toMm(f.v);
        if (f) { const fv = f.v; result.feeds.min = result.feeds.min == null ? fv : Math.min(result.feeds.min, fv); result.feeds.max = result.feeds.max == null ? fv : Math.max(result.feeds.max, fv); if (toolSeg) { toolSeg.feedMin = toolSeg.feedMin == null ? fv : Math.min(toolSeg.feedMin, fv); toolSeg.feedMax = toolSeg.feedMax == null ? fv : Math.max(toolSeg.feedMax, fv); } }
        for (const m of ms) { if (m === 3 || m === 4) result.spindle.dirs.add(m === 3 ? 'M3' : 'M4'); if (m === 8 || m === 7) { result.coolant.add(`M${m}`); toolSeg?.coolant.add(`M${m}`); } if (m === 0 || m === 1) stops++; if (m === 9) result.coolant.add('M9'); }
        // takım
        const t = w.find((q) => q.c === 'T');
        if (t) {
            const code = `T${t.v}`;
            if (lathe || !hasM6) { if (st.tool !== code) { changes++; st.tool = code; openSeg(code, p.n); } }
            else st.pendingT = code;
        }
        if (has('M', 6)) { const code = st.pendingT ?? (t ? `T${t.v}` : null); if (code) { if (st.tool !== code) { changes++; st.tool = code; openSeg(code, p.n); } st.pendingT = null; } else note('M6_NO_TOOL'); }
        if (toolSeg) toolSeg.blocks++;
        const h = w.find((q) => q.c === 'H' && gs.includes(43)); if (h && toolSeg) toolSeg.hCodes.add(`H${h.v}`);
        const d = w.find((q) => q.c === 'D'); if (d && toolSeg && !lathe) toolSeg.dCodes.add(`D${d.v}`);
        // bekleme
        if (gs.includes(4)) { const pw = w.find((q) => q.c === 'P' || q.c === 'X'); if (pw) { const decimal = /\./.test(pw.raw); const sec = decimal || pw.c === 'X' ? [pw.v, pw.v] : [pw.v / 1000, pw.v]; dwellMin += sec[0]; dwellMax += sec[1]; result.motion.dwell++; } continue; }
        // sabit çevrim kapsamı
        if (gs.some((g) => (g >= 81 && g <= 89) || g === 73 || g === 74 || g === 76 || g === 70 || g === 71 || g === 72)) st.cyc = true;
        if (gs.includes(80)) st.cyc = false;
        // hareket modu (modal G0/1/2/3)
        const mg = gs.find((g) => g === 0 || g === 1 || g === 2 || g === 3); if (mg !== undefined) st.mode = mg;
        const g53 = gs.includes(53) || gs.includes(28) || gs.includes(30);
        const ax = { x: axVal(w, 'X'), y: axVal(w, 'Y'), z: axVal(w, 'Z') };
        const anyAx = ax.x != null || ax.y != null || ax.z != null;
        if (g53) { // makine koordinatı: konum bilinmez hale gelir, mesafe hesaplanmaz
            if (anyAx) { for (const k of ['x', 'y', 'z']) if (ax[k] != null) st.pos[k] = null; homeBlocks++; result.motion.rapid++; }
            continue;
        }
        if (!anyAx || st.cyc) { if (st.cyc && anyAx) { note('CANNED_CYCLE_POSITIONS'); for (const k of ['x', 'y', 'z']) if (ax[k] != null) st.pos[k] = null; } continue; }
        // hedef
        const tgt = {}; let unknownStart = false;
        for (const k of ['x', 'y', 'z']) {
            if (ax[k] == null) { tgt[k] = st.pos[k]; continue; }
            const val = (k === 'x' && diaMode) ? ax[k] / 2 : ax[k];
            tgt[k] = st.abs ? val : (st.pos[k] == null ? null : st.pos[k] + val);
            if (st.pos[k] == null) unknownStart = true;
        }
        let len = 0; const dk = ['x', 'y', 'z'].filter((k) => ax[k] != null && st.pos[k] != null && tgt[k] != null);
        if (st.mode === 2 || st.mode === 3) {
            const A = st.plane === 17 ? ['x', 'y'] : st.plane === 18 ? ['z', 'x'] : ['y', 'z']; const third = st.plane === 17 ? 'z' : st.plane === 18 ? 'y' : 'x';
            const ij = { x: w.find((q) => q.c === 'I'), y: w.find((q) => q.c === 'J'), z: w.find((q) => q.c === 'K') }; const R = w.find((q) => q.c === 'R');
            const a0 = st.pos[A[0]], b0 = st.pos[A[1]], a1 = tgt[A[0]], b1 = tgt[A[1]];
            if ([a0, b0, a1, b1].some((v) => v == null)) { unknownStart = true; }
            else {
                const cw = st.mode === 2; let arc = null;
                const chord = Math.hypot(a1 - a0, b1 - b0);
                if (R) { const r = Math.abs(toMm(R.v)); if (r > 0 && chord <= 2 * r + 1e-6) { let th = 2 * Math.asin(Math.min(1, chord / (2 * r))); if (R.v < 0) th = 2 * Math.PI - th; arc = r * th; } }
                else if (ij[A[0]] || ij[A[1]]) {
                    const ia = toMm(ij[A[0]]?.v ?? 0), jb = toMm(ij[A[1]]?.v ?? 0); const r = Math.hypot(ia, jb);
                    if (r > 0) { const ca = a0 + ia, cb = b0 + jb; const s0 = Math.atan2(b0 - cb, a0 - ca), e0 = Math.atan2(b1 - cb, a1 - ca); let sweep = cw ? s0 - e0 : e0 - s0; while (sweep <= 1e-9) sweep += 2 * Math.PI; arc = r * sweep; }
                }
                if (arc == null) note('ARC_UNRESOLVED'); else { const dz = (st.pos[third] != null && tgt[third] != null) ? tgt[third] - st.pos[third] : 0; len = Math.hypot(arc, dz); }
            }
        } else len = Math.hypot(...dk.map((k) => tgt[k] - st.pos[k]));
        if (unknownStart && st.mode !== 0) note('MOVE_FROM_UNKNOWN_POSITION');
        for (const k of ['x', 'y', 'z']) if (ax[k] != null) st.pos[k] = tgt[k];
        if (st.mode === 0) { result.motion.rapid++; result.motion.rapidMm += len; rapidMmTot += len; if (toolSeg) { toolSeg.rapidMm += len; toolSeg.rapidMoves++; } }
        else {
            if (st.mode === 1) result.motion.linear++; else result.motion.arc++;
            result.motion.feedMm += len;
            if (st.F == null || st.F <= 0) { noFeed++; continue; }
            let feedMmMin = st.F;
            if (st.feedPerRev) {
                let rpm = null;
                if (st.css) {
                    const dia = diaMode && st.pos.x != null ? Math.abs(st.pos.x) * 2 : null;
                    if (dia && dia > 0 && st.S) rpm = 1000 * st.S / (Math.PI * dia); else if (st.S) { cssNoDia++; rpm = st.Smax; }
                    if (rpm != null && st.Smax != null) rpm = Math.min(rpm, st.Smax);
                } else rpm = st.S;
                if (!rpm) { rpmUnknown++; continue; }
                feedMmMin = st.F * rpm;
            }
            const sec = len / feedMmMin * 60; cutSecTot += sec; if (toolSeg) { toolSeg.feedMm += len; toolSeg.cutSec += sec; toolSeg.feedMoves++; }
        }
    }
    // --- araç özetleri
    result.toolSegments = mergeSegs(segs, lathe);
    result.motion.rapidMm = r2(result.motion.rapidMm); result.motion.feedMm = r2(result.motion.feedMm);
    result.spindle = { rpm: [...result.spindle.rpm].sort((a, b) => a - b), css: [...result.spindle.css].sort((a, b) => a - b), dirs: [...result.spindle.dirs], smax: result.spindle.smax };
    result.coolant = [...result.coolant];
    // --- desteklenmeyen listesi
    const label = Object.fromEntries(UNSUPPORTED.map(([k, tx]) => [k, tx]));
    label.CANNED_CYCLE_POSITIONS = 'Sabit çevrim içi konumlar: hesaplanamadı'; label.MOVE_FROM_UNKNOWN_POSITION = 'Başlangıç konumu bilinmeyen hareket (kısmi mesafe)'; label.ARC_UNRESOLVED = 'Çözümlenemeyen yay (R/IJK eksik)'; label.M6_NO_TOOL = 'M6 için takım numarası bulunamadı';
    for (const [k, c] of Object.entries(un)) result.unsupported.push({ code: k, count: c, text: label[k] ?? k });
    if (noFeed) result.unsupported.push({ code: 'NO_FEED', count: noFeed, text: 'Besleme (F) tanımsız kesme hareketi' });
    if (rpmUnknown) result.unsupported.push({ code: 'RPM_UNKNOWN', count: rpmUnknown, text: 'Devir tanımsız (devir başına ilerleme hesaplanamadı)' });
    if (cssNoDia) result.unsupported.push({ code: 'CSS_NO_DIAMETER', count: cssNoDia, text: 'G96 sabit yüzey hızı: çap bilinmiyor (üst devir sınırı varsayıldı)' });
    if (stops) result.notes.push(`${stops} adet M00/M01 durağı: operatör bekleme süresi dahil değil.`);
    result.notes.push('Kesici telafisi (G41/G42), ivmelenme ve mil rampaları süreye katılmadı.');
    // --- süre tahmini (ayrı kaynak olarak)
    const fullyKnown = !result.unsupported.length;
    const rapid = [rapidMmTot / machine.rapidMmMin[1] * 60, rapidMmTot / machine.rapidMmMin[0] * 60];
    const hm = machine.homeMoveSec ?? DEFAULT_MACHINE.homeMoveSec; const tc = [changes * machine.toolChangeSec[0], changes * machine.toolChangeSec[1]]; const home = [homeBlocks * hm[0], homeBlocks * hm[1]];
    const total = [cutSecTot + rapid[0] + tc[0] + home[0] + dwellMin, cutSecTot + rapid[1] + tc[1] + home[1] + dwellMax];
    result.estimate = {
        label: NC_ESTIMATE_LABEL, source: 'NC_ANALIZ_TAHMINI', confidence: result.supported ? (fullyKnown ? 'KAPSAMLI_ARALIK' : 'KISMI_ALT_SINIR') : 'HESAPLANAMADI',
        cuttingSeconds: r2(cutSecTot), rapidSeconds: [r2(rapid[0]), r2(rapid[1])], toolChangeSeconds: [r2(tc[0]), r2(tc[1])], homeMoveSeconds: [r2(home[0]), r2(home[1])], homeBlocks, dwellSeconds: [r2(dwellMin), r2(dwellMax)], totalSeconds: [r2(total[0]), r2(total[1])],
        toolChanges: changes, machineParams: { rapidMmMin: machine.rapidMmMin, toolChangeSec: machine.toolChangeSec, homeMoveSec: hm, source: machine.source ?? 'MAKINE' },
        assumptions: [...(machine.source === 'VARSAYIM' || !opts.machine ? [`Makine parametresi yok: rapid ${machine.rapidMmMin[0] / 1000}–${machine.rapidMmMin[1] / 1000} m/dk ve takım değişimi ${machine.toolChangeSec[0]}–${machine.toolChangeSec[1]} sn VARSAYIM aralığıdır.`] : []), ...(homeBlocks ? [`${homeBlocks} adet G28/G53 makine-koordinatı hareketi: mesafe bilinmediği için blok başına ${hm[0]}–${hm[1]} sn VARSAYIM.`] : [])],
        note: fullyKnown ? 'Desteklenen komutların tamamı hesaplandı; yine de tahmindir.' : 'Desteklenmeyen yapılar var: süre KESİN DEĞİLDİR, yalnız hesaplanabilen kısım için alt sınırdır.',
    };
    if (result.supported && !(result.motion.rapid + result.motion.linear + result.motion.arc)) { Object.assign(result.estimate, { confidence: 'HESAPLANAMADI', totalSeconds: [null, null], cuttingSeconds: null, note: 'NC içinde hareket bloğu (G0/G1/G2/G3) bulunamadı: süre hesaplanamaz.' }); }
    return finish(result);
}

const noEstimate = (why) => ({ label: NC_ESTIMATE_LABEL, source: 'NC_ANALIZ_TAHMINI', confidence: 'HESAPLANAMADI', cuttingSeconds: null, rapidSeconds: [null, null], toolChangeSeconds: [null, null], homeMoveSeconds: [null, null], homeBlocks: 0, dwellSeconds: [null, null], totalSeconds: [null, null], toolChanges: 0, assumptions: [], note: why });

function mergeSegs(segs, lathe) {
    const by = new Map();
    for (const s of segs) {
        const e = by.get(s.t) ?? { t: s.t, firstLine: s.line, calls: 0, blocks: 0, rapidMm: 0, feedMm: 0, cutSec: 0, rapidMoves: 0, feedMoves: 0, rpm: new Set(), css: new Set(), feedMin: null, feedMax: null, coolant: new Set(), hCodes: new Set(), dCodes: new Set() };
        e.calls++; e.blocks += s.blocks; e.rapidMm += s.rapidMm; e.feedMm += s.feedMm; e.cutSec += s.cutSec; e.rapidMoves += s.rapidMoves; e.feedMoves += s.feedMoves;
        s.rpm.forEach((v) => e.rpm.add(v)); s.css.forEach((v) => e.css.add(v)); s.coolant.forEach((v) => e.coolant.add(v)); s.hCodes.forEach((v) => e.hCodes.add(v)); s.dCodes.forEach((v) => e.dCodes.add(v));
        if (s.feedMin != null) e.feedMin = e.feedMin == null ? s.feedMin : Math.min(e.feedMin, s.feedMin); if (s.feedMax != null) e.feedMax = e.feedMax == null ? s.feedMax : Math.max(e.feedMax, s.feedMax);
        by.set(s.t, e);
    }
    return [...by.values()].map((e) => ({ ...e, rapidMm: r2(e.rapidMm), feedMm: r2(e.feedMm), cutSec: r2(e.cutSec), rpm: [...e.rpm].sort((a, b) => a - b), css: [...e.css].sort((a, b) => a - b), coolant: [...e.coolant], hCodes: [...e.hCodes], dCodes: [...e.dCodes], lathe: lathe ? splitLatheT(e.t) : null }));
}

function finish(r) {
    // NC takım listesi taslağı: yorumdaki bilgi + çağrılan takımlar (birleşik, tekil)
    const called = new Map((r.toolSegments ?? []).map((s) => [s.t, s]));
    const all = new Map(); for (const c of r.commentTools ?? []) all.set(c.t, c);
    for (const k of called.keys()) if (!all.has(k)) all.set(k, { t: k, raw: null, description: null, diameterMm: null, lengthMm: null, source: 'YALNIZ_T_KODU' });
    r.toolDraft = [...all.values()].sort((a, b) => Number(a.t.slice(1)) - Number(b.t.slice(1))).map((c) => {
        const seg = called.get(c.t); const miss = [];
        if (c.diameterMm == null) miss.push('çap'); if (c.lengthMm == null && c.kind !== 'LATHE') miss.push('uzunluk'); if (!c.description) miss.push('açıklama'); if (!c.typeGuess) miss.push('tip');
        return { t: c.t, description: c.description ?? null, typeGuess: c.typeGuess ?? null, diameterMm: c.diameterMm ?? null, lengthMm: c.lengthMm ?? null, flutes: c.flutes ?? null, angleDeg: c.angleDeg ?? null, libraryRef: c.libraryRef ?? null,
            holderText: c.holderText ?? null, usedInProgram: !!seg, calledTimes: seg?.calls ?? 0, hCodes: seg?.hCodes ?? [], lathe: seg?.lathe ?? (c.kind === 'LATHE' ? splitLatheT(c.t) : null), source: c.source, missing: miss, needsVerify: true, extra: c.extra ?? {} };
    });
    r.toolsCalledNotCommented = (r.toolSegments ?? []).filter((s) => !(r.commentTools ?? []).some((c) => c.t === s.t)).map((s) => s.t);
    r.toolsCommentedNotCalled = (r.commentTools ?? []).filter((c) => !called.has(c.t)).map((c) => c.t);
    return r;
}

/** Takım listesi TASLAĞI (mevcut takım listesi içe aktarma okuyucusunun tanıdığı başlıklarla). Kullanıcı yükleyince normal mühür + kritik takım doğrulaması çalışır. */
export function toolDraftCsv(draft, opts = {}) {
    const q = (v) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ['T', 'Açıklama', 'Çap', 'Uzunluk', 'Tutucu', 'Ofset', 'Tip', 'Kod', 'Not (DOĞRULA)'];
    const rows = draft.map((d) => [d.t, d.description, d.diameterMm, d.lengthMm, d.holderText && d.holderText !== d.description ? d.holderText : '', d.hCodes?.[0]?.replace(/^H/, '') ?? (d.lathe ? d.lathe.offset : ''), d.typeGuess, d.libraryRef, d.missing.length ? `Eksik: ${d.missing.join(', ')}` : 'NC yorumundan; doğrulayın']);
    return '﻿' + [head, ...rows].map((r) => r.map(q).join(';')).join('\r\n') + '\r\n' + (opts.footer ? `# ${opts.footer}\r\n` : '');
}

/** KMI takım kartıyla eşleştirme (kod / kütüphane referansı birebir). Belirsiz → doğrulama bekler. */
export function matchKmiTools(draft, kmiTools = []) {
    return draft.map((d) => {
        const hits = kmiTools.filter((k) => (d.libraryRef && String(k.code).toUpperCase() === d.libraryRef.toUpperCase()) || String(k.code).toUpperCase() === d.t.toUpperCase());
        return { t: d.t, status: hits.length === 1 ? 'ESLESTI' : hits.length > 1 ? 'BELIRSIZ' : 'ESLESME_YOK', cardCode: hits.length === 1 ? hits[0].code : null };
    });
}

/** Operasyon için üretim hazırlığı eksik özeti (tek yerde). */
export function engineeringGaps({ analysis, ncDoc, camLinked, toolListDoc, op }) {
    const g = [];
    if (!ncDoc) g.push({ k: 'NC', text: 'NC dosyası yok' }); else if (ncDoc.validity && ncDoc.validity !== 'EFFECTIVE') g.push({ k: 'NC_STATE', text: `NC ${ncDoc.validity === 'DRAFT' ? 'YÜKLENDİ (geçerli değil)' : ncDoc.validity}` });
    if (analysis && !analysis.supported) g.push({ k: 'NC_FORMAT', text: analysis.unsupportedReason });
    if (analysis?.supported) {
        if (analysis.toolDraft.some((t) => t.missing.length)) g.push({ k: 'TOOL_FIELDS', text: `${analysis.toolDraft.filter((t) => t.missing.length).length} takımda eksik alan` });
        if (analysis.toolsCalledNotCommented.length) g.push({ k: 'TOOL_NO_COMMENT', text: `Takım yorumu olmayan T kodu: ${analysis.toolsCalledNotCommented.join(', ')}` });
        if (analysis.estimate.confidence !== 'KAPSAMLI_ARALIK') g.push({ k: 'ESTIMATE_PARTIAL', text: 'Süre tahmini kısmi (desteklenmeyen yapı var)' });
    }
    if (!toolListDoc) g.push({ k: 'TOOL_LIST', text: 'Takım listesi belgesi yok (NC taslağından üretilebilir)' }); else if (toolListDoc.validity && toolListDoc.validity !== 'EFFECTIVE') g.push({ k: 'TOOL_LIST_STATE', text: 'Takım listesi geçerli değil' });
    if (!camLinked) g.push({ k: 'CAM', text: 'CAM/setup kaydı yok' });
    if (op && op.setupMinutes == null) g.push({ k: 'SETUP', text: 'Hazırlık süresi girilmemiş' });
    if (op && op.cycleSeconds == null) g.push({ k: 'CYCLE', text: 'Çevrim süresi (operatör standardı) girilmemiş' });
    if (op && op.inspectionSeconds == null) g.push({ k: 'INSPECTION', text: 'Muayene süresi girilmemiş' });
    if (op && !op.skillCode) g.push({ k: 'SKILL', text: 'Yeterlilik tanımsız' });
    return g;
}

export function fmtDuration(sec) {
    if (sec == null || !Number.isFinite(sec)) return '—';
    const m = Math.floor(sec / 60); const s = Math.round(sec - m * 60);
    return m > 0 ? `${m} dk ${String(s).padStart(2, '0')} sn` : `${s} sn`;
}
