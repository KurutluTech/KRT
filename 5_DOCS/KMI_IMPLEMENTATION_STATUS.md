# Uygulama durumu (Faz 0 sonu)
Kod: `recovery-004` (16+ commit, tam regresyon 132/132, yerel). Canlı: `f42c9f0f292b`. Hiçbir uygulama/yayın yapılmadı.
- DONE (yerel kanıtlı): Giriş/başlık 2.0, LIVE 2.0, Komuta V2, Bakım kartları, olay geçmişi, pasaport çekirdeği.
- PARTIAL: Bkz. 54×22 matrisi A bölümü.
- MISSING (Faz 1–2 adayı, güvenli ve yerel): JWT oturum yenileme + 401 işleyici; PO benzersizlik (migration → yayın kapısı); başlık vardiya/bildirim; Entegrasyon Kontrol Merkezi alt bölümleri; Müşteri&Sipariş merkezi; gezinme yeniden yapısı (URL korunarak).
- BLOCKED: cihaz entegrasyonları (40–42), sahip kararları (D-001/007/009/013/014/015/016/017/018), 0074 uygulaması.
- DEFERRED: ekonomik BI, tarihsel işlem geçmişi taşıma.
Sıradaki güvenli adım: Faz 1 — (a) oturum yenileme (istemci, test edilebilir, migration gerekmez), (b) tasarım sistemi belirteçleri (Bölüm C), (c) gezinme yeniden yapısı.

## Kuyruğa alınan sahip yönergeleri (12 Eki, 22:06 ve 22:35) — 54 madde sırası DEĞİŞMEDİ
- KMI-HOME-001 + Birleşik devam yönergesi (Faz 1 + HOME + TAHSİS): bkz. `KMI_HOME_001_STATUS.md`. 
- **TAHSİS tanımı çözüldü** (boyutsal düzeltme). Durum: tanım DONE; veri modeli / UI / iş akışı / test / yayın hepsi MISSING. İş akışı: DETECTED → SEGREGATED/HOLD → TECHNICAL ASSESSMENT → REWORK AUTHORIZED → REWORK IN PROGRESS → REINSPECTION → ACCEPTED/REJECTED/FURTHER REVIEW. Bağımlılıklar: kontrol planı (MISSING), kalite HOLD/NCR (var), operasyon olayları (var), `production_declarations` çift sayım koruması, OEE kalite, maliyet, puantaj (V47 değişmez).
- Açık tutulan Faz 0 boşlukları: müşteri PO tekrarı, kontrol planı, operatör başına maks 3 aktif iş emri, Fusion 360 kanıtı.
- Güvenlik bulguları AÇIK: audit_log okuma kapsamı, append-only, RLS `true` (müşteri/sipariş/tedarikçi/personel), ticari onay çiftlenmesi, 0074 onaysız.
- recovery-004: **LOCAL VERIFIED / PRODUCTION NOT DEPLOYED**.

## Güncelleme (HEAD 61485c8+)
- DONE (yerel): JWT yenileme (+ geçici ağ hatasında oturum korunur), PO benzersizlik/ticari onay tekilleştirme/kontrol planı/TAHSİS taslakları (0075–0077, uygulanmadı), TAHSİS ekranı (e2e 6/6, 0076 gerekir), Maliyet Zekâsı çalışma alanı (0078 taslak), HOME 15 görünüm, fabrika haritası/matris/Zekâ özeti, güvenlik görünürlük matrisi, çoğaltma (replica) otomatik hazırlama.
- Düzeltme: "operatör başına maks 3 iş emri" açık DEĞİL; `HARD_CAP_EXCEEDED` zaten var.
- BLOCKED — OWNER DECISION: RLS `true`, TAHSİS yönetişimi, maliyet dağıtım/değerleme politikaları. BLOCKED: Fusion 360 kanıtı, cihazlar.
- Tam matris: `KMI_APPROVED_SCOPE_COMPLETION_MATRIX.md`.
