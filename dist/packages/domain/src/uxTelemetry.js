export const LATENCY_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
export const bucketMs = (ms) => { const v = Math.max(0, Number.isFinite(ms) ? ms : 0); return LATENCY_BUCKETS.find((b) => v <= b) ?? 20000; };
/** "#/nesne?t=MACHINE&id=abc" → "/nesne"; "/siparisler/1234-uuid" → "/siparisler/:id"; empty → "/". Anything unusual → "/?" (never echoes typed text). */
export function routeKey(hashOrPath) {
    const base = (hashOrPath.split('?')[0] ?? '').replace(/^#/, '') || '/';
    if (!/^\/[a-z0-9\-/:]*$/i.test(base.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/\d+/g, '/:id')))
        return '/?';
    return base.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/\d+/g, '/:id').slice(0, 60) || '/';
}
export function errorClassOf(status, name) {
    if (status === 0 || status === undefined || status === null)
        return name === 'AuthError' ? 'AUTH' : 'NETWORK';
    if (status === 401)
        return 'AUTH';
    if (status === 403)
        return 'FORBIDDEN';
    if (status === 400 || status === 409 || status === 422)
        return 'VALIDATION';
    if (status >= 500)
        return 'SERVER';
    if (status >= 400)
        return 'CLIENT';
    return 'OTHER';
}
const PERSONAL_KEY = /user|person|personel|operator|sicil|email|e-?posta|name|isim|employee|badge|pin|token|password|uid|ip\b/i;
/** True when an object carries anything that could identify a person or a record. Used by tests and by `sanitizeUxEvent` (which drops such keys). */
export const hasPersonalFields = (o) => Object.keys(o).some((k) => PERSONAL_KEY.test(k));
const KINDS = ['NAV_ERROR', 'BROKEN_ROUTE', 'PAGE_LOAD', 'INTERACTION_LATENCY', 'ACTION_FAILED', 'DEVICE_CLASS', 'TASK_FRICTION'];
/** Whitelist copy: only the known fields survive; route is re-normalised; the rest (including any personal field) is discarded. */
export function sanitizeUxEvent(raw, nowMs) {
    const kind = raw['kind'];
    if (!KINDS.includes(kind))
        return null;
    const e = { kind, route: routeKey(String(raw['route'] ?? '/')), minute: Math.floor(nowMs / 60000) * 60000 };
    if (typeof raw['ms'] === 'number')
        e.ms = bucketMs(raw['ms']);
    const ec = raw['errorClass'];
    if (ec && ['NETWORK', 'AUTH', 'FORBIDDEN', 'VALIDATION', 'SERVER', 'CLIENT', 'OTHER'].includes(ec))
        e.errorClass = ec;
    const d = raw['device'];
    if (d && typeof d.mode === 'string' && typeof d.form === 'string')
        e.device = { mode: d.mode.toUpperCase().slice(0, 8), form: d.form.toLowerCase().slice(0, 8) };
    return e;
}
const pct = (xs, p) => { if (!xs.length)
    return null; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
export const FRICTION_WINDOW_MS = 60_000;
export const SLOW_INTERACTION_MS = 500;
export function createUxTelemetry(o = {}) {
    const now = o.now ?? (() => Date.now());
    const max = o.max ?? 500;
    let buf = [];
    let dropped = 0;
    let sink = null;
    const lastFail = new Map();
    const push = (e) => { buf.push(e); if (buf.length > max) {
        buf.shift();
        dropped += 1;
    } };
    return {
        record(raw) {
            const t = now();
            const e = sanitizeUxEvent(raw, t);
            if (!e)
                return;
            push(e);
            // TASK_FRICTION: the same route failing an action twice within a minute (the user is struggling), derived — not a person-level measure.
            if (e.kind === 'ACTION_FAILED') {
                const prev = lastFail.get(e.route);
                lastFail.set(e.route, t);
                if (prev !== undefined && t - prev <= FRICTION_WINDOW_MS)
                    push({ kind: 'TASK_FRICTION', route: e.route, minute: e.minute });
            }
        },
        snapshot() {
            const by = {};
            const devices = {};
            const loads = {};
            const stat = (r) => (by[r] ??= { loads: 0, p50: null, p95: null, brokenRoute: 0, navErrors: 0, failedActions: 0, friction: 0, failedByClass: {}, slowInteractions: 0 });
            for (const e of buf) {
                const s = stat(e.route);
                if (e.kind === 'PAGE_LOAD') {
                    s.loads += 1;
                    (loads[e.route] ??= []).push(e.ms ?? 0);
                }
                else if (e.kind === 'BROKEN_ROUTE')
                    s.brokenRoute += 1;
                else if (e.kind === 'NAV_ERROR')
                    s.navErrors += 1;
                else if (e.kind === 'ACTION_FAILED') {
                    s.failedActions += 1;
                    if (e.errorClass)
                        s.failedByClass[e.errorClass] = (s.failedByClass[e.errorClass] ?? 0) + 1;
                }
                else if (e.kind === 'TASK_FRICTION')
                    s.friction += 1;
                else if (e.kind === 'INTERACTION_LATENCY' && (e.ms ?? 0) > SLOW_INTERACTION_MS)
                    s.slowInteractions += 1;
                else if (e.kind === 'DEVICE_CLASS' && e.device) {
                    const k = `${e.device.mode}/${e.device.form}`;
                    devices[k] = (devices[k] ?? 0) + 1;
                }
            }
            for (const r of Object.keys(loads)) {
                by[r].p50 = pct(loads[r], 0.5);
                by[r].p95 = pct(loads[r], 0.95);
            }
            return { events: buf.length, dropped, byRoute: by, devices, sink: sink ? 'CONFIGURED' : 'NONE' };
        },
        drain() { const out = buf; buf = []; return out; },
        setSink(s) { sink = s; },
        flush() { if (!sink || !buf.length)
            return; const out = buf; buf = []; try {
            sink(out);
        }
        catch {
            buf = out.concat(buf).slice(-max);
        } },
    };
}
