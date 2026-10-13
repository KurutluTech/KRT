export const PERSPECTIVE_TR = { FINANCIAL: 'Finansal', CUSTOMER: 'Müşteri', PROCESS: 'İç süreçler', LEARNING_GROWTH: 'Öğrenme ve gelişim' };
export const KPI_STATE_TR = { ACHIEVED: 'Hedefe ulaşıldı', ON_TRACK: 'Yolunda', AT_RISK: 'Risk altında', OFF_TRACK: 'Hedefin gerisinde', UNKNOWN: 'BİLİNMİYOR (gerçekleşme yok)' };
/** Default interpretation bands (display only, stated on screen): ≥100 achieved, ≥80 on track, ≥50 at risk, else off track. */
export const KPI_BANDS = { achieved: 100, onTrack: 80, atRisk: 50 };
/** Attainment in percent. With a baseline on the "wrong" side of the target it is progress from baseline to target; otherwise plain ratio. null = UNKNOWN (never 0). */
export function attainment(k) {
    if (k.actual === null || !Number.isFinite(k.actual) || !Number.isFinite(k.target))
        return null;
    const { direction: d, target: t, baseline: b, actual: a } = k;
    let pct;
    if (d === 'HIGHER_IS_BETTER') {
        if (b !== null && b < t)
            pct = ((a - b) / (t - b)) * 100;
        else if (t > 0)
            pct = (a / t) * 100;
        else
            return null; // target ≤ 0 with no usable baseline: ratio undefined → UNKNOWN, not a made-up number
    }
    else {
        if (b !== null && b > t)
            pct = ((b - a) / (b - t)) * 100;
        else if (a <= 0)
            pct = t >= 0 ? 100 : 0;
        else if (t > 0)
            pct = (t / a) * 100;
        else
            pct = a <= t ? 100 : 0;
    }
    return Math.round(pct * 10) / 10;
}
export function kpiState(pct) {
    if (pct === null)
        return 'UNKNOWN';
    if (pct >= KPI_BANDS.achieved)
        return 'ACHIEVED';
    if (pct >= KPI_BANDS.onTrack)
        return 'ON_TRACK';
    if (pct >= KPI_BANDS.atRisk)
        return 'AT_RISK';
    return 'OFF_TRACK';
}
/** Perspective score = mean attainment of KNOWN KPIs, each capped at 100 so one over-achiever cannot hide a miss; unknown KPIs are counted, not averaged in. */
export function perspectiveScore(pcts) {
    const known = pcts.filter((p) => p !== null);
    if (known.length === 0)
        return { score: null, known: 0, unknown: pcts.length };
    const mean = known.reduce((s, p) => s + Math.min(100, Math.max(0, p)), 0) / known.length;
    return { score: Math.round(mean * 10) / 10, known: known.length, unknown: pcts.length - known.length };
}
export const RISK_BAND_TR = { KRITIK: 'KRİTİK', YUKSEK: 'YÜKSEK', ORTA: 'ORTA', DUSUK: 'DÜŞÜK' };
/** 5×5 matrix: score = likelihood × impact. ≥15 critical, ≥10 high, ≥5 medium, else low. */
export function riskBand(score) { return score >= 15 ? 'KRITIK' : score >= 10 ? 'YUKSEK' : score >= 5 ? 'ORTA' : 'DUSUK'; }
export function isOverdue(due, status, today, closed = ['DONE', 'CANCELLED', 'CLOSED']) {
    return !!due && !closed.includes(status) && due < today;
}
export const RULE_TEXT = {
    R_APPROVAL_AGING: 'Bir onay 72 saatten uzun süredir bekliyorsa (Onaylar sekmesindeki KRİTİK kuralı) yöneticiye karar önerilir.',
    R_KPI_OFF_TRACK: 'Bir KPI\'nın gerçekleşmesi hedefin %50\'sinin altındaysa (KPI yorum bandı) inceleme önerilir.',
    R_RISK_NO_ACTION: 'Skoru 15 ve üzeri (KRİTİK) bir riskin açık aksiyonu yoksa aksiyon planı önerilir.',
    R_RISK_REVIEW_OVERDUE: 'Gözden geçirme tarihi geçmiş ve kapanmamış bir risk için yeniden değerlendirme önerilir.',
    R_ACTION_OVERDUE: 'Vadesi geçmiş açık bir aksiyon için sorumlu ile görüşme / yeniden planlama önerilir.',
    R_DECISION_OVERDUE: 'Vadesi geçmiş açık bir toplantı kararı için takip önerilir.',
    R_CRITICAL_ALERT: 'Komuta merkezinde KRİTİK seviyede açık bir uyarı varsa yönetim ilgisi önerilir.',
};
export function buildRecommendations(i) {
    const out = [];
    for (const a of i.approvals)
        if (a.waitingHours !== null && a.waitingHours >= 72)
            out.push({ key: `R_APPROVAL_AGING:${a.key}`, ruleCode: 'R_APPROVAL_AGING', severity: 'KRITIK', title: `Onay bekliyor: ${a.record}`,
                why: `${a.kindLabel} ${Math.floor(a.waitingHours / 24)} gündür karar bekliyor.`, humanAction: 'Onaylar sekmesinden gerekçeyle onaylayın veya reddedin.', link: '#/yonetim?sekme=onaylar',
                evidence: [{ label: 'Bekleme', value: `${Math.floor(a.waitingHours)} saat`, source: 'Onaylar kuyruğu' }, { label: 'Kayıt', value: a.record, source: a.kindLabel }] });
    for (const k of i.kpis)
        if (k.pct !== null && k.pct < KPI_BANDS.atRisk)
            out.push({ key: `R_KPI_OFF_TRACK:${k.id}:${k.period}`, ruleCode: 'R_KPI_OFF_TRACK', severity: k.pct < 25 ? 'KRITIK' : 'YUKSEK', title: `KPI hedefin gerisinde: ${k.name}`,
                why: `${k.period} dönemi gerçekleşme ${k.actual} ${k.unit}, hedef ${k.target} ${k.unit} (%${k.pct}).`, humanAction: 'Nedeni inceleyin; gerekirse Strateji sekmesinde aksiyon açın veya toplantı kararı alın.', link: '#/yonetim?sekme=strateji',
                evidence: [{ label: 'Gerçekleşme', value: `${k.actual} ${k.unit}`, source: k.actualSource ?? 'kayıt' }, { label: 'Hedef', value: `${k.target} ${k.unit}`, source: 'Hedef kaydı' }, { label: 'Başarı', value: `%${k.pct}`, source: 'KPI hesabı' }] });
    for (const r of i.risks) {
        if (r.score >= 15 && r.status !== 'CLOSED' && r.openActions === 0)
            out.push({ key: `R_RISK_NO_ACTION:${r.id}`, ruleCode: 'R_RISK_NO_ACTION', severity: 'KRITIK', title: `Kritik riskin aksiyonu yok: ${r.title}`,
                why: `Risk skoru ${r.score} (KRİTİK) ve açık aksiyon yok.`, humanAction: 'Risk sekmesinde sorumlusu ve tarihi olan bir aksiyon açın.', link: '#/yonetim?sekme=risk',
                evidence: [{ label: 'Skor', value: String(r.score), source: 'Risk kaydı' }, { label: 'Açık aksiyon', value: '0', source: 'Risk kaydı' }] });
        if (isOverdue(r.reviewDate, r.status, i.today))
            out.push({ key: `R_RISK_REVIEW_OVERDUE:${r.id}:${r.reviewDate}`, ruleCode: 'R_RISK_REVIEW_OVERDUE', severity: 'YUKSEK', title: `Risk gözden geçirmesi gecikti: ${r.title}`,
                why: `Gözden geçirme tarihi ${r.reviewDate} geçti.`, humanAction: 'Riski yeniden değerlendirin (olasılık / etki / durum).', link: '#/yonetim?sekme=risk',
                evidence: [{ label: 'Gözden geçirme', value: r.reviewDate ?? '', source: 'Risk kaydı' }, { label: 'Bugün', value: i.today, source: 'Sistem tarihi (Europe/Istanbul)' }] });
    }
    for (const a of i.actions)
        if (isOverdue(a.dueDate, a.status, i.today))
            out.push({ key: `R_ACTION_OVERDUE:${a.id}`, ruleCode: 'R_ACTION_OVERDUE', severity: 'YUKSEK', title: `Aksiyon gecikti: ${a.title}`,
                why: `${a.parent} aksiyonunun vadesi ${a.dueDate} idi; sorumlu: ${a.ownerName ?? 'BİLİNMİYOR'}.`, humanAction: 'Sorumluyla görüşün; kapatın, yeniden planlayın veya iptal gerekçesi yazın.', link: '#/yonetim',
                evidence: [{ label: 'Vade', value: a.dueDate, source: 'Aksiyon kaydı' }, { label: 'Durum', value: a.status, source: 'Aksiyon kaydı' }] });
    for (const d of i.decisions)
        if (isOverdue(d.dueDate, d.status, i.today))
            out.push({ key: `R_DECISION_OVERDUE:${d.id}`, ruleCode: 'R_DECISION_OVERDUE', severity: 'ORTA', title: `Toplantı kararı gecikti: ${d.text.slice(0, 60)}`,
                why: `Karar vadesi ${d.dueDate} geçti; sorumlu: ${d.ownerName ?? 'BİLİNMİYOR'}.`, humanAction: 'Toplantılar sekmesinde kararın durumunu notla güncelleyin.', link: '#/yonetim?sekme=toplanti',
                evidence: [{ label: 'Vade', value: d.dueDate ?? '', source: 'Karar kaydı' }] });
    for (const al of i.alerts)
        if (al.severity === 'CRITICAL')
            out.push({ key: `R_CRITICAL_ALERT:${al.key}`, ruleCode: 'R_CRITICAL_ALERT', severity: 'KRITIK', title: `Kritik uyarı: ${al.title}`,
                why: al.detail ?? 'Komuta merkezi bu uyarıyı KRİTİK olarak işaretledi.', humanAction: 'İlgili ekranı açıp sorumluyla aksiyon kararı verin.', link: '#/komuta',
                evidence: [{ label: 'Uyarı', value: al.title, source: 'Komuta merkezi' }, ...(al.since ? [{ label: 'Başlangıç', value: al.since, source: 'Komuta merkezi' }] : [])] });
    const rank = { KRITIK: 0, YUKSEK: 1, ORTA: 2 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.key.localeCompare(b.key));
}
/** A recommendation is OPEN unless a human already decided it: ACCEPTED/REJECTED hide it for good; POSTPONED hides it until the chosen date. History is newest-first per key. */
export function splitRecommendations(recs, history, today) {
    const latest = new Map();
    for (const h of history) {
        const cur = latest.get(h.recKey);
        if (!cur || h.decidedAt > cur.decidedAt)
            latest.set(h.recKey, h);
    }
    const open = [];
    const decided = [];
    for (const r of recs) {
        const d = latest.get(r.key);
        if (!d)
            open.push(r);
        else if (d.decision === 'POSTPONED' && d.postponedUntil !== null && d.postponedUntil <= today)
            open.push(r);
        else
            decided.push({ rec: r, decision: d });
    }
    return { open, decided };
}
