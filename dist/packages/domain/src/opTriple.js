// Üçlü üretim doğruluğu — gösterim modeli. KARAR/HESAP SUNUCUDA (op_triple_canonical / op_cycle_canonical, m0216);
// bu dosya yalnız yanıtı ekranlara aynı biçimde çevirir. Hiçbir değer burada yeniden hesaplanmaz.
export const LABEL_TR = {
    STANDART_CEVRIM: 'Onaylı standart çevrim', PLANLAMA_CEVRIMI: 'Planlamada kullanılan çevrim', TEKNIK_HESAP_CEVRIM: 'Teknik hesap (CAM)', ONERILEN_CEVRIM: 'Önerilen çevrim (onay bekler)',
    HEDEF_ADET: 'Hedef adet', PLANLANAN_SETUP: 'Planlanan hazırlık (setup)',
    SON_OLCULEN_CEVRIM: 'Son ölçülen çevrim', TIPIK_MEDYAN_CEVRIM: 'Tipik (medyan) çevrim', MAKINE_CEVRIM_SAYISI: 'Makine çevrim sayısı', TAHMIN_ADET: 'Çevrimden tahmin edilen adet', OLCULEN_SETUP: 'Kanıtlı ölçülen setup',
    BEYAN_SAGLAM: 'Beyan: sağlam', BEYAN_HURDA: 'Beyan: hurda', BEYAN_TASHIH: 'Beyan: tashih / yeniden işleme', BEYAN_SETUP: 'Beyan: setup', CALISMA_SURESI_IS_EMRI_OLAYI: 'Çalışma süresi (iş emri olayları)', BEYAN_DURUS: 'Beyan: duruş',
};
export const UNIT_TR = { s: 'sn', dk: 'dk', adet: 'adet', cevrim: 'çevrim' };
export const MISSING_TR = {
    OLCUM_KIMLIK_VEYA_WO_BAGLAMI_YOK: 'Makine/program/iş emri eşleşmesi kanıtlanmadı — ölçüm bu iş emrine bağlanmadı',
    PARCA_CEVRIM_ORANI_VE_KALITE_DOGRULANMADI: 'Parça/çevrim oranı ve kalite sonucu doğrulanmadan adet türetilmez', PARCA_CEVRIM_ORANI_DOGRULANMADI: 'Parça/çevrim oranı doğrulanmadı',
    SETUP_BEYAN_DEPOSU_YOK: 'Operatör setup beyanı için kayıt alanı yok', SETUP_BITISI_YOK: 'Setup bitişi yok', SETUP_BASLANGICI_YOK: 'Setup başlangıcı yok',
    MAKINE_OLAYI_ILE_DOGRULANAMADI: 'İş emri aralığı makine olayıyla doğrulanamadı', MAKINE_ESLEMESI_YOK: 'Makine eşlemesi yok', BEYAN_YOK: 'Operatör beyanı yok',
    BASLANGIC_VEYA_BITIS_YOK: 'Başlangıç veya bitiş yok', DURUS_BEYAN_DEPOSU_BU_PAKETTE_YOK: 'Duruş beyanı kayıt alanı yok', OPERATOR_CEVRIM_BEYANI_YOK: 'Operatör çevrim beyanı alanı yok',
    ONERI_YOK_VEYA_KOSUL_SAGLANMADI: 'Öneri yok veya koşullar (taze veri, kimlik kanıtı, yeterli örnek) sağlanmadı', CAM_IDEAL_CEVRIM_YOK: 'CAM ideal çevrim süresi girilmemiş', SETUP_PLANI_YOK: 'Setup planı girilmemiş',
    SETUP_OLCUMU_YOK: 'Setup ölçümü yok', KAPSAM_DISI_TAKIMHANE_M0214_M0215: 'Takımhane paketi (m0214/m0215) bekliyor', KAPSAM_DISI_KALITE_STOK_KANONIK_KAYITLARI: 'Kalite/stok uzlaştırması bu pakette yok',
    DURUS_KANONIK_KAYNAGI_BU_PAKETTE_YOK: 'Duruş için kanonik kaynak bu pakette yok', STANDART_YOK: 'Standart girilmemiş', KANIT_YOK: 'Kanıt yok',
};
export const CMP_TR = {
    STANDART_CEVRIM_vs_GERCEK_MEDYAN: 'Standart çevrim ↔ gerçek çevrim', GERCEK_CEVRIM_vs_BEYAN_CEVRIM: 'Gerçek çevrim ↔ operatör beyanı', HEDEF_ADET_vs_BEYAN_TOPLAM: 'Hedef adet ↔ beyan edilen toplam',
    MAKINE_CEVRIM_SAYISI_vs_BEYAN_TOPLAM_ADET: 'Makine çevrim sayısı ↔ beyan edilen adet', SETUP_PLAN_vs_OLCULEN: 'Planlanan setup ↔ ölçülen setup', SETUP_OLCULEN_vs_BEYAN: 'Ölçülen setup ↔ beyan edilen setup',
    DURUS_PLAN_vs_GERCEK_vs_BEYAN: 'Duruş: plan ↔ gerçek ↔ beyan', TAKIM_DEGISIMI_ve_OMUR_SAPMASI: 'Takım değişimi ve ömür sapması', KALITE_ve_STOK_UZLASTIRMASI: 'Kalite ve stok uzlaştırması',
};
export const SRC_TR = { ONAYLI_OLCUM_ONERISI: 'ölçüm önerisinden, yetkili onayla', ROTA_MANUEL: 'rotaya elle girilmiş', STANDART: 'onaylı standart', IS_EMRI: 'iş emri', ROTA_SNAPSHOT: 'iş emri açılışındaki rota kaydı',
    CAM_IDEAL_CEVRIM: 'CAM ideal çevrim', MTCONNECT: 'MTConnect makine verisi', OPERATOR_BEYANI: 'operatör beyanı', 'IS_EMRI_OLAYI+MTCONNECT': 'iş emri olayları + makine olayı', YOK: 'kaynak yok' };
