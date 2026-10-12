-- Role visibility MEASUREMENT on the replica (current migrations 0001–0073, no drafts). Rollback-only. For every role: how many rows of sensitive tables a signed-in holder of ONLY that role can read.
begin;
do $$
declare s uuid := '00000000-0000-0000-0000-000000000003'; r record; u uuid; t text; n bigint; line text; cust uuid; po uuid;
  tabs text[] := array['customers','orders','suppliers','personnel','commercial_approvals','invoices','supplier_invoices','audit_log','quality_ncrs','stock_lots','personnel_skills','work_orders','purchase_orders','shipments'];
begin
  insert into kmi_next.customers (code, name, created_by) values ('VM-1', 'Matris Müşteri', s) returning id into cust;
  insert into kmi_next.orders (customer_id, customer_po, created_by) values (cust, 'VM-PO', s);
  insert into kmi_next.suppliers (name, contact_info) values ('Matris Tedarik', 'gizli@tedarik.test');
  insert into kmi_next.personnel (name, roles, department, shift_code, puantaj_multiplier) values ('Matris Kişi', '{OPERATOR}', 'URETIM', 'TeamK1', 1.5);
  insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id) values (s, 'VM_SEED', 'MACHINE', 'x'), (s, 'VM_SEED2', 'INVOICE', 'x');
  for r in select id, code from public.roles order by code loop
    u := gen_random_uuid(); insert into public.user_profiles (id) values (u); insert into public.user_roles (user_id, role_id) values (u, r.id);
    perform set_config('request.jwt.claims', json_build_object('sub', u::text, 'role', 'authenticated')::text, true);
    set local role authenticated; line := 'ROLE ' || r.code || ':';
    foreach t in array tabs loop
      begin execute format('select count(*) from kmi_next.%I', t) into n; line := line || format(' %s=%s', t, n); exception when others then line := line || format(' %s=DENIED', t); end;
    end loop;
    begin execute 'select count(*) from kmi_next.suppliers where contact_info is not null' into n; line := line || format(' supplier_contact_visible=%s', n); exception when others then null; end;
    begin execute 'select count(*) from kmi_next.personnel where puantaj_multiplier <> 1' into n; line := line || format(' puantaj_multiplier_visible=%s', n); exception when others then null; end;
    reset role; raise notice '%', line;
  end loop;
end $$;
rollback;
