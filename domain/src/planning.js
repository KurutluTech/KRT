// KMI NEXT — Production planning (Owner order #679 C).
//
// Sipariş → iş emri → (operasyon = iş emri; çok operasyonlu rota henüz modellenmedi) → makine →
// operatör → vardiya. Two strictly separate things:
//   * SUGGESTION (suggestPlan): pure, advisory, never written anywhere.
//   * DECISION  (commit_work_order_plan, WORK_ORDER_ASSIGN_MACHINE): the real assignment, made
//     by an authorized manager, re-checked on the server (canCommitPlan), logged append-only in
//     work_order_plan_decisions with whether the suggestion was followed.
//
// Shifts are ported from old KMI (read-only source: shift teams TeamK1 / TeamK2 / TeamOfis,
// 1. Vardiya 08:00, 2. Vardiya 16:00). One active production session per machine is enforced by
// the start gate AND a unique index (migration 0025).
// Mirrors supabase/migrations/0025_kmi_next_planning.sql.
import { MULTI_MACHINE_HARD_CAP } from './operatorAssignment.js';
export const SHIFTS = [
    { code: 'TeamK1', label: '1. Vardiya', start: '08:00', end: '16:00', minutes: 480, production: true },
    { code: 'TeamK2', label: '2. Vardiya', start: '16:00', end: '24:00', minutes: 480, production: true },
    { code: 'TeamOfis', label: 'Ofis / Destek', start: '08:00', end: '16:30', minutes: 510, production: false },
];
export const PLANNABLE_WORK_ORDER_STATUSES = ['PLANNED', 'MACHINE_ASSIGNED', 'ON_HOLD'];
export const ACTIVE_SESSION_STATUSES = ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED'];
export function shiftByCode(code) {
    return SHIFTS.find((s) => s.code === code);
}
export function canCommitPlan(i) {
    if (!PLANNABLE_WORK_ORDER_STATUSES.includes(i.workOrderStatus)) {
        return { ok: false, reason: `PLAN_NOT_ALLOWED_IN_STATUS:${i.workOrderStatus}` };
    }
    if (i.machineStatus === 'DOWN' || i.machineStatus === 'MAINTENANCE')
        return { ok: false, reason: `MACHINE_NOT_PLANNABLE:${i.machineStatus}` };
    const shift = shiftByCode(i.shiftCode);
    if (!shift)
        return { ok: false, reason: `UNKNOWN_SHIFT:${i.shiftCode}` };
    if (!shift.production)
        return { ok: false, reason: 'SHIFT_NOT_PRODUCTION' };
    if (i.plannedMinutes === null || !(i.plannedMinutes > 0))
        return { ok: false, reason: 'PLANNED_MINUTES_REQUIRED' };
    if (i.machineMinutesAlreadyPlanned + i.plannedMinutes > shift.minutes)
        return { ok: false, reason: 'CAPACITY_EXCEEDED' };
    if (i.operator) {
        const o = i.operator;
        if (!o.active)
            return { ok: false, reason: 'PERSON_INACTIVE' };
        if (!o.roles.includes('OPERATOR'))
            return { ok: false, reason: 'PERSON_NOT_OPERATOR' };
        if (o.shiftCode !== i.shiftCode)
            return { ok: false, reason: 'OPERATOR_NOT_IN_SHIFT' };
        if (o.qualificationRefusal)
            return { ok: false, reason: o.qualificationRefusal };
        const requested = new Set(o.otherMachinesSameSlot).size + 1;
        if (requested > 1) {
            if (requested > MULTI_MACHINE_HARD_CAP)
                return { ok: false, reason: 'HARD_CAP_EXCEEDED' };
            if (o.authorizedLevel < requested)
                return { ok: false, reason: 'MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT' };
        }
    }
    return { ok: true };
}
/** Warnings (not blockers for planning; the start gate enforces them at start time). */
export function planningWarnings(wo) {
    const w = [];
    for (const r of wo.readiness)
        if (r.state === 'UNKNOWN' || r.state === 'NOT_READY')
            w.push(r.reason ?? `${r.kind}_NOT_READY`);
    if (wo.openQualityHold)
        w.push('OPEN_QUALITY_HOLD');
    if (wo.openNcrQty > 0)
        w.push('OPEN_NCR');
    return w;
}
/**
 * Earliest production slot (dates in order, K1 before K2) on the work order's own machine if it
 * has one, otherwise on the UP/HOLD machine with the most free minutes in that slot; operator =
 * an active operator of that shift not yet planned on another machine in the slot (no
 * multi-machine suggestion — that stays a manager decision).
 */
export function suggestPlan(wo, machines, operators, dates) {
    const warnings = planningWarnings(wo);
    const none = (reason) => ({ workOrderId: wo.id, machineId: null, operatorId: null, date: null, shiftCode: null, warnings, reason });
    if (wo.plannedMinutes === null || !(wo.plannedMinutes > 0))
        return none('PLANNED_MINUTES_REQUIRED');
    const minutes = wo.plannedMinutes;
    const candidates = machines.filter((m) => (wo.currentMachineId ? m.id === wo.currentMachineId : true) && (m.status === 'UP' || m.status === 'HOLD'));
    if (candidates.length === 0)
        return none(wo.currentMachineId ? 'ASSIGNED_MACHINE_NOT_PLANNABLE' : 'NO_PLANNABLE_MACHINE');
    for (const date of dates) {
        for (const shift of SHIFTS.filter((s) => s.production)) {
            const key = `${date}|${shift.code}`;
            const fitting = candidates
                .map((m) => ({ m, free: shift.minutes - (m.plannedMinutes[key] ?? 0) }))
                .filter((x) => x.free >= minutes)
                .sort((a, b) => b.free - a.free || a.m.code.localeCompare(b.m.code));
            if (fitting.length === 0)
                continue;
            const machine = fitting[0].m;
            const op = operators
                .filter((o) => o.active && o.roles.includes('OPERATOR') && o.shiftCode === shift.code)
                .filter((o) => (o.plannedMachines[key] ?? []).every((id) => id === machine.id))
                .sort((a, b) => a.name.localeCompare(b.name, 'tr'))[0];
            return { workOrderId: wo.id, machineId: machine.id, operatorId: op?.id ?? null, date, shiftCode: shift.code, warnings: op ? warnings : [...warnings, 'NO_FREE_OPERATOR_IN_SHIFT'], reason: null };
        }
    }
    return none('NO_CAPACITY_IN_HORIZON');
}
/** One active production session per machine (start gate MACHINE_BUSY + unique index, 0025). */
export function canStartOnMachine(workOrderId, machineId, others) {
    const busy = others.some((o) => o.id !== workOrderId && o.machineId === machineId && ACTIVE_SESSION_STATUSES.includes(o.status));
    return busy ? { ok: false, reason: 'MACHINE_BUSY' } : { ok: true };
}
