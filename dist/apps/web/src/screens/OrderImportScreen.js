// KMI-007/008 — PDF'ten sipariş: PDF yükle → veri çıkar → müşteri/ürün eşleştir → yönetici doğrular → TASLAK sipariş. Hiçbir adım otomatik kesinleşmez.
// Okunamayan/eksik alanlar açıkça uyarılır; değişen PDF yeni sürüm olur ve fark onayı (öncesi/sonrası) ister. Ticari veri yalnız yetkili kullanıcıya gelir (sunucu).
// Taranmış (yalnız resim) PDF'te metin katmanı yoktur: ekran bunu açıkça söyler, belge yanda açık dururken elle girişe geçer — tahmin yürütmez.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { extractOrder, EXTRACT_BANNER } from '../orderImportExtract.js';
import { errorText } from '../errorText.js';
import { KX_CSS, card, chip, emptyState, field, fmt, fromBase64, invalid, showFile, toBase64, val, when } from '../kx.js';
const OI_CSS = `
.oi .split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:12px;align-items:start}
@media (max-width:1000px){.oi .split{grid-template-columns:1fr}}
.oi .pdfhost{min-height:420px;border:1px solid #1e293b;border-radius:12px;overflow:hidden;background:#0b1220}.oi .pdfhost iframe{width:100%;height:70vh;border:0}
.oi .lrow{border:1px solid #1e293b;border-radius:10px;padding:10px;margin-top:8px;display:grid;gap:8px;grid-template-columns:repeat(6,minmax(0,1fr))}
@media (max-width:700px){.oi .lrow{grid-template-columns:1fr 1fr}}
.oi .lrow .wide{grid-column:1/-1}.oi .lrow label.f{margin:0}
.oi .warn-list{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
`;
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const btn = (cls, testid, text, fn) => E('button', { class: cls, type: 'button', ...(testid ? { 'data-testid': testid } : {}), onClick: fn }, text);
const STATUS_TR = { OPEN: ['Açık', 'info'], EXTRACTED: ['Veri çıkarıldı', 'info'], VERIFIED: ['Doğrulandı', 'warn'], ORDER_DRAFTED: ['Taslak sipariş', 'ok'], CANCELLED: ['İptal', 'off'], APPLIED: ['Uygulandı', 'ok'], SUPERSEDED: ['Eski sürüm', 'off'], REJECTED: ['Reddedildi', 'bad'] };
const WARN_TR = { OCR_UNVERIFIED: 'OCR ile okundu: hiçbir alan doğrulanmış sayılmaz', OCR_FAILED: 'OCR çalışmadı', GRAND_TOTAL_MISMATCH: 'Satır toplamları belgedeki GENEL TOPLAM ile uyuşmuyor', NO_TEXT_LAYER: 'PDF taranmış (yalnız resim): metin okunamadı, elle girin', PO_NUMBER_UNLABELED: 'Sipariş no etiketsiz bulundu (güven düşük)', PO_NUMBER_MISSING: 'Sipariş no bulunamadı', PO_DATE_MISSING: 'Sipariş tarihi bulunamadı',
    PO_DATE_UNLABELED: 'Sipariş tarihi etiketsiz bulundu', PO_DATE_UNREADABLE: 'Sipariş tarihi okunamadı', CURRENCY_MISSING: 'Para birimi bulunamadı', CUSTOMER_NAME_MISSING: 'Müşteri adı bulunamadı', NO_LINES_FOUND: 'Kalem satırı bulunamadı', DELIVERY_BEFORE_ORDER_DATE: 'Teslim tarihi sipariş tarihinden önce' };
const warnText = (w) => WARN_TR[w] ?? (/^LINE_(\d+)_PRICE_TOTAL_MISMATCH$/.exec(w) ? `Kalem ${/(\d+)/.exec(w)[1]}: adet × fiyat ≠ tutar (fiyat tutardan türetildi)` : /^LINE_(\d+)_PRICE_DERIVED_FROM_TOTAL$/.exec(w) ? `Kalem ${/(\d+)/.exec(w)[1]}: birim fiyat tutardan türetildi — kontrol edin` : /^LINE_(\d+)_DATE_UNREADABLE$/.exec(w) ? `Kalem ${/(\d+)/.exec(w)[1]}: teslim tarihi okunamadı` : w);
const wrapVal = (x) => { if (x && typeof x === 'object' && 'value' in x)
    return String(x.value ?? ''); return x === null || x === undefined ? '' : String(x); };
