// Shared helpers for the Yönetim Zekâsı tabs (forms, banners, guarded writes, load/error/setup-pending states). No business rules live here.
import { h, mount } from '../../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../../errorText.js';
import { setupPending, stateBox } from '../../ds.js';
import { kpiMeta } from '../../../../../packages/domain/src/managementKpiCatalog.js';
import { canOpen } from '../../access.js';
import { kpi as baseKpi } from '../../ds.js';
/** Ambient context of the tab being drawn (set by each tab at the start of its render): freshness text + the user's access, so every KPI tile can state source / definition / freshness / quality / authorized drill-down. */
let kctx = { access: { linked: false, roles: [], actions: [], economics: false, owner: false }, freshness: null, basis: {} };
export function setKpiContext(ctx, freshnessIso, basis = {}) {
    kctx = { access: ctx.access, freshness: freshnessIso ? `${fmtDateTime(freshnessIso)} (Europe/Istanbul)` : null, basis };
}
/** KPI tile + its provenance block. A tile without a catalog entry is still drawn plain; the test suite asserts every management tile HAS an entry. */
export function kpi(label, value, testid, opts = {}) {
    const base = baseKpi(label, value, testid);
    const meta = testid ? kpiMeta(testid, value, { freshness: kctx.freshness, canOpen: (p) => canOpen(p, kctx.access), serverBasis: kctx.basis[testid] }) : null;
    if (!meta)
        return base;
    const line = (k, v, tid) => h('div', { class: 'mut', style: 'font-size:11px;text-align:left', 'data-testid': `${testid}-${tid}` }, h('b', {}, `${k}: `), v);
    base.append(h('div', { class: 'kmeta', style: 'margin-top:6px;border-top:1px solid #1e293b;padding-top:4px', 'data-testid': `${testid}-meta` }, line('Kaynak', meta.source, 'source'), line('Tanım', meta.definition, 'def'), line('Güncellik', meta.freshness, 'fresh'), line('Veri kalitesi', meta.quality, 'quality'), opts.wrapperIsDrill ? null : meta.drill ? h('a', { href: meta.drill.href, style: 'font-size:12px', 'data-testid': `${testid}-drill` }, `Ayrıntı → ${meta.drill.label}`) : h('div', { class: 'mut', style: 'font-size:11px', 'data-testid': `${testid}-nodrill` }, meta.drillNote ?? '')));
    return base;
}
export const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)) : 'BİLİNMİYOR');
export const fmtDateTime = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : 'BİLİNMİYOR');
export const num = (n, unit = '', digits = 1) => (n === null || n === undefined || !Number.isFinite(n) ? 'BİLİNMİYOR' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(n)}${unit ? ` ${unit}` : ''}`);
export const pctFmt = (n) => num(n, '%');
export const bannerEl = (b, testid) => (b ? h('div', { class: `banner ${b.kind}`, role: b.kind === 'error' ? 'alert' : 'status', 'data-testid': testid }, b.text) : null);
export function field(label, input, hint) {
    return h('label', { style: 'display:flex;flex-direction:column;gap:4px;min-width:150px;flex:1' }, h('span', { class: 'mut' }, label), input, hint ? h('span', { class: 'mut', style: 'font-size:11px' }, hint) : null);
}
export const textIn = (testid, placeholder = '', type = 'text') => h('input', { type, placeholder, 'data-testid': testid, 'aria-label': placeholder || testid });
export const areaIn = (testid, placeholder = '') => h('textarea', { placeholder, rows: '2', 'data-testid': testid, 'aria-label': placeholder || testid, style: 'min-height:64px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:8px 10px;box-sizing:border-box;width:100%' });
export function selectIn(testid, options, value) {
    const s = h('select', { 'data-testid': testid, 'aria-label': testid }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    if (value !== undefined)
        s.value = value;
    return s;
}
export const formBox = (title, testid, ...kids) => h('details', { class: 'panel', 'data-testid': testid }, h('summary', { style: 'cursor:pointer;font-weight:800;color:#fff;min-height:44px;display:flex;align-items:center' }, title), h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:flex-end' }, ...kids));
/** Runs a write once (busy lock), then redraws with the outcome. A refused write shows the translated server reason and leaves the data untouched. */
export function guarded(panel, redraw) {
    let busy = false;
    return async (fn, okText) => {
        if (busy)
            return;
        busy = true;
        panel.querySelectorAll('button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            busy = false;
            await redraw({ kind: 'info', text: okText });
        }
        catch (e) {
            busy = false;
            await redraw({ kind: 'error', text: errorText(e) });
        }
    };
}
export const needText = (v, min, what) => (v.trim().length >= min ? null : `${what} en az ${min} karakter olmalı`);
/** Load → render with loading / setup-pending / error states. The loader's failure is never rendered as an empty "all good" page. */
export async function loadTab(panel, title, testid, loader, render) {
    mount(panel, h('div', { 'data-testid': `${testid}-loading` }, stateBox('loading', `${title} yükleniyor…`)));
    try {
        const data = await loader();
        mount(panel, render(data));
    }
    catch (e) {
        mount(panel, (isSetupPending(e) ? setupPending(title) : h('div', { 'data-testid': `${testid}-error` }, stateBox('error', `${title} yüklenemedi`, errorText(e)))));
    }
}
/** Same as a promise, but a failure becomes a value (so one broken source cannot blank a dashboard and is never shown as 0). */
export async function settle(p) {
    try {
        return { ok: true, value: await p };
    }
    catch (e) {
        return { ok: false, error: errorText(e), setup: isSetupPending(e) };
    }
}
