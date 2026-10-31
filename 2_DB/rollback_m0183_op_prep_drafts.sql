-- rollback_m0183_op_prep_drafts — m0183'ü geri alır.
-- Etki: yalnız hazırlık taslağı tablosu ve m0183 fonksiyonları kaldırılır. Rota, iş emri, stok, üretim, belgeler etkilenmez
-- (m0183 bunlara hiç yazmaz). audit_log ve product_events kayıtları değiştirilemez olduğu için KALIR: her taslağın son hali
-- audit_log'da (entity_type = 'OP_PREP_DRAFT', after_state) bulunur.
-- Güvenlik: tablo boş değilse önce içeriği audit_log'a tek bir "ROLLBACK_SNAPSHOT" kaydıyla yazar, sonra kaldırır.

begin;

insert into kmi_next.audit_log (actor_user_id, action, entity_type, entity_id, reason, before_state, after_state)
select coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'OP_PREP_ROLLBACK_SNAPSHOT', 'OP_PREP_DRAFT', d.id::text,
       'm0183 geri alındı: taslak tablosu kaldırılmadan önceki son hal', to_jsonb(d), null
  from kmi_next.op_prep_drafts d;

drop function if exists kmi_next.op_prep_set_status(uuid, text, text, integer, text);
drop function if exists kmi_next.op_prep_save(uuid, text, jsonb, integer);
drop function if exists kmi_next.op_prep_history(uuid, text);
drop function if exists kmi_next.op_prep_list(uuid);
drop function if exists kmi_next.opp_audit(text, uuid, text, jsonb, jsonb);
drop function if exists kmi_next.opp_gate(uuid, text, boolean);
drop function if exists kmi_next.opp_json(kmi_next.op_prep_drafts);
drop function if exists kmi_next.opp_missing(kmi_next.op_prep_drafts);
drop function if exists kmi_next.opp_doc_ok(kmi_next.product_revisions, uuid, text[]);
drop table if exists kmi_next.op_prep_drafts;

commit;
