# KMI Cost Intelligence — Discovery Audit (item 36)
Source directive: `5bccfbf7-attachment.txt` (Cost Intelligence directive, uploaded). Status words: DONE / PARTIAL / BLOCKED / DEFERRED / NOT STARTED.

## What existed before this work (read, not rebuilt)
| Asset | Where | Use |
|---|---|---|
| Work-order cost model | `packages/domain/src/costModel.ts`, `economics.ts`, `EconomicsScreen` (`/ekonomi`) | Kept. Says "TAM MALİYET HESAPLANAMADI" when a component is missing. |
| Cost parameters | migration 0044 `cost_parameters` | Kept; not duplicated. |
| Economic access engine | 0028 / 0036 (`can_view_economics`, owner bindings, grants) | Reused unchanged; the new tables copy its gate. |
| Machine state events | `machine_state_events` | Canonical source of downtime; never re-derived. |

## What this work added
Engines (pure, unit tested): `costIntelligence.ts`, `costImport.ts`. Workspace `/maliyet` (22 tabs). Draft DB package 0078 + rollback (NOT applied). Replica proofs in `supabase/verification/cost_foundation_draft.sql`.

## Honest status
| Area | Status |
|---|---|
| Calculation engines (machine hour, tooling, unit cost, order margin, labor split, energy scenario, break-even) | DONE (local unit tests) |
| 22-tab workspace, each tab labelled ENGINE / PREVIEW / DATA REQUIRED | DONE (local browser test 9/9) |
| CSV import staging (preview, mapping, validation, duplicates, formula neutralisation) | DONE (local) |
| DB foundation 0078 | PARTIAL — draft + rollback + replica proof; NOT applied anywhere |
| Real expenses / budgets / meters / invoices | BLOCKED — DATA REQUIRED (none supplied) |
| .xlsx parsing | DEFERRED (CSV only) |
| Allocation driver policy, material valuation, labor/GEÇKO mapping | BLOCKED — OWNER DECISION |
Nothing shows a number it cannot support: missing input = BİLİNMİYOR, never 0.
