const num = (v) => (v === null || v === undefined ? null : Number(v));
export function createSupplierInvoiceApi(client, session) {
    return {
        async matchStatus(purchaseOrderId) {
            const rows = await client.rpc('supplier_po_match_status', { p_purchase_order_id: purchaseOrderId }, session);
            return rows.map((r) => ({
                ...r,
                unitPrice: num(r.unitPrice),
                qtyOrdered: Number(r.qtyOrdered),
                qtyReceived: Number(r.qtyReceived),
                qtyAccepted: Number(r.qtyAccepted),
                qtyRejected: Number(r.qtyRejected),
                qtyQcPending: Number(r.qtyQcPending),
                qtyInvoiced: Number(r.qtyInvoiced),
                qtyInvoiceable: Number(r.qtyInvoiceable),
            }));
        },
        async balances(purchaseOrderId) {
            const rows = await client.rpc('supplier_invoice_balances', { p_purchase_order_id: purchaseOrderId }, session);
            return rows.map((r) => ({ ...r, amount: Number(r.amount), paid: Number(r.paid), remaining: Number(r.remaining) }));
        },
        async recordInvoice(purchaseOrderId, invoiceNo, currency, lines, clientRequestId, dueDate) {
            await client.rpc('record_supplier_invoice_matched', {
                p_purchase_order_id: purchaseOrderId,
                p_invoice_no: invoiceNo,
                p_currency: currency,
                p_lines: lines.map((l) => ({ po_line_id: l.poLineId, qty: l.qty, unit_price: l.unitPrice })),
                p_client_request_id: clientRequestId,
                p_due_date: dueDate,
            }, session);
        },
        async recordPayment(invoiceId, amount, clientRequestId) {
            await client.rpc('record_supplier_payment', { p_invoice_id: invoiceId, p_amount: amount, p_client_request_id: clientRequestId }, session);
        },
    };
}
