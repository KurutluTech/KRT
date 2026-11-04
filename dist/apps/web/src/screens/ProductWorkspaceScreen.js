// KMI-011 — Ürün Çalışma Alanı: ürün pasaportu + mühendislik kartları (kimlik, resim, CAD, CAM/NC, takım, BOM, rota/operasyon, parametre, kalite, hesap, geçmiş).
// UX/UI turu: ortak `kx` tasarım standardı (kart, buton, input, rozet), özet üst bölüm, açılır düzenleme panelleri, dosya işlemleri (aç/önizle/indir/yeni sürüm/geçmiş), kompakt BOM tablosu,
// okunur operasyon satırları, anlaşılır parametre kartı ve gerçek süre hesabı ekranı. Veri kaynakları ve sunucu kuralları DEĞİŞMEDİ: yetki, revizyon sınıfı, geçerlilik, hesap durumu SUNUCUDA.
// ONE FACT → ONE SOURCE: kartlar kanonik kaynakları gösterir/düzenler; bağımsız kopya yok. Boş değer 0 yazılmaz (VERİ YOK). Gerçek üretim ölçümü bu ekrandan değiştirilemez.
import { rememberProduct } from '../lastProduct.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { CARD_STATE_TR, changeText } from '../../../../packages/domain/src/parameters.js';
import { isSimpleDocType } from '../documentControlApi.js';
import { bytesToHex } from '../../../../packages/domain/src/documents.js';
import { guessMime } from './DocumentsScreen.js';
import { errorText } from '../errorText.js';
import { chainChips, chainGapText, drawChainPanel, orderReadiness, sanitizeChainOp, safeChain } from './productChainPanel.js';
import { buildOpWorkCard, autoWhy } from './opWorkCard.js';
import { buildEngineeringPanel, ENG_CSS } from './opEngineering.js';
import { drawToolistWork } from './toolistWorkPanel.js';
import { drawControlPlan } from './controlPlanPanel.js';
import { nextText } from '../stageText.js';
import { drawToolistMap } from './toolistMapPanel.js';
import { drawPrepFlow, PREP_CSS } from './prepFlowPanel.js';
import { drawBarStock, fmtMm } from './barStockPanel.js';
import { drawRouteChanges } from './routeChangePanel.js';
import { drawOpPrep } from './opPrepPanel.js';
import { drawCutMethod } from './cutMethodPanel.js';
import { drawOpBoxes, isCutPrep, movableOps, opLabel, fixCutPrepText } from './opBoxes.js';
import { barPlanPreview, DEFAULT_KERF_MM, DEFAULT_STEEL_DENSITY } from '../../../../packages/domain/src/barStock.js';
import { KX_CSS, NA, card, chip, emptyState, field, fmt, fold, fromBase64, invalid, isChecked, kvItem, showFile, toBase64, val, when } from '../kx.js';
const PW_CSS = ENG_CSS + `
.pw .opc{border:1px solid #1e293b;border-radius:12px;background:#0b1220;margin-top:8px;min-width:0}.pw .opc.open{border-color:#1d4ed8}.pw .opc.off{opacity:.65}
.pw .opr{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:10px 12px;min-width:0}
.pw .opr>*{min-width:0;overflow-wrap:anywhere}.pw .opr .code{font-weight:800;color:#fff;flex:0 0 auto;min-width:64px}.pw .opr .nm{font-weight:600;color:#fff;line-height:1.35;flex:1 1 220px;overflow-wrap:anywhere;hyphens:manual}.pw .opr .num{font-variant-numeric:tabular-nums;white-space:nowrap;flex:0 0 auto}
.pw .opr .c-machine,.pw .opr .c-cam{flex:0 1 150px}.pw .oph{display:none}.pw .cl{display:inline;font-size:11px;color:#94a3b8;margin-right:4px}
.pw .opr .acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;align-items:center}
.pw details.more{position:relative}.pw details.more>summary{list-style:none;cursor:pointer;min-height:32px;padding:0 10px;display:inline-flex;align-items:center;border:1px solid #334155;border-radius:8px}.pw details.more>summary::-webkit-details-marker{display:none}
.pw .moremenu{position:absolute;right:0;top:100%;z-index:5;margin-top:4px;padding:6px;background:#0b1220;border:1px solid #334155;border-radius:10px;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
@media (max-width:640px){.pw .opr .nm,.pw .opr .c-machine,.pw .opr .c-cam{flex:1 1 100%}.pw .opr .acts{margin-left:0;justify-content:flex-start;width:100%}.pw .moremenu{left:0;right:auto}}
.pw .opx{padding:0 12px 10px;display:flex;flex-direction:column;gap:6px}.pw .opx .l{font-size:12px;color:#94a3b8;display:flex;flex-wrap:wrap;gap:4px 14px}.pw .opx .l b{color:#cbd5e1}
.pw .opb{border-top:1px solid #1e293b;padding:12px}
.pw .owc{display:flex;flex-direction:column;gap:10px;max-width:980px}.pw .owc-sec>summary{cursor:pointer;font-weight:700;color:#e2e8f0;padding:4px 0}.pw .owc-body{display:flex;flex-direction:column;gap:10px;padding-top:6px}
.pw .owc .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.pw .owc-bar{position:sticky;bottom:0;background:#0b1220;padding:8px 0;justify-content:flex-end;z-index:2}
.pw .owc .chip{white-space:normal;max-width:100%;overflow-wrap:anywhere;text-align:left;line-height:1.3}.pw .owc,.pw .owc *{min-width:0}.pw .owc-chip button{min-height:20px;padding:0 4px}.pw .owc-cand{border:1px solid #1e293b;border-radius:8px;padding:6px 8px}@media (max-width:600px){.pw .owc .fgrid{grid-template-columns:1fr}.pw .owc-cand{flex-direction:column;align-items:stretch}}
.pw .opx .chip,.pw [data-testid="pw-chain"] .chip{white-space:normal;max-width:100%;text-align:left;line-height:1.3;overflow-wrap:break-word}.pw .opr .num{white-space:nowrap}
.pw .cl{display:none;font-size:11px;color:#94a3b8;margin-right:4px}
.pw .head-name{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pw .bomg{grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto}
.pw .docg{grid-template-columns:minmax(0,1fr)}.pw .docg>*{min-width:0;max-width:100%}.pw .docg .row{flex-wrap:wrap}.pw .docg .mut,.pw .docg b,.pw .docg .stack>div{overflow-wrap:anywhere;word-break:break-word}.pw .docg .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start}
.pw .parg{grid-template-columns:minmax(0,1.3fr) repeat(3,minmax(0,1fr)) auto}
.pw .pcell{display:flex;flex-direction:column;gap:1px;align-items:flex-start}.pw .pcell .cl{display:none}.pw .pcell .linkbtn{min-height:24px;padding:0;font-size:12px}
@media (max-width:900px){.pw .pcell{flex-direction:row;flex-wrap:wrap;gap:4px 10px;align-items:center}.pw .pcell .cl{display:inline;min-width:120px}}
.pw [data-testid="pw-calc-out"] .chip,.pw .calcg .chip{white-space:normal;max-width:100%;overflow-wrap:anywhere;text-align:left;line-height:1.3}
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
const ctlLabel = (state, docType) => (isSimpleDocType(docType) ? ({ DRAFT: 'Yüklendi (geçerli değil)', EFFECTIVE: 'Geçerli', SUPERSEDED: 'Eski sürüm', REJECTED: 'İptal' }[state ?? ''] ?? '—') : (CTL_TR[state ?? ''] ?? '—'));
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
    const go = (s) => renderProductWorkspaceScreen(container, api, { ...s, ...(state.only ? { only: state.only } : {}), ...(state.canOpenOrders !== undefined ? { canOpenOrders: state.canOpenOrders } : {}) });
    const shell = (...kids) => mount(container, h('div', { class: 'kx pw', 'data-testid': 'pw-root' }, h('style', {}, KX_CSS + PW_CSS + PREP_CSS), ...kids));
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
        let skills = [];
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
        try {
            skills = (await api.skills()).filter((x) => x.active !== false);
        }
        catch {
            skills = [];
        }
        // m0211: makine yeterlilik şartları (salt okunur). Okunamazsa null = bilinmiyor; satır YOKSA = TANIMSIZ ("gerekmiyor" değildir).
        let machineReqs = null;
        try {
            machineReqs = (await api.machineSkillReqs?.()) ?? null;
        }
        catch {
            machineReqs = null;
        }
        const rev = ws.revision;
        const editable = !!rev && rev.status !== 'OBSOLETE';
        // m0181: rota yapısı (operasyon ekle/sırala/pasifle/ön koşul) DRAFT ve RELEASED revizyonda yetkili kullanıcıya açık; sunucu aynı kuralı uygular (OBSOLETE reddedilir). BOM taslak-only kalır (manageBom).
        const can = { ...ws.can, editStructure: !!(ws.can.editStructure || (ws.can.editRouting && rev && (rev.status === 'DRAFT' || rev.status === 'RELEASED'))) };
        // Ayrı nedenler: revizyon yok / revizyon kapalı / yükleme yetkisi yok / veri yok — hiçbiri "VERİ YOK" arkasına gizlenmez.
        const whyNoUpload = !rev ? 'NO_REV' : rev.status === 'OBSOLETE' ? 'CLOSED' : !can.manageDocuments ? 'NO_PERM' : null;
        const WHY_TR = { NO_REV: 'Bu ürün için revizyon yok — dosya eklemek için önce taslak revizyon açılmalı.', CLOSED: 'Revizyon kapalı (geçersiz) — yeni revizyon süreci kullanılmalı.', NO_PERM: 'Yükleme yetkiniz yok.' };
        let openOp = state.openOp ?? null;
        let opOpenHook = null;
        const reload = async (text, kind = 'ok', extra = {}) => {
            const y = window.scrollY;
            await go({ product: productId, rev: rev?.id ?? null, openOp: null, qty: state.qty, ...extra, banner: text ? { kind, text } : undefined });
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
                const simpleType = isSimpleDocType(docType);
                const needsLabel = docType === 'DRAWING';
                const canDecide = !simpleType && !!(can.approveDocument && api.docSubmit && api.docReview && api.docApprove && api.docPublish);
                const decision = canDecide ? h('select', { 'data-testid': `pw-${tid}-decision` }, h('option', { value: 'DRAFT' }, 'Yalnız yükle (TASLAK kalsın)'), h('option', { value: 'APPROVED' }, 'Yükle ve onayla (kontrol + onay, benim kararım)'), ...(docType === 'TOOL_LIST' ? [] : [h('option', { value: 'EFFECTIVE' }, 'Yükle, onayla ve yürürlüğe al (benim kararım)')])) : null;
                const label = h('input', { 'data-testid': `pw-${tid}-label`, value: rev?.revision ?? '', placeholder: 'Belgenin üzerinde yazan revizyon (ör. A)' });
                const upload = async () => {
                    const f = file.files?.[0];
                    if (!f || !rev) {
                        invalid(file, true);
                        return fail(new Error('CONTENT_REQUIRED'));
                    }
                    try {
                        const bytes = new Uint8Array(await f.arrayBuffer());
                        if (simpleType && needsLabel && !val(label).trim())
                            throw new Error('Teknik resimde belge üzerindeki revizyonu yazın (ör. A); dosya yüklenmedi.');
                        const r = await api.upload({ docType, entityType: 'PRODUCT_REVISION', entityId: rev.id, title: target ? null : ((ttl && val(ttl).trim()) || `${title} ${ws.product.code}`), fileName: f.name, mimeType: guessMime(f.name, f.type), contentBase64: toBase64(bytes), validUntil: null, note: val(note).trim() || null, documentId: target?.id ?? null });
                        if (simpleType) {
                            // m0213: sade yaşam döngüsü — dosya kimlik + zaman + SHA-256 ile mühürlenir; yetkiliyse sunucu doğrudan GEÇERLİ yapar. Ayrı onay/gerekçe adımı yok.
                            let st = await api.versionState(r.documentId, r.versionId);
                            if (st.state === 'DRAFT' && needsLabel && val(label).trim()) {
                                await api.makeEffective(r.versionId, val(label).trim());
                                st = await api.versionState(r.documentId, r.versionId);
                            }
                            const sealed = 'Yükleyen kimliği, zaman ve SHA-256 ile mühürlendi.';
                            await reload(st.state === 'EFFECTIVE'
                                ? `Yüklendi ve GEÇERLİ: sürüm ${r.versionNo}. ${sealed}${docType === 'NC_PROGRAM' ? ' CAM kaydı eski NC’den ise “CAM kaydını yeni NC’den yeniden oluştur” düğmesi çıkar.' : ''}`
                                : st.state === 'DRAFT'
                                    ? (docType === 'TOOL_LIST' ? `Yüklendi: sürüm ${r.versionNo}. Takım listesi, kritik takım doğrulaması yapılınca otomatik GEÇERLİ olur. ${sealed}`
                                        : needsLabel ? `Yüklendi: sürüm ${r.versionNo}. Revizyon bilgisi geçerli kılmayı tamamlamadı; yeni sürüm yükleyin. ${sealed}`
                                            : `Yüklendi: sürüm ${r.versionNo} — otomatik geçerli olmadı (ayrıntı Doküman Kontrol > Olaylar). ${sealed}`)
                                    : `Yüklendi: sürüm ${r.versionNo}.`);
                            return;
                        }
                        const want = decision ? val(decision) : 'DRAFT';
                        if (want === 'DRAFT' || !api.docSubmit || !api.docReview || !api.docApprove || !api.docPublish) {
                            await reload(`Yüklendi: sürüm ${r.versionNo} — TASLAK. Üretimde geçerli olması için Doküman Kontrol'den onay ve yürürlüğe alma gerekir.`);
                            return;
                        }
                        // upload-time decision: the SAME four document-control calls the Doküman Kontrol screen makes, in order, each recorded with the user's name and reason. A refusal stops the chain; what was done stays recorded.
                        const why = `${val(note).trim() || 'Yükleme anında karar'} — ${f.name} (yükleyen kendi kararı)`;
                        let done = 'yüklendi (TASLAK)';
                        try {
                            await api.docSubmit(r.versionId, why, val(label).trim() || null);
                            done = 'onaya gönderildi';
                            await api.docReview(r.versionId, why);
                            done = 'kontrol edildi';
                            await api.docApprove(r.versionId, why);
                            done = 'onaylandı';
                            if (want === 'EFFECTIVE') {
                                await api.docPublish(r.versionId, why);
                                done = 'yürürlüğe alındı';
                            }
                        }
                        catch (e) {
                            await reload(`Sürüm ${r.versionNo} ${done}; sonraki adım yapılamadı. Kalanı Doküman Kontrol'den tamamlayın.`);
                            fail(e);
                            return;
                        }
                        await reload(want === 'EFFECTIVE' ? `Yüklendi ve yürürlüğe alındı: sürüm ${r.versionNo}.${docType === 'NC_PROGRAM' ? ' CAM kaydı eski NC’den ise “CAM kaydını yeni NC’den yeniden oluştur” düğmesi çıkar.' : ''}` : `Yüklendi ve onaylandı: sürüm ${r.versionNo} (yürürlüğe alınmadı).${docType === 'TOOL_LIST' ? ' Takım listesinde yürürlük, takım verisi doğrulandıktan sonra “Yürürlüğe Al” ile yapılır.' : ''}`);
                    }
                    catch (e) {
                        fail(e);
                    }
                };
                formHost.append(E('div', { class: 'formbox' }, E('div', { class: 'mut' }, target ? `${target.docNo ?? ''} için YENİ SÜRÜM: eski sürüm silinmez (ESKİ SÜRÜM olarak saklanır); yetkiliyseniz yeni dosya doğrudan GEÇERLİ olur, ayrıca onay gerekmez.` : 'Dosya yükleyen kişinin kimliği, zamanı ve SHA-256 ile mühürlenir; yetkiliyseniz doğrudan GEÇERLİ olur — ayrıca onay gerekmez.'), E('div', { class: 'fgrid w2' }, ...(ttl ? [field('Program adı', ttl)] : []), field('Dosya', file), field('Not', note), ...(decision ? [field('Yüklerken karar', decision), field('Belge revizyonu (karar verilecekse)', label)] : needsLabel ? [field('Belge üzerindeki revizyon', label)] : [])), E('div', { class: 'row' }, btn('primary', `pw-${tid}-upload`, simpleType ? 'Yükle' : 'Yükle (TASLAK)', () => void upload()), btn('ghost', null, 'Vazgeç', () => formHost.replaceChildren()))));
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
                const stTr = { DRAFT: 'Yüklendi (doğrulama bekliyor)', IN_REVIEW: 'Kontrolde', APPROVED: 'Onaylı (yürürlüğe alınmadı)', EFFECTIVE: 'Geçerli', SUPERSEDED: 'Eski sürüm', REJECTED: 'Reddedildi' };
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
                        const docTr = state === 'EFFECTIVE' ? 'Geçerli' : state === 'APPROVED' ? 'Onaylı' : state === 'IN_REVIEW' ? 'Kontrolde' : 'Yüklendi';
                        const prep = c.fail > 0 ? 'Hatalı madde var' : todo.length > 0 ? 'Eksik bilgiler var' : attested ? 'Hazır' : 'Elle doğrulama bekliyor';
                        const useTxt = (c.fail === 0 && todo.length === 0 && attested && state === 'EFFECTIVE') ? 'Serbest' : 'Henüz serbest değil';
                        const sumRow = (k, lbl, v, tone) => E('div', { class: 'row', style: 'gap:6px' }, E('span', { class: 'mut' }, lbl), chip(v, tone, { 'data-testid': `pw-tools-sum-${k}` }));
                        holder.append(E('div', { class: 'stack', style: 'gap:6px', 'data-testid': 'pw-tools-summary' }, sumRow('doc', 'Belge', docTr, state === 'EFFECTIVE' || state === 'APPROVED' ? 'ok' : ''), sumRow('prep', 'Takım hazırlığı', prep, c.fail > 0 ? 'bad' : todo.length > 0 ? 'warn' : attested ? 'ok' : 'info'), sumRow('use', 'Üretimde kullanım', useTxt, useTxt === 'Serbest' ? 'ok' : 'warn')), todo.length ? E('div', { class: 'rows', 'data-testid': 'pw-tools-checks' }, E('b', {}, `Yapılacaklar (${todo.length})`), ...todo.map(row)) : E('div', { class: 'mut', 'data-testid': 'pw-tools-checks' }, 'Açık madde yok.'), okc.length ? E('details', { 'data-testid': 'pw-tools-ok-fold' }, E('summary', { class: 'mut' }, `Geçen kontroller (${okc.length})`), E('div', { class: 'rows' }, ...okc.map(row))) : document.createComment(''), c.fail > 0 ? E('div', { class: 'banner bad', 'data-testid': 'pw-tools-failed' }, 'Hatalı madde var: bu sürüm yürürlüğe alınamaz. Düzeltilmiş yeni sürüm yükleyin.')
                            : attested ? E('div', { class: 'banner ok', 'data-testid': 'pw-tools-attested' }, 'Kritik alanlar yetkili kişi tarafından doğrulandı ve kaydedildi.')
                                : (canAttest && (state === 'IN_REVIEW' || state === 'APPROVED' || state === 'DRAFT')) ? E('details', { 'data-testid': 'pw-tools-attest-form', open: todo.length === 0 }, E('summary', {}, E('b', {}, 'Teknik doğrulama (yetkili)')), E('div', { class: 'formbox' }, ...boxes.map((b) => E('label', { class: 'row', style: 'gap:6px' }, b.el, b.t)), E('label', { class: 'row', style: 'gap:6px' }, all, 'Tümünü işaretle (hepsini kontrol ettim)'), field('Doğrulama notu', note), btn('primary', 'pw-tools-attest', 'Doğruladım, kaydet', () => void (async () => { try {
                                    await api.toolistAttest(vid, Object.fromEntries(boxes.map((b) => [b.k, b.el.checked])), val(note).trim());
                                    await reload('Takım listesi doğrulaması kaydedildi; liste geçerli yapıldı (yetkiniz yeterliyse).');
                                }
                                catch (e) {
                                    fail(e);
                                } })())))
                                    : E('div', { class: 'mut' }, 'Elle doğrulama bekleniyor (yetkili kişi kaydeder; kayıt sonrası liste otomatik GEÇERLİ olur).'));
                    }
                    catch (e) {
                        fail(e);
                    }
                };
                for (const d of ov.documents)
                    for (const v of d.versions.slice(0, 3)) {
                        const holder = E('div', { 'data-testid': 'pw-tools-checkhost' });
                        const workHost = E('div', { 'data-testid': 'pw-tools-workhost' });
                        const ncTexts = async () => { const ch = safeChain(await api.techChain(rev.id), ws); const ids = [...new Set(ch.operations.map((o) => o.nc.versionId).filter((x) => !!x))]; const out = []; for (const id of ids) {
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
                    toolHost.append(E('div', { class: 'banner', role: 'status', 'data-testid': 'pw-tools-recheck' }, E('b', {}, `OP${r.opNo}: takım listesi değişti — CAM/NC ve operasyon uygunluğu yeniden kontrol edilmeli. `), 'Kayıt girilene kadar bu operasyon iş emrinde başlatılamaz. Kim: yetkili kişi (Yönetici/Kalite) — CAM/NC programının bu takım listesiyle uyumunu kontrol edip kısa not yazar; sistem bunu kendiliğinden onaylamaz.', ov.canAttest ? E('div', { class: 'row', style: 'margin-top:6px' }, note, btn('primary sm', 'pw-tools-recheck-done', 'Kontrol edildi', () => void (async () => { try {
                        await api.toolistRecheckDone(r.id, val(note).trim());
                        await reload('Yeniden kontrol kaydedildi.');
                    }
                    catch (e) {
                        fail(e);
                    } })())) : null));
                }
            };
            const docRow = (d) => E('div', { class: 'r docg', 'data-testid': 'pw-doc', 'data-doc-no': d.docNo ?? '' }, E('div', { class: 'stack', style: 'gap:3px' }, E('div', { class: 'row', style: 'gap:6px' }, E('b', {}, d.docNo ?? '—'), chip(ctlLabel(d.controlState, d.docType), CTL_TONE[d.controlState ?? ''] ?? ''), E('span', { class: 'mut' }, `v${d.versionNo ?? '—'}${d.effectiveVersionNo ? ` · ${isSimpleDocType(d.docType) ? 'geçerli' : 'yürürlükte'} v${d.effectiveVersionNo}` : ''}`)), E('div', {}, d.title), E('div', { class: 'mut' }, `${DOC_TR[d.docType] ?? d.docType}${d.fileName ? ` · ${d.fileName}` : ''}${d.opNos.length ? ` · OP${d.opNos.join(', OP')}` : ''}`)), E('div', { class: 'acts' }, btn('ghost sm', 'pw-doc-open', 'Önizle', () => void view(d, false)), btn('ghost sm', 'pw-doc-dl', 'İndir', () => void view(d, true)), h('a', { class: 'btn ghost sm', href: `#/dokuman-kontrol?doc=${d.id}`, 'data-testid': 'pw-doc-history' }, 'Geçmiş'), canUpload ? btn('ghost sm', `pw-${tid}-newver-${d.docNo ?? ''}`, 'Yeni sürüm', () => openForm(d)) : null, isSimpleDocType(d.docType) ? null : (canUpload && can.approveDocument && api.docDecide && ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(d.controlState ?? '')) ? btn('primary sm', `pw-${tid}-onepass-${d.docNo ?? ''}`, docType === 'TOOL_LIST' ? 'Tek onay' : 'Tek onay + yürürlük', () => void (async () => {
                const publish = docType !== 'TOOL_LIST';
                const why = `Tek onay${publish ? ' ve yürürlük' : ''}: ${d.docNo ?? ''} ${d.fileName ?? ''} (sahibi kararı)`.trim();
                try {
                    const r = await api.docDecide(d.id, ws.revision?.revision ?? null, why, publish);
                    await reload(`${d.docNo ?? 'Belge'}: ${r.done}.${docType === 'TOOL_LIST' ? ' Takım listesinde yürürlük, takım verisi doğrulanınca “Yürürlüğe Al” ile yapılır.' : ''}`);
                }
                catch (e) {
                    fail(e);
                }
            })()) : null));
            const addBtn = canUpload && (docs.length === 0 || multi) ? btn(docs.length ? 'ghost sm' : 'primary sm', `pw-${tid}-open-upload`, docs.length ? '+ Yeni program' : 'Dosya yükle', () => openForm(null)) : null;
            const cardEl = card({ title, span, testid: `pw-card-${tid}`, chip: stateChip(st), attrs: { 'data-state': st }, actions: [addBtn] }, docs.length ? E('div', { class: 'rows' }, ...docs.map(docRow)) : (whyNoUpload === 'NO_REV' ? emptyState(`Revizyon yok — ${title.toLowerCase()} eklenemez`, WHY_TR.NO_REV) : emptyState(`${NA} — bu revizyonda ${title.toLowerCase()} yok`, canUpload ? 'İlk dosyayı “Dosya yükle” ile ekleyin.' : (whyNoUpload ? WHY_TR[whyNoUpload] : ''))), formHost, viewHost, docType === 'TOOL_LIST' ? toolHost : null);
            void drawTools();
            return cardEl;
        };
        // ---------------------------------------------------------------------------------------- rota ve operasyonlar
        const activeOps = ws.routing.filter((o) => o.active);
        /** Sunucu her rota işleminde ≥10 karakterlik açıklama ister (RT: REASON_REQUIRED). Taslakta kullanıcıdan gerekçe beklenmez: alan, YAPILAN İŞLEMİN gerçek tanımıyla görünür biçimde doldurulur
         *  (kullanıcı görür, değiştirebilir; denetim izine işlem açıklaması olarak yazılır — uydurma gerekçe değil). Yayınlanmış/yürürlükteki veride gerçek gerekçe zorunlu kalır. */
        const prompt0 = (what) => autoWhy(what || 'rota düzenleme'); // m0211: gerekçe kutusu yok; işlemin gerçek tanımıyla otomatik denetim notu
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
            // OP numarası kullanıcıdan istenmez: sistem sıradan türetir (m0205). Yeni operasyonda sunucuya yalnız KONUM İPUCU gider (10'un katı olmayan sayı → hiçbir mevcut numarayla çakışmaz).
            const noIn = h('input', { 'data-testid': 'pw-op-no', type: 'text', value: op ? op.opCode : 'Otomatik (sıraya göre)', disabled: true, 'aria-label': 'Operasyon numarası otomatik atanır' });
            const newOpHint = () => { const mv = movableOps(ws.routing); return insertAt === null || insertAt >= mv.length ? 989 : (insertAt <= 0 ? 5 : mv[insertAt - 1].opNo + 5); };
            const name = h('input', { 'data-testid': 'pw-op-name', value: op?.name ?? '' });
            // m0210 arayüzü: Ana makine (tek seçim, zorunlu) + isteğe bağlı Alternatif makineler (varsayılan kapalı). Ana makine alternatif olamaz. Alternatif tanımlamak START izni vermez.
            const curPrimary = op ? (op.machines.find((x) => x.primary)?.id ?? (op.machines.length === 1 ? op.machines[0].id : '')) : '';
            const mach = machines.map((m) => ({ m, box: h('input', { type: 'checkbox', 'data-testid': `pw-op-m-${m.code}`, checked: !!op?.machines.some((x) => x.id === m.id) && m.id !== curPrimary }) }));
            const primary = h('select', { 'data-testid': 'pw-op-primary' }, h('option', { value: '' }, '— ana makine seçin —'), ...machines.map((m) => h('option', { value: m.id, selected: m.id === curPrimary }, m.code)));
            const syncAlt = () => { for (const x of mach) { const same = x.m.id === val(primary); if (same) x.box.checked = false; x.box.disabled = same; } };
            primary.addEventListener('change', syncAlt);
            syncAlt();
            // Yeterlilik İK / Personel Yetkinlikleri listesinden (skill_catalog) SEÇİLİR; serbest yazı katalogda olmadığı için SKILL_NOT_FOUND veriyordu. Seviye ölçeği 1–10 (m0204; migration uygulanmadan 5–10 sunucuda INVALID_LEVEL verir).
            const curSkill = op?.skillCode ?? '';
            const skill = skills.length
                ? h('select', { 'data-testid': 'pw-op-skill' }, h('option', { value: '' }, '— yeterlilik gerekmiyor —'),
                    ...(curSkill && !skills.some((x) => x.code === curSkill) ? [h('option', { value: curSkill, selected: true }, `${curSkill} (listede yok / pasif)`)] : []),
                    ...skills.map((x) => h('option', { value: x.code, selected: x.code === curSkill }, `${x.name} (${x.code})`)))
                : h('input', { 'data-testid': 'pw-op-skill', value: curSkill, placeholder: 'Yeterlilik kodu' });
            const level = h('select', { 'data-testid': 'pw-op-level' }, h('option', { value: '' }, '— seviye —'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => h('option', { value: String(n), selected: op?.skillLevel === n }, `Seviye ${n}`)));
            const setup = h('input', { 'data-testid': 'pw-op-setup', inputmode: 'decimal', value: op?.setupMinutes != null ? String(op.setupMinutes) : '' });
            const cycle = h('input', { 'data-testid': 'pw-op-cycle', inputmode: 'decimal', value: op?.cycleSeconds != null ? String(op.cycleSeconds) : '' });
            const fp = h('input', { type: 'checkbox', 'data-testid': 'pw-op-fp', checked: op?.firstPieceRequired ?? true });
            const qc = h('input', { type: 'checkbox', 'data-testid': 'pw-op-qc', checked: op?.qcRequired ?? false });
            const ins = h('textarea', { 'data-testid': 'pw-op-instr', placeholder: 'Operatör talimatı' });
            ins.value = op?.instructions ?? '';
            const save = async () => {
                const prim = val(primary);
                if (!prim) {
                    invalid(primary, true);
                    return fail(new Error('Eksik alan: ana makine seçilmeli'));
                }
                invalid(primary, false);
                const alts = mach.filter((x) => isChecked(x.box) && x.m.id !== prim).map((x) => x.m.id);
                const ids = [prim, ...alts];
                const setupV = num(val(setup));
                const cycleV = num(val(cycle));
                const no = op ? op.opNo : newOpHint();
                if (!val(name).trim()) {
                    invalid(name, true);
                    return fail(new Error('Eksik alan: operasyon adı'));
                }
                invalid(name, false);
                if (!!val(skill).trim() !== !!val(level).trim())
                    return fail(new Error('Yeterlilik ve seviye birlikte seçilmeli (ya da ikisi de boş bırakılmalı).'));
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
                    const r = await api.saveOperation({ revisionId: rev.id, opNo: no, name: val(name).trim(), machineIds: ids, primaryId: prim, skillCode: val(skill).trim() || null, skillLevel: num(val(level)),
                        camId: op?.camProgramId ?? null, setup: setupV, cycle: cycleV, firstPiece: isChecked(fp), qc: isChecked(qc), instructions: val(ins).trim() || null, reason: autoWhy(`OP${no} ${op ? 'güncellendi' : 'eklendi'}${diffs.length ? ' — ' + diffs.join('; ') : ''}`) });
                    openOp = r.operationId;
                    const WARN_TR = { ALT_NOT_PRODUCTION_ELIGIBLE: 'alternatif makine şu an üretime uygun değil', ALT_MACHINE_CLASS_DIFFERS: 'alternatif makine sınıfı ana makineden farklı', ALT_SKILL_REQUIREMENTS_UNKNOWN: 'alternatif makinenin beceri şartı tanımsız', ALT_NO_CAM_FOR_MACHINE: 'alternatif makine için CAM/NC kaydı yok' };
                    const warn = alts.length ? await api.machineWarnings(r.operationId, prim, alts) : [];
                    const wtxt = warn.length ? ` Uyarı: ${[...new Set(warn.map((w) => WARN_TR[w.code] ?? w.code))].join('; ')}.` : '';
                    if (!op && r.created) {
                        // m0205: sunucu yeni operasyonu aynı işlemde sıraya yerleştirir ve numaraları yeniden hesaplar (tek atomik çağrı; ikinci istek yok)
                        insertAt = null;
                        await reload(`${r.opCode} eklendi; sonraki operasyonların OP numaraları sıraya göre yeniden hesaplandı (kimlikler, NC/CAM/takım ve kalite bağları korundu).${wtxt}`, 'ok', { openOp: r.operationId });
                        return;
                    }
                    await reload(`${r.opCode} ${r.created ? 'eklendi' : 'kaydedildi'} (sürüm ${r.versionNo}).${wtxt}${diffs.length ? ' ' + diffs.join(' · ') + '.' : ''}${r.recalculatedRuns ? ` ${r.recalculatedRuns} etkilenen hesap yeniden değerlendirildi (eski hesaplar korunur).` : ''}`, 'ok', { openOp: r.operationId });
                }
                catch (e) {
                    fail(e);
                }
            };
            // Kontrollü "öncekinden kopyala": yalnız yeni operasyonda; süre, ilk parça/kalite zorunluluğu, yeterlilik, talimat ve makineler FORMA doldurulur (kaydetmeden önce görülür/değiştirilir).
            // NC/CAM/takım/aparat/kontrol planı KOPYALANMAZ — bunlar operasyona özeldir.
            const copyBox = op ? null : (() => {
                const srcOps = (ws.routing ?? []).filter((x) => x.active !== false);
                if (!srcOps.length)
                    return null;
                const sel = h('select', { 'data-testid': 'pw-op-copy', 'aria-label': 'Öncekinden kopyala' }, h('option', { value: '' }, '— boş başla —'), ...srcOps.map((x) => h('option', { value: x.id }, `${x.opCode ?? 'OP' + x.opNo} · ${x.name ?? ''}`.slice(0, 60))));
                sel.addEventListener('change', () => {
                    const src = srcOps.find((x) => x.id === sel.value);
                    if (!src)
                        return;
                    setup.value = src.setupMinutes != null ? String(src.setupMinutes) : '';
                    cycle.value = src.cycleSeconds != null ? String(src.cycleSeconds) : '';
                    fp.checked = !!src.firstPieceRequired;
                    qc.checked = !!src.qcRequired;
                    ins.value = src.instructions ?? '';
                    skill.value = src.skillCode ?? '';
                    level.value = src.skillLevel != null ? String(src.skillLevel) : '';
                    const sp = src.machines?.find((m) => m.primary)?.id ?? (src.machines?.length === 1 ? src.machines[0].id : '');
                    primary.value = sp;
                    for (const x of mach)
                        x.box.checked = !!src.machines?.some((m) => m.id === x.m.id) && x.m.id !== sp;
                    syncAlt();
                });
                return E('div', { class: 'row', style: 'align-items:center;gap:8px' }, h('label', { for: 'pw-op-copy' }, 'Öncekinden kopyala'), sel, E('span', { class: 'mut' }, 'Yalnız süre, kontrol zorunlulukları, yeterlilik, talimat ve makineler; NC/CAM/takım/aparat/kontrol planı kopyalanmaz.'));
            })();
            return E('div', { class: 'stack', 'data-testid': op ? 'pw-op-edit' : 'pw-op-new' }, copyBox, E('fieldset', { class: 'fsec' }, h('legend', {}, 'Genel'), E('div', { class: 'fgrid' }, field('Operasyon no', noIn), field('Ad', name), field('Ana makine', primary), field('Yeterlilik', skill), field('Seviye (1-10)', level))), E('fieldset', { class: 'fsec' }, h('legend', {}, 'Süreler'), E('div', { class: 'fgrid' }, field('Hazırlık (dk)', setup), field('Çevrim (sn/adet)', cycle))), h('details', { class: 'fsec', 'data-testid': 'pw-op-alt', open: mach.some((x) => isChecked(x.box)) }, h('summary', {}, 'Alternatif makine ekle (isteğe bağlı)'), E('div', { class: 'row', style: 'gap:4px 16px;margin-top:6px' }, ...mach.map((x) => h('label', { class: 'chk' }, x.box, x.m.code))), E('div', { class: 'mut' }, 'Alternatif makine tanımlamak START izni vermez: operatör yeterliliği, clearance, NC/CAM ve aparat kapıları o makine için ayrıca doğrulanır.'), machines.length ? null : E('div', { class: 'mut' }, 'Makine listesi okunamadı.')), E('div', { class: 'row', style: 'gap:4px 20px' }, h('label', { class: 'chk' }, fp, 'İlk parça kontrolü şart'), h('label', { class: 'chk' }, qc, 'Kalite kontrolü şart')), field('Operatör talimatı', ins), !can.editStructure && structural ? E('div', { class: 'mut' }, 'Yeni operasyon eklemek için taslak revizyon gerekir.') : null, E('div', { class: 'row', style: 'align-items:flex-end' }, btn('primary', 'pw-op-save', 'Kaydet', () => void save())));
        };
        let chainNow = null; // filled by the technical-chain panel (0136); null = not readable → no chips, nothing invented
        const chainOf = (o) => { const c = chainNow?.operations.find((x) => x.opNo === o.opNo); return c ? sanitizeChainOp(c, ws) : null; };
        const opsHost = E('div', { 'data-testid': 'pw-ops' });
        // Kutu görünümü: aynı ws.routing verisi; sürükleme/ok yalnız önizleme, kayıt açık gerekçeli tek routing_reorder.
        let pendingOrder = null; let insertAt = null; let listView = false;
        const boxHost = E('div', { 'data-testid': 'pw-boxes' });
        const drawBoxes = () => {
            if (!ws.routing.length) { boxHost.replaceChildren(); return; }
            drawOpBoxes(boxHost, { ops: ws.routing, chainOf, chainChips, stateChip, chip,
                canEdit: !!(can.editStructure && editable), canAdd: !!(can.editStructure && editable), openId: openOp,
                pending: pendingOrder, setPending: (v) => { pendingOrder = v; },
                onOpen: (id) => { insertAt = null; const cp = ws.routing.find((x) => x.id === id); if (cp && isCutPrep(cp)) { const tab = container.querySelector('[data-testid="opp-tab-CUT_PREP"]'); if (tab) { tab.click(); scrollTo(container.querySelector('[data-testid="opp-slot-CUT_PREP"]')); return; } } if (openOp === id) { openOp = null; drawOps(); } else { toggleOp(id); } },
                onInsert: (pos) => { clearBanner(); insertAt = pos; openOp = 'NEW'; drawOps(); scrollTo(opsHost.lastElementChild); },
                onSave: async (ids, why) => { try { await api.reorder(rev.id, ids, why); pendingOrder = null; await reload('Operasyon sırası kaydedildi; OP numaraları yeniden hesaplandı (kimlikler, NC/CAM/takım ve kalite bağları korundu).'); } catch (e) { pendingOrder = null; drawBoxes(); fail(e); } } });
        };
        const move = async (o, dir) => {
            const ids = activeOps.map((x) => x.id);
            const i = ids.indexOf(o.id);
            const j = i + dir;
            if (j < 0 || j >= ids.length)
                return;
            [ids[i], ids[j]] = [ids[j], ids[i]];
            const why = prompt0(`${o.opCode} sırası değiştirildi`);
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
            const preLine = o.dependsOn.length ? `Ön koşul: ${o.dependsOn.map((d) => opLabel(activeOps.find((a) => a.id === d.operationId) ?? d)).join(', ')}` : null;
            const qcLine = o.qcPoints.length ? `Kalite noktaları: ${o.qcPoints.map((q) => `KN${q.pointNo} ${q.label}${q.controlPlan ? ` [plan ${q.controlPlan}]` : ''}`).join('; ')}` : null;
            const docLine = o.documents.length ? `Belgeler: ${o.documents.map((d) => d.docNo).join(', ')}` : null;
            return E('div', { class: `opc ${open ? 'open' : ''} ${o.active ? '' : 'off'}`, 'data-testid': 'pw-op', 'data-op': o.opCode, 'data-op-id': o.id, 'data-active': String(o.active), 'data-state': st }, E('div', { class: 'opr' }, E('span', { class: 'code' }, opLabel(o)), E('div', { class: 'nm' }, o.name, ' ', stateChip(st), o.active ? null : [' ', chip('Pasif', 'bad')]), E('div', { class: 'c-machine' }, lbl('Makine', ''), o.machines.length ? o.machines.map((m) => (m.primary ? `★${m.code}` : m.code)).join(', ') : NA), E('div', { class: 'num' }, lbl('Hazırlık', ''), `${fmt(o.setupMinutes)} `, o.setupMinutes != null ? E('span', { class: 'u' }, 'dk') : null), E('div', { class: 'num' }, lbl('Çevrim', ''), `${fmt(o.cycleSeconds)} `, o.cycleSeconds != null ? E('span', { class: 'u' }, 'sn') : null), E('div', { class: 'num' }, lbl('Muayene', ''), `${fmt(o.inspectionSeconds)} `, o.inspectionSeconds != null ? E('span', { class: 'u' }, 'sn') : null), E('div', { class: 'c-cam' }, lbl('CAM', ''), o.camProgram ?? E('span', { class: 'mut' }, 'yok')), E('div', { class: 'acts' }, btn('ghost sm', `pw-op-toggle-${o.opCode}`, open ? 'Kapat' : (editOk && o.active ? 'Düzenle' : 'Aç'), () => toggleOp(o.id)), can.editStructure && o.active ? btn('ghost sm icon', `pw-op-up-${o.opCode}`, '↑', () => void move(o, -1), { 'aria-label': `${o.opCode} yukarı taşı`, ...(idx === 0 ? {} : {}) }) : null, can.editStructure && o.active ? btn('ghost sm icon', `pw-op-down-${o.opCode}`, '↓', () => void move(o, 1), { 'aria-label': `${o.opCode} aşağı taşı` }) : null, can.editStructure ? E('details', { class: 'more', 'data-testid': `pw-op-more-${o.opCode}` }, E('summary', { class: 'ghost sm', 'aria-label': `${opLabel(o)} diğer işlemler` }, '⋯'), E('div', { class: 'moremenu' }, btn(o.active ? 'danger sm' : 'ghost sm', `pw-op-active-${o.opCode}`, o.active ? 'Pasife al' : 'Etkinleştir', () => { const why = prompt0(); if (why === null)
                return; void (async () => { try {
                await api.setActive(o.id, !o.active, why);
                await reload(o.active ? `${o.opCode} pasife alındı (silinmez, geçmişi korunur).` : `${o.opCode} etkinleştirildi.`, 'ok', { openOp: o.id });
            }
            catch (e) {
                fail(e);
            } })(); }))) : null)), E('div', { class: 'opx' }, E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, E('span', { class: 'mut' }, `v${o.versionNo ?? '—'}${o.usedInWorkOrders ? ` · ${o.usedInWorkOrders} iş emrinde` : ''}`), o.firstPieceRequired ? chip('İlk parça', 'warn') : null, o.qcRequired ? chip('Kalite', 'warn') : null, ...(chainOf(o) && o.active ? [...chainChips(chainOf(o)), btn('ghost sm', `pw-op-chain-open-${o.opCode}`, open ? 'Teknik zinciri gizle' : 'Teknik zincir ▸', () => toggleOp(o.id))] : [])), chainOf(o) && o.active && chainGapText(chainOf(o)) ? E('div', { class: 'mut', 'data-testid': 'pw-op-gap' }, chainGapText(chainOf(o))) : null, resLine || preLine || qcLine || docLine ? E('div', { class: 'l' }, ...[resLine, preLine, qcLine, docLine].filter(Boolean).map((t) => E('span', {}, t))) : null), open ? E('div', { class: 'opb' }, o.active ? buildEngineeringPanel({ api, ws, rev, can, fail, reload, chainOf, kmiTools: [] }, o) : null, editOk && o.active ? buildOpWorkCard({ api, ws, rev, machines, skills, activeOps, can, canAct: !!(can.editRouting || can.manageDocuments) && editable, loadFresh: () => api.load(ws.product.id, rev.id), machineReqs, fail, reload, chainNow: () => chainNow }, o)
                : E('div', { class: 'mut' }, o.active ? 'Bu revizyonu düzenleme yetkiniz yok ya da revizyon kapalı.' : 'Pasif operasyon düzenlenmez.'), E('div', { class: 'row', style: 'margin-top:10px' }, btn('ghost', 'pw-op-hist-btn', 'Operasyon geçmişi (önce → sonra)', () => void showHist(o))), E('div', { 'data-testid': 'pw-op-history', 'data-op-hist': o.id })) : null);
        };
        const showHist = async (o) => {
            const hist = (container.querySelector(`[data-op-hist="${o.id}"]`) ?? opsHost.querySelector(`[data-op-hist="${o.id}"]`));
            if (!hist)
                return;
            try {
                const rows = await api.opHistory(o.id);
                hist.replaceChildren(E('div', { class: 'tw', style: 'margin-top:8px' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Sürüm', 'Tür', 'Kim / Ne zaman', 'Ad', 'Hazırlık', 'Çevrim', 'Gerekçe'].map((c) => h('th', {}, c)))), h('tbody', {}, ...rows.map((r, i) => {
                    const prev = rows[i + 1];
                    return h('tr', { 'data-testid': 'pw-op-hist-row' }, h('td', {}, `v${r.versionNo}`), h('td', {}, r.kind), h('td', {}, `${r.by ?? '—'} · ${when(r.at)}`), h('td', {}, r.name ?? '—'), h('td', {}, prev ? changeText(prev.setupMinutes, r.setupMinutes) : fmt(r.setupMinutes)), h('td', {}, prev ? changeText(prev.cycleSeconds, r.cycleSeconds) : fmt(r.cycleSeconds)), h('td', {}, fixCutPrepText(r.reason) ?? '—'));
                })))));
            }
            catch (e) {
                fail(e);
            }
        };
        const chainHost = E('div', { 'data-testid': 'pw-chain-host' });
        function drawOps() {
            drawBoxes();
            opsHost.classList.toggle('opsbox', !listView && ws.routing.length > 0);
            queueMicrotask(() => {
                const op = ws.routing.find((x) => x.id === openOp);
                const host = opsHost.querySelector('[data-testid="pw-op-chain-host"]');
                if (op && host)
                    void drawChainPanel(host, api, ws, { act: !!(can.editRouting || can.manageDocuments) && editable }, (m) => reload(m), (e) => fail(e), undefined, op.opNo);
            });
            opsHost.replaceChildren(...(ws.routing.length ? [E('div', { class: 'oph' }, E('span', {}, 'OP'), E('span', {}, 'Operasyon'), E('span', {}, 'Makine'), E('span', {}, 'Hazırlık'), E('span', {}, 'Çevrim'), E('span', {}, 'Muayene'), E('span', {}, 'CAM'), E('span', { class: 'acts' }, 'İşlem')), ...ws.routing.map(opCard)]
                : [emptyState(`${NA} — bu revizyonda operasyon yok`, can.editStructure ? '“+ Operasyon ekle” ile ilk operasyonu tanımlayın.' : 'Operasyon tanımı için taslak revizyon gerekir.', 'pw-route-empty')]), ...(can.editStructure && openOp === 'NEW' ? [E('div', { class: 'opc open', style: 'margin-top:8px' }, E('div', { class: 'opb' }, E('b', {}, insertAt === null ? 'Yeni operasyon (sona eklenir)' : `Yeni operasyon — kayıttan sonra ${insertAt === 0 ? 'CUT/PREP’in hemen ardına' : `${insertAt}. sıraya`} yerleşir`), E('div', { style: 'margin-top:10px' }, opEditor(null)), E('div', { class: 'row', style: 'margin-top:8px' }, btn('ghost sm', null, 'Vazgeç', () => { openOp = null; drawOps(); }))))] : []));
        }
        const checks = Array.isArray(ws.routingCheck) ? ws.routingCheck : ws.routingCheck?.checks ?? [];
        const addOp = () => { clearBanner(); insertAt = null; openOp = 'NEW'; drawOps(); scrollTo(opsHost.lastElementChild); };
        // CUT/PREP kesim yöntemi (iç/dış/karma): hesap ve kayıt sunucuda (0090); sunucu güncellemesi yoksa panel 'bekliyor' der.
        const cutMethod = ws.routing.some((x) => x.active && isCutPrep(x)) && api.cutPlanGet ? drawCutMethod(h('div'), api, { revisionId: rev.id, canEdit: !!can.editRouting }) : null;
        // START hazırlık engeli: operasyonda yeterlilik seçilmemiş VE makinesinde yeterlilik şartı kaydı yok → şart TANIMSIZ. Kapıyı bu ekran açmaz/kapatmaz; yalnız gerçeği açık gösterir.
        const undefinedSkill = machineReqs === null ? null : ws.routing.filter((x) => x.active && !x.skillCode).map((x) => ({ op: opLabel(x), machines: x.machines.filter((m) => !machineReqs.some((r) => r.machineId === m.id)).map((m) => m.code) })).filter((x) => x.machines.length);
        const skillGapNote = undefinedSkill === null ? E('div', { class: 'mut', 'data-testid': 'pw-skill-unknown' }, 'Makine yeterlilik şartları okunamadı — şartların tanımlı olduğu varsayılmaz.')
            : undefinedSkill.length ? E('div', { class: 'banner warn', 'data-testid': 'pw-skill-undefined' }, E('b', {}, 'START hazırlık engeli: yeterlilik şartı TANIMSIZ'), ` — ${undefinedSkill.map((x) => `${x.op} (${x.machines.join(', ')})`).join('; ')}. Tanımsız şart “yeterlilik gerekmiyor” demek DEĞİLDİR: yeterlilik şartı sahip kararıyla tanımlanmadan bu operasyonlarda operatör yeterliliği doğrulanamaz.`) : null;
        const routingCard = card({ title: 'Rota ve operasyonlar', testid: 'pw-card-routing', span: 12, id: 'card-routing', chip: stateChip(ws.routing.length ? (rev?.state ?? 'MISSING') : 'MISSING'),
            actions: [can.editStructure ? btn('primary', 'pw-op-add', '+ Operasyon ekle', addOp) : null] }, null, skillGapNote, boxHost, cutMethod, E('div', { class: 'row', style: 'justify-content:flex-end' }, btn('ghost sm', 'pw-list-toggle', 'Liste ⇄ Kutular', () => { listView = !listView; drawOps(); })), opsHost, can.editRouting && rev?.status === 'RELEASED' ? E('div', { class: 'mut', style: 'margin-top:10px' }, 'Yürürlükteki revizyon: operasyon ekleme/sıralama yetkili kişiyle ve yazılı gerekçeyle yapılır; her değişiklik sürümlenir ve denetim kaydına yazılır (revizyon kimliği ve geçmiş onaylar değişmez). OP numaraları sıradan otomatik hesaplanır.') : null);
        drawOps();
        // Sadeleştirme: hazırlık formu (NC/CAM/takım/makine/bağlama/süre/kalite) operasyon listesinin hemen altında;
        // zincir, durum rozetleri, uyarılar ve değişiklik geçmişi aynı veriden beslenen açılır panellerde. Yeni kayıt/kaynak yok.
        if (rev && api.opPrepList)
            routingCard.append(drawOpPrep(h('div'), api, { revisionId: rev.id }));
        const secondary = E('details', { class: 'mut', style: 'margin-top:12px', 'data-testid': 'pw-route-more' }, E('summary', { style: 'cursor:pointer;font-weight:600' }, 'Operasyon zinciri, durum rozetleri ve uyarılar'),
            checks.length ? E('div', { class: 'row', style: 'gap:6px;margin:8px 0' }, ...checks.map((c) => chip(`${c.label}: ${c.detail}`, c.status === 'OK' ? 'ok' : c.status === 'NA' ? '' : 'warn', { 'data-testid': 'pw-route-check', 'data-code': c.code, 'data-status': c.status, title: c.detail, style: 'white-space:normal' }))) : null, chainHost);
        routingCard.append(secondary);
        if (rev && api.changeHistory && api.changeImpact) {
            routingCard.append(drawRouteChanges(h('div'), api, { revisionId: rev.id, status: rev.status })); // kendi açılır paneli var
        }
        void drawChainPanel(chainHost, api, ws, { act: !!(can.editRouting || can.manageDocuments) && editable }, (m) => reload(m), (e) => fail(e), (c) => {
            chainNow = c ? { ...c, operations: c.operations.map((x) => sanitizeChainOp(x, ws)) } : c;
            if (!opsHost.querySelector('input:focus, textarea:focus, select:focus'))
                drawOps(); // never wipe a field the user is typing in
            const o = orderReadiness(ws.readiness?.overall, c, ws.bom.length);
            orderHost.replaceChildren(E('div', { class: `banner ${o.ready ? 'ok' : o.ready === false ? 'bad' : ''}`, 'data-testid': 'pw-order-ready', 'data-ready': String(o.ready) }, E('b', {}, o.ready ? 'Siparişe hazır' : o.ready === false ? 'Siparişe hazır değil' : 'Siparişe hazırlık doğrulanamadı'), o.reasons.length ? (o.ready === false && missingN.length ? (o.reasons.filter((x) => /OP\d/.test(x)).length ? ` — ${o.reasons.filter((x) => /OP\d/.test(x)).join('; ')}. Diğer eksikler yukarıdaki listede.` : ' — eksikler yukarıdaki listede.') : ` — ${o.reasons.join('; ')}`) : ' — tek hazırlık cevabı ve her operasyonun teknik zinciri tamam.'));
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
        if (rev && ws.routing.length)
            void doEstimate(); // hesap sayfa açılınca kendisi yapılır (yalnız gösterir; kayıt ayrı)
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
            const prev = E('div', { 'data-testid': 'pw-bom-preview', class: 'kx-sub mut' });
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
                    E('div', { 'data-testid': 'pw-bom-preview-text' }, chip('ÖNİZLEME — henüz kaydedilmedi', 'warn', { 'data-testid': 'pw-bom-preview-badge' }), ' ', E('b', {}, `${plan.piecesPerBar} parça/çubuk · ${fmt(n)} adet için ${plan.barsNeeded} çubuk`), ` · artan ${plan.sparePieces} parça · kullanılan malzeme ${fmtMm(plan.usedMm)} mm · toplam kalan ${fmtMm(plan.leftoverMmTotal)} mm (çubuk başına ${fmtMm(plan.remainderMmPerBar)} mm) · ham parça ${fmtMm(plan.pieceMassG)} g. Önizlemedir: kayıttan sonra sunucu hesabıyla gösterilir; stok ayrılmaz.`));
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
                ws.bom.length ? E('div', { class: 'row', style: 'margin-bottom:6px', 'data-testid': 'pw-bom-saved-badge' }, chip('KAYITLI BOM', 'ok'), E('span', { class: 'mut' }, 'Aşağıdaki satırlar kaydedilmiştir. Forma girilenler “BOM taslağını kaydet” denmeden kayıt olmaz.')) : null,
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
        const cpHost = E('div', { 'data-testid': 'pw-cp-host' });
        if (rev)
            void drawControlPlan(cpHost, api, { revisionId: rev.id, opNos: ws.routing.filter((x) => x.active).map((x) => x.opNo), showErr: fail, onChanged: (m) => reload(m) });
        const qualityCard = card({ title: 'Kalite planı', testid: 'pw-card-quality', span: 5, id: 'card-quality', chip: stateChip(ws.quality.length ? (rev?.state ?? 'MISSING') : 'MISSING') }, ws.quality.length ? E('div', { class: 'rows' }, ...ws.quality.map((q) => {
            const linked = ws.routing.flatMap((o) => o.qcPoints.filter((p) => p.controlPlanId === q.id).map((p) => `${o.opCode} KN${p.pointNo}`));
            return E('div', { class: 'r', style: 'grid-template-columns:minmax(0,1fr) auto', 'data-testid': 'pw-plan', 'data-linked': String(linked.length) }, E('div', {}, E('b', {}, q.operationNo != null ? `OP${q.operationNo}` : 'Genel'), ` · v${q.version} · ${q.status}`, E('div', { class: 'mut' }, `${q.characteristics} karakteristik`)), chip(linked.length ? `Bağlı: ${linked.join(', ')}` : 'Operasyona bağlı değil', linked.length ? 'ok' : 'warn'));
        })) : emptyState(`${NA} — kontrol planı yok`, 'Kontrol planı Kalite’de hazırlanır.'), (() => { const miss = ws.routing.filter((o) => o.qcPoints.length === 0).map((o) => o.opCode); return miss.length ? E('div', { class: 'banner', 'data-testid': 'pw-quality-missing' }, `Kalite noktası eksik: ${miss.join(', ')} — operasyonu açıp mevcut kontrol planından bir nokta bağlayın.`) : E('div', { class: 'mut', 'data-testid': 'pw-quality-missing' }, 'Tüm operasyonların kalite noktası bağlı.'); })(), cpHost, E('div', { class: 'mut', style: 'margin-top:10px' }, 'Onaylanan kontrol planı yürürlüğe girer ve operasyonun kalite noktasına otomatik bağlanır (revizyon taslakken). Eksik ölçü varsa onay verilmez.'), E('div', { class: 'kx-foot' }, h('a', { href: '#/kalite' }, 'Kontrol planı düzenleme: Kalite')));
        // ---------------------------------------------------------------------------------------- parametreler
        const editOk = can.editRouting && editable;
        const pCell = (o, p, value, from, ver) => {
            const since = E('span', { class: 'mut', 'data-testid': 'pw-param-from' }, from ? `${from}${ver ? ` · v${ver}` : ''}` : (value === null ? 'geçerlilik: yok' : '…'));
            if (p.code === 'OP_INSPECTION_SEC' && value !== null)
                void api.parameterHistory(p.code, o.id).then((ph) => { const v = ph.versions.find((x) => x.inForce); since.textContent = v ? `${v.validFrom} itibarıyla · v${v.versionNo}` : '—'; }).catch(() => { since.textContent = '—'; });
            return E('div', { class: 'pcell', 'data-testid': 'pw-param-line', 'data-op': o.opCode, 'data-param': p.code }, E('span', { class: 'cl' }, p.name), E('b', { class: 'num' }, value === null ? NA : `${fmt(value)} ${p.unit}`), since, btn('linkbtn sm', `pw-param-hist-${o.opCode}-${p.code}`, 'Geçmiş', () => void showParam(o, p.code)));
        };
        const paramCard = card({ title: 'Parametreler (operasyon bazlı)', testid: 'pw-card-params', span: 12, id: 'card-params' }, activeOps.length ? E('div', { class: 'rows' }, E('div', { class: 'r hd parg' }, E('span', {}, 'Operasyon'), ...PARAMS.map((p) => E('span', {}, `${p.name} · ${p.src}`)), E('span', { class: 'acts' }, 'İşlem')), ...activeOps.map((o) => E('div', { class: 'r parg', 'data-testid': 'pw-param-op', 'data-op': o.opCode }, E('span', {}, E('b', {}, o.opCode), ' ', o.name), pCell(o, PARAMS[0], o.setupMinutes, o.setupValidFrom, o.setupVersion), pCell(o, PARAMS[1], o.cycleSeconds, o.cycleValidFrom, o.cycleVersion), pCell(o, PARAMS[2], o.inspectionSeconds, null, null), E('div', { class: 'acts' }, editOk ? btn('ghost sm', `pw-param-edit-${o.opCode}`, 'Düzenle', () => { opOpenHook?.(o.opCode); }) : null))))
            : emptyState(`${NA} — aktif operasyon yok`, 'Parametreler operasyonlar tanımlanınca burada görünür.'), paramHistHost, E('div', { class: 'mut', style: 'margin-top:10px' }, 'Bu değerler operasyon bazlıdır; ürün geneli için tek değer yoktur. Her değişiklikte kaynak, gerekçe, zaman ve sürüm saklanır; geçmişe dönük değişmez. Eski hesaplar kendi parametre sürümüyle kalır, yeni hesaplar yürürlükteki değeri kullanır.'), can.editRouting ? E('div', { style: 'margin-top:10px' }, fold('Teknik ayrıntı (yetkili)', ws.parameterDefs.map((d) => E('div', { 'data-testid': 'pw-param-def', 'data-code': d.code, class: 'mut', style: 'margin:6px 0' }, E('b', {}, `${d.name} (${d.unit})`), ' ', chip(d.changeClass === 'TECHNICAL' ? 'Teknik: revizyon+onay' : 'Operasyonel', d.changeClass === 'TECHNICAL' ? 'warn' : ''), E('div', {}, `Sahip: ${OWNER_TR[d.ownerDomain] ?? d.ownerDomain} · Kaynak alanı: ${d.canonicalSource}${d.min != null || d.max != null ? ` · aralık ${fmt(d.min)}–${fmt(d.max)}` : ''}`))), false, 'pw-param-tech')) : null);
        const histCard = card({ title: 'Değişiklik geçmişi', testid: 'pw-card-history', span: 12, id: 'card-history' }, E('div', { class: 'row', style: 'justify-content:space-between' }, E('span', { class: 'mut' }, 'Revizyon, doküman, operasyon ve parametre değişiklikleri ürünün olay kaydında tutulur.'), h('a', { class: 'btn ghost sm', href: `#/urun-master?urun=${ws.product.id}&sekme=gecmis` }, 'Olay kaydını aç')));
        // ---------------------------------------------------------------------------------------- üst bölüm: başlık, hazırlık özeti, ana işlemler
        const docState = (c) => (c?.state ?? 'MISSING');
        const rs = (rev?.state ?? 'MISSING');
        // Akış sırası: Ürün bilgisi → BOM → Rota/Operasyon → CAM/NC → Takım listesi → Kontrol planı → Hazırlık/Yayın
        const worst = (...xs) => (xs.includes('MISSING') ? 'MISSING' : xs.includes('INVALID') ? 'INVALID' : xs.includes('DRAFT') ? 'DRAFT' : 'APPROVED');
        const stagesRaw = [
            { label: 'Ürün bilgisi', st: worst(docState(ws.cards.drawing), docState(ws.cards.cad)), target: 'drawing', next: 'Teknik resim ve CAD/STEP dosyalarını yükleyin.' },
            { label: 'BOM', st: ws.bom.length ? rs : 'MISSING', target: 'bom', next: 'Hammaddeyi (malzeme, çap, boy, kesim) tanımlayın.' },
            { label: 'Rota / Operasyon', st: ws.routing.length ? rs : 'MISSING', target: 'routing', next: 'İlk operasyonu ekleyin (süreler, makine).' },
            { label: 'CAM / NC', st: docState(ws.cards.cam), target: 'cam', next: 'NC programını yükleyin ve operasyona bağlayın.' },
            { label: 'Takım listesi', st: docState(ws.cards.tools), target: 'tools', next: 'Takım listesini yükleyin; eksik çap/tutucu/offset bilgisini tamamlayın.' },
            { label: 'Kontrol planı', st: ws.quality.length ? rs : 'MISSING', target: 'quality', next: 'Kalite kontrol noktalarını tanımlayın.' }
        ];
        const allBefore = worst(...stagesRaw.map((x) => x.st));
        const stages = [...stagesRaw, { label: 'Hazırlık / Yayın', st: (rev?.state === 'APPROVED' ? 'APPROVED' : allBefore === 'MISSING' ? 'MISSING' : 'DRAFT'), target: 'ready', next: rev?.state === 'APPROVED' ? 'Yayında.' : 'Revizyonu yayınlayın (Mühendislik ekranı → “Revizyonu yayınla”).' }];
        const STAGE_TR = { MISSING: ['Eksik', 'bad'], DRAFT: ['Onay bekliyor', 'warn'], APPROVED: ['Tamam', 'ok'], INVALID: ['Geçersiz — yenile', 'warn'] };
        const ready = stages.slice(0, 6);
        const missingN = stages.slice(0, 6).filter((r) => r.st === 'MISSING');
        const nextStage = stages.find((x) => x.st !== 'APPROVED');
        const orderHost = E('div', { style: 'margin-top:8px' });
        const readyCard = card({ title: 'Ürün hazırlık akışı', testid: 'pw-ready', span: 12, tone: missingN.length ? 'warn' : 'ok', chip: chip(missingN.length ? `${missingN.length} eksik` : nextStage ? 'Onay / yayın bekliyor' : 'Hazır', missingN.length ? 'warn' : nextStage ? 'info' : 'ok') }, E('div', { class: 'ready flow', role: 'list' }, ...stages.map((r, i) => E('button', { type: 'button', role: 'listitem', class: `${STATE_TONE[r.st]}${nextStage === r ? ' next' : ''}`, 'data-testid': `pw-ready-${r.target}`, 'data-state': r.st, 'aria-current': nextStage === r ? 'step' : undefined,
            onClick: () => scrollTo(container.querySelector(`[data-testid="pw-card-${r.target}"]`)) }, E('span', { class: 'dot' }), `${i + 1}. ${r.label}: `, E('b', {}, STAGE_TR[r.st][0])))), nextStage ? E('div', { class: 'banner', style: 'margin:10px 0 0', 'data-testid': 'pw-next-step' }, E('b', {}, `Sıradaki adım — ${nextStage.label}: `), nextStage.target === 'ready' ? nextStage.next : nextText(nextStage.target, nextStage.st)) : null, missingN.length ? E('div', { class: 'mut', style: 'margin-top:8px', 'data-testid': 'pw-missing-list' }, `Eksik: ${missingN.map((m) => m.label).join(' · ')}. Eksik değerler 0 sayılmaz.`) : null, orderHost);
        const head = E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, E('div', { class: 'crumb' }, btn('', 'pw-back', '← Ürünler', () => void go({}))), E('h1', { title: `${ws.product.code} — ${ws.product.name}` }, E('span', { class: 'head-name' }, `${ws.product.code} — ${ws.product.name}`)), E('div', { class: 'row', style: 'gap:6px' }, rev ? stateChip(rev.state) : null, E('span', { class: 'mut' }, can.editRouting ? 'Düzenleme yetkiniz var' : 'Yalnız görüntüleme'))), E('div', { class: 'acts' }, E('div', { style: 'min-width:180px' }, revSel), h('a', { class: 'btn ghost', href: '#/dokuman-kontrol' }, 'Doküman Kontrol'), h('a', { class: 'btn ghost', href: `#/urun-master?urun=${ws.product.id}` }, 'Ürün Master'), can.editStructure ? btn('primary', 'pw-top-op-add', '+ Operasyon', () => { addOp(); scrollTo(container.querySelector('[data-testid="pw-card-routing"]')); }) : null));
        if (state.only) {
            const all = { identity: idCard, drawing: docCard('drawing', 'Teknik resim', ws.cards.drawing, 'DRAWING'), cad: docCard('cad', 'CAD / STEP', ws.cards.cad, 'CAD_MODEL'), cam: docCard('cam', 'CAM / NC', ws.cards.cam, 'NC_PROGRAM', true), tools: docCard('tools', 'Takım listesi', ws.cards.tools, 'TOOL_LIST'),
                bom: bomCard, routing: routingCard, params: paramCard, quality: qualityCard, calc: calcCard, history: histCard, ready: readyCard };
            shell(banner, noRevBox, E('div', { class: 'row', style: 'margin-bottom:10px' }, E('div', { style: 'min-width:180px' }, revSel)), E('div', { class: 'kx-grid' }, ...state.only.map((k) => all[k]).filter((x) => !!x)));
            return;
        }
        // V2: TEK ekran (A başlık · B yedi adım · C malzeme/süre · D rota · E iş emri). Eski çalışma alanı sayfası DOM'da yoktur: mevcut kanonik editörler (aynı bileşenler, tekil) yalnız ilgili adımın / operasyonun hemen altında, istendiğinde açılır.
        const memo = new Map();
        const once = (k, f) => { let v = memo.get(k); if (!v) {
            v = f();
            memo.set(k, v);
        } return v; };
        const opPanel = (o) => {
            if (!o)
                return can.editStructure ? [E('div', { class: 'opb', 'data-testid': 'pw-op-new' }, E('b', {}, 'Yeni operasyon'), E('div', { style: 'margin-top:10px' }, opEditor(null)))] : [E('div', { class: 'mut' }, 'Operasyon ekleme yetkiniz yok.')];
            const chainH = can.editRouting && editable && o.active ? null : E('div', { 'data-testid': 'pw-op-chain-host', 'data-op-chain': String(o.opNo), style: 'margin-bottom:12px' });
            const panel = E('div', { class: 'opb' }, chainH, o.active ? buildEngineeringPanel({ api, ws, rev, can, fail, reload, chainOf, kmiTools: [] }, o) : null, can.editRouting && editable && o.active ? buildOpWorkCard({ api, ws, rev, machines, skills, activeOps, can, canAct: !!(can.editRouting || can.manageDocuments) && editable, loadFresh: () => api.load(ws.product.id, rev.id), machineReqs, fail, reload, chainNow: () => chainNow }, o)
                    : E('div', { class: 'mut' }, o.active ? 'Bu revizyonu düzenleme yetkiniz yok ya da revizyon kapalı.' : 'Pasif operasyon düzenlenmez.'), E('div', { class: 'row', style: 'margin-top:10px' }, btn('ghost', 'pw-op-hist-btn', 'Operasyon geçmişi (önce → sonra)', () => void showHist(o))), E('div', { 'data-testid': 'pw-op-history', 'data-op-hist': o.id }));
            if (chainH === null && o.active)
                void drawChainPanel(panel.querySelector('[data-testid="pw-op-chain-host"]'), api, ws, { act: !!(can.editRouting || can.manageDocuments) && editable }, (m) => reload(m), (e) => fail(e), undefined, o.opNo);
            return [panel];
        };
        const editors = (t, opCode) => {
            if (t === 'drawing')
                return [once('drawing', () => docCard('drawing', 'Teknik resim', ws.cards.drawing, 'DRAWING')), once('cad', () => docCard('cad', 'CAD / STEP', ws.cards.cad, 'CAD_MODEL'))];
            if (t === 'bom')
                return [bomCard];
            if (t === 'tools')
                return [once('tools', () => docCard('tools', 'Takım listesi', ws.cards.tools, 'TOOL_LIST'))];
            if (t === 'quality')
                return [qualityCard];
            if (t === 'routing') {
                if (opCode === 'NEW')
                    return opPanel(null);
                const op = opCode ? ws.routing.find((x) => x.opCode === opCode) : undefined;
                if (op)
                    return opPanel(op);
                return [E('div', { class: 'sec-sub', 'data-testid': 'pw-chain-wrap' }, E('b', {}, 'NC → CAM → operasyon bağlantısı'), chainHost), once('cam', () => docCard('cam', 'CAM / NC', ws.cards.cam, 'NC_PROGRAM', true)), calcCard, paramCard, histCard];
            }
            return [];
        };
        const setActive = async (o, active) => {
            if (rev?.status !== 'DRAFT') {
                fail(new Error('Yürürlükteki revizyonda operasyon pasife alınmaz / etkinleştirilmez; yapısal değişiklik için taslak revizyon açın.'));
                return;
            }
            try {
                await api.setActive(o.id, active, `Taslak düzenleme: ${o.opCode} ${active ? 'etkinleştirildi' : 'pasife alındı'}`);
                await reload(active ? `${o.opCode} etkinleştirildi.` : `${o.opCode} pasife alındı (silinmez, geçmişi korunur).`);
            }
            catch (e) {
                fail(e);
            }
        };
        const prepHost = E('div', { class: 'pv2', 'data-testid': 'pv2-root' });
        const backBtn = E('div', { class: 'crumb' }, btn('', 'pw-back', '← Ürünler', () => void go({})));
        shell(banner, noRevBox, prepHost);
        void drawPrepFlow(prepHost, { api, ws, revSelect: E('div', { style: 'min-width:180px' }, revSel), backBtn, initialQty: state.qty, editors, setActive, reload: (m) => reload(m), fail, navigate: (hsh) => { location.hash = hsh; }, productId: ws.product.id, ...(state.canOpenOrders !== undefined ? { canOpenOrders: state.canOpenOrders } : {}), initialOp: state.openOp ?? null, bindOpenOp: (f) => { opOpenHook = f; } });
    }
}
