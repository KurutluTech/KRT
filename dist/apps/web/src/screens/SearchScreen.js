// KMI NEXT — Arama (KMI-005). Düz, yapay zekâsız arama: sonuçlar rolünüze göre SUNUCUDA süzülür (universal_search_v2); her sonuç kaydın kendi ekranına, pasaportuna ve kayıt geçmişine gider.
// Filtreler (tür · tarih aralığı · durum) sunucuda gerçek kayıtlara uygulanır ve URL'de durur (geri tuşu çalışır). İstemci satır ekleyemez; yalnız sıralar ve nedenini söyler.
// (“KMI Zekâ — sor” ayrı bir özelliktir; arama ona bağlı değildir.)
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { SEARCH_TYPE_TO_KIND, KINDS, passportHref, canOpenPassport } from '../passport/registry.js';
import { canOpen } from '../access.js';
import { classifyQuery, scanHref, orderHits, matchWhy, MATCH_TR, historyHref } from '../../../../packages/domain/src/universalSearch.js';
export const TYPE_TR = { PRODUCT: 'Ürünler', PRODUCT_REVISION: 'Ürün revizyonları', WORK_ORDER: 'İş emirleri', MACHINE: 'Makineler', MAINTENANCE_TICKET: 'Bakım kayıtları', TOOL: 'Takımlar', STOCK_LOT: 'Stok partileri',
    ORDER: 'Siparişler', CUSTOMER: 'Müşteriler', SHIPMENT: 'Sevkiyatlar', SUPPLIER: 'Tedarikçiler', MATERIAL: 'Malzeme kodları', PURCHASE_REQUEST: 'Satınalma talepleri', PURCHASE_ORDER: 'Satınalma siparişleri',
    APPROVAL: 'Ticari onaylar', QUALITY_NCR: 'Uygunsuzluklar (NCR)', TASK: 'Görevler' };
