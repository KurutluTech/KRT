// KMI — Dijital pasaport çalışma alanı: ürün / makine / personel / müşteri kartlarının ortak, GERÇEK çalışma ekranı.
// Fotoğraf/logo (yükle · değiştir · göster), belgeler (yükle · aç · indir · yeni sürüm · geçmiş), yapısal veri (düzenle · gerekçe · eski/yeni · kim/ne zaman), yetkiye göre kilitli bölümler.
// ONE FACT → ONE SOURCE: değerler passport_values (sürümlü), dosyalar KMI-010 belge kaydı; kopya yok. Hassas bölümler (özlük, kimlik, ticari) sunucuda süzülür; kilitli olduğu açıkça söylenir.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { PASSPORT_DOC_TYPES } from '../passportCardsApi.js';
import { errorText } from '../errorText.js';
import { KX_CSS, card, chip, emptyState, field, fold, fromBase64, invalid, kb, showFile, toBase64, val, when } from '../kx.js';
const KIND_TR = { MACHINE: 'Makine pasaportu', PRODUCT: 'Ürün pasaportu', PERSONNEL: 'Personel kartı', CUSTOMER: 'Müşteri kartı', SUPPLIER: 'Tedarikçi kartı', TOOL: 'Takım pasaportu' };
const LOCK_TR = { COMMERCIAL: 'Ticari bilgiler', CONTACT: 'Kişi bilgileri', PERSONNEL_FILE: 'Özlük dosyası', ID_DOCUMENT: 'Kimlik belgeleri' };
const PP_CSS = `
.pp2 .top{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.pp2 .ph{width:92px;height:92px;border-radius:14px;border:1px solid #1e293b;background:#0b1220;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#64748b;font-size:12px;text-align:center}
.pp2 .ph img{width:100%;height:100%;object-fit:cover}
.pp2 .attr{border-top:1px solid #1e293b;padding:8px 0;display:grid;gap:6px 12px;grid-template-columns:minmax(120px,220px) 1fr auto;align-items:center}
@media (max-width:700px){.pp2 .attr{grid-template-columns:1fr}}
.pp2 .attr .k{color:#94a3b8;font-size:13px}.pp2 .attr .v{color:#fff;overflow-wrap:anywhere}.pp2 .attr .v.na{color:#64748b}
.pp2 .attr .ed{grid-column:1/-1;display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.pp2 .hist{grid-column:1/-1;font-size:12px;color:#94a3b8}.pp2 .hist div{padding:3px 0;border-top:1px dashed #1e293b}
.pp2 .doc{border-top:1px solid #1e293b;padding:8px 0;display:grid;gap:6px 12px;grid-template-columns:1fr auto;align-items:center}
.pp2 .doc .acts{display:flex;gap:6px;flex-wrap:wrap}
`;
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const btn = (cls, testid, text, fn) => E('button', { class: cls, type: 'button', ...(testid ? { 'data-testid': testid } : {}), onClick: fn }, text);
const isEntity = (t) => t === 'MACHINE' || t === 'CUSTOMER' || t === 'PERSONNEL' || t === 'PRODUCT' || t === 'SUPPLIER' || t === 'TOOL';
const show = (a) => (a.value === null || a.value === '' ? null : a.kind === 'BOOL' ? (a.value === 'true' ? 'Evet' : 'Hayır') : `${a.value}${a.unit ? ` ${a.unit}` : ''}`);
export async function renderPassportWorkspaceScreen(container, api, state = {}) {
    const go = (s) => renderPassportWorkspaceScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'kx pp2', 'data-testid': 'ppw-root' }, h('style', {}, KX_CSS + PP_CSS), ...kids));
    const bannerEl = () => (state.banner ? E('div', { class: `banner ${state.banner.kind === 'error' ? 'bad' : state.banner.kind === 'ok' ? 'ok' : ''}`, 'data-testid': 'ppw-banner', 'data-kind': state.banner.kind, role: state.banner.kind === 'error' ? 'alert' : 'status' }, state.banner.text) : null);
    const fail = (e) => {
        const text = errorText(e);
        state = { ...state, banner: { kind: 'error', text } };
        let b = container.querySelector('[data-testid="ppw-banner"]');
        if (!b) {
            b = E('div', { 'data-testid': 'ppw-banner', role: 'alert' });
            const root = container.querySelector('[data-testid="ppw-root"]');
            const first = root ? [...root.children].find((c) => c.tagName !== 'STYLE') : null;
            if (root)
                root.insertBefore(b, first?.nextSibling ?? null);
        } // never re-render: an open edit panel keeps what the person typed
        b.textContent = text;
        b.className = 'banner bad';
        b.setAttribute('data-kind', 'error');
        try {
            b.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    if (!isEntity(state.type) || !state.id) {
        shell(emptyState('Pasaport seçilmedi', 'Makine, ürün, personel, müşteri, tedarikçi veya takım kartından açın.', 'ppw-empty'));
        return;
    }
    const type = state.type;
    const id = state.id;
    let p;
    try {
        p = await api.get(type, id);
    }
    catch (e) {
        shell(E('div', { class: 'banner bad', role: 'alert', 'data-testid': 'ppw-banner', 'data-kind': 'error' }, errorText(e)));
        return;
    }
    // ---- photo / logo
    const photoBox = E('div', { class: 'ph', 'data-testid': 'ppw-photo' }, 'Fotoğraf yok');
    if (p.photo)
        void api.content(p.photo.versionId).then((c) => { const img = E('img', { alt: p.label, src: `data:${c.mimeType};base64,${c.contentBase64}`, 'data-testid': 'ppw-photo-img' }); photoBox.replaceChildren(img); }).catch(() => undefined);
    const photoFile = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'data-testid': 'ppw-photo-file' });
    const canPhoto = p.can.edit;
    const doUpload = async (f, docType, title, documentId, note, validUntil = null) => {
        if (f.size > 8 * 1024 * 1024)
            throw new Error('Dosya 8 MB sınırını aşıyor');
        await api.upload(type, id, docType, title, f.name, f.type || 'application/octet-stream', toBase64(new Uint8Array(await f.arrayBuffer())), note, documentId, validUntil);
    };
    const photoDocId = p.photo?.documentId ?? null;
    const savePhoto = async () => {
        const f = photoFile.files?.[0];
        if (!f) {
            fail(new Error('Önce bir görsel seçin'));
            return;
        }
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
            fail(new Error('Yalnız PNG, JPEG veya WEBP'));
            return;
        }
        try {
            await doUpload(f, 'ASSET_PHOTO', `${p.label} fotoğrafı`, photoDocId, photoDocId ? 'Fotoğraf değişti' : null);
            await go({ type, id, banner: { kind: 'ok', text: 'Fotoğraf kaydedildi.' } });
        }
        catch (e) {
            fail(e);
        }
    };
    // ---- attributes
    const histHosts = new Map();
    const attrRow = (a) => {
        const v = show(a);
        const host = E('div', { class: 'attr', 'data-testid': 'ppw-attr', 'data-code': a.code });
        const editHost = E('div', { class: 'ed', style: 'display:none' });
        const hist = E('div', { class: 'hist', 'data-testid': 'ppw-hist', style: 'display:none' });
        histHosts.set(a.code, hist);
        host.append(E('div', { class: 'k' }, a.label), E('div', { class: `v${v ? '' : ' na'}` }, v ?? 'VERİ YOK', a.versionNo ? E('span', { class: 'mut', style: 'margin-left:8px;font-size:12px' }, `v${a.versionNo} · ${a.validFrom ?? ''}`) : null), E('div', { class: 'acts' }, btn('ghost sm', 'ppw-hist-btn', 'Geçmiş', () => {
            if (hist.style.display === 'none') {
                void api.history(type, id, a.code).then((rows) => { hist.replaceChildren(...(rows.length ? rows.map((r) => E('div', {}, `v${r.versionNo}: ${r.value ?? '—'}${r.unit ? ` ${r.unit}` : ''} · geçerlilik ${r.validFrom} · ${r.changedBy ?? '?'} · ${when(r.changedAt)} · “${r.reason}”`)) : [E('div', {}, 'Kayıt yok')])); hist.style.display = ''; }).catch(fail);
            }
            else
                hist.style.display = 'none';
        }), a.editable ? btn('ghost sm', 'ppw-edit-btn', 'Düzenle', () => { editHost.style.display = editHost.style.display === 'none' ? '' : 'none'; }) : null), editHost, hist);
        if (a.editable) {
            const input = h('input', { 'data-testid': 'ppw-value', value: a.value ?? '', type: a.kind === 'DATE' ? 'date' : 'text', inputmode: a.kind === 'NUMBER' ? 'decimal' : undefined });
            const from = h('input', { 'data-testid': 'ppw-valid-from', type: 'date' });
            const reason = h('input', { 'data-testid': 'ppw-reason', placeholder: 'Gerekçe (en az 5 karakter)', maxlength: 300 });
            editHost.append(field(`${a.label}${a.unit ? ` (${a.unit})` : ''}`, input), field('Geçerlilik başlangıcı', from, 'Boşsa bugün. Eski tarihli hesaplar eski değerle kalır.'), field('Gerekçe', reason), E('div', { class: 'row' }, btn('primary sm', 'ppw-save', 'Kaydet', () => {
                invalid(reason, val(reason).trim().length < 5);
                if (val(reason).trim().length < 5) {
                    fail(new Error('Gerekçe en az 5 karakter olmalı'));
                    return;
                }
                void api.setValue(type, id, a.code, val(input), a.unit, val(from) || null, val(reason)).then((r) => go({ type, id, banner: { kind: 'ok', text: `${a.label} kaydedildi (v${r.versionNo}).` } })).catch(fail);
            })));
        }
        return host;
    };
    // ---- documents
    const prevHost = E('div', { 'data-testid': 'ppw-preview' });
    const viewDoc = (versionId, download) => { void api.content(versionId).then((c) => { prevHost.replaceChildren(); showFile(prevHost, { bytes: fromBase64(c.contentBase64), mime: c.mimeType, fileName: c.fileName, download, testids: { frame: 'ppw-frame', img: 'ppw-img', text: 'ppw-text', link: 'ppw-dl', none: 'ppw-nopreview' } }); }).catch(fail); };
    const docRow = (d) => {
        const nv = h('input', { type: 'file', 'data-testid': 'ppw-newver-file', style: 'display:none' });
        nv.addEventListener('change', () => { const f = nv.files?.[0]; if (f)
            void doUpload(f, d.docType, d.title, d.documentId, 'Yeni sürüm').then(() => go({ type, id, banner: { kind: 'ok', text: 'Yeni sürüm eklendi; eskisi korunur.' } })).catch(fail); });
        return E('div', { class: 'doc', 'data-testid': 'ppw-doc', 'data-doc-type': d.docType }, E('div', {}, E('b', {}, d.title), E('div', { class: 'mut', style: 'font-size:12px' }, `${d.typeTitle} · v${d.versionNo}/${d.versions} · ${d.fileName} · ${kb(d.sizeBytes)} · ${when(d.uploadedAt)}`)), E('div', { class: 'acts' }, btn('ghost sm', 'ppw-doc-open', 'Aç', () => viewDoc(d.versionId, false)), btn('ghost sm', 'ppw-doc-dl', 'İndir', () => viewDoc(d.versionId, true)), p.can.edit ? btn('ghost sm', 'ppw-doc-newver', 'Yeni sürüm', () => nv.click()) : null, nv));
    };
    const upType = h('select', { 'data-testid': 'ppw-up-type' }, ...PASSPORT_DOC_TYPES[type].map((t) => E('option', { value: t.code }, t.label)));
    const upTitle = h('input', { 'data-testid': 'ppw-up-title', placeholder: 'Belge adı', maxlength: 200 });
    const upValid = h('input', { type: 'date', 'data-testid': 'ppw-up-valid' });
    const upFile = h('input', { type: 'file', 'data-testid': 'ppw-up-file' });
    const upload = async () => {
        const f = upFile.files?.[0];
        if (!f) {
            fail(new Error('Önce bir dosya seçin'));
            return;
        }
        if (val(upTitle).trim().length < 2) {
            fail(new Error('Belge adı yazın'));
            return;
        }
        try {
            if (val(upType) === 'CALIBRATION_CERTIFICATE' && !val(upValid)) {
                fail(new Error('Kalibrasyon sertifikası için geçerlilik tarihi girin'));
                return;
            }
            await doUpload(f, val(upType), val(upTitle).trim(), null, null, val(upType) === 'CALIBRATION_CERTIFICATE' ? val(upValid) : null);
            await go({ type, id, banner: { kind: 'ok', text: 'Belge eklendi.' } });
        }
        catch (e) {
            fail(e);
        }
    };
    const attrs = p.attributes;
    // MACHINE: maintenance / fault history of THIS machine (passport_machine_history) — registered status only; no physical state is claimed (no CNC link).
    let histCard = null;
    if (type === 'MACHINE' && api.machineHistory) {
        const KIND_T = { FAULT: 'Arıza', PLANNED: 'Planlı bakım', INSPECTION: 'Kontrol' };
        const ST_T = { OPEN: 'Açık', IN_PROGRESS: 'Devam ediyor', TEST_PENDING: 'Test bekliyor', RETURNED_TO_SERVICE: 'Servise döndü', CLOSED: 'Kapandı' };
        try {
            const mh = await api.machineHistory(id);
            const dt = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });
            histCard = card({ title: 'Bakım ve arıza geçmişi', span: 12, testid: 'ppw-maint', chip: chip(`${mh.tickets.length} kayıt`) }, E('div', { class: 'mut', 'data-testid': 'ppw-reg-status' }, `Kayıtlı durum: ${{ UP: 'KULLANIMA HAZIR', DOWN: 'ARIZALI', MAINTENANCE: 'BAKIMDA', HOLD: 'BEKLETMEDE' }[mh.machine.status] ?? mh.machine.status}${mh.machine.downSince ? ` · ${dt(mh.machine.downSince)} tarihinden beri` : ''} — elle girilen kayıttır; CNC bağlantısı olmadığı için fiziksel çalışma doğrulanmaz.`), mh.tickets.length ? E('div', {}, ...mh.tickets.map((t) => E('div', { class: 'attr', 'data-testid': 'ppw-ticket', 'data-status': t.status }, E('span', { class: 'k' }, `${KIND_T[t.kind] ?? t.kind} · ${t.severity}`), E('span', { class: 'v' }, `${t.reason} — ${ST_T[t.status] ?? t.status}`), E('span', { class: 'mut' }, `${dt(t.createdAt)}${t.createdBy ? ` · ${t.createdBy}` : ''}`))))
                : emptyState('Bakım / arıza kaydı yok', undefined, 'ppw-no-tickets'), E('div', {}, h('a', { class: 'btn ghost sm', href: '#/bakim', 'data-testid': 'ppw-maint-link' }, 'Bakım ekranında işle →')));
        }
        catch (e) {
            histCard = E('div', { class: 'banner bad', 'data-testid': 'ppw-maint-error' }, `Bakım geçmişi okunamadı: ${errorText(e)}`);
        }
    }
    if (type === 'TOOL' && api.toolHistory) {
        try {
            const th = await api.toolHistory(id);
            const dt = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });
            const LOC = { CABINET: 'Takım dolabı', MOUNTED: 'Makinede', ISSUED: 'Zimmetli', SCRAP: 'Hurda' };
            histCard = card({ title: 'Takım hareket geçmişi', span: 12, testid: 'ppw-toolhist', chip: chip(`${th.movements.length} hareket`) }, E('div', { class: 'mut', 'data-testid': 'ppw-tool-now' }, `Kayıtlı konum: ${LOC[th.tool.location] ?? th.tool.location} · ömür: ${th.tool.lifeUsed ?? 0} / ${th.tool.lifeRated ?? '—'} dk — elle girilen kayıtlardır; LockCell / dolap bağlantısı yoktur.`), th.movements.length ? E('div', {}, ...th.movements.map((m) => E('div', { class: 'attr', 'data-testid': 'ppw-toolmove' }, E('span', { class: 'k' }, `${LOC[m.from ?? ''] ?? m.from ?? '—'} → ${LOC[m.to ?? ''] ?? m.to ?? '—'}`), E('span', { class: 'v' }, [m.machine ? `Makine ${m.machine}` : null, m.person, m.reason].filter(Boolean).join(' · ') || '—'), E('span', { class: 'mut' }, dt(m.at))))) : emptyState('Hareket kaydı yok', undefined, 'ppw-no-toolmoves'));
        }
        catch (e) {
            histCard = E('div', { class: 'banner bad', 'data-testid': 'ppw-toolhist-error' }, `Takım geçmişi okunamadı: ${errorText(e)}`);
        }
    }
    try {
        shell(E('div', { class: 'page-head' }, E('div', { class: 'top' }, photoBox, E('div', { class: 'ttl' }, E('div', { class: 'mut' }, KIND_TR[type]), h('h1', { 'data-testid': 'ppw-title' }, p.label), type === 'PERSONNEL' ? E('div', { class: 'mut', 'data-testid': 'ppw-jobtitle' }, attrs.find((a) => a.code === 'JOB_TITLE')?.value ?? 'İş unvanı girilmemiş') : null))), bannerEl(), p.lockedGroups.length ? E('div', { class: 'banner', 'data-testid': 'ppw-locked' }, `Yetkiniz olmadığı için gizli: ${p.lockedGroups.map((g) => LOCK_TR[g] ?? g).join(', ')}.`) : null, canPhoto ? card({ title: type === 'CUSTOMER' ? 'Logo / fotoğraf' : 'Fotoğraf', span: 12 }, E('div', { class: 'row' }, E('div', { class: 'grow' }, photoFile), btn('ghost', 'ppw-photo-save', p.photo ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle', () => void savePhoto()))) : null, histCard, card({ title: 'Bilgiler', span: 12, chip: chip(`${attrs.length} alan`) }, attrs.length ? E('div', {}, ...attrs.map(attrRow)) : emptyState('Gösterilecek alan yok', undefined, 'ppw-no-attrs')), card({ title: 'Belgeler', span: 12, chip: chip(`${p.documents.length}`) }, p.documents.length ? E('div', {}, ...p.documents.map(docRow)) : emptyState('Belge yok', 'Aşağıdan ekleyebilirsiniz.', 'ppw-no-docs'), prevHost, p.can.edit ? fold('Yeni belge ekle', [field('Tür', upType), field('Belge adı', upTitle), field('Dosya', upFile), field('Geçerlilik sonu (yalnız kalibrasyon sertifikası)', upValid), btn('primary sm', 'ppw-up-go', 'Ekle', () => void upload())], false, 'ppw-up-fold') : null));
    }
    catch (e) {
        shell(E('div', { class: 'banner bad', role: 'alert', 'data-testid': 'ppw-banner', 'data-kind': 'error' }, `Ekran kurulamadı: ${String(e)}`));
    }
}
