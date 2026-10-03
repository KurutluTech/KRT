KMI — PHASE 1/5 — OWNER REVIEW FIX R2 — MANUAL DEPLOY PACKAGE
================================================================

THIS IS A FIX PASS, NOT A NEW DESIGN. The R1 candidate (sourceCommit bcfc0d8e...)
was reviewed live by Ender and found "technically functioning" but NOT visually
accepted: behind the new left-nav drawer, the deployed page still showed 3 other
competing navigation surfaces (legacy top nav, a large colored module-launch row,
and a secondary utility row). R1 was NEVER deployed to production, so it is not a
"previous verified live" state — do not treat it as a rollback target.

This R2 package fixes the root causes the owner's review identified. It replaces
the R1 package; do not deploy R1.

CANDIDATE IDENTITY (THIS PACKAGE — NEW, NOT A REUSE OF R1)
------------------------------------------------------------
sourceCommit : 3bccd6a0fc8ad4924c63693b2ccd877ada75c3de
buildId      : 3bccd6a0fc8a-20261003T083928Z
builtAt      : 2026-10-03T08:39:28.822Z (UTC)
sha256       : 47a91f99782ffeb53051586e1be7f2bfeb25469326cb226d0b73e987898969c5
               (of index.html in this package; independently cross-checked with
               the system `sha256sum` command, not only the build script's own
               computation)

R1 candidate identity (REJECTED at owner visual review — do not deploy, listed
here only so it is never confused with this package):
  sourceCommit bcfc0d8e876211454b10d1ea7d2e33b06827c79b
  buildId      bcfc0d8e8762-20261003T000523Z
  sha256       f40c6fbcff47eea50595a1b1bd87bfac1cd76c5069c05775541b37f241dd8c58

ROLLBACK TARGET (unchanged — this is the last VERIFIED LIVE deployment; R1 was
never deployed, so it is not a valid rollback point):
  SOURCE  42e8aabdfe99e6d869d8469aaeab8dab6327a830
  BUILD   42e8aabdfe99-20261002T221100Z

WHAT CHANGED IN R2 (owner's 10 FIX items — see the full owner directive for exact
wording; summarized here honestly against what was actually implemented)
------------------------------------------------------------
FIX1  Read-only discovery + classification of every competing nav item was done
      BEFORE any hiding — each item's new home (left nav / top bar / contextual
      action / honest retirement) was confirmed reachable first.
FIX2  Top command bar trimmed from 8 items to 3 genuine utilities that do not
      repeat a left-nav destination: PULSE, Sorun Bildir, Ara / KMI'ye Sor.
FIX3  The large colored module-launch row removed from visible rendering. Root
      cause: it and the "secondary row" the owner also saw are the SAME DOM
      container (#kmiFloorNavRow2), inserted as a CSS SIBLING of the already-
      hidden legacy nav row — a parent's display:none never hides a sibling,
      which is exactly why Phase 1's first hide attempt did not visually work.
      Fixed with a direct, always-applying CSS id selector targeting that
      container itself, so it is hidden regardless of which of the 14
      independent scripts populates it or when.
FIX4  Every item that was in the secondary row now has a canonical home
      (folded into the left nav or top bar above) rather than being silently
      dropped — nothing was deleted, only unwired from a forced-visible launcher.
FIX5  "Operatör Beyan" moved out of ÜRETİM AİLESİ (now strictly Üretim /
      Planlama / Kalite / Bakım) into YÜRÜTME, alongside the other operator-
      facing entry points.
FIX6  "CAM / Üretim Müh." added to the left nav. This is a REAL, pre-existing
      feature (window.kmiIeOpenPanel — "Üretim Mühendisliği (IE) · Faz 1-2-3":
      machine economics, operation time standards, OEE/variance) that had no
      navigation entry point before — confirmed by reading the function itself,
      not invented or guessed at.
FIX7  Left-nav drawer polish: group dividers, a wider desktop panel (w-80 up to
      w-96), visible keyboard-focus states. A persistent/collapsible desktop
      sidebar was evaluated and deliberately NOT implemented this pass — it is
      higher-risk layout surgery against a 20,000+ line app that was never
      built around that assumption, and the directive asked to improve the
      approved drawer direction, not invent a new visual concept.
FIX8  Performance Center is now the real landing experience: the post-login
      function (window.v77EnterPortalFromSession) opens it automatically.
      It shows ONLY real canonical counts — 0 where there is genuinely no open
      data (e.g. "0 Açık Sipariş"), never a fake/seeded number.
FIX9  New browser-level acceptance test added
      (tests/test_phase1_r2_single_navigation_system.js, 18/18 assertions)
      that checks real DOM state (element ids, getComputedStyle, attribute
      sets) — not substring Tailwind-class matching, which can false-positive.
      It asserts: legacy top nav AND #kmiFloorNavRow2 are both
      display:none; the top bar has exactly 3 items with no left-nav-duplicate
      function; exactly one left-nav drawer exists with the corrected IA;
      Performance Center opens on real login; the admin tile grid still exists
      underneath (proving it was not deleted, only no longer the default view).
FIX10 Screenshot evidence was captured AND REVIEWED (not just generated) before
      this report was written, at both required viewports — see
      "SCREENSHOT EVIDENCE" in the accompanying report message.

WHAT WAS NOT CHANGED / NOT DELETED
------------------------------------------------------------
No business logic, canonical business rule, V47 Puantaj formula, DB/RLS/RPC
shape, or working feature was removed. Legacy functions (CANLI / COMMAND CENTER
routing, the admin-tile grid itself, etc.) remain fully intact in the code and
reachable — only their forced-visible, competing launcher surfaces were retired
(KEEP_COMPATIBILITY_HIDDEN, exactly as the master directive requires: hidden
behind canonical replacements with proven reachability, not deleted).

KNOWN OPEN ITEMS (carried over or newly observed — reported honestly, not hidden)
------------------------------------------------------------
- Pre-existing mobile table overflow on some data-heavy legacy tabs (noted in
  the R1 package already; not addressed by this fix pass, which was scoped to
  navigation convergence only).
- At 390px mobile width, the "Ara / KMI'ye Sor" top-bar label visually wraps /
  crowds the other 2 items in the trimmed bar. Not yet formally diagnosed or
  fixed — flagged here rather than silently left for the next review to find.
- FontAwesome icon glyphs render as empty boxes ONLY in this development
  sandbox's own screenshot tooling (the sandbox blocks the icon webfont CDN
  request; confirmed as a test-environment-only artifact, not an app defect —
  the real deployed site has normal internet access).

WHAT TO DO WITH THIS PACKAGE
------------------------------------------------------------
1. Deploy the CONTENTS of this folder (index.html, kmi-version.json,
   kurutlu-manifest.webmanifest, assets/) to KurutluTech/KRT via the GitHub
   web UI, exactly as with the R1 package — Claude does not and will not
   deploy this itself.
2. After deploying, tell Claude deployment is complete so a READ-ONLY live
   verification pass can run (checking the live page's own version metadata
   against sourceCommit/buildId/sha256 above).
3. Review the live result visually again. If accepted, say so explicitly
   ("PHASE 1 ACCEPTED — CONTINUE PHASE 2") to begin Phase 2. If not, describe
   what is still wrong the same way this review did — the real DOM state is
   what gets fixed, not a guess at what "probably" looks better.
