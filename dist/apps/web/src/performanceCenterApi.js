import { createCommandCenterApi } from './commandCenterApi.js';
import { createLiveApi } from './liveApi.js';
import { createOeeApi } from './oeeApi.js';
import { createIntelligenceApi } from './intelligenceApi.js';
export function createPerformanceCenterSources(client, session) {
    const cc = createCommandCenterApi(client, session), live = createLiveApi(client, session), oee = createOeeApi(client, session), intel = createIntelligenceApi(client, session);
    return {
        snapshot: () => cc.snapshot(),
        board: () => live.board('OFFICE'),
        machineInfo: async () => (await live.machineInfo()).map((m) => ({ id: m.id, code: m.code, name: m.name, machineClass: m.machineClass })),
        oee: (from, to, group) => oee.rollup(from, to, group),
        nba: () => intel.nextActions(),
        process: async (from, to) => { const r = await intel.processMining(from, to); return { bottleneck: r.workOrder.bottleneck, reason: r.workOrder.bottleneckReason, sufficiency: r.workOrder.sufficiency }; },
    };
}
const ok = async (p) => { try {
    return await p();
}
catch {
    return null;
} };
export async function loadPerformanceCenter(src, range, nowIso) {
    const [snapshot, board, info, oeeTotal, oeeDaily, oeeByMachine, nba, processBottleneck] = await Promise.all([
        ok(src.snapshot), ok(src.board), ok(src.machineInfo), ok(() => src.oee(range.from, range.to, 'TOTAL')), ok(() => src.oee(range.from, range.to, 'DATE')),
        ok(() => src.oee(range.from, range.to, 'MACHINE')), ok(src.nba), ok(() => src.process(range.monthFrom, range.to)),
    ]);
    return { nowIso, snapshot, board, info: info ?? [], oeeTotal, oeeDaily, oeeByMachine, nba, processBottleneck };
}
