-- DRAFT 0078 — Cost Intelligence foundation (Item 36, KMI-COST-INTELLIGENCE-001 Phase 1): expense catalog, cost centers, period control, Excel/CSV STAGING with approval,
-- canonical expenses (append-only, idempotent, reversal/adjustment only), allocations with a double-allocation guard.
-- NOT APPLIED ANYWHERE. Additive. Rollback: 0078_rollback.sql. Reads: economic access (kmi_next.can_view_economics, 0028). Writes: only through the RPCs below.
-- This is NOT a second ledger: it holds management cost facts (expenses, allocations) that have no canonical home today; stock, production and machine truth stay where they are.
-- OWNER DECISIONS STILL OPEN (see docs/directive001/KMI_COST_*): allocation driver policy, valuation policy, who approves imports (drafted: the economic OWNER only; preparer = accounting + economic access).
begin;

create table kmi_next.cost_categories (
  code text primary key check (code = upper(code)),
  name_tr text not null,
  behaviour text not null check (behaviour in ('FIXED','VARIABLE','SEMI_VARIABLE')),
  traceability text not null check (traceability in ('DIRECT','INDIRECT')),
  capital boolean not null default false,
  active boolean not null default true
);
insert into kmi_next.cost_categories (code, name_tr, behaviour, traceability, capital) values
 ('KIRA','Fabrika kirası','FIXED','INDIRECT',false), ('MAAS','Maaş ve ücretler','SEMI_VARIABLE','DIRECT',false), ('SGK_ISVEREN','İşveren sosyal güvenlik payı','SEMI_VARIABLE','DIRECT',false),
 ('FAZLA_MESAI','Fazla mesai ve vardiya primi','VARIABLE','DIRECT',false), ('PRIM','Onaylı prim gideri','VARIABLE','DIRECT',false), ('ELEKTRIK','Elektrik','SEMI_VARIABLE','INDIRECT',false),
 ('DOGALGAZ','Doğalgaz','SEMI_VARIABLE','INDIRECT',false), ('SU','Su','SEMI_VARIABLE','INDIRECT',false), ('BASINCLI_HAVA','Basınçlı hava','SEMI_VARIABLE','INDIRECT',false),
 ('AMORTISMAN_MAKINE','Makine amortismanı','FIXED','DIRECT',false), ('AMORTISMAN_BINA','Bina ve ekipman amortismanı','FIXED','INDIRECT',false), ('LEASING','Leasing ve finansman','FIXED','INDIRECT',false),
 ('BAKIM','Makine bakımı','SEMI_VARIABLE','DIRECT',false), ('YEDEK_PARCA','Yedek parça','VARIABLE','DIRECT',false), ('TAKIM','Kesici takım, kesici uç, tutucu','VARIABLE','DIRECT',false),
 ('HAMMADDE','Hammadde','VARIABLE','DIRECT',false), ('FASON','Fason işleme','VARIABLE','DIRECT',false), ('KALITE_METROLOJI','Kalite ve metroloji','SEMI_VARIABLE','INDIRECT',false),
 ('SARF_YAGLAMA','Sarf malzeme ve yağlama','VARIABLE','DIRECT',false), ('YAZILIM_ABONELIK','Yazılım ve abonelikler','FIXED','INDIRECT',false), ('LOJISTIK_PAKET','Lojistik ve ambalaj','VARIABLE','DIRECT',false),
 ('SIGORTA','Sigorta','FIXED','INDIRECT',false), ('VERGI_HARC','Vergi ve harçlar','FIXED','INDIRECT',false), ('IDARI_GENEL','İdari genel gider','FIXED','INDIRECT',false),
 ('OFIS','Ofis giderleri','FIXED','INDIRECT',false), ('DIGER','Diğer onaylı gider','SEMI_VARIABLE','INDIRECT',false), ('YATIRIM_MAKINE','Makine yatırımı (sermaye — gider değil)','FIXED','DIRECT',true);

