KMI_PHASE_1_DEPLOY.zip — MANUAL DEPLOY INSTRUCTIONS
=====================================================
Owner directive: "FIVE-PHASE REAL PRODUCT CONVERGENCE PROGRAM" — PHASE 1/5
(Shell + Navigation + Performance Center)

THIS CANDIDATE
--------------
SOURCE (git commit):  bcfc0d8e876211454b10d1ea7d2e33b06827c79b
BUILD:                bcfc0d8e8762-20261003T000523Z
BUILT AT (UTC):       2026-10-03T00:05:23.354Z
INDEX SHA256:         f40c6fbcff47eea50595a1b1bd87bfac1cd76c5069c05775541b37f241dd8c58

PREVIOUS VERIFIED LIVE (= THIS PHASE'S ROLLBACK TARGET)
--------------------------------------------------------
SOURCE:  42e8aabdfe99e6d869d8469aaeab8dab6327a830
BUILD:   42e8aabdfe99-20261002T221100Z

If anything goes wrong after deploying this Phase 1 candidate, re-upload
the previously verified index.html (source 42e8aab..., build
42e8aab...-20261002T221100Z) to restore last known-good production.
Do NOT roll back to the FROZEN Monday Factory Acceptance candidate
(source e72c688..., build e72c688d2d94-20261002T173555Z) — that one is
older than the current verified-live baseline and is kept frozen for its
own separate acceptance record, not as a rollback target.

WHAT IS IN THIS ZIP
--------------------
index.html                  — the built Phase 1 artifact (placeholders
                               already substituted with the identity above)
kmi-version.json            — {"sourceCommit","buildId","builtAt"} record,
                               matching the values in this README exactly
kurutlu-manifest.webmanifest — PWA manifest, unchanged from current production
assets/                      — unchanged icon/logo assets referenced by
                               index.html (favicon, touch icon, PWA icons,
                               Kurutlu logo/symbol images)

MANUAL UPLOAD STEPS (KurutluTech/KRT, GitHub Pages — flow.kurutlu.com)
------------------------------------------------------------------------
1. Open the KurutluTech/KRT repository on github.com in your browser.
2. Open the folder that currently holds the live index.html (the same
   folder flow.kurutlu.com is already being served from).
3. Upload/replace index.html with the index.html from this ZIP.
4. Upload/replace kurutlu-manifest.webmanifest with the one from this ZIP
   (only if it differs from what is already there — it has not changed
   this phase, so this step may be a no-op).
5. Upload/replace the files inside assets/ with the ones from this ZIP's
   assets/ folder (only if they differ — unchanged this phase, so this
   step may also be a no-op).
6. Commit the upload directly to the branch GitHub Pages serves from.
7. Wait for GitHub Pages to finish publishing (usually under a minute),
   then reload flow.kurutlu.com.

DO NOT TOUCH
------------
- CNAME file (domain mapping) — leave exactly as-is.
- Any file in the KRT repository not listed above.
- Do NOT upload anything from dist/ in the local dev repo — that folder
  holds a separate, frozen, unrelated acceptance candidate and must never
  be published from.

WHAT PHASE 1 CHANGES ON THE LIVE SITE
---------------------------------------
INCLUDED THIS PHASE:
- One new left-navigation drawer ("Menü" button in the top bar) that
  consolidates all previously-scattered navigation destinations
  (department workspaces, Live Floor, Task Floor, Command Center, Tüm
  Alanlar, etc.) into a single role-aware, de-duplicated list, in the
  owner-specified order (Ana Sayfa/Command Center → Live Floor/Task Floor
  → Üretim Ailesi → Tedarik & Müşteri Akışı → Destek → Analitik/Gelişim →
  role/context items).
- The old second-row legacy tab strip (Operatör/Kalite/Sevkiyat/Bakım/
  Sipariş/Muhasebe/Yönetici/Liderlik buttons) is now hidden from normal
  view (CSS display:none) — it is NOT deleted; the underlying tabs and
  switchTab() logic still work exactly as before for anything that still
  depends on them internally.
- Ana Sayfa ("Home") is rebuilt into a real "Performance Center": a new
  "Fabrika Nabzı" (Factory Pulse) grid shows 6 live counts — Açık Sipariş,
  Aktif İş Emri, Üretimde Makine, Makine Down/Bakım, Kalite Bekliyor,
  Sevke Hazır — computed from the same canonical sources/definitions
  already used elsewhere in the app (no new/second definition of "active
  work order" or "machine state" was invented). If any of these cannot be
  computed, it honestly shows "VERİ GEREKLİ" instead of a fake number.
- The top command bar (Ana Sayfa/Canlı/Command Center/İşlerim/PULSE/
  Raporlar/Ara-KMI'ye Sor/Tüm Alanlar) is unchanged from current
  production except for the new "Menü" button prepended to it.

NOT INCLUDED THIS PHASE (by design — later phases or pre-existing, not
regressions introduced here):
- The ~15 second-row buttons that some department screens still inject
  independently, and the old admin-tile grid, are UNTOUCHED (neither
  hidden nor removed) — Phase 1 only retired the single legacy tab-strip
  row per the directive's explicit scope; these other two of the five
  historically-identified competing nav surfaces are tracked for a later
  phase, not silently left in place by oversight.
- A pre-existing, unrelated-to-navigation horizontal overflow at phone
  width (~390px) was found and traced to a wide <table> in a department
  screen that predates this phase's work — it is not new, and it is not
  caused by the Phase 1 shell/nav/Home changes. Left for a later
  responsive-focused phase (the directive's own Phase 5M).
- Phases 2–5 (Live Floor/machine visuals, Task Floor/Production/Operator
  experience, integrated Order-to-Ship departments, and the remaining
  product areas + legacy visual retirement) have not been started.

DO NOT DEPLOY THIS YOURSELF VIA CLAUDE — Ender manually uploads this ZIP's
contents to KurutluTech/KRT as described above. Claude does not have, and
will not use, any mechanism to publish to production directly.
