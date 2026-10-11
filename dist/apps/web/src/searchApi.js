export function createSearchApi(client, session) {
    return { search: (q) => client.rpc('universal_search', { p_query: q, p_limit: 8 }, session) };
}
