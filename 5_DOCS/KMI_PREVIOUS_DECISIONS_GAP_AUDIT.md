# Önceki kararlar — boşluk denetimi (Faz 0)
Kaynaklar: `docs/OWNER_DECISIONS.md`, `docs/MASTER_REGISTER_STATUS.md`, `docs/RECOVERY_MATRIX.md`, `docs/REQUIREMENTS_MATRIX.md`, `RECOVERY_004_CLOSURE.md`. Eski KMI kaynağı çevrimdışı çizilemediği için "eski sürümde kaybolan özellik" karşılaştırması **kod düzeyinde değil, kayıt düzeyinde** yapıldı (OLD_KMI_CLOSURE_MATRIX.md).
| Karar / yönerge | Durum | Boşluk |
|---|---|---|
| Sunucu tarafı yetki (madde 2) | DONE | RLS `true` tabloları (müşteri/sipariş/tedarikçi/personel) yalnız arayüz kapısı → ayrı sahip kararı |
| V47 puantaj/prim değişmez | KORUNUYOR | 0073 (puantaj ayı) canlıda yok |
| D-001 puantaj adaleti | BLOCKED | sahip kararı |
| D-007 ekonomik sahip bağlama | BLOCKED | sahip |
| D-009 GEÇKO cron | KAPALI | sahip |
| D-013 maliyet parametreleri | BLOCKED | parametresiz tam maliyet gösterilmez |
| D-014 rapor zamanlayıcı | KAPALI | sahip |
| D-015 özel doküman deposu | KAPALI | sahip |
| D-016 ekonomik eşikler | ÖNERİ | sahip onayı yok |
| D-017 rozet eşiği | BEKLİYOR | sahip |
| D-018 girişsiz LIVE ekranı | KAPALI | sahip |
| Zaman/geçmiş (recovery-004) | PARTIAL/BLOCKED | `0074` taslağı, reddedilen girişim kaydı, olay≠kayıt zamanı |
| Yönerge 001 bölüm 3 (oturum) | MISSING | JWT yenileme |
| Bölüm C görsel sistem (yeni, onaylı) | NOT STARTED (madde 23/24) | Tasarım dili onaylandı; veri uydurulmayacak |
| Bölüm D 15 çalışma alanı | MISSING | mevcut 15 departman grubundan farklı; URL uyumu korunacak |
| Bölüm E İK/akademi/puantaj/GEÇKO | PARTIAL | maaş/işveren maliyeti kısıtlı rol, soft-deactivation: kod incelemesi Faz 3 |
| Bölüm F Müşteri&Sipariş merkezi | MISSING | `Katalog` hâlâ giriş; ürün pasaportu zengin değil |
| G1 Doküman merkezi | PARTIAL | D-015 kapalı |
| H1 Entegrasyon Kontrol Merkezi | PARTIAL | `Cihazlar` ekranı var; 15 alt bölüm yok, cihaz yazımı yok (dondurma) |
