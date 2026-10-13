// KMI NEXT — legacy /pasaport → canonical /nesne decision (pure, no DOM, no network of its own).
// ONE OBJECT → ONE CANONICAL IDENTITY. An old link (printed label KL…, QR payload, universal-search route, next-best-action route) may only
// redirect when it names exactly one known object. Anything unclear stays on the "Nesne bul" box with a plain message: it NEVER guesses,
// NEVER falls back to "the first match", and never redirects to an object the server did not return.
import { LEGACY_TO_CANONICAL, canonicalHref } from './registry.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => !!v && UUID.test(v);
const isLegacyKind = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL, k);
export const AMBIGUOUS_TR = 'Kimlik belirsiz — yanlış nesneye gitmemek için yönlendirilmedi. Etiket kodunu veya kaydı kontrol edin.';
export async function decideLegacyPassport(q, resolve) {
    const kod = (q.kod ?? '').trim();
    const is = (q.is ?? '').trim();
    let byIs = null;
    if (is) {
        if (!isUuid(is))
            return { action: 'box', input: kod, error: AMBIGUOUS_TR };
        byIs = { kind: 'WORK_ORDER', id: is.toLowerCase() };
    }
    let byKod = null;
    if (kod) {
        let r;
        try {
            r = await resolve(kod);
        }
        catch {
            return { action: 'box', input: kod, error: 'Bulunamadı. Etiket kodunu (KL…), QR içeriğini veya ürün kodunu kontrol edin.' };
        }
        if (!r || !isLegacyKind(r.kind) || !isUuid(r.id))
            return { action: 'box', input: kod, error: AMBIGUOUS_TR };
        byKod = { kind: r.kind, id: r.id.toLowerCase() };
    }
    // two different statements about the same link must agree, otherwise we do not know which object is meant
    if (byIs && byKod && (byIs.kind !== byKod.kind || byIs.id !== byKod.id))
        return { action: 'box', input: kod, error: AMBIGUOUS_TR };
    const t = byKod ?? byIs;
    if (!t)
        return { action: 'box', input: kod };
    return { action: 'redirect', href: canonicalHref(t.kind, t.id), kind: t.kind, id: t.id };
}
