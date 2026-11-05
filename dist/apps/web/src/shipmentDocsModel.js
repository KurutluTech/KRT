// Sevkiyat belge modeli — SAF fonksiyon. Kural/durum üretmez: sunucudaki kayıtlardan okunur özet çıkarır (karar sunucuda: shipment_docs_gap, shipment_doc_*).
export const DOC_TR = { INVOICE: 'Fatura', DELIVERY_NOTE: 'İrsaliye' };
export const DOC_STATUS_TR = { DRAFT: 'Onay bekliyor', APPROVED: 'Onaylı', REJECTED: 'Reddedildi', SUPERSEDED: 'Geçersiz (yenisi var)' };
const n = (x) => Number(x) || 0;
/** facts: { shipment, lines[{stockLotId,qty}], docs[{id,docType,docNo,qty,status,preparedBy}], lots Map(id→{qty,state}), approvals[{stockLotId,status}], me } */
export function buildShipmentView(f) {
    const lines = f.lines ?? [], docs = f.docs ?? [], approvals = f.approvals ?? [];
    const total = lines.reduce((s, l) => s + n(l.qty), 0);
    const live = (t) => docs.find((d) => d.docType === t && (d.status === 'DRAFT' || d.status === 'APPROVED')) ?? null;
    const per = {};
    for (const t of ['INVOICE', 'DELIVERY_NOTE']) {
        const d = live(t);
        per[t] = d ? { doc: d, matches: n(d.qty) === total, state: d.status } : { doc: null, matches: false, state: 'MISSING' };
    }
    const locked = lines.some((l) => approvals.some((a) => a.stockLotId === l.stockLotId && a.status === 'APPROVED'));
    const blockers = [];
    if (!lines.length) blockers.push('Sevkiyatta lot yok.');
    for (const t of ['INVOICE', 'DELIVERY_NOTE']) {
        const p = per[t];
        if (p.state === 'MISSING') blockers.push(`${DOC_TR[t]} kaydı yok.`);
        else if (!p.matches) blockers.push(`${DOC_TR[t]} miktarı (${n(p.doc.qty)}) sevkiyat toplamıyla (${total}) eşleşmiyor.`);
        else if (p.state === 'DRAFT') blockers.push(`${DOC_TR[t]} henüz onaylanmadı.`);
    }
    const notStaged = lines.filter((l) => (f.lots?.get?.(l.stockLotId)?.state) !== 'STAGED').length;
    const ready = blockers.length === 0;
    let next;
    if (!lines.length) next = { who: 'Sevkiyat', action: 'Sevkiyata lot ekleyin.' };
    else if (per.INVOICE.state === 'MISSING' || per.DELIVERY_NOTE.state === 'MISSING') next = { who: 'Muhasebe', action: 'Fatura ve irsaliyeyi sevk miktarıyla kaydedin.' };
    else if (!ready) next = { who: 'Muhasebe (hazırlayandan farklı kişi)', action: 'Belgeleri kontrol edip onaylayın.' };
    else if (!locked) next = { who: 'Yönetim / Ticari onay', action: 'Her lot için Management ve Commercial Release verilmeli.' };
    else if (notStaged > 0) next = { who: 'Depo/Sevkiyat', action: `${notStaged} lot sevke hazır (STAGED) değil.` };
    else next = { who: 'Depo/Sevkiyat', action: 'Araç yüklenip çıktığında fiziksel sevkiyatı beyan edin.' };
    return { total, per, blockers, ready, locked, next, status: f.shipment?.status ?? null };
}
/** Lot adayları: bu sevkiyatla AYNI sipariş kaleminden, canlı bir sevkiyatta olmayan lotlar. */
export function candidateLots(allLots, liveShipmentLotIds, orderItemOfLot, orderItem) {
    return allLots.filter((l) => ['AVAILABLE', 'RESERVED', 'STAGED'].includes(l.state) && !liveShipmentLotIds.has(l.id) && (orderItem == null || orderItemOfLot.get(l.id) === orderItem));
}