const conf = (x) => (x && typeof x === 'object' && 'confidence' in x ? Number(x.confidence) : null);
export async function renderOrderImportScreen(container, api, state = {}) {
    const go = (s) => renderOrderImportScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'kx oi', 'data-testid': 'oi-root' }, h('style', {}, KX_CSS + OI_CSS), ...kids));
    const banner = () => (state.banner ? E('div', { class: `banner ${state.banner.kind === 'error' ? 'bad' : state.banner.kind === 'ok' ? 'ok' : ''}`, 'data-testid': 'oi-banner', 'data-kind': state.banner.kind, role: state.banner.kind === 'error' ? 'alert' : 'status' }, state.banner.text) : null);
    const fail = (e) => { state = { ...state, banner: { kind: 'error', text: errorText(e) } }; const b = container.querySelector('[data-testid="oi-banner"]'); if (b) {
        b.textContent = state.banner.text;
        b.setAttribute('data-kind', 'error');
        b.className = 'banner bad';
    }
    else
        void go(state); };
    if (!state.id)
        return home();
    return detail(state.id);
    async function home() {
        let rows = [];
        try {
            rows = await api.list();
        }
        catch (e) {
            state = { ...state, banner: { kind: 'error', text: errorText(e) } };
        }
        const file = h('input', { type: 'file', accept: 'application/pdf,.pdf', 'data-testid': 'oi-file' });
        const status = E('div', { class: 'mut', 'data-testid': 'oi-status' });
        const run = async () => {
            const f = file.files?.[0];
            if (!f) {
                fail(new Error('Önce bir PDF seçin'));
                return;
            }
            if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
                fail(new Error('Yalnız PDF yüklenebilir'));
                return;
            }
            if (f.size > 8 * 1024 * 1024) {
                fail(new Error('Dosya 8 MB sınırını aşıyor'));
                return;
            }
            try {
                status.textContent = 'Yükleniyor…';
                const bytes = new Uint8Array(await f.arrayBuffer());
                const imp = await api.start();
                const up = await api.uploadPdf(imp.import_id, f.name, toBase64(bytes), null);
                status.textContent = 'Veri çıkarılıyor…';
                status.textContent = 'Veri çıkarılıyor… (taranmış PDF’lerde OCR 10–60 sn sürebilir)';
                const out = await extractOrder(bytes, { onProgress: (p) => { status.textContent = p.phase === 'TEXT' ? 'Metin katmanı okunuyor…' : `Sayfa ${p.page}/${p.pages} ${p.phase === 'RENDER' ? 'görüntüye çevriliyor' : 'OCR ile okunuyor'}…`; } });
                const ex = out.extraction;
                await api.attach(imp.import_id, up.versionId, ex);
                await go({ id: imp.import_id, banner: EXTRACT_BANNER[out.mode] });
            }
            catch (e) {
                status.textContent = '';
                fail(e);
            }
        };
        shell(E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, h('h1', {}, 'PDF’ten Sipariş'), E('div', { class: 'mut' }, 'Müşteri siparişi PDF’ini yükleyin; veriler çıkarılır, siz doğrularsınız, taslak sipariş oluşur.'))), banner(), card({ title: 'Yeni PDF sipariş', span: 12 }, E('div', { class: 'row' }, E('div', { class: 'grow' }, file), btn('primary', 'oi-start', 'Yükle ve oku', () => void run())), status), card({ title: 'Önceki içe aktarmalar', span: 12 }, rows.length ? E('div', { class: 'rows' }, ...rows.map((r) => E('div', { class: 'r', 'data-testid': 'oi-row' }, E('div', {}, E('b', {}, r.import_no), ` · ${r.po_number ?? 'PO yok'} · ${r.customer ?? 'müşteri seçilmedi'}`), E('div', {}, chip(STATUS_TR[r.status]?.[0] ?? r.status, STATUS_TR[r.status]?.[1] ?? ''), r.pending_diff ? chip('Fark onayı bekliyor', 'warn') : null, ` ${r.versions} sürüm · ${when(r.created_at)} `), btn('ghost sm', 'oi-open', 'Aç', () => void go({ id: r.import_id }))))) : emptyState('Henüz içe aktarma yok', 'Yukarıdan bir PDF yükleyin.', 'oi-empty')));
    }
    async function detail(id) {
        let d;
        try {
            d = await api.get(id);
        }
        catch (e) {
            state = { banner: { kind: 'error', text: errorText(e) } };
            return home();
        }
        const cur = d.versions.find((v) => !['SUPERSEDED', 'REJECTED'].includes(v.state)) ?? d.versions[0];
        if (!cur)
            return home();
        const ex = cur.extraction;
        const hdr = (ex.header ?? {});
        const warnings = (ex.warnings ?? []);
        let sug = { customers: [], lines: [], duplicate_po: [], note: '' };
        try {
            sug = await api.suggest(id, cur.version_no);
        }
        catch { /* suggestions are optional */ }
        const customers = await api.customers().catch(() => []);
        const locked = d.status === 'CANCELLED' || cur.state === 'APPLIED' || !d.can_write;
        // ---- left: the original PDF (never modified)
        const pdfHost = E('div', { class: 'pdfhost', 'data-testid': 'oi-pdf' }, E('div', { class: 'mut', style: 'padding:12px' }, 'Belge yükleniyor…'));
        void api.content(cur.document_version_id).then((c) => { pdfHost.replaceChildren(); showFile(pdfHost, { bytes: fromBase64(c.contentBase64), mime: c.mimeType, fileName: c.fileName, download: false, testids: { frame: 'oi-pdf-frame', link: 'oi-pdf-link', none: 'oi-pdf-none' } }); }).catch((e) => fail(e));
        // ---- right: verifier
        const v = cur.verified;
        const customerSel = h('select', { 'data-testid': 'oi-customer' }, E('option', { value: '' }, '— müşteri seçin —'), ...customers.map((c) => E('option', { value: c.id, ...((v?.header?.customer_id ?? d.customer_id ?? sug.customers[0]?.id) === c.id ? { selected: 'selected' } : {}) }, `${c.name} (${c.code})`)));
        const hv = (k) => wrapVal(v?.header?.[k] ?? hdr[k]);
        const po = h('input', { 'data-testid': 'oi-po', value: hv('po_number'), maxlength: 60 });
        const poDate = h('input', { 'data-testid': 'oi-po-date', type: 'date', value: hv('po_date') });
        const cur_ = h('select', { 'data-testid': 'oi-currency' }, ...['TRY', 'EUR', 'USD', 'GBP'].map((c) => E('option', { value: c, ...(hv('currency') === c ? { selected: 'selected' } : {}) }, c)));
        const pay = h('input', { 'data-testid': 'oi-payment', value: hv('payment_terms'), maxlength: 200 });
        const dterm = h('input', { 'data-testid': 'oi-delivery-terms', value: hv('delivery_terms'), maxlength: 200 });
        const note = h('input', { 'data-testid': 'oi-note', placeholder: 'Düzeltme varsa gerekçe (en az 5 karakter)', maxlength: 300 });
        const rows = [];
        const linesHost = E('div', { 'data-testid': 'oi-lines' });
        const addRow = (src, idx) => {
            const vl = (v?.lines ?? []).find((l) => String(l.line_no) === wrapVal(src?.line_no));
            const g = (k) => wrapVal(vl?.[k] ?? src?.[k]);
            const lineNo = h('input', { 'data-testid': 'oi-l-no', value: g('line_no') || String(idx + 1), inputmode: 'numeric' });
            const part = h('input', { 'data-testid': 'oi-l-part', value: g('customer_part_no') });
            const desc = h('input', { 'data-testid': 'oi-l-desc', value: g('description') });
            const qty = h('input', { 'data-testid': 'oi-l-qty', value: g('qty'), inputmode: 'decimal' });
            const price = h('input', { 'data-testid': 'oi-l-price', value: g('unit_price'), inputmode: 'decimal', placeholder: 'VERİ YOK' });
            const due = h('input', { 'data-testid': 'oi-l-due', type: 'date', value: g('due_date') });
            const lineSug = sug.lines.find((l) => String(l.line_no) === lineNo.value)?.products ?? [];
            const prodSel = h('select', { 'data-testid': 'oi-l-product' }, E('option', { value: '' }, lineSug.length ? '— ürün seçin (öneriler) —' : '— ürün seçin —'), ...lineSug.map((p) => E('option', { value: p.id, ...(String(vl?.product_id ?? '') === p.id ? { selected: 'selected' } : {}) }, `${p.code} · ${p.name} (${p.reason}, %${p.score})`)));
            const find = h('input', { 'data-testid': 'oi-l-find', placeholder: 'Ürün ara (kod/ad)' });
            find.addEventListener('keydown', (ev) => { if (ev.key !== 'Enter')
                return; void api.productSearch(val(find)).then((ps) => { for (const p of ps)
                if (![...prodSel.options].some((o) => o.value === p.id))
                    prodSel.append(E('option', { value: p.id }, `${p.code} · ${p.name}`)); }).catch(fail); });
            const ok = h('input', { type: 'checkbox', 'data-testid': 'oi-l-confirm', ...(vl?.match_confirmed === 'true' ? { checked: true } : {}) });
            const low = (k) => { const c = conf(src?.[k]); return (c !== null && c < 0.6) || src?.confidence !== undefined && (src.confidence < 0.6); };
            const el = E('div', { class: 'lrow', 'data-testid': 'oi-lrow', ...(low('qty') || src?.price_derived ? { 'data-lowconf': 'true' } : {}) }, field('Kalem', lineNo), field('Müşteri parça no', part), E('div', { class: 'wide' }, field('Açıklama', desc)), field('Adet', qty), field('Birim fiyat', price, src?.price_derived ? 'Tutardan türetildi — kontrol edin' : undefined), field('Teslim', due), E('div', { class: 'wide' }, field('Ürünümüz', prodSel)), find, E('label', { class: 'f' }, ok, ' Eşleşmeyi onaylıyorum'));
            const row = { el, read() {
                    invalid(qty, false);
                    invalid(price, false);
                    const q = Number(val(qty).replace(',', '.'));
                    const pr = val(price).trim() === '' ? null : Number(val(price).replace(',', '.'));
                    if (!(q > 0)) {
                        invalid(qty, true);
                        return null;
                    }
                    return { line_no: Number(val(lineNo)), customer_part_no: val(part), description: val(desc), qty: q, unit: null, unit_price: pr, due_date: val(due) || null, product_id: val(prodSel), match_confirmed: ok.checked ? 'true' : 'false' };
                } };
            rows.push(row);
            linesHost.append(el);
        };
        (ex.lines ?? []).forEach((l, i) => addRow(l, i));
        if (!rows.length)
            addRow(null, 0);
        const headerBlock = E('div', { class: 'kx-form' }, field('Müşteri (mevcut kayıt)', customerSel, sug.customers[0] ? `Öneri: ${sug.customers[0].name} (${sug.customers[0].reason})` : 'Öneri yok'), field('Müşteri PO no', po, conf(hdr.po_number) !== null && (conf(hdr.po_number) ?? 1) < 0.6 ? 'Düşük güven — belgeden kontrol edin' : undefined), field('Sipariş tarihi', poDate), field('Para birimi', cur_), field('Ödeme koşulu', pay), field('Teslim şekli', dterm));
        const verify = async () => {
            const lines = [];
            for (const r of rows) {
                const l = r.read();
                if (!l) {
                    fail(new Error('Adet pozitif sayı olmalı'));
                    return;
                }
                lines.push(l);
            }
            try {
                await api.verify(id, cur.version_no, { customer_id: val(customerSel), po_number: val(po), po_date: val(poDate) || null, currency: val(cur_), payment_terms: val(pay) || null, delivery_terms: val(dterm) || null }, lines, val(note) || null);
                await go({ id, banner: { kind: 'ok', text: 'Doğrulandı. Şimdi taslak siparişi oluşturabilirsiniz.' } });
            }
            catch (e) {
                fail(e);
            }
        };
        const diffPanel = cur.diff && !cur.diff.identical && !cur.diff_decision ? card({ title: 'Değişen PDF — fark onayı bekliyor', chip: chip('Onay gerekli', 'warn'), span: 12, testid: 'oi-diff' }, E('div', { class: 'mut' }, 'Yeni sürüm öncekinden farklı. Onaylanmadan siparişe yansımaz.'), E('pre', { class: 'diff', 'data-testid': 'oi-diff-json', style: 'white-space:pre-wrap;font-size:12px;max-height:240px;overflow:auto' }, JSON.stringify(cur.diff, null, 1)), (() => {
            const why = h('input', { 'data-testid': 'oi-diff-reason', placeholder: 'Gerekçe (en az 10 karakter)', maxlength: 300 });
            return E('div', { class: 'row' }, E('div', { class: 'grow' }, why), btn('primary', 'oi-diff-approve', 'Farkı onayla', () => void api.decideDiff(id, cur.version_no, true, val(why)).then(() => go({ id, banner: { kind: 'ok', text: 'Fark onaylandı.' } })).catch(fail)), btn('ghost', 'oi-diff-reject', 'Reddet', () => void api.decideDiff(id, cur.version_no, false, val(why)).then(() => go({ id, banner: { kind: 'info', text: 'Fark reddedildi.' } })).catch(fail)));
        })()) : null;
        // new PDF version for this import
        const newFile = h('input', { type: 'file', accept: 'application/pdf,.pdf', 'data-testid': 'oi-newver-file' });
        const newVer = async () => {
            const f = newFile.files?.[0];
            if (!f) {
                fail(new Error('Önce bir PDF seçin'));
                return;
            }
            try {
                const bytes = new Uint8Array(await f.arrayBuffer());
                const up = await api.uploadPdf(id, f.name, toBase64(bytes), 'Yeni sürüm');
                const out = await extractOrder(bytes);
                await api.attach(id, up.versionId, out.extraction);
                await go({ id, banner: { kind: 'info', text: 'Yeni sürüm eklendi; siparişi sessizce değiştirmez, fark onayı gerekir.' + (out.mode === 'OCR' ? ' (OCR ile okundu: doğrulanmış sayılmaz.)' : '') } });
            }
            catch (e) {
                fail(e);
            }
        };
        const st = STATUS_TR[d.status] ?? [d.status, ''];
        shell(E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, h('h1', {}, `${d.import_no} · PDF sipariş`), E('div', { class: 'mut' }, `${cur.file_name} · sürüm ${cur.version_no} · ${cur.extractor} · ${cur.sha256.slice(0, 12)}…`)), E('div', {}, chip(st[0], st[1], { 'data-testid': 'oi-status-chip' }), ' ', btn('ghost sm', 'oi-back', '← Liste', () => void go({})))), banner(), sug.duplicate_po.length ? E('div', { class: 'banner bad', role: 'alert', 'data-testid': 'oi-dup' }, `Bu PO numarasıyla açık sipariş zaten var: ${sug.duplicate_po.map((x) => `${x.customer_po} (${x.status})`).join(', ')}. Kayıt engellenir.`) : null, warnings.length ? E('div', { class: 'warn-list', 'data-testid': 'oi-warnings' }, ...warnings.map((w) => chip(warnText(w), w === 'NO_TEXT_LAYER' ? 'bad' : 'warn'))) : null, diffPanel, E('div', { class: 'split' }, card({ title: 'Orijinal belge', span: 12 }, pdfHost), card({ title: 'Çıkarılan / doğrulanan veri', span: 12, chip: chip(`${rows.length} kalem`) }, headerBlock, E('h2', { style: 'margin-top:12px' }, 'Kalemler'), linesHost, locked ? null : E('div', { class: 'row', style: 'margin-top:8px' }, btn('ghost sm', 'oi-add-line', '+ Kalem ekle', () => addRow(null, rows.length))), field('Doğrulama notu', note), locked ? emptyState(d.can_write ? 'Bu içe aktarma kapalı' : 'Düzenleme yetkiniz yok', undefined, 'oi-locked') : E('div', { class: 'row' }, btn('primary', 'oi-verify', 'Doğrula', () => void verify()), btn('primary', 'oi-create', 'Taslak sipariş oluştur', () => void api.createOrder(id).then((r) => go({ id, banner: { kind: 'ok', text: `Taslak sipariş oluşturuldu (${r.order_id.slice(0, 8)}…). Onay için mevcut sipariş akışını kullanın.` } })).catch(fail)), btn('ghost', 'oi-cancel', 'İptal et (gerekçeyi nota yazın)', () => { void api.cancel(id, val(note)).then(() => go({ banner: { kind: 'info', text: 'İptal edildi.' } })).catch(fail); })))), d.can_write && d.status !== 'CANCELLED' ? card({ title: 'PDF değişti mi?', span: 12 }, E('div', { class: 'mut' }, 'Yeni sürümü yükleyin; farklar gösterilir, onayınız olmadan sipariş değişmez.'), E('div', { class: 'row' }, E('div', { class: 'grow' }, newFile), btn('ghost', 'oi-newver', 'Yeni sürüm ekle', () => void newVer()))) : null, card({ title: 'Sürüm geçmişi', span: 12 }, E('div', { class: 'rows' }, ...d.versions.map((x) => E('div', { class: 'r', 'data-testid': 'oi-version' }, E('div', {}, E('b', {}, `v${x.version_no}`), ` · ${x.file_name} · ${x.sha256.slice(0, 10)}… · ${when(x.created_at)}`), E('div', {}, chip(STATUS_TR[x.state]?.[0] ?? x.state, STATUS_TR[x.state]?.[1] ?? ''), x.diff_decision ? chip(`Fark: ${x.diff_decision}`, 'info') : null))))));
        void fmt;
    }
}
