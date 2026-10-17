import { snakeKeys } from './orderImportApi.js';
export function createPermissionAdminApi(client, session) {
    const call = async (fn, args) => client.rpc(fn, args, session);
    return {
        overview: async () => snakeKeys(await call('permission_admin_overview', {})),
        designateOwner: async (userId, reason) => { await call('designate_system_owner', { p_user_id: userId, p_reason: reason }); },
        removeOwner: async (userId, reason) => { await call('remove_system_owner', { p_user_id: userId, p_reason: reason }); },
        grant: async (userId, module, verb, reason, recordScope, fieldScope) => { await call('grant_permission', { p_user_id: userId, p_module: module, p_verb: verb, p_reason: reason, p_record_scope: recordScope, p_field_scope: fieldScope }); },
        revoke: async (grantId, reason) => { await call('revoke_permission', { p_grant_id: grantId, p_reason: reason }); },
    };
}
