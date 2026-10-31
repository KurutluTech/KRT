// OP30 MTConnect çevrim analizi — görüntüleme yardımcıları. KARAR SUNUCUDA verilir (op_cycle_estimate, m0182);
// bu dosya yalnız (a) tahmin yanıtını gösterim modeline çevirir, (b) son çevrimleri sunucu kuralıyla AYNI sırayla etiketler.
export const CONF_TR = { 'YÜKSEK': 'Yüksek', 'ORTA': 'Orta', 'DÜŞÜK': 'Düşük', 'YETERSİZ': 'Yetersiz', 'YOK': 'Yok' };
export const STATUS_TR = {
    ESLEME_YOK: 'Eşleme yok — ölçüm bu operasyona bağlanmadı',
    YENI_SERI_BEKLIYOR: 'Yeni ölçüm serisi bekleniyor',
    YETERSIZ_ORNEK: 'Yetersiz örnek — plan süresi korunuyor',
    DALGALI: 'Ölçüm dalgalı — plan süresi korunuyor',
    KULLANILIYOR: 'Telemetri medyanı gösteriliyor',
};
export const EXCL_TR = { M30_ATLAMA: 'M30 sayacı +1 değil', SURE_YOK: 'süre yok', COK_KISA: 'plan aralığının altında', COK_UZUN: 'plan aralığının üstünde', PROGRAM: 'başka program', SERI_ONCESI: 'seri başlangıcından önce' };
export const TONE = { 'YÜKSEK': 'ok', 'ORTA': 'warn', 'DÜŞÜK': 'bad', 'YETERSİZ': 'bad', 'YOK': 'bad' };
/** Tek çevrim olayını sunucuyla aynı kurallarla sınıflar (yalnız gösterim). */
export function classifyCycle(ev, ctx) {
    if (ctx.seriesStartedAt && Date.parse(ev.sourceTs) < Date.parse(ctx.seriesStartedAt)) return 'SERI_ONCESI';
    if (ctx.program && String(ev.program ?? '').trim().toLowerCase() !== String(ctx.program).trim().toLowerCase()) return 'PROGRAM';
    if (Number(ev.m30After) - Number(ev.m30Before) !== 1) return 'M30_ATLAMA';
    const s = ev.lastCycleS === null || ev.lastCycleS === undefined ? null : Number(ev.lastCycleS);
    if (s === null || !(s > 0)) return 'SURE_YOK';
    if (ctx.plan && s < ctx.plan * ctx.minPct / 100) return 'COK_KISA';
    if (ctx.plan && s > ctx.plan * ctx.maxPct / 100) return 'COK_UZUN';
    return 'GECERLI';
}
/** Sunucu yanıtı → gösterim modeli. Telemetri ile plan/operatör değeri ASLA karıştırılmaz. */
export function estimateView(e) {
    if (!e) return { state: 'NONE', headline: 'Veri yok', tone: 'bad' };
    const eff = e.effectiveSource === 'TELEMETRI_MEDYAN';
    return {
        state: e.status, headline: STATUS_TR[e.status] ?? e.status, tone: TONE[e.confidence] ?? 'bad',
        planSeconds: e.planSeconds ?? null, medianSeconds: e.medianSeconds ?? null,
        usedSeconds: e.effectiveSeconds ?? null, usedSource: eff ? 'MTConnect telemetri medyanı' : 'Rota plan süresi',
        confidence: CONF_TR[e.confidence] ?? e.confidence, validSamples: e.validSamples ?? 0, usedSamples: e.usedSamples ?? 0,
        excluded: Object.entries(e.excluded ?? {}).map(([k, n]) => `${EXCL_TR[k] ?? k}: ${n}`),
        contentVerified: e.contentVerified === true, nameMatch: e.nameMatch ?? null,
        operatorDeclarationUsed: e.operatorDeclarationUsed === true,
    };
}
