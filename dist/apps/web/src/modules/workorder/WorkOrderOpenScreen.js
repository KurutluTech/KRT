// İş Emri Aç (/is-emri-ac?item=<sipariş kalemi>) — ön kontrol + AYRI kapılar: (1) yeni ana iş emri  (2) mevcut iş emrine rota uygula  (3) START (burada YOK).
// Mevcut iş emri varsa "Mevcut iş emrine devam et" sunulur; ikinci ana iş emri açılmaz. Operatör ataması operasyon düzeyindedir ve yetkili yöneticinin açık onayını ister.
import { h, mount } from '../../../../../packages/ui/src/h.js';
import { DS_CSS, pill, stateBox } from '../../ds.js';
import { buildPrecheck, operatorCandidates, opLabel, ACTIVE_WO, STATUS_LABEL } from './precheckModel.js';

const KIND = { OK: 'ok', MISSING: 'warn', WARN: 'warn', BLOCKED: 'bad', UNKNOWN: 'unknown' };
const WO_TR = { PLANNED: 'Planlandı', MACHINE_ASSIGNED: 'Makine atandı', ON_HOLD: 'BEKLETMEDE', IN_PROGRESS: 'Üretimde', FIRST_PIECE_PENDING: 'İlk parça bekliyor', FIRST_PIECE_APPROVED: 'İlk parça onaylı', PRODUCTION_DONE: 'Üretim bitti', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal' };
const CSS = `.woa .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.woa table{width:100%;border-collapse:collapse}.woa td,.woa th{padding:6px 8px;border-bottom:1px solid #243049;text-align:left;vertical-align:top;font-size:13px}.woa .own{color:#94a3b8;font-size:12px}.woa .btn{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid #3b82f6;background:#1d4ed8;color:#fff;cursor:pointer}.woa .btn[disabled]{opacity:.45;cursor:not-allowed;background:#334155;border-color:#475569}.woa .gate{border:1px solid #243049;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}.woa input,.woa select{min-height:40px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px}`;
const errText = (e) => { const m = `${e?.message ?? e ?? ''}`; const map = [[/EXCEEDS_OPEN_PRODUCTION_NEED/, 'Açık üretim ihtiyacını aşıyor — ikinci/ek iş emri açılamaz.'], [/FORBIDDEN/, 'Bu işlem için yetkiniz yok.'], [/ROUTING_INCOMPLETE[^]*OP(\d+)_beklenen_OP10/, 'Rota geçersiz: ilk operasyon OP10 olmalı (CUT/PREP varsa ondan sonra).'], [/ROUTING_DIVERGED/, 'İş emrindeki operasyonlar güncel rotadan farklı; otomatik değiştirilmedi.'], [/REVISION_NOT_RELEASED/, 'Revizyon yayınlanmış değil.'], [/WORK_ORDER_NOT_ELIGIBLE_FOR_ROUTING/, 'İş emri bu durumda rota almaz.'], [/REASON_REQUIRED/, 'Gerekçe (en az 3 karakter) zorunlu.']]; for (const [re, t] of map) if (re.test(m)) return t; return `İşlem başarısız: ${m.slice(0, 160)}`; };

export async function renderWorkOrderOpen(el, deps) {
  const { client, session } = deps; const q = deps.query ?? new URLSearchParams(); const itemId = q.get('item');
  const root = h('div', { class: 'kd woa', 'data-testid': 'woa-root' }, h('style', {}, DS_CSS + CSS)); mount(el, root);
  const st = { data: null, error: null, banner: null, busy: false };
  const sel = (t, o) => client.select(t, o, session); const safe = async (p, f) => { try { return await p; } catch { return f; } };
  async function load() {
    try {
      if (!itemId) {
        const [items, orders, products, wos] = await Promise.all([sel('order_items', { columns: 'id,order_id,product_id,qty,qty_produced,due_date' }), safe(sel('orders', { columns: 'id,customer_po,status' }), []), safe(sel('products', { columns: 'id,code,name' }), []), safe(sel('work_orders', { columns: 'id,order_item_id,status' }), [])]);
        st.data = { list: items.map((it) => ({ ...it, po: orders.find((o) => o.id === it.orderId)?.customerPo ?? null, orderStatus: orders.find((o) => o.id === it.orderId)?.status ?? null, product: products.find((p) => p.id === it.productId)?.code ?? null, wo: wos.filter((w) => w.orderItemId === it.id && ACTIVE_WO(w.status))[0] ?? null })).filter((r) => r.orderStatus == null || r.orderStatus === 'CONFIRMED' || r.orderStatus === 'IN_PRODUCTION') }; st.error = null; paint(); return;
      }
      const item = (await sel('order_items', { columns: 'id,order_id,product_id,qty,qty_produced,due_date', filters: { id: `eq.${itemId}` } }))[0]; if (!item) throw new Error('KALEM_YOK');
      const [product, wos, revs, canCreate, canAssign] = await Promise.all([safe(sel('products', { columns: 'id,code,name', filters: { id: `eq.${item.productId}` } }), []), sel('work_orders', { columns: 'id,order_item_id,status,qty_planned,qty_produced,qty_scrap,product_revision_id,is_pilot', filters: { order_item_id: `eq.${itemId}` } }),
        safe(sel('product_revisions', { columns: 'id,revision,status,product_id', filters: { product_id: `eq.${item.productId}` }, order: 'created_at.desc' }), []), Promise.resolve((deps.access?.actions ?? []).includes('WORK_ORDER_CREATE')), Promise.resolve((deps.access?.actions ?? []).includes('WORK_ORDER_ASSIGN_MACHINE'))]);
      const wo = wos.find((w) => ACTIVE_WO(w.status)) ?? null; const revision = revs.find((r) => r.id === wo?.productRevisionId) ?? revs.find((r) => r.status === 'RELEASED') ?? revs[0] ?? null; const rid = revision?.id;
      const byRev = (t, c, extra = {}) => (rid ? safe(sel(t, { columns: c, filters: { product_revision_id: `eq.${rid}` }, ...extra }), []) : Promise.resolve([]));
      const [routing, cam, woOps, machines, people, cnc, routeBlockers, readiness, audit, bomLines] = await Promise.all([
        byRev('routing_operations', 'id,op_no,op_kind,name,allowed_machine_ids,primary_machine_id,first_piece_required,qc_required,active', { order: 'op_no.asc' }), byRev('cam_programs', 'id,routing_operation_id,status'),
        wo ? safe(sel('work_order_operations', { columns: 'id,op_no,op_kind,name,status,planned_machine_id,assigned_operator_id,qty_in,routing_operation_id', filters: { work_order_id: `eq.${wo.id}` }, order: 'op_no.asc' }), []) : [],
        safe(sel('machines', { columns: 'id,code,status' }), []), safe(sel('personnel', { columns: 'id,name,roles,department,shift_code,active' }), []),
        safe(client.rpc('cnc_live_states', {}, session), null), rid ? safe(client.rpc('routing_route_check', { p_revision: rid }, session), null) : [], rid ? safe(client.rpc('routing_readiness_blockers', { p_rev: rid }, session), null) : [],
        wo ? safe(sel('audit_log', { columns: 'at,action,reason,after_state', filters: { entity_id: `eq.${wo.id}`, action: 'eq.WORK_ORDER_STATUS_TRANSITION' }, order: 'at.desc', limit: 1 }), []) : [], rid ? safe(sel('bom_lines', { columns: 'id,material_code,qty_per_unit', filters: { product_revision_id: `eq.${rid}` } }), []) : []]);
      const specs = bomLines.length ? await safe(sel('bom_bar_specs', { columns: 'bom_line_id,dia_mm,bar_length_mm,cut_length_mm,kerf_mm,end_trim_mm', filters: { bom_line_id: `in.(${bomLines.map((b) => b.id).join(',')})` } }), []) : [];
      const cncBy = cnc ? Object.fromEntries(cnc.filter((r) => r.machineCode).map((r) => [r.machineCode, r])) : null;
      const input = { item: { ...item, productCode: product[0]?.code }, wos, revision, bom: bomLines.map((b) => ({ materialCode: b.materialCode, qtyPerUnit: b.qtyPerUnit })), bar: specs[0] ? { diaMm: specs[0].diaMm, barLengthMm: specs[0].barLengthMm, cutLengthMm: specs[0].cutLengthMm, kerfMm: specs[0].kerfMm, endTrimMm: specs[0].endTrimMm } : null,
        routing: routing.map((r) => ({ id: r.id, opNo: r.opNo, opKind: r.opKind, name: r.name, active: r.active, allowedMachineIds: r.allowedMachineIds, primaryMachineId: r.primaryMachineId, firstPieceRequired: r.firstPieceRequired, qcRequired: r.qcRequired })),
        routeBlockers, readinessBlockers: readiness, woOps: woOps.map((o) => ({ id: o.id, opNo: o.opNo, opKind: o.opKind, name: o.name, status: o.status, plannedMachineId: o.plannedMachineId, assignedOperatorId: o.assignedOperatorId })), cam: cam.map((c) => ({ routingOperationId: c.routingOperationId, status: c.status })),
        machines, cnc: cncBy, hold: audit[0] ? { reason: audit[0].reason, at: audit[0].at } : null, canCreate: !!canCreate, canAssign: !!canAssign };
      st.data = { input, pre: buildPrecheck(input), product: product[0] ?? null, candidates: operatorCandidates(people.map((p) => ({ id: p.id, name: p.name, roles: p.roles, department: p.department, shiftCode: p.shiftCode, active: p.active }))), machines }; st.error = null;
    } catch (e) { st.error = e; }
    paint();
  }
  async function run(label, fn) { if (st.busy) return; st.busy = true; try { await fn(); st.banner = { kind: 'ok', text: label }; } catch (e) { st.banner = { kind: 'error', text: errText(e) }; } st.busy = false; await load(); }
  function paint() {
    const kids = [h('style', {}, DS_CSS + CSS), h('h1', { 'data-testid': 'woa-title' }, 'İş Emri Aç')];
    if (st.banner) kids.push(stateBox(st.banner.kind === 'ok' ? 'ok' : 'error', st.banner.text, '', 'woa-banner'));
    if (st.error) { kids.push(stateBox('error', 'Veri okunamadı', String(st.error.message ?? st.error), 'woa-error')); root.replaceChildren(...kids); return; }
    if (!st.data) { kids.push(stateBox('loading', 'Yükleniyor…', '', 'woa-loading')); root.replaceChildren(...kids); return; }
    if (st.data.list) {
      kids.push(h('div', { class: 'own' }, 'Onaylı/üretimdeki siparişlerin kalemleri. Açık iş emri olan kalemde yeni ana iş emri açılmaz; mevcut iş emrine devam edilir.'),
        h('table', { 'data-testid': 'woa-list' }, h('thead', {}, h('tr', {}, ...['Sipariş', 'Ürün', 'Adet', 'Iş emri', ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...st.data.list.map((r) => h('tr', { 'data-item': r.id }, h('td', {}, r.po ?? '—'), h('td', {}, r.product ?? '—'), h('td', {}, `${r.qty}`), h('td', {}, r.wo ? pill(WO_TR[r.wo.status] ?? r.wo.status, r.wo.status === 'ON_HOLD' ? 'warn' : 'info') : pill('Yok', 'unknown')), h('td', {}, h('a', { href: `#/is-emri-ac?item=${r.id}` }, r.wo ? 'Mevcut iş emrine devam et →' : 'Ön kontrol →')))))));
      root.replaceChildren(...kids); return;
    }
    const { input, pre, product, candidates, machines } = st.data; const wo = pre.existing; const mCode = (id) => machines.find((m) => m.id === id)?.code ?? (id ? id.slice(0, 8) : '—');
    kids.push(h('div', { class: 'panel' }, h('b', { 'data-testid': 'woa-item' }, `${product?.code ?? 'Ürün'} · ${input.item.qty} adet (üretilen ${input.item.qtyProduced ?? 0})`), h('div', { class: 'own' }, `Revizyon: ${input.revision ? `Rev ${input.revision.revision} (${input.revision.status})` : 'yok'}`)));
    if (wo) kids.push(h('div', { class: 'panel', 'data-testid': 'woa-existing' }, h('b', {}, 'Mevcut ana iş emri var'), h('div', {}, `${WO_TR[wo.status] ?? wo.status} · ${wo.qtyPlanned} adet planlı`), h('a', { class: 'btn', href: `#/is-emirleri?wo=${wo.id}`, 'data-testid': 'woa-continue', style: 'display:inline-block;text-decoration:none;margin-top:6px' }, 'Mevcut iş emrine devam et →')));
    kids.push(h('div', { class: 'panel' }, h('h2', {}, `Ön kontrol (${pre.summary.ok}/${pre.summary.total} hazır)`), h('table', { 'data-testid': 'woa-checks' }, h('thead', {}, h('tr', {}, ...['Kontrol', 'Durum', 'Ayrıntı', 'Sorumlu rol', 'Tamamlanacak işlem'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...pre.checks.map((c) => h('tr', { 'data-check': c.key, 'data-status': c.status }, h('td', {}, c.title), h('td', {}, pill(STATUS_LABEL[c.status], KIND[c.status])), h('td', {}, c.detail), h('td', {}, c.owner ?? '—'), h('td', {}, c.action ?? '—')))))));
    const g = pre.gates; const gate = (title, testid, g1, label, onClick, extra) => h('div', { class: 'gate', 'data-testid': testid }, h('b', {}, title), h('div', { class: 'own' }, g1.allowed ? 'Kapı açık.' : g1.reason), extra ?? null, h('button', { type: 'button', class: 'btn', disabled: !g1.allowed || st.busy, onClick }, label));
    const qty = h('input', { type: 'number', min: '1', value: String(g.create.maxQty ?? ''), 'data-testid': 'woa-qty', 'aria-label': 'Adet' });
    kids.push(h('div', { class: 'grid' },
      gate('1 · Yeni ana iş emri aç', 'woa-gate-create', g.create, 'Ana iş emri aç', () => run('Ana iş emri açıldı.', () => client.rpc('create_work_order', { p_order_item_id: itemId, p_qty_planned: Number(qty.value) }, session)), g.create.allowed ? qty : null),
      gate('2 · Mevcut iş emrine rotayı uygula', 'woa-gate-route', g.applyRoute, 'Rotayı uygula', () => run('Rota uygulandı (tekrar çağrı değişiklik yapmaz).', () => client.rpc('apply_routing_to_work_order', { p_work_order_id: wo.id }, session)), g.applyRoute.idempotent ? h('div', { class: 'own' }, 'Idempotent: zaten uygulanmış.') : null),
      h('div', { class: 'gate', 'data-testid': 'woa-gate-start' }, h('b', {}, '3 · Üretim START'), h('div', { class: 'own' }, g.start.note), ...(g.start.reasons.length ? [h('ul', {}, ...g.start.reasons.map((r) => h('li', {}, r)))] : []), h('button', { type: 'button', class: 'btn', disabled: true, title: 'START bu ekranda yapılmaz' }, 'START (bu ekranda yok)'))));
    if (pre.applied) {
      const reason = h('input', { type: 'text', placeholder: 'Atama gerekçesi (yönetici onayı)', 'data-testid': 'woa-reason' });
      kids.push(h('div', { class: 'panel' }, h('h2', {}, 'Operasyon planı ve atama (operasyon düzeyinde)'), h('div', { class: 'own' }, 'Aday listesi yalnız gerçek, aktif OPERATOR kayıtlarıdır (test hesapları hariç). Yetkinlik/vardiya verisi olmayan kişi "doğrulanmadı" etiketiyle gelir; seçimi yetkili yönetici onaylar, otomatik atama yoktur.'),
        h('table', { 'data-testid': 'woa-ops' }, h('thead', {}, h('tr', {}, ...['Operasyon', 'Makine', 'Durum', 'Operatör', ''].map((x) => h('th', {}, x)))), h('tbody', {}, ...input.woOps.map((o) => {
          const s = h('select', { 'data-testid': `woa-op-${o.id}`, 'aria-label': 'Operatör' }, h('option', { value: '' }, o.assignedOperatorId ? 'Atamayı koru' : 'Operatör seç'), ...candidates.map((c) => h('option', { value: c.id }, `${c.name}${c.verified ? '' : ' · yetkinlik/vardiya doğrulanmadı'}${c.shiftCode ? ` · ${c.shiftCode}` : ''}`)));
          return h('tr', { 'data-op': o.id }, h('td', {}, opLabel(o)), h('td', {}, mCode(o.plannedMachineId)), h('td', {}, o.status), h('td', {}, o.assignedOperatorId ? (candidates.find((c) => c.id === o.assignedOperatorId)?.name ?? 'atanmış') : 'atanmadı'), h('td', {}, s, ' ', h('button', { type: 'button', class: 'btn', disabled: !input.canAssign || st.busy, onClick: () => { if (!s.value) return; run('Operatör atandı.', () => client.rpc('assign_operation_operator', { p_op: o.id, p_person: s.value, p_reason: reason.value }, session)); } }, 'Ata')));
        }))), h('div', { style: 'margin-top:8px' }, reason)));
    }
    root.replaceChildren(...kids);
  }
  await load();
}
