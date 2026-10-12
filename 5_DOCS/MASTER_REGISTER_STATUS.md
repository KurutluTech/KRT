# KMI NEXT — 54 Madde Ana Kayıt Defteri: Kanıta Dayalı Durum (CONTINUATION-002 §16 · güncelleme CONTINUATION-005 §15)

Durumlar: **DONE** (kanıtlı) · **PARTIAL** · **BLOCKED** (owner kararı / dış kaynak / cihaz) · **DEFERRED** (bilinçli ertelendi) · **NOT STARTED**.
Kurallar: kanıt yoksa DONE yok; **yalnız belge hiçbir maddeyi DONE yapmaz**; yüzde uydurulmadı; DONE yalnız **teknik kanıt** demektir. "SENTETİK" yazan testler harness'in yarattığı rol hesaplarıyladır ve gerçek kullanıcı kabulü DEĞİLDİR.
Sütunlar: **Commit/Migration** = bu turda (CONTINUATION-005) eklenen kanıt; eski migration listesi için `docs/REQUIREMENTS_MATRIX.md`. **Bağımlılık**: OWNER (karar) · DEVICE (fiziksel cihaz) · REAL_USER (gerçek kişi/oturum) · REAL_DATA (gerçek veri) · EXTERNAL.
**Yayın etkisi** gerçek kullanıcı etkisine göredir: P0 = veri kaybı/yanlış sevkiyat/yetkisiz erişim; P1 = ilk yayın için gerekli ama bloklu; P2 = ilk yayın dışı olabilir. **Bilinen P0 yok.**
Bu sayılar yüzde değildir ve "yüzde tamamlandı" anlamına gelmez.

> **STRATEJİ NOTU — OLD KMI RETIREMENT — NEXT-ONLY FUTURE (2026-10-11).** Tek ürün KMI NEXT, tek hedef `flow.kurutlu.com`. Eski KMI geliştirilmez/düzeltilmez; ilk kesime kadar olduğu gibi kalır. Eski KMI'de duran kayıtlar “veri taşıma konuları”dır (`docs/MASTER_IMPORT_READINESS.md`), kod borcu değil. Eski KMI riskleri (OLD-KMI-SEC-001) tarihsel kayıtta **AÇIK** durur. Gerçek fabrika kabulü olmayan hiçbir madde DONE yapılmaz; 54 madde donuk, sayılar değişmedi.

