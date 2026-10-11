// KMI NEXT — Purchasing / Warehouse (owner talimatı 2026-10-10, Öncelik 2).
// Purchase request -> purchase order -> supplier -> goods receipt -> incoming quality ->
// warehouse stock movement, as ONE canonical chain. The warehouse end of this chain feeds the
// EXISTING kmi_next.stock_lots/stock_movements canonical stock truth (stock.ts,
// canCreateStockLotFromGoodsReceipt) — this module never invents a second stock source, and
// never a second PO writer: kmi_next.purchase_orders is the ONE place a PO's status lives.
// Preserves the reservation -> delivery-to-production -> actual-consumption distinction already
// modeled in stock.ts's RESERVED/STAGED states — purchasing only ever gets raw material to
// AVAILABLE; what happens after that is stock.ts's and work order consumption's job, not
// re-implemented here.
const ALLOWED_TRANSITIONS = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['APPROVED', 'CANCELLED'],
    APPROVED: ['SENT', 'CANCELLED'],
    SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    PARTIALLY_RECEIVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
    RECEIVED: [],
    CANCELLED: [],
};
/** The canonical PO status state machine — the ONE place PO transitions are validated. Unlike
 * every other state machine in this codebase, PARTIALLY_RECEIVED -> PARTIALLY_RECEIVED is a
 * deliberately ALLOWED same-state "transition": a second, third, etc. partial goods receipt
 * against the same PO legitimately leaves it in PARTIALLY_RECEIVED again (not a no-op bug —
 * each individual receipt is still a new, auditable movement; see canRecordGoodsReceipt). */
export function canTransitionPurchaseOrderStatus(from, to) {
    if (from === to && from !== 'PARTIALLY_RECEIVED') {
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    }
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(to)) {
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    }
    return { ok: true };
}
/** A PO must have at least one line with positive ordered qty, and may only be created in DRAFT
 * (the RPC/caller sets the initial status — this just validates line shape). */
export function canCreatePurchaseOrder(lines) {
    if (lines.length === 0)
        return { ok: false, reason: 'PO_MUST_HAVE_AT_LEAST_ONE_LINE' };
    if (lines.some((l) => l.qtyOrdered <= 0))
        return { ok: false, reason: 'ALL_LINE_QUANTITIES_MUST_BE_POSITIVE' };
    return { ok: true };
}
/** Approval (critical action PURCHASING_APPROVE, already seeded in role_action_matrix) is only
 * meaningful on a SUBMITTED PO — approving a DRAFT, already-APPROVED, or CANCELLED PO is refused
 * (duplicate-operation guard per owner directive's explicit test requirement). */
export function canApprovePurchaseOrder(status) {
    if (status !== 'SUBMITTED') {
        return { ok: false, reason: `APPROVAL_REQUIRES_SUBMITTED_STATUS:${status}` };
    }
    return { ok: true };
}
/**
 * A goods receipt is only valid against a PO that has actually been SENT to the supplier (or is
 * already PARTIALLY_RECEIVED — multiple receipts over time are normal), the receipt qty must be
 * positive, and the running total received (existing + this receipt) must never exceed what was
 * ordered on that line — this is the single server-side guard against over-receiving, and it is
 * re-derived from real qtyOrdered/qtyReceived, never trusted from the client.
 */
export function canRecordGoodsReceipt(poStatus, qtyOrdered, qtyAlreadyReceived, qtyReceivingNow) {
    if (poStatus !== 'SENT' && poStatus !== 'PARTIALLY_RECEIVED') {
        return { ok: false, reason: `GOODS_RECEIPT_NOT_ALLOWED_IN_STATUS:${poStatus}` };
    }
    if (qtyReceivingNow <= 0)
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (qtyAlreadyReceived + qtyReceivingNow > qtyOrdered) {
        return { ok: false, reason: 'EXCEEDS_ORDERED_QTY' };
    }
    return { ok: true };
}
/** After a goods receipt, the PO as a whole is RECEIVED only once every line's qtyReceived has
 * reached its qtyOrdered; otherwise PARTIALLY_RECEIVED. Pure projection, never hand-set. */
export function computePurchaseOrderReceiptStatus(lines) {
    const fullyReceived = lines.every((l) => l.qtyReceived >= l.qtyOrdered);
    return fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}
/**
 * Incoming quality decision on a received (not-yet-lotted, or already-HOLD-lotted) batch:
 * ACCEPT moves the eventual stock lot HOLD -> AVAILABLE (stock.ts's existing transition),
 * REJECT moves it HOLD -> SCRAP. This function only validates that a decision is being made on
 * material that is actually awaiting one (HOLD) — the real state transition itself is
 * stock.ts's canTransitionStockState, never duplicated here (no second state machine for the
 * same fact).
 */
