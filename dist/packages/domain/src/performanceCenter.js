// KMI Performance Center — the pure view model. Everything the screen draws is derived here from canonical reads that already exist
// (command_center, live_board, oee_rollup, oee_loss_reasons, next_best_actions, process_mining). No number is estimated and no demo value exists:
// a missing source becomes an explicit UNKNOWN / VERİ GEREKLİ item (listed in `unknowns`), never 0 and never a green light.
// One calculation source per KPI: OEE and its losses come ONLY from the server's oee_rollup; this file only groups and labels them.
import { PULSE_DOMAINS, PULSE_DOMAIN_TR, ALERT_KINDS, prioritizeAlerts } from './commandCenter.js';
import { buildFactoryMap, planVsActual, shiftTable } from './factoryMap.js';
import { LOSS_LABEL_TR } from './oee.js';
import { scrapShare } from './liveKpi.js';
export const NEEDS_DATA = 'VERİ GEREKLİ';
const known = (value) => ({ state: 'KNOWN', value });
const unknown = (reason) => ({ state: 'UNKNOWN', reason });
// ---- outputs ----
export const FIRST_PIECE_WAIT_MIN = 60;
const WORKSPACE_OF_DOMAIN = {
    PRODUCTION: { ws: 'Üretim', href: '#/is-emirleri' }, QUALITY: { ws: 'Kalite & Metroloji', href: '#/kalite' }, MAINTENANCE: { ws: 'Bakım', href: '#/bakim' },
    MATERIAL: { ws: 'Depo & Stok', href: '#/depo' }, PURCHASING: { ws: 'Satınalma', href: '#/satinalma' }, SHIPMENT: { ws: 'Lojistik & Sevkiyat', href: '#/sevkiyat' },
};
const ENTITY_HREF = { MACHINE: '#/bakim', WORK_ORDER: '#/is-emirleri', ORDER_ITEM: '#/siparisler', STOCK_LOT: '#/depo', PURCHASE_REQUEST: '#/talepler' };
const STALE_MIN = 15;
const minutesAgo = (iso, nowIso) => Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(iso)) / 60000));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export function buildPerformanceCenter(i) {
    const unknowns = [];
    const miss = (key, label, reason) => { unknowns.push({ key, label, reason }); };
    const s = i.snapshot, b = i.board;
    if (!s)
        miss('snapshot', 'Komuta anlık görüntüsü', 'command_center okunamadı');
    if (!b)
        miss('board', 'Canlı pano (makine durumu, vardiya, siparişler)', 'live_board okunamadı');
    miss('telemetry', 'Makine telemetrisi / fiziksel çalışma', `CNC bağlantısı yok — ${NEEDS_DATA}; durumlar elle girilen kayıttır`);
    const fresh = s ? minutesAgo(s.generatedAt, i.nowIso) <= STALE_MIN : null;
    // fleet + per-machine
    let fleet;
    let machines = [];
    let tiles = [];
    if (b) {
        const input = b.machines.map((m) => ({ code: m.code, status: m.status, since: m.since, active: m.active, cnc: m.cnc ?? null, shiftGood: m.shiftGood, shiftScrap: m.shiftScrap, openHolds: m.openHolds, openMaintenance: m.openMaintenance }));
        const map = buildFactoryMap(input, i.info);
        tiles = map.groups.flatMap((g) => g.tiles);
        const counts = Object.fromEntries(['DOWN', 'MAINTENANCE', 'HOLD', 'ACTIVE_WORK_ORDER', 'FIRST_PIECE', 'READY_IDLE', 'READY_UNKNOWN', 'UNKNOWN', 'CNC_RUNNING', 'CNC_FEED_HOLD', 'CNC_ALARM', 'CNC_STALE'].map((k) => [k, tiles.filter((t) => t.headline === k).length]));
        fleet = map.total > 0 ? known({ total: map.total, counts, groups: map.groups, physicalNote: 'Fiziksel çalışma BİLİNMİYOR (CNC bağlantısı yok) — durum elle girilen kayıttır', missingFromRegistry: map.missingFromRegistry }) : unknown('Makine kaydı yok');
        machines = b.machines.map((m) => ({ code: m.code, headline: tiles.find((t) => t.code === m.code)?.headline ?? 'UNKNOWN', good: Number.isFinite(m.shiftGood) ? m.shiftGood : null, scrap: Number.isFinite(m.shiftScrap) ? m.shiftScrap : null, oee: m.oeeToday }));
    }
    else
        fleet = unknown('Canlı pano okunamadı');
    // shift performance + day-over-day comparison (declared output only)
    let shift;
    if (b) {
        const rows = shiftTable(b.shiftCompare ?? []).slice(0, 7);
        const days = rows.map((r) => ({ day: r.day, shifts: Object.fromEntries(Object.entries(r.shifts).map(([k, v]) => [k, v ? { good: v.good, scrap: v.scrap, scrapShare: scrapShare(v.good, v.scrap) } : undefined])) }));
        const dayTotal = (d) => Object.values(d.shifts).reduce((a, v) => a + (v?.good ?? 0), 0);
        const todayRow = rows.find((r) => s && r.day === s.today);
        const prev = rows.find((r) => r !== todayRow && (!s || r.day < s.today));
        const todayTot = todayRow ? { good: dayTotal(todayRow), scrap: Object.values(todayRow.shifts).reduce((a, v) => a + (v?.scrap ?? 0), 0) } : null;
        const compare = todayRow && prev ? { prevDay: prev.day, deltaGood: dayTotal(todayRow) - dayTotal(prev), pct: dayTotal(prev) > 0 ? Math.round(((dayTotal(todayRow) - dayTotal(prev)) / dayTotal(prev)) * 100) : null } : null;
        shift = known({ label: b.shift, days, today: todayTot, compare });
    }
    else
        shift = unknown('Canlı pano okunamadı');
    // OEE (server rollup only) + losses + trend
    const oeeSrc = s?.oeeToday ?? null;
    let oee;
    if (oeeSrc) {
        oee = known({ oee: oeeSrc.oee ?? null, availability: oeeSrc.availability ?? null, performance: oeeSrc.performance ?? null, quality: oeeSrc.quality ?? null, missing: oeeSrc.missing ?? [] });
        if (oeeSrc.oee === null || oeeSrc.oee === undefined)
            miss('oee', 'OEE', `${NEEDS_DATA}: ${(oeeSrc.missing ?? []).join(', ') || 'planlı süre / çalışma süresi / ideal çevrim / adet kaydı yok'}`);
    }
    else {
        oee = unknown(`Bugün için OEE hesaplanamadı: planlı süre, çalışma süresi, ideal çevrim ve adet kaydı gerekli — ${NEEDS_DATA}`);
        miss('oee', 'OEE', 'sunucu OEE değeri üretmedi (girdi kaydı yok veya okunamadı)');
    }
    let losses;
    const tot = i.oeeTotal && i.oeeTotal[0] ? i.oeeTotal[0] : null;
    if (tot) {
        const raw = [['setup', tot.lossSetup], ['tool', tot.lossTool], ['fault', tot.lossFault], ['materialWait', tot.lossMaterialWait], ['maintenance', tot.lossMaintenance], ['other', tot.lossOther]];
        const total = sum(raw.map(([, v]) => v));
        losses = total > 0 ? known({ totalMinutes: total, items: raw.filter(([, v]) => v > 0).sort((a, b2) => b2[1] - a[1]).map(([k, v]) => ({ key: k, label: LOSS_LABEL_TR[k], minutes: v, share: v / total })) })
            : unknown(tot.plannedMinutes > 0 ? 'Bu aralıkta kayıtlı kayıp süresi yok' : `Planlı süre kaydı yok — ${NEEDS_DATA}`);
    }
    else
        losses = unknown(i.oeeTotal === null ? 'OEE toplamı okunamadı' : 'Kayıt yok');
    if (losses.state === 'UNKNOWN')
        miss('losses', 'Kayıp analizi', losses.reason);
    let trend;
    if (i.oeeDaily && i.oeeDaily.length) {
        const rows = [...i.oeeDaily].sort((a, b2) => a.groupKey.localeCompare(b2.groupKey)).map((r) => ({ day: r.groupKey, oee: r.oee }));
        trend = known(rows);
        if (rows.every((r) => r.oee === null))
            miss('trend', 'OEE eğilimi', `Hiçbir günde hesaplanabilir OEE yok — ${NEEDS_DATA}`);
    }
    else {
        const why = i.oeeDaily === null ? 'OEE günlük serisi okunamadı' : 'Seçili aralıkta OEE kaydı yok';
        trend = unknown(why);
        miss('trend', 'OEE eğilimi', why);
    }
    // work orders + bottlenecks
    const c = s?.counters ?? {};
    let workOrders;
    const bottlenecks = [];
    if (s) {
        workOrders = known({
            running: c.workOrdersRunning ?? 0, waiting: c.workOrdersWaiting ?? 0, onHold: c.workOrdersOnHold ?? 0,
            live: s.liveWorkOrders.map((w) => ({ id: w.workOrderId, machine: w.machineCode, product: w.productCode, planned: w.qtyPlanned, produced: w.qtyProduced, scrap: w.qtyScrap, pct: planVsActual(w.qtyPlanned, w.qtyProduced).pct, status: w.status, operator: w.operatorName })),
        });
        for (const w of s.liveWorkOrders) {
            if (w.status === 'FIRST_PIECE_PENDING' && w.since && minutesAgo(w.since, i.nowIso) >= FIRST_PIECE_WAIT_MIN)
                bottlenecks.push({ kind: 'FIRST_PIECE_WAIT', title: `İlk parça onayı bekliyor · ${w.machineCode ?? '—'} · ${w.productCode ?? '—'}`, evidence: `${minutesAgo(w.since, i.nowIso)} dk bekliyor (eşik ${FIRST_PIECE_WAIT_MIN} dk) — kayıt: iş emri durumu`, href: `#/kart?t=WORK_ORDER&id=${encodeURIComponent(w.workOrderId)}` });
        }
    }
    else
        workOrders = unknown('Komuta anlık görüntüsü okunamadı');
    for (const t of tiles) {
        if (t.activeWo && (t.headline === 'DOWN' || t.headline === 'HOLD' || t.headline === 'MAINTENANCE'))
            bottlenecks.push({ kind: 'MACHINE_BLOCKED', title: `${t.code} durumu "${t.headline === 'DOWN' ? 'arıza' : t.headline === 'HOLD' ? 'bekletme' : 'bakım'}" ama üzerinde iş emri ${t.activeWo} var`, evidence: 'Makine durum kaydı ile iş emri kaydı çelişiyor / iş durmuş', href: t.id ? `#/kart?t=MACHINE&id=${encodeURIComponent(t.id)}` : '#/bakim' });
    }
    const pb = i.processBottleneck;
    if (pb?.bottleneck)
        bottlenecks.push({ kind: 'PROCESS_STEP', title: `Süreç darboğazı: ${pb.bottleneck.from} → ${pb.bottleneck.to}`, evidence: `medyan ${pb.bottleneck.medianHours} sa, ${pb.bottleneck.count} vaka (süreç madenciliği, kayıtlardan)`, href: '#/zeka' });
    else if (i.processBottleneck === null)
        miss('process', 'Süreç darboğazı', 'process_mining okunamadı');
    else if (pb && pb.sufficiency !== 'SUFFICIENT')
        miss('process', 'Süreç darboğazı', pb.reason ?? `Yeterli tamamlanmış vaka yok — ${NEEDS_DATA}`);
    // orders / deadline risk
    let orders;
    if (b) {
        const open = b.orders.filter((o) => o.qty - o.shipped > 0 || o.state !== 'ON_TRACK');
        orders = known({
            late: b.orders.filter((o) => o.state === 'LATE').length, dueSoon: b.orders.filter((o) => o.state === 'DUE_SOON').length, onTrack: b.orders.filter((o) => o.state === 'ON_TRACK').length,
            worst: open.filter((o) => o.state !== 'ON_TRACK').sort((a, b2) => a.dueDate.localeCompare(b2.dueDate)).slice(0, 5).map((o) => ({ product: o.productCode, dueDate: o.dueDate, open: Math.max(0, o.qty - o.shipped), state: o.state })),
        });
    }
    else
        orders = unknown('Canlı pano okunamadı');
    // quality / maintenance
    let quality;
    if (s)
        quality = known({ holds: c.qualityHoldsOpen ?? 0, ncr: c.ncrsOpen ?? 0, incomingQc: c.incomingQcWaiting ?? 0, firstPiecePending: s.liveWorkOrders.filter((w) => w.status === 'FIRST_PIECE_PENDING').length });
    else
        quality = unknown('Komuta anlık görüntüsü okunamadı');
    let maintenance;
    if (s)
        maintenance = known({ down: c.machinesDown ?? 0, inMaintenance: c.machinesMaintenance ?? 0, openRequests: sum((b?.machines ?? []).map((m) => m.openMaintenance)), machines: tiles.filter((t) => t.headline === 'DOWN' || t.headline === 'MAINTENANCE' || (t.openMaintenance ?? 0) > 0).map((t) => ({ code: t.code, headline: t.headline, openMaintenance: t.openMaintenance ?? 0 })) });
    else
        maintenance = unknown('Komuta anlık görüntüsü okunamadı');
    // departments (PULSE lights are the department performance; coverage says whether the light is trustworthy)
    const departments = PULSE_DOMAINS.map((d) => {
        const cov = s?.coverage?.[d];
        const mine = (s?.alerts ?? []).filter((a) => a.domain === d);
        return { domain: d, label: PULSE_DOMAIN_TR[d], light: s?.pulse?.[d] ?? 'UNKNOWN', records: cov?.records ?? 0, running: cov?.running ?? 0, lastEventAt: cov?.lastEventAt ?? null, alerts: mine.length, critical: mine.filter((a) => a.severity === 'CRITICAL').length, reason: cov?.reason ?? null, workspace: WORKSPACE_OF_DOMAIN[d].ws, drill: `#/komuta?birim=${d}` };
    });
    // explainable risks: every alert says why + where it came from; every rule suggestion carries its evidence class
    const risks = [];
    for (const a of prioritizeAlerts(s?.alerts ?? [])) {
        risks.push({ key: `${a.kind}:${a.entityId}`, severity: a.severity, domain: a.domain, title: a.title, why: [ALERT_KINDS[a.kind]?.label ?? a.kind, a.detail].filter(Boolean).join(' — '), evidence: `Kayıt: ${a.entityType}${a.since ? ` · ${a.since}` : ''} · kural: ${a.kind} (${a.severity})`, href: a.entityId && ['MACHINE', 'WORK_ORDER', 'STOCK_LOT'].includes(a.entityType) ? `#/kart?t=${a.entityType}&id=${encodeURIComponent(a.entityId)}` : ENTITY_HREF[a.entityType] ?? null, since: a.since, kind: 'ALERT' });
    }
    for (const n of i.nba ?? []) {
        risks.push({ key: `nba:${n.key}`, severity: 'ADVISORY', domain: null, title: n.titleTr, why: n.reasonTr, evidence: `Kayıt üzerinden kural (yapay zekâ değil) · etki: ${n.effectTr} · öncelik ${n.risk}`, href: `#${n.source.route}`.replace('##', '#'), since: n.since, kind: 'RULE' });
    }
    if (i.nba === null)
        miss('nba', 'Aksiyon önerileri', 'next_best_actions okunamadı');
    // verdict sentence (never "all clear" without data)
    const crit = (s?.alerts ?? []).filter((a) => a.severity === 'CRITICAL').length;
    const high = (s?.alerts ?? []).filter((a) => a.severity === 'HIGH').length;
    const noDataDomains = s ? PULSE_DOMAINS.filter((d) => s.pulse[d] === 'UNKNOWN').length : PULSE_DOMAINS.length;
    const verdict = !s ? { tone: 'unknown', text: 'Fabrika durumu okunamadı — hiçbir değer varsayılmadı.' }
        : crit > 0 ? { tone: 'critical', text: `${crit} kritik uyarı var; önce bunlara bakılmalı${high ? ` (+${high} yüksek risk)` : ''}.` }
            : high > 0 ? { tone: 'risk', text: `Kritik uyarı yok; ${high} yüksek risk izleniyor.` }
                : noDataDomains > 0 ? { tone: 'unknown', text: `Uyarı yok, ancak ${noDataDomains} alanda veri yok — bu "sorun yok" demek değildir.` }
                    : { tone: 'normal', text: 'Kayıtlı veriye göre kritik uyarı yok.' };
    return { generatedAt: s?.generatedAt ?? null, fresh, verdict, fleet, machines, shift, oee, losses, trend, workOrders, bottlenecks, orders, quality, maintenance, departments, risks, unknowns };
}
/** The drill-down level 2 (department): the same model, narrowed to one domain's records. */
export function departmentSlice(m, domain) {
    return { department: m.departments.find((d) => d.domain === domain) ?? null, risks: m.risks.filter((r) => r.domain === domain), workspaceHref: WORKSPACE_OF_DOMAIN[domain].href };
}
export function parseDomain(v) { return PULSE_DOMAINS.includes(v ?? '') ? v : null; }
