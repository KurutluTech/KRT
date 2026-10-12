# JWT refresh — intermittent app-shell failure: investigation (local only)
Check: `app-shell.browser.test.ts` → "expired JWT: silent refresh keeps the user signed in…". Before the change it failed in roughly 1 of 4–6 runs (observed 6 failures in ~30 runs); passes otherwise.

## Evidence (captured network trace of a failing run, ms since page creation)
`2605 login(token) · 2637 my_access 200 · 2713 operator_home 401 · 2738 refresh_token 200 · 2746 index.html (RELOAD) · 2755 refresh_token FAILED (aborted) · after reload: login form, sessionStorage session = null`.

## Two causes, kept separate
1. **TEST-INFRASTRUCTURE cause (race):** the test flipped the mock to "access token expired" and called `reload()` about 100 ms after login, while the page's own post-login background requests were still in flight. One of them got the 401 and started a refresh; the reload aborted that request.
2. **APPLICATION cause (real bug, fixed):** `refreshSession` treated *any* failure — including a network error or an aborted request — as "refresh token refused", so `authed()` fired `onSessionExpired` and cleared the stored session. A transient network error or a 5xx during refresh therefore logged the user out. Correct behaviour: only an explicit refusal (400/401/403 or a malformed answer) ends the session; network errors, 408/429/5xx keep the session and surface `REFRESH_UNAVAILABLE` (Turkish text in `errorText`), and the next call retries.

## Changes
`packages/data-client/src/client.ts` (tri-state refresh result), `errorText.ts`, unit test "refresh network failure / 5xx is TRANSIENT" (client.test 14/14), test settle delay of 2.5 s before arming the expiry mock (removes the race), permanent trace diagnostics in the failure message.

## Result and limits
After both changes: 16 consecutive runs of the full app-shell file, 22/22 each. This is **local evidence, not proof of absence**: the mock issues a one-shot refresh token, while real Supabase has a reuse interval; a refresh response lost to an aborted navigation can still cost the rotated token (a re-login, never a loop). The 30 s wait increase alone was NOT the fix. Status: PARTIAL — fixed and locally verified; re-checked inside the final full regression; no production verification.
