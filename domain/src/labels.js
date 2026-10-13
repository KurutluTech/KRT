// KMI NEXT — QR / barcode labels (Owner order #679 B).
//
// Every labelled record (WO, LOT, TOOL, MACHINE, SHIP, PO) has exactly ONE label identity:
//   QR      : KMI:<TYPE>:<canonical ref>   (uuid; MACHINE/TOOL use their unique code)
//   Code128 : KL<6 digits>                 (short code for handheld 1-D scanners)
// Both resolve on the server (kmi_next.record_scan) to the canonical row. Printing is logged per
// print (print_no 1, 2, …); a REPRINT needs the LABEL_REPRINT critical action and a reason,
// because a second physical label for the same lot/shipment is a traceability risk.
// Mirrored by supabase/migrations/0024_kmi_next_labels.sql.
import { encodeKmiQr } from './scan.js';
export const LABEL_LAYOUTS = ['A4_SHEET', 'THERMAL_62x40', 'TABLET'];
export const LABEL_REPRINT_MIN_REASON = 5;
export function labelCodeFromSequence(seq) {
    if (!Number.isInteger(seq) || seq < 1 || seq > 999999)
        throw new Error('LABEL_SEQUENCE_OUT_OF_RANGE');
    return `KL${String(seq).padStart(6, '0')}`;
}
export function isLabelCode(raw) {
    return /^KL\d{6}$/.test(raw.trim().toUpperCase());
}
export function labelQrPayload(type, ref) {
    return encodeKmiQr(type, ref);
}
export function canPrintLabel(input) {
    if (!LABEL_LAYOUTS.includes(input.layout))
        return { ok: false, reason: `INVALID_LAYOUT:${input.layout}` };
    if (input.previousPrints === 0)
        return { ok: true };
    if (!input.hasReprintPermission)
        return { ok: false, reason: 'FORBIDDEN: LABEL_REPRINT' };
    if (!input.reason || input.reason.trim().length < LABEL_REPRINT_MIN_REASON)
        return { ok: false, reason: 'REPRINT_REASON_REQUIRED' };
    return { ok: true };
}
