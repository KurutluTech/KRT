// KMI SIGNATURE — spindle icon family + machine status visual language (KMI-001 final revision).
// ONE component for every machine surface (Home, Performance Center, KMI LIVE, machine passport, production screens), driven by the SAME
// canonical `machineState().headline`. Colour is never the only carrier: every state also has its own overlay shape and a text label.
//
// HONESTY RULE: there is no CNC/sensor connection. The rotating cutter therefore means "a work order is recorded as ACTIVE on this machine"
// (headline ACTIVE_WORK_ORDER) — NEVER "the spindle is physically turning". The icon's tooltip/aria says exactly that. Every other state is static.
import { SEMANTIC } from '../../../packages/domain/src/semanticColors.js';
/** Canonical status language. Order of severity: DOWN > HOLD > MAINTENANCE > STOPPED/FIRST_PIECE > ACTIVE > IDLE > UNKNOWN. */
export const STATE_VISUAL = {
    ACTIVE_WORK_ORDER: { key: 'ACTIVE_WORK_ORDER', label: 'ÜRETİMDE', color: SEMANTIC.ok.fg, soft: 'rgba(52,211,153,.14)', animated: true, meaning: 'Aktif iş emri kayıtlı — fiziksel dönüş sensörle doğrulanmadı' },
    FIRST_PIECE: { key: 'FIRST_PIECE', label: 'İLK PARÇA', color: SEMANTIC.warn.fg, soft: 'rgba(251,191,36,.14)', animated: false, meaning: 'İlk parça onayı bekleniyor / verildi' },
    STOPPED: { key: 'STOPPED', label: 'DURUYOR', color: SEMANTIC.warn.fg, soft: 'rgba(251,191,36,.14)', animated: false, meaning: 'Üretim duruş kaydı (fiziksel acil stop değil)' },
    READY_IDLE: { key: 'READY_IDLE', label: 'BOŞTA', color: '#b6c2d6', soft: 'rgba(148,163,184,.12)', animated: false, meaning: 'Kullanıma hazır, aktif iş emri yok' },
    DOWN: { key: 'DOWN', label: 'ARIZALI', color: SEMANTIC.bad.fg, soft: 'rgba(248,113,113,.16)', animated: false, meaning: 'Arızalı / DOWN kaydı' },
    MAINTENANCE: { key: 'MAINTENANCE', label: 'BAKIMDA', color: SEMANTIC.info.fg, soft: 'rgba(56,189,248,.14)', animated: false, meaning: 'Bakımda' },
    HOLD: { key: 'HOLD', label: 'KALİTE HOLD', color: SEMANTIC.hold.fg, soft: 'rgba(196,181,253,.14)', animated: false, meaning: 'Kalite engeli / bekletme' },
    UNKNOWN: { key: 'UNKNOWN', label: 'BİLİNMİYOR', color: SEMANTIC.unknown.fg, soft: 'rgba(100,116,139,.12)', animated: false, meaning: 'Durum kaydı yok veya okunamadı' },
};
// ---- ORIGINAL artwork (KMI-001 final): vertical CNC spindle head — head block with two status lamps, cone, tool-holder collar, fluted cutter, chips.
// Style direction only comes from the owner's reference icons (flat fills + dark outline); no stock artwork is copied or embedded (those are licensed images).
const mix = (hex, to, k) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(c + (to - c) * k);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const OUT = '#0b1220';
/** Technical side elevation of a CNC spindle: housing with cooling fins, a state band, nose taper, tool-holder collar and a fluted end mill. Steel is neutral in every state;
 *  the state shows ONLY in the band, the lamp and the badge — so it can never read as a face or a cartoon. */
