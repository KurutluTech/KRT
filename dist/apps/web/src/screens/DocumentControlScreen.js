// KMI-010 — Doküman Kontrol: tek canonical doküman kimliği, değiştirilemez sürümler, taslak → inceleme → onay → yürürlük, dağıtım ve etkilenen işler,
// geçerlilik (GEÇERLİ yalnız sunucu hesabı), kontrollü baskı + filigran, dijital doğrulama, tam denetim izi. Yetki/erişim/geçerlilik SUNUCUDA; bu ekran yalnız gösterir ve çağırır.
import { pilotChip } from '../pilotMark.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { DOCUMENT_TYPES, bytesToHex, canUploadDocument, documentType } from '../../../../packages/domain/src/documents.js';
import { guessMime } from './DocumentsScreen.js';
import { errorText } from '../errorText.js';
import { KX_CSS, card, chip as kchip, emptyState, field, fold, fromBase64 as kxFromBase64, invalid, kb as kxKb, showFile, toBase64 as kxToBase64 } from '../kx.js';
// Ortak `kx` tasarım standardı (kx.ts) + yalnız bu ekrana özgü satır ızgaraları ve baskı stili.
const CSS = KX_CSS + `
.dk .dkg{grid-template-columns:130px minmax(0,2fr) minmax(0,1.5fr) 110px 150px minmax(0,1.2fr) auto}
.dk .toolbar{display:grid;grid-template-columns:minmax(0,1fr) 210px auto auto;gap:10px;align-items:end}
@media (max-width:900px){.dk .toolbar{grid-template-columns:1fr 1fr}.dk .toolbar .wide,.dk .toolbar>button{grid-column:1/-1}}
.dk .clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dk .ver{border:1px solid #1e293b;border-radius:12px;padding:12px;background:#0b1220;display:flex;flex-direction:column;gap:6px}.dk .ver.eff{border-color:#15803d}.dk .ver.old{opacity:.82}
.dk .counts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.dk .counts button{min-height:30px;padding:2px 10px;font-size:12px;background:#0f172a;border:1px solid #334155;color:#cbd5e1}.dk .counts button.on{background:#1d4ed8;border-color:#3b82f6;color:#fff}
.dk-print{display:none}
@media print{body *{visibility:hidden}.dk-print,.dk-print *{visibility:visible}.dk-print{display:block;position:absolute;inset:0;background:#fff;color:#000;padding:20px;font-family:system-ui,sans-serif}}
.dk-print .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #b88718;padding-bottom:8px;margin-bottom:12px}.dk-print .hd b{letter-spacing:.12em;font-size:18px}
.dk-print table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}.dk-print th,.dk-print td{border:1px solid #999;padding:4px 6px;text-align:left;color:#000;text-transform:none;letter-spacing:0}
.dk-print .wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:900;color:rgba(200,0,0,.28);transform:rotate(-30deg);text-align:center;pointer-events:none}
.dk-print svg{width:110px;height:110px}
`;
export const STATE_TR = { DRAFT: ['TASLAK', 'info'], IN_REVIEW: ['ONAY BEKLİYOR', 'warn'], APPROVED: ['ONAYLANDI · YÜRÜRLÜKTE DEĞİL', 'warn'], EFFECTIVE: ['GEÇERLİ', 'ok'], SUPERSEDED: ['GEÇERSİZ (SUPERSEDED)', 'bad'], REJECTED: ['REDDEDİLDİ', 'bad'] };
const INVALID_TR = { FILE_MISSING: 'dosya eksik / bozuk', EXPIRED: 'süresi dolmuş', REVISION_UNCLEAR: 'revizyon belirsiz', REVISION_OBSOLETE: 'ürün revizyonu eski', WITHDRAWN: 'doküman geri çekilmiş' };
export const validityText = (v) => {
    if (!v)
        return ['—', ''];
    if (STATE_TR[v])
        return STATE_TR[v];
    if (v === 'NOT_CONTROLLED')
        return ['Kontrolsüz tür', ''];
    const [k, why] = v.split(':');
    if (k === 'INVALID')
        return [`GEÇERSİZ — ${INVALID_TR[why ?? ''] ?? why ?? ''}`, 'bad'];
    return ['DOĞRULANAMADI — GEÇERLİ SAYILMAZ', 'bad'];
};
const EV_TR = { UPLOADED: 'Dosya yüklendi', LEGACY_UNREVIEWED: 'Eski kayıt — incelenmedi (taslak)', SUBMITTED: 'Onaya gönderildi', REVIEWED: 'Kontrol (inceleme)', REJECTED: 'Reddedildi', APPROVED: 'Onaylandı', PUBLISHED: 'Yürürlüğe alındı',
    SUPERSEDED: 'Yeni sürümle geçersiz oldu', INVALIDATED: 'Geçersiz kılındı', DISTRIBUTED: 'Açık işlere dağıtıldı', ACKNOWLEDGED: 'İş için karar verildi', OPENED: 'Açıldı / indirildi', PRINTED: 'Basıldı', REPRINTED: 'Yeniden basıldı', OP_LINKED: 'Operasyona bağlandı', OP_UNLINKED: 'Operasyon bağı kaldırıldı', WITHDRAWN: 'Geri çekildi', REGISTERED: 'Doküman numarası verildi' };
