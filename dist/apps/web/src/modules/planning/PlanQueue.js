// Makine kuyruğu tablosu + satır işlemleri (Planlama Merkezi ve Makine Detayı ortak kullanır).
import { h } from '../../../../../packages/ui/src/h.js';
import { pill } from '../../ds.js';
import { SHIFT_TR, SHIFT_NAME, STATUS_TR, OP_STATUS_TR, WARN_TR, dayLabel, dayLong, fmtQty, fmtMin, fmtTime } from './planText.js';
import { machineName } from './planData.js';
import { openDialog, qtyLine, capLine, deliveryLine, shiftOpts, opts } from './PlanDialogs.js';
import { checkSplit } from './planSliceApi.js';
const estOf = (row, qty) => (row.estMinutes === null || row.estMinutes === undefined ? null : row.estMinutes * (qty / row.plannedQty));
export const queueOf = (data, machineId) => [...(data.queues[machineId] ?? [])].sort((a, b) => (a.status === 'STARTED' ? 0 : 1) - (b.status === 'STARTED' ? 0 : 1) || a.plannedDate.localeCompare(b.plannedDate) || a.shiftCode.localeCompare(b.shiftCode) || a.queueRank - b.queueRank);
// Aynı gün+vardiyadaki komşu (yukarı/aşağı taşıma yalnız bu grup içinde; tarih/vardiya için ayrı işlem var)
export const peerOf = (planned, i, dir) => { for (let k = i + dir; k >= 0 && k < planned.length; k += dir) if (planned[k].plannedDate === planned[i].plannedDate && planned[k].shiftCode === planned[i].shiftCode) return k; return -1; };
const sliceLabel = (data, r) => `${data.woInfo[r.workOrderId]?.label ?? r.workOrderId.slice(0, 8)} · ${r.opCode}`;

