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
import { renderPuantajScreen } from './screens/PuantajScreen.js';
import { createPuantajApi } from './puantajApi.js';
import { renderAccountingQueueScreen } from './screens/AccountingQueueScreen.js';
import { createAccountingQueueApi } from './accountingQueueApi.js';
import { renderZirvedekilerScreen } from './screens/ZirvedekilerScreen.js';
import { renderEngineeringScreen } from './screens/EngineeringScreen.js';
import { createEngineeringApi } from './engineeringApi.js';
import { renderOperatorHomeScreen } from './screens/OperatorHomeScreen.js';
import { createOperatorHomeApi } from './operatorHomeApi.js';
import { createTerminalApi } from './terminalApi.js';
import { withCockpit, liveCockpitSources } from './screens/DepartmentCockpit.js';
import { renderDepartmentHome } from './screens/DepartmentHomeScreen.js';
import { COCKPIT_OF_PATH } from '../../../packages/domain/src/departmentCockpit.js';
import { renderPerformanceCenter } from './screens/PerformanceCenterScreen.js';
import { createPerformanceCenterSources } from './performanceCenterApi.js';
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
import { renderTahsisScreen } from './screens/TahsisScreen.js';
import { createTahsisApi } from './tahsisApi.js';
import { renderManagementScreen } from './screens/ManagementScreen.js';
import { createManagementApi } from './managementApi.js';
import { renderHomeTab } from './screens/management/HomeTab.js';
import { renderOperationsTab } from './screens/management/OperationsTab.js';
import { renderFinanceTab } from './screens/management/FinanceTab.js';
import { renderStrategyTab } from './screens/management/StrategyTab.js';
import { renderPeopleTab } from './screens/management/PeopleTab.js';
import { renderRiskTab } from './screens/management/RiskTab.js';
import { renderIntelligenceTab } from './screens/management/IntelligenceTab.js';
import { renderMeetingsTab } from './screens/management/MeetingsTab.js';
import { createApprovalsInboxApi } from './approvalsInboxApi.js';
import { renderCostIntelligenceScreen } from './screens/CostIntelligenceScreen.js';
import { createCostOpsApi } from './costOpsApi.js';
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
import { renderObjectPassportScreen } from './screens/ObjectPassportScreen.js';
import { createObjectPassportApi } from './objectPassportApi.js';
import { isKind, canonicalHref, LEGACY_TO_CANONICAL } from './passport/registry.js';
import { decideLegacyPassport, isUuid } from './passport/compat.js';
import { createTraceMounter } from './passport/traceTab.js';
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
import { renderDepartmentScreen } from './screens/DepartmentScreen.js';
import { createDepartmentApi } from './departmentApi.js';
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
import { renderHistorySearchScreen } from './screens/HistorySearchScreen.js';
import { createHistoryApi } from './historyApi.js';
import { createHeader, pickShortcuts } from './header.js';
import { renderCockpit } from './homeCockpit.js';
import { loadExtras } from './homeData.js';
import { homeCardsFor } from '../../../packages/domain/src/homeLayout.js';
import { startIdleGuard } from './idleGuard.js';
import { idleGuardApplies, resolveDeviceMode } from '../../../packages/domain/src/idleSession.js';
import { NAV_TREE, NAV_ITEM_BY_PATH, WORKSPACE_OF_PATH, breadcrumbOf, NAV_STATE_KEY, iconSvg, isOperatorOnly, nextNavState, readNavState, simpleNav, visibleNav } from './nav.js';
const NAV_TREE_FIRST = Object.fromEntries(NAV_TREE.map((g) => [g.id, g.items.find((i) => i.path !== '/')?.path ?? g.items[0].path]));
const SESSION_KEY = 'kmi-next.session';
const OPERATOR_FLAG_KEY = 'kmi-next.operatorSession'; // set only by a Sicil No + PIN sign-in: that session is a shared-terminal session (60 s inactivity rule)
const DEVICE_MODE_KEY = 'kmiDeviceMode';
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
        else {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(OPERATOR_FLAG_KEY);
        }
    }
    catch {
        /* private mode: session lives only in memory for this page */
    }
}
const istanbulToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
/** Yönetim Zekâsı: nine tabs on one context. Each tab loads its own sources; the server (authorize_critical_action / RLS / can_view_economics) stays the only authority. */
function managementDeps(c, s, a) {
    const approvals = createApprovalsInboxApi(c, s, { includeTasks: a.actions.includes('TASK_MANAGE') });
    const ctx = () => ({ api: createManagementApi(c, s), approvals, command: createCommandCenterApi(c, s), oee: createOeeApi(c, s), economics: createEconomicsApi(c, s), held: new Set(a.actions), hasEconomics: a.economics, today: istanbulToday(), nowMs: Date.now(), access: a });
    return {
        approvals: { api: approvals, held: a.actions, ctx },
        leadTabs: [{ id: 'home', label: 'Özet', render: (p) => renderHomeTab(p, ctx()) }],
        extraTabs: [
            { id: 'operasyon', label: 'Operasyon', render: (p) => renderOperationsTab(p, ctx()) }, { id: 'finans', label: 'Finans', render: (p) => renderFinanceTab(p, ctx()) },
            { id: 'strateji', label: 'Strateji', render: (p) => renderStrategyTab(p, ctx()) }, { id: 'insan', label: 'İnsan', render: (p) => renderPeopleTab(p, ctx()) },
            { id: 'risk', label: 'Risk', render: (p) => renderRiskTab(p, ctx()) }, { id: 'zeka', label: 'KMI Zekâ', render: (p) => renderIntelligenceTab(p, ctx()) }, { id: 'toplanti', label: 'Toplantılar', render: (p) => renderMeetingsTab(p, ctx()) }
        ],
    };
}
const addDays = (iso, n) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
// Sensitive export: the audit row is written by the API (export_audit) BEFORE this runs; this only hands the text to the browser.
function downloadText(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const ROUTES = [
    {
        path: '/nesne', label: 'Nesne pasaportu', group: 'Saha', inMenu: false, needs: ['t', 'id'],
        // ?t=<MACHINE|WORK_ORDER|…>&id=<uuid>&tab=<tab> — one canonical object, one digital passport
        render: (el, c, s, q, access) => {
            const t = q.get('t');
            if (!isKind(t)) {
                mount(el, h('div', { 'data-testid': 'pp-badkind', style: 'padding:16px' }, 'Bilinmeyen nesne türü.'));
                return;
            }
            // the former /pasaport traceability chain (missing links · as-built · raw material · lots · shipments · economic lock) lives HERE now; one identity, one passport
            const trace = createTraceMounter(createPassportApi(c, s), (href) => { location.hash = href; });
            return renderObjectPassportScreen(el, createObjectPassportApi(c, s, access), { kind: t, id: q.get('id'), tab: q.get('tab') ?? undefined }, { access, trace });
        },
    },
    { path: '/gecmis', label: 'Olay geçmişi (zaman araması)', group: 'Yönetim', inMenu: true, render: (el, c, s, _q, a) => renderHistorySearchScreen(el, createHistoryApi(c, s), { access: a, nowIso: new Date().toISOString() }) },
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
        // COMPATIBILITY ENTRY (printed label/QR links, universal-search and next-best-action routes written by migrations 0047/0059 keep working).
        // There is ONE passport: /nesne. This route only resolves a code (?kod=<etiket KL…|QR|ürün kodu>) or a work order (?is=<id>) to the canonical identity and
        // redirects to its "İzlenebilirlik zinciri" tab; with neither it is the "Nesne bul" box. It stores nothing and creates no record.
        path: '/pasaport', label: 'Nesne bul (etiket / QR / ürün kodu)', group: 'Saha', inMenu: false,
        render: async (el, c, s, q) => {
            const api = createPassportApi(c, s);
            // fail-closed: only a known kind with a well-formed id ever redirects (decideLegacyPassport); anything else stays on the box with a message
            const go = (k, id) => {
                if (k in LEGACY_TO_CANONICAL && isUuid(id))
                    location.replace(canonicalHref(k, id));
            };
            const d = await decideLegacyPassport({ kod: q.get('kod'), is: q.get('is') }, (input) => api.resolve(input));
            if (d.action === 'redirect') {
                location.replace(d.href);
                return;
            }
            return renderPassportScreen(el, api, { input: d.input, navigate: go, notice: d.error });
        },
    },
    { path: '/giris-cikislarim', label: 'Giriş-çıkışlarım', group: 'Saha', inMenu: true, render: (el, c, s) => renderMyAttendanceScreen(el, createGeckoApi(c, s), { today: istanbulToday() }) },
    { path: '/rozetlerim', label: 'Rozetlerim', group: 'Saha', inMenu: true, render: (el, c, s, q) => renderBadgesScreen(el, createBadgesApi(c, s), { personnelId: q.get('kisi') }) },
    { path: '/bakim', label: 'Bakım / Makine Sağlığı', group: 'Saha', inMenu: true, render: (el, c, s) => renderMaintenanceScreen(el, { api: createMaintenanceApi(c, s) }) },
    { path: '/kalite', label: 'Kalite Kontrol / Metroloji', group: 'Saha', inMenu: true, render: (el, c, s) => renderDepartmentScreen(el, createDepartmentApi(c, s, createWorkOrderHubApi(c, s)), 'KALITE') },
    { path: '/sevkiyat', label: 'Sevkiyat / Lojistik', group: 'Saha', inMenu: true, render: (el, c, s) => renderDepartmentScreen(el, createDepartmentApi(c, s, createWorkOrderHubApi(c, s)), 'SEVKIYAT') },
    { path: '/depo', label: 'Depo / Stok / Malzeme', group: 'Satınalma / Depo', inMenu: true, render: (el, c, s) => renderDepartmentScreen(el, createDepartmentApi(c, s, createWorkOrderHubApi(c, s)), 'DEPO') },
    { path: '/takimhane', label: 'Takımhane', group: 'Saha', inMenu: true, render: (el, c, s) => renderToolroomScreen(el, { api: createToolroomApi(c, s) }) },
    { path: '/komuta', label: 'Performance Center', group: 'Yönetim', inMenu: true, render: (el, c, s, q) => renderPerformanceCenter(el, createPerformanceCenterSources(c, s), { today: istanbulToday(), dept: q.get('birim'), refreshMs: 60_000 }) },
    { path: '/rota', label: 'Rota / Operasyonlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderRoutingScreen(el, createRoutingApi(c, s)) },
    { path: '/planlama', label: 'Üretim Planlama', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPlanningScreen(el, createPlanningApi(c, s), { today: istanbulToday(), days: 5 }) },
    { path: '/oee', label: 'OEE / KPI', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOeeScreen(el, createOeeApi(c, s), { from: addDays(istanbulToday(), -6), to: istanbulToday(), group: 'MACHINE' }) },
    { path: '/raporlar', label: 'Raporlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderReportsScreen(el, createReportsApi(c, s)) },
    { path: '/cihazlar', label: 'Cihaz entegrasyonları (kanıt bekliyor)', group: 'Diğer', inMenu: true, render: (el, c, s) => renderDevicesScreen(el, createDevicesApi(c, s)) },
    { path: '/zeka', label: 'KMI Zekâ — sor, sıradaki adımlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderIntelligenceScreen(el, createIntelligenceApi(c, s), { today: istanbulToday() }) },
    { path: '/canli', label: 'KMI LIVE — fabrika ekranı', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderLiveScreen(el, createLiveApi(c, s), { mode: 'APP' }) },
    { path: '/onay-kuyrugu', label: 'Muhasebe Kuyruğu (ticari onay)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderAccountingQueueScreen(el, createAccountingQueueApi(c, s)) },
    { path: '/alacaklar', label: 'Alacaklar & Vade', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderReceivablesScreen(el, createReceivablesApi(c, s), { today: istanbulToday() }) },
    { path: '/tahsis', label: 'TAHSİS (ölçü düzeltme)', group: 'Saha', inMenu: true, render: (el, c, s) => renderTahsisScreen(el, createTahsisApi(c, s)) },
    { path: '/departman', label: 'Departman Ana Ekranı', group: 'Diğer', inMenu: false, needs: ['d'], render: (el, c, s, q, a) => {
            const g = NAV_TREE.find((x) => x.id === q.get('d'));
            if (!g) {
                mount(el, h('div', { class: 'shell-menu', 'data-testid': 'dept-unknown' }, 'Böyle bir departman yok.'));
                return;
            }
            const items = g.items.filter((i) => i.path !== '/' && canOpen(i.path, a) && ROUTES.some((x) => x.path === i.path && x.inMenu));
            if (!items.length) {
                mount(el, h('div', { class: 'shell-menu kmi-closed', 'data-testid': 'app-closed' }, 'Bu departman rolünüze açık değil.'));
                return;
            }
            return renderDepartmentHome(el, { icon, view: ['ozet', 'kayit', 'analitik'].find((v) => v === q.get('v')), group: g, items, src: liveCockpitSources(c, s), nowIso: new Date().toISOString() });
        } },
    { path: '/onaylar', label: 'Onaylar (Yönetim)', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => renderManagementScreen(el, managementDeps(c, s, a), { tab: 'onaylar' }) },
    { path: '/yonetim', label: 'Yönetim Zekâsı (onaylar ve üst yönetim)', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => renderManagementScreen(el, managementDeps(c, s, a), { tab: q.get('sekme') }) },
    { path: '/maliyet', label: 'Maliyet Zekâsı (yalnız ekonomik erişim)', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => renderCostIntelligenceScreen(el, q.get('sekme') ?? 'live', { api: createCostOpsApi(c, s), access: a, today: istanbulToday(), nowMs: Date.now(), openTab: (t) => { location.hash = `#/maliyet?sekme=${t}`; }, download: downloadText }) },
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
    { path: '/puantaj', label: 'Puantaj & Prim Havuzu', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPuantajScreen(el, createPuantajApi(c, s)) },
    { path: '/zirvedekiler', label: 'Zirvedekiler', group: 'Yönetim', inMenu: true, render: (el, c, s, _q, a) => renderZirvedekilerScreen(el, { facts: createPuantajApi(c, s).facts, badges: createBadgesApi(c, s), view: a.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT') || a.actions.includes('PUANTAJ_MANAGE') ? 'MANAGEMENT' : 'EMPLOYEE' }) },
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
// Department cockpits: every department work screen gets its own cockpit band (distinct KPIs/queue/workflow per department,
// packages/domain/src/departmentCockpit.ts). A record deep link (?wo= / ?lot=) opens the record without the band.
for (const r of ROUTES) {
    const cockpit = COCKPIT_OF_PATH[r.path];
    if (!cockpit)
        continue;
    const inner = r.render;
    r.render = (el, c, s, q, a) => (q.get('wo') || q.get('lot') ? inner(el, c, s, q, a) : withCockpit(el, cockpit, liveCockpitSources(c, s), new Date().toISOString(), (host) => inner(host, c, s, q, a)));
}
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
    // DEVICE CONTEXT for the 60 s inactivity sign-out: deployment config.js `deviceMode`, or a one-time setup link (?cihaz=kiosk|tablet|masaustu) remembered on this device. Never inferred from screen width.
    const storedLocal = (() => { try {
        return localStorage.getItem(DEVICE_MODE_KEY);
    }
    catch {
        return null;
    } })();
    const device = resolveDeviceMode({ config: window.KMI_NEXT_CONFIG?.deviceMode, urlParam: new URLSearchParams(location.search).get('cihaz'), stored: storedLocal });
    if (device.persist) {
        try {
            localStorage.setItem(DEVICE_MODE_KEY, device.persist);
        }
        catch { /* storage blocked: applies to this page load only */ }
    }
    const isOperatorSession = () => { try {
        return sessionStorage.getItem(OPERATOR_FLAG_KEY) === '1';
    }
    catch {
        return false;
    } };
    let idleGuard = null;
    const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(undefined), ms))]);
    /** Ends THIS tab's session after inactivity (or because another tab of the device signed out). Local state is cleared first; audit + server sign-out are best-effort and time-boxed. */
    const endSessionIdle = async (reason) => {
        const ending = session;
        try {
            headerDispose?.();
        }
        catch { /* header not built yet */ }
        session = null;
        accessCache = null;
        saveSession(null);
        loginNotice = undefined;
        expiredHandled = true;
        if (ending) {
            try {
                await withTimeout(client.rpc('log_session_event', { p_kind: reason === 'IDLE' ? 'IDLE_SIGNOUT' : 'REMOTE_SIGNOUT', p_reason: reason }, ending), 2500);
            }
            catch { /* audit function not deployed / unreachable: the screen is closed anyway */ }
            try {
                await withTimeout(client.auth.signOut(ending), 3000);
            }
            catch { /* token may already be expired */ }
        }
        idleGuard = null;
        location.replace(`${location.pathname}${location.search}#/`);
        renderLogin(reason === 'IDLE' ? 'Hareketsizlik nedeniyle oturum kapatıldı. Kaydedilmemiş bir işlem varsa tamamlanmadı — yeniden giriş yapın.' : 'Bu cihazda oturum kapatıldı — yeniden giriş yapın.');
    };
    const ensureIdleGuard = () => {
        if (idleGuard && !idleGuard.expired())
            return;
        if (!idleGuardApplies(device.mode, isOperatorSession()))
            return;
        idleGuard = startIdleGuard({ doc: document, win: window, storage: (() => { try {
                return localStorage;
            }
            catch {
                return null;
            } })(), hasSession: () => session !== null && loadSession() !== null, onExpire: endSessionIdle });
    };
    const stopIdleGuard = (announce) => { if (announce)
        idleGuard?.announce(); idleGuard?.dispose(); idleGuard = null; };
    // Silent JWT refresh keeps the stored session current; an unrenewable session ends cleanly (once) instead of looping on 401s.
    client.onSessionRefreshed = (s) => saveSession(s);
    let expiredHandled = false;
    let loginNotice; // survives the re-render the interrupted screen may still trigger
    client.onSessionExpired = () => {
        if (expiredHandled || !session)
            return;
        expiredHandled = true;
        stopIdleGuard(false);
        try {
            headerDispose?.();
        }
        catch { /* header not built yet */ }
        session = null;
        accessCache = null;
        saveSession(null);
        location.hash = '#/';
        loginNotice = 'Oturum süresi doldu — lütfen yeniden giriş yapın.';
        renderLogin(loginNotice);
    };
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
    // MAIN LOGIN SCREEN OFFERS BOTH METHODS (owner directive): "Yetkili girişi" (account) and "Operatör girişi" (Sicil No + PIN). The operator method is visible by
    // default — nobody has to know a hidden URL or a config switch. It is hidden only if a deployment explicitly sets config.js `operatorLogin: false`.
    // When the server side (Edge Function operator-login + migration 0072) is not reachable the attempt says so plainly ("şu anda kullanılamıyor"); it never pretends.
    // Only the chosen METHOD is remembered on the device (never a sicil, never a PIN) so a shared factory terminal opens on the operator form.
    const operatorLoginEnabled = window.KMI_NEXT_CONFIG?.operatorLogin !== false;
    const LOGIN_MODE_KEY = 'kmiLoginMode';
    const rememberedMode = () => { try {
        return localStorage.getItem(LOGIN_MODE_KEY) === 'OPERATOR' ? 'OPERATOR' : 'EMAIL';
    }
    catch {
        return 'EMAIL';
    } };
    const rememberMode = (m) => { try {
        localStorage.setItem(LOGIN_MODE_KEY, m);
    }
    catch { /* storage may be blocked */ } };
    const renderLogin = (message, requestedMode = rememberedMode()) => {
        const mode = operatorLoginEnabled ? requestedMode : 'EMAIL';
        const email = h('input', { type: 'email', autocomplete: 'username', 'data-testid': 'login-email', placeholder: 'E-posta', id: 'kmi-login-email' });
        const pass = h('input', { type: 'password', autocomplete: 'current-password', 'data-testid': 'login-password', placeholder: 'Şifre', id: 'kmi-login-password' });
        const sicil = h('input', { type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next', 'data-testid': 'login-sicil', placeholder: 'Sicil no (ör. S-1001)', id: 'kmi-login-sicil' });
        const badge = h('input', { type: 'password', autocomplete: 'off', 'data-testid': 'login-badge', placeholder: 'Rozet / QR (isteğe bağlı — okutun)', id: 'kmi-login-badge' });
        const pin = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '6', autocomplete: 'off', enterkeyhint: 'go', 'data-testid': 'login-pin', placeholder: '6 haneli PIN', id: 'kmi-login-pin' });
        const submit = async (e) => {
            e.preventDefault();
            try {
                if (mode === 'OPERATOR') {
                    if (!sicil.value.trim() && !badge.value.trim())
                        throw new Error('Sicil numarası veya rozet gerekli.');
                    session = await client.auth.signInOperator({ ...(sicil.value.trim() ? { employeeNo: sicil.value.trim() } : {}), ...(badge.value.trim() ? { badge: badge.value.trim() } : {}), pin: pin.value });
                }
                else {
                    session = await client.auth.signInWithPassword(email.value.trim(), pass.value);
                }
                accessCache = null;
                expiredHandled = false;
                loginNotice = undefined;
                saveSession(session);
                try {
                    if (mode === 'OPERATOR')
                        sessionStorage.setItem(OPERATOR_FLAG_KEY, '1');
                }
                catch { /* private mode */ }
                location.hash = '#/';
                await route();
            }
            catch (err) {
                renderLogin(err instanceof Error ? `Giriş başarısız: ${err.message}` : 'Giriş başarısız', mode);
            }
        };
        const dbText = h('span', {}, 'Veritabanı bağlantısı kontrol ediliyor…');
        const dbBox = h('div', { class: 'kmi-login-db', 'data-testid': 'login-db', 'data-state': 'checking', role: 'status' }, h('i', {}), dbText);
        const tab = (m, label, tid) => h('button', { type: 'button', class: `kmi-login-tab${mode === m ? ' on' : ''}`, 'data-testid': tid, 'aria-pressed': String(mode === m), onClick: () => { rememberMode(m); renderLogin(undefined, m); } }, label);
        mount(root, h('div', {}, h('style', {}, SHELL_CSS), offlineBar(), h('div', { class: 'kmi-login', 'data-testid': 'login-screen', 'data-mode': mode }, h('div', { class: 'kmi-login-k', 'aria-hidden': 'true' }, h('div', { class: 'kspin' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' }), h('span', { class: 'glare' }))), h('form', { class: 'kmi-login-card', 'data-testid': 'login-form', onSubmit: (e) => void submit(e) }, h('div', { class: 'brand' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: 'Kurutlu' }), h('h1', {}, BRAND), h('p', { class: 'sub' }, BRAND_SUB), h('div', { class: 'rule' })), operatorLoginEnabled ? h('div', { class: 'kmi-login-tabs' }, tab('EMAIL', 'Yetkili girişi', 'login-tab-email'), tab('OPERATOR', 'Operatör: Sicil No + PIN', 'login-tab-operator')) : null, message ? h('div', { class: 'kmi-login-err', 'data-testid': 'login-error', role: 'alert' }, message) : null, ...(mode === 'OPERATOR'
            ? [h('label', { for: 'kmi-login-sicil' }, 'Sicil numarası'), sicil, h('label', { for: 'kmi-login-pin' }, 'Kişisel PIN (6 rakam)'), pin,
                h('details', { class: 'kmi-login-badge-opt' }, h('summary', {}, 'Rozet / QR ile giriş (isteğe bağlı)'), h('label', { for: 'kmi-login-badge' }, 'Rozet / QR'), badge),
                h('p', { class: 'kmi-login-hint' }, 'Rozet tek başına giriş yaptırmaz; PIN gerekir. Paylaşılan tablette işiniz bitince Çıkış yapın.')]
            : [h('label', { for: 'kmi-login-email' }, 'E-posta'), email, h('label', { for: 'kmi-login-password' }, 'Şifre'), pass]), h('button', { type: 'submit', 'data-testid': 'login-submit' }, 'Giriş'), idleGuardApplies(device.mode, mode === 'OPERATOR') ? h('p', { class: 'kmi-login-hint', 'data-testid': 'login-idle-note' }, `${device.mode === 'DESKTOP' ? 'Operatör oturumu' : device.mode === 'KIOSK' ? 'Kiosk modu' : 'Tablet modu'}: 60 saniye hareketsizlikte oturum otomatik kapanır.`) : null, dbBox))));
        // Green ONLY after a real reachability answer from the auth service; never assumed.
        void client.health().then((ok) => {
            if (!dbBox.isConnected)
                return;
            dbBox.setAttribute('data-state', ok ? 'ok' : 'fail');
            dbText.textContent = ok ? 'Veritabanı bağlantısı doğrulandı' : 'Veritabanına ulaşılamıyor — bağlantınızı kontrol edin';
        });
    };
    let headerDispose;
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
            return renderLogin(loginNotice);
        ensureIdleGuard();
        const { path, query } = parseHash(location.hash);
        const content = h('div', { 'data-testid': 'app-content' });
        const logout = async () => {
            stopIdleGuard(true);
            try {
                if (session)
                    await client.auth.signOut(session);
            }
            catch {
                /* token may already be expired — local sign-out still happens */
            }
            headerDispose?.();
            session = null;
            accessCache = null;
            saveSession(null);
            location.hash = '#/';
            renderLogin('Çıkış yapıldı.');
        };
        const crumbEl = (p) => {
            if (p === '/departman') {
                const g = NAV_TREE.find((x) => x.id === new URLSearchParams(location.hash.split('?')[1] ?? '').get('d'));
                if (!g)
                    return null;
                return h('nav', { class: 'kmi-crumb', 'aria-label': 'Konum', 'data-testid': 'app-breadcrumb' }, h('a', { href: '#/' }, 'Ana Sayfa'), h('span', { 'aria-hidden': 'true' }, '›'), h('b', { 'aria-current': 'page' }, g.title));
            }
            const bc = breadcrumbOf(p);
            if (!bc)
                return null;
            const first = NAV_TREE_FIRST[bc.workspaceId];
            return h('nav', { class: 'kmi-crumb', 'aria-label': 'Konum', 'data-testid': 'app-breadcrumb' }, h('a', { href: '#/' }, 'Ana Sayfa'), h('span', { 'aria-hidden': 'true' }, '›'), first ? h('a', { href: `#${first}`, 'data-testid': 'app-crumb-ws' }, bc.workspace) : h('span', {}, bc.workspace), h('span', { 'aria-hidden': 'true' }, '›'), h('b', { 'aria-current': 'page' }, bc.page));
        };
        const collapsed0 = readCollapsed();
        document.documentElement.style.setProperty('--kmi-side-w', collapsed0 ? '92px' : '328px');
        const navHost = h('div', { class: 'kmi-nav2', 'data-testid': 'app-nav' });
        const drawerNavHost = h('div', { class: 'kmi-nav2 kmi-dw', 'data-testid': 'app-drawer-nav' });
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
            onClick: () => { const now = !sideEl.classList.contains('collapsed'); sideEl.classList.toggle('collapsed', now); writeCollapsed(now); document.documentElement.style.setProperty('--kmi-side-w', now ? '92px' : '328px'); collBtn.setAttribute('aria-label', now ? 'Menüyü genişlet' : 'Menüyü daralt'); collBtn.replaceChildren(icon(now ? 'chevrons-right' : 'chevrons-left', 16)); } }, icon(collapsed0 ? 'chevrons-right' : 'chevrons-left', 16))), navHost);
        const collBtn = sideEl.querySelector('[data-testid="app-side-collapse"]');
        headerDispose?.();
        const header = createHeader({ brandTitle: BRAND, initialName: session.user.label ?? session.user.email ?? '', searchValue: path === '/ara' ? (query.get('q') ?? '') : '', menuBtn, onLogout: () => void logout() });
        headerDispose = header.dispose;
        mount(root, h('div', { class: 'kmi-has-bottom' }, h('style', {}, SHELL_CSS), offlineBar(), h('a', { class: 'kmi-skip', href: '#kmi-main', onClick: (e) => { e.preventDefault(); document.getElementById('kmi-main')?.focus(); } }, 'İçeriğe geç'), sideEl, drawerBack, h('div', { class: 'kmi-main' }, header.el, h('main', { class: 'kmi-content', id: 'kmi-main', tabindex: '-1' }, crumbEl(path), content)), bottomHost));
        const { value: access, failed: accessFailed } = await getAccess();
        {
            const live = canOpen('/canli', access), pulse = canOpen('/komuta', access);
            header.setChips(live, pulse);
            // real person, from the personnel record linked to this login (RLS decides); nothing invented when unlinked
            const uid = session.user.id;
            const fallbackName = session.user.label ?? session.user.email ?? '';
            header.setIdentity({ name: fallbackName, roles: access.roles });
            void client.select('personnel', { columns: 'name,department', filters: { auth_user_id: `eq.${uid}` }, limit: 1 }, session)
                .then((rows) => { if (rows[0]?.name)
                header.setIdentity({ name: rows[0].name, department: rows[0].department, roles: access.roles }); })
                .catch(() => { });
        }
        // navigation: only what this user may open (same rule as the home screen and the direct-URL guard); the server decides for real
        const treeAll = visibleNav((p) => canOpen(p, access) && ROUTES.some((x) => x.path === p && x.inMenu));
        // remembered state (per browser, never a permission): last workspace + favourites
        let navState = readNavState((() => { try {
            return localStorage;
        }
        catch {
            return null;
        } })());
        const saveNavState = () => { try {
            localStorage.setItem(NAV_STATE_KEY, JSON.stringify(navState));
        }
        catch { /* private mode */ } };
        navState = nextNavState(navState, { visit: path });
        saveNavState();
        const operatorSimple = isOperatorOnly(access.roles);
        const navGroups = operatorSimple
            ? (() => {
                const simple = simpleNav(treeAll, featuredPaths(access, treeAll.flatMap((g) => g.items.map((i) => i.path))));
                const shown = new Set(simple.flatMap((g) => g.items.map((i) => i.path)));
                return [...simple, ...treeAll.map((g) => ({ ...g, items: g.items.filter((i) => !shown.has(i.path)) })).filter((g) => g.items.length > 0)];
            })()
            : treeAll;
        const navAllPaths = treeAll.flatMap((g) => g.items.map((i) => i.path));
        const navLink = (it, testid, onNav) => {
            const a = h('a', { href: `#${it.path}`, 'data-testid': testid, 'data-path': it.path, title: it.label, ...(it.path === path ? { 'aria-current': 'page' } : {}), ...(onNav ? { onClick: onNav } : {}) }, icon(it.icon), h('span', { class: 'nl' }, it.label));
            return a;
        };
        // ---- TWO-LEVEL NAVIGATION (owner directive, Release 007): a compact rail of the 15 workspaces + a panel with the pages of the SELECTED workspace only.
        // Never 15 open groups. Favourites and recently used screens are virtual workspaces; tasks / approvals sit at the rail foot. Phones/tablets get a drawer that switches department.
        const visibleItem = (p) => treeAll.some((g) => g.items.some((x) => x.path === p));
        const favVirt = () => { const items = navState.favorites.map((p) => NAV_ITEM_BY_PATH[p]).filter((i) => !!i && visibleItem(i.path)); return items.length ? { id: 'fav', short: 'Favori', title: 'FAVORİLERİM', icon: 'badge', items } : null; };
        const recentVirt = () => { const items = navState.recent.filter((p) => p !== path).map((p) => NAV_ITEM_BY_PATH[p]).filter((i) => !!i && visibleItem(i.path)); return items.length ? { id: 'recent', short: 'Son', title: 'SON KULLANILAN', icon: 'clock', items } : null; };
        const wsList = navGroups.filter((g) => g.id !== 'fav');
        const initialWs = () => {
            const own = path === '/departman' ? new URLSearchParams(location.hash.split('?')[1] ?? '').get('d') ?? undefined : WORKSPACE_OF_PATH[path];
            if (operatorSimple && wsList[0]?.id === 'mine' && wsList[0].items.some((i) => i.path === path))
                return 'mine';
            if (own && wsList.some((g) => g.id === own))
                return own;
            if (path === '/' && navState.last && wsList.some((g) => g.id === navState.last))
                return navState.last;
            return wsList[0]?.id ?? 'pc';
        };
        let selectedWs = initialWs();
        const findWs = (id) => id === 'fav' ? favVirt() ?? undefined : id === 'recent' ? recentVirt() ?? undefined : wsList.find((g) => g.id === id);
        const quickLinks = ['/gorevler', '/onaylar'].filter((p) => visibleItem(p));
        const pickWs = (id, redraw, afterNav) => {
            const g = findWs(id);
            if (!g)
                return;
            selectedWs = id;
            if (g.items.length === 1 && id !== 'fav' && id !== 'recent' && id !== 'mine' && g.items[0].path !== '/') {
                location.hash = `#/departman?d=${id}`;
                afterNav?.();
                return;
            }
            redraw();
        };
        const wsIcon = (g) => icon(g.icon, 22);
        const fillSide = (host) => {
            const draw = () => {
                const sel = findWs(selectedWs) ?? wsList[0];
                const railBtn = (g, tid) => h('button', { type: 'button', class: 'ri', 'data-testid': tid, 'data-ws': g.id, 'aria-pressed': String(g.id === selectedWs), 'aria-label': g.title, title: g.title, onClick: () => pickWs(g.id, draw) }, wsIcon(g), h('span', { class: 'rl' }, g.short));
                const railLink = (p, tid) => { const it = NAV_ITEM_BY_PATH[p]; return h('a', { class: 'ri', href: `#${it.path}`, 'data-testid': tid, 'data-path': it.path, title: it.label, ...(it.path === path ? { 'aria-current': 'page' } : {}) }, icon(it.icon, 20), h('span', { class: 'rl' }, p === '/' ? 'Ana Sayfa' : it.label.split(' ')[0] ?? it.label)); };
                const fav = favVirt(), rec = recentVirt();
                const rail = h('nav', { class: 'kmi-rail', 'aria-label': 'Çalışma alanları', 'data-testid': 'app-rail' }, railLink('/', 'app-rail-home'), ...(fav ? [railBtn(fav, 'app-nav-special')] : []), ...(rec ? [railBtn(rec, 'app-nav-special')] : []), h('hr', {}), ...wsList.map((g) => railBtn(g, 'app-nav-group')), ...(quickLinks.length ? [h('hr', {}), ...quickLinks.map((p) => railLink(p, 'app-rail-link'))] : []));
                const panel = h('div', { class: 'kmi-panel', 'data-testid': 'app-nav-panel', 'data-ws': sel?.id ?? '' }, h('div', { class: 'ph', 'data-testid': 'app-nav-panel-title' }, sel && sel.id !== 'fav' && sel.id !== 'recent' && sel.id !== 'mine' && sel.id !== 'pc' && sel.items.some((x) => x.path !== '/') ? h('a', { href: `#/departman?d=${sel.id}`, class: 'ph-link', 'data-testid': 'app-dept-home-link', title: 'Departman ana ekranı' }, sel.title, ' ›') : (sel?.title ?? '')), ...(sel?.items ?? []).map((it) => {
                    const a = navLink(it, 'app-nav-item');
                    const on = navState.favorites.includes(it.path);
                    const star = h('button', { type: 'button', class: 'nfav', 'data-testid': 'app-nav-fav', 'data-path': it.path, 'aria-pressed': String(on), 'aria-label': on ? `${it.label} favorilerden çıkar` : `${it.label} favorilere ekle`, title: on ? 'Favoriden çıkar' : 'Favorilere ekle',
                        onClick: () => { navState = nextNavState(navState, { toggleFavorite: it.path }); saveNavState(); draw(); } }, on ? '★' : '☆');
                    return h('div', { class: 'nrow' }, a, star);
                }));
                host.replaceChildren(rail, panel);
            };
            draw();
        };
        const fillDrawer = (host) => {
            const draw = () => {
                const sel = findWs(selectedWs) ?? wsList[0];
                const fav = favVirt(), rec = recentVirt();
                const chip = (g) => h('button', { type: 'button', class: 'dws', 'data-testid': 'app-drawer-ws', 'data-ws': g.id, 'aria-pressed': String(g.id === selectedWs), onClick: () => pickWs(g.id, draw, closeDrawer) }, wsIcon(g), h('span', {}, g.short));
                host.replaceChildren(h('div', { class: 'dh', 'data-testid': 'app-drawer-title' }, sel?.title ?? ''), h('div', { class: 'dpages' }, ...(sel?.items ?? []).map((it) => navLink(it, 'app-drawer-item', closeDrawer))), h('div', { class: 'dh' }, 'DEPARTMAN DEĞİŞTİR'), h('div', { class: 'dgrid' }, ...[...(fav ? [fav] : []), ...(rec ? [rec] : []), ...wsList].map(chip)), h('div', { class: 'dquick' }, navLink(NAV_ITEM_BY_PATH['/'], 'app-drawer-quick', closeDrawer), ...quickLinks.map((p) => navLink(NAV_ITEM_BY_PATH[p], 'app-drawer-quick', closeDrawer))));
            };
            draw();
        };
        fillSide(navHost);
        fillDrawer(drawerNavHost);
        const quick = ['/', ...featuredPaths(access, navAllPaths).filter((p) => p !== '/')].slice(0, 4);
        bottomHost.replaceChildren(...quick.map((p) => navLink(NAV_ITEM_BY_PATH[p], 'app-bottom-item')), h('button', { type: 'button', 'data-testid': 'app-bottom-menu', 'aria-label': 'Tüm menü', onClick: openDrawer }, icon('menu'), 'Menü'));
        header.setShortcuts(pickShortcuts([...quick, ...navAllPaths].map((p) => ({ path: p, label: NAV_ITEM_BY_PATH[p]?.label ?? p })), (p) => canOpen(p, access) && !!NAV_ITEM_BY_PATH[p]));
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
            const homeGroups = treeAll.map((g) => ({ title: g.title, items: g.items.map((i) => open.find((x) => x.path === i.path)).filter((x) => !!x) })).filter((g) => g.items.length > 0);
            mount(content, h('div', { class: 'shell-menu kmi-home', style: 'max-width:1200px', 'data-testid': 'app-menu' }, accessFailed ? h('div', { class: 'kmi-banner warn', 'data-testid': 'app-access-failed' }, 'Yetki bilgisi alınamadı; yalnız herkese açık ekranlar gösteriliyor. Sayfayı yenileyin.') : null, h('section', { class: 'kmi-hero' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' }), h('div', {}, h('h1', {}, BRAND), h('p', {}, BRAND_SUB), access.roles.length ? h('div', { class: 'chips', 'data-testid': 'app-roles' }, h('span', { class: 'kmi-chip' }, `Rolünüz: ${access.roles.join(', ')}`), access.economics ? h('span', { class: 'kmi-chip' }, 'ekonomi yetkisi') : null) : null)), h('section', { class: 'kmi-pulse', 'data-testid': 'app-today', hidden: true }), featured.length ? h('div', { 'data-testid': 'app-featured' }, h('div', { class: 'kmi-section gold' }, 'SİZİN İÇİN'), h('div', { class: 'tiles' }, ...featured.slice(0, 6).map((x) => tile(x, 'app-featured-item', ' featured')))) : null, h('details', { 'data-testid': 'app-all', class: 'kmi-home' }, h('summary', {}, 'Tüm departmanlar ve ekranlar'), ...homeGroups.map((g) => h('div', { class: 'kmi-dept' }, h('div', { class: 'kmi-section' }, g.title), h('div', { class: 'kmi-links' }, ...g.items.map((x) => {
                const n = NAV_ITEM_BY_PATH[x.path];
                return h('a', { href: `#${x.path}`, class: 'kmi-link', 'data-testid': 'app-menu-item', 'data-path': x.path }, icon(n?.icon ?? 'grid', 16), n?.label ?? x.label);
            })))))));
            // KOKPİT (KMI-HOME-001): role-adaptive cards from the canonical command_center snapshot (+ commercial_approvals counts for accounting).
            void (async () => {
                const host = content.querySelector('[data-testid="app-today"]');
                if (!host)
                    return;
                let snapshot = null;
                let failed = false;
                try {
                    snapshot = await createCommandCenterApi(client, session).snapshot();
                }
                catch {
                    failed = true;
                }
                const homeAccess = { roles: access.roles, economics: access.economics, owner: access.owner, actions: access.actions };
                const needed = homeCardsFor(homeAccess).filter((c) => c.source.kind === 'extra').map((c) => c.source.key);
                const extras = await loadExtras(client, session, needed, new Date().toISOString());
                renderCockpit(host, { snapshot, extras, access: homeAccess, nowMs: Date.now(), failed });
                // Factory state (machine park, shifts, OEE, risks, departments) lives ONLY in the Performance Center — Home links to it instead of repeating it.
                if (canOpen('/komuta', access))
                    host.append(h('a', { href: '#/komuta', class: 'kmi-link', 'data-testid': 'home-pc-link', style: 'display:inline-block;margin-top:14px' }, 'Fabrikanın tamamı: Performance Center →'));
            })();
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
            await r.render(content, client, session, query, access);
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
