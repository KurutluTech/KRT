// KMI-010.07 — Revizyonlu teknik doküman baskısı: saf (DOM'suz) kurallar.
// - Baskıda sürüm no / revizyon / tarih damgası (her sayfada görünür).
// - Geçersiz sürüm (SUPERSEDED / REJECTED) basılamaz: düğme kapalı, çağrı yapılmaz; sunucu yanıtı geçersiz durum bildirirse window.print çağrılmaz.
// Yetki/geçerlilik hesabı SUNUCUDADIR (document_print_begin); bu modül yalnız ek bir istemci kapısıdır, sunucu kapısını gevşetmez.
export const PRINT_BLOCKED_STATES = Object.freeze(['SUPERSEDED', 'REJECTED']);
const BLOCK_TR = {
    SUPERSEDED: 'Bu sürüm GEÇERSİZ (yeni sürüm yürürlükte) — basılamaz. Geçerli sürümü basın.',
    REJECTED: 'Bu sürüm REDDEDİLDİ — basılamaz. Düzeltip yeni sürüm yükleyin.',
};
/** Sürüm durumu basılamazsa { code, state, text } döner; basılabilirse null. */
export function printBlock(state) {
    const st = String(state ?? '').toUpperCase();
    return PRINT_BLOCKED_STATES.includes(st) ? { code: `PRINT_BLOCKED_INVALID_VERSION:${st}`, state: st, text: BLOCK_TR[st] } : null;
}
/** Sunucu baskı oturumunun (document_print_begin yanıtı) bildirdiği durum alanlarından herhangi biri geçersizse engel döner. */
export function printSessionBlock(s) {
    if (!s)
        return null;
    for (const k of ['state', 'versionState', 'controlState', 'validity']) {
        const b = printBlock(s[k]);
        if (b)
            return b;
    }
    return null;
}
/** Ekrandaki sürüm satırı (lifecycle versiyonu): kontrol durumu VEYA geçerlilik geçersizse engel döner (kontrol kaydı olmayan eski sürümler dahil). */
export function versionPrintBlock(v) {
    return printBlock(v?.control?.state) ?? printBlock(v?.validity);
}
export class PrintBlockedError extends Error {
    constructor(b) { super(b.code); this.name = 'PrintBlockedError'; this.block = b; }
}
const day = (x) => (x ? String(x).slice(0, 16).replace('T', ' ') : null);
/** Baskı damgası alanları: sürüm no, revizyon (belge üzerindeki etiket öncelikli, yoksa ürün revizyonu), yürürlük ve baskı tarihi. */
export function printStamp(s) {
    const rev = s?.docRevisionLabel || s?.productRevision || null;
    const fields = {
        docNo: s?.docNo ?? '—',
        version: s?.versionNo != null ? `Sürüm ${s.versionNo}` : 'Sürüm —',
        revision: rev ? `Rev ${rev}` : 'Rev —',
        effective: `Yürürlük ${day(s?.effectiveAt) ?? '—'}`,
        printed: `Baskı ${day(s?.printedAt) ?? '—'}`,
    };
    return { ...fields, line: [fields.docNo, fields.version, fields.revision, fields.effective, fields.printed].join(' · ') };
}
