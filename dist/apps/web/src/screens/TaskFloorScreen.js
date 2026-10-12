// KMI NEXT — Görev Zemini (migration 0058). Telefonda ilk bakılan ekran: "benim işim ne?".
//  • "Kayıtlardan gelen işler": kalite/bakım/satınalma/sevkiyat/CAM/iş emri kayıtlarında ZATEN açık olan iş — kaynak kayıtta tamamlanır,
//    burada ikinci bir "yapıldı" bilgisi tutulmaz; yalnız kaynağa götürür. Para/fiyat bilgisi içermez.
//  • "Atanan görevler": yönetimin atadığı görevler. Tamamlama = atanan kişi; ONAY = başka bir yetkili (tamamlandı ≠ onaylandı).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { DS_CSS, initials } from '../ds.js';
import { WO_STATUS_TR } from './WorkOrderHubScreen.js';
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
const TF_CSS = DS_CSS + `
.kd .tf-task{border:1px solid #1e293b;border-left:5px solid #475569;border-radius:12px;padding:12px;margin:8px 0;background:linear-gradient(180deg,#111c2e,#0f172a);overflow-wrap:anywhere}
.kd .tf-task[data-late="true"]{border-left-color:#ef4444;border-color:#7f1d1d}.kd .tf-task[data-status="IN_PROGRESS"]{border-left-color:#3b82f6}
.kd .tf-task[data-status="COMPLETED"]{border-left-color:#f59e0b}.kd .tf-task[data-status="APPROVED"]{border-left-color:#22c55e}
.kd .tf-task .t{font-size:16px;font-weight:800;color:#fff}.kd .tf-task .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.kd .tf-task .evid{font-size:13px;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;margin-top:6px;color:#cbd5e1}
.kd .tf-task a{color:#67e8f9;font-weight:700}.kd .tf-derived{display:block;border:1px solid #1e293b;border-radius:12px;padding:12px;margin:6px 0;text-decoration:none;color:#e2e8f0;background:linear-gradient(180deg,#111c2e,#0f172a)}
.kd .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.kd .tile{border-radius:12px;padding:10px 12px;border:1px solid #334155;background:#0f172a}
.kd .tile .n{font-size:26px;font-weight:800}.kd .tile .l{font-size:11px;font-weight:800;letter-spacing:.08em}
.kd .tile.open{border-color:#3b82f6;background:rgba(59,130,246,.12)}.kd .tile.late{border-color:#ef4444;background:rgba(239,68,68,.12)}.kd .tile.hold{border-color:#f59e0b;background:rgba(245,158,11,.1)}.kd .tile.appr{border-color:#8b5cf6;background:rgba(139,92,246,.14)}
.kd details.newtask{border:1px solid #334155;border-radius:12px;padding:10px;background:#0f172a}.kd details summary{min-height:32px;cursor:pointer;font-weight:700;color:#e2e8f0}
.kd .who{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1}.kd .who .avatar{width:24px;height:24px;font-size:10px}`;
const rel = (iso) => { if (!iso)
    return ''; const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000); const a = Math.abs(m); const t = a >= 1440 ? `${Math.floor(a / 1440)} gün` : a >= 60 ? `${Math.floor(a / 60)} sa` : `${a} dk`; return m < 0 ? ` · ${t} gecikti` : ` · ${t} kaldı`; };
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
        state.message ? h('div', { 'data-testid': 'tf-message', 'data-kind': state.message.kind, class: `banner ${state.message.kind === 'ok' ? 'info' : 'error'}` }, state.message.text) : null];
    if (loadError || !data) {
        mount(container, h('div', { class: 'kd' }, h('style', {}, TF_CSS), ...head, h('div', { 'data-testid': 'tf-load-error', class: 'banner error' }, loadError ?? '')));
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
        const btn = (label, testid, fn, primary = false) => h('button', { type: 'button', 'data-testid': testid, onClick: fn, class: /tf-start|tf-approve|tf-reopen-go/.test(testid) ? 'okb' : /cancel/.test(testid) ? 'danger' : /reopen/.test(testid) ? 'warnb' : primary ? 'primary' : 'ghost' }, label);
        lastDraft = () => ({ note: note.value, evidence: evid.value });
        return h('div', { 'data-testid': 'tf-task', 'data-status': t.status, 'data-late': String(t.isLate), 'data-task': t.id,
            class: 'tf-task' }, h('div', { class: 'head' }, h('span', { class: 't grow' }, t.title), h('span', { 'data-testid': 'tf-status', class: `pill ${t.status === 'APPROVED' ? 'ok' : t.status === 'COMPLETED' ? 'warn' : t.status === 'IN_PROGRESS' ? 'info' : t.status === 'CANCELLED' ? 'bad' : ''}` }, ST_TR[t.status] ?? t.status)), t.isLate ? h('div', { 'data-testid': 'tf-late', style: 'color:#fca5a5;font-weight:800' }, `GECİKTİ — bitiş ${fmt(t.dueAt)}${rel(t.dueAt)}`) : t.dueAt ? h('div', { style: 'font-size:13px;color:#94a3b8' }, `Bitiş ${fmt(t.dueAt)}${rel(t.dueAt)}`) : null, t.description ? h('div', { style: 'font-size:13px' }, t.description) : null, h('div', { class: 'head', style: 'margin-top:4px' }, h('span', { class: 'who' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(ROLE_TR[t.assigneeLabel ?? ''] ?? t.assigneeLabel ?? '?')), `Atanan: ${t.assigneeLabel ? (ROLE_TR[t.assigneeLabel] ?? t.assigneeLabel) : '—'}`), h('span', { class: 'mut' }, `Atayan: ${t.ownerLabel ?? '—'}`), t.requiresEvidence ? h('span', { class: 'pill gold' }, 'kanıt zorunlu') : null), t.sourceRoute ? h('div', { style: 'font-size:13px' }, `${SRC_TR[t.sourceType] ?? t.sourceType}: `, h('a', { href: `#${t.sourceRoute}`, 'data-testid': 'tf-source', }, 'kaydı aç →')) : null, t.completionNote ? h('div', { 'data-testid': 'tf-completion', class: 'evid' }, `Tamamlama: ${t.completionNote}${t.evidenceRef ? ` · kanıt: ${t.evidenceRef}` : ''}`) : null, t.approvalNote ? h('div', { style: 'font-size:13px' }, `Onay: ${t.approvalNote}`) : null, t.status === 'COMPLETED' && t.completedByMe && d.canManage ? h('div', { 'data-testid': 'tf-four-eyes', style: 'color:#fbbf24;font-size:13px' }, 'Bunu siz tamamladınız — onayı başka bir yetkili verir.') : null, h('div', { class: 'acts' }, t.canStart ? btn('Başla', 'tf-start', () => void act(() => api.start(t.id), 'Görev başladı.')) : null, t.canComplete ? btn('Tamamla…', 'tf-complete-open', () => toggle('complete'), true) : null, t.canApprove ? btn('Onayla…', 'tf-approve-open', () => toggle('approve'), true) : null, d.canManage && t.status === 'COMPLETED' ? btn('Geri aç…', 'tf-reopen', () => toggle('reopen')) : null, d.canManage && (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'COMPLETED') ? btn('İptal…', 'tf-cancel', () => toggle('cancel')) : null), mode ? h('div', { class: 'acts' }, note, mode === 'complete' ? evid : null, mode === 'complete' ? btn('Tamamlandı olarak gönder', 'tf-complete', () => void act(() => api.complete(t.id, note.value.trim(), evid.value.trim()), 'Tamamlandı — onay bekliyor.'), true) : null, mode === 'approve' ? btn('Onayı ver', 'tf-approve', () => void act(() => api.approve(t.id, note.value.trim()), 'Görev onaylandı.'), true) : null, mode === 'reopen' ? btn('Yeniden aç', 'tf-reopen-go', () => void act(() => api.reopen(t.id, note.value.trim()), 'Görev yeniden açıldı.')) : null, mode === 'cancel' ? btn('İptal et', 'tf-cancel-go', () => void act(() => api.cancel(t.id, note.value.trim()), 'Görev iptal edildi.')) : null) : null);
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
    const nOpen = d.manual.filter((t) => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length;
    const nAppr = d.manual.filter((t) => t.status === 'COMPLETED').length;
    const tile = (cls, label, n, extra = '') => h('div', { class: `tile ${cls}` }, h('div', { class: 'l' }, label), h('div', { class: 'n' }, `${n}`), extra ? h('div', { class: 'mut' }, extra) : null);
    const tiles = [tile('open', 'AÇIK', nOpen, `${nOpen} açık`), tile('late', 'GECİKMİŞ', late, `${late} geciken`), tile('appr', 'ONAY BEKLİYOR', nAppr, `${nAppr} onay bekliyor`),
        tile('hold', 'KAYITTAN GELEN', d.derived.length, `kayıtlardan gelen ${d.derived.length}`)];
    mount(container, h('div', { class: 'kd tf-screen' }, h('style', {}, TF_CSS), ...head, d.canManage ? h('div', { class: 'tabs' }, h('button', { type: 'button', 'data-testid': 'tf-scope-mine', class: scope === 'MINE' ? 'on' : '', disabled: scope === 'MINE', onClick: () => go({ scope: 'MINE' }) }, 'Benim'), h('button', { type: 'button', 'data-testid': 'tf-scope-all', class: scope === 'ALL' ? 'on' : '', disabled: scope === 'ALL', onClick: () => go({ scope: 'ALL' }) }, 'Tüm atanan görevler')) : null, h('div', { 'data-testid': 'tf-summary', class: 'tiles' }, ...tiles), d.canManage ? h('details', { 'data-testid': 'tf-new', class: 'newtask', ...(pre ? { open: true } : {}) }, h('summary', {}, '＋ Yeni görev ata'), pre ? h('div', { 'data-testid': 'tf-prefill', style: 'font-size:13px;color:#94a3b8' }, `İlgili kayıt: ${SRC_TR[pre.sourceType] ?? pre.sourceType}`) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center' }, tTitle, tDesc, tWho, tDue, h('label', { style: 'font-size:13px' }, tEv, ' kanıt zorunlu'), h('button', { type: 'button', 'data-testid': 'tf-new-create', class: 'primary', onClick: create }, 'Görevi ata'))) : null, h('h2', {}, 'Atanan görevler'), d.manual.length ? null : h('div', { 'data-testid': 'tf-manual-empty', class: 'empty' }, 'Atanmış görev yok.'), ...d.manual.map(card), scope === 'MINE' ? h('h2', {}, 'Kayıtlardan gelen işler') : null, scope === 'MINE' && !d.derived.length ? h('div', { 'data-testid': 'tf-derived-empty', class: 'empty' }, 'Rolünüze ait açık iş yok.') : null, ...(scope === 'MINE' ? d.derived.map((x) => h('a', { href: `#${x.route}`, 'data-testid': 'tf-derived', 'data-source': x.sourceType, class: 'tf-derived' }, h('div', { class: 'head' }, h('b', { class: 'grow', style: 'color:#fff' }, x.title), h('span', { class: 'pill info' }, ROLE_TR[x.role] ?? x.role)), h('div', { style: 'font-size:12px;color:#94a3b8' }, `${SRC_TR[x.sourceType] ?? x.sourceType} · ${WO_STATUS_TR[x.status] ?? x.status}${x.due ? ` · ${x.due}` : ''} · kaynakta tamamlanır →`))) : [])));
}
