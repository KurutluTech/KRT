// KMI NEXT — Toolroom screen (owner talimatı 2026-10-10, Öncelik 3). Same h()/JSX/
// full-re-render pattern as every other screen. Shows tool inventory with location, wear %,
// and mount/unmount/issue/return/scrap controls.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { computeToolWearPercent } from '../../../../packages/domain/src/toolroom.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS, kpi } from '../ds.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderToolroomScreen(container, deps, banner) {
    let tools = [];
    let loadError = null;
    try {
        tools = await deps.api.listTools();
    }
    catch (err) {
        loadError = errorText(err);
    }
    let events = [];
    let eventsError = null;
    if (deps.api.operatorEvents) {
        try {
            events = await deps.api.operatorEvents();
        }
        catch (err) {
            eventsError = errorText(err);
        }
    }
    const KIND_TR = { CHANGE: 'Değişim', BREAK: 'Kırıldı', WORN: 'Aşındı' };
    async function handleMount(toolId) {
        try {
            if (!deps.mountTargetMachineId)
                throw new Error('NO_MOUNT_TARGET_MACHINE_CONFIGURED');
            await deps.api.mount(toolId, deps.mountTargetMachineId);
            await renderToolroomScreen(container, deps, { kind: 'info', text: 'Takım makineye bağlandı.' });
        }
        catch (err) {
            await renderToolroomScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleUnmount(toolId) {
        try {
            await deps.api.unmount(toolId);
            await renderToolroomScreen(container, deps, { kind: 'info', text: 'Takım makineden çıkarıldı.' });
        }
        catch (err) {
            await renderToolroomScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleScrap(toolId) {
        try {
            await deps.api.scrap(toolId, 'Elle hurdaya ayrıldı');
            await renderToolroomScreen(container, deps, { kind: 'info', text: 'Takım hurdaya ayrıldı.' });
        }
        catch (err) {
            await renderToolroomScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const LOC_TR = { CABINET: ['Dolapta', 'ok'], MOUNTED: ['Makinede', 'info'], SCRAP: ['Hurda', 'bad'] };
    const wearOf = (t) => computeToolWearPercent(t.lifeMinutesUsed, t.lifeMinutesRated);
    const wearKind = (w) => (w >= 90 ? 'bad' : w >= 70 ? 'warn' : 'ok');
    const cab = tools.filter((t) => t.location === 'CABINET').length;
    const mnt = tools.filter((t) => t.location === 'MOUNTED').length;
    const worn = tools.filter((t) => t.location !== 'SCRAP' && wearOf(t) >= 80).length;
    const tb = (cls, testid, id, label, onClick) => h('button', { type: 'button', class: cls, 'data-testid': testid, 'data-tool-id': id, onClick }, label);
    const screen = (h("div", { class: "toolroom-screen kd" },
        h("style", null, DS_CSS + '.kd .trow{display:grid;grid-template-columns:minmax(120px,1fr) minmax(140px,1fr) auto;gap:12px;align-items:center}@media(max-width:700px){.kd .trow{grid-template-columns:1fr}}'),
        h("h1", { "data-testid": "toolroom-heading" }, "Tak\u0131m Odas\u0131"),
        banner ? (h("div", { class: `banner ${banner.kind}`, "data-testid": "toolroom-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { class: "banner error", "data-testid": "toolroom-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "kpis" },
                kpi('DOLAPTA', String(cab)),
                kpi('MAKİNEDE', String(mnt)),
                kpi('AŞINMA ≥ %80', String(worn))),
            h("div", { class: "panel", "data-testid": "tools-table" },
                h("h2", null, "Tak\u0131m envanteri"),
                h("div", { "data-testid": "tools-tbody" },
                    tools.length === 0 ? h("div", { class: "empty" }, "Kay\u0131tl\u0131 tak\u0131m yok.") : null,
                    tools.map((t) => {
                        const loc = LOC_TR[t.location] ?? [t.location, ''];
                        const w = wearOf(t);
                        return (h("div", { class: "item trow", "data-testid": "tool-row", "data-tool-id": t.id },
                            h("div", null,
                                h("b", { "data-testid": "tool-code" }, t.code),
                                h("div", { style: "margin-top:6px" },
                                    h("span", { class: `pill ${loc[1]}`, "data-testid": "tool-location", "data-code": t.location }, loc[0]))),
                            h("div", null,
                                h("div", { class: "mut" },
                                    "A\u015F\u0131nma: ",
                                    h("b", { "data-testid": "tool-wear-percent", "data-code": String(w) }, `%${w}`)),
                                h("div", { class: "bar", style: "margin-top:6px" },
                                    h("i", { style: `width:${Math.min(100, Math.max(0, Number(w) || 0))}%;background:${w >= 90 ? '#dc2626' : w >= 70 ? '#d97706' : '#22c55e'}` }))),
                            h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
                                t.location === 'CABINET' ? tb('primary', 'mount-btn', t.id, 'Makineye Bağla', () => handleMount(t.id)) : null,
                                t.location === 'MOUNTED' ? tb('warnb', 'unmount-btn', t.id, 'Makineden Çıkar', () => handleUnmount(t.id)) : null,
                                t.location !== 'SCRAP' ? tb('danger', 'scrap-btn', t.id, 'Hurdaya Ayır', () => handleScrap(t.id)) : null)));
                    }))))),
        deps.api.operatorEvents ? (h("div", { class: "panel", "data-testid": "operator-events" },
            h("h2", null, "Operat\u00F6r tak\u0131m bildirimleri (son 7 g\u00FCn)"),
            eventsError ? h("div", { class: "banner error", "data-testid": "operator-events-error" }, eventsError) : null,
            !eventsError && events.length === 0 ? h("div", { class: "empty", "data-testid": "operator-events-empty" }, "Bildirim yok.") : null,
            events.map((e) => (h("div", { class: "item", "data-testid": "operator-event", "data-kind": e.kind }, `${new Date(e.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · ${e.machineCode} · ${e.toolCode}${e.toolKnown ? '' : ' (kayıtlı değil)'} · ${KIND_TR[e.kind]} · ${e.operatorName}${e.note ? ` — ${e.note}` : ''}`))))) : null));
    mount(container, screen);
}
