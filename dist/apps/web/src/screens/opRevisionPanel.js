// Operasyon teknik pasaportu — dosya alanları (görüntüle · indir · YENİ REVİZYON · geçmiş · karşılaştır) ve REVİZYON FARKLARI.
// Kanonik kaynaklar: belgeler/document_versions (upload_document yeni sürüm ekler, eskiyi ezmez), routing_op_history, cam_programs. Paralel arşiv/tablo YOK.
import { h } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { toBase64 } from '../kx.js';
import { fileSlotState, diffVersions, diffText, diffTools, diffOpVersions, ST } from '../../../../packages/domain/src/opRevisionDiff.js';
import { rowsFromCsv } from '../../../../packages/domain/src/toolListFromNc.js';

const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const chip = (t, tone = '') => E('span', { class: `chip ${tone}` }, t);
const fmt = (x, u = '') => (x === null || x === undefined ? 'BİLİNMİYOR' : `${x}${u ? ` ${u}` : ''}`);
const stTone = (s) => (s === ST.SAME ? 'ok' : s === ST.CHANGED ? 'warn' : 'info');
const short = (s) => (s ? `${s.slice(0, 10)}…` : '—');

export const SLOTS = [
    { docType: 'NC_PROGRAM', label: 'NC programı', req: 'nc', text: true },
    { docType: 'TOOL_LIST', label: 'Takım listesi / takım montajı', req: 'toolList', tools: true },
    { docType: 'CAM_SETUP_SHEET', label: 'Bağlama aparatı · fikstür · ayar föyü' },
    { docType: 'DRAWING', label: 'Teknik resim' },
    { docType: 'TECH_DOC', label: 'Teknik belge' },
    { docType: 'WORK_INSTRUCTION', label: 'İşleme talimatı' },
    { docType: 'CONTROL_PLAN', label: 'Kontrol planı' },
    { docType: 'OTHER', label: 'CAM dosyası / proje eki' },
];
const MIME = { nc: 'text/plain', txt: 'text/plain', tap: 'text/plain', mpf: 'text/plain', h: 'text/plain', ptp: 'text/plain', cnc: 'text/plain', csv: 'text/csv', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', dxf: 'application/dxf', step: 'model/step', stp: 'model/step', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel' };
const mimeOf = (name, t) => MIME[(name.split('.').pop() ?? '').toLowerCase()] ?? (t && t !== '' ? t : 'application/octet-stream');
function save(name, bytes, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

/** Bir dosya alanındaki belge için satır: durum + işlemler. Yükleme HER ZAMAN yeni revizyon olarak eklenir (mevcut belge varsa onun kimliğine). */
function docBlock(api, ws, op, slot, doc, can, reload, showErr, reqOn) {
    const host = E('div', { class: 'opr-doc', 'data-testid': 'opr-doc', 'data-doctype': slot.docType });
    const out = E('div', { class: 'mut', role: 'status', 'data-testid': 'opr-out' });
    const detail = E('div', { 'data-testid': 'opr-detail' });
    let versions = null; let busy = false;
    const known = doc ? doc.versionNo ?? null : null; // ekran açılırken bilinen en yeni sürüm (eşzamanlı düzenleme koruması)
    const loadVersions = async () => { if (!doc) return []; versions = await api.docVersions(doc.id ?? doc.documentId); return versions; };
    const st = fileSlotState({ required: reqOn === false ? false : undefined, versions: doc ? [{ versionNo: doc.versionNo ?? 1 }] : [], effectiveVersionNo: doc?.effectiveVersionNo ?? null });
    const head = E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;align-items:center' }, E('b', {}, slot.label), chip(reqOn === false ? 'GEREKMİYOR' : st.code === 'YUKLENMEDI' && reqOn !== true ? 'Henüz yüklenmedi (isteğe bağlı)' : st.label, reqOn === false ? 'info' : st.code === 'YUKLENMEDI' && reqOn !== true ? 'info' : st.tone), doc ? E('span', { class: 'mut' }, `${doc.docNo ?? ''} · ${doc.fileName ?? ''}`) : null);
    host.append(head);
    const view = async (download) => {
        try {
            const vs = await loadVersions(); const eff = vs.find((v) => v.state === 'EFFECTIVE') ?? vs[0]; if (!eff) throw new Error('VERSION_NOT_FOUND');
            const f = await api.docVersionFile(eff.versionId);
            if (download || f.text === null) { save(f.fileName ?? eff.fileName ?? 'dosya', f.bytes, f.mimeType); out.textContent = `${f.fileName ?? 'Dosya'} v${eff.versionNo} indirildi.`; return; }
            detail.replaceChildren(E('div', { class: 'sub' }, `v${eff.versionNo} · ${f.fileName ?? ''} · SHA-256 ${short(f.sha256)}`), E('pre', { class: 'opr-pre', 'data-testid': 'opr-view-text' }, f.text.length > 20000 ? `${f.text.slice(0, 20000)}\n… (kesildi; tamamı için indirin)` : f.text));
        } catch (e) { showErr(e); }
    };
    const compare = async (aNo, bNo) => {
        try {
            const vs = versions ?? await loadVersions(); const a = vs.find((v) => v.versionNo === aNo), b = vs.find((v) => v.versionNo === bNo);
            if (!a || !b) { detail.replaceChildren(E('div', { class: 'mut', 'data-testid': 'opr-cmp' }, `${ST.NA}: iki sürüm seçin.`)); return; }
            const meta = diffVersions(a, b); const kids = [E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, chip(`v${a.versionNo} → v${b.versionNo}`, ''), chip(meta.state, stTone(meta.state)), meta.nameChanged ? chip('dosya adı değişti', 'warn') : null), E('div', { class: 'sub' }, meta.a ? `v${meta.a.versionNo}: ${meta.a.fileName ?? '—'} · SHA ${short(meta.a.sha256)}  |  v${meta.b.versionNo}: ${meta.b.fileName ?? '—'} · SHA ${short(meta.b.sha256)}${meta.sizeDelta != null ? `  |  boyut farkı ${meta.sizeDelta} bayt` : ''}` : meta.why)];
            if (slot.text || slot.tools) {
                const [fa, fb] = await Promise.all([api.docVersionFile(a.versionId), api.docVersionFile(b.versionId)]);
                if (slot.tools) {
                    let ra = null, rb = null; try { const [ca, cb] = await Promise.all([api.toolistContentGet(a.versionId), api.toolistContentGet(b.versionId)]); ra = ca.saved ? rowsFromCsv(ca.csv) : (fa.text ? rowsFromCsv(fa.text) : null); rb = cb.saved ? rowsFromCsv(cb.csv) : (fb.text ? rowsFromCsv(fb.text) : null); } catch { ra = rb = null; }
                    const td = diffTools(ra, rb); kids.push(toolDiffView(td));
                } else {
                    const td = diffText(fa.text, fb.text); kids.push(E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, chip(`Satır farkı: ${td.state}`, stTone(td.state)), td.added != null ? chip(`+${td.added} / −${td.removed} satır`, '') : null), td.why ? E('div', { class: 'sub' }, td.why) : null, td.sample?.length ? E('pre', { class: 'opr-pre', 'data-testid': 'opr-linediff' }, td.sample.map((s) => `${s.op} ${s.no}: ${s.line}`).join('\n') + (td.truncated ? '\n…' : '')) : null);
                }
            }
            detail.replaceChildren(E('div', { 'data-testid': 'opr-cmp' }, ...kids));
        } catch (e) { showErr(e); }
    };
    const history = async () => {
        try {
            const vs = await loadVersions();
            if (!vs.length) { detail.replaceChildren(E('div', { class: 'mut' }, 'Revizyon yok.')); return; }
            const selA = E('select', { 'data-testid': 'opr-sel-a', 'aria-label': 'Karşılaştırma eski sürüm' }, ...vs.map((v) => E('option', { value: String(v.versionNo), selected: v.versionNo === (vs[1]?.versionNo ?? vs[0].versionNo) }, `v${v.versionNo}`)));
            const selB = E('select', { 'data-testid': 'opr-sel-b', 'aria-label': 'Karşılaştırma yeni sürüm' }, ...vs.map((v) => E('option', { value: String(v.versionNo), selected: v.versionNo === vs[0].versionNo }, `v${v.versionNo}`)));
            detail.replaceChildren(E('div', { 'data-testid': 'opr-history' }, E('div', { class: 'rows' }, ...vs.map((v) => E('div', { class: 'r', 'data-testid': 'opr-ver' }, E('b', {}, `v${v.versionNo}`), E('span', {}, v.fileName ?? '—'), E('span', { class: 'mut' }, `SHA ${short(v.sha256)}`), v.state ? chip(v.state, v.state === 'EFFECTIVE' ? 'ok' : 'warn') : null, E('button', { class: 'ghost sm', type: 'button', onClick: async () => { try { const f = await api.docVersionFile(v.versionId); save(f.fileName ?? v.fileName ?? 'dosya', f.bytes, f.mimeType); } catch (e) { showErr(e); } } }, 'İndir')))),
                E('div', { class: 'row', style: 'gap:6px;margin-top:6px;flex-wrap:wrap' }, selA, E('span', {}, '→'), selB, E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'opr-cmp-sel', onClick: () => void compare(Number(selA.value), Number(selB.value)) }, 'Seçilenleri karşılaştır'), vs.length > 1 ? E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'opr-cmp-prev', onClick: () => void compare(vs[1].versionNo, vs[0].versionNo) }, 'Önceki revizyonla karşılaştır') : null)));
        } catch (e) { showErr(e); }
    };
    const acts = E('div', { class: 'acts' });
    if (doc) acts.append(E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'opr-view', onClick: () => void view(false) }, 'Görüntüle'), E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'opr-dl', onClick: () => void view(true) }, 'İndir'), E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'opr-hist', onClick: () => void history() }, 'Revizyon geçmişi / karşılaştır'));
    // ── YÜKLEME: durum ne olursa olsun görünür (kök neden düzeltmesi: eskiden yalnız "YOK" iken çiziliyordu)
    if (can.files && reqOn !== false && api.upload) {
        const file = E('input', { type: 'file', 'data-testid': 'opr-file', 'aria-label': `${slot.label}: ${doc ? 'yeni revizyon' : 'dosya'} seç` });
        const note = E('input', { type: 'text', placeholder: 'Revizyon notu (ne değişti?)', maxlength: 200, 'data-testid': 'opr-note', 'aria-label': 'Revizyon notu' });
        const go = E('button', { class: 'primary sm', type: 'button', 'data-testid': 'opr-upload', onClick: async () => {
            const f = file.files?.[0]; if (!f) { showErr(new Error('Önce dosyayı seçin.')); return; } if (busy) return; busy = true; go.disabled = true;
            try {
                if (doc) { const cur = await api.docLatest(doc.id ?? doc.documentId); if (known != null && cur && cur.versionNo !== known) throw new Error(`EŞZAMANLI_DEĞİŞİKLİK: bu dosya siz bakarken v${cur.versionNo} oldu (ekranda v${known} vardı). Ekran yenileniyor; değişikliği görüp tekrar yükleyin.`); }
                const bytes = new Uint8Array(await f.arrayBuffer());
                const r = await api.upload({ docType: slot.docType, entityType: 'PRODUCT_REVISION', entityId: ws.revision.id, title: doc ? null : `OP${op.opNo} ${slot.label} · ${f.name}`.slice(0, 120), fileName: f.name, mimeType: mimeOf(f.name, f.type), contentBase64: toBase64(bytes), validUntil: null, note: note.value.trim() || null, documentId: doc ? (doc.id ?? doc.documentId) : null });
                if (!doc) await api.linkDocumentToOp(r.documentId, op.opNo);
                await reload(doc ? `OP${op.opNo}: ${slot.label} v${r.versionNo} olarak YENİ REVİZYON eklendi (önceki sürüm korunur; yürürlük/onay belge kontrolünden). Operasyon sessizce yeni revizyona geçirilmedi.` : `OP${op.opNo}: ${f.name} yüklendi ve bu operasyona bağlandı (TASLAK).`);
            } catch (e) { busy = false; go.disabled = false; if (/EŞZAMANLI/.test(String(e?.message))) { showErr(e); try { await reload(String(e.message), 'error'); } catch { /* */ } } else showErr(e); }
        } }, doc ? 'Yeni revizyon yükle' : 'Yükle ve bağla');
        acts.append(E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;width:100%' }, file, note, go));
    }
    host.append(acts, out, detail);
    return host;
}
function toolDiffView(td) {
    if (td.state === ST.NA) return E('div', { class: 'mut', 'data-testid': 'opr-tooldiff' }, `${ST.NA}: ${td.why}`);
    const li = (t, r) => E('div', { class: 'sub' }, `T${t} ${r.desc ?? ''}${r.dia ? ` · Ø${r.dia}` : ''}${r.holder ? ` · ${r.holder}` : ''}`);
    return E('div', { 'data-testid': 'opr-tooldiff' }, E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, chip(`Takım: ${td.state}`, stTone(td.state)), chip(`${td.prevCount} → ${td.nextCount} (${td.countDelta >= 0 ? '+' : ''}${td.countDelta})`, ''), chip(`+${td.added.length} eklenen`, td.added.length ? 'warn' : ''), chip(`−${td.removed.length} çıkarılan`, td.removed.length ? 'warn' : ''), chip(`~${td.changed.length} değişen`, td.changed.length ? 'warn' : '')),
        ...td.added.map((r) => E('div', {}, chip('EKLENDİ', 'ok'), li(r.t, r))), ...td.removed.map((r) => E('div', {}, chip('ÇIKARILDI', 'bad'), li(r.t, r))), ...td.changed.map((c) => E('div', {}, chip('DEĞİŞTİ', 'warn'), li(c.t, c.after), E('div', { class: 'sub' }, `Değişen: ${c.fields.join(', ')}`))), E('div', { class: 'sub' }, td.prepImpact));
}

