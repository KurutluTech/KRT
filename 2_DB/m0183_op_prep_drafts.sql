-- m0183_op_prep_drafts — KMI-013 Teknik Operasyon Hazırlık Formu (Y150NSM01-F Rev A için onaylandı, 31.10.2026)
--
-- KAPSAM (yalnız bu):
--   * 1 yeni tablo: kmi_next.op_prep_drafts — rotada HENÜZ OLMAYAN operasyonların (CUT_PREP, OP10, OP20, OP40 …)
--     hazırlık TASLAĞI. Gerçek rota operasyonu, iş emri, stok hareketi veya üretim kaydı DEĞİLDİR.
--   * Tabloya doğrudan erişim kapalı (RLS açık, politika yok, anon/authenticated yetkisi yok); tüm okuma/yazma
--     aşağıdaki SECURITY DEFINER fonksiyonlarla, sunucu tarafı yetki denetimiyle.
--   * Değişiklik geçmişi MEVCUT, değiştirilemez kmi_next.audit_log tablosuna (eski/yeni değer, kullanıcı, zaman);
--     ürün zaman çizelgesine MEVCUT kmi_next.product_events (pm_event) ile özet. İkinci tablo yok.
--   * Yeni yetki kodu YOK: düzenleme = ROUTING_MANAGE, teknik onay = PRODUCT_REV_APPROVE (mevcut).
-- DOKUNMAZ: routing_operations, work_orders, stok, üretim, product_revisions durumu, documents, cam_programs.
-- ONAYLI (APPROVED) = teknik hazırlık incelemesi tamam. Rota RELEASE veya üretim GO DEĞİLDİR; bu fonksiyonlar
-- rotaya operasyon eklemez.
-- Geri dönüş: rollback_m0183_op_prep_drafts.sql

begin;

create table kmi_next.op_prep_drafts (
  id                     uuid primary key default gen_random_uuid(),
  product_revision_id    uuid not null references kmi_next.product_revisions(id),
  slot                   text not null check (slot ~ '^(CUT_PREP|OP[1-9][0-9]{1,2})$'),
  op_name                text check (op_name is null or length(op_name) <= 200),
  machine_id             uuid references kmi_next.machines(id),
  nc_document_id         uuid references kmi_next.documents(id),
  cam_program_id         uuid references kmi_next.cam_programs(id),
  tool_list_document_id  uuid references kmi_next.documents(id),
  fixture                text check (fixture is null or length(fixture) <= 2000),
  setup_minutes          numeric check (setup_minutes is null or (setup_minutes > 0 and setup_minutes <= 10000)),
  cycle_seconds          numeric check (cycle_seconds is null or (cycle_seconds > 0 and cycle_seconds <= 86400)),
  control_plan_note      text check (control_plan_note is null or length(control_plan_note) <= 4000),
  first_piece_required   boolean,
  first_piece_note       text check (first_piece_note is null or length(first_piece_note) <= 2000),
  skill_codes            text[] not null default '{}',
  reference_document_ids uuid[] not null default '{}',
  note                   text check (note is null or length(note) <= 4000),
  status                 text not null default 'DRAFT' check (status in ('DRAFT','READY_FOR_REVIEW','APPROVED')),
  missing                text[] not null default '{}',
  row_version            integer not null default 1,
  created_by             uuid not null,
  created_at             timestamptz not null default clock_timestamp(),
  updated_by             uuid not null,
  updated_at             timestamptz not null default clock_timestamp(),
  submitted_by           uuid,
  submitted_at           timestamptz,
  approved_by            uuid,
  approved_at            timestamptz,
  approval_note          text,
  unique (product_revision_id, slot),
  check (status <> 'APPROVED' or (approved_by is not null and approved_at is not null)),
  check (status = 'DRAFT' or cardinality(missing) = 0)
);
comment on table kmi_next.op_prep_drafts is 'KMI-013 operasyon hazırlık TASLAĞI (rotada olmayan operasyon). Rota operasyonu, iş emri veya üretim kaydı değildir. APPROVED = teknik inceleme tamam; rota RELEASE / üretim GO değildir.';

