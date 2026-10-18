export const ASSET_CLASSES = ['CNC_MACHINE', 'AUX_PRODUCTION', 'FINISHING', 'MEASUREMENT_QUALITY', 'FIXTURE', 'MAINTENANCE_EQUIPMENT', 'LOGISTICS_VEHICLE', 'IT_DEVICE', 'OTHER'];
export const CLASS_TR = {
    CNC_MACHINE: { tab: 'CNC', full: 'CNC ve ana üretim makineleri' }, AUX_PRODUCTION: { tab: 'Yardımcı', full: 'Yardımcı üretim ekipmanları' }, FINISHING: { tab: 'Finisaj', full: 'Vibrasyon, yüzey işlem ve finisaj' },
    MEASUREMENT_QUALITY: { tab: 'Ölçüm', full: 'Ölçüm ve kalite cihazları' }, FIXTURE: { tab: 'Aparat', full: 'Aparat, fikstür ve özel ekipman' }, MAINTENANCE_EQUIPMENT: { tab: 'Bakım', full: 'Bakım ekipmanları ve el aletleri' },
    LOGISTICS_VEHICLE: { tab: 'Lojistik', full: 'Forklift, transpalet, iç lojistik' }, IT_DEVICE: { tab: 'IT', full: 'Bilgisayar, tablet, terminal' }, OTHER: { tab: 'Diğer', full: 'Diğer işletme varlıkları' },
};
export const LIFECYCLE_TR = { ACTIVE: 'Aktif', INACTIVE: 'Pasif', OUT_OF_SERVICE: 'Hizmet dışı', ARCHIVED: 'Arşiv' };
export const OPS_TR = { UP: 'Kayıtlı durum: uygun', DOWN: 'Arızalı', MAINTENANCE: 'Bakımda', HOLD: 'Beklemede' };
export const DEPARTMENTS = [{ code: 'URETIM', tr: 'Üretim' }, { code: 'KALITE', tr: 'Kalite' }, { code: 'BAKIM', tr: 'Bakım' }, { code: 'CAM', tr: 'CAM / Mühendislik' }, { code: 'OFIS', tr: 'Ofis' }, { code: 'TESVIYE', tr: 'Tesviye' }, { code: 'ASCI', tr: 'Mutfak' }];
export const deptTr = (c) => (c ? DEPARTMENTS.find((d) => d.code === c)?.tr ?? c : null);
export const KIND_TR = { ASSIGN: 'İlk zimmet', TRANSFER: 'Devir', RETURN: 'İade', SERVICE_HANDOVER: 'Bakıma teslim', SERVICE_RETURN: 'Bakımdan iade' };
export const TRANSFER_STATUS_TR = { PENDING: 'Onay bekliyor', ACCEPTED: 'Kabul edildi', REJECTED: 'Reddedildi', CANCELLED: 'İptal edildi', EXPIRED: 'Süresi doldu' };
export const EVENT_TR = { REGISTERED: 'Kayda alındı', UPDATED: 'Bilgi güncellendi', LOCATION_CHANGED: 'Konum değişti', STATUS_CHANGED: 'Durum değişti', TRANSFER_REQUESTED: 'Zimmet talebi açıldı', CUSTODY_CHANGED: 'Zimmet devredildi',
    TRANSFER_REJECTED: 'Zimmet talebi reddedildi', TRANSFER_CANCELLED: 'Zimmet talebi iptal edildi', TRANSFER_EXPIRED: 'Zimmet talebi süresi doldu', CUSTODY_RELEASED_BY_MANAGER: 'Zimmet yönetici tarafından kapatıldı' };
export function createAssetApi(client, session) {
    // the data-client camelCases every response key; this adapter's types mirror the RPC (snake_case) contract, so keys are restored here, once
    const snake = (v) => Array.isArray(v) ? v.map(snake) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), snake(x)])) : v;
    const rpc = async (fn, args = {}) => snake(await client.rpc(fn, args, session));
    const nz = (v) => (v && v.trim() ? v.trim() : null);
    return {
        list: () => rpc('asset_list'), summary: () => rpc('asset_summary'), get: (id) => rpc('asset_get', { p_asset_id: id }), myTransfers: () => rpc('asset_my_transfers'),
        targets: () => rpc('asset_transfer_targets'), personnelCustody: (pid) => rpc('asset_personnel_custody', { p_personnel_id: pid }),
        create: (i) => rpc('asset_create', { p_name: i.name, p_class: i.cls, p_code: nz(i.code), p_subcategory: nz(i.subcategory), p_brand_model: nz(i.brandModel), p_serial_no: nz(i.serialNo), p_manufacturer: nz(i.manufacturer),
            p_acquired_on: nz(i.acquiredOn), p_commissioned_on: nz(i.commissionedOn), p_department: nz(i.department), p_location: nz(i.location), p_responsible_unit: nz(i.responsibleUnit), p_lifecycle: 'ACTIVE', p_force_new: !!i.forceNew, p_request_id: i.requestId }),
        update: async (id, f, reason) => { await rpc('asset_update', { p_asset_id: id, p_name: nz(f.name), p_subcategory: nz(f.subcategory), p_brand_model: nz(f.brandModel), p_serial_no: nz(f.serialNo), p_manufacturer: nz(f.manufacturer), p_acquired_on: nz(f.acquiredOn), p_commissioned_on: nz(f.commissionedOn), p_class: f.cls ?? null, p_reason: reason }); },
        setLocation: async (id, location, department, unit, reason) => { await rpc('asset_set_location', { p_asset_id: id, p_location: location, p_department: department, p_responsible_unit: unit, p_reason: reason }); },
        setStatus: async (id, status, reason) => { await rpc('asset_set_status', { p_asset_id: id, p_status: status, p_reason: reason }); },
        transferCreate: (id, kind, toP, toD, note, requestId) => rpc('asset_transfer_create', { p_asset_id: id, p_kind: kind, p_to_personnel: toP, p_to_department: toD, p_note: nz(note), p_hours: 72, p_request_id: requestId }),
        accept: (t) => rpc('asset_transfer_accept', { p_transfer_id: t }), reject: (t, reason) => rpc('asset_transfer_reject', { p_transfer_id: t, p_reason: reason }),
        cancel: (t, reason) => rpc('asset_transfer_cancel', { p_transfer_id: t, p_reason: reason }), release: async (id, reason) => { await rpc('asset_release_custody', { p_asset_id: id, p_reason: reason }); },
    };
}
