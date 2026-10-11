// KMI NEXT — Personel aktarımı (migration 0052). The old KMI's server personnel list is fetched read-only into a
// batch; nothing is guessed: department names and legacy role codes go through an explicit mapping table, a
// person is identified only by the source id, and a row that cannot be mapped waits for the approver's choice.
// A DIFFERENT authorized person than the one who fetched the list applies it (four eyes). Every decision stays.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { issueText } from '../../../../packages/domain/src/personnelImport.js';
import { errorText } from '../errorText.js';
const STATUS_TR = { NEW: 'Aktarılabilir', NEEDS_DECISION: 'Karar gerekli', ALREADY_IMPORTED: 'Zaten aktarıldı', INACTIVE_IN_SOURCE: 'Kaynakta pasif' };
const RESULT_TR = {
    APPLIED: 'aktarıldı', APPLIED_LOGIN_NOT_LINKED: 'aktarıldı (giriş hesabı başka kişide — bağlanmadı)', REJECTED: 'aktarılmadı',
    DEPARTMENT_REQUIRED: 'bölüm seçilmedi', ROLES_REQUIRED: 'rol seçilmedi', ALREADY_DECIDED: 'zaten karar verilmiş',
    ALREADY_IMPORTED: 'zaten aktarılmış', INACTIVE_IN_SOURCE: 'kaynakta pasif', ROW_NOT_IN_BATCH: 'satır bulunamadı',
};
const REFUSAL_TR = {
    FOUR_EYES_REQUIRED: 'Listeyi getiren kişi aktaramaz — başka bir yetkili onaylamalı (dört göz).',
    NOTE_REQUIRED: 'Not yazın (en az 5 karakter).',
    DECISIONS_REQUIRED: 'En az bir satır seçin.',
};
const DEPARTMENTS = [['URETIM', 'Üretim'], ['KALITE', 'Kalite'], ['CAM', 'CAM'], ['BAKIM', 'Bakım'], ['TESVIYE', 'Tesviye'], ['OFIS', 'Ofis'], ['ASCI', 'Mutfak']];
const ROLES = [['OPERATOR', 'Operatör'], ['QUALITY', 'Kalite'], ['CAM', 'CAM'], ['MAINTENANCE', 'Bakım'], ['PURCHASING', 'Satınalma'],
    ['SHIPPING', 'Sevkiyat'], ['ACCOUNTING', 'Muhasebe'], ['MANAGEMENT', 'Yönetim'], ['ADMIN', 'Yönetici (admin)']];
