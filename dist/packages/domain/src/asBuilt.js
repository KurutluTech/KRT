// KMI NEXT — as built + document gates + rule-based document intelligence. Twin of migration 0042.
// No OCR/AI is connected: proposals come from deterministic rules on the file name and text/CSV content,
// are PROPOSED only, and a DOCUMENT_MANAGE holder verifies them. Only verified fields feed consistency.
export const GATE_TR = { OPERATION_START: 'Operasyon başlangıcı', FINAL_RELEASE: 'Final serbest bırakma', SHIPMENT: 'Sevkiyat' };
export const EXTRACTION_FLAG_TR = {
    CONTENT_NOT_READ: 'İçerik okunmadı (PDF/görüntü için OCR bağlı değil) — yalnız dosya adından',
    TYPE_MISMATCH_SUSPECTED: 'Belge türü uyuşmuyor olabilir',
    REVISION_MISMATCH_SUSPECTED: 'Belgedeki revizyon kayıttakinden farklı olabilir',
    CERT_EXPIRED: 'Belgedeki geçerlilik tarihi geçmiş',
};
export const CONSISTENCY_TR = {
    EXPIRED: 'Süresi dolmuş', NOT_ANALYSED: 'Henüz incelenmedi', VERIFICATION_PENDING: 'Doğrulama bekliyor',
    REVISION_MISMATCH: 'Revizyon uyuşmuyor', CHANGED_AFTER_PRODUCTION: 'Üretimden sonra değişti', GATE_DOCUMENT_MISSING: 'Zorunlu belge eksik',
};
/** Same as kmi_next.doc_text_lower. */
export function docTextLower(s) {
    return s.replace(/İ/g, 'i').toLowerCase();
}
/** Same keyword table and order as kmi_next.suggest_doc_type. */
export function suggestDocType(text) {
    const t = docTextLower(text);
    if (/(kalibrasyon|calibration)/.test(t))
        return 'CALIBRATION_CERTIFICATE';
    if (/(sertifika|certificate|en ?10204|mill test|\bmtr\b|3\.1\b|3\.2\b)/.test(t))
        return 'MATERIAL_CERTIFICATE';
    if (/(kontrol[ _-]?plan|control[ _-]?plan)/.test(t))
        return 'CONTROL_PLAN';
    if (/(teknik[ _-]?resim|drawing|\.dwg|\.dxf|çizim)/.test(t))
        return 'DRAWING';
    if (/(irsaliye|delivery[ _-]?note)/.test(t))
        return 'DELIVERY_NOTE';
    if (/(\.nc$|\.tap$|\.mpf$|\.h$)/.test(t))
        return 'NC_PROGRAM';
    if (/(setup[ _-]?sheet|ayar[ _-]?föy|bağlama)/.test(t))
        return 'CAM_SETUP_SHEET';
    return null;
}
/** Same regexes as kmi_next.extract_doc_fields (first match each; missing = absent). */
export function extractDocFields(text) {
    const t = docTextLower(text);
    const out = {};
    const rev = t.match(/(?:^|[^a-z])(?:rev(?:izyon|ision)?)[ ._:-]*([a-z0-9]{1,3})(?:[^a-z0-9]|$)/);
    if (rev)
        out['revision'] = rev[1].toUpperCase();
    const dn = text.match(/\b([A-Z]{2,5}[-_]?[0-9]{3,8}(?:[-_][A-Z0-9]{1,6})?)\b/);
    if (dn)
        out['drawing_no'] = dn[1];
    const heat = t.match(/(?:heat|şarj|sarj|döküm)[ ._-]*(?:no|nr|numarası)?[ .:#-]*([a-z0-9][a-z0-9-]{2,})/);
    if (heat)
        out['heat_no'] = heat[1].toUpperCase();
    const ct = t.match(/en ?10204[ :-]*(3\.1|3\.2|2\.2)/);
    if (ct)
        out['cert_type'] = ct[1];
    const vu = t.match(/(?:geçerlilik|valid until|son geçerlilik|expiry)[^0-9]{0,20}([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (vu)
        out['valid_until'] = vu[1];
    return out;
}
/** Flags exactly as propose_document_metadata. */
export function extractionFlags(i) {
    const f = [];
    if (!i.textRead)
        f.push('CONTENT_NOT_READ');
    if (i.suggestedType && i.suggestedType !== i.declaredType)
        f.push('TYPE_MISMATCH_SUSPECTED');
    if (i.entityType === 'PRODUCT_REVISION' && i.fields['revision'] && i.recordRevision && i.recordRevision.toUpperCase() !== i.fields['revision'])
        f.push('REVISION_MISMATCH_SUSPECTED');
    if (i.fields['valid_until'] && i.fields['valid_until'] < i.today)
        f.push('CERT_EXPIRED');
    return f;
}
/** Drift: documents whose current version differs from the one production used (or no longer active). */
export function documentDrift(used, current) {
    return used.filter((u) => { const c = current.get(u.documentId); return !!c && (c.versionNo !== u.versionNo || c.status !== 'ACTIVE'); })
        .map((u) => ({ docType: u.docType, documentId: u.documentId, producedWithVersion: u.versionNo, currentVersion: current.get(u.documentId).versionNo }))
        .sort((a, b) => (a.docType < b.docType ? -1 : 1));
}
/** Rule scope (document_gate_missing): product / customer / op_no must match when set. */
export function gateRuleApplies(rule, ctx) {
    return rule.active && rule.gate === ctx.gate && (rule.productId === null || rule.productId === ctx.productId)
        && (rule.customerId === null || rule.customerId === ctx.customerId) && (rule.opNo === null || rule.opNo === ctx.opNo);
}
/** A document counts only if ACTIVE and not expired (document_present). */
export function documentCounts(d, today) {
    return d.status === 'ACTIVE' && (d.validUntil === null || d.validUntil >= today);
}
/** set_document_gate_rule refusals (after permission + note). */
export function gateRuleRefusal(r) {
    if (r.entityLevel === 'SHIPMENT' && r.gate !== 'SHIPMENT')
        return 'SHIPMENT_LEVEL_ONLY_FOR_SHIPMENT_GATE';
    if (r.opNo !== null && r.gate !== 'OPERATION_START')
        return 'OP_NO_ONLY_FOR_OPERATION_START';
    if (r.docSensitivity !== 'GENERAL')
        return 'FINANCIAL_DOCUMENT_CANNOT_GATE_PRODUCTION';
    return null;
}
