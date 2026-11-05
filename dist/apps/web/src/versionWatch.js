// V3.6 — "KMI'nin yeni sürümü hazır — Yenile" notice.
// Detects a newer deployed build from the release manifest (./kmi-version.json: buildId / sourceCommit) and, when the manifest is absent or
// not maintained, from the validators (ETag / Last-Modified) of the app entry file. Never refreshes by itself: the user clicks. If a form has
// unsaved input, the first click only warns; a second click reloads anyway. Works with the existing network-first service worker (the reload
// goes to the network; we also ask the worker to update). Read-only: GET/HEAD of static files, no API call, no authority involved.
export const MANIFEST_URL = './kmi-version.json';
export const ENTRY_URL = './dist/apps/web/src/app.js';
export const POLL_MS = 5 * 60 * 1000;
export const NEW_VERSION_TEXT = "KMI'nin yeni sürümü hazır — Yenile";
export async function readSignature(fetchFn, bust) {
    const sig = { manifest: null, entry: null };
    try {
        const r = await fetchFn(`${MANIFEST_URL}?v=${bust}`, { cache: 'no-store' });
        if (r.ok) {
            const j = await r.json();
            const id = j && (j.buildId || j.sourceCommit);
            if (typeof id === 'string' && id)
                sig.manifest = id;
        }
    }
    catch { /* no manifest: entry validators below */ }
    try {
        const r = await fetchFn(ENTRY_URL, { method: 'HEAD', cache: 'no-store' });
        if (r.ok) {
            const v = r.headers.get('etag') || r.headers.get('last-modified');
            if (v)
                sig.entry = v;
        }
    }
    catch { /* offline / blocked: no signal */ }
    return sig;
}
/** true only when a signal that existed at start CHANGED. A missing signal is never "new". */
export function isNewer(base, now) {
    if (!base || !now)
        return false;
    if (base.manifest && now.manifest && base.manifest !== now.manifest)
        return true;
    if (base.entry && now.entry && base.entry !== now.entry)
        return true;
    return false;
}
export function startVersionWatch(o) {
    const doc = o.doc, win = o.win, fetchFn = o.fetchFn, pollMs = o.pollMs ?? POLL_MS;
    let base = null, shown = false, dirty = false, warned = false, timer = null, disposed = false;
    const markDirty = (e) => { const t = e?.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') && t.type !== 'search' && !(t.closest && t.closest('[data-kmi-version-banner]')))
        dirty = true; };
    const clearDirty = () => { dirty = false; warned = false; };
    doc.addEventListener('input', markDirty, true);
    doc.addEventListener('change', markDirty, true);
    doc.addEventListener('submit', clearDirty, true);
    win.addEventListener('hashchange', clearDirty);
    const isDirty = () => dirty || (typeof o.getDirty === 'function' && !!o.getDirty());
    const show = () => {
        if (shown || disposed)
            return;
        shown = true;
        const b = doc.createElement('div');
        b.setAttribute('data-kmi-version-banner', '1');
        b.setAttribute('data-testid', 'new-version-banner');
        b.setAttribute('role', 'status');
        b.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99990;background:#13203a;color:#fff;border:1px solid #4aa3ff;border-radius:12px;padding:10px 16px;font:600 14px system-ui;display:flex;gap:12px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.4)';
        const msg = doc.createElement('span');
        msg.textContent = "KMI'nin yeni sürümü hazır — ";
        const btn = doc.createElement('button');
        btn.setAttribute('data-testid', 'new-version-refresh');
        btn.textContent = 'Yenile';
        btn.style.cssText = 'background:#4aa3ff;color:#06182e;border:0;border-radius:8px;padding:6px 12px;font:700 14px system-ui;cursor:pointer';
        btn.addEventListener('click', async () => {
            if (isDirty() && !warned) {
                warned = true;
                msg.textContent = 'Kaydedilmemiş veri var — önce kaydedin. Yine de yenilemek için tekrar basın: ';
                btn.textContent = 'Yine de yenile';
                return;
            }
            try {
                const reg = await win.navigator?.serviceWorker?.getRegistration?.();
                await reg?.update?.();
            }
            catch { /* worker update is best effort */ }
            win.location.reload();
        });
        b.append(msg, btn);
        doc.body.append(b);
    };
    const check = async () => {
        if (disposed || shown)
            return;
        if (win.navigator && win.navigator.onLine === false)
            return;
        const now = await readSignature(fetchFn, Date.now());
        if (!base) {
            base = now;
            return;
        }
        if (isNewer(base, now))
            show();
    };
    void check();
    timer = win.setInterval(check, pollMs);
    const onVis = () => { if (doc.visibilityState === 'visible')
        void check(); };
    doc.addEventListener('visibilitychange', onVis);
    return { check, dispose() { disposed = true; if (timer)
            win.clearInterval(timer); doc.removeEventListener('visibilitychange', onVis); } };
}
