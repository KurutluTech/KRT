// KMI NEXT — Toolroom screen (owner talimatı 2026-10-10, Öncelik 3). Same h()/JSX/
// full-re-render pattern as every other screen. Shows tool inventory with location, wear %,
// and mount/unmount/issue/return/scrap controls.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { computeToolWearPercent } from '../../../../packages/domain/src/toolroom.js';
import { errorText as sharedErrorText } from '../errorText.js';
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
    const screen = (h("div", { class: "toolroom-screen" },
        h("h1", { "data-testid": "toolroom-heading" }, "Tak\u0131m Odas\u0131"),
        banner ? (h("div", { "data-testid": "toolroom-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { "data-testid": "toolroom-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h("table", { "data-testid": "tools-table" },
            h("tbody", { "data-testid": "tools-tbody" }, tools.map((t) => (h("tr", { "data-testid": "tool-row", "data-tool-id": t.id },
                h("td", { "data-testid": "tool-code" }, t.code),
                h("td", { "data-testid": "tool-location" }, t.location),
                h("td", { "data-testid": "tool-wear-percent" }, String(computeToolWearPercent(t.lifeMinutesUsed, t.lifeMinutesRated))),
                h("td", null,
                    t.location === 'CABINET'
                        ? h('button', { type: 'button', 'data-testid': 'mount-btn', 'data-tool-id': t.id, onClick: () => handleMount(t.id) }, 'Makineye Bağla')
                        : null,
                    t.location === 'MOUNTED'
                        ? h('button', { type: 'button', 'data-testid': 'unmount-btn', 'data-tool-id': t.id, onClick: () => handleUnmount(t.id) }, 'Makineden Çıkar')
                        : null,
                    t.location !== 'SCRAP'
                        ? h('button', { type: 'button', 'data-testid': 'scrap-btn', 'data-tool-id': t.id, onClick: () => handleScrap(t.id) }, 'Hurdaya Ayır')
                        : null))))))),
        deps.api.operatorEvents ? (h("div", { "data-testid": "operator-events" },
            h("h2", null, "Operat\u00F6r tak\u0131m bildirimleri (son 7 g\u00FCn)"),
            eventsError ? h("div", { "data-testid": "operator-events-error" }, eventsError) : null,
            !eventsError && events.length === 0 ? h("div", { "data-testid": "operator-events-empty" }, "Bildirim yok.") : null,
            events.map((e) => (h("div", { "data-testid": "operator-event", "data-kind": e.kind }, `${new Date(e.at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · ${e.machineCode} · ${e.toolCode}${e.toolKnown ? '' : ' (kayıtlı değil)'} · ${KIND_TR[e.kind]} · ${e.operatorName}${e.note ? ` — ${e.note}` : ''}`))))) : null));
    mount(container, screen);
}
