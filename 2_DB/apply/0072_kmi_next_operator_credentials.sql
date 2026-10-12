-- 0072 — Operator sicil + rozet/QR + kişisel PIN kimlik bilgileri (e-posta gerektirmez).
-- Güvenlik modeli: PIN yalnız bcrypt özeti olarak saklanır; rozet sırrı yalnız sha256 özeti olarak saklanır ve
-- rozet TEK BAŞINA yetki vermez (PIN şart). Doğrulama yalnız service_role çağrısıyla (Edge Function) yapılır.
-- Yönetim işlemleri mevcut PERSONNEL_LOGIN_LINK (ADMIN) yetkisini kullanır; rol matrisi değişmez.
-- Geri alma: 0072_rollback notu dosyanın sonundadır. Canlıya UYGULANMADI.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table kmi_next.operator_credentials (
  personnel_id uuid primary key references kmi_next.personnel(id),
  pin_hash text not null,
  pin_set_by uuid not null,
  pin_set_at timestamptz not null default now(),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  active boolean not null default true,
  deactivated_at timestamptz,
  deactivated_by uuid
);
create table kmi_next.operator_badges (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references kmi_next.personnel(id),
  badge_hash text not null unique,
  label text,
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);
create unique index operator_badges_one_active on kmi_next.operator_badges(personnel_id) where revoked_at is null;
create table kmi_next.operator_login_attempts (
  id bigserial primary key,
  identifier text not null,
  personnel_id uuid,
  outcome text not null check (outcome in ('SUCCESS','INVALID_CREDENTIALS','ACCOUNT_LOCKED','RATE_LIMITED')),
  at timestamptz not null default now()
);
create index operator_login_attempts_idx on kmi_next.operator_login_attempts(identifier, at);
create trigger operator_login_attempts_append_only before update or delete on kmi_next.operator_login_attempts
  for each row execute function kmi_next.append_only_guard();

alter table kmi_next.operator_credentials enable row level security;
alter table kmi_next.operator_badges enable row level security;
alter table kmi_next.operator_login_attempts enable row level security;
revoke all on kmi_next.operator_credentials, kmi_next.operator_badges, kmi_next.operator_login_attempts from public, anon, authenticated;
-- İstemci politikası yok: tablolar yalnız aşağıdaki SECURITY DEFINER fonksiyonlarla erişilir.

-- ---- yönetici işlemleri ------------------------------------------------------------------------
create or replace function kmi_next.set_operator_pin(p_personnel_id uuid, p_pin text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p kmi_next.personnel; v_existing boolean;
begin
  if not kmi_next.authorize_critical_action('PERSONNEL_LOGIN_LINK') then raise exception 'FORBIDDEN: PERSONNEL_LOGIN_LINK' using errcode = '42501'; end if;
  select * into v_p from kmi_next.personnel where id = p_personnel_id for update;
  if not found then raise exception 'PERSONNEL_NOT_FOUND' using errcode = 'P0002'; end if;
  if not v_p.active then raise exception 'PERSONNEL_INACTIVE' using errcode = '22000'; end if;
  if v_p.employee_no is null or length(trim(v_p.employee_no)) = 0 then raise exception 'EMPLOYEE_NO_REQUIRED' using errcode = '22000'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then raise exception 'PIN_POLICY: 6 rakam' using errcode = '22000'; end if;
  if p_pin ~ '^(.)\1{5}$' or position(p_pin in '0123456789012345') > 0 or position(p_pin in '9876543210987654') > 0 then
    raise exception 'PIN_POLICY: ardışık/aynı rakam' using errcode = '22000';
  end if;
  select exists (select 1 from kmi_next.operator_credentials where personnel_id = p_personnel_id) into v_existing;
  if v_existing and (p_reason is null or length(trim(p_reason)) < 5) then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  insert into kmi_next.operator_credentials (personnel_id, pin_hash, pin_set_by)
    values (p_personnel_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), auth.uid())
    on conflict (personnel_id) do update set pin_hash = excluded.pin_hash, pin_set_by = excluded.pin_set_by, pin_set_at = now(),
      failed_attempts = 0, locked_until = null, active = true, deactivated_at = null, deactivated_by = null;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), case when v_existing then 'OPERATOR_PIN_RESET' else 'OPERATOR_PIN_SET' end, 'PERSONNEL', p_personnel_id::text,
            null, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('personnel_id', p_personnel_id, 'reset', v_existing);
end; $$;

