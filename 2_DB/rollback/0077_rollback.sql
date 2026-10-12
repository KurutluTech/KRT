-- ROLLBACK for DRAFT 0077. Not applied anywhere. Restores the 0006 request function (creates a new row on every call) and drops the index.
begin;
drop index if exists kmi_next.commercial_approvals_one_pending_idx;
create or replace function kmi_next.request_commercial_approval(p_stock_lot_id uuid) returns kmi_next.commercial_approvals
language plpgsql security definer set search_path = '' as $$
declare v_lot kmi_next.stock_lots; v_approval kmi_next.commercial_approvals;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into v_lot from kmi_next.stock_lots where id = p_stock_lot_id for update;
  if not found then raise exception 'STOCK_LOT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_lot.state not in ('AVAILABLE', 'RESERVED') then raise exception 'LOT_NOT_STAGEABLE_IN_STATE: %', v_lot.state using errcode = '22000'; end if;
  insert into kmi_next.commercial_approvals (stock_lot_id, requested_by) values (p_stock_lot_id, auth.uid()) returning * into v_approval;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, after_state)
  values (auth.uid(), 'COMMERCIAL_APPROVAL_REQUESTED', 'COMMERCIAL_APPROVAL', v_approval.id::text, to_jsonb(v_approval));
  return v_approval;
end; $$;
commit;
