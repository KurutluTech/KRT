// Operasyon çalışma alanı — OTOMATİK MÜHENDİSLİK paneli. Salt okunur: mevcut NC belgesini okur, tarayıcıda analiz eder, takım listesi/Fusion/kalite TASLAKLARINI üretir.
// Hiçbir şey kaydedilmez, makineye gönderilmez, belge durumu değiştirilmez ("Geçerli yap" yalnız m0213 öncesi YÜKLENDİ kayıtlar için, m0213 sunucu kuralıyla).
// Üç süre kaynağı AYRIDIR: NC analiz tahmini ≠ Fusion CAM simülasyonu ≠ operatör standardı ≠ makine ölçümü.
import { h } from '../../../../packages/ui/src/h.js';
import { analyzeNc, toolDraftCsv, matchKmiTools, engineeringGaps, fmtDuration } from '../../../../packages/domain/src/ncAnalysis.js';
import { parseFusionExport, mapFusionToRoute, fusionTemplateCsv, qualityDraftCsv, FUSION_SOURCE_LABEL } from '../../../../packages/domain/src/fusionImport.js';
import { errorText } from '../errorText.js';
import { toBase64 } from '../kx.js';
import { draftRows, rowsToCsv, normalizedContent, diffContent } from '../../../../packages/domain/src/toolListFromNc.js';
import { opLabel } from './opBoxes.js';

const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const chip = (t, tone = '') => E('span', { class: `chip ${tone}` }, t);
export const ENG_CSS = `.pw .eng{border:1px solid #1e293b;border-radius:12px;padding:10px 12px;margin:0 0 12px;min-width:0;background:rgba(148,163,184,.04)}
.pw .eng h4{margin:0 0 6px;font-size:14px}.pw .eng .sub{color:#94a3b8;font-size:12px;overflow-wrap:anywhere}.pw .eng .gaps{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.pw .eng .src{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:8px 0}.pw .eng .srcbox{border:1px solid #334155;border-radius:10px;padding:8px 10px;min-width:0}
.pw .eng .srcbox .t{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;font-weight:700}.pw .eng .srcbox .v{font-weight:700;margin-top:2px;overflow-wrap:anywhere}
.pw .eng .tt{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;margin-top:6px}.pw .eng .tr{display:grid;grid-template-columns:54px minmax(0,2.4fr) 62px 62px minmax(0,1.4fr);gap:4px 10px;padding:5px 0;border-top:1px solid #1e293b;align-items:start;min-width:0}
.pw .eng .tr>*{min-width:0;overflow-wrap:anywhere}.pw .eng .tr.hd{font-size:11px;color:#94a3b8;text-transform:uppercase;border-top:0}
.pw .eng .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pw .eng .uns{margin:6px 0 0;padding-left:18px;font-size:12px}
@media (min-width:761px){.pw .eng .tr.ed{grid-template-columns:54px minmax(0,2fr) 70px 70px minmax(0,1fr)}}
.pw .eng .tr.ed input{min-width:0;max-width:100%;box-sizing:border-box}
@media (max-width:760px){.pw .eng .tr.ed{grid-template-columns:48px minmax(0,1fr) 64px 64px}.pw .eng .tr.ed>span{grid-column:1/-1}.pw .eng .tr{grid-template-columns:48px minmax(0,1fr) 56px}.pw .eng .tr .c4,.pw .eng .tr .c5{grid-column:2/-1}.pw .eng .tr.hd{display:none}}`;

function download(name, text, mime = 'text/csv;charset=utf-8') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const confTone = { KAPSAMLI_ARALIK: 'ok', KISMI_ALT_SINIR: 'warn', HESAPLANAMADI: 'bad' };
const confTr = { KAPSAMLI_ARALIK: 'desteklenen komutların tamamı', KISMI_ALT_SINIR: 'KISMİ — alt sınır, kesin değil', HESAPLANAMADI: 'hesaplanamadı' };

