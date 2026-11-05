/** Sevkiyat belgeleri (fatura/irsaliye): okuma tablolar RLS ile, yazma yalnız kmi_next RPC'leriyle (yetki, SoD ve audit sunucuda). */
export function createShipmentDocsApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    const sel = (t, o) => client.select(t, o, session);
    return {
        shipments: () => sel('shipments', { columns: 'id,stock_lot_id,status,delivery_note_no,created_at', filters: { status: 'in.(DRAFT,DISPATCHED,DELIVERED)' }, order: 'created_at.desc', limit: 200 }),
        lines: (ids) => (ids.length ? sel('shipment_lines', { columns: 'id,shipment_id,stock_lot_id,qty', filters: { shipment_id: `in.(${ids.join(',')})` }, limit: 1000 }) : []),
        docs: (ids) => (ids.length ? sel('shipment_documents', { columns: 'id,shipment_id,doc_type,doc_no,qty,status,prepared_by,prepared_at,decided_by,decided_at,decision_reason', filters: { shipment_id: `in.(${ids.join(',')})` }, order: 'prepared_at.desc', limit: 1000 }) : []),
        lots: () => sel('stock_lots', { columns: 'id,work_order_id,qty,state', filters: { work_order_id: 'not.is.null', state: 'in.(AVAILABLE,RESERVED,STAGED,SHIPPED)' }, limit: 1000 }),
        workOrders: (ids) => (ids.length ? sel('work_orders', { columns: 'id,order_item_id', filters: { id: `in.(${ids.join(',')})` }, limit: 1000 }) : []),
        approvals: (lotIds) => (lotIds.length ? sel('commercial_approvals', { columns: 'id,stock_lot_id,status', filters: { stock_lot_id: `in.(${lotIds.join(',')})` }, limit: 1000 }) : []),
        create: (lot) => rpc('create_shipment', { p_stock_lot_id: lot }),
        addLot: (ship, lot) => rpc('shipment_add_lot', { p_ship: ship, p_lot: lot }),
        removeLot: (ship, lot) => rpc('shipment_remove_lot', { p_ship: ship, p_lot: lot }),
        saveDoc: (ship, type, no, qty) => rpc('shipment_doc_save', { p_ship: ship, p_type: type, p_doc_no: no, p_qty: qty }),
        decideDoc: (id, approve, reason) => rpc('shipment_doc_decide', { p_id: id, p_approve: approve, p_reason: reason }),
        me: async () => (await client.rpc('current_user_id', {}, session).catch(() => null)),
    };
}
