const vendorUrl = (rel) => new URL(`../vendor/pdfjs/${rel}`, import.meta.url).href;
export async function openPdfRenderer(bytes) {
    if (typeof document === 'undefined')
        return null;
    let lib;
    try {
        lib = await import(/* @vite-ignore */ vendorUrl('pdf.min.mjs'));
    }
    catch {
        return null;
    }
    try {
        lib.GlobalWorkerOptions.workerSrc = vendorUrl('pdf.worker.min.mjs');
        const doc = await lib.getDocument({ data: bytes.slice(), wasmUrl: vendorUrl('wasm/'), isEvalSupported: false, useSystemFonts: false }).promise;
        return {
            pages: doc.numPages,
            async render(n, scale = 2.2) {
                const pg = await doc.getPage(n);
                const vp = pg.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(vp.width);
                canvas.height = Math.ceil(vp.height);
                const ctx = canvas.getContext('2d');
                if (!ctx)
                    throw new Error('Canvas kullanılamıyor');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await pg.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
                const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
                pg.cleanup();
                if (!blob)
                    throw new Error('Sayfa görüntüye çevrilemedi');
                return { page: n, jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
            },
            destroy() { void doc.destroy(); },
        };
    }
    catch {
        return null;
    }
}
