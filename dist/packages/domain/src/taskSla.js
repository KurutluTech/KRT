const MIN = 60_000, DUE_SOON_MIN = 48 * 60, L1_MAX = 4 * 60, L2_MAX = 24 * 60;
const ts = (v) => (v ? Date.parse(v) : NaN);
const NONE = { level: 0, to: '', text: 'Eskalasyon gerekmiyor' };
/** Escalation ladder for an overdue task. Recommendation only — nothing is sent or written automatically. */
export const ESCALATION_LADDER = [
    { maxOverdueMin: L1_MAX, level: 1, to: 'Sorumlu', text: 'Sorumlu kişi uyarılır' },
    { maxOverdueMin: L2_MAX, level: 2, to: 'Departman yöneticisi', text: 'Departman yöneticisine bildirilir' },
    { maxOverdueMin: Infinity, level: 3, to: 'Yönetim', text: 'Yönetime yükseltilir' },
];
export function escalationFor(overdueMin) { const r = ESCALATION_LADDER.find((x) => overdueMin <= x.maxOverdueMin); return { level: r.level, to: r.to, text: r.text }; }
export function evaluateSla(i) {
    if (i.status === 'APPROVED' || i.status === 'CANCELLED')
        return { state: 'DONE', overdueMin: null, remainingMin: null, used: null, escalation: NONE };
    if (i.status === 'COMPLETED')
        return { state: 'AWAITING_APPROVAL', overdueMin: null, remainingMin: null, used: null, escalation: NONE };
    const due = ts(i.dueAt), created = ts(i.createdAt);
    const used = Number.isFinite(due) && Number.isFinite(created) && due > created ? Math.min(1.5, Math.max(0, (i.nowMs - created) / (due - created))) : null;
    if (!Number.isFinite(due))
        return i.serverLate ? { state: 'OVERDUE', overdueMin: null, remainingMin: null, used, escalation: { level: 1, to: 'Sorumlu', text: 'Sorumlu kişi uyarılır' } } : { state: 'NO_DUE', overdueMin: null, remainingMin: null, used: null, escalation: NONE };
    const diff = Math.floor((due - i.nowMs) / MIN);
    if (diff < 0 || i.serverLate) {
        const od = Math.max(0, -diff);
        return { state: 'OVERDUE', overdueMin: od, remainingMin: null, used, escalation: escalationFor(od) };
    }
    return { state: diff <= DUE_SOON_MIN ? 'DUE_SOON' : 'ON_TRACK', overdueMin: null, remainingMin: diff, used, escalation: NONE };
}
export const SLA_TR = { DONE: 'Kapandı', AWAITING_APPROVAL: 'Onay bekliyor', NO_DUE: 'Termin tanımlı değil', ON_TRACK: 'Zamanında', DUE_SOON: 'Termin yaklaşıyor', OVERDUE: 'Gecikti' };
export function durationTr(min) { const a = Math.abs(Math.round(min)); return a >= 2880 ? `${Math.floor(a / 1440)} gün` : a >= 120 ? `${Math.floor(a / 60)} sa${a % 60 ? ` ${a % 60} dk` : ''}` : `${a} dk`; }
