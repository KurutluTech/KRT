import { isSetupPending } from './errorText.js';
let missing = false; // schema capability (not user data): safe to share across users on one page load
export function createHomePrefsApi(client, session, opts = {}) {
    const enabled = opts.enabled === true;
    return {
        available: () => enabled && !missing,
        async get() {
            if (!enabled || missing)
                return null;
            try {
                const r = await client.rpc('get_home_prefs', {}, session);
                return Array.isArray(r?.sectionOrder) ? r.sectionOrder : null;
            }
            catch (e) {
                if (isSetupPending(e)) {
                    missing = true;
                    return null;
                }
                throw e;
            }
        },
        async set(order) {
            if (!enabled || missing)
                return;
            try {
                await client.rpc('set_home_prefs', { p_order: [...order] }, session);
            }
            catch (e) {
                if (isSetupPending(e)) {
                    missing = true;
                    return;
                }
                throw e;
            }
        },
    };
}
export const resetHomePrefsProbe = () => { missing = false; };
