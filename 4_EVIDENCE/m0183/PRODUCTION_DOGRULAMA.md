# m0183 + frontend yayını — production doğrulaması (01.11.2026, owner GO)

## Ön kontrol
- Son migration m0182_op_cycle_estimate (242 kayıt); m0183 nesneleri yoktu; bağımlı fonksiyon imzaları ve 36/36 referans sütun mevcut; audit_log append-only tetikleyicileri yerinde.
- 44 üretim/rota/iş emri/stok/belge tablosunun parmak izi: 90241e995c3bac58cf6ba37ff8fa75ce

## m0183 — PASS
- Migration kaydı: 20261031211158 m0183_op_prep_drafts (243 kayıt).
- RLS açık, politika 0; anon ve authenticated tabloya doğrudan erişemez.
- 4 RPC: SECURITY DEFINER, search_path='', yalnız authenticated çalıştırır; 5 yardımcı fonksiyon kimseye açık değil.
- 9 fonksiyon gövdesi test edilen dosyayla işlevsel olarak aynı (8 birebir; op_prep_save'de yalnız 4 yorum satırı farkı).
- Gerçek hesaplarla, geri alınan işlem içinde: yetkili okuma OK (can.edit/approve), operatör hesabı REVISION_NOT_FOUND, doğrudan tablo/yardımcı fonksiyon reddedildi, yalnız-editör onayı FORBIDDEN, OP30 taslağı OPP_SLOT_IN_ROUTING, anon reddedildi. Sonrasında taslak 0, audit 212, product_events 17 (değişmedi).

## Frontend — LIVE PASS (8c30a14, 13 dosya)
- Canlıdan yüklenen kod + production'dan okunan gerçek veri: CUT_PREP/OP10/OP20/OP40 kartları, OP30 kartı yok, otomatik belge ataması yok, OP30 bağlantı uyarısı, 4 durum + doğru düğmeler, salt okunur görünüm, hata gösterimi.
- Rota geçmişi: sürüm 3 → tek satır "Çevrim: tanımlı değil → 288 sn/parça"; sürüm 5 → "1453.nc · v1 → 1453_EXCELE_GORE_BASLIK_ASCII.nc · v2".
- Değişen 10 modül canlıda hatasız yükleniyor.
- Sınır: oturum açık tarayıcıda ekran içi tıklama testi yapılamadı (şifre girilmez); durum geçişleri sunucuda gerçek yetkilerle ve yerel uçtan uca testlerle doğrulandı.

## Değişmeyen üretim kayıtları
- Yayın sonrası parmak izi aynı: 90241e995c3bac58cf6ba37ff8fa75ce
- SA46054 iş emri ON_HOLD, 1500 planlı / 0 üretilen; Rev A RELEASED tek revizyon; rota yalnız OP30.
