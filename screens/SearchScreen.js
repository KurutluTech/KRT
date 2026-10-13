// KMI NEXT — Arama. Düz, yapay zekâsız arama: sonuçlar rolünüze göre SUNUCUDA süzülür; her sonuç kaydın kendi ekranına gider.
// (“KMI Zekâ — sor” ayrı bir özelliktir; arama ona bağlı değildir.)
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { SEARCH_TYPE_TO_KIND, passportHref } from '../passport/registry.js';
export const TYPE_TR = { PRODUCT: 'Ürünler', WORK_ORDER: 'İş emirleri', MACHINE: 'Makineler', ORDER: 'Siparişler', CUSTOMER: 'Müşteriler', SHIPMENT: 'Sevkiyatlar',
    SUPPLIER: 'Tedarikçiler', MATERIAL: 'Malzeme kodları', QUALITY_NCR: 'Uygunsuzluklar (NCR)', TASK: 'Görevler' };
export async function renderSearchScreen(container, api, query) {
    const q = query.trim();
    let hits = [];
    let err = null;
    let note;
    if (q.length >= 2) {
        try {
            const r = await api.search(q);
            hits = r.results;
            note = r.note;
        }
        catch (e) {
            err = errorText(e);
        }
    }
    const types = [...new Set(hits.map((x) => x.type))];
    mount(container, h('div', { class: 'search-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'search-heading' }, q ? `Arama: ${q}` : 'Arama'), q.length < 2 || note === 'MIN_2_CHARS' ? h('div', { 'data-testid': 'search-hint', style: 'color:#64748b' }, 'En az 2 karakter yazın (ürün kodu, iş emri, makine, PO, müşteri, görev…). Yalnız rolünüzün görebildiği kayıtlar listelenir.') : null, err ? h('div', { 'data-testid': 'search-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, err) : null, q.length >= 2 && !err && !hits.length && note !== 'MIN_2_CHARS' ? h('div', { 'data-testid': 'search-empty', style: 'color:#64748b' }, 'Sonuç yok (veya bu kayıtları görme yetkiniz yok).') : null, ...types.map((t) => h('section', { 'data-testid': 'search-group', 'data-type': t }, h('h2', { style: 'font-size:15px;margin:12px 0 4px' }, TYPE_TR[t] ?? t), ...hits.filter((x) => x.type === t).map((x) => {
        const kind = SEARCH_TYPE_TO_KIND[x.type];
        return h('div', { style: 'display:flex;gap:6px;align-items:stretch;flex-wrap:wrap' }, h('a', { href: `#${x.route}`, 'data-testid': 'search-hit', style: 'flex:1;min-width:200px;display:block;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin:4px 0;text-decoration:none;color:inherit;min-height:44px;overflow-wrap:anywhere' }, h('b', {}, x.title), h('div', { style: 'font-size:12px;color:#475569' }, x.subtitle)), kind && x.id ? h('a', { href: passportHref(kind, x.id), 'data-testid': 'search-passport', style: 'display:flex;align-items:center;margin:4px 0;padding:0 12px;border:1px solid #1d4ed8;border-radius:10px;color:#1d4ed8;text-decoration:none;font-weight:700;min-height:44px' }, 'Pasaport →') : null);
    })))));
}
