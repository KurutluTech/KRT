-- ROLLBACK of 0132 (tool list control). Restores upload_document / document_publish / dc_start_refusal / document_signature_ok to their pre-0132 text and removes the 0132 objects.
-- SAFETY: the three evidence tables (toolist_attestations, toolist_rechecks, work_order_tool_list_pins) hold audit evidence. If ANY of them has rows the rollback STOPS and changes nothing — keep the tables (the functions can be
-- restored by hand) or archive them first. Run BEFORE rollback_0131 and AFTER rollback_0133.
begin;
do $$ declare n bigint := 0; begin
  if to_regclass('kmi_next.toolist_attestations') is not null then execute 'select count(*) from kmi_next.toolist_attestations' into n; if n > 0 then raise exception 'EVIDENCE_EXISTS: tool list attestations exist; rollback refused (nothing changed)'; end if; end if;
  if to_regclass('kmi_next.toolist_rechecks') is not null then execute 'select count(*) from kmi_next.toolist_rechecks' into n; if n > 0 then raise exception 'EVIDENCE_EXISTS: tool list re-checks exist; rollback refused (nothing changed)'; end if; end if;
  if to_regclass('kmi_next.work_order_tool_list_pins') is not null then execute 'select count(*) from kmi_next.work_order_tool_list_pins' into n; if n > 0 then raise exception 'EVIDENCE_EXISTS: work order tool list pins exist; rollback refused (nothing changed)'; end if; end if;
end $$;
drop trigger if exists work_order_operations_toolist_pin on kmi_next.work_order_operations;
create or replace function pg_temp.kmi_unpatch(p_fn regprocedure, p_pairs text[]) returns void language plpgsql as $$
declare def text := pg_get_functiondef(p_fn); i int; n int; a text; b text;
begin
  for i in 1 .. cardinality(p_pairs) / 2 loop
    a := p_pairs[i * 2 - 1]; b := p_pairs[i * 2];          -- forward migration replaced a by b; here b is put back to a
    if position(a in def) > 0 and position(b in def) = 0 then continue; end if;      -- already rolled back (re-run safe)
    n := (length(def) - length(replace(def, b, ''))) / length(b);
    if n <> 1 then raise exception 'FUNCTION_SHAPE_CHANGED: % — pattern % matches % times (expected 1)', p_fn, i, n; end if;
    def := replace(def, b, a);
  end loop;
  execute def;
end $$;
do $$ begin
  perform pg_temp.kmi_unpatch('kmi_next.upload_document(text,text,uuid,text,text,text,text,date,text,uuid)'::regprocedure, array[
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
do $$ begin
  perform pg_temp.kmi_unpatch('kmi_next.document_publish(uuid,text)'::regprocedure, array[
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
  perform pg_temp.kmi_unpatch('kmi_next.dc_start_refusal(uuid,integer)'::regprocedure, array[
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
create or replace function kmi_next.document_signature_ok(p_mime text, b bytea) returns boolean
language sql immutable set search_path = '' as $$
  select case p_mime
    when 'application/pdf' then length(b) >= 5 and substring(b from 1 for 5) = '\x255044462d'::bytea
    when 'image/png' then length(b) >= 4 and substring(b from 1 for 4) = '\x89504e47'::bytea
    when 'image/jpeg' then length(b) >= 3 and substring(b from 1 for 3) = '\xffd8ff'::bytea
    when 'image/webp' then length(b) >= 12 and substring(b from 1 for 4) = '\x52494646'::bytea and substring(b from 9 for 4) = '\x57454250'::bytea
    else true end;
$$;
drop function if exists kmi_next.tg_toolist_pin();
drop function if exists kmi_next.toolist_overview(uuid);
drop function if exists kmi_next.toolist_recheck_done(uuid, text);
drop function if exists kmi_next.toolist_open_rechecks(uuid, uuid, uuid);
drop function if exists kmi_next.toolist_attest(uuid, jsonb, text);
drop function if exists kmi_next.toolist_checks(uuid);
drop function if exists kmi_next.toolist_checks_core(uuid);
drop function if exists kmi_next.toolist_file_kind(text, text, bytea);
drop function if exists kmi_next.tl_chk(text, text, text, boolean, text);
drop function if exists kmi_next.tl_norm(text);
drop table if exists kmi_next.work_order_tool_list_pins;
drop table if exists kmi_next.toolist_rechecks;
drop table if exists kmi_next.toolist_attestations;
drop function if exists kmi_next.tg_toolist_recheck_guard();
do $$ begin if to_regclass('kmi_next.pilot_consumer_registry') is not null then delete from kmi_next.pilot_consumer_registry where fn_identity in ('kmi_next.tg_toolist_pin()', 'kmi_next.toolist_checks_core(uuid)'); end if; end $$;
commit;
