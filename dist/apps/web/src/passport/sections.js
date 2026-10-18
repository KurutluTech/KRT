// KMI-CARD-004 — shared passport SECTION renderer (kv + table + note) used by the object passport AND the passport hub topics.
// One renderer, one look: a topic page and an old tab show the same canonical rows the same way. `hrefOf` lets a host redirect related-object links (the hub opens its own passports).
import { h } from '../../../../packages/ui/src/h.js';
import { DS_CSS, pill } from '../ds.js';
import { isLink, isPill } from './model.js';
import { passportHref } from './registry.js';
export const SECTIONS_CSS = DS_CSS + `

.kd .pp-head{display:flex;flex-direction:column;gap:10px}
.kd .pp-kind{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9;font-weight:800}
.kd .pp-title{font-size:22px;font-weight:900;color:#fff;overflow-wrap:anywhere}
.kd .pp-sub{color:#94a3b8;overflow-wrap:anywhere}
.kd .pp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.kd .pp-kpi{border:1px solid #1e293b;border-radius:12px;padding:8px 10px;background:rgba(2,6,23,.45);min-width:0}
.kd .pp-kpi b{display:block;font-size:15px;color:#fff;overflow-wrap:anywhere}.kd .pp-kpi span{font-size:11px;color:#94a3b8}
.kd .pp-links{display:flex;gap:6px;flex-wrap:wrap}
.kd a.pp-chip{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:999px;background:#0f172a;border:1px solid #334155;color:#bae6fd;text-decoration:none;font-size:13px;font-weight:700}
.kd .pp-link{color:#7dd3fc}
.kd .pp-wrap{overflow-x:auto;max-width:100%}.kd table.pp-t{border-collapse:collapse;width:100%;font-size:13px}.kd .pp-t th{text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;border-bottom:1px solid #334155;white-space:nowrap}
.kd .pp-t td{padding:7px 8px;border-top:1px solid #1e293b;vertical-align:top;overflow-wrap:anywhere}
.kd .pp-kv{display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:6px 12px;font-size:14px}.kd .pp-kv dt{color:#94a3b8}.kd .pp-kv dd{margin:0;overflow-wrap:anywhere;color:#e2e8f0}
.kd .pp-note{margin-top:8px;font-size:12px;color:#fbbf24;line-height:1.5}
.kd .pp-filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.kd .pp-filters button{min-height:36px;font-size:13px}
.kd .pp-ev{border-top:1px solid #1e293b;padding:10px 0;display:grid;grid-template-columns:150px 1fr;gap:4px 12px}
.kd .pp-ev .t{font-variant-numeric:tabular-nums;color:#e2e8f0;font-weight:700;font-size:13px}.kd .pp-ev .a{font-weight:800;color:#fff}.kd .pp-ev .m{color:#94a3b8;font-size:12px}
.kd .pp-ev details{grid-column:2}.kd .pp-ev summary{cursor:pointer;color:#7dd3fc;font-size:12px}
.kd .pp-cols{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media(min-width:1000px){.kd .pp-cols.has-actions{grid-template-columns:minmax(0,1fr) 320px}}
@media(max-width:600px){.kd .pp-ev{grid-template-columns:1fr}.kd .pp-ev details{grid-column:1}.kd .pp-kv{grid-template-columns:1fr}}
.kd textarea{min-height:70px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:8px;box-sizing:border-box;width:100%}
.kd .pp-form{display:flex;flex-direction:column;gap:8px;margin-top:8px}`;
export function cellNode(c, hrefOf = passportHref) {
    if (c === null || c === undefined || c === '')
        return '—';
    if (isLink(c))
        return h('a', { class: 'pp-link', href: hrefOf(c.kind, c.id), 'data-testid': 'pp-rel', 'data-kind': c.kind, 'data-id': c.id }, c.label);
    if (isPill(c))
        return pill(c.pill, c.tone);
    return String(c);
}
export function sectionNode(s, hrefOf = passportHref) {
    return h('div', { class: 'panel', 'data-testid': 'pp-section' }, h('h2', {}, s.title), s.kv ? h('dl', { class: 'pp-kv' }, ...s.kv.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, cellNode(v, hrefOf))])) : null, s.table ? (s.table.rows.length ? h('div', { class: 'pp-wrap' }, h('table', { class: 'pp-t' }, h('thead', {}, h('tr', {}, ...s.table.columns.map((c) => h('th', {}, c)))), h('tbody', {}, ...s.table.rows.map((r) => h('tr', { 'data-testid': 'pp-row' }, ...r.map((c) => h('td', {}, cellNode(c, hrefOf)))))))) : h('div', { class: 'empty', 'data-testid': 'pp-empty' }, s.table.empty)) : null, s.note ? h('div', { class: 'pp-note', 'data-testid': 'pp-note' }, s.note) : null);
}
