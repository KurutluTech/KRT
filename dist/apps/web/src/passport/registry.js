import { canOpen } from '../access.js';
const T = (key, label) => ({ key, label });
const COMMON = [T('zaman', 'Zaman çizelgesi'), T('belgeler', 'Belgeler')];
/** Traceability chain (missing links, as-built, raw material, lots, shipments, economic lock): the former /pasaport screen, now a tab of the ONE canonical passport. */
export const TRACE_TAB = T('iz', 'İzlenebilirlik zinciri');
export const TRACE_KINDS = ['WORK_ORDER', 'PRODUCT', 'STOCK_LOT'];
/** Legacy /pasaport kinds → canonical kinds. A lot IS a stock lot: there is no second identity, only a second vocabulary. */
export const LEGACY_TO_CANONICAL = { LOT: 'STOCK_LOT', WORK_ORDER: 'WORK_ORDER', PRODUCT: 'PRODUCT' };
export const CANONICAL_TO_LEGACY = { STOCK_LOT: 'LOT', WORK_ORDER: 'WORK_ORDER', PRODUCT: 'PRODUCT' };
export const KINDS = {
    MACHINE: { kind: 'MACHINE', tr: 'Makine', plural: 'Makineler', auditTypes: ['MACHINE'], taskSource: null, docEntity: 'MACHINE', gate: null,
        tabs: [T('genel', 'Genel'), T('canli', 'Canlı operasyon'), T('ariza', 'Arıza & bakım'), T('performans', 'Performans'), ...COMMON] },
    WORK_ORDER: { kind: 'WORK_ORDER', tr: 'İş emri', plural: 'İş emirleri', auditTypes: ['WORK_ORDER'], taskSource: 'WORK_ORDER', docEntity: 'WORK_ORDER', gate: null,
        tabs: [T('genel', 'Genel'), T('operasyonlar', 'Operasyonlar'), T('uretim', 'Üretim'), T('kalite', 'Kalite'), T('takim', 'Takım & ekipman'), TRACE_TAB, ...COMMON] },
    PRODUCT: { kind: 'PRODUCT', tr: 'Ürün', plural: 'Ürünler', auditTypes: ['PRODUCT', 'PRODUCT_REVISION', 'CAM_PROGRAM'], taskSource: null, docEntity: null, gate: null,
        tabs: [T('genel', 'Genel'), T('revizyonlar', 'Revizyonlar & CAM'), T('uretim', 'Üretim geçmişi'), T('kalite', 'Kalite'), TRACE_TAB, ...COMMON] },
    PERSONNEL: { kind: 'PERSONNEL', tr: 'Personel', plural: 'Personel', auditTypes: ['PERSONNEL'], taskSource: null, docEntity: null, personal: true,
        gate: { any: ['PERSONNEL_MANAGE', 'COMPETENCY_APPROVE', 'ACADEMY_MANAGE', 'PERSONNEL_LOGIN_LINK'], roles: ['ADMIN', 'MANAGEMENT'] },
        tabs: [T('genel', 'Genel'), T('yetkinlik', 'Yetkinlik & eğitim'), T('rozetler', 'Rozetler'), T('aktif', 'Aktif görevler'), T('zaman', 'Zaman çizelgesi')] },
    TOOL: { kind: 'TOOL', tr: 'Takım', plural: 'Takımlar', auditTypes: ['TOOL'], taskSource: null, docEntity: 'TOOL', gate: null,
        tabs: [T('genel', 'Teknik kimlik'), T('kullanim', 'Kullanım geçmişi'), T('omur', 'Takım ömrü'), T('hareket', 'Stok & hareket'), ...COMMON] },
    MAINTENANCE_TICKET: { kind: 'MAINTENANCE_TICKET', tr: 'Bakım / arıza kaydı', plural: 'Bakım kayıtları', auditTypes: ['MAINTENANCE_TICKET'], taskSource: 'MAINTENANCE_TICKET', docEntity: null, gate: null,
        tabs: [T('genel', 'Genel'), T('test', 'Test sonuçları'), T('zaman', 'Zaman çizelgesi')] },
    CUSTOMER: { kind: 'CUSTOMER', tr: 'Müşteri', plural: 'Müşteriler', auditTypes: ['CUSTOMER'], taskSource: null, docEntity: null,
        gate: { any: ['ORDER_CREATE', 'ORDER_CONFIRM', 'COMMERCIAL_RELEASE', 'MANAGEMENT_RELEASE', 'ACCOUNTING_MUTATION', 'SHIPMENT_MANAGE', 'CUSTOMER_MANAGE', 'CUSTOMER_CONTACT_VIEW'], roles: ['ADMIN', 'MANAGEMENT'] },
        tabs: [T('genel', 'Genel'), T('kisiler', 'Kişiler'), T('sartlar', 'Şartlar & teslimat'), T('siparisler', 'Siparişler'), T('sevkiyat', 'Sevkiyat'), ...COMMON] },
    ORDER: { kind: 'ORDER', tr: 'Sipariş', plural: 'Siparişler', auditTypes: ['ORDER'], taskSource: 'ORDER', docEntity: 'ORDER',
        gate: { any: ['ORDER_CREATE', 'ORDER_CONFIRM', 'WORK_ORDER_CREATE', 'COMMERCIAL_RELEASE', 'MANAGEMENT_RELEASE', 'ACCOUNTING_MUTATION', 'SHIPMENT_MANAGE'], roles: ['ADMIN', 'MANAGEMENT'] },
        tabs: [T('genel', 'Genel'), T('kalemler', 'Kalemler & iş emirleri'), ...COMMON] },
    STOCK_LOT: { kind: 'STOCK_LOT', tr: 'Stok partisi', plural: 'Partiler', auditTypes: ['STOCK_LOT'], taskSource: null, docEntity: 'STOCK_LOT', gate: null,
        tabs: [T('genel', 'Genel'), T('hareket', 'Stok hareketleri'), T('sevkiyat', 'Ticari onay & sevkiyat'), TRACE_TAB, ...COMMON] },
    SUPPLIER: { kind: 'SUPPLIER', tr: 'Tedarikçi', plural: 'Tedarikçiler', auditTypes: ['SUPPLIER'], taskSource: null, docEntity: null,
        gate: { any: ['PURCHASE_ORDER_MANAGE', 'PURCHASING_APPROVE', 'WAREHOUSE_RECORD', 'ACCOUNTING_MUTATION'], roles: ['ADMIN', 'MANAGEMENT'] },
        tabs: [T('genel', 'Genel'), T('zaman', 'Zaman çizelgesi')] },
    QUALITY_NCR: { kind: 'QUALITY_NCR', tr: 'Uygunsuzluk (NCR)', plural: 'Uygunsuzluklar', auditTypes: ['QUALITY_NCR'], taskSource: 'QUALITY_NCR', docEntity: 'NCR', gate: null,
        tabs: [T('genel', 'Genel'), T('zaman', 'Zaman çizelgesi'), T('belgeler', 'Belgeler')] },
    SHIPMENT: { kind: 'SHIPMENT', tr: 'Sevkiyat', plural: 'Sevkiyatlar', auditTypes: ['SHIPMENT'], taskSource: 'SHIPMENT', docEntity: 'SHIPMENT',
        gate: { any: ['SHIPMENT_MANAGE', 'COMMERCIAL_RELEASE', 'MANAGEMENT_RELEASE'], roles: ['ADMIN', 'MANAGEMENT'] },
        tabs: [T('genel', 'Genel'), ...COMMON] },
    TASK: { kind: 'TASK', tr: 'Görev', plural: 'Görevler', auditTypes: ['TASK'], taskSource: null, docEntity: null, gate: null,
        tabs: [T('genel', 'Genel'), T('zaman', 'Zaman çizelgesi')] },
};
export const KIND_CODES = Object.keys(KINDS);
export const isKind = (v) => !!v && KIND_CODES.includes(v);
/** First-line gate. `ownPersonnel` = the record belongs to the signed-in user (a person may always open their own passport). */
export function canOpenPassport(kind, a, ownPersonnel = false) {
    const def = KINDS[kind];
    if (def.personal && ownPersonnel)
        return true;
    if (!def.gate)
        return true;
    const rule = def.gate;
    if ((rule.roles ?? []).some((r) => a.roles.includes(r)))
        return true;
    return (rule.any ?? []).some((x) => a.actions.includes(x));
}
/** Where an old /pasaport target lives now (the traceability tab of the canonical passport). */
export const canonicalHref = (legacyKind, id, tab = TRACE_TAB.key) => passportHref(LEGACY_TO_CANONICAL[legacyKind], id, tab);
export const passportHref = (kind, id, tab) => `#/nesne?t=${kind}&id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;
/** Map a universal-search / board record type to a passport kind (types without a passport stay on their own screen). */
export const SEARCH_TYPE_TO_KIND = { MACHINE: 'MACHINE', WORK_ORDER: 'WORK_ORDER', PRODUCT: 'PRODUCT', CUSTOMER: 'CUSTOMER', ORDER: 'ORDER', SHIPMENT: 'SHIPMENT', SUPPLIER: 'SUPPLIER', QUALITY_NCR: 'QUALITY_NCR', TASK: 'TASK', MAINTENANCE_TICKET: 'MAINTENANCE_TICKET', STOCK_LOT: 'STOCK_LOT', TOOL: 'TOOL' };
export { canOpen };
