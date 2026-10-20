export const MACHINE_CLASS_TR = { MACHINING: 'CNC / talaşlı imalat', MEASUREMENT: 'Ölçüm / metroloji', MATERIAL_HANDLING: 'Malzeme taşıma', AUXILIARY: 'Yardımcı ekipman' };
export const MACHINE_CLASS_UNKNOWN_TR = 'Sınıf belirtilmemiş';
export const DATA_SOURCE_TR = { OPERATOR_DECLARED: 'Operatör beyanı', CNC_CONNECTED: 'CNC bağlantısı (doğrulanmış)', UNKNOWN: 'Bilinmiyor', STALE: 'Bayat — güncel veri yok' };
/** KMI-013 spindle colour language: GREEN running · BLUE idle · RED fault · ORANGE maintenance. HOLD/FIRST_PIECE/STALE/UNKNOWN stay separate (never forced into the four). */
export const SPINDLE_COLOUR_TR = { ACTIVE_WORK_ORDER: 'YEŞİL', READY_IDLE: 'MAVİ', DOWN: 'KIRMIZI', MAINTENANCE: 'TURUNCU' };
export const HEADLINE_TR = {
    DOWN: 'ARIZA', MAINTENANCE: 'BAKIMDA', HOLD: 'BEKLETMEDE', ACTIVE_WORK_ORDER: 'AKTİF İŞ EMRİ', FIRST_PIECE: 'İLK PARÇA', READY_IDLE: 'HAZIR · BOŞTA', UNKNOWN: 'BİLİNMİYOR',
    CNC_RUNNING: 'ÇALIŞIYOR · CNC', CNC_FEED_HOLD: 'FEED HOLD · CNC', CNC_ALARM: 'ALARM / ACİL STOP · CNC', CNC_STALE: 'VERİ BAYAT · CNC',
};
export const AVAILABILITY_TR = { READY: 'Kullanıma hazır', DOWN: 'Arızalı', MAINTENANCE: 'Bakımda', HOLD: 'Bekletmede', UNKNOWN: 'Bilinmiyor' };
export const PHYSICAL_TR = 'Fiziksel çalışma: BİLİNMİYOR (CNC bağlantısı yok)';
export function machineState(i) {
    const availability = i.status === 'UP' ? 'READY' : i.status === 'DOWN' ? 'DOWN' : i.status === 'MAINTENANCE' ? 'MAINTENANCE' : i.status === 'HOLD' ? 'HOLD' : 'UNKNOWN';
    const live = i.active.filter((a) => !a.stale); // a silent/old session never counts as running
    const workOrderActivity = live.some((a) => a.runStatus === 'IN_PROGRESS') ? 'ACTIVE'
        : live.some((a) => a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED') ? 'FIRST_PIECE' : 'NONE';
    const stale = availability === 'READY' && live.length === 0 && i.active.some((a) => !!a.stale && (a.runStatus === 'IN_PROGRESS' || a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED'));
    const t = i.telemetry && i.telemetry.running !== null && i.telemetry.running !== undefined ? i.telemetry
        : i.cnc && i.cnc.link === 'UP' && (i.cnc.state === 'CNC_ACTIVE' || i.cnc.state === 'CNC_STOPPED') ? { running: i.cnc.state === 'CNC_ACTIVE' } : null;
    const physical = t ? (t.running ? 'RUNNING' : 'STOPPED') : 'UNKNOWN';
    // CNC-connected machine: the controller (via cnc_live_states, already interpreted in the database) decides the headline — but ONLY while the administrative record is READY.
    // DOWN / MAINTENANCE / HOLD / UNKNOWN stay exactly as people recorded them (a CNC signal never changes maintenance authority); a disagreement is shown through `conflict` and the CNC notes.
    const c = i.cnc ?? null;
    const cncUp = !!c && c.link === 'UP';
    const cncHead = !c || availability !== 'READY' ? null
        : !cncUp ? 'CNC_STALE'
            : c.state === 'CNC_ALARM' ? 'CNC_ALARM'
                : c.state === 'CNC_ACTIVE' ? (workOrderActivity === 'ACTIVE' ? 'ACTIVE_WORK_ORDER' : 'CNC_RUNNING')
                    : c.state === 'CNC_FEED_HOLD' ? 'CNC_FEED_HOLD'
                        : c.state === 'CNC_STOPPED' || c.state === 'CNC_INTERRUPTED' ? 'READY_IDLE'
                            : 'UNKNOWN';
    const headline = cncHead ? cncHead : availability === 'DOWN' ? 'DOWN' : availability === 'MAINTENANCE' ? 'MAINTENANCE' : availability === 'HOLD' ? 'HOLD'
        : availability === 'UNKNOWN' ? 'UNKNOWN' : workOrderActivity === 'ACTIVE' ? 'ACTIVE_WORK_ORDER' : workOrderActivity === 'FIRST_PIECE' ? 'FIRST_PIECE' : 'READY_IDLE';
    const openSession = i.active.some((a) => a.runStatus === 'IN_PROGRESS' || a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED');
    const declaredVsCnc = t ? (t.running === (workOrderActivity === 'ACTIVE') ? 'AGREE' : 'CONFLICT') : 'N/A';
    const dataSource = c && !cncUp ? 'STALE' : t ? 'CNC_CONNECTED' : availability === 'UNKNOWN' ? 'UNKNOWN' : stale ? 'STALE' : 'OPERATOR_DECLARED';
    return { availability, workOrderActivity, physical, headline, dataSource, stale: stale && !cncHead, cnc: c ? { link: c.link, state: c.state } : null, cncRunning: cncUp && c.state === 'CNC_ACTIVE', declaredVsCnc, conflict: availability !== 'READY' && availability !== 'UNKNOWN' && openSession };
}
/** The ONE way a board machine (live_board row, optionally carrying its CNC row) becomes a state. Every screen calls this - none passes status/active by hand. */
export function machineStateOf(m) {
    return machineState({ status: m.status, active: m.active, cnc: m.cnc ?? null });
}
/** KMI-013: the ONE key every screen feeds to the spindle icon. A stale (silent/old) session is shown as STALE — never as running and never as plain idle. */
export function displayKey(s) { return s.stale ? 'STALE' : s.headline; }
export const STALE_TR = 'BAYAT OTURUM';
/** Label for the state line. Only a machine that really delivers a controller signal may say "Fiziksel CNC"; anything else (CMM, forklift, saw, a CNC without a connection) shows its recorded state under its own name — no fake CNC wording. */
export function physicalLabel(hasCnc) { return hasCnc ? 'Fiziksel CNC' : 'Kayıtlı durum'; }
/** spindle speed for people: whole rpm with Turkish thousands separator (5999.6154… → "6.000"). */
export function rpmTr(v) { return Math.round(v).toLocaleString('tr-TR', { useGrouping: true, maximumFractionDigits: 0 }).replace(/^(\d)(\d{3})$/, '$1.$2'); }