export const REL_TR = { TAZE: 'taze', ESKI: 'ESKİ VERİ', ONAYLI: 'onaylı', HESAP: 'hesap', ONERI: 'öneri', PLAN: 'plan', SAYIM: 'sayım', KANITLI: 'kanıtlı', BEYAN: 'beyan', OLAY: 'olay kaydı', UNKNOWN: 'BİLİNMİYOR', ANOMALI: 'ANOMALİ (tipik çevrimden çok sapıyor)', 'YÜKSEK': 'yüksek', ORTA: 'orta', 'DÜŞÜK': 'düşük', 'YETERSİZ': 'yetersiz', YOK: 'yok' };
const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const toneOf = (r) => (r === 'UNKNOWN' || r === 'ESKI' || r === 'YOK' ? 'bad' : r === 'TAZE' || r === 'ONAYLI' || r === 'KANITLI' || r === 'YÜKSEK' ? 'ok' : 'warn');
export const rowView = (i) => {
    const known = i.value !== null && i.value !== undefined;
    return { key: i.key, label: LABEL_TR[i.key] ?? i.key, known, valueText: known ? `${nf.format(Number(i.value))} ${UNIT_TR[i.unit] ?? i.unit}` : 'BİLİNMİYOR',
        source: SRC_TR[i.source] ?? i.source ?? '', at: i.at ?? null, reliability: known ? (REL_TR[i.reliability] ?? i.reliability) : null, tone: toneOf(i.reliability), missing: known ? null : (MISSING_TR[i.missing] ?? i.missing ?? 'Kanıt yok') };
};
export const cmpView = (c) => {
    const unk = c.status === 'UNKNOWN' || c.status === 'ORAN_DOGRULANMADI';
    return { key: c.key, label: CMP_TR[c.key] ?? c.key, status: c.status, statusText: c.status === 'ORAN_DOGRULANMADI' ? 'DOĞRULANAMAZ' : unk ? 'BİLİNMİYOR' : c.status === 'SAPMA' ? 'SAPMA' : 'uyumlu', tone: c.status === 'ORAN_DOGRULANMADI' ? 'warn' : unk ? 'bad' : c.status === 'SAPMA' ? 'warn' : 'ok',
        a: c.a ?? null, b: c.b ?? null, diffText: c.diff == null || c.status === 'ORAN_DOGRULANMADI' ? null : `${c.diff > 0 ? '+' : ''}${nf.format(c.diff)}${c.diffPct == null ? '' : ` (%${nf.format(c.diffPct)})`}`,
        reason: unk ? (MISSING_TR[c.unknownReason] ?? c.unknownReason ?? 'Kanıt yok') : null, note: c.note ?? null };
};
/** op_triple_canonical yanıtı (camelCase) → üç sütun + karşılaştırmalar */
export function tripleView(t) {
    if (!t) return null;
    return { columns: [{ id: 'plan', title: 'OLMASI GEREKEN', sub: 'Plan: onaylı standart, teknik hesap, öneri ayrı', rows: (t.plan ?? []).map(rowView) },
        { id: 'actual', title: 'GERÇEKLEŞEN', sub: 'MTConnect makine verisi; çevrim sayısı sağlam parça değildir', rows: (t.actual ?? []).map(rowView) },
        { id: 'declared', title: 'BEYAN EDİLEN', sub: 'Operatör beyanı; özgün kayıt değiştirilmez', rows: (t.declared ?? []).map(rowView) }],
        comparisons: (t.comparisons ?? []).map(cmpView), flags: (t.reviewFlags ?? []).map((f) => f.dedupeKey), declarationEvents: t.declarationEvents ?? 0 };
}
/** op_cycle_canonical yanıtı → rota/makine ekranları için tek model */
export function canonicalCycleView(c) {
    if (!c) return null;
    const lv = c.measured?.lastValid;
    return { status: c.status, fresh: c.fresh === true, standard: { seconds: c.standard?.seconds ?? null, source: c.standard?.source ?? 'YOK' }, planning: c.planning?.seconds ?? null,
        lastValid: lv ? { seconds: lv.seconds, at: lv.at, stale: lv.stale === true } : null,
        lastCycle: c.measured?.lastCycle ? { seconds: c.measured.lastCycle.seconds, at: c.measured.lastCycle.at, stale: c.measured.lastCycle.stale === true, anomaly: c.measured.lastCycle.anomaly === true, deviationPct: c.measured.lastCycle.deviationVsTypicalPct ?? null } : null,
        anomalyCount: (c.measured?.anomalies ?? []).length, anomalyPct: c.measured?.anomalyPct ?? null, median: c.measured?.medianSeconds ?? null, samples: c.measured?.validSamples ?? 0,
        suggestion: c.suggestion ? { seconds: c.suggestion.seconds, basisEventId: c.suggestion.basisEventId, deltaPct: c.suggestion.deltaPct ?? null, identity: c.suggestion.identityBasis } : null,
        identityBasis: c.identity?.basis ?? 'YOK', autoEligible: c.identity?.autoEligible === true, reasons: c.identity?.reasons ?? [] };
}

