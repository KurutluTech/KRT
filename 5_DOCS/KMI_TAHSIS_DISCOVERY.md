# TAHSİS — Faz 2 keşfi (salt-okunur; kod/migration YOK)
**İş tanımı: ÇÖZÜLDÜ — sahip onaylı.** TAHSİS = üst toleransı aşan bir veya daha fazla ölçünün, kısa ek talaşla düzeltilebilir yeniden işleme vakası. Stok tahsisi/rezervasyon DEĞİL. Her oversize parça güvenle yeniden işlenemez; teknik uygunluk ve yetki kanıtlanır.

## Mevcut kanonik zemin (kanıt: replica şeması, migrasyonlar)
| Gerekli | Mevcut | Durum |
|---|---|---|
| Uygunsuzluk + yeniden işleme durum makinesi | `quality_ncrs.status`: OPEN → REWORK → RECHECK_PENDING → ACCEPTED/SCRAPPED (+ `quality_ncr_events`) | PRESENT — **ikinci durum makinesi KURULMAYACAK; TAHSİS vakası bu NCR'ın boyut düzeyi uzantısı olur** |
| HOLD / ayrıştırma | `quality_holds` (OPEN/…), start-gate `QUALITY_HOLD_OPEN` | PRESENT (iş emri düzeyinde; parti/adet düzeyi ayrıştırma yok) |
| Operasyon olayları | `work_order_operation_events` (iyi/hurda/not) | PRESENT |
| Takım/ofset olayı | `operator_tool_events` (tool_code, kind, note) | PRESENT (ofset olayı türü doğrulanmadı) |
| Üretim düzeltme | `production_corrections` (delta) | PRESENT — çift sayım tehlikesi: TAHSİS düzeltmesi buradan yapılmamalı |
| Kontrol planı / karakteristik / çizim ölçüsü / nominal-tolerans | **YOK** | MISSING → "DATA REQUIRED" yolu zorunlu |
| Ölçüm aleti + yetkinlik/kalibrasyon | YOK | MISSING |
| Boyut düzeyi izlenebilirlik (ölçü, özellik/yüzey, ölçülen değer, birim) | YOK (`quality_ncrs` yalnız qty+reason) | MISSING |
| Operatör kendi bildirimi vs kalite tespiti | YOK (`opened_by` var, kaynak türü yok) | MISSING |
| Teknik değerlendirme + yeniden işleme yetkisi | `authorize_critical_action` mekanizması var; TAHSİS aksiyonu yok | MISSING |
| Ek talaş süresi / maliyet | operasyon olayları var; ayrı yeniden işleme süresi yok | MISSING |
| OEE kalite / iyi-hurda | `production_declarations` + OEE (A×P×Q) | TAHSİS parçası iyi sayılmamalı: PARTIAL risk |

## Tasarım önerisi (UYGULANMADI; sahip onayıyla Faz 2'de)
1. `control_plan_characteristics` (ürün revizyonu, ölçü kimliği, nominal, alt/üst tolerans, birim, özellik/yüzey) — veri yoksa vaka "DATA REQUIRED" ile açılır, ölçü/tolerans uydurulmaz.
2. `ncr_characteristics` (NCR'a çoklu satır: karakteristik, ölçülen değer, alet, adet, kanıt) + NCR'a `detection_source` (OPERATOR/QUALITY) ve `rework_kind='TAHSIS'`.
3. Akış eşlemesi: DETECTED=OPEN+HOLD · TECHNICAL ASSESSMENT=yeni alt durum (karar kaydı) · REWORK AUTHORIZED/IN PROGRESS=REWORK (yetki + süre olayları) · REINSPECTION=RECHECK_PENDING · ACCEPTED/REJECTED=ACCEPTED/SCRAPPED, FURTHER REVIEW=OPEN'a dönüş.
4. Çift sayım: yeniden işlenen parça orijinal parçadır; `production_declarations`'a ikinci iyi parça yazılmaz — kabul anında yalnız mevcut iyi/hurda dengesini tamamlayan kontrollü kayıt.
5. Operatör ekranı: TAHSİS → ölçü/yüzey (kontrol planından seçim) → adet → neden → ölçüm/foto → gönder; operatör kendi kendine yeniden işleme yetkisi veremez.
6. Analitik/maliyet: ek süre, takım tüketimi, neden dağılımı — Cost Intelligence ve OEE ile aynı kaynaktan; V47 prim algoritmasına dokunulmaz, dürüst bildirim cezalandırılmaz.
## Gerekli kararlar (sahip)
a) Kontrol planı verisi kim/nasıl girecek (ürün başına)? b) Yeniden işleme yetkisi hangi rolde (Kalite mi, Üretim yöneticisi mi, ikisi mi)? c) Parti/adet düzeyi ayrıştırma için fiziksel süreç (etiket/kasa)?
