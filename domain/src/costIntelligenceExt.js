// KMI-COST-INTELLIGENCE-001 — engines that close the remaining SOFTWARE gaps of item 36 (class A in the traceability audit). PURE, deterministic, replayable.
// Same rules as costIntelligence.ts: a missing input is UNKNOWN (with the list of what is missing), never 0; a provisional figure is never final;
// no forecast is produced from too little history; AI never owns a number (nothing here calls a model). These are management calculations over facts handed
// in by the caller — they are NOT a ledger and they write nothing.
import { attributeToMonths, safeDivide } from './costIntelligence.js';
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const unknown = (missing, note) => ({ value: null, status: 'UNKNOWN', missing, ...(note ? { note } : {}) });
const fig = (value, status = 'ESTIMATED', note) => ({ value: r4(value), status, missing: [], ...(note ? { note } : {}) });
const REL = {
    MATERIAL_ISSUED: { relevant: true, domain: 'MATERIAL', effect: 'COST', needs: ['lot unit price (PO) or valuation policy (OWNER)'], reason: 'Malzeme iş emrine çıktı: tüketilen malzeme maliyeti.' },
    MATERIAL_RETURNED: { relevant: true, domain: 'MATERIAL', effect: 'COST_REVERSAL', needs: ['original issue cost'], reason: 'İade/artık: ilk çıkış maliyeti ters kayıtla düşülür, silinmez.' },
    PRODUCTION_DECLARED: { relevant: true, domain: 'MACHINE', effect: 'COST', needs: ['machine hour rate', 'productive hours'], reason: 'Üretim beyanı: iyi/hurda adet maliyet paydasıdır.' },
    MACHINE_STATE_CHANGE: { relevant: true, domain: 'MACHINE', effect: 'CAPACITY_ONLY', needs: ['machine hour rate'], reason: 'Duruş/çalışma süresi: duruş maliyeti ve kayıp kapasite AYRI hesaplanır.' },
    SETUP_DONE: { relevant: true, domain: 'MACHINE', effect: 'COST', needs: ['setup minutes', 'machine hour rate'], reason: 'Hazırlık süresi makine+işçilik maliyeti doğurur.' },
    TOOL_USED: { relevant: true, domain: 'TOOLING', effect: 'COST', needs: ['verified cutting seconds', 'tool price'], reason: 'Takım aşınması: doğrulanmış kesme süresi olmadan sayı üretilmez.' },
    TOOL_BROKEN: { relevant: true, domain: 'TOOLING', effect: 'COST', needs: ['tool price', 'remaining life'], reason: 'Erken kırılma: anormal tüketim olarak ayrı işaretlenir.' },
    NCR_RAISED: { relevant: true, domain: 'QUALITY', effect: 'COST', needs: ['unit cost at the stage'], reason: 'Uygunsuzluk: hurda/yeniden işleme maliyeti, aşamaya kadar biriken maliyetle.' },
    REWORK_DONE: { relevant: true, domain: 'QUALITY', effect: 'COST', needs: ['rework minutes', 'machine hour rate'], reason: 'Yeniden işleme: ek makine/işçilik; hurda ile iki kez sayılmaz.' },
    QUALITY_HOLD: { relevant: true, domain: 'QUALITY', effect: 'CAPACITY_ONLY', needs: [], reason: 'HOLD: fiili gider değil; bekleyen stok değeri ve gecikme etkisi olarak izlenir.' },
    MAINTENANCE_TICKET: { relevant: true, domain: 'MAINTENANCE', effect: 'COST', needs: ['spares cost', 'external service invoice'], reason: 'Bakım/arıza: planlı ve plansız ayrı; yedek parça ve dış servis gider kaydından gelir.' },
    PURCHASE_RECEIVED: { relevant: true, domain: 'PURCHASING', effect: 'COST', needs: ['PO price', 'freight/landed cost'], reason: 'Mal kabul: stok değeri; gider değil, tüketildiğinde maliyet olur.' },
    SUPPLIER_INVOICE: { relevant: true, domain: 'PURCHASING', effect: 'COST', needs: ['service period'], reason: 'Tedarikçi faturası: hizmet dönemine göre tanınır, ödeme tarihine göre değil.' },
    SHIPMENT_DISPATCHED: { relevant: true, domain: 'LOGISTICS', effect: 'COST', needs: ['freight invoice'], reason: 'Sevkiyat: nakliye gideri ve teslim süresi etkisi.' },
    SALES_INVOICE: { relevant: true, domain: 'COMMERCIAL', effect: 'REVENUE', needs: [], reason: 'Satış faturası: gelir; sipariş kârlılığının paydasıdır.' },
    ATTENDANCE_EVENT: { relevant: true, domain: 'LABOR', effect: 'NONE', needs: ['labor policy (OWNER)'], reason: 'GEÇKO giriş-çıkış MAKİNE ZAMANI DEĞİLDİR; işçilik dağıtımı sahip politikası ister (V47 değişmez).' },
    ORDER_CONFIRMED: { relevant: true, domain: 'COMMERCIAL', effect: 'NONE', needs: ['quoted cost estimate'], reason: 'Sipariş onayı: kabul anındaki tahmini maliyet/fiyat kaydı için başlangıç noktası.' },
    DOCUMENT_UPLOADED: { relevant: false, domain: 'NONE', effect: 'NONE', needs: [], reason: 'Belge yükleme tek başına ekonomik olay değildir.' },
};
export function classifyCostEvent(type) {
    return REL[type] ?? { relevant: false, domain: 'NONE', effect: 'NONE', needs: [], reason: `Bilinmeyen olay türü (${type}): maliyet etkisi varsayılmaz — sınıflandırma gerekir.` };
}
export const COST_EVENT_TYPES = Object.keys(REL);
/** Operating cost of ONE month and ONE currency (currencies are never summed), by behaviour / traceability / controllability. Unclassified stays UNCLASSIFIED, it is not folded into another bucket. */
export function costStructure(entries, month, currency) {
    const s = { month, currency, total: 0, behaviour: { FIXED: 0, VARIABLE: 0, SEMI_VARIABLE: 0 }, traceability: { DIRECT: 0, INDIRECT: 0 }, controllability: { CONTROLLABLE: 0, NON_CONTROLLABLE: 0, UNCLASSIFIED: 0 }, fixedSharePct: unknown(['gider yok']), excluded: [] };
    for (const e of entries) {
        if (e.currency !== currency)
            continue;
        const a = attributeToMonths(e);
        if (a.excluded) {
            s.excluded.push({ id: e.id, reason: a.excluded });
            continue;
        }
        const part = a.months.find((m) => m.month === month)?.amount;
        if (!isNum(part))
            continue;
        s.total = r2(s.total + part);
        s.behaviour[e.behaviour] = r2(s.behaviour[e.behaviour] + part);
        s.traceability[e.traceability] = r2(s.traceability[e.traceability] + part);
        const c = e.controllable === true ? 'CONTROLLABLE' : e.controllable === false ? 'NON_CONTROLLABLE' : 'UNCLASSIFIED';
        s.controllability[c] = r2(s.controllability[c] + part);
    }
    s.fixedSharePct = s.total > 0 ? fig((s.behaviour.FIXED / s.total) * 100, 'ACTUAL', 'yarı-değişken ayrı; sabit payına dahil değil') : unknown(['bu ay/para biriminde onaylı gider yok']);
    return s;
}
/** Cash paid in the month (by payment date) vs operating cost recognised in the month (by service period). Capital items show as cash-only. Unpaid entries (no payment date) are not cash. */
export function cashVsCost(entries, month, currency) {
    let cash = 0, cap = 0, cost = 0;
    for (const e of entries) {
        if (e.currency !== currency || e.status === 'REVERSED' || e.status === 'DRAFT')
            continue;
        if (e.paymentDate && e.paymentDate.slice(0, 7) === month) {
            if (e.capital)
                cap += e.amount;
            else
                cash += e.amount;
        }
        const a = attributeToMonths(e);
        cost += a.months.find((m) => m.month === month)?.amount ?? 0;
    }
    return { month, currency, cashPaid: r2(cash + cap), operatingCost: r2(cost), capitalPaid: r2(cap), difference: r2(cash + cap - cost), note: 'Nakit çıkışı ≠ üretim maliyeti: sermaye harcaması nakittir ama gider değildir; hizmet dönemi ödeme ayından farklı olabilir.' };
}
/** variance = actual − budget. For a COST line a lower actual is favourable; for REVENUE a higher actual is. No budget → UNKNOWN (never 0 = "on budget"). */
export function budgetVariance(budget, actual, kind = 'COST', tolerancePct = 0) {
    const miss = [];
    if (!isNum(budget))
        miss.push('bütçe');
    if (!isNum(actual))
        miss.push('gerçekleşen');
    const b = isNum(budget) ? fig(budget, 'ACTUAL') : unknown(['bütçe']);
    const a = isNum(actual) ? fig(actual, 'ACTUAL') : unknown(['gerçekleşen']);
    if (miss.length)
        return { budget: b, actual: a, variance: unknown(miss), variancePct: unknown(miss), direction: 'UNKNOWN' };
    const v = actual - budget;
    const pct = budget === 0 ? unknown(['bütçe sıfır: yüzde tanımsız']) : fig((v / Math.abs(budget)) * 100, 'ACTUAL');
    const within = pct.value !== null && Math.abs(pct.value) <= tolerancePct || v === 0;
    const direction = within ? 'ON_BUDGET' : (kind === 'COST' ? v < 0 : v > 0) ? 'FAVORABLE' : 'UNFAVORABLE';
    return { budget: b, actual: a, variance: fig(v, 'ACTUAL'), variancePct: pct, direction };
}
/** Standard vs actual unit cost: price/efficiency split needs standard AND actual quantity+price; otherwise only the total variance is given. */
export function standardVsActual(i) {
    const miss = [];
    for (const [k, l] of [['stdQty', 'standart miktar'], ['stdPrice', 'standart fiyat'], ['actQty', 'fiili miktar'], ['actPrice', 'fiili fiyat']])
        if (!isNum(i[k]))
            miss.push(l);
    if (miss.length)
        return { total: unknown(miss), priceVariance: unknown(miss), usageVariance: unknown(miss) };
    const price = (i.actPrice - i.stdPrice) * i.actQty;
    const usage = (i.actQty - i.stdQty) * i.stdPrice;
    return { total: fig(price + usage, 'ACTUAL', '+ = standardın üstünde (aleyhte)'), priceVariance: fig(price, 'ACTUAL'), usageVariance: fig(usage, 'ACTUAL') };
}
export function downtimeCost(i) {
    const rate = isNum(i.hourRate) && i.hourRate >= 0 ? i.hourRate : null;
    const times = (h, label) => rate === null ? unknown(['saatlik makine oranı']) : !isNum(h) || h < 0 ? unknown([label]) : fig(h * rate, 'ESTIMATED');
    const lost = !isNum(i.downtimeHours) || i.downtimeHours < 0 ? unknown(['duruş saati']) : !isNum(i.contributionPerHour) ? unknown(['saatlik katkı payı (fırsat maliyeti varsayımı)']) : fig(i.downtimeHours * i.contributionPerHour, 'ESTIMATED', 'FIRSAT KAYBI — fiili gider DEĞİL, toplam maliyete eklenmez');
    return { breakdownCost: times(i.downtimeHours, 'duruş saati'), setupCost: times(i.setupHours, 'hazırlık saati'), plannedMaintenanceCost: times(i.plannedMaintenanceHours, 'planlı bakım saati'), idleCost: times(i.idleHours, 'boşta saat'), lostCapacity: lost,
        note: 'Arıza duruşu, hazırlık, planlı bakım ve boşta bekleme ayrı gösterilir; kayıp kapasite fiili gider değil fırsat kaybıdır.' };
}
/** CI-155: rank losses by cost; unknown rate/hours → listed as UNKNOWN at the end (never as 0). */
export function rankLosses(items) {
    const ranked = [];
    const unk = [];
    for (const it of items) {
        const m = [];
        if (!isNum(it.hours) || it.hours < 0)
            m.push('süre');
        if (!isNum(it.hourRate) || it.hourRate < 0)
            m.push('saatlik oran');
        if (m.length)
            unk.push({ label: it.label, missing: m });
        else
            ranked.push({ label: it.label, cost: r2(it.hours * it.hourRate), avoidable: it.avoidable });
    }
    ranked.sort((a, b) => b.cost - a.cost || a.label.localeCompare(b.label, 'tr'));
    return { ranked, unknown: unk };
}
/** A part scrapped at stage k has absorbed the cost of stages 1..k. Rework adds only its own cost (it is not scrap). Inspection is separate. A stage without cost makes the line UNKNOWN. */
export function stageAwareLoss(route, losses) {
    const lines = losses.map((l) => {
        const idx = route.findIndex((s) => s.name === l.stage);
        let scrap;
        if (idx < 0)
            scrap = unknown([`rota aşaması bulunamadı: ${l.stage}`]);
        else {
            const upto = route.slice(0, idx + 1);
            scrap = upto.some((s) => !isNum(s.costPerPart)) ? unknown(upto.filter((s) => !isNum(s.costPerPart)).map((s) => `${s.name}: aşama maliyeti`)) : fig(upto.reduce((a, s) => a + s.costPerPart, 0) * l.scrapQty, 'ESTIMATED');
        }
        const rework = l.reworkQty === 0 ? fig(0, 'ACTUAL', 'yeniden işleme yok') : isNum(l.reworkCostPerPart) ? fig(l.reworkCostPerPart * l.reworkQty, 'ESTIMATED') : unknown(['yeniden işleme parça maliyeti']);
        const insp = isNum(l.inspectionCost) ? fig(l.inspectionCost, 'ACTUAL') : unknown(['muayene maliyeti']);
        return { stage: l.stage, scrapCost: scrap, reworkCost: rework, inspectionCost: insp };
    });
    const known = lines.flatMap((x) => [x.scrapCost, x.reworkCost, x.inspectionCost]);
    return { lines, totalKnown: r2(known.reduce((a, f) => a + (f.value ?? 0), 0)), unknownLines: known.filter((f) => f.value === null).length };
}
/** CI-136: returned material and remnants: a remnant is valued only if the caller states a usable value; otherwise the return reduces cost only by what was ISSUED and returned in the same lot price. */
export function materialNet(i) {
    const miss = [];
    if (!isNum(i.issuedQty))
        miss.push('çıkan miktar');
    if (!isNum(i.unitPrice))
        miss.push('lot birim fiyatı');
    if (miss.length)
        return { netConsumed: unknown(miss), netCost: unknown(miss) };
    const ret = i.returnedQty ?? 0;
    const rem = i.remnantQty ?? 0;
    const net = i.issuedQty - ret - rem;
    if (net < 0 || ret < 0 || rem < 0)
        return { netConsumed: unknown(['iade+artık çıkan miktardan fazla veya negatif']), netCost: unknown(['tutarsız miktar']) };
    const remValue = rem > 0 ? (isNum(i.remnantUsableValuePerUnit) ? rem * i.remnantUsableValuePerUnit : null) : 0;
    if (remValue === null)
        return { netConsumed: fig(net, 'ACTUAL'), netCost: unknown(['artık için kullanılabilir değer (sahip politikası)'], `artık ${rem} birim: değeri bilinmeden net maliyet verilmez`) };
    return { netConsumed: fig(net, 'ACTUAL'), netCost: fig(net * i.unitPrice + (rem * i.unitPrice - remValue), 'ESTIMATED', 'artığın kayıp kısmı maliyete eklenir') };
}
/** CI-138/074: tool-life consumption over time and abnormal consumption. */
export function toolConsumption(i) {
    const flags = [];
    const consumed = isNum(i.ratedSeconds) && i.ratedSeconds > 0 && isNum(i.usedSeconds) ? fig((i.usedSeconds / i.ratedSeconds) * 100, 'ACTUAL') : unknown(['nominal ömür', 'kullanılan saniye']);
    const burn = isNum(i.usedSeconds) && isNum(i.windowDays) && i.windowDays > 0 ? fig(i.usedSeconds / i.windowDays, 'ACTUAL') : unknown(['kullanılan saniye', 'pencere gün']);
    const left = burn.value !== null && burn.value > 0 && isNum(i.ratedSeconds) && isNum(i.usedSeconds) ? fig(Math.max(0, (i.ratedSeconds - i.usedSeconds) / burn.value), 'ESTIMATED', 'aynı hızla devam varsayımı') : unknown(['tüketim hızı']);
    const price = isNum(i.priceNow) && isNum(i.pricePrev) && i.pricePrev > 0 ? fig(((i.priceNow - i.pricePrev) / i.pricePrev) * 100, 'ACTUAL') : unknown(['güncel fiyat', 'önceki fiyat']);
    const brk = isNum(i.brokenCount) && isNum(i.changesCount) && i.changesCount > 0 ? fig((i.brokenCount / i.changesCount) * 100, 'ACTUAL') : unknown(['kırılan', 'değişim sayısı']);
    if (consumed.value !== null && i.changesCount !== null && consumed.value < 50 && (i.brokenCount ?? 0) > 0)
        flags.push('ERKEN_AŞINMA/KIRILMA');
    if (price.value !== null && price.value >= 10)
        flags.push('FİYAT_ARTIŞI_≥10%');
    if (brk.value !== null && brk.value >= 10)
        flags.push('KIRILMA_ORANI_≥10%');
    return { consumedPct: consumed, burnPerDaySeconds: burn, daysLeft: left, priceChangePct: price, breakageRatePct: brk, flags };
}
/** contribution = revenue − variable (material+conversion+scrap/rework+logistics); accounting profit also subtracts the allocated fixed cost; operational profit also subtracts a stated lateness/commercial adjustment. Any unknown line → the sums are UNKNOWN, listed. */
export function orderProfit(lines, fixedAllocated, adjustment, currency = 'TRY') {
    const incomplete = [];
    let rev = 0, var_ = 0;
    for (const l of lines) {
        const comp = [l.revenue, l.materialCost, l.conversionCost, l.scrapRework, l.logistics];
        if (comp.some((c) => !isNum(c))) {
            incomplete.push(l.workOrderId);
            continue;
        }
        rev += l.revenue;
        var_ += l.materialCost + l.conversionCost + l.scrapRework + l.logistics;
    }
    if (lines.length === 0)
        return { revenue: unknown(['iş emri satırı yok']), contribution: unknown(['iş emri satırı yok']), accountingProfit: unknown(['iş emri satırı yok']), operationalProfit: unknown(['iş emri satırı yok']), incompleteLines: [], reconciles: null };
    if (incomplete.length) {
        const m = [`eksik bileşenli iş emri: ${incomplete.join(', ')}`];
        return { revenue: unknown(m), contribution: unknown(m), accountingProfit: unknown(m), operationalProfit: unknown(m), incompleteLines: incomplete, reconciles: null };
    }
    const cm = rev - var_;
    const acc = isNum(fixedAllocated) ? fig(cm - fixedAllocated, 'PROVISIONAL', `${currency}; dağıtılan sabit maliyet düşüldü`) : unknown(['dağıtılan sabit maliyet']);
    const op = acc.value !== null && isNum(adjustment) ? fig(acc.value - adjustment, 'PROVISIONAL', 'gecikme/ticari düzeltme düşüldü') : unknown(acc.value === null ? acc.missing : ['gecikme/ticari düzeltme']);
    return { revenue: fig(rev, 'ACTUAL'), contribution: fig(cm, 'PROVISIONAL'), accountingProfit: acc, operationalProfit: op, incompleteLines: [], reconciles: r2(rev - var_) === r2(cm) };
}
/** Order-level result must equal the sum of its work-order results (cross-department consistency, CI-143/144). */
export function reconcileOrder(orderTotal, woTotals, toleranceCents = 1) {
    if (!isNum(orderTotal) || woTotals.some((w) => !isNum(w)))
        return { ok: null, difference: unknown(['sipariş toplamı veya iş emri toplamlarından biri bilinmiyor']) };
    const d = r2(orderTotal - woTotals.reduce((a, b) => a + b, 0));
    return { ok: Math.abs(d * 100) <= toleranceCents, difference: fig(d, 'ACTUAL') };
}
// ---------------------------------------------------------------------------------------------------------------- CI-030/116: pricing and decisions (simulation; owner decides)
export function pricingSensitivity(i) {
    if (!isNum(i.price) || !isNum(i.variableCost)) {
        const m = [...(!isNum(i.price) ? ['birim fiyat'] : []), ...(!isNum(i.variableCost) ? ['birim değişken maliyet'] : [])];
        return { base: unknown(m), rows: [], minPriceForZeroContribution: unknown(m) };
    }
    const rows = i.deltasPct.map((d) => { const p = i.price * (1 + d / 100); const c = p - i.variableCost; return { deltaPct: d, price: r4(p), contributionPerUnit: fig(c, 'ESTIMATED'), marginPct: p > 0 ? fig((c / p) * 100, 'ESTIMATED') : unknown(['fiyat ≤ 0']) }; });
    return { base: fig(i.price - i.variableCost, 'ESTIMATED', 'birim katkı payı'), rows, minPriceForZeroContribution: fig(i.variableCost, 'ESTIMATED', 'bunun altı değişken maliyeti bile karşılamaz') };
}
export function priceForTargetMargin(variableCost, fixedPerUnit, targetMarginPct) {
    if (!isNum(variableCost))
        return unknown(['birim değişken maliyet']);
    if (!(targetMarginPct >= 0 && targetMarginPct < 100))
        return unknown(['hedef marj 0–99 arası olmalı']);
    const base = variableCost + (isNum(fixedPerUnit) ? fixedPerUnit : 0);
    return fig(base / (1 - targetMarginPct / 100), isNum(fixedPerUnit) ? 'ESTIMATED' : 'ESTIMATED', isNum(fixedPerUnit) ? 'sabit maliyet payı dahil' : 'sabit maliyet payı DAHİL DEĞİL (veri yok)');
}
export function makeOrBuy(i) {
    const m = [];
    if (!isNum(i.inHouseVariable))
        m.push('iç üretim değişken maliyet');
    if (!isNum(i.outsidePrice))
        m.push('fason fiyat');
    if (!isNum(i.qty) || i.qty <= 0)
        m.push('adet');
    if (m.length)
        return { inHouse: unknown(m), outside: unknown(m), saving: unknown(m), verdict: 'UNKNOWN', note: 'Karar için eksik veri.' };
    const inH = (i.inHouseVariable + (i.inHouseFixedAvoidable ?? 0)) * i.qty;
    const out = i.outsidePrice * i.qty;
    const s = out - inH;
    return { inHouse: fig(inH), outside: fig(out), saving: fig(s, 'ESTIMATED', '+ = iç üretim lehine'), verdict: s > 0 ? 'MAKE' : s < 0 ? 'BUY' : 'EQUAL', note: i.inHouseFixedAvoidable === null ? 'Yalnız KAÇINILABİLİR sabit gider dahil edilir; batık sabit gider karara girmez (burada belirtilmedi).' : 'Kaçınılabilir sabit gider dahil.' };
}
export function paybackMonths(i) {
    if (!isNum(i.investment) || i.investment < 0)
        return unknown(['yatırım tutarı']);
    if (!isNum(i.monthlyNetBenefit))
        return unknown(['aylık net fayda']);
    if (i.monthlyNetBenefit <= 0)
        return unknown(['aylık net fayda ≤ 0: geri dönüş yok']);
    return fig(i.investment / i.monthlyNetBenefit, 'ESTIMATED', 'iskontosuz basit geri ödeme');
}
export function extraShift(i) {
    const m = [];
    for (const [k, l] of [['extraHoursPerMonth', 'ek vardiya saati'], ['contributionPerHour', 'saatlik katkı payı'], ['shiftCostPerMonth', 'vardiya maliyeti'], ['utilisationPct', 'doluluk %']])
        if (!isNum(i[k]))
            m.push(l);
    if (m.length)
        return { benefit: unknown(m), net: unknown(m) };
    const ben = i.extraHoursPerMonth * i.contributionPerHour * (i.utilisationPct / 100);
    return { benefit: fig(ben, 'ESTIMATED', 'doluluk varsayımı görünür ve düzenlenebilir'), net: fig(ben - i.shiftCostPerMonth, 'ESTIMATED') };
}
export function profitAndCash(i) {
    const ebitda = isNum(i.revenue) && isNum(i.operatingCashCosts) ? fig(i.revenue - i.operatingCashCosts, 'ESTIMATED', 'gelir − nakit işletme giderleri') : unknown([...(isNum(i.revenue) ? [] : ['gelir']), ...(isNum(i.operatingCashCosts) ? [] : ['işletme giderleri'])]);
    const ebit = ebitda.value !== null && isNum(i.depreciation) ? fig(ebitda.value - i.depreciation, 'ESTIMATED', 'EBITDA − amortisman') : unknown(ebitda.value === null ? ebitda.missing : ['amortisman']);
    const net = ebit.value !== null && isNum(i.interestAndTax) ? fig(ebit.value - i.interestAndTax, 'ESTIMATED', 'vergi/finansman işleme biçimi sahip/muhasebe kararıdır') : unknown(ebit.value === null ? ebit.missing : ['faiz ve vergi (muhasebe)']);
    const wcMissing = [['alacaklar', i.receivables], ['stok', i.inventory], ['borçlar', i.payables]].filter(([, v]) => !isNum(v)).map(([n]) => n);
    const wc = wcMissing.length === 0 ? fig(i.receivables + i.inventory - i.payables, 'ESTIMATED', 'alacak + stok − borç') : unknown(wcMissing);
    const cash = isNum(i.cashIn) && isNum(i.cashOut) ? fig(i.cashIn - i.cashOut, 'ACTUAL', 'kârlılıkla aynı şey değil') : unknown(['nakit girişi', 'nakit çıkışı']);
    return { ebitda, ebit, netProfitBeforeNonOperating: net, workingCapital: wc, netCashFlow: cash };
}
// ---------------------------------------------------------------------------------------------------------------- CI-117: no precise forecast on thin history
export function forecastNext(values, minPoints = 6) {
    const v = values.filter(isNum);
    if (v.length < minPoints)
        return { forecast: unknown([`yeterli geçmiş yok (${v.length}/${minPoints} dönem)`], 'kesin tahmin iddia edilmez'), points: v.length };
    const n = v.length;
    const xs = v.map((_, i) => i);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = v.reduce((a, b) => a + b, 0) / n;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = sxx === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (v[i] - my), 0) / sxx;
    return { forecast: fig(my + slope * (n - mx), 'ESTIMATED', `doğrusal eğilim, ${n} dönem — belirsizlik yüksektir`), points: n };
}
// ---------------------------------------------------------------------------------------------------------------- CI-103/104/105/106/107/141: deterministic, replayable, period-safe
/** FNV-1a 32-bit over canonical JSON (sorted keys): the same inputs and versions always give the same fingerprint. Not a security hash — a replay/consistency check. */
export function fingerprint(value) {
    const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v !== null && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null);
    let hsh = 0x811c9dc5;
    for (const ch of canon(value)) {
        hsh ^= ch.codePointAt(0);
        hsh = Math.imul(hsh, 0x01000193) >>> 0;
    }
    return hsh.toString(16).padStart(8, '0');
}
/** Every calculation can be stored with what produced it; recomputing from the same inputs must reproduce the fingerprint. */
export function recordCalculation(calc, calcVersion, rateVersion, inputs, result, sourceEvents = []) {
    return { calc, calcVersion, rateVersion, inputs, result, sourceEvents: [...sourceEvents].sort(), fingerprint: fingerprint({ calc, calcVersion, rateVersion, inputs, result }) };
}
export function replayMatches(rec, recomputed) { return fingerprint({ calc: rec.calc, calcVersion: rec.calcVersion, rateVersion: rec.rateVersion, inputs: rec.inputs, result: recomputed }) === rec.fingerprint; }
/** A closed period is never recalculated in place. A late event or correction becomes an ADJUSTMENT in the first open period, with the original period and reason kept. */
export function applyLateEvent(periods, eventMonth, amount, reason, firstOpenMonth) {
    if (reason.trim().length < 5)
        return { error: 'REASON_REQUIRED' };
    const p = periods.find((x) => x.month === eventMonth);
    if (p && p.closed) {
        const open = periods.find((x) => x.month === firstOpenMonth);
        if (!open || open.closed)
            return { error: 'NO_OPEN_PERIOD' };
        return { target: firstOpenMonth, adjustment: true, originalMonth: eventMonth, amount: r2(amount), reason: reason.trim() };
    }
    return { target: eventMonth, adjustment: false, originalMonth: eventMonth, amount: r2(amount), reason: reason.trim() };
}
export function assertPeriodOpen(periods, month) {
    const p = periods.find((x) => x.month === month);
    if (!p)
        return { ok: true, reason: null };
    return p.closed ? { ok: false, reason: 'PERIOD_CLOSED: yeniden hesaplama için önce yetkili dönem yeniden açma' } : { ok: true, reason: null };
}
export function costRecommendations(d) {
    const out = [];
    const thin = d.historyPoints < 6 ? `Geçmiş veri az (${d.historyPoints} dönem): sonuç yön göstericidir, kesin değildir.` : 'Yeterli geçmiş var; yine de tahmindir.';
    for (const [p, c] of Object.entries(d.contributionPctByProduct))
        if (c !== null && c < 10)
            out.push({ code: 'C_LOW_MARGIN_PRODUCT', title: `Düşük katkı payı: ${p}`, why: `Katkı payı %${c} (eşik %10).`, inputs: { ürün: p, 'katkı %': String(c) }, assumptions: ['Eşik %10 varsayılan; sahip değiştirebilir.'], uncertainty: thin, humanAction: 'Fiyat / maliyet / rota gözden geçirilsin; Fiyat sekmesinde duyarlılığa bakın.' });
    for (const [p, s] of Object.entries(d.scrapCostShareByProduct))
        if (s !== null && s >= 5)
            out.push({ code: 'C_HIGH_SCRAP_COST', title: `Hurda maliyeti yüksek: ${p}`, why: `Hurda maliyeti toplam maliyetin %${s}'i (eşik %5).`, inputs: { ürün: p, 'hurda %': String(s) }, assumptions: ['Hurda aşama bazlı birikmiş maliyetle hesaplandı.'], uncertainty: thin, humanAction: 'Hurdanın aşamasını Kalite sekmesinden inceleyin; kök neden için NCR kaydına bakın.' });
    for (const [t, f] of Object.entries(d.toolFlags))
        if (f.length)
            out.push({ code: 'C_TOOL_ANOMALY', title: `Takım anomalisi: ${t}`, why: f.join(', '), inputs: { takım: t }, assumptions: ['Doğrulanmış kesme süresi varsayıldı.'], uncertainty: thin, humanAction: 'Takım parametresi / tedarikçi / kesme koşulu incelensin.' });
    if (d.energyShareOfCostPct !== null && d.energyShareOfCostPct >= 8)
        out.push({ code: 'C_ENERGY_SHARE', title: 'Enerji payı yüksek', why: `Enerji giderleri toplam maliyetin %${d.energyShareOfCostPct}'i (eşik %8).`, inputs: { 'enerji %': String(d.energyShareOfCostPct) }, assumptions: ['Sayaç yoksa dağıtım tahminidir.'], uncertainty: thin, humanAction: 'Tarife ve boşta çalışma saatleri incelensin.' });
    for (const [m, s] of Object.entries(d.downtimeCostShareByMachine))
        if (s !== null && s >= 15)
            out.push({ code: 'C_DOWNTIME_MACHINE', title: `Duruş maliyeti yüksek: ${m}`, why: `Duruş toplam makine maliyetinin %${s}'i (eşik %15).`, inputs: { makine: m, 'duruş %': String(s) }, assumptions: ['Duruş saatleri machine_state_events kaydından.'], uncertainty: thin, humanAction: 'Bakım planı ve yedek parça gözden geçirilsin.' });
    if (d.overdueReceivablePct !== null && d.overdueReceivablePct >= 20)
        out.push({ code: 'C_RECEIVABLE_AGING', title: 'Vadesi geçen alacak yüksek', why: `Alacakların %${d.overdueReceivablePct}'i vadesi geçmiş (eşik %20).`, inputs: { 'vadesi geçen %': String(d.overdueReceivablePct) }, assumptions: ['Vade günü fatura koşulundan.'], uncertainty: thin, humanAction: 'Tahsilat takibi yapılsın; nakit akışı sekmesine bakın.' });
    if (d.fixedSharePct !== null && d.fixedSharePct >= 60)
        out.push({ code: 'C_HIGH_FIXED_SHARE', title: 'Sabit gider payı yüksek', why: `Sabit giderler toplamın %${d.fixedSharePct}'i (eşik %60): hacim düşünce marj hızla erir.`, inputs: { 'sabit %': String(d.fixedSharePct) }, assumptions: ['Yarı-değişken giderler sabit sayılmadı.'], uncertainty: thin, humanAction: 'Başa baş analizini güncelleyin.' });
    return out.sort((a, b) => a.code.localeCompare(b.code) || a.title.localeCompare(b.title, 'tr'));
}
export { safeDivide };
