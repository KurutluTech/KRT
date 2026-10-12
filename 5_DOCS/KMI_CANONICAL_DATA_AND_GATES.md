# Kanonik veri ve kapılar (Faz 0)
İlke: TEK GERÇEK → TEK KANONİK KAYNAK → TEK HESAP → ÇOK GÖRÜNÜM. Mevcut kaynaklar (yeni defter/durum makinesi kurulmadı):
| Gerçek | Kanonik kaynak | Görünümler |
|---|---|---|
| Üretilen iyi/hurda | `production_declarations` (idempotent `client_request_id`) | LIVE, OEE, rapor, pasaport |
| İş emri durumu | `work_orders` + `work_order_status_events` | hub, komuta, planlama |
| Operasyon | `work_order_operations` + `work_order_operation_events` | terminal, rota |
| Stok | `stock_lots` + `stock_movements`/`material_movements` (RESERVE/UNRESERVE/ISSUE/CONSUME) | depo, hazırlık |
| Makine durumu | `machines` + `machine_state_events` | LIVE, bakım |
| Sevkiyat yükümlülüğü | `order_item_shipment_obligation` (türetilir) | sevkiyat, sipariş |
| Denetim | `audit_log` (tek) | geçmiş, pasaport |
| Fiyat/maliyet | `cost_parameters`, `economic_*` | ekonomi (D-013 kapılı) |
## Kapılar (kodda doğrulananlar)
| Kapı | Yer | Not |
|---|---|---|
| Önceki operasyon bitmeden başlamaz; makine UP; makine meşgul değil; operatör aktif/yetkin/süresi geçmemiş; CAM RELEASED + doğru revizyon; açık kalite HOLD yok; ilk operasyonda malzeme NOT_READY değil; takım NOT_READY değil | `operation_start_refusal` (0039) | UNKNOWN'un bu noktada geçip geçmediği ayrıca testlenecek |
| İlk parça onayı, kendi onayı yok | `decide_operation_first_piece` | `FIRST_PIECE_APPROVE` yetkisi |
| Malzeme/takım hazırlık, UNKNOWN ≠ READY, muafiyet gerekçeli | `work_order_readiness` (0021) | |
| Tekrarlı üretim beyanı | `declare_operation_output` | `CLIENT_REQUEST_ID_REUSED` |
| Aynı partide çift rezervasyon engeli | 0016 (lot kilidi) | |
| Mal kabul → HOLD lot | `goods_receipts` (0010) | giriş KK = mevcut HOLD |
| Sevkiyat geçişi sunucuda | `transition_shipment_status`, `tg_document_gate_shipment` | UI gizleme güvenlik değildir |
## Eksik kapılar (kanıtla)
Kontrol planı yok; PO tekrarı kısıtı yok; JWT yenileme yok; operatör başına maks aktif iş emri kuralı yok; ilk-yayın dışı: Nikken/LockCell/CNC cihaz kapıları (BLOCKED).
