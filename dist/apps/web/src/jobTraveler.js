// KMI-013 (V4 013.07-08) — Job Traveler: the printable A4/A5 work-order card. PURE: builds what is printed from the job_card RPC payload.
// RULES: the QR carries IDENTITY ONLY (KMI:WO:<id>, KMI:OP:<id>) — scanning opens/validates, it never authorises an action (START etc. go through the
// explicit, server-gated, idempotent calls). The traveler never carries customer, price, cost or purchasing data: job_card has none, and this builder
// copies an explicit allow-list of fields so a future field can never leak onto paper by accident.
import { encodeKmiQr } from '../../../packages/domain/src/scan.js';
export const TRAVELER_FOOTNOTE = 'QR yalnızca kimliktir: okutmak yetki vermez. Üretime başlama/bitirme yalnızca sistemde, yetkili ve açık işlemle yapılır.';
export function buildTraveler(jc, size) {
    const gate = jc.documentGate ? String(jc.documentGate.reason ?? jc.documentGate) : null;
    return {
        size, woQr: encodeKmiQr('WO', jc.workOrderId), woRef: jc.workOrderId.slice(0, 8), qtyPlanned: jc.qtyPlanned, revision: jc.revision, status: jc.status, gate,
        ops: [...jc.operations].sort((a, b) => a.opNo - b.opNo).map((o) => ({
            opNo: o.opNo, opCode: o.opCode, name: o.name, status: o.status, qtyIn: o.qtyIn, setupMinutes: o.setupMinutes, cycleSeconds: o.cycleSeconds,
            firstPieceRequired: o.firstPieceRequired, qcRequired: o.qcRequired, instructions: o.instructions, qrPayload: o.qr.operation, traceRef: o.traceRef,
            documents: o.documents.map((d) => `${String(d['docNo'] ?? d['doc_no'] ?? '')} ${String(d['title'] ?? '')}`.trim()).filter(Boolean),
        })),
        footnote: TRAVELER_FOOTNOTE,
    };
}
/** duplicate-scan guard for the UI: the same raw value inside the window is ignored (the server calls are idempotent as well) */
export function createScanDebounce(windowMs = 3000, now = Date.now) {
    let last = '';
    let at = -Infinity;
    return (raw) => { const t = now(); const dup = raw === last && t - at < windowMs; if (!dup) {
        last = raw;
        at = t;
    } return !dup; };
}
