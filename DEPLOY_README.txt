KMI — PHASE 1/5 — OWNER DESIGN IMPLEMENTATION R3 — MANUAL DEPLOY PACKAGE
================================================================

THIS IS A NEW DESIGN IMPLEMENTATION PASS, not a fix pass. Owner directive:
"KMI — PHASE 1 + PHASE 2 VISUAL IMPLEMENTATION CONTRACT / OWNER-APPROVED
CHATGPT DESIGN / NO DESIGN INTERPRETATION" (2026-10-03). The owner supplied
two reference screens (ChatGPT-designed, Ender-approved) as the TARGET UI
ARCHITECTURE — Reference B (Ana Sayfa / Performance Center) and Reference A
(full Live Floor). This release implements REFERENCE B ONLY, exactly as the
directive's own §M "IMPLEMENTATION ORDER" requires:

  RELEASE 1 / PHASE 1 R3: GLOBAL SHELL final convergence + ANA SAYFA exactly
  toward REFERENCE B. ... Do NOT yet rebuild the full dedicated Live Floor.

REFERENCE A (full Live Floor rebuild — machine detail tabs, execution
controls, right-rail layout/activities) is explicitly OUT OF SCOPE for this
package and deferred to Phase 2, which only begins after the owner accepts
this Phase 1 R3 result live.

This R3 package REPLACES R1 and R2. Neither R1 nor R2 was ever deployed to
production — do not deploy them, and do not treat either as a rollback
target.

