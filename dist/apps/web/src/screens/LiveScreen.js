// KMI NEXT — KMI LIVE (matrix 45, migration 0045). Fabrika ekranı: makine durumu, çalışan iş, vardiya
// sağlam/fire, bekletme, bakım, bugünkü OEE (eksik verisiyle), sipariş ilerlemesi, vardiya karşılaştırması.
// Dürüstlük: makine durumu insanların girdiği kayıttır — telemetri bağlı değil ve ekran bunu her zaman
// yazar; kaydı olmayan makinede "ne zamandan beri" BİLİNMİYOR; çalışan iş varken 8 saattir kayıt yoksa
// GECİKMİŞ. Ekran görünümü (PUBLIC) kişi adı, müşteri ve para içermez (sunucu öyle üretir).
// Kiosk: giriş yok, yalnız ekran anahtarı (#/ekran?t=...) — PUBLIC.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { FRESHNESS_TR, MACHINE_STATUS_TR } from '../../../../packages/domain/src/live.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const CSS = `
.live{padding:0 12px;box-sizing:border-box;max-width:100%;font-variant-numeric:tabular-nums}
.live.kiosk{background:#0b1220;color:#e2e8f0;min-height:100vh;padding:12px}
.live .bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}
.live .chip{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#0f172a}
.live .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:10px 0}
.live .m{border-radius:12px;padding:8px 10px;background:#fff;border:1px solid #e2e8f0;border-top:6px solid #94a3b8;min-width:0}
.live.kiosk .m{background:#111a2e;border-color:#1e293b}
.live .m[data-status="UP"]{border-top-color:#16a34a}.live .m[data-status="DOWN"]{border-top-color:#dc2626}
.live .m[data-status="MAINTENANCE"]{border-top-color:#f59e0b}.live .m[data-status="HOLD"]{border-top-color:#7c3aed}
.live .code{font-size:24px;font-weight:900;letter-spacing:.02em;overflow-wrap:anywhere;min-width:0}
.live .small{font-size:11px;opacity:.75;overflow-wrap:anywhere}
.live .num{font-size:18px;font-weight:800}
.live table{border-collapse:collapse;font-size:12px;width:100%}.live td,.live th{padding:3px 4px;text-align:left}
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
    const go = (patch) => void renderLiveScreen(container, api, { ...state, message: null, error: null, newToken: null, ...patch });
    const machineTile = (m) => h('div', { class: 'm', 'data-testid': 'live-machine', 'data-code': m.code, 'data-status': m.status }, h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 6px' }, h('span', { class: 'code' }, m.code), h('span', { 'data-testid': 'live-status', style: 'font-size:12px;font-weight:800' }, MACHINE_STATUS_TR[m.status] ?? m.status)), h('div', { class: 'small', 'data-testid': 'live-since' }, `Durum kaydı: ${fmt(m.since)}`), ...m.active.map((a) => h('div', { 'data-testid': 'live-active', style: 'font-size:13px;margin-top:4px;overflow-wrap:anywhere' }, `${a.productCode ?? '—'}${a.opNo !== null ? ` · op ${a.opNo}` : ''} · İE ${a.wo}`, h('div', { class: 'small' }, a.operator !== undefined ? `Operatör: ${a.operator ?? 'yok'}` : a.hasOperator ? 'Operatör var' : 'Operatör yok'))), m.active.length ? null : h('div', { class: 'small', style: 'margin-top:4px' }, 'Çalışan iş yok'), h('div', { style: 'display:flex;gap:10px;margin-top:6px' }, h('div', {}, h('div', { class: 'small' }, 'Sağlam'), h('div', { class: 'num', 'data-testid': 'live-good' }, NUM.format(m.shiftGood))), h('div', {}, h('div', { class: 'small' }, 'Fire'), h('div', { class: 'num', 'data-testid': 'live-scrap' }, NUM.format(m.shiftScrap))), h('div', {}, h('div', { class: 'small' }, 'OEE bugün'), h('div', { class: 'num', 'data-testid': 'live-oee' }, m.oeeToday === null ? 'VERİ YOK' : percentLabel(m.oeeToday)))), m.openHolds ? h('div', { 'data-testid': 'live-hold', style: 'font-size:12px;font-weight:800;color:#b91c1c' }, `${m.openHolds} kalite bekletmesi`) : null, m.openMaintenance ? h('div', { 'data-testid': 'live-maint', style: 'font-size:12px;font-weight:800;color:#b45309' }, `${m.openMaintenance} açık bakım kaydı`) : null);
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
        return h('details', { 'data-testid': 'live-displays', style: 'margin:12px 0' }, h('summary', { style: 'font-weight:700' }, `Fabrika ekranları (${rows.filter((r) => !r.revokedAt).length} aktif)`), h('p', { class: 'small' }, 'Ekran anahtarıyla açılan sayfa girişsiz çalışır ve yalnız ekran görünümünü (kişi adı, müşteri ve para yok) gösterir. Girişsiz erişim sahip onayıyla açılır; o zamana kadar anahtar çalışmaz.'), ...rows.map((r) => h('div', { 'data-testid': 'live-display-row', style: 'font-size:12px;border-top:1px solid #e2e8f0;padding:4px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, h('b', {}, r.name), r.revokedAt ? ' · iptal edildi' : ` · son görülme: ${r.lastSeenAt ? fmt(r.lastSeenAt) : 'hiç'}`, r.revokedAt ? null : h('button', { type: 'button', 'data-testid': 'live-display-revoke', onClick: () => void revoke(r.id) }, 'İptal et'))), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, name, h('button', { type: 'button', 'data-testid': 'live-display-create', onClick: () => void create() }, 'Ekran ekle')));
    };
    const b = board;
    mount(container, h('div', { class: `live${state.mode === 'KIOSK' ? ' kiosk' : ''}`, 'data-testid': 'live', 'data-profile': profile }, h('style', {}, CSS), h('div', { class: 'bar' }, h('h1', { style: 'margin:6px 0', 'data-testid': 'live-heading' }, b?.display ? `KMI LIVE — ${b.display}` : 'KMI LIVE'), b ? h('span', { class: 'chip', 'data-testid': 'live-shift' }, b.shift ? `Vardiya ${b.shift}` : 'Üretim vardiyası dışında') : null, state.mode === 'APP' ? h('button', { type: 'button', 'data-testid': 'live-profile-toggle', onClick: () => go({ profile: profile === 'OFFICE' ? 'PUBLIC' : 'OFFICE' }) }, profile === 'OFFICE' ? 'Ekran görünümü (atölye)' : 'Ofis görünümü') : null), loadError ? h('div', { 'data-testid': 'live-error', style: 'padding:10px;border-radius:8px;background:#fee2e2;color:#7f1d1d' }, loadError === 'DISPLAY_TOKEN_INVALID' ? 'Ekran anahtarı geçersiz veya iptal edilmiş.' : `Yüklenemedi: ${loadError}`) : null, state.error ? h('div', { 'data-testid': 'live-action-error', style: 'padding:8px;border-radius:8px;background:#fee2e2' }, state.error) : null, state.message ? h('div', { 'data-testid': 'live-message', style: 'padding:8px;border-radius:8px;background:#dcfce7' }, state.message) : null, state.newToken ? h('div', { 'data-testid': 'live-new-link', style: 'padding:8px;border-radius:8px;background:#fef9c3;font-size:12px;overflow-wrap:anywhere' }, 'Bu bağlantı yalnız şimdi gösterilir, saklanmaz: ', h('code', {}, state.newToken)) : null, b ? h('div', { 'data-testid': 'live-honesty', style: 'margin:6px 0;padding:8px;border-radius:8px;background:#fef3c7;color:#78350f;font-size:12px' }, `Telemetri bağlı değil: ${b.sourceNote} · ${FRESHNESS_TR[b.productionFreshness]} · Son üretim kaydı: ${fmt(b.lastProductionEventAt)} · Güncellendi: ${fmt(b.generatedAt)}`) : null, b ? h('div', { 'data-testid': 'live-totals', style: 'display:flex;gap:6px;flex-wrap:wrap' }, h('span', { class: 'chip' }, `${b.totals.up} çalışır`), h('span', { class: 'chip', style: 'background:#fee2e2' }, `${b.totals.down} arıza`), h('span', { class: 'chip', style: 'background:#fef3c7' }, `${b.totals.maintenance} bakım`), h('span', { class: 'chip', style: 'background:#ede9fe' }, `${b.totals.hold} beklemede`), h('span', { class: 'chip' }, `${b.totals.running} makinede iş`), h('span', { class: 'chip', style: 'background:#fee2e2' }, `${b.totals.openHolds} kalite bekletmesi`)) : null, b ? h('div', { class: 'grid' }, ...b.machines.map(machineTile)) : null, b ? h('section', {}, h('h2', { style: 'font-size:16px;margin:8px 0 4px' }, 'Sipariş ilerlemesi (en yakın termin)'), b.orders.length ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'live-orders' }, h('tbody', {}, ...b.orders.map((o) => h('tr', { 'data-testid': 'live-order', 'data-state': o.state }, h('td', {}, o.productCode ?? '—'), o.customerPo !== undefined ? h('td', {}, o.customerPo ?? '—') : null, h('td', {}, o.dueDate), h('td', {}, `${NUM.format(o.produced)}/${NUM.format(o.qty)} üretim · ${NUM.format(o.shipped)} sevk`), h('td', { style: 'font-weight:800' }, ORDER_TR[o.state] ?? o.state))))))
        : h('div', { class: 'small' }, 'Açık sipariş satırı yok.')) : null, b ? h('section', {}, h('h2', { style: 'font-size:16px;margin:8px 0 4px' }, 'Vardiya karşılaştırması (dün / bugün)'), b.shiftCompare.length ? h('table', { 'data-testid': 'live-compare' }, h('tbody', {}, ...b.shiftCompare.map((x) => h('tr', {}, h('td', {}, x.day), h('td', {}, x.shift === 'OUT_OF_SHIFT' ? 'vardiya dışı' : x.shift), h('td', {}, `${NUM.format(x.good)} sağlam`), h('td', {}, `${NUM.format(x.scrap)} fire`)))))
        : h('div', { class: 'small', 'data-testid': 'live-compare-empty' }, 'Dün ve bugün üretim kaydı yok (VERİ YOK — "sıfır üretim" anlamına gelmez).')) : null, displays ? displaysPanel(displays) : null));
    const ms = state.refreshMs ?? 30000;
    if (ms > 0)
        setTimeout(() => { if (container.isConnected && container.querySelector('[data-testid="live"]'))
            void renderLiveScreen(container, api, { ...state, message: null, error: null, newToken: null }); }, ms);
}
