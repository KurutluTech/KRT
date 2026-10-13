import { isSetupPending } from './errorText.js';
import { buildHistory, buildInbox, rpcCall } from '../../../packages/domain/src/approvalsInbox.js';
export const HISTORY_DAYS = 30;
const inList = (ids) => `in.(${ids.join(',')})`;
/** tasks have no table grant (RPC-only). Preferred: task_approval_inbox() (draft 0080, has completed_at). Until 0080 is applied: task_floor('ALL') — same gate (TASK_MANAGE), but completion time is UNKNOWN (never guessed). */
export async function loadTasks(client, session) {
    try {
        const rows = await client.rpc('task_approval_inbox', {}, session);
        return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, completedAt: r.completedAt, dueAt: r.dueAt, ownerLabel: r.ownerLabel, completedByMe: !!r.completedByMe }));
    }
    catch (e) {
        if (!isSetupPending(e) && !/Could not find the function|schema cache/i.test(msg(e)))
            throw e;
        const floor = await client.rpc('task_floor', { p_scope: 'ALL' }, session);
        return floor.manual.filter((t) => t.status === 'COMPLETED').map((t) => ({ id: t.id, title: t.title, status: t.status, completedAt: null, dueAt: t.dueAt, ownerLabel: t.ownerLabel, completedByMe: !!t.completedByMe }));
    }
}
const msg = (e) => (e instanceof Error ? e.message : String(e));
export function createApprovalsInboxApi(client, session, opts = {}) {
    const now = opts.now ?? (() => Date.now());
    const includeTasks = opts.includeTasks ?? true;
    return {
        async load() {
            const errors = {};
            const safe = async (kind, p) => { try {
                return await p;
            }
            catch (e) {
                errors[kind] = msg(e);
                return [];
            } };
            const sinceIso = new Date(now() - HISTORY_DAYS * 86_400_000).toISOString();
            const [commercial, purchaseRequests, purchaseOrders, tasks, decidedC, decidedR, approvedPO] = await Promise.all([
                safe('COMMERCIAL_DECISION', client.select('commercial_approvals', { columns: 'id,stock_lot_id,status,requested_by,requested_at,management_released_at', filters: { status: 'eq.PENDING' }, order: 'requested_at.asc', limit: 500 }, session)),
                safe('PURCHASE_REQUEST', client.select('purchase_requests', { columns: 'id,material_code,qty,needed_by,reason,status,requested_by,requested_at,source_work_order_id', filters: { status: 'eq.SUBMITTED' }, order: 'requested_at.asc', limit: 500 }, session)),
                safe('PURCHASE_ORDER', client.select('purchase_orders', { columns: 'id,supplier_id,status,created_by,created_at,updated_at', filters: { status: 'eq.SUBMITTED' }, order: 'created_at.asc', limit: 500 }, session)),
                safe('TASK_COMPLETION', includeTasks ? loadTasks(client, session) : Promise.resolve([])),
                safe('HISTORY', client.select('commercial_approvals', { columns: 'id,stock_lot_id,status,decided_at,decided_by,decision_reason', filters: { status: 'in.(APPROVED,REJECTED)', decided_at: `gte.${sinceIso}` }, order: 'decided_at.desc', limit: 100 }, session)),
                safe('HISTORY', client.select('purchase_requests', { columns: 'id,material_code,qty,status,decided_at,decided_by,decision_reason,source_work_order_id', filters: { status: 'in.(APPROVED,REJECTED)', decided_at: `gte.${sinceIso}` }, order: 'decided_at.desc', limit: 100 }, session)),
                safe('HISTORY', client.select('purchase_orders', { columns: 'id,supplier_id,status,updated_at', filters: { status: 'eq.APPROVED', updated_at: `gte.${sinceIso}` }, order: 'updated_at.desc', limit: 100 }, session)),
            ]);
            // Every canonical source failed (typically: connection lost / server unreachable). That is NOT "nothing pending": fail the load so the screen shows one clear error with a retry.
            const coreKinds = includeTasks ? ['COMMERCIAL_DECISION', 'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'TASK_COMPLETION'] : ['COMMERCIAL_DECISION', 'PURCHASE_REQUEST', 'PURCHASE_ORDER'];
            if (coreKinds.every((k) => errors[k] !== undefined))
                throw new Error(errors[coreKinds[0]]);
            const lotIds = [...new Set([...commercial.map((c) => c.stockLotId), ...decidedC.map((c) => c.stockLotId)])];
            const lotLabels = new Map();
            const lotWo = new Map();
            if (lotIds.length) {
                try { // label only; if a hop fails the lot is shown by id and the failure is reported
                    const lots = await client.select('stock_lots', { columns: 'id,work_order_id,qty', filters: { id: inList(lotIds) } }, session);
                    for (const l of lots) {
                        lotLabels.set(l.id, `Parti ${l.id.slice(0, 8)} · ${l.qty} adet · İE ${l.workOrderId.slice(0, 8)}`);
                        lotWo.set(l.id, l.workOrderId);
                    }
                }
                catch (e) {
                    errors.LOTS = msg(e);
                }
            }
            // work order -> order (drill-down chain: lot / work order / order). A failed hop only removes the order link and is reported.
            const woOrder = new Map();
            const woIds = [...new Set([...lotWo.values(), ...[...purchaseRequests, ...decidedR].map((r) => r.sourceWorkOrderId).filter((x) => !!x)])];
            if (woIds.length) {
                try {
                    const wos = await client.select('work_orders', { columns: 'id,order_item_id', filters: { id: inList(woIds) } }, session);
                    const items = wos.length ? await client.select('order_items', { columns: 'id,order_id', filters: { id: inList([...new Set(wos.map((w) => w.orderItemId))]) } }, session) : [];
                    const itemOrder = new Map(items.map((i) => [i.id, i.orderId]));
                    for (const w of wos) {
                        const o = itemOrder.get(w.orderItemId);
                        if (o)
                            woOrder.set(w.id, o);
                    }
                }
                catch (e) {
                    errors.LINKS = msg(e);
                }
            }
            const supplierIds = [...new Set([...purchaseOrders.map((o) => o.supplierId), ...approvedPO.map((o) => o.supplierId)])];
            const supplierNames = new Map();
            if (supplierIds.length) {
                try {
                    for (const x of await client.select('suppliers', { columns: 'id,name', filters: { id: inList(supplierIds) } }, session))
                        supplierNames.set(x.id, x.name);
                }
                catch (e) {
                    errors.NAMES = msg(e);
                }
            }
            const userNames = new Map();
            const uids = [...new Set([...commercial.map((c) => c.requestedBy), ...purchaseRequests.map((r) => r.requestedBy), ...purchaseOrders.map((o) => o.createdBy), ...decidedC.map((c) => c.decidedBy), ...decidedR.map((r) => r.decidedBy)].filter((x) => !!x))];
            if (uids.length) {
                try {
                    for (const x of await client.select('personnel', { columns: 'auth_user_id,name', filters: { auth_user_id: inList(uids) }, limit: 500 }, session))
                        if (x.authUserId)
                            userNames.set(x.authUserId, x.name);
                }
                catch (e) {
                    errors.NAMES = msg(e);
                }
            }
            // source record + related work order / order passports (hash links only; the target screen applies its own permission gate)
            const lotOfApproval = new Map([...commercial.map((c) => [c.id, c.stockLotId]), ...decidedC.map((c) => [c.id, c.stockLotId])]);
            const poSupplier = new Map([...purchaseOrders.map((o) => [o.id, o.supplierId]), ...approvedPO.map((o) => [o.id, o.supplierId])]);
            const reqWo = new Map([...purchaseRequests, ...decidedR].map((r) => [r.id, r.sourceWorkOrderId ?? null]));
            const pp = (kind, id) => `#/nesne?t=${kind}&id=${encodeURIComponent(id)}`;
            const chain = (woId) => { const out = []; if (woId) {
                out.push({ label: 'İş emri', href: pp('WORK_ORDER', woId) });
                const o = woOrder.get(woId);
                if (o)
                    out.push({ label: 'Sipariş', href: pp('ORDER', o) });
            } return out; };
            const relatedLinks = (kind, id) => {
                if (kind === 'COMMERCIAL_DECISION' || kind === 'COMMERCIAL_MGMT_RELEASE') {
                    const lot = lotOfApproval.get(id);
                    return lot ? [{ label: 'Parti', href: pp('STOCK_LOT', lot) }, ...chain(lotWo.get(lot))] : [];
                }
                if (kind === 'PURCHASE_REQUEST')
                    return chain(reqWo.get(id));
                if (kind === 'PURCHASE_ORDER') {
                    const sup = poSupplier.get(id);
                    return sup ? [{ label: 'Tedarikçi', href: pp('SUPPLIER', sup) }] : [];
                }
                return [];
            };
            const common = { lotLabel: (id) => lotLabels.get(id) ?? null, supplierLabel: (id) => supplierNames.get(id) ?? null, userLabel: (id) => userNames.get(id) ?? null, relatedLinks };
            return {
                items: buildInbox({ commercial, purchaseRequests, purchaseOrders, tasks, ...common }, now()),
                history: buildHistory({ commercial: decidedC, purchaseRequests: decidedR, purchaseOrders: approvedPO, ...common }),
                historyDays: HISTORY_DAYS, sourceErrors: errors, asOf: new Date(now()).toISOString(),
            };
        },
        async decide(item, decision, reason) {
            const call = rpcCall(item, decision, reason);
            await client.rpc(call.fn, call.params, session);
        },
    };
}
