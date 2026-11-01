export const CNC_LINK_TR = { UP: 'CNC bağlantısı: BAĞLI', STALE: 'CNC bağlantısı: VERİ BAYAT', CNC_DOWN: 'CNC bağlantısı: CNC\'ye ULAŞILAMIYOR', NEVER: 'CNC bağlantısı: henüz veri yok' };
export const CNC_STATE_TR = {
    CNC_ACTIVE: 'ÇALIŞIYOR (program koşuyor)', CNC_FEED_HOLD: 'FEED HOLD (ilerleme durdu)', CNC_STOPPED: 'DURUYOR', CNC_INTERRUPTED: 'KESİNTİ / BEKLEME', CNC_ALARM: 'ALARM / ACİL STOP', CNC_UNKNOWN: 'BİLİNMİYOR',
};
export const CNC_TONE = { CNC_ACTIVE: 'GREEN', CNC_STOPPED: 'BLUE', CNC_ALARM: 'RED', CNC_FEED_HOLD: 'AMBER', CNC_INTERRUPTED: 'AMBER', CNC_UNKNOWN: 'GREY' };
export const CNC_TONE_CSS = { GREEN: '#34d399', BLUE: '#4da3ff', RED: '#f87171', AMBER: '#fbbf24', GREY: '#94a3b8' };
const STATES = new Set(['CNC_ACTIVE', 'CNC_FEED_HOLD', 'CNC_STOPPED', 'CNC_INTERRUPTED', 'CNC_ALARM', 'CNC_UNKNOWN']);
const LINKS = new Set(['UP', 'STALE', 'CNC_DOWN', 'NEVER']);
function safety(row) {
    const e = String(row?.estop ?? '').toUpperCase();
    const estop = e === 'ARMED' || e === 'TRIGGERED' ? e : 'UNKNOWN';
    const alarmKnown = row != null && row.alarm != null && String(row.alarm).trim() !== '';
    const estopTr = estop === 'ARMED' ? 'Acil stop: KURULU (basılı değil)' : estop === 'TRIGGERED' ? 'Acil stop: BASILI' : 'Acil stop: BİLİNMİYOR';
    const alarmTr = alarmKnown ? `Alarm: ${String(row?.alarm)}` : 'Alarm: BİLGİ YOK (Haas alarm bilgisi göndermiyor — "alarm yok" anlamına gelmez)';
    return { estop, alarmKnown, safetyLine: `${estopTr} · ${alarmTr}` };
}
/** Freshness threshold in seconds. MIRRORS the production rule kmi_next.cnc_link_of(p_stale_s default 45); the server stays the authority at fetch time, the client only keeps the fetched fact from outliving it. */
export const CNC_STALE_S = 45;
/** monotonic ms clock (immune to the browser's wall-clock offset); tests may override globalThis.__cncNowMs */
export const cncNowMs = () => (globalThis.__cncNowMs !== undefined ? globalThis.__cncNowMs : typeof performance !== 'undefined' ? performance.now() : Date.now());
/** mark a freshly fetched cnc_live_states row with the moment it was received */
export const cncWallMs = () => (globalThis.__cncWallMs !== undefined ? globalThis.__cncWallMs : Date.now());
/** stamp = the moment the REQUEST WAS SENT (a slow response can only make the row look older, never fresher). A row already stamped keeps its original stamp. */
export const stampCnc = (row, at) => (!row || typeof row.fetchedAtMs === 'number' ? row : { ...row, fetchedAtMs: at?.mono ?? cncNowMs(), fetchedWallMs: at?.wall ?? cncWallMs() });
/** ONE reference instant for a whole evaluation/render: callers read the clocks ONCE and pass it down, so a single screen never mixes two instants at the 45 s boundary. */
export const cncClock = () => ({ mono: cncNowMs(), wall: cncWallMs() });
/** seconds elapsed since the stamp: the LARGER of the monotonic clock and the wall clock, so a laptop that slept (monotonic clocks may pause) or a background tab can never make the data look younger; a wall clock moved backwards is ignored.
 *  `at` = optional explicit reference time {mono, wall} (ms) — with it the evaluation is a pure function of (row, at). */
