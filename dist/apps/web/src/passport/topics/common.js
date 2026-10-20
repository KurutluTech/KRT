// KMI-CARD-004 — shared plumbing of the passport hub topics. A topic is a thin view over a CANONICAL reader (table through RLS, existing RPC, or an
// existing object-passport tab). Nothing here stores or calculates a second copy of a fact: missing data stays "BİLİNMİYOR", never 0.
import { h } from '../../../../../packages/ui/src/h.js';
import { sectionNode } from '../sections.js';
import { errorText, isSetupPending } from '../../errorText.js';
import { renderObjectPassportScreen } from '../../screens/ObjectPassportScreen.js';
import { renderProductWorkspaceScreen } from '../../screens/ProductWorkspaceScreen.js';
export const STORE_KINDS = { MACHINE: 'MACHINE', PRODUCT: 'PRODUCT', PERSONNEL: 'PERSONNEL', CUSTOMER: 'CUSTOMER', SUPPLIER: 'SUPPLIER', TOOL: 'TOOL' };
export function makeIo(client, session) {
    return {
        sel: (table, columns, filters = {}, order, limit = 200) => client.select(table, { columns, filters, order, limit }, session),
        rpc: (fn, args) => client.rpc(fn, args, session),
    };
}
export const inList = (ids) => `in.(${ids.join(',')})`;
export const uniq = (a) => [...new Set(a.filter((x) => !!x))];
export const isDenied = (e) => {
    const x = e;
    return x?.status === 401 || x?.status === 403 || x?.code === '42501' || /FORBIDDEN|NOT_AUTHORIZED|permission denied|YETKI/i.test(x?.message ?? '');
};
export const NA = 'BİLİNMİYOR';
export const dt = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }) : NA);
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : NA);
export const nf = (n, unit = '') => (n === null || n === undefined || Number.isNaN(n) ? NA : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)}${unit ? ` ${unit}` : ''}`);
export const link = (kind, id, label) => (id ? { kind, id, label: label || id.slice(0, 8) } : null);
export const pill = (text, tone = '') => ({ pill: text, tone });
export const orNA = (v) => (v === null || v === undefined || v === '' ? NA : v);
export const WO_TR = { PLANNED: 'Plana alındı', MACHINE_ASSIGNED: 'Makine atandı', PRODUCTION_DONE: 'Üretim bitti · onay bekliyor', IN_PROGRESS: 'Üretimde', FIRST_PIECE_PENDING: 'İlk parça bekliyor', FIRST_PIECE_APPROVED: 'İlk parça onaylı', COMPLETED: 'Tamamlandı', ON_HOLD: 'Bekletmede', CANCELLED: 'İptal', CLOSED: 'Kapandı', DRAFT: 'Taslak' };
export const MACHINE_TR = { UP: 'Kullanıma hazır', DOWN: 'Arıza / DOWN', MAINTENANCE: 'Bakımda', HOLD: 'Bekletmede' };
export const MACHINE_TONE = { UP: 'ok', DOWN: 'bad', MAINTENANCE: 'info', HOLD: 'warn' };
export const TASK_TR = { OPEN: 'Açık', IN_PROGRESS: 'Sürüyor', DONE: 'Tamamlandı', COMPLETED: 'Tamamlandı', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', CANCELLED: 'İptal', PENDING_APPROVAL: 'Onay bekliyor', WAITING_APPROVAL: 'Onay bekliyor' };
/** Render canonical sections into a topic host. A refused read is stated plainly (never an error, never empty-looking-OK); a missing database part is BLOCKED text. */
export async function renderSections(ctx, host, load) {
    try {
        const sections = await load();
        host.replaceChildren(...sections.map((s) => sectionNode(s, ctx.hrefOf)));
    }
    catch (e) {
        if (isDenied(e))
            host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'ps-denied' }, 'Bu bölümü görme yetkiniz yok (sunucu reddetti).'));
        else if (isSetupPending(e))
            host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'ps-pending' }, errorText(e)));
        else
            throw e;
    }
}
/** Topic whose page is a list of canonical sections. */
export const sectionsTopic = (ctx, spec, load) => ({ ...spec, render: (host) => renderSections(ctx, host, load) });
/** Topic that embeds ONE tab of the existing object passport (same canonical reader, same renderer — no copy). */
export const tabTopic = (ctx, spec, tab) => ({
    ...spec,
    render: async (host) => {
        await renderObjectPassportScreen(host, ctx.objectApi, { kind: ctx.kind, id: ctx.id, tab }, { access: ctx.access, embed: 'tab', replaceUrl: false, hrefOf: ctx.hrefOf, ...(ctx.trace ? { trace: ctx.trace } : {}) });
    },
});
/** Topic that embeds the object passport's canonical ACTIONS panel (task / fault / state transitions — the server decides). */
export const actionsTopic = (ctx, spec) => ({
    ...spec,
    render: async (host) => { await renderObjectPassportScreen(host, ctx.objectApi, { kind: ctx.kind, id: ctx.id }, { access: ctx.access, embed: 'actions', replaceUrl: false, hrefOf: ctx.hrefOf }); },
});
/** Link-out topic: points to an existing authorized module instead of copying its data. */
export const linkTopic = (ctx, spec, items) => ({
    ...spec,
    render: (host) => {
        host.replaceChildren(h('section', { class: 'ps-panel', 'data-testid': 'ps-links' }, h('div', { class: 'ps-panel-h' }, h('h2', {}, spec.title)), ...items.map((i) => h('a', { class: 'ps-trow', href: i.href, 'data-testid': 'ps-linkout' }, h('span', {}), h('span', {}, h('div', { class: 'ps-tt' }, i.label), i.note ? h('div', { class: 'ps-ts' }, i.note) : null), h('span', { class: 'ps-chev' }, '›')))));
    },
});
export const kv = (title, rows, note) => ({ title, kv: rows, ...(note ? { note } : {}) });
export const table = (title, columns, rows, empty, note) => ({ title, table: { columns, rows, empty }, ...(note ? { note } : {}) });
export const note = (title, text) => ({ title, note: text });
/** Tolerant reader: an unreadable optional source becomes null (shown as unknown), a refusal is rethrown so the page states "yetki yok". */
export async function opt(p) { try {
    return await p;
}
catch (e) {
    if (isDenied(e))
        throw e;
    return null;
} }
export const passportLinkFor = (ctx, kind, id) => ctx.hrefOf(kind, id);
/** Embed ONLY the named product-workspace cards (same canonical editors as /urun-calisma; the server decides every write). */
export const productCardsTopic = (ctx, spec, only) => ({
    ...spec,
    render: async (host) => {
        if (!ctx.productWs) {
            host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'ps-denied' }, 'Bu bölüm bu rol için açık değil.'));
            return;
        }
        await renderProductWorkspaceScreen(host, ctx.productWs, { product: ctx.id, rev: ctx.rev ?? null, only });
    },
});
export const canManageTasks = (a) => a.owner || a.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT') || a.actions.includes('TASK_MANAGE');
/** All tasks the caller may see: managers see everything (scope ALL), everyone else their own (MINE). Server window: open / in-progress / completed, plus anything touched in the last 7 days (max 200). */
export async function floorTasks(ctx) {
    try {
        const d = await ctx.rpc('task_floor', { p_scope: canManageTasks(ctx.access) ? 'ALL' : 'MINE' });
        return d.manual ?? [];
    }
    catch (e) {
        if (isDenied(e))
            throw e;
        return null;
    }
}
/** TEST/PİLOT work orders among these ids (read through the one database authority; unknown/older database = none). Used where a list shows a work order only by its short id. */
export async function pilotIdSet(ctx, ids) {
    const uniq = [...new Set(ids.filter((x) => typeof x === 'string' && x.length > 0))];
    const out = new Set();
    try {
        for (let i = 0; i < uniq.length; i += 200)
            for (const r of (await ctx.rpc('pilot_flags', { p_ids: uniq.slice(i, i + 200) })) ?? [])
                out.add(r.entityId);
    }
    catch {
        return new Set();
    }
    return out;
}
