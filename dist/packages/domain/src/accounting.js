export const INVOICE_CURRENCIES = ['TRY', 'EUR', 'USD', 'GBP'];
const PAYMENT_TOLERANCE = 0.001;
export function canCreateInvoiceForShipment(shipmentStatus, lotSource, currency) {
    if (shipmentStatus !== 'DISPATCHED' && shipmentStatus !== 'DELIVERED') {
        return { ok: false, reason: `SHIPMENT_NOT_DISPATCHED:${shipmentStatus}` };
    }
    if (lotSource !== 'WORK_ORDER')
        return { ok: false, reason: 'LOT_NOT_FROM_CUSTOMER_ORDER' };
    if (!INVOICE_CURRENCIES.includes(currency))
        return { ok: false, reason: 'INVALID_CURRENCY' };
    return { ok: true };
}
/** Money is rounded to 2 decimals once, at invoice creation, and never recomputed. */
export function computeInvoiceAmount(qty, unitPrice) {
    return Math.round(qty * unitPrice * 100) / 100;
}
export function canRecordPayment(invoiceAmount, paidSoFar, amount) {
    if (!(amount > 0))
        return { ok: false, reason: 'PAYMENT_MUST_BE_POSITIVE' };
    if (amount > invoiceAmount - paidSoFar + PAYMENT_TOLERANCE)
        return { ok: false, reason: 'PAYMENT_EXCEEDS_REMAINING' };
    return { ok: true };
}
export function computeInvoiceStatus(invoiceAmount, paid) {
    if (paid >= invoiceAmount - PAYMENT_TOLERANCE)
        return 'PAID';
    if (paid > 0)
        return 'PARTIAL';
    return 'OPEN';
}
/**
 * The remaining delivery obligation for an order item, DERIVED from its dispatched/delivered
 * shipments — never stored as a second counter (ONE-FACT: the shipment log is the truth).
 */
export function computeShipmentObligation(qtyOrdered, shippedLotQtys) {
    const qtyShipped = shippedLotQtys.reduce((a, q) => a + q, 0);
    return {
        qtyOrdered,
        qtyShipped,
        qtyRemaining: Math.max(0, qtyOrdered - qtyShipped),
        overShipped: qtyShipped > qtyOrdered,
    };
}
