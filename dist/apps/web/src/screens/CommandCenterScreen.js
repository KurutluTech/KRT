// KMI Komuta Merkezi · PULSE (#679 E). One management view over orders, production,
// quality, maintenance, material, purchasing and shipments — one server snapshot
// UNKNOWN ≠ PASS (0037): a domain without records shows VERİ YOK, stopped updates show GECİKMİŞ.
// (kmi_next.command_center), the same canonical functions as every other screen. No sample data:
// an empty shop shows zeros and "uyarı yok". No money on this screen (D-006).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { PULSE_DOMAINS, PULSE_DOMAIN_TR, ALERT_KINDS, COVERAGE_REASON_TR } from '../../../../packages/domain/src/commandCenter.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const CSS = `
.cc{--bg:#0b1220;--card:#111c2e;--card2:#0f172a;--line:#1e293b;--line2:#334155;--txt:#e6edf7;--mut:#94a3b8;--red:#ef4444;--amber:#f59e0b;--green:#22c55e;--cyan:#22d3ee;--gold:#d4af37;--violet:#a78bfa;
  color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;box-sizing:border-box;max-width:100%;display:flex;flex-direction:column;gap:14px}
.cc *{box-sizing:border-box}
.cc h1{font-size:20px;margin:0;letter-spacing:.01em} .cc h2{font-size:12px;margin:0 0 10px;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);display:flex;align-items:center;gap:8px;font-weight:700}
.cc .mut{color:var(--mut);font-size:12px}
.cc svg{flex:none}
.cc .top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.cc .live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mut)}
.cc .live i{width:8px;height:8px;border-radius:50%;background:var(--green);animation:ccBeat 2.4s ease-in-out infinite}
.cc .live.old i{background:var(--amber);animation:none}
.cc button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer}
.cc .panel{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}
/* 1 — critical alerts hero */
.cc .hero{border-color:var(--line2)} .cc .hero.crit{border-color:#7f1d1d;background:linear-gradient(135deg,#2a0f14,#111c2e 55%);box-shadow:0 0 0 1px rgba(239,68,68,.25),0 8px 30px rgba(239,68,68,.12)}
.cc .hero.none{border-color:#14532d}
.cc .heroHead{display:flex;align-items:center;gap:12px;margin-bottom:8px} .cc .big{font-size:40px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.cc .hero.crit .big{color:#fca5a5} .cc .alert{display:flex;gap:10px;align-items:flex-start;border-left:4px solid var(--line2);background:rgba(15,23,42,.7);border-radius:8px;padding:8px 10px;margin:6px 0}
.cc .alert.CRITICAL{border-color:var(--red)} .cc .alert.HIGH{border-color:var(--amber)} .cc .alert.MEDIUM{border-color:#64748b}
.cc .sev{font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;background:var(--line);white-space:nowrap} .cc .CRITICAL .sev{background:#7f1d1d;color:#fecaca} .cc .HIGH .sev{background:#78350f;color:#fde68a}
.cc .cols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:14px;align-items:start}
/* 2 — production health */
.cc .pulse{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.cc .chip{border-radius:12px;padding:10px 6px;background:rgba(2,6,23,.45);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:6px;font-weight:600;font-size:12px;text-align:center}
.cc .ring{width:34px;height:34px;border-radius:50%;border:3px solid var(--mut);display:flex;align-items:center;justify-content:center;color:var(--mut)}
.cc .GREEN .ring{border-color:var(--green);color:var(--green)} .cc .AMBER .ring{border-color:var(--amber);color:var(--amber)} .cc .STALE .ring{border-color:var(--violet);color:var(--violet)}
.cc .RED .ring{border-color:var(--red);color:var(--red);box-shadow:0 0 12px rgba(239,68,68,.55)} .cc .UNKNOWN .ring{border-style:dashed}
.cc .chip .st{font-size:10px;font-weight:800;color:var(--mut)}
.cc .fleet{display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--line);margin:12px 0 6px} .cc .fleet span{display:block;height:100%}
.cc .legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--mut)} .cc .legend b{color:var(--txt);font-variant-numeric:tabular-nums}
.cc .sw{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
.cc .machines{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-top:12px}
.cc .mc{border:1px solid var(--line2);border-radius:12px;padding:10px;background:rgba(2,6,23,.45);display:flex;flex-direction:column;gap:6px}
.cc .mc .row{display:flex;align-items:center;gap:10px} .cc .mc .code{font-weight:800;font-size:15px} .cc .mc .tag{margin-left:auto;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;background:#14532d;color:#bbf7d0}
.cc .mc.WAIT .tag,.cc .mc.STALE .tag{background:#78350f;color:#fde68a} .cc .bar{height:6px;border-radius:4px;background:var(--line);overflow:hidden} .cc .bar i{display:block;height:100%;background:var(--cyan)}
.cc .cnc{color:var(--cyan)} .cc .mc.STALE .cnc,.cc .mc.WAIT .cnc{color:var(--amber)} .cc .cnc .spin{transform-origin:12px 14px;transform-box:view-box}
.cc .mc.RUN .cnc .spin{animation:ccSpin 1.6s linear infinite}
.cc .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-top:10px} .cc .stat{border:1px solid var(--line);border-radius:10px;padding:8px;background:rgba(2,6,23,.4)} .cc .stat .num{font-size:20px;font-weight:800} .cc .stat .lbl{font-size:11px;color:var(--mut)}
/* 3 — actions */
.cc .acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:10px}
.cc .act{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:rgba(2,6,23,.4)}
.cc .act .num{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;min-width:26px} .cc .act .lbl{font-size:11px;color:var(--mut);line-height:1.2}
.cc .act.on{border-color:#78350f;background:rgba(120,53,15,.22)} .cc .act.on .num{color:#fcd34d} .cc .act.on.red{border-color:#7f1d1d;background:rgba(127,29,29,.25)} .cc .act.on.red .num{color:#fca5a5}
/* 4 — performance */
.cc .perf{display:grid;grid-template-columns:132px minmax(0,1fr);gap:14px;align-items:center}
.cc .gauge{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.cc .gauge .g{width:112px;height:112px;border-radius:50%;border:8px solid var(--line2);display:flex;align-items:center;justify-content:center;padding:6px}
.cc .gauge .g.unk{border-style:dashed;border-color:var(--mut)} .cc .gauge .g.ok{border-color:var(--cyan)}
.cc .gauge .num{font-size:12px;font-weight:800;line-height:1.25;color:var(--mut)} .cc .gauge .g.ok .num{font-size:26px;color:var(--txt)}
.cc .sub{display:grid;gap:6px} .cc .sub>div{border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:rgba(2,6,23,.4);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap} .cc .sub .num{order:2;text-align:right} .cc .sub .num{font-size:12px;font-weight:800;color:var(--mut)} .cc .sub .lbl,.cc .flow .lbl{font-size:11px;color:var(--mut)}
.cc .flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:8px} .cc .flow>div{border:1px solid var(--line);border-radius:10px;padding:8px;background:rgba(2,6,23,.4)} .cc .flow .num{font-size:20px;font-weight:800}
@keyframes ccSpin{to{transform:rotate(360deg)}} @keyframes ccBeat{0%,100%{opacity:1}50%{opacity:.35}}
@media (max-width:1100px){.cc .cols{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){.cc .top button{padding:6px 10px;font-size:13px} .cc .stat .num,.cc .act .num{font-size:18px}.cc .pulse{grid-template-columns:repeat(3,minmax(0,1fr))} .cc .perf{grid-template-columns:minmax(0,1fr)} .cc .big{font-size:32px}}
@media (prefers-reduced-motion:reduce){.cc *{animation:none !important}}
`;
const SEV_TR = { CRITICAL: 'KRİTİK', HIGH: 'YÜKSEK', MEDIUM: 'ORTA' };
const COUNTER_LABEL = {
    openOrders: 'Açık sipariş', orderItemsOverdue: 'Termini geçen kalem', workOrdersRunning: 'Çalışan iş emri', workOrdersWaiting: 'Bekleyen iş emri',
    workOrdersOnHold: 'Duran iş emri', machinesEligible: 'Üretime uygun makine', machinesDown: 'Arızalı makine', machinesMaintenance: 'Bakımdaki makine',
    qualityHoldsOpen: 'Kalite bekletmesi', ncrsOpen: 'Açık NCR', incomingQcWaiting: 'Giriş kalite bekleyen', purchaseRequestsWaiting: 'Onay bekleyen talep',
    purchaseOrdersOpen: 'Açık satınalma', shipmentsDraft: 'Hazırlanan sevkiyat',
};
// Action-required counters: tone red = a hard stop, amber = needs a decision. Zero stays muted.
const ACTION_KEYS = [
    ['orderItemsOverdue', 'red', 'clock'], ['qualityHoldsOpen', 'red', 'shield'], ['ncrsOpen', 'amber', 'shield'],
    ['incomingQcWaiting', 'amber', 'box'], ['purchaseRequestsWaiting', 'amber', 'cart'], ['workOrdersOnHold', 'amber', 'pause'],
];
const FLOW_KEYS = ['openOrders', 'purchaseOrdersOpen', 'shipmentsDraft'];
const timers = new WeakMap();
const ICONS = {
    PRODUCTION: '<path d="M3 20V9l6 3V9l6 3V5h6v15z"/>', QUALITY: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5L15.5 10"/>',
    MAINTENANCE: '<path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-.7-.7-2.6z"/>', MATERIAL: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    PURCHASING: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h3l2.5 11h9.5l2-8H7"/>', SHIPMENT: '<path d="M2 7h12v10H2zM14 10h4l4 3v4h-8z"/><circle cx="6" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', shield: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>', box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h3l2.5 11h9.5l2-8H7"/>', pause: '<path d="M9 5v14M15 5v14"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>', ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
function svg(inner, size = 18, sw = 1.8) {
    const el = document.createElement('span');
    el.style.display = 'inline-flex';
    el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
    return el;
}
const ic = (k, size = 18) => svg(ICONS[k] ?? '', size);
/** CNC machining centre: cabinet, door window, spindle head with a rotating chuck/tool (the .spin group). */
function cncIcon(size = 40) {
    return svg('<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 17h19"/><rect x="5" y="6.5" width="9" height="8" rx="1"/><g class="spin"><path d="M9.5 9v2.2"/><path d="M8.2 11.2h2.6"/><path d="M9.5 11.2v2.6"/></g><path d="M17 7.5h2M17 10h2"/><circle cx="18" cy="14" r="0.6"/>', size, 1.4);
}
const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
function ageLabel(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t))
        return { text: '', old: true };
    const min = Math.max(0, Math.round((Date.now() - t) / 60000));
    const text = min < 1 ? 'az önce' : min < 60 ? `${min} dk önce` : min < 1440 ? `${Math.round(min / 60)} sa önce` : `${Math.round(min / 1440)} gün önce`;
    return { text, old: min > 15 };
}
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
    const counter = (k, cls = '', labelOverride) => h('div', { class: cls, 'data-testid': 'cc-counter', 'data-key': k }, h('div', { class: 'num' }, k === 'machinesEligible' ? `${snap.counters[k] ?? 0}/${snap.counters.machinesTotal ?? 0}` : String(snap.counters[k] ?? 0)), h('div', { class: 'lbl' }, labelOverride ?? COUNTER_LABEL[k]));
    const SRC = { MACHINE: ['#/bakim', 'Bakım'], WORK_ORDER: ['#/is-emirleri', 'İş emirleri'], ORDER_ITEM: ['#/siparisler', 'Siparişler'], STOCK_LOT: ['#/malzeme', 'Malzeme'], PURCHASE_REQUEST: ['#/talepler', 'Talepler'] };
    const alertRow = (a) => h('div', { class: `alert ${a.severity}`, 'data-testid': 'cc-alert', 'data-kind': a.kind, 'data-severity': a.severity }, h('span', { class: 'sev' }, SEV_TR[a.severity]), h('div', { style: 'min-width:0' }, h('div', { style: 'font-weight:600' }, a.title), h('div', { class: 'mut' }, [ALERT_KINDS[a.kind]?.label ?? a.kind, a.detail, a.since ? `· ${a.since.slice(0, 16).replace('T', ' ')}` : null].filter(Boolean).join(' — '))), SRC[a.entityType] ? h('a', { href: SRC[a.entityType][0], 'data-testid': 'cc-alert-link', style: 'margin-left:auto;color:var(--cyan);font-size:12px;white-space:nowrap' }, `${SRC[a.entityType][1]} →`) : null);
    let body;
    if (!snap) {
        body = h('div', { 'data-testid': 'cc-load-error', class: 'panel' }, `Yüklenemedi: ${loadError}`);
    }
    else {
        const s = snap;
        const unknownDomains = PULSE_DOMAINS.filter((d) => s.pulse[d] === 'UNKNOWN');
        const critical = s.alerts.filter((a) => a.severity === 'CRITICAL');
        const others = s.alerts.filter((a) => a.severity !== 'CRITICAL');
        const c = s.counters;
        const total = c.machinesTotal ?? 0;
        const down = c.machinesDown ?? 0;
        const maint = c.machinesMaintenance ?? 0;
        const hold = c.machinesHold ?? 0;
        const fresh = !ageLabel(s.generatedAt).old;
        // verified running = work order IN_PROGRESS on a machine (server statuses: IN_PROGRESS / FIRST_PIECE_PENDING / FIRST_PIECE_APPROVED)
        const runningCodes = new Set(s.liveWorkOrders.filter((w) => w.status === 'IN_PROGRESS' && w.machineCode).map((w) => w.machineCode));
        const run = Math.min(runningCodes.size, total);
        const idle = Math.max(0, total - run - down - maint - hold);
        const stale = PULSE_DOMAINS.filter((d) => s.pulse[d] === 'UNKNOWN' || s.pulse[d] === 'STALE');
        const heroEl = h('section', { class: `panel hero ${critical.length ? 'crit' : unknownDomains.length ? '' : 'none'}`, 'data-testid': 'cc-hero' }, h('div', { class: 'heroHead' }, h('span', { style: `color:${critical.length ? 'var(--red)' : 'var(--green)'}` }, ic(critical.length ? 'alert' : 'ok', 30)), h('div', {}, h('div', { class: 'big', 'data-testid': 'cc-critical-count' }, String(critical.length)), h('div', { class: 'mut' }, critical.length ? 'kritik uyarı — önce bunlar' : 'kritik uyarı yok'))), critical.length
            ? h('div', { 'data-testid': 'cc-alerts' }, ...critical.map(alertRow))
            : s.alerts.length === 0
                ? h('div', { 'data-testid': 'cc-no-alerts', class: 'mut' }, 'Uyarı yok' + (unknownDomains.length ? ' — ama bazı alanlarda veri yok; bu "sorun yok" demek değildir.' : '.'))
                : null);
        const pulseEl = h('div', { class: 'pulse', 'data-testid': 'cc-pulse' }, ...PULSE_DOMAINS.map((d) => h('div', { class: `chip ${s.pulse[d]}`, 'data-testid': 'cc-pulse-chip', 'data-domain': d, 'data-light': s.pulse[d],
            title: s.coverage?.[d]?.reason ? COVERAGE_REASON_TR[s.coverage[d].reason] ?? '' : '' }, h('span', { class: 'ring' }, ic(d, 16)), PULSE_DOMAIN_TR[d], s.pulse[d] === 'UNKNOWN' ? h('span', { class: 'st' }, 'VERİ YOK') : s.pulse[d] === 'STALE' ? h('span', { class: 'st' }, 'GECİKMİŞ') : null)));
        const seg = (n, color) => (n > 0 ? h('span', { style: `width:${pct(n, total)}%;background:${color}` }) : null);
        const fleetEl = total > 0
            ? h('div', { 'data-testid': 'cc-fleet' }, h('div', { class: 'fleet', role: 'img', 'aria-label': `Makine parkı: ${run} çalışıyor, ${idle} boşta, ${down} arızalı, ${maint} bakımda, ${hold} bekletmede` }, seg(run, 'var(--cyan)'), seg(idle, '#475569'), seg(hold, 'var(--amber)'), seg(maint, 'var(--violet)'), seg(down, 'var(--red)')), h('div', { class: 'legend' }, ...[['Çalışıyor', run, 'var(--cyan)'], ['Boşta', idle, '#475569'], ['Bekletmede', hold, 'var(--amber)'], ['Bakımda', maint, 'var(--violet)'], ['Arızalı', down, 'var(--red)']]
                .map(([l, n, col]) => h('span', {}, h('i', { class: 'sw', style: `background:${col}` }), `${l} `, h('b', {}, String(n))))))
            : h('div', { class: 'mut', 'data-testid': 'cc-fleet-unknown' }, 'Makine kaydı yok — UNKNOWN / VERİ GEREKLİ');
        const liveEl = s.liveWorkOrders.length === 0
            ? h('div', { class: 'mut', style: 'margin-top:10px', 'data-testid': 'cc-no-live' }, 'Şu an çalışan iş emri yok.')
            : h('div', { class: 'machines', 'data-testid': 'cc-live' }, ...s.liveWorkOrders.map((w) => {
                const st = w.status === 'IN_PROGRESS' ? (fresh ? 'RUN' : 'STALE') : 'WAIT';
                return h('div', { class: `mc ${st}`, 'data-testid': 'cc-live-row', 'data-status': w.status }, h('div', { class: 'row' }, h('span', { class: 'cnc' }, cncIcon(38)), h('div', {}, h('div', { class: 'code' }, w.machineCode ?? '—'), h('div', { class: 'mut' }, w.productCode ?? '—')), h('span', { class: 'tag' }, w.status)), h('div', { class: 'bar', role: 'img', 'aria-label': `${w.qtyProduced} / ${w.qtyPlanned}` }, h('i', { style: `width:${pct(w.qtyProduced, w.qtyPlanned)}%` })), h('div', { class: 'mut' }, `${w.qtyProduced} / ${w.qtyPlanned} adet · fire ${w.qtyScrap} · ${w.operatorName ?? '—'}`));
            }));
        const actionEl = h('section', { class: 'panel', 'data-testid': 'cc-actions' }, h('h2', {}, ic('bolt', 16), 'Aksiyon gerektiren işler'), others.length ? h('div', { 'data-testid': 'cc-alerts-other' }, ...others.map(alertRow)) : h('div', { class: 'mut' }, 'Bekleyen yüksek/orta öncelikli uyarı yok.'), h('div', { class: 'acts' }, ...ACTION_KEYS.map(([k, tone, icn]) => {
            const n = c[k] ?? 0;
            return h('div', { class: `act ${n > 0 ? `on ${tone}` : ''}`, 'data-testid': 'cc-counter', 'data-key': k }, h('span', { style: 'color:var(--mut)' }, ic(icn, 18)), h('div', {}, h('div', { class: 'num' }, String(n)), h('div', { class: 'lbl' }, COUNTER_LABEL[k])));
        })));
        const oee = s.oeeToday;
        const oeeVal = percentLabel(oee ? oee.oee : null);
        const oeeKnown = !!oee && oee.oee !== null && oee.oee !== undefined;
        const perfEl = h('section', { class: 'panel', 'data-testid': 'cc-performance' }, h('h2', {}, ic('bolt', 16), 'Performans göstergeleri · bugün'), h('div', { class: 'perf', 'data-testid': 'cc-oee' }, h('div', { class: 'gauge', 'data-testid': 'cc-oee-card', 'data-key': 'oee' }, h('div', { class: `g ${oeeKnown ? 'ok' : 'unk'}` }, h('div', { class: 'num' }, oeeVal)), h('div', { class: 'lbl' }, 'OEE')), h('div', {}, h('div', { class: 'sub' }, ...[['availability', 'Kullanılabilirlik'], ['performance', 'Performans'], ['quality', 'Kalite']].map(([k, label]) => h('div', { 'data-testid': 'cc-oee-card', 'data-key': k }, h('div', { class: 'num' }, percentLabel(oee ? oee[k] : null)), h('div', { class: 'lbl' }, label)))), h('div', { class: 'flow' }, ...FLOW_KEYS.map((k) => counter(k, '', COUNTER_LABEL[k]))))));
        body = h('div', { style: 'display:flex;flex-direction:column;gap:14px' }, heroEl, h('div', { class: 'cols' }, h('section', { class: 'panel', 'data-testid': 'cc-health' }, h('h2', {}, ic('PRODUCTION', 16), 'Canlı üretim sağlığı'), pulseEl, stale.length
            ? h('div', { class: 'mut', style: 'margin-top:8px', 'data-testid': 'cc-coverage-note' }, stale.map((d) => `${PULSE_DOMAIN_TR[d]}: ${COVERAGE_REASON_TR[s.coverage?.[d]?.reason ?? 'NO_RECORDS'] ?? ''}`).join(' · '), '. Veri yokken ışık yeşil yanmaz.')
            : null, fleetEl, h('div', { class: 'stats' }, counter('workOrdersRunning', 'stat', 'Çalışan iş emri'), counter('workOrdersWaiting', 'stat', 'Bekleyen iş emri'), counter('machinesEligible', 'stat', 'Üretime uygun'), counter('machinesDown', 'stat', 'Arızalı'), counter('machinesMaintenance', 'stat', 'Bakımda')), liveEl), h('div', { style: 'display:flex;flex-direction:column;gap:14px;min-width:0' }, actionEl, perfEl)));
    }
    const age = snap ? ageLabel(snap.generatedAt) : { text: '', old: false };
    const screen = h('div', { class: 'cc', 'data-testid': 'cc-root' }, h('style', {}, CSS), h('div', { class: 'top' }, h('div', {}, h('h1', {}, 'Komuta Merkezi · PULSE'), h('div', { class: `live${age.old ? ' old' : ''}`, 'data-testid': 'cc-generated' }, snap ? h('i', {}) : null, snap ? `Veri anı: ${snap.generatedAt.slice(0, 19).replace('T', ' ')} · ${age.text}${age.old ? ' — veri güncel olmayabilir' : ''} · canlı KMI verisi` : '')), h('button', { type: 'button', 'data-testid': 'cc-refresh', onClick: refresh }, 'Yenile')), body);
    mount(container, screen);
    if (opts.refreshMs && opts.refreshMs > 0)
        timers.set(container, setTimeout(refresh, opts.refreshMs));
}
