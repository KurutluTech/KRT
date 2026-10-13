// KMI NEXT — Etiket basımı (#679 B). QR (KMI:<TYPE>:<ref>) + Code128 (KL kodu) + server-built
// fields. Layouts: THERMAL_62x40 (etiket yazıcısı), A4_SHEET (masaüstü yazıcı), TABLET (ekranda
// büyük önizleme). Reprint needs LABEL_REPRINT + reason on the server; every print is logged.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { encodeCode128B, code128ToSvg } from '../../../../packages/ui/src/code128.js';
import { LABEL_LAYOUTS } from '../../../../packages/domain/src/labels.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
const LAYOUT_TR = {
    THERMAL_62x40: 'Etiket yazıcısı 62×40 mm',
    A4_SHEET: 'A4 yazıcı (99×57 mm etiket)',
    TABLET: 'Tablet / ekran önizleme',
};
const LAYOUT_BOX = {
    THERMAL_62x40: { w: '62mm', h: '40mm', qr: 22 },
    A4_SHEET: { w: '99mm', h: '57mm', qr: 34 },
    TABLET: { w: '100%', h: 'auto', qr: 60 },
};
const PRINT_CSS = `
@media print {
  .label-controls, .label-history, [data-testid="label-banner"] { display: none !important; }
  body { margin: 0; }
  .kmi-label { border: none !important; }
}`;
function svgNode(svg, testid) {
    const box = h('div', { 'data-testid': testid });
    box.innerHTML = svg; // locally generated SVG (paths only), no user text inside
    return box;
}
export function renderLabel(label, layout) {
    const box = LAYOUT_BOX[layout];
    return h('div', {
        class: 'kmi-label',
        'data-testid': 'label-card',
        'data-layout': layout,
        style: `width:${box.w};height:${box.h};max-width:100%;box-sizing:border-box;border:1px dashed #999;padding:2mm;display:flex;gap:2mm;align-items:flex-start;font-family:sans-serif;overflow:hidden;background:#fff;color:#000`,
    }, svgNode(qrToSvg(encodeQr(label.qrPayload, 'M'), box.qr), 'label-qr'), h('div', { style: 'flex:1;min-width:0;font-size:9pt;line-height:1.25' }, h('div', { 'data-testid': 'label-code', style: 'font-weight:bold;font-size:11pt' }, label.labelCode), ...label.fields.map(([k, v]) => h('div', { 'data-testid': 'label-field' }, `${k}: ${v}`)), label.printNo > 1 ? h('div', { 'data-testid': 'label-reprint-mark', style: 'font-weight:bold' }, `TEKRAR BASKI #${label.printNo}`) : null, svgNode(code128ToSvg(encodeCode128B(label.labelCode), layout === 'THERMAL_62x40' ? 0.25 : 0.33, layout === 'THERMAL_62x40' ? 7 : 10), 'label-barcode')));
}
export async function renderLabelScreen(container, entity, api, state) {
    let history = [];
    let loadError = null;
    try {
        history = await api.history(entity.type, entity.id);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const layout = state?.layout ?? 'THERMAL_62x40';
    const layoutSelect = h('select', { 'data-testid': 'label-layout-select' }, ...LABEL_LAYOUTS.map((l) => h('option', l === layout ? { value: l, selected: 'selected' } : { value: l }, LAYOUT_TR[l])));
    const reasonInput = h('input', { type: 'text', 'data-testid': 'label-reason-input', placeholder: 'Tekrar baskı gerekçesi' });
    // One request id per rendered form: a double click prints (logs) once.
    const requestId = `ui-lbl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    async function handlePrint() {
        const chosen = layoutSelect.value;
        try {
            const label = await api.issue(entity.type, entity.id, chosen, reasonInput.value.trim() || null, requestId);
            await renderLabelScreen(container, entity, api, {
                layout: chosen,
                label,
                banner: { kind: 'info', text: label.printNo === 1 ? 'Etiket hazır — yazdırabilirsiniz.' : `Tekrar baskı #${label.printNo} kaydedildi.` },
            });
        }
        catch (err) {
            await renderLabelScreen(container, entity, api, { layout: chosen, label: state?.label, banner: { kind: 'error', text: errorText(err) } });
        }
    }
    const screen = h('div', { class: 'label-screen', style: 'max-width:100%;padding:0 16px;box-sizing:border-box' }, h('style', {}, PRINT_CSS + (layout === 'THERMAL_62x40' ? '\n@page { size: 62mm 40mm; margin: 0; }' : '\n@page { size: A4; margin: 10mm; }')), h('div', { class: 'label-controls' }, h('h1', { 'data-testid': 'label-heading' }, `Etiket — ${entity.title}`), h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' }, layoutSelect, history.length > 0 ? reasonInput : null, h('button', { type: 'button', 'data-testid': 'label-issue-btn', onClick: () => void handlePrint() }, history.length > 0 ? 'Tekrar Bas (yetkili)' : 'Etiket Oluştur'), state?.label ? h('button', { type: 'button', 'data-testid': 'label-print-btn', onClick: () => window.print() }, 'Yazdır') : null)), state?.banner ? h('div', { 'data-testid': 'label-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, state?.label ? renderLabel(state.label, layout) : null, loadError
        ? h('div', { 'data-testid': 'label-load-error' }, `Yüklenemedi: ${loadError}`)
        : h('div', { class: 'label-history' }, h('h2', {}, 'Baskı geçmişi'), h('table', { 'data-testid': 'label-history-table' }, h('tbody', {}, ...history.map((r) => h('tr', { 'data-testid': 'label-history-row' }, h('td', {}, `#${r.printNo}`), h('td', {}, r.labelCode), h('td', {}, LAYOUT_TR[r.layout] ?? r.layout), h('td', {}, r.reason ?? '—'), h('td', {}, r.printedAt)))))));
    mount(container, screen);
}
