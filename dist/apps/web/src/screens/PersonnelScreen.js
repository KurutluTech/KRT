// KMI NEXT — Frozen Master Item 31 screen: Personnel/Capability. Same h()/JSX/full-re-render
// pattern as the other screens.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { classifySkillTier } from '../../../../packages/domain/src/personnel.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderPersonnelScreen(container, deps, banner) {
    let people = [];
    let loadError = null;
    try {
        people = await deps.api.list();
    }
    catch (err) {
        loadError = errorText(err);
    }
    const nameInput = h('input', { type: 'text', 'data-testid': 'person-name-input' });
    async function handleCreate(e) {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
            await renderPersonnelScreen(container, deps, { kind: 'error', text: 'İsim zorunludur.' });
            return;
        }
        try {
            await deps.api.create(name, ['OPERATOR'], 'URETIM', 1);
            await renderPersonnelScreen(container, deps, { kind: 'info', text: 'Personel oluşturuldu.' });
        }
        catch (err) {
            await renderPersonnelScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleToggleActive(personId, currentActive) {
        try {
            await deps.api.setActive(personId, !currentActive);
            await renderPersonnelScreen(container, deps, { kind: 'info', text: 'Personel durumu güncellendi.' });
        }
        catch (err) {
            await renderPersonnelScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = (h("div", { class: "personnel-screen" },
        h("h1", { "data-testid": "personnel-heading" }, "Personel / Kabiliyet"),
        banner ? (h("div", { "data-testid": "personnel-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { "data-testid": "personnel-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("form", { "data-testid": "create-person-form", onSubmit: handleCreate },
                nameInput,
                h("button", { type: "submit", "data-testid": "create-person-btn" }, "Personel Ekle")),
            h("table", { "data-testid": "personnel-table" },
                h("tbody", { "data-testid": "personnel-tbody" }, people.map((person) => (h("tr", { "data-testid": "person-row", "data-person-id": person.id },
                    h("td", { "data-testid": "person-name" }, person.name),
                    h("td", { "data-testid": "person-active" }, String(person.active)),
                    h("td", { "data-testid": "person-skill-tier" }, classifySkillTier(person.skills.length)),
                    h("td", null, h('button', {
                        type: 'button',
                        'data-testid': 'toggle-active-btn',
                        'data-person-id': person.id,
                        onClick: () => handleToggleActive(person.id, person.active),
                    }, person.active ? 'Pasife Al' : 'Aktif Et')))))))))));
    mount(container, screen);
}