create table kmi_next.cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('FACTORY','DEPARTMENT','MACHINE','WORKSTATION')),
  parent_id uuid references kmi_next.cost_centers(id),
  machine_id uuid references kmi_next.machines(id),
  active boolean not null default true,
  check ((kind = 'MACHINE') = (machine_id is not null))
);
create unique index cost_centers_one_per_machine on kmi_next.cost_centers (machine_id) where machine_id is not null;   -- machines 111 and 113 stay distinct assets

create table kmi_next.cost_periods (
  period text primary key check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  closed_by uuid, closed_at timestamptz, note text,
  check (status = 'OPEN' or (closed_by is not null and closed_at is not null))
);

create table kmi_next.cost_import_batches (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  source_name text not null, locale text not null check (locale in ('TR','EN')),
  status text not null default 'STAGED' check (status in ('STAGED','APPROVED','REJECTED')),
  row_count int not null, ok_count int not null, error_count int not null,
  staged_by uuid not null default auth.uid(), staged_at timestamptz not null default now(),
  decided_by uuid, decided_at timestamptz, decision_note text
);
create table kmi_next.cost_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references kmi_next.cost_import_batches(id) on delete restrict,
  row_no int not null, ok boolean not null, issues jsonb not null default '[]', values jsonb not null,
  unique (batch_id, row_no)
);

create table kmi_next.cost_expenses (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'ENTRY' check (kind in ('ENTRY','ADJUSTMENT','REVERSAL')),
  category_code text not null references kmi_next.cost_categories(code),
  amount numeric not null check (amount <> 0),
  currency text not null check (currency in ('TRY','EUR','USD','GBP')),
  service_start date not null, service_end date not null, check (service_end >= service_start),
  payment_date date,
  tax_treatment text not null default 'EXCLUSIVE' check (tax_treatment in ('EXCLUSIVE','INCLUSIVE_RECOVERABLE','INCLUSIVE_NON_RECOVERABLE')),
  cost_center_id uuid references kmi_next.cost_centers(id),
  document_ref text, description text,
  fingerprint text,
  import_batch_id uuid references kmi_next.cost_import_batches(id),
  reversal_of uuid references kmi_next.cost_expenses(id),
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  check ((kind = 'REVERSAL') = (reversal_of is not null))
);
create unique index cost_expenses_fingerprint_uniq on kmi_next.cost_expenses (fingerprint) where fingerprint is not null and kind = 'ENTRY';   -- idempotent re-import
create unique index cost_expenses_one_reversal on kmi_next.cost_expenses (reversal_of) where reversal_of is not null;

create table kmi_next.cost_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references kmi_next.cost_expenses(id) on delete restrict,
  cost_center_id uuid not null references kmi_next.cost_centers(id),
  amount numeric not null check (amount > 0),
  driver text not null, rule_version int not null check (rule_version > 0),
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);

-- Closed period: no new ENTRY with a service start inside it — only ADJUSTMENT / REVERSAL (traceable), as the directive requires.
create or replace function kmi_next.cost_expense_period_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'ENTRY' and exists (select 1 from kmi_next.cost_periods p where p.period = to_char(new.service_start, 'YYYY-MM') and p.status = 'CLOSED') then
    raise exception 'PERIOD_CLOSED: % — use an ADJUSTMENT or REVERSAL', to_char(new.service_start, 'YYYY-MM') using errcode = '22000';
  end if;
  return new;
end; $$;
create trigger cost_expense_period_guard before insert on kmi_next.cost_expenses for each row execute function kmi_next.cost_expense_period_guard();

