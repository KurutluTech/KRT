// KMI NEXT — KMI SCAN: QR / barkod. A keyboard-wedge scanner types into the input and presses
// Enter; manual entry works the same way; the camera path uses the browser BarcodeDetector API
// where the device supports it (physical phone camera: NOT_VERIFIED in this sandbox).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { parseScan, unwrapScanLink } from '../../../../packages/domain/src/scan.js';
import { taskIdFromQr } from '../../../../packages/domain/src/taskWorkspace.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { canOpenPassport, passportHref } from '../passport/registry.js';
/** scan type → passport kind. PO has no passport (KMI-081 owns that); TASK labels open the task itself. */
const SCAN_TO_KIND = { WO: 'WORK_ORDER', LOT: 'STOCK_LOT', TOOL: 'TOOL', MACHINE: 'MACHINE', SHIP: 'SHIPMENT' };
const LABEL = {
    WO: 'İş emri',
    LOT: 'Stok lotu',
    TOOL: 'Takım',
    MACHINE: 'Makine',
    SHIP: 'Sevkiyat',
    PO: 'Satınalma siparişi',
    ASSET: 'Varlık',
};
export function renderScanScreen(container, api, last, opts = {}) {
    const input = h('input', { type: 'text', 'data-testid': 'scan-input', placeholder: 'QR / barkod okutun veya yazın' });
    const cameraSupported = typeof globalThis.BarcodeDetector === 'function';
    async function submit(source) {
        const raw = input.value;
        // KMI-003 (003.07): a task label ("KMI:TASK:<id>") opens the task itself. Nothing is decided here: task_floor only returns tasks this person may see.
        const taskId = taskIdFromQr(unwrapScanLink(raw));
        if (taskId) {
            location.hash = `#/gorevler?t=${encodeURIComponent(taskId)}&via=qr`;
            return;
        }
        const parsed = parseScan(raw);
        if (parsed.kind === 'INVALID') {
            renderScanScreen(container, api, { error: parsed.reason }, { access: opts.access });
            return;
        }
        try {
            const result = await api.record(raw.trim(), parsed.kind === 'KMI' ? parsed.type : null, parsed.kind === 'KMI' ? parsed.ref : null, source, `ui-scan-${Date.now()}`);
            renderScanScreen(container, api, { result }, { access: opts.access });
        }
        catch (err) {
            renderScanScreen(container, api, { error: sharedErrorText(err) }, { access: opts.access });
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
        const kind = r.resolution === 'RESOLVED' ? SCAN_TO_KIND[r.scanType ?? ''] : undefined;
        const open = r.resolution === 'RESOLVED' && r.scanType === 'ASSET' && r.resolvedId ? `#/varlik?id=${r.resolvedId}` : kind && r.resolvedId && opts.access && canOpenPassport(kind, opts.access) ? passportHref(kind, r.resolvedId) : null;
        resultNode = h('div', {}, h('div', { 'data-testid': 'scan-result', 'data-resolution': r.resolution }, text), open ? h('a', { href: open, 'data-testid': 'scan-open-passport', style: 'display:inline-flex;align-items:center;min-height:44px;margin-top:8px;padding:0 14px;border:1px solid #1d4ed8;border-radius:10px;color:#1d4ed8;font-weight:700;text-decoration:none' }, 'Pasaportu aç →') : null);
    }
    const screen = h('div', { class: 'scan-screen' }, h('h1', { 'data-testid': 'scan-heading' }, 'KMI SCAN — QR / Barkod'), input, h('button', { type: 'button', 'data-testid': 'scan-manual-btn', onClick: () => submit('MANUAL') }, 'Kaydet'), h('div', { 'data-testid': 'scan-camera-status' }, cameraSupported ? 'Kamera ile okuma bu cihazda kullanılabilir.' : 'Kamera ile okuma bu cihazda desteklenmiyor — okutucu veya elle giriş kullanın.'), resultNode);
    mount(container, screen);
    // 005.08: `#/tara?kod=…` (from the search screen) fills the input and resolves ONCE through the same record path as a typed scan.
    if (opts.code && !last) {
        input.value = opts.code;
        void submit('MANUAL');
    }
}
