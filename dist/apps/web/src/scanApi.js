export function createScanApi(client, session) {
    return {
        async operation(raw, source, clientRequestId) {
            return client.rpc('operation_scan', { p_input: raw, p_work_order: null, p_source: source, p_client_request_id: clientRequestId }, session);
        },
        async record(raw, type, ref, source, clientRequestId) {
            return client.rpc('record_scan', { p_raw: raw, p_scan_type: type, p_scan_ref: ref, p_source: source, p_client_request_id: clientRequestId }, session);
        },
    };
}