// ---------- diyaloglar ----------
export function dlgMove(ctx, r, focus) {
  const { data } = ctx;
  openDialog(ctx, { testid: 'dlg-move', title: `${focus === 'shift' ? 'Vardiya' : 'Tarih'} değiştir — ${sliceLabel(data, r)}`, intro: `${fmtQty(r.plannedQty)} adet · şimdi ${dayLabel(r.plannedDate)} · ${SHIFT_TR[r.shiftCode]}`,
    fields: [{ key: 'date', label: 'Yeni tarih', type: 'date', value: r.plannedDate }, { key: 'shift', label: 'Yeni vardiya', type: 'select', value: r.shiftCode, options: shiftOpts() }],
    validate: (v) => (!v.date ? 'Tarih seçin.' : v.date === r.plannedDate && v.shift === r.shiftCode ? 'Tarih veya vardiya değişmedi.' : null),
    preview: async (v) => !v.date ? [] : [qtyLine(data, r.operationId, 0), await capLine(data, r.machineId ?? ctx.machineId, v.date, v.shift, estOf(r, r.plannedQty), r.plannedQty), await deliveryLine(data, r.workOrderId, r.sliceId, v.date)],
    save: (v, reason) => data.api.move({ sliceId: r.sliceId, date: v.date, shift: v.shift, version: r.version, reason }) });
}
export function dlgSplit(ctx, r) {
  const { data } = ctx;
  openDialog(ctx, { testid: 'dlg-split', title: `Böl — ${sliceLabel(data, r)}`, intro: `${fmtQty(r.plannedQty)} adetlik dilim iki parçaya ayrılır; ikinci parça aynı tarih/vardiyada oluşur, sonra taşıyabilirsiniz.`,
    fields: [{ key: 'first', label: 'İlk parça (adet)', type: 'number', value: Math.floor(r.plannedQty / 2), min: 1 }],
    validate: (v) => (!(v.first > 0) || v.first >= r.plannedQty || v.first !== Math.trunc(v.first) ? `İlk parça 1 ile ${r.plannedQty - 1} arasında tam sayı olmalı.` : null),
    preview: async (v) => !(v.first > 0 && v.first < r.plannedQty) ? [] : [{ id: 'prev-split', kind: 'good', text: `Bölme: ${fmtQty(v.first)} + ${fmtQty(r.plannedQty - v.first)} = ${fmtQty(r.plannedQty)} (toplam değişmez)` }, qtyLine(data, r.operationId, 0)],
    save: (v, reason) => data.api.split({ sliceId: r.sliceId, qtyFirst: v.first, version: r.version, reason }) });
}
export function dlgDefer(ctx, r) {
  const { data } = ctx; const done = (r.actualGood ?? 0) + (r.actualScrap ?? 0) + (r.actualTashih ?? 0); const rem = r.plannedQty - done;
  openDialog(ctx, { testid: 'dlg-defer', title: `Kalanı ertele — ${sliceLabel(data, r)}`, intro: r.status === 'STARTED' ? `Dilim kapatılır (gerçekleşen ${fmtQty(done)} korunur); kalan ${fmtQty(rem)} adet yeni dilim olur.` : `Dilim yeni tarihe taşınır (${fmtQty(rem)} adet).`,
    fields: [{ key: 'date', label: 'Yeni tarih', type: 'date', value: '' }, { key: 'shift', label: 'Yeni vardiya', type: 'select', value: r.shiftCode, options: shiftOpts() }],
    validate: (v) => (!v.date ? 'Yeni tarih seçin.' : null),
    preview: async (v) => !v.date ? [] : [qtyLine(data, r.operationId, 0, 'Miktar (toplam korunur)'), await capLine(data, r.machineId ?? ctx.machineId, v.date, v.shift, estOf(r, rem), rem), await deliveryLine(data, r.workOrderId, r.sliceId, v.date)],
    save: (v, reason) => data.api.deferRemaining({ sliceId: r.sliceId, date: v.date, shift: v.shift, version: r.version, reason }) });
}
export function dlgReorder(ctx, machineId, planned, idx, dir) {
  const { data } = ctx; const k = peerOf(planned, idx, dir); const a = planned[idx], b = planned[k];
  const ranked = [...planned].sort((x, y) => x.queueRank - y.queueRank).map((x) => x.sliceId); const ia = ranked.indexOf(a.sliceId), ib = ranked.indexOf(b.sliceId); const after = ranked.slice(); after[ia] = b.sliceId; after[ib] = a.sliceId;
  const group = planned.filter((x) => x.plannedDate === a.plannedDate && x.shiftCode === a.shiftCode); const newGroup = group.map((x) => (x.sliceId === a.sliceId ? b : x.sliceId === b.sliceId ? a : x));
  openDialog(ctx, { testid: 'dlg-reorder', title: `Sırayı değiştir — ${machineName(data, machineId)}`, intro: `${sliceLabel(data, a)} (${fmtQty(a.plannedQty)}) ${dir < 0 ? 'bir sıra yukarı' : 'bir sıra aşağı'}: ${sliceLabel(data, b)} ile yer değiştirir (${dayLabel(a.plannedDate)} · ${SHIFT_TR[a.shiftCode]}). Rota (OP sırası) değişmez; yalnız bu makinenin kuyruğu.`, fields: [],
    validate: () => null,
    preview: async () => [{ id: 'prev-order', text: 'Yeni sıra: ' + newGroup.map((x, i) => `${i + 1}) ${fmtQty(x.plannedQty)} ${sliceLabel(data, x)}`).join('  →  ') }, qtyLine(data, a.operationId, 0, 'Miktar (değişmez)'), { id: 'prev-cap', kind: 'good', text: 'Kapasite: tarih/vardiya değişmiyor, yük aynı' }, { id: 'prev-del', kind: 'good', text: 'Termin: tarih değişmediği için etkilenmez' }],
    save: (v, reason) => data.api.reorder({ machineId, ordered: after, version: a.machineVersion, reason }) });
}
export function dlgMerge(ctx, a, b) {
  const { data } = ctx; const ea = estOf(a, a.plannedQty), eb = estOf(b, b.plannedQty); const tot = a.plannedQty + b.plannedQty;
  openDialog(ctx, { testid: 'dlg-merge', title: 'Dilimleri birleştir', intro: `${sliceLabel(data, a)}: ${fmtQty(a.plannedQty)} adet (${dayLong(a.plannedDate)}) + ${fmtQty(b.plannedQty)} adet (${dayLong(b.plannedDate)}) → ${dayLong(a.plannedDate)} · ${SHIFT_NAME[a.shiftCode]} içinde tek dilim, ${fmtQty(tot)} adet.`, fields: [], validate: () => null,
    preview: async () => [qtyLine(data, a.operationId, 0, 'Miktar (toplam değişmez)'), await capLine(data, a.machineId ?? ctx.machineId, a.plannedDate, a.shiftCode, ea === null || eb === null ? null : estOf(a, tot), tot), await deliveryLine(data, a.workOrderId)],
    save: (v, reason) => data.api.merge({ a: a.sliceId, b: b.sliceId, versionA: a.version, versionB: b.version, reason }) });
}
export function dlgCancel(ctx, r) {
  const { data } = ctx;
  openDialog(ctx, { testid: 'dlg-cancel-slice', title: `Dilimi iptal et — ${sliceLabel(data, r)}`, intro: 'Yalnız başlamamış dilim iptal edilir; miktar tekrar "planlanmamış"a döner. Gerçekleşmiş üretim silinmez.', fields: [], validate: () => null,
    preview: async () => [qtyLine(data, r.operationId, -r.plannedQty), await deliveryLine(data, r.workOrderId)], save: (v, reason) => data.api.cancel({ sliceId: r.sliceId, version: r.version, reason }) });
}
const CHECK_TR = { ROUTE: 'Rota', MACHINE_STATUS: 'Makine durumu', MACHINE_FREE: 'Makine boşluğu', CAM_NC: 'CAM/NC programı', TOOLS: 'Takımlar', FIXTURE: 'Bağlama / fikstür', SKILL: 'Makine yeterliliği', FIRST_PIECE: 'İlk parça' };
const STATE_TR = { OK: 'Doğrulandı', FAIL: 'ENGEL', UNKNOWN: 'BİLİNMİYOR', GATE: 'Başlatmada zorunlu kapı' };
export function dlgReassign(ctx, r) {
  const { data } = ctx; const op = data.ops.find((o) => o.id === r.operationId); const cands = data.allMachines.filter((m) => (op?.allowedMachineIds ?? []).includes(m.id) && m.id !== ctx.machineId);
  const chk = { to: null, rows: null };
  openDialog(ctx, { testid: 'dlg-reassign', title: `Makine değiştir (arıza) — ${sliceLabel(data, r)}`, intro: 'Yalnız başlamamış dilim taşınır; geçmiş üretimin makine kaydı değişmez. "Makine çalışıyor + rotada var" tek başına uygunluk kanıtı değildir; aşağıdaki kontroller gösterilir.',
    fields: [{ key: 'to', label: 'Hedef makine', type: 'select', value: cands[0]?.id ?? '', options: opts(cands.map((m) => [m.id, `${m.code}${m.name ? ' · ' + m.name : ''}${m.status !== 'UP' ? ' (' + m.status + ')' : ''}`])) },
      { key: 'ack', label: 'Bilinmeyen doğrulamaları ben/ustabaşı yapacağım; başlatma kapıları (CAM/NC, takım, ilk parça) yine zorunlu olduğunu biliyorum.', type: 'checkbox' }],
    validate: (v) => { if (!v.to) return 'Rotada izinli başka makine yok.'; if (chk.to !== v.to || !chk.rows) return 'Doğrulamalar yükleniyor…';
      const fails = chk.rows.filter((x) => x.state === 'FAIL'); if (fails.length) return 'Taşınamaz: ' + fails.map((x) => `${CHECK_TR[x.checkCode] ?? x.checkCode} — ${x.detail}`).join('; ');
      return chk.rows.some((x) => x.state === 'UNKNOWN') && !v.ack ? 'Bilinmeyen doğrulamalar var; devam etmek için onay kutusunu işaretleyin.' : null; },
    preview: async (v) => { if (!v.to) return []; try { chk.rows = await data.api.reassignChecks(r.sliceId, v.to); chk.to = v.to; } catch { chk.rows = null; return [{ id: 'prev-checks', kind: 'unk', text: 'Doğrulama listesi okunamadı.' }]; }
      const lines = chk.rows.map((x) => ({ id: `chk-${x.checkCode}`, kind: x.state === 'OK' ? 'good' : x.state === 'FAIL' ? 'bad' : 'unk', text: `${CHECK_TR[x.checkCode] ?? x.checkCode}: ${STATE_TR[x.state]} — ${x.detail}.` }));
      return [...lines, qtyLine(data, r.operationId, 0), await capLine(data, v.to, r.plannedDate, r.shiftCode, estOf(r, r.plannedQty), r.plannedQty), await deliveryLine(data, r.workOrderId)]; },
    save: async (v, reason) => { const mv = (await ctx.client.select('machine_queue_state', { columns: 'machine_id,version', filters: { machine_id: `eq.${v.to}` } }, ctx.session))[0]?.version ?? 0;
      const unk = (chk.rows ?? []).filter((x) => x.state === 'UNKNOWN').map((x) => CHECK_TR[x.checkCode]); const why = unk.length ? `${reason} [Bilinmeyen doğrulamalar kabul edildi: ${unk.join(', ')}]` : reason;
      return data.api.reassign({ sliceId: r.sliceId, toMachineId: v.to, version: r.version, versionTo: mv, reason: why }); } });
}
export function dlgCreate(ctx, op, { qty, machineId, title } = {}) {
  const { data } = ctx; const s = data.summaries[op.id]; const lab = `${data.woInfo[op.workOrderId]?.label} · ${data.opLabel(op)}`; const mids = (op.allowedMachineIds ?? []).filter((id) => data.allMachines.some((m) => m.id === id));
  const est = (q) => (op.setupMinutesTarget == null || op.cycleSecondsTarget == null ? null : Number(op.setupMinutesTarget) + (Number(op.cycleSecondsTarget) * q) / 60);
  openDialog(ctx, { testid: 'dlg-create', title: title ?? `Dilim ekle — ${lab}`, intro: `Planlanmamış: ${fmtQty(s?.unplannedQty)} adet`,
    fields: [{ key: 'qty', label: 'Adet', type: 'number', value: qty ?? s?.unplannedQty ?? '', min: 1 }, { key: 'date', label: 'Tarih', type: 'date', value: ctx.defaultDate }, { key: 'shift', label: 'Vardiya', type: 'select', value: 'TeamK1', options: shiftOpts() },
      { key: 'machine', label: 'Makine', type: 'select', value: machineId ?? op.plannedMachineId ?? mids[0], options: opts(mids.map((id) => [id, machineName(data, id)])) }],
    validate: (v) => (!(v.qty > 0) || v.qty !== Math.trunc(v.qty) ? 'Adet pozitif tam sayı olmalı.' : !v.date ? 'Tarih seçin.' : v.qty > (s?.unplannedQty ?? Infinity) ? `Planlanmamış miktar (${fmtQty(s?.unplannedQty)} adet) aşılamaz.` : null),
    preview: async (v) => !(v.qty > 0) || !v.date ? [] : [qtyLine(data, op.id, v.qty), await capLine(data, v.machine, v.date, v.shift, est(v.qty), v.qty), await deliveryLine(data, op.workOrderId)],
    save: (v, reason) => data.api.create({ opId: op.id, qty: v.qty, date: v.date, shift: v.shift, machineId: v.machine, reason }) });
}
// 1.500 → 300 / 400 / 800 gibi çoklu bölme planı. Satır: Adet | Tarih | Vardiya | Sil. Toplam planlanmamış miktarı aşamaz.
export function dlgMulti(ctx, op) {
  const { data } = ctx; const s = data.summaries[op.id]; const un = s?.unplannedQty ?? 0; const mids = (op.allowedMachineIds ?? []).filter((id) => data.allMachines.some((m) => m.id === id));
  const rows = []; let seq = 0; let dlg = null;
  const host = h('div', { 'data-testid': 'multi-rows', class: 'mrows' }, h('div', { class: 'mrow mh' }, h('span', {}, 'Adet'), h('span', {}, 'Tarih'), h('span', {}, 'Vardiya'), h('span', {}, '')));
  const addRow = () => { const id = seq++; const r = { id, q: h('input', { type: 'number', min: '1', placeholder: 'adet', 'data-testid': `ml-qty-${id}`, 'aria-label': 'Adet' }), d: h('input', { type: 'date', value: ctx.defaultDate, 'data-testid': `ml-date-${id}`, 'aria-label': 'Tarih' }),
      s: h('select', { 'data-testid': `ml-shift-${id}`, 'aria-label': 'Vardiya' }, ...shiftOpts().map((o) => h('option', { value: o.value }, o.label))) };
    r.del = h('button', { 'data-testid': `ml-del-${id}`, title: 'Satırı sil', 'aria-label': 'Satırı sil', onClick: (e) => { e.preventDefault(); const k = rows.indexOf(r); if (k >= 0) rows.splice(k, 1); r.node.remove(); dlg?.refresh(); } }, '✕');
    r.node = h('div', { class: 'mrow' }, r.q, r.d, r.s, r.del); rows.push(r); host.appendChild(r.node); for (const e of [r.q, r.d, r.s]) { e.addEventListener('input', () => dlg?.refresh()); e.addEventListener('change', () => dlg?.refresh()); } };
  const get = () => rows.filter((r) => r.q.value !== '').map((r) => ({ qty: Number(r.q.value), date: r.d.value, shift: r.s.value }));
  const est = (q) => (op.setupMinutesTarget == null || op.cycleSecondsTarget == null ? null : Number(op.setupMinutesTarget) + (Number(op.cycleSecondsTarget) * q) / 60);
  addRow(); addRow(); addRow();
  const extra = h('div', {}, host, h('button', { 'data-testid': 'ml-add', onClick: (e) => { e.preventDefault(); addRow(); dlg?.refresh(); } }, '+ Satır ekle'));
  dlg = openDialog(ctx, { testid: 'dlg-multi', title: `Çoklu bölme planı — ${data.woInfo[op.workOrderId]?.label} · ${data.opLabel(op)}`, intro: `Hedef ${fmtQty(s?.targetQty)} adet · üretilen sağlam ${fmtQty(s?.producedGood)} · açık planlı ${fmtQty(s?.openPlannedQty)} · planlanmamış ${fmtQty(un)}. Planlanmamış adedi tarih/vardiya dilimlerine bölün.`,
    fields: [{ key: 'machine', label: 'Makine', type: 'select', value: op.plannedMachineId ?? mids[0], options: opts(mids.map((id) => [id, machineName(data, id)])) }], extra,
    validate: () => { const g = get(); const c = checkSplit(un, g.map((x) => x.qty)); return !g.length ? 'En az bir satıra adet girin.' : g.some((x) => !x.date) ? 'Her satır için tarih seçin.' : !c.ok ? (c.code === 'OVER_PLANNED' ? `Toplam ${fmtQty(c.over)} adet fazla (planlanmamış ${fmtQty(un)} adet).` : 'Adetler pozitif tam sayı olmalı.') : null; },
    preview: async (v) => { const g = get().filter((x) => x.qty > 0 && x.date); const sum = g.reduce((a, b) => a + b.qty, 0); const out = [qtyLine(data, op.id, sum)];
      for (const x of g) out.push(await capLine(data, v.machine, x.date, x.shift, est(x.qty), x.qty));
      const due = data.woInfo[op.workOrderId]?.dueDate; if (data.canPlan && g.length && due) { const last = g.map((x) => x.date).sort().pop(); out.push({ id: 'prev-del', kind: last > due ? 'bad' : 'good', text: `Termin ${dayLong(due)} — bu operasyonun son dilimi ${dayLong(last)}${last > due ? ' → TERMİNDEN SONRA' : ' (termin öncesi; sonraki operasyonlar ayrıca planlanır)'}.` }); }
      return out; },
    save: async (v, reason) => { for (const x of get()) await data.api.create({ opId: op.id, qty: x.qty, date: x.date, shift: x.shift, machineId: v.machine, reason }); } });
}
// ---------- kuyruk: şu an / bugün / ileri tarihli ----------
const rowFlag = (r, today) => (r.status === 'STARTED' ? 'run' : r.plannedDate <= today ? 'today' : 'future');
export function renderQueue(ctx, machineId, { compact = false, sections = ['run', 'today', 'future'] } = {}) {
  const { data } = ctx; const today = ctx.today; const all = queueOf(data, machineId); const planned = all.filter((r) => r.status === 'PLANNED'); const can = data.canPlan && !compact; const sel = ctx.selection;
  all.forEach((r) => { r.machineId = machineId; });
  if (!all.length) return h('div', { 'data-testid': 'queue-empty', class: 'state' }, h('div', {}, h('b', {}, 'Bu makinede planlı dilim yok'), 'Planlanmamış operasyonlara aşağıdan dilim ekleyebilirsiniz.'));
  const picked = all.filter((r) => sel.has(r.sliceId)); const mergeOk = can && picked.length === 2 && picked.every((p) => p.status === 'PLANNED') && picked[0].operationId === picked[1].operationId;
  const grp = (r) => planned.filter((x) => x.plannedDate === r.plannedDate && x.shiftCode === r.shiftCode);
  const card = (r) => {
    const pi = planned.findIndex((x) => x.sliceId === r.sliceId); const rs = data.reasons[r.sliceId]; const live = r.status === 'STARTED'; const g = grp(r); const k = g.findIndex((x) => x.sliceId === r.sliceId);
    const wo = data.woInfo[r.workOrderId]; const ready = live ? pill('Üretimde', 'info', `st-${r.sliceId}`) : rs?.unknown ? pill('Hazırlık bilinmiyor', 'unknown', `st-${r.sliceId}`) : rs?.text ? pill('Bekliyor', 'warn', `st-${r.sliceId}`) : rs ? pill('Hazır', 'ok', `st-${r.sliceId}`) : null;
    const btn = (label, tid, fn, cls = '', dis = false) => h('button', { 'data-testid': `${tid}-${r.sliceId}`, class: cls, onClick: fn, ...(dis ? { disabled: true } : {}) }, label);
    const acts = !can ? [] : r.status === 'PLANNED' ? [btn('Tarih', 'a-date', () => dlgMove(ctx, r, 'date')), btn('Vardiya', 'a-shift', () => dlgMove(ctx, r, 'shift')), btn('Böl', 'a-split', () => dlgSplit(ctx, r)),
        btn('↑', 'a-up', () => dlgReorder(ctx, machineId, planned, pi, -1), '', peerOf(planned, pi, -1) < 0), btn('↓', 'a-down', () => dlgReorder(ctx, machineId, planned, pi, 1), '', peerOf(planned, pi, 1) < 0), btn('Ertele', 'a-defer', () => dlgDefer(ctx, r)),
        btn('Makine', 'a-reassign', () => dlgReassign(ctx, r)), btn('İptal', 'a-cancel', () => dlgCancel(ctx, r), 'danger'),
        btn('Başlat', 'a-start', async () => { try { await data.api.start(r.sliceId, r.version); ctx.toast('Dilim başlatıldı'); await ctx.reload(); } catch (e) { ctx.fail(e); } }, 'go', !!rs?.text)]
      : [btn('Kalanı ertele', 'a-defer', () => dlgDefer(ctx, r)), btn('Kapat', 'a-close', () => dlgClose(ctx, r))];
    return h('article', { class: `qcard ${r.status} ${ctx.selectedSlice === r.sliceId ? 'sel' : ''}`, 'data-testid': `qrow-${r.sliceId}`, 'data-slice': r.sliceId, 'data-flag': rowFlag(r, today) },
      h('div', { class: 'qtop' }, can && r.status === 'PLANNED' ? h('input', { type: 'checkbox', 'aria-label': 'Birleştirmek için seç', 'data-testid': `pick-${r.sliceId}`, ...(sel.has(r.sliceId) ? { checked: true } : {}), onChange: (e) => { e.target.checked ? sel.add(r.sliceId) : sel.delete(r.sliceId); ctx.rerender(); } }) : null,
        h('div', { class: 'qtitle' }, h('b', {}, wo?.label ?? '—'), h('span', { class: 'mut' }, ` · ${r.opCode}`)), h('div', { class: 'qqty', 'data-testid': `qty-${r.sliceId}` }, `${fmtQty(r.plannedQty)} adet`), ready),
      h('div', { class: 'qmid' }, h('span', { 'data-testid': `when-${r.sliceId}` }, `${dayLong(r.plannedDate)} · ${SHIFT_NAME[r.shiftCode]}`), live ? h('span', { class: 'okr' }, 'Üretimde') : h('span', { class: 'mut', 'data-testid': `prio-${r.sliceId}` }, `Öncelik: ${k + 1}/${g.length}${r.plannedDate < today && r.status === 'PLANNED' ? ' · tarihi geçti' : ''}`)),
      live ? h('div', { class: 'qactual', 'data-testid': `actual-${r.sliceId}` }, `Gerçekleşen: ${fmtQty(r.actualGood)} sağlam · ${fmtQty(r.actualScrap)} hurda · ${fmtQty(r.actualTashih)} tahsis — dilimde kalan ${fmtQty(r.remainingQty)}`) : null,
      live && Number(r.remainingQty) <= 0 ? h('div', { class: 'reason', 'data-testid': `done-wait-${r.sliceId}` }, 'Dilim miktarı tamamlandı — kapatma bekliyor. Dilimi kapatınca makine yeni işe hazır olur.') : null,
      !live && rs?.text ? h('div', { class: 'reason', 'data-testid': 'wait-reason' }, 'Bekleme nedeni: ' + rs.text) : rs?.unknown ? h('div', { class: 'mut' }, rs.text) : null,
      !live && r.opAvailableInput !== null && r.opAvailableInput < r.plannedQty ? h('div', { class: 'reason' }, `Kalitece serbest girdi ${fmtQty(r.opAvailableInput)} adet (dilim ${fmtQty(r.plannedQty)})`) : null,
      h('details', { class: 'qdet', 'data-testid': `det-${r.sliceId}` }, h('summary', {}, 'Detay'),
        h('div', {}, r.plannedStart ? `Saat: ${fmtTime(r.plannedStart)}–${fmtTime(r.plannedEnd) ?? '?'} (${fmtMin(r.estMinutes)})` : 'Saat/süre: veri yok (tahmin yapılmadı)'), h('div', {}, `Operasyon durumu: ${OP_STATUS_TR[r.opStatus] ?? r.opStatus}`),
        can && wo?.dueDate ? h('div', {}, `Termin: ${dayLong(wo.dueDate)}`) : null, ...(r.warnings ?? []).map((w) => pill(WARN_TR[w] ?? w, w === 'NO_TIME_DATA' ? 'unknown' : 'warn', `warn-${w}`))),
      acts.length ? h('div', { class: 'actions' }, ...acts) : null); };
  const wrap = h('div', { 'data-testid': 'queue' }); const by = { run: all.filter((r) => rowFlag(r, today) === 'run'), today: all.filter((r) => rowFlag(r, today) === 'today'), future: all.filter((r) => rowFlag(r, today) === 'future') };
  const sec = (key, title, list, empty) => h('section', { class: `qsec ${key}`, 'data-testid': `sec-${key}` }, h('h3', {}, `${title} (${list.length})`), list.length ? list.map(card) : (empty ? h('div', { class: 'mut', 'data-testid': `${key}-empty` }, empty) : null));
  if (sections.includes('run')) wrap.append(sec('run', 'Şu anda üretimde', by.run, 'Bu makinede şu an üretimde dilim yok.'));
  if (sections.includes('today')) wrap.append(sec('today', `Bugün sırada (${dayLong(today)})`, by.today, 'Bugün için sırada iş yok. İleri tarihli işler bugünkü kuyruğu bloke etmez.'));
  if (sections.includes('future')) { const dates = [...new Set(by.future.map((r) => r.plannedDate))]; wrap.append(h('section', { class: 'qsec future', 'data-testid': 'sec-future' }, h('h3', {}, `İleri tarihli plan (${by.future.length})`), by.future.length ? dates.map((d) => h('div', { class: 'dgrp', 'data-testid': `dgrp-${d}` }, h('h4', {}, `${dayLabel(d)} — ${dayLong(d)}`), ...by.future.filter((r) => r.plannedDate === d).map(card))) : h('div', { class: 'mut', 'data-testid': 'future-empty' }, 'İleri tarihli plan yok.'))); }
  if (can) wrap.append(h('div', { class: 'actions', style: 'margin-top:8px' }, h('button', { 'data-testid': 'merge-btn', disabled: !mergeOk, onClick: () => dlgMerge(ctx, picked[0], picked[1]) }, 'Seçilen iki dilimi birleştir'), h('span', { class: 'mut' }, 'Aynı operasyonun başlamamış iki dilimini işaretleyin.')));
  return wrap;
}
export function dlgClose(ctx, r) {
  const { data } = ctx;
  openDialog(ctx, { testid: 'dlg-close', title: `Dilimi kapat — ${sliceLabel(data, r)}`, intro: `Gerçekleşen (operasyon kaydından): ${fmtQty(r.actualGood)} sağlam · ${fmtQty(r.actualScrap)} hurda · ${fmtQty(r.actualTashih)} tahsis. Planlanan ${fmtQty(r.plannedQty)}.`, fields: [], validate: () => null,
    preview: async () => [{ id: 'prev-close', kind: 'unk', text: 'Kapatma sayıları değiştirmez; yalnız bu dilimin gerçekleşenini sabitler. Operasyon TAMAMLANMAZ, makine serbest kalır. Eksik sağlam adet "planlanmamış" görünür ve yeni (telafi) dilimle planlanır.' }],
    save: (v, reason) => data.api.close({ sliceId: r.sliceId, version: r.version, reason }) });
}
