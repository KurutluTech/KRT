// KMI-COST-INTELLIGENCE-001 — simulation calculators for the workspace tabs whose real data (0078 expenses, budgets, meters) does not exist yet. Every calculator runs the SAME
// pure engine that the real data will use (packages/domain/costIntelligenceExt), takes only what the user types, writes NOTHING, and never turns an empty box into 0.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { FIGURE_STATUS_TR } from '../../../../packages/domain/src/costIntelligence.js';
import { COST_EVENT_TYPES, applyLateEvent, assertPeriodOpen, budgetVariance, classifyCostEvent, downtimeCost, extraShift, forecastNext, makeOrBuy, materialNet, orderProfit, paybackMonths, priceForTargetMargin, pricingSensitivity, profitAndCash, rankLosses, stageAwareLoss, standardVsActual, toolConsumption } from '../../../../packages/domain/src/costIntelligenceExt.js';
const NUM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });
export const figureText = (f) => (f.value === null ? `BİLİNMİYOR — eksik: ${f.missing.join('; ') || '—'}` : `${NUM.format(f.value)} · ${FIGURE_STATUS_TR[f.status]}${f.note ? ` · ${f.note}` : ''}`);
const parse = (el) => { const v = el.value.trim().replace(',', '.'); return v === '' || Number.isNaN(Number(v)) ? null : Number(v); };
function calc(s) {
    const inputs = s.fields.map(([k, label, def]) => {
        const i = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': `cc-${s.id}-${k}`, value: def ?? '', style: 'min-width:0;width:100%;min-height:36px' });
        return { k, i, el: h('label', { style: 'display:flex;flex-direction:column;font-size:12px;gap:2px;min-width:0' }, label, i) };
    });
    const out = h('div', {});
    const run = () => {
        const v = (k) => parse(inputs.find((x) => x.k === k).i);
        mount(out, h('div', {}, ...s.compute(v).map(([label, val], n) => h('div', { 'data-testid': `cc-${s.id}-r${n}`, style: 'padding:8px;border-radius:8px;background:rgba(148,163,184,.15);overflow-wrap:anywhere;margin-top:6px' }, `${label}: ${typeof val === 'string' ? val : figureText(val)}`))));
    };
    return h('div', {}, h('p', { class: 'mut' }, s.intro), h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0' }, ...inputs.map((x) => x.el)), h('button', { type: 'button', 'data-testid': `cc-${s.id}-run`, onClick: run }, 'Hesapla'), out);
}
const SIM = 'Elle girilen değerlerle SİMÜLASYON — kayıt yazmaz. Boş bırakılan alan 0 sayılmaz; sonuç BİLİNMİYOR olur.';
const structure = { id: 'st', intro: `${SIM} Gerçek gider kayıtları (0078) geldiğinde aynı motor ay/para birimi bazında çalışır.`, fields: [['fixed', 'Sabit giderler'], ['variable', 'Değişken giderler'], ['semi', 'Yarı-değişken giderler']],
    compute: (v) => {
        const parts = [v('fixed'), v('variable'), v('semi')];
        const known = parts.every((p) => p !== null);
        const total = known ? parts.reduce((a, b) => a + b, 0) : null;
        return [['Toplam', total === null ? { value: null, status: 'UNKNOWN', missing: ['üç giderin üçü de gerekli'] } : { value: total, status: 'ESTIMATED', missing: [] }], ['Sabit pay %', total && total > 0 ? { value: Math.round((v('fixed') / total) * 1e6) / 1e4, status: 'ESTIMATED', missing: [], note: 'yarı-değişken ayrı' } : { value: null, status: 'UNKNOWN', missing: ['toplam > 0 olmalı'] }]];
    } };
const qualityCalc = { id: 'qs', intro: `${SIM} Rota: kesim → torna → frezeleme. Hurda, bulunduğu aşamaya kadar biriken maliyeti taşır; yeniden işleme yalnız kendi maliyetini ekler.`,
    fields: [['c1', 'Kesim maliyeti/parça'], ['c2', 'Torna maliyeti/parça'], ['c3', 'Frezeleme maliyeti/parça'], ['stage', 'Hurdanın aşaması (1-3)', '2'], ['scrap', 'Hurda adedi'], ['rework', 'Yeniden işleme adedi', '0'], ['rwc', 'Yeniden işleme maliyeti/parça'], ['insp', 'Muayene maliyeti']],
    compute: (v) => {
        const names = ['kesim', 'torna', 'frezeleme'];
        const st = Math.round(v('stage') ?? 0);
        const r = stageAwareLoss([1, 2, 3].map((n, i) => ({ name: names[i], costPerPart: v(`c${n}`) })), [{ stage: names[st - 1] ?? 'yok', scrapQty: v('scrap') ?? 0, reworkQty: v('rework') ?? 0, reworkCostPerPart: v('rwc'), inspectionCost: v('insp') }]);
        const l = r.lines[0];
        return [['Hurda maliyeti (aşamaya kadar birikmiş)', l.scrapCost], ['Yeniden işleme maliyeti', l.reworkCost], ['Muayene maliyeti', l.inspectionCost]];
    } };
const maint = { id: 'dt', intro: `${SIM} Arıza duruşu, hazırlık, planlı bakım ve boşta bekleme AYRI gösterilir; kayıp kapasite fiili gider değil fırsat kaybıdır ve toplama eklenmez.`,
    fields: [['down', 'Arıza duruş saati'], ['setup', 'Hazırlık saati'], ['plan', 'Planlı bakım saati'], ['idle', 'Boşta saat'], ['rate', 'Saatlik makine oranı'], ['contrib', 'Saatlik katkı payı (fırsat varsayımı)']],
    compute: (v) => {
        const r = downtimeCost({ downtimeHours: v('down'), setupHours: v('setup'), idleHours: v('idle'), hourRate: v('rate'), plannedMaintenanceHours: v('plan'), contributionPerHour: v('contrib') });
        return [['Arıza duruş maliyeti', r.breakdownCost], ['Hazırlık maliyeti', r.setupCost], ['Planlı bakım maliyeti', r.plannedMaintenanceCost], ['Boşta maliyet', r.idleCost], ['Kayıp kapasite (fırsat kaybı)', r.lostCapacity]];
    } };
const budget = { id: 'bd', intro: `${SIM} Bütçe girilmezse "bütçe içinde" denmez: BİLİNMİYOR.`, fields: [['budget', 'Bütçe'], ['actual', 'Gerçekleşen'], ['tol', 'Tolerans %', '0'], ['sq', 'Standart miktar'], ['sp', 'Standart fiyat'], ['aq', 'Fiili miktar'], ['ap', 'Fiili fiyat']],
    compute: (v) => {
        const b = budgetVariance(v('budget'), v('actual'), 'COST', v('tol') ?? 0);
        const s = standardVsActual({ stdQty: v('sq'), stdPrice: v('sp'), actQty: v('aq'), actPrice: v('ap') });
        return [['Sapma (gerçekleşen − bütçe)', b.variance], ['Sapma %', b.variancePct], ['Yön', { FAVORABLE: 'LEHTE', UNFAVORABLE: 'ALEYHTE', ON_BUDGET: 'BÜTÇE İÇİNDE', UNKNOWN: 'BİLİNMİYOR (bütçe veya gerçekleşen yok)' }[b.direction]], ['Standart-fiili toplam sapma', s.total], ['Fiyat sapması', s.priceVariance], ['Kullanım sapması', s.usageVariance]];
    } };
const pricing = { id: 'pr', intro: `${SIM} Fiyat değişimine duyarlılık ve hedef marj için gereken fiyat.`, fields: [['price', 'Birim fiyat'], ['var', 'Birim değişken maliyet'], ['fix', 'Birim sabit maliyet payı'], ['target', 'Hedef marj %', '20']],
    compute: (v) => {
        const p = pricingSensitivity({ price: v('price'), variableCost: v('var'), fixedPerUnit: v('fix'), deltasPct: [-10, -5, 0, 5, 10] });
        const t = priceForTargetMargin(v('var'), v('fix'), v('target') ?? 0);
        return [['Birim katkı payı', p.base], ...p.rows.map((r) => [`Fiyat ${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}% → katkı/birim`, r.contributionPerUnit]), ['Değişken maliyeti karşılayan en düşük fiyat', p.minPriceForZeroContribution], ['Hedef marj için fiyat', t]];
    } };
const cash = { id: 'cf', intro: `${SIM} Başa baş, EBITDA, EBIT, işletme sermayesi ve nakit akışı AYRI sayılardır; kârlı olmak nakitte olmak demek değildir.`, fields: [['rev', 'Gelir'], ['opex', 'Nakit işletme giderleri'], ['dep', 'Amortisman'], ['tax', 'Faiz ve vergi'], ['ar', 'Alacaklar'], ['inv', 'Stok'], ['ap', 'Borçlar'], ['cin', 'Nakit girişi'], ['cout', 'Nakit çıkışı']],
    compute: (v) => {
        const r = profitAndCash({ revenue: v('rev'), operatingCashCosts: v('opex'), depreciation: v('dep'), interestAndTax: v('tax'), receivables: v('ar'), inventory: v('inv'), payables: v('ap'), cashIn: v('cin'), cashOut: v('cout') });
        return [['EBITDA', r.ebitda], ['EBIT', r.ebit], ['Faiz/vergi sonrası', r.netProfitBeforeNonOperating], ['İşletme sermayesi', r.workingCapital], ['Net nakit akışı', r.netCashFlow]];
    } };
const scenario = { id: 'sc', intro: `${SIM} Karar simülatörü: iç üretim–fason, ek vardiya, yatırım geri ödemesi. Çıktı öneridir; geri alınamaz karar değildir.`, fields: [['inv', 'İç üretim değişken maliyet/adet'], ['avoid', 'Kaçınılabilir sabit/adet'], ['out', 'Fason fiyat/adet'], ['qty', 'Adet'], ['hours', 'Ek vardiya saati/ay'], ['cph', 'Saatlik katkı payı'], ['scost', 'Vardiya maliyeti/ay'], ['util', 'Doluluk %', '60'], ['invest', 'Yatırım tutarı'], ['ben', 'Aylık net fayda']],
    compute: (v) => {
        const m = makeOrBuy({ inHouseVariable: v('inv'), inHouseFixedAvoidable: v('avoid'), outsidePrice: v('out'), qty: v('qty') });
        const e = extraShift({ extraHoursPerMonth: v('hours'), contributionPerHour: v('cph'), shiftCostPerMonth: v('scost'), utilisationPct: v('util') });
        return [['İç üretim toplam', m.inHouse], ['Fason toplam', m.outside], ['Fason − iç üretim (+ = iç üretim lehine)', m.saving], ['Öneri (insan karar verir)', { MAKE: 'İç üretim', BUY: 'Fason', EQUAL: 'Eşit', UNKNOWN: 'BİLİNMİYOR' }[m.verdict]], ['Ek vardiya faydası', e.benefit], ['Ek vardiya net', e.net], ['Yatırım geri ödeme (ay)', paybackMonths({ investment: v('invest'), monthlyNetBenefit: v('ben') })]];
    } };
const orderCalc = { id: 'od', intro: `${SIM} Tek iş emri satırıyla sipariş sonucu: katkı payı, muhasebe kârı ve operasyonel kâr AYRI. Bir bileşen boşsa hiçbir toplam üretilmez.`, fields: [['rev', 'Gelir'], ['mat', 'Malzeme'], ['conv', 'İşleme (makine+işçilik+takım)'], ['loss', 'Hurda / yeniden işleme'], ['log', 'Lojistik'], ['fixed', 'Dağıtılan sabit maliyet'], ['adj', 'Gecikme / ticari düzeltme']],
    compute: (v) => { const r = orderProfit([{ workOrderId: 'WO-1', revenue: v('rev'), materialCost: v('mat'), conversionCost: v('conv'), scrapRework: v('loss'), logistics: v('log') }], v('fixed'), v('adj')); return [['Katkı payı', r.contribution], ['Muhasebe kârı (sabit dahil)', r.accountingProfit], ['Operasyonel kâr', r.operationalProfit]]; } };
const materialCalc = { id: 'mt', intro: `${SIM} İade ve artık: artığın kullanılabilir değeri belirtilmezse net maliyet VERİLMEZ.`, fields: [['issued', 'Çıkan miktar'], ['ret', 'İade'], ['rem', 'Artık'], ['price', 'Lot birim fiyatı'], ['remv', 'Artık kullanılabilir değer/birim']],
    compute: (v) => { const r = materialNet({ issuedQty: v('issued'), returnedQty: v('ret'), remnantQty: v('rem'), unitPrice: v('price'), remnantUsableValuePerUnit: v('remv') }); return [['Net tüketilen', r.netConsumed], ['Net malzeme maliyeti', r.netCost]]; } };
const toolHistory = { id: 'th', intro: `${SIM} Takım tüketimi, kalan ömür, fiyat geçmişi ve kırılma oranı.`, fields: [['rated', 'Nominal ömür (sn)'], ['used', 'Kullanılan (sn)'], ['days', 'Pencere (gün)'], ['now', 'Güncel fiyat'], ['prev', 'Önceki fiyat'], ['broken', 'Kırılan'], ['changes', 'Değişim sayısı']],
    compute: (v) => {
        const r = toolConsumption({ ratedSeconds: v('rated'), usedSeconds: v('used'), windowDays: v('days'), priceNow: v('now'), pricePrev: v('prev'), brokenCount: v('broken'), changesCount: v('changes') });
        return [['Tüketilen %', r.consumedPct], ['Günlük tüketim (sn)', r.burnPerDaySeconds], ['Kalan gün', r.daysLeft], ['Fiyat değişimi %', r.priceChangePct], ['Kırılma oranı %', r.breakageRatePct], ['Bayraklar', r.flags.length ? r.flags.join(', ') : 'yok']];
    } };
const lossRank = { id: 'lr', intro: `${SIM} Kaçınılabilir kayıpları maliyete göre sıralar; süre veya oran bilinmeyen kalem sıralanmaz, ayrıca listelenir.`, fields: [['h1', 'Ayar süresi (saat)'], ['h2', 'Arıza süresi (saat)'], ['h3', 'Malzeme bekleme (saat)'], ['rate', 'Saatlik makine oranı']],
    compute: (v) => {
        const r = rankLosses([{ label: 'Ayar', hours: v('h1'), hourRate: v('rate'), avoidable: true }, { label: 'Arıza', hours: v('h2'), hourRate: v('rate'), avoidable: false }, { label: 'Malzeme bekleme', hours: v('h3'), hourRate: v('rate'), avoidable: true }]);
        return [['Sıralama', r.ranked.length ? r.ranked.map((x, i) => `${i + 1}. ${x.label} ${NUM.format(x.cost)}${x.avoidable ? ' (kaçınılabilir)' : ''}`).join(' · ') : 'sıralanacak kalem yok'], ['Hesaplanamayan', r.unknown.length ? r.unknown.map((u) => `${u.label}: ${u.missing.join('/')}`).join(' · ') : 'yok']];
    } };
/** CI-002 reference: which canonical events carry economic meaning (read-only table; the same function will drive the cost pipeline). */
const EVENT_TR = { MATERIAL_ISSUED: 'Malzeme iş emrine çıktı', MATERIAL_RETURNED: 'Malzeme iadesi / artık', PRODUCTION_DECLARED: 'Üretim beyanı', MACHINE_STATE_CHANGE: 'Makine durum değişimi', SETUP_DONE: 'Hazırlık tamamlandı', TOOL_USED: 'Takım kullanımı', TOOL_BROKEN: 'Takım kırıldı', NCR_RAISED: 'Uygunsuzluk (NCR) açıldı', REWORK_DONE: 'Yeniden işleme yapıldı', QUALITY_HOLD: 'Kalite HOLD', MAINTENANCE_TICKET: 'Bakım / arıza kaydı', PURCHASE_RECEIVED: 'Mal kabul', SUPPLIER_INVOICE: 'Tedarikçi faturası', SHIPMENT_DISPATCHED: 'Sevkiyat yapıldı', SALES_INVOICE: 'Satış faturası', ATTENDANCE_EVENT: 'Giriş-çıkış (GEÇKO)', ORDER_CONFIRMED: 'Sipariş onaylandı', DOCUMENT_UPLOADED: 'Belge yüklendi' };
const DOMAIN_TR = { MATERIAL: 'Malzeme', MACHINE: 'Makine', TOOLING: 'Takım', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satınalma', LOGISTICS: 'Lojistik', COMMERCIAL: 'Ticari', LABOR: 'İşçilik', NONE: 'Yok' };
const EFFECT_TR = { COST: 'Maliyet doğurur', COST_REVERSAL: 'Maliyeti ters kayıtla düşer', CAPACITY_ONLY: 'Yalnız kapasite etkisi', REVENUE: 'Gelir', NONE: 'Doğrudan maliyet etkisi yok' };
const NEED_TR = { 'PO price': 'satınalma fiyatı', 'external service invoice': 'dış servis faturası', 'freight invoice': 'nakliye faturası', 'freight/landed cost': 'nakliye / varış maliyeti', 'labor policy (OWNER)': 'işçilik politikası (SAHİP KARARI)', 'lot unit price (PO) or valuation policy (OWNER)': 'lot birim fiyatı (satınalma) veya değerleme politikası (SAHİP KARARI)', 'machine hour rate': 'makine saat maliyeti', 'original issue cost': 'ilk çıkış maliyeti', 'productive hours': 'üretken saat', 'quoted cost estimate': 'teklif maliyet tahmini', 'remaining life': 'kalan ömür', 'rework minutes': 'yeniden işleme dakikası', 'service period': 'hizmet dönemi', 'setup minutes': 'hazırlık dakikası', 'spares cost': 'yedek parça maliyeti', 'tool price': 'takım fiyatı', 'unit cost at the stage': 'aşamadaki birim maliyet', 'verified cutting seconds': 'doğrulanmış kesme süresi' };
export function eventRelevanceTable() {
    return h('div', { 'data-testid': 'cc-events' }, h('p', { class: 'mut' }, 'Hangi KMI olayı maliyet doğurur? Aynı sınıflandırma maliyet hesabını besleyecek; sınıflandırılmamış olay maliyet varsayılmaz.'), h('div', { style: 'overflow-x:auto' }, h('table', { style: 'width:100%;border-collapse:collapse;font-size:13px' }, h('thead', {}, h('tr', {}, ...['Olay', 'Alan', 'Etki', 'Gereken veri', 'Açıklama'].map((c) => h('th', { style: 'text-align:left;padding:6px;color:#94a3b8' }, c)))), h('tbody', {}, ...COST_EVENT_TYPES.map((t) => { const c = classifyCostEvent(t); return h('tr', { 'data-testid': 'cc-event-row', 'data-event': t, style: 'border-top:1px solid #1e293b' }, h('td', { style: 'padding:6px' }, EVENT_TR[t] ?? 'Sınıflandırılmamış olay'), h('td', { style: 'padding:6px' }, DOMAIN_TR[c.domain] ?? c.domain), h('td', { style: 'padding:6px' }, EFFECT_TR[c.effect] ?? c.effect), h('td', { style: 'padding:6px' }, c.needs.map((n) => NEED_TR[n] ?? n).join('; ') || '—'), h('td', { style: 'padding:6px' }, c.reason)); })))));
}
/** CI-107/141: closed-period behaviour demonstrated with typed months (no data written). */
export function periodCloseCalc() {
    const closed = h('input', { type: 'text', 'data-testid': 'cc-pc-closed', value: '2026-01', style: 'min-height:36px' });
    const open = h('input', { type: 'text', 'data-testid': 'cc-pc-open', value: '2026-02', style: 'min-height:36px' });
    const ev = h('input', { type: 'text', 'data-testid': 'cc-pc-event', value: '2026-01', style: 'min-height:36px' });
    const amt = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'cc-pc-amount', value: '120', style: 'min-height:36px' });
    const why = h('input', { type: 'text', 'data-testid': 'cc-pc-reason', value: 'geç gelen fatura', style: 'min-height:36px' });
    const out = h('div', {});
    const run = () => {
        const periods = [{ month: closed.value.trim(), closed: true }, { month: open.value.trim(), closed: false }];
        const g = assertPeriodOpen(periods, ev.value.trim());
        const r = applyLateEvent(periods, ev.value.trim(), Number(amt.value.replace(',', '.')), why.value, open.value.trim());
        mount(out, h('div', {}, h('div', { 'data-testid': 'cc-pc-r0', style: 'padding:8px;margin-top:6px;border-radius:8px;background:rgba(148,163,184,.15)' }, `Dönem durumu: ${g.ok ? 'AÇIK — normal kayıt' : g.reason}`), h('div', { 'data-testid': 'cc-pc-r1', style: 'padding:8px;margin-top:6px;border-radius:8px;background:rgba(148,163,184,.15)' }, 'error' in r ? `Reddedildi: ${r.error}` : r.adjustment ? `Kapalı döneme yazılmaz → ${r.target} dönemine DÜZELTME olarak (asıl dönem ${r.originalMonth}, gerekçe: ${r.reason}, tutar ${r.amount})` : `${r.target} dönemine normal kayıt (${r.amount})`)));
    };
    return h('div', {}, h('p', { class: 'mut' }, `${SIM} Kapalı dönem yerinde yeniden hesaplanmaz; geç gelen olay ilk açık dönemde, asıl dönem ve gerekçesiyle DÜZELTME olur.`), h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0' }, h('label', {}, 'Kapalı dönem', closed), h('label', {}, 'Açık dönem', open), h('label', {}, 'Olay dönemi', ev), h('label', {}, 'Tutar', amt), h('label', {}, 'Gerekçe', why)), h('button', { type: 'button', 'data-testid': 'cc-pc-run', onClick: run }, 'Uygula'), out);
}
export function forecastCalc() {
    const ta = h('textarea', { 'data-testid': 'cc-fc-series', rows: '2', placeholder: 'Aylık değerler, virgülle: 10,12,14,16,18,20', style: 'width:100%;min-height:56px' });
    const out = h('div', {});
    return h('div', {}, h('p', { class: 'mut' }, `${SIM} Yeterli geçmiş (en az 6 dönem) yoksa tahmin ÜRETİLMEZ.`), ta, h('button', { type: 'button', 'data-testid': 'cc-fc-run', onClick: () => {
            const vals = ta.value.split(',').map((s) => s.trim().replace(',', '.')).filter(Boolean).map((s) => (Number.isNaN(Number(s)) ? null : Number(s)));
            const r = forecastNext(vals);
            mount(out, h('div', { 'data-testid': 'cc-fc-r0', style: 'padding:8px;margin-top:6px;border-radius:8px;background:rgba(148,163,184,.15)' }, `Sonraki dönem: ${figureText(r.forecast)} (${r.points} geçerli dönem)`));
        } }, 'Tahmin et'), out);
}
export const EXT_TOOLS = {
    structure: () => calc(structure), quality: () => calc(qualityCalc), maint: () => calc(maint), budget: () => calc(budget), pricing: () => calc(pricing), cash: () => calc(cash), scenario: () => h('div', {}, calc(scenario), forecastCalc()),
    order: () => calc(orderCalc), material: () => calc(materialCalc), live: () => eventRelevanceTable(), close: () => periodCloseCalc(),
};
export const EXT_EXTRA = { toolHistory: () => calc(toolHistory), lossRank: () => calc(lossRank) };
