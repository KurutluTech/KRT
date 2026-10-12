-- Rollback-only verification of DRAFT 0077 (one PENDING commercial approval per lot). LOCAL REPLICA only.
begin;
\! sed '/^begin;$/d;/^commit;$/d' supabase/drafts/0077_commercial_approval_dedup.sql > /var/tmp/kmi_verify_pg/d0077.sql
\i /var/tmp/kmi_verify_pg/d0077.sql
do $$
declare s uuid := '00000000-0000-0000-0000-000000000003'; po uuid; pl uuid; lot uuid; a1 kmi_next.commercial_approvals; a2 kmi_next.commercial_approvals; n int; v_out text := ''; v_err text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', s::text, 'role', 'authenticated')::text, true);
  insert into kmi_next.suppliers (name) values ('DD Tedarik') returning id into po;
  insert into kmi_next.purchase_orders (supplier_id, status, currency, created_by) values (po, 'RECEIVED', 'EUR', s) returning id into po;
  insert into kmi_next.purchase_order_lines (purchase_order_id, material_code, qty_ordered, qty_received, unit_price) values (po, 'AL-DD', 10, 10, 1) returning id into pl;
  insert into kmi_next.stock_lots (purchase_order_line_id, qty, state, created_by) values (pl, 10, 'AVAILABLE', s) returning id into lot;
  a1 := kmi_next.request_commercial_approval(lot); a2 := kmi_next.request_commercial_approval(lot);
  select count(*) into n from kmi_next.commercial_approvals where stock_lot_id = lot;
  v_out := format('same_row=%s rows=%s', a1.id = a2.id, n);
  begin insert into kmi_next.commercial_approvals (stock_lot_id, requested_by) values (lot, s); v_err := 'NO_ERROR'; exception when unique_violation then v_err := 'DUPLICATE_PENDING_REFUSED'; end;
  v_out := v_out || ' direct_insert=' || v_err;
  update kmi_next.commercial_approvals set status = 'REJECTED' where id = a1.id;
  a2 := kmi_next.request_commercial_approval(lot);
  v_out := v_out || format(' new_after_decision=%s total=%s', a2.id <> a1.id, (select count(*) from kmi_next.commercial_approvals where stock_lot_id = lot));
  raise notice 'COMMERCIAL_RESULTS %', v_out;
end $$;
rollback;
