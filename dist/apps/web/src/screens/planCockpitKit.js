// KMI-012 — shared bits of the Planlama Kokpiti and the Shift Planner: styles, helpers and the ONE loader (so both screens read the same canonical models for the same window).
import { h } from '../../../../packages/ui/src/h.js';
import { addDays } from '../../../../packages/domain/src/planCockpit.js';
import { errorText } from '../errorText.js';
export const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
export const SHIFT_LABEL = { TeamK1: '1. Vardiya', TeamK2: '2. Vardiya' };
export const PROD_SHIFTS = ['TeamK1', 'TeamK2'];
export const RISK_GLYPH = { HIGH: '▲', MEDIUM: '◆', UNKNOWN: '?', LOW: '' };
export const RISK_NAME = { HIGH: 'Yüksek risk', MEDIUM: 'Orta risk', UNKNOWN: 'Veri eksik', LOW: 'Risk görünmüyor' };
export const shortId = (id) => id.slice(0, 8);
export const dayLabel = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
export const pct = (v) => (v === null ? 'KAPASİTE YOK' : `%${Math.round(v * 100)}`);
export const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) : 'BİLİNMİYOR');
export const rangeDates = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));
/** loads the same four canonical read models; an unreadable part is NAMED (never silently empty): operators need the planner authority, decisions are optional. */
export async function loadAll(api, from, to, withDecisions = false) {
    const errors = [];
    const [blocks, slots, ops, decisions] = await Promise.all([
        api.blocks(from, to).catch((e) => { errors.push(`İş emri blokları: ${errorText(e)}`); return []; }),
        api.slots(from, to).catch((e) => { errors.push(`Kapasite: ${errorText(e)}`); return []; }),
        api.operators(from, to).then((r) => ({ rows: r, note: null })).catch((e) => ({ rows: null, note: errorText(e) })),
        withDecisions ? api.decisions(10).catch(() => null) : Promise.resolve(null),
    ]);
    return { blocks, slots, ops: ops.rows, opsNote: ops.note, decisions, loadedAt: new Date().toISOString(), errors, from, to };
}
export const PLAN_CSS = `
.pk{max-width:1500px;margin:0 auto;padding:0 4px 28px;color:inherit;min-width:0;width:100%;box-sizing:border-box}
.pk-h1{margin:6px 0 0;font-size:28px;letter-spacing:.01em}.pk-sub{margin:2px 0 14px;color:var(--kmi-mut,#94a3b8);font-size:15px}
.pk-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.pk-btn{min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.12);color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.pk-btn.sec{border-color:var(--kmi-line,#1e2d4a);background:none}.pk-btn:disabled{opacity:.5;cursor:not-allowed}.pk-btn:focus-visible,.pk-blk:focus-visible,.pk-kpi:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.pk-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:14px}
@media (max-width:1000px){.pk-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (max-width:520px){.pk-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}
.pk-kpi{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;min-width:0;text-align:left;color:inherit;font:inherit;text-decoration:none;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}
.pk-kpi:hover{border-color:var(--kmi-focus,#38bdf8)}.pk-kpi b{font-size:28px;line-height:1.1}.pk-kpi span{font-size:13px;color:var(--kmi-mut,#94a3b8)}
.pk-kpi.bad b{color:var(--kmi-bad,#f87171)}.pk-kpi.warn b{color:var(--kmi-warn,#fbbf24)}.pk-kpi.unk b{color:var(--kmi-mut,#94a3b8)}
.pk-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}@media (max-width:900px){.pk-grid2{grid-template-columns:minmax(0,1fr)}}
.pk-panel{padding:12px 14px;margin-bottom:14px;border-radius:14px;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a);min-width:0}
.pk-panel h2{margin:0 0 4px;font-size:18px}.pk-src{font-size:12px;color:var(--kmi-mut,#94a3b8);margin:0 0 8px}
.pk-row{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:9px 0;border-top:1px solid var(--kmi-line,#1e2d4a)}.pk-row:first-of-type{border-top:0}.pk-row .grow{flex:1 1 220px;min-width:0}
.pk-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid currentColor;white-space:nowrap}
.pk-pill.HIGH{color:var(--kmi-bad,#f87171)}.pk-pill.MEDIUM{color:var(--kmi-warn,#fbbf24)}.pk-pill.UNKNOWN{color:var(--kmi-mut,#94a3b8)}.pk-pill.LOW{color:var(--kmi-ok,#4ade80)}
.pk-bar{position:relative;height:14px;border-radius:7px;background:#0b1220;border:1px solid var(--kmi-line,#1e2d4a);overflow:hidden;min-width:90px;flex:1 1 120px}
.pk-bar i{position:absolute;inset:0 auto 0 0;background:var(--kmi-focus,#38bdf8)}.pk-bar.over i{background:var(--kmi-bad,#f87171)}.pk-bar.full i{background:var(--kmi-warn,#fbbf24)}
.pk-bar.none{background:repeating-linear-gradient(45deg,#0b1220,#0b1220 6px,#18253f 6px,#18253f 12px)}
.pk-msg{padding:10px 12px;border-radius:10px;margin:6px 0 10px;font-size:14px}.pk-msg[data-kind=ok]{background:rgba(34,197,94,.16)}.pk-msg[data-kind=error]{background:rgba(239,68,68,.18)}.pk-msg[data-kind=info]{background:rgba(56,189,248,.14)}
.pk-note{font-size:13px;color:var(--kmi-mut,#94a3b8)}.pk-unk{color:var(--kmi-mut,#94a3b8);font-style:italic}
.pk-tbl{width:100%;border-collapse:collapse;font-size:14px}.pk-tbl th{text-align:left;font-size:12px;color:var(--kmi-mut,#94a3b8);padding:6px 8px;border-bottom:1px solid var(--kmi-line,#1e2d4a)}.pk-tbl td{padding:7px 8px;border-top:1px solid var(--kmi-line,#1e2d4a);vertical-align:top}
.pk-scroll{overflow-x:auto;max-width:100%;min-width:0}
.pk-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:8px 0}
.pk-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--kmi-mut,#94a3b8);min-width:0}
.pk-form input,.pk-form select,.pk-bar-in input,.pk-bar-in select,.pk-fl input,.pk-fl select{min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit;min-width:0}
.pk-fl{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:12px}.pk-fl label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--kmi-mut,#94a3b8)}
.pk-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--kmi-mut,#94a3b8);margin:4px 0 10px}.pk-legend span{display:inline-flex;align-items:center;gap:5px}.pk-sw{width:14px;height:14px;border-radius:4px;display:inline-block}
`;
