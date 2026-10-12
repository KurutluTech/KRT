// KMI — department work queues (Kalite / Metroloji, Sevkiyat / Lojistik, Depo / Stok). Real records only: every row is a real
// work order or stock lot from the canonical tables; nothing is inferred. An empty queue says "kayıt yok" (it does not claim
// "all fine"). Acting on a record happens in İş emri merkezi, where the server authorises each step.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { WO_STATUS_TR } from './WorkOrderHubScreen.js';
import { errorText } from '../errorText.js';
export const LOT_STATE_TR = { WIP: 'Üretimde (WIP)', FG: 'Mamul (FG)', AVAILABLE: 'Kullanılabilir', RESERVED: 'Rezerve', STAGED: 'Sevkiyata hazır', SHIPPED: 'Sevk edildi', HOLD: 'HOLD', SCRAP: 'Hurda' };
const TITLE = {
    KALITE: { h: 'Kalite Kontrol / Metroloji', sub: 'İlk parça onayı bekleyen, HOLD’daki ve hurdalı iş emirleri.' },
    SEVKIYAT: { h: 'Sevkiyat / Lojistik', sub: 'Sevkiyat için hazır ve sevk edilmiş stok lotları.' },
    DEPO: { h: 'Depo / Stok / Malzeme', sub: 'Stok lotlarının durumu ve mal kabul / satınalma bağlantıları.' },
};
const CSS = `.dept{display:flex;flex-direction:column;gap:14px}.dept h1{font-size:20px;margin:0}.dept h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:0 0 8px}
.dept .panel{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;min-width:0}
.dept .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid #1e293b;padding:8px 0}.dept .row:first-of-type{border-top:0}
.dept .row a{color:#67e8f9;font-weight:600}.dept .pill{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:#1e293b;color:#e6edf7}
.dept .pill.warn{background:#78350f;color:#fde68a}.dept .pill.bad{background:#7f1d1d;color:#fecaca}.dept .pill.ok{background:#14532d;color:#bbf7d0}
.dept .empty{color:#94a3b8;font-size:13px}.dept .big{font-size:26px;font-weight:800}.dept .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.dept .stat{border:1px solid #1e293b;border-radius:10px;padding:8px;background:rgba(2,6,23,.4)}.dept .stat .l{font-size:11px;color:#94a3b8}`;
export async function renderDepartmentScreen(container, api, kind) {
    let wos = [];
    let lots = [];
    let err = null;
    try {
        [wos, lots] = await Promise.all([api.workOrders(), api.stockLots()]);
    }
    catch (e) {
        err = errorText(e);
    }
    const woById = new Map(wos.map((w) => [w.id, w]));
    const wLabel = (w) => `${w.productCode} · ${w.customerPo}`;
    const woRow = (w, pill) => h('div', { class: 'row', 'data-testid': 'dept-row', 'data-id': w.id }, h('a', { href: `#/is-emirleri?wo=${w.id}` }, wLabel(w)), h('span', {}, `${w.qtyProduced}/${w.qtyPlanned} adet`), w.qtyScrap > 0 ? h('span', { class: 'pill bad' }, `hurda ${w.qtyScrap}`) : null, h('span', { class: `pill ${pill[1]}` }, pill[0]), w.dueDate ? h('span', { class: 'mut' }, `termin ${w.dueDate}`) : null);
    const lotRow = (l) => {
        const w = woById.get(l.workOrderId);
        return h('div', { class: 'row', 'data-testid': 'dept-row', 'data-id': l.id }, h('a', { href: `#/is-emirleri?lot=${l.id}` }, w ? wLabel(w) : `Lot ${l.id.slice(0, 8)}`), h('span', {}, `${l.qty} adet`), h('span', { class: `pill ${l.state === 'HOLD' || l.state === 'SCRAP' ? 'bad' : l.state === 'STAGED' || l.state === 'AVAILABLE' ? 'ok' : ''}` }, LOT_STATE_TR[l.state] ?? l.state));
    };
    const section = (title, rows, empty, testid) => h('section', { class: 'panel', 'data-testid': testid }, h('h2', {}, `${title} (${rows.length})`), rows.length ? h('div', {}, ...rows) : h('div', { class: 'empty' }, empty));
    let body = [];
    if (err)
        body = [h('div', { class: 'panel', 'data-testid': 'dept-load-error' }, `Yüklenemedi: ${err}`)];
    else if (kind === 'KALITE') {
        const open = wos.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED');
        body = [
            section('İlk parça onayı bekleyen', wos.filter((w) => w.status === 'FIRST_PIECE_PENDING').map((w) => woRow(w, ['İlk parça bekliyor', 'warn'])), 'Kayıt yok.', 'dept-fp'),
            section('Bekletmede (HOLD)', wos.filter((w) => w.status === 'ON_HOLD').map((w) => woRow(w, ['HOLD', 'bad'])), 'Kayıt yok.', 'dept-hold'),
            section('Hurda kaydı olan açık iş emirleri', open.filter((w) => w.qtyScrap > 0).map((w) => woRow(w, [WO_STATUS_TR[w.status], 'warn'])), 'Kayıt yok.', 'dept-scrap'),
            section('HOLD’daki stok lotları', lots.filter((l) => l.state === 'HOLD').map(lotRow), 'Kayıt yok.', 'dept-lot-hold'),
        ];
    }
    else if (kind === 'SEVKIYAT') {
        body = [
            section('Sevkiyata hazır', lots.filter((l) => l.state === 'STAGED' || l.state === 'AVAILABLE' || l.state === 'FG' || l.state === 'RESERVED').map(lotRow), 'Kayıt yok.', 'dept-ready'),
            section('Sevk edilmiş', lots.filter((l) => l.state === 'SHIPPED').slice(0, 30).map(lotRow), 'Kayıt yok.', 'dept-shipped'),
        ];
    }
    else {
        const count = (s) => lots.filter((l) => l.state === s).length;
        body = [
            h('section', { class: 'panel', 'data-testid': 'dept-stock-counts' }, h('h2', {}, 'Stok lotu durumları'), h('div', { class: 'grid' }, ...Object.keys(LOT_STATE_TR).map((s) => h('div', { class: 'stat', 'data-state': s }, h('div', { class: 'big' }, String(count(s))), h('div', { class: 'l' }, LOT_STATE_TR[s]))))),
            section('HOLD / hurda lotları', lots.filter((l) => l.state === 'HOLD' || l.state === 'SCRAP').map(lotRow), 'Kayıt yok.', 'dept-lot-problem'),
            section('Üretimde (WIP) ve mamul lotlar', lots.filter((l) => l.state === 'WIP' || l.state === 'FG').map(lotRow), 'Kayıt yok.', 'dept-lot-flow'),
            h('section', { class: 'panel' }, h('h2', {}, 'Bağlantılar'), h('div', { class: 'row' }, h('a', { href: '#/satinalma' }, 'Satınalma / Mal Kabul'), h('a', { href: '#/talepler' }, 'Satınalma talepleri'))),
        ];
    }
    mount(container, h('div', { class: 'dept', 'data-testid': 'dept-root', 'data-kind': kind }, h('style', {}, CSS), h('div', {}, h('h1', { 'data-testid': 'dept-heading' }, TITLE[kind].h), h('div', { class: 'mut', style: 'color:#94a3b8;font-size:12px' }, TITLE[kind].sub)), ...body));
}
