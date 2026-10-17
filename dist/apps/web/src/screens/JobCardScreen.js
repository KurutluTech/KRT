// KMI-011 — İş kartı: iş emrinin operasyonları (izlenebilir OP kimliği), her operasyonun geçerli teknik belgeleri, belge kapısı ve operasyon taraması (yanlış operasyon reddedilir).
// QR yalnız GÖRÜNTÜLEME açar; işlem yetkisi vermez. Hesap ve kapılar sunucuda.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `.jc{font-family:system-ui,sans-serif;padding:12px;max-width:900px;margin:0 auto;color:#e2e8f0}.jc h1{color:#fff;font-size:20px}.jc .card{background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0;overflow-wrap:anywhere}
.jc .bad{border-color:#b91c1c}.jc .ok{border-color:#15803d}.jc input{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;width:100%;box-sizing:border-box}
.jc button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;background:#1d4ed8;color:#fff}.jc .mut{color:#94a3b8;font-size:12px}.jc .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}`;
export async function renderJobCardScreen(container, api, wo) {
    const shell = (...kids) => mount(container, h('div', { class: 'jc', 'data-testid': 'jc-root' }, h('style', {}, CSS), ...kids));
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
    const scan = async () => {
        try {
            const r = await api.scan(inp.value.trim(), wo);
            res.className = 'card ok';
            res.textContent = `Doğru iş emri: ${r.opCode} ${r.name} · ${r.status}${r.routingVersionNo ? ` · rota sürümü ${r.routingVersionNo}` : ''}`;
        }
        catch (e) {
            res.className = 'card bad';
            res.textContent = errorText(e);
        }
    };
    const gate = jc.documentGate ? String(jc.documentGate.reason ?? jc.documentGate) : null;
    shell(h('h1', {}, `İş kartı · ${wo.slice(0, 8)} · ${jc.qtyPlanned} adet${jc.revision ? ` · Rev ${jc.revision}` : ''}`), gate ? h('div', { class: 'card bad', 'data-testid': 'jc-gate' }, `Belge kapısı: ${gate}`) : null, h('div', { class: 'card' }, h('div', { class: 'row' }, inp, h('button', { type: 'button', 'data-testid': 'jc-scan-go', onClick: () => void scan() }, 'Operasyonu doğrula')), res), ...jc.operations.map((o) => h('div', { class: 'card', 'data-testid': 'jc-op', 'data-op': o.opCode }, h('div', { class: 'row' }, h('b', {}, o.opCode), h('span', {}, o.name), h('span', { class: 'mut' }, `${o.status} · iz kodu ${o.traceRef}${o.routingVersionNo ? ` · rota v${o.routingVersionNo}` : ''}`)), h('div', { class: 'mut' }, `Hazırlık ${o.setupMinutes ?? 'VERİ YOK'} dk · Çevrim ${o.cycleSeconds ?? 'VERİ YOK'} sn · giren ${o.qtyIn} iyi ${o.qtyGood} fire ${o.qtyScrap}${o.firstPieceRequired ? ' · ilk parça şart' : ''}${o.qcRequired ? ' · kalite şart' : ''}`), o.instructions ? h('div', {}, o.instructions) : null, h('div', { class: 'mut', 'data-testid': 'jc-qr' }, o.qr.operation), ...(o.documents.length ? o.documents.map((d) => h('div', { 'data-testid': 'jc-doc' }, `${String(d.docNo ?? d.doc_no ?? '')} ${String(d.title ?? '')} · ${String(d.validity ?? d.state ?? '')}`)) : [h('div', { class: 'mut' }, 'Bu operasyona bağlı geçerli belge yok')]))));
}
