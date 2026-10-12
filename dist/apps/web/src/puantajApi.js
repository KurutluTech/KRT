export function createPuantajApi(client, session) {
    return {
        facts: (month) => client.rpc('puantaj_month_facts', { p_month: month }, session),
        async setInput(month, personId, patch, reason) { await client.rpc('set_puantaj_input', { p_month: month, p_personnel_id: personId, p_patch: patch, p_reason: reason }, session); },
        async setPool(month, amount, reason) { await client.rpc('set_puantaj_pool', { p_month: month, p_amount: amount, p_reason: reason }, session); },
        async close(month, config, results, distribution) {
            await client.rpc('close_puantaj_period', { p_month: month, p_config: config, p_results: results, p_distribution: distribution }, session);
        },
    };
}
