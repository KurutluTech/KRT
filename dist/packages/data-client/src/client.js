// KMI NEXT — dependency-free Supabase REST/RPC/Auth client.
//
// Why this exists: @supabase/supabase-js is not installable in this sandbox (no npm registry
// access — see docs/ARCHITECTURE.md) and is not pre-installed anywhere on the filesystem
// either (confirmed via a filesystem-wide search). Supabase's PostgREST (data) and GoTrue
// (auth) services are plain HTTP/REST underneath the SDK, so a small `fetch()`-based client
// is enough, and it is honestly testable here too: this sandbox's shell-level network is
// blocked by an organization egress policy even for the project's OWN REST endpoint
// (confirmed via direct `curl`), so this client is tested with an injected fake `fetch`,
// never a live call made FROM this agent session. The real target — a user's browser on
// their own network — has no such restriction.
//
// Scope discipline: this client only ever targets the `kmi_next` Postgres schema (via
// PostgREST's Accept-Profile / Content-Profile headers). It has no code path that reads or
// writes `public`. All KMI NEXT mutations go through SECURITY DEFINER RPCs (never a direct
// table INSERT/UPDATE/DELETE from the client) — the tables only grant SELECT to
// `authenticated`, enforced server-side by RLS, so a client-side bug here cannot bypass it.
function operatorLabel(person) {
    const p = person;
    return p && typeof p.name === 'string' && p.name ? `${p.name}${typeof p.employeeNo === 'string' && p.employeeNo ? ` · ${p.employeeNo}` : ''}` : undefined;
}
export class AuthError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'AuthError';
    }
}
export class PostgrestError extends Error {
    status;
    code;
    details;
    hint;
    constructor(message, status, code, details, hint) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.hint = hint;
        this.name = 'PostgrestError';
    }
}
/**
 * PostgREST returns Postgres column names (snake_case: qty_planned); every KMI NEXT row type
 * and screen reads camelCase (qtyPlanned). Without this conversion every live read would yield
 * `undefined` fields — the in-memory stubs never exposed it because they return camelCase
 * directly. Applied to every rpc()/select() result, recursively. Request bodies (p_* RPC args)
 * are left untouched.
 */
