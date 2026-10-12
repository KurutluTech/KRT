-- ROLLBACK for DRAFT 0075 (customer-PO uniqueness). Not applied anywhere.
begin; drop index if exists kmi_next.orders_customer_po_live_uniq; commit;
