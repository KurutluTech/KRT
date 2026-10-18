// KMI — PDF → OrderExtraction: text layer first; scanned (image-only) PDFs go through an OCR engine IF one is installed.
// The OCR engine is a drop-in module (apps/web/vendor/ocr/engine.js, default export = factory returning {name, recognize(jpegBytes)}).
// It runs in the browser: no server, no per-page cost. Without it the screen says so plainly and falls back to manual entry.
import { extractPdfText, extractPdfImages } from '../../../packages/domain/src/pdfText.js';
import { parseOrderText, parseOcrText } from '../../../packages/domain/src/orderPdf.js';
import { openPdfRenderer } from './pdfRender.js';
const EMPTY_HEADER = { po_number: null, po_date: null, currency: null, payment_terms: null, delivery_terms: null, customer_name: null, customer_no: null, delivery_date: null, notes: null };
const empty = (extractor, warnings) => ({ extractor, header: { ...EMPTY_HEADER }, lines: [], warnings });
export async function loadOcrEngine() {
    const injected = globalThis.__KMI_OCR;
    if (injected === null)
        return null; // explicit "no engine" (tests / kiosk lock-down)
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
export async function extractOrder(bytes, opts = {}) {
    const o = opts === null ? { engine: null } : 'recognize' in opts ? { engine: opts } : opts;
    const t0 = Date.now();
    o.onProgress?.({ phase: 'TEXT', page: 0, pages: 0 });
    const tx = await extractPdfText(bytes);
    if (tx.source === 'TEXT_LAYER')
        return { mode: 'TEXT_LAYER', extraction: parseOrderText(tx.pages.flatMap((p) => p.lines.map((l) => l.text)), 'text-layer'), ms: Date.now() - t0 };
    const eng = o.engine === undefined ? await loadOcrEngine() : o.engine;
    const rend = o.renderer === undefined ? await openPdfRenderer(bytes) : o.renderer;
    // page images: bundled pdf.js renders EVERY page; without it fall back to the first embedded JPEG
    const legacy = extractPdfImages(bytes);
    if (!rend && !legacy.images.length)
        return { mode: 'SCAN_UNSUPPORTED', extraction: empty('none-scan', ['NO_TEXT_LAYER']), ms: Date.now() - t0, detail: legacy.unsupported.join('; ') };
    if (!eng) {
        rend?.destroy();
        return { mode: 'SCAN_NO_ENGINE', extraction: empty('none-scan', ['NO_TEXT_LAYER']), ms: Date.now() - t0 };
    }
    try {
        const pages = rend ? rend.pages : 1;
        const texts = [];
        const failed = [];
        for (let n = 1; n <= pages; n++) {
            try {
                o.onProgress?.({ phase: 'RENDER', page: n, pages });
                let jpeg;
                if (rend) {
                    try {
                        jpeg = (await rend.render(n)).jpeg;
                    }
                    catch (re) {
                        const im = legacy.images[n - 1] ?? (pages === 1 ? legacy.images[0] : undefined);
                        if (!im)
                            throw re;
                        jpeg = im.bytes;
                    }
                }
                else
                    jpeg = legacy.images[0].bytes;
                o.onProgress?.({ phase: 'OCR', page: n, pages });
                texts.push(await eng.recognize(jpeg));
            }
            catch (e) {
                failed.push(n);
                texts.push('');
                if (pages === 1)
                    throw e;
            }
        }
        if (failed.length === pages)
            throw new Error('Hiçbir sayfa okunamadı');
        const ex = parseOcrText(texts.join('\n'), eng.name);
        if (failed.length)
            ex.warnings.push(`OCR_PAGES_FAILED:${failed.join(',')}`);
        if (!rend)
            ex.warnings.push('OCR_FIRST_IMAGE_ONLY');
        return { mode: 'OCR', extraction: ex, ms: Date.now() - t0 };
    }
    catch (e) {
        return { mode: 'OCR_FAILED', extraction: empty('none-scan', ['NO_TEXT_LAYER', 'OCR_FAILED']), ms: Date.now() - t0, detail: String(e.message ?? e) };
    }
    finally {
        rend?.destroy();
    }
}
export const EXTRACT_BANNER = {
    TEXT_LAYER: { kind: 'info', text: 'Veri çıkarıldı. Belgeyle yan yana kontrol edip doğrulayın; hiçbir şey otomatik kesinleşmez.' },
    OCR: { kind: 'info', text: 'Taranmış PDF görüntüden okundu (OCR). Okuma hataları olabilir: HİÇBİR alan doğrulanmış sayılmaz; belgeyle yan yana tek tek kontrol edip düzeltin.' },
    SCAN_NO_ENGINE: { kind: 'info', text: 'Bu PDF taranmış görüntü ve OCR motoru bu kurulumda yüklü değil: metin okunamadı. Belge yanda açık, bilgileri elle girin.' },
    SCAN_UNSUPPORTED: { kind: 'info', text: 'Bu PDF taranmış görüntü ve görüntü biçimi okunamıyor. Belge yanda açık, bilgileri elle girin.' },
    OCR_FAILED: { kind: 'info', text: 'OCR çalışmadı. Belge yanda açık, bilgileri elle girin.' },
};
