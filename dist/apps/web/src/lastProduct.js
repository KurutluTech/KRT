/** "Last viewed product" shared by Ürün Çalışma Alanı, Rota / Operasyon, Ürün mühendisliği and the product passport, so a person who comes from a product
 *  lands on THAT product (never on an arbitrary first one with no data). Per-viewer convenience only: storage may be blocked, then nothing is remembered. */
const KEY = 'kmi.product.last';
const isId = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function rememberProduct(id) {
    if (!isId(id))
        return;
    try {
        sessionStorage.setItem(KEY, id);
    }
    catch { /* storage may be blocked */ }
    try {
        localStorage.setItem(KEY, id);
    }
    catch { /* storage may be blocked */ }
}
export function recallProduct() {
    for (const s of [() => sessionStorage, () => localStorage]) {
        try {
            const v = s().getItem(KEY);
            if (isId(v))
                return v;
        }
        catch { /* blocked */ }
    }
    return null;
}
/** Product to open, in order: explicit (link / caller) → last viewed → the only product, if there is exactly one → null (the screen asks the person to pick). Ids not in `known` are ignored. */
export function chooseProduct(known, explicit) {
    const ok = (v) => !!v && known.includes(v);
    if (ok(explicit))
        return explicit;
    const last = recallProduct();
    if (ok(last))
        return last;
    return known.length === 1 ? known[0] : null;
}
