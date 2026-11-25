// r19 — CUT/PREP başlangıç paneli adaptörü (kmi_next.cutprep_start_panel; salt okunur). Anahtarlar data-client tarafından camelCase'e çevrilir.
import { isSetupPending } from './errorText.js';
export function createCutPrepPanelApi(client, session) {
    return {
        async panel(woId) {
            try {
                return await client.rpc('cutprep_start_panel', { p_wo: woId }, session);
            }
            catch (e) {
                if (isSetupPending(e))
                    return { setupPending: true };
                throw e;
            }
        },
    };
}
