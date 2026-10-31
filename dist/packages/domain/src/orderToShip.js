// Order-to-Ship zinciri (12 aşama) — SAF fonksiyon: sunucunun canonical kayıtlarını OKUNUR özete çevirir. Kendi iş kuralı/durum hesabı üretmez.
// Kural: kaynak kayıt YOKSA veya okunamıyorsa NO_DATA; kaynak var ama henüz kayıt yoksa WAITING (önceki aşama bekliyor). Zincir yalnız TÜM aşamalar DONE ise "doğrulandı" sayılır.
export const STATE_TR = { DONE: 'TAMAM', PARTIAL: 'KISMİ', WAITING: 'BEKLİYOR', BLOCKED: 'ENGEL', NO_DATA: 'VERİ YOK' };
export const STAGES = [
    ['ORDER', 'Sipariş'], ['WO', 'İş emri'], ['PREP', 'Malzeme ve takım hazırlığı'], ['PROD', 'Operasyonlar / üretim'], ['OPQC', 'Operasyon kalitesi / First Piece'],
    ['FINALQ', 'Final Quality'], ['FINALREL', 'Final Production Release'], ['MGMT', 'Management / Business Release'], ['ACCDOCS', 'Accounting / Commercial Documentation'],
    ['COMMREL', 'Commercial Release'], ['SHIPREADY', 'Shipping Readiness'], ['SHIP', 'Shipment Completed'],
];
/** Kaynak (canonical tablo/fonksiyon) — ekranda ve raporda gösterilir. null = ayrı canonical kayıt yok. */
export const SOURCES = {
    ORDER: 'orders.status', WO: 'work_orders.status', PREP: 'work_order_readiness()', PROD: 'work_order_operations.status/qty_good', OPQC: 'work_order_operations.first_piece_at, qc_result, fp_recheck_required + quality_holds + quality_ncrs',
    FINALQ: 'final_quality_releases (RPC final_quality_get)', FINALREL: 'work_order_operations.qty_released (son operasyon)', MGMT: 'commercial_approvals.management_released_at', ACCDOCS: 'commercial_documents (RPC commercial_docs_status)', COMMREL: 'commercial_approvals.status',
    SHIPREADY: 'stock_lots.state (STAGED/SHIPPED)', SHIP: 'shipments.status',
};
const GAP = { FINALQ: 'Final Quality kaydı okunamadı (yetki yok ya da m0184 henüz uygulanmadı)', ACCDOCS: 'ticari belge kaydı okunamadı (yetki yok ya da m0184 henüz uygulanmadı); sevkiyat sonrası fatura bu aşamayı doldurmaz' };
const REASON_TR = {
    'MATERIAL_REQUIREMENT_UNKNOWN:NO_REVISION': 'ürün revizyonu bağlı değil', 'MATERIAL_REQUIREMENT_UNKNOWN:BOM_EMPTY': 'BOM boş — malzeme ihtiyacı bilinmiyor',
    'TOOL_REQUIREMENT_UNKNOWN:NO_CAM_PROGRAM': 'CAM programı bağlı değil — takım ihtiyacı bilinmiyor', 'TOOL_REQUIREMENT_UNKNOWN:CAM_NO_TOOLS': 'CAM programında takım listesi yok',
};
const reasonText = (r) => (r ? (REASON_TR[r] ?? (r.startsWith('MATERIAL_SHORTAGE:') ? `malzeme eksik: ${r.split(':')[1]}` : r.startsWith('TOOL_NOT_READY:') ? `takım hazır değil: ${r.split(':')[1]}` : r)) : '');
const n = (x) => Number(x) || 0;
/** facts: { orderStatus, item, wos[], readiness: Map(woId->rows), ops[], lots[], holds[], ncrs[], approvals[], shipments[], invoices[], unreadable: Set|string[] } (camelCase) */
export function buildChain(facts) {
    const { orderStatus, item = {}, readiness } = facts;
    const wos = facts.wos ?? item.workOrders ?? [];
    const un = new Set(facts.unreadable ?? []);
    const ops = facts.ops ?? [], lots = facts.lots ?? [], holds = facts.holds ?? [], ncrs = facts.ncrs ?? [], approvals = facts.approvals ?? [], shipments = facts.shipments ?? [], invoices = facts.invoices ?? [];
    const out = [];
    const put = (key, state, detail) => out.push({ key, label: STAGES.find((s) => s[0] === key)[1], state, detail, source: SOURCES[key] });
    const noRead = (key, table) => { if (un.has(table)) { put(key, 'NO_DATA', `${table} okunamadı (yetki/erişim) — kaynak: ${SOURCES[key]}`); return true; } return false; };
    const upstreamOk = () => out.every((s) => s.state === 'DONE');
    // 1 Sipariş
    put('ORDER', orderStatus === 'CANCELLED' ? 'BLOCKED' : ['CONFIRMED', 'IN_PRODUCTION', 'PARTIALLY_SHIPPED', 'SHIPPED', 'CLOSED'].includes(orderStatus) ? 'DONE' : 'WAITING', `durum: ${orderStatus ?? '—'}`);
    // 2 İş emri
    if (!wos.length) put('WO', 'WAITING', n(item.woNeed) > 0 ? `iş emri gerekli: ${item.woNeed}` : 'iş emri yok');
    else if (wos.some((w) => w.status === 'ON_HOLD')) put('WO', 'BLOCKED', 'HOLD — bu ekrandan kaldırılmaz');
    else if (wos.every((w) => w.status === 'CANCELLED')) put('WO', 'BLOCKED', 'iş emri iptal');
    else put('WO', 'DONE', wos.map((w) => w.status).join(', '));
    // 3 Malzeme ve takım
    const rr = wos.flatMap((w) => readiness?.get?.(w.id) ?? []);
    if (!wos.length) put('PREP', 'WAITING', 'iş emri yok');
    else if (un.has('readiness')) put('PREP', 'NO_DATA', 'hazırlık bilgisi okunamadı');
    else if (!rr.length) put('PREP', 'NO_DATA', 'hazırlık bilgisi döndürülmedi');
    else if (rr.some((x) => x.state === 'NOT_READY')) put('PREP', 'BLOCKED', reasonText(rr.find((x) => x.state === 'NOT_READY').reason));
    else if (rr.some((x) => x.state === 'UNKNOWN')) put('PREP', 'NO_DATA', rr.filter((x) => x.state === 'UNKNOWN').map((x) => reasonText(x.reason)).join('; '));
    else if (rr.some((x) => x.state === 'EXEMPT')) put('PREP', 'PARTIAL', `muaf: ${rr.find((x) => x.state === 'EXEMPT').reason ?? ''}`);
    else put('PREP', 'DONE', 'malzeme ve takım hazır');
    // 4 Operasyonlar / üretim
    if (!noRead('PROD', 'work_order_operations')) {
        if (!wos.length) put('PROD', 'WAITING', 'iş emri yok');
        else if (!ops.length) put('PROD', 'WAITING', 'iş emri operasyonları oluşturulmadı (rota iş emrine uygulanmadı)');
        else { const done = ops.filter((o) => o.status === 'DONE').length; put('PROD', done === ops.length ? 'DONE' : 'PARTIAL', `${done} / ${ops.length} operasyon tamam`); }
    }
    // 5 Operasyon kalitesi / First Piece
    if (!noRead('OPQC', 'work_order_operations')) {
        const openHold = holds.filter((x) => x.status === 'OPEN'), openNcr = ncrs.filter((x) => x.status !== 'ACCEPTED' && x.status !== 'SCRAPPED');
        const fail = ops.filter((o) => o.qcResult === 'FAIL' || o.fpRecheckRequired);
        if (fail.length || openHold.length || openNcr.length) put('OPQC', 'BLOCKED', [fail.length ? `${fail.length} operasyonda kalite red / FP yeniden kontrol` : '', openHold.length ? `${openHold.length} açık kalite hold` : '', openNcr.length ? `${openNcr.length} açık uygunsuzluk` : ''].filter(Boolean).join('; '));
        else if (!ops.length) put('OPQC', 'WAITING', 'operasyon kaydı yok');
        else {
            const needFp = ops.filter((o) => o.firstPieceRequired && !o.firstPieceAt).length, needQc = ops.filter((o) => o.qcRequired && o.qcResult !== 'PASS' && o.status !== 'PENDING').length;
            const allDone = ops.every((o) => o.status === 'DONE' && (!o.firstPieceRequired || o.firstPieceAt) && (!o.qcRequired || o.qcResult === 'PASS'));
            put('OPQC', allDone ? 'DONE' : ops.some((o) => o.status !== 'PENDING' || o.firstPieceAt || o.qcResult) ? 'PARTIAL' : 'WAITING', `First Piece bekleyen: ${needFp}, kalite bekleyen: ${needQc}`);
        }
    }
    // 6 Final Quality — final_quality_get(wo): { record, check }
    {
        const fq = facts.finalQuality ?? [];
        if (un.has('final_quality') || (wos.length && !fq.length)) put('FINALQ', 'NO_DATA', GAP.FINALQ);
        else if (!wos.length) put('FINALQ', 'WAITING', 'iş emri yok');
        else {
            const st = fq.map((x) => x.record?.decision === 'APPROVED' && !x.record?.revoked_at && !x.record?.revokedAt ? 'DONE' : x.record?.decision === 'REJECTED' && !x.record?.revoked_at ? 'BLOCKED' : 'WAITING');
            const pending = fq.filter((_, i) => st[i] === 'WAITING').flatMap((x) => x.check?.blockers ?? []);
            put('FINALQ', st.every((x) => x === 'DONE') ? 'DONE' : st.includes('BLOCKED') ? 'BLOCKED' : 'WAITING',
                st.every((x) => x === 'DONE') ? 'nihai kalite onayı verildi' : st.includes('BLOCKED') ? 'nihai kalite REDDEDİLDİ (gerekçe kayıtta)' : pending.length ? `onay için engeller: ${[...new Set(pending)].join(', ')}` : 'kontroller uygun; nihai kalite onayı bekliyor');
        }
    }
    // 7 Final Production Release
    if (!noRead('FINALREL', 'work_order_operations')) {
        const last = [...ops].sort((a, b) => a.opNo - b.opNo).at(-1);
        if (!last) put('FINALREL', 'WAITING', 'operasyon kaydı yok');
        else { const rel = n(last.qtyReleased), good = n(last.qtyGood); put('FINALREL', rel > 0 && rel >= good && last.status === 'DONE' ? 'DONE' : rel > 0 ? 'PARTIAL' : 'WAITING', `son operasyon OP${last.opNo}: serbest ${rel} / iyi ${good}`); }
    }
    // 8 Management / Business Release
    if (!noRead('MGMT', 'commercial_approvals')) {
        if (!approvals.length) put('MGMT', 'WAITING', 'ticari onay kaydı yok');
        else put('MGMT', approvals.some((a) => a.managementReleasedAt) ? 'DONE' : 'WAITING', approvals.some((a) => a.managementReleasedAt) ? 'yönetim serbest bırakması verildi' : 'yönetim serbest bırakması bekliyor');
    }
    // 9 Accounting / Commercial Documentation — canonical ön kayıt yok
    {
        const cd = facts.commercialDocs ?? [];
        if (un.has('commercial_documents') || (wos.length && !cd.length)) put('ACCDOCS', 'NO_DATA', GAP.ACCDOCS);
        else if (!wos.length) put('ACCDOCS', 'WAITING', 'iş emri yok');
        else if (cd.some((x) => x.state === 'NOT_DEFINED')) put('ACCDOCS', 'WAITING', 'gerekli belge seti bu iş emri için tanımlanmadı (işletme tarafından belirlenmeli)');
        else if (cd.some((x) => x.state === 'UNCONFIRMED')) put('ACCDOCS', 'WAITING', 'gerekli belge seti tanımlandı ama yetkili tarafından doğrulanmadı');
        else if (cd.every((x) => x.state === 'COMPLETE')) put('ACCDOCS', 'DONE', 'doğrulanmış gerekli ticari belgelerin hepsi onaylı');
        else if (cd.some((x) => x.state === 'BLOCKED')) put('ACCDOCS', 'BLOCKED', `reddedilen belge: ${[...new Set(cd.flatMap((x) => x.rejected ?? []))].join(', ')}`);
        else { const miss = [...new Set(cd.flatMap((x) => [...(x.missing ?? []), ...(x.pending ?? [])]))]; put('ACCDOCS', cd.some((x) => (x.missing ?? []).length < (x.required ?? []).length) ? 'PARTIAL' : 'WAITING', `eksik/onay bekleyen: ${miss.join(', ')}`); }
    }
    // 10 Commercial Release
    if (!noRead('COMMREL', 'commercial_approvals')) {
        if (!approvals.length) put('COMMREL', 'WAITING', 'ticari onay kaydı yok');
        else if (approvals.some((a) => a.status === 'APPROVED')) put('COMMREL', 'DONE', 'ticari onay verildi');
        else if (approvals.some((a) => a.status === 'REJECTED')) put('COMMREL', 'BLOCKED', 'ticari onay reddedildi');
        else put('COMMREL', 'WAITING', 'ticari onay bekliyor');
    }
    // 11 Shipping Readiness
    if (!noRead('SHIPREADY', 'stock_lots')) {
        if (!lots.length) put('SHIPREADY', 'WAITING', 'stok lotu yok');
        else put('SHIPREADY', lots.some((l) => ['STAGED', 'SHIPPED'].includes(l.state)) ? 'DONE' : 'WAITING', `lot durumu: ${[...new Set(lots.map((l) => l.state))].join(', ')}`);
    }
    // 12 Shipment Completed — adet bilgisi mevcut sevkiyat-gerçeği hesabından (item.qty/qtyShipped/remaining/overdue); ikinci hesap yok
    if (!noRead('SHIP', 'shipments')) {
        const shipped = n(item.qtyShipped), ordered = n(item.qty), rem = item.remaining != null ? n(item.remaining) : Math.max(0, ordered - shipped);
        const qtyTxt = `sevk edilen ${shipped} / sipariş ${ordered} · kalan ${rem}${item.overdue ? ' · TERMİN GEÇTİ' : ''}`;
        if (item.overShipped) put('SHIP', 'BLOCKED', `fazla sevk — ${qtyTxt}`);
        else if (ordered > 0 && shipped >= ordered && shipments.some((s) => s.status === 'DELIVERED')) put('SHIP', 'DONE', `teslim edildi — ${qtyTxt}`);
        else if (shipped > 0 && rem > 0) put('SHIP', 'PARTIAL', `kısmi sevkiyat — ${qtyTxt}`);
        else if (shipments.some((s) => s.status === 'DISPATCHED')) put('SHIP', 'PARTIAL', `yolda — ${qtyTxt}`);
        else put('SHIP', 'WAITING', `${shipments.length ? `sevkiyat durumu: ${shipments.map((s) => s.status).join(', ')}` : 'sevkiyat kaydı yok'} — ${qtyTxt}`);
    }
    // Sıra kuralı: Final Quality → Final Production Release → Management → Accounting Docs → Commercial Release → Shipping Readiness → Shipment
    {
        const ORDER = ['FINALQ', 'FINALREL', 'MGMT', 'ACCDOCS', 'COMMREL', 'SHIPREADY', 'SHIP'];
        let missing = null;
        for (const k of ORDER) {
            const st = out.find((x) => x.key === k); if (!st) continue;
            if (missing && (st.state === 'DONE' || st.state === 'PARTIAL')) { st.detail = `önceki aşama tamam değil (${missing}) — bu aşama tamam sayılmaz [kayıt: ${st.detail}]`; st.state = 'WAITING'; st.sequenceHeld = true; }
            if (!missing && st.state !== 'DONE') missing = st.label;
        }
    }
    const verified = out.every((s) => s.state === 'DONE');
    const blocked = out.filter((s) => s.state === 'BLOCKED').map((s) => s.label);
    const noData = out.filter((s) => s.state === 'NO_DATA').map((s) => s.label);
    return { steps: out, verified, blocked, noData: noData.length, noDataLabels: noData, summary: verified ? 'Zincir doğrulandı' : blocked.length ? `Engel: ${blocked.join(', ')}` : `Doğrulanmadı — ${noData.length} aşamada veri yok` };
}
