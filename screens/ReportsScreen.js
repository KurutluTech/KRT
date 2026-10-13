// KMI NEXT — Raporlar (Report Pool, matrix 4/5/27/28). Migration 0034.
// Raporu SUNUCU üretir ve değiştirilemez bir anlık kayıt olarak saklar (parmak izi ile); ekran yalnız
// gösterir. Hesaplanamayan rapor "HESAPLANAMADI" der ve eksik veriyi adıyla söyler. Verisi olmayan
// raporlar (puantaj kapanışı, muhasebe dönemi) nedenleriyle listelenir — uydurulmaz. Altta KPI sözlüğü:
// her göstergenin formülü, birimi, kaynağı ve "veri yoksa" kuralı tek yerde.
// 0043: rapor aileleri, her kayıtta formül sürümü + veri kapsamı, eksik veri "EKSİK VERİ" olarak (sonuç
// varken de) gösterilir; D-014 zamanlayıcı paneli (yalnız yetkiliye, ana anahtar KAPALI gelir, e-posta
// yok) ve hangi raporu kimin okuyabildiği matrisi. Ekonomik rapor yalnız sahibe görünür (sunucu RLS).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { KPI_DICTIONARY, REPORT_CATALOG, camelKey, reportToCsv } from '../../../../packages/domain/src/reports.js';
import { percentLabel } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const DOMAIN_TR = { SHIPMENT: 'Sevkiyat / Sipariş', QUALITY: 'Kalite', PURCHASING: 'Satınalma', PRODUCTION: 'Üretim', MAINTENANCE: 'Bakım',
    PLANNING: 'Planlama / Kapasite', MATERIAL: 'Malzeme / Stok', TOOLROOM: 'Takımhane', COMPETENCY: 'Yetkinlik', MANAGEMENT: 'Yönetim', ECONOMIC: 'Ekonomik (yalnız sahip)' };
const GROUP_ORDER = ['MANAGEMENT', 'PRODUCTION', 'PLANNING', 'QUALITY', 'MAINTENANCE', 'TOOLROOM', 'MATERIAL', 'PURCHASING', 'SHIPMENT', 'COMPETENCY', 'ECONOMIC'];
const groupOf = (d) => d.family ?? d.domain;
const CADENCE_TR = { SHIFT_END: 'Vardiya sonu', DAILY: 'Günlük', WEEKLY: 'Haftalık', MONTHLY: 'Aylık' };
const STATE_TR = { OK: 'TAMAM', HIGH: 'YÜKSEK', OVERLOAD: 'AŞIRI YÜK', UNKNOWN: 'BİLİNMİYOR', NEAR_END: 'ÖMRÜ BİTİYOR', WORN: 'ÖMRÜ BİTTİ',
    ON_TIME: 'ZAMANINDA', LATE: 'GEÇ', OPEN_LATE: 'GECİKMİŞ (AÇIK)', NONE: 'KİMSE YOK', SINGLE: 'TEK KİŞİ' };
const KIND_TR = { EXCEPTION: 'İSTİSNA', PERIODIC: 'DÖNEMSEL' };
const MISSING_TR = { COUNT: 'dönemde üretim adedi yok', PLANNED_TIME: 'dönemde planlı üretim süresi yok',
    PLANNED_MINUTES: 'bazı işlerin süre tahmini yok', ROUTED_OPERATION_PLAN: 'rotalı işler operasyon bazında planlanmadı', REPAIR_END_TIME: 'onarım bitiş zamanı tutulmuyor (MTTR yok)',
    PROMISED_DATE: 'PO’da söz verilen teslim tarihi yok', DISPATCH_DATE: 'bazı sevklerin kaydı yok', DUE_LINES: 'dönemde termini olan satır yok',
    MACHINE_SKILL_REVIEW: 'makine şartları incelenmemiş (D-012)', GENERATOR_ERROR: 'rapor üretilirken hata', LABOUR: 'işçilik maliyeti', MACHINE_TIME: 'makine saat maliyeti',
    OVERHEAD: 'genel gider', TOOL_WEAR: 'takım aşınması', EXCHANGE_RATES: 'döviz kuru' };
