# PAKET B — TAKIM LİSTESİ (.xlsx/.xls/.csv/.pdf) — YAYIN TALİMATI (SQL HENÜZ UYGULANMADI)
Durum: hazır, SQL için sahibin AYRI SON ONAYI bekleniyor. Bu pakette hiçbir şey production'a uygulanmadı.

## Kimlik ve hash'ler
- Frontend commit: `912d902e507a` (canlı Paket A `028c9148b9bb` üzerine; 0129/0130/Paket A dosyalarına dokunmaz).
- SQL 0132 SHA-256: `cf3875e9a6a3384d863f9cce680d0732a2ee05d95f84ca9075c0bd979883021a` (wrapper içindeki gömülü hash ile aynı; dosya değişirse HASH_MISMATCH ile durur).
- Wrapper SHA-256: `a60c0fc77ce683ca2710539f6570e2c7ca89052901b0220092af4a39cd896af9`
- Delta ZIP: `frontend/PaketB-takim-listesi-delta-912d902e507a.zip` (6 dosya, düz) · Geri dönüş: `frontend/PaketB-ROLLBACK-to-PaketA-028c9148b9bb.zip` (6 dosya; canlıdaki 6 dosya ile BAYT BAYT aynı olduğu canlıda doğrulandı).
- Tüm hash'ler: `SHA256SUMS.txt`, `SHA256_new_files.txt`, `SHA256_rollback_files.txt`.

## Kök neden
Storage bucket'ları MIME kısıtlamıyor. Engel, canlı `upload_document` içindeki beyaz liste: elektronik tablo MIME'ı yok, `toolist_file_kind` yok (0132 uygulanmamış).

## Bağımlılık
0132 yalnız 0106 nesnelerine ihtiyaç duyar (canlıda hepsi mevcut). 0131/0133 gerekmez, oluşturmaz, değiştirmez. 0129 ve 0130 kayıtlıdır ve değişmez.

## SIRA (zorunlu): 1) SQL  2) frontend
1. `sql/00_preflight_0132_readonly.sql` (salt okunur; tüm `ok` satırları true olmalı)
2. `sql/01_APPLY_0132_wrapper.sql` (SHA-256 kontrollü, tek işlem; ikinci çalıştırma ALREADY_APPLIED ile reddedilir)
3. `sql/02_postcheck_0132_readonly.sql` (salt okunur; tüm satırlar true)
4. Frontend delta ZIP'i yüklenir (kullanıcı yükler).
Geri dönüş: frontend `PaketB-ROLLBACK…zip`; SQL `sql/90_ROLLBACK_0132.sql` (kanıt tablolarında satır varsa DURUR, tekrar çalıştırmak güvenlidir).

## Canlıda ölçülenler (bugün, salt okunur preflight)
Tüm preflight satırları OK · 0128 pilot postcheck 10/10 · 0129+0130 kayıtlı · 0131/0133 yok · upload_document'ta elektronik tablo yok · bucket MIME kısıtı yok.
Başlatma kapısı etkisi: CAM programlı açık operasyon 0, aktif iş emri 0, yürürlükte takım listesi 0 → şu an hiçbir üretim engellenmez.
Önce/sonra karşılaştırma için kayıt: 0129 (13 işlev) md5 `fda1bc20ed9ee29d2ed8b28ce686fff6` (uygulamadan sonra AYNI olmalı) · upload_document/document_publish/dc_start_refusal md5 `16552adcbf0535077e3d0c8bddba540c` (uygulamadan sonra DEĞİŞMİŞ olmalı) · documents/versions 14/14 (aynı kalmalı).

## Güvenlik kapıları (gevşetilmedi)
Yeni liste TASLAK; yayın için hata yok + yetkili elle doğrulama (toolist_attest) + mevcut hazırla/kontrol/onay zinciri; yürürlükteki sürüm ezilmez; yeni sürüm yayını bağlı operasyonlar için yeniden kontrol açar ve başlatmayı bloklar; iş emri ilk başlatmada sürümü sabitler (append-only). Makrolu xlsx, uzantı/MIME/içerik uyuşmazlığı, octet-stream, boş dosya reddedilir (Türkçe hata). xlsx/xls/pdf içerik kontrolleri "SİSTEM DOĞRULAYAMADI"dır; asla sahte yeşil geçmez.

## Yerel testler (PASS) — canlı PASS değildir
0132 tek başına 9/9 · pilot izolasyon (0128 paketinin tamamı, 0132 uygulanmış) 88/0 · wrapper/postcheck/rollback 8/8 · ürün çalışma alanı UI 19/19 · hata metinleri 8/8 · Üretim Masası CNC 5/5 · ekranlar arası CNC tutarlılık 11/11 · tsc temiz.
Bulunan ve düzeltilen: 0132, 0128 pilot kayıt defterinde iki yardımcı işlevi (tg_toolist_pin, toolist_checks_core) sınıflandırılmamış bırakıyordu; 0132 artık bunları KEEP olarak kaydeder, rollback siler.

## Canlıda doğrulanacaklar (SQL + frontend sonrası, ben yapacağım)
.xlsx yükleme (TAKIM109.xlsx) → "Yüklendi: sürüm N — TASLAK"; açma/indirme; otomatik kontroller; yetkisiz kullanıcı yükleyemez; .xlsm / yanlış uzantı reddi. Gerçek üretim kaydı oluşturmam; test belgesi gerekirse sizin onayınızla ve işaretli olarak.
