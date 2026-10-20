import { periodFetchFrom } from '../../../packages/domain/src/liveKpi.js';
import { selReal } from './pilotMark.js';
export function createLiveApi(client, session) {
    return {
        board: (profile) => client.rpc('live_board', { p_profile: profile }, session),
        machineInfo: async () => {
            try {
                return await selReal(client, 'machines', { columns: 'id,code,name,machine_class', order: 'code.asc', limit: 200 }, session);
            }
            catch {
                return (await selReal(client, 'machines', { columns: 'id,code,name', order: 'code.asc', limit: 200 }, session)).map((m) => ({ ...m, machineClass: null }));
            } // live DB may lack machine_class
        },
        periods: async (nowIso) => {
            const CAP = 5000;
            const rows = await selReal(client, 'production_declarations', { columns: 'qty_good,qty_scrap,declared_at', filters: { declared_at: `gte.${periodFetchFrom(nowIso)}` }, order: 'declared_at.desc', limit: CAP }, session);
            let assigned = null;
            try {
                assigned = (await selReal(client, 'work_orders', { columns: 'id', filters: { status: 'eq.MACHINE_ASSIGNED' }, limit: 1000 }, session)).length;
            }
            catch {
                assigned = null;
            }
            return { rows, truncated: rows.length >= CAP, assigned };
        },
        workDetail: async () => (await client.rpc('command_center', {}, session)).liveWorkOrders ?? [],
        cncStates: () => client.rpc('cnc_live_states', {}, session),
        listDisplays: () => client.rpc('list_live_displays', {}, session),
        createDisplay: (name) => client.rpc('create_live_display', { p_name: name }, session),
        revokeDisplay: async (id, reason) => { await client.rpc('revoke_live_display', { p_id: id, p_reason: reason }, session); },
    };
}
/** Kiosk: no session, token only. */
export function createKioskLiveApi(client, token) {
    const refuse = async () => { throw new Error('KIOSK_READ_ONLY'); };
    return {
        board: () => client.rpc('live_board_display', { p_token: token }, null),
        listDisplays: refuse, createDisplay: refuse, revokeDisplay: refuse,
    };
}
