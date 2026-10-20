import { createTerminalApi } from './terminalApi.js';
const wo = (w) => ({ workOrderId: w.workOrderId, status: w.status, productCode: w.productCode, qtyPlanned: w.qtyPlanned, qtyProduced: w.qtyProduced, qtyScrap: w.qtyScrap ?? 0, operatorName: w.operatorName ?? null, plannedDate: w.plannedDate ?? null, openQualityHold: !!w.openQualityHold, startRefusal: w.startRefusal ?? null, ...(w.isPilot ? { isPilot: true } : {}) });
const op = (o) => ({ operationId: o.operationId, workOrderId: o.workOrderId, opNo: o.opNo, name: o.name, productCode: o.productCode, status: o.status ?? null, qtyIn: o.qtyIn, qtyGood: o.qtyGood ?? 0, qtyScrap: o.qtyScrap ?? 0, qtyTashih: o.qtyTashih ?? null, operatorName: o.operatorName ?? null, startedAt: o.startedAt ?? null, stale: !!o.staleReason });
const STATE_WINDOW_H = 12;
/** how long the CURRENT controller state has lasted, read from the 0129 activity read model (no second history). Walks back over same-kind segments; null when it cannot be verified. */
export function stateSinceOf(segs, fromIso) {
    const ok = segs.filter((x) => x && x.segStart && x.segEnd).sort((a, b) => Date.parse(a.segStart) - Date.parse(b.segStart));
    if (!ok.length)
        return null;
    const last = ok[ok.length - 1];
    if (!last || last.kind === 'NO_DATA')
        return null;
    let from = last.segStart;
    for (let i = ok.length - 2; i >= 0; i--) {
        const q = ok[i];
        if (!q || q.kind !== last.kind || Math.abs(Date.parse(q.segEnd) - Date.parse(from)) > 1500)
            break;
        from = q.segStart;
    }
    return { kind: last.kind, from, clipped: Date.parse(from) <= Date.parse(fromIso) + 1500 };
}
export function createProductionDeskApi(c, s) {
    const t = createTerminalApi(c, s);
    const rows = new Map();
    return {
        io: { sel: (table, columns, filters = {}, order, limit = 200) => c.select(table, { columns, filters, order, limit }, s), rpc: (fn, args) => c.rpc(fn, args, s) },
        machineRow: (id) => rows.get(id) ?? null,
        async load() {
            let list;
            try {
                list = await t.machines();
            }
            catch {
                return null;
            }
            // CNC rows once for the whole screen (cnc_live_states; refused without the telemetry permission ⇒ denied, never invented)
            const cnc = new Map();
            let denied = false;
            try {
                for (const r of await c.rpc('cnc_live_states', {}, s))
                    if (r.machineCode)
                        cnc.set(r.machineCode, r);
            }
            catch {
                denied = true;
            }
            rows.clear();
            try {
                for (const r of await c.select('machines', { columns: 'id,code,name,category,status,down_since,total_down_minutes,machine_class,updated_at', filters: {}, limit: 500 }, s))
                    rows.set(r.id, r);
            }
            catch { /* class unknown ⇒ shown as such */ }
            const now = Date.now(), fromIso = new Date(now - STATE_WINDOW_H * 3600e3).toISOString(), toIso = new Date(now).toISOString();
            return Promise.all(list.map(async (m) => {
                const mr = rows.get(m.machineId) ?? null;
                try {
                    const sn = await t.terminal(m.machineId);
                    const row = cnc.get(sn.machine.code) ?? null;
                    let stateSince = null;
                    if (row && String(row.link) === 'UP') {
                        try {
                            stateSince = stateSinceOf(await c.rpc('cnc_activity', { p_machine_code: sn.machine.code, p_from: fromIso, p_to: toIso }, s), fromIso);
                        }
                        catch {
                            stateSince = null;
                        }
                    }
                    const shift = sn.active?.plannedShiftCode ?? sn.routedActive?.[0]?.plannedShiftCode ?? null;
                    return { machineId: m.machineId, code: sn.machine.code, name: sn.machine.name, label: sn.machine.label, eligible: sn.machine.eligible, returnPath: sn.machine.returnPath, reason: sn.machine.reason, status: sn.machine.status ?? mr?.status ?? null, machineClass: mr?.machineClass ?? null, cnc: row, cncDenied: denied, stateSince, shift, routed: (sn.routedActive ?? []).map(op), active: sn.active ? wo(sn.active) : null, queue: sn.queue.map(wo), error: null };
                }
                catch (e) {
                    return { machineId: m.machineId, code: m.code, name: m.name, label: null, eligible: false, returnPath: null, reason: null, status: mr?.status ?? null, machineClass: mr?.machineClass ?? null, cnc: cnc.get(m.code) ?? null, cncDenied: denied, active: null, queue: [], error: e instanceof Error ? e.message : 'okunamadı' };
                }
            }));
        },
        start: (id) => t.start(id, `pd-start-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`), declare: (id, g, sc, rid) => t.declare(id, g, sc, rid), hold: (m, r, cat) => t.hold(m, r, cat), resume: (m, r) => t.resume(m, r), reportFault: (m, r) => t.reportFault(m, r), requestFirstPiece: (id) => t.requestFirstPiece(id),
    };
}
