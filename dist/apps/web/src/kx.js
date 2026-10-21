// KMI ortak mühendislik arayüz standardı ("kx") — Ürün Çalışma Alanı, Doküman Kontrol ve sonraki Master V4 paketlerinin ORTAK kart / tipografi / buton / input / rozet / durum bileşenleri.
// Tek sistem: aynı ölçüler her ekranda. Mevcut koyu lacivert kimlik ve marka renkleri korunur; yeni tema yok. Kapsam: bu dosyayı kullanan ekranlar (`.kx` kökü altında) — diğer ekranlara sızmaz.
//   Tipografi : taban 14/1.5 · başlık 18 · kart başlığı 15 · etiket/yardımcı 12 · rozet 11.
//   Ölçüler   : kart padding 16, kart arası boşluk 14, radius 14 · buton yüksekliği 36 (dokunmatik/≤1100px: 44) · input 38 (≤1100px: 44).
//   Düzen     : 12 sütunlu ızgara (`.kx-span-N`); ≥1100px yan yana, ≤1100px iki, ≤700px tek sütun.
import { h } from '../../../packages/ui/src/h.js';
export const KX_CSS = `
.kx{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;color:#e2e8f0;padding:16px;max-width:1240px;margin:0 auto;box-sizing:border-box}
.kx *{box-sizing:border-box}
.kx h1{color:#fff;font-size:18px;line-height:1.3;font-weight:700;margin:0;overflow-wrap:anywhere}
.kx h2{color:#fff;font-size:15px;line-height:1.3;font-weight:700;margin:0;overflow-wrap:anywhere}
.kx h3{color:#cbd5e1;font-size:12px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin:14px 0 6px}
.kx a{color:#93c5fd}
.kx .mut{color:#94a3b8;font-size:12px;line-height:1.45}.kx .mut b{color:#cbd5e1}
.kx .grow{flex:1 1 220px;min-width:0}
.kx .tw-wrap{overflow-x:auto;max-width:100%;border:1px solid #334155;border-radius:8px}.kx .tw-t{border-collapse:collapse;width:100%;font-size:13px;min-width:640px}.kx .tw-t th{text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;white-space:nowrap}
.kx .tw-t td{padding:4px 6px;border-top:1px solid #1e293b;vertical-align:middle}.kx .tw-t input{width:100%;min-width:70px;min-height:34px;font-size:14px}.kx .tw-t input.tw-missing{border-color:#f59e0b;background:rgba(245,158,11,.10)}.kx .tw-t input.tw-bad{border-color:#ef4444}.kx .tw-desc{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kx .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.kx .row>*{min-width:0}
.kx .stack{display:flex;flex-direction:column;gap:8px}
.kx .nowrap{white-space:nowrap}
.kx .trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
/* sayfa başlığı */
.kx .page-head{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
.kx .page-head .ttl{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:4px}
.kx .page-head .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.kx .crumb{font-size:12px;color:#94a3b8}.kx .crumb button{min-height:0;padding:2px 0;background:none;color:#93c5fd;font-weight:600;font-size:12px}
/* ızgara */
.kx .kx-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px;align-items:start}
.kx .kx-span-12{grid-column:span 12}.kx .kx-span-8{grid-column:span 8}.kx .kx-span-7{grid-column:span 7}.kx .kx-span-6{grid-column:span 6}.kx .kx-span-5{grid-column:span 5}.kx .kx-span-4{grid-column:span 4}
@media (max-width:1100px){.kx .kx-span-8,.kx .kx-span-7,.kx .kx-span-6,.kx .kx-span-5,.kx .kx-span-4{grid-column:span 6}}
@media (max-width:760px){.kx .kx-grid{gap:12px}.kx .kx-span-8,.kx .kx-span-7,.kx .kx-span-6,.kx .kx-span-5,.kx .kx-span-4,.kx .kx-span-12{grid-column:span 12}.kx{padding:12px}}
/* kart */
.kx .kx-card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:16px;min-width:0;overflow-wrap:anywhere;scroll-margin-top:72px}
.kx .kx-card.bad{border-color:#b91c1c}.kx .kx-card.ok{border-color:#15803d}.kx .kx-card.warn{border-color:#b45309}.kx .kx-card.info{border-color:#1d4ed8}
.kx .kx-card>.kx-head{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between;margin-bottom:10px}
.kx .kx-card>.kx-head .t{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;min-width:0;flex:1 1 160px}
.kx .kx-card>.kx-head .a{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.kx .kx-card .kx-foot{margin-top:12px;padding-top:10px;border-top:1px solid #1e293b;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}
.kx .kx-sub{border:1px solid #1e293b;border-radius:12px;padding:12px;background:#0b1220;min-width:0}
.kx .kx-empty{border:1px dashed #334155;border-radius:12px;padding:14px;color:#94a3b8;font-size:13px;display:flex;flex-direction:column;gap:2px}
.kx .kx-empty b{color:#e2e8f0;font-size:13px}
.kx .banner{border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:13px;font-weight:600;border:1px solid #1d4ed8;background:rgba(30,58,138,.28);color:#dbeafe}
.kx .banner.bad{border-color:#b91c1c;background:rgba(127,29,29,.3);color:#fecaca}.kx .banner.ok{border-color:#15803d;background:rgba(20,83,45,.3);color:#bbf7d0}
/* buton — üç aile: birincil · ikincil (ghost) · tehlikeli; boyut tek */
.kx button,.kx a.btn{min-height:36px;font-size:13px;font-weight:700;border-radius:10px;border:0;padding:6px 14px;cursor:pointer;line-height:1.25;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;text-align:center;max-width:100%;white-space:normal;font-family:inherit}
.kx .primary{background:#1d4ed8;color:#fff}.kx .primary:hover{background:#2563eb}
.kx .ghost{background:#1e293b;color:#e2e8f0}.kx .ghost:hover{background:#273449}
.kx .good{background:#166534;color:#dcfce7}.kx .good:hover{background:#15803d}
.kx .danger{background:#7f1d1d;color:#fecaca}.kx .danger:hover{background:#991b1b}
.kx .sm{min-height:32px;padding:4px 10px;font-size:12px}
.kx .icon{min-width:36px;padding:4px 8px}
.kx .linkbtn{background:none;color:#93c5fd;padding:4px 2px;min-height:32px;font-weight:600}
.kx button:disabled{background:#273244;color:#8b99ad;cursor:not-allowed}
.kx button:focus-visible,.kx a:focus-visible,.kx input:focus-visible,.kx select:focus-visible,.kx textarea:focus-visible,.kx summary:focus-visible{outline:3px solid #67e8f9;outline-offset:2px}
/* form */
.kx input,.kx select,.kx textarea{min-height:38px;font-size:14px;font-family:inherit;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;width:100%;min-width:0}
.kx textarea{padding:8px 10px;min-height:68px;line-height:1.4;resize:vertical}
.kx input[type=checkbox]{width:20px;height:20px;min-height:20px;padding:0;accent-color:#3b82f6}
.kx input[type=file]{padding:6px 8px;height:auto;min-height:38px;font-size:13px}
.kx input[aria-invalid=true]{border-color:#ef4444;box-shadow:0 0 0 1px #ef4444}
.kx label.f{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#94a3b8;min-width:0}
.kx label.f .hint{font-size:11px;color:#94a3b8}
.kx label.chk{display:inline-flex;gap:8px;align-items:center;font-size:13px;color:#e2e8f0;min-height:32px}
.kx .fgrid{display:grid;gap:10px 12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))}
.kx .fgrid.w2{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
.kx .fsec{margin:0;border:1px solid #1e293b;border-radius:12px;padding:12px;min-width:0}
.kx .fsec>legend{padding:0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;font-weight:700}
.kx .formbox{margin-top:10px;border:1px solid #1d4ed8;border-radius:12px;padding:12px;background:rgba(30,58,138,.12);display:flex;flex-direction:column;gap:10px}
/* rozet */
.kx .chip{display:inline-flex;align-items:center;gap:4px;padding:1px 9px;border-radius:999px;font-weight:700;font-size:11px;line-height:1.7;background:#1e293b;color:#e6edf7;white-space:nowrap;max-width:100%}
.kx .chip.ok{background:#14532d;color:#bbf7d0}.kx .chip.warn{background:#78350f;color:#fde68a}.kx .chip.bad{background:#7f1d1d;color:#fecaca}.kx .chip.info{background:#1e3a8a;color:#dbeafe}.kx .chip.off{background:#273244;color:#94a3b8}
.kx .ok{--tone:#86efac}.kx .warn{--tone:#fcd34d}.kx .bad{--tone:#fca5a5}.kx .info{--tone:#93c5fd}
/* anahtar-değer şeridi */
.kx .kv{display:grid;gap:10px 18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))}
.kx .kv>div{min-width:0}.kx .kv .k{font-size:11px;color:#94a3b8;letter-spacing:.04em;text-transform:uppercase}.kx .kv .v{font-size:14px;font-weight:600;color:#fff;overflow-wrap:anywhere;line-height:1.35}.kx .kv .v.na{color:#94a3b8;font-weight:500}
/* hazırlık şeridi */
.kx .ready{display:flex;flex-wrap:wrap;gap:6px}.kx .ready button{min-height:32px;padding:3px 10px;font-size:12px;border:1px solid #334155;background:#0f172a;color:#e2e8f0}
.kx .ready button .dot{width:8px;height:8px;border-radius:50%;background:#64748b;display:inline-block}
.kx .ready button.ok .dot{background:#22c55e}.kx .ready button.info .dot{background:#3b82f6}.kx .ready button.bad .dot{background:#ef4444}.kx .ready button.warn .dot{background:#f59e0b}
/* tablo / satır listesi: masaüstünde sütun, dar ekranda kart */
.kx .tw{overflow-x:auto}.kx table{border-collapse:collapse;width:100%;font-size:13px}.kx th,.kx td{border-bottom:1px solid #1e293b;padding:7px 8px;text-align:left;vertical-align:top}.kx th{color:#94a3b8;font-size:11px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;font-weight:700}
.kx .rows{display:flex;flex-direction:column}
.kx .rows .r{display:grid;gap:4px 14px;align-items:center;padding:10px 4px;border-top:1px solid #1e293b;min-width:0}.kx .rows .r:first-child{border-top:0}.kx .rows .r.hd{padding:2px 4px 6px;font-size:11px;color:#94a3b8;letter-spacing:.04em;text-transform:uppercase;font-weight:700;border-top:0}
.kx .rows .r>*{min-width:0;overflow-wrap:anywhere}.kx .rows .r .cell-l{display:none;font-size:11px;color:#94a3b8}
.kx .rows .r .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.kx .rows .r.off{opacity:.62}
@media (max-width:900px){.kx .rows .r.hd{display:none}.kx .rows .r{grid-template-columns:1fr !important;gap:2px;padding:12px;border:1px solid #1e293b;border-radius:12px;margin-top:8px;background:#0b1220}.kx .rows .r:first-child{margin-top:0;border-top:1px solid #1e293b}.kx .rows .r .cell-l{display:inline;margin-right:6px}.kx .rows .r .acts{justify-content:flex-start;margin-top:4px}}
/* açılır bölüm */
.kx details.fold{border:1px solid #1e293b;border-radius:12px;background:#0b1220}.kx details.fold>summary{cursor:pointer;list-style:none;padding:9px 12px;font-weight:700;font-size:13px;color:#cbd5e1;display:flex;gap:8px;align-items:center;min-height:36px}
.kx details.fold>summary::-webkit-details-marker{display:none}.kx details.fold>summary::before{content:'▸';color:#94a3b8;font-size:11px}.kx details.fold[open]>summary::before{content:'▾'}
.kx details.fold>.in{padding:2px 12px 12px}
/* adım göstergesi (onay akışı) */
.kx .steps{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px}
.kx .steps .s{display:inline-flex;gap:6px;align-items:center;padding:3px 10px;border-radius:999px;border:1px solid #334155;color:#94a3b8;background:#0f172a;white-space:nowrap}
.kx .steps .s.done{border-color:#15803d;color:#bbf7d0}.kx .steps .s.cur{border-color:#3b82f6;background:#1e3a8a;color:#fff;font-weight:700}.kx .steps .s.bad{border-color:#b91c1c;color:#fecaca}
.kx .steps .sep{color:#475569}
/* dosya görüntüleme */
.kx .fileview iframe,.kx .fileview img{width:100%;min-height:420px;border:1px solid #334155;border-radius:10px;background:#fff;max-width:100%}.kx .fileview pre{white-space:pre-wrap;background:#0b1220;padding:10px;border-radius:8px;max-height:320px;overflow:auto;font-size:12px;margin:0}
@media (max-width:1100px){
  .kx button,.kx a.btn{min-height:44px !important}.kx .sm{min-height:44px !important}.kx input,.kx select{min-height:44px !important;font-size:16px}.kx textarea{font-size:16px;min-height:76px !important}
  .kx input[type=checkbox]{width:24px;height:24px;min-height:24px !important}.kx label.chk{min-height:44px}.kx .linkbtn{min-height:44px}.kx .ready button{min-height:44px !important}.kx .icon{min-width:44px}.kx .counts button{min-height:44px !important}
}
`;
export const chip = (text, tone = '', extra = {}) => h('span', { class: `chip ${tone}`, ...extra }, text);
/** Standart kart: başlık satırı (başlık + durum rozeti solda, işlemler sağda) + gövde. Boşluklar tek yerden gelir. */
export function card(o, ...body) {
    return h('section', { class: `kx-card kx-span-${o.span ?? 12} ${o.tone ?? ''}`, ...(o.testid ? { 'data-testid': o.testid } : {}), ...(o.id ? { id: o.id } : {}), ...(o.attrs ?? {}) }, h('div', { class: 'kx-head' }, h('div', { class: 't' }, h('h2', {}, o.title), o.chip ?? null), o.actions?.length ? h('div', { class: 'a' }, ...o.actions) : null), ...body);
}
/** Boş durum: ne eksik + (varsa) ne yapılacağı. Sıfır/boş değer "0" olarak gösterilmez. */
export const emptyState = (title, detail, testid) => h('div', { class: 'kx-empty', ...(testid ? { 'data-testid': testid } : {}) }, h('b', {}, title), detail ? h('span', {}, detail) : null);
/** Etiketli alan: label > (input) + ipucu. Input'un kendi data-testid'si korunur. */
export const field = (label, input, hint) => h('label', { class: 'f' }, label, input, hint ? h('span', { class: 'hint' }, hint) : null);
export const fold = (title, body, open = false, testid) => h('details', { class: 'fold', ...(open ? { open: 'open' } : {}), ...(testid ? { 'data-testid': testid } : {}) }, h('summary', {}, title), h('div', { class: 'in' }, ...body));
export const kvItem = (k, v, na = 'VERİ YOK') => h('div', {}, h('div', { class: 'k' }, k), h('div', { class: `v${v ? '' : ' na'}` }, v || na));
/** Sunucuda onaylı olmayan/bilinmeyen değer 0 yazılmaz. */
export const NA = 'VERİ YOK';
export const fmt = (v, max = 3) => (v === null || v === undefined ? NA : v.toLocaleString('tr-TR', { maximumFractionDigits: max }));
export const when = (s) => (s ? s.slice(0, 16).replace('T', ' ') : '—');
export const val = (x) => x.value;
export const isChecked = (x) => x.checked;
export const invalid = (el, on) => { if (on)
    el.setAttribute('aria-invalid', 'true');
else
    el.removeAttribute('aria-invalid'); };
