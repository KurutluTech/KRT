// KMI-CARD-004 — PASSPORT HUB (/kart?t=<KIND>&id=<id>&s=<topic>). ONE digital passport shell for every card family: fixed identity header → grouped topic pages (iPhone-Settings style).
// The hub owns no data. The header reads the object's canonical card (objectApi.card + the passport store photo); every topic reads its canonical table/RPC. A topic the person may not open is not listed.
import { createAssetApi } from '../assetApi.js';
import { h } from '../../../../packages/ui/src/h.js';
import { createObjectPassportApi } from '../objectPassportApi.js';
import { createPassportCardsApi } from '../passportCardsApi.js';
import { createProductWorkspaceApi } from '../productWorkspaceApi.js';
import { KINDS, HUB_KIND_LIST, objectHref } from '../passport/registry.js';
import { passportEmblem } from '../passport/passportHeader.js';
import { visualFor } from '../spindle.js';
import { renderPassportShell } from '../passport/shell.js';
import { photoSlot, UNKNOWN } from '../passport/kit.js';
import { errorText } from '../errorText.js';
import { STORE_KINDS, makeIo, isDenied, dt, day, nf, WO_TR, MACHINE_TR, MACHINE_TONE, TASK_TR, floorTasks, canManageTasks, pilotIdSet } from '../passport/topics/common.js';
import { pilotText } from '../pilotMark.js';
import { personnelTopics, PERSON_COLS, canSeePrivate } from '../passport/topics/personnel.js';
import { machineTopics, MACHINE_COLS } from '../passport/topics/machine.js';
import { productTopics } from '../passport/topics/product.js';
import { workOrderTopics, loadWoPassport } from '../passport/topics/workOrder.js';
import { taskTopics, withEvents, delayOf, mins } from '../passport/topics/task.js';
import { genericTopics } from '../passport/topics/generic.js';
/** Families that live in the hub. NCR and MAINTENANCE_TICKET are event records (own /nesne page, linked from their parents). */
export const HUB_KINDS = HUB_KIND_LIST;
export const isHubKind = (k) => !!k && HUB_KINDS.includes(k);
export const kartHref = (kind, id, topic) => `#/kart?t=${kind}&id=${encodeURIComponent(id)}${topic ? `&s=${topic}` : ''}`;
/** where a related-object link goes: hub families → the hub, event records → their own passport page */
export const hubHrefOf = (kind, id) => (isHubKind(kind) ? kartHref(kind, id) : objectHref(kind, id));
const initialsOf = (s) => s.split(/[\s·\-_/]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toLocaleUpperCase('tr-TR')).join('') || '?';
const pt = (label, value, extra = {}) => ({ label, value: value === undefined ? null : value, ...extra });
const ACTIVE_WO = ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED'];
export async function renderPassportHubScreen(container, deps, state) {
    const nowIso = deps.nowIso ?? (() => new Date().toISOString());
    const msg = (text, tid) => { container.replaceChildren(h('div', { class: 'kx', 'data-testid': tid, style: 'padding:16px' }, h('p', {}, text), h('a', { href: '#/', class: 'btn ghost' }, '‹ Ana sayfa'))); };
    if (!isHubKind(state.kind) || !state.id) {
        msg('Pasaport seçilmedi ya da tür bilinmiyor. Kart galerisinden açın.', 'ps-nokind');
        return;
    }
    const kind = state.kind;
    const id = state.id;
    const objectApi = createObjectPassportApi(deps.client, deps.session, deps.access, deps.myUserId);
    const cards = createPassportCardsApi(deps.client, deps.session);
    const io = makeIo(deps.client, deps.session);
    const reload = (b) => { void renderPassportHubScreen(container, deps, { ...state, banner: b ?? null }); };
    let card;
    try {
        card = kind === 'TASK' ? { kind, id, title: 'Görev', subtitle: '', status: null, kpis: [], links: [], createdAt: null } : await objectApi.card(kind, id);
    }
    catch (e) { // tasks are read through the Task Floor RPC (no direct table grant)
        if (isDenied(e)) {
            msg('Bu pasaport rolünüze açık değil.', 'ps-closed');
            return;
        }
        if (/KAYIT_BULUNAMADI/.test(errorText(e))) {
            msg('Kayıt bulunamadı.', 'ps-notfound');
            return;
        }
        msg(errorText(e), 'ps-error');
        return;
    }
    const own = kind === 'PERSONNEL' ? (await io.sel('personnel', 'auth_user_id', { id: `eq.${id}` }, undefined, 1).catch(() => []))[0]?.authUserId === deps.myUserId && !!deps.myUserId : false;
    // ---- store context (photo / attributes / documents) for the six store families
    const entity = STORE_KINDS[kind];
    let store = null;
    if (entity) {
        try {
            const pc = await cards.get(entity, id);
            store = { api: cards, type: entity, id, card: pc, label: pc.label, reload, notify: (k, text) => { const b = container.querySelector('[data-testid="ps-banner"]'); if (b) {
                    b.textContent = text;
                    b.setAttribute('data-kind', k);
                }
                else
                    reload({ kind: k, text }); } };
        }
        catch (e) {
            if (!isDenied(e))
                store = null;
        }
    }
    const productWs = kind === 'PRODUCT' ? createProductWorkspaceApi(deps.client, deps.session) : undefined;
    const topicHref = (t) => kartHref(kind, id, t);
    const ctx = { kind, id, access: deps.access, myUserId: deps.myUserId, own, card, objectApi, cards, store, hrefOf: hubHrefOf, topicHref, ...io, ...(productWs ? { productWs } : {}), ...(deps.trace ? { trace: deps.trace } : {}), reload, notify: (k, t) => reload({ kind: k, text: t }), nowIso };
    const head = { title: card.title, code: null, subtitle: card.subtitle, initials: initialsOf(card.title), shape: 'square', badges: [], headPoints: [] };
    let topics = [];
    const photoHost = photoSlot(initialsOf(card.title), kind === 'PERSONNEL' ? 'round' : 'square');
    let emblem = passportEmblem(kind);
    const toneOfPill = (t) => (t === 'ok' ? 'ok' : t === 'warn' ? 'warn' : t === 'bad' ? 'bad' : t === 'info' ? 'info' : 'mut');
    if (card.status)
        head.badges.push({ text: card.status.pill, tone: toneOfPill(card.status.tone) });
    head.headPoints = card.kpis.slice(0, 4).map((k) => pt(k.label, k.value === 'BİLİNMİYOR' ? null : k.value));
    const alerts = [];
    let accent = '#38bdf8';
    try {
        switch (kind) {
            case 'PERSONNEL': {
                const p = (await io.sel('personnel', PERSON_COLS, { id: `eq.${id}` }, undefined, 1))[0];
                if (!p) {
                    msg('Kayıt bulunamadı.', 'ps-notfound');
                    return;
                }
                const jobTitle = store?.card.attributes.find((a) => a.code === 'JOB_TITLE')?.value ?? null;
                head.title = p.name;
                head.code = p.employeeNo;
                head.subtitle = jobTitle;
                head.subtitleUnknown = 'İş unvanı doğrulanmamış (veri eksik)';
                head.shape = 'round';
                head.badges = [{ text: p.active ? 'AKTİF' : 'PASİF', tone: p.active ? 'ok' : 'bad' }];
                const [wos, tasks, custody] = await Promise.all([
                    io.sel('work_orders', 'id,status,machine_id', { operator_id: `eq.${id}`, status: `in.(${ACTIVE_WO.join(',')})` }, undefined, 20).catch(() => null),
                    own || canManageTasks(deps.access) ? floorTasks(ctx).catch(() => null) : Promise.resolve(null),
                    // KMI-ASSET-001: held assets come from the asset registry (server decides who may see a person's custody: self or asset manager); no copy, a count with a link
                    createAssetApi(deps.client, deps.session).personnelCustody(id).catch(() => null),
                ]);
                const myTasks = tasks === null ? null : (own ? tasks.filter((t) => t.assignedToMe) : tasks.filter((t) => t.assigneeLabel === p.name)).filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
                const lateTasks = (myTasks ?? []).filter((t) => t.isLate).length;
                head.headPoints = [pt('Bölüm', p.department), pt('Vardiya', p.shiftCode, { tone: p.shiftCode ? 'info' : 'mut' }), pt('Aktif iş emri', wos === null ? null : wos.length, { source: 'work_orders', asOf: dt(nowIso()), href: topicHref('is-emirleri'), tone: wos && wos.length ? 'info' : 'mut' }),
                    pt('Zimmetli varlık', custody === null ? null : custody.holding.length, { source: 'asset_registry', href: '#/varliklar', tone: custody && !p.active && custody.holding.length ? 'bad' : 'mut' }),
                    pt('Bekleyen görev', myTasks === null ? null : myTasks.length, { source: 'tasks', href: topicHref('gorevler'), tone: lateTasks ? 'bad' : 'mut' })];
                if (lateTasks)
                    alerts.push(`${lateTasks} görev hedef bitişini geçti`);
                if (custody && custody.pending.length)
                    alerts.push(`${custody.pending.length} bekleyen zimmet talebi`);
                if (custody && !p.active && custody.holding.length)
                    alerts.push(`Pasif kişide ${custody.holding.length} zimmetli varlık var — zimmet kapatılmalı`);
                if (!p.active)
                    alerts.push('Kişi pasif: sisteme giriş ve atama kapalı olmalı');
                topics = personnelTopics(ctx, p);
                void canSeePrivate;
                break;
            }
            case 'MACHINE': {
                const m = (await io.sel('machines', MACHINE_COLS, { id: `eq.${id}` }, undefined, 1))[0];
                if (!m) {
                    msg('Kayıt bulunamadı.', 'ps-notfound');
                    return;
                }
                head.title = card.title;
                head.code = m.code;
                const [wos, tk] = await Promise.all([
                    io.sel('work_orders', 'id,status,operator_id,planned_shift_code', { machine_id: `eq.${id}`, status: `in.(${ACTIVE_WO.join(',')})` }, undefined, 10).catch(() => null),
                    io.sel('maintenance_tickets', 'id,kind,status,reason', { machine_id: `eq.${id}`, status: 'in.(OPEN,IN_PROGRESS,TEST_PENDING)' }, 'created_at.desc', 5).catch(() => null),
                ]);
                const opIds = [...new Set((wos ?? []).map((w) => w.operatorId).filter((x) => !!x))];
                const ops = opIds.length ? await io.sel('personnel', 'id,name', { id: `in.(${opIds.join(',')})` }, undefined, 10).catch(() => []) : [];
                head.badges = [{ text: (MACHINE_TR[m.status] ?? m.status).toLocaleUpperCase('tr-TR'), tone: MACHINE_TONE[m.status] ?? 'mut' }];
                accent = visualFor(card.machineHeadline).color; // KMI-013: the accent follows the SAME canonical spindle colour (green running · blue idle · red fault · orange maintenance)
                head.headPoints = [pt('Aktif iş emri', wos === null ? null : wos.length, { source: 'work_orders', href: topicHref('aktif-is'), tone: wos && wos.length ? 'info' : 'mut' }), pt('Operatör', ops.length ? ops.map((o) => o.name).join(', ') : (wos && !wos.length ? '—' : null), { source: 'work_orders.operator_id' }),
                    pt('Açık bakım / arıza', tk === null ? null : tk.length, { source: 'maintenance_tickets', href: topicHref('bakim'), tone: tk && tk.length ? 'warn' : 'ok' }), pt('Toplam duruş', m.totalDownMinutes === null ? null : nf(m.totalDownMinutes, 'dk'), { source: 'machines.total_down_minutes' })];
                if (m.status === 'MAINTENANCE' || m.status === 'DOWN')
                    alerts.push(`${MACHINE_TR[m.status]}${tk && tk[0] ? `: ${tk[0].reason}` : ''}`);
                else if (tk && tk.length)
                    alerts.push(`${tk.length} açık bakım/arıza kaydı var`);
                head.machineNote = card.cncConnected ? 'Bu makinede CNC bağlantısı var: çalışma durumu CNC sinyalinden gelir (talaş kaldırma süresi değildir). Bakım / arıza / test yetkisi kayıtlı durumda kalır; CNC bunları değiştirmez.' : 'Kayıtlı durum elle girilir; CNC bağlantısı olmadığı için fiziksel çalışma doğrulanmaz.';
                emblem = passportEmblem(kind, card.machineHeadline);
                topics = machineTopics(ctx, m);
                break;
            }
            case 'PRODUCT': {
                const p = (await io.sel('products', 'id,code,name', { id: `eq.${id}` }, undefined, 1))[0];
                if (!p) {
                    msg('Kayıt bulunamadı.', 'ps-notfound');
                    return;
                }
                let ws = null;
                try {
                    ws = await productWs.load(id, null);
                }
                catch {
                    ws = null;
                }
                head.title = p.name;
                head.code = p.code;
                ctx.rev = ws?.revision?.id ?? null;
                const rev = ws?.revision ?? null;
                head.subtitle = [ws?.product.material, ws?.product.family].filter(Boolean).join(' · ') || null;
                head.subtitleUnknown = 'Malzeme / aile girilmemiş';
                const st = (s) => s ?? 'MISSING';
                const missing = ws ? [['Teknik resim', st(ws.cards.drawing?.state)], ['CAD/STEP', st(ws.cards.cad?.state)], ['CAM/NC', st(ws.cards.cam?.state)], ['Takım listesi', st(ws.cards.tools?.state)], ['BOM', ws.bom.length ? 'OK' : 'MISSING'], ['Rota', ws.routing.length ? 'OK' : 'MISSING'], ['Kalite planı', ws.quality.length ? 'OK' : 'MISSING']].filter(([, s]) => s === 'MISSING').map(([l]) => l) : [];
                head.badges = rev ? [{ text: rev.status === 'RELEASED' ? 'YÜRÜRLÜKTE' : rev.status === 'DRAFT' ? 'TASLAK' : 'ESKİ', tone: rev.status === 'RELEASED' ? 'ok' : rev.status === 'DRAFT' ? 'info' : 'mut' }] : [{ text: 'REVİZYON YOK', tone: 'warn' }];
                head.headPoints = [pt('Revizyon', rev ? `Rev ${rev.revision}` : null, { source: 'product_revisions', href: topicHref('kimlik') }), pt('Üretim serbest mi', rev ? (rev.status === 'RELEASED' ? 'Evet' : 'Hayır — serbest bırakılmadı') : null, { tone: rev?.status === 'RELEASED' ? 'ok' : 'warn' }),
                    pt('Eksik hazırlık', ws ? (missing.length ? missing.join(', ') : 'Yok') : null, { source: 'product workspace', tone: !ws ? 'mut' : missing.length ? 'warn' : 'ok', href: topicHref('kimlik') }), pt('Son sürüm', rev?.releasedAt ? day(rev.releasedAt) : null, { source: 'product_revisions.released_at' })];
                if (rev && rev.status === 'DRAFT')
                    alerts.push('Taslak revizyon: BOM, rota ve kalite planı tamamlanıp ayrı onayla yürürlüğe alınmadan üretime verilmez');
                topics = productTopics(ctx, p);
                break;
            }
            case 'WORK_ORDER': {
                const w = await loadWoPassport(ctx);
                const wo = w.workOrder;
                head.title = pilotText(`İE ${wo.id.slice(0, 8).toUpperCase()}`, (await pilotIdSet(ctx, [wo.id])).has(wo.id));
                head.code = w.product?.code ?? null;
                head.subtitle = w.product ? `${w.product.name}${w.revision ? ` · Rev ${w.revision.revision}` : ''}` : null;
                head.badges = [{ text: (WO_TR[wo.status] ?? wo.status).toLocaleUpperCase('tr-TR'), tone: wo.status === 'COMPLETED' ? 'ok' : wo.status === 'ON_HOLD' ? 'warn' : 'info' }];
                const due = w.order?.dueDate ?? null;
                const overdue = !!due && due < nowIso().slice(0, 10) && !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(wo.status);
                const last = w.timeline[w.timeline.length - 1];
                head.headPoints = [pt('İyi / planlanan', `${nf(wo.qtyProduced)} / ${nf(wo.qtyPlanned)}`, { source: 'work_orders', progress: { value: wo.qtyProduced, target: wo.qtyPlanned } }), pt('Fire', nf(wo.qtyScrap), { tone: wo.qtyScrap > 0 ? 'warn' : 'mut', source: 'work_orders.qty_scrap' }),
                    pt('Makine · operatör', w.machine ? `${w.machine.code}${w.operator ? ` · ${w.operator.name}` : ''}` : null, { href: topicHref('makine') }), pt('Termin', due ? `${day(due)}${overdue ? ' — GEÇTİ' : ''}` : null, { tone: overdue ? 'bad' : 'mut', source: 'order_items.due_date' })];
                if (overdue)
                    alerts.push('Termin tarihi geçti');
                if (w.qualityHolds.some((x) => x.status === 'OPEN'))
                    alerts.push('Açık kalite HOLD var');
                if (last)
                    head.lastEvent = `${WO_TR[last.to] ?? last.to} · ${dt(last.at)}`;
                topics = workOrderTopics(ctx, w);
                break;
            }
            case 'TASK': {
                const all = await floorTasks(ctx);
                const ft = (all ?? []).find((x) => x.id === id);
                if (!ft) {
                    msg('Kayıt bulunamadı ya da bu görevi görme yetkiniz yok.', 'ps-notfound');
                    return;
                }
                const ev = await ctx.rpc('task_history', { p_task_id: id }).catch(() => null);
                const t = withEvents(ft, ev);
                const dl = delayOf(t, nowIso());
                head.title = t.title;
                head.code = t.id.slice(0, 8).toUpperCase();
                head.subtitle = t.sourceType ?? 'Bağımsız görev';
                head.badges = [{ text: (TASK_TR[t.status] ?? t.status).toLocaleUpperCase('tr-TR'), tone: ['DONE', 'COMPLETED', 'APPROVED'].includes(t.status) ? 'ok' : t.status === 'CANCELLED' ? 'mut' : 'info' }];
                head.headPoints = [pt('Sorumlu', t.assigneeLabel ?? t.assigneeRole), pt('Hedef bitiş', t.dueAt ? dt(t.dueAt) : null, { source: 'task_floor.due_at' }),
                    pt(dl.state === 'LATE' ? 'Gecikme' : dl.state === 'EARLY' ? 'Erken bitti' : 'Kalan süre', dl.minutes === null ? null : mins(dl.minutes), { tone: dl.state === 'LATE' ? 'bad' : dl.state === 'EARLY' ? 'ok' : 'info', source: 'hesaplanan (gerçek zaman)' }), pt('Kanıt', t.requiresEvidence ? 'Zorunlu' : 'Gerekmiyor')];
                if (dl.state === 'LATE')
                    alerts.push(`Görev gecikti: ${mins(dl.minutes)}`);
                topics = taskTopics(ctx, t);
                break;
            }
            default:
                topics = genericTopics(ctx);
        }
    }
    catch (e) {
        if (isDenied(e)) {
            msg('Bu pasaport rolünüze açık değil.', 'ps-closed');
            return;
        }
        msg(errorText(e), 'ps-error');
        return;
    }
    // photo / logo from the passport store (never invented): swaps the initials/emblem
    const useSlot = !!store && kind !== 'MACHINE';
    if (store?.card.photo)
        void cards.content(store.card.photo.versionId).then((c) => { photoHost.fill(`data:${c.mimeType};base64,${c.contentBase64}`, card.title); if (kind === 'MACHINE') { /* machine keeps its spindle; photo is shown in the media topic */ } }).catch(() => undefined);
    const def = KINDS[kind];
    const listHref = { PERSONNEL: '#/personel', MACHINE: '#/makineler', PRODUCT: '#/urun-liste', WORK_ORDER: '#/is-emirleri', TASK: '#/gorevler', CUSTOMER: '#/musteriler', SUPPLIER: '#/tedarikciler', TOOL: '#/takim-kartlari', STOCK_LOT: '#/is-emirleri', ORDER: '#/siparisler', SHIPMENT: '#/is-emirleri' }[kind] ?? '#/';
    // opened from the Katalog Merkezi: "back" returns to that tab / search (sessionStorage set by the catalog on card click)
    let fromCatalog = null;
    if (kind === 'CUSTOMER' || kind === 'SUPPLIER' || kind === 'PRODUCT') {
        try {
            const v = sessionStorage.getItem('kmi.catalog.from');
            if (v && v.startsWith('#/katalog'))
                fromCatalog = v;
        }
        catch { /* storage unavailable */ }
    }
    const extra = head;
    const input = {
        kind, kindTr: def.tr, title: head.title, code: head.code ?? null, subtitle: head.subtitle ?? null, subtitleUnknown: extra.subtitleUnknown ?? 'Girilmemiş', initials: head.initials, shape: head.shape, accent,
        emblem: useSlot ? photoHost.el : emblem, badges: head.badges, headPoints: [...head.headPoints, ...(extra.lastEvent ? [pt('Son hareket', extra.lastEvent)] : [])].slice(0, 5), alerts,
        listHref: fromCatalog ?? listHref, listLabel: fromCatalog ? 'Katalog Merkezi' : def.plural, topics, active: state.topic ?? null, hrefFor: (tid) => kartHref(kind, id, tid), banner: state.banner ?? null,
        notes: [...(extra.machineNote ? [extra.machineNote] : []), `Kaynak: ${def.tr} kaydı ve bağlı kanonik tablolar · güncelleme ${dt(nowIso())}. Eksik veri sıfır sayılmaz; ${UNKNOWN} olarak gösterilir.`],
    };
    await renderPassportShell(container, input);
}
