// KMI department HOME — one screen per approved workspace: cockpit (KPIs, pending decisions, flow, risks) + analytics from real records + exceptions +
// the department's real sub-pages + a searchable record list + history + cross-links. It reads the same sources as the cockpit; it never writes.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildCockpit } from '../../../../packages/domain/src/departmentCockpit.js';
import { buildDepartmentHome, COCKPIT_OF_WORKSPACE } from '../../../../packages/domain/src/departmentHome.js';
import { loadCockpitInput, renderCockpit } from './DepartmentCockpit.js';
const CSS = `
.dh{display:flex;flex-direction:column;gap:16px;max-width:1200px}.dh *{box-sizing:border-box}
.dh-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.dh-head h1{margin:0;font-size:22px;letter-spacing:.02em}.dh-head .eb{font-size:10.5px;letter-spacing:.2em;color:#c9a24a;font-weight:700}
.dh-tabs{display:flex;gap:8px;flex-wrap:wrap}.dh-tabs a{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border:1px solid #1a2a46;border-radius:10px;color:#cbd5e1;text-decoration:none;font-size:14px;font-weight:600}.dh-tabs a[aria-current=page]{border-color:#c9a24a;color:#fff;background:rgba(201,162,74,.12)}
.dh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:14px}
.dh-card{border:1px solid #1a2a46;border-radius:12px;padding:14px 16px;background:rgba(11,22,42,.6);min-width:0}.dh-card h3{margin:0 0 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8da0bd}
.dh-bar{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:10px;align-items:center;padding:4px 0;font-size:13px}.dh-bar .t{height:10px;background:#12203a;border-radius:6px;overflow:hidden}.dh-bar .t i{display:block;height:100%;border-radius:6px;transition:width .5s ease}
.dh-bar b{font-variant-numeric:tabular-nums}.tone-red i{background:#f0645a}.tone-amber i{background:#e8b04a}.tone-green i{background:#5fd0a0}.tone-blue i{background:#5cc8e6}.tone-gray i{background:#7d8ba3}
.dh-pages{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:10px}.dh-page{display:flex;gap:10px;align-items:center;min-height:56px;padding:10px 12px;border:1px solid #1a2a46;border-radius:10px;color:inherit;text-decoration:none;background:rgba(11,22,42,.6)}
.dh .dh-page{color:#e2e8f0}.dh-page:hover,.dh-page:focus-visible{border-color:#c9a24a}.dh-page small{display:block;color:#8da0bd;font-size:12px}
.dh-ex a,.dh-ex div{display:block;padding:6px 0 6px 10px;border-left:3px solid #7d8ba3;border-bottom:1px solid #1a2a46;color:inherit;text-decoration:none;font-size:13px}.dh-ex .red{border-left-color:#f0645a}.dh-ex .amber{border-left-color:#e8b04a}
.dh-tbl{overflow-x:auto;max-width:100%}.dh-tbl table{border-collapse:collapse;width:100%;font-size:13px}.dh-tbl th{text-align:left;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8da0bd;padding:6px 8px}.dh-tbl td{padding:8px;border-top:1px solid #1a2a46}
.dh-tbl tr.red td:first-child{box-shadow:inset 3px 0 #f0645a}.dh-tbl tr.amber td:first-child{box-shadow:inset 3px 0 #e8b04a}.dh-tbl a{color:#5cc8e6;text-decoration:none}
.dh input[type=search]{width:100%;max-width:360px;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid #26385a;background:#0b162a;color:inherit;font-size:14px}.dh .mu{color:#8da0bd;font-size:12.5px}
@media (prefers-reduced-motion:reduce){.dh *{transition:none!important}}
`;
/** One line of meaning per sub-page (what the user does there) — shown on the department home. */
export const PAGE_NOTE = {
    '/is-emirleri': 'İş emirlerini ata, başlat, izle', '/gorevler': 'Departmanlar arası görevler', '/operator': 'Operatörün kendi işleri', '/terminal': 'Makine başında BAŞLAT / BİTİR', '/tara': 'QR / barkod ile kayda git',
    '/planlama': 'Sırala, makine ve operatör ata', '/muhendislik': 'Revizyon, BOM ve CAM programı yayını', '/rota': 'Rota ve operasyonlar', '/takimhane': 'Takım ver / al, aşınma, hurda',
    '/kalite': 'İlk parça, HOLD, NCR', '/tahsis': 'Ölçü düzeltme (TAHSİS) kayıtları', '/bakim': 'Arıza, bakım emri, test ve servise dönüş', '/depo': 'Stok lotları ve hareketler',
    '/satinalma': 'Satınalma siparişi ve mal kabul', '/talepler': 'Satınalma talepleri', '/sevkiyat': 'Sevkiyat ve kalite kapısı', '/siparisler': 'Müşteri siparişleri ve kalemleri', '/katalog': 'Ürün ve müşteri kataloğu',
    '/personel': 'Personel kartları', '/puantaj': 'Puantaj ve prim havuzu', '/akademi': 'Eğitim ve yetkinlik', '/giris-cikis': 'Giriş-çıkış verisi', '/zeka': 'Açıklanabilir öneriler', '/raporlar': 'Raporlar', '/dokumanlar': 'Doküman ve pasaportlar', '/gecmis': 'Olay geçmişi araması',
    '/alacaklar': 'Alacak ve tahsilat', '/onay-kuyrugu': 'Ticari onay kuyruğu', '/maliyet': 'Maliyet zekâsı', '/ekonomi': 'Ekonomik kararlar', '/onaylar': 'Bekleyen onaylar ve kararlar', '/yonetim': 'Yönetim zekâsı', '/komuta': 'Fabrikanın tamamı', '/canli': 'Canlı atölye', '/oee': 'OEE ve kayıplar',
};
const bars = (title, xs, reason) => {
    const max = xs ? Math.max(1, ...xs.map((x) => x.value)) : 1;
    return h('section', { class: 'dh-card', 'data-testid': 'dh-chart' }, h('h3', {}, title), xs === null ? h('div', { class: 'mu', 'data-testid': 'dh-chart-unknown' }, reason ?? 'veri yok')
        : xs.every((x) => x.value === 0) ? h('div', { class: 'mu' }, 'Kayıtlara göre gösterilecek değer yok.')
            : h('div', {}, ...xs.map((x) => h('div', { class: `dh-bar tone-${x.tone}`, 'data-testid': 'dh-bar' }, h('span', {}, x.label), h('span', { class: 't' }, h('i', { style: `width:${Math.round((x.value / max) * 100)}%` })), h('b', {}, String(x.value))))));
};
export const DEPT_VIEWS = [['ozet', 'Ana ekran'], ['kayit', 'Kayıtlar'], ['analitik', 'Analitik ve istisnalar']];
export async function renderDepartmentHome(container, o) {
    const icon = o.icon;
    const view = o.view ?? 'ozet';
    const cid = COCKPIT_OF_WORKSPACE[o.group.id] ?? null;
    const cockpitHost = h('div', { 'data-testid': 'dh-cockpit' });
    const body = h('div', { 'data-testid': 'dh-body' }, h('div', { class: 'mu' }, 'Kayıtlar okunuyor…'));
    const pages = h('section', { 'data-testid': 'dh-pages' }, h('div', { class: 'dh-pages' }, ...o.items.map((it) => h('a', { class: 'dh-page', href: `#${it.path}`, 'data-testid': 'dh-page', 'data-path': it.path }, icon(it.icon, 22), h('span', {}, it.label, PAGE_NOTE[it.path] ? h('small', {}, PAGE_NOTE[it.path]) : null)))));
    mount(container, h('div', { class: 'dh', 'data-testid': 'dept-home', 'data-ws': o.group.id }, h('style', {}, CSS), h('div', { class: 'dh-head' }, icon(o.group.icon, 30), h('div', {}, h('div', { class: 'eb' }, 'DEPARTMAN'), h('h1', { 'data-testid': 'dh-title' }, o.group.title))), h('nav', { class: 'dh-tabs', 'aria-label': 'Departman bölümleri', 'data-testid': 'dh-tabs' }, ...DEPT_VIEWS.map(([v, l]) => h('a', { href: `#/departman?d=${o.group.id}&v=${v}`, 'aria-current': v === view ? 'page' : 'false', 'data-testid': `dh-tab-${v}` }, l))), view === 'ozet' ? cockpitHost : null, view === 'ozet' ? pages : null, body));
    const input = cid ? await loadCockpitInput(cid, o.src, o.nowIso) : { nowIso: o.nowIso, snapshot: null };
    if (!body.isConnected)
        return;
    if (cid && view === 'ozet')
        renderCockpit(cockpitHost, buildCockpit(cid, input));
    const d = buildDepartmentHome(o.group.id, input);
    let q = '';
    const tbody = h('tbody', {});
    const count = h('span', { class: 'mu', 'data-testid': 'dh-count' });
    const draw = () => {
        const rows = (d.records ?? []).filter((r) => !q || r.search.includes(q));
        const shown = rows.slice(0, 60);
        tbody.replaceChildren(...shown.map((r) => h('tr', { class: r.tone, 'data-testid': 'dh-row' }, ...r.cells.map((c, i) => h('td', {}, i === 0 && r.href ? h('a', { href: r.href }, c) : c)))));
        count.textContent = d.records ? `${rows.length} kayıt${rows.length > shown.length ? ` (ilk ${shown.length} gösteriliyor — aramayı daraltın)` : ''}` : '';
    };
    const records = h('section', { class: 'dh-card', 'data-testid': 'dh-records' }, h('h3', {}, d.recordsTitle), d.records === null ? h('div', { class: 'mu', 'data-testid': 'dh-records-unknown' }, d.recordsReason ?? 'veri yok')
        : d.records.length === 0 ? h('div', { class: 'mu' }, 'Kayıt yok.')
            : h('div', {}, h('input', { type: 'search', placeholder: 'Bu departmanın kayıtlarında ara…', 'aria-label': 'Kayıt ara', 'data-testid': 'dh-search', onInput: (e) => { q = e.target.value.trim().toLocaleLowerCase('tr-TR'); draw(); } }), count, h('div', { class: 'dh-tbl' }, h('table', {}, h('thead', {}, h('tr', {}, ...d.columns.map((c) => h('th', {}, c)))), tbody))));
    const ex = h('section', { class: 'dh-card', 'data-testid': 'dh-exceptions' }, h('h3', {}, 'İstisnalar'), d.exceptions.length === 0 ? h('div', { class: 'mu' }, 'Kayıtlara göre açık istisna yok. (Bu, sorun olmadığının kanıtı değildir.)')
        : h('div', { class: 'dh-ex' }, ...d.exceptions.map((e) => (e.href ? h('a', { href: e.href, class: e.tone }, e.text) : h('div', { class: e.tone }, e.text)))));
    const hist = h('section', { class: 'dh-card' }, h('h3', {}, 'Geçmiş ve izlenebilirlik'), h('div', { class: 'mu' }, 'Kayıtların tam geçmişi pasaportunda; olay araması Olay Geçmişi ekranında.'), h('div', { style: 'margin-top:8px;display:flex;gap:14px;flex-wrap:wrap' }, h('a', { href: '#/gecmis', style: 'color:#5cc8e6' }, 'Olay geçmişi →'), h('a', { href: '#/ara', style: 'color:#5cc8e6' }, 'Genel arama →')));
    const charts = h('div', { class: 'dh-grid' }, bars(d.analyticsTitle, d.bars, d.barsReason), d.second || d.secondTitle ? bars(d.secondTitle ?? '', d.second, d.barsReason) : null);
    body.replaceChildren(...(view === 'kayit' ? [records] : view === 'analitik' ? [charts, h('div', { class: 'dh-grid', style: 'margin-top:14px' }, ex, hist)] : [h('div', { class: 'dh-grid' }, ex, hist), records]));
    draw();
}
