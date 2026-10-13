export function createPersonnelAccessApi(client, session) {
    return {
        operator: {
            overview: async () => (await client.rpc('operator_credentials_overview', {}, session)),
            async setPin(personId, pin, reason) { await client.rpc('set_operator_pin', { p_personnel_id: personId, p_pin: pin, p_reason: reason }, session); },
            issueBadge: (personId, label, replace) => client.rpc('issue_operator_badge', { p_personnel_id: personId, p_label: label, p_replace: replace }, session),
            async revokeBadge(badgeId, reason) { await client.rpc('revoke_operator_badge', { p_badge_id: badgeId, p_reason: reason }, session); },
            async deactivate(personId, reason) { await client.rpc('deactivate_operator_access', { p_personnel_id: personId, p_reason: reason }, session); },
        },
        overview: () => client.rpc('personnel_access_overview', {}, session),
        accounts: () => client.rpc('linkable_accounts', {}, session),
        async link(personId, userId) { await client.rpc('set_personnel_login', { p_personnel_id: personId, p_auth_user_id: userId }, session); },
        async setShift(personId, shiftCode) { await client.rpc('set_personnel_shift', { p_person_id: personId, p_shift_code: shiftCode }, session); },
        async grantMulti(personId, level, reason) { await client.rpc('grant_operator_multi_machine_authorization', { p_person_id: personId, p_level: level, p_reason: reason }, session); },
        async revokeMulti(personId, reason) { await client.rpc('revoke_operator_multi_machine_authorization', { p_person_id: personId, p_reason: reason }, session); },
    };
}
