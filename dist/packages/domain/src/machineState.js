export const MACHINE_CLASS_TR = { MACHINING: 'CNC / talaşlı imalat', MEASUREMENT: 'Ölçüm / metroloji', MATERIAL_HANDLING: 'Malzeme taşıma', AUXILIARY: 'Yardımcı ekipman' };
export const MACHINE_CLASS_UNKNOWN_TR = 'Sınıf belirtilmemiş';
export const DATA_SOURCE_TR = { OPERATOR_DECLARED: 'Operatör beyanı', CNC_CONNECTED: 'CNC bağlantısı (doğrulanmış)', UNKNOWN: 'Bilinmiyor', STALE: 'Bayat — güncel veri yok' };
/** KMI-013 spindle colour language: GREEN running · BLUE idle · RED fault · ORANGE maintenance. HOLD/FIRST_PIECE/STALE/UNKNOWN stay separate (never forced into the four). */
export const SPINDLE_COLOUR_TR = { ACTIVE_WORK_ORDER: 'YEŞİL', READY_IDLE: 'MAVİ', DOWN: 'KIRMIZI', MAINTENANCE: 'TURUNCU' };
export const HEADLINE_TR = {
    DOWN: 'ARIZA', MAINTENANCE: 'BAKIMDA', HOLD: 'BEKLETMEDE', ACTIVE_WORK_ORDER: 'AKTİF İŞ EMRİ', FIRST_PIECE: 'İLK PARÇA', READY_IDLE: 'HAZIR · BOŞTA', UNKNOWN: 'BİLİNMİYOR',
};
export const AVAILABILITY_TR = { READY: 'Kullanıma hazır', DOWN: 'Arızalı', MAINTENANCE: 'Bakımda', HOLD: 'Bekletmede', UNKNOWN: 'Bilinmiyor' };
export const PHYSICAL_TR = 'Fiziksel çalışma: BİLİNMİYOR (CNC bağlantısı yok)';
export function machineState(i) {
    const availability = i.status === 'UP' ? 'READY' : i.status === 'DOWN' ? 'DOWN' : i.status === 'MAINTENANCE' ? 'MAINTENANCE' : i.status === 'HOLD' ? 'HOLD' : 'UNKNOWN';
    const live = i.active.filter((a) => !a.stale); // a silent/old session never counts as running
    const workOrderActivity = live.some((a) => a.runStatus === 'IN_PROGRESS') ? 'ACTIVE'
        : live.some((a) => a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED') ? 'FIRST_PIECE' : 'NONE';
    const stale = availability === 'READY' && live.length === 0 && i.active.some((a) => !!a.stale && (a.runStatus === 'IN_PROGRESS' || a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED'));
    const t = i.telemetry && i.telemetry.running !== null && i.telemetry.running !== undefined ? i.telemetry : null;
    const physical = t ? (t.running ? 'RUNNING' : 'STOPPED') : 'UNKNOWN';
    const headline = availability === 'DOWN' ? 'DOWN' : availability === 'MAINTENANCE' ? 'MAINTENANCE' : availability === 'HOLD' ? 'HOLD'
        : availability === 'UNKNOWN' ? 'UNKNOWN' : workOrderActivity === 'ACTIVE' ? 'ACTIVE_WORK_ORDER' : workOrderActivity === 'FIRST_PIECE' ? 'FIRST_PIECE' : 'READY_IDLE';
    const openSession = i.active.some((a) => a.runStatus === 'IN_PROGRESS' || a.runStatus === 'FIRST_PIECE_PENDING' || a.runStatus === 'FIRST_PIECE_APPROVED');
    const declaredVsCnc = t ? (t.running === (workOrderActivity === 'ACTIVE') ? 'AGREE' : 'CONFLICT') : 'N/A';
    const dataSource = t ? 'CNC_CONNECTED' : availability === 'UNKNOWN' ? 'UNKNOWN' : stale ? 'STALE' : 'OPERATOR_DECLARED';
    return { availability, workOrderActivity, physical, headline, dataSource, stale, declaredVsCnc, conflict: availability !== 'READY' && availability !== 'UNKNOWN' && openSession };
}
/** KMI-013: the ONE key every screen feeds to the spindle icon. A stale (silent/old) session is shown as STALE — never as running and never as plain idle. */
export function displayKey(s) { return s.stale ? 'STALE' : s.headline; }
export const STALE_TR = 'BAYAT OTURUM';