create or replace function kmi_next.issue_operator_badge(p_personnel_id uuid, p_label text default null, p_replace boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_p kmi_next.personnel; v_secret text; v_active uuid;
begin
  if not kmi_next.authorize_critical_action('PERSONNEL_LOGIN_LINK') then raise exception 'FORBIDDEN: PERSONNEL_LOGIN_LINK' using errcode = '42501'; end if;
  select * into v_p from kmi_next.personnel where id = p_personnel_id for update;
  if not found then raise exception 'PERSONNEL_NOT_FOUND' using errcode = 'P0002'; end if;
  if not v_p.active then raise exception 'PERSONNEL_INACTIVE' using errcode = '22000'; end if;
  select id into v_active from kmi_next.operator_badges where personnel_id = p_personnel_id and revoked_at is null;
  if v_active is not null then
    if not coalesce(p_replace, false) then raise exception 'BADGE_EXISTS' using errcode = '23505'; end if;
    update kmi_next.operator_badges set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'REPLACED' where id = v_active;
  end if;
  v_secret := 'KMI-B-' || encode(extensions.gen_random_bytes(18), 'hex');
  insert into kmi_next.operator_badges (personnel_id, badge_hash, label, issued_by)
    values (p_personnel_id, encode(sha256(convert_to(v_secret, 'UTF8')), 'hex'), p_label, auth.uid());
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), 'OPERATOR_BADGE_ISSUED', 'PERSONNEL', p_personnel_id::text, null, jsonb_build_object('replaced', v_active is not null, 'label', p_label));
  return v_secret; -- yalnız bu çağrıda görülür; veritabanında düz metin yoktur
end; $$;

create or replace function kmi_next.revoke_operator_badge(p_badge_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v kmi_next.operator_badges;
begin
  if not kmi_next.authorize_critical_action('PERSONNEL_LOGIN_LINK') then raise exception 'FORBIDDEN: PERSONNEL_LOGIN_LINK' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  update kmi_next.operator_badges set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
    where id = p_badge_id and revoked_at is null returning * into v;
  if not found then raise exception 'BADGE_NOT_FOUND_OR_REVOKED' using errcode = 'P0002'; end if;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), 'OPERATOR_BADGE_REVOKED', 'PERSONNEL', v.personnel_id::text, null, jsonb_build_object('reason', p_reason));
end; $$;

