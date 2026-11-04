// Operasyon çalışma alanı — OTOMATİK MÜHENDİSLİK paneli. Salt okunur: mevcut NC belgesini okur, tarayıcıda analiz eder, takım listesi/Fusion/kalite TASLAKLARINI üretir.
// Hiçbir şey kaydedilmez, makineye gönderilmez, belge durumu değiştirilmez ("Geçerli yap" yalnız m0213 öncesi YÜKLENDİ kayıtlar için, m0213 sunucu kuralıyla).
// Üç süre kaynağı AYRIDIR: NC analiz tahmini ≠ Fusion CAM simülasyonu ≠ operatör standardı ≠ makine ölçümü.
import { h } from '../../../../packages/ui/src/h.js';
import { analyzeNc, toolDraftCsv, matchKmiTools, engineeringGaps, fmtDuration } from '../../../../packages/domain/src/ncAnalysis.js';
import { parseFusionExport, mapFusionToRoute, fusionTemplateCsv, qualityDraftCsv, FUSION_SOURCE_LABEL } from '../../../../packages/domain/src/fusionImport.js';
import { errorText } from '../errorText.js';

const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const chip = (t, tone = '') => E('span', { class: `chip ${tone}` }, t);
export const ENG_CSS = `.pw .eng{border:1px solid #1e293b;border-radius:12px;padding:10px 12px;margin:0 0 12px;min-width:0;background:rgba(148,163,184,.04)}
.pw .eng h4{margin:0 0 6px;font-size:14px}.pw .eng .sub{color:#94a3b8;font-size:12px;overflow-wrap:anywhere}.pw .eng .gaps{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.pw .eng .src{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:8px 0}.pw .eng .srcbox{border:1px solid #334155;border-radius:10px;padding:8px 10px;min-width:0}
.pw .eng .srcbox .t{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;font-weight:700}.pw .eng .srcbox .v{font-weight:700;margin-top:2px;overflow-wrap:anywhere}
.pw .eng .tt{display:grid;grid-template-columns:minmax(0,1fr);gap:4px;margin-top:6px}.pw .eng .tr{display:grid;grid-template-columns:54px minmax(0,2.4fr) 62px 62px minmax(0,1.4fr);gap:4px 10px;padding:5px 0;border-top:1px solid #1e293b;align-items:start;min-width:0}
.pw .eng .tr>*{min-width:0;overflow-wrap:anywhere}.pw .eng .tr.hd{font-size:11px;color:#94a3b8;text-transform:uppercase;border-top:0}
.pw .eng .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pw .eng .uns{margin:6px 0 0;padding-left:18px;font-size:12px}
@media (max-width:760px){.pw .eng .tr{grid-template-columns:48px minmax(0,1fr) 56px}.pw .eng .tr .c4,.pw .eng .tr .c5{grid-column:2/-1}.pw .eng .tr.hd{display:none}}`;

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
    let analysis = null; let fusion = null; let routeMap = null;
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
        kids.push(sourcesView(), fusionView(), qualityView());
        body.replaceChildren(...kids);
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
        const acts = E('div', { class: 'acts' }, E('button', { type: 'button', class: 'ghost sm', 'data-testid': 'eng-tool-csv', onClick: () => download(`takim-listesi-taslak-${o.opCode}.csv`, toolDraftCsv(a.toolDraft, { footer: `NC analizinden TASLAK (${nc.docNo ?? ''}); doğrulanmadan geçerli değildir` })) }, 'Takım listesi taslağını indir (CSV)'));
        out.push(acts, E('div', { class: 'sub' }, 'CSV, takım listesi olarak yüklendiğinde normal mühür uygulanır; kritik takım doğrulaması (kapı) ayrıca yapılır. Tutucu/uzunluk gibi NC’de olmayan alanlar boş bırakılır — uydurulmaz.'));
        return out;
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
            try { const text = await api.ncText({ versionId: nc.versionId ?? null, documentId: nc.documentId }); analysis = analyzeNc(text, { machine: ctx.machineParams }); }
            catch (e) { analysis = { supported: false, unsupportedReason: `NC içeriği okunamadı: ${errorText(e)}`, toolDraft: [], toolsCalledNotCommented: [], estimate: { confidence: 'HESAPLANAMADI', totalSeconds: [null, null], note: '', assumptions: [] }, unsupported: [] }; }
            draw();
        })();
    }
    return host;
}
