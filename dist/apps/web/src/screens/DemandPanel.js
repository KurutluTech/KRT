// Planning: "what do the open orders still need?" — order items not (fully) covered by work orders, most urgent first, with the canonical action to open the
// work order (ORDER → WORK ORDER, same RPC as the Orders screen). After creation the planning board below re-reads (it then offers machine / shift / operator).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildDemand } from '../../../../packages/domain/src/productionDemand.js';
import { errorText } from '../errorText.js';
const CSS = `.dm{border:1px solid #1a2a46;border-radius:12px;padding:12px 14px;background:rgba(11,22,42,.6);margin-bottom:14px}.dm h2{margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8da0bd}
.dm .r{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid #1a2a46;padding:8px 0}.dm .r:first-of-type{border-top:0}.dm .r .t{flex:1 1 220px;min-width:0;overflow-wrap:anywhere}.dm .r .late{color:#f0645a;font-weight:700}
.dm input{min-height:44px;width:90px;padding:6px 10px;border-radius:10px;border:1px solid #26385a;background:#0b162a;color:inherit;font:inherit}.dm button{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #2f7d5e;background:#123a2c;color:#e9eef7;font:inherit;font-weight:600;cursor:pointer}.dm button:disabled{opacity:.45;cursor:not-allowed}
.dm .mu{color:#8da0bd;font-size:12.5px}.dm .banner{padding:8px 12px;border-radius:10px;margin-bottom:8px;font-size:14px}.dm .banner.ok{background:#123a2c}.dm .banner.error{background:#3a1614}`;
export async function renderDemandPanel(host, orders, hub, todayIso, onChanged, banner = null) {
    mount(host, h('section', { class: 'dm', 'data-testid': 'demand-panel' }, h('style', {}, CSS), h('h2', {}, 'Üretim ihtiyacı — iş emri bekleyen sipariş kalemleri'), h('div', { class: 'mu' }, 'Okunuyor…')));
    let rows = null;
    try {
        const [os, items, wos, prods] = await Promise.all([orders.list(), orders.items(), hub.list(), orders.products()]);
        const code = new Map(prods.map((p) => [p.id, p.code]));
        rows = buildDemand(os, items, wos, (id) => code.get(id) ?? id.slice(0, 8), todayIso);
    }
    catch {
        rows = null;
    }
    const body = rows === null ? h('div', { class: 'mu', 'data-testid': 'demand-unknown' }, 'Sipariş verisi okunamadı (VERİ YOK) — ihtiyaç hesaplanamadı. Bu, ihtiyaç olmadığı anlamına gelmez.')
        : rows.length === 0 ? h('div', { class: 'mu', 'data-testid': 'demand-empty' }, 'Onaylı siparişlerde iş emri bekleyen kalem yok.')
            : h('div', { 'data-testid': 'demand-rows' }, ...rows.slice(0, 40).map((r) => {
                const qty = h('input', { type: 'number', min: '1', step: 'any', value: String(r.remaining), 'aria-label': 'Adet', 'data-testid': 'demand-qty' });
                return h('div', { class: 'r', 'data-testid': 'demand-row', 'data-item': r.itemId }, h('div', { class: 't' }, h('b', {}, r.product), ` · ${r.customerPo} · ${r.remaining} adet eksik (${r.covered}/${r.qty} iş emrinde)`, h('div', { class: r.late ? 'late' : 'mu' }, `termin ${r.dueDate}${r.daysToDue === null ? '' : r.late ? ` — ${-r.daysToDue} gün gecikti` : ` — ${r.daysToDue} gün kaldı`}`)), qty, h('button', { type: 'button', disabled: !r.canCreate, title: r.why ?? '', 'data-testid': 'demand-create', onClick: async () => {
                        const n = Number(qty.value);
                        if (!(n > 0)) {
                            void renderDemandPanel(host, orders, hub, todayIso, onChanged, { kind: 'error', text: 'Adet 0\'dan büyük olmalı.' });
                            return;
                        }
                        try {
                            await orders.createWorkOrder(r.itemId, n);
                            onChanged();
                        }
                        catch (e) {
                            void renderDemandPanel(host, orders, hub, todayIso, onChanged, { kind: 'error', text: errorText(e) });
                        }
                    } }, 'İş emri aç'));
            }));
    mount(host, h('section', { class: 'dm', 'data-testid': 'demand-panel' }, h('style', {}, CSS), h('h2', {}, 'Üretim ihtiyacı — iş emri bekleyen sipariş kalemleri'), banner ? h('div', { class: `banner ${banner.kind}`, role: banner.kind === 'error' ? 'alert' : 'status', 'data-testid': 'demand-banner' }, banner.text) : null, body));
}
