// KMI SIGNATURE — Performance Center (Özet → Departman → İş kaydı).
// KURUTLU MANUFACTURING INTELLIGENCE · Performance Center · Paperless Machining · "Every movement measured. Every decision informed."
// Every figure comes from the view model in packages/domain/src/performanceCenter.ts, which reads only canonical sources
// (command_center, live_board, oee_rollup, next_best_actions, process_mining). No demo data exists in this file: a missing source renders as
// UNKNOWN / VERİ GEREKLİ with its reason. Colour is never the only carrier of meaning (every state also has a word and a glyph).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildPerformanceCenter, departmentSlice, parseDomain, NEEDS_DATA } from '../../../../packages/domain/src/performanceCenter.js';
import { HEADLINE_TR } from '../../../../packages/domain/src/machineState.js';
import { PULSE_DOMAIN_TR, COVERAGE_REASON_TR } from '../../../../packages/domain/src/commandCenter.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { formatStamp } from '../../../../packages/domain/src/temporal.js';
import { loadPerformanceCenter } from '../performanceCenterApi.js';
import { WO_STATUS_TR } from './WorkOrderHubScreen.js';
import { passportHref } from '../passport/registry.js';
export const BRAND_LINE = 'KURUTLU MANUFACTURING INTELLIGENCE';
export const TAGLINE = 'Every movement measured. Every decision informed.';
const CSS = `
.pc{--ink:#070d19;--s1:#0c1527;--s2:#101c33;--hair:#1a2a46;--hair2:#26385a;--tx:#e9eef7;--mu:#8da0bd;--dim:#5f7396;--gold:#c9a24a;--ok:#5fd0a0;--risk:#e8b04a;--crit:#f0645a;--live:#5cc8e6;--unk:#7d8ba3;
  color:var(--tx);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.45;display:flex;flex-direction:column;gap:22px;max-width:1360px;margin:0 auto;padding:4px 0 40px}
.pc *{box-sizing:border-box}.pc a{color:inherit}.pc svg{flex:none}
.pc .eyebrow{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:700}
.pc .lab{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);font-weight:700}
.pc .mu{color:var(--mu);font-size:12.5px}.pc .dim{color:var(--dim);font-size:12px}
.pc .num{font-variant-numeric:tabular-nums;font-weight:650;letter-spacing:-.01em}
/* masthead */
.pc .mast{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px 24px;padding-bottom:16px;border-bottom:1px solid var(--hair);position:relative}
.pc .mast::after{content:'';position:absolute;left:0;bottom:-1px;width:72px;height:2px;background:var(--gold)}
.pc h1{margin:4px 0 2px;font-size:21px;font-weight:600;letter-spacing:.01em}.pc h1 small{font-size:13px;font-weight:500;color:var(--mu);margin-left:8px;letter-spacing:.02em}
.pc .tag{font-size:12.5px;color:var(--mu);font-style:italic}
.pc .stamp{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--mu);flex-wrap:wrap}
.pc .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block}.pc .dot.old{background:var(--risk)}.pc .dot.unk{background:transparent;border:1px dashed var(--unk)}
.pc button.ghost{background:transparent;border:1px solid var(--hair2);color:var(--tx);border-radius:8px;min-height:34px;padding:0 12px;cursor:pointer;font-size:12.5px}
.pc button.ghost:hover{border-color:var(--gold)}
.pc .tabs{display:flex;gap:2px;flex-wrap:wrap;margin-top:-8px}
.pc .tabs a{padding:8px 14px;text-decoration:none;color:var(--mu);font-size:13px;border-bottom:2px solid transparent;min-height:36px;display:inline-flex;align-items:center}
.pc .tabs a[aria-current=page]{color:var(--tx);border-color:var(--gold)}.pc .tabs a:hover{color:var(--tx)}
.pc .crumb{font-size:12.5px;color:var(--mu)}.pc .crumb a{color:var(--live);text-decoration:none}
/* verdict + ledger */
.pc .verdict{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.pc .vline{display:flex;gap:12px;align-items:flex-start;padding:2px 0 2px 14px;border-left:3px solid var(--unk);font-size:15.5px;font-weight:550}
.pc .vline.critical{border-color:var(--crit)}.pc .vline.risk{border-color:var(--risk)}.pc .vline.normal{border-color:var(--ok)}.pc .vline.unknown{border-color:var(--unk)}
.pc .ledger{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}
.pc .ledger>div{padding:12px 16px;border-left:1px solid var(--hair)}.pc .ledger>div:first-child{border-left:0;padding-left:0}
.pc .ledger .num{font-size:22px;display:block;margin-top:2px}.pc .ledger .num.u{font-size:13px;color:var(--unk);font-weight:600;letter-spacing:.02em}
/* layout */
.pc .grid2{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:28px;align-items:start}
.pc .grid3{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;align-items:start}
.pc section.blk{min-width:0}
.pc section.blk>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--hair)}
.pc section.blk>header h2{margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--tx);font-weight:700}
.pc .unknownbox{border:1px dashed var(--hair2);border-radius:10px;padding:12px 14px;color:var(--mu);font-size:13px}.pc .unknownbox b{color:var(--unk);letter-spacing:.06em}
/* machine park */
.pc .cls{margin-bottom:16px}.pc .cls .lab{display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap}.pc .cls .lab span{color:var(--dim);letter-spacing:.06em;text-transform:none;font-weight:500}
.pc .park{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.pc .mt{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;padding:10px;border:1px solid var(--hair);border-radius:12px;background:linear-gradient(180deg,var(--s2),var(--s1));text-decoration:none;min-height:64px}
.pc .mt:hover{border-color:var(--hair2)}
.pc .mt .ico{position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--mu)}
.pc .mt .ico .ring{position:absolute;inset:0;border-radius:50%;border:2px solid var(--unk)}
.pc .mt.ACTIVE_WORK_ORDER .ring{border-color:var(--live)}.pc .mt.FIRST_PIECE .ring{border-color:var(--gold)}.pc .mt.READY_IDLE .ring{border-color:var(--ok)}
.pc .mt.HOLD .ring,.pc .mt.MAINTENANCE .ring{border-color:var(--risk)}.pc .mt.DOWN .ring{border-color:var(--crit)}.pc .mt.UNKNOWN .ring{border-style:dashed}
.pc .mt.ACTIVE_WORK_ORDER .ico{color:var(--live)}.pc .mt.DOWN .ico{color:var(--crit)}
.pc .mt.fresh.ACTIVE_WORK_ORDER .spin{transform-origin:9.5px 11.2px;animation:pcSpin 1.8s linear infinite}
.pc .mt b{font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pc .mt .st{display:block;white-space:nowrap;font-size:10.5px;letter-spacing:.08em;font-weight:700;color:var(--mu)}
.pc .mt.DOWN .st{color:var(--crit)}.pc .mt.HOLD .st,.pc .mt.MAINTENANCE .st{color:var(--risk)}.pc .mt.ACTIVE_WORK_ORDER .st{color:var(--live)}
.pc .mt .sub{font-size:11.5px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc .legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--mu);margin-top:6px}.pc .legend i{display:inline-block;width:9px;height:9px;border-radius:50%;border:2px solid;margin-right:6px;vertical-align:-1px}
/* risks */
.pc .risk{padding:10px 0 10px 12px;border-left:3px solid var(--hair2);border-bottom:1px solid var(--hair);margin-left:0}
.pc .risk.CRITICAL{border-left-color:var(--crit)}.pc .risk.HIGH{border-left-color:var(--risk)}.pc .risk.MEDIUM{border-left-color:var(--unk)}.pc .risk.ADVISORY{border-left-color:var(--live)}
.pc .risk .t{font-weight:600;font-size:13.5px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.pc .sev{font-size:10px;letter-spacing:.12em;font-weight:800;color:var(--mu)}
.pc .risk.CRITICAL .sev{color:var(--crit)}.pc .risk.HIGH .sev{color:var(--risk)}.pc .risk.ADVISORY .sev{color:var(--live)}
.pc details.why{margin-top:4px}.pc details.why summary{cursor:pointer;color:var(--mu);font-size:12px;min-height:24px}.pc details.why div{color:var(--mu);font-size:12px;padding:4px 0}
.pc .risk a.go{color:var(--live);font-size:12px;text-decoration:none}
/* charts + bars */
.pc .bar{height:5px;border-radius:3px;background:var(--hair);overflow:hidden}.pc .bar i{display:block;height:100%;background:var(--live)}
.pc .apq{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}.pc .apq>div{min-width:0}.pc .apq .num{overflow-wrap:anywhere;display:block;margin-top:2px}.pc .apq .num{font-size:19px}.pc .apq .num.u{font-size:12px;color:var(--unk)}
.pc .stack{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--hair);margin:6px 0}.pc .stack i{display:block;height:100%}
.pc .lossrow{display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:8px;font-size:12.5px;align-items:center;padding:2px 0}.pc .lossrow i{width:9px;height:9px;border-radius:2px}
.pc svg.chart text{fill:var(--mu);font-size:10px;font-family:inherit}
/* rows */
.pc .rows>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:9px 0;border-bottom:1px solid var(--hair);align-items:center}
.pc .rows .sub{grid-column:1/-1}
.pc .chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--mu)}.pc .chip.red{color:var(--crit)}.pc .chip.amber{color:var(--risk)}.pc .chip.green{color:var(--ok)}.pc .chip.blue{color:var(--live)}
.pc .flow{display:flex;gap:0;margin-bottom:12px;flex-wrap:wrap}.pc .flow>div{flex:1 1 90px;padding:6px 12px;border-left:1px solid var(--hair)}.pc .flow>div:first-child{border-left:0;padding-left:0}.pc .flow .num{font-size:20px;display:block}
.pc .dept{display:grid;grid-template-columns:30px minmax(0,1.3fr) repeat(3,minmax(0,.8fr)) auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--hair);text-decoration:none}
.pc .dept:hover{background:rgba(255,255,255,.02)}.pc .lamp{width:22px;height:22px;border-radius:50%;border:2px solid var(--unk);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--unk)}
.pc .lamp.GREEN{border-color:var(--ok);color:var(--ok)}.pc .lamp.AMBER{border-color:var(--risk);color:var(--risk)}.pc .lamp.RED{border-color:var(--crit);color:var(--crit)}.pc .lamp.STALE{border-color:var(--gold);color:var(--gold)}.pc .lamp.UNKNOWN{border-style:dashed}
.pc .unkledger summary{cursor:pointer;color:var(--mu);min-height:32px}.pc .unkledger li{color:var(--mu);font-size:12.5px;margin:4px 0}
@keyframes pcSpin{to{transform:rotate(360deg)}}
@media (max-width:1100px){.pc .grid2,.pc .grid3{grid-template-columns:minmax(0,1fr)}}
@media (max-width:700px){.pc{gap:18px}.pc .dept{grid-template-columns:26px minmax(0,1fr) auto}.pc .dept .hide-s{display:none}.pc .ledger>div{padding:10px 12px}.pc .apq{grid-template-columns:repeat(2,minmax(0,1fr))}.pc h1{font-size:19px}}
@media (prefers-reduced-motion:reduce){.pc *{animation:none!important}}
`;
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LAMP_GLYPH = { GREEN: '✓', AMBER: '!', RED: '✕', UNKNOWN: '?', STALE: '◷' };
const LAMP_TR = { GREEN: 'NORMAL', AMBER: 'RİSK', RED: 'KRİTİK', UNKNOWN: 'VERİ YOK', STALE: 'GECİKMİŞ' };
const SEV_TR = { CRITICAL: 'KRİTİK', HIGH: 'YÜKSEK', MEDIUM: 'ORTA', ADVISORY: 'ÖNERİ' };
const CLS_TONE = { DOWN: 'var(--crit)', MAINTENANCE: 'var(--risk)', HOLD: 'var(--risk)', ACTIVE_WORK_ORDER: 'var(--live)', FIRST_PIECE: 'var(--gold)', READY_IDLE: 'var(--ok)', UNKNOWN: 'var(--unk)' };
const LOSS_COLORS = ['#5cc8e6', '#c9a24a', '#f0645a', '#e8b04a', '#a98bf0', '#7d8ba3'];
const timers = new WeakMap();
const svgEl = (markup, label, cls = 'chart') => { const d = document.createElement('span'); d.style.display = 'block'; d.innerHTML = markup.replace('<svg ', `<svg class="${cls}" role="img" aria-label="${esc(label)}" `); return d; };
const iconEl = (inner, size = 22, sw = 1.5) => { const d = document.createElement('span'); d.style.display = 'inline-flex'; d.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`; return d; };
/** CNC machining centre: cabinet, door window, spindle head (the .spin group turns only for a verified running work order). */
const CNC = '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 17h19"/><rect x="5" y="6.5" width="9" height="8" rx="1"/><g class="spin"><path d="M9.5 9v2.2"/><path d="M8.2 11.2h2.6"/><path d="M9.5 11.2v2.6"/></g><path d="M17 7.5h2M17 10h2"/><circle cx="18" cy="14" r="0.6"/>';
const CLS_ICON = {
    MACHINING: CNC,
    MEASUREMENT: '<path d="M3 20h18M5 20V8M19 20V8M5 8h14"/><path d="M12 8v6"/><circle cx="12" cy="16" r="1.6"/>',
    MATERIAL_HANDLING: '<path d="M4 20V6h3l2 6v8"/><path d="M9 12h6v8H9"/><path d="M15 4v14M15 4h3"/><circle cx="7" cy="20" r="1.4"/><circle cx="13" cy="20" r="1.4"/>',
    AUXILIARY: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    UNCLASSIFIED: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M8 10h8M8 14h5"/>',
};
const unknownBox = (title, reason, testid) => h('div', { class: 'unknownbox', 'data-testid': testid }, h('b', {}, `${title}: UNKNOWN / ${NEEDS_DATA}`), h('div', {}, reason));
const block = (title, testid, ...kids) => h('section', { class: 'blk', 'data-testid': testid }, h('header', {}, h('h2', {}, title)), ...kids);
const fmtDay = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : d);
// ---------------- sections ----------------
function ledger(m) {
    const running = m.fleet.state === 'KNOWN' ? `${m.fleet.value.counts.ACTIVE_WORK_ORDER}/${m.fleet.value.total}` : null;
    const crit = m.risks.filter((r) => r.severity === 'CRITICAL').length;
    const late = m.orders.state === 'KNOWN' ? m.orders.value.late : null;
    const oee = m.oee.state === 'KNOWN' ? m.oee.value.oee : null;
    const cell = (label, val, testid, hint) => h('div', { 'data-testid': testid }, h('span', { class: 'lab' }, label), val === null ? h('span', { class: 'num u', title: hint }, `UNKNOWN / ${NEEDS_DATA}`) : h('span', { class: 'num' }, val));
    return h('div', { class: 'ledger', 'data-testid': 'pc-ledger' }, cell('Aktif iş emri olan makine', running, 'pc-k-running', 'live_board okunamadı'), cell('Kritik uyarı', m.workOrders.state === 'KNOWN' || m.risks.length ? String(crit) : null, 'pc-k-critical', 'command_center okunamadı'), cell('Termini geçen kalem', late === null ? null : String(late), 'pc-k-late', 'live_board okunamadı'), cell('OEE · bugün', oee === null ? null : percentLabel(oee), 'pc-k-oee', 'OEE hesaplanamadı'));
}
function machinePark(m) {
    const f = m.fleet;
    if (f.state === 'UNKNOWN')
        return block('Makine parkı', 'pc-fleet', unknownBox('Makine parkı', f.reason, 'pc-fleet-unknown'));
    const fresh = m.fresh === true;
    const groups = f.value.groups.map((g) => h('div', { class: 'cls', 'data-class': g.klass }, h('div', { class: 'lab' }, `${g.label} · ${g.tiles.length}`, ...Object.entries(g.counts).filter(([, n]) => n > 0).map(([k, n]) => h('span', {}, `${HEADLINE_TR[k]} ${n}`))), h('div', { class: 'park' }, ...g.tiles.map((t) => {
        const kpi = m.machines.find((x) => x.code === t.code);
        return h('a', { class: `mt ${t.headline}${fresh ? ' fresh' : ''}`, href: t.id ? passportHref('MACHINE', t.id) : '#/canli', 'data-testid': 'pc-machine', 'data-code': t.code, 'data-headline': t.headline, 'aria-label': `Makine ${t.code}: ${HEADLINE_TR[t.headline]}` }, h('span', { class: 'ico' }, h('span', { class: 'ring' }), iconEl(CLS_ICON[t.klass] ?? CLS_ICON.UNCLASSIFIED, 24)), h('div', { style: 'min-width:0' }, h('b', {}, t.code), h('span', { class: 'st' }, HEADLINE_TR[t.headline]), h('span', { class: 'sub', style: 'display:block' }, t.activeWo ? `İE ${t.activeWo}` : '—', kpi && kpi.good !== null ? ` · vardiya ${kpi.good}/${kpi.scrap ?? '?'}` : '')));
    }))));
    const L = (c, t) => h('span', {}, h('i', { style: `color:${c}` }), t);
    return block('Makine parkı', 'pc-fleet', ...groups, h('div', { class: 'legend', 'data-testid': 'pc-fleet-legend' }, ...['ACTIVE_WORK_ORDER', 'FIRST_PIECE', 'READY_IDLE', 'HOLD', 'MAINTENANCE', 'DOWN', 'UNKNOWN'].map((k) => L(CLS_TONE[k], `${HEADLINE_TR[k]} ${f.value.counts[k]}`))), h('div', { class: 'dim', style: 'margin-top:8px', 'data-testid': 'pc-physical-note' }, f.value.physicalNote + (f.value.missingFromRegistry.length ? ` · canlı panoda olmayan kayıtlı makine: ${f.value.missingFromRegistry.join(', ')}` : '')));
}
function riskList(risks, limit = 6, testid = 'pc-risks') {
    const shown = risks.slice(0, limit);
    return block('Riskler ve önerilen aksiyonlar', testid, shown.length ? h('div', {}, ...shown.map((r) => h('div', { class: `risk ${r.severity}`, 'data-testid': 'pc-risk', 'data-severity': r.severity, 'data-kind': r.kind }, h('div', { class: 't' }, h('span', { class: 'sev' }, SEV_TR[r.severity]), r.title), h('details', { class: 'why' }, h('summary', {}, 'Neden? Kanıt ve kaynak'), h('div', { 'data-testid': 'pc-risk-why' }, r.why), h('div', { class: 'dim' }, r.evidence)), r.href ? h('a', { class: 'go', href: r.href, 'data-testid': 'pc-risk-link' }, 'Kayda git →') : null)), risks.length > limit ? h('div', { class: 'mu', style: 'padding-top:8px' }, `+${risks.length - limit} daha`) : null)
        : h('div', { class: 'mu', 'data-testid': 'pc-no-risk' }, 'Kayıtlara göre açık uyarı veya kural tabanlı öneri yok. (Boş liste "her şey yolunda" demek değildir; yalnız kuralların tetiklenmediğini gösterir.)'));
}
function shiftBlock(m) {
    const s = m.shift;
    if (s.state === 'UNKNOWN')
        return block('Vardiya performansı', 'pc-shift', unknownBox('Vardiya', s.reason, 'pc-shift-unknown'));
    const days = [...s.value.days].slice(0, 5).reverse();
    if (!days.length)
        return block('Vardiya performansı', 'pc-shift', unknownBox('Vardiya', 'Bildirilmiş üretim kaydı yok', 'pc-shift-unknown'));
    const max = Math.max(1, ...days.flatMap((d) => Object.values(d.shifts).map((v) => (v ? v.good + v.scrap : 0))));
    const W = 360, H = 130, bw = 16, gap = (W - 20) / days.length;
    const bars = days.map((d, i) => {
        const x0 = 14 + i * gap;
        const one = (k, dx, col) => {
            const v = d.shifts[k];
            if (!v)
                return `<rect x="${x0 + dx}" y="${H - 22}" width="${bw}" height="1.5" fill="none" stroke="#5f7396" stroke-dasharray="2 2"/>`;
            const gh = (v.good / max) * (H - 40), sh = (v.scrap / max) * (H - 40);
            return `<rect x="${x0 + dx}" y="${H - 22 - gh}" width="${bw}" height="${gh}" rx="2" fill="${col}"/><rect x="${x0 + dx}" y="${H - 22 - gh - sh}" width="${bw}" height="${sh}" rx="2" fill="#f0645a"/>`;
        };
        return `${one('TeamK1', 0, '#5cc8e6')}${one('TeamK2', bw + 3, '#c9a24a')}<text x="${x0 + bw}" y="${H - 8}" text-anchor="middle">${esc(fmtDay(d.day))}</text>`;
    }).join('');
    const cmp = s.value.compare;
    return block('Vardiya performansı', 'pc-shift', h('div', { class: 'mu', style: 'margin-bottom:6px' }, `Mevcut vardiya: ${s.value.label ?? 'bilinmiyor'} · bildirilen iyi adet, hurda kırmızı`), svgEl(`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${bars}</svg>`, `Son ${days.length} gün vardiya bazında iyi ve hurda adet`), h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'color:#5cc8e6' }), 'Vardiya 1 (08–16)'), h('span', {}, h('i', { style: 'color:#c9a24a' }), 'Vardiya 2 (16–24)'), h('span', {}, h('i', { style: 'color:#f0645a' }), 'Hurda'), h('span', {}, h('i', { style: 'color:#5f7396;border-style:dashed' }), 'Kayıt yok')), h('div', { style: 'margin-top:10px', 'data-testid': 'pc-shift-compare' }, cmp ? h('span', {}, `Bugün ${s.value.today?.good ?? 0} adet; ${fmtDay(cmp.prevDay)} ile fark `, h('b', { class: 'num' }, `${cmp.deltaGood >= 0 ? '+' : ''}${cmp.deltaGood}`), cmp.pct === null ? '' : ` (%${cmp.pct})`)
        : h('span', { class: 'mu' }, `Karşılaştırma için bugün ve bir önceki gün kaydı gerekli — ${NEEDS_DATA}`)), h('div', { class: 'dim' }, 'Gece vardiyası (00–08) tanımsız; verisi gösterilmez.'));
}
function oeeBlock(m) {
    const kids = [];
    if (m.oee.state === 'UNKNOWN')
        kids.push(unknownBox('OEE', m.oee.reason, 'pc-oee-unknown'));
    else {
        const o = m.oee.value;
        const v = (x) => (x === null ? h('span', { class: 'num u' }, `UNKNOWN / ${NEEDS_DATA}`) : h('span', { class: 'num' }, percentLabel(x)));
        kids.push(h('div', { class: 'apq', 'data-testid': 'pc-oee' }, h('div', { 'data-testid': 'pc-oee-main' }, h('span', { class: 'lab' }, 'OEE'), v(o.oee)), h('div', { 'data-key': 'availability' }, h('span', { class: 'lab' }, 'Kullanılabilirlik'), v(o.availability)), h('div', { 'data-key': 'performance' }, h('span', { class: 'lab' }, 'Performans'), v(o.performance)), h('div', { 'data-key': 'quality' }, h('span', { class: 'lab' }, 'Kalite'), v(o.quality))));
        if (o.oee === null)
            kids.push(h('div', { class: 'mu', 'data-testid': 'pc-oee-missing' }, `Eksik girdi: ${o.missing.length ? o.missing.join(', ') : 'planlı süre / çalışma süresi / ideal çevrim / adet'} — OEE bu girdiler olmadan hesaplanmaz.`));
    }
    // loss analysis
    kids.push(h('div', { class: 'lab', style: 'margin:14px 0 4px' }, 'Kayıp analizi · son 7 gün'));
    if (m.losses.state === 'UNKNOWN')
        kids.push(unknownBox('Kayıp analizi', m.losses.reason, 'pc-loss-unknown'));
    else
        kids.push(h('div', { 'data-testid': 'pc-losses' }, h('div', { class: 'stack', role: 'img', 'aria-label': 'Kayıp süresi dağılımı' }, ...m.losses.value.items.map((it, i) => h('i', { style: `width:${(it.share * 100).toFixed(2)}%;background:${LOSS_COLORS[i % LOSS_COLORS.length]}` }))), ...m.losses.value.items.map((it, i) => h('div', { class: 'lossrow', 'data-key': it.key }, h('i', { style: `background:${LOSS_COLORS[i % LOSS_COLORS.length]}` }), it.label, h('span', { class: 'num' }, `${Math.round(it.minutes)} dk · %${Math.round(it.share * 100)}`)))));
    // trend
    kids.push(h('div', { class: 'lab', style: 'margin:14px 0 4px' }, 'OEE eğilimi · günlük'));
    if (m.trend.state === 'UNKNOWN')
        kids.push(unknownBox('Eğilim', m.trend.reason, 'pc-trend-unknown'));
    else {
        const pts = m.trend.value, W = 360, H = 90, n = pts.length;
        const x = (i) => 16 + (n === 1 ? (W - 32) / 2 : (i * (W - 32)) / (n - 1)), y = (v) => H - 22 - Math.max(0, Math.min(1, v)) * (H - 36);
        let path = '', pen = false;
        pts.forEach((p, i) => { if (p.oee === null) {
            pen = false;
            return;
        } path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.oee).toFixed(1)} `; pen = true; });
        const dots = pts.map((p, i) => (p.oee === null ? `<circle cx="${x(i)}" cy="${H - 22}" r="3" fill="none" stroke="#7d8ba3" stroke-dasharray="2 2"/>` : `<circle cx="${x(i)}" cy="${y(p.oee)}" r="3" fill="#5cc8e6"/>`)).join('');
        const labels = pts.map((p, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(fmtDay(p.day))}</text>`).join('');
        kids.push(svgEl(`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}"><line x1="16" x2="${W - 16}" y1="${H - 22}" y2="${H - 22}" stroke="#1a2a46"/><path d="${path}" fill="none" stroke="#5cc8e6" stroke-width="1.6"/>${dots}${labels}</svg>`, 'Günlük OEE eğilimi; boş daire hesaplanamayan gün'), h('div', { class: 'dim', 'data-testid': 'pc-trend-note' }, pts.every((p) => p.oee === null) ? `Hiçbir günde hesaplanabilir OEE yok — ${NEEDS_DATA}` : 'Boş daire: o gün OEE hesaplanamadı.'));
    }
    return block('OEE ve kayıp', 'pc-oee-block', ...kids);
}
function woBlock(m) {
    const w = m.workOrders;
    const kids = [];
    if (w.state === 'UNKNOWN')
        kids.push(unknownBox('İş emirleri', w.reason, 'pc-wo-unknown'));
    else {
        kids.push(h('div', { class: 'flow', 'data-testid': 'pc-wo-flow' }, h('div', {}, h('span', { class: 'lab' }, 'Bekleyen'), h('span', { class: 'num' }, String(w.value.waiting))), h('div', {}, h('span', { class: 'lab' }, 'Çalışan'), h('span', { class: 'num' }, String(w.value.running))), h('div', {}, h('span', { class: 'lab' }, 'Duran'), h('span', { class: 'num' }, String(w.value.onHold)))));
        kids.push(w.value.live.length ? h('div', { class: 'rows', 'data-testid': 'pc-wo-live' }, ...w.value.live.map((x) => h('a', { href: passportHref('WORK_ORDER', x.id), style: 'text-decoration:none;display:block' }, h('div', { 'data-testid': 'pc-wo-row', 'data-status': x.status }, h('span', {}, `${x.machine ?? '—'} · ${x.product ?? '—'}`), h('span', { class: 'chip blue' }, WO_STATUS_TR[x.status] ?? x.status), h('div', { class: 'sub' }, h('div', { class: 'bar' }, h('i', { style: `width:${x.pct === null ? 0 : Math.min(100, x.pct)}%` })), h('span', { class: 'dim' }, `${x.produced}/${x.planned} adet${x.pct === null ? ' · plan bilinmiyor' : ` · %${x.pct}`} · fire ${x.scrap}${x.operator ? ` · ${x.operator}` : ''}`)))))) : h('div', { class: 'mu', 'data-testid': 'pc-no-live' }, 'Şu an çalışan iş emri yok.'));
    }
    kids.push(h('div', { class: 'lab', style: 'margin:14px 0 4px' }, 'Darboğazlar'));
    kids.push(m.bottlenecks.length ? h('div', { class: 'rows', 'data-testid': 'pc-bottlenecks' }, ...m.bottlenecks.map((b) => h('div', { 'data-testid': 'pc-bottleneck', 'data-kind': b.kind }, h('span', {}, b.title), b.href ? h('a', { href: b.href, class: 'chip blue' }, 'Kayda git →') : null, h('div', { class: 'sub dim' }, b.evidence))))
        : h('div', { class: 'mu', 'data-testid': 'pc-no-bottleneck' }, 'Kurallara göre (engelli makinede iş, 60 dk üstü ilk parça beklemesi, süreç madenciliği) darboğaz tespit edilmedi. Veri yetersizse bu bir "sorun yok" kanıtı değildir.'));
    return block('İş emirleri ve darboğazlar', 'pc-wo', ...kids);
}
function ordersBlock(m) {
    const o = m.orders;
    if (o.state === 'UNKNOWN')
        return block('Sipariş ve termin riski', 'pc-orders', unknownBox('Siparişler', o.reason, 'pc-orders-unknown'));
    const { late, dueSoon, onTrack, worst } = o.value;
    const tot = late + dueSoon + onTrack;
    const seg = (n, c) => (n > 0 ? h('i', { style: `width:${(n / tot) * 100}%;background:${c}` }) : null);
    return block('Sipariş ve termin riski', 'pc-orders', tot === 0 ? h('div', { class: 'mu', 'data-testid': 'pc-orders-empty' }, 'Açık sipariş kalemi yok.') : h('div', {}, h('div', { class: 'stack', role: 'img', 'aria-label': `${late} geciken, ${dueSoon} yaklaşan, ${onTrack} zamanında` }, seg(late, 'var(--crit)'), seg(dueSoon, 'var(--risk)'), seg(onTrack, 'var(--ok)')), h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'color:var(--crit)' }), `Geciken ${late}`), h('span', {}, h('i', { style: 'color:var(--risk)' }), `2 gün içinde ${dueSoon}`), h('span', {}, h('i', { style: 'color:var(--ok)' }), `Zamanında ${onTrack}`))), worst.length ? h('div', { class: 'rows', style: 'margin-top:8px', 'data-testid': 'pc-orders-worst' }, ...worst.map((x) => h('div', { 'data-state': x.state }, h('span', {}, `${x.product ?? '—'} · termin ${x.dueDate}`), h('span', { class: `chip ${x.state === 'LATE' ? 'red' : 'amber'}` }, x.state === 'LATE' ? 'GECİKMİŞ' : 'YAKLAŞIYOR'), h('div', { class: 'sub dim' }, `Sevk edilmemiş ${x.open} adet`)))) : null);
}
function qualityBlock(m) {
    const q = m.quality;
    if (q.state === 'UNKNOWN')
        return block('Kalite · HOLD · İlk parça', 'pc-quality', unknownBox('Kalite', q.reason, 'pc-quality-unknown'));
    const cell = (l, n, tone, k) => h('div', { 'data-key': k }, h('span', { class: 'lab' }, l), h('span', { class: 'num', style: n > 0 ? `color:var(--${tone})` : '' }, String(n)));
    return block('Kalite · HOLD · İlk parça', 'pc-quality', h('div', { class: 'flow' }, cell('Açık HOLD', q.value.holds, 'crit', 'holds'), cell('Açık NCR', q.value.ncr, 'risk', 'ncr'), cell('İlk parça bekleyen', q.value.firstPiecePending, 'risk', 'firstPiece'), cell('Giriş kalite', q.value.incomingQc, 'risk', 'incoming')), h('a', { class: 'chip blue', href: '#/kalite' }, 'Kalite çalışma alanı →'));
}
function maintBlock(m) {
    const q = m.maintenance;
    if (q.state === 'UNKNOWN')
        return block('Bakım · arıza', 'pc-maint', unknownBox('Bakım', q.reason, 'pc-maint-unknown'));
    return block('Bakım · arıza', 'pc-maint', h('div', { class: 'flow' }, h('div', {}, h('span', { class: 'lab' }, 'Arızalı'), h('span', { class: 'num', style: q.value.down ? 'color:var(--crit)' : '' }, String(q.value.down))), h('div', {}, h('span', { class: 'lab' }, 'Bakımda'), h('span', { class: 'num', style: q.value.inMaintenance ? 'color:var(--risk)' : '' }, String(q.value.inMaintenance))), h('div', {}, h('span', { class: 'lab' }, 'Açık bakım kaydı'), h('span', { class: 'num' }, String(q.value.openRequests)))), q.value.machines.length ? h('div', { class: 'dim' }, q.value.machines.map((x) => `${x.code} (${HEADLINE_TR[x.headline]}${x.openMaintenance ? `, ${x.openMaintenance} açık kayıt` : ''})`).join(' · ')) : null, h('a', { class: 'chip blue', href: '#/bakim' }, 'Bakım çalışma alanı →'));
}
function departmentsBlock(m) {
    return block('Bölüm performansı', 'pc-departments', h('div', { 'data-testid': 'pc-dept-list' }, ...m.departments.map((d) => h('a', { class: 'dept', href: d.drill, 'data-testid': 'pc-dept', 'data-domain': d.domain, 'data-light': d.light, 'aria-label': `${d.label}: ${LAMP_TR[d.light]}` }, h('span', { class: `lamp ${d.light}`, 'aria-hidden': 'true' }, LAMP_GLYPH[d.light]), h('div', {}, h('b', {}, d.label), h('div', { class: 'dim' }, d.workspace)), h('div', { class: 'hide-s' }, h('span', { class: 'lab' }, 'Durum'), h('div', {}, LAMP_TR[d.light])), h('div', { class: 'hide-s' }, h('span', { class: 'lab' }, 'Kayıt'), h('div', { class: 'num' }, String(d.records))), h('div', { class: 'hide-s' }, h('span', { class: 'lab' }, 'Uyarı'), h('div', { class: 'num', style: d.critical ? 'color:var(--crit)' : '' }, d.alerts ? `${d.alerts}${d.critical ? ` (${d.critical} kritik)` : ''}` : '0')), h('span', { class: 'chip blue' }, 'Aç →')))), h('div', { class: 'dim', style: 'margin-top:6px' }, 'Işık, o bölümün kayıtlı verisinden hesaplanır; kayıt yoksa "VERİ YOK" gösterilir ve yeşil yanmaz.'));
}
function unknownsLedger(m) {
    return h('details', { class: 'unkledger', 'data-testid': 'pc-unknowns' }, h('summary', {}, `UNKNOWN / ${NEEDS_DATA} dökümü (${m.unknowns.length})`), h('ul', {}, ...m.unknowns.map((u) => h('li', { 'data-key': u.key }, h('b', {}, u.label), ` — ${u.reason}`))));
}
function mast(m, onRefresh, crumb) {
    const age = m.generatedAt ? Math.max(0, Math.round((Date.now() - Date.parse(m.generatedAt)) / 60000)) : null;
    return h('div', {}, h('header', { class: 'mast', 'data-testid': 'pc-mast' }, h('div', {}, h('div', { class: 'eyebrow', 'data-testid': 'pc-brand' }, BRAND_LINE), h('h1', {}, 'Performance Center', h('small', {}, 'Paperless Machining')), h('div', { class: 'tag', 'data-testid': 'pc-tagline' }, TAGLINE), crumb), h('div', { class: 'stamp', 'data-testid': 'pc-stamp' }, h('span', { class: `dot${m.generatedAt === null ? ' unk' : m.fresh ? '' : ' old'}`, 'aria-hidden': 'true' }), m.generatedAt ? `Veri anı ${formatStamp(m.generatedAt)}${age !== null ? ` · ${age < 1 ? 'az önce' : `${age} dk önce`}` : ''}${m.fresh ? '' : ' — güncel olmayabilir'}` : 'Veri anı bilinmiyor', h('button', { type: 'button', class: 'ghost', 'data-testid': 'pc-refresh', onClick: onRefresh }, 'Yenile'))), h('nav', { class: 'tabs', 'aria-label': 'Performance Center bölümleri', 'data-testid': 'pc-tabs' }, h('a', { href: '#/komuta', 'aria-current': 'page' }, 'Özet'), h('a', { href: '#/canli' }, 'KMI LIVE'), h('a', { href: '#/oee' }, 'Eğilim · OEE'), h('a', { href: '#/yonetim' }, 'Kararlar')));
}
// ---------------- screens ----------------
function overview(m) {
    return [
        h('div', { class: 'verdict', 'data-testid': 'pc-verdict' }, h('div', { class: `vline ${m.verdict.tone}`, 'data-tone': m.verdict.tone }, m.verdict.text), ledger(m)),
        h('div', { class: 'grid2' }, machinePark(m), riskList(m.risks)),
        h('div', { class: 'grid3' }, shiftBlock(m), oeeBlock(m)),
        h('div', { class: 'grid3' }, woBlock(m), ordersBlock(m)),
        h('div', { class: 'grid3' }, qualityBlock(m), maintBlock(m)),
        departmentsBlock(m), unknownsLedger(m),
    ];
}
function departmentView(m, domain) {
    const sl = departmentSlice(m, domain);
    const d = sl.department;
    const slicePanels = {
        PRODUCTION: [woBlock(m), shiftBlock(m)], QUALITY: [qualityBlock(m)], MAINTENANCE: [maintBlock(m), machinePark(m)], SHIPMENT: [ordersBlock(m)],
        MATERIAL: [], PURCHASING: [],
    };
    return [
        h('div', { class: 'verdict', 'data-testid': 'pc-dept-head', 'data-domain': domain }, h('div', { class: `vline ${d.light === 'RED' ? 'critical' : d.light === 'AMBER' ? 'risk' : d.light === 'GREEN' ? 'normal' : 'unknown'}` }, `${d.label}: ${LAMP_TR[d.light]} — ${d.records} kayıt · ${d.alerts} uyarı`), d.reason ? h('div', { class: 'mu', 'data-testid': 'pc-dept-reason' }, COVERAGE_REASON_TR[d.reason] ?? d.reason) : null, d.lastEventAt ? h('div', { class: 'dim' }, `Son kayıt: ${formatStamp(d.lastEventAt)}`) : h('div', { class: 'dim' }, 'Son kayıt zamanı yok')),
        riskList(sl.risks, 20, 'pc-dept-risks'),
        ...(slicePanels[domain] ?? []),
        ...(!slicePanels[domain]?.length ? [block('Bu bölümün ayrıntısı', 'pc-dept-more', h('div', { class: 'mu' }, `${d.label} için bu merkezde yalnız ışık ve uyarılar gösterilir; ayrıntı çalışma alanında.`))] : []),
        h('a', { class: 'chip blue', href: sl.workspaceHref, 'data-testid': 'pc-dept-open' }, `${d.workspace} çalışma alanını aç →`),
        unknownsLedger(m),
    ];
}
export async function renderPerformanceCenter(container, sources, opts) {
    const prev = timers.get(container);
    if (prev)
        clearTimeout(prev);
    const nowIso = opts.nowIso ?? new Date().toISOString();
    const range = opts.sourcesRange ?? { from: shiftDate(opts.today, -6), to: opts.today, monthFrom: shiftDate(opts.today, -29) };
    const inputs = await loadPerformanceCenter(sources, range, nowIso);
    const model = buildPerformanceCenter(inputs);
    const refresh = () => void renderPerformanceCenter(container, sources, opts);
    const domain = parseDomain(opts.dept ?? null);
    const crumb = domain ? h('div', { class: 'crumb', 'data-testid': 'pc-crumb' }, h('a', { href: '#/komuta' }, 'Özet'), ` › ${PULSE_DOMAIN_TR[domain]} › kayıtlar`) : null;
    mount(container, h('div', { class: 'pc', 'data-testid': 'pc-root', 'data-level': domain ? 'department' : 'overview' }, h('style', {}, CSS), mast(model, refresh, crumb), ...(domain ? departmentView(model, domain) : overview(model))));
    if (opts.refreshMs && opts.refreshMs > 0)
        timers.set(container, setTimeout(refresh, opts.refreshMs));
}
const shiftDate = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