-- Double-allocation guard: total allocated for an expense can never exceed the expense amount (checked under lock).
create or replace function kmi_next.cost_allocation_guard() returns trigger language plpgsql set search_path = '' as $$
declare v_amt numeric; v_sum numeric;
begin
  select amount into v_amt from kmi_next.cost_expenses where id = new.expense_id for update;
  select coalesce(sum(amount), 0) into v_sum from kmi_next.cost_allocations where expense_id = new.expense_id;
  if v_amt is null or v_amt <= 0 then raise exception 'EXPENSE_NOT_ALLOCATABLE' using errcode = '22000'; end if;
  if v_sum + new.amount > v_amt then raise exception 'DOUBLE_ALLOCATION: allocated % + % > expense %', v_sum, new.amount, v_amt using errcode = '22000'; end if;
  return new;
end; $$;
create trigger cost_allocation_guard before insert on kmi_next.cost_allocations for each row execute function kmi_next.cost_allocation_guard();

create trigger cost_expenses_append_only before update or delete on kmi_next.cost_expenses for each row execute function kmi_next.append_only_guard();
create trigger cost_allocations_append_only before update or delete on kmi_next.cost_allocations for each row execute function kmi_next.append_only_guard();
create trigger cost_import_rows_append_only before update or delete on kmi_next.cost_import_rows for each row execute function kmi_next.append_only_guard();

do $$ declare t text; begin
  foreach t in array array['cost_categories','cost_centers','cost_periods','cost_import_batches','cost_import_rows','cost_expenses','cost_allocations'] loop
    execute format('alter table kmi_next.%I enable row level security', t);
    execute format('create policy kmi_next_%s_read on kmi_next.%I for select to authenticated using (kmi_next.can_view_economics())', t, t);
    execute format('grant select on kmi_next.%I to authenticated', t);
  end loop;
end $$;

-- Staging: accounting + economic access. Nothing becomes an expense here.
create or replace function kmi_next.stage_cost_import(p_source text, p_locale text, p_fingerprint text, p_rows jsonb) returns kmi_next.cost_import_batches
language plpgsql security definer set search_path = '' as $$
declare b kmi_next.cost_import_batches; r jsonb; n int := 0; ok_n int := 0;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not (kmi_next.can_view_economics() and kmi_next.authorize_critical_action('ACCOUNTING_MUTATION')) then raise exception 'FORBIDDEN: COST_IMPORT_STAGE' using errcode = '42501'; end if;
  if p_source is null or length(trim(p_source)) < 3 or p_locale not in ('TR','EN') or p_fingerprint is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'INVALID_IMPORT' using errcode = '22000'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'IMPORT_TOO_LARGE' using errcode = '22000'; end if;
  select * into b from kmi_next.cost_import_batches where fingerprint = p_fingerprint;
  if found then return b; end if;                                              -- same file content staged twice -> same batch (idempotent)
  for r in select * from jsonb_array_elements(p_rows) loop n := n + 1; if (r->>'ok')::boolean then ok_n := ok_n + 1; end if; end loop;
  insert into kmi_next.cost_import_batches (fingerprint, source_name, locale, row_count, ok_count, error_count) values (p_fingerprint, trim(p_source), p_locale, n, ok_n, n - ok_n) returning * into b;
  n := 0; for r in select * from jsonb_array_elements(p_rows) loop n := n + 1;
    insert into kmi_next.cost_import_rows (batch_id, row_no, ok, issues, values) values (b.id, n, (r->>'ok')::boolean, coalesce(r->'issues', '[]'), r->'values'); end loop;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, after_state) values (auth.uid(), 'COST_IMPORT_STAGED', 'COST_IMPORT', b.id::text, b.source_name, to_jsonb(b));
  return b;
end; $$;

