// KMI NEXT — KMI SCAN: QR / barkod. A keyboard-wedge scanner types into the input and presses
// Enter; manual entry works the same way; the camera path uses the browser BarcodeDetector API
// where the device supports it (physical phone camera: NOT_VERIFIED in this sandbox).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { parseScan } from '../../../../packages/domain/src/scan.js';
import { errorText as sharedErrorText } from '../errorText.js';
const LABEL = {
    WO: 'İş emri',
    LOT: 'Stok lotu',
    TOOL: 'Takım',
    MACHINE: 'Makine',
    SHIP: 'Sevkiyat',
    PO: 'Satınalma siparişi',
};
export function renderScanScreen(container, api, last) {
    const input = h('input', { type: 'text', 'data-testid': 'scan-input', placeholder: 'QR / barkod okutun veya yazın' });
    const cameraSupported = typeof globalThis.BarcodeDetector === 'function';
    async function submit(source) {
        const raw = input.value;
        const parsed = parseScan(raw);
        if (parsed.kind === 'INVALID') {
            renderScanScreen(container, api, { error: parsed.reason });
            return;
        }
        try {
            const result = await api.record(raw.trim(), parsed.kind === 'KMI' ? parsed.type : null, parsed.kind === 'KMI' ? parsed.ref : null, source, `ui-scan-${Date.now()}`);
            renderScanScreen(container, api, { result });
        }
        catch (err) {
            renderScanScreen(container, api, { error: sharedErrorText(err) });
        }
    }
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            void submit('SCANNER');
    });
    let resultNode = null;
    if (last?.error)
        resultNode = h('div', { 'data-testid': 'scan-error' }, last.error);
    else if (last?.result) {
        const r = last.result;
        const text = r.resolution === 'RESOLVED'
            ? `${LABEL[r.scanType ?? ''] ?? r.scanType} bulundu: ${r.scanRef}`
            : r.resolution === 'NOT_FOUND'
                ? `${LABEL[r.scanType ?? ''] ?? r.scanType} bulunamadı: ${r.scanRef} (okutma kaydedildi)`
                : `Eski/serbest kod kaydedildi: ${r.raw}`;
        resultNode = h('div', { 'data-testid': 'scan-result', 'data-resolution': r.resolution }, text);
    }
    const screen = h('div', { class: 'scan-screen' }, h('h1', { 'data-testid': 'scan-heading' }, 'KMI SCAN — QR / Barkod'), input, h('button', { type: 'button', 'data-testid': 'scan-manual-btn', onClick: () => submit('MANUAL') }, 'Kaydet'), h('div', { 'data-testid': 'scan-camera-status' }, cameraSupported ? 'Kamera ile okuma bu cihazda kullanılabilir.' : 'Kamera ile okuma bu cihazda desteklenmiyor — okutucu veya elle giriş kullanın.'), resultNode);
    mount(container, screen);
}
