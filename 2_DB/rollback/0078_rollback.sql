-- ROLLBACK for DRAFT 0078 (Cost Intelligence foundation). Not applied anywhere. DATA NOTE: drops every staged import, expense, allocation and period record — export them first if any exist.
begin;
drop function if exists kmi_next.close_cost_period(text, text); drop function if exists kmi_next.decide_cost_import(uuid, boolean, text); drop function if exists kmi_next.stage_cost_import(text, text, text, jsonb);
drop table if exists kmi_next.cost_allocations; drop table if exists kmi_next.cost_expenses; drop table if exists kmi_next.cost_import_rows; drop table if exists kmi_next.cost_import_batches;
drop table if exists kmi_next.cost_periods; drop table if exists kmi_next.cost_centers; drop table if exists kmi_next.cost_categories;
drop function if exists kmi_next.cost_allocation_guard(); drop function if exists kmi_next.cost_expense_period_guard();
commit;
