// KMI NEXT — KMI Zekâ: Sıradaki adımlar (48), KMI'ye Sor (49), Süreç analizi (46), Dijital ikiz (47).
// Migrations 0046 + 0047. Kural tabanlıdır, dış yapay zekâ kullanılmaz; bilmediği soruya "BİLMİYORUM / VERİ
// YETERSİZ" der. Öneriler hiçbir işlemi kendisi yapmaz — kaydı açarsınız ve normal (yetkili) akışla karar verirsiniz.
// Süreç analizi ve dijital ikiz yalnız yönetime açıktır (sunucu reddederse bölüm görünmez). Senaryo sonuçları
// "SENARYO" etiketlidir ve hiçbir kaydı değiştirmez.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { COPILOT_EXAMPLES } from '../../../../packages/domain/src/intelligence.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const RISK_TR = { HIGH: 'YÜKSEK', MEDIUM: 'ORTA', LOW: 'DÜŞÜK' };
const RISK_COLOR = { HIGH: '#b91c1c', MEDIUM: '#a16207', LOW: '#475569' };
const STATUS_TR = { UP: 'ÇALIŞIR', DOWN: 'ARIZA', MAINTENANCE: 'BAKIMDA', HOLD: 'BEKLEMEDE' };
const LOAD_TR = { OK: 'normal', HIGH: 'yüksek', OVERLOAD: 'AŞIRI YÜK', UNKNOWN: 'BİLİNMİYOR' };
const errText = (e) => sharedErrorText(e);
const box = 'border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;margin:8px 0';
export async function renderIntelligenceScreen(container, api, state) {
    const pmFrom = state.pmFrom ?? new Date(Date.parse(`${state.today}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
    let nba = [];
    let nbaError = null;
    let pm = null;
    let twin = null;
    try {
        nba = await api.nextActions();
    }
    catch (e) {
        nbaError = errText(e);
    }
    try {
        pm = await api.processMining(pmFrom, state.today);
    }
    catch {
        pm = null;
    }
    try {
        twin = await api.twin(3);
    }
    catch {
        twin = null;
    }
    const go = (patch) => void renderIntelligenceScreen(container, api, { ...state, error: null, ...patch });
    const qIn = h('input', { type: 'text', 'data-testid': 'ai-question', value: state.question ?? '', placeholder: 'Ör. Bugün hangi siparişler riskte?', style: 'flex:1 1 200px;min-width:0;min-height:40px' });
    const ask = async (q) => { try {
        go({ question: q, answer: await api.ask(q) });
    }
    catch (e) {
        go({ question: q, error: errText(e) === 'QUESTION_REQUIRED' ? 'Bir soru yazın.' : errText(e) });
    } };
    const pmLog = (title, testid, l) => h('div', { 'data-testid': testid, 'data-sufficiency': l.sufficiency, style: box }, h('b', {}, title), h('div', { style: 'font-size:12px;color:#475569' }, `${l.cases} vaka · ${l.completeCases} eksiksiz · ${l.incompleteCases} geçmişi eksik (sonuçlara katılmadı)`), l.sufficiency === 'INSUFFICIENT' ? h('div', { 'data-testid': 'ai-pm-insufficient', style: 'font-weight:700;color:#92400e' }, `VERİ YETERSİZ — ${l.bottleneckReason ?? ''}`) : null, l.bottleneck ? h('div', { 'data-testid': 'ai-pm-bottleneck', style: 'font-weight:700' }, `En uzun bekleme: ${l.bottleneck.from} → ${l.bottleneck.to} (medyan ${l.bottleneck.medianHours} saat, ${l.bottleneck.count} kez)`)
        : l.sufficiency === 'SUFFICIENT' ? h('div', {}, l.bottleneckReason ?? '') : null, h('div', { style: 'font-size:12px' }, `Yeniden işlenen vaka: ${l.reworkCases} · Bekletmeye düşen: ${l.holdCases}${l.firstPieceWait ? ` · İlk parça bekleme medyanı: ${l.firstPieceWait.medianHours} saat` : ''}`), l.variants.length ? h('details', {}, h('summary', { style: 'font-size:12px' }, `En sık akışlar (${l.variants.length})`), ...l.variants.map((v) => h('div', { style: 'font-size:11px;overflow-wrap:anywhere' }, `${v.cases}× ${v.variant}`))) : null);
    const scenarioView = (s) => h('div', { 'data-testid': 'ai-scenario', 'data-kind': s.kind, style: `${box};border:2px dashed #7c3aed;background:#faf5ff` }, h('div', { style: 'font-weight:800;color:#6d28d9' }, s.labelTr), h('div', {}, `${s.machine} ${s.horizonDays} gün çalışmazsa: ${s.capacityLostMinutes} dk kapasite kaybı; alternatifi olmayan iş: ${s.withoutAlternative}; güven: ${s.confidence === 'HIGH' ? 'YÜKSEK' : 'DÜŞÜK'}`), ...s.affectedWorkOrders.map((w) => h('div', { 'data-testid': 'ai-scenario-wo', style: 'font-size:12px;overflow-wrap:anywhere' }, `İE ${w.wo} (${w.productCode ?? '—'}): ${w.alternativeNote}`)), ...s.affectedOperations.map((o) => h('div', { 'data-testid': 'ai-scenario-op', style: 'font-size:12px;overflow-wrap:anywhere' }, `İE ${o.wo} op ${o.opNo}: ${o.alternatives.length ? `alternatif ${o.alternatives.map((a) => `${a.code} (${STATUS_TR[a.status] ?? a.status}, yük ${a.load === null ? '—' : percentLabel(a.load)})`).join(', ')}` : o.alternativeNote ?? 'alternatif yok'}`)));
    const scenSel = h('select', { 'data-testid': 'ai-scenario-machine' }, ...(twin?.machines ?? []).map((m) => h('option', { value: m.code }, m.code)));
    mount(container, h('div', { style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'ai-heading' }, 'KMI Zekâ'), h('p', { style: 'font-size:12px;color:#555' }, 'Kural tabanlıdır — dış yapay zekâ kullanılmaz. Cevaplar KMI kayıtlarından gelir ve kaynağını gösterir; öneriler hiçbir işlemi kendisi yapmaz.'), h('section', { 'data-testid': 'ai-ask', style: box }, h('h2', { style: 'font-size:17px;margin:0 0 6px' }, 'KMI’ye Sor'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, qIn, h('button', { type: 'button', 'data-testid': 'ai-ask-send', onClick: () => void ask(qIn.value) }, 'Sor')), h('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;margin-top:6px' }, ...COPILOT_EXAMPLES.map((q) => h('button', { type: 'button', 'data-testid': 'ai-example', style: 'font-size:11px', onClick: () => void ask(q) }, q))), state.error ? h('div', { 'data-testid': 'ai-error', style: 'padding:8px;border-radius:8px;background:#fee2e2;margin-top:6px' }, state.error) : null, state.answer ? h('div', { 'data-testid': 'ai-answer', 'data-intent': state.answer.intent, style: 'margin-top:8px;padding:8px;border-radius:8px;background:#f8fafc' }, ...state.answer.answer.map((l) => h('div', { 'data-testid': 'ai-answer-line', style: 'overflow-wrap:anywhere' }, l)), state.answer.records.length ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:4px' }, ...state.answer.records.map((r) => h('a', { href: r.route, 'data-testid': 'ai-answer-link' }, r.label))) : null, h('div', { 'data-testid': 'ai-answer-sources', style: 'font-size:11px;color:#64748b;margin-top:4px' }, `${state.answer.sources.length ? `Kaynak: ${state.answer.sources.join(', ')}` : 'Kaynak yok'} · kural tabanlı, dış yapay zekâ yok`)) : null), h('section', { 'data-testid': 'ai-nba', style: box }, h('h2', { style: 'font-size:17px;margin:0 0 6px' }, `Sıradaki adımlar (${nba.length})`), nbaError ? h('div', { style: 'color:#b91c1c' }, `Yüklenemedi: ${nbaError}`) : null, !nbaError && !nba.length ? h('div', { 'data-testid': 'ai-nba-empty', style: 'color:#64748b' }, 'Yetkinizdeki işlerde bekleyen adım yok.') : null, ...nba.map((n) => h('div', { 'data-testid': 'ai-nba-item', 'data-rule': n.rule, 'data-risk': n.risk, style: `border-left:4px solid ${RISK_COLOR[n.risk]};padding:4px 8px;margin:6px 0` }, h('div', {}, h('span', { style: `font-size:11px;font-weight:800;color:${RISK_COLOR[n.risk]}` }, RISK_TR[n.risk]), ' ', h('b', { style: 'overflow-wrap:anywhere' }, n.titleTr)), h('div', { style: 'font-size:12px' }, `Neden: ${n.reasonTr}`), h('div', { style: 'font-size:12px;color:#475569' }, `Beklenen etki: ${n.effectTr}`), h('a', { href: n.source.route, 'data-testid': 'ai-nba-open', style: 'font-size:12px' }, 'Kaydı aç →')))), pm ? h('section', { 'data-testid': 'ai-pm', style: box }, h('h2', { style: 'font-size:17px;margin:0 0 6px' }, `Süreç analizi (${pm.from} – ${pm.to})`), pmLog('İş emri akışı', 'ai-pm-wo', pm.workOrder), pmLog('Operasyon akışı', 'ai-pm-op', pm.operation), h('div', { style: 'font-size:11px;color:#64748b' }, pm.note)) : null, twin ? h('section', { 'data-testid': 'ai-twin', style: box }, h('h2', { style: 'font-size:17px;margin:0 0 6px' }, `Dijital ikiz — gerçek durum (${twin.from} – ${twin.to})`), h('div', { style: 'font-size:11px;color:#64748b' }, twin.note), h('div', { style: 'overflow-x:auto' }, h('table', { style: 'border-collapse:collapse;font-size:12px' }, h('tbody', {}, ...twin.machines.map((m) => h('tr', { 'data-testid': 'ai-twin-machine', 'data-code': m.code, 'data-confidence': m.confidence }, h('td', { style: 'padding:2px 6px;font-weight:700' }, m.code), h('td', { style: 'padding:2px 6px' }, STATUS_TR[m.status] ?? m.status), h('td', { style: 'padding:2px 6px' }, `${percentLabel(m.load)} ${LOAD_TR[m.loadState] ?? m.loadState}`), h('td', { style: 'padding:2px 6px' }, m.confidence === 'HIGH' ? 'güven yüksek' : `güven DÜŞÜK: ${m.confidenceReasons.join('; ')}`)))))), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px' }, h('span', { style: 'font-size:12px' }, 'Senaryo: makine çalışmazsa'), scenSel, h('button', { type: 'button', 'data-testid': 'ai-scenario-run', onClick: async () => { try {
            go({ scenario: await api.scenarioMachineDown(scenSel.value, 3) });
        }
        catch (e) {
            go({ error: errText(e) });
        } } }, 'Hesapla')), state.scenario ? scenarioView(state.scenario) : null) : null));
}
