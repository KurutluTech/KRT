// KMI OCR engine adapter: tesseract.js running ENTIRELY from files bundled in this folder (no CDN).
// Required files (installed by `node scripts/vendor-ocr.mjs` on a machine with npm access; hashes in SHA256SUMS.txt):
//   tesseract/tesseract.min.js, tesseract/worker.min.js, tesseract/core/*.wasm(.js), tesseract/lang/{eng,tur}.traineddata.gz
// If any is missing this module returns null and the screen says "OCR motoru yüklü değil" — it never pretends to read.
const here = (rel) => new URL(rel, import.meta.url).href;
const need = ['tesseract/tesseract.min.js', 'tesseract/worker.min.js', 'tesseract/lang/eng.traineddata.gz', 'tesseract/lang/tur.traineddata.gz'];

async function present(url) { try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; } }

export default async function createEngine() {
  for (const f of need) if (!(await present(here(f)))) return null;
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = here('tesseract/tesseract.min.js'); s.onload = ok; s.onerror = () => bad(new Error('tesseract.js yüklenemedi')); document.head.appendChild(s); });
  const T = globalThis.Tesseract; if (!T) return null;
  let worker = null;
  const get = async () => worker ?? (worker = await T.createWorker('tur+eng', 1, { workerPath: here('tesseract/worker.min.js'), corePath: here('tesseract/core/'), langPath: here('tesseract/lang/'), workerBlobURL: false, gzip: true }));
  return {
    name: 'tesseract.js',
    async recognize(jpeg) { const w = await get(); const { data } = await w.recognize(new Blob([jpeg], { type: 'image/jpeg' })); return data.text; },
  };
}
