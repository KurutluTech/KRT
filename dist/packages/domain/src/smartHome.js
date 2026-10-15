// KMI-002 — Akıllı Ana Sayfa. PURE composition rules: no DOM, no I/O, no new data source. It only ORDERS and SPLITS facts that canonical sources already
// delivered (command_center alerts, task_floor, commercial_approvals count) and says honestly when a source is missing.
//   • Öncelikli işlerim  = one queue, one ranking (six tiers), one item per object
//   • Dikkat gerektirenler = risks that are not "my" work + data-trust problems; never repeats an item already in the queue
//   • Hızlı erişim = role defaults (never presented as personalised unless a real usage history exists)
//   • Kart sırası = bounded user preference (fixed head, known sections only)
// Authorization is NOT decided here: every source is read through RLS/RPC; this module only chooses what to show first.
import { homeDomainsFor } from './homeLayout.js';
/** The ranking the owner fixed: blocker → pending authorised decision → late task → approaching due date → work in progress → information. */
export const TIER_LABEL_TR = { 1: 'Engel', 2: 'Karar bekliyor', 3: 'Gecikmiş', 4: 'Termin yaklaşıyor', 5: 'Devam eden', 6: 'Bilgi' };
export const DOMAIN_OWNER_TR = { PRODUCTION: 'Üretim', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', MATERIAL: 'Depo', PURCHASING: 'Satınalma', SHIPMENT: 'Sevkiyat' };
const ROLE_TR = { ADMIN: 'Yönetici', MANAGEMENT: 'Yönetim', OPERATOR: 'Operatör', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satınalma', ACCOUNTING: 'Muhasebe', SHIPPING: 'Sevkiyat', CAM: 'CAM / Mühendislik' };
/** Plain-language names: raw enum codes (FIRST_PIECE_PENDING, WORK_ORDER) never reach the screen. */
export const ENTITY_TR = { MACHINE: 'Makine', WORK_ORDER: 'İş emri', ORDER: 'Sipariş', ORDER_ITEM: 'Sipariş kalemi', QUALITY_HOLD: 'Kalite bekletmesi', QUALITY_NCR: 'Uygunsuzluk', MAINTENANCE_TICKET: 'Bakım kaydı', PURCHASE_ORDER: 'Satınalma siparişi', STOCK_LOT: 'Stok lotu', CAM_PROGRAM: 'CAM programı', TOOL: 'Takım', PRODUCT: 'Ürün', CUSTOMER: 'Müşteri' };
export const entityTr = (t) => ENTITY_TR[t] ?? 'Kayıt';
export const DERIVED_STATUS_TR = { FIRST_PIECE_PENDING: 'İlk parça onayı bekliyor', MACHINE_ASSIGNED: 'Makine atandı, başlamadı', ON_HOLD: 'Kalite bekletmesinde', OPEN: 'Açık', IN_PROGRESS: 'Yapılıyor', PENDING: 'Karar bekliyor', DRAFT: 'Taslak', WAITING: 'Bekliyor' };
export const derivedStatusTr = (s) => DERIVED_STATUS_TR[s] ?? 'Açık kayıt';
export const roleTr = (r) => (r ? ROLE_TR[r] ?? r : '—');
const DECISION_STATUSES = new Set(['FIRST_PIECE_PENDING', 'PENDING']);
const MIN = 60_000, H48 = 48 * 60 * MIN;
const ts = (iso) => (iso ? Date.parse(iso) : NaN);
const ageMin = (iso, nowMs) => { const t = ts(iso); return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / MIN)) : null; };
/** Roles that own a department's work (management/admin own none of them: they own decisions and criticals). */
export function ownDomains(a) {
    const d = homeDomainsFor({ ...a, roles: a.roles.filter((r) => r !== 'ADMIN' && r !== 'MANAGEMENT') });
    return d === 'ALL' ? [] : d;
}
/** An alert belongs in MY queue when it is a critical blocker (anyone in scope must see it) or it sits in a department I work in. */
export const isMineAlert = (al, a) => al.severity === 'CRITICAL' || ownDomains(a).includes(al.domain);
export function alertTier(al) { return al.severity === 'CRITICAL' ? 1 : al.severity === 'HIGH' ? 3 : 6; }
/** ONE tier rule for a manual task — shared by the Home queue and the Görevlerim workspace so the two surfaces can never disagree. null ⇒ not an open item for me. */
export function manualTaskTier(t, nowMs) {
    if (t.status === 'APPROVED' || t.status === 'CANCELLED')
        return null;
    const due = ts(t.dueAt);
    if (t.status === 'COMPLETED')
        return t.canApprove ? 2 : null;
    if (t.isLate || (Number.isFinite(due) && due < nowMs))
        return 3;
    if (Number.isFinite(due) && due - nowMs <= H48)
        return 4;
    return 5;
}
/** Tier of an open record (derived task): a record waiting for an authorised decision IS a decision; everything else follows its due date. */
export function derivedTaskTier(d, nowMs) {
    const due = ts(d.due);
    // the decision belongs to the role the record is waiting for: an operator whose job waits for the quality first-piece decision is waiting, not deciding
    return DECISION_STATUSES.has(d.status) && d.role !== 'OPERATOR' ? 2 : Number.isFinite(due) && due < nowMs ? 3 : Number.isFinite(due) && due - nowMs <= H48 ? 4 : 5;
}
/** How many open task-like items need ME now (manual tasks + open records). Görevlerim's `summarize().actionable` is the same number by construction (same tier rules). */
export function openTaskCount(tasks, nowMs) {
    if (!tasks)
        return null;
    return tasks.manual.filter((t) => manualTaskTier(t, nowMs) !== null).length + new Set(tasks.derived.map((d) => `${d.sourceType}:${d.sourceId}`)).size;
}
export function buildPriorityQueue(i, cap = 6) {
    const out = [];
    const inScope = (d) => { const dd = homeDomainsFor(i.access); return dd === 'ALL' || dd.includes(d); };
    for (const al of i.alerts ?? []) {
        if (!inScope(al.domain) || !isMineAlert(al, i.access))
            continue;
        const tier = alertTier(al);
        const late = /LATE|OVERDUE|DELAY/.test(al.kind);
        out.push({ key: `alert:${al.kind}:${al.entityId}`, objectKey: `${al.entityType}:${al.entityId}`, tier, kind: 'ALERT', label: tier === 1 ? 'Engel' : late ? 'Gecikmiş' : tier === 3 ? 'Yüksek risk' : 'Bilgi', title: al.title, status: tier === 1 ? 'Kritik' : late ? 'Gecikmiş' : tier === 3 ? 'Uyarı' : 'Bilgi',
            objectLabel: `${entityTr(al.entityType)} ${al.entityId.slice(0, 8)}`, waitingMin: ageMin(al.since, i.nowMs), dueIso: null, owner: DOMAIN_OWNER_TR[al.domain] ?? al.domain,
            context: al.detail, target: { type: 'ENTITY', entityType: al.entityType, entityId: al.entityId }, actionLabel: 'Kayda git ve müdahale et', severity: al.severity });
    }
    if (i.canOpenApprovals && typeof i.approvalsPending === 'number' && i.approvalsPending > 0) {
        out.push({ key: 'approvals:pending', objectKey: null, tier: 2, kind: 'APPROVAL', title: `${i.approvalsPending} onay kararınızı bekliyor`, status: 'Karar bekliyor', objectLabel: null, waitingMin: null, dueIso: null, owner: 'Sen', context: null,
            target: { type: 'ROUTE', href: '#/onaylar' }, actionLabel: 'Onayları aç' });
    }
    for (const t of i.tasks?.manual ?? []) {
        const tier = manualTaskTier(t, i.nowMs);
        if (tier === null)
            continue;
        out.push({ key: `task:${t.id}`, objectKey: t.sourceId ? `${t.sourceType}:${t.sourceId}` : `TASK:${t.id}`, tier, kind: 'TASK', title: t.title,
            status: t.status === 'COMPLETED' ? 'Onayını bekliyor' : t.status === 'IN_PROGRESS' ? 'Yapılıyor' : tier === 3 ? 'Gecikmiş' : 'Açık', objectLabel: `Görev ${t.id.slice(0, 8)}`,
            waitingMin: null, dueIso: t.dueAt, owner: t.assignedToMe ? 'Sen' : roleTr(t.assigneeLabel ?? t.assigneeRole), context: t.sourceType && t.sourceType !== 'NONE' ? `${entityTr(t.sourceType)}${t.sourceId ? ' ' + t.sourceId.slice(0, 8) : ''}` : null,
            target: { type: 'ROUTE', href: `#/gorevler?t=${encodeURIComponent(t.id)}` }, actionLabel: t.status === 'COMPLETED' ? 'İncele ve onayla' : 'Görevi aç' });
    }
    for (const d of i.tasks?.derived ?? []) {
        const tier = derivedTaskTier(d, i.nowMs);
        out.push({ key: `derived:${d.sourceType}:${d.sourceId}`, objectKey: `${d.sourceType}:${d.sourceId}`, tier, kind: 'DERIVED', title: d.title, status: derivedStatusTr(d.status), objectLabel: `${entityTr(d.sourceType)} ${d.sourceId.slice(0, 8)}`,
            waitingMin: null, dueIso: d.due, owner: roleTr(d.role), context: null, target: { type: 'ROUTE', href: d.route.startsWith('#') ? d.route : `#${d.route}` }, actionLabel: 'Kayda git' });
    }
    // ONE event → ONE item: an alert and a task/record about the same object collapse into the most urgent entry. Two independent tasks/records are NEVER merged with each other (separate work, separate owners).
    const seen = new Map();
    for (const it of out) {
        if (!it.objectKey)
            continue;
        const prev = seen.get(it.objectKey);
        if (!prev || it.tier < prev.tier)
            seen.set(it.objectKey, it);
    }
    const alertKeys = new Set(out.filter((it) => it.kind === 'ALERT' && it.objectKey).map((it) => it.objectKey));
    const kept = out.filter((it) => !it.objectKey || !alertKeys.has(it.objectKey) ? true : seen.get(it.objectKey) === it);
    kept.sort((a, b) => a.tier - b.tier || (ts(a.dueIso) || Infinity) - (ts(b.dueIso) || Infinity) || (b.waitingMin ?? -1) - (a.waitingMin ?? -1) || a.title.localeCompare(b.title, 'tr'));
    return { items: kept.slice(0, cap), more: Math.max(0, kept.length - cap), total: kept.length };
}
const SRC_TR = { snapshot: 'Komuta merkezi (uyarılar, sayaçlar)', board: 'Canlı makine panosu', tasks: 'Görev listesi', approvals: 'Onay kuyruğu' };
export function buildAttention(i, cap = 6) {
    const items = [];
    const dd = homeDomainsFor(i.access);
    for (const al of i.alerts ?? []) {
        if (!(dd === 'ALL' || dd.includes(al.domain)))
            continue;
        if (i.shownKeys.has(`alert:${al.kind}:${al.entityId}`) || i.shownKeys.has(`${al.entityType}:${al.entityId}`))
            continue; // already in "Öncelikli işlerim" — never repeated
        items.push({ key: `a:${al.kind}:${al.entityId}`, kind: 'ALERT', severity: al.severity === 'CRITICAL' ? 'CRITICAL' : al.severity === 'HIGH' ? 'HIGH' : 'INFO', what: al.title,
            why: al.detail ?? 'Ayrıntı kaydı yok', who: DOMAIN_OWNER_TR[al.domain] ?? al.domain, where: { label: 'Kaydı aç', target: { type: 'ENTITY', entityType: al.entityType, entityId: al.entityId } }, sinceMin: ageMin(al.since, i.nowMs) });
    }
    // data-trust problems are risks too: a stale or missing source must never read as "all clear"
    for (const id of ['snapshot', 'board', 'tasks', 'approvals']) {
        const s = i.sources[id];
        if (s.state === 'FAILED' || s.state === 'TIMEOUT')
            items.push({ key: `d:${id}`, kind: 'DATA', severity: 'WARN', what: `${SRC_TR[id]} okunamadı`, why: s.state === 'TIMEOUT' ? 'Kaynak zamanında yanıt vermedi. Boş görünen alan "sorun yok" anlamına gelmez.' : 'Sorgu başarısız oldu. Boş görünen alan "sorun yok" anlamına gelmez.',
                who: 'Yenile; sürerse yönetime bildir', where: { label: 'Yenile', target: null }, sinceMin: null });
    }
    if (i.sources.snapshot.state === 'OK' && i.snapshotStale)
        items.push({ key: 'd:stale', kind: 'DATA', severity: 'WARN', what: 'Komuta merkezi verisi bayat', why: `Son kayıt ${i.snapshotAgeMin === null ? 'bilinmiyor' : `${i.snapshotAgeMin} dk`} önce. Gösterilen durum canlı değil.`, who: 'Yenile; sürerse yönetime bildir', where: { label: 'Yenile', target: null }, sinceMin: i.snapshotAgeMin });
    const rank = (s) => (s === 'CRITICAL' ? 0 : s === 'HIGH' ? 1 : s === 'WARN' ? 2 : 3);
    items.sort((a, b) => rank(a.severity) - rank(b.severity) || (b.sinceMin ?? -1) - (a.sinceMin ?? -1));
    return { items: items.slice(0, cap), more: Math.max(0, items.length - cap) };
}
export function quickAccess(defaults, recent, canOpen, max = 6) {
    const seen = new Set();
    const entries = [];
    for (const p of recent)
        if (p !== '/' && canOpen(p) && !seen.has(p)) {
            seen.add(p);
            entries.push({ path: p, personal: true });
        }
    const personalCount = Math.min(entries.length, 3);
    entries.length = personalCount;
    seen.clear();
    entries.forEach((e) => seen.add(e.path));
    for (const p of defaults)
        if (p !== '/' && canOpen(p) && !seen.has(p)) {
            seen.add(p);
            entries.push({ path: p, personal: false });
        }
    return { entries: entries.slice(0, max), personalised: personalCount > 0 };
}
/** ── bounded card order (002.13) ─────────────────────────────────────────────────────────────────────────────── */
/** attention (Dikkat gerektirenler) lives in the fixed decision column next to the priority queue — it is not a movable card. */
export const MOVABLE_SECTIONS = ['fleet', 'perf', 'wos', 'flow', 'quick'];
/** Only known sections; every present section appears exactly once; unknown/duplicate/absent ids in a stored value never break the layout. */
export function applyOrder(present, saved) {
    const base = MOVABLE_SECTIONS.filter((s) => present.includes(s));
    if (!Array.isArray(saved))
        return base;
    const out = [];
    for (const s of saved)
        if (typeof s === 'string' && base.includes(s) && !out.includes(s))
            out.push(s);
    for (const s of base)
        if (!out.includes(s))
            out.push(s);
    return out;
}
export function moveSection(order, id, dir) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length)
        return [...order];
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    return o;
}
export const orderStorageKey = (userId) => `kmi-home-order-v1:${userId}`;
/** Sections a user may see at all (composition, not authorization): the floor sections need a shop-floor scope; commercial counts need the orders screen. */
export function sectionsFor(a, o) { return { fleet: o.showsFleet, wos: o.showsFleet, orderTile: o.canOpenOrders }; }
