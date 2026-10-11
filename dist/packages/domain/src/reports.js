// KMI NEXT — Reporting Intelligence / Report Pool + KPI dictionary (matrix 4, 5, 27, 28).
// Twin of migration 0034.
//
// Provenance (old KMI, read-only): docs/KMI_R5_FOUNDATION_CLOSURE_REPORTING_INTELLIGENCE.md lists 7
// report triggers whose calculations existed but had ZERO callers ("scheduler gap"), and
// KMI_R5_KPI_CONTRACT_BATCH1.md maps KPIs whose dictionary entries had no reader. KMI NEXT:
//   * every report is generated ON THE SERVER from canonical tables into an immutable snapshot
//     (payload + sha256 fingerprint + who/when/params) — a report can be re-read, never edited;
//   * a report that cannot be calculated says CANNOT_CALCULATE and names the missing input;
//   * reports that need data the system does not have are listed as NOT_AVAILABLE with the reason
//     (monthly puantaj close: D-001; accounting period close: no period model) — not faked;
//   * the KPI dictionary below is the ONE place a KPI's formula, unit, source and unknown-rule are
//     written; the reports screen shows it next to the value.
// Migration 0043: 11 more report families, a formula version on every definition and run, an owner-only
// economic report, ONE output fact source (routed operations included) and the D-014 scheduler
// (report_schedule_tick for service_role; master switch OFF; no pg_cron job installed — owner gate).
export const REPORT_CATALOG = [
    { code: 'SHIPMENT_OVERDUE', titleTr: 'Termini geçmiş, teslim edilmemiş siparişler', domain: 'SHIPMENT', kind: 'EXCEPTION', defaultParams: {}, requiredAction: null, available: true },
    { code: 'QUALITY_HOLD_AGED', titleTr: 'Uzun süredir açık kalite bekletmeleri', domain: 'QUALITY', kind: 'EXCEPTION', defaultParams: { days: 2 }, requiredAction: null, available: true },
    { code: 'NCR_AGING', titleTr: 'Uzun süredir açık uygunsuzluklar (NCR)', domain: 'QUALITY', kind: 'EXCEPTION', defaultParams: { days: 3 }, requiredAction: null, available: true },
    { code: 'PURCHASE_OBLIGATION_AGING', titleTr: 'Gecikmiş satınalma teslimatları', domain: 'PURCHASING', kind: 'EXCEPTION', defaultParams: { days: 7 }, requiredAction: 'PURCHASING_APPROVE', available: true },
    { code: 'READINESS_BLOCKED', titleTr: 'Başlatılamayan iş emirleri (neden ile)', domain: 'PRODUCTION', kind: 'EXCEPTION', defaultParams: {}, requiredAction: null, available: true },
    { code: 'QUALITY_KPI', titleTr: 'Kalite göstergeleri (fire oranı, PPM, NCR)', domain: 'QUALITY', kind: 'PERIODIC', defaultParams: { days: 30 }, requiredAction: null, available: true, formulaVersion: 'v2' },
    { code: 'OEE_PERIOD', titleTr: 'Makine bazında OEE ve kayıplar', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: { days: 7 }, requiredAction: null, available: true, formulaVersion: 'v2' },
    { code: 'MONTHLY_PUANTAJ_CLOSE', titleTr: 'Aylık puantaj kapanışı', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: {}, requiredAction: null, available: false,
        unavailableReason: 'Puantaj formülü canlı veriye bağlanmadı (owner kararı D-001).' },
    { code: 'ACCOUNTING_PERIOD_CLOSE', titleTr: 'Muhasebe dönem kapanışı', domain: 'SHIPMENT', kind: 'PERIODIC', defaultParams: {}, requiredAction: null, available: false,
        unavailableReason: 'KMI’de muhasebe dönemi modeli yok; uydurulmaz.' },
    // ---- 0043 families ----
    { code: 'SHIFT_PRODUCTION', titleTr: 'Vardiya üretimi (makine × vardiya)', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: { days: 2 }, requiredAction: null, available: true },
    { code: 'OEE_LOSSES', titleTr: 'OEE kayıp dağılımı', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: { days: 7 }, requiredAction: null, available: true },
    { code: 'MAINTENANCE_FAULTS', titleTr: 'Bakım ve arıza özeti', domain: 'MAINTENANCE', kind: 'PERIODIC', defaultParams: { days: 30 }, requiredAction: null, available: true },
    { code: 'QUALITY_SCRAP_BY_PRODUCT', titleTr: 'Ürün / operasyon bazında fire', domain: 'QUALITY', kind: 'PERIODIC', defaultParams: { days: 30 }, requiredAction: null, available: true },
    { code: 'CAPACITY_LOAD', titleTr: 'Makine kapasite yükü (önümüzdeki günler)', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: { days: 7 }, requiredAction: null, available: true, family: 'PLANNING' },
    { code: 'STOCK_STATUS', titleTr: 'Stok durumu (hammadde + ürün)', domain: 'PURCHASING', kind: 'PERIODIC', defaultParams: {}, requiredAction: null, available: true, family: 'MATERIAL' },
    { code: 'TOOL_LIFE', titleTr: 'Takım ömrü uyarıları', domain: 'PRODUCTION', kind: 'EXCEPTION', defaultParams: {}, requiredAction: null, available: true, family: 'TOOLROOM' },
    { code: 'SUPPLIER_DELIVERY', titleTr: 'Tedarikçi teslim performansı', domain: 'PURCHASING', kind: 'PERIODIC', defaultParams: { days: 90 }, requiredAction: 'PURCHASING_APPROVE', available: true },
    { code: 'ORDER_FULFILLMENT', titleTr: 'Sipariş karşılama (zamanında sevk)', domain: 'SHIPMENT', kind: 'PERIODIC', defaultParams: { days: 30 }, requiredAction: null, available: true },
    { code: 'COMPETENCY_COVERAGE', titleTr: 'Makine yetkinlik kapsaması', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: {}, requiredAction: null, available: true, family: 'COMPETENCY' },
    { code: 'MANAGEMENT_WEEKLY', titleTr: 'Haftalık yönetim özeti', domain: 'PRODUCTION', kind: 'PERIODIC', defaultParams: { days: 7 }, requiredAction: 'MANAGEMENT_RELEASE', available: true, family: 'MANAGEMENT' },
    { code: 'ECONOMIC_MONTHLY', titleTr: 'Aylık ekonomik özet (yalnız sahip)', domain: 'SHIPMENT', kind: 'PERIODIC', defaultParams: {}, requiredAction: null, available: true, economic: true, family: 'ECONOMIC' },
];
export function reportByCode(code) {
    return REPORT_CATALOG.find((r) => r.code === code);
}
/** Integer "days" parameter: 0..365, default from the catalog (same clamp as SQL). */
export function reportDays(def, params) {
    const raw = params['days'] ?? def.defaultParams['days'] ?? 0;
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n))
        return Number(def.defaultParams['days'] ?? 0);
    return Math.min(365, Math.max(0, n));
}
// ---- calculators (twins of the SQL generators) ----
/** Whole days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a, b) {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
/** SHIPMENT_OVERDUE: due date before today, not fully shipped, order not CANCELLED/CLOSED; most days late first. */
export function shipmentOverdueRows(lines, today) {
    return lines
        .filter((l) => l.dueDate !== null && l.dueDate < today && l.qtyShipped < l.qty && l.orderStatus !== 'CANCELLED' && l.orderStatus !== 'CLOSED')
        .map((l) => ({ customerPo: l.customerPo, productCode: l.productCode, dueDate: l.dueDate, qty: l.qty, shipped: l.qtyShipped, remaining: l.qty - l.qtyShipped, daysLate: daysBetween(l.dueDate, today) }))
        .sort((a, b) => b.daysLate - a.daysLate || (a.customerPo ?? '').localeCompare(b.customerPo ?? ''));
}
/** Age in whole days (Europe/Istanbul calendar days, like SQL). */
export function ageDays(openedAtIso, today) {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(openedAtIso));
    return daysBetween(d, today);
}
/** QUALITY_KPI: scrap rate = scrap / (good + scrap) (4 dp); PPM = round(rate × 1 000 000). No output → CANNOT_CALCULATE. */
export function qualityKpi(c) {
    const total = c.good + c.scrap;
    if (total <= 0)
        return { status: 'CANNOT_CALCULATE', missing: ['COUNT'], scrapRate: null, ppm: null, ncrsOpened: c.ncrsOpened, ncrQty: c.ncrQty };
    return { status: 'OK', missing: [], scrapRate: Math.round((c.scrap / total) * 10000) / 10000, ppm: Math.round((c.scrap / total) * 1000000), ncrsOpened: c.ncrsOpened, ncrQty: c.ncrQty };
}
export const KPI_DICTIONARY = [
    { code: 'OEE', titleTr: 'OEE', formulaTr: 'Kullanılabilirlik × Performans × Kalite', unit: '%', source: 'kmi_next.oee_rollup', unknownRuleTr: 'Planlı süre, çalışma süresi, ideal çevrim veya adet yoksa UNKNOWN (asla %100 değil).', domain: 'PRODUCTION' },
    { code: 'AVAILABILITY', titleTr: 'Kullanılabilirlik', formulaTr: 'Çalışma dakikası ÷ planlı dakika', unit: '%', source: 'kmi_next.oee_rollup', unknownRuleTr: 'Planlı süre yoksa UNKNOWN.', domain: 'PRODUCTION' },
    { code: 'PERFORMANCE', titleTr: 'Performans', formulaTr: 'İdeal süre (adet × CAM çevrimi) ÷ çalışma dakikası', unit: '%', source: 'kmi_next.oee_rollup', unknownRuleTr: 'CAM ideal çevrim süresi yoksa UNKNOWN.', domain: 'PRODUCTION' },
    { code: 'QUALITY_RATE', titleTr: 'Kalite oranı', formulaTr: 'Sağlam ÷ toplam üretilen', unit: '%', source: 'kmi_next.oee_rollup', unknownRuleTr: 'Adet yoksa UNKNOWN.', domain: 'PRODUCTION' },
    { code: 'SCRAP_RATE', titleTr: 'Fire oranı', formulaTr: 'Fire ÷ (sağlam + fire), bildirim + düzeltmeler', unit: '%', source: 'report:QUALITY_KPI', unknownRuleTr: 'Dönemde üretim yoksa CANNOT_CALCULATE.', domain: 'QUALITY' },
    { code: 'PPM', titleTr: 'PPM', formulaTr: 'Fire oranı × 1 000 000', unit: 'adet/milyon', source: 'report:QUALITY_KPI', unknownRuleTr: 'Dönemde üretim yoksa CANNOT_CALCULATE.', domain: 'QUALITY' },
    { code: 'HOLD_AGING', titleTr: 'Kalite bekletme yaşı', formulaTr: 'Bugün − açılış günü (İstanbul takvimi)', unit: 'gün', source: 'report:QUALITY_HOLD_AGED', unknownRuleTr: 'Açık bekletme yoksa liste boş (0 değil "yok").', domain: 'QUALITY' },
    { code: 'NCR_AGING', titleTr: 'NCR yaşı', formulaTr: 'Bugün − açılış günü, kapanmamış NCR', unit: 'gün', source: 'report:NCR_AGING', unknownRuleTr: 'Açık NCR yoksa liste boş.', domain: 'QUALITY' },
    { code: 'OPEN_OBLIGATION', titleTr: 'Açık teslim yükümlülüğü', formulaTr: 'Sipariş adedi − sevk edilen adet, termini geçmiş', unit: 'adet', source: 'report:SHIPMENT_OVERDUE', unknownRuleTr: 'Termin girilmemiş satır hesaba girmez (termin yok = gecikme hesaplanamaz).', domain: 'SHIPMENT' },
    { code: 'PO_AGING', titleTr: 'Satınalma teslim yaşı', formulaTr: 'Bugün − PO oluşturma günü, tam gelmemiş', unit: 'gün', source: 'report:PURCHASE_OBLIGATION_AGING', unknownRuleTr: 'Açık PO yoksa liste boş.', domain: 'PURCHASING' },
    { code: 'CAPACITY_LOAD', titleTr: 'Kapasite yükü', formulaTr: 'Planlı dakika ÷ (gün × üretim vardiyası dakikası)', unit: '%', source: 'report:CAPACITY_LOAD', unknownRuleTr: 'Süresi girilmemiş iş varsa makine BİLİNMİYOR (eksik yük "boş" sayılmaz).', domain: 'PRODUCTION' },
    { code: 'TOOL_LIFE_RATIO', titleTr: 'Takım ömrü oranı', formulaTr: 'Kullanılan dakika ÷ ömür dakikası (≥ %80 uyarı, ≥ %100 bitmiş)', unit: '%', source: 'report:TOOL_LIFE', unknownRuleTr: 'Ömür bilinmiyorsa BİLİNMİYOR; iyi sayılmaz.', domain: 'PRODUCTION' },
    { code: 'SUPPLIER_LEAD_TIME', titleTr: 'Tedarikçi teslim süresi', formulaTr: 'İlk mal kabul günü − PO günü', unit: 'gün', source: 'report:SUPPLIER_DELIVERY', unknownRuleTr: 'Söz verilen tarih tutulmadığı için zamanında teslim oranı hesaplanmaz.', domain: 'PURCHASING' },
    { code: 'ON_TIME_DELIVERY', titleTr: 'Zamanında sevk oranı', formulaTr: 'Termine kadar tamamı sevk edilen satır ÷ durumu bilinen satır', unit: '%', source: 'report:ORDER_FULFILLMENT', unknownRuleTr: 'Sevk kaydı olmayan satır BİLİNMİYOR; orana katılmaz.', domain: 'SHIPMENT' },
    { code: 'START_BLOCKED', titleTr: 'Başlatılamayan iş', formulaTr: 'work_order_start_preview’in red nedeni olan açık iş emirleri', unit: 'adet', source: 'report:READINESS_BLOCKED', unknownRuleTr: 'BOM/CAM yoksa neden "VERİ GEREKLİ" olarak listelenir.', domain: 'PRODUCTION' },
];
// ---- snapshot rendering helpers (pure) ----
/** The data-client camelizes row keys; column keys arrive as snake_case values — map them the same way. */
export function camelKey(key) {
    return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}
