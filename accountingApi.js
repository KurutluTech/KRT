export function createAccountingApi(client, session) {
    return {
        async getObligation(orderItemId) {
            const rows = await client.rpc('order_item_shipment_obligation', { p_order_item_id: orderItemId }, session);
            const r = rows[0];
            if (!r)
                throw new Error('ORDER_ITEM_NOT_FOUND');
            return r;
        },
        async listShipments(orderItemId) {
            const rows = await client.select('shipments', {
                columns: 'id,status,stock_lots!inner(qty,work_orders!inner(order_item_id))',
                filters: { 'stock_lots.work_orders.order_item_id': `eq.${orderItemId}` },
                order: 'created_at.asc',
            }, session);
            return rows.map((r) => ({ id: r.id, status: r.status, lotQty: r.stockLots.qty }));
        },
        async listInvoices(orderItemId) {
            return client.select('invoices', { columns: 'id,shipment_id,amount,currency,status', filters: { order_item_id: `eq.${orderItemId}` }, order: 'created_at.asc' }, session);
        },
        async paidAmount(invoiceId) {
            const rows = await client.select('invoice_payments', { columns: 'amount', filters: { invoice_id: `eq.${invoiceId}` } }, session);
            return rows.reduce((a, r) => a + Number(r.amount), 0);
        },
        async createInvoice(shipmentId, currency) {
            return client.rpc('create_invoice_for_shipment', { p_shipment_id: shipmentId, p_currency: currency }, session);
        },
        async recordPayment(invoiceId, amount, clientRequestId) {
            return client.rpc('record_invoice_payment', { p_invoice_id: invoiceId, p_amount: amount, p_client_request_id: clientRequestId }, session);
        },
    };
}
