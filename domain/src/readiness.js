// KMI NEXT — Work-order production readiness, FAIL-CLOSED (Owner order #679 P0-A).
//
// "BOM veya CAM takım listesi bulunmayan ürün/revizyon için otomatik olarak 'malzeme/takım
// gerekmiyor' sonucuna varma." Missing master data is NOT "nothing needed": it is UNKNOWN /
// VERİ GEREKLİ and blocks the start. "Nothing needed" is accepted ONLY through an explicit,
// authorized (critical action READINESS_EXEMPTION_GRANT), reasoned and audited exemption
// recorded per work order and per kind (MATERIAL / TOOL).
//
// The same canonical check runs for old and new work orders: every transition to IN_PROGRESS
// (first start, resume from ON_HOLD, continue after first-piece approval) goes through it.
// Mirrored by supabase/migrations/0021_kmi_next_readiness_fail_closed.sql
// (kmi_next.work_order_readiness + transition_work_order_status v6).
/** Canonical display label (Turkish) — same text on every screen. */
export function readinessLabel(r) {
    switch (r.state) {
        case 'READY':
            return 'HAZIR';
        case 'EXEMPT':
            return `MUAF (yetkili onay) — ${r.reason ?? ''}`;
        case 'UNKNOWN':
            return `UNKNOWN / VERİ GEREKLİ — ${r.reason ?? ''}`;
        case 'NOT_READY':
            return `ENGELLİ — ${r.reason ?? ''}`;
    }
}
export function evaluateMaterialReadiness(i) {
    if (i.revisionBound && i.bomLineCount > 0) {
        if (i.firstShortageCode !== null)
            return { kind: 'MATERIAL', state: 'NOT_READY', reason: `MATERIAL_SHORTAGE:${i.firstShortageCode}` };
        return { kind: 'MATERIAL', state: 'READY', reason: null };
    }
    if (i.exemptionReason !== null)
        return { kind: 'MATERIAL', state: 'EXEMPT', reason: i.exemptionReason };
    return {
        kind: 'MATERIAL',
        state: 'UNKNOWN',
        reason: i.revisionBound ? 'MATERIAL_REQUIREMENT_UNKNOWN:BOM_EMPTY' : 'MATERIAL_REQUIREMENT_UNKNOWN:NO_REVISION',
    };
}
export function evaluateToolReadiness(i) {
    if (i.camProgramBound && i.camToolLineCount > 0) {
        if (i.firstNotReadyToolType !== null)
            return { kind: 'TOOL', state: 'NOT_READY', reason: `TOOL_NOT_READY:${i.firstNotReadyToolType}` };
        return { kind: 'TOOL', state: 'READY', reason: null };
    }
    if (i.exemptionReason !== null)
        return { kind: 'TOOL', state: 'EXEMPT', reason: i.exemptionReason };
    return {
        kind: 'TOOL',
        state: 'UNKNOWN',
        reason: i.camProgramBound ? 'TOOL_REQUIREMENT_UNKNOWN:CAM_NO_TOOLS' : 'TOOL_REQUIREMENT_UNKNOWN:NO_CAM_PROGRAM',
    };
}
/** Start gate over both kinds, material first (same order as the SQL gate). */
export function canStartWithReadiness(results) {
    for (const kind of ['MATERIAL', 'TOOL']) {
        const r = results.find((x) => x.kind === kind);
        if (!r)
            return { ok: false, reason: `${kind}_REQUIREMENT_UNKNOWN:NOT_EVALUATED` };
        if (r.state === 'UNKNOWN' || r.state === 'NOT_READY')
            return { ok: false, reason: r.reason ?? `${kind}_NOT_READY` };
    }
    return { ok: true };
}
export const EXEMPTION_MIN_REASON_LENGTH = 10;
const EXEMPTION_ALLOWED_WO_STATUSES = ['PLANNED', 'MACHINE_ASSIGNED', 'ON_HOLD'];
/** Server re-checks authorization (READINESS_EXEMPTION_GRANT); this is the data rule. */
export function canGrantReadinessExemption(input) {
    if (input.reason.trim().length < EXEMPTION_MIN_REASON_LENGTH)
        return { ok: false, reason: 'REASON_REQUIRED' };
    if (!EXEMPTION_ALLOWED_WO_STATUSES.includes(input.workOrderStatus)) {
        return { ok: false, reason: `EXEMPTION_NOT_ALLOWED_IN_STATUS:${input.workOrderStatus}` };
    }
    if (input.requirementDefined)
        return { ok: false, reason: `${input.kind}_REQUIREMENT_DEFINED` };
    if (input.alreadyExempt)
        return { ok: false, reason: 'EXEMPTION_ALREADY_ACTIVE' };
    return { ok: true };
}
