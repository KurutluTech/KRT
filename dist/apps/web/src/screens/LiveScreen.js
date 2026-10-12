// KMI NEXT — KMI LIVE (matrix 45, migration 0045). Fabrika ekranı: makine durumu, çalışan iş, vardiya
// sağlam/fire, bekletme, bakım, bugünkü OEE (eksik verisiyle), sipariş ilerlemesi, vardiya karşılaştırması.
// Dürüstlük: makine durumu insanların girdiği kayıttır — telemetri bağlı değil ve ekran bunu her zaman
// yazar; kaydı olmayan makinede "ne zamandan beri" BİLİNMİYOR; çalışan iş varken 8 saattir kayıt yoksa
// GECİKMİŞ. Ekran görünümü (PUBLIC) kişi adı, müşteri ve para içermez (sunucu öyle üretir).
// Kiosk: giriş yok, yalnız ekran anahtarı (#/ekran?t=...) — PUBLIC.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { FRESHNESS_TR } from '../../../../packages/domain/src/live.js';
import { machineState, HEADLINE_TR, AVAILABILITY_TR, PHYSICAL_TR, MACHINE_CLASS_TR, MACHINE_CLASS_UNKNOWN_TR } from '../../../../packages/domain/src/machineState.js';
import { machineIcon } from '../machineIcons.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const CSS = `
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
`;
const NUM = new Intl.NumberFormat('tr-TR');
const fmt = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : 'BİLİNMİYOR');
const ORDER_TR = { LATE: 'GECİKMİŞ', DUE_SOON: 'YAKLAŞIYOR', ON_TRACK: 'ZAMANINDA' };
const errText = (e) => sharedErrorText(e);
export async function renderLiveScreen(container, api, state) {
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
    const go = (patch) => void renderLiveScreen(container, api, { ...state, message: null, error: null, newToken: null, ...patch });
    const machineTile = (m) => {
        const ms = machineState({ status: m.status, active: m.active });
        const mi = info.get(m.code);
        const cls = mi?.machineClass ?? null;
        const clsTr = cls && cls in MACHINE_CLASS_TR ? MACHINE_CLASS_TR[cls] : MACHINE_CLASS_UNKNOWN_TR;
        return h('div', { class: 'm', 'data-testid': 'live-machine', 'data-code': m.code, 'data-status': m.status, 'data-headline': ms.headline, 'data-class': cls ?? 'UNKNOWN' }, h('div', { class: 'mh' }, h('span', { class: 'ico' }, machineIcon(cls, 38)), h('div', { style: 'min-width:0' }, h('div', { class: m.code.length > 5 ? 'code long' : 'code' }, m.code), mi ? h('div', { class: 'small', 'data-testid': 'live-name' }, mi.name) : null), h('span', { class: 'st', 'data-testid': 'live-status', title: AVAILABILITY_TR[ms.availability] }, HEADLINE_TR[ms.headline])), h('div', { class: 'small', 'data-testid': 'live-class' }, clsTr), ms.conflict ? h('div', { class: 'conflict', 'data-testid': 'live-conflict' }, `Kayıt: ${AVAILABILITY_TR[ms.availability]} — ama aktif iş emri var`) : null, h('div', { class: 'small', 'data-testid': 'live-since' }, `Durum kaydı: ${fmt(m.since)}`), ...m.active.map((a) => h('div', { class: 'wo', 'data-testid': 'live-active' }, `${a.productCode ?? '—'}${a.opNo !== null ? ` · op ${a.opNo}` : ''} · İE ${a.wo}`, h('div', { class: 'small' }, a.operator !== undefined ? `Operatör: ${a.operator ?? 'yok'}` : a.hasOperator ? 'Operatör var' : 'Operatör yok'))), m.active.length ? null : h('div', { class: 'small' }, 'Çalışan iş yok'), h('div', { class: 'row3' }, h('div', {}, h('div', { class: 'small' }, 'Sağlam'), h('div', { class: 'num', 'data-testid': 'live-good' }, NUM.format(m.shiftGood))), h('div', {}, h('div', { class: 'small' }, 'Fire'), h('div', { class: 'num', 'data-testid': 'live-scrap' }, NUM.format(m.shiftScrap))), h('div', {}, h('div', { class: 'small' }, 'OEE bugün'), h('div', { class: m.oeeToday === null ? 'num unk' : 'num', 'data-testid': 'live-oee' }, m.oeeToday === null ? 'VERİ YOK' : percentLabel(m.oeeToday)))), m.openHolds ? h('div', { 'data-testid': 'live-hold', style: 'font-size:12px;font-weight:800;color:#fca5a5' }, `${m.openHolds} kalite bekletmesi`) : null, m.openMaintenance ? h('div', { 'data-testid': 'live-maint', style: 'font-size:12px;font-weight:800;color:#fcd34d' }, `${m.openMaintenance} açık bakım kaydı`) : null);
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
    const states = (bd) => bd.machines.map((m) => machineState({ status: m.status, active: m.active }));
    const kpiStrip = (bd) => {
        const st = states(bd);
        const n = (f) => st.filter(f).length;
        const k = (v, label, cls = '', tid) => h('div', { class: `kpi ${cls}`, ...(tid ? { 'data-testid': tid } : {}) }, h('b', {}, String(v)), h('span', {}, label));
        return h('div', { class: 'kpis', 'data-testid': 'live-totals' }, k(bd.machines.length, 'kayıtlı ekipman'), k(n((x) => x.headline === 'ACTIVE_WORK_ORDER'), 'aktif iş emri olan makine'), k(n((x) => x.headline === 'READY_IDLE'), 'hazır · boşta'), k(n((x) => x.availability === 'DOWN'), 'arıza', n((x) => x.availability === 'DOWN') ? 'bad' : ''), k(n((x) => x.availability === 'MAINTENANCE' || x.availability === 'HOLD'), 'bakım / bekletme'), k(bd.totals.openHolds, 'kalite bekletmesi', bd.totals.openHolds ? 'bad' : ''), k('BİLİNMİYOR', 'fiziksel çalışma (CNC bağlantısı yok)', 'unk', 'live-physical'));
    };
    const GROUPS = [['ALL', 'Tümü', null], ['ACTIVE', 'Aktif iş emri', ['ACTIVE_WORK_ORDER', 'FIRST_PIECE']], ['READY', 'Hazır · boşta', ['READY_IDLE']], ['DOWN', 'Arıza', ['DOWN']], ['MAINT', 'Bakım / bekletme', ['MAINTENANCE', 'HOLD']]];
    const tabsRow = (bd) => {
        const st = states(bd);
        const row = h('div', { class: 'tabs', 'data-testid': 'live-tabs', role: 'group', 'aria-label': 'Makine filtresi' });
        for (const [key, label, heads] of GROUPS) {
            const count = heads ? st.filter((x) => heads.includes(x.headline)).length : st.length;
            row.append(h('button', { type: 'button', class: 'tab', 'data-group': key, 'aria-pressed': key === 'ALL' ? 'true' : 'false', onClick: (e) => {
                    for (const t of Array.from(row.children))
                        t.setAttribute('aria-pressed', t === e.currentTarget ? 'true' : 'false');
                    container.querySelectorAll('[data-testid="live-machine"]').forEach((el) => { el.hidden = !!heads && !heads.includes(el.dataset.headline ?? ''); });
                } }, `${label} ${count}`));
        }
        return row;
    };
    const b = board;
    mount(container, h('div', { class: `live${state.mode === 'KIOSK' ? ' kiosk' : ''}`, 'data-testid': 'live', 'data-profile': profile }, h('style', {}, CSS), h('div', { class: 'bar' }, h('h1', { style: 'margin:6px 0', 'data-testid': 'live-heading' }, b?.display ? `KMI LIVE — ${b.display}` : 'KMI LIVE'), b ? h('span', { class: 'chip', 'data-testid': 'live-shift' }, b.shift ? `Vardiya ${b.shift}` : 'Üretim vardiyası dışında') : null, state.mode === 'APP' ? h('button', { type: 'button', 'data-testid': 'live-profile-toggle', onClick: () => go({ profile: profile === 'OFFICE' ? 'PUBLIC' : 'OFFICE' }) }, profile === 'OFFICE' ? 'Ekran görünümü (atölye)' : 'Ofis görünümü') : null), loadError ? h('div', { 'data-testid': 'live-error', style: 'padding:10px;border-radius:8px;background:#7f1d1d;color:#fecaca' }, loadError === 'DISPLAY_TOKEN_INVALID' ? 'Ekran anahtarı geçersiz veya iptal edilmiş.' : `Yüklenemedi: ${loadError}`) : null, state.error ? h('div', { 'data-testid': 'live-action-error', style: 'padding:8px;border-radius:8px;background:#7f1d1d;color:#fecaca' }, state.error) : null, state.message ? h('div', { 'data-testid': 'live-message', style: 'padding:8px;border-radius:8px;background:#14532d;color:#bbf7d0' }, state.message) : null, state.newToken ? h('div', { 'data-testid': 'live-new-link', style: 'padding:8px;border-radius:8px;background:#422006;color:#fde68a;font-size:12px;overflow-wrap:anywhere' }, 'Bu bağlantı yalnız şimdi gösterilir, saklanmaz: ', h('code', {}, state.newToken)) : null, b ? h('div', { 'data-testid': 'live-honesty', style: 'padding:8px 12px;border-radius:10px;background:#2a1c05;border:1px solid #78350f;color:#fde68a;font-size:12px' }, `Telemetri bağlı değil: ${b.sourceNote} · ${PHYSICAL_TR} · ${FRESHNESS_TR[b.productionFreshness]} · Son üretim kaydı: ${fmt(b.lastProductionEventAt)} · Güncellendi: ${fmt(b.generatedAt)}`) : null, b ? kpiStrip(b) : null, b ? h('section', { class: 'panel' }, h('h2', {}, 'Makine durumu'), tabsRow(b), h('div', { class: 'grid', 'data-testid': 'live-grid' }, ...b.machines.map(machineTile))) : null, b ? h('section', { class: 'panel' }, h('h2', {}, 'Sipariş ilerlemesi (en yakın termin)'), b.orders.length ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'live-orders' }, h('tbody', {}, ...b.orders.map((o) => h('tr', { 'data-testid': 'live-order', 'data-state': o.state }, h('td', {}, o.productCode ?? '—'), o.customerPo !== undefined ? h('td', {}, o.customerPo ?? '—') : null, h('td', {}, o.dueDate), h('td', {}, `${NUM.format(o.produced)}/${NUM.format(o.qty)} üretim · ${NUM.format(o.shipped)} sevk`), h('td', { style: 'font-weight:800' }, ORDER_TR[o.state] ?? o.state))))))
        : h('div', { class: 'small' }, 'Açık sipariş satırı yok.')) : null, b ? h('section', { class: 'panel' }, h('h2', {}, 'Vardiya karşılaştırması (dün / bugün)'), b.shiftCompare.length ? h('table', { 'data-testid': 'live-compare' }, h('tbody', {}, ...b.shiftCompare.map((x) => h('tr', {}, h('td', {}, x.day), h('td', {}, x.shift === 'OUT_OF_SHIFT' ? 'vardiya dışı' : x.shift), h('td', {}, `${NUM.format(x.good)} sağlam`), h('td', {}, `${NUM.format(x.scrap)} fire`)))))
        : h('div', { class: 'small', 'data-testid': 'live-compare-empty' }, 'Dün ve bugün üretim kaydı yok (VERİ YOK — "sıfır üretim" anlamına gelmez).')) : null, displays ? displaysPanel(displays) : null));
    const ms = state.refreshMs ?? 30000;
    if (ms > 0)
        setTimeout(() => { if (container.isConnected && container.querySelector('[data-testid="live"]'))
            void renderLiveScreen(container, api, { ...state, message: null, error: null, newToken: null }); }, ms);
}
