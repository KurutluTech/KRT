// KMI-CARD-004 — passport STORE panels (photo, structured values, documents) for the hub topic pages.
// ONE FACT → ONE SOURCE: values live in passport_values (versioned, append-only), files in the KMI-010 document store; a panel only shows and writes through the canonical RPCs.
// iPhone-Settings style: a topic page shows READABLE rows first; changing anything is ONE edit mode for the whole panel (one reason, one save) — no Edit/History button on every row.
import { h } from '../../../../packages/ui/src/h.js';
import { PASSPORT_DOC_TYPES } from '../passportCardsApi.js';
import { errorText } from '../errorText.js';
import { emptyState, field, fold, fromBase64, kb, showFile, toBase64, when } from '../kx.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const btn = (cls, testid, text, fn) => E('button', { class: cls, type: 'button', ...(testid ? { 'data-testid': testid } : {}), onClick: fn }, text);
const showVal = (a) => (a.value === null || a.value === '' ? null : a.kind === 'BOOL' ? (a.value === 'true' ? 'Evet' : 'Hayır') : `${a.value}${a.unit ? ` ${a.unit}` : ''}`);
const panel = (title, testid, head, ...body) => E('section', { class: 'ps-panel', 'data-testid': testid }, E('div', { class: 'ps-panel-h' }, E('h2', {}, title), head), ...body);
export const PANEL_CSS = `
.ps-panel{border:1px solid var(--kmi-line,#1e2d4a);border-radius:16px;background:linear-gradient(180deg,var(--kmi-panel2,#14213a),var(--kmi-panel,#0f1a30));padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-width:0}
.ps-panel-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.ps-panel-h h2{margin:0;font-size:17px;color:var(--kmi-text,#fff)}
.ps-menu{position:relative}.ps-menu summary{list-style:none;cursor:pointer;min-height:40px;display:inline-flex;align-items:center;padding:0 14px;border-radius:10px;border:1px solid var(--kmi-line2,#334155);color:var(--kmi-text2,#cbd5e1);font-weight:700;font-size:14px;background:transparent}
.ps-menu summary::-webkit-details-marker{display:none}.ps-menu[open] summary{border-color:var(--kmi-info,#38bdf8)}
.ps-menu .ps-menu-list{position:absolute;right:0;z-index:5;margin-top:6px;min-width:220px;background:var(--kmi-panel,#0f1a30);border:1px solid var(--kmi-line2,#334155);border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:2px;box-shadow:0 12px 30px rgba(2,6,23,.5)}
.ps-menu .ps-menu-list button{min-height:44px;text-align:left;background:transparent;border:0;color:var(--kmi-text,#fff);font-size:15px;padding:0 12px;border-radius:8px;cursor:pointer}.ps-menu .ps-menu-list button:hover{background:rgba(56,189,248,.12)}
.ps-rows{display:flex;flex-direction:column}.ps-row{display:grid;grid-template-columns:minmax(130px,230px) 1fr;gap:4px 14px;padding:11px 0;border-top:1px solid var(--kmi-line,#1e2d4a);align-items:baseline}.ps-row:first-child{border-top:0}
@media (max-width:640px){.ps-row{grid-template-columns:1fr}}
.ps-k{color:var(--kmi-mut,#94a3b8);font-size:13px}.ps-v{color:var(--kmi-text,#fff);font-size:16px;overflow-wrap:anywhere}.ps-v.na{color:var(--kmi-mut,#64748b);font-style:italic;font-size:14px}.ps-meta{font-size:12px;color:var(--kmi-mut,#64748b);margin-left:8px}
.ps-edit{display:grid;gap:10px 14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));padding:6px 0}.ps-edit label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--kmi-text2,#cbd5e1)}
.ps-edit input,.ps-edit select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid var(--kmi-line2,#334155);background:rgba(2,6,23,.4);color:inherit;padding:0 10px}
.ps-actions-row{display:flex;gap:10px;flex-wrap:wrap}.ps-hist{font-size:13px;color:var(--kmi-text2,#cbd5e1);display:flex;flex-direction:column}.ps-hist div{padding:6px 0;border-top:1px dashed var(--kmi-line,#1e2d4a)}
.ps-photo{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.ps-photo .ph{width:120px;height:120px;border-radius:16px;border:1px solid var(--kmi-line,#1e2d4a);background:rgba(2,6,23,.4);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--kmi-mut,#64748b);font-size:12px;text-align:center}
.ps-photo .ph img{width:100%;height:100%;object-fit:cover}
.ps-doc{display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:10px 0;border-top:1px solid var(--kmi-line,#1e2d4a);align-items:center}.ps-doc:first-child{border-top:0}.ps-doc .acts{display:flex;gap:6px;flex-wrap:wrap}
@media (max-width:640px){.ps-doc{grid-template-columns:1fr}}
`;
/** Photo / logo / ID-media slot with upload (only when the person may edit). */
export function photoPanel(c, title = 'Fotoğraf') {
    const box = E('div', { class: 'ph', 'data-testid': 'ppw-photo' }, 'Fotoğraf yok');
    const p = c.card.photo;
    if (p)
        void c.api.content(p.versionId).then((x) => { box.replaceChildren(E('img', { alt: c.label, src: `data:${x.mimeType};base64,${x.contentBase64}`, 'data-testid': 'ppw-photo-img' })); }).catch(() => undefined);
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'data-testid': 'ppw-photo-file' });
    const save = async () => {
        const f = file.files?.[0];
        if (!f) {
            c.notify('error', 'Önce bir görsel seçin');
            return;
        }
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
            c.notify('error', 'Yalnız PNG, JPEG veya WEBP');
            return;
        }
        if (f.size > 8 * 1024 * 1024) {
            c.notify('error', 'Dosya 8 MB sınırını aşıyor');
            return;
        }
        try {
            await c.api.upload(c.type, c.id, 'ASSET_PHOTO', `${c.label} fotoğrafı`, f.name, f.type, toBase64(new Uint8Array(await f.arrayBuffer())), p ? 'Fotoğraf değişti' : null, p?.documentId ?? null);
            c.reload({ kind: 'ok', text: 'Fotoğraf kaydedildi.' });
        }
        catch (e) {
            c.notify('error', errorText(e));
        }
    };
    return panel(title, 'ps-photo-panel', null, E('div', { class: 'ps-photo' }, box, c.card.can.edit ? E('div', { class: 'ps-actions-row' }, file, btn('ghost', 'ppw-photo-save', p ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle', () => void save())) : E('div', { class: 'ps-k' }, 'Fotoğraf eklemek için düzenleme yetkisi gerekir.')));
}
/** Structured values (versioned). `codes` limits the panel to one topic's attributes; null = all the entity's attributes. */
export function attrsPanel(c, title, codes, opts = {}) {
    const attrs = (codes ? codes.map((k) => c.card.attributes.find((a) => a.code === k)).filter((a) => !!a) : c.card.attributes);
    const tech = c.type === 'MACHINE' || c.type === 'PRODUCT'; // 0130: technical identity values carry no validity date and no mandatory reason; every save is still logged (who / when / before / after)
    const rows = E('div', { class: 'ps-rows', 'data-testid': 'ps-attr-rows' });
    const editable = attrs.filter((a) => a.editable);
    const inputs = new Map();
    const histHost = E('div', { class: 'ps-hist', 'data-testid': 'ps-hist', style: 'display:none' });
    const editHost = E('div', { 'data-testid': 'ps-edit-host', style: 'display:none' });
    const paintRead = () => rows.replaceChildren(...attrs.map((a) => {
        const v = showVal(a);
        return E('div', { class: 'ps-row', 'data-testid': 'ppw-attr', 'data-code': a.code }, E('div', { class: 'ps-k' }, a.label), E('div', { class: `ps-v${v ? '' : ' na'}`, 'data-testid': 'ps-attr-value' }, v ?? 'VERİ YOK', a.versionNo ? E('span', { class: 'ps-meta' }, `v${a.versionNo}${a.validFrom && !tech ? ` · ${a.validFrom}` : ''}`) : null));
    }));
    paintRead();
    const openEdit = () => {
        if (editHost.style.display !== 'none') {
            editHost.style.display = 'none';
            editHost.replaceChildren();
            return;
        }
        inputs.clear();
        const reason = h('input', { 'data-testid': 'ppw-reason', placeholder: 'Gerekçe (en az 5 karakter)', maxlength: 300 });
        const todayIso = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
        const from = h('input', { 'data-testid': 'ppw-valid-from', type: 'date', max: new Date(Date.now() + 366 * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) });
        const fields = editable.map((a) => { const inp = h('input', { 'data-testid': 'ppw-value', 'data-code': a.code, value: a.value ?? '', type: a.kind === 'DATE' ? 'date' : 'text', inputmode: a.code === 'MODEL_YEAR' ? 'numeric' : a.kind === 'NUMBER' ? 'decimal' : undefined, ...(a.code === 'MODEL_YEAR' ? { maxlength: 4, placeholder: 'örn. 2020 — bilinmiyorsa boş bırakın' } : {}) }); inputs.set(a.code, inp); return field(`${a.label}${a.unit ? ` (${a.unit})` : ''}`, inp); });
        const save = async () => {
            const changed = editable.filter((a) => (inputs.get(a.code)?.value ?? '') !== (a.value ?? ''));
            if (!changed.length) {
                c.notify('info', 'Değişen alan yok.');
                return;
            }
            const my = changed.find((a) => a.code === 'MODEL_YEAR');
            if (my) {
                const yv = (inputs.get('MODEL_YEAR')?.value ?? '').trim();
                if (!/^[0-9]{4}$/.test(yv) || Number(yv) < 1950 || Number(yv) > Number(todayIso.slice(0, 4)) + 1) {
                    inputs.get('MODEL_YEAR')?.setAttribute('aria-invalid', 'true');
                    c.notify('error', 'Model yılı dört haneli bir yıl olmalıdır (ör. 2020). Bilinmiyorsa boş bırakın; tahmin girmeyin.');
                    return;
                }
            }
            if (!tech && reason.value.trim().length < 5) {
                reason.setAttribute('aria-invalid', 'true');
                c.notify('error', 'Gerekçe en az 5 karakter olmalı');
                return;
            }
            try {
                for (const a of changed)
                    await c.api.setValue(c.type, c.id, a.code, inputs.get(a.code).value, a.unit, tech ? null : from.value || null, tech ? null : reason.value.trim());
                c.reload({ kind: 'ok', text: `${changed.length} alan kaydedildi.` });
            }
            catch (e) {
                c.notify('error', errorText(e));
            }
        };
        editHost.replaceChildren(E('div', { class: 'ps-edit' }, ...fields, ...(tech ? [] : [field('Geçerlilik başlangıcı', from, 'Boşsa bugün. Eski tarihli hesaplar eski değerle kalır.'), field('Gerekçe', reason)])), E('div', { class: 'ps-actions-row' }, btn('primary', 'ppw-save', 'Kaydet', () => void save()), btn('ghost', null, 'Vazgeç', () => openEdit())));
        editHost.style.display = '';
    };
    const showHistory = async () => {
        if (histHost.style.display !== 'none') {
            histHost.style.display = 'none';
            return;
        }
        try {
            const all = await Promise.all(attrs.filter((a) => a.versionNo).map(async (a) => (await c.api.history(c.type, c.id, a.code)).map((r) => ({ a, r }))));
            const flat = all.flat().sort((x, y) => (y.r.changedAt > x.r.changedAt ? 1 : -1));
            histHost.replaceChildren(...(flat.length ? flat.map(({ a, r }) => E('div', { 'data-testid': 'ppw-hist' }, `${a.label}: v${r.versionNo} → ${r.value ?? '—'}${r.unit ? ` ${r.unit}` : ''} · ${tech ? '' : `geçerlilik ${r.validFrom} · `}${r.changedBy ?? '?'} · ${when(r.changedAt)} · “${r.reason}”`)) : [E('div', {}, 'Değişiklik kaydı yok')]));
            histHost.style.display = '';
        }
        catch (e) {
            c.notify('error', errorText(e));
        }
    };
    const menu = attrs.length ? E('details', { class: 'ps-menu', 'data-testid': 'ps-menu' }, E('summary', {}, 'İşlemler ▾'), E('div', { class: 'ps-menu-list' }, editable.length ? btn('', 'ps-menu-edit', 'Düzenle…', () => { menu.open = false; openEdit(); }) : null, btn('', 'ps-menu-history', 'Değişiklik geçmişi', () => { menu.open = false; void showHistory(); }))) : null;
    return panel(title, opts.testid ?? 'ps-attrs-panel', menu, attrs.length ? rows : emptyState(opts.empty ?? 'Gösterilecek alan yok', undefined, 'ppw-no-attrs'), editHost, histHost);
}
/** Documents of this entity (KMI-010 store). `types` limits the panel to the document types of one topic. */
export function docsPanel(c, title, types, opts = {}) {
    const docs = c.card.documents.filter((d) => !types || types.includes(d.docType));
    const preview = E('div', { 'data-testid': 'ppw-preview' });
    const view = (versionId, download) => { void c.api.content(versionId).then((x) => { preview.replaceChildren(); showFile(preview, { bytes: fromBase64(x.contentBase64), mime: x.mimeType, fileName: x.fileName, download, testids: { frame: 'ppw-frame', img: 'ppw-img', text: 'ppw-text', link: 'ppw-dl', none: 'ppw-nopreview' } }); }).catch((e) => c.notify('error', errorText(e))); };
    const up = async (f, docType, ttl, documentId, note, validUntil) => {
        if (f.size > 8 * 1024 * 1024)
            throw new Error('Dosya 8 MB sınırını aşıyor');
        await c.api.upload(c.type, c.id, docType, ttl, f.name, f.type || 'application/octet-stream', toBase64(new Uint8Array(await f.arrayBuffer())), note, documentId, validUntil);
    };
    const row = (d) => {
        const nv = h('input', { type: 'file', 'data-testid': 'ppw-newver-file', style: 'display:none' });
        nv.addEventListener('change', () => { const f = nv.files?.[0]; if (f)
            void up(f, d.docType, d.title, d.documentId, 'Yeni sürüm', null).then(() => c.reload({ kind: 'ok', text: 'Yeni sürüm eklendi; eskisi korunur.' })).catch((e) => c.notify('error', errorText(e))); });
        return E('div', { class: 'ps-doc', 'data-testid': 'ppw-doc', 'data-doc-type': d.docType }, E('div', {}, E('b', {}, d.title), E('div', { class: 'ps-k' }, `${d.typeTitle} · v${d.versionNo}/${d.versions} · ${d.fileName} · ${kb(d.sizeBytes)} · ${when(d.uploadedAt)}`)), E('div', { class: 'acts' }, btn('ghost sm', 'ppw-doc-open', 'Aç', () => view(d.versionId, false)), btn('ghost sm', 'ppw-doc-dl', 'İndir', () => view(d.versionId, true)), c.card.can.edit ? btn('ghost sm', 'ppw-doc-newver', 'Yeni sürüm', () => nv.click()) : null, nv));
    };
    const allowed = PASSPORT_DOC_TYPES[c.type].filter((t) => t.code !== 'ASSET_PHOTO' && (!types || types.includes(t.code)));
    let add = null;
    if (c.card.can.edit && allowed.length) {
        const upType = h('select', { 'data-testid': 'ppw-up-type' }, ...allowed.map((t) => E('option', { value: t.code }, t.label)));
        const upTitle = h('input', { 'data-testid': 'ppw-up-title', placeholder: 'Belge adı', maxlength: 200 });
        const upValid = h('input', { type: 'date', 'data-testid': 'ppw-up-valid' });
        const upFile = h('input', { type: 'file', 'data-testid': 'ppw-up-file' });
        const go = async () => {
            const f = upFile.files?.[0];
            if (!f) {
                c.notify('error', 'Önce bir dosya seçin');
                return;
            }
            if (upTitle.value.trim().length < 2) {
                c.notify('error', 'Belge adı yazın');
                return;
            }
            if (upType.value === 'CALIBRATION_CERTIFICATE' && !upValid.value) {
                c.notify('error', 'Kalibrasyon sertifikası için geçerlilik tarihi girin');
                return;
            }
            try {
                await up(f, upType.value, upTitle.value.trim(), null, null, upType.value === 'CALIBRATION_CERTIFICATE' ? upValid.value : null);
                c.reload({ kind: 'ok', text: 'Belge eklendi.' });
            }
            catch (e) {
                c.notify('error', errorText(e));
            }
        };
        add = fold('Yeni belge ekle', [field('Tür', upType), field('Belge adı', upTitle), field('Dosya', upFile), field('Geçerlilik sonu (yalnız kalibrasyon sertifikası)', upValid), btn('primary sm', 'ppw-up-go', 'Ekle', () => void go())], false, 'ppw-up-fold');
    }
    return panel(title, opts.testid ?? 'ps-docs-panel', null, docs.length ? E('div', {}, ...docs.map(row)) : emptyState(opts.empty ?? 'Belge yok', c.card.can.edit ? 'Aşağıdan ekleyebilirsiniz.' : undefined, 'ppw-no-docs'), preview, add);
}
