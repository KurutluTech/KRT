-- KMI / TOOL LIST (TAKIM LİSTESİ) CONTROL (0132). DRAFT — NOT APPLIED ANYWHERE. Production: owner approval required. Rollback: docs/KMI-PASSPORT/sql/rollback_0132.sql.
-- OWNER DECISION (2026-10-20 19:06, "KRİTİK GÜVENLİK KARARI"): the tool list is a STRICT revision-controlled group (with Technical Drawing, CAD/STEP, CAM/NC), each with its own independent revision history.
-- WHAT ALREADY EXISTED (0106, unchanged): TOOL_LIST is a controlled document type (draft -> in review -> approved -> effective), versions are append-only, the effective version is never overwritten,
--   reviewer/approver may not be the preparer (ADMIN self-approval only with a reason), publishing distributes the change to open work orders.
-- WHAT THIS ADDS (functions + 3 small tables; no data change, no change to any existing row):
--   1. FILE TYPES: .xlsx, .xls, .csv and .pdf are accepted for TOOL_LIST (root cause of MIME_NOT_ALLOWED: the browser sends the spreadsheet MIME types, the 0035/0106 whitelist did not contain them).
--      Content signature is verified (xlsx = ZIP, xls = OLE2, csv = text without NUL bytes, pdf = %PDF-); an .xlsx that carries a macro project is refused; the declared type must match the extension; a tool list can NOT be uploaded as 'application/octet-stream'.
--      Spreadsheet types are accepted only for TOOL_LIST and CAM_SETUP_SHEET.
--   2. AUTOMATIC CHECKS toolist_checks(version) — every check is OK / FAIL / WARN / NOT_VERIFIABLE, never a fake PASS. What is auto-verifiable today: file integrity + type, revision record, link to operations, CAM program link/status,
--      machine configuration link, CSV structure and critical-field completeness, tool numbers and length-offset numbers against the linked NC program text, tool-type counts against the CAM program tool declaration, magazine capacity against the machine passport.
--      NOT auto-verifiable (no reference data exists in the database): diameter, length, holder values; and every content check for .xlsx / .xls / .pdf. These are reported NOT_VERIFIABLE and need a recorded human verification.
--   3. toolist_attest(): the authorised checker (DOCUMENT_APPROVE) records, per critical field, that it was verified by hand; refused while any check FAILS. Attestation is stored with the check snapshot (who, when, what was seen).
--   4. PUBLISH GATE: document_publish refuses a TOOL_LIST version while any check FAILS (TOOLIST_CHECK_FAILED) or without attestation (TOOLIST_ATTESTATION_REQUIRED). A new list is therefore never active on upload and never silently replaces the active one.
--   5. START GATE: dc_start_refusal refuses an operation that has a CAM program when no EFFECTIVE tool list is linked to it (TOOL_LIST_REQUIRED), and while a re-check after a tool list change is open (TOOLIST_RECHECK_PENDING).
--   6. CHANGE -> RE-CHECK: publishing a tool list version that replaces an effective one opens a re-check item per linked operation (CAM/NC + operation conformance), notifies, and blocks start of that operation until an authorised person records the outcome (toolist_recheck_done).
--   7. WORK ORDER PIN: the first time an operation of a work order leaves PENDING, the tool list version in force is recorded for that work order/operation (append-only). Later changes never rewrite it.
-- UNCHANGED ON PURPOSE: routing / BOM / parameter simplification (0131), document states and authority, CAD / drawing / NC rules, work order snapshots, pilot isolation (0128), KMI-013, Haas, CNC live consistency.
begin;

do $$ begin
  if to_regprocedure('kmi_next.document_publish(uuid,text)') is null or to_regprocedure('kmi_next.dc_start_refusal(uuid,integer)') is null
     or to_regprocedure('kmi_next.dc_validity(uuid)') is null or to_regprocedure('kmi_next.document_signature_ok(text,bytea)') is null
     or to_regprocedure('kmi_next.upload_document(text,text,uuid,text,text,text,text,date,text,uuid)') is null
     or to_regclass('kmi_next.document_op_links') is null or to_regclass('kmi_next.cam_program_tools') is null then
    raise exception 'MIGRATION_ORDER: 0106 document control / CAM tables missing'; end if;
end $$;

-- ---- file kind (extension + declared type + real content must all agree) ---------------------------------------------------------------------------------------------------------
create or replace function kmi_next.toolist_file_kind(p_file_name text, p_mime text, b bytea) returns text language sql immutable set search_path = '' as $$
  select case
    when p_mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and lower(coalesce(p_file_name, '')) ~ '\.xlsx$'
         and length(b) >= 4 and substring(b from 1 for 4) = '\x504b0304'::bytea then 'XLSX'
    when p_mime = 'application/vnd.ms-excel' and lower(coalesce(p_file_name, '')) ~ '\.xls$'
         and length(b) >= 8 and substring(b from 1 for 8) = '\xd0cf11e0a1b11ae1'::bytea then 'XLS'
    when p_mime in ('text/csv', 'application/vnd.ms-excel', 'text/plain') and lower(coalesce(p_file_name, '')) ~ '\.csv$'
         and length(b) > 0 and position('\x00'::bytea in substring(b from 1 for 4096)) = 0 then 'CSV'
    when p_mime = 'application/pdf' and lower(coalesce(p_file_name, '')) ~ '\.pdf$'
         and length(b) >= 5 and substring(b from 1 for 5) = '\x255044462d'::bytea then 'PDF'
    else null end $$;

-- ---- signature check: the two new spreadsheet types and csv (everything else exactly as before) ----------------------------------------------------------------------------------
create or replace function kmi_next.document_signature_ok(p_mime text, b bytea) returns boolean
language sql immutable set search_path = '' as $$
  select case p_mime
    when 'application/pdf' then length(b) >= 5 and substring(b from 1 for 5) = '\x255044462d'::bytea
    when 'image/png' then length(b) >= 4 and substring(b from 1 for 4) = '\x89504e47'::bytea
    when 'image/jpeg' then length(b) >= 3 and substring(b from 1 for 3) = '\xffd8ff'::bytea
    when 'image/webp' then length(b) >= 12 and substring(b from 1 for 4) = '\x52494646'::bytea and substring(b from 9 for 4) = '\x57454250'::bytea
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then length(b) >= 4 and substring(b from 1 for 4) = '\x504b0304'::bytea
    when 'application/vnd.ms-excel' then length(b) >= 8 and (substring(b from 1 for 8) = '\xd0cf11e0a1b11ae1'::bytea or position('\x00'::bytea in substring(b from 1 for 4096)) = 0)
    when 'text/csv' then position('\x00'::bytea in substring(b from 1 for 4096)) = 0
    else true end;
