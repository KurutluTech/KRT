// m0193: approval/decision RPCs go through try_* wrappers so a BLOCKED attempt is written to audit_log (outcome REJECTED) and survives rollback.
// Behaviour for the user is unchanged: a blocked attempt still throws the original server message. If the wrapper is not deployed yet
// (404 / PGRST202) the canonical RPC is called exactly as before.
export const TRY_RPC = {
    grant_management_release: 'try_grant_management_release',
    decide_commercial_approval: 'try_decide_commercial_approval',
    commercial_doc_decide: 'try_commercial_doc_decide',
    decide_operation_first_piece: 'try_decide_operation_first_piece',
    record_operation_qc: 'try_record_operation_qc',
};
export class BlockedAttemptError extends Error {
    constructor(res) { super(String(res?.message ?? res?.code ?? 'BLOCKED')); this.name = 'BlockedAttemptError'; this.code = res?.sqlstate; this.status = 400; this.blockedCode = res?.code; }
}
export async function auditedRpc(client, fn, args, session) {
    const t = TRY_RPC[fn];
    if (!t)
        return client.rpc(fn, args, session);
    let res;
    try {
        res = await client.rpc(t, args, session);
    }
    catch (e) {
        if (e?.status === 404 || e?.code === 'PGRST202')
            return client.rpc(fn, args, session); // wrapper not deployed yet
        throw e;
    }
    if (res && res.ok === false)
        throw new BlockedAttemptError(res);
    return res;
}
