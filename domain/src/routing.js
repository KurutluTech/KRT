// KMI NEXT — CNC routing (multi-operation work orders) + D-012 machine–skill review. Twin of migration
// 0039. ORDER → WORK ORDER → ROUTING → OPERATION 10/20/30… → MACHINE → OPERATOR → FIRST PIECE → QUALITY →
// NEXT OPERATION → FINAL RELEASE. No operation can be skipped, run on a machine outside its allowed list,
// or bypass first piece / operation QC; one machine has at most one active session.
export const OPERATION_STATUS_TR = {
    PENDING: 'BEKLİYOR', FIRST_PIECE_PENDING: 'İLK PARÇA ONAYI', RUNNING: 'ÜRETİMDE', QC_PENDING: 'KALİTE KONTROL', DONE: 'TAMAM',
};
export const SKILL_REVIEW_TR = { UNKNOWN: 'BİLİNMİYOR (incelenmedi)', DEFINED: 'TANIMLI', NONE_REQUIRED: 'ŞART YOK (onaylandı)' };
export const START_REFUSAL_TR = {
    OPERATION_NOT_PENDING: 'Operasyon başlatılabilir durumda değil',
    PREVIOUS_OPERATION_NOT_DONE: 'Önceki operasyon bitmedi',
    NO_INPUT_QUANTITY: 'Önceki operasyondan gelen sağlam parça yok',
    MACHINE_REQUIRED: 'Makine seçilmedi',
    MACHINE_NOT_ALLOWED_FOR_OPERATION: 'Bu operasyon bu makinede yapılamaz',
    MACHINE_NOT_ELIGIBLE: 'Makine üretime uygun değil',
    MACHINE_BUSY: 'Makinede başka aktif üretim var',
    OPERATOR_REQUIRED: 'Operatör seçilmedi',
    OPERATOR_NOT_FOUND: 'Operatör bulunamadı',
    OPERATOR_INACTIVE: 'Operatör pasif',
    MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT: 'Operatör başka makinede çalışıyor — çoklu makine yetkisi yetersiz',
    HARD_CAP_EXCEEDED: 'Bir operatör en fazla 3 makineye bakabilir',
    REASON_REQUIRED_WHEN_NOT_FOLLOWING: 'Öneriden farklı seçimde gerekçe zorunlu',
    OPERATOR_NOT_QUALIFIED: 'Operatör yetkin değil',
    OPERATOR_QUALIFICATION_EXPIRED: 'Operatörün yetkinliği süresi dolmuş',
    MACHINE_SKILL_REQUIREMENTS_UNKNOWN: 'Makinenin yetkinlik şartı bilinmiyor — yetkili doğrulama gerekli',
    CAM_PROGRAM_NOT_RELEASED: 'CAM programı yayınlanmamış',
    CAM_PROGRAM_WRONG_REVISION: 'CAM programı başka revizyona ait',
    QUALITY_HOLD_OPEN: 'İş emrinde açık kalite bekletmesi var',
    MATERIAL_NOT_READY: 'Malzeme hazır değil',
    TOOLS_NOT_READY: 'Takımlar hazır değil',
};
export function startRefusalText(code) {
    if (!code)
        return 'Başlatılabilir';
    const [k, detail] = code.split(':');
    return (START_REFUSAL_TR[k] ?? code) + (detail ? ` (${detail})` : '');
}
/** Same checks, same order as kmi_next.operation_start_refusal. null = may start. */
export function operationStartRefusal(f) {
    if (f.op.status !== 'PENDING')
        return 'OPERATION_NOT_PENDING';
    if (['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(f.workOrderStatus))
        return `WORK_ORDER_${f.workOrderStatus}`;
    if (f.earliestUnfinishedBefore !== null)
        return `PREVIOUS_OPERATION_NOT_DONE:${f.earliestUnfinishedBefore}`;
    if (f.op.qtyIn <= 0)
        return 'NO_INPUT_QUANTITY';
    if (!f.machine)
        return 'MACHINE_REQUIRED';
    if (!f.op.allowedMachineIds.includes(f.machine.id))
        return 'MACHINE_NOT_ALLOWED_FOR_OPERATION';
    if (f.machine.status !== 'UP')
        return `MACHINE_NOT_ELIGIBLE:${f.machine.status}`;
    if (f.machine.busy)
        return 'MACHINE_BUSY';
    if (!f.operator)
        return 'OPERATOR_REQUIRED';
    if (!f.operator.active)
        return 'OPERATOR_INACTIVE';
    if (f.operator.multiMachineRefusal)
        return f.operator.multiMachineRefusal; // 0041: one operator → several machines only with authorization
    if (f.op.requiredSkill) {
        if (f.operator.heldLevel === null || f.operator.heldLevel < f.op.requiredSkill.level)
            return `OPERATOR_NOT_QUALIFIED:${f.op.requiredSkill.code}`;
        if (f.operator.heldExpired)
            return `OPERATOR_QUALIFICATION_EXPIRED:${f.op.requiredSkill.code}`;
    }
    if (f.operator.machineRequirementRefusal)
        return f.operator.machineRequirementRefusal;
    if (f.machine.skillReview === 'UNKNOWN' && !f.op.requiredSkill && !f.operator.clearanceValid)
        return 'MACHINE_SKILL_REQUIREMENTS_UNKNOWN';
    if (f.op.camProgram) {
        if (!f.op.camProgram.released)
            return 'CAM_PROGRAM_NOT_RELEASED';
        if (!f.op.camProgram.sameRevision)
            return 'CAM_PROGRAM_WRONG_REVISION';
    }
    if (f.qualityHoldOpen)
        return 'QUALITY_HOLD_OPEN';
    if (f.op.isFirst && f.materialNotReady)
        return 'MATERIAL_NOT_READY';
    if (f.op.camProgram && f.toolsNotReady)
        return 'TOOLS_NOT_READY';
    return null;
}
/** Status after a start: first piece first when required. */
export function statusAfterStart(firstPieceRequired) {
    return firstPieceRequired ? 'FIRST_PIECE_PENDING' : 'RUNNING';
}
/** Output may never exceed the input of the operation (cumulative). */
export function canDeclareOperationOutput(op, good, scrap) {
    if (op.status !== 'RUNNING')
        return `OPERATION_NOT_RUNNING:${op.status}`;
    if (!(good >= 0) || !(scrap >= 0) || good + scrap <= 0)
        return 'INVALID_QUANTITY';
    if (op.qtyGood + op.qtyScrap + good + scrap > op.qtyIn)
        return 'EXCEEDS_INPUT_QUANTITY';
    return null;
}
/** After the run: QC when required, else DONE. */
export function statusAfterRun(qcRequired) {
    return qcRequired ? 'QC_PENDING' : 'DONE';
}
/** WIP handover: the next operation's input is this operation's good quantity. Final quantities = last good / all scrap. */
export function finalQuantities(ops) {
    const sorted = [...ops].sort((a, b) => a.opNo - b.opNo);
    return { produced: sorted.length ? sorted[sorted.length - 1].qtyGood : 0, scrap: sorted.reduce((s, o) => s + o.qtyScrap, 0) };
}
export function finalReleaseReady(ops) {
    return ops.length > 0 && ops.every((o) => o.status === 'DONE');
}
/** D-012 review rules (set_machine_skill_review). */
export function skillReviewRefusal(review, requirementCount, note) {
    if (note.trim().length < 10)
        return 'NOTE_REQUIRED';
    if (review === 'DEFINED' && requirementCount === 0)
        return 'NO_REQUIREMENTS_DEFINED';
    if (review === 'NONE_REQUIRED' && requirementCount > 0)
        return 'REQUIREMENTS_EXIST';
    return null;
}
