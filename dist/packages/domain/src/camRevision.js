// CAM program sürümünün ekran etiketi (saf fonksiyon; kayıt değiştirmez).
/** CAM sürüm etiketi: kayıtta "v2", "2", "rev 2" ya da "r2" olabilir; ekranda her zaman tek önekli "v2" gösterilir (çift "v" yok). Kayıt değişmez. */
export function camRevText(rev) {
    if (rev === null || rev === undefined) return '';
    const r = String(rev).trim().replace(/^(?:rev(?:izyon)?|sürüm|r|v)[\s.:-]*/i, '').replace(/^v/i, '');
    return r ? `v${r}` : '';
}
