// KMI NEXT — Pasaport / Ürün Dijital DNA (matrix 35, 38). Migration 0033.
// Etiket kodu (KL…), QR içeriği, okutma linki, ürün kodu veya kayıt numarasıyla açılır.
// Zincirde OLMAYAN halka "eksik halka" olarak listelenir — eksikli pasaport asla "tam" gösterilmez.
// Ekonomik pasaport yalnız sunucu izin verirse gelir (owner + açıkça yetkilendirilenler); aksi
// halde sunucu hiçbir rakam göndermez, ekran yalnız "kilitli" yazar.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { PASSPORT_GAP_TR, classifyPassportInput } from '../../../../packages/domain/src/passport.js';
import { errorText as sharedErrorText } from '../errorText.js';
const STATUS_TR = {
    PLANNED: 'PLANLANDI', MACHINE_ASSIGNED: 'MAKİNE ATANDI', IN_PROGRESS: 'ÜRETİMDE', FIRST_PIECE_PENDING: 'İLK PARÇA BEKLİYOR',
    FIRST_PIECE_APPROVED: 'İLK PARÇA ONAYLI', COMPLETED: 'TAMAMLANDI', ON_HOLD: 'BEKLETMEDE', CANCELLED: 'İPTAL',
};
const KIND_TR = { LOT: 'Lot pasaportu', WORK_ORDER: 'İş emri pasaportu', PRODUCT: 'Ürün Dijital DNA' };
const fmt = (iso) => iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';
const money = (l) => `${l.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${l.currency}`;
const errText = (e) => sharedErrorText(e);
const NOT_MODELLED_TR = { LABOUR: 'işçilik', MACHINE_TIME: 'makine saati', OVERHEAD: 'genel gider', TOOL_WEAR: 'takım aşınması' };
const MARGIN_TR = { OK: '', NOT_INVOICED: 'henüz faturalanmadı', NO_MATERIAL_COST: 'malzeme maliyeti kaydı yok', CURRENCY_MISMATCH: 'farklı para birimleri toplanmaz' };
const docsLink = (tip, id, testid) => h('a', { href: `#/dokumanlar?tip=${tip}&id=${encodeURIComponent(id)}`, 'data-testid': testid, style: 'font-size:13px' }, 'Dokümanlar →');
const section = (title, testid, ...children) => h('section', { 'data-testid': testid, style: 'border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:10px 0' }, h('h3', { style: 'margin:0 0 6px;font-size:16px' }, title), ...children);
const kv = (k, v, testid) => h('div', testid ? { 'data-testid': testid } : {}, h('span', { style: 'color:#64748b' }, `${k}: `), v);
function gapsBox(gaps, completeness) {
    return h('div', { 'data-testid': 'pp-trace', style: 'margin:8px 0' }, h('span', { 'data-testid': 'pp-completeness', 'data-state': completeness,
        style: `display:inline-block;padding:4px 10px;border-radius:999px;color:#fff;font-weight:800;background:${completeness === 'COMPLETE' ? '#15803d' : '#b45309'}` }, completeness === 'COMPLETE' ? 'İZLENEBİLİRLİK TAM' : `EKSİK HALKA: ${gaps.length}`), ...gaps.map((g) => h('div', { 'data-testid': 'pp-gap', 'data-code': g, style: 'color:#b45309' }, `• ${PASSPORT_GAP_TR[g] ?? g}`)));
}
function economicBox(e) {
    if (e.locked) {
        return section('Ekonomik pasaport', 'pp-economic', h('div', { 'data-testid': 'pp-economic-locked', 'data-locked': 'true', style: 'color:#64748b' }, 'Kilitli — maliyet ve kârlılık yalnız Ender Kurutlu ve açıkça yetkilendirdiği kişilere açıktır.'));
    }
    return section('Ekonomik pasaport', 'pp-economic', kv('Faturalanan', e.invoiced.length ? e.invoiced.map(money).join(' + ') : '—', 'pp-eco-invoiced'), kv('Malzeme maliyeti', e.materialCost.length ? e.materialCost.map(money).join(' + ') : '—', 'pp-eco-material'), kv('Malzeme sonrası kalan', e.materialMargin ? money(e.materialMargin) : `hesaplanmadı (${MARGIN_TR[e.marginReason] ?? e.marginReason})`, 'pp-eco-margin'), h('div', { style: 'font-size:12px;color:#b45309' }, `Dahil DEĞİL: ${e.notModelled.map((x) => NOT_MODELLED_TR[x] ?? x).join(', ')} — bu bir tam maliyet değildir.`));
}
const shipmentLine = (s) => h('div', { 'data-testid': 'pp-shipment' }, `İrsaliye ${s.deliveryNoteNo ?? '—'} · ${s.status} · çıkış ${fmt(s.dispatchedAt)}${s.deliveredAt ? ` · teslim ${fmt(s.deliveredAt)}` : ''}`);
export async function renderPassportScreen(container, api, state = {}) {
    const go = (next) => void renderPassportScreen(container, api, next);
    const open = (kind, id) => go({ input: state.input, view: { kind, id }, back: state.view ? [...(state.back ?? []), state.view] : state.back ?? [] });
    const link = (testid, text, kind, id, extra = {}) => h('button', { type: 'button', 'data-testid': testid, ...extra, style: 'background:none;border:0;color:#1d4ed8;text-decoration:underline;cursor:pointer;padding:0;font:inherit', onClick: () => open(kind, id) }, text);
    const input = h('input', { 'data-testid': 'pp-input', value: state.input ?? '', placeholder: 'Etiket kodu (KL…), QR, ürün kodu', style: 'flex:1;min-width:0;min-height:44px;font-size:16px' });
    let notice = null;
    const submit = async () => {
        const c = classifyPassportInput(input.value);
        if (c.kind === 'EMPTY')
            return go({ ...state, input: '', view: null });
        try {
            const r = await api.resolve(input.value);
            go({ input: input.value, view: r, back: [] });
        }
        catch (err) {
            mountScreen(`Bulunamadı: ${errText(err)}`, null);
        }
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            void submit();
    });
    let body = null;
    if (state.view) {
        try {
            if (state.view.kind === 'LOT')
                body = lotView(await api.lot(state.view.id));
            else if (state.view.kind === 'WORK_ORDER')
                body = woView(await api.workOrder(state.view.id), true);
            else
                body = productView(await api.product(state.view.id));
        }
        catch (err) {
            notice = `Yüklenemedi: ${errText(err)}`;
        }
    }
    mountScreen(notice, body);
    function mountScreen(msg, content) {
        mount(container, h('div', { class: 'passport-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'pp-heading' }, 'Pasaport / Dijital DNA'), h('div', { style: 'display:flex;gap:8px' }, input, h('button', { type: 'button', 'data-testid': 'pp-open', style: 'min-height:44px', onClick: () => void submit() }, 'Aç')), msg ? h('div', { 'data-testid': 'pp-notice', style: 'margin:8px 0;padding:10px;border-radius:8px;background:#fee2e2' }, msg) : null, (state.back ?? []).length ? h('button', { type: 'button', 'data-testid': 'pp-back', style: 'margin:8px 0', onClick: () => {
                const back = [...(state.back ?? [])];
                const prev = back.pop();
                go({ input: state.input, view: prev, back });
            } }, '← Geri') : null, state.view ? h('div', { 'data-testid': 'pp-kind', 'data-kind': state.view.kind, style: 'font-size:12px;text-transform:uppercase;color:#64748b;margin-top:8px' }, KIND_TR[state.view.kind]) : null, content));
    }
    function woView(p, withTrace) {
        const w = p.workOrder;
        return h('div', { 'data-testid': 'pp-wo', 'data-id': w.id }, withTrace ? gapsBox(p.gaps, p.completeness) : null, section('İş emri', 'pp-wo-head', docsLink('WORK_ORDER', w.id, 'pp-wo-docs'), kv('Ürün', p.product ? link('pp-product-link', `${p.product.code} — ${p.product.name}`, 'PRODUCT', p.product.id) : '—'), kv('Durum', STATUS_TR[w.status] ?? w.status), kv('Adet', `${w.qtyProduced} sağlam · ${w.qtyScrap} fire / ${w.qtyPlanned} planlı`, 'pp-wo-qty'), kv('Sipariş', p.order ? `${p.order.customerPo ?? '—'} · termin ${p.order.dueDate ?? '—'}` : '—'), kv('Revizyon', p.revision ? `${p.revision.revision} (${p.revision.status})` : '—'), kv('CAM', p.camProgram ? `${p.camProgram.programNo} rev ${p.camProgram.revision}${p.camProgram.idealCycleSeconds ? ` · ${p.camProgram.idealCycleSeconds} sn/parça` : ''}` : '—'), kv('Makine', p.machine ? `${p.machine.code} ${p.machine.name}` : '—', 'pp-wo-machine'), kv('Operatör', p.operator?.name ?? '—'), kv('İlk parça', fmt(p.declarations.firstPieceAt)), kv('Bildirim', `${p.declarations.count} kayıt · ${p.declarations.good} sağlam · ${p.declarations.scrap} fire`)), p.operations && p.operations.length ? section('Operasyonlar (rota)', 'pp-operations', ...p.operations.map((o) => h('div', { 'data-testid': 'pp-operation', 'data-status': o.status }, `${o.opNo} · ${o.name} · ${o.status}${o.machineCode ? ` · ${o.machineCode}` : ''}${o.operatorName ? ` · ${o.operatorName}` : ''} · ${o.qtyGood} sağlam / ${o.qtyScrap} fire${o.qcResult ? ` · kalite ${o.qcResult}` : ''}`))) : null, asBuiltBox(p), section('Ham madde (geri izleme)', 'pp-materials', ...(p.materials.length ? p.materials.map((m) => h('div', { 'data-testid': 'pp-material', 'data-qc': m.qcDecision ?? 'PENDING' }, link('pp-material-link', m.materialCode ?? 'lot', 'LOT', m.lotId), ` · verilen ${m.issued} · tüketilen ${m.consumed} · ${m.supplier ?? 'tedarikçi —'} · giriş kalite ${m.qcDecision ?? 'BEKLİYOR'}`))
            : [h('div', { style: 'color:#b45309' }, 'Kayıtlı ham madde lotu yok.')])), section('Akış', 'pp-timeline', ...(p.timeline.length ? p.timeline.map((t) => h('div', { 'data-testid': 'pp-timeline-row' }, `${fmt(t.at)} · ${STATUS_TR[t.from ?? ''] ?? t.from ?? '—'} → ${STATUS_TR[t.to] ?? t.to}${t.machineCode ? ` · ${t.machineCode}` : ''}${t.operatorName ? ` · ${t.operatorName}` : ''}`)) : ['—'])), section('Kalite', 'pp-quality', ...p.qualityHolds.map((q) => h('div', { 'data-testid': 'pp-hold' }, `Bekletme ${q.status} · ${q.reason} · ${fmt(q.openedAt)}`)), ...p.ncrs.map((n) => h('div', { 'data-testid': 'pp-ncr', 'data-status': n.status }, `NCR ${n.status} · ${n.qty} adet · ${n.reason}`)), p.qualityHolds.length + p.ncrs.length === 0 ? 'Kayıt yok.' : null), p.tools.length ? section('Takımlar', 'pp-tools', ...p.tools.map((t) => h('div', {}, `${t.code} (${t.toolType}) · ${t.from ?? '—'} → ${t.to} · ${fmt(t.at)}`))) : null, section('Çıkan lotlar ve sevkiyat', 'pp-lots', ...(p.lots.length ? p.lots.map((l) => h('div', { 'data-testid': 'pp-lot' }, link('pp-lot-link', `Lot ${l.labelCode ?? l.id.slice(0, 8)}`, 'LOT', l.id), ` · ${l.qty} adet · ${l.state}${l.commercialApproval ? ` · ticari onay ${l.commercialApproval}` : ''}`, ...l.shipments.map(shipmentLine))) : ['Henüz lot yok.'])), economicBox(p.economic));
    }
    function asBuiltBox(p) {
        const a = p.asBuilt;
        if (!a)
            return null;
        if (!a.captured)
            return section('Üretildiği haliyle (as built)', 'pp-as-built', h('div', { 'data-testid': 'pp-as-built-none', style: 'color:#b45309' }, 'Üretim anı kaydı yok — bu iş başlamadan önce ya da kayıt sistemi kurulmadan önce yapılmış. Bugünkü belgeler üretim kanıtı sayılmaz.'));
        const last = a.snapshots[a.snapshots.length - 1];
        return section('Üretildiği haliyle (as built)', 'pp-as-built', a.drift.length ? h('div', { 'data-testid': 'pp-drift', style: 'color:#b91c1c;font-weight:700' }, ...a.drift.map((d) => h('div', { 'data-testid': 'pp-drift-row', 'data-doc': d.docType }, `${d.docType}: üretimde v${d.producedWithVersion} kullanıldı, şu an v${d.currentVersion}${d.currentStatus !== 'ACTIVE' ? ' (geri çekildi)' : ''}`))) : null, ...a.snapshots.map((sn) => h('div', { 'data-testid': 'pp-snapshot', 'data-event': sn.event, style: 'font-size:13px;border-top:1px solid #f1f5f9;padding:3px 0' }, `${fmt(sn.at)} · ${sn.event === 'OP_START' ? 'operasyon başladı' : sn.event === 'FIRST_PIECE_APPROVED' ? 'ilk parça onaylandı' : 'iş başladı'}`
            + (sn.routingStep ? ` · op ${sn.routingStep.opNo}` : '') + (sn.revision ? ` · rev ${sn.revision.revision}` : '') + (sn.machine ? ` · ${sn.machine.code}` : '') + (sn.operator ? ` · ${sn.operator.name}` : '')
            + (sn.camProgram ? ` · CAM ${sn.camProgram.programNo} r${sn.camProgram.revision}` : ''))), h('div', { 'data-testid': 'pp-as-built-docs', style: 'font-size:12px;color:#475569' }, 'Kullanılan belgeler: ', last.documents.length ? last.documents.map((d) => `${d.docType} v${d.versionNo}`).join(', ') : 'kayıtlı belge yok'), last.tools.length ? h('div', { style: 'font-size:12px;color:#475569' }, `Makinedeki takımlar: ${last.tools.map((t) => t.code).join(', ')}`) : null);
    }
    function lotView(p) {
        return h('div', { 'data-testid': 'pp-lot-view', 'data-origin': p.lot.origin }, gapsBox(p.gaps, p.completeness), section('Lot', 'pp-lot-head', docsLink('STOCK_LOT', p.lot.id, 'pp-lot-docs'), kv('Etiket', p.lot.labelCode ?? '—', 'pp-lot-label'), kv('Miktar / durum', `${p.lot.qty} · ${p.lot.state}`), kv('Kaynak', p.lot.origin === 'WORK_ORDER' ? 'Üretim (iş emri)' : 'Satınalma'), p.commercialApproval ? kv('Ticari onay', `${p.commercialApproval.status} · ${fmt(p.commercialApproval.decidedAt)}`) : null, ...p.shipments.map(shipmentLine)), p.purchase ? section('Satınalma', 'pp-purchase', kv('Malzeme', p.purchase.materialCode), kv('Tedarikçi', p.purchase.supplier ?? '—', 'pp-supplier'), kv('Mal kabul', `${p.purchase.receipt.qty ?? '—'} · ${fmt(p.purchase.receipt.receivedAt)}`), kv('Giriş kalite', p.purchase.receipt.qcDecision ?? 'BEKLİYOR', 'pp-incoming-qc')) : null, p.usedIn.length ? section('Kullanıldığı işler (ileri izleme)', 'pp-used-in', ...p.usedIn.map((u) => h('div', { 'data-testid': 'pp-used-in-row' }, link('pp-used-in-link', `${u.productCode ?? 'iş emri'}`, 'WORK_ORDER', u.workOrderId), ` · ${u.issued} verildi · ${STATUS_TR[u.status] ?? u.status}`))) : null, p.workOrder ? woView(p.workOrder, false) : null);
    }
    function productView(p) {
        return h('div', { 'data-testid': 'pp-product-view' }, section('Ürün', 'pp-product-head', kv('Kod', p.product.code, 'pp-product-code'), kv('Ad', p.product.name), kv('Üretim', `${p.production.workOrders} iş emri (${p.production.completed} tamamlandı) · ${p.production.good} sağlam · ${p.production.scrap} fire`
            + (p.production.scrapRate === null ? '' : ` · fire oranı %${(p.production.scrapRate * 100).toFixed(1)}`), 'pp-production'), kv('Kalite', `${p.quality.ncrs} NCR (${p.quality.openNcrs} açık) · ${p.quality.holds} bekletme`), kv('Makineler', p.machines.map((m) => `${m.code}×${m.workOrders}`).join(', ') || '—'), kv('Operatörler', p.operators.map((o) => `${o.name}×${o.workOrders}`).join(', ') || '—')), section('Revizyonlar · BOM · CAM', 'pp-revisions', ...(p.revisions.length ? p.revisions.map((r) => h('div', { 'data-testid': 'pp-revision' }, h('b', {}, `Rev ${r.revision} (${r.status})`), ' ', docsLink('PRODUCT_REVISION', r.id, 'pp-revision-docs'), h('div', {}, `BOM: ${r.bom.map((b) => `${b.materialCode} × ${b.qtyPerUnit}`).join(', ') || 'TANIMSIZ'}`), h('div', {}, `CAM: ${r.camPrograms.map((c) => `${c.programNo} rev ${c.revision} (${c.status})${c.tools.length ? ` · takım: ${c.tools.map((t) => `${t.toolType}×${t.qty}`).join(', ')}` : ''}`).join(' | ') || 'TANIMSIZ'}`)))
            : [h('div', { style: 'color:#b45309' }, 'Revizyon tanımlı değil.')])), section('Son iş emirleri', 'pp-recent', ...(p.recentWorkOrders.length ? p.recentWorkOrders.map((w) => h('div', { 'data-testid': 'pp-recent-wo', 'data-gaps': String(w.gaps.length) }, link('pp-recent-link', `${fmt(w.createdAt)} · ${STATUS_TR[w.status] ?? w.status}`, 'WORK_ORDER', w.id), ` · ${w.qtyProduced}/${w.qtyScrap} · ${w.machineCode ?? '—'} · ${w.operatorName ?? '—'} · ${w.gaps.length ? `${w.gaps.length} eksik halka` : 'tam'}`)) : ['—'])), economicBox(p.economic));
    }
}
