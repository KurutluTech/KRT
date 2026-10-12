-- Rollback-only verification of DRAFT 0078 (Cost Intelligence foundation) on the REAL authorization functions. LOCAL REPLICA only. Synthetic data; not factory evidence.
begin;
\! sed '/^begin;$/d;/^commit;$/d' supabase/drafts/0078_cost_intelligence_foundation.sql > /var/tmp/kmi_verify_pg/d0078.sql
\i /var/tmp/kmi_verify_pg/d0078.sql
do $$
declare owner uuid := gen_random_uuid(); acc uuid := gen_random_uuid(); noacc uuid := gen_random_uuid(); op uuid := gen_random_uuid();
  b kmi_next.cost_import_batches; b2 kmi_next.cost_import_batches; b3 kmi_next.cost_import_batches; e uuid; v_out text := ''; v_err text; n int;
  rows1 jsonb := '[{"ok":true,"issues":[],"values":{"categoryCode":"KIRA","amount":45000,"currency":"TRY","periodStart":"2026-03-01","periodEnd":"2026-03-31","documentRef":"F-1"}},
                   {"ok":true,"issues":[],"values":{"categoryCode":"ELEKTRIK","amount":12340.5,"currency":"TRY","periodStart":"2026-02-15","periodEnd":"2026-03-14","documentRef":"F-2"}},
                   {"ok":false,"issues":[{"code":"BAD_NUMBER"}],"values":{"categoryCode":"KIRA","amount":null,"currency":"TRY","periodStart":null,"periodEnd":null,"documentRef":null}}]';
