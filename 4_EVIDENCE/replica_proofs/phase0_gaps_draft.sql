-- Rollback-only verification of DRAFT 0075 (PO duplicate prevention) + proof that the max-3 active operations/operator cap already exists (HARD_CAP_EXCEEDED, 0013/0032). LOCAL REPLICA only.
begin;
-- the draft carries its own begin/commit (owner applies it as is); strip them so this check stays rollback-only
\! sed '/^begin;$/d;/^commit;$/d' supabase/drafts/0075_customer_po_uniqueness.sql > /var/tmp/kmi_verify_pg/d0075.sql
\i /var/tmp/kmi_verify_pg/d0075.sql
do $$
declare s uuid := '00000000-0000-0000-0000-000000000003'; ms uuid[]; prod uuid; rev uuid; v_order uuid; item uuid; w uuid[] := '{}'; wo uuid; ops uuid[] := '{}'; o uuid; op1 uuid; i int; v_out text := ''; v_err text; cust uuid := s;
begin
  execute $f$create or replace function kmi_next.authorize_critical_action(p_action_code text) returns boolean language sql security definer set search_path = '' as 'select true'$f$;
  perform set_config('request.jwt.claims', json_build_object('sub', s::text, 'role', 'authenticated')::text, true);
  -- A. PO duplicate: same customer + same PO (different case/space) refused; other customer allowed; after CANCELLED re-entry allowed
  insert into kmi_next.orders (customer_id, customer_po, status, created_by) values (s, 'PO-77', 'CONFIRMED', s) returning id into v_order;
  begin insert into kmi_next.orders (customer_id, customer_po, created_by) values (s, ' po-77 ', s); v_err := 'NO_ERROR'; exception when unique_violation then v_err := 'DUPLICATE_REFUSED'; end;
  v_out := v_out || 'dup_same_customer=' || v_err;
  insert into kmi_next.orders (customer_id, customer_po, created_by) values (gen_random_uuid(), 'PO-77', s);
  v_out := v_out || ' other_customer=OK';
  update kmi_next.orders set status = 'CANCELLED' where id = v_order;
  insert into kmi_next.orders (customer_id, customer_po, created_by) values (s, 'PO-77', s);
  v_out := v_out || ' after_cancel=OK';
  -- B. operator limit
  select array_agg(id order by code) into ms from (select id, code from kmi_next.machines where status = 'UP' order by code limit 4) q;
  if array_length(ms, 1) < 4 then raise exception 'NEED_4_UP_MACHINES'; end if;
  insert into kmi_next.personnel (name, roles, department, shift_code) values ('Limit Op', '{OPERATOR}', 'URETIM', 'TeamK1') returning id into op1;
  insert into kmi_next.products (code, name, created_by) values ('LIM-1', 'limit parça', s) returning id into prod;
  insert into kmi_next.product_revisions (product_id, revision, status) values (prod, 'A', 'RELEASED') returning id into rev;
  perform kmi_next.set_routing_operation(rev, 10, 'tek op', ms, null, null, null, null, null, false, false, null, 'rota tanımı');
  insert into kmi_next.orders (customer_id, customer_po, status, created_by) values (s, 'LIM-PO', 'CONFIRMED', s) returning id into v_order;
  insert into kmi_next.order_items (order_id, product_id, qty, unit_price, due_date) values (v_order, prod, 10, 1, current_date + 10) returning id into item;
  for i in 1..4 loop
    insert into kmi_next.work_orders (order_item_id, status, qty_planned, product_revision_id, created_by) values (item, 'PLANNED', 10, rev, s) returning id into wo;
    perform kmi_next.apply_routing_to_work_order(wo);
    select id into o from kmi_next.work_order_operations where work_order_id = wo; ops := ops || o;
    update kmi_next.work_order_operations set qty_in = 10 where id = o;
  end loop;
  for i in 1..3 loop update kmi_next.work_order_operations set status = 'RUNNING', machine_id = ms[i], operator_id = op1 where id = ops[i]; end loop;
    v_out := v_out || ' fourth_refusal=' || coalesce(kmi_next.operation_start_refusal(ops[4], ms[4], op1), 'OK');
  raise notice 'PHASE0_RESULTS %', v_out;
end $$;
rollback;