alter table kmi_next.op_prep_drafts enable row level security;
revoke all on kmi_next.op_prep_drafts from public, anon, authenticated;

-- ---------------------------------------------------------------- yardımcılar (dışarı açılmaz)

-- Belge bu revizyona veya ürününe ait, ETKİN ve beklenen türde mi?
create function kmi_next.opp_doc_ok(p_rev kmi_next.product_revisions, p_doc uuid, p_types text[])
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from kmi_next.documents d
                  where d.id = p_doc and d.status = 'ACTIVE' and d.doc_type = any (p_types)
                    and ((d.entity_type = 'PRODUCT_REVISION' and d.entity_id = p_rev.id)
                      or (d.entity_type = 'PRODUCT' and d.entity_id = p_rev.product_id)))
$$;

-- Eksik alan kodları (sunucu hesaplar; istemci değiştiremez). CUT_PREP için NC/CAM ve takım listesi aranmaz.
create function kmi_next.opp_missing(d kmi_next.op_prep_drafts)
returns text[] language sql immutable set search_path to '' as $$
  select array_remove(array[
    case when nullif(btrim(coalesce(d.op_name, '')), '') is null then 'op_name' end,
    case when d.machine_id is null then 'machine' end,
    case when d.slot <> 'CUT_PREP' and d.nc_document_id is null and d.cam_program_id is null then 'nc_cam' end,
    case when d.slot <> 'CUT_PREP' and d.tool_list_document_id is null then 'tool_list' end,
    case when nullif(btrim(coalesce(d.fixture, '')), '') is null then 'fixture' end,
    case when d.setup_minutes is null then 'setup_minutes' end,
    case when d.cycle_seconds is null then 'cycle_seconds' end,
    case when nullif(btrim(coalesce(d.control_plan_note, '')), '') is null then 'control_plan' end,
    case when d.first_piece_required is null then 'first_piece' end,
    case when cardinality(d.skill_codes) = 0 then 'skills' end
  ], null)
$$;

create function kmi_next.opp_json(d kmi_next.op_prep_drafts)
returns jsonb language sql stable security definer set search_path to '' as $$
  select to_jsonb(d) - 'product_revision_id'
$$;

-- Okuma/yazma kapısı: revizyon görünür olmalı; yazmada ROUTING_MANAGE, OBSOLETE yasak; slot rotada ETKİN olmamalı.
create function kmi_next.opp_gate(p_rev uuid, p_slot text, p_write boolean)
returns kmi_next.product_revisions language plpgsql stable security definer set search_path to '' as $$
declare r kmi_next.product_revisions;
begin
  r := kmi_next.rt_gate_revision(p_rev, p_write);
  if p_slot is not null then
    if p_slot !~ '^(CUT_PREP|OP[1-9][0-9]{1,2})$' then raise exception 'OPP_SLOT_INVALID: % (beklenen CUT_PREP veya OP10 biçimi)', p_slot using errcode = '22000'; end if;
    if p_write and p_slot <> 'CUT_PREP' and exists (select 1 from kmi_next.routing_operations o
          where o.product_revision_id = p_rev and o.active and 'OP' || o.op_no = p_slot) then
      raise exception 'OPP_SLOT_IN_ROUTING: % bu revizyonun rotasında zaten var; rota ekranından yönetilir', p_slot using errcode = '22000';
    end if;
  end if;
  return r;
end $$;

create function kmi_next.opp_audit(p_action text, p_id uuid, p_reason text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path to '' as $$
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, before_state, after_state)
  values (auth.uid(), p_action, 'OP_PREP_DRAFT', p_id::text, p_reason, p_before, p_after)
$$;

