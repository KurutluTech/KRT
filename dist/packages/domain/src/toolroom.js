// KMI NEXT — Toolroom (owner talimatı 2026-10-10, Öncelik 3): canonical tool inventory —
// identity, location, life/wear, mount/unmount, issue/return, and work-order relationship.
// Same ONE-FACT append-only-movement discipline as stock.ts/maintenance.ts: a tool's current
// location is a server-maintained projection of its own movement history, never hand-edited.
// Connection points to the rest of the system (documented, not yet all built): CAM (a tool's
// wear-out triggers a CAM program/tool-list update — CAM has no domain module yet, owner
// directive scope item still BAŞLANMADI), purchasing (a worn-out tool's replacement is a
// purchase_order_line — purchasing.ts), warehouse (a new tool arrives via the SAME goods-receipt
// path as raw material — stock.ts/purchasing.ts — never a second receiving flow), production
// (a tool mounted on a machine is what makes that machine's work order eligible to run a
// specific operation — workOrder.ts; not yet cross-checked at the RPC level, an open gap noted
// below).
const ALLOWED_TRANSITIONS = {
    CABINET: ['MOUNTED', 'ISSUED', 'SCRAP'],
    MOUNTED: ['CABINET', 'SCRAP'],
    ISSUED: ['CABINET', 'SCRAP'],
    SCRAP: [],
};
/** The canonical tool location state machine — the ONE place location transitions are
 * validated (mirrors stock.ts's canTransitionStockState pattern exactly). */
export function canTransitionToolLocation(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/**
 * A tool can only be mounted from CABINET, and only onto a machine that is actually UP
 * (production-eligible) — same discipline as work-order machine assignment (maintenance.ts's
 * canAssignMachineForProduction): a DOWN/MAINTENANCE/HOLD machine gets no tool mounted either.
 */
export function canMountTool(location, machineStatus) {
    if (location !== 'CABINET') {
        return { ok: false, reason: `MOUNT_REQUIRES_CABINET_LOCATION:${location}` };
    }
    if (machineStatus !== 'UP') {
        return { ok: false, reason: `MACHINE_NOT_PRODUCTION_ELIGIBLE:${machineStatus}` };
    }
    return { ok: true };
}
export function canUnmountTool(location) {
    if (location !== 'MOUNTED') {
        return { ok: false, reason: `UNMOUNT_REQUIRES_MOUNTED_LOCATION:${location}` };
    }
    return { ok: true };
}
/** Issuing a hand tool to a person (not a machine-mounted tool) — only from CABINET. */
export function canIssueTool(location) {
    if (location !== 'CABINET') {
        return { ok: false, reason: `ISSUE_REQUIRES_CABINET_LOCATION:${location}` };
    }
    return { ok: true };
}
export function canReturnTool(location) {
    if (location !== 'ISSUED') {
        return { ok: false, reason: `RETURN_REQUIRES_ISSUED_LOCATION:${location}` };
    }
    return { ok: true };
}
/** A tool can be scrapped from any non-terminal location. */
export function canScrapTool(location) {
    if (location === 'SCRAP')
        return { ok: false, reason: 'ALREADY_SCRAPPED' };
    return { ok: true };
}
/** Wear percentage, capped at 100 — never divides by zero (a 0-rated-life tool is a data error,
 * treated as already fully worn so it is never silently usable). */
export function computeToolWearPercent(lifeMinutesUsed, lifeMinutesRated) {
    if (lifeMinutesRated <= 0)
        return 100;
    return Math.max(0, Math.min(100, Math.round((lifeMinutesUsed / lifeMinutesRated) * 100)));
}
/** A fully worn tool (100% life consumed) is never eligible for further production use — this
 * is the hook a future CAM/work-order integration must consult before starting an operation
 * with this tool (owner directive: "connect CAM ... production links"). */
export function canUseToolInProduction(wearPercent) {
    if (wearPercent >= 100) {
        return { ok: false, reason: 'TOOL_LIFE_EXHAUSTED' };
    }
    return { ok: true };
}
/**
 * Idempotency guard for tool movements (owner directive: "make tool movements traceable and
 * idempotent"). Mirrors the client_request_id dedupe pattern already used elsewhere in KMI
 * (e.g. old KMI's production_correction_create) — a movement carrying a client_request_id that
 * already exists in the ledger is a retry/duplicate, not a new fact, and must be refused (or,
 * at the RPC layer, returned as the original result) rather than double-applied.
 */
export function isDuplicateToolMovement(clientRequestId, existingClientRequestIds) {
    if (!clientRequestId)
        return false;
    return existingClientRequestIds.has(clientRequestId);
}
export function canReleaseCamProgram(status, toolLineCount) {
    if (status !== 'DRAFT')
        return { ok: false, reason: `CAM_PROGRAM_NOT_DRAFT:${status}` };
    if (toolLineCount < 1)
        return { ok: false, reason: 'CAM_PROGRAM_HAS_NO_TOOLS' };
    return { ok: true };
}
export function canBindCamProgram(workOrderStatus, workOrderRevisionId, program) {
    if (workOrderStatus !== 'PLANNED' && workOrderStatus !== 'MACHINE_ASSIGNED') {
        return { ok: false, reason: `CAM_CHANGE_NOT_ALLOWED_IN_STATUS:${workOrderStatus}` };
    }
    if (program.status !== 'RELEASED')
        return { ok: false, reason: `CAM_PROGRAM_NOT_RELEASED:${program.status}` };
    if (workOrderRevisionId === null || workOrderRevisionId !== program.productRevisionId) {
        return { ok: false, reason: 'CAM_PROGRAM_REVISION_MISMATCH' };
    }
    return { ok: true };
}
export function canMountToolForWorkOrder(input) {
    if (input.lifeUsed >= input.lifeRated)
        return { ok: false, reason: 'TOOL_LIFE_EXHAUSTED' };
    if (input.workOrderStatus === 'COMPLETED' || input.workOrderStatus === 'CANCELLED') {
        return { ok: false, reason: `WORK_ORDER_CLOSED:${input.workOrderStatus}` };
    }
    if (input.workOrderMachineId !== input.targetMachineId)
        return { ok: false, reason: 'TOOL_WO_MACHINE_MISMATCH' };
    if (input.camToolTypes !== null && !input.camToolTypes.includes(input.toolType)) {
        return { ok: false, reason: 'TOOL_NOT_IN_CAM_PROGRAM' };
    }
    return { ok: true };
}
/** Start gate: first CAM tool type not mounted in the needed quantity. */
export function canStartWithTools(required, mountedUsableByType) {
    for (const r of required) {
        if ((mountedUsableByType[r.toolType] ?? 0) < r.qty)
            return { ok: false, reason: `TOOL_NOT_READY:${r.toolType}` };
    }
    return { ok: true };
}
