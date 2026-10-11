// KMI NEXT — Command Center & PULSE (#679 E). One management view over orders, production,
// quality, maintenance, material, purchasing and shipments — one server snapshot
// UNKNOWN ≠ PASS (0037): a domain without records shows VERİ YOK, stopped updates show GECİKMİŞ.
// (kmi_next.command_center), the same canonical functions as every other screen. No sample data:
// an empty shop shows zeros and "uyarı yok". No money on this screen (D-006).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { PULSE_DOMAINS, PULSE_DOMAIN_TR, ALERT_KINDS, COVERAGE_REASON_TR } from '../../../../packages/domain/src/commandCenter.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const CSS = `
.cc{--bg:#0b1220;--card:#121b2e;--line:#22304d;--txt:#e6edf7;--mut:#8ea0bf;--red:#ef4444;--amber:#f59e0b;--green:#22c55e;
  background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box;min-height:100vh;max-width:100%}
.cc h1{font-size:20px;margin:0 0 4px} .cc .mut{color:var(--mut);font-size:12px}
.cc .pulse{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:12px 0}
.cc .chip{border-radius:12px;padding:10px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;gap:8px;font-weight:600}
.cc .dot{width:12px;height:12px;border-radius:50%;flex:none}
.cc .GREEN .dot{background:var(--green)} .cc .UNKNOWN .dot{background:transparent;border:2px dashed var(--mut)} .cc .STALE .dot{background:#a855f7}
.cc .chip .st{font-size:10px;font-weight:800;color:var(--mut);margin-left:auto} .cc .AMBER .dot{background:var(--amber)} .cc .RED .dot{background:var(--red);box-shadow:0 0 10px var(--red)}
.cc .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.cc .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px}
.cc .num{font-size:24px;font-weight:800} .cc .lbl{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.cc .alert{display:flex;gap:10px;align-items:flex-start;border-left:4px solid var(--line);background:var(--card);border-radius:8px;padding:8px 10px;margin:6px 0}
.cc .alert.CRITICAL{border-color:var(--red)} .cc .alert.HIGH{border-color:var(--amber)} .cc .alert.MEDIUM{border-color:#64748b}
.cc .sev{font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;background:var(--line);white-space:nowrap}
.cc .wrap{overflow-x:auto} .cc table{width:100%;border-collapse:collapse;font-size:13px} .cc td,.cc th{padding:6px;border-bottom:1px solid var(--line);text-align:left}
.cc button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600}
`;
const SEV_TR = { CRITICAL: 'KRİTİK', HIGH: 'YÜKSEK', MEDIUM: 'ORTA' };
const COUNTERS = [
    ['openOrders', 'Açık sipariş'],
    ['orderItemsOverdue', 'Termini geçen kalem'],
    ['workOrdersRunning', 'Çalışan iş emri'],
    ['workOrdersWaiting', 'Bekleyen iş emri'],
    ['workOrdersOnHold', 'Duran iş emri'],
    ['machinesEligible', 'Üretime uygun makine'],
    ['machinesDown', 'Arızalı makine'],
    ['machinesMaintenance', 'Bakımdaki makine'],
    ['qualityHoldsOpen', 'Kalite bekletmesi'],
    ['ncrsOpen', 'Açık NCR'],
    ['incomingQcWaiting', 'Giriş kalite bekleyen'],
    ['purchaseRequestsWaiting', 'Onay bekleyen talep'],
    ['purchaseOrdersOpen', 'Açık satınalma'],
    ['shipmentsDraft', 'Hazırlanan sevkiyat'],
];
const timers = new WeakMap();
export async function renderCommandCenterScreen(container, api, opts = {}) {
    const prev = timers.get(container);
    if (prev)
        clearTimeout(prev);
    let snap = null;
    let loadError = null;
    try {
        snap = await api.snapshot();
    }
    catch (err) {
        loadError = sharedErrorText(err);
    }
    const refresh = () => void renderCommandCenterScreen(container, api, opts);
    const body = !snap
        ? h('div', { 'data-testid': 'cc-load-error', class: 'card' }, `Yüklenemedi: ${loadError}`)
        : h('div', {}, h('div', { class: 'pulse', 'data-testid': 'cc-pulse' }, ...PULSE_DOMAINS.map((d) => h('div', { class: `chip ${snap.pulse[d]}`, 'data-testid': 'cc-pulse-chip', 'data-domain': d, 'data-light': snap.pulse[d],
            title: snap.coverage?.[d]?.reason ? COVERAGE_REASON_TR[snap.coverage[d].reason] ?? '' : '' }, h('span', { class: 'dot' }), PULSE_DOMAIN_TR[d], snap.pulse[d] === 'UNKNOWN' ? h('span', { class: 'st' }, 'VERİ YOK') : snap.pulse[d] === 'STALE' ? h('span', { class: 'st' }, 'GECİKMİŞ') : null))), PULSE_DOMAINS.some((d) => snap.pulse[d] === 'UNKNOWN' || snap.pulse[d] === 'STALE')
            ? h('div', { class: 'mut', 'data-testid': 'cc-coverage-note' }, PULSE_DOMAINS.filter((d) => snap.pulse[d] === 'UNKNOWN' || snap.pulse[d] === 'STALE')
                .map((d) => `${PULSE_DOMAIN_TR[d]}: ${COVERAGE_REASON_TR[snap.coverage?.[d]?.reason ?? 'NO_RECORDS'] ?? ''}`).join(' · '), '. Veri yokken ışık yeşil yanmaz.')
            : null, h('div', { class: 'grid', 'data-testid': 'cc-counters' }, ...COUNTERS.map(([k, label]) => h('div', { class: 'card', 'data-testid': 'cc-counter', 'data-key': k }, h('div', { class: 'num' }, k === 'machinesEligible' ? `${snap.counters[k] ?? 0}/${snap.counters.machinesTotal ?? 0}` : String(snap.counters[k] ?? 0)), h('div', { class: 'lbl' }, label)))), h('h2', {}, 'Öncelikli uyarılar'), snap.alerts.length === 0
            ? h('div', { class: 'card', 'data-testid': 'cc-no-alerts' }, 'Uyarı yok' + (PULSE_DOMAINS.some((d) => snap.pulse[d] === 'UNKNOWN') ? ' — ama bazı alanlarda veri yok; bu "sorun yok" demek değildir.' : '.'))
            : h('div', { 'data-testid': 'cc-alerts' }, ...snap.alerts.map((a) => h('div', { class: `alert ${a.severity}`, 'data-testid': 'cc-alert', 'data-kind': a.kind, 'data-severity': a.severity }, h('span', { class: 'sev' }, SEV_TR[a.severity]), h('div', {}, h('div', { style: 'font-weight:600' }, a.title), h('div', { class: 'mut' }, [ALERT_KINDS[a.kind]?.label ?? a.kind, a.detail, a.since ? `· ${a.since.slice(0, 16).replace('T', ' ')}` : null].filter(Boolean).join(' — ')))))), h('h2', {}, 'Canlı iş emirleri'), snap.liveWorkOrders.length === 0
            ? h('div', { class: 'card', 'data-testid': 'cc-no-live' }, 'Şu an çalışan iş emri yok.')
            : h('div', { class: 'wrap' }, h('table', { 'data-testid': 'cc-live' }, h('thead', {}, h('tr', {}, ...['Makine', 'Ürün', 'Operatör', 'Üretilen / Plan', 'Fire', 'Durum'].map((t) => h('th', {}, t)))), h('tbody', {}, ...snap.liveWorkOrders.map((w) => h('tr', { 'data-testid': 'cc-live-row' }, h('td', {}, w.machineCode ?? '—'), h('td', {}, w.productCode ?? '—'), h('td', {}, w.operatorName ?? '—'), h('td', {}, `${w.qtyProduced} / ${w.qtyPlanned}`), h('td', {}, String(w.qtyScrap)), h('td', {}, w.status)))))), h('h2', {}, 'Bugünkü OEE'), h('div', { class: 'grid', 'data-testid': 'cc-oee' }, ...[['oee', 'OEE'], ['availability', 'Kullanılabilirlik'], ['performance', 'Performans'], ['quality', 'Kalite']].map(([k, label]) => h('div', { class: 'card', 'data-testid': 'cc-oee-card', 'data-key': k }, h('div', { class: 'num', style: 'font-size:18px' }, percentLabel(snap.oeeToday ? snap.oeeToday[k] : null)), h('div', { class: 'lbl' }, label)))));
    const screen = h('div', { class: 'cc', 'data-testid': 'cc-root' }, h('style', {}, CSS), h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap' }, h('div', {}, h('h1', {}, 'Komuta Merkezi · PULSE'), h('div', { class: 'mut', 'data-testid': 'cc-generated' }, snap ? `Veri anı: ${snap.generatedAt.slice(0, 19).replace('T', ' ')} · canonical KMI NEXT verisi` : '')), h('button', { type: 'button', 'data-testid': 'cc-refresh', onClick: refresh }, 'Yenile')), body);
    mount(container, screen);
    if (opts.refreshMs && opts.refreshMs > 0)
        timers.set(container, setTimeout(refresh, opts.refreshMs));
}