const body = (v) => {
    const c = v.color;
    const unk = v.key === 'UNKNOWN';
    const dash = unk ? ' stroke-dasharray="3 2.4"' : '';
    const steel = unk ? '#3a475c' : '#52617d';
    const steel2 = unk ? '#2c384b' : '#3d4b66';
    const edge = unk ? '#7b8798' : '#c3cfe3';
    return `<g stroke="${edge}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"${dash}>` +
        `<rect x="19" y="3.5" width="26" height="23" rx="3" fill="${steel}"/>` +
        `<path d="M19 9.5h26M19 14.5h26M19 19.5h26" opacity=".55"/>` +
        `<path d="M22 26.5h20l-4.5 11h-11z" fill="${steel2}"/>` +
        `<rect x="26" y="37.5" width="12" height="4.5" rx="1" fill="${steel}"/>` +
        `<path d="M29 42v15.2l3 2.3 3-2.3V42z" fill="${unk ? '#556070' : '#d3dae6'}"/></g>` +
        `<rect x="19.75" y="22" width="24.5" height="4" fill="${unk ? '#64748b' : c}" opacity="${unk ? '.55' : '1'}"/>` +
        `<clipPath id="spc"><path d="M29.6 42.6v14.4l2.4 1.8 2.4-1.8V42.6z"/></clipPath>` +
        `<g clip-path="url(#spc)"><g class="sp-rot" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"><path d="M27 60l10-8M27 52l10-8M27 44l10-8M27 68l10-8"/></g></g>` +
        `<rect x="39.2" y="6.2" width="3.6" height="3.6" rx=".8" fill="${v.key === 'READY_IDLE' || unk ? '#64748b' : c}" stroke="${OUT}" stroke-width="1"/>` +
        `<g class="sp-chips" stroke="${edge}" stroke-width="1.6" stroke-linecap="round"><path d="M24 55l-5-3M23 59.5h-6M40 55l5-3M41 59.5h6"/></g>`;
};
/** Overlay badges (bottom-right): each state has its own silhouette, so the icon reads in greyscale too. ACTIVE and IDLE need none (chips / lamps tell). */
const BADGE = (c, inner, tri = false) => (tri
    ? `<path d="M52 41l10 17H42z" fill="${OUT}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>${inner}`
    : `<circle cx="52" cy="50" r="9.5" fill="${OUT}" stroke="${c}" stroke-width="2"/>${inner}`);
const OVERLAY = {
    ACTIVE_WORK_ORDER: () => '',
    FIRST_PIECE: (c) => BADGE(c, `<path d="M47.6 50l3 3.2 5.4-6" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
    STOPPED: (c) => BADGE(c, `<path d="M49.4 45.6v8.8M54.6 45.6v8.8" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`),
    READY_IDLE: () => '',
    DOWN: (c) => BADGE(c, `<path d="M48 46l8 8M56 46l-8 8" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`),
    MAINTENANCE: (c) => BADGE(c, `<path d="M47.4 54.6l6.6-6.6M53.6 45.4a3.2 3.2 0 1 0 4 4" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`),
    HOLD: (c) => BADGE(c, `<path d="M52 47.4v5M52 55v.5" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`, true),
    UNKNOWN: (c) => BADGE(c, `<path d="M49.4 47.4a2.7 2.7 0 1 1 3.6 2.5c-.9.4-1.2.9-1.2 1.8M52 55v.4" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`),
};
export function visualFor(headline) {
    return STATE_VISUAL[headline in STATE_VISUAL ? headline : 'UNKNOWN'];
}
/** Inline SVG markup of the spindle icon for one state. `size` in px (square). */
export function spindleSvg(headline, size = 56, still = false) {
    const v = visualFor(headline);
    const on = v.animated && !still;
    return `<svg class="sp" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${v.label}: ${v.meaning}" data-state="${v.key}" data-animated="${on ? 'on' : 'off'}" focusable="false">` +
        `<title>${v.label} — ${v.meaning}</title>${body(v)}${OVERLAY[v.key](v.color)}</svg>`;
}
/** `still` = the data behind the state is stale/unverified → never animate. */
export function spindleIcon(headline, size = 56, still = false) {
    const el = document.createElement('span');
    el.className = 'sp-wrap';
    el.style.cssText = `display:inline-flex;width:${size}px;height:${size}px;flex:none`;
    el.dataset.testid = 'spindle';
    el.dataset.state = visualFor(headline).key;
    el.innerHTML = spindleSvg(headline, size, still);
    return el;
}
/** CSS for the icon + status chips. Rotation is a cheap transform on one group, off for prefers-reduced-motion and off-screen use is not needed (≤ 40 icons). */
export const SPINDLE_CSS = `
.sp{display:block;overflow:visible}.sp .sp-chips{display:none}
.sp[data-animated=on] .sp-rot{animation:kmiSpindle .9s linear infinite}
.sp[data-animated=on] .sp-chips{display:inline;animation:kmiChips 1.1s ease-in-out infinite}
@keyframes kmiSpindle{to{transform:translateY(-8px)}}
@keyframes kmiChips{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.sp[data-animated=on] .sp-rot,.sp[data-animated=on] .sp-chips{animation:none}.sp[data-animated=on] .sp-chips{opacity:1}}
.sv-chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.08em;border:1px solid currentColor;background:rgba(2,6,23,.4)}
.sv-chip i{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
`;
