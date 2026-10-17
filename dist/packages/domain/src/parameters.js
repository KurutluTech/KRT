// KMI-011 — twin of migration 0107 (parameter standard + routing time estimate). Pure functions, no I/O.
// Scenario proof against the real schema: apps/web/test/product-workspace.e2e.test.ts.
/** The parameter version in force on a date: highest validFrom not after the date, not ended; newest version wins ties. null = no value (VERİ YOK). */
export function selectEffectiveParameter(versions, on) {
    const eligible = versions.filter((v) => v.validFrom <= on && (v.validTo === null || v.validTo >= on));
    if (eligible.length === 0)
        return null;
    return eligible.reduce((best, v) => (v.validFrom > best.validFrom || (v.validFrom === best.validFrom && v.versionNo > best.versionNo) ? v : best));
}
/** Same order as param_set(): range → backdating → period → class/revision → routing-backed immediacy → latest-version ordering → no change. */
export function parameterChangeRefusal(c) {
    if (c.value === null || (c.min !== null && c.value < c.min) || (c.max !== null && c.value > c.max))
        return 'VALUE_OUT_OF_RANGE';
    const from = c.validFrom ?? c.today;
    if (from < c.today)
        return 'BACKDATING_REFUSED';
    if (c.validTo !== null && c.validTo < from)
        return 'INVALID_PERIOD';
    if (c.revisionStatus === 'OBSOLETE')
        return 'REVISION_OBSOLETE';
    if (c.changeClass === 'TECHNICAL' && c.revisionStatus === 'RELEASED')
        return 'REVISION_REQUIRED';
    if (c.routingBacked && (from !== c.today || c.validTo !== null))
        return 'ROUTING_PARAMETER_IMMEDIATE_ONLY';
    if (c.latest && from < c.latest.validFrom)
        return 'BACKDATING_REFUSED';
    if (c.latest && c.latest.value === c.value && c.latest.validFrom === from && c.latest.validTo === c.validTo)
        return 'NO_CHANGE';
    return null;
}
/** Σ (setup min + qty × (cycle s + inspection s) / 60). A missing standard is VERİ YOK — never 0; total is null until every operation has its standards. */
export function estimateRoutingMinutes(ops, qty) {
    const lines = ops.map((o) => {
        if (o.setupMin === null || o.cycleSec === null)
            return { opNo: o.opNo, minutes: null, state: 'MISSING' };
        return { opNo: o.opNo, minutes: Math.round((o.setupMin + (qty * (o.cycleSec + (o.inspectionSec ?? 0))) / 60) * 100) / 100, state: 'OK' };
    });
    const complete = lines.length > 0 && lines.every((l) => l.state === 'OK');
    const partial = Math.round(lines.reduce((a, l) => a + (l.minutes ?? 0), 0) * 100) / 100;
    return { complete, totalMinutes: complete ? partial : null, partialMinutes: partial, operations: lines };
}
export const CARD_STATE_TR = { MISSING: 'Eksik veri', DRAFT: 'Taslak', APPROVED: 'Onaylı', INVALID: 'Geçersiz' };
/** Card state of a revision-bound item: no data → MISSING; otherwise the revision status decides (RELEASED = approved, DRAFT = draft, OBSOLETE = invalid). */
export function cardStateFor(hasData, revisionStatus) {
    if (!hasData || revisionStatus === null)
        return 'MISSING';
    return revisionStatus === 'RELEASED' ? 'APPROVED' : revisionStatus === 'DRAFT' ? 'DRAFT' : 'INVALID';
}
/** Before → after text for a changed value. Unknown is shown as VERİ YOK, never as 0. */
export function changeText(before, after, unit = '') {
    const f = (x) => (x === null || x === undefined || x === '' ? 'VERİ YOK' : `${x}${unit ? ' ' + unit : ''}`);
    return `${f(before)} → ${f(after)}`;
}
/** Operation ordering rule for dependencies: the predecessor must come strictly earlier. */
export function dependencyOrderOk(predecessorOpNo, opNo) {
    return predecessorOpNo < opNo;
}
export const PARAMETER_REFUSAL_TR = {
    BACKDATING_REFUSED: 'Geçmişe dönük değişiklik yapılamaz — geçmiş hesaplar korunur.',
    REVISION_REQUIRED: 'Bu teknik parametre yürürlükteki revizyonda değişmez; yeni revizyon ve onay gerekir.',
    VALUE_OUT_OF_RANGE: 'Değer izin verilen aralığın dışında.',
    INVALID_PERIOD: 'Bitiş tarihi başlangıçtan önce olamaz.',
    ROUTING_PARAMETER_IMMEDIATE_ONLY: 'Rota standardı bugünden geçerli olur; ileri tarih/bitiş verilemez.',
    NO_CHANGE: 'Değer zaten bu.',
    REVISION_OBSOLETE: 'Eski revizyonun parametresi değiştirilemez.',
};
