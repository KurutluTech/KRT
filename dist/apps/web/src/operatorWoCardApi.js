import { createDocumentsApi } from './documentsApi.js';
const TECH_DOC = new Set(['DRAWING', 'CONTROL_PLAN', 'CAM_SETUP_SHEET', 'MATERIAL_CERTIFICATE']);
export function createOperatorWoCardApi(client, session) {
    const docsApi = createDocumentsApi(client, session);
    const sel = (table, columns, filters, order) => client.select(table, { columns, filters, ...(order ? { order } : {}) }, session).catch(() => []);
    return {
        async load(id) {
            const wo = (await client.select('work_orders', { columns: 'id,status,qty_planned,qty_produced,qty_scrap,machine_id,order_item_id,product_revision_id,planned_date', filters: { id: `eq.${id}` } }, session))[0];
            if (!wo)
                return null; // not visible (not assigned to this operator) or missing — same answer
            const [item, mach, ops, rev, mov, hold] = await Promise.all([
                sel('order_items', 'product_id', { id: `eq.${wo.orderItemId}` }),
                wo.machineId ? sel('machines', 'id,code,name,status', { id: `eq.${wo.machineId}` }) : Promise.resolve([]),
                sel('work_order_operations', 'op_no,name,status,qty_good,qty_scrap', { work_order_id: `eq.${id}` }, 'op_no.asc'),
                wo.productRevisionId ? sel('product_revisions', 'revision', { id: `eq.${wo.productRevisionId}` }) : Promise.resolve([]),
                client.select('material_movements', { columns: 'kind,qty', filters: { work_order_id: `eq.${id}` } }, session).then((r) => r, () => null),
                sel('quality_holds', 'id', { work_order_id: `eq.${id}`, status: 'eq.OPEN' }),
            ]);
            const prod = item[0] ? (await sel('products', 'code,name', { id: `eq.${item[0].productId}` }))[0] ?? null : null;
            let refusalKnown = false;
            let refusal = null;
            try {
                const r = await client.rpc('work_order_start_preview', { p_work_order_id: id }, session);
                refusal = r ?? null;
                refusalKnown = true;
            }
            catch { /* unknown */ }
            let rows = null;
            if (!refusalKnown) {
                try {
                    rows = await client.rpc('work_order_readiness', { p_work_order_id: id }, session);
                }
                catch {
                    rows = null;
                }
            }
            // same arithmetic as work_order_material_status.covered (reserved + issued + consumed = RESERVE − UNRESERVE − RETURN)
            const reserved = mov === null ? null : mov.reduce((a, m) => a + (m.kind === 'RESERVE' ? m.qty : m.kind === 'UNRESERVE' || m.kind === 'RETURN' ? -m.qty : 0), 0);
            // technical documents of the work order and of its product revision; the server hides every type this user may not open
            const docs = [];
            for (const [t, eid] of [['WORK_ORDER', id], ...(wo.productRevisionId ? [['PRODUCT_REVISION', wo.productRevisionId]] : [])]) {
                try {
                    const d = await docsApi.entityDocuments(t, eid);
                    for (const x of d.documents)
                        if (x.status === 'ACTIVE' && TECH_DOC.has(x.docType))
                            docs.push({ id: x.id, title: x.title, docType: x.docType, versionId: x.versions[0]?.id ?? null, fileName: x.versions[0]?.fileName ?? null, expiry: x.versions[0]?.expiry ?? null });
                }
                catch { /* documents unavailable → none shown */ }
            }
            return { workOrderId: wo.id, status: wo.status, qtyPlanned: wo.qtyPlanned, qtyProduced: wo.qtyProduced, qtyScrap: wo.qtyScrap, plannedDate: wo.plannedDate,
                productCode: prod?.code ?? null, productName: prod?.name ?? null, revision: rev[0]?.revision ?? null, machine: mach[0] ?? null, operations: ops,
                openQualityHold: hold.length > 0, refusalKnown, refusal, readinessRows: rows, reservedMaterial: reserved, docs };
        },
        async openDoc(versionId) { const c = await docsApi.content(versionId); return { bytes: c.contentBase64, mime: c.mimeType, fileName: c.fileName }; },
    };
}
