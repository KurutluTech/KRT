KMI-R4.1 — HOME VISUAL CONVERGENCE / REFERENCE-B LOCKED IMPLEMENTATION PASS
MANUAL DEPLOY PACKAGE
================================================================

Owner directive: "KMI-R4.1 — HOME VISUAL CONVERGENCE / REFERENCE-B LOCKED
IMPLEMENTATION PASS" (2026-10-03), issued after R3.1 (the header-clock-
flicker fix). This pass does NOT redesign the product, does NOT invent new
features, and does NOT start Phase 2 — it is a focused ADMIN/MANAGEMENT
Home-page visual-convergence pass toward the approved Reference B design,
on top of the current R3.1 baseline, which the directive explicitly accepts
as structurally correct ("Do not redesign it").

THIS PACKAGE HAS NOT BEEN DEPLOYED. Ender deploys it manually (GitHub web-UI
upload to KurutluTech/KRT), exactly as with every prior release.

CANDIDATE IDENTITY (THIS PACKAGE)
------------------------------------------------------------
sourceCommit : c08219e1e09d938662a2dabd7532b527f520cba7
buildId      : c08219e1e09d-20261003T130012Z
builtAt      : 2026-10-03T13:00:12.678Z (UTC)
sha256       : fe9bd09b163e475d2b0521c3432ca6d9ebb1483ffa8e899d2a1bdd105bdf1f8a
               (of index.html in this package; independently cross-checked
               with the system `sha256sum` command, not only the build
               script's own computation)

This is a NEW release identity — it does NOT overwrite or reuse the R3 or
R3.1 release identity, per directive §X.

Prior candidate identities (listed only so they are never confused with
this package):
  R3.1(clock) sourceCommit ab1efc003b5f894a0b97c9665f4ad120c5d257f4
              (owner's last reviewed/deployed-pending candidate; this
              package is built directly on top of it — git log shows
              c08219e as the very next commit after ab1efc0, no other
              commits in between)
  R3          sourceCommit d621c973ce1123da3426bdbe8e7fc546331001f1
              (owner manually deployed this one to production previously)
  R2          sourceCommit 3bccd6a0fc8ad4924c63693b2ccd877ada75c3de (never deployed)
  R1          sourceCommit bcfc0d8e876211454b10d1ea7d2e33b06827c79b (never deployed)

ROLLBACK TARGET (unchanged — this is the last INDEPENDENTLY LIVE-VERIFIED
deployment; neither R3, R3.1 nor this R4.1 package has been independently
live-verified by Claude against real production — only by this sandbox's
own regression/structural tests):
  SOURCE  42e8aabdfe99e6d869d8469aaeab8dab6327a830
  BUILD   42e8aabdfe99-20261002T221100Z

SCOPE OF THIS PASS (directive sections referenced below)
------------------------------------------------------------
§G Live Floor home preview — cards now sorted by status priority
   (FAULT/ISSUE > RUNNING > PAUSED/HOLD > MAINTENANCE > IDLE) BEFORE slicing
   to 8, so a down/faulted machine is never pushed off the home preview by
   machines earlier in the raw board order. Same canonical kmiMachineBoard()
   data (machine code/name/status/condition/activity), no new source, no new
   status values.

§I Active Operators — same priority-before-slice fix for the existing
   MAKİNEDE > GÖREVDE > VARDİYADA > VERİ YOK truth hierarchy. Previously
   state was computed AFTER the roster was already sliced to 8 in raw array
   order, meaning a genuinely MAKİNEDE operator could be silently excluded
   from the preview by a VERİ YOK person earlier in the roster — this was
   only a cosmetic color-coding bug before, now the priority governs which
   8 people are actually shown.

§J PULSE — incidents sorted by severity (CRITICAL>HIGH>NORMAL), then status
   (ESCALATED>ACKNOWLEDGED>OPEN), then age, before slicing to 5. Same
   canonical window.KMI_PULSE.listIncidents() source — PULSE header count
   and PULSE home panel still derive from the exact same incident truth.

§F KPI strip — Kalite Bekleyen and Sevkiyata Hazır now get exception
   coloring (amber / emerald respectively) ONLY when their real canonical
   value is greater than 0 (plain white otherwise — no color implies no
   fabricated urgency). Çalışan Makine gets a compact progress bar under its
   existing running/total + % value. No new KPI, no new data source — pure
   display treatment on the same asComputeKpis() numbers.

§O Upcoming (real gap found during this pass's required read-only
   discovery, directive §C) — the panel was printing the customer name for
   every order due-date UNCONDITIONALLY, regardless of the viewing role,
   violating §O's "Do not expose unauthorized: customer... information."
   Fixed: customer name is now gated behind the same
   window.KMI_AUTH.can(u,'MANAGEMENT') check asRenderTaskFloor already uses
   elsewhere on this same page. A non-management role now sees
   "Sevkiyat/Termin · Sipariş #<id>" instead of the customer's name.

§E Density — minor spacing tightening (header and KPI strip bottom margin
   mb-5 → mb-4); text size was NOT reduced anywhere.

WHAT THIS PASS DID NOT TOUCH (per directive §A/§N/§P/§S — explicitly LOCKED,
confirmed unchanged by the full regression suite below)
------------------------------------------------------------
- Persistent left navigation / sidebar structure and its single canonical
  registry (kmiLeftNavResolve) — unchanged.
- Global top shell (branding, Universal Search, KMI LIVE, PULSE header
  pill, user identity/logout) — unchanged.
- The R3.1 header-clock DOM-stability fix (shLastRenderedUserId gating) —
  unchanged; re-verified by the SAME existing
  test_phase1_r3_1_header_clock_stability.js in this run, zero regression.
- Canonical data sources, calculations, permissions/role filtering,
  database schema, Supabase policies, Puantaj formulas, machine/quality/
  shipment/stock truth, accounting logic, Smart Assignment, Academy, badges,
  QR permission rules — none of these were touched.
- No Phase 2, no Full Live Floor, no Machine Detail redesign, no Task Floor
  redesign, no Accounting rebuild, no Document Intelligence work was begun.

CANONICAL DATA MAP (every visible dynamic Home field → its real source)
------------------------------------------------------------
- Aktif Sipariş / Üretimde İş Emri: window.V118_STATE.orders / window.jobOrders
- Çalışan Makine (+ %): kmiMachineBoard() (running/total)
- Sahadaki Operatör: existing operatorsOnFloor/operatorsTotal computation
  (asComputeKpis) — unchanged by this pass
- Kalite Bekleyen / Sevkiyata Hazır: declarations[] status counts
  ('Kalite Bekliyor' / 'Sevk Onayı Bekliyor')
- Live Floor cards: kmiMachineBoard() (code/name/status/condition/activity),
  window.jobOrders (current WO/part), window.v35GetMachineTruthByName()
  (down-since/breakdown count)
- Active Operators: PERSONNEL_LIST (roster) × window.kmiMachinesRunningNow()
  (MAKİNEDE) × kmiTasksRaw() (GÖREVDE) × window.kmiResolveShift() (VARDİYADA)
- PULSE: window.KMI_PULSE.listIncidents(u)
- Task Floor preview: kmiTasksRaw(), role-scoped via
  window.KMI_AUTH.can(u,'MANAGEMENT')
- Today's Performance: declarations[] (today's qty/scrap); OTIF remains
  VERİ GEREKLİ (no factory-wide canonical OTIF evaluator exists — none was
  created in this pass, per §L)
