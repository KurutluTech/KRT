// KMI NEXT — Temporal Intelligence (KMI-RECOVERY-004 §7–§10). Pure functions, no I/O.
// Rules: the server clock is the only operational seal ("kayıt zamanı"); times are stored in UTC and shown in Europe/Istanbul;
// a user-reported event time ("olay zamanı") never replaces the record time; history that cannot be proven is NEVER invented
// (stateAsOf answers UNVERIFIABLE instead). These are KMI-internal operational/audit seals — NOT a legally qualified electronic timestamp.
export const KMI_TZ = 'Europe/Istanbul';
const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: KMI_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function wallParts(iso) {
    const m = {};
    for (const p of partsFmt.formatToParts(typeof iso === 'string' ? new Date(iso) : iso))
        if (p.type !== 'literal')
            m[p.type] = Number(p.value);
    return { y: m['year'], mo: m['month'], d: m['day'], h: m['hour'], mi: m['minute'], s: m['second'] };
}
const pad = (n) => String(n).padStart(2, '0');
/** `12.10.2026 · 18:11:35` (Europe/Istanbul). Invalid/absent → `—` (never a fabricated time). */
export function formatStamp(iso, seconds = true) {
    if (!iso)
        return '—';
    const t = Date.parse(iso);
    if (Number.isNaN(t))
        return '—';
    const p = wallParts(new Date(t));
    return `${pad(p.d)}.${pad(p.mo)}.${p.y} · ${pad(p.h)}:${pad(p.mi)}${seconds ? ':' + pad(p.s) : ''}`;
}
/** UTC instant of 00:00 Istanbul wall time on the given wall date (offset derived from the zone, not hard-coded). */
export function istanbulMidnightUtc(y, mo, d) {
    const guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
    for (const off of [3, 2, 4]) { // Turkey has been UTC+3 since 2016; the loop keeps old dates correct
        const cand = new Date(guess - off * 3600000);
        const p = wallParts(cand);
        if (p.y === y && p.mo === mo && p.d === d && p.h === 0 && p.mi === 0)
            return cand;
    }
    return new Date(guess - 3 * 3600000);
}
const addDays = (y, mo, d, n) => { const t = new Date(Date.UTC(y, mo - 1, d + n)); return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
export const TIME_PRESETS = [
    { code: 'TODAY', tr: 'Bugün' }, { code: 'YESTERDAY', tr: 'Dün' }, { code: 'THIS_WEEK', tr: 'Bu hafta' }, { code: 'THIS_MONTH', tr: 'Bu ay' },
    { code: 'LAST_MONTH', tr: 'Geçen ay' }, { code: 'LAST_30_DAYS', tr: 'Son 30 gün' }, { code: 'THIS_YEAR', tr: 'Bu yıl' }, { code: 'CUSTOM', tr: 'Özel aralık' },
];
/** Preset → half-open UTC range on Istanbul day boundaries. Week starts Monday. CUSTOM needs from/to as Istanbul wall dates `YYYY-MM-DD` (+ optional `HH:MM`). */
export function resolveRange(preset, nowIso, custom) {
    const n = wallParts(nowIso);
    const day = (y, mo, d) => istanbulMidnightUtc(y, mo, d).toISOString();
    switch (preset) {
        case 'TODAY': {
            const t = addDays(n.y, n.mo, n.d, 1);
            return { from: day(n.y, n.mo, n.d), to: day(t.y, t.mo, t.d) };
        }
        case 'YESTERDAY': {
            const y = addDays(n.y, n.mo, n.d, -1);
            return { from: day(y.y, y.mo, y.d), to: day(n.y, n.mo, n.d) };
        }
        case 'THIS_WEEK': {
            const dow = (new Date(Date.UTC(n.y, n.mo - 1, n.d)).getUTCDay() + 6) % 7; // Monday=0
            const s = addDays(n.y, n.mo, n.d, -dow);
            const e = addDays(n.y, n.mo, n.d, 7 - dow);
            return { from: day(s.y, s.mo, s.d), to: day(e.y, e.mo, e.d) };
        }
        case 'THIS_MONTH': {
            const ny = n.mo === 12 ? n.y + 1 : n.y;
            const nm = n.mo === 12 ? 1 : n.mo + 1;
            return { from: day(n.y, n.mo, 1), to: day(ny, nm, 1) };
        }
        case 'LAST_MONTH': {
            const py = n.mo === 1 ? n.y - 1 : n.y;
            const pm = n.mo === 1 ? 12 : n.mo - 1;
            return { from: day(py, pm, 1), to: day(n.y, n.mo, 1) };
        }
        case 'LAST_30_DAYS': {
            const s = addDays(n.y, n.mo, n.d, -29);
            const t = addDays(n.y, n.mo, n.d, 1);
            return { from: day(s.y, s.mo, s.d), to: day(t.y, t.mo, t.d) };
        }
        case 'THIS_YEAR': return { from: day(n.y, 1, 1), to: day(n.y + 1, 1, 1) };
        case 'CUSTOM': {
            if (!custom)
                return null;
            const one = (v, endOfDay) => {
                const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(v.trim());
                if (!m)
                    return null;
                const base = istanbulMidnightUtc(Number(m[1]), Number(m[2]), Number(m[3]));
                if (m[4] !== undefined)
                    return new Date(base.getTime() + (Number(m[4]) * 60 + Number(m[5])) * 60000);
                return endOfDay ? new Date(base.getTime() + 86400000) : base; // a bare end date includes that whole day
            };
            const f = one(custom.from, false);
            const t = one(custom.to, true);
            if (!f || !t || t <= f)
                return null;
            return { from: f.toISOString(), to: t.toISOString() };
        }
    }
}
/** Compares INSTANTS, not strings: PostgREST returns `+00:00` / `+03:00` / fractional seconds while ranges are `...Z`, and lexicographic comparison misplaces boundary events. */
export const inRange = (iso, r) => {
    if (!r)
        return true;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= Date.parse(r.from) && t < Date.parse(r.to);
};
const stateOf = (o) => {
    if (!o)
        return null;
    for (const k of ['status', 'state', 'toStatus', 'decision', 'location', 'active']) {
        const v = o[k];
        if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number')
            return String(v);
    }
    return null;
};
const show = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** Field-by-field change list between two state snapshots (keys are camelCased by the data client). Unchanged fields are omitted; nothing is invented when a side is missing. */
export function diffStates(before, after) {
    if (!before && !after)
        return [];
    const out = [];
    for (const k of [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort()) {
        const a = before?.[k];
        const b = after?.[k];
        if (JSON.stringify(a) !== JSON.stringify(b))
            out.push({ field: k, from: show(a), to: show(b) });
    }
    return out;
}
/** `YYYY-MM-DDTHH:MM` typed as Istanbul wall time → UTC ISO (null when malformed). */
export function parseIstanbulLocal(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(v.trim());
    if (!m)
        return null;
    const base = istanbulMidnightUtc(Number(m[1]), Number(m[2]), Number(m[3]));
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    if (hh > 23 || mm > 59)
        return null;
    return new Date(base.getTime() + (hh * 60 + mm) * 60000).toISOString();
}
export function auditToEvent(r, actorNames = {}) {
    const occ = r.afterState && typeof r.afterState['occurredAt'] === 'string' ? r.afterState['occurredAt'] : null;
    return { id: r.id, at: r.at, occurredAt: occ, source: 'AUDIT', action: r.action, entityType: r.entityType, entityId: r.entityId, actorId: r.actorUserId, actorName: actorNames[r.actorUserId] ?? null,
        fromState: stateOf(r.beforeState), toState: stateOf(r.afterState), reason: r.reason, changes: diffStates(r.beforeState, r.afterState), outcome: 'SUCCESS' };
}
/** Late report: the source stored an event time that is earlier than the record time by more than `thresholdMin`. */
export function lateReportMinutes(e, thresholdMin = 5) {
    if (!e.occurredAt)
        return null;
    const d = (Date.parse(e.at) - Date.parse(e.occurredAt)) / 60000;
    return d > thresholdMin ? Math.round(d) : null;
}
export function filterEvents(events, f) {
    const text = f.text?.trim().toLocaleLowerCase('tr-TR');
    return events.filter((e) => {
        const t = f.basis === 'OCCURRED' && e.occurredAt ? e.occurredAt : e.at; // grouping day follows the chosen basis; a late report is never re-dated silently
        if (f.range && !inRange(t, f.range))
            return false;
        if (f.action && e.action !== f.action)
            return false;
        if (f.actor && e.actorId !== f.actor && e.actorName !== f.actor)
            return false;
        if (f.source && e.source !== f.source)
            return false;
        if (text && !`${e.action} ${e.reason ?? ''} ${e.actorName ?? ''} ${e.entityType} ${e.entityId} ${e.fromState ?? ''} ${e.toState ?? ''}`.toLocaleLowerCase('tr-TR').includes(text))
            return false;
        return true;
    }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export const UNVERIFIABLE_TR = 'TARİHSEL DURUM DOĞRULANAMIYOR';
/**
 * State at `asOfIso` computed ONLY from recorded events. basis RECORDED = what KMI knew at that moment (events recorded by then);
 * basis OCCURRED = what actually was true at that moment given everything recorded since (needs a stored event time; otherwise falls back to
 * the record time). `revised` = the OCCURRED answer differs from the RECORDED one (a later/late entry changed history).
 */
export function stateAsOf(events, asOfIso, opts) {
    const asOf = Date.parse(asOfIso);
    if (Number.isNaN(asOf))
        return { kind: 'UNVERIFIABLE', reason: 'BAD_INPUT' };
    if (opts.createdAt && Date.parse(opts.createdAt) > asOf)
        return { kind: 'NOT_EXISTING' };
    const compute = (basis) => {
        const t = (e) => Date.parse(basis === 'OCCURRED' && e.occurredAt ? e.occurredAt : e.at);
        const all = [...events].sort((a, b) => t(a) - t(b));
        if (all.length === 0)
            return { kind: 'UNVERIFIABLE', reason: 'NO_EVENTS' };
        for (let i = 1; i < all.length; i++)
            if (all[i].from !== null && all[i].from !== all[i - 1].to) {
                if (t(all[i]) <= asOf)
                    return { kind: 'UNVERIFIABLE', reason: 'BROKEN_CHAIN' };
            }
        const upTo = all.filter((e) => t(e) <= asOf && (basis === 'OCCURRED' || Date.parse(e.at) <= asOf));
        if (upTo.length > 0) {
            const last = upTo[upTo.length - 1];
            return { kind: 'KNOWN', state: last.to, since: basis === 'OCCURRED' && last.occurredAt ? last.occurredAt : last.at, revised: false };
        }
        const first = all[0];
        if (first.from && opts.createdAt)
            return { kind: 'KNOWN', state: first.from, since: opts.createdAt, revised: false }; // state before the first recorded change
        return { kind: 'UNVERIFIABLE', reason: 'NO_START_STATE' };
    };
    const wanted = opts.basis ?? 'RECORDED';
    const res = compute(wanted);
    if (res.kind === 'KNOWN' && wanted === 'OCCURRED') {
        const rec = compute('RECORDED');
        if (rec.kind !== 'KNOWN' || rec.state !== res.state)
            return { ...res, revised: true };
    }
    return res;
}
// ---- Turkish labels for audit vocabulary --------------------------------------------------------------------------------
const ACTION_TR = {
    WORK_ORDER_CREATED: 'İş emri oluşturuldu', WORK_ORDER_MACHINE_ASSIGNED: 'Makine atandı', WORK_ORDER_OPERATOR_ASSIGNED: 'Operatör atandı', WORK_ORDER_STATUS_TRANSITION: 'İş emri durumu değişti',
    PRODUCTION_DECLARED: 'Üretim beyanı', PRODUCTION_CORRECTED: 'Üretim düzeltmesi', QUALITY_HOLD_OPENED: 'Kalite HOLD açıldı', QUALITY_HOLD_RELEASED: 'Kalite HOLD kaldırıldı', QUALITY_REJECTED: 'Kalite RED',
    MACHINE_SET_DOWN: 'Makine DOWN', MACHINE_RETURNED_TO_SERVICE: 'Makine servise döndü', MACHINE_HOLD_SET: 'Makine HOLD', MACHINE_RESUMED_FROM_HOLD: 'Makine HOLD\'dan döndü', MACHINE_CONDITION_SET: 'Makine durumu girildi',
    MAINTENANCE_TICKET_TRANSITIONED: 'Bakım kaydı ilerledi', COMMERCIAL_APPROVAL_REQUESTED: 'Ticari onay istendi', MANAGEMENT_RELEASE_GRANTED: 'Yönetim serbest bırakma', COMMERCIAL_APPROVAL_DECIDED: 'Ticari karar',
    SHIPMENT_CREATED: 'Sevkiyat oluşturuldu', SHIPMENT_TRANSITION: 'Sevkiyat durumu', STOCK_LOT_CREATED: 'Parti oluşturuldu', STOCK_LOT_TRANSITION: 'Parti durumu', STOCK_LOT_SHIPPED: 'Parti sevk edildi',
    TASK_CREATED: 'Görev açıldı', TASK_STARTED: 'Görev başladı', TASK_COMPLETED: 'Görev tamamlandı', TASK_APPROVED: 'Görev onaylandı', TASK_CANCELLED: 'Görev iptal', TASK_REOPENED: 'Görev yeniden açıldı',
    PURCHASE_ORDER_APPROVED: 'Satınalma onaylandı', PURCHASE_ORDER_CREATED: 'Satınalma siparişi', GOODS_RECEIPT_RECORDED: 'Mal kabul', TOOL_LOCATION_TRANSITIONED: 'Takım konumu', TOOL_WEAR_RECORDED: 'Takım aşınması',
    BADGES_AWARDED: 'Rozet verildi', BADGE_WITHDRAWN: 'Rozet geri alındı', COMPETENCY_LEVEL_SET: 'Yetkinlik seviyesi', PERSONNEL_CREATED: 'Personel kaydı', PERSONNEL_SHIFT_SET: 'Vardiya değişti',
    PRODUCT_CREATED: 'Ürün oluşturuldu', PRODUCT_REVISION_CREATED: 'Revizyon oluşturuldu', PRODUCT_REVISION_RELEASED: 'Revizyon yayınlandı', CUSTOMER_CREATED: 'Müşteri oluşturuldu', ORDER_CREATED: 'Sipariş oluşturuldu',
};
export function actionTr(action) {
    return ACTION_TR[action] ?? action.toLocaleLowerCase('tr-TR').replace(/_/g, ' ').replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'));
}