export const CAM_STEP_TR = { TEKNIK_IYILESTIRME: '1 · Teknik iyileştirme (yeni CAM revizyonu)', TEKNIK_DOGRULAMA: '2 · Teknik doğrulama', CAM_TEKNIK_ONAYI: '3 · CAM teknik onayı', ILK_PARCA: '4 · İlk parça (kalite)', URETIME_GECIS: '5 · Üretime geçiş' };
export const CAM_STATE_TR = { PASS: 'GEÇTİ', BLOCKED: 'ENGELLİ', BEKLIYOR: 'BEKLİYOR', HAZIR: 'HAZIR', KISMI: 'KISMİ — bilinmeyen kanıt var', ONAYLANDI: 'ONAYLANDI', BILINMIYOR: 'BİLİNMİYOR' };
export const CAM_CHECK_TR = { CAM_BAGLI: 'CAM programı bağlı', CAM_YURURLUKTE: 'CAM yürürlükte', PROGRAM_KIMLIGI: 'Program kimliği (NC adı + özeti)', MAKINE_UYUMU: 'Makine uyumu', TAKIM_LISTESI: 'Takım listesi', APARAT_VE_SETUP: 'Aparat ve setup gereksinimi' };
export const WO_STAGE_TR = { RESYNC_BEKLIYOR: 'eski CAM — iş emri eşitlemesi bekliyor', ESKI_REVIZYONDA_DEVAM: 'eski CAM revizyonunda devam ediyor (donuk)', ILK_PARCA_YENIDEN_KONTROL: 'ilk parça yeniden kontrol gerekli (temizleme yolu henüz yok — açık kusur)', ILK_PARCA_BEKLIYOR: 'kalite ilk parça onayı bekliyor',
    ILK_PARCA_GEREKLI_BASLAMADI: 'ilk parça gerekli, başlamadı', URETIMDE: 'üretimde (ilk parça geçerli)', DIGER: 'diğer' };