-- Approval: the economic OWNER only; preparer cannot approve their own batch. Only OK rows become expenses; duplicates (same fingerprint) are skipped, not overwritten.
create or replace function kmi_next.decide_cost_import(p_batch_id uuid, p_approve boolean, p_note text) returns kmi_next.cost_import_batches
language plpgsql security definer set search_path = '' as $$
declare b kmi_next.cost_import_batches; r kmi_next.cost_import_rows; v jsonb; fp text; v_new int := 0;
begin
  if not kmi_next.can_view_economics_owner_only() then raise exception 'FORBIDDEN: ECONOMIC_OWNER_ONLY' using errcode = '42501'; end if;
  if p_note is null or length(trim(p_note)) < 5 then raise exception 'NOTE_REQUIRED' using errcode = '22000'; end if;
  select * into b from kmi_next.cost_import_batches where id = p_batch_id for update;
  if b.id is null then raise exception 'BATCH_NOT_FOUND' using errcode = 'P0002'; end if;
  if b.status <> 'STAGED' then raise exception 'ALREADY_DECIDED' using errcode = '22000'; end if;
  if b.staged_by = auth.uid() then raise exception 'SELF_APPROVAL_NOT_ALLOWED' using errcode = '42501'; end if;
  if p_approve then
    for r in select * from kmi_next.cost_import_rows where batch_id = b.id and ok order by row_no loop
      v := r.values;
      fp := md5(concat_ws('|', upper(v->>'categoryCode'), v->>'amount', v->>'currency', v->>'periodStart', v->>'periodEnd', coalesce(v->>'documentRef', '')));
      insert into kmi_next.cost_expenses (category_code, amount, currency, service_start, service_end, document_ref, description, fingerprint, import_batch_id)
        values (upper(v->>'categoryCode'), (v->>'amount')::numeric, v->>'currency', (v->>'periodStart')::date, (v->>'periodEnd')::date, nullif(v->>'documentRef', ''), nullif(v->>'description', ''), fp, b.id)
        on conflict (fingerprint) where fingerprint is not null and kind = 'ENTRY' do nothing;
      if found then v_new := v_new + 1; end if;
    end loop;
  end if;
  update kmi_next.cost_import_batches set status = case when p_approve then 'APPROVED' else 'REJECTED' end, decided_by = auth.uid(), decided_at = now(), decision_note = trim(p_note) where id = b.id returning * into b;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, after_state) values (auth.uid(), case when p_approve then 'COST_IMPORT_APPROVED' else 'COST_IMPORT_REJECTED' end, 'COST_IMPORT', b.id::text, p_note, jsonb_build_object('batch', to_jsonb(b), 'new_expenses', v_new));
  return b;
end; $$;

create or replace function kmi_next.close_cost_period(p_period text, p_note text) returns kmi_next.cost_periods
language plpgsql security definer set search_path = '' as $$
declare p kmi_next.cost_periods;
begin
  if not kmi_next.can_view_economics_owner_only() then raise exception 'FORBIDDEN: ECONOMIC_OWNER_ONLY' using errcode = '42501'; end if;
  if p_note is null or length(trim(p_note)) < 5 then raise exception 'NOTE_REQUIRED' using errcode = '22000'; end if;
  insert into kmi_next.cost_periods (period, status, closed_by, closed_at, note) values (p_period, 'CLOSED', auth.uid(), now(), trim(p_note))
    on conflict (period) do update set status = 'CLOSED', closed_by = auth.uid(), closed_at = now(), note = trim(p_note) where kmi_next.cost_periods.status = 'OPEN' returning * into p;
  if p.period is null then raise exception 'PERIOD_ALREADY_CLOSED' using errcode = '22000'; end if;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, after_state) values (auth.uid(), 'COST_PERIOD_CLOSED', 'COST_PERIOD', p.period, p_note, to_jsonb(p));
  return p;
end; $$;

revoke all on function kmi_next.stage_cost_import(text, text, text, jsonb), kmi_next.decide_cost_import(uuid, boolean, text), kmi_next.close_cost_period(text, text),
  kmi_next.cost_expense_period_guard(), kmi_next.cost_allocation_guard() from public, anon;
grant execute on function kmi_next.stage_cost_import(text, text, text, jsonb), kmi_next.decide_cost_import(uuid, boolean, text), kmi_next.close_cost_period(text, text) to authenticated;
commit;
