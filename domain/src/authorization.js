// KMI NEXT — Frozen Master Item 2: Critical Server-Side Authorization
// "Kritik mutasyonların browser/client role kontrolünden server/RLS + business authorization +
// audit sınırına taşınması." This module defines the canonical set of critical actions and the
// pure "would this be allowed" check used for instant UI feedback. The REAL, non-bypassable
// authority is the Postgres RLS + RPC layer in supabase/migrations/0001_kmi_next_foundation.sql
// (kmi_next.has_permission / kmi_next.authorize_critical_action) — this client-side function can
// never be the actual security boundary, and every caller must still await the server RPC result
// before treating an action as authorized. See docs/ARCHITECTURE.md §"Truth Mode" rule 1.
// Today's real role→action matrix (mirrors the SQL seed in the migration — the two must stay in
// lockstep; a test in test/authorization.test.ts cross-checks this against the seeded SQL rows).
const DEFAULT_ROLE_MATRIX = {
    WORK_ORDER_ASSIGN_MACHINE: ['ADMIN', 'MANAGEMENT'],
    WORK_ORDER_MULTI_MACHINE_ASSIGN: ['ADMIN', 'MANAGEMENT'],
    FIRST_PIECE_APPROVE: ['ADMIN', 'QUALITY'],
    QUALITY_HOLD_RELEASE: ['ADMIN', 'QUALITY'],
    FINAL_PRODUCTION_RELEASE: ['ADMIN', 'QUALITY'],
    MANAGEMENT_RELEASE: ['ADMIN', 'MANAGEMENT'],
    COMMERCIAL_RELEASE: ['ADMIN', 'MANAGEMENT', 'ACCOUNTING'],
    PURCHASING_APPROVE: ['ADMIN', 'MANAGEMENT', 'PURCHASING'],
    ACCOUNTING_MUTATION: ['ADMIN', 'ACCOUNTING'],
    PRODUCTION_CORRECTION: ['ADMIN', 'MANAGEMENT'],
    MAINTENANCE_TEST_RELEASE: ['ADMIN', 'MAINTENANCE'],
    // Migration 0015: quality reject / NCR disposition / re-inspection decision.
    QUALITY_REJECT: ['ADMIN', 'QUALITY'],
    // Migration 0016: product master, revisions, BOM lines and revision release (engineering).
    BOM_RELEASE: ['ADMIN', 'MANAGEMENT', 'CAM'],
    // Migration 0021: explicit 'no material / no tool needed' exemption (fail-closed readiness).
    READINESS_EXEMPTION_GRANT: ['ADMIN', 'MANAGEMENT'],
    // Migration 0024: second physical label for the same record (traceability risk).
    LABEL_REPRINT: ['ADMIN', 'MANAGEMENT', 'QUALITY'],
    GECKO_ATTENDANCE_VIEW: ['ADMIN', 'MANAGEMENT'],
    GECKO_MAPPING_VERIFY: ['ADMIN', 'MANAGEMENT'],
    GECKO_SYNC_RUN: ['ADMIN', 'MANAGEMENT'],
    GECKO_VIEW_GRANT: ['ADMIN', 'MANAGEMENT'],
    COMPETENCY_APPROVE: ['ADMIN', 'MANAGEMENT'],
    ACADEMY_MANAGE: ['ADMIN', 'MANAGEMENT'],
    PERSONNEL_LOGIN_LINK: ['ADMIN'],
    PUANTAJ_MANAGE: ['ADMIN', 'MANAGEMENT'],
    DOCUMENT_MANAGE: ['ADMIN', 'MANAGEMENT', 'QUALITY'],
    // Migration 0039: routing definition, operation QC, D-012 operator clearance on an unreviewed machine.
    ROUTING_MANAGE: ['ADMIN', 'MANAGEMENT', 'CAM'],
    OPERATION_QC_RECORD: ['ADMIN', 'QUALITY'],
    MACHINE_SKILL_VERIFY: ['ADMIN', 'MANAGEMENT'],
    // Migration 0043: D-014 report scheduler switch (the owner-only economic schedule additionally needs economic access).
    REPORT_SCHEDULE_MANAGE: ['ADMIN', 'MANAGEMENT'],
    // Migration 0045: KMI LIVE display tokens (create / revoke / list).
    LIVE_DISPLAY_MANAGE: ['ADMIN', 'MANAGEMENT'],
    // Migration 0048: device registry (integrations stay BLOCKED — DEVICE EVIDENCE REQUIRED).
    DEVICE_MANAGE: ['ADMIN'],
    // Migration 0051: write-authorization closure — these writes previously checked only "signed in".
    PERSONNEL_MANAGE: ['ADMIN', 'MANAGEMENT'],
    ORDER_CREATE: ['ADMIN', 'MANAGEMENT'],
    WORK_ORDER_CREATE: ['ADMIN', 'MANAGEMENT'],
    PURCHASE_ORDER_MANAGE: ['ADMIN', 'MANAGEMENT', 'PURCHASING'],
    MASTER_DATA_IMPORT: ['ADMIN', 'MANAGEMENT'],
    TASK_MANAGE: ['ADMIN', 'MANAGEMENT'],
    MANAGEMENT_VIEW: ['ADMIN', 'MANAGEMENT'],
    STRATEGY_MANAGE: ['ADMIN', 'MANAGEMENT'],
    RISK_MANAGE: ['ADMIN', 'MANAGEMENT'],
    MEETING_MANAGE: ['ADMIN', 'MANAGEMENT'],
    // Draft 0083: per-person DENY of a critical action (ADMIN only; refuses self-lockout).
    ACCESS_DENY_MANAGE: ['ADMIN'],
    WAREHOUSE_RECORD: ['ADMIN', 'MANAGEMENT', 'PURCHASING', 'SHIPPING', 'QUALITY'],
    MATERIAL_ISSUE: ['ADMIN', 'MANAGEMENT', 'PURCHASING', 'SHIPPING', 'QUALITY', 'OPERATOR'],
    SHIPMENT_MANAGE: ['ADMIN', 'MANAGEMENT', 'SHIPPING'],
    TOOL_RECORD: ['ADMIN', 'MANAGEMENT', 'CAM', 'OPERATOR', 'MAINTENANCE'],
    // Found by the SQL-parity fixture (CONTINUATION-004): seeded in the DB matrix, missing from this twin.
    ORDER_CONFIRM: ['ADMIN', 'MANAGEMENT'],
    ORDER_CANCEL: ['ADMIN', 'MANAGEMENT'],
};
/**
 * Fail-closed by construction: an unknown action, an empty role list, or no context at all
 * never resolves to `allowed: true`. This mirrors the proven has_permission() SQL pattern
 * already shipped and tested in the existing KMI server (returns false on auth.uid() IS NULL
 * or an unrecognized resource/action pair).
 */
export function checkAuthorization(action, ctx, matrix = DEFAULT_ROLE_MATRIX) {
    if (!ctx || !ctx.userId) {
        return { allowed: false, reason: 'NO_AUTH_CONTEXT' };
    }
    if (ctx.overrides && Object.prototype.hasOwnProperty.call(ctx.overrides, action)) {
        const ov = ctx.overrides[action];
        return { allowed: !!ov, reason: ov ? 'USER_OVERRIDE_ALLOW' : 'USER_OVERRIDE_DENY' };
    }
    const allowedRoles = matrix[action];
    if (!allowedRoles) {
        return { allowed: false, reason: 'UNKNOWN_ACTION' };
    }
    const hit = ctx.roles.some((r) => allowedRoles.includes(r));
    return hit
        ? { allowed: true, reason: 'ROLE_MATCH' }
        : { allowed: false, reason: 'NO_MATCHING_ROLE' };
}
export { DEFAULT_ROLE_MATRIX };
