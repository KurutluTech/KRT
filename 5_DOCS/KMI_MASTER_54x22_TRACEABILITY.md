# KMI — 54 × 22 İzlenebilirlik Matrisi (Faz 0 keşif, salt-okunur)
Taban: `recovery-004` HEAD `567b04f` (master `cecd7de`). Kaynak: `docs/MASTER_REGISTER_STATUS.md` (54 madde DONMUŞ, sıra/sayı değişmedi, 55. madde yok). Durumlar: PRESENT · PARTIAL · BLOCKED · DEFERRED · MISSING. "Kanıt" kod/test yoludur; **yerel test = canlı doğrulama DEĞİLDİR.** Madde→ekran eşlemesi analiz eşlemesidir (donmuş kayıt ekran sütunu içermez).

## A. 22 ekran — kanonik kaynak, durum, kanıt
| # | Ekran | Rota / bileşen | Kanonik kaynak (tek doğru) | Durum | Kanıt | Eksik / not |
|---|---|---|---|---|---|---|
| 01 | Giriş | `renderLogin` (app.ts) | Supabase Auth | PARTIAL | `app-shell.browser` 17/17; gerçek DB sağlık noktası; parlama yalnız K | **Oturum yenileme YOK**: `client.ts` refreshToken saklıyor ama hiçbir yerde kullanmıyor; 401/JWT-süresi işleyicisi yok → "JWT expired" döngüsü riski (MISSING) |
| 02 | Genel başlık | `header.ts` | personnel + roller | PARTIAL | `header.test`, app-shell | Ad/rol/avatar, saat, LIVE/PULSE var. **Vardiya ve bildirim zili yok** (header.ts'de 0 eşleşme) |
| 03 | KMI LIVE | `/canli` LiveScreen | `machine_state_events`, `production_declarations` | PRESENT (telemetri BLOCKED) | `live-screen.browser` 15/15 | Telemetri NOT_CONNECTED; READY≠RUNNING, BİLİNMİYOR≠0 ekranda uygulanıyor |
| 04 | Komuta / PULSE | `/komuta` | `command_center` RPC | PARTIAL | `command-center-v2.browser` 9/9 | PULSE ayrı yüzey değil (madde 22) |
| 05 | Dijital pasaportlar | `/nesne` | `object_passport` + audit_log | PARTIAL | `object-passport.e2e` 15/15; `docs/PASSPORT_COVERAGE.md` | Müşteri/sipariş/stok/kalite/tedarikçi/ürün/takım genel; 111 ve 113 ayrı `machines` satırı (0009: ikisi DMU 60 P) — marka/model/seri/yıl tablosu YOK |
| 06 | Benim İşlerim | `/operator` | operations + tasks | PARTIAL | `operator-home.browser`, `operator-regression.e2e` 11/11 | **"Maks 3 aktif iş emri" kuralı kodda bulunamadı**; çok makine yetkisi `max_concurrent_machines 2..3` (0013) var. **TAHSİS: İŞ TANIMI ÇÖZÜLDÜ — SAHİP ONAYLI** (stok tahsisi DEĞİL; üst toleransı aşan ölçünün kısa ek talaşla düzeltilmesi). Uygulama durumu ayrı: veri modeli/UI/iş akışı/test = MISSING (kodda tahsis/düzeltme vakası yok). Çift START idempotent test var |
| 07 | Makine terminali | `/terminal` | `work_order_operations` | PRESENT | `terminal-screen.browser`, operator-regression | Makine başına tek aktif oturum: `MACHINE_BUSY` (0039) |
| 08 | Görev Komutası | `/gorevler` | `tasks`, `task_events` | PARTIAL | `task-floor-screen.browser`, `task_floor` harness | Gerçek-vs-revize vade alanı YOK (grep: sıfır); bildirim altyapısı yok |
| 09 | İş emri zekâsı | `/is-emirleri`, hub | `work_orders`, `work_order_readiness` | PARTIAL | `hub-screen.browser`, `hub-readiness.e2e` | JWT yenileme eksik (01). `start_operation` malzeme/takım için yalnız `NOT_READY` reddediyor; **UNKNOWN başlangıçta geçiyor mu doğrulanmadı** → Faz 2 testi |
| 10 | Sipariş zekâsı | `/siparisler` | `orders`, `order_items` | PARTIAL | `orders-screen.browser`, 0064 FK | **Müşteri PO tekrarına karşı benzersizlik kısıtı YOK**; revizyon yönetimi yok; "malzeme lotu+giriş KK+HOLD+rezervasyon olmadan iş emri yok" kuralı iş emri şalterlerinde kısmen (readiness) — tüm sunucu yollarında kanıtlanmadı |
| 11 | Üretim planlama | `/planlama` | `work_order_plan_decisions` | PRESENT | `planning-screen.browser` | — |
| 12 | KMI Tara | `/tara` | `scan_events`, `record_scan` (0020) | PARTIAL | `scan-screen.browser`, `scan` harness | "Tarama tek başına stok düşmez" davranışı Faz 2'de açıkça test edilecek; fiziksel kamera DEVICE |
| 13 | CAM zekâsı | `/muhendislik` | `cam_programs` | PARTIAL | `toolroom_cam_chain` | Fusion 360: kodda HİÇ izi yok → MISSING; lisans/API doğrulanmadan söz verilmez |
| 14 | Rota | `/rota` | `routing_operations` (0039) | PRESENT | `routing-screen.browser` | — |
| 15 | Takımhane | `/takimhane` | `tools`, `tool_movements` | PARTIAL | `toolroom-screen.browser` | Nikken fotoğraf çıkarımı yok; Nikken/LockCell BLOCKED (cihaz); araç seti/tutucu/aparat/mastar tabloları yok |
| 16 | Kalite | `/kalite` (hub) | `quality_holds`, `quality_ncrs` | PARTIAL | quality harness, `golden_thread` | Kontrol planı tablosu **yok** → "kontrol planı eksikse fail-closed" uygulanamaz (MISSING) |
| 17 | Bakım | `/bakim` | `maintenance_tickets`, `maintenance_test_results` | PRESENT | `maintenance-screen.browser` 13/13; 0017 zincir (TEST_PENDING, başarısız test üretimi açmaz) | Yedek parça / dış servis tabloları yok |
| 18 | Akıllı depo | `/depo` | `stock_lots`, `stock_movements`, `material_movements` | PARTIAL | `stock-screen.browser`, `partial_shipment_chain` | Tek defter var; On Hand/Available/Reserved/Hold/Staged/Issued/WIP/FG/Shipped/Scrap'in hepsi ayrı türetilmiş değil (RESERVE/UNRESERVE/ISSUE var, `stage_stock_lot_for_shipment` var) |
| 19 | Satınalma | `/satinalma`, `/talepler` | `purchase_*`, `goods_receipts` (HOLD lot üretir) | PARTIAL | purchasing screens | Talepler + Mal kabul **tek merkez değil** (iki ekran) |
| 20 | Gezinme / çalışma alanı | `nav.ts`, `access.ts` | `my_access()` | PARTIAL | `roleMatrixParity`, route-sweep | 15 yeni çalışma alanı (Bölüm D) vs mevcut 15 departman grubu; Muhasebe + Kuyruk ayrı; URL uyumu korunmalı |
| 21 | Finansal zekâ | `/muhasebe`,`/ekonomi`,`/alacaklar` | `invoices`, `cost_parameters`, `economic_*` | PARTIAL | accounting/economics screens | D-013 parametresiz tam maliyet gösterilmez; ekonomik BI DEFERRED (sahte değil) |
| 22 | Lojistik | `/sevkiyat` | `shipments`, `order_item_shipment_obligation` | PRESENT | `shipment-screen.browser`, `partial_shipment_chain` | "Sevk Et" düğmesi kanonik `transition_shipment_status`'a bağlı; eski bağımsız bypass NEXT kodunda **bulunamadı** (eski KMI'de ise kalır) |

