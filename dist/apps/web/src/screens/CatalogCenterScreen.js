// KMI-CATALOG-001 — Katalog Merkezi: müşteri · tedarikçi · ürün ana verilerine TEK giriş. ONE FACT → ONE SOURCE → ONE CALCULATION → MANY VIEWS:
// no second data source and no copy — every card is the existing registered card (passport_card_faces) and the whole card opens the existing digital passport.
// Create / activate use the existing canonical operations (create_customer, set_customer_active, create_supplier; products via the Product Master form).
// Passivating is never deleting: history links stay. Authority is decided by the server (RLS / security-definer); the UI only hides what the role cannot do.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { renderEntityGalleryScreen } from './EntityGalleryScreen.js';
import { errorText } from '../errorText.js';
const KIND = { musteri: 'CUSTOMER', tedarikci: 'SUPPLIER', urun: 'PRODUCT' };
const TAB_TR = { musteri: ['Müşteriler', 'Aktif müşteri', '+ Müşteri Ekle'], tedarikci: ['Tedarikçiler', 'Aktif tedarikçi', '+ Tedarikçi Ekle'], urun: ['Ürünler', 'Aktif ürün', '+ Ürün Ekle'] };
export const CATALOG_FROM_KEY = 'kmi.catalog.from';
const CC_CSS = `
.cc{max-width:1400px;margin:0 auto;padding:0 4px 24px}
.cc-h1{margin:6px 0 0;font-size:28px;letter-spacing:.01em}.cc-sub{margin:2px 0 14px;color:var(--kmi-mut,#94a3b8);font-size:15px}
.cc-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}
@media (max-width:620px){.cc-kpis{grid-template-columns:1fr 1fr 1fr;gap:8px}}
.cc-kpi{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;min-width:0;text-align:left;cursor:pointer;color:inherit;font:inherit;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}
.cc-kpi:hover,.cc-kpi[aria-pressed=true]{border-color:var(--kmi-focus,#38bdf8)}.cc-kpi:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.cc-kpi b{font-size:28px;line-height:1.1}.cc-kpi span{font-size:13px;color:var(--kmi-mut,#94a3b8)}
.cc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px;border-bottom:1px solid var(--kmi-line,#1e2d4a)}
.cc-tab{min-height:44px;padding:8px 18px;border:0;border-bottom:3px solid transparent;background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer}
.cc-tab[aria-selected=true]{border-bottom-color:var(--kmi-focus,#38bdf8);color:var(--kmi-focus,#38bdf8)}.cc-tab:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:-3px}
.cc-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.cc-add{min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.12);color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.cc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;padding:12px;margin-bottom:12px;border-radius:14px;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}
.cc-form input{min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit;min-width:0}
.cc-form .cc-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}
.cc-msg{padding:10px 12px;border-radius:10px;margin:6px 0 10px;font-size:14px}.cc-msg[data-kind=ok]{background:rgba(34,197,94,.16)}.cc-msg[data-kind=error]{background:rgba(239,68,68,.18)}
.eg-wrap{display:flex;flex-direction:column;gap:6px;min-width:0}
.eg-wrap .cc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 4px;font-size:13px}
.cc-mini{min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:none;color:inherit;font:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.cc-mini:hover{border-color:var(--kmi-focus,#38bdf8)}.cc-mini:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8)}
`;
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
export async function renderCatalogCenterScreen(container, deps, state = {}) {
    const tabs = ['musteri', 'tedarikci', 'urun'].filter((t) => deps.allow.tabs[t]);
    let tab = state.tab && tabs.includes(state.tab) ? state.tab : tabs[0] ?? 'urun';
    let q = state.q ?? '';
    let filter = state.f ?? null;
    let banner = state.banner ?? null;
    let formOpen = false;
    let gen = 0;
    // faces are read once per category and reused for the summary and the gallery; a write invalidates them
    const cache = new Map();
    const gdeps = { ...deps.gallery, faces: (t) => { let p = cache.get(t); if (!p) {
            p = deps.gallery.faces(t);
            cache.set(t, p);
        } return p; } };
    const activeCount = (p) => p.catch(() => null);
    const kpiVals = { musteri: E('b', { 'data-testid': 'cc-kpi-musteri-n' }, '…'), tedarikci: E('b', { 'data-testid': 'cc-kpi-tedarikci-n' }, '…'), urun: E('b', { 'data-testid': 'cc-kpi-urun-n' }, '…') };
    const loadKpis = () => {
        for (const t of tabs) {
            kpiVals[t].textContent = '…';
            const run = t === 'urun'
                ? Promise.all([gdeps.faces('PRODUCT'), deps.products().catch(() => null)]).then(([fs, rows]) => { const st = new Map((rows ?? []).map((r) => [r.id, r.status])); return fs.filter((f) => (st.get(f.id) ?? 'ACTIVE') === 'ACTIVE').length; })
                : gdeps.faces(KIND[t]).then((fs) => fs.filter((f) => f.active).length);
            void activeCount(run).then((n) => { kpiVals[t].textContent = n === null ? '—' : String(n); kpiVals[t].setAttribute('data-known', String(n !== null)); });
        }
    };
    const url = () => `#/katalog?k=${tab}${q ? `&q=${encodeURIComponent(q)}` : ''}${filter ? `&f=${filter}` : ''}`;
    const galleryHost = E('div', { 'data-testid': 'cc-gallery' });
    const formHost = E('div', { 'data-testid': 'cc-form-host' });
    const bannerHost = E('div', { 'data-testid': 'cc-banner-host', 'aria-live': 'polite' });
    const say = (kind, text) => { banner = { kind, text }; paintBanner(); };
    const paintBanner = () => { bannerHost.replaceChildren(...(banner ? [E('div', { class: 'cc-msg', 'data-testid': 'cc-message', 'data-kind': banner.kind, role: banner.kind === 'error' ? 'alert' : 'status' }, banner.text)] : [])); };
    const reload = async () => { cache.clear(); loadKpis(); await paintGallery(); };
    const act = async (fn, okText) => { try {
        await fn();
        formOpen = false;
        paintForm();
        say('ok', okText);
        await reload();
        return true;
    }
    catch (e) {
        say('error', errorText(e));
        return false;
    } };
    const paintForm = () => {
        if (!formOpen) {
            formHost.replaceChildren();
            return;
        }
        if (tab === 'musteri') {
            const code = E('input', { type: 'text', placeholder: 'Kod (kısa)', 'aria-label': 'Müşteri kodu', 'data-testid': 'cc-c-code', maxlength: 20 });
            const name = E('input', { type: 'text', placeholder: 'Müşteri unvanı', 'aria-label': 'Müşteri unvanı', 'data-testid': 'cc-c-name', maxlength: 160 });
            const country = E('input', { type: 'text', placeholder: 'Ülke', 'aria-label': 'Ülke', 'data-testid': 'cc-c-country', maxlength: 60 });
            formHost.replaceChildren(E('div', { class: 'cc-form', 'data-testid': 'cc-form' }, code, name, country, E('div', { class: 'cc-actions' }, E('button', { type: 'button', class: 'cc-add', 'data-testid': 'cc-c-save', onClick: () => void act(() => deps.catalog.createCustomer(code.value.trim(), name.value.trim(), country.value.trim()), 'Müşteri eklendi.') }, 'Kaydet'), E('button', { type: 'button', class: 'cc-mini', 'data-testid': 'cc-cancel', onClick: () => { formOpen = false; paintForm(); } }, 'Vazgeç'))));
        }
        else if (tab === 'tedarikci') {
            const name = E('input', { type: 'text', placeholder: 'Tedarikçi adı', 'aria-label': 'Tedarikçi adı', 'data-testid': 'cc-s-name', maxlength: 160 });
            const contact = E('input', { type: 'text', placeholder: 'İletişim (isteğe bağlı)', 'aria-label': 'İletişim', 'data-testid': 'cc-s-contact', maxlength: 200 });
            formHost.replaceChildren(E('div', { class: 'cc-form', 'data-testid': 'cc-form' }, name, contact, E('div', { class: 'cc-actions' }, E('button', { type: 'button', class: 'cc-add', 'data-testid': 'cc-s-save', onClick: () => void act(() => deps.catalog.createSupplier(name.value.trim(), contact.value.trim()), 'Tedarikçi eklendi.') }, 'Kaydet'), E('button', { type: 'button', class: 'cc-mini', 'data-testid': 'cc-cancel', onClick: () => { formOpen = false; paintForm(); } }, 'Vazgeç'))));
        }
    };
    const paintGallery = async () => {
        const mine = ++gen;
        galleryHost.replaceChildren(E('p', { class: 'eg-note' }, 'Yükleniyor…'));
        const kind = KIND[tab];
        let productInfo = null;
        let customerOrders = null;
        if (tab === 'urun') {
            try {
                productInfo = Object.fromEntries((await deps.products()).map((r) => [r.id, { status: r.status, customerName: r.customerName }]));
            }
            catch {
                productInfo = null;
            }
        }
        if (tab === 'musteri') {
            try {
                customerOrders = await deps.customerOrders();
            }
            catch {
                customerOrders = null;
            }
        }
        if (mine !== gen)
            return; // a newer tab / reload started while this one was loading
        const inner = E('div', {});
        galleryHost.replaceChildren(inner);
        await renderEntityGalleryScreen(inner, gdeps, { kind, embedded: true, catalog: {
                initialQuery: q, initialFilter: filter, productInfo, customerOrders,
                onChange: (nq, nf) => { q = nq; filter = nf; deps.remember(url()); },
                actions: (f) => {
                    if (kind === 'CUSTOMER' && deps.allow.createCustomer)
                        return customerActions(f);
                    if (kind === 'PRODUCT' && deps.allow.createProduct)
                        return E('div', { class: 'cc-row' }, E('a', { class: 'cc-mini', href: `#/urun-master?urun=${f.id}`, 'data-testid': 'cc-p-edit' }, 'Kaydı düzenle'));
                    return null;
                }
            } });
        // remember where the passport was opened from, so the passport's "back" returns to THIS tab / search
        inner.addEventListener('click', (ev) => { const a = ev.target?.closest('a.ec'); if (a)
            try {
                sessionStorage.setItem(CATALOG_FROM_KEY, url());
            }
            catch { /* storage unavailable */ } }, true);
        deps.remember(url());
    };
    const customerActions = (f) => {
        const row = E('div', { class: 'cc-row', 'data-testid': 'cc-c-actions' });
        const idle = () => row.replaceChildren(f.active
            ? E('button', { type: 'button', class: 'cc-mini', 'data-testid': 'cc-c-off', onClick: () => ask() }, 'Pasife al')
            : E('button', { type: 'button', class: 'cc-mini', 'data-testid': 'cc-c-on', onClick: () => void act(() => deps.catalog.setCustomerActive(f.id, true, 'Katalog Merkezi: yeniden etkinleştirildi'), 'Müşteri etkinleştirildi.') }, 'Etkinleştir'));
        const ask = () => row.replaceChildren(E('span', { class: 'mut' }, 'Pasife alınsın mı? Kayıt silinmez; geçmiş bağlantılar kalır.'), E('button', { type: 'button', class: 'cc-mini', 'data-testid': 'cc-c-off-yes', onClick: () => void act(() => deps.catalog.setCustomerActive(f.id, false, 'Katalog Merkezi: pasife alındı (silinmedi)'), 'Müşteri pasife alındı (silinmedi).') }, 'Evet'), E('button', { type: 'button', class: 'cc-mini', 'data-testid': 'cc-c-off-no', onClick: idle }, 'Vazgeç'));
        idle();
        return row;
    };
    const tabBtn = (t) => E('button', { type: 'button', role: 'tab', class: 'cc-tab', 'data-testid': `cc-tab-${t}`, 'aria-selected': String(t === tab), onClick: () => select(t) }, TAB_TR[t][0]);
    const kpi = (t) => E('button', { type: 'button', class: 'cc-kpi', 'data-testid': `cc-kpi-${t}`, 'aria-pressed': String(t === tab), 'aria-label': `${TAB_TR[t][1]} — ${TAB_TR[t][0]} sekmesini aç`, onClick: () => select(t) }, kpiVals[t], E('span', {}, TAB_TR[t][1]));
    const addBar = E('div', { class: 'cc-bar', 'data-testid': 'cc-bar' });
    const tabRow = E('div', { class: 'cc-tabs', role: 'tablist', 'aria-label': 'Katalog kategorileri' });
    const kpiRow = E('div', { class: 'cc-kpis', 'data-testid': 'cc-kpis' });
    const paintChrome = () => {
        tabRow.replaceChildren(...tabs.map(tabBtn));
        kpiRow.replaceChildren(...tabs.map(kpi));
        const can = tab === 'musteri' ? deps.allow.createCustomer : tab === 'tedarikci' ? deps.allow.createSupplier : deps.allow.createProduct;
        addBar.replaceChildren(...(can ? [tab === 'urun'
                ? E('a', { class: 'cc-add', href: '#/urun-liste?yeni=1', 'data-testid': 'cc-add' }, TAB_TR[tab][2])
                : E('button', { type: 'button', class: 'cc-add', 'data-testid': 'cc-add', onClick: () => { formOpen = !formOpen; paintForm(); } }, TAB_TR[tab][2])] : []));
    };
    const select = (t) => { if (t === tab)
        return; tab = t; q = ''; filter = null; formOpen = false; banner = null; paintBanner(); paintChrome(); paintForm(); void paintGallery(); };
    if (!tabs.length) {
        mount(container, E('div', { class: 'kx cc', 'data-testid': 'cc-root' }, E('h1', { class: 'cc-h1' }, 'Katalog Merkezi'), E('div', { class: 'banner', role: 'alert', 'data-testid': 'cc-denied' }, 'Katalog kategorilerini görme yetkiniz yok. Gerekliyse sistem sahibine başvurun.')));
        return;
    }
    mount(container, E('div', { class: 'kx cc', 'data-testid': 'cc-root' }, E('style', {}, CC_CSS), E('h1', { class: 'cc-h1', 'data-testid': 'cc-heading' }, 'Katalog Merkezi'), E('p', { class: 'cc-sub' }, 'Müşteri · Tedarikçi · Ürün Ana Verileri'), kpiRow, tabRow, addBar, bannerHost, formHost, galleryHost));
    paintChrome();
    paintBanner();
    loadKpis();
    await paintGallery();
}