/** Operasyon sayfasındaki "Teknik dosyalar" bölümü: tüm alanlar, her zaman düzenlenebilir (yetki ve makine tipi kuralları içinde). */
export async function drawOpFiles(host, api, ws, op, can, reload, showErr) {
    host.replaceChildren();
    const ro = ws.routing?.find((x) => x.id === op.routingOperationId);
    const docs = ro?.documents ?? [];
    const req = op.requirements ?? op.req ?? {};
    const bandsaw = op.machineType === 'BANDSAW';
    const kids = SLOTS.map((slot) => {
        const reqOn = slot.req ? (bandsaw || req[slot.req] === false ? false : true) : undefined; // sunucu eski/bilinmiyorsa SIKI (m0219 kuralı)
        const mine = docs.filter((d) => d.docType === slot.docType);
        if (!mine.length) return docBlock(api, ws, op, slot, null, can, reload, showErr, reqOn);
        return E('div', {}, ...mine.map((d) => docBlock(api, ws, op, slot, d, can, reload, showErr, reqOn)));
    });
    const MTN = { BANDSAW: 'Şerit testere — NC/CAM/CNC takım listesi gerekmez; bıçak, bağlama, kesme süresi, kesim ölçü/adet, kalite', CNC_MACHINING: 'CNC işleme merkezi — NC, CAM, CNC takım listesi, hazırlık/çevrim süresi, bağlama/fikstür, kalite', CNC_TURNING: 'CNC torna — NC, uygun CAM, torna takım listesi, hazırlık/çevrim süresi, torna bağlama ve takım parametreleri, kalite' };
    host.append(E('div', { class: 'mut', 'data-testid': 'opr-mtype', style: 'margin-bottom:6px' }, op.machineType ? `Makine tipi: ${MTN[op.machineType] ?? op.machineType} (makine pasaportundaki tipten otomatik)` : 'Makine tipi girilmemiş → gereksinimler SIKI (NC, CAM, takım listesi zorunlu). Tip, makine pasaportundan seçilir.'));
    host.append(E('div', { class: 'formbox', 'data-testid': 'opr-files', style: 'margin-bottom:10px' }, E('b', {}, 'Teknik dosyalar — her alan yeni revizyon alabilir'), E('div', { class: 'mut' }, 'Yeni dosya eskinin üzerine yazılmaz; yeni revizyon olarak saklanır (dosya adı aynı olsa da içerik özeti SHA-256 ve yükleme olayı izlenir). Yürürlüğe alma belge kontrolünde ayrı onayla yapılır; yükleme operasyonu sessizce yeni revizyona geçirmez.'), bandsaw ? E('div', { class: 'mut', 'data-testid': 'opr-bandsaw', role: 'note' }, 'Şerit testere: NC / CAM / CNC takım listesi GEREKMİYOR. Bağlama, kesme süresi, şerit bıçağı, kesim parametreleri ve ilgili belgeler aşağıdan yönetilir.') : null, ...kids));
}

