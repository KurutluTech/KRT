// KMI-001 §001.5 — Bildirimler: one communication surface over the CANONICAL sources (PULSE alerts, approvals inbox, task floor). Read-only: every notice opens the real work screen /
// object passport; decisions are made there (the server re-checks). A source that cannot be read is reported — never shown as "0 bildirim".
import { h, mount } from '../../../../packages/ui/src/h.js';
import { NOTICE_KIND_TR, mergeNotices, noticeCounts, noticesFromAlerts, noticesFromApprovals, noticesFromTasks, waitingText } from '../../../../packages/domain/src/notices.js';
import { passportHref } from '../passport/registry.js';
const SOURCE_TR = { PULSE: 'PULSE', APPROVAL: 'Onaylar', TASK: 'Görevler' };
const KIND_ICON = { INFORMATION: 'search', ACTION_REQUIRED: 'tasks', WARNING: 'gauge', CRITICAL: 'bolt', APPROVAL_REQUIRED: 'shield', ESCALATION: 'clock' };
const KIND_TONE = { INFORMATION: 'blue', ACTION_REQUIRED: 'blue', WARNING: 'amber', CRITICAL: 'red', APPROVAL_REQUIRED: 'amber', ESCALATION: 'red' };
const PASSPORT_TYPES = { MACHINE: 'MACHINE', WORK_ORDER: 'WORK_ORDER', PRODUCT: 'PRODUCT', TOOL: 'TOOL', ORDER: 'ORDER', STOCK_LOT: 'STOCK_LOT', SHIPMENT: 'SHIPMENT', TASK: 'TASK', NCR: 'QUALITY_NCR', QUALITY_NCR: 'QUALITY_NCR', MAINTENANCE_TICKET: 'MAINTENANCE_TICKET', SUPPLIER: 'SUPPLIER', CUSTOMER: 'CUSTOMER' };
/** The real screen for a notice: the route its source already knows, else the object passport, else (honestly) the Performance Center where the alert lives. */
export function noticeHref(n) {
    const r = n.record;
    if (r?.href)
        return r.href.startsWith('#') ? r.href : `#${r.href}`;
    const kind = r ? PASSPORT_TYPES[r.type.toUpperCase()] : undefined;
    if (r?.id && kind)
        return passportHref(kind, r.id);
    return '#/komuta';
}
const CSS = `
.nt{max-width:980px;margin:0 auto;color:#e8eefc}.nt h1{font-size:20px;margin:0 0 4px;color:#fff}.nt .sub{color:#9fb0cf;font-size:13px;margin-bottom:12px}
.nt .chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.nt .fc{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-weight:800;font-size:13px;cursor:pointer}
.nt .fc[aria-pressed=true]{background:#1e3a5f;border-color:#38bdf8;color:#fff}.nt .fc b{font-variant-numeric:tabular-nums}
.nt .list{display:flex;flex-direction:column;gap:10px}
.nt .n{border:1px solid #243452;border-left-width:6px;border-radius:14px;background:linear-gradient(180deg,#111c33,#0d1527);padding:14px 16px}
.nt .n.red{border-left-color:#ef4444}.nt .n.amber{border-left-color:#f59e0b}.nt .n.blue{border-left-color:#3b82f6}
.nt .n .top{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.nt .kd{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;letter-spacing:.1em}
.nt .kd.red{color:#fca5a5}.nt .kd.amber{color:#fcd34d}.nt .kd.blue{color:#93c5fd}.nt .wait{font-size:12px;color:#9fb0cf}
.nt .what{font-size:17px;font-weight:800;margin:6px 0 2px;color:#fff}.nt dl{margin:8px 0 0;display:grid;grid-template-columns:150px 1fr;gap:4px 12px;font-size:14px}.nt dt{color:#9fb0cf}.nt dd{margin:0}
.nt .open{display:inline-flex;align-items:center;gap:8px;margin-top:12px;min-height:48px;padding:0 18px;border-radius:12px;background:#1d4ed8;color:#fff;font-weight:800;text-decoration:none}
.nt .also{font-size:12px;color:#9fb0cf;margin-top:6px}.nt .bn{border:1px solid #92400e;background:#2d1f03;color:#fcd34d;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700}
.nt .empty{border:1px dashed #334155;border-radius:14px;padding:22px;color:#cbd5e1;text-align:center}
@media (max-width:640px){.nt dl{grid-template-columns:1fr}.nt dt{margin-top:6px}}
`;
export async function renderNoticesScreen(container, deps, state = {}) {
    const now = deps.now ?? (() => Date.now());
    const go = (s) => renderNoticesScreen(container, deps, s);
    mount(container, h('div', { class: 'nt', 'data-testid': 'nt-root' }, h('style', {}, CSS), h('h1', {}, 'Bildirimler'), h('div', { class: 'sub' }, 'Yükleniyor…')));
    const failed = [];
    const safe = async (src, p) => { try {
        return await p();
    }
    catch (e) {
        failed.push({ src, why: e instanceof Error ? e.message : String(e) });
        return [];
    } };
    const [alerts, approvals, tasks] = await Promise.all([safe('PULSE', deps.sources.alerts), safe('APPROVAL', deps.sources.approvals), safe('TASK', deps.sources.tasks)]);
    const all = mergeNotices(noticesFromAlerts(alerts), noticesFromApprovals(approvals), noticesFromTasks(tasks));
    const counts = noticeCounts(all);
    const shown = state.filter ? all.filter((n) => n.kind === state.filter) : all;
    const order = ['CRITICAL', 'ESCALATION', 'APPROVAL_REQUIRED', 'ACTION_REQUIRED', 'WARNING', 'INFORMATION'];
    const card = (n) => {
        const tone = KIND_TONE[n.kind];
        return h('article', { class: `n ${tone}`, 'data-testid': 'nt-item', 'data-kind': n.kind, 'data-source': n.source, 'data-key': n.objectKey }, h('div', { class: 'top' }, h('span', { class: `kd ${tone}` }, deps.icon(KIND_ICON[n.kind], 18), NOTICE_KIND_TR[n.kind]), h('span', { class: 'wait', 'data-testid': 'nt-wait' }, waitingText(n.since, now()))), h('div', { class: 'what', 'data-testid': 'nt-what' }, n.what), h('dl', {}, h('dt', {}, 'Neden önemli?'), h('dd', { 'data-testid': 'nt-why' }, n.why), h('dt', {}, 'Sorumlu'), h('dd', { 'data-testid': 'nt-owner' }, n.owner ?? 'Sorumlu atanmamış'), h('dt', {}, 'Ne yapılmalı?'), h('dd', { 'data-testid': 'nt-action' }, n.action)), n.alsoFrom.length ? h('div', { class: 'also', 'data-testid': 'nt-also' }, `Aynı kayıt ${n.alsoFrom.map((s) => SOURCE_TR[s]).join(', ')} tarafında da görünüyor — tek bildirim.`) : null, h('a', { class: 'open', href: noticeHref(n), 'data-testid': 'nt-open' }, deps.icon('link', 18), n.record ? `Kaydı aç: ${n.record.label}` : 'İlgili ekranı aç'));
    };
    mount(container, h('div', { class: 'nt', 'data-testid': 'nt-root' }, h('style', {}, CSS), h('h1', {}, 'Bildirimler'), h('div', { class: 'sub' }, 'PULSE uyarıları, onay bekleyenler ve görevleriniz tek listede. Aynı kayıt iki yerde görünse de burada bir kez yer alır; karar ilgili ekranda verilir.'), ...failed.map((f) => h('div', { class: 'bn', 'data-testid': 'nt-source-error', 'data-source': f.src }, `${SOURCE_TR[f.src]} kaynağı okunamadı — bu kaynaktan gelen bildirimler eksik olabilir; “yok” anlamına gelmez.`)), h('div', { class: 'chips', 'data-testid': 'nt-filters' }, h('button', { type: 'button', class: 'fc', 'aria-pressed': String(!state.filter), 'data-testid': 'nt-filter', 'data-kind': 'ALL', onClick: () => void go({ filter: null }) }, 'Tümü ', h('b', {}, String(all.length))), ...order.map((k) => h('button', { type: 'button', class: 'fc', 'aria-pressed': String(state.filter === k), 'data-testid': 'nt-filter', 'data-kind': k, onClick: () => void go({ filter: state.filter === k ? null : k }) }, deps.icon(KIND_ICON[k], 16), NOTICE_KIND_TR[k], ' ', h('b', {}, String(counts[k]))))), shown.length ? h('div', { class: 'list', 'data-testid': 'nt-list' }, ...shown.map(card))
        : failed.length === 3 ? h('div', { class: 'empty', 'data-testid': 'nt-unknown' }, 'Hiçbir kaynak okunamadı. Bildirim durumu BİLİNMİYOR.')
            : h('div', { class: 'empty', 'data-testid': 'nt-empty' }, failed.length ? 'Okunabilen kaynaklarda bekleyen bildirim yok (bazı kaynaklar okunamadı).' : state.filter ? 'Bu türde bildirim yok.' : 'Bekleyen bildirim yok.')));
}