function csvCell(v) {
    if (v === null || v === undefined)
        return '';
    const s = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/**
 * CSV for spreadsheet tools set to Turkish: ';' separator (',' is the decimal mark there),
 * UTF-8 BOM so İ/ş/ğ open correctly, CRLF line ends. Values are written exactly as in the snapshot.
 */
export function reportToCsv(columns, rows) {
    const lines = [columns.map((c) => csvCell(c.label)).join(';')];
    for (const r of rows)
        lines.push(columns.map((c) => csvCell(r[camelKey(c.key)] ?? r[c.key])).join(';'));
    return `﻿${lines.join('\r\n')}\r\n`;
}
/** Plant-level output (QUALITY_KPI v2): good leaves the LAST operation only; scrap from every operation. */
export function plantOutput(facts) {
    let good = 0;
    let scrap = 0;
    for (const f of facts) {
        scrap += f.scrap;
        if (f.source !== 'OPERATION' || f.opNo === f.lastOpNo)
            good += f.good;
    }
    return { good, scrap };
}
/** TOOL_LIFE: ratio = used ÷ rated; ≥ 1 WORN, ≥ 0.8 NEAR_END; no rated life = UNKNOWN (never OK). */
export function toolLifeState(used, rated) {
    if (rated === null || !(rated > 0))
        return 'UNKNOWN';
    const r = used / rated;
    return r >= 1 ? 'WORN' : r >= 0.8 ? 'NEAR_END' : 'OK';
}
/** CAPACITY_LOAD: any work without an estimate makes the machine UNKNOWN (missing load is not free time). */
export function capacityState(plannedMinutes, capacityMinutes, noEstimate) {
    if (noEstimate > 0 || capacityMinutes <= 0)
        return 'UNKNOWN';
    if (plannedMinutes > capacityMinutes)
        return 'OVERLOAD';
    return plannedMinutes > 0.85 * capacityMinutes ? 'HIGH' : 'OK';
}
/** ORDER_FULFILLMENT: shipped quantity without a dispatch record is UNKNOWN, never "on time". */
export function fulfilmentState(qty, shipped, lastDispatch, dueDate) {
    if (shipped < qty)
        return 'OPEN_LATE';
    if (lastDispatch === null)
        return 'UNKNOWN';
    return lastDispatch <= dueDate ? 'ON_TIME' : 'LATE';
}
export const PRODUCTION_SHIFTS = [
    { code: 'TeamK1', startMinute: 8 * 60, minutes: 480 },
    { code: 'TeamK2', startMinute: 16 * 60, minutes: 480 },
];
const IST_OFFSET_MS = 3 * 3600 * 1000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
/** The latest trigger moment at or before `atIso`, as the idempotency key of one scheduled run set. */
export function reportScheduleSlot(cadence, atIso, shifts = PRODUCTION_SHIFTS) {
    const local = Date.parse(atIso) + IST_OFFSET_MS; // "local wall clock" expressed as a UTC instant
    const dayStart = Math.floor(local / 86400000) * 86400000;
    const minuteOfDay = (local - dayStart) / 60000;
    if (cadence === 'SHIFT_END') {
        let best = null;
        for (const back of [1, 0]) {
            const d0 = dayStart - back * 86400000;
            for (const s of shifts) {
                const end = d0 + (s.startMinute + s.minutes) * 60000;
                if (end <= local && (best === null || end > best.end))
                    best = { end, key: `SHIFT_END:${isoDay(d0)}:${s.code}` };
            }
        }
        return best ? best.key : null;
    }
    if (cadence === 'DAILY')
        return `DAILY:${isoDay(minuteOfDay >= 7 * 60 + 30 ? dayStart : dayStart - 86400000)}`;
    if (cadence === 'WEEKLY') {
        const dow = (new Date(dayStart).getUTCDay() + 6) % 7; // Monday = 0
        const monday = dayStart - dow * 86400000;
        return `WEEKLY:${isoDay(local >= monday + 8 * 3600000 ? monday : monday - 7 * 86400000)}`;
    }
    const d = new Date(dayStart);
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const useFirst = local >= first + 8 * 3600000 ? first : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
    return `MONTHLY:${isoDay(useFirst).slice(0, 7)}`;
}
