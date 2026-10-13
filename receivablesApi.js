export function createReceivablesApi(client, session) {
    return {
        list: () => client.rpc('receivables_due', {}, session),
        setTerms: async (customerId, days, validFrom, reason) => {
            await client.rpc('set_customer_payment_terms', { p_customer_id: customerId, p_days: days, p_valid_from: validFrom, p_reason: reason }, session);
        },
    };
}
