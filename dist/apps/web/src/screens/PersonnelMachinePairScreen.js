// KMI NEXT — PERSONEL – MAKİNE / EKİPMAN EŞLEŞTİRME. Personel seç → makineleri işaretle → eğitimi var Evet/Hayır → Kaydet (ters yönden de).
// "Eğitimi var" yalnız beyandır; belge/kanıt üretmez ve başka yetki vermez. Aynı canonical kayıt personel ve makine pasaportunda okunur.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `.pmp{max-width:900px;margin:0 auto;padding:0 16px 40px;color:var(--kmi-text,#e2e8f0)}.pmp h1{font-size:22px}.pmp-tabs{display:flex;gap:8px;margin:10px 0}
.pmp button,.pmp select{min-height:40px;border-radius:10px;border:1px solid var(--kmi-line,#334155);padding:6px 12px;background:rgba(56,189,248,.12);color:inherit;font-weight:700}
.pmp button[aria-pressed=true]{outline:2px solid var(--kmi-info,#38bdf8)}.pmp-row{display:flex;gap:10px;align-items:center;padding:8px 4px;border-top:1px solid rgba(148,163,184,.2);flex-wrap:wrap}
.pmp-row label{flex:1 1 180px;display:flex;gap:8px;align-items:center}.pmp-msg{padding:10px 14px;border-radius:12px;margin:8px 0;font-weight:700;border:1px solid}.pmp-msg.ok{color:#4ade80}.pmp-msg.error{color:#f87171}
@media (max-width:520px){.pmp select{width:100%}}`;
export async function renderPersonnelMachinePairScreen(container, { api, canManage = true }, view = {}) {
    const redo = (v) => void renderPersonnelMachinePairScreen(container, { api, canManage }, v);
    const mode = view.mode === 'machine' ? 'machine' : 'person';
    let people = [], machines = [], pairs = [];
    try { [people, machines, pairs] = await Promise.all([api.people(), api.machines(), api.pairs()]); }
    catch (e) { mount(container, h('div', { class: 'pmp' }, h('div', { 'data-testid': 'pmp-load-error', class: 'pmp-msg error', role: 'alert' }, errorText(e)))); return; }
    const map = new Map(pairs.map((p) => [`${p.personnelId}|${p.machineId}`, p.trained]));
    const msg = view.message ? h('div', { 'data-testid': 'pmp-message', class: `pmp-msg ${view.message.kind}`, role: view.message.kind === 'error' ? 'alert' : 'status' }, view.message.text) : null;
    const tabs = h('div', { class: 'pmp-tabs' },
        h('button', { type: 'button', 'data-testid': 'pmp-tab-person', 'aria-pressed': String(mode === 'person'), onClick: () => redo({ mode: 'person' }) }, 'Personelden'),
        h('button', { type: 'button', 'data-testid': 'pmp-tab-machine', 'aria-pressed': String(mode === 'machine'), onClick: () => redo({ mode: 'machine' }) }, 'Makineden'));
    const subjects = mode === 'person' ? people.filter((p) => p.active) : machines;
    const selId = view.selected && subjects.some((s) => s.id === view.selected) ? view.selected : '';
    const sel = h('select', { 'data-testid': 'pmp-subject', 'aria-label': mode === 'person' ? 'Personel' : 'Makine / ekipman', onChange: (ev) => redo({ mode, selected: ev.target.value }) },
        h('option', { value: '' }, mode === 'person' ? 'Personel seçin' : 'Makine / ekipman seçin'),
        ...subjects.map((s) => h('option', { value: s.id, ...(s.id === selId ? { selected: true } : {}) }, mode === 'person' ? s.name : `${s.code} · ${s.name ?? ''}`)));
    const targets = mode === 'person' ? machines : people.filter((p) => p.active || (selId && map.has(`${p.id}|${selId}`)));
    const rows = selId ? targets.map((t) => {
        const key = mode === 'person' ? `${selId}|${t.id}` : `${t.id}|${selId}`;
        const on = map.has(key);
        const chk = h('input', { type: 'checkbox', 'data-testid': 'pmp-check', 'data-id': t.id, ...(on ? { checked: true } : {}), 'aria-label': 'Eşleştir' });
        const tr = h('select', { 'data-testid': 'pmp-trained', 'data-id': t.id, 'aria-label': 'Eğitimi var' }, h('option', { value: 'no', ...(map.get(key) ? {} : { selected: true }) }, 'Eğitimi var: Hayır'), h('option', { value: 'yes', ...(map.get(key) ? { selected: true } : {}) }, 'Eğitimi var: Evet'));
        return h('div', { class: 'pmp-row', 'data-testid': 'pmp-row' }, h('label', {}, chk, mode === 'person' ? `${t.code} · ${t.name ?? ''}` : t.name), tr);
    }) : [];
    const save = h('button', { type: 'button', 'data-testid': 'pmp-save', ...(canManage && selId ? {} : { disabled: true }), onClick: async () => {
        const picked = [...container.querySelectorAll('[data-testid="pmp-check"]')].filter((c) => c.checked).map((c) => {
            const id = c.getAttribute('data-id'); const trained = container.querySelector(`[data-testid="pmp-trained"][data-id="${id}"]`).value === 'yes';
            return mode === 'person' ? { machineId: id, trained } : { personnelId: id, trained }; });
        try { mode === 'person' ? await api.setForPerson(selId, picked) : await api.setForMachine(selId, picked);
            redo({ mode, selected: selId, message: { kind: 'ok', text: `Kaydedildi (${picked.length} eşleştirme).` } }); }
        catch (e) { redo({ mode, selected: selId, message: { kind: 'error', text: `Kaydedilemedi: ${errorText(e)}` } }); } } }, 'Kaydet');
    mount(container, h('div', { class: 'pmp' }, h('style', {}, CSS), h('h1', { 'data-testid': 'pmp-heading' }, 'Personel – Makine / Ekipman Eşleştirme'), msg, tabs, sel,
        !canManage ? h('div', { 'data-testid': 'pmp-noauth', class: 'pmp-msg error' }, 'Bu ekranda değişiklik için yönetici yetkisi gerekir; yalnız görüntüleyebilirsiniz.') : null,
        ...rows, selId ? save : null,
        h('p', { class: 'pmp-note', 'data-testid': 'pmp-note' }, '“Eğitimi var” yalnız beyandır; eğitim belgesi yerine geçmez ve başka yetki vermez. İş emri START değerlendirmesi bu eşleştirmeyi okur.')));
}
