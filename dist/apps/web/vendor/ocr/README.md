# OCR motoru (tarayıcıda çalışır, CDN yok)
Paketli dosyalar: `tesseract/` (tesseract.js 5.1.1 + core WASM + `tur`/`eng` tessdata_fast), `SHA256SUMS.txt`. Yeniden kurmak: `node scripts/vendor-ocr.mjs` (jsDelivr + raw.githubusercontent erişimi gerekir).
`engine.js` dosyalar eksikse `null` döner → ekran "OCR motoru yüklü değil" der, elle girişe geçer. OCR çıktısı hiçbir zaman doğrulanmış veri sayılmaz.
