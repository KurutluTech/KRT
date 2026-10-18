// KMI NEXT — QR / barcode scan contract (Frozen Master: QR/barcode, mobile shop-floor scanning).
//
// Provenance (old KMI, read-only — window.kmiProcessScan): a scanned value is either a plain
// code (SO-…, WO-…, BOX-…, MACHINE-…) or a full link produced by a phone's own camera app
// (https://…/?scan=CODE), from which the CODE is extracted; every scan is recorded as an event
// (source PHONE_CAMERA/SCANNER) and an unknown code is still recorded, never silently dropped.
//
// KMI NEXT keeps both forms readable and adds its own typed payload for labels it prints:
//   KMI:<TYPE>:<id>      e.g. KMI:WO:3f1c…  KMI:LOT:…  KMI:TOOL:EM-10MM-001  KMI:MACHINE:M-07
// Resolution against the canonical tables happens server-side (kmi_next.record_scan,
// migration 0020), which also logs the scan append-only. Camera decoding on a physical phone is
// NOT_VERIFIED in this sandbox; the contract below is what the camera, a USB/Bluetooth
// keyboard-wedge scanner and manual entry all feed into.
export const SCAN_TYPES = ['WO', 'LOT', 'TOOL', 'MACHINE', 'SHIP', 'PO', 'ASSET'];
export function encodeKmiQr(type, ref) {
    if (!ref || ref.trim().length === 0)
        throw new Error('REF_REQUIRED');
    if (ref.includes(':'))
        throw new Error('REF_MUST_NOT_CONTAIN_COLON');
    return `KMI:${type}:${ref.trim()}`;
}
/** Phone camera apps deliver a link; extract ?scan=CODE exactly like old KMI did. */
export function unwrapScanLink(raw) {
    const code = raw.trim();
    try {
        const u = new URL(code);
        const p = u.searchParams.get('scan');
        if (p)
            return p.trim();
    }
    catch {
        /* not a URL — plain code */
    }
    return code;
}
export function parseScan(raw) {
    const code = unwrapScanLink(String(raw ?? ''));
    if (code.length === 0)
        return { kind: 'INVALID', reason: 'EMPTY_SCAN' };
    if (code.length > 200)
        return { kind: 'INVALID', reason: 'SCAN_TOO_LONG' };
    const m = /^KMI:([A-Z]+):(.*)$/.exec(code);
    if (m) {
        const type = m[1];
        if (!SCAN_TYPES.includes(type))
            return { kind: 'INVALID', reason: `UNKNOWN_SCAN_TYPE:${m[1]}` };
        const ref = (m[2] ?? '').trim();
        if (ref.length === 0)
            return { kind: 'INVALID', reason: 'EMPTY_SCAN_REF' };
        return { kind: 'KMI', type, ref };
    }
    return { kind: 'LEGACY', code };
}