create or replace function kmi_next.deactivate_operator_access(p_personnel_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not kmi_next.authorize_critical_action('PERSONNEL_LOGIN_LINK') then raise exception 'FORBIDDEN: PERSONNEL_LOGIN_LINK' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  update kmi_next.operator_credentials set active = false, deactivated_at = now(), deactivated_by = auth.uid() where personnel_id = p_personnel_id;
  if not found then raise exception 'CREDENTIAL_NOT_FOUND' using errcode = 'P0002'; end if;
  update kmi_next.operator_badges set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'ACCESS_DEACTIVATED' where personnel_id = p_personnel_id and revoked_at is null;
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
    values (auth.uid(), 'OPERATOR_ACCESS_DEACTIVATED', 'PERSONNEL', p_personnel_id::text, null, jsonb_build_object('reason', p_reason));
end; $$;

create or replace function kmi_next.operator_credentials_overview()
returns table (personnel_id uuid, employee_no text, name text, personnel_active boolean, has_pin boolean, access_active boolean,
               locked_until timestamptz, active_badge_id uuid, badge_issued_at timestamptz, linked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not kmi_next.authorize_critical_action('PERSONNEL_LOGIN_LINK') then raise exception 'FORBIDDEN: PERSONNEL_LOGIN_LINK' using errcode = '42501'; end if;
  return query
    select p.id, p.employee_no, p.name, p.active, c.personnel_id is not null, coalesce(c.active, false),
           case when c.locked_until > now() then c.locked_until end, b.id, b.issued_at, p.auth_user_id is not null
      from kmi_next.personnel p
      left join kmi_next.operator_credentials c on c.personnel_id = p.id
      left join kmi_next.operator_badges b on b.personnel_id = p.id and b.revoked_at is null
     where p.active order by p.employee_no nulls last, p.name;
end; $$;

-- ---- yalnız service_role (Edge Function) -------------------------------------------------------
-- Genel hata: kullanıcı bulunamadı / PIN yanlış / rozet iptal / pasif — hepsi INVALID_CREDENTIALS.
create or replace function kmi_next.operator_verify(p_employee_no text, p_badge_secret text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_no text := nullif(lower(trim(coalesce(p_employee_no, ''))), '');
  v_bh text := case when p_badge_secret is null or length(p_badge_secret) = 0 then null else encode(sha256(convert_to(p_badge_secret, 'UTF8')), 'hex') end;
  v_ident text; v_pid uuid; v_bpid uuid; v_cred kmi_next.operator_credentials; v_p kmi_next.personnel;
  v_ok boolean; v_fail int;
  procedure_dummy text;
begin
  if v_no is null and v_bh is null then return jsonb_build_object('ok', false, 'code', 'INVALID_CREDENTIALS'); end if;
  v_ident := coalesce(v_no, 'badge:' || left(v_bh, 12));
  select count(*) into v_fail from kmi_next.operator_login_attempts
    where identifier = v_ident and outcome <> 'SUCCESS' and at > now() - interval '10 minutes';
  if v_fail >= 10 then
    insert into kmi_next.operator_login_attempts (identifier, outcome) values (v_ident, 'RATE_LIMITED');
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;
  if v_no is not null then select id into v_pid from kmi_next.personnel where lower(trim(employee_no)) = v_no and active; end if;
  if v_bh is not null then
    select b.personnel_id into v_bpid from kmi_next.operator_badges b join kmi_next.personnel p on p.id = b.personnel_id
      where b.badge_hash = v_bh and b.revoked_at is null and p.active;
    if v_bpid is null or (v_pid is not null and v_pid <> v_bpid) or (v_pid is null and v_no is not null) then v_pid := null; v_bpid := null;
    else v_pid := v_bpid; end if;
  end if;
  if v_pid is not null then select * into v_cred from kmi_next.operator_credentials where personnel_id = v_pid and active; end if;
  if v_pid is null or v_cred.personnel_id is null or p_pin is null or p_pin !~ '^[0-9]{6}$' then
    procedure_dummy := extensions.crypt(coalesce(p_pin, 'x'), extensions.gen_salt('bf', 10)); -- zamanlama farkını azalt
    insert into kmi_next.operator_login_attempts (identifier, personnel_id, outcome) values (v_ident, v_pid, 'INVALID_CREDENTIALS');
    return jsonb_build_object('ok', false, 'code', 'INVALID_CREDENTIALS');
  end if;
  v_ok := extensions.crypt(p_pin, v_cred.pin_hash) = v_cred.pin_hash;
  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    insert into kmi_next.operator_login_attempts (identifier, personnel_id, outcome) values (v_ident, v_pid, case when v_ok then 'ACCOUNT_LOCKED' else 'INVALID_CREDENTIALS' end);
    return jsonb_build_object('ok', false, 'code', case when v_ok then 'ACCOUNT_LOCKED' else 'INVALID_CREDENTIALS' end);
  end if;
  if not v_ok then
    update kmi_next.operator_credentials
      set locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end,
          failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end
      where personnel_id = v_pid;
    insert into kmi_next.operator_login_attempts (identifier, personnel_id, outcome) values (v_ident, v_pid, 'INVALID_CREDENTIALS');
    return jsonb_build_object('ok', false, 'code', 'INVALID_CREDENTIALS');
  end if;
  update kmi_next.operator_credentials set failed_attempts = 0, locked_until = null where personnel_id = v_pid;
  insert into kmi_next.operator_login_attempts (identifier, personnel_id, outcome) values (v_ident, v_pid, 'SUCCESS');
  select * into v_p from kmi_next.personnel where id = v_pid;
  return jsonb_build_object('ok', true, 'personnel_id', v_p.id, 'auth_user_id', v_p.auth_user_id, 'name', v_p.name,
                            'employee_no', v_p.employee_no, 'roles', to_jsonb(v_p.roles));
end; $$;

create or replace function kmi_next.operator_bind_auth_user(p_personnel_id uuid, p_auth_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_cur uuid;
begin
  if not exists (select 1 from kmi_next.operator_credentials where personnel_id = p_personnel_id and active) then raise exception 'CREDENTIAL_NOT_ENROLLED' using errcode = '22000'; end if;
  select auth_user_id into v_cur from kmi_next.personnel where id = p_personnel_id for update;
  if v_cur is not null and v_cur <> p_auth_user_id then raise exception 'LOGIN_ALREADY_LINKED' using errcode = '23505'; end if;
  if v_cur is null then
    if exists (select 1 from kmi_next.personnel where auth_user_id = p_auth_user_id) then raise exception 'LOGIN_ALREADY_LINKED' using errcode = '23505'; end if;
    update kmi_next.personnel set auth_user_id = p_auth_user_id, updated_at = now() where id = p_personnel_id;
    insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, before_state, after_state)
      values (p_auth_user_id, 'OPERATOR_AUTH_BOUND', 'PERSONNEL', p_personnel_id::text, null, jsonb_build_object('auth_user_id', p_auth_user_id));
  end if;
end; $$;

revoke all on function kmi_next.set_operator_pin(uuid, text, text), kmi_next.issue_operator_badge(uuid, text, boolean),
  kmi_next.revoke_operator_badge(uuid, text), kmi_next.deactivate_operator_access(uuid, text), kmi_next.operator_credentials_overview(),
  kmi_next.operator_verify(text, text, text), kmi_next.operator_bind_auth_user(uuid, uuid) from public, anon, authenticated;
grant execute on function kmi_next.set_operator_pin(uuid, text, text), kmi_next.issue_operator_badge(uuid, text, boolean),
  kmi_next.revoke_operator_badge(uuid, text), kmi_next.deactivate_operator_access(uuid, text), kmi_next.operator_credentials_overview() to authenticated;
grant execute on function kmi_next.operator_verify(text, text, text), kmi_next.operator_bind_auth_user(uuid, uuid) to service_role;

-- Geri alma (manuel): drop function kmi_next.operator_bind_auth_user, operator_verify, operator_credentials_overview,
-- deactivate_operator_access, revoke_operator_badge, issue_operator_badge, set_operator_pin; drop table kmi_next.operator_login_attempts,
-- kmi_next.operator_badges, kmi_next.operator_credentials. (Audit kayıtları silinmez.)