const elapsedS = (row, at) => Math.max(0, ((at?.mono ?? cncNowMs()) - row.fetchedAtMs) / 1000, typeof row.fetchedWallMs === 'number' ? ((at?.wall ?? cncWallMs()) - row.fetchedWallMs) / 1000 : 0);
/** a usable server age: finite number >= 0, else null (garbage / missing = NO evidence, never "0 s old") */
const validAge = (v) => { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
/** FRESHNESS EVIDENCE = server receipt only: a valid server age (derived from the ingest time) or a valid ingest timestamp. The CNC device sample clock (lastSourceTs) is NOT evidence of freshness. ONE definition for every evaluator. */
export const hasCncReceiptEvidence = (row) => !!row && typeof row === 'object' && (validAge(row.ageS) !== null || (!!row.lastIngestedAt && Number.isFinite(new Date(row.lastIngestedAt).getTime())));
/** 2N-1 — THE ONE canonical freshness calculation (mirrors production kmi_next.cnc_link_of, > 45 s = STALE; exactly 45 s is still UP).
 *  PURE and IDEMPOTENT: the result depends only on (the fetched fact, the reference time). The fetched fact — link and server age AT FETCH, i.e. server-receipt based, never the CNC device clock —
 *  is kept in `cncBase` on the result, and every later evaluation (of the raw row OR of an already evaluated row) starts from that base, so the elapsed time is added exactly once.
 *  The base is only trusted if it belongs to the same stamp (fetchedAtMs); anything else is treated as a raw row.
 *  Unstamped rows (no fetch moment known) are returned as they are, except that an UP row whose own age already exceeds the threshold is STALE. A server-side non-UP link is never upgraded. */
export function adjustCnc(row, at) {
    if (!row || typeof row !== 'object')
        return row;
    const stamped = typeof row.fetchedAtMs === 'number';
    const trusted = stamped && row.cncBase && typeof row.cncBase === 'object' && row.cncBase.fetchedAtMs === row.fetchedAtMs;
    const base = trusted ? row.cncBase : { link: row.link, ageS: row.ageS, fetchedAtMs: row.fetchedAtMs };
    const age0 = validAge(base.ageS);
    const el = stamped ? elapsedS(row, at) : 0;
    const sticky = trusted && row.expiredLocally === true && row.link === 'STALE';   // already expired by this evaluator: stale data never becomes fresh again without a NEW fetch
    const ageNow = age0 === null ? null : age0 + el;
    const age = sticky ? Math.max(ageNow ?? 0, validAge(row.ageS) ?? 0) : ageNow;
    const expired = base.link === 'UP' && (sticky || (ageNow !== null ? ageNow > CNC_STALE_S : el > CNC_STALE_S));
    if (!stamped && !expired)
        return row;
    const out = { ...row, link: expired ? 'STALE' : base.link, ageS: age };
    if (expired)
        out.expiredLocally = true;
    else
        delete out.expiredLocally;
    if (stamped)
        out.cncBase = { link: base.link, ageS: base.ageS, fetchedAtMs: base.fetchedAtMs };
    return out;
}
/** ms until the soonest UP row expires (null when none is UP) — screens schedule ONE re-render at that moment instead of showing a frozen "live" fact */
export function msUntilCncExpiry(rows, at0) {
    const at = at0 ?? cncClock();
    let best = null;
    for (const r0 of rows ?? []) {
        const r = adjustCnc(r0, at);
        if (!r || r.link !== 'UP' || typeof r.fetchedAtMs !== 'number')
            continue;
        const left = Math.max(0, (CNC_STALE_S - (Number(r.ageS) || 0)) * 1000);
        best = best === null ? left : Math.min(best, left);
    }
    return best;
}
/** current data age in seconds (server age at fetch + elapsed); null when unknown */
export const cncAgeSeconds = (row, at) => { const r = adjustCnc(row, at); return r && r.ageS != null && Number.isFinite(Number(r.ageS)) ? Number(r.ageS) : null; };
export function cncDisplay(row0, at) {
    const row = adjustCnc(row0, at ?? cncClock());
    const link0 = row && LINKS.has(row.link) ? row.link : 'NEVER';
    const link = link0 === 'UP' && !hasCncReceiptEvidence(row) ? 'STALE' : link0;   // 2N-1: UP without any server-receipt evidence is never shown as live
    const up = link === 'UP';
    const state = up && row && STATES.has(row.state) ? row.state : 'CNC_UNKNOWN';
    const rpm = up ? row?.spindleRpm ?? null : null;
    const staleWarning = link === 'STALE' && link0 === 'UP' ? 'Verinin sunucuya ulaşma zamanı / yaşı yok — güncelliği kanıtlanamıyor, son durum güncel sayılmaz'
        : link === 'STALE' ? `Veri bayat${row?.ageS != null ? ` (${Math.round(row.ageS)} sn önce)` : ''} — son durum güncel sayılmaz`
        : link === 'CNC_DOWN' ? 'Toplayıcı çalışıyor ama CNC\'ye ulaşamıyor — son durum güncel sayılmaz' : link === 'NEVER' ? 'Bu cihazdan henüz veri gelmedi' : null;
    return {
        link, linkTr: CNC_LINK_TR[link], state, stateTr: CNC_STATE_TR[state], tone: CNC_TONE[state],
        spindleRpm: rpm, program: up ? row?.program ?? null : null, lastCycleS: up ? row?.lastCycleS ?? null : null, m30Count: up ? row?.m30Count ?? null : null,
        lastDataAt: row?.lastIngestedAt ?? null, ageS: row?.ageS ?? null, source: 'CNC', stale: !up, staleWarning,
        spindleTurningNotRunning: up && state !== 'CNC_ACTIVE' && (rpm ?? 0) > 0,
        ...safety(up ? row : null),
        // last KNOWN values for a not-live row: shown only as history ("son bilinen"), never as the current fact
        lastKnown: { safetyLine: safety(row).safetyLine, estop: safety(row).estop, alarm: row?.alarm ?? null, program: row?.program ?? null, receivedAt: row?.lastIngestedAt ?? null, sourceAt: row?.lastSourceTs ?? null },
        ageSecondsNow: row?.ageS != null ? Number(row.ageS) : null, staleAfterS: CNC_STALE_S,
    };
}
/** What the existing machineState() should receive as `telemetry`: only a fresh, unambiguous ACTIVE / STOPPED. FEED_HOLD, INTERRUPTED, ALARM and anything not-UP give null (physical stays UNKNOWN, no false conflict). */
export function telemetryInput(c) {
    if (c.link !== 'UP')
        return null;
    return c.state === 'CNC_ACTIVE' ? { running: true } : c.state === 'CNC_STOPPED' ? { running: false } : null;
}
/** Honest side-by-side notes: CNC fact vs operator/administrative record. Empty when they simply agree. Owner scenarios 13 and 14 live here. */
export function cncNotes(ms, c) {
    if (c.link !== 'UP')
        return [];
    const out = [];
    const woActive = ms.workOrderActivity === 'ACTIVE';
    if (ms.availability === 'MAINTENANCE' && c.state === 'CNC_ACTIVE')
        out.push('Bakım / test modunda: CNC program koşuyor (üretim sayılmaz, iş emri yok sayılır)');
    else if (ms.availability !== 'MAINTENANCE') {
        if (c.state === 'CNC_ACTIVE' && !woActive)
            out.push('CNC çalışıyor ama aktif iş emri kaydı yok');
        if (woActive && c.state === 'CNC_STOPPED')
            out.push('İş emri aktif görünüyor ama CNC duruyor');
        if (woActive && c.state === 'CNC_FEED_HOLD')
            out.push('İş emri aktif; CNC FEED HOLD\'da (operatör bekletmiş olabilir)');
    }
    if (c.state === 'CNC_ALARM')
        out.push('CNC alarm / acil stop bildiriyor — makine kaydını kontrol edin');
    if (c.spindleTurningNotRunning)
        out.push('Mil dönüyor ama kontrol "çalışıyor" demiyor — durum mil hızından çıkarılmaz');
    return out;
}
