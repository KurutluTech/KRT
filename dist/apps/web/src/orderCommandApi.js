export function createOrderCommandApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    return {
        overview: () => rpc('order_cc_overview', {}),
        detail: (id) => rpc('order_cc_detail', { p_order_id: id }),
        readiness: (woId) => rpc('work_order_readiness', { p_work_order_id: woId }),
        // Order-to-Ship zinciri için canonical kayıtların OKUNMASI (yalnız select; hesap yok). Okunamayan tablo `unreadable` listesine girer, zincir bunu "VERİ YOK" gösterir.
        async chainFacts(woIds) {
            const ids = (woIds ?? []).filter(Boolean), inl = `in.(${ids.join(',')})`, un = [], got = {};
            const q = async (key, table, columns, filters, order) => {
                if (!ids.length) { got[key] = []; return; }
                try { got[key] = await client.select(table, { columns, filters, ...(order ? { order } : {}), limit: 500 }, session); } catch { got[key] = []; un.push(table); }
            };
            await q('ops', 'work_order_operations', 'id,work_order_id,op_no,status,qty_in,qty_good,qty_scrap,qty_released,first_piece_required,first_piece_at,qc_required,qc_result,fp_recheck_required', { work_order_id: inl }, 'op_no.asc');
            await q('lots', 'stock_lots', 'id,work_order_id,qty,state', { work_order_id: inl });
            await q('holds', 'quality_holds', 'id,work_order_id,status', { work_order_id: inl });
            await q('ncrs', 'quality_ncrs', 'id,work_order_id,status', { work_order_id: inl });
            const lotIds = (got.lots ?? []).map((l) => l.id);
            const byLot = async (key, table, columns) => { if (!lotIds.length) { got[key] = []; return; } try { got[key] = await client.select(table, { columns, filters: { stock_lot_id: `in.(${lotIds.join(',')})` }, limit: 500 }, session); } catch { got[key] = []; un.push(table); } };
            await byLot('approvals', 'commercial_approvals', 'id,stock_lot_id,status,management_released_at');
            await byLot('shipments', 'shipments', 'id,stock_lot_id,status');
            const shipIds = (got.shipments ?? []).map((x) => x.id);
            try { got.invoices = shipIds.length ? await client.select('invoices', { columns: 'id,shipment_id,status', filters: { shipment_id: `in.(${shipIds.join(',')})` }, limit: 500 }, session) : []; } catch { got.invoices = []; un.push('invoices'); }
            const perWo = async (key, fn, flag) => { got[key] = []; for (const id of ids) { try { got[key].push({ workOrderId: id, ...(await rpc(fn, { p_wo: id })) }); } catch { if (!un.includes(flag)) un.push(flag); } } };
            await perWo('finalQuality', 'final_quality_get', 'final_quality');
            await perWo('commercialDocs', 'commercial_docs_status', 'commercial_documents');
            return { ...got, unreadable: [...new Set(un)] };
        },
        finalQualityDecide: (woId, approve, reason) => rpc('final_quality_decide', { p_wo: woId, p_approve: approve, p_reason: reason }),
        commercialRequirementsSet: (woId, types, reason, confirm) => rpc('commercial_requirements_set', { p_wo: woId, p_types: types ?? null, p_reason: reason, p_confirm: !!confirm }),
        commercialDocSave: (woId, type, no, note) => rpc('commercial_doc_save', { p_wo: woId, p_type: type, p_doc_no: no, p_note: note ?? null }),
        commercialDocSubmit: (id) => rpc('commercial_doc_submit', { p_id: id }),
        commercialDocDecide: (id, approve, reason) => rpc('commercial_doc_decide', { p_id: id, p_approve: approve, p_reason: reason }),
        change: (itemId, p, reason, requestId) => rpc('order_item_change', { p_order_item_id: itemId, p_qty: p.qty ?? null, p_due_date: p.dueDate ?? null, p_unit_price: p.unitPrice ?? null, p_reason: reason, p_client_request_id: requestId }),
        print: (id) => rpc('order_cc_print', { p_order_id: id }),
        find: (text) => rpc('order_cc_find', { p_text: text }),
        transition: async (orderId, to, reason) => { await rpc('transition_order_status', { p_order_id: orderId, p_to_status: to, p_reason: reason }); },
        createWorkOrder: async (itemId, qty) => { await rpc('create_work_order', { p_order_item_id: itemId, p_qty_planned: qty }); },
    };
}
