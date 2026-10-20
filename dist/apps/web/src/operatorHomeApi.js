// Operator home / shift / tool-event adapter — migration 0061. Keys arrive camelCased from the data-client.
import { fetchPilotFlags } from './pilotMark.js';
export function createOperatorHomeApi(client, session) {
    return {
        async home() {
            const h = await client.rpc('operator_home', {}, session);
            if (!h.linked)
                return h;
            const f = await fetchPilotFlags(client, session, [...h.active.map((j) => j.workOrderId), ...h.assigned.map((j) => j.workOrderId)]);
            if (!f.size)
                return h;
            return { ...h, active: h.active.map((j) => (f.has(j.workOrderId) ? { ...j, isPilot: true } : j)), assigned: h.assigned.map((j) => (f.has(j.workOrderId) ? { ...j, isPilot: true } : j)) };
        },
        daySummary: () => client.rpc('operator_day_summary', { p_date: null }, session),
        async confirmShiftEnd(note) {
            await client.rpc('confirm_shift_end', { p_date: null, p_note: note || null }, session);
        },
        async toolEvent(machineId, workOrderId, kind, toolCode, note, rid) {
            await client.rpc('report_operator_tool_event', { p_machine_id: machineId, p_work_order_id: workOrderId, p_kind: kind, p_tool_code: toolCode, p_note: note || null, p_client_request_id: rid }, session);
        },
    };
}
