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
/** seconds elapsed since the stamp: the LARGER of the monotonic clock and the wall clock, so a laptop that slept (monotonic clocks may pause) or a background tab can never make the data look younger; a wall clock moved backwards is ignored */
const elapsedS = (row) => Math.max(0, (cncNowMs() - row.fetchedAtMs) / 1000, typeof row.fetchedWallMs === 'number' ? (cncWallMs() - row.fetchedWallMs) / 1000 : 0);
/** ONE calculation of "is this CNC row still live NOW": a row that was UP when fetched stops being UP once its (server age + time since fetch) passes the threshold. Rows that were not UP stay as the server said. */
export function adjustCnc(row) {
    if (!row || row.link !== 'UP' || typeof row.fetchedAtMs !== 'number')
        return row;
    const age = (Number(row.ageS) || 0) + elapsedS(row);
    return age > CNC_STALE_S ? { ...row, link: 'STALE', ageS: age, expiredLocally: true } : { ...row, ageS: age };
}
/** ms until the soonest UP row expires (null when none is UP) — screens schedule ONE re-render at that moment instead of showing a frozen "live" fact */
export function msUntilCncExpiry(rows) {
    let best = null;
    for (const r0 of rows ?? []) {
        const r = adjustCnc(r0);
        if (!r || r.link !== 'UP' || typeof r.fetchedAtMs !== 'number')
            continue;
        const left = Math.max(0, (CNC_STALE_S - (Number(r.ageS) || 0)) * 1000);
        best = best === null ? left : Math.min(best, left);
    }
    return best;
}
/** current data age in seconds (server age at fetch + elapsed); null when unknown */
export const cncAgeSeconds = (row) => { const r = adjustCnc(row); return r && r.ageS != null ? Number(r.ageS) : null; };
export function cncDisplay(row0) {
    const row = adjustCnc(row0);
    const link = row && LINKS.has(row.link) ? row.link : 'NEVER';
    const up = link === 'UP';
    const state = up && row && STATES.has(row.state) ? row.state : 'CNC_UNKNOWN';
    const rpm = up ? row?.spindleRpm ?? null : null;
    const staleWarning = link === 'STALE' ? `Veri bayat${row?.ageS != null ? ` (${Math.round(row.ageS)} sn önce)` : ''} — son durum güncel sayılmaz`
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
