// Paket C / 0138 — "Çubuk hammadde hesabı" on the BOM card. The panel only DISPLAYS what bar_material_need returns (one formula, server side) and offers the spec form on a DRAFT revision.
import { h } from '../../../../packages/ui/src/h.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const n = (s) => { const t = s.trim().replace(',', '.'); if (t === '')
    return null; const v = Number(t); return Number.isFinite(v) ? v : NaN; };
export const fmtMm = (v) => String(Math.round(v * 1000) / 1000).replace('.', ',');
// The typed quantity survives every redraw of the card (a save elsewhere re-renders it) — it used to jump back to 37.
let lastQty = '';
const rememberedQty = () => { if (lastQty)
    return lastQty; try {
    return sessionStorage.getItem('kmi.bar.qty') ?? '';
}
catch {
    return '';
} };
const rememberQty = (v) => { lastQty = v; try {
    sessionStorage.setItem('kmi.bar.qty', v);
}
catch { /* storage unavailable: kept in memory only */ } };
export async function drawBarStock(host, api, revisionId, materials, editable, reload, showErr) {
    host.replaceChildren();
    const qty = E('input', { 'data-testid': 'pw-bar-qty', inputmode: 'numeric', value: rememberedQty() || '1', style: 'max-width:90px' });
    const out = E('div', { 'data-testid': 'pw-bar-out' });
    const calc = async () => {
        const q = n(qty.value);
        out.replaceChildren();
        if (q === null || Number.isNaN(q) || q <= 0) {
            out.append(E('div', { class: 'mut' }, 'Adet pozitif bir sayı olmalı.'));
            return;
        }
        let r;
        try {
            r = await api.barNeed(revisionId, q);
        }
        catch {
            return;
        } // 0138 not installed / no access: nothing shown, nothing invented
        if (!r.lines.length) {
            out.append(E('div', { class: 'mut', 'data-testid': 'pw-bar-none' }, 'Çubuk hammadde tanımı yok (BOM satırı için çap, çubuk boyu ve kesim boyu girilince sistem hesaplar).'));
            return;
        }
        for (const l of r.lines) {
            const p = l.plan;
            out.append(E('div', { class: 'r', 'data-testid': 'pw-bar-line', 'data-material': l.materialCode }, E('b', {}, `${l.materialCode} · Ø${fmtMm(l.diaMm)} · çubuk ${fmtMm(l.barLengthMm)} mm · kesim ${fmtMm(l.cutLengthMm)} mm`), E('span', { 'data-testid': 'pw-bar-result' }, p.barsNeeded === null ? 'Hesaplanamadı (kesim boyu çubuğa sığmıyor)' : `${p.piecesPerBar} parça/çubuk → ${q} adet için ${p.barsNeeded} çubuk (${p.sparePieces} parça artar) · çubuk başına kalan ${fmtMm(p.remainderMmPerBar)} mm · kesilen parça ${fmtMm(p.pieceMassG)} g · ham toplam ${p.blankTotalKg === null ? '—' : fmtMm(p.blankTotalKg) + ' kg'}`), E('span', { class: 'mut', 'data-testid': 'pw-bar-source' }, `testere payı ${fmtMm(l.kerfMm)} mm (${l.kerfSource === 'DEFAULT' ? 'KMI varsayılanı' : 'istisna: ' + (l.kerfReason ?? '')}) · yoğunluk ${l.densityGCm3} g/cm³ (${l.densitySource === 'DEFAULT' ? 'varsayılan, ölçülmüş değil' : 'spec'}) · bitmiş parça ağırlığı: doğrulanmış geometri yok → hesaplanmadı`)));
        }
    };
    let timer;
    qty.addEventListener('input', () => { rememberQty(qty.value); clearTimeout(timer); timer = setTimeout(() => void calc(), 300); }); // recalculates while typing
    qty.addEventListener('change', () => { rememberQty(qty.value); void calc(); });
    const form = E('div', { 'data-testid': 'pw-bar-form-host' });
    if (editable && materials.length) {
        const sel = E('select', { 'data-testid': 'pw-bar-material' }, ...materials.map((m) => E('option', { value: m }, m)));
        const f = (id, ph) => E('input', { 'data-testid': `pw-bar-${id}`, inputmode: 'decimal', placeholder: ph });
        const dia = f('dia', 'Çap mm'), bar = f('len', 'Çubuk boyu mm'), cut = f('cut', 'Kesim boyu mm'), kerf = f('kerf', 'Testere payı (boş = KMI varsayılanı)'), den = f('den', 'Yoğunluk g/cm³ (boş = varsayılan)');
        const kr = E('input', { 'data-testid': 'pw-bar-kerf-reason', placeholder: 'Varsayılandan farklıysa gerekçe' });
        const rs = E('input', { 'data-testid': 'pw-bar-reason', placeholder: 'Gerekçe (en az 10 karakter)' });
        form.append(E('div', { class: 'formbox' }, E('b', {}, 'Çubuk hammadde tanımı'), E('div', { class: 'fgrid w2' }, sel, dia, bar, cut, kerf, kr, den, rs), E('div', { class: 'row' }, E('button', { class: 'primary', type: 'button', 'data-testid': 'pw-bar-save', onClick: () => void (async () => {
                const v = [dia, bar, cut].map((x) => n(x.value));
                if (v.some((x) => x === null || Number.isNaN(x) || x <= 0))
                    return showErr(new Error('Çap, çubuk boyu ve kesim boyu pozitif sayı olmalı.'));
                const k = n(kerf.value), d = n(den.value);
                if (Number.isNaN(k) || Number.isNaN(d))
                    return showErr(new Error('Testere payı ve yoğunluk sayı olmalı.'));
                if (rs.value.trim().length < 10)
                    return showErr(new Error('Gerekçe en az 10 karakter olmalı.'));
                try {
                    await api.barSpecSave(revisionId, sel.value, v[0], v[1], v[2], k, kr.value.trim() || null, d, rs.value.trim());
                    await reload(`Çubuk hammadde tanımı kaydedildi: ${sel.value}.`);
                }
                catch (e) {
                    showErr(e);
                }
            })() }, 'Kaydet'))));
    }
    host.append(E('div', { class: 'formbox', 'data-testid': 'pw-bar' }, E('b', {}, 'Çubuk hammadde hesabı'), E('label', { class: 'row', style: 'gap:6px' }, 'Adet', qty), out, form));
    await calc();
}
