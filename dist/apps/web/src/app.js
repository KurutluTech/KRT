// KMI NEXT — application shell (PWA): login, hash router, navigation, service worker.
// No framework, no bundler (docs/ARCHITECTURE.md). Every screen gets its real adapter over the
// data-client; authorization is decided by the server on every call, the menu only navigates.
// Configuration comes from /config.js (window.KMI_NEXT_CONFIG = { supabaseUrl, anonKey }),
// which is deployment-specific and NOT committed (config.example.js shows the shape).
import { h, mount } from '../../../packages/ui/src/h.js';
import { createKmiNextClient } from '../../../packages/data-client/src/client.js';
import { renderTerminalScreen, rememberedMachine, remember as rememberMachine } from './screens/TerminalScreen.js';
import { canOpen, featuredPaths, landingPath, NO_ACCESS } from './access.js';
import { renderCustomersScreen } from './screens/CustomersScreen.js';
import { renderQuotesScreen } from './screens/QuotesScreen.js';
import { createQuotesApi } from './quotesApi.js';
import { renderOrderCommandScreen } from './screens/OrderCommandScreen.js';
import { createOrderCommandApi } from './orderCommandApi.js';
import { renderProductMasterScreen } from './screens/ProductMasterScreen.js';
import { createProductMasterApi } from './productMasterApi.js';
import { adoptSiblingRefresh, expiryAppliesTo } from './sessionSync.js';
import { renderProductWorkspaceScreen } from './screens/ProductWorkspaceScreen.js';
import { createProductWorkspaceApi, jobCardFor, scanCheck } from './productWorkspaceApi.js';
import { renderJobCardScreen } from './screens/JobCardScreen.js';
import { renderDocumentControlScreen } from './screens/DocumentControlScreen.js';
import { createDocumentControlApi } from './documentControlApi.js';
import { createCustomersApi } from './customersApi.js';
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
import { renderNoticesScreen } from './screens/NoticesScreen.js';
import { createOperatorHomeApi } from './operatorHomeApi.js';
import { createTerminalApi } from './terminalApi.js';
import { withCockpit, liveCockpitSources } from './screens/DepartmentCockpit.js';
import { FUNCTION_STATE_TR, resolveFunctions, functionMaturity, liveLabelTr } from '../../../packages/domain/src/departmentFunctions.js';
import { renderDepartmentHome } from './screens/DepartmentHomeScreen.js';
import { renderFeasibilityScreen } from './screens/FeasibilityScreen.js';
import { createFeasibilityApi } from './feasibilityApi.js';
import { renderQualityDesk } from './screens/QualityDeskScreen.js';
import { renderDemandPanel } from './screens/DemandPanel.js';
import { renderProductionDesk } from './screens/ProductionDeskScreen.js';
import { createProductionDeskApi } from './productionDeskApi.js';
import { createQualityDeskApi } from './qualityDeskApi.js';
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
import { renderPermissionAdminScreen } from './screens/PermissionAdminScreen.js';
import { createPermissionAdminApi } from './permissionAdminApi.js';
import { renderOrderImportScreen } from './screens/OrderImportScreen.js';
import { createOrderImportApi } from './orderImportApi.js';
import { renderEntityGalleryScreen } from './screens/EntityGalleryScreen.js';
import { renderPassportWorkspaceScreen } from './screens/PassportWorkspaceScreen.js';
import { renderPassportHubScreen } from './screens/PassportHubScreen.js';
import { createPassportCardsApi } from './passportCardsApi.js';
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
import { renderApprovalsScreen } from './screens/ApprovalsScreen.js';
import { countGates, sourcesFor } from '../../../packages/domain/src/approvalWorkspace.js';
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
import { renderHistorySearchScreen, historyStateFromQuery } from './screens/HistorySearchScreen.js';
import { createHistoryApi } from './historyApi.js';
import { createHeader, pickShortcuts } from './header.js';
import { renderCockpit } from './homeCockpit.js';
import { OBJECT_CARD_CSS } from './objectCard.js';
import { renderHomeShow, showsFleet, HOME_SHOW_CSS } from './homeShow.js';
import { createHomeLoader } from './homeLoader.js';
import { createHomePrefsApi } from './homePrefsApi.js';
import { applyOrder, moveSection, orderStorageKey } from '../../../packages/domain/src/smartHome.js';
import { SPINDLE_CSS } from './spindle.js';
import { MACHINE_CARD_CSS } from './machineCard.js';
import { loadExtras } from './homeData.js';
import { homeCardsFor } from '../../../packages/domain/src/homeLayout.js';
import { startIdleGuard } from './idleGuard.js';
import { createUxTelemetry, errorClassOf, routeKey } from '../../../packages/domain/src/uxTelemetry.js';
import { IDLE_LIMIT_MS, deviceProfile, idleGuardApplies, resolveDeviceMode } from '../../../packages/domain/src/idleSession.js';
import { NAV_TREE, NAV_ITEM_BY_PATH, breadcrumbOf, trTitle, NAV_STATE_KEY, iconSvg, isOperatorOnly, nextNavState, readNavState, simpleNav, visibleNav, visibleGates, gateOfPath, gateOfWorkspace } from './nav.js';
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
function galleryDeps(c, s, withBoard = false) {
    const pc = createPassportCardsApi(c, s);
    const activeWork = async () => {
        const rows = await c.select('work_orders', { columns: 'operator_id', filters: { status: 'in.(IN_PROGRESS,FIRST_PIECE_PENDING,FIRST_PIECE_APPROVED)' }, limit: 1000 }, s);
        const m = {};
        for (const r of rows)
            if (r.operatorId)
                m[r.operatorId] = (m[r.operatorId] ?? 0) + 1;
        return m;
    };
    return { faces: (t) => pc.faces(t), content: (v) => pc.content(v), activeWork, ...(withBoard ? { board: () => createLiveApi(c, s).board('OFFICE') } : {}) };
}
export const ROUTES = [
    {
        // KMI-CARD-004: the ONE digital-passport hub for every card family (?t=<KIND>&id=<id>&s=<topic>). /nesne (classic object page) and /pasaport-calisma (classic store page) stay reachable.
        path: '/kart', label: 'Dijital pasaport', group: 'Saha', inMenu: false, needs: ['t', 'id'],
        render: (el, c, s, q, access) => renderPassportHubScreen(el, { client: c, session: s, access, myUserId: s?.user.id ?? null, trace: createTraceMounter(createPassportApi(c, s), (href) => { location.hash = href; }) }, { kind: q.get('t'), id: q.get('id'), topic: q.get('s') }),
    },
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
    { path: '/gecmis', label: 'Olay geçmişi (zaman araması)', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => renderHistorySearchScreen(el, createHistoryApi(c, s), { access: a, nowIso: new Date().toISOString(), state: historyStateFromQuery(q) }) },
    { path: '/ara', label: 'Arama', group: 'Saha', inMenu: false, render: (el, c, s, q, a) => renderSearchScreen(el, createSearchApi(c, s), q.get('q') ?? '', { access: a, filters: { types: (q.get('f') ?? '').split(',').filter(Boolean), from: q.get('from'), to: q.get('to'), status: q.get('s') } }) },
    {
        path: '/gorevler', label: 'Görevlerim', group: 'Saha', inMenu: true,
        // ?kaynak=WORK_ORDER&id=<uuid> pre-links a new task to an existing record
        render: (el, c, s, q) => renderTaskFloorScreen(el, createTaskFloorApi(c, s), { ...(q.get('kaynak') && q.get('id') ? { prefill: { sourceType: q.get('kaynak'), sourceId: q.get('id') } } : {}), ...(q.get('t') ? { focus: q.get('t'), ...(q.get('via') === 'qr' ? { viaQr: true } : {}) } : {}) }),
    },
    {
        path: '/operator', label: 'Benim İşlerim (operatör)', group: 'Saha', inMenu: true,
        render: (el, c, s) => renderOperatorHomeScreen(el, createOperatorHomeApi(c, s), {
            openTerminal: (machineId) => { rememberMachine(machineId); location.hash = '#/terminal'; }, goTasks: () => { location.hash = '#/gorevler'; }
        }),
    },
    { path: '/terminal', label: 'Makine Terminali', group: 'Saha', inMenu: true, render: (el, c, s) => renderTerminalScreen(el, createTerminalApi(c, s), { machineId: rememberedMachine() }, { icon: (n, z) => icon(n, z) }) },
    {
        path: '/is-emirleri', label: 'İş Emirleri (üretim · kalite · stok · sevkiyat)', group: 'Saha', inMenu: true,
        render: (el, c, s, q) => renderWorkOrderHubScreen(el, { hub: createWorkOrderHubApi(c, s), workOrders: createWorkOrdersApi(c, s), production: createProductionApi(c, s),
            stock: createStockApi(c, s), shipment: createShipmentApi(c, s), commercial: createCommercialApprovalApi(c, s) }, { wo: q.get('wo'), lot: q.get('lot') }),
    },
    { path: '/muhasebe', label: 'Muhasebe / Fatura (kalem)', group: 'Yönetim', inMenu: false, needs: ['kalem'], render: (el, c, s, q) => renderAccountingScreen(el, q.get('kalem') ?? '', createAccountingApi(c, s)) },
    { path: '/tara', label: 'QR / Barkod Okut', group: 'Saha', inMenu: true, render: (el, c, s, q, a) => renderScanScreen(el, createScanApi(c, s), undefined, { code: q.get('kod'), access: a }) },
    { path: '/dokuman-kontrol', label: 'Doküman Kontrol (sürüm · onay · geçerlilik)', group: 'Yönetim', inMenu: true, render: (el, c, s, q) => renderDocumentControlScreen(el, createDocumentControlApi(c, s), { doc: q.get('doc'), q: q.get('ara') ?? undefined }) },
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
    { path: '/kalite', label: 'Kalite Masası (karar kuyruğu)', group: 'Saha', inMenu: true, render: (el, c, s, q, a) => renderQualityDesk(el, createQualityDeskApi(c, s), { can: (x) => a.actions.includes(x), initialKind: q.get('k') }) },
    { path: '/sevkiyat', label: 'Sevkiyat / Lojistik', group: 'Saha', inMenu: true, render: (el, c, s) => renderDepartmentScreen(el, createDepartmentApi(c, s, createWorkOrderHubApi(c, s)), 'SEVKIYAT') },
    { path: '/depo', label: 'Depo / Stok / Malzeme', group: 'Satınalma / Depo', inMenu: true, render: (el, c, s) => renderDepartmentScreen(el, createDepartmentApi(c, s, createWorkOrderHubApi(c, s)), 'DEPO') },
    { path: '/takimhane', label: 'Takımhane', group: 'Saha', inMenu: true, render: (el, c, s) => renderToolroomScreen(el, { api: createToolroomApi(c, s) }) },
    { path: '/komuta', label: 'Performance Center', group: 'Yönetim', inMenu: true, render: (el, c, s, q) => renderPerformanceCenter(el, createPerformanceCenterSources(c, s), { today: istanbulToday(), dept: q.get('birim'), refreshMs: 60_000 }) },
    { path: '/rota', label: 'Rota / Operasyonlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderRoutingScreen(el, createRoutingApi(c, s)) },
    { path: '/planlama', label: 'Üretim Planlama', group: 'Yönetim', inMenu: true, render: async (el, c, s) => {
            const top = h('div', { 'data-testid': 'plan-demand-host' });
            const rest = h('div', {});
            mount(el, h('div', {}, top, rest));
            void renderDemandPanel(top, createOrdersApi(c, s), createWorkOrderHubApi(c, s), istanbulToday(), () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
            await renderPlanningScreen(rest, createPlanningApi(c, s), { today: istanbulToday(), days: 5 });
        } },
    { path: '/oee', label: 'OEE / KPI', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOeeScreen(el, createOeeApi(c, s), { from: addDays(istanbulToday(), -6), to: istanbulToday(), group: 'MACHINE' }) },
    { path: '/raporlar', label: 'Raporlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderReportsScreen(el, createReportsApi(c, s)) },
    { path: '/cihazlar', label: 'Cihaz entegrasyonları (kanıt bekliyor)', group: 'Diğer', inMenu: true, render: (el, c, s) => renderDevicesScreen(el, createDevicesApi(c, s)) },
    { path: '/zeka', label: 'KMI Zekâ — sor, sıradaki adımlar', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderIntelligenceScreen(el, createIntelligenceApi(c, s), { today: istanbulToday() }) },
    { path: '/canli', label: 'KMI LIVE — fabrika ekranı', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderLiveScreen(el, createLiveApi(c, s), { mode: 'APP' }) },
    { path: '/onay-kuyrugu', label: 'Muhasebe Kuyruğu (ticari onay)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderAccountingQueueScreen(el, createAccountingQueueApi(c, s)) },
    { path: '/alacaklar', label: 'Alacaklar & Vade', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderReceivablesScreen(el, createReceivablesApi(c, s), { today: istanbulToday() }) },
    { path: '/tahsis', label: 'TAHSİS (ölçü düzeltme)', group: 'Saha', inMenu: true, render: (el, c, s) => renderTahsisScreen(el, createTahsisApi(c, s)) },
    { path: '/uretim', label: 'Üretim Masası (makine parkı ve işler)', group: 'Saha', inMenu: true, render: (el, c, s) => renderProductionDesk(el, createProductionDeskApi(c, s)) },
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
            return renderDepartmentHome(el, { canOpen: (p) => canOpen(p, a), icon, view: ['ozet', 'kayit', 'analitik'].find((v) => v === q.get('v')), group: g, items, src: liveCockpitSources(c, s), nowIso: new Date().toISOString(), showSystemStatus: a.roles.includes('MANAGEMENT') });
        } },
    { path: '/bildirimler', label: 'Bildirimler', group: 'Yönetim', inMenu: true, render: (el, c, s, _q, a) => renderNoticesScreen(el, { icon: (n, z) => icon(n, z), sources: {
                alerts: async () => (await createCommandCenterApi(c, s).snapshot()).alerts,
                approvals: async () => (canOpen('/onaylar', a) ? (await createApprovalsInboxApi(c, s, { includeTasks: sourcesFor(new Set(a.actions)).tasks, sources: sourcesFor(new Set(a.actions)), light: true }).load()).items : []), // not an approver: not applicable (never an error banner)
                tasks: async () => (await createTaskFloorApi(c, s).floor('MINE')).manual
            } }) },
    { path: '/onaylar', label: 'Onaylarım', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => {
            // KMI-004: one decision list over the canonical sources. Only the sources the person may decide on are read; quality gates (first piece / HOLD) are listed but decided at their own screen.
            const held = a.actions;
            const src = sourcesFor(new Set(held));
            const tf = createTaskFloorApi(c, s);
            const hasGate = held.includes('FIRST_PIECE_APPROVE') || held.includes('QUALITY_HOLD_RELEASE');
            const view = ['PENDING', 'CRITICAL', 'OVERDUE', 'DONE'].find((v) => v === q.get('v'));
            return renderApprovalsScreen(el, {
                api: createApprovalsInboxApi(c, s, { includeTasks: src.tasks, sources: { commercial: src.commercial, requests: src.requests, orders: src.orders } }), held,
                ...(hasGate ? { gates: async () => (await tf.floor('MINE')).derived.map((d) => ({ sourceType: d.sourceType, sourceId: d.sourceId, title: d.title, status: d.status, due: d.due ?? null, route: d.route ?? null })) } : {}),
                ...(src.tasks ? { taskDetail: { history: (id) => tf.history(id), evidence: (id) => tf.evidence(id), content: (v) => tf.evidenceContent(v) } } : {}),
            }, { ...(q.get('k') ? { focus: q.get('k') } : {}), ...(view ? { view } : {}) });
        } },
    { path: '/yonetim', label: 'Yönetim Zekâsı (onaylar ve üst yönetim)', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => renderManagementScreen(el, managementDeps(c, s, a), { tab: q.get('sekme') }) },
    { path: '/maliyet', label: 'Maliyet Zekâsı (yalnız ekonomik erişim)', group: 'Yönetim', inMenu: true, render: (el, c, s, q, a) => renderCostIntelligenceScreen(el, q.get('sekme') ?? 'live', { api: createCostOpsApi(c, s), access: a, today: istanbulToday(), nowMs: Date.now(), openTab: (t) => { location.hash = `#/maliyet?sekme=${t}`; }, download: downloadText }) },
    { path: '/ekonomi', label: 'Ekonomi & Kararlar (yalnız sahip)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEconomicsScreen(el, createEconomicsApi(c, s), { from: addDays(istanbulToday(), -89), to: istanbulToday(), today: istanbulToday() }) },
    { path: '/ekonomi-basvuru', label: 'Ekonomik sahiplik başvurusu', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOwnerApplicationScreen(el, createEconomicsApi(c, s)) },
    { path: '/giris-cikis', label: 'Giriş-Çıkış (GEÇKO)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderGeckoScreen(el, createGeckoApi(c, s)) },
    { path: '/yetkinlik-aktarim', label: 'Yetkinlik geçmişi aktarımı', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderCompetencyImportScreen(el, createCompetencyImportApi(c, s)) },
    { path: '/akademi', label: 'Akademi & Yetkinlik', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderAcademyScreen(el, createAcademyApi(c, s)) },
    { path: '/fizibilite', label: 'Teknik Fizibilite (parça · malzeme · üretilebilirlik)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderFeasibilityScreen(el, createFeasibilityApi(c, s)) },
    { path: '/teklifler', label: 'Teklifler (talep · fizibilite · teklif · onay)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderQuotesScreen(el, createQuotesApi(c, s)) },
    { path: '/musteriler', label: 'Müşteriler (kartlar)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEntityGalleryScreen(el, galleryDeps(c, s), { kind: 'CUSTOMER', listHref: '#/musteriler-liste', listLabel: 'Kişiler · şartlar · teslimat (liste)' }) },
    { path: '/musteriler-liste', label: 'Müşteriler (kişiler · şartlar · teslimat)', group: 'Yönetim', inMenu: false, render: (el, c, s) => renderCustomersScreen(el, createCustomersApi(c, s)) },
    { path: '/makineler', label: 'Makineler (kartlar)', group: 'Saha', inMenu: true, render: (el, c, s) => renderEntityGalleryScreen(el, galleryDeps(c, s, true), { kind: 'MACHINE' }) },
    { path: '/tedarikciler', label: 'Tedarikçiler (kartlar)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEntityGalleryScreen(el, galleryDeps(c, s), { kind: 'SUPPLIER', listHref: '#/katalog', listLabel: 'Katalog (liste)' }) },
    { path: '/takim-kartlari', label: 'Takım kartları', group: 'Saha', inMenu: true, render: (el, c, s) => renderEntityGalleryScreen(el, galleryDeps(c, s), { kind: 'TOOL', listHref: '#/takimhane', listLabel: 'Takım Odası (işlemler)' }) },
    { path: '/olcum-ekipmani', label: 'Ölçüm ekipmanı (kartlar)', group: 'Saha', inMenu: true, render: (el, c, s) => renderEntityGalleryScreen(el, galleryDeps(c, s), { kind: 'MEASUREMENT', listHref: '#/kalite', listLabel: 'Kalite / Metroloji' }) },
    { path: '/siparis-komuta', label: 'Sipariş Komuta Merkezi', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOrderCommandScreen(el, createOrderCommandApi(c, s)) },
    { path: '/siparisler', label: 'Siparişler', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderOrdersScreen(el, createOrdersApi(c, s)) },
    { path: '/pdf-siparis', label: 'PDF’ten Sipariş', group: 'Yönetim', inMenu: true, render: (el, c, s, q) => renderOrderImportScreen(el, createOrderImportApi(c, s), { id: q.get('id') }) },
    { path: '/yetki-yonetimi', label: 'Yetki Yönetimi (sahipler · izinler)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderPermissionAdminScreen(el, createPermissionAdminApi(c, s)) },
    { path: '/pasaport-calisma', label: 'Pasaport çalışma alanı', group: 'Yönetim', inMenu: false, needs: ['tur', 'id'], render: (el, c, s, q) => renderPassportWorkspaceScreen(el, createPassportCardsApi(c, s), { type: q.get('tur'), id: q.get('id') }) },
    { path: '/urun-calisma', label: 'Ürün Çalışma Alanı (rota & operasyon)', group: 'Yönetim', inMenu: true, render: (el, c, s, q) => renderProductWorkspaceScreen(el, createProductWorkspaceApi(c, s), { product: q.get('urun'), rev: q.get('rev') }) },
    { path: '/is-karti', label: 'İş kartı (operasyon belgeleri)', group: 'Saha', inMenu: false, render: (el, c, s, q) => renderJobCardScreen(el, { load: (wo) => jobCardFor(c, s, wo), scan: (input, wo) => scanCheck(c, s, input, wo) }, q.get('is')) },
    { path: '/urun-master', label: 'Ürün Master / Digital DNA', group: 'Yönetim', inMenu: true, render: (el, c, s, q) => (q.get('urun') ? renderProductMasterScreen(el, createProductMasterApi(c, s), { product: q.get('urun'), tab: q.get('sekme') ?? undefined })
            : renderEntityGalleryScreen(el, galleryDeps(c, s), { kind: 'PRODUCT', listHref: '#/urun-liste', listLabel: 'Ürün Master listesi (tablo)' })) },
    { path: '/urun-liste', label: 'Ürün Master listesi', group: 'Yönetim', inMenu: false, render: (el, c, s) => renderProductMasterScreen(el, createProductMasterApi(c, s), { product: null, tab: undefined }) },
    { path: '/muhendislik', label: 'Ürün mühendisliği (revizyon · reçete · CAM)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEngineeringScreen(el, createEngineeringApi(c, s)) },
    { path: '/katalog', label: 'Katalog (müşteri · tedarikçi · ürün)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderCatalogScreen(el, createCatalogApi(c, s)) },
    { path: '/ana-veri-aktarim', label: 'Ana veri aktarımı (eski KMI)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderMasterImportScreen(el, createMasterImportApi(c, s)) },
    { path: '/personel', label: 'Personel (kartlar)', group: 'Yönetim', inMenu: true, render: (el, c, s) => renderEntityGalleryScreen(el, galleryDeps(c, s), { kind: 'PERSONNEL', listHref: '#/personel-liste', listLabel: 'Personel yönetimi (liste)' }) },
    { path: '/personel-liste', label: 'Personel yönetimi', group: 'Yönetim', inMenu: false, render: (el, c, s) => renderPersonnelScreen(el, { api: createPersonnelApi(c, s) }) },
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
    if (!cockpit || r.path === '/kalite')
        continue; // the Quality Desk carries its own counts (no second KPI band above it)
    const inner = r.render;
    r.render = (el, c, s, q, a) => (q.get('wo') || q.get('lot') ? inner(el, c, s, q, a) : withCockpit(el, cockpit, liveCockpitSources(c, s), new Date().toISOString(), (host) => inner(host, c, s, q, a)));
}
export function parseHash(hash) {
    const raw = hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { path: path || '/', query: new URLSearchParams(qs ?? '') };
}
/** Weak devices (≤2 cores or ≤2 GB) get the still K — no animation, same picture. */
/** the panel lists only the latest few recent screens (the stored history can be longer); the section must not push the real menu down */
const RECENT_SHOWN = 3;
const lowPowerDevice = () => { try {
    const n = navigator;
    return (n.hardwareConcurrency ?? 8) <= 2 || (n.deviceMemory ?? 8) <= 2;
}
catch {
    return false;
} };
const SHELL_CSS = THEME_CSS + SPINDLE_CSS + MACHINE_CARD_CSS + OBJECT_CARD_CSS + HOME_SHOW_CSS + `
.shell-menu{padding:16px;max-width:820px;margin:0 auto}
.shell-menu a{color:#67e8f9;font-weight:700}
.offline{background:rgba(245,158,11,.16);color:#fcd34d;padding:8px 16px;font-weight:700;position:sticky;top:0;z-index:50}
`;
const BRAND = 'KURUTLU MANUFACTURING INTELLIGENCE';
const BRAND_SUB = 'Paperless Factory · Performance Center';
const icon = (name, size = 20) => { const el = document.createElement('span'); el.className = 'ic'; el.innerHTML = iconSvg(name, size); return el; };
// default = collapsed icon rail (more room for the work area); the owner's explicit choice ('0' = expanded) is remembered
const readCollapsed = () => { try {
    return localStorage.getItem('kmiSidebarCollapsed') !== '0';
}
catch {
    return true;
} };
let sidePeek = false; // flyout state survives a shell rebuild (e.g. after starring a page)
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
    // KMI-001 §001.7: anonymous technical usability measurements (route key, latency bucket, error class, device class) — no identity, nothing leaves the browser (no sink configured).
    const ux = createUxTelemetry();
    // privacy: an unknown/typed route is never echoed into telemetry (it could hold a name); only routes from the route table are keyed
    const knownHash = () => { const k = routeKey(location.hash); return k === '/' || ROUTES.some((x) => x.path === k || k.startsWith(`${x.path}/`)) ? location.hash : '#/?'; };
    client.onRequestFailed = ({ status }) => ux.record({ kind: 'ACTION_FAILED', route: knownHash(), errorClass: errorClassOf(status) });
    window.KMI_UX = { snapshot: () => ux.snapshot() };
    document.addEventListener('pointerdown', (e) => { if (!e.isTrusted)
        return; const t0 = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => ux.record({ kind: 'INTERACTION_LATENCY', route: knownHash(), ms: performance.now() - t0 }))); }, { passive: true });
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
    let deviceReported = false;
    let deviceApply = null; // set by the shell render; ONE resize listener for the whole page (not one per render)
    window.addEventListener('resize', () => deviceApply?.(), { passive: true });
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
    // P0 session stability: tabs that hold the SAME refresh token (a duplicated tab copies sessionStorage) tell each other about the rotation (same origin, in memory only).
    let syncBus = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            syncBus = new BroadcastChannel('kmi-session-sync');
            syncBus.onmessage = (e) => { if (adoptSiblingRefresh(session, e.data))
                saveSession(session); };
        }
    }
    catch {
        syncBus = null;
    }
    client.onSessionRefreshed = (s, prev) => { saveSession(s); try {
        syncBus?.postMessage({ prev, session: s });
    }
    catch { /* channel closed */ } };
    let expiredHandled = false;
    let loginNotice; // survives the re-render the interrupted screen may still trigger
    client.onSessionExpired = (failed) => {
        if (!expiryAppliesTo(session, failed))
            return; // a straggler request of an OLD session must not end the current one
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
    // When the server side (Edge Function badge-login, 4 haneli PIN) is not reachable the attempt says so plainly ("şu anda kullanılamıyor"); it never pretends.
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
    const renderLogin = (message, requestedMode = rememberedMode(), kind = 'info') => {
        const mode = operatorLoginEnabled ? requestedMode : 'EMAIL';
        const email = h('input', { type: 'email', autocomplete: 'username', 'data-testid': 'login-email', placeholder: 'E-posta', id: 'kmi-login-email' });
        const pass = h('input', { type: 'password', autocomplete: 'current-password', 'data-testid': 'login-password', placeholder: 'Şifre', id: 'kmi-login-password' });
        const sicil = h('input', { type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next', 'data-testid': 'login-sicil', placeholder: 'Sicil no (ör. S-1001)', id: 'kmi-login-sicil' });
        const pin = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', autocomplete: 'off', enterkeyhint: 'go', 'data-testid': 'login-pin', placeholder: '4 haneli PIN', id: 'kmi-login-pin' });
        const submit = async (e) => {
            e.preventDefault();
            try {
                if (mode === 'OPERATOR') {
                    if (!sicil.value.trim())
                        throw new Error('Sicil numarası gerekli.');
                    session = await client.auth.signInOperator({ employeeNo: sicil.value.trim(), pin: pin.value });
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
                // setting a different hash already fires `hashchange` → route(); calling route() as well rendered the first screen twice (and read every source twice)
                const hashWillChange = location.hash !== '#/';
                location.hash = '#/';
                if (!hashWillChange)
                    await route();
            }
            catch (err) {
                renderLogin(err instanceof Error ? `Giriş başarısız: ${err.message}` : 'Giriş başarısız', mode, 'error');
            }
        };
        const dbText = h('span', {}, 'Veritabanı bağlantısı kontrol ediliyor…');
        const dbBox = h('div', { class: 'kmi-login-db', 'data-testid': 'login-db', 'data-state': 'checking', role: 'status' }, h('i', {}), dbText);
        const tab = (m, label, tid) => h('button', { type: 'button', class: `kmi-login-tab${mode === m ? ' on' : ''}`, 'data-testid': tid, 'aria-pressed': String(mode === m), onClick: () => { rememberMode(m); renderLogin(undefined, m); } }, label);
        mount(root, h('div', {}, h('style', {}, SHELL_CSS), offlineBar(), h('div', { class: 'kmi-login', 'data-testid': 'login-screen', 'data-mode': mode, ...(lowPowerDevice() ? { 'data-lowpower': '' } : {}) }, h('div', { class: 'kmi-login-bg', 'aria-hidden': 'true' }, h('div', { class: 'kmi-login-k', 'data-testid': 'login-k' }, h('div', { class: 'kbody' }))), h('form', { class: 'kmi-login-card', 'data-testid': 'login-form', onSubmit: (e) => void submit(e) }, h('div', { class: 'brand' }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: 'Kurutlu' }), h('h1', {}, BRAND), h('p', { class: 'sub' }, BRAND_SUB), h('div', { class: 'rule' })), operatorLoginEnabled ? h('div', { class: 'kmi-login-tabs' }, tab('EMAIL', 'Yetkili girişi', 'login-tab-email'), tab('OPERATOR', 'Operatör: Sicil No + PIN', 'login-tab-operator')) : null, message ? (kind === 'error' ? h('div', { class: 'kmi-login-err', 'data-testid': 'login-error', role: 'alert' }, message) : h('div', { class: 'kmi-login-note', 'data-testid': 'login-notice', role: 'status' }, message)) : null, ...(mode === 'OPERATOR'
            ? [h('label', { for: 'kmi-login-sicil' }, 'Sicil numarası'), sicil, h('label', { for: 'kmi-login-pin' }, 'Kişisel PIN (4 rakam)'), pin,
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
        const routeStart = performance.now();
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
                return h('nav', { class: 'kmi-crumb', 'aria-label': 'Konum', 'data-testid': 'app-breadcrumb' }, h('a', { href: '#/' }, 'Ana Sayfa'), h('span', { 'aria-hidden': 'true' }, '›'), h('b', { 'aria-current': 'page' }, trTitle(g.title)));
            }
            const bc = breadcrumbOf(p);
            if (!bc)
                return null;
            const first = NAV_TREE_FIRST[bc.workspaceId];
            return h('nav', { class: 'kmi-crumb', 'aria-label': 'Konum', 'data-testid': 'app-breadcrumb' }, h('a', { href: '#/' }, 'Ana Sayfa'), h('span', { 'aria-hidden': 'true' }, '›'), ...(!bc.workspace || bc.workspace.toLowerCase() === bc.page.toLowerCase() ? [] : [first ? h('a', { href: `#${first}`, 'data-testid': 'app-crumb-ws' }, trTitle(bc.workspace)) : h('span', {}, trTitle(bc.workspace)), h('span', { 'aria-hidden': 'true' }, '›')]), h('b', { 'aria-current': 'page' }, bc.page));
        };
        const collapsed0 = readCollapsed();
        document.documentElement.style.setProperty('--kmi-side-w', collapsed0 ? '84px' : '300px');
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
        const sideEl = h('aside', { class: `kmi-side${collapsed0 ? ' collapsed' : ''}${collapsed0 && sidePeek ? ' peek' : ''}`, 'data-testid': 'app-sidebar', 'aria-label': 'Ana gezinme' }, h('div', { class: 'kmi-side-head' }, h('a', { class: 'b', href: '#/', 'data-testid': 'app-side-home', title: BRAND }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: 'Kurutlu' }), h('span', { class: 't' }, h('i', {}, 'KURUTLU'), h('b', {}, 'Performance Center'))), h('button', { type: 'button', class: 'kmi-side-collapse', 'data-testid': 'app-side-collapse', 'aria-label': collapsed0 ? 'Menüyü genişlet' : 'Menüyü daralt', title: collapsed0 ? 'Genişlet' : 'Daralt',
            onClick: () => { const now = !sideEl.classList.contains('collapsed'); sideEl.classList.toggle('collapsed', now); writeCollapsed(now); document.documentElement.style.setProperty('--kmi-side-w', now ? '84px' : '300px'); collBtn.setAttribute('aria-label', now ? 'Menüyü genişlet' : 'Menüyü daralt'); collBtn.replaceChildren(icon(now ? 'chevrons-right' : 'chevrons-left', 16)); } }, icon(collapsed0 ? 'chevrons-right' : 'chevrons-left', 16))), navHost);
        const collBtn = sideEl.querySelector('[data-testid="app-side-collapse"]');
        // collapsed rail: a gate click opens the page list as a flyout (peek); it closes on outside click, Escape or after choosing a page
        const closePeek = () => { sidePeek = false; sideEl.classList.remove('peek'); };
        document.addEventListener('click', (e) => { const t = e.target; if (!sideEl.classList.contains('peek'))
            return; if (!e.composedPath().includes(sideEl) || t?.closest('.kmi-panel a'))
            closePeek(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape')
            closePeek(); });
        headerDispose?.();
        const header = createHeader({ brandTitle: BRAND, initialName: session.user.label ?? session.user.email ?? '', searchValue: path === '/ara' ? (query.get('q') ?? '') : '', menuBtn, onLogout: () => void logout() });
        headerDispose = header.dispose;
        // KMI-001 §001.3: device experience — policy (config/setup link/operator session) is separate from the physical form factor; tablets/kiosks/operator terminals show who is signed in + a big safe sign-out.
        const applyDevice = () => {
            const p = deviceProfile(device.mode, window.innerWidth, isOperatorSession());
            const ds = document.documentElement.dataset;
            ds['kmiDevice'] = p.mode.toLowerCase();
            ds['kmiForm'] = p.form;
            ds['kmiTouch'] = p.touchFirst ? '1' : '0';
            document.documentElement.style.setProperty('--kmi-target', `${p.minTargetPx}px`);
            deviceStrip.hidden = !p.showIdentityStrip;
            if (!deviceReported) {
                deviceReported = true;
                ux.record({ kind: 'DEVICE_CLASS', route: '#/', device: { mode: p.mode, form: p.form } });
            }
            stripLabel.textContent = p.mode === 'KIOSK' ? 'KIOSK' : p.mode === 'TABLET' ? 'TABLET' : 'OPERATÖR TERMİNALİ';
            stripNote.textContent = p.idleSignOut ? `${IDLE_LIMIT_MS / 1000} sn hareketsizlikte oturum otomatik kapanır` : 'Otomatik çıkış bu cihazda kapalı';
        };
        const stripLabel = h('b', { class: 'dv-mode', 'data-testid': 'device-mode' }, '');
        const stripName = h('span', { class: 'dv-name', 'data-testid': 'device-identity' }, session.user.label ?? session.user.email ?? '');
        const stripNote = h('span', { class: 'dv-note', 'data-testid': 'device-idle-note' }, '');
        const deviceStrip = h('div', { class: 'kmi-device', 'data-testid': 'device-strip', role: 'status', hidden: true }, stripLabel, h('span', { class: 'dv-who' }, icon('user', 18), stripName), stripNote, h('button', { type: 'button', class: 'dv-out', 'data-testid': 'device-logout', onClick: () => void logout() }, icon('logout', 20), 'ÇIKIŞ YAP'));
        deviceApply = applyDevice;
        applyDevice();
        mount(root, h('div', { class: 'kmi-has-bottom' }, h('style', {}, SHELL_CSS), offlineBar(), h('a', { class: 'kmi-skip', href: '#kmi-main', onClick: (e) => { e.preventDefault(); document.getElementById('kmi-main')?.focus(); } }, 'İçeriğe geç'), sideEl, drawerBack, h('div', { class: 'kmi-main' }, deviceStrip, header.el, h('main', { class: 'kmi-content', id: 'kmi-main', tabindex: '-1' }, crumbEl(path), content)), bottomHost));
        const { value: access, failed: accessFailed } = await getAccess();
        if (!session)
            return; // signed out (manual, idle or another tab) while the access lookup was in flight: nothing more to draw
        {
            const live = canOpen('/canli', access), pulse = canOpen('/komuta', access);
            header.setChips(live, pulse);
            // real person, from the personnel record linked to this login (RLS decides); nothing invented when unlinked
            const uid = session.user.id;
            const fallbackName = session.user.label ?? session.user.email ?? '';
            header.setIdentity({ name: fallbackName, roles: access.roles });
            void client.select('personnel', { columns: 'name,department', filters: { auth_user_id: `eq.${uid}` }, limit: 1 }, session)
                .then((rows) => { if (rows[0]?.name) {
                header.setIdentity({ name: rows[0].name, department: rows[0].department, roles: access.roles });
                stripName.textContent = rows[0].name;
            } })
                .catch(() => { });
        }
        // navigation: only what this user may open (same rule as the home screen and the direct-URL guard); the server decides for real
        const treeAll = visibleNav((p) => canOpen(p, access) && ROUTES.some((x) => x.path === p && x.inMenu));
        // remembered state (per browser, never a permission): last workspace + favourites
        const navKey = `${NAV_STATE_KEY}:${session.user.id}`; // per user: a shared tablet/kiosk never shows the previous person's recent screens
        let navState = readNavState((() => { try {
            return { getItem: (_k) => localStorage.getItem(navKey) };
        }
        catch {
            return null;
        } })());
        const saveNavState = () => { try {
            localStorage.setItem(navKey, JSON.stringify(navState));
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
        // ---- TWO-LEVEL NAVIGATION (KMI-001 §001.1): SIX gates in the rail (Benim KMI · Performance Center · Siparişten Sevkiyata · Departmanlar · Yönetim ve Kurumsal Zekâ · Araçlar ve Sistem);
        // the panel of the SELECTED gate lists its workspaces (department → its own screens, each header links to the department home). The 15 workspaces / routes / permissions are unchanged
        // (gates only group them); a screen may sit under two gates but is one route. Favourites and recently used screens are sections of "Benim KMI".
        const visibleItem = (p) => treeAll.some((g) => g.items.some((x) => x.path === p));
        const favVirt = () => { const items = navState.favorites.map((p) => NAV_ITEM_BY_PATH[p]).filter((i) => !!i && visibleItem(i.path)); return items.length ? { id: 'fav', short: 'Favori', title: 'FAVORİLERİM', icon: 'badge', items } : null; };
        const recentVirt = () => { const items = navState.recent.filter((p) => p !== path).map((p) => NAV_ITEM_BY_PATH[p]).filter((i) => !!i && visibleItem(i.path)).slice(0, RECENT_SHOWN); return items.length ? { id: 'recent', short: 'Son', title: 'SON KULLANILAN', icon: 'clock', items } : null; };
        const gatesNow = () => {
            const gs = visibleGates(treeAll);
            if (operatorSimple && navGroups[0]?.id === 'mine') {
                const mine = navGroups[0];
                const me = gs.find((g) => g.id === 'me');
                const rest = (me?.sections ?? []).map((sct) => ({ ...sct, title: 'DİĞER', items: sct.items.filter((i) => !mine.items.some((m) => m.path === i.path)) })).filter((sct) => sct.items.length > 0);
                const meGate = { id: 'me', title: 'BENİM KMI', short: 'Benim', icon: 'user', sections: [mine, ...rest] };
                return me ? gs.map((g) => (g.id === 'me' ? meGate : g)) : [meGate, ...gs];
            }
            const fav = favVirt(), rec = recentVirt();
            const me = gs.find((g) => g.id === 'me');
            if (me || fav || rec) {
                const meGate = { id: 'me', title: 'BENİM KMI', short: 'Benim', icon: 'user', sections: [...(me?.sections ?? []), ...(fav ? [fav] : []), ...(rec ? [rec] : [])] };
                return me ? gs.map((g) => (g.id === 'me' ? meGate : g)) : [meGate, ...gs];
            }
            return gs;
        };
        const initialGate = () => {
            const gs = gatesNow();
            const deptId = path === '/departman' ? new URLSearchParams(location.hash.split('?')[1] ?? '').get('d') ?? undefined : undefined;
            const want = operatorSimple && gs[0]?.sections[0]?.id === 'mine' && gs[0].sections[0].items.some((i) => i.path === path) ? 'me' : deptId ? gateOfWorkspace(deptId) : gateOfPath(path);
            if (path === '/' && navState.last) {
                const g = gateOfWorkspace(navState.last);
                if (gs.some((x) => x.id === g))
                    return g;
            }
            if (gs.some((g) => g.id === want))
                return want;
            return gs.find((g) => g.sections.some((sct) => sct.items.some((i) => i.path === path)))?.id ?? gs[0]?.id ?? 'me';
        };
        let selectedGate = initialGate();
        const pickGate = (id, redraw) => { selectedGate = id; redraw(); };
        const gateIcon = (g) => icon(g.icon, 22);
        const deptHomeId = (sct) => (sct.id === 'me' || sct.id === 'mine' || sct.id === 'fav' || sct.id === 'recent' || sct.id === 'pc' || !sct.items.some((x) => x.path !== '/') ? null : sct.id);
        const fillSide = (host) => {
            const draw = () => {
                const gs = gatesNow();
                const sel = gs.find((g) => g.id === selectedGate) ?? gs[0];
                const railBtn = (g) => h('button', { type: 'button', class: 'ri', 'data-testid': 'app-nav-group', 'data-ws': g.id, 'data-gate': g.id, 'aria-pressed': String(g.id === sel?.id), 'aria-label': g.title, title: g.title, onClick: () => { pickGate(g.id, draw); const sd = host.closest('.kmi-side'); if (sd?.classList.contains('collapsed'))
                        sd.classList.add('peek'); sidePeek = true; } }, gateIcon(g), h('span', { class: 'rl' }, g.short));
                const rail = h('nav', { class: 'kmi-rail', 'aria-label': 'Ana kapılar', 'data-testid': 'app-rail' }, ...gs.map(railBtn));
                const secs = sel?.sections ?? [];
                const activeSec = secs.find((sct) => sct.items.some((i) => i.path === path)) ?? (path === '/departman' ? secs.find((sct) => sct.id === new URLSearchParams(location.hash.split('?')[1] ?? '').get('d')) : undefined);
                const isOpen = (sct) => secs.length <= 2 || sct === activeSec || openSecs.has(`${sel?.id}:${sct.id}`);
                const sectionEl = (sct) => {
                    const dh = deptHomeId(sct);
                    const open = isOpen(sct);
                    const fl = open && sct === activeSec && dh ? resolveFunctions(sct.id, (pp) => canOpen(pp, access)) : null;
                    const covered = new Set((fl ?? []).filter((f) => f.link && f.path && f.path !== '/departman').map((f) => f.path)); // one implementation, one menu entry: a page the function list already links is not repeated
                    const rows = sct.items.filter((it) => !covered.has(it.path)).map((it) => {
                        const a = navLink(it, 'app-nav-item');
                        const on = navState.favorites.includes(it.path);
                        const star = h('button', { type: 'button', class: 'nfav', 'data-testid': 'app-nav-fav', 'data-path': it.path, 'aria-pressed': String(on), 'aria-label': on ? `${it.label} favorilerden çıkar` : `${it.label} favorilere ekle`, title: on ? 'Favoriden çıkar' : 'Favorilere ekle',
                            onClick: () => { navState = nextNavState(navState, { toggleFavorite: it.path }); saveNavState(); draw(); } }, on ? '★' : '☆');
                        return h('div', { class: 'nrow' }, a, star);
                    });
                    const head = dh ? h('a', { href: `#/departman?d=${dh}`, class: 'ph-link', 'data-testid': 'app-dept-home-link', 'data-dept': dh }, icon(sct.icon, 18), sct.title) : h('span', {}, sct.title);
                    const toggle = secs.length > 2 ? h('button', { type: 'button', class: 'nfav nexp', 'data-testid': 'app-nav-expand', 'aria-expanded': String(open), 'aria-label': `${sct.title} sayfaları`, title: open ? 'Daralt' : 'Sayfaları göster',
                        onClick: () => { const k = `${sel?.id}:${sct.id}`; if (openSecs.has(k))
                            openSecs.delete(k);
                        else
                            openSecs.add(k); draw(); } }, open ? '▴' : '▾') : null;
                    // KMI-001 §001.1 rich second level: the department's functions with their honest state (only the section the user is in, to keep the panel short)
                    const fnList = fl ? h('div', { class: 'nfn', 'data-testid': 'app-nav-functions' }, h('div', { class: 'nfh' }, 'İŞLEVLER'), ...fl.map((f) => {
                        const dot = h('i', { class: `fd fd-${f.state.toLowerCase()}`, title: FUNCTION_STATE_TR[f.state], 'aria-hidden': 'true' });
                        const tx = h('span', {}, f.label, h('small', {}, [FUNCTION_STATE_TR[f.state], f.pkg ?? null, liveLabelTr(functionMaturity(f))].filter(Boolean).join(' · ')));
                        return f.link ? h('a', { href: f.link, class: 'nfi', 'data-testid': 'app-nav-function', 'data-state': f.state }, dot, tx) : h('div', { class: 'nfi off', 'data-testid': 'app-nav-function', 'data-state': f.state, title: f.note ?? '' }, dot, tx);
                    })) : null;
                    return h('section', { class: 'nsec', 'data-testid': 'app-nav-section', 'data-ws': sct.id, 'data-open': String(open) }, h('div', { class: 'nsh' }, head, toggle), ...(open ? rows : []), fnList);
                };
                const panel = h('div', { class: 'kmi-panel', 'data-testid': 'app-nav-panel', 'data-ws': sel?.id ?? '', 'data-gate': sel?.id ?? '' }, h('div', { class: 'ph', 'data-testid': 'app-nav-panel-title' }, sel?.title ?? ''), ...secs.map(sectionEl));
                host.replaceChildren(rail, panel);
            };
            draw();
        };
        const openSecs = new Set();
        const fillDrawer = (host) => {
            const draw = () => {
                const gs = gatesNow();
                const sel = gs.find((g) => g.id === selectedGate) ?? gs[0];
                const chip = (g) => h('button', { type: 'button', class: 'dws', 'data-testid': 'app-drawer-ws', 'data-ws': g.id, 'data-gate': g.id, 'aria-pressed': String(g.id === sel?.id), onClick: () => pickGate(g.id, draw) }, gateIcon(g), h('span', {}, g.short));
                host.replaceChildren(h('div', { class: 'dh', 'data-testid': 'app-drawer-title' }, sel?.title ?? ''), h('div', { class: 'dpages' }, ...(sel?.sections ?? []).flatMap((sct) => {
                    const dh = deptHomeId(sct);
                    return [(sel?.sections.length ?? 0) > 1 ? h('div', { class: 'dsub' }, dh ? h('a', { href: `#/departman?d=${dh}`, onClick: closeDrawer }, sct.title) : sct.title) : null,
                        ...sct.items.map((it) => navLink(it, 'app-drawer-item', closeDrawer))].filter((x) => !!x);
                })), h('div', { class: 'dh' }, 'KAPI DEĞİŞTİR'), h('div', { class: 'dgrid' }, ...gs.map(chip)));
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
            if (path !== '/')
                ux.record({ kind: 'BROKEN_ROUTE', route: '#/?' }); // the typed path is never recorded
            const landing = landingPath(access);
            if (landing) {
                location.hash = `#${landing}`;
                return;
            }
            const open = ROUTES.filter((x) => x.inMenu && canOpen(x.path, access));
            const homeGroups = treeAll.map((g) => ({ title: g.title, items: g.items.map((i) => open.find((x) => x.path === i.path)).filter((x) => !!x) })).filter((g) => g.items.length > 0);
            mount(content, h('div', { class: 'shell-menu kmi-home', style: 'max-width:1200px', 'data-testid': 'app-menu' }, accessFailed ? h('div', { class: 'kmi-banner warn', 'data-testid': 'app-access-failed' }, 'Yetki bilgisi alınamadı; yalnız herkese açık ekranlar gösteriliyor. Sayfayı yenileyin.') : null, h('section', { class: 'kmi-pulse', 'data-testid': 'app-today', hidden: true }), h('details', { 'data-testid': 'app-all', class: 'kmi-home' }, h('summary', {}, 'Tüm departmanlar ve ekranlar'), ...homeGroups.map((g) => h('div', { class: 'kmi-dept' }, h('div', { class: 'kmi-section' }, trTitle(g.title)), h('div', { class: 'kmi-links' }, ...g.items.map((x) => {
                const n = NAV_ITEM_BY_PATH[x.path];
                return h('a', { href: `#${x.path}`, class: 'kmi-link', 'data-testid': 'app-menu-item', 'data-path': x.path }, icon(n?.icon ?? 'grid', 16), n?.label ?? x.label);
            })))))));
            // AKILLI ANA SAYFA (KMI-002): every source is requested once, in parallel, and settles on its own; the heavy KPI catalogue loads only when opened.
            {
                const host = content.querySelector('[data-testid="app-today"]');
                if (!host)
                    return;
                const homeAccess = { roles: access.roles, economics: access.economics, owner: access.owner, actions: access.actions };
                const uid = session?.user.id ?? 'anon';
                const liveApi = createLiveApi(client, session);
                const fleet = showsFleet(homeAccess);
                let savedOrder = null;
                try {
                    savedOrder = JSON.parse(localStorage.getItem(orderStorageKey(uid)) ?? 'null');
                }
                catch {
                    savedOrder = null;
                }
                const prefs = createHomePrefsApi(client, session, { enabled: window.KMI_NEXT_CONFIG?.features?.homePrefs === true });
                const decideSrc = sourcesFor(new Set(access.actions));
                const hasDecideSrc = decideSrc.commercial || decideSrc.requests || decideSrc.orders || decideSrc.tasks; // a person is only ever loaded the decisions he may take
                const decideApi = canOpen('/onaylar', access) && hasDecideSrc ? createApprovalsInboxApi(client, session, { includeTasks: decideSrc.tasks, sources: decideSrc }) : null;
                const showHost = h('div', { id: 'home-show-host', 'data-testid': 'home-show' });
                const catHost = h('div', { 'data-testid': 'cockpit-catalog-host' });
                const hasCatalog = homeCardsFor(homeAccess).length > 0;
                const catalog = hasCatalog ? h('details', { class: 'hs-catalog cp-block', 'data-testid': 'home-catalog' }, h('summary', {}, 'Ayrıntılı gösterge kataloğu'), catHost) : null;
                host.replaceChildren(showHost, ...(catalog ? [catalog] : []));
                host.hidden = false;
                let last = null;
                let catLoaded = false;
                const present = () => ['fleet', 'perf', 'wos', 'flow', 'quick'].filter((x) => fleet || (x !== 'fleet' && x !== 'wos'));
                const draw = () => {
                    if (!last)
                        return;
                    const nowMs = Date.now();
                    const recent = navState.recent;
                    const order = applyOrder(present(), savedOrder);
                    renderHomeShow(showHost, { snapshot: last.snapshot, board: last.board, info: new Map(last.info.map((m) => [m.code, m])), approvalsInQueue: last.approvalsPending, approvalsPending: last.approvalsPending === null ? null : last.approvalsPending + countGates((last.tasks?.derived ?? []).map((d) => ({ sourceType: d.sourceType, sourceId: d.sourceId, title: d.title, status: d.status, due: d.due ?? null, route: d.route ?? null })), new Set(access.actions)), access: homeAccess, nowMs, canOpen: (p) => canOpen(p, access),
                        userName: session?.user.label ?? session?.user.email ?? null, failed: last.sources.snapshot.state === 'FAILED' || last.sources.snapshot.state === 'TIMEOUT',
                        tasks: last.tasks, sources: last.sources, recent, quickDefaults: featuredPaths(access, navAllPaths), order, decideApi, customOrder: Array.isArray(savedOrder),
                        onMove: (id, dir) => { savedOrder = moveSection(order, id, dir); try {
                            localStorage.setItem(orderStorageKey(uid), JSON.stringify(savedOrder));
                        }
                        catch { /* private mode: order lives for this view only */ } void prefs.set(savedOrder).catch(() => { }); draw(); },
                        onResetOrder: () => { savedOrder = null; try {
                            localStorage.removeItem(orderStorageKey(uid));
                        }
                        catch { /* private mode */ } void prefs.set([]).catch(() => { }); draw(); },
                        onRefresh: () => loader.refresh() });
                };
                const loader = createHomeLoader({
                    snapshot: () => createCommandCenterApi(client, session).snapshot(),
                    board: fleet ? () => liveApi.board('OFFICE') : null, info: fleet && liveApi.machineInfo ? () => liveApi.machineInfo() : null,
                    tasks: () => createTaskFloorApi(client, session).floor('MINE'),
                    approvals: canOpen('/onaylar', access) ? async () => {
                        const hs = new Set(access.actions);
                        const sr = sourcesFor(hs);
                        if (!hasDecideSrc)
                            return 0; // quality-only person: no source to read; his gates are counted from the task list already loaded
                        return (await createApprovalsInboxApi(client, session, { includeTasks: sr.tasks, sources: sr, light: true }).load()).items.length;
                    } : null,
                    onUpdate: (d) => { last = d; draw(); }, isMounted: () => showHost.isConnected
                });
                loader.start();
                // the user's server-side order (follows them to other devices) is read once, in parallel, and only replaces the device copy when it is a real order
                void prefs.get().then((o) => { if (o && o.length && showHost.isConnected) {
                    savedOrder = o;
                    try {
                        localStorage.setItem(orderStorageKey(uid), JSON.stringify(o));
                    }
                    catch { /* private mode */ }
                    draw();
                } }).catch(() => { });
                // the 30-odd KPI catalogue (≈20 table reads) is NOT part of the first screen: it loads once, when the user opens it
                catalog?.addEventListener('toggle', () => {
                    if (!catalog.open || catLoaded)
                        return;
                    catLoaded = true;
                    catHost.replaceChildren(h('div', { class: 'hs-skel', role: 'status' }, 'Göstergeler yükleniyor…'));
                    void (async () => {
                        const needed = homeCardsFor(homeAccess).filter((c) => c.source.kind === 'extra').map((c) => c.source.key);
                        const extras = await loadExtras(client, session, needed, new Date().toISOString());
                        renderCockpit(catHost, { snapshot: last?.snapshot ?? null, extras, access: homeAccess, nowMs: Date.now(), failed: !last?.snapshot });
                    })();
                });
                // Factory state (machine park, shifts, OEE, risks, departments) lives ONLY in the Performance Center — Home links to it instead of repeating it.
                if (canOpen('/komuta', access))
                    host.append(h('a', { href: '#/komuta', class: 'kmi-link', 'data-testid': 'home-pc-link', style: 'display:inline-block;margin-top:14px' }, 'Fabrikanın tamamı: Performance Center →'));
            }
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
            ux.record({ kind: 'PAGE_LOAD', route: knownHash(), ms: performance.now() - routeStart });
        }
        catch (err) {
            ux.record({ kind: 'NAV_ERROR', route: knownHash() });
            mount(content, h('div', { class: 'shell-menu', 'data-testid': 'app-route-error', 'data-detail': err instanceof Error ? err.message : String(err) }, h('p', {}, 'Bu ekran şu an açılamadı. Bağlantıyı kontrol edip yeniden deneyin; sürerse sistem yöneticisine bildirin.'), h('a', { href: location.hash || '#/', 'data-testid': 'app-route-retry', onClick: (e) => { e.preventDefault(); void route(); } }, 'Yeniden dene'))); // raw technical text never reaches the user (kept in data-detail for support)
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
