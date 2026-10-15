// KMI Quality Desk — ONE decision queue for the quality department, built from the canonical records only:
// work_order_operations (first piece / in-process QC), quality_holds, quality_ncrs, goods_receipts (incoming QC), and routing completion (final release).
// No second state machine: every action calls the existing RPC (the server authorises and audits). A source that failed is `null` → UNKNOWN, never "nothing waiting".
import { canTransitionNcr, isNcrOpen } from './qualityNcr.js';
import { finalReleaseReady } from './routing.js';
export const QKIND_TR = { HOLD: 'HOLD (serbest bırakma)', FIRST_PIECE: 'İlk parça kararı', INCOMING: 'Gelen kontrol', NCR: 'Uygunsuzluk (NCR / TAHSİS)', QC: 'Proses kalite kontrol', FINAL: 'Final serbest bırakma' };
const RANK = { HOLD: 0, FIRST_PIECE: 1, INCOMING: 2, NCR: 3, QC: 4, FINAL: 5 };
/** Which critical action the server demands for the decision (the UI only enables/disables; the server decides). */
export const QKIND_ACTION = { HOLD: 'QUALITY_HOLD_RELEASE', FIRST_PIECE: 'FIRST_PIECE_APPROVE', INCOMING: 'QUALITY_HOLD_RELEASE', NCR: 'QUALITY_REJECT', QC: 'OPERATION_QC_RECORD', FINAL: 'FINAL_PRODUCTION_RELEASE' };
const hoursSince = (iso, nowIso) => { if (!iso)
    return null; const t = Date.parse(iso); const n = Date.parse(nowIso); return Number.isFinite(t) && Number.isFinite(n) ? Math.max(0, (n - t) / 36e5) : null; };
