// KMI Teknik Fizibilite (/fizibilite) — CAM, quality and management judge whether a requested part can be made. The server sends TECHNICAL content only:
// part name, quantities, material note, product / revision, drawing count and earlier verdicts. No customer, no RFQ title or reference, no price, no quote. A refused call says so; it never shows an empty list as if nothing were wrong.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const V_TR = { FEASIBLE: 'Üretilebilir', CONDITIONAL: 'Şartlı üretilebilir', NOT_FEASIBLE: 'Üretilemez' };
const CSS = `
.fz{display:flex;flex-direction:column;gap:14px;max-width:1100px}.fz *{box-sizing:border-box}.fz h1{margin:0;font-size:22px}.fz .eb{font-size:10.5px;letter-spacing:.2em;color:#c9a24a;font-weight:700}
.fz .note{color:#8da0bd;font-size:13px}.fz .card{border:1px solid #1a2a46;border-radius:12px;padding:12px 14px;background:rgba(11,22,42,.6);display:flex;flex-direction:column;gap:8px;min-width:0}
.fz .card h2{margin:0;font-size:15px}.fz .kv{display:flex;gap:14px;flex-wrap:wrap;color:#b6c3d8;font-size:13px}.fz .banner{padding:10px 14px;border-radius:10px;font-size:14px}
.fz .banner.ok{background:#123a2c;border:1px solid #2f7d5e}.fz .banner.error{background:#3a1614;border:1px solid #8a3a35}.fz .verdict{display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid #26385a;font-size:12px}
.fz .verdict.FEASIBLE{border-color:#2f7d5e;color:#7fe0b0}.fz .verdict.CONDITIONAL{border-color:#e8b04a;color:#f0cf86}.fz .verdict.NOT_FEASIBLE{border-color:#8a3a35;color:#f09a94}
.fz input,.fz select,.fz textarea{min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid #26385a;background:#0b162a;color:#e9eef7;font:inherit;width:100%}.fz textarea{min-height:70px}
.fz .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:8px}.fz button{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #26385a;background:#12203a;color:#e9eef7;font:inherit;font-weight:600;cursor:pointer}
.fz button.primary{border-color:#2f7d5e;background:#123a2c}
`;
export async function renderFeasibilityScreen(container, api) {
    let banner = null;
    let open = null;
    let list = null;
    let failure = null;
    let machines = [];
    const load = async () => { try {
        list = await api.queue();
        failure = null;
    }
    catch (e) {
        list = null;
        failure = errorText(e);
    } try {
        machines = await api.machines();
    }
    catch {
        machines = [];
    } };
    const lineCard = (l) => {
        const f = l.feasibility;
        const tiers = l.qtyTiers.join(' · ');
        const form = () => {
            const verdict = h('select', { 'data-testid': 'fz-verdict' }, ...['FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE'].map((v) => h('option', { value: v }, V_TR[v])));
            const summary = h('textarea', { placeholder: 'Özet: hangi operasyonlar, hangi makineler (zorunlu)', 'data-testid': 'fz-summary' });
            const risks = h('textarea', { placeholder: 'Riskler (şartlı / üretilemez için zorunlu)', 'data-testid': 'fz-risks' });
            const tool = h('input', { type: 'text', placeholder: 'Takım / aparat notu', 'data-testid': 'fz-tool' });
            const qual = h('input', { type: 'text', placeholder: 'Kalite / ölçüm notu', 'data-testid': 'fz-quality' });
            const ext = h('input', { type: 'text', placeholder: 'Dış operasyon notu', 'data-testid': 'fz-external' });
            const mach = h('select', { multiple: 'multiple', 'data-testid': 'fz-machines', style: 'min-height:90px' }, ...machines.map((m) => h('option', { value: m.id }, `${m.code} · ${m.name}`)));
            return h('div', { class: 'card', 'data-testid': 'fz-form' }, h('div', { class: 'grid' }, verdict, summary, risks, tool, qual, ext, mach), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'fz-save', onClick: () => {
                    const input = { verdict: verdict.value, machineIds: [...mach.selectedOptions].map((o) => o.value), summary: summary.value, risks: risks.value, tooling: tool.value, quality: qual.value, external: ext.value };
                    void (async () => { try {
                        await api.assess(l.id, input);
                        banner = { kind: 'ok', text: 'Fizibilite kaydedildi.' };
                        open = null;
                        await load();
                    }
                    catch (e) {
                        banner = { kind: 'error', text: errorText(e) };
                    } draw(); })();
                } }, 'Değerlendirmeyi kaydet'), h('button', { type: 'button', onClick: () => { open = null; draw(); } }, 'Vazgeç')));
        };
        return h('div', { class: 'card', 'data-testid': 'fz-line' }, h('h2', {}, `Kalem ${l.lineNo} · ${l.partName}`), h('div', { class: 'kv' }, h('span', {}, `Adetler: ${tiers}`), l.requiredBy ? h('span', {}, `İstenen tarih: ${l.requiredBy}`) : null, h('span', {}, `Malzeme notu: ${l.materialNote ?? '—'}`), h('span', {}, l.product ? `Ürün: ${l.product.code} · ${l.product.name}${l.productRevision ? ` · Rev ${l.productRevision.revision}` : ''}` : 'Ürün bağlı değil'), h('span', {}, `Teknik belge: ${l.documents}`)), f ? h('div', { 'data-testid': 'fz-verdict-shown' }, h('span', { class: `verdict ${f.verdict}` }, V_TR[f.verdict] ?? f.verdict), ` ${f.summary}`, f.risks ? ` — Risk: ${f.risks}` : '') : h('div', { class: 'note' }, 'Henüz değerlendirilmedi.'), open === l.id ? form() : h('button', { type: 'button', 'data-testid': 'fz-assess', onClick: () => { open = l.id; draw(); } }, f ? 'Yeniden değerlendir' : 'Değerlendir'));
    };
    const draw = () => {
        mount(container, h('div', { class: 'fz', 'data-testid': 'fz-root' }, h('style', {}, CSS), h('div', { class: 'eb' }, 'TEKNİK FİZİBİLİTE'), h('h1', {}, 'Fizibilite Bekleyen Talepler'), h('div', { class: 'note' }, 'Bu ekranda yalnız teknik bilgi vardır: parça, adet, malzeme, ürün/revizyon ve teknik belge sayısı. Müşteri, fiyat ve teklif bilgisi bu yetkiyle görünmez.'), banner ? h('div', { class: `banner ${banner.kind}`, 'data-testid': 'fz-banner' }, banner.text) : null, failure ? h('div', { class: 'banner error', 'data-testid': 'fz-error' }, failure) : null, list && list.length === 0 ? h('div', { class: 'note', 'data-testid': 'fz-empty' }, 'Fizibilite bekleyen talep yok.') : null, ...(list ?? []).map((r) => h('div', { class: 'card', 'data-testid': 'fz-rfq' }, h('h2', {}, `${r.rfqNo} · ${r.status}`), ...r.lines.map(lineCard)))));
    };
    await load();
    draw();
}
