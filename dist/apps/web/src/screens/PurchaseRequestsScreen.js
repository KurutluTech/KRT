// KMI NEXT — Satınalma Talepleri: create / from work-order shortage / approve-reject /
// convert approved requests into a priced PO. Every rule re-enforced server-side (0018).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { canTransitionPurchaseRequest } from '../../../../packages/domain/src/purchasing.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { KX_CSS, card, emptyState, chip } from '../kx.js';
function errorText(err) {
    return sharedErrorText(err);
}
const STATUS_TR = {
    SUBMITTED: ['Onay bekliyor', 'warn'], APPROVED: ['Onaylandı — PO bekliyor', 'info'], REJECTED: ['Reddedildi', 'bad'], CONVERTED: ['PO oluşturuldu', 'ok'], CANCELLED: ['İptal', 'off'],
};
const REASONS = ['Stok yenileme', 'Sipariş / iş emri için', 'Acil ihtiyaç', 'Numune / deneme'];
const CSS = `.prq .steps2{counter-reset:s;display:grid;gap:12px 14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));align-items:end}
.prq .stp{counter-increment:s}.prq .stp>.f>span.lbl::before{content:counter(s) ". ";color:#67e8f9;font-weight:800}
.prq .req{display:grid;gap:6px 12px;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1.3fr) auto;align-items:center;padding:10px 4px;border-top:1px solid #1e293b}
.prq .req.hd{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;border-top:0;padding-bottom:4px}
.prq .req .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.prq .po-line{display:grid;gap:6px 12px;grid-template-columns:auto minmax(0,2fr) minmax(0,1fr) minmax(120px,1fr);align-items:center;padding:8px 0;border-top:1px solid #1e293b}
@media (max-width:900px){.prq .req.hd{display:none}.prq .req{grid-template-columns:1fr;border:1px solid #1e293b;border-radius:12px;padding:12px;margin-top:8px}.prq .req .acts{justify-content:flex-start}.prq .po-line{grid-template-columns:auto 1fr}.prq .po-line>:nth-child(n+3){grid-column:2}}`;
const lbl = (t) => h('span', { class: 'lbl' }, t);
export async function renderPurchaseRequestsScreen(container, api, banner) {
    let rows = [];
    let loadError = null;
    try {
        rows = await api.list();
    }
    catch (err) {
        loadError = errorText(err);
    }
    const [materials, suppliers, workOrders] = await Promise.all([
        api.materials ? api.materials().catch(() => []) : Promise.resolve([]),
        api.suppliers ? api.suppliers().catch(() => null) : Promise.resolve(null),
        api.openWorkOrders ? api.openWorkOrders().catch(() => null) : Promise.resolve(null),
    ]);
    const rerender = (b) => renderPurchaseRequestsScreen(container, api, b);
    const sel = (testid, first, opts) => h('select', { 'data-testid': testid }, h('option', { value: '' }, first), ...opts.map((o) => h('option', { value: o.value }, o.label)));
    // ---- A. Talep oluştur ----
    const dl = h('datalist', { id: 'pr-materials' }, ...materials.map((m) => h('option', { value: m })));
    const materialInput = h('input', { type: 'text', 'data-testid': 'pr-material-input', placeholder: 'ör. 4140 Ø40 çubuk — yazın veya listeden seçin', list: 'pr-materials', autocomplete: 'off' });
    const qtyInput = h('input', { type: 'number', min: '0', step: 'any', 'data-testid': 'pr-qty-input', placeholder: 'ör. 25', inputmode: 'decimal' });
    const neededBy = h('input', { type: 'date', 'data-testid': 'pr-needed-input' });
    const reasonSel = sel('pr-reason-select', '— neden seçin —', REASONS.map((r) => ({ value: r, label: r })));
    const reasonInput = h('input', { type: 'text', 'data-testid': 'pr-reason-input', placeholder: 'ek açıklama (isteğe bağlı) — ya da nedeni buraya yazın' });
    const createReason = () => [reasonSel.value, reasonInput.value.trim()].filter(Boolean).join(' — ');
    // ---- İş emri eksiğinden kısa yol ----
    const woInput = workOrders && workOrders.length
        ? sel('pr-wo-input', '— açık iş emri seçin —', workOrders.map((w) => ({ value: w.id, label: w.label })))
        : h('input', { type: 'text', 'data-testid': 'pr-wo-input', placeholder: workOrders ? 'açık iş emri yok' : 'iş emri (seçim listesi yüklenemedi)' });
    if (workOrders && !workOrders.length)
        woInput.disabled = true;
    // ---- B. PO oluştur ----
    const approved = rows.filter((r) => r.status === 'APPROVED');
    const supplierInput = suppliers
        ? sel('po-supplier-input', '— tedarikçi seçin —', suppliers.map((x) => ({ value: x.id, label: x.name })))
        : h('input', { type: 'text', 'data-testid': 'po-supplier-input', placeholder: 'Tedarikçi (liste yüklenemedi)' });
    const currencyInput = h('select', { 'data-testid': 'po-currency-input' }, ...['TRY', 'EUR', 'USD', 'GBP'].map((c) => h('option', { value: c }, c)));
    const priceInputs = new Map();
    const picked = new Map();
    const priceFor = (id) => {
        let el = priceInputs.get(id);
        if (!el) {
            el = h('input', { type: 'number', min: '0', step: '0.0001', 'data-testid': 'pr-price-input', placeholder: 'birim fiyat', inputmode: 'decimal' });
            priceInputs.set(id, el);
        }
        return el;
    };
    const pickFor = (id) => {
        let el = picked.get(id);
        if (!el) {
            el = h('input', { type: 'checkbox', checked: true, 'data-testid': 'po-pick', 'aria-label': 'PO\'ya ekle' });
            picked.set(id, el);
        }
        return el;
    };
    async function run(fn, ok) {
        try {
            await fn();
            await rerender({ kind: 'info', text: ok });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    const rejectBox = new Map();
    const hide = (e, on) => { e.hidden = on; };
    const rejectUi = (r) => {
        const why = h('input', { type: 'text', 'data-testid': 'pr-reject-reason', placeholder: 'Ret nedeni (zorunlu)', 'aria-label': 'Ret nedeni' });
        const box = h('div', { class: 'row', style: 'flex-basis:100%;grid-column:1/-1;margin-top:6px', hidden: true }, h('div', { class: 'grow' }, why), h('button', { type: 'button', class: 'danger', 'data-testid': 'pr-reject-confirm', onClick: () => { if (why.value.trim().length < 3) {
                why.setAttribute('aria-invalid', 'true');
                return void rerender({ kind: 'error', text: 'Ret nedeni zorunlu.' });
            } void run(() => api.decide(r.id, 'REJECTED', why.value.trim()), 'Talep reddedildi.'); } }, 'Reddi onayla'));
        rejectBox.set(r.id, box);
        return box;
    };
    const reqRow = (r) => {
        const st = STATUS_TR[r.status] ?? [r.status, ''];
        const canApprove = canTransitionPurchaseRequest(r.status, 'APPROVED').ok;
        const canReject = canTransitionPurchaseRequest(r.status, 'REJECTED').ok;
        const box = canReject ? rejectUi(r) : null;
        return h('div', { class: 'req', 'data-testid': 'pr-row', 'data-request-id': r.id, style: canReject ? 'grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1.3fr) auto' : '' }, h('div', {}, h('b', { 'data-testid': 'pr-material' }, r.materialCode), r.reason ? h('div', { class: 'mut' }, r.reason) : null), h('div', { 'data-testid': 'pr-qty' }, String(r.qty)), h('div', {}, chip(st[0], st[1], { 'data-testid': 'pr-status', 'data-status': r.status })), h('div', { class: 'acts' }, canApprove ? h('button', { type: 'button', class: 'good', 'data-testid': 'pr-approve-btn', onClick: () => run(() => api.decide(r.id, 'APPROVED', 'Satınalma talebi onaylandı'), 'Talep onaylandı.') }, 'Onayla') : null, canReject ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'pr-reject-btn', onClick: () => hide(box, !box.hidden) }, 'Reddet…') : null), box);
    };
    const body = loadError
        ? h('div', { class: 'banner bad', 'data-testid': 'pr-load-error' }, `Yüklenemedi: ${loadError}`)
        : h('div', { class: 'stack' }, card({ title: 'A · Satınalma talebi oluştur', testid: 'pr-card-create', chip: chip('Yeni talep', 'info') }, h('div', { class: 'steps2' }, h('div', { class: 'stp' }, h('label', { class: 'f' }, lbl('Malzeme / ürün'), materialInput, dl, h('span', { class: 'hint' }, 'Daha önce kullanılan malzemeler listede çıkar.'))), h('div', { class: 'stp' }, h('label', { class: 'f' }, lbl('Miktar'), qtyInput, h('span', { class: 'hint' }, 'Malzemenin stok biriminde (adet / kg / çubuk).'))), h('div', { class: 'stp' }, h('label', { class: 'f' }, lbl('İhtiyaç tarihi (isteğe bağlı)'), neededBy)), h('div', { class: 'stp' }, h('label', { class: 'f' }, lbl('Neden'), reasonSel)), h('div', { class: 'stp', style: 'grid-column:1/-1' }, h('label', { class: 'f' }, lbl('Kısa açıklama (gerekiyorsa)'), reasonInput))), h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pr-create-btn', onClick: () => {
                const reason = createReason();
                if (!materialInput.value.trim())
                    return void rerender({ kind: 'error', text: 'Malzeme / ürün seçin veya yazın.' });
                if (!(Number(qtyInput.value) > 0))
                    return void rerender({ kind: 'error', text: 'Miktar sıfırdan büyük olmalı.' });
                if (!reason)
                    return void rerender({ kind: 'error', text: 'Talep nedenini seçin veya yazın.' });
                void run(() => api.create(materialInput.value.trim(), Number(qtyInput.value), reason, neededBy.value || null), 'Talep oluşturuldu.');
            } }, 'Talebi oluştur')), h('div', { class: 'kx-sub', style: 'margin-top:14px' }, h('div', { class: 'row' }, h('b', {}, 'Kısa yol: iş emri malzeme eksiğinden talep'), h('span', { class: 'mut' }, 'Eksik malzemeler için talepler otomatik açılır; tekrar basılırsa çoğaltılmaz.')), h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'grow' }, woInput), h('button', { type: 'button', class: 'ghost', 'data-testid': 'pr-shortage-btn', onClick: () => { if (!woInput.value.trim())
                return void rerender({ kind: 'error', text: 'Önce iş emrini seçin.' }); void run(() => api.fromShortage(woInput.value.trim()), 'Malzeme eksiğinden talepler oluşturuldu.'); } }, 'Eksikten talep aç')))), card({ title: 'Talepler', testid: 'pr-card-list', chip: chip(`${rows.length} kayıt`, 'off') }, rows.length ? h('div', {}, h('div', { class: 'req hd' }, h('div', {}, 'Malzeme'), h('div', {}, 'Miktar'), h('div', {}, 'Durum'), h('div', {}, '')), h('div', { 'data-testid': 'pr-table' }, ...rows.map(reqRow)))
            : emptyState('Henüz talep yok', 'Yukarıdaki formla ilk talebi oluşturun.')), card({ title: 'B · Onaylanan taleplerden satınalma siparişi (PO) oluştur', testid: 'pr-card-po', chip: chip(approved.length ? `${approved.length} onaylı talep` : 'Onaylı talep yok', approved.length ? 'info' : 'off') }, approved.length ? h('div', {}, h('div', { class: 'mut' }, '1. Siparişe girecek talepleri işaretleyin ve birim fiyat girin.'), ...approved.map((r) => h('div', { class: 'po-line' }, pickFor(r.id), h('div', {}, h('b', {}, r.materialCode)), h('div', { class: 'mut' }, `${r.qty} adet/birim`), priceFor(r.id))), h('div', { class: 'steps2', style: 'margin-top:12px' }, h('div', { class: 'stp' }, h('label', { class: 'f' }, lbl('Tedarikçi'), supplierInput)), h('div', { class: 'stp' }, h('label', { class: 'f' }, lbl('Para birimi'), currencyInput))), h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'po-from-requests-btn', onClick: () => {
                const lines = approved.filter((r) => pickFor(r.id).checked).map((r) => ({ requestId: r.id, unitPrice: Number(priceFor(r.id).value) }));
                if (!lines.length)
                    return void rerender({ kind: 'error', text: 'En az bir talep işaretleyin.' });
                if (!supplierInput.value.trim())
                    return void rerender({ kind: 'error', text: 'Tedarikçiyi seçin.' });
                void run(() => api.convertToPo(supplierInput.value.trim(), currencyInput.value.trim(), lines), 'Onaylı taleplerden satınalma siparişi oluşturuldu.');
            } }, 'PO oluştur')))
            : emptyState('PO için onaylı talep yok', 'Talepler onaylandıktan sonra burada fiyat ve tedarikçi girerek PO oluşturursunuz.')));
    const screen = h('div', { class: 'purchase-requests-screen kx prq' }, h('style', {}, KX_CSS + CSS), h('div', { class: 'page-head' }, h('div', { class: 'ttl' }, h('h1', { 'data-testid': 'pr-heading' }, 'Satınalma Talepleri'), h('div', { class: 'mut' }, 'Talep oluştur → onay → onaylı taleplerden PO.'))), banner ? h('div', { class: `banner ${banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'pr-banner', 'data-kind': banner.kind }, banner.text) : null, body);
    mount(container, screen);
}