begin
  insert into public.user_profiles (id) values (owner), (acc), (noacc), (op);
  insert into public.user_roles (user_id, role_id) select owner, id from public.roles where code = 'ACCOUNTING';
  insert into public.user_roles (user_id, role_id) select acc, id from public.roles where code = 'ACCOUNTING';
  insert into public.user_roles (user_id, role_id) select noacc, id from public.roles where code = 'ACCOUNTING';
  insert into public.user_roles (user_id, role_id) select op, id from public.roles where code = 'OPERATOR';
  with q as (insert into kmi_next.economic_owner_binding_requests (user_id, email, email_confirmed_at, expires_at) values (owner, 'harness@ornek.test', now(), now() + interval '30 minutes') returning id) insert into kmi_next.economic_owner_bindings (owner_user_id, method, request_id) select owner, 'SIGNED_IN_REQUEST', id from q;
  insert into kmi_next.economic_access_grants (user_id, reason, granted_by) values (acc, 'maliyet hazırlığı', owner);
  -- A. staging authorization
  perform set_config('request.jwt.claims', json_build_object('sub', op::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.stage_cost_import('mart.csv', 'TR', 'fp-1', rows1); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 28); end; v_out := v_out || 'operator_stage=' || v_err;
  perform set_config('request.jwt.claims', json_build_object('sub', noacc::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.stage_cost_import('mart.csv', 'TR', 'fp-1', rows1); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 28); end; v_out := v_out || ' accounting_without_economic_access=' || v_err;
  perform set_config('request.jwt.claims', json_build_object('sub', acc::text, 'role', 'authenticated')::text, true);
  b := kmi_next.stage_cost_import('mart.csv', 'TR', 'fp-1', rows1); b2 := kmi_next.stage_cost_import('mart.csv', 'TR', 'fp-1', rows1);
  v_out := v_out || format(' staged rows=%s ok=%s err=%s same_batch_on_restage=%s expenses_before_approval=%s', b.row_count, b.ok_count, b.error_count, b.id = b2.id, (select count(*) from kmi_next.cost_expenses));
  -- B. approval: preparer (not owner) refused; owner approves; only OK rows become expenses
  begin perform kmi_next.decide_cost_import(b.id, true, 'onay denemesi'); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 28); end; v_out := v_out || ' preparer_approves=' || v_err;
  perform set_config('request.jwt.claims', json_build_object('sub', owner::text, 'role', 'authenticated')::text, true);
  begin perform kmi_next.decide_cost_import(b.id, true, 'x'); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' no_note=' || v_err;
  b := kmi_next.decide_cost_import(b.id, true, 'mart dönemi kontrol edildi');
  v_out := v_out || format(' approved=%s expenses=%s', b.status, (select count(*) from kmi_next.cost_expenses));
  begin perform kmi_next.decide_cost_import(b.id, true, 'tekrar onay'); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' redecide=' || v_err;
  -- C. idempotent re-import under a different file fingerprint: same content -> no new expenses
  perform set_config('request.jwt.claims', json_build_object('sub', acc::text, 'role', 'authenticated')::text, true);
  b3 := kmi_next.stage_cost_import('mart-yeniden.csv', 'TR', 'fp-2', rows1);
  perform set_config('request.jwt.claims', json_build_object('sub', owner::text, 'role', 'authenticated')::text, true);
  perform kmi_next.decide_cost_import(b3.id, true, 'aynı veri tekrar yüklendi');
  v_out := v_out || format(' expenses_after_reimport=%s', (select count(*) from kmi_next.cost_expenses));
  -- D. owner self-approval blocked
  perform set_config('request.jwt.claims', json_build_object('sub', owner::text, 'role', 'authenticated')::text, true);
  b2 := kmi_next.stage_cost_import('owner.csv', 'TR', 'fp-3', rows1);
  begin perform kmi_next.decide_cost_import(b2.id, true, 'kendi hazırladığım'); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' owner_self_approval=' || v_err;
  -- E. period close + adjustment
  perform kmi_next.close_cost_period('2026-03', 'mart kapandı');
  begin insert into kmi_next.cost_expenses (category_code, amount, currency, service_start, service_end) values ('KIRA', 100, 'TRY', '2026-03-10', '2026-03-10'); v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 13); end; v_out := v_out || ' closed_period_entry=' || v_err;
  insert into kmi_next.cost_expenses (kind, category_code, amount, currency, service_start, service_end) values ('ADJUSTMENT', 'KIRA', 100, 'TRY', '2026-03-10', '2026-03-10'); v_out := v_out || ' adjustment=OK';
  begin perform kmi_next.close_cost_period('2026-03', 'tekrar'); v_err := 'NO_ERROR'; exception when others then v_err := sqlerrm; end; v_out := v_out || ' reclose=' || v_err;
  -- F. allocation guard + append-only
  select id into e from kmi_next.cost_expenses where category_code = 'KIRA' and amount = 45000;
  insert into kmi_next.cost_centers (code, name, kind) values ('FAB', 'Fabrika', 'FACTORY'), ('D-TALASLI', 'Talaşlı imalat', 'DEPARTMENT');
  insert into kmi_next.cost_allocations (expense_id, cost_center_id, amount, driver, rule_version) select e, id, 30000, 'ALAN', 1 from kmi_next.cost_centers where code = 'FAB';
  begin insert into kmi_next.cost_allocations (expense_id, cost_center_id, amount, driver, rule_version) select e, id, 15000.01, 'ALAN', 1 from kmi_next.cost_centers where code = 'D-TALASLI'; v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 17); end; v_out := v_out || ' over_allocation=' || v_err;
  insert into kmi_next.cost_allocations (expense_id, cost_center_id, amount, driver, rule_version) select e, id, 15000, 'ALAN', 1 from kmi_next.cost_centers where code = 'D-TALASLI'; v_out := v_out || ' exact_remaining=OK';
  begin update kmi_next.cost_expenses set amount = 1 where id = e; v_err := 'NO_ERROR'; exception when others then v_err := left(sqlerrm, 11); end; v_out := v_out || ' expense_edit=' || v_err;
  -- G. read visibility under the authenticated role
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', op::text, 'role', 'authenticated')::text, true); select count(*) into n from kmi_next.cost_expenses; v_out := v_out || ' operator_reads=' || n;
  perform set_config('request.jwt.claims', json_build_object('sub', acc::text, 'role', 'authenticated')::text, true); select count(*) into n from kmi_next.cost_expenses; v_out := v_out || ' granted_accountant_reads=' || n;
  perform set_config('request.jwt.claims', json_build_object('sub', owner::text, 'role', 'authenticated')::text, true); select count(*) into n from kmi_next.cost_import_rows; v_out := v_out || ' owner_reads_import_rows=' || n;
  reset role;
  raise notice 'COST_RESULTS %', v_out;
end $$;
rollback;
