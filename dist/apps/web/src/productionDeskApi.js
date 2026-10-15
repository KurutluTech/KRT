import { createTerminalApi } from './terminalApi.js';
const wo = (w) => ({ workOrderId: w.workOrderId, status: w.status, productCode: w.productCode, qtyPlanned: w.qtyPlanned, qtyProduced: w.qtyProduced, qtyScrap: w.qtyScrap ?? 0, operatorName: w.operatorName ?? null, plannedDate: w.plannedDate ?? null, openQualityHold: !!w.openQualityHold, startRefusal: w.startRefusal ?? null });
export function createProductionDeskApi(c, s) {
    const t = createTerminalApi(c, s);
    return {
        async load() {
            let list;
            try {
                list = await t.machines();
            }
            catch {
                return null;
            }
            return Promise.all(list.map(async (m) => {
                try {
                    const sn = await t.terminal(m.machineId);
                    return { machineId: m.machineId, code: sn.machine.code, name: sn.machine.name, label: sn.machine.label, eligible: sn.machine.eligible, returnPath: sn.machine.returnPath, reason: sn.machine.reason, active: sn.active ? wo(sn.active) : null, queue: sn.queue.map(wo), error: null };
                }
                catch (e) {
                    return { machineId: m.machineId, code: m.code, name: m.name, label: null, eligible: false, returnPath: null, reason: null, active: null, queue: [], error: e instanceof Error ? e.message : 'okunamadı' };
                }
            }));
        },
        start: (id) => t.start(id), declare: (id, g, sc, rid) => t.declare(id, g, sc, rid), hold: (m, r, cat) => t.hold(m, r, cat), resume: (m, r) => t.resume(m, r), reportFault: (m, r) => t.reportFault(m, r), requestFirstPiece: (id) => t.requestFirstPiece(id),
    };
}
