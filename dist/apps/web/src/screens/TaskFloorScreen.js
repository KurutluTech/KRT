// KMI NEXT — Görevlerim (KMI-003; migration 0058 carries the data). "Ne yapacağım, neyin geç kaldığı, neyin beni beklediği, işi bitirmek için nereye gideceğim?"
//  • ONE prioritised work list: assigned tasks + the open records task_floor derives from quality / maintenance / purchasing / shipment / CAM / work orders.
//    A record is completed AT ITS SOURCE (this screen only takes the person there); an assigned task is completed here. Tamamlandı ≠ onaylandı (four eyes).
//  • Order, tier, lateness and "needs me" come from the SAME evaluators as the Smart Home (domain: smartHome tiers, taskSla, taskWorkspace) — the two can never disagree.
//  • Desktop: compact list on the left, the selected task's detail panel on the right (the list never loses its place, the page does not grow). Phone: list → separate detail screen (back = browser back).
//  • One data request per load; filtering / search / paging are local; history and evidence files load only for the task being looked at. A refresh that fails keeps the old list and says it is STALE (never shown as live).
//  • No money or price data. No action is offered that the server does not implement.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { applyFilters, buildWorkItems, DEFAULT_FILTERS, facets, pageOf, summarize, viewCounts, VIEWS } from '../../../../packages/domain/src/taskWorkspace.js';
import { durationTr, SLA_TR } from '../../../../packages/domain/src/taskSla.js';
import { checkEvidenceFile, EVIDENCE_ACCEPT, EVIDENCE_REFUSAL_TR, evidenceRefText, evidenceSatisfied, MAX_EVIDENCE_FILES } from '../../../../packages/domain/src/taskEvidence.js';
import { errorText } from '../errorText.js';
import { DS_CSS, initials } from '../ds.js';
const ROLE_TR = { ADMIN: 'Yönetici', MANAGEMENT: 'Yönetim', OPERATOR: 'Operatör', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satınalma', ACCOUNTING: 'Muhasebe', SHIPPING: 'Sevkiyat', CAM: 'CAM' };
const EVENT_TR = { CREATED: 'Oluşturuldu / atandı', STARTED: 'Başlatıldı', COMPLETED: 'Tamamlandı (onay bekliyor)', APPROVED: 'Onaylandı', REOPENED: 'Yeniden açıldı', CANCELLED: 'İptal edildi' };
const REFUSAL_TR = {
    NOT_ASSIGNEE: 'Bu görev size atanmamış — yalnız atanan kişi başlatır/tamamlar.', SELF_APPROVAL_FORBIDDEN: 'Tamamlayan kişi kendi işini onaylayamaz — başka bir yetkili onaylamalı.',
    EVIDENCE_REQUIRED: 'Bu görev için kanıt zorunlu (fotoğraf/dosya adı, ölçüm no vb. en az 5 karakter).', NOTE_REQUIRED: 'Not yazın (en az 5 karakter).', REASON_REQUIRED: 'Neden yazın (en az 5 karakter).',
    ASSIGNEE_REQUIRED: 'Bir kişi veya rol seçin.', TITLE_REQUIRED: 'Görev başlığı yazın.', SOURCE_RECORD_NOT_FOUND: 'İlgili kayıt bulunamadı.', DUE_BEFORE_START: 'Bitiş başlangıçtan önce olamaz.',
    TASK_NOT_FOUND: 'Bu görev bulunamadı ya da size açık değil.', ...EVIDENCE_REFUSAL_TR, ILLEGAL_TASK_TRANSITION: 'Görevin durumu bu arada değişti — listeyi yenileyip tekrar deneyin.',
};
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); const k = Object.keys(REFUSAL_TR).find((x) => m.includes(x)); return k ? REFUSAL_TR[k] : errorText(e); };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const hhmm = (ms) => new Date(ms).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const newReq = () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const GLY = { 1: '✕', 2: '◆', 3: '!', 4: '◷', 5: '▶', 6: '·' };
const PAGE = 40;
const TF_CSS = DS_CSS + `
.kd.tf-screen{max-width:1440px;margin:0 auto;gap:8px}.kd.tf-screen [hidden]{display:none}
.kd .tf-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:2px}.kd .tf-top>div:first-child{flex:1 1 auto;min-width:0}.kd .tf-top .hd{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap}.kd .tf-top h1{margin:0;font-size:22px}.kd .tf-top .sub{font-size:13px;color:#94a3b8}
.kd .tf-fresh{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.06em;border-radius:999px;padding:5px 10px;border:1px solid #14532d;background:rgba(34,197,94,.1);color:#86efac}
.kd .tf-fresh[data-stale="true"]{border-color:#92400e;background:rgba(245,158,11,.12);color:#fcd34d}
.kd .tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0}.kd .tile{border-radius:12px;padding:7px 12px;border:1px solid #334155;background:#0f172a;min-width:0;display:flex;align-items:baseline;gap:10px}
.kd .tile .n{font-size:24px;font-weight:800;line-height:1.1}.kd .tile .l{font-size:11px;font-weight:800;letter-spacing:.08em}
.kd .tile.open{border-color:#3b82f6;background:rgba(59,130,246,.12)}.kd .tile.late{border-color:#ef4444;background:rgba(239,68,68,.12)}.kd .tile.hold{border-color:#f59e0b;background:rgba(245,158,11,.1)}.kd .tile.appr{border-color:#8b5cf6;background:rgba(139,92,246,.14)}.kd .tile.crit{border-color:#fb7185;background:rgba(244,63,94,.12)}
.kd .tf-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0}
.kd .tf-views{display:flex;gap:6px;flex-wrap:wrap;flex:1 1 100%}
.kd button.tf-chip{min-height:38px;border-radius:999px;border:1px solid #334155;background:#0f172a;color:#cbd5e1;padding:0 12px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
.kd button.tf-chip[aria-pressed="true"]{border-color:#22d3ee;background:rgba(34,211,238,.14);color:#fff}.kd button.tf-chip .c{margin-left:6px;font-weight:800;opacity:.85}
.kd .tf-bar input[type=search],.kd .tf-bar select{min-height:40px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px}.kd .tf-bar input[type=search]{flex:1 1 220px;min-width:0}
.kd .tf-split{display:grid;grid-template-columns:minmax(340px,5fr) minmax(0,7fr);gap:12px;align-items:start}
.kd .tf-listcol{display:flex;flex-direction:column;gap:6px;max-height:max(300px,calc(100vh - var(--tf-top,330px) - 16px));min-height:300px;overflow-y:auto;padding-right:4px;overscroll-behavior:contain}
.kd .tf-detailcol{position:sticky;top:66px;max-height:calc(100vh - 80px);overflow-y:auto;border:1px solid #1e293b;border-radius:14px;background:#0f172a;padding:14px 16px;min-width:0;overscroll-behavior:contain}
.kd .tf-task,.kd .tf-derived{border:1px solid #1e293b;border-left:5px solid #475569;border-radius:12px;margin:0;background:linear-gradient(180deg,#111c2e,#0f172a);display:flex;align-items:stretch;gap:6px;color:#e2e8f0;flex:0 0 auto}
.kd .tf-task[data-late="true"],.kd .tf-derived[data-late="true"]{border-left-color:#ef4444;border-color:#7f1d1d}.kd .tf-task[data-tier="1"],.kd .tf-derived[data-tier="1"]{border-left-color:#f43f5e}
.kd .tf-task[data-tier="2"],.kd .tf-derived[data-tier="2"]{border-left-color:#a78bfa}.kd [data-status="IN_PROGRESS"]{border-left-color:#3b82f6}.kd .tf-task[data-status="COMPLETED"]{border-left-color:#f59e0b}.kd .tf-task[data-status="APPROVED"]{border-left-color:#22c55e}.kd .tf-task[data-status="CANCELLED"]{border-left-color:#64748b;opacity:.8}
.kd .tf-task[data-selected="true"],.kd .tf-derived[data-selected="true"]{background:linear-gradient(180deg,#17263d,#12203a);box-shadow:inset 0 0 0 1px #22d3ee}
.kd [data-focus="true"]{outline:2px solid #67e8f9}
.kd button.tf-pick{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:2px;flex:1 1 auto;min-width:0;min-height:56px;text-align:left;background:transparent;border:0;padding:8px 10px;color:inherit;cursor:pointer;border-radius:10px;font:inherit;font-weight:400;line-height:1.25;overflow-wrap:anywhere}
.kd .tf-l1{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.kd .tf-l1 .k{min-width:0;flex:1 1 auto;display:flex;gap:6px;align-items:baseline}.kd .tf-l1 .k .tf-tier{flex:0 0 auto;white-space:nowrap}.kd .tf-l1 .k .mut{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kd .tf-l1 .pill{flex:0 0 auto}
.kd .tf-tier{font-size:11px;font-weight:800;letter-spacing:.06em;color:#cbd5e1}.kd .tf-tier.t1{color:#fda4af}.kd .tf-tier.t2{color:#c4b5fd}.kd .tf-tier.t3{color:#fca5a5}.kd .tf-tier.t4{color:#fcd34d}
.kd .tf-title{font-size:15px;font-weight:800;color:#fff;line-height:1.25}
.kd .tf-meta{display:flex;gap:2px 12px;flex-wrap:wrap;font-size:12.5px;color:#94a3b8;align-items:center}.kd .tf-meta b{color:#e2e8f0;font-weight:700}
.kd .tf-late{color:#fca5a5;font-weight:800}.kd .tf-esc{color:#fca5a5;font-weight:600;font-size:13px;margin-top:4px}.kd .tf-next{margin-top:5px;font-size:13px;color:#a5f3fc;font-weight:700}
.kd .tf-quick{flex:0 0 auto;align-self:center;margin:6px 8px 6px 0;min-width:92px;min-height:48px;font-size:16px;font-weight:800}
.kd .acts{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0;align-items:center}.kd .acts a{color:#67e8f9;font-weight:700}
.kd .evid{font-size:13px;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;margin-top:6px;color:#cbd5e1}
.kd .tf-dh{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}.kd .tf-dh h2{margin:2px 0 0;font-size:19px;line-height:1.25;color:#fff;overflow-wrap:anywhere;letter-spacing:0;text-transform:none;font-weight:800}
.kd button.tf-back{min-height:44px;padding:0 14px;font-weight:700}
.kd .tf-detail{margin-top:12px;border-top:1px dashed #334155;padding-top:12px;display:grid;gap:12px}.kd .tf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px}
.kd .tf-detail dl,.kd .tf-detail dd,.kd .tf-detail dt{margin:0}.kd .tf-detail dt{font-size:11px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase}.kd .tf-detail dd{margin-top:2px;font-size:14px;color:#e2e8f0;overflow-wrap:anywhere}
.kd .tf-sec>h3{margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase}
.kd .tf-sla{height:6px;border-radius:999px;background:#1e293b;overflow:hidden;margin-top:6px}.kd .tf-sla i{display:block;height:100%;background:#22d3ee}.kd .tf-sla[data-state="OVERDUE"] i{background:#ef4444}.kd .tf-sla[data-state="DUE_SOON"] i{background:#f59e0b}
.kd ol.tf-hist{list-style:none;margin:6px 0 0;padding:0;border-left:2px solid #334155}.kd ol.tf-hist li{padding:0 0 8px 12px;position:relative;font-size:13px}.kd ol.tf-hist li::before{content:"";position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:#22d3ee}
.kd .tf-files{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:6px}.kd .tf-files li{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:6px 8px;font-size:13px}.kd .tf-files li span{min-width:0;overflow-wrap:anywhere}
.kd .tf-pickfile{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1 1 100%}.kd .tf-pickfile input[type=file]{font-size:14px;max-width:100%;color:#cbd5e1}
.kd .tf-qr{display:flex;gap:10px;align-items:center;margin-top:6px}.kd .tf-qr svg{width:88px;height:88px;background:#fff;border-radius:6px;padding:4px;flex:0 0 auto}.kd .tf-qr code{font-size:12px;color:#94a3b8;word-break:break-all}
.kd .tf-more{display:block;width:100%;min-height:44px;margin:4px 0}
.kd .tf-bar details.newtask{flex:0 0 auto}.kd .tf-bar details.newtask[open]{flex:1 1 100%;order:99}.kd details.newtask,.kd details.tf-filter{border:1px solid #334155;border-radius:12px;padding:4px 10px;background:#0f172a;margin:0}.kd details summary{min-height:36px;cursor:pointer;font-weight:700;color:#e2e8f0;display:flex;align-items:center}
.kd details.tf-filter{flex:0 0 auto}.kd details.tf-filter .fb{display:grid;gap:8px;padding:6px 0 8px}.kd details.tf-filter .fb select{width:100%}
.kd .who{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1}.kd .who .avatar{width:22px;height:22px;font-size:10px}
.kd .tf-empty-detail{color:#94a3b8;font-size:14px;padding:30px 8px;text-align:center}
@media (max-width:1100px){.kd .tf-split{grid-template-columns:minmax(300px,5fr) minmax(0,6fr)}.kd .tf-grid{grid-template-columns:1fr}}
@media (max-width:900px){
  .kd.tf-screen{padding-bottom:calc(24px + env(safe-area-inset-bottom))}
  .kd .tf-split{display:block}.kd .tf-listcol{max-height:none;min-height:0;overflow:visible;padding-right:0}.kd .tf-detailcol{position:static;max-height:none;overflow:visible;border:0;background:transparent;padding:0}
  .kd .tf-top{align-items:center;flex-wrap:nowrap;gap:6px}.kd .tf-top .sub{display:none}.kd .tf-top h1{font-size:20px}.kd .tf-fresh{padding:4px 8px;font-size:11px}.kd .tf-top button.ghost{min-height:40px;padding:4px 10px}
  .kd .tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.kd .tile{flex-direction:column;gap:0;align-items:flex-start;padding:6px 10px}.kd .tile .n{font-size:22px}.kd .tile .l{font-size:10px;letter-spacing:.05em}
  .kd .tf-bar{gap:6px}.kd .tf-bar input[type=search]{flex:1 1 100%}.kd .tf-bar select.tf-viewsel{flex:1 1 0;min-width:0}
  .kd details summary{min-height:44px}.kd .tf-title{font-size:16px}.kd .tf-task button,.kd .tf-derived button,.kd .tf-detailcol button{min-height:48px;font-size:16px}
  .kd .tf-detailcol .acts button,.kd .tf-detailcol .acts a.primary{flex:1 1 100%}
}`;
const MQ = '(min-width: 901px)';
const isWide = () => (typeof matchMedia === 'function' ? matchMedia(MQ).matches : true);
const fileB64 = async (f) => { const buf = new Uint8Array(await f.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin); };
const sizeTr = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export async function renderTaskFloorScreen(container, api, state = {}) {
    let scope = state.scope ?? 'MINE';
    const ui = { filters: { ...DEFAULT_FILTERS, view: state.view ?? DEFAULT_FILTERS.view }, shown: PAGE, sel: state.focus ? `task:${state.focus}` : null, open: state.open ?? null, draft: state.draft ?? null, focusDone: false, focusMissing: false, mobileDetail: false, pushed: false, files: [], qrDone: false };
    let data = null;
    let people = [];
    let peopleLoaded = false;
    let loadedAt = 0;
    let staleError = null;
    let generation = 0;
    let savedScroll = 0;
    const hist = new Map();
    const evm = new Map();
    let items = [];
    const nowMs = () => Date.now();
    const inst = Math.random().toString(36).slice(2);
    const alive = () => container.querySelector('[data-inst]')?.getAttribute('data-inst') === inst;
    const msgBox = h('div', { 'aria-live': 'polite', hidden: true });
    const setMessage = (m) => { msgBox.hidden = !m; msgBox.replaceChildren(...(m ? [h('div', { 'data-testid': 'tf-message', 'data-kind': m.kind, class: `banner ${m.kind === 'ok' ? 'info' : 'error'}` }, m.text)] : [])); };
    const root = h('div', { class: 'kd tf-screen' });
    mount(container, root);
    const head = () => [h('div', { class: 'tf-top' }, h('div', { class: 'hd' }, h('h1', { 'data-testid': 'tf-heading' }, 'Görevlerim'), h('div', { class: 'sub' }, 'Ne yapacağınız, neyin geciktiği ve neyin sizi beklediği tek listede.')), freshBadge()), msgBox];
    const freshBadge = () => {
        const age = loadedAt ? Math.floor((nowMs() - loadedAt) / 60000) : 0;
        const stale = !!staleError || age >= 5;
        return h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('span', { class: 'tf-fresh', 'data-testid': 'tf-fresh', 'data-inst': inst, 'data-stale': String(stale) }, !loadedAt ? 'YÜKLENİYOR…' : stale ? `BAYAT · ${hhmm(loadedAt)} verisi` : `CANLI · ${hhmm(loadedAt)}`), h('button', { type: 'button', class: 'ghost', 'data-testid': 'tf-refresh', onClick: () => void reload('Liste yenilendi.') }, '↻ Yenile'));
    };
    const reload = async (okText) => {
        const my = ++generation;
        try {
            const d = await api.floor(scope);
            if (my !== generation)
                return; // a later answer replaced this one (or the user left): never paint an old answer
            data = d;
            loadedAt = nowMs();
            staleError = null;
            if (d.canManage && !peopleLoaded) {
                people = await api.people().catch(() => []);
                peopleLoaded = true;
            }
            if (my !== generation)
                return;
            items = buildWorkItems({ manual: d.manual, derived: d.derived, nowMs: loadedAt, scope }, d.canManage);
            if (state.focus && !ui.focusDone) {
                const want = `task:${state.focus}`;
                if (!items.some((x) => x.id === want) && d.canManage && scope === 'MINE') {
                    scope = 'ALL';
                    return reload(okText);
                } // a manager opening a task QR for someone else's task
                const it = items.find((x) => x.id === want);
                if (it) {
                    ui.filters = { ...ui.filters, view: it.state === 'DONE' || it.state === 'CANCELLED' ? 'DONE' : 'ACTIVE' };
                    if (!isWide())
                        ui.mobileDetail = true;
                    if (state.viaQr && it.taskId && !ui.qrDone) {
                        ui.qrDone = true;
                        let seen = false;
                        try {
                            const k = `kmi.tf.qr.${it.taskId}`;
                            seen = sessionStorage.getItem(k) === '1';
                            if (!seen)
                                sessionStorage.setItem(k, '1');
                        }
                        catch { /* storage may be unavailable: then the audit simply runs once per load */ }
                        if (!seen)
                            void api.qrOpened(it.taskId);
                    }
                }
                else
                    ui.focusMissing = true;
            }
            rebuild();
            if (okText)
                setMessage({ kind: 'ok', text: okText });
        }
        catch (e) {
            if (my !== generation)
                return;
            if (data) {
                staleError = errText(e);
                rebuild();
                setMessage({ kind: 'error', text: `Yenilenemedi — gösterilen liste ${hhmm(loadedAt)} tarihli (BAYAT). ${staleError}` });
            }
            else {
                mount(container, h('div', { class: 'kd tf-screen' }, h('style', {}, TF_CSS), h('h1', { 'data-testid': 'tf-heading' }, 'Görevlerim'), msgBox, h('div', { 'data-testid': 'tf-load-error', class: 'banner error' }, errText(e))));
            }
        }
    };
    const act = async (fn, ok) => {
        try {
            await fn();
            ui.open = null;
            ui.draft = null;
            ui.files = [];
            hist.clear();
            evm.clear();
            await reload(ok);
        }
        catch (e) {
            setMessage({ kind: 'error', text: errText(e) });
        }
    };
    const listHost = h('div', { 'data-testid': 'tf-list', class: 'tf-listcol' });
    const detailHost = h('section', { 'data-testid': 'tf-detail-panel', class: 'tf-detailcol', 'aria-label': 'Görev detayı' });
    const chips = [];
    const viewSelOpts = [];
    const sourceLink = (x) => x.sourceRoute && x.origin === 'MANUAL' ? h('a', { href: `#${x.sourceRoute}`, 'data-testid': 'tf-source' }, `${x.source?.label ?? 'kayıt'} →`) : null;
    const metaLate = (x) => {
        if (x.state === 'DONE' || x.state === 'CANCELLED')
            return null;
        if (x.sla.state === 'OVERDUE')
            return h('span', { 'data-testid': x.origin === 'MANUAL' ? 'tf-late' : 'tf-record-late', class: 'tf-late' }, `GECİKTİ${x.sla.overdueMin !== null ? ` · ${durationTr(x.sla.overdueMin)}` : ''}`);
        if (x.dueIso)
            return h('span', {}, 'Bitiş ', h('b', {}, fmt(x.dueIso)), x.sla.remainingMin !== null ? ` · ${durationTr(x.sla.remainingMin)} kaldı` : '');
        return null;
    };
    const pillFor = (x) => h('span', { 'data-testid': 'tf-status', class: `pill ${x.state === 'DONE' ? 'ok' : x.state === 'AWAITING_APPROVAL' || x.state === 'AWAITING_DECISION' || x.state === 'BLOCKED' ? 'warn' : x.state === 'IN_PROGRESS' ? 'info' : x.state === 'CANCELLED' ? 'bad' : ''}` }, x.origin === 'MANUAL' && x.state === 'AWAITING_APPROVAL' ? 'Onay bekliyor' : x.stateLabel);
    // ---------------- selection / mobile detail screen ----------------
    const select = (id, openMode = null) => {
        ui.sel = id;
        ui.open = openMode;
        ui.draft = null;
        ui.files = [];
        if (isWide()) {
            paintList();
            paintDetail();
            return;
        }
        savedScroll = window.scrollY;
        ui.mobileDetail = true;
        try {
            history.pushState({ kmiTf: 1 }, '');
            ui.pushed = true;
        }
        catch {
            ui.pushed = false;
        }
        rebuild();
        window.scrollTo?.(0, 0);
    };
    const leaveDetail = () => { ui.mobileDetail = false; ui.pushed = false; ui.open = null; ui.draft = null; ui.files = []; rebuild(); window.scrollTo?.(0, savedScroll); };
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
    } if (data) {
        ui.mobileDetail = !isWide() && !!ui.sel && ui.mobileDetail;
        rebuild();
    } };
    mq?.addEventListener('change', onMq);
    // ---------------- detail ----------------
    const loadDetailData = (x) => {
        if (!x.taskId)
            return;
        if (!hist.has(x.id)) {
            hist.set(x.id, 'LOADING');
            void api.history(x.taskId).then((r) => { hist.set(x.id, r); repaintIfSelected(x.id); }, () => { hist.set(x.id, 'ERROR'); repaintIfSelected(x.id); });
        }
        if (!evm.has(x.id)) {
            evm.set(x.id, 'LOADING');
            void api.evidence(x.taskId).then((r) => { evm.set(x.id, r); repaintIfSelected(x.id); }, () => { evm.set(x.id, 'ERROR'); repaintIfSelected(x.id); });
        }
    };
    const repaintIfSelected = (id) => { if (alive() && ui.sel === id)
        paintDetail(); };
    const openFile = async (f) => {
        try {
            const c = await api.evidenceContent(f.versionId);
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
    const detailBody = (x) => {
        const hs = hist.get(x.id);
        const ev = evm.get(x.id);
        const timeline = () => {
            if (!x.taskId)
                return h('div', { class: 'mut', 'data-testid': 'tf-hist-record' }, 'Bu iş bir kaynak kayıttan gelir; geçmişi kaynak kayıtta (nesne pasaportu) tutulur.');
            if (hs === 'LOADING' || hs === undefined)
                return h('div', { class: 'mut', 'data-testid': 'tf-hist-loading' }, 'Geçmiş yükleniyor…');
            if (hs === 'ERROR')
                return h('div', { class: 'banner error', 'data-testid': 'tf-hist-error' }, 'Geçmiş okunamadı — daha sonra tekrar deneyin.');
            if (hs === null) { // the full trail needs the (draft) task_history function: say so, show only what the list already carries
                const rows = [[fmt(x.createdIso), 'Oluşturuldu / atandı']];
                if (x.startsIso && x.state !== 'ASSIGNED')
                    rows.push([fmt(x.startsIso), 'Başlatıldı']);
                if (x.completionNote)
                    rows.push(['—', `Tamamlama notu: ${x.completionNote}`]);
                if (x.approvalNote)
                    rows.push(['—', `Onay notu: ${x.approvalNote}`]);
                return h('div', { 'data-testid': 'tf-hist-partial' }, h('div', { class: 'banner info' }, 'Tam olay geçmişi (kim, ne zaman) için sunucu işlevi henüz kurulmadı — yalnız kayıtlı özet gösteriliyor.'), h('ol', { class: 'tf-hist' }, ...rows.map(([t, w]) => h('li', {}, h('b', {}, t), ' · ', w))));
            }
            if (!hs.length)
                return h('div', { class: 'mut' }, 'Geçmiş kaydı yok.');
            return h('ol', { class: 'tf-hist', 'data-testid': 'tf-hist' }, ...hs.map((e) => h('li', { 'data-event': e.event }, h('b', {}, fmt(e.at)), ' · ', EVENT_TR[e.event] ?? e.event, ' · ', e.actorLabel, e.note ? h('div', { class: 'mut' }, e.note) : null)));
        };
        const evidence = () => {
            if (!x.taskId)
                return null;
            const text = x.completionNote || x.evidenceRef || x.approvalNote ? h('div', { 'data-testid': 'tf-d-evidence' }, x.completionNote ? `Tamamlama: ${x.completionNote}` : '', x.evidenceRef ? ` · kanıt: ${x.evidenceRef}` : '', x.approvalNote ? h('div', {}, `Onay: ${x.approvalNote}`) : null) : null;
            let files = null;
            if (ev === 'LOADING' || ev === undefined)
                files = h('div', { class: 'mut', 'data-testid': 'tf-ev-loading' }, 'Dosyalar yükleniyor…');
            else if (ev === 'ERROR')
                files = h('div', { class: 'banner error', 'data-testid': 'tf-ev-error' }, 'Kanıt dosyaları okunamadı — daha sonra tekrar deneyin.');
            else if (ev === null)
                files = x.requiresEvidence || x.can.complete ? h('div', { class: 'mut', 'data-testid': 'tf-ev-unavailable' }, 'Fotoğraf / dosya yükleme bu kurulumda henüz açık değil (sunucu işlevi kurulmadı) — kanıtı metin olarak yazın.') : null;
            else if (ev.length)
                files = h('ul', { class: 'tf-files', 'data-testid': 'tf-ev-files' }, ...ev.map((f) => h('li', { 'data-testid': 'tf-ev-file' }, h('span', {}, h('b', {}, f.fileName), ` · ${sizeTr(f.sizeBytes)} · ${f.uploaderLabel} · ${fmt(f.uploadedAt)}`), h('button', { type: 'button', class: 'ghost', 'data-testid': 'tf-ev-open', onClick: () => void openFile(f) }, 'Aç'))));
            else if (x.requiresEvidence)
                files = h('div', { class: 'mut', 'data-testid': 'tf-ev-none' }, 'Henüz dosya eklenmedi.');
            if (!text && !files && !x.requiresEvidence)
                return null;
            return h('div', { class: 'tf-sec', 'data-testid': 'tf-evidence-section' }, h('h3', {}, x.requiresEvidence ? 'Kanıt (zorunlu)' : 'Kanıt'), text, files, !text && !files ? h('div', { class: 'mut' }, 'Kanıt zorunlu: dosya, ölçüm no veya açıklama (en az 5 karakter).') : null);
        };
        const esc = x.sla.escalation;
        return h('div', { class: 'tf-detail', 'data-testid': 'tf-detail' }, h('div', { class: 'tf-grid' }, h('dl', {}, h('dt', {}, 'Kim sorumlu?'), h('dd', {}, `${x.assigneeLabel}${x.department ? ` · ${x.department}` : ''}`, x.nextOwner && x.nextOwner !== x.assigneeLabel ? h('div', { class: 'mut' }, `Sonraki sorumlu: ${x.nextOwner}`) : null)), h('dl', {}, h('dt', {}, 'Ne zamana kadar?'), h('dd', {}, x.dueIso ? fmt(x.dueIso) : 'Termin tanımlı değil', ' · ', SLA_TR[x.sla.state], x.sla.used !== null && x.state !== 'DONE' ? h('div', { class: 'tf-sla', 'data-state': x.sla.state, 'aria-hidden': 'true' }, h('i', { style: `width:${Math.min(100, Math.round(x.sla.used * 100))}%` })) : null, x.sla.state === 'OVERDUE' && x.state !== 'DONE' && x.state !== 'CANCELLED' ? h('div', { class: 'tf-late', 'data-testid': 'tf-d-late' }, `GECİKTİ${x.sla.overdueMin !== null ? ` — ${durationTr(x.sla.overdueMin)}` : ''}`) : null, esc.level > 0 ? h('div', { class: 'tf-esc', 'data-testid': 'tf-escalation', 'data-level': String(esc.level) }, `Önerilen eskalasyon (${esc.level}/3): ${esc.text} — otomatik gönderilmez`) : null)), h('dl', {}, h('dt', {}, 'Ne yapılacak?'), h('dd', { 'data-testid': 'tf-d-what' }, x.description ? x.description : 'Başlıkta belirtilen iş (ek açıklama yok).')), h('dl', {}, h('dt', {}, 'Neden gerekli?'), h('dd', {}, x.origin === 'RECORD' ? `${x.source?.label ?? 'Kayıt'} üzerinde açık iş: ${x.stateLabel}.` : x.source ? `${x.source.label} ile ilgili görev${x.ownerLabel ? ` — atayan: ${x.ownerLabel}` : ''}.` : `Yönetimin atadığı görev${x.ownerLabel ? ` — atayan: ${x.ownerLabel}` : ''}.`, x.blockedReason ? h('div', { class: 'tf-late' }, x.blockedReason) : null)), h('dl', {}, h('dt', {}, 'Hangi kayıtla ilişkili?'), h('dd', {}, x.source ? h('a', { href: x.sourceRoute ?? x.href, 'data-testid': 'tf-d-source' }, `${x.source.label} →`) : 'Bağımsız görev')), h('dl', {}, h('dt', {}, 'Tamamlamak için ne gerekli?'), h('dd', { 'data-testid': 'tf-d-how' }, x.nextStep, x.requiresEvidence ? h('div', { class: 'mut' }, 'Kanıt zorunlu: fotoğraf / dosya, ölçüm no veya açıklama.') : null))), evidence(), h('div', { class: 'tf-sec' }, h('h3', {}, 'Geçmiş'), timeline()), x.qr ? h('div', { class: 'tf-sec' }, h('h3', {}, 'Görev QR kodu'), h('div', { class: 'tf-qr', 'data-testid': 'tf-qr' }, h('span', { class: 'tf-qrph', role: 'img', 'aria-label': 'Görev QR kodu' }), h('div', {}, h('code', {}, x.qr), h('div', { class: 'mut', style: 'font-size:12px' }, 'Telefonla okutulunca bu görev açılır (yalnız görmeye yetkili kişiye). Okutmak görevi tamamlamaz.')))) : null);
    };
    const actionBlock = (x) => {
        const mode = ui.open && x.taskId && ui.open.endsWith(`:${x.taskId}`) ? ui.open.split(':')[0] : null;
        const t = x.taskId ? data.manual.find((m) => m.id === x.taskId) : null;
        const toggle = (m) => { ui.open = mode === m ? null : `${m}:${x.taskId}`; paintDetail(); };
        const btn = (label, testid, fn, primary = false) => h('button', { type: 'button', 'data-testid': testid, onClick: fn, class: /tf-start|tf-approve|tf-reopen-go/.test(testid) ? 'okb' : /cancel/.test(testid) ? 'danger' : /reopen/.test(testid) ? 'warnb' : primary ? 'primary' : 'ghost' }, label);
        if (!t)
            return h('div', { class: 'acts' }, h('a', { href: x.href, 'data-testid': 'tf-open-record', class: 'primary', style: 'display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:10px;background:#0e7490;color:#fff;text-decoration:none' }, 'Kayda git ve işlemi yap →'), h('span', { class: 'mut', style: 'font-size:12px' }, 'kaynakta tamamlanır'));
        const note = h('input', { type: 'text', 'data-testid': 'tf-note', placeholder: mode === 'approve' ? 'Onay notu' : mode === 'complete' ? 'Ne yapıldı?' : 'Neden?', value: ui.draft?.note ?? '', style: 'flex:1 1 180px;min-width:0;font-size:16px' });
        const evid = h('input', { type: 'text', 'data-testid': 'tf-evidence', placeholder: x.requiresEvidence ? 'Kanıt (zorunlu): ölçüm no / açıklama — ya da dosya ekleyin' : 'Kanıt (isteğe bağlı)', value: ui.draft?.evidence ?? '', style: 'flex:1 1 180px;min-width:0;font-size:16px' });
        const keep = () => { ui.draft = { note: note.value, evidence: evid.value }; };
        note.addEventListener('input', keep);
        evid.addEventListener('input', keep);
        const evState = evm.get(x.id);
        const filesOk = Array.isArray(evState);
        const picker = mode === 'complete' && filesOk ? h('div', { class: 'tf-pickfile' }, h('input', { type: 'file', 'data-testid': 'tf-ev-input', accept: EVIDENCE_ACCEPT, multiple: true, 'aria-label': 'Fotoğraf veya dosya ekle', onChange: (e) => { const fl = Array.from(e.target.files ?? []); ui.files = fl.slice(0, MAX_EVIDENCE_FILES); keepFocus(() => paintDetail()); } }), ui.files.length ? h('span', { class: 'mut', 'data-testid': 'tf-ev-chosen' }, `${ui.files.length} dosya seçildi: ${ui.files.map((f) => f.name).join(', ')}`) : null) : null;
        const submitComplete = async () => {
            const typed = evid.value.trim();
            const names = ui.files.map((f) => f.name);
            if (!evidenceSatisfied(x.requiresEvidence, typed, names))
                return setMessage({ kind: 'error', text: REFUSAL_TR.EVIDENCE_REQUIRED });
            await act(async () => {
                const existing = Array.isArray(evState) ? evState.length : 0;
                for (const f of ui.files) {
                    const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
                    const chk = checkEvidenceFile({ name: f.name, mime: f.type, size: f.size, head }, existing);
                    if (!chk.ok)
                        throw new Error(`${chk.reason}`);
                    try {
                        await api.addEvidence(t.id, { fileName: f.name, mimeType: f.type, contentBase64: await fileB64(f) });
                    }
                    catch (e) {
                        if (!String(e?.message ?? e).includes('DUPLICATE_CONTENT'))
                            throw e; /* already attached by an earlier try */
                    }
                }
                await api.complete(t.id, note.value.trim(), evidenceRefText(typed, names));
            }, 'Tamamlandı — onay bekliyor.');
        };
        const four = t.status === 'COMPLETED' && t.completedByMe && data.canManage ? h('div', { 'data-testid': 'tf-four-eyes', style: 'color:#fbbf24;font-size:13px;margin-top:6px' }, 'Bunu siz tamamladınız — onayı başka bir yetkili verir.') : null;
        return h('div', {}, h('div', { class: 'acts' }, x.can.start ? btn('Başla', 'tf-start', () => void act(() => api.start(t.id), 'Görev başladı.')) : null, x.can.complete ? btn('Tamamla…', 'tf-complete-open', () => toggle('complete'), true) : null, x.can.approve ? btn('Onayla…', 'tf-approve-open', () => toggle('approve'), true) : null, x.can.reopen ? btn('Geri aç…', 'tf-reopen', () => toggle('reopen')) : null, x.can.cancel ? btn('İptal…', 'tf-cancel', () => toggle('cancel')) : null), four, mode ? h('div', { class: 'acts' }, note, mode === 'complete' ? evid : null, picker, mode === 'complete' ? btn('Tamamlandı olarak gönder', 'tf-complete', () => void submitComplete(), true) : null, mode === 'approve' ? btn('Onayı ver', 'tf-approve', () => void act(() => api.approve(t.id, note.value.trim()), 'Görev onaylandı.'), true) : null, mode === 'reopen' ? btn('Yeniden aç', 'tf-reopen-go', () => void act(() => api.reopen(t.id, note.value.trim()), 'Görev yeniden açıldı.')) : null, mode === 'cancel' ? btn('İptal et', 'tf-cancel-go', () => void act(() => api.cancel(t.id, note.value.trim()), 'Görev iptal edildi.')) : null) : null);
    };
    /** repainting the detail must not steal the cursor from a field the person is typing in */
    function keepFocus(fn) {
        const a = document.activeElement;
        const tid = a && detailHost.contains(a) ? a.getAttribute('data-testid') : null;
        const pos = tid && typeof a.selectionStart === 'number' ? a.selectionStart : null;
        fn();
        if (tid) {
            const el = detailHost.querySelector(`[data-testid="${tid}"]`);
            if (el) {
                el.focus();
                if (pos !== null)
                    try {
                        el.setSelectionRange(pos, pos);
                    }
                    catch { /* not a text field */ }
            }
        }
    }
    function paintDetail() {
        const x = ui.sel ? items.find((i) => i.id === ui.sel) ?? null : null;
        if (!x) {
            detailHost.replaceChildren(h('div', { class: 'tf-empty-detail', 'data-testid': 'tf-detail-empty' }, 'Soldan bir iş seçin.'));
            return;
        }
        loadDetailData(x);
        keepFocus(() => detailHost.replaceChildren(...(!isWide() ? [h('div', { style: 'margin-bottom:8px' }, h('button', { type: 'button', class: 'ghost tf-back', 'data-testid': 'tf-back', onClick: () => { if (ui.pushed)
                    history.back();
                else
                    leaveDetail(); } }, '← Liste'))] : []), h('div', { class: 'tf-dh', 'data-item-detail': x.id }, h('div', { style: 'min-width:0' }, h('div', {}, h('span', { class: `tf-tier t${x.tier}` }, `${GLY[x.tier] ?? ''} ${x.tierLabel.toLocaleUpperCase('tr-TR')}`), ' ', h('span', { class: 'mut', style: 'font-size:12px' }, x.origin === 'MANUAL' ? x.typeLabel : `${x.typeLabel} · ${x.source?.label ?? ''}`)), h('h2', { 'data-testid': 'tf-d-title' }, x.title)), pillFor(x)), ...(x.state === 'DONE' || x.state === 'CANCELLED' ? [] : [h('div', { class: 'tf-next', 'data-testid': 'tf-next' }, `Sonraki adım: ${x.nextStep}`)]), actionBlock(x), detailBody(x)));
        attachQr();
    }
    // ---------------- list ----------------
    const row = (x) => {
        const sel = ui.sel === x.id && (isWide() || ui.mobileDetail);
        const t = x.taskId ? data.manual.find((m) => m.id === x.taskId) : null;
        const pick = h('button', { type: 'button', class: 'tf-pick', 'data-testid': 'tf-pick', 'aria-current': sel ? 'true' : 'false', onClick: () => select(x.id) }, h('span', { class: 'tf-l1' }, h('span', { class: 'k' }, h('span', { class: `tf-tier t${x.tier}` }, `${GLY[x.tier] ?? ''} ${x.tierLabel.toLocaleUpperCase('tr-TR')}`), h('span', { class: 'mut', style: 'font-size:12px' }, x.origin === 'MANUAL' ? x.typeLabel : `${x.typeLabel} · ${x.source?.label ?? ''}`)), ...(['DONE', 'CANCELLED', 'AWAITING_APPROVAL', 'BLOCKED'].includes(x.state) ? [pillFor(x)] : [])), h('span', { class: 'tf-title' }, x.title), h('span', { class: 'tf-meta' }, h('span', { class: 'who' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(x.assigneeLabel)), h('b', {}, x.assigneeLabel)), x.department ? h('span', {}, x.department) : null, metaLate(x)));
        // phone: the one next action sits on the card in a big touch target; everything else is in the detail screen
        const quick = !isWide() && t ? (x.can.start ? h('button', { type: 'button', class: 'okb tf-quick', 'data-testid': 'tf-start', onClick: () => void act(() => api.start(t.id), 'Görev başladı.') }, 'Başla')
            : x.can.complete ? h('button', { type: 'button', class: 'primary tf-quick', 'data-testid': 'tf-complete-open', onClick: () => select(x.id, `complete:${t.id}`) }, 'Tamamla') : null) : null;
        const attrs = { 'data-testid': x.origin === 'MANUAL' ? 'tf-task' : 'tf-derived', 'data-item': x.id, 'data-tier': String(x.tier), 'data-late': String(x.late), 'data-state': x.state, 'data-selected': String(sel), ...(x.origin === 'MANUAL' ? { 'data-status': t.status, 'data-task': x.taskId } : { 'data-source': x.type }), ...(ui.sel === x.id && state.focus && x.taskId === state.focus ? { 'data-focus': 'true' } : {}), class: x.origin === 'MANUAL' ? 'tf-task' : 'tf-derived' };
        return h('div', attrs, pick, quick);
    };
    const attachQr = () => { for (const b of Array.from(detailHost.querySelectorAll('[data-testid="tf-qr"]'))) {
        if (b.querySelector('svg'))
            continue;
        const holder = b.firstElementChild;
        const code = (b.querySelector('code')?.textContent ?? '');
        try {
            const doc = new DOMParser().parseFromString(qrToSvg(encodeQr(code, 'M'), 30), 'image/svg+xml');
            holder.replaceWith(document.importNode(doc.documentElement, true));
        } /* locally generated SVG paths only; parsed as XML, no markup-injection API */
        catch { /* label too long: the payload text above still works */ }
    } };
    function paintList() {
        const at = loadedAt || nowMs();
        const list = applyFilters(items, ui.filters, at);
        const pg = pageOf(list, ui.shown);
        for (const c of chips)
            c.btn.setAttribute('aria-pressed', String(ui.filters.view === c.id));
        const counts = viewCounts(items, at);
        for (const c of chips)
            c.c.textContent = String(counts[c.id]);
        for (const o of viewSelOpts)
            o.opt.textContent = `${VIEWS.find((v) => v.id === o.id).label} (${counts[o.id]})`;
        if (isWide()) {
            if (!list.some((r) => r.id === ui.sel)) {
                ui.sel = list[0]?.id ?? null;
                ui.open = null;
                ui.draft = null;
                ui.files = [];
            }
        }
        const focusTarget = state.focus && !ui.focusDone ? `task:${state.focus}` : null;
        const keepTop = listHost.scrollTop;
        listHost.replaceChildren(...(ui.focusMissing ? [h('div', { 'data-testid': 'tf-focus-missing', class: 'banner error' }, 'Bu görev bulunamadı ya da size açık değil.')] : []), ...(list.length ? [] : [h('div', { 'data-testid': items.length ? 'tf-filter-empty' : 'tf-manual-empty', class: 'empty' }, items.length ? 'Bu filtreyle eşleşen iş yok.' : scope === 'ALL' ? 'Atanmış görev yok.' : 'Şu an sizi bekleyen iş yok.')]), ...pg.rows.map(row), ...(pg.more ? [h('button', { type: 'button', class: 'ghost tf-more', 'data-testid': 'tf-more', onClick: () => { ui.shown += PAGE; paintList(); } }, `${pg.more} iş daha göster`)] : []));
        listHost.scrollTop = keepTop;
        if (focusTarget) {
            const el = listHost.querySelector(`[data-item="${focusTarget}"]`);
            if (el) {
                ui.focusDone = true;
                if (isWide())
                    el.scrollIntoView?.({ block: 'nearest' });
            }
        }
    }
    // ---------------- whole screen (after every load / layout switch) ----------------
    function rebuild() {
        const d = data;
        const now = loadedAt;
        const sum = summarize(items, now);
        const fc = facets(items);
        const wide = isWide();
        if (ui.mobileDetail && (wide || !items.some((i) => i.id === ui.sel)))
            ui.mobileDetail = false;
        const tile = (cls, label, n, extra) => h('div', { class: `tile ${cls}`, title: extra }, h('div', { class: 'n' }, `${n}`), h('div', { class: 'l' }, label));
        const tiles = wide ? [tile('open', 'AKTİF', sum.active, `${sum.active} aktif`), tile('crit', 'KRİTİK', sum.critical, `${sum.critical} kritik / karar`), tile('late', 'GECİKMİŞ', sum.late, `${sum.late} geciken`),
            tile('hold', 'BUGÜN', sum.today, `${sum.today} bugün bitiyor`), tile('appr', 'DEVAM EDEN', sum.progress, `${sum.progress} devam ediyor`)]
            : [tile('crit', 'KRİTİK', sum.critical, `${sum.critical} kritik / karar`), tile('late', 'GECİKMİŞ', sum.late, `${sum.late} geciken`), tile('open', 'AKTİF', sum.active, `${sum.active} aktif`)];
        chips.length = 0;
        viewSelOpts.length = 0;
        const setView = (v) => { ui.filters = { ...ui.filters, view: v }; ui.shown = PAGE; paintList(); paintDetail(); };
        const viewBar = wide ? h('div', { class: 'tf-views', role: 'group', 'aria-label': 'Görünüm' }, ...VIEWS.map((v) => {
            const c = h('span', { class: 'c' });
            const b = h('button', { type: 'button', class: 'tf-chip', 'data-testid': `tf-view-${v.id.toLowerCase()}`, 'aria-pressed': String(ui.filters.view === v.id), onClick: () => setView(v.id) }, v.label, c);
            chips.push({ id: v.id, btn: b, c });
            return b;
        })) : h('select', { class: 'tf-viewsel', 'data-testid': 'tf-view-select', 'aria-label': 'Görünüm', onChange: (e) => setView(e.target.value) }, ...VIEWS.map((v) => { const opt = h('option', { value: v.id, ...(ui.filters.view === v.id ? { selected: true } : {}) }, v.label); viewSelOpts.push({ id: v.id, opt }); return opt; }));
        const search = h('input', { type: 'search', 'data-testid': 'tf-search', 'aria-label': 'Görevlerde ara', placeholder: 'Görev, kayıt veya kişi ara…', value: ui.filters.q });
        search.addEventListener('input', () => { ui.filters = { ...ui.filters, q: search.value }; ui.shown = PAGE; paintList(); paintDetail(); });
        const sel = (testid, label, opts, cur, on) => opts.length ? h('select', { 'data-testid': testid, 'aria-label': label, onChange: (e) => { const v = e.target.value; on(v || null); ui.shown = PAGE; paintList(); paintDetail(); } }, h('option', { value: '' }, label), ...opts.map((o) => h('option', { value: o.id, ...(cur === o.id ? { selected: true } : {}) }, o.label))) : null;
        const deptSel = sel('tf-dept', 'Tüm departmanlar', fc.departments.map((x) => ({ id: x, label: x })), ui.filters.dept, (v) => { ui.filters = { ...ui.filters, dept: v }; });
        const typeSel = sel('tf-type', 'Tüm iş türleri', [{ id: 'MANUAL', label: 'Atanan görevler' }, { id: 'RECORD', label: 'Kayıttan gelenler' }, ...fc.types], ui.filters.type, (v) => { ui.filters = { ...ui.filters, type: v }; });
        const scopeBtns = d.canManage ? [h('button', { type: 'button', 'data-testid': 'tf-scope-mine', class: 'tf-chip', 'aria-pressed': String(scope === 'MINE'), disabled: scope === 'MINE', onClick: () => { scope = 'MINE'; void reload(); } }, 'Benim'),
            h('button', { type: 'button', 'data-testid': 'tf-scope-all', class: 'tf-chip', 'aria-pressed': String(scope === 'ALL'), disabled: scope === 'ALL', onClick: () => { scope = 'ALL'; void reload(); } }, 'Tüm atanan görevler')] : [];
        // manager: new task form (kept as before; created once per load)
        const pre = state.prefill;
        const tTitle = h('input', { type: 'text', 'data-testid': 'tf-new-title', placeholder: 'Görev (ne yapılacak?)', style: 'flex:1 1 200px;min-width:0;font-size:16px' });
        const tDesc = h('input', { type: 'text', 'data-testid': 'tf-new-desc', placeholder: 'Açıklama (isteğe bağlı)', style: 'flex:1 1 200px;min-width:0;font-size:16px' });
        const tWho = h('select', { 'data-testid': 'tf-new-who', style: 'font-size:16px' }, h('option', { value: '' }, 'Kime?'), ...Object.entries(ROLE_TR).map(([k, v]) => h('option', { value: `R:${k}` }, `Rol: ${v}`)), ...people.map((p) => h('option', { value: `U:${p.userId}` }, p.name)));
        const tDue = h('input', { type: 'datetime-local', 'data-testid': 'tf-new-due', style: 'font-size:16px' });
        const tEv = h('input', { type: 'checkbox', 'data-testid': 'tf-new-evidence' });
        const create = () => {
            if (!tWho.value)
                return setMessage({ kind: 'error', text: REFUSAL_TR.ASSIGNEE_REQUIRED });
            const [kind, val] = [tWho.value[0], tWho.value.slice(2)];
            void act(() => api.create({ title: tTitle.value.trim(), description: tDesc.value.trim(), assigneeUser: kind === 'U' ? val : null, assigneeRole: kind === 'R' ? val : null,
                dueAt: tDue.value ? new Date(tDue.value).toISOString() : null, sourceType: pre?.sourceType ?? 'NONE', sourceId: pre?.sourceId ?? null, requiresEvidence: tEv.checked, clientRequestId: newReq() }), 'Görev atandı.');
        };
        const newForm = d.canManage ? h('details', { 'data-testid': 'tf-new', class: 'newtask', ...(pre ? { open: true } : {}) }, h('summary', {}, '＋ Yeni görev ata'), pre ? h('div', { 'data-testid': 'tf-prefill', style: 'font-size:13px;color:#94a3b8' }, `İlgili kayıt: ${pre.sourceType}`) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center' }, tTitle, tDesc, tWho, tDue, h('label', { style: 'font-size:13px' }, tEv, ' kanıt zorunlu'), h('button', { type: 'button', 'data-testid': 'tf-new-create', class: 'primary', onClick: create }, 'Görevi ata'))) : null;
        const activeFilters = (ui.filters.dept ? 1 : 0) + (ui.filters.type ? 1 : 0) + (scope === 'ALL' ? 1 : 0);
        const bar = wide ? h('div', { class: 'tf-bar' }, viewBar, search, deptSel, typeSel, ...scopeBtns, newForm)
            : h('div', { class: 'tf-bar' }, search, viewBar, h('details', { class: 'tf-filter', 'data-testid': 'tf-filter-menu', ...(activeFilters ? { open: true } : {}) }, h('summary', {}, activeFilters ? `Filtre (${activeFilters})` : 'Filtre'), h('div', { class: 'fb' }, deptSel, typeSel, ...(scopeBtns.length ? [h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, ...scopeBtns)] : []))), newForm);
        const countLine = h('div', { 'data-testid': 'tf-count', style: 'font-size:13px;color:#94a3b8' }, `${sum.actionable} iş şu an sizi bekliyor · ${sum.active} aktif`);
        const detailMode = !wide && ui.mobileDetail;
        const body = detailMode ? [detailHost]
            : wide ? [h('div', { class: 'tf-split' }, h('div', { style: 'min-width:0;display:grid;gap:6px' }, countLine, listHost), detailHost)]
                : [countLine, listHost];
        mount(container, h('div', { class: 'kd tf-screen' }, h('style', {}, TF_CSS), ...head(), ...(detailMode ? [] : [h('div', { 'data-testid': 'tf-summary', class: 'tiles' }, ...tiles), bar]), ...body));
        ui.shown = Math.max(ui.shown, PAGE);
        paintList();
        if (wide || detailMode)
            paintDetail();
        if (wide)
            fitList();
    }
    /** the list pane ends inside the first screen: its height follows where it starts (a taller toolbar never pushes it off the screen) */
    function fitList() {
        const top = listHost.getBoundingClientRect().top + window.scrollY;
        listHost.parentElement?.parentElement?.style.setProperty('--tf-top', `${Math.round(top)}px`);
    }
    const onResize = () => { if (!alive()) {
        window.removeEventListener('resize', onResize);
        return;
    } if (isWide() && data)
        fitList(); };
    window.addEventListener('resize', onResize);
    // a stale badge that ages on its own while the screen is open; the timer ends itself when the screen is gone
    const tick = setInterval(() => { const f = container.querySelector('[data-testid="tf-fresh"]'); if (!f || f.getAttribute('data-inst') !== inst) {
        if (loadedAt)
            clearInterval(tick);
        return;
    } if (data) {
        const age = Math.floor((nowMs() - loadedAt) / 60000);
        const stale = !!staleError || age >= 5;
        f.setAttribute('data-stale', String(stale));
        f.textContent = stale ? `BAYAT · ${hhmm(loadedAt)} verisi` : `CANLI · ${hhmm(loadedAt)}`;
    } }, 60_000);
    if (state.message)
        setMessage(state.message);
    await reload();
}
