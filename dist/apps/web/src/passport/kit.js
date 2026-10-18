// KMI-CARD-004 — KMI Card Design System: the ONE smart card face + the KPI vocabulary every passport uses.
// Pure DOM, no data access: the caller passes already-permissioned, already-calculated facts (the canonical calculators live in packages/domain and the RPCs).
// Rules enforced HERE so no screen can break them:
//   * unknown value  → "BİLİNMİYOR" in the neutral colour — never 0, never an invented arrow / percentage / colour;
//   * STATUS colour and CHANGE colour are two different things: a point's `tone` colours its value, `trend` colours only its own arrow, and the
//     arrow colour follows the KPI's direction (more good parts = good, more scrap = bad), not the sign of the change;
//   * every dynamic point can carry its source and its as-of time (title tooltip + data-source / data-asof for audit and tests);
//   * a card shows its 5–8 most valuable points; on a phone only the most critical ones (priority) stay visible.
import { h } from '../../../../packages/ui/src/h.js';
const NUM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
export const UNKNOWN = 'BİLİNMİYOR';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const fmtNum = (v, unit) => (isNum(v) ? `${NUM.format(v)}${unit ? ` ${unit}` : ''}` : null);
/** The arrow of a change. `null` whenever either side is unknown (no fake arrow, no fake percentage). Colour comes from the KPI direction. */
export function trendOf(t) {
    if (!isNum(t.current) || !isNum(t.previous))
        return null;
    const d = t.current - t.previous;
    if (Math.abs(d) < 1e-9)
        return { arrow: '▬', tone: 'mut', text: `değişim yok${t.vs ? ` · ${t.vs}` : ''}` };
    const up = d > 0;
    const tone = t.dir === 'NEUTRAL' ? 'info' : (t.dir === 'UP_GOOD') === up ? 'ok' : 'bad';
    const text = t.previous !== 0 ? `%${NUM.format(Math.abs((d / t.previous) * 100))}` : `${NUM.format(Math.abs(d))}${t.unit ? ` ${t.unit}` : ''}`;
    return { arrow: up ? '▲' : '▼', tone, text: `${text}${t.vs ? ` · ${t.vs}` : ''}` };
}
/** progress 0–100 (or null when value/target unknown or target ≤ 0). Never guesses a target. */
export function progressPct(p) {
    if (!isNum(p.value) || !isNum(p.target) || !(p.target > 0))
        return null;
    return Math.max(0, Math.min(100, Math.round((p.value / p.target) * 100)));
}
export function progressBar(p) {
    const pct = progressPct(p);
    if (pct === null)
        return h('div', { class: 'sk-prog unk', 'data-known': 'false', 'data-testid': 'sk-progress' }, `${p.label ?? 'İlerleme'}: ${UNKNOWN}`);
    const tone = p.dir === 'UP_BAD' ? (pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : 'ok') : pct >= 100 ? 'ok' : 'info';
    return h('div', { class: `sk-prog ${tone}`, 'data-known': 'true', 'data-pct': String(pct), 'data-testid': 'sk-progress' }, h('div', { class: 'sk-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': p.label ?? 'İlerleme' }, h('i', { style: `width:${pct}%` })), h('span', { class: 'sk-pct' }, `%${pct}`));
}
export function pointNode(p, big = false) {
    const text = typeof p.value === 'number' ? fmtNum(p.value, p.unit) : p.value === null || p.value === undefined || p.value === '' ? null : `${p.value}${p.unit ? ` ${p.unit}` : ''}`;
    const unknown = text === null;
    const tr = p.trend ? trendOf(p.trend) : null;
    const tip = [p.source ? `Kaynak: ${p.source}` : null, p.asOf ? `Güncelleme: ${p.asOf}` : null].filter(Boolean).join(' · ');
    const vEl = h(p.href ? 'a' : 'span', { class: 'sk-v', ...(p.href ? { href: p.href } : {}), 'data-testid': 'sk-value' }, unknown ? UNKNOWN : text);
    return h('div', { class: `sk-pt${unknown ? ' unk' : ''}${p.tone && !unknown ? ` ${p.tone}` : ''}${big ? ' big' : ''}`, 'data-testid': p.testid ?? 'sk-point', 'data-label': p.label, 'data-unknown': String(unknown), 'data-prio': String(p.priority ?? 3),
        ...(p.source ? { 'data-source': p.source } : {}), ...(p.asOf ? { 'data-asof': p.asOf } : {}), ...(tip ? { title: tip } : {}) }, h('span', { class: 'sk-l' }, p.label), vEl, tr ? h('span', { class: `sk-tr ${tr.tone}`, 'data-testid': 'sk-trend', 'data-arrow': tr.arrow, 'data-tone': tr.tone }, h('b', {}, tr.arrow), ` ${tr.text}`) : null, p.progress ? progressBar(p.progress) : null);
}
/** Photo / avatar slot. Starts as initials; `fill(src)` swaps in the real image. */
export function photoSlot(initials, shape, testid = 'sk-photo') {
    const el = h('div', { class: `sk-ph ${shape}`, 'data-testid': testid, 'data-has-photo': 'false', 'aria-hidden': 'true' }, initials);
    return { el, fill(src, alt) { el.replaceChildren(h('img', { src, alt, loading: 'lazy', 'data-testid': `${testid}-img` })); el.setAttribute('data-has-photo', 'true'); el.removeAttribute('aria-hidden'); } };
}
/** THE smart card front. 5–8 points, one status badge, one alert, last event, next action; the whole card is one link to the passport. */
export function smartCard(i, slot) {
    const points = i.points.slice(0, 8);
    return h('a', { class: 'sk', href: i.href, 'data-testid': i.testid ?? 'smart-card', 'data-kind': i.kind, 'data-id': i.id, 'data-state': i.badge?.text ?? '', 'data-points': String(points.length), style: `--sk:${i.accent ?? '#38bdf8'}`,
        'aria-label': `${i.kindTr}: ${i.title}${i.badge ? ` — ${i.badge.text}` : ''} — pasaportu aç` }, h('div', { class: 'sk-head' }, i.emblem ?? slot.el, h('div', { class: 'sk-id' }, h('div', { class: 'sk-kind' }, i.kindTr, i.code ? h('span', { class: 'sk-code', 'data-testid': 'sk-code' }, ` · ${i.code}`) : null), h('div', { class: 'sk-title', 'data-testid': 'sk-title' }, i.title), h('div', { class: `sk-sub${i.subtitle ? '' : ' unk'}`, 'data-testid': 'sk-sub' }, i.subtitle ?? i.subtitleUnknown ?? 'Girilmemiş'))), i.badge ? h('span', { class: `sk-badge ${i.badge.tone}`, 'data-testid': 'sk-badge' }, i.badge.text) : null, i.alert ? h('div', { class: `sk-alert ${i.alert.tone}`, 'data-testid': 'sk-alert' }, '! ', i.alert.text) : null, h('div', { class: 'sk-pts' }, ...points.map((p) => pointNode(p))), i.lastEvent ? h('div', { class: 'sk-last', 'data-testid': 'sk-last' }, h('span', { class: 'sk-l' }, 'SON HAREKET'), h('span', {}, i.lastEvent.text, i.lastEvent.at ? ` · ${i.lastEvent.at}` : '')) : null, i.nextAction ? h('div', { class: 'sk-next', 'data-testid': 'sk-next' }, h('span', { class: 'sk-l' }, 'SIRADAKİ'), h('span', {}, i.nextAction)) : null, h('div', { class: 'sk-foot' }, h('span', { class: 'sk-up' }, i.updated ? `Güncelleme ${i.updated}` : ''), h('span', { class: 'sk-go' }, i.action ?? 'Pasaportu aç →')));
}
export const SMART_CSS = `
.sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px;align-items:stretch}
@media (max-width:520px){.sk-grid{grid-template-columns:1fr;gap:12px}}
.sk{position:relative;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:18px;min-width:0;color:var(--kmi-text,#e2e8f0);text-decoration:none;background:linear-gradient(180deg,var(--kmi-panel2,#14213a),var(--kmi-panel,#0f1a30));
  border:1px solid var(--kmi-line,#1e2d4a);border-top:3px solid var(--sk);box-shadow:0 6px 18px rgba(2,6,23,.28);transition:transform .15s,border-color .15s}
a.sk:hover{border-color:var(--sk);transform:translateY(-1px)}a.sk:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.sk{transition:none}a.sk:hover{transform:none}}
.sk-head{display:flex;gap:14px;align-items:center;min-width:0}
.sk-ph{flex:0 0 auto;width:76px;height:76px;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:26px;font-weight:800;letter-spacing:.02em;color:var(--sk);background:rgba(148,163,184,.12);border:1px solid var(--kmi-line,#1e2d4a)}
.sk-ph.round{border-radius:50%}.sk-ph.square{border-radius:16px}.sk-ph img{width:100%;height:100%;object-fit:cover;display:block}
.sk-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.sk-kind{font-size:11px;letter-spacing:.14em;font-weight:800;color:var(--kmi-mut,#94a3b8)}.sk-code{letter-spacing:.04em}
.sk-title{font-size:19px;line-height:1.15;font-weight:800;color:var(--kmi-text,#fff);overflow-wrap:anywhere}.sk-sub{font-size:14px;font-weight:600;color:var(--kmi-text2,#cbd5e1);overflow-wrap:anywhere}.sk-sub.unk{color:var(--kmi-mut,#64748b);font-weight:500;font-style:italic}
.sk-badge{align-self:flex-start;font-size:12px;font-weight:800;letter-spacing:.05em;padding:3px 10px;border-radius:999px;border:1px solid currentColor}
.sk-badge.ok{color:var(--kmi-ok,#4ade80)}.sk-badge.warn{color:var(--kmi-warn,#fbbf24)}.sk-badge.bad{color:var(--kmi-bad,#f87171)}.sk-badge.info{color:var(--kmi-info,#38bdf8)}.sk-badge.mut{color:var(--kmi-mut,#94a3b8)}
.sk-alert{font-size:13px;font-weight:700;border-radius:10px;padding:8px 11px;border:1px solid}
.sk-alert.bad{color:var(--kmi-bad,#f87171);background:var(--kmi-bad-soft,rgba(248,113,113,.12));border-color:rgba(248,113,113,.4)}.sk-alert.warn{color:var(--kmi-warn,#fbbf24);background:var(--kmi-warn-soft,rgba(251,191,36,.12));border-color:rgba(251,191,36,.4)}
.sk-pts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}
.sk-pt{display:flex;flex-direction:column;gap:2px;min-width:0}.sk-l{font-size:11px;letter-spacing:.1em;font-weight:700;color:var(--kmi-mut,#94a3b8)}
.sk-v{font-size:15px;font-weight:700;color:var(--kmi-text,#fff);overflow-wrap:anywhere;text-decoration:none}.sk-pt.unk .sk-v{color:var(--kmi-mut,#64748b);font-weight:500;font-size:13px}
.sk-pt.ok .sk-v{color:var(--kmi-ok,#4ade80)}.sk-pt.warn .sk-v{color:var(--kmi-warn,#fbbf24)}.sk-pt.bad .sk-v{color:var(--kmi-bad,#f87171)}.sk-pt.info .sk-v{color:var(--kmi-info,#38bdf8)}
.sk-pt.big .sk-v{font-size:26px;line-height:1.1}
.sk-tr{font-size:12px;font-weight:700;display:inline-flex;gap:4px;align-items:center}.sk-tr.ok{color:var(--kmi-ok,#4ade80)}.sk-tr.bad{color:var(--kmi-bad,#f87171)}.sk-tr.info{color:var(--kmi-info,#38bdf8)}.sk-tr.mut{color:var(--kmi-mut,#94a3b8)}
.sk-prog{display:flex;align-items:center;gap:8px;margin-top:2px}.sk-prog.unk{font-size:12px;color:var(--kmi-mut,#64748b)}.sk-bar{flex:1;height:8px;border-radius:99px;background:rgba(148,163,184,.22);overflow:hidden}.sk-bar i{display:block;height:100%;border-radius:99px;background:var(--kmi-info,#38bdf8)}
.sk-prog.ok .sk-bar i{background:var(--kmi-ok,#4ade80)}.sk-prog.warn .sk-bar i{background:var(--kmi-warn,#fbbf24)}.sk-prog.bad .sk-bar i{background:var(--kmi-bad,#f87171)}.sk-pct{font-size:12px;font-weight:700;color:var(--kmi-text2,#cbd5e1);font-variant-numeric:tabular-nums}
.sk-last,.sk-next{display:flex;flex-direction:column;gap:1px;font-size:13px;color:var(--kmi-text2,#cbd5e1);overflow-wrap:anywhere}
.sk-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:4px}.sk-up{font-size:12px;color:var(--kmi-mut,#64748b)}.sk-go{font-size:13px;font-weight:700;color:var(--kmi-cyan2,#67e8f9)}
/* phone: only the most critical points (priority 1–2) plus any red/amber one stay visible — the rest is one tap away in the passport */
@media (max-width:520px){.sk-pts .sk-pt[data-prio="3"],.sk-pts .sk-pt[data-prio="4"]{display:none}.sk-pts .sk-pt.bad[data-prio],.sk-pts .sk-pt.warn[data-prio]{display:flex}}
`;
/** KPI tile used inside passport pages (bigger than a card point; same semantics). */
export const kpiTile = (p) => pointNode(p, true);
