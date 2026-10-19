// KMI-013 (0123) — the operator's structured cause of a tashih. Mirrors the checks of kmi_next.report_tashih_cause / wo_tashih_causes (the server is the authority).
// A tashih (allocation / rework) is never anonymous: it names WHICH feature failed and HOW (olcu = oversize measure, yuzey = surface, karakteristik = a control-plan characteristic).
export const TASHIH_CAUSE_KINDS = ['OLCU', 'YUZEY', 'KARAKTERISTIK'];
export const TASHIH_CAUSE_KIND_TR = { OLCU: 'Ölçü', YUZEY: 'Yüzey', KARAKTERISTIK: 'Karakteristik' };
export function validateTashihCause(i, declaredTashih) {
    if (!TASHIH_CAUSE_KINDS.includes(i.kind))
        return { ok: false, reason: 'INVALID_CAUSE_KIND' };
    if ((i.feature ?? '').trim().length < 2)
        return { ok: false, reason: 'FEATURE_REQUIRED' };
    if (!Number.isInteger(i.qty) || i.qty <= 0)
        return { ok: false, reason: 'QTY_MUST_BE_A_POSITIVE_WHOLE_NUMBER' };
    if (declaredTashih !== null && i.qty > declaredTashih)
        return { ok: false, reason: 'TASHIH_CAUSE_QTY_EXCEEDS_DECLARED' };
    if (i.kind === 'OLCU') {
        if (i.nominal == null || i.tolUpper == null || i.measured == null)
            return { ok: false, reason: 'OLCU_VALUES_REQUIRED' };
        if (!(i.measured > i.nominal + i.tolUpper))
            return { ok: false, reason: 'MEASURED_NOT_OVERSIZE' }; // tashih is for OVERSIZE only; an in-tolerance or undersize value is not a tashih
    }
    if (i.kind === 'KARAKTERISTIK' && (i.characteristicCode ?? '').trim().length < 1)
        return { ok: false, reason: 'CHARACTERISTIC_CODE_REQUIRED' };
    if (i.kind === 'YUZEY' && (i.note ?? '').trim().length < 3)
        return { ok: false, reason: 'SURFACE_DESCRIPTION_REQUIRED' };
    return { ok: true };
}
export const TASHIH_CAUSE_REASON_TR = {
    INVALID_CAUSE_KIND: 'Neden türü seçin (ölçü, yüzey veya karakteristik).', FEATURE_REQUIRED: 'Hangi özellik (örn. dış çap, yüzey, delik) yazın.', QTY_MUST_BE_A_POSITIVE_WHOLE_NUMBER: 'Adet tam sayı ve en az 1 olmalı.',
    TASHIH_CAUSE_QTY_EXCEEDS_DECLARED: 'Bu nedenin adedi, bitirmede beyan edilen tashih adedinden fazla olamaz.', OLCU_VALUES_REQUIRED: 'Ölçü için nominal, üst tolerans ve ölçülen değer gerekir.',
    MEASURED_NOT_OVERSIZE: 'Ölçülen değer nominal + üst toleransın üstünde olmalı; tolerans içi veya küçük ölçü tashih sayılmaz.', CHARACTERISTIC_CODE_REQUIRED: 'Karakteristik kodunu yazın.', SURFACE_DESCRIPTION_REQUIRED: 'Yüzey sorununu kısaca yazın.',
};