CANDIDATE IDENTITY (THIS PACKAGE)
------------------------------------------------------------
sourceCommit : d621c973ce1123da3426bdbe8e7fc546331001f1
buildId      : d621c973ce11-20261003T094506Z
builtAt      : 2026-10-03T09:45:06.519Z (UTC)
sha256       : ba624f32e20fcc5ea4a08d1971a98aad9e51558be23a354597cde0ece96c1d01
               (of index.html in this package; independently cross-checked
               with the system `sha256sum` command, not only the build
               script's own computation)

Prior (non-deployed, do-not-use) candidate identities — listed only so they
are never confused with this package:
  R2  sourceCommit 3bccd6a0fc8ad4924c63693b2ccd877ada75c3de  (owner visual
      review FIX pass — superseded by this R3 design implementation)
  R1  sourceCommit bcfc0d8e876211454b10d1ea7d2e33b06827c79b  (rejected at
      owner visual review)

ROLLBACK TARGET (unchanged — this is the last VERIFIED LIVE deployment;
R1/R2/R3 have never been deployed, so none of them is a valid rollback
point):
  SOURCE  42e8aabdfe99e6d869d8469aaeab8dab6327a830
  BUILD   42e8aabdfe99-20261002T221100Z

WHAT THIS RELEASE IMPLEMENTS (owner directive §A-C, §J-L — summarized
honestly against what was actually built, not the directive's own wording)
------------------------------------------------------------
GLOBAL SHELL (§A left nav, §B top header)
- Left nav regrouped to Reference B's exact structure: top-level Ana Sayfa /
  Command Center / Live Floor / Task Floor with NO sub-header, then
  ÜRETİM AİLESİ (Üretim/Planlama/Kalite/Bakım), TEDARİK ZİNCİRİ (renamed
  from "TEDARİK & MÜŞTERİ AKIŞI"; Satınalma/Depo & Stok/Satış & Müşteri/
  Sevkiyat & Lojistik), DESTEK FONKSİYONLAR (renamed from "DESTEK";
  Muhasebe & Finans/CAM-Üretim Müh./Takımhane/İnsan & Yetkinlik), RAPORLAR &
  ANALİTİK (renamed from "ANALİTİK/GELİŞİM"). A compact, truthful
  factory-status line (real running/total machine count from
  kmiMachineBoard()) was added at the bottom of the drawer, as the reference
  specifies.
- Top header rebuilt: real KMI brand row, a large Universal Search bar
  (routes to the existing kmiOpenAskKMI()), a "KMI LIVE" pill (routes to the
  existing role-aware kmiOpenCanli()), PULSE with a real open-incident
  count, "Sorun Bildir", and the signed-in user block (name/role/avatar
  initial/live factory clock/Çıkış). No department navigation was added to
  the header (the reference's own rule), and the full build id is not shown
  here (it remains in the page's <meta> tag and in technical/system info).

ANA SAYFA = PERFORMANCE CENTER (§C)
- Converted from a centered modal (R1/R2) into a REAL PAGE
  (#tab-performance-center), using the app's own existing switchTab()
  show/hide mechanism — the same one every other tab already uses — so
  logging in or clicking "Ana Sayfa" shows ONLY this page; no other tab,
  including the admin panel, is left active underneath.
- Implements the reference's full composition with REAL KMI data, never
  mockup numbers:
    C1 Home header       — real hour-based greeting + user's first name,
                            real shift (kmiResolveShift), real quick actions
                            (only functions that actually exist are offered)
    C2 Six-tile KPI strip — Aktif Sipariş / Üretimde İş Emri / Çalışan
                            Makine / Sahadaki Operatör / Kalite Bekleyen /
                            Sevkiyata Hazır, each from the SAME canonical
                            counts already used elsewhere in the app
                            (V118_STATE.orders, window.jobOrders,
                            kmiMachineBoard(), declarations) — VERİ GEREKLİ
                            where a count cannot be computed, never a fake 0
    C3 Live Floor summary — real machine cards from kmiMachineBoard() +
                            kmiMachinesRunningNow() + window.jobOrders
    C4 Canlı Operatörler  — real session/task/shift state per person
                            (MAKİNEDE > GÖREVDE > VARDİYADA > VERİ YOK
                            priority, never a fake "online")
    C5 PULSE panel        — real open/acknowledged/escalated incidents from
                            window.KMI_PULSE.listIncidents()
    C6 Task Floor         — real kmiTasksRaw() records (own tasks for most
                            roles, all tasks for management)
    C7 Bugünün Performansı — real today's production qty/scrap/machine
                            utilization from `declarations`; "Zamanında
                            teslim (OTIF)" is honestly marked VERİ GEREKLİ —
                            KMI has no factory-wide canonical source for
                            on-time-delivery yet, so it was not invented
    C8 Yaklaşanlar        — real upcoming order due dates + task due dates
                            (next 7 days), no fabricated calendar events

A REAL DEFECT FOUND AND FIXED (not part of the original scope, found during
this pass's own screenshot review)
------------------------------------------------------------
The legacy <nav> element's top identity row (brand/build-badge/factory-
clock/user-display/logout — originally unguarded) was never actually hidden
by R1 or R2: only the row BENEATH it ("Navigation Tabs") was. This meant a
second, fully duplicate header was visible underneath the new shell bar the
whole time, violating the reference's "ONE coherent top header" rule — and
had gone unnoticed through R1 and R2's own screenshot reviews. Fixed by
first migrating that row's only real functionality (the live factory clock,
the logout button) into the new shell bar, THEN hiding the now-redundant
legacy row — "prove reachability before hiding," the same rule R2's FIX1
already established for this codebase.

Also fixed, unrelated to this directive but surfaced by this pass's full-
page screenshot (Ana Sayfa is now a real long page instead of a fixed-
overlay modal, so the page's full scroll height is visible for the first
time): a pre-existing stray literal "\n" text artifact sitting directly in
<body>, near two unrelated <script> block boundaries around line ~8429 of
src/index.html. It rendered as near-invisible stray text at the very bottom
of a tall page. Removed; confirmed via a repo-wide scan that no other such
artifact remains.

WHAT WAS NOT CHANGED / NOT DELETED
------------------------------------------------------------
No business logic, canonical business rule, V47 Puantaj formula, DB/RLS/RPC
shape, or working feature was removed. The full Live Floor (Reference A —
machine detail tabs, START/PAUSE/FINISH/DURDUR controls, right-rail layout)
was NOT built in this release; it is Phase 2, explicitly deferred per the
directive. Legacy functions remain intact and reachable; only their forced-
visible, now-redundant surfaces were retired (KEEP_COMPATIBILITY_HIDDEN,
proven reachable first, never deleted).

HONEST UNKNOWN / NO-CANONICAL-SOURCE FIELDS (owner directive §L — fields
the reference shows with mock data that KMI genuinely cannot compute yet,
reported here rather than silently approximated)
------------------------------------------------------------
- "izinli" (on-leave) operator count on the Sahadaki Operatör tile — KMI has
  no canonical attendance/leave data source; honestly omitted rather than
  guessed.
- "Zamanında teslim (OTIF)" on Bugünün Performansı — no factory-wide
  canonical on-time-delivery source exists yet; shown as VERİ GEREKLİ.

ROLE COVERAGE NOTE
------------------------------------------------------------
The owner directive's test matrix (§O) names "Production Manager" as a role
to verify. KMI's real role set is OPERATOR / CAM / BAKIM / KALITE /
SEVKIYAT / MUHASEBE / ADMIN — there is no distinct "Production Manager"
role. Rather than inventing one to satisfy the wording, this package's
tests honestly verify ADMIN (which already carries MANAGEMENT permission),
OPERATOR, and KALITE.

TEST EVIDENCE
------------------------------------------------------------
Full regression (tests/run_all.js): syntax check (94 <script> blocks,
0 errors) + 85 Playwright end-to-end specs + Python smoke test +
duplicate-id / shared-container scans — ALL PASS, run twice: once against
src/index.html, once again against THIS PACKAGE'S OWN index.html (the
actual built artifact, via KMI_HTML_PATH), so what is in this zip is what
was tested, not just the source it was built from.

New test: tests/test_phase1_r3_reference_b_home.js — Section N's full
18-point desktop structural checklist (persistent left nav, coherent top
header, Universal Search, KMI LIVE, PULSE, six-KPI strip, Live Floor
summary, machine cards, Active Operators, PULSE critical panel, Task Floor,
Today's Performance, Upcoming, no Performance Center modal, no old Admin
page underneath, no raw UUID, no prominent build badge, no legacy
navigation, no duplicate launcher grid) + Section O role coverage
(ADMIN/OPERATOR/KALITE) + mobile (390px) structure and drawer-open check.
27/27 PASS standalone.

Screenshot evidence was captured AND REVIEWED (not just generated) before
this report was written — desktop 1440 viewport, desktop 1440 full page,
desktop drawer open, mobile 390 home, mobile 390 drawer open — compared
against Reference B's required structures.

WHAT TO DO WITH THIS PACKAGE
------------------------------------------------------------
1. Deploy the CONTENTS of this folder (index.html, kmi-version.json,
   kurutlu-manifest.webmanifest, assets/) to KurutluTech/KRT via the GitHub
   web UI, exactly as with the R1/R2 packages — Claude does not and will
   not deploy this itself.
2. After deploying, tell Claude deployment is complete so a READ-ONLY live
   verification pass can run (checking the live page's own version
   metadata against sourceCommit/buildId/sha256 above).
3. Review the live result visually again, specifically against Reference B.
   If accepted, say so explicitly to begin Phase 2 (Reference A / full Live
   Floor). If not, describe what is still wrong the same way this review
   did — the real DOM state is what gets fixed, not a guess at what
   "probably" looks better.
