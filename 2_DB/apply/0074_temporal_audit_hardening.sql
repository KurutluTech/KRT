-- ============================================================================================================================
-- DRAFT 0074 — temporal & audit hardening (KMI-RECOVERY-004).   *** NOT APPLIED TO ANY LIVE DATABASE. ***
-- Status: replica-tested only (supabase/verification/temporal_draft.sql). Applying it to production needs the owner's explicit
-- written approval (production migration). It lives in supabase/drafts/, NOT supabase/migrations/, so no tool applies it by accident.
--
-- What it adds (all additive; no existing writer RPC is edited):
--  A. audit_log gets role_context, correlation_id, outcome, occurred_at — filled by ONE BEFORE INSERT trigger, so all existing
--     writers (354 functions) gain them without being touched. Browser time is never used; `at` stays the server clock.
--  B. audit_log becomes append-only (no UPDATE / DELETE / TRUNCATE) — corrections are new events.
--  C. audit_log read scope (OWNER DECISION — the role→object table below is a PROPOSAL): today any signed-in user can read every
--     non-money audit row. After C: ADMIN/MANAGEMENT read all, everyone reads their own actions, other roles read the object
--     types listed in kmi_next.audit_read_scope.
--  D. object_notes + add_object_note(): a note on an object is an audited, append-only event (no second audit system).
--  E. task source types extended to MACHINE / PRODUCT / PERSONNEL / TOOL so the passport can create a task from those objects.
--
-- NOT solved here (honest): REJECTED attempts. PostgreSQL rolls back a failed writer's own audit insert, so a refusal cannot be
-- logged from inside the writer that refused. The `outcome` column is ready; recording refusals needs either per-writer wrappers
-- that catch the error and return a result, or an Edge Function gateway. BLOCKED until the owner chooses (see TEMPORAL_MIGRATION_DRAFT.md).
-- ============================================================================================================================

-- ---- A. context columns + trigger --------------------------------------------------------------------------------------
alter table kmi_next.audit_log
  add column if not exists role_context text[],
  add column if not exists correlation_id uuid,
  add column if not exists outcome text not null default 'SUCCESS',
  add column if not exists occurred_at timestamptz;
alter table kmi_next.audit_log drop constraint if exists audit_log_outcome_check;
alter table kmi_next.audit_log add constraint audit_log_outcome_check check (outcome in ('SUCCESS', 'REJECTED'));

-- one correlation id per database transaction (= per PostgREST request): every audit row written by one call shares it
create or replace function kmi_next.txn_correlation() returns uuid language plpgsql volatile set search_path = '' as $$
declare v text := nullif(current_setting('kmi.txn_correlation', true), '');
begin
  if v is null then v := gen_random_uuid()::text; perform set_config('kmi.txn_correlation', v, true); end if;
  return v::uuid;
end $$;
revoke all on function kmi_next.txn_correlation() from public, anon;
grant execute on function kmi_next.txn_correlation() to authenticated;

create or replace function kmi_next.audit_fill_context() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_occ timestamptz;
begin
  if new.role_context is null and auth.uid() is not null then
    select coalesce(array_agg(upper(r.code) order by upper(r.code)), '{}') into new.role_context from public.roles r where r.active and public.has_role(r.code);
  end if;
  new.correlation_id := coalesce(new.correlation_id, kmi_next.txn_correlation());
  if new.occurred_at is null and new.after_state is not null and jsonb_typeof(new.after_state) = 'object' and new.after_state ->> 'occurredAt' is not null then
    begin v_occ := (new.after_state ->> 'occurredAt')::timestamptz; exception when others then v_occ := null; end;
    -- an event cannot have happened after it was recorded (1 min clock tolerance); an impossible value is dropped, never "fixed"
    if v_occ is not null and v_occ <= new.at + interval '1 minute' then new.occurred_at := v_occ; end if;
  end if;
  return new;
end $$;
revoke all on function kmi_next.audit_fill_context() from public, anon, authenticated;
drop trigger if exists audit_log_fill_context on kmi_next.audit_log;
create trigger audit_log_fill_context before insert on kmi_next.audit_log for each row execute function kmi_next.audit_fill_context();

