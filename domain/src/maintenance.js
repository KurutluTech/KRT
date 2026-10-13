// KMI NEXT — Maintenance (owner talimatı 2026-10-10, Öncelik 1): machine health, downtime,
// maintenance ticket lifecycle, and production eligibility, all sharing ONE canonical model.
//
// Ground truth for the status enum and the "one shared return-to-service exit point" design
// was taken, READ-ONLY, from the real old-KMI system (`/home/claude/kmi/src/index.html`,
// `toggleDown`/`setMachineCondition`/`setMaintenance`/`setHold`, lines ~6982-7025) — old KMI
// itself was never modified. The real status enum there is exactly
// `'UP' | 'DOWN' | 'MAINTENANCE' | 'HOLD'` (there is no separate 'RUNNING' value, and "TEST" is
// an orthogonal active-session concept handled by `MaintenanceTicket.status`, not a 5th machine
// status). This module is the canonical source every other KMI NEXT module (work-order machine
// assignment, OEE, puantaj's maintenance24hMultiplier) must consult — never a second copy.
/** The 14 real machine identities (read-only port of old KMI's `MACHINES_LIST`). Preserved
 * exactly per owner directive §1 ("Mevcut 14 makine kimliğini koru"). */
export const CANONICAL_MACHINE_SEED = [
    { code: '101', name: 'Kesmak 280 Şerit Testere', category: null },
    { code: '102', name: 'HAAS ST 10 Y', category: null },
    { code: '103', name: 'DMG MORI SEIKI NHX 5000', category: null },
    { code: '107', name: "HAAS VF' SE 4 Eksen Divizörlü", category: null },
    { code: '108', name: "HAAS VF' SE 4 Eksen Divizörlü", category: null },
    { code: '109', name: "HAAS VF' SE 4 Eksen Divizörlü", category: null },
    { code: '110', name: "HAAS VF' SE 4 Eksen Divizörlü", category: null },
    { code: '111', name: 'DMU 60 P', category: null },
    { code: '112', name: 'HAAS SL 30', category: null },
    { code: '113', name: 'DMU 60 P', category: null },
    { code: 'CMM', name: 'Hexagon 5 eksen CMM', category: null },
    { code: 'OPT', name: 'In size ISD-V Manuel Video Optik', category: null },
    { code: 'VIBROMAK', name: 'Vibromak Vibrasyon Makinesi', category: 'Kalite' },
    { code: 'FORKLIFT', name: 'Hyundai 15BT-7 AC Forklift (1.5 Ton Elektrikli)', category: 'Sevkiyat' },
];
/**
 * A machine is eligible for production assignment ONLY when UP. This is the single function
 * the work-order machine-assignment path (workOrder.ts's canAssignMachine, and the
 * assign_work_order_machine RPC) must consult so a DOWN/MAINTENANCE/HOLD machine can never be
 * assigned — directly implementing owner directive §1: "DOWN/BAKIM durumundaki makinenin
 * üretime atanmasını engelle."
 */
export function canAssignMachineForProduction(status) {
    if (status !== 'UP') {
        return { ok: false, reason: `MACHINE_NOT_PRODUCTION_ELIGIBLE:${status}` };
    }
    return { ok: true };
}
/**
 * Old KMI's `toggleDown`: from UP, setting DOWN requires a reason and is role-gated
 * (role gating lives in authorization.ts's MAINTENANCE_TEST_RELEASE / critical-action layer at
 * the RPC level — this function is the pure state-shape check only).
 */
