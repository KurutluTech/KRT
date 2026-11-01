// KMI NEXT — HOLD yönetim paneli (m0195). Paralel HOLD sistemi YOKTUR: durum work_orders.status='ON_HOLD', geçiş
// transition_work_order_status, geçmiş work_order_events. HOLD'dan çıkarmak START izni DEĞİLDİR.
import { h } from '../../../packages/ui/src/h.js';
import { errorText } from './errorText.js';
const fmt = (t) => { try { return t ? new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'BİLİNMİYOR'; } catch { return String(t); } };
const ST = { ON_HOLD: 'Bekletmede (HOLD)', MACHINE_ASSIGNED: 'Makine atandı', PLANNED: 'Plana alındı', IN_PROGRESS: 'Üretimde', PRODUCTION_DONE: 'Üretim bitti' };
export async function renderHoldPanel(root, w, { api, onDone }) {
    let info;
    try { info = await api.holdInfo(w.id); }
    catch (e) { root.replaceChildren(h('div', { 'data-testid': 'hold-error', class: 'woc-msg error', role: 'alert' }, `HOLD bilgisi okunamadı: ${errorText(e)}`)); return; }
    const reason = h('input', { type: 'text', 'data-testid': 'hold-release-reason', 'aria-label': 'HOLD kaldırma gerekçesi', placeholder: 'Gerekçe (isteğe bağlı)', maxlength: 300 });
    const err = h('div', { 'data-testid': 'hold-release-error', class: 'woc-msg error', role: 'alert', hidden: '' });
    const canRelease = info.canRelease === true;
    const heldFrom = info.heldFromStatus || 'MACHINE_ASSIGNED';
    const target = heldFrom === 'PRODUCTION_DONE' ? 'PRODUCTION_DONE' : 'MACHINE_ASSIGNED';
    const btn = h('button', { type: 'button', 'data-testid': 'hold-release', ...(canRelease ? {} : { disabled: true, title: 'Bu işlem için yetkiniz yok (yönetici/atama yetkisi gerekir)' }),
        onClick: async () => {
            const r = reason.value.trim();
            err.hidden = true;
            btn.disabled = true;
            try { await api.transition(w.id, target, r || 'HOLD kaldırıldı'); onDone({ kind: 'ok', text: `HOLD kaldırıldı → ${ST[target] ?? target}. Üretim BAŞLATILMADI; başlatma için “üretime hazır mı?” eksikleri ayrıca kapanmalı.` }); }
            catch (e) { err.textContent = `HOLD kaldırılamadı: ${errorText(e)}`; err.hidden = false; btn.disabled = false; }
        } }, "HOLD'DAN ÇIKAR");
    const hist = (info.history ?? []).map((x) => h('li', { 'data-testid': 'hold-hist' }, `${fmt(x.at)} · ${ST[x.from] ?? x.from ?? '—'} → ${ST[x.to] ?? x.to} · ${x.actor ?? 'bilinmiyor'}${x.reason ? ` · “${x.reason}”` : ''}`));
    root.replaceChildren(h('section', { 'data-testid': 'hold-panel', class: 'woc-ready bad' },
        h('h3', { 'data-testid': 'hold-state' }, 'DURUM: BEKLETMEDE (ON_HOLD)'),
        h('div', { class: 'woc-meta', 'data-testid': 'hold-since' }, `Bekletmeye alan: ${info.holdBy ?? 'BİLİNMİYOR'} · ${fmt(info.holdSince)}`),
        h('div', { class: 'woc-meta', 'data-testid': 'hold-reason' }, `Gerekçe: ${info.holdReason ? `“${info.holdReason}”` : 'kayıtlı gerekçe yok'}${/^İş emri merkezi: ON_HOLD$/.test(info.holdReason ?? '') ? ' (varsayılan metin — özel gerekçe girilmemiş)' : ''}`),
        h('div', { class: 'woc-meta', 'data-testid': 'hold-checks' }, `Açık kalite HOLD'u: ${info.openQualityHolds ?? 0} · Operasyon sayısı: ${info.operations ?? 0}`),
        h('div', { class: 'woc-meta' }, info.releaseNote ?? 'HOLD kaldırmak START izni vermez.'),
        canRelease ? h('div', { class: 'woc-row' }, reason, btn) : h('div', { class: 'woc-row' }, btn, h('span', { class: 'woc-meta', 'data-testid': 'hold-noauth' }, 'Bu işlemi yalnızca yetkili yönetici yapabilir.')),
        err,
        h('details', {}, h('summary', {}, 'HOLD geçmişi'), hist.length ? h('ul', {}, ...hist) : h('div', { class: 'woc-meta' }, 'Kayıt yok'))));
}
