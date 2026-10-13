const D = (path, label, query = '') => ({ path, href: `#${path}${query}`, label });
const SERVER = 'Sunucu hesabı; girdi eksikse BİLİNMİYOR (0 gösterilmez)';
const LIVE = 'Canlı kayıt sayımı; kaynak okunamazsa OKUNAMADI';
export const KPI_CATALOG = {
    // ---- Onaylar
    'ap-kpi-total': { source: 'commercial_approvals · purchase_requests · purchase_orders · görevler (bekleyen)', definition: 'Karar bekleyen kayıt sayısı (tüm kaynaklar, mevcut onay süreçleri)', drill: D('/yonetim', 'Onaylar', '?sekme=onaylar'), quality: LIVE },
    'ap-kpi-overdue': { source: 'Onaylar kuyruğu', definition: 'İstenen tarihi geçmiş veya ≥72 saattir bekleyen onay', drill: D('/yonetim', 'Geciken onaylar', '?sekme=onaylar'), quality: 'Talep zamanı kayıtta yoksa gecikme TAHMİN EDİLMEZ (BİLİNMİYOR)' },
    'ap-kpi-critical': { source: 'Onaylar kuyruğu', definition: 'Öncelik KRİTİK: ≥72 sa bekleyen veya istenen tarihi geçen', drill: D('/yonetim', 'Onaylar', '?sekme=onaylar'), quality: LIVE },
    'ap-kpi-high': { source: 'Onaylar kuyruğu', definition: 'Öncelik YÜKSEK: ≥24 sa bekleyen veya istenen tarihe ≤3 gün', drill: D('/yonetim', 'Onaylar', '?sekme=onaylar'), quality: LIVE },
    'ap-kpi-longest': { source: 'Onaylar kuyruğu', definition: 'Bekleyen en eski kaydın bekleme süresi (talep zamanından şimdiye)', drill: D('/yonetim', 'Onaylar', '?sekme=onaylar'), quality: 'Talep zamanı bilinmeyen kayıt hesaba katılmaz' },
    // ---- Özet (karar gerektirenler)
    'hm-n-approvals': { source: 'Onaylar kuyruğu', definition: 'Bekleyen onay sayısı', drill: D('/yonetim', 'Onaylar', '?sekme=onaylar'), quality: LIVE },
    'hm-n-critical-approvals': { source: 'Onaylar kuyruğu', definition: '≥72 sa bekleyen veya tarihi geçen onay', drill: D('/yonetim', 'Onaylar', '?sekme=onaylar'), quality: LIVE },
    'hm-n-critical-risks': { source: 'Risk kaydı (risks)', definition: 'Açık risk, skor = olasılık × etki ≥ 15', drill: D('/yonetim', 'Risk ve İyileştirme', '?sekme=risk'), quality: LIVE },
    'hm-n-late-risks': { source: 'Risk kaydı', definition: 'Gözden geçirme tarihi geçmiş açık risk', drill: D('/yonetim', 'Risk ve İyileştirme', '?sekme=risk'), quality: 'Gözden geçirme tarihi girilmemiş risk gecikmiş sayılmaz' },
    'hm-n-late-actions': { source: 'Strateji + risk aksiyonları', definition: 'Vadesi geçmiş, kapanmamış aksiyon', drill: D('/yonetim', 'Strateji ve Hedefler', '?sekme=strateji'), quality: 'Vadesi girilmemiş aksiyon gecikmiş sayılmaz' },
    'hm-n-late-decisions': { source: 'Toplantı kararları', definition: 'Vadesi geçmiş, kapanmamış toplantı kararı', drill: D('/yonetim', 'Toplantılar', '?sekme=toplanti'), quality: 'Vadesiz karar gecikmiş sayılmaz' },
    'hm-n-offtrack': { source: 'Strateji KPI okumaları', definition: 'Aktif hedefin KPI’ı: gerçekleşme/hedef oranı eşik altında (hedefin gerisinde)', drill: D('/yonetim', 'Strateji ve Hedefler', '?sekme=strateji'), quality: 'Okuması olmayan KPI “hedefin gerisinde” sayılmaz; “bilinmeyen” olarak ayrılır' },
    'hm-n-recs': { source: 'KMI Zekâ (kural tabanlı)', definition: 'Kurallarla üretilen açık öneri sayısı; öneri karar vermez', drill: D('/yonetim', 'KMI Zekâ', '?sekme=zeka'), quality: 'Kural girdisi okunamazsa öneri üretilmez ve OKUNAMADI yazılır' },
    // ---- Operasyon (özet + operasyonel sekme)
    'hm-oee': { source: 'oee_rollup (sunucu) / management_kpi_snapshot', definition: 'OEE = Kullanılabilirlik × Performans × Kalite (planlı süre, çalışma süresi, ideal çevrim, adet)', drill: D('/oee', 'OEE ekranı'), quality: SERVER },
    'op-oee': { source: 'oee_rollup (sunucu)', definition: 'OEE = Kullanılabilirlik × Performans × Kalite (planlı süre, çalışma süresi, ideal çevrim, adet)', drill: D('/oee', 'OEE ekranı'), quality: SERVER },
    'hm-otd': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Zamanında teslimat yüzdesi (dönem içinde teslim edilmesi gereken kalemlerden zamanında teslim edilenler)', drill: D('/siparisler', 'Siparişler'), quality: SERVER },
    'op-otd': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Zamanında teslimat yüzdesi (dönem içinde teslim edilmesi gereken kalemlerden zamanında teslim edilenler)', drill: D('/siparisler', 'Siparişler'), quality: SERVER },
    'hm-scrap': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Hurda oranı = hurda adet / (sağlam + hurda adet)', drill: D('/is-emirleri', 'İş emirleri'), quality: SERVER },
    'op-scrap': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Hurda oranı = hurda adet / (sağlam + hurda adet)', drill: D('/is-emirleri', 'İş emirleri'), quality: SERVER },
    'hm-ncr': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Kapanmamış uygunsuzluk (NCR) sayısı', drill: D('/kalite', 'Kalite'), quality: SERVER },
    'op-ncr': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Kapanmamış uygunsuzluk (NCR) sayısı', drill: D('/kalite', 'Kalite'), quality: SERVER },
    'hm-overdue-items': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Teslim tarihi geçmiş, tamamı sevk edilmemiş sipariş kalemi', drill: D('/siparisler', 'Siparişler'), quality: SERVER },
    'op-overdue': { source: 'management_kpi_snapshot (_mgmt_metric)', definition: 'Teslim tarihi geçmiş, tamamı sevk edilmemiş sipariş kalemi', drill: D('/siparisler', 'Siparişler'), quality: SERVER },
    // ---- Finans (ekonomik yetki gerekir)
    'hm-revenue': { source: 'economic_overview (sunucu)', definition: 'Dönem içindeki fatura toplamı; para birimleri ayrı, çevrilmez', drill: D('/ekonomi', 'Ekonomi'), quality: 'Fatura yoksa KAYIT YOK; kur çevrimi yapılmaz' },
    'fin-revenue': { source: 'economic_overview (sunucu)', definition: 'Dönem içindeki fatura toplamı; para birimleri ayrı, çevrilmez', drill: D('/ekonomi', 'Ekonomi'), quality: 'Fatura yoksa KAYIT YOK; kur çevrimi yapılmaz' },
    'hm-collections': { source: 'economic_overview (sunucu)', definition: 'Dönem içinde kaydedilmiş tahsilat toplamı', drill: D('/muhasebe', 'Muhasebe'), quality: 'Tahsilat kaydı yoksa KAYIT YOK' },
    'fin-collections': { source: 'economic_overview (sunucu)', definition: 'Dönem içinde kaydedilmiş tahsilat toplamı', drill: D('/muhasebe', 'Muhasebe'), quality: 'Tahsilat kaydı yoksa KAYIT YOK' },
    'hm-material': { source: 'economic_overview (sunucu)', definition: 'Dönemde iş emirlerine çıkan malzemenin kayıtlı maliyeti', drill: D('/maliyet', 'Maliyet Zekâsı'), quality: 'Birim maliyeti olmayan çıkış hesaba katılmaz (eksik maliyet işaretlenir)' },
    'fin-material': { source: 'economic_overview (sunucu)', definition: 'Dönemde iş emirlerine çıkan malzemenin kayıtlı maliyeti', drill: D('/maliyet', 'Maliyet Zekâsı'), quality: 'Birim maliyeti olmayan çıkış hesaba katılmaz (eksik maliyet işaretlenir)' },
    'fin-supplier-invoiced': { source: 'economic_overview (sunucu)', definition: 'Dönemdeki tedarikçi faturası toplamı', drill: D('/tedarikci-fatura', 'Tedarikçi faturaları'), quality: 'Fatura yoksa KAYIT YOK' },
    'fin-supplier-paid': { source: 'economic_overview (sunucu)', definition: 'Dönemdeki tedarikçi ödemesi toplamı', drill: D('/tedarikci-fatura', 'Tedarikçi faturaları'), quality: 'Ödeme kaydı yoksa KAYIT YOK' },
    'fin-wo-complete': { source: 'work_order_cost (sunucu)', definition: 'Tüm maliyet bileşenleri bilinen son 12 iş emri', drill: D('/maliyet', 'Maliyet Zekâsı'), quality: 'Bileşen eksikse iş emri “EKSİK” sayılır' },
    'fin-wo-incomplete': { source: 'work_order_cost (sunucu)', definition: 'En az bir maliyet bileşeni bilinmeyen son 12 iş emri', drill: D('/maliyet', 'Maliyet Zekâsı'), quality: 'Eksik bileşenler listelenir' },
    'fin-wo-margin': { source: 'work_order_cost (sunucu)', definition: 'Satış tutarı ve tam maliyeti bilinen iş emri sayısı (marj hesaplanabilen)', drill: D('/maliyet', 'Maliyet Zekâsı'), quality: 'Satış fiyatı veya maliyet eksikse marj BİLİNMİYOR' },
    // ---- Strateji
    'st-kpi-objectives': { source: 'Strateji hedefleri (strategic_objectives)', definition: 'Durumu AKTİF olan stratejik hedef sayısı', drill: D('/yonetim', 'Strateji ve Hedefler', '?sekme=strateji'), quality: LIVE },
    'st-kpi-count': { source: 'Strateji KPI kayıtları', definition: 'Aktif hedeflere bağlı, izlenen KPI sayısı', drill: D('/yonetim', 'Strateji ve Hedefler', '?sekme=strateji'), quality: LIVE },
    'st-kpi-off': { source: 'Strateji KPI okumaları', definition: 'Gerçekleşme/hedef oranı eşik altında olan KPI', drill: D('/yonetim', 'Strateji ve Hedefler', '?sekme=strateji'), quality: 'Okuması olmayan KPI bu sayıya girmez' },
    'st-kpi-unknown': { source: 'Strateji KPI okumaları', definition: 'Henüz okuması olmayan veya hedefi hesaplanamayan KPI', drill: D('/yonetim', 'Strateji ve Hedefler', '?sekme=strateji'), quality: 'VERİ GEREKLİ: okuma girilmeli veya sistem metriği bağlanmalı' },
    // ---- Risk
    'rk-kpi-open': { source: 'Risk kaydı', definition: 'Kapanmamış risk sayısı', drill: D('/yonetim', 'Risk ve İyileştirme', '?sekme=risk'), quality: LIVE },
    'rk-kpi-critical': { source: 'Risk kaydı', definition: 'Açık risk, skor = olasılık × etki ≥ 15', drill: D('/yonetim', 'Risk ve İyileştirme', '?sekme=risk'), quality: LIVE },
    'rk-kpi-late': { source: 'Risk kaydı', definition: 'Gözden geçirme tarihi geçmiş açık risk', drill: D('/yonetim', 'Risk ve İyileştirme', '?sekme=risk'), quality: 'Tarihi girilmemiş risk gecikmiş sayılmaz' },
    'rk-kpi-noaction': { source: 'Risk kaydı + aksiyonlar', definition: 'Açık ve bağlı açık aksiyonu olmayan risk', drill: D('/yonetim', 'Risk ve İyileştirme', '?sekme=risk'), quality: LIVE },
    // ---- Toplantılar
    'mt-kpi-meetings': { source: 'Toplantı kayıtları', definition: 'Kayıtlı toplantı sayısı', drill: D('/yonetim', 'Toplantılar', '?sekme=toplanti'), quality: LIVE },
    'mt-kpi-open': { source: 'Toplantı kararları', definition: 'Kapanmamış karar sayısı', drill: D('/yonetim', 'Toplantılar', '?sekme=toplanti'), quality: LIVE },
    'mt-kpi-late': { source: 'Toplantı kararları', definition: 'Vadesi geçmiş, kapanmamış karar', drill: D('/yonetim', 'Toplantılar', '?sekme=toplanti'), quality: 'Vadesiz karar gecikmiş sayılmaz' },
    // ---- İnsan ve Organizasyon
    'pp-kpi-headcount': { source: 'personnel (aktif kayıtlar)', definition: 'Aktif personel sayısı', drill: D('/personel', 'Personel'), quality: LIVE },
    'pp-kpi-shift-unknown': { source: 'personnel.shift_code', definition: 'Vardiyası kayıtsız aktif personel', drill: D('/personel', 'Personel'), quality: 'VERİ GEREKLİ: vardiya ataması' },
    'pp-kpi-single': { source: 'personnel_skills × machine_skill_requirements', definition: 'Yetkin kişi sayısı tam 1 olan makine', drill: D('/personel', 'Personel'), quality: 'Gereksinim tanımlı değilse BİLİNMİYOR' },
    'pp-kpi-uncovered': { source: 'personnel_skills × machine_skill_requirements', definition: 'Yetkin kişisi olmayan makine', drill: D('/personel', 'Personel'), quality: 'Gereksinim tanımlı değilse BİLİNMİYOR' },
    'pp-kpi-expiring': { source: 'personnel_skills (geçerlilik)', definition: 'Önümüzdeki 60 günde süresi dolacak yetkinlik', drill: D('/personel', 'Personel'), quality: 'Geçerlilik tarihi girilmemiş yetkinlik sayılmaz' },
};
/** `canOpen(path)` is the navigation gate (access.ts). A user who cannot open the target sees WHY there is no link instead of a dead button. */
export function kpiMeta(testid, value, opts) {
    const d = KPI_CATALOG[testid];
    if (!d)
        return null;
    const unknown = /BİLİNMİYOR|OKUNAMADI|VERİ GEREKLİ/.test(value);
    const allowed = d.drill ? opts.canOpen(d.drill.path) : false;
    return {
        source: d.source, definition: opts.serverBasis && opts.serverBasis.trim() ? `${d.definition} · Sunucu notu: ${opts.serverBasis.trim()}` : d.definition,
        quality: unknown ? `DEĞER BİLİNMİYOR — ${d.quality}` : d.quality,
        freshness: opts.freshness ?? 'BİLİNMİYOR',
        drill: d.drill && allowed ? { href: d.drill.href, label: d.drill.label } : null,
        drillNote: !d.drill ? 'Daha derin ekran yok' : allowed ? null : 'Ayrıntı ekranı için yetkiniz yok',
    };
}
