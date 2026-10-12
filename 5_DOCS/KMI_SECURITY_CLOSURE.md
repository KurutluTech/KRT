# KMI — Güvenlik kapanışı (yerel replica kanıtı; hiçbir şey uygulanmadı)

Ölçüm: `supabase/verification/visibility_matrix.sql` (migration 0001–0073, taslaksız). Her rol için yalnız o role sahip oturum açmış bir kullanıcının okuyabildiği satır sayısı.

## Ölçülen görünürlük matrisi (tohum: 1 müşteri, 1 sipariş, 1 tedarikçi, 1 personel, 2 audit satırı)
| Tablo | ACCOUNTING | ADMIN | CAM | MAINT. | MGMT | OPERATOR | PURCH. | QUALITY | SHIPPING |
|---|---|---|---|---|---|---|---|---|---|
| customers | 1 | 1 | 1 | 1 | 1 | **1** | 1 | 1 | 1 |
| orders | 1 | 1 | 1 | 1 | 1 | **1** | 1 | 1 | 1 |
| suppliers (+contact_info) | 1 | 1 | 1 | 1 | 1 | **1** | 1 | 1 | 1 |
| personnel | 1 | 1 | 1 | 1 | 1 | **1** | 1 | 1 | 1 |
| audit_log (MACHINE+INVOICE seed) | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| invoices / supplier_invoices | kapı fonksiyonları (`can_view_receivables/payables`) — tohum yok, 0 |
| personnel.puantaj_multiplier | **kolon yetkisi kapalı (authenticated okuyamaz)** — doğrulandı |

## Bulgular
1. **ACIK — RLS `true`**: customers, orders, order_items, suppliers, personnel satırlarını OPERATOR dahil her giriş yapmış rol okuyor. suppliers.contact_info ve personnel.auth_user_id de dahil. Sınıf: **BLOCKED — OWNER DECISION** (hangi rol neyi görür). Yanlış kısıtlama operatör/sevkiyat ekranlarında müşteri adı ve PO göstermeyi bozar; bu yüzden sahibin matrisi olmadan taslak uygulanabilir değildir.
   - Seçenek A (önerilen): customers/orders/order_items yalnız ADMIN, MANAGEMENT, ACCOUNTING, SHIPPING, QUALITY, CAM, PURCHASING; operatör için müşteri adı iş emri üzerinden güvenli view.
   - Seçenek B: satır açık kalır, yalnız suppliers.contact_info ve personnel.auth_user_id kolon düzeyinde kapatılır.
   - Etki: `objectPassportApi` (suppliers.contact_info), `app.ts` (personnel auth_user_id ile ad), planlama/rota/akademi/gecko `personnel` listeleri kolon kullanır — Seçenek B bunları kırmaz, A kırar (görünüm gerekir).
2. **KAPANDI (taslak) — ticari onay çiftlenmesi**: `0077_commercial_approval_dedup.sql` + rollback; replica: aynı lota ikinci istek aynı satırı döndürür, doğrudan ikinci PENDING `DUPLICATE_PENDING_REFUSED`, karar sonrası yeni istek mümkün. Production'da ön kontrol sorgusu 0 satır olmalı.
3. **HAZIR, UYGULANMADI — audit_log kapsamı ve append-only**: `0074` (sertleştirilmiş, rollback ve replica kanıtlı; bkz. MIGRATION_0074_SECURITY_REVIEW.md). Canlıda hâlâ geniş okuma.
4. **Kolon yetkisi puantaj**: açık değil (kapalı). Önceki varsayım düzeltildi.
## RELEASE BLOCKER sınıflaması
- 0074 ve (Seçenek seçildikten sonra) 1. bulgu uygulanmadan "güvenlik kapandı" denemez; canlı bu iki açıkla çalışmaya devam ediyor. Manuel deploy paketinde ayrı DB paketi olarak sunulur; frontend yüklemesi bunlara bağlı değildir.
