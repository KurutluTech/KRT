// KMI NEXT — SEVKİYAT İADESİ / SEVK GERİ ALMA. Talep (Sevkiyat) → fiziksel kabul (Depo, karantina lotu) → kalite kararı (stoğa / yeniden işleme / hurda) → dekont (Muhasebe).
// "Bilgi kişiyi bulur": her satırda sıradaki adım ve sorumlu rol yazar. Yetki, SoD, miktar ve audit kuralları sunucudadır; ekran yalnızca sonucu gösterir.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `.sr{max-width:980px;margin:0 auto;padding:0 16px 40px;color:var(--kmi-text,#e2e8f0)}.sr h1{font-size:22px}.sr h2{font-size:17px;margin:18px 0 6px}
.sr button,.sr select,.sr input,.sr textarea{min-height:40px;border-radius:10px;border:1px solid var(--kmi-line,#334155);padding:6px 10px;background:rgba(56,189,248,.10);color:inherit;font:inherit}.sr button{font-weight:700}
.sr-card{border:1px solid rgba(148,163,184,.3);border-radius:14px;padding:12px;margin:10px 0}.sr-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0}.sr-row>*{flex:1 1 160px}
.sr-msg{padding:10px 14px;border-radius:12px;margin:8px 0;font-weight:700;border:1px solid}.sr-msg.ok{color:#4ade80}.sr-msg.error{color:#f87171}.sr-pill{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid;font-size:13px;font-weight:700}
.sr-next{opacity:.85;font-size:14px}@media (max-width:520px){.sr select,.sr input,.sr textarea{width:100%}}`;
const ST = { REQUESTED: 'Talep edildi', RECEIVED: 'Fiziksel kabul edildi (karantina)', REWORK: 'Yeniden işlemede', CLOSED: 'Kapandı', REJECTED: 'Reddedildi' };
const KIND = { RETURN: 'Müşteri iadesi', DISPATCH_CANCEL: 'Sevk geri alma (tamamı)' };
const REASON = { DEFECT: 'Hatalı ürün', WRONG_QTY: 'Yanlış miktar', WRONG_PART: 'Yanlış parça', DAMAGED_IN_TRANSIT: 'Nakliyede hasar', CUSTOMER_CANCEL: 'Müşteri vazgeçti', SHIPPED_IN_ERROR: 'Yanlışlıkla sevk edildi' };
const DISP = { RESTOCK: 'Yeniden stoğa al', REWORK: 'Yeniden işlemeye gönder', SCRAP: 'Hurda' };
const LOT = { HOLD: 'karantina', AVAILABLE: 'kullanılabilir stok', SCRAP: 'hurda' };
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
export async function renderShipmentReturnScreen(container, { api }, view = {}) {
    const redo = (v) => void renderShipmentReturnScreen(container, { api }, v);
    let rows = [], ships = [], lots = [];
    try { rows = await api.overview(); ships = await api.shipments(); lots = await api.lots(ships.map((s) => s.stockLotId)); }
    catch (e) { mount(container, h('div', { class: 'sr' }, h('div', { 'data-testid': 'sr-load-error', class: 'sr-msg error', role: 'alert' }, errorText(e)))); return; }
    const lotQty = new Map(lots.map((l) => [l.id, l.qty]));
    const msg = view.message ? h('div', { 'data-testid': 'sr-message', class: `sr-msg ${view.message.kind}`, role: view.message.kind === 'error' ? 'alert' : 'status' }, view.message.text) : null;
    const run = async (fn, okText) => { try { await fn(); redo({ message: { kind: 'ok', text: okText } }); } catch (e) { redo({ message: { kind: 'error', text: `Yapılamadı: ${errorText(e)}` } }); } };
    // --- yeni talep ---
    const shipSel = h('select', { 'data-testid': 'sr-ship', 'aria-label': 'Sevkiyat' }, h('option', { value: '' }, 'Sevkiyat seçin'),
        ...ships.map((s) => h('option', { value: s.id }, `${s.deliveryNoteNo ?? s.id.slice(0, 8)} · ${s.status === 'DELIVERED' ? 'teslim edildi' : 'yolda'} · ${lotQty.get(s.stockLotId) ?? '?'} adet`)));
    const qty = h('input', { type: 'number', min: '0', step: 'any', 'data-testid': 'sr-qty', 'aria-label': 'İade adedi', placeholder: 'İade adedi' });
    const kind = h('select', { 'data-testid': 'sr-kind', 'aria-label': 'Tür' }, ...Object.entries(KIND).map(([k, t]) => h('option', { value: k }, t)));
    const reason = h('select', { 'data-testid': 'sr-reason', 'aria-label': 'Neden' }, ...Object.entries(REASON).map(([k, t]) => h('option', { value: k }, t)));
    const reopenYes = h('input', { type: 'radio', name: 'sr-reopen', value: 'yes', 'data-testid': 'sr-reopen-yes' });
    const reopenNo = h('input', { type: 'radio', name: 'sr-reopen', value: 'no', 'data-testid': 'sr-reopen-no' });
    const note = h('textarea', { 'data-testid': 'sr-note', rows: '2', maxlength: '500', placeholder: 'Not (isteğe bağlı)' });
    const clientRequestId = view.requestId ?? uid();
    const submit = h('button', { type: 'button', 'data-testid': 'sr-submit', onClick: () => {
        if (!shipSel.value) return redo({ requestId: clientRequestId, message: { kind: 'error', text: 'Önce sevkiyatı seçin.' } });
        if (!reopenYes.checked && !reopenNo.checked) return redo({ requestId: clientRequestId, message: { kind: 'error', text: 'Teslim yükümlülüğünün yeniden açılıp açılmayacağını seçin (ticari karar).' } });
        void run(() => api.request({ shipmentId: shipSel.value, qty: Number(qty.value), kind: kind.value, reasonCode: reason.value, reopen: reopenYes.checked, clientRequestId, note: note.value || null }), 'İade talebi kaydedildi. Sıradaki adım: Depo fiziksel kabul.'); } }, 'İade talebini kaydet');
    const form = h('div', { class: 'sr-card', 'data-testid': 'sr-form' }, h('h2', {}, 'Yeni iade / sevk geri alma talebi'),
        h('div', { class: 'sr-row' }, shipSel, qty), h('div', { class: 'sr-row' }, kind, reason),
        h('fieldset', { class: 'sr-row' }, h('legend', {}, 'Teslim yükümlülüğü yeniden açılsın mı? (müşteri yerine yenisini bekliyorsa Evet)'),
            h('label', {}, reopenYes, ' Evet, açılsın'), h('label', {}, reopenNo, ' Hayır, açılmasın')), note, submit);
    // --- liste ---
    const card = (r) => {
        const out = [h('div', { class: 'sr-row' }, h('strong', {}, `${r.deliveryNoteNo ?? r.shipmentId.slice(0, 8)} — ${KIND[r.kind] ?? r.kind}`),
            h('span', { class: 'sr-pill', 'data-testid': 'sr-status' }, ST[r.status] ?? r.status), h('span', {}, `${r.qty} / ${r.shippedQty} adet · ${REASON[r.reasonCode] ?? r.reasonCode}`)),
            h('div', { class: 'sr-next' }, `Yükümlülük: ${r.reopenObligation ? 'yeniden açılır' : 'açılmaz'}` + (r.returnLotState ? ` · İade lotu: ${LOT[r.returnLotState] ?? r.returnLotState}` : '') + (r.returnNoteNo ? ` · İade irsaliyesi: ${r.returnNoteNo}` : ''))];
        if (r.nextStep) out.push(h('div', { class: 'sr-next', 'data-testid': 'sr-next' }, `Sıradaki: ${r.nextStep.who} — ${r.nextStep.action}`));
        const field = (ph, tid) => h('input', { type: 'text', placeholder: ph, 'data-testid': tid, 'data-id': r.id });
        if (r.status === 'REQUESTED') { const no = field('İade irsaliye no', 'sr-noteno');
            out.push(h('div', { class: 'sr-row' }, no, h('button', { type: 'button', 'data-testid': 'sr-receive', 'data-id': r.id, onClick: () => run(() => api.receive(r.id, no.value), 'Fiziksel kabul yapıldı; iade lotu karantinada.') }, 'Fiziksel kabul et'),
                h('button', { type: 'button', 'data-testid': 'sr-reject', 'data-id': r.id, onClick: () => run(() => api.reject(r.id, 'talep reddedildi'), 'Talep reddedildi.') }, 'Talebi reddet'))); }
        if (r.status === 'RECEIVED') { const d = h('select', { 'data-testid': 'sr-disp', 'data-id': r.id }, ...Object.entries(DISP).map(([k, t]) => h('option', { value: k }, t))); const why = field('Gerekçe (hurdada zorunlu)', 'sr-why');
            out.push(h('div', { class: 'sr-row' }, d, why, h('button', { type: 'button', 'data-testid': 'sr-decide', 'data-id': r.id, onClick: () => run(() => api.decide(r.id, d.value, why.value), 'Kalite kararı kaydedildi.') }, 'Kararı kaydet'))); }
        if (r.status === 'REWORK') { const o = h('select', { 'data-testid': 'sr-outcome', 'data-id': r.id }, h('option', { value: 'RESTOCK' }, 'Yeniden stoğa al'), h('option', { value: 'SCRAP' }, 'Hurda')); const why = field('Gerekçe', 'sr-why2');
            out.push(h('div', { class: 'sr-row' }, o, why, h('button', { type: 'button', 'data-testid': 'sr-finish', 'data-id': r.id, onClick: () => run(() => api.finishRework(r.id, o.value, why.value), 'Yeniden işleme sonucu kaydedildi.') }, 'Sonucu kaydet'))); }
        if (r.adjustment) { const a = r.adjustment;
            out.push(h('div', { class: 'sr-row', 'data-testid': 'sr-adj' }, h('span', {}, `Alacak dekontu: ${a.amount} ${a.currency} · ${a.status === 'PENDING' ? 'muhasebe onayı bekliyor' : a.status === 'APPROVED' ? 'onaylandı' : 'reddedildi'}`),
                ...(a.status === 'PENDING' ? [h('button', { type: 'button', 'data-testid': 'sr-adj-ok', 'data-id': a.id, onClick: () => run(() => api.decideAdjustment(a.id, true, 'müşteri iadesi'), 'Dekont onaylandı.') }, 'Dekontu onayla'),
                    h('button', { type: 'button', 'data-testid': 'sr-adj-no', 'data-id': a.id, onClick: () => run(() => api.decideAdjustment(a.id, false, 'reddedildi'), 'Dekont reddedildi.') }, 'Reddet')] : []))); }
        return h('div', { class: 'sr-card', 'data-testid': 'sr-card', 'data-id': r.id }, ...out);
    };
    mount(container, h('div', { class: 'sr' }, h('style', {}, CSS), h('h1', { 'data-testid': 'sr-heading' }, 'Sevkiyat İadesi / Sevk Geri Alma'), msg, form,
        h('h2', {}, 'İade kayıtları'), ...(rows.length ? rows.map(card) : [h('p', { 'data-testid': 'sr-empty' }, 'Henüz iade kaydı yok.')]),
        h('p', { class: 'sr-next' }, 'İade, doğrudan kullanılabilir stok yaratmaz: önce karantina lotu açılır, kalite karar verir. Sevkiyat ve fatura kayıtları silinmez; düzeltmeler ek kayıt olarak tutulur.')));
}
