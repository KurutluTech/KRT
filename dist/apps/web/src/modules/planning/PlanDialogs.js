// Plan değiştirme diyalogları: her kayıttan ÖNCE miktar toplamı, kapasite ve termin etkisi gösterilir; gerekçe zorunlu; sürüm çakışması açıkça bildirilir.
import { h } from '../../../../../packages/ui/src/h.js';
import { SHIFT_TR, SHIFT_NAME, fmtQty, fmtMin, errText, isConflict, dayLabel, dayLong } from './planText.js';
import { machineName } from './planData.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function field(f, onInput) {
  const common = { 'data-testid': `f-${f.key}`, onInput: onInput, onChange: onInput };
  let el;
  if (f.type === 'select') el = h('select', common, ...f.options.map((o) => h('option', { value: o.value, ...(String(o.value) === String(f.value) ? { selected: 'selected' } : {}) }, o.label)));
  else if (f.type === 'checkbox') el = h('input', { ...common, type: 'checkbox' });
  else if (f.type === 'textarea') el = h('textarea', { ...common, rows: '2', placeholder: f.placeholder ?? '' });
  else el = h('input', { ...common, type: f.type ?? 'text', ...(f.min !== undefined ? { min: String(f.min) } : {}), ...(f.step ? { step: f.step } : {}), ...(f.placeholder ? { placeholder: f.placeholder } : {}) });
  if (f.type !== 'select' && f.type !== 'checkbox') el.value = f.value ?? '';
  return { key: f.key, el, node: h('label', f.type === 'checkbox' ? { class: 'chk' } : {}, f.type === 'checkbox' ? [el, ' ', f.label] : [f.label, el]), get: () => (f.type === 'checkbox' ? el.checked : f.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value) };
}
export const lines = (arr) => h('div', { class: 'prev', 'data-testid': 'dlg-preview' }, ...arr.map((l) => h('div', { class: l.kind ?? '', ...(l.id ? { 'data-testid': l.id } : {}) }, l.text)));
// ---- önizleme yapı taşları (hepsi sunucu verisi; veri yoksa "bilinmiyor", tahmin yok) ----
export function qtyLine(data, opId, delta, label = 'Miktar') {
  const s = data.summaries[opId]; if (!s) return { id: 'prev-qty', kind: 'unk', text: `${label}: operasyon özeti okunamadı` };
  const after = s.coveredQty + delta, un = Math.max(0, s.targetQty - after);  // coveredQty = üretilen sağlam + açık planlanan
  return { id: 'prev-qty', kind: after > s.targetQty ? 'bad' : 'good', text: `${label}: hedef ${fmtQty(s.targetQty)} · üretilen sağlam ${fmtQty(s.producedGood)} · açık planlı ${fmtQty(s.openPlannedQty)} → ${fmtQty(s.openPlannedQty + delta)} · planlanmamış ${fmtQty(s.unplannedQty)} → ${fmtQty(un)}${after > s.targetQty ? ` · HEDEFİ ${fmtQty(after - s.targetQty)} AŞIYOR` : ''}` };
}
export async function capLine(data, machineId, date, shift, addMin, qty) {
  const when = `${dayLong(date)} · ${SHIFT_NAME[shift] ?? shift}`; const what = qty ? ` — ${fmtQty(qty)} adet` : '';
  try {
    const rows = await data.api.capacity(machineId, date, date); const r = rows.find((x) => x.shiftCode === shift);
    const cap = r?.capacityMin ?? (shift === 'TeamK1' || shift === 'TeamK2' ? 480 : null);
    if (addMin === null || addMin === undefined) return { id: 'prev-cap', kind: 'unk', text: `${when}${what} — bu iş için süre verisi yok, kapasite yükü bilinmiyor.` };
    if (r && r.loadKnown === false) return { id: 'prev-cap', kind: 'unk', text: `${when}${what} — vardiyadaki mevcut işlerin süre verisi eksik, toplam yük bilinmiyor.` };
    const load = (r?.loadMin ?? 0) + addMin; const over = load > cap;
    return { id: 'prev-cap', kind: over ? 'bad' : 'good', text: `${when}${what} — ${fmtMin(load).replace(' dk', '')}/${cap} dakika — ${over ? `kapasite AŞILIYOR (${fmtMin(load - cap).replace(' dk', '')} dk fazla).` : 'kapasite uygun.'}` };
  } catch { return { id: 'prev-cap', kind: 'unk', text: `${when}${what} — kapasite bilgisi okunamadı.` }; }
}
export async function deliveryLine(data, woId, sliceId, newDate) {
  const why = { UNPLANNED_QTY: 'planlanmamış miktar var', NO_SLICES: 'henüz dilim yok', NO_DUE_DATE: 'termin tanımlı değil' };
  try {
    const cur = (await data.api.deliveryImpact(woId))[0]; if (!cur) return { id: 'prev-del', kind: 'unk', text: 'Termin etkisi: bu bilgi yetkinize açık değil veya okunamadı.' };
    const aft = sliceId && newDate ? (await data.api.deliveryImpact(woId, sliceId, newDate))[0] : null;
    const f = (r) => (r.projectedFinish ? `tahmini bitiş ${dayLong(r.projectedFinish)}${r.daysLate === null ? '' : r.daysLate > 0 ? ` (${r.daysLate} gün GEÇ)` : r.daysLate === 0 ? ' (tam zamanında)' : ` (${-r.daysLate} gün erken)`}` : `tahmini bitiş belirsiz (${why[r.reason] ?? 'veri yok'})`);
    const bad = aft?.daysLate > 0 || (!aft && cur.daysLate > 0);
    return { id: 'prev-del', kind: bad ? 'bad' : cur.projectedFinish ? 'good' : 'unk', text: `Termin ${cur.dueDate ? dayLong(cur.dueDate) : '(tanımsız)'} — şu an ${f(cur)}${aft ? ` → değişince ${f(aft)}` : ''}.` };
  } catch { return { id: 'prev-del', kind: 'unk', text: 'Termin etkisi okunamadı.' }; }
}
// ---- genel diyalog ----
export function openDialog(ctx, spec) {
  const root = ctx.root; const fields = spec.fields.map((f) => field(f, () => refresh()));
  const reasonF = spec.noReason ? null : field({ key: 'reason', label: 'Gerekçe (zorunlu, audit kaydına yazılır)', type: 'textarea', value: '', placeholder: 'Neden değiştiriliyor?' }, () => refresh());
  const vals = () => Object.fromEntries(fields.map((f) => [f.key, f.get()]));
  const prevHost = h('div', {}); const err = h('div', { class: 'banner error', 'data-testid': 'dlg-error', style: 'display:none', role: 'alert' });
  const save = h('button', { class: 'okb', 'data-testid': 'dlg-save', disabled: true, onClick: async () => {
    save.disabled = true; err.style.display = 'none';
    try { await spec.save(vals(), reasonF ? reasonF.get().trim() : ''); close(); ctx.toast(spec.done ?? 'Kaydedildi'); await ctx.reload(); }
    catch (e) { err.textContent = errText(e); err.style.display = ''; if (isConflict(e)) { err.append(' ', h('button', { 'data-testid': 'dlg-reload', onClick: async () => { close(); await ctx.reload(); } }, 'Güncel veriyi yükle')); } refresh(); } } }, spec.saveLabel ?? 'Kaydet');
  const overlay = h('div', { class: 'overlay', 'data-testid': 'dlg-overlay' }, h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': spec.title, 'data-testid': spec.testid },
    h('h1', {}, spec.title), spec.intro ? h('div', { class: 'mut' }, spec.intro) : null, ...fields.map((f) => f.node), spec.extra ?? null, prevHost, reasonF?.node ?? null, err,
    h('div', { class: 'actions' }, save, h('button', { 'data-testid': 'dlg-cancel', onClick: () => close() }, 'Vazgeç'))));
  const close = () => overlay.remove();
  let seq = 0;
  async function refresh() {
    const my = ++seq; const v = vals(); const reasonOk = () => !reasonF || reasonF.get().trim().length >= 3;
    save.disabled = !!(spec.validate?.(v)) || !reasonOk();
    await sleep(120); if (my !== seq) return;
    const ls = await spec.preview(v); if (my !== seq) return;
    const bad = spec.validate?.(v) ?? null; save.disabled = !!bad || !reasonOk();
    const need = bad ? { id: 'dlg-invalid', kind: 'bad', text: bad } : !reasonOk() ? { id: 'dlg-need-reason', kind: 'unk', text: 'Kaydetmek için gerekçe yazın.' } : null;
    prevHost.replaceChildren(lines([...ls, ...(need ? [need] : [])]));
  }
  root.appendChild(overlay); refresh(); fields[0]?.el.focus?.();
  return { close, refresh };
}
export const opts = (arr) => arr.map(([value, label]) => ({ value, label }));
export const shiftOpts = () => opts([['TeamK1', SHIFT_TR.TeamK1], ['TeamK2', SHIFT_TR.TeamK2]]);
