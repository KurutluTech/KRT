// KMI NEXT — Ürün Mühendisliği: ürün → revizyon → ürün reçetesi (BOM) → CAM programı → takım listesi → çevrim süresi → yayın.
// Bu zincir olmadan bir iş emri "malzeme / takım gereksinimi bilinmiyor" diye başlatılamaz (güvenli varsayılan); yani gerçek kullanımın ilk
// adımıdır. Yayınlanan revizyon / program DEĞİŞTİRİLEMEZ (sunucu kilidi); değişiklik yeni revizyonla yapılır. Yetki: BOM_RELEASE (sunucuda).
import { chooseProduct, rememberProduct } from '../lastProduct.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `
.eng{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;padding:16px;max-width:1240px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.eng *{box-sizing:border-box}
.eng button{min-height:36px;font-size:13px;font-weight:700;border-radius:10px;border:0;padding:6px 14px;cursor:pointer;line-height:1.25;max-width:100%}
.eng button:disabled{background:#273244;color:#8b99ad;cursor:not-allowed}
.eng input,.eng select{min-height:38px;font-size:14px;font-family:inherit;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;width:100%;min-width:0}
.eng input::placeholder{color:#7b8aa0}
.eng .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:16px;margin:12px 0;min-width:0;overflow-wrap:anywhere}
.eng .card .card{background:#0b1220;border-radius:12px;padding:12px}
.eng .card.bad{border-color:#b91c1c;background:rgba(127,29,29,.3);color:#fecaca}.eng .card.ok{border-color:#15803d;background:rgba(20,83,45,.3);color:#bbf7d0}
.eng .chip{display:inline-flex;align-items:center;padding:1px 9px;border-radius:999px;font-weight:700;font-size:11px;line-height:1.7;margin:2px 4px 2px 0;white-space:normal}
.eng .ok{background:#14532d;color:#bbf7d0}.eng .warn{background:#78350f;color:#fde68a}.eng .bad{background:#7f1d1d;color:#fecaca}.eng .info{background:#1e3a8a;color:#dbeafe}
.eng .card.ok,.eng .card.bad{background:rgba(2,6,23,.4)}
.eng .primary{background:#1d4ed8;color:#fff}.eng .primary:hover{background:#2563eb}.eng .ghost{background:#1e293b;color:#e2e8f0}.eng .ghost:hover{background:#273449}
.eng .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.eng .grid{display:grid;gap:8px 12px;margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));align-items:center}
.eng h1{color:#fff;font-size:18px;line-height:1.3;margin:0 0 4px}.eng h2{font-size:15px;margin:16px 0 6px;color:#fff}.eng h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin:14px 0 6px;color:#94a3b8}.eng .note{color:#94a3b8;font-size:12px;line-height:1.45}
.eng table{width:100%;border-collapse:collapse;font-size:13px}.eng td,.eng th{padding:6px 4px;border-bottom:1px solid #1e293b;text-align:left}
.eng a{color:#93c5fd}.eng summary:focus-visible,.eng button:focus-visible,.eng input:focus-visible,.eng select:focus-visible{outline:3px solid #67e8f9;outline-offset:2px}
@media (max-width:1100px){.eng button{min-height:44px}.eng input,.eng select{min-height:44px;font-size:16px}}
`;
const ST_TR = { DRAFT: 'TASLAK', RELEASED: 'YAYINDA', OBSOLETE: 'ESKİ' };
const num = (s) => Number(s.replace(',', '.'));
export async function renderEngineeringScreen(container, api, state = {}) {
    const go = (s) => renderEngineeringScreen(container, api, { ...(state.embed ? { embed: state.embed } : {}), ...(state.embedBom ? { embedBom: state.embedBom } : {}), ...s });
    let data;
    try {
        data = await api.load();
    }
    catch (e) {
        mount(container, h('div', { class: 'eng', 'data-testid': 'eng-root' }, h('style', {}, CSS), h('div', { class: 'card bad', 'data-testid': 'eng-error' }, `Yüklenemedi: ${errorText(e)}`)));
        return;
    }
    // product to show: explicit (link/previous action) → last viewed → the only product → none ("ürün seçin")
    if (state.product === undefined)
        state = { ...state, product: chooseProduct(data.products.map((p) => p.id), null) };
    else if (state.product)
        rememberProduct(state.product);
    let busy = false;
    const act = async (fn, ok) => {
        if (busy)
            return;
        busy = true;
        container.querySelectorAll('.eng button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ banner: { kind: 'info', text: ok }, product: state.product });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) }, product: state.product });
        }
    };
    const fail = (text) => void go({ banner: { kind: 'error', text }, product: state.product });
    const prod = data.products.find((p) => p.id === state.product);
    const pCode = h('input', { type: 'text', 'data-testid': 'eng-new-code', placeholder: 'Ürün kodu' });
    const pName = h('input', { type: 'text', 'data-testid': 'eng-new-name', placeholder: 'Ürün adı' });
    const revisionBlock = (r) => {
        const lines = data.bom.filter((b) => b.productRevisionId === r.id);
        const programs = data.programs.filter((c) => c.productRevisionId === r.id);
        const mat = h('input', { type: 'text', 'data-testid': 'eng-bom-material', placeholder: 'Malzeme kodu (örn. AL6061-40)' });
        const qty = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'eng-bom-qty', placeholder: 'Birim başına miktar' });
        const scrap = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'eng-bom-scrap', placeholder: 'Fire payı % (isteğe bağlı)' });
        const pNo = h('input', { type: 'text', 'data-testid': 'eng-prog-no', placeholder: 'Program no' });
        const pRev = h('input', { type: 'text', 'data-testid': 'eng-prog-rev', placeholder: 'Program rev. (A)' });
        return h('div', { class: 'card', 'data-testid': 'eng-revision', 'data-revision': r.revision, 'data-status': r.status }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:15px;color:#fff' }, `Revizyon ${r.revision}`), h('span', { class: `chip ${r.status === 'RELEASED' ? 'ok' : r.status === 'DRAFT' ? 'warn' : 'info'}`, 'data-testid': 'eng-rev-status' }, ST_TR[r.status])), h('h3', {}, 'Ürün reçetesi (BOM)'), state.embedBom ? h('div', { 'data-testid': 'eng-bom-host', 'data-rev': r.id }) : lines.length
            ? h('table', { 'data-testid': 'eng-bom' }, ...lines.map((l) => h('tr', { 'data-testid': 'eng-bom-line' }, h('td', {}, l.materialCode), h('td', {}, `${l.qtyPerUnit} / adet`), h('td', {}, l.scrapAllowancePct ? `fire %${l.scrapAllowancePct}` : ''))))
            : h('div', { class: 'chip warn', 'data-testid': 'eng-bom-empty' }, 'Reçete boş — iş emri malzeme gereksinimini bilemez'), r.status === 'DRAFT'
            ? h('div', { class: 'grid' }, ...(state.embedBom ? [] : [mat, qty, scrap]), ...(state.embedBom ? [] : [h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-bom-add', onClick: () => {
                        if (!mat.value.trim() || !(num(qty.value) > 0))
                            return fail('Malzeme kodu ve sıfırdan büyük miktar zorunlu.');
                        void act(() => api.addBomLine(r.id, mat.value.trim(), num(qty.value), scrap.value.trim() ? num(scrap.value) : 0), 'Reçete satırı eklendi.');
                    } }, 'Reçeteye satır ekle')]), h('button', { type: 'button', class: 'primary', 'data-testid': 'eng-rev-release', onClick: () => {
                    if (!lines.length)
                        return fail('Boş reçeteli revizyon yayınlanamaz.');
                    void act(() => api.releaseRevision(r.id), `Revizyon ${r.revision} yayınlandı; öncekiler ESKİ oldu. Artık değiştirilemez.`);
                } }, `Revizyon ${r.revision} yayınla`))
            : null, h('h3', {}, 'CAM programları'), state.embed ? h('p', { class: 'note', 'data-testid': 'eng-cam-hint' }, 'NC dosyasına bağlı CAM kaydı için aşağıdaki “Operasyonlar ve teknik zincir” bölümünü kullanın (mevcut NC’den oluşturur, çoğaltmaz). Buradaki elle ekleme NC’ye bağlı olmayan, boş bir program kaydı açar.') : null, programs.length ? h('div', {}, ...programs.map((c) => {
            const tools = data.tools.filter((t) => t.camProgramId === c.id);
            const tType = h('input', { type: 'text', 'data-testid': 'eng-tool-type', placeholder: 'Takım tipi (örn. FREZE-D10)' });
            const tQty = h('input', { type: 'text', inputmode: 'numeric', 'data-testid': 'eng-tool-qty', placeholder: 'Adet' });
            const cyc = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'eng-cycle', placeholder: 'İdeal çevrim süresi (sn / adet)', value: c.idealCycleSeconds ? String(c.idealCycleSeconds) : '' });
            return h('div', { class: 'card', 'data-testid': 'eng-program', 'data-program': c.programNo, 'data-status': c.status }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, `${c.programNo} · rev ${c.revision}`), h('span', { class: `chip ${c.status === 'RELEASED' ? 'ok' : 'warn'}` }, ST_TR[c.status])), tools.length ? h('div', {}, ...tools.map((t) => h('span', { class: 'chip info', 'data-testid': 'eng-tool' }, `${t.toolType} × ${t.qty}`))) : h('div', { class: 'chip warn', 'data-testid': 'eng-tools-empty' }, 'Takım listesi boş'), h('div', { class: 'note' }, c.idealCycleSeconds ? `İdeal çevrim ${c.idealCycleSeconds} sn` : 'İdeal çevrim süresi yok — OEE performansı “bilinmiyor” kalır'), c.status === 'DRAFT'
                ? h('div', { class: 'grid' }, tType, tQty, h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-tool-add', onClick: () => {
                        const q = Number(tQty.value);
                        if (!tType.value.trim() || !(Number.isInteger(q) && q > 0))
                            return fail('Takım tipi ve tam sayı adet zorunlu.');
                        void act(() => api.addTool(c.id, tType.value.trim(), q), 'Takım eklendi.');
                    } }, 'Takım ekle'), h('button', { type: 'button', class: 'primary', 'data-testid': 'eng-prog-release', onClick: () => {
                        if (!tools.length)
                            return fail('Takımsız program yayınlanamaz.');
                        void act(() => api.releaseProgram(c.id), `Program ${c.programNo} yayınlandı. Artık değiştirilemez.`);
                    } }, 'Programı yayınla'))
                : null, h('div', { class: 'grid' }, cyc, h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-cycle-save', onClick: () => {
                    if (!(num(cyc.value) > 0))
                        return fail('Çevrim süresi sıfırdan büyük olmalı.');
                    void act(() => api.setCycleTime(c.id, num(cyc.value)), 'Çevrim süresi kaydedildi.');
                } }, 'Çevrim süresini kaydet')));
        })) : h('div', { class: 'chip warn' }, 'CAM programı yok — iş emri takım gereksinimini bilemez'), h('div', { class: 'grid' }, pNo, pRev, h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-prog-add', onClick: () => {
                if (!pNo.value.trim() || !pRev.value.trim())
                    return fail('Program no ve program revizyonu zorunlu.');
                void act(() => api.createProgram(r.id, pNo.value.trim(), pRev.value.trim()), 'CAM programı oluşturuldu (taslak).');
            } }, 'CAM programı ekle')));
    };
    const revNew = h('input', { type: 'text', 'data-testid': 'eng-rev-new', placeholder: 'Yeni revizyon (örn. B)' });
    if (state.embedBom && prod)
        queueMicrotask(() => { container.querySelectorAll('[data-testid="eng-bom-host"]').forEach((el) => { const host = el; void state.embedBom(host, prod.id, host.dataset['rev'] ?? ''); }); });
    if (state.embed && prod)
        queueMicrotask(() => { const host = container.querySelector('[data-testid="eng-ops-host"]'); if (host && state.embed)
            void state.embed(host, prod.id); });
    mount(container, h('div', { class: 'eng', 'data-testid': 'eng-root' }, h('style', {}, CSS), h('h1', {}, 'Ürün Mühendisliği'), h('p', { class: 'note' }, 'Ürün → revizyon → reçete (BOM) → CAM programı → takım listesi. Yayınlanan revizyon ve program değiştirilemez; değişiklik yeni revizyonla yapılır.'), state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'eng-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, h('div', { class: 'card' }, h('select', { 'data-testid': 'eng-product', onChange: (e) => { const v = e.target.value || null; rememberProduct(v); void go({ product: v }); } }, h('option', { value: '' }, '— ürün seçin —'), ...data.products.map((p) => h('option', { value: p.id, selected: p.id === state.product ? 'selected' : undefined }, `${p.code} · ${p.name}`))), h('details', { style: 'margin-top:8px' }, h('summary', { style: 'min-height:36px;display:flex;align-items:center;font-weight:700;cursor:pointer' }, 'Yeni ürün'), h('div', { class: 'grid' }, pCode, pName, h('button', { type: 'button', class: 'primary', 'data-testid': 'eng-new-product', onClick: () => {
            if (!pCode.value.trim() || !pName.value.trim())
                return fail('Ürün kodu ve adı zorunlu.');
            void act(() => api.createProduct(pCode.value.trim(), pName.value.trim()), 'Ürün oluşturuldu.');
        } }, 'Ürünü oluştur')))), prod
        ? h('div', {}, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, `${prod.code} · ${prod.name}`), h('a', { href: `#/urun-calisma?urun=${prod.id}`, 'data-testid': 'eng-open-workspace', style: 'font-weight:700;font-size:13px' }, 'Ürün çalışma alanında aç →')), ...data.revisions.filter((r) => r.productId === prod.id).map(revisionBlock), state.embed ? h('div', { class: 'card', 'data-testid': 'eng-ops-card', style: 'background:transparent;border:0;padding:0' }, h('h2', {}, 'Operasyonlar ve teknik zincir (NC · CAM · takım listesi)'), h('p', { class: 'note', style: 'color:#94a3b8' }, 'Operasyonlar, her operasyonun NC belgesi, CAM kaydı ve takım listesi bağlantısı burada Ürün Çalışma Alanı ile aynı kayıttan gösterilir. NC dosyasından CAM kaydı oluşturma, yayınlama ve operasyona bağlama de buradadır.'), h('div', { 'data-testid': 'eng-ops-host' })) : null, h('div', { class: 'card' }, h('div', { class: 'grid' }, revNew, h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-rev-create', onClick: () => {
                if (!revNew.value.trim())
                    return fail('Revizyon adı zorunlu.');
                void act(() => api.createRevision(prod.id, revNew.value.trim()), 'Yeni revizyon oluşturuldu (taslak).');
            } }, 'Yeni revizyon aç'))))
        : h('div', { class: 'card', 'data-testid': 'eng-pick' }, data.products.length ? 'Bir ürün seçin.' : 'Henüz ürün yok. “Yeni ürün” ile ekleyin ya da Ana veri aktarımıyla eski KMI kayıtlarını getirin.')));
}