-- ---- B. append-only ----------------------------------------------------------------------------------------------------
create or replace function kmi_next.audit_no_mutation() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'AUDIT_APPEND_ONLY: audit_log rows are never changed or removed; record a correcting event instead' using errcode = '42501'; end $$;
drop trigger if exists audit_log_append_only on kmi_next.audit_log;
create trigger audit_log_append_only before update or delete on kmi_next.audit_log for each row execute function kmi_next.audit_no_mutation();
-- defence in depth: the triggers stop everyone who is not a superuser/owner; the privileges below stop API roles even if a trigger were ever disabled
revoke update, delete, truncate on kmi_next.audit_log from public, anon, authenticated;
drop trigger if exists audit_log_no_truncate on kmi_next.audit_log;
create trigger audit_log_no_truncate before truncate on kmi_next.audit_log for each statement execute function kmi_next.audit_no_mutation();

-- ---- C. read scope (OWNER DECISION: edit the seed rows before applying) ------------------------------------------------
create table if not exists kmi_next.audit_read_scope (role_code text not null, entity_type text not null, primary key (role_code, entity_type));
alter table kmi_next.audit_read_scope enable row level security;
drop policy if exists audit_read_scope_read on kmi_next.audit_read_scope;
-- the scope matrix itself is policy information: only ADMIN/MANAGEMENT read it (the check functions below are SECURITY DEFINER and still work for everyone)
create policy audit_read_scope_read on kmi_next.audit_read_scope for select to authenticated using (public.has_role('ADMIN') or public.has_role('MANAGEMENT'));
revoke insert, update, delete, truncate on kmi_next.audit_read_scope from public, anon, authenticated;
insert into kmi_next.audit_read_scope (role_code, entity_type) values
  ('ADMIN', '*'), ('MANAGEMENT', '*'),
  ('MAINTENANCE', 'MACHINE'), ('MAINTENANCE', 'MAINTENANCE_TICKET'), ('MAINTENANCE', 'TOOL'),
  ('QUALITY', 'WORK_ORDER'), ('QUALITY', 'QUALITY_NCR'), ('QUALITY', 'QUALITY_HOLD'), ('QUALITY', 'STOCK_LOT'), ('QUALITY', 'MACHINE'),
  ('CAM', 'PRODUCT'), ('CAM', 'PRODUCT_REVISION'), ('CAM', 'CAM_PROGRAM'), ('CAM', 'WORK_ORDER'),
  ('OPERATOR', 'WORK_ORDER'), ('OPERATOR', 'MACHINE'), ('OPERATOR', 'TASK'),
  ('PURCHASING', 'PURCHASE_REQUEST'), ('PURCHASING', 'PURCHASE_ORDER'), ('PURCHASING', 'GOODS_RECEIPT'), ('PURCHASING', 'SUPPLIER'),
  ('SHIPPING', 'SHIPMENT'), ('SHIPPING', 'STOCK_LOT'), ('SHIPPING', 'WORK_ORDER'),
  ('ACCOUNTING', 'ORDER'), ('ACCOUNTING', 'SHIPMENT'), ('ACCOUNTING', 'CUSTOMER')
on conflict do nothing;

