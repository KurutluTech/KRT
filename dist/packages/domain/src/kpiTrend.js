export const KPI_CATALOG = {
    oee: { id: 'oee', label: 'OEE', unit: '%', improve: 'higher', kind: 'rate', source: 'oee rollup (kayıtlı süre/adet)', visibility: null },
    good_qty: { id: 'good_qty', label: 'Sağlam parça', unit: 'adet', improve: 'higher', kind: 'sum', source: 'production_events (GOOD)', visibility: null },
    scrap_rate: { id: 'scrap_rate', label: 'Hurda oranı', unit: '%', improve: 'lower', kind: 'rate', source: 'production_events (SCRAP/toplam)', visibility: null },
    unplanned_downtime: { id: 'unplanned_downtime', label: 'Plansız duruş', unit: 'dk', improve: 'lower', kind: 'sum', source: 'machine_state_events (DOWN)', visibility: null },
    machine_failures: { id: 'machine_failures', label: 'Makine arıza sayısı', unit: 'adet', improve: 'lower', kind: 'sum', source: 'maintenance_tickets', visibility: null },
    on_time_delivery: { id: 'on_time_delivery', label: 'Zamanında teslimat oranı', unit: '%', improve: 'higher', kind: 'rate', source: 'shipments/order_items', visibility: 'COMMERCIAL' },
    unit_cost: { id: 'unit_cost', label: 'Parça başına üretim maliyeti', unit: '₺/adet', improve: 'lower', kind: 'rate', source: 'cost intelligence', visibility: 'ECONOMICS' },
    first_pass_yield: { id: 'first_pass_yield', label: 'İlk seferde doğru üretim oranı', unit: '%', improve: 'higher', kind: 'rate', source: 'quality records', visibility: null },
    open_ncr: { id: 'open_ncr', label: 'Açık kalite uygunsuzluğu', unit: 'adet', improve: 'lower', kind: 'level', source: 'quality_ncr', visibility: null },
    tool_cost: { id: 'tool_cost', label: 'Takım tüketim maliyeti', unit: '₺', improve: 'contextual', kind: 'sum', source: 'tool consumption', visibility: 'ECONOMICS' },
};
const fin = (n) => typeof n === 'number' && Number.isFinite(n);
const fmt = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(n);
export function comparability(meta, i) {
    if (!fin(i.value))
        return 'güncel değer yok';
    if (!fin(i.reference))
        return 'karşılaştırma dönemi verisi yok';
    if (meta.kind === 'sum') {
        const a = i.period?.days, b = i.referencePeriod?.days;
        if (!fin(a) || !fin(b))
            return 'dönem uzunluğu bilinmiyor';
        if (a !== b)
            return `dönem uzunlukları farklı (${a} gün ≠ ${b} gün)`;
    }
    if (meta.kind === 'rate') {
        if (!fin(i.denominator) || !fin(i.referenceDenominator) || i.denominator <= 0 || i.referenceDenominator <= 0)
            return 'oran paydası boş veya bilinmiyor';
    }
    if (i.scope !== undefined && i.referenceScope !== undefined && (i.scope ?? '') !== (i.referenceScope ?? ''))
        return 'kapsam/ürün karması farklı';
    return null;
}
export function evaluateKpi(i) {
    const meta = KPI_CATALOG[i.id];
    const base = { id: i.id, label: meta?.label ?? i.id, unit: meta?.unit ?? '' };
    const visible = i.allowed !== false;
    const none = (state, reason, text) => ({ ...base, visible, state, value: visible && fin(i.value) ? i.value : null, reference: visible && fin(i.reference) ? i.reference : null, comparable: false, incomparableReason: reason,
        arrow: null, delta: null, percent: null, verdict: 'UNCERTAIN', verdictText: 'KARŞILAŞTIRMA YOK', tone: 'GREY', improve: meta?.improve ?? 'contextual', freshness: 'UNKNOWN', text });
    if (!meta)
        return none('UNKNOWN', 'KPI tanımı yok', `${i.id}: KPI kataloğunda tanımlı değil`);
    if (!visible)
        return { ...none('UNKNOWN', 'yetki yok', `${meta.label}: bu rol için görünür değil`), value: null, reference: null, verdictText: 'YETKİ YOK' };
    const t = i.asOf ? Date.parse(i.asOf) : NaN;
    const stale = Number.isFinite(t) ? i.nowMs - t > (i.staleAfterMs ?? 15 * 60_000) : false;
    const freshness = !Number.isFinite(t) ? 'UNKNOWN' : stale ? 'STALE' : 'FRESH';
    if (!fin(i.value))
        return { ...none('UNKNOWN', 'güncel değer yok', `${meta.label}: BİLİNMİYOR`), freshness };
    const state = stale ? 'STALE' : 'KNOWN';
    const why = comparability(meta, i);
    if (why)
        return { ...none(state, why, `${meta.label}: ${fmt(i.value)} ${meta.unit} · KARŞILAŞTIRMA YOK (${why})`), value: i.value, freshness, state };
    const delta = i.value - i.reference;
    const percent = i.reference !== 0 ? (delta / Math.abs(i.reference)) * 100 : null;
    const flat = Math.abs(delta) < 1e-9;
    const up = delta > 0;
    const arrow = flat ? '■' : up ? '▲' : '▼';
    let verdict;
    if (flat)
        verdict = 'NEUTRAL';
    else if (meta.improve === 'contextual')
        verdict = 'NEUTRAL';
    else if (meta.improve === 'higher')
        verdict = up ? 'GOOD' : 'BAD';
    else if (meta.improve === 'lower')
        verdict = up ? 'BAD' : 'GOOD';
    else if (i.targetRange) {
        const d = (v) => (v < i.targetRange.min ? i.targetRange.min - v : v > i.targetRange.max ? v - i.targetRange.max : 0);
        verdict = d(i.value) < d(i.reference) ? 'GOOD' : d(i.value) > d(i.reference) ? 'BAD' : 'NEUTRAL';
    }
    else
        verdict = 'UNCERTAIN';
    if (stale && verdict === 'GOOD')
        verdict = 'UNCERTAIN'; // an old good is not a current good
    const tone = verdict === 'GOOD' ? 'GREEN' : verdict === 'BAD' ? 'RED' : verdict === 'NEUTRAL' ? 'BLUE' : 'GREY';
    const verdictText = verdict === 'GOOD' ? 'OLUMLU' : verdict === 'BAD' ? 'OLUMSUZ' : verdict === 'NEUTRAL' ? (meta.improve === 'contextual' ? 'KOŞULA BAĞLI' : 'DEĞİŞMEDİ') : stale ? 'VERİ BAYAT' : 'BELİRSİZ';
    const word = flat ? 'değişmedi' : up ? 'arttı' : 'azaldı';
    return { ...base, visible, state, value: i.value, reference: i.reference, comparable: true, incomparableReason: null, arrow, delta, percent, verdict, verdictText, tone, improve: meta.improve, freshness,
        text: `${meta.label}: ${fmt(i.reference)} → ${fmt(i.value)} ${meta.unit} (${word}${percent !== null && !flat ? `, %${fmt(Math.abs(percent))}` : ''}) · ${verdictText}` };
}
