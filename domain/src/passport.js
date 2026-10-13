// KMI NEXT — Product Digital DNA / Passport (matrix items 35, 38). Twin of migration 0033.
//
// A passport is read from the canonical tables only — nothing is copied or invented:
//   finished lot ← work order (revision, CAM program, machine, operator, timeline, first piece,
//   declarations, corrections, holds, NCRs, tools) ← issued raw-material lots ← goods receipt +
//   incoming QC ← PO ← supplier; → commercial approval → shipment → customer order.
// What the chain does NOT have is listed as a GAP ("missing link") instead of being hidden — a
// passport with gaps is still shown, never presented as complete.
// Economic passport: only for kmi_next.can_view_economics() (owner + people the owner named);
// for everyone else the server returns {locked:true} and no figures at all (money rule, #679).
export const PASSPORT_GAP_TR = {
    NO_PRODUCT_REVISION: 'Ürün revizyonu bağlı değil',
    NO_CAM_PROGRAM: 'CAM programı bağlı değil',
    NO_MACHINE: 'Makine kaydı yok',
    NO_OPERATOR: 'Operatör kaydı yok',
    NO_FIRST_PIECE: 'İlk parça kaydı yok',
    NO_MATERIAL_TRACE: 'Kullanılan ham madde lotu kayıtlı değil',
    MATERIAL_FROM_UNACCEPTED_LOT: 'Giriş kalitesinde kabul edilmemiş ham madde kullanılmış',
    OPEN_QUALITY_HOLD: 'Açık kalite bekletmesi',
    OPEN_NCR: 'Açık uygunsuzluk (NCR)',
    INCOMING_QC_PENDING: 'Giriş kalite kararı bekliyor',
    INCOMING_QC_REJECTED: 'Giriş kalitesinde reddedildi',
};
/** Same order as kmi_next.work_order_trace_gaps. */
export function workOrderGaps(f) {
    const g = [];
    if (!f.productRevisionId)
        g.push('NO_PRODUCT_REVISION');
    if (!f.camProgramId)
        g.push('NO_CAM_PROGRAM');
    if (!f.machineId)
        g.push('NO_MACHINE');
    if (!f.operatorId)
        g.push('NO_OPERATOR');
    if (!f.hasFirstPieceDeclaration)
        g.push('NO_FIRST_PIECE');
    if (f.issuedRawLots.length === 0)
        g.push('NO_MATERIAL_TRACE');
    else if (f.issuedRawLots.some((l) => l.qcDecision !== 'ACCEPT'))
        g.push('MATERIAL_FROM_UNACCEPTED_LOT');
    if (f.openQualityHolds > 0)
        g.push('OPEN_QUALITY_HOLD');
    if (f.openNcrs > 0)
        g.push('OPEN_NCR');
    return g;
}
/** A purchased lot's own gaps (incoming QC). */
export function purchasedLotGaps(qcDecision) {
    if (qcDecision === null)
        return ['INCOMING_QC_PENDING'];
    if (qcDecision === 'REJECT')
        return ['INCOMING_QC_REJECTED'];
    return [];
}
export function completeness(gaps) {
    return gaps.length === 0 ? 'COMPLETE' : 'INCOMPLETE';
}
/** How kmi_next.passport_resolve interprets an input (it then looks it up). */
export function classifyPassportInput(raw) {
    let v = raw.trim();
    const scan = /[?&]scan=([^&#]+)/.exec(v);
    if (scan)
        v = decodeURIComponent(scan[1]).trim();
    if (v === '')
        return { kind: 'EMPTY', value: '' };
    if (/^KL\d{6}$/i.test(v))
        return { kind: 'LABEL_CODE', value: v.toUpperCase() };
    if (/^KMI:[A-Z]+:.+$/i.test(v))
        return { kind: 'QR_PAYLOAD', value: v };
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
        return { kind: 'UUID', value: v.toLowerCase() };
    return { kind: 'PRODUCT_CODE', value: v.toUpperCase() };
}
function sumByCurrency(lines) {
    const m = new Map();
    for (const l of lines)
        m.set(l.currency, Math.round(((m.get(l.currency) ?? 0) + l.amount) * 100) / 100);
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([currency, amount]) => ({ currency, amount }));
}
export function economicSummary(f) {
    const invoiced = sumByCurrency(f.invoiced);
    const materialCost = sumByCurrency(f.materialCost);
    const notModelled = ['LABOUR', 'MACHINE_TIME', 'OVERHEAD', 'TOOL_WEAR'];
    if (invoiced.length === 0)
        return { invoiced, materialCost, materialMargin: null, marginReason: 'NOT_INVOICED', notModelled };
    if (materialCost.length === 0)
        return { invoiced, materialCost, materialMargin: null, marginReason: 'NO_MATERIAL_COST', notModelled };
    if (invoiced.length !== 1 || materialCost.length !== 1 || invoiced[0].currency !== materialCost[0].currency) {
        return { invoiced, materialCost, materialMargin: null, marginReason: 'CURRENCY_MISMATCH', notModelled };
    }
    return {
        invoiced,
        materialCost,
        materialMargin: { currency: invoiced[0].currency, amount: Math.round((invoiced[0].amount - materialCost[0].amount) * 100) / 100 },
        marginReason: 'OK',
        notModelled,
    };
}
