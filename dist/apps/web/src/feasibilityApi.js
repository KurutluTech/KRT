// KMI technical RFQ feasibility adapter (migration 0115). The server returns TECHNICAL content only (no customer, title, reference, note, price); this adapter adds nothing to that.
import { selReal } from './pilotMark.js';
export function createFeasibilityApi(client, session) {
    return {
        queue: () => client.rpc('rfq_feasibility_queue', {}, session),
        machines: () => selReal(client, 'machines', { columns: 'id,code,name', order: 'code.asc', limit: 200 }, session),
        assess: async (lineId, f) => { await client.rpc('rfq_assess_feasibility', { p_rfq_line_id: lineId, p_verdict: f.verdict, p_machine_ids: f.machineIds, p_summary: f.summary, p_risks: f.risks || null, p_tooling: f.tooling || null, p_quality: f.quality || null, p_external: f.external || null }, session); },
    };
}
