// KMI NEXT — device integration contract (Nikken 40, LockCell 41, CNC 42). Twin of migration 0048.
// BLOCKED — DEVICE EVIDENCE REQUIRED: no protocol, endpoint, credential or field mapping is written here,
// because no verified device document exists. The contract below is what a future, evidence-backed adapter
// must satisfy; until then every adapter is fail-closed and every message is quarantined.
/** The only adapter that exists today: refuses everything, and refuses simulator data as live. */
export function blockedAdapter(kind) {
    return {
        kind,
        evidenceRef: null,
        parse(msg) {
            if (msg.source === 'SIMULATOR')
                return { ok: false, error: 'SIMULATED_NOT_LIVE' };
            if (msg.payload === null || typeof msg.payload !== 'object' || Array.isArray(msg.payload))
                return { ok: false, error: 'PAYLOAD_INVALID' };
            return { ok: false, error: 'BLOCKED_DEVICE_EVIDENCE_REQUIRED' };
        },
    };
}
/** Inbox rule (same as kmi_next.device_ingest): idempotent per device + message id; never applied. */
export function ingestDecision(seen, msg) {
    const key = `${msg.deviceId}|${msg.externalMessageId.trim()}`;
    return { accepted: !seen.has(key), duplicate: seen.has(key), applied: false, status: 'QUARANTINED' };
}
export const INTEGRATION_TR = {
    NIKKEN_PRESETTER: 'Nikken takım ön-ayar cihazı', LOCKCELL: 'LockCell takım dolabı', CNC_CONTROLLER: 'CNC kontrol ünitesi',
};
