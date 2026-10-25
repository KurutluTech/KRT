// Makine Detayı (/makine-detay?m=<id>) — ANA OPERASYON ile PLANLAMA DİLİMİ ayrı bloklarda. Dilim kapanmışken operasyon sürebilir; bu hata değildir.
// CNC canlı verisi ile operatör üretim beyanı AYRI kutularda.
import { h, mount } from '../../../../../packages/ui/src/h.js';
import { DS_CSS, pill, kpi, stateBox } from '../../ds.js';
import { PLAN_CSS } from './planCss.js';
import { loadPlan } from './planData.js';
import { SHIFT_NAME, OP_STATUS_TR, STATUS_TR, errText, addDays, weekStart, dayLabel, dayLong, fmtQty, fmtMin } from './planText.js';
import { renderQueue, queueOf, dlgClose } from './PlanQueue.js';

export async function renderMachineDetail(el, deps) {
  const { client, session } = deps; const q = deps.query ?? new URLSearchParams(); const mid = q.get('m'); const TODAY = q.get('t') || deps.today; const anchor = q.get('d') || TODAY;
  const root = h('div', { class: 'kd plan', 'data-testid': 'md-root' }, h('style', {}, DS_CSS + PLAN_CSS)); mount(el, root);
  const st = { data: null, error: null, done: [], live: null, cap: [] }; const selection = new Set();
  const ctx = { root, client, session, selection, defaultDate: TODAY, today: TODAY, get data() { return st.data; }, machineId: mid, selectedSlice: null, toast(m, bad) { const t = h('div', { class: `banner ${bad ? 'error' : 'info'} toast`, 'data-testid': 'toast' }, m); root.appendChild(t); setTimeout(() => t.remove(), 4500); }, fail(e) { ctx.toast(errText(e), true); }, reload, rerender: paint };
  async function reload() {
    try { st.data = await loadPlan(client, session); st.error = null;
      st.done = await client.select('production_plan_slices', { columns: 'id,work_order_id,operation_id,machine_id,planned_qty,planned_date,shift_code,actual_good,actual_scrap,actual_tashih,actual_released,closed_at', filters: { machine_id: `eq.${mid}`, status: 'eq.DONE' }, order: 'closed_at.desc', limit: 30 }, session).catch(() => []);
      st.cap = await st.data.api.capacity(mid, TODAY, TODAY).catch(() => []);
      st.live = deps.cncStates ? await deps.cncStates().catch(() => null) : null;
    } catch (e) { st.error = e; }
    paint();
  }
  const block = (testid, title, ...kids) => h('div', { class: 'panel', 'data-testid': testid }, h('h2', {}, title), ...kids);
  function paint() {
    const kids = [h('style', {}, DS_CSS + PLAN_CSS)]; const d = st.data;
    if (st.error) { kids.push(h('h1', {}, 'Makine Detayı'), st.error.missing ? stateBox('unknown', 'Planlama altyapısı bu veritabanında kurulu değil', 'Dilim planlama (m0155/m0156) kurulduktan sonra çalışır.', 'md-backend-missing') : stateBox('error', 'Makine verisi okunamadı', errText(st.error), 'md-error'), h('button', { 'data-testid': 'btn-retry', onClick: reload }, 'Tekrar dene')); root.replaceChildren(...kids); return; }
    if (!d) { kids.push(stateBox('loading', 'Yükleniyor…', '', 'md-loading')); root.replaceChildren(...kids); return; }
    const m = d.allMachines.find((x) => x.id === mid);
    if (!m) { kids.push(h('h1', {}, 'Makine Detayı'), stateBox('unknown', 'Makine bulunamadı', 'Adresteki makine kimliği geçersiz veya görme yetkiniz yok.', 'md-notfound'), h('a', { href: '#/planlama-merkezi', class: 'btn' }, '← Planlama Merkezi')); root.replaceChildren(...kids); return; }
    const rows = queueOf(d, mid); const cur = rows.find((r) => r.status === 'STARTED'); const planned = rows.filter((r) => r.status === 'PLANNED'); const next = planned[0];
    const wk0 = weekStart(anchor); const days = Array.from({ length: 7 }, (_, i) => addDays(wk0, i)); const todayRows = rows.filter((r) => r.plannedDate <= TODAY && r.status === 'PLANNED'); const weekRows = rows.filter((r) => days.includes(r.plannedDate));
    // Ana operasyon: üretimdeki dilimin operasyonu; yoksa en son kapanan dilimin operasyonu; yoksa sıradaki dilimin operasyonu
    const lastDone = st.done[0]; const opId = cur?.operationId ?? lastDone?.operationId ?? next?.operationId; const op = d.ops.find((o) => o.id === opId); const sum = opId ? d.summaries[opId] : null; const wo = op ? d.woInfo[op.workOrderId] : null;
    kids.push(h('div', { class: 'head' }, h('h1', { 'data-testid': 'md-title' }, `Makine ${m.code}${m.name ? ' · ' + m.name : ''}`), pill(d.canPlan ? 'Plan değiştirme yetkisi VAR' : 'Salt okunur', d.canPlan ? 'info' : 'unknown', 'auth-pill'), h('span', { class: 'grow' }), h('a', { href: '#/planlama-merkezi', class: 'btn', 'data-testid': 'to-center' }, '← Planlama Merkezi')));
    // ---- üç bilgi AYRI: fiziksel makine durumu · üretim oturumu · planlama dilimi durumu ----
    const doneGood = sum?.producedGood ?? 0; const need = sum?.remainingGoodNeed ?? null;
    const PHYS = { UP: ['Çalışır durumda', 'ok'], DOWN: ['Arızalı', 'warn'], MAINT: ['Bakımda', 'warn'], MAINTENANCE: ['Bakımda', 'warn'] };
    const [physTxt, physKind] = PHYS[m.status] ?? [m.status, 'warn'];
    const act = d.ops.find((o) => o.machineId === mid && ['RUNNING', 'FIRST_PIECE_PENDING'].includes(o.status) && !o.batchPaused); const actWo = act ? d.woInfo[act.workOrderId] : null;
    const qtyDone = !!cur && Number(cur.remainingQty) <= 0;   // dilim miktarı tamam ama dilim hâlâ STARTED
    const lab = (o, w) => `${w?.label ?? ''} · ${d.opLabel(o)}`;
    let stateMsg = null, stateKind = 'info';
    if (qtyDone) { stateMsg = 'Planlanan miktar tamamlandı; dilimi kapatınca makine yeni işe hazır olacak.'; stateKind = 'warn'; }
    else if (m.status !== 'UP') { stateMsg = 'Makine şu an üretime uygun değil; yeni iş başlatılamaz.'; stateKind = 'warn'; }
    else if (act && next) stateMsg = 'Makine çalışabilir durumda, ancak şu anda başka operasyon yürütülüyor.';
    else if (act) stateMsg = `Makine çalışabilir durumda; şu anda ${lab(act, actWo)} yürütülüyor.`;
    else stateMsg = 'Makine çalışabilir durumda ve şu an aktif üretim oturumu yok.';
    const row = (k, v, tid) => h('div', { class: 'nrow' }, h('span', { class: 'nk' }, k), h('span', { class: 'nv', ...(tid ? { 'data-testid': tid } : {}) }, v));
    const nowBox = h('div', { class: 'panel big', 'data-testid': 'md-now' }, h('h2', {}, 'ŞU AN'),
      row('Fiziksel makine durumu', pill(physTxt, physKind, 'md-status'), null),
      row('Üretim oturumu', act ? `Aktif iş var — ${lab(act, actWo)}` : 'Aktif iş yok', 'md-session'),
      row('Planlama dilimi', cur ? pill(STATUS_TR[cur.status] ?? cur.status, 'info', 'md-slicestate') : pill('Aktif dilim yok', 'unknown', 'md-slicestate'), null),
      h('div', { class: `banner ${stateKind}`, 'data-testid': 'md-state-msg' }, stateMsg),
      cur ? h('div', {}, row('Aktif operasyon', `${lab(op, wo)} — hedef ${fmtQty(sum?.targetQty)} sağlam`, 'md-now-op'),
        row('Aktif dilim', `${fmtQty(cur.plannedQty)} adet planlı · ${dayLong(cur.plannedDate)} ${SHIFT_NAME[cur.shiftCode]}`, 'md-now-slice'),
        row('Gerçekleşen miktar', `${fmtQty(cur.actualGood)} sağlam · ${fmtQty(cur.actualScrap)} hurda · ${fmtQty(cur.actualTashih)} tahsis`, 'md-now-actual'),
        row('Kapatma gereksinimi', qtyDone ? pill('Dilim miktarı tamamlandı — kapatma bekliyor', 'warn', 'md-close-wait') : `Dilim sürüyor; dilimde kalan ${fmtQty(cur.remainingQty)} adet`, 'md-close-need'),
        qtyDone && d.canPlan ? h('button', { class: 'go', 'data-testid': 'md-close-btn', onClick: () => dlgClose(ctx, cur) }, 'Dilimi kapat') : null)
        : h('div', { class: 'mut', 'data-testid': 'md-now-none' }, op && op.status !== 'DONE' ? `Operasyon sürüyor (${lab(op, wo)}) ama şu an aktif dilim yok.` : 'Aktif operasyon / dilim yok.'));
    const rs = next ? d.reasons[next.sliceId] : null;
    const nextBox = h('div', { class: 'panel big', 'data-testid': 'md-next' }, h('h2', {}, 'SIRADAKİ İŞ'), next ? h('div', {}, h('div', { class: 'bigline' }, `${d.woInfo[next.workOrderId]?.label} · ${next.opCode}`), h('div', { class: 'bigline' }, `${fmtQty(next.plannedQty)} adet`), h('div', { class: 'mut' }, `${dayLong(next.plannedDate)} · ${SHIFT_NAME[next.shiftCode]}`),
      rs?.text ? h('div', { class: 'reason', 'data-testid': 'md-next-wait' }, 'Başlamayı engelleyen neden: ' + rs.text) : rs?.unknown ? h('div', { class: 'mut' }, rs.text) : rs ? h('div', { class: 'okr', 'data-testid': 'md-next-ready' }, 'Başlamaya hazır') : null) : h('div', { class: 'empty', 'data-testid': 'md-next-none' }, 'Sırada bekleyen iş yok.'));
    const capOf = (sh) => st.cap.find((x) => x.shiftCode === sh);
    const todayList = todayRows.length ? h('div', {}, ...todayRows.map((r, i) => h('div', { class: 'item', 'data-testid': `md-t-${r.sliceId}` }, h('b', {}, `${i + 1}) ${d.woInfo[r.workOrderId]?.label?.split(' · ')[0]} · ${r.opCode}`), ` — ${fmtQty(r.plannedQty)} adet — ${SHIFT_NAME[r.shiftCode]}`, h('span', { class: 'mut' }, ` — ${r.estMinutes === null || r.estMinutes === undefined ? 'süre verisi yok' : fmtMin(r.estMinutes)}`))),
      ...['TeamK1', 'TeamK2'].filter((sh) => todayRows.some((r) => r.shiftCode === sh)).map((sh) => { const c = capOf(sh); return h('div', { class: 'mut', 'data-testid': `md-cap-${sh}` }, `${SHIFT_NAME[sh]}: ${c && c.loadKnown !== false && c.loadMin !== null && c.loadMin !== undefined ? `${fmtMin(c.loadMin).replace(' dk', '')}/${c.capacityMin} dakika — ${c.overloaded ? 'kapasite AŞILIYOR' : 'kapasite uygun'}` : 'yük bilinmiyor (süre verisi eksik)'}`); })) : h('div', { class: 'empty', 'data-testid': 'md-today-none' }, 'Bugün için planlı dilim yok. İleri tarihli işler bugünü bloke etmez.');
    kids.push(h('div', { class: 'mdtop' }, nowBox, nextBox, block('md-today', `BUGÜNKÜ PLAN (${dayLong(TODAY)})`, todayList)));
    // ---- alt bölüm: operasyon / dilim ayrımı, haftalık plan, ileri tarih, toplamlar ----
    kids.push(block('md-op', 'Ana operasyon', !op ? h('div', { class: 'empty', 'data-testid': 'md-op-none' }, 'Bu makinede şu an ilgili operasyon yok.') : h('div', {},
      h('div', {}, h('b', { 'data-testid': 'md-op-title' }, `${wo?.label ?? ''} — ${d.opLabel(op)} — ${fmtQty(sum?.targetQty)} adet`), ' ', pill(OP_STATUS_TR[op.status] ?? op.status, op.status === 'DONE' ? 'ok' : 'info', 'md-op-status')),
      op.batchPaused && op.status !== 'DONE' ? h('div', { class: 'mut', 'data-testid': 'md-op-paused' }, 'Operasyon devam ediyor; dilimler arasında bekliyor, makine serbest. (Hata değildir.)') : null,
      h('div', { class: 'qgrid', style: 'margin-top:8px' }, kpi('Hedef (sağlam)', fmtQty(sum?.targetQty), 'md-o-target'), kpi('Üretilen sağlam', fmtQty(sum?.producedGood), 'md-o-done'), kpi('Kalan sağlam ihtiyaç', fmtQty(need), 'md-o-need'), kpi('Açık planlı', fmtQty(sum?.openPlannedQty), 'md-o-planned'), kpi('Planlanmamış', fmtQty(sum?.unplannedQty), 'md-o-unplanned'), kpi('Kapanan hurda', fmtQty(sum?.doneScrap), 'md-o-scrap')))));
    if (cur) kids.push(block('md-slice', 'Aktif planlama dilimi', h('div', {}, h('b', {}, `${fmtQty(cur.plannedQty)} adet planlandı`), h('span', { class: 'mut' }, ` · ${dayLong(cur.plannedDate)} ${SHIFT_NAME[cur.shiftCode]}`)),
      h('div', { class: 'qgrid', style: 'margin-top:8px' }, kpi('Gerçekleşen sağlam', fmtQty(cur.actualGood), 'md-c-good'), kpi('Hurda', fmtQty(cur.actualScrap), 'md-c-scrap'), kpi('Tahsis / tashih', fmtQty(cur.actualTashih), 'md-c-tashih'), kpi('Dilimde kalan', fmtQty(cur.remainingQty), 'md-c-rem'),
        kpi('Kalitece serbest (dilim)', fmtQty(cur.actualReleased), 'md-c-released'), kpi('Kalite bekleyen sağlam', fmtQty(Math.max(0, Number(cur.actualGood ?? 0) - Number(cur.actualReleased ?? 0))), 'md-c-pendingq'), kpi('Sonraki operasyona aktarılabilir', fmtQty(cur.opQtyReleased), 'md-c-transfer'))));
    else if (lastDone && lastDone.operationId === opId) { const l = lastDone; kids.push(block('md-slice', 'Son kapanan planlama dilimi', h('div', { 'data-testid': 'md-slice-closed' }, `${fmtQty(l.plannedQty)} adet planlandı. ${fmtQty(l.actualGood)} sağlam + ${fmtQty(l.actualScrap)} hurda${Number(l.actualTashih) ? ` + ${fmtQty(l.actualTashih)} tahsis` : ''} gerçekleşti. Dilimde kalan: 0.`),
      h('div', { class: 'mut' }, `Kalitece serbest: ${fmtQty(l.actualReleased)} adet — sonraki operasyona en fazla bu kadarı aktarılır. Sağlam hedefindeki eksik: ${fmtQty(Math.max(0, Number(l.plannedQty) - Number(l.actualGood ?? 0)))} adet.`))); }
    else kids.push(block('md-slice', 'Aktif planlama dilimi', h('div', { class: 'empty', 'data-testid': 'md-current-none' }, 'Bu makinede şu an üretimde dilim yok.')));
    if (op) kids.push(block('md-opstate', 'Operasyonun genel durumu', h('div', { 'data-testid': 'md-opstate-text' }, `${fmtQty(sum?.targetQty)} adetlik hedef: ${fmtQty(doneGood)} sağlam üretildi (hurda hedefe sayılmaz). Kalan sağlam ihtiyaç: ${fmtQty(need)} adet — bunun ${fmtQty(sum?.openPlannedQty)} adedi açık planlı${Number(sum?.unplannedQty) > 0 ? `, ${fmtQty(sum.unplannedQty)} adedi henüz planlanmamış (telafi planlanabilir)` : ''}.`),
      Number(sum?.unplannedQty) > 0 && d.canPlan ? h('a', { class: 'btn', href: `#/planlama-merkezi?d=${anchor}`, 'data-testid': 'md-to-plan' }, 'Planlama Merkezi’nde planla') : null));
    const nextOfOp = planned.filter((r) => r.operationId === opId);
    kids.push(block('md-nextplan', 'İleri tarihli planlar (bu operasyon)', nextOfOp.length ? h('div', {}, ...nextOfOp.map((r) => h('div', { class: 'item', 'data-testid': `md-np-${r.sliceId}` }, `${fmtQty(r.plannedQty)} adet — ${dayLong(r.plannedDate)} · ${SHIFT_NAME[r.shiftCode]}`, d.reasons[r.sliceId]?.text ? h('span', { class: 'reason' }, ` — bekleme: ${d.reasons[r.sliceId].text}`) : null))) : h('div', { class: 'empty', 'data-testid': 'md-np-none' }, 'Bu operasyon için ileri tarihli dilim yok.')));
    kids.push(block('md-queue', 'Kuyruk ve dilimler', renderQueue(ctx, mid)));
    kids.push(block('md-week', 'Haftalık plan', h('div', { class: 'scroll' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ...days.map((x) => h('th', {}, dayLabel(x))))), h('tbody', {}, h('tr', {}, ...days.map((x) => h('td', { 'data-testid': `md-day-${x}` }, ...rows.filter((r) => r.plannedDate === x).map((r) => h('div', { class: 'chip' }, `${d.woInfo[r.workOrderId]?.label?.split(' · ')[0]} ${r.opCode} · ${fmtQty(r.plannedQty)} ${r.shiftCode === 'TeamK1' ? 'V1' : 'V2'}`))))))))));
    kids.push(block('md-history', 'Kapanan dilimler', st.done.length === 0 ? h('div', { class: 'empty' }, 'Kapanan dilim yok.') : h('div', {}, ...st.done.map((s) => h('div', { class: 'item', 'data-testid': `md-done-${s.id}` }, `${d.woInfo[s.workOrderId]?.label} · planlanan ${fmtQty(s.plannedQty)} → sağlam ${fmtQty(s.actualGood)} / hurda ${fmtQty(s.actualScrap)} / tahsis ${fmtQty(s.actualTashih)} · kalitece serbest ${fmtQty(s.actualReleased)}`)))));
    const live = st.live instanceof Map ? st.live.get(m.code) : null;
    kids.push(h('div', { style: 'display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' },
      h('div', { class: 'srcbox', 'data-testid': 'md-cnc' }, h('h2', {}, 'CNC canlı verisi (makineden)'), live ? h('div', {}, pill(String(live.state ?? live), 'info'), h('div', { class: 'mut' }, 'Kaynak: makine bağlantısı')) : h('div', { class: 'empty', 'data-testid': 'md-cnc-none' }, 'Canlı makine verisi bağlı değil / okunamadı. (Üretim adedi olarak kullanılmaz.)')),
      h('div', { class: 'srcbox', 'data-testid': 'md-declared' }, h('h2', {}, 'Operatör üretim beyanı'), cur ? h('div', {}, `Dilim başlangıcından beri beyan: ${fmtQty(cur.actualGood)} sağlam · ${fmtQty(cur.actualScrap)} hurda · ${fmtQty(cur.actualTashih)} tahsis`, h('div', { class: 'mut' }, 'Kaynak: operasyon sayaçları (operatör beyanı; kalite onayı ayrı)')) : h('div', { class: 'empty' }, 'Aktif beyan yok.'))));
    kids.push(h('div', { class: 'stamp', 'data-testid': 'provenance' }, `Kaynak: machine_slice_queue · production_plan_slices · veri anı ${d.loadedAt.slice(11, 19)} UTC`));
    root.replaceChildren(...kids);
  }
  paint(); await reload();
}
