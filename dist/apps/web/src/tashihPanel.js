// TASHİH declaration panel (KMI-001 final revision §7) — the operator's gauge check → separate → hand over to Quality statement.
// Rules live in packages/domain/src/tashihDeclaration.ts. This DOM only collects the fields, validates with the domain rules, and sends through
// the injected `submit`. Success is shown ONLY after the server answered OK; any refusal or missing server piece is shown as such.
import { h } from '../../../packages/ui/src/h.js';
import { GAUGE_TR, RESULT_TR, TASHIH_DEPENDENCIES, buildNcrReason, validateDeclaration } from '../../../packages/domain/src/tashihDeclaration.js';
export const TASHIH_CSS = `
.tp{margin-top:12px;padding:14px;border-radius:14px;border:1px solid #92400e;background:linear-gradient(180deg,rgba(69,26,3,.35),rgba(15,23,42,.6))}
.tp[hidden]{display:none}.tp h3{margin:0 0 4px;font-size:16px;color:#fde68a}.tp .tp-rule{font-size:13px;color:#fcd34d;line-height:1.5;margin:0 0 10px}
.tp .tp-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px}.tp label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#cbd5e1}
.tp input:not([type=checkbox]):not([type=radio]),.tp select,.tp textarea{min-height:48px;font-size:16px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;padding:0 10px;width:100%;box-sizing:border-box}.tp textarea{min-height:64px;padding:8px 10px}
.tp .tp-chk{flex-direction:row;align-items:center;gap:10px;min-height:48px;font-size:14px;font-weight:700}.tp .tp-chk input{width:24px;height:24px;flex:none}
.tp .tp-seg{display:flex;gap:6px}.tp .tp-seg button{flex:1;min-height:48px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#cbd5e1;font-weight:800;cursor:pointer}.tp .tp-seg button.on{background:#92400e;color:#fff;border-color:#fbbf24}
.tp .tp-err{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(239,68,68,.16);color:#fecaca;font-size:13px}.tp .tp-ok{margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(34,197,94,.14);color:#bbf7d0;font-size:13px}
.tp .tp-warn{margin-top:8px;font-size:12px;color:#fcd34d}.tp details{margin-top:10px;font-size:12px;color:#cbd5e1}.tp details li{margin:3px 0}
`;
export function tashihPanel(o) {
    const requestId = `tashih-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    let timing = 'IMMEDIATE';
    const inp = (testid, ph, type = 'text') => h('input', { type, placeholder: ph, 'data-testid': testid, ...(type === 'number' ? { min: '1', step: '1', inputmode: 'numeric' } : {}) });
    const characteristic = inp('tp-characteristic', 'ör. Ø40 H7');
    const gauge = h('select', { 'data-testid': 'tp-gauge', 'aria-label': 'Ölçüm aracı' }, ...Object.keys(GAUGE_TR).map((k) => h('option', { value: k }, GAUGE_TR[k])));
    const result = h('select', { 'data-testid': 'tp-result', 'aria-label': 'Kontrol sonucu' }, ...['TASHIH', 'CONFORMING', 'SCRAP'].map((k) => h('option', { value: k }, RESULT_TR[k])));
    const reason = inp('tp-reason', 'ör. ölçü +0,03 büyük');
    const qty = inp('tp-qty', 'adet', 'number');
    qty.value = String(Math.max(1, o.initialQty || 1));
    const container = inp('tp-container', 'ör. KAP-7 / LOT-0412');
    const tool = inp('tp-tool', 'takım kodu (T…)');
    const corr = inp('tp-correction', 'düzeltme mm (ör. -0,02)');
    const applied = h('input', { type: 'checkbox', 'data-testid': 'tp-offset-applied' });
    const handed = h('input', { type: 'checkbox', 'data-testid': 'tp-handover' });
    const note = h('textarea', { 'data-testid': 'tp-note', placeholder: 'Açıklama (isteğe bağlı)' });
    const msg = h('div', { 'data-testid': 'tp-msg', role: 'status', 'aria-live': 'polite' });
    const seg = (t, label, tid) => h('button', { type: 'button', 'data-testid': tid, class: timing === t ? 'on' : '', onClick: () => { timing = t; segBox.replaceChildren(...segs()); } }, label);
    const segs = () => [seg('IMMEDIATE', 'ANLIK BEYAN', 'tp-timing-now'), seg('END_OF_SHIFT', 'VARDİYA SONU BEYANI', 'tp-timing-eos')];
    const segBox = h('div', { class: 'tp-seg', role: 'group', 'aria-label': 'Beyan zamanı' }, ...segs());
    let busy = false;
    const send = h('button', { type: 'button', class: 'opb md amber', 'data-testid': 'tp-submit', style: 'margin-top:12px;width:100%', onClick: async () => {
            if (busy)
                return;
            const num = corr.value.trim() === '' ? null : Number(corr.value.replace(',', '.'));
            const d = { timing, machineId: o.machineId, workOrderId: o.workOrderId, productCode: o.productCode, operationNo: null, shift: o.shift, operatorName: o.operatorName,
                characteristic: characteristic.value, gauge: gauge.value, result: result.value, reason: reason.value, qty: Number(qty.value), containerCode: container.value,
                handedToQuality: handed.checked, note: note.value,
                offset: tool.value.trim() || num !== null || applied.checked ? { toolCode: tool.value, correctionMm: num !== null && Number.isFinite(num) ? num : null, appliedOnMachine: applied.checked ? 'OPERATOR_STATES_APPLIED' : 'NOT_CLAIMED' } : null };
            if (d.result === 'SCRAP') {
                msg.replaceChildren(h('div', { class: 'tp-err', 'data-testid': 'tp-hint' }, 'Hurda parçalar HURDA + ile sayılır ve ÜRETİM KAYDET ile işlenir; TASHİH beyanı yalnız düzeltilebilir parçalar içindir.'));
                return;
            }
            const issues = validateDeclaration(d, { remainingQty: o.remainingQty });
            if (issues.length) {
                msg.replaceChildren(h('div', { class: 'tp-err', 'data-testid': 'tp-issues' }, ...issues.map((i) => h('div', { 'data-field': i.field }, i.message))));
                return;
            }
            if (!o.submit) {
                msg.replaceChildren(h('div', { class: 'tp-err', 'data-testid': 'tp-blocked' }, 'Bu veritabanında TASHİH vakası kaydı henüz kurulu değil (BLOKE: taslak 0076 uygulanmadı). Beyan GÖNDERİLMEDİ ve kaydedilmiş sayılmaz.'));
                return;
            }
            busy = true;
            send.setAttribute('disabled', 'true');
            try {
                await o.submit(buildNcrReason(d), d.qty, requestId);
                msg.replaceChildren(h('div', { class: 'tp-ok', 'data-testid': 'tp-saved' }, `TASHİH beyanı sunucuda kaydedildi (${d.qty} adet). Parçaları kap/lotta tutup kaliteye teslim edin; kalite teslim aldığı adedi doğrulayıp karar verecek.`));
                o.onSaved();
            }
            catch (e) {
                msg.replaceChildren(h('div', { class: 'tp-err', 'data-testid': 'tp-failed' }, `Kaydedilmedi: ${o.errorText(e)}`));
            }
            finally {
                busy = false;
                send.removeAttribute('disabled');
            }
        } }, 'TASHİH BEYANINI GÖNDER');
    return h('section', { class: 'tp', hidden: true, 'data-testid': 'tashih-panel', 'aria-label': 'TASHİH beyanı' }, h('h3', {}, 'TASHİH beyanı — mastar kontrolü sonrası'), h('p', { class: 'tp-rule' }, 'Parçaları üretimde ayırın, kap/lota koyun ve kaliteye teslim edin. Kalite aynı ayırmayı tekrar yapmaz; teslim aldığı adedi doğrular, ölçer ve karar verir. Bu beyan kalite serbest bırakması DEĞİLDİR; TASHİH parçası kalite kararı ve yeniden işleme bitmeden sağlam stoğa geçmez.'), segBox, h('div', { class: 'tp-g', style: 'margin-top:10px' }, h('label', {}, 'Kontrol edilen ölçü', characteristic), h('label', {}, 'Mastar / ölçüm aracı', gauge), h('label', {}, 'Kontrol sonucu', result), h('label', {}, 'Uygunsuzluk nedeni', reason), h('label', {}, 'TASHİH adedi', qty), h('label', {}, 'Ayırma kabı / lot', container), h('label', {}, 'Takım (ofset düzeltildiyse)', tool), h('label', {}, 'Ofset düzeltme (mm)', corr)), h('label', { class: 'tp-chk' }, applied, 'Ofseti makinede uyguladım (operatör beyanı — sistem makineden doğrulayamaz)'), h('label', { class: 'tp-chk' }, handed, 'TASHİH parçalarını kaydedilen kap/lotla kaliteye teslim ettim'), h('label', {}, 'Açıklama', note), msg, send, h('div', { class: 'tp-warn' }, 'Fotoğraf eki: sunucuda dosya alanı olmadığından şimdilik alınmaz (açıklama yazın).'), h('details', { 'data-testid': 'tp-deps' }, h('summary', {}, 'Henüz sunucuda olmayan / uygulanmayan bağımlılıklar (BLOKE)'), h('ul', {}, ...TASHIH_DEPENDENCIES.map((d) => h('li', {}, `${d.need} — ${d.state === 'MISSING' ? 'YOK' : 'taslak, uygulanmadı'} (${d.pkg})`)))));
}