| # | Madde | Durum | İlk yayın | Commit/Migration | Kanıt (test) | Kalan | Bağımlılık | Yayın etkisi |
|---|---|---|---|---|---|---|---|---|
| 1 | B/C Yeni Sipariş Kesimi | DONE | K | 0064 (8 canonical FK) · 8b36a49 | `orders`/`create_order`/`transition_order_status`; `partial_shipment_chain` (0054: sevk durumu türetilir); Playwright `orders-screen` · **Yeni (CONT-005):** Müşteri→sipariş→kalem→ürün ilişkileri artık FK ile korunuyor (`canonical_foreign_keys` harness) | — | — | — |
| 2 | Critical Server-Side Authorization | DONE | K | 0067 (start_preview definer) · b822417 | `authorization_sweep` + `write_authorization_closure` (0051: 8 yeni aksiyon, tüm yazanlar kapılı), 0049 dört göz fail-closed, NULL-güvenli kapı testi · **Yeni (CONT-005):** UI E2E: yetkisiz release/onay/fatura reddi (`golden-thread-ui.e2e` 14/14, sentetik) | Gerçek rol sahibi hesapla doğrulama (RC-P1-2) | — | — |
| 3 | LEG-11 Quality Security Cleanup | DONE | K | — | Kalite yazıları yalnız adlandırılmış RPC; `architecture-invariants` (doğrudan DML grant yok); sweep | — | — | — |
| 4 | Reporting Invocation Remediation | PARTIAL | — | — | 21 rapor ekrandan çağrılır; zamanlayıcı hazır (`report_families_scheduler`) | Otomatik çalışma DEFERRED (D-014, kapalı) | OWNER (D-014) | P2 |
| 5 | KPI Metadata + Consumer Wiring | DONE | — | — | `KPI_DICTIONARY` + her kaynak gerçek fonksiyon testi | — | — | — |
| 6 | Golden Thread E2E Revalidation | PARTIAL | K | b822417 · 0067 | RPC zinciri sipariş→…→kapanan yükümlülük + negatifler (`partial_shipment_chain`, `cross_surface_consistency`); 2 gerçek tutarsızlık bulundu/kapandı (0053, 0054) · **Yeni (CONT-005):** `golden-thread-ui.e2e` 14/14 (sentetik rol hesapları: yanlış revizyon, eksik malzeme/takım, Quality HOLD, yetkisiz release, çift sevkiyat, çift fatura); SQL: `golden_thread_roles` | İade/sevk sonrası rework modellenmedi; gerçek kullanıcıyla ekranlardan yürütme yok | REAL_USER | P1 |
| 7 | B/C Historical Data Remediation | DEFERRED | — | 0068 · f304750 | Yapısal koruma testi; eski işlem geçmişi kontrolsüz taşınmaz (yönerge §12) · **Yeni (CONT-005):** Ana veri (müşteri/ürün/tedarikçi) aktarımı hazırlığı tamam (5 sınıf, dışa aktarım kapısı); **işlem geçmişi** taşıma hâlâ ertelendi | Owner onaylı, önizlemeli taşıma planı | OWNER+REAL_DATA | P2 |
| 8 | Canonical Stock Truth | DONE | K | 0064 | `stock` + lot yaşam döngüsü (`partial_shipment_chain`), çapraz yüzey tutarlılığı · **Yeni (CONT-005):** Stok/sevkiyat/obligation FK korumaları | — | — | — |
| 9 | ONE Accounting & Finance | PARTIAL | — | — | Sevkiyat başına fatura/tahsilat (D-003), tedarikçi faturası, alacak yaşı; `accounting`, `supplier_invoicing` | KDV/e-fatura/muhasebe yazılımı yok | EXTERNAL (e-fatura) | P2 |
| 10 | KMI_ORG Trust / Signing | BLOCKED | — | — | — | Owner kararı (kimlik/imza modeli) | OWNER | P2 (ilk yayın dışı) |
| 11 | Remaining Legacy Retirement | PARTIAL | — | — | Eski ad taraması testi | Eski KMI'nin emekliliği = geçiş sonrası, owner | OWNER | P2 |
| 12 | Performance / Runtime Closure | PARTIAL | K | — | 1 yıllık yük profili; OEE 9,5 dk→0,9 sn (0055/0056); sınırlar tanımlı (`RELEASE_CANDIDATE` §7) · **Yeni (CONT-005):** Operatör terminali ağ kopması testleri (`operator-regression.e2e`) | Gerçek ağ/düşük donanım/çok kullanıcı ölçülmedi | REAL_USER | P1 |
| 13 | Authorization Role/E2E Matrix | PARTIAL | K | golden_thread_roles + data_classes | Rol matrisi tablo+TS ikizi, `authorized_paths`, sweep · **Yeni (CONT-005):** Gerçek rol hesapları (sentetik) ile SQL+UI doğrulama; gerçek rol sahipleriyle HENÜZ YOK | Gerçek rol sahipleriyle E2E (RC-P1-2) | REAL_USER | P1 |
| 14 | Final Foundation Audit | PARTIAL | K | — | Bu release readiness taraması + `RELEASE_CANDIDATE.md` | Owner gözden geçirmesi | OWNER | P1 |
| 15 | FOUNDATION_COMPLETE Gate | BLOCKED | K | — | — | Owner kapısı (1–14 kanıtı + owner) | OWNER | P1 |
| 16 | 14 Domain Workspace Convergence | PARTIAL | K | — | 36 ekran, 31 rota, gruplu menü; Playwright | Gerçek kullanıcı kabulü; Görev Zemini/arama yok | REAL_USER | P1 |
| 17 | Single Navigation / Global Shell | DONE | K | c6d8ec6 | `access.ts` + `my_access()` (sunucu aynası): role göre ana sayfa, kapalı ekran URL ile açılmaz (`access.test`, `app-shell.browser`), TS↔SQL rol matrisi eşitliği (`roleMatrixParity`), iş emri merkezi Altın Hat omurgası (`hub-readiness.e2e`) · **Yeni (CONT-005):** Çevrimdışı/çevrimiçi olayında ekran yeniden çizilmiyor (yazılan değer korunur) | Gerçek rol sahipleriyle doğrulama RC-P1-2 | — | — |
| 18 | Command Center Final Convergence | DONE | K | — | `command_center_chain`, `cross_surface_consistency`, 0,5 sn @1 yıl | — | — | — |
| 19 | Live Floor Final Convergence | PARTIAL | — | — | KMI LIVE (`live_displays`), telemetri açıkça NOT_CONNECTED | Gerçek makine telemetrisi (cihaz) | DEVICE | P2 |
| 20 | Task Floor Final Convergence | PARTIAL | K | — | 0058 görevler: `task_floor` harness (atanan, kanıt, kendi onayı yok); /gorevler ve operatör ana sayfası | Gerçek kullanıcıyla kabul | REAL_USER | P1 |
| 21 | Universal Search / KMI'ye Sor | PARTIAL | K | — | 0059 evrensel arama: `universal_search` harness (rol bazlı, para yok, enjeksiyon/jokersiz), copilot ayrı | Gerçek veriyle ve gerçek rollerle kabul | REAL_DATA | P1 |
| 22 | Reporting / PULSE / KMI LIVE Surfaces | PARTIAL | — | — | Rapor ekranı + PULSE ışıkları (Komuta Merkezi) + KMI LIVE | PULSE ayrı yüzey değil | — | P2 |
| 23 | Premium CNC Visual Convergence | NOT STARTED | — | — | — | Görsel kimlik çalışması; owner beğenisi gerekir | OWNER (beğeni) | P2 |
| 24 | Spindle / Machine Icon System | NOT STARTED | — | — | — | — | OWNER (beğeni) | P2 |
| 25 | Desktop/Tablet/Phone/Kiosk + PWA | PARTIAL | K | c6d8ec6 | PWA, 390 px testleri, 124 yükleme duman (4 boyut) · **Yeni (CONT-005):** `operator-regression.e2e` 11/11 (sentetik): çift START, 2/3 makine, ağ kopması, kayıp cevap, çift tık, yenileme, HOLD, ARIZA, ilk parça, vardiya, yetkisiz | Fiziksel cihaz; girişli ekranlar gerçek oturumla | DEVICE | P1 |
| 26 | Owner Visual Acceptance | BLOCKED | K | — | — | Owner kapısı | OWNER | P1 |
| 27 | KMI-CNC-KPI-MASTER-001 | PARTIAL | — | — | KPI sözlüğü + havuz | MTBF/MTTR, planlı/plansız bakım oranı | REAL_DATA | P2 |
| 28 | Reporting Intelligence / Report Pool | DONE | — | — | `report_pool_chain`, `report_families_scheduler`, parmak izli anlık kayıt | — | — | — |
| 29 | Advanced OEE / Loss Intelligence | DONE | K | 0065 · 870aa71 | `oee_chain` (idle-slot operatör dahil), `report_families_scheduler`; ölçekli (0055/0056); ideal süre yoksa UNKNOWN · **Yeni (CONT-005):** Kayıp nedenleri ayrıldı (kalite bekleme/operatör kaynaklı/planlı duruş); OEE formülü A×P×Q değişmedi (A/B eşdeğerlik harness: `oee_loss_reasons`) | Gerçek ideal çevrim süreleri (veri) | REAL_DATA | — |
| 30 | Puantaj Remaining Fairness | BLOCKED | — | data_classes harness | V47 formül portu (değiştirilmedi) · **Yeni (CONT-005):** Sınıf A–E ayrı yetkilerle kanıtlandı (`data_classes`); formül ve V47 çarpanları değişmedi | Owner kararı D-001; puantaj V47 değişmez | OWNER (D-001) | P2 (ilk yayın dışı) |
| 31 | People / Capability Final Model | PARTIAL | K | — | `personnel`, 0052 içe aktarım (önizleme, dört göz), yetkinlik | Canlıda 0 personel (RC-P1-1) | REAL_DATA | P1 |
| 32 | KMI Academy | DONE | — | — | `competency_academy_chain` | Gerçek müfredat içeriği (veri) | REAL_DATA | — |
| 33 | Mastery / Badge Ladder | DONE | — | — | `badge_assignment_chain`; rozet makine yetkinliğinin yerine geçmez (kapı testi) | D-017 eşik onayı | OWNER (D-017) | — |
| 34 | Smart Assignment | DONE | K | — | `smart_assignment_chain`, yetkinlik kapısı | D-012 makine şartları (veri) | REAL_DATA (D-012) | — |
| 35 | Product Digital DNA / Passport | DONE | — | — | `passport_chain` | — | — | — |
| 36 | Cost & Business Intelligence | PARTIAL | — | 0066 · d13b443 | Ekonomi motoru; D-013 parametresiz tam maliyet **gösterilmez** · **Yeni (CONT-005):** D-016 eşikleri: sahip-yalnız kayıt, geçmiş, aktif/pasif (`economic_thresholds_record`); D-013 parametresiz tam maliyet yine gösterilmez | D-013 değerleri, D-007 sahip bağlama | OWNER (D-013, D-007) | P2 |
| 37 | Document Intelligence | PARTIAL | — | — | `documents_chain`, `as_built_document_gates` | D-015 özel depolama aktivasyonu | OWNER (D-015) | P2 |
| 38 | QR / Passport Complete | PARTIAL | — | — | `scan`, `labels_chain`, `passport_chain` | Fiziksel kamera/yazıcı doğrulanmadı | DEVICE | P2 |
| 39 | Toolroom Canonical System | DONE | — | — | `toolroom_cam_chain`, takım hazırlık kapısı | — | — | — |
| 40 | Nikken Presetter Integration | BLOCKED | — | — | Sözleşme/adaptör çerçevesi | Cihaz kanıtı | DEVICE | P2 (ilk yayın dışı) |
| 41 | LockCell Integration | BLOCKED | — | — | Aynı | Cihaz kanıtı, D-002 | DEVICE | P2 (ilk yayın dışı) |
| 42 | CNC Machine Connectivity | BLOCKED | — | — | Aynı | Cihaz kanıtı | DEVICE | P2 (ilk yayın dışı) |
| 43 | GEÇKO Integration | PARTIAL | — | — | `gecko_live_prep`, `gecko_schedule_visibility_import`; bayatsa "kimse yok" denmez; yalnız kendi hareketini görme | D-009 cron aktivasyonu (kapalı), 23 kart eşleştirme (isimle tahmin yok) | OWNER (D-009)+DEVICE | P2 |
| 44 | Camera / Barcode Workflows | PARTIAL | — | — | Tarama ekranı + `record_scan` | Fiziksel kamera | DEVICE | P2 |
| 45 | Factory Displays / KMI LIVE | PARTIAL | — | — | `live_displays`; ekran anahtarı; PUBLIC profil veri azaltımlı | D-018 girişsiz erişim (kapalı) | OWNER (D-018) | P2 |
| 46 | Process Mining | PARTIAL | — | — | `process_mining_twin`; <5 eksiksiz vaka = VERİ YETERSİZ | Gerçek vaka birikimi | REAL_DATA | P2 |
| 47 | Digital Twin Lite | PARTIAL | — | — | `factory_twin`, güven etiketi, SENARYO etiketli | Gerçek veri güveni | REAL_DATA | P2 |
| 48 | Next Best Action | PARTIAL | — | 0066 | 7 kural; kabul, satınalma/ödeme/kalite/sevk onaylarını **atlamaz** · **Yeni (CONT-005):** Eşikler öneridir; sahip onaylamadan aktif değil | D-016 eşik onayı | OWNER (D-016) | P2 |
| 49 | Management Copilot | PARTIAL | — | — | Kural tabanlı `copilot_ask`, kaynak bağlantılı, "BİLMİYORUM" | Gerçek veri | REAL_DATA | P2 |
| 50 | Factory Readiness | PARTIAL | K | f304750 · 388fc05 · 5d94c64 | `RELEASE_CANDIDATE.md` kapı matrisi · **Yeni (CONT-005):** Kabul paketi hazır (`FACTORY_ACCEPTANCE_PACK`), yedek sınıflandırması (`ROLLBACK_PLAN`), fonksiyon sınıflandırması | RC-P1-1..5 | REAL_USER+REAL_DATA | P1 |
| 51 | Controlled Real User/Machine/Order Pilot | BLOCKED | K | — | — | Owner kapısı | OWNER+REAL_USER | P1 |
| 52 | Golden Machine / Golden Thread E2E | PARTIAL | K | — | Bkz. madde 6 | Bkz. madde 6 | REAL_USER | P1 |
| 53 | Owner Acceptance | BLOCKED | K | — | — | Owner kapısı | OWNER | P1 |
| 54 | Controlled Production Release | BLOCKED | K | 388fc05 | Paket+sağlama toplamı hazır; yayın yapılmadı · **Yeni (CONT-005):** Yerel geri yükleme DOĞRULANDI, bağımsız yedek ve tam üretim geri alma DEĞİL; sahip teslim paketi hazır | Owner elle yükler | OWNER | P1 |

