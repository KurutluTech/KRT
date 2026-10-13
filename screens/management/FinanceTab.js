// KMI-MANAGEMENT-001 · Finansal Performans — ekonomik veri (D-007): yalnız ekonomik erişimi olan kullanıcıya açılır, sunucu ayrıca reddeder. Kaynaklar mevcut economic_overview / work_order_cost
// (Cost Intelligence ile aynı kanonik hesap); modellenmeyen kalemler açıkça listelenir, eksik maliyet "tamamlanmamış" diye işaretlenir, 0 gibi gösterilmez.
import { h, mount } from '../../../../../packages/ui/src/h.js';
import { AGE_BUCKET_TR } from '../../../../../packages/domain/src/economics.js';
import { pill, provenance, stateBox } from '../../ds.js';
import { kpi, setKpiContext, fmtDateTime, num, settle } from './kit.js';
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const moneyList = (m) => (m.length === 0 ? 'KAYIT YOK' : m.map((x) => `${num(x.amount, x.currency, 2)}`).join(' · '));
const PERIODS = [['30', 'Son 30 gün', (t) => [addDays(t, -29), t]], ['90', 'Son 90 gün', (t) => [addDays(t, -89), t]], ['mtd', 'Bu ay', (t) => [`${t.slice(0, 7)}-01`, t]]];
export async function renderFinanceTab(panel, ctx, periodKey = '90') {
    const [from, to] = (PERIODS.find(([k]) => k === periodKey) ?? PERIODS[1])[2](ctx.today);
    if (!ctx.hasEconomics) {
        mount(panel, h('div', { class: 'kd', 'data-testid': 'fin-locked' }, stateBox('unknown', 'Finansal performans ekonomik veridir', 'Gelir, tahsilat, maliyet ve kârlılık yalnız ekonomik erişimi olan kişilere (sahip ve sahibin yetkilendirdikleri) gösterilir. Bu hesapta gösterilmiyor; sunucu da bu verileri vermez.'), h('a', { class: 'btn ghost', href: '#/ekonomi-basvuru', 'data-testid': 'fin-apply-link' }, 'Ekonomik erişim başvurusu')));
        return;
    }
    mount(panel, h('div', { 'data-testid': 'fin-loading' }, stateBox('loading', 'Finansal performans yükleniyor…')));
    const ov = await settle(ctx.economics.overview(from, to));
    if (!ov.ok) {
        mount(panel, h('div', { class: 'kd', 'data-testid': 'fin-error' }, stateBox(ov.setup ? 'unknown' : 'error', ov.setup ? 'Finansal özet için kurulum bekleniyor' : 'Finansal özet okunamadı', ov.setup ? undefined : ov.error)));
        return;
    }
    const o = ov.value;
    setKpiContext(ctx, new Date(ctx.nowMs).toISOString());
    const wos = await settle(ctx.economics.recentWorkOrders());
    const costs = [];
    let costErr = null;
    if (wos.ok)
        for (const w of wos.value.slice(0, 12)) {
            const r = await settle(ctx.economics.workOrderCost(w.id));
            if (r.ok)
                costs.push({ id: w.id, c: r.value });
            else {
                costErr = r.error;
                break;
            }
        }
    const complete = costs.filter((x) => x.c.status === 'COMPLETE');
    const incomplete = costs.filter((x) => x.c.status !== 'COMPLETE');
    const missingTally = new Map();
    for (const x of incomplete)
        for (const m of x.c.missing)
            missingTally.set(m, (missingTally.get(m) ?? 0) + 1);
    const withMargin = complete.filter((x) => x.c.marginTry !== null);
    mount(panel, h('div', { class: 'kd', 'data-testid': 'fin-root' }, h('div', { class: 'tabs', role: 'group', 'aria-label': 'Dönem' }, ...PERIODS.map(([k, l]) => h('button', { type: 'button', class: k === periodKey ? 'on' : '', 'aria-pressed': String(k === periodKey), 'data-testid': `fin-period-${k}`, onClick: () => void renderFinanceTab(panel, ctx, k) }, l))), h('div', { class: 'mut', 'data-testid': 'fin-range' }, `Dönem: ${o.period.from} – ${o.period.to} · para birimleri ASLA toplanıp çevrilmez, ayrı gösterilir`), h('div', { class: 'kpis' }, kpi(`Gelir (fatura)`, moneyList(o.revenue), 'fin-revenue'), kpi('Tahsilat', moneyList(o.collections), 'fin-collections'), kpi('Tedarikçi faturası', moneyList(o.supplierInvoiced), 'fin-supplier-invoiced'), kpi('Tedarikçi ödemesi', moneyList(o.supplierPaid), 'fin-supplier-paid'), kpi('Malzeme çıkışı', moneyList(o.materialIssued), 'fin-material')), h('div', { class: 'panel', 'data-testid': 'fin-aging' }, h('h2', {}, 'Alacak yaşlandırma / ödeme vadeleri'), o.receivablesAging.length === 0 && o.payablesDue.length === 0 ? h('div', { class: 'empty' }, 'Açık alacak / borç kaydı yok.') : h('div', {}, ...o.receivablesAging.map((b) => h('div', { class: 'item', 'data-testid': 'fin-aging-row' }, pill('Alacak', 'info'), h('span', { class: 'grow' }, AGE_BUCKET_TR[b.bucket] ?? b.bucket), h('b', {}, num(b.amount, b.currency, 2)), h('span', { class: 'mut' }, `${b.count} kalem`))), ...o.payablesDue.map((b) => h('div', { class: 'item', 'data-testid': 'fin-due-row' }, pill('Borç', 'warn'), h('span', { class: 'grow' }, b.bucket), h('b', {}, num(b.amount, b.currency, 2)), h('span', { class: 'mut' }, `${b.count} kalem`))))), h('div', { class: 'panel', 'data-testid': 'fin-products' }, h('h2', {}, 'Ürün bazında fatura ve malzeme maliyeti'), o.products.length === 0 ? h('div', { class: 'empty' }, 'Bu dönemde ürün bazlı fatura / malzeme kaydı yok.') : h('div', {}, ...o.products.map((p) => {
        const inv = p.invoiced;
        const mat = p.materialCost;
        const contrib = inv.length === 1 && mat.length === 1 && inv[0].currency === mat[0].currency ? `${num(inv[0].amount - mat[0].amount, inv[0].currency, 2)}` : 'BİLİNMİYOR (para birimi eşleşmiyor veya veri eksik)';
        return h('div', { class: 'item', 'data-testid': 'fin-product-row', style: 'align-items:flex-start' }, h('b', { style: 'min-width:120px' }, p.productCode), h('div', { class: 'grow mut' }, `Fatura: ${moneyList(inv)} · Malzeme: ${moneyList(mat)} · Hurda malzeme: ${moneyList(p.scrapMaterialCost)}`), h('span', { title: 'Yalnız malzeme düşülmüş katkı; işçilik, makine, enerji dahil değildir' }, `Malzeme sonrası katkı: ${contrib}`));
    }))), h('div', { class: 'panel', 'data-testid': 'fin-wocost' }, h('h2', {}, 'İş emri maliyet bütünlüğü (son 12 iş emri)'), costErr ? stateBox('error', 'Maliyet okunamadı', costErr) : !wos.ok ? stateBox('error', 'İş emirleri okunamadı', wos.error) : h('div', {}, h('div', { class: 'kpis' }, kpi('Maliyeti TAMAM', String(complete.length), 'fin-wo-complete'), kpi('Maliyeti EKSİK', String(incomplete.length), 'fin-wo-incomplete'), kpi('Marjı hesaplanan', String(withMargin.length), 'fin-wo-margin')), incomplete.length ? h('div', { class: 'mut', 'data-testid': 'fin-wo-missing' }, `Eksik bileşenler: ${[...missingTally.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(', ')} — Maliyet Zekâsı ekranında hangi veri / karar gerektiği listelenir.`) : null)), o.notModelled.length ? h('div', { class: 'panel', 'data-testid': 'fin-not-modelled' }, h('h2', {}, 'Modellenmeyen kalemler (hesaba KATILMADI)'), ...o.notModelled.map((n) => h('div', { class: 'mut' }, `• ${n}`))) : null, h('div', { class: 'head' }, h('a', { class: 'btn primary', href: '#/maliyet', 'data-testid': 'fin-cost-link' }, 'Maliyet Zekâsı'), h('a', { class: 'btn ghost', href: '#/ekonomi', 'data-testid': 'fin-econ-link' }, 'Ekonomi & Kararlar'), h('a', { class: 'btn ghost', href: '#/alacaklar' }, 'Alacaklar & Vade')), provenance('economic_overview · work_order_cost (ekonomik yetki)', fmtDateTime(new Date(ctx.nowMs).toISOString()))));
}
