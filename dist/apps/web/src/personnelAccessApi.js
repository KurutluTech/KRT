export function createPersonnelAccessApi(client, session) {
    return {
        overview: () => client.rpc('personnel_access_overview', {}, session),
        accounts: () => client.rpc('linkable_accounts', {}, session),
        async link(personId, userId) { await client.rpc('set_personnel_login', { p_personnel_id: personId, p_auth_user_id: userId }, session); },
        async setShift(personId, shiftCode) { await client.rpc('set_personnel_shift', { p_person_id: personId, p_shift_code: shiftCode }, session); },
        async grantMulti(personId, level, reason) { await client.rpc('grant_operator_multi_machine_authorization', { p_person_id: personId, p_level: level, p_reason: reason }, session); },
        async revokeMulti(personId, reason) { await client.rpc('revoke_operator_multi_machine_authorization', { p_person_id: personId, p_reason: reason }, session); },
    };
}
