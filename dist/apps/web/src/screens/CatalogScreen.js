// KMI NEXT — Katalog: müşteri / tedarikçi / ürün ana verisi (migration 0057). Siparişler buradaki müşteriyi seçer;
// serbest yazılmış kimlik yoktur. Ürün oluşturma burada yoktur: ürün + revizyon + rota Rota ekranında, toplu giriş
// "Ana veri aktarımı" ekranında doğrulanarak yapılır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
export async function renderCatalogScreen(container, api, banner) {
    const redo = (b) => void renderCatalogScreen(container, api, b);
    let customers = [];
    let suppliers = [];
    let products = [];
    let err = null;
    try {
        [customers, suppliers, products] = await Promise.all([api.customers(), api.suppliers(), api.products()]);
    }
    catch (e) {
        err = errorText(e);
    }
    const cCode = h('input', { type: 'text', placeholder: 'Kod', 'data-testid': 'cat-c-code', style: 'width:90px' });
    const cName = h('input', { type: 'text', placeholder: 'Müşteri unvanı', 'data-testid': 'cat-c-name', style: 'flex:1 1 160px;min-width:0' });
    const cCountry = h('input', { type: 'text', placeholder: 'Ülke', 'data-testid': 'cat-c-country', style: 'width:70px' });
    const sName = h('input', { type: 'text', placeholder: 'Tedarikçi adı', 'data-testid': 'cat-s-name', style: 'flex:1 1 160px;min-width:0' });
    const sContact = h('input', { type: 'text', placeholder: 'İletişim (isteğe bağlı)', 'data-testid': 'cat-s-contact', style: 'flex:1 1 140px;min-width:0' });
    const act = async (fn, okText) => { try {
        await fn();
        redo({ kind: 'ok', text: okText });
    }
    catch (e) {
        redo({ kind: 'error', text: errorText(e) });
    } };
    mount(container, h('div', { class: 'catalog-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'cat-heading' }, 'Katalog (müşteri · tedarikçi · ürün)'), banner ? h('div', { 'data-testid': 'cat-message', 'data-kind': banner.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${banner.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, banner.text) : null, err ? h('div', { 'data-testid': 'cat-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, err) : null, err ? null : h('section', {}, h('h2', { style: 'font-size:16px' }, `Müşteriler (${customers.length})`), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0' }, cCode, cName, cCountry, h('button', { type: 'button', 'data-testid': 'cat-c-add', onClick: () => void act(() => api.createCustomer(cCode.value.trim(), cName.value.trim(), cCountry.value.trim()), 'Müşteri eklendi.') }, 'Müşteri ekle')), customers.length ? null : h('div', { 'data-testid': 'cat-c-empty', style: 'color:#64748b' }, 'Henüz müşteri yok. Ekleyin veya “Ana veri aktarımı” ile eski KMI verisini doğrulayarak getirin.'), ...customers.map((c) => h('div', { 'data-testid': 'cat-c-row', 'data-active': String(c.active), style: 'display:flex;gap:6px;justify-content:space-between;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px' }, h('span', {}, `${c.name} · ${c.code}${c.country ? ` · ${c.country}` : ''}${c.active ? '' : ' · PASİF'}`), h('button', { type: 'button', 'data-testid': 'cat-c-toggle', onClick: () => void act(() => api.setCustomerActive(c.id, !c.active, c.active ? 'Katalogdan pasife alındı' : 'Katalogdan yeniden etkinleştirildi'), c.active ? 'Müşteri pasife alındı.' : 'Müşteri etkinleştirildi.') }, c.active ? 'Pasife al' : 'Etkinleştir'))), h('h2', { style: 'font-size:16px;margin-top:14px' }, `Tedarikçiler (${suppliers.length})`), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0' }, sName, sContact, h('button', { type: 'button', 'data-testid': 'cat-s-add', onClick: () => void act(() => api.createSupplier(sName.value.trim(), sContact.value.trim()), 'Tedarikçi eklendi.') }, 'Tedarikçi ekle')), ...suppliers.map((s) => h('div', { 'data-testid': 'cat-s-row', style: 'border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px' }, `${s.name}${s.active ? '' : ' · PASİF'}`)), h('h2', { style: 'font-size:16px;margin-top:14px' }, `Ürünler (${products.length})`), products.length ? null : h('div', { 'data-testid': 'cat-p-empty', style: 'color:#64748b' }, 'Henüz ürün yok. Ürünler “Ana veri aktarımı” veya Rota ekranından girilir.'), ...products.map((p) => h('div', { 'data-testid': 'cat-p-row', style: 'border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px' }, `${p.code} · ${p.name}`)))));
}