-- ---------------------------------------------------------------- RPC: okuma

create function kmi_next.op_prep_list(p_revision uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare r kmi_next.product_revisions;
begin
  r := kmi_next.opp_gate(p_revision, null, false);
  return jsonb_build_object(
    'revision', jsonb_build_object('id', r.id, 'revision', r.revision, 'status', r.status),
    'can', jsonb_build_object('edit', kmi_next.rt_can_manage() and r.status <> 'OBSOLETE',
                              'approve', kmi_next.authorize_critical_action('PRODUCT_REV_APPROVE')),
    'routingOps', coalesce((select jsonb_agg(jsonb_build_object('opNo', o.op_no, 'name', o.name, 'camProgramId', o.cam_program_id) order by o.op_no)
                              from kmi_next.routing_operations o where o.product_revision_id = r.id and o.active), '[]'),
    'drafts', coalesce((select jsonb_agg(kmi_next.opp_json(d) order by case when d.slot = 'CUT_PREP' then 0 else 1 end, d.slot)
                          from kmi_next.op_prep_drafts d where d.product_revision_id = r.id), '[]'),
    'machines', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'code', m.code, 'name', m.name, 'status', m.status) order by m.code)
                            from kmi_next.machines m where not m.is_pilot), '[]'),
    'skills', coalesce((select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'category', s.category) order by s.category, s.name)
                          from kmi_next.skill_catalog s where s.active), '[]'),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'docType', d.doc_type, 'title', d.title, 'level', d.entity_type,
                              'versionNo', (select max(v.version_no) from kmi_next.document_versions v where v.document_id = d.id),
                              'fileName', (select v.file_name from kmi_next.document_versions v where v.document_id = d.id order by v.version_no desc limit 1),
                              'linkedOps', coalesce((select jsonb_agg(l.op_no order by l.op_no) from kmi_next.document_op_links l where l.document_id = d.id and l.active), '[]'))
                              order by d.doc_type, d.title)
                            from kmi_next.documents d
                           where d.status = 'ACTIVE' and d.doc_type in ('DRAWING','TECH_DOC','CAD_MODEL','ASSET_PHOTO','NC_PROGRAM','TOOL_LIST')
                             and ((d.entity_type = 'PRODUCT_REVISION' and d.entity_id = r.id) or (d.entity_type = 'PRODUCT' and d.entity_id = r.product_id))), '[]'),
    'camPrograms', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'programNo', c.program_no, 'revision', c.revision, 'status', c.status,
                              'linkedOps', coalesce((select jsonb_agg(o.op_no order by o.op_no) from kmi_next.routing_operations o where o.active and (o.cam_program_id = c.id or o.id = c.routing_operation_id)), '[]'))
                              order by c.program_no, c.revision)
                              from kmi_next.cam_programs c where c.product_revision_id = r.id), '[]'));
end $$;

create function kmi_next.op_prep_history(p_revision uuid, p_slot text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_id uuid;
begin
  perform kmi_next.opp_gate(p_revision, p_slot, false);
  select id into v_id from kmi_next.op_prep_drafts where product_revision_id = p_revision and slot = p_slot;
  if v_id is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'actor', a.actor_user_id, 'reason', a.reason,
                                                       'before', a.before_state, 'after', a.after_state) order by a.at, a.id)
                     from kmi_next.audit_log a where a.entity_type = 'OP_PREP_DRAFT' and a.entity_id = v_id::text), '[]');
end $$;

-- ---------------------------------------------------------------- RPC: yazma

