# Test evidence (local) — final RC 390a1eb
Full regression: `node scripts/run-tests.mjs` → exit 0, ALL TEST FILES PASSED; 142 files; 1268 PASS lines; 0 FAIL; 0 skipped; ~24 min; Node 22.22.2, PostgreSQL 16.13 replica (0001–0073), Playwright Chromium 1194 headless.
Run 1 on 61936b7 failed 1 file (leakScan: column name `oversize_amount`) → renamed `oversize_excess` in 390a1eb → full re-run green. Logs: release package `4_EVIDENCE/`.
Not evidence of production behaviour. Skipped tests are never counted as PASS (none were skipped).
