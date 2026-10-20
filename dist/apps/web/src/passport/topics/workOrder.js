import { NA, dt, day, nf, link, pill, orNA, inList, kv, table, note, tabTopic, opt, renderSections, WO_TR, TASK_TR, isDenied, floorTasks } from './common.js';
import { h } from '../../../../../packages/ui/src/h.js';
import { sectionNode } from '../sections.js';
import { errorText } from '../../errorText.js';
import { machineStateOf, DATA_SOURCE_TR, HEADLINE_TR, STALE_TR, displayKey } from '../../../../../packages/domain/src/machineState.js';
import { spindleForState } from '../../spindle.js';
import { describeBlocker } from '../../woReadiness.js';
const EVENT_TR = { CREATED: 'İş emri açıldı', MACHINE_ASSIGNED: 'Makine atandı', PLAN_CHANGED: 'Plan / atama değişti', START: 'START — üretim başladı', RESUME: 'Devam (HOLD kalktı)', CONTINUE_AFTER_FIRST_PIECE: 'İlk parça sonrası devam',
    HOLD: 'HOLD / duruş', FIRST_PIECE_REQUESTED: 'İlk parça kaliteye gönderildi', FIRST_PIECE_APPROVED: 'İlk parça onaylandı', FINISH: 'FINISH — üretim bitti', FINAL_RELEASE: 'Nihai onay', CANCELLED: 'İptal', PRODUCTION_DECLARED: 'Üretim beyanı', CORRECTION: 'Düzeltme (bağlantılı kayıt)', STATUS_CHANGE: 'Durum değişti',
    OP_STARTED: 'Operasyon başladı', OP_FIRST_PIECE_APPROVED: 'Operasyon ilk parça onayı', OP_FIRST_PIECE_REJECTED: 'Operasyon ilk parça reddi', OP_OUTPUT_DECLARED: 'Operasyon beyanı', OP_RUN_FINISHED: 'Operasyon üretimi bitti', OP_QC_PASSED: 'Operasyon kalite GEÇTİ', OP_QC_FAILED: 'Operasyon kalite KALDI',
    OP_HELD: 'Operasyon duraklatıldı (iş emri HOLD)', OP_RESUMED: 'Operasyon devam etti', STOCK_LOT_CREATED: 'Stok lotu oluştu', STOCK_HOLD: 'Lot beklemeye alındı', STOCK_SCRAP: 'Lot hurdaya çıktı', STOCK_SHIPPED: 'Lot sevk edildi',
    COMMERCIAL_APPROVAL_REQUESTED: 'Ticari onay istendi', MANAGEMENT_RELEASE_GRANTED: 'Yönetim serbest bıraktı', COMMERCIAL_APPROVAL_APPROVED: 'Ticari onay verildi', COMMERCIAL_APPROVAL_REJECTED: 'Ticari onay reddedildi',
    SHIPMENT_CREATED: 'Sevkiyat açıldı', SHIPMENT_DISPATCHED: 'Sevk edildi', SHIPMENT_DELIVERED: 'Teslim edildi', SHIPMENT_CANCELLED: 'Sevkiyat iptal', INVOICE_CREATED: 'Fatura kesildi', INVOICE_PAID: 'Fatura tahsil edildi', PAYMENT_RECORDED: 'Tahsilat kaydı',
    NCR_OPENED: 'Uygunsuzluk (NCR) açıldı', NCR_REWORK: 'NCR: tashih', NCR_RECHECK_PENDING: 'NCR: tekrar kontrol', NCR_ACCEPTED: 'NCR: kabul', NCR_SCRAPPED: 'NCR: hurda', QUALITY_HOLD_OPENED: 'Kalite HOLD açıldı', QUALITY_HOLD_RELEASED: 'Kalite HOLD kalktı' };
