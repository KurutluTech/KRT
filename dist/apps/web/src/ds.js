// KMI common design system (dark premium CNC look) for operational screens. Scoped under `.kd` so it never leaks into legacy screens.
// Colours mirror theme.ts tokens; intent buttons: primary (blue), ok (green), warn (amber), danger (red), ghost (slate).
import { h } from '../../../packages/ui/src/h.js';
export const DS_CSS = `.kd{display:flex;flex-direction:column;gap:14px;color:#e2e8f0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.kd h1{font-size:20px;margin:0;color:#fff}.kd h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:0 0 8px}
.kd .head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.kd .grow{flex:1;min-width:140px}
.kd .panel{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;min-width:0}
.kd .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:8px}.kd .kpi{min-width:0;overflow-wrap:anywhere;border:1px solid #1e293b;border-radius:12px;padding:10px;background:rgba(2,6,23,.45)}
.kd .kpi .n{font-size:24px;font-weight:800;color:#fff}.kd .kpi .l{font-size:11px;color:#94a3b8}
.kd .pill{display:inline-block;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;background:#1e293b;color:#e6edf7;white-space:nowrap}
.kd .pill.ok{background:#14532d;color:#bbf7d0}.kd .pill.warn{background:#78350f;color:#fde68a}.kd .pill.bad{background:#7f1d1d;color:#fecaca}.kd .pill.info{background:#1e3a8a;color:#dbeafe}.kd .pill.gold{background:#5b4510;color:#f5d98a}
.kd .pill.unknown{background:#334155;color:#e2e8f0;border:1px dashed #94a3b8}.kd .pill.ai{background:#4c1d95;color:#ede9fe}
/* colour is never the only signal: every semantic kind also carries a glyph (CSS-only, so the readable text is unchanged) */
.kd .pill.ok::before{content:'✓ '}.kd .pill.warn::before{content:'! '}.kd .pill.bad::before{content:'✕ '}.kd .pill.info::before{content:'i '}.kd .pill.unknown::before{content:'? '}.kd .pill.ai::before{content:'◇ '}
.kd .state{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;border:1px solid #1e293b;background:rgba(2,6,23,.45);font-size:13px;color:#cbd5e1}
.kd .state b{display:block;color:#fff;margin-bottom:2px}.kd .state.loading{border-style:dashed}.kd .state.error{border-color:#b91c1c;background:rgba(127,29,29,.25)}
.kd .state.unknown{border-style:dashed;border-color:#94a3b8}.kd .state.ai{border-color:#7c3aed;background:rgba(76,29,149,.2)}
.kd .stamp{font-size:11px;color:#94a3b8}
.kd .item{border-top:1px solid #1e293b;padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.kd .item:first-of-type{border-top:0}
.kd .mut{color:#94a3b8;font-size:12px}.kd .empty{color:#94a3b8;font-size:13px}
.kd .avatar{width:36px;height:36px;border-radius:50%;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;font-weight:800;color:#67e8f9;flex:none}
.kd input,.kd select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;min-width:0}
.kd button,.kd a.btn{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:6px 14px;white-space:normal;text-align:center;line-height:1.25;max-width:100%;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
/* KMI semantic action tokens (KMI-004): ONE place for what an action colour means. ok = approve / release (green) · no = reject / destructive (red) · go = primary work action, go to record (turquoise/blue)
   · info = inspect, detail, filter (neutral dark) · hold = controlled wait / HOLD (amber) · off = not possible (muted). Colour never carries the meaning alone: labels and icons say it too. */
.kd{--act-ok:#15803d;--act-no:#b91c1c;--act-no-soft:#7f1d1d;--act-go:#0e7490;--act-primary:#1d4ed8;--act-hold:#b45309;--act-info:#1e293b;--act-off:#273244;--act-off-fg:#8b99ad}
.kd .primary{background:var(--act-primary);color:#fff}.kd .go{background:var(--act-go);color:#fff}.kd .okb{background:var(--act-ok);color:#fff}.kd .warnb{background:var(--act-hold);color:#fff}.kd .danger{background:var(--act-no);color:#fff}.kd .ghost{background:var(--act-info);color:#e2e8f0}
.kd button:disabled,.kd button[disabled]{background:var(--act-off);color:var(--act-off-fg);cursor:not-allowed;box-shadow:none}
.kd button:focus-visible,.kd a:focus-visible,.kd input:focus-visible,.kd select:focus-visible,.kd textarea:focus-visible,.kd summary:focus-visible{outline:3px solid #67e8f9;outline-offset:2px}
.kd .banner{padding:10px 14px;border-radius:10px;font-weight:700}.kd .banner.error{background:#7f1d1d;color:#fecaca}.kd .banner.info{background:#14532d;color:#bbf7d0}
.kd .tabs{display:flex;gap:6px;flex-wrap:wrap}.kd .tabs button{background:#0f172a;border:1px solid #334155;color:#cbd5e1}.kd .tabs button.on{background:#1d4ed8;border-color:#3b82f6;color:#fff}
.kd .bar{height:8px;border-radius:99px;background:#1e293b;overflow:hidden}.kd .bar>i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#6366f1)}`;
export const pill = (text, kind = '', testid) => h('span', { class: `pill ${kind}`, ...(testid ? { 'data-testid': testid } : {}) }, text);
export const kpi = (label, value, testid) => h('div', { class: 'kpi', ...(testid ? { 'data-testid': testid } : {}) }, h('div', { class: 'n' }, value), h('div', { class: 'l' }, label));
export const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toLocaleUpperCase('tr-TR')).join('');
export const ROLE_TR = { ADMIN: 'Yönetici', MANAGEMENT: 'Yönetim', OPERATOR: 'Operatör', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satınalma', ACCOUNTING: 'Muhasebe', SHIPPING: 'Sevkiyat', CAM: 'CAM' };
export const DEPT_TR = { URETIM: 'Üretim', OFIS: 'Ofis', KALITE: 'Kalite', CAM: 'CAM / Programlama', BAKIM: 'Bakım', TESVIYE: 'Tesviye', ASCI: 'Mutfak' };
export const TIER_TR = { BASE: 'Temel', TIER_8: 'Gelişmiş (8+ yetkinlik)', TIER_10: 'Usta (10+ yetkinlik)' };
/** Calm placeholder for a section whose database part is not installed yet. Never an error, never a blank page. */
export const setupPending = (title, detail = 'Bu bölümün veritabanı kurulumu henüz yapılmadı. Mevcut kayıtlarınız etkilenmedi; kurulum tamamlanınca bu ekran otomatik açılır.') => h('div', { class: 'panel', 'data-testid': 'setup-pending', style: 'border-left:4px solid #d97706' }, h('h2', {}, 'Kurulum bekleniyor'), h('div', { style: 'font-size:16px;font-weight:700;color:#fff' }, title), h('div', { class: 'mut', style: 'margin-top:6px' }, detail));
export const stateBox = (kind, title, detail, testid) => h('div', { class: `state ${kind}`, role: kind === 'error' ? 'alert' : 'status', ...(testid ? { 'data-testid': testid } : {}) }, h('div', {}, h('b', {}, title), detail ? h('span', {}, detail) : null));
export const provenance = (source, asOf, unit) => h('div', { class: 'stamp', 'data-testid': 'provenance' }, `Kaynak: ${source}`, unit ? ` · Birim: ${unit}` : '', ` · ${asOf ? `Veri anı: ${asOf}` : 'Veri anı: BİLİNMİYOR'}`);
const TONE_PILL = { GREEN: 'ok', RED: 'bad', AMBER: 'warn', BLUE: 'info', GREY: 'unknown' };
const CHANGE_GLYPH = { UP: '▲', DOWN: '▼', FLAT: '■', UNKNOWN: '?' };
export const METRIC_CSS = `.kd .mtile{border:1px solid #1e293b;border-radius:14px;padding:14px;background:linear-gradient(180deg,#111c2e,#0f172a);min-width:0}.kd .mtile .mv{font-size:30px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums}.kd .mtile .mu{font-size:13px;color:#94a3b8;margin-left:4px}
.kd .mtile .mc{font-size:13px;font-weight:800;margin-top:2px}.kd .mtile .mc.GREEN{color:#86efac}.kd .mtile .mc.RED{color:#fca5a5}.kd .mtile .mc.BLUE{color:#93c5fd}.kd .mtile .mc.GREY{color:#94a3b8}
.kd .mtile .rec{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(30,58,138,.35);border:1px solid #1d4ed8;font-size:13px}`;
export function metricTile(v) {
    const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
    const sign = (n) => `${n > 0 ? '+' : ''}${nf.format(n)}`;
    return h('div', { class: 'mtile', 'data-testid': 'metric-tile', 'data-metric': v.id, 'data-state': v.state, 'data-tone': v.tone }, h('div', { class: 'l mut' }, v.label), h('div', {}, h('span', { class: 'mv', 'data-testid': 'metric-value' }, v.value === null ? '—' : nf.format(v.value)), v.value === null ? null : h('span', { class: 'mu' }, v.unit), ' ', pill(v.statusText, TONE_PILL[v.tone], 'metric-status')), v.baselineLabel !== null || v.change.direction !== 'UNKNOWN'
        ? h('div', { class: `mc ${v.changeTone}`, 'data-testid': 'metric-change', 'data-direction': v.change.direction }, `${CHANGE_GLYPH[v.change.direction]} ${v.change.amount === null ? 'Karşılaştırma yok' : `${sign(v.change.amount)} ${v.unit}${v.change.percent === null ? '' : ` (${sign(v.change.percent)}%)`}`}${v.baselineLabel ? ` · ${v.baselineLabel}` : ''}`) : null, v.target !== null ? h('div', { class: 'mut' }, `Hedef: ${nf.format(v.target)} ${v.unit}`) : null, v.impact ? h('div', { class: 'mut', 'data-testid': 'metric-impact' }, `Etki: ${v.impact}`) : null, v.recommendation ? h('div', { class: 'rec', 'data-testid': 'metric-recommendation' }, h('b', {}, v.recommendation.text), h('div', { class: 'mut' }, `Gerekçe: ${v.recommendation.because}`)) : null, h('div', { class: 'stamp', 'data-testid': 'metric-provenance' }, `Kaynak: ${v.source} · ${v.freshness.text}`), v.evidence ? (v.evidence.href ? h('a', { href: v.evidence.href, class: 'mut', 'data-testid': 'metric-evidence' }, `Kanıt: ${v.evidence.description}`) : h('span', { class: 'mut', 'data-testid': 'metric-evidence' }, `Kanıt: ${v.evidence.description}`)) : null);
}
