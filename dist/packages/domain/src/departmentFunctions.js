const A = (label, path, href) => ({ label, state: 'AVAILABLE', path, ...(href ? { href } : {}) });
const P = (label, path, note, pkg) => ({ label, state: 'PARTIAL', path, note, ...(pkg ? { pkg } : {}) });
const L = (label, note, pkg) => ({ label, state: 'PLANNED', note, ...(pkg ? { pkg } : {}) });
const B = (label, note, pkg) => ({ label, state: 'BLOCKED', note, ...(pkg ? { pkg } : {}) });
/** workspace id (nav.ts) → function list. Departments without a list show only their real pages (and a note that the map is not complete). */
export const DEPT_FUNCTIONS = {
    prod: [
        A('Üretim Ana Ekranı', '/uretim'),
        A('Aktif Üretim', '/uretim'),
        A('İş Emirlerim', '/operator'),
        P('Makine Parkı', '/komuta', 'Makine parkı yalnız Performance Center’da yaşar (ikinci bir park kopyalanmaz).', 'KMI-031'),
        A('Shop Floor Live', '/terminal'),
        P('Adet ve Hurda', '/terminal', 'Sağlam / hurda sayacı terminalde; TAHSİS sayacı ve ayrı sayfa planlı.', 'KMI-034'),
        P('Duruşlar', '/terminal', 'DURUŞ kaydı terminalde; duruş geçmişi/analiz sayfası planlı.', 'KMI-035'),
        P('Takım Olayları', '/operator', 'Takım olayı Benim İşlerim’den girilir; ayrı sayfa planlı.', 'KMI-028'),
        P('Vardiya Devri', '/operator', 'Vardiya özeti ve onayı Benim İşlerim’de; devir sayfası planlı.', 'KMI-036'),
        A('Kaliteye Gönder', '/terminal'),
        P('Üretim Geçmişi', '/gecmis', 'Genel olay geçmişi var; üretime özel geçmiş sayfası planlı.', 'KMI-037'),
        A('Üretim Analitiği', '/departman', '?d=prod&v=analitik'),
    ],
    order: [
        P('Müşteri ve ilişki yönetimi (liste · profil · kişiler · şartlar · teslimat)', '/musteriler', 'Sunucu güncellemesi 0096 production onayı bekliyor; uygulanana kadar ekran “Kurulum bekleniyor” der. Kârlılık KMI-070 gerektirir.', 'KMI-006'),
        P('Teklif ve talep yönetimi (RFQ · fizibilite · teklif · revizyon · onay · siparişe dönüşüm)', '/teklifler', 'Sunucu güncellemesi 0103 production onayı bekliyor; uygulanana kadar ekran “Kurulum bekleniyor” der. Gerçekleşen maliyet karşılaştırması KMI-070 gerektirir.', 'KMI-007'),
        A('Siparişler', '/siparisler'),
        A('Katalog (müşteri · tedarikçi · ürün)', '/katalog'),
    ],
    plan: [
        A('Açık siparişlerden üretim ihtiyacı', '/planlama'),
        A('İş emri oluşturma ve yönetme', '/is-emirleri'),
        A('Makine ve vardiya ataması', '/planlama'),
        P('Operatör ataması', '/planlama', 'Atama gerekçesi ve denetim izi zincir içinde henüz görünmüyor.', 'KMI-014'),
        P('Makine uygunluğu ve bakım durumu', '/bakim', 'Uygunluk atamada kontrol edilir; planlama ekranında birleşik görünüm planlı.', 'KMI-014'),
        A('Routing / operasyon sırası', '/rota'),
        P('Malzeme ve takım hazırlığı', '/is-emirleri', 'Hazırlık durumu iş emri merkezinde; planlama ekranında özet planlı.', 'KMI-016'),
        A('Termin ve kapasite görünümü', '/planlama'),
    ],
    qc: [
        A('Karar kuyruğu (ilk parça, HOLD, NCR, gelen kontrol, final)', '/kalite'),
        A('İlk parça kararı', '/kalite'),
        A('Quality HOLD ve serbest bırakma', '/kalite'),
        A('TAHSİS (ölçü düzeltme)', '/tahsis'),
        L('İlk parça ölçüm girişi', 'Ölçüm değerlerini girip karar veren ekran planlı; bugün karar kuyruğundan verilir.', 'KMI-040'),
        L('Proses içi kontrol (in-process)', 'Planlı; bugün üretim operasyonundan kalite kararına geçilir.', 'KMI-041'),
    ],
    tool: [
        A('Takım envanteri ve konum', '/takimhane'),
        A('Takım ver / al / makineye tak', '/takimhane'),
        L('Takım montajı (montaj istasyonu)', 'Planlı; bugün yalnız makineye tak / çıkar var.', 'KMI-025'),
        L('Preset (takım boyu ölçümü)', 'Planlı; ölçüm cihazı verisi ve kayıt modeli yok.', 'KMI-026'),
        B('LockCell entegrasyonu', 'Cihaz protokolü ve kanıtı yok; sahte bağlantı gösterilmez.', 'KMI-027'),
    ],
    cam: [
        A('CAM / Programlama', '/muhendislik'),
        A('Routing / operasyon rotası', '/rota'),
        P('NC program yönetimi', '/muhendislik', 'Program kaydı ve yayın onayı var; revizyon karşılaştırma ve dosya yedeği planlı.', 'KMI-019'),
        L('CAM kokpiti (özet ekran)', 'Planlı; bugün işlevler Programlama ekranında.', 'KMI-018'),
        L('Setup ve iş talimatı', 'Planlı; kurulum föyü ve talimat sayfası yok.', 'KMI-020'),
        L('Fikstür ve aparat yönetimi', 'Planlı; fikstür envanteri yok.', 'KMI-021'),
        L('CAM–Takımhane hazırlığı', 'Planlı; program için takım listesi onayı henüz birleşik değil.', 'KMI-022'),
    ],
    maint: [
        A('Bakım ekranı (arıza kayıtları, bilet akışı)', '/bakim'),
        P('Arıza bildirimi', '/bakim', 'Operatör terminalinden ve makine pasaportundan bildirilir; bakım ekranında liste var, ayrı bildirim sayfası planlı.', 'KMI-048'),
        P('Bakım iş emri', '/bakim', 'Bilet akışı var; iş emri planı ve parça tüketimi planlı.', 'KMI-049'),
        A('Yetkili test ve servise dönüş', '/bakim'),
        L('Önleyici bakım takvimi ve analitik', 'Planlı; periyodik bakım planı yok.', 'KMI-051'),
        L('Bakım kokpiti (özet ekran)', 'Planlı.', 'KMI-047'),
    ],
    wh: [
        A('Stok ve lotlar', '/depo'),
        P('Canonical stok hareketleri', '/depo', 'Hareket kaydı var; tam defter ve ayrıştırılmış görünüm planlı.', 'KMI-057'),
        L('Lokasyon, LOT ve sayım', 'Planlı; sayım ve raf lokasyonu yok.', 'KMI-058'),
        L('Üretime çıkış ve WIP', 'Planlı; ara stok izleme yok.', 'KMI-059'),
        L('Bitmiş ürün deposu', 'Planlı.', 'KMI-060'),
        L('Depo kokpiti (özet ekran)', 'Planlı.', 'KMI-056'),
    ],
    buy: [
        A('Satınalma ve mal kabul', '/satinalma'),
        A('Satınalma talepleri', '/talepler'),
        P('PO ve tedarikçi yönetimi', '/satinalma', 'PO ve onay var; tedarikçi performansı planlı.', 'KMI-054'),
        P('Mal kabul', '/satinalma', 'Mal kabul kaydı var; giriş kalite kontrol bağlantısı planlı.', 'KMI-055'),
        L('Talep ve RFQ (teklif toplama)', 'Planlı; teklif karşılaştırma yok.', 'KMI-053'),
        L('Satınalma kokpiti (özet ekran)', 'Planlı.', 'KMI-052'),
    ],
    ship: [
        A('Sevkiyat ve lojistik', '/sevkiyat'),
        P('Sevkiyat hazırlığı', '/sevkiyat', 'Hazırlık durumu ekranda; kontrol listesi planlı.', 'KMI-062'),
        P('İrsaliye ve sevkiyat kaydı', '/sevkiyat', 'Kayıt var; belge basımı ve dış entegrasyon planlı.', 'KMI-063'),
        L('Teslimat yükümlülüğü takibi', 'Planlı.', 'KMI-064'),
        L('Sevkiyat kokpiti (özet ekran)', 'Planlı.', 'KMI-061'),
    ],
    fin: [
        A('Alacaklar ve muhasebe', '/alacaklar'),
        A('Muhasebe kuyruğu', '/onay-kuyrugu'),
        P('Maliyet zekâsı', '/maliyet', 'Ekonomik yetki doğrulaması tamamlanmadı; veri yalnız açıkça yetkili kişide görünür.', 'KMI-070'),
        P('Ekonomi ve kararlar', '/ekonomi', 'Yalnız ekonomik sahip/yetkili; yetkilendirme kapısı açık.', 'KMI-070'),
        P('Fatura ve cari işlemler', '/alacaklar', 'Fatura ve alacak var; cari ekstre ve tahsilat akışı planlı.', 'KMI-066'),
        L('Muhasebe defteri ve dönem kapanışı', 'Planlı.', 'KMI-067'),
    ],
    hr: [
        A('Personel', '/personel'),
        A('Puantaj ve prim havuzu', '/puantaj'),
        A('Giriş-çıkış (GEÇKO)', '/giris-cikis'),
        A('KMI Academy', '/akademi'),
        A('Zirvedekiler', '/zirvedekiler'),
        A('Personel erişimi', '/personel-yetki'),
        P('Personel ve yetkinlik pasaportu', '/personel', 'Pasaport var; yetkinlik matrisi ve onay akışı kısmen.', 'KMI-071'),
        L('Akıllı atama (Smart Assignment)', 'Planlı; bugün atama elle yapılır.', 'KMI-076'),
        B('Operatör Sicil No + PIN girişi', 'Sunucu giriş fonksiyonu yayınlanmadı; güvenlik kapıları (G1–G5) kapanmadan açılmaz.', 'KMI-083'),
    ],
    intel: [
        A('KMI Zekâ', '/zeka'),
        A('Raporlama', '/raporlar'),
        A('Dokümanlar', '/dokumanlar'),
        A('Olay geçmişi', '/gecmis'),
        P('Yönetim komuta merkezi', '/yonetim', 'Kararlar ekranı var; birleşik yönetim komuta merkezi planlı.', 'KMI-068'),
        P('Yönetim onay merkezi', '/onaylar', 'Onay kutusu var; yönetim bakışı ve toplu karar planlı.', 'KMI-069'),
        L('PULSE ve istisna merkezi', 'Planlı; bugün uyarılar Ana Sayfa ve Bildirimler’de.', 'KMI-079'),
        L('Factory Intelligence', 'Planlı; yapay zekâ analizi yok, uydurulmaz.', 'KMI-084'),
    ],
};
export function resolveFunctions(wsId, canOpen) {
    const list = DEPT_FUNCTIONS[wsId];
    if (!list)
        return null;
    return list.map((f) => {
        if (!f.path)
            return { ...f, link: null, forbidden: false };
        const ok = f.path === '/departman' || canOpen(f.path);
        return { ...f, link: ok ? `#${f.path}${f.href ?? ''}` : null, forbidden: !ok };
    });
}
export const FUNCTION_STATE_TR = { AVAILABLE: 'Açık', PARTIAL: 'Kısmi', PLANNED: 'Planlandı', BLOCKED: 'Engelli' };
export const LIVE_VERIFIED_PATHS = new Set(['/', '/gorevler', '/onaylar', '/ara']);
export function functionMaturity(f, liveVerified = LIVE_VERIFIED_PATHS) {
    if (f.state === 'PLANNED' || f.state === 'BLOCKED' || !f.path)
        return { screen: false, backend: false, authz: false, workflow: false, live: 'NOT_APPLICABLE' };
    const live = liveVerified.has(f.path) ? 'VERIFIED' : 'PENDING';
    return f.state === 'AVAILABLE' ? { screen: true, backend: true, authz: true, workflow: true, live } : { screen: true, backend: true, authz: true, workflow: false, live };
}
/** the label shown for a function: a state may only claim "Açık" when the four build facts hold; an incomplete flow is never labelled open */
export function functionStateOf(f) {
    const m = functionMaturity(f);
    if (f.state === 'BLOCKED')
        return 'BLOCKED';
    if (!m.screen)
        return 'PLANNED';
    return m.backend && m.authz && m.workflow ? 'AVAILABLE' : 'PARTIAL';
}
export function liveLabelTr(m) {
    return m.live === 'VERIFIED' ? 'canlı doğrulandı' : m.live === 'PENDING' ? 'canlı doğrulama bekliyor' : null;
}
