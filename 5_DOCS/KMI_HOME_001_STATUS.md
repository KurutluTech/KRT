# KMI-HOME-001 — Rol-uyarlamalı HOME: durum (yerel; canlı doğrulama YOK)
Yönerge çerçevesi: 54 maddelik dondurulmuş kayıt DEĞİŞMEDİ, yeni madde yok. HOME; ekran 02/03/04/06/20, madde 16/17/18/22/23/25 yüzeyine işlenir. **Kalıcı kural: üretim yayını YALNIZ elle; bu oturum hiçbir şeyi yüklemez/yayınlamaz/migrate etmez.**

## Yapılan (commit 9c6c46c sonrası, bu dal)
- `packages/domain/src/homeLayout.ts` (saf, DOM yok): rol → kart bileşimi, çok rollü kullanıcıda tekilleştirilmiş birleşim, ekonomi kartı ayrı yetki ister, eksik sayı BİLİNMİYOR (0 değil), tonlar, veri tazeliği (15 dk → BAYAT). Test: `homeLayout.test` 10/10.
- `apps/web/src/homeCockpit.ts`: KOKPİT (kart ızgarası, PULSE ışıkları, kritik sinyaller + pasaport bağlantısı, tazelik rozeti, "kaynak" satırı, ulaşılamayınca açık uyarı). Hesap yok; sayılar `command_center` sayaçlarından, muhasebe için `commercial_approvals` (yalnız adet, tutar yok; 500 üstü okuma = BİLİNMİYOR).
- Operatör: yönetim kokpiti yok (kendi iş ekranına iner).
- Tarayıcı testleri (app-shell 21/21): yönetim kartları, eksik sayaç, tazelik, kaynak, sinyal; muhasebe/kalite varyantları; ekran görüntüleri `kmi_home_shots/` (masaüstü; fixture verisi, canlı değil).

## Bölüm bazında kapsam (güncel — HEAD; yerel kanıt, canlı yok)
| Alan | Durum | Not |
|---|---|---|
| Yönetim/Sahip | PARTIAL | Sayaç kartları + PULSE + sinyaller; şematik fabrika haritası (gerçek makine kaydı, HAZIR≠ÇALIŞIYOR), makine×vardiya matrisi, plan-gerçek dürüstlüğü ("plan verisi yok"), KMI Zekâ özeti. Ekonomi kartları ayrı yetki ister. OEE/darboğaz canlı veri gerektirir |
| Muhasebe | PARTIAL | Onay kuyruğu, açık satış/tedarikçi faturası ve vadesi geçmiş tedarikçi faturası adetleri. Alacak vadesi, banka mutabakatı, üçlü eşleşme, dönem kapanışı = VERİ GEREKLİ (sayı gösterilmez) |
| Üretim müdürü | PARTIAL | Ayrı DB rolü yok → MANAGEMENT/ADMIN HOME'u (matris + harita) |
| Operatör | DONE (mevcut ekran) | `/operator`; yönetim kokpiti yok |
| Kalite | PARTIAL | HOLD/NCR/giriş KK/ilk parça; kalibrasyon = VERİ GEREKLİ; TAHSİS ekranı `/tahsis` |
| Bakım | PARTIAL | DOWN/bakımda/bilet/takım ömrü; MTBF/MTTR yok |
| Depo | PARTIAL | WAREHOUSE_RECORD eylemiyle lot/giriş KK kartları (SQL sayımına eşit, e2e) |
| Satınalma | PARTIAL | Talep/PO/giriş KK adetleri |
| Sevkiyat | PARTIAL | Taslak sevkiyat, geciken kalem; OTD = VERİ GEREKLİ |
| CAM | PARTIAL | CAM taslak, iş emri, takım ömrü |
| Takımhane | PARTIAL | Ayrı rol yok; MAINTENANCE/CAM takım kartları |
| İK | PARTIAL | PERSONNEL_MANAGE: aktif personel, hesapsız, süresi geçen/yaklaşan yetkinlik |
| BT | PARTIAL | DEVICE_MANAGE: cihaz, karantina; entegrasyon tazeliği = VERİ GEREKLİ |
| Müşteri-Sipariş | PARTIAL | Müşteri, taslak/üretimdeki sipariş, gecikme |
## Paylaşılan bileşenler
KPIStatusCard ✔ (cockpit-card), CriticalSignals ✔, DataFreshnessIndicator ✔, kısmen QuickActions (mevcut "Sizin için"). RoleHomeShell, LiveFactoryMap, MyActionQueue, OrderRiskPanel, MachineStatusMatrix, DepartmentPerformanceChart, ShiftTimeline, DocumentPreview, NotificationCenter, KMIIntelligenceSummary, DrillDownDrawer, RoleWorkspaceSwitcher: YAPILMADI.
## Güvenlik notu
Kart gizleme güvenlik değildir; her kart kullanıcının zaten sahip olduğu RLS/RPC üzerinden okur. Sunucu tarafı doğrulanmış kimlik (`my_access`) kullanılıyor. `commercial_approvals` okuma yetkisi RLS'e bağlı — rol bazlı doğrulaması canlıda yapılmadı.
