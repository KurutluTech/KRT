// Order-to-Ship zincir özeti (kalem bazında). Yalnız OKUR: sipariş detayı + iş emri hazırlık fonksiyonu. Hiçbir adım tahmin edilmez; kaynak yoksa "VERİ YOK".
import { h } from '../../../../packages/ui/src/h.js';
import { buildChain, STATE_TR } from '../../../../packages/domain/src/orderToShip.js';
import { errorText } from '../errorText.js';
const CHIP = { DONE: 'chip', PARTIAL: 'chip warn', WAITING: 'chip', BLOCKED: 'chip bad', NO_DATA: 'chip warn' };
const DOC_TR = { PACKING_LIST: 'Paketleme listesi', COMMERCIAL_INVOICE: 'Ticari fatura', CERTIFICATE_OF_CONFORMITY: 'Uygunluk sertifikası', DELIVERY_NOTE: 'İrsaliye', EXPORT_DECLARATION: 'İhracat beyanı', OTHER: 'Diğer' };
const STARTER = ['PACKING_LIST', 'COMMERCIAL_INVOICE', 'CERTIFICATE_OF_CONFORMITY']; // yalnız başlangıç şablonu; zorunlu değildir
const DOC_ST = { DRAFT: 'Taslak', SUBMITTED: 'Onaya gönderildi', APPROVED: 'Onaylı', REJECTED: 'Reddedildi', SUPERSEDED: 'Yeni sürümle değişti' };
// Sunucu yetkisini UI yerine fonksiyonlar uygular; bu bölüm yalnız çağrı yapar, hata metnini gösterir.
function drawActions(wos, f, api, reload) {
    const msg = h('div', { class: 'mut', 'data-testid': 'o2s-msg' });
    const run = async (fn) => { try { msg.textContent = 'Kaydediliyor…'; await fn(); msg.textContent = ''; await reload(); } catch (e) { msg.textContent = errorText(e); msg.className = 'banner bad'; } };
    const rows = wos.map((w) => {
        const fq = (f.finalQuality ?? []).find((x) => x.workOrderId === w.id), cd = (f.commercialDocs ?? []).find((x) => x.workOrderId === w.id);
        const reason = h('input', { placeholder: 'Gerekçe (en az 3 karakter)', 'data-testid': 'o2s-fq-reason', style: 'min-width:200px' });
        const noFq = !fq, approved = fq?.record?.decision === 'APPROVED' && !fq?.record?.revokedAt;
        const reqTypes = h('input', { placeholder: `Belge türleri (başlangıç şablonu: ${STARTER.join(', ')})`, value: (cd?.required ?? []).join(', '), 'data-testid': 'o2s-req-types', style: 'min-width:260px' }), reqReason = h('input', { placeholder: 'Gerekçe (sipariş/müşteri/sevkiyat koşulu)', 'data-testid': 'o2s-req-reason' });
        const docNo = h('input', { placeholder: 'Belge no', 'data-testid': 'o2s-doc-no' }), type = h('select', { 'data-testid': 'o2s-doc-type' }, ...(cd?.required ?? []).map((t) => h('option', { value: t }, DOC_TR[t] ?? t)));
        return h('div', { class: 'card', style: 'margin:6px 0;padding:8px', 'data-wo': w.id },
            h('b', {}, `İş emri ${String(w.id).slice(0, 8)}`),
            h('div', { class: 'mut' }, 'Final Quality: ', noFq ? 'okunamadı' : approved ? 'ONAYLI' : (fq.check?.blockers?.length ? 'engel: ' + fq.check.blockers.join(', ') : 'kontroller uygun')),
            noFq || approved ? null : h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0' }, reason,
                h('button', { class: 'btn', 'data-testid': 'o2s-fq-approve', onclick: () => run(() => api.finalQualityDecide(w.id, true, reason.value)) }, 'Final Quality ONAYLA'),
                h('button', { class: 'btn', 'data-testid': 'o2s-fq-reject', onclick: () => run(() => api.finalQualityDecide(w.id, false, reason.value)) }, 'Reddet')),
            h('div', { class: 'mut', style: 'margin-top:6px' }, 'Ticari belgeler (sevkiyat öncesi; fatura sonrası sayılmaz). Gerekli set: ', cd?.state === 'NOT_DEFINED' ? 'TANIMLANMADI' : cd?.state === 'UNCONFIRMED' ? 'tanımlı, DOĞRULANMADI' : (cd?.required ?? []).join(', ') || '—'),
            h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0' }, reqTypes, reqReason,
                h('button', { class: 'btn', 'data-testid': 'o2s-req-set', onclick: () => run(() => api.commercialRequirementsSet(w.id, reqTypes.value.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean), reqReason.value, false)) }, 'Gerekli seti kaydet'),
                cd?.state === 'UNCONFIRMED' ? h('button', { class: 'btn', 'data-testid': 'o2s-req-confirm', onclick: () => run(() => api.commercialRequirementsSet(w.id, null, reqReason.value, true)) }, 'Seti doğrula (farklı yetkili)') : null),
            ...(cd?.documents ?? []).filter((d) => d.status !== 'SUPERSEDED').map((d) => h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, `${DOC_TR[d.docType] ?? d.docType} · ${d.docNo} · v${d.version} · ${DOC_ST[d.status] ?? d.status}`,
                d.status === 'DRAFT' ? h('button', { class: 'btn', onclick: () => run(() => api.commercialDocSubmit(d.id)) }, 'Onaya gönder') : null,
                d.status === 'SUBMITTED' ? [h('input', { placeholder: 'Karar gerekçesi', id: 'r' + d.id }), h('button', { class: 'btn', onclick: () => run(() => api.commercialDocDecide(d.id, true, document.getElementById('r' + d.id)?.value)) }, 'Onayla'), h('button', { class: 'btn', onclick: () => run(() => api.commercialDocDecide(d.id, false, document.getElementById('r' + d.id)?.value)) }, 'Reddet')] : null)),
            h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px' }, type, docNo, h('button', { class: 'btn', 'data-testid': 'o2s-doc-save', onclick: () => run(() => api.commercialDocSave(w.id, type.value, docNo.value, null)) }, 'Belge kaydet')));
    });
    return h('details', { 'data-testid': 'o2s-actions', style: 'margin-top:8px' }, h('summary', {}, 'Final Quality ve ticari belge işlemleri'), ...rows, msg);
}
const CSS = '.o2s{display:grid;grid-template-columns:minmax(180px,max-content) max-content 1fr;gap:4px 12px;align-items:center;margin:6px 0}.o2s .d{color:var(--mut,#94a3b8);overflow-wrap:anywhere}@media (max-width:640px){.o2s{grid-template-columns:1fr}.o2s .d{margin-bottom:4px}}';
export function drawOrderToShip(item, orderStatus, api) {
    const body = h('div', { 'data-testid': 'o2s-body' });
    let loaded = false;
    const load = async () => {
        body.replaceChildren(h('div', { class: 'mut' }, 'Yükleniyor…'));
        const readiness = new Map();
        const unreadable = [];
        try {
            const wos = item.workOrders ?? [];
            for (const w of wos) {
                try { const r = await api.readiness?.(w.id); readiness.set(w.id, Array.isArray(r) ? r : (r?.rows ?? [])); }
                catch { unreadable.push('readiness'); }
            }
            const f = (await api.chainFacts?.(wos.map((w) => w.id))) ?? { unreadable: ['work_order_operations', 'stock_lots', 'commercial_approvals', 'shipments', 'invoices'] };
            const c = buildChain({ orderStatus, item, wos, readiness, ...f, unreadable: [...unreadable, ...(f.unreadable ?? [])] });
            body.replaceChildren(h('div', { class: c.verified ? 'banner' : 'banner warn', style: 'margin:6px 0', 'data-testid': 'o2s-summary' }, c.summary),
                h('div', { class: 'o2s', 'data-testid': 'o2s-steps' }, ...c.steps.flatMap((s) => [h('div', { 'data-step': s.key }, s.label), h('span', { class: CHIP[s.state], 'data-state': s.state }, STATE_TR[s.state]), h('div', { class: 'd', title: s.source ?? 'ayrı kayıt yok' }, s.detail ?? '', s.source ? h('span', { class: 'mut' }, ` · kaynak: ${s.source}`) : null)])),
                wos.length && api.finalQualityDecide ? drawActions(wos, f, api, load) : null,
                h('div', { class: 'mut', style: 'margin-top:6px' }, 'Bu özet yalnız okur; sunucunun canonical kayıtlarını gösterir, kendi durum hesabı yapmaz. "VERİ YOK" aşamaları doğrulanmış sayılmaz.'));
        }
        catch (e) { body.replaceChildren(h('div', { class: 'banner bad' }, errorText(e))); }
    };
    const det = h('details', { 'data-testid': 'o2s-panel', style: 'margin-top:8px' }, h('style', {}, CSS), h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Order-to-Ship zinciri'), body);
    det.addEventListener('toggle', () => { if (det.open && !loaded) { loaded = true; void load(); } });
    return det;
}
