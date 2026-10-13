// KMI NEXT — Ürün Mühendisliği: ürün → revizyon → ürün reçetesi (BOM) → CAM programı → takım listesi → çevrim süresi → yayın.
// Bu zincir olmadan bir iş emri "malzeme / takım gereksinimi bilinmiyor" diye başlatılamaz (güvenli varsayılan); yani gerçek kullanımın ilk
// adımıdır. Yayınlanan revizyon / program DEĞİŞTİRİLEMEZ (sunucu kilidi); değişiklik yeni revizyonla yapılır. Yetki: BOM_RELEASE (sunucuda).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `
.eng{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:820px;margin:0 auto;box-sizing:border-box;color:#0f172a}
.eng button{min-height:44px;font-size:16px;font-weight:700;border-radius:12px;border:0;padding:0 14px;cursor:pointer}
.eng input,.eng select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #cbd5e1;padding:0 10px;box-sizing:border-box;width:100%}
.eng .card{background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.eng .chip{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:800;font-size:12px;margin:2px 4px 2px 0}
.eng .ok{background:#dcfce7;color:#166534}.eng .warn{background:#fef3c7;color:#92400e}.eng .bad{background:#fee2e2;color:#991b1b}.eng .info{background:#e0e7ff;color:#3730a3}
.eng .primary{background:#1d4ed8;color:#fff}.eng .ghost{background:#e2e8f0;color:#0f172a}
.eng .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.eng .grid{display:grid;gap:8px;margin-top:8px}
.eng h2{font-size:17px;margin:14px 0 4px}.eng h3{font-size:15px;margin:10px 0 2px}
.eng table{width:100%;border-collapse:collapse;font-size:14px}.eng td,.eng th{padding:6px 4px;border-bottom:1px solid #e2e8f0;text-align:left}
`;
const ST_TR = { DRAFT: 'TASLAK', RELEASED: 'YAYINDA', OBSOLETE: 'ESKİ' };
const num = (s) => Number(s.replace(',', '.'));
export async function renderEngineeringScreen(container, api, state = {}) {
    const go = (s) => renderEngineeringScreen(container, api, s);
    let data;
    try {
        data = await api.load();
    }
    catch (e) {
        mount(container, h('div', { class: 'eng', 'data-testid': 'eng-root' }, h('style', {}, CSS), h('div', { class: 'card bad', 'data-testid': 'eng-error' }, `Yüklenemedi: ${errorText(e)}`)));
        return;
    }
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
        return h('div', { class: 'card', 'data-testid': 'eng-revision', 'data-revision': r.revision, 'data-status': r.status }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:18px' }, `Revizyon ${r.revision}`), h('span', { class: `chip ${r.status === 'RELEASED' ? 'ok' : r.status === 'DRAFT' ? 'warn' : 'info'}`, 'data-testid': 'eng-rev-status' }, ST_TR[r.status])), h('h3', {}, 'Ürün reçetesi (BOM)'), lines.length
            ? h('table', { 'data-testid': 'eng-bom' }, ...lines.map((l) => h('tr', { 'data-testid': 'eng-bom-line' }, h('td', {}, l.materialCode), h('td', {}, `${l.qtyPerUnit} / adet`), h('td', {}, l.scrapAllowancePct ? `fire %${l.scrapAllowancePct}` : ''))))
            : h('div', { class: 'chip warn', 'data-testid': 'eng-bom-empty' }, 'Reçete boş — iş emri malzeme gereksinimini bilemez'), r.status === 'DRAFT'
            ? h('div', { class: 'grid' }, mat, qty, scrap, h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-bom-add', onClick: () => {
                    if (!mat.value.trim() || !(num(qty.value) > 0))
                        return fail('Malzeme kodu ve sıfırdan büyük miktar zorunlu.');
                    void act(() => api.addBomLine(r.id, mat.value.trim(), num(qty.value), scrap.value.trim() ? num(scrap.value) : 0), 'Reçete satırı eklendi.');
                } }, 'Reçeteye satır ekle'), h('button', { type: 'button', class: 'primary', 'data-testid': 'eng-rev-release', onClick: () => {
                    if (!lines.length)
                        return fail('Boş reçeteli revizyon yayınlanamaz.');
                    void act(() => api.releaseRevision(r.id), `Revizyon ${r.revision} yayınlandı; öncekiler ESKİ oldu. Artık değiştirilemez.`);
                } }, `Revizyon ${r.revision} yayınla`))
            : null, h('h3', {}, 'CAM programları'), programs.length ? h('div', {}, ...programs.map((c) => {
            const tools = data.tools.filter((t) => t.camProgramId === c.id);
            const tType = h('input', { type: 'text', 'data-testid': 'eng-tool-type', placeholder: 'Takım tipi (örn. FREZE-D10)' });
            const tQty = h('input', { type: 'text', inputmode: 'numeric', 'data-testid': 'eng-tool-qty', placeholder: 'Adet' });
            const cyc = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'eng-cycle', placeholder: 'İdeal çevrim süresi (sn / adet)', value: c.idealCycleSeconds ? String(c.idealCycleSeconds) : '' });
            return h('div', { class: 'card', style: 'background:#f8fafc', 'data-testid': 'eng-program', 'data-program': c.programNo, 'data-status': c.status }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, `${c.programNo} · rev ${c.revision}`), h('span', { class: `chip ${c.status === 'RELEASED' ? 'ok' : 'warn'}` }, ST_TR[c.status])), tools.length ? h('div', {}, ...tools.map((t) => h('span', { class: 'chip info', 'data-testid': 'eng-tool' }, `${t.toolType} × ${t.qty}`))) : h('div', { class: 'chip warn', 'data-testid': 'eng-tools-empty' }, 'Takım listesi boş'), h('div', { style: 'font-size:13px;color:#475569' }, c.idealCycleSeconds ? `İdeal çevrim ${c.idealCycleSeconds} sn` : 'İdeal çevrim süresi yok — OEE performansı “bilinmiyor” kalır'), c.status === 'DRAFT'
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
    mount(container, h('div', { class: 'eng', 'data-testid': 'eng-root' }, h('style', {}, CSS), h('h1', {}, 'Ürün Mühendisliği'), h('p', { style: 'color:#475569' }, 'Ürün → revizyon → reçete (BOM) → CAM programı → takım listesi. Yayınlanan revizyon ve program değiştirilemez; değişiklik yeni revizyonla yapılır.'), state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'eng-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, h('div', { class: 'card' }, h('select', { 'data-testid': 'eng-product', onChange: (e) => void go({ product: e.target.value || null }) }, h('option', { value: '' }, '— ürün seçin —'), ...data.products.map((p) => h('option', { value: p.id, selected: p.id === state.product ? 'selected' : undefined }, `${p.code} · ${p.name}`))), h('details', { style: 'margin-top:8px' }, h('summary', { style: 'min-height:44px;display:flex;align-items:center;font-weight:700' }, 'Yeni ürün'), h('div', { class: 'grid' }, pCode, pName, h('button', { type: 'button', class: 'primary', 'data-testid': 'eng-new-product', onClick: () => {
            if (!pCode.value.trim() || !pName.value.trim())
                return fail('Ürün kodu ve adı zorunlu.');
            void act(() => api.createProduct(pCode.value.trim(), pName.value.trim()), 'Ürün oluşturuldu.');
        } }, 'Ürünü oluştur')))), prod
        ? h('div', {}, h('h2', {}, `${prod.code} · ${prod.name}`), ...data.revisions.filter((r) => r.productId === prod.id).map(revisionBlock), h('div', { class: 'card' }, h('div', { class: 'grid' }, revNew, h('button', { type: 'button', class: 'ghost', 'data-testid': 'eng-rev-create', onClick: () => {
                if (!revNew.value.trim())
                    return fail('Revizyon adı zorunlu.');
                void act(() => api.createRevision(prod.id, revNew.value.trim()), 'Yeni revizyon oluşturuldu (taslak).');
            } }, 'Yeni revizyon aç'))))
        : h('div', { class: 'card', 'data-testid': 'eng-pick' }, data.products.length ? 'Bir ürün seçin.' : 'Henüz ürün yok. “Yeni ürün” ile ekleyin ya da Ana veri aktarımıyla eski KMI kayıtlarını getirin.')));
}