## B. 54 madde → ekran eşlemesi (analiz) ve donmuş durum
Durum = donmuş kayıttaki durum (değişmedi). Ekran numaraları yukarıdaki tablo.
| Madde | Durum | Etkilediği ekranlar |
|---|---|---|
| 1 Sipariş kesimi | DONE | 10,11,22 |
| 2 Sunucu yetkisi | DONE | 01,20 + hepsi |
| 3 LEG-11 kalite temizliği | DONE | 16 |
| 4 Rapor çağrı düzeltmesi | PARTIAL | 21 (rapor havuzu) |
| 5 KPI metadata | DONE | 03,04 |
| 6 Altın zincir E2E | PARTIAL | 09,10,16,22 |
| 7 Tarihsel veri | DEFERRED | 10,18 |
| 8 Kanonik stok | DONE | 18 |
| 9 Muhasebe/Finans | PARTIAL | 21 |
| 10 KMI_ORG imza | BLOCKED | 01,05 |
| 11 Eski KMI emekliliği | PARTIAL | 20 |
| 12 Performans | PARTIAL | tümü |
| 13 Rol/E2E matrisi | PARTIAL | 20 |
| 14 Temel denetim | PARTIAL | tümü |
| 15 FOUNDATION_COMPLETE | BLOCKED | — |
| 16 14 alan yakınsaması | PARTIAL | 20 |
| 17 Tek gezinme | DONE | 02,20 |
| 18 Komuta merkezi | DONE | 04 |
| 19 Canlı zemin | PARTIAL | 03 |
| 20 Görev zemini | PARTIAL | 06,08 |
| 21 Evrensel arama | PARTIAL | 02,05 |
| 22 Raporlama/PULSE/LIVE | PARTIAL | 03,04 |
| 23 Premium görsel | NOT STARTED | 01–22 (Bölüm C onaylandı) |
| 24 Mil/makine ikonları | NOT STARTED | 03,05,07 |
| 25 Masaüstü/tablet/telefon/kiosk | PARTIAL | 03,06,07 |
| 26 Owner görsel kabul | BLOCKED | — |
| 27 CNC KPI | PARTIAL | 03,04,17 |
| 28 Rapor havuzu | DONE | 21 |
| 29 OEE | DONE | 03,04 |
| 30 Puantaj adaleti | BLOCKED | 06 (İK sonrası) |
| 31 Kişi/yetkinlik | PARTIAL | 05,06 |
| 32 Akademi | DONE | 06 |
| 33 Rozet | DONE | 06 |
| 34 Akıllı atama | DONE | 09,11 |
| 35 Ürün DNA/pasaport | DONE | 05 |
| 36 Maliyet/İş zekâsı | PARTIAL | 21 |
| 37 Doküman zekâsı | PARTIAL | 05,16 |
| 38 QR/pasaport | PARTIAL | 05,12 |
| 39 Takımhane | DONE | 15 |
| 40 Nikken | BLOCKED | 15 |
| 41 LockCell | BLOCKED | 15 |
| 42 CNC bağlantısı | BLOCKED | 03,07 |
| 43 GEÇKO | PARTIAL | 06 |
| 44 Kamera/barkod | PARTIAL | 12 |
| 45 Fabrika ekranları | PARTIAL | 03 |
| 46 Süreç madenciliği | PARTIAL | 04 |
| 47 Dijital ikiz lite | PARTIAL | 04 |
| 48 Sonraki en iyi eylem | PARTIAL | 04 |
| 49 Yönetim kopilotu | PARTIAL | 04 |
| 50 Fabrika hazırlığı | PARTIAL | tümü |
| 51 Kontrollü pilot | BLOCKED | — |
| 52 Altın makine E2E | PARTIAL | 07,09 |
| 53 Owner kabul | BLOCKED | — |
| 54 Kontrollü üretim yayını | BLOCKED | — |

