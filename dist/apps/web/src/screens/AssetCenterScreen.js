// KMI-ASSET-001 — Dijital Varlık Merkezi. ONE PHYSICAL ASSET → ONE CANONICAL IDENTITY → MANY AUTHORIZED VIEWS: every number and card comes from the asset registry RPCs (asset_list / asset_summary),
// no second list, no browser-side recount of anything the server decides. The whole card opens the digital asset passport. Authority (who sees what, who may create / transfer) is decided by the server; the UI only
// hides what the role cannot do. Unknown data is shown as BİLİNMİYOR / HENÜZ TANIMLANMADI, never invented.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { entityCard, photoSlot, initialsOf, dateTr, ENTITY_CARD_CSS } from '../cardKit.js';
import { errorText, isSetupPending } from '../errorText.js';
import { ASSET_CLASSES, CLASS_TR, DEPARTMENTS, KIND_TR, LIFECYCLE_TR, OPS_TR, deptTr } from '../assetApi.js';
export const ASSET_FROM_KEY = 'kmi.asset.from';
const CSS = `
.ac{max-width:1400px;margin:0 auto;padding:0 4px 28px}
.ac-h1{margin:6px 0 0;font-size:28px;letter-spacing:.01em}.ac-sub{margin:2px 0 14px;color:var(--kmi-mut,#94a3b8);font-size:15px}
.ac-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:14px}
@media (max-width:980px){.ac-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (max-width:520px){.ac-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
.ac-kpi{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;min-width:0;text-align:left;cursor:pointer;color:inherit;font:inherit;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}
.ac-kpi:hover,.ac-kpi[aria-pressed=true]{border-color:var(--kmi-focus,#38bdf8)}.ac-kpi:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.ac-kpi b{font-size:28px;line-height:1.1}.ac-kpi span{font-size:13px;color:var(--kmi-mut,#94a3b8)}.ac-kpi.warn b{color:var(--kmi-warn,#fbbf24)}
.ac-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 12px;border-bottom:1px solid var(--kmi-line,#1e2d4a)}
.ac-tab{min-height:44px;padding:8px 14px;border:0;border-bottom:3px solid transparent;background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer}
.ac-tab[aria-selected=true]{border-bottom-color:var(--kmi-focus,#38bdf8);color:var(--kmi-focus,#38bdf8)}.ac-tab:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:-3px}.ac-tab small{opacity:.7;margin-left:4px}
.ac-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.ac-bar input[type=search],.ac-bar select{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit;min-width:0}
.ac-bar input[type=search]{flex:1 1 220px;max-width:380px}
.ac-chip{min-height:40px;padding:6px 14px;border-radius:999px;border:1px solid var(--kmi-line,#1e2d4a);background:none;color:inherit;font:inherit;font-weight:600;cursor:pointer}.ac-chip[aria-pressed=true]{border-color:var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.12)}
.ac-btn{min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.12);color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.ac-btn.sec{border-color:var(--kmi-line,#1e2d4a);background:none}.ac-btn:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.ac-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;padding:12px;margin-bottom:12px;border-radius:14px;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}
.ac-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--kmi-mut,#94a3b8);min-width:0}
.ac-form input,.ac-form select{min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit;min-width:0}
.ac-form .ac-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}
.ac-msg{padding:10px 12px;border-radius:10px;margin:6px 0 10px;font-size:14px}.ac-msg[data-kind=ok]{background:rgba(34,197,94,.16)}.ac-msg[data-kind=error]{background:rgba(239,68,68,.18)}
.ac-panel{padding:12px;margin-bottom:14px;border-radius:14px;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}.ac-panel h2{margin:0 0 8px;font-size:18px}
.ac-tr{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:10px 0;border-top:1px solid var(--kmi-line,#1e2d4a)}.ac-tr:first-of-type{border-top:0}.ac-tr .grow{flex:1 1 260px;min-width:0}.ac-tr small{display:block;color:var(--kmi-mut,#94a3b8)}
.ac-tr input{min-height:40px;padding:6px 10px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit}
`;
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const norm = (s) => s.toLocaleLowerCase('tr-TR');
/** card facts: only what the server returned for this caller; a missing value is a stated gap */
export function assetFacts(a) {
    const holder = a.holder ? (a.holder.kind === 'DEPARTMENT' ? deptTr(a.holder.name) : a.holder.name) : a.has_holder ? 'Zimmetli' : 'Zimmetsiz';
    const facts = [
        { label: 'KONUM', value: a.location },
        { label: 'BİRİM', value: deptTr(a.department) ?? a.responsible_unit },
        { label: 'ZİMMET', value: holder, tone: a.holder_inactive ? 'bad' : undefined },
    ];
    if (a.source_type === 'MACHINE')
        facts.push({ label: 'MAKİNE DURUMU', value: a.ops_state ? OPS_TR[a.ops_state] ?? a.ops_state : null, tone: a.ops_state && a.ops_state !== 'UP' ? 'warn' : undefined });
    else
        facts.push({ label: 'MARKA / MODEL', value: a.brand_model });
    if (a.calibration)
        facts.push({ label: 'KALİBRASYON', value: a.calibration.state === 'VALID' ? `Sertifika geçerlilik tarihi ${dateTr(a.calibration.valid_until) ?? '—'}` : a.calibration.state === 'EXPIRED' ? `SÜRESİ DOLMUŞ (${dateTr(a.calibration.valid_until) ?? '—'})` : 'BİLİNMİYOR (sertifika/tarih yok)', tone: a.calibration.state === 'VALID' ? undefined : a.calibration.state === 'EXPIRED' ? 'bad' : 'warn' });
    return facts;
}
export function assetAlert(a) {
    if (a.holder_inactive)
        return 'Zimmet sahibi pasif personel — zimmet kapatılmalı';
    if (a.pending_transfer)
        return 'Bekleyen zimmet talebi var';
    if (a.review_required)
        return 'Sınıf doğrulanmalı';
    return null;
}
const badgeOf = (a) => a.lifecycle === 'ACTIVE' ? (a.ops_state && a.ops_state !== 'UP' ? { text: OPS_TR[a.ops_state] ?? a.ops_state, tone: 'warn' } : { text: LIFECYCLE_TR.ACTIVE, tone: 'ok' })
    : a.lifecycle === 'OUT_OF_SERVICE' ? { text: LIFECYCLE_TR.OUT_OF_SERVICE, tone: 'bad' } : a.lifecycle === 'INACTIVE' ? { text: LIFECYCLE_TR.INACTIVE, tone: 'mut' } : { text: LIFECYCLE_TR.ARCHIVED, tone: 'mut' };