create or replace function kmi_next.audit_role_scope_ok(p_entity_type text) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from kmi_next.audit_read_scope s where public.has_role(s.role_code) and (s.entity_type = '*' or s.entity_type = p_entity_type));
$$;
create or replace function kmi_next.audit_scope_ok(p_entity_type text, p_actor uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (p_actor = auth.uid() or kmi_next.audit_role_scope_ok(p_entity_type));
$$;
revoke all on function kmi_next.audit_role_scope_ok(text), kmi_next.audit_scope_ok(text, uuid) from public, anon;
grant execute on function kmi_next.audit_role_scope_ok(text), kmi_next.audit_scope_ok(text, uuid) to authenticated;

drop policy if exists kmi_next_audit_log_read on kmi_next.audit_log;
create policy kmi_next_audit_log_read on kmi_next.audit_log for select to authenticated
  using (kmi_next.audit_row_visible(entity_type, action, before_state, after_state) and kmi_next.audit_scope_ok(entity_type, actor_user_id));

-- ---- D. notes as audited events -----------------------------------------------------------------------------------------
create table if not exists kmi_next.object_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  body text not null check (length(btrim(body)) between 3 and 2000),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists object_notes_entity_idx on kmi_next.object_notes (entity_type, entity_id, created_at desc);
alter table kmi_next.object_notes enable row level security;
drop policy if exists object_notes_read on kmi_next.object_notes;
create policy object_notes_read on kmi_next.object_notes for select to authenticated using (kmi_next.audit_scope_ok(entity_type, created_by));
revoke insert, update, delete, truncate on kmi_next.object_notes from public, anon, authenticated;   -- notes are written only through add_object_note()
drop trigger if exists object_notes_append_only on kmi_next.object_notes;
create trigger object_notes_append_only before update or delete on kmi_next.object_notes for each row execute function kmi_next.audit_no_mutation();

-- E. (declared first: add_object_note uses it) task/note source existence for the passport object kinds
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
    when 'MACHINE' then exists (select 1 from kmi_next.machines where id::text = p_id)
    when 'PRODUCT' then exists (select 1 from kmi_next.products where id::text = p_id)
    when 'PERSONNEL' then exists (select 1 from kmi_next.personnel where id::text = p_id)
    when 'TOOL' then exists (select 1 from kmi_next.tools where id::text = p_id)
    else false end;
$$;
alter table kmi_next.tasks drop constraint if exists tasks_source_type_check;
alter table kmi_next.tasks add constraint tasks_source_type_check check (source_type in ('NONE', 'WORK_ORDER', 'ORDER', 'QUALITY_NCR', 'QUALITY_HOLD', 'MAINTENANCE_TICKET', 'PURCHASE_REQUEST', 'SHIPMENT', 'MACHINE', 'PRODUCT', 'PERSONNEL', 'TOOL'));
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
    when 'MACHINE' then '/nesne?t=MACHINE&id=' || p_id
    when 'PRODUCT' then '/nesne?t=PRODUCT&id=' || p_id
    when 'PERSONNEL' then '/nesne?t=PERSONNEL&id=' || p_id
    when 'TOOL' then '/nesne?t=TOOL&id=' || p_id
    else null end;
$$;

create or replace function kmi_next.add_object_note(p_entity_type text, p_entity_id text, p_body text) returns kmi_next.object_notes
language plpgsql security definer set search_path = '' as $$
declare v kmi_next.object_notes;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_entity_type not in ('WORK_ORDER', 'ORDER', 'QUALITY_NCR', 'MAINTENANCE_TICKET', 'SHIPMENT', 'MACHINE', 'PRODUCT', 'PERSONNEL', 'TOOL') then raise exception 'NOTE_ENTITY_NOT_SUPPORTED' using errcode = '22023'; end if;
  -- the writer may only annotate objects whose history its ROLE may read (no side channel into objects the caller cannot see)
  if not kmi_next.audit_role_scope_ok(p_entity_type) then raise exception 'NOTE_NOT_AUTHORIZED' using errcode = '42501'; end if;
  if not kmi_next.task_source_exists(p_entity_type, p_entity_id) then raise exception 'NOTE_ENTITY_NOT_FOUND' using errcode = '22023'; end if;
  insert into kmi_next.object_notes (entity_type, entity_id, body) values (p_entity_type, p_entity_id, btrim(p_body)) returning * into v;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, after_state)
    values (auth.uid(), 'NOTE_ADDED', p_entity_type, p_entity_id, left(btrim(p_body), 200), jsonb_build_object('noteId', v.id));
  return v;
end $$;
revoke all on function kmi_next.add_object_note(text, text, text) from public, anon;
grant execute on function kmi_next.add_object_note(text, text, text) to authenticated;
