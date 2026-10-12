-- Rollback-only verification of DRAFT 0074 (supabase/drafts/0074_temporal_audit_hardening.sql). LOCAL REPLICA only. Applies the draft inside the transaction, then rolls it back.
begin;
\i supabase/drafts/0074_temporal_audit_hardening.sql
do $$
declare
  mgr uuid := gen_random_uuid(); mnt uuid := gen_random_uuid(); op uuid := gen_random_uuid(); qa uuid := gen_random_uuid();
  v_out text := ''; v_err text; mc uuid; n int; r kmi_next.audit_log; c1 uuid; c2 uuid; note kmi_next.object_notes; tk kmi_next.tasks; before_n int;
begin
  insert into public.user_profiles (id) values (mgr), (mnt), (op), (qa);
  insert into public.user_roles (user_id, role_id) select mgr, id from public.roles where code = 'MANAGEMENT';
  insert into public.user_roles (user_id, role_id) select mnt, id from public.roles where code = 'MAINTENANCE';
  insert into public.user_roles (user_id, role_id) select op, id from public.roles where code = 'OPERATOR';
  insert into public.user_roles (user_id, role_id) select qa, id from public.roles where code = 'QUALITY';
  insert into kmi_next.machines (code, name) values ('TM1', 'Taslak makine') returning id into mc;

  -- A. one writer call (maintenance) -> role context, correlation id, server time; rows of ONE call share the correlation id
  perform set_config('request.jwt.claims', json_build_object('sub', mnt::text, 'role', 'authenticated')::text, true);
  perform kmi_next.set_machine_down(mc, 'iş mili sesi', 'HIGH');
  select * into r from kmi_next.audit_log where entity_id = mc::text and action = 'MACHINE_SET_DOWN';
  v_out := v_out || format('role_context=%s corr_set=%s outcome=%s', r.role_context, r.correlation_id is not null, r.outcome);
  select count(distinct correlation_id) into n from kmi_next.audit_log where actor_user_id = mnt;
  v_out := v_out || format(' calls_corr_ids=%s', n);
  -- occurred_at: honoured when plausible, dropped when in the future, junk ignored; browser time is not an input at all
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, after_state) values (mnt, 'T_LATE', 'MACHINE', mc::text, '{"occurredAt":"2026-01-01T10:00:00Z"}');
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, after_state) values (mnt, 'T_FUTURE', 'MACHINE', mc::text, '{"occurredAt":"2999-01-01T10:00:00Z"}');
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, after_state) values (mnt, 'T_JUNK', 'MACHINE', mc::text, '{"occurredAt":"yarın sabah"}');
  v_out := v_out || format(' late=%s future=%s junk=%s',
    (select occurred_at is not null from kmi_next.audit_log where action = 'T_LATE'), (select occurred_at is null from kmi_next.audit_log where action = 'T_FUTURE'), (select occurred_at is null from kmi_next.audit_log where action = 'T_JUNK'));

  -- B. append-only
  begin update kmi_next.audit_log set reason = 'oynandı' where action = 'T_LATE'; v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 17); end; v_out := v_out || ' update=' || v_err;
  begin delete from kmi_next.audit_log where action = 'T_LATE'; v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 17); end; v_out := v_out || ' delete=' || v_err;
  begin truncate kmi_next.audit_log; v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 17); end; v_out := v_out || ' truncate=' || v_err;

  -- C. read scope under the authenticated role
  perform set_config('request.jwt.claims', json_build_object('sub', op::text, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from kmi_next.audit_log where entity_type = 'MACHINE'; v_out := v_out || format(' operator_sees_machine_rows=%s', n);
  select count(*) into n from kmi_next.audit_log where entity_type = 'MAINTENANCE_TICKET'; v_out := v_out || format(' operator_sees_ticket_rows=%s', n);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', qa::text, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from kmi_next.audit_log where entity_type = 'MAINTENANCE_TICKET'; v_out := v_out || format(' quality_sees_ticket_rows=%s', n);
  select count(*) into n from kmi_next.audit_log where entity_type = 'MACHINE'; v_out := v_out || format(' quality_sees_machine_rows=%s', n);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', mgr::text, 'role', 'authenticated')::text, true); set local role authenticated;
  select count(*) into n from kmi_next.audit_log; v_out := v_out || format(' mgmt_sees_all=%s', n = (select count(*) from (select 1 from kmi_next.audit_log) x));
  reset role;
  select count(*) into n from kmi_next.audit_log; before_n := n;

  -- D. notes: allowed role writes; operator cannot annotate a ticket; note is audited and append-only; unsupported kind refused
  perform set_config('request.jwt.claims', json_build_object('sub', mnt::text, 'role', 'authenticated')::text, true);
  note := kmi_next.add_object_note('MACHINE', mc::text, 'Rulman sesi dinlendi, parça sipariş edilecek');
  v_out := v_out || format(' note_audit=%s', (select count(*) from kmi_next.audit_log where action = 'NOTE_ADDED' and entity_id = mc::text));
  perform set_config('request.jwt.claims', json_build_object('sub', op::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.add_object_note('MAINTENANCE_TICKET', gen_random_uuid()::text, 'yetkisiz not'); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 28); end; v_out := v_out || ' op_note_ticket=' || v_err;
  perform set_config('request.jwt.claims', json_build_object('sub', mnt::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.add_object_note('CUSTOMER', gen_random_uuid()::text, 'müşteri notu'); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 26); end; v_out := v_out || ' customer_note=' || v_err;
  begin perform kmi_next.add_object_note('MACHINE', gen_random_uuid()::text, 'olmayan makine'); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 22); end; v_out := v_out || ' ghost_machine=' || v_err;
  begin update kmi_next.object_notes set body = 'değişti'; v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 17); end; v_out := v_out || ' note_update=' || v_err;

  -- E. task from a machine object now possible; route points at the passport
  perform set_config('request.jwt.claims', json_build_object('sub', mgr::text, 'role', 'authenticated')::text, true);
  tk := kmi_next.create_task('Makine rulman kontrolü', 'Pasaporttan', mnt, null, null, null, 'MACHINE', mc::text, false, 'draft-req-0001');
  v_out := v_out || format(' task_from_machine=%s route=%s', tk.source_type, kmi_next.task_route('MACHINE', mc::text));
  raise exception 'ROLLBACK_RESULTS: %', v_out;
end $$;
rollback;
