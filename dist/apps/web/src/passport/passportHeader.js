// KMI SIGNATURE — Object Passport header (KMI-001 final revision): ONE visual system for every passport kind (machine, work order, product,
// customer, tool, order, lot …). Shared design language, object-specific content: vector emblem (never a fake photo), big main state, KPI tiles,
// related-object chips and the Card → Passport → Event history → Related objects flow. It only renders what the adapter returned.
import { h } from '../../../../packages/ui/src/h.js';
import { formatStamp } from '../../../../packages/domain/src/temporal.js';
import { spindleIcon, visualFor } from '../spindle.js';
import { KINDS, passportHref } from './registry.js';
const GLYPH = {
    WORK_ORDER: '<rect x="8" y="6" width="24" height="28" rx="3"/><path d="M13 14h14M13 20h14M13 26h8"/><circle cx="29" cy="29" r="5" fill="#0b1220"/><path d="M29 26.4v5.2M26.4 29h5.2"/>',
    PRODUCT: '<path d="M20 5l13 7v16l-13 7-13-7V12z"/><path d="M7 12l13 7 13-7M20 19v16"/>',
    CUSTOMER: '<path d="M7 33V15l9-5v23M16 33V8l17 6v19"/><path d="M11 20h2M11 25h2M21 15h2M21 20h2M21 25h2M27 18h2M27 23h2"/><path d="M5 33h30"/>',
    TOOL: '<path d="M15 5h10v9l-2 4v14a3 3 0 0 1-6 0V18l-2-4z"/><path d="M16 22h8M16 27h8"/>',
    ORDER: '<rect x="9" y="6" width="22" height="28" rx="2.5"/><path d="M14 13h12M14 19h12M14 25h7"/><path d="M24 29l2.4 2.4L31 27"/>',
    STOCK_LOT: '<path d="M6 16l14-8 14 8v14l-14 8-14-8z"/><path d="M6 16l14 8 14-8M20 24v14"/>',
    SHIPMENT: '<path d="M5 12h19v16H5zM24 17h6l5 5v6H24z"/><circle cx="12" cy="30" r="3" fill="#0b1220"/><circle cx="29" cy="30" r="3" fill="#0b1220"/>',
    PERSONNEL: '<circle cx="20" cy="14" r="6"/><path d="M8 34c1-8 6-12 12-12s11 4 12 12"/>',
    MAINTENANCE_TICKET: '<path d="M10 31l13-13M24 8a7 7 0 0 0 8 9l-2 2a7 7 0 0 1-9-9z"/><circle cx="11" cy="30" r="2.4"/>',
    QUALITY_NCR: '<path d="M20 6l15 27H5z"/><path d="M20 15v8M20 27v.5"/>',
    SUPPLIER: '<path d="M6 34V14l8 5V14l8 5V9h12v25z"/><path d="M26 16h4M26 22h4M26 28h4"/>',
    TASK: '<rect x="7" y="8" width="26" height="26" rx="3"/><path d="M13 20l5 5 9-10"/>',
};
const FRAME = '<path d="M20 2.5l15.6 9v17L20 37.5l-15.6-9v-17z" fill="rgba(15,23,42,.85)"/>';
/** Vector emblem of the object kind. A machine uses the shared spindle (same canonical state as every other machine surface). */
export function passportEmblem(kind, headline) {
    if (kind === 'MACHINE') {
        const w = spindleIcon(headline ?? 'UNKNOWN', 92);
        w.classList.add('kop-emblem');
        return w;
    }
    const el = document.createElement('span');
    el.className = 'kop-emblem';
    el.dataset.testid = 'pp-emblem';
    el.dataset.kind = kind;
    el.innerHTML = `<svg width="92" height="92" viewBox="0 0 40 40" role="img" aria-label="${KINDS[kind].tr}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${FRAME}<g transform="translate(5 5) scale(.75)">${GLYPH[kind] ?? '<circle cx="20" cy="20" r="9"/>'}</g><path d="M20 2.5l15.6 9v17L20 37.5l-15.6-9v-17z" stroke="currentColor" stroke-opacity=".55"/></svg>`;
    return el;
}
const TONE_COLOR = { '': '#94a3b8', ok: '#34d399', warn: '#fbbf24', bad: '#f87171', info: '#38bdf8', gold: '#d4af37' };
export function passportHeader(card, flow) {
    const def = KINDS[card.kind];
    const accent = card.kind === 'MACHINE' ? visualFor(card.machineHeadline).color : TONE_COLOR[card.status?.tone ?? ''];
    const hasZaman = def.tabs.some((t) => t.key === 'zaman');
    const step = (n, label, on, click, tid) => h('button', { type: 'button', class: `kop-step${on ? ' on' : ''}`, 'data-testid': tid, 'aria-current': on ? 'step' : 'false', onClick: click }, h('i', {}, n), label);
    return h('div', { class: 'panel pp-head kop', 'data-testid': 'pp-card', style: `--kop:${accent}` }, h('div', { class: 'kop-main' }, passportEmblem(card.kind, card.machineHeadline), h('div', { class: 'kop-id' }, h('div', { class: 'pp-kind' }, `${def.tr} · dijital pasaport`), h('div', { class: 'pp-title', 'data-testid': 'pp-title' }, card.title), h('div', { class: 'pp-sub' }, card.subtitle), card.kind === 'MACHINE' ? h('div', { class: 'kop-note', 'data-testid': 'pp-physical-note' }, card.cncConnected ? 'CNC bağlantılı makine: çalışma durumu CNC sinyalinden gelir; bakım / arıza kaydı elle girilen kayıtta kalır.' : 'Durum elle girilen kayıttır; fiziksel çalışma CNC bağlantısı olmadığından doğrulanmaz.') : null), h('div', { class: 'kop-states' }, card.status ? h('div', { class: `kop-state tone-${card.status.tone || 'n'}`, 'data-testid': 'pp-admin-state' }, h('span', { class: 'kop-state-l' }, card.kind === 'MACHINE' ? 'İDARİ KULLANILABİLİRLİK' : 'ANA DURUM'), h('b', { 'data-testid': 'pp-status' }, card.status.pill)) : null, card.kind === 'MACHINE' ? h('div', { class: 'kop-state', 'data-testid': 'pp-phys-state', 'data-connected': String(!!card.cncConnected), style: card.cncConnected ? `--kop:${accent}` : '' }, h('span', { class: 'kop-state-l' }, 'FİZİKSEL CNC'), h('b', { 'data-testid': 'pp-phys' }, card.cncConnected ? visualFor(card.machineHeadline).label : 'DOĞRULANMADI')) : null)), h('div', { class: 'pp-kpis' }, ...card.kpis.map((k) => h('div', { class: 'pp-kpi', 'data-testid': 'pp-kpi' }, h('b', {}, k.value), h('span', {}, k.label)))), card.links.length ? h('div', { class: 'pp-links', id: 'pp-related', 'data-testid': 'pp-related' }, h('span', { class: 'kop-rel' }, 'İLGİLİ NESNELER'), ...card.links.map((l) => h('a', { class: 'pp-chip', href: passportHref(l.kind, l.id), 'data-testid': 'pp-chip', 'data-kind': l.kind }, `${KINDS[l.kind].tr}: ${l.label}`))) : null, h('nav', { class: 'kop-flow', 'aria-label': 'Pasaport akışı', 'data-testid': 'pp-flow' }, step('1', 'Kart', false, () => window.scrollTo({ top: 0, behavior: 'smooth' }), 'pp-flow-card'), step('2', 'Pasaport', flow.activeTab !== 'zaman' && flow.activeTab !== 'iz', () => flow.onTab(flow.firstTab), 'pp-flow-passport'), hasZaman ? step('3', 'Olay geçmişi', flow.activeTab === 'zaman', () => flow.onTab('zaman'), 'pp-flow-history') : null, card.links.length ? step(hasZaman ? '4' : '3', 'İlgili nesneler', false, () => document.getElementById('pp-related')?.scrollIntoView({ block: 'center' }), 'pp-flow-related') : null), h('div', { class: 'mut kop-foot' }, `Kayıt: ${formatStamp(card.createdAt)} · Zamanlar Türkiye saatiyle, sunucu kayıt zamanıdır (KMI iç denetim mührü; hukuken nitelikli elektronik zaman damgası değildir).`));
}
export const PASSPORT_HEADER_CSS = `
.kd .kop{position:relative;gap:14px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:linear-gradient(135deg,rgba(30,41,59,.85),rgba(8,15,30,.95));box-shadow:inset 4px 0 0 var(--kop),0 14px 40px rgba(2,6,23,.45)}
.kd .kop::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,var(--kop),transparent 68%);opacity:.12;pointer-events:none}
.kd .kop-main{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.kd .kop-emblem{display:inline-flex;flex:none;color:var(--kop)}.kd .kop-id{flex:1 1 260px;min-width:0}
.kd .kop .pp-title{font-size:30px;line-height:1.15;letter-spacing:.01em}.kd .kop-note{margin-top:6px;font-size:12px;color:#94a3b8}
.kd .kop-states{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}.kd .kop-state{display:flex;flex-direction:column;align-items:flex-end;gap:2px;padding:10px 16px;border-radius:14px;border:1px solid var(--kop);background:rgba(2,6,23,.55);min-width:150px}
.kd .kop-state-l{font-size:10px;letter-spacing:.18em;color:#94a3b8;font-weight:800}.kd .kop-state b{font-size:20px;color:var(--kop);text-align:right}
.kd .kop .pp-kpi{background:rgba(2,6,23,.55)}.kd .kop .pp-kpi b{font-size:18px}
.kd .kop-rel{font-size:10px;letter-spacing:.16em;color:#94a3b8;font-weight:800;align-self:center}
.kd .kop-flow{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid rgba(148,163,184,.14);padding-top:10px}
.kd .kop-step{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid #334155;background:rgba(15,23,42,.8);color:#cbd5e1;font-weight:700;font-size:13px;cursor:pointer}
.kd .kop-step i{font-style:normal;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#1e293b;font-size:11px}
.kd .kop-step.on{border-color:var(--kop);color:#fff}.kd .kop-step.on i{background:var(--kop);color:#06101f}
.kd .kop-foot{font-size:11px}
@media (max-width:600px){.kd .kop .pp-title{font-size:22px}.kd .kop-state{align-items:flex-start;width:100%}.kd .kop-state b{text-align:left}}
`;
