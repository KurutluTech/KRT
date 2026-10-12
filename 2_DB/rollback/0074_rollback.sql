-- ROLLBACK for DRAFT 0074. NOT APPLIED ANYWHERE. Run only with the owner's written approval, in one transaction.
-- Compatibility: 0074 is additive, so no existing writer, RPC or screen depends on it; rolling back restores the previous behaviour.
-- DATA NOTE: dropping the audit columns DISCARDS role_context/correlation_id/outcome/occurred_at already recorded. Take a table copy first
-- (create table kmi_next.audit_log_0074_backup as select * from kmi_next.audit_log) if those values must survive.
begin;
drop trigger if exists audit_log_append_only on kmi_next.audit_log;
drop trigger if exists audit_log_no_truncate on kmi_next.audit_log;
drop trigger if exists audit_log_fill_context on kmi_next.audit_log;
-- previous read policy: any signed-in user sees every non-money row (the exposure this draft closes)
drop policy if exists kmi_next_audit_log_read on kmi_next.audit_log;
create policy kmi_next_audit_log_read on kmi_next.audit_log for select to authenticated using (kmi_next.audit_row_visible(entity_type, action, before_state, after_state));
drop function if exists kmi_next.add_object_note(text, text, text);
drop table if exists kmi_next.object_notes;
drop function if exists kmi_next.audit_scope_ok(text, uuid);
drop function if exists kmi_next.audit_role_scope_ok(text);
drop table if exists kmi_next.audit_read_scope;
drop function if exists kmi_next.audit_no_mutation();
drop function if exists kmi_next.audit_fill_context();
drop function if exists kmi_next.txn_correlation();
alter table kmi_next.audit_log drop constraint if exists audit_log_outcome_check, drop column if exists role_context, drop column if exists correlation_id, drop column if exists outcome, drop column if exists occurred_at;
-- tasks: only if no task uses the new source types (else this constraint fails and the whole rollback aborts, which is the safe outcome)
alter table kmi_next.tasks drop constraint if exists tasks_source_type_check;
alter table kmi_next.tasks add constraint tasks_source_type_check check (source_type in ('NONE','WORK_ORDER','ORDER','QUALITY_NCR','QUALITY_HOLD','MAINTENANCE_TICKET','PURCHASE_REQUEST','SHIPMENT'));
-- restore the pre-0074 task helpers (verbatim from migration 0058)
create or replace function kmi_next.task_source_exists(p_type text, p_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'NONE' then p_id is null
    when 'WORK_ORDER' then exists (select 1 from kmi_next.work_orders where id::text = p_id)
    when 'ORDER' then exists (select 1 from kmi_next.orders where id::text = p_id)
    when 'QUALITY_NCR' then exists (select 1 from kmi_next.quality_ncrs where id::text = p_id)
    when 'QUALITY_HOLD' then exists (select 1 from kmi_next.quality_holds where id::text = p_id)
    when 'MAINTENANCE_TICKET' then exists (select 1 from kmi_next.maintenance_tickets where id::text = p_id)
    when 'PURCHASE_REQUEST' then exists (select 1 from kmi_next.purchase_requests where id::text = p_id)
    when 'SHIPMENT' then exists (select 1 from kmi_next.shipments where id::text = p_id)
    else false end;
$$;

create or replace function kmi_next.task_route(p_type text, p_id text) returns text
language sql immutable set search_path = '' as $$
  select case p_type
    when 'WORK_ORDER' then '/is-emirleri?wo=' || p_id
    when 'QUALITY_NCR' then '/is-emirleri'
    when 'QUALITY_HOLD' then '/is-emirleri'
    when 'MAINTENANCE_TICKET' then '/bakim'
    when 'PURCHASE_REQUEST' then '/talepler'
    when 'SHIPMENT' then '/is-emirleri'
    when 'ORDER' then '/siparisler'
    else null end;
$$;
commit;
