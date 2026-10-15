import { actionState, KIND_ACTION, KIND_LABEL, nextStepText, OUTCOME_LABEL, priorityOf, PRIORITY_RANK, REJECT_LABEL } from './approvalsInbox.js';
export const GATE_ACTION = { FIRST_PIECE_APPROVAL: 'FIRST_PIECE_APPROVE', QUALITY_HOLD_RELEASE: 'QUALITY_HOLD_RELEASE' };
export const ROW_KIND_LABEL = { ...KIND_LABEL, FIRST_PIECE_APPROVAL: 'Kalite · ilk parça onayı', QUALITY_HOLD_RELEASE: 'Kalite · HOLD kaldırma' };
export const DEPT_OF = {
    COMMERCIAL_MGMT_RELEASE: 'Yönetim', COMMERCIAL_DECISION: 'Muhasebe', PURCHASE_REQUEST: 'Satınalma', PURCHASE_ORDER: 'Satınalma', TASK_COMPLETION: 'Yönetim', FIRST_PIECE_APPROVAL: 'Kalite', QUALITY_HOLD_RELEASE: 'Kalite',
};
/** Q3 "why is a decision needed" — the workflow rule behind the gate, in the words of the floor. */
export const WHY = {
    COMMERCIAL_MGMT_RELEASE: 'Final Kalite sonrası sevkiyat zincirinin yönetim serbest bırakma adımı; yönetim kararı olmadan ticari karar açılmaz.',
    COMMERCIAL_DECISION: 'Yönetim parçayı serbest bıraktı; ticari/muhasebe belgeleme sonrası ticari onay gerekir.',
    PURCHASE_REQUEST: 'Malzeme talebi, satınalma onayı olmadan siparişe çevrilemez.',
    PURCHASE_ORDER: 'Sipariş, tedarikçiye gönderilmeden önce satınalma onayı ister.',
    TASK_COMPLETION: 'Tamamlayan kişi kendi işini onaylayamaz (dört göz); işin kapanması için ikinci bir yetkili gerekir.',
    FIRST_PIECE_APPROVAL: 'Seri üretime geçmeden önce ilk parçanın kalite onayı gerekir.',
    QUALITY_HOLD_RELEASE: 'Kalite HOLD açık; kaldırmak ayrı yetki ve gerekçe ister (Kalite PASS, HOLD kaldırmanın yerine geçmez).',
};
/** Q4 "what stops if I do not decide". */
export const IF_WAITING = {
    COMMERCIAL_MGMT_RELEASE: 'Parti ticari karara geçemez, sevkiyata hazırlanamaz.',
    COMMERCIAL_DECISION: 'Parti "Sevkiyata hazırla" adımına geçemez; sevkiyat bekler.',
    PURCHASE_REQUEST: 'Malzeme tedariki başlamaz; ilgili iş emri malzeme bekleyebilir.',
    PURCHASE_ORDER: 'Sipariş tedarikçiye gönderilemez; teslim tarihi kayar.',
    TASK_COMPLETION: 'Görev "onay bekliyor" durumunda kalır, kapanmaz.',
    FIRST_PIECE_APPROVAL: 'İş emri ilk parça beklemesinde kalır; seri üretim ve sonraki serbest bırakma kapıları açılmaz.',
    QUALITY_HOLD_RELEASE: 'Parti / iş emri HOLD’da kalır; sonraki kapılar (üretim, sevkiyat) açılmaz.',
};
const NO = { visible: false, enabled: false, why: null };
/** the quality gate a derived work item stands for, if the person holds the action to decide it there (one rule for the list AND for the Home count) */
export function gateKindFor(g, held) {
    const kind = g.sourceType === 'QUALITY_HOLD' && g.status === 'OPEN' ? 'QUALITY_HOLD_RELEASE' : g.sourceType === 'WORK_ORDER' && g.status === 'FIRST_PIECE_PENDING' ? 'FIRST_PIECE_APPROVAL' : null;
    return kind && held.has(GATE_ACTION[kind]) ? kind : null;
}
export const countGates = (gates, held) => gates.filter((g) => gateKindFor(g, held) !== null).length;
export function buildRows(inp) {
    const out = [];
    for (const i of inp.items) {
        const approve = actionState(i, 'APPROVE', inp.held), reject = actionState(i, 'REJECT', inp.held);
        out.push({ id: i.key, kind: i.kind, kindLabel: KIND_LABEL[i.kind], dept: DEPT_OF[i.kind], title: i.record, owner: i.owner, requestedAt: i.requestedAt, waitingHours: i.waitingHours, priority: i.priority, priorityWhy: i.priorityWhy,
            overdue: i.overdue, critical: i.overdue, state: 'PENDING', outcome: null, outcomeLabel: null, decidedAt: null, decidedBy: null, reason: null, reasonNote: null, why: WHY[i.kind], ifWaiting: IF_WAITING[i.kind], facts: i.facts ?? [], related: i.related, link: i.link,
            redirectOnly: false, mine: approve.enabled || reject.enabled, approve, reject, rejectLabel: REJECT_LABEL[i.kind], nextApprove: nextStepText(i, 'APPROVE'), nextReject: nextStepText(i, 'REJECT'), completedByMe: i.completedByMe, recordId: i.recordId, neededBy: i.neededBy });
    }
    for (const g of inp.gates ?? []) {
        const kind = gateKindFor(g, inp.held);
        if (!kind)
            continue; // a person is shown only the gates he may decide
        const p = priorityOf(null, g.due, inp.nowMs);
        const priority = p.priority === 'KRITIK' ? 'KRITIK' : 'YUKSEK';
        out.push({ id: `${kind}:${g.sourceId}`, kind, kindLabel: ROW_KIND_LABEL[kind], dept: DEPT_OF[kind], title: g.title, owner: null, requestedAt: null, waitingHours: null, priority, priorityWhy: p.priority === 'KRITIK' ? p.why : 'Üretimi durduran kalite kapısı (bekleme süresi kayıtta yok)',
            overdue: p.priority === 'KRITIK', critical: true, state: 'PENDING', outcome: null, outcomeLabel: null, decidedAt: null, decidedBy: null, reason: null, reasonNote: null, why: WHY[kind], ifWaiting: IF_WAITING[kind],
            facts: [{ label: 'Durum', value: g.status }, ...(g.due ? [{ label: 'Planlı tarih', value: g.due }] : [])], related: [], link: g.route ? `#${g.route}` : null, redirectOnly: true, mine: true, approve: NO, reject: NO,
            rejectLabel: 'Reddet', nextApprove: 'Karar kalite ekranında verilir; kaynak kayıt orada değişir.', nextReject: 'Karar kalite ekranında verilir; kaynak kayıt orada değişir.', completedByMe: false, recordId: g.sourceId, neededBy: g.due });
    }
    for (const h of inp.history) {
        out.push({ id: `DONE:${h.key}`, kind: h.kind, kindLabel: KIND_LABEL[h.kind], dept: DEPT_OF[h.kind], title: h.record, owner: null, requestedAt: null, waitingHours: null, priority: 'NORMAL', priorityWhy: '', overdue: false, critical: false, state: 'DONE', outcome: h.outcome,
            outcomeLabel: OUTCOME_LABEL[h.outcome], decidedAt: h.decidedAt, decidedBy: h.decidedBy, reason: h.reason, reasonNote: h.reasonNote, why: WHY[h.kind], ifWaiting: '', facts: [], related: h.related, link: null, redirectOnly: false, mine: false, approve: NO, reject: NO,
            rejectLabel: REJECT_LABEL[h.kind], nextApprove: '', nextReject: '', completedByMe: false, recordId: h.key.split(':')[1] ?? h.key, neededBy: null });
    }
    return out.sort(compareRows);
}
/** pending first: decisions that are mine, critical, by priority, longest waiting; decided rows newest first */
export function compareRows(a, b) {
    if (a.state !== b.state)
        return a.state === 'PENDING' ? -1 : 1;
    if (a.state === 'DONE')
        return (Date.parse(b.decidedAt ?? '') || 0) - (Date.parse(a.decidedAt ?? '') || 0) || a.id.localeCompare(b.id);
    return Number(b.mine) - Number(a.mine) || Number(b.critical) - Number(a.critical) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (b.waitingHours ?? -1) - (a.waitingHours ?? -1) || a.id.localeCompare(b.id);
}
export const AP_VIEWS = [{ id: 'PENDING', label: 'Bekleyen' }, { id: 'CRITICAL', label: 'Kritik' }, { id: 'OVERDUE', label: 'Gecikmiş' }, { id: 'DONE', label: 'Tamamlanan' }];
export const AP_DEFAULT = { view: 'PENDING', q: '', dept: null, kind: null, owner: null, days: null, mine: false };
const norm = (s) => s.toLocaleLowerCase('tr-TR');
const inView = (r, v) => v === 'DONE' ? r.state === 'DONE' : r.state === 'PENDING' && (v === 'PENDING' || (v === 'CRITICAL' ? r.critical : r.overdue));
export function applyApFilters(rows, f, nowMs) {
    const q = norm(f.q.trim());
    return rows.filter((r) => {
        if (!inView(r, f.view))
            return false;
        if (f.dept && r.dept !== f.dept)
            return false;
        if (f.kind && r.kind !== f.kind)
            return false;
        if (f.owner && r.owner !== f.owner)
            return false;
        if (f.mine && !r.mine)
            return false;
        if (f.days !== null) {
            const t = Date.parse((r.state === 'DONE' ? r.decidedAt : r.requestedAt) ?? '');
            if (!Number.isFinite(t) || nowMs - t > f.days * 86_400_000)
                return false;
        } // an unknown date never matches a date filter
        if (q && !norm(`${r.title} ${r.kindLabel} ${r.dept} ${r.owner ?? ''} ${r.decidedBy ?? ''} ${r.facts.map((x) => x.value).join(' ')}`).includes(q))
            return false;
        return true;
    });
}
export function viewCountsAp(rows) {
    return { PENDING: rows.filter((r) => inView(r, 'PENDING')).length, CRITICAL: rows.filter((r) => inView(r, 'CRITICAL')).length, OVERDUE: rows.filter((r) => inView(r, 'OVERDUE')).length, DONE: rows.filter((r) => inView(r, 'DONE')).length };
}
export function summarizeAp(rows) {
    const c = viewCountsAp(rows);
    const pend = rows.filter((r) => r.state === 'PENDING');
    const longest = pend.reduce((m, r) => (r.waitingHours === null ? m : m === null || r.waitingHours > m ? r.waitingHours : m), null);
    return { pending: c.PENDING, critical: c.CRITICAL, overdue: c.OVERDUE, done: c.DONE, mine: pend.filter((r) => r.mine).length, longestHours: longest };
}
export function facetsAp(rows) {
    const kinds = new Map();
    const depts = new Set();
    const owners = new Set();
    for (const r of rows) {
        kinds.set(r.kind, r.kindLabel);
        depts.add(r.dept);
        if (r.owner)
            owners.add(r.owner);
    }
    return { depts: [...depts].sort((a, b) => a.localeCompare(b, 'tr')), kinds: [...kinds].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, 'tr')), owners: [...owners].sort((a, b) => a.localeCompare(b, 'tr')) };
}
/** Which sources a person may read for decisions (Onaylarım shows only the person's own decisions — no commercial / management data for someone who cannot decide on it). */
export function sourcesFor(held) {
    const has = (k) => held.has(KIND_ACTION[k]);
    return { commercial: has('COMMERCIAL_MGMT_RELEASE') || has('COMMERCIAL_DECISION') || held.has('COMMERCIAL_RELEASE'), requests: has('PURCHASE_REQUEST'), orders: has('PURCHASE_ORDER'), tasks: has('TASK_COMPLETION') };
}