const ROLE_TR = { OPERATOR: 'Operatör', QUALITY: 'Kalite', PLANNER: 'Planlama', MANAGEMENT: 'Yönetim', WAREHOUSE: 'Depo', SHIPPING: 'Sevkiyat', ACCOUNTING: 'Muhasebe', NONE: '—' };
const SCOPE_TR = { WORK_ORDER: 'İş emri', OPERATION: 'Operasyon', LOT: 'Stok lotu', SHIPMENT: 'Sevkiyat', INVOICE: 'Fatura', QUALITY: 'Kalite', ORDER_ITEM: 'Sipariş kalemi' };
const STOP_TR = { SETUP: 'Ayar / kurulum', TOOL: 'Takım', MATERIAL_WAIT: 'Malzeme bekleme', OTHER: 'Diğer', QUALITY_WAIT: 'Kalite bekleme', OPERATOR_CAUSED: 'Operatör kaynaklı', PLANNED_STOP: 'Planlı duruş', FAULT: 'Arıza', MAINTENANCE: 'Bakım', UNSPECIFIED: 'Neden belirtilmedi' };
const STALE_REASON_TR = { NO_ACTIVITY: 'Oturum için hiç hareket kaydı yok', INACTIVITY: 'Eşik süreden uzun süredir hareket yok', SHIFT_HANDOVER: 'Vardiya devrinden sonra hareket yok' };
const OP_TR = { PENDING: 'Bekliyor', FIRST_PIECE_PENDING: 'İlk parça onayı bekliyor', RUNNING: 'Üretimde', QC_PENDING: 'Kalite kontrol bekliyor', DONE: 'Bitti' };
const dur = (m) => (m === null || m === undefined ? NA : m >= 60 ? `${Math.floor(m / 60)} sa ${Math.round(m % 60)} dk` : `${Math.round(m)} dk`);
export const loadWoPassport = (ctx) => ctx.rpc('work_order_passport', { p_work_order_id: ctx.id });
const planner = (ctx) => ctx.access.owner || ctx.access.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT') || ctx.access.actions.includes('WORK_ORDER_ASSIGN_MACHINE') || ctx.access.actions.includes('MANAGEMENT_RELEASE');
export function workOrderTopics(ctx, w) {
    const T = (id, title, icon, group, extra = {}) => ({ id, title, icon, group, ...extra });
    const R = (id, title, icon, group, summary, load, extra = {}) => ({ ...T(id, title, icon, group, { summary, ...extra }), render: (host) => renderSections(ctx, host, load) });
    const wo = w.workOrder;
    const snaps = () => ctx.sel('work_order_resource_snapshots', 'id,version_no,captured_at,captured_by,capture_kind,reason,basis', { work_order_id: `eq.${ctx.id}` }, 'version_no.desc', 50);
    const ops = () => ctx.sel('work_order_operations', 'id,op_no,name,status,machine_id,operator_id,qty_in,qty_good,qty_scrap,started_at,first_piece_at,run_finished_at,qc_result,completed_at,cycle_seconds_target,setup_minutes_target,routing_version_no,cam_program_id,first_piece_required', { work_order_id: `eq.${ctx.id}` }, 'op_no', 80);
    return [
        R('genel', 'Genel bakış', 'clipboard', 'Genel', `${WO_TR[wo.status] ?? wo.status}`, async () => [
            kv('İş emri', [['Durum', pill(WO_TR[wo.status] ?? wo.status, wo.status === 'ON_HOLD' ? 'warn' : wo.status === 'COMPLETED' ? 'ok' : 'info')], ['Ürün', link('PRODUCT', w.product?.id, w.product ? `${w.product.code} · ${w.product.name}` : null)], ['Revizyon', w.revision ? `${w.revision.revision} (${w.revision.status})` : NA],
                ['Planlanan adet', nf(wo.qtyPlanned)], ['İyi (üretilen)', nf(wo.qtyProduced)], ['Fire', nf(wo.qtyScrap)], ['Makine', link('MACHINE', w.machine?.id, w.machine ? `${w.machine.code} · ${w.machine.name}` : null)], ['Operatör', link('PERSONNEL', w.operator?.id, w.operator?.name)],
                ['Plan', wo.plannedDate ? `${day(wo.plannedDate)}${wo.plannedShiftCode ? ` · ${wo.plannedShiftCode}` : ''}` : NA], ['Termin', w.order?.dueDate ? day(w.order.dueDate) : NA], ['Açılış', dt(wo.createdAt)]])
        ]),
        { ...T('akis', 'Canlı İş Akışı / İstasyon Geçmişi', 'clock', 'Üretim', { summary: 'Nerede? Neyi bekliyor?' }), render: async (host) => {
                let f;
                let t = null;
                try {
                    f = await ctx.rpc('work_order_flow', { p_work_order_id: ctx.id });
                }
                catch (e) {
                    host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': isDenied(e) ? 'ps-denied' : 'flow-pending' }, isDenied(e) ? 'Bu bölümü görme yetkiniz yok (sunucu reddetti).' : `Canlı iş akışı altyapısı (0121/0122) bu veritabanında henüz kurulu değil: ${errorText(e)}`));
                    return;
                }
                try {
                    t = await ctx.rpc('wo_time_breakdown', { p_work_order_id: ctx.id });
                }
                catch {
                    t = null;
                }
                // machine state through the SAME engine + spindle as every other machine surface (only when the live board is readable for this user)
                let mNode = null;
                if (w.machine) {
                    try {
                        const b = await ctx.rpc('live_board', { p_profile: 'OFFICE' });
                        const m = b.machines.find((x) => x.code === w.machine.code);
                        // ONE FACT -> ONE SOURCE: the same cnc_live_states verdict every other screen uses (no permission / not installed => operator-declared model)
                        try {
                            const rows = await ctx.rpc('cnc_live_states', {});
                            const r = rows.find((x) => x.machineCode === w.machine.code);
                            if (m && r)
                                m.cnc = r;
                        }
                        catch { /* operator-declared model */ }
                        if (m) {
                            const ms = machineStateOf(m);
                            mNode = h('div', { class: 'ps-mstate', 'data-testid': 'flow-machine-state', 'data-state': displayKey(ms), style: 'display:flex;align-items:center;gap:10px;margin:8px 0' }, spindleForState(ms, 44), h('div', {}, h('b', {}, `${w.machine.code} · ${ms.stale ? STALE_TR : HEADLINE_TR[ms.headline]}`), h('div', { class: 'ps-note' }, `Veri kaynağı: ${DATA_SOURCE_TR[ms.dataSource]} · fiziksel çalışma doğrulanmadı`)));
                        }
                    }
                    catch {
                        mNode = null;
                    }
                }
                const tone = f.onHold ? 'warn' : f.status === 'PRODUCTION_DONE' ? 'info' : f.stageLabel === 'Hazırlık eksik' ? 'bad' : 'ok';
                const waiting = f.waitingFor ?? NA;
                const head = kv('Şu an', [['Aşama', pill(f.stageLabel, tone)], ['İstasyon', pill(f.stationTr, f.onHold ? 'warn' : f.status === 'PRODUCTION_DONE' ? 'info' : 'ok')], ['Ne zamandır burada', f.since ? `${dt(f.since)} (${dur(f.minutesHere)})` : NA], ['Neyi bekliyor', waiting],
                    ['Kimden işlem bekleniyor', f.waitingOnRole ? `${ROLE_TR[f.waitingOnRole] ?? f.waitingOnRole}${f.waitingOnPerson ? ` · ${f.waitingOnPerson}` : ''}` : NA], ['Son işlem', `${EVENT_TR[f.lastAction.type] ?? f.lastAction.type ?? NA} · ${orNA(f.lastAction.by)} · ${dt(f.lastAction.at)}`],
                    ['Sonraki istasyon', orNA(f.nextStationTr)], ['HOLD', f.onHold ? pill(f.holdKind === 'FAULT' ? 'Arıza' : f.holdKind === 'MAINTENANCE' ? 'Bakım' : f.holdKind === 'QUALITY' ? 'Kalite HOLD' : 'HOLD', 'warn') : 'Yok'],
                    ['Gecikme', f.late === null ? 'BİLİNMİYOR (ticari termin bu role açık değil)' : f.late ? pill('Gecikti', 'bad') : 'Yok'],
                    ...(f.explain ? [['Not', f.explain]] : []),
                    ...(f.staleReason ? [['Oturum', pill(`BAYAT · ${STALE_REASON_TR[f.staleReason] ?? f.staleReason}`, 'warn')]] : []),
                    ...(f.tashihReviewPending ? [['Tashih', pill('Kalite incelemesi bekleniyor', 'warn')]] : [])], 'Kaynak: değiştirilemez iş emri olay günlüğü · saatler Türkiye saati · bayat oturum asla otomatik bitirilmez');
                const gaps = [...f.blockers.map((c) => describeBlocker(c, ctx.id)), ...f.planGaps.map((c) => describeBlocker(c, ctx.id))];
                const prep = gaps.length ? table(`Hazırlık eksikleri (${f.blockers.length} engel${f.planGaps.length ? ` · ${f.planGaps.length} plan boşluğu` : ''})`, ['Eksik', 'Ayrıntı', 'Nerede düzeltilir'], gaps.map((g) => [g.title, orNA(g.detail), g.fix && g.fix.type === 'link' ? `${g.fixLabel ?? 'Git'} → ${g.fix.href.replace(/^#\//, '')}` : orNA(g.fixLabel)]), 'Sunucunun kanonik hazırlık kuralı (work_order_readiness / start önizlemesi) — burada ikinci bir kural yok') : null;
                const ops = f.operations.length ? table('Operasyonlar', ['Op', 'Ad', 'Durum', 'Makine', 'Operatör', 'Giren', 'Sağlam', 'Fire', 'Tashih / vakada', 'Başladı', 'İlk parça', 'Üretim bitti', 'Kalite', 'Tamamlandı'], f.operations.map((o) => [`${o.opNo}`, o.name, `${OP_TR[o.status] ?? o.status}${o.held ? ' · HOLD (iş emri bekletmede)' : ''}`, orNA(o.machineCode), orNA(o.operator), nf(o.qtyIn), nf(o.qtyGood), nf(o.qtyScrap), o.qtyTashih === undefined ? NA : `${nf(o.qtyTashih)} / ${nf(o.ncrOpen ?? 0)}`, o.startedAt ? dt(o.startedAt) : NA,
                    o.firstPieceAt ? dt(o.firstPieceAt) : NA, o.runFinishedAt ? dt(o.runFinishedAt) : NA, o.qcResult ? `${o.qcResult === 'PASS' ? 'Geçti' : 'Kaldı'} · ${o.qcAt ? dt(o.qcAt) : ''}` : NA, o.completedAt ? dt(o.completedAt) : NA]), 'Rotalı iş emri: START / beyan / FINISH operasyon düzeyindedir') : null;
                const q = f.quantities;
                const qty = kv('Miktarlar (ayrı kovalar — hiçbiri iki kez sayılmaz)', [['Planlanan', nf(q.planned)], ['Sağlam (iyi)', nf(q.good)], ['Fire (hurda)', nf(q.scrap)], ['Tashih beyanı (hurda DEĞİL)', nf(q.tashihDeclared)],
                    ['NCR: açık / tashihte / tekrar kontrol', `${nf(q.ncr.open)} / ${nf(q.ncr.rework)} / ${nf(q.ncr.recheckPending)}`], ['NCR: kabul / hurda', `${nf(q.ncr.accepted)} / ${nf(q.ncr.scrapped)}`], ['Kontrol bekleyen', q.pendingControl > 0 ? pill(`${nf(q.pendingControl)} adet`, 'warn') : '0'],
                    ['Hedefe kalan', nf(q.remainingToTarget)], ...(q.reworkAccountingReview ? [['Uyarı', pill('Kabul edilen tashihin iyi adede yansıması Kalite tarafından doğrulanmalı', 'warn')]] : [])], q.note);
                const dsn = f.downstream ? kv('Depo · ticari · sevkiyat · muhasebe', [['Aşama', pill(f.downstream.stationTr, f.downstream.stage === 'DONE' ? 'ok' : 'info')], ['Departman', f.downstream.department], ['Neyi bekliyor', orNA(f.downstream.waitingFor)],
                    ['Kimden', f.downstream.waitingOnRole ? ROLE_TR[f.downstream.waitingOnRole] ?? f.downstream.waitingOnRole : NA], ['Sonraki', orNA(f.downstream.nextStationTr)], ['Kayıt kapsamı', f.downstream.scopeNote]], f.commercialHidden ? 'Ticari aşamalar bu role genel "Ticari süreç" olarak gösterilir.' : undefined) : null;
                const times = t ? kv('Süreler (beyan esaslı — fiziksel kesme süresi DEĞİL)', [['Beyan edilen çalışma', dur(t.declaredRunMinutes)], ['Beyan edilen duruş (HOLD)', dur(t.declaredStopMinutes)],
                    ...Object.entries(t.stopMinutesByReason ?? {}).map(([c, m]) => [`  · ${STOP_TR[c] ?? c}`, dur(m)]),
                    ['Ayar (kurulum + ilk parça bekleme, beyan)', dur(t.setupMinutesDeclared)], ['İlk parça onay bekleme', dur(t.firstPieceWaitMinutes)], ['Kalite kontrol bekleme', dur(t.qcWaitMinutes)],
                    ['İstasyon bekleme (makine süresine EKLENMEZ)', dur(t.stationWaitMinutes)], ...(t.routed ? [['  · operasyonlar arası bekleme', dur(t.betweenOperationsMinutes)]] : []),
                    ['Bilinmeyen süre (bayat oturum — üretim sayılmaz)', dur(t.unknownMinutes)],
                    ...Object.entries(t.runMinutesByShift ?? {}).map(([c, m]) => [`Vardiya dağılımı · ${c === 'OUT_OF_SHIFT' ? 'Vardiya dışı' : c}`, dur(m)]),
                    ...(t.operations ?? []).map((o) => [`Operasyon ${o.opNo}`, `çalışma ${dur(o.runMinutes)} · ilk parça ${dur(o.firstPieceWaitMinutes)} · kalite ${dur(o.qcWaitMinutes)}${o.unknownMinutes ? ` · bilinmeyen ${dur(o.unknownMinutes)}` : ''}`]),
                    ['Planlanan', dur(t.plannedMinutes)], ['Planlanan – beyan farkı', t.plannedVsDeclaredMinutes === null ? NA : `${t.plannedVsDeclaredMinutes > 0 ? '+' : ''}${t.plannedVsDeclaredMinutes} dk`],
                    ...(t.operatorLoad ? [['Operatörün şu an açık oturumu', `${t.operatorLoad.activeSessions} / ${t.operatorLoad.cap}${t.operatorLoad.atCap ? ' (sınırda)' : ''}`]] : []),
                    ['Veri kaynağı / güvenilirlik', `${DATA_SOURCE_TR[t.dataSource] ?? t.dataSource} · beyan, doğrulanmadı`], ['OEE / fiziksel kullanım', 'ÖLÇÜLMEDİ (spindle / kesme süresi doğrulanmadı)']], t.note) : null;
                const hist = table('İstasyon geçmişi (en yeni üstte)', ['Zaman', 'Kapsam', 'Olay', 'Önce → Sonra', 'İstasyon', 'Makine', 'Kim', 'Miktar', 'Bekleme nedeni / not'], f.history.map((e) => [dt(e.at), `${SCOPE_TR[e.scope] ?? e.scope}${e.opNo ? ` ${e.opNo}` : ''}`, `${EVENT_TR[e.eventType] ?? e.eventType}${e.correctionOf ? ` (#${e.correctionOf} için)` : ''}`, e.toStatus ? `${e.fromStatus ? (WO_TR[e.fromStatus] ?? OP_TR[e.fromStatus] ?? e.fromStatus) : '—'} → ${WO_TR[e.toStatus] ?? OP_TR[e.toStatus] ?? e.toStatus}` : NA, orNA(e.department),
                    orNA(e.machineCode), orNA(e.actor), e.qtyGood !== null || e.qtyScrap !== null || e.qtyTashih !== null ? `sağlam ${e.qtyGood ?? 0} · fire ${e.qtyScrap ?? 0}${e.qtyTashih ? ` · tashih ${e.qtyTashih}` : ''}` : NA,
                    orNA([e.reasonCode ? STOP_TR[e.reasonCode] ?? e.reasonCode : null, e.waitReason, e.note].filter(Boolean).join(' · ') || null)]), 'Olay yok');
                host.replaceChildren(h('div', { class: 'ps-page', 'data-testid': 'flow' }, mNode, sectionNode(head, ctx.hrefOf), prep ? sectionNode(prep, ctx.hrefOf) : null, ops ? sectionNode(ops, ctx.hrefOf) : null, sectionNode(qty, ctx.hrefOf), dsn ? sectionNode(dsn, ctx.hrefOf) : null, times ? sectionNode(times, ctx.hrefOf) : null, sectionNode(hist, ctx.hrefOf)));
            } },
        tabTopic(ctx, T('urun', 'Ürün ve teknik revizyon', 'box', 'Teknik', { summary: w.revision ? `Rev ${w.revision.revision}` : 'Revizyon bağlı değil' }), 'genel'),
        tabTopic(ctx, T('rota', 'Operasyon ve rota', 'factory', 'Teknik', { summary: 'Operasyonlar' }), 'operasyonlar'),
        { ...T('kunye', 'Kaynak planlama künyesi', 'layers', 'Kaynak', { summary: 'Planın dayanağı (sürümlü)' }), render: async (host) => {
                const draw = async (banner) => {
                    let list = [];
                    try {
                        list = await snaps();
                    }
                    catch (e) {
                        if (isDenied(e)) {
                            host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'ps-denied' }, 'Bu bölümü görme yetkiniz yok (sunucu reddetti).'));
                            return;
                        }
                        host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'kunye-pending' }, `Künye altyapısı (0117) bu veritabanında henüz kurulu değil: ${errorText(e)}`));
                        return;
                    }
                    const cur = list[0];
                    const prev = list[1];
                    const secs = list.length ? [
                        kv(`Güncel künye · sürüm ${cur.versionNo}`, [['Kaydedilme', dt(cur.capturedAt)], ['Kaynak', cur.captureKind === 'PLAN_DECISION' ? 'Plan kararı (otomatik)' : 'Elle kayıt'], ['Gerekçe', orNA(cur.reason)], ...basisRows(cur.basis)]),
                        ...(prev ? [kv(`Önceki sürüm ${prev.versionNo} ile fark`, diffRows(prev.basis, cur.basis), 'Önceki sürümler silinmez ve değişmez.')] : []),
                        table('Tüm sürümler', ['Sürüm', 'Zaman', 'Tür', 'Makine', 'Operatör', 'Vardiya', 'CAM'], list.map((s) => [`v${s.versionNo}`, dt(s.capturedAt), s.captureKind === 'PLAN_DECISION' ? 'Plan kararı' : 'Elle', orNA(s.basis.machine?.code), orNA(s.basis.operator?.name), orNA(s.basis.shift?.code ?? s.basis.planned?.shiftCode), s.basis.camProgram ? `${s.basis.camProgram.programNo} r${s.basis.camProgram.revision}` : NA]), 'Künye yok')
                    ] : [note('Künye yok', 'Bu iş emri için henüz künye kaydedilmedi. Plan kararı verildiğinde otomatik, ya da yetkili kişi elle kaydeder. Eksik künye 0 veya tahmin ile doldurulmaz.')];
                    const box = h('div', { class: 'ps-page', 'data-testid': 'kunye' }, banner ? h('div', { class: 'ps-banner ok', 'data-testid': 'kunye-banner' }, banner) : null, ...secs.map((s) => sectionNode(s, ctx.hrefOf)));
                    if (planner(ctx)) {
                        const reason = h('input', { 'data-testid': 'kunye-reason', placeholder: 'Gerekçe (en az 5 karakter)', maxlength: 300 });
                        const msg = h('div', { class: 'ps-note', 'data-testid': 'kunye-msg' });
                        const go = h('button', { type: 'button', class: 'btn primary sm', 'data-testid': 'kunye-capture', onClick: () => {
                                if (reason.value.trim().length < 5) {
                                    msg.textContent = 'Gerekçe en az 5 karakter olmalı';
                                    return;
                                }
                                void ctx.rpc('wo_resource_snapshot_capture', { p_wo: ctx.id, p_reason: reason.value.trim() }).then(() => draw('Yeni künye sürümü kaydedildi; önceki sürümler korundu.')).catch((e) => { msg.textContent = errorText(e); });
                            } }, 'Şu anki planı künyeye kaydet');
                        box.append(h('section', { class: 'ps-panel' }, h('div', { class: 'ps-panel-h' }, h('h2', {}, 'Elle künye kaydı')), reason, go, msg));
                    }
                    host.replaceChildren(box);
                };
                await draw();
            } },
        R('hammadde', 'Hammadde ve stok tahsisi', 'cart', 'Kaynak', 'Gereken / tahsis / sarf', async () => {
            const [ms, passport] = await Promise.all([ctx.rpc('work_order_material_status', { p_work_order_id: ctx.id }), opt(ctx.sel('material_movements', 'stock_lot_id,kind,qty,at', { work_order_id: `eq.${ctx.id}` }, 'at.desc', 80))]);
            return [table('Malzeme durumu (work_order_material_status)', ['Malzeme', 'Gereken', 'Rezerve', 'Verilen', 'Sarf', 'Karşılanan', 'Eksik'], ms.map((m) => [m.materialCode, nf(m.required), nf(m.reserved), nf(m.issued), nf(m.consumed), nf(m.covered), m.shortage > 0 ? pill(nf(m.shortage), 'bad') : nf(m.shortage)]), 'Malzeme gereksinimi tanımlı değil (BOM yok ya da iş emri adedi yok)'),
                table('Parti hareketleri', ['Zaman', 'Tür', 'Parti', 'Adet'], (passport ?? []).map((x) => [dt(x.at), x.kind, link('STOCK_LOT', x.stockLotId, x.stockLotId.slice(0, 8)), nf(x.qty)]), 'Bu iş emrine parti hareketi yok')];
        }),
        R('makine', 'Makine atamaları', 'cnc', 'Kaynak', w.machine ? `${w.machine.code}` : 'Atanmamış', async () => {
            const dec = await opt(ctx.sel('work_order_plan_decisions', 'machine_id,planned_date,planned_shift_code,planned_minutes,reason,decided_at', { work_order_id: `eq.${ctx.id}` }, 'decided_at.desc', 30));
            const ids = [...new Set((dec ?? []).map((d) => d.machineId).filter((x) => !!x))];
            const ms = ids.length ? await opt(ctx.sel('machines', 'id,code,name', { id: inList(ids) })) : [];
            const mm = new Map((ms ?? []).map((m) => [m.id, m]));
            return [kv('Şu anki makine', [['Makine', link('MACHINE', w.machine?.id, w.machine ? `${w.machine.code} · ${w.machine.name}` : null)]]),
                table('Plan kararları', ['Zaman', 'Makine', 'Gün / vardiya', 'Planlı dk', 'Gerekçe'], (dec ?? []).map((d) => [dt(d.decidedAt), link('MACHINE', d.machineId, d.machineId ? mm.get(d.machineId)?.code : null), `${d.plannedDate ? day(d.plannedDate) : NA}${d.plannedShiftCode ? ` · ${d.plannedShiftCode}` : ''}`, d.plannedMinutes === null ? NA : nf(d.plannedMinutes), orNA(d.reason)]), 'Plan kararı yok'),
                note('Kural', 'Bir makinede aynı anda tek aktif üretim oturumu olur; bir operatör birden çok makineyi yönetebilir.')];
        }),
        R('personel', 'Personel ve vardiya atamaları', 'users', 'Kaynak', w.operator?.name ?? 'Atanmamış', async () => {
            const dec = await opt(ctx.sel('work_order_plan_decisions', 'operator_id,planned_shift_code,followed_suggestion,warnings,decided_at', { work_order_id: `eq.${ctx.id}` }, 'decided_at.desc', 30));
            const o = await ops();
            const ids = [...new Set([...(dec ?? []).map((d) => d.operatorId), ...o.map((x) => x.operatorId)].filter((x) => !!x))];
            const ps = ids.length ? await opt(ctx.sel('personnel', 'id,name', { id: inList(ids) })) : [];
            const pm = new Map((ps ?? []).map((p) => [p.id, p.name]));
            return [kv('Şu anki operatör', [['Operatör', link('PERSONNEL', w.operator?.id, w.operator?.name)], ['Vardiya', orNA(wo.plannedShiftCode)]]),
                table('Operasyon bazlı operatörler', ['Op', 'Operatör', 'Makine'], o.map((x) => [`OP${x.opNo}`, link('PERSONNEL', x.operatorId, x.operatorId ? pm.get(x.operatorId) : null), link('MACHINE', x.machineId, x.machineId ? 'Makine' : null)]), 'Operasyon yok'),
                table('Atama kararları', ['Zaman', 'Operatör', 'Vardiya', 'Öneriye uyuldu mu'], (dec ?? []).map((d) => [dt(d.decidedAt), link('PERSONNEL', d.operatorId, d.operatorId ? pm.get(d.operatorId) : null), orNA(d.plannedShiftCode), d.followedSuggestion === null ? NA : d.followedSuggestion ? 'Evet' : 'Hayır']), 'Atama kararı yok')];
        }),
        R('cam', 'CAM programı ve revizyonu', 'chip', 'Teknik', w.camProgram ? `${w.camProgram.programNo} r${w.camProgram.revision}` : 'Bağlı değil', async () => {
            const tl = w.camProgram ? await opt(ctx.sel('cam_program_tools', 'tool_type,qty', { cam_program_id: `eq.${w.camProgram.id}` }, 'tool_type', 100)) : [];
            return [kv('CAM programı', w.camProgram ? [['Program', w.camProgram.programNo], ['Revizyon', w.camProgram.revision], ['Durum', w.camProgram.status], ['İdeal çevrim', w.camProgram.idealCycleSeconds === null ? NA : nf(w.camProgram.idealCycleSeconds, 'sn')], ['Ürün', link('PRODUCT', w.product?.id, w.product?.code)]] : [['Durum', 'Bu iş emrine CAM programı bağlı değil']]),
                table('Programın takım türleri', ['Takım türü', 'Adet'], (tl ?? []).map((t) => [t.toolType, nf(t.qty)]), 'Takım listesi yok')];
        }),
        R('takim', 'Takım listesi ve revizyonu', 'wrench', 'Teknik', 'Hazırlık ve hareket', async () => {
            const ts = await opt(ctx.rpc('work_order_tool_status', { p_work_order_id: ctx.id }));
            return [table('Takım hazırlığı (work_order_tool_status)', ['Takım türü', 'Gereken', 'Hazır (makinede)', 'Durum'], (ts ?? []).map((t) => [t.toolType, nf(t.required), nf(t.mountedUsable), t.ready ? pill('Hazır', 'ok') : pill('Eksik', 'warn')]), 'Takım gereksinimi yok'),
                table('Bu iş emrinde takım hareketleri', ['Zaman', 'Takım', 'Nereden', 'Nereye'], w.tools.map((t) => [dt(t.at), t.code, orNA(t.from), orNA(t.to)]), 'Takım hareketi yok')];
        }),
        R('sureler', 'Planlanan çevrim ve hazırlık süreleri', 'clock', 'Teknik', 'Rota hedefleri', async () => {
            const o = await ops();
            return [table('Operasyon hedefleri (iş emri anındaki rota sürümü)', ['Op', 'Ad', 'Rota sürümü', 'Çevrim (sn)', 'Hazırlık (dk)'], o.map((x) => [`OP${x.opNo}`, x.name, orNA(x.routingVersionNo), x.cycleSecondsTarget === null ? NA : nf(x.cycleSecondsTarget), x.setupMinutesTarget === null ? NA : nf(x.setupMinutesTarget)]), 'Operasyon yok')];
        }),
        // KMI-013: operation job card traceability at passport level — one row per operation with its trace code, QR identity (NOT an authority), routing version, who/where, quantities, and a direct link to that operation on the job card.
        (() => {
            const base = R('izlenebilirlik', 'İş kartı ve operasyon izlenebilirliği', 'clipboard', 'Üretim', 'Her operasyonun iz kodu ve iş kartı', async () => {
                const o = await ops();
                return [table('Operasyon izi', ['Op', 'Ad', 'İz kodu', 'QR kimliği', 'Rota sürümü', 'Durum', 'Makine', 'Operatör', 'Giren', 'İyi', 'Fire'], o.map((x) => [`OP${x.opNo}`, x.name, `${ctx.id.slice(0, 8)}/OP${x.opNo}`, `KMI:OP:${x.id}`, orNA(x.routingVersionNo), x.status, link('MACHINE', x.machineId, x.machineId ? 'Makine' : null), link('PERSONNEL', x.operatorId, x.operatorId ? 'Operatör' : null), x.qtyIn === null ? NA : nf(x.qtyIn), x.qtyGood === null ? NA : nf(x.qtyGood), x.qtyScrap === null ? NA : nf(x.qtyScrap)]), 'Bu iş emrinde rota operasyonu yok (tek adımlı iş emri).'),
                    note('QR hakkında', 'Operasyon QR’ı yalnızca kimliktir: taramak işlem başlatmaz ve yetki vermez. İşlem için oturum açmış, yetkili bir kullanıcı gerekir; her tarama merkezi tarama kaydına yazılır.')];
            });
            return { ...base, render: async (host) => {
                    await base.render(host);
                    let o = [];
                    try {
                        o = await ops();
                    }
                    catch { /* the table above already reported it */ }
                    host.append(h('section', { class: 'ps-panel', 'data-testid': 'ps-opcard-links' }, h('div', { class: 'ps-panel-h' }, h('h2', {}, 'İş kartında aç')), h('a', { class: 'ps-trow', href: `#/is-karti?is=${ctx.id}`, 'data-testid': 'ps-jobcard-link' }, h('span', {}), h('span', {}, h('div', { class: 'ps-tt' }, 'İş kartının tamamı'))), ...o.map((x) => h('a', { class: 'ps-trow', href: `#/is-karti?is=${ctx.id}&op=${x.id}`, 'data-testid': 'ps-opcard-link', 'data-op': `OP${x.opNo}` }, h('span', {}), h('span', {}, h('div', { class: 'ps-tt' }, `OP${x.opNo} ${x.name}`), h('div', { class: 'ps-ts' }, `${ctx.id.slice(0, 8)}/OP${x.opNo}`))))));
                } };
        })(),
        R('uretim', 'Gerçekleşen üretim', 'factory', 'Üretim', `${nf(wo.qtyProduced)} / ${nf(wo.qtyPlanned)}`, async () => {
            const o = await ops();
            return [kv('Toplam', [['İyi (beyan)', nf(w.declarations.good)], ['Fire (beyan)', nf(w.declarations.scrap)], ['Beyan sayısı', nf(w.declarations.count)], ['İlk parça', w.declarations.firstPieceAt ? dt(w.declarations.firstPieceAt) : NA]], 'Kaynak: production_declarations (yalnız beyan; düzeltmeler ayrı satırda).'),
                table('Operasyon bazlı', ['Op', 'Giren', 'İyi', 'Fire', 'Durum'], o.map((x) => [`OP${x.opNo} ${x.name}`, x.qtyIn === null ? NA : nf(x.qtyIn), x.qtyGood === null ? NA : nf(x.qtyGood), x.qtyScrap === null ? NA : nf(x.qtyScrap), x.status]), 'Operasyon yok'),
                table('Düzeltmeler', ['Zaman', 'İyi Δ', 'Fire Δ', 'Gerekçe'], w.corrections.map((c) => [dt(c.at), nf(c.goodDelta), nf(c.scrapDelta), c.reason]), 'Düzeltme yok')];
        }),
        R('durus', 'Duruşlar ve kayıp nedenleri', 'stop', 'Üretim', 'Durum ve makine olayları', async () => {
            const ev = w.machine ? await opt(ctx.sel('machine_state_events', 'from_status,to_status,at,category', { machine_id: `eq.${w.machine.id}`, at: `gte.${wo.createdAt}` }, 'at.desc', 60)) : [];
            return [table('İş emri durum geçişleri', ['Zaman', 'Önce', 'Sonra', 'Makine', 'Operatör'], w.timeline.map((t) => [dt(t.at), orNA(t.from), WO_TR[t.to] ?? t.to, orNA(t.machineCode), orNA(t.operatorName)]), 'Durum geçişi yok'),
                table('Makine durum olayları (iş emri açılışından beri)', ['Zaman', 'Önce', 'Sonra', 'Kategori'], (ev ?? []).map((e) => [dt(e.at), orNA(e.fromStatus), e.toStatus, orNA(e.category)]), w.machine ? 'Makine durum olayı yok' : 'Makine atanmamış'), note('Kayıp nedenleri', 'Kayıp dakikaları makine pasaportundaki "Duruşlar" sayfasında oee_rollup ile hesaplanır; burada ayrı hesap yapılmaz.')];
        }),
        tabTopic(ctx, T('kalite', 'Kalite ve ilk parça', 'shield', 'Kalite', { summary: `${w.ncrs.length} NCR · ${w.qualityHolds.filter((x) => x.status === 'OPEN').length} açık HOLD`, tone: w.qualityHolds.some((x) => x.status === 'OPEN') ? 'bad' : undefined }), 'kalite'),
        tabTopic(ctx, T('belgeler', 'Belgeler ve kanıtlar', 'file', 'Evrak', { summary: 'İş emri belgeleri' }), 'belgeler'),
        R('gorevler', 'Görevler ve onaylar', 'tasks', 'Evrak', 'Bu iş emrine bağlı görevler', async () => {
            const all = await floorTasks(ctx);
            if (all === null)
                return [note('Görevler', 'Görev listesi okunamadı (Görev Zemini RPC).')];
            const ts = all.filter((t) => t.sourceType === 'WORK_ORDER' && t.sourceId === ctx.id);
            return [table('Bağlı görevler', ['Görev', 'Durum', 'Hedef bitiş', 'Gecikme'], ts.map((t) => [link('TASK', t.id, t.title), TASK_TR[t.status] ?? t.status, dt(t.dueAt), t.dueAt ? (t.isLate ? pill('Gecikti', 'bad') : pill('Zamanında', 'ok')) : NA]), 'Bu iş emrine bağlı (sizin görebildiğiniz) görev yok')];
        }),
        R('karsilastirma', 'Planlanan / gerçekleşen karşılaştırma', 'chart', 'Üretim', 'Adet ve süre', async () => {
            const o = await ops();
            const planned = o.reduce((a, x) => a + (x.cycleSecondsTarget !== null ? (x.cycleSecondsTarget * wo.qtyPlanned) / 60 : 0) + (x.setupMinutesTarget ?? 0), 0);
            const allTargets = o.length > 0 && o.every((x) => x.cycleSecondsTarget !== null);
            const real = o.filter((x) => x.startedAt && x.runFinishedAt).reduce((a, x) => a + (Date.parse(x.runFinishedAt) - Date.parse(x.startedAt)) / 60000, 0);
            const doneAll = o.length > 0 && o.every((x) => x.startedAt && x.runFinishedAt);
            return [kv('Adet', [['Planlanan', nf(wo.qtyPlanned)], ['Gerçekleşen iyi', nf(wo.qtyProduced)], ['Tamamlanma', wo.qtyPlanned > 0 ? `% ${nf((wo.qtyProduced / wo.qtyPlanned) * 100)}` : NA]]),
                kv('Süre (dakika)', [['Hedef (rota: çevrim × adet + hazırlık)', allTargets ? nf(planned) : NA], ['Gerçekleşen (başla→bitir)', doneAll ? nf(real) : NA]], 'Hedef yalnız TÜM operasyonların çevrim süresi tanımlıysa hesaplanır; gerçek süre yalnız tüm operasyonlar başlayıp bittiyse. Aksi halde BİLİNMİYOR.')];
        }),
        tabTopic(ctx, T('olaylar', 'Olay ve değişiklik geçmişi', 'layers', 'Geçmiş', { summary: 'Zaman çizelgesi' }), 'zaman'),
    ];
}
const KEYS = [
    ['Makine', (b) => (b.machine ? `${b.machine.code} · ${b.machine.name}` : NA)], ['Operatör', (b) => b.operator?.name ?? NA], ['Vardiya', (b) => (b.shift ? `${b.shift.code} · ${b.shift.label}` : (b.planned?.shiftCode ?? NA))],
    ['Plan günü', (b) => (b.planned?.date ? day(b.planned.date) : NA)], ['Planlı dk', (b) => (b.planned?.minutes == null ? NA : nf(b.planned.minutes))],
    ['Ürün / revizyon', (b) => (b.productRevision ? `${b.productRevision.productCode} rev ${b.productRevision.revision} (${b.productRevision.status})` : NA)],
    ['CAM programı', (b) => (b.camProgram ? `${b.camProgram.programNo} r${b.camProgram.revision} (${b.camProgram.status})` : NA)],
    ['Takım listesi', (b) => (b.camProgram?.toolList?.length ? b.camProgram.toolList.map((t) => `${t.toolType}×${t.qty}`).join(', ') : NA)],
    ['Operasyonlar', (b) => (b.operations?.length ? b.operations.map((o) => `OP${o.opNo} (rota v${o.routingVersionNo ?? '?'} · ${o.cycleSecondsTarget ?? '?'} sn · hazırlık ${o.setupMinutesTarget ?? '?'} dk)`).join(' · ') : NA)],
    ['Hammadde', (b) => (b.materials?.length ? b.materials.map((m) => `${m.materialCode}: gereken ${m.required}, rezerve ${m.reserved}`).join(' · ') : NA)],
    ['Parti sayısı', (b) => String(b.materialLots?.length ?? 0)],
];
const basisRows = (b) => KEYS.map(([k, f]) => [k, f(b)]);
const diffRows = (a, b) => {
    const rows = KEYS.map(([k, f]) => [k, f(a), f(b)]).filter(([, x, y]) => x !== y).map(([k, x, y]) => [k, `${x}  →  ${y}`]);
    return rows.length ? rows : [['Fark', 'Önceki sürümle aynı dayanak']];
};
