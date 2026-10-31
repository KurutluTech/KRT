-- Yerel test ortamı: m0183'ün dokunduğu canlı nesnelerin asgari kopyası. Yardımcı fonksiyonlar (rt_gate_revision,
-- rt_can_manage, pm_event, audit_log tetikleyicileri) canlıdaki tanımlarla aynı mantıkta.
create role anon nologin; create role authenticated nologin;
create schema auth; create schema kmi_next;
grant usage on schema kmi_next to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to public;

create table kmi_next.products (id uuid primary key, code text not null, name text not null);
create table kmi_next.product_revisions (id uuid primary key, product_id uuid not null references kmi_next.products, revision text not null, status text not null);
create table kmi_next.machines (id uuid primary key, code text not null, name text not null, status text not null default 'ACTIVE', is_pilot boolean not null default false);
create table kmi_next.routing_operations (id uuid primary key default gen_random_uuid(), product_revision_id uuid not null, op_no int not null, name text not null, active boolean not null default true, cam_program_id uuid);
create table kmi_next.documents (id uuid primary key, doc_type text not null, title text not null, entity_type text not null, entity_id uuid not null, status text not null default 'ACTIVE');
create table kmi_next.document_versions (id uuid primary key default gen_random_uuid(), document_id uuid not null, version_no int not null, file_name text);
create table kmi_next.document_op_links (document_id uuid not null, op_no int not null, active boolean not null default true, primary key (document_id, op_no));
create table kmi_next.cam_programs (id uuid primary key, product_revision_id uuid not null, program_no text not null, revision text not null, status text not null, routing_operation_id uuid);
create table kmi_next.skill_catalog (code text primary key, name text not null, category text not null, active boolean not null default true);
create table kmi_next.work_orders (id uuid primary key, product_revision_id uuid, status text);
create table kmi_next.product_events (id bigserial primary key, product_id uuid not null, revision_id uuid, event text not null, reason text, before_state jsonb, after_state jsonb, actor_user_id uuid not null, at timestamptz not null default now());
create table kmi_next.audit_log (id uuid primary key default gen_random_uuid(), at timestamptz not null default now(), actor_user_id uuid not null, action text not null, entity_type text not null, entity_id text not null, reason text, before_state jsonb, after_state jsonb, role_context text[], correlation_id uuid, outcome text not null default 'SUCCESS', occurred_at timestamptz);
create function kmi_next.audit_no_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_append_only before delete or update on kmi_next.audit_log for each row execute function kmi_next.audit_no_mutation();
alter table kmi_next.audit_log enable row level security; alter table kmi_next.product_events enable row level security;
revoke all on all tables in schema kmi_next from public, anon, authenticated;

create table kmi_next.test_grants (uid uuid, action text);
create function kmi_next.authorize_critical_action(p_action_code text) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from kmi_next.test_grants g where g.uid = auth.uid() and g.action = p_action_code) $$;
create function kmi_next.product_visible(p_product uuid) returns boolean language sql stable security definer set search_path to '' as $$ select true $$;
-- canlıdaki tanımlar:
create function kmi_next.rt_can_manage() returns boolean language plpgsql stable security definer set search_path to '' as $$
begin return auth.uid() is not null and kmi_next.authorize_critical_action('ROUTING_MANAGE'); end $$;
create function kmi_next.rt_gate_revision(p_rev uuid, p_write boolean) returns kmi_next.product_revisions language plpgsql stable security definer set search_path to '' as $$
declare r kmi_next.product_revisions;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select * into r from kmi_next.product_revisions where id = p_rev;
  if not found or not kmi_next.product_visible(r.product_id) then raise exception 'REVISION_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_write then
    if not kmi_next.rt_can_manage() then raise exception 'FORBIDDEN: ROUTING_MANAGE' using errcode = '42501'; end if;
    if r.status = 'OBSOLETE' then raise exception 'REVISION_OBSOLETE: eski revizyonun rotası değiştirilemez' using errcode = '22000'; end if;
  end if;
  return r;
