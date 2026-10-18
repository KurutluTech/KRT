export const RISK_ORDER = { HIGH: 3, MEDIUM: 2, UNKNOWN: 1, LOW: 0 };
export const RISK_TR = { HIGH: 'YÜKSEK RİSK', MEDIUM: 'ORTA RİSK', UNKNOWN: 'VERİ EKSİK', LOW: 'Bilinen verilerle risk yok' };
export const slotKey = (machineId, date, shift) => `${machineId}|${date}|${shift}`;
export function indexSlots(slots) {
    return new Map(slots.map((s) => [slotKey(s.machineId, s.slotDate, s.shiftCode), s]));
}
export function addDays(iso, n) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
/** BLOCKED = the machine cannot take planned work (fault / maintenance) in a not-yet-past slot; OVER = more minutes than capacity (also when capacity is 0 and something is planned). */
export function slotState(s) {
    if (s.capacityMinutes === 0 && s.shiftMinutes > 0)
        return 'BLOCKED';
    if (s.plannedMinutes > s.capacityMinutes)
        return 'OVER';
    if (s.plannedMinutes === 0 && s.plannedWoCount === 0)
        return 'EMPTY';
    return s.plannedMinutes >= s.capacityMinutes * 0.9 ? 'FULL' : 'OK';
}
export function blockRisks(b, o) {
    const r = [];
    const add = (code, level, label) => r.push({ code, level, label });
    if (b.status === 'COMPLETED')
        return r;
    const open = b.status !== 'CANCELLED';
    if (open && b.dueDate && b.dueDate < o.today)
        add('OVERDUE', 'HIGH', `Termin geçti (${b.dueDate})`);
    if (open && !b.plannedDate) {
        if (!b.dueDate)
            add('UNPLANNED_NO_DUE', 'UNKNOWN', 'Planlanmadı; termin tarihi de yok');
        else {
            const left = daysBetween(o.today, b.dueDate);
            if (left <= 3 && left >= 0)
                add('UNPLANNED_DUE_SOON', 'HIGH', `Plan yok; termine ${left} gün kaldı`);
            else if (left > 3 && left <= 7)
                add('UNPLANNED_DUE_WEEK', 'MEDIUM', `Plan yok; termine ${left} gün kaldı`);
            else if (left > 7)
                add('UNPLANNED', 'LOW', 'Henüz planlanmadı');
        }
    }
    if (open && b.plannedDate && b.dueDate) {
        if (b.plannedDate > b.dueDate)
            add('PLANNED_AFTER_DUE', 'HIGH', `Planlanan gün (${b.plannedDate}) termini (${b.dueDate}) aşıyor`);
        else if (b.plannedDate === b.dueDate)
            add('PLANNED_ON_DUE', 'MEDIUM', 'Planlanan gün termin günü; pay yok');
    }
    if (open) {
        if (b.materialState === 'NOT_READY')
            add('MATERIAL_NOT_READY', 'HIGH', `Malzeme hazır değil${b.materialReason ? ` (${b.materialReason})` : ''}`);
        else if (b.materialState === 'UNKNOWN' || b.materialState === null)
            add('MATERIAL_UNKNOWN', 'UNKNOWN', 'Malzeme hazırlığı bilinmiyor');
        if (b.toolState === 'NOT_READY')
            add('TOOL_NOT_READY', 'HIGH', `Takım hazır değil${b.toolReason ? ` (${b.toolReason})` : ''}`);
        else if (b.toolState === 'UNKNOWN' || b.toolState === null)
            add('TOOL_UNKNOWN', 'UNKNOWN', 'Takım hazırlığı bilinmiyor');
        if (b.openQualityHold)
            add('QUALITY_HOLD', 'HIGH', 'Kalite bekletmesi açık');
        if (b.openNcrQty > 0)
            add('OPEN_NCR', 'MEDIUM', `Açık uygunsuzluk ${b.openNcrQty} adet`);
        if (b.status === 'ON_HOLD')
            add('WO_ON_HOLD', 'MEDIUM', 'İş emri beklemede');
        if (b.machineId && (b.machineStatus === 'DOWN' || b.machineStatus === 'MAINTENANCE'))
            add('MACHINE_UNPLANNABLE', 'HIGH', b.machineStatus === 'DOWN' ? 'Makine arızalı' : 'Makine bakımda');
        else if (b.machineId && b.machineStatus === 'HOLD')
            add('MACHINE_HOLD', 'MEDIUM', 'Makine beklemede');
        if (b.plannedDate && b.plannedMinutes === null)
            add('NO_PLANNED_MINUTES', 'UNKNOWN', 'Planlı süre girilmemiş');
        if (b.estSource === 'UNKNOWN')
            add('EST_UNKNOWN', 'UNKNOWN', 'Çevrim süresi tanımsız; süre tahmini yapılamaz');
        else if (b.estSource === 'CAM_CYCLE_NO_SETUP')
            add('EST_NO_SETUP', 'UNKNOWN', 'Kurulum süresi tanımsız; tahmin yalnız çevrim süresidir');
        if (b.estMinutes !== null && b.plannedMinutes !== null && b.estMinutes > b.plannedMinutes * 1.1)
            add('EST_EXCEEDS_PLAN', 'MEDIUM', `Tahmini süre (${b.estMinutes} dk) planlı süreyi (${b.plannedMinutes} dk) aşıyor`);
        if (b.plannedDate && o.canSeeOperators !== false && !b.operatorId)
            add('NO_OPERATOR', 'MEDIUM', 'Operatör atanmamış');
        if (o.slot && (slotState(o.slot) === 'OVER' || slotState(o.slot) === 'BLOCKED') && b.plannedDate)
            add('SLOT_OVER', 'HIGH', slotState(o.slot) === 'BLOCKED' ? 'Vardiya kapasitesi yok (makine kullanılamıyor)' : 'Vardiya kapasitesi aşılıyor');
    }
    return r.sort((a, c) => RISK_ORDER[c.level] - RISK_ORDER[a.level]);
}
export function riskLevel(items) {
    return items.reduce((m, i) => (RISK_ORDER[i.level] > RISK_ORDER[m] ? i.level : m), 'LOW');
}
/** the single most important reason, for "gecikme nedeni" (null = nothing known) */
export function delayReason(items) {
    const top = items.find((i) => i.level === 'HIGH') ?? items.find((i) => i.level === 'MEDIUM') ?? items.find((i) => i.level === 'UNKNOWN');
    return top ? top.label : null;
}
/** constraints that block starting this work order right now (material / tool / quality / machine) — what the detail panel lists as "kısıt" */
export function constraintsOf(items) {
    return items.filter((i) => ['MATERIAL_NOT_READY', 'MATERIAL_UNKNOWN', 'TOOL_NOT_READY', 'TOOL_UNKNOWN', 'QUALITY_HOLD', 'OPEN_NCR', 'WO_ON_HOLD', 'MACHINE_UNPLANNABLE', 'MACHINE_HOLD'].includes(i.code));
}
/** per machine over the window. utilization is null when there is no capacity at all (never a fake 0 or 100). */
export function machineLoads(slots) {
    const by = new Map();
    for (const s of slots)
        (by.get(s.machineId) ?? by.set(s.machineId, []).get(s.machineId)).push(s);
    const out = [];
    for (const [machineId, list] of by) {
        const planned = list.reduce((a, s) => a + s.plannedMinutes, 0);
        const capacity = list.reduce((a, s) => a + s.capacityMinutes, 0);
        const over = list.filter((s) => slotState(s) === 'OVER').length;
        const blocked = list.filter((s) => slotState(s) === 'BLOCKED').length;
        const unknown = list.reduce((a, s) => a + s.unknownMinutesWoCount, 0);
        const utilization = capacity > 0 ? planned / capacity : null;
        const bottleneck = over > 0 || (utilization !== null && utilization >= 0.85) || (blocked > 0 && planned > 0);
        const reason = over > 0 ? `${over} vardiyada kapasite aşımı` : blocked > 0 && planned > 0 ? 'Makine kullanılamıyor ama plan var' : utilization !== null && utilization >= 0.85 ? `Yük %${Math.round(utilization * 100)}` : '';
        out.push({ machineId, code: list[0].machineCode, status: list[0].machineStatus, planned, capacity, utilization, overSlots: over, blockedSlots: blocked, unknownSlots: unknown, bottleneck, reason });
    }
    return out.sort((a, b) => Number(b.bottleneck) - Number(a.bottleneck) || (b.utilization ?? -1) - (a.utilization ?? -1) || a.code.localeCompare(b.code));
}
export function shiftSummaries(slots, ops, dates, shifts) {
    return shifts.map((sh) => {
        const sl = slots.filter((s) => s.shiftCode === sh && dates.includes(s.slotDate));
        const planned = sl.reduce((a, s) => a + s.plannedMinutes, 0);
        const capacity = sl.reduce((a, s) => a + s.capacityMinutes, 0);
        const own = new Set(ops.filter((o) => o.shiftCode === sh && o.slotDate === dates[0]).map((o) => o.personnelId));
        const planning = new Set(ops.filter((o) => o.slotShift === sh && o.machinesPlanned > 0 && o.slotDate !== null && dates.includes(o.slotDate)).map((o) => o.personnelId));
        return { shiftCode: sh, planned, capacity, utilization: capacity > 0 ? planned / capacity : null, operatorsAssigned: own.size, operatorsPlannedOnMachines: planning.size };
    });
}
/** operators whose shift is undefined => their availability is UNKNOWN and must be shown as such */
export const operatorsWithoutShift = (ops) => ops.filter((o) => o.shiftCode === null && o.slotDate === null);
/** an operator planned on more machines than authorized, or outside his own shift */
export function operatorConflicts(ops) {
    const out = [];
    for (const o of ops) {
        if (o.slotDate === null || o.slotShift === null)
            continue;
        if (o.machinesPlanned > o.maxMachines)
            out.push({ personnelId: o.personnelId, name: o.name, slotDate: o.slotDate, slotShift: o.slotShift, reason: `${o.machinesPlanned} makineye planlı; yetki ${o.maxMachines}` });
        if (!o.isOwnShift && o.machinesPlanned > 0)
            out.push({ personnelId: o.personnelId, name: o.name, slotDate: o.slotDate, slotShift: o.slotShift, reason: 'Kendi vardiyası dışında planlı' });
    }
    return out;
}
/** planned minutes vs machine run minutes (oee_slots). A future slot or a slot with no run data is never shown as a 0-minute actual. */
export function planVsActual(s, today) {
    if (s.slotDate > today)
        return { state: 'FUTURE', planned: s.plannedMinutes, run: null, diff: null };
    if (s.plannedMinutes === 0 && s.plannedWoCount === 0)
        return { state: 'NO_PLAN', planned: 0, run: s.runMinutes, diff: null };
    if (s.runMinutes === null)
        return { state: 'NO_ACTUAL_DATA', planned: s.plannedMinutes, run: null, diff: null };
    return { state: 'MEASURED', planned: s.plannedMinutes, run: s.runMinutes, diff: Math.round((s.runMinutes - s.plannedMinutes) * 10) / 10 };
}
/** quantity gap of a work order: produced vs planned (always defined by the canonical counters) */
export const qtyGap = (b) => b.qtyProduced - b.qtyPlanned;
/** the decision box: what needs a human decision now, strongest first, deduplicated */
export function decisionsFor(blocks, slots, loads, today) {
    const idx = indexSlots(slots);
    const out = [];
    for (const b of blocks) {
        const slot = b.machineId && b.plannedDate && b.plannedShiftCode ? idx.get(slotKey(b.machineId, b.plannedDate, b.plannedShiftCode)) ?? null : null;
        const items = blockRisks(b, { today, slot });
        const pick = items.find((i) => ['OVERDUE', 'UNPLANNED_DUE_SOON', 'PLANNED_AFTER_DUE', 'MACHINE_UNPLANNABLE', 'SLOT_OVER', 'QUALITY_HOLD', 'MATERIAL_NOT_READY', 'TOOL_NOT_READY'].includes(i.code));
        if (pick)
            out.push({ code: pick.code, level: pick.level, title: `${b.productCode ?? 'İş emri'} · ${pick.label}`, workOrderId: b.workOrderId, machineId: b.machineId });
    }
    for (const m of loads.filter((l) => l.bottleneck))
        out.push({ code: 'BOTTLENECK', level: m.overSlots > 0 || m.blockedSlots > 0 ? 'HIGH' : 'MEDIUM', title: `${m.code} darboğaz: ${m.reason}`, workOrderId: null, machineId: m.machineId });
    return out.sort((a, c) => RISK_ORDER[c.level] - RISK_ORDER[a.level]);
}
