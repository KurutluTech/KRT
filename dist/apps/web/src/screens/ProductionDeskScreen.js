// KMI Production Desk (/uretim) — the production supervisor's view of ALL machines at once: status (canonical eligibility), active work order with progress,
// queue with the server's start-gate answer, and the shop-floor actions (start, declare good/scrap, hold with a loss category, resume, fault, first-piece to quality).
// Every action is the same canonical RPC the operator terminal uses; the server authorises and audits. Unreadable machine = "okunamadı", never "boşta".
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildProductionDesk, GROUP_TR, HOLD_CATEGORIES } from '../../../../packages/domain/src/productionDesk.js';
import { refusalText } from './TerminalScreen.js';
import { errorText } from '../errorText.js';
const CSS = `
.pd{display:flex;flex-direction:column;gap:14px;max-width:1280px}.pd *{box-sizing:border-box}.pd h1{margin:0;font-size:22px}.pd .eb{font-size:10.5px;letter-spacing:.2em;color:#c9a24a;font-weight:700}
.pd .chips{display:flex;gap:8px;flex-wrap:wrap}.pd .chip{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #1a2a46;background:rgba(11,22,42,.6);color:#cbd5e1;cursor:pointer;font:inherit;font-size:13px;display:inline-flex;gap:8px;align-items:center}
.pd .chip[aria-pressed=true]{border-color:#c9a24a;color:#fff;background:rgba(201,162,74,.12)}.pd .chip b{font-size:16px;font-variant-numeric:tabular-nums}
.pd .sum{display:flex;gap:18px;flex-wrap:wrap;color:#b6c3d8;font-size:13px}.pd .sum b{color:#e9eef7;font-size:18px;font-variant-numeric:tabular-nums}
.pd .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(380px,100%),1fr));gap:12px}
.pd .m{border:1px solid #1a2a46;border-top:4px solid #7d8ba3;border-radius:12px;padding:12px 14px;background:rgba(11,22,42,.6);display:flex;flex-direction:column;gap:8px;min-width:0}
.pd .m.red{border-top-color:#f0645a}.pd .m.amber{border-top-color:#e8b04a}.pd .m.green{border-top-color:#5fd0a0}.pd .m.blue{border-top-color:#5cc8e6}
.pd .mh{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.pd .mh b{font-size:17px}.pd .pill{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#1a2a46}
.pd .bar{height:10px;border-radius:6px;background:#12203a;overflow:hidden}.pd .bar i{display:block;height:100%;background:#5fd0a0}.pd .d{color:#b6c3d8;font-size:13px;overflow-wrap:anywhere}.pd .mu{color:#8da0bd;font-size:12.5px}
.pd .q{border-top:1px solid #1a2a46;padding-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between}.pd .ref{color:#f0a49e;font-size:12.5px}
.pd button.b{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #26385a;background:#12203a;color:#e9eef7;font:inherit;font-weight:600;cursor:pointer}.pd button.b.ok{border-color:#2f7d5e;background:#123a2c}.pd button.b.bad{border-color:#8a3a35;background:#3a1614}.pd button.b:disabled{opacity:.45;cursor:not-allowed}
.pd input,.pd select{min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid #26385a;background:#0b162a;color:inherit;font:inherit;font-size:14px;min-width:0}
.pd details summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:#5cc8e6}.pd .ops{display:flex;flex-direction:column;gap:8px;padding-bottom:6px}.pd .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pd .banner{padding:10px 14px;border-radius:10px;font-size:14px}.pd .banner.ok{background:#123a2c;border:1px solid #2f7d5e}.pd .banner.error{background:#3a1614;border:1px solid #8a3a35}
`;
const GROUPS = ['STOPPED', 'HOLD', 'FIRST_PIECE', 'RUNNING', 'READY', 'IDLE', 'UNKNOWN'];
export async function renderProductionDesk(container, api) {
    let machines = undefined;
    let loaded = false;
    let filter = 'ALL';
    let q = '';
    let banner = null;
    let readAt = '';
    const host = h('div', { class: 'pd', 'data-testid': 'pd-root' });
    mount(container, host);
    const reload = async () => { machines = await api.load(); loaded = true; readAt = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); draw(); };
    const act = async (fn, ok) => { try {
        await fn();
        banner = { kind: 'ok', text: ok };
    }
    catch (e) {
        banner = { kind: 'error', text: errorText(e) };
    } await reload(); };
    const refuse = (t) => { banner = { kind: 'error', text: t }; draw(); };
    const card = (c) => {
        const reason = h('input', { type: 'text', placeholder: 'Sebep (zorunlu)', 'aria-label': 'Sebep', 'data-testid': 'pd-reason' });
        const cat = h('select', { 'aria-label': 'Duruş kategorisi', 'data-testid': 'pd-cat' }, ...HOLD_CATEGORIES.map(([v, l]) => h('option', { value: v }, l)));
        const good = h('input', { type: 'number', min: '0', placeholder: 'Sağlam', 'aria-label': 'Sağlam', style: 'width:6.5em', 'data-testid': 'pd-good' });
        const scrap = h('input', { type: 'number', min: '0', placeholder: 'Fire', 'aria-label': 'Fire', style: 'width:6.5em', 'data-testid': 'pd-scrap' });
        const needReason = (fn) => () => { if (reason.value.trim().length < 3)
            return refuse('Sebep yazmadan bu işlem yapılamaz (en az 3 karakter).'); fn(); };
        const a = c.active;
        return h('article', { class: `m ${c.tone}`, 'data-testid': 'pd-machine', 'data-code': c.code, 'data-group': c.group }, h('div', { class: 'mh' }, h('b', {}, `${c.code}`, h('span', { class: 'mu' }, ` ${c.name}`)), h('span', { class: 'pill', 'data-testid': 'pd-group' }, GROUP_TR[c.group])), c.group === 'UNKNOWN' ? h('div', { class: 'd', 'data-testid': 'pd-unknown' }, `Makine durumu okunamadı (${c.error ?? 'bilinmiyor'}) — "boşta" demek değildir.`) : null, c.group === 'STOPPED' ? h('div', { class: 'd' }, `${c.label}: yetkili bakım testiyle açılır. `, h('a', { href: '#/bakim', style: 'color:#5cc8e6' }, 'Bakım →')) : null, a ? h('div', { 'data-testid': 'pd-active' }, h('div', { class: 'd' }, h('b', {}, a.productCode ?? `İş emri ${a.workOrderId.slice(0, 8)}`), ` · ${a.operatorName ?? 'operatör yok'}`), h('div', { class: 'bar' }, h('i', { style: `width:${c.pct ?? 0}%` })), h('div', { class: 'mu' }, `${a.qtyProduced} / ${a.qtyPlanned} sağlam · fire ${a.qtyScrap}`), c.group === 'FIRST_PIECE' ? h('div', { class: 'd' }, 'İlk parça kalite kararı bekliyor → ', h('a', { href: '#/kalite', style: 'color:#5cc8e6' }, 'Kalite Masası')) : null, h('a', { href: `#/nesne?t=WORK_ORDER&id=${encodeURIComponent(a.workOrderId)}`, class: 'mu', style: 'color:#5cc8e6' }, 'İş emri pasaportu →')) : null, ...(c.queue.slice(0, 3).map((w) => h('div', { class: 'q', 'data-testid': 'pd-queue' }, h('span', { class: 'd' }, `${w.productCode ?? w.workOrderId.slice(0, 8)} · ${w.qtyPlanned} adet${w.plannedDate ? ` · ${w.plannedDate}` : ''}`), w.startRefusal ? h('span', { class: 'ref', 'data-testid': 'pd-refusal' }, `Başlatılamaz: ${refusalText(w.startRefusal)}`)
            : h('button', { type: 'button', class: 'b ok', disabled: !!a || !c.eligible, title: a ? 'Makinede çalışan iş var' : '', 'data-testid': 'pd-start', onClick: () => void act(() => api.start(w.workOrderId), `${w.productCode ?? 'İş emri'} başlatıldı.`) }, 'Başlat')))), c.group !== 'UNKNOWN' ? h('details', {}, h('summary', {}, 'İşlemler'), h('div', { class: 'ops' }, a ? h('div', { class: 'row' }, good, scrap, h('button', { type: 'button', class: 'b ok', 'data-testid': 'pd-declare', onClick: () => { const g = Number(good.value || 0), s = Number(scrap.value || 0); if (!(g > 0 || s > 0))
                return refuse('Sağlam veya fire adedi girin.'); void act(() => api.declare(a.workOrderId, g, s, crypto.randomUUID()), 'Üretim kaydedildi.'); } }, 'Üretim kaydet')) : null, a && a.status === 'IN_PROGRESS' ? h('div', {}, h('button', { type: 'button', class: 'b', 'data-testid': 'pd-fp', onClick: () => void act(() => api.requestFirstPiece(a.workOrderId), 'İlk parça kalite onayına gönderildi.') }, 'İlk parçayı kaliteye gönder')) : null, h('div', { class: 'row' }, reason), h('div', { class: 'row' }, c.label === 'BEKLEME' && c.returnPath === 'RESUME_FROM_HOLD' ? h('button', { type: 'button', class: 'b ok', 'data-testid': 'pd-resume', onClick: needReason(() => void act(() => api.resume(c.machineId, reason.value.trim()), `${c.code} üretime döndü.`)) }, 'Üretime dön') : null, c.eligible ? cat : null, c.eligible ? h('button', { type: 'button', class: 'b', 'data-testid': 'pd-hold', onClick: needReason(() => void act(() => api.hold(c.machineId, reason.value.trim(), cat.value), `${c.code} beklemeye alındı (kayıp kategorisi kaydedildi).`)) }, 'Beklemeye al') : null, c.group === 'STOPPED' ? null : h('button', { type: 'button', class: 'b bad', 'data-testid': 'pd-fault', onClick: needReason(() => void act(() => api.reportFault(c.machineId, reason.value.trim()), `${c.code} için arıza bildirildi.`)) }, 'Arıza bildir')))) : null);
    };
    function draw() {
        if (!loaded) {
            host.replaceChildren(h('style', {}, CSS), h('div', { class: 'mu' }, 'Makineler okunuyor…'));
            return;
        }
        const parts = [h('style', {}, CSS), h('div', {}, h('div', { class: 'eb' }, 'ÜRETİM'), h('h1', { 'data-testid': 'pd-title' }, 'Üretim Masası'))];
        if (banner)
            parts.push(h('div', { class: `banner ${banner.kind}`, role: banner.kind === 'error' ? 'alert' : 'status', 'data-testid': 'pd-banner', 'data-kind': banner.kind }, banner.text));
        if (machines === null) {
            parts.push(h('div', { class: 'banner error', 'data-testid': 'pd-load-error' }, 'Makine listesi okunamadı (VERİ YOK). Bu, atölyenin boş olduğu anlamına gelmez.'), h('button', { type: 'button', class: 'b', onClick: () => void reload() }, 'Yeniden dene'));
            host.replaceChildren(...parts.filter(Boolean));
            return;
        }
        const desk = buildProductionDesk(machines);
        const list = desk.cards.filter((c) => (filter === 'ALL' || c.group === filter) && (!q || `${c.code} ${c.name} ${c.active?.productCode ?? ''} ${c.active?.operatorName ?? ''}`.toLocaleLowerCase('tr-TR').includes(q)));
        const chip = (k, label, n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === k), 'data-testid': `pd-chip-${k}`, onClick: () => { filter = k; draw(); } }, label, h('b', {}, String(n)));
        parts.push(h('div', { class: 'chips', 'data-testid': 'pd-chips' }, chip('ALL', 'Tüm makineler', desk.cards.length), ...GROUPS.filter((g) => desk.counts[g] > 0).map((g) => chip(g, GROUP_TR[g], desk.counts[g]))), h('div', { class: 'sum', 'data-testid': 'pd-sum' }, h('span', {}, 'Aktif işlerde sağlam ', h('b', {}, String(desk.totalGood))), h('span', {}, 'fire ', h('b', {}, String(desk.totalScrap)), desk.scrapPct === null ? '' : ` (%${desk.scrapPct})`), h('span', { class: 'mu' }, `Son okuma ${readAt} · `, h('a', { href: '#/komuta', style: 'color:#5cc8e6' }, 'Fabrika özeti (Performance Center) →'), ' ', h('button', { type: 'button', class: 'b', 'data-testid': 'pd-refresh', onClick: () => void reload() }, 'Yenile'))), h('input', { type: 'search', placeholder: 'Makine, ürün veya operatör ara…', 'aria-label': 'Ara', value: q, 'data-testid': 'pd-search', onInput: (e) => { q = e.target.value.trim().toLocaleLowerCase('tr-TR'); draw(); } }), (list.length ? h('div', { class: 'grid', 'data-testid': 'pd-grid' }, ...list.map(card)) : h('div', { class: 'mu', 'data-testid': 'pd-empty' }, desk.cards.length === 0 ? 'Kayıtlı makine yok.' : 'Bu filtreye uyan makine yok.')));
        host.replaceChildren(...parts.filter(Boolean));
    }
    draw();
    await reload();
}
