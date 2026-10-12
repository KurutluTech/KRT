-- Machine classification (recovery step 2). CMM / forklift / CNC were treated as one kind of "machine". The class is
-- master data on the ONE canonical machines table; it never changes status, assignment or any rule.
-- Backfill only the unambiguous seeded identities (names are in 0009); anything else stays NULL = "Sınıf belirtilmemiş".
-- Additive and idempotent; no existing value is overwritten.
alter table kmi_next.machines add column if not exists machine_class text;
alter table kmi_next.machines drop constraint if exists machines_machine_class_check;
alter table kmi_next.machines add constraint machines_machine_class_check
  check (machine_class is null or machine_class in ('MACHINING','MEASUREMENT','MATERIAL_HANDLING','AUXILIARY'));
comment on column kmi_next.machines.machine_class is
  'MACHINING (CNC / talaşlı imalat) | MEASUREMENT (CMM, optik) | MATERIAL_HANDLING (forklift) | AUXILIARY. NULL = not classified (never guessed).';
update kmi_next.machines set machine_class = 'MACHINING'
  where machine_class is null and code in ('102','103','107','108','109','110','111','112','113');
update kmi_next.machines set machine_class = 'MEASUREMENT' where machine_class is null and code in ('CMM','OPT');
update kmi_next.machines set machine_class = 'MATERIAL_HANDLING' where machine_class is null and code = 'FORKLIFT';