export function canRecordIncomingQualityDecision(stockLotState) {
    if (stockLotState !== 'HOLD') {
        return { ok: false, reason: `INCOMING_QUALITY_DECISION_REQUIRES_HOLD_STATE:${stockLotState}` };
    }
    return { ok: true };
}
const REQUEST_TRANSITIONS = {
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['CONVERTED'],
    REJECTED: [],
    CONVERTED: [],
};
export function canTransitionPurchaseRequest(from, to) {
    if (from === to)
        return { ok: false, reason: 'NO_OP_TRANSITION' };
    if (!REQUEST_TRANSITIONS[from].includes(to))
        return { ok: false, reason: `ILLEGAL_TRANSITION:${from}->${to}` };
    return { ok: true };
}
export function canCreatePurchaseRequest(materialCode, qty, reason) {
    if (!materialCode || materialCode.trim().length === 0)
        return { ok: false, reason: 'MATERIAL_CODE_REQUIRED' };
    if (!(qty > 0))
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (!reason || reason.trim().length === 0)
        return { ok: false, reason: 'REASON_REQUIRED' };
    return { ok: true };
}
/** Only APPROVED, not-yet-converted requests can become PO lines, each with a positive price. */
export function canConvertRequestsToPo(lines, currency) {
    if (lines.length === 0)
        return { ok: false, reason: 'PO_MUST_HAVE_AT_LEAST_ONE_LINE' };
    if (!['TRY', 'EUR', 'USD', 'GBP'].includes(currency))
        return { ok: false, reason: 'INVALID_CURRENCY' };
    for (const l of lines) {
        if (l.requestStatus !== 'APPROVED')
            return { ok: false, reason: `REQUEST_NOT_APPROVED:${l.requestStatus}` };
        if (!(l.unitPrice > 0))
            return { ok: false, reason: 'UNIT_PRICE_MUST_BE_POSITIVE' };
    }
    return { ok: true };
}
/** 3-way match for one supplier invoice line. */
export function canMatchSupplierInvoiceLine(input) {
    if (!(input.qty > 0))
        return { ok: false, reason: 'QTY_MUST_BE_POSITIVE' };
    if (input.poUnitPrice === null)
        return { ok: false, reason: 'PO_LINE_HAS_NO_PRICE' };
    if (Math.abs(input.unitPrice - input.poUnitPrice) > 1e-9)
        return { ok: false, reason: 'PRICE_MISMATCH' };
    if (input.qty > input.qtyAccepted - input.qtyAlreadyInvoiced + 1e-9)
        return { ok: false, reason: 'EXCEEDS_ACCEPTED_NOT_INVOICED' };
    return { ok: true };
}
// --- #679 A: supplier invoice & payment completion (migration 0023) ------------------------
/** Duplicate-invoice key: "f-001", "F 001" and " F-001 " are the same supplier invoice. */
export function normalizeInvoiceNo(invoiceNo) {
    return invoiceNo.trim().replace(/\s+/g, '').toUpperCase();
}
/** Incoming QC decision (migration 0023 adds authorization: ACCEPT = QUALITY_HOLD_RELEASE,
 * REJECT = QUALITY_REJECT, and a mandatory reason for REJECT). */
export function canDecideIncomingQuality(stockLotState, decision, reason) {
    const base = canRecordIncomingQualityDecision(stockLotState);
    if (!base.ok)
        return base;
    if (decision === 'REJECT' && (!reason || reason.trim().length === 0))
        return { ok: false, reason: 'REASON_REQUIRED' };
    return { ok: true };
}
/** PO line match view (PO ordered / received / QC / invoiced), same arithmetic as
 * kmi_next.supplier_po_match_status. */
export function computeSupplierPoLineMatch(input) {
    return {
        ...input,
        qtyQcPending: Math.max(0, input.qtyReceived - input.qtyAccepted - input.qtyRejected),
        qtyInvoiceable: Math.max(0, input.qtyAccepted - input.qtyInvoiced),
    };
}
export function supplierInvoiceStatus(amount, paid) {
    if (paid >= amount - 0.001)
        return 'PAID';
    return paid > 0 ? 'PARTIAL' : 'OPEN';
}
export function canRecordSupplierPayment(amount, alreadyPaid, payment) {
    if (!(payment > 0))
        return { ok: false, reason: 'PAYMENT_MUST_BE_POSITIVE' };
    if (payment > amount - alreadyPaid + 0.001)
        return { ok: false, reason: 'PAYMENT_EXCEEDS_REMAINING' };
    return { ok: true };
}
/** Shortage -> purchase request quantities: only the part not already requested by this work
 * order (open or converted requests), never zero or negative. */
export function shortageToPurchaseRequests(shortages, alreadyRequested = {}) {
    return shortages
        .map((s) => ({ materialCode: s.materialCode, qty: s.shortage - (alreadyRequested[s.materialCode] ?? 0) }))
        .filter((r) => r.qty > 0);
}