$$;

-- ---- patch helper (live definition + exact-count assertions; re-run safe) ------------------------------------------------------------------------------------------------------
create or replace function pg_temp.kmi_patch(p_fn regprocedure, p_pairs text[]) returns void language plpgsql as $$
declare def text := pg_get_functiondef(p_fn); i int; n int; a text; b text;
begin
  for i in 1 .. cardinality(p_pairs) / 2 loop
    a := p_pairs[i * 2 - 1]; b := p_pairs[i * 2];
    if position(b in def) > 0 then continue; end if;      -- already patched (re-run safe)
    n := (length(def) - length(replace(def, a, ''))) / length(a);
    if n <> 1 then raise exception 'FUNCTION_SHAPE_CHANGED: % — pattern % matches % times (expected 1)', p_fn, i, n; end if;
    def := replace(def, a, b);
  end loop;
  execute def;
end $$;

-- upload_document: whitelist + tool list rules
do $$ begin
  perform pg_temp.kmi_patch('kmi_next.upload_document(text,text,uuid,text,text,text,text,date,text,uuid)'::regprocedure, array[
    $a$'application/octet-stream') then$a$,
    $b$'application/octet-stream','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel') then$b$,
    $a$if not kmi_next.document_signature_ok(p_mime_type, v_bytes) then raise exception 'CONTENT_TYPE_MISMATCH' using errcode = '22000'; end if;$a$,
    $b$if not kmi_next.document_signature_ok(p_mime_type, v_bytes) then raise exception 'CONTENT_TYPE_MISMATCH' using errcode = '22000'; end if;
  if p_mime_type in ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel') and p_doc_type not in ('TOOL_LIST', 'CAM_SETUP_SHEET') then
    raise exception 'MIME_NOT_ALLOWED' using errcode = '22000'; end if;
  if p_doc_type = 'TOOL_LIST' and kmi_next.toolist_file_kind(p_file_name, p_mime_type, v_bytes) is null then
    raise exception 'TOOL_LIST_FILE_TYPE: takım listesi yalnız .xlsx, .xls, .csv veya .pdf olabilir; dosya türü, uzantı ve içerik birbiriyle uyuşmalı' using errcode = '22000'; end if;
  if p_mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and position(convert_to('vbaProject', 'UTF8') in v_bytes) > 0 then
    raise exception 'TOOL_LIST_MACRO_REFUSED: makro içeren Excel dosyası kabul edilmez' using errcode = '22000'; end if;$b$]);
end $$;

-- ---- tables (internal; no API privileges) ------------------------------------------------------------------------------------------------------------------------------------
create table if not exists kmi_next.toolist_attestations (
  version_id uuid primary key references kmi_next.document_versions(id),
  document_id uuid not null references kmi_next.documents(id),
  attested_by uuid not null, attested_at timestamptz not null default clock_timestamp(),
  self_attested boolean not null default false,
  items jsonb not null, checks jsonb not null,
  note text not null check (length(btrim(note)) >= 5)
);
create table if not exists kmi_next.toolist_rechecks (
  id uuid primary key default gen_random_uuid(),
  product_revision_id uuid not null references kmi_next.product_revisions(id),
  op_no integer not null,
  document_id uuid not null references kmi_next.documents(id),
  version_id uuid not null references kmi_next.document_versions(id),
  prev_version_id uuid references kmi_next.document_versions(id),
  cam_program_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  done_by uuid, done_at timestamptz, done_note text,
  check ((done_at is null) = (done_by is null)),
  check (done_at is null or length(btrim(coalesce(done_note, ''))) >= 5),
  unique (product_revision_id, op_no, version_id)
);
create index if not exists toolist_rechecks_open on kmi_next.toolist_rechecks (product_revision_id, op_no) where done_at is null;
create table if not exists kmi_next.work_order_tool_list_pins (
  work_order_id uuid not null references kmi_next.work_orders(id),
  op_no integer not null,
  document_id uuid not null references kmi_next.documents(id),
  version_id uuid not null references kmi_next.document_versions(id),
  version_no integer not null,
  doc_revision_label text,
  pinned_at timestamptz not null default clock_timestamp(),
  primary key (work_order_id, op_no)
);
create or replace trigger toolist_attestations_append_only before update or delete on kmi_next.toolist_attestations for each row execute function kmi_next.append_only_guard();
create or replace trigger work_order_tool_list_pins_append_only before update or delete on kmi_next.work_order_tool_list_pins for each row execute function kmi_next.append_only_guard();

create or replace function kmi_next.tg_toolist_recheck_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY: toolist_rechecks rows are never deleted' using errcode = '42501'; end if;
  if old.done_at is not null then raise exception 'APPEND_ONLY: a closed re-check is final' using errcode = '42501'; end if;
  if new.product_revision_id is distinct from old.product_revision_id or new.op_no is distinct from old.op_no or new.version_id is distinct from old.version_id
     or new.document_id is distinct from old.document_id or new.created_at is distinct from old.created_at then raise exception 'APPEND_ONLY: only the closing fields may change' using errcode = '42501'; end if;
  return new;
end $$;
create or replace trigger toolist_rechecks_guard before update or delete on kmi_next.toolist_rechecks for each row execute function kmi_next.tg_toolist_recheck_guard();

do $$ declare t text; begin
  foreach t in array array['toolist_attestations', 'toolist_rechecks', 'work_order_tool_list_pins'] loop
    execute format('alter table kmi_next.%I enable row level security', t);
    execute format('revoke all on kmi_next.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- ---- helpers ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
create or replace function kmi_next.tl_chk(p_code text, p_label text, p_status text, p_critical boolean, p_detail text) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('code', p_code, 'label', p_label, 'status', p_status, 'critical', p_critical, 'detail', p_detail) $$;
create or replace function kmi_next.tl_norm(p_text text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(p_text, '')), 'çğıöşüâîİ', 'cgiosuaii'), '[^a-z0-9]', '', 'g') $$;

