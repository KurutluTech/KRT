// KMI NEXT — KMI LIVE (matrix 45, migration 0045). Fabrika ekranı: makine durumu, çalışan iş, vardiya
// sağlam/fire, bekletme, bakım, bugünkü OEE (eksik verisiyle), sipariş ilerlemesi, vardiya karşılaştırması.
// Dürüstlük: makine durumu insanların girdiği kayıttır — telemetri bağlı değil ve ekran bunu her zaman
// yazar; kaydı olmayan makinede "ne zamandan beri" BİLİNMİYOR; çalışan iş varken 8 saattir kayıt yoksa
// GECİKMİŞ. Ekran görünümü (PUBLIC) kişi adı, müşteri ve para içermez (sunucu öyle üretir).
// Kiosk: giriş yok, yalnız ekran anahtarı (#/ekran?t=...) — PUBLIC.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { FRESHNESS_TR } from '../../../../packages/domain/src/live.js';
import { machineStateOf, HEADLINE_TR, AVAILABILITY_TR, PHYSICAL_TR, DATA_SOURCE_TR, STALE_TR, MACHINE_CLASS_TR, MACHINE_CLASS_UNKNOWN_TR } from '../../../../packages/domain/src/machineState.js';
import { spindleForState } from '../spindle.js';
import { cncDisplay, cncNotes, CNC_TONE_CSS } from '../../../../packages/domain/src/cncTelemetry.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { sumPeriods, distinctActiveWorkOrders, rankMachines, deadlineRisk, scrapShare, meanOee } from '../../../../packages/domain/src/liveKpi.js';
import { passportHref } from '../passport/registry.js';
import { initials } from '../ds.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { distributionBar, CHART_CSS } from '../charts.js';
import { STATE_VISUAL } from '../spindle.js';
const liveDist = (b) => {
    const cnt = {};
    for (const m of b.machines) {
        const k = machineStateOf(m).headline;
        cnt[k] = (cnt[k] ?? 0) + 1;
    }
    return distributionBar({ title: 'Durum dağılımı', unit: 'makine', period: 'şu an (CNC bağlı makinelerde kontrol sinyali, diğerlerinde elle girilen kayıt)', source: 'Canlı pano · makine durum kaydı + CNC canlı veri' }, Object.keys(cnt).map((k) => ({ label: STATE_VISUAL[k].label, value: cnt[k], meaning: 'info', color: STATE_VISUAL[k].color, icon: '●' })));
};
const CSS = CHART_CSS + `
.live{--card:#111c2e;--card2:#0f172a;--line:#1e293b;--line2:#334155;--txt:#e6edf7;--mut:#94a3b8;--red:#ef4444;--amber:#f59e0b;--green:#22c55e;--cyan:#22d3ee;--violet:#a78bfa;
  padding:0;box-sizing:border-box;max-width:100%;font-variant-numeric:tabular-nums;color:var(--txt);display:flex;flex-direction:column;gap:12px}
.live *{box-sizing:border-box}
.live.kiosk{background:#0b1220;min-height:100vh;padding:14px}
.live h1{font-size:20px;margin:0}.live h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:0 0 8px}
.live .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.live .chip{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--line);color:var(--txt)}
.live .panel{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}
.live .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.live .kpi{border:1px solid var(--line);border-radius:12px;padding:10px;background:rgba(2,6,23,.45)}.live .kpi b{display:block;font-size:24px}.live .kpi span{font-size:11px;color:var(--mut)}
.live .kpi.bad{border-color:#7f1d1d}.live .kpi.bad b{color:#fca5a5}.live .kpi.unk b{font-size:13px;color:var(--mut);line-height:1.5}.live .kpi.unk{border-style:dashed}
.live .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.live .tab{background:var(--card2);color:var(--txt);border:1px solid var(--line2);border-radius:999px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer}
.live .tab[aria-pressed="true"]{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
.live .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.live .m{border-radius:14px;padding:12px;background:linear-gradient(160deg,#0f172a,#111c2e);border:1px solid var(--line2);min-width:0;display:flex;flex-direction:column;gap:6px;border-top:4px solid #475569}
.live .m[hidden]{display:none}
.live .m[data-headline="ACTIVE_WORK_ORDER"]{border-top-color:var(--cyan)}.live .m[data-headline="FIRST_PIECE"]{border-top-color:var(--amber)}.live .m[data-headline="READY_IDLE"]{border-top-color:#3b82f6}
.live .m[data-headline="DOWN"]{border-top-color:var(--red)}.live .m[data-headline="MAINTENANCE"]{border-top-color:var(--violet)}.live .m[data-headline="HOLD"]{border-top-color:var(--amber)}
.live .mh{display:flex;gap:10px;align-items:center}.live .ico{color:var(--cyan);flex:none}.live .m[data-headline="DOWN"] .ico{color:var(--red)}
.live .opr{display:flex;gap:8px;align-items:center;margin-top:4px}.live .photo{width:30px;height:30px;border-radius:50%;background:#1e293b;border:1px solid #334155;color:#67e8f9;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;flex:none}.live .photo.anon{color:#b3bfd2}
.live .qty{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;margin-top:4px}.live .qty b{font-size:15px}.live .down{font-size:12px;font-weight:800;color:#fca5a5}
.live .code{font-size:24px;font-weight:900;letter-spacing:.02em;overflow-wrap:anywhere;min-width:0}
.live .code.long{font-size:17px;letter-spacing:0}
.live .num.unk{font-size:12px;color:var(--mut);line-height:1.6}
.live .st{margin-left:auto;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;background:#1e3a8a;color:#bfdbfe;white-space:nowrap}
.live .m[data-headline="ACTIVE_WORK_ORDER"] .st{background:#164e63;color:#a5f3fc}.live .m[data-headline="DOWN"] .st{background:#7f1d1d;color:#fecaca}
.live .m[data-headline="MAINTENANCE"] .st{background:#4c1d95;color:#ddd6fe}.live .m[data-headline="HOLD"] .st,.live .m[data-headline="FIRST_PIECE"] .st{background:#78350f;color:#fde68a}
.live .small{font-size:11px;color:var(--mut);overflow-wrap:anywhere}.live .num{font-size:18px;font-weight:800}
.live .wo{border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:rgba(2,6,23,.4);font-size:13px;overflow-wrap:anywhere}
.live .conflict{font-size:11px;font-weight:800;color:#fde68a;background:#78350f;border-radius:6px;padding:2px 6px}
.live .row3{display:flex;gap:12px;margin-top:2px}
.live table{border-collapse:collapse;font-size:12px;width:100%}.live td,.live th{padding:5px 6px;text-align:left;border-top:1px solid var(--line)}
.live button{background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:7px 12px;font-weight:600;cursor:pointer}
.live input[type=text]{background:#0b1220;color:var(--txt);border:1px solid var(--line2);border-radius:8px;padding:7px}
.live code{overflow-wrap:anywhere}
.live .k8{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}
.live .k8 .kpi b{font-size:26px;overflow-wrap:anywhere}.live .k8 .kpi.unk b{font-size:13px}.live .k8 .kpi{min-width:0}.live .k8 .kpi small{display:block;font-size:10px;color:var(--mut);margin-top:2px}
.live .k8 .kpi.hot{border-color:#7f1d1d}.live .k8 .kpi.hot b{color:#fca5a5}.live .k8 .kpi.warn{border-color:#78350f}.live .k8 .kpi.warn b{color:#fcd34d}.live .k8 .kpi.ok b{color:#86efac}
.live .pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:10px}
.live .pgrid .panel{font-size:12px}.live .pgrid ol,.live .pgrid ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.live .pgrid li{display:flex;gap:8px;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line);padding-top:4px}.live .pgrid li:first-child{border-top:0;padding-top:0}
.live .tone-red{color:#fca5a5}.live .tone-amber{color:#fcd34d}.live .tone-green{color:#86efac}.live .tone-blue{color:#93c5fd}.live .tone-gray{color:var(--mut)}
.live .pp{font-size:11px;color:#67e8f9;text-decoration:none;font-weight:700}
.live .meter{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin:4px 0}.live .meter i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#6366f1)}
`;
const NUM = new Intl.NumberFormat('tr-TR');
const fmt = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : 'BİLİNMİYOR');
const ORDER_TR = { LATE: 'GECİKMİŞ', DUE_SOON: 'YAKLAŞIYOR', ON_TRACK: 'ZAMANINDA' };
const errText = (e) => sharedErrorText(e);
const renderSeq = new WeakMap();
export async function renderLiveScreen(container, api, state) {
    // A newer render of the same container (auto-refresh vs. a button press) supersedes this one: the older result must never overwrite the newer screen.
    const seq = (renderSeq.get(container) ?? 0) + 1;
    renderSeq.set(container, seq);
    const profile = state.mode === 'KIOSK' ? 'PUBLIC' : state.profile ?? 'OFFICE';
    let board = null;
    let loadError = null;
    let displays = null;
    try {
        board = await api.board(profile);
    }
    catch (e) {
        loadError = errText(e);
    }
    if (state.mode === 'APP') {
        try {
            displays = await api.listDisplays();
        }
        catch {
            displays = null;
        }
    }
    const info = new Map();
    if (api.machineInfo) {
        try {
            for (const m of await api.machineInfo())
                info.set(m.code, m);
        }
        catch { /* names/classes are optional: codes only */ }
    }
    let per = null;
    if (state.mode === 'APP' && profile === 'OFFICE' && api.periods) {
        try {
            per = await api.periods(board?.generatedAt ?? new Date().toISOString());
        }
        catch {
            per = null; /* BİLİNMİYOR on the KPIs, never 0 */
        }
    }
    if (renderSeq.get(container) !== seq)
        return;
    const b0 = board; // tiles are only built when the board loaded
    let details = null;
    if (state.mode === 'APP' && profile === 'OFFICE' && api.workDetail) {
        try {
            details = await api.workDetail();
        }
        catch {
            details = null; /* UNKNOWN on the cards, never invented */
        }
    }
    // KMI-HAAS-MTCONNECT-001: CNC signal per machine (bound devices only). Failure / not authorized / not deployed ⇒ no block; nothing is invented.
    // The CNC row rides on the board machine (attached once in createLiveApi().board) - the same fact every other screen reads.
    const cncByCode = new Map();
    if (state.mode === 'APP' && profile === 'OFFICE')
        for (const m of board?.machines ?? [])
            if (m.cnc)
                cncByCode.set(m.code, m.cnc);
    const go = (patch) => void renderLiveScreen(container, api, { ...state, message: null, error: null, newToken: null, ...patch });
    const elapsed = (from, to) => {
        if (!from)
            return 'BİLİNMİYOR';
        const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
        return mins >= 60 ? `${Math.floor(mins / 60)} sa ${mins % 60} dk` : `${mins} dk`;
    };
    const detailFor = (code, product) => details?.find((d) => d.machineCode === code && (d.productCode ?? null) === (product ?? null)) ?? null;
    const cncBlock = (code, ms) => {
        const row = cncByCode.get(code);
        if (!row)
            return null;
        const d = cncDisplay(row);
        const col = CNC_TONE_CSS[d.tone];
        const notes = cncNotes(ms, d);
        const when = d.lastDataAt ? fmt(d.lastDataAt) : 'hiç';
        return h('div', { class: 'cnc', 'data-testid': 'live-cnc', 'data-link': d.link, 'data-state': d.state, 'data-tone': d.tone, style: `border-left:3px solid ${col};padding:4px 8px;margin:6px 0;background:rgba(2,6,23,.35)` }, h('div', { class: 'small', 'data-testid': 'live-cnc-source' }, 'CNC (otomatik sinyal) · Kaynak: CNC — operatör beyanı değil · "çalışıyor" = program koşuyor, talaş kaldırma süresi DEĞİL'), h('div', { 'data-testid': 'live-cnc-link', style: `font-size:12px;font-weight:800;color:${d.link === 'UP' ? '#34d399' : '#fbbf24'}` }, d.linkTr), h('div', { 'data-testid': 'live-cnc-state', style: `font-weight:800;color:${col}` }, `Gerçek durum: ${d.stateTr}`), h('div', { class: 'small', 'data-testid': 'live-cnc-fields' }, d.link === 'UP' ? `Mil: ${d.spindleRpm === null ? 'BİLİNMİYOR' : `${NUM.format(d.spindleRpm)} dev/dk`} · Program: ${d.program ?? 'BİLİNMİYOR'} · Son çevrim: ${d.lastCycleS === null ? 'BİLİNMİYOR' : `${NUM.format(d.lastCycleS)} sn`}` : 'Mil / program / çevrim: güncel değil — gösterilmiyor'), d.link === 'UP' ? h('div', { class: 'small', 'data-testid': 'live-cnc-safety', 'data-alarm-known': String(d.alarmKnown), 'data-estop': d.estop }, d.safetyLine) : null, h('div', { class: 'small', 'data-testid': 'live-cnc-when' }, `Son veri: ${when}`), d.staleWarning ? h('div', { class: 'conflict', 'data-testid': 'live-cnc-stale' }, d.staleWarning) : null, ...notes.map((n) => h('div', { class: 'conflict', 'data-testid': 'live-cnc-note' }, n)));
    };
    const machineTile = (m) => {
        const ms = machineStateOf(m);
        const mi = info.get(m.code);
        const cls = mi?.machineClass ?? null;
        const clsTr = cls && cls in MACHINE_CLASS_TR ? MACHINE_CLASS_TR[cls] : MACHINE_CLASS_UNKNOWN_TR;
        return h('div', { class: 'm', 'data-testid': 'live-machine', 'data-code': m.code, 'data-status': m.status, 'data-headline': ms.headline, 'data-class': cls ?? 'UNKNOWN' }, h('div', { class: 'mh' }, h('span', { class: 'ico' }, spindleForState(ms, 44)), h('div', { style: 'min-width:0' }, h('div', { class: m.code.length > 5 ? 'code long' : 'code' }, m.code), mi ? h('div', { class: 'small', 'data-testid': 'live-name' }, mi.name) : null), h('span', { class: 'st', 'data-testid': 'live-status', title: AVAILABILITY_TR[ms.availability] }, ms.stale ? STALE_TR : HEADLINE_TR[ms.headline])), h('div', { class: 'small', 'data-testid': 'live-datasource', 'data-source': ms.dataSource }, `Veri kaynağı: ${DATA_SOURCE_TR[ms.dataSource]}`), cncBlock(m.code, ms), h('div', { class: 'small' }, h('span', { 'data-testid': 'live-class' }, clsTr), mi?.id && state.mode === 'APP' ? [' · ', h('a', { class: 'pp', href: passportHref('MACHINE', mi.id), 'data-testid': 'live-passport' }, 'Pasaport →')] : null), ms.conflict ? h('div', { class: 'conflict', 'data-testid': 'live-conflict' }, `Kayıt: ${AVAILABILITY_TR[ms.availability]} — ama aktif iş emri var`) : null, h('div', { class: 'small', 'data-testid': 'live-since' }, `Durum kaydı: ${fmt(m.since)}`), ...m.active.map((a) => {
            const d = detailFor(m.code, a.productCode);
            const opName = a.operator !== undefined ? a.operator : d?.operatorName ?? null;
            const named = a.operator !== undefined || d !== null;
            return h('div', { class: 'wo', 'data-testid': 'live-active' }, `${a.productCode ?? '—'}${a.opNo !== null ? ` · op ${a.opNo}` : ''} · İE ${a.wo}`, h('div', { class: 'opr', 'data-testid': 'live-operator' }, h('span', { class: opName ? 'photo' : 'photo anon', 'data-testid': 'live-photo', title: 'Fotoğraf henüz yüklenmedi (güvenli yer tutucu)', 'aria-hidden': 'true' }, opName ? initials(opName) : '•'), h('span', { class: 'small' }, named ? `Operatör: ${opName ?? 'yok'}` : a.hasOperator ? 'Operatör var' : 'Operatör yok')), d ? h('div', { class: 'qty', 'data-testid': 'live-qty' }, h('span', {}, 'Planlanan ', h('b', {}, NUM.format(d.qtyPlanned))), h('span', {}, 'Sağlam ', h('b', {}, NUM.format(d.qtyProduced))), h('span', {}, 'Hurda ', h('b', {}, NUM.format(d.qtyScrap)))) : null, d ? h('div', { class: 'small', 'data-testid': 'live-wo-since' }, `Son durum değişimi: ${fmt(d.since)} · geçen süre ${elapsed(d.since, b0.generatedAt)}`)
                : h('div', { class: 'small', 'data-testid': 'live-wo-unknown' }, state.mode === 'KIOSK' || profile === 'PUBLIC' ? 'Ayrıntı ekran görünümünde gösterilmez.' : 'Planlanan / sağlam / hurda ve geçen süre: BİLİNMİYOR (kaynak okunamadı)'));
        }), m.active.length > 1 ? h('div', { class: 'conflict', 'data-testid': 'live-multi-active' }, `${m.active.length} aktif oturum görünüyor — makine başına yalnız biri olabilir, kontrol edin`) : null, (ms.availability === 'DOWN' || ms.availability === 'MAINTENANCE') ? h('div', { class: 'down', 'data-testid': 'live-downtime' }, `${AVAILABILITY_TR[ms.availability]}: ${m.since ? `kayıttan beri ${elapsed(m.since, b0.generatedAt)}` : 'ne zamandan beri BİLİNMİYOR'}`) : null, m.active.length ? null : h('div', { class: 'small' }, 'Çalışan iş yok'), h('div', { class: 'row3' }, h('div', {}, h('div', { class: 'small' }, 'Sağlam'), h('div', { class: 'num', 'data-testid': 'live-good' }, NUM.format(m.shiftGood))), h('div', {}, h('div', { class: 'small' }, 'Fire'), h('div', { class: 'num', 'data-testid': 'live-scrap' }, NUM.format(m.shiftScrap))), h('div', {}, h('div', { class: 'small' }, 'OEE bugün'), h('div', { class: m.oeeToday === null ? 'num unk' : 'num', 'data-testid': 'live-oee' }, m.oeeToday === null ? 'VERİ YOK' : percentLabel(m.oeeToday)))), m.openHolds ? h('div', { 'data-testid': 'live-hold', style: 'font-size:12px;font-weight:800;color:#fca5a5' }, `${m.openHolds} kalite bekletmesi`) : null, h('div', { class: 'small', 'data-testid': 'live-updated' }, `Güncellendi: ${fmt(b0.generatedAt)}`), m.openMaintenance ? h('div', { 'data-testid': 'live-maint', style: 'font-size:12px;font-weight:800;color:#fcd34d' }, `${m.openMaintenance} açık bakım kaydı`) : null);
    };
    const displaysPanel = (rows) => {
        const name = h('input', { type: 'text', 'data-testid': 'live-display-name', placeholder: 'Ekran adı (ör. Atölye girişi TV)', style: 'flex:1 1 160px;min-width:0' });
        const create = async () => { try {
            const t = await api.createDisplay(name.value);
            go({ newToken: `${location.origin}${location.pathname}#/ekran?t=${t.token}`, message: `${t.name} eklendi.` });
        }
        catch (e) {
            go({ error: errText(e) });
        } };
        const revoke = async (id) => { try {
            await api.revokeDisplay(id, 'ekran kaldırıldı');
            go({ message: 'Ekran anahtarı iptal edildi.' });
        }
        catch (e) {
            go({ error: errText(e) });
        } };
        return h('details', { 'data-testid': 'live-displays', class: 'panel' }, h('summary', { style: 'font-weight:700;cursor:pointer' }, `Fabrika ekranları (${rows.filter((r) => !r.revokedAt).length} aktif)`), h('p', { class: 'small' }, 'Ekran anahtarıyla açılan sayfa girişsiz çalışır ve yalnız ekran görünümünü (kişi adı, müşteri ve para yok) gösterir. Girişsiz erişim sahip onayıyla açılır; o zamana kadar anahtar çalışmaz.'), ...rows.map((r) => h('div', { 'data-testid': 'live-display-row', style: 'font-size:12px;border-top:1px solid #1e293b;padding:4px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, h('b', {}, r.name), r.revokedAt ? ' · iptal edildi' : ` · son görülme: ${r.lastSeenAt ? fmt(r.lastSeenAt) : 'hiç'}`, r.revokedAt ? null : h('button', { type: 'button', 'data-testid': 'live-display-revoke', onClick: () => void revoke(r.id) }, 'İptal et'))), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, name, h('button', { type: 'button', 'data-testid': 'live-display-create', onClick: () => void create() }, 'Ekran ekle')));
    };
    const states = (bd) => bd.machines.map((m) => machineStateOf(m));
    const kpiStrip = (bd) => {
        const st = states(bd);
        const n = (f) => st.filter(f).length;
        const cncN = n((x) => !!x.cnc);
        const k = (v, label, cls = '', tid) => h('div', { class: `kpi ${cls}`, ...(tid ? { 'data-testid': tid } : {}) }, h('b', {}, String(v)), h('span', {}, label));
        return h('div', { class: 'kpis', 'data-testid': 'live-totals' }, k(bd.machines.length, 'kayıtlı ekipman'), k(n((x) => x.headline === 'ACTIVE_WORK_ORDER'), 'aktif iş emri olan makine'), k(n((x) => x.headline === 'READY_IDLE'), 'hazır · boşta'), k(n((x) => x.availability === 'DOWN'), 'arıza', n((x) => x.availability === 'DOWN') ? 'bad' : ''), k(n((x) => x.availability === 'MAINTENANCE' || x.availability === 'HOLD'), 'bakım / bekletme'), k(bd.totals.openHolds, 'kalite bekletmesi', bd.totals.openHolds ? 'bad' : ''), cncN ? k(n((x) => x.cncRunning), `CNC çalışıyor (CNC bağlı ${cncN} makineden)`, '', 'live-physical') : k('BİLİNMİYOR', 'fiziksel çalışma (CNC bağlantısı yok)', 'unk', 'live-physical'));
    };
    const tonePct = (v) => (v === null ? 'VERİ YOK' : `${(v * 100).toFixed(1).replace('.', ',')} %`);
    const kpi8 = (bd) => {
        const t = per ? sumPeriods(per.rows, bd.generatedAt) : null;
        const lb = per?.truncated ? '≥ ' : '';
        const unk = (key, label, why) => h('div', { class: 'kpi unk', 'data-testid': 'live-kpi', 'data-key': key, 'data-known': 'false' }, h('b', {}, 'BİLİNMİYOR'), h('span', {}, label), h('small', {}, why));
        const val = (key, label, v, sub, cls = '') => h('div', { class: `kpi ${cls}`, 'data-testid': 'live-kpi', 'data-key': key, 'data-known': 'true' }, h('b', {}, `${key.startsWith('prod') ? lb : ''}${NUM.format(v)}`), h('span', {}, label), sub ? h('small', {}, sub) : null);
        const periodNote = (x) => (x.declarations ? `${NUM.format(x.declarations)} beyan` : 'beyan kaydı yok');
        const why = state.mode === 'KIOSK' || profile === 'PUBLIC' ? 'ekran görünümünde gösterilmez' : 'kaynak okunamadı';
        const risk = deadlineRisk(bd.orders);
        const sts = bd.machines.map((m) => machineStateOf(m));
        const cncConnected = sts.filter((x) => x.cnc).length;
        const running = sts.filter((x) => x.cncRunning).length;
        return h('div', { class: 'k8', 'data-testid': 'live-kpis' }, t ? val('prod-today', 'Bugün Üretim', t.today.good, periodNote(t.today)) : unk('prod-today', 'Bugün Üretim', why), t ? val('prod-week', 'Bu Hafta', t.week.good, periodNote(t.week)) : unk('prod-week', 'Bu Hafta', why), t ? val('prod-month', 'Bu Ay', t.month.good, periodNote(t.month)) : unk('prod-month', 'Bu Ay', why), t ? val('scrap-today', 'Hurda (Bugün)', t.today.scrap, periodNote(t.today), t.today.scrap > 0 ? 'warn' : '') : unk('scrap-today', 'Hurda (Bugün)', why), val('active-wo', 'Aktif İş Emri', distinctActiveWorkOrders(bd.machines), 'makinede çalışan'), per && per.assigned !== null ? val('assigned', 'Atanmış', per.assigned, 'makineye atanmış, başlamadı') : unk('assigned', 'Atanmış', why), cncConnected ? val('running-machines', 'Çalışan Makine (CNC)', running, `CNC bağlı ${cncConnected} makineden · iş emri sayısından ayrı hesaplanır`, running ? 'ok' : '') : unk('running-machines', 'Çalışan Makine (CNC)', 'CNC bağlantısı yok'), val('deadline-risk', 'Termin Riski', risk, risk ? 'geciken / yaklaşan sipariş' : 'riskli satır yok', risk ? 'hot' : 'ok'));
    };
    const opsPanels = (bd) => {
        const st = (m) => machineStateOf(m);
        const nameOf = (c) => info.get(c)?.name ?? c;
        const li = (tone, left, right) => h('li', {}, h('span', { class: `tone-${tone}` }, left), h('span', {}, right));
        const panel = (key, title, ...kids) => h('section', { class: 'panel', 'data-testid': 'live-panel', 'data-key': key }, h('h2', {}, title), ...kids);
        const empty = (t) => h('div', { class: 'small' }, t);
        const down = bd.machines.filter((m) => st(m).availability === 'DOWN');
        const maint = bd.machines.filter((m) => st(m).availability === 'MAINTENANCE' || st(m).availability === 'HOLD');
        const late = bd.orders.filter((o) => o.state === 'LATE'), soon = bd.orders.filter((o) => o.state === 'DUE_SOON');
        // critical flow: only what the records say is wrong right now, in severity order (red = late/urgent, amber = risk)
        const crit = [
            ...down.map((m) => li('red', `${m.code} · ARIZA`, m.since ? `${elapsed(m.since, bd.generatedAt)}` : 'süre BİLİNMİYOR')),
            ...late.slice(0, 5).map((o) => li('red', `${o.productCode ?? '—'} · GECİKMİŞ`, o.dueDate)),
            ...bd.machines.filter((m) => m.openHolds > 0).map((m) => li('amber', `${m.code} · kalite bekletmesi`, `${m.openHolds}`)),
            ...maint.map((m) => li('amber', `${m.code} · ${AVAILABILITY_TR[st(m).availability]}`, m.since ? elapsed(m.since, bd.generatedAt) : 'süre BİLİNMİYOR')),
            ...soon.slice(0, 5).map((o) => li('amber', `${o.productCode ?? '—'} · termin yaklaşıyor`, o.dueDate)),
        ];
        const ranked = rankMachines(bd.machines).filter((m) => m.shiftGood + m.shiftScrap > 0).slice(0, 8);
        const target = details ? details.reduce((a, d) => ({ plan: a.plan + d.qtyPlanned, got: a.got + d.qtyProduced }), { plan: 0, got: 0 }) : null;
        const operators = details ? [...new Map(details.filter((d) => d.operatorName).map((d) => [d.operatorName, d])).values()] : null;
        const todayScrap = per ? sumPeriods(per.rows, bd.generatedAt).today : null;
        const rate = todayScrap ? scrapShare(todayScrap.good, todayScrap.scrap) : null;
        const oee = meanOee(bd.machines);
        const shipRisk = bd.orders.filter((o) => (o.state === 'LATE' || o.state === 'DUE_SOON') && o.shipped < o.qty);
        return h('div', { class: 'pgrid', 'data-testid': 'live-panels' }, panel('critical', 'Kritik akış', crit.length ? h('ul', {}, ...crit) : empty('Kayıtlara göre şu an kritik durum yok.')), panel('ranking', 'Makine sıralaması (vardiya sağlam)', ranked.length ? h('ol', {}, ...ranked.map((m) => li('blue', `${m.code}${info.get(m.code) ? ` · ${nameOf(m.code)}` : ''}`, `${NUM.format(m.shiftGood)} / fire ${NUM.format(m.shiftScrap)}`))) : empty('Bu vardiyada üretim kaydı yok.')), panel('shift', 'Vardiya ve personel', h('div', {}, bd.shift ? `Vardiya ${bd.shift}` : 'Üretim vardiyası dışında'), operators === null ? empty('Operatör ayrıntısı: BİLİNMİYOR (kaynak okunamadı / ekran görünümü).') : operators.length ? h('ul', {}, ...operators.slice(0, 8).map((d) => li('green', d.operatorName, d.machineCode ?? '—'))) : empty('Şu an makinede çalışan operatör kaydı yok.')), panel('target', 'Hedef / gerçekleşen (çalışan işler)', target === null ? empty('BİLİNMİYOR (kaynak okunamadı / ekran görünümü).') : target.plan > 0
            ? h('div', {}, h('div', {}, `${NUM.format(target.got)} / ${NUM.format(target.plan)} adet`), h('div', { class: 'meter' }, h('i', { style: `width:${Math.min(100, Math.round((target.got / target.plan) * 100))}%` })), h('div', { class: 'small' }, `%${Math.min(999, Math.round((target.got / target.plan) * 100))} · yalnız şu an çalışan iş emirleri`))
            : empty('Çalışan iş emri planı yok.')), panel('downtime', 'Duruş ve kayıplar', down.length + maint.length ? h('ul', {}, ...[...down, ...maint].map((m) => li(st(m).availability === 'DOWN' ? 'red' : 'amber', m.code, m.since ? `${AVAILABILITY_TR[st(m).availability]} · ${elapsed(m.since, bd.generatedAt)}` : `${AVAILABILITY_TR[st(m).availability]} · süre BİLİNMİYOR`))) : empty('Kayıtlı duruş yok. (Telemetri bağlı olmadığından kayıtsız duruş görünmez.)')), panel('quality', 'Kalite', h('div', {}, `${bd.totals.openHolds} açık bekletme`), todayScrap === null ? empty('Bugünkü hurda oranı: BİLİNMİYOR.') : h('div', {}, rate === null ? 'Bugünkü hurda oranı: beyan yok' : `Bugünkü hurda oranı: ${tonePct(rate)}`)), panel('oee', 'OEE', oee.value === null ? empty('VERİ YOK — OEE için yeterli kayıt olan makine yok (100 gösterilmez).') : h('div', {}, h('div', { style: 'font-size:22px;font-weight:800' }, tonePct(oee.value)), h('div', { class: 'small' }, `${oee.counted}/${oee.of} makinenin bugünkü OEE değerinin ortalaması`))), panel('shipping', 'Sevkiyat riski', shipRisk.length ? h('ul', {}, ...shipRisk.slice(0, 6).map((o) => li(o.state === 'LATE' ? 'red' : 'amber', `${o.productCode ?? '—'} · ${ORDER_TR[o.state] ?? o.state}`, `${NUM.format(o.shipped)}/${NUM.format(o.qty)} sevk · ${o.dueDate}`))) : empty('Sevki bekleyen riskli sipariş satırı yok.')));
    };
    const GROUPS = [['ALL', 'Tümü', null], ['ACTIVE', 'Aktif iş emri', ['ACTIVE_WORK_ORDER', 'FIRST_PIECE']], ['CNC', 'CNC sinyali (iş emri yok / bekleme / bayat)', ['CNC_RUNNING', 'CNC_FEED_HOLD', 'CNC_STALE']], ['READY', 'Hazır · boşta', ['READY_IDLE']], ['DOWN', 'Arıza', ['DOWN', 'CNC_ALARM']], ['MAINT', 'Bakım / bekletme', ['MAINTENANCE', 'HOLD']]];
    const tabsRow = (bd) => {
        const st = states(bd);
        const row = h('div', { class: 'tabs', 'data-testid': 'live-tabs', role: 'group', 'aria-label': 'Makine filtresi' });
        for (const [key, label, heads] of GROUPS) {
            const count = heads ? st.filter((x) => heads.includes(x.headline)).length : st.length;
            row.append(h('button', { type: 'button', class: 'tab', 'data-group': key, 'aria-pressed': key === (state.group ?? 'ALL') ? 'true' : 'false', onClick: (e) => {
                    state.group = key;
                    for (const t of Array.from(row.children))
                        t.setAttribute('aria-pressed', t === e.currentTarget ? 'true' : 'false');
                    container.querySelectorAll('[data-testid="live-machine"]').forEach((el) => { el.hidden = !!heads && !heads.includes(el.dataset.headline ?? ''); });
                } }, `${label} ${count}`));
        }
        return row;
    };
    const b = board;
    mount(container, h('div', { class: `live${state.mode === 'KIOSK' ? ' kiosk' : ''}`, 'data-testid': 'live', 'data-profile': profile }, h('style', {}, CSS), h('div', { class: 'bar' }, h('h1', { style: 'margin:6px 0', 'data-testid': 'live-heading' }, b?.display ? `KURUTLU LIVE — ${b.display}` : 'KURUTLU LIVE — Fabrika Performansı · Canlı Operasyon'), b ? h('span', { class: 'chip', 'data-testid': 'live-shift' }, b.shift ? `Vardiya ${b.shift}` : 'Üretim vardiyası dışında') : null, state.mode === 'APP' ? h('button', { type: 'button', 'data-testid': 'live-profile-toggle', onClick: () => go({ profile: profile === 'OFFICE' ? 'PUBLIC' : 'OFFICE' }) }, profile === 'OFFICE' ? 'Ekran görünümü (atölye)' : 'Ofis görünümü') : null), loadError ? h('div', { 'data-testid': 'live-error', style: 'padding:10px;border-radius:8px;background:#7f1d1d;color:#fecaca' }, loadError === 'DISPLAY_TOKEN_INVALID' ? 'Ekran anahtarı geçersiz veya iptal edilmiş.' : `Yüklenemedi: ${loadError}`) : null, state.error ? h('div', { 'data-testid': 'live-action-error', style: 'padding:8px;border-radius:8px;background:#7f1d1d;color:#fecaca' }, state.error) : null, state.message ? h('div', { 'data-testid': 'live-message', style: 'padding:8px;border-radius:8px;background:#14532d;color:#bbf7d0' }, state.message) : null, state.newToken ? h('div', { 'data-testid': 'live-new-link', style: 'padding:8px;border-radius:8px;background:#422006;color:#fde68a;font-size:12px;overflow-wrap:anywhere' }, 'Bu bağlantı yalnız şimdi gösterilir, saklanmaz: ', h('code', {}, state.newToken)) : null, b ? h('div', { 'data-testid': 'live-honesty', style: 'padding:8px 12px;border-radius:10px;background:#2a1c05;border:1px solid #78350f;color:#fde68a;font-size:12px' }, `Telemetri bağlı değil: ${b.sourceNote} · ${PHYSICAL_TR} · ${FRESHNESS_TR[b.productionFreshness]} · Son üretim kaydı: ${fmt(b.lastProductionEventAt)} · Güncellendi: ${fmt(b.generatedAt)}`) : null, b ? kpi8(b) : null, b ? opsPanels(b) : null, b ? kpiStrip(b) : null, b ? h('section', { class: 'panel' }, h('h2', {}, 'Makine durumu'), liveDist(b), tabsRow(b), h('div', { class: 'grid', 'data-testid': 'live-grid' }, ...b.machines.map(machineTile))) : null, b ? h('section', { class: 'panel' }, h('h2', {}, 'Sipariş ilerlemesi (en yakın termin)'), b.orders.length ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'live-orders' }, h('tbody', {}, ...b.orders.map((o) => h('tr', { 'data-testid': 'live-order', 'data-state': o.state }, h('td', {}, o.productCode ?? '—'), o.customerPo !== undefined ? h('td', {}, o.customerPo ?? '—') : null, h('td', {}, o.dueDate), h('td', {}, `${NUM.format(o.produced)}/${NUM.format(o.qty)} üretim · ${NUM.format(o.shipped)} sevk`), h('td', { style: 'font-weight:800' }, ORDER_TR[o.state] ?? o.state))))))
        : h('div', { class: 'small' }, 'Açık sipariş satırı yok.')) : null, b ? h('section', { class: 'panel' }, h('h2', {}, 'Vardiya karşılaştırması (dün / bugün)'), b.shiftCompare.length ? h('table', { 'data-testid': 'live-compare' }, h('tbody', {}, ...b.shiftCompare.map((x) => h('tr', {}, h('td', {}, x.day), h('td', {}, x.shift === 'OUT_OF_SHIFT' ? 'vardiya dışı' : x.shift), h('td', {}, `${NUM.format(x.good)} sağlam`), h('td', {}, `${NUM.format(x.scrap)} fire`)))))
        : h('div', { class: 'small', 'data-testid': 'live-compare-empty' }, 'Dün ve bugün üretim kaydı yok (VERİ YOK — "sıfır üretim" anlamına gelmez).')) : null, displays ? displaysPanel(displays) : null));
    const sel = GROUPS.find((g) => g[0] === state.group);
    if (sel && sel[2])
        container.querySelectorAll('[data-testid="live-machine"]').forEach((el) => { el.hidden = !sel[2].includes(el.dataset.headline ?? ''); });
    const ms = state.refreshMs ?? 30000;
    // Auto-refresh re-renders the whole screen; never do that while the person is working in the screen-management panel
    // (it would collapse the panel and wipe what they are typing) — try again on the next tick instead.
    const tick = () => {
        if (!container.isConnected || !container.querySelector('[data-testid="live"]'))
            return;
        if (renderSeq.get(container) !== seq)
            return; // a newer render owns the timer now
        // the show-once display link must stay on screen until the person acts (it is never stored)
        const busy = !!container.querySelector('[data-testid="live-new-link"]') || !!container.querySelector('[data-testid="live-displays"][open]') || (container.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement);
        if (busy) {
            setTimeout(tick, ms);
            return;
        }
        void renderLiveScreen(container, api, { ...state, message: null, error: null, newToken: null });
    };
    if (ms > 0)
        setTimeout(tick, ms);
}
