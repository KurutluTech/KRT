// KMI NEXT — Priority 4 (factory integrations), GEÇKO leg.
//
// PROVENANCE / SCOPE NOTE (read before touching this file):
// This module models the REAL, LIVE, production-verified GEÇKO personnel pass-event
// architecture that already exists in old KMI, documented in
// /home/claude/kmi/docs/KMI_GECKO_HARDENING_REPORT.md (read-only review, old KMI repo was never
// written to). That document shows a working integration: GEÇKO PassLog API -> a Supabase Edge
// Function (clever-service, 15-min pg_cron) -> an immutable raw pass-event ledger deduped by
// passID -> a derived daily attendance projection (first-in / last-out / last-movement /
// status) -> old KMI's UI. It also documents a real fixed security bug (missing RLS on the raw
// event tables) and a 3-run idempotency proof (295 events on run 1, 0 duplicate inserts on runs
// 2-3).
//
// KMI NEXT itself has NOT connected to any live GEÇKO (or any other) endpoint — this sandbox has
// no route to one, and the directive governing this work (Priority 4) says to build
// contract/simulator adapters matching the OLD system's verified field names/contracts, not to
// fabricate a new live connection. Everything below is therefore marked NOT_VERIFIED at the KMI
// NEXT integration boundary even though the underlying real-world contract it models IS
// verified (in old KMI, not here). Treat "verified" in comments as "verified to exist in old
// KMI's documented, live system" — never as "verified by KMI NEXT against a live endpoint."
//
// Puantaj isolation (directive-mandated): packages/domain/src/puantaj.ts's locked V47 formula
// must NEVER read anything from this module. This file does not import puantaj.ts and nothing
// here is wired into the puantaj calculation; that boundary is intentional and must stay.
/** A pass event is accepted into the raw ledger only once per passId — mirrors the dedup rule
 * that made old KMI's 3-run idempotency proof hold (295 inserted on run 1, 0 on runs 2-3). */
export function isDuplicateGeckoPassEvent(passId, existingPassIds) {
    return existingPassIds.has(passId);
}
export function canIngestGeckoPassEvent(passId, existingPassIds) {
    if (isDuplicateGeckoPassEvent(passId, existingPassIds)) {
        return { ok: false, reason: 'DUPLICATE_PASS_ID' };
    }
    return { ok: true };
}
/** An event can only ever be ingested for a mapping that is NOT unmatched — an unmapped GEÇKO
 * code must surface as a tracked gap, never silently attach to no one or to a guessed person. */
export function canAttributeGeckoEventToPerson(mapping) {
    if (mapping.status === 'UNMATCHED' || mapping.personId === null) {
        return { ok: false, reason: 'UNMATCHED_GECKO_IDENTIFIER' };
    }
    return { ok: true };
}
/**
 * Derives the daily attendance projection from a person's raw pass events for one day, applying
 * the exact correctness rule old KMI's hardening report documents as a real, previously-buggy
 * case (the "Murat Recepkethüda, 28.09.2026" example): if the last movement is IN with no
 * matching OUT afterward, the person is still INSIDE with an OPEN SESSION — this must never be
 * read as "left the factory at the last recorded exit." The old bug conflated "no further
 * events today" with "left"; this function keeps the two states distinct exactly as the fix
 * requires.
 *
 * `events` must already belong to a single person and a single calendar day, sorted ascending
 * by `occurredAt` — this function does not sort or filter, so the caller carries that
 * invariant (kept deliberately simple/pure, same style as the rest of this codebase's domain
 * functions).
 */
export function deriveDailyAttendanceProjection(personId, date, events) {
    let firstIn = null;
    let lastOut = null;
    let lastMovementAt = null;
    let lastMovementDirection = null;
    for (const ev of events) {
        if (ev.direction === 'IN' && firstIn === null)
            firstIn = ev.occurredAt;
        if (ev.direction === 'OUT')
            lastOut = ev.occurredAt;
        lastMovementAt = ev.occurredAt;
        lastMovementDirection = ev.direction;
    }
    // The open-session rule: INSIDE iff the last movement of the day was IN. Any other case
    // (last movement OUT, or no events at all) is OUTSIDE with no open session.
    const openSession = lastMovementDirection === 'IN';
    const status = openSession ? 'INSIDE' : 'OUTSIDE';
    return { personId, date, firstIn, lastOut, lastMovementAt, lastMovementDirection, status, openSession };
}
/**
 * A worked-minutes figure is only meaningful for a CLOSED session (first IN through a later
 * OUT the same day) — an open session has no "last out" yet, so computing worked minutes from
 * firstIn to "now" would silently fabricate a number that looks like a closed day. Callers that
 * need an in-progress duration must compute it themselves from firstIn and the current time and
 * label it explicitly as in-progress; this function refuses on an open session rather than
 * returning a number that could be mistaken for a finished day's total.
 */
export function computeWorkedMinutesForClosedSession(projection) {
    if (projection.openSession || projection.firstIn === null || projection.lastOut === null) {
        return { ok: false, reason: 'SESSION_NOT_CLOSED' };
    }
    const minutes = (new Date(projection.lastOut).getTime() - new Date(projection.firstIn).getTime()) / 60000;
    if (minutes < 0)
        return { ok: false, reason: 'LAST_OUT_BEFORE_FIRST_IN' };
    return { ok: true, minutes };
}
/** GEÇKO's `location` flag: true = entry, false = exit, missing = UNKNOWN (never guessed). */
export function geckoDirection(location) {
    return location === true ? 'IN' : location === false ? 'OUT' : 'UNKNOWN';
}
/** Ledger admission of one source row (same rules as gecko_write_ledger). */
export function validateGeckoSourceRow(row) {
    if (!row.passId || row.passId.trim() === '')
        return { ok: false, reason: 'MISSING_PASS_ID' };
    if (!row.identifierNumber || row.identifierNumber.trim() === '')
        return { ok: false, reason: 'MISSING_IDENTIFIER' };
    if (!row.passTimeUtc || Number.isNaN(Date.parse(row.passTimeUtc)))
        return { ok: false, reason: 'BAD_PASS_TIME' };
    return { ok: true };
}
/**
 * One identifier, one Istanbul day, events in ledger (ingest) order. Same rule as old KMI
 * (first IN, last OUT, last movement decides INSIDE/open session) PLUS: a DENIED pass or a pass
 * without direction is counted but never moves the person. Equal timestamps: the later ledger
 * row wins (SQL: order by occurred_at desc, id desc).
 */
