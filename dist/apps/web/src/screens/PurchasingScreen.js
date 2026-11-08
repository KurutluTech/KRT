// KMI NEXT — Purchasing/Warehouse screen (owner talimatı 2026-10-10, Öncelik 2). Same h()/JSX/
// full-re-render pattern as every other screen. Shows PO lines with a goods-receipt input, and
// submit/approve controls — the goods receipt call is the real RPC that also creates the
// warehouse stock lot server-side (see maintenanceApi-style thin adapter, purchasingApi.ts).
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
const PO_TR = { DRAFT: ['Taslak', ''], SUBMITTED: ['Onay bekliyor', 'warn'], APPROVED: ['Onaylandı', 'info'], SENT: ['Tedarikçiye gönderildi', 'info'], PARTIALLY_RECEIVED: ['Kısmen teslim alındı', 'warn'], RECEIVED: ['Teslim alındı', 'ok'], CLOSED: ['Kapandı', 'ok'], CANCELLED: ['İptal', 'bad'] };
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderPurchasingScreen(container, deps, banner) {
    let orders = [];
    let lines = [];
    let loadError = null;
    try {
        [orders, lines] = await Promise.all([deps.api.listPurchaseOrders(), deps.api.listLines()]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    let custList = null;
    let matList = [];
    let woList = [];
    if (deps.api.receiveCustomerMaterial && deps.api.customers) {
        try {
            custList = await deps.api.customers();
            matList = deps.api.materialCodes ? await deps.api.materialCodes().catch(() => []) : [];
            woList = deps.api.openWorkOrders ? await deps.api.openWorkOrders().catch(() => []) : [];
        }
        catch { custList = null; }
    }
    const receiveInputs = new Map();
    function receiveInputFor(lineId) {
        let input = receiveInputs.get(lineId);
        if (!input) {
            input = h('input', { type: 'number', 'data-testid': 'receive-qty-input', 'data-line-id': lineId });
            receiveInputs.set(lineId, input);
        }
        return input;
    }
    async function handleSubmit(poId) {
        try {
            await deps.api.transition(poId, 'SUBMITTED');
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Sipariş onaya gönderildi.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleApprove(poId) {
        try {
            await deps.api.approve(poId);
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Satınalma siparişi onaylandı.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleSend(poId) {
        try {
            await deps.api.transition(poId, 'SENT');
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Sipariş tedarikçiye gönderildi.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleReceive(lineId) {
        const qty = Number(receiveInputFor(lineId).value);
        try {
            await deps.api.recordGoodsReceipt(lineId, qty);
            await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Mal kabul kaydedildi, depo lotu HOLD olarak açıldı.' });
        }
        catch (err) {
            await renderPurchasingScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    function customerMaterialBox() {
        if (!custList) return null;
        const mk = (tid, ph, rows) => h('select', { 'data-testid': tid }, h('option', { value: '' }, ph), ...rows.map((r) => h('option', { value: r.value }, r.label)));
        const cust = mk('cm-customer', '— 1) müşteri seçin —', custList.map((c) => ({ value: c.id, label: c.name })));
        const wo = mk('cm-wo', '— 2) iş emri / sipariş seçin —', []);
        const mat = mk('cm-material', '— 3) malzeme —', matList.map((m) => ({ value: m, label: m })));
        const bars = h('input', { type: 'number', min: '1', step: '1', placeholder: 'Çubuk adedi', 'data-testid': 'cm-bars' });
        const ref = h('input', { type: 'text', placeholder: 'Müşteri irsaliye / teslim no', 'data-testid': 'cm-ref' });
        const msg = h('div', { class: 'mut', 'data-testid': 'cm-msg' });
        const setMats = (codes, pick) => { mat.replaceChildren(h('option', { value: '' }, '— malzeme seçin —'), ...codes.map((m) => h('option', { value: m }, m))); if (pick) mat.value = pick; };
        cust.addEventListener('change', () => {
            msg.textContent = '';
            const mine = woList.filter((w) => w.customerId === cust.value);
            wo.replaceChildren(h('option', { value: '' }, mine.length ? '— 2) iş emri / sipariş seçin —' : '— bu müşterinin açık iş emri yok —'), ...mine.map((w) => h('option', { value: w.id }, w.label)));
            setMats(matList, null); bars.value = '';
            if (mine.length === 1) { wo.value = mine[0].id; wo.dispatchEvent(new Event('change')); }
        });
        wo.addEventListener('change', async () => {
            msg.textContent = '';
            const w = woList.find((x) => x.id === wo.value);
            if (!w) return;
            try {
                const ms = await deps.api.woMaterials(w.id);
                const need = ms.filter((m) => m.shortage > 0);
                setMats(ms.map((m) => m.materialCode), (need[0] ?? ms[0])?.materialCode);
                if (need[0]) bars.value = String(Math.ceil(need[0].shortage));
                msg.textContent = need[0] ? `Eksik malzeme: ${need.map((m) => `${m.materialCode} ${Math.ceil(m.shortage)} çubuk`).join(', ')} (adet düzenlenebilir)` : 'Bu iş emrinin malzemesi karşılanmış görünüyor.';
            }
            catch (err) { msg.textContent = errorText(err); }
        });
        mat.addEventListener('change', async () => {
            const w = woList.find((x) => x.id === wo.value);
            if (!w || !mat.value) return;
            try { const m = (await deps.api.woMaterials(w.id)).find((x) => x.materialCode === mat.value); if (m && m.shortage > 0) bars.value = String(Math.ceil(m.shortage)); } catch { /* elle girilebilir */ }
        });
        const btn = h('button', { type: 'button', class: 'okb', 'data-testid': 'cm-save', onClick: async () => {
            const n = Number(bars.value);
            if (!cust.value) { msg.textContent = 'Müşteriyi seçin.'; return; }
            if (!mat.value) { msg.textContent = 'Malzemeyi seçin.'; return; }
            if (!Number.isInteger(n) || n <= 0) { msg.textContent = 'Çubuk adedi tam sayı olmalı.'; return; }
            if (ref.value.trim().length < 3) { msg.textContent = 'Müşteri irsaliye / teslim numarasını yazın.'; return; }
            try {
                await deps.api.receiveCustomerMaterial(cust.value, mat.value, n, ref.value.trim());
                await renderPurchasingScreen(container, deps, { kind: 'info', text: 'Müşteri malzemesi kabul edildi; lot HOLD. Sıradaki adım: Kalite → Giriş kalite kontrolü (sahiplik: Müşteri).' });
            }
            catch (err) { msg.textContent = errorText(err); }
        } }, 'Müşteri malzemesini kabul et');
        return h('div', { class: 'panel', 'data-testid': 'cm-box' }, h('h2', null, 'Müşteri malzemesi kabul (siparişsiz)'), h('div', { class: 'mut' }, 'Önce müşteriyi, sonra iş emrini seçin: malzeme ve eksik çubuk adedi otomatik gelir. Fiyatsız kayıt olur; kabulden sonra lot HOLD kalır, giriş kalite kontrolü gerekir.'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' }, cust, wo, mat, bars, ref, btn), msg);
    }
    const screen = (h("div", { class: "purchasing-screen kd" },
        h("style", null, DS_CSS + '.kd table{border-collapse:collapse;width:100%;font-size:14px}.kd td{padding:8px;border-top:1px solid #1e293b;vertical-align:middle}.kd td:last-child{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'),
        h("h1", { "data-testid": "purchasing-heading" }, "Sat\u0131nalma / Depo"),
        banner ? (h("div", { class: `banner ${banner.kind}`, "data-testid": "purchasing-banner", "data-kind": banner.kind }, banner.text)) : null,
        customerMaterialBox(),
        loadError ? (h("div", { class: "banner error", "data-testid": "purchasing-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "panel" },
                h("h2", null, "Sat\u0131nalma sipari\u015Fleri"),
                h("div", { style: "overflow-x:auto;max-width:100%" },
                    h("table", { "data-testid": "purchase-orders-table" },
                        h("tbody", { "data-testid": "purchase-orders-tbody" }, orders.map((po) => (h("tr", { "data-testid": "po-row", "data-po-id": po.id },
                            h("td", null,
                                h("span", { class: `pill ${(PO_TR[po.status] ?? ['', ''])[1]}`, "data-testid": "po-status", "data-code": po.status }, (PO_TR[po.status] ?? [po.status])[0])),
                            h("td", null,
                                po.status === 'DRAFT'
                                    ? h('button', { type: 'button', class: 'primary', 'data-testid': 'submit-po-btn', 'data-po-id': po.id, onClick: () => handleSubmit(po.id) }, 'Onaya Gönder')
                                    : null,
                                po.status === 'SUBMITTED'
                                    ? h('button', { type: 'button', class: 'okb', 'data-testid': 'approve-po-btn', 'data-po-id': po.id, onClick: () => handleApprove(po.id) }, 'Onayla')
                                    : null,
                                po.status === 'APPROVED'
                                    ? h('button', { type: 'button', class: 'primary', 'data-testid': 'send-po-btn', 'data-po-id': po.id, onClick: () => handleSend(po.id) }, 'Tedarikçiye Gönder')
                                    : null))))))),
                orders.length === 0 ? h("div", { class: "empty", "data-testid": "po-empty" }, "Hen\u00FCz sat\u0131nalma sipari\u015Fi yok.") : null),
            h("div", { class: "panel" },
                h("h2", null, "Sipari\u015F kalemleri / mal kabul"),
                h("div", { style: "overflow-x:auto;max-width:100%" },
                    h("table", { "data-testid": "po-lines-table" },
                        h("tbody", { "data-testid": "po-lines-tbody" }, lines.map((line) => (h("tr", { "data-testid": "po-line-row", "data-line-id": line.id },
                            h("td", { "data-testid": "line-material" }, line.materialCode),
                            h("td", { "data-testid": "line-qty-ordered" }, String(line.qtyOrdered)),
                            h("td", { "data-testid": "line-qty-received" }, String(line.qtyReceived)),
                            h("td", null, receiveInputFor(line.id)),
                            h("td", null, h('button', { type: 'button', class: 'okb', 'data-testid': 'receive-btn', 'data-line-id': line.id, onClick: () => handleReceive(line.id) }, 'Mal Kabul Et')))))))),
                lines.length === 0 ? h("div", { class: "empty", "data-testid": "po-lines-empty" }, "Mal kabul edilecek kalem yok.") : null)))));
    mount(container, screen);
}