const ACK_TR = { PENDING: 'KARAR BEKLİYOR', NOT_REQUIRED: 'başlamamış — gerekmiyor', APPLIED_NEW: 'yeni sürüme geçildi', CONTINUE_ACCEPTED: 'eski sürümle devam (onaylı istisna)' };
const NA = 'VERİ YOK';
const typeTr = (c) => documentType(c)?.titleTr ?? c;
const val = (x) => x.value;
const when = (s) => (s ? s.slice(0, 16).replace('T', ' ') : '—');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const NEXT_TR = { DRAFT: 'Onaya gönderilmeli', IN_REVIEW: 'Kontrol / onay bekliyor', APPROVED: 'Yürürlüğe alınmalı', EFFECTIVE: 'İşlem yok', SUPERSEDED: 'Geçersiz — yeni sürüm kullanılır', REJECTED: 'Düzeltip yeni sürüm yükleyin' };
const STEPS = [['DRAFT', 'Taslak'], ['IN_REVIEW', 'İnceleme'], ['APPROVED', 'Onay'], ['EFFECTIVE', 'Yürürlük']];
const tone = (c) => (c === 'ok' || c === 'warn' || c === 'bad' || c === 'info' ? c : '');
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const btnE = (cls, testid, text, fn, extra = {}) => E('button', { class: cls, type: 'button', ...(testid ? { 'data-testid': testid } : {}), onClick: fn, ...extra }, text);
/** Onay akışı göstergesi: kullanıcı belgenin hangi adımda olduğunu görür (taslak → inceleme → onay → yürürlük). */
const stepper = (st) => {
    const idx = STEPS.findIndex(([k]) => k === st);
    if (st === 'SUPERSEDED' || st === 'REJECTED')
        return E('div', { class: 'steps', 'data-testid': 'dk-steps', 'data-step': st }, E('span', { class: 's bad' }, st === 'REJECTED' ? 'Reddedildi' : 'Geçersiz (yenisi yürürlükte)'));
    return E('div', { class: 'steps', 'data-testid': 'dk-steps', 'data-step': st ?? 'NONE' }, ...STEPS.flatMap(([k, l], n) => [n ? E('span', { class: 'sep' }, '›') : null, E('span', { class: `s ${idx > n ? 'done' : idx === n ? 'cur' : ''}`, ...(idx === n ? { 'aria-current': 'step' } : {}) }, `${idx > n ? '✓ ' : ''}${l}`)]));
};
export async function renderDocumentControlScreen(container, api, state = {}) {
    const go = (s) => renderDocumentControlScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'kx dk', 'data-testid': 'dk-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? E('div', { class: `banner ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'dk-banner', 'data-kind': state.banner.kind, role: state.banner.kind === 'error' ? 'alert' : 'status' }, state.banner.text) : null;
    const fail = (e) => {
        const text = errorText(e);
        const root = container.querySelector('[data-testid="dk-root"]');
        let b = container.querySelector('[data-testid="dk-banner"]');
        if (!b && root) {
            b = E('div', { class: 'banner bad', 'data-testid': 'dk-banner', 'data-kind': 'error', role: 'alert' }, text);
            const first = [...root.children].find((c) => c.tagName !== 'STYLE');
            root.insertBefore(b, first?.nextSibling ?? null);
        }
        else if (b) {
            b.textContent = text;
            b.className = 'banner bad';
            b.setAttribute('data-kind', 'error');
        }
        try {
            b?.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    const chip = (v, testid = 'dk-validity') => { const [t, c] = validityText(v); return kchip(t, tone(c), { 'data-testid': testid, 'data-value': v ?? '' }); };
    if (state.doc)
        return renderDetail(state.doc);
    return renderHome();
    // ------------------------------------------------------------------------------------------------ liste: arama · doğrulama · yükleme
    async function renderHome() {
        let rows = [];
        let err = null;
        try {
            rows = await api.list(state.q ?? '', state.state ?? '', !!state.all);
        }
        catch (e) {
            err = errorText(e);
        }
        const q = h('input', { 'data-testid': 'dk-q', placeholder: 'Doküman no · ürün kodu · başlık', value: state.q ?? '', 'aria-label': 'Ara' });
        const st = h('select', { 'data-testid': 'dk-state', 'aria-label': 'Durum' }, ...[['', 'Tüm durumlar'], ['DRAFT', 'Taslak'], ['IN_REVIEW', 'Onay bekliyor'], ['APPROVED', 'Onaylı · yayımlanmadı'], ['EFFECTIVE', 'Geçerli'], ['SUPERSEDED', 'Geçersiz'], ['REJECTED', 'Reddedildi']].map(([v, l]) => h('option', { value: v, ...(v === (state.state ?? '') ? { selected: 'selected' } : {}) }, l)));
        const all = h('input', { type: 'checkbox', 'data-testid': 'dk-all', ...(state.all ? { checked: 'checked' } : {}) });
        const vin = h('input', { 'data-testid': 'dk-verify-input', placeholder: 'Çıktıdaki Doküman no (DOC-000123) veya QR kodu', value: state.verify ?? '' });
        const vout = E('div', { 'data-testid': 'dk-verify-result', style: 'margin-top:10px' });
        const verify = async () => {
            try {
                const r = await api.verify(val(vin));
                vout.replaceChildren(E('div', { class: `banner ${r.isValid ? 'ok' : 'bad'}`, 'data-valid': String(!!r.isValid) }, E('b', {}, r.message), r.found ? E('div', { class: 'mut' }, `${r.docNo} · ${r.title} · sürüm ${r.versionNo}${r.currentVersionNo ? ` · güncel sürüm ${r.currentVersionNo}` : ''}`) : null));
            }
            catch (e) {
                fail(e);
            }
        };
        const apply = (extra = {}) => void go({ ...state, q: val(q), state: val(st), all: all.checked, banner: null, verify: val(vin), ...extra });
        q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter')
            apply(); });
        st.addEventListener('change', () => apply());
        // açılır bölümler: çıktı doğrulama ve yeni doküman yükleme yalnız istenince ekranı kaplar
        const verifyHost = E('div', { 'data-testid': 'dk-verify-host' });
        const uploadHost = E('div', { 'data-testid': 'dk-upload-host' });
        const showVerify = () => {
            if (verifyHost.childElementCount) {
                verifyHost.replaceChildren();
                return;
            }
            verifyHost.append(card({ title: 'Çıktı geçerli mi? (dijital doğrulama)', testid: 'dk-verify', span: 12 }, E('div', { class: 'row' }, E('div', { class: 'grow' }, vin), btnE('primary', 'dk-verify-btn', 'Doğrula', () => void verify())), vout, E('div', { class: 'mut', style: 'margin-top:8px' }, 'Kâğıt çıktının hâlâ geçerli olduğu yalnızca bu kontrolle anlaşılır; baskı tarihi tek başına karar vermez.')), E('div', { style: 'height:14px' }));
            vin.focus?.();
        };
        const showUpload = () => { if (uploadHost.childElementCount) {
            uploadHost.replaceChildren();
            return;
        } uploadHost.append(uploadCard(null), E('div', { style: 'height:14px' })); };
        const counts = new Map();
        for (const r of rows)
            counts.set(r.state ?? 'NONE', (counts.get(r.state ?? 'NONE') ?? 0) + 1);
        const flt = (k, label, n) => btnE(`${(state.state ?? '') === k ? 'on' : ''}`, `dk-count-${k || 'all'}`, `${label} ${n}`, () => apply({ state: k }));
        const row = (r) => {
            const invalidNow = !!(r.effectiveVersionNo && r.effectiveValidity && r.effectiveValidity !== 'EFFECTIVE');
            return E('div', { class: 'r dkg', 'data-testid': 'dk-row', 'data-id': r.id, 'data-state': r.state ?? 'NONE' }, E('b', {}, r.docNo), E('div', {}, E('div', {}, r.title), E('div', { class: 'mut' }, typeTr(r.docType), r.opLinks.length ? ` · operasyon ${r.opLinks.join(', ')}` : '')), E('div', { class: 'mut clamp2', title: r.productCode ? `${r.productCode} ${r.productName ?? ''}` : r.entityType }, r.productCode ? [E('b', {}, r.productCode), ` ${r.productName ?? ''} · Rev ${r.revision ?? '—'}`] : r.entityType), E('div', { class: 'num' }, `v${r.latestVersionNo ?? '—'}`, E('div', { class: 'mut' }, r.effectiveVersionNo ? `yürürlükte v${r.effectiveVersionNo}` : 'yürürlükte YOK')), E('div', { class: 'stack', style: 'gap:4px;align-items:flex-start' }, r.state ? chip(r.state, 'dk-row-state') : kchip('Kontrolsüz'), r.legacy ? kchip('ESKİ KAYIT — İNCELENMEDİ', 'warn', { 'data-testid': 'dk-legacy' }) : null, invalidNow ? chip(r.effectiveValidity, 'dk-row-invalid') : null), E('div', { class: 'mut' }, r.state ? (r.awaiting ? 'Karar bekliyor' : NEXT_TR[r.state] ?? '—') : 'Kontrolsüz tür'), E('div', { class: 'acts' }, btnE('primary sm', 'dk-open', 'Aç', () => void go({ ...state, doc: r.id, banner: null }))));
        };
        shell(E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, h('h1', {}, 'Doküman Kontrol'), E('div', { class: 'mut' }, 'Teknik belgeler yalnız onaylı ve yürürlükteki sürümle üretimde geçerlidir; belirsiz olan GEÇERLİ sayılmaz.')), E('div', { class: 'acts' }, btnE('ghost', 'dk-open-verify', 'Çıktı doğrula', showVerify), btnE('primary', 'dk-open-upload', '+ Yeni doküman', showUpload))), banner, verifyHost, uploadHost, card({ title: 'Dokümanlar', span: 12 }, E('div', { class: 'toolbar' }, E('div', { class: 'wide' }, field('Ara', q)), field('Durum', st), E('label', { class: 'chk' }, all, 'Kontrolsüz türler'), btnE('ghost', 'dk-apply', 'Ara / Süz', () => apply())), rows.length || state.state || state.q ? E('div', { class: 'counts', style: 'margin-top:12px' }, flt('', 'Hepsi', rows.length && !state.state ? rows.length : [...counts.values()].reduce((a, b) => a + b, 0)), ...STEPS.concat([['SUPERSEDED', 'Geçersiz'], ['REJECTED', 'Reddedildi']]).filter(([k]) => counts.get(k)).map(([k, l]) => flt(k, l, counts.get(k)))) : null, err ? E('div', { class: 'banner bad', 'data-testid': 'dk-error', style: 'margin-top:10px' }, err) : null, E('div', { 'data-testid': 'dk-list', style: 'margin-top:12px' }, rows.length ? E('div', { class: 'rows' }, E('div', { class: 'r hd dkg' }, ...['Doküman no', 'Başlık / tür', 'Ürün · revizyon', 'Sürüm', 'Durum', 'Gerekli işlem', ''].map((x) => E('span', {}, x))), ...rows.map(row)) : emptyState('Bu süzgeçle doküman yok.', 'Arama veya durum seçimini değiştirin; ya da “+ Yeni doküman” ile ekleyin.', 'dk-empty'))));
    }
    // ------------------------------------------------------------------------------------------------ yükleme (üründen yeni doküman ya da yeni sürüm)
    function uploadCard(lc) {
        const prod = h('input', { 'data-testid': 'dk-up-product', placeholder: 'Ürün kodu / adı ara', list: 'dk-products', autocomplete: 'off' });
        const plist = h('datalist', { id: 'dk-products' });
        const rev = h('select', { 'data-testid': 'dk-up-rev' }, h('option', { value: '' }, '— önce ürün seç —'));
        const type = h('select', { 'data-testid': 'dk-up-type' }, ...DOCUMENT_TYPES.filter((t) => ['DRAWING', 'CONTROL_PLAN', 'WORK_INSTRUCTION', 'CAM_SETUP_SHEET', 'NC_PROGRAM', 'OTHER'].includes(t.code)).map((t) => h('option', { value: t.code }, t.titleTr)));
        const title = h('input', { 'data-testid': 'dk-up-title', placeholder: 'Başlık (boşsa tür + ürün)' });
        const file = h('input', { type: 'file', 'data-testid': 'dk-up-file' });
        const until = h('input', { type: 'date', 'data-testid': 'dk-up-until' });
        const note = h('input', { 'data-testid': 'dk-up-note', placeholder: lc ? 'Bu sürümde ne değişti?' : 'Not (isteğe bağlı)' });
        let picks = [];
        prod.addEventListener('input', async () => {
            try {
                picks = await api.products(val(prod));
                plist.replaceChildren();
                for (const p of picks)
                    plist.append(h('option', { value: p.code }, p.name));
                const hit = picks.find((p) => p.code.toLowerCase() === val(prod).trim().toLowerCase());
                if (hit) {
                    const rs = await api.revisions(hit.id);
                    rev.replaceChildren();
                    for (const r of rs)
                        rev.append(h('option', { value: r.id }, `Rev ${r.revision} · ${r.status === 'RELEASED' ? 'yürürlükte' : r.status === 'DRAFT' ? 'taslak' : 'eski'}`));
                }
            }
            catch (e) {
                fail(e);
            }
        });
        const save = async () => {
            const f = file.files?.[0];
            if (!f) {
                invalid(file, true);
                return fail(new Error('CONTENT_REQUIRED'));
            }
            invalid(file, false);
            const entityId = lc ? lc.document.entityId : val(rev);
            if (!entityId) {
                invalid(rev, true);
                return fail(new Error('ENTITY_REQUIRED'));
            }
            invalid(rev, false);
            const bytes = new Uint8Array(await f.arrayBuffer());
            const mime = guessMime(f.name, f.type);
            const docType = lc ? lc.document.docType : val(type);
            const sha = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
            const pre = canUploadDocument({ docType, entityType: 'PRODUCT_REVISION', entityExists: true, title: lc ? null : (val(title) || typeTr(docType)), fileName: f.name, mime, bytes, validUntil: val(until) || null, today: today(), canSeeSensitivity: () => true,
                existing: lc ? { status: lc.document.status, docType, hashes: lc.versions.map((v) => v.sha256) } : null, sha256Hex: sha });
            if (!pre.ok)
                return fail(new Error(pre.reason));
            try {
                const r = await api.upload({ docType, entityType: 'PRODUCT_REVISION', entityId, title: lc ? null : (val(title).trim() || `${typeTr(docType)} ${val(prod).trim()}`), fileName: f.name, mimeType: mime, contentBase64: kxToBase64(bytes), validUntil: val(until) || null, note: val(note).trim() || null, documentId: lc ? lc.document.id : null });
                void go({ doc: lc ? lc.document.id : r.documentId, banner: { kind: 'ok', text: `Yüklendi: sürüm ${r.versionNo} — TASLAK olarak. Üretimde geçerli olması için onaya gönderilip yürürlüğe alınmalı. Parmak izi ${r.sha256.slice(0, 12)}…` } });
            }
            catch (e) {
                fail(e);
            }
        };
        return card({ title: lc ? 'Yeni sürüm yükle (eskisi silinmez)' : 'Yeni doküman yükle', testid: lc ? 'dk-version-upload' : 'dk-upload', span: 12, tone: 'info' }, E('div', { class: 'stack', style: 'gap:12px' }, lc ? null : E('div', { class: 'fgrid' }, field('Ürün', prod), plist, field('Ürün revizyonu', rev), field('Doküman türü', type), field('Başlık', title)), E('div', { class: 'fgrid' }, field('Dosya', file), field('Geçerlilik sonu (varsa)', until), field(lc ? 'Değişiklik notu' : 'Not', note)), E('div', { class: 'row' }, btnE('primary', lc ? 'dk-version-save' : 'dk-up-save', 'Yükle (TASLAK)', () => void save()), E('span', { class: 'mut' }, 'Dosya TASLAK olarak eklenir; yürürlükteki sürümü değiştirmez.'))));
    }
    // ------------------------------------------------------------------------------------------------ ayrıntı
    async function renderDetail(docId) {
        let lc;
        try {
            lc = await api.lifecycle(docId);
        }
        catch (e) {
            shell(banner, btnE('ghost', 'dk-back', '← Liste', () => void go({ ...state, doc: null, banner: null })), E('div', { style: 'height:12px' }), E('div', { class: 'banner bad', 'data-testid': 'dk-error' }, errorText(e)));
            return;
        }
        const d = lc.document;
        const prev = E('div', { class: 'fileview', 'data-testid': 'dk-preview' });
        const note = h('textarea', { 'data-testid': 'dk-note', rows: '2', placeholder: 'Neden / karar notu (en az 5 karakter)' });
        const label = h('input', { 'data-testid': 'dk-label', placeholder: 'Belgenin üzerinde yazan revizyon (ör. A)', maxlength: '20' });
        const act = async (fn, msg) => { try {
            await fn();
            void go({ ...state, doc: docId, banner: { kind: 'ok', text: msg } });
        }
        catch (e) {
            fail(e);
        } };
        const open = async (v, download) => {
            try {
                const c = await api.content(v.id);
                const bytes = kxFromBase64(c.contentBase64);
                const local = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
                const okBoth = c.integrityOk && local === c.sha256;
                prev.replaceChildren();
                prev.append(E('div', { class: `banner ${okBoth ? 'ok' : 'bad'}`, 'data-testid': 'dk-integrity', 'data-ok': String(okBoth) }, okBoth ? `Dosya açıldı · bütünlük doğrulandı (${c.sha256.slice(0, 12)}…) · durum: ${validityText(c.validity)[0]}` : 'BÜTÜNLÜK HATASI — dosya bozuk, KULLANMAYIN'));
                if (!okBoth)
                    return;
                showFile(prev, { bytes, mime: c.mimeType, fileName: c.fileName, download, testids: { frame: 'dk-frame', img: 'dk-img', text: 'dk-text', link: 'dk-download-link', none: 'dk-nopreview' } });
                scrollInto(prev);
            }
            catch (e) {
                fail(e);
            }
        };
        const scrollInto = (el) => { try {
            el.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ } };
        const printHost = E('div', { class: 'dk-print', 'data-testid': 'dk-print-sheet' });
        const doPrint = async (v) => {
            const why = container.querySelector('[data-testid="dk-print-reason"]')?.value ?? '';
            try {
                const s = await api.printBegin(v.id, 'Atölye', why);
                const qr = qrToSvg(encodeQr(s.verifyRef));
                const qrBox = E('div', { 'data-testid': 'dk-print-qr' });
                qrBox.innerHTML = qr;
                printHost.replaceChildren();
                printHost.append(...[
                    s.watermark ? h('div', { class: 'wm', 'data-testid': 'dk-watermark' }, s.watermark) : null,
                    h('div', { class: 'hd' }, h('div', {}, h('b', {}, 'KURUTLU · KONTROLLÜ DOKÜMAN'), h('div', {}, `${s.docNo} · sürüm ${s.versionNo}`)), qrBox),
                    h('table', {}, ...[['Doküman', `${s.title} (${typeTr(s.docType)})`], ['Ürün / Revizyon', `${s.productCode ?? '—'} ${s.productName ?? ''} · Rev ${s.productRevision ?? '—'}${s.docRevisionLabel ? ` (belge üzerinde: ${s.docRevisionLabel})` : ''}`], ['Dosya', `${s.fileName} · ${s.sha256.slice(0, 16)}…`],
                        ['Durum (baskı anında)', s.watermark ?? 'GEÇERLİ — yürürlükte'], ['Hazırlayan / Kontrol / Onay', `${s.preparedBy ?? '—'} / ${s.reviewedBy ?? '—'} / ${s.approvedBy ?? '—'}`], ['Yürürlük', when(s.effectiveAt)], ['Baskı', `${s.printedAt} · ${s.printedBy ?? ''} · #${s.printNo}`],
                    ].map(([k, vv]) => h('tr', {}, h('th', {}, k), h('td', {}, vv)))),
                    h('p', {}, `Doğrulama: ${s.verifyRef} — Doküman Kontrol ekranında “Çıktı geçerli mi?” alanına yazın veya QR'ı okutun.`), h('p', { style: 'font-size:11px' }, s.notice),
                ].filter(Boolean));
                // dosya bir görüntüyse kapak sayfasından sonra gelir (PDF gövdesi tarayıcıda damgalanamaz; kapak + dijital doğrulama kontrol bilgisini taşır)
                const c = await api.content(v.id);
                if (c.mimeType.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.style.maxWidth = '100%';
                    img.src = URL.createObjectURL(new Blob([kxFromBase64(c.contentBase64)], { type: c.mimeType }));
                    printHost.append(img);
                }
                window.print();
                void go({ ...state, doc: docId, banner: { kind: 'ok', text: `Baskı kaydedildi (#${s.printNo})${s.watermark ? ` — FİLİGRAN: ${s.watermark}` : ''}` } });
            }
            catch (e) {
                fail(e);
            }
        };
        const versionBox = (v, latest) => {
            const c = v.control;
            const stt = c?.state ?? 'NONE';
            const needNote = () => { const t = val(note).trim(); if (t.length < 5) {
                invalid(note, true);
                fail(new Error('REASON_REQUIRED'));
                return null;
            } invalid(note, false); return t; };
            const actions = [btnE('ghost sm', 'dk-view', 'Önizle', () => void open(v, false)), btnE('ghost sm', 'dk-download', 'İndir', () => void open(v, true)), btnE('ghost sm', 'dk-print', 'Kontrollü yazdır', () => void doPrint(v))];
            if (stt === 'DRAFT')
                actions.push(btnE('primary sm', 'dk-submit', 'Onaya gönder', () => { const t = needNote(); if (t)
                    void act(() => api.submit(v.id, t, val(label).trim() || null), 'Onaya gönderildi.'); }));
            if (stt === 'IN_REVIEW' && !c?.reviewOk)
                actions.push(btnE('primary sm', 'dk-review-ok', 'Kontrol et: uygun', () => { const t = needNote(); if (t)
                    void act(() => api.review(v.id, true, t), 'Kontrol kaydedildi.'); }), btnE('danger sm', 'dk-review-no', 'Kontrol: reddet', () => { const t = needNote(); if (t)
                    void act(() => api.review(v.id, false, t), 'Reddedildi.'); }));
            if (stt === 'IN_REVIEW' && c?.reviewOk)
                actions.push(btnE('good sm', 'dk-approve', 'Onayla', () => { const t = needNote(); if (t)
                    void act(() => api.approve(v.id, true, t), 'Onaylandı (yürürlüğe almak için “Yürürlüğe al”).'); }), btnE('danger sm', 'dk-approve-no', 'Onayı reddet', () => { const t = needNote(); if (t)
                    void act(() => api.approve(v.id, false, t), 'Reddedildi.'); }));
            if (stt === 'APPROVED')
                actions.push(btnE('good sm', 'dk-publish', 'Yürürlüğe al (yayımla)', () => void act(() => api.publish(v.id, val(note).trim()), 'Yürürlüğe alındı — etkilenen açık işler Dağıtım bölümünde.')));
            if (stt === 'EFFECTIVE')
                actions.push(btnE('danger sm', 'dk-obsolete', 'Geçersiz kıl', () => { const t = needNote(); if (t)
                    void act(() => api.obsolete(v.id, t), 'Sürüm geçersiz kılındı.'); }));
            const ppl = c ? `Hazırlayan: ${c.preparedBy ?? '—'} · Kontrol: ${c.reviewedBy ?? '—'}${c.reviewOk === false ? ' (red)' : ''} · Onay: ${c.approvedBy ?? '—'}${c.selfApproved ? ' (kendi onayı — gerekçeli)' : ''} · Yürürlük: ${c.effectiveBy ?? '—'}` : 'Kontrol kaydı yok';
            return E('div', { class: `ver ${stt === 'EFFECTIVE' ? 'eff' : stt === 'SUPERSEDED' ? 'old' : ''}`, 'data-testid': 'dk-version', 'data-no': String(v.versionNo), 'data-state': stt, 'data-validity': v.validity }, E('div', { class: 'row' }, E('b', {}, `Sürüm ${v.versionNo}`), chip(v.validity), latest ? kchip('son sürüm', 'info') : null, c?.legacy ? kchip('eski kayıt — incelenmedi', 'warn') : null, c?.docRevisionLabel ? kchip(`belgede Rev ${c.docRevisionLabel}`) : null), stepper(stt === 'NONE' ? null : stt), E('div', { class: 'mut' }, `${v.fileName} · ${kxKb(v.sizeBytes)} · ${v.sha256.slice(0, 12)}… · ${when(v.uploadedAt)} · ${v.uploadedBy ?? '—'}${v.note ? ` · ${v.note}` : ''}${v.validUntil ? ` · geçerlilik sonu ${v.validUntil}` : ''}`), E('div', { class: 'mut' }, ppl), c?.changeReason ? E('div', { class: 'mut' }, `Değişiklik nedeni: ${c.changeReason}`) : null, c?.endedReason ? E('div', { class: 'mut' }, `Geçersiz: ${c.endedReason}${c.supersededByVersion ? ` (yerine v${c.supersededByVersion})` : ''}`) : null, v.diffFromPrevious ? E('div', { class: 'mut', 'data-testid': 'dk-diff' }, `v${v.diffFromPrevious.fromVersion} ile fark: ${v.diffFromPrevious.sameContent ? 'içerik AYNI' : 'içerik DEĞİŞTİ'} · boyut ${v.diffFromPrevious.sizeDelta >= 0 ? '+' : ''}${v.diffFromPrevious.sizeDelta} B${v.diffFromPrevious.fileNameChanged ? ' · dosya adı değişti' : ''}${v.diffFromPrevious.labelFrom !== v.diffFromPrevious.labelTo ? ` · belge revizyonu ${v.diffFromPrevious.labelFrom ?? '—'} → ${v.diffFromPrevious.labelTo ?? '—'}` : ''}`) : null, E('div', { class: 'row', style: 'margin-top:4px' }, ...actions));
        };
        const ackBox = (x) => {
            const why = h('input', { 'data-testid': 'dk-ack-reason', placeholder: 'Karar gerekçesi' });
            return h('tr', { 'data-testid': 'dk-dist', 'data-ack': x.ackState }, h('td', {}, ...(x.isPilot ? [pilotChip()] : []), x.workOrderId.slice(0, 8)), h('td', {}, x.workOrderStatus), h('td', {}, `v${x.prevVersionNo ?? '—'} → v${x.versionNo ?? '—'}${x.kind === 'INVALIDATED' ? ' (geçersiz kılındı)' : ''}`), h('td', {}, kchip(ACK_TR[x.ackState] ?? x.ackState, x.ackState === 'PENDING' ? 'bad' : ''), x.ackReason ? h('div', { class: 'mut' }, `${x.ackBy ?? ''}: ${x.ackReason}`) : null), h('td', {}, x.ackState === 'PENDING' ? E('div', { class: 'row' }, E('div', { style: 'min-width:180px;flex:1' }, why), btnE('good sm', 'dk-ack-new', 'Yeni sürüme geç', () => void act(() => api.ack(x.id, 'APPLY_NEW', val(why)), 'Karar kaydedildi.')), btnE('danger sm', 'dk-ack-old', 'Eskisiyle devam (istisna)', () => void act(() => api.ack(x.id, 'CONTINUE_ACCEPTED', val(why)), 'İstisna kaydedildi.'))) : ''));
        };
        const opNo = h('input', { 'data-testid': 'dk-op-no', type: 'number', min: '1', placeholder: 'Op no', style: 'max-width:110px' });
        const latestNo = Math.max(...lc.versions.map((v) => v.versionNo));
        const current = lc.versions.find((v) => v.versionNo === latestNo);
        const flowState = current?.control?.state ?? null;
        const uploadHost = E('div', { 'data-testid': 'dk-upload-host' });
        const showUpload = () => { if (uploadHost.childElementCount) {
            uploadHost.replaceChildren();
            return;
        } uploadHost.append(uploadCard(lc)); try {
            uploadHost.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ } };
        shell(banner, E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, E('div', { class: 'crumb' }, btnE('', 'dk-back', '← Liste', () => void go({ ...state, doc: null, banner: null }))), E('div', { class: 'row' }, h('h1', { 'data-testid': 'dk-title' }, `${d.docNo} · ${d.title}`), d.state ? chip(d.state, 'dk-doc-state') : null), E('div', { class: 'mut' }, `${typeTr(d.docType)} · ${d.productCode ? `${d.productCode} ${d.productName ?? ''} · Ürün revizyonu ${d.revision ?? '—'}` : d.entityType}${d.status === 'WITHDRAWN' ? ` · GERİ ÇEKİLDİ (${d.withdrawnReason ?? ''})` : ''}`), stepper(flowState)), E('div', { class: 'acts' }, btnE('primary', 'dk-open-version-upload', '+ Yeni sürüm yükle', showUpload))), uploadHost, E('div', { class: 'kx-grid' }, card({ title: 'Karar ve notlar', span: 12 }, E('div', { class: 'fgrid w2' }, field('Karar / neden notu (aşağıdaki işlemlerde kullanılır)', note), E('div', { class: 'stack' }, d.needsRevisionLabel ? field('Belge üzerindeki revizyon (onaya gönderirken zorunlu)', label) : null, field('Yeniden baskı gerekçesi', h('input', { 'data-testid': 'dk-print-reason', placeholder: '2. ve sonraki baskıda zorunlu' })))), E('div', { style: 'margin-top:10px' }, fold('Revizyon kuralı', [E('div', { class: 'mut' }, 'Ürün revizyonu ile belge sürümü ayrı kavramlardır: sürüm yeni dosyadır; “belgede yazan revizyon” ürün revizyonuyla eşleşmeyen belge yürürlüğe alınamaz.')]))), card({ title: 'Sürüm geçmişi', span: 12 }, E('div', { class: 'stack', 'data-testid': 'dk-versions' }, ...lc.versions.map((v) => versionBox(v, v.versionNo === latestNo))), E('div', { style: 'margin-top:10px' }, prev), printHost), card({ title: 'Dağıtım — etkilenen açık işler', testid: 'dk-dist-card', span: lc.distributions.length ? 12 : 6 }, lc.distributions.length ? E('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ...['İş emri', 'Durum', 'Sürüm', 'Karar', ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...lc.distributions.map(ackBox)))) : E('div', { class: 'mut' }, 'Henüz dağıtım kaydı yok. Başlamış bir işte yeni sürüm yayımlanırsa karar bekler ve işin başlatılması engellenir; eski işler sessizce yeni sürüme taşınmaz.')), ...(d.entityType === 'PRODUCT_REVISION' ? [card({ title: 'Operasyon bağlantıları', testid: 'dk-ops', span: 6 }, E('div', { class: 'mut' }, 'CAM föyü / NC programı gibi operasyona bağlı türlerde, bağlı operasyon yürürlükte belge olmadan başlatılamaz.'), E('div', { class: 'row', style: 'margin-top:8px' }, ...d.opLinks.map((n) => E('span', { class: 'chip info', 'data-testid': 'dk-op-chip' }, `Op ${n} `, h('a', { href: '#', 'data-testid': 'dk-op-off', onClick: (e) => { e.preventDefault(); void act(() => api.linkOperation(d.id, n, false), 'Bağlantı kaldırıldı.'); } }, '×')))), E('div', { class: 'row', style: 'margin-top:8px' }, E('div', { style: 'width:120px' }, opNo), btnE('ghost', 'dk-op-add', 'Operasyona bağla', () => void act(() => api.linkOperation(d.id, Number(val(opNo)), true), 'Operasyona bağlandı.'))))] : []), card({ title: 'Denetim izi', testid: 'dk-audit', span: 12 }, E('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Zaman', 'Olay', 'Sürüm', 'Kişi', 'Not'].map((x) => h('th', {}, x)))), h('tbody', {}, ...lc.events.map((e) => h('tr', { 'data-testid': 'dk-event', 'data-event': e.event }, h('td', {}, when(e.at)), h('td', {}, EV_TR[e.event] ?? e.event), h('td', {}, e.versionNo ? `v${e.versionNo}` : '—'), h('td', {}, e.actor), h('td', {}, e.reason ?? '')))))), lc.prints.length ? E('div', { class: 'mut', 'data-testid': 'dk-prints', style: 'margin-top:8px' }, `Baskılar: ${lc.prints.map((p) => `#${p.printNo} v${p.versionNo} ${when(p.at)} ${p.by ?? ''}${p.watermark ? ` [${p.watermark}]` : ''}${p.reason ? ` — ${p.reason}` : ''}`).join(' · ')}`) : null)));
        // yayımlanmamış en yeni sürüm için etkilenecek işler önizlemesi (010.04): onaylayan yayımlamadan önce görür
        const pend = lc.versions.find((v) => v.control?.state === 'APPROVED');
        if (pend) {
            try {
                const imp = await api.impact(pend.id);
                container.querySelector('[data-testid="dk-versions"]')?.before(E('div', { class: 'banner', 'data-testid': 'dk-impact', style: 'border-color:#b45309;background:rgba(120,53,15,.3);color:#fde68a' }, `Yayımlanırsa etkilenecek: ${imp.workOrders.length} açık iş emri (${imp.workOrders.filter((w) => w.started).length} başlamış), ${imp.orderItemsOpen ?? NA} açık sipariş kalemi, ${imp.quoteLinesOpen ?? NA} açık teklif satırı, ${imp.camPrograms ?? NA} CAM programı, ${imp.controlPlans ?? NA} kontrol planı · hazırlık: ${imp.readiness ?? '—'}`));
            }
            catch { /* etki listesi danışmandır; yalnız yetkili kullanıcılar */ }
        }
    }
}
