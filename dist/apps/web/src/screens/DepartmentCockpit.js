// Department cockpit band — shared renderer, department-specific content (packages/domain/src/departmentCockpit.ts).
// Sits above the department's own work screen; it never replaces it and never writes anything. A source that fails shows
// UNKNOWN / VERİ GEREKLİ for exactly the KPIs that depend on it.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildCockpit } from '../../../../packages/domain/src/departmentCockpit.js';
import { createCommandCenterApi } from '../commandCenterApi.js';
import { createWorkOrderHubApi } from '../workOrderHubApi.js';
import { createDepartmentApi } from '../departmentApi.js';
import { createPlanningApi } from '../planningApi.js';
import { createEngineeringApi } from '../engineeringApi.js';
import { createToolroomApi } from '../toolroomApi.js';
import { createMaintenanceApi } from '../maintenanceApi.js';
import { createPurchasingApi } from '../purchasingApi.js';
import { createPersonnelApi } from '../personnelApi.js';
import { createQualityDeskApi } from '../qualityDeskApi.js';
import { buildQualityDesk } from '../../../../packages/domain/src/qualityDesk.js';
const NEEDS = {
    PRODUCTION: ['snapshot'], PLANNING: ['snapshot', 'board'], CAM: ['snapshot', 'eng'], QUALITY: ['snapshot', 'workOrders'], TOOLROOM: ['tools'], MAINTENANCE: ['snapshot', 'tickets'],
    WAREHOUSE: ['snapshot', 'lots'], PURCHASING: ['snapshot', 'pos', 'poLines'], SHIPPING: ['snapshot', 'lots'], ACCOUNTING: ['snapshot'], PERSONNEL: ['personnel'],
};
export function liveCockpitSources(c, s) {
    const hub = createWorkOrderHubApi(c, s), pur = createPurchasingApi(c, s);
    return {
        snapshot: () => createCommandCenterApi(c, s).snapshot(), workOrders: () => hub.list(), lots: () => createDepartmentApi(c, s, hub).stockLots(), board: () => createPlanningApi(c, s).board(),
        eng: () => createEngineeringApi(c, s).load(), tools: () => createToolroomApi(c, s).listTools(), tickets: () => createMaintenanceApi(c, s).listTickets(),
        pos: () => pur.listPurchaseOrders(), poLines: () => pur.listLines(), personnel: () => createPersonnelApi(c, s).list(), quality: () => createQualityDeskApi(c, s).load(),
    };
}
const lookup = (m, id) => (m instanceof Map ? m.get(id) : m && typeof m === 'object' ? m[id] : undefined);
const attempt = async (f) => { if (!f)
    return null; try {
    return await f();
}
catch {
    return null;
} };
/** Reads every source the department needs ONCE (a failed read stays null → UNKNOWN, never 0); cockpit and department home share the result. */
export async function loadCockpitInput(id, src, nowIso) {
    const keys = NEEDS[id];
    const vals = await Promise.all(keys.map((k) => attempt(src[k])));
    const input = { nowIso, snapshot: null };
    keys.forEach((k, i) => { input[k] = vals[i]; });
    if (id === 'QUALITY' && src.quality) { // canonical Quality Desk model (holds, first piece, NCR, incoming); an unreadable source stays null → UNKNOWN, never 0
        const raw = (await attempt(src.quality));
        input['qdesk'] = raw ? buildQualityDesk({ nowIso, workOrders: raw.workOrders, ops: raw.ops, holds: raw.holds, ncrs: raw.ncrs, incoming: raw.incoming,
            names: { machine: (x) => (x ? lookup(raw.machines, x) ?? x.slice(0, 8) : '—'), person: (x) => (x ? lookup(raw.people, x) ?? x.slice(0, 8) : '—') } }) : null;
    }
    return input;
}
export async function loadCockpit(id, src, nowIso) {
    return buildCockpit(id, await loadCockpitInput(id, src, nowIso));
}
const CSS = `
.kc{--hair:#1a2a46;--tx:#e9eef7;--mu:#8da0bd;--gold:#c9a24a;--ok:#5fd0a0;--risk:#e8b04a;--crit:#f0645a;--live:#5cc8e6;--unk:#7d8ba3;color:var(--tx);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13.5px;margin:0 0 18px;border:1px solid var(--hair);border-radius:14px;background:linear-gradient(180deg,#0f1a30,#0b1425);position:relative}
.kc::before{content:'';position:absolute;left:18px;top:-1px;width:56px;height:2px;background:var(--gold)}
.kc *{box-sizing:border-box}.kc summary{cursor:pointer;list-style:none;padding:14px 18px;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;min-height:44px}.kc summary::-webkit-details-marker{display:none}
.kc .eyebrow{font-size:12px;letter-spacing:.03em;color:var(--gold);font-weight:700}.kc h2{margin:0;font-size:15px;font-weight:600}.kc .mu{color:var(--mu);font-size:12px}
.kc .body{padding:0 18px 16px;display:flex;flex-direction:column;gap:14px}
.kc .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr));border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}
.kc .kp>a,.kc .kp>div{padding:10px 14px;border-left:1px solid var(--hair);text-decoration:none;color:inherit;min-width:0}.kc .kp>*:first-child{border-left:0;padding-left:0}
.kc .lab,.kc .v,.kc .q b,.kc .q span{overflow-wrap:anywhere}.kc .q a,.kc .q div.r{flex-wrap:wrap}.kc .lab{display:block;font-size:13px;color:var(--mu);font-weight:600;line-height:1.3}.kc .uk{display:none}
.kc .v{display:block;margin-top:3px;font-size:21px;font-weight:650;font-variant-numeric:tabular-nums}.kc .v.u{font-size:13px;color:var(--unk);font-weight:600}
.kc .red .v{color:var(--crit)}.kc .amber .v{color:var(--risk)}.kc .green .v{color:var(--ok)}.kc .blue .v{color:var(--live)}
.kc .cols{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:22px}.kc h3{margin:0 0 6px;font-size:14px;font-weight:650;color:var(--tx)}
.kc .q a,.kc .q div.r{display:flex;justify-content:space-between;gap:10px;padding:7px 0 7px 10px;border-left:3px solid var(--unk);border-bottom:1px solid var(--hair);text-decoration:none;color:inherit}
.kc .q .red{border-left-color:var(--crit)}.kc .q .amber{border-left-color:var(--risk)}.kc .q .blue{border-left-color:var(--live)}.kc .q .green{border-left-color:var(--ok)}
.kc .flow{display:flex;gap:0;flex-wrap:wrap}.kc .flow>div{flex:1 1 80px;padding:4px 12px;border-left:1px solid var(--hair)}.kc .flow>div:first-child{border-left:0;padding-left:0}.kc .flow b{display:block;font-size:18px;font-variant-numeric:tabular-nums}
.kc .links{display:flex;flex-wrap:wrap;gap:6px 16px}.kc .links a{color:var(--live);text-decoration:none;min-height:24px}.kc .unk{border:1px dashed var(--kmi-line2,#26385a);border-radius:10px;padding:8px 12px;color:var(--kmi-mut,var(--mu));font-size:13px}.kc details.unk summary{cursor:pointer;font-weight:700;color:var(--kmi-unknown,var(--mu))}.kc details.unk ul{margin:6px 0 0;padding-left:18px}.kc .v.u{font-size:14px;font-weight:700;color:var(--kmi-unknown,var(--mu))}
/* decision cards (Quality): urgency word + wait + id + decision + owner; the whole card opens the record */
.kc .dcs{display:flex;flex-direction:column;gap:8px}.kc .dc{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:12px;background:rgba(148,163,184,.1);border-left:4px solid var(--unk);text-decoration:none;color:inherit;min-height:44px}
.kc .dc.red{border-left-color:var(--crit)}.kc .dc.amber{border-left-color:var(--risk)}.kc .dc.blue{border-left-color:var(--live)}.kc .dc.green{border-left-color:var(--ok)}
.kc .dc-top{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}.kc .dc-pri{font-size:12px;font-weight:800;padding:1px 8px;border-radius:999px;border:1px solid currentColor}.kc .dc-pri.red{color:var(--crit)}.kc .dc-pri.amber{color:var(--risk)}.kc .dc-pri.blue{color:var(--live)}
.kc .dc-age{font-size:12.5px;color:var(--mu)}.kc .dc-id{font-size:15px;overflow-wrap:anywhere}.kc .dc-dec{font-size:13.5px}.kc .dc-det,.kc .dc-own{font-size:12.5px;overflow-wrap:anywhere}.kc .hint{margin:-2px 0 8px;font-size:12.5px}
.kc .kq{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.kc .kq a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;background:rgba(92,200,230,.14);color:var(--live);font-weight:700;text-decoration:none;font-size:14px}
.kc .kp>.na{display:none}.kc .kp:not(:has(>:not(.na))){display:none}
@media (max-width:900px){.kc .cols{grid-template-columns:minmax(0,1fr)}}
/* phone: decisions first, then the KPI strip, then the explanations (tasks/decisions are what the user opens the screen for) */
@media (max-width:700px){.kc{margin-bottom:12px}.kc summary{display:none}.kc::before{display:none}.kc .body{padding:0 14px 12px;gap:12px}.kc .body>*{order:5}.kc .cols{display:contents}.kc .cq{order:1}.kc .body>.kp{order:2}.kc .body>details.unk{order:3}.kc .cf{order:4}.kc .xl{order:6}
  .kc .kp{grid-template-columns:repeat(2,minmax(0,1fr));border:0;gap:8px}.kc .kp>a,.kc .kp>div{border:0;background:rgba(148,163,184,.1);border-radius:10px;padding:8px 12px}.kc .kp>*:first-child{padding-left:12px}.kc .v{font-size:24px}.kc .v.u{font-size:14px}}
@media (prefers-reduced-motion:reduce){.kc *{animation:none!important}}
`;
const tone = (t) => t;
const decisionCard = (x) => {
    const inner = [
        h('div', { class: 'dc-top' }, x.priority ? h('span', { class: `dc-pri ${x.tone}`, 'data-testid': 'kc-priority' }, x.priority) : null, x.age !== undefined ? h('span', { class: 'dc-age', 'data-testid': 'kc-age' }, x.age === null ? 'bekleme süresi kayıtlı değil' : `bekliyor: ${x.age}`) : null),
        h('b', { class: 'dc-id' }, x.label), h('span', { class: 'dc-dec' }, x.decision ? `Karar: ${x.decision}` : x.detail), x.decision ? h('span', { class: 'mu dc-det' }, x.detail) : null,
        x.owner !== undefined ? h('span', { class: 'mu dc-own', 'data-testid': 'kc-owner' }, x.owner ? `Sorumlu: ${x.owner}` : 'Sorumlu: kayıtta yok') : null
    ];
    return (x.href ? h('a', { href: x.href, class: `dc ${x.tone}`, 'data-testid': 'kc-queue-item' }, ...inner) : h('div', { class: `dc ${x.tone}`, 'data-testid': 'kc-queue-item' }, ...inner));
};
export function renderCockpit(host, d, o = {}) {
    const unknownKpis = d.kpis.filter((x) => x.value === null);
    const rich = !!d.queue && d.queue.some((x) => x.priority);
    const quick = (d.quick ?? []).filter((q) => !o.canOpen || o.canOpen(q.path));
    mount(host, h('details', { class: 'kc', open: true, 'data-testid': 'kc-root', 'data-id': d.id }, h('style', {}, CSS), h('summary', {}, h('span', { class: 'eyebrow' }, 'Kokpit'), h('h2', { 'data-testid': 'kc-title' }, d.title), h('span', { class: 'mu' }, `Sorumlu: ${d.owner}`)), h('div', { class: 'body' }, h('div', { class: 'kp', 'data-testid': 'kc-kpis' }, ...d.kpis.map((x) => {
        const inner = [h('span', { class: 'lab' }, x.label), x.value === null ? h('span', { class: 'v u', title: x.reason ?? '' }, h('span', { class: 'uk' }, 'UNKNOWN / '), 'VERİ GEREKLİ') : h('span', { class: 'v' }, String(x.value))];
        const cls = `${tone(x.tone)}${x.value === null ? ' na' : ''}`;
        return x.href ? h('a', { href: x.href, class: cls, 'data-testid': 'kc-kpi', 'data-key': x.key, 'data-tone': x.tone }, ...inner) : h('div', { class: cls, 'data-testid': 'kc-kpi', 'data-key': x.key, 'data-tone': x.tone }, ...inner);
    })), unknownKpis.length ? h('details', { class: 'unk', 'data-testid': 'kc-unknown' }, h('summary', {}, `Veri yok: ${unknownKpis.map((x) => x.label).join(', ')} — nedenleri göster`), h('ul', {}, ...unknownKpis.map((x) => h('li', {}, h('b', {}, x.label), `: ${x.reason}`)))) : null, h('div', { class: 'cols' }, h('div', { class: 'cq' }, h('h3', {}, d.queueTitle), o.hint ? h('div', { class: 'mu hint', 'data-testid': 'kc-hint' }, `Önce: ${o.hint}`) : null, d.queue === null ? h('div', { class: 'unk', 'data-testid': 'kc-queue-unknown' }, d.queueReason ?? 'kuyruk okunamadı')
        : d.queue.length === 0 ? h('div', { class: 'mu', 'data-testid': 'kc-queue-empty' }, 'Kayıtlara göre bekleyen iş yok. (Boş kuyruk "sorun yok" kanıtı değildir.)')
            : rich ? h('div', { class: 'dcs', 'data-testid': 'kc-queue' }, ...d.queue.map(decisionCard))
                : h('div', { class: 'q', 'data-testid': 'kc-queue' }, ...d.queue.map((x) => (x.href ? h('a', { href: x.href, class: x.tone, 'data-testid': 'kc-queue-item' }, h('b', {}, x.label), h('span', { class: 'mu' }, x.detail)) : h('div', { class: `r ${x.tone}`, 'data-testid': 'kc-queue-item' }, h('b', {}, x.label), h('span', { class: 'mu' }, x.detail))))), quick.length ? h('nav', { class: 'kq', 'aria-label': 'Hızlı erişim', 'data-testid': 'kc-quick' }, ...quick.map((q) => h('a', { href: q.href, title: q.why }, q.label))) : null), h('div', { class: 'cf' }, h('h3', {}, 'İş akışı'), h('div', { class: 'flow', 'data-testid': 'kc-flow' }, ...d.workflow.map((w) => h('div', {}, h('span', { class: 'mu' }, w.step), h('b', {}, w.count === null ? 'VERİ GEREKLİ' : String(w.count))))), d.risks.length ? h('div', { style: 'margin-top:10px' }, h('h3', {}, 'Riskler'), ...d.risks.slice(0, 4).map((r) => h('div', { class: 'mu', 'data-testid': 'kc-risk' }, r.href ? h('a', { href: r.href, style: 'color:inherit' }, r.text) : r.text))) : null)), d.quick ? null : h('div', {}, h('h3', {}, 'Yetkili eylemler (sunucu yetkiyi denetler)'), h('div', { class: 'mu' }, d.actions.join(' · '))), d.crossLinks.length ? h('div', { class: 'xl' }, h('h3', {}, 'Bağlantılı birimler'), h('div', { class: 'links', 'data-testid': 'kc-links' }, ...d.crossLinks.map((l) => h('a', { href: l.href, title: l.why }, `${l.label} →`)))) : null)));
}
export async function withCockpit(container, id, src, nowIso, renderScreen) {
    const top = h('div', { 'data-testid': 'kc-host' });
    const rest = h('div', { 'data-testid': 'kc-screen' });
    mount(container, h('div', {}, top, rest));
    void loadCockpit(id, src, nowIso).then((d) => { if (top.isConnected)
        renderCockpit(top, d); }).catch(() => { });
    await renderScreen(rest);
}
