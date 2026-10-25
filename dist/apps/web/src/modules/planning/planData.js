// Planlama Merkezi — veri yükleyici. Tüm okumalar sunucu RPC/RLS'ten; hiçbir değer tarayıcıda uydurulmaz.
import { createPlanSliceApi } from './planSliceApi.js';
import { waitText, isBackendMissing } from './planText.js';
const safe = async (p, fallback) => { try { return await p; } catch { return fallback; } };
export async function loadPlan(client, session, { from, to } = {}) {
  const api = createPlanSliceApi(client, session);
  const sel = (t, o) => client.select(t, o, session);
  // 1) çekirdek okumalar: biri bile düşerse ekran hata durumuna geçer (sessiz boş görünüm yok)
  let core;
  try { core = await Promise.all([
    sel('machines', { columns: 'id,code,name,status', order: 'code.asc' }),
    sel('work_order_operations', { columns: 'id,work_order_id,op_no,op_kind,name,status,allowed_machine_ids,planned_machine_id,machine_id,qty_in,qty_good,qty_scrap,qty_tashih,qty_released,setup_minutes_target,cycle_seconds_target,batch_paused,required_skill_code', filters: { status: 'neq.DONE' }, order: 'work_order_id.asc,op_no.asc' }),
    api.canPlan ? api.canPlan() : client.rpc('queue_can_reorder', {}, session),
  ]); } catch (e) { if (isBackendMissing(e)) { const m = new Error('PLAN_BACKEND_MISSING'); m.missing = true; throw m; } throw e; }
  const [machines, ops, canPlan] = core;
  const opMachineIds = new Set(ops.flatMap((o) => [...(o.allowedMachineIds ?? []), o.plannedMachineId].filter(Boolean)));
  const usedMachines = machines.filter((m) => opMachineIds.has(m.id));
  let queues; try { queues = Object.fromEntries(await Promise.all(usedMachines.map(async (m) => [m.id, await api.machineQueue(m.id)]))); } catch (e) { if (isBackendMissing(e)) { const m = new Error('PLAN_BACKEND_MISSING'); m.missing = true; throw m; } throw e; }
  // 2) bağlam (etiketler): düşerse kısa kimliğe geri döner, ekran bozulmaz
  const woIds = [...new Set(ops.map((o) => o.workOrderId))];
  const [wos, items, orders, products] = await Promise.all([
    safe(sel('work_orders', { columns: 'id,order_item_id,qty_planned,status' }), []), canPlan ? safe(sel('order_items', { columns: 'id,order_id,product_id,due_date,qty' }), []) : [],
    canPlan ? safe(sel('orders', { columns: 'id,customer_po' }), []) : [], safe(sel('products', { columns: 'id,code' }), []),
  ]);
  const itemBy = Object.fromEntries(items.map((i) => [i.id, i])), orderBy = Object.fromEntries(orders.map((o) => [o.id, o])), prodBy = Object.fromEntries(products.map((p) => [p.id, p]));
  const woInfo = {};
  for (const id of woIds) { const w = wos.find((x) => x.id === id); const it = w && itemBy[w.orderItemId]; woInfo[id] = { id, qty: w?.qtyPlanned ?? null, status: w?.status ?? null, dueDate: it?.dueDate ?? null,
    po: it && orderBy[it.orderId]?.customerPo || null, product: it && prodBy[it.productId]?.code || null }; woInfo[id].label = [woInfo[id].po, woInfo[id].product].filter(Boolean).join(' · ') || id.slice(0, 8); }
  // 3) operasyon planlama özeti + bekleme nedenleri
  const summaries = Object.fromEntries(await Promise.all(ops.map(async (o) => [o.id, (await safe(api.opSummary(o.id), []))[0] ?? null])));
  const reasons = {};
  await Promise.all(Object.entries(queues).flatMap(([mid, rows]) => rows.filter((r) => r.status === 'PLANNED').map(async (r) => {
    const code = await safe(client.rpc('plan_slice_readiness', { p_slice: r.sliceId }, session), undefined);
    reasons[r.sliceId] = code === undefined ? { unknown: true, text: 'Hazırlık durumu okunamadı' } : { code, text: waitText(code) };
  })));
  const delivery = {};
  if (canPlan) await Promise.all(woIds.map(async (id) => { delivery[id] = (await safe(api.deliveryImpact(id), []))[0] ?? null; }));
  const opLabel = (o) => (o.opKind === 'CUT_PREP' ? 'CUT/PREP' : `OP${o.opNo}`);
  return { api, machines: usedMachines, allMachines: machines, ops, queues, canPlan: !!canPlan, woInfo, summaries, reasons, delivery, opLabel, loadedAt: new Date().toISOString() };
}
export const machineName = (data, id) => { const m = data.allMachines.find((x) => x.id === id); return m ? `${m.code}${m.name ? ' · ' + m.name : ''}` : id?.slice(0, 8) ?? '—'; };
export const allSlicesOf = (data) => Object.values(data.queues).flat();
// Eksik sağlam ihtiyacı: hedef − (kapanmış dilimlerdeki sağlam + açık planlanan) = op_plan_summary.unplanned_qty
export const missingGood = (data, opId) => data.summaries[opId]?.unplannedQty ?? null;
