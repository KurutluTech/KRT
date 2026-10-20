// KMI Production Desk (/uretim) — the production supervisor's view of ALL machines at once: status (canonical eligibility), active work order with progress,
// queue with the server's start-gate answer, and the shop-floor actions (start, declare good/scrap, hold with a loss category, resume, fault, first-piece to quality).
// Every action is the same canonical RPC the operator terminal uses; the server authorises and audits. Unreadable machine = "okunamadı", never "boşta".
import { pilotChip } from '../pilotMark.js';
import { passportHref } from '../passport/registry.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildProductionDesk, GROUP_TR, HOLD_CATEGORIES, DESK_FILTERS, FILTER_TR } from '../../../../packages/domain/src/productionDesk.js';
import { HEADLINE_TR, AVAILABILITY_TR, DATA_SOURCE_TR } from '../../../../packages/domain/src/machineState.js';
import { fmtDur } from '../../../../packages/domain/src/cncActivity.js';
import { spindleForState, STATE_VISUAL } from '../spindle.js';
import { displayKey } from '../../../../packages/domain/src/machineState.js';
import { liveTopic, historyTopic } from '../passport/topics/cncTopics.js';
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

.pd .cd{display:flex;gap:10px;align-items:center}.pd .big{font-size:18px;font-weight:800}.pd .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px 12px}.pd .kv div{font-size:12px;color:#8da0bd}.pd .kv b{display:block;font-size:15px;color:#e9eef7;overflow-wrap:anywhere}
.pd .blk{border:1px solid #1a2a46;border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;background:rgba(7,14,28,.5)}.pd .blk h4{margin:0;font-size:11px;letter-spacing:.14em;color:#c9a24a}
.pd .al{padding:6px 10px;border-radius:8px;font-size:13px;font-weight:600}.pd .al.red{background:#3a1614;border:1px solid #8a3a35;color:#f6b4ae}.pd .al.amber{background:#3a2c10;border:1px solid #8a6a20;color:#f3d28a}.pd .al.blue{background:#10283a;border:1px solid #2b5f86;color:#a8d8f3}
.pd .src{font-size:11.5px;color:#8da0bd}.pd .sec{border-top:1px solid #1a2a46;padding-top:8px;margin-top:6px}.pd .sec h3{margin:0 0 6px;font-size:13px;color:#e9eef7}.pd .chips.sub .chip{min-height:36px;font-size:12px}
`;
const GROUPS = ['STOPPED', 'HOLD', 'FIRST_PIECE', 'RUNNING', 'READY', 'IDLE', 'UNKNOWN'];
export async function renderProductionDesk(container, api) {
    let machines = undefined;
    let loaded = false;
    let filter = 'ALL';
    const openCodes = new Set();
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
    const fmtT = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Veri yok');
    const nz = (v) => (v === null || v === undefined ? 'Veri yok' : String(v));
    const kv = (rows) => h('div', { class: 'kv' }, ...rows.map(([k, v]) => h('div', {}, k, h('b', {}, v))));
    /** front of the card: physical CNC state (canonical machineStateOf) and the work-order state side by side, never merged */
    const frontBlock = (c) => {
        const ms = c.ms, cd = c.cd, p = c.production;
        const vis = STATE_VISUAL[displayKey(ms)];
        const since = c.stateSince ? `${fmtDur((Date.now() - Date.parse(c.stateSince.from)) / 1000)}${c.stateSince.clipped ? '+' : ''} (${fmtT(c.stateSince.from)}'den beri)` : cd && cd.link === 'UP' ? 'doğrulanamadı' : 'Veri yok';
        return h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, h('div', { class: 'cd', 'data-testid': 'pd-phys', 'data-headline': ms.headline, 'data-source': ms.dataSource }, spindleForState(ms, 44), h('div', {}, h('div', { class: 'big', style: `color:${vis.color}`, 'data-testid': 'pd-phys-label' }, 'Fiziksel CNC: ', HEADLINE_TR[ms.headline]), h('div', { class: 'src', 'data-testid': 'pd-source' }, `Kaynak: ${c.sourceTr} · ${DATA_SOURCE_TR[ms.dataSource]}`), h('div', { class: 'src' }, `İdari durum: ${AVAILABILITY_TR[ms.availability]}${c.machineClass ? '' : ' · sınıf belirtilmemiş'}`))), ...c.alerts.map((a) => h('div', { class: `al ${a.sev}`, role: 'status', 'data-testid': 'pd-alert', 'data-key': a.key }, a.text)), cd ? h('div', { class: 'blk', 'data-testid': 'pd-cnc' }, h('h4', {}, 'CANLI CNC'), kv([['Bağlantı', cd.linkTr.replace('CNC bağlantısı: ', '')], ['Son veri', cd.link === 'UP' ? fmtT(cd.lastDataAt) : `${fmtT(cd.lastDataAt)} (güncel değil)`], ['Aktif program', cd.program ?? (cd.link === 'UP' ? 'BİLGİ YOK' : 'Veri yok')], ['Mil devri', cd.spindleRpm === null ? 'Veri yok' : `${cd.spindleRpm} dev/dk`],
            ['Program durumu', cd.link === 'UP' ? cd.stateTr : 'BİLİNMİYOR'], ['Son çevrim', cd.lastCycleS === null ? 'Veri yok' : fmtDur(cd.lastCycleS)], ['Bu durumda', since]])) : null, h('div', { class: 'blk', 'data-testid': 'pd-prod' }, h('h4', {}, 'ÜRETİM · İŞ EMRİ'), p.hasWo ? kv([['İş emri', p.woId ? p.woId.slice(0, 8) : 'Veri yok'], ['Operasyon', p.opLabel ?? 'Ana iş emri'], ['Ürün', p.productCode ?? 'Veri yok'], ['Operatör', p.operator ?? 'KAYIT YOK'], ['Vardiya', p.shift ?? 'Veri yok'],
            ['Planlanan', nz(p.planned)], ['Sağlam', nz(p.good)], ['Tahsis', nz(p.tashih)], ['Hurda', nz(p.scrap)], ['Kalan', nz(p.remaining)], ['Hedef', p.pct === null ? 'Veri yok' : `%${p.pct}`]])
            : kv([['İş emri', 'ATANMAMIŞ'], ['Operatör', 'KAYIT YOK']]), p.hasWo ? null : h('div', { class: 'src' }, 'CNC verisi iş emri açmaz, sağlam adet üretmez; adetler yalnızca operatör beyanından gelir.')));
    };
    /** collapsible detail: A/B/C/F reuse the Machine Passport CNC topics (no second history), D/E come from the card and read-only selects */
    const detailPanel = (c) => {
        const d = h('details', { 'data-testid': 'pd-detail', 'data-code': c.code }, h('summary', {}, 'Ayrıntılar · CNC izleme, geçmiş, vardiya, üretim, duruş, AI'));
        const body = h('div', { class: 'ops', 'data-testid': 'pd-detail-body' });
        d.append(body);
        let done = false;
        const fill = async () => {
            if (done)
                return;
            done = true;
            const io = api.io;
            const mr = api.machineRow?.(c.machineId) ?? null;
            const sec = (t, tid, ...k) => h('div', { class: 'sec', 'data-testid': tid }, h('h3', {}, t), ...k);
            const cncHost = h('div', {});
            const dHost = h('div', {});
            const eHost = h('div', {});
            body.replaceChildren(sec('A–C, F · CNC canlı izleme, faaliyet geçmişi, vardiya performansı, AI değerlendirmesi', 'pd-sec-cnc', cncHost), sec('D · Üretim gerçekleşmesi', 'pd-sec-prod', dHost), sec('E · Duruş ve müdahale', 'pd-sec-stop', eHost));
            // A/B/C/F: the passport's own components
            if (io && mr && (c.hasCnc || c.cncDenied || mr.machineClass === 'MACHINING')) {
                const ctx = { rpc: io.rpc, sel: io.sel, nowIso: () => new Date().toISOString() };
                try {
                    await (c.hasCnc && !c.cncDenied ? historyTopic(ctx, mr) : liveTopic(ctx, mr)).render(cncHost);
                }
                catch {
                    cncHost.replaceChildren(h('div', { class: 'mu' }, 'CNC ayrıntısı okunamadı. Süre/sayı uydurulmaz.'));
                }
            }
            else
                cncHost.replaceChildren(h('div', { class: 'mu', 'data-testid': 'pd-no-cnc' }, c.cncDenied ? 'CNC verisini görme yetkiniz yok.' : 'Bu makinede doğrulanmış CNC cihaz eşlemesi yok — durum operatör beyanıdır; CNC geçmişi, vardiya analizi ve AI değerlendirmesi oluşmaz.'));
            // D
            const p = c.production;
            dHost.replaceChildren(kv([['Planlanan', nz(p.planned)], ['Sağlam', nz(p.good)], ['Tahsis (kalite kararı bekleyen)', nz(p.tashih)], ['Hurda', nz(p.scrap)], ['Kalan', nz(p.remaining)], ['Plan/hedef', p.pct === null ? 'Veri yok' : `%${p.pct}`], ['Operatör beyanı', p.operator ?? 'KAYIT YOK'],
                ['Kalite durumu', c.active?.openQualityHold ? 'KALİTE HOLD AÇIK' : c.group === 'FIRST_PIECE' ? 'İlk parça kararı bekliyor' : p.hasWo ? 'Açık kalite HOLD yok' : 'Veri yok']]), h('div', { class: 'src' }, 'Adetler operatör beyanıdır; CNC çalışması sağlam parça veya talaş kaldırma kanıtı değildir.'), ...(c.active ? [h('a', { href: passportHref('WORK_ORDER', c.active.workOrderId), style: 'color:#5cc8e6' }, 'İş emri pasaportu →')] : []), h('a', { href: passportHref('MACHINE', c.machineId), style: 'color:#5cc8e6;margin-left:12px' }, 'Makine pasaportu →'));
            // E
            const rows = [['CNC bildirimi', c.cd && c.cd.link === 'UP' ? `${c.cd.stateTr}${c.stateSince ? ` · ${fmtDur((Date.now() - Date.parse(c.stateSince.from)) / 1000)}` : ''}` : 'Veri yok'], ['Operatörün bildirdiği duruş', c.label === 'BEKLEME' ? (c.reason ?? 'Sebep kaydı yok') : 'Açık bekletme yok'], ['İdari durum', c.label ?? 'Okunamadı']];
            eHost.replaceChildren(kv(rows));
            if (io) {
                try {
                    const tk = await io.sel('maintenance_tickets', 'id,kind,status,reason', { machine_id: `eq.${c.machineId}`, status: 'in.(OPEN,IN_PROGRESS,TEST_PENDING)' }, 'created_at.desc', 5);
                    const ids = [...tk.map((x) => x.id), ...(c.active ? [c.active.workOrderId] : [])];
                    const tasks = ids.length ? await io.sel('tasks', 'id,title,status', { source_id: `in.(${ids.join(',')})`, status: 'in.(OPEN,IN_PROGRESS)' }, 'created_at.desc', 5).catch(() => null) : [];
                    eHost.append(h('div', { class: 'mu', 'data-testid': 'pd-tickets' }, tk.length ? `Açık bakım/arıza kaydı: ${tk.length} — ${tk.map((x) => x.reason).join('; ')}` : 'Açık bakım/arıza kaydı yok.'), h('div', { class: 'mu', 'data-testid': 'pd-tasks' }, tasks === null ? 'Görevler okunamadı veya yetki yok.' : tasks.length ? `Bekleyen görev: ${tasks.map((x) => x.title).join('; ')}` : 'Bekleyen görev yok.'), h('a', { href: '#/bakim', style: 'color:#5cc8e6' }, 'Bakım →'), h('a', { href: '#/gorevler', style: 'color:#5cc8e6;margin-left:12px' }, 'Görevler →'));
                }
                catch {
                    eHost.append(h('div', { class: 'mu' }, 'Bakım/görev kayıtları okunamadı veya yetki yok.'));
                }
            }
        };
        d.addEventListener('toggle', () => { if (d.open) {
            openCodes.add(c.code);
            void fill();
        }
        else
            openCodes.delete(c.code); });
        if (openCodes.has(c.code)) {
            d.open = true;
            void fill();
        }
        return d;
    };
    const card = (c) => {
        const reason = h('input', { type: 'text', placeholder: 'Sebep (zorunlu)', 'aria-label': 'Sebep', 'data-testid': 'pd-reason' });
        const cat = h('select', { 'aria-label': 'Duruş kategorisi', 'data-testid': 'pd-cat' }, ...HOLD_CATEGORIES.map(([v, l]) => h('option', { value: v }, l)));
        const good = h('input', { type: 'number', min: '0', placeholder: 'Sağlam', 'aria-label': 'Sağlam', style: 'width:6.5em', 'data-testid': 'pd-good' });
        const scrap = h('input', { type: 'number', min: '0', placeholder: 'Fire', 'aria-label': 'Fire', style: 'width:6.5em', 'data-testid': 'pd-scrap' });
        const needReason = (fn) => () => { if (reason.value.trim().length < 3)
            return refuse('Sebep yazmadan bu işlem yapılamaz (en az 3 karakter).'); fn(); };
        const a = c.active;
        return h('article', { class: `m ${c.tone}`, 'data-testid': 'pd-machine', 'data-code': c.code, 'data-group': c.group }, h('div', { class: 'mh' }, h('b', {}, `${c.code}`, h('span', { class: 'mu' }, ` ${c.name}`)), h('span', { class: 'pill', 'data-testid': 'pd-group', title: 'İş emri / uygunluk durumu — fiziksel CNC durumundan ayrıdır' }, GROUP_TR[c.group])), frontBlock(c), c.group === 'UNKNOWN' ? h('div', { class: 'd', 'data-testid': 'pd-unknown' }, `Makine durumu okunamadı (${c.error ?? 'bilinmiyor'}) — "boşta" demek değildir.`) : null, c.group === 'STOPPED' ? h('div', { class: 'd' }, `${c.label}: yetkili bakım testiyle açılır. `, h('a', { href: '#/bakim', style: 'color:#5cc8e6' }, 'Bakım →')) : null, a ? h('div', { 'data-testid': 'pd-active', 'data-wo': a.workOrderId }, h('div', { class: 'd' }, h('b', {}, ...(a.isPilot ? [pilotChip()] : []), a.productCode ?? `İş emri ${a.workOrderId.slice(0, 8)}`), ` · ${a.operatorName ?? 'operatör yok'}`), h('div', { class: 'bar' }, h('i', { style: `width:${c.pct ?? 0}%` })), h('div', { class: 'mu' }, `${a.qtyProduced} / ${a.qtyPlanned} sağlam · fire ${a.qtyScrap}`), c.group === 'FIRST_PIECE' ? h('div', { class: 'd' }, 'İlk parça kalite kararı bekliyor → ', h('a', { href: '#/kalite', style: 'color:#5cc8e6' }, 'Kalite Masası')) : null, h('a', { href: passportHref('WORK_ORDER', a.workOrderId), class: 'mu', style: 'color:#5cc8e6' }, 'İş emri pasaportu →')) : null, ...(c.queue.slice(0, 3).map((w) => h('div', { class: 'q', 'data-testid': 'pd-queue', 'data-wo': w.workOrderId }, h('span', { class: 'd' }, ...(w.isPilot ? [pilotChip()] : []), `${w.productCode ?? w.workOrderId.slice(0, 8)} · ${w.qtyPlanned} adet${w.plannedDate ? ` · ${w.plannedDate}` : ''}`), w.startRefusal ? h('span', { class: 'ref', 'data-testid': 'pd-refusal' }, `Başlatılamaz: ${refusalText(w.startRefusal)}`)
            : h('button', { type: 'button', class: 'b ok', disabled: !!a || !c.eligible, title: a ? 'Makinede çalışan iş var' : '', 'data-testid': 'pd-start', onClick: () => void act(() => api.start(w.workOrderId), `${w.productCode ?? 'İş emri'} başlatıldı.`) }, 'Başlat')))), c.group !== 'UNKNOWN' ? h('details', {}, h('summary', {}, 'İşlemler'), h('div', { class: 'ops' }, a ? h('div', { class: 'row' }, good, scrap, h('button', { type: 'button', class: 'b ok', 'data-testid': 'pd-declare', onClick: () => { const g = Number(good.value || 0), s = Number(scrap.value || 0); if (!(g > 0 || s > 0))
                return refuse('Sağlam veya fire adedi girin.'); void act(() => api.declare(a.workOrderId, g, s, crypto.randomUUID()), 'Üretim kaydedildi.'); } }, 'Üretim kaydet')) : null, a && a.status === 'IN_PROGRESS' ? h('div', {}, h('button', { type: 'button', class: 'b', 'data-testid': 'pd-fp', onClick: () => void act(() => api.requestFirstPiece(a.workOrderId), 'İlk parça kalite onayına gönderildi.') }, 'İlk parçayı kaliteye gönder')) : null, h('div', { class: 'row' }, reason), h('div', { class: 'row' }, c.label === 'BEKLEME' && c.returnPath === 'RESUME_FROM_HOLD' ? h('button', { type: 'button', class: 'b ok', 'data-testid': 'pd-resume', onClick: needReason(() => void act(() => api.resume(c.machineId, reason.value.trim()), `${c.code} üretime döndü.`)) }, 'Üretime dön') : null, c.eligible ? cat : null, c.eligible ? h('button', { type: 'button', class: 'b', 'data-testid': 'pd-hold', onClick: needReason(() => void act(() => api.hold(c.machineId, reason.value.trim(), cat.value), `${c.code} beklemeye alındı (kayıp kategorisi kaydedildi).`)) }, 'Beklemeye al') : null, c.group === 'STOPPED' ? null : h('button', { type: 'button', class: 'b bad', 'data-testid': 'pd-fault', onClick: needReason(() => void act(() => api.reportFault(c.machineId, reason.value.trim()), `${c.code} için arıza bildirildi.`)) }, 'Arıza bildir')))) : null, detailPanel(c));
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
        const desk = buildProductionDesk(machines, new Date().toISOString());
        const isKey = DESK_FILTERS.includes(filter);
        const list = desk.cards.filter((c) => (filter === 'ALL' || (isKey ? c.filters.includes(filter) : c.group === filter)) && (!q || `${c.code} ${c.name} ${c.active?.productCode ?? ''} ${c.production.operator ?? ''} ${c.production.shift ?? ''} ${c.production.woId ?? ''} ${c.production.opLabel ?? ''} ${c.cd?.program ?? ''}`.toLocaleLowerCase('tr-TR').includes(q)));
        const chip = (k, label, n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === k), 'data-testid': `pd-chip-${k}`, onClick: () => { filter = k; draw(); } }, label, h('b', {}, String(n)));
        parts.push(h('div', { class: 'chips', 'data-testid': 'pd-chips' }, chip('ALL', 'Tüm makineler', desk.cards.length), ...DESK_FILTERS.filter((k) => k !== 'ALL').map((k) => chip(k, FILTER_TR[k], desk.filterCounts[k]))), h('div', { class: 'chips sub', 'data-testid': 'pd-chips-wo', 'aria-label': 'İş emri durumu' }, h('span', { class: 'mu', style: 'align-self:center' }, 'İş emri durumu:'), ...GROUPS.filter((g) => desk.counts[g] > 0).map((g) => chip(g, GROUP_TR[g], desk.counts[g]))), h('div', { class: 'sum', 'data-testid': 'pd-sum' }, h('span', {}, 'Aktif işlerde sağlam ', h('b', {}, String(desk.totalGood))), h('span', {}, 'fire ', h('b', {}, String(desk.totalScrap)), desk.scrapPct === null ? '' : ` (%${desk.scrapPct})`), h('span', { class: 'mu' }, `Son okuma ${readAt} · `, h('a', { href: '#/komuta', style: 'color:#5cc8e6' }, 'Fabrika özeti (Performance Center) →'), ' ', h('button', { type: 'button', class: 'b', 'data-testid': 'pd-refresh', onClick: () => void reload() }, 'Yenile'))), h('input', { type: 'search', placeholder: 'Makine, program, ürün, operatör, vardiya veya iş emri ara…', 'aria-label': 'Ara', value: q, 'data-testid': 'pd-search', onInput: (e) => { q = e.target.value.trim().toLocaleLowerCase('tr-TR'); draw(); } }), (list.length ? h('div', { class: 'grid', 'data-testid': 'pd-grid' }, ...list.map(card)) : h('div', { class: 'mu', 'data-testid': 'pd-empty' }, desk.cards.length === 0 ? 'Kayıtlı makine yok.' : 'Bu filtreye uyan makine yok.')));
        host.replaceChildren(...parts.filter(Boolean));
    }
    draw();
    await reload();
}