const depTr = (d) => DEPARTMENTS.find(([k]) => k === d)?.[1] ?? '—';
const roleTr = (r) => ROLES.find(([k]) => k === r)?.[1] ?? r;
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); return REFUSAL_TR[m] ?? errorText(e); };
export async function renderPersonnelImportScreen(container, api, state = {}) {
    const go = (next) => void renderPersonnelImportScreen(container, api, next);
    let loadError = null;
    let batches = [];
    let pv = null;
    try {
        batches = await api.batches();
        const id = state.batchId ?? batches[0]?.id ?? null;
        if (id)
            pv = await api.preview(id);
    }
    catch (e) {
        loadError = errText(e);
    }
    const stageNote = h('input', { type: 'text', 'data-testid': 'pi-stage-note', value: 'Eski KMI personel listesi — aktarım', style: 'flex:1 1 220px;min-width:0' });
    const stage = async () => {
        try {
            const r = await api.stage(stageNote.value.trim());
            go({ batchId: r.batchId, message: { kind: 'ok', text: `${r.rows} kişi listelendi. Aktarım için başka bir yetkilinin onayı gerekir.` } });
        }
        catch (e) {
            go({ ...state, message: { kind: 'error', text: errText(e) } });
        }
    };
    const head = [
        h('h1', { 'data-testid': 'pi-heading' }, 'Personel aktarımı'),
        h('p', { style: 'font-size:13px;color:#475569' }, 'Kaynak: eski KMI sunucusundaki personel listesi (yalnız okunur, eski sistemde hiçbir şey değişmez). Kişi yalnız kaynak kimliğiyle tanınır; isimle eşleştirme yapılmaz. Bölüm adı veya eski rol karşılığı olmayan kişiler için seçim sizden istenir. Listeyi getiren kişi aktaramaz; başka bir yetkili onaylar.'),
        state.message ? h('div', { 'data-testid': 'pi-message', 'data-kind': state.message.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${state.message.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.message.text) : null,
    ];
    if (loadError) {
        mount(container, h('div', { class: 'pi-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, ...head, h('div', { 'data-testid': 'pi-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, loadError)));
        return;
    }
    const body = [
        h('section', { style: 'margin:10px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, stageNote, h('button', { type: 'button', 'data-testid': 'pi-stage', onClick: () => void stage() }, 'Listeyi eski sistemden getir')),
        batches.length > 1 ? h('div', { style: 'font-size:12px;margin:4px 0' }, 'Önceki listeler: ', ...batches.map((b) => h('button', { type: 'button', 'data-testid': 'pi-batch', style: 'margin:2px;font-size:12px', onClick: () => go({ batchId: b.id }) }, new Date(b.stagedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })))) : null,
    ];
    if (!pv) {
        body.push(h('div', { 'data-testid': 'pi-empty', style: 'color:#64748b' }, 'Henüz liste getirilmedi.'));
    }
    else {
        const p = pv;
        const open = p.rows.filter((r) => r.decision === null && (r.status === 'NEW' || r.status === 'NEEDS_DECISION'));
        const note = h('input', { type: 'text', 'data-testid': 'pi-note', placeholder: 'Onay notu (ör. kaynak liste ile karşılaştırıldı)', style: 'flex:1 1 220px;min-width:0' });
        const apply = async () => {
            const decisions = [];
            for (const r of open) {
                const pick = container.querySelector(`[data-testid="pi-pick"][data-row="${r.id}"]`)?.value ?? 'SKIP';
                if (pick === 'SKIP')
                    continue;
                if (pick === 'REJECT') {
                    decisions.push({ rowId: r.id, decision: 'REJECT' });
                    continue;
                }
                const dep = container.querySelector(`[data-testid="pi-dep"][data-row="${r.id}"]`)?.value;
                const roles = [...container.querySelectorAll(`[data-testid="pi-role"][data-row="${r.id}"]:checked`)].map((c) => c.value);
                decisions.push({ rowId: r.id, decision: 'APPLY', ...(dep ? { department: dep } : {}), ...(roles.length ? { roles } : {}) });
            }
            if (!decisions.length)
                return go({ batchId: p.batch.id, message: { kind: 'error', text: REFUSAL_TR.DECISIONS_REQUIRED } });
            try {
                const res = await api.apply(p.batch.id, decisions, note.value.trim());
                const counts = new Map();
                for (const r of res.results)
                    counts.set(r.result, (counts.get(r.result) ?? 0) + 1);
                go({ batchId: p.batch.id, message: { kind: res.applied + res.rejected > 0 ? 'ok' : 'error', text: [...counts].map(([k, n]) => `${n} ${RESULT_TR[k] ?? k}`).join(' · ') } });
            }
            catch (e) {
                go({ batchId: p.batch.id, message: { kind: 'error', text: errText(e) } });
            }
        };
        body.push(h('section', { 'data-testid': 'pi-preview', style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, Object.entries(p.counts).map(([k, n]) => `${STATUS_TR[k] ?? k}: ${n}`).join(' · ')), p.batch.stagedByMe ? h('div', { 'data-testid': 'pi-four-eyes', style: 'color:#b45309;font-size:13px;margin:4px 0' }, 'Bu listeyi siz getirdiniz — aktarımı başka bir yetkili onaylamalı.') : null, ...p.rows.map((r) => {
            const isOpen = r.decision === null && (r.status === 'NEW' || r.status === 'NEEDS_DECISION');
            const needs = r.status === 'NEEDS_DECISION';
            return h('div', { 'data-testid': 'pi-row', 'data-status': r.status, 'data-row': r.id,
                style: `border:1px solid ${needs && isOpen ? '#f59e0b' : '#e2e8f0'};border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px;overflow-wrap:anywhere` }, h('div', { style: 'display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap' }, h('b', {}, `${r.name}${r.employeeNo ? ` · ${r.employeeNo}` : ''}`), h('span', { 'data-testid': 'pi-state' }, r.decision === 'APPLIED' ? 'Aktarıldı' : r.decision === 'REJECTED' ? 'Aktarılmadı' : STATUS_TR[r.status] ?? r.status)), h('div', { style: 'color:#475569' }, `Kaynak: ${r.sourceDepartment ?? 'bölüm yok'} · ${r.sourceRoles.join(', ') || 'rol yok'} → Öneri: ${depTr(r.proposedDepartment)} · ${r.proposedRoles.map(roleTr).join(', ') || '—'}${r.hasLogin ? ' · giriş hesabı var' : ''}`), r.issues.length ? h('div', { 'data-testid': 'pi-issues', style: 'color:#b45309' }, r.issues.map(issueText).join(' · ')) : null, isOpen && !p.batch.stagedByMe ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px' }, h('select', { 'data-testid': 'pi-pick', 'data-row': r.id }, h('option', { value: needs ? 'SKIP' : 'APPLY' }, needs ? 'Şimdilik bekle' : 'Aktar'), h('option', { value: needs ? 'APPLY' : 'SKIP' }, needs ? 'Seçimimle aktar' : 'Şimdilik bekle'), h('option', { value: 'REJECT' }, 'Aktarma')), needs ? h('select', { 'data-testid': 'pi-dep', 'data-row': r.id }, h('option', { value: '' }, r.proposedDepartment ? `Bölüm: ${depTr(r.proposedDepartment)}` : 'Bölüm seçin'), ...DEPARTMENTS.map(([k, t]) => h('option', { value: k }, t))) : null, needs ? h('span', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, ...ROLES.map(([k, t]) => h('label', { style: 'font-size:12px' }, h('input', { type: 'checkbox', 'data-testid': 'pi-role', 'data-row': r.id, value: k, ...(r.proposedRoles.includes(k) ? { checked: true } : {}) }), ` ${t}`))) : null) : null);
        }), open.length && !p.batch.stagedByMe ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px' }, note, h('button', { type: 'button', 'data-testid': 'pi-apply', onClick: () => void apply() }, 'Seçilenleri onayla')) : null));
    }
    mount(container, h('div', { class: 'pi-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, ...head, ...body));
}
