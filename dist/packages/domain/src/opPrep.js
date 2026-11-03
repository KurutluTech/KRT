// KMI-013 operasyon hazırlık formu — saf fonksiyonlar (ağ/DOM yok). Sunucu (m0183) karar verir; burası yalnız gösterim ve
// gönderilecek alanları hazırlar. Taslak = rotada olmayan operasyonun hazırlığı; rota operasyonu/iş emri/üretim kaydı değildir.
// m0206: sabit OP10/OP20/OP40 yok — hangi operasyonların hazırlık kartı olacağı rotadan ve mevcut taslaklardan gelir; yeni slot elle eklenir.
export const DEFAULT_SLOTS = ['CUT_PREP'];
export const slotLabel = (s) => (s === 'CUT_PREP' ? 'CUT/PREP · kesim/hazırlık' : s);
export const slotValid = (s) => /^(CUT_PREP|OP[1-9][0-9]{1,2})$/.test(String(s ?? ''));
/** Alanlar: [sunucu anahtarı, istemci (camel) anahtarı, etiket, tür] */
export const FIELDS = [
    ['op_name', 'opName', 'Operasyon adı', 'text'],
    ['machine_id', 'machineId', 'Makine', 'uuid'],
    ['nc_document_id', 'ncDocumentId', 'NC programı', 'uuid'],
    ['cam_program_id', 'camProgramId', 'CAM kaydı', 'uuid'],
    ['tool_list_document_id', 'toolListDocumentId', 'Takım listesi', 'uuid'],
    ['fixture', 'fixture', 'Fikstür / bağlama', 'text'],
    ['setup_minutes', 'setupMinutes', 'Hazırlık süresi (dk)', 'num'],
    ['cycle_seconds', 'cycleSeconds', 'Çevrim süresi (sn/parça)', 'num'],
    ['control_plan_note', 'controlPlanNote', 'Kalite kontrol planı', 'text'],
    ['first_piece_required', 'firstPieceRequired', 'İlk parça (First Piece) gerekli mi', 'bool'],
    ['first_piece_note', 'firstPieceNote', 'İlk parça notu', 'text'],
    ['skill_codes', 'skillCodes', 'Gerekli operatör yetkinlikleri', 'list'],
    ['reference_document_ids', 'referenceDocumentIds', 'Referans belgeler (teknik resim, STEP, fotoğraf)', 'list'],
    ['note', 'note', 'Not', 'text'],
];
export const MISSING_TR = {
    op_name: 'operasyon adı', machine: 'makine', nc_cam: 'NC programı veya CAM kaydı', tool_list: 'takım listesi', fixture: 'fikstür/bağlama',
    setup_minutes: 'hazırlık süresi', cycle_seconds: 'çevrim süresi', control_plan: 'kalite kontrol planı', first_piece: 'ilk parça kararı', skills: 'operatör yetkinliği',
};
export const missingText = (m) => (m ?? []).map((x) => MISSING_TR[x] ?? x);
/** Ekran durumu. EKSİK sunucunun eksik listesinden türetilir; ONAYLI rota RELEASE / üretim GO değildir. */
export function statusView(d) {
    if (!d) return { code: 'NONE', label: 'BAŞLANMADI', tone: '', note: 'Bu operasyon için henüz hazırlık taslağı yok.' };
    const miss = d.missing ?? [];
    if (d.status === 'APPROVED') return { code: 'APPROVED', label: 'ONAYLI', tone: 'ok', note: 'Teknik hazırlık incelemesi tamam. Rota RELEASE veya üretim GO değildir; rotaya operasyon eklenmedi.' };
    if (d.status === 'READY_FOR_REVIEW') return { code: 'READY', label: 'TEKNİK İNCELEMEYE HAZIR', tone: 'warn', note: 'Tüm alanlar dolu; teknik onay bekliyor.' };
    if (miss.length) return { code: 'INCOMPLETE', label: 'EKSİK', tone: 'bad', note: `Eksik: ${missingText(miss).join(', ')}` };
    return { code: 'DRAFT', label: 'TASLAK', tone: '', note: 'Alanlar dolu; teknik incelemeye gönderilebilir.' };
}
const norm = (type, v) => {
    if (type === 'list') return [...new Set((v ?? []).map(String))].sort();
    if (type === 'num') { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; }
    if (type === 'bool') return v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
    if (type === 'uuid') return v ? String(v) : null;
    const s = String(v ?? '').trim(); return s === '' ? null : s;
};
/** Formdaki değerlerden yalnız DEĞİŞEN alanları sunucu anahtarlarıyla döndürür. Hatalı sayı → { error }. */
export function buildPayload(form, draft) {
    const out = {}; const errors = [];
    for (const [sk, ck, label, type] of FIELDS) {
        if (!(ck in form)) continue;
        const nv = norm(type, form[ck]);
        if (type === 'num' && Number.isNaN(nv)) { errors.push(`${label} sayı olmalı`); continue; }
        if (type === 'num' && nv !== null && nv <= 0) { errors.push(`${label} sıfırdan büyük olmalı`); continue; }
        const ov = norm(type, draft ? draft[ck] : undefined);
        if (JSON.stringify(nv) !== JSON.stringify(ov)) out[sk] = nv;
    }
    return { payload: out, errors, changed: Object.keys(out).length > 0 };
}
/** Belgenin başka bir operasyona bağlı olduğunu gösteren uyarı (otomatik atanmış sayılmaz). */
export const linkedNote = (linkedOps) => ((linkedOps ?? []).length ? `şu an ${linkedOps.map((n) => `OP${n}`).join(', ')} operasyonuna bağlı — bu operasyon için ayrıca seçmeniz gerekir` : '');
export const docsOfType = (docs, types) => (docs ?? []).filter((d) => types.includes(d.docType));
export const REF_TYPES = ['DRAWING', 'CAD_MODEL', 'ASSET_PHOTO', 'TECH_DOC'];
export const DOC_TYPE_TR = { DRAWING: 'Teknik resim', CAD_MODEL: 'STEP / CAD', ASSET_PHOTO: 'Ürün fotoğrafı', TECH_DOC: 'Teknik doküman', NC_PROGRAM: 'NC programı', TOOL_LIST: 'Takım listesi' };
/** Gösterilecek slotlar: varsayılanlar (rotada olmayanlar) + mevcut taslaklar, sıralı. */
export function slotsToShow(drafts, routingOps) {
    const inRoute = new Set((routingOps ?? []).map((o) => `OP${o.opNo}`));
    const s = new Set([...DEFAULT_SLOTS.filter((x) => !inRoute.has(x)), ...(drafts ?? []).map((d) => d.slot)]);
    return [...s].sort((a, b) => (a === 'CUT_PREP' ? -1 : b === 'CUT_PREP' ? 1 : Number(a.slice(2)) - Number(b.slice(2))));
}
const HIST_TR = { OP_PREP_CREATED: 'taslak açıldı', OP_PREP_SAVED: 'kaydedildi', OP_PREP_STATUS_DRAFT: 'taslağa geri alındı', OP_PREP_STATUS_READY_FOR_REVIEW: 'teknik incelemeye gönderildi', OP_PREP_STATUS_APPROVED: 'teknik olarak onaylandı' };
export const historyActionText = (a) => HIST_TR[a] ?? a;
/** Geçmiş kaydında değişen alanlar (etiketleriyle). */
export function historyChanges(row) {
    const b = row.before ?? {}, a = row.after ?? {};
    if (!row.before) return [];
    return FIELDS.filter(([, ck, , type]) => JSON.stringify(norm(type, b[ck])) !== JSON.stringify(norm(type, a[ck]))).map(([, , label]) => label);
}
