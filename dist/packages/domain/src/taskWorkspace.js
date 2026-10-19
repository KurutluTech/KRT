// KMI-003 — Görevlerim: ONE display contract for every kind of work that waits for a person, built from the canonical sources that already exist
// (task_floor manual tasks + the open records task_floor derives from quality / maintenance / purchasing / shipment / CAM / work orders).
// This module never writes and never invents state: each item keeps the writer and the rules of its own source ("kaynakta tamamlanır").
// Tier, lateness and priority come from the SAME evaluators as the Smart Home queue (smartHome.manualTaskTier / derivedTaskTier, taskSla), so the two surfaces cannot disagree.
import { derivedStatusTr, derivedTaskTier, manualTaskTier, roleTr, TIER_LABEL_TR } from './smartHome.js';
import { evaluateSla } from './taskSla.js';
export const STATE_TR = { ASSIGNED: 'Atandı', IN_PROGRESS: 'Devam ediyor', AWAITING_DECISION: 'Karar bekliyor', AWAITING_APPROVAL: 'Onay bekleniyor', BLOCKED: 'Engellendi', OPEN: 'Açık', DONE: 'Tamamlandı', CANCELLED: 'İptal', UNKNOWN: 'Bilinmiyor' };
export const SOURCE_TR = { NONE: 'Bağımsız görev', WORK_ORDER: 'İş emri', ORDER: 'Sipariş', QUALITY_NCR: 'Uygunsuzluk (NCR)', QUALITY_HOLD: 'Kalite bekletmesi', MAINTENANCE_TICKET: 'Bakım kaydı', PURCHASE_REQUEST: 'Satınalma talebi', SHIPMENT: 'Sevkiyat', MACHINE: 'Makine', TOOL: 'Takım' };
const DEPT_OF_ROLE = { OPERATOR: 'Üretim', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satınalma', ACCOUNTING: 'Muhasebe', SHIPPING: 'Sevkiyat', CAM: 'CAM / Mühendislik', MANAGEMENT: 'Yönetim', ADMIN: 'Yönetim' };
const DEPT_OF_SOURCE = { QUALITY_NCR: 'Kalite', QUALITY_HOLD: 'Kalite', MAINTENANCE_TICKET: 'Bakım', PURCHASE_REQUEST: 'Satınalma', SHIPMENT: 'Sevkiyat' };
const MIN = 60_000;
const rolesKnown = new Set(Object.keys(DEPT_OF_ROLE));
const srcLabel = (t, id) => `${SOURCE_TR[t] ?? 'Kayıt'}${id ? ' ' + id.slice(0, 8) : ''}`;
export function manualToItem(t, nowMs, canManage) {
    const tier = manualTaskTier(t, nowMs);
    const sla = evaluateSla({ status: t.status, dueAt: t.dueAt, createdAt: t.createdAt, serverLate: t.isLate, nowMs });
    const closed = t.status === 'APPROVED' || t.status === 'CANCELLED';
    const state = t.status === 'APPROVED' ? 'DONE' : t.status === 'CANCELLED' ? 'CANCELLED' : t.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : t.status === 'COMPLETED' ? (t.canApprove ? 'AWAITING_DECISION' : 'AWAITING_APPROVAL') : t.status === 'OPEN' ? 'ASSIGNED' : 'UNKNOWN';
    const roleCode = t.assigneeRole ?? (t.assigneeLabel && rolesKnown.has(t.assigneeLabel) ? t.assigneeLabel : null);
    const late = sla.state === 'OVERDUE';
    const effTier = closed ? 6 : tier ?? 6;
    return {
        id: `task:${t.id}`, origin: 'MANUAL', taskId: t.id, title: t.title, description: t.description, type: t.sourceType, typeLabel: 'Atanan görev',
        source: t.sourceType && t.sourceType !== 'NONE' && t.sourceId ? { type: t.sourceType, id: t.sourceId, label: srcLabel(t.sourceType, t.sourceId) } : null, sourceRoute: t.sourceRoute,
        assigneeLabel: t.assignedToMe ? 'Sen' : roleTr(t.assigneeLabel ?? t.assigneeRole), assigneeRole: roleCode, mine: t.assignedToMe, ownerLabel: t.ownerLabel, department: roleCode ? DEPT_OF_ROLE[roleCode] ?? null : null,
        tier: effTier, tierLabel: closed ? STATE_TR[state] : TIER_LABEL_TR[effTier], actionable: !closed && tier !== null && tier <= 5, state, stateLabel: STATE_TR[state], late, dueIso: t.dueAt, createdIso: t.createdAt, startsIso: t.startsAt, waitingMin: null,
        sla, decision: state === 'AWAITING_DECISION' ? 'Tamamlamayı onayla' : null,
        nextOwner: state === 'AWAITING_APPROVAL' || state === 'AWAITING_DECISION' ? 'Görevi atayan yetkili (onay)' : closed ? null : t.assignedToMe ? 'Sen' : roleTr(t.assigneeLabel ?? t.assigneeRole), blockedReason: null,
        nextStep: closed ? 'İş kapandı' : t.canApprove ? 'Tamamlamayı incele ve onayla' : t.status === 'COMPLETED' ? 'Onay bekleniyor — sizde iş yok' : t.canStart ? 'Başla' : t.canComplete ? (t.requiresEvidence ? 'Tamamla — kanıt gerekli' : 'Tamamla') : 'Atanan kişi yapacak',
        requiresEvidence: t.requiresEvidence, evidenceRef: t.evidenceRef, completionNote: t.completionNote, approvalNote: t.approvalNote,
        can: { start: t.canStart, complete: t.canComplete, approve: t.canApprove, reopen: canManage && t.status === 'COMPLETED', cancel: canManage && (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'COMPLETED') },
        href: `#/gorevler?t=${encodeURIComponent(t.id)}`, qr: `KMI:TASK:${t.id}`,
    };
}
export function derivedToItem(d, nowMs) {
    const tier = derivedTaskTier(d, nowMs);
    const sla = evaluateSla({ status: 'OPEN', dueAt: d.due, createdAt: null, nowMs });
    const mineToDecide = d.role !== 'OPERATOR'; // an operator waits for the first-piece decision; the quality role takes it
    const decision = !mineToDecide ? null : d.status === 'FIRST_PIECE_PENDING' ? 'İlk parça onayı kararı' : d.status === 'PENDING' ? 'Onay kararı' : d.sourceType === 'MAINTENANCE_TICKET' && d.status === 'TEST_PENDING' ? 'Yetkili test sonucu kararı' : null;
    const blocked = d.status === 'ON_HOLD';
    const state = decision ? 'AWAITING_DECISION' : blocked ? 'BLOCKED' : d.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN';
    const route = d.route.startsWith('#') ? d.route : `#${d.route}`;
    return {
        id: `rec:${d.sourceType}:${d.sourceId}`, origin: 'RECORD', taskId: null, title: d.sourceType === 'MAINTENANCE_TICKET' && d.status === 'TEST_PENDING' ? `Yetkili test onayı bekliyor — ${d.title.replace(/^Bakım:\s*/, '')}` : d.title, description: null, type: d.sourceType, typeLabel: 'Kayıttan gelen iş',
        source: { type: d.sourceType, id: d.sourceId, label: srcLabel(d.sourceType, d.sourceId) }, sourceRoute: route,
        assigneeLabel: roleTr(d.role), assigneeRole: d.role, mine: true, ownerLabel: null, department: DEPT_OF_ROLE[d.role] ?? DEPT_OF_SOURCE[d.sourceType] ?? null,
        tier, tierLabel: TIER_LABEL_TR[tier], actionable: true, state, stateLabel: derivedStatusTr(d.status), late: sla.state === 'OVERDUE', dueIso: d.due, createdIso: null, startsIso: null, waitingMin: null,
        sla, decision, nextOwner: roleTr(d.role), blockedReason: blocked ? 'Kalite bekletmesi: kaynakta serbest bırakılana kadar ilerlemez' : null,
        nextStep: decision ? `${decision} — kaynak kayıtta ver` : !mineToDecide && d.status === 'FIRST_PIECE_PENDING' ? 'Kalite ilk parça onayı bekleniyor — onaydan sonra üretime devam' : blocked ? 'Kaynakta serbest bırakma kararı gerekir' : 'Kaynak kayıtta işlemi yap',
        requiresEvidence: false, evidenceRef: null, completionNote: null, approvalNote: null,
        can: { start: false, complete: false, approve: false, reopen: false, cancel: false }, href: route, qr: null,
    };
}
/** Two open records about the same object are one piece of work (the most urgent wins); manual tasks are never merged with anything. */
export function buildWorkItems(i, canManage) {
    const items = i.manual.map((t) => manualToItem(t, i.nowMs, canManage));
    const rec = new Map();
    for (const d of i.derived) {
        const it = derivedToItem(d, i.nowMs);
        const prev = rec.get(it.id);
        if (!prev || it.tier < prev.tier)
            rec.set(it.id, it);
    }
    items.push(...rec.values());
    return sortItems(items);
}
const ts = (v) => (v ? Date.parse(v) : NaN);
export function sortItems(items) {
    const closed = (x) => (x.state === 'DONE' || x.state === 'CANCELLED' ? 1 : 0);
    return [...items].sort((a, b) => closed(a) - closed(b) || a.tier - b.tier || (ts(a.dueIso) || Infinity) - (ts(b.dueIso) || Infinity) || a.title.localeCompare(b.title, 'tr'));
}
export const VIEWS = [
    { id: 'ACTIVE', label: 'Aktif' }, { id: 'MINE', label: 'Bana atananlar' }, { id: 'TODAY', label: 'Bugün' }, { id: 'LATE', label: 'Gecikenler' },
    { id: 'DECISION', label: 'Karar bekleyenler' }, { id: 'PROGRESS', label: 'Devam edenler' }, { id: 'DONE', label: 'Tamamlananlar' },
];
const istDay = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const isClosed = (x) => x.state === 'DONE' || x.state === 'CANCELLED';
export function inView(x, v, nowMs) {
    switch (v) {
        case 'ACTIVE': return !isClosed(x);
        case 'MINE': return !isClosed(x) && x.mine;
        case 'TODAY': return !isClosed(x) && Number.isFinite(ts(x.dueIso)) && istDay(ts(x.dueIso)) === istDay(nowMs);
        case 'LATE': return !isClosed(x) && x.late;
        case 'DECISION': return !isClosed(x) && (x.state === 'AWAITING_DECISION');
        case 'PROGRESS': return x.state === 'IN_PROGRESS';
        case 'DONE': return isClosed(x);
    }
}
export const DEFAULT_FILTERS = { view: 'ACTIVE', dept: null, type: null, q: '' };
const norm = (s) => s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
export function applyFilters(items, f, nowMs) {
    const q = norm(f.q.trim());
    return items.filter((x) => inView(x, f.view, nowMs) && (!f.dept || x.department === f.dept) && (!f.type || x.type === f.type || (f.type === 'MANUAL' && x.origin === 'MANUAL') || (f.type === 'RECORD' && x.origin === 'RECORD'))
        && (!q || norm([x.title, x.description ?? '', x.typeLabel, x.source?.label ?? '', x.source?.id ?? '', x.assigneeLabel, x.department ?? '', x.stateLabel].join(' ')).includes(q)));
}
export function viewCounts(items, nowMs) {
    const c = {};
    for (const v of VIEWS)
        c[v.id] = items.filter((x) => inView(x, v.id, nowMs)).length;
    return c;
}
export function summarize(items, nowMs) {
    const open = items.filter((x) => !isClosed(x));
    return { active: open.length, critical: open.filter((x) => x.tier <= 2).length, late: open.filter((x) => x.late).length, today: items.filter((x) => inView(x, 'TODAY', nowMs)).length, progress: open.filter((x) => x.state === 'IN_PROGRESS').length, decision: open.filter((x) => x.state === 'AWAITING_DECISION').length, actionable: open.filter((x) => x.actionable).length };
}
export const facets = (items) => ({
    departments: [...new Set(items.map((x) => x.department).filter((d) => !!d))].sort((a, b) => a.localeCompare(b, 'tr')),
    types: [...new Set(items.map((x) => x.type))].filter((t) => t !== 'NONE').map((id) => ({ id, label: SOURCE_TR[id] ?? 'Kayıt' })).sort((a, b) => a.label.localeCompare(b.label, 'tr')),
});
/** Paging for long lists: the first `page` rows now, more on demand (the DOM never gets thousands of rows). */
export const pageOf = (rows, shown) => ({ rows: rows.slice(0, shown), more: Math.max(0, rows.length - shown) });
/** The task a QR label opens. Access is NOT decided here: the task simply is not in task_floor for anyone who may not see it. */
export function taskIdFromQr(raw) { const m = /^KMI:TASK:([A-Za-z0-9_-]{1,64})$/.exec(raw.trim()); return m ? m[1] : null; }
export const encodeTaskQr = (id) => `KMI:TASK:${id}`;
