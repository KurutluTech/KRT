import { chainGapText, nextChainAction } from './screens/productChainPanel.js';
const WORD_OK = 'YÜRÜRLÜKTE';
const allOk = (ops, pick) => ops.length > 0 && ops.every((o) => pick(o) === WORD_OK);
export function buildSteps(i) {
    const { ws, chain } = i;
    const rev = ws.revision;
    const ops = chain?.operations ?? [];
    const S = (key, no, title, status, label, line, action, target) => ({ key, no, title, status, label, line, action, target });
    const steps = [];
    // 1 Ürün ve teknik belgeler
    const dr = ws.cards.drawing?.state ?? 'MISSING', cad = ws.cards.cad?.state ?? 'MISSING';
    const docsOk = dr === 'APPROVED' && cad === 'APPROVED';
    steps.push(docsOk ? S('docs', 1, 'Ürün ve teknik belgeler', 'DONE', 'Hazır', 'Teknik resim ve CAD yürürlükte.', null, null)
        : S('docs', 1, 'Ürün ve teknik belgeler', 'TODO', dr === 'MISSING' || cad === 'MISSING' ? 'Eksik' : 'Onay bekliyor', `${dr === 'APPROVED' ? '' : 'Teknik resim '}${cad === 'APPROVED' ? '' : 'CAD/STEP '}${dr === 'MISSING' || cad === 'MISSING' ? 'yüklenmeli.' : 'onaylanmalı.'}`.replace(/\s+/g, ' ').trim(), 'Tamamla', 'drawing'));
    // 2 Hammadde / BOM — "kayıtlı" ile "onaylı" ayrı: kayıtlıysa "tanımlayın" denmez
    if (!ws.bom.length)
        steps.push(S('bom', 2, 'Hammadde / BOM', 'TODO', 'Eksik', 'Hammadde tanımlı değil: malzeme, çap, boy ve kesim boyunu girin.', 'Hammaddeyi ekle', 'bom'));
    else if (rev?.state === 'APPROVED')
        steps.push(S('bom', 2, 'Hammadde / BOM', 'DONE', 'Hazır', 'BOM onaylı.', null, null));
    else
        steps.push(S('bom', 2, 'Hammadde / BOM', 'WAIT', 'Onay bekliyor', 'BOM kayıtlı; revizyon onayı ile birlikte onaylanır.', "BOM'u onayla", 'bom'));
    // 3 Operasyon sırası ve CAM
    if (!ws.routing.length)
        steps.push(S('route', 3, 'Operasyon sırası ve CAM', 'TODO', 'Eksik', 'Rota yok: ilk operasyonu ekleyin.', 'Operasyon ekle', 'routing'));
    else if (!chain)
        steps.push(S('route', 3, 'Operasyon sırası ve CAM', 'WAIT', 'Doğrulanamadı', 'Operasyon zinciri okunamadı.', null, 'routing'));
    else {
        const stale = new Set(i.staleOps ?? []);
        const camOk = ops.every((o) => o.nc.status === WORD_OK && o.cam.status === WORD_OK && !stale.has(o.routingOperationId));
        if (camOk)
            steps.push(S('route', 3, 'Operasyon sırası ve CAM', 'DONE', 'Hazır', `${ops.length} operasyon: NC ve CAM yürürlükte.`, null, null));
        else {
            const bad = ops.find((o) => !(o.nc.status === WORD_OK && o.cam.status === WORD_OK && !stale.has(o.routingOperationId)));
            const st = stale.has(bad.routingOperationId);
            steps.push(S('route', 3, 'Operasyon sırası ve CAM', 'TODO', st ? 'Yenileme gerekli' : 'Eksik', `OP${bad.opNo}: ${chainGapText(bad, st) ?? 'NC / CAM tamamlanmalı.'}`, nextChainAction(bad, st)?.label ?? 'Tamamla', 'routing'));
        }
    }
    // 4 Takım listesi
    if (!chain || !ops.length)
        steps.push(S('tools', 4, 'Takım listesi', 'LOCKED', 'Önce rota', 'Rota ve NC tamamlanınca takım listesi doğrulanır.', null, null));
    else if (allOk(ops, (o) => o.toolList.status))
        steps.push(S('tools', 4, 'Takım listesi', 'DONE', 'Hazır', `${i.toolCount != null ? `${i.toolCount} takım` : 'Takım listesi'} yürürlükte.`, null, null));
    else {
        const bad = ops.find((o) => o.toolList.status !== WORD_OK);
        const n = i.toolCount != null ? `${i.toolCount} takım hazır. ` : '';
        steps.push(S('tools', 4, 'Takım listesi', bad.toolList.status === 'YOK' ? 'TODO' : 'WAIT', bad.toolList.status === 'YOK' ? 'Eksik' : 'Yürürlük bekliyor', bad.toolList.status === 'YOK' ? 'Takım listesi yüklenmeli.' : `${n}Teknik listeyi doğrula ve yürürlüğe al.`, 'Tamamla', 'tools'));
    }
    // 5 Kalite kontrol planı
    const activeOps = ws.routing.filter((o) => o.active);
    const linked = activeOps.length > 0 && activeOps.every((o) => o.qcPoints.some((p) => !!p.controlPlanId));
    if (i.plan?.released && linked)
        steps.push(S('quality', 5, 'Kalite kontrol planı', 'DONE', 'Hazır', `Plan onaylı, ${i.plan.characteristics} karakteristik, operasyona bağlı.`, null, null));
    else if (i.plan && !i.plan.released)
        steps.push(S('quality', 5, 'Kalite kontrol planı', 'WAIT', 'Taslak', `${i.plan.characteristics} karakteristikli taslak var${i.plan.openItems ? `; ${i.plan.openItems} ölçü eksik veya kapsam dışı kararı bekliyor` : ''}. Onaylanana kadar geçerli sayılmaz.`, 'Tamamla', 'quality'));
    else if (ws.quality.length && !i.plan)
        steps.push(S('quality', 5, 'Kalite kontrol planı', 'WAIT', 'Doğrulanamadı', 'Kontrol planı okunamadı.', 'Tamamla', 'quality'));
    else
        steps.push(S('quality', 5, 'Kalite kontrol planı', 'TODO', 'Eksik', 'Kontrol planı yok: kalite noktaları tanımlanmalı.', 'Tamamla', 'quality'));
    // 6 Üretime hazırla (revizyon yayını + sunucu hazırlık cevabı)
    const overall = ws.readiness?.overall;
    const prior = steps.slice(0, 5);
    if (rev?.status === 'RELEASED' && overall === 'READY' && chain?.operations.every((o) => o.workOrderReady))
        steps.push(S('ready', 6, 'Üretime hazırla', 'DONE', 'Hazır', 'Revizyon yürürlükte ve rota iş emrine hazır.', null, null));
    else if (prior.some((s) => s.status !== 'DONE'))
        steps.push(S('ready', 6, 'Üretime hazırla', 'LOCKED', 'Önce yukarıdakiler', `Önce: ${prior.filter((s) => s.status !== 'DONE').map((s) => s.title).join(', ')}.`, null, null));
    else
        steps.push(S('ready', 6, 'Üretime hazırla', 'TODO', 'Yayın bekliyor', `Rev ${rev?.revision ?? ''} taslak: yayınlanınca iş emri açılabilir.`, 'Revizyonu yayınla', 'release'));
    // 7 İş emri oluştur
    const gate = workOrderGate(i, steps[5]);
    steps.push(gate.open ? S('wo', 7, 'İş emri oluştur', 'TODO', 'Hazır', 'Her şey tamam: iş emri oluşturma ekranına geçebilirsiniz.', 'İş Emri Oluştur', 'order') : S('wo', 7, 'İş emri oluştur', 'LOCKED', 'Kapalı', gate.reasons[0] ?? '', null, null));
    return steps;
}
/** The only gate to the work-order screen. Never opens on a guess; lists every reason it is closed. */
export function workOrderGate(i, readyStep) {
    const reasons = [];
    const rs = readyStep ?? buildSteps({ ...i, order: i.order }).find((s) => s.key === 'ready');
    if (rs.status !== 'DONE')
        reasons.push(rs.status === 'LOCKED' ? `Hazırlık tamamlanmadı — ${rs.line}` : `Hazırlık tamamlanmadı — ${rs.line}`);
    if (!i.order)
        reasons.push('Sipariş seçilmedi: iş emri bir sipariş kalemine bağlıdır.');
    else if (!['CONFIRMED', 'IN_PRODUCTION'].includes(i.order.status))
        reasons.push(`${i.order.orderNo} henüz ${ORDER_TR[i.order.status] ?? i.order.status}: iş emri için sipariş “Onaylandı” olmalı.`);
    return { open: reasons.length === 0, reasons, target: reasons.length === 0 ? 'order' : null };
}
export const ORDER_TR = { DRAFT: 'taslak', CONFIRMED: 'onaylı', IN_PRODUCTION: 'üretimde', SHIPPED: 'sevk edildi', CLOSED: 'kapalı', CANCELLED: 'iptal' };
export function overallStatus(steps) {
    if (steps.slice(0, 6).every((s) => s.status === 'DONE'))
        return { kind: 'READY', text: 'Üretime hazır' };
    if (steps.some((s) => s.status === 'WAIT' && /Doğrulanamadı/.test(s.label)))
        return { kind: 'CHECK', text: 'Kontrol gerekli' };
    return { kind: 'PREP', text: 'Hazırlanıyor' };
}
/** Whole-bar need from the server plan (the SAME formula as bar_material_need); capacity above the order is NOT produced stock. */
export function materialSummary(qty, line) {
    if (!line || line.plan.barsNeeded == null)
        return null;
    const capacity = line.plan.barsNeeded * line.plan.piecesPerBar;
    return { qty, bars: line.plan.barsNeeded, perBar: line.plan.piecesPerBar, capacity, extra: capacity - Math.ceil(qty), material: line.materialCode, dia: line.diaMm, barMm: line.barLengthMm, cutMm: line.cutLengthMm, kerfMm: line.kerfMm };
}
/** CNC cycle time only (inspection runs parallel and is never added). setup is per lot. */
export function cncTime(qty, ops) {
    const cyc = ops.map((o) => o.cycleSec).filter((x) => typeof x === 'number');
    if (!cyc.length || cyc.length !== ops.length)
        return { cycleSecPerPiece: null, cncHours: null, setupMin: null };
    const per = cyc.reduce((a, b) => a + b, 0);
    const su = ops.map((o) => o.setupMin).filter((x) => typeof x === 'number');
    return { cycleSecPerPiece: per, cncHours: (qty * per) / 3600, setupMin: su.length === ops.length ? su.reduce((a, b) => a + b, 0) : null };
}
// ---------------------------------------------------------------------------------------------------- rota sırası
/** Move one item; returns the new id order. */
export function moveId(ids, from, to) { if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length)
    return ids.slice(); const a = ids.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }
