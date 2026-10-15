// Tablet / kiosk / operator-terminal inactivity sign-out (owner directive, Release 007). Pure rules; the browser wiring lives in apps/web/src/idleGuard.ts.
// Principles: only REAL user interaction counts (touch, click, key, scroll) — never polling, API calls, animation or data refresh;
// the elapsed time is always computed from wall-clock timestamps, so a sleeping/hidden tab is judged on the time that really passed;
// the rule applies to a DEVICE CONTEXT (explicit device mode, or an operator Sicil+PIN session) — never to a desktop session just because the window is narrow.
export const IDLE_LIMIT_MS = 60_000;
export const IDLE_WARN_MS = 10_000;
export const DEVICE_MODES = ['DESKTOP', 'TABLET', 'KIOSK'];
const parseMode = (v) => {
    const s = String(v ?? '').trim().toUpperCase();
    if (s === 'KIOSK')
        return 'KIOSK';
    if (s === 'TABLET')
        return 'TABLET';
    if (s === 'DESKTOP' || s === 'MASAUSTU' || s === 'MASAÜSTÜ' || s === 'PC')
        return 'DESKTOP';
    return null;
};
/** Where the device mode comes from, strongest first: deployment config.js `deviceMode`; a one-time explicit setup link `?cihaz=kiosk|tablet|masaustu` (remembered on THIS device); nothing = DESKTOP. */
export function resolveDeviceMode(input) {
    const c = parseMode(input.config);
    if (c)
        return { mode: c, source: 'CONFIG', persist: null };
    const u = parseMode(input.urlParam);
    if (u)
        return { mode: u, source: 'SETUP_LINK', persist: u };
    const s = parseMode(input.stored);
    if (s)
        return { mode: s, source: 'STORED', persist: null };
    return { mode: 'DESKTOP', source: 'DEFAULT', persist: null };
}
/** The guard runs on tablets/kiosks, and on ANY operator Sicil+PIN session (shared factory terminals, operator PWA) whatever the device mode says. */
export const idleGuardApplies = (mode, operatorSession) => mode !== 'DESKTOP' || operatorSession;
/** State from wall-clock timestamps. A clock that moved backwards cannot extend a session beyond the limit (elapsed is clamped at 0 only for the future-dated case below). */
export function idleState(lastActivityMs, nowMs, limitMs = IDLE_LIMIT_MS, warnMs = IDLE_WARN_MS) {
    if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs))
        return 'EXPIRED'; // unreadable timestamp: fail closed
    const elapsed = nowMs - lastActivityMs;
    if (elapsed < 0)
        return elapsed < -limitMs ? 'EXPIRED' : 'ACTIVE'; // small skew tolerated; a timestamp far in the future is not trusted
    if (elapsed >= limitMs)
        return 'EXPIRED';
    return elapsed >= limitMs - warnMs ? 'WARN' : 'ACTIVE';
}
export const idleSecondsLeft = (lastActivityMs, nowMs, limitMs = IDLE_LIMIT_MS) => Math.max(0, Math.ceil((limitMs - (nowMs - lastActivityMs)) / 1000));
/** Only a trusted, user-originated event resets the timer. Synthetic events (scripts), timers, network callbacks and animations never do. */
export const countsAsInteraction = (e) => e.isTrusted === true && ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel', 'scroll', 'click'].includes(e.type);
export const formFactorOf = (widthPx) => (widthPx < 640 ? 'phone' : widthPx < 1024 ? 'tablet' : 'desktop');
export function deviceProfile(mode, widthPx, operatorSession) {
    const form = formFactorOf(widthPx);
    const shared = mode === 'KIOSK' || operatorSession;
    const touchFirst = mode !== 'DESKTOP' || form !== 'desktop' || operatorSession;
    return { mode, form, idleSignOut: idleGuardApplies(mode, operatorSession), sharedDevice: shared, showIdentityStrip: shared || mode === 'TABLET', touchFirst, minTargetPx: mode === 'KIOSK' || operatorSession ? 64 : touchFirst ? 48 : 40 };
}
