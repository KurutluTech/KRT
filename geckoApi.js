export function createGeckoApi(client, session) {
    return {
        health: () => client.rpc('gecko_health', {}, session),
        attendance: (date) => client.rpc('gecko_attendance_day', { p_date: date }, session),
        identifiers: () => client.rpc('gecko_identifiers', {}, session),
        people: () => client.select('personnel', { columns: 'id,name,active', order: 'name.asc' }, session),
        syncNow: () => client.rpc('request_gecko_mirror', {}, session),
        async setLink(identifier, personnelId, status, reason) {
            await client.rpc('set_gecko_identifier_link', { p_identifier: identifier, p_personnel_id: personnelId, p_status: status, p_reason: reason }, session);
        },
        async setSchedule(enabled, reason) {
            await client.rpc('set_gecko_schedule', { p_enabled: enabled, p_reason: reason }, session);
        },
        grants: () => client.select('gecko_view_grants', { columns: 'user_id,reason,granted_at,revoked_at', filters: { revoked_at: 'is.null' }, order: 'granted_at.desc' }, session),
        async grantView(userId, reason) {
            await client.rpc('grant_attendance_view', { p_user_id: userId, p_reason: reason }, session);
        },
        async revokeView(userId, reason) {
            await client.rpc('revoke_attendance_view', { p_user_id: userId, p_reason: reason }, session);
        },
        myAttendance: (from, to) => client.rpc('my_gecko_attendance', { p_from: from, p_to: to }, session),
    };
}
