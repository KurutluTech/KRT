// KMI NEXT — Frozen Master Item 31 screen: Personnel/Capability. Same h()/JSX/full-re-render
// pattern as the other screens.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { classifySkillTier } from '../../../../packages/domain/src/personnel.js';
import { DS_CSS, kpi, initials, ROLE_TR, DEPT_TR, TIER_TR } from '../ds.js';
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
    const roleSel = h('select', { 'data-testid': 'person-role-select' }, ...Object.entries(ROLE_TR).filter(([k]) => k !== 'ADMIN').map(([v, t]) => h('option', { value: v, selected: v === 'OPERATOR' ? 'selected' : undefined }, t)));
    const deptSel = h('select', { 'data-testid': 'person-dept-select' }, ...Object.entries(DEPT_TR).map(([v, t]) => h('option', { value: v, selected: v === 'URETIM' ? 'selected' : undefined }, t)));
    async function create2(e) {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
            await renderPersonnelScreen(container, deps, { kind: 'error', text: 'İsim zorunludur.' });
            return;
        }
        try {
            await deps.api.create(name, [roleSel.value], deptSel.value, 1);
            await renderPersonnelScreen(container, deps, { kind: 'info', text: 'Personel oluşturuldu.' });
        }
        catch (err) {
            await renderPersonnelScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const activeCount = people.filter((p) => p.active).length;
    const byDept = new Map();
    for (const p of people.filter((x) => x.active))
        byDept.set(p.department, (byDept.get(p.department) ?? 0) + 1);
    const row = (person) => (h("div", { class: "item", "data-testid": "person-row", "data-person-id": person.id },
        h("div", { class: "avatar", "aria-hidden": "true" }, initials(person.name)),
        h("div", { class: "grow" },
            h("strong", { "data-testid": "person-name" }, person.name),
            h("div", { class: "mut" },
                person.roles.map((r) => ROLE_TR[r] ?? r).join(', '),
                " \u00B7 ",
                DEPT_TR[person.department] ?? person.department)),
        h("span", { "data-testid": "person-skill-tier", "data-tier": classifySkillTier(person.skills.length), class: "pill gold" },
            TIER_TR[classifySkillTier(person.skills.length)],
            " \u00B7 ",
            person.skills.length,
            " yetkinlik"),
        h("span", { "data-testid": "person-active", "data-active": String(person.active), class: `pill ${person.active ? 'ok' : 'warn'}` }, person.active ? 'Aktif' : 'Pasif'),
        h('button', { type: 'button', class: person.active ? 'ghost' : 'okb', 'data-testid': 'toggle-active-btn', 'data-person-id': person.id, onClick: () => handleToggleActive(person.id, person.active) }, person.active ? 'Pasife Al' : 'Aktif Et')));
    const screen = (h("div", { class: "kd personnel-screen" },
        h("style", null, DS_CSS),
        h("div", { class: "head" },
            h("h1", { class: "grow", "data-testid": "personnel-heading" }, "Personel / Kabiliyet")),
        banner ? h("div", { class: `banner ${banner.kind}`, "data-testid": "personnel-banner", "data-kind": banner.kind }, banner.text) : null,
        loadError ? (h("div", { class: "panel", "data-testid": "personnel-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "kpis", "data-testid": "personnel-kpis" },
                kpi('Toplam', String(people.length)),
                kpi('Aktif', String(activeCount), 'personnel-k-active'),
                kpi('Pasif', String(people.length - activeCount)),
                [...byDept.entries()].map(([d, n]) => kpi(DEPT_TR[d] ?? d, String(n)))),
            h("section", { class: "panel" },
                h("h2", null, "Yeni personel"),
                h("form", { "data-testid": "create-person-form", class: "head", onSubmit: create2 },
                    nameInput,
                    roleSel,
                    deptSel,
                    h("button", { type: "submit", class: "primary", "data-testid": "create-person-btn" }, "Personel Ekle")),
                h("div", { class: "mut", style: "margin-top:6px" }, "Giri\u015F hesab\u0131, sicil/PIN ve vardiya \u201CPersonel Eri\u015Fimi\u201D ekran\u0131ndan y\u00F6netilir.")),
            h("section", { class: "panel", "data-testid": "personnel-table" },
                h("h2", null,
                    "Personel (",
                    people.length,
                    ")"),
                h("div", { "data-testid": "personnel-tbody" }, people.length ? people.map(row) : h("div", { class: "empty" }, "Personel kayd\u0131 yok.")))))));
    mount(container, screen);
}
