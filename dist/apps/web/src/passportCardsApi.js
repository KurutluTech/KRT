export const PASSPORT_DOC_TYPES = {
    MACHINE: [{ code: 'ASSET_PHOTO', label: 'Fotoğraf' }, { code: 'CATALOG', label: 'Katalog' }, { code: 'SERVICE_DOC', label: 'Servis / bakım belgesi' }, { code: 'TECH_DOC', label: 'Teknik doküman' }],
    PRODUCT: [{ code: 'ASSET_PHOTO', label: 'Ürün resmi' }, { code: 'TECH_DOC', label: 'Teknik doküman' }],
    CUSTOMER: [{ code: 'ASSET_PHOTO', label: 'Logo / fotoğraf' }, { code: 'CONTRACT', label: 'Sözleşme' }, { code: 'COMMERCIAL_DOC', label: 'Ticari doküman' }, { code: 'TECH_DOC', label: 'Teknik doküman' }],
    PERSONNEL: [{ code: 'ASSET_PHOTO', label: 'Profil fotoğrafı' }, { code: 'PERSONNEL_FILE', label: 'Özlük belgesi' }, { code: 'PERSONNEL_ID', label: 'Kimlik belgesi' }],
};
export function createPassportCardsApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    return {
        get: (t, id) => rpc('passport_get', { p_entity_type: t, p_entity_id: id }),
        setValue: (t, id, code, value, unit, from, reason) => rpc('passport_set_value', { p_entity_type: t, p_entity_id: id, p_code: code, p_value: value, p_unit: unit, p_valid_from: from, p_reason: reason }),
        history: (t, id, code) => rpc('passport_value_history', { p_entity_type: t, p_entity_id: id, p_code: code }),
        upload: (t, id, docType, title, fileName, mime, b64, note, documentId) => rpc('upload_document', { p_doc_type: docType, p_entity_type: t, p_entity_id: id, p_title: title, p_file_name: fileName, p_mime_type: mime,
            p_content_base64: b64, p_valid_until: null, p_note: note, p_document_id: documentId }),
        content: (v) => rpc('document_version_content', { p_version_id: v }),
    };
}
