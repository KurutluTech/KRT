// KMI-HOME-001 — read-only count loaders for cockpit cards whose canonical source is a table (not the command_center snapshot).
// Each loader reads through the user's own session (RLS decides), asks for ids only (no amounts, no personal fields), and returns
// null — rendered as BİLİNMİYOR — when the read fails or hit the row cap (a capped read is only a lower bound, never a count).
import { selReal } from './pilotMark.js';
export const COUNT_CAP = 2000;
const day = (iso, plus = 0) => {
    const d = new Date(Date.parse(iso) + plus * 86_400_000);
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(d); // YYYY-MM-DD, Istanbul calendar day
};
export function countSpecs(nowIso) {
    const today = day(nowIso), in30 = day(nowIso, 30);
    return {
        approvalsPending: { table: 'commercial_approvals', filters: { status: 'eq.PENDING' } },
        firstPiecePending: { table: 'work_order_operations', real: true, filters: { status: 'eq.FIRST_PIECE_PENDING' } },
        woAssigned: { table: 'work_orders', real: true, filters: { status: 'eq.MACHINE_ASSIGNED' } },
        lotsHold: { table: 'stock_lots', filters: { state: 'eq.HOLD' } },
        lotsAvailable: { table: 'stock_lots', filters: { state: 'eq.AVAILABLE' } },
        lotsReserved: { table: 'stock_lots', filters: { state: 'eq.RESERVED' } },
        lotsStaged: { table: 'stock_lots', filters: { state: 'eq.STAGED' } },
        camDraft: { table: 'cam_programs', filters: { status: 'eq.DRAFT' } },
        toolsTotal: { table: 'tools' },
        personnelActive: { table: 'personnel', filters: { active: 'eq.true' } },
        personnelNoLogin: { table: 'personnel', filters: { active: 'eq.true', auth_user_id: 'is.null' } },
        skillsExpired: { table: 'personnel_skills', filters: { valid_until: `lt.${today}` }, columns: 'personnel_id' },
        skillsExpiring: { table: 'personnel_skills', filters: { and: `(valid_until.gte.${today},valid_until.lte.${in30})` }, columns: 'personnel_id' },
        devicesActive: { table: 'devices', filters: { active: 'eq.true' } },
        inboxQuarantined: { table: 'device_inbox', filters: { status: 'eq.QUARANTINED' } },
        customersActive: { table: 'customers', filters: { active: 'eq.true' } },
        ordersDraft: { table: 'orders', filters: { status: 'eq.DRAFT' } },
        ordersInProduction: { table: 'orders', filters: { status: 'eq.IN_PRODUCTION' } },
        invoicesOpen: { table: 'invoices', filters: { status: 'in.(OPEN,PARTIAL)' } },
        supplierInvoicesOpen: { table: 'supplier_invoices', filters: { status: 'in.(OPEN,PARTIAL)' } },
        supplierInvoicesOverdue: { table: 'supplier_invoices', filters: { status: 'in.(OPEN,PARTIAL)', due_date: `lt.${today}` } },
    };
}
export async function loadCount(client, session, spec) {
    try {
        const opts = { columns: spec.columns ?? 'id', ...(spec.filters ? { filters: spec.filters } : {}), limit: COUNT_CAP };
        const rows = spec.real ? await selReal(client, spec.table, opts, session) : await client.select(spec.table, opts, session);
        return rows.length >= COUNT_CAP ? null : rows.length;
    }
    catch {
        return null;
    }
}
/** Tools past their rated life: a column-vs-column comparison PostgREST cannot filter, so rows are read (two numbers each) and compared here. */
export async function loadToolsLifeExceeded(client, session) {
    try {
        const rows = await client.select('tools', { columns: 'life_minutes_used,life_minutes_rated', limit: COUNT_CAP }, session);
        if (rows.length >= COUNT_CAP)
            return null;
        return rows.filter((t) => typeof t.lifeMinutesRated === 'number' && t.lifeMinutesRated > 0 && typeof t.lifeMinutesUsed === 'number' && t.lifeMinutesUsed >= t.lifeMinutesRated).length;
    }
    catch {
        return null;
    }
}
/** Loads only the extras the user's visible cards need. awaitingMgmt needs the management_released_at column, so it is derived from one extra read. */
export async function loadExtras(client, session, keys, nowIso) {
    const specs = countSpecs(nowIso);
    const out = {};
    await Promise.all(keys.map(async (k) => {
        if (k === 'toolsLifeExceeded') {
            out[k] = await loadToolsLifeExceeded(client, session);
            return;
        }
        if (k === 'approvalsAwaitingMgmt') {
            try {
                const rows = await client.select('commercial_approvals', { columns: 'management_released_at', filters: { status: 'eq.PENDING' }, limit: COUNT_CAP }, session);
                out[k] = rows.length >= COUNT_CAP ? null : rows.filter((x) => !x.managementReleasedAt).length;
            }
            catch {
                out[k] = null;
            }
            return;
        }
        const sp = specs[k];
        out[k] = sp ? await loadCount(client, session, sp) : null;
    }));
    return out;
}
