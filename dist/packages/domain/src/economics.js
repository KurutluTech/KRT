// KMI NEXT — Economic analysis + management decision engine (matrix 36, 48). Twin of migrations 0036 + 0044.
//
// Money rule (#679): ONLY kmi_next.can_view_economics() (the bound owner + people the owner named)
// — not ADMIN / MANAGEMENT / ACCOUNTING / IT. The server refuses everyone else (ECONOMIC_OWNER_ONLY);
// until the owner account is bound (D-007) nobody sees anything.
// Honesty rules:
//   * only real records: invoices, collections, supplier invoices/payments, material issued × PO
//     price; labour, machine time, overhead, tool wear are NOT modelled (D-013) and always listed;
//   * currencies are never added together (no exchange-rate source — D-013);
//   * invoice AGE (60 days) is only an age warning (MEDIUM). Real overdue (0044, D-016) = due date from the
//     customer's payment term valid on the invoice day has passed AND the balance is open; an invoice
//     without a term has an UNKNOWN due date — never treated as "not overdue";
//   * scrap rate per product / operation (output_facts, last 30 days) against the most specific threshold
//     (product+operation → product → global 5 %);
//   * a wrong decision is never edited: a corrective decision record points to it (0044);
//   * the decision engine only PROPOSES (with its evidence); the owner decides and the decision is
//     an append-only record. Thresholds are stored defaults the owner can change (D-016).
export function round2(n) {
    return Math.round(n * 100) / 100;
}
/** Sum per currency, sorted by currency (never across currencies). */
export function sumByCurrency(lines) {
    const m = new Map();
    for (const l of lines)
        m.set(l.currency, round2((m.get(l.currency) ?? 0) + l.amount));
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([currency, amount]) => ({ currency, amount }));
}
export const AGE_BUCKET_TR = { D0_30: '0–30 gün', D31_60: '31–60 gün', D61_90: '61–90 gün', D90_PLUS: '90+ gün' };
export function ageBucket(days) {
    if (days <= 30)
        return 'D0_30';
    if (days <= 60)
        return 'D31_60';
    if (days <= 90)
        return 'D61_90';
    return 'D90_PLUS';
}
export const DUE_BUCKET_TR = { OVERDUE: 'Vadesi geçmiş', DUE_7: '7 gün içinde', DUE_30: '30 gün içinde', LATER: 'Daha sonra', NO_DUE_DATE: 'Vade girilmemiş' };
export function daysBetweenDates(a, b) {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
export function dueBucket(dueDate, today, dueSoonDays = 7) {
    if (!dueDate)
        return 'NO_DUE_DATE';
    const d = daysBetweenDates(today, dueDate);
    if (d < 0)
        return 'OVERDUE';
    if (d <= dueSoonDays)
        return 'DUE_7';
    if (d <= 30)
        return 'DUE_30';
    return 'LATER';
}
/** % change previous → latest (2 dp); null when there is no comparable previous price. */
export function priceChangePct(previous, latest) {
    if (previous === null || previous <= 0)
        return null;
    return round2(((latest - previous) / previous) * 100);
}
/** Material lost to scrap = issued material cost × scrap / (good + scrap) — an allocation rule, labelled as such. */
export function scrapMaterialCost(materialCost, good, scrap) {
    const total = good + scrap;
    if (total <= 0)
        return null;
    return round2((materialCost * scrap) / total);
}
export const DEFAULT_THRESHOLDS = { receivableAgeDays: 60, payableDueSoonDays: 7, priceIncreasePct: 10, scrapSharePct: 5 };
const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 };
/** Most specific threshold wins: product + operation → product → global (same as kmi_next.scrap_rate_facts). */
export function scrapThreshold(productOp, product, global) {
    if (productOp !== null)
        return { pct: productOp, source: 'PRODUCT_OPERATION' };
    if (product !== null)
        return { pct: product, source: 'PRODUCT' };
    return { pct: global, source: 'GLOBAL' };
}
/** Due date = invoice day + the payment term valid on that day; no term → null (UNKNOWN, not "not due"). */
export function invoiceDueDate(invoiceDay, termDays) {
    if (termDays === null)
        return null;
    return new Date(Date.parse(`${invoiceDay}T00:00:00Z`) + termDays * 86400000).toISOString().slice(0, 10);
}
export function receivableState(dueDate, today) {
    if (dueDate === null)
        return 'NO_TERMS';
    return dueDate < today ? 'OVERDUE' : 'NOT_DUE';
}
/** Same rules, keys, severities and order as kmi_next.economic_decision_proposals. */
export function decisionProposals(f, t = DEFAULT_THRESHOLDS) {
    const out = [];
    for (const p of f.openPayables) {
        const b = dueBucket(p.dueDate, f.today, t.payableDueSoonDays);
        if (b === 'OVERDUE')
            out.push({ key: `PAYABLE_OVERDUE:${p.supplierInvoiceId}`, code: 'PAYABLE_OVERDUE', severity: 'CRITICAL',
                titleTr: `Vadesi geçmiş tedarikçi faturası: ${p.supplier ?? '—'} ${p.invoiceNo}`, actionTr: 'Ödeme planla veya tedarikçiyle vade görüş.',
                evidence: { open: p.open, currency: p.currency, due_date: p.dueDate } });
        else if (b === 'DUE_7')
            out.push({ key: `PAYABLE_DUE_SOON:${p.supplierInvoiceId}`, code: 'PAYABLE_DUE_SOON', severity: 'MEDIUM',
                titleTr: `Yaklaşan tedarikçi ödemesi: ${p.supplier ?? '—'} ${p.invoiceNo}`, actionTr: 'Nakit planına al.',
                evidence: { open: p.open, currency: p.currency, due_date: p.dueDate } });
    }
    for (const r of f.openReceivables) {
        if (r.ageDays > t.receivableAgeDays)
            out.push({ key: `RECEIVABLE_AGED:${r.invoiceId}`, code: 'RECEIVABLE_AGED', severity: 'MEDIUM',
                titleTr: `Tahsil edilmemiş eski fatura: ${r.customerPo ?? '—'} (${r.ageDays} gün)`, actionTr: 'Tahsilat takibi başlat.',
                evidence: { open: r.open, currency: r.currency, invoice_age_days: r.ageDays } });
    }
    for (const r of f.openReceivables) {
        if (r.dueDate && r.dueDate < f.today)
            out.push({ key: `RECEIVABLE_OVERDUE:${r.invoiceId}`, code: 'RECEIVABLE_OVERDUE', severity: 'HIGH',
                titleTr: `Vadesi geçmiş alacak: ${r.customerPo ?? '—'} (${r.overdueDays ?? daysBetweenDates(r.dueDate, f.today)} gün gecikme)`, actionTr: 'Müşteriyle tahsilatı görüş.',
                evidence: { open: r.open, currency: r.currency, due_date: r.dueDate, overdue_days: r.overdueDays ?? daysBetweenDates(r.dueDate, f.today) } });
    }
    for (const x of f.scrapRates ?? []) {
        if (x.rate * 100 >= x.thresholdPct)
            out.push({ key: `HIGH_SCRAP_RATE:${x.productId}:${x.opNo ?? '-'}`, code: 'HIGH_SCRAP_RATE', severity: 'MEDIUM',
                titleTr: `Fire oranı eşiği aştı: ${x.productCode}${x.opNo !== null ? ` op ${x.opNo}` : ''} (%${round2(x.rate * 100)} ≥ %${x.thresholdPct})`, actionTr: 'Fire nedenlerini (NCR) ve proses ayarını incele.',
                evidence: { good: x.good, scrap: x.scrap, rate: x.rate, threshold_pct: x.thresholdPct, threshold_source: x.thresholdSource, window_days: 30 } });
    }
    for (const p of f.products) {
        if (p.invoiced.length === 1 && p.materialCost.length === 1 && p.invoiced[0].currency === p.materialCost[0].currency) {
            const margin = round2(p.invoiced[0].amount - p.materialCost[0].amount);
            if (margin < 0)
                out.push({ key: `NEGATIVE_MATERIAL_MARGIN:${p.productId}`, code: 'NEGATIVE_MATERIAL_MARGIN', severity: 'HIGH',
                    titleTr: `Malzeme maliyeti faturayı aşıyor: ${p.productCode}`, actionTr: 'Fiyatı ve malzeme kullanımını incele.',
                    evidence: { invoiced: p.invoiced[0], material_cost: p.materialCost[0], material_margin: margin } });
        }
        for (const s of p.scrapMaterialCost) {
            const mc = p.materialCost.find((m) => m.currency === s.currency);
            if (mc && mc.amount > 0 && (s.amount / mc.amount) * 100 >= t.scrapSharePct)
                out.push({ key: `HIGH_SCRAP_MATERIAL_COST:${p.productId}:${s.currency}`, code: 'HIGH_SCRAP_MATERIAL_COST', severity: 'MEDIUM',
                    titleTr: `Fireye giden malzeme yüksek: ${p.productCode}`, actionTr: 'Fire nedenlerini (NCR) ve proses ayarını incele.',
                    evidence: { scrap_material_cost: s, material_cost: mc, share_pct: round2((s.amount / mc.amount) * 100) } });
        }
    }
    for (const c of f.priceChanges) {
        const pct = priceChangePct(c.previous, c.latest);
        if (pct !== null && pct >= t.priceIncreasePct)
            out.push({ key: `MATERIAL_PRICE_UP:${c.materialCode}:${c.currency}`, code: 'MATERIAL_PRICE_UP', severity: 'MEDIUM',
                titleTr: `Malzeme fiyatı arttı: ${c.materialCode} (%${pct})`, actionTr: 'Alternatif tedarikçi / fiyat görüşmesi değerlendir.',
                evidence: { previous: c.previous, latest: c.latest, currency: c.currency, change_pct: pct } });
    }
    const recCur = new Set(f.openReceivables.map((r) => r.currency));
    const payCur = new Set(f.openPayables.map((p) => p.currency));
    if (recCur.size > 1 || payCur.size > 1)
        out.push({ key: 'CURRENCY_MIX:OPEN_BALANCES', code: 'CURRENCY_MIX', severity: 'INFO',
            titleTr: 'Açık bakiyeler birden fazla para biriminde', actionTr: 'Kur riskini ayrıca değerlendir (KMI kur kaynağı yok).',
            evidence: { receivable_currencies: [...recCur].sort(), payable_currencies: [...payCur].sort() } });
    return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
export const DECISION_TR = { ACCEPTED: 'KABUL', REJECTED: 'RET', POSTPONED: 'ERTELENDİ' };
/** Same checks as kmi_next.record_management_decision (after the owner gate). */
export function canRecordDecision(r) {
    if (!r.proposalExists)
        return { ok: false, reason: 'PROPOSAL_NOT_FOUND' };
    if (!['ACCEPTED', 'REJECTED', 'POSTPONED'].includes(r.decision))
        return { ok: false, reason: 'INVALID_DECISION' };
    if (!r.note || r.note.trim().length < 5)
        return { ok: false, reason: 'NOTE_REQUIRED' };
    if (r.decision === 'POSTPONED') {
        if (!r.postponeUntil)
            return { ok: false, reason: 'POSTPONE_DATE_REQUIRED' };
        if (r.postponeUntil <= r.today)
            return { ok: false, reason: 'POSTPONE_DATE_NOT_IN_FUTURE' };
    }
    else if (r.postponeUntil)
        return { ok: false, reason: 'POSTPONE_DATE_ONLY_FOR_POSTPONED' };
    return { ok: true };
}
/** A proposal is open unless its latest decision is ACCEPTED/REJECTED, or POSTPONED until a future day. */
export function proposalOpen(latest, today) {
    if (!latest)
        return true;
    if (latest.decision === 'POSTPONED')
        return latest.postponedUntil !== null && latest.postponedUntil <= today;
    return false;
}
/** Same checks as kmi_next.record_corrective_decision (after the economic gate). The original is never edited. */
export function canRecordCorrection(r) {
    if (!r.isLatestForProposal)
        return { ok: false, reason: 'NOT_LATEST_DECISION' };
    if (!['ACCEPTED', 'REJECTED', 'POSTPONED'].includes(r.decision))
        return { ok: false, reason: 'INVALID_DECISION' };
    if (!r.note || r.note.trim().length < 10)
        return { ok: false, reason: 'CORRECTION_REASON_REQUIRED' };
    if (r.decision === 'POSTPONED') {
        if (!r.postponeUntil)
            return { ok: false, reason: 'POSTPONE_DATE_REQUIRED' };
        if (r.postponeUntil <= r.today)
            return { ok: false, reason: 'POSTPONE_DATE_NOT_IN_FUTURE' };
    }
    else if (r.postponeUntil)
        return { ok: false, reason: 'POSTPONE_DATE_ONLY_FOR_POSTPONED' };
    return { ok: true };
}
