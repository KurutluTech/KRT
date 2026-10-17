// KMI-009 — Ürün Master & Digital DNA: tekil ürün kimliği, revizyon (onaylı yayım), geçmiş, hazırlık kontrolü, gerçek süre analizi, pasaport/QR + künye baskısı, AI BOM taslağı (yalnız taslak).
// Yetki, operatör kapsamı ve tüm hesaplar SUNUCUDA; bu ekran yalnız gösterir. QR yalnız görüntüleme açar. Boş değer 0 yazılmaz (VERİ YOK).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { errorText, isSetupPending } from '../errorText.js';
const CSS = `
.pm{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:1100px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.pm h1{color:#fff;font-size:20px;margin:6px 0}.pm h2{color:#fff;font-size:16px;margin:0 0 6px}
.pm button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}
.pm input,.pm textarea,.pm select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.pm .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0}
.pm .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.pm .grid{display:grid;gap:8px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.pm .primary{background:#1d4ed8;color:#fff}.pm .ghost{background:#1e293b;color:#e2e8f0}.pm .danger{background:#7f1d1d;color:#fecaca}.pm .tab{background:#0b1220;color:#94a3b8;border:1px solid #1e293b}.pm .tab.on{background:#1e293b;color:#fff;border-color:#b88718}
.pm .chip{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:11px;background:#1e293b;color:#e6edf7}
.pm .ok{background:#14532d;color:#bbf7d0}.pm .warn{background:#78350f;color:#fde68a}.pm .bad{background:#7f1d1d;color:#fecaca}.pm .info{background:#1e3a8a;color:#dbeafe}
.pm .card.bad{background:#0f172a;border-color:#b91c1c}.pm .card.info{background:#0f172a;border-color:#1d4ed8}.pm .card.warn{background:#0f172a;border-color:#b45309}
.pm .mut{color:#94a3b8;font-size:12px;overflow-wrap:anywhere}.pm .card{overflow-wrap:anywhere}.pm .row>*{min-width:0}.pm label{font-size:12px;color:#94a3b8;display:block}
.pm .tw{overflow-x:auto}.pm table{border-collapse:collapse;width:100%;font-size:13px}.pm th,.pm td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left;white-space:nowrap}.pm th{color:#94a3b8}
.pm .tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}.pm .tabs button{flex:0 0 auto}
.pm div[data-testid="pm-qr"] svg,.pm-print div[data-testid="pm-print-qr"] svg{width:100%;height:100%;display:block}
.pm-print{display:none}
@media print{body *{visibility:hidden}.pm-print,.pm-print *{visibility:visible}.pm-print{display:block;position:absolute;inset:0;background:#fff;color:#000;padding:20px;font-family:system-ui,sans-serif}}
.pm-print .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #b88718;padding-bottom:8px;margin-bottom:12px}.pm-print .hd b{letter-spacing:.12em;font-size:18px}
.pm-print table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}.pm-print th,.pm-print td{border:1px solid #999;padding:4px 6px;text-align:left}
`;
const NA = 'VERİ YOK';
const REV_TR = { DRAFT: 'Taslak', RELEASED: 'Yürürlükte', OBSOLETE: 'Eski' };
const revChip = (s) => (s === 'RELEASED' ? 'ok' : s === 'DRAFT' ? 'info' : '');
const CHK = { OK: ['Tamam', 'ok'], MISSING: ['Eksik', 'bad'], BLOCKED: ['Engelli', 'bad'], WARN: ['Uyarı', 'warn'], NA: ['Kural yok', ''] };
const DUR = { OK: ['Güncel veri', 'ok'], UNKNOWN: ['BİLİNMİYOR (az veri)', 'warn'], STALE: ['BAYAT', 'warn'], NO_DATA: ['VERİ YOK', ''] };
const EV_TR = { MASTER_CREATED: 'Ürün oluşturuldu', MASTER_UPDATED: 'Ürün bilgisi değişti', STATUS_CHANGED: 'Durum değişti', REVISION_CREATED: 'Revizyon oluşturuldu', REVISION_SUBMITTED: 'Revizyon onaya gönderildi',
    REVISION_APPROVED: 'Revizyon onaylandı', REVISION_REJECTED: 'Revizyon reddedildi', ORDER_ITEM_REVISION_SET: 'Sipariş kalemi revizyona bağlandı', BOM_DRAFT_PROPOSED: 'BOM taslağı önerildi', BOM_DRAFT_APPROVED: 'BOM taslağı onaylandı',
    BOM_DRAFT_REJECTED: 'BOM taslağı reddedildi', BOM_DRAFT_APPLIED: 'BOM taslağı uygulandı', PRODUCT_CREATED: 'Ürün kaydı', PRODUCT_REVISION_CREATED: 'Revizyon kaydı', PRODUCT_REVISION_RELEASED: 'Revizyon yürürlüğe alındı', BOM_LINE_ADDED: 'BOM satırı eklendi',
    WO_CREATED: 'İş emri', NCR_OPENED: 'Uygunsuzluk (NCR)', HOLD_OPENED: 'Kalite HOLD', ORDER_ITEM: 'Sipariş kalemi', QUOTE_LINE: 'Teklif satırı' };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const n = (v) => (v === null || v === undefined ? NA : v.toLocaleString('tr-TR', { maximumFractionDigits: 3 }));
