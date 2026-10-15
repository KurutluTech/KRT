// KMI-002 — "Fabrika nabzı": the 5–7 compact KPIs on the first screen. Pure rules (no DOM, no I/O): same input → same tiles.
// Nothing is invented: a missing source gives value=null ("BİLİNMİYOR"), never 0; an active work order is NOT "the CNC is running";
// an operator assigned to a work order is NOT "on the floor" (no GEÇKO/physical presence source is consulted here).
import { homeDomainsFor } from './homeLayout.js';
import { machineState } from './machineState.js';
const num = (c, k) => { const v = c?.[k]; return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null; };
const NUM = new Intl.NumberFormat('tr-TR');
function headlines(b) { return b.machines.map((m) => machineState({ status: m.status, active: m.active }).headline); }
export function buildPulse(i) {
    const b = i.board;
    const hl = b ? headlines(b) : null;
    const cnt = (k) => (hl ? hl.filter((x) => x === k).length : null);
    const tiles = [];
    const canSeeBoard = i.boardApplicable;
    if (canSeeBoard) {
        const total = b?.machines.length ?? null;
        const active = cnt('ACTIVE_WORK_ORDER') !== null ? cnt('ACTIVE_WORK_ORDER') + (cnt('FIRST_PIECE') ?? 0) : null;
        tiles.push({ id: 'machines', label: 'Aktif iş emri olan makine', value: active !== null && total !== null ? `${active} / ${total}` : null, sub: 'kayıtlı durum · fiziksel CNC doğrulanmaz', tone: active === null ? 'unknown' : 'info', href: i.canOpen('/canli') ? '#/canli' : null, domain: 'PRODUCTION' });
        const wo = num(i.counters, 'workOrdersRunning');
        tiles.push({ id: 'workorders', label: 'Çalışan iş emri', value: wo !== null ? String(wo) : null, sub: 'ilk parça bekleyenler dahil', tone: wo === null ? 'unknown' : 'info', href: i.canOpen('/is-emirleri') ? '#/is-emirleri' : null, domain: 'PRODUCTION' });
        // assigned operators: only names the server delivered; "undefined" (not visible to this role) is unknown, an empty list of known names is 0
        let names = null;
        if (b) {
            const seen = new Set();
            let anyKnown = false;
            for (const m of b.machines)
                for (const a of m.active) {
                    if (a.operator !== undefined)
                        anyKnown = true;
                    if (a.operator)
                        seen.add(a.operator);
                }
            names = anyKnown || b.machines.every((m) => m.active.length === 0) ? seen : null;
        }
        tiles.push({ id: 'operators', label: 'Atanmış operatör', value: names ? String(names.size) : null, sub: 'iş emrine atanmış · sahada olduğu doğrulanmaz', tone: names ? 'info' : 'unknown', href: null, domain: 'PRODUCTION' });
        const down = cnt('DOWN');
        const openMaint = b ? b.machines.reduce((s, m) => s + m.openMaintenance, 0) : null;
        tiles.push({ id: 'maintenance', label: 'Arızalı makine', value: down !== null ? String(down) : null, sub: openMaint !== null ? `${openMaint} açık bakım kaydı` : 'bakım kaydı okunamadı', tone: down === null ? 'unknown' : down > 0 ? 'bad' : openMaint ? 'warn' : 'ok', href: i.canOpen('/bakim') ? '#/bakim' : null, domain: 'MAINTENANCE' });
        const holds = b ? b.machines.reduce((s, m) => s + m.openHolds, 0) : null;
        const fp = cnt('FIRST_PIECE');
        tiles.push({ id: 'quality', label: 'Açık kalite bekletmesi', value: holds !== null ? String(holds) : null, sub: fp !== null ? `${fp} makinede ilk parça onayı bekliyor` : 'ilk parça durumu okunamadı', tone: holds === null ? 'unknown' : holds > 0 ? 'bad' : fp ? 'warn' : 'ok', href: i.canOpen('/kalite') ? '#/kalite' : null, domain: 'QUALITY' });
    }
    if (i.canOpen('/siparisler') || i.canOpen('/sevkiyat')) {
        const late = num(i.counters, 'orderItemsOverdue');
        const open = num(i.counters, 'openOrders');
        tiles.push({ id: 'delivery', label: 'Gecikmiş teslim kalemi', value: late !== null ? String(late) : null, sub: open !== null ? `${open} açık sipariş · sevk edilmeyen miktar` : 'açık sipariş okunamadı', tone: late === null ? 'unknown' : late > 0 ? 'bad' : 'ok', href: i.canOpen('/siparisler') ? '#/siparisler' : i.canOpen('/sevkiyat') ? '#/sevkiyat' : null, domain: 'SHIPMENT' });
    }
    if (canSeeBoard) {
        const good = b ? b.machines.reduce((s, m) => s + (m.shiftGood || 0), 0) : null;
        const scrap = b ? b.machines.reduce((s, m) => s + (m.shiftScrap || 0), 0) : null;
        const rate = good !== null && scrap !== null && good + scrap > 0 ? Math.round((scrap / (good + scrap)) * 1000) / 10 : null;
        tiles.push({ id: 'shiftprod', label: b?.shift ? `Vardiya sağlam adet · ${b.shift}` : 'Vardiya sağlam adet', value: good !== null ? NUM.format(good) : null, sub: scrap !== null ? `hurda ${NUM.format(scrap)}${rate !== null ? ` · %${String(rate).replace('.', ',')}` : ''}` : 'hurda okunamadı', tone: good === null ? 'unknown' : rate !== null && rate >= 5 ? 'warn' : 'info', href: i.canOpen('/oee') ? '#/oee' : null, domain: 'PRODUCTION' });
    }
    return orderPulse(tiles, i.access);
}
/** Management sees the fixed executive order; a department role sees its own domains first (then cross-process tiles it may open), capped at 6. */
export function orderPulse(tiles, access) {
    const d = homeDomainsFor(access);
    if (d === 'ALL')
        return tiles.slice(0, 7);
    const rank = (t) => { const k = t.domain === 'COMMERCIAL' ? -1 : d.indexOf(t.domain); return k < 0 ? 99 : k; }; // the role's primary domain first
    return tiles.map((t, n) => ({ t, n })).sort((a, b) => rank(a.t) - rank(b.t) || a.n - b.n).map((x) => x.t).slice(0, 6);
}
/** Machine park ordering for a department: its own problems first (QUALITY → hold/first piece, MAINTENANCE → down/maintenance, PRODUCTION → down/active). */
export function fleetPriority(access) {
    const d = homeDomainsFor(access);
    const base = ['DOWN', 'HOLD', 'MAINTENANCE', 'FIRST_PIECE', 'ACTIVE_WORK_ORDER', 'READY_IDLE', 'UNKNOWN'];
    if (d === 'ALL')
        return base;
    const first = [];
    if (d.includes('QUALITY'))
        first.push('HOLD', 'FIRST_PIECE');
    if (d.includes('MAINTENANCE'))
        first.push('DOWN', 'MAINTENANCE');
    if (d.includes('PRODUCTION'))
        first.push('DOWN', 'ACTIVE_WORK_ORDER');
    return [...new Set([...first, ...base])];
}
