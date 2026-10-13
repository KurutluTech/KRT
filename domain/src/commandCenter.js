// KMI NEXT — Command Center & PULSE (Owner order #679 E).
//
// One management view over orders, production, quality, maintenance, stock/material, purchasing
// and shipments, read in ONE call from kmi_next.command_center() (migration 0027), which itself
// reads the same canonical functions every other screen uses (machine_eligibility,
// work_order_readiness, oee_rollup, …) — there is no second dashboard database and no fake
// numbers: an empty shop shows zeros and "no alerts", never sample data.
//
// Alert kinds and their severity are a fixed contract shared with the SQL (lockstep test).
// PULSE = one light per domain: RED if any CRITICAL alert, UNKNOWN without data, STALE when updates
// stopped, AMBER if any HIGH, else GREEN (0037).
// Money never appears here (see D-006): no amounts, prices or balances.
export const ALERT_KINDS = {
    MACHINE_DOWN: { severity: 'CRITICAL', domain: 'MAINTENANCE', label: 'Makine arızada' },
    QUALITY_HOLD_OPEN: { severity: 'CRITICAL', domain: 'QUALITY', label: 'Kalite bekletmesi açık' },
    ORDER_OVERDUE: { severity: 'CRITICAL', domain: 'SHIPMENT', label: 'Termin geçti, teslim eksik' },
    WORK_ORDER_LATE_START: { severity: 'HIGH', domain: 'PRODUCTION', label: 'Planlanan başlangıç geçti' },
    MATERIAL_SHORTAGE_SOON: { severity: 'HIGH', domain: 'MATERIAL', label: 'Yakın planda malzeme eksik' },
    MACHINE_IN_MAINTENANCE: { severity: 'HIGH', domain: 'MAINTENANCE', label: 'Makine bakımda' },
    NCR_OPEN: { severity: 'HIGH', domain: 'QUALITY', label: 'Uygunsuzluk (NCR) açık' },
    READINESS_UNKNOWN_SOON: { severity: 'MEDIUM', domain: 'PRODUCTION', label: 'Yakın planda BOM/CAM verisi yok' },
    INCOMING_QC_WAITING: { severity: 'MEDIUM', domain: 'PURCHASING', label: 'Giriş kalite bekleyen mal' },
    PURCHASE_REQUEST_WAITING: { severity: 'MEDIUM', domain: 'PURCHASING', label: 'Onay bekleyen satınalma talebi' },
};
const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
/** Most severe first, then the oldest first (waiting longest), then stable by title. */
export function prioritizeAlerts(alerts) {
    return alerts.slice().sort((a, b) => {
        const r = RANK[a.severity] - RANK[b.severity];
        if (r !== 0)
            return r;
        const ta = a.since ? Date.parse(a.since) : Number.POSITIVE_INFINITY;
        const tb = b.since ? Date.parse(b.since) : Number.POSITIVE_INFINITY;
        if (ta !== tb)
            return ta - tb;
        return a.title.localeCompare(b.title, 'tr');
    });
}
export const PULSE_DOMAINS = ['PRODUCTION', 'QUALITY', 'MAINTENANCE', 'MATERIAL', 'PURCHASING', 'SHIPMENT'];
export const PRODUCTION_STALE_HOURS = 8;
export const COVERAGE_REASON_TR = {
    NO_RECORDS: 'VERİ YOK — bu alanda henüz kayıt yok',
    NO_UPDATE_8H: 'GECİKMİŞ — çalışan işten 8 saattir bildirim yok',
    MANUAL_SOURCE: 'Elle girilen durum (makine telemetrisi bağlı değil)',
};
export function domainCoverage(domain, f, nowIso) {
    if (f.records <= 0)
        return { state: 'NO_DATA', reason: 'NO_RECORDS' };
    if (domain === 'PRODUCTION' && f.running > 0
        && (f.lastEventAt === null || Date.parse(nowIso) - Date.parse(f.lastEventAt) > PRODUCTION_STALE_HOURS * 3600_000)) {
        return { state: 'STALE', reason: 'NO_UPDATE_8H' };
    }
    return { state: 'KNOWN', reason: domain === 'MAINTENANCE' ? 'MANUAL_SOURCE' : null };
}
/** RED (critical) > UNKNOWN (no data) > STALE > AMBER (high) > GREEN. Green only when data exists and is current. */
export function pulseFromAlerts(alerts, coverage) {
    const out = {};
    for (const d of PULSE_DOMAINS) {
        const mine = alerts.filter((a) => a.domain === d);
        out[d] = mine.some((a) => a.severity === 'CRITICAL') ? 'RED'
            : coverage[d] === 'NO_DATA' ? 'UNKNOWN'
                : coverage[d] === 'STALE' ? 'STALE'
                    : mine.some((a) => a.severity === 'HIGH') ? 'AMBER' : 'GREEN';
    }
    return out;
}
export const PULSE_DOMAIN_TR = {
    PRODUCTION: 'Üretim',
    QUALITY: 'Kalite',
    MAINTENANCE: 'Bakım',
    MATERIAL: 'Malzeme',
    PURCHASING: 'Satınalma',
    SHIPMENT: 'Sevkiyat',
};
