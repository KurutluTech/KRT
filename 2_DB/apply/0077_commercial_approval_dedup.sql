-- DRAFT 0077 — One PENDING commercial approval per stock lot (closes the RECOVERY-002 carry-over "bekleyen ticari onay çiftlenmesi").
-- NOT APPLIED ANYWHERE. Rollback: 0077_rollback.sql.
-- PREFLIGHT (read-only; must return 0 rows; duplicates are a DATA decision for the owner — this draft never deletes or auto-rejects approvals):
--   select stock_lot_id, count(*) from kmi_next.commercial_approvals where status = 'PENDING' group by 1 having count(*) > 1;
begin;
create unique index commercial_approvals_one_pending_idx on kmi_next.commercial_approvals (stock_lot_id) where status = 'PENDING';
-- request is now idempotent: a second request for the same lot returns the existing PENDING row instead of creating another.
create or replace function kmi_next.request_commercial_approval(p_stock_lot_id uuid) returns kmi_next.commercial_approvals
language plpgsql security definer set search_path = '' as $$
declare v_lot kmi_next.stock_lots; v_approval kmi_next.commercial_approvals;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_lot from kmi_next.stock_lots where id = p_stock_lot_id for update;
  if not found then raise exception 'STOCK_LOT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_lot.state not in ('AVAILABLE', 'RESERVED') then raise exception 'LOT_NOT_STAGEABLE_IN_STATE: %', v_lot.state using errcode = '22000'; end if;
  select * into v_approval from kmi_next.commercial_approvals where stock_lot_id = p_stock_lot_id and status = 'PENDING';
  if found then return v_approval; end if;
  insert into kmi_next.commercial_approvals (stock_lot_id, requested_by) values (p_stock_lot_id, auth.uid()) returning * into v_approval;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, after_state)
  values (auth.uid(), 'COMMERCIAL_APPROVAL_REQUESTED', 'COMMERCIAL_APPROVAL', v_approval.id::text, to_jsonb(v_approval));
  return v_approval;
end; $$;
commit;
