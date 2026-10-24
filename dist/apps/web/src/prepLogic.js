const WORD_OK = 'YÜRÜRLÜKTE';
const allOk = (ops, pick) => ops.length > 0 && ops.every((o) => pick(o) === WORD_OK);
export function buildSteps(i) {
    const { ws, chain } = i;
    const rev = ws.revision;
    const ops = chain?.operations ?? [];
    const S = (key, no, title, status, label, line, action, target) => ({ key, no, title, status, label, line, action, target });
    const steps = [];
    // Durumlar kullanıcı dilinde: Hazır / Tamamlanacak / Onay bekliyor / Teknik kontrol gerekli / Veri doğrulanamadı. Bilinmeyen asla "Eksik" denmez; yalnız taslak olan belge asla "yok" denmez.
    // 1 Ürün ve teknik belgeler
    const dr = ws.cards.drawing?.state, cad = ws.cards.cad?.state;
    const T = 'Ürün ve teknik belgeler';
    if (!dr || !cad)
        steps.push(S('docs', 1, T, 'WAIT', 'Veri doğrulanamadı', 'Belge durumu okunamadı.', 'Belgeyi incele', 'drawing'));
    else if (dr === 'APPROVED' && cad === 'APPROVED')
        steps.push(S('docs', 1, T, 'DONE', 'Hazır', 'Teknik resim ve CAD yürürlükte.', null, null));
    else if (dr === 'INVALID' || cad === 'INVALID')
        steps.push(S('docs', 1, T, 'TODO', 'Teknik kontrol gerekli', `${dr === 'INVALID' ? 'Teknik resim' : 'CAD/STEP'} kaydı geçersiz görünüyor; incelenmeli.`, 'Belgeyi incele', 'drawing'));
    else {
        const name = (st, n) => (st === 'APPROVED' ? '' : n);
        const miss = [name(dr === 'MISSING' ? 'x' : 'APPROVED', 'Teknik resim'), name(cad === 'MISSING' ? 'x' : 'APPROVED', 'CAD/STEP')].filter(Boolean).join(' ve ');
        const wait = [dr === 'DRAFT' ? 'Teknik resim' : '', cad === 'DRAFT' ? 'CAD/STEP' : ''].filter(Boolean).join(' ve ');
        steps.push(S('docs', 1, T, 'TODO', miss ? 'Tamamlanacak' : 'Onay bekliyor', `${miss ? `${miss} yüklenecek.` : ''}${miss && wait ? ' ' : ''}${wait ? `${wait} kaydı mevcut, onay bekliyor.` : ''}`, 'Belgeyi incele', 'drawing'));
    }
    // 2 Hammadde / BOM — "kayıtlı" ile "onaylı" ayrı. BOM onayı = revizyon yayını (ayrı bir onay işlevi yok).
    const B = 'Hammadde / BOM';
    if (!ws.bom.length)
        steps.push(S('bom', 2, B, 'TODO', 'Tamamlanacak', 'Hammadde tanımlanacak: malzeme, çap, boy ve kesim boyu.', 'Hammaddeyi ekle', 'bom'));
    else {
        // geçerlilik = kayıtlı satırın malzemesi ve birim miktarı var (mevcut kuralla aynı: sistem ek alan uydurmaz). Geçerli BOM hazırlığı bloke etmez; yürürlük ayrıca Rev yayınında.
        const bad = ws.bom.filter((l) => !String(l.materialCode ?? '').trim() || !(Number(l.qtyPerUnit) > 0));
        if (bad.length)
            steps.push(S('bom', 2, B, 'TODO', 'Düzeltilecek', `${bad.length} BOM satırında malzeme kodu veya birim miktar eksik/geçersiz. Aynı ekranda düzeltip kaydedin.`, "BOM'u düzenle", 'bom'));
        else if (rev?.state === 'APPROVED')
            steps.push(S('bom', 2, B, 'DONE', 'Hazır', 'BOM onaylı.', null, null));
        else
            steps.push(S('bom', 2, B, 'DONE', 'Hazır', `BOM kayıtlı ve geçerli. Rev ${rev?.revision ?? ''} yayınlandığında yürürlüğe girecek.`, "BOM'u incele", 'bom'));
    }
    // 3 Operasyon sırası ve CAM
    const R = 'Operasyon sırası ve CAM';
    if (!ws.routing.length)
        steps.push(S('route', 3, R, 'TODO', 'Tamamlanacak', 'Rota boş: ilk operasyon eklenecek.', 'Operasyon ekle', 'routing'));
    else if (!chain)
        steps.push(S('route', 3, R, 'WAIT', 'Veri doğrulanamadı', 'Operasyon zinciri okunamadı.', 'CAM bağlantısını doğrula', 'routing'));
    else {
        const stale = new Set(i.staleOps ?? []);
        const bad = ops.find((o) => !(o.nc.status === WORD_OK && o.cam.status === WORD_OK && !stale.has(o.routingOperationId)));
        if (!bad)
            steps.push(S('route', 3, R, 'DONE', 'Hazır', `${ops.length} operasyon: NC ve CAM yürürlükte.`, null, null));
        else {
            const st = stale.has(bad.routingOperationId);
            const op = `OP${bad.opNo}`;
            const nc = bad.nc.status, cam = bad.cam.status;
            if (nc === 'YOK')
                steps.push(S('route', 3, R, 'TODO', 'Tamamlanacak', `${op}: NC programı yüklenecek.`, 'Belgeyi incele', 'routing'));
            else if (nc === 'BELGE VAR' || nc === 'TEKNİK ONAY BEKLİYOR')
                steps.push(S('route', 3, R, 'WAIT', 'Onay bekliyor', `${op}: NC kaydı mevcut, yürürlük bekliyor.`, 'Belgeyi incele', 'routing'));
            else if (cam === 'YOK')
                steps.push(S('route', 3, R, 'TODO', 'Tamamlanacak', `${op}: NC yürürlükte, CAM kaydı oluşturulacak.`, 'CAM bağlantısını doğrula', 'routing'));
            else if (cam === 'TEKNİK ONAY BEKLİYOR')
                steps.push(S('route', 3, R, 'WAIT', 'Onay bekliyor', `${op}: CAM kaydı mevcut, yayın bekliyor.`, 'CAM bağlantısını doğrula', 'routing'));
            else if (st)
                steps.push(S('route', 3, R, 'TODO', 'Teknik kontrol gerekli', `${op}: NC değişti, CAM kaydı yeniden oluşturulacak.`, 'CAM bağlantısını doğrula', 'routing'));
            else
                steps.push(S('route', 3, R, 'TODO', 'Teknik kontrol gerekli', `${op}: CAM kaydı mevcut, operasyon bağlantısı kontrol edilecek.`, 'CAM bağlantısını doğrula', 'routing'));
        }
    }
    // 4 Takım listesi
    const L = 'Takım listesi';
    if (!ws.routing.length)
        steps.push(S('tools', 4, L, 'LOCKED', 'Tamamlanacak', 'Rota hazır olunca doğrulanır.', null, null));
    else if (!chain)
        steps.push(S('tools', 4, L, 'WAIT', 'Veri doğrulanamadı', 'Takım listesi durumu okunamadı.', 'Takım listesini yürürlüğe al', 'tools'));
    else if (allOk(ops, (o) => o.toolList.status)) {
        const rc = i.tool?.rechecks ?? [];
        if (rc.length)
            steps.push(S('tools', 4, L, 'WAIT', 'Yeniden kontrol bekliyor', `Takım listesi yürürlükte. ${rc.map((r) => 'OP' + r.opNo).join(', ')}: takım verisi değişti; CAM/NC uygunluğu yetkili kişi tarafından kaydedilmeli (kayıt girilene kadar operasyon iş emrinde başlatılamaz).`, 'Kontrolü kaydet', 'tool-recheck'));
        else
            steps.push(S('tools', 4, L, 'DONE', 'Hazır', `${i.toolCount != null ? `${i.toolCount} takım` : 'Takım listesi'} yürürlükte.`, null, null));
    }
    else {
        const bad = ops.find((o) => o.toolList.status !== WORD_OK);
        const ts = bad.toolList.status;
        const n = i.toolCount != null ? ` (${i.toolCount} takım)` : '';
        if (ts === 'YOK')
            steps.push(S('tools', 4, L, 'TODO', 'Tamamlanacak', 'Takım listesi yüklenecek.', 'Belgeyi incele', 'tools'));
        else if (ts === 'OPERASYONA BAĞLI DEĞİL')
            steps.push(S('tools', 4, L, 'TODO', 'Teknik kontrol gerekli', 'Kayıt mevcut, operasyon bağlantısı kontrol edilecek.', 'Takım listesini yürürlüğe al', 'tools'));
        else if (i.tool?.attested)
            steps.push(S('tools', 4, L, 'WAIT', 'Yürürlük bekliyor', `Takımhane doğrulaması kayıtlı${i.tool.workRev ? ` (r${i.tool.workRev})` : ''}${n}. Kalan: Doküman Kontrol’de “Yürürlüğe al”.`, 'Doküman Kontrol’de yürürlüğe al', 'doc-control'));
        else if (i.tool)
            steps.push(S('tools', 4, L, 'WAIT', 'Onay bekliyor', `Kayıt mevcut${n}, takımhane doğrulaması bekliyor; sonra yürürlük.`, 'Takım doğrulamasını aç', 'tools'));
        else
            steps.push(S('tools', 4, L, 'WAIT', 'Onay bekliyor', `Kayıt mevcut${n}, yürürlük bekliyor.`, 'Takım listesini yürürlüğe al', 'tools'));
    }
    // 5 Kalite kontrol planı
    const Q = 'Kalite kontrol planı';
    const activeOps = ws.routing.filter((o) => o.active);
    const linked = activeOps.length > 0 && activeOps.every((o) => o.qcPoints.some((p) => !!p.controlPlanId));
    if (i.plan?.released && linked)
        steps.push(S('quality', 5, Q, 'DONE', 'Hazır', `Plan onaylı, ${i.plan.characteristics} karakteristik, operasyona bağlı.`, null, null));
    else if (i.plan?.released)
        steps.push(S('quality', 5, Q, 'TODO', 'Teknik kontrol gerekli', 'Plan onaylı; operasyona bağlantısı kontrol edilecek.', 'Kalite planını tamamla', 'quality'));
    else if (i.plan && i.plan.openItems)
        steps.push(S('quality', 5, Q, 'TODO', 'Tamamlanacak', `Taslak mevcut, ${i.plan.openItems} ölçü tamamlanacak` + (linked ? '.' : '; operasyona bağlı değil.'), 'Kalite planını tamamla', 'quality'));
    else if (i.plan)
        steps.push(S('quality', 5, Q, 'WAIT', 'Onay bekliyor', `Taslak tam (${i.plan.characteristics} karakteristik, açık madde yok); onay bekliyor` + (linked ? '.' : '; onaylanınca OP30’a otomatik bağlanır.'), 'Kalite planını onayla ve OP30’a bağla', 'quality'));
    else if (ws.quality.length)
        steps.push(S('quality', 5, Q, 'WAIT', 'Veri doğrulanamadı', 'Kontrol planı okunamadı.', 'Kalite planını tamamla', 'quality'));
    else
        steps.push(S('quality', 5, Q, 'TODO', 'Tamamlanacak', 'Kontrol planı hazırlanacak.', 'Kalite planını tamamla', 'quality'));
    // 6 Üretime hazırla (revizyon yayını + sunucu hazırlık cevabı)
    const P = 'Üretime hazırla';
    const overall = ws.readiness?.overall;
    const prior = steps.slice(0, 5).filter((s) => !(s.key === 'bom' && s.status === 'WAIT')); /* BOM onayı = bu yayın: yayın kendi onayını beklemez */
    const rv = rev?.revision ?? '';
    if (rev?.status === 'RELEASED' && overall === 'READY' && chain?.operations.every((o) => o.workOrderReady))
        steps.push(S('ready', 6, P, 'DONE', 'Hazır', 'Revizyon yürürlükte ve rota iş emrine hazır.', null, null));
    else if (prior.some((s) => s.status !== 'DONE'))
        steps.push(S('ready', 6, P, 'LOCKED', 'Tamamlanacak', 'Yukarıdaki adımlar bitince yayınlanır.', null, null));
    else if (rev?.status === 'RELEASED')
        steps.push(S('ready', 6, P, 'TODO', 'Teknik kontrol gerekli', `Rev ${rv} yayında; sunucu hazırlık kontrolü henüz “hazır” demiyor.`, null, null));
    else
        steps.push(S('ready', 6, P, 'TODO', 'Yayın bekliyor', `Rev ${rv} taslak: yayınlanınca BOM ve revizyon yürürlüğe girer, iş emri açılabilir.`, `Rev ${rv}'yı yayınla`, 'release'));
    // 7 İş emri oluştur
    const gate = workOrderGate(i, steps[5]);
    const W = 'İş emri oluştur';
    if (gate.open)
        steps.push(S('wo', 7, W, 'TODO', 'Hazır', 'Her şey tamam; iş emri ekranına geçebilirsiniz.', 'İş emri oluştur', 'order'));
    else if (steps[5].status === 'DONE')
        steps.push(S('wo', 7, W, 'WAIT', 'Onay bekliyor', gate.reasons[0] ?? '', null, null));
    else
        steps.push(S('wo', 7, W, 'LOCKED', 'Tamamlanacak', 'Hazırlık bitince açılır.', null, null));
    // Tamamlanmış adım da aynı sayfada açılabilir (yeni sürüm yükleme, inceleme, düzenleme); ikincil düğme.
    const OPEN = { docs: ['Belgeleri aç', 'drawing'], bom: ["BOM'u aç", 'bom'], route: ['Operasyonları aç', 'routing'], tools: ['Takım listesini aç', 'tools'], quality: ['Kalite planını aç', 'quality'] };
    for (const st of steps) {
        const o = OPEN[st.key];
        if (st.status === 'DONE' && o && !st.action) {
            st.action = o[0];
            st.target = o[1];
            st.secondary = true;
        }
    }
    return steps;
}
/** The only gate to the work-order screen. Never opens on a guess; short reasons only (the step lines already name the gaps). */
export function workOrderGate(i, readyStep) {
    const reasons = [];
    const rs = readyStep ?? buildSteps({ ...i, order: i.order }).find((s) => s.key === 'ready');
    if (rs.status !== 'DONE')
        reasons.push('Ürün hazırlığı tamamlanacak.');
    if (!i.order)
        reasons.push('Sipariş seçilmedi: iş emri bir sipariş kalemine bağlıdır.');
    else if (i.order.status === 'DRAFT')
        reasons.push('Sipariş onayı bekleniyor.');
    else if (!['CONFIRMED', 'IN_PRODUCTION'].includes(i.order.status))
        reasons.push(`${i.order.orderNo} ${ORDER_TR[i.order.status] ?? i.order.status}: iş emri için sipariş “Onaylandı” olmalı.`);
    return { open: reasons.length === 0, reasons, target: reasons.length === 0 ? 'order' : null };
}
export const ORDER_TR = { DRAFT: 'taslak', CONFIRMED: 'onaylı', IN_PRODUCTION: 'üretimde', SHIPPED: 'sevk edildi', CLOSED: 'kapalı', CANCELLED: 'iptal' };
export function overallStatus(steps) {
    if (steps.slice(0, 6).every((s) => s.status === 'DONE'))
        return { kind: 'READY', text: 'Üretime hazır' };
    if (steps.some((s) => /Veri doğrulanamadı|Teknik kontrol gerekli/.test(s.label)))
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
/** CNC cycle time = SUM of all real route operations (never only OP30); inspection runs parallel and is never added. setup is per lot. */
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
        return 'Bu operasyonun bağlı belgeleri bulunduğundan sıra değişikliği henüz kaydedilemiyor. Kayıt yapılmadı, hiçbir bağlantı bozulmadı.';
    if (/RECHECK_OPEN/.test(msg))
        return 'Bu operasyon için açık bir takım yeniden-kontrol kaydı var; önce kapatılmalı. Kayıt yapılmadı.';
    if (/OP_RULE_REFERENCED/.test(msg))
        return 'Bu operasyon numarasına bağlı ürün düzeyinde belge kapısı kuralı veya hurda eşiği var; numara değiştirilemez. Kayıt yapılmadı.';
    if (/DEPENDENCY_ORDER_VIOLATED/.test(msg))
        return 'Bir operasyon kendi ön koşulundan önce gelemez; kayıt yapılmadı.';
    if (/REVISION_NOT_DRAFT|NOT_DRAFT|DRAFT/.test(msg) && /rt_need_draft|taslak|DRAFT/i.test(msg))
        return 'Yürürlükteki veya iş emrinde kullanılmış rotanın geçmişi değişmez: sıra için yeni rota revizyonu açılmalı.';
    if (/NO_CHANGE/.test(msg))
        return 'Sıra değişmedi; yeni sürüm açılmadı.';
    return msg;
}
/** "İş emrini açmak için kalan işlemler": adımlar + sipariş kapısından türetilir (yeni durum yok). Tamamlanan satır kendiliğinden kaybolur. */
export function remainingActions(i, steps, perm, toolDocNo) {
    const rows = [];
    const by = (k) => steps.find((s) => s.key === k);
    const rev = i.ws.revision?.revision ?? '';
    const row = (key, title, status, why, action, target, ok, noPerm) => ({ key, title, status, why, action: ok ? action : null, target: ok ? target : null, noPerm: !ok && action ? noPerm : null });
    const docs = by('docs');
    if (docs.status !== 'DONE')
        rows.push(row('docs', 'Teknik belgeler', docs.label === 'Onay bekliyor' ? 'Yürürlük bekliyor' : docs.label, docs.line, 'Belgeleri aç', 'drawing', perm.docs, 'Belge yükleme/onay yetkiniz yok'));
    const route = by('route');
    if (route.status !== 'DONE')
        rows.push(row('route', 'Operasyon / CAM', route.label === 'Onay bekliyor' ? 'Yürürlük bekliyor' : route.label, route.line, route.action ? 'Operasyonu aç' : null, 'routing', perm.docs, 'Rota/CAM düzenleme yetkiniz yok'));
    const tools = by('tools');
    if (tools.status !== 'DONE') {
        const t = i.tool;
        const docNo = toolDocNo ?? t?.docNo ?? null;
        const ttl = `Takım listesi${docNo ? ' ' + docNo : ''}`;
        const ops = (t?.rechecks ?? []).map((r) => 'OP' + r.opNo).join(', ');
        const eff = tools.label === 'Yeniden kontrol bekliyor';
        if (eff)
            rows.push(row('tools', ttl, `${ops} CAM/NC yeniden kontrolü bekliyor`, 'Takım verisi doğrulandı ve liste yürürlükte; takım verisi değiştiği için CAM/NC uygunluğunu yetkili kişi (Yönetici/Kalite) kaydetmeli. Bu kayıt girilene kadar operasyon iş emrinde başlatılamaz.', 'Kontrolü kaydet', 'tool-recheck', perm.tools, 'CAM/NC yeniden kontrolü için yetkiniz yok'));
        else if (t?.attested)
            rows.push(row('tools', ttl, 'Yürürlük bekliyor', `Takımhane doğrulaması kayıtlı${t.workRev ? ` (r${t.workRev})` : ''}; tekrar istenmez. Kalan tek işlem: Doküman Kontrol’de “Yürürlüğe al” (yetkili: Yönetici/Kalite).${ops ? ` Ardından ${ops} için CAM/NC yeniden kontrolü kaydedilecek.` : ''}`, 'Doküman Kontrol’de yürürlüğe al', 'doc-control', perm.tools, 'Takım listesini yürürlüğe alma yetkiniz yok'));
        else
            rows.push(row('tools', ttl, tools.label === 'Onay bekliyor' ? 'Yürürlük bekliyor' : tools.label, 'Çap, boy, tutucu ve offset yetkili kişi tarafından doğrulanıp kaydedilmeli; sonra Doküman Kontrol’de yürürlüğe alınır.', 'Takım doğrulamasını aç', 'tools', perm.tools, 'Takım listesini yürürlüğe alma yetkiniz yok'));
    }
    const q = by('quality');
    if (q.status !== 'DONE') {
        const act = i.ws.routing.filter((o) => o.active);
        const opn = act.length === 1 ? ` OP${act[0].opNo}` : '';
        const unlinked = !(act.length > 0 && act.every((o) => o.qcPoints.some((p) => !!p.controlPlanId)));
        const st = i.plan?.openItems ? `${i.plan.openItems} ölçü eksik` : q.label === 'Onay bekliyor' ? 'Onay bekliyor' : q.label;
        const ready = !!i.plan && !i.plan.released && !i.plan.openItems;
        const why = ready ? `Taslak tam: ${i.plan.characteristics} karakteristik, açık madde yok. Kalan tek işlem: teknik kalite onayı (yetkili: Yönetici/Kalite). Onayla birlikte plan OP30’a otomatik bağlanır; ayrıca bağlama gerekmez.` : (i.plan && unlinked ? 'Plan operasyona bağlı değil.' : null);
        rows.push(row('quality', `Kalite planı${opn}`, st, why, ready ? 'Kalite planını onayla ve OP30’a bağla' : 'Kalite planını aç', 'quality', perm.quality, 'Kalite planı düzenleme yetkiniz yok'));
    }
    const r6 = by('ready');
    if (r6.status !== 'DONE') {
        const prior = steps.slice(0, 5).filter((s) => !(s.key === 'bom' && s.status === 'WAIT'));
        const blocked = prior.some((s) => s.status !== 'DONE');
        if (blocked)
            rows.push({ key: 'release', title: `Rev ${rev}`, status: 'Yayın bekliyor', why: 'Önceki hazırlık adımları bekleniyor.', action: null, target: null, noPerm: null });
        else if (r6.action)
            rows.push(row('release', `Rev ${rev}`, 'Yayın bekliyor', null, 'Revizyon adımına git', 'release-step', perm.release, 'Revizyon yayınlama yetkiniz yok'));
        else
            rows.push({ key: 'release', title: `Rev ${rev}`, status: r6.label, why: r6.line, action: null, target: null, noPerm: null });
    }
    const o = i.order;
    if (!o)
        rows.push({ key: 'order', title: 'Sipariş', status: 'Sipariş seçilmedi', why: 'İş emri bir sipariş kalemine bağlıdır.', action: null, target: null, noPerm: null });
    else if (o.status === 'DRAFT')
        rows.push(row('order', o.orderNo, 'Sipariş onayı bekliyor', null, 'Siparişi aç', 'order', perm.order, 'Sipariş ekranını açma yetkiniz yok'));
    else if (!['CONFIRMED', 'IN_PRODUCTION'].includes(o.status))
        rows.push({ key: 'order', title: o.orderNo, status: ORDER_TR[o.status] ?? o.status, why: 'İş emri için sipariş “Onaylandı” olmalı.', action: null, target: null, noPerm: null });
    return rows;
}
