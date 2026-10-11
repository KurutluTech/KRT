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
import { renderOwnerApplicationScreen } from './screens/OwnerApplicationScreen.js';
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
import { THEME_CSS } from './theme.js';
import { NAV_ITEM_BY_PATH, iconSvg, visibleNav } from './nav.js';
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
    { path: '/ekonomi-basvuru', label: 'Ekonomik sahiplik başvurusu', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOwnerApplicationScreen(el, createEconomicsApi(c, s)) },
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
const SHELL_CSS = THEME_CSS + `
.shell-menu{padding:16px;max-width:820px;margin:0 auto}
.shell-menu a{color:#67e8f9;font-weight:700}
.offline{background:rgba(245,158,11,.16);color:#fcd34d;padding:8px 16px;font-weight:700;position:sticky;top:0;z-index:50}
`;
const BRAND = 'KURUTLU MANUFACTURING INTELLIGENCE';
const BRAND_SUB = 'Performance Center · Paperless Machining';
const icon = (name, size = 20) => { const el = document.createElement('span'); el.className = 'ic'; el.innerHTML = iconSvg(name, size); return el; };
const readCollapsed = () => { try {
    return localStorage.getItem('kmiSidebarCollapsed') === '1';
}
catch {
    return false;
} };
const writeCollapsed = (v) => { try {
    localStorage.setItem('kmiSidebarCollapsed', v ? '1' : '0');
}
catch { /* storage may be blocked */ } };
export async function startApp(root, opts = {}) {
    const cfg = window.KMI_NEXT_CONFIG;
    if (!opts.client && !cfg) {
        mount(root, h('div', { class: 'login', 'data-testid': 'app-config-missing' }, h('h1', {}, 'KMI'), h('p', {}, 'Yapılandırma eksik: config.js bulunamadı (supabaseUrl / anonKey). Yayın ortamında doldurulur.')));
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
        const email = h('input', { type: 'email', autocomplete: 'username', 'data-testid': 'login-email', placeholder: 'E-posta', id: 'kmi-login-email' });
        const pass = h('input', { type: 'password', autocomplete: 'current-password', 'data-testid': 'login-password', placeholder: 'Şifre', id: 'kmi-login-password' });
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
        mount(root, h('div', {}, h('style', {}, SHELL_CSS), offlineBar(), h('div', { class: 'kmi-login', 'data-testid': 'login-screen' }, h('div', { class: 'kmi-login-k', 'aria-hidden': 'true' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' })), h('form', { class: 'kmi-login-card', 'data-testid': 'login-form', onSubmit: (e) => void submit(e) }, h('div', { class: 'brand' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: 'Kurutlu' }), h('h1', {}, BRAND), h('p', { class: 'sub' }, BRAND_SUB), h('div', { class: 'rule' })), message ? h('div', { class: 'kmi-login-err', 'data-testid': 'login-error', role: 'alert' }, message) : null, h('label', { for: 'kmi-login-email' }, 'E-posta'), email, h('label', { for: 'kmi-login-password' }, 'Şifre'), pass, h('button', { type: 'submit', 'data-testid': 'login-submit' }, 'Giriş')))));
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
        const collapsed0 = readCollapsed();
        document.documentElement.style.setProperty('--kmi-side-w', collapsed0 ? '64px' : '260px');
        const navHost = h('nav', { class: 'kmi-nav', 'data-testid': 'app-nav', 'aria-label': 'Modüller' });
        const drawerNavHost = h('nav', { class: 'kmi-nav', 'data-testid': 'app-drawer-nav', 'aria-label': 'Modüller (menü)' });
        const bottomHost = h('nav', { class: 'kmi-bottom', 'data-testid': 'app-bottom-nav', 'aria-label': 'Hızlı gezinme' });
        const drawerBack = h('div', { class: 'kmi-drawer-back', 'data-testid': 'app-drawer' });
        const closeDrawer = () => { drawerBack.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
        const openDrawer = () => { drawerBack.classList.add('open'); menuBtn.setAttribute('aria-expanded', 'true'); drawerNavHost.querySelector('a')?.focus(); };
        const menuBtn = h('button', { type: 'button', class: 'btn kmi-menu-btn', 'data-testid': 'app-menu-btn', 'aria-label': 'Menüyü aç', 'aria-expanded': 'false', 'aria-controls': 'kmi-drawer', onClick: () => (drawerBack.classList.contains('open') ? closeDrawer() : openDrawer()) }, icon('menu'), h('span', { class: 'nl' }, 'Menü'));
        drawerBack.addEventListener('click', (e) => { if (e.target === drawerBack)
            closeDrawer(); });
        drawerBack.addEventListener('keydown', (e) => { if (e.key === 'Escape') {
            closeDrawer();
            menuBtn.focus();
        } });
        drawerBack.append(h('aside', { class: 'kmi-drawer', id: 'kmi-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'KMI menü' }, h('div', { class: 'kmi-side-head' }, h('a', { class: 'b', href: '#/', onClick: closeDrawer }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' }), h('span', { class: 't' }, h('i', {}, 'KURUTLU'), h('b', {}, 'Performance Center'))), h('button', { type: 'button', class: 'kmi-side-collapse', 'aria-label': 'Menüyü kapat', onClick: closeDrawer }, '✕')), drawerNavHost));
        const sideEl = h('aside', { class: `kmi-side${collapsed0 ? ' collapsed' : ''}`, 'data-testid': 'app-sidebar', 'aria-label': 'Ana gezinme' }, h('div', { class: 'kmi-side-head' }, h('a', { class: 'b', href: '#/', 'data-testid': 'app-side-home', title: BRAND }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: 'Kurutlu' }), h('span', { class: 't' }, h('i', {}, 'KURUTLU'), h('b', {}, 'Performance Center'))), h('button', { type: 'button', class: 'kmi-side-collapse', 'data-testid': 'app-side-collapse', 'aria-label': collapsed0 ? 'Menüyü genişlet' : 'Menüyü daralt', title: collapsed0 ? 'Genişlet' : 'Daralt',
            onClick: () => { const now = !sideEl.classList.contains('collapsed'); sideEl.classList.toggle('collapsed', now); writeCollapsed(now); document.documentElement.style.setProperty('--kmi-side-w', now ? '64px' : '260px'); collBtn.setAttribute('aria-label', now ? 'Menüyü genişlet' : 'Menüyü daralt'); collBtn.replaceChildren(icon(now ? 'chevrons-right' : 'chevrons-left', 16)); } }, icon(collapsed0 ? 'chevrons-right' : 'chevrons-left', 16))), navHost);
        const collBtn = sideEl.querySelector('[data-testid="app-side-collapse"]');
        mount(root, h('div', { class: 'kmi-has-bottom' }, h('style', {}, SHELL_CSS), offlineBar(), h('a', { class: 'kmi-skip', href: '#kmi-main', onClick: (e) => { e.preventDefault(); document.getElementById('kmi-main')?.focus(); } }, 'İçeriğe geç'), sideEl, drawerBack, h('div', { class: 'kmi-main' }, h('header', { class: 'kmi-top' }, h('a', { class: 'brand', href: '#/', 'data-testid': 'app-home', title: BRAND }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' }), h('span', {}, 'KMI', h('small', {}, 'PERFORMANCE CENTER'))), h('form', { 'data-testid': 'app-search-form', role: 'search', onSubmit: (e) => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v)
                location.hash = `#/ara?q=${encodeURIComponent(v)}`; } }, h('input', { type: 'search', 'data-testid': 'app-search', 'aria-label': 'Ara', placeholder: 'Ara…', value: path === '/ara' ? (query.get('q') ?? '') : '' })), h('span', { class: 'user', 'data-testid': 'app-user' }, session.user.email ?? ''), menuBtn, h('button', { type: 'button', class: 'btn', 'data-testid': 'app-logout', onClick: () => void logout() }, icon('logout', 16), h('span', { class: 'nl' }, 'Çıkış'))), h('main', { class: 'kmi-content', id: 'kmi-main', tabindex: '-1' }, content)), bottomHost));
        const { value: access, failed: accessFailed } = await getAccess();
        // navigation: only what this user may open (same rule as the home screen and the direct-URL guard); the server decides for real
        const navGroups = visibleNav((p) => canOpen(p, access) && ROUTES.some((x) => x.path === p && x.inMenu));
        const navLink = (it, testid, onNav) => {
            const a = h('a', { href: `#${it.path}`, 'data-testid': testid, 'data-path': it.path, title: it.label, ...(it.path === path ? { 'aria-current': 'page' } : {}), ...(onNav ? { onClick: onNav } : {}) }, icon(it.icon), h('span', { class: 'nl' }, it.label));
            return a;
        };
        const fillNav = (host, itemTestId, onNav) => {
            host.replaceChildren(...navGroups.flatMap((g, gi) => [
                ...(gi > 0 ? [h('hr', {})] : []),
                ...(g.title ? [h('div', { class: 'lbl' }, g.title)] : []),
                ...g.items.map((it) => navLink(it, itemTestId, onNav)),
            ]));
        };
        fillNav(navHost, 'app-nav-item');
        fillNav(drawerNavHost, 'app-drawer-item', closeDrawer);
        const quick = ['/', ...featuredPaths(access, navGroups.flatMap((g) => g.items.map((i) => i.path))).filter((p) => p !== '/')].slice(0, 4);
        bottomHost.replaceChildren(...quick.map((p) => navLink(NAV_ITEM_BY_PATH[p], 'app-bottom-item')), h('button', { type: 'button', 'data-testid': 'app-bottom-menu', 'aria-label': 'Tüm menü', onClick: openDrawer }, icon('menu'), 'Menü'));
        const r = ROUTES.find((x) => x.path === path);
        if (!r) {
            const landing = landingPath(access);
            if (landing) {
                location.hash = `#${landing}`;
                return;
            }
            const open = ROUTES.filter((x) => x.inMenu && canOpen(x.path, access));
            const featured = featuredPaths(access, open.map((x) => x.path)).map((p) => open.find((x) => x.path === p));
            const tile = (x, testid, cls = '') => {
                const n = NAV_ITEM_BY_PATH[x.path];
                return h('a', { href: `#${x.path}`, class: `kmi-tile${cls}`, 'data-testid': testid, 'data-path': x.path }, icon(n?.icon ?? 'grid', 22), h('span', {}, n?.label ?? x.label, (() => { const rest = n && x.label.startsWith(n.label) ? x.label.slice(n.label.length).replace(/^[\s·—()-]+|[\s)]+$/g, '') : (n && n.label !== x.label ? x.label : ''); return rest ? h('small', {}, rest) : null; })()));
            };
            const homeGroups = navGroups.map((g) => ({ title: g.title, items: g.items.map((i) => open.find((x) => x.path === i.path)).filter((x) => !!x) })).filter((g) => g.items.length > 0);
            mount(content, h('div', { class: 'shell-menu kmi-home', style: 'max-width:1200px', 'data-testid': 'app-menu' }, accessFailed ? h('div', { class: 'kmi-banner warn', 'data-testid': 'app-access-failed' }, 'Yetki bilgisi alınamadı; yalnız herkese açık ekranlar gösteriliyor. Sayfayı yenileyin.') : null, h('section', { class: 'kmi-hero' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' }), h('div', {}, h('h1', {}, BRAND), h('p', {}, BRAND_SUB), access.roles.length ? h('div', { class: 'chips', 'data-testid': 'app-roles' }, h('span', { class: 'kmi-chip' }, `Rolünüz: ${access.roles.join(', ')}`), access.economics ? h('span', { class: 'kmi-chip' }, 'ekonomi yetkisi') : null) : null)), featured.length ? h('div', { 'data-testid': 'app-featured' }, h('div', { class: 'kmi-section gold' }, 'SİZİN İÇİN'), h('div', { class: 'tiles' }, ...featured.map((x) => tile(x, 'app-featured-item', ' featured')))) : null, h('details', { 'data-testid': 'app-all', open: 'open', class: 'kmi-home' }, h('summary', {}, 'Tüm ekranlar'), ...homeGroups.map((g) => h('div', {}, g.title ? h('div', { class: 'kmi-section' }, g.title) : h('div', { style: 'height:8px' }), h('div', { class: 'tiles' }, ...g.items.map((x) => tile(x, 'app-menu-item'))))))));
            return;
        }
        if (!canOpen(r.path, access)) {
            mount(content, h('div', { class: 'shell-menu kmi-closed', 'data-testid': 'app-closed' }, h('h2', {}, r.label), h('p', {}, accessFailed ? 'Yetki bilgisi alınamadığı için bu ekran açılmadı. Sayfayı yenileyin.' : 'Bu ekran rolünüze açık değil. Gerekliyse yöneticinize başvurun.'), h('a', { href: '#/', 'data-testid': 'app-closed-home' }, '← Ana sayfa')));
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
