// KMI NEXT — application shell (PWA): login, hash router, navigation, service worker.
// No framework, no bundler (docs/ARCHITECTURE.md). Every screen gets its real adapter over the
// data-client; authorization is decided by the server on every call, the menu only navigates.
// Configuration comes from /config.js (window.KMI_NEXT_CONFIG = { supabaseUrl, anonKey }),
// which is deployment-specific and NOT committed (config.example.js shows the shape).
import { h, mount } from '../../../packages/ui/src/h.js';
import { createKmiNextClient } from '../../../packages/data-client/src/client.js';
import { renderTerminalScreen, rememberedMachine, remember as rememberMachine } from './screens/TerminalScreen.js';
import { canOpen, featuredPaths, landingPath, NO_ACCESS } from './access.js';
import { renderPersonnelAccessScreen } from './screens/PersonnelAccessScreen.js';
import { createPersonnelAccessApi } from './personnelAccessApi.js';
import { renderEngineeringScreen } from './screens/EngineeringScreen.js';
import { createEngineeringApi } from './engineeringApi.js';
import { renderOperatorHomeScreen } from './screens/OperatorHomeScreen.js';
import { createOperatorHomeApi } from './operatorHomeApi.js';
import { createTerminalApi } from './terminalApi.js';
import { renderCommandCenterScreen } from './screens/CommandCenterScreen.js';
import { createCommandCenterApi } from './commandCenterApi.js';
import { renderPlanningScreen } from './screens/PlanningScreen.js';
import { createPlanningApi } from './planningApi.js';
import { renderOeeScreen } from './screens/OeeScreen.js';
import { createOeeApi } from './oeeApi.js';
import { renderGeckoScreen } from './screens/GeckoScreen.js';
import { createGeckoApi } from './geckoApi.js';
import { renderAcademyScreen } from './screens/AcademyScreen.js';
import { createAcademyApi } from './academyApi.js';
import { renderPassportScreen } from './screens/PassportScreen.js';
import { renderEconomicsScreen } from './screens/EconomicsScreen.js';
import { renderMyAttendanceScreen } from './screens/MyAttendanceScreen.js';
import { renderCompetencyImportScreen } from './screens/CompetencyImportScreen.js';
import { createCompetencyImportApi } from './competencyImportApi.js';
import { renderRoutingScreen } from './screens/RoutingScreen.js';
import { createRoutingApi } from './routingApi.js';
import { renderBadgesScreen } from './screens/BadgesScreen.js';
import { createBadgesApi } from './badgesApi.js';
import { createEconomicsApi } from './economicsApi.js';
import { createReceivablesApi } from './receivablesApi.js';
import { createKioskLiveApi, createLiveApi } from './liveApi.js';
import { renderLiveScreen } from './screens/LiveScreen.js';
import { createIntelligenceApi } from './intelligenceApi.js';
import { renderIntelligenceScreen } from './screens/IntelligenceScreen.js';
import { createDevicesApi } from './devicesApi.js';
import { renderDevicesScreen } from './screens/DevicesScreen.js';
import { renderReceivablesScreen } from './screens/ReceivablesScreen.js';
import { createPassportApi } from './passportApi.js';
import { renderReportsScreen } from './screens/ReportsScreen.js';
import { createReportsApi } from './reportsApi.js';
import { renderDocumentsScreen } from './screens/DocumentsScreen.js';
import { createDocumentsApi } from './documentsApi.js';
import { DOCUMENT_ENTITY_TYPES } from '../../../packages/domain/src/documents.js';
import { renderMaintenanceScreen } from './screens/MaintenanceScreen.js';
import { createMaintenanceApi } from './maintenanceApi.js';
import { renderOrdersScreen } from './screens/OrdersScreen.js';
import { createOrdersApi } from './ordersApi.js';
import { renderPurchasingScreen } from './screens/PurchasingScreen.js';
import { createPurchasingApi } from './purchasingApi.js';
import { renderPurchaseRequestsScreen } from './screens/PurchaseRequestsScreen.js';
import { createPurchaseRequestsApi } from './purchaseRequestsApi.js';
import { renderPersonnelScreen } from './screens/PersonnelScreen.js';
import { createPersonnelApi } from './personnelApi.js';
import { createPersonnelImportApi } from './personnelImportApi.js';
import { createMasterImportApi, createCatalogApi } from './masterImportApi.js';
import { renderMasterImportScreen } from './screens/MasterImportScreen.js';
import { renderCatalogScreen } from './screens/CatalogScreen.js';
import { createSearchApi } from './searchApi.js';
import { renderSearchScreen } from './screens/SearchScreen.js';
import { createTaskFloorApi } from './taskFloorApi.js';
import { renderTaskFloorScreen } from './screens/TaskFloorScreen.js';
import { renderWorkOrderHubScreen } from './screens/WorkOrderHubScreen.js';
import { createWorkOrderHubApi } from './workOrderHubApi.js';
import { createWorkOrdersApi } from './workOrdersApi.js';
import { createProductionApi } from './productionApi.js';
import { createStockApi } from './stockApi.js';
import { createShipmentApi } from './shipmentApi.js';
import { createCommercialApprovalApi } from './commercialApprovalApi.js';
import { createAccountingApi } from './accountingApi.js';
import { renderAccountingScreen } from './screens/AccountingScreen.js';
import { renderPersonnelImportScreen } from './screens/PersonnelImportScreen.js';
import { renderToolroomScreen } from './screens/ToolroomScreen.js';
import { createToolroomApi } from './toolroomApi.js';
import { renderScanScreen } from './screens/ScanScreen.js';
import { createScanApi } from './scanApi.js';
import { renderLabelScreen } from './screens/LabelScreen.js';
import { createLabelApi } from './labelApi.js';
import { renderSupplierInvoiceScreen } from './screens/SupplierInvoiceScreen.js';
import { createSupplierInvoiceApi } from './supplierInvoiceApi.js';
import { renderMaterialScreen } from './screens/MaterialScreen.js';
import { createMaterialApi } from './materialApi.js';
import { renderToolReadinessScreen } from './screens/ToolReadinessScreen.js';
import { createToolReadinessApi } from './toolReadinessApi.js';
const SESSION_KEY = 'kmi-next.session';
function loadSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function saveSession(s) {
    try {
        if (s)
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
        else
            sessionStorage.removeItem(SESSION_KEY);
    }
    catch {
        /* private mode: session lives only in memory for this page */
    }
}
const istanbulToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const addDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
export const ROUTES = [
    { path: '/ara', label: 'Arama', group: 'Saha', inMenu: false, render: (el, c, s, q) => renderSearchScreen(el, createSearchApi(c, s), q.get('q') ?? '') },
    {
        path: '/gorevler', label: 'Görev Zemini — işlerim', group: 'Saha', inMenu: true,
        // ?kaynak=WORK_ORDER&id=<uuid> pre-links a new task to an existing record
        render: (el, c, s, q) => renderTaskFloorScreen(el, createTaskFloorApi(c, s), q.get('kaynak') && q.get('id') ? { prefill: { sourceType: q.get('kaynak'), sourceId: q.get('id') } } : {}),
    },
    {
        path: '/operator', label: 'Benim İşlerim (operatör)', group: 'Saha', inMenu: true,
        render: (el, c, s) => renderOperatorHomeScreen(el, createOperatorHomeApi(c, s), {
            openTerminal: (machineId) => { rememberMachine(machineId); location.hash = '#/terminal'; }, goTasks: () => { location.hash = '#/gorevler'; }
        }),
    },
    { path: '/terminal', label: 'Makine Terminali', group: 'Saha', inMenu: true, render: (el, c, s) => renderTerminalScreen(el, createTerminalApi(c, s), { machineId: rememberedMachine() }) },
    {
        path: '/is-emirleri', label: 'İş Emirleri (üretim · kalite · stok · sevkiyat)', group: 'Saha', inMenu: true,
        render: (el, c, s, q) => renderWorkOrderHubScreen(el, { hub: createWorkOrderHubApi(c, s), workOrders: createWorkOrdersApi(c, s), production: createProductionApi(c, s),
            stock: createStockApi(c, s), shipment: createShipmentApi(c, s), commercial: createCommercialApprovalApi(c, s) }, { wo: q.get('wo'), lot: q.get('lot') }),
    },
    { path: '/muhasebe', label: 'Muhasebe / Fatura (kalem)', group: 'Yönetim', inMenu: false, needs: ['kalem'], render: (el, c, s, q) => renderAccountingScreen(el, q.get('kalem') ?? '', createAccountingApi(c, s)) },
    { path: '/tara', label: 'QR / Barkod Okut', group: 'Saha', inMenu: true, render: (el, c, s) => renderScanScreen(el, createScanApi(c, s)) },
    {
        path: '/dokumanlar', label: 'Dokümanlar', group: 'Saha', inMenu: true,
        // ?tip=<WORK_ORDER|STOCK_LOT|PRODUCT_REVISION|…>&id=<uuid> opens a record's documents (links from the passport)
        render: (el, c, s, q) => {
            const tip = q.get('tip');
            const entityType = tip && DOCUMENT_ENTITY_TYPES.includes(tip) ? tip : undefined;
            return renderDocumentsScreen(el, createDocumentsApi(c, s), entityType && q.get('id') ? { entityType, entityId: q.get('id') } : {});
        },
    },
    {
        path: '/pasaport', label: 'Pasaport / Dijital DNA', group: 'Saha', inMenu: true,
        // ?kod=<etiket kodu | QR | ürün kodu> opens the passport directly (e.g. from a printed label link)
        render: async (el, c, s, q) => {
            const api = createPassportApi(c, s);
            const kod = q.get('kod');
            if (kod) {
                try {
                    return await renderPassportScreen(el, api, { input: kod, view: await api.resolve(kod), back: [] });
                }
                catch {
                    /* falls through: the screen shows the input and the user can retry */
                }
            }
            return renderPassportScreen(el, api, { input: kod ?? '' });
        },
    },
    { path: '/giris-cikislarim', label: 'Giriş-çıkışlarım', group: 'Saha', inMenu: true, render: (el, c, s) => renderMyAttendanceScreen(el, createGeckoApi(c, s), { today: istanbulToday() }) },
    { path: '/rozetlerim', label: 'Rozetlerim', group: 'Saha', inMenu: true, render: (el, c, s, q) => renderBadgesScreen(el, createBadgesApi(c, s), { personnelId: q.get('kisi') }) },
    { path: '/bakim', label: 'Bakım / Makine Sağlığı', group: 'Saha', inMenu: true, render: (el, c, s) => renderMaintenanceScreen(el, { api: createMaintenanceApi(c, s) }) },
    { path: '/takimhane', label: 'Takımhane', group: 'Saha', inMenu: true, render: (el, c, s) => renderToolroomScreen(el, { api: createToolroomApi(c, s) }) },
    { path: '/komuta', label: 'Komuta Merkezi · PULSE', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderCommandCenterScreen(el, createCommandCenterApi(c, s), { refreshMs: 60_000 }) },
    { path: '/rota', label: 'Rota / Operasyonlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderRoutingScreen(el, createRoutingApi(c, s)) },
    { path: '/planlama', label: 'Üretim Planlama', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPlanningScreen(el, createPlanningApi(c, s), { today: istanbulToday(), days: 5 }) },
    { path: '/oee', label: 'OEE / KPI', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOeeScreen(el, createOeeApi(c, s), { from: addDays(istanbulToday(), -6), to: istanbulToday(), group: 'MACHINE' }) },
    { path: '/raporlar', label: 'Raporlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderReportsScreen(el, createReportsApi(c, s)) },
    { path: '/cihazlar', label: 'Cihaz entegrasyonları (kanıt bekliyor)', group: 'Diğer', inMenu: true, render: (el, c, s) => renderDevicesScreen(el, createDevicesApi(c, s)) },
    { path: '/zeka', label: 'KMI Zekâ — sor, sıradaki adımlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderIntelligenceScreen(el, createIntelligenceApi(c, s), { today: istanbulToday() }) },
    { path: '/canli', label: 'KMI LIVE — fabrika ekranı', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderLiveScreen(el, createLiveApi(c, s), { mode: 'APP' }) },
    { path: '/alacaklar', label: 'Alacaklar & Vade', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderReceivablesScreen(el, createReceivablesApi(c, s), { today: istanbulToday() }) },
    { path: '/ekonomi', label: 'Ekonomi & Kararlar (yalnız sahip)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEconomicsScreen(el, createEconomicsApi(c, s), { from: addDays(istanbulToday(), -89), to: istanbulToday(), today: istanbulToday() }) },
    { path: '/giris-cikis', label: 'Giriş-Çıkış (GEÇKO)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderGeckoScreen(el, createGeckoApi(c, s)) },
    { path: '/yetkinlik-aktarim', label: 'Yetkinlik geçmişi aktarımı', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderCompetencyImportScreen(el, createCompetencyImportApi(c, s)) },
    { path: '/akademi', label: 'Akademi & Yetkinlik', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderAcademyScreen(el, createAcademyApi(c, s)) },
    { path: '/siparisler', label: 'Siparişler', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOrdersScreen(el, createOrdersApi(c, s)) },
    { path: '/muhendislik', label: 'Ürün mühendisliği (revizyon · reçete · CAM)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEngineeringScreen(el, createEngineeringApi(c, s)) },
    { path: '/katalog', label: 'Katalog (müşteri · tedarikçi · ürün)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderCatalogScreen(el, createCatalogApi(c, s)) },
    { path: '/ana-veri-aktarim', label: 'Ana veri aktarımı (eski KMI)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderMasterImportScreen(el, createMasterImportApi(c, s)) },
    { path: '/personel', label: 'Personel', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPersonnelScreen(el, { api: createPersonnelApi(c, s) }) },
    { path: '/personel-yetki', label: 'Personel erişimi (hesap · vardiya · çoklu makine)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPersonnelAccessScreen(el, createPersonnelAccessApi(c, s)) },
    { path: '/personel-aktarim', label: 'Personel aktarımı (eski KMI)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPersonnelImportScreen(el, createPersonnelImportApi(c, s)) },
    { path: '/satinalma', label: 'Satınalma / Mal Kabul', group: 'Satınalma / Depo', inMenu: true, render: (el, c, s) => renderPurchasingScreen(el, { api: createPurchasingApi(c, s) }) },
    { path: '/talepler', label: 'Satınalma Talepleri', group: 'Satınalma / Depo', inMenu: true, render: (el, c, s) => renderPurchaseRequestsScreen(el, createPurchaseRequestsApi(c, s)) },
    {
        path: '/tedarikci-fatura', label: 'Tedarikçi Faturası', group: 'Satınalma / Depo', inMenu: false, needs: ['po'],
        render: (el, c, s, q) => renderSupplierInvoiceScreen(el, { id: q.get('po') ?? '', label: q.get('baslik') ?? 'Satınalma siparişi', currency: q.get('para') ?? 'TRY' }, createSupplierInvoiceApi(c, s)),
    },
    {
        path: '/etiket', label: 'Etiket', group: 'Diğer', inMenu: false, needs: ['id'],
        render: (el, c, s, q) => renderLabelScreen(el, { type: (q.get('tip') ?? 'WO'), id: q.get('id') ?? '', title: q.get('baslik') ?? '' }, createLabelApi(c, s)),
    },
    { path: '/malzeme', label: 'Hammadde / BOM', group: 'Diğer', inMenu: false, needs: ['is'], render: (el, c, s, q) => renderMaterialScreen(el, q.get('is') ?? '', createMaterialApi(c, s)) },
    {
        path: '/takim-hazirlik', label: 'Takım Hazırlığı', group: 'Diğer', inMenu: false, needs: ['is'],
        render: (el, c, s, q) => renderToolReadinessScreen(el, q.get('is') ?? '', q.get('makine') ?? '', createToolReadinessApi(c, s)),
    },
];
export function parseHash(hash) {
    const raw = hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path: path || '/', query: new URLSearchParams(qs ?? '') };
}
const SHELL_CSS = `
body{margin:0;background:#f4f6fa;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
.shell-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 16px;background:#0b1220;color:#fff;position:sticky;top:0;z-index:5}
.shell-top a{color:#fff;text-decoration:none;font-weight:800}
.shell-top span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px}
.shell-top button{min-height:40px;border-radius:10px;border:0;padding:0 12px;font-weight:700}
.shell-menu{padding:16px;max-width:820px;margin:0 auto;box-sizing:border-box}
.shell-menu h2{font-size:13px;text-transform:uppercase;color:#64748b;margin:18px 0 8px}
.shell-menu .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.shell-menu a{display:flex;align-items:center;min-height:64px;padding:12px;border-radius:14px;background:#fff;color:#0f172a;text-decoration:none;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.login{max-width:360px;margin:12vh auto;padding:24px;background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
.login input,.login button{width:100%;min-height:48px;font-size:16px;margin:6px 0;border-radius:10px;box-sizing:border-box}
.login input{border:1px solid #cbd5e1;padding:0 12px}.login button{border:0;background:#1d4ed8;color:#fff;font-weight:800}
.offline{background:#fef3c7;color:#92400e;padding:8px 16px;font-weight:700}
`;
export async function startApp(root, opts = {}) {
    const cfg = window.KMI_NEXT_CONFIG;
    if (!opts.client && !cfg) {
        mount(root, h('div', { class: 'login', 'data-testid': 'app-config-missing' }, h('h1', {}, 'KMI NEXT'), h('p', {}, 'Yapılandırma eksik: config.js bulunamadı (supabaseUrl / anonKey). Yayın ortamında doldurulur.')));
        return;
    }
    const client = opts.client ?? createKmiNextClient({ url: cfg.supabaseUrl, apiKey: cfg.anonKey });
    let session = loadSession();
    let accessCache = null;
    // What this user may open (server mirror: my_access). A failure never opens anything extra: only unrestricted screens remain.
    const getAccess = async () => {
        const token = session?.accessToken ?? '';
        if (accessCache && accessCache.token === token)
            return accessCache;
        try {
            const value = await client.rpc('my_access', {}, session);
            accessCache = { token, value: { ...NO_ACCESS, ...value }, failed: false };
        }
        catch {
            return { value: NO_ACCESS, failed: true };
        }
        return accessCache;
    };
    const offlineBar = () => (navigator.onLine ? null : h('div', { class: 'offline', 'data-testid': 'app-offline' }, 'Bağlantı yok — kayıtlar gönderilemez, bağlantı gelince tekrar deneyin.'));
    const renderLogin = (message) => {
        const email = h('input', { type: 'email', autocomplete: 'username', 'data-testid': 'login-email', placeholder: 'E-posta' });
        const pass = h('input', { type: 'password', autocomplete: 'current-password', 'data-testid': 'login-password', placeholder: 'Şifre' });
        const submit = async (e) => {
            e.preventDefault();
            try {
                session = await client.auth.signInWithPassword(email.value.trim(), pass.value);
                accessCache = null;
                saveSession(session);
                location.hash = '#/';
                await route();
            }
            catch (err) {
                renderLogin(err instanceof Error ? `Giriş başarısız: ${err.message}` : 'Giriş başarısız');
            }
        };
        mount(root, h('div', {}, h('style', {}, SHELL_CSS), offlineBar(), h('form', { class: 'login', 'data-testid': 'login-form', onSubmit: (e) => void submit(e) }, h('h1', {}, 'KMI NEXT'), h('p', { style: 'color:#64748b' }, 'Kurutlu Manufacturing Intelligence'), message ? h('div', { 'data-testid': 'login-error', style: 'color:#b91c1c;margin:8px 0' }, message) : null, email, pass, h('button', { type: 'submit', 'data-testid': 'login-submit' }, 'Giriş'))));
    };
    const route = async () => {
        {
            // KMI LIVE kiosk: no login, display token only, PUBLIC board only (server decides)
            const { path, query } = parseHash(location.hash);
            const t = query.get('t');
            if (path === '/ekran' && t) {
                mount(root, h('div', { 'data-testid': 'app-kiosk' }));
                return renderLiveScreen(root.firstElementChild, createKioskLiveApi(client, t), { mode: 'KIOSK' });
            }
        }
        if (!session)
            return renderLogin();
        const { path, query } = parseHash(location.hash);
        const content = h('div', { 'data-testid': 'app-content' });
        const logout = async () => {
            try {
                if (session)
                    await client.auth.signOut(session);
            }
            catch {
                /* token may already be expired — local sign-out still happens */
            }
            session = null;
            accessCache = null;
            saveSession(null);
            location.hash = '#/';
            renderLogin('Çıkış yapıldı.');
        };
        mount(root, h('div', {}, h('style', {}, SHELL_CSS), offlineBar(), h('div', { class: 'shell-top' }, h('a', { href: '#/', 'data-testid': 'app-home' }, 'KMI NEXT'), h('form', { 'data-testid': 'app-search-form', style: 'flex:1 1 140px;display:flex;min-width:0', onSubmit: (e) => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v)
                location.hash = `#/ara?q=${encodeURIComponent(v)}`; } }, h('input', { type: 'search', 'data-testid': 'app-search', placeholder: 'Ara…', value: path === '/ara' ? (query.get('q') ?? '') : '', style: 'flex:1;min-width:0;min-height:36px;font-size:16px;border-radius:8px;border:0;padding:0 10px' })), h('span', { style: 'font-size:12px;opacity:.8', 'data-testid': 'app-user' }, session.user.email ?? ''), h('button', { type: 'button', 'data-testid': 'app-logout', onClick: () => void logout() }, 'Çıkış')), content));
        const { value: access, failed: accessFailed } = await getAccess();
        const r = ROUTES.find((x) => x.path === path);
        if (!r) {
            const landing = landingPath(access);
            if (landing) {
                location.hash = `#${landing}`;
                return;
            }
            const open = ROUTES.filter((x) => x.inMenu && canOpen(x.path, access));
            const featured = featuredPaths(access, open.map((x) => x.path)).map((p) => open.find((x) => x.path === p));
            const groups = [...new Set(open.map((x) => x.group))];
            const tile = (x, testid) => h('a', { href: `#${x.path}`, 'data-testid': testid, 'data-path': x.path }, x.label);
            mount(content, h('div', { class: 'shell-menu', 'data-testid': 'app-menu' }, accessFailed ? h('div', { class: 'offline', 'data-testid': 'app-access-failed' }, 'Yetki bilgisi alınamadı; yalnız herkese açık ekranlar gösteriliyor. Sayfayı yenileyin.') : null, access.roles.length ? h('div', { 'data-testid': 'app-roles', style: 'font-size:13px;color:#475569;margin:4px 0' }, `Rolünüz: ${access.roles.join(', ')}${access.economics ? ' · ekonomi yetkisi' : ''}`) : null, featured.length ? h('div', { 'data-testid': 'app-featured' }, h('h2', {}, 'Sizin için'), h('div', { class: 'tiles' }, ...featured.map((x) => tile(x, 'app-featured-item')))) : null, h('details', { 'data-testid': 'app-all', ...(featured.length ? {} : { open: 'open' }) }, h('summary', { style: 'min-height:48px;display:flex;align-items:center;font-weight:800' }, 'Tüm ekranlar'), ...groups.map((g) => h('div', {}, h('h2', {}, g), h('div', { class: 'tiles' }, ...open.filter((x) => x.group === g).map((x) => tile(x, 'app-menu-item'))))))));
            return;
        }
        if (!canOpen(r.path, access)) {
            mount(content, h('div', { class: 'shell-menu', 'data-testid': 'app-closed' }, h('h2', {}, r.label), h('p', {}, accessFailed ? 'Yetki bilgisi alınamadığı için bu ekran açılmadı. Sayfayı yenileyin.' : 'Bu ekran rolünüze açık değil. Gerekliyse yöneticinize başvurun.'), h('a', { href: '#/', 'data-testid': 'app-closed-home' }, '← Ana sayfa')));
            return;
        }
        const missing = (r.needs ?? []).filter((k) => !query.get(k));
        if (missing.length) {
            mount(content, h('div', { class: 'shell-menu', 'data-testid': 'app-needs-record' }, h('h2', {}, r.label), h('p', {}, 'Bu ekran bir kayıttan açılır (iş emri, sipariş kalemi veya satınalma siparişi). Kaydı seçip oradan ilerleyin.'), h('a', { href: '#/is-emirleri', 'data-testid': 'app-needs-record-link' }, 'İş Emirleri merkezine git')));
            return;
        }
        try {
            await r.render(content, client, session, query);
        }
        catch (err) {
            mount(content, h('div', { class: 'shell-menu', 'data-testid': 'app-route-error' }, `Ekran açılamadı: ${err instanceof Error ? err.message : String(err)}`));
        }
    };
    window.addEventListener('hashchange', () => void route());
    // OFFLINE POLICY (CONTINUATION-005 §6): losing the connection must never re-render the screen under the user's hands (typed values, a pending
    // request id). Only the offline bar changes. When the connection returns, the screen is reloaded ONLY if nothing has been typed into it.
    window.addEventListener('offline', () => {
        if (!root.querySelector('[data-testid="app-offline"]')) {
            const bar = offlineBar() ?? h('div', { class: 'offline', 'data-testid': 'app-offline' }, 'Bağlantı yok — kayıtlar gönderilemez, bağlantı gelince tekrar deneyin.');
            root.prepend(bar);
        }
    });
    window.addEventListener('online', () => {
        root.querySelector('[data-testid="app-offline"]')?.remove();
        const typed = Array.from(root.querySelectorAll('input:not([type=search]):not([type=password]), textarea')).some((e) => (e.value ?? '').length > 0);
        if (!typed)
            void route();
    });
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            /* SW is an enhancement (offline shell); the app works without it */
        });
    }
    await route();
}
