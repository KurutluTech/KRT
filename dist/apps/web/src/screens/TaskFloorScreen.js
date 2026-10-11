// KMI NEXT — Görev Zemini (migration 0058). Telefonda ilk bakılan ekran: "benim işim ne?".
//  • "Kayıtlardan gelen işler": kalite/bakım/satınalma/sevkiyat/CAM/iş emri kayıtlarında ZATEN açık olan iş — kaynak kayıtta tamamlanır,
//    burada ikinci bir "yapıldı" bilgisi tutulmaz; yalnız kaynağa götürür. Para/fiyat bilgisi içermez.
//  • "Atanan görevler": yönetimin atadığı görevler. Tamamlama = atanan kişi; ONAY = başka bir yetkili (tamamlandı ≠ onaylandı).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const ST_TR = { OPEN: 'Açık', IN_PROGRESS: 'Yapılıyor', COMPLETED: 'Tamamlandı — onay bekliyor', APPROVED: 'Onaylandı', CANCELLED: 'İptal' };
const ROLE_TR = { ADMIN: 'Yönetici', MANAGEMENT: 'Yönetim', OPERATOR: 'Operatör', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satınalma', ACCOUNTING: 'Muhasebe', SHIPPING: 'Sevkiyat', CAM: 'CAM' };
const SRC_TR = { NONE: '', WORK_ORDER: 'İş emri', ORDER: 'Sipariş', QUALITY_NCR: 'Uygunsuzluk (NCR)', QUALITY_HOLD: 'Kalite hold', MAINTENANCE_TICKET: 'Bakım kaydı', PURCHASE_REQUEST: 'Satınalma talebi', SHIPMENT: 'Sevkiyat' };
const REFUSAL_TR = {
    NOT_ASSIGNEE: 'Bu görev size atanmamış — yalnız atanan kişi başlatır/tamamlar.', SELF_APPROVAL_FORBIDDEN: 'Tamamlayan kişi kendi işini onaylayamaz — başka bir yetkili onaylamalı.',
    EVIDENCE_REQUIRED: 'Bu görev için kanıt zorunlu (fotoğraf/dosya adı, ölçüm no vb. en az 5 karakter).', NOTE_REQUIRED: 'Not yazın (en az 5 karakter).', REASON_REQUIRED: 'Neden yazın (en az 5 karakter).',
    ASSIGNEE_REQUIRED: 'Bir kişi veya rol seçin.', TITLE_REQUIRED: 'Görev başlığı yazın.', SOURCE_RECORD_NOT_FOUND: 'İlgili kayıt bulunamadı.', DUE_BEFORE_START: 'Bitiş başlangıçtan önce olamaz.',
};
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); const k = Object.keys(REFUSAL_TR).find((x) => m.includes(x)); return k ? REFUSAL_TR[k] : errorText(e); };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const newReq = () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export async function renderTaskFloorScreen(container, api, state = {}) {
    const scope = state.scope ?? 'MINE';
    const go = (next) => void renderTaskFloorScreen(container, api, { scope, prefill: state.prefill, ...next });
    let data = null;
    let loadError = null;
    let people = [];
    try {
        data = await api.floor(scope);
        if (data.canManage)
            people = await api.people().catch(() => []);
    }
    catch (e) {
        loadError = errText(e);
    }
    const head = [h('h1', { 'data-testid': 'tf-heading' }, 'Görev Zemini'),
        state.message ? h('div', { 'data-testid': 'tf-message', 'data-kind': state.message.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${state.message.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.message.text) : null];
    if (loadError || !data) {
        mount(container, h('div', { style: 'padding:0 16px' }, ...head, h('div', { 'data-testid': 'tf-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, loadError ?? '')));
        return;
    }
    const d = data;
    let lastDraft = () => ({ note: '', evidence: '' });
    const act = async (fn, ok, keep = {}) => { try {
        await fn();
        go({ message: { kind: 'ok', text: ok }, open: null, draft: null, ...keep });
    }
    catch (e) {
        go({ message: { kind: 'error', text: errText(e) }, open: state.open, draft: lastDraft(), ...keep });
    } };
    const card = (t) => {
        const mode = state.open?.endsWith(`:${t.id}`) ? state.open.split(':')[0] : null;
        const toggle = (m) => go({ open: mode === m ? null : `${m}:${t.id}` });
        const note = h('input', { type: 'text', 'data-testid': 'tf-note', placeholder: mode === 'approve' ? 'Onay notu' : mode === 'complete' ? 'Ne yapıldı?' : 'Neden?', value: state.draft?.note ?? '', style: 'flex:1 1 180px;min-width:0;font-size:16px' });
        const evid = h('input', { type: 'text', 'data-testid': 'tf-evidence', placeholder: t.requiresEvidence ? 'Kanıt (zorunlu): dosya adı / ölçüm no' : 'Kanıt (isteğe bağlı)', value: state.draft?.evidence ?? '', style: 'flex:1 1 180px;min-width:0;font-size:16px' });
        const btn = (label, testid, fn, primary = false) => h('button', { type: 'button', 'data-testid': testid, onClick: fn, style: `min-height:44px;padding:0 14px;font-size:15px;${primary ? 'font-weight:600' : ''}` }, label);
        lastDraft = () => ({ note: note.value, evidence: evid.value });
        return h('div', { 'data-testid': 'tf-task', 'data-status': t.status, 'data-late': String(t.isLate), 'data-task': t.id,
            style: `border:1px solid ${t.isLate ? '#dc2626' : '#cbd5e1'};border-radius:10px;padding:10px;margin:8px 0;overflow-wrap:anywhere` }, h('div', { style: 'display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap' }, h('b', {}, t.title), h('span', { 'data-testid': 'tf-status' }, ST_TR[t.status] ?? t.status)), t.isLate ? h('div', { 'data-testid': 'tf-late', style: 'color:#b91c1c;font-weight:600' }, `GECİKTİ — bitiş ${fmt(t.dueAt)}`) : t.dueAt ? h('div', { style: 'font-size:13px;color:#475569' }, `Bitiş ${fmt(t.dueAt)}`) : null, t.description ? h('div', { style: 'font-size:13px' }, t.description) : null, h('div', { style: 'font-size:12px;color:#475569' }, `Atanan: ${t.assigneeLabel ? (ROLE_TR[t.assigneeLabel] ?? t.assigneeLabel) : '—'} · Atayan: ${t.ownerLabel ?? '—'}`), t.sourceRoute ? h('div', { style: 'font-size:13px' }, `${SRC_TR[t.sourceType] ?? t.sourceType}: `, h('a', { href: `#${t.sourceRoute}`, 'data-testid': 'tf-source', style: 'color:#1d4ed8' }, 'kaydı aç →')) : null, t.completionNote ? h('div', { 'data-testid': 'tf-completion', style: 'font-size:13px;background:#f1f5f9;border-radius:6px;padding:4px 6px;margin-top:4px' }, `Tamamlama: ${t.completionNote}${t.evidenceRef ? ` · kanıt: ${t.evidenceRef}` : ''}`) : null, t.approvalNote ? h('div', { style: 'font-size:13px' }, `Onay: ${t.approvalNote}`) : null, t.status === 'COMPLETED' && t.completedByMe && d.canManage ? h('div', { 'data-testid': 'tf-four-eyes', style: 'color:#b45309;font-size:13px' }, 'Bunu siz tamamladınız — onayı başka bir yetkili verir.') : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, t.canStart ? btn('Başla', 'tf-start', () => void act(() => api.start(t.id), 'Görev başladı.')) : null, t.canComplete ? btn('Tamamla…', 'tf-complete-open', () => toggle('complete'), true) : null, t.canApprove ? btn('Onayla…', 'tf-approve-open', () => toggle('approve'), true) : null, d.canManage && t.status === 'COMPLETED' ? btn('Geri aç…', 'tf-reopen', () => toggle('reopen')) : null, d.canManage && (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'COMPLETED') ? btn('İptal…', 'tf-cancel', () => toggle('cancel')) : null), mode ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, note, mode === 'complete' ? evid : null, mode === 'complete' ? btn('Tamamlandı olarak gönder', 'tf-complete', () => void act(() => api.complete(t.id, note.value.trim(), evid.value.trim()), 'Tamamlandı — onay bekliyor.'), true) : null, mode === 'approve' ? btn('Onayı ver', 'tf-approve', () => void act(() => api.approve(t.id, note.value.trim()), 'Görev onaylandı.'), true) : null, mode === 'reopen' ? btn('Yeniden aç', 'tf-reopen-go', () => void act(() => api.reopen(t.id, note.value.trim()), 'Görev yeniden açıldı.')) : null, mode === 'cancel' ? btn('İptal et', 'tf-cancel-go', () => void act(() => api.cancel(t.id, note.value.trim()), 'Görev iptal edildi.')) : null) : null);
    };
    // manager: new task form
    const tTitle = h('input', { type: 'text', 'data-testid': 'tf-new-title', placeholder: 'Görev (ne yapılacak?)', style: 'flex:1 1 200px;min-width:0;font-size:16px' });
    const tDesc = h('input', { type: 'text', 'data-testid': 'tf-new-desc', placeholder: 'Açıklama (isteğe bağlı)', style: 'flex:1 1 200px;min-width:0;font-size:16px' });
    const tWho = h('select', { 'data-testid': 'tf-new-who', style: 'font-size:16px' }, h('option', { value: '' }, 'Kime?'), ...Object.entries(ROLE_TR).map(([k, v]) => h('option', { value: `R:${k}` }, `Rol: ${v}`)), ...people.map((p) => h('option', { value: `U:${p.userId}` }, p.name)));
    const tDue = h('input', { type: 'datetime-local', 'data-testid': 'tf-new-due', style: 'font-size:16px' });
    const tEv = h('input', { type: 'checkbox', 'data-testid': 'tf-new-evidence' });
    const pre = state.prefill;
    const create = () => {
        if (!tWho.value)
            return go({ message: { kind: 'error', text: REFUSAL_TR.ASSIGNEE_REQUIRED } });
        const [kind, val] = [tWho.value[0], tWho.value.slice(2)];
        void act(() => api.create({ title: tTitle.value.trim(), description: tDesc.value.trim(), assigneeUser: kind === 'U' ? val : null, assigneeRole: kind === 'R' ? val : null,
            dueAt: tDue.value ? new Date(tDue.value).toISOString() : null, sourceType: pre?.sourceType ?? 'NONE', sourceId: pre?.sourceId ?? null, requiresEvidence: tEv.checked, clientRequestId: newReq() }), 'Görev atandı.', { prefill: null });
    };
    const late = d.manual.filter((t) => t.isLate).length;
    mount(container, h('div', { class: 'tf-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, ...head, d.canManage ? h('div', { style: 'display:flex;gap:6px;margin:6px 0' }, h('button', { type: 'button', 'data-testid': 'tf-scope-mine', disabled: scope === 'MINE', style: 'min-height:44px', onClick: () => go({ scope: 'MINE' }) }, 'Benim'), h('button', { type: 'button', 'data-testid': 'tf-scope-all', disabled: scope === 'ALL', style: 'min-height:44px', onClick: () => go({ scope: 'ALL' }) }, 'Tüm atanan görevler')) : null, h('div', { 'data-testid': 'tf-summary', style: 'font-size:13px;color:#475569;margin:4px 0' }, `${d.manual.filter((t) => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length} açık · ${late} geciken · ${d.manual.filter((t) => t.status === 'COMPLETED').length} onay bekliyor · kayıtlardan gelen ${d.derived.length}`), d.canManage ? h('details', { 'data-testid': 'tf-new', ...(pre ? { open: true } : {}), style: 'border:1px solid #cbd5e1;border-radius:10px;padding:8px;margin:8px 0' }, h('summary', { style: 'min-height:32px' }, 'Yeni görev ata'), pre ? h('div', { 'data-testid': 'tf-prefill', style: 'font-size:13px;color:#475569' }, `İlgili kayıt: ${SRC_TR[pre.sourceType] ?? pre.sourceType}`) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center' }, tTitle, tDesc, tWho, tDue, h('label', { style: 'font-size:13px' }, tEv, ' kanıt zorunlu'), h('button', { type: 'button', 'data-testid': 'tf-new-create', style: 'min-height:44px', onClick: create }, 'Görevi ata'))) : null, h('h2', { style: 'font-size:16px;margin-top:12px' }, 'Atanan görevler'), d.manual.length ? null : h('div', { 'data-testid': 'tf-manual-empty', style: 'color:#64748b' }, 'Atanmış görev yok.'), ...d.manual.map(card), scope === 'MINE' ? h('h2', { style: 'font-size:16px;margin-top:14px' }, 'Kayıtlardan gelen işler') : null, scope === 'MINE' && !d.derived.length ? h('div', { 'data-testid': 'tf-derived-empty', style: 'color:#64748b' }, 'Rolünüze ait açık iş yok.') : null, ...(scope === 'MINE' ? d.derived.map((x) => h('a', { href: `#${x.route}`, 'data-testid': 'tf-derived', 'data-source': x.sourceType, style: 'display:block;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin:6px 0;text-decoration:none;color:inherit;min-height:44px' }, h('div', { style: 'display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap' }, h('b', {}, x.title), h('span', { style: 'font-size:12px' }, ROLE_TR[x.role] ?? x.role)), h('div', { style: 'font-size:12px;color:#475569' }, `${SRC_TR[x.sourceType] ?? x.sourceType} · ${x.status}${x.due ? ` · ${x.due}` : ''} · kaynakta tamamlanır →`))) : [])));
}
