// r19 — CUT/PREP başlangıç hazırlık paneli. Tek kanonik kaynak: sunucudaki cutprep_start_panel (aynı başlatma kapıları, aynı kayıtlar).
//  • Salt okunur: hiçbir kapıyı gevşetmez, hiçbir kayıt/atama yazmaz. Eksik koşulun yanında ilgili işlem ekranına geçiş bağlantısı vardır.
//  • Diğer operasyonların (OP10…OP50) eksikleri CUT/PREP'i engellemez; yalnız bilgi olarak, ayrı bölümde gösterilir.
//  • Beş aşama ayrıdır: hazırlık → kontrollü ilk parça → gerçek ölçüm → yetkili kalite kabulü → seri üretim izni.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
const ST = {
    READY: { tr: 'HAZIR', cls: 'ok' }, MISSING: { tr: 'EKSİK', cls: 'no' }, PENDING_APPROVAL: { tr: 'ONAY BEKLİYOR', cls: 'wait' },
    PHYSICAL_PENDING: { tr: 'FİZİKSEL İŞLEM BEKLİYOR', cls: 'phys' }, NOT_REQUIRED: { tr: 'BU OPERASYON İÇİN GEREKLİ DEĞİL', cls: 'na' },
};
const GROUPS = [['MALZEME', 'Malzeme'], ['MAKINE', 'Makine'], ['PERSONEL', 'Personel ve planlama'], ['KALITE', 'Kalite ve teknik hazırlık']];
const STAGE_TR = { DONE: 'Tamam', CURRENT: 'Şimdi', WAITING: 'Bekliyor' };
const REFUSAL_TR = {
    OPERATOR_REQUIRED: 'Başlatmak için bir operatör seçilmeli.', MACHINE_REQUIRED: 'Makine seçilmeli.', MATERIAL_NOT_READY: 'Malzeme hazır değil.', CUT_SPEC_MISSING: 'Kesim ölçüleri eksik.',
    OPERATOR_NOT_QUALIFIED: 'Seçilen operatör bu işte yetkili değil.', OPERATOR_QUALIFICATION_EXPIRED: 'Operatörün beceri süresi dolmuş.', MACHINE_BUSY: 'Makine başka işte.',
    QUALITY_HOLD_OPEN: 'Açık kalite HOLD var.', OPERATION_NOT_PENDING: 'Operasyon zaten başlamış ya da kapanmış.', NO_INPUT_QUANTITY: 'Giriş adedi yok.',
};
const refusalText = (c) => { if (!c) return null; const k = Object.keys(REFUSAL_TR).find((x) => String(c).startsWith(x)); return k ? REFUSAL_TR[k] : 'Sistem başlatmaya izin vermiyor (' + c + ').'; };
const g = (o, a, b) => (o ? (o[a] ?? o[b]) : undefined);
const CSS = DS_CSS + `
.cp .row{display:grid;grid-template-columns:minmax(150px,1.2fr) auto minmax(0,2fr) auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #1e293b}
.cp .tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid;white-space:nowrap}
.cp .ok{color:#22c55e;border-color:#22c55e}.cp .no{color:#f87171;border-color:#f87171}.cp .wait{color:#fbbf24;border-color:#fbbf24}.cp .phys{color:#38bdf8;border-color:#38bdf8}.cp .na{color:#94a3b8;border-color:#475569}
.cp .stages{display:flex;gap:6px;flex-wrap:wrap}.cp .stage{padding:6px 10px;border:1px solid #334155;border-radius:10px;font-size:13px}.cp .stage.DONE{border-color:#22c55e}.cp .stage.CURRENT{border-color:#fbbf24}
.cp .mut{color:#94a3b8;font-size:13px}.cp details{margin-top:6px}.cp .cand{font-size:13px;padding:3px 0}
@media(max-width:700px){.cp .row{grid-template-columns:1fr auto}.cp .row .d{grid-column:1/3}}`;
export function renderCutPrepPanelScreen(container, api, opts = {}) {
    const wo = opts.wo;
    const shell = (...body) => mount(container, h('div', { class: 'kd cp' }, h('style', {}, CSS), h('h1', { 'data-testid': 'cp-heading' }, 'CUT/PREP başlangıç hazırlığı'), ...body));
    if (!wo) {
        shell(h('div', { class: 'banner' }, 'Bir iş emri seçin: İş Emirleri ekranından ya da Görevlerim\'deki ilgili görevden bu panele gelinir. '), h('a', { class: 'btn', href: '#/is-emirleri' }, 'İş Emirleri →'));
        return;
    }
    shell(h('div', { class: 'mut' }, 'Yükleniyor…'));
    api.panel(wo).then((p) => {
        if (p?.setupPending) { shell(h('div', { class: 'banner' }, 'Bu panel için sunucu kurulumu bekleniyor.')); return; }
        if (p && p.applicable === false) { shell(h('div', { class: 'banner' }, p.reason ?? 'Bu iş emrinde CUT/PREP operasyonu yok.')); return; }
        const items = p.items ?? [], stages = p.stages ?? [], cands = p.candidates ?? [], later = g(p, 'laterOps', 'later_ops') ?? [], deps = p.dependencies ?? [];
        const refusal = refusalText(g(p, 'startRefusal', 'start_refusal'));
        const row = (it) => { const st = ST[it.status] ?? ST.MISSING; const go = it.status === 'READY' || it.status === 'NOT_REQUIRED' ? null : it.route;
            return h('div', { class: 'row', 'data-testid': 'cp-item', 'data-key': it.key, 'data-status': it.status },
                h('b', {}, it.label), h('span', { class: 'tag ' + st.cls }, st.tr), h('span', { class: 'd mut' }, it.detail ?? ''),
                go ? h('a', { class: 'btn ghost', href: go, 'data-testid': 'cp-go' }, 'İlgili ekrana git →') : h('span', {})); };
        const grp = (key, title) => { const list = items.filter((x) => x.group === key); return list.length ? h('section', { class: 'card' }, h('h3', {}, title), ...list.map(row)) : null; };
        const candBlock = h('details', { 'data-testid': 'cp-cands' }, h('summary', {}, 'Operatör adayları ve neden uygun/uygun değil (' + cands.length + ' kişi)'),
            h('div', { class: 'mut' }, 'Sistem kendiliğinden operatör atamaz ve yetki değiştirmez; seçim yönetimde yapılır.'),
            ...cands.map((c) => { const why = c.reasons ?? []; const auth = c.authorized;
                return h('div', { class: 'cand' }, h('b', {}, c.name), ' — ', auth ? h('span', { class: 'tag ok' }, 'MAKİNE+BECERİ UYGUN') : h('span', { class: 'tag no' }, 'UYGUN DEĞİL'), why.length ? ' · ' + why.join(' · ') : ''); }));
        const laterBlock = h('details', { 'data-testid': 'cp-later' }, h('summary', {}, 'Sonraki operasyonların eksikleri (CUT/PREP\'i engellemez)'),
            ...later.map((l) => { const miss = g(l, 'missing', 'missing'), dg = g(l, 'docGate', 'doc_gate'); return h('div', { class: 'cand' }, h('b', {}, 'OP' + g(l, 'opNo', 'op_no')), ' — ', miss || dg ? 'eksik: ' + [miss, dg].filter(Boolean).join(', ') : 'eksik yok'); }));
        mount(container, h('div', { class: 'kd cp' }, h('style', {}, CSS), h('h1', { 'data-testid': 'cp-heading' }, 'CUT/PREP başlangıç hazırlığı'),
            h('div', { class: 'mut' }, 'Makine ' + (g(p, 'machineCode', 'machine_code') ?? '?') + ' · ' + (g(p, 'opName', 'op_name') ?? '') + ' · Bu panel yalnız gösterir; hiçbir kapıyı gevşetmez, kayıt yazmaz.'),
            h('div', { class: 'stages', 'data-testid': 'cp-stages' }, ...stages.map((s) => h('div', { class: 'stage ' + s.state }, s.n + '. ' + s.label + ' — ' + (STAGE_TR[s.state] ?? s.state)))),
            refusal ? h('div', { class: 'banner', 'data-testid': 'cp-refusal' }, 'Sistemin başlatma kapısı şu an: ' + refusal) : h('div', { class: 'banner ok', 'data-testid': 'cp-gate-open' }, 'Sistemin başlatma kapısı bu operasyon için açık görünüyor.'),
            deps.length ? h('div', { class: 'banner' }, 'Gerçek bağımlılık: ' + deps.map((d) => 'OP' + g(d, 'dependsOnOpNo', 'depends_on_op_no')).join(', ')) : h('div', { class: 'mut' }, 'CUT/PREP başka bir operasyona bağlı değil; OP10–OP50 eksikleri bunu engellemez.'),
            ...GROUPS.map(([k, t]) => grp(k, t)), candBlock, laterBlock));
    }, (e) => shell(h('div', { class: 'banner error', 'data-testid': 'cp-error' }, errorText(e))));
}
