// KMI-013 / 0128 — TEST/PİLOT marking, ONE source for every operational screen (terminal, job card, A4/A5 sheet, work-order hub, quality desk, operator home...).
// The flag lives in the database (immutable is_pilot); the UI only ASKS (rpc pilot_flags) and never decides. An older database without pilot_flags simply means "real":
// the call is wrapped, so the frontend can be deployed before or after SQL 0128 without breaking a screen.
import { h } from '../../../packages/ui/src/h.js';
export const PILOT_LABEL = 'TEST / PİLOT';
export const PILOT_NOTICE = 'TEST / PİLOT — gerçek üretim DEĞİLDİR. Adetler gerçek raporlara, stoğa, sevkiyata ve primlere girmez.';
export const PILOT_PRINT_NOTICE = 'TEST / PİLOT İŞ EMRİ — GERÇEK ÜRETİM DEĞİLDİR';
export const PILOT_CSS = `.kmi-pilot-chip{display:inline-block;background:#f59e0b;color:#451a03;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:900;letter-spacing:.3px;margin-right:6px;white-space:nowrap}
.kmi-pilot-banner{border:2px solid #f59e0b;background:#451a03;color:#fde68a;font-weight:900;text-align:center;border-radius:10px;padding:8px 10px;margin:8px 0}
.kmi-pilot-sheet{border:3px dashed #000!important;position:relative}.kmi-pilot-sheet .kmi-pilot-wm{font-weight:900;font-size:20px;text-align:center;border:3px solid #000;padding:4px;margin-bottom:6px;letter-spacing:1px}`;
const NONE = { has: () => false, retired: () => false, size: 0 };
const UNKNOWN = { has: () => false, retired: () => false, size: 0, unknown: true };
const INSTALL_TTL_MS = 5 * 60_000;
const installCache = new WeakMap();
const isMissingFn = (e) => { const x = e; return x?.status === 404 || x?.code === 'PGRST202' || x?.code === '42883'; };
/** which of these ids are TEST/PİLOT work orders or machines. Never throws: unknown (older database / network) = real. */
export function pilotInstallState(client, session) {
    const hit = installCache.get(client);
    if (hit && Date.now() - hit.at < INSTALL_TTL_MS)
        return hit.p;
    const p = client.rpc('pilot_flags', { p_ids: [] }, session).then(() => 'yes', (e) => (isMissingFn(e) ? 'no' : 'unknown'));
    installCache.set(client, { at: Date.now(), p });
    void p.then((st) => { if (st === 'unknown')
        installCache.delete(client); }); // an outage is never remembered
    return p;
}
export async function fetchPilotFlags(client, session, ids) {
    const uniq = [...new Set(ids.filter((x) => typeof x === 'string' && x.length > 0))];
    if (!uniq.length)
        return NONE;
    const hit = installCache.get(client);
    if (hit && Date.now() - hit.at < INSTALL_TTL_MS && (await hit.p) === 'no')
        return NONE;
    const found = new Map();
    try {
        for (let i = 0; i < uniq.length; i += 200) {
            const rows = await client.rpc('pilot_flags', { p_ids: uniq.slice(i, i + 200) }, session);
            for (const r of rows ?? [])
                found.set(r.entityId, r.retired === true);
        }
    }
    catch (e) {
        if (isMissingFn(e)) {
            installCache.set(client, { at: Date.now(), p: Promise.resolve('no') });
            return NONE;
        }
        return UNKNOWN;
    }
    installCache.set(client, { at: Date.now(), p: Promise.resolve('yes') }); // the real call itself proved the install state: no separate probe
    return { has: (id) => !!id && found.has(id), retired: (id) => !!id && found.get(id) === true, size: found.size };
}
export const pilotChip = (retired = false) => h('span', { class: 'kmi-pilot-chip', 'data-testid': 'pilot-chip', 'data-pilot': '1', title: PILOT_NOTICE }, retired ? `${PILOT_LABEL} · EMEKLİ` : PILOT_LABEL);
export const pilotBanner = (retired = false) => h('div', { class: 'kmi-pilot-banner', role: 'alert', 'data-testid': 'pilot-banner', 'data-pilot': '1' }, retired ? `${PILOT_NOTICE} (Emekliye ayrıldı: salt okunur.)` : PILOT_NOTICE);
/** plain-text prefix for <option> / table cells / labels where an element cannot be inserted */
export const pilotText = (text, isPilot) => (isPilot ? `[${PILOT_LABEL}] ${text}` : text);
/** True when SQL 0128 is installed (pilot_flags answers). Empty id list: no data read, only existence is probed. */
export async function pilotSqlInstalled(client, session) { return (await pilotInstallState(client, session)) === 'yes'; }
/** real-only read: SQL 0128 installed -> the rw_ view or an ERROR (never the base table); not installed -> the base table IS the real data; state unknown (outage) -> the rw_ view or an error. */
export async function selReal(client, table, opts, session) {
    if ((await pilotInstallState(client, session)) === 'no')
        return client.select(table, opts, session);
    return client.select(`rw_${table}`, opts, session);
}
// ---------------------------------------------------------------------------------------------------------------------------------
// Catch-all for every OTHER operational screen: any element that names a work order / machine (data-wo, data-wo-id, data-work-order-id, data-machine-id) or any link to one
// (?wo= / ?is= / #/kart|nesne?t=WORK_ORDER|MACHINE&id=) gets the TEST/PİLOT chip when the database says so. Idempotent, debounced, never throws; stops with the returned disposer.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const HREF_WO = new RegExp(`[?&](?:wo|is)=(${UUID})`, 'i');
const HREF_OBJ = new RegExp(`[?&]t=(?:WORK_ORDER|MACHINE)&id=(${UUID})`, 'i');
const ATTRS = ['data-wo', 'data-wo-id', 'data-work-order-id', 'data-machine-id'];
export function pilotCandidates(root) {
    const out = [];
    const re = new RegExp(`^${UUID}$`, 'i');
    for (const el of Array.from(root.querySelectorAll(`${ATTRS.map((a) => `[${a}]`).join(',')},a[href],option[value]`))) {
        if (el.hasAttribute('data-pilot-seen'))
            continue;
        let id = null;
        for (const a of ATTRS) {
            const v = el.getAttribute(a);
            if (v && re.test(v)) {
                id = v;
                break;
            }
        }
        if (!id && el.tagName === 'OPTION') {
            const v = el.getAttribute('value');
            if (v && re.test(v))
                id = v;
        }
        if (!id && el.tagName === 'A') {
            const href = el.getAttribute('href') ?? '';
            id = HREF_WO.exec(href)?.[1] ?? HREF_OBJ.exec(href)?.[1] ?? null;
        }
        if (id)
            out.push({ el, id });
    }
    return out;
}
export async function decoratePilotMarks(root, client, session) {
    const cands = pilotCandidates(root);
    if (!cands.length)
        return 0;
    const f = await fetchPilotFlags(client, session, cands.map((c) => c.id));
    if (f.unknown && !root.querySelector('[data-testid="pilot-unknown"]')) {
        const host = root;
        if (typeof host.prepend === 'function')
            host.prepend(h('div', { class: 'kmi-pilot-banner', role: 'status', 'data-testid': 'pilot-unknown', style: 'background:#1e293b;border-color:#94a3b8;color:#e2e8f0' }, 'TEST / PİLOT durumu şu an doğrulanamadı (bağlantı). Pilot iş emirlerinin işareti görünmeyebilir — sayfayı yenileyin; emin değilseniz işleme başlamayın.'));
    }
    if (f.unknown)
        return 0; // not answered: do not mark the rows as seen, the next pass asks again
    let n = 0;
    for (const { el, id } of cands) {
        el.setAttribute('data-pilot-seen', '1');
        if (el.tagName === 'OPTION') {
            if (f.has(id) && !(el.textContent ?? '').includes(PILOT_LABEL)) {
                el.textContent = pilotText(el.textContent ?? '', true);
                n += 1;
            }
            continue;
        }
        if (!f.has(id) || ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(el.tagName) || el.parentElement?.closest('[data-pilot-row="1"]') || el.querySelector('[data-pilot="1"]') || el.previousElementSibling?.getAttribute('data-testid') === 'pilot-chip')
            continue;
        el.setAttribute('data-pilot-row', '1');
        const chip = pilotChip(f.retired(id));
        if (el.tagName === 'A' || el.children.length === 0)
            el.before(chip);
        else
            el.prepend(chip);
        n += 1;
    }
    return n;
}
/** A page opened FOR one work order / machine (?is= ?wo= ?workOrderId= ?machine= ?id=): when that subject is a pilot the page gets the banner, whatever the screen draws. */
export async function markPilotSubject(root, client, session, subjectIds) {
    const ids = subjectIds.filter((v) => new RegExp(`^${UUID}$`, 'i').test(v));
    if (!ids.length)
        return false;
    const f = await fetchPilotFlags(client, session, ids);
    const hit = ids.find((i) => f.has(i));
    if (!hit || root.querySelector(':scope > [data-testid="pilot-banner"]'))
        return false;
    root.prepend(pilotBanner(f.retired(hit)));
    return true;
}
export function installPilotDecorator(root, client, session, debounceMs = 150, subjectIds = []) {
    let timer = null;
    let off = false;
    let subjectDone = !subjectIds.length;
    const run = () => {
        timer = null;
        if (off)
            return;
        void decoratePilotMarks(root, client, session).catch(() => undefined);
        if (!subjectDone && root.children.length) {
            subjectDone = true;
            void markPilotSubject(root, client, session, subjectIds).catch(() => undefined);
        }
    };
    const schedule = () => { if (!timer && !off)
        timer = setTimeout(run, debounceMs); };
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });
    schedule();
    return () => { off = true; mo.disconnect(); if (timer)
        clearTimeout(timer); };
}
