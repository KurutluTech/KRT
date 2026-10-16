// KMI NEXT — Frozen Master Item 31 screen: Personnel/Capability. Same h()/JSX/full-re-render
// pattern as the other screens.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { classifySkillTier } from '../../../../packages/domain/src/personnel.js';
import { DS_CSS, kpi, initials, ROLE_TR, DEPT_TR, TIER_TR } from '../ds.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderPersonnelScreen(container, deps, banner, ui = {}) {
    const life = !!(deps.api.terminate && deps.api.updateProfile && deps.api.createFull);
    const again = (b, u = {}) => renderPersonnelScreen(container, deps, b, u);
    if (life && ui.suggested === undefined) {
        try {
            ui = { ...ui, suggested: await deps.api.suggestEmployeeNo() };
        }
        catch {
            ui = { ...ui, suggested: '' };
        }
    }
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
    const noInput = h('input', { type: 'text', 'data-testid': 'person-no-input', placeholder: 'Sicil no', value: ui.suggested ?? '', style: 'max-width:110px' });
    const shiftIn = h('input', { type: 'text', 'data-testid': 'person-shift-input', placeholder: 'Vardiya (örn. TeamK1)', style: 'max-width:170px' });
    async function create2(e) {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
            await renderPersonnelScreen(container, deps, { kind: 'error', text: 'İsim zorunludur.' });
            return;
        }
        try {
            if (life) {
                const no = noInput.value.trim() || null;
                const sh = shiftIn.value.trim() || null;
                const p = await deps.api.createFull(name, [roleSel.value], deptSel.value, no, sh);
                await again({ kind: 'info', text: `Personel oluşturuldu. Sicil: ${p.employeeNo ?? no ?? '—'}` });
                return;
            }
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
        life ? h("span", { class: "mut", "data-testid": "person-meta" },
            "Sicil ",
            person.employeeNo ?? '—',
            " \u00B7 ",
            person.shiftCode ?? 'vardiya yok') : null,
        life && person.active ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'edit-person-btn', 'data-person-id': person.id, onClick: () => again(undefined, { ...ui, edit: person.id }) }, 'Düzenle') : null,
        life && person.active ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'terminate-btn', 'data-person-id': person.id, onClick: async () => { let pv = null; let er; try {
                pv = await deps.api.offboardingPreview(person.id);
            }
            catch (err) {
                er = errorText(err);
            } await again(undefined, { ...ui, term: { id: person.id, preview: pv, ...(er ? { error: er } : {}) } }); } }, 'Görevden Çıkar') : null,
        life && !person.active ? h('button', { type: 'button', class: 'okb', 'data-testid': 'reactivate-btn', 'data-person-id': person.id, onClick: () => again(undefined, { ...ui, react: person.id }) }, 'Yeniden Aktif Et') : null,
        !life ? h('button', { type: 'button', class: person.active ? 'ghost' : 'okb', 'data-testid': 'toggle-active-btn', 'data-person-id': person.id, onClick: () => handleToggleActive(person.id, person.active) }, person.active ? 'Pasife Al' : 'Aktif Et') : null));
    const panel = () => {
        const reason = h('input', { type: 'text', 'data-testid': 'lifecycle-reason', placeholder: 'Gerekçe (en az 5 karakter)', style: 'min-width:220px' });
        if (ui.edit) {
            const p = people.find((x) => x.id === ui.edit);
            if (!p)
                return null;
            const nm = h('input', { type: 'text', value: p.name, 'data-testid': 'edit-name' });
            const rl = h('select', { 'data-testid': 'edit-role' }, ...Object.entries(ROLE_TR).filter(([k]) => k !== 'ADMIN' || p.roles.includes('ADMIN')).map(([v, t]) => h('option', { value: v, selected: p.roles[0] === v ? 'selected' : undefined }, t)));
            const dp = h('select', { 'data-testid': 'edit-dept' }, ...Object.entries(DEPT_TR).map(([v, t]) => h('option', { value: v, selected: p.department === v ? 'selected' : undefined }, t)));
            const sh = h('input', { type: 'text', value: p.shiftCode ?? '', placeholder: 'Vardiya', 'data-testid': 'edit-shift', style: 'max-width:120px' });
            const no = h('input', { type: 'text', value: p.employeeNo ?? '', placeholder: 'Sicil', 'data-testid': 'edit-no', style: 'max-width:110px' });
            return h('section', { class: 'panel', 'data-testid': 'edit-panel' }, h('h2', {}, `Düzenle: ${p.name}`), h('div', { class: 'head' }, nm, rl, dp, sh, no, reason, h('button', { type: 'button', class: 'primary', 'data-testid': 'edit-save', onClick: async () => { try {
                    await deps.api.updateProfile(p.id, { name: nm.value, roles: [rl.value], department: dp.value, shiftCode: sh.value.trim() || null, employeeNo: no.value.trim() || null, reason: reason.value });
                    await again({ kind: 'info', text: 'Personel bilgileri güncellendi.' });
                }
                catch (err) {
                    await again({ kind: 'error', text: errorText(err) }, ui);
                } } }, 'Kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => again(undefined, {}) }, 'Vazgeç')), h('div', { class: 'mut' }, 'Bu işlem personel kaydını düzeltir; giriş hesabının rollerini değiştirmez.'));
        }
        if (ui.term) {
            const p = people.find((x) => x.id === ui.term.id);
            if (!p)
                return null;
            const pv = ui.term.preview;
            const ack = h('input', { type: 'checkbox', 'data-testid': 'term-ack' });
            return h('section', { class: 'panel', 'data-testid': 'term-panel' }, h('h2', {}, `Görevden çıkar: ${p.name}`), ui.term.error ? h('div', { class: 'banner error' }, ui.term.error) : null, pv ? h('div', { 'data-testid': 'term-preview' }, `Açık görev: ${pv.openTasks} · Makinede çalışan operasyon: ${pv.machineSessions} · Bekleyen onay: ${pv.pendingApprovals} · Zimmetli takım: ${pv.toolsOnLoan}`) : null, pv && pv.blockers > 0 ? h('label', { class: 'mut' }, ack, ' Açık işleri biliyorum; yine de çıkar (kayıtlar silinmez, devredilmesi gerekir)') : null, h('div', { class: 'mut' }, 'Giriş, PIN ve kart erişimi hemen kapanır. Üretim, kalite, puantaj ve onay geçmişi bu kişiye bağlı olarak korunur. Kayıt silinmez; sonradan yeniden aktif edilebilir.'), h('div', { class: 'head' }, reason, h('button', { type: 'button', class: 'primary', 'data-testid': 'term-confirm', onClick: async () => { try {
                    await deps.api.terminate(p.id, reason.value, ack.checked);
                    await again({ kind: 'info', text: 'Personel görevden çıkarıldı; erişimi kapatıldı.' });
                }
                catch (err) {
                    await again({ kind: 'error', text: errorText(err) }, ui);
                } } }, 'Görevden Çıkar'), h('button', { type: 'button', class: 'ghost', onClick: () => again(undefined, {}) }, 'Vazgeç')));
        }
        if (ui.react) {
            const p = people.find((x) => x.id === ui.react);
            if (!p)
                return null;
            return h('section', { class: 'panel', 'data-testid': 'react-panel' }, h('h2', {}, `Yeniden aktif et: ${p.name}`), h('div', { class: 'mut' }, 'Giriş hesabı yalnız bu ekran kapatmışsa geri açılır. PIN ve kart açılmaz: yeni PIN/kart “Personel Erişimi” ekranından verilir.'), h('div', { class: 'head' }, reason, h('button', { type: 'button', class: 'primary', 'data-testid': 'react-confirm', onClick: async () => { try {
                    await deps.api.reactivate(p.id, reason.value);
                    await again({ kind: 'info', text: 'Personel yeniden aktif edildi.' });
                }
                catch (err) {
                    await again({ kind: 'error', text: errorText(err) }, ui);
                } } }, 'Aktif Et'), h('button', { type: 'button', class: 'ghost', onClick: () => again(undefined, {}) }, 'Vazgeç')));
        }
        return null;
    };
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
                    life ? noInput : null,
                    life ? shiftIn : null,
                    h("button", { type: "submit", class: "primary", "data-testid": "create-person-btn" }, "Personel Ekle")),
                h("div", { class: "mut", style: "margin-top:6px" }, "Giri\u015F hesab\u0131, sicil/PIN ve vardiya \u201CPersonel Eri\u015Fimi\u201D ekran\u0131ndan y\u00F6netilir.")),
            panel(),
            h("section", { class: "panel", "data-testid": "personnel-table" },
                h("h2", null,
                    "Personel (",
                    people.length,
                    ")"),
                h("div", { "data-testid": "personnel-tbody" }, people.length ? people.map(row) : h("div", { class: "empty" }, "Personel kayd\u0131 yok.")))))));
    mount(container, screen);
}
