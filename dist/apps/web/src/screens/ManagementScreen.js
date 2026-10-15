// KMI-MANAGEMENT-001 — Yönetim Zekâsı (üst yönetim ekranı). Sekmeler dokuz alandır; her sekme yalnız KMI'nin gerçek kaynaklarından beslenir. Veri kaynağı olmayan
// sekme sahte veri göstermez: "BİLİNMİYOR / VERİ GEREKLİ" ve neyin eksik olduğunu söyler.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { DS_CSS } from '../ds.js';
import { renderApprovalsTab } from './ApprovalsTab.js';
export async function renderManagementScreen(container, deps, opts = {}) {
    const tabs = [...(deps.leadTabs ?? []), { id: 'onaylar', label: 'Onaylar', render: (p) => renderApprovalsTab(p, deps.approvals) }, ...(deps.extraTabs ?? [])];
    let current = tabs.find((t) => t.id === opts.tab) ?? tabs[0];
    const body = h('div', { 'data-testid': 'mg-body' });
    const bar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Yönetim sekmeleri', 'data-testid': 'mg-tabs' });
    const draw = async () => {
        bar.replaceChildren(...tabs.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(t.id === current.id), class: t.id === current.id ? 'on' : '', 'data-testid': `mg-tab-${t.id}`,
            onClick: () => { current = t; void draw(); } }, t.label)));
        await current.render(body);
    };
    mount(container, h('div', { class: 'kd', 'data-testid': 'mg-root' }, h('style', {}, DS_CSS), h('h1', {}, opts.only ? current.label : 'Yönetim Zekâsı'), opts.only ? null : bar, body));
    await draw();
}
