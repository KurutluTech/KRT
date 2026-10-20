export const SEG_KINDS = ['ACTIVE', 'STOPPED', 'FEED_HOLD', 'INTERRUPTED', 'ALARM', 'UNKNOWN', 'NO_DATA'];
export const SEG_TR = {
    ACTIVE: 'Program aktif', STOPPED: 'CNC durmuş', FEED_HOLD: 'FEED HOLD', INTERRUPTED: 'Kesinti / bekleme', ALARM: 'Alarm / acil stop', UNKNOWN: 'Durum bilinmiyor', NO_DATA: 'Veri yok',
};
/** Owner colours: green active · blue stopped · orange FEED HOLD · grey no data · red verified alarm/e-stop. (Maintenance is an administrative record, drawn from the maintenance tickets, not from the CNC.) */
export const SEG_COLOR = {
    ACTIVE: '#34d399', STOPPED: '#4da3ff', FEED_HOLD: '#fb923c', INTERRUPTED: '#fbbf24', ALARM: '#f87171', UNKNOWN: '#64748b', NO_DATA: '#334155',
};
export const MIN_COVERAGE_PCT = 80; // a shift with less controller data than this is NOT judged
const asKind = (k) => (SEG_KINDS.includes(k) ? k : 'UNKNOWN');
export const EVENT_TR = {
    STATE_CHANGE: 'Durum değişti', PROGRAM_CHANGE: 'Program değişti', M30_CHANGE: 'M30 sayacı arttı (program çevrimi bitti)', DATA_GAP_START: 'Veri kesildi (bağlantı kaybı veya bilinmeyen)', DATA_RESUMED: 'Veri yeniden geldi',
};
const NUM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
export function fmtDur(sec) {
    if (sec === null || sec === undefined || !Number.isFinite(sec))
        return 'BİLİNMİYOR';
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h} sa ${m} dk` : m > 0 ? `${m} dk ${s % 60} sn` : `${s} sn`;
}
export const pct = (part, whole) => (part === null || part === undefined || !whole || whole <= 0 ? null : (part / whole) * 100);
export const fmtPct = (p) => (p === null ? 'BİLİNMİYOR' : `%${NUM.format(p)}`);
export function layoutTimeline(segs, fromIso, toIso) {
    const f = Date.parse(fromIso), t = Date.parse(toIso);
    const span = t - f;
    if (!(span > 0))
        return [];
    const out = [];
    let cursor = f;
    for (const s of [...segs].sort((a, b) => Date.parse(a.segStart) - Date.parse(b.segStart))) {
        const a = Math.max(f, Date.parse(s.segStart), cursor), b = Math.min(t, Date.parse(s.segEnd));
        if (!(b > a))
            continue;
        out.push({ kind: asKind(s.kind), startMs: a, endMs: b, leftPct: ((a - f) / span) * 100, widthPct: ((b - a) / span) * 100, program: s.program, seg: s });
        cursor = b;
    }
    return out;
}
export function durationTiles(s) {
    if (!s)
        return [];
    const sec = (k) => (typeof s.seconds[k] === 'number' ? s.seconds[k] : null);
    return [
        { key: 'ACTIVE', label: 'Program aktif süresi', seconds: sec('ACTIVE'), pctOfWindow: pct(sec('ACTIVE'), s.windowSeconds), note: 'talaş kaldırma süresi DEĞİL' },
        { key: 'STOPPED', label: 'CNC durmuş süre', seconds: sec('STOPPED'), pctOfWindow: pct(sec('STOPPED'), s.windowSeconds) },
        { key: 'FEED_HOLD', label: 'FEED HOLD süresi', seconds: sec('FEED_HOLD'), pctOfWindow: pct(sec('FEED_HOLD'), s.windowSeconds) },
        { key: 'NO_DATA', label: 'Bağlantı kaybı / bilinmeyen süre', seconds: ((sec('NO_DATA') ?? 0) + (sec('UNKNOWN') ?? 0)), pctOfWindow: pct((sec('NO_DATA') ?? 0) + (sec('UNKNOWN') ?? 0), s.windowSeconds), note: 'geçmişte bağlantı kaybı ile veri yokluğu ayırt edilemez' },
    ];
}
export function shiftRows(shifts) {
    return shifts.map((s) => {
        const w = s.windowSeconds;
        const g = (k) => (typeof s.seconds[k] === 'number' ? s.seconds[k] : null);
        const cov = s.coveragePct;
        return {
            shiftCode: s.shiftCode, label: s.label, windowFrom: s.windowFrom, windowTo: s.windowTo, plannedSeconds: s.plannedSeconds, coveragePct: cov, sufficient: !!s.dataSufficient && cov !== null && cov >= MIN_COVERAGE_PCT,
            activePct: pct(g('ACTIVE'), w), stoppedPct: pct(g('STOPPED'), w), feedHoldPct: pct(g('FEED_HOLD'), w), interruptedPct: pct(g('INTERRUPTED'), w), alarmPct: pct(g('ALARM'), w), noDataPct: pct((g('NO_DATA') ?? 0) + (g('UNKNOWN') ?? 0), w),
            activeSeconds: g('ACTIVE'), feedHoldSeconds: g('FEED_HOLD'), noDataSeconds: (g('NO_DATA') ?? 0) + (g('UNKNOWN') ?? 0),
            programChanges: s.programChanges, m30Delta: s.m30Delta, cycleMedianS: s.cycleSeconds?.median ?? null, cycleMinS: s.cycleSeconds?.min ?? null, cycleMaxS: s.cycleSeconds?.max ?? null, cycleN: s.cycleSeconds?.n ?? 0,
            woMatchedActiveSeconds: s.woMatchedActiveSeconds, woUnmatchedActiveSeconds: s.woUnmatchedActiveSeconds,
        };
    });
}
export const INSUFFICIENT_TR = 'GÜVENİLİR ANALİZ İÇİN VERİ YETERSİZ';
const label = (r) => `${r.label} (${r.windowFrom.slice(5, 10).split('-').reverse().join('.')})`;
const confOf = (r) => ((r.coveragePct ?? 0) >= 95 ? 'YÜKSEK' : (r.coveragePct ?? 0) >= MIN_COVERAGE_PCT ? 'ORTA' : 'DÜŞÜK');
/** Deterministic, rule-based observations from already-calculated shift metrics. Every statement carries the shifts and the numbers that support it.
 *  It states WHAT the data shows and WHEN — never WHY (a cause cannot be read from controller data) and never about a person. */
export function analyseShifts(shifts) {
    const rows = shiftRows(shifts);
    const ok = rows.filter((r) => r.sufficient);
    if (ok.length < 2) {
        return { status: 'INSUFFICIENT_DATA', headline: INSUFFICIENT_TR, sufficientCount: ok.length, total: rows.length, rows, observations: [],
            recommendations: rows.some((r) => !r.sufficient) && rows.length ? [{ id: 'data-quality', priority: 1, finding: 'Karşılaştırma için yeterli CNC verisi olan vardiya sayısı 2’den az.', measurement: `${ok.length}/${rows.length} vardiyada veri kapsamı ≥ %${MIN_COVERAGE_PCT}`, shifts: rows.filter((r) => !r.sufficient).map(label), action: 'Veri toplayıcının (Lenovo) çalışmasını ve vardiya boyunca kesintisiz veri geldiğini kontrol edin.', confidence: 'DÜŞÜK' }] : [] };
    }
    const obs = [];
    const by = (f, dir) => { let best = null; for (const r of ok) {
        const v = f(r);
        if (v === null)
            continue;
        if (!best || (dir === 'max' ? v > f(best) : v < f(best)))
            best = r;
    } return best; };
    const hiAct = by((r) => r.activePct, 'max'), loAct = by((r) => r.activePct, 'min');
    if (hiAct && loAct && hiAct !== loAct && hiAct.activePct !== null && loAct.activePct !== null && hiAct.activePct - loAct.activePct >= 1)
        obs.push({ id: 'active-range', shifts: [label(hiAct), label(loAct)], text: `Program aktif süresi en yüksek ${label(hiAct)} (${fmtPct(hiAct.activePct)}), en düşük ${label(loAct)} (${fmtPct(loAct.activePct)}).`, evidence: `aktif ${fmtDur(hiAct.activeSeconds)} / ${fmtDur(loAct.activeSeconds)}` });
    const hiFh = by((r) => r.feedHoldPct, 'max');
    if (hiFh && (hiFh.feedHoldPct ?? 0) >= 1)
        obs.push({ id: 'feed-hold', shifts: [label(hiFh)], text: `FEED HOLD süresi en fazla ${label(hiFh)} içinde (${fmtDur(hiFh.feedHoldSeconds)}, ${fmtPct(hiFh.feedHoldPct)}). Nedeni CNC verisinden belirlenemez.`, evidence: `FEED HOLD ${fmtDur(hiFh.feedHoldSeconds)}` });
    const hiStop = by((r) => (r.stoppedPct ?? 0) + (r.interruptedPct ?? 0), 'max');
    if (hiStop && ((hiStop.stoppedPct ?? 0) + (hiStop.interruptedPct ?? 0)) >= 1 && hiStop !== hiAct)
        obs.push({ id: 'stopped', shifts: [label(hiStop)], text: `CNC duruş / kesinti payı en yüksek ${label(hiStop)} (${fmtPct((hiStop.stoppedPct ?? 0) + (hiStop.interruptedPct ?? 0))}).`, evidence: 'durmuş + kesinti süreleri' });
    const hiPc = by((r) => r.programChanges, 'max');
    if (hiPc && (hiPc.programChanges ?? 0) >= 2)
        obs.push({ id: 'program-changes', shifts: [label(hiPc)], text: `Program değişimi en yoğun ${label(hiPc)} içinde (${hiPc.programChanges} değişim).`, evidence: `${hiPc.programChanges} program değişimi` });
    const withCycle = ok.filter((r) => r.cycleMedianS !== null && r.cycleN >= 3);
    if (withCycle.length >= 2) {
        const lo = withCycle.reduce((a, b) => (a.cycleMedianS <= b.cycleMedianS ? a : b));
        const hi = withCycle.reduce((a, b) => (a.cycleMedianS >= b.cycleMedianS ? a : b));
        if (hi.cycleMedianS >= lo.cycleMedianS * 1.15)
            obs.push({ id: 'cycle', shifts: [label(hi), label(lo)], text: `Ortanca çevrim süresi ${label(hi)} içinde ${NUM.format(hi.cycleMedianS)} sn, ${label(lo)} içinde ${NUM.format(lo.cycleMedianS)} sn (aynı program olduğu doğrulanmadıkça bu fark program farkı olabilir).`, evidence: `${hi.cycleN}/${lo.cycleN} çevrim` });
    }
    const unm = ok.reduce((s, r) => s + (r.woUnmatchedActiveSeconds ?? 0), 0), act = ok.reduce((s, r) => s + (r.activeSeconds ?? 0), 0);
    if (act > 0 && unm / act >= 0.1)
        obs.push({ id: 'wo-unmatched', shifts: ok.filter((r) => (r.woUnmatchedActiveSeconds ?? 0) > 0).map(label), text: `CNC aktifken iş emri oturumu olmayan süre ${fmtDur(unm)} (aktif sürenin ${fmtPct((unm / act) * 100)}).`, evidence: `eşleşmeyen ${fmtDur(unm)} / aktif ${fmtDur(act)}` });
    // trend: newest sufficient vs the previous sufficient (rows are newest first)
    if (ok.length >= 2 && ok[0].activePct !== null && ok[1].activePct !== null) {
        const d = ok[0].activePct - ok[1].activePct;
        if (Math.abs(d) >= 5)
            obs.push({ id: 'trend', shifts: [label(ok[0]), label(ok[1])], text: `Son tamamlanan vardiyada program aktif payı bir öncekine göre ${d > 0 ? 'arttı' : 'azaldı'} (${fmtPct(ok[1].activePct)} → ${fmtPct(ok[0].activePct)}).`, evidence: `${NUM.format(Math.abs(d))} puan fark` });
    }
    const lowCov = rows.filter((r) => !r.sufficient);
    if (lowCov.length)
        obs.push({ id: 'coverage', shifts: lowCov.map(label), text: `${lowCov.length} vardiyada CNC veri kapsamı %${MIN_COVERAGE_PCT} altında; bu vardiyalar karşılaştırmaya alınmadı.`, evidence: lowCov.map((r) => `${label(r)} ${fmtPct(r.coveragePct)}`).join(' · ') });
    const recs = [];
    if (lowCov.length)
        recs.push({ id: 'data-quality', priority: 1, finding: 'Bazı vardiyalarda CNC verisi eksik.', measurement: lowCov.map((r) => `${label(r)} kapsam ${fmtPct(r.coveragePct)}`).join('; '), shifts: lowCov.map(label), action: 'Toplayıcı bilgisayarın ve ağın bu zaman aralıklarındaki durumunu kontrol edin.', confidence: 'YÜKSEK' });
    if (act > 0 && unm / act >= 0.1)
        recs.push({ id: 'wo-unmatched', priority: 2, finding: 'CNC çalışırken iş emri kaydı olmayan süre var.', measurement: `${fmtDur(unm)} (aktif sürenin ${fmtPct((unm / act) * 100)})`, shifts: ok.filter((r) => (r.woUnmatchedActiveSeconds ?? 0) > 0).map(label), action: 'İlgili zaman aralıklarında hangi iş yapıldığını ve iş emri başlatılıp başlatılmadığını yetkili kullanıcı olarak inceleyin; eşleştirme yalnızca onayla yapılır.', confidence: confOf(ok[0]) });
    if (hiFh && (hiFh.feedHoldPct ?? 0) >= 3)
        recs.push({ id: 'feed-hold', priority: 2, finding: 'FEED HOLD payı belirgin.', measurement: `${label(hiFh)}: ${fmtDur(hiFh.feedHoldSeconds)} (${fmtPct(hiFh.feedHoldPct)})`, shifts: [label(hiFh)], action: 'Bu aralıktaki duruş kayıtlarını ve operatör beyanlarını kontrol edin; neden CNC verisinden belirlenemez.', confidence: confOf(hiFh) });
    const cyc = obs.find((o) => o.id === 'cycle');
    if (cyc)
        recs.push({ id: 'cycle', priority: 3, finding: 'Çevrim sürelerinde vardiyalar arası fark var.', measurement: cyc.text, shifts: cyc.shifts, action: 'Aynı programın çalıştığını ve çevrim süresi hedefini kontrol edin.', confidence: 'ORTA' });
    recs.sort((a, b) => a.priority - b.priority);
    const top = ok.filter((r) => r.activePct !== null).sort((a, b) => b.activePct - a.activePct)[0];
    const headline = top ? `Son ${rows.length} tamamlanmış vardiyanın ${ok.length} tanesinde yeterli CNC verisi var; program aktif payı en yüksek ${label(top)} (${fmtPct(top.activePct)}).` : INSUFFICIENT_TR;
    return { status: 'READY', headline, sufficientCount: ok.length, total: rows.length, observations: obs, recommendations: recs.slice(0, 3), rows };
}
export function aiStatus(a, integration = 'NONE') {
    if (a.status === 'INSUFFICIENT_DATA')
        return { status: 'INSUFFICIENT_DATA', text: INSUFFICIENT_TR };
    if (integration === 'NONE')
        return { status: 'NOT_CONFIGURED', text: 'KMI AI yorumu henüz etkin değil: yapay zekâ servisi bağlantısı onaylanmadı. Aşağıdaki bulgular yapay zekâ değil, veritabanında hesaplanmış ölçümlerden kurallarla üretilmiştir.' };
    return { status: 'READY', text: '' };
}
/** Validates numbers an AI text claims against the calculated metrics (used when a model is connected): every number in the text must appear in the allowed set. */
export function unverifiedNumbers(text, a) {
    const allowed = new Set();
    const add = (v, d = 1) => { if (v === null || v === undefined || !Number.isFinite(v))
        return; allowed.add(String(Math.round(v))); allowed.add(v.toFixed(d).replace('.', ',')); allowed.add(String(v)); };
    for (const r of a.rows) {
        [r.coveragePct, r.activePct, r.stoppedPct, r.feedHoldPct, r.interruptedPct, r.alarmPct, r.noDataPct].forEach((x) => add(x));
        [r.programChanges, r.m30Delta, r.cycleMedianS, r.cycleMinS, r.cycleMaxS, r.cycleN].forEach((x) => add(x, 0));
    }
    const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
    return [...new Set(found.filter((n) => !allowed.has(n) && !allowed.has(n.replace(',', '.')) && !allowed.has(String(Math.round(Number(n.replace(',', '.')))))))];
}
