// KMI PRE-012 — İş emri kartı (operatör): atanmış işin sade, görev odaklı görünümü. Ticari alan (fiyat, müşteri, sipariş no) YOKTUR:
// veri yalnız RLS kapsamlı, açık sütun listeli okumalardan gelir. Hazırlık/eylem kararı tek yerde (operatorWoCard.ts); sunucu yine doğrular.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildOperatorWoCard } from '../operatorWoCard.js';
import { woStatusText } from './TerminalScreen.js';
import { showFile, fromBase64 } from '../kx.js';
import { errorText } from '../errorText.js';
const CSS = `
.owc{max-width:760px;margin:0 auto;padding:0 14px 40px;box-sizing:border-box;color:var(--kmi-text,#e2e8f0);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.owc h1{font-size:22px;margin:6px 0 2px;color:var(--kmi-text,#fff)}.owc h2{font-size:12px;letter-spacing:.14em;font-weight:800;color:var(--kmi-mut,#94a3b8);margin:20px 0 8px;text-transform:uppercase}
.owc a{color:var(--kmi-info,#38bdf8);font-weight:700;text-decoration:none}
.owc-card{border:1px solid var(--kmi-line,#1e2d4a);border-radius:16px;padding:14px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(10,16,32,.92));margin:10px 0}
.owc-chip{display:inline-block;padding:4px 10px;border-radius:999px;font-weight:800;font-size:13px;border:1px solid var(--kmi-line,#334155)}
.owc-chip.ok{color:#4ade80;border-color:rgba(74,222,128,.5)}.owc-chip.bad{color:#f87171;border-color:rgba(248,113,113,.5)}.owc-chip.mut{color:#94a3b8}
.owc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px 14px;margin-top:10px}
.owc-l{font-size:11px;letter-spacing:.1em;font-weight:800;color:var(--kmi-mut,#94a3b8)}.owc-v{font-size:22px;font-weight:900}.owc-v.unk{color:#94a3b8;font-size:16px}
.owc-bar{height:10px;background:#1e293b;border-radius:6px;overflow:hidden;margin-top:10px}.owc-bar>div{height:100%;background:#22c55e}
.owc-bl{padding:8px 0;border-top:1px solid var(--kmi-line,#1e2d4a)}.owc-bl:first-of-type{border-top:0}.owc-bl b{display:block}.owc-bl span{font-size:13px;color:var(--kmi-text2,#cbd5e1)}
.owc-acts{display:grid;gap:10px}.owc button,.owc .owc-btn{min-height:52px;font-size:16px;font-weight:800;border-radius:14px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;cursor:pointer;padding:0 16px;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none}
.owc button.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}.owc button[disabled]{opacity:.45;cursor:not-allowed}
.owc-why{font-size:13px;color:#fbbf24;margin:-4px 0 2px}.owc-doc{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--kmi-line,#1e2d4a)}
.owc-pdf{margin-top:8px}.owc-pdf iframe,.owc-pdf img{width:100%;min-height:420px;border:0;border-radius:10px;background:#fff}
@media (max-width:520px){.owc h1{font-size:19px}.owc-v{font-size:20px}}`;
export async function renderOperatorWoCardScreen(container, deps, woId) {
    const shell = (...kids) => mount(container, h('div', { class: 'owc', 'data-testid': 'owc-root' }, h('style', {}, CSS), ...kids));
    const back = h('a', { href: '#/operator', 'data-testid': 'owc-back' }, '← Benim işlerim');
    if (!woId) {
        shell(back, h('div', { class: 'owc-card', 'data-testid': 'owc-none' }, 'İş emri seçilmedi. Benim işlerim ekranından bir iş seçin.'));
        return;
    }
    shell(back, h('div', { class: 'owc-card' }, 'Yükleniyor…'));
    let raw;
    try {
        raw = await deps.api.load(woId);
    }
    catch (e) {
        shell(back, h('div', { class: 'owc-card', 'data-testid': 'owc-error', role: 'alert' }, `Yüklenemedi: ${errorText(e)}`));
        return;
    }
    if (!raw) {
        shell(back, h('div', { class: 'owc-card', 'data-testid': 'owc-denied', role: 'alert' }, 'Bu iş emri size atanmış değil ya da bulunamadı.'));
        return;
    }
    const c = buildOperatorWoCard(raw);
    const pct = c.qty.planned > 0 ? Math.min(100, Math.round((c.qty.good / c.qty.planned) * 100)) : 0;
    const kpi = (l, v, tid) => h('div', {}, h('div', { class: 'owc-l' }, l), h('div', { class: `owc-v${v === null ? ' unk' : ''}`, 'data-testid': tid }, v === null ? 'BİLİNMİYOR' : String(v)));
    const docHost = h('div', { class: 'owc-pdf', 'data-testid': 'owc-doc-view' });
    const act = (a) => {
        const onClick = a.id === 'terminal' ? () => raw.machine && deps.openTerminal(raw.machine.id) : a.id === 'tool' ? () => deps.go('#/operator') : a.id === 'scan' ? () => deps.go('#/tara') : () => deps.go('#/gorevler');
        return [h('button', { type: 'button', class: a.id === 'terminal' ? 'primary' : '', 'data-testid': `owc-act-${a.id}`, ...(a.enabled ? {} : { disabled: true }), onClick }, a.label),
            !a.enabled && a.why ? h('div', { class: 'owc-why', 'data-testid': `owc-why-${a.id}` }, a.why) : null];
    };
    shell(back, h('h1', {}, `${raw.productCode ?? 'Ürün'} · ${raw.productName ?? ''}`.trim()), h('div', {}, h('span', { class: `owc-chip ${c.readiness.tone}`, 'data-testid': 'owc-status' }, woStatusText(raw.status)), ' ', raw.revision ? h('span', { class: 'owc-chip mut', 'data-testid': 'owc-rev' }, `Rev ${raw.revision}`) : h('span', { class: 'owc-chip mut', 'data-testid': 'owc-rev' }, 'Revizyon BİLİNMİYOR'), raw.plannedDate ? h('span', { class: 'owc-chip mut' }, ` Plan ${raw.plannedDate}`) : null), h('div', { class: 'owc-card', 'data-testid': 'owc-main' }, h('div', { class: 'owc-kpis' }, h('div', {}, h('div', { class: 'owc-l' }, 'MAKİNE'), h('div', { class: `owc-v${raw.machine ? '' : ' unk'}`, 'data-testid': 'owc-machine' }, raw.machine ? raw.machine.code : 'ATANMADI')), h('div', {}, h('div', { class: 'owc-l' }, 'OPERASYON'), h('div', { class: `owc-v${c.currentOp ? '' : ' unk'}`, 'data-testid': 'owc-op', style: 'font-size:18px' }, c.currentOp ? `${c.currentOp.opNo} · ${c.currentOp.name}` : 'Operasyon kaydı yok'))), h('div', { class: 'owc-kpis', 'data-testid': 'owc-qty' }, kpi('PLANLANAN', c.qty.planned, 'owc-q-planned'), kpi('SAĞLAM', c.qty.good, 'owc-q-good'), kpi('HURDA', c.qty.scrap, 'owc-q-scrap'), kpi('KALAN', c.qty.remaining, 'owc-q-remaining'), kpi('MALZEME TAHSİSİ', c.qty.reserved, 'owc-q-reserved')), h('div', { class: 'owc-bar' }, h('div', { style: `width:${pct}%` })), c.qty.overrun ? h('div', { class: 'owc-why', 'data-testid': 'owc-overrun' }, 'Sağlam + hurda planlanan adedi aştı — yöneticinize bildirin.') : null, raw.openQualityHold ? h('div', { style: 'margin-top:8px' }, h('span', { class: 'owc-chip bad', 'data-testid': 'owc-hold' }, 'KALİTE BEKLETMESİ')) : null), h('h2', {}, 'Üretim hazırlığı'), h('div', { class: `owc-card`, 'data-testid': 'owc-ready', 'data-ready': c.readiness.tone === 'ok' ? 'yes' : c.readiness.tone === 'bad' ? 'no' : 'unknown' }, h('b', { 'data-testid': 'owc-ready-headline', style: `color:${c.readiness.tone === 'ok' ? '#4ade80' : c.readiness.tone === 'bad' ? '#f87171' : '#94a3b8'}` }, c.readiness.text), ...c.readiness.blockers.map((b) => h('div', { class: 'owc-bl', 'data-testid': 'owc-blocker', 'data-code': b.code }, h('b', {}, b.title), b.detail ? h('span', {}, b.detail) : null)), c.readiness.blockers.length ? h('div', { class: 'owc-why' }, 'Eksikleri yöneticinize / takımhaneye bildirin; siz değiştiremezsiniz.') : null), h('h2', {}, 'Yapabileceğiniz işlemler'), h('div', { class: 'owc-acts', 'data-testid': 'owc-actions' }, ...c.actions.flatMap(act)), h('h2', {}, 'Teknik belgeler'), h('div', { class: 'owc-card', 'data-testid': 'owc-docs' }, raw.docs.length ? h('div', {}, ...raw.docs.map((d) => h('div', { class: 'owc-doc', 'data-testid': 'owc-doc' }, h('span', {}, h('b', {}, d.title), ` · ${d.docType === 'DRAWING' ? 'Teknik resim' : d.docType === 'CONTROL_PLAN' ? 'Kontrol planı' : d.docType === 'CAM_SETUP_SHEET' ? 'Bağlama föyü' : 'Malzeme sertifikası'}`, d.expiry === 'EXPIRED' ? ' · SÜRESİ DOLMUŞ' : ''), d.versionId ? h('button', { type: 'button', style: 'min-height:44px', 'data-testid': 'owc-doc-open', onClick: () => void (async () => { try {
            const f = await deps.api.openDoc(d.versionId);
            docHost.replaceChildren();
            showFile(docHost, { bytes: fromBase64(f.bytes), mime: f.mime, fileName: f.fileName, download: false });
        }
        catch (e) {
            docHost.textContent = `Açılamadı: ${errorText(e)}`;
        } })() }, 'Aç') : null)))
        : h('div', { 'data-testid': 'owc-no-docs' }, 'Bu iş için size açık teknik belge yok (teknik resim / kontrol planı / bağlama föyü yüklenmemiş olabilir). Yöneticinize sorun.'), docHost));
}
