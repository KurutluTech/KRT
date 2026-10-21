// KMI CNC Faaliyet Merkezi — pure helpers (no DOM, no network): shift board rows, scopes, time-axis ticks, segment clustering, same-elapsed comparison.
// Durations are NEVER computed here from raw samples; they come from the database read models (cnc_shift_board / cnc_activity_summary). This file only arranges them.
import { MIN_COVERAGE_PCT, SEG_KINDS } from './cncActivity.js';
const TR = '+03:00';
const trDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso));
export const dayStartIso = (ymd) => `${ymd}T00:00:00${TR}`;
export const addDaysYmd = (ymd, n) => trDay(new Date(Date.parse(`${ymd}T12:00:00${TR}`) + n * 86400000).toISOString());
/** Scope → time window. ACTIVE/PREV come from the shift calendar rows (server); an ACTIVE window ends NOW (never at the planned end). */
export function scopeOf(key, nowIso, board, custom, shiftIndex) {
    const today = trDay(nowIso);
    if (key === 'ACTIVE') {
        const a = board.find((s) => s.isActive);
        return a ? { key, from: a.windowFrom, to: nowIso, label: `${a.label} (devam ediyor)`, shiftIndex: board.indexOf(a) } : null;
    }
    if (key === 'PREV') {
        const i = board.findIndex((s) => s.isActive);
        const p = board[i >= 0 ? i + 1 : 0];
        return p ? { key, from: p.windowFrom, to: p.windowTo, label: `${p.label} · ${p.shiftDate}`, shiftIndex: board.indexOf(p) } : null;
    }
    if (key === 'SHIFT') {
        const s = shiftIndex !== undefined ? board[shiftIndex] : undefined;
        return s ? { key, from: s.windowFrom, to: s.isActive ? nowIso : s.windowTo, label: `${s.label} · ${s.shiftDate}${s.isActive ? ' (devam ediyor)' : ''}`, shiftIndex } : null;
    }
    if (key === 'DAY')
        return { key, from: dayStartIso(today), to: nowIso, label: `Gün · ${today}` };
    if (key === 'WEEK')
        return { key, from: dayStartIso(addDaysYmd(today, -6)), to: nowIso, label: 'Son 7 gün' };
    if (key === 'MONTH')
        return { key, from: dayStartIso(addDaysYmd(today, -29)), to: nowIso, label: 'Son 30 gün' };
    const f = custom?.f || addDaysYmd(today, -1), t = custom?.t || today;
    const end = t >= today ? nowIso : dayStartIso(addDaysYmd(t, 1));
    return { key: 'CUSTOM', from: dayStartIso(f), to: end, label: `${f} – ${t}` };
}
const sec = (s, k) => (typeof s.seconds[k] === 'number' ? s.seconds[k] : null);
/** One display row per shift. Performance numbers of a shift whose controller coverage is below the minimum are NOT shown (null) — no misleading percentages. */
export function boardRows(board, fmtDur) {
    return board.map((s, index) => {
        const sufficient = !!s.dataSufficient && s.coveragePct !== null && s.coveragePct >= MIN_COVERAGE_PCT;
        const nd = (sec(s, 'NO_DATA') ?? 0) + (sec(s, 'UNKNOWN') ?? 0);
        return {
            index, shiftCode: s.shiftCode, label: s.label, shiftDate: s.shiftDate, isActive: s.isActive, statusTr: s.isActive ? 'CANLI · DEVAM EDİYOR' : 'Tamamlandı', emphasised: index < 2,
            scopeText: s.isActive ? `Geçen ${fmtDur(s.elapsedSeconds)} / planlanan ${fmtDur(s.plannedSeconds)} — kısmi vardiya` : `${fmtDur(s.windowSeconds)} (tam vardiya)`,
            coveragePct: s.coveragePct, sufficient, activeSeconds: sufficient ? sec(s, 'ACTIVE') : null, stoppedSeconds: sufficient ? sec(s, 'STOPPED') : null, alarmSeconds: sec(s, 'ALARM'), noDataSeconds: nd,
            feedHoldSeconds: sufficient ? sec(s, 'FEED_HOLD') : null, cycleEvents: s.cycleEvents, programChanges: s.programChanges, m30Delta: s.m30Delta, woMatchedActiveSeconds: s.woMatchedActiveSeconds, windowFrom: s.windowFrom, windowTo: s.windowTo,
        };
    });
}
/** Active shift vs the previous shift over the SAME elapsed time. Null when either side has too little controller data (no fake comparison). */
export function compareSameElapsed(active) {
    if (!active || !active.isActive || !active.previousSameElapsed)
        return null;
    const p = active.previousSameElapsed;
    const ok = (c) => c !== null && c >= MIN_COVERAGE_PCT;
    if (!ok(active.coveragePct) || !ok(p.coveragePct))
        return null;
    const mk = (key, label) => {
        const g = (s) => (key === 'NODATA' ? (sec(s, 'NO_DATA') ?? 0) + (sec(s, 'UNKNOWN') ?? 0) : (sec(s, key) ?? 0));
        return { key, label, now: g(active), prev: g(p), delta: g(active) - g(p) };
    };
    return { elapsedSeconds: active.elapsedSeconds, prevLabel: `${p.label} · ${p.shiftDate}`, items: [mk('ACTIVE', 'Program aktif'), mk('STOPPED', 'CNC durmuş'), mk('FEED_HOLD', 'FEED HOLD'), mk('ALARM', 'Alarm / acil'), mk('NODATA', 'Veri yok / bilinmeyen')] };
}
// ───────────── time axis ─────────────
const STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080];
const ist = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false });
const istDay = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit' });
/** Readable clock ticks (Istanbul time) aiming at one tick per ~90 px. The first tick of a new day carries the date. */
export function axisTicks(fromMs, toMs, widthPx) {
    const span = toMs - fromMs;
    if (!(span > 0) || widthPx <= 0)
        return [];
    const want = Math.max(2, Math.floor(widthPx / 90));
    const stepMin = STEPS_MIN.find((m) => (span / 60000) / m <= want) ?? STEPS_MIN[STEPS_MIN.length - 1];
    const step = stepMin * 60000;
    const off = 3 * 3600000; // Türkiye UTC+3 (no DST): align ticks to local clock
    const out = [];
    let t = Math.ceil((fromMs + off) / step) * step - off;
    let lastDay = '';
    for (; t <= toMs; t += step) {
        const d = istDay.format(new Date(t));
        const midnight = ist.format(new Date(t)) === '00:00';
        const label = (d !== lastDay && (midnight || out.length === 0 || stepMin >= 1440)) ? (stepMin >= 1440 ? d : `${d} ${ist.format(new Date(t))}`) : ist.format(new Date(t));
        lastDay = d;
        out.push({ ms: t, leftPct: ((t - fromMs) / span) * 100, label, major: midnight || stepMin >= 60 });
    }
    return out;
}
const SEVERITY = ['ALARM', 'FEED_HOLD', 'INTERRUPTED', 'STOPPED', 'ACTIVE', 'UNKNOWN', 'NO_DATA'];
const kindOf = (k) => (SEG_KINDS.includes(k) ? k : 'UNKNOWN');
/** Visible-window layout. Segments narrower than `minPx` are merged into clusters (worst-severity colour, count kept) so short events never vanish; alarms are never hidden inside a cluster colour. */
export function clusterSegments(segs, viewFromMs, viewToMs, widthPx, minPx = 4) {
    const span = viewToMs - viewFromMs;
    if (!(span > 0) || widthPx <= 0)
        return [];
    const px = (ms) => (ms / span) * widthPx;
    const items = [];
    let cur = null;
    const flush = () => { if (cur) {
        cur.widthPct = Math.max(cur.widthPct, (minPx / widthPx) * 100);
        items.push(cur);
        cur = null;
    } };
    for (const s of [...segs].sort((a, b) => Date.parse(a.segStart) - Date.parse(b.segStart))) {
        const a = Math.max(viewFromMs, Date.parse(s.segStart)), b = Math.min(viewToMs, Date.parse(s.segEnd));
        if (!(b > a))
            continue;
        const k = kindOf(s.kind);
        const wpx = px(b - a);
        if (wpx >= minPx) {
            flush();
            items.push({ kind: k, startMs: a, endMs: b, count: 1, leftPct: ((a - viewFromMs) / span) * 100, widthPct: (wpx / widthPx) * 100, cluster: false, kinds: { [k]: b - a }, seg: s, segs: [s] });
            continue;
        }
        if (cur && px(a - cur.endMs) <= minPx) {
            cur.endMs = b;
            cur.count += 1;
            cur.kinds[k] = (cur.kinds[k] ?? 0) + (b - a);
            cur.segs.push(s);
            cur.widthPct = ((cur.endMs - cur.startMs) / span) * 100;
            cur.cluster = true;
            if (SEVERITY.indexOf(k) < SEVERITY.indexOf(cur.kind))
                cur.kind = k;
        }
        else {
            flush();
            cur = { kind: k, startMs: a, endMs: b, count: 1, leftPct: ((a - viewFromMs) / span) * 100, widthPct: (wpx / widthPx) * 100, cluster: false, kinds: { [k]: b - a }, seg: s, segs: [s] };
        }
    }
    flush();
    return items;
}
