export function createLiveApi(client, session) {
    return {
        board: (profile) => client.rpc('live_board', { p_profile: profile }, session),
        machineInfo: () => client.select('machines', { columns: 'code,name,machine_class', order: 'code.asc', limit: 200 }, session),
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
