export function createPersonnelAccessApi(client, session) {
    return {
        operator: {
            overview: async () => (await client.rpc('operator_credentials_overview', {}, session)),
            async setPin(personId, pin, _reason) {
                // 4 haneli canlı hat: badge-login `set_pin` (yönetici JWT'si şart; sunucu 4 hane + zayıf PIN + audit + nesil uygular).
                if (!session)
                    throw new Error('Oturum gerekli.');
                if (!/^[0-9]{4}$/.test(pin))
                    throw new Error('PIN 4 rakamdan oluşmalıdır.');
                const rows = (await client.rpc('operator_credentials_overview', {}, session));
                const employeeNo = rows.find((r) => r.personnelId === personId)?.employeeNo;
                if (!employeeNo)
                    throw new Error('Sicil numarası bulunamadı.');
                await client.managerSetPin(session, employeeNo, pin);
            },
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
