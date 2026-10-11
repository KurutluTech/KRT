// KMI NEXT — Alacaklar & Vade (D-016, migration 0044). Muhasebenin kendi işi: açık fatura bakiyesi, müşteri
// ödeme koşulundan gelen vade ve GERÇEK gecikme (vade geçmiş + bakiye açık). Ödeme koşulu girilmemiş
// müşterinin faturasında vade BİLİNMİYOR yazar — "gecikmemiş" sayılmaz. Maliyet / kâr burada yoktur
// (o yalnız sahibin ekranında). Koşul değişikliği tarihlidir ve eski kayıt silinmez.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { humanError } from '../errorText.js';
const NUM = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATE_TR = { OVERDUE: 'VADESİ GEÇMİŞ', NOT_DUE: 'VADESİ GELMEDİ', NO_TERMS: 'VADE BİLİNMİYOR' };
const STATE_BG = { OVERDUE: '#fee2e2', NOT_DUE: '#dcfce7', NO_TERMS: '#fef3c7' };
const REFUSAL_TR = {
    'FORBIDDEN: ACCOUNTING_MUTATION': 'Bu liste muhasebe yetkisi gerektirir.',
    INVALID_TERMS: 'Vade 0–365 gün olmalı.', REASON_REQUIRED: 'Gerekçe en az 5 karakter olmalı.', VALID_FROM_REQUIRED: 'Geçerlilik tarihi gerekli.',
    CUSTOMER_NOT_FOUND: 'Müşteri bulunamadı.',
};
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); return REFUSAL_TR[m] ?? humanError(m); };
export async function renderReceivablesScreen(container, api, state) {
    let rows = [];
    let loadError = null;
    try {
        rows = await api.list();
    }
    catch (e) {
        loadError = errText(e);
    }
    const go = (patch) => void renderReceivablesScreen(container, api, { ...state, error: null, notice: null, ...patch });
    const termsForm = (r) => {
        const days = h('input', { type: 'number', min: '0', max: '365', 'data-testid': 'rcv-days', placeholder: 'gün', style: 'width:5em' });
        const from = h('input', { type: 'date', 'data-testid': 'rcv-from', value: r.invoiceDay });
        const reason = h('input', { type: 'text', 'data-testid': 'rcv-reason', placeholder: 'Gerekçe (sözleşme vb.)', style: 'flex:1 1 140px;min-width:0' });
        const save = async () => {
            if (days.value.trim() === '')
                return go({ error: REFUSAL_TR.INVALID_TERMS });
            try {
                await api.setTerms(r.customerId, Number(days.value), from.value, reason.value.trim());
                go({ notice: 'Ödeme koşulu kaydedildi.' });
            }
            catch (e) {
                go({ error: errText(e) });
            }
        };
        return h('details', { 'data-testid': 'rcv-terms' }, h('summary', { style: 'font-size:12px' }, 'Bu müşteri için ödeme koşulu gir'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px' }, 'Vade: ', days, ' gün, geçerli: ', from, reason, h('button', { type: 'button', 'data-testid': 'rcv-save', onClick: () => void save() }, 'Kaydet')));
    };
    const card = (r) => h('div', { 'data-testid': 'rcv-row', 'data-state': r.state, 'data-invoice': r.invoiceId,
        style: `border:1px solid #e2e8f0;border-left:4px solid ${r.state === 'OVERDUE' ? '#b91c1c' : r.state === 'NO_TERMS' ? '#b45309' : '#15803d'};border-radius:10px;padding:6px 10px;margin:6px 0` }, h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between' }, h('b', {}, r.customerPo ?? '—'), h('span', { 'data-testid': 'rcv-open' }, `${NUM.format(r.open)} ${r.currency}`)), h('div', { style: 'font-size:12px;color:#475569' }, `Fatura: ${r.invoiceDay} · Vade: ${r.dueDate ?? 'BİLİNMİYOR'}`), h('span', { 'data-testid': 'rcv-state', style: `display:inline-block;margin-top:2px;font-size:11px;font-weight:700;padding:1px 6px;border-radius:6px;background:${STATE_BG[r.state]}` }, `${STATE_TR[r.state]}${r.overdueDays ? ` · ${r.overdueDays} gün` : ''}`), r.state === 'NO_TERMS' ? termsForm(r) : null);
    const overdue = rows.filter((r) => r.state === 'OVERDUE');
    mount(container, h('div', { style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'rcv-heading' }, 'Alacaklar & Vade'), h('p', { style: 'font-size:12px;color:#555' }, 'Gerçek gecikme = vade geçmiş ve bakiye açık. Ödeme koşulu girilmemiş faturada vade BİLİNMİYOR (gecikmemiş sayılmaz). Para birimleri toplanmaz.'), loadError ? h('div', { 'data-testid': 'rcv-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, loadError) : null, state.error ? h('div', { 'data-testid': 'rcv-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, state.error) : null, state.notice ? h('div', { 'data-testid': 'rcv-notice', style: 'padding:10px;border-radius:8px;background:#dcfce7' }, state.notice) : null, loadError ? null : h('div', { 'data-testid': 'rcv-summary', style: 'font-weight:700;margin:6px 0' }, `${overdue.length} vadesi geçmiş · ${rows.filter((r) => r.state === 'NO_TERMS').length} vadesi bilinmiyor · ${rows.filter((r) => r.state === 'NOT_DUE').length} vadesi gelmedi`), ...rows.map((r) => card(r)), !loadError && !rows.length ? h('div', { 'data-testid': 'rcv-empty', style: 'color:#64748b' }, 'Açık alacak yok.') : null));
}