/** OP numbers come from the display order: OP10, OP20, OP30 … (same rule as the server). */
export const renumber = (ids) => new Map(ids.map((id, i) => [id, (i + 1) * 10]));
export const sameOrder = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
/** Server refusals in plain Turkish; unknown errors pass through. */
export function reorderErrorText(msg) {
    if (/OP_NO_REFERENCED/.test(msg))
        return 'Bu sıra değişikliği, belgesi veya kontrol planı OP numarasına bağlı bir operasyonun numarasını değiştirir. Belge bağlantıları operasyon kimliğine taşınmadan numara değiştirilmez; kayıt yapılmadı, hiçbir bağlantı bozulmadı.';
    if (/DEPENDENCY_ORDER_VIOLATED/.test(msg))
        return 'Bir operasyon kendi ön koşulundan önce gelemez; kayıt yapılmadı.';
    if (/REVISION_NOT_DRAFT|NOT_DRAFT|DRAFT/.test(msg) && /rt_need_draft|taslak|DRAFT/i.test(msg))
        return 'Yürürlükteki veya iş emrinde kullanılmış rotanın geçmişi değişmez: sıra için yeni rota revizyonu açılmalı.';
    if (/NO_CHANGE/.test(msg))
        return 'Sıra değişmedi; yeni sürüm açılmadı.';
    return msg;
}
