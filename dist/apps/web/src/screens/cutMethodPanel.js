// CUT/PREP kesim yöntemi: İÇ / DIŞ / KARMA. Hesap, yetki ve kayıt SUNUCUDADIR (wo_cut_* RPC'leri, migration 0090); bu panel yalnız çağırır ve gösterir.
// Sunucu güncellemesi uygulanmamışsa (RPC yok) panel "bekliyor" der; hiçbir şey çalışıyormuş gibi gösterilmez ve hiçbir kayıt yazılmaz.
import { h } from '../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../errorText.js';

const METHODS = [['INNER', 'İÇ KESİM — Makine 101 (testere süresi, kapasite, iç maliyet)'], ['OUTER', 'DIŞ KESİM — tedarikçi hizmeti (adet × birim bedel; Makine 101 yükü yok)'], ['MIXED', 'KARMA — bir kısmı iç, bir kısmı dış']];
const num = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

export function drawCutMethod(host, api, { revisionId, canEdit }) {
    let woId = null; let plan = null; let calc = null;
    const noteHost = h('div', { 'aria-live': 'polite' });
    const body = h('div', { 'data-testid': 'cut-body', class: 'stack', style: 'gap:6px;margin-top:6px' });
    const say = (kind, text) => { noteHost.replaceChildren(...(text ? [h('div', { class: 'banner', role: 'status', 'data-testid': kind === 'error' ? 'cut-error' : 'cut-note' }, text)] : [])); };
    async function loadWos() {
        try {
            const wos = await api.cutWorkOrders(revisionId);
            if (!wos.length) { body.replaceChildren(h('div', { class: 'mut', 'data-testid': 'cut-nowo' }, 'Bu revizyon için iş emri yok. Kesim yöntemi iş emri bazında seçilir; ürün rotası değişmez.')); return; }
            woId = woId ?? wos[0].id;
            await loadPlan(wos);
        } catch (e) { fail(e); }
    }
    function fail(e) {
        if (isSetupPending(e)) { body.replaceChildren(h('div', { class: 'banner', role: 'status', 'data-testid': 'pw-cut-unavailable' }, 'Dış ve karma kesim sunucu güncellemesi bekliyor (0090). Şimdilik tüm kesim İÇ KESİM (Makine 101) olarak işler; hiçbir kayıt yazılmaz.')); return; }
        say('error', errorText(e)); if (!body.children.length) body.replaceChildren(noteHost);
    }
    async function loadPlan(wos) {
        window.__wos = wos;
        plan = await api.cutPlanGet(woId);
        try { calc = await api.cutCalc(woId); } catch (e) { calc = null; if (!isSetupPending(e)) say('error', errorText(e)); }
        draw(wos);
    }
    function draw(wos) {
        const selWo = h('select', { 'data-testid': 'cut-wo', 'aria-label': 'İş emri', onChange: (e) => { woId = e.target.value; say(); void loadPlan(wos).catch(fail); } },
            ...wos.map((w) => h('option', { value: w.id, selected: w.id === woId }, `${String(w.id).slice(0, 8)} · ${w.qtyPlanned} adet · ${w.status}`)));
        const total = Number(plan.qtyPlanned);
        let method = plan.method ?? 'INNER';
        const inner = h('input', { type: 'number', min: 0, 'data-testid': 'cut-inner', value: plan.innerQty ?? total });
        const outer = h('input', { type: 'number', min: 0, 'data-testid': 'cut-outer', value: plan.outerQty ?? 0 });
        const fee = h('input', { type: 'number', min: 0, step: '0.0001', 'data-testid': 'cut-fee', value: plan.unitFee ?? '' });
        const cur = h('select', { 'data-testid': 'cut-cur' }, ...['TRY', 'EUR', 'USD'].map((c) => h('option', { value: c, selected: (plan.currency ?? 'TRY') === c }, c)));
        const frt = h('input', { type: 'number', min: 0, step: '0.01', 'data-testid': 'cut-freight', value: plan.freightAmount ?? '' });
        const ref = h('input', { 'data-testid': 'cut-ref', placeholder: 'İrsaliye / sipariş no', value: plan.docRef ?? '' });
        const nt = h('input', { 'data-testid': 'cut-note-in', placeholder: 'Açıklama', value: plan.note ?? '' });
        const why = h('input', { 'data-testid': 'cut-reason', placeholder: 'Gerekçe (en az 10 karakter)', maxlength: 400 });
        const sup = h('select', { 'data-testid': 'cut-supplier' }, h('option', { value: '' }, '— tedarikçi seç —'));
        void api.suppliers().then((rows) => { sup.replaceChildren(h('option', { value: '' }, '— tedarikçi seç —'), ...rows.filter((r) => r.active !== false).map((r) => h('option', { value: r.id, selected: r.id === plan.supplierId }, r.name))); }).catch(() => {});
        const moneyHidden = plan.plan && plan.moneyVisible === false;
        if (moneyHidden) { fee.disabled = true; cur.disabled = true; frt.disabled = true; }
        const outerBox = h('div', { 'data-testid': 'cut-outer-box', class: 'stack', style: 'gap:4px' },
            h('label', {}, 'Tedarikçi ', sup), h('label', {}, 'Birim hizmet bedeli ', fee, ' ', cur), h('label', {}, 'Nakliye (toplam) ', frt), h('label', {}, 'Belge/irsaliye ', ref), moneyHidden ? h('div', { class: 'mut', 'data-testid': 'cut-money-hidden' }, 'Hizmet bedeli, para birimi ve nakliye yalnız ekonomi yetkisi olanlara görünür ve onlar tarafından değiştirilir.') : null);
        const sync = () => {
            const m = method; inner.disabled = m !== 'MIXED' || !canEdit; outer.disabled = m !== 'MIXED' || !canEdit;
            if (m === 'INNER') { inner.value = total; outer.value = 0; } else if (m === 'OUTER') { inner.value = 0; outer.value = total; }
            else if (m === 'MIXED' && Number(inner.value) + Number(outer.value) !== total) { outer.value = Math.max(total - Number(inner.value), 0); }
            outerBox.style.display = m === 'INNER' ? 'none' : '';
        };
        const radios = METHODS.map(([v, t]) => h('label', {}, h('input', { type: 'radio', name: 'cutm', value: v, checked: v === method, disabled: !canEdit, 'data-testid': `pw-cut-${v === 'INNER' ? 'inner' : v === 'OUTER' ? 'outer' : 'mixed'}`, onChange: () => { method = v; sync(); } }), ` ${t}`));
        inner.addEventListener('input', () => { if (method === 'MIXED') outer.value = Math.max(total - Number(inner.value), 0); });
        outer.addEventListener('input', () => { if (method === 'MIXED') inner.value = Math.max(total - Number(outer.value), 0); });
        const save = h('button', { type: 'button', class: 'primary', 'data-testid': 'cut-save', disabled: !canEdit, onClick: async () => {
            const i = num(inner.value); const o = num(outer.value); const reason = why.value.trim();
            if (!(i >= 0) || !(o >= 0)) return fail(new Error('Miktarlar geçersiz.'));
            if (i + o !== total) return fail(new Error(`İç + dış miktar iş emri miktarına (${total}) eşit olmalı.`));
            if (reason.length < 10) { why.setAttribute('aria-invalid', 'true'); why.focus(); return; }
            if (method !== 'INNER' && (!sup.value || !(num(fee.value) >= 0) || fee.value === '')) return fail(new Error('Dış kesim için tedarikçi ve birim bedel zorunlu.'));
            save.disabled = true;
            try {
                await api.cutPlanSet({ wo: woId, method, inner: i, outer: o, supplier: method === 'INNER' ? null : sup.value, unitFee: method === 'INNER' ? null : num(fee.value), currency: method === 'INNER' ? null : cur.value, freight: frt.value === '' ? null : num(frt.value), docRef: ref.value || null, note: nt.value || null, reason, version: plan.rowVersion ?? null });
                say('ok', 'Kesim planı kaydedildi.'); await loadPlan(wos);
            } catch (e) { save.disabled = false; fail(e); }
        } }, 'Kesim planını kaydet');
        const r = plan.received ?? {};
        const receipts = (plan.receipts ?? []).map((x) => h('div', { class: 'row', 'data-testid': 'cut-receipt', style: 'gap:6px;align-items:center' },
            h('span', {}, `${x.qty} adet · ${x.deliveryRef ?? '—'} · `), h('b', {}, x.qcDecision ?? 'BEKLİYOR'),
            canEdit && !x.qcDecision ? h('span', {}, h('button', { type: 'button', class: 'ghost sm', 'data-testid': 'cut-accept', onClick: () => decide(x.id, 'ACCEPTED', wos) }, 'Kabul'), h('button', { type: 'button', class: 'ghost sm', 'data-testid': 'cut-reject', onClick: () => decide(x.id, 'REJECTED', wos) }, 'Ret')) : null));
        const rcvCri = (globalThis.crypto?.randomUUID?.() ?? `r-${Date.now()}-${Math.random().toString(16).slice(2)}`);   // tekrar gönderilen istek ikinci teslimat yaratmaz (sunucu aynı kimliği tanır)
        const rq = h('input', { type: 'number', min: 0, 'data-testid': 'cut-rcv-qty', placeholder: 'Gelen adet' });
        const rr = h('input', { 'data-testid': 'cut-rcv-ref', placeholder: 'İrsaliye no' });
        const rcvAdd = h('button', { type: 'button', class: 'ghost', 'data-testid': 'cut-rcv-add', onClick: async () => { const q = num(rq.value); if (!(q > 0)) return fail(new Error('Gelen adet sıfırdan büyük olmalı.')); try { await api.cutReceiptAdd(woId, q, rr.value || null, rcvCri); say('ok', 'Teslim alındı; kalite kararı bekliyor.'); await loadPlan(wos); } catch (e) { fail(e); } } }, 'Teslim al');
        const calcBox = calc ? h('div', { class: 'mut', 'data-testid': 'cut-calc' },
            `İç: ${calc.innerQty} adet, Makine 101 ${calc.inner?.machineMinutes ?? '—'} dk · Dış: ${calc.outerQty} adet, makine yükü ${calc.outer?.machineMinutes ?? 0} dk` + (calc.outer?.serviceAmount != null ? ` · Hizmet: ${calc.outer.serviceAmount}` : '') + (calc.missing?.length ? ` · Eksik: ${calc.missing.join(', ')}` : '')) : null;
        const receiptBox = method === 'INNER' || !plan.plan ? null : h('div', { class: 'stack', 'data-testid': 'cut-receipts', style: 'gap:4px' },
            h('b', {}, 'Teslim alma'), h('div', { class: 'mut' }, `Kabul: ${r.accepted ?? 0} · Kalite bekliyor: ${r.pendingQc ?? 0} · Ret: ${r.rejected ?? 0} · Kalan: ${r.remaining ?? 0}`), ...receipts,
            canEdit ? h('div', { class: 'row', style: 'gap:6px' }, rq, rr, rcvAdd) : null);
        sync();
        body.replaceChildren(...[h('label', {}, 'İş emri ', selWo), h('div', { role: 'radiogroup', 'aria-label': 'Kesim yöntemi', class: 'stack', style: 'gap:4px' }, ...radios),
            h('div', { class: 'row', style: 'gap:8px' }, h('label', {}, 'İç adet ', inner), h('label', {}, 'Dış adet ', outer), h('span', { class: 'mut' }, `Toplam: ${total}`)), outerBox,
            h('label', {}, 'Açıklama ', nt), canEdit ? h('div', { class: 'row', style: 'gap:6px' }, why, save) : h('div', { class: 'mut' }, 'Kesim planını değiştirme yetkiniz yok.'),
            noteHost, calcBox, receiptBox].filter(Boolean));
    }
    async function decide(id, d, wos) {
        const reason = d === 'REJECTED' ? 'Kalite reddi' : null;
        try { await api.cutReceiptDecide(id, d, reason); say('ok', d === 'ACCEPTED' ? 'Kabul edildi.' : 'Reddedildi.'); await loadPlan(wos); } catch (e) { fail(e); }
    }
    host.replaceChildren(h('details', { class: 'mut', style: 'margin:4px 0', 'data-testid': 'pw-cut-method', onToggle: (e) => { if (e.target.open && !body.dataset.loaded) { body.dataset.loaded = '1'; void loadWos(); } } },
        h('summary', { style: 'cursor:pointer;font-weight:600' }, 'Kesim yöntemi (CUT/PREP): İÇ KESİM · DIŞ KESİM · KARMA'), body));
    return host;
}
