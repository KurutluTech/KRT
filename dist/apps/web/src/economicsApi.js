// Economic analysis + management decision engine adapter — migrations 0036 + 0044 (owner binding, cost model,
// corrective decisions).
// Every call is refused by the server (FORBIDDEN: ECONOMIC_OWNER_ONLY) unless the caller is the bound
// owner or a person the owner named; the screen only reflects that answer.
import { selReal } from './pilotMark.js';
export function createEconomicsApi(client, session) {
    return {
        overview: (from, to) => client.rpc('economic_overview', { p_from: from, p_to: to }, session),
        board: () => client.rpc('management_decision_board', {}, session),
        decide: async (key, decision, note, postponeUntil) => {
            await client.rpc('record_management_decision', { p_key: key, p_decision: decision, p_note: note, p_postpone_until: postponeUntil }, session);
        },
        thresholdOverview: () => client.rpc('economic_threshold_overview', {}, session),
        setThreshold: (key, value, active, reason) => client.rpc('set_economic_threshold', { p_key: key, p_value: value, p_active: active, p_reason: reason }, session),
        setThresholds: async (t) => {
            await client.rpc('set_economic_thresholds', { p_receivable_age_days: t.receivableAgeDays, p_payable_due_soon_days: t.payableDueSoonDays,
                p_price_increase_pct: t.priceIncreasePct, p_scrap_share_pct: t.scrapSharePct }, session);
        },
        bindingStatus: () => client.rpc('economic_binding_status', {}, session),
        claimBinding: (code) => client.rpc('claim_owner_binding', { p_code: code }, session),
        requestOwnerBinding: () => client.rpc('request_owner_binding', {}, session),
        cancelOwnerBindingRequest: async () => { await client.rpc('cancel_my_owner_binding_request', {}, session); },
        revokeOwnerBinding: async (reason) => { await client.rpc('revoke_owner_binding', { p_reason: reason }, session); },
        costParameters: () => client.select('cost_parameters', { columns: 'id,kind,scope_key,value,currency,valid_from,source,source_date,reason,set_at', order: 'kind.asc,scope_key.asc,valid_from.desc,set_at.desc' }, session),
        setCostParameter: async (p) => {
            await client.rpc('set_cost_parameter', { p_kind: p.kind, p_scope_key: p.scopeKey, p_value: p.value, p_currency: p.currency, p_valid_from: p.validFrom,
                p_source: p.source, p_source_date: p.sourceDate, p_reason: p.reason }, session);
        },
        recentWorkOrders: () => selReal(client, 'work_orders', { columns: 'id,status,qty_planned,created_at', order: 'created_at.desc', limit: 30 }, session),
        workOrderCost: (id) => client.rpc('work_order_cost', { p_work_order_id: id }, session),
        correctDecision: async (id, decision, note, postponeUntil) => {
            await client.rpc('record_corrective_decision', { p_decision_id: id, p_decision: decision, p_note: note, p_postpone_until: postponeUntil }, session);
        },
    };
}
