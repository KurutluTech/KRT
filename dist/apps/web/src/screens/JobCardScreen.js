// KMI-011 — İş kartı: iş emrinin operasyonları (izlenebilir OP kimliği), her operasyonun geçerli teknik belgeleri, belge kapısı ve operasyon taraması (yanlış operasyon reddedilir).
// QR yalnız GÖRÜNTÜLEME açar; işlem yetkisi vermez. Hesap ve kapılar sunucuda.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { encodeCode128B, code128ToSvg } from '../../../../packages/ui/src/code128.js';
import { buildTraveler, createScanDebounce } from '../jobTraveler.js';
const PRINT_CSS = `@media print{body *{visibility:hidden}.jc-sheet,.jc-sheet *{visibility:visible}.jc-sheet{position:absolute;left:0;top:0;width:100%;color:#000!important;background:#fff!important}.jc-noprint{display:none!important}}
@page{margin:8mm}.jc-print{overflow-x:auto;max-width:100%}@media print{.jc-print{overflow:visible}}.jc-sheet{background:#fff;color:#000;border-radius:8px;padding:10px;margin:10px 0}.jc-sheet.A5{max-width:148mm}.jc-sheet.A4{max-width:210mm}.jc-sheet table{width:100%;border-collapse:collapse;font-size:12px}.jc-sheet td,.jc-sheet th{border:1px solid #000;padding:4px;text-align:left;vertical-align:top}.jc-sheet .qrc svg{width:26mm;height:26mm}.jc-sheet .bc svg{max-width:100%;height:10mm}`;
const CSS = `.jc{font-family:system-ui,sans-serif;padding:12px;max-width:900px;margin:0 auto;color:#e2e8f0}.jc h1{color:#fff;font-size:20px}.jc .card{background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0;overflow-wrap:anywhere}
.jc .bad{border-color:#b91c1c}.jc .ok{border-color:#15803d}.jc input{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;width:100%;box-sizing:border-box}
.jc button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;background:#1d4ed8;color:#fff}.jc .mut{color:#94a3b8;font-size:12px}.jc .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}`;
const svgBox = (svg, cls) => { const b = h('div', { class: cls }); b.innerHTML = svg; /* locally generated SVG, no user text */ /* locally generated SVG, no user text */ return b; };
function sheet(t) {
    return h('div', { class: `jc-sheet ${t.size}`, 'data-testid': 'jc-sheet', 'data-size': t.size }, h('div', { style: 'display:flex;gap:10px;align-items:center' }, svgBox(qrToSvg(encodeQr(t.woQr, 'M'), 34), 'qrc'), h('div', { style: 'flex:1' }, h('div', { style: 'font-weight:900;font-size:18px' }, `İŞ EMRİ ${t.woRef} · ${t.qtyPlanned} adet${t.revision ? ` · Rev ${t.revision}` : ''}`), h('div', {}, `Durum: ${t.status}`), t.gate ? h('div', { style: 'font-weight:700' }, `Belge kapısı: ${t.gate}`) : null, svgBox(code128ToSvg(encodeCode128B(t.woRef.toUpperCase()), 0.33, 10), 'bc'))), h('table', { 'data-testid': 'jc-sheet-ops' }, h('tr', {}, ...['Op', 'Operasyon', 'Adet', 'Hazırlık/Çevrim', 'Kapılar', 'QR'].map((x) => h('th', {}, x))), ...t.ops.map((o) => h('tr', { 'data-testid': 'jc-sheet-op', 'data-op': o.opCode }, h('td', {}, o.opCode), h('td', {}, o.name, o.instructions ? h('div', {}, o.instructions) : null, ...o.documents.map((d) => h('div', {}, `Belge: ${d}`))), h('td', {}, String(o.qtyIn)), h('td', {}, `${o.setupMinutes ?? '—'} dk / ${o.cycleSeconds ?? '—'} sn`), h('td', {}, [o.firstPieceRequired ? 'İlk parça' : '', o.qcRequired ? 'Kalite' : ''].filter(Boolean).join(' · ') || '—'), h('td', { class: 'qrc' }, svgBox(qrToSvg(encodeQr(o.qrPayload, 'M'), 34), 'qrc'), h('div', { style: 'font-size:10px' }, o.traceRef))))), h('div', { style: 'font-size:10px;margin-top:6px', 'data-testid': 'jc-sheet-note' }, t.footnote));
}
export async function renderJobCardScreen(container, api, wo, focusOpId = null) {
    const shell = (...kids) => mount(container, h('div', { class: 'jc', 'data-testid': 'jc-root' }, h('style', {}, CSS + PRINT_CSS), ...kids));
    if (!wo)
        return shell(h('h1', {}, 'İş kartı'), h('div', { class: 'card mut' }, 'Bir iş emri seçin: #/is-karti?is=<iş emri>'));
    let jc;
    try {
        jc = await api.load(wo);
    }
    catch (e) {
        return shell(h('h1', {}, 'İş kartı'), h('div', { class: 'card bad', 'data-testid': 'jc-error' }, errorText(e)));
    }
    const res = h('div', { 'data-testid': 'jc-scan-result' });
    const inp = h('input', { 'data-testid': 'jc-scan-input', placeholder: 'Operasyon QR kodunu okutun / yapıştırın (KMI:OP:…)' });
    const fresh = createScanDebounce();
    let size = 'A4';
    const sheetBox = h('div', { class: 'jc-print' });
    const showSheet = (sz) => { size = sz; const t = buildTraveler({ ...jc, workOrderId: wo }, size); sheetBox.replaceChildren(sheet(t)); };
    const scan = async () => {
        if (!fresh(inp.value.trim())) {
            res.className = 'card';
            res.textContent = 'Aynı kod az önce okutuldu — tekrar işlenmedi.';
            return;
        }
        try {
            const r = await api.scan(inp.value.trim(), wo);
            res.className = 'card ok';
            res.setAttribute('data-op', r.opCode);
            res.textContent = `Doğru iş emri (yalnız kimlik doğrulandı, işlem başlamadı): ${r.opCode} ${r.name} · ${r.status}${r.routingVersionNo ? ` · rota sürümü ${r.routingVersionNo}` : ''}`;
        }
        catch (e) {
            res.className = 'card bad';
            res.textContent = errorText(e);
        }
    };
    const gate = jc.documentGate ? String(jc.documentGate.reason ?? jc.documentGate) : null;
    shell(h('h1', {}, `İş kartı · ${wo.slice(0, 8)} · ${jc.qtyPlanned} adet${jc.revision ? ` · Rev ${jc.revision}` : ''}`), gate ? h('div', { class: 'card bad', 'data-testid': 'jc-gate' }, `Belge kapısı: ${gate}`) : null, h('div', { class: 'card jc-noprint' }, h('div', { class: 'row' }, h('button', { type: 'button', 'data-testid': 'jc-print-a4', onClick: () => { showSheet('A4'); } }, 'A4 föy'), h('button', { type: 'button', 'data-testid': 'jc-print-a5', onClick: () => { showSheet('A5'); } }, 'A5 föy'), h('button', { type: 'button', 'data-testid': 'jc-print-go', onClick: () => { if (!sheetBox.firstChild)
            showSheet(size); window.print(); } }, 'Yazdır')), h('div', { class: 'mut' }, 'Föyde müşteri, fiyat, maliyet ve satınalma bilgisi yoktur; QR yalnız kimliktir.')), sheetBox, h('div', { class: 'card jc-noprint' }, h('div', { class: 'row' }, inp, h('button', { type: 'button', 'data-testid': 'jc-scan-go', onClick: () => void scan() }, 'Operasyonu doğrula')), res), ...jc.operations.map((o) => h('div', { class: focusOpId && o.id === focusOpId ? 'card ok' : 'card', 'data-testid': 'jc-op', 'data-op': o.opCode, ...(focusOpId && o.id === focusOpId ? { 'data-focus': '1' } : {}) }, h('div', { class: 'row' }, h('b', {}, o.opCode), h('span', {}, o.name), h('span', { class: 'mut' }, `${o.status} · iz kodu ${o.traceRef}${o.routingVersionNo ? ` · rota v${o.routingVersionNo}` : ''}`)), h('div', { class: 'mut' }, `Hazırlık ${o.setupMinutes ?? 'VERİ YOK'} dk · Çevrim ${o.cycleSeconds ?? 'VERİ YOK'} sn · giren ${o.qtyIn} iyi ${o.qtyGood} fire ${o.qtyScrap}${o.firstPieceRequired ? ' · ilk parça şart' : ''}${o.qcRequired ? ' · kalite şart' : ''}`), o.instructions ? h('div', {}, o.instructions) : null, h('div', { class: 'mut', 'data-testid': 'jc-qr' }, o.qr.operation), ...(o.documents.length ? o.documents.map((d) => h('div', { 'data-testid': 'jc-doc' }, `${String(d.docNo ?? d.doc_no ?? '')} ${String(d.title ?? '')} · ${String(d.validity ?? d.state ?? '')}`)) : [h('div', { class: 'mut' }, 'Bu operasyona bağlı geçerli belge yok')]))));
}
