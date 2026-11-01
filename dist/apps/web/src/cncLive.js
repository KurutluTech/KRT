// KMI — CNC freshness plumbing shared by every screen that shows CNC state. The CALCULATION lives in packages/domain/src/cncTelemetry.js
// (adjustCnc, 45 s = production cnc_link_of); this file only decides WHEN a screen re-evaluates or re-reads. Nothing here writes anything.
import { adjustCnc, cncDisplay, msUntilCncExpiry, CNC_STALE_S } from '../../../packages/domain/src/cncTelemetry.js';
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
    // P1: a not-live row keeps its LAST KNOWN E-STOP / alarm visible, labelled as history (never as the current fact)
    let lk = el.__lk;
    const known = !live && a ? cncDisplay(el.__cncRow).lastKnown : null;
    const line = known?.safetyLine ? String(known.safetyLine).split(' (')[0] : null;
    if (line) {
        if (!lk) { lk = document.createElement('div'); lk.className = 'mc-lk'; lk.setAttribute('data-testid', 'mc-cnc-lastknown'); el.after(lk); el.__lk = lk; }
        const at = known.receivedAt ? new Date(known.receivedAt).toLocaleTimeString('tr-TR') : '—';
        lk.textContent = `SON BİLİNEN — GÜNCEL DEĞİL: ${line} · ${at}`;
        lk.title = `${known.safetyLine} — bu bilgi ${at} itibarıyla son bilinen değerdir; şu an doğru olduğu doğrulanamaz.`;
    }
    else if (lk) { lk.remove(); el.__lk = null; }
}
export function bindCncAges(container, everyMs = 5000) {
    if (container.__cncAgeTimer) clearInterval(container.__cncAgeTimer);
    container.__cncAgeTimer = setInterval(() => {
        if (!container.isConnected) { clearInterval(container.__cncAgeTimer); return; }
        if (!visible()) return;
        container.querySelectorAll('.mc-age').forEach(paintCncAge);
    }, everyMs);
}
// ---------------------------------------------------------------------------------------------------------------------------------
// 2M — LIGHT CNC REFRESH for card screens (Performance Center, Makineler). The freshness CALCULATION is unchanged (adjustCnc, 45 s).
// Only the canonical authorised read `cnc_live_states` is polled (one small RPC); the heavy performance/OEE/report reads are NOT awaited.
const ts = (r) => { const t = r?.lastIngestedAt ? Date.parse(r.lastIngestedAt) : NaN; return Number.isFinite(t) ? t : -Infinity; };
/** newest server ingest wins: an OLDER row (late response, heavy full read that started earlier) never overwrites a newer one */
export function pickNewerCnc(cur, inc) {
    if (!cur) return inc ?? null;
    if (!inc) return cur;
    return ts(inc) >= ts(cur) ? inc : cur;
}
/** copy the newest CNC row per machine from `prev` board into `next` board (full re-read must not regress the light-poll state) */
export function mergeBoardCnc(prev, next) {
    if (!prev?.machines || !next?.machines) return;
    const by = new Map(prev.machines.filter((m) => m.cnc).map((m) => [m.code, m.cnc]));
    for (const m of next.machines) { const p = by.get(m.code); if (p) m.cnc = pickNewerCnc(p, m.cnc); }
}
/** what is on screen for a machine's CNC part: when it changes, the cards are re-rendered; when only the age moved, just the age line is refreshed */
export function cncSig(machines) {
    return (machines ?? []).map((m) => { const a = adjustCnc(m.cnc ?? null); return `${m.code}:${a?.link ?? '-'}:${a?.state ?? '-'}:${a?.estop ?? '-'}:${a?.alarm ?? '-'}:${a?.program ?? '-'}:${a?.expiredLocally ? 1 : 0}`; }).join('|');
}
export const isCncDenied = (e) => /FORBIDDEN|42501|NOT_AUTHORIZED|permission denied|CNC_TELEMETRY|PGRST202|404/i.test(String(e?.message ?? e));
/** ONE light poll per screen root. At most ONE request in flight (a hung one is abandoned after 30 s and its late answer is ignored);
 *  failure keeps the last known rows ageing; denial stops polling and reports it; polling stops when the screen is no longer shown. */
export function startCncLightPoll({ alive, read, apply, onDenied, pollMs = globalThis.__cncPollMs ?? 10000 }) {
    const st = { seq: 0, applied: 0, busyAt: 0, stopped: false, failedAt: null, calls: 0 };
    const stop = () => { if (st.stopped) return; st.stopped = true; clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
    const poll = async () => {
        if (st.stopped) return;
        if (!alive()) { stop(); return; }
        if (st.busyAt && Date.now() - st.busyAt < (globalThis.__cncPollAbandonMs ?? 30000)) return; // never pile requests up
        const my = ++st.seq; st.busyAt = Date.now(); st.calls += 1;
        try {
            const rows = await read();
            if (st.stopped || !alive()) return;
            if (my < st.applied) return; // an older request answering late must not replace newer data
            st.applied = my; st.failedAt = null;
            apply(rows);
        }
        catch (e) {
            if (st.stopped || !alive()) return;
            if (isCncDenied(e)) { stop(); onDenied?.(); }
            else st.failedAt = Date.now(); // keep the last known row: it keeps ageing and turns BAYAT by itself
        }
        finally { if (st.seq === my) st.busyAt = 0; }
    };
    const onVis = () => { if (visible()) void poll(); };
    const timer = setInterval(() => { if (!alive()) { stop(); return; } if (visible()) void poll(); }, pollMs);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return { stop, poll, state: st };
}
