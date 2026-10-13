const C = (key, origin = 'command_center.counters') => ({ kind: 'counter', key, origin });
export const HOME_CARDS = {
    openOrders: { key: 'openOrders', label: 'Açık sipariş', unit: 'adet', source: C('openOrders'), href: '#/siparisler', rule: 'neutral' },
    overdueItems: { key: 'overdueItems', label: 'Gecikmiş sipariş kalemi', unit: 'kalem', source: C('orderItemsOverdue'), href: '#/siparisler', rule: 'zero-good-critical' },
    woRunning: { key: 'woRunning', label: 'Çalışan iş emri', unit: 'adet', source: C('workOrdersRunning'), href: '#/is-emirleri', rule: 'neutral' },
    woWaiting: { key: 'woWaiting', label: 'Bekleyen iş emri', unit: 'adet', source: C('workOrdersWaiting'), href: '#/is-emirleri', rule: 'neutral' },
    woOnHold: { key: 'woOnHold', label: 'HOLD’daki iş emri', unit: 'adet', source: C('workOrdersOnHold'), href: '#/is-emirleri', rule: 'zero-good' },
    machinesDown: { key: 'machinesDown', label: 'Arızalı (DOWN) makine', unit: 'makine', source: C('machinesDown'), href: '#/bakim', rule: 'zero-good-critical' },
    machinesMaintenance: { key: 'machinesMaintenance', label: 'Bakımdaki makine', unit: 'makine', source: C('machinesMaintenance'), href: '#/bakim', rule: 'zero-good' },
    machinesHold: { key: 'machinesHold', label: 'HOLD’daki makine', unit: 'makine', source: C('machinesHold'), href: '#/kalite', rule: 'zero-good' },
    machinesEligible: { key: 'machinesEligible', label: 'Üretime uygun makine', unit: 'makine', source: C('machinesEligible'), href: '#/canli', rule: 'neutral' },
    qualityHolds: { key: 'qualityHolds', label: 'Açık kalite HOLD', unit: 'adet', source: C('qualityHoldsOpen'), href: '#/kalite', rule: 'zero-good' },
    ncrs: { key: 'ncrs', label: 'Açık uygunsuzluk (NCR)', unit: 'adet', source: C('ncrsOpen'), href: '#/kalite', rule: 'zero-good' },
    incomingQc: { key: 'incomingQc', label: 'Giriş kalite kontrolü bekleyen', unit: 'lot', source: C('incomingQcWaiting'), href: '#/kalite', rule: 'zero-good' },
    tickets: { key: 'tickets', label: 'Açık bakım bileti', unit: 'bilet', source: C('maintenanceTicketsOpen'), href: '#/bakim', rule: 'zero-good' },
    purchaseRequests: { key: 'purchaseRequests', label: 'Onay bekleyen satınalma talebi', unit: 'talep', source: C('purchaseRequestsWaiting'), href: '#/talepler', rule: 'zero-good' },
    purchaseOrders: { key: 'purchaseOrders', label: 'Açık satınalma siparişi', unit: 'adet', source: C('purchaseOrdersOpen'), href: '#/satinalma', rule: 'neutral' },
    shipmentsDraft: { key: 'shipmentsDraft', label: 'Hazırlanan sevkiyat (taslak)', unit: 'adet', source: C('shipmentsDraft'), href: '#/sevkiyat', rule: 'neutral' },
    // accounting: commercial release queue (commercial_approvals) — counts only, never an amount
    approvalsPending: { key: 'approvalsPending', label: 'Bekleyen ticari onay', unit: 'adet', source: { kind: 'extra', key: 'approvalsPending', origin: 'commercial_approvals (status PENDING)' }, href: '#/onay-kuyrugu', rule: 'zero-good', roles: ['ACCOUNTING', 'ADMIN', 'MANAGEMENT'] },
    approvalsAwaitingMgmt: { key: 'approvalsAwaitingMgmt', label: 'Yönetim serbest bırakması bekleyen', unit: 'adet', source: { kind: 'extra', key: 'approvalsAwaitingMgmt', origin: 'commercial_approvals (PENDING, management_released_at boş)' }, href: '#/onay-kuyrugu', rule: 'zero-good', roles: ['ACCOUNTING', 'ADMIN', 'MANAGEMENT'] },
};
const X = (key, origin) => ({ kind: 'extra', key, origin });
/** No canonical source exists yet: the card says DATA REQUIRED and why — it never shows a number. */
const DR = (reason) => ({ kind: 'none', reason });
Object.assign(HOME_CARDS, {
    firstPiecePending: { key: 'firstPiecePending', label: 'İlk parça onayı bekleyen operasyon', unit: 'operasyon', source: X('firstPiecePending', 'work_order_operations (FIRST_PIECE_PENDING)'), href: '#/kalite', rule: 'zero-good' },
    woAssigned: { key: 'woAssigned', label: 'Makine atanmış, başlamamış iş emri', unit: 'adet', source: X('woAssigned', 'work_orders (MACHINE_ASSIGNED)'), href: '#/is-emirleri', rule: 'neutral' },
    lotsHold: { key: 'lotsHold', label: 'HOLD’daki stok lotu', unit: 'lot', source: X('lotsHold', 'stock_lots (HOLD)'), href: '#/depo', rule: 'zero-good', actions: ['WAREHOUSE_RECORD'] },
    lotsAvailable: { key: 'lotsAvailable', label: 'Kullanılabilir stok lotu', unit: 'lot', source: X('lotsAvailable', 'stock_lots (AVAILABLE)'), href: '#/depo', rule: 'neutral', actions: ['WAREHOUSE_RECORD'] },
    lotsReserved: { key: 'lotsReserved', label: 'Rezerve stok lotu (henüz fiilen çıkmadı)', unit: 'lot', source: X('lotsReserved', 'stock_lots (RESERVED)'), href: '#/depo', rule: 'neutral', actions: ['WAREHOUSE_RECORD'] },
    lotsStaged: { key: 'lotsStaged', label: 'Sevkiyat hazırlığındaki lot', unit: 'lot', source: X('lotsStaged', 'stock_lots (STAGED)'), href: '#/depo', rule: 'neutral', actions: ['WAREHOUSE_RECORD'] },
    camDraft: { key: 'camDraft', label: 'Yayına hazırlanan CAM programı (taslak)', unit: 'program', source: X('camDraft', 'cam_programs (DRAFT)'), href: '#/muhendislik', rule: 'neutral' },
    toolsLifeExceeded: { key: 'toolsLifeExceeded', label: 'Nominal ömrünü dolduran takım', unit: 'takım', source: X('toolsLifeExceeded', 'tools (kullanılan ≥ nominal ömür)'), href: '#/takimhane', rule: 'zero-good' },
    toolsTotal: { key: 'toolsTotal', label: 'Kayıtlı takım', unit: 'takım', source: X('toolsTotal', 'tools'), href: '#/takimhane', rule: 'neutral' },
    personnelActive: { key: 'personnelActive', label: 'Aktif personel', unit: 'kişi', source: X('personnelActive', 'personnel (active)'), href: '#/personel', rule: 'neutral', actions: ['PERSONNEL_MANAGE'] },
    personnelNoLogin: { key: 'personnelNoLogin', label: 'Hesabı bağlanmamış aktif personel', unit: 'kişi', source: X('personnelNoLogin', 'personnel (active, auth_user_id boş)'), href: '#/personel-yetki', rule: 'zero-good', actions: ['PERSONNEL_MANAGE'] },
    skillsExpired: { key: 'skillsExpired', label: 'Süresi geçmiş yetkinlik', unit: 'kayıt', source: X('skillsExpired', 'personnel_skills (valid_until < bugün)'), href: '#/personel', rule: 'zero-good', actions: ['PERSONNEL_MANAGE'] },
    skillsExpiring: { key: 'skillsExpiring', label: '30 gün içinde dolacak yetkinlik', unit: 'kayıt', source: X('skillsExpiring', 'personnel_skills (valid_until ≤ +30 gün)'), href: '#/personel', rule: 'zero-good', actions: ['PERSONNEL_MANAGE'] },
    devicesActive: { key: 'devicesActive', label: 'Aktif kayıtlı cihaz', unit: 'cihaz', source: X('devicesActive', 'devices (active)'), href: '#/cihazlar', rule: 'neutral', actions: ['DEVICE_MANAGE'] },
    inboxQuarantined: { key: 'inboxQuarantined', label: 'Karantinadaki cihaz mesajı', unit: 'mesaj', source: X('inboxQuarantined', 'device_inbox (QUARANTINED)'), href: '#/cihazlar', rule: 'zero-good', actions: ['DEVICE_MANAGE'] },
    integrationFreshness: { key: 'integrationFreshness', label: 'Entegrasyon tazeliği / uygulama sağlığı', unit: '', source: DR('canlı bağlantı kaydı yok (telemetri NOT_CONNECTED)'), href: '#/cihazlar', rule: 'neutral', actions: ['DEVICE_MANAGE'] },
    customersActive: { key: 'customersActive', label: 'Aktif müşteri', unit: 'müşteri', source: X('customersActive', 'customers (active)'), href: '#/katalog', rule: 'neutral', actions: ['ORDER_CREATE', 'ORDER_CONFIRM'] },
    ordersDraft: { key: 'ordersDraft', label: 'Onay bekleyen sipariş (taslak)', unit: 'sipariş', source: X('ordersDraft', 'orders (DRAFT)'), href: '#/siparisler', rule: 'zero-good', actions: ['ORDER_CREATE', 'ORDER_CONFIRM'] },
    ordersInProduction: { key: 'ordersInProduction', label: 'Üretimdeki sipariş', unit: 'sipariş', source: X('ordersInProduction', 'orders (IN_PRODUCTION)'), href: '#/siparisler', rule: 'neutral', actions: ['ORDER_CREATE', 'ORDER_CONFIRM'] },
    invoicesOpen: { key: 'invoicesOpen', label: 'Kapanmamış satış faturası (açık/kısmi)', unit: 'fatura', source: X('invoicesOpen', 'invoices (OPEN, PARTIAL) — yalnız adet'), href: '#/alacaklar', rule: 'neutral', roles: ['ACCOUNTING', 'ADMIN'] },
    supplierInvoicesOpen: { key: 'supplierInvoicesOpen', label: 'Kapanmamış tedarikçi faturası', unit: 'fatura', source: X('supplierInvoicesOpen', 'supplier_invoices (OPEN, PARTIAL) — yalnız adet'), href: '#/tedarikci-fatura', rule: 'neutral', roles: ['ACCOUNTING', 'ADMIN'] },
    supplierInvoicesOverdue: { key: 'supplierInvoicesOverdue', label: 'Vadesi geçmiş tedarikçi faturası', unit: 'fatura', source: X('supplierInvoicesOverdue', 'supplier_invoices (vade < bugün, ödenmemiş)'), href: '#/tedarikci-fatura', rule: 'zero-good-critical', roles: ['ACCOUNTING', 'ADMIN'] },
    drReceivablesOverdue: { key: 'drReceivablesOverdue', label: 'Vadesi geçmiş alacak', unit: '', source: DR('satış faturasında vade alanı yok; vade kuralı türetimi doğrulanmadı'), href: '#/alacaklar', rule: 'neutral', roles: ['ACCOUNTING', 'ADMIN'] },
    drBankRecon: { key: 'drBankRecon', label: 'Banka mutabakat istisnaları', unit: '', source: DR('banka verisi kaynağı yok'), href: '#/muhasebe', rule: 'neutral', roles: ['ACCOUNTING', 'ADMIN'] },
    drThreeWay: { key: 'drThreeWay', label: 'PO / mal kabul / fatura üçlü eşleşme istisnası', unit: '', source: DR('üçlü eşleştirme hesabı henüz yok'), href: '#/tedarikci-fatura', rule: 'neutral', roles: ['ACCOUNTING', 'ADMIN'] },
    drPeriodClose: { key: 'drPeriodClose', label: 'Dönem kapanış ilerlemesi', unit: '', source: DR('muhasebe dönem kapanışı modeli yok'), href: '#/muhasebe', rule: 'neutral', roles: ['ACCOUNTING', 'ADMIN'] },
    drCalibration: { key: 'drCalibration', label: 'Kalibrasyon uyarıları', unit: '', source: DR('ölçüm aleti/kalibrasyon kaydı yok'), href: '#/kalite', rule: 'neutral', roles: ['QUALITY', 'ADMIN', 'MANAGEMENT'] },
    drOtd: { key: 'drOtd', label: 'Zamanında teslimat (OTD/OTIF)', unit: '', source: DR('teslim taahhüt tarihi/gerçekleşme verisi yeterli değil'), href: '#/sevkiyat', rule: 'neutral', roles: ['SHIPPING', 'ADMIN', 'MANAGEMENT'] },
});
const GROUPS = [
    { roles: ['ADMIN'], cards: ['openOrders', 'overdueItems', 'woRunning', 'woWaiting', 'woAssigned', 'woOnHold', 'firstPiecePending', 'machinesDown', 'machinesEligible', 'qualityHolds', 'ncrs', 'tickets', 'purchaseRequests', 'approvalsPending', 'shipmentsDraft'] },
    { roles: ['MANAGEMENT'], cards: ['openOrders', 'overdueItems', 'woRunning', 'woWaiting', 'woAssigned', 'woOnHold', 'firstPiecePending', 'machinesDown', 'machinesEligible', 'qualityHolds', 'ncrs', 'tickets', 'purchaseRequests', 'approvalsAwaitingMgmt', 'shipmentsDraft'] },
    { roles: ['ACCOUNTING'], actions: ['ACCOUNTING_MUTATION'], cards: ['approvalsPending', 'approvalsAwaitingMgmt', 'invoicesOpen', 'supplierInvoicesOpen', 'supplierInvoicesOverdue', 'drReceivablesOverdue', 'drBankRecon', 'drThreeWay', 'drPeriodClose', 'overdueItems', 'shipmentsDraft'] },
    { roles: ['QUALITY'], cards: ['qualityHolds', 'ncrs', 'incomingQc', 'firstPiecePending', 'woOnHold', 'machinesHold', 'drCalibration'] },
    { roles: ['MAINTENANCE'], cards: ['machinesDown', 'machinesMaintenance', 'tickets', 'machinesHold', 'machinesEligible', 'toolsLifeExceeded', 'toolsTotal'] },
    { roles: ['PURCHASING'], cards: ['purchaseRequests', 'purchaseOrders', 'incomingQc'] },
    { actions: ['WAREHOUSE_RECORD'], cards: ['incomingQc', 'lotsHold', 'lotsAvailable', 'lotsReserved', 'lotsStaged'] },
    { roles: ['SHIPPING'], cards: ['shipmentsDraft', 'overdueItems', 'woRunning', 'drOtd'] },
    { roles: ['CAM'], actions: ['BOM_RELEASE'], cards: ['camDraft', 'woWaiting', 'woRunning', 'toolsLifeExceeded'] },
    { actions: ['PERSONNEL_MANAGE'], cards: ['personnelActive', 'personnelNoLogin', 'skillsExpired', 'skillsExpiring'] },
    { actions: ['DEVICE_MANAGE'], cards: ['devicesActive', 'inboxQuarantined', 'integrationFreshness'] },
    { actions: ['ORDER_CREATE', 'ORDER_CONFIRM', 'WORK_ORDER_CREATE'], cards: ['openOrders', 'ordersDraft', 'ordersInProduction', 'overdueItems', 'customersActive'] },
];
export function homeCardsFor(a) {
    const acts = a.actions ?? [];
    const keys = [];
    for (const g of GROUPS) {
        const applies = (g.roles ?? []).some((r) => a.roles.includes(r)) || (g.actions ?? []).some((x) => acts.includes(x));
        if (applies)
            for (const k of g.cards)
                if (!keys.includes(k))
                    keys.push(k);
    }
    return keys.map((k) => HOME_CARDS[k]).filter((c) => {
        if (c.economics && !a.economics)
            return false;
        if (!c.roles && !c.actions)
            return true;
        return (c.roles ?? []).some((r) => a.roles.includes(r)) || (c.actions ?? []).some((x) => acts.includes(x));
    });
}
/** Which alerts matter to the user: management/admin see every domain; others only the domains of their role. */
const ROLE_DOMAINS = {
    ADMIN: 'ALL', MANAGEMENT: 'ALL', QUALITY: ['QUALITY', 'PRODUCTION'], MAINTENANCE: ['MAINTENANCE'], PURCHASING: ['PURCHASING', 'MATERIAL'], SHIPPING: ['SHIPMENT'], ACCOUNTING: ['SHIPMENT'], CAM: ['PRODUCTION'], OPERATOR: [],
};
export function homeDomainsFor(a) {
    const out = new Set();
    for (const r of a.roles) {
        const d = ROLE_DOMAINS[r];
        if (d === 'ALL')
            return 'ALL';
        if (d)
            d.forEach((x) => out.add(x));
    }
    return [...out];
}
/** A missing/invalid number is UNKNOWN — never 0 (a missing counter must not read as "all clear"). */
export function cardValue(raw) {
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? { state: 'KNOWN', value: raw } : { state: 'UNKNOWN' };
}
export function cardTone(rule, v) {
    if (v.state === 'UNKNOWN')
        return 'unknown';
    if (rule === 'neutral')
        return 'info';
    if (v.value === 0)
        return 'ok';
    return rule === 'zero-good-critical' ? 'bad' : 'warn';
}
export const STALE_AFTER_MS = 15 * 60_000;
export function freshness(generatedAt, nowMs) {
    const t = generatedAt ? Date.parse(generatedAt) : NaN;
    if (!Number.isFinite(t))
        return { state: 'UNKNOWN', ageMin: null };
    const age = Math.max(0, nowMs - t);
    return { state: age > STALE_AFTER_MS ? 'STALE' : 'FRESH', ageMin: Math.floor(age / 60_000) };
}
/** Production shift at an instant, from the canonical shift definitions (TeamK1 08:00–16:00, TeamK2 16:00–24:00, Istanbul time).
 *  Outside those hours NO shift is defined (the night is not a defined shift): returns null — never a guessed "3. vardiya". */
export function productionShiftAt(iso) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t))
        return null;
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)));
    if (h >= 8 && h < 16)
        return { code: 'TeamK1', label: '1. Vardiya' };
    if (h >= 16 && h < 24)
        return { code: 'TeamK2', label: '2. Vardiya' };
    return null;
}
