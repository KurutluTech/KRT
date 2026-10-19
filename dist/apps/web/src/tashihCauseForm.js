// KMI-013 (0123) — structured cause of a tashih on the operator terminal: Ölçü / Yüzey / Karakteristik. Validation = packages/domain/src/tashihCause.ts (the server re-checks).
// Success is shown ONLY after the server answered OK. A tashih is never anonymous: FINISH with tashih > 0 is refused by the server without at least one cause.
import { h } from '../../../packages/ui/src/h.js';
import { TASHIH_CAUSE_KINDS, TASHIH_CAUSE_KIND_TR, TASHIH_CAUSE_REASON_TR, validateTashihCause } from '../../../packages/domain/src/tashihCause.js';
export function tashihCauseForm(o) {
    let kind = 'OLCU';
    const sent = [];
    const num = (e) => (e.value.trim() === '' ? null : Number(e.value.replace(',', '.')));
    const feature = h('input', { type: 'text', 'data-testid': 'tc-feature', placeholder: 'Özellik (örn. dış çap Ø20, delik, yüzey)' });
    const code = h('input', { type: 'text', 'data-testid': 'tc-code', placeholder: 'Karakteristik kodu (örn. K-3)' });
    const nominal = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'tc-nominal', placeholder: 'Nominal' });
    const tolU = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'tc-tol-upper', placeholder: 'Üst tolerans (+)' });
    const meas = h('input', { type: 'text', inputmode: 'decimal', 'data-testid': 'tc-measured', placeholder: 'Ölçülen' });
    const qty = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: '1', 'data-testid': 'tc-qty' });
    const note = h('input', { type: 'text', 'data-testid': 'tc-note', placeholder: 'Not / yüzey sorunu' });
    const msg = h('div', { 'data-testid': 'tc-msg', class: 'mut', style: 'margin-top:6px' });
    const list = h('div', { 'data-testid': 'tc-list', class: 'mut' });
    const fields = h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-top:8px' });
    const seg = h('div', { class: 'row', style: 'gap:6px' });
    const draw = () => {
        seg.replaceChildren(...TASHIH_CAUSE_KINDS.map((k) => h('button', { type: 'button', 'data-testid': `tc-kind-${k}`, 'aria-pressed': String(k === kind), class: k === kind ? 'primary' : 'ghost', style: 'min-height:48px;flex:1', onClick: () => { kind = k; draw(); } }, TASHIH_CAUSE_KIND_TR[k])));
        fields.replaceChildren(feature, ...(kind === 'OLCU' ? [nominal, tolU, meas] : []), ...(kind === 'KARAKTERISTIK' ? [code] : []), ...(kind !== 'OLCU' ? [note] : []), qty);
    };
    const read = () => ({ kind, feature: feature.value, characteristicCode: code.value, nominal: num(nominal), tolUpper: num(tolU), measured: num(meas), qty: Number(qty.value), note: note.value });
    let busy = false;
    const save = h('button', { type: 'button', class: 'primary', 'data-testid': 'tc-save', style: 'min-height:56px;margin-top:8px', onClick: async () => {
            if (busy)
                return;
            const c = read();
            const v = validateTashihCause(c, o.declared() > 0 ? o.declared() : null);
            if (!v.ok) {
                msg.textContent = TASHIH_CAUSE_REASON_TR[v.reason ?? ''] ?? String(v.reason);
                msg.setAttribute('data-kind', 'error');
                return;
            }
            if (!o.submit) {
                msg.textContent = 'Henüz bağlı değil: tashih nedeni bu cihazda kaydedilemiyor.';
                msg.setAttribute('data-kind', 'error');
                return;
            }
            busy = true;
            try {
                await o.submit(c, o.newRequestId());
                sent.push(`${TASHIH_CAUSE_KIND_TR[c.kind]}: ${c.feature.trim()} × ${c.qty}`);
                list.textContent = `Kaydedilen nedenler: ${sent.join(' · ')}`;
                msg.textContent = 'Neden sunucuya kaydedildi.';
                msg.setAttribute('data-kind', 'ok');
                feature.value = '';
            }
            catch (e) {
                msg.textContent = o.errorText(e);
                msg.setAttribute('data-kind', 'error');
            }
            finally {
                busy = false;
            }
        } }, 'NEDENİ KAYDET');
    draw();
    return h('div', { class: 'card', 'data-testid': 'tc-root', style: 'margin-top:10px' }, h('div', { style: 'font-weight:800' }, 'TASHİH NEDENİ (tashih varsa zorunlu)'), h('div', { class: 'mut' }, 'Tashih hurda değildir. Hangi özellik, nasıl? Ölçüde ölçülen değer nominal + üst toleransın üstünde olmalı. Kalite vakayı sonra açar; siz sadece nedeni bildirirsiniz.'), seg, fields, save, msg, list);
}
