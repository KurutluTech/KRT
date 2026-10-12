export const NO_ACCESS = { linked: false, roles: [], actions: [], economics: false, owner: false };
export const OPEN_RULES = {
    '/ekonomi': { economics: true },
    // D-007: the APPLICATION screen is separate from economic data. Seeing it grants nothing (the server decides); only ADMIN is offered it.
    '/ekonomi-basvuru': { roles: ['ADMIN'] },
    '/alacaklar': { any: ['ACCOUNTING_MUTATION'], economics: true },
    '/muhasebe': { any: ['ACCOUNTING_MUTATION'], economics: true },
    '/tedarikci-fatura': { any: ['PURCHASE_ORDER_MANAGE', 'ACCOUNTING_MUTATION'], economics: true },
    '/ana-veri-aktarim': { any: ['MASTER_DATA_IMPORT'] },
    '/muhendislik': { any: ['BOM_RELEASE'] },
    '/katalog': { any: ['ORDER_CREATE', 'PURCHASE_ORDER_MANAGE', 'MASTER_DATA_IMPORT'] },
    '/siparisler': { any: ['ORDER_CREATE', 'ORDER_CONFIRM', 'WORK_ORDER_CREATE', 'COMMERCIAL_RELEASE', 'MANAGEMENT_RELEASE'] },
    '/personel': { any: ['PERSONNEL_MANAGE'] },
    '/personel-yetki': { any: ['PERSONNEL_LOGIN_LINK', 'WORK_ORDER_ASSIGN_MACHINE', 'WORK_ORDER_MULTI_MACHINE_ASSIGN'] },
    '/puantaj': { any: ['PUANTAJ_MANAGE'] },
    '/personel-aktarim': { any: ['PERSONNEL_MANAGE'] },
    '/yetkinlik-aktarim': { any: ['COMPETENCY_APPROVE'] },
    '/giris-cikis': { any: ['GECKO_ATTENDANCE_VIEW', 'GECKO_SYNC_RUN', 'GECKO_VIEW_GRANT', 'GECKO_MAPPING_VERIFY'] },
    '/cihazlar': { any: ['DEVICE_MANAGE'] },
    '/kalite': { any: ['FIRST_PIECE_APPROVE', 'QUALITY_HOLD_RELEASE', 'QUALITY_REJECT', 'OPERATION_QC_RECORD', 'FINAL_PRODUCTION_RELEASE'] },
    '/sevkiyat': { any: ['SHIPMENT_MANAGE', 'COMMERCIAL_RELEASE', 'MANAGEMENT_RELEASE'] },
    '/depo': { any: ['WAREHOUSE_RECORD'] },
    '/satinalma': { any: ['PURCHASE_ORDER_MANAGE', 'PURCHASING_APPROVE', 'WAREHOUSE_RECORD'] },
};
export function canOpen(path, a) {
    const r = OPEN_RULES[path];
    if (!r)
        return true;
    if (r.economics && a.economics)
        return true;
    if ((r.roles ?? []).some((x) => a.roles.includes(x)))
        return true;
    return (r.any ?? []).some((x) => a.actions.includes(x));
}
/** Role → the screens featured first on that role's home (directive §3 examples, mapped onto existing roles only). */
export const ROLE_HOME = {
    OPERATOR: ['/operator', '/gorevler', '/terminal', '/tara', '/giris-cikislarim', '/rozetlerim'],
    QUALITY: ['/kalite', '/is-emirleri', '/gorevler', '/dokumanlar', '/tara'],
    MAINTENANCE: ['/bakim', '/gorevler', '/takimhane', '/terminal'],
    CAM: ['/muhendislik', '/rota', '/takimhane', '/dokumanlar', '/gorevler'],
    PURCHASING: ['/talepler', '/satinalma', '/depo', '/tedarikci-fatura', '/gorevler'],
    ACCOUNTING: ['/muhasebe', '/alacaklar', '/tedarikci-fatura', '/gorevler'],
    SHIPPING: ['/sevkiyat', '/depo', '/is-emirleri', '/tara', '/gorevler'],
    MANAGEMENT: ['/komuta', '/is-emirleri', '/planlama', '/siparisler', '/puantaj', '/muhendislik', '/oee', '/gorevler'],
    ADMIN: ['/komuta', '/is-emirleri', '/planlama', '/siparisler', '/puantaj', '/personel-yetki', '/personel', '/gorevler'],
};
/** Operator-only users land directly on their own work screen. */
export function landingPath(a) {
    return a.roles.length > 0 && a.roles.every((r) => r === 'OPERATOR') ? '/operator' : null;
}
/** Featured paths for the user's roles (deduplicated, in role order, only those the user may open and that exist). */
export function featuredPaths(a, existing) {
    const out = [];
    const economicsFirst = a.economics ? ['/ekonomi'] : [];
    for (const p of [...economicsFirst, ...a.roles.flatMap((r) => ROLE_HOME[r] ?? [])]) {
        if (!out.includes(p) && existing.includes(p) && canOpen(p, a))
            out.push(p);
    }
    return out;
}
