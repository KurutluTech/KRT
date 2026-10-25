// Planlama Merkezi (/planlama-merkezi) — makine bazlı gün/hafta takvimi, her makinenin kendi kuyruğu, planlanmamış miktar ve dilim işlemleri.
// Her sayı sunucudan (0155/0156 RPC + RLS); tarayıcı hiçbir değer uydurmaz. Yetki sunucuda (queue_can_reorder); yetkisizde ekran salt okunur.
import { h, mount } from '../../../../../packages/ui/src/h.js';
import { DS_CSS, pill, kpi, stateBox } from '../../ds.js';
import { PLAN_CSS } from './planCss.js';
import { loadPlan, machineName, allSlicesOf } from './planData.js';
import { SHIFT_SHORT, SHIFT_TR, OP_STATUS_TR, errText, addDays, weekStart, dayLabel, dayLong, fmtQty, fmtMin } from './planText.js';
import { renderQueue, queueOf, dlgCreate, dlgMulti } from './PlanQueue.js';

export async function renderPlanningCenter(el, deps) {
  const { client, session } = deps; const q = deps.query ?? new URLSearchParams(); const TODAY = q.get('t') || deps.today;
  const st = { view: q.get('v') === 'day' ? 'day' : 'week', anchor: q.get('d') || TODAY, machine: q.get('m') || null, filter: 'ALL', data: null, error: null, loading: true, done: [], caps: {} };
  const selection = new Set(); const root = h('div', { class: 'kd plan', 'data-testid': 'pc-root' }); mount(el, root);
  const ctx = { root, client, session, selection, defaultDate: TODAY, today: TODAY, get data() { return st.data; }, get machineId() { return st.machine; }, selectedSlice: null,
    toast(msg, bad) { const t = h('div', { class: `banner ${bad ? 'error' : 'info'} toast`, 'data-testid': 'toast', role: 'status' }, msg); root.appendChild(t); setTimeout(() => t.remove(), 4500); },
    fail(e) { ctx.toast(errText(e), true); }, reload, rerender: () => paint() };
  async function reload() {
    st.loading = !st.data; if (st.loading) paint();
    try {
      st.data = await loadPlan(client, session); st.error = null;
      if (!st.machine || !st.data.machines.some((m) => m.id === st.machine)) st.machine = st.data.machines[0]?.id ?? null;
      st.done = await client.select('production_plan_slices', { columns: 'id,work_order_id,operation_id,machine_id,planned_qty,planned_date,shift_code,actual_good,actual_scrap,actual_tashih,actual_released,closed_at', filters: { status: 'eq.DONE' }, order: 'closed_at.desc', limit: 50 }, session).catch(() => []);
      selection.clear(); await loadCaps();
    } catch (e) { st.error = e; }
    st.loading = false; paint();
  }
  const range = () => (st.view === 'day' ? [st.anchor] : Array.from({ length: 7 }, (_, i) => addDays(weekStart(st.anchor), i)));
  async function loadCaps() {
    const days = range(); st.caps = {};
    await Promise.all(st.data.machines.map(async (m) => { try { st.caps[m.id] = await st.data.api.capacity(m.id, days[0], days[days.length - 1]); } catch { st.caps[m.id] = null; } }));
  }
  const slicesIn = (mid, date, shift) => queueOf(st.data, mid).filter((s) => s.plannedDate === date && (!shift || s.shiftCode === shift));
  const matches = (s) => st.filter === 'ALL' || (st.filter === 'WARN' ? (s.warnings ?? []).length > 0 : st.filter === 'STARTED' ? s.status === 'STARTED' : true);
  function cell(m, date, shift) {
    const sl = slicesIn(m.id, date, shift).filter(matches); const cap = (st.caps[m.id] ?? []).filter((c) => c.plannedDate === date && (!shift || c.shiftCode === shift));
    const capMin = cap.reduce((a, c) => a + (c.capacityMin ?? 0), 0); const known = cap.length > 0 && cap.every((c) => c.loadKnown !== false); const load = cap.reduce((a, c) => a + Number(c.loadMin ?? 0), 0); const over = cap.some((c) => c.overloaded);
    return h('td', { class: `cell ${date === TODAY ? 'today' : ''} ${st.machine === m.id ? 'sel' : ''}`, 'data-testid': `cell-${m.code}-${date}${shift ? '-' + shift : ''}`, onClick: () => { st.machine = m.id; paint(); } },
      ...sl.map((s) => h('button', { class: `chip ${s.status} ${(s.warnings ?? []).length ? 'warn' : ''} ${ctx.selectedSlice === s.sliceId ? 'sel' : ''}`, 'data-testid': `chip-${s.sliceId}`, title: s.status === 'STARTED' ? 'Üretimde' : 'Planlandı',
        onClick: (e) => { e.stopPropagation(); st.machine = m.id; ctx.selectedSlice = s.sliceId; paint(); } }, `${st.data.woInfo[s.workOrderId]?.label?.split(' · ')[0] ?? ''} ${s.opCode} · ${fmtQty(s.plannedQty)}${shift ? '' : ' ' + (SHIFT_SHORT[s.shiftCode] ?? '')}`)),
      cap.length ? h('div', { class: `load ${over ? 'over' : ''}`, 'data-testid': `load-${m.code}-${date}${shift ? '-' + shift : ''}` }, sl.length || load ? (known ? `${fmtMin(load)} / ${capMin} dk${over ? ' ▲ AŞIM' : ''}` : `yük bilinmiyor / ${capMin} dk`) : `boş · ${capMin} dk`) : null);
  }
  function calendar() {
    const days = range(); const cols = st.view === 'day' ? ['TeamK1', 'TeamK2'] : days; const heads = st.view === 'day' ? cols.map((c) => SHIFT_TR[c]) : days.map(dayLabel);
    return h('div', { class: 'cal', 'data-testid': 'calendar', 'data-view': st.view }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Makine'), ...heads.map((t, i) => h('th', { 'data-testid': `col-${i}`, class: st.view === 'week' && days[i] === TODAY ? 'today' : '' }, t)))),
      h('tbody', {}, ...st.data.machines.filter((m) => !q.get('only') || m.id === q.get('only')).map((m) => h('tr', { 'data-testid': `mrow-${m.code}` }, h('td', { class: 'mname' }, h('a', { href: `#/makine-detay?m=${m.id}&d=${st.anchor}`, 'data-testid': `mlink-${m.code}` }, m.code), h('small', {}, m.name ?? ''), m.status !== 'UP' ? pill(m.status, 'warn') : null),
        ...(st.view === 'day' ? cols.map((c) => cell(m, st.anchor, c)) : days.map((d) => cell(m, d, null)))))))); }
  function machineSummary() {
    const d = st.data;
    return h('div', { class: 'panel', 'data-testid': 'machine-summary' }, h('h2', {}, 'Makineler — şu an · bugün · ileri tarih'), h('div', { class: 'msum' }, ...d.machines.map((m) => {
      const qs = queueOf(d, m.id); const run = qs.filter((s) => s.status === 'STARTED'); const td = qs.filter((s) => s.status === 'PLANNED' && s.plannedDate <= TODAY); const fu = qs.filter((s) => s.status === 'PLANNED' && s.plannedDate > TODAY);
      const sum = (a) => a.reduce((x, y) => x + Number(y.plannedQty), 0);
      const un = d.ops.filter((o) => (o.plannedMachineId ?? o.allowedMachineIds?.[0]) === m.id).reduce((x, o) => x + (d.summaries[o.id]?.unplannedQty ?? 0), 0);
      const over = qs.some((s) => (s.warnings ?? []).includes('OVER_CAPACITY')); const late = [...new Set(qs.map((s) => s.workOrderId))].map((id) => ({ id, r: d.delivery?.[id] })).filter((x) => x.r && x.r.daysLate > 0);
      const risks = [over ? 'kapasite aşımı' : null, ...late.map((x) => `termin riski (${d.woInfo[x.id]?.label}: ${x.r.daysLate} gün geç)`), un > 0 ? 'planlanmamış miktar var' : null].filter(Boolean);
      return h('div', { class: `mcard ${st.machine === m.id ? 'sel' : ''}`, 'data-testid': `msum-${m.code}`, onClick: () => { st.machine = m.id; paint(); } }, h('b', {}, `${m.code}${m.name ? ' · ' + m.name : ''}`),
        h('div', { 'data-testid': `msum-run-${m.code}` }, run.length ? `Şu an: ${run.map((s) => `${d.woInfo[s.workOrderId]?.label?.split(' · ')[0]} ${s.opCode} (${fmtQty(s.plannedQty)})`).join(', ')}` : 'Şu an: üretimde iş yok'),
        h('div', { 'data-testid': `msum-today-${m.code}` }, `Bugün sırada: ${td.length} iş${td.length ? ` · ${fmtQty(sum(td))} adet` : ''}`), h('div', { 'data-testid': `msum-future-${m.code}` }, `İleri tarihli: ${fu.length} dilim${fu.length ? ` · ${fmtQty(sum(fu))} adet` : ''}`),
        h('div', { 'data-testid': `msum-unplanned-${m.code}` }, `Planlanmamış: ${fmtQty(un)} adet`), h('div', { 'data-testid': `msum-risk-${m.code}` }, risks.length ? pill(risks.join(' · '), 'warn') : pill('risk görünmüyor', 'ok'))); })));
  }
  function unplannedPanel() {
    const rows = st.data.ops.filter((o) => (st.data.summaries[o.id]?.unplannedQty ?? 0) > 0);
    return h('div', { class: 'panel', 'data-testid': 'unplanned' }, h('h2', {}, 'Planlanmamış miktar'),
      rows.length === 0 ? h('div', { class: 'empty', 'data-testid': 'unplanned-empty' }, 'Tüm hedef miktarlar planlandı.') : h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...['İş emri', 'Operasyon', 'Hedef', 'Üretilen sağlam', 'Açık planlı', 'Planlanmamış', 'İşlem'].map((t, i) => h('th', { class: i >= 2 && i <= 5 ? 'num' : '' }, t)))),
        h('tbody', {}, ...rows.map((o) => { const s = st.data.summaries[o.id]; const lab = st.data.woInfo[o.workOrderId]?.label;
          return h('tr', { 'data-testid': `un-${o.id}` }, h('td', {}, lab), h('td', {}, st.data.opLabel(o), h('div', { class: 'mut' }, OP_STATUS_TR[o.status] ?? o.status)), h('td', { class: 'num' }, fmtQty(s.targetQty)), h('td', { class: 'num' }, fmtQty(s.producedGood)), h('td', { class: 'num' }, fmtQty(s.openPlannedQty)),
            h('td', { class: 'num', 'data-testid': `un-qty-${o.id}` }, h('b', {}, fmtQty(s.unplannedQty))),
            h('td', {}, st.data.canPlan ? h('div', { class: 'actions' }, h('button', { 'data-testid': `un-add-${o.id}`, onClick: () => dlgCreate(ctx, o) }, 'Dilim ekle'), h('button', { 'data-testid': `un-multi-${o.id}`, onClick: () => dlgMulti(ctx, o) }, 'Çoklu bölme planı'),
              s.doneSlices > 0 ? h('button', { 'data-testid': `un-comp-${o.id}`, onClick: () => dlgCreate(ctx, o, { title: `Telafi dilimi — ${lab} · ${st.data.opLabel(o)}` }) }, 'Telafi planla') : null) : h('span', { class: 'mut' }, 'Salt okunur'))); }))));
  }
  function donePanel() {
    return h('div', { class: 'panel', 'data-testid': 'done-slices' }, h('h2', {}, 'Kapanan dilimler (planlanan ↔ gerçekleşen)'),
      st.done.length === 0 ? h('div', { class: 'empty', 'data-testid': 'done-empty' }, 'Henüz kapanan dilim yok.') : h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...['İş emri', 'Makine', 'Tarih', 'Planlanan', 'Sağlam', 'Hurda', 'Tahsis', 'Kalitece serbest', 'Eksik sağlam'].map((t, i) => h('th', { class: i >= 3 ? 'num' : '' }, t)))),
        h('tbody', {}, ...st.done.map((d) => { const miss = Number(d.plannedQty) - Number(d.actualGood ?? 0);
          return h('tr', { 'data-testid': `done-${d.id}` }, h('td', {}, st.data.woInfo[d.workOrderId]?.label ?? d.workOrderId.slice(0, 8)), h('td', {}, machineName(st.data, d.machineId)), h('td', {}, dayLabel(d.plannedDate) + ' · ' + SHIFT_SHORT[d.shiftCode]), h('td', { class: 'num' }, fmtQty(d.plannedQty)), h('td', { class: 'num' }, fmtQty(d.actualGood)),
            h('td', { class: 'num' }, fmtQty(d.actualScrap)), h('td', { class: 'num' }, fmtQty(d.actualTashih)), h('td', { class: 'num' }, fmtQty(d.actualReleased)), h('td', { class: 'num', 'data-testid': `done-miss-${d.id}` }, miss > 0 ? h('b', { class: 'reason' }, fmtQty(miss)) : '0')); }))));
  }
  function paint() {
    const d = st.data; const head = h('div', { class: 'head' }, h('h1', { 'data-testid': 'pc-title' }, 'Planlama Merkezi'), h('span', { class: 'grow' }));
    const conn = st.error?.missing ? pill('Planlama altyapısı kurulu değil', 'warn', 'conn-status') : st.error ? pill('Veritabanı bağlantısı: HATA', 'bad', 'conn-status') : st.loading ? pill('Yükleniyor…', 'unknown', 'conn-status') : pill('Veritabanı bağlı · canlı veri', 'ok', 'conn-status');
    const auth = d ? pill(d.canPlan ? 'Plan değiştirme yetkisi VAR' : 'Salt okunur (plan yetkisi yok)', d.canPlan ? 'info' : 'unknown', 'auth-pill') : null;
    const kids = [h('style', {}, DS_CSS + PLAN_CSS), head];
    head.append(conn, auth);
    if (st.error?.missing) { kids.push(stateBox('unknown', 'Planlama altyapısı bu veritabanında kurulu değil', 'Dilim planlama (m0155/m0156) kurulduktan sonra bu ekran çalışır. Mevcut kayıtlarınız etkilenmedi.', 'pc-backend-missing'), h('button', { 'data-testid': 'btn-retry', onClick: () => reload() }, 'Tekrar kontrol et')); }
    else if (st.error) { kids.push(stateBox('error', 'Plan verisi okunamadı', errText(st.error), 'pc-error'), h('button', { 'data-testid': 'btn-retry', class: 'primary', onClick: () => reload() }, 'Tekrar dene')); }
    else if (st.loading || !d) kids.push(stateBox('loading', 'Plan yükleniyor…', '', 'pc-loading'));
    else {
      const all = allSlicesOf(d); const un = d.ops.reduce((a, o) => a + (d.summaries[o.id]?.unplannedQty ?? 0), 0);
      const nav = h('div', { class: 'tb', 'data-testid': 'pc-toolbar' },
        h('div', { class: 'seg' }, h('button', { 'data-testid': 'view-day', class: st.view === 'day' ? 'on' : '', onClick: () => { st.view = 'day'; loadCaps().then(paint); } }, 'Günlük'), h('button', { 'data-testid': 'view-week', class: st.view === 'week' ? 'on' : '', onClick: () => { st.view = 'week'; loadCaps().then(paint); } }, 'Haftalık')),
        h('button', { 'data-testid': 'nav-prev', onClick: () => { st.anchor = addDays(st.anchor, st.view === 'day' ? -1 : -7); loadCaps().then(paint); } }, '◀'),
        h('input', { type: 'date', 'data-testid': 'anchor', value: st.anchor, onChange: (e) => { if (e.target.value) { st.anchor = e.target.value; loadCaps().then(paint); } } }),
        h('button', { 'data-testid': 'nav-next', onClick: () => { st.anchor = addDays(st.anchor, st.view === 'day' ? 1 : 7); loadCaps().then(paint); } }, '▶'),
        h('button', { 'data-testid': 'nav-today', onClick: () => { st.anchor = TODAY; loadCaps().then(paint); } }, 'Bugün'),
        h('select', { 'data-testid': 'filter', onChange: (e) => { st.filter = e.target.value; paint(); } }, ...[['ALL', 'Tüm dilimler'], ['WARN', 'Yalnız uyarılı'], ['STARTED', 'Yalnız üretimde']].map(([v, l]) => h('option', { value: v, ...(st.filter === v ? { selected: 'selected' } : {}) }, l))),
        h('button', { 'data-testid': 'btn-refresh', onClick: () => reload() }, 'Yenile'), h('span', { class: 'mut', 'data-testid': 'range-label' }, st.view === 'day' ? dayLabel(st.anchor) : `${dayLabel(range()[0])} – ${dayLabel(range()[6])}`));
      kids.push(h('div', { class: 'kpis', 'data-testid': 'pc-kpis' }, kpi('Makine', String(d.machines.length), 'kpi-machines'), kpi('Planlı dilim', String(all.filter((s) => s.status === 'PLANNED').length), 'kpi-planned'), kpi('Üretimde', String(all.filter((s) => s.status === 'STARTED').length), 'kpi-started'),
        kpi('Planlanmamış adet', fmtQty(un), 'kpi-unplanned'), kpi('Uyarılı dilim', String(all.filter((s) => (s.warnings ?? []).length).length), 'kpi-warn')), nav);
      if (!d.machines.length) kids.push(stateBox('unknown', 'Planlanacak makine yok', 'Rotada makinesi tanımlı açık operasyon bulunamadı.', 'pc-empty'));
      else {
        kids.push(machineSummary());
        kids.push(h('div', { class: 'panel' }, h('h2', {}, st.view === 'day' ? 'Günlük iş takvimi (makine × vardiya)' : 'Haftalık iş takvimi (makine × gün)'), calendar()));
        const m = d.machines.find((x) => x.id === st.machine);
        kids.push(h('div', { class: 'panel', 'data-testid': 'machine-queue-panel' }, h('div', { class: 'head' }, h('h2', { style: 'margin:0' }, 'Makine kuyruğu'),
          h('select', { 'data-testid': 'machine-select', onChange: (e) => { st.machine = e.target.value; selection.clear(); paint(); } }, ...d.machines.map((x) => h('option', { value: x.id, ...(x.id === st.machine ? { selected: 'selected' } : {}) }, machineName(d, x.id)))),
          m ? h('a', { href: `#/makine-detay?m=${m.id}&d=${st.anchor}`, class: 'btn', 'data-testid': 'to-detail' }, 'Makine detayı →') : null), m ? renderQueue(ctx, m.id) : null));
        kids.push(unplannedPanel(), donePanel());
      }
      kids.push(h('div', { class: 'stamp', 'data-testid': 'provenance' }, `Kaynak: machine_slice_queue · op_plan_summary · plan_capacity_load · veri anı ${d.loadedAt.slice(11, 19)} UTC · yetki sunucuda denetlenir, her değişiklik gerekçeli ve audit kayıtlıdır.`));
    }
    root.replaceChildren(...kids);
  }
  paint(); await reload();
}
