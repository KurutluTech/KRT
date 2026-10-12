# Bilinen sınırlar (özet; ayrıntı matriste)
- Tüm kanıt YEREL (replica DB + headless tarayıcı). Canlı doğrulama yok. Sentetik rol hesapları; fabrika kabulü değil.
- DB paketleri uygulanmadı: 0071–0073 (canlıda yok → Puantaj "Kurulum bekleniyor"), 0074 (audit_log kapsamı canlıda hâlâ geniş), 0075–0078.
- RLS `true` (müşteri/sipariş/tedarikçi/personel) — BLOCKED, SAHİP KARARI (Seçenek A/B).
- TAHSİS: ekran ve veri modeli hazır ama 0076 gerekir; yönetişim (kontrol planı veri girişi, onay rolü, fiziksel ayırma, operatör beyanı) SAHİP KARARI.
- Maliyet Zekâsı: 19/22 sekme VERİ GEREKLİ; dağıtım/değerleme/işçilik eşleme kararı yok; .xlsx ertelendi.
- HOME: Üretim müdürü ve Takımhane için ayrı DB rolü yok; muhasebe ileri kartları (vade, mutabakat, üçlü eşleşme, dönem kapanışı), kalibrasyon, OTD = VERİ GEREKLİ.
- Fusion 360: kanıt yok, hiçbir iddia yok. Cihaz entegrasyonları (Nikken, LockCell, makine bağlantısı) BLOCKED.
- JWT: gerçek uygulama hatası (ağ hatasında oturum kapanması) düzeltildi, 16/16 yerel koşu yeşil; sahada doğrulanmadı.
- Replica VM yeniden başlatmaları beklenen davranıştır; otomatik hazırlama betiği vardır (test altyapısı).
