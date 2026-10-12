-- DRAFT 0075 — Customer-PO duplicate prevention. NOT APPLIED ANYWHERE. Owner applies manually after the PREFLIGHT returns zero rows.
-- A customer cannot have two live orders with the same PO (case/space-insensitive). CANCELLED orders do not block re-entry.
-- PREFLIGHT (read-only; must return 0 rows, else the index fails and the transaction rolls back):
--   select customer_id, upper(btrim(customer_po)) po, count(*) from kmi_next.orders where status <> 'CANCELLED' group by 1,2 having count(*) > 1;
-- (The "max 3 active work orders per operator" rule needs NO migration: HARD_CAP_EXCEEDED in operator_multi_machine_refusal already refuses a 4th concurrent machine/operation; proof in supabase/verification/phase0_gaps_draft.sql.)
begin;
create unique index orders_customer_po_live_uniq on kmi_next.orders (customer_id, upper(btrim(customer_po))) where status <> 'CANCELLED';
commit;
