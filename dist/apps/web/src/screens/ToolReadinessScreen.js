// KMI NEXT — İş emri takım hazırlığı: CAM programının takım listesi vs makinede bağlı, ömrü
// kalmış takımlar; iş emri için takım bağlama. Kurallar sunucuda yeniden uygulanır (0019).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { readinessLabel } from '../../../../packages/domain/src/readiness.js';
import { readinessPanel } from './readinessPanel.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderToolReadinessScreen(container, workOrderId, machineId, api, banner) {
    let rows = [];
    let readiness = [];
    let loadError = null;
    try {
        [rows, readiness] = await Promise.all([api.status(workOrderId), api.readiness(workOrderId)]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const toolInput = h('input', { type: 'text', 'data-testid': 'tr-tool-input', placeholder: 'Takım ID' });
    const tool = readiness.find((r) => r.kind === 'TOOL');
    async function handleExempt(reason) {
        try {
            await api.grantExemption(workOrderId, 'TOOL', reason);
            await renderToolReadinessScreen(container, workOrderId, machineId, api, { kind: 'info', text: 'Takım muafiyeti kaydedildi (audit).' });
        }
        catch (err) {
            await renderToolReadinessScreen(container, workOrderId, machineId, api, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleMount() {
        try {
            await api.mountForWorkOrder(toolInput.value.trim(), machineId, workOrderId, `ui-mount-${Date.now()}`);
            await renderToolReadinessScreen(container, workOrderId, machineId, api, { kind: 'info', text: 'Takım iş emri için bağlandı.' });
        }
        catch (err) {
            await renderToolReadinessScreen(container, workOrderId, machineId, api, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = h('div', { class: 'tool-readiness-screen' }, h('h1', { 'data-testid': 'tr-heading' }, `Takım Hazırlığı (İş Emri: ${workOrderId})`), banner ? h('div', { 'data-testid': 'tr-banner', 'data-kind': banner.kind }, banner.text) : null, loadError
        ? h('div', { 'data-testid': 'tr-load-error' }, `Yüklenemedi: ${loadError}`)
        : h('div', {}, h('div', { 'data-testid': 'tr-gate', 'data-state': tool?.state ?? 'UNKNOWN' }, tool ? readinessLabel(tool) : 'UNKNOWN / VERİ GEREKLİ — TOOL_REQUIREMENT_UNKNOWN:NOT_EVALUATED'), readinessPanel('TOOL', tool, (reason) => void handleExempt(reason)), h('table', { 'data-testid': 'tr-table' }, h('tbody', {}, ...rows.map((r) => h('tr', { 'data-testid': 'tr-row', 'data-tool-type': r.toolType }, h('td', { 'data-testid': 'tr-type' }, r.toolType), h('td', { 'data-testid': 'tr-mounted' }, `${r.mountedUsable}/${r.required}`), h('td', { 'data-testid': 'tr-ready' }, r.ready ? 'HAZIR' : 'EKSİK'))))), toolInput, h('button', { type: 'button', 'data-testid': 'tr-mount-btn', onClick: handleMount }, 'İş Emri İçin Bağla (TAK)')));
    mount(container, screen);
}
