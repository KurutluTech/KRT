// KMI — Muhasebe / Ticari Onay kuyruğu. Kalite çıkışlı stok partilerinin (AVAILABLE/RESERVED) ticari onay yolculuğu tek listede:
//   1) talep bekleyen partiler  2) yönetim onayı bekleyen talepler  3) muhasebe/ticari karar bekleyen talepler  4) karar geçmişi (gerekçeyle).
// Kalite onayı, yönetim onayı, ticari karar ve sevkiyat birbirinin yerine geçmez: her düğme kendi RPC'sini çağırır, sunucu kendi yetkisini ister
// (yetkisizse Türkçe red mesajı). Gerekçe zorunludur (en az 5 karakter). Çift bekleyen talep varsa açıkça uyarılır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../errorText.js';
import { DS_CSS, setupPending } from '../ds.js';
const fmt = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const STATE_TR = { AVAILABLE: 'Satışa hazır', RESERVED: 'Rezerve' };
const DEC_TR = { APPROVED: ['Onaylandı', 'ok'], REJECTED: ['Reddedildi', 'bad'], PENDING: ['Bekliyor', 'warn'] };
export async function renderAccountingQueueScreen(container, api, state = {}) {
    const go = (s) => renderAccountingQueueScreen(container, api, s);
    let approvals;
    let lots;
    let free;
    try {
        approvals = await api.approvals();
        lots = await api.lots([...new Set(approvals.map((a) => a.stockLotId))]);
        free = await api.availableLots();
    }
    catch (e) {
        mount(container, h('div', { class: 'kd', 'data-testid': 'aq-root' }, h('style', {}, DS_CSS), h('h1', {}, 'Muhasebe Kuyruğu'), isSetupPending(e) ? setupPending('Muhasebe Kuyruğu') : h('div', { class: 'banner error', 'data-testid': 'aq-error' }, `Yüklenemedi: ${errorText(e)}`)));
        return;
    }
    const lotOf = (id) => lots.find((l) => l.id === id) ?? free.find((l) => l.id === id) ?? null;
    const lotLabel = (id) => { const l = lotOf(id); return l ? `${l.productCode ?? 'ürün ?'} · ${l.qty} adet · İE ${l.workOrderId.slice(0, 8)}` : `Parti ${id.slice(0, 8)}`; };
    const pending = approvals.filter((a) => a.status === 'PENDING');
    const decided = approvals.filter((a) => a.status !== 'PENDING');
    const waitingMgmt = pending.filter((a) => !a.managementReleasedAt);
    const waitingDecision = pending.filter((a) => a.managementReleasedAt);
    const hasOpen = new Set(approvals.filter((a) => a.status === 'PENDING' || a.status === 'APPROVED').map((a) => a.stockLotId));
    const requestable = free.filter((l) => !hasOpen.has(l.id));
    const dupes = new Set(pending.map((a) => a.stockLotId).filter((id, i, arr) => arr.indexOf(id) !== i));
    let busy = false;
    const act = async (fn, ok) => {
        if (busy)
            return;
        busy = true;
        container.querySelectorAll('.kd button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) } });
        }
    };
    const reasonInput = (testid) => h('input', { type: 'text', placeholder: 'Gerekçe (en az 5 karakter)', 'data-testid': testid, 'aria-label': 'Gerekçe', class: 'grow' });
    const needReason = (r) => { if (r.trim().length < 5) {
        void go({ banner: { kind: 'error', text: 'Gerekçe zorunlu (en az 5 karakter).' } });
        return false;
    } return true; };
    const lotLink = (id) => h('a', { class: 'btn ghost', href: `#/is-emirleri?lot=${encodeURIComponent(id)}`, 'data-testid': 'aq-open-lot' }, 'Parti ekranı');
    const reqRow = (l) => h('div', { class: 'item', 'data-testid': 'aq-free', 'data-lot-id': l.id }, h('div', { class: 'grow' }, h('b', {}, `${l.productCode ?? 'ürün ?'} · ${l.qty} adet`), h('div', { class: 'mut' }, `${STATE_TR[l.state] ?? l.state} · İE ${l.workOrderId.slice(0, 8)}`)), h('button', { type: 'button', class: 'primary', 'data-testid': 'aq-request', onClick: () => void act(() => api.request(l.id), 'Ticari onay talebi açıldı.') }, 'Ticari onay talebi aç'), lotLink(l.id));
    const mgmtRow = (a) => {
        const r = reasonInput('aq-mgmt-reason');
        return h('div', { class: 'item', 'data-testid': 'aq-mgmt', 'data-approval-id': a.id }, h('div', { class: 'grow' }, h('b', {}, lotLabel(a.stockLotId)), h('div', { class: 'mut' }, `Talep: ${fmt(a.requestedAt)}`), dupes.has(a.stockLotId) ? h('span', { class: 'pill bad', 'data-testid': 'aq-dupe' }, 'ÇİFT TALEP') : null), r, h('button', { type: 'button', class: 'warnb', 'data-testid': 'aq-mgmt-btn', onClick: () => { if (needReason(r.value))
                void act(() => api.grantManagementRelease(a.id, r.value.trim()), 'Yönetim onayı verildi.'); } }, 'Yönetim onayı ver'), lotLink(a.stockLotId));
    };
    const decRow = (a) => {
        const r = reasonInput('aq-dec-reason');
        const decide = (d) => { if (needReason(r.value))
            void act(() => api.decide(a.id, d, r.value.trim()), d === 'APPROVED' ? 'Ticari onay verildi.' : 'Talep reddedildi.'); };
        return h('div', { class: 'item', 'data-testid': 'aq-decide', 'data-approval-id': a.id }, h('div', { class: 'grow' }, h('b', {}, lotLabel(a.stockLotId)), h('div', { class: 'mut' }, `Talep: ${fmt(a.requestedAt)} · Yönetim onayı: ${fmt(a.managementReleasedAt)}`), dupes.has(a.stockLotId) ? h('span', { class: 'pill bad', 'data-testid': 'aq-dupe' }, 'ÇİFT TALEP') : null), r, h('button', { type: 'button', class: 'okb', 'data-testid': 'aq-approve', onClick: () => decide('APPROVED') }, 'Onayla'), h('button', { type: 'button', class: 'danger', 'data-testid': 'aq-reject', onClick: () => decide('REJECTED') }, 'Reddet'), lotLink(a.stockLotId));
    };
    const histRow = (a) => h('div', { class: 'item', 'data-testid': 'aq-history', 'data-status': a.status }, h('span', { class: `pill ${DEC_TR[a.status][1]}` }, DEC_TR[a.status][0]), h('div', { class: 'grow' }, h('b', {}, lotLabel(a.stockLotId)), h('div', { class: 'mut' }, `Karar: ${fmt(a.decidedAt)} · Gerekçe: ${a.decisionReason ?? '—'}`)));
    const section = (title, tid, rows, empty) => h('div', { class: 'panel', 'data-testid': tid }, h('h2', {}, `${title} (${rows.length})`), ...(rows.length ? rows : [h('div', { class: 'empty' }, empty)]));
    mount(container, h('div', { class: 'kd', 'data-testid': 'aq-root' }, h('style', {}, DS_CSS + '.kd .item input{flex:1 1 200px}'), h('h1', {}, 'Muhasebe Kuyruğu'), h('div', { class: 'mut' }, 'Kalite çıkışı yapılmış partilerin ticari onay yolculuğu. Kalite, yönetim, muhasebe ve sevkiyat onayları birbirinin yerine geçmez; yetkisiz işlem sunucuda reddedilir.'), state.banner ? h('div', { class: `banner ${state.banner.kind}`, 'data-testid': 'aq-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, h('div', { class: 'kpis', 'data-testid': 'aq-kpis' }, ...[['Talep bekleyen parti', requestable.length], ['Yönetim onayı bekleyen', waitingMgmt.length], ['Karar bekleyen', waitingDecision.length], ['Karar verilen', decided.length]].map(([l, n]) => h('div', { class: 'kpi' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, String(l))))), section('Ticari onay talebi bekleyen partiler', 'aq-sec-free', requestable.map(reqRow), 'Talep bekleyen parti yok.'), section('Yönetim onayı bekleyenler', 'aq-sec-mgmt', waitingMgmt.map(mgmtRow), 'Yönetim onayı bekleyen talep yok.'), section('Muhasebe / ticari karar bekleyenler', 'aq-sec-decide', waitingDecision.map(decRow), 'Karar bekleyen talep yok.'), section('Karar geçmişi', 'aq-sec-history', decided.slice(0, 30).map(histRow), 'Henüz karar verilmiş talep yok.')));
}