const METRIC_TR = { GOOD: 'Sağlam', SCRAP: 'Fire', SCRAP_RATE: 'Fire oranı', PPM: 'PPM', NCRS_OPENED: 'Açılan NCR', NCR_QTY: 'NCR adedi',
    SHIPMENT_OVERDUE_LINES: 'Termini geçmiş satır', OPEN_QUALITY_HOLDS: 'Açık kalite bekletme', OPEN_NCRS: 'Açık NCR', BLOCKED_WORK_ORDERS: 'Başlatılamayan iş',
    OEE: 'OEE', OPEN_MAINTENANCE: 'Açık bakım', CRITICAL_MAINTENANCE: 'Kritik açık bakım', TOOLS_WORN_OR_UNKNOWN: 'Ömrü biten/bilinmeyen takım' };
const FRACTION_KEYS = new Set(['availability', 'performance', 'quality', 'oee', 'scrap_rate', 'load', 'share', 'ratio', 'reject_rate']);
const fmt = (iso) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const errText = (e) => sharedErrorText(e);
function cellText(key, row) {
    const v = row[camelKey(key)];
    if (key === 'value' && row['metric'] === 'SCRAP_RATE')
        return v === null || v === undefined ? 'HESAPLANAMADI' : percentLabel(Number(v));
    if (key === 'value' && row['metric'] === 'PPM' && (v === null || v === undefined))
        return 'HESAPLANAMADI';
    if (key === 'value' && row['metric'] === 'OEE')
        return v === null || v === undefined ? 'BİLİNMİYOR' : percentLabel(Number(v));
    if (key === 'value' && (v === null || v === undefined))
        return 'BİLİNMİYOR';
    if (key === 'state')
        return STATE_TR[String(v)] ?? String(v);
    if (key === 'qualified' && (v === null || v === undefined))
        return 'BİLİNMİYOR';
    if (key === 'metric')
        return METRIC_TR[String(v)] ?? String(v);
    if (FRACTION_KEYS.has(key))
        return percentLabel(v === null || v === undefined ? null : Number(v));
    if (key === 'opened_at')
        return v ? fmt(String(v)) : '—';
    if (Array.isArray(v))
        return v.length ? v.join(', ') : '—';
    return v === null || v === undefined || v === '' ? '—' : String(v);
}
export async function renderReportsScreen(container, api, state = {}) {
    let defs = [];
    let runs = [];
    let loadError = null;
    let schedule = null;
    let matrix = [];
    try {
        [defs, runs] = await Promise.all([api.definitions(), api.runs()]);
    }
    catch (err) {
        loadError = errText(err);
    }
    // optional panels: the server refuses them for users without the right — then they are simply not shown
    try {
        schedule = await api.scheduleStatus();
    }
    catch {
        schedule = null;
    }
    try {
        matrix = await api.accessMatrix();
    }
    catch {
        matrix = [];
    }
    const go = (next) => void renderReportsScreen(container, api, next);
    const titleOf = (code) => defs.find((d) => d.code === code)?.titleTr ?? code;
    const defCard = (d) => {
        const hasDays = d.defaultParams && 'days' in d.defaultParams;
        const days = hasDays ? h('input', { type: 'number', min: '0', max: '365', 'data-testid': 'rp-days', value: String(d.defaultParams['days']), style: 'width:5em' }) : null;
        const generate = async () => {
            try {
                go({ run: await api.generate(d.code, days ? { days: Number(days.value) } : {}) });
            }
            catch (err) {
                go({ error: errText(err) });
            }
        };
        const history = runs.filter((r) => r.reportCode === d.code).slice(0, 5);
        return h('div', { 'data-testid': 'rp-def', 'data-code': d.code, 'data-available': String(d.available),
            style: `border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:6px 0;${d.available ? '' : 'opacity:.75'}` }, h('div', {}, h('b', {}, d.titleTr), ' ', h('span', { style: 'font-size:11px;color:#64748b' }, KIND_TR[d.kind] ?? d.kind), d.formulaVersion && d.formulaVersion !== 'v1' ? h('span', { 'data-testid': 'rp-version', style: 'font-size:11px;color:#1d4ed8' }, ` · formül ${d.formulaVersion}`) : null, d.requiredAction ? h('span', { style: 'font-size:11px;color:#b45309' }, ` · yetki: ${d.requiredAction}`) : null, d.economic ? h('span', { style: 'font-size:11px;color:#7c3aed' }, ' · yalnız sahip') : null), d.formulaTr ? h('div', { style: 'font-size:11px;color:#64748b;overflow-wrap:anywhere' }, `Formül: ${d.formulaTr}`) : null, d.available
            ? h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px' }, days ? h('label', {}, 'Gün: ', days) : null, h('button', { type: 'button', 'data-testid': 'rp-generate', onClick: () => void generate() }, 'Oluştur'))
            : h('div', { 'data-testid': 'rp-unavailable', style: 'color:#b45309;margin-top:4px' }, `Kullanılamıyor: ${(d.unavailableReason ?? '').replace(/KMI\sNEXT/g, 'KMI')}`), ...history.map((r) => h('button', { type: 'button', 'data-testid': 'rp-history-item', 'data-id': r.id,
            style: 'display:block;background:none;border:0;color:#1d4ed8;text-decoration:underline;padding:2px 0;cursor:pointer;font:inherit;text-align:left',
            onClick: async () => {
                try {
                    go({ run: await api.run(r.id) });
                }
                catch (err) {
                    go({ error: errText(err) });
                }
            } }, `${fmt(r.generatedAt)} · ${r.rowCount} satır${r.status === 'CANNOT_CALCULATE' ? ' · HESAPLANAMADI' : ''}${r.trigger === 'SCHEDULED' ? ' · otomatik' : ''}`)));
    };
    const runView = (r) => {
        const csvHref = () => URL.createObjectURL(new Blob([reportToCsv(r.payload.columns, r.payload.rows)], { type: 'text/csv;charset=utf-8' }));
        const csvLink = h('a', { 'data-testid': 'rp-csv', download: `${r.reportCode}-${r.generatedAt.slice(0, 10)}.csv`, href: '#', onClick: (e) => { e.currentTarget.href = csvHref(); } }, 'CSV indir');
        return h('section', { 'data-testid': 'rp-run', 'data-status': r.status, 'data-code': r.reportCode, style: 'border:2px solid #1d4ed8;border-radius:12px;padding:10px 12px;margin:10px 0' }, h('h2', { style: 'margin:0 0 4px;font-size:18px' }, titleOf(r.reportCode)), h('div', { style: 'font-size:12px;color:#475569' }, `${fmt(r.generatedAt)} · ${r.trigger === 'SCHEDULED' ? 'otomatik' : 'elle'} · ${Object.entries(r.params).map(([k, v]) => `${k === 'days' ? 'gün' : k}=${v}`).join(', ') || 'parametresiz'} · ${r.rowCount} satır · formül ${r.formulaVersion ?? 'v1'}`), r.payload.scope ? h('div', { 'data-testid': 'rp-scope', style: 'font-size:11px;color:#475569;overflow-wrap:anywhere' }, `Kapsam: ${r.payload.scope.from && r.payload.scope.to ? `${r.payload.scope.from} – ${r.payload.scope.to}` : r.payload.scope.date ?? 'anlık durum'}`, r.payload.scope.sources?.length ? ` · kaynak: ${r.payload.scope.sources.join(', ')}` : '', r.payload.scope.note ? ` · ${r.payload.scope.note}` : '') : null, h('div', { 'data-testid': 'rp-fingerprint', style: 'font-size:11px;color:#64748b;word-break:break-all' }, `Değiştirilemez kayıt · parmak izi ${r.fingerprint.slice(0, 16)}…`, r.fingerprintOk === undefined ? '' : h('span', { 'data-testid': 'rp-fingerprint-ok', 'data-ok': String(r.fingerprintOk) }, r.fingerprintOk ? ' · doğrulandı' : ' · UYUŞMUYOR')), r.status === 'CANNOT_CALCULATE'
            ? h('div', { 'data-testid': 'rp-cannot', style: 'margin:8px 0;padding:8px;border-radius:8px;background:#fef3c7;color:#92400e;font-weight:700' }, `HESAPLANAMADI — eksik veri: ${r.missing.map((m) => MISSING_TR[m] ?? m).join(', ')}`)
            : r.missing.length
                ? h('div', { 'data-testid': 'rp-partial', style: 'margin:8px 0;padding:8px;border-radius:8px;background:#fef9c3;color:#854d0e;font-weight:700' }, `EKSİK VERİ — bu rapor şu bilgi olmadan hesaplandı: ${r.missing.map((m) => MISSING_TR[m] ?? m).join(', ')}`)
                : null, r.payload.rows.length
            ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'rp-table' }, h('thead', {}, h('tr', {}, ...r.payload.columns.map((c) => h('th', {}, c.label)))), h('tbody', {}, ...r.payload.rows.map((row) => h('tr', { 'data-testid': 'rp-row' }, ...r.payload.columns.map((c) => h('td', { 'data-key': c.key }, cellText(c.key, row))))))))
            : r.status === 'OK' ? h('div', { 'data-testid': 'rp-empty' }, 'Kayıt yok — bu ölçüte uyan durum bulunmadı.') : null, h('div', { style: 'display:flex;gap:12px;margin-top:6px' }, csvLink, h('button', { type: 'button', 'data-testid': 'rp-close', onClick: () => go({}) }, 'Kapat')));
    };
    const groups = [...new Set(defs.map(groupOf))].sort((a, b) => (GROUP_ORDER.indexOf(a) + 100) % 100 - (GROUP_ORDER.indexOf(b) + 100) % 100);
    const scheduleSet = async (code, enabled, reason) => {
        try {
            await api.setSchedule(code, enabled, reason.value);
            go({ message: code ? `${code}: ${enabled ? 'açık' : 'kapalı'}` : `Zamanlayıcı ana anahtarı ${enabled ? 'AÇIK' : 'KAPALI'}` });
        }
        catch (err) {
            go({ error: errText(err) });
        }
    };
    const schedulePanel = (st) => {
        const reason = h('input', { 'data-testid': 'rp-sched-reason', placeholder: 'Gerekçe (en az 5 harf)', style: 'width:100%;box-sizing:border-box' });
        return h('section', { 'data-testid': 'rp-schedule', style: 'border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:10px 0;background:#f8fafc' }, h('h2', { style: 'font-size:16px;margin:0 0 4px' }, 'Otomatik raporlar (D-014)'), h('div', { 'data-testid': 'rp-sched-state', 'data-enabled': String(st.enabled), 'data-installed': String(st.installed), style: 'font-size:12px;font-weight:700;color:' + (st.enabled && st.installed ? '#15803d' : '#b45309') }, !st.installed ? 'ÇALIŞMIYOR — zamanlayıcı kurulmadı (sahip onayı bekliyor). Raporlar şimdilik elle üretilir.'
            : st.enabled ? 'ÇALIŞIYOR' : 'KAPALI — ana anahtar kapalı.'), h('div', { style: 'font-size:11px;color:#64748b' }, `Ana anahtar: ${st.enabled ? 'açık' : 'kapalı'} · Kurulum: ${st.installed ? 'var' : 'yok'} · Son tetik: ${st.lastTick ? `${fmt(st.lastTick.tickAt)} (${st.lastTick.outcome})` : 'hiç'} · Teslim: yalnız uygulama içi, e-posta yok`), ...st.schedules.map((x) => h('div', { 'data-testid': 'rp-sched-row', 'data-code': x.code, 'data-enabled': String(x.enabled), style: 'border-top:1px solid #e2e8f0;padding:6px 0;font-size:12px' }, h('b', {}, `${x.titleTr}${x.economic ? ' (yalnız sahip)' : ''}`), ` · ${CADENCE_TR[x.cadence] ?? x.cadence}: ${x.triggerTr}`, h('div', { style: 'color:#475569;overflow-wrap:anywhere' }, `Raporlar: ${x.reportCodes.map((c) => defs.find((d) => d.code === c)?.titleTr ?? c).join(', ')}`), h('div', { style: 'color:#64748b' }, x.lastRanAt ? `Son çalışma: ${fmt(x.lastRanAt)} (${x.lastSlot})` : 'Henüz çalışmadı'), h('button', { type: 'button', 'data-testid': 'rp-sched-toggle', onClick: () => void scheduleSet(x.code, !x.enabled, reason) }, x.enabled ? 'Bu planı kapat' : 'Bu planı aç'))), h('div', { style: 'margin-top:6px' }, reason), h('button', { type: 'button', 'data-testid': 'rp-sched-master', style: 'margin-top:6px', onClick: () => void scheduleSet(null, !st.enabled, reason) }, st.enabled ? 'Ana anahtarı KAPAT' : 'Ana anahtarı AÇ'));
    };
    const ROLE_TR = { ALL_SIGNED_IN: 'giriş yapan herkes', OWNER: 'yalnız sahip (+ sahibin yetki verdiği kişi)' };
    const matrixSection = (rows) => h('details', { 'data-testid': 'rp-matrix', style: 'margin:12px 0' }, h('summary', { style: 'font-weight:700' }, 'Kim hangi raporu görebilir?'), ...rows.map((x) => h('div', { 'data-testid': 'rp-matrix-row', 'data-code': x.code, style: 'border-top:1px solid #f1f5f9;padding:4px 0;font-size:12px;overflow-wrap:anywhere' }, h('b', {}, x.titleTr), ` · ${x.roles.map((r) => ROLE_TR[r] ?? r).join(', ')}`, x.schedules.length ? ` · plan: ${x.schedules.join(', ')}` : '')));
    mount(container, h('div', { class: 'reports-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'rp-heading' }, 'Raporlar'), h('a', { href: '#/gecmis', 'data-testid': 'rp-history-link', style: 'color:#67e8f9;font-size:13px;font-weight:700;text-decoration:none' }, 'Olay geçmişi (zaman araması) →'), h('p', { style: 'font-size:12px;color:#555' }, 'Rapor sunucuda üretilir ve değiştirilemez kayıt olarak saklanır (formül sürümü ve veri kapsamıyla). Genel raporlarda para yoktur; ekonomik rapor yalnız sahibe görünür.'), loadError ? h('div', { 'data-testid': 'rp-load-error' }, `Yüklenemedi: ${loadError}`) : null, state.error ? h('div', { 'data-testid': 'rp-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, state.error) : null, state.message ? h('div', { 'data-testid': 'rp-message', style: 'padding:10px;border-radius:8px;background:#e0f2fe' }, state.message) : null, state.run ? runView(state.run) : null, schedule ? schedulePanel(schedule) : null, ...groups.map((g) => h('section', { 'data-testid': 'rp-group', 'data-group': g, style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, DOMAIN_TR[g] ?? g), ...defs.filter((d) => groupOf(d) === g).map(defCard))), matrix.length ? matrixSection(matrix) : null, h('section', { 'data-testid': 'rp-kpi-dictionary', style: 'margin:16px 0' }, h('h2', { style: 'font-size:16px' }, 'KPI sözlüğü'), ...KPI_DICTIONARY.map((k) => h('div', { 'data-testid': 'rp-kpi', 'data-code': k.code, style: 'border-top:1px solid #f1f5f9;padding:6px 0' }, h('b', {}, `${k.titleTr} (${k.unit})`), h('div', {}, `Formül: ${k.formulaTr}`), h('div', { style: 'font-size:12px;color:#64748b' }, `Kaynak: ${k.source.startsWith('report:') ? 'Rapor — ' + (REPORT_CATALOG.find((d) => d.code === k.source.slice(7))?.titleTr ?? titleOf(k.source.slice(7))) : k.source} · Veri yoksa: ${k.unknownRuleTr.replace(/CANNOT_CALCULATE/g, 'HESAPLANAMAZ')}`))))));
}