- Upcoming: window.V118_STATE.orders (due dates) + kmiTasksRaw() (task due
  dates), 7-day window preserved unchanged; customer name now gated per §O
  above

UNKNOWN / OMITTED (fields intentionally never fabricated)
------------------------------------------------------------
- Today's Performance: OTIF (VERİ GEREKLİ — no canonical factory-wide
  evaluator; not created in this pass per directive §L)
- Today's Performance: plan-vs-actual / historical trend line chart — no
  canonical time-series source was found for a real chart; the existing
  honest compact metric representation (today's qty/scrap numbers) is kept
  instead of fabricating chart points
- KPI "Sahadaki Operatör": no second, separate "izinli" (on-leave) figure is
  shown — no canonical leave/attendance truth source exists for it
- Any "+N bugün"-style comparison badges — no canonical historical-delta
  source exists; none were added

TEST / REGRESSION
------------------------------------------------------------
New focused test: tests/test_phase1_r4_1_home_visual_convergence.js (19
real-browser assertions, 5 groups: §G Live Floor ordering, §I Active
Operators ordering invariant on REAL data, §J PULSE ordering, §F KPI
exception coloring + progress bar, §O Upcoming customer-name gate).
Confirmed via git-stash comparison against the pre-R4.1 commit (ab1efc0)
that it correctly FAILS 5 of its assertions (14/19) on the old code and
PASSES FULLY (19/19) with this change — not a tautological test.

Full suite (tests/run_all.js — syntax check across all <script> blocks,
88 Playwright end-to-end specs including the new one, smoke_test.py,
duplicate_scan.js, shared_container_scan.js) run TWICE and GREEN both
times:
  1) against src/index.html directly        → SONUÇ: TÜMÜ GEÇTİ.
  2) against THIS BUILT ARTIFACT, via
     KMI_HTML_PATH=<this index.html> node tests/run_all.js → SONUÇ: TÜMÜ GEÇTİ.
