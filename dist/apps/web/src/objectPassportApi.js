// Universal object passport adapter (KMI-RECOVERY-004). Reads ONLY canonical tables / existing RPCs through RLS; writes ONLY through existing canonical RPCs.
// It creates no table, no cache, no second audit: the timeline is kmi_next.audit_log + the existing per-object event tables.
import { machineStateOf, displayKey } from '../../../packages/domain/src/machineState.js';
import { auditToEvent, formatStamp } from '../../../packages/domain/src/temporal.js';
import { errorText, isSetupPending } from './errorText.js';
import { fetchPilotFlags, pilotText, selReal } from './pilotMark.js';
import { loadMaintenanceTests } from './approvalsInboxApi.js';
import { buildInbox, rpcCall } from '../../../packages/domain/src/approvalsInbox.js';
import { KINDS, canOpenPassport } from './passport/registry.js';
const inList = (ids) => `in.(${ids.join(',')})`;
const uniq = (a) => [...new Set(a.filter((x) => !!x))];
const ts = (iso) => formatStamp(iso);
const lnk = (kind, id, label) => (id ? { kind, id, label: label || id.slice(0, 8) } : null);
const pill = (text, tone = '') => ({ pill: text, tone });
const num = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('tr-TR').format(n));
const MACHINE_STATUS_TR = { UP: ['Kullanıma hazır', 'ok'], DOWN: ['ARIZA / DOWN', 'bad'], MAINTENANCE: ['Bakımda', 'info'], HOLD: ['Bekletmede', 'warn'] };
const TICKET_TR = { OPEN: 'Açık', IN_PROGRESS: 'Müdahale sürüyor', TEST_PENDING: 'Test bekliyor', RETURNED_TO_SERVICE: 'Servise döndü', CLOSED: 'Kapandı' };
const WO_TR = { PLANNED: 'Plana alındı', MACHINE_ASSIGNED: 'Makine atandı', PRODUCTION_DONE: 'Üretim bitti · onay bekliyor', IN_PROGRESS: 'Üretimde', FIRST_PIECE_PENDING: 'İlk parça bekliyor', FIRST_PIECE_APPROVED: 'İlk parça onaylı', COMPLETED: 'Tamamlandı', ON_HOLD: 'Bekletmede', CANCELLED: 'İptal' };
const ACTIVE_WO = ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED'];
const LOC_TR = { CABINET: 'Takım dolabında', MOUNTED: 'Makinede takılı', ISSUED: 'Personele zimmetli', SCRAP: 'Hurda' };
const NOT_FOUND = 'KAYIT_BULUNAMADI';
function denied(e) {
    const x = e;
    return x?.status === 401 || x?.status === 403 || x?.code === '42501' || /FORBIDDEN|NOT_AUTHORIZED|permission denied/i.test(x?.message ?? '');
}
export function createObjectPassportApi(client, session, access, myUserId = session?.user.id ?? null) {
    const sel = (table, columns, filters = {}, order, limit = 200) => client.select(table, { columns, filters, order, limit }, session);
    /** aggregates over a PARENT (order / product / customer) count REAL work orders only; a pilot work order is shown only on its own passport, marked */
    const selR = (table, columns, filters = {}, order, limit = 200) => selReal(client, table, { columns, filters, order, limit }, session);
    const pilotPrefix = async (id) => ((await fetchPilotFlags(client, session, [id])).has(id) ? '[TEST / PİLOT] ' : '');
    const one = async (table, columns, id) => {
        const r = await sel(table, columns, { id: `eq.${id}` }, undefined, 1);
        if (!r[0])
            throw new Error(NOT_FOUND);
        return r[0];
    };
    const guard = async (fn) => {
        try {
            return { sections: await fn() };
        }
        catch (e) {
            if (isSetupPending(e))
                return { pending: errorText(e) };
            if (denied(e))
                return { denied: 'Bu bölümü görme yetkiniz yok (sunucu reddetti).' };
            throw e;
        }
    };
    const names = async (ids, byAuth = true) => {
        if (!ids.length)
            return {};
        try {
            const rows = await sel('personnel', 'id,auth_user_id,name', { [byAuth ? 'auth_user_id' : 'id']: inList(ids) }, undefined, 500);
            return Object.fromEntries(rows.map((r) => [byAuth ? (r.authUserId ?? '') : r.id, r.name]));
        }
        catch {
            return {};
        }
    };
    // First (UI) line of defence: the database is too open for customers/orders/personnel today (docs/PASSPORT_DISCOVERY.md §4), so the passport itself refuses them to roles without business need.
    async function assertOpen(kind, id) {
        let own = false;
        if (KINDS[kind].personal && myUserId)
            own = (await sel('personnel', 'auth_user_id', { id: `eq.${id}` }, undefined, 1).catch(() => []))[0]?.authUserId === myUserId;
        if (!canOpenPassport(kind, access, own))
            throw Object.assign(new Error(`FORBIDDEN: ${kind}_PASSPORT`), { status: 403 });
    }
    // ---------- cards ----------
    async function card(kind, id) {
        await assertOpen(kind, id);
        switch (kind) {
            case 'MACHINE': {
                const m = await one('machines', 'id,code,name,category,status,down_since,total_down_minutes,created_at', id);
                const [wos, tickets] = await Promise.all([
                    sel('work_orders', 'id,status,operator_id', { machine_id: `eq.${id}`, status: inList(ACTIVE_WO) }),
                    sel('maintenance_tickets', 'id', { machine_id: `eq.${id}`, status: 'in.(OPEN,IN_PROGRESS,TEST_PENDING)' }),
                ]);
                // KMI-013: a session with no journal activity for 12 h+ is STALE (never shown as running). Journal missing (0121 not installed) ⇒ nothing is flagged.
                const staleIds = new Set();
                if (wos.length) {
                    try {
                        const evs = await sel('work_order_events', 'work_order_id,at', { work_order_id: inList(wos.map((w) => w.id)) }, 'at.desc', 500);
                        const last = new Map();
                        for (const e of evs)
                            if (!last.has(e.workOrderId))
                                last.set(e.workOrderId, Date.parse(e.at));
                        for (const w of wos) {
                            const l = last.get(w.id);
                            if (l !== undefined && Date.now() - l > 12 * 3600_000)
                                staleIds.add(w.id);
                        }
                    }
                    catch { /* journal not installed yet */ }
                }
                // CNC fact for THIS machine (same read model as KMI LIVE / Home); no permission / not installed / unbound => null => operator-declared model unchanged.
                let cncRow = null;
                try {
                    const rows = await client.rpc('cnc_live_states', {}, session);
                    cncRow = rows.find((r) => r.machineCode === m.code) ?? null;
                }
                catch {
                    cncRow = null;
                }
                const [st, tone] = MACHINE_STATUS_TR[m.status] ?? [m.status, ''];
                return { kind, id, title: `${await pilotPrefix(id)}${m.code} · ${m.name}`, subtitle: m.category ?? 'Kategori belirtilmemiş', status: pill(st, tone), createdAt: m.createdAt, links: [], cncConnected: cncRow !== null, machineHeadline: (() => { const ms = machineStateOf({ status: m.status, active: wos.map((w) => ({ runStatus: w.status, stale: staleIds.has(w.id) })), cnc: cncRow }); return displayKey(ms); })(),
                    kpis: [{ label: 'Aktif iş emri', value: String(wos.length) }, { label: 'Açık bakım/arıza', value: String(tickets.length) }, { label: 'Toplam duruş', value: m.totalDownMinutes === null ? 'BİLİNMİYOR' : `${num(m.totalDownMinutes)} dk` },
                        { label: m.status === 'DOWN' ? 'DOWN başlangıcı' : 'Fiziksel durum', value: m.status === 'DOWN' ? ts(m.downSince) : cncRow ? (cncRow.link === 'UP' ? `CNC: ${{ CNC_ACTIVE: 'ÇALIŞIYOR', CNC_STOPPED: 'DURUYOR', CNC_FEED_HOLD: 'FEED HOLD', CNC_INTERRUPTED: 'KESİNTİ', CNC_ALARM: 'ALARM / ACİL STOP' }[cncRow.state] ?? 'BİLİNMİYOR'}` : 'CNC verisi BAYAT') : 'BİLİNMİYOR (CNC bağlantısı yok)' }] };
            }
            case 'WORK_ORDER': {
                const w = await one('work_orders', 'id,order_item_id,machine_id,operator_id,status,qty_planned,qty_produced,qty_scrap,created_at,updated_at,planned_date,planned_shift_code', id);
                const [item, mach, op] = await Promise.all([
                    sel('order_items', 'id,product_id,order_id,due_date', { id: `eq.${w.orderItemId}` }, undefined, 1),
                    w.machineId ? sel('machines', 'id,code,name', { id: `eq.${w.machineId}` }, undefined, 1) : Promise.resolve([]),
                    w.operatorId ? sel('personnel', 'id,name', { id: `eq.${w.operatorId}` }, undefined, 1) : Promise.resolve([]),
                ]);
                const prod = item[0] ? (await sel('products', 'id,code,name', { id: `eq.${item[0].productId}` }, undefined, 1))[0] : undefined;
                const hold = await sel('quality_holds', 'id', { work_order_id: `eq.${id}`, status: 'eq.OPEN' }, undefined, 1);
                const remaining = Math.max(0, w.qtyPlanned - w.qtyProduced);
                const links = [];
                if (prod)
                    links.push({ kind: 'PRODUCT', id: prod.id, label: prod.code });
                if (mach[0])
                    links.push({ kind: 'MACHINE', id: mach[0].id, label: mach[0].code });
                if (op[0] && canOpenPassport('PERSONNEL', access))
                    links.push({ kind: 'PERSONNEL', id: op[0].id, label: op[0].name });
                if (item[0] && canOpenPassport('ORDER', access))
                    links.push({ kind: 'ORDER', id: item[0].orderId, label: 'Sipariş' });
                const due = item[0]?.dueDate ?? null;
                const late = due && w.status !== 'COMPLETED' && w.status !== 'CANCELLED' && due < new Date().toISOString().slice(0, 10);
                return { kind, id, title: `${await pilotPrefix(id)}İş emri ${id.slice(0, 8).toUpperCase()}`, subtitle: prod ? `${prod.code} — ${prod.name}` : 'Ürün bilinmiyor', createdAt: w.createdAt, links,
                    status: hold.length ? pill('KALİTE HOLD', 'bad') : pill(WO_TR[w.status] ?? w.status, w.status === 'COMPLETED' ? 'ok' : w.status === 'IN_PROGRESS' ? 'info' : w.status === 'ON_HOLD' ? 'warn' : ''),
                    kpis: [{ label: 'Planlanan', value: num(w.qtyPlanned) }, { label: 'Sağlam', value: num(w.qtyProduced) }, { label: 'Hurda', value: num(w.qtyScrap) }, { label: 'Kalan', value: num(remaining) },
                        { label: 'Termin', value: due ?? 'BİLİNMİYOR' }, { label: 'Risk', value: late ? 'GECİKMİŞ' : due ? 'Normal' : 'BİLİNMİYOR' }, { label: 'Makine', value: mach[0]?.code ?? 'atanmadı' }, { label: 'Operatör', value: op[0]?.name ?? 'atanmadı' },
                        { label: 'Vardiya', value: w.plannedShiftCode ?? 'BİLİNMİYOR' }, { label: 'Son işlem', value: ts(w.updatedAt) }] };
            }
            case 'PRODUCT': {
                const p = await one('products', 'id,code,name,created_at', id);
                const revs = await sel('product_revisions', 'id,revision,status,released_at', { product_id: `eq.${id}` }, 'created_at.desc', 50);
                const rel = revs.find((r) => r.status === 'RELEASED');
                const items = await sel('order_items', 'id', { product_id: `eq.${id}` }, undefined, 500);
                const wos = items.length ? await selR('work_orders', 'status,qty_produced,qty_scrap', { order_item_id: inList(items.map((i) => i.id)) }, undefined, 1000) : [];
                const good = wos.reduce((a, w) => a + w.qtyProduced, 0);
                const scrap = wos.reduce((a, w) => a + w.qtyScrap, 0);
                return { kind, id, title: `${p.code}`, subtitle: p.name, createdAt: p.createdAt, links: [],
                    status: rel ? pill(`Rev ${rel.revision} yayında`, 'ok') : revs.length ? pill('Yayınlanmış revizyon yok', 'warn') : pill('Revizyon yok', 'warn'),
                    kpis: [{ label: 'Revizyon', value: String(revs.length) }, { label: 'İş emri', value: String(wos.length) }, { label: 'Sağlam', value: num(good) }, { label: 'Hurda', value: num(scrap) }, { label: 'Hurda oranı', value: good + scrap > 0 ? `%${((scrap / (good + scrap)) * 100).toFixed(1)}` : 'BİLİNMİYOR' }] };
            }
            case 'PERSONNEL': {
                const p = await one('personnel', 'id,name,employee_no,department,roles,active,shift_code,skills,created_at', id);
                const [skills, awards] = await Promise.all([
                    sel('personnel_skills', 'skill_code', { personnel_id: `eq.${id}` }, undefined, 200),
                    sel('badge_awards', 'id', { personnel_id: `eq.${id}` }, undefined, 200).catch(() => []),
                ]);
                return { kind, id, title: p.name, subtitle: [p.employeeNo, p.department].filter(Boolean).join(' · ') || 'Departman belirtilmemiş', createdAt: p.createdAt, links: [],
                    status: p.active ? pill('Aktif', 'ok') : pill('Pasif', 'warn'),
                    kpis: [{ label: 'Sicil', value: p.employeeNo ?? '—' }, { label: 'Vardiya', value: p.shiftCode ?? 'BİLİNMİYOR' }, { label: 'Yetkinlik', value: String(skills.length) }, { label: 'Rozet', value: String(awards.length) }, { label: 'Roller', value: (p.roles ?? []).join(', ') || '—' }] };
            }
            case 'TOOL': {
                const t = await one('tools', 'id,code,tool_type,location,machine_id,issued_to_personnel_id,life_minutes_used,life_minutes_rated,created_at', id);
                const mv = await sel('tool_movements', 'moved_at', { tool_id: `eq.${id}` }, 'moved_at.desc', 1);
                const mach = t.machineId ? (await sel('machines', 'id,code', { id: `eq.${t.machineId}` }, undefined, 1))[0] : undefined;
                const pct = t.lifeMinutesRated ? Math.round(((t.lifeMinutesUsed ?? 0) / t.lifeMinutesRated) * 100) : null;
                return { kind, id, title: t.code, subtitle: t.toolType, createdAt: t.createdAt, links: mach ? [{ kind: 'MACHINE', id: mach.id, label: mach.code }] : [],
                    status: pill(LOC_TR[t.location] ?? t.location, t.location === 'MOUNTED' ? 'info' : t.location === 'SCRAP' ? 'bad' : ''),
                    kpis: [{ label: 'Konum', value: LOC_TR[t.location] ?? t.location }, { label: 'Makine', value: mach?.code ?? '—' }, { label: 'Kullanılan ömür', value: pct === null ? 'BİLİNMİYOR (tanımlı ömür yok)' : `%${pct}` }, { label: 'Son hareket', value: ts(mv[0]?.movedAt) }] };
            }
            case 'MAINTENANCE_TICKET': {
                const t = await one('maintenance_tickets', 'id,machine_id,kind,severity,status,reason,created_at,updated_at', id);
                const m = (await sel('machines', 'id,code', { id: `eq.${t.machineId}` }, undefined, 1))[0];
                return { kind, id, title: `Bakım/arıza ${id.slice(0, 8).toUpperCase()}`, subtitle: t.reason, createdAt: t.createdAt, links: m ? [{ kind: 'MACHINE', id: m.id, label: m.code }] : [],
                    status: pill(TICKET_TR[t.status] ?? t.status, t.status === 'CLOSED' || t.status === 'RETURNED_TO_SERVICE' ? 'ok' : t.status === 'TEST_PENDING' ? 'warn' : 'bad'),
                    kpis: [{ label: 'Tür', value: t.kind }, { label: 'Önem', value: t.severity }, { label: 'Açılış', value: ts(t.createdAt) }, { label: 'Son işlem', value: ts(t.updatedAt) }] };
            }
            case 'CUSTOMER': {
                const c = await one('customers', 'id,code,name,country,active,created_at', id);
                const orders = await sel('orders', 'id,status', { customer_id: `eq.${id}` }, undefined, 500);
                return { kind, id, title: c.name, subtitle: `${c.code}${c.country ? ' · ' + c.country : ''}`, createdAt: c.createdAt, links: [], status: c.active ? pill('Aktif', 'ok') : pill('Pasif', 'warn'),
                    kpis: [{ label: 'Sipariş', value: String(orders.length) }, { label: 'Açık sipariş', value: String(orders.filter((o) => !['SHIPPED', 'CANCELLED', 'CLOSED'].includes(o.status)).length) }] };
            }
            case 'ORDER': {
                const o = await one('orders', 'id,customer_id,customer_po,status,created_at', id);
                const cust = (await sel('customers', 'id,name', { id: `eq.${o.customerId}` }, undefined, 1))[0];
                const items = await sel('order_items', 'qty,qty_produced,qty_shipped,due_date', { order_id: `eq.${id}` }, undefined, 500);
                const q = items.reduce((a, i) => a + i.qty, 0);
                const sh = items.reduce((a, i) => a + i.qtyShipped, 0);
                const due = items.map((i) => i.dueDate).filter((d) => !!d).sort()[0] ?? null;
                return { kind, id, title: `Sipariş ${o.customerPo ?? id.slice(0, 8).toUpperCase()}`, subtitle: cust?.name ?? 'Müşteri bilinmiyor', createdAt: o.createdAt, links: cust ? [{ kind: 'CUSTOMER', id: cust.id, label: cust.name }] : [],
                    status: pill(o.status, o.status === 'CLOSED' || o.status === 'SHIPPED' ? 'ok' : o.status === 'CANCELLED' ? 'bad' : ''), kpis: [{ label: 'Kalem', value: String(items.length) }, { label: 'Sipariş adedi', value: num(q) }, { label: 'Sevk edilen', value: num(sh) }, { label: 'Kalan yükümlülük', value: num(Math.max(0, q - sh)) }, { label: 'En yakın termin', value: due ?? 'BİLİNMİYOR' }] };
            }
            case 'STOCK_LOT': {
                const l = await one('stock_lots', 'id,work_order_id,qty,state,created_at,updated_at', id);
                return { kind, id, title: `Parti ${id.slice(0, 8).toUpperCase()}`, subtitle: `${num(l.qty)} adet`, createdAt: l.createdAt, links: l.workOrderId ? [{ kind: 'WORK_ORDER', id: l.workOrderId, label: 'İş emri' }] : [],
                    status: pill(l.state, l.state === 'SHIPPED' ? 'ok' : l.state === 'HOLD' || l.state === 'SCRAP' ? 'bad' : 'info'), kpis: [{ label: 'Adet', value: num(l.qty) }, { label: 'Durum', value: l.state }, { label: 'Son işlem', value: ts(l.updatedAt) }] };
            }
            case 'SUPPLIER': {
                const s = await one('suppliers', 'id,name,contact_info,active,created_at', id);
                return { kind, id, title: s.name, subtitle: s.contactInfo ?? 'İletişim kaydı yok', createdAt: s.createdAt, links: [], status: s.active ? pill('Aktif', 'ok') : pill('Pasif', 'warn'), kpis: [] };
            }
            case 'QUALITY_NCR': {
                const n = await one('quality_ncrs', 'id,work_order_id,qty,reason,status,opened_at,updated_at', id);
                return { kind, id, title: `NCR ${id.slice(0, 8).toUpperCase()}`, subtitle: n.reason, createdAt: n.openedAt, links: [{ kind: 'WORK_ORDER', id: n.workOrderId, label: 'İş emri' }],
                    status: pill(n.status, n.status === 'OPEN' || n.status === 'REWORK' || n.status === 'RECHECK_PENDING' ? 'bad' : 'ok'), kpis: [{ label: 'Adet', value: num(n.qty) }, { label: 'Açılış', value: ts(n.openedAt) }, { label: 'Son işlem', value: ts(n.updatedAt) }] };
            }
            case 'SHIPMENT': {
                const s = await one('shipments', 'id,stock_lot_id,status,delivery_note_no,created_at,dispatched_at,delivered_at', id);
                return { kind, id, title: `Sevkiyat ${s.deliveryNoteNo ?? id.slice(0, 8).toUpperCase()}`, subtitle: 'İrsaliye ' + (s.deliveryNoteNo ?? '—'), createdAt: s.createdAt, links: [{ kind: 'STOCK_LOT', id: s.stockLotId, label: 'Parti' }],
                    status: pill(s.status, s.status === 'DELIVERED' ? 'ok' : s.status === 'CANCELLED' ? 'bad' : 'info'), kpis: [{ label: 'Çıkış', value: ts(s.dispatchedAt) }, { label: 'Teslim', value: ts(s.deliveredAt) }] };
            }
            case 'TASK': {
                const t = await one('tasks', 'id,title,status,source_type,source_id,due_at,created_at,completed_at', id);
                const src = t.sourceType && t.sourceId && t.sourceType in KINDS ? [{ kind: t.sourceType, id: t.sourceId, label: KINDS[t.sourceType].tr }] : [];
                return { kind, id, title: t.title, subtitle: t.sourceType ?? 'Bağımsız görev', createdAt: t.createdAt, links: src, status: pill(t.status, t.status === 'COMPLETED' || t.status === 'APPROVED' ? 'ok' : ''), kpis: [{ label: 'Termin', value: ts(t.dueAt) }, { label: 'Tamamlanma', value: ts(t.completedAt) }] };
            }
        }
    }
    // ---------- tabs ----------
    const tbl = (columns, rows, empty) => ({ columns, rows, empty });
    async function tab(kind, id, key) {
        try {
            await assertOpen(kind, id);
        }
        catch {
            return { denied: 'Bu nesnenin bu bölümü rolünüze açık değil.' };
        }
        if (key === 'belgeler')
            return guard(async () => {
                const def = KINDS[kind];
                const docs = def.docEntity ? await sel('documents', 'id,doc_type,title,status,created_at', { entity_type: `eq.${def.docEntity}`, entity_id: `eq.${id}` }, 'created_at.desc') : [];
                return [{ title: 'Belgeler', table: tbl(['Tür', 'Başlık', 'Durum', 'Eklenme'], docs.map((d) => [d.docType, d.title, d.status === 'ACTIVE' ? pill('Aktif', 'ok') : pill('Geri çekildi', 'warn'), ts(d.createdAt)]), def.docEntity ? 'Bu nesneye bağlı belge yok.' : 'Bu nesne türüne belge bağlama şu an tanımlı değil (dokümanlar ürün revizyonu, iş emri, sipariş, parti, sevkiyat, NCR, makine ve takıma bağlanır).'),
                        note: def.docEntity ? `Belge eklemek için Dokümanlar ekranı kullanılır.` : undefined }];
            });
        switch (`${kind}:${key}`) {
            case 'MACHINE:genel': return guard(async () => {
                const m = await one('machines', 'code,name,category,status,down_since,total_down_minutes,created_at,skill_review', id);
                return [{ title: 'Kimlik', kv: [['Makine numarası', m.code], ['Ad', m.name], ['Kategori', m.category ?? 'belirtilmemiş'], ['Kayıt tarihi', ts(m.createdAt)], ['Yetkinlik şartı incelemesi', m.skillReview ?? '—']] },
                    { title: 'Sağlık kaydı (insan girişi)', kv: [['Durum', (MACHINE_STATUS_TR[m.status] ?? [m.status])[0]], ['DOWN başlangıcı', m.status === 'DOWN' ? ts(m.downSince) : '—'], ['Toplam duruş', m.totalDownMinutes === null ? 'BİLİNMİYOR' : `${num(m.totalDownMinutes)} dk`]],
                        note: 'Fiziksel çalışma durumu BİLİNMİYOR: CNC telemetrisi bağlı değil. Marka/model/fotoğraf alanları bu sürümün veritabanında yok (BLOCKED: makine teknik kimlik tablosu).' }];
            });
            case 'MACHINE:canli': return guard(async () => {
                const wos = await sel('work_orders', 'id,status,operator_id,qty_planned,qty_produced,qty_scrap,updated_at', { machine_id: `eq.${id}`, status: inList(ACTIVE_WO) }, 'updated_at.desc');
                const ops = await sel('personnel', 'id,name', wos.length ? { id: inList(uniq(wos.map((w) => w.operatorId))) } : { id: 'eq.00000000-0000-0000-0000-000000000000' });
                const pfm = await fetchPilotFlags(client, session, wos.map((w) => w.id));
                return [{ title: 'Aktif iş emirleri', table: tbl(['İş emri', 'Durum', 'Operatör', 'Planlanan', 'Sağlam', 'Hurda', 'Son işlem'], wos.map((w) => [lnk('WORK_ORDER', w.id, pilotText(w.id.slice(0, 8).toUpperCase(), pfm.has(w.id))), WO_TR[w.status] ?? w.status, ops.find((o) => o.id === w.operatorId)?.name ?? 'atanmadı', num(w.qtyPlanned), num(w.qtyProduced), num(w.qtyScrap), ts(w.updatedAt)]), 'Bu makinede aktif iş emri yok.') }];
            });
            case 'MACHINE:ariza': return guard(async () => {
                const t = await sel('maintenance_tickets', 'id,kind,severity,status,reason,created_at,updated_at', { machine_id: `eq.${id}` }, 'created_at.desc', 100);
                return [{ title: 'Arıza ve bakım kayıtları', table: tbl(['Kayıt', 'Tür', 'Önem', 'Durum', 'Neden', 'Açılış'], t.map((x) => [lnk('MAINTENANCE_TICKET', x.id, x.id.slice(0, 8).toUpperCase()), x.kind, x.severity, pill(TICKET_TR[x.status] ?? x.status, x.status === 'CLOSED' ? 'ok' : 'warn'), x.reason, ts(x.createdAt)]), 'Bu makine için arıza/bakım kaydı yok.'),
                        note: 'Arıza bildiren, müdahale, çözüm, kullanılan parça ve servise dönüş alanlarının yalnız bir kısmı kayıtlıdır: neden + durum geçişleri + test sonuçları vardır; yedek parça ve dış servis kayıtları bu veritabanında YOK (BLOCKED).' }];
            });
            case 'MACHINE:performans': return guard(async () => {
                const wos = await sel('work_orders', 'status,qty_produced,qty_scrap,created_at', { machine_id: `eq.${id}` }, 'created_at.desc', 500);
                const good = wos.reduce((a, w) => a + w.qtyProduced, 0);
                const scrap = wos.reduce((a, w) => a + w.qtyScrap, 0);
                return [{ title: 'Bu makineye atanmış iş emirleri (tüm zamanlar)', kv: [['İş emri sayısı', num(wos.length)], ['Tamamlanan', num(wos.filter((w) => w.status === 'COMPLETED').length)], ['Sağlam adet', num(good)], ['Hurda adet', num(scrap)]],
                        note: 'Günlük/haftalık/aylık/yıllık OEE ve kayıp kırılımı OEE ekranındaki kanonik hesaptan gelir (#/oee); burada ikinci bir hesap yapılmaz. Makine bazlı dönemsel üretim, iş emri beyan kayıtlarından zaman çizelgesi sekmesindeki filtrelerle incelenir.' }];
            });
            case 'WORK_ORDER:genel':
            case 'WORK_ORDER:operasyonlar':
            case 'WORK_ORDER:uretim':
            case 'WORK_ORDER:kalite':
            case 'WORK_ORDER:takim': return guard(async () => {
                if (key === 'genel') {
                    const w = await one('work_orders', 'created_at,planned_date,planned_shift_code,planned_minutes,product_revision_id,cam_program_id', id);
                    const rev = w.productRevisionId ? (await sel('product_revisions', 'revision,status', { id: `eq.${w.productRevisionId}` }, undefined, 1))[0] : undefined;
                    const cam = w.camProgramId ? (await sel('cam_programs', 'program_no,revision', { id: `eq.${w.camProgramId}` }, undefined, 1))[0] : undefined;
                    return [{ title: 'Kimlik', kv: [['İş emri referansı', `İE-${id.slice(0, 8).toUpperCase()}`], ['Açılış', ts(w.createdAt)], ['Planlanan gün', w.plannedDate ?? '—'], ['Planlanan vardiya', w.plannedShiftCode ?? '—'], ['Planlanan süre', w.plannedMinutes === null ? 'BİLİNMİYOR' : `${w.plannedMinutes} dk`], ['Ürün revizyonu', rev ? `${rev.revision} (${rev.status})` : 'atanmadı'], ['CAM programı', cam ? `${cam.programNo} rev ${cam.revision}` : 'atanmadı']],
                            note: 'Ayrıntılı izlenebilirlik zinciri (eksik halkalar, as-built, malzeme, parti, sevkiyat) bu pasaportun "İzlenebilirlik zinciri" sekmesinde.' }];
                }
                if (key === 'operasyonlar') {
                    const ops = await sel('work_order_operations', 'op_no,name,status,machine_id,operator_id,qty_good,qty_scrap,completed_at,qc_result', { work_order_id: `eq.${id}` }, 'op_no.asc');
                    const ms = ops.length ? await sel('machines', 'id,code', { id: inList(uniq(ops.map((o) => o.machineId))) || 'eq.0' }).catch(() => []) : [];
                    return [{ title: 'Operasyonlar', table: tbl(['Sıra', 'Ad', 'Durum', 'Makine', 'Sağlam', 'Hurda', 'KK', 'Tamamlanma'], ops.map((o) => [String(o.opNo), o.name, o.status, ms.find((m) => m.id === o.machineId)?.code ?? '—', num(o.qtyGood), num(o.qtyScrap), o.qcResult ?? '—', ts(o.completedAt)]), 'Bu iş emrine rota/operasyon uygulanmamış.') }];
                }
                if (key === 'uretim') {
                    const d = await sel('production_declarations', 'qty_good,qty_scrap,is_first_piece,declared_at,declared_by', { work_order_id: `eq.${id}` }, 'declared_at.desc', 200);
                    const nm = await names(uniq(d.map((x) => x.declaredBy)));
                    return [{ title: 'Üretim beyanları', table: tbl(['Zaman', 'Beyan eden', 'Sağlam', 'Hurda', 'İlk parça'], d.map((x) => [ts(x.declaredAt), nm[x.declaredBy] ?? x.declaredBy.slice(0, 8), num(x.qtyGood), num(x.qtyScrap), x.isFirstPiece ? 'evet' : '—']), 'Henüz üretim beyanı yok.') }];
                }
                if (key === 'kalite') {
                    const [holds, ncrs] = await Promise.all([
                        sel('quality_holds', 'reason,status,opened_at,released_at,release_reason', { work_order_id: `eq.${id}` }, 'opened_at.desc'),
                        sel('quality_ncrs', 'id,qty,reason,status,opened_at', { work_order_id: `eq.${id}` }, 'opened_at.desc'),
                    ]);
                    return [{ title: 'Kalite HOLD kayıtları', table: tbl(['Durum', 'Neden', 'Açılış', 'Kaldırma', 'Kaldırma gerekçesi'], holds.map((x) => [pill(x.status, x.status === 'OPEN' ? 'bad' : 'ok'), x.reason, ts(x.openedAt), ts(x.releasedAt), x.releaseReason ?? '—']), 'Kalite HOLD kaydı yok.') },
                        { title: 'Uygunsuzluklar (NCR)', table: tbl(['NCR', 'Adet', 'Neden', 'Durum', 'Açılış'], ncrs.map((x) => [lnk('QUALITY_NCR', x.id, x.id.slice(0, 8).toUpperCase()), num(x.qty), x.reason, x.status, ts(x.openedAt)]), 'NCR yok.') }];
                }
                const tm = await sel('tool_movements', 'tool_id,from_location,to_location,moved_at,machine_id', { work_order_id: `eq.${id}` }, 'moved_at.desc');
                const tools = tm.length ? await sel('tools', 'id,code,tool_type', { id: inList(uniq(tm.map((x) => x.toolId))) }) : [];
                return [{ title: 'Bu iş emrinde hareket eden takımlar', table: tbl(['Takım', 'Tür', 'Nereden', 'Nereye', 'Zaman'], tm.map((x) => { const t = tools.find((z) => z.id === x.toolId); return [lnk('TOOL', x.toolId, t?.code), t?.toolType ?? '—', x.fromLocation ?? '—', x.toLocation, ts(x.movedAt)]; }), 'Bu iş emrine bağlı takım hareketi yok.'),
                        note: 'Aparat, fikstür ve ölçüm cihazı bağlantıları için ayrı kanonik tablo yoktur (BLOCKED); takımlar tools/tool_movements üzerinden gelir.' }];
            });
            case 'PRODUCT:genel': return guard(async () => { const p = await one('products', 'code,name,source_ref,created_at', id); return [{ title: 'Kimlik', kv: [['Ürün kodu', p.code], ['Ad', p.name], ['Kayıt tarihi', ts(p.createdAt)], ['Eski KMI kaynağı', p.sourceRef ?? '—']], note: 'Ürün görseli, ürün ailesi alanları bu veritabanında yok (BLOCKED).' }]; });
            case 'PRODUCT:revizyonlar': return guard(async () => {
                const revs = await sel('product_revisions', 'id,revision,status,released_at', { product_id: `eq.${id}` }, 'created_at.desc', 100);
                const cams = revs.length ? await sel('cam_programs', 'product_revision_id,program_no,revision,status,ideal_cycle_seconds', { product_revision_id: inList(revs.map((r) => r.id)) }) : [];
                return [{ title: 'Revizyonlar', table: tbl(['Revizyon', 'Durum', 'Yayın'], revs.map((r) => [r.revision, pill(r.status, r.status === 'RELEASED' ? 'ok' : ''), ts(r.releasedAt)]), 'Revizyon yok.') },
                    { title: 'CAM programları', table: tbl(['Program', 'Revizyon', 'Durum', 'Ideal çevrim (sn)'], cams.map((c) => [c.programNo, c.revision, c.status, c.idealCycleSeconds === null ? 'BİLİNMİYOR' : String(c.idealCycleSeconds)]), 'CAM programı yok.') }];
            });
            case 'PRODUCT:uretim': return guard(async () => {
                const items = await sel('order_items', 'id', { product_id: `eq.${id}` }, undefined, 500);
                const wos = items.length ? await selR('work_orders', 'id,status,qty_produced,qty_scrap,machine_id,created_at', { order_item_id: inList(items.map((i) => i.id)) }, 'created_at.desc', 100) : [];
                return [{ title: 'İş emirleri', table: tbl(['İş emri', 'Durum', 'Sağlam', 'Hurda', 'Açılış'], wos.map((w) => [lnk('WORK_ORDER', w.id, w.id.slice(0, 8).toUpperCase()), WO_TR[w.status] ?? w.status, num(w.qtyProduced), num(w.qtyScrap), ts(w.createdAt)]), 'Bu ürün için iş emri yok.') }];
            });
            case 'PRODUCT:kalite': return guard(async () => {
                const items = await sel('order_items', 'id', { product_id: `eq.${id}` }, undefined, 500);
                const wos = items.length ? await selR('work_orders', 'id', { order_item_id: inList(items.map((i) => i.id)) }, undefined, 1000) : [];
                const ncrs = wos.length ? await selR('quality_ncrs', 'id,qty,reason,status,opened_at', { work_order_id: inList(wos.map((w) => w.id)) }, 'opened_at.desc', 200) : [];
                return [{ title: 'Geçmiş uygunsuzluklar', table: tbl(['NCR', 'Adet', 'Neden', 'Durum', 'Açılış'], ncrs.map((x) => [lnk('QUALITY_NCR', x.id, x.id.slice(0, 8).toUpperCase()), num(x.qty), x.reason, x.status, ts(x.openedAt)]), 'Bu ürün için uygunsuzluk kaydı yok.') }];
            });
            case 'PERSONNEL:genel': return guard(async () => {
                const p = await one('personnel', 'name,employee_no,department,roles,shift_code,active,created_at', id);
                return [{ title: 'Kimlik', kv: [['Ad soyad', p.name], ['Sicil', p.employeeNo ?? '—'], ['Departman', p.department ?? '—'], ['Roller', (p.roles ?? []).join(', ') || '—'], ['Vardiya', p.shiftCode ?? '—'], ['Durum', p.active ? 'Aktif' : 'Pasif'], ['Kayıt', ts(p.createdAt)]],
                        note: 'Puantaj/prim ve ekonomik alanlar bu pasaportta gösterilmez (sütun yetkisiyle kapalı; 0073 olmadan puantaj hesabı yok). Fotoğraf alanı yok (BLOCKED).' }];
            });
            case 'PERSONNEL:yetkinlik': return guard(async () => {
                const [sk, en] = await Promise.all([
                    sel('personnel_skills', 'skill_code,level,valid_until,granted_at', { personnel_id: `eq.${id}` }, 'skill_code.asc'),
                    sel('academy_enrollments', 'module_id,status,enrolled_at', { personnel_id: `eq.${id}` }, 'enrolled_at.desc', 100),
                ]);
                return [{ title: 'Yetkinlikler', table: tbl(['Yetkinlik', 'Seviye', 'Geçerlilik', 'Veriliş'], sk.map((s) => [s.skillCode, String(s.level), s.validUntil ?? 'süresiz', ts(s.grantedAt)]), 'Kayıtlı yetkinlik yok.') },
                    { title: 'Eğitimler', table: tbl(['Modül', 'Durum', 'Kayıt'], en.map((e) => [e.moduleId.slice(0, 8), e.status, ts(e.enrolledAt)]), 'Eğitim kaydı yok.') }];
            });
            case 'PERSONNEL:rozetler': return guard(async () => {
                const TN = { 1: 'BRONZ', 2: 'GÜMÜŞ', 3: 'ALTIN', 4: 'PLATİN', 5: 'USTA' };
                const [b, fam, sk, cat] = await Promise.all([
                    sel('badge_awards', 'family_code,tier,awarded_at', { personnel_id: `eq.${id}` }, 'awarded_at.desc', 200),
                    sel('badge_families', 'code,name_tr', {}, 'sort.asc', 50),
                    sel('personnel_skills', 'skill_code,level,valid_until', { personnel_id: `eq.${id}` }, 'skill_code.asc', 200),
                    sel('skill_catalog', 'code,category', {}, 'code.asc', 300),
                ]);
                const famName = (c) => fam.find((f) => f.code === c)?.nameTr ?? c;
                const today = new Date().toISOString().slice(0, 10);
                const machine = sk.filter((x) => cat.find((c) => c.code === x.skillCode)?.category === 'MACHINE' && x.level >= 2 && (!x.validUntil || x.validUntil >= today));
                return [
                    { title: 'Son kazanım', kv: [['Son rozet', b[0] ? `${famName(b[0].familyCode)} — ${TN[b[0].tier] ?? b[0].tier} (${ts(b[0].awardedAt)})` : 'Henüz rozet yok'], ['Kazanılan toplam', String(b.length)]] },
                    { title: 'Rozet kazanım kayıtları', table: tbl(['Rozet', 'Seviye', 'Kazanım'], b.map((x) => [famName(x.familyCode), TN[x.tier] ?? String(x.tier), ts(x.awardedAt)]), 'Rozet kaydı yok veya görme yetkiniz yok.') },
                    { title: 'Doğrulanmış makine yetkinlikleri', table: tbl(['Yetkinlik', 'Seviye', 'Geçerlilik'], machine.map((x) => [x.skillCode, String(x.level), x.validUntil ?? 'süresiz']), 'Doğrulanmış (seviye ≥ 2, süresi dolmamış) makine yetkinliği yok → DOĞRULAMA BEKLİYOR.'),
                        note: 'Rozet bir takdirdir; yetki ya da prim/puantaj etkisi yoktur. Kazanım yalnız kanıtlı kayıtlardan (onaylı yetkinlik, biten operasyon, kalite sonucu) üretilir; kaynak kaydı olmayan rozet ailesi kazanılamaz. Kişi yalnız kendisini, yetkili kullanıcı başkalarını görür (sunucu kuralı).' },
                ];
            });
            case 'PERSONNEL:aktif': return guard(async () => {
                const p = await one('personnel', 'auth_user_id', id);
                if (!p.authUserId)
                    return [{ title: 'Aktif görevler', note: 'Bu personel kaydına giriş hesabı bağlı değil; hesap bağlanmadan görev ataması yapılamaz.' }];
                const t = await sel('tasks', 'id,title,status,due_at', { assignee_user_id: `eq.${p.authUserId}`, status: 'in.(OPEN,IN_PROGRESS)' }, 'due_at.asc', 100);
                return [{ title: 'Aktif görevler', table: tbl(['Görev', 'Durum', 'Termin'], t.map((x) => [lnk('TASK', x.id, x.title), x.status, ts(x.dueAt)]), 'Aktif görev yok.') }];
            });
            case 'TOOL:genel': return guard(async () => {
                const t = await one('tools', 'code,tool_type,location,life_minutes_rated,created_at', id);
                return [{ title: 'Teknik kimlik', kv: [['Takım kodu', t.code], ['Tür', t.toolType], ['Konum', t.location], ['Tanımlı ömür', t.lifeMinutesRated === null ? 'BİLİNMİYOR' : `${t.lifeMinutesRated} dk`], ['Kayıt', ts(t.createdAt)]],
                        note: 'Marka/model, çap/ölçü, takım ailesi, takım seti (kesici+tutucu+uzatma) ve presetting ölçümü için kanonik tablo yok → BLOCKED. Nikken presetter / LockCell bağlantı noktaları için device_inbox altyapısı var; gerçek entegrasyon YOK (cihaz kanıtı bekleniyor).' }];
            });
            case 'TOOL:kullanim': return guard(async () => {
                const mv = await sel('tool_movements', 'from_location,to_location,moved_at,machine_id,work_order_id,reason', { tool_id: `eq.${id}` }, 'moved_at.desc', 200);
                const ms = mv.length ? await sel('machines', 'id,code', { id: inList(uniq(mv.map((m) => m.machineId))) || 'eq.0' }).catch(() => []) : [];
                return [{ title: 'Hareket / kullanım', table: tbl(['Zaman', 'Nereden', 'Nereye', 'Makine', 'İş emri', 'Gerekçe'], mv.map((m) => [ts(m.movedAt), m.fromLocation ?? '—', m.toLocation, lnk('MACHINE', m.machineId, ms.find((x) => x.id === m.machineId)?.code), lnk('WORK_ORDER', m.workOrderId, m.workOrderId?.slice(0, 8).toUpperCase()), m.reason ?? '—']), 'Hareket kaydı yok.') }];
            });
            case 'TOOL:omur': return guard(async () => {
                const t = await one('tools', 'life_minutes_used,life_minutes_rated', id);
                const pct = t.lifeMinutesRated ? Math.round(((t.lifeMinutesUsed ?? 0) / t.lifeMinutesRated) * 100) : null;
                return [{ title: 'Takım ömrü', kv: [['Kullanılan', t.lifeMinutesUsed === null ? 'BİLİNMİYOR' : `${t.lifeMinutesUsed} dk`], ['Tanımlı ömür', t.lifeMinutesRated === null ? 'BİLİNMİYOR' : `${t.lifeMinutesRated} dk`], ['Doluluk', pct === null ? 'BİLİNMİYOR' : `%${pct}`]], note: 'Aşınma analizi veri yeterli değilse yapılmaz; burada yalnız kaydedilen kullanım/ömür gösterilir.' }];
            });
            case 'TOOL:hareket': return guard(async () => {
                const mv = await sel('tool_movements', 'from_location,to_location,moved_at', { tool_id: `eq.${id}` }, 'moved_at.desc', 200);
                return [{ title: 'Konum hareketleri', table: tbl(['Zaman', 'Nereden', 'Nereye'], mv.map((m) => [ts(m.movedAt), m.fromLocation ?? '—', m.toLocation]), 'Hareket yok.'), note: 'Takım adet stoğu (giriş/çıkış/iade) ayrı bir stok ledger\'ında tutulmuyor: yalnız konum hareketi var.' }];
            });
            case 'MAINTENANCE_TICKET:genel': return guard(async () => {
                const t = await one('maintenance_tickets', 'kind,severity,status,reason,created_by,created_at,updated_at', id);
                const nm = await names([t.createdBy]);
                return [{ title: 'Kayıt', kv: [['Tür', t.kind], ['Önem', t.severity], ['Durum', TICKET_TR[t.status] ?? t.status], ['Bildiren', nm[t.createdBy] ?? t.createdBy.slice(0, 8)], ['Neden', t.reason], ['Açılış', ts(t.createdAt)], ['Son işlem', ts(t.updatedAt)]] }];
            });
            case 'MAINTENANCE_TICKET:test': return guard(async () => {
                const r = await sel('maintenance_test_results', 'seq,result,notes,tested_by,tested_at', { ticket_id: `eq.${id}` }, 'seq.asc');
                const nm = await names(uniq(r.map((x) => x.testedBy)));
                return [{ title: 'Yetkili test sonuçları', table: tbl(['#', 'Sonuç', 'Not', 'Test eden', 'Zaman'], r.map((x) => [String(x.seq), pill(x.result, x.result === 'PASS' ? 'ok' : 'bad'), x.notes ?? '—', nm[x.testedBy] ?? x.testedBy.slice(0, 8), ts(x.testedAt)]), 'Henüz test sonucu yok.') }];
            });
            case 'CUSTOMER:genel': return guard(async () => { const c = await one('customers', 'code,name,country,active,created_at', id); return [{ title: 'Kimlik', kv: [['Müşteri kodu', c.code], ['Ad', c.name], ['Ülke', c.country ?? '—'], ['Durum', c.active ? 'Aktif' : 'Pasif'], ['Kayıt', ts(c.createdAt)]], note: 'Yetkili kişiler ve şartlar “Müşteriler” ekranındadır (yetkili roller; sunucu güncellemesi 0096 ile). Kalite şikâyeti alanı için kanonik tablo yok (BLOCKED).' }]; });
            // KMI-006: contacts / terms / delivery come ONLY from the server-authorized customer_profile (read-only; the server refuses operator, quality and other roles and logs every read)
            case 'CUSTOMER:kisiler': return guard(async () => {
                const p = await client.rpc('customer_profile', { p_customer_id: id }, session);
                return [{ title: 'İletişim kişileri', table: tbl(['Ad', 'Görev', 'Telefon', 'E-posta', 'Durum'], p.contacts.map((c) => [c.fullName + (c.isPrimary ? ' (birincil)' : ''), c.roleTitle ?? '—', c.phone ?? '—', c.email ?? '—', c.active ? 'Aktif' : 'Pasif']), 'Kayıtlı kişi yok (VERİ YOK).'), note: 'Kişi ekleme/düzenleme “Müşteriler” ekranındadır. Bu bölümü yalnız yetkili roller görür; her okuma kayda geçer.' }];
            });
            case 'CUSTOMER:sartlar': return guard(async () => {
                const p = await client.rpc('customer_profile', { p_customer_id: id }, session);
                const t = p.terms;
                return [{ title: 'Şartlar', kv: t ? [['Ödeme', t.paymentTerms ?? '—'], ['Teslimat', t.deliveryTerms ?? '—'], ['Kalite', t.qualityRequirements ?? '—'], ['Not', t.note ?? '—']] : [['Şartlar', 'VERİ YOK']] },
                    { title: 'Teslimat performansı', kv: [['Aktif sipariş', String(p.activeOrders)], ['Zamanında', p.delivery.onTimePct === null ? 'VERİ YOK' : `%${p.delivery.onTimePct} (${p.delivery.onTime}/${p.delivery.judged})`], ['Kârlılık', 'VERİ YOK']], note: 'Kârlılık maliyet defteri (KMI-070) olmadan hesaplanmaz.' }];
            });
            case 'CUSTOMER:siparisler': return guard(async () => {
                const o = await sel('orders', 'id,customer_po,status,created_at', { customer_id: `eq.${id}` }, 'created_at.desc', 200);
                return [{ title: 'Siparişler', table: tbl(['Sipariş', 'Durum', 'Açılış'], o.map((x) => [lnk('ORDER', x.id, x.customerPo ?? x.id.slice(0, 8).toUpperCase()), x.status, ts(x.createdAt)]), 'Sipariş yok.') }];
            });
            case 'CUSTOMER:sevkiyat': return guard(async () => [{ title: 'Sevkiyat', note: 'Müşteri bazlı sevkiyat özeti sipariş pasaportlarının "Kalemler" sekmesinden izlenir; müşteri → sevkiyat doğrudan ilişkisi kanonik şemada sipariş kalemi üzerinden kuruludur.' }]);
            case 'ORDER:genel': return guard(async () => { const o = await one('orders', 'customer_po,status,created_at', id); return [{ title: 'Kimlik', kv: [['Müşteri PO', o.customerPo ?? '—'], ['Durum', o.status], ['Açılış', ts(o.createdAt)]] }]; });
            case 'ORDER:kalemler': return guard(async () => {
                const it = await sel('order_items', 'id,product_id,qty,qty_produced,qty_shipped,due_date', { order_id: `eq.${id}` }, 'created_at.asc', 200);
                const pr = it.length ? await sel('products', 'id,code', { id: inList(uniq(it.map((i) => i.productId))) }) : [];
                const wo = it.length ? await selR('work_orders', 'id,order_item_id,status', { order_item_id: inList(it.map((i) => i.id)) }, undefined, 500) : [];
                return [{ title: 'Sipariş kalemleri', table: tbl(['Ürün', 'Adet', 'Üretilen', 'Sevk edilen', 'Kalan yükümlülük', 'Termin', 'İş emirleri'], it.map((i) => [lnk('PRODUCT', i.productId, pr.find((p) => p.id === i.productId)?.code), num(i.qty), num(i.qtyProduced), num(i.qtyShipped), num(Math.max(0, i.qty - i.qtyShipped)), i.dueDate ?? '—', wo.filter((w) => w.orderItemId === i.id).map((w) => w.id.slice(0, 8).toUpperCase()).join(', ') || 'yok']), 'Kalem yok.') }];
            });
            case 'STOCK_LOT:genel': return guard(async () => { const l = await one('stock_lots', 'qty,state,created_at,work_order_id', id); return [{ title: 'Parti', kv: [['Adet', num(l.qty)], ['Durum', l.state], ['Oluşma', ts(l.createdAt)], ['İş emri', lnk('WORK_ORDER', l.workOrderId, l.workOrderId?.slice(0, 8).toUpperCase()) ?? '—']], note: 'Etiket/izlenebilirlik zinciri: #/pasaport (kanonik parti pasaportu).' }]; });
            case 'STOCK_LOT:hareket': return guard(async () => {
                const m = await sel('stock_movements', 'from_state,to_state,reason,moved_at', { stock_lot_id: `eq.${id}` }, 'moved_at.asc', 200);
                return [{ title: 'Stok hareketleri (kanonik ledger)', table: tbl(['Zaman', 'Nereden', 'Nereye', 'Gerekçe'], m.map((x) => [ts(x.movedAt), x.fromState ?? '—', x.toState, x.reason ?? '—']), 'Hareket yok.') }];
            });
            case 'STOCK_LOT:sevkiyat': return guard(async () => {
                const [ap, sh] = await Promise.all([
                    sel('commercial_approvals', 'status,requested_at,management_released_at,decided_at,decision_reason', { stock_lot_id: `eq.${id}` }, 'requested_at.desc'),
                    sel('shipments', 'id,status,delivery_note_no,dispatched_at,delivered_at', { stock_lot_id: `eq.${id}` }, 'created_at.desc'),
                ]);
                return [{ title: 'Ticari onaylar', table: tbl(['Durum', 'İstek', 'Yönetim serbest bırakma', 'Karar', 'Gerekçe'], ap.map((a) => [pill(a.status, a.status === 'APPROVED' ? 'ok' : a.status === 'REJECTED' ? 'bad' : 'warn'), ts(a.requestedAt), ts(a.managementReleasedAt), ts(a.decidedAt), a.decisionReason ?? '—']), 'Ticari onay isteği yok.') },
                    { title: 'Sevkiyatlar', table: tbl(['Sevkiyat', 'Durum', 'İrsaliye', 'Çıkış', 'Teslim'], sh.map((s) => [lnk('SHIPMENT', s.id, s.id.slice(0, 8).toUpperCase()), s.status, s.deliveryNoteNo ?? '—', ts(s.dispatchedAt), ts(s.deliveredAt)]), 'Sevkiyat yok.') }];
            });
            case 'SUPPLIER:genel': return guard(async () => { const s = await one('suppliers', 'name,contact_info,active,created_at', id); return [{ title: 'Kimlik', kv: [['Ad', s.name], ['İletişim', s.contactInfo ?? '—'], ['Durum', s.active ? 'Aktif' : 'Pasif'], ['Kayıt', ts(s.createdAt)]] }]; });
            case 'QUALITY_NCR:genel': return guard(async () => { const n = await one('quality_ncrs', 'qty,reason,status,opened_at,updated_at', id); return [{ title: 'Kayıt', kv: [['Adet', num(n.qty)], ['Neden', n.reason], ['Durum', n.status], ['Açılış', ts(n.openedAt)], ['Son işlem', ts(n.updatedAt)]] }]; });
            case 'SHIPMENT:genel': return guard(async () => { const s = await one('shipments', 'status,delivery_note_no,created_at,dispatched_at,delivered_at', id); return [{ title: 'Sevkiyat', kv: [['Durum', s.status], ['İrsaliye', s.deliveryNoteNo ?? '—'], ['Oluşma', ts(s.createdAt)], ['Çıkış', ts(s.dispatchedAt)], ['Teslim', ts(s.deliveredAt)]] }]; });
            case 'TASK:genel': return guard(async () => {
                const t = await one('tasks', 'title,description,status,source_type,due_at,completion_note,created_at', id);
                return [{ title: 'Görev', kv: [['Başlık', t.title], ['Açıklama', t.description ?? '—'], ['Durum', t.status], ['Kaynak', t.sourceType ?? '—'], ['Termin', ts(t.dueAt)], ['Tamamlama notu', t.completionNote ?? '—'], ['Açılış', ts(t.createdAt)]] }];
            });
            default: return { sections: [{ title: KINDS[kind].tabs.find((t) => t.key === key)?.label ?? key, note: 'Bu sekme için içerik tanımlı değil.' }] };
        }
    }
    // ---------- timeline ----------
    async function timeline(kind, id) {
        const def = KINDS[kind];
        const notes = [];
        try {
            await assertOpen(kind, id);
        }
        catch {
            return { events: [], notes: ['Bu nesnenin olay geçmişi rolünüze açık değil.'] };
        }
        // audit rows for this object (+ children whose audit entity is a different type)
        const ids = def.auditTypes.map((t) => ({ type: t, id }));
        if (kind === 'MACHINE')
            for (const t of await sel('maintenance_tickets', 'id', { machine_id: `eq.${id}` }, 'created_at.desc', 100))
                ids.push({ type: 'MAINTENANCE_TICKET', id: t.id });
        if (kind === 'PRODUCT') {
            for (const r of await sel('product_revisions', 'id', { product_id: `eq.${id}` }, undefined, 100)) {
                ids.push({ type: 'PRODUCT_REVISION', id: r.id });
            }
        }
        const audit = [];
        const byType = new Map();
        for (const x of ids)
            byType.set(x.type, [...(byType.get(x.type) ?? []), x.id]);
        for (const [type, list] of byType) {
            try {
                audit.push(...await sel('audit_log', 'id,at,actor_user_id,action,entity_type,entity_id,reason,before_state,after_state', { entity_type: `eq.${type}`, entity_id: inList(list) }, 'at.desc', 300));
            }
            catch (e) {
                notes.push(`Denetim kaydı okunamadı (${type}): ${errorText(e)}`);
            }
        }
        const nm = await names(uniq(audit.map((a) => a.actorUserId)));
        const events = audit.map((a) => auditToEvent(a, nm));
        const extra = async (label, fn, map) => { try {
            for (const r of await fn()) {
                const e = map(r);
                if (e)
                    events.push(e);
            }
        }
        catch (e) {
            if (!denied(e))
                notes.push(`${label}: ${errorText(e)}`);
        } };
        const st = (source, rid, at, action, entityId, from, to, actor, reason = null) => ({ id: `${source}:${rid}`, at, occurredAt: null, source, action, entityType: kind, entityId, actorId: actor, actorName: actor ? nm[actor] ?? null : null, fromState: from, toState: to, reason, changes: [], outcome: 'SUCCESS' });
        if (kind === 'MACHINE')
            await extra('Durum geçmişi', () => sel('machine_state_events', 'id,from_status,to_status,at,actor_user_id,category', { machine_id: `eq.${id}` }, 'at.desc', 300), (r) => st('STATE', r.id, r.at, 'MACHINE_STATE_EVENT', id, r.fromStatus, r.toStatus, r.actorUserId, r.category));
        if (kind === 'WORK_ORDER') {
            await extra('Durum olayları', () => sel('work_order_status_events', 'id,from_status,to_status,at', { work_order_id: `eq.${id}` }, 'at.desc', 300), (r) => st('WORK_ORDER', r.id, r.at, 'WORK_ORDER_STATUS_EVENT', id, r.fromStatus, r.toStatus, null));
            await extra('Üretim beyanları', () => sel('production_declarations', 'id,qty_good,qty_scrap,declared_at,declared_by', { work_order_id: `eq.${id}` }, 'declared_at.desc', 300), (r) => st('WORK_ORDER', r.id, r.declaredAt, 'PRODUCTION_DECLARATION', id, null, `${r.qtyGood} sağlam / ${r.qtyScrap} hurda`, r.declaredBy));
            await extra('Kalite HOLD', () => sel('quality_holds', 'id,reason,status,opened_at,opened_by,released_at,released_by,release_reason', { work_order_id: `eq.${id}` }, 'opened_at.desc', 100), (r) => st('QUALITY', r.id, r.openedAt, 'QUALITY_HOLD_OPENED', id, null, 'HOLD', r.openedBy, r.reason));
        }
        if (kind === 'TASK')
            await extra('Görev olayları', () => sel('task_events', 'id,event,actor_user_id,note,at', { task_id: `eq.${id}` }, 'at.desc', 200), (r) => st('TASK', r.id, r.at, `TASK_${r.event}`, id, null, r.event, r.actorUserId, r.note));
        if (kind === 'TOOL')
            await extra('Takım hareketleri', () => sel('tool_movements', 'id,from_location,to_location,moved_at,moved_by,reason', { tool_id: `eq.${id}` }, 'moved_at.desc', 300), (r) => st('TOOL', r.id, r.movedAt, 'TOOL_MOVEMENT', id, r.fromLocation, r.toLocation, r.movedBy, r.reason));
        if (kind === 'STOCK_LOT')
            await extra('Stok hareketleri', () => sel('stock_movements', 'id,from_state,to_state,reason,moved_at,moved_by', { stock_lot_id: `eq.${id}` }, 'moved_at.desc', 300), (r) => st('STOCK', r.id, r.movedAt, 'STOCK_MOVEMENT', id, r.fromState, r.toState, r.movedBy, r.reason));
        if (kind === 'MAINTENANCE_TICKET')
            await extra('Test sonuçları', () => sel('maintenance_test_results', 'id,result,notes,tested_by,tested_at', { ticket_id: `eq.${id}` }, 'tested_at.desc', 100), (r) => st('OTHER', r.id, r.testedAt, 'MAINTENANCE_TEST_RESULT', id, null, r.result, r.testedBy, r.notes));
        // The same fact can exist both as an audit row and as an event-table row (a status change writes both). Both are shown, labelled by source; they are never merged into a fabricated third record.
        const need = uniq(events.filter((e) => e.actorId && !e.actorName).map((e) => e.actorId));
        if (need.length) {
            const more = await names(need);
            for (const e of events)
                if (e.actorId && !e.actorName)
                    e.actorName = more[e.actorId] ?? null;
        }
        notes.push('Zaman: kayıt zamanı sunucu saatidir. Bu sürümün veritabanı, olayın gerçekleştiği (bildirilen) zamanı ayrı saklamaz; geç bildirim ayrımı BLOCKED (migration taslağı: docs/TEMPORAL_MIGRATION_DRAFT.md).');
        return { events, notes };
    }
    async function stateHistory(kind, id) {
        if (kind === 'MACHINE') {
            const m = await one('machines', 'created_at', id);
            const ev = await sel('machine_state_events', 'from_status,to_status,at', { machine_id: `eq.${id}` }, 'at.asc', 2000);
            return { createdAt: m.createdAt, label: 'Makine sağlık durumu', events: ev.map((e) => ({ at: e.at, from: e.fromStatus, to: e.toStatus })) };
        }
        if (kind === 'WORK_ORDER') {
            const w = await one('work_orders', 'created_at', id);
            const ev = await sel('work_order_status_events', 'from_status,to_status,at', { work_order_id: `eq.${id}` }, 'at.asc', 2000);
            return { createdAt: w.createdAt, label: 'İş emri durumu', events: ev.map((e) => ({ at: e.at, from: e.fromStatus, to: e.toStatus })) };
        }
        if (kind === 'STOCK_LOT') {
            const l = await one('stock_lots', 'created_at', id);
            const ev = await sel('stock_movements', 'from_state,to_state,moved_at', { stock_lot_id: `eq.${id}` }, 'moved_at.asc', 2000);
            return { createdAt: l.createdAt, label: 'Parti durumu', events: ev.map((e) => ({ at: e.movedAt, from: e.fromState, to: e.toState })) };
        }
        return null;
    }
    return {
        card, tab, timeline, stateHistory,
        async createTask(kind, id, input) {
            const src = KINDS[kind].taskSource;
            if (!src)
                throw new Error('TASK_SOURCE_NOT_SUPPORTED: bu nesne türüne görev bağlama kurulumu henüz yok');
            await client.rpc('create_task', { p_title: input.title, p_description: input.description, p_assignee_user: null, p_assignee_role: input.role, p_starts_at: null, p_due_at: null, p_source_type: src, p_source_id: id, p_requires_evidence: false, p_client_request_id: input.requestId }, session);
        },
        async reportMachineFault(machineId, reason, severity) { await client.rpc('report_machine_fault', { p_machine_id: machineId, p_reason: reason, p_severity: severity }, session); },
        async setMachineDown(machineId, reason, severity) { await client.rpc('set_machine_down', { p_machine_id: machineId, p_reason: reason, p_ticket_severity: severity }, session); },
        async ticketDecision(ticketId) {
            const rows = (await loadMaintenanceTests(client, session)).filter((r) => r.id === ticketId);
            return buildInbox({ commercial: [], purchaseRequests: [], purchaseOrders: [], tasks: [], maintenance: rows }, Date.now())[0] ?? null;
        },
        async decideTicket(item, decision, reason) { const call = rpcCall(item, decision, reason); await client.rpc(call.fn, call.params, session); },
        async transitionTicket(ticketId, toStatus) { await client.rpc('transition_maintenance_ticket', { p_ticket_id: ticketId, p_to_status: toStatus }, session); },
    };
}
