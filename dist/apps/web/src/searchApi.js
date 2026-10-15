const MISSING_FN = /PGRST202|42883|could not find the function|unknown rpc|no parameter|schema cache/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export function createSearchApi(client, session) {
    return {
        async search(q, f = {}) {
            const types = (f.types ?? []).filter(Boolean);
            const from = f.from && ISO_DAY.test(f.from) ? f.from : null, to = f.to && ISO_DAY.test(f.to) ? f.to : null;
            try {
                const r = await client.rpc('universal_search_v2', { p_query: q, p_limit: types.length === 1 ? 20 : 8, p_types: types.length ? types : null, p_from: from, p_to: to, p_status: f.status || null }, session);
                return { query: r.query, results: r.results ?? [], note: r.note, statuses: r.statuses ?? [], typeCounts: r.type_counts ?? [], datelessTypes: r.dateless_types ?? [] };
            }
            catch (e) {
                if (!MISSING_FN.test(String(e?.message ?? e)))
                    throw e;
            }
            const r = await client.rpc('universal_search', { p_query: q, p_limit: 8 }, session);
            const counts = new Map();
            for (const x of r.results ?? [])
                counts.set(x.type, (counts.get(x.type) ?? 0) + 1);
            return { query: r.query, results: types.length ? (r.results ?? []).filter((x) => types.includes(x.type)) : (r.results ?? []), note: r.note, legacy: true,
                typeCounts: [...counts].map(([type, count]) => ({ type, count })), statuses: [], datelessTypes: [] };
        },
    };
}
