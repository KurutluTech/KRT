-- ROLLBACK for DRAFT 0076. Not applied anywhere. DATA NOTE: drops control plans and TAHSİS characteristic records; copy them first if they exist.
-- Pre-check (must be 0, else TAHSİS cases would lose their classification): select count(*) from kmi_next.quality_ncrs where kind = 'TAHSIS';
begin;
drop function if exists kmi_next.add_tahsis_characteristic(uuid, uuid, int, text, text, numeric, numeric, numeric, numeric, numeric, uuid, uuid, uuid, text, text);
drop function if exists kmi_next.open_tahsis_ncr(uuid, numeric, text, text, text);
drop table if exists kmi_next.quality_ncr_characteristics;
drop function if exists kmi_next.ncr_characteristics_immutable();
alter table kmi_next.quality_ncrs drop constraint if exists quality_ncrs_tahsis_source, drop column if exists detection_source, drop column if exists kind;
drop table if exists kmi_next.control_plan_characteristics;
drop table if exists kmi_next.control_plans;
commit;
