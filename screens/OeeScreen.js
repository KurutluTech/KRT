// KMI NEXT — OEE / KPI (#679 D). Numbers come only from kmi_next.oee_rollup (one calculation for
// every screen). Missing data is shown as UNKNOWN / VERİ GEREKLİ with the missing input named —
// never a fake 100 %. Losses (dakika): ayar, takım, arıza, malzeme bekleme, bakım, diğer.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { percentLabel, LOSS_LABEL_TR } from '../../../../packages/domain/src/oee.js';
import { errorText as sharedErrorText } from '../errorText.js';
const GROUP_TR = { MACHINE: 'Makine', OPERATOR: 'Operatör', SHIFT: 'Vardiya', DATE: 'Tarih', TOTAL: 'Toplam' };
const MISSING_TR = {
    PLANNED_TIME: 'planlı süre yok',
    RUN_TIME: 'çalışma süresi yok',
    IDEAL_CYCLE_TIME: 'ideal çevrim süresi (CAM) eksik',
    COUNT: 'üretim adedi yok',
};
export async function renderOeeScreen(container, api, state) {
    let rows = [];
    let loadError = null;
    try {
        rows = await api.rollup(state.from, state.to, state.group);
    }
    catch (err) {
        loadError = sharedErrorText(err);
    }
    let reasons = null;
    if (!loadError && rows.length > 0 && api.lossReasons) {
        try {
            reasons = await api.lossReasons(state.from, state.to);
        }
        catch {
            reasons = null;
        }
    }
    const fromIn = h('input', { type: 'date', 'data-testid': 'oee-from', value: state.from });
    const toIn = h('input', { type: 'date', 'data-testid': 'oee-to', value: state.to });
    const groupSel = h('select', { 'data-testid': 'oee-group' }, ...Object.keys(GROUP_TR).map((g) => h('option', { value: g, ...(g === state.group ? { selected: 'selected' } : {}) }, GROUP_TR[g])));
    const refresh = () => void renderOeeScreen(container, api, { from: fromIn.value, to: toIn.value, group: groupSel.value });
    const lossCols = [
        ['setup', 'lossSetup'], ['tool', 'lossTool'], ['fault', 'lossFault'], ['materialWait', 'lossMaterialWait'], ['maintenance', 'lossMaintenance'], ['other', 'lossOther'],
    ];
    const pctCell = (testid, v) => h('td', { 'data-testid': testid, 'data-unknown': String(v === null), style: v === null ? 'color:#a60;font-weight:bold' : '' }, percentLabel(v));
    const screen = h('div', { class: 'oee-screen', style: 'max-width:100%;padding:0 16px;box-sizing:border-box' }, h('h1', { 'data-testid': 'oee-heading' }, 'OEE / KPI — gerçek veriden'), h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center' }, fromIn, toIn, groupSel, h('button', { type: 'button', 'data-testid': 'oee-refresh', onClick: refresh }, 'Göster')), h('p', { style: 'font-size:12px;color:#555' }, 'OEE = Kullanılabilirlik × Performans × Kalite. Eksik veri varsa değer UNKNOWN / VERİ GEREKLİ gösterilir.'), loadError
        ? h('div', { 'data-testid': 'oee-load-error' }, `Yüklenemedi: ${loadError}`)
        : rows.length === 0
            ? h('div', { 'data-testid': 'oee-empty' }, 'Bu aralıkta planlı üretim yok — KPI hesaplanamaz (UNKNOWN / VERİ GEREKLİ).')
            : h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'oee-table' }, h('thead', {}, h('tr', {}, h('th', {}, GROUP_TR[state.group]), h('th', {}, 'Kullanılabilirlik'), h('th', {}, 'Performans'), h('th', {}, 'Kalite'), h('th', {}, 'OEE'), h('th', {}, 'Planlı dk'), h('th', {}, 'Çalışma dk'), h('th', {}, 'Sağlam / Toplam'), ...lossCols.map(([k]) => h('th', {}, LOSS_LABEL_TR[k])), h('th', {}, 'Eksik veri'))), h('tbody', {}, ...rows.map((r) => h('tr', { 'data-testid': 'oee-row', 'data-key': r.groupKey }, h('td', { 'data-testid': 'oee-key' }, r.groupKey), pctCell('oee-a', r.availability), pctCell('oee-p', r.performance), pctCell('oee-q', r.quality), pctCell('oee-oee', r.oee), h('td', { 'data-testid': 'oee-planned' }, String(r.plannedMinutes)), h('td', { 'data-testid': 'oee-run' }, String(r.runMinutes)), h('td', { 'data-testid': 'oee-count' }, `${r.goodCount} / ${r.totalCount}`), ...lossCols.map(([k, f]) => h('td', { 'data-testid': `oee-loss-${k}` }, String(r[f]))), h('td', { 'data-testid': 'oee-missing' }, r.missing.map((m) => MISSING_TR[m] ?? m).join(', ') || '—')))))), reasons ? h('section', { 'data-testid': 'oee-reasons', style: 'margin:10px 0;font-size:13px' }, h('b', {}, `“Diğer” kaybın dağılımı (${reasons.lossOther} dk)`), h('div', {}, `Kalite bekleme ${reasons.qualityWait} · Operatör kaynaklı ${reasons.operatorCaused} · Planlı duruş ${reasons.plannedStop} · Etiketli diğer ${reasons.otherLabeled} · Bilinmeyen (kayıtsız boşluk) ${reasons.unknownMinutes} dk`), h('div', { style: 'color:#64748b' }, 'Bu ayrım OEE yüzdesini değiştirmez. Kalite bekleme kalite kaybı sayılmaz; planlı duruş, onaylı üretim takvimi olmadığı için paydadan düşülmez; bilinmeyen süre hiçbir nedene atanmaz.')) : null);
    mount(container, screen);
}