-- p_data: yalnız bilinen alanlar okunur; bilinmeyen anahtar reddedilir. p_expected_version: eşzamanlı düzenleme koruması
-- (yeni taslakta null). Kaydedilen her değişiklik durumu DRAFT'a döndürür (önceki inceleme/onay geçersizleşir).
create function kmi_next.op_prep_save(p_revision uuid, p_slot text, p_data jsonb, p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r kmi_next.product_revisions; d kmi_next.op_prep_drafts; old kmi_next.op_prep_drafts; v_new boolean := false;
        k text; x text; v_uuid uuid; v_num numeric;
        allowed constant text[] := array['op_name','machine_id','nc_document_id','cam_program_id','tool_list_document_id','fixture',
                                          'setup_minutes','cycle_seconds','control_plan_note','first_piece_required','first_piece_note',
                                          'skill_codes','reference_document_ids','note'];
begin
  r := kmi_next.opp_gate(p_revision, p_slot, true);
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'OPP_DATA_INVALID: alanlar nesne olmalı' using errcode = '22000'; end if;
  for k in select jsonb_object_keys(p_data) loop
    if not k = any (allowed) then raise exception 'OPP_FIELD_UNKNOWN: %', k using errcode = '22000'; end if;
  end loop;

  select * into d from kmi_next.op_prep_drafts where product_revision_id = r.id and slot = p_slot for update;
  if not found then
    if p_expected_version is not null then raise exception 'OPP_CONFLICT: taslak bulunamadı (başka kullanıcı silmiş olabilir)' using errcode = '40001'; end if;
    v_new := true;
    d.id := gen_random_uuid(); d.product_revision_id := r.id; d.slot := p_slot; d.row_version := 0;
    d.skill_codes := '{}'; d.reference_document_ids := '{}'; d.created_by := auth.uid(); d.created_at := clock_timestamp();
  elsif p_expected_version is not null and p_expected_version <> d.row_version then
    raise exception 'OPP_CONFLICT: taslak başka biri tarafından değiştirildi (sürüm % ≠ %); sayfayı yenileyin', d.row_version, p_expected_version using errcode = '40001';
  end if;
  old := d;

  -- metin alanları
  if p_data ? 'op_name' then d.op_name := nullif(btrim(p_data->>'op_name'), ''); end if;
  if p_data ? 'fixture' then d.fixture := nullif(btrim(p_data->>'fixture'), ''); end if;
  if p_data ? 'control_plan_note' then d.control_plan_note := nullif(btrim(p_data->>'control_plan_note'), ''); end if;
  if p_data ? 'first_piece_note' then d.first_piece_note := nullif(btrim(p_data->>'first_piece_note'), ''); end if;
  if p_data ? 'note' then d.note := nullif(btrim(p_data->>'note'), ''); end if;
  if p_data ? 'first_piece_required' then
    if jsonb_typeof(p_data->'first_piece_required') not in ('boolean','null') then raise exception 'OPP_FIELD_INVALID: first_piece_required evet/hayır olmalı' using errcode = '22000'; end if;
    d.first_piece_required := (p_data->>'first_piece_required')::boolean;
  end if;
  -- sayılar
  foreach k in array array['setup_minutes','cycle_seconds'] loop
    if p_data ? k then
      x := nullif(btrim(p_data->>k), '');
      begin v_num := x::numeric; exception when others then raise exception 'OPP_FIELD_INVALID: % sayı olmalı', k using errcode = '22000'; end;
      if v_num is not null and v_num <= 0 then raise exception 'OPP_FIELD_INVALID: % sıfırdan büyük olmalı', k using errcode = '22000'; end if;
      if k = 'setup_minutes' then d.setup_minutes := v_num; else d.cycle_seconds := v_num; end if;
    end if;
  end loop;
  -- makine
  if p_data ? 'machine_id' then
    begin v_uuid := nullif(p_data->>'machine_id', '')::uuid; exception when others then raise exception 'OPP_FIELD_INVALID: machine_id' using errcode = '22000'; end;
    if v_uuid is not null and not exists (select 1 from kmi_next.machines m where m.id = v_uuid and not m.is_pilot) then raise exception 'OPP_MACHINE_NOT_FOUND' using errcode = 'P0002'; end if;
    d.machine_id := v_uuid;
  end if;
  -- belgeler: yalnız bu ürün/revizyonun ETKİN ve doğru türdeki belgeleri; otomatik atama yok (yalnız açıkça gönderilen)
  if p_data ? 'nc_document_id' then
    begin v_uuid := nullif(p_data->>'nc_document_id', '')::uuid; exception when others then raise exception 'OPP_FIELD_INVALID: nc_document_id' using errcode = '22000'; end;
    if v_uuid is not null and not kmi_next.opp_doc_ok(r, v_uuid, array['NC_PROGRAM']) then raise exception 'OPP_DOCUMENT_NOT_ALLOWED: NC belgesi bu ürüne ait etkin bir NC programı değil' using errcode = '22000'; end if;
    d.nc_document_id := v_uuid;
  end if;
  if p_data ? 'tool_list_document_id' then
    begin v_uuid := nullif(p_data->>'tool_list_document_id', '')::uuid; exception when others then raise exception 'OPP_FIELD_INVALID: tool_list_document_id' using errcode = '22000'; end;
    if v_uuid is not null and not kmi_next.opp_doc_ok(r, v_uuid, array['TOOL_LIST']) then raise exception 'OPP_DOCUMENT_NOT_ALLOWED: takım listesi bu ürüne ait etkin bir takım listesi değil' using errcode = '22000'; end if;
    d.tool_list_document_id := v_uuid;
  end if;
  if p_data ? 'cam_program_id' then
    begin v_uuid := nullif(p_data->>'cam_program_id', '')::uuid; exception when others then raise exception 'OPP_FIELD_INVALID: cam_program_id' using errcode = '22000'; end;
    if v_uuid is not null and not exists (select 1 from kmi_next.cam_programs c where c.id = v_uuid and c.product_revision_id = r.id) then raise exception 'OPP_CAM_NOT_ALLOWED: CAM kaydı bu revizyona ait değil' using errcode = '22000'; end if;
    d.cam_program_id := v_uuid;
  end if;
  if p_data ? 'reference_document_ids' then
    if jsonb_typeof(p_data->'reference_document_ids') <> 'array' then raise exception 'OPP_FIELD_INVALID: reference_document_ids liste olmalı' using errcode = '22000'; end if;
    d.reference_document_ids := '{}';
    for x in select distinct value from jsonb_array_elements_text(p_data->'reference_document_ids') loop
      begin v_uuid := x::uuid; exception when others then raise exception 'OPP_FIELD_INVALID: reference_document_ids' using errcode = '22000'; end;
      if not kmi_next.opp_doc_ok(r, v_uuid, array['DRAWING','TECH_DOC','CAD_MODEL','ASSET_PHOTO']) then raise exception 'OPP_DOCUMENT_NOT_ALLOWED: referans belge bu ürüne ait etkin bir teknik resim/STEP/fotoğraf değil' using errcode = '22000'; end if;
      d.reference_document_ids := d.reference_document_ids || v_uuid;
    end loop;
  end if;
  if p_data ? 'skill_codes' then
    if jsonb_typeof(p_data->'skill_codes') <> 'array' then raise exception 'OPP_FIELD_INVALID: skill_codes liste olmalı' using errcode = '22000'; end if;
    d.skill_codes := '{}';
    for x in select distinct value from jsonb_array_elements_text(p_data->'skill_codes') loop
      if not exists (select 1 from kmi_next.skill_catalog s where s.code = x and s.active) then raise exception 'OPP_SKILL_UNKNOWN: %', x using errcode = '22000'; end if;
      d.skill_codes := d.skill_codes || x;
    end loop;
  end if;

  if not v_new and kmi_next.opp_json(d) - array['updated_at','updated_by'] = kmi_next.opp_json(old) - array['updated_at','updated_by'] then
    return kmi_next.opp_json(d) || jsonb_build_object('unchanged', true);
  end if;

  d.missing := kmi_next.opp_missing(d);
  d.status := 'DRAFT'; d.submitted_by := null; d.submitted_at := null; d.approved_by := null; d.approved_at := null; d.approval_note := null;
  d.row_version := d.row_version + 1; d.updated_by := auth.uid(); d.updated_at := clock_timestamp();

  if v_new then insert into kmi_next.op_prep_drafts select d.*;
  else update kmi_next.op_prep_drafts set
      op_name = d.op_name, machine_id = d.machine_id, nc_document_id = d.nc_document_id, cam_program_id = d.cam_program_id,
      tool_list_document_id = d.tool_list_document_id, fixture = d.fixture, setup_minutes = d.setup_minutes, cycle_seconds = d.cycle_seconds,
      control_plan_note = d.control_plan_note, first_piece_required = d.first_piece_required, first_piece_note = d.first_piece_note,
      skill_codes = d.skill_codes, reference_document_ids = d.reference_document_ids, note = d.note, status = d.status, missing = d.missing,
      row_version = d.row_version, updated_by = d.updated_by, updated_at = d.updated_at, submitted_by = null, submitted_at = null,
      approved_by = null, approved_at = null, approval_note = null
    where id = d.id;
  end if;

  perform kmi_next.opp_audit(case when v_new then 'OP_PREP_CREATED' else 'OP_PREP_SAVED' end, d.id,
    case when old.status in ('READY_FOR_REVIEW','APPROVED') then 'Düzenleme: önceki ' || old.status || ' durumu taslağa döndü' end,
    case when v_new then null else kmi_next.opp_json(old) end, kmi_next.opp_json(d));
  perform kmi_next.pm_event(r.product_id, r.id, 'OP_PREP_SAVED', p_slot || ' hazırlık taslağı kaydedildi (eksik: ' || cardinality(d.missing) || ')', null,
    jsonb_build_object('slot', p_slot, 'draft_id', d.id, 'row_version', d.row_version, 'missing', to_jsonb(d.missing)));
  return kmi_next.opp_json(d);
end $$;

-- Durum: DRAFT (geri al) · READY_FOR_REVIEW (eksik yoksa; ROUTING_MANAGE) · APPROVED (yalnız READY_FOR_REVIEW'dan; PRODUCT_REV_APPROVE).
create function kmi_next.op_prep_set_status(p_revision uuid, p_slot text, p_status text, p_expected_version integer, p_note text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r kmi_next.product_revisions; d kmi_next.op_prep_drafts; old kmi_next.op_prep_drafts;
begin
  if p_status not in ('DRAFT','READY_FOR_REVIEW','APPROVED') then raise exception 'OPP_STATUS_INVALID: %', p_status using errcode = '22000'; end if;
  if p_status = 'APPROVED' then
    r := kmi_next.opp_gate(p_revision, p_slot, false);
    if r.status = 'OBSOLETE' then raise exception 'REVISION_OBSOLETE' using errcode = '22000'; end if;
    if not kmi_next.authorize_critical_action('PRODUCT_REV_APPROVE') then raise exception 'FORBIDDEN: PRODUCT_REV_APPROVE' using errcode = '42501'; end if;
  else
    r := kmi_next.opp_gate(p_revision, p_slot, true);
  end if;
  select * into d from kmi_next.op_prep_drafts where product_revision_id = r.id and slot = p_slot for update;
  if not found then raise exception 'OPP_NOT_FOUND: % için taslak yok', p_slot using errcode = 'P0002'; end if;
  if p_expected_version is null or p_expected_version <> d.row_version then
    raise exception 'OPP_CONFLICT: taslak değişti (sürüm % ≠ %); sayfayı yenileyin', d.row_version, p_expected_version using errcode = '40001';
  end if;
  old := d;
  d.missing := kmi_next.opp_missing(d);
  if p_status = 'READY_FOR_REVIEW' then
    if cardinality(d.missing) > 0 then raise exception 'OPP_INCOMPLETE: eksik alanlar: %', array_to_string(d.missing, ', ') using errcode = '22000'; end if;
    if d.status <> 'DRAFT' then raise exception 'OPP_STATUS_TRANSITION: % → READY_FOR_REVIEW yapılamaz', d.status using errcode = '22000'; end if;
    d.submitted_by := auth.uid(); d.submitted_at := clock_timestamp();
  elsif p_status = 'APPROVED' then
    if d.status <> 'READY_FOR_REVIEW' then raise exception 'OPP_STATUS_TRANSITION: yalnız TEKNİK İNCELEMEYE HAZIR taslak onaylanır' using errcode = '22000'; end if;
    if cardinality(d.missing) > 0 then raise exception 'OPP_INCOMPLETE: eksik alanlar: %', array_to_string(d.missing, ', ') using errcode = '22000'; end if;
    d.approved_by := auth.uid(); d.approved_at := clock_timestamp(); d.approval_note := nullif(btrim(coalesce(p_note, '')), '');
  else
    if d.status = 'DRAFT' then return kmi_next.opp_json(d) || jsonb_build_object('unchanged', true); end if;
    d.submitted_by := null; d.submitted_at := null; d.approved_by := null; d.approved_at := null; d.approval_note := null;
  end if;
  d.status := p_status; d.row_version := d.row_version + 1; d.updated_by := auth.uid(); d.updated_at := clock_timestamp();
  update kmi_next.op_prep_drafts set status = d.status, missing = d.missing, row_version = d.row_version, updated_by = d.updated_by, updated_at = d.updated_at,
      submitted_by = d.submitted_by, submitted_at = d.submitted_at, approved_by = d.approved_by, approved_at = d.approved_at, approval_note = d.approval_note
    where id = d.id;
  perform kmi_next.opp_audit('OP_PREP_STATUS_' || p_status, d.id, nullif(btrim(coalesce(p_note, '')), ''),
    jsonb_build_object('status', old.status, 'row_version', old.row_version), jsonb_build_object('status', d.status, 'row_version', d.row_version));
  perform kmi_next.pm_event(r.product_id, r.id, 'OP_PREP_STATUS', p_slot || ' hazırlık durumu: ' || old.status || ' → ' || d.status
      || case when d.status = 'APPROVED' then ' (teknik inceleme; rota RELEASE / üretim GO değildir)' else '' end, null,
    jsonb_build_object('slot', p_slot, 'draft_id', d.id, 'from', old.status, 'to', d.status));
  return kmi_next.opp_json(d);
end $$;

-- ---------------------------------------------------------------- yetkiler
revoke all on function kmi_next.opp_doc_ok(kmi_next.product_revisions, uuid, text[]) from public, anon, authenticated;
revoke all on function kmi_next.opp_missing(kmi_next.op_prep_drafts) from public, anon, authenticated;
revoke all on function kmi_next.opp_json(kmi_next.op_prep_drafts) from public, anon, authenticated;
revoke all on function kmi_next.opp_gate(uuid, text, boolean) from public, anon, authenticated;
revoke all on function kmi_next.opp_audit(text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function kmi_next.op_prep_list(uuid) from public, anon;
revoke all on function kmi_next.op_prep_history(uuid, text) from public, anon;
revoke all on function kmi_next.op_prep_save(uuid, text, jsonb, integer) from public, anon;
revoke all on function kmi_next.op_prep_set_status(uuid, text, text, integer, text) from public, anon;
grant execute on function kmi_next.op_prep_list(uuid) to authenticated;
grant execute on function kmi_next.op_prep_history(uuid, text) to authenticated;
grant execute on function kmi_next.op_prep_save(uuid, text, jsonb, integer) to authenticated;
grant execute on function kmi_next.op_prep_set_status(uuid, text, text, integer, text) to authenticated;

commit;
