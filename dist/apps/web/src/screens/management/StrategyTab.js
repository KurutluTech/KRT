// KMI-MANAGEMENT-001 · Strateji ve Hedefler — Balanced Scorecard: perspektif → hedef → KPI (hedef / gerçekleşme / kaynak) → aksiyon. Gerçekleşme ya sistemden hesaplanır
// (SYSTEM KPI) ya da kaynağı ve kanıtı yazılarak elle girilir (MANUAL); gerçekleşme yoksa BİLİNMİYOR gösterilir, 0 değil.
import { h } from '../../../../../packages/ui/src/h.js';
import { KPI_BANDS, KPI_STATE_TR, PERSPECTIVE_TR, attainment, isOverdue, kpiState, perspectiveScore } from '../../../../../packages/domain/src/managementIntel.js';
import { pill, provenance, stateBox } from '../../ds.js';
import { kpi, setKpiContext, areaIn, bannerEl, field, fmtDate, fmtDateTime, formBox, guarded, loadTab, needText, num, selectIn, textIn } from './kit.js';
const STATE_PILL = { ACHIEVED: 'ok', ON_TRACK: 'info', AT_RISK: 'warn', OFF_TRACK: 'bad', UNKNOWN: 'unknown' };
const SYSTEM_METRICS = [['OEE_TOTAL', 'OEE (%)'], ['ON_TIME_DELIVERY_PCT', 'Zamanında teslimat (%)'], ['SCRAP_RATE_PCT', 'Hurda oranı (%)'], ['NCR_OPEN_COUNT', 'Açık uygunsuzluk (adet)'], ['OVERDUE_ORDER_ITEMS', 'Geciken sipariş kalemi']];
const monthOf = (today) => today.slice(0, 7);
export async function renderStrategyTab(panel, ctx, period = monthOf(ctx.today), banner) {
    const redraw = (b) => renderStrategyTab(panel, ctx, period, b);
    const run = guarded(panel, redraw);
    setKpiContext(ctx, new Date(ctx.nowMs).toISOString());
    await loadTab(panel, 'Strateji ve Hedefler', 'st', async () => ({ ov: await ctx.api.strategy(period), owners: await ctx.api.owners() }), ({ ov, owners }) => {
        const ownerOpts = () => owners.map((o) => [o.id, o.name]);
        const canWrite = ctx.held.has('STRATEGY_MANAGE');
        const byPersp = (p) => ov.objectives.filter((o) => o.perspective === p);
        const kpiRow = (o, k) => {
            const pct = attainment({ direction: k.direction, target: k.target, baseline: k.baseline, actual: k.actual });
            const st = kpiState(pct);
            const actualIn = textIn('st-reading-actual', 'Gerçekleşme', 'number');
            const srcIn = textIn('st-reading-source', 'Kaynak (örn. sevk irsaliyeleri)');
            const evIn = textIn('st-reading-evidence', 'Kanıt/belge no (isteğe bağlı)');
            return h('div', { class: 'item', 'data-testid': 'st-kpi', 'data-kpi-id': k.id, 'data-state': st, style: 'align-items:flex-start' }, h('div', { class: 'grow', style: 'min-width:200px' }, h('b', {}, k.name), h('div', { class: 'mut' }, `Hedef: ${num(k.target, k.unit, 2)}${k.baseline !== null ? ` · Başlangıç: ${num(k.baseline, k.unit, 2)}` : ''} · ${k.direction === 'HIGHER_IS_BETTER' ? 'yüksek iyi' : 'düşük iyi'} · ${k.sourceKind === 'SYSTEM' ? 'SİSTEM hesabı' : 'elle giriş'}`), h('div', { class: 'mut', 'data-testid': 'st-actual-src' }, `Gerçekleşme (${period}): ${num(k.actual, k.unit, 2)} · Kaynak: ${k.actualSource ?? 'YOK'}${k.actualRecordedAt ? ` · ${fmtDateTime(k.actualRecordedAt)}` : ''}`)), h('div', {}, pill(KPI_STATE_TR[st], STATE_PILL[st], 'st-kpi-state'), ' ', h('b', { 'data-testid': 'st-kpi-pct' }, pct === null ? 'BİLİNMİYOR' : `%${pct}`)), canWrite && k.sourceKind === 'MANUAL' && o.status === 'ACTIVE' ? h('details', { style: 'flex-basis:100%' }, h('summary', { class: 'mut', style: 'cursor:pointer;min-height:36px;display:flex;align-items:center' }, 'Gerçekleşme gir / düzelt'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px' }, actualIn, srcIn, evIn, h('button', { type: 'button', class: 'primary', 'data-testid': 'st-reading-save', onClick: () => {
                    const a = Number(actualIn.value);
                    const bad = actualIn.value === '' || !Number.isFinite(a) ? 'Gerçekleşme sayı olmalı' : needText(srcIn.value, 3, 'Kaynak');
                    if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    }
                    void run(() => ctx.api.recordReading({ kpiId: k.id, period, actual: a, source: srcIn.value.trim(), evidenceRef: evIn.value.trim(), note: '' }), 'Gerçekleşme kaydedildi (önceki kayıt silinmez; en yeni kayıt geçerlidir).');
                } }, 'Kaydet'))) : null);
        };
        const actionRow = (a) => {
            const note = textIn('st-action-note', 'Sonuç notu (kapatmak için zorunlu)');
            const late = isOverdue(a.dueDate, a.status, ctx.today);
            return h('div', { class: 'item', 'data-testid': 'st-action', 'data-action-id': a.id }, h('div', { class: 'grow' }, h('b', {}, a.title), h('div', { class: 'mut' }, `Sorumlu: ${a.ownerName ?? 'BİLİNMİYOR'} · Vade: ${fmtDate(a.dueDate)}${a.resultNote ? ` · Sonuç: ${a.resultNote}` : ''}`)), pill(a.status === 'DONE' ? 'Tamamlandı' : a.status === 'CANCELLED' ? 'İptal' : a.status === 'IN_PROGRESS' ? 'Devam ediyor' : 'Açık', a.status === 'DONE' ? 'ok' : a.status === 'CANCELLED' ? '' : 'info'), late ? pill('GECİKTİ', 'bad', 'st-action-late') : null, canWrite && (a.status === 'OPEN' || a.status === 'IN_PROGRESS') ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;flex-basis:100%' }, note, a.status === 'OPEN' ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'st-action-start', onClick: () => void run(() => ctx.api.setActionStatus(a.id, 'IN_PROGRESS', ''), 'Aksiyon başlatıldı.') }, 'Başlat') : null, h('button', { type: 'button', class: 'okb', 'data-testid': 'st-action-done', onClick: () => { const bad = needText(note.value, 5, 'Sonuç notu'); if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                } void run(() => ctx.api.setActionStatus(a.id, 'DONE', note.value.trim()), 'Aksiyon tamamlandı.'); } }, 'Tamamla'), h('button', { type: 'button', class: 'danger', 'data-testid': 'st-action-cancel', onClick: () => { const bad = needText(note.value, 5, 'İptal gerekçesi'); if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                } void run(() => ctx.api.setActionStatus(a.id, 'CANCELLED', note.value.trim()), 'Aksiyon iptal edildi.'); } }, 'İptal')) : null);
        };
        const objCard = (o) => {
            const reason = textIn('st-obj-reason', 'Gerekçe (en az 5 karakter)');
            const aTitle = textIn('st-act-title', 'Aksiyon başlığı');
            const aOwner = selectIn('st-act-owner', ownerOpts());
            const aDue = textIn('st-act-due', 'Vade', 'date');
            const kName = textIn('st-kpi-name', 'KPI adı');
            const kUnit = textIn('st-kpi-unit', 'Birim (%, adet…)');
            const kDir = selectIn('st-kpi-dir', [['HIGHER_IS_BETTER', 'Yüksek iyi'], ['LOWER_IS_BETTER', 'Düşük iyi']]);
            const kTarget = textIn('st-kpi-target', 'Hedef', 'number');
            const kBase = textIn('st-kpi-base', 'Başlangıç (isteğe bağlı)', 'number');
            const kSrc = selectIn('st-kpi-src', [['MANUAL', 'Elle giriş (kaynaklı)'], ...SYSTEM_METRICS.map(([v, l]) => [`SYSTEM:${v}`, `Sistem: ${l}`])]);
            return h('div', { class: 'panel', 'data-testid': 'st-objective', 'data-objective-id': o.id, style: 'margin-top:8px' }, h('div', { class: 'head' }, h('b', { class: 'grow' }, o.title), pill(o.status === 'ACTIVE' ? 'Aktif' : o.status === 'ACHIEVED' ? 'Ulaşıldı' : 'Bırakıldı', o.status === 'ACHIEVED' ? 'ok' : o.status === 'DROPPED' ? '' : 'info')), h('div', { class: 'mut' }, `Sorumlu: ${o.ownerName ?? 'BİLİNMİYOR'} · ${fmtDate(o.periodFrom)} – ${fmtDate(o.periodTo)}${o.description ? ` · ${o.description}` : ''}`), ...(o.kpis.length ? o.kpis.map((k) => kpiRow(o, k)) : [h('div', { class: 'empty' }, 'Bu hedefe bağlı KPI yok — hedef ölçülmeden izlenemez.')]), ...o.actions.map(actionRow), canWrite ? h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:8px' }, formBox('KPI ekle', 'st-kpi-form', field('Ad', kName), field('Birim', kUnit), field('Yön', kDir), field('Hedef', kTarget), field('Başlangıç', kBase), field('Gerçekleşme kaynağı', kSrc), h('button', { type: 'button', class: 'primary', 'data-testid': 'st-kpi-save', onClick: () => {
                    const t = Number(kTarget.value);
                    const bad = needText(kName.value, 2, 'KPI adı') ?? (kUnit.value.trim() ? null : 'Birim zorunlu') ?? (kTarget.value === '' || !Number.isFinite(t) ? 'Hedef sayı olmalı' : null);
                    if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    }
                    const sys = kSrc.value.startsWith('SYSTEM:') ? kSrc.value.slice(7) : null;
                    void run(() => ctx.api.createKpi({ objectiveId: o.id, name: kName.value.trim(), unit: kUnit.value.trim(), direction: kDir.value, target: t, baseline: kBase.value === '' ? null : Number(kBase.value), sourceKind: sys ? 'SYSTEM' : 'MANUAL', systemMetric: sys }), 'KPI eklendi.');
                } }, 'KPI kaydet')), formBox('Aksiyon ekle', 'st-act-form', field('Başlık', aTitle), field('Sorumlu', aOwner), field('Vade', aDue), h('button', { type: 'button', class: 'primary', 'data-testid': 'st-act-save', onClick: () => {
                    const bad = needText(aTitle.value, 3, 'Başlık') ?? (aDue.value ? null : 'Vade zorunlu');
                    if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    }
                    void run(() => ctx.api.createAction({ objectiveId: o.id, riskId: null, title: aTitle.value.trim(), ownerId: aOwner.value, due: aDue.value }), 'Aksiyon eklendi.');
                } }, 'Aksiyon kaydet')), o.status === 'ACTIVE' ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, reason, h('button', { type: 'button', class: 'okb', 'data-testid': 'st-obj-achieved', onClick: () => { const bad = needText(reason.value, 5, 'Gerekçe'); if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                } void run(() => ctx.api.setObjectiveStatus(o.id, 'ACHIEVED', reason.value.trim()), 'Hedef "ulaşıldı" olarak kapatıldı.'); } }, 'Ulaşıldı olarak kapat'), h('button', { type: 'button', class: 'danger', 'data-testid': 'st-obj-dropped', onClick: () => { const bad = needText(reason.value, 5, 'Gerekçe'); if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                } void run(() => ctx.api.setObjectiveStatus(o.id, 'DROPPED', reason.value.trim()), 'Hedef bırakıldı.'); } }, 'Bırak')) : null) : null);
        };
        const perspBlock = (p) => {
            if (p === 'FINANCIAL' && !ov.economicView)
                return h('div', { class: 'panel', 'data-testid': 'st-persp-FINANCIAL' }, h('h2', {}, PERSPECTIVE_TR[p]), stateBox('unknown', 'Finansal hedefler ekonomik veridir', `Yalnız ekonomik erişimi olanlar görür (D-007). ${ov.hiddenFinancialObjectives > 0 ? `${ov.hiddenFinancialObjectives} finansal hedef gizli.` : 'Bu hesapta gösterilmiyor.'}`));
            const objs = byPersp(p);
            const sc = perspectiveScore(objs.filter((o) => o.status !== 'DROPPED').flatMap((o) => o.kpis.filter((k) => k.active).map((k) => attainment({ direction: k.direction, target: k.target, baseline: k.baseline, actual: k.actual }))));
            return h('div', { class: 'panel', 'data-testid': `st-persp-${p}` }, h('div', { class: 'head' }, h('h2', { class: 'grow' }, PERSPECTIVE_TR[p]), h('span', { 'data-testid': 'st-persp-score' }, sc.score === null ? pill('Skor BİLİNMİYOR', 'unknown') : pill(`Skor %${sc.score} · ${sc.known} KPI${sc.unknown ? ` · ${sc.unknown} bilinmiyor` : ''}`, sc.score >= KPI_BANDS.onTrack ? 'ok' : sc.score >= KPI_BANDS.atRisk ? 'warn' : 'bad'))), ...(objs.length ? objs.map(objCard) : [h('div', { class: 'empty', 'data-testid': 'st-persp-empty' }, 'Bu perspektifte hedef yok.')]));
        };
        const oTitle = textIn('st-obj-title', 'Hedef başlığı');
        const oPersp = selectIn('st-obj-persp', Object.keys(PERSPECTIVE_TR).filter((p) => p !== 'FINANCIAL' || ov.economicView).map((p) => [p, PERSPECTIVE_TR[p]]));
        const oOwner = selectIn('st-obj-owner', ownerOpts());
        const oFrom = textIn('st-obj-from', 'Başlangıç', 'date');
        const oTo = textIn('st-obj-to', 'Bitiş', 'date');
        const oDesc = areaIn('st-obj-desc', 'Açıklama (isteğe bağlı)');
        const pIn = textIn('st-period', 'Dönem', 'month');
        pIn.value = period;
        const allK = ov.objectives.filter((o) => o.status === 'ACTIVE').flatMap((o) => o.kpis);
        const states = allK.map((k) => kpiState(attainment({ direction: k.direction, target: k.target, baseline: k.baseline, actual: k.actual })));
        return h('div', { class: 'kd', 'data-testid': 'st-root' }, bannerEl(banner, 'st-banner'), h('div', { class: 'head' }, h('h2', { class: 'grow' }, 'Balanced Scorecard'), field('Dönem', pIn), h('button', { type: 'button', class: 'ghost', 'data-testid': 'st-period-go', onClick: () => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(pIn.value))
                void renderStrategyTab(panel, ctx, pIn.value); } }, 'Göster')), h('div', { class: 'kpis' }, kpi('Aktif hedef', String(ov.objectives.filter((o) => o.status === 'ACTIVE').length), 'st-kpi-objectives'), kpi('İzlenen KPI', String(allK.length), 'st-kpi-count'), kpi('Hedefin gerisinde', String(states.filter((s) => s === 'OFF_TRACK').length), 'st-kpi-off'), kpi('Bilinmeyen', String(states.filter((s) => s === 'UNKNOWN').length), 'st-kpi-unknown')), ...['FINANCIAL', 'CUSTOMER', 'PROCESS', 'LEARNING_GROWTH'].map(perspBlock), canWrite ? formBox('Yeni hedef', 'st-obj-form', field('Başlık', oTitle), field('Perspektif', oPersp), field('Sorumlu', oOwner), field('Başlangıç', oFrom), field('Bitiş', oTo), field('Açıklama', oDesc), h('button', { type: 'button', class: 'primary', 'data-testid': 'st-obj-save', onClick: () => {
                const bad = needText(oTitle.value, 3, 'Başlık') ?? (oFrom.value && oTo.value ? (oTo.value >= oFrom.value ? null : 'Bitiş başlangıçtan önce olamaz') : 'Başlangıç ve bitiş zorunlu');
                if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                }
                void run(() => ctx.api.createObjective({ perspective: oPersp.value, title: oTitle.value.trim(), description: oDesc.value, ownerId: oOwner.value, from: oFrom.value, to: oTo.value }), 'Hedef eklendi.');
            } }, 'Hedef kaydet')) : stateBox('unknown', 'Salt okunur', 'Hedef ve KPI girişi için STRATEGY_MANAGE yetkisi gerekir.'), h('div', { class: 'mut' }, `Yorum bandı (görüntü): ≥%${KPI_BANDS.achieved} ulaşıldı · ≥%${KPI_BANDS.onTrack} yolunda · ≥%${KPI_BANDS.atRisk} risk altında · altı hedefin gerisinde. Skor: bilinen KPI'ların ortalaması (her biri en çok %100 sayılır).`), provenance('mgmt_objectives · mgmt_kpis · mgmt_kpi_readings · sistem metrikleri (_mgmt_metric)', fmtDateTime(ov.generatedAt)));
    });
}
