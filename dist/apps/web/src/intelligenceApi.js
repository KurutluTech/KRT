export function createIntelligenceApi(client, session) {
    return {
        nextActions: () => client.rpc('next_best_actions', {}, session),
        ask: (q) => client.rpc('copilot_ask', { p_question: q }, session),
        processMining: (from, to) => client.rpc('process_mining', { p_from: from, p_to: to }, session),
        twin: (days) => client.rpc('factory_twin', { p_days: days }, session),
        scenarioMachineDown: (code, days) => client.rpc('twin_scenario_machine_down', { p_machine_code: code, p_days: days }, session),
    };
}
