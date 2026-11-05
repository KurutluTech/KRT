// KMI NEXT — SEVKİYAT BELGELERİ (Muhasebe): sevkiyat → lot dağılımı → fatura + irsaliye (sevk toplam miktarıyla) → ayrı kişi onayı.
// Karar sunucudadır (yetki, SoD, miktar eşleşmesi, kilit, audit); ekran yalnız sonucu gösterir ve sunucu hatasını Türkçe söyler.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { buildShipmentView, candidateLots, DOC_TR, DOC_STATUS_TR } from '../shipmentDocsModel.js';
const CSS = `.sd{max-width:1000px;margin:0 auto;padding:0 16px 40px;color:var(--kmi-text,#e2e8f0)}.sd h1{font-size:22px}.sd h2{font-size:17px;margin:14px 0 6px}
.sd button,.sd select,.sd input{min-height:40px;border-radius:10px;border:1px solid var(--kmi-line,#334155);padding:6px 10px;background:rgba(56,189,248,.10);color:inherit;font:inherit}
.sd-card{border:1px solid rgba(148,163,184,.3);border-radius:14px;padding:12px;margin:10px 0}.sd-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0}.sd-row>*{flex:1 1 150px}
.sd-msg{padding:10px 14px;border-radius:12px;margin:8px 0;font-weight:700;border:1px solid}.sd-msg.ok{color:#4ade80}.sd-msg.error{color:#f87171}
.sd-pill{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid;font-size:13px;font-weight:700}.sd-bad{color:#f87171}.sd-good{color:#4ade80}.sd-warn{color:#fbbf24}.sd-next{opacity:.9}
@media (max-width:520px){.sd select,.sd input{width:100%}}`;
const ST = { DRAFT: 'Taslak', DISPATCHED: 'Sevk edildi', DELIVERED: 'Teslim edildi' };
export async function renderShipmentDocsScreen(container, { api, canPrepare = false, canDecide = false, me = null }, view = {}) {
    const redo = (v) => void renderShipmentDocsScreen(container, { api, canPrepare, canDecide, me }, v);
    let ships, lines, docs, lots, wos, appr;
    try {
        ships = await api.shipments(); const ids = ships.map((s) => s.id);
        [lines, docs, lots] = await Promise.all([api.lines(ids), api.docs(ids), api.lots()]);
        wos = await api.workOrders([...new Set(lots.map((l) => l.workOrderId).filter(Boolean))]);
        appr = await api.approvals([...new Set(lines.map((l) => l.stockLotId))]);
    } catch (e) { mount(container, h('div', { class: 'sd' }, h('div', { 'data-testid': 'sd-load-error', class: 'sd-msg error', role: 'alert' }, errorText(e)))); return; }
    const lotMap = new Map(lots.map((l) => [l.id, l])), itemOfWo = new Map(wos.map((w) => [w.id, w.orderItemId]));
    const itemOfLot = new Map(lots.map((l) => [l.id, itemOfWo.get(l.workOrderId)]));
    const liveLots = new Set(lines.filter((l) => ships.some((s) => s.id === l.shipmentId)).map((l) => l.stockLotId));
    const run = async (fn, ok) => { try { await fn(); redo({ message: { kind: 'ok', text: ok } }); } catch (e) { redo({ message: { kind: 'error', text: `Yapılamadı: ${errorText(e)}` } }); } };
    const msg = view.message ? h('div', { 'data-testid': 'sd-message', class: `sd-msg ${view.message.kind}`, role: view.message.kind === 'error' ? 'alert' : 'status' }, view.message.text) : null;
    // yeni sevkiyat
    const newCands = candidateLots(lots, liveLots, itemOfLot, null);
    const lotSel = h('select', { 'data-testid': 'sd-new-lot', 'aria-label': 'Lot' }, h('option', { value: '' }, 'Sevkiyatı başlatacak lot'), ...newCands.map((l) => h('option', { value: l.id }, `${l.id.slice(0, 8)} · ${l.qty} adet · ${l.state}`)));
    const newBox = canPrepare ? h('div', { class: 'sd-card', 'data-testid': 'sd-new' }, h('h2', {}, 'Yeni sevkiyat taslağı'),
        h('div', { class: 'sd-row' }, lotSel, h('button', { type: 'button', 'data-testid': 'sd-new-go', onClick: () => lotSel.value ? run(() => api.create(lotSel.value), 'Sevkiyat taslağı açıldı.') : redo({ message: { kind: 'error', text: 'Önce lot seçin.' } }) }, 'Taslak aç'))) : null;
    const cards = ships.map((s) => {
        const sl = lines.filter((l) => l.shipmentId === s.id), sd = docs.filter((d) => d.shipmentId === s.id);
        const v = buildShipmentView({ shipment: s, lines: sl, docs: sd, lots: lotMap, approvals: appr });
        const item = itemOfLot.get(s.stockLotId);
        const out = [h('div', { class: 'sd-row' }, h('strong', {}, `Sevkiyat ${s.id.slice(0, 8)}`), h('span', { class: 'sd-pill', 'data-testid': 'sd-status' }, ST[s.status] ?? s.status),
            h('span', { 'data-testid': 'sd-total' }, `Toplam sevk: ${v.total} adet · ${sl.length} lot`))];
        out.push(h('div', { 'data-testid': 'sd-lines' }, ...sl.map((l) => h('div', { class: 'sd-row', 'data-testid': 'sd-line' }, h('span', {}, `Lot ${l.stockLotId.slice(0, 8)}`), h('span', {}, `${l.qty} adet · ${lotMap.get(l.stockLotId)?.state ?? '?'}`),
            (canPrepare && s.status === 'DRAFT' && !v.locked && l.stockLotId !== s.stockLotId) ? h('button', { type: 'button', 'data-testid': 'sd-rm', 'data-lot': l.stockLotId, onClick: () => run(() => api.removeLot(s.id, l.stockLotId), 'Lot sevkiyattan çıkarıldı (belgeler yeniden hazırlanmalı).') }, 'Çıkar') : h('span', {}))))); 
        if (canPrepare && s.status === 'DRAFT' && !v.locked) {
            const cands = candidateLots(lots, liveLots, itemOfLot, item);
            const add = h('select', { 'data-testid': 'sd-add-sel', 'aria-label': 'Lot ekle' }, h('option', { value: '' }, 'Aynı kalemden lot ekle'), ...cands.map((l) => h('option', { value: l.id }, `${l.id.slice(0, 8)} · ${l.qty} adet`)));
            out.push(h('div', { class: 'sd-row' }, add, h('button', { type: 'button', 'data-testid': 'sd-add', onClick: () => add.value ? run(() => api.addLot(s.id, add.value), 'Lot eklendi (belgeler yeniden hazırlanmalı).') : redo({ message: { kind: 'error', text: 'Önce lot seçin.' } }) }, 'Lotu ekle')));
        }
        for (const t of ['INVOICE', 'DELIVERY_NOTE']) {
            const p = v.per[t], d = p.doc;
            const state = p.state === 'MISSING' ? 'Kayıt yok' : `${DOC_STATUS_TR[p.state] ?? p.state}${p.matches ? ` · ${d.qty} adet ✔ eşleşiyor` : ` · ${d.qty} adet ✖ toplam ${v.total}`}`;
            const row = [h('strong', {}, DOC_TR[t]), h('span', { class: p.state === 'APPROVED' && p.matches ? 'sd-good' : (p.state === 'MISSING' || !p.matches ? 'sd-bad' : 'sd-warn'), 'data-testid': `sd-doc-${t}` }, state), h('span', {}, d ? `No: ${d.docNo}` : '')];
            const no = h('input', { type: 'text', placeholder: `${DOC_TR[t]} no`, 'data-testid': `sd-no-${t}`, value: d?.docNo ?? '' });
            if (canPrepare && s.status === 'DRAFT' && !v.locked && sl.length) row.push(no, h('button', { type: 'button', 'data-testid': `sd-save-${t}`, onClick: () => run(() => api.saveDoc(s.id, t, no.value, v.total), `${DOC_TR[t]} ${v.total} adet olarak kaydedildi (onay bekliyor).`) }, d ? 'Güncelle' : 'Kaydet'));
            if (canDecide && d && d.status === 'DRAFT') {
                const mine = me && d.preparedBy === me;
                if (mine) row.push(h('span', { class: 'sd-warn', 'data-testid': `sd-self-${t}` }, 'Hazırlayan onaylayamaz — başka yetkili onaylamalı.'));
                else row.push(h('button', { type: 'button', 'data-testid': `sd-ok-${t}`, onClick: () => run(() => api.decideDoc(d.id, true, 'miktar ve belge kontrol edildi'), `${DOC_TR[t]} onaylandı.`) }, 'Onayla'),
                    h('button', { type: 'button', 'data-testid': `sd-no-btn-${t}`, onClick: () => run(() => api.decideDoc(d.id, false, 'belge/miktar hatalı'), `${DOC_TR[t]} reddedildi.`) }, 'Reddet'));
            }
            out.push(h('div', { class: 'sd-row' }, ...row));
        }
        out.push(h('div', { class: v.ready ? 'sd-good' : 'sd-bad', 'data-testid': 'sd-verdict' }, v.ready ? 'Belgeler tam ve miktar eşleşiyor.' : `Eksik: ${v.blockers.join(' ')}`));
        out.push(h('div', { class: 'sd-next', 'data-testid': 'sd-next' }, `Sıradaki: ${v.next.who} — ${v.next.action}`));
        return h('div', { class: 'sd-card', 'data-testid': 'sd-card', 'data-id': s.id }, ...out);
    });
    mount(container, h('div', { class: 'sd' }, h('style', {}, CSS), h('h1', {}, 'Sevkiyat belgeleri (fatura / irsaliye)'),
        h('p', {}, 'Bir sevkiyat birden çok lotu kapsayabilir; tek fatura ve tek irsaliye sevkiyatın TOPLAM miktarıyla eşleşmelidir. Belgeyi hazırlayan onaylayamaz. Fiziksel çıkışı depo ayrıca beyan eder.'),
        msg, newBox, ...(cards.length ? cards : [h('div', { class: 'sd-card', 'data-testid': 'sd-empty' }, 'Henüz sevkiyat yok.')])));
}
