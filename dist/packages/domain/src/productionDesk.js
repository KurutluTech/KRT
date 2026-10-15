export const GROUP_TR = { STOPPED: 'Arıza / bakımda', HOLD: 'Beklemede (duruş)', FIRST_PIECE: 'İlk parça kararı bekliyor', RUNNING: 'Üretimde', READY: 'İş bekliyor (başlatılabilir)', IDLE: 'Boşta', UNKNOWN: 'Durum okunamadı' };
const RANK = { STOPPED: 0, HOLD: 1, FIRST_PIECE: 2, UNKNOWN: 3, RUNNING: 4, READY: 5, IDLE: 6 };
export function groupOf(m) {
    if (m.error || m.label === null)
        return 'UNKNOWN';
    if (m.label === 'ARIZA' || m.label === 'BAKIM')
        return 'STOPPED';
    if (m.label === 'BEKLEME')
        return 'HOLD';
    if (m.active?.status === 'FIRST_PIECE_PENDING')
        return 'FIRST_PIECE';
    if (m.active)
        return 'RUNNING';
    if (m.queue.some((w) => !w.startRefusal))
        return 'READY';
    return 'IDLE';
}
const TONE = { STOPPED: 'red', HOLD: 'amber', FIRST_PIECE: 'amber', RUNNING: 'green', READY: 'blue', IDLE: 'gray', UNKNOWN: 'gray' };
export function buildProductionDesk(ms) {
    const cards = ms.map((m) => { const g = groupOf(m); return { ...m, group: g, tone: TONE[g], pct: m.active && m.active.qtyPlanned > 0 ? Math.min(100, Math.round((m.active.qtyProduced / m.active.qtyPlanned) * 100)) : null, startable: m.active ? null : m.queue.find((w) => !w.startRefusal) ?? null }; })
        .sort((a, b) => RANK[a.group] - RANK[b.group] || a.code.localeCompare(b.code, 'tr'));
    const counts = { STOPPED: 0, HOLD: 0, FIRST_PIECE: 0, RUNNING: 0, READY: 0, IDLE: 0, UNKNOWN: 0 };
    for (const c of cards)
        counts[c.group]++;
    const act = cards.filter((c) => c.active);
    const good = act.reduce((s, c) => s + c.active.qtyProduced, 0), scrap = act.reduce((s, c) => s + c.active.qtyScrap, 0);
    return { cards, counts, waitingForQuality: counts.FIRST_PIECE, totalGood: good, totalScrap: scrap, scrapPct: good + scrap > 0 ? Math.round((scrap / (good + scrap)) * 1000) / 10 : null };
}
export const HOLD_CATEGORIES = [['SETUP', 'Ayar / hazırlık'], ['TOOL', 'Takım bekleme'], ['MATERIAL_WAIT', 'Malzeme bekleme'], ['QUALITY_WAIT', 'Kalite bekleme'], ['OPERATOR_CAUSED', 'Operatör kaynaklı'], ['PLANNED_STOP', 'Planlı duruş'], ['OTHER', 'Diğer']];