/** ctx: { api, ws, rev, can, fail, reload, chainOf(o) } */
export function buildEngineeringPanel(ctx, o) {
    const { api, ws, can, fail, reload } = ctx;
    const host = E('div', { class: 'eng', 'data-testid': 'eng-panel', 'data-op': o.opCode });
    const chain = ctx.chainOf?.(o) ?? null;
    const nc = chain?.nc && chain.nc.documentId && chain.nc.status !== 'YOK' ? chain.nc : null;
    const tl = chain?.toolList && chain.toolList.documentId && chain.toolList.status !== 'YOK' ? chain.toolList : null;
    const head = E('div', {}, E('h4', {}, 'Otomatik mühendislik'), E('div', { class: 'sub' }, nc ? `NC: ${nc.docNo ?? ''} ${nc.fileName ?? ''}`.trim() : 'Bu operasyona bağlı NC yok.'));
    const body = E('div', { 'data-testid': 'eng-body' });
    host.append(head, body);
    const gapsHost = E('div', { class: 'gaps', 'data-testid': 'eng-gaps' });
    const camLinked = !!(o.camProgramId || (chain?.cam?.status && chain.cam.status !== 'YOK'));
    let analysis = null; let fusion = null; let routeMap = null; let ncSrc = null; let kmiTools = ctx.kmiTools ?? []; let tlState = null; let plan = null; let busy = false;
    const toolListDoc = tl ? { validity: tl.controlState === 'EFFECTIVE' ? 'EFFECTIVE' : (tl.controlState ?? 'DRAFT') } : null;
    const redrawGaps = () => {
        const g = engineeringGaps({ analysis, ncDoc: nc ? { validity: nc.controlState === 'EFFECTIVE' ? 'EFFECTIVE' : (nc.controlState ?? 'DRAFT') } : null, camLinked, toolListDoc, op: o });
        gapsHost.replaceChildren(E('div', { 'data-testid': 'eng-ready', class: 'sub', style: 'width:100%' }, g.length ? `Hazırlık: ${g.length} eksik/uyarı` : 'Hazırlık: eksik görünmüyor (START kapıları ayrıca değerlendirilir)'), ...g.map((x) => chip(x.text, x.k === 'NC' || x.k === 'NC_FORMAT' ? 'bad' : 'warn')));
    };
    const state = () => {
        const blocks = [gapsHost];
        // m0213 öncesi YÜKLENDİ NC: sade geçiş (onaya gönder/inceleme zincirine gönderilmez)
        if (nc && nc.controlState === 'DRAFT' && nc.linked !== false && can.manageDocuments !== false) {
            const legacyBox = E('div', { class: 'banner', 'data-testid': 'eng-legacy' }, 'Bu NC m0213 öncesi YÜKLENDİ durumunda (geçerli değil). Yükleyen kimliği ve dosya bütünlüğü sunucuda doğrulanır; ikinci onay yoktur.');
            blocks.push(legacyBox);
            void (async () => {
                try {
                    const lg = await api.legacyDraft?.(nc.documentId);
                    if (!lg?.legacy) { legacyBox.textContent = 'Bu NC otomatik geçerli olamadı (ayrıntı: Doküman Kontrol > Olaylar). Düzeltilmiş yeni sürüm yükleyin.'; return; }
                    legacyBox.append(' ', E('button', { type: 'button', class: 'primary sm', 'data-testid': 'eng-make-effective', onClick: () => void (async () => {
                        try { const r = await api.docMakeEffective(nc.documentId, null); await reload(r?.published ? `${nc.docNo ?? 'NC'}: GEÇERLİ yapıldı (kimliğinizle mühürlendi).` : 'Geçerli yapılamadı — yetkiniz yok ya da önkoşul eksik.'); } catch (e) { fail(e); }
                    })() }, 'Geçerli yap'));
                } catch { /* sessiz: düğme çıkmaz */ }
            })();
        }
        return blocks;
    };
    const draw = () => {
        const kids = [...state()];
        if (!nc) kids.push(E('div', { class: 'mut', 'data-testid': 'eng-nonc' }, 'NC yüklenince analiz otomatik başlar. NC yüklemek için aşağıdaki teknik zincir kartını kullanın.'));
        else if (!analysis) kids.push(E('div', { class: 'mut', 'data-testid': 'eng-loading' }, 'NC analiz ediliyor…'));
        else kids.push(...analysisView());
        if (tlState) kids.push(tlStatusView());
        kids.push(sourcesView(), fusionView(), qualityView());
        body.replaceChildren(...kids.filter(Boolean));
        redrawGaps();
    };
    function analysisView() {
        const a = analysis; const out = [];
        if (!a.supported) return [E('div', { class: 'banner bad', 'data-testid': 'eng-unsupported' }, `NC analiz edilemedi: ${a.unsupportedReason}`)];
        out.push(E('div', { class: 'sub', 'data-testid': 'eng-summary' }, `${a.programNumber ?? 'program no yok'}${a.programName ? ' · ' + a.programName : ''} · ${a.kind} · ${a.lineCount} satır · ${a.toolDraft.length} takım · ${a.estimate.toolChanges} takım değişimi · mil: ${[...a.spindle.dirs].join('/') || '—'}${a.spindle.rpm.length ? ' · devir ' + a.spindle.rpm[0] + '–' + a.spindle.rpm[a.spindle.rpm.length - 1] : ''}${a.spindle.css.length ? ' · CSS ' + a.spindle.css.join('/') + ' m/dk' : ''} · soğutma ${a.coolant.join(',') || '—'}`));
        const matches = matchKmiTools(a.toolDraft, ctx.kmiTools ?? []);
        out.push(E('div', { class: 'tt', 'data-testid': 'eng-tools' },
            E('div', { class: 'tr hd' }, E('span', {}, 'T'), E('span', {}, 'Takım (NC yorumundan)'), E('span', {}, 'Ø mm'), E('span', {}, 'Boy'), E('span', {}, 'Durum')),
            ...a.toolDraft.map((t, i) => E('div', { class: 'tr', 'data-testid': 'eng-tool', 'data-t': t.t },
                E('b', {}, t.t), E('span', {}, t.description ?? '—', t.typeGuess ? E('span', { class: 'sub' }, ` · tip (açıklamadan çıkarım): ${t.typeGuess}`) : null, t.libraryRef ? E('span', { class: 'sub' }, ` · ${t.libraryRef}`) : null, t.lathe ? E('span', { class: 'sub' }, ` · istasyon ${t.lathe.station} / ofset ${String(t.lathe.offset).padStart(2, '0')} (çözüm: Haas tipi T kodu)`) : null),
                E('span', {}, t.diameterMm ?? '—'), E('span', {}, t.lengthMm ?? '—'),
                E('span', { class: 'c5' }, t.missing.length ? chip(`eksik: ${t.missing.join(', ')}`, 'warn') : chip('NC’den okundu', 'ok'), chip(matches[i].status === 'ESLESTI' ? 'KMI kartı eşleşti' : 'KMI takım kartı eşleşmesi yok', matches[i].status === 'ESLESTI' ? 'ok' : ''), t.usedInProgram ? null : chip('programda çağrılmıyor', '')))),
        ));
        if (a.toolsCalledNotCommented.length) out.push(E('div', { class: 'banner', 'data-testid': 'eng-nocomment' }, `NC’de çağrılan ama yorumu olmayan takım: ${a.toolsCalledNotCommented.join(', ')} — çap/boy NC’den çıkarılamaz, kullanıcı girmeli.`));
        const acts = E('div', { class: 'acts' }, E('button', { type: 'button', class: 'ghost sm', 'data-testid': 'eng-tool-csv', onClick: () => download(`takim-listesi-taslak-${o.opCode}.csv`, toolDraftCsv(a.toolDraft, { footer: `NC analizinden TASLAK (${nc.docNo ?? ''}); doğrulanmadan geçerli değildir` })) }, 'Takım listesi taslağını indir (CSV)'), foreignTl() ? chip(`${tl.docNo ?? 'Takım listesi'} elle yüklenmiş; üzerine yazılmaz`, 'info') : ctx.canCreate !== false && a.toolDraft.length ? E('button', { type: 'button', class: 'primary sm', 'data-testid': 'eng-tl-create', disabled: busy, onClick: () => { plan = plan ?? draftRows(a, kmiTools ?? []); draw(); } }, tl ? 'Takım listesini güncelle (NC’den)' : 'Takım listesini oluştur') : null);
        out.push(acts, plan ? builderView() : null, E('div', { class: 'sub' }, 'CSV, takım listesi olarak yüklendiğinde normal mühür uygulanır; kritik takım doğrulaması (kapı) ayrıca yapılır. Tutucu/uzunluk gibi NC’de olmayan alanlar boş bırakılır — uydurulmaz.'));
        return out;
    }
    const GEN = /^takim-listesi-/;
    function foreignTl() { return !!tl && !(tlState && GEN.test(tlState.fileName ?? '')); }
    function tlStatusView() {
        const t = tlState; const ck = t.checks; const todo = ck?.checks ? ck.checks.filter((x) => x.status !== 'OK') : [];
        const stTr = { DRAFT: 'YÜKLENDİ — kritik takım doğrulaması bekliyor', IN_REVIEW: 'Kontrolde', APPROVED: 'Onaylı (yürürlüğe alınmadı)', EFFECTIVE: 'GEÇERLİ', SUPERSEDED: 'Eski sürüm', REJECTED: 'İptal' };
        const mt = analysis?.supported ? draftRows(analysis, kmiTools ?? []) : [];
        const matched = mt.filter((r) => r.match === 'ESLESTI').length;
        return E('div', { class: 'banner', 'data-testid': 'eng-tl-status' }, E('b', {}, `Takım listesi: ${t.docNo ?? ''} v${t.versionNo}`), ` · ${stTr[t.state] ?? t.state}${t.state === 'EFFECTIVE' ? '' : ' (geçerli sayılmaz)'}`,
            analysis?.supported ? E('div', { class: 'sub', 'data-testid': 'eng-tl-counts' }, `NC’den çıkarılan benzersiz takım: ${mt.length} · KMI takım kartı: ${kmiTools == null ? 'okunamadı' : `${matched} eşleşti / ${mt.length - matched} eşleşmedi`}`) : null,
            ck ? E('div', { class: 'sub', 'data-testid': 'eng-tl-pending' }, todo.length ? `Doğrulama bekleyen/eksik: ${todo.map((x) => x.label).join(', ')}` : 'Otomatik kontroller tamam; kritik takım doğrulaması yetkili kişiden beklenir.') : null);
    }
    function builderView() {
        const rows = plan; const box = E('div', { class: 'formbox', 'data-testid': 'eng-tl-preview' });
        const nm = (r) => r.match === 'ESLESTI' ? chip('KMI kartı: ' + r.cardCode, 'ok') : chip(kmiTools == null ? 'kart eşleşmesi bilinmiyor' : 'KMI kartı yok (kart üretilmez)', 'warn');
        const inp = (r, k, w) => E('input', { value: r[k], 'data-testid': `eng-tl-${k}`, style: `width:${w}`, 'aria-label': `${r.t} ${k}`, onInput: (e) => { r[k] = e.target.value; r.edited = true; } });
        const uniq = new Set(rows.map((r) => r.t)).size;
        const df = tlState?.csv ? diffContent(tlState.csv, rows) : null;
        if (df) box.append(E('div', { class: 'banner', 'data-testid': 'eng-tl-diff' }, `Mevcut listeye (v${tlState.versionNo}) göre fark — eklenen: ${df.added.join(', ') || '—'} · çıkan: ${df.removed.join(', ') || '—'} · değişen: ${df.changed.join(', ') || '—'}. Eski sürüm silinmez; yeni sürüm TASLAK olur ve kritik takım doğrulaması yeniden istenir.`));
        box.append(E('div', { class: 'sub', 'data-testid': 'eng-tl-head' }, `${rows.length} takım satırı (${uniq} benzersiz T). Boş alanlar boş kalır; değer uydurulmaz. İsterseniz düzenleyin.`),
            ...rows.map((r) => E('div', { class: 'tr ed', 'data-testid': 'eng-tl-row', 'data-t': r.t }, E('b', {}, r.t), inp(r, 'desc', '100%'), inp(r, 'dia', '60px'), inp(r, 'len', '60px'), E('span', {}, nm(r), r.inferredType ? chip('tip: açıklamadan çıkarım', '') : null, r.ambiguousOffset ? chip('birden çok H — offset boş', 'warn') : null))),
            E('div', { class: 'acts' }, E('button', { type: 'button', class: 'primary', 'data-testid': 'eng-tl-confirm', disabled: busy, onClick: () => void run(rows, box) }, 'Onayla ve kaydet'), E('button', { type: 'button', class: 'ghost', onClick: () => { plan = null; draw(); } }, 'Vazgeç')),
            E('div', { class: 'sub' }, 'Kayıt: dosya yükleme + operasyona bağlama + içerik eşleme tek işlemde; yükleyen kimliği, zaman, NC sürümü ve SHA-256 sunucuda kaydedilir. Liste doğrulanana kadar GEÇERLİ olmaz.'));
        return box;
    }
    async function run(rows, box) {
        if (busy) return; busy = true; box.querySelector('[data-testid=eng-tl-confirm]')?.setAttribute('disabled', '');
        let step = 'başlangıç'; let up = null;
        try {
            const content = normalizedContent(rows);
            if (content.rows.length !== rows.length) throw new Error('Takım numaraları okunamadı; kayıt yapılmadı.');
            const title = `Takım listesi ${ws.product.code} ${opLabel(o)} (NC’den)`;
            let target = tl ? { documentId: tl.documentId } : null;
            if (!target) { const orphan = (ws.cards?.tools?.docs ?? []).find((d) => d.title === title); if (orphan) target = { documentId: orphan.id }; }
            if (target) {
                step = 'mevcut liste okunuyor';
                const latest = await api.docLatest(target.documentId);
                if (latest && !GEN.test(latest.fileName ?? '')) throw new Error(`${tl?.docNo ?? 'Mevcut takım listesi'} elle yüklenmiş; üzerine yazılmaz. Güncelleme için Takım listesi kartından yeni sürüm yükleyin.`);
                if (latest) {
                    const got = await api.toolistContentGet(latest.versionId).catch(() => null);
                    if (got?.saved && got.csv === content.csv) { busy = false; plan = null; await reload(`Bu operasyon için aynı NC sürümünden/aynı içerikle takım listesi zaten var (v${latest.versionNo}); ikinci kayıt oluşturulmadı.`, 'ok', { openOp: o.id }); return; }
                    if (got?.saved) { const df = diffContent(got.csv, rows); ctx.lastDiff = df; }
                }
            }
            const edited = rows.filter((r) => r.edited).map((r) => r.t);
            step = 'dosya yükleme';
            const fileName = `takim-listesi-${opLabel(o).replace('/', '-')}-${(nc.docNo ?? 'NC').replace(/\W+/g, '')}${ncSrc?.versionNo ? '-v' + ncSrc.versionNo : ''}.csv`;
            up = await api.upload({ docType: 'TOOL_LIST', entityType: 'PRODUCT_REVISION', entityId: ctx.rev.id, title: target ? null : title, fileName, mimeType: 'text/csv', contentBase64: toBase64(new TextEncoder().encode(rowsToCsv(rows))), validUntil: null, note: `NC’den oluşturuldu: ${nc.docNo ?? ''} ${ncSrc?.versionNo ? 'v' + ncSrc.versionNo : ''} sha256=${ncSrc?.sha256 ?? '?'}`, documentId: target?.documentId ?? null });
            step = 'operasyona bağlama';
            await api.linkDocumentToOp(up.documentId, o.opNo);
            step = 'içerik eşleme';
            const checks = await api.toolistContentSave(up.versionId, content.csv, { ...content.mapping, source: 'nc-analysis', ncDocumentId: nc.documentId, ncVersionId: ncSrc?.versionId ?? nc.versionId ?? null, ncSha256: ncSrc?.sha256 ?? null, ncDocNo: nc.docNo ?? null, ncVersionNo: ncSrc?.versionNo ?? null, operation: o.opCode, completion: { editedByUser: edited, inferredType: rows.filter((r) => r.inferredType).map((r) => r.t) } });
            busy = false; plan = null;
            const todo = (checks?.checks ?? []).filter((x) => x.status !== 'OK').length;
            const mt = rows.filter((r) => r.match === 'ESLESTI').length;
            await reload(`Takım listesi kaydedildi (${up.versionNo ? 'v' + up.versionNo : ''}): ${rows.length} takım, KMI kartı ${kmiTools == null ? 'okunamadı' : `${mt} eşleşti / ${rows.length - mt} eşleşmedi`}, otomatik kontrolde ${todo} madde bekliyor. Liste GEÇERLİ değil: kritik takım doğrulaması gerekir.`, 'ok', { openOp: o.id });
        } catch (e) {
            busy = false;
            // kısmi hata: sunucudaki gerçek durum okunur (ekran yenilenir), hata nedeni mesajda
            const why = errorText(e);
            try { await reload(`Takım listesi işlemi “${step}” adımında durdu: ${why}${up ? ' (dosya yüklendi; kalan adımlar yapılmadı — tekrar basınca aynı belge kullanılır)' : ''}. Ekran sunucudaki gerçek durumdan yenilendi.`, 'error', { openOp: o.id }); } catch { fail(e); }
        }
    }
    function sourcesView() {
        const e = analysis?.estimate; const wrap = E('div', { class: 'src', 'data-testid': 'eng-sources' });
        const box = (title, tid, ...kids) => E('div', { class: 'srcbox', 'data-testid': tid }, E('div', { class: 't' }, title), ...kids);
        wrap.append(box('NC analiz tahmini', 'eng-src-nc', e && e.confidence !== 'HESAPLANAMADI' ? E('div', { class: 'v' }, `${fmtDuration(e.totalSeconds[0])} – ${fmtDuration(e.totalSeconds[1])}`) : E('div', { class: 'v' }, nc ? 'hesaplanamadı' : 'NC yok'),
            e ? E('div', { class: 'sub' }, chip(confTr[e.confidence] ?? e.confidence, confTone[e.confidence] ?? ''), ` kesme ${fmtDuration(e.cuttingSeconds)} (besleme hareketlerinden) · rapid/takım değişimi/G53 aralık` ) : null,
            ...(e?.assumptions ?? []).map((t) => E('div', { class: 'sub' }, `Varsayım: ${t}`)),
            analysis?.unsupported?.length ? E('ul', { class: 'uns', 'data-testid': 'eng-unsupported-list' }, ...analysis.unsupported.map((u) => E('li', {}, `${u.text} (${u.count})`))) : null,
            e ? E('div', { class: 'sub' }, e.note) : null),
        box('Fusion CAM simülasyonu', 'eng-src-fusion', E('div', { class: 'v' }, routeMap?.matched?.simSeconds != null ? fmtDuration(routeMap.matched.simSeconds) : 'CAM simülasyonu yapılmadı'), E('div', { class: 'sub' }, routeMap?.matched?.simSeconds != null ? `${FUSION_SOURCE_LABEL}` : 'Fusion export/şablon yüklenmedi — NC tahmini yerine geçmez.')),
        box('Operatör beyanı / standart', 'eng-src-std', E('div', { class: 'v' }, o.cycleSeconds != null ? fmtDuration(o.cycleSeconds) : 'girilmemiş'), E('div', { class: 'sub' }, 'Rotada kayıtlı çevrim standardı; ölçüm değildir.')),
        box('Makine telemetrisi', 'eng-src-tele', E('div', { class: 'v' }, 'bu panelde okunmuyor'), E('div', { class: 'sub' }, 'Ölçülen çevrim süresi Çevrim analizi bölümündedir; burada tahmin yazılmaz.')));
        return wrap;
    }
    function fusionView() {
        const file = E('input', { type: 'file', accept: '.csv,.json,.txt', 'data-testid': 'eng-fusion-file', 'aria-label': 'Fusion export/şablon dosyası' });
        const res = E('div', { 'data-testid': 'eng-fusion-result', class: 'sub' }, fusion ? '' : 'Ürün seviyesinde tek Fusion projesi: setup/takım/program/simülasyon süresi KMI şablonuyla içe aktarılır. .f3d dosyası ayrıştırılmaz.');
        const render = () => {
            if (!fusion) return;
            if (!fusion.parsed.ok) { res.replaceChildren(E('div', { class: 'banner bad' }, fusion.parsed.error)); return; }
            res.replaceChildren(...fusion.map.map((m) => E('div', { class: 'sub', 'data-testid': 'eng-fusion-row' }, `${m.setup}: ${m.status === 'ESLESTI' ? `→ ${m.matched.opCode}` : m.status === 'CELISKI' ? 'op_no ile program dosyası farklı operasyonlara işaret ediyor — eşlenmedi' : m.status === 'BELIRSIZ' ? 'birden fazla aday — eşlenmedi' : 'KMI rotasında eşleşme yok'} · ${m.tools.length} takım · simülasyon ${m.simSeconds != null ? fmtDuration(m.simSeconds) : 'yok (CAM simülasyonu yapılmadı)'}`)), ...fusion.parsed.warnings.map((w) => E('div', { class: 'sub' }, w)));
        };
        file.addEventListener('change', () => void (async () => {
            const f = file.files?.[0]; if (!f) return;
            const parsed = parseFusionExport(/\.(f3d|f3z)$/i.test(f.name) ? '' : await f.text(), f.name);
            const map = parsed.ok ? mapFusionToRoute(parsed, ws.routing.filter((x) => x.active).map((x) => ({ id: x.id, opNo: x.opNo, opCode: x.opCode, ncFileName: (ctx.chainOf?.(x)?.nc?.fileName) ?? null }))) : [];
            fusion = { parsed, map }; routeMap = { matched: map.find((m) => m.matched?.id === o.id) ?? null }; draw();
        })());
        return E('details', { class: 'fsec', 'data-testid': 'eng-fusion' }, E('summary', {}, 'Fusion 360 verisi (içe aktarma)'), E('div', { class: 'owc-body' }, res, E('div', { class: 'acts' }, file, E('button', { type: 'button', class: 'ghost sm', 'data-testid': 'eng-fusion-template', onClick: () => download('kmi-fusion-aktarma-sablonu.csv', fusionTemplateCsv()) }, 'Şablonu indir (CSV)')), fusion ? null : E('div', { class: 'sub' }, 'Gerçek Fusion export örneği alındığında doğrudan setup sheet okuyucusu eklenir; şimdilik şablon gerekir (açık kaynak gereksinimi).')));
    }
    function qualityView() {
        const plans = (ws.quality ?? []).filter((q) => q.operationNo == null || q.operationNo === o.opNo);
        const drawing = ws.cards?.drawing?.docs?.[0] ?? null;
        return E('details', { class: 'fsec', 'data-testid': 'eng-quality' }, E('summary', {}, 'Kalite planı taslağı'), E('div', { class: 'owc-body' },
            E('div', { class: 'sub' }, plans.length ? `Bu operasyon için ${plans.length} mevcut kontrol planı var (onaylı planlar değiştirilmez).` : 'Bu operasyon için kontrol planı yok.'),
            E('div', { class: 'banner', 'data-testid': 'eng-quality-note' }, 'Çizimden ölçü/tolerans otomatik ÇIKARILMAZ (PDF çizim ve PMI okuyucusu yok); değer uydurulmaz. Taslak şablon kaynak-referans alanıyla gelir; hangi operasyonun hangi karakteristiği oluşturduğu kanıtlanamıyorsa “doğrulanmadı” kalır. Onay, ilk parça ve ölçüm kapıları kalite personelindedir.'),
            E('div', { class: 'acts' }, E('button', { type: 'button', class: 'ghost sm', 'data-testid': 'eng-quality-csv', onClick: () => download(`kalite-plani-taslak-${o.opCode}.csv`, qualityDraftCsv({ opCode: o.opCode, drawingDocNo: drawing?.docNo ?? ws.cards?.drawing?.docNo ?? null, drawingFileName: drawing?.fileName ?? null, ncProgram: analysis?.programNumber ?? null, tools: analysis?.toolDraft ?? [] })) }, 'Kalite planı taslak şablonunu indir (TASLAK)'))));
    }
    draw();
    if (nc) {
        void (async () => {
            try { ncSrc = await api.ncSource({ versionId: nc.versionId ?? null, documentId: nc.documentId }); analysis = analyzeNc(ncSrc.text, { machine: ctx.machineParams }); }
            catch (e) { analysis = { supported: false, unsupportedReason: `NC içeriği okunamadı: ${errorText(e)}`, toolDraft: [], toolsCalledNotCommented: [], estimate: { confidence: 'HESAPLANAMADI', totalSeconds: [null, null], note: '', assumptions: [] }, unsupported: [] }; }
            draw(); void loadTl();
            try { const k = await api.kmiTools?.(); kmiTools = Array.isArray(k) ? k : null; } catch { kmiTools = null; }
            draw();
        })();
    }
    async function loadTl() {
        if (!tl) { tlState = null; return; }
        try {
            const v = await api.docLatest(tl.documentId); if (!v) return;
            const checks = await api.toolistChecks(v.versionId).catch(() => null);
            const got = await api.toolistContentGet?.(v.versionId).catch(() => null);
            tlState = { docNo: tl.docNo, versionNo: v.versionNo, state: v.state, fileName: v.fileName, checks, csv: got?.saved ? got.csv : null };
        } catch { tlState = null; }
        draw();
    }
    if (!nc && tl) void loadTl();
    return host;
}
