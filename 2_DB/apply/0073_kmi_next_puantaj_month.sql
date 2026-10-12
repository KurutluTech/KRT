-- 0073 — Puantaj & Prim Havuzu: aylık girdiler, salt-okunur gerçek olgu RPC'si, havuz tutarı (ekonomik yetki), dönem kapanışı (değiştirilemez anlık görüntü).
-- V47 FORMÜLÜ BU DOSYADA YOKTUR VE DEĞİŞTİRİLMEDİ: hesap yalnız packages/domain/src/puantaj.ts (V47 portu) içindedir; SQL ikinci bir formül içermez.
-- SQL yalnız (1) kanonik olguları toplar, (2) elle girişleri gerekçeli/denetimli saklar, (3) kapanışta girdi+yapılandırma+sonucu dondurur (eski sistemin P0-2 açığı).
-- Havuz tutarı ekonomik veridir: yalnız kmi_next.can_view_economics() (D-007; bağlanana kadar kimse). Tutar yokken dağıtım yapılmaz.
-- Geri alma: fonksiyonlar ve puantaj_* tabloları düşürülür; audit kayıtları silinmez. Canlıya UYGULANMADI.
insert into kmi_next.critical_action (action_code) values ('PUANTAJ_MANAGE') on conflict do nothing;
insert into kmi_next.role_action_matrix (action_code, role_code) values ('PUANTAJ_MANAGE','ADMIN'), ('PUANTAJ_MANAGE','MANAGEMENT') on conflict do nothing;

create table kmi_next.puantaj_monthly_inputs (
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  personnel_id uuid not null references kmi_next.personnel(id),
  absence_days numeric check (absence_days between 0 and 31),
  care_factor numeric check (care_factor in (0, 1, 1.05, 1.2)),
  management_adjustment_percent numeric check (management_adjustment_percent between -50 and 50),
  is_winning_shift boolean,
  early_delivery_30 boolean,
  maintenance_closed_24h boolean,
  rank_kind text check (rank_kind in ('FIRST_TIME_NO1','TOP3_STREAK','NONE')),
  is_excluded boolean not null default false,
  updated_by uuid not null, updated_at timestamptz not null default now(),
  primary key (month, personnel_id)
);
create table kmi_next.puantaj_input_events (
  id bigint generated always as identity primary key,
  month text not null, personnel_id uuid not null,
  patch jsonb not null, before_state jsonb, reason text not null,
  actor_user_id uuid not null, at timestamptz not null default now()
);
create trigger puantaj_input_events_append_only before update or delete on kmi_next.puantaj_input_events for each row execute function kmi_next.append_only_guard();
create table kmi_next.puantaj_pool (
  month text primary key check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount numeric not null check (amount >= 0), currency text not null default 'TRY',
  set_by uuid not null, set_at timestamptz not null default now(), reason text not null
);
create table kmi_next.puantaj_period_locks (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  config_snapshot jsonb not null, inputs_snapshot jsonb not null, results jsonb not null,
  distribution jsonb, pool_amount numeric,
  locked_by uuid not null, locked_at timestamptz not null default now()
);
create trigger puantaj_period_locks_append_only before update or delete on kmi_next.puantaj_period_locks for each row execute function kmi_next.append_only_guard();
alter table kmi_next.puantaj_monthly_inputs enable row level security;
alter table kmi_next.puantaj_input_events enable row level security;
alter table kmi_next.puantaj_pool enable row level security;
alter table kmi_next.puantaj_period_locks enable row level security;
revoke all on kmi_next.puantaj_monthly_inputs, kmi_next.puantaj_input_events, kmi_next.puantaj_pool, kmi_next.puantaj_period_locks from public, anon, authenticated;

