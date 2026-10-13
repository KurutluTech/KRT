// KMI-MANAGEMENT-001 · Yönetim HOME — bugün karar gerektirenler, operasyonel ve (yetkiliyse) finansal göstergeler, riskler, gecikmeler, açık öneriler. Her kutu kendi kaynağından bağımsız okunur:
// okunamayan kaynak "okunamadı" der, hiçbir zaman 0 gibi görünmez. Hesap yok — yalnız sunucu fonksiyonları ve kanonik kayıtlar.
import { h, mount } from '../../../../../packages/ui/src/h.js';
import { RISK_BAND_TR, attainment, isOverdue, kpiState, riskBand } from '../../../../../packages/domain/src/managementIntel.js';
import { buildRecommendations, splitRecommendations } from '../../../../../packages/domain/src/managementIntel.js';
import { pill, provenance, stateBox } from '../../ds.js';
import { loadIntelSources, recInputsFrom } from './IntelligenceTab.js';
import { kpi, setKpiContext, fmtDateTime, num, pctFmt, settle } from './kit.js';
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const moneyList = (m) => (m.length === 0 ? 'KAYIT YOK' : m.map((x) => num(x.amount, x.currency, 2)).join(' · '));
export async function renderHomeTab(panel, ctx) {
    mount(panel, h('div', { 'data-testid': 'hm-loading' }, stateBox('loading', 'Yönetim özeti yükleniyor…')));
    const from = addDays(ctx.today, -29);
    const [src, snap, fin] = await Promise.all([loadIntelSources(ctx), settle(ctx.api.kpiSnapshot(from, ctx.today)), ctx.hasEconomics ? settle(ctx.economics.overview(from, ctx.today)) : Promise.resolve(null)]);
    setKpiContext(ctx, snap.ok ? snap.value.generatedAt : new Date(ctx.nowMs).toISOString(), snap.ok ? Object.fromEntries(Object.entries({ 'hm-oee': snap.value.metrics.OEE_TOTAL.basis, 'hm-otd': snap.value.metrics.ON_TIME_DELIVERY_PCT.basis, 'hm-scrap': snap.value.metrics.SCRAP_RATE_PCT.basis, 'hm-ncr': snap.value.metrics.NCR_OPEN_COUNT.basis, 'hm-overdue-items': snap.value.metrics.OVERDUE_ORDER_ITEMS.basis })) : {});
    const items = src.inbox?.items ?? [];
    const crit = items.filter((i) => i.priority === 'KRITIK');
    const risks = src.risks?.risks.filter((r) => r.status !== 'CLOSED') ?? [];
    const critRisks = risks.filter((r) => r.score >= 15);
    const lateRisk = risks.filter((r) => isOverdue(r.reviewDate, r.status, ctx.today));
    const actions = [...(src.strategy?.objectives ?? []).flatMap((o) => o.actions), ...(src.risks?.risks ?? []).flatMap((r) => r.actions)];
    const lateActions = actions.filter((a) => isOverdue(a.dueDate, a.status, ctx.today));
    const lateDecisions = (src.meetings?.meetings ?? []).flatMap((m) => m.decisions).filter((d) => isOverdue(d.dueDate, d.status, ctx.today));
    const kpis = (src.strategy?.objectives ?? []).filter((o) => o.status === 'ACTIVE').flatMap((o) => o.kpis.filter((k) => k.active).map((k) => ({ k, st: kpiState(attainment({ direction: k.direction, target: k.target, baseline: k.baseline, actual: k.actual })) })));
    const offTrack = kpis.filter((x) => x.st === 'OFF_TRACK');
    const recs = splitRecommendations(buildRecommendations(recInputsFrom(src, ctx)), src.history, ctx.today).open;
    const m = snap.ok ? snap.value.metrics : null;
    const alerts = src.command?.alerts.filter((a) => a.severity === 'CRITICAL') ?? [];
    const unread = (n) => src.failed.includes(n);
    const cnt = (n, v) => (unread(n) || v === null ? 'OKUNAMADI' : String(v));
    const decisionRows = [
        ['Bekleyen onay', 'Onaylar', 'hm-n-approvals', src.inbox ? items.length : null, '#/yonetim?sekme=onaylar'], ['Kritik bekleyen onay (72 sa+)', 'Onaylar', 'hm-n-critical-approvals', src.inbox ? crit.length : null, '#/yonetim?sekme=onaylar'],
        ['Kritik risk', 'Risk', 'hm-n-critical-risks', src.risks ? critRisks.length : null, '#/yonetim?sekme=risk'], ['Gözden geçirmesi geçen risk', 'Risk', 'hm-n-late-risks', src.risks ? lateRisk.length : null, '#/yonetim?sekme=risk'],
        ['Geciken aksiyon', 'Strateji', 'hm-n-late-actions', src.risks && src.strategy ? lateActions.length : null, '#/yonetim?sekme=strateji'], ['Geciken toplantı kararı', 'Toplantılar', 'hm-n-late-decisions', src.meetings ? lateDecisions.length : null, '#/yonetim?sekme=toplanti'],
        ['Hedefin gerisindeki KPI', 'Strateji', 'hm-n-offtrack', src.strategy ? offTrack.length : null, '#/yonetim?sekme=strateji'], ['Açık KMI Zekâ önerisi', 'Zekâ', 'hm-n-recs', src.failed.length >= 5 ? null : recs.length, '#/yonetim?sekme=zeka']
    ];
    mount(panel, h('div', { class: 'kd', 'data-testid': 'hm-root' }, src.failed.length ? h('div', { 'data-testid': 'hm-partial' }, stateBox('unknown', 'Bazı kaynaklar okunamadı', `${src.failed.join(', ')} — bu kutular “OKUNAMADI” gösterir; 0 anlamına gelmez.`)) : null, h('div', { class: 'panel', 'data-testid': 'hm-decisions' }, h('h2', {}, 'Karar gerektirenler'), h('div', { class: 'kpis' }, ...decisionRows.map(([label, , tid, v, href]) => h('a', { href, style: 'text-decoration:none;color:inherit;display:block', 'data-testid': `${tid}-link` }, kpi(label, v === null ? 'OKUNAMADI' : String(v), tid, { wrapperIsDrill: true }))))), h('div', { class: 'panel', 'data-testid': 'hm-ops' }, h('h2', {}, 'Operasyon (son 30 gün)'), !snap.ok ? stateBox(snap.setup ? 'unknown' : 'error', snap.setup ? 'Operasyon göstergeleri için kurulum bekleniyor' : 'Operasyon göstergeleri okunamadı', snap.setup ? undefined : snap.error)
        : h('div', { class: 'kpis' }, kpi('OEE', pctFmt(m.OEE_TOTAL.value === null ? null : m.OEE_TOTAL.value), 'hm-oee'), kpi('Zamanında teslimat', pctFmt(m.ON_TIME_DELIVERY_PCT.value), 'hm-otd'), kpi('Hurda oranı', pctFmt(m.SCRAP_RATE_PCT.value), 'hm-scrap'), kpi('Açık uygunsuzluk', num(m.NCR_OPEN_COUNT.value, '', 0), 'hm-ncr'), kpi('Geciken sipariş kalemi', num(m.OVERDUE_ORDER_ITEMS.value, '', 0), 'hm-overdue-items'))), h('div', { class: 'panel', 'data-testid': 'hm-fin' }, h('h2', {}, 'Finans'), !ctx.hasEconomics ? h('div', { class: 'mut', 'data-testid': 'hm-fin-locked' }, 'Finansal göstergeler ekonomik erişimi olan kişilere gösterilir.')
        : !fin || !fin.ok ? stateBox(fin?.setup ? 'unknown' : 'error', fin?.setup ? 'Finansal özet için kurulum bekleniyor' : 'Finansal özet okunamadı', fin && !fin.ok && !fin.setup ? fin.error : undefined)
            : h('div', { class: 'kpis' }, kpi('Gelir (fatura)', moneyList(fin.value.revenue), 'hm-revenue'), kpi('Tahsilat', moneyList(fin.value.collections), 'hm-collections'), kpi('Malzeme çıkışı', moneyList(fin.value.materialIssued), 'hm-material'))), h('div', { class: 'panel', 'data-testid': 'hm-risks' }, h('h2', {}, 'En yüksek riskler'), !src.risks ? stateBox('unknown', 'Risk kaydı okunamadı') : critRisks.length + risks.length === 0 ? h('div', { class: 'empty' }, 'Kayıtlı açık risk yok.')
        : h('div', {}, ...[...risks].sort((a, b) => b.score - a.score).slice(0, 5).map((r) => h('div', { class: 'item', 'data-testid': 'hm-risk-row' }, h('b', { class: 'grow' }, r.title), pill(`${RISK_BAND_TR[riskBand(r.score)]} · ${r.score}`, r.score >= 15 ? 'bad' : r.score >= 10 ? 'warn' : 'info'), h('span', { class: 'mut' }, r.ownerName ?? 'BİLİNMİYOR'))))), alerts.length ? h('div', { class: 'panel', 'data-testid': 'hm-alerts' }, h('h2', {}, `Kritik operasyon uyarıları (${alerts.length})`), ...alerts.slice(0, 6).map((a) => h('div', { class: 'item', 'data-testid': 'hm-alert-row' }, pill('KRİTİK', 'bad'), h('span', { class: 'grow' }, a.title), h('span', { class: 'mut' }, a.detail ?? '')))) : null, h('div', { class: 'panel', 'data-testid': 'hm-recs' }, h('h2', {}, 'KMI Zekâ — öne çıkan öneriler'), recs.length === 0 ? h('div', { class: 'empty' }, 'Açık öneri yok.') : h('div', {}, ...recs.slice(0, 3).map((r) => h('div', { class: 'item', 'data-testid': 'hm-rec-row' }, pill(r.severity === 'KRITIK' ? 'KRİTİK' : 'YÜKSEK', r.severity === 'KRITIK' ? 'bad' : 'warn'), h('span', { class: 'grow' }, r.title)))), h('a', { href: '#/yonetim?sekme=zeka', class: 'btn ghost' }, 'Tümünü gör')), provenance('Onaylar · Strateji · Risk · Toplantılar · KPI özeti · Komuta merkezi', fmtDateTime(new Date(ctx.nowMs).toISOString()))));
}
