// KMI — Yeni makine ekle (m0219): katalogdan tip/alt tip/kabiliyet; kayıt sunucuda yetki + denetim ile (machine_create).
import { mount } from '../../../../packages/ui/src/h.js';
import { h } from '../../../../packages/ui/src/h.js';
import { renderMachineCreateForm, renderCatalogPanel } from '../machineTypeUi.js';
export async function renderMachineCreateScreen(container, deps) {
    const host = h('div', { class: 'kx', 'data-testid': 'mc-screen' });
    mount(container, host);
    const f = h('div'); const c = h('div'); host.append(f, c);
    await renderMachineCreateForm(f, deps.io, deps.access, () => { void renderCatalogPanel(c, deps.io, deps.access, () => { void renderMachineCreateForm(f, deps.io, deps.access); }); });
    await renderCatalogPanel(c, deps.io, deps.access, () => { void renderMachineCreateForm(f, deps.io, deps.access); });
}
