// KMI NEXT — Onaylarım (KMI-004). "Benden hangi karar bekleniyor, neden, karar vermezsem ne aksar, ne ile karar vereceğim, sonra ne olur, kim karar verdi?"
//  • ONE list over the EXISTING canonical sources (commercial release / decision, purchase request / order, task completion — approvalsInbox) + the quality gates that are decided at their own
//    screen (first piece, HOLD release: this screen only takes the person there, never offers a button for them). No new approval system, no new writer.
//  • A decision is made only through approvalsInbox.rpcCall → the canonical RPC (server re-checks permission, state, four eyes, writes audit). Button visibility is a convenience, never the control.
//  • A person is loaded / shown only the sources he holds the critical action for. Unknown values stay unknown; a source that cannot be read is REPORTED, never shown as "0 pending"; stale data says BAYAT.
//  • Desktop: queue left, selected decision right (the page does not grow). Phone: list → separate decision screen (back = browser back), big Onayla / Reddet.
//  • One load for all sources (+ the gates in parallel); filtering is local; task evidence / history load only for the decision being looked at.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { normalizeReason, reasonError, waitLabel } from '../../../../packages/domain/src/approvalsInbox.js';
import { AP_DEFAULT, ROW_KIND_LABEL, AP_VIEWS, applyApFilters, buildRows, facetsAp, summarizeAp, viewCountsAp } from '../../../../packages/domain/src/approvalWorkspace.js';
import { errorText } from '../errorText.js';
import { DS_CSS, initials } from '../ds.js';
const PAGE = 40;
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'BİLİNMİYOR');
const fmtShort = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const hhmm = (ms) => new Date(ms).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const EVENT_TR = { CREATED: 'Oluşturuldu / atandı', STARTED: 'Başlatıldı', COMPLETED: 'Tamamlandı (onay bekliyor)', APPROVED: 'Onaylandı', REOPENED: 'Yeniden açıldı', CANCELLED: 'İptal edildi', EVIDENCE_ADDED: 'Kanıt eklendi' };
const TIER = { KRITIK: 'KRİTİK', YUKSEK: 'YÜKSEK', NORMAL: 'NORMAL', BILINMIYOR: 'SÜRE BİLİNMİYOR' };
const REFUSAL_TR = {
    SELF_APPROVAL_FORBIDDEN: 'Tamamlayan kişi kendi işini onaylayamaz — başka bir yetkili onaylamalı.', ILLEGAL_TASK_TRANSITION: 'Karar bu arada başkası tarafından verilmiş ya da durum değişmiş — liste yenilendi.',
    FORBIDDEN: 'Bu karar için yetkiniz yok.', REJECT_REASON_REQUIRED: 'Red için gerekçe yazın (en az 5 karakter; boşluklar sayılmaz).', 'Could not find the function': 'Bu işlem için sunucu güncellemesi bekleniyor (gerekçeli red kurulu değil) — hiçbir kayıt değişmedi.', PGRST202: 'Bu işlem için sunucu güncellemesi bekleniyor (gerekçeli red kurulu değil) — hiçbir kayıt değişmedi.', NOTE_REQUIRED: 'Gerekçe yazın (en az 5 karakter).', REASON_REQUIRED: 'Gerekçe yazın (en az 5 karakter).',
};
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); const k = Object.keys(REFUSAL_TR).find((x) => m.includes(x)); return k ? REFUSAL_TR[k] : errorText(e); };
const sizeTr = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const E = (tag, attrs, ...ch) => h(tag, attrs ?? {}, ...ch.filter((c) => c !== null && c !== undefined && c !== false));
const MQ = '(min-width: 901px)';
const isWide = () => (typeof matchMedia === 'function' ? matchMedia(MQ).matches : true);
/** process-wide in-flight lock: a second click on the same decision while it is being sent is ignored (a double decision is also refused by the server) */
const inFlight = new Set();
const AO_CSS = DS_CSS + `
.kd.ao-screen{max-width:1440px;margin:0 auto;gap:8px}.kd.ao-screen [hidden]{display:none}
.kd .ao-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:2px}.kd .ao-top>div:first-child{flex:1 1 auto;min-width:0}.kd .ao-top .hd{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap}.kd .ao-top h1{margin:0;font-size:22px}.kd .ao-top .sub{font-size:13px;color:#94a3b8}
.kd .ao-fresh{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.06em;border-radius:999px;padding:5px 10px;border:1px solid #14532d;background:rgba(34,197,94,.1);color:#86efac}.kd .ao-fresh[data-stale="true"]{border-color:#92400e;background:rgba(245,158,11,.12);color:#fcd34d}
.kd .ao-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}.kd .ao-tile{border-radius:12px;padding:7px 12px;border:1px solid #334155;background:#0f172a;min-width:0;display:flex;align-items:baseline;gap:10px}
.kd .ao-tile .n{font-size:24px;font-weight:800;line-height:1.1}.kd .ao-tile .l{font-size:11px;font-weight:800;letter-spacing:.08em}
.kd .ao-tile.pend{border-color:#3b82f6;background:rgba(59,130,246,.12)}.kd .ao-tile.crit{border-color:#fb7185;background:rgba(244,63,94,.12)}.kd .ao-tile.late{border-color:#ef4444;background:rgba(239,68,68,.12)}.kd .ao-tile.done{border-color:#22c55e;background:rgba(34,197,94,.1)}
.kd .ao-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0}.kd .ao-views{display:flex;gap:6px;flex-wrap:wrap;flex:1 1 100%}
.kd button.ao-chip{min-height:38px;border-radius:999px;border:1px solid #334155;background:#0f172a;color:#cbd5e1;padding:0 12px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
.kd button.ao-chip[aria-pressed="true"]{border-color:#22d3ee;background:rgba(34,211,238,.14);color:#fff}.kd button.ao-chip .c{margin-left:6px;font-weight:800;opacity:.85}
.kd .ao-bar input[type=search],.kd .ao-bar select{min-height:40px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px}.kd .ao-bar input[type=search]{flex:1 1 220px;min-width:0}
.kd .ao-split{display:grid;grid-template-columns:minmax(340px,5fr) minmax(0,7fr);gap:12px;align-items:start}
.kd .ao-listcol{display:flex;flex-direction:column;gap:6px;max-height:max(300px,calc(100vh - var(--ao-top,330px) - 16px));min-height:300px;overflow-y:auto;padding-right:4px;overscroll-behavior:contain}
.kd .ao-detailcol{position:sticky;top:66px;max-height:max(300px,calc(100vh - var(--ao-top,330px) - 16px));overflow-y:auto;border:1px solid #1e293b;border-radius:14px;background:#0f172a;padding:14px 16px;min-width:0;overscroll-behavior:contain}
.kd .ao-row{border:1px solid #1e293b;border-left:5px solid #475569;border-radius:12px;margin:0;background:linear-gradient(180deg,#111c2e,#0f172a);color:#e2e8f0;flex:0 0 auto;display:flex}
.kd .ao-row[data-pri="KRITIK"]{border-left-color:#ef4444}.kd .ao-row[data-pri="YUKSEK"]{border-left-color:#f59e0b}.kd .ao-row[data-pri="NORMAL"]{border-left-color:#3b82f6}.kd .ao-row[data-state="DONE"][data-outcome="APPROVED"]{border-left-color:#22c55e}.kd .ao-row[data-state="DONE"][data-outcome="REJECTED"]{border-left-color:#fb7185}
.kd .ao-row[data-selected="true"]{background:linear-gradient(180deg,#17263d,#12203a);box-shadow:inset 0 0 0 1px #22d3ee}.kd .ao-row[data-mine="false"][data-state="PENDING"]{opacity:.85}
.kd button.ao-pick{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:2px;flex:1 1 auto;min-width:0;min-height:56px;text-align:left;background:transparent;border:0;padding:8px 10px;color:inherit;cursor:pointer;border-radius:10px;font:inherit;font-weight:400;line-height:1.25;overflow-wrap:anywhere}
.kd .ao-l1{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.kd .ao-l1 .k{min-width:0;flex:1 1 auto;display:flex;gap:6px;align-items:baseline}.kd .ao-l1 .k .mut{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
.kd .ao-tier{font-size:11px;font-weight:800;letter-spacing:.06em;color:#cbd5e1;white-space:nowrap}.kd .ao-tier.KRITIK{color:#fca5a5}.kd .ao-tier.YUKSEK{color:#fcd34d}.kd .ao-tier.NORMAL{color:#93c5fd}
.kd .ao-mine{font-size:11px;font-weight:800;color:#67e8f9;white-space:nowrap}.kd .ao-title{font-size:15px;font-weight:800;color:#fff;line-height:1.25}
.kd .ao-meta{display:flex;gap:2px 12px;flex-wrap:wrap;font-size:12.5px;color:#94a3b8;align-items:center}.kd .ao-meta b{color:#e2e8f0;font-weight:700}.kd .ao-late{color:#fca5a5;font-weight:800}
.kd .ao-dh h2{margin:2px 0 0;font-size:19px;line-height:1.25;color:#fff;overflow-wrap:anywhere;letter-spacing:0;text-transform:none;font-weight:800}
.kd .ao-box{margin-top:10px;border:1px solid #334155;border-radius:12px;padding:10px 12px;background:#0b1220;display:grid;gap:8px}.kd .ao-box textarea{width:100%;min-height:64px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:8px 10px;resize:vertical;box-sizing:border-box}
.kd .ao-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.kd .ao-acts button,.kd .ao-acts a{min-height:46px;font-weight:800;font-size:16px}.kd .ao-acts a.primary{display:inline-flex;align-items:center;justify-content:center;padding:0 16px;text-decoration:none}
.kd .ao-denied{font-size:13px;color:#fcd34d}.kd .ao-next{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kd .ao-next>div{font-size:13px;border:1px solid #1e293b;border-radius:10px;padding:8px 10px;background:#0f172a;color:#cbd5e1}.kd .ao-next b{display:block;font-size:11px;letter-spacing:.08em;color:#94a3b8;margin-bottom:2px}
.kd .ao-detail{margin-top:12px;border-top:1px dashed #334155;padding-top:12px;display:grid;gap:12px}.kd .ao-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}
.kd .ao-detail dl,.kd .ao-detail dd,.kd .ao-detail dt{margin:0}.kd .ao-detail dt{font-size:11px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase}.kd .ao-detail dd{margin-top:2px;font-size:14px;color:#e2e8f0;overflow-wrap:anywhere}
.kd .ao-sec>h3{margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase}.kd .ao-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 16px;margin:0}.kd .ao-facts div{font-size:13px}.kd .ao-facts b{color:#94a3b8;font-weight:700;margin-right:6px}
.kd ol.ao-hist{list-style:none;margin:6px 0 0;padding:0;border-left:2px solid #334155}.kd ol.ao-hist li{padding:0 0 8px 12px;position:relative;font-size:13px}.kd ol.ao-hist li::before{content:"";position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:#22d3ee}
.kd .ao-files{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:6px}.kd .ao-files li{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;font-size:13px}.kd .ao-files li span{min-width:0;overflow-wrap:anywhere}
.kd .ao-more{display:block;width:100%;min-height:44px;margin:4px 0}.kd .ao-empty-detail{color:#94a3b8;font-size:14px;padding:30px 8px;text-align:center}
.kd details.ao-filter{border:1px solid #334155;border-radius:12px;padding:4px 10px;background:#0f172a;margin:0;flex:0 0 auto}.kd details.ao-filter summary{min-height:40px;cursor:pointer;font-weight:700;color:#e2e8f0;display:flex;align-items:center}.kd details.ao-filter .fb{display:grid;gap:8px;padding:6px 0 8px}.kd details.ao-filter .fb select{width:100%}
.kd .ao-rules{font-size:12.5px;color:#94a3b8}.kd button.ao-back{min-height:44px;padding:0 14px;font-weight:700}
/* semantic actions: green approve · red reject · turquoise go-to-record · neutral inspect · amber hold; icon + text, never colour alone */
.kd .ao-actbar{position:sticky;bottom:-14px;margin:14px -16px -14px;padding:10px 16px;background:linear-gradient(180deg,rgba(15,23,42,.92),#0f172a 30%);border-top:1px solid #334155;border-radius:0 0 14px 14px;display:grid;gap:8px;z-index:2}
.kd .ao-actbar .ao-acts button,.kd .ao-actbar .ao-acts a{min-width:132px;flex:1 1 140px;min-height:48px}.kd .ao-acts .okb::before{content:"✓";margin-right:8px;font-weight:900}.kd .ao-acts .danger::before{content:"✕";margin-right:8px;font-weight:900}.kd .ao-acts .go::after{content:"→";margin-left:8px}
.kd .ao-actbar>textarea{width:100%;min-height:48px;height:48px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:8px 10px;box-sizing:border-box;resize:vertical}.kd .ao-actbar .ao-acts{gap:10px}.kd .ao-acts button.danger{box-shadow:inset 0 0 0 2px #fca5a5}.kd .ao-acts button.okb{box-shadow:inset 0 0 0 2px #86efac}.kd .ao-acts button:disabled{box-shadow:none}
.kd .ao-rej{border:2px solid var(--act-no);border-radius:12px;background:#1b0f14;padding:10px 12px;display:grid;gap:8px}.kd .ao-rej h3{margin:0;font-size:15px;color:#fecaca}.kd .ao-rej .what{font-size:13px;color:#e2e8f0;overflow-wrap:anywhere}.kd .ao-rej .eff{font-size:12.5px;color:#fca5a5}
.kd .ao-rej textarea{width:100%;min-height:84px;font-size:16px;border-radius:10px;border:1px solid #fb7185;background:#0f172a;color:#fff;padding:8px 10px;resize:vertical;box-sizing:border-box}.kd .ao-rej .cnt{font-size:12px;color:#94a3b8}.kd .ao-rej .cnt[data-ok="true"]{color:#86efac}
.kd .ao-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0 0}.kd .ao-strip>div{border:1px solid #1e293b;border-radius:10px;background:#0b1220;padding:6px 10px;min-width:0}.kd .ao-strip dt{font-size:10.5px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase;margin:0}.kd .ao-strip dd{margin:2px 0 0;font-size:14px;font-weight:700;color:#fff;overflow-wrap:anywhere}.kd .ao-strip dd.unk{color:#fcd34d}
.kd .ao-ref{font-size:11px;color:#94a3b8;font-weight:700;white-space:nowrap}.kd .ao-row[data-crit="true"]{background:linear-gradient(180deg,#2a1219,#1a0f16)}.kd .ao-row[data-overdue="true"]{box-shadow:inset 0 0 0 1px #7f1d1d}.kd .ao-row[data-crit="true"][data-selected="true"]{box-shadow:inset 0 0 0 1px #22d3ee}
body:has(.ao-detail-mode) .kmi-bottom{display:none}
@media (max-width:1100px){.kd .ao-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:1100px){.kd .ao-split{grid-template-columns:minmax(300px,5fr) minmax(0,6fr)}.kd .ao-grid,.kd .ao-facts,.kd .ao-next{grid-template-columns:1fr}}
@media (max-width:900px){
  .kd.ao-screen{padding-bottom:calc(88px + env(safe-area-inset-bottom))}.kd.ao-detail-mode{padding-bottom:calc(8px + env(safe-area-inset-bottom))}.kd .ao-actbar{margin:14px 0 0;border-radius:12px;padding:10px 10px calc(10px + env(safe-area-inset-bottom));position:sticky;bottom:0}.kd .ao-rej{position:static}
  .kd .ao-sheet-wrap{position:fixed;inset:0;z-index:60;background:rgba(2,6,23,.72);display:flex;align-items:flex-end}.kd .ao-sheet-wrap .ao-rej{width:100%;max-height:88vh;overflow-y:auto;border-radius:16px 16px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom))}.kd .ao-rej .ao-acts button{flex:1 1 100%}
  .kd .ao-split{display:block}.kd .ao-listcol{max-height:none;min-height:0;overflow:visible;padding-right:0}.kd .ao-detailcol{position:static;max-height:none;overflow:visible;border:0;background:transparent;padding:0}
  .kd .ao-top{align-items:center;flex-wrap:nowrap;gap:6px}.kd .ao-top .sub{display:none}.kd .ao-top h1{font-size:20px}.kd .ao-fresh{padding:4px 8px;font-size:11px}.kd .ao-top button.ghost{min-height:40px;padding:4px 10px}
  .kd .ao-tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.kd .ao-tile{flex-direction:column;gap:0;align-items:flex-start;padding:6px 10px}.kd .ao-tile .n{font-size:22px}.kd .ao-tile .l{font-size:10px;letter-spacing:.05em}
  .kd .ao-bar{gap:6px}.kd .ao-bar input[type=search]{flex:1 1 100%}.kd .ao-bar select.ao-viewsel{flex:1 1 0;min-width:0}.kd .ao-title{font-size:16px}
  .kd .ao-actbar .ao-acts{flex-wrap:nowrap;gap:8px}.kd .ao-actbar .ao-acts button{flex:1 1 0;min-width:0;min-height:52px;padding:6px 8px}
  .kd .ao-actbar .ao-rej .ao-acts{flex-direction:column;flex-wrap:wrap}.kd .ao-actbar .ao-rej .ao-acts button{flex:0 0 auto;width:100%}
  .kd button.ao-chip{min-height:44px}.kd .ao-rules summary{min-height:44px;display:flex;align-items:center}.kd .ao-detailcol .ao-acts button,.kd .ao-detailcol .ao-acts a.primary{flex:1 1 100%;min-height:52px}.kd .ao-row button,.kd .ao-detailcol button{min-height:48px;font-size:16px}
}`;
export async function renderApprovalsScreen(container, deps, state = {}) {
    const held = new Set(deps.held);
    const now = deps.now ?? (() => Date.now());
    const inst = Math.random().toString(36).slice(2);
    const alive = () => container.querySelector('[data-inst]')?.getAttribute('data-inst') === inst;
    const ui = { filters: { ...AP_DEFAULT, view: state.view ?? AP_DEFAULT.view }, shown: PAGE, sel: null, mobileDetail: false, pushed: false, focusMissing: false, focusDone: false, reason: '', rejecting: null, rejectReason: '' };
    let res = null;
    let gates = [];
    let gatesError = null;
    let rows = [];
    let loadedAt = 0;
    let staleError = null;
    let generation = 0;
    let savedScroll = 0;
    let busy = false;
    const detailCache = new Map();
    const msgBox = E('div', { 'aria-live': 'polite', hidden: true });
    const setMessage = (m) => { msgBox.hidden = !m; msgBox.replaceChildren(...(m ? [E('div', { 'data-testid': 'ao-message', 'data-kind': m.kind, class: `banner ${m.kind === 'ok' ? 'info' : 'error'}` }, m.text)] : [])); };
    mount(container, E('div', { class: 'kd ao-screen' }));
    const listHost = E('div', { 'data-testid': 'ao-list', class: 'ao-listcol' });
    const detailHost = E('section', { 'data-testid': 'ao-detail-panel', class: 'ao-detailcol', 'aria-label': 'Karar ayrıntısı' });
    const chips = [];
    const viewSelOpts = [];
    const freshBadge = () => {
        const age = loadedAt ? Math.floor((now() - loadedAt) / 60000) : 0;
        const stale = !!staleError || age >= 5;
        const partial = Object.keys(res?.sourceErrors ?? {}).length > 0 || !!gatesError; // CANLI only for a complete, recent, verified read — never while loading, stale or partial
        return E('div', { style: 'display:flex;gap:8px;align-items:center' }, E('span', { class: 'ao-fresh', 'data-testid': 'ao-fresh', 'data-inst': inst, 'data-stale': String(stale), 'data-partial': String(partial) }, !loadedAt ? 'YÜKLENİYOR…' : stale ? `BAYAT · ${hhmm(loadedAt)} verisi` : partial ? `KISMİ VERİ · ${hhmm(loadedAt)} (bazı kaynaklar okunamadı)` : `CANLI · ${hhmm(loadedAt)}`), E('button', { type: 'button', class: 'ghost', 'data-testid': 'ao-refresh', onClick: () => void reload('Liste yenilendi.') }, '↻ Yenile'));
    };
    const head = () => [E('div', { class: 'ao-top' }, E('div', { class: 'hd' }, E('h1', { 'data-testid': 'ao-heading' }, 'Onaylarım'), E('div', { class: 'sub' }, 'Sizden hangi karar bekleniyor, neden gerekli ve karar verirseniz ne olur.')), freshBadge()), msgBox];
    const reload = async (okText) => {
        const my = ++generation;
        try {
            const [r, g] = await Promise.all([deps.api.load(), deps.gates ? deps.gates().then((x) => ({ ok: true, x }), (e) => ({ ok: false, e })) : Promise.resolve({ ok: true, x: [] })]);
            if (my !== generation)
                return; // a later answer replaced this one (or the user left): never paint an old answer
            res = r;
            gates = g.ok ? g.x : [];
            gatesError = g.ok ? null : errText(g.e);
            loadedAt = now();
            staleError = null;
            rows = buildRows({ items: r.items, history: r.history, gates, held, nowMs: loadedAt });
            if (state.focus && !ui.focusDone) {
                const want = rows.find((x) => x.id === state.focus || x.id === `DONE:${state.focus}`);
                if (want) {
                    ui.sel = want.id;
                    ui.filters = { ...ui.filters, view: want.state === 'DONE' ? 'DONE' : 'PENDING' };
                    if (!isWide())
                        ui.mobileDetail = true;
                    ui.focusDone = true;
                }
                else {
                    ui.focusMissing = true;
                    ui.focusDone = true;
                }
            }
            rebuild();
            if (okText)
                setMessage({ kind: 'ok', text: okText });
        }
        catch (e) {
            if (my !== generation)
                return;
            if (res) {
                staleError = errText(e);
                rebuild();
                setMessage({ kind: 'error', text: `Yenilenemedi — gösterilen liste ${hhmm(loadedAt)} tarihli (BAYAT). ${staleError}` });
            }
            else
                mount(container, E('div', { class: 'kd ao-screen' }, E('style', {}, AO_CSS), E('h1', { 'data-testid': 'ao-heading' }, 'Onaylarım'), msgBox, E('div', { 'data-testid': 'ao-error', class: 'banner error' }, `Onay listesi yüklenemedi: ${errText(e)} — Bağlantınızı kontrol edin. Liste okunamadığı için "bekleyen karar yok" anlamına gelmez ve karar verilemez.`), E('div', {}, E('button', { type: 'button', 'data-testid': 'ao-retry', onClick: () => void reload() }, 'Yeniden dene'))));
        }
    };
    // ---------------- selection / mobile decision screen ----------------
    const select = (id) => {
        ui.sel = id;
        ui.reason = '';
        ui.rejecting = null;
        ui.rejectReason = '';
        if (isWide()) {
            paintList();
            paintDetail();
            return;
        }
        savedScroll = window.scrollY;
        ui.mobileDetail = true;
        try {
            history.pushState({ kmiAo: 1 }, '');
            ui.pushed = true;
        }
        catch {
            ui.pushed = false;
        }
        rebuild();
        window.scrollTo?.(0, 0);
    };
    const leaveDetail = () => { ui.mobileDetail = false; ui.pushed = false; ui.reason = ''; ui.rejecting = null; ui.rejectReason = ''; rebuild(); window.scrollTo?.(0, savedScroll); };
    const onPop = () => { if (!alive()) {
        window.removeEventListener('popstate', onPop);
        return;
    } if (ui.mobileDetail && !isWide())
        leaveDetail(); };
    window.addEventListener('popstate', onPop);
    const mq = typeof matchMedia === 'function' ? matchMedia(MQ) : null;
    const onMq = () => { if (!alive()) {
        mq?.removeEventListener('change', onMq);
        return;
    } if (res) {
        ui.mobileDetail = !isWide() && !!ui.sel && ui.mobileDetail;
        rebuild();
    } };
    mq?.addEventListener('change', onMq);
    // ---------------- decision ----------------
    const decide = async (r, d, reasonText) => {
        const bad = d === 'REJECT' ? (reasonError(reasonText) ? 'Red için gerekçe yazın (en az 5 karakter; boşluklar sayılmaz).' : null) : reasonError(reasonText);
        if (bad) {
            setMessage({ kind: 'error', text: bad });
            return;
        }
        if (inFlight.has(r.id) || busy)
            return;
        inFlight.add(r.id);
        busy = true;
        paintDetail();
        const item = res.items.find((i) => i.key === r.id);
        try {
            if (!item)
                throw new Error('Karar listede yok — liste yenileniyor.');
            await deps.api.decide(item, d, normalizeReason(reasonText));
            inFlight.delete(r.id);
            busy = false;
            detailCache.clear();
            ui.reason = '';
            ui.rejecting = null;
            ui.rejectReason = '';
            const okText = `${r.kindLabel} · ${r.title}: ${d === 'APPROVE' ? 'onay' : 'ret / iade'} kaydedildi (gerekçe ve zaman damgası denetim kaydına yazıldı).`;
            await reload(okText);
            const pend = applyApFilters(rows, ui.filters, loadedAt);
            if (!isWide()) {
                const hadEntry = ui.pushed;
                ui.mobileDetail = false;
                ui.pushed = false;
                rebuild();
                if (hadEntry)
                    try {
                        history.back();
                    }
                    catch { /* no history entry to drop */ }
            }
            else {
                ui.sel = pend[0]?.id ?? null;
                paintList();
                paintDetail();
            }
        }
        catch (e) {
            inFlight.delete(r.id);
            busy = false;
            ui.rejecting = null;
            setMessage({ kind: 'error', text: errText(e) });
            await reload();
            setMessage({ kind: 'error', text: errText(e) });
        } // the list is re-read: a refused / already decided record shows its true state
    };
    // ---------------- detail ----------------
    const loadTaskDetail = (r) => {
        if (r.kind !== 'TASK_COMPLETION' || !deps.taskDetail || detailCache.has(r.id))
            return;
        const c = { hist: 'LOADING', ev: 'LOADING' };
        detailCache.set(r.id, c);
        const again = () => { if (alive() && ui.sel === r.id)
            paintDetail(); };
        void deps.taskDetail.history(r.recordId).then((x) => { c.hist = x; again(); }, () => { c.hist = 'ERROR'; again(); });
        void deps.taskDetail.evidence(r.recordId).then((x) => { c.ev = x; again(); }, () => { c.ev = 'ERROR'; again(); });
    };
    const openFile = async (f) => {
        try {
            const c = await deps.taskDetail.content(f.versionId);
            if (!c.integrityOk) {
                setMessage({ kind: 'error', text: 'Dosyanın bütünlük kontrolü başarısız — açılmadı.' });
                return;
            }
            const bin = atob(c.contentBase64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++)
                u8[i] = bin.charCodeAt(i);
            const url = URL.createObjectURL(new Blob([u8], { type: c.mimeType }));
            const a = document.createElement('a');
            a.href = url;
            a.download = c.fileName;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }
        catch (e) {
            setMessage({ kind: 'error', text: errText(e) });
        }
    };
    const dd = (label, value, testid) => E('div', {}, E('dt', {}, label), E('dd', testid ? { 'data-testid': testid } : {}, value ?? 'BİLİNMİYOR'));
    const setRejecting = (id) => { ui.rejecting = id; ui.rejectReason = ''; paintDetail(); if (id) {
        const t = detailHost.querySelector('[data-testid="ao-reject-reason"]');
        t?.focus();
    } };
    const rejectPanel = (r) => {
        const wide = isWide();
        const ta = E('textarea', { 'data-testid': 'ao-reject-reason', 'aria-label': 'Red gerekçesi', 'aria-required': 'true', placeholder: 'Neden reddediyorsunuz? (zorunlu, en az 5 karakter)', ...(busy ? { disabled: true } : {}) });
        ta.value = ui.rejectReason;
        const cnt = E('div', { class: 'cnt', 'data-testid': 'ao-reject-count' });
        const confirm = E('button', { type: 'button', class: 'danger', 'data-testid': 'ao-reject-confirm', disabled: true, onClick: () => void decide(r, 'REJECT', ui.rejectReason) }, `${r.rejectLabel.replace(/\s*\(.*\)/, '')} — kaydet`);
        const sync = () => { const n = normalizeReason(ui.rejectReason).length; const ok = n >= 5 && !busy; cnt.textContent = n >= 5 ? 'Gerekçe yeterli.' : `Gerekçe zorunlu: en az 5 karakter (${n}/5; boşluklar sayılmaz).`; cnt.setAttribute('data-ok', String(n >= 5)); if (ok)
            confirm.removeAttribute('disabled');
        else
            confirm.setAttribute('disabled', ''); };
        ta.addEventListener('input', () => { ui.rejectReason = ta.value; sync(); });
        const cancel = E('button', { type: 'button', class: 'ghost', 'data-testid': 'ao-reject-cancel', ...(busy ? { disabled: true } : {}), onClick: () => setRejecting(null) }, '← Vazgeç (hiçbir şey değişmez)');
        const panel = E('div', { class: 'ao-rej', role: 'dialog', 'aria-modal': String(!wide), 'aria-label': 'Red gerekçesi', 'data-testid': 'ao-reject-panel' }, E('h3', {}, 'Reddetme gerekçesi'), E('div', { class: 'what' }, E('b', {}, r.kindLabel), ` · ${r.title}`), E('div', { class: 'eff' }, `Reddederseniz: ${r.nextReject}`), ta, cnt, E('div', { class: 'mut' }, 'Gerekçe, kim reddetti ve ne zaman bilgisiyle denetim kaydına yazılır; kaydın geçmişinde yetkililer tarafından okunur.'), E('div', { class: 'ao-acts' }, cancel, confirm));
        panel.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') {
            ev.stopPropagation();
            setRejecting(null);
        } });
        ta.addEventListener('focus', () => { setTimeout(() => ta.scrollIntoView({ block: 'nearest' }), 60); });
        sync();
        if (wide)
            return panel;
        const wrap = E('div', { class: 'ao-sheet-wrap', 'data-testid': 'ao-sheet', onClick: (ev) => { if (ev.target === ev.currentTarget && !busy)
                setRejecting(null); } }, panel);
        // On-screen keyboard: the sheet follows the VISIBLE viewport (visualViewport), so the reason field and the 'kaydet' button stay reachable (the sheet scrolls inside itself).
        const vv = window.visualViewport;
        if (vv) {
            const fit = () => { if (!wrap.isConnected) {
                vv.removeEventListener('resize', fit);
                vv.removeEventListener('scroll', fit);
                return;
            } wrap.style.inset = 'auto'; wrap.style.top = `${vv.offsetTop}px`; wrap.style.left = `${vv.offsetLeft}px`; wrap.style.width = `${vv.width}px`; wrap.style.height = `${vv.height}px`; panel.style.maxHeight = `${Math.floor(vv.height * 0.94)}px`; };
            vv.addEventListener('resize', fit);
            vv.addEventListener('scroll', fit);
            fit();
        }
        return wrap;
    };
    const actionBox = (r) => {
        if (r.state === 'DONE')
            return null;
        if (r.redirectOnly)
            return E('div', { class: 'ao-actbar', 'data-testid': 'ao-redirect' }, E('div', { class: 'ao-rules' }, 'Bu karar kendi ekranında, o ekranın kapılarıyla verilir (burada karar düğmesi yoktur).'), E('div', { class: 'ao-acts' }, r.link ? E('a', { href: r.link, class: 'go', 'data-testid': 'ao-source' }, 'Kaynakta karar ver') : E('span', { class: 'ao-denied' }, 'Kaynak ekran bilinmiyor.')));
        if (!r.approve.visible && !r.reject.visible)
            return null;
        const reason = E('textarea', { 'data-testid': 'ao-reason', 'aria-label': 'Onay gerekçesi', placeholder: 'Onay gerekçesi / notu (zorunlu, en az 5 karakter)', value: ui.reason, ...(busy || ui.rejecting === r.id ? { disabled: true } : {}) });
        reason.value = ui.reason;
        reason.addEventListener('input', () => { ui.reason = reason.value; });
        const off = busy || ui.rejecting === r.id;
        const approveBtn = r.approve.visible ? E('button', { type: 'button', class: 'okb', 'data-testid': 'ao-approve', ...((!r.approve.enabled || off) ? { disabled: true } : {}), title: r.approve.why ?? r.nextApprove, onClick: () => void decide(r, 'APPROVE', ui.reason) }, 'Onayla') : null;
        const rejectBtn = r.reject.visible ? E('button', { type: 'button', class: 'danger', 'data-testid': 'ao-reject', ...((!r.reject.enabled || off) ? { disabled: true } : {}), title: r.reject.why ?? r.nextReject, onClick: () => setRejecting(r.id) }, r.rejectLabel) : null;
        const why = [r.approve, r.reject].find((st) => st.visible && !st.enabled && st.why)?.why;
        return E('div', { class: 'ao-actbar', 'data-testid': 'ao-actions' }, ...(r.approve.visible ? [reason] : []), E('div', { class: 'ao-acts' }, approveBtn, rejectBtn), why ? E('div', { class: 'ao-denied', 'data-testid': 'ao-denied' }, why) : null, ui.rejecting === r.id ? rejectPanel(r) : null);
    };
    const trail = (r) => {
        if (r.state === 'DONE')
            return E('div', { 'data-testid': 'ao-decided' }, E('div', {}, E('b', {}, r.outcomeLabel ?? ''), ` · ${r.decidedBy ?? 'karar veren BİLİNMİYOR'} · ${fmt(r.decidedAt)}`), E('div', { class: 'mut' }, `Gerekçe: ${r.reason ?? r.reasonNote ?? 'kayıtta yok (BİLİNMİYOR)'}`));
        const c = detailCache.get(r.id);
        const lines = [];
        lines.push(E('div', {}, `Talep: ${r.owner ?? 'BİLİNMİYOR'} · ${fmt(r.requestedAt)} · bekleme ${waitLabel(r.waitingHours)}`));
        if (r.kind === 'TASK_COMPLETION') {
            if (!deps.taskDetail)
                lines.push(E('div', { class: 'mut' }, 'Görev geçmişi bu ekranda yok.'));
            else if (!c || c.hist === 'LOADING')
                lines.push(E('div', { class: 'mut', 'data-testid': 'ao-hist-loading' }, 'Görev geçmişi yükleniyor…'));
            else if (c.hist === 'ERROR')
                lines.push(E('div', { class: 'mut', 'data-testid': 'ao-hist-error' }, 'Görev geçmişi okunamadı.'));
            else if (c.hist === null)
                lines.push(E('div', { class: 'mut', 'data-testid': 'ao-hist-partial' }, 'Tam olay geçmişi bu sunucuda kurulu değil (kısmi): yalnız yukarıdaki bilgiler gösterilir.'));
            else
                lines.push(E('ol', { class: 'ao-hist', 'data-testid': 'ao-hist' }, ...c.hist.map((ev) => E('li', {}, E('b', {}, EVENT_TR[ev.event] ?? ev.event), ` · ${ev.actorLabel} · ${fmt(ev.at)}`, ev.note ? E('div', { class: 'mut' }, `“${ev.note}”`) : null))));
        }
        else
            lines.push(E('div', { class: 'mut' }, 'Önceki kararlar: bu kayıt için karar kaydı yok; tüm kararlar denetim kaydında tutulur.'));
        return E('div', {}, ...lines);
    };
    const evidenceSec = (r) => {
        if (r.kind !== 'TASK_COMPLETION' || !deps.taskDetail)
            return null;
        const c = detailCache.get(r.id);
        if (!c || c.ev === 'LOADING')
            return E('div', { class: 'ao-sec' }, E('h3', {}, 'Kanıt dosyaları'), E('div', { class: 'mut' }, 'Yükleniyor…'));
        if (c.ev === 'ERROR')
            return E('div', { class: 'ao-sec' }, E('h3', {}, 'Kanıt dosyaları'), E('div', { class: 'mut', 'data-testid': 'ao-ev-error' }, 'Kanıt dosyaları okunamadı.'));
        if (c.ev === null)
            return E('div', { class: 'ao-sec' }, E('h3', {}, 'Kanıt dosyaları'), E('div', { class: 'mut', 'data-testid': 'ao-ev-unavailable' }, 'Dosya kanıtı bu sunucuda kurulu değil; metin kanıtı yukarıdaki bilgilerdedir.'));
        return E('div', { class: 'ao-sec' }, E('h3', {}, 'Kanıt dosyaları'), c.ev.length ? E('ul', { class: 'ao-files', 'data-testid': 'ao-ev-files' }, ...c.ev.map((f) => E('li', {}, E('span', {}, `${f.fileName} · ${sizeTr(f.sizeBytes)} · ${f.uploaderLabel}`), E('button', { type: 'button', class: 'ghost', 'data-testid': 'ao-ev-open', onClick: () => void openFile(f) }, 'Aç')))) : E('div', { class: 'mut', 'data-testid': 'ao-ev-none' }, 'Dosya eklenmemiş.'));
    };
    const rulesBox = () => E('details', { class: 'ao-rules', 'data-testid': 'ao-rules' }, E('summary', {}, 'Kurallar ve kaynak'), E('div', {}, 'GECİKMİŞ = istenen tarihi geçen veya ≥72 sa bekleyen karar. KRİTİK = gecikmiş olan ya da üretimi durduran kalite kapısı (ilk parça, HOLD). Karar yetkisi sunucuda denetlenir; ilk parça ve HOLD kaldırma kendi ekranında verilir. Tamamlayan kişi kendi görevini onaylayamaz. Veri: commercial_approvals · purchase_requests · purchase_orders · tasks · kalite kapıları (canlı okuma) · ', res ? fmt(res.asOf) : ''));
    function paintDetail() {
        const r = ui.sel ? rows.find((x) => x.id === ui.sel) ?? null : null;
        if (!r) {
            detailHost.replaceChildren(E('div', { class: 'ao-empty-detail', 'data-testid': 'ao-detail-empty' }, 'Soldan bir karar seçin.'));
            return;
        }
        loadTaskDetail(r);
        const keep = document.activeElement;
        const focusId = keep?.getAttribute?.('data-testid');
        const hadFocus = !!keep && (focusId === 'ao-reason' || focusId === 'ao-reject-reason');
        const pos = hadFocus ? keep.selectionStart : null;
        const fact = (re) => r.facts.find((f) => re.test(f.label))?.value ?? null;
        const qty = fact(/^(miktar|adet)/i);
        const cell = (label, v, tid, unknownWarn = false) => E('div', {}, E('dt', {}, label), E('dd', { 'data-testid': tid, ...(v === null && unknownWarn ? { class: 'unk' } : {}) }, v ?? 'BİLİNMİYOR'));
        const related = E('span', {}, ...(r.related.length ? r.related.map((l) => E('a', { href: l.href, 'data-testid': 'ao-rel' }, l.label)).flatMap((x, i) => i ? [' · ', x] : [x]) : ['Bağlı iş emri / sipariş bilgisi kayıtta yok']));
        detailHost.replaceChildren(...(!isWide() ? [E('div', { style: 'margin-bottom:8px' }, E('button', { type: 'button', class: 'ghost ao-back', 'data-testid': 'ao-back', onClick: () => { if (ui.pushed)
                    history.back();
                else
                    leaveDetail(); } }, '← Liste'))] : []), 
        // 1 — what is being decided and where the source record is
        E('div', { class: 'ao-dh', 'data-item-detail': r.id }, E('div', {}, E('span', { class: `ao-tier ${r.priority}` }, r.state === 'DONE' ? (r.outcomeLabel ?? '') : r.critical ? `${r.overdue ? 'GECİKMİŞ' : 'KRİTİK'}` : TIER[r.priority]), ' ', E('span', { class: 'mut', style: 'font-size:12px' }, `${r.kindLabel} · ${r.dept}`)), E('h2', {}, r.title), E('div', { class: 'mut', style: 'margin-top:2px;font-size:13px' }, 'Kaynak kayıt: ', r.link ? E('a', { href: r.link, 'data-testid': 'ao-open' }, 'Kaydı aç') : 'bağlantı bilinmiyor')), ...(r.state === 'PENDING' ? [E('div', { class: 'mut', 'data-testid': 'ao-who', style: 'margin-top:4px;font-size:13px' }, r.mine ? (r.redirectOnly ? 'Bu karar sizin — kaynakta verilir.' : 'Bu karar sizde.') : 'Bu adım için karar yetkiniz yok (yalnız izleme).')] : []), 
        // 2 — who asked, how much, which department, how long it waits
        E('dl', { class: 'ao-strip', 'data-testid': 'ao-strip' }, cell('Talep eden', r.owner, 'ao-s-owner', true), ...(qty ? [cell('Miktar', qty, 'ao-s-qty')] : []), cell('Departman', r.dept, 'ao-s-dept'), cell(r.state === 'DONE' ? 'Karar' : 'Bekleme', r.state === 'DONE' ? `${fmt(r.decidedAt)}` : waitLabel(r.waitingHours), 'ao-s-wait')), E('div', { class: 'ao-detail' }, 
        // 3 — why it is needed and how important it is
        E('dl', { class: 'ao-grid' }, dd('Neden onay gerekiyor?', r.why, 'ao-q-why'), dd('Öncelik / önem', r.state === 'DONE' ? 'Tamamlandı' : r.priorityWhy, 'ao-q-priority')), 
        // 4 — risk, affected records, next stage
        E('dl', { class: 'ao-grid' }, dd('Karar vermezsem ne aksar? (risk)', r.state === 'DONE' ? 'Karar verildi.' : r.ifWaiting, 'ao-q-wait'), dd('Etkilenen iş emri / sipariş', related, 'ao-q-source')), ...(r.state === 'PENDING' ? [E('div', { class: 'ao-sec' }, E('h3', {}, 'Sonraki aşama'), E('div', { class: 'ao-next', 'data-testid': 'ao-next' }, E('div', {}, E('b', {}, r.redirectOnly ? 'KARAR' : 'ONAYLARSAM'), r.nextApprove), r.redirectOnly ? null : E('div', {}, E('b', {}, r.rejectLabel.toLocaleUpperCase('tr-TR')), r.nextReject)))] : []), 
        // 5 — facts, evidence, earlier decisions
        E('div', { class: 'ao-sec' }, E('h3', {}, 'Karar için bilgi ve kanıt'), r.facts.length ? E('div', { class: 'ao-facts', 'data-testid': 'ao-facts' }, ...r.facts.map((f) => E('div', {}, E('b', {}, f.label), f.label.includes('serbest bıraktı') ? fmt(f.value) : f.value))) : E('div', { class: 'mut', 'data-testid': 'ao-facts-none' }, 'Kayıt başka bilgi taşımıyor.')), evidenceSec(r), E('div', { class: 'ao-sec' }, E('h3', {}, 'Geçmiş ve sorumlu'), trail(r)), rulesBox()), 
        // 6 — the decision itself: always reachable (sticky), after the facts it depends on
        ...[actionBox(r)].filter((x) => !!x));
        if (hadFocus) {
            const t = detailHost.querySelector(`[data-testid="${focusId}"]`);
            if (t) {
                t.focus();
                if (pos !== null)
                    try {
                        t.setSelectionRange(pos, pos);
                    }
                    catch { /* not a text field */ }
            }
        }
    }
    // ---------------- list ----------------
    const rowEl = (r) => {
        const sel = ui.sel === r.id && (isWide() || ui.mobileDetail);
        const tier = r.state === 'DONE' ? E('span', { class: `ao-tier ${r.outcome === 'APPROVED' ? 'NORMAL' : 'KRITIK'}` }, r.outcomeLabel ?? '') : (r.critical ? E('span', { class: `ao-tier ${r.priority}` }, r.overdue ? '! GECİKMİŞ' : '! KRİTİK') : r.priority === 'NORMAL' ? null : E('span', { class: `ao-tier ${r.priority}` }, TIER[r.priority]));
        const pick = E('button', { type: 'button', class: 'ao-pick', 'data-testid': 'ao-pick', 'aria-current': sel ? 'true' : 'false', onClick: () => select(r.id) }, E('span', { class: 'ao-l1' }, E('span', { class: 'k' }, tier, E('span', { class: 'mut' }, r.kindLabel)), r.state === 'PENDING' && r.mine ? E('span', { class: 'ao-mine' }, '● sizde') : null), E('span', { class: 'ao-title' }, r.title), E('span', { class: 'ao-meta' }, r.state === 'DONE' ? E('span', {}, `${r.decidedBy ?? 'karar veren BİLİNMİYOR'} · ${fmt(r.decidedAt)}`) : E('span', { class: 'who' }, r.owner ? E('b', {}, r.owner) : E('span', {}, 'talep eden BİLİNMİYOR')), r.state === 'PENDING' ? E('span', { class: r.overdue ? 'ao-late' : '' }, `bekleme ${waitLabel(r.waitingHours)}`) : null, E('span', {}, r.dept), r.state === 'PENDING' && r.requestedAt ? E('span', {}, fmtShort(r.requestedAt)) : null, E('span', { class: 'ao-ref' }, `#${r.recordId.replace(/-/g, '').slice(0, 4).toUpperCase()}`)));
        return E('div', { class: 'ao-row', 'data-testid': 'ao-row', 'data-item': r.id, 'data-kind': r.kind, 'data-pri': r.priority, 'data-state': r.state, 'data-mine': String(r.mine), 'data-outcome': r.outcome ?? '', 'data-selected': String(sel), 'data-crit': String(r.critical && r.state === 'PENDING'), 'data-overdue': String(r.overdue && r.state === 'PENDING') }, pick);
    };
    function paintList() {
        const at = loadedAt || now();
        const list = applyApFilters(rows, ui.filters, at);
        const shown = list.slice(0, ui.shown);
        const more = list.length - shown.length;
        const counts = viewCountsAp(rows);
        for (const c of chips) {
            c.btn.setAttribute('aria-pressed', String(ui.filters.view === c.id));
            c.c.textContent = String(counts[c.id]);
        }
        for (const o of viewSelOpts)
            o.opt.textContent = `${AP_VIEWS.find((v) => v.id === o.id).label} (${counts[o.id]})`;
        if (isWide() && !list.some((r) => r.id === ui.sel)) {
            ui.sel = list[0]?.id ?? null;
            ui.reason = '';
        }
        const keepTop = listHost.scrollTop;
        const errs = Object.entries(res?.sourceErrors ?? {});
        listHost.replaceChildren(...(ui.focusMissing ? [E('div', { 'data-testid': 'ao-focus-missing', class: 'banner error' }, 'Bu karar bulunamadı ya da size açık değil.')] : []), ...errs.map(([k, m]) => E('div', { 'data-testid': 'ao-source-error', class: 'banner error' }, `${k === 'LOTS' ? 'Parti etiketleri' : k === 'NAMES' ? 'İsim eşleşmesi' : k === 'LINKS' ? 'Bağlı kayıtlar' : k === 'HISTORY' ? 'Karar geçmişi' : ROW_KIND_LABEL[k] ?? 'Kaynak'} okunamadı: ${errText(new Error(m))} — bu kaynak "0 bekleyen" gibi gösterilmez; liste eksik olabilir.`)), ...(gatesError ? [E('div', { 'data-testid': 'ao-source-error', class: 'banner error' }, `Kalite kapıları okunamadı: ${gatesError} — liste eksik olabilir.`)] : []), ...(list.length ? [] : [E('div', { 'data-testid': rows.length ? 'ao-filter-empty' : 'ao-empty', class: 'empty' }, rows.length ? 'Bu filtreyle eşleşen karar yok.' : (errs.length || gatesError) ? 'Okunabilen kaynaklarda sizi bekleyen karar yok (bazı kaynaklar okunamadı — yukarıya bakın).' : 'Şu an sizden bekleyen karar yok.')]), ...shown.map(rowEl), ...(more > 0 ? [E('button', { type: 'button', class: 'ghost ao-more', 'data-testid': 'ao-more', onClick: () => { ui.shown += PAGE; paintList(); } }, `${more} karar daha göster`)] : []));
        listHost.scrollTop = keepTop;
        if (state.focus && ui.sel) {
            const el = listHost.querySelector(`[data-item="${ui.sel}"]`);
            if (el && isWide())
                el.scrollIntoView?.({ block: 'nearest' });
        }
    }
    // ---------------- whole screen ----------------
    function rebuild() {
        const wide = isWide();
        const sum = summarizeAp(rows);
        const fc = facetsAp(rows);
        if (ui.mobileDetail && (wide || !rows.some((i) => i.id === ui.sel)))
            ui.mobileDetail = false;
        const tile = (cls, label, n, tid) => E('div', { class: `ao-tile ${cls}`, 'data-testid': tid }, E('div', { class: 'n' }, `${n}`), E('div', { class: 'l' }, label));
        const tiles = wide ? [tile('pend', 'BEKLEYEN', sum.pending, 'ao-kpi-pending'), tile('crit', 'KRİTİK', sum.critical, 'ao-kpi-critical'), tile('late', 'GECİKMİŞ', sum.overdue, 'ao-kpi-overdue'), tile('done', 'TAMAMLANAN', sum.done, 'ao-kpi-done')]
            : [tile('crit', 'KRİTİK', sum.critical, 'ao-kpi-critical'), tile('late', 'GECİKMİŞ', sum.overdue, 'ao-kpi-overdue'), tile('pend', 'BEKLEYEN', sum.pending, 'ao-kpi-pending')];
        chips.length = 0;
        viewSelOpts.length = 0;
        const setView = (v) => { ui.filters = { ...ui.filters, view: v }; ui.shown = PAGE; paintList(); paintDetail(); };
        const viewBar = wide ? E('div', { class: 'ao-views', role: 'group', 'aria-label': 'Görünüm' }, ...AP_VIEWS.map((v) => { const c = E('span', { class: 'c' }); const b = E('button', { type: 'button', class: 'ao-chip', 'data-testid': `ao-view-${v.id.toLowerCase()}`, 'aria-pressed': String(ui.filters.view === v.id), onClick: () => setView(v.id) }, v.label, c); chips.push({ id: v.id, btn: b, c }); return b; }))
            : E('select', { class: 'ao-viewsel', 'data-testid': 'ao-view-select', 'aria-label': 'Görünüm', onChange: (e) => setView(e.target.value) }, ...AP_VIEWS.map((v) => { const opt = E('option', { value: v.id, ...(ui.filters.view === v.id ? { selected: true } : {}) }, v.label); viewSelOpts.push({ id: v.id, opt }); return opt; }));
        const search = E('input', { type: 'search', 'data-testid': 'ao-search', 'aria-label': 'Kararlarda ara', placeholder: 'Karar, kayıt veya kişi ara…', value: ui.filters.q });
        search.addEventListener('input', () => { ui.filters = { ...ui.filters, q: search.value }; ui.shown = PAGE; paintList(); paintDetail(); });
        const sel = (testid, label, opts, cur, on) => opts.length ? E('select', { 'data-testid': testid, 'aria-label': label, onChange: (e) => { const v = e.target.value; on(v || null); ui.shown = PAGE; paintList(); paintDetail(); } }, E('option', { value: '' }, label), ...opts.map((o) => E('option', { value: o.id, ...(cur === o.id ? { selected: true } : {}) }, o.label))) : null;
        const deptSel = sel('ao-dept', 'Tüm departmanlar', fc.depts.map((x) => ({ id: x, label: x })), ui.filters.dept, (v) => { ui.filters = { ...ui.filters, dept: v }; });
        const kindSel = sel('ao-kind', 'Tüm karar türleri', fc.kinds, ui.filters.kind, (v) => { ui.filters = { ...ui.filters, kind: v }; });
        const ownerSel = sel('ao-owner', 'Tüm talep edenler', fc.owners.map((x) => ({ id: x, label: x })), ui.filters.owner, (v) => { ui.filters = { ...ui.filters, owner: v }; });
        const daysSel = sel('ao-days', 'Tüm tarihler', [{ id: '1', label: 'Son 24 saat' }, { id: '7', label: 'Son 7 gün' }, { id: '30', label: 'Son 30 gün' }], ui.filters.days === null ? null : String(ui.filters.days), (v) => { ui.filters = { ...ui.filters, days: v === null ? null : Number(v) }; });
        const mineBtn = E('button', { type: 'button', class: 'ao-chip', 'data-testid': 'ao-mine', 'aria-pressed': String(ui.filters.mine), onClick: (e) => { ui.filters = { ...ui.filters, mine: !ui.filters.mine }; e.currentTarget.setAttribute('aria-pressed', String(ui.filters.mine)); ui.shown = PAGE; paintList(); paintDetail(); } }, 'Yalnız benim kararlarım');
        const active = (ui.filters.dept ? 1 : 0) + (ui.filters.kind ? 1 : 0) + (ui.filters.owner ? 1 : 0) + (ui.filters.days !== null ? 1 : 0) + (ui.filters.mine ? 1 : 0);
        const bar = wide ? E('div', { class: 'ao-bar' }, viewBar, search, deptSel, kindSel, ownerSel, daysSel, mineBtn)
            : E('div', { class: 'ao-bar' }, search, viewBar, E('details', { class: 'ao-filter', 'data-testid': 'ao-filter-menu', ...(active ? { open: true } : {}) }, E('summary', {}, active ? `Filtre (${active})` : 'Filtre'), E('div', { class: 'fb' }, deptSel, kindSel, ownerSel, daysSel, mineBtn)));
        const countLine = E('div', { 'data-testid': 'ao-count', style: 'font-size:13px;color:#94a3b8' }, `${sum.mine} karar sizde · ${sum.pending} bekleyen${sum.longestHours === null ? '' : ` · en uzun bekleme ${waitLabel(sum.longestHours)}`}`);
        const detailMode = !wide && ui.mobileDetail;
        const body = detailMode ? [detailHost] : wide ? [E('div', { class: 'ao-split' }, E('div', { style: 'min-width:0;display:grid;gap:6px' }, countLine, listHost), detailHost)] : [countLine, listHost];
        mount(container, E('div', { class: `kd ao-screen${detailMode ? ' ao-detail-mode' : ''}` }, E('style', {}, AO_CSS), ...head(), ...(detailMode ? [] : [E('div', { 'data-testid': 'ao-summary', class: 'ao-tiles' }, ...tiles), bar]), ...body));
        ui.shown = Math.max(ui.shown, PAGE);
        paintList();
        if (wide || detailMode)
            paintDetail();
        if (wide)
            fitList();
    }
    function fitList() { const top = listHost.getBoundingClientRect().top + window.scrollY; listHost.parentElement?.parentElement?.style.setProperty('--ao-top', `${Math.round(top)}px`); }
    const onResize = () => { if (!alive()) {
        window.removeEventListener('resize', onResize);
        return;
    } if (isWide() && res)
        fitList(); };
    window.addEventListener('resize', onResize);
    const tick = setInterval(() => { const f = container.querySelector('[data-testid="ao-fresh"]'); if (!f || f.getAttribute('data-inst') !== inst) {
        if (loadedAt)
            clearInterval(tick);
        return;
    } const stale = !!staleError || Math.floor((now() - loadedAt) / 60000) >= 5; const partial = Object.keys(res?.sourceErrors ?? {}).length > 0 || !!gatesError; f.setAttribute('data-stale', String(stale)); f.setAttribute('data-partial', String(partial)); f.textContent = !loadedAt ? 'YÜKLENİYOR…' : stale ? `BAYAT · ${hhmm(loadedAt)} verisi` : partial ? `KISMİ VERİ · ${hhmm(loadedAt)} (bazı kaynaklar okunamadı)` : `CANLI · ${hhmm(loadedAt)}`; }, 30000);
    void initials;
    if (state.message)
        setMessage(state.message);
    mount(container, E('div', { class: 'kd ao-screen' }, E('style', {}, AO_CSS), E('h1', { 'data-testid': 'ao-heading' }, 'Onaylarım'), E('div', { 'data-testid': 'ao-loading', class: 'mut' }, 'Karar listesi yükleniyor…')));
    await reload();
}
