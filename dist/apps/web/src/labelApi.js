export function createLabelApi(client, session) {
    return {
        async issue(entityType, entityId, layout, reason, clientRequestId) {
            return client.rpc('issue_label', { p_entity_type: entityType, p_entity_id: entityId, p_layout: layout, p_reason: reason, p_client_request_id: clientRequestId }, session);
        },
        async history(entityType, entityId) {
            return client.rpc('label_print_history', { p_entity_type: entityType, p_entity_id: entityId }, session);
        },
    };
}