export const NCR_STEP_TR = { OPEN: 'Tespit edildi · ayrıldı', REWORK: 'Yeniden işlemde', RECHECK_PENDING: 'Tekrar kontrol bekliyor', ACCEPTED: 'Kabul edildi', SCRAPPED: 'Hurdaya ayrıldı' };
export const NCR_MOVE_TR = { OPEN: '', REWORK: 'Yeniden işlemeye gönder', RECHECK_PENDING: 'Rework bitti → tekrar kontrol', ACCEPTED: 'Kabul et', SCRAPPED: 'Hurdaya ayır' };
export const QD_MIN_REASON = 5;
export function reasonOk(s) { return s.trim().length >= QD_MIN_REASON; }
export function buildQualityDesk(i) {
    const wo = new Map((i.workOrders ?? []).map((w) => [w.id, w]));
    const mName = i.names?.machine ?? ((id) => id ?? '—');
    const pName = i.names?.person ?? ((id) => id ?? '—');
    const label = (id) => { const w = wo.get(id); return w ? `${w.productCode} · ${w.customerPo}` : `İş emri ${id.slice(0, 8)}`; };
    const items = [];
    const counts = { HOLD: null, FIRST_PIECE: null, INCOMING: null, NCR: null, QC: null, FINAL: null };
    if (i.holds) {
        const open = i.holds.filter((h) => h.status === 'OPEN');
        counts.HOLD = open.length;
        for (const h of open)
            items.push({ key: `HOLD:${h.id}`, kind: 'HOLD', workOrderId: h.workOrderId, title: label(h.workOrderId), detail: `HOLD: ${h.reason}`, since: h.openedAt, ageHours: hoursSince(h.openedAt, i.nowIso), tone: 'red', ref: { holdId: h.id } });
    }
    if (i.ops) {
        const fp = i.ops.filter((o) => o.status === 'FIRST_PIECE_PENDING');
        counts.FIRST_PIECE = fp.length;
        for (const o of fp)
            items.push({ key: `FP:${o.id}`, kind: 'FIRST_PIECE', workOrderId: o.workOrderId, title: `${label(o.workOrderId)} · Op ${o.opNo}`, detail: `${o.name} · makine ${mName(o.machineId)} · operatör ${pName(o.operatorId)} — makine ilk parça onayını bekliyor`, since: o.startedAt, ageHours: hoursSince(o.startedAt, i.nowIso), tone: 'red', owner: o.operatorId ? pName(o.operatorId) : null, ref: { opId: o.id } });
        const qc = i.ops.filter((o) => o.status === 'QC_PENDING');
        counts.QC = qc.length;
        for (const o of qc)
            items.push({ key: `QC:${o.id}`, kind: 'QC', workOrderId: o.workOrderId, title: `${label(o.workOrderId)} · Op ${o.opNo}`, detail: `${o.name} · ${o.qtyGood} sağlam / ${o.qtyScrap} fire — operasyon kalite kontrolü bekliyor`, since: o.runFinishedAt, ageHours: hoursSince(o.runFinishedAt, i.nowIso), tone: 'amber', ref: { opId: o.id }, qty: o.qtyGood });
        const byWo = new Map();
        for (const o of i.ops)
            byWo.set(o.workOrderId, [...(byWo.get(o.workOrderId) ?? []), o]);
        let finals = 0;
        if (i.workOrders)
            for (const [id, ops] of byWo) {
                const w = wo.get(id);
                if (w && w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && finalReleaseReady(ops)) {
                    finals++;
                    items.push({ key: `FINAL:${id}`, kind: 'FINAL', workOrderId: id, title: label(id), detail: `Tüm operasyonlar tamam · ${w.qtyProduced}/${w.qtyPlanned} üretildi, ${w.qtyScrap} fire — nihai serbest bırakma kararı`, since: null, ageHours: null, tone: 'blue', ref: {}, qty: w.qtyProduced });
                }
            }
        counts.FINAL = i.workOrders ? finals : null;
    }
    if (i.ncrs) {
        const open = i.ncrs.filter((n) => isNcrOpen(n.status));
        counts.NCR = open.length;
        for (const n of open)
            items.push({ key: `NCR:${n.id}`, kind: 'NCR', workOrderId: n.workOrderId, title: label(n.workOrderId), detail: `${n.qty} adet · ${n.reason} · ${NCR_STEP_TR[n.status]}`, since: n.openedAt, ageHours: hoursSince(n.openedAt, i.nowIso), tone: n.status === 'OPEN' ? 'red' : 'amber', ref: { ncrId: n.id }, ncrStatus: n.status, ncrNext: ['REWORK', 'RECHECK_PENDING', 'ACCEPTED', 'SCRAPPED'].filter((to) => canTransitionNcr(n.status, to).ok), qty: n.qty });
    }
    if (i.incoming) {
        const w = i.incoming.filter((r) => r.lotState === 'HOLD');
        counts.INCOMING = w.length;
        for (const r of w)
            items.push({ key: `IN:${r.receiptId}`, kind: 'INCOMING', workOrderId: null, title: `Mal kabul lotu ${r.stockLotId.slice(0, 8)}`, detail: `${r.qty} adet teslim alındı — giriş kalite kararı bekliyor (HOLD)`, since: r.receivedAt, ageHours: hoursSince(r.receivedAt, i.nowIso), tone: 'amber', ref: { stockLotId: r.stockLotId }, qty: r.qty });
    }
    items.sort((a, b) => RANK[a.kind] - RANK[b.kind] || (b.ageHours ?? -1) - (a.ageHours ?? -1));
    const history = [
        ...(i.holds ?? []).filter((h) => h.status === 'RELEASED').map((h) => ({ key: `H:${h.id}`, text: `HOLD serbest bırakıldı — ${label(h.workOrderId)}: ${h.releaseReason ?? 'gerekçe kayıtta yok'}`, at: h.releasedAt ?? null })),
        ...(i.ncrs ?? []).filter((n) => !isNcrOpen(n.status)).map((n) => ({ key: `N:${n.id}`, text: `NCR ${NCR_STEP_TR[n.status].toLowerCase()} — ${label(n.workOrderId)} (${n.qty} adet): ${n.reason}`, at: n.openedAt })),
    ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 25);
    return { items, counts, unknown: Object.keys(counts).filter((k) => counts[k] === null), history };
}
