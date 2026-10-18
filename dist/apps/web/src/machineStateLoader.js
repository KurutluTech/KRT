// KMI-013 §3 — one loader so every secondary screen (Planlama Kokpiti, Shift Planner, İE pasaportu, terminal) shows the SAME canonical machine state as KMI LIVE:
// the live board's per-machine active sessions → machineState() (the single engine). Failure ⇒ empty map ⇒ screens show UNKNOWN for UP machines, never an invented idle/running state.
import { machineState } from '../../../packages/domain/src/machineState.js';
import { spindleForState, spindleIcon } from './spindle.js';
export async function loadMachineStates(api) {
    const out = new Map();
    try {
        const b = await api.board('OFFICE');
        for (const m of b.machines)
            out.set(m.code, machineState({ status: m.status, active: m.active }));
    }
    catch { /* UNKNOWN fallback below */ }
    return out;
}
/** Same icon every surface uses. `status` is the plan/passport record, used only when the live board is unavailable: a non-UP record is still true, UP without live data is UNKNOWN. */
export function machineSpindle(states, code, status, size = 22) {
    const s = states?.get(code);
    if (s)
        return spindleForState(s, size);
    if (status && status !== 'UP')
        return spindleForState(machineState({ status, active: [] }), size);
    return spindleIcon('UNKNOWN', size);
}