let panelOpen = false; // keeps the Filtrele panel open while a filter change re-renders the screen
const KS_CSS = `
.ks{--ks-line:#334155;--ks-accent:#1d4ed8}
.ks-h1{font-size:20px;margin:6px 0 8px}
.ks-h2{font-size:14px;margin:10px 0 4px}
.ks-muted{color:#64748b;font-size:12px;margin:4px 0}
.ks-warn{color:#92400e;font-size:12px;margin:4px 0}
.ks-q{display:flex;gap:6px;margin:0 0 6px}
.ks-q input{flex:1;min-width:0;min-height:44px;padding:0 10px;border:1px solid #cbd5e1;border-radius:10px;font-size:16px}
.ks-q button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--ks-accent);background:var(--ks-accent);color:#fff;font-weight:700}
.ks-code{display:block;border:1px solid var(--ks-accent);border-radius:10px;padding:8px 10px;margin:6px 0;text-decoration:none;color:#1d4ed8;min-height:44px;box-sizing:border-box}
.ks-bar{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;margin:4px 0}
.ks-count{font-weight:700;min-height:40px;display:inline-flex;align-items:center;margin-right:auto}
.ks-panel{flex:1 1 100%;order:3}
.ks-panel summary{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid currentColor;border-radius:10px;cursor:pointer;font-weight:600;list-style:none}
.ks-panel summary::-webkit-details-marker{display:none}
.ks-badge{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--ks-accent);color:#fff;font-size:12px}
.ks-fields{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.ks-field{display:flex;flex-direction:column;font-size:12px;color:#475569;gap:2px;flex:1 1 130px;min-width:0}
.ks-field-wide{flex:1 1 100%}.ks-field-full{flex:1 1 100%}
.ks-field input,.ks-field select{min-height:44px;padding:0 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px;width:100%;box-sizing:border-box}
.ks-clear{display:inline-flex;align-items:center;min-height:40px;padding:0 12px;border:1px solid #475569;border-radius:10px;color:inherit;text-decoration:none;font-weight:600}
.ks-chips{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;margin:6px -16px;padding:2px 16px;scrollbar-width:thin}
.ks-chip{flex:0 0 auto;padding:4px 12px;min-height:36px;display:inline-flex;align-items:center;border-radius:999px;border:1px solid var(--ks-accent);text-decoration:none;font-weight:600;font-size:13px;color:#1d4ed8;white-space:nowrap}
.ks-chip-on{background:var(--ks-accent);color:#fff}
.ks-card{display:flex;flex-direction:column;border:1px solid #e2e8f0;border-radius:10px;margin:4px 0;overflow:hidden}
.ks-hit{display:block;padding:8px 10px;color:inherit;text-decoration:none;min-height:44px;box-sizing:border-box;overflow-wrap:anywhere}
.ks-title{font-size:15px}.ks-sub{font-size:12px;color:#475569}.ks-why{font-size:11px;color:#64748b}.ks-nos{font-size:11px;color:#92400e}
.ks-actions{display:flex;border-top:1px solid #e2e8f0}
.ks-act{flex:1;display:flex;align-items:center;justify-content:center;min-height:44px;color:inherit;text-decoration:none;font-weight:600;font-size:14px}
.ks-act+.ks-act{border-left:1px solid #e2e8f0}.ks-act-main{color:#1d4ed8;font-weight:700}
@media (min-width:900px){.ks-q{display:none}.ks-fields .ks-field,.ks-fields .ks-field-wide{flex:0 1 210px}.ks-fields .ks-field-full{flex:1 1 100%}.ks-chips{flex-wrap:wrap;overflow:visible;margin:6px 0;padding:0}.ks-card{flex-direction:row;align-items:stretch}.ks-hit{flex:1}.ks-actions{border-top:0;border-left:1px solid #e2e8f0}.ks-act{padding:0 14px;flex:none}}
`;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const stateHref = (q, f) => {
    const p = [`q=${encodeURIComponent(q)}`];
    if (f.types?.length)
        p.push(`f=${f.types.map(encodeURIComponent).join(',')}`);
    if (f.from)
        p.push(`from=${f.from}`);
    if (f.to)
        p.push(`to=${f.to}`);
    if (f.status)
        p.push(`s=${encodeURIComponent(f.status)}`);
    return `#/ara?${p.join('&')}`;
};
export async function renderSearchScreen(container, api, query, opts = {}) {
    const cls = classifyQuery(query);
    const q = cls.q;
    const f = { types: [...new Set(opts.filters?.types ?? [])], from: opts.filters?.from && ISO_DAY.test(opts.filters.from) ? opts.filters.from : null, to: opts.filters?.to && ISO_DAY.test(opts.filters.to) ? opts.filters.to : null, status: opts.filters?.status?.trim().toUpperCase() || null };
    const go = opts.navigate ?? ((hash) => { location.hash = hash; });
    let hits = [];
    let err = null;
    let note;
    let typeCounts = [];
    let statuses = [];
    let dateless = [];
    let legacy = false;
    // A KMI QR / label code is resolved by the ONE scan standard (KMI SCAN); the text index is still queried so a product code that looks like a label is not lost.
    if (q.length >= 2 && cls.kind !== 'TOO_LONG') {
        try {
            const r = await api.search(q, f);
            hits = r.results;
            note = r.note;
            typeCounts = r.typeCounts ?? [];
            statuses = r.statuses ?? [];
            dateless = r.datelessTypes ?? [];
            legacy = !!r.legacy;
        }
        catch (e) {
            err = errorText(e);
        }
    }
    const searched = q.length >= 2 && cls.kind !== 'TOO_LONG';
    hits = orderHits(hits, q);
    const types = [...new Set(hits.map((x) => x.type))];
    const code = scanHref(cls);
    const anyFilter = !!(f.types?.length || f.from || f.to || f.status);
    const chipTypes = typeCounts.length ? typeCounts : types.map((t) => ({ type: t, count: hits.filter((x) => x.type === t).length }));
    const toggleType = (t) => ({ ...f, types: f.types?.includes(t) ? f.types.filter((x) => x !== t) : [...(f.types ?? []), t] });
    const trDay = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : ''); // gg.aa.yyyy (display only — the server query still gets the ISO day)
    const dateIn = (testid, label, value, key) => h('label', { class: 'ks-field' }, label, h('input', { type: 'date', lang: 'tr', value: value ?? '', 'data-testid': testid, disabled: legacy ? true : undefined, onChange: (e) => go(stateHref(q, { ...f, [key]: e.target.value || null })) }));
    const statusSel = h('label', { class: 'ks-field ks-field-wide' }, 'Durum', h('select', { 'data-testid': 'search-status', disabled: legacy || (!statuses.length && !f.status) ? true : undefined, onChange: (e) => go(stateHref(q, { ...f, status: e.target.value || null })) }, h('option', { value: '' }, 'Tümü'), ...(f.status && !statuses.some((s) => s.status === f.status) ? [h('option', { value: f.status, selected: true }, f.status)] : []), ...statuses.map((s) => h('option', { value: s.status, ...(s.status === f.status ? { selected: true } : {}) }, `${s.status} (${s.count >= 50 ? '50+' : s.count})`))));
    const activeCount = (f.types?.length ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.status ? 1 : 0); // type chips, date range, status — one each
    const dateText = f.from && f.to ? `${trDay(f.from)} – ${trDay(f.to)}` : f.from ? `${trDay(f.from)} ve sonrası` : f.to ? `${trDay(f.to)} ve öncesi` : '';
    const desktop = typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;
    const total = hits.length;
    mount(container, h('div', { class: 'search-screen ks', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('style', {}, KS_CSS), h('h1', { 'data-testid': 'search-heading', class: 'ks-h1' }, q ? `Arama: ${q}` : 'Arama'), h('form', { class: 'ks-q', 'data-testid': 'search-form', onSubmit: (e) => { e.preventDefault(); const v = e.target.elements.namedItem('q').value.trim(); go(stateHref(v, f)); } }, h('input', { name: 'q', type: 'search', value: q, placeholder: 'Ürün, iş emri, makine, PO, müşteri…', 'aria-label': 'Ara', 'data-testid': 'search-input', autocomplete: 'off', enterkeyhint: 'search' }), h('button', { type: 'submit', 'data-testid': 'search-submit' }, 'Ara')), q.length < 2 || note === 'MIN_2_CHARS' ? h('div', { 'data-testid': 'search-hint', class: 'ks-muted' }, 'En az 2 karakter yazın (ürün kodu, iş emri, makine, PO, müşteri, görev…). Yalnız rolünüzün görebildiği kayıtlar listelenir.') : null, code ? h('a', { href: code, 'data-testid': 'search-code-card', class: 'ks-code' }, h('b', {}, 'Kodu KMI SCAN ile çöz →'), h('div', { style: 'font-size:12px' }, cls.hint ?? '')) : null, cls.kind === 'TOO_LONG' ? h('div', { 'data-testid': 'search-hint', class: 'ks-muted' }, 'Arama en çok 60 karakter olabilir.') : null, searched ? h('div', { class: 'ks-bar' }, h('span', { 'data-testid': 'search-count', class: 'ks-count', 'aria-live': 'polite' }, err ? '' : `${total} sonuç`), h('details', { class: 'ks-panel', 'data-testid': 'search-filter-panel', ...(panelOpen || desktop ? { open: true } : {}), onToggle: (e) => { panelOpen = e.target.open; } }, h('summary', { 'data-testid': 'search-filter-toggle' }, 'Filtrele', activeCount ? h('span', { 'data-testid': 'search-filter-count', class: 'ks-badge', 'aria-label': `${activeCount} aktif filtre` }, String(activeCount)) : null), h('div', { 'data-testid': 'search-filters', class: 'ks-fields' }, dateIn('search-from', 'Başlangıç (gg.aa.yyyy)', f.from ?? null, 'from'), dateIn('search-to', 'Bitiş (gg.aa.yyyy)', f.to ?? null, 'to'), statusSel, dateText ? h('div', { 'data-testid': 'search-date-tr', class: 'ks-muted ks-field-full' }, `Tarih aralığı: ${dateText}`) : null)), anyFilter ? h('a', { href: stateHref(q, {}), 'data-testid': 'search-clear', class: 'ks-clear' }, 'Temizle') : null) : null, searched && legacy ? h('div', { 'data-testid': 'search-legacy', class: 'ks-warn' }, 'Tarih ve durum filtresi için sunucu güncellemesi bekleniyor; şimdilik yalnız tür filtresi çalışır.') : null, searched && (chipTypes.length > 1 || f.types?.length) ? h('nav', { 'data-testid': 'search-facets', 'aria-label': 'Kayıt türü filtresi', class: 'ks-chips' }, ...chipTypes.slice().sort((a, b) => (TYPE_TR[a.type] ?? a.type).localeCompare(TYPE_TR[b.type] ?? b.type, 'tr')).map((c) => {
        const on = !!f.types?.includes(c.type);
        return h('a', { href: stateHref(q, toggleType(c.type)), 'data-testid': 'search-facet', 'data-type': c.type, 'aria-pressed': String(on), class: on ? 'ks-chip ks-chip-on' : 'ks-chip' }, `${on ? '✓ ' : ''}${TYPE_TR[c.type] ?? c.type} (${c.count >= 50 ? '50+' : c.count})`);
    })) : null, searched && dateless.length && (f.from || f.to) ? h('div', { 'data-testid': 'search-dateless', class: 'ks-muted' }, `Tarihi olmayan kayıtlar (${dateless.map((t) => TYPE_TR[t] ?? t).join(', ')}) tarih filtresiyle gösterilmez.`) : null, err ? h('div', { 'data-testid': 'search-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, err) : null, searched && !err && !hits.length && note !== 'MIN_2_CHARS' ? h('div', { 'data-testid': 'search-empty', class: 'ks-muted' }, anyFilter ? 'Bu filtrelerle sonuç yok (veya bu kayıtları görme yetkiniz yok).' : 'Sonuç yok (veya bu kayıtları görme yetkiniz yok).') : null, ...types.map((t) => h('section', { 'data-testid': 'search-group', 'data-type': t }, h('h2', { class: 'ks-h2' }, TYPE_TR[t] ?? t), ...hits.filter((x) => x.type === t).map((x) => {
        const kind = SEARCH_TYPE_TO_KIND[x.type];
        const may = kind && x.id && (!opts.access || canOpenPassport(kind, opts.access));
        const mayHistory = may && (!opts.access || canOpen('/gecmis', opts.access));
        const mayOpen = !opts.access || canOpen(x.route.split('?')[0] ?? x.route, opts.access); // the SERVER decides what is listed; this only avoids a dead link into a screen this role is not offered
        const body = [h('b', { class: 'ks-title' }, x.title), h('div', { class: 'ks-sub' }, x.subtitle), h('div', { 'data-testid': 'search-why', class: 'ks-why' }, MATCH_TR[matchWhy(x, q)]), mayOpen ? null : h('div', { 'data-testid': 'search-no-screen', class: 'ks-nos' }, 'Bu kaydın ekranı rolünüze açık değil.')];
        return h('div', { class: 'ks-card' }, mayOpen ? h('a', { href: `#${x.route}`, 'data-testid': 'search-hit', class: 'ks-hit' }, ...body) : h('div', { 'data-testid': 'search-hit', 'aria-disabled': 'true', class: 'ks-hit' }, ...body), may || mayHistory ? h('div', { class: 'ks-actions' }, may ? h('a', { href: passportHref(kind, x.id), 'data-testid': 'search-passport', class: 'ks-act ks-act-main', 'aria-label': `${x.title} pasaportu` }, 'Pasaport →') : null, mayHistory ? h('a', { href: historyHref(KINDS[kind].auditTypes[0], x.id) ?? '#', 'data-testid': 'search-history', class: 'ks-act', 'aria-label': `${x.title} geçmişi` }, 'Geçmiş') : null) : null);
    })))));
}
