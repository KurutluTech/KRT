// KMI-MANAGEMENT-001 · KMI Zekâ — açıklanabilir, kaynak veriye dayalı, İNSAN ONAYLI karar desteği. Kural tabanlıdır (model/ücretli servis yok); her öneri kuralını, kanıtını ve
// önerilen insan eylemini gösterir. Hiçbir öneri kendiliğinden bir şey yapmaz; kabul/ret/erteleme gerekçeyle kaydedilir (değiştirilemez geçmiş).
import { h } from '../../../../../packages/ui/src/h.js';
import { RULE_TEXT, attainment, buildRecommendations, splitRecommendations } from '../../../../../packages/domain/src/managementIntel.js';
import { pill, provenance, stateBox } from '../../ds.js';
import { bannerEl, fmtDateTime, guarded, needText, settle, textIn } from './kit.js';
import { mount } from '../../../../../packages/ui/src/h.js';
const SEV = { KRITIK: 'bad', YUKSEK: 'warn', ORTA: 'info' };
const DEC_TR = { ACCEPTED: 'Kabul edildi', REJECTED: 'Reddedildi', POSTPONED: 'Ertelendi' };
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Reads every source independently; a source that fails is NAMED (its rules simply cannot fire) — it is never treated as "no findings". */
export async function loadIntelSources(ctx) {
    const [a, s, r, m, c, hist] = await Promise.all([settle(ctx.approvals.load()), settle(ctx.api.strategy(ctx.today.slice(0, 7))), settle(ctx.api.risks()), settle(ctx.api.meetings()), settle(ctx.command.snapshot()), settle(ctx.api.recHistory())]);
    const failed = [];
    const pick = (n, x) => { if (x.ok)
        return x.value; failed.push(n); return null; };
    return { inbox: pick('Onaylar', a), strategy: pick('Strateji', s), risks: pick('Risk', r), meetings: pick('Toplantılar', m), command: pick('Komuta merkezi', c), history: pick('Öneri geçmişi', hist) ?? [], failed };
}
export function recInputsFrom(src, ctx) {
    const kpis = (src.strategy?.objectives ?? []).filter((o) => o.status === 'ACTIVE').flatMap((o) => o.kpis.filter((k) => k.active).map((k) => ({ id: k.id, name: k.name, perspective: o.perspective, unit: k.unit, target: k.target, actual: k.actual, pct: attainment({ direction: k.direction, target: k.target, baseline: k.baseline, actual: k.actual }), period: o.periodTo, actualSource: k.actualSource })));
    const risks = (src.risks?.risks ?? []).map((r) => ({ id: r.id, title: r.title, score: r.score, status: r.status, reviewDate: r.reviewDate, openActions: r.actions.filter((x) => x.status === 'OPEN' || x.status === 'IN_PROGRESS').length }));
    const actions = [...(src.strategy?.objectives ?? []).flatMap((o) => o.actions.map((a) => ({ id: a.id, title: a.title, ownerName: a.ownerName, dueDate: a.dueDate, status: a.status, parent: `Hedef “${o.title}”` }))), ...(src.risks?.risks ?? []).flatMap((r) => r.actions.map((a) => ({ id: a.id, title: a.title, ownerName: a.ownerName, dueDate: a.dueDate, status: a.status, parent: `Risk “${r.title}”` })))];
    return { today: ctx.today,
        approvals: (src.inbox?.items ?? []).map((i) => ({ key: i.key, kindLabel: i.kind, record: i.record, waitingHours: i.waitingHours, priority: i.priority })),
        kpis, risks, actions, decisions: (src.meetings?.meetings ?? []).flatMap((m) => m.decisions.map((d) => ({ id: d.id, text: d.text, ownerName: d.ownerName, dueDate: d.dueDate, status: d.status }))),
        alerts: (src.command?.alerts ?? []).map((a) => ({ key: `${a.kind}:${a.entityId}`, severity: a.severity, title: a.title, detail: a.detail, since: a.since })) };
}
export async function renderIntelligenceTab(panel, ctx, banner) {
    const redraw = (b) => renderIntelligenceTab(panel, ctx, b);
    const run = guarded(panel, redraw);
    mount(panel, h('div', { 'data-testid': 'iq-loading' }, stateBox('loading', 'KMI Zekâ öneriler hazırlanıyor…')));
    const src = await loadIntelSources(ctx);
    const recs = buildRecommendations(recInputsFrom(src, ctx));
    const { open, decided } = splitRecommendations(recs, src.history, ctx.today);
    const canDecide = ctx.held.has('MEETING_MANAGE');
    const card = (r) => {
        const note = textIn('iq-note', 'Gerekçe (en az 5 karakter)');
        const until = textIn('iq-until', 'Erteleme tarihi', 'date');
        until.value = addDays(ctx.today, 7);
        const decide = (decision) => () => {
            const bad = needText(note.value, 5, 'Gerekçe');
            if (bad) {
                void redraw({ kind: 'error', text: bad });
                return;
            }
            void run(() => ctx.api.recordRecommendation({ key: r.key, rule: r.ruleCode, decision, note: note.value.trim(), until: decision === 'POSTPONED' ? until.value : null, evidence: r.evidence }), `Öneri ${DEC_TR[decision].toLowerCase()} — kayda geçti. Sistem kendiliğinden işlem yapmadı.`);
        };
        return h('div', { class: 'panel', 'data-testid': 'iq-rec', 'data-rec-key': r.key, 'data-rule': r.ruleCode, style: 'margin-top:8px' }, h('div', { class: 'head' }, h('b', { class: 'grow' }, r.title), pill(r.severity === 'KRITIK' ? 'KRİTİK' : r.severity === 'YUKSEK' ? 'YÜKSEK' : 'ORTA', SEV[r.severity], 'iq-sev'), pill(r.ruleCode, '', 'iq-rule')), h('div', {}, r.why), h('div', { class: 'mut', 'data-testid': 'iq-evidence' }, 'Kanıt: ', r.evidence.map((e) => `${e.label}: ${e.value} (${e.source})`).join(' · ')), h('div', { class: 'mut', 'data-testid': 'iq-rule-text' }, `Kural: ${RULE_TEXT[r.ruleCode]}`), h('div', {}, h('b', {}, 'Önerilen insan eylemi: '), r.humanAction, r.link ? h('a', { href: r.link, style: 'margin-left:8px' }, 'Aç') : null), canDecide ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center' }, note, until, h('button', { type: 'button', class: 'okb', 'data-testid': 'iq-accept', onClick: decide('ACCEPTED') }, 'Kabul et (not al)'), h('button', { type: 'button', class: 'danger', 'data-testid': 'iq-reject', onClick: decide('REJECTED') }, 'Reddet'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'iq-postpone', onClick: decide('POSTPONED') }, 'Ertele')) : null);
    };
    mount(panel, h('div', { class: 'kd', 'data-testid': 'iq-root' }, bannerEl(banner, 'iq-banner'), h('div', { class: 'panel', 'data-testid': 'iq-disclaimer' }, h('b', {}, 'Nasıl çalışır: '), 'Öneriler sabit, açıklanabilir kurallarla KMI kayıtlarından üretilir (yapay zekâ modeli veya dış servis kullanılmaz). “Kabul” yalnız kararınızı ve gerekçenizi kaydeder; onay, ret veya başka bir işlem kendiliğinden yapılmaz — işlemi ilgili ekrandan siz yaparsınız.'), src.failed.length ? h('div', { 'data-testid': 'iq-partial' }, stateBox('unknown', 'Bazı kaynaklar okunamadı', `${src.failed.join(', ')} — bu kaynaklara bağlı kurallar çalışamadı; “öneri yok” demek değildir.`)) : null, h('div', { class: 'panel', 'data-testid': 'iq-open' }, h('h2', {}, `Açık öneriler (${open.length})`), ...(open.length ? open.map(card) : [h('div', { class: 'empty', 'data-testid': 'iq-empty' }, src.failed.length ? 'Okunabilen kaynaklarda açık öneri yok.' : 'Şu an kurallara uyan açık bir öneri yok.')])), decided.length || src.history.length ? h('details', { 'data-testid': 'iq-history' }, h('summary', { class: 'mut', style: 'cursor:pointer;min-height:36px;display:flex;align-items:center' }, `Karar geçmişi (${src.history.length})`), ...src.history.map((x) => h('div', { class: 'mut', 'data-testid': 'iq-history-row' }, `${fmtDateTime(x.decidedAt)} · ${DEC_TR[x.decision]} · ${x.ruleCode} · ${x.decidedByName ?? 'BİLİNMİYOR'} · ${x.note}${x.postponedUntil ? ` · ${x.postponedUntil} tarihine ertelendi` : ''}`))) : null, provenance('Onaylar · Strateji · Risk · Toplantılar · Komuta merkezi (kural tabanlı)', null)));
}