export function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
export function fromBase64(b64) { const s = atob(b64); const out = new Uint8Array(new ArrayBuffer(s.length)); for (let i = 0; i < s.length; i += 1)
    out[i] = s.charCodeAt(i); return out; }
export const kb = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export function previewKind(mime, fileName = '') {
    if (mime === 'application/pdf')
        return 'pdf';
    if (['image/png', 'image/jpeg', 'image/webp'].includes(mime))
        return 'image';
    if (mime === 'text/plain' || mime === 'text/csv')
        return /\.(step|stp|iges|igs|dxf)$/i.test(fileName) ? 'none' : 'text';
    return 'none';
}
/** Dosyayı (bütünlüğü doğrulanmış bayt dizisi) kullanıcıya gösterir ya da indirtir. `host` boşaltılıp yeniden doldurulur. */
export function showFile(host, o) {
    const t = o.testids ?? {};
    const url = URL.createObjectURL(new Blob([o.bytes], { type: o.mime }));
    if (o.download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = o.fileName;
        a.dataset.testid = t.link ?? 'file-download-link';
        a.textContent = `İndirilen: ${o.fileName}`;
        host.append(a);
        a.click?.();
        return;
    }
    const k = previewKind(o.mime, o.fileName);
    if (k === 'pdf')
        host.append(h('iframe', { src: url, title: o.fileName, 'data-testid': t.frame ?? 'file-frame' }));
    else if (k === 'image')
        host.append(h('img', { src: url, alt: o.fileName, 'data-testid': t.img ?? 'file-img' }));
    else if (k === 'text')
        host.append(h('pre', { 'data-testid': t.text ?? 'file-text' }, new TextDecoder().decode(o.bytes.subarray(0, 20000))));
    else
        host.append(emptyState('Bu dosya biçimi tarayıcıda önizlenemez', `${o.fileName} — doğru uygulamada açmak için “İndir” kullanın. Sahte önizleme gösterilmez.`, t.none ?? 'file-nopreview'));
}
