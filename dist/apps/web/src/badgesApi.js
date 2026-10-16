export function createBadgesApi(client, session) {
    return {
        myPersonnelId: () => client.rpc('actor_personnel_id', {}, session),
        profile: (id) => client.rpc('badge_profile', { p_personnel_id: id }, session),
        evaluate: (id) => client.rpc('evaluate_badges', { p_personnel_id: id }, session),
        markSeen: (id) => client.rpc('badge_mark_seen', { p_personnel_id: id }, session),
    };
}
