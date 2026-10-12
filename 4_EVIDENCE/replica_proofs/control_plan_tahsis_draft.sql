-- Rollback-only verification of DRAFT 0076 (control plan tables + TAHSİS on the existing NCR). LOCAL REPLICA only.
begin;
\! sed '/^begin;$/d;/^commit;$/d' supabase/drafts/0076_control_plan_tahsis.sql > /var/tmp/kmi_verify_pg/d0076.sql
\i /var/tmp/kmi_verify_pg/d0076.sql
do $$
declare s uuid := '00000000-0000-0000-0000-000000000003'; opu uuid := gen_random_uuid(); qau uuid := gen_random_uuid(); prod uuid; rev uuid; v_order uuid; item uuid; wo uuid; n kmi_next.quality_ncrs; n2 kmi_next.quality_ncrs; v_out text := ''; v_err text; w kmi_next.work_orders; decl_before int; decl_after int; m uuid; c int;
begin
  insert into public.user_profiles (id) values (opu), (qau);
  insert into public.user_roles (user_id, role_id) select opu, id from public.roles where code = 'OPERATOR';
  insert into public.user_roles (user_id, role_id) select qau, id from public.roles where code = 'QUALITY';
  insert into kmi_next.products (code, name, created_by) values ('TH-1', 'tahsis parça', s) returning id into prod;
  insert into kmi_next.product_revisions (product_id, revision, status) values (prod, 'A', 'RELEASED') returning id into rev;
  insert into kmi_next.orders (customer_id, customer_po, status, created_by) values (s, 'TH-PO', 'CONFIRMED', s) returning id into v_order;
  insert into kmi_next.order_items (order_id, product_id, qty, unit_price, due_date) values (v_order, prod, 10, 1, current_date + 10) returning id into item;
  insert into kmi_next.work_orders (order_item_id, status, qty_planned, qty_produced, product_revision_id, created_by) values (item, 'IN_PROGRESS', 10, 10, rev, s) returning id into wo;
  select id into m from kmi_next.machines order by code limit 1;
  select count(*) into decl_before from kmi_next.production_declarations;
  -- A. authorization: an operator cannot open a TAHSİS case (owner has not approved operator self-declaration)
  perform set_config('request.jwt.claims', json_build_object('sub', opu::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.open_tahsis_ncr(wo, 2, 'çap büyük', 'OPERATOR_SELF_DECLARED'); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 24); end; v_out := v_out || 'operator_open=' || v_err;
  -- B. quality opens; detection source mandatory
  perform set_config('request.jwt.claims', json_build_object('sub', qau::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.open_tahsis_ncr(wo, 2, 'çap büyük', null); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' no_source=' || v_err;
  n := kmi_next.open_tahsis_ncr(wo, 2, 'çap büyük', 'QUALITY_DETECTED', 'th-1');
  select * into w from kmi_next.work_orders where id = wo;
  v_out := v_out || format(' kind=%s src=%s produced_after_open=%s wo=%s', n.kind, n.detection_source, w.qty_produced, w.status);
  -- C. dimension record: oversize accepted; in-tolerance / undersize refused; more than NCR qty refused; non-TAHSIS refused
  perform kmi_next.add_tahsis_characteristic(n.id, rev, 10, 'D1', 'delik Ø40', 40, -0.02, 0.02, 40.08, 2, m, null, null, 'foto-1', 'min. talaş al');
  v_out := v_out || format(' oversize=%s', (select oversize_excess from kmi_next.quality_ncr_characteristics where ncr_id = n.id));
  begin perform kmi_next.add_tahsis_characteristic(n.id, rev, 10, 'D2', null, 40, -0.02, 0.02, 40.01, 1, null, null, null, null, null); v_err := 'NO_ERROR'; exception when check_violation then v_err := 'IN_TOLERANCE_REFUSED'; end; v_out := v_out || ' in_tol=' || v_err;
  begin perform kmi_next.add_tahsis_characteristic(n.id, rev, 10, 'D3', null, 40, -0.02, 0.02, 39.9, 1, null, null, null, null, null); v_err := 'NO_ERROR'; exception when check_violation then v_err := 'UNDERSIZE_REFUSED'; end; v_out := v_out || ' under=' || v_err;
  begin perform kmi_next.add_tahsis_characteristic(n.id, rev, 10, 'D4', null, 40, -0.02, 0.02, 40.5, 3, null, null, null, null, null); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' over_qty=' || v_err;
  begin update kmi_next.quality_ncr_characteristics set measured = 40.02 where ncr_id = n.id; v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' edit=' || v_err;
  n2 := kmi_next.open_quality_ncr(wo, 1, 'çizik');   -- plain NCR
  begin perform kmi_next.add_tahsis_characteristic(n2.id, rev, 10, 'D5', null, 40, -0.02, 0.02, 40.5, 1, null, null, null, null, null); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' plain_ncr=' || v_err;
  -- D. existing state machine, quantity counted once: OPEN -> REWORK -> RECHECK_PENDING -> ACCEPTED
  perform kmi_next.transition_quality_ncr(n.id, 'REWORK', 'yetkili ek talaş'); perform kmi_next.transition_quality_ncr(n.id, 'RECHECK_PENDING', 'işlem bitti'); perform kmi_next.transition_quality_ncr(n.id, 'ACCEPTED', 'ölçü uygun');
  select * into w from kmi_next.work_orders where id = wo;
  select count(*) into decl_after from kmi_next.production_declarations;
  v_out := v_out || format(' produced_after_accept=%s (plain ncr still holds 1) scrap=%s declarations_delta=%s', w.qty_produced, w.qty_scrap, decl_after - decl_before);
  -- E. read access; no write grants on control-plan tables
  select count(*) into c from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'kmi_next' and table_name in ('control_plans','control_plan_characteristics','quality_ncr_characteristics') and privilege_type <> 'SELECT';
  v_out := v_out || ' extra_write_grants=' || c;
  raise notice 'TAHSIS_RESULTS %', v_out;
end $$;
rollback;
