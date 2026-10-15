// KMI-001 §001.5 — ONE factory communication surface. A notice is a DERIVED VIEW of records that already live in canonical sources (PULSE alerts from command_center,
// approvals from the approvals inbox, tasks from task_floor). Nothing is stored here, so Görevlerim / Onaylarım / PULSE can never disagree: the same object seen through
// two sources collapses into ONE notice (the most actionable one wins and remembers the other source). Pure: no I/O, no clock (caller passes `nowMs`).
import { ALERT_KINDS } from './commandCenter.js';
import { KIND_LABEL } from './approvalsInbox.js';
export const NOTICE_KIND_TR = { INFORMATION: 'BİLGİ', ACTION_REQUIRED: 'İŞLEM GEREKLİ', WARNING: 'UYARI', CRITICAL: 'KRİTİK', APPROVAL_REQUIRED: 'ONAY GEREKLİ', ESCALATION: 'YÜKSELTME' };
/** Most urgent first. */
export const NOTICE_RANK = { CRITICAL: 0, ESCALATION: 1, APPROVAL_REQUIRED: 2, ACTION_REQUIRED: 3, WARNING: 4, INFORMATION: 5 };
const DEPT_OF_DOMAIN = { PRODUCTION: 'Üretim', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', MATERIAL: 'Depo / Malzeme', PURCHASING: 'Satınalma', SHIPMENT: 'Sevkiyat' };
const WHY_ACTION = {
    MACHINE_DOWN: { why: 'Makine duruyor; planlı işler bu makinede ilerleyemez.', action: 'Arıza kaydını aç, bakım ekibini ata.' },
    QUALITY_HOLD_OPEN: { why: 'Bekletmedeki parti ilerleyemez; sevkiyat ve üretim durur.', action: 'Kalite kararı ver: serbest bırak veya reddet.' },
    ORDER_OVERDUE: { why: 'Müşteri terminini geçti; teslim eksik.', action: 'Siparişi aç, sevkiyat veya üretim planını güncelle.' },
    WORK_ORDER_LATE_START: { why: 'Planlanan başlangıç geçti; termin kayabilir.', action: 'İş emrini aç; makine ve operatör atamasını kontrol et.' },
    MATERIAL_SHORTAGE_SOON: { why: 'Yakın planlı iş için malzeme yetmiyor.', action: 'Satınalma talebi aç veya stoğu kontrol et.' },
    MACHINE_IN_MAINTENANCE: { why: 'Makine bakımda; kapasite düştü.', action: 'Bakım bitiş tarihini kontrol et, planı gözden geçir.' },
    NCR_OPEN: { why: 'Açık uygunsuzluk kapanana kadar etkilenen iş riskte.', action: 'NCR kaydını aç ve kararı ilerlet.' },
    READINESS_UNKNOWN_SOON: { why: 'BOM veya CAM verisi yok; iş başlatılamaz.', action: 'Mühendislikten eksik veriyi iste.' },
    INCOMING_QC_WAITING: { why: 'Giriş kalite kararı bekleyen mal depoya alınamaz.', action: 'Giriş kalite kararını ver.' },
    PURCHASE_REQUEST_WAITING: { why: 'Onay bekleyen talep malzeme tedarikini geciktirir.', action: 'Talebi onayla veya reddet.' },
};
const DECIDER_OF_KIND = { COMMERCIAL_MGMT_RELEASE: 'Yönetim', COMMERCIAL_DECISION: 'Muhasebe / Ticari onay', PURCHASE_REQUEST: 'Satınalma onayı', PURCHASE_ORDER: 'Satınalma onayı', TASK_COMPLETION: 'Görevi atayan yönetici' };
/** One canonical object name across the sources: lower-case, singular, no table prefix. */
export function objectKeyOf(type, id) {
    const t = type.toLowerCase().replace(/^kmi_next\./, '').replace(/ies$/, 'y').replace(/s$/, '').replace(/[\s-]+/g, '_');
    return `${t}:${id ?? 'none'}`;
}
const APPROVAL_OBJECT = { COMMERCIAL_MGMT_RELEASE: 'commercial_approval', COMMERCIAL_DECISION: 'commercial_approval', PURCHASE_REQUEST: 'purchase_request', PURCHASE_ORDER: 'purchase_order', TASK_COMPLETION: 'task' };
export function noticesFromAlerts(alerts) {
    return alerts.map((a) => {
        const meta = ALERT_KINDS[a.kind];
        const wa = WHY_ACTION[a.kind];
        return {
            id: `pulse:${a.kind}:${a.entityId}`, kind: a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'HIGH' ? 'WARNING' : 'INFORMATION',
            what: a.title || meta?.label || 'Uyarı', why: wa?.why ?? (a.detail ?? 'Fabrika akışını etkileyebilir.'), owner: DEPT_OF_DOMAIN[a.domain] ?? null,
            action: wa?.action ?? 'Kaydı aç ve durumu kontrol et.', record: { type: a.entityType, id: a.entityId || null, label: a.detail ?? a.title, href: null }, since: a.since, source: 'PULSE', alsoFrom: [], objectKey: objectKeyOf(a.entityType, a.entityId || null),
        };
    });
}
export function noticesFromApprovals(items) {
    return items.map((it) => ({
        id: `approval:${it.key}`, kind: it.overdue ? 'ESCALATION' : 'APPROVAL_REQUIRED', what: `${KIND_LABEL[it.kind]}: ${it.record}`,
        why: it.priorityWhy || 'Karar bekleyen kayıt akışı durdurur.', owner: DECIDER_OF_KIND[it.kind] ?? null,
        action: it.completedByMe ? 'Kendi tamamladığınız görevi başkası onaylamalı.' : 'Kaydı incele; onayla veya gerekçeyle reddet.',
        record: { type: APPROVAL_OBJECT[it.kind], id: it.recordId, label: it.record, href: it.link }, since: it.requestedAt, source: 'APPROVAL', alsoFrom: [], objectKey: objectKeyOf(APPROVAL_OBJECT[it.kind], it.recordId),
    }));
}
/** Only tasks that wait for ME to act (open / in progress). A COMPLETED task waiting for approval is already an approval notice — never both. */
export function noticesFromTasks(tasks) {
    return tasks.filter((t) => t.assignedToMe && (t.status === 'OPEN' || t.status === 'IN_PROGRESS')).map((t) => ({
        id: `task:${t.id}`, kind: t.isLate ? 'WARNING' : 'ACTION_REQUIRED', what: t.title, why: t.isLate ? 'Görev süresi geçti.' : t.dueAt ? 'Görev size atandı; bitiş tarihi var.' : 'Görev size atandı.',
        owner: 'Siz', action: t.status === 'OPEN' ? 'Görevi başlat ve tamamla.' : 'Görevi tamamla; gerekiyorsa kanıt ekle.',
        record: { type: 'task', id: t.id, label: t.title, href: t.sourceRoute ?? '#/gorevler' }, since: t.createdAt, source: 'TASK', alsoFrom: [], objectKey: objectKeyOf('task', t.id),
    }));
}
/** One list. The same object from two sources collapses into one notice: APPROVAL > TASK > PULSE as the actionable view, the other source is remembered in `alsoFrom`. */
export function mergeNotices(...lists) {
    const pref = { APPROVAL: 0, TASK: 1, PULSE: 2 };
    const by = new Map();
    for (const n of lists.flat()) {
        const cur = by.get(n.objectKey);
        if (!cur) {
            by.set(n.objectKey, { ...n, alsoFrom: [...n.alsoFrom] });
            continue;
        }
        const [win, lose] = pref[n.source] < pref[cur.source] ? [n, cur] : [cur, n];
        // keep the stronger urgency of the two (an overdue approval stays ESCALATION; a critical alert stays CRITICAL)
        const kind = NOTICE_RANK[win.kind] <= NOTICE_RANK[lose.kind] ? win.kind : lose.kind;
        by.set(n.objectKey, { ...win, kind, alsoFrom: [...new Set([...win.alsoFrom, lose.source, ...lose.alsoFrom])].filter((s) => s !== win.source), since: earliest(win.since, lose.since) });
    }
    return [...by.values()].sort(compareNotices);
}
const earliest = (a, b) => (a && b ? (Date.parse(a) <= Date.parse(b) ? a : b) : a ?? b);
export function compareNotices(a, b) {
    const r = NOTICE_RANK[a.kind] - NOTICE_RANK[b.kind];
    if (r)
        return r;
    const ta = a.since ? Date.parse(a.since) : Infinity, tb = b.since ? Date.parse(b.since) : Infinity;
    if (ta !== tb)
        return ta - tb;
    return a.what.localeCompare(b.what, 'tr');
}
/** "Ne zamandır bekliyor?" — an unknown time is stated as unknown, never 0 minutes. */
export function waitingText(since, nowMs) {
    if (!since)
        return 'Bekleme süresi bilinmiyor';
    const t = Date.parse(since);
    if (!Number.isFinite(t))
        return 'Bekleme süresi bilinmiyor';
    const m = Math.max(0, Math.floor((nowMs - t) / 60000));
    if (m < 1)
        return 'Az önce';
    if (m < 60)
        return `${m} dk'dır bekliyor`;
    const h = Math.floor(m / 60);
    if (h < 48)
        return `${h} sa ${m % 60} dk'dır bekliyor`;
    return `${Math.floor(h / 24)} gündür bekliyor`;
}
export function noticeCounts(list) {
    const c = { INFORMATION: 0, ACTION_REQUIRED: 0, WARNING: 0, CRITICAL: 0, APPROVAL_REQUIRED: 0, ESCALATION: 0 };
    for (const n of list)
        c[n.kind] += 1;
    return c;
}
