// KMI-011 — Ürün Çalışma Alanı: ürün pasaportu + mühendislik kartları (kimlik, resim, CAD, CAM/NC, takım, BOM, rota/operasyon, parametre, kalite, hesap, geçmiş).
// UX/UI turu: ortak `kx` tasarım standardı (kart, buton, input, rozet), özet üst bölüm, açılır düzenleme panelleri, dosya işlemleri (aç/önizle/indir/yeni sürüm/geçmiş), kompakt BOM tablosu,
// okunur operasyon satırları, anlaşılır parametre kartı ve gerçek süre hesabı ekranı. Veri kaynakları ve sunucu kuralları DEĞİŞMEDİ: yetki, revizyon sınıfı, geçerlilik, hesap durumu SUNUCUDA.
// ONE FACT → ONE SOURCE: kartlar kanonik kaynakları gösterir/düzenler; bağımsız kopya yok. Boş değer 0 yazılmaz (VERİ YOK). Gerçek üretim ölçümü bu ekrandan değiştirilemez.
import { rememberProduct } from '../lastProduct.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { CARD_STATE_TR, changeText } from '../../../../packages/domain/src/parameters.js';
import { bytesToHex } from '../../../../packages/domain/src/documents.js';
import { guessMime } from './DocumentsScreen.js';
import { errorText } from '../errorText.js';
import { chainChips, chainGapText, drawChainPanel, orderReadiness } from './productChainPanel.js';
import { drawToolistWork } from './toolistWorkPanel.js';
import { drawToolistMap } from './toolistMapPanel.js';
import { drawBarStock, fmtMm } from './barStockPanel.js';
import { barPlanPreview, DEFAULT_KERF_MM, DEFAULT_STEEL_DENSITY } from '../../../../packages/domain/src/barStock.js';
import { KX_CSS, NA, card, chip, emptyState, field, fmt, fold, fromBase64, invalid, isChecked, kvItem, showFile, toBase64, val, when } from '../kx.js';
const PW_CSS = `
.pw .opc{border:1px solid #1e293b;border-radius:12px;background:#0b1220;margin-top:8px;min-width:0}.pw .opc.open{border-color:#1d4ed8}.pw .opc.off{opacity:.65}
.pw{--opg:64px minmax(230px,2.4fr) minmax(86px,.9fr) 74px 74px 80px minmax(86px,.8fr) 268px}
.pw .opr{display:grid;gap:6px 14px;align-items:center;padding:10px 12px;grid-template-columns:var(--opg);min-width:0}
.pw .opr>*{min-width:0;overflow-wrap:break-word}.pw .opr .code{font-weight:800;color:#fff}.pw .opr .nm{font-weight:600;color:#fff;line-height:1.35;overflow-wrap:break-word;word-break:normal;hyphens:manual}.pw .opr .num{font-variant-numeric:tabular-nums}.pw .opr .u{color:#94a3b8;font-size:11px}
.pw .oph{padding:6px 12px 0;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;font-weight:700;display:grid;gap:6px 14px;grid-template-columns:var(--opg)}
.pw .opr .acts,.pw .oph .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.pw .opx{padding:0 12px 10px;display:flex;flex-direction:column;gap:6px}.pw .opx .l{font-size:12px;color:#94a3b8;display:flex;flex-wrap:wrap;gap:4px 14px}.pw .opx .l b{color:#cbd5e1}
.pw .opb{border-top:1px solid #1e293b;padding:12px}
.pw .opx .chip,.pw [data-testid="pw-chain"] .chip{white-space:normal;max-width:100%;text-align:left;line-height:1.3;overflow-wrap:break-word}.pw .opr .num{white-space:nowrap}
.pw .cl{display:none;font-size:11px;color:#94a3b8;margin-right:4px}
@media (max-width:1280px){.pw .oph{display:none}.pw .opr{grid-template-columns:1fr 1fr;gap:6px 12px}.pw .opr .nm,.pw .opr .c-machine,.pw .opr .c-cam,.pw .opr .acts{grid-column:1/-1}.pw .opr .acts{justify-content:flex-start}.pw .cl{display:inline}}
.pw .head-name{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pw .bomg{grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto}
.pw .docg{grid-template-columns:minmax(0,1fr)}.pw .docg>*{min-width:0;max-width:100%}.pw .docg .row{flex-wrap:wrap}.pw .docg .mut,.pw .docg b,.pw .docg .stack>div{overflow-wrap:anywhere;word-break:break-word}.pw .docg .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start}
.pw .parg{grid-template-columns:minmax(0,1.3fr) repeat(3,minmax(0,1fr)) auto}
.pw .pcell{display:flex;flex-direction:column;gap:1px;align-items:flex-start}.pw .pcell .cl{display:none}.pw .pcell .linkbtn{min-height:24px;padding:0;font-size:12px}
@media (max-width:900px){.pw .pcell{flex-direction:row;flex-wrap:wrap;gap:4px 10px;align-items:center}.pw .pcell .cl{display:inline;min-width:120px}}
.pw .calcg{grid-template-columns:minmax(0,1.3fr) repeat(4,minmax(0,.8fr)) minmax(0,1.4fr)}
.pw .prevg{grid-template-columns:auto minmax(0,.7fr) minmax(0,.8fr) minmax(0,1fr) auto}
.pw .prodg{grid-template-columns:110px minmax(0,2fr) 140px auto}
`;
const STATE_TONE = { MISSING: 'bad', DRAFT: 'info', APPROVED: 'ok', INVALID: 'warn' };
const REV_TR = { DRAFT: 'Taslak', RELEASED: 'Yürürlükte', OBSOLETE: 'Eski' };
const CALC_TR = { CURRENT: 'Güncel', STALE: 'Eskimiş', SUPERSEDED: 'Yenilendi' };
const CALC_TONE = { CURRENT: 'ok', STALE: 'warn', SUPERSEDED: 'off' };
const KIND_TR = { FIXTURE: 'Fikstür', TOOL: 'Takım', GAUGE: 'Mastar/Ölçü', RESOURCE: 'Kaynak', FIRST_PIECE: 'İlk parça', IN_PROCESS: 'Proses içi', FINAL: 'Son kontrol' };
const DOC_TR = { DRAWING: 'Teknik resim', CAD_MODEL: 'CAD/STEP', NC_PROGRAM: 'NC programı', CAM_SETUP_SHEET: 'CAM setup', TOOL_LIST: 'Takım listesi', CONTROL_PLAN: 'Kontrol planı', WORK_INSTRUCTION: 'İş talimatı' };
const CTL_TR = { DRAFT: 'Taslak', IN_REVIEW: 'İncelemede', APPROVED: 'Onaylandı', EFFECTIVE: 'Yürürlükte', SUPERSEDED: 'Geçersiz', REJECTED: 'Reddedildi' };
const CTL_TONE = { DRAFT: 'info', IN_REVIEW: 'warn', APPROVED: 'warn', EFFECTIVE: 'ok', SUPERSEDED: 'bad', REJECTED: 'bad' };
const PARAMS = [
    { code: 'OP_SETUP_MIN', name: 'Hazırlık süresi', unit: 'dk', src: 'Rota standardı' }, { code: 'OP_CYCLE_SEC', name: 'Çevrim süresi', unit: 'sn/adet', src: 'Rota standardı' }, { code: 'OP_INSPECTION_SEC', name: 'Muayene süresi', unit: 'sn/adet', src: 'Kalite standardı' }
];
const OWNER_TR = { ROUTING: 'Rota (Mühendislik)', QUALITY: 'Kalite', PRODUCTION: 'Üretim' };
const num = (s) => { const t = s.trim().replace(',', '.'); if (t === '')
    return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const isoToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const btn = (cls, testid, text, fn, extra = {}) => E('button', { class: cls, type: 'button', ...(testid ? { 'data-testid': testid } : {}), onClick: fn, ...extra }, text);
const lbl = (t, _v = '') => E('span', { class: 'cl' }, t);
export async function renderProductWorkspaceScreen(container, api, state = {}) {
    const go = (s) => renderProductWorkspaceScreen(container, api, { ...s, ...(state.only ? { only: state.only } : {}) });
    const shell = (...kids) => mount(container, h('div', { class: 'kx pw', 'data-testid': 'pw-root' }, h('style', {}, KX_CSS + PW_CSS), ...kids));
    const banner = state.banner ? E('div', { class: `banner ${state.banner.kind === 'error' ? 'bad' : state.banner.kind === 'ok' ? 'ok' : ''}`, 'data-testid': 'pw-banner', 'data-kind': state.banner.kind, role: state.banner.kind === 'error' ? 'alert' : 'status' }, state.banner.text) : null;
    const fail = (e) => {
        const text = errorText(e);
        let b = container.querySelector('[data-testid="pw-banner"]');
        if (!b) {
            const root = container.querySelector('[data-testid="pw-root"]');
            b = E('div', { class: 'banner bad', 'data-testid': 'pw-banner', 'data-kind': 'error', role: 'alert' });
            const first = root ? [...root.children].find((c) => c.tagName !== 'STYLE') : null;
            if (root)
                root.insertBefore(b, first ?? null);
        }
        b.textContent = text;
        b.className = 'banner bad';
        b.setAttribute('data-kind', 'error');
        try {
            b.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    const stateChip = (s) => chip(CARD_STATE_TR[s], STATE_TONE[s], { 'data-state': s });
    const reasonBox = (tid, ph = 'Gerekçe (en az 10 karakter)') => h('input', { 'data-testid': tid, placeholder: ph, maxlength: 400 });
    if (state.product)
        rememberProduct(state.product);
    if (!state.product)
        return renderHome();
    return renderWorkspace(state.product);
    // ------------------------------------------------------------------------------------------------ ürün listesi
    async function renderHome() {
        let rows = [];
        try {
            rows = await api.search(state.q ?? '');
        }
        catch (e) {
            state = { ...state, banner: { kind: 'error', text: errorText(e) } };
        }
        const q = h('input', { 'data-testid': 'pw-search', placeholder: 'Ürün kodu veya adı', value: state.q ?? '' });
        q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter')
            void go({ q: val(q) }); });
        shell(E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, h('h1', {}, 'Ürün Çalışma Alanı'), E('div', { class: 'mut' }, 'Ürünün resim, CAD, CAM/NC, takım, BOM, rota, süre, kalite ve değişiklik geçmişi tek yerde.'))), state.banner ? E('div', { class: 'banner bad', 'data-testid': 'pw-banner', 'data-kind': 'error', role: 'alert' }, state.banner.text) : null, card({ title: 'Ürün ara', span: 12 }, E('div', { class: 'row' }, E('div', { class: 'grow' }, q), btn('primary', 'pw-search-go', 'Ara', () => void go({ q: val(q) })))), E('div', { style: 'height:14px' }), card({ title: `Ürünler${rows.length ? ` (${rows.length})` : ''}`, span: 12 }, rows.length ? E('div', { class: 'rows' }, ...rows.map((r) => E('div', { class: 'r prodg', 'data-testid': 'pw-product', 'data-code': r.code }, E('b', {}, r.code), E('span', {}, r.name), E('span', { class: 'mut' }, r.currentRevision ? `Rev ${r.currentRevision}` : 'revizyon yok'), E('div', { class: 'acts' }, E('a', { class: 'btn ghost', href: `#/kart?t=PRODUCT&id=${r.id}`, 'data-testid': 'pw-card-link' }, 'Dijital kart'), btn('ghost', `pw-open-${r.code}`, 'Aç', () => void go({ product: r.id })))))) : emptyState('Eşleşen ürün yok', 'Kodun veya adın bir bölümünü yazıp tekrar deneyin.')));
    }
    // ------------------------------------------------------------------------------------------------ çalışma alanı
    async function renderWorkspace(productId) {
        let ws;
        let machines = [];
        try {
            ws = await api.load(productId, state.rev ?? null);
        }
        catch (e) {
            return go({ banner: { kind: 'error', text: errorText(e) } });
        }
        try {
            machines = await api.machines();
        }
        catch {
            machines = [];
        }
        const rev = ws.revision;
        const can = ws.can;
        const editable = !!rev && rev.status !== 'OBSOLETE';
        // Ayrı nedenler: revizyon yok / revizyon kapalı / yükleme yetkisi yok / veri yok — hiçbiri "VERİ YOK" arkasına gizlenmez.
        const whyNoUpload = !rev ? 'NO_REV' : rev.status === 'OBSOLETE' ? 'CLOSED' : !can.manageDocuments ? 'NO_PERM' : null;
        const WHY_TR = { NO_REV: 'Bu ürün için revizyon yok — dosya eklemek için önce taslak revizyon açılmalı.', CLOSED: 'Revizyon kapalı (geçersiz) — yeni revizyon süreci kullanılmalı.', NO_PERM: 'Yükleme yetkiniz yok.' };
        let openOp = state.openOp ?? null;
        const reload = async (text, kind = 'ok', extra = {}) => {
            const y = window.scrollY;
            await go({ product: productId, rev: rev?.id ?? null, openOp, qty: state.qty, ...extra, banner: text ? { kind, text } : undefined });
            try {
                window.scrollTo(0, y);
            }
            catch { /* headless */ }
        };
        const scrollTo = (el) => { try {
            el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }
        catch { /* headless */ } };
        const revSel = h('select', { 'data-testid': 'pw-rev', 'aria-label': 'Revizyon', ...(ws.revisions.length ? {} : { disabled: true }) }, ...(ws.revisions.length ? [] : [h('option', { value: '' }, 'Revizyon yok')]), ...ws.revisions.map((r) => h('option', { value: r.id, selected: r.id === rev?.id }, `Rev ${r.revision} · ${REV_TR[r.status] ?? r.status}`)));
        revSel.addEventListener('change', () => void go({ product: productId, rev: val(revSel) }));
        const noRevBox = rev ? null : (() => {
            const nm = h('input', { 'data-testid': 'pw-newrev-name', placeholder: 'Revizyon (örn. A)', value: 'A', maxlength: 20 });
            const mayTry = can.manageDocuments || can.editStructure;
            return E('div', { class: 'banner', 'data-testid': 'pw-norev', role: 'status' }, E('b', {}, 'Bu ürün için revizyon yok. '), 'Teknik resim, CAD/STEP, CAM/NC, takım listesi, BOM ve rota bir revizyona bağlıdır. ', 'Ürün düzeyinde yüklenmiş belgeler “Belgeler ve sürümler” bölümünde görünür.', mayTry ? E('div', { class: 'row', style: 'margin-top:8px' }, E('div', { style: 'width:140px' }, nm), btn('primary', 'pw-newrev-go', 'İlk revizyonu aç (TASLAK)', () => void (async () => {
                try {
                    await api.createRevision(ws.product.id, val(nm).trim());
                    await reload('Taslak revizyon açıldı. Onay ve üretime serbest bırakma ayrı süreçtir; dosya yüklemek serbest bırakmaz.');
                }
                catch (e) {
                    fail(e);
                }
            })())) : E('div', { class: 'mut', style: 'margin-top:6px' }, 'Revizyon açmak için yetkiniz yok; yetkili bir yönetici açabilir.'));
        })();
        // ---------------------------------------------------------------------------------------- doküman kartları (resim / CAD / CAM / takım): dosya yönetimi
        const docCard = (tid, title, card0, docType, multi = false, span = 6) => {
            const st = (card0?.state ?? 'MISSING');
            const docs = card0?.documents ?? [];
            const viewHost = E('div', { class: 'fileview', 'data-testid': `pw-${tid}-view`, style: 'margin-top:10px' });
            const formHost = E('div', { 'data-testid': `pw-${tid}-formhost` });
            const canUpload = !!(can.manageDocuments && editable);
            const view = async (d, download) => {
                viewHost.replaceChildren();
                try {
                    const f = await api.documentFile(d.id);
                    const bytes = fromBase64(f.content.contentBase64);
                    const local = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
                    const ok = f.content.integrityOk && local === f.content.sha256;
                    viewHost.append(E('div', { class: `banner ${ok ? (f.effective ? 'ok' : '') : 'bad'}`, 'data-testid': `pw-${tid}-integrity`, 'data-ok': String(ok) }, ok ? `${f.content.fileName} · sürüm v${f.versionNo} · ${f.effective ? 'YÜRÜRLÜKTE' : 'yürürlükte değil — üretimde kullanmayın'} · bütünlük doğrulandı (${f.content.sha256.slice(0, 12)}…)` : 'BÜTÜNLÜK HATASI — dosya bozuk, KULLANMAYIN'));
                    if (!ok)
                        return;
                    showFile(viewHost, { bytes, mime: f.content.mimeType, fileName: f.content.fileName, download, testids: { frame: `pw-${tid}-frame`, img: `pw-${tid}-img`, text: `pw-${tid}-text`, link: `pw-${tid}-dl`, none: `pw-${tid}-nopreview` } });
                    if (!download)
                        viewHost.append(btn('ghost sm', null, 'Önizlemeyi kapat', () => viewHost.replaceChildren(), { style: 'margin-top:8px' }));
                }
                catch (e) {
                    fail(e);
                }
            };
            const openForm = (target) => {
                if (formHost.childElementCount) {
                    formHost.replaceChildren();
                    if (!target && formHost.dataset.target === '')
                        return;
                }
                formHost.dataset.target = target?.id ?? '';
                const file = h('input', { type: 'file', 'data-testid': `pw-${tid}-file`, ...(docType === 'TOOL_LIST' ? { accept: '.xlsx,.xls,.csv,.pdf' } : {}) });
                const note = h('input', { 'data-testid': `pw-${tid}-note`, placeholder: target ? 'Bu sürümde ne değişti? (isteğe bağlı)' : 'Not (isteğe bağlı)' });
                const ttl = multi && !target ? h('input', { 'data-testid': `pw-${tid}-title`, placeholder: 'Program adı (ör. OP10 tornalama)' }) : null;
                const upload = async () => {
                    const f = file.files?.[0];
                    if (!f || !rev) {
                        invalid(file, true);
                        return fail(new Error('CONTENT_REQUIRED'));
                    }
                    try {
                        const bytes = new Uint8Array(await f.arrayBuffer());
                        const r = await api.upload({ docType, entityType: 'PRODUCT_REVISION', entityId: rev.id, title: target ? null : ((ttl && val(ttl).trim()) || `${title} ${ws.product.code}`), fileName: f.name, mimeType: guessMime(f.name, f.type), contentBase64: toBase64(bytes), validUntil: null, note: val(note).trim() || null, documentId: target?.id ?? null });
                        await reload(`Yüklendi: sürüm ${r.versionNo} — TASLAK. Üretimde geçerli olması için Doküman Kontrol'den onay ve yürürlüğe alma gerekir.`);
                    }
                    catch (e) {
                        fail(e);
                    }
                };
                formHost.append(E('div', { class: 'formbox' }, E('div', { class: 'mut' }, target ? `${target.docNo ?? ''} için YENİ SÜRÜM: eski sürüm silinmez ve yürürlükteki sürüm değişmez; yeni dosya TASLAK olarak eklenir.` : 'Yeni doküman TASLAK olarak eklenir; onay ve yürürlüğe alma Doküman Kontrol’dedir.'), E('div', { class: 'fgrid w2' }, ...(ttl ? [field('Program adı', ttl)] : []), field('Dosya', file), field('Not', note)), E('div', { class: 'row' }, btn('primary', `pw-${tid}-upload`, 'Yükle (TASLAK)', () => void upload()), btn('ghost', null, 'Vazgeç', () => formHost.replaceChildren()))));
            };
            const toolHost = E('div', { 'data-testid': 'pw-tools-control', style: 'margin-top:10px' });
            const STATUS_TR = { OK: 'DOĞRULANDI', FAIL: 'HATA', WARN: 'UYARI', NOT_VERIFIABLE: 'SİSTEM DOĞRULAYAMADI' };
            const STATUS_TONE = { OK: 'ok', FAIL: 'bad', WARN: 'warn', NOT_VERIFIABLE: 'info' };
            const drawTools = async () => {
                if (docType !== 'TOOL_LIST' || !rev)
                    return;
                toolHost.replaceChildren();
                let ov;
                try {
                    ov = await api.toolistOverview(rev.id);
                }
                catch {
                    return;
                }
                const stTr = { DRAFT: 'Taslak', IN_REVIEW: 'Kontrolde', APPROVED: 'Onaylı (yürürlüğe alınmadı)', EFFECTIVE: 'Yürürlükte', SUPERSEDED: 'Eski sürüm', REJECTED: 'Reddedildi' };
                const showChecks = async (vid, holder, canAttest, state, attested) => {
                    holder.replaceChildren();
                    try {
                        const c = await api.toolistChecks(vid);
                        const attItems = [['tool_numbers', 'Takım numaraları'], ['diameters', 'Çaplar'], ['lengths', 'Boylar'], ['holders', 'Tutucular'], ['offsets', 'Offset / düzeltme numaraları'], ['cam_nc_match', 'CAM/NC programı ile uyum'], ['machine_config', 'Tezgâh yapılandırması (magazin, izinli tezgâh)']];
                        const boxes = attItems.map(([k, t]) => ({ k, t, el: h('input', { type: 'checkbox', 'data-testid': `pw-tools-att-${k}` }) }));
                        const all = h('input', { type: 'checkbox', 'data-testid': 'pw-tools-att-all' });
                        all.addEventListener('change', () => boxes.forEach((b) => { b.el.checked = all.checked; }));
                        const note = h('input', { 'data-testid': 'pw-tools-att-note', placeholder: 'Neye göre doğruladınız? (ör. takım ayar föyü, ölçüm)' });
                        const row = (x) => E('div', { class: 'r', 'data-testid': 'pw-tools-check', 'data-code': x.code, 'data-status': x.status }, chip(STATUS_TR[x.status] ?? x.status, STATUS_TONE[x.status] ?? ''), E('b', {}, x.label), E('span', { class: 'mut' }, x.detail));
                        const todo = c.checks.filter((x) => x.status !== 'OK');
                        const okc = c.checks.filter((x) => x.status === 'OK');
                        const docTr = state === 'EFFECTIVE' ? 'Yürürlükte' : state === 'APPROVED' ? 'Onaylı' : state === 'IN_REVIEW' ? 'Kontrolde' : 'Taslak';
                        const prep = c.fail > 0 ? 'Hatalı madde var' : todo.length > 0 ? 'Eksik bilgiler var' : attested ? 'Hazır' : 'Elle doğrulama bekliyor';
                        const useTxt = (c.fail === 0 && todo.length === 0 && attested && state === 'EFFECTIVE') ? 'Serbest' : 'Henüz serbest değil';
                        const sumRow = (k, lbl, v, tone) => E('div', { class: 'row', style: 'gap:6px' }, E('span', { class: 'mut' }, lbl), chip(v, tone, { 'data-testid': `pw-tools-sum-${k}` }));
                        holder.append(E('div', { class: 'stack', style: 'gap:6px', 'data-testid': 'pw-tools-summary' }, sumRow('doc', 'Belge', docTr, state === 'EFFECTIVE' || state === 'APPROVED' ? 'ok' : ''), sumRow('prep', 'Takım hazırlığı', prep, c.fail > 0 ? 'bad' : todo.length > 0 ? 'warn' : attested ? 'ok' : 'info'), sumRow('use', 'Üretimde kullanım', useTxt, useTxt === 'Serbest' ? 'ok' : 'warn')), todo.length ? E('div', { class: 'rows', 'data-testid': 'pw-tools-checks' }, E('b', {}, `Yapılacaklar (${todo.length})`), ...todo.map(row)) : E('div', { class: 'mut', 'data-testid': 'pw-tools-checks' }, 'Açık madde yok.'), okc.length ? E('details', { 'data-testid': 'pw-tools-ok-fold' }, E('summary', { class: 'mut' }, `Geçen kontroller (${okc.length})`), E('div', { class: 'rows' }, ...okc.map(row))) : document.createComment(''), c.fail > 0 ? E('div', { class: 'banner bad', 'data-testid': 'pw-tools-failed' }, 'Hatalı madde var: bu sürüm yürürlüğe alınamaz. Düzeltilmiş yeni sürüm yükleyin.')
                            : attested ? E('div', { class: 'banner ok', 'data-testid': 'pw-tools-attested' }, 'Kritik alanlar yetkili kişi tarafından doğrulandı ve kaydedildi.')
                                : (canAttest && (state === 'IN_REVIEW' || state === 'APPROVED')) ? E('details', { 'data-testid': 'pw-tools-attest-form', open: todo.length === 0 }, E('summary', {}, E('b', {}, 'Teknik doğrulama (yetkili)')), E('div', { class: 'formbox' }, ...boxes.map((b) => E('label', { class: 'row', style: 'gap:6px' }, b.el, b.t)), E('label', { class: 'row', style: 'gap:6px' }, all, 'Tümünü işaretle (hepsini kontrol ettim)'), field('Doğrulama notu', note), btn('primary', 'pw-tools-attest', 'Doğruladım, kaydet', () => void (async () => { try {
                                    await api.toolistAttest(vid, Object.fromEntries(boxes.map((b) => [b.k, b.el.checked])), val(note).trim());
                                    await reload('Takım listesi doğrulaması kaydedildi. Yürürlüğe alma Doküman Kontrol’dedir.');
                                }
                                catch (e) {
                                    fail(e);
                                } })())))
                                    : E('div', { class: 'mut' }, 'Elle doğrulama bekleniyor (kontrol ve onay sürecinden sonra yetkili kişi kaydeder).'));
                    }
                    catch (e) {
                        fail(e);
                    }
                };
                for (const d of ov.documents)
                    for (const v of d.versions.slice(0, 3)) {
                        const holder = E('div', { 'data-testid': 'pw-tools-checkhost' });
                        const workHost = E('div', { 'data-testid': 'pw-tools-workhost' });
                        const ncTexts = async () => { const ch = await api.techChain(rev.id); const ids = [...new Set(ch.operations.map((o) => o.nc.versionId).filter((x) => !!x))]; const out = []; for (const id of ids) {
                            const f = await api.toolistFile(id);
                            out.push(new TextDecoder().decode(fromBase64(f.contentBase64)));
                        } return out; };
                        const openWork = () => drawToolistWork(workHost, api, { versionId: v.versionId, fileName: v.fileName, versionState: v.state, ncTexts, showErr: fail,
                            onChanged: async (m) => { await showChecks(v.versionId, holder, ov.canAttest, v.state, v.attested); await openWork(); workHost.prepend(E('div', { class: 'banner ok', role: 'status', 'data-testid': 'pw-work-saved' }, m)); } });
                        toolHost.append(E('div', { class: 'r', 'data-testid': 'pw-tools-version' }, E('b', {}, `${d.docNo ?? ''} v${v.versionNo}`), E('span', { class: 'mut' }, `${v.fileName} · ${stTr[v.state] ?? v.state}${v.attested ? ' · elle doğrulandı' : ''}`), (ov.canAttest || canUpload) ? btn('primary sm', 'pw-tools-work', 'Takım verisi: düzenle / Excel güncelle', () => void openWork()) : null, btn('ghost sm', 'pw-tools-show-checks', 'Otomatik kontroller', () => void showChecks(v.versionId, holder, ov.canAttest, v.state, v.attested)), (!v.attested && (v.state === 'DRAFT' || v.state === 'IN_REVIEW') && /\.(xlsx|csv)$/i.test(v.fileName)) ? btn('ghost sm', 'pw-tools-map', 'Dosya eşlemesi (gelişmiş)', () => void drawToolistMap(holder, api, v.versionId, v.fileName, async (msg) => { await showChecks(v.versionId, holder, ov.canAttest, v.state, v.attested); holder.prepend(E('div', { class: 'banner ok', role: 'status', 'data-testid': 'pw-map-saved' }, msg)); }, fail, async () => { const ch = await api.techChain(rev.id); const ids = [...new Set(ch.operations.map((o) => o.nc.versionId).filter((x) => !!x))]; const out = []; for (const id of ids) {
                            const f = await api.toolistFile(id);
                            out.push(new TextDecoder().decode(fromBase64(f.contentBase64)));
                        } return out; })) : null), holder, workHost);
                    }
                for (const r of ov.rechecksOpen) {
                    const note = h('input', { 'data-testid': 'pw-tools-recheck-note', placeholder: 'CAM/NC ve operasyon yeni listeyle uyumlu mu? Kısa not' });
                    toolHost.append(E('div', { class: 'banner', role: 'status', 'data-testid': 'pw-tools-recheck' }, E('b', {}, `OP${r.opNo}: takım listesi değişti — CAM/NC ve operasyon uygunluğu yeniden kontrol edilmeli. `), 'Kayıt girilene kadar bu operasyon iş emrinde başlatılamaz.', ov.canAttest ? E('div', { class: 'row', style: 'margin-top:6px' }, note, btn('primary sm', 'pw-tools-recheck-done', 'Kontrol edildi', () => void (async () => { try {
                        await api.toolistRecheckDone(r.id, val(note).trim());
                        await reload('Yeniden kontrol kaydedildi.');
                    }
                    catch (e) {
                        fail(e);
                    } })())) : null));
                }
            };
            const docRow = (d) => E('div', { class: 'r docg', 'data-testid': 'pw-doc', 'data-doc-no': d.docNo ?? '' }, E('div', { class: 'stack', style: 'gap:3px' }, E('div', { class: 'row', style: 'gap:6px' }, E('b', {}, d.docNo ?? '—'), chip(CTL_TR[d.controlState ?? ''] ?? '—', CTL_TONE[d.controlState ?? ''] ?? ''), E('span', { class: 'mut' }, `v${d.versionNo ?? '—'}${d.effectiveVersionNo ? ` · yürürlükte v${d.effectiveVersionNo}` : ''}`)), E('div', {}, d.title), E('div', { class: 'mut' }, `${DOC_TR[d.docType] ?? d.docType}${d.fileName ? ` · ${d.fileName}` : ''}${d.opNos.length ? ` · OP${d.opNos.join(', OP')}` : ''}`)), E('div', { class: 'acts' }, btn('ghost sm', 'pw-doc-open', 'Önizle', () => void view(d, false)), btn('ghost sm', 'pw-doc-dl', 'İndir', () => void view(d, true)), h('a', { class: 'btn ghost sm', href: `#/dokuman-kontrol?doc=${d.id}`, 'data-testid': 'pw-doc-history' }, 'Geçmiş'), canUpload ? btn('ghost sm', `pw-${tid}-newver-${d.docNo ?? ''}`, 'Yeni sürüm', () => openForm(d)) : null));
            const addBtn = canUpload && (docs.length === 0 || multi) ? btn(docs.length ? 'ghost sm' : 'primary sm', `pw-${tid}-open-upload`, docs.length ? '+ Yeni program' : 'Dosya yükle', () => openForm(null)) : null;
            const cardEl = card({ title, span, testid: `pw-card-${tid}`, chip: stateChip(st), attrs: { 'data-state': st }, actions: [addBtn] }, docs.length ? E('div', { class: 'rows' }, ...docs.map(docRow)) : (whyNoUpload === 'NO_REV' ? emptyState(`Revizyon yok — ${title.toLowerCase()} eklenemez`, WHY_TR.NO_REV) : emptyState(`${NA} — bu revizyonda ${title.toLowerCase()} yok`, canUpload ? 'İlk dosyayı “Dosya yükle” ile ekleyin.' : (whyNoUpload ? WHY_TR[whyNoUpload] : ''))), formHost, viewHost, docType === 'TOOL_LIST' ? toolHost : null);
            void drawTools();
            return cardEl;
        };
        // ---------------------------------------------------------------------------------------- rota ve operasyonlar
        const activeOps = ws.routing.filter((o) => o.active);
        const quickReason = reasonBox('pw-quick-reason', 'Gerekçe (en az 10 karakter)');
        const prompt0 = () => { const v = val(quickReason).trim(); if (v.length < 10) {
            invalid(quickReason, true);
            fail(new Error('REASON_REQUIRED: gerekçe en az 10 karakter'));
            return null;
        } invalid(quickReason, false); return v; };
        const paramHistHost = E('div', { 'data-testid': 'pw-param-history', style: 'margin-top:10px' });
        const showParam = async (o, code) => {
            try {
                paramHistHost.replaceChildren();
                if (code === 'OP_INSPECTION_SEC') {
                    const ph = await api.parameterHistory(code, o.id);
                    if (!ph.versions.length)
                        paramHistHost.append(emptyState(`${NA} — ${o.opCode} muayene süresi için hiç değer girilmemiş`));
                    else
                        paramHistHost.append(E('div', { class: 'kx-sub' }, E('b', {}, `${o.opCode} · ${ph.def.name} geçmişi`), E('div', { class: 'rows' }, ...ph.versions.map((v) => E('div', { class: 'r prevg', 'data-testid': 'pw-param-row' }, E('b', {}, `v${v.versionNo}`), E('span', {}, changeText(v.prevValue, v.value, ph.def.unit)), E('span', { class: 'mut' }, `${v.validFrom}${v.validTo ? ' → ' + v.validTo : ' →'}`), E('span', { class: 'mut' }, `${v.setBy ?? '—'} · ${v.reason}`), v.inForce ? chip('Yürürlükte', 'ok') : E('span', {}))))));
                }
                else {
                    const rows = await api.opHistory(o.id);
                    const setup = code === 'OP_SETUP_MIN';
                    const unit = setup ? 'dk' : 'sn';
                    paramHistHost.append(E('div', { class: 'kx-sub' }, E('b', {}, `${o.opCode} · ${setup ? 'Hazırlık' : 'Çevrim'} süresi geçmişi`), E('div', { class: 'rows' }, ...rows.map((r, i) => {
                        const prev = rows[i + 1];
                        const cur = setup ? r.setupMinutes : r.cycleSeconds;
                        const was = prev ? (setup ? prev.setupMinutes : prev.cycleSeconds) : undefined;
                        return E('div', { class: 'r prevg', 'data-testid': 'pw-param-row' }, E('b', {}, `v${r.versionNo}`), E('span', {}, prev ? changeText(was, cur, unit) : `${fmt(cur)} ${unit}`), E('span', { class: 'mut' }, when(r.at)), E('span', { class: 'mut' }, `${r.by ?? '—'} · ${r.reason ?? '—'}`), E('span', {}));
                    }))));
                }
                scrollTo(paramHistHost);
            }
            catch (e) {
                fail(e);
            }
        };
        const opEditor = (o) => {
            const op = o;
            const structural = !op || !op.active;
            const noIn = h('input', { 'data-testid': 'pw-op-no', type: 'number', min: 1, value: op ? String(op.opNo) : String((activeOps.at(-1)?.opNo ?? 0) + 10), disabled: !!op });
            const name = h('input', { 'data-testid': 'pw-op-name', value: op?.name ?? '' });
            const mach = machines.map((m) => ({ m, box: h('input', { type: 'checkbox', 'data-testid': `pw-op-m-${m.code}`, checked: !!op?.machines.some((x) => x.id === m.id) }) }));
            const primary = h('select', { 'data-testid': 'pw-op-primary' }, h('option', { value: '' }, '— öncelikli makine yok —'), ...machines.map((m) => h('option', { value: m.id, selected: !!op?.machines.some((x) => x.id === m.id && x.primary) }, m.code)));
            const skill = h('input', { 'data-testid': 'pw-op-skill', value: op?.skillCode ?? '', placeholder: 'Yeterlilik kodu' });
            const level = h('input', { 'data-testid': 'pw-op-level', type: 'number', min: 1, max: 5, value: op?.skillLevel != null ? String(op.skillLevel) : '' });
            const setup = h('input', { 'data-testid': 'pw-op-setup', inputmode: 'decimal', value: op?.setupMinutes != null ? String(op.setupMinutes) : '' });
            const cycle = h('input', { 'data-testid': 'pw-op-cycle', inputmode: 'decimal', value: op?.cycleSeconds != null ? String(op.cycleSeconds) : '' });
            const fp = h('input', { type: 'checkbox', 'data-testid': 'pw-op-fp', checked: op?.firstPieceRequired ?? true });
            const qc = h('input', { type: 'checkbox', 'data-testid': 'pw-op-qc', checked: op?.qcRequired ?? false });
            const ins = h('textarea', { 'data-testid': 'pw-op-instr', placeholder: 'Operatör talimatı' });
            ins.value = op?.instructions ?? '';
            const reason = reasonBox('pw-op-reason');
            const save = async () => {
                const ids = mach.filter((x) => isChecked(x.box)).map((x) => x.m.id);
                const setupV = num(val(setup));
                const cycleV = num(val(cycle));
                const no = Number(val(noIn));
                if (!val(name).trim()) {
                    invalid(name, true);
                    return fail(new Error('Eksik alan: operasyon adı'));
                }
                invalid(name, false);
                const diffs = [];
                if (op) {
                    if (setupV !== op.setupMinutes)
                        diffs.push(`Hazırlık: ${changeText(op.setupMinutes, setupV, 'dk')}`);
                    if (cycleV !== op.cycleSeconds)
                        diffs.push(`Çevrim: ${changeText(op.cycleSeconds, cycleV, 'sn')}`);
                    if (val(name).trim() !== op.name)
                        diffs.push(`Ad: ${changeText(op.name, val(name).trim())}`);
                }
                try {
                    const r = await api.saveOperation({ revisionId: rev.id, opNo: no, name: val(name).trim(), machineIds: ids, primaryId: val(primary) || null, skillCode: val(skill).trim() || null, skillLevel: num(val(level)),
                        camId: op?.camProgramId ?? null, setup: setupV, cycle: cycleV, firstPiece: isChecked(fp), qc: isChecked(qc), instructions: val(ins).trim() || null, reason: val(reason).trim() });
                    openOp = r.operationId;
                    await reload(`${r.opCode} ${r.created ? 'eklendi' : 'kaydedildi'} (sürüm ${r.versionNo}).${diffs.length ? ' ' + diffs.join(' · ') + '.' : ''}${r.recalculatedRuns ? ` ${r.recalculatedRuns} etkilenen hesap yeniden değerlendirildi (eski hesaplar korunur).` : ''}`, 'ok', { openOp: r.operationId });
                }
                catch (e) {
                    fail(e);
                }
            };
            return E('div', { class: 'stack', 'data-testid': op ? 'pw-op-edit' : 'pw-op-new' }, E('fieldset', { class: 'fsec' }, h('legend', {}, 'Genel'), E('div', { class: 'fgrid' }, field('Operasyon no', noIn), field('Ad', name), field('Öncelikli makine', primary), field('Yeterlilik', skill), field('Seviye (1-5)', level))), E('fieldset', { class: 'fsec' }, h('legend', {}, 'Süreler'), E('div', { class: 'fgrid' }, field('Hazırlık (dk)', setup), field('Çevrim (sn/adet)', cycle))), E('fieldset', { class: 'fsec' }, h('legend', {}, 'İzinli makineler'), E('div', { class: 'row', style: 'gap:4px 16px' }, ...mach.map((x) => h('label', { class: 'chk' }, x.box, x.m.code))), machines.length ? null : E('div', { class: 'mut' }, 'Makine listesi okunamadı.')), E('div', { class: 'row', style: 'gap:4px 20px' }, h('label', { class: 'chk' }, fp, 'İlk parça kontrolü şart'), h('label', { class: 'chk' }, qc, 'Kalite kontrolü şart')), field('Operatör talimatı', ins), !can.editStructure && structural ? E('div', { class: 'mut' }, 'Yeni operasyon eklemek için taslak revizyon gerekir.') : null, E('div', { class: 'row', style: 'align-items:flex-end' }, E('div', { class: 'grow' }, field('Değişiklik gerekçesi', reason, 'Her kayıt sürümlenir; eski hâli korunur.')), btn('primary', 'pw-op-save', 'Kaydet', () => void save())));
        };
        const opExtras = (o) => {
            const insp = h('input', { 'data-testid': 'pw-insp-value', inputmode: 'decimal', placeholder: 'sn/adet', value: o.inspectionSeconds != null ? String(o.inspectionSeconds) : '' });
            const from = h('input', { 'data-testid': 'pw-insp-from', type: 'date', value: isoToday(), min: isoToday() });
            const preason = reasonBox('pw-insp-reason');
            const resKind = h('select', { 'data-testid': 'pw-res-kind' }, ...['FIXTURE', 'TOOL', 'GAUGE', 'RESOURCE'].map((k) => h('option', { value: k }, KIND_TR[k])));
            const resCode = h('input', { 'data-testid': 'pw-res-code', placeholder: 'Kod (ör. T12)' });
            const qcNo = h('input', { 'data-testid': 'pw-qc-no', type: 'number', min: 1, placeholder: 'No' });
            const qcLabel = h('input', { 'data-testid': 'pw-qc-label', placeholder: 'Kontrol (ör. Çap Ø20 H7)' });
            const plans = ws.quality.filter((q) => q.operationNo === null || q.operationNo === o.opNo);
            const qcPlan = h('select', { 'data-testid': 'pw-qc-plan' }, h('option', { value: '' }, '— kontrol planı seçilmedi —'), ...plans.map((q) => h('option', { value: q.id }, `${q.operationNo != null ? 'OP' + q.operationNo : 'Genel'} v${q.version} (${q.status}) · ${q.characteristics} karakteristik`)));
            const qcKind = h('select', { 'data-testid': 'pw-qc-kind' }, ...['FIRST_PIECE', 'IN_PROCESS', 'FINAL'].map((k) => h('option', { value: k }, KIND_TR[k])));
            const depSel = h('select', { 'data-testid': 'pw-dep-sel' }, h('option', { value: '' }, '— ön koşul operasyon —'), ...activeOps.filter((x) => x.opNo < o.opNo && !o.dependsOn.some((d) => d.operationId === x.id)).map((x) => h('option', { value: x.id }, x.opCode)));
            const act = async (fn, text) => { const why = prompt0(); if (why === null)
                return; try {
                await fn();
                await reload(text, 'ok', { openOp: o.id });
            }
            catch (e) {
                fail(e);
            } };
            const setInsp = async () => {
                const v = num(val(insp));
                if (v === null) {
                    invalid(insp, true);
                    return fail(new Error('VALUE_OUT_OF_RANGE'));
                }
                invalid(insp, false);
                try {
                    const r = await api.setParameter('OP_INSPECTION_SEC', o.id, v, val(from) || null, null, val(preason).trim());
                    await reload(`Muayene süresi ${o.opCode}: ${changeText(r.oldValue, r.newValue, 'sn')} (sürüm ${r.versionNo}, ${r.validFrom} itibarıyla). Eski hesaplar eski parametre sürümüyle korunur; etkilenenler "Eskimiş" görünür.`, 'ok', { openOp: o.id });
                }
                catch (e) {
                    fail(e);
                }
            };
            return E('div', { class: 'stack' }, E('fieldset', { class: 'fsec', 'data-testid': 'pw-insp-box' }, h('legend', {}, 'Muayene süresi (parametre)'), E('div', { class: 'fgrid' }, field('Değer (sn/adet)', insp), field('Geçerlilik başlangıcı', from)), E('div', { style: 'margin-top:10px' }, field('Gerekçe', preason)), E('div', { class: 'row', style: 'margin-top:10px' }, btn('primary', 'pw-insp-save', 'Parametreyi kaydet', () => void setInsp()), btn('ghost', 'pw-param-hist-btn', 'Parametre geçmişi', () => void showParam(o, 'OP_INSPECTION_SEC')))), E('fieldset', { class: 'fsec' }, h('legend', {}, 'Kaynak / fikstür / takım'), E('div', { class: 'row' }, E('div', { style: 'width:150px' }, resKind), E('div', { style: 'width:150px' }, resCode), btn('ghost', 'pw-res-add', 'Ekle', () => void act(() => api.setResource(o.id, val(resKind), val(resCode).trim(), null, null, null, true, val(quickReason).trim()), 'Kaynak eklendi.'))), o.resources.length ? E('div', { class: 'row', style: 'margin-top:8px' }, ...o.resources.map((r) => btn('ghost sm', `pw-res-del-${r.code}`, `✕ ${KIND_TR[r.kind] ?? r.kind} ${r.code}`, () => void act(() => api.setResource(o.id, r.kind, r.code, r.label, r.qty, r.note, false, val(quickReason).trim()), `${r.code} kaldırıldı.`)))) : null), E('fieldset', { class: 'fsec' }, h('legend', {}, 'Kalite kontrol noktaları'), E('div', { class: 'fgrid' }, field('No', qcNo), field('Kontrol', qcLabel), field('Tür', qcKind), field('Kontrol planı', qcPlan)), E('div', { class: 'row', style: 'margin-top:10px' }, btn('ghost', 'pw-qc-add', 'Ekle / güncelle', () => void act(() => api.setQcPoint(o.id, Number(val(qcNo)), val(qcLabel).trim(), val(qcKind), val(qcPlan) || null, null, true, val(quickReason).trim()), 'Kalite noktası kaydedildi.')))), ...(can.editStructure ? [E('fieldset', { class: 'fsec' }, h('legend', {}, 'Bağımlılık (ön koşul)'), E('div', { class: 'row' }, E('div', { style: 'width:200px' }, depSel), btn('ghost', 'pw-dep-add', 'Ekle', () => void act(() => api.setDependency(o.id, val(depSel), true, val(quickReason).trim()), 'Bağımlılık eklendi.')), ...o.dependsOn.map((d) => btn('ghost sm', null, `✕ ${d.opCode}`, () => void act(() => api.setDependency(o.id, d.operationId, false, val(quickReason).trim()), `${d.opCode} bağımlılığı kaldırıldı.`)))))] : []));
        };
        let chainNow = null; // filled by the technical-chain panel (0136); null = not readable → no chips, nothing invented
        const chainOf = (o) => chainNow?.operations.find((x) => x.opNo === o.opNo) ?? null;
        const opsHost = E('div', { 'data-testid': 'pw-ops' });
        const move = async (o, dir) => {
            const ids = activeOps.map((x) => x.id);
            const i = ids.indexOf(o.id);
            const j = i + dir;
            if (j < 0 || j >= ids.length)
                return;
            [ids[i], ids[j]] = [ids[j], ids[i]];
            const why = prompt0();
            if (why === null)
                return;
            try {
                await api.reorder(rev.id, ids, why);
                await reload('Operasyon sırası değişti.');
            }
            catch (e) {
                fail(e);
            }
        };
        const clearBanner = () => container.querySelector('[data-testid="pw-banner"]')?.remove();
        const toggleOp = (id) => { clearBanner(); openOp = openOp === id ? null : id; drawOps(); if (openOp)
            scrollTo(opsHost.querySelector(`[data-op-id="${id}"]`)); };
        const opCard = (o, idx) => {
            const open = openOp === o.id;
            const st = o.state;
            const editOk = can.editRouting && editable;
            const resLine = o.resources.length ? `Takım / fikstür: ${o.resources.map((r) => `${KIND_TR[r.kind] ?? r.kind} ${r.code}`).join(', ')}` : null;
            const preLine = o.dependsOn.length ? `Ön koşul: ${o.dependsOn.map((d) => d.opCode).join(', ')}` : null;
            const qcLine = o.qcPoints.length ? `Kalite noktaları: ${o.qcPoints.map((q) => `KN${q.pointNo} ${q.label}${q.controlPlan ? ` [plan ${q.controlPlan}]` : ''}`).join('; ')}` : null;
            const docLine = o.documents.length ? `Belgeler: ${o.documents.map((d) => d.docNo).join(', ')}` : null;
            return E('div', { class: `opc ${open ? 'open' : ''} ${o.active ? '' : 'off'}`, 'data-testid': 'pw-op', 'data-op': o.opCode, 'data-op-id': o.id, 'data-active': String(o.active), 'data-state': st }, E('div', { class: 'opr' }, E('span', { class: 'code' }, o.opCode), E('div', { class: 'nm' }, o.name, ' ', stateChip(st), o.active ? null : [' ', chip('Pasif', 'bad')]), E('div', { class: 'c-machine' }, lbl('Makine', ''), o.machines.length ? o.machines.map((m) => (m.primary ? `★${m.code}` : m.code)).join(', ') : NA), E('div', { class: 'num' }, lbl('Hazırlık', ''), `${fmt(o.setupMinutes)} `, o.setupMinutes != null ? E('span', { class: 'u' }, 'dk') : null), E('div', { class: 'num' }, lbl('Çevrim', ''), `${fmt(o.cycleSeconds)} `, o.cycleSeconds != null ? E('span', { class: 'u' }, 'sn') : null), E('div', { class: 'num' }, lbl('Muayene', ''), `${fmt(o.inspectionSeconds)} `, o.inspectionSeconds != null ? E('span', { class: 'u' }, 'sn') : null), E('div', { class: 'c-cam' }, lbl('CAM', ''), o.camProgram ?? E('span', { class: 'mut' }, 'yok')), E('div', { class: 'acts' }, btn('ghost sm', `pw-op-toggle-${o.opCode}`, open ? 'Kapat' : (editOk && o.active ? 'Düzenle' : 'Aç'), () => toggleOp(o.id)), can.editStructure && o.active ? btn('ghost sm icon', `pw-op-up-${o.opCode}`, '↑', () => void move(o, -1), { 'aria-label': `${o.opCode} yukarı taşı`, ...(idx === 0 ? {} : {}) }) : null, can.editStructure && o.active ? btn('ghost sm icon', `pw-op-down-${o.opCode}`, '↓', () => void move(o, 1), { 'aria-label': `${o.opCode} aşağı taşı` }) : null, can.editStructure ? btn(o.active ? 'danger sm' : 'ghost sm', `pw-op-active-${o.opCode}`, o.active ? 'Pasife al' : 'Etkinleştir', () => { const why = prompt0(); if (why === null)
                return; void (async () => { try {
                await api.setActive(o.id, !o.active, why);
                await reload(o.active ? `${o.opCode} pasife alındı (silinmez, geçmişi korunur).` : `${o.opCode} etkinleştirildi.`, 'ok', { openOp: o.id });
            }
            catch (e) {
                fail(e);
            } })(); }) : null)), E('div', { class: 'opx' }, E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, E('span', { class: 'mut' }, `v${o.versionNo ?? '—'}${o.usedInWorkOrders ? ` · ${o.usedInWorkOrders} iş emrinde` : ''}`), o.firstPieceRequired ? chip('İlk parça', 'warn') : null, o.qcRequired ? chip('Kalite', 'warn') : null, ...(chainOf(o) && o.active ? [...chainChips(chainOf(o)), btn('ghost sm', `pw-op-chain-open-${o.opCode}`, open ? 'Teknik zinciri gizle' : 'Teknik zincir ▸', () => toggleOp(o.id))] : [])), chainOf(o) && o.active && chainGapText(chainOf(o)) ? E('div', { class: 'mut', 'data-testid': 'pw-op-gap' }, chainGapText(chainOf(o))) : null, resLine || preLine || qcLine || docLine ? E('div', { class: 'l' }, ...[resLine, preLine, qcLine, docLine].filter(Boolean).map((t) => E('span', {}, t))) : null), open ? E('div', { class: 'opb' }, o.active ? E('div', { 'data-testid': 'pw-op-chain-host', 'data-op-chain': String(o.opNo), style: 'margin-bottom:12px' }) : null, editOk && o.active ? E('div', { class: 'kx-grid' }, E('div', { class: 'kx-span-7' }, opEditor(o)), E('div', { class: 'kx-span-5' }, opExtras(o)))
                : E('div', { class: 'mut' }, o.active ? 'Bu revizyonu düzenleme yetkiniz yok ya da revizyon kapalı.' : 'Pasif operasyon düzenlenmez.'), E('div', { class: 'row', style: 'margin-top:10px' }, btn('ghost', 'pw-op-hist-btn', 'Operasyon geçmişi (önce → sonra)', () => void showHist(o))), E('div', { 'data-testid': 'pw-op-history', 'data-op-hist': o.id })) : null);
        };
        const showHist = async (o) => {
            const hist = opsHost.querySelector(`[data-op-hist="${o.id}"]`);
            if (!hist)
                return;
            try {
                const rows = await api.opHistory(o.id);
                hist.replaceChildren(E('div', { class: 'tw', style: 'margin-top:8px' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Sürüm', 'Tür', 'Kim / Ne zaman', 'Ad', 'Hazırlık', 'Çevrim', 'Gerekçe'].map((c) => h('th', {}, c)))), h('tbody', {}, ...rows.map((r, i) => {
                    const prev = rows[i + 1];
                    return h('tr', { 'data-testid': 'pw-op-hist-row' }, h('td', {}, `v${r.versionNo}`), h('td', {}, r.kind), h('td', {}, `${r.by ?? '—'} · ${when(r.at)}`), h('td', {}, r.name ?? '—'), h('td', {}, prev ? changeText(prev.setupMinutes, r.setupMinutes) : fmt(r.setupMinutes)), h('td', {}, prev ? changeText(prev.cycleSeconds, r.cycleSeconds) : fmt(r.cycleSeconds)), h('td', {}, r.reason ?? '—'));
                })))));
            }
            catch (e) {
                fail(e);
            }
        };
        const chainHost = E('div', { 'data-testid': 'pw-chain-host' });
        function drawOps() {
            queueMicrotask(() => {
                const op = ws.routing.find((x) => x.id === openOp);
                const host = opsHost.querySelector('[data-testid="pw-op-chain-host"]');
                if (op && host)
                    void drawChainPanel(host, api, ws, { act: !!(can.editRouting || can.manageDocuments) && editable }, (m) => reload(m), (e) => fail(e), undefined, op.opNo);
            });
            opsHost.replaceChildren(...(ws.routing.length ? [E('div', { class: 'oph' }, E('span', {}, 'OP'), E('span', {}, 'Operasyon'), E('span', {}, 'Makine'), E('span', {}, 'Hazırlık'), E('span', {}, 'Çevrim'), E('span', {}, 'Muayene'), E('span', {}, 'CAM'), E('span', { class: 'acts' }, 'İşlem')), ...ws.routing.map(opCard)]
                : [emptyState(`${NA} — bu revizyonda operasyon yok`, can.editStructure ? '“+ Operasyon ekle” ile ilk operasyonu tanımlayın.' : 'Operasyon tanımı için taslak revizyon gerekir.', 'pw-route-empty')]), ...(can.editStructure && openOp === 'NEW' ? [E('div', { class: 'opc open', style: 'margin-top:8px' }, E('div', { class: 'opb' }, E('b', {}, 'Yeni operasyon'), E('div', { style: 'margin-top:10px' }, opEditor(null)), E('div', { class: 'row', style: 'margin-top:8px' }, btn('ghost sm', null, 'Vazgeç', () => { openOp = null; drawOps(); }))))] : []));
        }
        const checks = Array.isArray(ws.routingCheck) ? ws.routingCheck : ws.routingCheck?.checks ?? [];
        const addOp = () => { clearBanner(); openOp = 'NEW'; drawOps(); scrollTo(opsHost.lastElementChild); };
        const routingCard = card({ title: 'Rota ve operasyonlar', testid: 'pw-card-routing', span: 12, id: 'card-routing', chip: stateChip(ws.routing.length ? (rev?.state ?? 'MISSING') : 'MISSING'),
            actions: [can.editStructure ? btn('primary', 'pw-op-add', '+ Operasyon ekle', addOp) : null] }, checks.length ? E('div', { class: 'row', style: 'gap:6px;margin-bottom:10px' }, ...checks.map((c) => chip(`${c.label}: ${c.detail}`, c.status === 'OK' ? 'ok' : c.status === 'NA' ? '' : 'warn', { 'data-testid': 'pw-route-check', 'data-code': c.code, 'data-status': c.status, title: c.detail, style: 'white-space:normal' }))) : null, can.editRouting && editable ? E('div', { class: 'row', style: 'margin-bottom:6px' }, E('div', { class: 'grow' }, field('Hızlı işlem gerekçesi', quickReason, 'Sırala, pasife al, bağımlılık, kaynak ve kalite noktası işlemleri bu gerekçeyi kullanır.'))) : null, chainHost, opsHost, can.editRouting && rev?.status === 'RELEASED' ? E('div', { class: 'mut', style: 'margin-top:10px' }, 'Yürürlükteki revizyonda operasyon ekleme, sıralama ve pasife alma yapılmaz; makine, süre, kaynak ve talimat güncellenir (sürümlenir). Yapısal değişiklik için taslak revizyon açın.') : null);
        drawOps();
        void drawChainPanel(chainHost, api, ws, { act: !!(can.editRouting || can.manageDocuments) && editable }, (m) => reload(m), (e) => fail(e), (c) => {
            chainNow = c;
            if (!opsHost.querySelector('input:focus, textarea:focus, select:focus'))
                drawOps(); // never wipe a field the user is typing in
            const o = orderReadiness(ws.readiness?.overall, c, ws.bom.length);
            orderHost.replaceChildren(E('div', { class: `banner ${o.ready ? 'ok' : o.ready === false ? 'bad' : ''}`, 'data-testid': 'pw-order-ready', 'data-ready': String(o.ready) }, E('b', {}, o.ready ? 'Siparişe hazır' : o.ready === false ? 'Siparişe hazır değil' : 'Siparişe hazırlık doğrulanamadı'), o.reasons.length ? ` — ${o.reasons.join('; ')}` : ' — tek hazırlık cevabı ve her operasyonun teknik zinciri tamam.'));
        });
        // ---------------------------------------------------------------------------------------- süre hesabı
        const qty = h('input', { 'data-testid': 'pw-calc-qty', type: 'number', min: 1, value: String(state.qty ?? 1), 'aria-label': 'Adet' });
        const out = E('div', { 'data-testid': 'pw-calc-out', style: 'margin-top:10px' });
        const creason = reasonBox('pw-calc-reason', 'Yeniden değerlendirme gerekçesi (≥10)');
        const doEstimate = async () => {
            try {
                const q = Number(val(qty));
                if (!(q > 0)) {
                    invalid(qty, true);
                    return fail(new Error('QTY_REQUIRED'));
                }
                invalid(qty, false);
                const e = await api.estimate(rev.id, q);
                // İstemci katmanı sunucu alanlarını camelCase'e çevirir (op_no → opNo); parametre kodları (OP_SETUP_MIN) aynen kalır.
                const ops = e.operations;
                const inputs = (e['inputs'] ?? []);
                const missing = ops.filter((x) => x.state === 'MISSING');
                const row = (x) => {
                    const miss = x.state === 'MISSING';
                    const pin = inputs.find((i) => i.opNo === x.opNo);
                    const sMin = x.setupMin ?? null;
                    const cMin = x.cycleSec != null ? (q * x.cycleSec) / 60 : null;
                    const iMin = x.inspectionSec != null ? (q * x.inspectionSec) / 60 : null;
                    const slow = x.inspectionSec != null && x.cycleSec != null && x.inspectionSec > x.cycleSec;
                    return E('div', { class: 'r calcg', 'data-testid': 'pw-calc-op', 'data-state': miss ? 'MISSING' : 'OK' }, E('div', {}, E('b', {}, x.opCode ?? `OP${x.opNo}`), ' ', x.name ?? ''), E('div', { class: 'num' }, lbl('Hazırlık (parti başına)', ''), sMin === null ? NA : `${fmt(sMin)} dk`), E('div', { class: 'num' }, lbl('CNC çevrimi', ''), cMin === null ? NA : `${fmt(cMin, 2)} dk`), E('div', { class: 'num', 'data-testid': 'pw-calc-quality' }, lbl('Kalite muayenesi (paralel)', ''), iMin === null ? NA : `${fmt(iMin, 2)} dk`, slow ? E('span', { class: 'mut' }, ' ⚠ çevrimden uzun') : null), miss ? chip('EKSİK STANDART', 'bad') : E('b', { class: 'num', 'data-testid': 'pw-calc-machine' }, `${fmt(x.minutes, 2)} dk`), E('div', { class: 'mut' }, pin ? ['OP_SETUP_MIN', 'OP_CYCLE_SEC', 'OP_INSPECTION_SEC'].map((k, i) => `${['Hazırlık', 'Çevrim', 'Muayene'][i]} ${pin.params[k]?.versionNo ? `v${pin.params[k].versionNo}` : NA}`).join(' · ') : ''));
                };
                out.replaceChildren(...[E('div', { class: 'row', style: 'gap:8px' }, chip(e.complete ? `Makine süresi ${fmt(e.totalMinutes)} dk` : `EKSİK VERİ — kısmi ${fmt(e.partialMinutes)} dk (toplam hesaplanamadı)`, e.complete ? 'ok' : 'warn', { 'data-testid': 'pw-calc-total', 'data-complete': String(e.complete) }), ...(e.totalQualityMinutes != null ? [chip(`Kalite muayene yükü ${fmt(e.totalQualityMinutes)} dk · CNC ile paralel`, 'info', { 'data-testid': 'pw-calc-quality-total' })] : []), E('span', { class: 'mut' }, `${q} adet · henüz kaydedilmedi`)),
                    missing.length ? E('div', { class: 'banner bad', style: 'margin-top:8px' }, `Hesaplanamayan operasyon: ${missing.map((m) => m.opCode ?? `OP${m.opNo}`).join(', ')} — hazırlık veya çevrim standardı girilmemiş. Sonuç 0 kabul edilmedi.`) : null,
                    E('div', { class: 'rows', style: 'margin-top:8px' }, E('div', { class: 'r hd calcg' }, E('span', {}, 'Operasyon'), E('span', {}, 'Hazırlık'), E('span', {}, 'CNC çevrimi'), E('span', {}, 'Kalite (paralel)'), E('span', {}, 'Makine süresi'), E('span', {}, 'Kullanılan parametre sürümü')), ...ops.map(row)),
                    E('div', { class: 'mut', style: 'margin-top:6px' }, String(e.formula ?? ''))].filter(Boolean));
            }
            catch (e) {
                fail(e);
            }
        };
        const saveCalc = async () => { try {
            await api.runCalc(rev.id, Number(val(qty)), null);
            await reload('Hesap kaydedildi (değişmez kayıt).', 'ok', { qty: Number(val(qty)) });
        }
        catch (e) {
            fail(e);
        } };
        const reeval = async (runId) => { const why = val(creason).trim(); try {
            const r = await api.reevaluate(runId, why);
            await reload(`Hesap yenilendi: ${changeText(r.oldTotalMinutes, r.newTotalMinutes, 'dk')}. Eski kayıt silinmedi.`);
        }
        catch (e) {
            fail(e);
        } };
        const hasStale = ws.calculations.some((c) => c.state === 'STALE') && can.editRouting;
        const calcCard = card({ title: 'Süre hesabı', testid: 'pw-card-calc', span: 7, id: 'card-calc' }, rev ? E('div', { class: 'row', style: 'align-items:flex-end' }, E('div', { style: 'width:120px' }, field('Adet', qty)), btn('ghost', 'pw-calc-run', 'Hesapla', () => void doEstimate()), can.editRouting ? btn('primary', 'pw-calc-save', 'Hesabı kaydet', () => void saveCalc()) : null) : null, E('div', { class: 'mut', style: 'margin-top:6px' }, 'Makine süresi = hazırlık (parti başına bir kez) + adet × CNC çevrimi. Kalite muayenesi CNC ile paralel yürür: ayrı iş yükü olarak gösterilir, makine süresine eklenmez. “Hesapla” yalnız gösterir; “Hesabı kaydet” değişmez kayıt oluşturur. Eksik standart VERİ YOK sayılır, 0 yazılmaz.'), out, ws.calculations.length ? E('div', { style: 'margin-top:14px' }, h('h3', {}, 'Önceki kayıtlı hesaplar'), hasStale ? E('div', { style: 'margin-bottom:8px' }, field('Yeniden değerlendirme gerekçesi', creason), E('div', { class: 'mut', 'data-testid': 'pw-calc-stale-note' }, 'Eskimiş kayıt: standart değişti ya da kayıt eski hesap yöntemiyle (muayene çevrime ekli) yapılmış. Yeniden değerlendirme YENİ kayıt yazar; eski kayıt silinmez ve değişmez.')) : null, E('div', { class: 'rows' }, ...ws.calculations.map((c) => E('div', { class: 'r prevg', 'data-testid': 'pw-calc-row', 'data-state': c.state ?? '' }, chip(CALC_TR[c.state ?? ''] ?? '—', CALC_TONE[c.state ?? ''] ?? ''), E('span', {}, `${c.qty} adet`), E('b', {}, c.complete ? `${fmt(c.totalMinutes)} dk` : 'EKSİK'), E('span', { class: 'mut' }, when(c.computedAt)), E('div', { class: 'acts' }, c.state === 'STALE' && can.editRouting ? btn('primary sm', 'pw-calc-reeval', 'Yeniden değerlendir', () => void reeval(c.runId)) : null))))) : E('div', { class: 'mut', style: 'margin-top:12px' }, 'Henüz kayıtlı hesap yok.'));
        // ---------------------------------------------------------------------------------------- kimlik
        const idCard = card({ title: 'Kimlik', testid: 'pw-card-identity', span: 12, chip: stateChip((rev?.state ?? 'MISSING')), actions: [h('a', { class: 'btn ghost sm', href: `#/urun-master?urun=${ws.product.id}` }, 'Pasaport / QR / hazırlık')] }, E('div', { class: 'kv' }, kvItem('Kod', ws.product.code), kvItem('Ad', ws.product.name), kvItem('Aile', ws.product.family), kvItem('Malzeme', ws.product.material), kvItem('Durum', ws.product.status), kvItem('Revizyon', rev ? `Rev ${rev.revision} · ${REV_TR[rev.status]}` : null), ...(ws.product.customerName ? [kvItem('Müşteri', ws.product.customerName), kvItem('Müşteri parça no', ws.product.customerPartNo ?? null)] : [])));
        // ---------------------------------------------------------------------------------------- BOM
        const bomEditable = !!(can.manageBom && rev?.status === 'DRAFT');
        let bomBusy = false;
        const bomHost = E('div');
        const barHost = E('div');
        let bomMode = null;
        // existing bar specs of this revision (for prefilling the form and for the row text); read once, nothing is invented when 0138 is not installed
        let specs = [];
        const specOf = (code) => specs.find((x) => x.materialCode.toUpperCase() === code.toUpperCase());
        const PILOT_REF = { 'Y150NSM01-F': { material: '4140', dia: 40, bar: 6000, cut: 160 } };
        const bomPanel = () => {
            if (!bomMode)
                return null;
            const m = bomMode;
            const cur = m.kind === 'add' ? null : ws.bom.find((b) => b.materialCode === m.code) ?? null;
            const sp = cur ? specOf(cur.materialCode) : undefined;
            const pilot = PILOT_REF[ws.product.code];
            const fmtIn = (v) => (v == null ? '' : String(v).replace('.', ','));
            const reason = reasonBox('pw-bom-reason', m.kind === 'remove' ? 'Neden kaldırılıyor?' : 'Değişiklik notu');
            const type = h('select', { 'data-testid': 'pw-bom-type', 'aria-label': 'Hammadde tipi' }, h('option', { value: 'BAR' }, 'Yuvarlak dolu çubuk (çap · boy · kesim)'), h('option', { value: 'OTHER' }, 'Levha / döküm / hazır parça (yalnız miktar)'));
            type.value = cur && !sp && cur.materialCode.trim().toUpperCase() !== (ws.product.material ?? '').trim().toUpperCase() ? 'OTHER' : 'BAR'; // the product-card material is normally the bar stock; any other legacy line stays a plain quantity line until the person chooses otherwise
            const mats = [...new Set([ws.product.material, ...ws.bom.map((b) => b.materialCode)].filter((x) => !!x && x.trim().length >= 2))];
            const dl = h('datalist', { id: 'pw-bom-mats' }, ...mats.map((x) => h('option', { value: x })));
            const code = h('input', { 'data-testid': 'pw-bom-code', list: 'pw-bom-mats', autocomplete: 'off', placeholder: mats[0] ? `ör. ${mats[0]}` : 'Malzeme (ör. 4140)', value: cur?.materialCode ?? (m.kind === 'add' && !ws.bom.length ? ws.product.material ?? '' : ''), disabled: m.kind !== 'add' });
            const q = h('input', { 'data-testid': 'pw-bom-qty', inputmode: 'decimal', placeholder: 'ör. 1,15', value: cur ? String(cur.qtyPerUnit) : '1' });
            const sc = h('input', { 'data-testid': 'pw-bom-scrap', inputmode: 'decimal', placeholder: '0', value: cur ? String(cur.scrapAllowancePct ?? 0) : '0' });
            const dia = h('input', { 'data-testid': 'pw-bom-dia', inputmode: 'decimal', placeholder: 'Çap mm', value: fmtIn(sp?.diaMm) });
            const bar = h('input', { 'data-testid': 'pw-bom-len', inputmode: 'decimal', placeholder: 'Standart çubuk boyu mm', value: fmtIn(sp?.barLengthMm) });
            const cut = h('input', { 'data-testid': 'pw-bom-cut', inputmode: 'decimal', placeholder: 'Kesim / ham parça boyu mm', value: fmtIn(sp?.cutLengthMm) });
            const kerf = h('input', { 'data-testid': 'pw-bom-kerf', inputmode: 'decimal', placeholder: '0,9 (KMI varsayılanı)', value: sp && sp.kerfSource === 'EXCEPTION' ? fmtIn(sp.kerfMm) : '' });
            const kerfWhy = h('input', { 'data-testid': 'pw-bom-kerf-reason', placeholder: 'Varsayılandan farklıysa neden?', value: sp?.kerfReason ?? '' });
            const den = h('input', { 'data-testid': 'pw-bom-den', inputmode: 'decimal', placeholder: '7,85 (çelik varsayılanı)', value: sp && sp.densitySource === 'SPEC' ? fmtIn(sp.densityGCm3) : '' });
            const pq = h('input', { 'data-testid': 'pw-bom-prevqty', inputmode: 'numeric', value: '37', 'aria-label': 'Önizleme adedi' });
            const prev = E('div', { 'data-testid': 'pw-bom-preview', class: 'mut' });
            const setReasonDefault = () => { if (!val(reason).trim() || reason.dataset['auto'] === '1') {
                reason.value = m.kind === 'remove' ? '' : `BOM: ${val(code).trim() || 'malzeme'} ${type.value === 'BAR' ? 'çubuk hammadde tanımı' : 'satırı'} ${cur ? 'güncellendi' : 'tanımlandı'}`;
                reason.dataset['auto'] = '1';
            } };
            reason.addEventListener('input', () => { reason.dataset['auto'] = '0'; });
            const barBox = E('div', { 'data-testid': 'pw-bom-barbox' });
            const refresh = () => {
                const bar1 = type.value === 'BAR';
                barBox.style.display = bar1 ? '' : 'none';
                qFld.style.display = bar1 ? 'none' : '';
                const d = num(val(dia)), b = num(val(bar)), c = num(val(cut)), k = num(val(kerf)), de = num(val(den)), n = num(val(pq));
                if (!bar1) {
                    prev.replaceChildren();
                    setReasonDefault();
                    return;
                }
                const plan = d && b && c && n ? barPlanPreview({ barMm: b, cutMm: c, kerfMm: k ?? DEFAULT_KERF_MM, diaMm: d, densityGCm3: de ?? DEFAULT_STEEL_DENSITY, qty: n }) : null;
                prev.replaceChildren(!plan ? 'Çap, çubuk boyu ve kesim boyunu girince hesap burada görünür.' : plan.barsNeeded === null ? 'Kesim boyu + testere payı çubuğa sığmıyor — kayıt edilemez.' :
                    E('div', { 'data-testid': 'pw-bom-preview-text' }, E('b', {}, `${plan.piecesPerBar} parça/çubuk · ${fmt(n)} adet için ${plan.barsNeeded} çubuk`), ` · artan ${plan.sparePieces} parça · kullanılan malzeme ${fmtMm(plan.usedMm)} mm · toplam kalan ${fmtMm(plan.leftoverMmTotal)} mm (çubuk başına ${fmtMm(plan.remainderMmPerBar)} mm) · ham parça ${fmtMm(plan.pieceMassG)} g. Önizlemedir: kayıttan sonra sunucu hesabıyla gösterilir; stok ayrılmaz.`));
                setReasonDefault();
            };
            const qFld = E('div', {}, field('Miktar (ürün başına)', q));
            for (const el of [type, code, dia, bar, cut, kerf, den, pq]) {
                el.addEventListener('input', refresh);
                el.addEventListener('change', refresh);
            }
            barBox.append(E('div', { class: 'fgrid' }, field('Çap (mm)', dia), field('Standart çubuk boyu (mm)', bar), field('Kesim / ham parça boyu (mm)', cut)), ...(pilot && !sp && m.kind === 'add' ? [E('div', { class: 'row', 'data-testid': 'pw-bom-pilot' }, E('span', { class: 'mut' }, `Pilot referansı (henüz kayıtlı değil): ${pilot.material} · Ø${pilot.dia} · ${pilot.bar} mm çubuk · ${pilot.cut} mm kesim.`), btn('ghost sm', 'pw-bom-pilot-fill', 'Forma al', () => { code.value = code.value || pilot.material; dia.value = String(pilot.dia); bar.value = String(pilot.bar); cut.value = String(pilot.cut); refresh(); }))] : []), E('div', { class: 'row', style: 'align-items:flex-end' }, field('Önizleme adedi', pq)), prev, fold('İleri düzey: testere payı, yoğunluk', [E('div', { class: 'fgrid' }, field('Testere payı (mm)', kerf, 'Boş = KMI varsayılanı 0,9 mm'), field('Farklıysa neden', kerfWhy), field('Yoğunluk (g/cm³)', den, 'Boş = çelik varsayılanı (ölçülmüş değer değildir)'))]));
            const submit = async () => {
                const qv = num(val(q));
                const sv = num(val(sc));
                const missing = [];
                const bar1 = type.value === 'BAR' && m.kind !== 'remove';
                for (const el of [code, q, sc, reason, dia, bar, cut])
                    invalid(el, false);
                if (m.kind === 'add' && !val(code).trim()) {
                    invalid(code, true);
                    missing.push('Malzeme');
                }
                if (m.kind !== 'remove') {
                    if (!bar1 && (qv === null || qv <= 0)) {
                        invalid(q, true);
                        missing.push('Miktar (0’dan büyük sayı)');
                    }
                    if (sv === null || sv < 0 || sv > 100) {
                        invalid(sc, true);
                        missing.push('Fire % (0–100)');
                    }
                    if (bar1)
                        for (const [el, nm] of [[dia, 'Çap'], [bar, 'Standart çubuk boyu'], [cut, 'Kesim boyu']]) {
                            const v = num(val(el));
                            if (v === null || v <= 0) {
                                invalid(el, true);
                                missing.push(`${nm} (mm, 0’dan büyük)`);
                            }
                        }
                }
                if (val(reason).trim().length < 10) {
                    invalid(reason, true);
                    missing.push('Değişiklik notu (en az 10 karakter)');
                }
                if (missing.length)
                    return fail(new Error(`Eksik veya hatalı alan: ${missing.join(', ')}.`));
                if (bomBusy)
                    return;
                bomBusy = true;
                const noChange = (e) => /NO_CHANGE/.test(String(e?.message ?? e));
                try {
                    if (m.kind === 'remove') {
                        await api.removeBomLine(rev.id, m.code, val(reason).trim());
                        await reload(`BOM satırı kaldırıldı: ${m.code} (geçmişte kalır).`);
                        return;
                    }
                    const c = m.kind === 'add' ? val(code).trim() : m.code;
                    let created = false;
                    // ONE save: the canonical BOM line (one record per material, never a second recipe) + its bar definition. Saving the same values again changes nothing (no duplicate line).
                    try {
                        const r = await api.saveBomLine(rev.id, c, bar1 ? (cur?.qtyPerUnit ?? 1) : qv, sv, val(reason).trim());
                        created = r.created;
                    }
                    catch (e) {
                        if (!noChange(e))
                            throw e;
                    }
                    if (bar1) {
                        const k = num(val(kerf)), de = num(val(den));
                        await api.barSpecSave(rev.id, c, num(val(dia)), num(val(bar)), num(val(cut)), k, k === null ? null : val(kerfWhy).trim() || null, de, val(reason).trim());
                    }
                    await reload(bar1 ? `BOM taslağı kaydedildi: ${c} · çubuk tanımı güncel. Stok ayrılmadı.` : created ? `BOM satırı eklendi: ${c} ${fmt(qv)} /adet.` : `BOM satırı güncellendi: ${c} — adet ${changeText(cur?.qtyPerUnit, qv)}, fire % ${changeText(cur?.scrapAllowancePct, sv)}.`);
                }
                catch (e) {
                    fail(e);
                }
                finally {
                    bomBusy = false;
                }
            };
            queueMicrotask(refresh);
            return E('div', { class: 'formbox', 'data-testid': 'pw-bom-form' }, E('b', {}, m.kind === 'add' ? 'Yeni BOM satırı' : m.kind === 'edit' ? `Satırı düzenle: ${m.code}` : `Satırı kaldır: ${m.code}`), E('div', { class: 'mut', 'data-testid': 'pw-bom-ctx' }, `${ws.product.code} · ${rev ? `Rev ${rev.revision} · ${REV_TR[rev.status]}` : ''}${ws.product.material ? ` · ürün kartı malzemesi: ${ws.product.material}` : ''}. Stok eşleşmesi bu ekranda doğrulanmaz; stok ayrılmaz.`), m.kind === 'remove' ? E('div', { class: 'mut' }, 'Satır taslak revizyondan kaldırılır; değişiklik geçmişte kalır.') : E('div', {}, dl, E('div', { class: 'fgrid' }, field('Malzeme', code, mats.length ? 'Ürün kartındaki malzeme önerilir; başka malzeme de yazılabilir.' : undefined), field('Hammadde tipi', type), field('Fire % (isteğe bağlı)', sc)), qFld, barBox), field('Değişiklik notu', reason, 'Kayıt ürün geçmişine yazılır; hazır bir not önerilir, isterseniz değiştirin.'), E('div', { class: 'row' }, btn(m.kind === 'remove' ? 'danger' : 'primary', m.kind === 'add' ? 'pw-bom-add' : m.kind === 'edit' ? 'pw-bom-row-save' : 'pw-bom-row-del', m.kind === 'remove' ? 'Kaldır' : 'BOM taslağını kaydet', () => void submit()), btn('ghost', null, 'Vazgeç', () => { bomMode = null; drawBom(); })));
        };
        function drawBom() {
            const revTone = (rev ? { DRAFT: 'info', RELEASED: 'ok', OBSOLETE: 'off' }[rev.status] : '') ?? '';
            bomHost.replaceChildren(...[
                ws.bom.length ? E('div', { class: 'rows' }, E('div', { class: 'r hd bomg' }, E('span', {}, 'Malzeme kodu'), E('span', {}, 'Miktar / ürün'), E('span', {}, 'Fire %'), E('span', {}, 'Durum'), E('span', { class: 'acts' }, bomEditable ? 'İşlem' : '')), ...ws.bom.map((b) => E('div', { class: 'r bomg', 'data-testid': 'pw-bom-row', 'data-code': b.materialCode }, E('b', {}, b.materialCode), E('span', { class: 'num' }, lbl('Miktar', ''), specOf(b.materialCode) ? `Ø${fmtMm(specOf(b.materialCode).diaMm)} çubuk · ${specOf(b.materialCode).plan.piecesPerBar} parça/çubuk` : `${fmt(b.qtyPerUnit)} adet/ürün`), E('span', { class: 'num' }, lbl('Fire', ''), b.scrapAllowancePct != null ? `%${fmt(b.scrapAllowancePct)}` : NA), E('span', {}, chip(rev ? REV_TR[rev.status] ?? rev.status : '—', revTone)), E('div', { class: 'acts' }, bomEditable ? [btn('ghost sm', 'pw-bom-row-edit', 'Düzenle', () => { bomMode = { kind: 'edit', code: b.materialCode }; drawBom(); }), btn('danger sm', 'pw-bom-row-remove', 'Kaldır', () => { bomMode = { kind: 'remove', code: b.materialCode }; drawBom(); })] : null))))
                    : emptyState(`${NA} — bu revizyonda BOM yok`, bomEditable ? '“+ Satır ekle” ile ilk malzemeyi tanımlayın. Eksik kalırsa ürün hazırlığı tamamlanmış sayılmaz.' : 'BOM, taslak revizyonda tanımlanır.'),
                bomPanel(), bomEditable ? null : E('div', { class: 'mut', 'data-testid': 'pw-bom-note', style: 'margin-top:10px' }, !can.manageBom ? 'BOM düzenleme yetkiniz yok.' : rev?.status === 'RELEASED' ? 'Yürürlükteki revizyonun BOM’u teknik veridir: değişiklik için yeni (taslak) revizyon açın — kaynak aynı BOM’dur, ikinci reçete oluşmaz.' : '')
            ].filter(Boolean));
        }
        const bomCard = card({ title: 'BOM', testid: 'pw-card-bom', span: 12, id: 'card-bom', chip: stateChip(ws.bom.length ? (rev?.state ?? 'MISSING') : 'MISSING'), actions: [bomEditable && !bomMode ? btn('primary sm', 'pw-bom-open-add', '+ Satır ekle', () => { bomMode = { kind: 'add' }; drawBom(); }) : null] }, bomHost, barHost, E('div', { class: 'kx-foot' }, h('a', { href: `#/urun-master?urun=${ws.product.id}` }, 'Yeni revizyon / BOM taslağı / yayın: Ürün Master')));
        drawBom();
        if (rev && ws.bom.length) {
            void drawBarStock(barHost, api, rev.id, ws.bom.map((b) => b.materialCode), false, reload, fail);
            void api.barNeed(rev.id, 1).then((r) => { specs = r.lines; drawBom(); }).catch(() => { });
        }
        // satır ekleme düğmesi panel açıkken gizlenmez: panel kapanınca kart başlığı yeniden çizilmez; düğme her zaman çalışır
        const bomAdd = bomCard.querySelector('[data-testid="pw-bom-open-add"]');
        bomAdd?.addEventListener('click', () => scrollTo(bomHost));
        // ---------------------------------------------------------------------------------------- kalite planı
        const qualityCard = card({ title: 'Kalite planı', testid: 'pw-card-quality', span: 5, id: 'card-quality', chip: stateChip(ws.quality.length ? (rev?.state ?? 'MISSING') : 'MISSING') }, ws.quality.length ? E('div', { class: 'rows' }, ...ws.quality.map((q) => {
            const linked = ws.routing.flatMap((o) => o.qcPoints.filter((p) => p.controlPlanId === q.id).map((p) => `${o.opCode} KN${p.pointNo}`));
            return E('div', { class: 'r', style: 'grid-template-columns:minmax(0,1fr) auto', 'data-testid': 'pw-plan', 'data-linked': String(linked.length) }, E('div', {}, E('b', {}, q.operationNo != null ? `OP${q.operationNo}` : 'Genel'), ` · v${q.version} · ${q.status}`, E('div', { class: 'mut' }, `${q.characteristics} karakteristik`)), chip(linked.length ? `Bağlı: ${linked.join(', ')}` : 'Operasyona bağlı değil', linked.length ? 'ok' : 'warn'));
        })) : emptyState(`${NA} — kontrol planı yok`, 'Kontrol planı Kalite’de hazırlanır.'), (() => { const miss = ws.routing.filter((o) => o.qcPoints.length === 0).map((o) => o.opCode); return miss.length ? E('div', { class: 'banner', 'data-testid': 'pw-quality-missing' }, `Kalite noktası eksik: ${miss.join(', ')} — operasyonu açıp mevcut kontrol planından bir nokta bağlayın.`) : E('div', { class: 'mut', 'data-testid': 'pw-quality-missing' }, 'Tüm operasyonların kalite noktası bağlı.'); })(), E('div', { class: 'mut', style: 'margin-top:10px' }, 'Plan kaynağı Kalite’dir; burada yalnız mevcut plan, operasyonun kalite noktasına bağlanır (yeni kalite verisi oluşmaz). Bağlama: operasyonu açın → Kalite kontrol noktaları.'), E('div', { class: 'kx-foot' }, h('a', { href: '#/kalite' }, 'Kontrol planı düzenleme: Kalite')));
        // ---------------------------------------------------------------------------------------- parametreler
        const editOk = can.editRouting && editable;
        const pCell = (o, p, value, from, ver) => {
            const since = E('span', { class: 'mut', 'data-testid': 'pw-param-from' }, from ? `${from}${ver ? ` · v${ver}` : ''}` : (value === null ? 'geçerlilik: yok' : '…'));
            if (p.code === 'OP_INSPECTION_SEC' && value !== null)
                void api.parameterHistory(p.code, o.id).then((ph) => { const v = ph.versions.find((x) => x.inForce); since.textContent = v ? `${v.validFrom} itibarıyla · v${v.versionNo}` : '—'; }).catch(() => { since.textContent = '—'; });
            return E('div', { class: 'pcell', 'data-testid': 'pw-param-line', 'data-op': o.opCode, 'data-param': p.code }, E('span', { class: 'cl' }, p.name), E('b', { class: 'num' }, value === null ? NA : `${fmt(value)} ${p.unit}`), since, btn('linkbtn sm', `pw-param-hist-${o.opCode}-${p.code}`, 'Geçmiş', () => void showParam(o, p.code)));
        };
        const paramCard = card({ title: 'Parametreler (operasyon bazlı)', testid: 'pw-card-params', span: 12, id: 'card-params' }, activeOps.length ? E('div', { class: 'rows' }, E('div', { class: 'r hd parg' }, E('span', {}, 'Operasyon'), ...PARAMS.map((p) => E('span', {}, `${p.name} · ${p.src}`)), E('span', { class: 'acts' }, 'İşlem')), ...activeOps.map((o) => E('div', { class: 'r parg', 'data-testid': 'pw-param-op', 'data-op': o.opCode }, E('span', {}, E('b', {}, o.opCode), ' ', o.name), pCell(o, PARAMS[0], o.setupMinutes, o.setupValidFrom, o.setupVersion), pCell(o, PARAMS[1], o.cycleSeconds, o.cycleValidFrom, o.cycleVersion), pCell(o, PARAMS[2], o.inspectionSeconds, null, null), E('div', { class: 'acts' }, editOk ? btn('ghost sm', `pw-param-edit-${o.opCode}`, 'Düzenle', () => { openOp = o.id; drawOps(); scrollTo(opsHost.querySelector(`[data-op-id="${o.id}"]`)); }) : null))))
            : emptyState(`${NA} — aktif operasyon yok`, 'Parametreler operasyonlar tanımlanınca burada görünür.'), paramHistHost, E('div', { class: 'mut', style: 'margin-top:10px' }, 'Bu değerler operasyon bazlıdır; ürün geneli için tek değer yoktur. Her değişiklikte kaynak, gerekçe, zaman ve sürüm saklanır; geçmişe dönük değişmez. Eski hesaplar kendi parametre sürümüyle kalır, yeni hesaplar yürürlükteki değeri kullanır.'), can.editRouting ? E('div', { style: 'margin-top:10px' }, fold('Teknik ayrıntı (yetkili)', ws.parameterDefs.map((d) => E('div', { 'data-testid': 'pw-param-def', 'data-code': d.code, class: 'mut', style: 'margin:6px 0' }, E('b', {}, `${d.name} (${d.unit})`), ' ', chip(d.changeClass === 'TECHNICAL' ? 'Teknik: revizyon+onay' : 'Operasyonel', d.changeClass === 'TECHNICAL' ? 'warn' : ''), E('div', {}, `Sahip: ${OWNER_TR[d.ownerDomain] ?? d.ownerDomain} · Kaynak alanı: ${d.canonicalSource}${d.min != null || d.max != null ? ` · aralık ${fmt(d.min)}–${fmt(d.max)}` : ''}`))), false, 'pw-param-tech')) : null);
        const histCard = card({ title: 'Değişiklik geçmişi', testid: 'pw-card-history', span: 12, id: 'card-history' }, E('div', { class: 'row', style: 'justify-content:space-between' }, E('span', { class: 'mut' }, 'Revizyon, doküman, operasyon ve parametre değişiklikleri ürünün olay kaydında tutulur.'), h('a', { class: 'btn ghost sm', href: `#/urun-master?urun=${ws.product.id}&sekme=gecmis` }, 'Olay kaydını aç')));
        // ---------------------------------------------------------------------------------------- üst bölüm: başlık, hazırlık özeti, ana işlemler
        const docState = (c) => (c?.state ?? 'MISSING');
        const rs = (rev?.state ?? 'MISSING');
        const ready = [
            { label: 'Teknik resim', st: docState(ws.cards.drawing), target: 'drawing' }, { label: 'CAD/STEP', st: docState(ws.cards.cad), target: 'cad' }, { label: 'CAM/NC', st: docState(ws.cards.cam), target: 'cam' }, { label: 'Takım listesi', st: docState(ws.cards.tools), target: 'tools' },
            { label: 'BOM', st: ws.bom.length ? rs : 'MISSING', target: 'bom' }, { label: 'Rota', st: ws.routing.length ? rs : 'MISSING', target: 'routing' }, { label: 'Kalite planı', st: ws.quality.length ? rs : 'MISSING', target: 'quality' }
        ];
        const missingN = ready.filter((r) => r.st === 'MISSING');
        const orderHost = E('div', { style: 'margin-top:8px' });
        const readyCard = card({ title: 'Hazırlık özeti', testid: 'pw-ready', span: 12, tone: missingN.length ? 'warn' : 'ok', chip: chip(missingN.length ? `${missingN.length} eksik` : 'Temel veriler tanımlı', missingN.length ? 'warn' : 'ok') }, E('div', { class: 'ready' }, ...ready.map((r) => E('button', { type: 'button', class: STATE_TONE[r.st], 'data-testid': `pw-ready-${r.target}`, 'data-state': r.st, onClick: () => scrollTo(container.querySelector(`[data-testid="pw-card-${r.target}"]`)) }, E('span', { class: 'dot' }), `${r.label}: ${CARD_STATE_TR[r.st]}`))), missingN.length ? E('div', { class: 'mut', style: 'margin-top:8px' }, `Eksik veri: ${missingN.map((m) => m.label).join(', ')}. Eksik değerler 0 sayılmaz; üretime hazırlık için tamamlanmalıdır.`) : null, orderHost);
        const head = E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, E('div', { class: 'crumb' }, btn('', 'pw-back', '← Ürünler', () => void go({}))), E('h1', { title: `${ws.product.code} — ${ws.product.name}` }, E('span', { class: 'head-name' }, `${ws.product.code} — ${ws.product.name}`)), E('div', { class: 'row', style: 'gap:6px' }, rev ? stateChip(rev.state) : null, E('span', { class: 'mut' }, can.editRouting ? 'Düzenleme yetkiniz var' : 'Yalnız görüntüleme'))), E('div', { class: 'acts' }, E('div', { style: 'min-width:180px' }, revSel), h('a', { class: 'btn ghost', href: '#/dokuman-kontrol' }, 'Doküman Kontrol'), h('a', { class: 'btn ghost', href: `#/urun-master?urun=${ws.product.id}` }, 'Ürün Master'), can.editStructure ? btn('primary', 'pw-top-op-add', '+ Operasyon', () => { addOp(); scrollTo(container.querySelector('[data-testid="pw-card-routing"]')); }) : null));
        if (state.only) {
            const all = { identity: idCard, drawing: docCard('drawing', 'Teknik resim', ws.cards.drawing, 'DRAWING'), cad: docCard('cad', 'CAD / STEP', ws.cards.cad, 'CAD_MODEL'), cam: docCard('cam', 'CAM / NC', ws.cards.cam, 'NC_PROGRAM', true), tools: docCard('tools', 'Takım listesi', ws.cards.tools, 'TOOL_LIST'),
                bom: bomCard, routing: routingCard, params: paramCard, quality: qualityCard, calc: calcCard, history: histCard, ready: readyCard };
            shell(banner, noRevBox, E('div', { class: 'row', style: 'margin-bottom:10px' }, E('div', { style: 'min-width:180px' }, revSel)), E('div', { class: 'kx-grid' }, ...state.only.map((k) => all[k]).filter((x) => !!x)));
            return;
        }
        shell(head, banner, noRevBox, readyCard, E('div', { style: 'height:14px' }), E('div', { class: 'kx-grid' }, idCard, // 1 Teknik belgeler → 2 Operasyonlar ve CAM/NC → 3 Takım listesi → 4 Hammadde/BOM → 5 Kalite planı → 6 Süre ve kapasite
        docCard('drawing', 'Teknik resim', ws.cards.drawing, 'DRAWING'), docCard('cad', 'CAD / STEP', ws.cards.cad, 'CAD_MODEL'), routingCard, docCard('cam', 'CAM / NC', ws.cards.cam, 'NC_PROGRAM', true), docCard('tools', 'Takım listesi', ws.cards.tools, 'TOOL_LIST'), bomCard, qualityCard, calcCard, paramCard, histCard));
        if (state.openOp && state.openOp !== 'NEW')
            scrollTo(opsHost.querySelector(`[data-op-id="${state.openOp}"]`));
    }
}