**Özet (2026-10-11, CONTINUATION-005 sonrası):** DONE 14 · PARTIAL 27 · BLOCKED 10 · DEFERRED 1 · NOT STARTED 2 (toplam 54).
Bu turda DURUM DEĞİŞMEDİ; yalnız kanıt derinleşti (UI E2E, operatör regresyonu, FK, OEE nedenleri, eşik kaydı, ana veri hazırlığı, yedek sınıflandırması). Durum değiştirmek için gereken kanıt (gerçek kullanıcı, gerçek veri, cihaz, owner kararı) hâlâ yok — bilerek DONE verilmedi.
İlk yayın için kritik (K) kalanlar hep aynı dört bağımlılığı bekliyor: gerçek kullanıcı oturumu · gerçek ana veri · fiziksel cihaz · owner kararı/onayı. Kod tarafında bilinen açık P0 yok.

> **KURTARMA PROGRAMI NOTU (entegre sürüm adayı).** 54 maddelik sıra ve yukarıdaki durumlar DEĞİŞMEDİ. Kurtarma programı (D-007 + görsel kurtarma + Komuta V2 + tam sistem kurtarma) bu maddelerin yüzeyini onarır; ek kanıtlar `docs/RECOVERY_MATRIX.md` "Nihai durum" bölümündedir. Yeni migration'lar 0071 (makine sınıfı), 0072 (operatör PIN/rozet), 0073 (puantaj ayı) yalnız yerel replikada doğrulandı, canlıya UYGULANMADI.
