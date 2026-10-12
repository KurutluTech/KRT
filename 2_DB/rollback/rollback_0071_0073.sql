-- KMI NEXT — geri dönüş: migration 0073 → 0072 → 0071 (ters sıra). YALNIZ migration'lar uygulandıktan sonra, yeni tablolara
-- GERÇEK veri girilmeden önce kullanın (girilmişse önce o tabloların içeriğini dışa aktarın; DROP TABLE içerik siler).
-- Mevcut tablolarda eski kayıtlara dokunmaz. audit_log kayıtları SİLİNMEZ.
begin;
-- 0073
drop function if exists kmi_next.close_puantaj_period(text, jsonb, jsonb, jsonb);
drop function if exists kmi_next.set_puantaj_pool(text, numeric, text);
drop function if exists kmi_next.set_puantaj_input(text, uuid, jsonb, text);
drop function if exists kmi_next.puantaj_month_facts(text);
drop function if exists kmi_next.puantaj_people_facts(text);
drop table if exists kmi_next.puantaj_period_locks, kmi_next.puantaj_pool, kmi_next.puantaj_input_events, kmi_next.puantaj_monthly_inputs;
delete from kmi_next.role_action_matrix where action_code = 'PUANTAJ_MANAGE';
delete from kmi_next.critical_action where action_code = 'PUANTAJ_MANAGE';
-- 0072
drop function if exists kmi_next.operator_bind_auth_user(uuid, uuid);
drop function if exists kmi_next.operator_verify(text, text, text);
drop function if exists kmi_next.operator_credentials_overview();
drop function if exists kmi_next.deactivate_operator_access(uuid, text);
drop function if exists kmi_next.revoke_operator_badge(uuid, text);
drop function if exists kmi_next.issue_operator_badge(uuid, text, boolean);
drop function if exists kmi_next.set_operator_pin(uuid, text, text);
drop table if exists kmi_next.operator_login_attempts, kmi_next.operator_badges, kmi_next.operator_credentials;
-- 0071 (öncesinde sütun yoktu; tüm değerler yeni eklenmişti)
alter table kmi_next.machines drop constraint if exists machines_machine_class_check;
alter table kmi_next.machines drop column if exists machine_class;
commit;
