// KMI — PDF → OrderExtraction: text layer first; scanned (image-only) PDFs go through an OCR engine IF one is installed.
// The OCR engine is a drop-in module (apps/web/vendor/ocr/engine.js, default export = factory returning {name, recognize(jpegBytes)}).
// It runs in the browser: no server, no per-page cost. Without it the screen says so plainly and falls back to manual entry.
import { extractPdfText, extractPdfImages } from '../../../packages/domain/src/pdfText.js';
import { parseOrderText, parseOcrText } from '../../../packages/domain/src/orderPdf.js';
const EMPTY_HEADER = { po_number: null, po_date: null, currency: null, payment_terms: null, delivery_terms: null, customer_name: null, customer_no: null, delivery_date: null, notes: null };
const empty = (extractor, warnings) => ({ extractor, header: { ...EMPTY_HEADER }, lines: [], warnings });
export async function loadOcrEngine() {
    const injected = globalThis.__KMI_OCR;
    if (injected && typeof injected.recognize === 'function')
        return injected;
    try {
        const mod = await import(/* @vite-ignore */ new URL('../vendor/ocr/engine.js', import.meta.url).href);
        const eng = mod.default ? await mod.default() : null;
        return eng && typeof eng.recognize === 'function' ? eng : null;
    }
    catch {
        return null;
    }
}
export async function extractOrder(bytes, engine) {
    const t0 = Date.now();
    const tx = await extractPdfText(bytes);
    if (tx.source === 'TEXT_LAYER')
        return { mode: 'TEXT_LAYER', extraction: parseOrderText(tx.pages.flatMap((p) => p.lines.map((l) => l.text)), 'text-layer'), ms: Date.now() - t0 };
    const imgs = extractPdfImages(bytes);
    if (!imgs.images.length)
        return { mode: 'SCAN_UNSUPPORTED', extraction: empty('none-scan', ['NO_TEXT_LAYER']), ms: Date.now() - t0, detail: imgs.unsupported.join('; ') };
    const eng = engine === undefined ? await loadOcrEngine() : engine;
    if (!eng)
        return { mode: 'SCAN_NO_ENGINE', extraction: empty('none-scan', ['NO_TEXT_LAYER']), ms: Date.now() - t0 };
    try {
        const text = await eng.recognize(imgs.images[0].bytes);
        const ex = parseOcrText(text, eng.name);
        return { mode: 'OCR', extraction: ex, ms: Date.now() - t0 };
    }
    catch (e) {
        return { mode: 'OCR_FAILED', extraction: empty('none-scan', ['NO_TEXT_LAYER', 'OCR_FAILED']), ms: Date.now() - t0, detail: String(e.message ?? e) };
    }
}
export const EXTRACT_BANNER = {
    TEXT_LAYER: { kind: 'info', text: 'Veri çıkarıldı. Belgeyle yan yana kontrol edip doğrulayın; hiçbir şey otomatik kesinleşmez.' },
    OCR: { kind: 'info', text: 'Taranmış PDF görüntüden okundu (OCR). Okuma hataları olabilir: HİÇBİR alan doğrulanmış sayılmaz; belgeyle yan yana tek tek kontrol edip düzeltin.' },
    SCAN_NO_ENGINE: { kind: 'info', text: 'Bu PDF taranmış görüntü ve OCR motoru bu kurulumda yüklü değil: metin okunamadı. Belge yanda açık, bilgileri elle girin.' },
    SCAN_UNSUPPORTED: { kind: 'info', text: 'Bu PDF taranmış görüntü ve görüntü biçimi okunamıyor. Belge yanda açık, bilgileri elle girin.' },
    OCR_FAILED: { kind: 'info', text: 'OCR çalışmadı. Belge yanda açık, bilgileri elle girin.' },
};
