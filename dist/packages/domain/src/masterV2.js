const T = `
001|AppShell ve navigasyon|Rol, izin, route, session|Adobe Spectrum düzeyi semantik renk, KPI iş-etkisi trendi, tipografi, kart, responsive, erişilebilirlik; ortak scan/print UI sözleşmesi (tam QR uygulaması 081)|S,P|Ortak tarama/baskı arayüz bileşenlerinin sahibi; kendi nesne kimliği yok|081,083|Tarama yetki vermez; kiosk çıkışı korunur
002|Akıllı Ana Sayfa|Görev, risk, izin, bildirim|Kişiye özel görev ve risk odaklı ana ekran; hedef-gerçekleşen ve tazelik|N|Tüketici görünüm; nesne kimliği/baskı yok (görevlere 003 kimliğiyle gider)|001,003,079|Ekonomik/personel kartları yetkiye bağlı
003|Görevlerim|Task, assignee, due date, evidence|QR ile görev nesnesine erişim; kanıtlı bildirim ve tamamlama|I,S|Görev kendi kimliğine sahip; QR görevi açar, tamamlamayı yetki belirler|081,083|Tarama görev yetkisi vermez
004|Onaylarım|Approval, actor, policy, event|Tek onay backend'i; rol bazlı onay; tarama onayı bypass edemez|S|Onay belgesi 081 pasaportu ile açılır; onayı tarama vermez|069,083|Onay yalnız sunucu yetkisiyle
005|Evrensel Arama|Yetkili nesne indeksleri|QR/1D kodu ve nesne ID ile arama; izinli pasaport bağlantısı|S|Kod ile arama = 081 resolve çağrısı; ikinci indeks yok|081,083|Yetkisiz nesne sonuçta görünmez
006|Müşteri ve İlişki Yönetimi|Customer, contacts, permissions|Müşteri/iş kârlılığı yalnız ekonomik yetkiyle; müşteri tanıtım/çıktı erişimi denetimli|I,P|Müşteri kimliği 081 registry; müşteri belgesi baskısı yetkili|081,070,083|Ticari sır; baskı sunucu yetkisi
007|Teklif ve Talep|RFQ, product, routing, costing|Teklif miktar kademeleri; setup/cycle/takım/kalite/dış operasyon maliyeti; kapasiteye bağlı gerçekçi termin; tahmin güveni; quote-vs-actual (070); tekliften siparişe kayıpsız dönüşüm|I,P|Teklif belgesi kimlik + baskı; maliyet modeli 070'ten gelir|008,009,011,015,070,081|Ekonomik veri yetkili; tam modül erken geliştirilmez
008|Sipariş Komuta Merkezi|Order, line, shipment obligation|Teklif→sipariş→WO kayıpsız dönüşüm; revizyon ve teslim yükümlülüğü; müşteri belgesi baskı şablonu|I,S,P|Sipariş/kalem kimliği; sipariş onayı belgesi baskısı|007,013,064,081|Ticari belge baskısı yetkili
009|Ürün Master ve Digital DNA|Product, revision, operation, quality|Tekil ürün/revizyon kimliği; AI BOM taslağı yalnız onaylı değişiklikle; ürün QR pasaportu|I,S|Ürün+revizyon kimliği değişmez; eski revizyon kodu geçersiz uyarısı|010,011,081|AI taslağı onaysız yayınlanmaz
010|Doküman ve Revizyon Kontrolü|Document, revision, attachment|Revizyonlu teknik doküman; baskıda sürüm/tarih ve geçersiz baskı kontrolü|I,S,P|Doküman kimliği; baskı güncelliği tarama ile sunucuda doğrulanır|009,081|Eski revizyon otomatik geçerli sayılmaz
011|Routing ve Operasyon Planı|Routing, operation, machine capability|Operasyon ID; her operasyon için tekil job traveler barkodu/QR; setup ve kalite kapıları|I,S,P|Operasyon kimliği 081 registry; traveler 013/081 şablonu|009,013,040,081|Yanlış operasyon taraması reddedilir
012|Planlama Kokpiti|Order, WO, machine queue|Kapasite yükü, termin riski, darboğaz görselleştirmesi; kaynak ve dönem bilgisi|N|Görünüm paketi; kendi nesnesi yok|015,017,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
013|İş Emri Yönetimi|Work order, routing, quantities|Job traveler A4/A5; WO+operasyon barkodu/QR; yetkili scan-to-action; duplicate kayıt engeli|I,S,P|WO kimliği; ilk dikey örnek (WO→QR→pasaport→işlem→audit→baskı)|011,081,083,057|Çift WO/çift üretim idempotency
014|Makine ve Operatör Atama|WO, machine, skills, shift, health|Alternatif makine/operatör senaryosu; beceri, bakım, takım, vardiya, setup kısıtları|S|Atama taramayla başlatılabilir; kısıtlar canonical|013,071,076|Personel verisi yetkili
015|Kapasite ve Sonlu Çizelgeleme|Shift calendar, downtime, setup|Sonlu kapasite, what-if çizelgeleme, acil işin diğer terminlere etkisi; varsayım ve risk; kapasiteye dayalı fiyat/termin girdisi|N|Hesap paketi; çıktısı 007/012'ye servis edilir|007,012,017|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
016|Malzeme ve Takım Hazırlık Kapısı|Inventory, CAM, assembly, maintenance|Malzeme/CAM/takım/kalite/bakım readiness; fail-closed bilinmeyen; tarama release bypass etmez; malzeme ihtiyaç tahmini|S|Hazırlık kapısı; tarama yalnız kanıt ekler|022,055,057,083|Bilinmeyen = hazır değil
017|Termin ve Gecikme Analizi|Order line, shipment, schedule|Gecikme danışmanı; kaynak kanıtlı risk/öneri; yönetici onayı|N|Analiz; kendi nesnesi yok|064,015|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
018|CAM Kokpiti|WO, routing, NC program|Program hazırlığı ve kaynaklı readiness görselleştirmesi|N|Görünüm paketi|019,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
019|NC Program Yönetimi|NC program, machine, revision|NC program/revizyon kimliği; program barkodu/QR ve yanlış revizyon engeli|I,S,P|Program+revizyon kimliği; yanlış revizyon fail-closed|081,083|Eski revizyon bloklanır
020|Setup ve İş Talimatı|Setup sheet, fixture, tool list|Setup föyü ve baskısı; makine/operasyon/fikstür ilişkilendirmesi|I,P|Setup föyü belgesi kimlik + baskı|011,021,081|Revizyon kontrollü baskı
021|Fikstür ve Aparat Yönetimi|Fixture, machine, operation|Fikstür tekil QR; bakım/uygunluk geçmişi|I,S,P|Fikstür kimliği + etiket|081,049|Etiket baskısı yetkili; tarama bakım kararı vermez
022|CAM–Takımhane Hazırlığı|Tool requirement, assembly, WO|CAM–Toolroom ortak hazırlık kapısı; eksik takım ve zaman riski|S|Montaj/takım taraması 024/025 kimliğiyle|016,024,025|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
023|Takımhane Kokpiti|WO, tool assembly, cabinet event|Takımhane operasyon paneli; kritik takım hazırlığı ve stok trendi|N|Görünüm paketi|024,028,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
024|Takım Kataloğu ve Envanter|Tool item, instance, holder|Takım kimliği; lokasyon, tüketim, maliyet; QR/1D etiket|I,S,P|Takım item/instance kimliği + etiket|081,057|Maliyet yetkili
025|Tool Assembly|Assembly, holder, cutting item|Takım montaj pasaportu; seri/komponent kimliği ve etiket|I,S,P|Montaj kimliği + etiket|024,081|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
026|Nikken Preset|Preset measurement, device, assembly|Nikken ölçüm çıktısı, presetter veri doğrulaması; gerçek cihaz testine bağlı|S|Ölçüm montaj kimliğiyle eşlenir; cihaz bağlantısı BLOCKED|025,082|Canlı cihaz için ayrı onay
027|LockCell Hareketleri|Vendor event, item, custody|LockCell teslim/alım scan; API/güvenlik gate korunur|S|Hareket takım kimliğiyle eşlenir|024,082,083|Satıcı API anahtarı sunucuda
028|Takım Kullanımı ve Ömrü|Tool event, machine, session|Takım ömrü, parça başına maliyet, kullanım, kırılma ve yenileme|N|Hesap; kimlik 024/025'ten|024,070|Maliyet yetkili
029|Takımhane Analitiği|Tool lifecycle and WO events|Takım tüketimi ve ömür trendi; maliyet/üretim korelasyonu|N|Analitik görünüm|028,070|Maliyet yetkili
030|Üretim Kokpiti|WO, machine, session, quality|Üretim hedef-gerçekleşen, darboğaz ve istisna kokpiti|N|Görünüm paketi|032,035,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
031|Makine Parkı ve Dijital Makine Kartı|Machine, condition, maintenance|Makine QR kimliği; fiziksel CNC state ile manuel WO ayrı; gerçek tazelik|I,S,P|Makine kimliği + QR etiket|081,047|Fiziksel çalışma iddiası yok
032|Shop Floor Live|Machine session, operator, shift|Operatör mobil scan-to-action; iş başlat/duruş; donanım verisi yoksa fiziksel çalışma iddiası yok; mobil shop-floor veri toplama|S|Makine+WO taraması işlem başlatır; yetki ve kurallar sunucuda|031,033,081,083|Tekrar tarama çift oturum açmaz
033|Operatör İş Ekranı|Assigned WO, session, identity|Tek okutmayla atanmış WO/operasyon; güvenli rol doğrulaması ve kısa iş akışı|S|Okutma → atanmış iş; yetkiyi oturum verir|032,081,083|Operatör Sicil+PIN backend canlı değil
034|Üretim Adet ve Fire Beyanı|Production event, quantity, quality|Sağlam/rework/hurda ayrımı; tekil scan event ve idempotent miktar kayıtları|S|Tekil scan event idempotency anahtarı|057,044,081|Çift beyan engeli
035|Duruş ve Kayıp Yönetimi|Downtime event, machine, WO|Duruş nedeni, süre, iş emri ilişkisi ve analitik|N|Olay kaydı makine/WO kimliğiyle; kendi baskısı yok|031,051|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
036|Vardiya ve Devir|Shift, session, handover|Vardiya kapanışı/teslim fişi; eksik beyan uyarısı ve kanıt|P|Devir fişi baskısı; kendi QR nesnesi yok|072,081|Personel bilgisi yetkili
037|Üretim Operasyon Geçmişi|Production event, audit, WO|Operasyon geçmişi, job traveler ve yazdırılabilir denetim izi|P|Geçmiş baskısı mevcut kimliklerle|013,081|Denetim izi baskısı yetkili
038|Kalite Kokpiti|Inspection, NCR, hold, WO|Kalite karar kuyruğu; FPY/HOLD/NCR; UNKNOWN=0 değil|N|Görünüm paketi|043,046,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
039|Giriş Kalite Kontrol|Receiving, lot, certificate|Giriş kalite lot/sertifika QR, ölçüm ve kabul izleri|S,P|Lot/sertifika kimliği 055/058'den|055,058,081|Kabul kararı sunucuda
040|First Piece Release|Control plan, revision, measurement|İlk parça geçiş kapısı; cihaz/karakteristik/kalibrasyon; QR iş emri|S|WO taraması ilk parça ekranını açar; geçişi kalite kuralı verir|011,041,081|Eksik ilk parça release engeller
041|Proses İçi Ölçüm|Inspection result, device, feature|Optik profil ölçüm sistemi ADAY (marka/model/protokol DOĞRULANMADI); nominal-gerçek-tolerans, cihaz kimliği ve izlenebilirlik|I,S|Ölçüm cihazı kimliği; entegrasyon veri örneği gelene kadar BLOCKED|082,040,042|Çalışır entegrasyon iddiası yok
042|Uygunsuzluk ve NCR|NCR, defect, corrective action|NCR ve CAPA ilişkilendirmesi; tekrar eden uygunsuzluk trendi; CAPA ve kalibrasyon sahibi|I,P,S|NCR/CAPA kimliği + HOLD/NCR etiketi|043,046,081|Kalite kararı yetkili
043|Quality HOLD ve Release|Canonical hold, actor, evidence|Canonical server HOLD/release; QR okutma HOLD kaldırmaz|I,S,P|HOLD kaydı + HOLD etiketi; release yalnız yetkili karar|081,083|QR HOLD kaldıramaz
044|TAHSİS ve Hurda|Rework, scrap, quantity|Rework/scrap neden ve maliyet; operasyon ve lot bağı|I,P|TAHSİS/NCR kaydı kimlik + form|042,070|Maliyet yetkili; 0076 uygulanmadı
045|Final Quality|Final inspection, release|Final kalite ve shipping gate; imzalı/onaylı çıktı|P|Final kalite belgesi baskısı|043,062,081|İmza/onay sunucuda
046|Kalite Analitiği|Inspection, NCR, production|FPY, scrap, NCR, kalibrasyon ve CAPA trendleri; geçerli payda/dönem|N|Analitik görünüm|042,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
047|Bakım Kokpiti|Machine condition, maintenance|Bakım risk, arıza ve gecikme görselleştirmesi|N|Görünüm paketi|048,051,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
048|Arıza Bildirimi|Fault event, machine, actor|Makine QR ile arıza kaydı; duplicate ve yetki koruması|S|Makine taraması arıza açar; çift kayıt engelli|031,081,083|Tekrar tarama çift arıza açmaz
049|Bakım İş Emri|Maintenance WO, parts, labor|Bakım iş emri/etiket ve teknisyen tarama akışı|I,S,P|Bakım WO kimliği + form/etiket|048,050,081|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
050|Yetkili Test ve Return to Service|Maintenance test, authorization|Test/return-to-service yetki kapısı; QR ile bypass yok|S|Tarama yalnız bağlam açar; geçişi yetki verir|049,083|QR bypass edemez
051|Önleyici Bakım ve Analitik|Maintenance, runtime, downtime|MTTR/MTBF yalnız doğrulanmış olay kayıtlarından|N|Analitik; veri yetersizse gösterilmez|035,048|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
052|Satınalma Kokpiti|Purchase request, PO, supplier|Satınalma talep/teslim riski ve kaynaklı stok ihtiyacı|N|Görünüm paketi|053,054,016|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
053|Satınalma Talebi ve RFQ|Request, RFQ, quotation|PR/RFQ belge kimliği ve onay; QR tarama otomatik satınalma yetkisi vermez|I,P|PR/RFQ belge kimliği + baskı|081,083|Fiyat bilgisi yetkili
054|PO ve Tedarikçi Yönetimi|PO, supplier, delivery|PO, tedarikçi teslimat uyumu ve revizyonlu baskı|I,P|PO kimliği + revizyonlu baskı|053,055,081|Ticari belge baskısı yetkili
055|Mal Kabul|Receipt, PO, lot, certificate|Mal kabul lot/belge QR; custody ve kalite giriş kapısı|I,S,P|Lot/mal kabul kimliği + lot etiketi|054,039,057,081|Çift giriş engelli
056|Depo Kokpiti|Inventory ledger, location|Depo kritik stok ve ayrılmış miktar görselleştirmesi|N|Görünüm paketi|057,058,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
057|Canonical Stok Hareketleri|Inventory movement, hold, reservation|Canonical hareket defteri; scan ile çift stok hareketini idempotency engeller|I,S|Hareket kimliği + idempotency anahtarı; ikinci stok sistemi yok|058,081|Çift stok hareketi engeli
058|Lokasyon, LOT ve Sayım|Location, lot, count|Raf/konum/lot QR ve çevrim sayımı; FIFO/lot trace|I,S,P|Lokasyon/lot kimliği + raf/lot etiketi|057,081|Yetkili stok düzeltmesi
059|Üretime Çıkış ve WIP|Issue, WO, WIP ledger|WO malzeme tahsisi, tüketim ve WIP scan|S|Lot+WO taraması issue/iade başlatır|057,013,081|Çift issue engelli
060|Bitmiş Ürün Deposu|Finished goods, release|Bitmiş ürün lot/koli etiketi, kalite ve sevkiyat readiness|I,S,P|FG lot/koli kimliği + etiket|045,062,081|HOLD'lu ürün sevke uygun değil
061|Sevkiyat Kokpiti|Shipment, order, release|Sevkiyat hazırlık ve gecikme riski; açık teslim yükümlülüğü|N|Görünüm paketi|064,062,001|Sevk tamamlandı ≠ açık yükümlülük
062|Sevkiyat Hazırlığı|FG, quality release, staging|Koli/palet etiketleri; scan doğrulama; HOLD/eksik sevk gate|I,S,P|Koli/palet kimliği + etiket|060,043,081|HOLD gate fail-closed
063|İrsaliye ve Sevkiyat Kaydı|Shipment, delivery note, audit|İrsaliye/teslimat belgesi tek standart baskı; sevk idempotency|I,P|Sevkiyat/irsaliye kimliği + baskı|062,064,081|Ticari belge baskısı yetkili; çift sevk engelli
064|Teslimat Yükümlülüğü|Order line, shipment ledger|Tamamlanmış sevk ≠ açık yükümlülük; parsiyel sevk ve overdue doğruluğu|N|Hesap; kimlikler 008/063'ten|008,063|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
065|Muhasebe Kokpiti|Commercial document, posting|Muhasebe belge eşleştirme; ekonomik veriye sıkı erişim|N|Görünüm paketi|066,067,083|Ekonomik veri yetkili
066|Fatura ve Cari İşlemler|Invoice, AR/AP, customer|Fatura/AR/AP belge ve yazdırma yetkisi; çift veri girişi azaltma|I,P|Fatura/cari belge kimliği + baskı|067,081,083|Baskı yetkisi sunucuda
067|Muhasebe Defteri ve Dönem Kapanışı|Ledger, journal, period|Dönem kapanışı ve ledger; tek kanonik ticari olay|I,P|Yevmiye/dönem kimliği + rapor baskısı|066,083|Ekonomik yetkili; kapanış audit
068|Yönetim Komuta Merkezi|Task, order, risk, machine|Yönetim karar panosu; trend iş etkisi (yukarı=iyi varsayma)|N|Görünüm paketi|001,079|Ekonomik kartlar yetkili
069|Yönetim Onay Merkezi|Approval, policy, actor|Yetki, audit ve tek onay backend; kritik release kapıları|S|Onay belgesi 081 pasaportuyla; onay sunucuda|004,081,083|Tarama onay vermez
070|Cost Intelligence|Cost ledger, WO, tool, labor|Titan Gilroy + JobBOSS² benchmark: quote-vs-actual; setup/çevrim, makine saati, takım ömrü, malzeme, işçilik, kalite, hurda, overhead, lot, marj, müşteri/iş/parça/makine kârlılığı; senaryo; varsayım ve veri güveni (kaynak videolar ayrıca doğrulanacak)|P|Maliyet raporu baskısı yetkili; kimlik yok (nesneler diğer paketlerden)|007,028,044,066|Gizli ekonomik veri; 0086/0087 uygulanmadı
071|Personel ve Yetkinlik Pasaportu|Personnel, skill, assignment|Personel beceri pasaportu; hassas yetki, kimlik ve eğitim|I,S|Personel kimliği; rozet/QR gizli veri taşımaz|074,081,083|Personel verisi yalnız yetkili
072|Vardiya ve Puantaj|Shift, attendance, session|Vardiya/puantaj; çoklu makine ilişkisi; kaynaklı süre|N|Kayıt; kimlik 071'den|071,036|Personel verisi yetkili
073|Prim ve Performans|Bonus period, score, evidence|Prim havuzu ve audit; üretim/kalite koşulları; gizli ücret verisi korunur|P|Prim raporu baskısı yetkili|072,083|Gizli ücret verisi
074|KMI Academy|Training, assessment, skill|QR ile eğitim içeriği/istasyon tanıtımı; yetkinlik doğrulama|I,S|Eğitim/istasyon kimliği|071,081|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
075|Rozet ve Gelişim Sistemi|Badge rule, evidence, skill|Kanıta dayalı rozet; kişisel profil ve oyunlaştırma|N|Kayıt; kendi kimliği/baskısı gerekmez|074,071|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
076|Smart Assignment|WO, machine, skills, shift|Açıklanabilir makine/operatör ataması; canlı uygunluk ve insan onayı|N|Öneri motoru; nesneler başka paketlerde|014,071|İnsan onayı zorunlu
077|Performance Center|Canonical machine, WO, quality|Makine parkı, OEE kayıpları, hedef-gerçekleşen, tek canonical metrik|N|Görünüm paketi; kimlikler 031/013'ten|001,031|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
078|KMI LIVE|Shop-floor event, freshness|LIVE görselleştirmesi; gerçek CNC verisi yoksa fiziksel durum iddiası yok|N|Görünüm paketi|032,001|Yetki ve revizyon kuralları ilgili paketin canonical kaynağından
079|PULSE ve İstisna Merkezi|Rule events, anomalies, tasks|PULSE anomali/olay; tazelik, iş etkisi ve görev yönlendirmesi; olay tabanlı bildirimler|N|Olay/kural motoru; nesne kimliği başka paketlerden|003,084|Bildirimde gizli veri yok
080|Rapor ve Analitik Kütüphanesi|Canonical snapshots, reports|Rol bazlı rapor ve dashboard; grafik+drilldown+standart çıktı; erişim filtresi|P|Standart rapor çıktısı ortak baskı şablon kaydıyla|081,083,001|Baskı yetkisi sunucuda
081|QR ve Nesne Pasaportları|13 onaylı entity type, audit|UNIVERSAL IDENTITY & SCAN/PRINT ANA SAHİP: benzersiz ID; QR/Code128; job traveler, lot, takım, raf, koli; kamera/HID; scan→resolve→auth→validate→confirm→audit; pasaport tanıtımı; baskı/etiket şablonu; sürüm ve idempotency|I,S,P|Ana sahip: kimlik registry, resolve, scan event, şablon kaydı, baskı işi/audit|001,083|QR içine sır gömülmez; migration üretime uygulanmaz
082|Entegrasyon Merkezi|Connector events, device health|CNC, Nikken, LockCell, GEÇKO ve optik profil ölçüm sistemi aday entegrasyonu; protokol, güvenlik, read-only keşif, cihaz doğrulaması|I|Cihaz kimliği; canlı cihaz bağlantısı BLOCKED (owner onayı gerekir)|026,027,041,083|Canlı cihaz yok; mock üretim kanıtı değil
083|Sistem Yönetimi ve Güvenlik|Identity, role, session, audit|QR erişim anahtarı değildir; RLS, auth, revocation, scan/print audit, PIN backend, 63 USING(true) politikası tek tek risk incelemesi|N|Güvenlik sahibi; kendi nesnesi yok (tüm scan/print kurallarını denetler)|081|Kapılar gevşetilmez
084|Factory Intelligence|Canonical events, KPI, evidence|Deterministik olay kuralları + açıklanabilir AI rehberlik; kaynak, etki, öneri, görev, eskalasyon|N|Analitik motor; nesne kimliği yok|079,001|AI öneri onaysız eyleme dönmez
`;
export const MASTER_V2_PACKAGES = T.trim().split('\n').map((ln) => {
    const [n, name, canonical, v2, cls, reason, deps, security] = ln.split('|');
    return { id: `KMI-${n}`, name: name, canonical: canonical, v2: v2, cls: cls.split(','), reason: reason, deps: deps.split(',').map((d) => `KMI-${d}`), security: security };
});
// ONE owner per cross-cutting capability (consumers reuse it; nobody re-implements it). BLOCKED/candidate items are marked, never "ready".
export const CAPABILITY_OWNERS = [
    { program: 'A JobBOSS²', capability: 'Teklif→sipariş→WO kayıpsız dönüşüm', owner: 'KMI-007', consumers: ['KMI-008', 'KMI-013'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Kapasiteye dayalı fiyat/termin + sonlu kapasite + what-if', owner: 'KMI-015', consumers: ['KMI-007', 'KMI-012', 'KMI-017'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Malzeme ihtiyaç tahmini', owner: 'KMI-016', consumers: ['KMI-052'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Mobil shop-floor veri toplama', owner: 'KMI-032', consumers: ['KMI-033', 'KMI-034'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Job traveler ve operasyon etiketleri (şablon)', owner: 'KMI-081', consumers: ['KMI-011', 'KMI-013', 'KMI-037'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Kalite CAPA ve kalibrasyon', owner: 'KMI-042', consumers: ['KMI-040', 'KMI-041', 'KMI-046'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Gerçek maliyet, kârlılık ve sapma', owner: 'KMI-070', consumers: ['KMI-006', 'KMI-007', 'KMI-029'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Olay tabanlı bildirimler', owner: 'KMI-079', consumers: ['KMI-002', 'KMI-003'], state: 'PLANNED' },
    { program: 'A JobBOSS²', capability: 'Rol bazlı dashboard', owner: 'KMI-080', consumers: ['KMI-002', 'KMI-068'], state: 'PLANNED' },
    { program: 'B Scan/Identity/Print', capability: 'Evrensel kimlik, resolve, scan event, şablon ve baskı kaydı', owner: 'KMI-081', consumers: ['KMI-013', 'KMI-024', 'KMI-031', 'KMI-055', 'KMI-062'], state: 'PLANNED' },
    { program: 'B Scan/Identity/Print', capability: 'Scan/print yetki, revocation ve audit güvenliği', owner: 'KMI-083', consumers: ['KMI-081'], state: 'PARTIAL' },
    { program: 'B Scan/Identity/Print', capability: 'Ortak scan/print UI bileşenleri', owner: 'KMI-001', consumers: ['KMI-081'], state: 'PARTIAL' },
    { program: 'C Cost Intelligence', capability: 'Teklif/gerçekleşen maliyet modeli ve veri güveni', owner: 'KMI-070', consumers: ['KMI-007'], state: 'PLANNED' },
    { program: 'D Signature UX', capability: 'Tasarım tokenları, semantik renk, KPI trend, grafik kiti', owner: 'KMI-001', consumers: ['KMI-077', 'KMI-078', 'KMI-068'], state: 'PARTIAL' },
    { program: 'E Optik profil ölçüm', capability: 'Ölçüm verisi eşleme ve tolerans kanıtı', owner: 'KMI-041', consumers: ['KMI-040'], state: 'CANDIDATE_BLOCKED' },
    { program: 'E Optik profil ölçüm', capability: 'Cihaz bağlantısı (read-only keşif)', owner: 'KMI-082', consumers: ['KMI-041'], state: 'CANDIDATE_BLOCKED' },
];
