# Integration matrix
| Source | Used for | State |
|---|---|---|
| machine_state_events | downtime cost, productive hours | canonical, read |
| production_declarations / work_orders | denominators, scrap | canonical, read; NCR rework never counted twice |
| quality_ncrs (+TAHSİS 0076) | scrap/rework cost counts | counts only; TL value needs unit cost |
| stock / lots | material valuation | DATA REQUIRED + OWNER DECISION |
| invoices / supplier invoices | actuals | counts only on HOME; amounts DATA REQUIRED |
| energy meters / tariffs | energy | none exist → scenario only |
| payroll | labor | restricted; V47 untouched |