export function camelizeKeys(value) {
    if (Array.isArray(value))
        return value.map(camelizeKeys);
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase())] = camelizeKeys(v);
        }
        return out;
    }
    return value;
}
async function parseJsonSafe(res) {
    const text = await res.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
export class KmiNextClient {
    url;
    apiKey;
    schema;
    fetchImpl;
    /** Called after a successful silent token refresh (the session object is also updated in place). */
    onSessionRefreshed = null;
    /** Technical-usability hook (KMI-001 §001.7): called with the HTTP status (0 = network) when an RPC fails. Carries no payload, no message, no identity. */
    onRequestFailed = null;
    /** Called when THAT session can no longer be renewed (no refresh token, or the server explicitly refused it). The failing session object is passed so the app can ignore a
     *  straggler request of an OLD session (signed out / replaced by a new login) instead of ending the current one. */
    onSessionExpired = null;
    /** Pauses between attempts when a refresh fails TRANSIENTLY (network / 5xx / 408 / 429 / unrecognised answer). Kept short: GoTrue accepts a re-used refresh token only inside its reuse
     *  interval (10 s by default), so a lost response is best recovered immediately. Tests set [0, 0]. */
    refreshRetryDelaysMs = [800, 1600];
    refreshing = new Map();
    constructor(config) {
        this.url = config.url.replace(/\/$/, '');
        this.apiKey = config.apiKey;
        this.schema = config.schema ?? 'kmi_next';
        // Browsers throw "Illegal invocation" when window.fetch is called with another `this`
        // (this.fetchImpl(...)), so the default is wrapped. Found by the app-shell browser test.
        this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
    }
    auth = {
        signInWithPassword: async (email, password) => {
            const res = await this.fetchImpl(`${this.url}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { apikey: this.apiKey, 'content-type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const body = (await parseJsonSafe(res));
            if (!res.ok || !body) {
                const msg = (body && typeof body['error_description'] === 'string' && body['error_description']) || res.statusText;
                throw new AuthError(String(msg), res.status);
            }
            const user = body['user'];
            return {
                accessToken: String(body['access_token']),
                refreshToken: typeof body['refresh_token'] === 'string' ? body['refresh_token'] : null,
                user: { id: String(user?.['id'] ?? ''), email: user?.['email'] ?? null },
            };
        },
        /** Operator login without e-mail: sicil and/or badge secret + personal PIN, verified server-side (Edge Function operator-login). */
        signInOperator: async (input) => {
            const res = await this.fetchImpl(`${this.url}/functions/v1/operator-login`, {
                method: 'POST',
                headers: { apikey: this.apiKey, 'content-type': 'application/json' },
                body: JSON.stringify(input),
            });
            const body = (await parseJsonSafe(res));
            if (!res.ok || !body || typeof body['accessToken'] !== 'string') {
                const code = body && typeof body['error'] === 'string' ? body['error'] : '';
                const msg = code === 'ACCOUNT_LOCKED' ? 'Hesap geçici olarak kilitli. 15 dakika sonra deneyin veya yöneticiye başvurun.'
                    : code === 'RATE_LIMITED' ? 'Çok fazla deneme. Biraz sonra tekrar deneyin.'
                        : res.status >= 500 || res.status === 404 ? 'Operatör girişi şu anda kullanılamıyor.'
                            : 'Sicil/rozet veya PIN hatalı.';
                throw new AuthError(msg, res.status);
            }
            const user = body['user'];
            return {
                accessToken: String(body['accessToken']),
                refreshToken: typeof body['refreshToken'] === 'string' ? body['refreshToken'] : null,
                user: { id: String(user?.['id'] ?? ''), email: null, label: operatorLabel(body['person']) },
            };
        },
        signOut: async (session) => {
            const res = await this.fetchImpl(`${this.url}/auth/v1/logout`, {
                method: 'POST',
                headers: { apikey: this.apiKey, authorization: `Bearer ${session.accessToken}` },
            });
            if (!res.ok && res.status !== 204) {
                const body = await parseJsonSafe(res);
                throw new AuthError(typeof body === 'string' ? body : 'sign-out failed', res.status);
            }
        },
    };
    /** Harmless reachability probe (no data read/written): true only when the auth service answers 2xx within the timeout. */
    async health(timeoutMs = 6000) {
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
        try {
            const res = await this.fetchImpl(`${this.url}/auth/v1/health`, { method: 'GET', headers: { apikey: this.apiKey }, ...(ctl ? { signal: ctl.signal } : {}) });
            return res.ok;
        }
        catch {
            return false;
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    authHeaders(session) {
        return {
            apikey: this.apiKey,
            authorization: `Bearer ${session ? session.accessToken : this.apiKey}`,
        };
    }
    /**
     * Expired-JWT handling. PostgREST answers 401 when the access token is expired/invalid; the request was NOT executed, so it is safe to
     * retry once after a silent refresh. Refresh tokens rotate (single use), so concurrent 401s share ONE refresh (single flight). If the
     * refresh fails the session is over: onSessionExpired fires once and AuthError('SESSION_EXPIRED') is thrown — never a retry loop.
     */
    async refreshSession(session) {
        const rt = session.refreshToken;
        if (!rt)
            return 'rejected';
        const inflight = this.refreshing.get(rt);
        if (inflight)
            return inflight;
        const run = (async () => {
            try {
                for (let attempt = 0;; attempt += 1) {
                    const outcome = await this.refreshOnce(session, rt);
                    if (outcome !== 'transient')
                        return outcome;
                    const wait = this.refreshRetryDelaysMs[attempt];
                    if (wait === undefined)
                        return 'transient'; // session kept; the caller may retry
                    if (wait > 0)
                        await new Promise((r) => setTimeout(r, wait));
                }
            }
            finally {
                setTimeout(() => this.refreshing.delete(rt), 0);
            }
        })();
        this.refreshing.set(rt, run);
        return run;
    }
    /** One refresh attempt. ONLY an explicit refusal by the auth service (a JSON error body on 400/401/403/422, e.g. refresh_token_not_found / already_used / session_not_found) ends the
     *  session. Everything else — network error, aborted navigation, 5xx/408/429, an HTML/empty answer from a proxy, WAF or captive portal, a 200 without a token — says nothing about
     *  the refresh token and is TRANSIENT: the session is kept. */
    async refreshOnce(session, rt) {
        try {
            const res = await this.fetchImpl(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST', headers: { apikey: this.apiKey, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }),
            });
            const body = (await parseJsonSafe(res));
            if (res.ok) {
                if (!body || typeof body['access_token'] !== 'string')
                    return 'transient';
                // another tab/straggler may have rotated this session object meanwhile; never overwrite a newer token pair with an older answer
                if (session.refreshToken !== rt)
                    return 'ok';
                session.accessToken = body['access_token'];
                session.refreshToken = typeof body['refresh_token'] === 'string' ? body['refresh_token'] : rt;
                this.onSessionRefreshed?.(session, rt);
                return 'ok';
            }
            if (res.status >= 500 || res.status === 408 || res.status === 429)
                return 'transient';
            const code = body && typeof body === 'object' ? String(body['error_code'] ?? body['error'] ?? '') : '';
            if (/rate_limit|timeout|unexpected|unavailable/i.test(code))
                return 'transient';
            const refusal = [400, 401, 403, 422].includes(res.status) && !!body && typeof body === 'object' && ('error' in body || 'error_code' in body || 'msg' in body || 'message' in body);
            return refusal ? 'rejected' : 'transient';
        }
        catch {
            return 'transient';
        } // network error / aborted by navigation: the refresh token may still be valid — never log the user out for that
    }
    async authed(send, session) {
        const startToken = session ? session.accessToken : ''; // the token THIS request was sent with
        const res = await send();
        if (res.status !== 401 || !session)
            return res;
        // another call may already have refreshed while this one was in flight: just retry with the new token
        const ok = session.accessToken !== startToken ? 'ok' : await this.refreshSession(session);
        if (ok === 'transient')
            throw new AuthError('REFRESH_UNAVAILABLE', 503); // session kept; the caller may retry
        if (ok === 'rejected') {
            this.onSessionExpired?.(session);
            throw new AuthError('SESSION_EXPIRED', 401);
        }
        const again = await send();
        if (again.status === 401) {
            this.onSessionExpired?.(session);
            throw new AuthError('SESSION_EXPIRED', 401);
        }
        return again;
    }
    /** Calls a kmi_next.* RPC (the ONLY way this client ever mutates data). */
    async rpc(fnName, args, session) {
        let res;
        try {
            res = await this.authed(() => this.fetchImpl(`${this.url}/rest/v1/rpc/${fnName}`, {
                method: 'POST',
                headers: {
                    ...this.authHeaders(session),
                    'content-type': 'application/json',
                    'content-profile': this.schema,
                },
                body: JSON.stringify(args),
            }), session);
        }
        catch (e) {
            try {
                this.onRequestFailed?.({ status: e instanceof AuthError ? 401 : 0 });
            }
            catch { /* telemetry never breaks a call */ }
            throw e;
        }
        const body = await parseJsonSafe(res);
        if (!res.ok) {
            try {
                this.onRequestFailed?.({ status: res.status });
            }
            catch { /* telemetry never breaks a call */ }
            const err = body;
            throw new PostgrestError(String(err?.['message'] ?? res.statusText), res.status, err?.['code'], err?.['details'], err?.['hint']);
        }
        return camelizeKeys(body);
    }
    /** Reads from a kmi_next.* table. Never writes — writes are RPC-only by design (see header). */
    async select(table, options, session) {
        const params = new URLSearchParams();
        params.set('select', options.columns ?? '*');
        if (options.order)
            params.set('order', options.order);
        if (options.limit !== undefined)
            params.set('limit', String(options.limit));
        for (const [key, value] of Object.entries(options.filters ?? {}))
            params.set(key, value);
        const res = await this.authed(() => this.fetchImpl(`${this.url}/rest/v1/${table}?${params.toString()}`, {
            method: 'GET',
            headers: {
                ...this.authHeaders(session),
                'accept-profile': this.schema,
            },
        }), session);
        const body = await parseJsonSafe(res);
        if (!res.ok) {
            const err = body;
            throw new PostgrestError(String(err?.['message'] ?? res.statusText), res.status, err?.['code'], err?.['details'], err?.['hint']);
        }
        return camelizeKeys(body) ?? [];
    }
}
export function createKmiNextClient(config) {
    return new KmiNextClient(config);
}
