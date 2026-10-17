// KMI-010 — Doküman Kontrol: tek canonical doküman kimliği, değiştirilemez sürümler, taslak → inceleme → onay → yürürlük, dağıtım ve etkilenen işler,
// geçerlilik (GEÇERLİ yalnız sunucu hesabı), kontrollü baskı + filigran, dijital doğrulama, tam denetim izi. Yetki/erişim/geçerlilik SUNUCUDA; bu ekran yalnız gösterir ve çağırır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { DOCUMENT_TYPES, bytesToHex, canUploadDocument, documentType } from '../../../../packages/domain/src/documents.js';
import { guessMime } from './DocumentsScreen.js';
import { errorText } from '../errorText.js';
const CSS = `
.dk{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:1100px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.dk h1{color:#fff;font-size:20px;margin:6px 0}.dk h2{color:#fff;font-size:16px;margin:0 0 6px}
.dk button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}
.dk input,.dk textarea,.dk select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.dk .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0;overflow-wrap:anywhere}
.dk .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.dk .row>*{min-width:0}.dk .grid{display:grid;gap:8px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.dk .primary{background:#1d4ed8;color:#fff}.dk .ghost{background:#1e293b;color:#e2e8f0}.dk .danger{background:#7f1d1d;color:#fecaca}.dk .good{background:#166534;color:#dcfce7}
.dk .chip{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:11px;background:#1e293b;color:#e6edf7}
.dk .ok{background:#14532d;color:#bbf7d0}.dk .warn{background:#78350f;color:#fde68a}.dk .bad{background:#7f1d1d;color:#fecaca}.dk .info{background:#1e3a8a;color:#dbeafe}
.dk .card.bad{background:#0f172a;border-color:#b91c1c}.dk .card.ok{background:#0f172a;border-color:#15803d}.dk .card.warn{background:#0f172a;border-color:#b45309}
.dk .mut{color:#94a3b8;font-size:12px}.dk label{font-size:12px;color:#94a3b8;display:block}
.dk .tw{overflow-x:auto}.dk table{border-collapse:collapse;width:100%;font-size:13px}.dk th,.dk td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left}.dk th{color:#94a3b8;white-space:nowrap}
.dk .ver{border:1px solid #1e293b;border-radius:12px;padding:10px;margin:8px 0}.dk .ver.eff{border-color:#15803d}.dk .ver.old{opacity:.8}
.dk iframe,.dk .prev img{width:100%;min-height:360px;border:1px solid #334155;border-radius:10px;background:#fff}.dk pre{white-space:pre-wrap;background:#0b1220;padding:8px;border-radius:8px;max-height:320px;overflow:auto}
.dk-print{display:none}
@media print{body *{visibility:hidden}.dk-print,.dk-print *{visibility:visible}.dk-print{display:block;position:absolute;inset:0;background:#fff;color:#000;padding:20px;font-family:system-ui,sans-serif}}
.dk-print .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #b88718;padding-bottom:8px;margin-bottom:12px}.dk-print .hd b{letter-spacing:.12em;font-size:18px}
.dk-print table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}.dk-print th,.dk-print td{border:1px solid #999;padding:4px 6px;text-align:left}
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
const kb = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
function fromBase64(b64) { const s = atob(b64); const out = new Uint8Array(new ArrayBuffer(s.length)); for (let i = 0; i < s.length; i += 1)
    out[i] = s.charCodeAt(i); return out; }
export async function renderDocumentControlScreen(container, api, state = {}) {
    const go = (s) => renderDocumentControlScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'dk', 'data-testid': 'dk-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'dk-banner', 'data-kind': state.banner.kind }, state.banner.text) : null;
    const fail = (e) => {
        const text = errorText(e);
        const root = container.querySelector('[data-testid="dk-root"]');
        let b = container.querySelector('[data-testid="dk-banner"]');
        if (!b && root) {
            b = h('div', { class: 'card bad', 'data-testid': 'dk-banner', 'data-kind': 'error' }, text);
            const first = [...root.children].find((c) => c.tagName !== 'STYLE');
            root.insertBefore(b, first?.nextSibling ?? null);
        }
        else if (b) {
            b.textContent = text;
            b.className = 'card bad';
            b.setAttribute('data-kind', 'error');
        }
        try {
            b?.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    const chip = (v, testid = 'dk-validity') => { const [t, c] = validityText(v); return h('span', { class: `chip ${c}`, 'data-testid': testid, 'data-value': v ?? '' }, t); };
    if (state.doc)
        return renderDetail(state.doc);
    return renderHome();
    // ------------------------------------------------------------------------------------------------ home: list · verify · upload
    async function renderHome() {
        let rows = [];
        let err = null;
        try {
            rows = await api.list(state.q ?? '', state.state ?? '', !!state.all);
        }
        catch (e) {
            err = errorText(e);
        }
        const q = h('input', { 'data-testid': 'dk-q', placeholder: 'Doküman no · ürün kodu · başlık', value: state.q ?? '' });
        const st = h('select', { 'data-testid': 'dk-state' }, ...[['', 'Tüm durumlar'], ['DRAFT', 'Taslak'], ['IN_REVIEW', 'Onay bekliyor'], ['APPROVED', 'Onaylı · yayımlanmadı'], ['EFFECTIVE', 'Geçerli'], ['SUPERSEDED', 'Geçersiz'], ['REJECTED', 'Reddedildi']].map(([v, l]) => h('option', { value: v, ...(v === (state.state ?? '') ? { selected: 'selected' } : {}) }, l)));
        const all = h('input', { type: 'checkbox', 'data-testid': 'dk-all', ...(state.all ? { checked: 'checked' } : {}), style: 'width:auto;min-height:auto' });
        const vin = h('input', { 'data-testid': 'dk-verify-input', placeholder: 'Çıktıdaki Doküman no (DOC-000123) veya QR kodu', value: state.verify ?? '' });
        const vout = h('div', { 'data-testid': 'dk-verify-result' });
        const verify = async () => {
            try {
                const r = await api.verify(val(vin));
                vout.replaceChildren();
                vout.append(h('div', { class: `card ${r.isValid ? 'ok' : 'bad'}`, 'data-valid': String(!!r.isValid) }, h('b', {}, r.message), r.found ? h('div', { class: 'mut' }, `${r.docNo} · ${r.title} · sürüm ${r.versionNo}${r.currentVersionNo ? ` · güncel sürüm ${r.currentVersionNo}` : ''}`) : null));
            }
            catch (e) {
                fail(e);
            }
        };
        const apply = () => void go({ ...state, q: val(q), state: val(st), all: all.checked, banner: null, verify: val(vin) });
        const card = (r) => h('div', { class: 'card', 'data-testid': 'dk-row', 'data-id': r.id, 'data-state': r.state ?? 'NONE' }, h('div', { class: 'row' }, h('b', {}, r.docNo), r.state ? chip(r.state, 'dk-row-state') : h('span', { class: 'chip' }, 'Kontrolsüz'), r.legacy ? h('span', { class: 'chip warn', 'data-testid': 'dk-legacy' }, 'ESKİ KAYIT — İNCELENMEDİ') : null, r.effectiveVersionNo && r.effectiveValidity && r.effectiveValidity !== 'EFFECTIVE' ? chip(r.effectiveValidity, 'dk-row-invalid') : null), h('div', {}, r.title, h('span', { class: 'mut' }, ` · ${typeTr(r.docType)}`)), h('div', { class: 'mut' }, `${r.productCode ? `${r.productCode} · ${r.productName ?? ''} · Rev ${r.revision ?? '—'}` : r.entityType} · son sürüm v${r.latestVersionNo ?? '—'}${r.effectiveVersionNo ? ` · yürürlükte v${r.effectiveVersionNo}` : ' · yürürlükte sürüm YOK'}${r.opLinks.length ? ` · operasyon ${r.opLinks.join(', ')}` : ''}`), h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'primary', type: 'button', 'data-testid': 'dk-open', onClick: () => void go({ ...state, doc: r.id, banner: null }) }, 'Aç')));
        shell(banner, h('h1', {}, 'Doküman Kontrol'), h('div', { class: 'mut' }, 'Teknik belgeler yalnız onaylı ve yürürlükteki sürümle üretimde geçerlidir. Geçerlilik sunucuda hesaplanır; belirsiz olan GEÇERLİ sayılmaz.'), h('div', { class: 'card', 'data-testid': 'dk-verify' }, h('h2', {}, 'Çıktı geçerli mi? (dijital doğrulama)'), h('div', { class: 'row' }, vin, h('button', { class: 'primary', type: 'button', 'data-testid': 'dk-verify-btn', onClick: () => void verify() }, 'Doğrula')), vout, h('div', { class: 'mut' }, 'Kâğıt çıktının hâlâ geçerli olduğu yalnızca bu kontrolle anlaşılır; baskı tarihi tek başına karar vermez.')), h('div', { class: 'card' }, h('div', { class: 'row' }, q, st, h('label', { style: 'display:flex;gap:6px;align-items:center' }, all, 'Kontrolsüz türleri de göster'), h('button', { class: 'ghost', type: 'button', 'data-testid': 'dk-apply', onClick: apply }, 'Ara / Süz'))), err ? h('div', { class: 'card bad', 'data-testid': 'dk-error' }, err) : null, h('div', { 'data-testid': 'dk-list' }, ...(rows.length ? rows.map(card) : [h('div', { class: 'card', 'data-testid': 'dk-empty' }, 'Bu süzgeçle doküman yok.')])), uploadCard(null));
    }
    // ------------------------------------------------------------------------------------------------ upload (new document from the product card, or a new version)
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
            if (!f)
                return fail(new Error('CONTENT_REQUIRED'));
            const entityId = lc ? lc.document.entityId : val(rev);
            if (!entityId)
                return fail(new Error('ENTITY_REQUIRED'));
            const bytes = new Uint8Array(await f.arrayBuffer());
            const mime = guessMime(f.name, f.type);
            const docType = lc ? lc.document.docType : val(type);
            const sha = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
            const pre = canUploadDocument({ docType, entityType: 'PRODUCT_REVISION', entityExists: true, title: lc ? null : (val(title) || typeTr(docType)), fileName: f.name, mime, bytes, validUntil: val(until) || null, today: today(), canSeeSensitivity: () => true,
                existing: lc ? { status: lc.document.status, docType, hashes: lc.versions.map((v) => v.sha256) } : null, sha256Hex: sha });
            if (!pre.ok)
                return fail(new Error(pre.reason));
            try {
                const r = await api.upload({ docType, entityType: 'PRODUCT_REVISION', entityId, title: lc ? null : (val(title).trim() || `${typeTr(docType)} ${val(prod).trim()}`), fileName: f.name, mimeType: mime, contentBase64: toBase64(bytes), validUntil: val(until) || null, note: val(note).trim() || null, documentId: lc ? lc.document.id : null });
                void go({ doc: lc ? lc.document.id : r.documentId, banner: { kind: 'ok', text: `Yüklendi: sürüm ${r.versionNo} — TASLAK olarak. Üretimde geçerli olması için onaya gönderilip yürürlüğe alınmalı. Parmak izi ${r.sha256.slice(0, 12)}…` } });
            }
            catch (e) {
                fail(e);
            }
        };
        return h('div', { class: 'card', 'data-testid': lc ? 'dk-version-upload' : 'dk-upload' }, h('h2', {}, lc ? 'Yeni sürüm yükle (eskisi silinmez)' : 'Yeni doküman yükle'), lc ? null : h('div', { class: 'grid' }, h('div', {}, h('label', {}, 'Ürün'), prod, plist), h('div', {}, h('label', {}, 'Ürün revizyonu'), rev), h('div', {}, h('label', {}, 'Doküman türü'), type), h('div', {}, h('label', {}, 'Başlık'), title)), h('div', { class: 'grid' }, h('div', {}, h('label', {}, 'Dosya'), file), h('div', {}, h('label', {}, 'Geçerlilik sonu (varsa)'), until), h('div', {}, h('label', {}, lc ? 'Değişiklik notu' : 'Not'), note)), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'primary', type: 'button', 'data-testid': lc ? 'dk-version-save' : 'dk-up-save', onClick: () => void save() }, 'Yükle (TASLAK)')));
    }
    // ------------------------------------------------------------------------------------------------ detail
    async function renderDetail(docId) {
        let lc;
        try {
            lc = await api.lifecycle(docId);
        }
        catch (e) {
            shell(banner, h('button', { class: 'ghost', type: 'button', 'data-testid': 'dk-back', onClick: () => void go({ ...state, doc: null, banner: null }) }, '← Liste'), h('div', { class: 'card bad', 'data-testid': 'dk-error' }, errorText(e)));
            return;
        }
        const d = lc.document;
        const prev = h('div', { class: 'prev', 'data-testid': 'dk-preview' });
        const note = h('textarea', { 'data-testid': 'dk-note', rows: '2', placeholder: 'Neden / karar notu (en az 5 karakter)', style: 'min-height:60px;padding:8px' });
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
                const bytes = fromBase64(c.contentBase64);
                const local = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
                const okBoth = c.integrityOk && local === c.sha256;
                prev.replaceChildren();
                prev.append(h('div', { class: `card ${okBoth ? 'ok' : 'bad'}`, 'data-testid': 'dk-integrity', 'data-ok': String(okBoth) }, okBoth ? `Dosya açıldı · bütünlük doğrulandı (${c.sha256.slice(0, 12)}…) · durum: ${validityText(c.validity)[0]}` : 'BÜTÜNLÜK HATASI — dosya bozuk, KULLANMAYIN'));
                if (!okBoth)
                    return;
                const url = URL.createObjectURL(new Blob([bytes], { type: c.mimeType }));
                if (download) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = c.fileName;
                    a.dataset.testid = 'dk-download-link';
                    a.textContent = `İndirilen: ${c.fileName}`;
                    prev.append(a);
                    a.click?.();
                    return;
                }
                if (c.mimeType === 'application/pdf')
                    prev.append(h('iframe', { src: url, title: c.fileName, 'data-testid': 'dk-frame' }));
                else if (c.mimeType.startsWith('image/'))
                    prev.append(h('img', { src: url, alt: c.fileName, 'data-testid': 'dk-img' }));
                else
                    prev.append(h('pre', { 'data-testid': 'dk-text' }, new TextDecoder().decode(bytes.subarray(0, 20000))));
            }
            catch (e) {
                fail(e);
            }
        };
        const printHost = h('div', { class: 'dk-print', 'data-testid': 'dk-print-sheet' });
        const doPrint = async (v) => {
            const why = container.querySelector('[data-testid="dk-print-reason"]')?.value ?? '';
            try {
                const s = await api.printBegin(v.id, 'Atölye', why);
                const qr = qrToSvg(encodeQr(s.verifyRef));
                const qrBox = h('div', { 'data-testid': 'dk-print-qr' });
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
                // the file itself follows the cover sheet when it is an image (a PDF body cannot be re-stamped in the browser; the cover sheet + digital check carries the control information)
                const c = await api.content(v.id);
                if (c.mimeType.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.style.maxWidth = '100%';
                    img.src = URL.createObjectURL(new Blob([fromBase64(c.contentBase64)], { type: c.mimeType }));
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
            const btn = (cls, testid, text, fn) => h('button', { class: cls, type: 'button', 'data-testid': testid, onClick: fn }, text);
            const needNote = () => { const t = val(note).trim(); if (t.length < 5) {
                fail(new Error('REASON_REQUIRED'));
                return null;
            } return t; };
            const actions = [btn('ghost', 'dk-view', 'Önizle', () => void open(v, false)), btn('ghost', 'dk-download', 'İndir', () => void open(v, true)),
                btn('ghost', 'dk-print', 'Kontrollü yazdır', () => void doPrint(v))];
            if (stt === 'DRAFT')
                actions.push(btn('primary', 'dk-submit', 'Onaya gönder', () => { const t = needNote(); if (t)
                    void act(() => api.submit(v.id, t, val(label).trim() || null), 'Onaya gönderildi.'); }));
            if (stt === 'IN_REVIEW' && !c?.reviewOk)
                actions.push(btn('primary', 'dk-review-ok', 'Kontrol et: uygun', () => { const t = needNote(); if (t)
                    void act(() => api.review(v.id, true, t), 'Kontrol kaydedildi.'); }), btn('danger', 'dk-review-no', 'Kontrol: reddet', () => { const t = needNote(); if (t)
                    void act(() => api.review(v.id, false, t), 'Reddedildi.'); }));
            if (stt === 'IN_REVIEW' && c?.reviewOk)
                actions.push(btn('good', 'dk-approve', 'Onayla', () => { const t = needNote(); if (t)
                    void act(() => api.approve(v.id, true, t), 'Onaylandı (yürürlüğe almak için “Yürürlüğe al”).'); }), btn('danger', 'dk-approve-no', 'Onayı reddet', () => { const t = needNote(); if (t)
                    void act(() => api.approve(v.id, false, t), 'Reddedildi.'); }));
            if (stt === 'APPROVED')
                actions.push(btn('good', 'dk-publish', 'Yürürlüğe al (yayımla)', () => void act(() => api.publish(v.id, val(note).trim()), 'Yürürlüğe alındı — etkilenen açık işler Dağıtım bölümünde.')));
            if (stt === 'EFFECTIVE')
                actions.push(btn('danger', 'dk-obsolete', 'Geçersiz kıl', () => { const t = needNote(); if (t)
                    void act(() => api.obsolete(v.id, t), 'Sürüm geçersiz kılındı.'); }));
            const ppl = c ? `Hazırlayan: ${c.preparedBy ?? '—'} · Kontrol: ${c.reviewedBy ?? '—'}${c.reviewOk === false ? ' (red)' : ''} · Onay: ${c.approvedBy ?? '—'}${c.selfApproved ? ' (kendi onayı — gerekçeli)' : ''} · Yürürlük: ${c.effectiveBy ?? '—'}` : 'Kontrol kaydı yok';
            return h('div', { class: `ver ${stt === 'EFFECTIVE' ? 'eff' : stt === 'SUPERSEDED' ? 'old' : ''}`, 'data-testid': 'dk-version', 'data-no': String(v.versionNo), 'data-state': stt, 'data-validity': v.validity }, h('div', { class: 'row' }, h('b', {}, `Sürüm ${v.versionNo}`), chip(v.validity), latest ? h('span', { class: 'chip info' }, 'son sürüm') : null, c?.legacy ? h('span', { class: 'chip warn' }, 'eski kayıt — incelenmedi') : null, c?.docRevisionLabel ? h('span', { class: 'chip' }, `belgede Rev ${c.docRevisionLabel}`) : null), h('div', { class: 'mut' }, `${v.fileName} · ${kb(v.sizeBytes)} · ${v.sha256.slice(0, 12)}… · ${when(v.uploadedAt)} · ${v.uploadedBy ?? '—'}${v.note ? ` · ${v.note}` : ''}${v.validUntil ? ` · geçerlilik sonu ${v.validUntil}` : ''}`), h('div', { class: 'mut' }, ppl), c?.changeReason ? h('div', { class: 'mut' }, `Değişiklik nedeni: ${c.changeReason}`) : null, c?.endedReason ? h('div', { class: 'mut' }, `Geçersiz: ${c.endedReason}${c.supersededByVersion ? ` (yerine v${c.supersededByVersion})` : ''}`) : null, v.diffFromPrevious ? h('div', { class: 'mut', 'data-testid': 'dk-diff' }, `v${v.diffFromPrevious.fromVersion} ile fark: ${v.diffFromPrevious.sameContent ? 'içerik AYNI' : 'içerik DEĞİŞTİ'} · boyut ${v.diffFromPrevious.sizeDelta >= 0 ? '+' : ''}${v.diffFromPrevious.sizeDelta} B${v.diffFromPrevious.fileNameChanged ? ' · dosya adı değişti' : ''}${v.diffFromPrevious.labelFrom !== v.diffFromPrevious.labelTo ? ` · belge revizyonu ${v.diffFromPrevious.labelFrom ?? '—'} → ${v.diffFromPrevious.labelTo ?? '—'}` : ''}`) : null, h('div', { class: 'row', style: 'margin-top:6px' }, ...actions));
        };
        const ackBox = (x) => {
            const why = h('input', { 'data-testid': 'dk-ack-reason', placeholder: 'Karar gerekçesi' });
            return h('tr', { 'data-testid': 'dk-dist', 'data-ack': x.ackState }, h('td', {}, x.workOrderId.slice(0, 8)), h('td', {}, x.workOrderStatus), h('td', {}, `v${x.prevVersionNo ?? '—'} → v${x.versionNo ?? '—'}${x.kind === 'INVALIDATED' ? ' (geçersiz kılındı)' : ''}`), h('td', {}, h('span', { class: `chip ${x.ackState === 'PENDING' ? 'bad' : ''}` }, ACK_TR[x.ackState] ?? x.ackState), x.ackReason ? h('div', { class: 'mut' }, `${x.ackBy ?? ''}: ${x.ackReason}`) : null), h('td', {}, x.ackState === 'PENDING' ? h('div', { class: 'row' }, why, h('button', { class: 'good', type: 'button', 'data-testid': 'dk-ack-new', onClick: () => void act(() => api.ack(x.id, 'APPLY_NEW', val(why)), 'Karar kaydedildi.') }, 'Yeni sürüme geç'), h('button', { class: 'danger', type: 'button', 'data-testid': 'dk-ack-old', onClick: () => void act(() => api.ack(x.id, 'CONTINUE_ACCEPTED', val(why)), 'İstisna kaydedildi.') }, 'Eskisiyle devam (istisna)')) : ''));
        };
        const opNo = h('input', { 'data-testid': 'dk-op-no', type: 'number', min: '1', placeholder: 'Op no', style: 'max-width:110px' });
        const latestNo = Math.max(...lc.versions.map((v) => v.versionNo));
        shell(banner, h('div', { class: 'row' }, h('button', { class: 'ghost', type: 'button', 'data-testid': 'dk-back', onClick: () => void go({ ...state, doc: null, banner: null }) }, '← Liste'), h('h1', { 'data-testid': 'dk-title' }, `${d.docNo} · ${d.title}`), d.state ? chip(d.state, 'dk-doc-state') : null), h('div', { class: 'mut' }, `${typeTr(d.docType)} · ${d.productCode ? `${d.productCode} ${d.productName ?? ''} · Ürün revizyonu ${d.revision ?? '—'}` : d.entityType}${d.status === 'WITHDRAWN' ? ` · GERİ ÇEKİLDİ (${d.withdrawnReason ?? ''})` : ''}`), h('div', { class: 'mut' }, 'Ürün revizyonu ile belge sürümü ayrı kavramlardır: sürüm yeni dosyadır; “belgede yazan revizyon” ürün revizyonuyla eşleşmeyen belge yürürlüğe alınamaz.'), h('div', { class: 'card' }, h('label', {}, 'Karar / neden notu (aşağıdaki işlemlerde kullanılır)'), note, d.needsRevisionLabel ? h('div', {}, h('label', {}, 'Belge üzerindeki revizyon (onaya gönderirken zorunlu)'), label) : null, h('div', { class: 'row', style: 'margin-top:6px' }, h('input', { 'data-testid': 'dk-print-reason', placeholder: 'Yeniden baskı gerekçesi (2. ve sonraki baskıda zorunlu)' }))), h('h2', {}, 'Sürüm geçmişi'), h('div', { 'data-testid': 'dk-versions' }, ...lc.versions.map((v) => versionBox(v, v.versionNo === latestNo))), prev, printHost, uploadCard(lc), h('div', { class: 'card', 'data-testid': 'dk-dist-card' }, h('h2', {}, 'Dağıtım — etkilenen açık işler'), lc.distributions.length ? h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ...['İş emri', 'Durum', 'Sürüm', 'Karar', ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...lc.distributions.map(ackBox)))) : h('div', { class: 'mut' }, 'Henüz dağıtım kaydı yok. Başlamış bir işte yeni sürüm yayımlanırsa karar bekler ve işin başlatılması engellenir; eski işler sessizce yeni sürüme taşınmaz.')), d.entityType === 'PRODUCT_REVISION' ? h('div', { class: 'card', 'data-testid': 'dk-ops' }, h('h2', {}, 'Operasyon bağlantıları'), h('div', { class: 'mut' }, 'CAM föyü / NC programı gibi operasyona bağlı türlerde, bağlı operasyon yürürlükte belge olmadan başlatılamaz.'), h('div', { class: 'row' }, ...d.opLinks.map((n) => h('span', { class: 'chip info', 'data-testid': 'dk-op-chip' }, `Op ${n} `, h('a', { href: '#', 'data-testid': 'dk-op-off', onClick: (e) => { e.preventDefault(); void act(() => api.linkOperation(d.id, n, false), 'Bağlantı kaldırıldı.'); } }, '×')))), h('div', { class: 'row', style: 'margin-top:6px' }, opNo, h('button', { class: 'ghost', type: 'button', 'data-testid': 'dk-op-add', onClick: () => void act(() => api.linkOperation(d.id, Number(val(opNo)), true), 'Operasyona bağlandı.') }, 'Operasyona bağla'))) : null, h('div', { class: 'card', 'data-testid': 'dk-audit' }, h('h2', {}, 'Denetim izi'), h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, ...['Zaman', 'Olay', 'Sürüm', 'Kişi', 'Not'].map((x) => h('th', {}, x)))), h('tbody', {}, ...lc.events.map((e) => h('tr', { 'data-testid': 'dk-event', 'data-event': e.event }, h('td', {}, when(e.at)), h('td', {}, EV_TR[e.event] ?? e.event), h('td', {}, e.versionNo ? `v${e.versionNo}` : '—'), h('td', {}, e.actor), h('td', {}, e.reason ?? '')))))), lc.prints.length ? h('div', { class: 'mut', 'data-testid': 'dk-prints' }, `Baskılar: ${lc.prints.map((p) => `#${p.printNo} v${p.versionNo} ${when(p.at)} ${p.by ?? ''}${p.watermark ? ` [${p.watermark}]` : ''}${p.reason ? ` — ${p.reason}` : ''}`).join(' · ')}`) : null));
        // the affected-jobs preview for the newest unpublished version (010.04): shown for approvers before they publish
        const pend = lc.versions.find((v) => v.control?.state === 'APPROVED');
        if (pend) {
            try {
                const imp = await api.impact(pend.id);
                container.querySelector('[data-testid="dk-versions"]')?.before(h('div', { class: 'card warn', 'data-testid': 'dk-impact' }, `Yayımlanırsa etkilenecek: ${imp.workOrders.length} açık iş emri (${imp.workOrders.filter((w) => w.started).length} başlamış), ${imp.orderItemsOpen ?? NA} açık sipariş kalemi, ${imp.quoteLinesOpen ?? NA} açık teklif satırı, ${imp.camPrograms ?? NA} CAM programı, ${imp.controlPlans ?? NA} kontrol planı · hazırlık: ${imp.readiness ?? '—'}`));
            }
            catch { /* impact is advisory; privileged users only */ }
        }
    }
}
