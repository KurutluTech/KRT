const DEFAULT_STALE_MS = 15 * 60_000;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
export function evaluateMetric(m, nowMs) {
    const t = m.asOf ? Date.parse(m.asOf) : NaN;
    const staleAfter = m.staleAfterMs ?? DEFAULT_STALE_MS;
    const stale = Number.isFinite(t) ? nowMs - t > staleAfter : false;
    const known = finite(m.value);
    const state = !known ? 'UNKNOWN' : stale ? 'STALE' : 'KNOWN';
    const base = m.baseline && finite(m.baseline.value) ? m.baseline.value : null;
    const amount = known && base !== null ? m.value - base : null;
    const percent = amount !== null && base !== null && base !== 0 ? (amount / Math.abs(base)) * 100 : null;
    const direction = amount === null ? 'UNKNOWN' : Math.abs(amount) < 1e-9 ? 'FLAT' : amount > 0 ? 'UP' : 'DOWN';
    const changeTone = direction === 'UNKNOWN' ? 'GREY' : direction === 'FLAT' || m.polarity === 'NEUTRAL' ? 'BLUE'
        : (direction === 'UP') === (m.polarity === 'HIGHER_IS_BETTER') ? 'GREEN' : 'RED';
    let tone = 'GREY';
    if (state === 'KNOWN' || state === 'STALE') {
        tone = 'BLUE';
        const worse = (limit) => finite(limit) && (m.polarity === 'LOWER_IS_BETTER' ? m.value >= limit : m.polarity === 'HIGHER_IS_BETTER' ? m.value <= limit : false);
        if (worse(m.threshold?.critical))
            tone = 'RED';
        else if (worse(m.threshold?.warn))
            tone = 'AMBER';
        else if (finite(m.target) && m.polarity !== 'NEUTRAL')
            tone = (m.polarity === 'HIGHER_IS_BETTER' ? m.value >= m.target : m.value <= m.target) ? 'GREEN' : 'AMBER';
        if (state === 'STALE' && tone === 'GREEN')
            tone = 'AMBER'; // an old "good" is not a current good
    }
    const statusText = state === 'UNKNOWN' ? 'BİLİNMİYOR' : state === 'STALE' ? 'ESKİ VERİ' : tone === 'RED' ? 'KRİTİK' : tone === 'AMBER' ? 'DİKKAT' : tone === 'GREEN' ? 'UYGUN' : 'BİLGİ';
    const ageMin = Number.isFinite(t) ? Math.max(0, Math.round((nowMs - t) / 60000)) : null;
    const freshText = ageMin === null ? 'Veri anı BİLİNMİYOR' : stale ? `Veri ${ageMin} dk önceki (eski)` : ageMin < 1 ? 'Az önceki veri' : `Veri ${ageMin} dk önceki`;
    // A recommendation is allowed only with a stated reason AND evidence to drill into; otherwise it is dropped (never shown as advice).
    const justified = !!m.recommendation && m.recommendation.because.trim().length > 0 && !!m.evidence && (!!m.evidence.href || m.evidence.description.trim().length > 0) && state !== 'UNKNOWN';
    return {
        id: m.id, label: m.label, source: m.source, unit: m.unit, state, value: known ? m.value : null, baselineLabel: m.baseline?.label ?? null, target: finite(m.target) ? m.target : null,
        change: { amount, percent, direction }, tone, changeTone, statusText, freshness: { asOf: m.asOf, stale, text: freshText }, impact: m.impact?.trim() ? m.impact : null, evidence: m.evidence ?? null,
        recommendation: justified ? m.recommendation : null, recommendationDropped: !!m.recommendation && !justified,
    };
}
export function validateInsight(i) {
    const out = [];
    if (!i.evidence.length || i.evidence.some((e) => !e.source.trim() || !e.quote.trim()))
        out.push('NO_EVIDENCE');
    if (!i.analysedAt || !Number.isFinite(Date.parse(i.analysedAt)))
        out.push('NO_ANALYSIS_TIME');
    if (!i.rationale.trim())
        out.push('NO_RATIONALE');
    if (!i.uncertainty)
        out.push('NO_UNCERTAINTY');
    const d = i.humanDecision;
    if (d.status !== 'PENDING') {
        if (!d.decidedBy || !d.decidedAt)
            out.push('DECISION_WITHOUT_HUMAN');
        if (!d.reason?.trim())
            out.push('DECISION_WITHOUT_REASON');
    }
    return out;
}
/** Shown to people only when it satisfies the contract; otherwise it is a hypothesis without proof and stays hidden (never presented as analysis). */
export const insightDisplayable = (i) => validateInsight(i).length === 0;
/** What a viewer may do with an insight: it can be reviewed, never auto-applied; a recommendation becomes an action only after an authorised human accepts it. */
export function insightActions(i, viewerMayDecide) {
    const open = i.humanDecision.status === 'PENDING' && validateInsight(i).length === 0;
    return { canAccept: open && viewerMayDecide && !!i.recommendation, canReject: open && viewerMayDecide, autoApply: false };
}
