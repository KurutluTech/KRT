-- DRAFT 0076 — Control-plan infrastructure + TAHSİS (dimensional correction of oversize characteristics by authorized additional machining) on the EXISTING NCR.
-- NOT APPLIED ANYWHERE. Additive. Rollback: 0076_rollback.sql. No second state machine: TAHSİS is quality_ncrs with kind = 'TAHSIS'; its stages map onto
-- OPEN (detected / held) -> REWORK (rework authorized & in progress) -> RECHECK_PENDING (reinspection) -> ACCEPTED | SCRAPPED. Quantity accounting is the existing
-- one (open removes qty from qty_produced, ACCEPTED returns it ONCE; rework is never a new production declaration).
-- OWNER DECISIONS STILL OPEN (activation of the write paths below is BLOCKED — OWNER DECISION): who enters control-plan data; which role authorizes rework;
-- how physical segregation is marked; whether operators may self-declare. Until decided: control-plan tables are READ-ONLY to the app (no write grant, no RPC),
-- and TAHSİS records are created only by the existing QUALITY_REJECT holders (ADMIN, QUALITY).
begin;

create table kmi_next.control_plans (
  id uuid primary key default gen_random_uuid(),
  product_revision_id uuid not null references kmi_next.product_revisions(id) on delete restrict,
  operation_no int not null check (operation_no > 0),
  version int not null default 1 check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','REVIEWED','RELEASED','OBSOLETE')),
  prepared_by uuid, reviewed_by uuid, released_by uuid,
  created_at timestamptz not null default now(), reviewed_at timestamptz, released_at timestamptz,
  unique (product_revision_id, operation_no, version),
  check (status <> 'RELEASED' or (released_by is not null and released_at is not null))
);
create unique index control_plans_one_released_idx on kmi_next.control_plans (product_revision_id, operation_no) where status = 'RELEASED';

create table kmi_next.control_plan_characteristics (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references kmi_next.control_plans(id) on delete cascade,
  characteristic_code text not null check (length(trim(characteristic_code)) > 0),
  description text, feature text,
  nominal numeric not null, tol_lower numeric not null, tol_upper numeric not null,
  unit text not null default 'mm', method text, frequency text,
  check (tol_lower <= tol_upper),
  unique (plan_id, characteristic_code)
);
alter table kmi_next.control_plans enable row level security;
alter table kmi_next.control_plan_characteristics enable row level security;
create policy kmi_next_control_plans_read on kmi_next.control_plans for select to authenticated using (true);
create policy kmi_next_control_plan_chars_read on kmi_next.control_plan_characteristics for select to authenticated using (true);
grant select on kmi_next.control_plans, kmi_next.control_plan_characteristics to authenticated;

alter table kmi_next.quality_ncrs
  add column kind text not null default 'NONCONFORMANCE' check (kind in ('NONCONFORMANCE','TAHSIS')),
  add column detection_source text check (detection_source in ('OPERATOR_SELF_DECLARED','QUALITY_DETECTED')),
  add constraint quality_ncrs_tahsis_source check (kind <> 'TAHSIS' or detection_source is not null);

-- Dimension-level record: product + revision + operation + characteristic, nominal, tolerances, measured value, feature, qty, machine, tool, operator, evidence, instructions.
create table kmi_next.quality_ncr_characteristics (
  id uuid primary key default gen_random_uuid(),
  ncr_id uuid not null references kmi_next.quality_ncrs(id) on delete restrict,
  product_revision_id uuid not null references kmi_next.product_revisions(id),
  operation_no int not null check (operation_no > 0),
  characteristic_code text not null check (length(trim(characteristic_code)) > 0),
  feature text,
  nominal numeric not null, tol_lower numeric not null, tol_upper numeric not null, check (tol_lower <= tol_upper),
  measured numeric not null,
  oversize_excess numeric generated always as (measured - (nominal + tol_upper)) stored,
  unit text not null default 'mm',
  qty numeric not null check (qty > 0),
  machine_id uuid references kmi_next.machines(id), tool_id uuid references kmi_next.tools(id), operator_id uuid references kmi_next.personnel(id),
  evidence_ref text, instructions text,
  recorded_by uuid not null default auth.uid(), recorded_at timestamptz not null default now(),
  check (measured > nominal + tol_upper)            -- TAHSİS is for OVERSIZE only; an undersize or in-tolerance value is not a TAHSİS record
);
alter table kmi_next.quality_ncr_characteristics enable row level security;
create policy kmi_next_ncr_chars_read on kmi_next.quality_ncr_characteristics for select to authenticated using (true);
grant select on kmi_next.quality_ncr_characteristics to authenticated;

