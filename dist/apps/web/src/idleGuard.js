// Inactivity sign-out for tablets / kiosks / operator terminals (owner directive P0, Release 007). Rules live in packages/domain/src/idleSession.ts.
// Real interaction only (trusted touch/click/key/scroll). Polling, API calls, animation and data refresh never reset the timer.
// Time is wall-clock based and shared between tabs through localStorage, so a hidden/sleeping tab is judged on the time that really passed
// and a sign-out in one tab signs the others out too. On expiry the screen is covered FIRST, then the session is ended — a slow or failing
// audit/sign-out call can never leave the previous user's data visible.
import { IDLE_LIMIT_MS, IDLE_WARN_MS, countsAsInteraction, idleSecondsLeft, idleState } from '../../../packages/domain/src/idleSession.js';
export const LAST_INTERACTION_KEY = 'kmiLastInteraction';
export const IDLE_LOGOUT_KEY = 'kmiIdleLogoutAt';
export function startIdleGuard(o) {
    const limit = o.limitMs ?? IDLE_LIMIT_MS, warn = o.warnMs ?? IDLE_WARN_MS, now = o.now ?? (() => Date.now());
    const sread = (k) => { try {
        const v = Number(o.storage?.getItem(k));
        return Number.isFinite(v) ? v : 0;
    }
    catch {
        return 0;
    } };
    const swrite = (k, v) => { try {
        o.storage?.setItem(k, String(v));
    }
    catch { /* blocked storage: the in-memory clock still enforces the limit in this tab */ } };
    let last = now(), lastWrite = 0, done = false;
    swrite(LAST_INTERACTION_KEY, last);
    const effectiveLast = () => Math.max(last, sread(LAST_INTERACTION_KEY));
    const startedAt = now();
    let banner = null, countdown = null;
    const showBanner = (secs) => {
        if (!banner) {
            banner = o.doc.createElement('div');
            banner.setAttribute('data-testid', 'idle-warning');
            banner.setAttribute('role', 'alert');
            banner.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:99998;background:#13203a;color:#fff;border:1px solid #f5b942;border-radius:12px;padding:12px 18px;font:600 15px system-ui;box-shadow:0 8px 30px rgba(0,0,0,.5)';
            countdown = o.doc.createElement('span');
            banner.append(o.doc.createTextNode('Hareketsizlik: oturum kapanacak — '), countdown, o.doc.createTextNode(' sn. Devam etmek için dokunun.'));
            o.doc.body.append(banner);
        }
        if (countdown)
            countdown.textContent = String(secs);
    };
    const hideBanner = () => { banner?.remove(); banner = null; countdown = null; };
    const cover = () => {
        if (o.doc.querySelector('[data-testid="idle-cover"]'))
            return;
        const c = o.doc.createElement('div');
        c.setAttribute('data-testid', 'idle-cover');
        c.setAttribute('role', 'alert');
        c.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#070b14;color:#c9d6ee;display:flex;align-items:center;justify-content:center;font:600 18px system-ui';
        c.textContent = 'Oturum güvenli şekilde kapatılıyor…';
        o.doc.body.append(c);
    };
    const expire = async (reason) => {
        if (done)
            return;
        done = true;
        teardown();
        hideBanner();
        cover();
        if (reason === 'IDLE') {
            swrite(IDLE_LOGOUT_KEY, now());
            try {
                bc?.postMessage('logout');
            }
            catch { /* channel closed */ }
        }
        try {
            await o.onExpire(reason);
        }
        catch { /* sign-out/audit failure never reopens the screen: the cover stays until the login screen replaces the page */ }
        o.doc.querySelector('[data-testid="idle-cover"]')?.remove();
    };
    const check = () => {
        if (done)
            return;
        if (!o.hasSession()) {
            void expire('GONE');
            return;
        }
        const logoutAt = sread(IDLE_LOGOUT_KEY);
        if (logoutAt > startedAt) {
            void expire('REMOTE');
            return;
        }
        const st = idleState(effectiveLast(), now(), limit, warn);
        if (st === 'EXPIRED')
            void expire('IDLE');
        else if (st === 'WARN')
            showBanner(idleSecondsLeft(effectiveLast(), now(), limit));
        else
            hideBanner();
    };
    const touch = () => {
        if (done)
            return;
        const t = now();
        last = t;
        if (t - lastWrite > 400) {
            lastWrite = t;
            swrite(LAST_INTERACTION_KEY, t);
        }
        hideBanner();
    };
    const onEvent = (e) => { if (countsAsInteraction(e))
        touch(); };
    const evts = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel', 'scroll', 'click'];
    evts.forEach((t) => o.doc.addEventListener(t, onEvent, { capture: true, passive: true }));
    const onVisible = () => { if (o.doc.visibilityState === 'visible')
        check(); };
    const onPageShow = () => check();
    const onStorage = (e) => { if (e.key === IDLE_LOGOUT_KEY)
        check(); };
    o.doc.addEventListener('visibilitychange', onVisible);
    o.win.addEventListener('pageshow', onPageShow);
    o.win.addEventListener('focus', onPageShow);
    o.win.addEventListener('storage', onStorage);
    let bc = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            bc = new BroadcastChannel('kmi-idle');
            bc.onmessage = () => check();
        }
    }
    catch {
        bc = null;
    }
    const timer = o.win.setInterval(check, o.tickMs ?? 1000);
    function teardown() {
        evts.forEach((t) => o.doc.removeEventListener(t, onEvent, { capture: true }));
        o.doc.removeEventListener('visibilitychange', onVisible);
        o.win.removeEventListener('pageshow', onPageShow);
        o.win.removeEventListener('focus', onPageShow);
        o.win.removeEventListener('storage', onStorage);
        o.win.clearInterval(timer);
        try {
            bc?.close();
        }
        catch { /* already closed */ }
    }
    const announce = () => { swrite(IDLE_LOGOUT_KEY, now()); try {
        bc?.postMessage('logout');
    }
    catch { /* channel closed */ } };
    return { dispose: () => { done = true; teardown(); hideBanner(); }, touch, expired: () => done, announce };
}
