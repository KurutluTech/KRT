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
export function cncDisplay(row) {
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
