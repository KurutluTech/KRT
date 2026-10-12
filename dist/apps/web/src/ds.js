// KMI common design system (dark premium CNC look) for operational screens. Scoped under `.kd` so it never leaks into legacy screens.
// Colours mirror theme.ts tokens; intent buttons: primary (blue), ok (green), warn (amber), danger (red), ghost (slate).
import { h } from '../../../packages/ui/src/h.js';
export const DS_CSS = `.kd{display:flex;flex-direction:column;gap:14px;color:#e2e8f0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.kd h1{font-size:20px;margin:0;color:#fff}.kd h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:0 0 8px}
.kd .head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.kd .grow{flex:1;min-width:140px}
.kd .panel{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;min-width:0}
.kd .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.kd .kpi{border:1px solid #1e293b;border-radius:12px;padding:10px;background:rgba(2,6,23,.45)}
.kd .kpi .n{font-size:24px;font-weight:800;color:#fff}.kd .kpi .l{font-size:11px;color:#94a3b8}
.kd .pill{display:inline-block;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;background:#1e293b;color:#e6edf7;white-space:nowrap}
.kd .pill.ok{background:#14532d;color:#bbf7d0}.kd .pill.warn{background:#78350f;color:#fde68a}.kd .pill.bad{background:#7f1d1d;color:#fecaca}.kd .pill.info{background:#1e3a8a;color:#dbeafe}.kd .pill.gold{background:#5b4510;color:#f5d98a}
.kd .item{border-top:1px solid #1e293b;padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.kd .item:first-of-type{border-top:0}
.kd .mut{color:#94a3b8;font-size:12px}.kd .empty{color:#94a3b8;font-size:13px}
.kd .avatar{width:36px;height:36px;border-radius:50%;background:#1e293b;border:1px solid #334155;display:flex;align-items:center;justify-content:center;font-weight:800;color:#67e8f9;flex:none}
.kd input,.kd select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;min-width:0}
.kd button,.kd a.btn{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.kd .primary{background:#1d4ed8;color:#fff}.kd .okb{background:#15803d;color:#fff}.kd .warnb{background:#b45309;color:#fff}.kd .danger{background:#b91c1c;color:#fff}.kd .ghost{background:#1e293b;color:#e2e8f0}
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