(Directive §W: "Do not infer artifact correctness from source tests" —
honored; both runs were independent, not inferred from one another.)

Role verification (directive §O/§U/§Y — real logins, not just ADMIN):
ADMIN, OPERATOR, KALITE (Quality), and BAKIM (Maintenance) were each
logged in via the real window.v77EnterPortalFromSession() path and the
real Home page was inspected. All four showed: KPI strip, Live Floor,
Active Operators, PULSE, Task Floor, Today's Performance, Upcoming, and a
visible persistent desktop sidebar (confirmed present after allowing for
its known ~800ms render interval). Task Floor heading correctly read
"Görevler" for ADMIN (MANAGEMENT) and "Görevlerim" for OPERATOR/KALITE/
BAKIM (non-MANAGEMENT) — confirming the existing role-scoping in
asRenderTaskFloor was not broken by this pass. Zero uncaught page
exceptions across all four logins.

KNOWN, DISCLOSED LIMITATION OF THIS SANDBOX (NOT a product defect — applies
to screenshot/visual-review evidence only, confirmed identical to the same
limitation already disclosed in the R3.1 package)
------------------------------------------------------------
This sandboxed container's own egress policy blocks cdn.tailwindcss.com (and
cdnjs.cloudflare.com / cdn.jsdelivr.net / unpkg.com) with a 403 "policy
denial" at the proxy level — confirmed again this session via
`curl -sS "$HTTPS_PROXY/__agentproxy/status"`, which lists these hosts under
recentRelayFailures. Because Tailwind CSS therefore never loads in THIS
headless test browser, raw screenshots captured here (1440x900 ADMIN,
full-page ADMIN, sidebar crop, 390x844 mobile, mobile drawer, OPERATOR,
KALITE, BAKIM — all 8 required by directive §U) render as UNSTYLED HTML,
not the real visual appearance, and are therefore NOT usable for a
meaningful side-by-side comparison against Reference B. This was confirmed
to reproduce identically on the unmodified pre-R4.1 baseline during R3.1's
own investigation and is a sandbox network-policy artifact, not something
this pass's code changes could cause or fix.

Consequently, per directive §U's own instruction ("Do not call PASS if
major structural differences remain" / "explicitly report visual
differences") — this package's VISUAL side-by-side acceptance against
Reference B could NOT be meaningfully performed in this environment and is
NOT claimed as PASS. What WAS verified in this sandbox, honestly:
  - STRUCTURAL presence/ordering/visibility of every required Home section
    (via the regression suite's real DOM/visibility checks, which do not
    depend on CSS loading).
  - The five specific behavioral changes in this pass (§G/§I/§J/§F/§O),
    proven via real-browser assertions, independently confirmed to catch
    their own absence via git-stash comparison.
  - Role-correct content scoping across 4 real roles.
  - Zero console exceptions, zero new HTML id/container conflicts beyond
    the pre-existing, already-documented ones duplicate_scan.js/
    shared_container_scan.js report (unrelated to Home, unrelated to this
    pass).
The actual VISUAL convergence toward Reference B (colors, spacing, card
density, icon treatment as they truly render with Tailwind loaded) can only
be judged from Ender's own real production screenshots after manual deploy,
exactly as was done for R3 → R3.1.

ROLLBACK
------------------------------------------------------------
If this candidate needs to be rolled back after deploy, redeploy the
ROLLBACK TARGET build identity listed above (SOURCE 42e8aabdfe99e6d...,
BUILD 42e8aabdfe99-20261002T221100Z) via the same manual GitHub web-UI
upload process.

THIS PACKAGE HAS NOT BEEN DEPLOYED TO PRODUCTION.
Ender deploys manually.