## C. İş kuralı çelişkileri / belirsizlikler (kanıtla)
1. **Oturum yenileme yok** (01/09): refresh token saklanıyor, kullanılmıyor → süresi dolan JWT sessiz hata/döngü üretir. Bu bir hata, karar değil.
2. **TAHSİS — TANIM ÇÖZÜLDÜ (sahip, 12 Eki)**: boyutsal düzeltme vakası. `production_declarations` yalnız iyi/hurda taşır; TAHSİS vakası, boyut düzeyi izlenebilirlik, HOLD/ayrıştırma, yetkili yeniden işleme, yeniden muayene, çift sayım koruması henüz YOK (MISSING). Kontrol planı da yok → "DATA REQUIRED" yolu gerekli. Uygulama Faz 2'de, sırada.
3. **Maks 3 aktif iş emri / operatör**: kodda yok; yalnız çok makine yetkisi 2–3. Sahip kuralı netleştirmeli (yeni durum makinesi kurulmaz).
4. **Giriş KK**: Mal kabul her zaman HOLD lot üretir (0010), HOLD→AVAILABLE mevcut geçişle; ayrı "giriş KK" tablosu yok — mevcut HOLD durumu kanonik kabul edildi, ikinci durum makinesi eklenmedi.
5. **Başlangıçta UNKNOWN hazırlık** (09): `operation_start_refusal` yalnız `NOT_READY` reddediyor; UNKNOWN'un nerede fail-closed olduğu (0021:173, 0025, 0029) tek tek test edilmeli.
6. **PO tekrarı**: kısıt yok (10).