const dfmt = (t) => (t ? String(t).slice(0, 16).replace('T', ' ') : '—');
/** REVİZYON FARKLARI: son geçerli revizyon ↔ bir önceki geçerli revizyon (varsayılan). */
export async function drawRevisionDiffs(host, api, ws, op, can, showErr) {
    host.replaceChildren();
    const box = E('div', { class: 'formbox', 'data-testid': 'opr-diffs', style: 'margin-bottom:10px' }, E('b', {}, 'REVİZYON FARKLARI'));
    host.append(box);
    let rows = null; try { rows = await api.opHistory(op.routingOperationId); } catch { rows = null; }
    const qtyIn = E('input', { type: 'number', min: '1', step: '1', placeholder: 'adet', 'data-testid': 'opr-qty', style: 'width:90px', 'aria-label': 'Toplam süre etkisi için adet' });
    const body = E('div', { 'data-testid': 'opr-diff-body' });
    const draw = () => {
        body.replaceChildren();
        if (!rows) { body.append(E('div', { class: 'mut' }, `${ST.NA}: operasyon revizyon geçmişi okunamadı.`)); return; }
        const d = diffOpVersions(rows, { qty: qtyIn.value ? Number(qtyIn.value) : null });
        if (d.state === ST.NA) { body.append(E('div', { class: 'mut', 'data-testid': 'opr-diff-na' }, `${ST.NA}: ${d.why}${d.next ? ` (yalnız v${d.next} var)` : ''}`)); return; }
        const t = d.times; const line = (label, f, unit) => E('div', { class: 'r', 'data-testid': 'opr-time-row' }, E('b', {}, label), E('span', {}, f.state === ST.NA ? `${ST.NA}${f.why ? `: ${f.why}` : ''}` : `${fmt(f.prev, unit)} → ${fmt(f.next, unit)}`), chip(f.state, stTone(f.state)), f.deltaSec != null ? E('span', { class: 'mut' }, `${f.deltaSec > 0 ? '+' : ''}${f.deltaSec} sn${f.pct != null ? ` (${f.pct > 0 ? '+' : ''}${f.pct}%)` : ''}`) : f.deltaMin != null ? E('span', { class: 'mut' }, `${f.deltaMin > 0 ? '+' : ''}${f.deltaMin} dk${f.pct != null ? ` (${f.pct > 0 ? '+' : ''}${f.pct}%)` : ''}`) : null);
        body.append(E('div', { class: 'sub' }, `v${d.prevNo} (${dfmt(d.prevAt)}) → v${d.nextNo} (${dfmt(d.nextAt)}) · ${d.by ?? '—'} · ${d.kind ?? ''}${d.reason ? ` · ${d.reason}` : ''}`),
            E('h5', {}, 'Süre farkları'), E('div', { class: 'rows' }, line('Standart çevrim', t.cycle, 'sn'), line('Setup / hazırlık', t.setup, 'dk'),
                E('div', { class: 'r', 'data-testid': 'opr-total' }, E('b', {}, 'Toplam tahmini üretim süresi etkisi'), E('span', {}, t.total.state === ST.NA ? `${ST.NA}: ${t.total.why}` : `${t.total.qty} adet: ${t.total.prevSec} → ${t.total.nextSec} sn (${t.total.deltaHours > 0 ? '+' : ''}${t.total.deltaHours} saat)`), chip(t.total.state, stTone(t.total.state))),
                E('div', { class: 'r' }, E('b', {}, 'Kapasite / termin'), E('span', {}, `${ST.NA}: ${t.capacity.why}`), chip(ST.NA, 'info'))),
            E('h5', {}, 'Rota alanları'), E('div', { class: 'rows' }, ...[['Makineler', d.machines], ['Kontrol planı noktaları', d.qcPlan], ['Kaynaklar', d.resources], ['Operasyon adı', d.name], ['Açıklama / talimat', d.instructions]].map(([l, f]) => E('div', { class: 'r' }, E('b', {}, l), chip(f.state, stTone(f.state))))));
    };
    qtyIn.addEventListener('input', draw);
    box.append(E('div', { class: 'row', style: 'gap:6px;align-items:center;flex-wrap:wrap' }, E('span', { class: 'mut' }, 'Toplam süre etkisi için adet:'), qtyIn), body);
    draw();
    // Program / CAM / takım / belge farkları (gerçek kayıtlardan)
    const prog = E('div', { 'data-testid': 'opr-prog' }); box.append(E('h5', {}, 'Program ve belge farkları'), prog);
    try {
        const cams = await api.camRevisions(op.routingOperationId);
        if (!cams) prog.append(E('div', { class: 'mut' }, `CAM revizyonu: ${ST.NA} (okunamadı)`));
        else if (cams.length < 2) prog.append(E('div', { class: 'mut', 'data-testid': 'opr-cam-na' }, `CAM revizyonu: ${cams.length ? `yalnız ${cams[0].program_no} rev ${cams[0].revision} var` : 'kayıt yok'} — ${ST.NA}`));
        else { const [n, p] = cams; const same = n.nc_sha256 && p.nc_sha256 ? n.nc_sha256 === p.nc_sha256 : null; prog.append(E('div', { class: 'r', 'data-testid': 'opr-cam' }, E('b', {}, 'CAM'), E('span', {}, `${p.program_no} rev ${p.revision} (${p.status}) → ${n.program_no} rev ${n.revision} (${n.status})`), chip(p.revision === n.revision && p.id === n.id ? ST.SAME : ST.CHANGED, stTone(p.id === n.id ? ST.SAME : ST.CHANGED)), E('span', { class: 'mut' }, `NC özeti: ${same === null ? ST.NA : same ? ST.SAME : ST.CHANGED}${n.ideal_cycle_seconds != null || p.ideal_cycle_seconds != null ? ` · ideal çevrim ${fmt(p.ideal_cycle_seconds, 'sn')} → ${fmt(n.ideal_cycle_seconds, 'sn')}` : ''}`))); }
    } catch (e) { showErr(e); }
    try {
        const ro = ws.routing?.find((x) => x.id === op.routingOperationId); const docs = ro?.documents ?? [];
        for (const slot of SLOTS) {
            for (const dd of docs.filter((x) => x.docType === slot.docType)) {
                const vs = await api.docVersions(dd.id ?? dd.documentId);
                if (vs.length < 2) { prog.append(E('div', { class: 'r' }, E('b', {}, slot.label), E('span', {}, `${dd.docNo ?? ''} v${vs[0]?.versionNo ?? '—'} tek sürüm`), chip(ST.NA, 'info'))); continue; }
                const m = diffVersions(vs[1], vs[0]);
                const r = E('div', { class: 'r', 'data-testid': 'opr-doc-diff' }, E('b', {}, slot.label), E('span', {}, `${dd.docNo ?? ''} v${vs[1].versionNo} → v${vs[0].versionNo}${m.nameChanged ? ' (dosya adı değişti)' : ''}`), chip(m.state, stTone(m.state)), E('span', { class: 'mut' }, `SHA ${short(vs[1].sha256)} → ${short(vs[0].sha256)}`));
                prog.append(r);
                if (slot.tools) { try { const [a, b] = await Promise.all([api.toolistContentGet(vs[1].versionId), api.toolistContentGet(vs[0].versionId)]); prog.append(toolDiffView(diffTools(a.saved ? rowsFromCsv(a.csv) : null, b.saved ? rowsFromCsv(b.csv) : null))); } catch { prog.append(E('div', { class: 'mut' }, `Takım farkı: ${ST.NA}`)); } }
            }
        }
    } catch (e) { showErr(e); }
    // Etkilenen iş emirleri (açık)
    const wo = await api.opAffectedWos(op.routingOperationId);
    box.append(E('div', { class: 'sub', 'data-testid': 'opr-wos' }, wo === null ? `Etkilenen iş emirleri: ${ST.NA} (okunamadı)` : `Bu operasyonu kullanan AÇIK iş emri işlemi: ${wo.length}${wo.some((x) => x.fp_recheck_required) ? ` · ${wo.filter((x) => x.fp_recheck_required).length} tanesinde ilk parça yeniden kontrolü bekliyor` : ''}. Revizyon yürürlüğe girse bile başlamış işlemler eski revizyonda donuk kalır; geçmiş üretim değişmez.`));
}
