// KMI department HOME — one screen per approved workspace: cockpit (KPIs, pending decisions, flow, risks) + analytics from real records + exceptions +
// the department's real sub-pages + a searchable record list + history + cross-links. It reads the same sources as the cockpit; it never writes.
import { identityOf } from '../../../../packages/domain/src/departmentIdentity.js';
import { FUNCTION_STATE_TR, resolveFunctions, functionMaturity, liveLabelTr } from '../../../../packages/domain/src/departmentFunctions.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildCockpit } from '../../../../packages/domain/src/departmentCockpit.js';
import { buildDepartmentHome, COCKPIT_OF_WORKSPACE } from '../../../../packages/domain/src/departmentHome.js';
import { loadCockpitInput, renderCockpit } from './DepartmentCockpit.js';
import { trTitle } from '../nav.js';
const CSS = `
.dh{display:flex;flex-direction:column;gap:16px;max-width:1200px}.dh *{box-sizing:border-box}
.dh-fdet>summary{cursor:pointer;font-size:14px;font-weight:700;color:var(--kmi-text2);padding:10px 14px;border-radius:12px;background:var(--kmi-panel);border:1px solid var(--kmi-line)}.dh-fdet[open]>summary{margin-bottom:10px}.dh-head{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:16px 18px;border-radius:16px;background:linear-gradient(120deg,rgba(15,23,42,.9),rgba(13,21,37,.7));border:1px solid rgba(148,163,184,.14);box-shadow:inset 4px 0 0 var(--dh-accent)}.dh-em{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;color:var(--dh-accent);background:rgba(2,6,23,.55);border:1px solid var(--dh-accent)}.dh-ht{min-width:0}.dh-mission{font-size:14px;color:#cbd5e1;margin-top:2px}.dh-first{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;margin:10px 0 2px;padding:10px 14px;border-radius:12px;background:rgba(2,6,23,.4);border:1px dashed var(--dh-accent);font-size:14px}.dh-first b{font-size:11px;letter-spacing:.16em;color:var(--dh-accent)}.dh-head h1{margin:0;font-size:22px;letter-spacing:.02em}.dh-head .eb{font-size:10.5px;letter-spacing:.2em;color:var(--dh-accent);font-weight:700}
.dh-tabs{display:flex;gap:8px;flex-wrap:wrap}.dh-tabs a{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border:1px solid #1a2a46;border-radius:10px;color:#cbd5e1;text-decoration:none;font-size:14px;font-weight:600}.dh-tabs a[aria-current=page]{border-color:#c9a24a;color:#fff;background:rgba(201,162,74,.12)}
.dh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:14px}
.dh-card{border:1px solid #1a2a46;border-radius:12px;padding:14px 16px;background:rgba(11,22,42,.6);min-width:0}.dh-card h3{margin:0 0 10px;font-size:14px;font-weight:650;color:#e2e8f0}
.dh-bar{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:10px;align-items:center;padding:4px 0;font-size:13px}.dh-bar .t{height:10px;background:#12203a;border-radius:6px;overflow:hidden}.dh-bar .t i{display:block;height:100%;border-radius:6px;transition:width .5s ease}
.dh-bar b{font-variant-numeric:tabular-nums}.tone-red i{background:#f0645a}.tone-amber i{background:#e8b04a}.tone-green i{background:#5fd0a0}.tone-blue i{background:#5cc8e6}.tone-gray i{background:#7d8ba3}
.dh-pages{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:10px}.dh-page{display:flex;gap:10px;align-items:center;min-height:56px;padding:10px 12px;border:1px solid #1a2a46;border-radius:10px;color:inherit;text-decoration:none;background:rgba(11,22,42,.6)}
.dh .dh-page{color:#e2e8f0}.dh-page:hover,.dh-page:focus-visible{border-color:#c9a24a}.dh-fh{font-size:12px;letter-spacing:.14em;color:#9fb0cf;margin:16px 0 8px}.dh-fl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:8px}.dh-fn{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #243452;border-radius:12px;color:#e2e8f0;text-decoration:none;min-height:52px}a.dh-fn:hover{border-color:#c9a24a}.dh-fn.off{opacity:.85}.dh-fn small{display:block;color:#8da0bd;font-size:12px;margin-top:2px}.fs{flex:none;font-size:11px;letter-spacing:.06em;padding:3px 9px;border-radius:999px;border:1px solid}.fs-available{background:#052e1a;color:#86efac;border-color:#166534}.fs-partial{background:#2d1f03;color:#fcd34d;border-color:#92400e}.fs-planned{background:#1e293b;color:#cbd5e1;border-color:#475569;border-style:dashed}.fs-blocked{background:#3a0a0a;color:#fecaca;border-color:#991b1b}
.dh-page small{display:block;color:#8da0bd;font-size:12px}
.dh-ex a,.dh-ex div{display:block;padding:6px 0 6px 10px;border-left:3px solid #7d8ba3;border-bottom:1px solid #1a2a46;color:inherit;text-decoration:none;font-size:13px}.dh-ex .red{border-left-color:#f0645a}.dh-ex .amber{border-left-color:#e8b04a}
.dh-tbl{overflow-x:auto;max-width:100%}.dh-tbl table{border-collapse:collapse;width:100%;font-size:13px}.dh-tbl th{text-align:left;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8da0bd;padding:6px 8px}.dh-tbl td{padding:8px;border-top:1px solid #1a2a46}
.dh-tbl tr.red td:first-child{box-shadow:inset 3px 0 #f0645a}.dh-tbl tr.amber td:first-child{box-shadow:inset 3px 0 #e8b04a}.dh-tbl a{color:#5cc8e6;text-decoration:none}
.dh input[type=search]{width:100%;max-width:360px;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid #26385a;background:#0b162a;color:inherit;font-size:14px}.dh .mu{color:#8da0bd;font-size:12.5px}
/* phone (KMI-001 final visual): the first screen is the decision/task centre — compact one-line department header, no mission/first-look cards (the cockpit's decision queue IS the first look), segmented tabs after the cockpit */
@media (max-width:700px){.dh{gap:12px}.dh>*{order:5}.dh>.dh-head{order:0}.dh>.dh-tabs{order:1}.dh>[data-testid=dh-cockpit]{order:2}.dh>[data-testid=dh-pages]{order:6}.dh>.dh-fdet{order:7}
  .dh-head{padding:10px 14px;gap:10px;flex-wrap:nowrap;border-radius:14px}.dh-head .eb,.dh-head .dh-mission,.dh-first{display:none}.dh-head h1{font-size:19px;margin:0}.dh-em{width:32px;height:32px}.dh-em svg{width:22px;height:22px}
  .dh-tabs{gap:0;padding:3px;border-radius:12px;background:var(--kmi-panel);flex-wrap:nowrap}.dh-tabs a{flex:1 1 0;justify-content:center;text-align:center;min-height:40px;padding:0 6px;border:0;border-radius:9px;font-size:13px;line-height:1.15}.dh-tabs a[aria-current=page]{background:var(--kmi-panel2);color:#fff}}
@media (prefers-reduced-motion:reduce){.dh *{transition:none!important}}
`;
/** One line of meaning per sub-page (what the user does there) — shown on the department home. */
export const PAGE_NOTE = {
    '/uretim': 'Tüm makineler: başlat, üretim bildir, duruş, arıza', '/is-emirleri': 'İş emirlerini ata, başlat, izle', '/gorevler': 'Departmanlar arası görevler', '/operator': 'Operatörün kendi işleri', '/terminal': 'Makine başında BAŞLAT / BİTİR', '/tara': 'QR / barkod ile kayda git',
    '/planlama': 'Üretim ihtiyacı, iş emri aç, makine / vardiya / operatör ata', '/muhendislik': 'Revizyon, BOM ve CAM programı yayını', '/urun-master': 'Ürün kimliği, revizyon onayı, geçmiş, pasaport/QR, gerçek süre', '/rota': 'Rota ve operasyonlar', '/takimhane': 'Takım ver / al, aşınma, hurda',
    '/kalite': 'Karar kuyruğu: ilk parça, HOLD, NCR, gelen kontrol, final', '/tahsis': 'Ölçü düzeltme (TAHSİS) kayıtları', '/bakim': 'Arıza, bakım emri, test ve servise dönüş', '/depo': 'Stok lotları ve hareketler',
    '/satinalma': 'Satınalma siparişi ve mal kabul', '/talepler': 'Satınalma talepleri', '/sevkiyat': 'Sevkiyat ve kalite kapısı', '/siparisler': 'Müşteri siparişleri ve kalemleri', '/siparis-komuta': 'Sipariş izleme, termin riski, değişiklik ve yazdırma', '/katalog': 'Ürün ve müşteri kataloğu',
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
    const ident = identityOf(o.group.id);
    const cid = COCKPIT_OF_WORKSPACE[o.group.id] ?? null;
    const cockpitHost = h('div', { 'data-testid': 'dh-cockpit' });
    const body = h('div', { 'data-testid': 'dh-body' }, h('div', { class: 'mu' }, 'Kayıtlar okunuyor…'));
    const fl0 = resolveFunctions(o.group.id, o.canOpen ?? (() => true));
    const coveredPaths = new Set((fl0 ?? []).filter((f) => f.link && f.path && f.path !== '/departman').map((f) => f.path));
    const pageItems = o.items.filter((it) => !coveredPaths.has(it.path)); // pages the function list already links are not tiled twice
    const pages = h('section', { 'data-testid': 'dh-pages' }, fl0 ? h('h3', { class: 'dh-fh' }, 'Diğer sayfalar') : null, h('div', { class: 'dh-pages' }, ...pageItems.map((it) => h('a', { class: 'dh-page', href: `#${it.path}`, 'data-testid': 'dh-page', 'data-path': it.path }, icon(it.icon, 22), h('span', {}, it.label, PAGE_NOTE[it.path] ? h('small', {}, PAGE_NOTE[it.path]) : null)))));
    const fl = resolveFunctions(o.group.id, o.canOpen ?? (() => true));
    const nOpen = (fl ?? []).filter((f) => f.state === 'AVAILABLE').length, nPlan = (fl ?? []).filter((f) => f.state === 'PLANNED').length, nBlk = (fl ?? []).filter((f) => f.state === 'BLOCKED').length;
    const functions = h('details', { class: 'dh-fdet', 'data-testid': 'dh-functions' }, h('summary', { class: 'dh-fh' }, `Bu departmanın işlevleri — ${nOpen} açık · ${nPlan} planlandı${nBlk ? ` · ${nBlk} engelli` : ''} (sol menüde de listelenir)`), fl ? h('div', { class: 'dh-fl' }, ...fl.map((f) => {
        const inner = [h('b', { class: `fs fs-${f.state.toLowerCase()}`, 'data-testid': 'dh-fstate' }, FUNCTION_STATE_TR[f.state]), h('span', {}, f.label, f.note ? h('small', {}, f.pkg ? `${f.note} (${f.pkg})` : f.note) : null, f.forbidden ? h('small', {}, 'Yetkiniz yok') : null, liveLabelTr(functionMaturity(f)) ? h('small', { 'data-testid': 'dh-flive', class: 'dh-live' }, liveLabelTr(functionMaturity(f))) : null)];
        return f.link ? h('a', { class: 'dh-fn', href: f.link, 'data-testid': 'dh-function', 'data-state': f.state }, ...inner) : h('div', { class: 'dh-fn off', 'data-testid': 'dh-function', 'data-state': f.state }, ...inner);
    })) : h('div', { class: 'mu', 'data-testid': 'dh-functions-none' }, 'Bu departmanın işlev listesi Master Harita ile tamamlanacak; şimdilik yalnız gerçek sayfaları listelenir.'));
    mount(container, h('div', { class: 'dh', 'data-testid': 'dept-home', 'data-ws': o.group.id, style: `--dh-accent:${ident?.accent ?? '#c9a24a'}` }, h('style', {}, CSS), h('div', { class: 'dh-head', 'data-testid': 'dh-head' }, h('span', { class: 'dh-em' }, icon(o.group.icon, 34)), h('div', { class: 'dh-ht' }, h('div', { class: 'eb' }, 'DEPARTMAN'), h('h1', { 'data-testid': 'dh-title' }, trTitle(o.group.title)), ident ? h('div', { class: 'dh-mission', 'data-testid': 'dh-mission' }, ident.mission) : null)), ident && view === 'ozet' && !cid ? h('div', { class: 'dh-first', 'data-testid': 'dh-firstlook' }, h('b', {}, 'ÖNCE BAKILACAK'), h('span', {}, ident.firstLook)) : null, h('nav', { class: 'dh-tabs', 'aria-label': 'Departman bölümleri', 'data-testid': 'dh-tabs' }, ...DEPT_VIEWS.map(([v, l]) => h('a', { href: `#/departman?d=${o.group.id}&v=${v}`, 'aria-current': v === view ? 'page' : 'false', 'data-testid': `dh-tab-${v}` }, l))), view === 'ozet' ? cockpitHost : null, view === 'ozet' && pageItems.length ? pages : null, view === 'ozet' && o.showSystemStatus ? functions : null, body));
    const input = cid ? await loadCockpitInput(cid, o.src, o.nowIso) : { nowIso: o.nowIso, snapshot: null };
    if (!body.isConnected)
        return;
    if (cid && view === 'ozet')
        renderCockpit(cockpitHost, buildCockpit(cid, input), { canOpen: o.canOpen, hint: ident?.firstLook });
    const d = buildDepartmentHome(o.group.id, input);
    let q = '';
    const tbody = h('tbody', {});
    const count = h('span', { class: 'mu', 'data-testid': 'dh-count' });
    const draw = () => {
        const rows = (d.records ?? []).filter((r) => !q || r.search.includes(q));
        const cap = view === 'ozet' ? 8 : 60;
        const shown = rows.slice(0, cap);
        tbody.replaceChildren(...shown.map((r) => h('tr', { class: r.tone, 'data-testid': 'dh-row' }, ...r.cells.map((c, i) => h('td', {}, i === 0 && r.href ? h('a', { href: r.href }, c) : c)))));
        count.textContent = d.records ? `${rows.length} kayıt${rows.length > shown.length ? ` (ilk ${shown.length} gösteriliyor${view === 'ozet' ? ' — tamamı Kayıtlar bölümünde' : ' — aramayı daraltın'})` : ''}` : '';
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
