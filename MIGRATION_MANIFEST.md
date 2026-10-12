# Migration manifesti (HİÇBİRİ UYGULANMADI)
| # | Dosya | Durum | Önkoşul (salt-okuma) | Geri alma | Etki |
|---|---|---|---|---|---|
| 0071 | `apply/0071_kmi_next_machine_class.sql` | Canlıda yok (Release 003 ile bekliyor) | — | `rollback/rollback_0071_0073.sql` | makine sınıfı |
| 0072 | `apply/0072_kmi_next_operator_credentials.sql` | Canlıda yok | — | aynı | operatör sicil+PIN altyapısı (Edge Function ayrıca deploy gerekir) |
| 0073 | `apply/0073_kmi_next_puantaj_month.sql` | Canlıda yok | — | aynı | Puantaj ay kapanışı |
| 0074 | `apply/0074_temporal_audit_hardening.sql` | TASLAK, replica kanıtlı, sahip onayı bekliyor | `MIGRATION_0074_SECURITY_REVIEW.md` | `rollback/0074_rollback.sql` | audit_log okuma kapsamı + append-only |
| 0075 | `apply/0075_customer_po_uniqueness.sql` | TASLAK | `select customer_id, upper(btrim(customer_po)), count(*) from kmi_next.orders where status<>'CANCELLED' group by 1,2 having count(*)>1;` → 0 satır | `0075_rollback.sql` | müşteri PO tekrarını engeller |
| 0076 | `apply/0076_control_plan_tahsis.sql` | TASLAK; yönetişim kararları açık | — | `0076_rollback.sql` | kontrol planı tabloları + TAHSİS (NCR üzerinde) |
| 0077 | `apply/0077_commercial_approval_dedup.sql` | TASLAK | `select stock_lot_id,count(*) from kmi_next.commercial_approvals where status='PENDING' group by 1 having count(*)>1;` → 0 satır | `0077_rollback.sql` | lot başına tek bekleyen ticari onay |
| 0078 | `apply/0078_cost_intelligence_foundation.sql` | TASLAK; politika kararları açık | — (ekonomi erişimi 0028/0036 canlıda var) | `0078_rollback.sql` | maliyet tabloları + içe aktarma hazırlama |
Her dosya kendi `begin/commit` bloğundadır. Sırayla, birer birer, sahip onayıyla. Ben hiçbirini çalıştırmam.