-- ---- the automatic checks (internal core; the public wrapper adds the access test) ------------------------------------------------------------------------------------------------
create or replace function kmi_next.toolist_checks_core(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v kmi_next.document_versions; d kmi_next.documents; c kmi_next.document_controls; r kmi_next.product_revisions; a kmi_next.toolist_attestations;
  v_kind text; v_today date := (now() at time zone 'Europe/Istanbul')::date; k jsonb := '[]'::jsonb;
  o record; nc record; cp record; v_ops integer[] := '{}'; v_n integer; v_txt text; v_lines text[]; v_delim text; v_hdr text[]; v_cells text[]; ln integer;
  i_no integer; i_dia integer; i_len integer; i_hold integer; i_off integer; i_typ integer;
  v_rows integer := 0; v_missing text[] := '{}'; v_bad text[] := '{}'; v_dups text[] := '{}'; v_nos integer[] := '{}'; v_offs integer[] := '{}'; v_types text[] := '{}';
  tn text; dn text; lg text; tnum integer; v_csv_ok boolean := false; v_hdr_missing text[] := '{}';
  v_fail_ops text[]; v_nc_txt text; v_nc_clean text; v_nc_tools integer[]; v_nc_offs integer[]; v_nc_missing text[] := '{}'; v_nc_unused text[] := '{}'; v_nc_off_missing text[] := '{}'; v_nc_nv text[] := '{}'; v_nc_seen boolean := false;
  v_cap numeric; v_mincap numeric; v_nocap text[] := '{}'; v_mid uuid; v_cam_bad text[] := '{}'; v_mach_bad text[] := '{}'; v_type_bad text[] := '{}'; v_type_nv boolean := false; v_type_seen boolean := false;
  v_fail integer; v_nvc integer; v_warn integer; v_ok integer; v_att boolean; v_fail_text text;
begin
  select * into v from kmi_next.document_versions where id = p_version;
  if not found then raise exception 'DOCUMENT_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into d from kmi_next.documents where id = v.document_id;
  if d.doc_type <> 'TOOL_LIST' then raise exception 'NOT_A_TOOL_LIST' using errcode = '22000'; end if;
  select * into c from kmi_next.document_controls where version_id = p_version;
  select * into r from kmi_next.product_revisions where id = d.entity_id;
  select * into a from kmi_next.toolist_attestations where version_id = p_version;
  v_kind := kmi_next.toolist_file_kind(v.file_name, v.mime_type, v.content);

  -- 1 file integrity, 2 type
  k := k || kmi_next.tl_chk('FILE_INTEGRITY', 'Dosya bütünlüğü (boyut + SHA-256)',
    case when v.content is not null and octet_length(v.content) = v.size_bytes and encode(sha256(v.content), 'hex') = v.sha256 then 'OK' else 'FAIL' end, true, v.file_name || ' · ' || v.size_bytes || ' B');
  k := k || kmi_next.tl_chk('FILE_TYPE', 'Dosya türü / uzantı / içerik uyumu', case when v_kind is not null then 'OK' else 'FAIL' end, true,
    coalesce(v_kind, 'tanınmayan') || ' · ' || v.mime_type);
  if v_kind = 'XLSX' then
    k := k || kmi_next.tl_chk('MACRO', 'Makro içermeme', case when position(convert_to('vbaProject', 'UTF8') in v.content) = 0 then 'OK' else 'FAIL' end, true, 'xlsx paketinde makro projesi aranır');
  elsif v_kind = 'XLS' then
    k := k || kmi_next.tl_chk('MACRO', 'Makro içermeme', 'NOT_VERIFIABLE', false, 'eski .xls ikili biçimindeki makro otomatik denetlenemez; dosya yalnız saklanır, sistem tarafından çalıştırılmaz');
  end if;

  -- 3 revision record
  k := k || kmi_next.tl_chk('REVISION_RECORD', 'Revizyon kaydı (sürüm no, hazırlayan, önceki sürüm)',
    case when c.version_id is not null and v.version_no >= 1 and c.prepared_by is not null and (v.version_no = 1 or c.previous_version_id is not null) then 'OK' else 'FAIL' end, true,
    'sürüm v' || v.version_no || coalesce(' · etiket ' || nullif(c.doc_revision_label, ''), '') || ' · durum ' || coalesce(c.state, '—'));

  -- linked operations (active, of this product revision)
  for o in select ro.* from kmi_next.routing_operations ro join kmi_next.document_op_links l on l.op_no = ro.op_no and l.document_id = d.id and l.active
            where ro.product_revision_id = d.entity_id and ro.active order by ro.op_no loop
    v_ops := v_ops || o.op_no;
    if o.cam_program_id is null then v_cam_bad := v_cam_bad || ('OP' || o.op_no || ': CAM programı yok');
    else select * into cp from kmi_next.cam_programs where id = o.cam_program_id;
         if cp.status is distinct from 'RELEASED' then v_cam_bad := v_cam_bad || ('OP' || o.op_no || ': CAM programı ' || coalesce(cp.status, '?')); end if; end if;
    if coalesce(cardinality(o.allowed_machine_ids), 0) = 0 then v_mach_bad := v_mach_bad || ('OP' || o.op_no || ': izinli tezgâh yok');
    elsif o.primary_machine_id is not null and not (o.primary_machine_id = any(o.allowed_machine_ids)) then v_mach_bad := v_mach_bad || ('OP' || o.op_no || ': ana tezgâh izinli listede değil'); end if;
  end loop;
  k := k || kmi_next.tl_chk('OP_LINK', 'Operasyona bağlantı', case when cardinality(v_ops) > 0 then 'OK' else 'FAIL' end, true,
    case when cardinality(v_ops) > 0 then 'OP' || array_to_string(v_ops, ', OP') else 'liste hiçbir operasyona bağlı değil' end);
  k := k || kmi_next.tl_chk('CAM_LINK', 'İlgili CAM programı (yayımlanmış)', case when cardinality(v_ops) = 0 then 'FAIL' when cardinality(v_cam_bad) = 0 then 'OK' else 'FAIL' end, true,
    case when cardinality(v_ops) = 0 then 'bağlı operasyon yok' when cardinality(v_cam_bad) = 0 then 'tüm bağlı operasyonlarda yayımlanmış CAM programı var' else array_to_string(v_cam_bad, '; ') end);
  k := k || kmi_next.tl_chk('MACHINE_LINK', 'Tezgâh yapılandırması (izinli / ana tezgâh)', case when cardinality(v_ops) = 0 then 'FAIL' when cardinality(v_mach_bad) = 0 then 'OK' else 'FAIL' end, true,
    case when cardinality(v_ops) = 0 then 'bağlı operasyon yok' when cardinality(v_mach_bad) = 0 then 'bağlı operasyonların izinli tezgâhları tanımlı' else array_to_string(v_mach_bad, '; ') end);

  -- CSV content
  if v_kind = 'CSV' then
    begin v_txt := convert_from(v.content, 'UTF8'); exception when others then
      begin v_txt := convert_from(v.content, 'WIN1254'); exception when others then v_txt := null; end;
    end;
    if v_txt is null then
      k := k || kmi_next.tl_chk('CONTENT_STRUCTURE', 'Liste içeriği (CSV)', 'FAIL', true, 'dosya metin olarak okunamadı');
    else
      v_txt := regexp_replace(v_txt, '^﻿', '');
      v_lines := array(select l from regexp_split_to_table(v_txt, E'\r?\n') l where btrim(l) <> '');
      if cardinality(v_lines) < 2 then
        k := k || kmi_next.tl_chk('CONTENT_STRUCTURE', 'Liste içeriği (CSV)', 'FAIL', true, 'başlık satırı ve en az bir takım satırı gerekli');
      else
        v_delim := case when v_lines[1] like '%;%' then ';' when position(E'\t' in v_lines[1]) > 0 then E'\t' else ',' end;
        v_hdr := string_to_array(replace(v_lines[1], '"', ''), v_delim);
        select i into i_no   from generate_subscripts(v_hdr, 1) i where kmi_next.tl_norm(v_hdr[i]) = any (array['t','tno','tool','toolno','toolnumber','takimno','takim','takimnumarasi','pozisyon','pocket','tnumber']) order by i limit 1;
        select i into i_dia  from generate_subscripts(v_hdr, 1) i where kmi_next.tl_norm(v_hdr[i]) = any (array['dia','diameter','diametermm','cap','capmm','capi','toolcap','takimcapi']) order by i limit 1;
        select i into i_len  from generate_subscripts(v_hdr, 1) i where kmi_next.tl_norm(v_hdr[i]) = any (array['l','length','uzunluk','boy','boymm','oal','toollength','takimboyu','takimuzunlugu','gaugelength']) order by i limit 1;
        select i into i_hold from generate_subscripts(v_hdr, 1) i where kmi_next.tl_norm(v_hdr[i]) = any (array['holder','holdercode','tutucu','tutucukodu','kovan','collet','takimtutucu']) order by i limit 1;
        select i into i_off  from generate_subscripts(v_hdr, 1) i where kmi_next.tl_norm(v_hdr[i]) = any (array['offset','ofset','offsetno','ofsetno','hno','hoffset','lengthoffset','duzeltme','dno','hd','hdno','hduzeltme']) order by i limit 1;
        select i into i_typ  from generate_subscripts(v_hdr, 1) i where kmi_next.tl_norm(v_hdr[i]) = any (array['type','tip','tipi','tur','tooltype','takimtipi']) order by i limit 1;
        if i_no is null then v_hdr_missing := array_append(v_hdr_missing, 'takım no'); end if; if i_dia is null then v_hdr_missing := array_append(v_hdr_missing, 'çap'); end if;
        if i_len is null then v_hdr_missing := array_append(v_hdr_missing, 'boy'); end if; if i_hold is null then v_hdr_missing := array_append(v_hdr_missing, 'tutucu'); end if; if i_off is null then v_hdr_missing := array_append(v_hdr_missing, 'offset'); end if;
        if cardinality(v_hdr_missing) > 0 then
          k := k || kmi_next.tl_chk('CONTENT_STRUCTURE', 'Liste içeriği (CSV)', 'FAIL', true, 'kritik sütun eksik: ' || array_to_string(v_hdr_missing, ', ') || ' (kritik takım bilgisi eksik — üretime verilemez)');
        else
          for ln in 2 .. cardinality(v_lines) loop
            v_cells := string_to_array(replace(v_lines[ln], '"', ''), v_delim); v_rows := v_rows + 1;
            tn := nullif(btrim(coalesce(v_cells[i_no], '')), ''); dn := nullif(btrim(coalesce(v_cells[i_dia], '')), ''); lg := nullif(btrim(coalesce(v_cells[i_len], '')), '');
            if tn is null or dn is null or lg is null or nullif(btrim(coalesce(v_cells[i_hold], '')), '') is null or nullif(btrim(coalesce(v_cells[i_off], '')), '') is null then
              v_missing := v_missing || ln::text; continue; end if;
            if replace(dn, ',', '.') !~ '^[0-9]+(\.[0-9]+)?$' or replace(lg, ',', '.') !~ '^[0-9]+(\.[0-9]+)?$' or replace(dn, ',', '.')::numeric <= 0 or replace(lg, ',', '.')::numeric <= 0 then v_bad := v_bad || ln::text; continue; end if;
            tnum := substring(tn from '([0-9]+)')::integer;
            if tnum is null or substring(v_cells[i_off] from '([0-9]+)') is null then v_bad := v_bad || ln::text; continue; end if;
            if tnum = any (v_nos) then v_dups := v_dups || ('T' || tnum) ; else v_nos := v_nos || tnum; end if;
            v_offs := v_offs || substring(v_cells[i_off] from '([0-9]+)')::integer;
            if i_typ is not null then v_types := v_types || lower(btrim(coalesce(v_cells[i_typ], ''))); end if;
          end loop;
          v_csv_ok := v_rows > 0 and cardinality(v_missing) = 0 and cardinality(v_bad) = 0 and cardinality(v_dups) = 0;
          k := k || kmi_next.tl_chk('CONTENT_STRUCTURE', 'Liste içeriği (CSV): kritik alanlar dolu, sayısal, takım no tekrarsız',
            case when v_csv_ok then 'OK' else 'FAIL' end, true,
            v_rows || ' takım satırı' || case when cardinality(v_missing) > 0 then ' · eksik kritik alan satır: ' || array_to_string(v_missing, ',') else '' end
              || case when cardinality(v_bad) > 0 then ' · geçersiz sayı/numara satır: ' || array_to_string(v_bad, ',') else '' end
              || case when cardinality(v_dups) > 0 then ' · tekrarlı takım no: ' || array_to_string(v_dups, ',') else '' end);
        end if;
      end if;
    end if;
  else
    k := k || kmi_next.tl_chk('CONTENT_STRUCTURE', 'Liste içeriği', 'NOT_VERIFIABLE', true,
      coalesce(v_kind, 'bu dosya türü') || ' dosyasının içeriği sistem tarafından okunamaz; takım no, çap, boy, tutucu, offset yetkili kişi tarafından elle doğrulanmalı');
  end if;

  -- tool numbers / length offsets against the linked NC program text
  if v_csv_ok and cardinality(v_ops) > 0 then
    foreach v_n in array v_ops loop
      select dv.* into nc from kmi_next.documents nd join kmi_next.document_op_links l on l.document_id = nd.id and l.op_no = v_n and l.active
        join kmi_next.document_controls dc on dc.document_id = nd.id and dc.state not in ('REJECTED', 'SUPERSEDED')
        join kmi_next.document_versions dv on dv.id = dc.version_id
       where nd.entity_type = 'PRODUCT_REVISION' and nd.entity_id = d.entity_id and nd.doc_type = 'NC_PROGRAM' and nd.status = 'ACTIVE'
       order by (dc.state = 'EFFECTIVE') desc, dv.version_no desc limit 1;
      if not found then v_nc_nv := v_nc_nv || ('OP' || v_n || ': bağlı NC programı yok'); continue; end if;
      if nc.content is null or position('\x00'::bytea in substring(nc.content from 1 for 4096)) > 0 then v_nc_nv := v_nc_nv || ('OP' || v_n || ': NC programı metin değil'); continue; end if;
      begin v_nc_txt := convert_from(nc.content, 'UTF8'); exception when others then
        begin v_nc_txt := convert_from(nc.content, 'WIN1254'); exception when others then v_nc_txt := null; end; end;
      if v_nc_txt is null then v_nc_nv := v_nc_nv || ('OP' || v_n || ': NC programı okunamadı'); continue; end if;
      v_nc_seen := true;
      v_nc_clean := regexp_replace(regexp_replace(v_nc_txt, '\([^)]*\)', '', 'g'), ';[^\n]*', '', 'g');
      v_nc_tools := array(select distinct (m)[1]::integer from regexp_matches(v_nc_clean, '(?:^|[^A-Za-z0-9])T0*([0-9]{1,4})(?![0-9])', 'g') m);
      v_nc_offs  := array(select distinct (m)[1]::integer from regexp_matches(v_nc_clean, 'G4[34][^\n]*?(?:^|[^A-Za-z0-9])H0*([0-9]{1,3})(?![0-9])', 'g') m);
      if cardinality(v_nc_tools) = 0 then v_nc_nv := v_nc_nv || ('OP' || v_n || ': NC programında T kodu bulunamadı'); continue; end if;
      v_nc_missing := v_nc_missing || array(select 'OP' || v_n || ':T' || t from unnest(v_nc_tools) t where not (t = any (v_nos)));
      v_nc_unused  := v_nc_unused  || array(select 'T' || t from unnest(v_nos) t where not (t = any (v_nc_tools)) and v_n = v_ops[1]);
      v_nc_off_missing := v_nc_off_missing || array(select 'OP' || v_n || ':H' || t from unnest(v_nc_offs) t where not (t = any (v_offs)));
    end loop;
    if v_nc_seen then
      k := k || kmi_next.tl_chk('TOOL_NUMBERS_NC', 'Takım numaraları ↔ NC programındaki T kodları', case when cardinality(v_nc_missing) = 0 then 'OK' else 'FAIL' end, true,
        case when cardinality(v_nc_missing) = 0 then 'NC programının çağırdığı tüm T kodları listede var' else 'NC çağırıyor, listede yok: ' || array_to_string(v_nc_missing, ', ') end
          || case when cardinality(v_nc_nv) > 0 then ' · doğrulanamayan: ' || array_to_string(v_nc_nv, '; ') else '' end);
      if cardinality(v_nc_unused) > 0 then k := k || kmi_next.tl_chk('TOOL_UNUSED', 'Listede olup NC programında çağrılmayan takım', 'WARN', false, array_to_string(v_nc_unused, ', ')); end if;
      k := k || kmi_next.tl_chk('OFFSETS_NC', 'Uzunluk düzeltme numaraları (G43/G44 H) ↔ listedeki offset', case when cardinality(v_nc_off_missing) = 0 then 'OK' else 'FAIL' end, true,
        case when cardinality(v_nc_off_missing) = 0 then 'NC programındaki H numaraları listedeki offset sütununda var' else 'NC kullanıyor, listede yok: ' || array_to_string(v_nc_off_missing, ', ') end);
    else
      k := k || kmi_next.tl_chk('TOOL_NUMBERS_NC', 'Takım numaraları ↔ NC programındaki T kodları', 'NOT_VERIFIABLE', true, coalesce(array_to_string(v_nc_nv, '; '), 'NC programı yok'));
      k := k || kmi_next.tl_chk('OFFSETS_NC', 'Uzunluk düzeltme numaraları ↔ NC programı', 'NOT_VERIFIABLE', true, 'karşılaştırılacak NC metni yok');
    end if;
  else
    k := k || kmi_next.tl_chk('TOOL_NUMBERS_NC', 'Takım numaraları ↔ NC programındaki T kodları', 'NOT_VERIFIABLE', true, case when v_kind = 'CSV' then 'önce liste içeriği geçerli olmalı' else 'liste içeriği okunamadığı için karşılaştırılamaz' end);
    k := k || kmi_next.tl_chk('OFFSETS_NC', 'Uzunluk düzeltme numaraları ↔ NC programı', 'NOT_VERIFIABLE', true, case when v_kind = 'CSV' then 'önce liste içeriği geçerli olmalı' else 'liste içeriği okunamadığı için karşılaştırılamaz' end);
  end if;

  -- CAM program tool declaration (type + quantity)
  if v_csv_ok and cardinality(v_ops) > 0 then
    for cp in select t.tool_type, sum(t.qty) q from kmi_next.cam_program_tools t where t.cam_program_id in
                (select ro.cam_program_id from kmi_next.routing_operations ro where ro.product_revision_id = d.entity_id and ro.op_no = any (v_ops) and ro.cam_program_id is not null) group by t.tool_type loop
      v_type_seen := true;
      if i_typ is null then v_type_nv := true;
      elsif (select count(*) from unnest(v_types) x where x = lower(btrim(cp.tool_type))) < cp.q then v_type_bad := v_type_bad || (cp.tool_type || ' ×' || cp.q); end if;
    end loop;
    k := k || kmi_next.tl_chk('CAM_TOOL_TYPES', 'CAM programının takım türü / adedi ↔ liste',
      case when not v_type_seen or v_type_nv then 'NOT_VERIFIABLE' when cardinality(v_type_bad) = 0 then 'OK' else 'FAIL' end, true,
      case when not v_type_seen then 'CAM programında takım türü/adet tanımı yok' when v_type_nv then 'listede takım türü sütunu yok' when cardinality(v_type_bad) = 0 then 'CAM programının istediği tür ve adetler listede var'
           else 'listede eksik: ' || array_to_string(v_type_bad, ', ') end);
  else
    k := k || kmi_next.tl_chk('CAM_TOOL_TYPES', 'CAM programının takım türü / adedi ↔ liste', 'NOT_VERIFIABLE', true, 'liste içeriği okunamadığı için karşılaştırılamaz');
  end if;

  -- magazine capacity of the allowed machines (machine passport TOOL_CAPACITY)
  if v_csv_ok and cardinality(v_ops) > 0 then
    v_mincap := null;
    for o in select distinct unnest(ro.allowed_machine_ids) mid from kmi_next.routing_operations ro where ro.product_revision_id = d.entity_id and ro.op_no = any (v_ops) loop
      select x.value_num into v_cap from kmi_next.passport_values x where x.entity_type = 'MACHINE' and x.entity_id = o.mid and x.attr_code = 'TOOL_CAPACITY' and x.valid_from <= v_today order by x.valid_from desc, x.version_no desc limit 1;
      if v_cap is null then v_nocap := v_nocap || (select m.code from kmi_next.machines m where m.id = o.mid);
      elsif v_mincap is null or v_cap < v_mincap then v_mincap := v_cap; end if;
    end loop;
    k := k || kmi_next.tl_chk('MAGAZINE_CAPACITY', 'Takım sayısı ↔ tezgâh takım magazini',
      case when v_mincap is not null and cardinality(v_nos) > v_mincap then 'FAIL' when cardinality(v_nocap) > 0 or v_mincap is null then 'NOT_VERIFIABLE' else 'OK' end, true,
      cardinality(v_nos) || ' takım' || coalesce(' · en küçük magazin ' || v_mincap, '') || case when cardinality(v_nocap) > 0 then ' · magazin kapasitesi tanımsız tezgâh: ' || array_to_string(v_nocap, ',') else '' end);
  else
    k := k || kmi_next.tl_chk('MAGAZINE_CAPACITY', 'Takım sayısı ↔ tezgâh takım magazini', 'NOT_VERIFIABLE', true, 'liste içeriği okunamadığı için sayılamaz');
  end if;

  -- values that have NO reference anywhere in the database
  k := k || kmi_next.tl_chk('DIAMETER_REF', 'Takım çapı doğruluğu', 'NOT_VERIFIABLE', true, 'veritabanında karşılaştırılacak referans çap yok' || case when v_csv_ok then ' (yalnız sayısal ve > 0 olduğu doğrulandı)' else '' end);
  k := k || kmi_next.tl_chk('LENGTH_REF', 'Takım boyu doğruluğu', 'NOT_VERIFIABLE', true, 'veritabanında karşılaştırılacak referans boy yok' || case when v_csv_ok then ' (yalnız sayısal ve > 0 olduğu doğrulandı)' else '' end);
  k := k || kmi_next.tl_chk('HOLDER_REF', 'Tutucu doğruluğu', 'NOT_VERIFIABLE', true, 'veritabanında tutucu referansı yok' || case when v_csv_ok then ' (yalnız dolu olduğu doğrulandı)' else '' end);

  select count(*) filter (where x->>'status' = 'FAIL'), count(*) filter (where x->>'status' = 'NOT_VERIFIABLE' and (x->>'critical')::boolean), count(*) filter (where x->>'status' = 'WARN'), count(*) filter (where x->>'status' = 'OK'),
         coalesce(string_agg(x->>'code' || ' (' || (x->>'detail') || ')', '; ') filter (where x->>'status' = 'FAIL'), '')
    into v_fail, v_nvc, v_warn, v_ok, v_fail_text from jsonb_array_elements(k) x;
  v_att := a.version_id is not null;
  return jsonb_build_object('version_id', p_version, 'document_id', d.id, 'version_no', v.version_no, 'file_kind', v_kind, 'state', c.state, 'checks', k,
    'ok', v_ok, 'fail', v_fail, 'warn', v_warn, 'not_verifiable_critical', v_nvc, 'fail_text', v_fail_text,
    'attested', v_att, 'attested_by', a.attested_by, 'attested_at', a.attested_at,
    'can_publish', v_fail = 0 and v_att,
    'note', 'NOT_VERIFIABLE = sistem doğrulayamadı; yetkili kişinin elle doğrulaması ve kaydı gerekir. Hiçbir doğrulanamayan alan PASS sayılmaz.');
end $$;

create or replace function kmi_next.toolist_checks(p_version uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not coalesce(kmi_next.dc_can_open_version(p_version), false) then raise exception 'FORBIDDEN: DOCUMENT_VERSION' using errcode = '42501'; end if;
  return kmi_next.toolist_checks_core(p_version);
end $$;

-- ---- human verification of what the system cannot verify ---------------------------------------------------------------------------------------------------------------------
create or replace function kmi_next.toolist_attest(p_version uuid, p_items jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c kmi_next.document_controls; d kmi_next.documents; v kmi_next.document_versions; v_chk jsonb; v_self boolean; k text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not kmi_next.dc_can_approve() then raise exception 'FORBIDDEN: DOCUMENT_APPROVE' using errcode = '42501'; end if;
  select * into c from kmi_next.document_controls where version_id = p_version for update;
  if not found then raise exception 'VERSION_NOT_CONTROLLED' using errcode = 'P0002'; end if;
  select * into d from kmi_next.documents where id = c.document_id;
  if d.doc_type <> 'TOOL_LIST' then raise exception 'NOT_A_TOOL_LIST' using errcode = '22000'; end if;
  select * into v from kmi_next.document_versions where id = p_version;
  if c.state not in ('IN_REVIEW', 'APPROVED') then raise exception 'VERSION_NOT_IN_REVIEW: %', c.state using errcode = '22000'; end if;
  if p_note is null or length(btrim(p_note)) < 5 then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  foreach k in array array['tool_numbers', 'diameters', 'lengths', 'holders', 'offsets', 'cam_nc_match', 'machine_config'] loop
    if coalesce(p_items ->> k, '') <> 'true' then raise exception 'TOOLIST_ATTEST_INCOMPLETE: "%" onaylanmadı — her kritik alan tek tek doğrulanmalı', k using errcode = '22000'; end if;
  end loop;
  v_chk := kmi_next.toolist_checks_core(p_version);
  if (v_chk ->> 'fail')::integer > 0 then raise exception 'TOOLIST_CHECK_FAILED: %', v_chk ->> 'fail_text' using errcode = '22000'; end if;
  if exists (select 1 from kmi_next.toolist_attestations where version_id = p_version) then raise exception 'TOOLIST_ALREADY_ATTESTED' using errcode = '22000'; end if;
  v_self := kmi_next.pm_second_approver(coalesce(c.submitted_by, c.prepared_by), p_note);
  insert into kmi_next.toolist_attestations (version_id, document_id, attested_by, self_attested, items, checks, note)
    values (p_version, d.id, auth.uid(), v_self, p_items, v_chk -> 'checks', btrim(p_note));
  perform kmi_next.dc_event(d.id, p_version, 'TOOLIST_ATTESTED', btrim(p_note), jsonb_build_object('version_no', v.version_no, 'self_attested', v_self, 'items', p_items,
         'ok', v_chk -> 'ok', 'warn', v_chk -> 'warn', 'not_verifiable_critical', v_chk -> 'not_verifiable_critical'));
  return jsonb_build_object('version_id', p_version, 'attested', true, 'self_attested', v_self);
end $$;

-- ---- change -> re-check ----------------------------------------------------------------------------------------------------------------------------------------------------------
create or replace function kmi_next.toolist_open_rechecks(p_doc uuid, p_new uuid, p_prev uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare d kmi_next.documents; o record; v_n integer := 0; v_ops text := '';
begin
  select * into d from kmi_next.documents where id = p_doc;
  for o in select ro.op_no, ro.cam_program_id from kmi_next.routing_operations ro join kmi_next.document_op_links l on l.op_no = ro.op_no and l.document_id = p_doc and l.active
            where ro.product_revision_id = d.entity_id and ro.active order by ro.op_no loop
    insert into kmi_next.toolist_rechecks (product_revision_id, op_no, document_id, version_id, prev_version_id, cam_program_id) values (d.entity_id, o.op_no, p_doc, p_new, p_prev, o.cam_program_id) on conflict do nothing;
    v_n := v_n + 1; v_ops := v_ops || case when v_ops = '' then '' else ', ' end || 'OP' || o.op_no;
  end loop;
  perform kmi_next.dc_event(p_doc, p_new, 'RECHECK_REQUIRED', null, jsonb_build_object('operations', v_ops, 'count', v_n, 'prev_version', p_prev));
  if v_n > 0 then
    perform kmi_next.quote_notify('Takım listesi değişti: CAM/NC ve operasyon yeniden kontrol edilmeli', d.title || ' — ' || v_ops || '. Kontrol kaydı girilene kadar bu operasyonlar iş emrinde başlatılamaz.', d.id::text);
  end if;
  return v_n;
end $$;

create or replace function kmi_next.toolist_recheck_done(p_recheck uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t kmi_next.toolist_rechecks;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  if not kmi_next.dc_can_approve() then raise exception 'FORBIDDEN: DOCUMENT_APPROVE' using errcode = '42501'; end if;
  if p_note is null or length(btrim(p_note)) < 5 then raise exception 'REASON_REQUIRED' using errcode = '22000'; end if;
  select * into t from kmi_next.toolist_rechecks where id = p_recheck for update;
  if not found then raise exception 'RECHECK_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.done_at is not null then raise exception 'RECHECK_ALREADY_DONE' using errcode = '22000'; end if;
  update kmi_next.toolist_rechecks set done_by = auth.uid(), done_at = clock_timestamp(), done_note = btrim(p_note) where id = p_recheck;
  perform kmi_next.dc_event(t.document_id, t.version_id, 'RECHECK_DONE', btrim(p_note), jsonb_build_object('op_no', t.op_no));
  return jsonb_build_object('recheck_id', p_recheck, 'done', true);
end $$;

-- ---- what the product screen shows for the tool list card -------------------------------------------------------------------------------------------------------------------
create or replace function kmi_next.toolist_overview(p_rev uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_docs jsonb; v_re jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('document_id', d.id, 'title', d.title, 'doc_no', (select doc_no from kmi_next.document_registry where document_id = d.id),
      'versions', (select coalesce(jsonb_agg(jsonb_build_object('version_id', v.id, 'version_no', v.version_no, 'file_name', v.file_name, 'state', c.state, 'label', c.doc_revision_label,
           'uploaded_at', v.uploaded_at, 'prepared_by', c.prepared_by, 'reviewed_by', c.reviewed_by, 'approved_by', c.approved_by, 'effective_at', c.effective_at,
           'attested', exists (select 1 from kmi_next.toolist_attestations a where a.version_id = v.id),
           'attested_by', (select a.attested_by from kmi_next.toolist_attestations a where a.version_id = v.id)) order by v.version_no desc), '[]'::jsonb)
         from kmi_next.document_versions v join kmi_next.document_controls c on c.version_id = v.id where v.document_id = d.id and kmi_next.dc_can_open_version(v.id))) order by d.created_at), '[]'::jsonb)
    into v_docs from kmi_next.documents d where d.entity_type = 'PRODUCT_REVISION' and d.entity_id = p_rev and d.doc_type = 'TOOL_LIST' and d.status = 'ACTIVE' and kmi_next.document_type_visible('TOOL_LIST');
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'op_no', t.op_no, 'version_id', t.version_id, 'created_at', t.created_at) order by t.created_at), '[]'::jsonb)
    into v_re from kmi_next.toolist_rechecks t where t.product_revision_id = p_rev and t.done_at is null;
  return jsonb_build_object('documents', v_docs, 'rechecks_open', v_re, 'can_attest', kmi_next.dc_can_approve());
end $$;

-- ---- patches of the existing publish / start functions ------------------------------------------------------------------------------------------------------------------------
do $$ begin
  perform pg_temp.kmi_patch('kmi_next.document_publish(uuid,text)'::regprocedure, array[
    $a$v_pending integer; v_impact jsonb;$a$, $b$v_pending integer; v_impact jsonb; v_chk jsonb;$b$,
    $a$raise exception 'DOCUMENT_REVISION_MISMATCH: document says %, product revision is %', coalesce(c.doc_revision_label, '-'), r.revision using errcode = '22000'; end if;$a$,
    $b$raise exception 'DOCUMENT_REVISION_MISMATCH: document says %, product revision is %', coalesce(c.doc_revision_label, '-'), r.revision using errcode = '22000'; end if;
  if d.doc_type = 'TOOL_LIST' then
    v_chk := kmi_next.toolist_checks_core(p_version);
    if (v_chk ->> 'fail')::integer > 0 then raise exception 'TOOLIST_CHECK_FAILED: %', v_chk ->> 'fail_text' using errcode = '22000'; end if;
    if not (v_chk ->> 'attested')::boolean then raise exception 'TOOLIST_ATTESTATION_REQUIRED: kritik takım bilgileri yetkili kişi tarafından doğrulanıp kaydedilmeden takım listesi yürürlüğe alınamaz' using errcode = '22000'; end if;
  end if;$b$,
    $a$v_n := kmi_next.dc_distribute(c.document_id, p_version, old.version_id, 'PUBLISHED');$a$,
    $b$v_n := kmi_next.dc_distribute(c.document_id, p_version, old.version_id, 'PUBLISHED');
  if d.doc_type = 'TOOL_LIST' and old.version_id is not null then perform kmi_next.toolist_open_rechecks(c.document_id, p_version, old.version_id); end if;$b$]);
  perform pg_temp.kmi_patch('kmi_next.dc_start_refusal(uuid,integer)'::regprocedure, array[
    $a$if not found or w.product_revision_id is null then return null; end if;$a$,
    $b$if not found or w.product_revision_id is null then return null; end if;
  if p_op_no is not null and exists (select 1 from kmi_next.work_order_operations x where x.work_order_id = p_wo and x.op_no = p_op_no and x.cam_program_id is not null)
     and not exists (select 1 from kmi_next.documents td join kmi_next.document_op_links l on l.document_id = td.id and l.op_no = p_op_no and l.active
                       join kmi_next.document_controls tc2 on tc2.document_id = td.id and tc2.state = 'EFFECTIVE'
                      where td.entity_type = 'PRODUCT_REVISION' and td.entity_id = w.product_revision_id and td.doc_type = 'TOOL_LIST' and td.status = 'ACTIVE'
                        and kmi_next.dc_validity(tc2.version_id) = 'EFFECTIVE') then
    return 'TOOL_LIST_REQUIRED';
  end if;
  if p_op_no is not null and exists (select 1 from kmi_next.toolist_rechecks rc where rc.product_revision_id = w.product_revision_id and rc.op_no = p_op_no and rc.done_at is null) then
    return 'TOOLIST_RECHECK_PENDING';
  end if;$b$]);
end $$;

-- ---- work order pin (append-only) ------------------------------------------------------------------------------------------------------------------------------------------------
create or replace function kmi_next.tg_toolist_pin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'PENDING' and new.status <> 'PENDING' then
    insert into kmi_next.work_order_tool_list_pins (work_order_id, op_no, document_id, version_id, version_no, doc_revision_label)
      select new.work_order_id, new.op_no, d.id, v.id, v.version_no, c.doc_revision_label
        from kmi_next.work_orders wo join kmi_next.documents d on d.entity_type = 'PRODUCT_REVISION' and d.entity_id = wo.product_revision_id and d.doc_type = 'TOOL_LIST' and d.status = 'ACTIVE'
        join kmi_next.document_op_links l on l.document_id = d.id and l.op_no = new.op_no and l.active
        join kmi_next.document_controls c on c.document_id = d.id and c.state = 'EFFECTIVE'
        join kmi_next.document_versions v on v.id = c.version_id
       where wo.id = new.work_order_id order by v.version_no desc limit 1
      on conflict do nothing;
  end if;
  return null;
end $$;
create or replace trigger work_order_operations_toolist_pin after update of status on kmi_next.work_order_operations for each row execute function kmi_next.tg_toolist_pin();

-- ---- privileges -----------------------------------------------------------------------------------------------------------------------------------------------------------------
revoke all on function kmi_next.toolist_file_kind(text, text, bytea), kmi_next.tl_chk(text, text, text, boolean, text), kmi_next.tl_norm(text), kmi_next.toolist_checks_core(uuid),
  kmi_next.toolist_open_rechecks(uuid, uuid, uuid), kmi_next.tg_toolist_pin(), kmi_next.tg_toolist_recheck_guard() from public, anon, authenticated;
revoke all on function kmi_next.toolist_checks(uuid), kmi_next.toolist_attest(uuid, jsonb, text), kmi_next.toolist_recheck_done(uuid, text), kmi_next.toolist_overview(uuid) from public, anon;
grant execute on function kmi_next.toolist_checks(uuid), kmi_next.toolist_attest(uuid, jsonb, text), kmi_next.toolist_recheck_done(uuid, text), kmi_next.toolist_overview(uuid) to authenticated;

-- ---- 0128 pilot-isolation registry (classification only) -------------------------------------------------------------------------------------------------------------------------
-- Two new functions mention pilot-relevant tables. Neither aggregates or reports: tg_toolist_pin copies the tool list version in force into an append-only evidence row for the operation that is starting
-- (a pilot work order may pin too - it is evidence, not a KPI); toolist_checks_core reads one machine code / capacity by id for a message. Both are classified KEEP, as 0126 did for cnc_live_states.
do $$ begin
  if to_regclass('kmi_next.pilot_consumer_registry') is not null then
    insert into kmi_next.pilot_consumer_registry (fn_name, fn_identity, action, reason, original_def, applied_at) values
      ('tg_toolist_pin', 'kmi_next.tg_toolist_pin()', 'KEEP', '0132: append-only evidence of the tool list version in force when an operation starts; no KPI, no aggregation', null, now()),
      ('toolist_checks_core', 'kmi_next.toolist_checks_core(uuid)', 'KEEP', '0132: reads one machine code / magazine capacity by id for a check message; no KPI, no aggregation', null, now())
    on conflict do nothing;
  end if;
end $$;

commit;
