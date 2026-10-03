KMI — PHASE 1/5 — R3.1 FINAL VISUAL CONVERGENCE — MANUAL DEPLOY PACKAGE
================================================================

THIS IS A FOCUSED VISUAL-CONVERGENCE PASS ON TOP OF R3, not a rebuild.
Owner directive: "KMI — PHASE 1 R3.1 / FINAL LIVE VISUAL CONVERGENCE"
(2026-10-03), issued after the owner manually deployed R3, logged into real
production himself, and reviewed it with ChatGPT against the fixed Owner/
ChatGPT Home reference. Owner result on R3: PARTIAL / NOT ACCEPTED, with 18
numbered findings. This package addresses those findings without rebuilding
the shell, changing routing, or replacing any real-data binding - exactly as
the directive requires ("R3 architecture is now substantially correct. DO
NOT rebuild it.").

CANDIDATE IDENTITY (THIS PACKAGE)
------------------------------------------------------------
sourceCommit : ab1efc003b5f894a0b97c9665f4ad120c5d257f4
buildId      : ab1efc003b5f-20261003T115756Z
builtAt      : 2026-10-03T11:57:56.090Z (UTC)
sha256       : 793f09f50a9026a4be544266adcf9d234408fcae89871dc674c811edcdbf655d
               (of index.html in this package; independently cross-checked
               with the system `sha256sum` command, not only the build
               script's own computation)

This identity supersedes an earlier, never-distributed R3.1 build
(sourceCommit 7636f430c4969915be40e20ae47b1450577de391) made before the
header-clock-flicker fix below - that earlier build was never sent to the
owner and is not a valid deploy target.

Prior (do-not-use as a deploy target other than R3 itself, which the owner
has already manually deployed) candidate identities - listed only so they
are never confused with this package:
  R3  sourceCommit d621c973ce1123da3426bdbe8e7fc546331001f1  (owner manually
      deployed this one to production; this R3.1 package supersedes it)
  R2  sourceCommit 3bccd6a0fc8ad4924c63693b2ccd877ada75c3de  (never deployed)
  R1  sourceCommit bcfc0d8e876211454b10d1ea7d2e33b06827c79b  (never deployed)

ROLLBACK TARGET (unchanged - this is the last INDEPENDENTLY LIVE-VERIFIED
deployment; R1/R2/R3.1 have never been independently verified live by
Claude - R3's deployment was self-reported by the owner and verified only by
the owner's own visual review, not by a read-only Claude pass, which was
blocked on login and then superseded by this directive):
  SOURCE  42e8aabdfe99e6d869d8469aaeab8dab6327a830
  BUILD   42e8aabdfe99-20261002T221100Z

WHAT THIS RELEASE CHANGES (owner directive's 18 numbered findings against
the real R3 production review, addressed in the same order)
------------------------------------------------------------
§1 DEAD SPACE REMOVED - #kmiGlobalPageHeaderBand (the generic page-title
   band every tab shares: "Performance Center / Sistem Tarihi / Yazdır")
   is now hidden specifically when Ana Sayfa opens, so the real Home header
   (greeting + KPI strip) sits directly under the top shell instead of below
   a second, mostly-empty title band. switchTab() restores the band's
   visibility on every other tab - it is shared app-wide infrastructure, not
   Ana-Sayfa-only, and nothing outside Ana Sayfa lost it.

§2/§10 FIRST VIEWPORT COMPOSITION - kmiRenderAnaSayfa()'s single stacked
   column was restructured into the owner reference's own proportions: a
   ~80% main column (Live Floor, full width, largest; Task Floor + Today's
   Performance side-by-side below it) and a ~20% right rail (Active
   Operators, PULSE, Upcoming, stacked) via `xl:grid-cols-[1fr_320px]`. No
   text was shrunk to fit more in - the composition itself changed.

§3/§4 MACHINE VISUALS + CARD DENSITY - added asMachineVisualTheme(status): a
   per-status icon badge (fa-industry/fa-triangle-exclamation/fa-screwdriver-
   wrench/fa-hand, already-established icons in this codebase, never an
   invented machine-model image) and a status-tinted card background
   (emerald=RUNNING, red=DOWN/ISSUE, amber=PAUSED, blue=MAINTENANCE,
   violet=HOLD, slate=IDLE). BOŞTA machines now render as a compact
   single-row card instead of a tall mostly-empty one. DOWN/ISSUE machines
   show a real blocker line (how long down + open breakdown count) sourced
   from the existing window.v35GetMachineTruthByName() truth record - the
   SAME canonical source already used elsewhere, no second arıza record
   invented, silently omitted if that source has nothing for a machine.

§5 PULSE - the real "PULSE · Kritik Durumlar" panel is now part of the
   right-rail cockpit composition (was already real, now visibly placed).

§6 TASK FLOOR - the real "Task Floor · Görevlerim" panel is now part of the
   main-column cockpit composition, directly below Live Floor.

§7 TODAY'S PERFORMANCE - the real "Bugünün Performansı" panel sits beside
   Task Floor in the main column. OTIF remains honestly VERİ GEREKLİ - no
   factory-wide canonical on-time-delivery source exists yet, so nothing was
   fabricated to fill that metric.

§8 UPCOMING - the real "Yaklaşanlar" panel is part of the right rail.

§9 ACTIVE OPERATORS DENSITY - row list tightened (max 8 shown instead of 10,
   tighter row padding, internal scroll container for longer rosters).
   Truthful VERİ YOK rows are UNCHANGED - nothing was turned green for
   cosmetic parity with the reference.

§11 PERSISTENT DESKTOP SIDEBAR - added an ADDITIVE, parallel fixed-position
   sidebar shown only at >=1024px, built from the EXACT SAME
   kmiLeftNavResolve(user) registry and fn/legacyTab click-dispatch the
   existing overlay drawer already uses - no second destination list exists
   anywhere in the codebase. Below 1024px the drawer/"Menü" button are
   completely unchanged. This was deliberately implemented as the lowest-
   risk option available: it does NOT restructure #mainSystem's own DOM/
   flex hierarchy (this 20k-line app was never built around that, and doing
   so blind was exactly the kind of regression risk R2's own FIX7 pass
   already declined for the same reason) - it only reserves horizontal
   space via margin-left at >=1024px. A real regression THIS introduced was
   found and fixed during this pass's own full-regression run: the fixed-
   position rail could intercept clicks meant for other overlays sharing
   its screen region; fixed by making the rail's own empty surface
   pointer-events:none and re-enabling pointer-events only on its actual
   buttons - the standard safe pattern for a persistent fixed rail. Full
   regression (86 Playwright specs) is green with this fix in place,
   including the exact test that caught the original regression
   (test_puantaj_downtime_categorization.js).

§12 TOP HEADER - unchanged (brand/search/KMI LIVE/PULSE/user block kept
   exactly as R3 built it, per the directive's own instruction not to
   restore old navigation or add a second header).

§13 REAL DATA PRESERVED - no mock/reference values were copied anywhere in
   this pass; every number shown still comes from the same canonical sources
   R3 already used (kmiMachineBoard(), window.jobOrders, V118_STATE.orders,
   declarations, window.KMI_PULSE, kmiTasksRaw()) - nothing new was wired in
   besides window.v35GetMachineTruthByName() for the DOWN-machine blocker
   line, itself an already-existing canonical source.

§14 YÖNETİCİ PANELİ - not touched in this pass, as instructed.

§16 NO STRUCTURAL REINTERPRETATION - no new Home, no module removed for
   sparse data, no modal reintroduced, no second navigation system, no old
   Admin Home restored.

A REAL REGRESSION FOUND AND FIXED DURING THIS PASS'S OWN FULL REGRESSION RUN
(not part of the directive's own scope, surfaced by actually running the
full suite rather than assuming the additive sidebar was safe)
------------------------------------------------------------
See §11 above - the persistent sidebar's own empty surface could intercept
clicks meant for a modal/bottom-sheet sharing its screen region. Found via
test_puantaj_downtime_categorization.js failing after the sidebar was added,
confirmed as a real regression by reproducing the SAME failure on the
pre-R3.1 baseline being absent (i.e. it only appeared once the sidebar
existed), fixed with pointer-events:none on the sidebar container +
pointer-events:auto on its own buttons only, then re-confirmed green on a
full regression re-run.

HEADER CLOCK FLICKER (owner-reported, from a real production video - found
and fixed in this same package, addendum to the 18 numbered findings above)
------------------------------------------------------------
ROOT CAUSE: shRenderBar() (the top shell bar's own renderer) was
unconditionally rebuilding #kmiShellUserSlot's entire innerHTML - which
contains the #kmiFactoryClockTime/Date spans, hardcoded back to "--:--:--"
placeholder markup in that template - on every 800ms tick of ITS OWN
interval (added in R3 to keep the PULSE badge count live), completely
unsynchronized with kmiTickFactoryClock()'s own, separate 1000ms interval
that fills in the real time. The two loops fighting over the same DOM
produced exactly the reported symptom: real time -> destroyed and reset to
placeholder -> real time again -> repeat, every ~0.8-1s.
DUPLICATE WRITERS FOUND: Not a second clock-FORMATTING function (there is
and remains only one: kmiTickFactoryClock(), one setInterval, 1000ms) - but
a second, competing DOM-DESTROYING writer of the same subtree (shRenderBar's
unconditional 800ms full innerHTML rebuild of #kmiShellUserSlot).
FIX: shRenderBar() now tracks the last user identity (uid) it actually
rendered for and only rebuilds #kmiShellUserSlot's DOM when that identity
genuinely changes (login/logout/role switch) - never on a no-op tick. The
PULSE badge in actionsSlot is untouched and still refreshes every 800ms as
R3 intended. The clock span's DOM node is now never destroyed by anything
other than a real identity change, and kmiTickFactoryClock() is the only
thing that ever touches its text on a routine tick.
DOM STABILITY TEST: tests/test_phase1_r3_1_header_clock_stability.js - a
real headless-browser test that logs in, tags the live clock DOM nodes,
waits 3.2 real seconds (several real 800ms/1000ms tick cycles), then uses a
MutationObserver to prove: the clock span's DOM object identity is
unchanged; no destructive childList rebuild touches its containers; no
class/style mutation occurs (nothing that could retrigger a CSS
transition); the displayed time value genuinely advances; the header/shell
bar itself is not torn down either. This test was verified to correctly
FAIL (8/13, specifically on the DOM-identity and destructive-rebuild
assertions, and catching the clock frozen on "--:--:--" at the sampled
instant) against the pre-fix code via a direct git-stash comparison before
being trusted - so it is a genuine regression test for this exact bug, not
a tautology that would pass regardless.
RESULT: 13/13 PASS with the fix, verified live over multiple real clock
ticks in a real (headless) browser, not by code inspection alone. Included
in the full regression run (SONUÇ: TÜMÜ GEÇTİ.) for both this package's
source and its own built index.html.

A KNOWN TEST-ENVIRONMENT LIMITATION (disclosed honestly, not a product
defect - do not mistake this for a real visual discrepancy)
------------------------------------------------------------
This sandboxed build/test container's outbound network explicitly blocks
cdn.tailwindcss.com (confirmed via the egress proxy's own status log: 403
"policy denial" on every attempt). Since this app loads Tailwind CSS from
that CDN at runtime, Tailwind's utility classes do not apply AT ALL inside
this container's headless browser - meaning screenshots captured here show
unstyled/default-browser-rendered HTML, not the real visual design. This is
NOT a product defect: it reproduces identically on the unmodified R3
baseline (verified via git stash + re-check before concluding this), it has
nothing to do with any R3.1 change, and it does not occur on the owner's own
real production (which has normal internet access and is exactly where the
owner's own R3 review screenshots came from). All structural test
assertions in this pass (and all of R3's) check DOM presence/classes/real-
rendering via offsetParent or computed `display`, NOT pixel appearance, so
they remain valid regardless of this limitation. Screenshot evidence
attached with this package is DOM-structural evidence only (confirms panels
exist, are visibly present - not display:none - and are arranged in the
intended grid order) - it is not a substitute for the owner's own visual
review on real production, which remains the authoritative visual check,
exactly as it was for R3.

WHAT WAS NOT CHANGED / NOT DELETED
------------------------------------------------------------
No business logic, canonical business rule, V47 Puantaj formula, DB/RLS/RPC
shape, or working feature was touched. Yönetici Paneli was not touched. The
top header, left-nav registry, and drawer were not rebuilt - only a parallel
presentation of the SAME registry was added for desktop. Legacy functions
remain intact and reachable.

TEST EVIDENCE
------------------------------------------------------------
Full regression (tests/run_all.js): syntax check (94 <script> blocks, 0
errors) + 87 Playwright end-to-end specs (85 from R3 + 2 new) + Python smoke
test + duplicate-id / shared-container scans - ALL PASS, run multiple times
across this pass's changes: against src/index.html and again against THIS
PACKAGE'S OWN index.html (the actual built artifact, via KMI_HTML_PATH), so
what is in this zip is what was tested, not just the source it was built
from. SONUÇ: TÜMÜ GEÇTİ. on every run.

New tests:
- tests/test_phase1_r3_1_visual_convergence.js - directive §17's own
  checklist: Home Live Floor/Active Operators/PULSE/Task Floor/Today's
  Performance/Upcoming all confirmed VISIBLY PRESENT via real-rendering
  checks (not display:none - not just an innerHTML substring, which R3's
  own test already covers separately), no structural horizontal overflow at
  desktop or mobile width, persistent sidebar present only at >=1024px and
  built from the single shared nav registry, mobile drawer path fully
  unchanged. 18/18 PASS standalone, included in the full regression above.
- tests/test_phase1_r3_1_header_clock_stability.js - see "HEADER CLOCK
  FLICKER" above. 13/13 PASS standalone, included in the full regression
  above.

WHAT TO DO WITH THIS PACKAGE
------------------------------------------------------------
1. Deploy the CONTENTS of this folder (index.html, kmi-version.json,
   kurutlu-manifest.webmanifest, assets/) to KurutluTech/KRT via the GitHub
   web UI, exactly as with the R1/R2/R3 packages - Claude does not and will
   not deploy this itself.
2. Review the live result visually again against the fixed Home reference -
   this is where the real visual acceptance happens, same as for R3.
3. If accepted, say so explicitly to begin Phase 2 (Reference A / full Live
   Floor). If not, describe what is still wrong the same way this review
   did - the real DOM state is what gets fixed, not a guess at what
   "probably" looks better.
