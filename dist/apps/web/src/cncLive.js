// KMI — CNC freshness plumbing shared by every screen that shows CNC state. The CALCULATION lives in packages/domain/src/cncTelemetry.js
// (adjustCnc, 45 s = production cnc_link_of); this file only decides WHEN a screen re-evaluates or re-reads. Nothing here writes anything.
import { adjustCnc, msUntilCncExpiry, CNC_STALE_S } from '../../../packages/domain/src/cncTelemetry.js';
const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
/** LIVE panels (passport CNC Canlı İzleme, embedded live block): local re-evaluation every second, read-only re-read every pollMs while the tab is visible,
 *  immediate re-read when the tab comes back. A failed read never refreshes the row: it keeps ageing and turns BAYAT by itself. */
export function startCncRefresh({ alive, read, paint, initial, pollMs = 10000, tickMs = 1000 }) {
    const st = { row: initial ?? null, failedAt: null, denied: false, busy: false, stopped: false };
    let n = 0;
    const stop = () => { if (st.stopped) return; st.stopped = true; clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
    const poll = async () => {
        if (st.busy || st.stopped) return;
        st.busy = true;
        try {
            const r = await read();
            if (r?.denied) st.denied = true;
            else { st.row = r?.row ?? null; st.failedAt = null; st.denied = false; }
        }
        catch { st.failedAt = Date.now(); }
        st.busy = false;
        if (!st.stopped && alive()) paint(st);
    };
    const onVis = () => { if (visible()) void poll(); };
    const timer = setInterval(() => {
        if (!alive()) { stop(); return; }
        n += 1;
        if (visible() && n % Math.max(1, Math.round(pollMs / tickMs)) === 0) void poll();
        paint(st);
    }, tickMs);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return { stop, poll, state: st };
}
/** ONE re-render of a screen exactly when its soonest UP row passes the freshness threshold (and on return from a background tab). Never polls. */
export function watchCncExpiry(container, rowsFn, rerender) {
    container.__cncExpiry?.cancel();
    let t = null, done = false;
    const cancel = () => { done = true; if (t) clearTimeout(t); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
    const fire = () => { if (done) return; if (!container.isConnected) { cancel(); return; } cancel(); rerender(); };
    const onVis = () => { if (done || !visible()) return; if (!container.isConnected) { cancel(); return; } const ms = msUntilCncExpiry(rowsFn()); if (ms === 0) fire(); };
    const ms = msUntilCncExpiry(rowsFn());
    if (ms !== null) t = setTimeout(fire, Math.max(ms + 300, 1500));
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    container.__cncExpiry = { cancel };
}
/** visible data age on a machine card; refreshed in place every 5 s while visible (state flips come from watchCncExpiry's re-render) */
export function attachCncAge(cardEl, row) {
    if (!cardEl || !row) return;
    let el = cardEl.querySelector('.mc-age');
    if (!el) { el = document.createElement('div'); el.className = 'mc-age'; el.setAttribute('data-testid', 'mc-cnc-age'); (cardEl.querySelector('.mc-st') ?? cardEl).appendChild(el); }
    el.__cncRow = row;
    paintCncAge(el);
}
export function paintCncAge(el) {
    const a = adjustCnc(el.__cncRow);
    const s = a?.ageS != null ? Math.round(Number(a.ageS)) : null;
    const live = a?.link === 'UP';
    el.textContent = s === null ? 'CNC verisi: yaş BİLİNMİYOR' : live ? `CNC verisi: ${s} sn önce` : `CNC verisi BAYAT · ${s} sn`;
    el.title = `Sunucuya ulaşmadan beri geçen süre; ${CNC_STALE_S} sn'den eskisi BAYAT sayılır. CNC örnek saati değildir.`;
    el.setAttribute('data-live', String(live));
}
export function bindCncAges(container, everyMs = 5000) {
    if (container.__cncAgeTimer) clearInterval(container.__cncAgeTimer);
    container.__cncAgeTimer = setInterval(() => {
        if (!container.isConnected) { clearInterval(container.__cncAgeTimer); return; }
        if (!visible()) return;
        container.querySelectorAll('.mc-age').forEach(paintCncAge);
    }, everyMs);
}
