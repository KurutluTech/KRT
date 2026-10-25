// KMI-HOME-001 — factory map model (pure). Built ONLY from the machine registry + canonical live board facts. It is a SCHEMATIC (grouped tiles), never a floor plan:
// the repository holds no coordinates, so none are invented. READY is not RUNNING: a machine is shown as active only when a work order is IN_PROGRESS on it, and even then the
// physical spindle state is stated as UNKNOWN (no CNC connection). Missing status is UNKNOWN, never "ready".
import { machineStateOf } from './machineState.js';
const CLASS_LABEL = { MACHINING: 'CNC / talaşlı imalat', MEASUREMENT: 'Ölçüm / metroloji', MATERIAL_HANDLING: 'Malzeme taşıma', AUXILIARY: 'Yardımcı', UNCLASSIFIED: 'Sınıf belirtilmemiş' };
const ORDER = ['MACHINING', 'MEASUREMENT', 'MATERIAL_HANDLING', 'AUXILIARY', 'UNCLASSIFIED'];
const EMPTY = () => ({ DOWN: 0, MAINTENANCE: 0, HOLD: 0, ACTIVE_WORK_ORDER: 0, FIRST_PIECE: 0, READY_IDLE: 0, READY_UNKNOWN: 0, UNKNOWN: 0, CNC_RUNNING: 0, CNC_FEED_HOLD: 0, CNC_ALARM: 0, CNC_STALE: 0 });
export function buildFactoryMap(machines, info) {
    const byCode = new Map(info.map((i) => [i.code, i]));
    const tiles = machines.map((m) => {
        const i = byCode.get(m.code);
        const st = machineStateOf(m);
        const act = m.active.find((a) => a.runStatus === 'IN_PROGRESS') ?? m.active[0];
        const k = i?.machineClass && CLASS_LABEL[i.machineClass] ? i.machineClass : 'UNCLASSIFIED';
        return { code: m.code, name: i?.name ?? null, id: i?.id ?? null, klass: k, headline: st.headline, state: st, since: m.since, activeWo: act?.wo ?? null, operator: act?.operator ?? null, productCode: act?.productCode ?? null, shiftGood: m.shiftGood, shiftScrap: m.shiftScrap, openHolds: m.openHolds, openMaintenance: m.openMaintenance };
    });
    const groups = ORDER.map((k) => { const t = tiles.filter((x) => x.klass === k).sort((a, b) => a.code.localeCompare(b.code, 'tr', { numeric: true })); const counts = EMPTY(); t.forEach((x) => { counts[x.headline] += 1; }); return { klass: k, label: CLASS_LABEL[k], tiles: t, counts }; }).filter((g) => g.tiles.length);
    const live = new Set(machines.map((m) => m.code));
    return { groups, total: tiles.length, missingFromRegistry: info.filter((i) => !live.has(i.code)).map((i) => i.code) };
}
/** Plan-vs-actual at WORK ORDER level only (the data that exists): produced/planned; planned unknown or 0 -> null (never a fake percentage). */
export function planVsActual(planned, produced) {
    if (typeof planned !== 'number' || !Number.isFinite(planned) || planned <= 0 || typeof produced !== 'number' || !Number.isFinite(produced) || produced < 0)
        return { pct: null, state: 'UNKNOWN' };
    return { pct: Math.round((produced / planned) * 100), state: 'KNOWN' };
}
/** Shift comparison rows grouped by day, both shifts side by side; a missing shift stays absent (UNKNOWN), never zero. */
export function shiftTable(rows) {
    const days = [...new Set(rows.map((r) => r.day))].sort().reverse();
    return days.map((d) => ({ day: d, shifts: Object.fromEntries(rows.filter((r) => r.day === d).map((r) => [r.shift, { good: r.good, scrap: r.scrap }])) }));
}
