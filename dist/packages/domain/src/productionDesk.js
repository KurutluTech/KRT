// KMI Production Desk — the supervisor's multi-machine view: for every machine its canonical eligibility (maintenance / hold), the active work order and the queue,
// built from the SAME rows the operator terminal reads (operator_terminal / machine_eligibility). Nothing here is a second state machine.
import { machineStateOf } from './machineState.js';
import { cncDisplay, cncNotes } from './cncTelemetry.js';
export const GROUP_TR = { STOPPED: 'Arıza / bakımda', HOLD: 'Beklemede (duruş)', FIRST_PIECE: 'İlk parça kararı bekliyor', RUNNING: 'Üretimde', READY: 'İş bekliyor (başlatılabilir)', IDLE: 'Aktif iş emri yok', UNKNOWN: 'Durum okunamadı' };
const RANK = { STOPPED: 0, HOLD: 1, FIRST_PIECE: 2, UNKNOWN: 3, RUNNING: 4, READY: 5, IDLE: 6 };
export const FILTER_TR = { ALL: 'Tüm makineler', CNC_RUN: 'Çalışan CNC\'ler', CNC_STOP: 'Durmuş CNC\'ler', ALARM_HOLD: 'Alarm / HOLD', NO_WO: 'Aktif iş emri olmayanlar', ATTN: 'Müdahale gerekenler', DATA: 'Bağlantı / veri sorunu' };
export const DESK_FILTERS = ['ALL', 'CNC_RUN', 'CNC_STOP', 'ALARM_HOLD', 'NO_WO', 'ATTN', 'DATA'];
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
function deriveStatus(m) {
    if (m.status !== undefined)
        return m.status;
    return m.label === 'ARIZA' ? 'DOWN' : m.label === 'BAKIM' ? 'MAINTENANCE' : m.label === 'BEKLEME' ? 'HOLD' : m.label === null ? null : 'UP';
}
const ACTIVE_OP = new Set(['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED', 'RUNNING']);
function cardOf(m, today) {
    const g = groupOf(m);
    const routed = (m.routed ?? []).filter((o) => !!o.status && ACTIVE_OP.has(o.status));
    const activeRows = [...(m.active ? [{ runStatus: m.active.status }] : []), ...routed.map((o) => ({ runStatus: o.status === 'RUNNING' ? 'IN_PROGRESS' : String(o.status), stale: o.stale }))];
    const row = m.cnc ?? null;
    const ms = machineStateOf({ status: deriveStatus(m), active: activeRows, cnc: row ? { link: String(row.link), state: String(row.state), lastSourceTs: row.lastSourceTs ?? null, ageS: row.ageS ?? null, estop: row.estop ?? null } : null });
    const cd = row ? cncDisplay(row) : null;
    const hasCnc = !!row;
    const woPresent = !!m.active || routed.length > 0;
    const alerts = [];
    if (m.error)
        alerts.push({ key: 'ERR', text: 'Makine durumu okunamadı: ' + m.error, sev: 'amber' });
    if (cd) {
        if (ms.availability === 'READY' && cd.link === 'UP' && cd.state === 'CNC_ACTIVE' && !woPresent)
            alerts.push({ key: 'CNC_NO_WO', text: 'CNC çalışıyor, aktif iş emri kaydı bulunmuyor.', sev: 'red' });
        else {
            for (const n of cncNotes(ms, cd)) {
                if (ms.availability === 'READY' && /aktif iş emri kaydı yok/.test(n))
                    continue;
                alerts.push({ key: 'NOTE', text: n, sev: n.startsWith('CNC alarm') ? 'red' : 'amber' });
            }
        }
        if (cd.link !== 'UP')
            alerts.push({ key: 'STALE', text: cd.staleWarning ?? 'CNC verisi güncel değil — son bilinen durum gösterilmez.', sev: 'amber' });
    }
    if (ms.stale)
        alerts.push({ key: 'SESSION_STALE', text: 'Açık üretim oturumu eski/sessiz — çalışıyor sayılmaz.', sev: 'amber' });
    if (m.active?.openQualityHold)
        alerts.push({ key: 'QHOLD', text: 'Kalite HOLD açık — üretim serbest bırakılamaz.', sev: 'red' });
    if (g === 'STOPPED')
        alerts.push({ key: 'MAINT', text: (m.label === 'ARIZA' ? 'Makine arızada' : 'Makine bakımda') + (m.reason ? ': ' + m.reason : '') + ' — üretim başlatılamaz.', sev: 'red' });
    else if (g === 'HOLD')
        alerts.push({ key: 'HOLDREC', text: 'Makine bekletmede' + (m.reason ? ': ' + m.reason : '') + '.', sev: 'amber' });
    if (g === 'FIRST_PIECE')
        alerts.push({ key: 'FP', text: 'İlk parça kararı bekleniyor.', sev: 'amber' });
    if (today && m.active?.plannedDate && m.active.plannedDate.slice(0, 10) < today && m.active.qtyProduced < m.active.qtyPlanned)
        alerts.push({ key: 'LATE', text: 'Planlanan tarih geçti, iş emri tamamlanmadı.', sev: 'amber' });
    const a = m.active;
    const r0 = routed[0] ?? null;
    const planned = a ? a.qtyPlanned : r0 ? r0.qtyIn : null;
    const good = a ? a.qtyProduced : r0 ? r0.qtyGood : null;
    const scrap = a ? a.qtyScrap : r0 ? r0.qtyScrap : null;
    const tashih = r0 ? r0.qtyTashih : null;
    const remaining = planned !== null && good !== null ? Math.max(0, planned - good) : null;
    const pct = planned && planned > 0 && good !== null ? Math.min(100, Math.round((good / planned) * 100)) : null;
    const production = { woId: a?.workOrderId ?? r0?.workOrderId ?? null, opLabel: r0 ? `Op ${r0.opNo} · ${r0.name}` : null, productCode: a?.productCode ?? r0?.productCode ?? null, operator: a?.operatorName ?? r0?.operatorName ?? null, shift: m.shift ?? null, planned, good, scrap, tashih, remaining, pct, hasWo: woPresent };
    const sourceTr = m.cncDenied && !hasCnc ? 'CNC verisi: yetki yok' : !hasCnc ? 'CNC verisi yok · operatör beyanı' : cd.link === 'UP' ? 'CNC bağlantısı (doğrulanmış)' : 'CNC verisi bayat / bağlantı yok';
    const attention = alerts.some((x) => x.sev === 'red' || x.sev === 'amber') || g === 'STOPPED' || g === 'FIRST_PIECE';
    const filters = ['ALL'];
    if (ms.cncRunning)
        filters.push('CNC_RUN');
    if (cd && cd.link === 'UP' && (cd.state === 'CNC_STOPPED' || cd.state === 'CNC_INTERRUPTED'))
        filters.push('CNC_STOP');
    if ((cd && cd.link === 'UP' && (cd.state === 'CNC_ALARM' || cd.state === 'CNC_FEED_HOLD')) || g === 'HOLD' || ms.availability === 'HOLD')
        filters.push('ALARM_HOLD');
    if (!woPresent)
        filters.push('NO_WO');
    if (attention)
        filters.push('ATTN');
    if ((hasCnc && cd.link !== 'UP') || ms.stale || g === 'UNKNOWN')
        filters.push('DATA');
    return { ...m, group: g, tone: TONE[g], pct: m.active && m.active.qtyPlanned > 0 ? Math.min(100, Math.round((m.active.qtyProduced / m.active.qtyPlanned) * 100)) : null, startable: m.active ? null : m.queue.find((w) => !w.startRefusal) ?? null, ms, cd, hasCnc, sourceTr, alerts, attention, production, filters };
}
export function buildProductionDesk(ms, todayIso) {
    const today = todayIso ? todayIso.slice(0, 10) : null;
    const cards = ms.map((m) => cardOf(m, today))
        .sort((a, b) => RANK[a.group] - RANK[b.group] || a.code.localeCompare(b.code, 'tr'));
    const counts = { STOPPED: 0, HOLD: 0, FIRST_PIECE: 0, RUNNING: 0, READY: 0, IDLE: 0, UNKNOWN: 0 };
    for (const c of cards)
        counts[c.group]++;
    const filterCounts = Object.fromEntries(DESK_FILTERS.map((f) => [f, cards.filter((c) => c.filters.includes(f)).length]));
    const act = cards.filter((c) => c.active);
    const good = act.reduce((s, c) => s + c.active.qtyProduced, 0), scrap = act.reduce((s, c) => s + c.active.qtyScrap, 0);
    return { cards, counts, filterCounts, waitingForQuality: counts.FIRST_PIECE, totalGood: good, totalScrap: scrap, scrapPct: good + scrap > 0 ? Math.round((scrap / (good + scrap)) * 1000) / 10 : null };
}
export const HOLD_CATEGORIES = [['SETUP', 'Ayar / hazırlık'], ['TOOL', 'Takım bekleme'], ['MATERIAL_WAIT', 'Malzeme bekleme'], ['QUALITY_WAIT', 'Kalite bekleme'], ['OPERATOR_CAUSED', 'Operatör kaynaklı'], ['PLANNED_STOP', 'Planlı duruş'], ['OTHER', 'Diğer']];