export function transferResultText(r) {
    switch (r.result) {
        case 'ACCEPTED': return { kind: 'ok', text: 'Teslim alındı. Zimmet artık sizde; işlem kaydedildi.' };
        case 'ALREADY_ACCEPTED': return { kind: 'ok', text: 'Bu teslimi zaten kabul etmiştiniz; yeni bir hareket oluşmadı.' };
        case 'REJECTED': return { kind: 'ok', text: 'Talep reddedildi; zimmet değişmedi.' };
        case 'CANCELLED': return { kind: 'ok', text: 'Talep iptal edildi; zimmet değişmedi.' };
        case 'EXPIRED': return { kind: 'error', text: 'Talebin süresi dolmuş; zimmet değişmedi. Yeni talep açılması gerekir.' };
        case 'SOURCE_CHANGED': return { kind: 'error', text: 'Varlığın zimmeti talep açıldıktan sonra değişmiş; kabul edilmedi, talep kapandı. Zimmet değişmedi.' };
        default: return { kind: 'error', text: `Bu talep artık beklemede değil (${r.status ?? 'kapalı'}). Liste yenilendi.` };
    }
}
export async function renderAssetCenterScreen(container, deps, state = {}) {
    let rows = [];
    let sum = null;
    let mine = [];
    let cls = state.cls ?? 'ALL';
    let q = state.q ?? '';
    let f = state.f ?? 'ACTIVE';
    let dept = state.dept ?? '';
    let panel = !!state.panel;
    let banner = null;
    let formOpen = false;
    let forceNew = false;
    let reqId = crypto.randomUUID();
    let loadErr = null;
    const url = () => `#/varliklar?${[cls !== 'ALL' ? `k=${cls}` : '', q ? `q=${encodeURIComponent(q)}` : '', f !== 'ACTIVE' ? `f=${f}` : '', dept ? `d=${dept}` : '', panel ? 'z=1' : ''].filter(Boolean).join('&')}`.replace(/\?$/, '');
    const remember = () => deps.remember(url());
    const kpiRow = E('div', { class: 'ac-kpis', 'data-testid': 'ac-kpis' });
    const tabRow = E('div', { class: 'ac-tabs', role: 'tablist', 'aria-label': 'Varlık sınıfları' });
    const barHost = E('div', { class: 'ac-bar', 'data-testid': 'ac-bar' });
    const bannerHost = E('div', { 'aria-live': 'polite' });
    const formHost = E('div', {});
    const panelHost = E('div', { 'data-testid': 'ac-transfers-host' });
    const gridHost = E('div', { 'data-testid': 'ac-grid-host' });
    const say = (kind, text) => { banner = { kind, text }; bannerHost.replaceChildren(E('div', { class: 'ac-msg', 'data-testid': 'ac-message', 'data-kind': kind, role: kind === 'error' ? 'alert' : 'status' }, text)); };
    const inFilter = (r) => f === 'ALL' ? true : f === 'ARCHIVED' ? r.lifecycle === 'ARCHIVED' : f === 'ACTIVE' ? r.lifecycle === 'ACTIVE' : r.lifecycle === 'INACTIVE' || r.lifecycle === 'OUT_OF_SERVICE';
    const matches = (r) => {
        if (cls !== 'ALL' && r.class !== cls)
            return false;
        if (!inFilter(r))
            return false;
        if (dept && r.department !== dept)
            return false;
        if (!q.trim())
            return true;
        const n = norm(q.trim());
        return [r.code, r.name ?? '', r.brand_model ?? '', r.subcategory ?? '', r.location ?? '', r.holder?.name ?? '', r.machine_code ?? ''].some((v) => norm(v).includes(n));
    };
    const kpiDefs = () => [
        { key: 'total', label: 'Toplam kayıtlı varlık', value: sum?.total ?? null, on: () => { f = 'ALL'; panel = false; paint(); }, pressed: f === 'ALL' && !panel },
        { key: 'service', label: 'Hizmette (kayıtlı durum)', value: sum?.in_service ?? null, on: () => { f = 'ACTIVE'; panel = false; paint(); }, pressed: f === 'ACTIVE' && !panel },
        { key: 'out', label: 'Bakımda / hizmet dışı', value: sum?.out_of_service ?? null, warn: (sum?.out_of_service ?? 0) > 0, on: () => { f = 'INACTIVE'; panel = false; paint(); }, pressed: f === 'INACTIVE' && !panel },
        { key: 'assigned', label: 'Zimmetli', value: sum?.assigned ?? null, on: () => { panel = false; paint(); }, pressed: false },
        { key: 'pending', label: 'Bekleyen teslimler', value: sum?.pending_transfers ?? null, warn: (sum?.pending_transfers ?? 0) > 0, on: () => { panel = true; paint(); }, pressed: panel },
        { key: 'calib', label: 'Kalibrasyon uyarıları', value: sum?.calibration_alerts ?? null, warn: (sum?.calibration_alerts ?? 0) > 0, on: () => { cls = 'MEASUREMENT_QUALITY'; f = 'ACTIVE'; panel = false; paint(); }, pressed: false },
    ];
    const act = async (fn, ok) => { try {
        await fn();
        say('ok', ok);
        await load();
        return true;
    }
    catch (e) {
        say('error', errorText(e));
        return false;
    } };
    const doTransfer = async (fn) => { try {
        const r = await fn();
        const t = transferResultText(r);
        say(t.kind, t.text);
        await load();
    }
    catch (e) {
        say('error', errorText(e));
        await load();
    } };
    const paintPanel = () => {
        if (!panel) {
            panelHost.replaceChildren();
            return;
        }
        const open = mine.filter((m) => m.status === 'PENDING');
        const rowsEl = mine.map((m) => {
            const reason = E('input', { type: 'text', placeholder: m.role === 'RECEIVER' ? 'Ret gerekçesi' : 'İptal gerekçesi', 'aria-label': 'Gerekçe', 'data-testid': `ac-tr-reason-${m.id}`, maxlength: 200 });
            const btns = [];
            if (m.status === 'PENDING' && m.role === 'RECEIVER') {
                btns.push(E('button', { type: 'button', class: 'ac-btn', 'data-testid': `ac-tr-accept-${m.id}`, onClick: () => void doTransfer(() => deps.api.accept(m.id)) }, 'Teslim aldım (kabul)'));
                btns.push(reason, E('button', { type: 'button', class: 'ac-btn sec', 'data-testid': `ac-tr-reject-${m.id}`, onClick: () => void doTransfer(() => deps.api.reject(m.id, reason.value.trim())) }, 'Reddet'));
            }
            else if (m.status === 'PENDING') {
                btns.push(reason, E('button', { type: 'button', class: 'ac-btn sec', 'data-testid': `ac-tr-cancel-${m.id}`, onClick: () => void doTransfer(() => deps.api.cancel(m.id, reason.value.trim() || 'Talep açan kişi iptal etti')) }, 'Talebi iptal et'));
            }
            return E('div', { class: 'ac-tr', 'data-testid': 'ac-tr', 'data-status': m.status, 'data-role': m.role }, E('div', { class: 'grow' }, E('b', {}, `${m.asset_code} · ${m.asset_name ?? 'BİLİNMİYOR'}`), E('small', {}, `${KIND_TR[m.kind]} · ${m.from ?? 'zimmetsiz'} → ${m.to ?? '—'} · ${m.role === 'RECEIVER' ? `gönderen: ${m.requested_by ?? 'BİLİNMİYOR'}` : 'sizin açtığınız talep'}`), E('small', {}, `${m.status === 'PENDING' ? `Son tarih ${dateTr(m.expires_at) ?? '—'}` : m.status}${m.note ? ` · ${m.note}` : ''}`)), ...btns);
        });
        panelHost.replaceChildren(E('section', { class: 'ac-panel', 'data-testid': 'ac-transfers', 'aria-label': 'Zimmet taleplerim' }, E('h2', {}, `Zimmet taleplerim${open.length ? ` (${open.length} bekliyor)` : ''}`), ...(rowsEl.length ? rowsEl : [E('p', { class: 'mut' }, 'Son 30 günde sizinle ilgili zimmet talebi yok.')]), E('p', { class: 'mut' }, 'Teslimi yalnız alıcı kendi hesabıyla kabul edebilir; yönetici bile alıcı adına kabul veremez.')));
    };
    const paintChrome = () => {
        kpiRow.replaceChildren(...kpiDefs().map((k) => E('button', { type: 'button', class: `ac-kpi${k.warn ? ' warn' : ''}`, 'data-testid': `ac-kpi-${k.key}`, 'aria-pressed': String(k.pressed), onClick: k.on }, E('b', { 'data-testid': `ac-kpi-${k.key}-n`, 'data-known': String(k.value !== null) }, k.value === null ? '—' : String(k.value)), E('span', {}, k.label))));
        const count = (c) => rows.filter((r) => (c === 'ALL' || r.class === c) && inFilter(r) && (!dept || r.department === dept)).length;
        const classes = ASSET_CLASSES.filter((c) => deps.canManage || rows.some((r) => r.class === c));
        tabRow.replaceChildren(...['ALL', ...classes].map((c) => E('button', { type: 'button', role: 'tab', class: 'ac-tab', 'data-testid': `ac-tab-${c}`, 'aria-selected': String(c === cls),
            onClick: () => { cls = c; paint(); } }, c === 'ALL' ? 'Tümü' : CLASS_TR[c].tab, E('small', {}, String(count(c))))));
        const search = E('input', { type: 'search', placeholder: 'Ara: kod, ad, marka, konum…', 'aria-label': 'Varlık ara', 'data-testid': 'ac-search', value: q });
        search.addEventListener('input', () => { q = search.value; remember(); paintGrid(); });
        const depts = Array.from(new Set(rows.map((r) => r.department).filter((d) => !!d)));
        const chips = [['ACTIVE', 'Aktif'], ['INACTIVE', 'Pasif / hizmet dışı'], ['ARCHIVED', 'Arşiv'], ['ALL', 'Tümü']].map(([v, t]) => E('button', { type: 'button', class: 'ac-chip', 'data-testid': `ac-filter-${v}`, 'aria-pressed': String(f === v), onClick: () => { f = v; paint(); } }, t));
        const sel = depts.length ? E('select', { 'aria-label': 'Birim', 'data-testid': 'ac-dept', onChange: (ev) => { dept = ev.target.value; paint(); } }, E('option', { value: '' }, 'Tüm birimler'), ...depts.map((d) => E('option', { value: d, selected: d === dept }, deptTr(d) ?? d))) : null;
        barHost.replaceChildren(search, ...chips, ...(sel ? [sel] : []), E('a', { class: 'ac-btn sec', href: '#/tara', 'data-testid': 'ac-scan' }, 'QR okut / kod gir'), E('button', { type: 'button', class: 'ac-btn sec', 'data-testid': 'ac-mine', 'aria-pressed': String(panel), onClick: () => { panel = !panel; paint(); } }, `Zimmet taleplerim${mine.filter((m) => m.status === 'PENDING').length ? ` (${mine.filter((m) => m.status === 'PENDING').length})` : ''}`), ...(deps.canManage ? [E('button', { type: 'button', class: 'ac-btn', 'data-testid': 'ac-add', onClick: () => { formOpen = !formOpen; forceNew = false; paintForm(); } }, '+ Varlık Ekle')] : []));
    };
    const paintGrid = () => {
        if (loadErr) {
            gridHost.replaceChildren(E('div', { class: 'ac-msg', 'data-kind': 'error', role: 'alert', 'data-testid': 'ac-load-error' }, loadErr));
            return;
        }
        const list = rows.filter(matches);
        const cards = list.map((a) => {
            const slot = photoSlot(initialsOf(a.name ?? a.code), 'square', 'ec-photo');
            return entityCard({ kind: 'ASSET', id: a.id, href: `#/varlik?id=${a.id}`, title: a.name ?? 'BİLİNMİYOR', subtitle: CLASS_TR[a.class].full, code: a.code, initials: initialsOf(a.name ?? a.code), shape: 'square', badge: badgeOf(a), facts: assetFacts(a),
                alert: assetAlert(a), updated: dateTr(a.updated_at), testid: 'ac-card' }, slot);
        });
        gridHost.replaceChildren(E('p', { class: 'eg-note', 'data-testid': 'ac-count' }, `${list.length} / ${rows.length} varlık gösteriliyor`), cards.length ? E('div', { class: 'eg-grid', 'data-testid': 'ac-grid' }, ...cards) : E('div', { class: 'eg-empty', 'data-testid': 'ac-empty' }, rows.length ? 'Bu süzgeçte varlık yok. “Tümü”ne basın.' : 'Henüz kayıtlı varlık yok.'));
        gridHost.querySelectorAll('a.ec').forEach((a) => a.addEventListener('click', () => { try {
            sessionStorage.setItem(ASSET_FROM_KEY, url());
        }
        catch { /* storage unavailable */ } }));
    };
    const paintForm = () => {
        if (!formOpen) {
            formHost.replaceChildren();
            return;
        }
        const inp = (id, label, ph = '', type = 'text') => E('label', {}, label, E('input', { type, placeholder: ph, 'data-testid': `ac-f-${id}`, maxlength: 120 }));
        const v = (id) => (formHost.querySelector(`[data-testid="ac-f-${id}"]`)?.value ?? '').trim();
        const clsSel = E('label', {}, 'Varlık sınıfı *', E('select', { 'data-testid': 'ac-f-class' }, ...ASSET_CLASSES.map((c) => E('option', { value: c }, CLASS_TR[c].full))));
        const deptSel = E('label', {}, 'Bağlı birim', E('select', { 'data-testid': 'ac-f-dept' }, E('option', { value: '' }, 'Henüz tanımlanmadı'), ...DEPARTMENTS.map((d) => E('option', { value: d.code }, d.tr))));
        const save = () => {
            void (async () => {
                try {
                    const r = await deps.api.create({ name: v('name'), cls: v('class'), code: v('code'), subcategory: v('sub'), brandModel: v('brand'), serialNo: v('serial'), manufacturer: v('maker'), acquiredOn: v('acq'), commissionedOn: v('comm'),
                        department: v('dept'), location: v('loc'), responsibleUnit: v('unit'), forceNew, requestId: reqId });
                    formOpen = false;
                    reqId = crypto.randomUUID();
                    forceNew = false;
                    formHost.replaceChildren();
                    say('ok', `Varlık kaydedildi: ${r.code}`);
                    await load();
                }
                catch (e) {
                    const msg = errorText(e);
                    say('error', msg);
                    if (/POSSIBLE_DUPLICATE/.test(String(e.message ?? ''))) {
                        forceNew = true;
                        reqId = crypto.randomUUID();
                        const b = formHost.querySelector('[data-testid="ac-save"]');
                        if (b)
                            b.textContent = 'Yine de yeni kayıt aç';
                    }
                }
            })();
        };
        formHost.replaceChildren(E('div', { class: 'ac-form', 'data-testid': 'ac-form' }, inp('name', 'Varlık adı *', 'ör. Test tableti'), clsSel, inp('code', 'Varlık kodu', 'boşsa otomatik'), inp('sub', 'Alt kategori'), inp('brand', 'Marka / model'), inp('serial', 'Seri no (varsa)'), inp('maker', 'Üretici'), inp('acq', 'Edinim tarihi', '', 'date'), inp('comm', 'Devreye alma', '', 'date'), deptSel, inp('loc', 'Fiziksel konum'), inp('unit', 'Sorumlu birim'), E('div', { class: 'ac-actions' }, E('button', { type: 'button', class: 'ac-btn', 'data-testid': 'ac-save', onClick: save }, forceNew ? 'Yine de yeni kayıt aç' : 'Kaydet'), E('button', { type: 'button', class: 'ac-btn sec', 'data-testid': 'ac-cancel', onClick: () => { formOpen = false; paintForm(); } }, 'Vazgeç'), E('span', { class: 'mut' }, 'Seri no yoksa boş bırakın; sahte numara üretilmez. Zimmet, kayıttan sonra iki taraflı onayla verilir.'))));
    };
    const paint = () => { paintChrome(); paintPanel(); paintGrid(); remember(); };
    const load = async () => {
        const [l, s, m] = await Promise.allSettled([deps.api.list(), deps.api.summary(), deps.api.myTransfers()]);
        loadErr = l.status === 'rejected' ? (isSetupPending(l.reason) ? 'Varlık kaydı henüz kurulmadı (Kurulum bekleniyor). Veritabanı güncellemesi uygulanınca bu ekran açılır.' : `Varlık listesi okunamadı: ${errorText(l.reason)}`) : null;
        rows = l.status === 'fulfilled' ? l.value : [];
        sum = s.status === 'fulfilled' ? s.value : null;
        mine = m.status === 'fulfilled' ? m.value : [];
        paint();
    };
    mount(container, E('div', { class: 'kx ac', 'data-testid': 'ac-root' }, E('style', {}, ENTITY_CARD_CSS + CSS), E('h1', { class: 'ac-h1', 'data-testid': 'ac-heading' }, 'Dijital Varlık Merkezi'), E('p', { class: 'ac-sub' }, 'Makine · ekipman · cihaz kimlikleri, zimmet ve yaşam döngüsü — tek kayıt, yetkiye göre görünüm'), kpiRow, bannerHost, tabRow, barHost, formHost, panelHost, gridHost));
    await load();
}
