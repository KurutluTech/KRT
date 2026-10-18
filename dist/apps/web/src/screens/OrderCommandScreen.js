// KMI-008 — Sipariş Komuta Merkezi: sipariş no / kalem no, kalan miktar, termin riski, iş emri ihtiyacı, teklif kökeni, değişiklik (revizyon), sipariş onayı yazdırma, arama.
// Yetki ve fiyat görünürlüğü SUNUCUDA belirlenir. Risk yalnız kanonik satırlardan türetilir; hiçbir boş değer 0 yazılmaz. Durum geçişi ve iş emri açma mevcut kanonik işlevlerle yapılır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionOrderStatus } from '../../../../packages/domain/src/order.js';
import { errorText, isSetupPending } from '../errorText.js';
const CSS = `
.oc{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:1100px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.oc h1{color:#fff;font-size:20px;margin:6px 0}.oc h2{color:#fff;font-size:16px;margin:0 0 6px}
.oc button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}
.oc input,.oc textarea{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.oc .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0}
.oc .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.oc .grid{display:grid;gap:8px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.oc .primary{background:#1d4ed8;color:#fff}.oc .ghost{background:#1e293b;color:#e2e8f0}.oc .danger{background:#7f1d1d;color:#fecaca}
.oc .chip{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:11px;background:#1e293b;color:#e6edf7}
.oc .ok{background:#14532d;color:#bbf7d0}.oc .warn{background:#78350f;color:#fde68a}.oc .bad{background:#7f1d1d;color:#fecaca}.oc .info{background:#1e3a8a;color:#dbeafe}
.oc .card.bad{background:#0f172a;border-color:#b91c1c}.oc .card.info{background:#0f172a;border-color:#1d4ed8}
.oc .mut{color:#94a3b8;font-size:12px}.oc .kpi{border:1px solid #1e293b;border-radius:12px;padding:10px;background:#0b1220}.oc .kpi b{display:block;font-size:20px;color:#fff}
.oc .tw{overflow-x:auto}.oc table{border-collapse:collapse;width:100%;font-size:13px}.oc th,.oc td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left;white-space:nowrap}.oc th{color:#94a3b8}
.oc label{font-size:12px;color:#94a3b8;display:block}
.oc-print{display:none}
@media print{body *{visibility:hidden}.oc-print,.oc-print *{visibility:visible}.oc-print{display:block;position:absolute;inset:0;background:#fff;color:#000;padding:28px;font-family:system-ui,sans-serif}}
.oc-print table{border-collapse:collapse;width:100%;font-size:13px}.oc-print th,.oc-print td{border:1px solid #999;padding:6px 8px;text-align:left}
.oc-print .wm{font-size:44px;color:#c00;opacity:.25;transform:rotate(-12deg);margin:10px 0;font-weight:900}
`;
const NA = 'VERİ YOK';
const ST_TR = { DRAFT: 'Taslak', CONFIRMED: 'Onaylandı', IN_PRODUCTION: 'Üretimde', PARTIALLY_SHIPPED: 'Kısmen sevk edildi', SHIPPED: 'Sevk edildi', CLOSED: 'Kapandı', CANCELLED: 'İptal' };
const WO_TR = { PLANNED: 'Plana alındı', PRODUCTION_DONE: 'Üretim bitti · onay bekliyor', RELEASED: 'Serbest', IN_PROGRESS: 'Üretimde', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal', ON_HOLD: 'Bekletmede' };
const stChip = (s) => (['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'CLOSED'].includes(s) ? 'ok' : s === 'CANCELLED' ? 'bad' : s === 'DRAFT' ? 'info' : 'warn');
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const n = (v) => (v === null || v === undefined ? NA : v.toLocaleString('tr-TR', { maximumFractionDigits: 4 }));
const price = (v, cur = 'TRY') => (v === null || v === undefined ? NA : `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${cur}`);
const num = (s) => { const t = s.trim().replace(',', '.'); if (t === '')
    return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const RISK_TR = { OVERDUE: 'Termin geçti', NO_WORK_ORDER_DUE_SOON: 'Termin yakın · iş emri yok' };
export async function renderOrderCommandScreen(container, api, state = {}) {
    const go = (s) => renderOrderCommandScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'oc', 'data-testid': 'oc-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'info'}`, 'data-testid': 'oc-banner', 'data-kind': state.banner.kind }, state.banner.text) : null;
    // a refused action keeps the typed form as it is; only the message appears
    const fail = (e) => {
        const text = errorText(e);
        const root = container.querySelector('[data-testid="oc-root"]');
        let b = container.querySelector('[data-testid="oc-banner"]');
        if (!b && root) {
            b = h('div', { class: 'card bad', 'data-testid': 'oc-banner', 'data-kind': 'error' }, text);
            const first = [...root.children].find((c) => c.tagName !== 'STYLE');
            root.insertBefore(b, first?.nextSibling ?? null);
        }
        else if (b) {
            b.textContent = text;
            b.className = 'card bad';
            b.setAttribute('data-kind', 'error');
        }
        try {
            b?.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    if (state.order)
        return renderDetail(state.order);
    return renderHome();
    async function renderHome() {
        let ov;
        try {
            ov = await api.overview();
        }
        catch (e) {
            shell(h('h1', {}, 'Sipariş Komuta Merkezi'), isSetupPending(e) ? h('div', { class: 'card warn', 'data-testid': 'oc-setup' }, 'Kurulum bekleniyor: Sipariş Komuta Merkezi için sunucu güncellemesi (0104) henüz uygulanmadı. Mevcut siparişleriniz etkilenmedi; “Siparişler” ekranı çalışmaya devam eder.')
                : h('div', { class: 'card bad', 'data-testid': 'oc-error' }, `Yüklenemedi: ${errorText(e)}`), h('a', { href: '#/siparisler' }, 'Siparişler ekranına git'));
            return;
        }
        const s = ov.summary;
        const kpi = (id, label, v, bad = false) => h('div', { class: 'kpi', 'data-testid': `oc-kpi-${id}` }, h('b', { style: bad && v > 0 ? 'color:#fca5a5' : '' }, String(v)), label);
        const findBox = h('input', { type: 'text', 'data-testid': 'oc-find', placeholder: 'Sipariş no, müşteri PO veya teklif no', value: state.q ?? '' });
        const doFind = async () => { const q = findBox.value.trim(); try {
            const r = await api.find(q);
            if (r.length === 1)
                return void go({ order: r[0].id });
            await go({ found: r, q });
        }
        catch (e) {
            fail(e);
        } };
        shell(h('h1', {}, 'Sipariş Komuta Merkezi'), banner, h('div', { class: 'grid', 'data-testid': 'oc-kpis' }, kpi('open', 'Açık sipariş', s.openOrders), kpi('draft', 'Taslak sipariş', s.draftOrders), kpi('overdue', 'Termini geçen kalem', s.overdueItems, true), kpi('soon', 'Termini yakın (3 gün)', s.dueSoonItems), kpi('need', 'İş emri bekleyen kalem', s.woNeedItems), kpi('over', 'Fazla sevk edilmiş kalem', s.overShippedItems, true)), h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:220px' }, findBox), h('button', { type: 'button', class: 'primary', 'data-testid': 'oc-find-go', onClick: () => void doFind() }, 'Bul')), state.found ? (state.found.length ? h('div', { 'data-testid': 'oc-found' }, ...state.found.map((f) => h('div', {}, h('a', { href: '#', onClick: (ev) => { ev.preventDefault(); void go({ order: f.id }); } }, `${f.orderNo ?? f.id} · ${f.customerPo ?? ''}`)))) : h('div', { class: 'mut', 'data-testid': 'oc-notfound' }, 'Eşleşen sipariş yok.')) : null, h('div', { class: 'mut' }, 'Not: karekod/pasaport okutma (KMI-081) henüz yok; burada yalnız yazarak arama yapılır.')), h('div', { class: 'card' }, h('h2', {}, 'Siparişler'), h('div', { class: 'tw' }, h('table', { 'data-testid': 'oc-orders' }, h('tr', {}, ...['Sipariş no', 'Müşteri', 'PO', 'Durum', 'Kalem', 'Adet', 'Kalan', 'En yakın termin', 'Risk', 'Teklif'].map((x) => h('th', {}, x))), ...ov.orders.map((o) => h('tr', { 'data-testid': 'oc-order-row', 'data-order': o.id, style: 'cursor:pointer', onClick: () => void go({ order: o.id }) }, h('td', {}, o.orderNo ?? NA), h('td', {}, o.customer), h('td', {}, o.customerPo ?? ''), h('td', {}, h('span', { class: `chip ${stChip(o.status)}` }, ST_TR[o.status] ?? o.status)), h('td', {}, String(o.items)), h('td', {}, n(o.qtyOrdered)), h('td', {}, n(o.qtyRemaining)), h('td', {}, o.nextDue ?? '—'), h('td', {}, o.risk ? h('span', { class: `chip ${o.risk === 'OVERDUE' ? 'bad' : 'warn'}` }, RISK_TR[o.risk]) : ''), h('td', {}, o.quoteNo ?? '')))), !ov.orders.length ? h('div', { class: 'mut' }, 'Henüz sipariş yok.') : null)), h('div', { class: 'card' }, h('h2', {}, 'Planlama kuyruğu — iş emri bekleyen kalemler'), h('div', { class: 'tw' }, h('table', { 'data-testid': 'oc-queue' }, h('tr', {}, ...['Sipariş', 'Kalem', 'Ürün', 'İhtiyaç', 'Termin', ''].map((x) => h('th', {}, x))), ...ov.queue.map((q) => h('tr', { 'data-testid': 'oc-queue-row' }, h('td', {}, q.orderNo ?? NA), h('td', {}, String(q.lineNo ?? '')), h('td', {}, q.product ?? ''), h('td', {}, n(q.woNeed)), h('td', {}, q.dueDate, q.overdue ? h('span', { class: 'chip bad' }, 'geçti') : null), h('td', {}, h('button', { type: 'button', class: 'ghost', onClick: () => void go({ order: q.orderId }) }, 'Aç'))))), !ov.queue.length ? h('div', { class: 'mut' }, 'Bekleyen iş emri ihtiyacı yok.') : null)), h('a', { href: '#/siparisler' }, 'Sipariş oluşturma ve eski liste: Siparişler'));
    }
    async function renderDetail(id) {
        let d;
        try {
            d = await api.detail(id);
        }
        catch (e) {
            shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({}) }, '← Komuta Merkezi'), h('div', { class: 'card bad', 'data-testid': 'oc-error' }, errorText(e)));
            return;
        }
        const o = d.order;
        const p = d.permissions;
        const st = o.status;
        const act = (fn) => async () => { try {
            await fn();
            await go({ order: id, banner: { kind: 'info', text: 'Kaydedildi.' } });
        }
        catch (e) {
            fail(e);
        } };
        const reasonOf = (msg) => { const r = (window.prompt(msg) ?? '').trim(); return r.length >= 5 ? r : null; };
        const trans = [['CONFIRMED', 'Siparişi onayla', 'primary'], ['CANCELLED', 'Siparişi iptal et', 'danger']];
        const transBtns = trans.filter(([to]) => canTransitionOrderStatus(st, to).ok && (to === 'CANCELLED' ? p.canCancel : p.canConfirm)).map(([to, label, cls]) => h('button', { type: 'button', class: cls, 'data-testid': `oc-to-${to}`, onClick: act(async () => { const r = reasonOf(`${label}: gerekçe (en az 5 karakter)`); if (!r)
                throw new Error('REASON_REQUIRED'); await api.transition(id, to, r); }) }, label));
        const itemCard = (it) => {
            const editable = p.canChange && ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION'].includes(st);
            const qty = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': `oc-qty-${it.lineNo}`, value: String(it.qty) });
            const due = h('input', { type: 'date', 'data-testid': `oc-due-${it.lineNo}`, value: it.dueDate });
            const pr = p.canSeePrice ? h('input', { type: 'text', inputmode: 'decimal', 'data-testid': `oc-price-${it.lineNo}`, value: it.unitPrice === null ? '' : String(it.unitPrice) }) : null;
            const why = h('input', { type: 'text', 'data-testid': `oc-why-${it.lineNo}`, placeholder: 'Değişiklik gerekçesi (en az 5 karakter)' });
            const woQty = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': `oc-woqty-${it.lineNo}`, value: it.woNeed > 0 ? String(it.woNeed) : '' });
            const v = (x) => x.value;
            return h('div', { class: 'card', 'data-testid': 'oc-item', 'data-item': it.id }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', {}, `Kalem ${it.lineNo ?? '?'} · ${it.productCode ?? NA} ${it.productName ?? ''}`), h('span', {}, it.overdue ? h('span', { class: 'chip bad' }, 'Termin geçti') : it.dueSoon ? h('span', { class: 'chip warn' }, 'Termin yakın') : null, it.overShipped ? h('span', { class: 'chip bad' }, ' Fazla sevk') : null, it.woNeed > 0 ? h('span', { class: 'chip warn', 'data-testid': 'oc-needwo' }, ` İş emri gerekli: ${n(it.woNeed)}`) : null)), h('div', { class: 'mut' }, `Sipariş ${n(it.qty)} · üretilen ${n(it.qtyProduced)} · sevk edilen ${n(it.qtyShipped)} · kalan ${n(it.remaining)} · termin ${it.dueDate}${p.canSeePrice ? ` · birim fiyat ${price(it.unitPrice)}` : ''}`), it.quote ? h('div', { class: 'mut', 'data-testid': 'oc-quote' }, `Teklif ${it.quote.quoteNo} Rev ${it.quote.revisionNo}: ${n(it.quote.qty)} adet${p.canSeePrice ? ` @ ${price(it.quote.quotedUnitPrice, it.quote.currency)}` : ''} · `, h('span', { class: `chip ${it.quote.conversion === 'LOSSLESS' ? 'ok' : 'warn'}` }, it.quote.conversion === 'LOSSLESS' ? 'Tekliften aynen geldi' : 'Dönüşümden sonra değişti')) : null, h('div', { class: 'mut' }, 'İş emirleri: ', it.workOrders.length ? it.workOrders.map((w) => `${WO_TR[w.status] ?? w.status} ${n(w.qtyPlanned)} (üretilen ${n(w.qtyProduced)})`).join(' · ') : 'yok'), editable ? h('div', {}, h('div', { class: 'grid' }, h('div', {}, h('label', {}, 'Adet'), qty), h('div', {}, h('label', {}, 'Termin'), due), pr ? h('div', {}, h('label', {}, 'Birim fiyat'), pr) : null), h('div', { style: 'margin-top:8px' }, why), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': `oc-save-${it.lineNo}`, onClick: async () => {
                    try {
                        const r = await api.change(it.id, { qty: num(v(qty)), dueDate: v(due) || null, unitPrice: pr ? num(v(pr)) : null }, v(why).trim(), newId());
                        await go({ order: id, banner: { kind: 'info', text: `Değişiklik kaydedildi (sipariş revizyonu ${r.revisionNo}).` } });
                    }
                    catch (e) {
                        fail(e);
                    }
                } }, 'Değişikliği kaydet'))) : null, p.canWorkOrder && it.woNeed > 0 && ['CONFIRMED', 'IN_PRODUCTION'].includes(st) ? h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { style: 'width:140px' }, woQty), h('button', { type: 'button', class: 'ghost', 'data-testid': `oc-wo-${it.lineNo}`, onClick: async () => {
                    const q = num(v(woQty));
                    if (q === null || q <= 0)
                        return fail(new Error('QTY_MUST_BE_POSITIVE'));
                    try {
                        await api.createWorkOrder(it.id, q);
                        await go({ order: id, banner: { kind: 'info', text: 'İş emri açıldı.' } });
                    }
                    catch (e) {
                        fail(e);
                    }
                } }, 'İş emri aç')) : null);
        };
        const pr = state.print;
        const sheet = pr ? h('div', { class: 'oc-print', 'data-testid': 'oc-print' }, h('h1', {}, pr.title), pr.watermark ? h('div', { class: 'wm', 'data-testid': 'oc-print-wm' }, pr.watermark) : null, h('div', {}, h('b', {}, `${pr.orderNo ?? ''} · Revizyon ${pr.revisionNo ?? 1}`)), h('div', {}, `Müşteri: ${pr.customer.name}${pr.customerPo ? ` · PO: ${pr.customerPo}` : ''}`), h('table', {}, h('tr', {}, ...['Kalem', 'Ürün', 'Adet', 'Termin', ...(pr.pricesIncluded ? ['Birim fiyat', 'Toplam'] : [])].map((x) => h('th', {}, x))), ...pr.lines.map((l) => h('tr', {}, h('td', {}, String(l.lineNo ?? '')), h('td', {}, `${l.productCode ?? ''} ${l.description ?? ''}`), h('td', {}, n(l.qty)), h('td', {}, l.dueDate), ...(pr.pricesIncluded ? [h('td', {}, price(l.unitPrice)), h('td', {}, price(l.lineTotal))] : [])))), h('div', { style: 'margin-top:16px;font-size:11px' }, `Yazdırma zamanı: ${pr.printedAt.slice(0, 16).replace('T', ' ')}`)) : null;
        shell(h('button', { type: 'button', class: 'ghost', 'data-testid': 'oc-back', onClick: () => void go({}) }, '← Komuta Merkezi'), banner, h('div', { class: 'card', 'data-testid': 'oc-head' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('h1', { 'data-testid': 'oc-title' }, `${o.orderNo ?? NA} · Rev ${o.revisionNo ?? 1}`), h('div', { class: 'mut' }, `${o.customer} (${o.customerCode}) · PO ${o.customerPo ?? '—'}`)), h('span', { class: `chip ${stChip(o.status)}`, 'data-testid': 'oc-status' }, ST_TR[o.status] ?? o.status)), d.lineage ? h('div', { class: 'mut', 'data-testid': 'oc-lineage' }, `Teklif ${d.lineage.quoteNo} üzerinden ${d.lineage.convertedAt.slice(0, 10)} tarihinde oluştu · ${d.lineage.quoteItems} teklif kalemi → ${d.lineage.orderItems} sipariş kalemi`) : null, h('div', { class: 'row', style: 'margin-top:8px' }, ...transBtns, p.canPrint ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'oc-print-btn', onClick: async () => { try {
                const x = await api.print(id);
                await go({ order: id, print: x });
                try {
                    window.print();
                }
                catch { /* headless */ }
            }
            catch (e) {
                fail(e);
            } } }, 'Sipariş onayını yazdır') : null)), ...d.items.map(itemCard), h('div', { class: 'card', 'data-testid': 'oc-changes' }, h('h2', {}, 'Değişiklik geçmişi'), ...(d.changes.length ? d.changes.map((c) => h('div', { class: 'mut', 'data-testid': 'oc-change' }, `Rev ${c.revisionNo} · kalem ${c.lineNo ?? '?'} · ${[c.qtyTo !== null ? `adet ${n(c.qtyFrom)} → ${n(c.qtyTo)}` : '', c.dueTo ? `termin ${c.dueFrom} → ${c.dueTo}` : '', c.priceChanged ? (p.canSeePrice ? `fiyat ${price(c.priceFrom)} → ${price(c.priceTo)}` : 'fiyat değişti') : ''].filter(Boolean).join(' · ')} · ${c.reason} · ${c.by ?? ''} ${c.at.slice(0, 16).replace('T', ' ')}`, c.deviatesFromQuote ? h('span', { class: 'chip warn' }, ' tekliften sapma') : null)) : [h('div', { class: 'mut' }, 'Henüz değişiklik yok.')])), sheet);
    }
}