export function canSetMachineDown(status, reason) {
    // Owner order #679 P0-B: a fault can also be found on a machine that is in normal BEKLEME.
    if (status !== 'UP' && status !== 'HOLD') {
        return { ok: false, reason: `NO_OP_OR_ILLEGAL:${status}->DOWN` };
    }
    if (!reason || reason.trim().length === 0) {
        return { ok: false, reason: 'REASON_REQUIRED' };
    }
    return { ok: true };
}
/**
 * Entering MAINTENANCE (BAKIM) or HOLD (BEKLEME).
 *
 * Owner order #679 P0-B separates the two on purpose (diverging from old KMI's single exit):
 *  - MAINTENANCE opens a ticket and may be entered from any other state; leaving it needs the
 *    authorized test (return_machine_to_service).
 *  - HOLD is normal waiting (no fault). It opens NO ticket, may only be entered from UP, and
 *    returns to production WITHOUT a maintenance test (resume_machine_from_hold). "Only from UP"
 *    is what keeps DOWN/MAINTENANCE -> HOLD -> UP from bypassing the test.
 */
export function canEnterMachineCondition(status, target, reason) {
    if (status === target) {
        return { ok: false, reason: `NO_OP_TRANSITION:${status}` };
    }
    if (target === 'HOLD' && status !== 'UP') {
        return { ok: false, reason: `HOLD_ONLY_FROM_UP:${status}` };
    }
    if (!reason || reason.trim().length === 0) {
        return { ok: false, reason: 'REASON_REQUIRED' };
    }
    return { ok: true };
}
/** BEKLEME -> UP: no maintenance test, but never while a maintenance/fault ticket is open. */
export function canResumeFromHold(status, openTicketCount, reason) {
    if (status !== 'HOLD')
        return { ok: false, reason: `NOT_ON_HOLD:${status}` };
    if (openTicketCount > 0)
        return { ok: false, reason: 'MAINTENANCE_TEST_REQUIRED' };
    if (!reason || reason.trim().length === 0)
        return { ok: false, reason: 'REASON_REQUIRED' };
    return { ok: true };
}
/** THE canonical machine eligibility (mirrors kmi_next.machine_eligibility(), migration 0022). */
export function machineEligibility(status, openTicketCount) {
    if (status === 'UP')
        return { eligible: true, label: 'ÜRETİME UYGUN', returnPath: 'NONE', reason: null };
    if (status === 'HOLD') {
        return openTicketCount > 0
            ? { eligible: false, label: 'BEKLEME', returnPath: 'AUTHORIZED_TEST_REQUIRED', reason: 'MAINTENANCE_TEST_REQUIRED' }
            : { eligible: false, label: 'BEKLEME', returnPath: 'RESUME_FROM_HOLD', reason: 'MACHINE_ON_HOLD' };
    }
    return {
        eligible: false,
        label: status === 'DOWN' ? 'ARIZA' : 'BAKIM',
        returnPath: 'AUTHORIZED_TEST_REQUIRED',
        reason: status === 'DOWN' ? 'MACHINE_DOWN' : 'MACHINE_IN_MAINTENANCE',
    };
}
/**
 * Authorized return to service (MAINTENANCE_TEST_RELEASE) for DOWN and MAINTENANCE. A machine
 * in plain HOLD (no open ticket) does not go through here — it resumes via canResumeFromHold;
 * the RPC returns USE_RESUME_FROM_HOLD in that case (decided with the ticket count).
 */
export function canReturnMachineToService(status, reason) {
    if (status === 'UP') {
        return { ok: false, reason: 'ALREADY_UP' };
    }
    if (!reason || reason.trim().length === 0) {
        return { ok: false, reason: 'REASON_REQUIRED' };
    }
    return { ok: true };
}
/** DOWN-specific downtime KPI: old KMI increments totalDownMinutes only on exit from a literal
 * DOWN state (MAINTENANCE/HOLD time does NOT count toward this KPI — a deliberate old-KMI
 * design choice per its own code comments, faithfully preserved, not an oversight here). */
