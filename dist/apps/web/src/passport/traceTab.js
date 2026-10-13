// KMI NEXT — the "İzlenebilirlik zinciri" tab of the ONE canonical passport (/nesne). The chain itself (missing links · as-built · raw material · lots · shipments ·
// economic lock) is read by the existing server read models (work_order_passport / lot_passport / product_dna); this file only mounts it inside the canonical
// passport and routes every jump to another object back to the canonical passport. No data, no table, no second audit.
import { renderPassportScreen } from '../screens/PassportScreen.js';
import { CANONICAL_TO_LEGACY, canonicalHref } from './registry.js';
export function createTraceMounter(api, navigate) {
    return async (host, kind, id) => {
        const legacy = CANONICAL_TO_LEGACY[kind];
        if (!legacy) {
            host.textContent = 'Bu nesne türü için izlenebilirlik zinciri tanımlı değil.';
            return;
        }
        await renderPassportScreen(host, api, {
            view: { kind: legacy, id }, embedded: true,
            navigate: (k, i) => navigate(canonicalHref(k, i)),
        });
    };
}
