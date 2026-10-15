export const GAUGE_TR = { GO_NOGO: 'Mastar (geçer / geçmez)', CALIPER: 'Kumpas', MICROMETER: 'Mikrometre', DIAL_INDICATOR: 'Komparatör', BORE_GAUGE: 'Delik mastarı', THREAD_GAUGE: 'Diş mastarı', OTHER: 'Diğer ölçüm aracı' };
export const RESULT_TR = { CONFORMING: 'Uygun (sağlam)', TASHIH: 'TASHİH gerekli (düzeltilebilir)', SCRAP: 'Hurda' };
export function validateDeclaration(d, ctx = {}) {
    const e = [];
    if (!d.machineId || !d.workOrderId)
        e.push({ field: 'workOrder', message: 'Makine ve iş emri seçili olmalı.' });
    if (!d.characteristic.trim())
        e.push({ field: 'characteristic', message: 'Kontrol edilen ölçü / karakteristik yazılmalı.' });
    if (!Number.isInteger(d.qty) || d.qty < 1)
        e.push({ field: 'qty', message: 'Adet 1 veya daha büyük tam sayı olmalı.' });
    else if (typeof ctx.remainingQty === 'number' && d.qty > ctx.remainingQty)
        e.push({ field: 'qty', message: `Adet, iş emrinde kalan ${ctx.remainingQty} adedi aşıyor — bir parça iki kez sayılamaz.` });
    if (d.result !== 'CONFORMING' && d.reason.trim().length < 3)
        e.push({ field: 'reason', message: 'Uygunsuzluk nedeni yazılmalı (en az 3 karakter).' });
    if (d.result !== 'CONFORMING' && !d.containerCode.trim())
        e.push({ field: 'container', message: 'Ayrılan parçaların kap / lot kodu yazılmalı.' });
    if (d.result === 'TASHIH' && !d.handedToQuality)
        e.push({ field: 'handover', message: 'TASHİH parçaları kaliteye teslim edilmeden beyan kaydedilmez.' });
    if (d.result === 'CONFORMING')
        e.push({ field: 'result', message: 'Uygun parça için TASHİH beyanı gerekmez; sağlam adet SAĞLAM + ile sayılır.' });
    if (d.timing === 'END_OF_SHIFT' && !d.shift)
        e.push({ field: 'shift', message: 'Vardiya sonu beyanında vardiya bilinmeli.' });
    if (d.offset && d.offset.appliedOnMachine === 'OPERATOR_STATES_APPLIED' && !d.offset.toolCode.trim())
        e.push({ field: 'offset', message: 'Ofset düzeltme beyanı için takım kodu gerekli.' });
    if (d.hasPhoto)
        e.push({ field: 'photo', message: 'Fotoğraf eki için sunucuda dosya alanı yok (BLOKE) — açıklama yazın.' });
    return e;
}
export function splitCheck(s, produced) {
    const counted = s.good + s.tashih + s.scrap + s.pendingReview;
    return { ok: counted === produced, counted, unaccounted: Math.max(0, produced - counted), over: Math.max(0, counted - produced) };
}
/** Can this quantity move into GOOD stock? Never while it is a TASHİH part without a completed Quality decision AND rework. */
export function mayEnterGoodStock(p) {
    if (p.result === 'CONFORMING')
        return true;
    if (p.result === 'SCRAP')
        return false;
    return p.qualityDecision === 'ACCEPTED' || (p.qualityDecision === 'REWORK' && p.reworkDone && p.recheckPassed);
}
/** Server dependencies this declaration needs, in priority order, with what exists in this repository today. */
export const TASHIH_DEPENDENCIES = [
    { key: 'open_tahsis_ncr', need: 'TASHİH vakası (kalite NCR, kind=TAHSIS, kaynak OPERATOR_SELF_DECLARED)', state: 'DRAFT_UNAPPLIED', pkg: 'taslak 0076 — canlı DB\'ye uygulanmadı' },
    { key: 'gauge_container_offset_fields', need: 'Mastar, kap/lot, ofset alanları için ayrı sütunlar', state: 'MISSING', pkg: 'KMI-040/041 — şimdilik kayıt gerekçesine yazılır' },
    { key: 'quality_receipt', need: 'Kalitenin teslim aldığı adedi doğrulama kaydı', state: 'MISSING', pkg: 'KMI-041' },
    { key: 'rework_flow', need: 'Yeniden işleme ve tekrar kontrol akışı', state: 'MISSING', pkg: 'KMI-044' },
    { key: 'photo_storage', need: 'Fotoğraf eki', state: 'MISSING', pkg: 'dosya alanı kararı' },
    { key: 'shift_batch', need: 'Vardiya sonu toplu beyan ve mutabakat tablosu', state: 'MISSING', pkg: 'KMI-034 — şimdilik her beyan ayrı kaydedilir' },
];
/** The text the existing NCR `reason` field carries (until separate columns exist). Structured, single line per fact, Turkish, no secrets. */
export function buildNcrReason(d) {
    const L = [];
    L.push(d.timing === 'END_OF_SHIFT' ? `[VARDİYA SONU BEYANI${d.shift ? ` · ${d.shift}` : ''}${d.occurredAt ? ` · olay ${d.occurredAt}` : ''}]` : '[ANLIK BEYAN]');
    L.push(`Ölçü: ${d.characteristic.trim()}`);
    L.push(`Ölçüm aracı: ${GAUGE_TR[d.gauge]}${d.gaugeNote?.trim() ? ` (${d.gaugeNote.trim()})` : ''}`);
    L.push(`Sonuç: ${RESULT_TR[d.result]} · neden: ${d.reason.trim()}`);
    L.push(`Kap/lot: ${d.containerCode.trim()} · kaliteye teslim: ${d.handedToQuality ? 'evet (operatör beyanı)' : 'hayır'}`);
    if (d.offset)
        L.push(`Ofset kaydı: takım ${d.offset.toolCode.trim() || '—'}${d.offset.correctionMm !== null ? `, düzeltme ${d.offset.correctionMm} mm` : ''}; makineye uygulama: ${d.offset.appliedOnMachine === 'OPERATOR_STATES_APPLIED' ? 'operatör uyguladığını beyan etti (doğrulanmadı)' : 'beyan yok'}`);
    if (d.operationNo !== null)
        L.push(`Operasyon: ${d.operationNo}`);
    if (d.productCode)
        L.push(`Ürün: ${d.productCode}`);
    if (d.operatorName)
        L.push(`Operatör: ${d.operatorName}`);
    if (d.note?.trim())
        L.push(`Not: ${d.note.trim()}`);
    return L.join(' | ');
}
