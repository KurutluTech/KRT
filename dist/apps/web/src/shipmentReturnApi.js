// m0200 — sevkiyat iadesi / sevk geri alma / dekont. Yetki, SoD, audit ve miktar kuralları sunucuda.
export function createShipmentReturnApi(client, session) {
    return {
        overview: () => client.rpc('shipment_returns_overview', {}, session),
        shipments: () => client.select('shipments', { columns: 'id,delivery_note_no,status,stock_lot_id', filters: { status: 'in.(DISPATCHED,DELIVERED)' } }, session),
        lots: (ids) => ids.length ? client.select('stock_lots', { columns: 'id,qty', filters: { id: `in.(${ids.join(',')})` } }, session) : Promise.resolve([]),
        request: (i) => client.rpc('request_shipment_return', { p_shipment_id: i.shipmentId, p_qty: i.qty, p_kind: i.kind, p_reason_code: i.reasonCode, p_reopen_obligation: i.reopen, p_client_request_id: i.clientRequestId, p_note: i.note ?? null }, session),
        reject: (id, reason) => client.rpc('reject_shipment_return', { p_return_id: id, p_reason: reason ?? null }, session),
        receive: (id, noteNo) => client.rpc('receive_shipment_return', { p_return_id: id, p_return_note_no: noteNo || null }, session),
        decide: (id, disposition, reason) => client.rpc('decide_return_disposition', { p_return_id: id, p_disposition: disposition, p_reason: reason || null }, session),
        finishRework: (id, outcome, reason) => client.rpc('finish_return_rework', { p_return_id: id, p_outcome: outcome, p_reason: reason || null }, session),
        decideAdjustment: (id, approve, reason) => client.rpc('decide_invoice_adjustment', { p_id: id, p_approve: approve, p_reason: reason || null }, session),
    };
}