create or replace function kmi_next.puantaj_people_facts(p_month text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with bounds as (select (p_month || '-01')::date as d0, ((p_month || '-01')::date + interval '1 month')::date as d1),
  ops as (
    select o.operator_id,
           count(*) as n, coalesce(sum(o.qty_good),0) as good, coalesce(sum(o.qty_scrap),0) as scrap,
           coalesce(sum(extract(epoch from (o.run_finished_at - o.started_at)) / 60) filter (where o.run_finished_at is not null and o.started_at is not null), 0) as minutes,
           count(*) filter (where o.qc_result = 'FAIL') as qc_fail,
           coalesce(sum(w.qty_planned),0) as planned
      from kmi_next.work_order_operations o
      join kmi_next.work_orders w on w.id = o.work_order_id, bounds b
     where o.operator_id is not null and o.status = 'DONE' and o.completed_at >= b.d0 and o.completed_at < b.d1
     group by o.operator_id)
  select coalesce(jsonb_agg(jsonb_build_object(
    'personnelId', p.id, 'name', p.name, 'employeeNo', p.employee_no, 'department', p.department, 'roles', to_jsonb(p.roles),
    'personalMultiplier', p.puantaj_multiplier, 'shiftCode', p.shift_code,
    'multiMachineLevel', (select a.max_concurrent_machines from kmi_next.operator_multi_machine_authorizations a where a.person_id = p.id and a.revoked_at is null),
    'skillCount', (select count(*) from kmi_next.personnel_skills s, bounds b where s.personnel_id = p.id and (s.valid_until is null or s.valid_until >= b.d1 - 1)),
    'production', jsonb_build_object('operations', coalesce(x.n,0), 'good', coalesce(x.good,0), 'scrap', coalesce(x.scrap,0), 'minutes', round(coalesce(x.minutes,0)::numeric, 1),
                                     'qcFail', coalesce(x.qc_fail,0), 'plannedQty', coalesce(x.planned,0)),
    'manual', (select to_jsonb(m) - 'month' - 'personnel_id' - 'updated_by' from kmi_next.puantaj_monthly_inputs m where m.month = p_month and m.personnel_id = p.id)
  ) order by p.name), '[]'::jsonb)
  from kmi_next.personnel p left join ops x on x.operator_id = p.id where p.active;
$$;

create or replace function kmi_next.puantaj_month_facts(p_month text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_lock kmi_next.puantaj_period_locks; v_pool numeric; v_econ boolean := kmi_next.can_view_economics();
begin
  if not kmi_next.authorize_critical_action('PUANTAJ_MANAGE') then raise exception 'FORBIDDEN: PUANTAJ_MANAGE' using errcode = '42501'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH' using errcode = '22000'; end if;
  select * into v_lock from kmi_next.puantaj_period_locks where month = p_month;
  if v_econ then select amount into v_pool from kmi_next.puantaj_pool where month = p_month; end if;
  return jsonb_build_object('month', p_month, 'poolVisible', v_econ, 'poolAmount', case when v_econ then v_pool end,
    'locked', v_lock.id is not null,
    'lock', case when v_lock.id is null then null else jsonb_build_object('lockedAt', v_lock.locked_at, 'results', v_lock.results,
              'configSnapshot', v_lock.config_snapshot, 'distribution', case when v_econ then v_lock.distribution end,
              'poolAmount', case when v_econ then v_lock.pool_amount end) end,
    'people', kmi_next.puantaj_people_facts(p_month));
end; $$;

create or replace function kmi_next.set_puantaj_input(p_month text, p_personnel_id uuid, p_patch jsonb, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; k text;
  allowed text[] := array['absence_days','care_factor','management_adjustment_percent','is_winning_shift','early_delivery_30','maintenance_closed_24h','rank_kind','is_excluded'];
begin
  if not kmi_next.authorize_critical_action('PUANTAJ_MANAGE') then raise exception 'FORBIDDEN: PUANTAJ_MANAGE' using errcode = '42501'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH' using errcode = '22000'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then raise exception 'EMPTY_PATCH' using errcode = '22000'; end if;
  for k in select jsonb_object_keys(p_patch) loop if not (k = any(allowed)) then raise exception 'UNKNOWN_FIELD: %', k using errcode = '22000'; end if; end loop;
  if exists (select 1 from kmi_next.puantaj_period_locks where month = p_month) then raise exception 'PERIOD_CLOSED' using errcode = '22000'; end if;
  if not exists (select 1 from kmi_next.personnel where id = p_personnel_id and active) then raise exception 'PERSONNEL_NOT_FOUND' using errcode = 'P0002'; end if;
  select to_jsonb(m) into v_before from kmi_next.puantaj_monthly_inputs m where month = p_month and personnel_id = p_personnel_id;
  insert into kmi_next.puantaj_monthly_inputs (month, personnel_id, updated_by) values (p_month, p_personnel_id, auth.uid()) on conflict do nothing;
  update kmi_next.puantaj_monthly_inputs set
    absence_days = case when p_patch ? 'absence_days' then (p_patch->>'absence_days')::numeric else absence_days end,
    care_factor = case when p_patch ? 'care_factor' then (p_patch->>'care_factor')::numeric else care_factor end,
    management_adjustment_percent = case when p_patch ? 'management_adjustment_percent' then (p_patch->>'management_adjustment_percent')::numeric else management_adjustment_percent end,
    is_winning_shift = case when p_patch ? 'is_winning_shift' then (p_patch->>'is_winning_shift')::boolean else is_winning_shift end,
    early_delivery_30 = case when p_patch ? 'early_delivery_30' then (p_patch->>'early_delivery_30')::boolean else early_delivery_30 end,
    maintenance_closed_24h = case when p_patch ? 'maintenance_closed_24h' then (p_patch->>'maintenance_closed_24h')::boolean else maintenance_closed_24h end,
    rank_kind = case when p_patch ? 'rank_kind' then p_patch->>'rank_kind' else rank_kind end,
    is_excluded = case when p_patch ? 'is_excluded' then (p_patch->>'is_excluded')::boolean else is_excluded end,
    updated_by = auth.uid(), updated_at = now()
   where month = p_month and personnel_id = p_personnel_id;
  insert into kmi_next.puantaj_input_events (month, personnel_id, patch, before_state, reason, actor_user_id) values (p_month, p_personnel_id, p_patch, v_before, p_reason, auth.uid());
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), 'PUANTAJ_INPUT_SET', 'PERSONNEL', p_personnel_id::text, v_before, jsonb_build_object('month', p_month, 'patch', p_patch, 'reason', p_reason));
end; $$;

create or replace function kmi_next.set_puantaj_pool(p_month text, p_amount numeric, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before numeric;
begin
  if not kmi_next.can_view_economics() then raise exception 'FORBIDDEN: ECONOMICS' using errcode = '42501'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH' using errcode = '22000'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'INVALID_AMOUNT' using errcode = '22000'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  if exists (select 1 from kmi_next.puantaj_period_locks where month = p_month) then raise exception 'PERIOD_CLOSED' using errcode = '22000'; end if;
  select amount into v_before from kmi_next.puantaj_pool where month = p_month;
  insert into kmi_next.puantaj_pool (month, amount, set_by, reason) values (p_month, p_amount, auth.uid(), p_reason)
    on conflict (month) do update set amount = excluded.amount, set_by = excluded.set_by, set_at = now(), reason = excluded.reason;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), 'PUANTAJ_POOL_SET', 'PUANTAJ_MONTH', p_month, case when v_before is null then null else jsonb_build_object('amount', v_before) end, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end; $$;

-- Kapanış: hesap istemcideki V47 portundan gelir (SQL'de ikinci formül yok); girdiler SUNUCUDAN anlık görüntülenir.
-- Eksik veri varsa (results içinde status<>'COMPUTED' olan kişi) dağıtım KABUL EDİLMEZ.
create or replace function kmi_next.close_puantaj_period(p_month text, p_config jsonb, p_results jsonb, p_distribution jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_pool numeric; v_inc int; v_active int; v_listed int; v_sum numeric;
begin
  if not kmi_next.authorize_critical_action('PUANTAJ_MANAGE') then raise exception 'FORBIDDEN: PUANTAJ_MANAGE' using errcode = '42501'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'INVALID_MONTH' using errcode = '22000'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' or p_results is null or jsonb_typeof(p_results) <> 'array' then raise exception 'INVALID_PAYLOAD' using errcode = '22000'; end if;
  if exists (select 1 from kmi_next.puantaj_period_locks where month = p_month) then raise exception 'PERIOD_ALREADY_CLOSED' using errcode = '23505'; end if;
  select count(*) into v_active from kmi_next.personnel where active;
  select count(distinct r->>'personnelId') into v_listed from jsonb_array_elements(p_results) r where exists (select 1 from kmi_next.personnel p where p.active and p.id::text = r->>'personnelId');
  if v_listed <> v_active then raise exception 'RESULTS_INCOMPLETE: every active person must be listed' using errcode = '22000'; end if;
  select count(*) into v_inc from jsonb_array_elements(p_results) r where r->>'status' not in ('COMPUTED','EXCLUDED');
  if p_distribution is not null then
    if v_inc > 0 then raise exception 'DISTRIBUTION_REFUSED: missing data for % person(s)', v_inc using errcode = '22000'; end if;
    if not kmi_next.can_view_economics() then raise exception 'FORBIDDEN: ECONOMICS' using errcode = '42501'; end if;
    select amount into v_pool from kmi_next.puantaj_pool where month = p_month;
    if v_pool is null then raise exception 'POOL_NOT_SET' using errcode = '22000'; end if;
    select coalesce(sum((d->>'bonus')::numeric), 0) into v_sum from jsonb_array_elements(p_distribution) d;
    if abs(v_sum - v_pool) > 0.05 then raise exception 'DISTRIBUTION_SUM_MISMATCH' using errcode = '22000'; end if;
  end if;
  insert into kmi_next.puantaj_period_locks (month, config_snapshot, inputs_snapshot, results, distribution, pool_amount, locked_by)
    values (p_month, p_config, kmi_next.puantaj_people_facts(p_month), p_results, p_distribution, v_pool, auth.uid()) returning id into v_id;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), 'PUANTAJ_PERIOD_CLOSED', 'PUANTAJ_MONTH', p_month, null, jsonb_build_object('lock_id', v_id, 'incomplete', v_inc, 'distributed', p_distribution is not null));
  return v_id;
end; $$;

revoke all on function kmi_next.puantaj_people_facts(text) from public, anon, authenticated;
revoke all on function kmi_next.puantaj_month_facts(text), kmi_next.set_puantaj_input(text, uuid, jsonb, text), kmi_next.set_puantaj_pool(text, numeric, text),
  kmi_next.close_puantaj_period(text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function kmi_next.puantaj_month_facts(text), kmi_next.set_puantaj_input(text, uuid, jsonb, text), kmi_next.set_puantaj_pool(text, numeric, text),
  kmi_next.close_puantaj_period(text, jsonb, jsonb, jsonb) to authenticated;
