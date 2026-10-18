// KMI-CARD-004 — Digital Passport SHELL (iPhone-Settings style). Fixed identity header → grouped topic list → one page per topic.
//   * header: photo / emblem, code, name, critical status and 3–4 critical points — always visible, also on a topic page;
//   * home: topics grouped like iOS Settings (big touch rows, one live line each); desktop shows them as a card grid;
//   * topic page: breadcrumb + "‹ Geri" always; desktop adds a side navigation, phone is one column;
//   * a topic the person may not open is NOT listed (the server is the real gate — this only keeps the UI honest);
//   * the shell holds no data: every topic renders itself through its own canonical reader.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { iconSvg } from '../nav.js';
import { KX_CSS } from '../kx.js';
import { SECTIONS_CSS } from './sections.js';
import { PANEL_CSS } from './storePanels.js';
import { SMART_CSS, pointNode } from './kit.js';
import { errorText } from '../errorText.js';
export const SHELL_CSS = `
.ps{display:flex;flex-direction:column;gap:14px;color:var(--kmi-text,#e2e8f0);min-width:0}
.ps-crumb{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:var(--kmi-mut,#94a3b8)}.ps-crumb a{color:var(--kmi-cyan2,#67e8f9);text-decoration:none}.ps-crumb b{color:var(--kmi-text,#fff);font-weight:700;overflow-wrap:anywhere}
.ps-back{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--kmi-line2,#334155);color:var(--kmi-text,#fff);text-decoration:none;font-weight:700;font-size:15px;background:transparent;align-self:flex-start}
.ps-head{position:relative;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:18px;border:1px solid var(--kmi-line,#1e2d4a);border-top:3px solid var(--sk,#38bdf8);background:linear-gradient(180deg,var(--kmi-panel2,#14213a),var(--kmi-panel,#0f1a30))}
.ps-head-top{display:flex;gap:16px;align-items:center;min-width:0;flex-wrap:wrap}.ps-id{min-width:0;flex:1 1 220px;display:flex;flex-direction:column;gap:3px}
.ps-kind{font-size:11px;letter-spacing:.14em;font-weight:800;color:var(--kmi-mut,#94a3b8)}.ps-title{margin:0;font-size:24px;line-height:1.15;font-weight:800;color:var(--kmi-text,#fff);overflow-wrap:anywhere}
.ps-sub{font-size:15px;font-weight:600;color:var(--kmi-text2,#cbd5e1);overflow-wrap:anywhere}.ps-sub.unk{color:var(--kmi-mut,#64748b);font-style:italic;font-weight:500}
.ps-badges{display:flex;gap:8px;flex-wrap:wrap}.ps-badge{font-size:12px;font-weight:800;letter-spacing:.05em;padding:3px 10px;border-radius:999px;border:1px solid currentColor}
.ps-badge.ok{color:var(--kmi-ok,#4ade80)}.ps-badge.warn{color:var(--kmi-warn,#fbbf24)}.ps-badge.bad{color:var(--kmi-bad,#f87171)}.ps-badge.info{color:var(--kmi-info,#38bdf8)}.ps-badge.mut{color:var(--kmi-mut,#94a3b8)}
.ps-hp{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 16px;padding-top:6px;border-top:1px solid var(--kmi-line,#1e2d4a)}
.ps-alerts{display:flex;flex-direction:column;gap:6px}.ps-alert{font-size:13px;font-weight:700;color:var(--kmi-bad,#f87171);background:var(--kmi-bad-soft,rgba(248,113,113,.12));border:1px solid rgba(248,113,113,.4);border-radius:10px;padding:8px 11px}
.ps-body{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
@media (min-width:1024px){.ps-body.has-nav{grid-template-columns:260px minmax(0,1fr)}}
.ps-nav{display:none;flex-direction:column;gap:4px;position:sticky;top:76px}.ps-body.has-nav .ps-nav{display:none}
@media (min-width:1024px){.ps-body.has-nav .ps-nav{display:flex}}
.ps-nav-g{font-size:11px;letter-spacing:.12em;font-weight:800;color:var(--kmi-mut,#94a3b8);margin:10px 8px 2px}
.ps-nav a{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--kmi-text2,#cbd5e1);text-decoration:none;font-size:14px;font-weight:600}.ps-nav a[aria-current=page]{background:rgba(56,189,248,.16);color:#fff;border:1px solid var(--kmi-info,#38bdf8)}
.ps-nav a:hover{background:rgba(148,163,184,.1)}
.ps-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start}@media (max-width:700px){.ps-groups{grid-template-columns:1fr}}
.ps-group{border:1px solid var(--kmi-line,#1e2d4a);border-radius:16px;background:linear-gradient(180deg,var(--kmi-panel2,#14213a),var(--kmi-panel,#0f1a30));overflow:hidden}
.ps-group h3{margin:0;padding:12px 16px 6px;font-size:12px;letter-spacing:.12em;font-weight:800;color:var(--kmi-mut,#94a3b8)}
.ps-trow{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;min-height:60px;padding:10px 16px;border-top:1px solid var(--kmi-line,#1e2d4a);color:inherit;text-decoration:none}.ps-trow:hover{background:rgba(56,189,248,.07)}.ps-trow:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:-3px}
.ps-ti{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(56,189,248,.14);color:var(--kmi-info,#38bdf8)}
.ps-tt{font-size:16px;font-weight:700;color:var(--kmi-text,#fff)}.ps-ts{font-size:13px;color:var(--kmi-mut,#94a3b8);overflow-wrap:anywhere}.ps-ts.ok{color:var(--kmi-ok,#4ade80)}.ps-ts.warn{color:var(--kmi-warn,#fbbf24)}.ps-ts.bad{color:var(--kmi-bad,#f87171)}
.ps-chev{color:var(--kmi-mut,#64748b);font-size:22px;line-height:1}
.ps-page{display:flex;flex-direction:column;gap:14px;min-width:0}.ps-page-h{margin:0;font-size:20px;color:var(--kmi-text,#fff)}
.ps-banner{padding:10px 14px;border-radius:12px;font-size:14px;font-weight:600;border:1px solid var(--kmi-line2,#334155)}.ps-banner.ok{border-color:var(--kmi-ok,#4ade80);color:var(--kmi-ok,#4ade80)}.ps-banner.error{border-color:var(--kmi-bad,#f87171);color:var(--kmi-bad,#f87171)}
.ps-note{font-size:12px;color:var(--kmi-mut,#94a3b8)}
.ps .kd{display:flex;flex-direction:column;gap:14px}
`;
const icon = (name) => { const s = document.createElement('span'); s.innerHTML = iconSvg(name, 20); return s; };
const groupsOf = (topics) => { const m = new Map(); for (const t of topics) {
    if (!m.has(t.group))
        m.set(t.group, []);
    m.get(t.group).push(t);
} return [...m.entries()]; };
export async function renderPassportShell(container, i) {
    const topics = i.topics.filter((t) => t.visible !== false);
    const active = i.active ? topics.find((t) => t.id === i.active) ?? null : null;
    const unknownTopic = !!i.active && !active;
    const crumb = h('nav', { class: 'ps-crumb', 'aria-label': 'Konum', 'data-testid': 'ps-crumb' }, h('a', { href: '#/' }, 'Ana Sayfa'), '›', h('a', { href: i.listHref }, i.listLabel), '›', active ? h('a', { href: i.hrefFor(null), 'data-testid': 'ps-crumb-entity' }, i.title) : h('b', { 'aria-current': 'page' }, i.title), active ? '›' : null, active ? h('b', { 'aria-current': 'page', 'data-testid': 'ps-crumb-topic' }, active.title) : null);
    const back = h('a', { class: 'ps-back', href: active ? i.hrefFor(null) : i.listHref, 'data-testid': 'ps-back' }, active ? `‹ ${i.kindTr} pasaportu` : `‹ ${i.listLabel}`);
    const head = h('header', { class: 'ps-head', 'data-testid': 'ps-head', 'data-kind': i.kind, style: `--sk:${i.accent ?? '#38bdf8'}` }, h('div', { class: 'ps-head-top' }, i.emblem ?? null, h('div', { class: 'ps-id' }, h('div', { class: 'ps-kind' }, i.kindTr.toLocaleUpperCase('tr-TR'), i.code ? ` · ${i.code}` : ''), h('h1', { class: 'ps-title', 'data-testid': 'ps-title' }, i.title), h('div', { class: `ps-sub${i.subtitle ? '' : ' unk'}`, 'data-testid': 'ps-sub' }, i.subtitle ?? i.subtitleUnknown ?? 'Girilmemiş')), h('div', { class: 'ps-badges' }, ...i.badges.map((b) => h('span', { class: `ps-badge ${b.tone}`, 'data-testid': 'ps-badge' }, b.text)))), i.alerts && i.alerts.length ? h('div', { class: 'ps-alerts' }, ...i.alerts.map((a) => h('div', { class: 'ps-alert', 'data-testid': 'ps-alert' }, '! ', a))) : null, i.headPoints.length ? h('div', { class: 'ps-hp', 'data-testid': 'ps-headpoints' }, ...i.headPoints.slice(0, 4).map((p) => pointNode(p))) : null);
    const banner = i.banner ? h('div', { class: `ps-banner ${i.banner.kind === 'error' ? 'error' : i.banner.kind}`, 'data-testid': 'ps-banner', 'data-kind': i.banner.kind, role: i.banner.kind === 'error' ? 'alert' : 'status' }, i.banner.text) : h('div', { 'data-testid': 'ps-banner', style: 'display:none', role: 'status' });
    const row = (t) => h('a', { class: 'ps-trow', href: i.hrefFor(t.id), 'data-testid': `ps-topic-${t.id}`, 'data-topic': t.id }, h('span', { class: 'ps-ti' }, icon(t.icon)), h('span', {}, h('div', { class: 'ps-tt' }, t.title), t.summary ? h('div', { class: `ps-ts ${t.tone === 'mut' ? '' : t.tone ?? ''}`, 'data-testid': 'ps-topic-summary' }, t.summary) : null), h('span', { class: 'ps-chev', 'aria-hidden': 'true' }, '›'));
    let content;
    const topicHost = h('div', { class: 'ps-page kd', 'data-testid': 'ps-topic-host', 'data-topic': active?.id ?? '' });
    if (!active) {
        content = h('div', { class: 'ps-groups', 'data-testid': 'ps-topics' }, ...groupsOf(topics).map(([g, ts]) => h('section', { class: 'ps-group', 'data-testid': 'ps-group', 'data-group': g }, h('h3', {}, g), ...ts.map(row))));
    }
    else
        content = h('main', { class: 'ps-page' }, h('h2', { class: 'ps-page-h', 'data-testid': 'ps-topic-title' }, active.title), topicHost);
    const nav = h('nav', { class: 'ps-nav', 'aria-label': 'Pasaport konuları', 'data-testid': 'ps-nav' }, ...groupsOf(topics).flatMap(([g, ts]) => [h('div', { class: 'ps-nav-g' }, g), ...ts.map((t) => h('a', { href: i.hrefFor(t.id), 'data-testid': `ps-nav-${t.id}`, ...(t.id === active?.id ? { 'aria-current': 'page' } : {}) }, icon(t.icon), t.title))]));
    mount(container, h('div', { class: 'ps', 'data-testid': 'ps-root', 'data-kind': i.kind, 'data-topic': active?.id ?? '' }, h('style', {}, KX_CSS + SECTIONS_CSS + PANEL_CSS + SMART_CSS + SHELL_CSS), crumb, back, head, banner, unknownTopic ? h('div', { class: 'ps-banner', 'data-testid': 'ps-unknown-topic' }, 'Bu konu yok ya da bu pasaport için açılamaz.') : null, h('div', { class: `ps-body${active ? ' has-nav' : ''}` }, active ? nav : null, content), ...(i.notes ?? []).map((n) => h('div', { class: 'ps-note' }, n))));
    if (active) {
        try {
            await active.render(topicHost);
        }
        catch (e) {
            topicHost.replaceChildren(h('div', { class: 'ps-banner error', role: 'alert', 'data-testid': 'ps-topic-error' }, errorText(e)));
        }
    }
}
