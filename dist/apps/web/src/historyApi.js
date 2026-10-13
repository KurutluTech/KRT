import { auditToEvent } from '../../../packages/domain/src/temporal.js';
export function createHistoryApi(client, session) {
    return {
        async search(q) {
            const limit = Math.min(q.limit ?? 500, 1000);
            const filters = {};
            if (q.range)
                filters['and'] = `(at.gte.${q.range.from},at.lt.${q.range.to})`;
            if (q.entityType)
                filters['entity_type'] = `eq.${q.entityType}`;
            if (q.action)
                filters['action'] = `eq.${q.action}`;
            const rows = await client.select('audit_log', { columns: 'id,at,actor_user_id,action,entity_type,entity_id,reason,before_state,after_state', filters, order: 'at.desc', limit }, session);
            const ids = [...new Set(rows.map((r) => r.actorUserId).filter(Boolean))];
            const names = {};
            if (ids.length) {
                try {
                    const ps = await client.select('personnel', { columns: 'auth_user_id,name', filters: { auth_user_id: `in.(${ids.join(',')})` }, limit: 500 }, session);
                    for (const p of ps)
                        if (p.authUserId)
                            names[p.authUserId] = p.name;
                }
                catch { /* names are optional: the actor id stays visible */ }
            }
            return { events: rows.map((r) => auditToEvent(r, names)), truncated: rows.length >= limit };
        },
    };
}
