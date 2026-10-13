// KMI — Maliyet Zekâsı (Item 36, KMI-COST-INTELLIGENCE-001). TEK çalışma alanı, 22 iç sekme (22 menü girişi DEĞİL).
// Dürüstlük kuralı: her sekme durumunu açıkça yazar — HESAP MOTORU HAZIR / ÖNİZLEME / VERİ GEREKLİ. Elle girilen sayılarla çalışan
// hesaplayıcılar "SİMÜLASYON / TAHMİNİ" etiketlidir ve hiçbir kayıt yazmaz. Eksik veri hiçbir yerde 0 gösterilmez. Para görüntülemesi
// yalnız ekonomik erişimi olanlara açılır (route kuralı /maliyet → economics); sunucu RLS'i asıl sınırdır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { breakEvenUnits, energyPriceScenario, machineHourCost, toolingCost, unitCost } from '../../../../packages/domain/src/costIntelligence.js';
import { EXT_EXTRA, EXT_TOOLS, figureText } from './costCalcs.js';
import { parseCsv, stageExpenseRows } from '../../../../packages/domain/src/costImport.js';
import { readXlsx, XlsxError } from '../../../../packages/domain/src/xlsxRead.js';
import { stateBox } from '../ds.js';
import { renderCentersPanel, renderClosePanel, renderExpensePanel, renderLiveBoard, renderReconPanel } from './CostOpsPanels.js';
export const COST_TABS = [
    { id: 'live', n: 1, title: 'Fabrika Ekonomisi (Canlı)', state: 'DATA_REQUIRED', needs: 'Onaylı gider kayıtları (0078 DB paketi + ilk içe aktarma) ve canlı üretim olayları üzerinden dönemsel toplam. Henüz yok → "bugün ne harcandı" sorusuna cevap verilemez.' },
    { id: 'expense', n: 2, title: 'Gider Yönetimi', state: 'DATA_REQUIRED', needs: 'cost_categories / cost_expenses tabloları (0078 taslağı, uygulanmadı).' },
    { id: 'structure', n: 3, title: 'Sabit & Değişken Yapı', state: 'PREVIEW', needs: 'Kategori davranışı 0078 kategorilerinde tanımlı; kayıtlı gider olmadan oran hesaplanamaz.' },
    { id: 'centers', n: 4, title: 'Maliyet Merkezleri', state: 'DATA_REQUIRED', needs: 'cost_centers (0078 taslağı): Fabrika → Bölüm → Makine; 111 ve 113 ayrı varlık.' },
    { id: 'machine', n: 5, title: 'Makine Ekonomisi', state: 'ENGINE', needs: 'Motor hazır (üç ayrı payda). Gerçek saat oranı için amortisman, bakım, enerji, genel gider ve üretken saat verisi gerekir.' },
    { id: 'labor', n: 6, title: 'İşçilik Ekonomisi', state: 'DATA_REQUIRED', needs: 'Maaş verisi kısıtlı erişimli; eşzamanlı çok makine dağılımı motoru hazır, maaş ve GEÇKO eşlemesi için sahip kararı gerekir. V47 puantaj/prim algoritmasına dokunulmaz.' },
    { id: 'material', n: 7, title: 'Malzeme Ekonomisi', state: 'PREVIEW', needs: 'Değerleme politikası (standart / hareketli ortalama / lot) sahibin onayını bekler; müşteri malzemesi şirket stoğu gibi değerlenmez.' },
    { id: 'tooling', n: 8, title: 'Takım Ekonomisi', state: 'ENGINE', needs: 'Motor hazır (parça / 100 / 1.000 başına). Doğrulanmış gerçek kesme saniyesi olmadan sonuç BİLİNMİYOR veya TAHMİNİ olarak işaretlenir. Nikken/LockCell canlı API varsayılmaz.' },
    { id: 'unit', n: 9, title: 'Ürün & Birim Maliyet', state: 'ENGINE', needs: 'Üç mod (teklif / canlı geçici / kesin) ve üç payda (başlanan / iyi / sevk edilen) motoru hazır; bileşen verisi olmadan toplam hesaplanmaz.' },
    { id: 'wo', n: 10, title: 'İş Emri Ekonomisi', state: 'DATA_REQUIRED', needs: 'Mevcut iş emri maliyet modeli (/ekonomi) eksik bileşende "TAM MALİYET HESAPLANAMADI" der; bu sekme 0078 sonrası bileşenleri birleştirir.' },
    { id: 'order', n: 11, title: 'Müşteri Sipariş Kârlılığı', state: 'PREVIEW', needs: 'Katkı payı ve brüt marj motoru hazır; kur ve dağıtılmış sabit maliyet verisi gerekir.' },
    { id: 'quality', n: 12, title: 'Kalite & Hurda Maliyeti', state: 'PREVIEW', needs: 'Hurda/NCR adetleri kanonik; birim maliyet bileşenleri gelmeden TL karşılığı verilmez.' },
    { id: 'maint', n: 13, title: 'Bakım & Duruş Maliyeti', state: 'PREVIEW', needs: 'Duruş süreleri kanonik (machine_state_events); saatlik oran 5. sekme verisine bağlı. Kayıp kapasite ile fiili gider ayrı tutulur.' },
    { id: 'energy', n: 14, title: 'Enerji Zekâsı', state: 'PREVIEW', needs: 'Fatura/tarife/sayaç verisi yok. Yalnız fiyat-artış senaryosu hesaplanır (TAHMİNİ, varsayım görünür).' },
    { id: 'budget', n: 15, title: 'Bütçe / Gerçekleşen / Sapma', state: 'PREVIEW', needs: 'Bütçe tabloları (Excel şablonu) ve gerçekleşen giderler.' },
    { id: 'pricing', n: 16, title: 'Fiyat & Teklif Zekâsı', state: 'PREVIEW', needs: 'Teklif maliyeti modu hazır; revizyon/rota maliyeti ve geçmiş fiyat verisi gerekir.' },
    { id: 'cash', n: 17, title: 'Nakit, Kârlılık & Başa Baş', state: 'PREVIEW', needs: 'Başa baş hesaplayıcısı hazır (elle girilen değerlerle, TAHMİNİ). EBITDA/EBIT ve nakit akışı gerçek verilerle ayrıca hesaplanır; henüz yok.' },
    { id: 'scenario', n: 18, title: 'Senaryo & Karar Simülatörü', state: 'PREVIEW', needs: 'Varsayımlar görünür ve düzenlenebilir; öneriler geri alınamaz karar değildir. Tahmin için yeterli geçmiş veri yoksa kesin tahmin iddia edilmez.' },
    { id: 'import', n: 19, title: 'Excel İçe Aktarma & Mutabakat', state: 'PREVIEW', needs: 'Önizleme + eşleme + doğrulama + yinelenen tespiti çalışır (CSV ve .xlsx). Kayda alma 0078 DB paketini ve sahip onayını bekler. .xlsx: yalnız kayıtlı değerler okunur, formül çalıştırılmaz.' },
    { id: 'models', n: 20, title: 'Maliyet Modelleri & Dağıtım Kuralları', state: 'DATA_REQUIRED', needs: 'Dağıtım sürücüleri (makine saati, alan, sayaç…) sahip politikası olmadan seçilmez; kurallar sürümlü ve tarihli olacak.' },
    { id: 'close', n: 21, title: 'Dönem Kapanışı & Denetim', state: 'PREVIEW', needs: 'close_cost_period ve ek/ters kayıt kuralı 0078 taslağında; uygulanmadı.' },
    { id: 'reports', n: 22, title: 'Yönetim Raporları', state: 'DATA_REQUIRED', needs: 'Rapor havuzu (Madde 28) mevcut; maliyet raporları gerçek gider verisi geldikten sonra eklenir.' },
];
const STATE_TR = { ENGINE: ['HESAP MOTORU HAZIR', 'ok'], PREVIEW: ['ÖNİZLEME / SİMÜLASYON', 'info'], DATA_REQUIRED: ['VERİ GEREKLİ', 'warn'] };
export { figureText };
const num = (el) => { const v = el.value.trim().replace(',', '.'); return v === '' || Number.isNaN(Number(v)) ? null : Number(v); };
const field = (label, id, value = '') => { const i = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': id, value, style: 'min-width:0;width:100%;min-height:36px' }); return { i, el: h('label', { style: 'display:flex;flex-direction:column;font-size:12px;gap:2px;min-width:0' }, label, i) }; };
const grid = (...c) => h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0' }, ...c);
const result = (id, text) => h('div', { 'data-testid': id, style: 'padding:8px;border-radius:8px;background:rgba(148,163,184,.15);overflow-wrap:anywhere;margin-top:6px' }, text);
function machineCalc() {
    const f = ['fixedOwnership:Sabit sahiplik', 'depreciation:Amortisman', 'maintenance:Bakım', 'energy:Enerji', 'consumables:Sarf', 'allocatedOverhead:Dağıtılan genel gider', 'operatorResource:Operatör/kaynak', 'productive:Üretken saat', 'available:Kullanılabilir saat'].map((s) => { const [k, l] = s.split(':'); return { k: k, ...field(l, `cc-m-${k}`) }; });
    const out = h('div', {});
    const run = () => {
        const v = (k) => num(f.find((x) => x.k === k).i);
        const r = machineHourCost({ machineId: 'sim', periodHours: { calendar: null, scheduled: null, available: v('available'), productive: v('productive') }, fixedOwnership: v('fixedOwnership'), depreciation: v('depreciation'), maintenance: v('maintenance'), energy: v('energy'), consumables: v('consumables'), allocatedOverhead: v('allocatedOverhead'), operatorResource: v('operatorResource') });
        mount(out, h('div', {}, result('cc-m-pool', `Dönem maliyet havuzu: ${figureText(r.costPool)}`), result('cc-m-prod', `Üretken saat başına: ${figureText(r.perProductiveHour)}`), result('cc-m-avail', `Kullanılabilir saat başına: ${figureText(r.perAvailableHour)}`), result('cc-m-idle', `Atıl kapasite maliyeti: ${figureText(r.idleCapacityCost)}`)));
    };
    return h('div', {}, h('p', { class: 'mut' }, 'Elle girilen değerlerle SİMÜLASYON — kayıt yazmaz. Boş bırakılan bileşen 0 sayılmaz; sonuç BİLİNMİYOR olur.'), grid(...f.map((x) => x.el)), h('button', { type: 'button', 'data-testid': 'cc-m-run', onClick: run }, 'Hesapla'), out);
}
function toolCalc() {
    const f = ['toolPrice:Takım fiyatı', 'edges:Kenar sayısı', 'rated:Nominal ömür (kesme sn)', 'used:Kullanılan kesme sn', 'parts:Parça adedi'].map((s) => { const [k, l] = s.split(':'); return { k: k, ...field(l, `cc-t-${k}`) }; });
    const ev = h('select', { 'data-testid': 'cc-t-evidence' }, h('option', { value: 'ACTUAL' }, 'Gerçek (doğrulanmış)'), h('option', { value: 'ESTIMATED' }, 'Tahmini'), h('option', { value: 'UNVERIFIED' }, 'Doğrulanmamış'));
    const out = h('div', {});
    const run = () => {
        const v = (k) => num(f.find((x) => x.k === k).i);
        const r = toolingCost({ toolPrice: v('toolPrice'), edgesPerTool: v('edges'), ratedCuttingSeconds: v('rated'), usedCuttingSeconds: v('used'), partsInWindow: v('parts'), cuttingSecondsEvidence: ev.value });
        mount(out, h('div', {}, result('cc-t-part', `Parça başına: ${figureText(r.costPerPart)}`), result('cc-t-100', `100 parça: ${figureText(r.costPer100)}`), result('cc-t-1000', `1.000 parça: ${figureText(r.costPer1000)}`), result('cc-t-wear', `Aşınma değerlendirmesi: ${r.wear === 'NORMAL' ? 'NORMAL' : r.wear === 'PREMATURE' ? 'ERKEN AŞINMA ŞÜPHESİ' : 'BİLİNMİYOR'}`)));
    };
    return h('div', {}, h('p', { class: 'mut' }, 'Takım ömrü kanıtı sınıfı sonucu belirler: doğrulanmamış kesme süresiyle maliyet iddia edilmez.'), grid(...f.map((x) => x.el), h('label', { style: 'display:flex;flex-direction:column;font-size:12px;gap:2px' }, 'Kanıt sınıfı', ev)), h('button', { type: 'button', 'data-testid': 'cc-t-run', onClick: run }, 'Hesapla'), out);
}
function unitCalc() {
    const keys = [['material', 'Malzeme'], ['setup', 'Hazırlık'], ['machine', 'Makine'], ['labor', 'İşçilik'], ['tooling', 'Takım'], ['energy', 'Enerji'], ['outsideProcessing', 'Fason'], ['quality', 'Kalite'], ['scrapLoss', 'Hurda kaybı'], ['overhead', 'Genel gider'], ['qtyStarted', 'Başlanan adet'], ['qtyGood', 'İyi adet'], ['qtyShipped', 'Sevk edilen adet']];
    const f = keys.map(([k, l]) => ({ k, ...field(l, `cc-u-${k}`) }));
    const mode = h('select', { 'data-testid': 'cc-u-mode' }, h('option', { value: 'ESTIMATED_QUOTE' }, 'Teklif (tahmini)'), h('option', { value: 'LIVE_PROVISIONAL' }, 'Canlı geçici'), h('option', { value: 'FINAL_ACTUAL' }, 'Kesin (dönem kapalı olmalı)'));
    const closed = h('input', { type: 'checkbox', 'data-testid': 'cc-u-closed' });
    const out = h('div', {});
    const run = () => {
        const v = (k) => num(f.find((x) => x.k === k).i);
        const r = unitCost({ mode: mode.value, periodClosed: closed.checked, productRevisionId: 'sim', routingRevisionId: 'sim', material: v('material'), setup: v('setup'), machine: v('machine'), labor: v('labor'), tooling: v('tooling'), energy: v('energy'), outsideProcessing: v('outsideProcessing'), quality: v('quality'), scrapLoss: v('scrapLoss'), overhead: v('overhead'), qtyStarted: v('qtyStarted'), qtyGood: v('qtyGood'), qtyShipped: v('qtyShipped') });
        mount(out, h('div', {}, result('cc-u-total', `Toplam: ${figureText(r.total)}`), result('cc-u-good', `İyi parça başına: ${figureText(r.perGood)}`), result('cc-u-started', `Başlanan parça başına: ${figureText(r.perStarted)}`), result('cc-u-shipped', `Sevk edilen parça başına: ${figureText(r.perShipped)}`)));
    };
    return h('div', {}, h('p', { class: 'mut' }, 'Geçici maliyet kesin diye gösterilmez; sıfır/bilinmeyen adet bölünmez.'), grid(...f.map((x) => x.el), h('label', { style: 'display:flex;flex-direction:column;font-size:12px;gap:2px' }, 'Mod', mode), h('label', { style: 'display:flex;gap:6px;align-items:center;font-size:12px' }, closed, 'Dönem kapalı')), h('button', { type: 'button', 'data-testid': 'cc-u-run', onClick: run }, 'Hesapla'), out);
}
function energyCalc() {
    const a = field('Aylık enerji gideri', 'cc-e-cost');
    const b = field('Fiyat artışı %', 'cc-e-pct', '15');
    const out = h('div', {});
    return h('div', {}, grid(a.el, b.el), h('button', { type: 'button', 'data-testid': 'cc-e-run', onClick: () => { const r = energyPriceScenario(num(a.i), num(b.i) ?? 0); mount(out, result('cc-e-result', `Aylık ek maliyet: ${figureText(r)} — Varsayım: ${r.assumption}`)); } }, 'Senaryoyu hesapla'), out);
}
function breakEvenCalc() {
    const a = field('Dönem sabit maliyeti', 'cc-b-fixed');
    const b = field('Birim fiyat', 'cc-b-price');
    const c = field('Birim değişken maliyet', 'cc-b-var');
    const out = h('div', {});
    return h('div', {}, grid(a.el, b.el, c.el), h('button', { type: 'button', 'data-testid': 'cc-b-run', onClick: () => mount(out, result('cc-b-result', `Başa baş adedi: ${figureText(breakEvenUnits(num(a.i), num(b.i), num(c.i)))}`)) }, 'Hesapla'), out);
}
const ISSUE_TR = { MISSING_REQUIRED: 'zorunlu alan boş', BAD_NUMBER: 'sayı geçersiz', BAD_DATE: 'tarih geçersiz', BAD_CURRENCY: 'para birimi geçersiz', PERIOD_ORDER: 'dönem sırası hatalı', FORMULA_NEUTRALISED: 'formül metin olarak alındı', DUPLICATE_IN_FILE: 'dosyada tekrar', DUPLICATE_OF_EXISTING: 'daha önce aktarılmış', UNKNOWN_CATEGORY: 'tanımsız kategori' };
const FIELD_TR = { categoryCode: 'Kategori kodu', amount: 'Tutar', currency: 'Para birimi', periodStart: 'Hizmet dönemi başı', periodEnd: 'Hizmet dönemi sonu', documentRef: 'Belge no', costCenter: 'Maliyet merkezi', description: 'Açıklama' };
const KNOWN = new Set(['KIRA', 'MAAS', 'SGK_ISVEREN', 'FAZLA_MESAI', 'PRIM', 'ELEKTRIK', 'DOGALGAZ', 'SU', 'BASINCLI_HAVA', 'AMORTISMAN_MAKINE', 'AMORTISMAN_BINA', 'LEASING', 'BAKIM', 'YEDEK_PARCA', 'TAKIM', 'HAMMADDE', 'FASON', 'KALITE_METROLOJI', 'SARF_YAGLAMA', 'YAZILIM_ABONELIK', 'LOJISTIK_PAKET', 'SIGORTA', 'VERGI_HARC', 'IDARI_GENEL', 'OFIS', 'DIGER']);
export function importPreview(csvText, locale, mapping) {
    const table = parseCsv(csvText);
    const header = table[0] ?? [];
    const auto = {};
    const guess = { categoryCode: /kategori|category|kod/i, amount: /tutar|amount|bedel/i, currency: /para|currency|birim/i, periodStart: /ba[sş]lang|start|from/i, periodEnd: /biti[sş]|end|to\b/i, documentRef: /belge|fatura|document|ref/i, costCenter: /merkez|center/i, description: /a[cç][ıi]klama|desc/i };
    Object.keys(guess).forEach((f) => { const i = header.findIndex((c, idx) => guess[f].test(c) && !Object.values(auto).includes(idx)); if (i >= 0)
        auto[f] = i; });
    const m = mapping ?? auto;
    return { header, mapping: m, result: stageExpenseRows(table.slice(1), m, { locale, knownCategories: KNOWN }) };
}
function importTab() {
    const ta = h('textarea', { 'data-testid': 'cc-i-text', rows: '6', style: 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px', placeholder: 'Kategori;Tutar;Para birimi;Dönem başı;Dönem sonu;Belge no\nKIRA;45.000,00;TRY;01.03.2026;31.03.2026;F-1' });
    const loc = h('select', { 'data-testid': 'cc-i-locale' }, h('option', { value: 'TR' }, 'Sayı biçimi: 1.234,56 (TR)'), h('option', { value: 'EN' }, 'Sayı biçimi: 1,234.56 (EN)'));
    const out = h('div', {});
    const note = h('div', {});
    const file = h('input', { type: 'file', accept: '.csv,.txt,.xlsx', 'data-testid': 'cc-i-file' });
    const inflateRaw = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    // Excel stores numbers in machine form (1234.56); the staging step parses in the DECLARED locale, so machine numbers are re-expressed in it (TR: 1234,56).
    const toCsv = (rows) => rows.map((r) => Array.from(r, (c) => { let s = String(c ?? ''); if (loc.value === 'TR' && /^-?\d+\.\d+(E[+-]?\d+)?$/.test(s))
        s = s.replace('.', ','); return `"${s.replace(/"/g, '""')}"`; }).join(';')).join('\n');
    file.addEventListener('change', () => {
        const f = file.files?.[0];
        if (!f)
            return;
        if (/\.xlsx$/i.test(f.name)) {
            void f.arrayBuffer().then((buf) => readXlsx(new Uint8Array(buf), inflateRaw)).then((sheets) => { ta.value = toCsv(sheets[0].rows); run(); mount(note, h('div', { class: 'mut', 'data-testid': 'cc-i-xlsx-note' }, `Excel: "${sheets[0].name}" sayfası okundu (${sheets.length} sayfa). Formüller çalıştırılmaz; yalnız kayıtlı değerler alınır. Tarih hücreleri metin olarak GG.AA.YYYY/YYYY-AA-GG olmalı.`)); })
                .catch((e) => mount(out, stateBox('error', '.xlsx okunamadı', e instanceof XlsxError ? e.message : 'Dosya okunamadı', 'cc-i-xlsx-error')));
        }
        else
            void f.text().then((t) => { ta.value = t; run(); });
    });
    const run = () => {
        const p = importPreview(ta.value, loc.value);
        const r = p.result;
        if (!p.header.length) {
            mount(out, stateBox('empty', 'Veri yok', 'CSV metnini yapıştırın veya dosya seçin.', 'cc-i-empty'));
            return;
        }
        mount(out, h('div', {}, r.missingMapping.length ? stateBox('error', 'Sütun eşleşmesi eksik', r.missingMapping.map((f) => FIELD_TR[f]).join(', '), 'cc-i-mapping') : null, h('div', { 'data-testid': 'cc-i-summary', style: 'margin:8px 0;font-weight:700' }, `${r.rows.length} satır · ${r.okCount} geçerli · ${r.errorCount} hatalı · Parti parmak izi ${r.batchFingerprint}`), h('div', { class: 'mut' }, 'Önizleme — hiçbir kayıt yazılmadı. Kayda alma: hazırlayan (muhasebe + ekonomik erişim) → sahip onayı → tekrar içe aktarma güvenli (aynı satır ikinci kez yazılmaz). Kayıt altyapısı 0078 DB paketini bekliyor.'), ...r.rows.filter((x) => x.issues.length).slice(0, 50).map((x) => h('div', { 'data-testid': 'cc-i-issue', style: `font-size:12px;padding:4px 0;color:${x.ok ? '#b45309' : '#dc2626'}` }, `Satır ${x.rowNo}: ${x.issues.map((i) => ISSUE_TR[i.code] ?? i.code).join(', ')}`))));
    };
    return h('div', {}, grid(loc, file), note, ta, h('button', { type: 'button', 'data-testid': 'cc-i-run', onClick: run }, 'Doğrula'), out);
}
const TOOLS = { machine: machineCalc, tooling: () => h('div', {}, toolCalc(), EXT_EXTRA.toolHistory()), unit: unitCalc, energy: energyCalc, import: importTab, ...EXT_TOOLS,
    cash: () => h('div', {}, breakEvenCalc(), EXT_TOOLS.cash()), scenario: () => h('div', {}, energyCalc(), EXT_TOOLS.scenario()), maint: () => h('div', {}, EXT_TOOLS.maint(), EXT_EXTRA.lossRank()) };
// Release 005: with `deps` (economic access) the record-backed tabs render LIVE panels; each panel itself says "Kurulum bekleniyor" when the DB package is not applied. Without deps the honest static state stays.
const LIVE_PANELS = { live: renderLiveBoard, expense: (el, d) => renderExpensePanel(el, d), centers: (el, d) => renderCentersPanel(el, d), close: (el, d) => renderClosePanel(el, d) };
export function renderCostIntelligenceScreen(container, initialTab = 'live', deps) {
    let active = COST_TABS.find((t) => t.id === initialTab)?.id ?? 'live';
    const draw = () => {
        const tab = COST_TABS.find((t) => t.id === active);
        const livePanel = deps ? LIVE_PANELS[tab.id] : undefined;
        const [stText, stKind] = livePanel ? ['KAYITLI VERİ (CANLI)', 'ok'] : STATE_TR[tab.state];
        const host = livePanel ? h('div', { 'data-testid': 'cost-live-host' }) : null;
        const recon = deps && tab.id === 'import' ? h('div', { 'data-testid': 'cost-recon-host' }) : null;
        mount(container, h('div', { class: 'kd', 'data-testid': 'cost-root', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'cost-heading' }, 'Maliyet Zekâsı'), h('p', { class: 'mut' }, 'Fabrika ekonomisi: kayıtlı olaylardan açıklanabilir maliyet. Eksik veri sıfır gösterilmez; tahmini, geçici ve gerçek ayrı etiketlenir. Para görünümü yalnız yetkili kullanıcıya.'), h('div', { role: 'tablist', 'data-testid': 'cost-tabs', style: 'display:flex;gap:6px;overflow-x:auto;padding-bottom:6px' }, ...COST_TABS.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(t.id === active), 'data-testid': 'cost-tab', 'data-tab': t.id, 'data-state': t.state, style: `white-space:nowrap;min-height:36px;${t.id === active ? 'font-weight:800;outline:2px solid #60a5fa' : ''}`, onClick: () => { active = t.id; draw(); } }, `${t.n}. ${t.title}`))), h('section', { 'data-testid': 'cost-panel', 'data-tab': tab.id, class: 'panel' }, h('h2', {}, `${tab.n}. ${tab.title}`), h('span', { class: `pill ${stKind}`, 'data-testid': 'cost-state' }, stText), livePanel ? null : h('p', { 'data-testid': 'cost-needs', style: 'margin:8px 0' }, tab.needs), host ? host : recon ? h('div', {}, TOOLS[tab.id](), recon) :
            TOOLS[tab.id] ? TOOLS[tab.id]() : stateBox('unknown', 'Bu sekmede gösterilecek doğrulanmış veri yok', 'Veri gelmeden rakam üretilmez.', 'cost-no-data'))));
        if (host && livePanel && deps)
            void livePanel(host, deps);
        if (recon && deps)
            void renderReconPanel(recon, deps);
    };
    draw();
}
