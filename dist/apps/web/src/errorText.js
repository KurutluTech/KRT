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
    CUSTOMER_MANAGE: 'müşteri kaydı',
    CUSTOMER_CONTACT_VIEW: 'müşteri kişileri',
    QUOTE_PREPARE: 'teklif hazırlama / müşteriye gönderme / siparişe dönüştürme',
    QUOTE_TECH: 'teknik fizibilite ve operasyon planı',
    QUOTE_VIEW: 'teklifleri görme',
    QUOTE_APPROVE: 'teklif onayı',
    ORDER_CREATE: 'sipariş açma',
    WORK_ORDER_CREATE: 'iş emri açma',
    PURCHASE_ORDER_MANAGE: 'satınalma siparişi',
    MASTER_DATA_IMPORT: 'ana veri içe aktarma',
    TASK_MANAGE: 'görev atama / onaylama',
    MANAGEMENT_VIEW: 'yönetim zekâsı verilerini görme',
    STRATEGY_MANAGE: 'strateji ve hedef yönetimi',
    RISK_MANAGE: 'risk kaydı yönetimi',
    MEETING_MANAGE: 'toplantı ve karar kaydı',
    ACCESS_DENY_MANAGE: 'kişi bazlı yetki engelleme (DENY)',
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
    [/^ALREADY_DECIDED/, 'Bu kayıt için karar zaten verilmiş (başka biri onaylamış veya reddetmiş olabilir). Liste yenilendi; çift onay yapılmaz.'],
    [/^MANAGEMENT_RELEASE_MISSING$/, 'Ticari onay verilemez: önce yönetim serbest bırakması gerekir.'],
    [/^MANAGEMENT_RELEASE_ALREADY_GIVEN$/, 'Yönetim serbest bırakması bu talep için zaten verilmiş.'],
    [/^SELF_APPROVAL_FORBIDDEN$/, 'Kendi tamamladığınız görevi kendiniz onaylayamazsınız.'],
    [/^(?:REASON_REQUIRED|NOTE_REQUIRED|REJECT_REASON_REQUIRED|TEST_NOTES_REQUIRED)$/, 'Gerekçe zorunludur (en az 5 karakter; boşluk ve görünmez karakterler sayılmaz). Hiçbir kayıt değişmedi.'],
    [/^ILLEGAL_TRANSITION|^ILLEGAL_TASK_TRANSITION|^APPROVAL_REQUIRES_SUBMITTED_STATUS/, 'Kaydın durumu bu işleme uygun değil (başka biri değiştirmiş olabilir). Liste yenilendi.'],
    [/^SHIPPING_STATUS_IS_DERIVED$/, 'Sevkiyat durumu elle değiştirilmez; sevk edilen partilerden otomatik belirlenir.'],
    [/^OVER_SHIPMENT/, 'Sipariş miktarından fazla sevk edilemez.'],
    [/^(?:REVISION_FROZEN|QUOTE_NOT_EDITABLE)/, 'Bu teklif revizyonu gönderildiği için değiştirilemez. Değişiklik için “Yeni revizyon” açın; eski revizyon aynen saklanır.'],
    [/^SELF_APPROVAL_REFUSED/, 'Teklifi gönderen kişi kendi teklifini onaylayamaz; ikinci bir yetkili onaylamalıdır. (Yönetici hesabı, en az 10 karakterlik gerekçeyle kendi teklifini onaylayabilir.)'],
    [/^UNKNOWN_COST_ACK_REQUIRED/, 'Bu teklifte maliyeti bilinmeyen kalemler var. Onay için “maliyet bilinmiyor” kutusunu açıkça işaretleyin.'],
    [/^BELOW_MARGIN_REASON_REQUIRED/, 'Fiyat asgari marjın altında; fiyat gerekçesi zorunludur.'],
    [/^(?:NOT_APPROVED|NOT_CONVERTIBLE|REVISION_NOT_APPROVED|NOT_SENT)/, 'Teklif siparişe dönüştürülebilmesi için önce onaylanmış olmalıdır; müşteri yanıtı da kaydedilmelidir.'],
    [/^PRODUCT_REQUIRED/, 'Siparişe dönüştürmeden önce her kalem bir ürüne bağlanmalıdır.'],
    [/^QUOTE_EXPIRED/, 'Teklifin geçerlilik süresi dolmuş. Yeni revizyonla süreyi güncelleyin.'],
    [/^DUPLICATE_CUSTOMER_PO/, 'Bu müşteri için aynı sipariş numarası (PO) zaten kullanılmış.'],
    [/^CUSTOMER_PO_REQUIRED/, 'Müşteri sipariş numarası (PO) zorunludur.'],
    [/^PRICE_MISSING/, 'Her miktar kademesi için fiyat girilmelidir. Fiyat bilinmiyorsa teklif gönderilemez.'],
    [/^COST_UNKNOWN/, 'Maliyet henüz hesaplanamadı (eksik veri var). Önce eksikleri tamamlayıp maliyeti hesaplayın.'],
    [/^FEASIBILITY_REQUIRED|^NOTHING_TO_QUOTE/, 'Teklif için her kalemin teknik fizibilitesi yapılmış ve en az biri üretilebilir olmalıdır.'],
    [/^DUE_DATE_REQUIRED/, 'Termin tahmini olmayan kalem için teslim tarihini elle girin veya önce termini hesaplayın.'],
    [/^RFQ_ALREADY_QUOTED|^RFQ_HAS_LIVE_QUOTE/, 'Bu talep için zaten açık bir teklif var.'],
    [/^(?:RFQ_CLOSED|RFQ_NOT_OPEN)/, 'Bu talep kapalı; değiştirilemez.'],
    [/^ALREADY_CONVERTED/, 'Bu teklif zaten siparişe dönüştürülmüş; ikinci sipariş açılmaz.'],
    [/^(?:NOT_PENDING_APPROVAL)/, 'Teklif onay beklemiyor (başka biri karar vermiş olabilir). Sayfa yenilendi.'],
    [/^SUMMARY_REQUIRED/, 'Fizibilite özeti zorunludur: hangi operasyonlar ve hangi makineler gerekir, kısaca yazın.'],
    [/^RISK_NOTE_REQUIRED/, 'Şartlı veya üretilemez kararında riskin ne olduğu yazılmalıdır.'],
    [/^TITLE_REQUIRED/, 'Talep başlığı zorunludur.'],
    [/^PART_NAME_REQUIRED/, 'Her kalem için parça adı zorunludur.'],
    [/^QTY_TIERS_INVALID|^QTY_NOT_A_QUOTED_TIER/, 'Miktarlar sıfırdan büyük sayılar olmalı ve teklifteki kademelerden biri olmalıdır (örn. 10, 100, 500).'],
    [/^CUSTOMER_NOT_FOUND/, 'Müşteri seçilmelidir.'],
    [/^(?:RECEIVED_ON_REQUIRED|RESPOND_BY_BEFORE_RECEIVED)/, 'Alındığı tarih zorunludur; cevap tarihi alındığı tarihten önce olamaz.'],
    [/^(?:PRODUCT_NOT_FOUND|REVISION_PRODUCT_MISMATCH|PRODUCT_ALREADY_LINKED)/, 'Ürün seçimi geçersiz veya kalem zaten bir ürüne bağlı.'],
    [/^(?:UNIT_PRICE_REQUIRED|MARGIN_INVALID|BASIS_INVALID)/, 'Fiyat için birim fiyat (elle) veya marj yüzdesi (maliyet+marj) geçerli sayı olmalıdır.'],
    [/^(?:LINES_REQUIRED|NO_LINES)/, 'Önce en az bir kalem ekleyin.'],
    [/^(?:DESCRIPTION_REQUIRED)/, 'Kalem açıklaması zorunludur.'],
    [/^(?:VALID_UNTIL_INVALID)/, 'Geçerlilik tarihi bugünden sonra olmalıdır.'],
    [/^(?:OPS_INVALID|MACHINE_NOT_FOUND)/, 'Operasyon planı geçersiz: her satırda ad ve geçerli bir makine olmalı, süreler sayı olmalıdır.'],
    [/^(?:SELECTION_REQUIRED|LINE_NOT_IN_QUOTE|LINE_SELECTED_TWICE)/, 'Dönüştürülecek kalemleri ve miktarlarını seçin (her kalem en fazla bir kez).'],
    [/^CHANGE_REASON_REQUIRED/, 'Revizyon nedeni zorunludur (en az 5 karakter).'],
    [/^(?:TIER_NOT_PRICED)/, 'Seçilen miktar kademesinin fiyatı girilmemiş.'],
    [/^NOTHING_TO_CHANGE/, 'Değişiklik yok: adet, termin veya fiyat mevcut değerle aynı.'],
    [/^QTY_BELOW_SHIPPED/, 'Adet, şimdiye kadar sevk edilen miktarın altına düşürülemez.'],
    [/^QTY_BELOW_COMMITTED/, 'Adet, üretilen miktar ile açık iş emirlerinin toplamının altına düşürülemez. Önce ilgili iş emrini iptal edin veya tamamlayın.'],
    [/^QTY_MUST_BE_POSITIVE/, 'Adet sıfırdan büyük olmalıdır.'],
    [/^DUE_DATE_IN_PAST/, 'Onaylı siparişte termin geçmiş bir tarihe alınamaz.'],
    [/^UNIT_PRICE_INVALID/, 'Birim fiyat geçerli bir sayı olmalıdır.'],
    [/^ORDER_NOT_EDITABLE/, 'Bu siparişin durumu değişikliğe uygun değil (iptal, kapalı veya sevk edilmiş).'],
    [/^ORDER_ITEM_NOT_FOUND|^ORDER_NOT_FOUND/, 'Sipariş veya kalem bulunamadı (silinmiş olabilir). Liste yenilendi.'],
    [/^NOT_PRINTABLE/, 'İptal edilmiş sipariş için sipariş onayı basılamaz.'],
    [/^FORBIDDEN: ECONOMIC_ACCESS/, 'Fiyat değişikliği için ekonomik bilgi yetkisi gerekir (yalnız sahip ve yetkilendirdikleri).'],
    [/Invalid schema|PGRST106|schema must be one of/i, 'Sunucu ayarı eksik: veri şeması (kmi_next) Supabase API ayarında açık değil. Sistem yöneticisine bildirin; bu bir kullanıcı hatası değildir.'],
];
export const SETUP_PENDING_TR = 'Kurulum bekleniyor: bu bölümün veritabanı kurulumu henüz yapılmadı. Mevcut kayıtlarınız etkilenmedi; kurulum tamamlanınca bu bölüm açılır.';
export function humanError(raw) {
    if (/Could not find the function|PGRST202|PGRST205|schema cache|unknown rpc/i.test(raw))
        return SETUP_PENDING_TR;
    if (/^REFRESH_UNAVAILABLE$/.test(raw.trim()))
        return 'Oturum yenilenemedi (bağlantı sorunu). Oturumunuz açık kalır — birkaç saniye sonra tekrar deneyin. [REFRESH_UNAVAILABLE]';
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