create or replace function kmi_next.ncr_characteristics_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'NCR_CHARACTERISTICS_APPEND_ONLY' using errcode = '42501'; end; $$;
create trigger ncr_characteristics_no_update before update or delete on kmi_next.quality_ncr_characteristics for each row execute function kmi_next.ncr_characteristics_immutable();

-- Open a TAHSİS case: the existing open_quality_ncr does the quantity/hold work; this only classifies it.
create or replace function kmi_next.open_tahsis_ncr(p_work_order_id uuid, p_qty numeric, p_reason text, p_detection_source text, p_client_request_id text default null)
returns kmi_next.quality_ncrs language plpgsql security definer set search_path = '' as $$
declare v_ncr kmi_next.quality_ncrs;
begin
  if p_detection_source is null or p_detection_source not in ('OPERATOR_SELF_DECLARED','QUALITY_DETECTED') then raise exception 'DETECTION_SOURCE_REQUIRED' using errcode = '22000'; end if;
  v_ncr := kmi_next.open_quality_ncr(p_work_order_id, p_qty, p_reason, p_client_request_id);   -- QUALITY_REJECT gate, qty, hold, audit
  update kmi_next.quality_ncrs set kind = 'TAHSIS', detection_source = p_detection_source where id = v_ncr.id and kind = 'NONCONFORMANCE' returning * into v_ncr;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, after_state)
    values (auth.uid(), 'TAHSIS_OPENED', 'WORK_ORDER', p_work_order_id::text, p_reason, to_jsonb(v_ncr));
  return v_ncr;
end; $$;

create or replace function kmi_next.add_tahsis_characteristic(p_ncr_id uuid, p_product_revision_id uuid, p_operation_no int, p_characteristic_code text, p_feature text,
  p_nominal numeric, p_tol_lower numeric, p_tol_upper numeric, p_measured numeric, p_qty numeric, p_machine_id uuid, p_tool_id uuid, p_operator_id uuid, p_evidence_ref text, p_instructions text)
returns kmi_next.quality_ncr_characteristics language plpgsql security definer set search_path = '' as $$
declare v_ncr kmi_next.quality_ncrs; v_row kmi_next.quality_ncr_characteristics; v_sum numeric;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not kmi_next.authorize_critical_action('QUALITY_REJECT') then raise exception 'FORBIDDEN: QUALITY_REJECT' using errcode = '42501'; end if;
  select * into v_ncr from kmi_next.quality_ncrs where id = p_ncr_id for update;
  if v_ncr.id is null then raise exception 'NCR_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ncr.kind <> 'TAHSIS' then raise exception 'NOT_A_TAHSIS_CASE' using errcode = '22000'; end if;
  if v_ncr.status not in ('OPEN','REWORK') then raise exception 'NCR_NOT_EDITABLE_IN_STATUS: %', v_ncr.status using errcode = '22000'; end if;
  if p_qty > v_ncr.qty then raise exception 'EXCEEDS_NCR_QTY' using errcode = '22000'; end if;
  insert into kmi_next.quality_ncr_characteristics (ncr_id, product_revision_id, operation_no, characteristic_code, feature, nominal, tol_lower, tol_upper, measured, qty, machine_id, tool_id, operator_id, evidence_ref, instructions)
    values (p_ncr_id, p_product_revision_id, p_operation_no, p_characteristic_code, p_feature, p_nominal, p_tol_lower, p_tol_upper, p_measured, p_qty, p_machine_id, p_tool_id, p_operator_id, p_evidence_ref, p_instructions)
    returning * into v_row;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, after_state)
    values (auth.uid(), 'TAHSIS_CHARACTERISTIC_RECORDED', 'WORK_ORDER', v_ncr.work_order_id::text, p_characteristic_code, to_jsonb(v_row));
  return v_row;
end; $$;

revoke all on function kmi_next.open_tahsis_ncr(uuid, numeric, text, text, text) from public, anon;
revoke all on function kmi_next.add_tahsis_characteristic(uuid, uuid, int, text, text, numeric, numeric, numeric, numeric, numeric, uuid, uuid, uuid, text, text) from public, anon;
revoke all on function kmi_next.ncr_characteristics_immutable() from public, anon;
grant execute on function kmi_next.open_tahsis_ncr(uuid, numeric, text, text, text) to authenticated;
grant execute on function kmi_next.add_tahsis_characteristic(uuid, uuid, int, text, text, numeric, numeric, numeric, numeric, numeric, uuid, uuid, uuid, text, text) to authenticated;
commit;