export function computeDownMinutesDelta(fromStatus, downSince, nowIso) {
    if (fromStatus !== 'DOWN' || !downSince)
        return 0;
    const deltaMs = new Date(nowIso).getTime() - new Date(downSince).getTime();
    return Math.max(0, Math.round(deltaMs / 60000));
}
// Migration 0017: a ticket can no longer be CLOSED straight from OPEN/IN_PROGRESS — every
// fault/maintenance period must pass an authorized test before the machine runs again.
const TICKET_TRANSITIONS = {
    OPEN: ['IN_PROGRESS'],
    IN_PROGRESS: ['TEST_PENDING'],
    TEST_PENDING: ['RETURNED_TO_SERVICE', 'IN_PROGRESS'],
    RETURNED_TO_SERVICE: ['CLOSED'],
    CLOSED: [],
};
export function canTransitionMaintenanceTicket(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    if (!TICKET_TRANSITIONS[from].includes(to)) {
        return { ok: false, reason: `ILLEGAL_TICKET_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/** The authorized-test / return-to-service step (MAINTENANCE_TEST_RELEASE critical action) may
 * only be recorded once a ticket has actually reached TEST_PENDING — you cannot "authorize a
 * test" on a ticket nobody has worked yet. */
export function canAuthorizeMaintenanceTestRelease(ticketStatus) {
    if (ticketStatus !== 'TEST_PENDING') {
        return { ok: false, reason: `TEST_RELEASE_REQUIRES_TEST_PENDING:${ticketStatus}` };
    }
    return { ok: true };
}
/** Machine health score, 0-100 — old KMI's `health(m)` ported: -20 flat if DOWN, -12/open
 * CRITICAL ticket, -7/open HIGH ticket (faithful port of the real scoring, not a reinvention). */
export function computeMachineHealthScore(status, openTickets) {
    let score = 100;
    if (status === 'DOWN')
        score -= 20;
    for (const ticket of openTickets) {
        if (ticket.status === 'CLOSED' || ticket.status === 'RETURNED_TO_SERVICE')
            continue;
        if (ticket.severity === 'CRITICAL')
            score -= 12;
        else if (ticket.severity === 'HIGH')
            score -= 7;
    }
    return Math.max(0, Math.min(100, score));
}
/** Generic (manual) ticket moves: everything in TICKET_TRANSITIONS except entering
 * RETURNED_TO_SERVICE, which only the return-to-service step may do. */
export function canTransitionMaintenanceTicketManually(from, to) {
    if (to === 'RETURNED_TO_SERVICE')
        return { ok: false, reason: 'USE_RETURN_TO_SERVICE' };
    return canTransitionMaintenanceTicket(from, to);
}
export function canRecordMaintenanceTestResult(ticketStatus, notes) {
    if (ticketStatus !== 'TEST_PENDING')
        return { ok: false, reason: `TEST_REQUIRES_TEST_PENDING:${ticketStatus}` };
    if (!notes || notes.trim().length === 0)
        return { ok: false, reason: 'TEST_NOTES_REQUIRED' };
    return { ok: true };
}
export function ticketStatusAfterTest(result) {
    return result === 'PASS' ? 'TEST_PENDING' : 'IN_PROGRESS';
}
/** Return to service requires at least one open ticket, and EVERY open ticket on the machine
 * to be TEST_PENDING with a PASS recorded since it entered TEST_PENDING. */
export function canReturnToServiceWithTickets(openTickets) {
    if (openTickets.length === 0)
        return { ok: false, reason: 'NO_MAINTENANCE_TICKET' };
    for (const t of openTickets) {
        if (t.status !== 'TEST_PENDING')
            return { ok: false, reason: `TICKET_NOT_TESTED:${t.status}` };
        if (t.latestResultSinceTestPending !== 'PASS')
            return { ok: false, reason: 'AUTHORIZED_TEST_NOT_PASSED' };
    }
    return { ok: true };
}
/** Work orders actually running on a machine that goes DOWN/MAINTENANCE/HOLD are put ON_HOLD
 * (production cannot physically continue there); they resume only through the normal
 * ON_HOLD -> IN_PROGRESS transition, which re-checks machine eligibility. */
export function workOrderStatusesHeldOnMachineStop() {
    return ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED'];
}