export function deriveGeckoDayAttendance(events) {
    let firstIn = null;
    let lastOut = null;
    let lastAt = null;
    let lastDirection = null;
    let denied = 0;
    let unknown = 0;
    for (const ev of events) {
        if (ev.passOk === false) {
            denied += 1;
            continue;
        }
        if (ev.direction === 'UNKNOWN') {
            unknown += 1;
            continue;
        }
        const t = Date.parse(ev.occurredAt);
        if (ev.direction === 'IN' && (firstIn === null || t < firstIn))
            firstIn = t;
        if (ev.direction === 'OUT' && (lastOut === null || t > lastOut))
            lastOut = t;
        if (lastAt === null || t >= lastAt) {
            lastAt = t;
            lastDirection = ev.direction;
        }
    }
    const iso = (n) => (n === null ? null : new Date(n).toISOString());
    return {
        firstIn: iso(firstIn),
        lastOut: iso(lastOut),
        lastEventAt: iso(lastAt),
        lastDirection,
        state: lastDirection === 'IN' ? 'INSIDE' : lastDirection === 'OUT' ? 'OUTSIDE' : 'UNKNOWN',
        openSession: lastDirection === 'IN',
        events: events.length,
        deniedEvents: denied,
        unknownDirectionEvents: unknown,
    };
}
/**
 * attendance_records has CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at).
 * A person who leaves and re-enters (OUT 19:06, IN 19:17) has lastOut < firstIn: writing both makes the
 * whole day's upsert fail (HTTP 400, repeated every sync tick) while the sync run still reads SUCCESS.
 * The projection column is only a closed-session figure, so check-out is written ONLY when it is not
 * before check-in; otherwise it is NULL (the person is inside — see openSession). The raw events stay
 * untouched in the ledger; nothing is lost, nothing is invented.
 */
export function attendanceCheckOutForProjection(firstIn, lastOut) {
    if (lastOut === null)
        return null;
    if (firstIn === null)
        return lastOut;
    return Date.parse(lastOut) >= Date.parse(firstIn) ? lastOut : null;
}
export const GECKO_FEED_STATE_TR = {
    NOT_CONNECTED: 'BAĞLI DEĞİL',
    OK: 'GÜNCEL',
    STALE: 'GECİKMİŞ',
    FAILING: 'HATALI',
};
/** Same decision as kmi_next.gecko_health (old KMI's cron is 15 min → 30 min default). */
export function geckoFeedState(lastRunStatus, lastSuccessAt, now, staleMinutes = 30) {
    if (lastSuccessAt === null)
        return 'NOT_CONNECTED';
    if (lastRunStatus === 'FAILED')
        return 'FAILING';
    if (Date.parse(lastSuccessAt) < now.getTime() - Math.max(1, staleMinutes) * 60000)
        return 'STALE';
    return 'OK';
}
/** Same check order and codes as set_gecko_identifier_link (after authorization). */
export function canSetGeckoIdentifierLink(req) {
    if (req.status !== 'VERIFIED' && req.status !== 'DISABLED')
        return { ok: false, reason: 'INVALID_LINK_STATUS' };
    if (!req.reason || req.reason.trim().length < 5)
        return { ok: false, reason: 'REASON_REQUIRED' };
    if (!req.identifierSeen)
        return { ok: false, reason: 'IDENTIFIER_NOT_SEEN' };
    if (req.status === 'VERIFIED') {
        if (!req.personnelId)
            return { ok: false, reason: 'PERSONNEL_REQUIRED' };
        if (!req.person)
            return { ok: false, reason: 'PERSONNEL_NOT_FOUND' };
        if (!req.person.active)
            return { ok: false, reason: 'PERSONNEL_INACTIVE' };
    }
    else if (req.personnelId) {
        return { ok: false, reason: 'DISABLED_LINK_HAS_NO_PERSON' };
    }
    return { ok: true };
}
/** Same decision order as kmi_next.gecko_scheduled_sync(): disabled → skip; lock held → skip; else run. */
export function geckoTickOutcome(enabled, lockAcquired) {
    if (!enabled)
        return 'SKIPPED_DISABLED';
    if (!lockAcquired)
        return 'SKIPPED_OVERLAP';
    return 'RAN';
}
/** "Inside now" is a number ONLY while the feed is OK; otherwise unknown (never "nobody inside"). */
export function insideNow(feed, count) {
    return feed === 'OK' ? { value: count, reason: null } : { value: null, reason: `FEED_${feed}` };
}
export function insideNowText(v) {
    return v.value === null ? `BİLİNMİYOR (${v.reason === 'FEED_NOT_CONNECTED' ? 'akış bağlı değil' : v.reason === 'FEED_FAILING' ? 'akış hata veriyor' : 'akış gecikmiş'})` : String(v.value);
}
/** Who may read attendance (server: can_view_attendance): the role OR an active named grant. Self view is separate. */
export function canViewAttendance(hasRole, activeGrant) {
    return hasRole || activeGrant;
}
