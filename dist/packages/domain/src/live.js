// KMI NEXT — KMI LIVE / factory displays (matrix 45). Twin of migration 0045 (live_board_core).
// Honesty rules: machine states are entered by people (telemetry NOT_CONNECTED — never shown as a live
// signal); a machine without any state record has an UNKNOWN "since"; production is STALE when work is
// running but nothing was recorded for 8 hours; OEE carries its missing list. The PUBLIC profile (shop
// floor / kiosk) carries no personal names, no customer identity and no money.
export const LIVE_STALE_HOURS = 8;
export function productionFreshness(runningWork, lastEventIso, nowIso) {
    if (runningWork === 0)
        return 'NO_RUNNING_WORK';
    if (lastEventIso === null || Date.parse(lastEventIso) < Date.parse(nowIso) - LIVE_STALE_HOURS * 3600000)
        return 'STALE';
    return 'FRESH';
}
/** Open order line: due before today = LATE; within 2 days = DUE_SOON. */
export function liveOrderState(dueDate, today) {
    if (dueDate < today)
        return 'LATE';
    const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
    return dueDate <= soon ? 'DUE_SOON' : 'ON_TRACK';
}
/** Keys that must never appear in a PUBLIC board (personal / customer / money). */
const PUBLIC_FORBIDDEN = /"(operator|operatorName|customerPo|customer_po|customer|[a-zA-Z_]*(price|amount|cost|margin)[a-zA-Z_]*)"\s*:/;
export function publicBoardLeak(board) {
    const m = PUBLIC_FORBIDDEN.exec(JSON.stringify(board));
    return m ? m[1] : null;
}
export const MACHINE_STATUS_TR = { UP: 'HAZIR', DOWN: 'ARIZA', MAINTENANCE: 'BAKIMDA', HOLD: 'BEKLETMEDE' };
export const FRESHNESS_TR = {
    FRESH: 'Üretim kayıtları güncel',
    STALE: `GECİKMİŞ — çalışan iş var ama ${LIVE_STALE_HOURS} saattir kayıt yok`,
    NO_RUNNING_WORK: 'Şu an çalışan iş yok',
};