end $$;
create function kmi_next.pm_event(p_product uuid, p_rev uuid, p_event text, p_reason text, p_before jsonb, p_after jsonb) returns void language sql security definer set search_path to '' as $$
  insert into kmi_next.product_events (product_id, revision_id, event, reason, before_state, after_state, actor_user_id) values (p_product, p_rev, p_event, p_reason, p_before, p_after, auth.uid()) $$;

-- Veri: canlıya benzer Y150NSM01-F Rev A (yalnız OP30 rotada) + başka ürün
insert into kmi_next.products values ('10000000-0000-0000-0000-000000000001','Y150NSM01-F','M3000 NAMLU BASLIGI'), ('10000000-0000-0000-0000-000000000002','BASKA','Başka ürün');
insert into kmi_next.product_revisions values ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','A','RELEASED'),
  ('20000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-000000000002','A','RELEASED'), ('20000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-000000000001','Z','OBSOLETE');
insert into kmi_next.machines values ('30000000-0000-0000-0000-000000000109','109','Haas 109','ACTIVE',false), ('30000000-0000-0000-0000-000000000999','P9','Pilot','ACTIVE',true);
insert into kmi_next.cam_programs values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a','1453.nc','v1','RELEASED',null),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-00000000000a','1453_EXCELE.nc','v2','RELEASED',null), ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-00000000000b','other.nc','v1','RELEASED',null);
insert into kmi_next.routing_operations (product_revision_id, op_no, name, cam_program_id) values ('20000000-0000-0000-0000-00000000000a', 30, 'OP30', '40000000-0000-0000-0000-000000000002');
insert into kmi_next.documents values
 ('50000000-0000-0000-0000-000000000001','DRAWING','Teknik resim','PRODUCT_REVISION','20000000-0000-0000-0000-00000000000a','ACTIVE'),
 ('50000000-0000-0000-0000-000000000002','CAD_MODEL','STEP','PRODUCT_REVISION','20000000-0000-0000-0000-00000000000a','ACTIVE'),
 ('50000000-0000-0000-0000-000000000003','ASSET_PHOTO','Foto','PRODUCT','10000000-0000-0000-0000-000000000001','ACTIVE'),
 ('50000000-0000-0000-0000-000000000004','NC_PROGRAM','OP30','PRODUCT_REVISION','20000000-0000-0000-0000-00000000000a','ACTIVE'),
 ('50000000-0000-0000-0000-000000000005','TOOL_LIST','Takım listesi','PRODUCT_REVISION','20000000-0000-0000-0000-00000000000a','ACTIVE'),
 ('50000000-0000-0000-0000-000000000006','DRAWING','Başka ürün resmi','PRODUCT_REVISION','20000000-0000-0000-0000-00000000000b','ACTIVE'),
 ('50000000-0000-0000-0000-000000000007','DRAWING','Geri çekilmiş','PRODUCT_REVISION','20000000-0000-0000-0000-00000000000a','WITHDRAWN');
insert into kmi_next.document_versions (document_id, version_no, file_name) values ('50000000-0000-0000-0000-000000000004',1,'1453.nc'),('50000000-0000-0000-0000-000000000004',2,'1453_EXCELE.nc');
insert into kmi_next.document_op_links values ('50000000-0000-0000-0000-000000000004', 30, true);
insert into kmi_next.skill_catalog values ('CNC_MILL','CNC freze','CNC',true), ('SAW','Testere','HAZIRLIK',true), ('OLD','Eski','X',false);
insert into kmi_next.work_orders values ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-00000000000a','ON_HOLD');
-- kullanıcılar: E editör (ROUTING_MANAGE), A onaylayıcı (PRODUCT_REV_APPROVE), V yalnız okuyan
insert into kmi_next.test_grants values ('e0000000-0000-0000-0000-00000000000e','ROUTING_MANAGE'), ('a0000000-0000-0000-0000-00000000000a','PRODUCT_REV_APPROVE');
