// KMI SIGNATURE — Machine Identity Card (KMI-001 final revision). The ONE machine card used by Home, Performance Center, KMI LIVE and the
// machine passport header. It only DISPLAYS what the caller passes (canonical machineState headline + work-order detail); every missing
// value is rendered as BİLİNMİYOR / "kayıt yok" — never as 0, never invented. The machine table has no brand/model column yet, so the
// card says so instead of guessing.
import { h } from '../../../packages/ui/src/index.js';
import { HEADLINE_TR } from '../../../packages/domain/src/machineState.js';
import { spindleIcon, visualFor } from './spindle.js';
const NUM = new Intl.NumberFormat('tr-TR');
/** whole-percent of produced/planned; null when either is unknown or plan is 0 */
export function progressPct(produced, planned) {
    if (typeof produced !== 'number' || typeof planned !== 'number' || !(planned > 0))
        return null;
    return Math.max(0, Math.min(100, Math.round((produced / planned) * 100)));
}
/** "3 sa 20 dk" style elapsed text; null when the start is unknown or in the future */
export function sinceText(sinceIso, nowIso) {
    if (!sinceIso)
        return null;
    const ms = Date.parse(nowIso) - Date.parse(sinceIso);
    if (!Number.isFinite(ms) || ms < 0)
        return null;
    const m = Math.floor(ms / 60000);
    if (m < 60)
        return `${m} dk`;
    const hh = Math.floor(m / 60);
    if (hh < 48)
        return `${hh} sa ${m % 60} dk`;
    return `${Math.floor(hh / 24)} gün`;
}
export function machineIdentityCard(i) {
    const v = visualFor(i.headline);
    const compact = i.size === 'compact';
    const pct = i.wo ? progressPct(i.wo.produced, i.wo.planned) : null;
    const fact = (label, value, cls = '') => h('div', { class: `mc-f ${cls}` }, h('span', { class: 'mc-fl' }, label), h('span', { class: 'mc-fv' }, value));
    const opTxt = i.wo ? (i.wo.operator === undefined ? 'BİLİNMİYOR' : i.wo.operator ?? 'atanmamış') : null;
    const body = [
        // 1) STATE first: one pill (icon + text) + since
        h('div', { class: 'mc-st', style: `color:${v.color}`, 'data-testid': 'mc-state', 'data-headline': i.headline }, h('b', { class: 'mc-pill', style: `border-color:${v.color};background:${v.soft}` }, v.label), i.sinceLabel || !compact ? h('span', { class: 'mc-since' }, i.sinceLabel ?? 'süre bilinmiyor') : null),
        // 2) then identity
        h('div', { class: 'mc-top' }, h('span', { class: 'mc-ico', ...(i.photo ? { 'data-testid': 'mc-photo' } : {}) }, i.photo ?? spindleIcon(i.headline, compact ? 40 : 80, i.fresh === false)), h('div', { class: 'mc-id' }, h('div', { class: 'mc-code', 'data-testid': 'mc-code' }, i.code), i.name ? h('div', { class: 'mc-name' }, i.name) : null, compact ? null : h('div', { class: 'mc-sub' }, i.brandModel ?? 'Marka/model kaydı yok', i.classTr ? ` · ${i.classTr}` : ''))),
        i.conflictNote ? h('div', { class: 'mc-warn', 'data-testid': 'mc-conflict' }, i.conflictNote) : null,
        i.wo ? h('div', { class: 'mc-wo', 'data-testid': 'mc-wo' }, h('div', { class: 'mc-job' }, h('b', {}, i.wo.product ?? 'Ürün: BİLİNMİYOR'), h('span', {}, ` · İE ${i.wo.no}`, i.woCount && i.woCount > 1 ? ` (+${i.woCount - 1} iş daha)` : '')), h('div', { class: 'mc-facts' }, fact('Operatör', `${opTxt}`), i.shift ? fact('Vardiya', i.shift) : null, i.wo.scrap ? fact('Hurda', NUM.format(i.wo.scrap), 'warn') : null), pct === null
            ? h('div', { class: 'mc-prog unk', 'data-testid': 'mc-progress', 'data-known': 'false', title: 'Plan veya üretim kaydı okunamadı' }, compact ? 'İlerleme: BİLİNMİYOR' : 'İlerleme: BİLİNMİYOR (plan/üretim kaydı okunamadı)')
            : h('div', { class: 'mc-prog', 'data-testid': 'mc-progress', 'data-known': 'true' }, h('div', { class: 'mc-pct' }, h('b', {}, `%${pct}`), h('span', {}, `${NUM.format(i.wo.produced ?? 0)} / ${NUM.format(i.wo.planned ?? 0)}`, i.wo.scrap ? ` · hurda ${NUM.format(i.wo.scrap)}` : '')), h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Üretim ilerlemesi' }, h('i', { style: `width:${pct}%;background:${v.color}` })))) :
            h('div', { class: 'mc-wo idle', 'data-testid': 'mc-nowo' }, 'Aktif iş emri kaydı yok'),
        i.alert ? h('div', { class: 'mc-alert', 'data-testid': 'mc-alert' }, '! ', i.alert) : null,
        i.passportHref ? h('span', { class: 'mc-go', title: 'Makine pasaportunu aç' }, compact ? '›' : 'Makine pasaportu →') : null,
    ];
    const attrs = { class: `mc ${compact ? 'compact' : ''} s-${i.headline}`, 'data-testid': i.testid ?? 'machine-card', 'data-code': i.code, 'data-headline': i.headline, style: `--mc:${v.color};--mc-soft:${v.soft}`,
        'aria-label': `Makine ${i.code}: ${HEADLINE_TR[i.headline]}${i.passportHref ? ' — pasaportu aç' : ''}` };
    return (i.passportHref ? h('a', { ...attrs, href: i.passportHref }, ...body) : h('div', attrs, ...body));
}
export const MACHINE_CARD_CSS = `
.mc{position:relative;display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:16px;color:var(--kmi-text);text-decoration:none;min-width:0;
  background:linear-gradient(180deg,var(--kmi-panel2),var(--kmi-panel));border:1px solid var(--kmi-line);box-shadow:0 6px 18px rgba(2,6,23,.28);transition:transform .15s,border-color .15s}
.mc.s-DOWN{border-color:var(--kmi-bad)}.mc.s-HOLD{border-color:var(--kmi-hold)}
a.mc:hover{border-color:var(--mc);transform:translateY(-1px)}a.mc:focus-visible{outline:3px solid var(--kmi-focus);outline-offset:2px}
.mc-st{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.mc-pill{font-size:13px;letter-spacing:.02em;padding:4px 12px;border-radius:999px;border:1px solid;font-weight:800}.mc-since{font-size:13px;color:var(--kmi-mut);font-weight:600}
.mc-top{display:flex;align-items:center;gap:14px;min-width:0}.mc-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.mc-code{font-size:28px;line-height:1.05;font-weight:800;color:var(--kmi-text);overflow-wrap:anywhere}.mc.compact .mc-code{font-size:26px}
.mc-name{font-size:14px;color:var(--kmi-text2)}.mc-sub{font-size:13px;color:var(--kmi-mut)}
.mc-warn{font-size:13px;padding:8px 10px;border-radius:10px;background:var(--kmi-warn-soft);color:var(--kmi-warn)}
.mc-wo{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--kmi-line)}.mc-wo.idle{font-size:14px;color:var(--kmi-mut)}
.mc-job{font-size:16px;color:var(--kmi-text);overflow-wrap:anywhere}.mc-job span{color:var(--kmi-mut);font-size:14px}
.mc-facts{display:flex;flex-wrap:wrap;gap:8px 22px}.mc-f{display:flex;flex-direction:column;gap:1px;min-width:0}.mc-fl{font-size:12px;font-weight:600;color:var(--kmi-mut)}.mc-fv{font-size:15px;font-weight:600;color:var(--kmi-text)}.mc-f.warn .mc-fv{color:var(--kmi-warn)}
.mc-prog{display:flex;flex-direction:column;gap:6px;color:var(--kmi-text2)}.mc-prog.unk{color:var(--kmi-mut);font-size:13px}.mc-pct{display:flex;align-items:baseline;gap:10px}.mc-pct b{font-size:24px;color:var(--kmi-text);font-variant-numeric:tabular-nums}.mc-pct span{font-size:14px}
.mc-prog .bar{height:10px;border-radius:99px;background:rgba(148,163,184,.22);overflow:hidden}.mc-prog .bar i{display:block;height:100%;border-radius:99px}
.mc-alert{font-size:14px;font-weight:700;color:var(--kmi-bad);background:var(--kmi-bad-soft);border-radius:10px;padding:9px 12px;border:1px solid rgba(248,113,113,.4)}
.mc-go{align-self:flex-start;font-size:13px;font-weight:700;color:var(--kmi-cyan2);padding:4px 0;border-bottom:1px solid transparent}
a.mc:hover .mc-go{border-bottom-color:currentColor}
/* compact (Performance Center park, 3 columns on 1440 px): state pill shares the identity row; no divider, short unknown text, whole card is the passport link */
.mc.compact{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"ico id st" "wo wo wo" "warn warn warn" "alert alert alert";gap:6px 12px;padding:12px 14px;border-radius:14px;align-items:center}
.mc.compact .mc-st{grid-area:st;align-self:start}.mc.compact .mc-since{display:none}.mc.compact .mc-top{display:contents}.mc.compact .mc-ico{grid-area:ico}.mc.compact .mc-id{grid-area:id}
.mc.compact .mc-wo{grid-area:wo;padding-top:0;border-top:0;gap:5px}.mc.compact .mc-warn{grid-area:warn}.mc.compact .mc-alert{grid-area:alert}
.mc.compact .mc-code{font-size:22px}.mc.compact .mc-job{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mc.compact .mc-job span{font-size:13px}
.mc.compact .mc-facts{gap:2px 16px}.mc.compact .mc-f{flex-direction:row;gap:5px;align-items:baseline}.mc.compact .mc-fv{font-size:14px}.mc.compact .mc-fl{font-size:13px}
.mc.compact .mc-pct b{font-size:18px}.mc.compact .mc-prog .bar{height:6px}.mc.compact .mc-prog.unk{font-size:13px}
.mc.compact .mc-go{position:absolute;right:12px;bottom:8px;font-size:18px;padding:0;border:0;color:var(--kmi-mut)}.mc.compact .mc-wo.idle{font-size:13px}
@media (max-width:480px){.mc{padding:14px}.mc-code{font-size:24px}.mc.compact{padding:12px}}
`;
