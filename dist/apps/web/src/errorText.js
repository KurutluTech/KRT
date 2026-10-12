export const ACTION_TR = {
    ORDER_CONFIRM: 'sipariş onayı / durum değişikliği',
    ORDER_CANCEL: 'sipariş iptali',
    WORK_ORDER_ASSIGN_MACHINE: 'iş emrine makine / operatör atama',
    WORK_ORDER_MULTI_MACHINE_ASSIGN: 'çoklu makine yetkisi',
    FIRST_PIECE_APPROVE: 'ilk parça onayı',
    QUALITY_HOLD_RELEASE: 'kalite bekletmesini kaldırma',
    FINAL_PRODUCTION_RELEASE: 'nihai üretim serbest bırakma',
    MANAGEMENT_RELEASE: 'yönetim onayı',
    COMMERCIAL_RELEASE: 'ticari serbest bırakma',
    PURCHASING_APPROVE: 'satınalma onayı',
    ACCOUNTING_MUTATION: 'muhasebe kaydı',
    PRODUCTION_CORRECTION: 'üretim düzeltmesi',
    MAINTENANCE_TEST_RELEASE: 'bakım sonrası test onayı',
    QUALITY_REJECT: 'kalite ret / uygunsuzluk kararı',
    BOM_RELEASE: 'ürün reçetesi (BOM) yayınlama',
    READINESS_EXEMPTION_GRANT: 'malzeme / takım muafiyeti',
    LABEL_REPRINT: 'etiketi yeniden basma',
    GECKO_ATTENDANCE_VIEW: 'giriş-çıkış kayıtlarını görme',
    GECKO_MAPPING_VERIFY: 'GEÇKO kart eşleştirme',
    GECKO_SYNC_RUN: 'GEÇKO aktarımı',
    GECKO_VIEW_GRANT: 'giriş-çıkış görme yetkisi verme',
    COMPETENCY_APPROVE: 'yetkinlik onayı',
    ACADEMY_MANAGE: 'akademi yönetimi',
    PERSONNEL_LOGIN_LINK: 'personel hesabı bağlama',
    PUANTAJ_MANAGE: 'puantaj ve prim yönetimi',
    DOCUMENT_MANAGE: 'doküman yönetimi',
    ROUTING_MANAGE: 'rota tanımlama',
    OPERATION_QC_RECORD: 'operasyon kalite kaydı',
    MACHINE_SKILL_VERIFY: 'makine yetkinlik şartı',
    REPORT_SCHEDULE_MANAGE: 'rapor zamanlama',
    LIVE_DISPLAY_MANAGE: 'fabrika ekranı yönetimi',
    DEVICE_MANAGE: 'cihaz kaydı',
    PERSONNEL_MANAGE: 'personel kaydı',
    ORDER_CREATE: 'sipariş açma',
    WORK_ORDER_CREATE: 'iş emri açma',
    PURCHASE_ORDER_MANAGE: 'satınalma siparişi',
    MASTER_DATA_IMPORT: 'ana veri içe aktarma',
    TASK_MANAGE: 'görev atama / onaylama',
    WAREHOUSE_RECORD: 'depo / stok kaydı',
    MATERIAL_ISSUE: 'malzeme çıkışı',
    SHIPMENT_MANAGE: 'sevkiyat',
    TOOL_RECORD: 'takım hareketi',
    ECONOMIC_OWNER_ONLY: 'ekonomik bilgi (yalnız sahip ve yetkilendirdikleri)',
    OWNER_ONLY: 'yalnız sahip',
    PRODUCTION_DECLARE: 'üretim beyanı (yalnız atanan operatör veya planlama yetkilisi)',
};
// cross-cutting business refusals introduced with the release hardening (screen-specific texts stay in the screens)
const BUSINESS_TR = [
    [/^APPROVER_NOT_LINKED$/, 'Onay verebilmek için giriş hesabınız bir personel kaydına bağlı olmalı. Yöneticinize başvurun.'],
    [/^SHIPPING_STATUS_IS_DERIVED$/, 'Sevkiyat durumu elle değiştirilmez; sevk edilen partilerden otomatik belirlenir.'],
    [/^OVER_SHIPMENT/, 'Sipariş miktarından fazla sevk edilemez.'],
    [/Invalid schema|PGRST106|schema must be one of/i, 'Sunucu ayarı eksik: veri şeması (kmi_next) Supabase API ayarında açık değil. Sistem yöneticisine bildirin; bu bir kullanıcı hatası değildir.'],
];
export const SETUP_PENDING_TR = 'Kurulum bekleniyor: bu bölümün veritabanı kurulumu henüz yapılmadı. Mevcut kayıtlarınız etkilenmedi; kurulum tamamlanınca bu bölüm açılır.';
export function humanError(raw) {
    if (/Could not find the function|PGRST202|PGRST205|schema cache|unknown rpc/i.test(raw))
        return SETUP_PENDING_TR;
    const b = BUSINESS_TR.find(([re]) => re.test(raw.trim()));
    if (b)
        return `${b[1]} [${raw.trim()}]`;
    const m = /^(?:FORBIDDEN|NOT_AUTHORIZED): ([A-Z0-9_]+)$/.exec(raw.trim()) ?? /^FORBIDDEN: .* requires authorization for ([A-Z0-9_]+)$/.exec(raw.trim());
    if (m) {
        const key = m[1];
        const label = ACTION_TR[key] ?? key.toLowerCase().replace(/_/g, ' ');
        return `Bu işlem için yetkiniz yok: ${label}. Yetki için yöneticinize başvurun. [${raw.trim()}]`;
    }
    if (raw === 'UNAUTHENTICATED')
        return 'Oturumunuz kapanmış. Lütfen yeniden giriş yapın. [UNAUTHENTICATED]';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(raw))
        return 'Sunucuya ulaşılamadı. Bağlantıyı kontrol edip tekrar deneyin.';
    return raw;
}
export function errorText(err) {
    return humanError(err instanceof Error ? err.message : String(err));
}
/** True when the backend piece a screen needs is not installed yet (RPC/table/column missing), as opposed to a real failure.
 *  The screen then shows "Kurulum bekleniyor" instead of a broken page. Duck-typed on PostgrestError (status/code/message). */
export function isSetupPending(err) {
    const e = err;
    if (!e || typeof e !== 'object')
        return false;
    const msg = String(e.message ?? '');
    if (e.code === 'PGRST202' || e.code === '42883' || e.code === '42P01' || e.code === '42703')
        return true;
    return /Could not find the function|does not exist|unknown rpc|schema cache/i.test(msg) || (e.status === 404 && /function|rpc/i.test(msg));
}