const num = (s) => { const t = s.trim().replace(',', '.'); if (t === '')
    return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const val = (x) => x.value;
const when = (s) => (s ? s.slice(0, 16).replace('T', ' ') : '—');
export async function renderProductMasterScreen(container, api, state = {}) {
    const go = (s) => renderProductMasterScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'pm', 'data-testid': 'pm-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'info'}`, 'data-testid': 'pm-banner', 'data-kind': state.banner.kind }, state.banner.text) : null;
    const fail = (e) => {
        const text = errorText(e);
        const root = container.querySelector('[data-testid="pm-root"]');
        let b = container.querySelector('[data-testid="pm-banner"]');
        if (!b && root) {
            b = h('div', { class: 'card bad', 'data-testid': 'pm-banner', 'data-kind': 'error' }, text);
            const first = [...root.children].find((c) => c.tagName !== 'STYLE');
            root.insertBefore(b, first?.nextSibling ?? null);
        }
        else if (b) {
            b.textContent = text;
            b.className = 'card bad';
            b.setAttribute('data-kind', 'error');
        }
        try {
            b?.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    const svgNode = (svg, testid, size) => { const b = h('div', { 'data-testid': testid, style: `width:${size}px;height:${size}px` }); b.innerHTML = svg; return b; };
    const chk = (c) => h('div', { class: 'row', 'data-testid': 'pm-check', 'data-code': c.code, 'data-status': c.status, style: 'margin:3px 0' }, h('span', { class: `chip ${CHK[c.status][1]}` }, CHK[c.status][0]), h('b', {}, c.label), c.detail ? h('span', { class: 'mut' }, c.detail) : null);
    if (state.product)
        return renderCard(state.product);
    return renderHome();
    async function renderHome() {
        let rows;
        let customers = [];
        try {
            rows = await api.search(state.q ?? '', state.family);
        }
        catch (e) {
            shell(h('h1', {}, 'Ürün Master'), isSetupPending(e) ? h('div', { class: 'card warn', 'data-testid': 'pm-setup' }, 'Kurulum bekleniyor: Ürün Master için sunucu güncellemesi (0105) henüz uygulanmadı. Mevcut ürünleriniz ve Mühendislik ekranı etkilenmedi.') : h('div', { class: 'card bad', 'data-testid': 'pm-error' }, `Yüklenemedi: ${errorText(e)}`));
            return;
        }
        if (state.creating) {
            try {
                customers = await api.customers();
            }
            catch {
                customers = [];
            }
        }
        const q = h('input', { type: 'text', 'data-testid': 'pm-q', placeholder: 'Ürün kodu, ad, müşteri parça no, aile', value: state.q ?? '' });
        const form = state.creating ? (() => {
            const f = (id, label, ph = '') => [h('label', {}, label), h('input', { type: 'text', 'data-testid': `pm-new-${id}`, placeholder: ph })];
            const cust = h('select', { 'data-testid': 'pm-new-customer' }, h('option', { value: '' }, '— müşteri —'), ...customers.map((c) => h('option', { value: c.id }, `${c.name} (${c.code})`)));
            const nodes = { code: f('code', 'Ürün kodu *'), name: f('name', 'Ad *'), part: f('part', 'Müşteri parça no'), family: f('family', 'Ürün ailesi'), material: f('material', 'Malzeme'), desc: f('desc', 'Açıklama') };
            const get = (k) => val(nodes[k][1]);
            return h('div', { class: 'card', 'data-testid': 'pm-new' }, h('h2', {}, 'Yeni ürün'), h('div', { class: 'grid' }, h('div', {}, ...nodes.code), h('div', {}, ...nodes.name), h('div', {}, h('label', {}, 'Müşteri'), cust), h('div', {}, ...nodes.part), h('div', {}, ...nodes.family), h('div', {}, ...nodes.material), h('div', {}, ...nodes.desc)), h('div', { class: 'mut' }, 'Aynı ürün kodu veya aynı müşteri parça numarası ikinci kez açılamaz.'), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pm-new-save', onClick: async () => {
                    try {
                        const r = await api.create({ code: get('code'), name: get('name'), customerId: val(cust) || null, customerPartNo: get('part'), family: get('family'), description: get('desc'), material: get('material') }, newId());
                        await go({ product: r.id, banner: { kind: 'info', text: `Ürün oluşturuldu: ${r.code}` } });
                    }
                    catch (e) {
                        fail(e);
                    }
                } }, 'Ürünü oluştur'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ q: state.q }) }, 'Vazgeç')));
        })() : null;
        shell(h('h1', {}, 'Ürün Master'), banner, h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:220px' }, q), h('button', { type: 'button', class: 'primary', 'data-testid': 'pm-search', onClick: () => void go({ q: val(q) }) }, 'Ara'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'pm-new-btn', onClick: () => void go({ q: val(q), creating: true }) }, '+ Yeni ürün'))), form, h('div', { class: 'card' }, h('div', { class: 'tw' }, h('table', { 'data-testid': 'pm-list' }, h('tr', {}, ...['Kod', 'Ad', 'Aile', 'Müşteri parça no', 'Güncel rev.', 'Durum', ''].map((x) => h('th', {}, x))), ...rows.map((r) => h('tr', { 'data-testid': 'pm-row', 'data-product': r.id, style: 'cursor:pointer', onClick: () => void go({ product: r.id }) }, h('td', {}, h('b', {}, r.code)), h('td', {}, r.name), h('td', {}, r.family ?? '—'), h('td', {}, r.customerPartNo ?? '—'), h('td', {}, r.currentRevision ?? 'yok'), h('td', {}, h('span', { class: `chip ${r.status === 'ACTIVE' ? 'ok' : ''}` }, r.status === 'ACTIVE' ? 'Aktif' : 'Pasif'), r.pendingApproval ? h('span', { class: 'chip warn' }, ' onay bekliyor') : r.hasDraft ? h('span', { class: 'chip info' }, ' taslak rev.') : null), h('td', {}, 'Aç')))), !rows.length ? h('div', { class: 'mut', 'data-testid': 'pm-empty' }, 'Ürün bulunamadı.') : null)), h('a', { href: '#/muhendislik' }, 'BOM / CAM / rota düzenleme: Mühendislik'));
    }
    async function renderCard(id) {
        const tab = state.tab ?? 'genel';
        let c;
        try {
            c = await api.card(id);
        }
        catch (e) {
            shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({}) }, '← Ürünler'), h('div', { class: 'card bad', 'data-testid': 'pm-error' }, errorText(e)));
            return;
        }
        const p = c.product;
        const cur = c.revisions.find((r) => r.id === c.currentRevisionId) ?? null;
        const revId = state.rev ?? cur?.id ?? c.revisions[c.revisions.length - 1]?.id ?? null;
        const tabs = [['genel', 'Genel'], ['revizyon', 'Revizyonlar'], ['hazirlik', 'Hazırlık'], ['gecmis', 'Geçmiş'], ['sure', 'Süre analizi'], ['dna', 'Digital DNA / Pasaport'], ['bom', 'BOM taslağı']];
        const body = await tabBody(c, tab, revId);
        shell(h('button', { type: 'button', class: 'ghost', 'data-testid': 'pm-back', onClick: () => void go({}) }, '← Ürünler'), h('a', { href: `#/urun-calisma?urun=${id}`, 'data-testid': 'pm-open-workspace', style: 'margin-left:10px;color:#93c5fd' }, 'Çalışma alanı: rota, operasyon, süre standardı'), banner, h('div', { class: 'card', 'data-testid': 'pm-head' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('h1', { 'data-testid': 'pm-title' }, `${p.code} · ${p.name}`), h('div', { class: 'mut' }, `Güncel revizyon: ${cur?.revision ?? 'yok'}${p.family ? ` · Aile: ${p.family}` : ''}${p.material ? ` · Malzeme: ${p.material}` : ''}`)), h('span', { class: `chip ${p.status === 'ACTIVE' ? 'ok' : ''}` }, p.status === 'ACTIVE' ? 'Aktif' : 'Pasif'))), h('div', { class: 'tabs', 'data-testid': 'pm-tabs' }, ...tabs.map(([k, label]) => h('button', { type: 'button', class: `tab ${k === tab ? 'on' : ''}`, 'data-testid': `pm-tab-${k}`, onClick: () => void go({ product: id, tab: k, rev: state.rev }) }, label))), body);
    }
    async function tabBody(c, tab, revIdIn) {
        let revId = revIdIn;
        const id = c.product.id;
        const p = c.product;
        const guard = async (fn) => { try {
            return await fn();
        }
        catch (e) {
            return h('div', { class: 'card bad', 'data-testid': 'pm-tab-error' }, errorText(e));
        } };
        const revPick = (t, cur) => h('div', { class: 'row', 'data-testid': 'pm-revpick' }, ...c.revisions.map((r) => h('button', { type: 'button', class: `tab ${r.id === cur ? 'on' : ''}`, 'data-testid': `pm-pick-${t}-${r.revision}`, onClick: () => void go({ product: id, tab: t, rev: r.id }) }, `${r.revision} · ${REV_TR[r.status] ?? r.status}`)));
        if (tab === 'genel')
            return guard(async () => {
                const customers = c.canEdit ? await api.customers().catch(() => []) : [];
                const name = h('input', { type: 'text', 'data-testid': 'pm-f-name', value: p.name });
                const part = h('input', { type: 'text', 'data-testid': 'pm-f-part', value: p.customerPartNo ?? '' });
                const fam = h('input', { type: 'text', 'data-testid': 'pm-f-family', value: p.family ?? '' });
                const mat = h('input', { type: 'text', 'data-testid': 'pm-f-material', value: p.material ?? '' });
                const desc = h('input', { type: 'text', 'data-testid': 'pm-f-desc', value: p.description ?? '' });
                const why = h('input', { type: 'text', 'data-testid': 'pm-f-why', placeholder: 'Değişiklik gerekçesi (en az 5 karakter)' });
                const cust = h('select', { 'data-testid': 'pm-f-customer' }, h('option', { value: '' }, '— yok —'), ...customers.map((x) => h('option', { value: x.id, selected: x.id === p.customerId }, `${x.name} (${x.code})`)));
                const status = h('select', { 'data-testid': 'pm-f-status' }, h('option', { value: 'ACTIVE', selected: p.status === 'ACTIVE' }, 'Aktif'), h('option', { value: 'PASSIVE', selected: p.status === 'PASSIVE' }, 'Pasif'));
                const ro = (l, v) => h('div', {}, h('label', {}, l), h('div', {}, v ?? '—'));
                if (!c.canEdit)
                    return h('div', { class: 'card', 'data-testid': 'pm-info' }, h('div', { class: 'grid' }, ro('Ürün kodu', p.code), ro('Ad', p.name), ro('Aile', p.family), ro('Malzeme', p.material), ro('Açıklama', p.description), ro('Müşteri', p.customerName), ro('Müşteri parça no', p.customerPartNo)), h('div', { class: 'mut' }, 'Düzenleme yetkiniz yok (BOM_RELEASE).'));
                return h('div', { class: 'card', 'data-testid': 'pm-info' }, h('div', { class: 'grid' }, ro('Ürün kodu (değişmez)', p.code), h('div', {}, h('label', {}, 'Ad'), name), h('div', {}, h('label', {}, 'Müşteri'), cust), h('div', {}, h('label', {}, 'Müşteri parça no'), part), h('div', {}, h('label', {}, 'Aile'), fam), h('div', {}, h('label', {}, 'Malzeme'), mat), h('div', {}, h('label', {}, 'Açıklama'), desc), h('div', {}, h('label', {}, 'Durum'), status)), h('div', { style: 'margin-top:8px' }, why), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pm-f-save', onClick: async () => {
                        try {
                            const r = await api.update(id, { name: val(name), customerId: val(cust) || null, customerPartNo: val(part), family: val(fam), description: val(desc), material: val(mat), status: val(status) }, val(why));
                            await go({ product: id, banner: { kind: 'info', text: r.changed ? 'Kaydedildi.' : 'Değişiklik yok.' } });
                        }
                        catch (e) {
                            fail(e);
                        }
                    } }, 'Kaydet')));
            });
        if (tab === 'revizyon')
            return guard(async () => {
                const reqs = await api.requests(id);
                const a = state.cmpA ?? c.revisions[0]?.id ?? null;
                const b = state.cmpB ?? c.revisions[c.revisions.length - 1]?.id ?? null;
                const cmp = a && b && a !== b ? await api.compare(a, b).catch(() => null) : null;
                const newRev = h('input', { type: 'text', 'data-testid': 'pm-newrev', placeholder: 'Yeni revizyon (örn. B)' });
                const copy = h('select', { 'data-testid': 'pm-copy' }, h('option', { value: '' }, 'BOM kopyalama'), ...c.revisions.map((r) => h('option', { value: r.id }, `${r.revision} BOM'unu kopyala`)));
                const note = h('input', { type: 'text', 'data-testid': 'pm-note', placeholder: 'Değişiklik notu (onay için, en az 5 karakter)' });
                const sel = (cur, key, tid) => h('select', { 'data-testid': tid, onChange: (ev) => void go({ product: id, tab: 'revizyon', cmpA: key === 'cmpA' ? ev.target.value : a, cmpB: key === 'cmpB' ? ev.target.value : b }) }, ...c.revisions.map((r) => h('option', { value: r.id, selected: r.id === cur }, r.revision)));
                const dlist = (x) => x.length ? x.map((y) => `${y.materialCode} (${n(y.qtyPerUnit)})`).join(', ') : '—';
                return h('div', {}, h('div', { class: 'card', 'data-testid': 'pm-revs' }, h('h2', {}, 'Revizyonlar'), h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['Rev.', 'Durum', 'BOM', 'Operasyon', 'Belge', 'Yürürlük', ''].map((x) => h('th', {}, x))), ...c.revisions.map((r) => h('tr', { 'data-testid': 'pm-rev-row', 'data-rev': r.id }, h('td', {}, h('b', {}, r.revision)), h('td', {}, h('span', { class: `chip ${revChip(r.status)}` }, REV_TR[r.status] ?? r.status), r.pendingRequest ? h('span', { class: 'chip warn' }, ' onay bekliyor') : null), h('td', {}, String(r.bomLines)), h('td', {}, String(r.operations)), h('td', {}, String(r.documents)), h('td', {}, when(r.releasedAt)), h('td', {}, r.status === 'DRAFT' && !r.pendingRequest && c.canEdit ? h('button', { type: 'button', class: 'primary', 'data-testid': `pm-submit-${r.revision}`, onClick: async () => { try {
                        await api.submit(r.id, val(note), newId());
                        await go({ product: id, tab: 'revizyon', banner: { kind: 'info', text: 'Onaya gönderildi.' } });
                    }
                    catch (e) {
                        fail(e);
                    } } }, 'Onaya gönder') : null))))), c.canEdit ? h('div', {}, h('div', { class: 'mut', style: 'margin-top:6px' }, 'Yürürlükteki bir revizyonun değişimi yalnız onaylı talep ile yapılır; eski revizyonla açılan işler otomatik taşınmaz.'), h('div', { style: 'margin-top:6px' }, note), h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { style: 'width:170px' }, newRev), h('div', { style: 'width:190px' }, copy), h('button', { type: 'button', class: 'ghost', 'data-testid': 'pm-newrev-go', onClick: async () => {
                        try {
                            await api.createRevision(id, val(newRev), val(copy) || null);
                            await go({ product: id, tab: 'revizyon', banner: { kind: 'info', text: 'Taslak revizyon oluşturuldu.' } });
                        }
                        catch (e) {
                            fail(e);
                        }
                    } }, 'Taslak revizyon aç'))) : null), h('div', { class: 'card', 'data-testid': 'pm-requests' }, h('h2', {}, 'Yayım talepleri'), ...(reqs.length ? reqs.map((r) => {
                    const why = h('input', { type: 'text', 'data-testid': `pm-why-${r.revision}`, placeholder: 'Karar gerekçesi (en az 5; kendi talebini onaylama ADMIN + 10 karakter)' });
                    return h('div', { class: 'card', 'data-testid': 'pm-request', 'data-status': r.status }, h('div', { class: 'row' }, h('b', {}, `Rev ${r.revision}`), h('span', { class: `chip ${r.status === 'APPROVED' ? 'ok' : r.status === 'REJECTED' ? 'bad' : 'warn'}` }, r.status === 'APPROVED' ? 'Onaylandı' : r.status === 'REJECTED' ? 'Reddedildi' : 'Onay bekliyor'), r.selfApproved ? h('span', { class: 'chip warn' }, 'kendi onayı') : null), h('div', { class: 'mut' }, `${r.requestedBy} · ${when(r.requestedAt)} · ${r.changeNote}${r.decisionReason ? ` · karar: ${r.decisionReason}` : ''}`), r.status === 'PENDING' && c.canApprove ? h('div', {}, h('div', { style: 'margin-top:6px' }, why), h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'primary', 'data-testid': `pm-approve-${r.revision}`, onClick: async () => { try {
                            const d = await api.decide(r.id, true, val(why));
                            const i = d.impact;
                            await go({ product: id, tab: 'hazirlik', banner: { kind: 'info', text: `Revizyon yürürlüğe alındı.${i ? ` Etkilenen açık iş emri: ${n(i.workOrdersOpen)}, sipariş kalemi: ${n(i.orderItemsOpen)}, teklif satırı: ${n(i.quoteLinesOpen)} — eski işler taşınmadı.` : ''}` } });
                        }
                        catch (e) {
                            fail(e);
                        } } }, 'Onayla ve yürürlüğe al'), h('button', { type: 'button', class: 'danger', 'data-testid': `pm-reject-${r.revision}`, onClick: async () => { try {
                            await api.decide(r.id, false, val(why));
                            await go({ product: id, tab: 'revizyon', banner: { kind: 'info', text: 'Talep reddedildi.' } });
                        }
                        catch (e) {
                            fail(e);
                        } } }, 'Reddet'))) : null);
                }) : [h('div', { class: 'mut' }, 'Henüz talep yok.')])), c.revisions.length > 1 ? h('div', { class: 'card', 'data-testid': 'pm-compare' }, h('h2', {}, 'Revizyon karşılaştırma'), h('div', { class: 'row' }, sel(a, 'cmpA', 'pm-cmp-a'), '→', sel(b, 'cmpB', 'pm-cmp-b')), cmp ? h('div', { class: 'mut', style: 'margin-top:8px;white-space:normal' }, h('div', { 'data-testid': 'pm-cmp-added' }, `Eklenen malzeme: ${dlist(cmp.bom.added)}`), h('div', { 'data-testid': 'pm-cmp-removed' }, `Çıkarılan malzeme: ${dlist(cmp.bom.removed)}`), h('div', { 'data-testid': 'pm-cmp-changed' }, `Miktarı değişen: ${cmp.bom.changed.length ? cmp.bom.changed.map((y) => `${y.materialCode} ${n(y.qtyFrom)}→${n(y.qtyTo)}`).join(', ') : '—'}`), h('div', {}, `Rota: ${cmp.routing.aOps} → ${cmp.routing.bOps} operasyon · ${cmp.routing.changed.length} fark`), h('div', {}, `CAM: ${cmp.cam.a.join(', ') || '—'} → ${cmp.cam.b.join(', ') || '—'}`), h('div', {}, `Belge türleri: ${cmp.documents.a.join(', ') || '—'} → ${cmp.documents.b.join(', ') || '—'}`)) : h('div', { class: 'mut' }, 'Farklı iki revizyon seçin.')) : null);
            });
        if (tab === 'hazirlik')
            return guard(async () => {
                const ow = await api.openWork(id);
                const rd = revId ? await api.readiness(revId) : null;
                const stTr = { OLD_REVISION: ['ESKİ REVİZYON', 'bad'], UNBOUND: ['revizyon bağlı değil', 'warn'], CURRENT: ['güncel', 'ok'] };
                return h('div', {}, revPick('hazirlik', revId), h('div', { class: 'card', 'data-testid': 'pm-ready' }, h('h2', {}, `Hazırlık kontrolü${rd ? ` · ${c.revisions.find((r) => r.id === revId)?.revision ?? ''}` : ''}`), rd ? h('div', {}, h('span', { class: `chip ${rd.overall === 'READY' ? 'ok' : 'bad'}`, 'data-testid': 'pm-ready-overall' }, rd.overall === 'READY' ? 'HAZIR' : 'HAZIR DEĞİL'), ...rd.checks.map(chk)) : h('div', { class: 'mut' }, 'Revizyon yok.'), h('div', { class: 'mut' }, 'Not: başlatma kapısına (iş başlatma engeli) bağlantı bu pakette yalnız gösterimdir; mevcut başlatma kuralları değişmedi.')), h('div', { class: 'card', 'data-testid': 'pm-openwork' }, h('h2', {}, 'Açık işler ve revizyon durumu'), ow.pendingRequestId ? h('div', { class: 'chip warn' }, 'Bu ürün için revizyon değişikliği onay bekliyor') : null, h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['İş emri', 'Durum', 'Adet', 'Revizyon', 'Hazırlık', 'Ayrıntı'].map((x) => h('th', {}, x))), ...ow.workOrders.map((w) => h('tr', { 'data-testid': 'pm-wo', 'data-overall': w.check.overall }, h('td', {}, w.id.slice(0, 8)), h('td', {}, w.status), h('td', {}, n(w.qtyPlanned)), h('td', {}, w.revision ?? 'bağlı değil'), h('td', {}, h('span', { class: `chip ${w.check.overall === 'READY' ? 'ok' : 'bad'}` }, w.check.overall === 'READY' ? 'Hazır' : 'Hazır değil')), h('td', { style: 'white-space:normal' }, ...w.check.checks.filter((k) => k.status !== 'OK' && k.status !== 'NA').map((k) => h('div', { 'data-testid': 'pm-wo-issue' }, `${k.label}: ${k.detail ?? ''}`)))))), !ow.workOrders.length ? h('div', { class: 'mut' }, 'Açık iş emri yok.') : null), ow.orderItems ? h('div', {}, h('h2', { style: 'margin-top:10px' }, 'Sipariş kalemleri'), ...ow.orderItems.map((o) => h('div', { class: 'row', 'data-testid': 'pm-oi', 'data-state': o.state }, h('span', {}, `${o.orderNo ?? '—'} / ${o.lineNo ?? '?'} · ${n(o.qty)} adet · rev ${o.revision ?? '—'}`), h('span', { class: `chip ${stTr[o.state][1]}` }, stTr[o.state][0])))) : null, ow.quoteLines ? h('div', {}, h('h2', { style: 'margin-top:10px' }, 'Açık teklif satırları'), ...ow.quoteLines.map((o) => h('div', { class: 'row', 'data-testid': 'pm-ql', 'data-state': o.state }, h('span', {}, `${o.quoteNo} / ${o.lineNo} · rev ${o.revision ?? '—'}`), h('span', { class: `chip ${stTr[o.state][1]}` }, stTr[o.state][0])))) : null));
            });
        if (tab === 'gecmis')
            return guard(async () => {
                const hs = await api.history(id);
                return h('div', { class: 'card', 'data-testid': 'pm-history' }, h('h2', {}, 'Ürün geçmişi'), h('div', { class: 'mut' }, 'Yalnız kaynak kayıtlarda bulunan olaylar gösterilir; fiyat/maliyet içermez.'), ...hs.map((e) => h('div', { class: 'row', 'data-testid': 'pm-ev', 'data-code': e.code, style: 'margin:4px 0;align-items:flex-start' }, h('span', { class: 'mut', style: 'min-width:120px' }, when(e.at)), h('b', {}, EV_TR[e.code] ?? e.code), h('span', { class: 'mut', style: 'white-space:normal' }, [e.detail, e.actor ? `— ${e.actor}` : ''].filter(Boolean).join(' ')), e.before && e.after ? h('span', { class: 'mut', 'data-testid': 'pm-ev-diff', style: 'white-space:normal' }, `önce: ${JSON.stringify(e.before)} → sonra: ${JSON.stringify(e.after)}`) : null)), !hs.length ? h('div', { class: 'mut' }, 'Kayıt yok.') : null);
            });
        if (tab === 'sure')
            return guard(async () => {
                const d = await api.durations(id);
                return h('div', { class: 'card', 'data-testid': 'pm-dur' }, h('h2', {}, `Gerçek süre analizi${d.family ? ` · aile ${d.family}` : ''}`), h('div', { class: 'mut' }, d.basis), ...d.products.map((pr) => h('div', {}, h('b', {}, `${pr.code} ${pr.name}`), h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['Op', 'Ad', 'Tekrar', 'Setup hedef (dk)', 'Setup gerçek (dk)', 'Çevrim hedef (sn)', 'Çevrim gerçek (sn)', 'Son', 'Durum'].map((x) => h('th', {}, x))), ...pr.operations.map((o) => h('tr', { 'data-testid': 'pm-dur-row', 'data-state': o.state }, h('td', {}, String(o.opNo)), h('td', {}, o.name), h('td', {}, String(o.runs)), h('td', {}, n(o.setupTargetMin)), h('td', {}, n(o.setupActualMin)), h('td', {}, n(o.cycleTargetSec)), h('td', {}, n(o.cycleActualSec)), h('td', {}, when(o.lastCompletedAt)), h('td', {}, h('span', { class: `chip ${DUR[o.state][1]}` }, DUR[o.state][0]))))), !pr.operations.length ? h('div', { class: 'mut', 'data-testid': 'pm-dur-nodata' }, 'VERİ YOK — bu ürün için tamamlanmış operasyon kaydı yok.') : null))), h('div', { class: 'card warn', 'data-testid': 'pm-dur-cost' }, `Maliyet / kârlılık: ${d.cost.reason}`));
            });
        if (tab === 'dna')
            return guard(async () => {
                const pp = await api.passport(id, revId);
                const payload = pp.revision ? pp.qr.revision ?? pp.qr.product : pp.qr.product;
                const sheet = h('div', { class: 'pm-print', 'data-testid': 'pm-print' }, h('div', { class: 'hd' }, h('b', {}, 'KURUTLU'), h('span', {}, 'ÜRÜN KÜNYESİ')), h('div', { style: 'display:flex;gap:16px' }, svgNode(qrToSvg(encodeQr(payload, 'M'), 120), 'pm-print-qr', 120), h('div', {}, h('div', { style: 'font-size:20px;font-weight:800' }, pp.product.code), h('div', {}, pp.product.name), h('div', {}, `Revizyon: ${pp.revision?.revision ?? '—'} (${REV_TR[pp.revision?.status ?? ''] ?? '—'})`), h('div', {}, `Aile: ${pp.product.family ?? '—'} · Malzeme: ${pp.product.material ?? '—'}`), pp.product.customerPartNo ? h('div', {}, `Müşteri parça no: ${pp.product.customerPartNo}`) : null, h('div', { style: 'font-size:10px;margin-top:6px' }, payload))), h('table', {}, h('tr', {}, ...['Op', 'Operasyon', 'Setup hedef (dk)', 'Çevrim hedef (sn)', 'Kalite', 'CAM'].map((x) => h('th', {}, x))), ...pp.routing.map((o) => h('tr', {}, h('td', {}, String(o.opNo)), h('td', {}, o.name), h('td', {}, n(o.setupMinutesTarget)), h('td', {}, n(o.cycleSecondsTarget)), h('td', {}, o.qcRequired ? 'Kontrol' : '—'), h('td', {}, o.camProgram ?? '—')))), h('div', { style: 'font-size:10px;margin-top:10px' }, `QR yalnız görüntüleme açar. Basım: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`));
                return h('div', {}, h('div', { class: 'card', 'data-testid': 'pm-dna' }, h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, h('div', { style: 'flex:1 1 200px' }, h('h2', {}, `Digital DNA · ${pp.product.code} ${pp.revision?.revision ?? ''}`), h('div', { class: 'row' }, ...pp.revisions.map((r) => h('button', { type: 'button', class: `tab ${r.id === pp.revision?.id ? 'on' : ''}`, 'data-testid': `pm-dna-rev-${r.revision}`, onClick: () => void go({ product: id, tab: 'dna', rev: r.id }) }, `${r.revision} · ${REV_TR[r.status] ?? r.status}`))), h('div', { class: 'mut', style: 'margin-top:6px', 'data-testid': 'pm-qr-note' }, pp.qr.note), h('div', { class: 'mut', 'data-testid': 'pm-qr-payload' }, payload)), h('div', { style: 'background:#fff;padding:6px;border-radius:8px;flex:0 0 auto' }, svgNode(qrToSvg(encodeQr(payload, 'M'), 120), 'pm-qr', 120))), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'pm-print-btn', onClick: () => { try {
                        window.print();
                    }
                    catch { /* headless */ } } }, 'Künyeyi yazdır')), pp.readiness ? h('div', { style: 'margin-top:8px' }, h('span', { class: `chip ${pp.readiness.overall === 'READY' ? 'ok' : 'bad'}` }, pp.readiness.overall === 'READY' ? 'HAZIR' : 'HAZIR DEĞİL'), ...pp.readiness.checks.map(chk)) : null, h('div', { class: 'mut', style: 'margin-top:6px' }, `Ortak QR/kimlik standardı (KMI-081): ${pp.integration.qrStandard} — ${pp.integration.qrNote}. ${pp.integration.documents}.`)), h('div', { class: 'card' }, h('h2', {}, 'Malzeme (BOM)'), ...(pp.bom.length ? pp.bom.map((b) => h('div', { 'data-testid': 'pm-dna-bom' }, `${b.materialCode} · ${n(b.qtyPerUnit)} / adet · fire %${n(b.scrapAllowancePct)}`)) : [h('div', { class: 'mut' }, 'BOM yok')]), h('h2', { style: 'margin-top:10px' }, 'Operasyon / rota'), ...(pp.routing.length ? pp.routing.map((o) => h('div', { 'data-testid': 'pm-dna-op' }, `Op ${o.opNo} ${o.name} · setup ${n(o.setupMinutesTarget)} dk · çevrim ${n(o.cycleSecondsTarget)} sn${o.qcRequired ? ' · kontrol' : ''}${o.camProgram ? ` · CAM ${o.camProgram}` : ''}`)) : [h('div', { class: 'mut' }, 'Rota yok')]), h('h2', { style: 'margin-top:10px' }, 'Kalite gereksinimleri (kontrol planı)'), ...(pp.quality.length ? pp.quality.map((q) => h('div', {}, `Op ${q.operationNo} · v${q.version} · ${q.status} · ${q.characteristics} karakteristik`)) : [h('div', { class: 'mut' }, 'Kontrol planı yok')]), h('h2', { style: 'margin-top:10px' }, 'Teknik dokümanlar'), ...(pp.documents.length ? pp.documents.map((d) => h('div', { 'data-testid': 'pm-dna-doc', 'data-control': d.controlState ?? '' }, `${d.docNo ? `${d.docNo} · ` : ''}${d.docType} · ${d.title}${d.controlState ? (d.controlState === 'EFFECTIVE' ? ` · GEÇERLİ v${d.effectiveVersionNo ?? d.versionNo}` : ` · GEÇERLİ SÜRÜM YOK (${d.controlState === 'DRAFT' ? 'taslak' : d.controlState === 'IN_REVIEW' ? 'onay bekliyor' : d.controlState === 'APPROVED' ? 'onaylı, yürürlükte değil' : 'geçersiz'})`) : (d.versionNo ? ` · v${d.versionNo}` : '')}${d.latestVersionNo && d.effectiveVersionNo && d.latestVersionNo > d.effectiveVersionNo ? ` · daha yeni taslak v${d.latestVersionNo}` : ''}${d.fileName ? ` · ${d.fileName}` : ''}`)) : [h('div', { class: 'mut' }, 'Bağlı doküman yok')]), h('div', {}, h('a', { href: `#/dokumanlar?tip=PRODUCT_REVISION&id=${pp.revision?.id ?? ''}` }, 'Dokümanlara git'), ' · ', h('a', { href: `#/dokuman-kontrol?ara=${encodeURIComponent(pp.product.code)}`, 'data-testid': 'pm-dna-doc-control' }, 'Doküman Kontrol (sürüm · onay · geçerlilik)')), h('h2', { style: 'margin-top:10px' }, 'Üretim geçmişi'), pp.production ? h('div', {}, `${pp.production.workOrders} iş emri · ${pp.production.completed} tamamlandı · iyi ${n(pp.production.good)} · fire ${n(pp.production.scrap)}`) : h('div', { class: 'mut' }, NA)), sheet);
            });
        if (tab === 'bom')
            return guard(async () => {
                const bomRev = state.rev ?? c.revisions.find((r) => r.status === 'DRAFT')?.id ?? revId;
                if (!bomRev)
                    return h('div', { class: 'card' }, 'Revizyon yok.');
                revId = bomRev;
                const rid = bomRev;
                const dr = await api.bomDrafts(rid);
                const rev = c.revisions.find((r) => r.id === rid);
                const prov = h('input', { type: 'text', 'data-testid': 'pm-bd-prov', placeholder: 'AI/harici araç adı (AI önerisi ise zorunlu)' });
                const text = h('textarea', { 'data-testid': 'pm-bd-lines', rows: 4, placeholder: 'Her satıra: malzeme;miktar;fire%;gerekçe', style: 'min-height:100px;padding:8px' });
                const kind = h('select', { 'data-testid': 'pm-bd-origin' }, h('option', { value: 'MANUAL' }, 'Elle girilen taslak'), h('option', { value: 'AI_EXTERNAL' }, 'Harici AI aracından alınan öneri'));
                return h('div', {}, revPick('bom', rid), h('div', { class: `card ${dr.service.available ? 'info' : 'warn'}`, 'data-testid': 'pm-ai-status' }, h('b', {}, dr.service.available ? 'AI servisi bağlı' : 'AI servisi bağlı DEĞİL'), h('div', { class: 'mut' }, dr.service.note)), rev?.status === 'DRAFT' && c.canEdit ? h('div', { class: 'card' }, h('h2', {}, `Yeni BOM taslağı → Rev ${rev.revision}`), h('div', { class: 'grid' }, h('div', {}, kind), h('div', {}, prov)), h('div', { style: 'margin-top:8px' }, text), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pm-bd-create', onClick: async () => {
                        try {
                            const lines = val(text).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [m, q, s, r] = l.split(';').map((x) => x.trim()); const qty = num(q ?? ''); if (!m || qty === null)
                                throw new Error('INVALID_LINE'); const sc = num(s ?? ''); return { material_code: m, qty_per_unit: qty, scrap_allowance_pct: sc ?? 0, rationale: r ?? '' }; });
                            await api.bomDraftCreate(rid, val(kind), val(prov), lines, newId());
                            await go({ product: id, tab: 'bom', rev: rid, banner: { kind: 'info', text: 'Taslak kaydedildi. Onaylanana kadar BOM’a girmez.' } });
                        }
                        catch (e) {
                            fail(e);
                        }
                    } }, 'Taslak olarak kaydet'))) : h('div', { class: 'card mut' }, 'BOM taslağı yalnız TASLAK revizyona eklenir.'), ...dr.drafts.map((d) => {
                    const why = h('input', { type: 'text', 'data-testid': 'pm-bd-why', placeholder: 'İnceleme gerekçesi (en az 5)' });
                    return h('div', { class: 'card', 'data-testid': 'pm-bd', 'data-status': d.status, 'data-origin': d.origin }, h('div', { class: 'row' }, h('span', { class: `chip ${d.origin === 'AI_EXTERNAL' ? 'warn' : 'info'}` }, d.label), h('span', { class: 'chip' }, d.status), d.provenance ? h('span', { class: 'mut' }, `kaynak: ${d.provenance}`) : null), ...d.lines.map((l) => h('div', { 'data-testid': 'pm-bd-line' }, `${l.materialCode} · ${n(l.qtyPerUnit)} · fire %${n(l.scrapAllowancePct)}${l.rationale ? ` · ${l.rationale}` : ''}`)), d.reviewNote ? h('div', { class: 'mut' }, `İnceleme: ${d.reviewNote}`) : null, d.status === 'PROPOSED' && c.canApprove ? h('div', {}, h('div', { style: 'margin-top:6px' }, why), h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pm-bd-approve', onClick: async () => { try {
                            await api.bomDraftReview(d.id, true, val(why));
                            await go({ product: id, tab: 'bom', rev: rid, banner: { kind: 'info', text: 'Taslak onaylandı; henüz BOM’a uygulanmadı.' } });
                        }
                        catch (e) {
                            fail(e);
                        } } }, 'Onayla'), h('button', { type: 'button', class: 'danger', 'data-testid': 'pm-bd-reject', onClick: async () => { try {
                            await api.bomDraftReview(d.id, false, val(why));
                            await go({ product: id, tab: 'bom', rev: rid, banner: { kind: 'info', text: 'Taslak reddedildi.' } });
                        }
                        catch (e) {
                            fail(e);
                        } } }, 'Reddet'))) : null, d.status === 'APPROVED' && c.canEdit ? h('button', { type: 'button', class: 'primary', 'data-testid': 'pm-bd-apply', onClick: async () => { try {
                            const r = await api.bomDraftApply(d.id);
                            await go({ product: id, tab: 'bom', rev: rid, banner: { kind: 'info', text: `BOM’a uygulandı: ${r.added} satır eklendi, ${r.skippedExisting} zaten vardı. Revizyon hâlâ taslak; yayım ayrıca onay ister.` } });
                        }
                        catch (e) {
                            fail(e);
                        } } }, 'Taslak revizyonun BOM’una uygula') : null);
                }));
            });
        return h('div', {});
    }
}
