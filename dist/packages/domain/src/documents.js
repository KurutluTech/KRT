// KMI NEXT — Document Intelligence (matrix 37). Twin of migration 0035.
//
// Old KMI (read-only, docs/KMI_DOC_INTELLIGENCE_FOUNDATION_DESIGN_PACKET.md): job-order and
// product attachments in shared Storage buckets; customer-order "attachments" were metadata only
// in localStorage; the sales-order bucket was designed but never applied. KMI NEXT does NOT touch
// shared Storage (owner decision D-015): content is kept in KMI NEXT's own table (≤ 8 MB) with
// the same honest rules:
//   * every document has a TYPE and is linked to a REAL canonical record (checked on the server);
//   * versions are append-only; sha256 per version; the same content twice in one document is
//     refused (DUPLICATE_CONTENT); integrity is re-checked on every download;
//   * the declared file type must match the file's real signature (a renamed file is refused);
//   * certificates with expiry must carry a valid-until date; expired = not valid;
//   * financial documents (customer PO, invoices) are only readable — and uploadable — by people
//     who may see receivables / payables (same server gates as accounting, D-006);
//   * "required documents" per record type: proposals are seeded INACTIVE — which ones are
//     mandatory is the owner's call (D-015), never assumed.
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_ENTITY_TYPES = ['PRODUCT_REVISION', 'WORK_ORDER', 'ORDER', 'PURCHASE_ORDER', 'STOCK_LOT', 'SHIPMENT', 'NCR', 'MACHINE', 'TOOL'];
export const ENTITY_TR = {
    PRODUCT_REVISION: 'Ürün revizyonu', WORK_ORDER: 'İş emri', ORDER: 'Sipariş', PURCHASE_ORDER: 'Satınalma siparişi', STOCK_LOT: 'Lot',
    SHIPMENT: 'Sevkiyat', NCR: 'Uygunsuzluk', MACHINE: 'Makine', TOOL: 'Takım',
};
export const DOCUMENT_TYPES = [
    { code: 'DRAWING', titleTr: 'Teknik resim', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'CONTROL_PLAN', titleTr: 'Kontrol planı', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'WORK_INSTRUCTION', titleTr: 'Üretim talimatı', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'CAM_SETUP_SHEET', titleTr: 'Bağlama / ayar föyü', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'NC_PROGRAM', titleTr: 'CNC programı', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'MATERIAL_CERTIFICATE', titleTr: 'Malzeme sertifikası', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'CALIBRATION_CERTIFICATE', titleTr: 'Kalibrasyon sertifikası', sensitivity: 'GENERAL', hasExpiry: true },
    { code: 'PHOTO_EVIDENCE', titleTr: 'Fotoğraf kanıtı', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'DELIVERY_NOTE', titleTr: 'İrsaliye', sensitivity: 'GENERAL', hasExpiry: false },
    { code: 'CUSTOMER_PO', titleTr: 'Müşteri sipariş belgesi', sensitivity: 'RECEIVABLES', hasExpiry: false },
    { code: 'INVOICE_SCAN', titleTr: 'Satış faturası görüntüsü', sensitivity: 'RECEIVABLES', hasExpiry: false },
    { code: 'SUPPLIER_INVOICE_SCAN', titleTr: 'Tedarikçi faturası görüntüsü', sensitivity: 'PAYABLES', hasExpiry: false },
    { code: 'OTHER', titleTr: 'Diğer', sensitivity: 'GENERAL', hasExpiry: false },
];
export function documentType(code) {
    return DOCUMENT_TYPES.find((t) => t.code === code);
}
/** Proposed (INACTIVE) required-document rules seeded by 0035 — the owner decides (D-015). */
export const PROPOSED_REQUIREMENTS = [
    { entityType: 'PRODUCT_REVISION', docType: 'DRAWING' },
    { entityType: 'PRODUCT_REVISION', docType: 'CONTROL_PLAN' },
    { entityType: 'STOCK_LOT', docType: 'MATERIAL_CERTIFICATE' },
    { entityType: 'SHIPMENT', docType: 'DELIVERY_NOTE' },
    { entityType: 'NCR', docType: 'PHOTO_EVIDENCE' },
];
export const ALLOWED_MIME = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv',
    'application/dxf', 'image/vnd.dxf', 'model/step', 'application/step', 'application/octet-stream',
];
/** Real file signature check for the types that have one (same rule as kmi_next.document_signature_ok). */
export function signatureMatches(mime, bytes) {
    const b = (i) => bytes[i] ?? -1;
    switch (mime) {
        case 'application/pdf': return b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46 && b(4) === 0x2d; // %PDF-
        case 'image/png': return b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47;
        case 'image/jpeg': return b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
        case 'image/webp': return b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50;
        default: return true; // text / CAD / NC have no reliable magic number
    }
}
/** Same codes and order as kmi_next.upload_document (after decoding the content). */
export function canUploadDocument(r) {
    const t = documentType(r.docType);
    if (!t)
        return { ok: false, reason: 'DOCUMENT_TYPE_UNKNOWN' };
    if (!r.canSeeSensitivity(t.sensitivity))
        return { ok: false, reason: `FORBIDDEN: DOCUMENT_${t.sensitivity}` };
    if (!DOCUMENT_ENTITY_TYPES.includes(r.entityType))
        return { ok: false, reason: 'ENTITY_TYPE_INVALID' };
    if (!r.entityExists)
        return { ok: false, reason: 'ENTITY_NOT_FOUND' };
    if (!r.existing && (!r.title || r.title.trim().length < 3))
        return { ok: false, reason: 'TITLE_REQUIRED' };
    if (!r.fileName || r.fileName.trim() === '')
        return { ok: false, reason: 'FILE_NAME_REQUIRED' };
    if (!r.bytes || r.bytes.length === 0)
        return { ok: false, reason: 'CONTENT_REQUIRED' };
    if (r.bytes.length > MAX_DOCUMENT_BYTES)
        return { ok: false, reason: 'FILE_TOO_LARGE' };
    if (!ALLOWED_MIME.includes(r.mime))
        return { ok: false, reason: 'MIME_NOT_ALLOWED' };
    if (!signatureMatches(r.mime, r.bytes))
        return { ok: false, reason: 'CONTENT_TYPE_MISMATCH' };
    if (t.hasExpiry && !r.validUntil)
        return { ok: false, reason: 'VALID_UNTIL_REQUIRED' };
    if (r.validUntil && r.validUntil < r.today)
        return { ok: false, reason: 'VALID_UNTIL_IN_PAST' };
    if (r.existing) {
        if (r.existing.status !== 'ACTIVE')
            return { ok: false, reason: 'DOCUMENT_WITHDRAWN' };
        if (r.existing.docType !== r.docType)
            return { ok: false, reason: 'DOCUMENT_TYPE_MISMATCH' };
        if (r.sha256Hex && r.existing.hashes.includes(r.sha256Hex))
            return { ok: false, reason: 'DUPLICATE_CONTENT' };
    }
    return { ok: true };
}
export function documentExpiry(validUntil, today, soonDays = 30) {
    if (!validUntil)
        return 'NO_EXPIRY';
    if (validUntil < today)
        return 'EXPIRED';
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + soonDays);
    return validUntil <= d.toISOString().slice(0, 10) ? 'EXPIRING_SOON' : 'VALID';
}
/** For each ACTIVE requirement: an active document of that type whose current version is not expired. */
export function requirementState(docs, docType, today) {
    const active = docs.filter((d) => d.docType === docType && d.status === 'ACTIVE');
    if (active.length === 0)
        return 'MISSING';
    return active.some((d) => documentExpiry(d.currentValidUntil, today) !== 'EXPIRED') ? 'PRESENT' : 'EXPIRED';
}
export function bytesToHex(buf) {
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
