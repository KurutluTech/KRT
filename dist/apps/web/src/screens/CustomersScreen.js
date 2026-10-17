// KMI-006 — Müşteri ve İlişki Yönetimi: müşteri listesi · profil · kişiler · şartlar · teslimat performansı · yetkili baskı · geçmiş.
// Yetki SUNUCUDA (CUSTOMER_MANAGE yazma; CUSTOMER_CONTACT_VIEW okuma); ekran yalnız yetkinin düğmelerini gösterir. Kârlılık KMI-070 olmadan hesaplanmaz → VERİ YOK.
// Her profil okuması ve her baskı sunucuda kayda geçer. Sahte sayı yok: veri yoksa "VERİ YOK".
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../errorText.js';
const CSS = `
.cu{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:980px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.cu h1{color:#fff;font-size:20px}.cu h2{color:#fff;font-size:16px;margin:0 0 6px}
.cu button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}
.cu input,.cu select,.cu textarea{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.cu .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0}
.cu .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.cu .grid{display:grid;gap:8px;margin-top:8px}
.cu .primary{background:#1d4ed8;color:#fff}.cu .ghost{background:#1e293b;color:#e2e8f0}
.cu .chip{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:11px;background:#1e293b;color:#e6edf7}
.cu .ok{background:#14532d;color:#bbf7d0}.cu .warn{background:#78350f;color:#fde68a}.cu .bad{background:#7f1d1d;color:#fecaca}.cu .info{background:#1e3a8a;color:#dbeafe}
.cu .mut{color:#94a3b8;font-size:12px}.cu .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.cu .kpi{border:1px solid #1e293b;border-radius:12px;padding:10px;background:#0b1220}.cu .kpi b{display:block;font-size:20px;color:#fff}
.cu .item{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 0;border-top:1px solid #1e293b}
.cu-print{display:none}
@media print{body *{visibility:hidden}.cu-print,.cu-print *{visibility:visible}.cu-print{display:block;position:absolute;inset:0;background:#fff;color:#000;padding:24px}}
`;
const NA = 'VERİ YOK';
export async function renderCustomersScreen(container, api, state = {}) {
    const go = (s) => renderCustomersScreen(container, api, { q: state.q, ...s });
    const shell = (...kids) => mount(container, h('div', { class: 'cu', 'data-testid': 'cu-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'info'}`, 'data-testid': 'cu-banner', 'data-kind': state.banner.kind }, state.banner.text) : null;
    if (!state.open) {
        let rows;
        try {
            rows = await api.list();
        }
        catch (e) {
            shell(h('h1', {}, 'Müşteriler'), isSetupPending(e)
                ? h('div', { class: 'card warn', 'data-testid': 'cu-setup' }, 'Kurulum bekleniyor: müşteri kişileri ve şartları için sunucu güncellemesi (0096) henüz uygulanmadı.')
                : h('div', { class: 'card bad', 'data-testid': 'cu-error' }, `Yüklenemedi: ${errorText(e)}`));
            return;
        }
        const q = (state.q ?? '').trim().toLocaleLowerCase('tr');
        const shown = rows.filter((r) => !q || r.name.toLocaleLowerCase('tr').includes(q) || r.code.toLocaleLowerCase('tr').includes(q));
        const search = h('input', { type: 'search', placeholder: 'Müşteri adı veya kodu', value: state.q ?? '', 'data-testid': 'cu-search', onInput: (ev) => { state.q = ev.target.value; } });
        search.addEventListener('keydown', (ev) => { if (ev.key === 'Enter')
            void go({ q: search.value }); });
        shell(h('h1', { 'data-testid': 'cu-heading' }, 'Müşteriler'), banner, h('div', { class: 'row' }, search, h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-search-btn', onClick: () => void go({ q: search.value }) }, 'Ara')), h('div', { class: 'card', 'data-testid': 'cu-list' }, h('h2', {}, `${shown.length} müşteri`), ...(shown.length ? shown.map((r) => h('div', { class: 'item', 'data-testid': 'cu-row', 'data-id': r.id }, h('div', {}, h('b', {}, r.name), h('div', { class: 'mut' }, `${r.code}${r.country ? ' · ' + r.country : ''}`)), h('div', { class: 'row' }, h('span', { class: `chip ${r.active ? 'ok' : 'warn'}` }, r.active ? 'Aktif' : 'Pasif'), h('span', { class: 'chip info', 'data-testid': 'cu-orders' }, `Aktif sipariş: ${r.activeOrders}`), h('a', { class: 'btn ghost', href: `#/pasaport-calisma?tur=CUSTOMER&id=${r.id}`, 'data-testid': 'cu-card' }, 'Dijital kart'), h('button', { type: 'button', class: 'primary', 'data-testid': 'cu-open', onClick: () => void go({ open: r.id }) }, 'Aç'))))
            : [h('div', { class: 'mut', 'data-testid': 'cu-empty' }, rows.length ? 'Aramaya uyan müşteri yok.' : 'Müşteri kaydı yok.')])));
        return;
    }
    let p;
    try {
        p = await api.profile(state.open);
    }
    catch (e) {
        shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({}) }, '← Müşteriler'), h('div', { class: 'card bad', 'data-testid': 'cu-error' }, `Yüklenemedi: ${errorText(e)}`));
        return;
    }
    const act = async (fn, ok, keep = {}) => {
        try {
            await fn();
            await go({ open: p.customer.id, banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await go({ open: p.customer.id, banner: { kind: 'error', text: errorText(e) }, ...keep });
        }
    };
    const d = p.delivery;
    const contactRow = (c) => h('div', { class: 'item', 'data-testid': 'cu-contact', 'data-id': c.id }, h('div', {}, h('b', {}, c.fullName), c.isPrimary ? h('span', { class: 'chip ok', style: 'margin-left:6px' }, 'Birincil') : null, !c.active ? h('span', { class: 'chip warn', style: 'margin-left:6px' }, 'Pasif') : null, h('div', { class: 'mut' }, [c.roleTitle, c.phone, c.email].filter(Boolean).join(' · ') || 'İletişim bilgisi yok')), p.canManage ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-contact-edit', onClick: () => void go({ open: p.customer.id, editContact: c.id }) }, 'Düzenle'), c.active ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-contact-off', onClick: () => { const r = window.prompt('Pasife alma gerekçesi (en az 5 karakter)') ?? ''; if (r.trim().length >= 5)
            void act(() => api.setContactActive(c.id, false, r), 'Kişi pasife alındı.'); } }, 'Pasife al')
        : h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-contact-on', onClick: () => { const r = window.prompt('Aktif etme gerekçesi (en az 5 karakter)') ?? ''; if (r.trim().length >= 5)
                void act(() => api.setContactActive(c.id, true, r), 'Kişi aktif edildi.'); } }, 'Aktif et')) : null);
    const contactForm = () => {
        if (!state.editContact || !p.canManage)
            return null;
        const cur = p.contacts.find((c) => c.id === state.editContact);
        const f = (name, val, ph) => h('input', { type: 'text', value: val ?? '', placeholder: ph, 'data-testid': `cu-f-${name}` });
        const nm = f('name', cur?.fullName, 'Ad soyad'), rl = f('role', cur?.roleTitle, 'Görev'), ph = f('phone', cur?.phone, 'Telefon'), em = f('email', cur?.email, 'E-posta'), nt = f('note', cur?.note, 'Not');
        const pr = h('input', { type: 'checkbox', 'data-testid': 'cu-f-primary', ...(cur?.isPrimary ? { checked: 'checked' } : {}) });
        if (cur?.isPrimary)
            pr.checked = true;
        return h('div', { class: 'card', 'data-testid': 'cu-contact-form' }, h('h2', {}, cur ? 'Kişiyi düzenle' : 'Yeni kişi'), h('div', { class: 'grid' }, nm, rl, ph, em, nt, h('label', { class: 'mut' }, pr, ' Birincil iletişim kişisi')), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'cu-contact-save', onClick: () => { const input = { contactId: cur?.id ?? null, fullName: nm.value, roleTitle: rl.value, phone: ph.value, email: em.value, isPrimary: pr.checked, note: nt.value }; void act(() => api.saveContact(p.customer.id, input), 'Kişi kaydedildi.', { editContact: state.editContact }); } }, 'Kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ open: p.customer.id }) }, 'Vazgeç')));
    };
    const termsBlock = () => {
        const t = p.terms;
        if (state.editTerms && p.canManage) {
            const ta = (n, v, ph) => h('input', { type: 'text', value: v ?? '', placeholder: ph, 'data-testid': `cu-t-${n}` });
            const a = ta('payment', t?.paymentTerms, 'Ödeme şartı (örn. 60 gün vade)'), b = ta('delivery', t?.deliveryTerms, 'Teslimat şartı'), c = ta('quality', t?.qualityRequirements, 'Kalite gereksinimi'), n = ta('note', t?.note, 'Not');
            return h('div', { class: 'card', 'data-testid': 'cu-terms' }, h('h2', {}, 'Şartlar'), h('div', { class: 'grid' }, a, b, c, n), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'cu-terms-save', onClick: () => void act(() => api.saveTerms(p.customer.id, { payment: a.value, delivery: b.value, quality: c.value, note: n.value }), 'Şartlar kaydedildi.') }, 'Kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ open: p.customer.id }) }, 'Vazgeç')));
        }
        return h('div', { class: 'card', 'data-testid': 'cu-terms' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, 'Şartlar'), p.canManage ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-terms-edit', onClick: () => void go({ open: p.customer.id, editTerms: true }) }, t ? 'Düzenle' : 'Şart ekle') : null), t ? h('div', { class: 'grid' }, ...[['Ödeme', t.paymentTerms], ['Teslimat', t.deliveryTerms], ['Kalite', t.qualityRequirements], ['Not', t.note]].map(([k, v]) => h('div', {}, h('span', { class: 'mut' }, `${k}: `), v || '—')))
            : h('div', { class: 'mut', 'data-testid': 'cu-terms-empty' }, 'Şart kaydı yok (VERİ YOK).'));
    };
    const printSheet = state.print ? h('div', { class: 'cu-print', 'data-testid': 'cu-print' }, h('h1', {}, state.print.title), ...state.print.lines.map((l) => h('div', {}, l)), h('div', { style: 'margin-top:16px;font-size:11px' }, `Yazdırma: ${state.print.at}`)) : null;
    shell(h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-back', onClick: () => void go({}) }, '← Müşteriler')), banner, h('div', { class: 'card', 'data-testid': 'cu-profile' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('h1', { 'data-testid': 'cu-name' }, p.customer.name), h('div', { class: 'mut' }, `${p.customer.code}${p.customer.country ? ' · ' + p.customer.country : ''} · ${p.customer.active ? 'Aktif' : 'Pasif'}`)), h('div', { class: 'row' }, p.canManage ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'cu-edit', onClick: () => void go({ open: p.customer.id, editCustomer: true }) }, 'Düzenle') : null, p.canManage ? h('a', { href: `#/gecmis?p=THIS_YEAR&e=CUSTOMER&q=${encodeURIComponent(p.customer.id)}`, 'data-testid': 'cu-history', class: 'chip info' }, 'Geçmiş') : null, h('button', { type: 'button', class: 'primary', 'data-testid': 'cu-print-btn', onClick: async () => { try {
            const pr = await api.printCard(p.customer.id);
            const lines = [`${pr.customer.name} (${pr.customer.code})`, ...pr.contacts.map((c) => `${c.fullName} — ${[c.roleTitle, c.phone, c.email].filter(Boolean).join(' · ')}`), ...(pr.terms ? [`Ödeme: ${pr.terms.paymentTerms ?? '—'}`, `Teslimat: ${pr.terms.deliveryTerms ?? '—'}`, `Kalite: ${pr.terms.qualityRequirements ?? '—'}`] : ['Şart kaydı yok'])];
            await go({ open: p.customer.id, print: { title: pr.title, at: pr.printedAt.slice(0, 16).replace('T', ' '), lines } });
            try {
                window.print();
            }
            catch { /* headless */ }
        }
        catch (e) {
            await go({ open: p.customer.id, banner: { kind: 'error', text: errorText(e) } });
        } } }, 'Müşteri kartı yazdır'))), state.editCustomer && p.canManage ? (() => {
        const nm = h('input', { type: 'text', value: p.customer.name, 'data-testid': 'cu-e-name' });
        const co = h('input', { type: 'text', value: p.customer.country ?? '', placeholder: 'Ülke', 'data-testid': 'cu-e-country' });
        const rs = h('input', { type: 'text', placeholder: 'Gerekçe (en az 5 karakter)', 'data-testid': 'cu-e-reason' });
        return h('div', { class: 'grid' }, nm, co, rs, h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'cu-e-save', onClick: () => void act(() => api.updateCustomer(p.customer.id, nm.value, co.value, rs.value), 'Müşteri güncellendi.', { editCustomer: true }) }, 'Kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ open: p.customer.id }) }, 'Vazgeç')));
    })() : null), h('div', { class: 'kpis', 'data-testid': 'cu-kpis' }, h('div', { class: 'kpi' }, h('span', { class: 'mut' }, 'Aktif sipariş'), h('b', { 'data-testid': 'cu-active-orders' }, String(p.activeOrders))), h('div', { class: 'kpi' }, h('span', { class: 'mut' }, 'Zamanında teslimat'), h('b', { 'data-testid': 'cu-ontime' }, d.onTimePct === null ? NA : `%${d.onTimePct}`), h('span', { class: 'mut' }, d.judged ? `${d.onTime}/${d.judged} sevkiyat vade tarihine göre` : 'Vade tarihi olan sevkiyat yok')), h('div', { class: 'kpi' }, h('span', { class: 'mut' }, 'Kârlılık'), h('b', { 'data-testid': 'cu-profit' }, NA), h('span', { class: 'mut' }, p.profitabilityNote))), termsBlock(), h('div', { class: 'card', 'data-testid': 'cu-contacts' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, `Kişiler (${p.contacts.filter((c) => c.active).length})`), p.canManage ? h('button', { type: 'button', class: 'primary', 'data-testid': 'cu-contact-add', onClick: () => void go({ open: p.customer.id, editContact: 'new' }) }, 'Kişi ekle') : null), ...(p.contacts.length ? p.contacts.map(contactRow) : [h('div', { class: 'mut', 'data-testid': 'cu-contacts-empty' }, 'Kayıtlı kişi yok (VERİ YOK).')])), contactForm(), printSheet);
}
