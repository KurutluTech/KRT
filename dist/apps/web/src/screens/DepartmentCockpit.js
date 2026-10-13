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
const NEEDS = {
    PRODUCTION: ['snapshot'], PLANNING: ['snapshot', 'board'], CAM: ['snapshot', 'eng'], QUALITY: ['snapshot', 'workOrders'], TOOLROOM: ['tools'], MAINTENANCE: ['snapshot', 'tickets'],
    WAREHOUSE: ['snapshot', 'lots'], PURCHASING: ['snapshot', 'pos', 'poLines'], SHIPPING: ['snapshot', 'lots'], ACCOUNTING: ['snapshot'], PERSONNEL: ['personnel'],
};
export function liveCockpitSources(c, s) {
    const hub = createWorkOrderHubApi(c, s), pur = createPurchasingApi(c, s);
    return {
        snapshot: () => createCommandCenterApi(c, s).snapshot(), workOrders: () => hub.list(), lots: () => createDepartmentApi(c, s, hub).stockLots(), board: () => createPlanningApi(c, s).board(),
        eng: () => createEngineeringApi(c, s).load(), tools: () => createToolroomApi(c, s).listTools(), tickets: () => createMaintenanceApi(c, s).listTickets(),
        pos: () => pur.listPurchaseOrders(), poLines: () => pur.listLines(), personnel: () => createPersonnelApi(c, s).list(),
    };
}
const attempt = async (f) => { if (!f)
    return null; try {
    return await f();
}
catch {
    return null;
} };
export async function loadCockpit(id, src, nowIso) {
    const keys = NEEDS[id];
    const vals = await Promise.all(keys.map((k) => attempt(src[k])));
    const input = { nowIso, snapshot: null };
    keys.forEach((k, i) => { input[k] = vals[i]; });
    return buildCockpit(id, input);
}
const CSS = `
.kc{--hair:#1a2a46;--tx:#e9eef7;--mu:#8da0bd;--gold:#c9a24a;--ok:#5fd0a0;--risk:#e8b04a;--crit:#f0645a;--live:#5cc8e6;--unk:#7d8ba3;color:var(--tx);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13.5px;margin:0 0 18px;border:1px solid var(--hair);border-radius:14px;background:linear-gradient(180deg,#0f1a30,#0b1425);position:relative}
.kc::before{content:'';position:absolute;left:18px;top:-1px;width:56px;height:2px;background:var(--gold)}
.kc *{box-sizing:border-box}.kc summary{cursor:pointer;list-style:none;padding:14px 18px;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;min-height:44px}.kc summary::-webkit-details-marker{display:none}
.kc .eyebrow{font-size:10.5px;letter-spacing:.2em;color:var(--gold);font-weight:700;text-transform:uppercase}.kc h2{margin:0;font-size:15px;font-weight:600}.kc .mu{color:var(--mu);font-size:12px}
.kc .body{padding:0 18px 16px;display:flex;flex-direction:column;gap:14px}
.kc .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr));border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}
.kc .kp>a,.kc .kp>div{padding:10px 14px;border-left:1px solid var(--hair);text-decoration:none;color:inherit;min-width:0}.kc .kp>*:first-child{border-left:0;padding-left:0}
.kc .lab,.kc .v,.kc .q b,.kc .q span{overflow-wrap:anywhere}.kc .q a,.kc .q div.r{flex-wrap:wrap}.kc .lab{display:block;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mu);font-weight:700;line-height:1.3}
.kc .v{display:block;margin-top:3px;font-size:21px;font-weight:650;font-variant-numeric:tabular-nums}.kc .v.u{font-size:12px;color:var(--unk);font-weight:600;letter-spacing:.02em}
.kc .red .v{color:var(--crit)}.kc .amber .v{color:var(--risk)}.kc .green .v{color:var(--ok)}.kc .blue .v{color:var(--live)}
.kc .cols{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:22px}.kc h3{margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mu)}
.kc .q a,.kc .q div.r{display:flex;justify-content:space-between;gap:10px;padding:7px 0 7px 10px;border-left:3px solid var(--unk);border-bottom:1px solid var(--hair);text-decoration:none;color:inherit}
.kc .q .red{border-left-color:var(--crit)}.kc .q .amber{border-left-color:var(--risk)}.kc .q .blue{border-left-color:var(--live)}.kc .q .green{border-left-color:var(--ok)}
.kc .flow{display:flex;gap:0;flex-wrap:wrap}.kc .flow>div{flex:1 1 80px;padding:4px 12px;border-left:1px solid var(--hair)}.kc .flow>div:first-child{border-left:0;padding-left:0}.kc .flow b{display:block;font-size:18px;font-variant-numeric:tabular-nums}
.kc .links{display:flex;flex-wrap:wrap;gap:6px 16px}.kc .links a{color:var(--live);text-decoration:none;min-height:24px}.kc .unk{border:1px dashed #26385a;border-radius:8px;padding:8px 10px;color:var(--mu);font-size:12.5px}
@media (max-width:900px){.kc .cols{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){.kc *{animation:none!important}}
`;
const tone = (t) => t;
export function renderCockpit(host, d) {
    mount(host, h('details', { class: 'kc', open: true, 'data-testid': 'kc-root', 'data-id': d.id }, h('style', {}, CSS), h('summary', {}, h('span', { class: 'eyebrow' }, 'Kokpit'), h('h2', { 'data-testid': 'kc-title' }, d.title), h('span', { class: 'mu' }, `Sorumlu: ${d.owner}`)), h('div', { class: 'body' }, h('div', { class: 'kp', 'data-testid': 'kc-kpis' }, ...d.kpis.map((x) => {
        const inner = [h('span', { class: 'lab' }, x.label), x.value === null ? h('span', { class: 'v u', title: x.reason ?? '' }, 'UNKNOWN / VERİ GEREKLİ') : h('span', { class: 'v' }, String(x.value))];
        return x.href ? h('a', { href: x.href, class: tone(x.tone), 'data-testid': 'kc-kpi', 'data-key': x.key, 'data-tone': x.tone }, ...inner) : h('div', { class: tone(x.tone), 'data-testid': 'kc-kpi', 'data-key': x.key, 'data-tone': x.tone }, ...inner);
    })), d.kpis.some((x) => x.value === null) ? h('div', { class: 'unk', 'data-testid': 'kc-unknown' }, d.kpis.filter((x) => x.value === null).map((x) => `${x.label}: ${x.reason}`).join(' · ')) : null, h('div', { class: 'cols' }, h('div', {}, h('h3', {}, d.queueTitle), d.queue === null ? h('div', { class: 'unk', 'data-testid': 'kc-queue-unknown' }, d.queueReason ?? 'kuyruk okunamadı')
        : d.queue.length === 0 ? h('div', { class: 'mu', 'data-testid': 'kc-queue-empty' }, 'Kayıtlara göre bekleyen iş yok. (Boş kuyruk "sorun yok" kanıtı değildir.)')
            : h('div', { class: 'q', 'data-testid': 'kc-queue' }, ...d.queue.map((x) => (x.href ? h('a', { href: x.href, class: x.tone, 'data-testid': 'kc-queue-item' }, h('b', {}, x.label), h('span', { class: 'mu' }, x.detail)) : h('div', { class: `r ${x.tone}`, 'data-testid': 'kc-queue-item' }, h('b', {}, x.label), h('span', { class: 'mu' }, x.detail)))))), h('div', {}, h('h3', {}, 'İş akışı'), h('div', { class: 'flow', 'data-testid': 'kc-flow' }, ...d.workflow.map((w) => h('div', {}, h('span', { class: 'mu' }, w.step), h('b', {}, w.count === null ? 'VERİ GEREKLİ' : String(w.count))))), d.risks.length ? h('div', { style: 'margin-top:10px' }, h('h3', {}, 'Riskler'), ...d.risks.slice(0, 4).map((r) => h('div', { class: 'mu', 'data-testid': 'kc-risk' }, r.href ? h('a', { href: r.href, style: 'color:inherit' }, r.text) : r.text))) : null)), h('div', {}, h('h3', {}, 'Yetkili eylemler (sunucu yetkiyi denetler)'), h('div', { class: 'mu' }, d.actions.join(' · '))), h('div', {}, h('h3', {}, 'Bağlantılı birimler'), h('div', { class: 'links', 'data-testid': 'kc-links' }, ...d.crossLinks.map((l) => h('a', { href: l.href, title: l.why }, `${l.label} →`)))))));
}
/** Wraps an existing department screen: the cockpit loads on its own and never delays or breaks the screen below it. */
export async function withCockpit(container, id, src, nowIso, renderScreen) {
    const top = h('div', { 'data-testid': 'kc-host' });
    const rest = h('div', { 'data-testid': 'kc-screen' });
    mount(container, h('div', {}, top, rest));
    void loadCockpit(id, src, nowIso).then((d) => { if (top.isConnected)
        renderCockpit(top, d); }).catch(() => { });
    await renderScreen(rest);
}
