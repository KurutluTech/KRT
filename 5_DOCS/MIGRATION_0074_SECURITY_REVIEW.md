# 0074 — Güvenlik İncelemesi (TASLAK; canlıya UYGULANMADI)
Dosyalar: `supabase/drafts/0074_temporal_audit_hardening.sql`, `0074_rollback.sql`; testler: `supabase/verification/temporal_draft.sql`, `temporal_draft_rollback.sql` (kopya Postgres, işlem sonunda ROLLBACK). Canlı DB'ye hiçbir sorgu/yazma yapılmadı.

| Alan | Bulgu (mevcut durum) | Taslağın düzeltmesi | Kanıt (kopya) | Kalan risk |
|---|---|---|---|---|
| Denetim değiştirilemezliği | Yetkili rol audit satırını UPDATE/DELETE/TRUNCATE edebiliyor | Tetikleyici (UPDATE/DELETE/TRUNCATE → `AUDIT_APPEND_ONLY`) + API rollerinden `REVOKE` | update/delete/truncate hepsi reddedildi | Tablo sahibi/süper kullanıcı tetikleyiciyi kapatabilir; canlıda sahibin kim olduğu ve yetkiler ÖNCEDEN okunarak doğrulanmalı |
| Okuma kapsamı | Giriş yapmış her kullanıcı para dışı tüm audit satırlarını okuyor (operatör bakım satırlarını gördü) | Rol→nesne tipi matrisi (`audit_read_scope`), kişi kendi eylemlerini görür | Operatör: bakım bileti satırı 0; yönetim hepsini görüyor | **Matris bir ÖNERİ.** Yanlış matris QA/bakımın görmesi gereken kaydı gizler |
| RLS | `audit_log` politikası yalnız para filtresi | Politika = para filtresi VE kapsam | yukarıdaki sayımlar | Müşteri/sipariş/tedarikçi/personel tablolarının RLS `true` durumu bu migrasyonun kapsamı DIŞINDA, ayrı karar |
| Aktör kimliği | Satır `actor_user_id` yazıcıdan geliyor | Değişmedi; `role_context` yazma anındaki rolleri sunucuda ekler | `role_context={MAINTENANCE}` | Yazıcı başka birinin id'sini verirse tetikleyici düzeltmez (her yazıcıda `auth.uid()` kullanıldığı ayrıca denetlenmeli) |
| Zaman bütünlüğü | `at` sunucu saati; olay zamanı yok | `occurred_at` yalnız anlamlıysa (kayıttan ≤1 dk sonra) kabul; gelecek/çöp atılır | late/future/junk testi | Geçmişe tarih atma mümkün: `occurredAt` veren yazıcılar yetkiyle sınırlanmalı. Şu an hiçbir yazıcı göndermiyor |
| Security-definer | — | Yeni definer fonksiyonlar `search_path=''`, tam nitelikli adlar, `public/anon` revoke | `audit_fill_context` hiçbir API rolüne açık değil | `txn_correlation` ve scope fonksiyonları `authenticated`'a açık (zararsız: yalnız boolean/uuid) |
| Yetki yükseltme | — | Notlar yalnız `add_object_note()` ile; doğrudan INSERT/UPDATE revoke; rol kapsamı kontrolü | op_note_ticket=NOTE_NOT_AUTHORIZED, ghost=NOT_FOUND | — |
| Tarihsel veri | — | Yalnız ekleme; eski satırlarda yeni kolonlar NULL, `outcome` varsayılan SUCCESS (başarısız yazımlar zaten geri alınıyordu) | — | Eski satırlarda `role_context` yok (geriye dönük uydurulmadı) |
| Geri alma / uyumluluk | — | `0074_rollback.sql`: tetik, politika, kolon, tablo, 0058 yardımcıları birebir geri | cols_left=0 notes=0 triggers=0 | Kolonları düşürmek yazılmış `role_context/correlation_id` değerlerini siler → önce yedek tablo |
| Reddedilen girişim kaydı | PostgreSQL yazıcı hatasında kendi audit insert'ünü de geri alır | ÇÖZÜLMEDİ (BLOCKED) | — | Karar: yazıcı başına sarmalayıcı mı, Edge Function geçidi mi |

## Önerim (sıra)
1. **A+B (kolonlar + salt-ekleme + revoke)**: düşük risk, geri alınabilir; önce bunlar.
2. **C (okuma kapsamı)**: matrisi sizinle rol rol onaylayalım; onaysız uygulamam.
3. **D/E (notlar, görev kaynak türleri)**: ürün özelliği, güvenlik değil; sonra.
4. Uygulama öncesi (yalnız okuma): canlıda `audit_log` sahibi/yetkileri, UPDATE/DELETE kullanan kod/fonksiyon yok mu, satır sayısı. Üretim kapısı: açık yazılı onayınız.