const stTone = (x) => (x === 'PASS' || x === 'ONAYLANDI' || x === 'HAZIR' ? 'ok' : x === 'BLOCKED' ? 'bad' : 'warn');
/** op_cam_improvement_state yanıtı (camelCase) → CAM iyileştirme ekranı modeli */
export function camStateView(s) {
    if (!s) return null;
    return { expectedVersion: s.expectedVersion ?? 0, revisionStatus: s.revisionStatus, standard: { seconds: s.standard?.seconds ?? null, source: SRC_TR[s.standard?.source] ?? s.standard?.source ?? 'YOK' },
        currentCam: s.currentCam ? { id: s.currentCam.camProgramId, text: `${s.currentCam.programNo} · rev ${s.currentCam.revision} · ${s.currentCam.status}`, technicalCycle: s.currentCam.technicalCycleSeconds ?? null } : null,
        candidates: (s.candidates ?? []).map((c) => ({ id: c.camProgramId, text: `${c.programNo} · rev ${c.revision}${c.idealCycleSeconds != null ? ` · teknik ${c.idealCycleSeconds} sn` : ''}` })),
        measured: s.measured ? { median: s.measured.medianSeconds ?? null, last: s.measured.lastCycle ?? null, anomalies: (s.measured.anomalies ?? []).length, basis: s.measured.identityBasis, fresh: s.measured.fresh === true } : null,
        steps: (s.steps ?? []).map((x) => ({ no: x.no, label: CAM_STEP_TR[x.key] ?? x.key, state: x.state, stateText: CAM_STATE_TR[x.state] ?? x.state, tone: stTone(x.state), detail: x.detail ?? null,
            checks: (x.checks ?? []).map((k) => ({ label: CAM_CHECK_TR[k.key] ?? k.key, state: k.state, stateText: CAM_STATE_TR[k.state] ?? k.state, tone: stTone(k.state), detail: k.detail ?? null })) })),
        wo: (s.workOrderOperations ?? []).map((w) => ({ id: w.woOperationId, stage: w.stage, stageText: WO_STAGE_TR[w.stage] ?? w.stage, fpValid: w.firstPieceValidForCurrentCam === true, tone: w.stage === 'URETIMDE' ? 'ok' : w.stage === 'ESKI_REVIZYONDA_DEVAM' || w.stage === 'RESYNC_BEKLIYOR' ? 'warn' : 'warn' })) };
}
