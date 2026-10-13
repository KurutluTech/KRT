// KMI-MANAGEMENT-001 · Yönetim → Onaylar. Gerçek bekleyen onay listesi (mock yok): tür / sahip / kayıt / öncelik / bekleme süresi; yetkili kişi gerekçeyle onaylar
// veya reddeder. Karar yalnızca mevcut kanonik RPC'lerle yapılır (sunucu yetkiyi, durumu, çift kararı ve zorunlu serbest bırakmaları denetler, denetim kaydı yazar).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { KIND_LABEL, OUTCOME_LABEL, PRIORITY_LABEL, REJECT_LABEL, actionState, nextStepText, reasonError, waitLabel } from '../../../../packages/domain/src/approvalsInbox.js';
import { errorText } from '../errorText.js';
import { pill, provenance, stateBox } from '../ds.js';
import { kpi, setKpiContext } from './management/kit.js';
const PRI_PILL = { KRITIK: 'bad', YUKSEK: 'warn', NORMAL: 'info', BILINMIYOR: 'unknown' };
const fmt = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : 'BİLİNMİYOR');
const KINDS = Object.keys(KIND_LABEL);
/** Process-wide in-flight lock: a second click on the same record while a decision is being sent is ignored (double approval is also refused by the server). */
const inFlight = new Set();
export async function renderApprovalsTab(panel, deps, view = { kind: 'ALL', mineOnly: false }) {
    const again = (v) => renderApprovalsTab(panel, deps, { ...view, ...v });
    let res;
    if (!view.banner)
        mount(panel, h('div', { 'data-testid': 'ap-root' }, stateBox('loading', 'Onay listesi yükleniyor…', undefined, 'ap-loading')));
    try {
        res = await deps.api.load();
    }
    catch (e) {
        // connection loss / server error: nothing is shown as "0 pending"; the user can retry without leaving the screen
        mount(panel, h('div', { 'data-testid': 'ap-root', style: 'display:flex;flex-direction:column;gap:12px' }, view.banner ? h('div', { class: `banner ${view.banner.kind}`, role: 'alert', 'data-testid': 'ap-banner' }, view.banner.text) : null, stateBox('error', 'Onay listesi yüklenemedi', `${errorText(e)} — Bağlantınızı kontrol edin. Liste yüklenemediği için hiçbir karar verilemez ve "bekleyen yok" anlamına gelmez.`, 'ap-error'), h('div', {}, h('button', { type: 'button', 'data-testid': 'ap-retry', onClick: () => void renderApprovalsTab(panel, deps, { ...view, banner: undefined }) }, 'Yeniden dene'))));
        return;
    }
    const held = new Set(deps.held);
    if (deps.ctx)
        setKpiContext(deps.ctx(), res.asOf);
    const all = res.items;
    const section = view.section ?? 'PENDING';
    const overdueAll = all.filter((i) => i.overdue);
    const base = section === 'OVERDUE' ? overdueAll : all;
    const visible = base.filter((i) => (view.kind === 'ALL' || i.kind === view.kind) && (!view.mineOnly || actionState(i, 'APPROVE', held).enabled || actionState(i, 'REJECT', held).enabled));
    const count = (p) => all.filter((i) => i.priority === p).length;
    const longest = all.reduce((m, i) => (i.waitingHours === null ? m : m === null || i.waitingHours > m ? i.waitingHours : m), null);
    const errs = Object.entries(res.sourceErrors);
    const decide = async (item, d, reasonEl) => {
        const bad = reasonError(reasonEl.value);
        if (bad) {
            await again({ banner: { kind: 'error', text: bad } });
            return;
        }
        if (inFlight.has(item.key))
            return; // double click / second tab click while the first is being sent
        inFlight.add(item.key);
        panel.querySelectorAll('button').forEach((b) => (b.disabled = true));
        try {
            await deps.api.decide(item, d, reasonEl.value);
            inFlight.delete(item.key);
            await again({ banner: { kind: 'info', text: `${KIND_LABEL[item.kind]} · ${item.record}: ${d === 'APPROVE' ? 'onay' : 'ret/iade'} kaydedildi (gerekçe ve zaman damgası denetim kaydına yazıldı).` } });
        }
        catch (e) {
            inFlight.delete(item.key);
            await again({ banner: { kind: 'error', text: errorText(e) } }); // list is re-read, so a refused/already-decided record disappears or shows its true state
        }
    };
    const card = (item) => {
        const reason = h('input', { type: 'text', placeholder: 'Gerekçe (en az 5 karakter)', 'aria-label': 'Gerekçe', 'data-testid': 'ap-reason', class: 'grow' });
        const a = actionState(item, 'APPROVE', held);
        const r = actionState(item, 'REJECT', held);
        const btn = (d, st, label, cls, tid) => st.visible
            ? h('button', { type: 'button', class: cls, disabled: !st.enabled, title: st.why ?? nextStepText(item, d), 'data-testid': tid, onClick: () => void decide(item, d, reason) }, label) : null;
        return h('div', { class: 'item', 'data-testid': 'ap-item', 'data-kind': item.kind, 'data-key': item.key, 'data-priority': item.priority, style: 'align-items:flex-start' }, h('div', { class: 'grow', style: 'min-width:220px' }, h('div', {}, pill(KIND_LABEL[item.kind], 'info'), ' ', pill(PRIORITY_LABEL[item.priority], PRI_PILL[item.priority], 'ap-priority')), h('b', { 'data-testid': 'ap-record', style: 'display:block;margin-top:4px' }, item.record), h('div', { class: 'mut' }, `Sahibi / talep eden: ${item.owner ?? 'BİLİNMİYOR'} · Talep: ${fmt(item.requestedAt)} · Bekleme: `, h('span', { 'data-testid': 'ap-wait' }, waitLabel(item.waitingHours))), h('div', { class: 'mut', 'data-testid': 'ap-why' }, `Öncelik nedeni: ${item.priorityWhy}`), h('div', { class: 'mut' }, item.link ? h('a', { href: item.link, 'data-testid': 'ap-open' }, 'Kaydı aç') : null, ...item.related.flatMap((l) => [' · ', h('a', { href: l.href, 'data-testid': 'ap-rel' }, l.label)]))), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;flex:1;min-width:260px' }, reason, btn('APPROVE', a, 'Onayla', 'okb', 'ap-approve'), btn('REJECT', r, REJECT_LABEL[item.kind], 'danger', 'ap-reject'), a.why ? h('div', { class: 'mut', 'data-testid': 'ap-denied', style: 'flex-basis:100%' }, a.why) : null, h('div', { class: 'mut', style: 'flex-basis:100%' }, `Onay sonrası: ${nextStepText(item, 'APPROVE')}`)));
    };
    const chip = (label, on, f, tid) => h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': String(on), 'data-testid': tid, onClick: f }, label);
    mount(panel, h('div', { 'data-testid': 'ap-root', style: 'display:flex;flex-direction:column;gap:12px' }, view.banner ? h('div', { class: `banner ${view.banner.kind}`, role: view.banner.kind === 'error' ? 'alert' : 'status', 'data-testid': 'ap-banner' }, view.banner.text) : null, ...errs.map(([k, m]) => stateBox('error', `${k === 'LOTS' ? 'Parti etiketleri' : k === 'NAMES' ? 'İsim eşleşmesi' : KIND_LABEL[k]} okunamadı`, `${errorText(new Error(m))} — bu kaynak "0 bekleyen" gibi gösterilmez; liste eksik olabilir.`, 'ap-source-error')), h('div', { class: 'kpis' }, kpi('Bekleyen onay', String(all.length), 'ap-kpi-total'), kpi('Geciken', String(overdueAll.length), 'ap-kpi-overdue'), kpi('Kritik', String(count('KRITIK')), 'ap-kpi-critical'), kpi('Yüksek', String(count('YUKSEK')), 'ap-kpi-high'), kpi('En uzun bekleme', longest === null ? 'BİLİNMİYOR' : waitLabel(longest), 'ap-kpi-longest')), h('div', { class: 'tabs', role: 'group', 'aria-label': 'Liste', 'data-testid': 'ap-sections' }, chip(`Bekleyen (${all.length})`, section === 'PENDING', () => void again({ section: 'PENDING', banner: undefined }), 'ap-s-pending'), chip(`Geciken (${overdueAll.length})`, section === 'OVERDUE', () => void again({ section: 'OVERDUE', banner: undefined }), 'ap-s-overdue'), chip(`Karar geçmişi (${res.history.length})`, section === 'HISTORY', () => void again({ section: 'HISTORY', banner: undefined }), 'ap-s-history')), section === 'HISTORY' ? null : h('div', { class: 'tabs', role: 'group', 'aria-label': 'Onay türü' }, chip(`Tümü (${all.length})`, view.kind === 'ALL', () => void again({ kind: 'ALL', banner: undefined }), 'ap-f-all'), ...KINDS.map((k) => chip(`${KIND_LABEL[k]} (${all.filter((i) => i.kind === k).length})`, view.kind === k, () => void again({ kind: k, banner: undefined }), `ap-f-${k}`)), chip('Yalnız yetkili olduklarım', view.mineOnly, () => void again({ mineOnly: !view.mineOnly, banner: undefined }), 'ap-f-mine')), section === 'HISTORY' ? historyPanel(res.history, res.historyDays) : h('div', { class: 'panel', 'data-testid': 'ap-list' }, h('h2', {}, section === 'OVERDUE' ? `Geciken onaylar (${visible.length})` : `Onay bekleyenler (${visible.length})`), ...(visible.length ? visible.map(card) : [h('div', { class: 'empty', 'data-testid': 'ap-empty' }, errs.length ? 'Okunabilen kaynaklarda bekleyen onay yok (bazı kaynaklar okunamadı — yukarıya bakın).' : section === 'OVERDUE' ? 'Geciken onay yok.' : 'Bekleyen onay yok.')])), held.has('TASK_MANAGE') ? null : h('div', { class: 'mut', 'data-testid': 'ap-tasks-note' }, 'Görev tamamlama onayları yalnız görev yöneticilerine (TASK_MANAGE) gösterilir.'), h('div', { class: 'mut' }, 'GECİKEN = istenen tarihi geçen veya ≥72 sa bekleyen (KRİTİK ile aynı kural). Öncelik kuralı: ≥72 sa bekleyen veya istenen tarihi geçen = KRİTİK; ≥24 sa veya istenen tarih ≤3 gün = YÜKSEK; diğer = NORMAL; zaman bilinmiyorsa BİLİNMİYOR. Yapay zekâ hiçbir onayı kendisi vermez.'), provenance('commercial_approvals · purchase_requests · purchase_orders · tasks (canlı okuma)', fmt(res.asOf))));
}
/** Read-only decision history: who decided, when, why — straight from the canonical tables' own decision columns (no copy, no second store). */
function historyPanel(items, days) {
    const rows = items.map((i) => h('div', { class: 'item', 'data-testid': 'ap-hist-item', 'data-kind': i.kind, 'data-outcome': i.outcome, style: 'align-items:flex-start' }, h('div', { class: 'grow', style: 'min-width:220px' }, h('div', {}, pill(KIND_LABEL[i.kind], 'info'), ' ', pill(OUTCOME_LABEL[i.outcome], i.outcome === 'APPROVED' ? 'ok' : 'bad', 'ap-outcome')), h('b', { style: 'display:block;margin-top:4px' }, i.record), h('div', { class: 'mut' }, `Karar veren: ${i.decidedBy ?? 'BİLİNMİYOR'} · Zaman: ${fmt(i.decidedAt)}`), h('div', { class: 'mut', 'data-testid': 'ap-hist-reason' }, `Gerekçe: ${i.reason ?? (i.reasonNote ?? 'kayıtta yok (BİLİNMİYOR)')}`), h('div', { class: 'mut' }, ...i.related.flatMap((l, n) => [n ? ' · ' : '', h('a', { href: l.href, 'data-testid': 'ap-rel' }, l.label)])))));
    return h('div', { class: 'panel', 'data-testid': 'ap-history' }, h('h2', {}, `Karar geçmişi — son ${days} gün (${items.length})`), ...(rows.length ? rows : [h('div', { class: 'empty', 'data-testid': 'ap-hist-empty' }, 'Bu aralıkta karar kaydı yok.')]), h('div', { class: 'mut' }, 'Satınalma siparişleri yalnız hâlâ "ONAYLI" durumda olanlarla görünür (sevk edilen sipariş bu listeden çıkar); görev onay geçmişi bu listede yoktur. Tüm kararlar denetim kaydında tutulur.'));
}
