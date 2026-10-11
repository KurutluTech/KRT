// KMI NEXT — Process Mining (46), Digital Twin Lite (47), Next Best Action (48), Management Copilot (49).
// Twin of migrations 0046 + 0047. No external AI: the copilot is a rule-based router over canonical
// sources and says "BİLMİYORUM / VERİ YETERSİZ" when a question does not map to KMI records.
// ---- process mining ----
export const PM_MIN_COMPLETE_CASES = 5;
export const PM_MIN_TRANSITION_SUPPORT = 3;
const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Same rules as kmi_next.process_mining: incomplete cases excluded; bottleneck only with enough data. */
export function mineProcess(events, opts = {}) {
    const byCase = new Map();
    for (const e of events)
        byCase.set(e.caseId, [...(byCase.get(e.caseId) ?? []), e]);
    const complete = [];
    let incomplete = 0;
    for (const evs of byCase.values()) {
        const sorted = [...evs].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
        const first = sorted[0].fromStatus;
        if (first === null || (opts.operationLog && first === 'PENDING'))
            complete.push(sorted);
        else
            incomplete += 1;
    }
    const sufficiency = complete.length >= PM_MIN_COMPLETE_CASES ? 'SUFFICIENT' : 'INSUFFICIENT';
    const durations = new Map();
    for (const c of complete)
        for (let i = 0; i + 1 < c.length; i += 1) {
            const k = `${c[i].activity}|${c[i + 1].activity}`;
            durations.set(k, [...(durations.get(k) ?? []), (Date.parse(c[i + 1].at) - Date.parse(c[i].at)) / 3600000]);
        }
    const transitions = [...durations.entries()].map(([k, hs]) => {
        const [from, to] = k.split('|');
        return { from, to, count: hs.length, medianHours: Math.round(median(hs) * 100) / 100 };
    }).sort((a, b) => b.medianHours - a.medianHours || (a.from + a.to < b.from + b.to ? -1 : 1));
    const reworkCases = complete.filter((c) => new Set(c.map((e) => e.activity)).size < c.length).length;
    const bottleneck = sufficiency === 'SUFFICIENT' ? transitions.find((t) => t.count >= PM_MIN_TRANSITION_SUPPORT) ?? null : null;
    return { cases: byCase.size, completeCases: complete.length, incompleteCases: incomplete, sufficiency, transitions, reworkCases, bottleneck };
}
export function twinConfidence(m) {
    const reasons = [
        m.noEstimate > 0 ? 'İşlerin bir kısmının süre tahmini yok' : null,
        m.skillReview === 'UNKNOWN' ? 'Makine yetkinlik şartları incelenmedi' : null,
        !m.stateRecorded ? 'Makine durumu hiç kaydedilmedi (varsayılan UP)' : null,
    ].filter((x) => x !== null);
    return { confidence: reasons.length ? 'LOW' : 'HIGH', reasons };
}
export const NBA_RULE_ACTION = {
    FIRST_PIECE_WAITING: 'FIRST_PIECE_APPROVE', OPERATION_QC_WAITING: 'OPERATION_QC_RECORD', QUALITY_HOLD_OPEN: 'QUALITY_HOLD_RELEASE',
    NCR_DISPOSITION: 'QUALITY_REJECT', MAINTENANCE_TEST_WAITING: 'MAINTENANCE_TEST_RELEASE', UNASSIGNED_DUE_SOON: 'WORK_ORDER_ASSIGN_MACHINE',
    MACHINE_SKILL_UNKNOWN: 'MACHINE_SKILL_VERIFY', PURCHASE_REQUESTS_WAITING: 'PURCHASING_APPROVE', ORDERS_OVERDUE: 'MANAGEMENT_RELEASE',
};
/** A suggestion is shown only to someone who holds the action that resolves it. */
export function visibleNbaRules(allowedActions) {
    return Object.entries(NBA_RULE_ACTION).filter(([, a]) => allowedActions.has(a)).map(([r]) => r).sort();
}
const lowerTr = (s) => s.replace(/İ/g, 'i').toLowerCase();
export function copilotIntent(question) {
    const q = ` ${lowerTr(question).replace(/[^a-z0-9çğıöşüâ ]/g, ' ')} `;
    const mc = / (10[1-9]|11[0-3]|cmm|forklift|opt|vibromak) /.exec(q)?.[1];
    if (/ (maliyet\S*|k[aâ]r|k[aâ]r[ıi]|k[aâ]rl\S*|marj\S*|fiyat\S*|tutar\S*|fatura\S*|ciro\S*|zarar\S*) /.test(q))
        return { intent: 'ECONOMIC' };
    if (/ (maaş\S*|maas\S*|prim|primi|primler\S*|puantaj\S*|izin\S*|mesai\S*) /.test(q) || / geç kal/.test(q))
        return { intent: 'PERSONAL' };
    if (mc && /(neden|niye|dur|arıza|ariza|çalışmıyor|durum|bozuk)/.test(q))
        return { intent: 'MACHINE_WHY', machine: mc.toUpperCase() };
    if (/sipariş|siparis/.test(q) && /(risk|gecik|termin|yetiş)/.test(q))
        return { intent: 'ORDERS_AT_RISK' };
    if (/malzeme|hammadde/.test(q) && /(bekl|eksik|yok)/.test(q))
        return { intent: 'MATERIAL_WAIT' };
    if (/kalite/.test(q) && /(blok|bekl|hold|dur|takıl)/.test(q))
        return { intent: 'QUALITY_BLOCKED' };
    if (/veri/.test(q) && /(eksik|yok|hangi)/.test(q))
        return { intent: 'DATA_GAPS' };
    if (/darboğaz|darbogaz/.test(q) || (/vardiya/.test(q) && /(yük|kapasite|sıkış)/.test(q)))
        return { intent: 'BOTTLENECK' };
    return { intent: 'UNKNOWN' };
}
export const COPILOT_EXAMPLES = [
    'Bugün hangi siparişler riskte?', '111 numaralı makine neden duruyor?', 'Hangi iş emirleri malzeme bekliyor?',
    'Hangi operasyon kalite nedeniyle bloke?', 'Hangi makinelerde veri eksik?', 'Önümüzdeki vardiyada darboğaz nerede?',
];
