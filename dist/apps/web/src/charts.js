// KMI-001 final — data-visualisation kit. Pure renderers: they draw ONLY what the caller passes from a canonical source and never invent a point.
// Every chart has: title, unit, period, reference/target (when it exists), data freshness, and a text equivalent (aria-label + visible summary line).
// No data → an honest "VERİ GEREKLİ" frame naming the source (and an action link when the caller supports one) — never an empty decorative gauge.
import { h } from '../../../packages/ui/src/h.js';
import { SEMANTIC } from '../../../packages/domain/src/semanticColors.js';
const NUM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
/** theme-aware colour of a meaning: the --kmi-* token (so the light theme re-colours it) with the dark constant as the fallback */
const tok = (m, part = 'fg') => `var(--kmi-${m}${part === 'soft' ? '-soft' : ''},${SEMANTIC[m][part]})`;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const frame = (m, kind, body, summary, tid) => h('figure', { class: `ch chart-k-${kind}`, 'data-testid': tid, 'data-state': 'known', 'data-stale': String(!!m.stale) }, h('figcaption', { class: 'ch-h' }, h('b', {}, m.title), h('span', { class: 'ch-m' }, `${m.unit ? m.unit + ' · ' : ''}${m.period}`), m.stale ? h('span', { class: 'ch-stale', 'data-testid': 'chart-stale' }, '⏱ BAYAT VERİ') : null), ...body, h('div', { class: 'ch-sum', 'data-testid': 'chart-summary' }, summary), h('div', { class: 'ch-f' }, `Kaynak: ${m.source}${m.reference ? ` · Referans: ${m.reference}` : ''}`));
/** no data → say so, name the source, optionally offer the fix */
export function chartUnknown(m, tid = 'chart-unknown') {
    return h('figure', { class: 'ch ch-unknown', 'data-testid': tid, 'data-state': 'unknown' }, h('figcaption', { class: 'ch-h' }, h('b', {}, m.title), h('span', { class: 'ch-need' }, 'VERİ GEREKLİ')), h('div', { class: 'ch-sum' }, `${m.why ?? 'Kaynak yanıt vermedi veya kayıt yok.'} Kaynak: ${m.source}.`, m.action ? h('a', { href: m.action.href }, ` ${m.action.label} →`) : null));
}
/** target vs actual — bullet bar with a target tick. actual unknown → unknown frame. */
export function bulletBar(m, v) {
    if (!finite(v.actual))
        return chartUnknown({ title: m.title, source: m.source });
    const max = Math.max(v.actual, v.target ?? 0, 1) * 1.08;
    const pct = (x) => Math.min(100, Math.max(0, (x / max) * 100));
    const tone = v.verdict ?? (finite(v.target) ? (v.actual >= v.target ? 'ok' : 'warn') : 'info');
    const body = [h('div', { class: 'ch-bullet', role: 'img', 'aria-label': `${m.title}: gerçekleşen ${NUM.format(v.actual)} ${m.unit}${finite(v.target) ? `, hedef ${NUM.format(v.target)}` : ', hedef tanımlı değil'}` }, h('i', { class: 'ch-fill', style: `width:${pct(v.actual)}%;background:${tok(tone)}` }), finite(v.target) ? h('i', { class: 'ch-tick', style: `left:${pct(v.target)}%` }) : null)];
    const gap = finite(v.target) ? v.actual - v.target : null;
    return frame(m, 'bullet', body, `${NUM.format(v.actual)} ${m.unit}${finite(v.target) ? ` / hedef ${NUM.format(v.target)} (${gap >= 0 ? '+' : ''}${NUM.format(gap)}) · ${SEMANTIC[tone].label}` : ' · hedef tanımlı değil'}`, 'chart-bullet');
}
/** sparkline — only real points; fewer than 2 points is not a trend. */
export function sparkline(m, v) {
    const pts = v.points.filter((p) => finite(p.value));
    if (pts.length < 2)
        return chartUnknown({ title: m.title, source: m.source, why: pts.length === 1 ? 'Eğilim için en az iki dönem gerekir.' : 'Dönem verisi yok.' });
    const W = 220, H = 56, P = 4;
    const lo = Math.min(...pts.map((p) => p.value)), hi = Math.max(...pts.map((p) => p.value));
    const span = hi - lo || 1;
    const xy = pts.map((p, i) => [P + (i * (W - 2 * P)) / (pts.length - 1), H - P - ((p.value - lo) / span) * (H - 2 * P)]);
    const last = pts[pts.length - 1], first = pts[0];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'ch-spark');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${m.title}: ${pts.map((p) => `${p.label} ${NUM.format(p.value)}`).join(', ')} ${m.unit}`);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', xy.map((q) => q.join(',')).join(' '));
    line.setAttribute('fill', 'none');
    line.style.setProperty('stroke', tok('info'));
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linejoin', 'round');
    svg.append(line);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(xy[xy.length - 1][0]));
    dot.setAttribute('cy', String(xy[xy.length - 1][1]));
    dot.setAttribute('r', '3.5');
    dot.style.setProperty('fill', tok('info'));
    svg.append(dot);
    return frame(m, 'spark', [svg], `${first.label} ${NUM.format(first.value)} → ${last.label} ${NUM.format(last.value)} ${m.unit} · en düşük ${NUM.format(lo)}, en yüksek ${NUM.format(hi)}`, 'chart-spark');
}
/** composition bar — parts are real counts; a zero part is shown in the legend, not hidden. */
export function distributionBar(m, parts) {
    const total = parts.reduce((s, p) => s + (finite(p.value) ? p.value : 0), 0);
    if (!(total > 0))
        return chartUnknown({ title: m.title, source: m.source, why: 'Dağılım için kayıt yok.' });
    const body = [h('div', { class: 'ch-distbar', role: 'img', 'aria-label': `${m.title}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}` }, ...parts.filter((p) => p.value > 0).map((p) => h('i', { style: `flex:${p.value};background:${p.color ?? tok(p.meaning)}`, title: `${p.label}: ${p.value}` }))),
        h('ul', { class: 'ch-leg' }, ...parts.map((p) => h('li', {}, h('i', { style: `background:${p.color ?? tok(p.meaning)}` }), `${p.icon ?? SEMANTIC[p.meaning].icon} ${p.label} ${p.value}`)))];
    return frame(m, 'dist', body, `Toplam ${NUM.format(total)} ${m.unit} · ${parts.filter((p) => p.value > 0).map((p) => `${p.label} %${NUM.format((p.value / total) * 100)}`).join(' · ')}`, 'chart-dist');
}
/** shift comparison — grouped columns (good / scrap) per shift; only real shifts, ≥2 groups, values printed on the bars (not colour alone). */
export function shiftColumns(m, v) {
    const g = v.groups.filter((x) => finite(x.good) && finite(x.scrap));
    if (g.length < 2)
        return chartUnknown({ title: m.title, source: m.source, why: 'Karşılaştırma için en az iki vardiya kaydı gerekir.' });
    const max = Math.max(1, ...g.map((x) => Math.max(x.good, x.scrap)));
    const body = [h('div', { class: 'ch-cols', role: 'img', 'aria-label': `${m.title}: ${g.map((x) => `${x.label} sağlam ${NUM.format(x.good)}, hurda ${NUM.format(x.scrap)}`).join('; ')}` }, ...g.map((x) => h('div', { class: 'ch-colg', 'data-testid': 'chart-col-group' }, h('div', { class: 'ch-colp' }, h('div', { class: 'ch-col' }, h('span', { class: 'ch-cv' }, NUM.format(x.good)), h('i', { style: `height:${Math.max(3, (x.good / max) * 100)}%;background:${tok('ok')}` })), h('div', { class: 'ch-col' }, h('span', { class: 'ch-cv' }, NUM.format(x.scrap)), h('i', { style: `height:${x.scrap > 0 ? Math.max(3, (x.scrap / max) * 100) : 1}%;background:${tok('bad')}` }))), h('div', { class: 'ch-cl' }, x.label)))),
        h('ul', { class: 'ch-leg' }, h('li', {}, h('i', { style: `background:${tok('ok')}` }), 'Sağlam adet'), h('li', {}, h('i', { style: `background:${tok('bad')}` }), 'Hurda'))];
    const last = g[g.length - 1], prev = g[g.length - 2];
    const dg = last.good - prev.good;
    return frame(m, 'cols', body, `${prev.label} → ${last.label}: sağlam ${dg >= 0 ? '+' : ''}${NUM.format(dg)} · hurda ${NUM.format(prev.scrap)} → ${NUM.format(last.scrap)}`, 'chart-cols');
}
/** the one trend badge: arrow = math direction; colour + word = business impact. */
export function trendBadge(v) {
    const meaning = v.tone === 'GREEN' ? 'ok' : v.tone === 'RED' ? 'bad' : v.tone === 'BLUE' ? 'info' : 'unknown';
    const st = SEMANTIC[meaning];
    return h('span', { class: `tb tb-${v.verdict.toLowerCase()}`, 'data-testid': 'trend-badge', 'data-verdict': v.verdict, 'data-arrow': v.arrow ?? 'none', style: `color:${tok(meaning)};border-color:${tok(meaning)};background:${tok(meaning, 'soft')}`, title: v.text, 'aria-label': v.text }, v.arrow ? h('b', { 'aria-hidden': 'true' }, v.arrow) : null, v.comparable && v.percent !== null && v.arrow !== '■' ? `%${NUM.format(Math.abs(v.percent))} ` : '', v.verdictText);
}
export const CHART_CSS = `
.ch{margin:0;display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:14px;background:var(--kmi-panel);border:1px solid var(--kmi-line);min-width:0}
.ch-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.ch-h b{font-size:15px;color:var(--kmi-text)}.ch-m{font-size:12px;color:var(--kmi-mut)}
.ch-stale{font-size:12px;font-weight:700;color:var(--kmi-stale);border:1px dashed var(--kmi-stale);border-radius:999px;padding:1px 8px}.ch-need{font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--kmi-unknown)}
.ch-sum{font-size:13px;color:var(--kmi-text2)}.ch-f{font-size:11px;color:var(--kmi-mut)}.ch-unknown{border-style:dashed}.ch-unknown .ch-sum a{font-weight:700}
.ch-bullet{position:relative;height:14px;border-radius:99px;background:rgba(148,163,184,.22);overflow:visible}.ch-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px}.ch-tick{position:absolute;top:-4px;bottom:-4px;width:3px;margin-left:-1px;background:var(--kmi-text);border-radius:2px}
.ch-spark{width:100%;max-width:320px;height:56px}
.ch-distbar{display:flex;height:14px;border-radius:99px;overflow:hidden;gap:2px;background:rgba(148,163,184,.18)}.ch-distbar i{display:block;min-width:4px}
.ch-leg{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--kmi-text2)}.ch-leg li{display:inline-flex;align-items:center;gap:6px}.ch-leg i{width:10px;height:10px;border-radius:3px;flex:none}
.tb{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;border:1px solid;font-size:12px;font-weight:800;letter-spacing:.03em;white-space:nowrap}.tb b{font-size:11px}
.ch-cols{display:flex;gap:14px;align-items:flex-end;height:104px;padding-top:4px}.ch-colg{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;height:100%}.ch-colp{flex:1;display:flex;gap:6px;align-items:flex-end;min-height:0}.ch-col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;gap:2px;min-width:0}.ch-col i{display:block;border-radius:4px 4px 0 0}.ch-cv{font-size:11px;font-weight:700;text-align:center;color:var(--kmi-text2);font-variant-numeric:tabular-nums}.ch-cl{font-size:11px;text-align:center;color:var(--kmi-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (prefers-reduced-motion:no-preference){.ch-fill{transition:width .4s ease}}
`;
