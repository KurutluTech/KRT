// KMI NEXT — Toolroom screen (owner talimatı 2026-10-10, Öncelik 3). Same h()/JSX/
// full-re-render pattern as every other screen. Shows tool inventory with location, wear %,
// and mount/unmount/issue/return/scrap controls.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { computeToolWearPercent } from '../../../../packages/domain/src/toolroom.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
import { KX_CSS, card, chip as kchip, emptyState } from '../kx.js';
import { drawToolistWork } from './toolistWorkPanel.js';
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
    let lists = [];
    let listsError = null;
    if (deps.lists) {
        try {
            lists = await deps.lists.load();
        }
        catch (err) {
            listsError = errorText(err);
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
    const STATE_LIST_TR = { DRAFT: ['Taslak', 'info'], IN_REVIEW: ['Onay bekliyor', 'warn'], APPROVED: ['Onaylandı — yürürlükte değil', 'warn'], EFFECTIVE: ['Yürürlükte', 'ok'], SUPERSEDED: ['Eski sürüm', 'off'], REJECTED: ['Reddedildi', 'bad'] };
    const listsSection = () => {
        if (!deps.lists)
            return null;
        const pw = deps.lists.pw;
        const host = h('div', { 'data-testid': 'tr-lists' });
        const q = h('input', { type: 'search', 'data-testid': 'tr-search', placeholder: 'Ara: ürün kodu, doküman no, takım tipi…', 'aria-label': 'Ara' });
        const rowsHost = h('div', { class: 'stack', 'data-testid': 'tr-list-rows' });
        const openWork = async (e, work, btn) => {
            if (work.childElementCount) {
                work.replaceChildren();
                return;
            }
            btn.disabled = true;
            try {
                if (!e.revisionId)
                    throw new Error('Bu takım listesi bir ürün revizyonuna bağlı değil.');
                const ov = await pw.toolistOverview(e.revisionId);
                const d = ov.documents.find((x) => x.docNo === e.docNo) ?? ov.documents[0];
                const v = d?.versions.slice().sort((a, b) => b.versionNo - a.versionNo)[0];
                if (!v)
                    throw new Error('Takım listesi sürümü bulunamadı.');
                const load = async () => drawToolistWork(work, pw, { versionId: v.versionId, fileName: v.fileName, versionState: v.state, showErr: (er) => work.prepend(h('div', { class: 'banner bad', role: 'alert' }, errorText(er))),
                    onChanged: async (m) => { await load(); work.prepend(h('div', { class: 'banner ok', role: 'status', 'data-testid': 'tr-saved' }, m)); } });
                await load();
            }
            catch (er) {
                work.replaceChildren(h('div', { class: 'banner bad', role: 'alert', 'data-testid': 'tr-open-error' }, errorText(er)));
            }
            finally {
                btn.disabled = false;
            }
        };
        const draw = () => {
            const t = q.value.trim().toLocaleLowerCase('tr-TR');
            const shown = lists.filter((e) => !t || [e.docNo, e.title, e.productCode ?? '', e.productName ?? ''].join(' ').toLocaleLowerCase('tr-TR').includes(t));
            rowsHost.replaceChildren(...(shown.length ? shown.map((e) => {
                const st = STATE_LIST_TR[e.state ?? ''] ?? [e.state ?? '—', 'off'];
                const work = h('div', { 'data-testid': 'tr-work' });
                const btn = h('button', { type: 'button', class: 'primary', 'data-testid': 'tr-open', onClick: () => void openWork(e, work, btn) }, 'Takım bilgisini tamamla / düzenle');
                return h('div', { class: 'kx-sub', 'data-testid': 'tr-list', 'data-doc': e.docNo }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('b', { style: 'color:#fff' }, e.productCode ? `${e.productCode}` : e.title), h('span', { class: 'mut' }, ` ${e.productName ?? ''}${e.revision ? ` · Rev ${e.revision}` : ''} · ${e.docNo}${e.versionNo ? ` v${e.versionNo}` : ''}${e.opLinks.length ? ` · operasyon ${e.opLinks.map((n) => `OP${n}`).join(', ')}` : ''}`)), kchip(st[0], st[1])), h('div', { class: 'row', style: 'margin-top:8px' }, btn, e.productId ? h('a', { class: 'btn ghost', href: `#/urun-calisma?urun=${e.productId}`, 'data-testid': 'tr-open-product' }, 'Ürün çalışma alanı →') : null, h('span', { class: 'mut' }, 'Excel\'den gelen veri hazır okunur; yalnız eksikleri tamamlarsınız.')), work);
            }) : [emptyState(lists.length ? 'Aramaya uyan takım listesi yok' : 'Henüz takım listesi dokümanı yok', lists.length ? 'Aramayı değiştirin.' : 'Takım listesi (Excel) bir ürün revizyonuna yüklenince burada görünür.', 'tr-lists-empty')]));
        };
        q.addEventListener('input', draw);
        host.append(card({ title: 'Ürün takım listeleri', testid: 'tr-card-lists', chip: kchip(`${lists.length} liste`, 'off'),
            actions: [h('a', { class: 'btn ghost sm', href: '#/dokuman-kontrol', 'data-testid': 'tr-to-control' }, 'Teknik onay / yürürlük: Doküman Kontrol →')] }, h('div', { class: 'mut', style: 'margin-bottom:8px' }, 'Günlük iş: eksik takım bilgisini (çap, boy, tutucu, offset) tamamlamak. Teknik onay ve yürürlüğe alma ayrı bir işlemdir ve burada yapılmaz.'), h('div', { class: 'row', style: 'margin-bottom:10px' }, h('div', { class: 'grow' }, q)), listsError ? h('div', { class: 'banner bad', 'data-testid': 'tr-lists-error' }, `Takım listeleri yüklenemedi: ${listsError}`) : null, rowsHost));
        draw();
        return h('div', { class: 'kx', style: 'padding:0;max-width:none' }, h('style', {}, KX_CSS), host);
    };
    const listsNode = listsSection();
    const screen = (h("div", { class: "toolroom-screen kd" },
        h("style", null, DS_CSS + '.kd .trow{display:grid;grid-template-columns:minmax(120px,1fr) minmax(140px,1fr) auto;gap:12px;align-items:center}@media(max-width:700px){.kd .trow{grid-template-columns:1fr}}'),
        h("h1", { "data-testid": "toolroom-heading" }, "Tak\u0131m Odas\u0131"),
        listsNode,
        banner ? (h("div", { class: `banner ${banner.kind}`, "data-testid": "toolroom-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { class: "banner error", "data-testid": "toolroom-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "panel", "data-testid": "tools-table" },
                h("h2", null, "Fiziksel tak\u0131m envanteri (dolap \u00B7 makine)"),
                h("div", { "data-testid": "tools-tbody" },
                    tools.length === 0 ? h("div", { class: "empty" }, "Kay\u0131tl\u0131 fiziksel tak\u0131m yok. \u00DCr\u00FCn tak\u0131m listesindeki tan\u0131mlar yukar\u0131dad\u0131r; fiziksel tak\u0131m sto\u011Fu ayr\u0131 tutulur.") : null,
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
