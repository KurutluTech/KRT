// KMI-012 Shift Planner (#/vardiya-planlayici): rows = machines, columns = date × shift (two shifts), blocks = work orders placed on the canonical plan (work_orders.planned_*).
// Block colour = work-order STATUS, outline + glyph + text = RISK (colour is never the only carrier). Click a block → detail, constraints, delay reason, planned-vs-actual.
// The real plan changes ONLY through plan_replan → commit_work_order_plan (reason mandatory once a plan exists, server re-checks every rule). Scenarios are drafts: evaluate = server dry run,
// apply = planner approval + reason, atomic. Unknown data (duration, cycle time, shift, operator) is shown as UNKNOWN, never filled in.
import { mount } from '../../../../packages/ui/src/h.js';
import { blockRisks, constraintsOf, delayReason, indexSlots, operatorConflicts, operatorsWithoutShift, planVsActual, riskLevel, slotKey, slotState, addDays } from '../../../../packages/domain/src/planCockpit.js';
import { errorText } from '../errorText.js';
import { machineSpindle } from '../machineStateLoader.js';
import { WO_STATUS_TR } from './WorkOrderHubScreen.js';
import { E, PLAN_CSS, PROD_SHIFTS, RISK_GLYPH, RISK_NAME, SHIFT_LABEL, dayLabel, hhmm, loadAll, rangeDates, shortId } from './planCockpitKit.js';
const STATUS_COLOR = { PLANNED: '#64748b', PRODUCTION_DONE: '#a78bfa', MACHINE_ASSIGNED: '#38bdf8', IN_PROGRESS: '#22c55e', FIRST_PIECE_PENDING: '#2dd4bf', FIRST_PIECE_APPROVED: '#2dd4bf', ON_HOLD: '#f59e0b', COMPLETED: '#475569' };
const REFUSAL_TR = {
    CAPACITY_EXCEEDED: 'Vardiya kapasitesi aşılıyor', MACHINE_NOT_PLANNABLE: 'Makine planlanamaz (arıza/bakım)', OPERATOR_NOT_IN_SHIFT: 'Operatör bu vardiyada değil', PERSON_INACTIVE: 'Operatör pasif',
    PERSON_NOT_OPERATOR: 'Seçilen kişi operatör değil', SHIFT_NOT_PRODUCTION: 'Üretim vardiyası değil', PLANNED_MINUTES_REQUIRED: 'Planlı süre girilmeli', HARD_CAP_EXCEEDED: 'Operatör en fazla 3 makineye atanabilir',
    MULTI_MACHINE_AUTHORIZATION_INSUFFICIENT: 'Operatörün çoklu makine yetkisi yetersiz', REPLAN_REASON_REQUIRED: 'Plan zaten var: gerekçe (en az 5 karakter) zorunlu', REASON_REQUIRED: 'Gerekçe (en az 5 karakter) zorunlu',
};
const refusalText = (r) => { if (!r)
    return '—'; const code = /[A-Z_]{6,}/.exec(r)?.[0] ?? ''; return REFUSAL_TR[code] ?? (/PLAN_NOT_ALLOWED_IN_STATUS/.test(r) ? 'İş emri bu durumda planlanamaz' : r); };
const PLANNABLE = ['PLANNED', 'MACHINE_ASSIGNED', 'ON_HOLD'];
export async function renderShiftPlanner(container, deps, init = {}, flash) {
    const { api, today, canPlan } = deps;
    const st = { s: init.s && /^\d{4}-\d{2}-\d{2}$/.test(init.s) ? init.s : today, days: init.days === 14 ? 14 : 7, m: init.m ?? '', v: init.v ?? '', c: init.c ?? '', w: init.w ?? '', r: init.r ?? '', wo: init.wo ?? '', sc: init.sc ?? '',
        view: (init.view ?? (deps.narrow ? 'list' : 'grid')), placing: '' };
    let mst = null;
    let d = null;
    let scenarios = null;
    let scNote = null;
    let evalResult = null;
    let note = flash ?? null;
    const hashOf = () => { const q = new URLSearchParams(); if (st.s !== today)
        q.set('s', st.s); if (st.days === 14)
        q.set('days', '14'); for (const k of ['m', 'v', 'c', 'w', 'r', 'wo', 'sc'])
        if (st[k])
            q.set(k, st[k]); if (st.view === 'list' && !deps.narrow)
        q.set('view', 'list'); const qs = q.toString(); return `#/vardiya-planlayici${qs ? `?${qs}` : ''}`; };
    async function reload() {
        const to = addDays(st.s, st.days - 1);
        d = await loadAll(api, st.s, to);
        if (deps.machineStates) {
            try {
                mst = await deps.machineStates();
            }
            catch {
                mst = null;
            }
        }
        if (canPlan) {
            try {
                scenarios = await api.scenarios();
                scNote = null;
            }
            catch (e) {
                scenarios = null;
                scNote = errorText(e);
            }
        }
        draw();
    }
    async function act(fn, ok, afterReload = true) {
        try {
            await fn();
            note = { kind: 'ok', text: ok };
            evalResult = null;
            draft = null;
        }
        catch (e) {
            note = { kind: 'error', text: errorText(e) };
        }
        if (afterReload)
            await reload();
        else
            draw();
    }
    function draw() {
        if (!d)
            return;
        const dd = d;
        deps.remember(hashOf());
        const dates = rangeDates(st.s, st.days);
        const idx = indexSlots(dd.slots);
        const machines = [...new Map(dd.slots.map((s) => [s.machineId, { id: s.machineId, code: s.machineCode, status: s.machineStatus }])).values()].sort((a, b) => a.code.localeCompare(b.code));
        const codeOf = (id) => machines.find((m) => m.id === id)?.code ?? '—';
        const canSeeOps = dd.ops !== null;
        const open = dd.blocks.filter((b) => b.status !== 'CANCELLED');
        const slotOfB = (b) => (b.machineId && b.plannedDate && b.plannedShiftCode ? idx.get(slotKey(b.machineId, b.plannedDate, b.plannedShiftCode)) ?? null : null);
        const riskOf = new Map(open.map((b) => [b.workOrderId, blockRisks(b, { today, slot: slotOfB(b), canSeeOperators: canSeeOps })]));
        const lvl = (b) => riskLevel(riskOf.get(b.workOrderId) ?? []);
        const passes = (b) => {
            if (st.w && !(`${b.productCode ?? ''} ${b.workOrderId}`.toLocaleLowerCase('tr-TR').includes(st.w.toLocaleLowerCase('tr-TR'))))
                return false;
            if (st.c && !(b.customerName ?? '').toLocaleLowerCase('tr-TR').includes(st.c.toLocaleLowerCase('tr-TR')))
                return false;
            if (st.r === 'UNPLANNED')
                return !b.plannedDate;
            if (st.r && st.r !== 'ALL' && lvl(b) !== st.r)
                return false;
            return true;
        };
        const shifts = st.v ? PROD_SHIFTS.filter((x) => x === st.v) : [...PROD_SHIFTS];
        const shownMachines = machines.filter((m) => !st.m || m.id === st.m);
        const placedIn = (mid, date, sh) => open.filter((b) => b.machineId === mid && b.plannedDate === date && b.plannedShiftCode === sh && passes(b));
        const backlog = open.filter((b) => !b.plannedDate && passes(b));
        const outside = open.filter((b) => b.plannedDate && b.status !== 'COMPLETED' && (b.plannedDate < st.s || b.plannedDate > dates[dates.length - 1])).length;
        const sel = st.wo ? dd.blocks.find((b) => b.workOrderId === st.wo || b.workOrderId.startsWith(st.wo)) ?? null : null;
        const placing = st.placing ? dd.blocks.find((b) => b.workOrderId === st.placing) ?? null : null;
        const blockBtn = (b) => {
            const lv = lvl(b);
            const items = riskOf.get(b.workOrderId) ?? [];
            const sl = slotOfB(b);
            const wpct = b.plannedMinutes === null || !sl ? 72 : Math.max(72, Math.min(100, Math.round((b.plannedMinutes / sl.shiftMinutes) * 100)));
            const label = `${RISK_GLYPH[lv] ? `${RISK_GLYPH[lv]} ` : ''}${b.productCode ?? shortId(b.workOrderId)} · ${b.plannedMinutes === null ? 'süre?' : `${b.plannedMinutes} dk`}`;
            return E('button', { type: 'button', class: `pk-blk rk-${lv}${sel?.workOrderId === b.workOrderId ? ' sel' : ''}`, style: `width:${wpct}%;background:${STATUS_COLOR[b.status] ?? '#64748b'}`, 'data-testid': 'pl-block', 'data-wo': b.workOrderId, 'data-risk': lv, 'data-status': b.status,
                title: `${WO_STATUS_TR[b.status] ?? b.status} · ${items.map((i) => i.label).join(' · ') || 'bilinen risk yok'}`,
                'aria-label': `İş emri ${b.productCode ?? shortId(b.workOrderId)}, ${WO_STATUS_TR[b.status] ?? b.status}, ${RISK_NAME[lv]}, ${b.plannedMinutes === null ? 'planlı süre bilinmiyor' : `${b.plannedMinutes} dakika`}`,
                onClick: () => { st.wo = b.workOrderId; st.placing = ''; draw(); } }, label);
        };
        const cell = (m, date, sh) => {
            const sl = idx.get(slotKey(m.id, date, sh));
            const state = sl ? slotState(sl) : 'EMPTY';
            const bl = placedIn(m.id, date, sh);
            const blockedNow = sl ? sl.capacityMinutes === 0 : false;
            const head = sl ? `${sl.plannedMinutes}/${sl.capacityMinutes}` : '—';
            return E('div', { class: `pk-cell s-${state}`, 'data-testid': 'pl-cell', 'data-machine': m.code, 'data-slot': `${date}|${sh}`, 'data-state': state }, E('div', { class: 'pk-ch' }, E('span', null, `${head} dk`), state === 'BLOCKED' ? E('b', null, 'KULLANILAMIYOR') : state === 'OVER' ? E('b', null, 'AŞIM') : sl && sl.unknownMinutesWoCount > 0 ? E('b', null, 'SÜRE?') : null), E('div', { class: 'pk-track' }, ...bl.map(blockBtn)), placing && canPlan && !blockedNow ? E('button', { type: 'button', class: 'pk-put', 'data-testid': 'pl-place-here', onClick: () => { st.wo = placing.workOrderId; formPre = { machineId: m.id, date, shift: sh }; draw(); } }, 'Buraya yerleştir') : null);
        };
        // ---------------- detail panel
        let detail = null;
        if (sel) {
            const items = riskOf.get(sel.workOrderId) ?? blockRisks(sel, { today, slot: slotOfB(sel), canSeeOperators: canSeeOps });
            const lv = riskLevel(items);
            const cons = constraintsOf(items);
            const sl = slotOfB(sel);
            const pva = sl ? planVsActual(sl, today) : null;
            const planned = !!(sel.plannedDate || sel.machineId);
            const dr = draft && draft.wo === sel.workOrderId ? draft : null;
            const pre = dr ? { machineId: dr.machineId, date: dr.plannedDate, shift: dr.shiftCode } : formPre ?? { machineId: sel.machineId ?? shownMachines[0]?.id ?? '', date: sel.plannedDate ?? st.s, shift: sel.plannedShiftCode ?? 'TeamK1' };
            const mSel = E('select', { 'data-testid': 'pl-f-machine' }, ...machines.map((m) => E('option', { value: m.id, ...(m.id === pre.machineId ? { selected: 'selected' } : {}) }, `${m.code}${m.status !== 'UP' ? ` (${m.status === 'HOLD' ? 'bekleme' : m.status === 'DOWN' ? 'arıza' : 'bakım'})` : ''}`)));
            const dIn = E('input', { type: 'date', value: pre.date, 'data-testid': 'pl-f-date' });
            const shSel = E('select', { 'data-testid': 'pl-f-shift' }, ...PROD_SHIFTS.map((x) => E('option', { value: x, ...(x === pre.shift ? { selected: 'selected' } : {}) }, SHIFT_LABEL[x])));
            const mins = E('input', { type: 'number', min: '1', step: '1', value: dr ? dr.plannedMinutes : sel.plannedMinutes ?? (sel.estMinutes !== null ? Math.round(sel.estMinutes) : ''), placeholder: 'dk', 'data-testid': 'pl-f-minutes' });
            const opNames = new Map();
            for (const o of dd.ops ?? [])
                opNames.set(o.personnelId, { name: o.name, shift: o.shiftCode });
            const opSel = E('select', { 'data-testid': 'pl-f-operator', disabled: !canSeeOps }, E('option', { value: '' }, canSeeOps ? '(operatör yok)' : 'BİLİNMİYOR (yetki gerekir)'), ...[...opNames.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr')).map(([id, o]) => E('option', { value: id, ...(id === (dr ? dr.operatorId : sel.operatorId) ? { selected: 'selected' } : {}) }, `${o.name} — ${o.shift ? SHIFT_LABEL[o.shift] ?? o.shift : 'vardiya tanımsız'}`)));
            const why = E('input', { type: 'text', placeholder: planned ? 'Gerekçe (zorunlu — plan zaten var)' : 'Gerekçe (isteğe bağlı)', 'data-testid': 'pl-f-reason', maxlength: '300', value: dr?.reason ?? '' });
            const read = () => ({ machineId: mSel.value, operatorId: opSel.value || null, plannedDate: dIn.value, shiftCode: shSel.value, plannedMinutes: Number(mins.value), reason: why.value.trim() || null });
            const errBox = E('div', { class: 'pk-msg', 'data-kind': 'error', 'data-testid': 'pl-f-error', hidden: 'hidden', role: 'alert' });
            const showErr = (t) => { errBox.textContent = t; errBox.removeAttribute('hidden'); };
            const activeSc = scenarios?.find((x) => x.id === st.sc && x.status === 'DRAFT') ?? null;
            detail = E('div', { class: 'pk-panel', 'data-testid': 'pl-detail', 'data-wo': sel.workOrderId }, E('h2', null, `İş emri ${shortId(sel.workOrderId)} · ${sel.productCode ?? 'ürün bilinmiyor'}`), E('div', { class: 'pk-src' }, `Kaynak: plan_blocks · iş emri planı, hazırlık (malzeme/takım), kalite, makine durumu · veri anı ${hhmm(sel.dataAt)}`), E('div', { class: 'pk-row' }, E('span', { class: `pk-pill ${lv}`, 'data-testid': 'pl-d-risk' }, `${RISK_GLYPH[lv]} ${RISK_NAME[lv]}`), E('span', null, WO_STATUS_TR[sel.status] ?? sel.status), E('span', null, `Adet ${sel.qtyProduced}/${sel.qtyPlanned}`), E('span', null, `Termin ${sel.dueDate ?? 'BİLİNMİYOR'}`), sel.customerName ? E('span', { 'data-testid': 'pl-d-customer' }, `Müşteri: ${sel.customerName}`) : null), E('div', { 'data-testid': 'pl-d-delay' }, E('b', null, 'Gecikme / risk nedeni: '), delayReason(items) ?? E('span', { class: 'pk-unk' }, 'Bilinen verilerle neden görünmüyor')), E('div', { 'data-testid': 'pl-d-constraints' }, E('b', null, 'Kısıtlar: '), cons.length === 0 ? E('span', null, 'bilinen kısıt yok') : E('span', null, cons.map((c) => `${RISK_GLYPH[c.level]} ${c.label}`).join(' · '))), E('ul', { class: 'pk-note', 'data-testid': 'pl-d-risks' }, ...items.map((i) => E('li', null, `${RISK_NAME[i.level]}: ${i.label}`))), E('div', null, E('b', null, 'Plan: '), sel.plannedDate ? `${codeOf(sel.machineId)} · ${dayLabel(sel.plannedDate)} · ${SHIFT_LABEL[sel.plannedShiftCode ?? ''] ?? '—'} · ${sel.plannedMinutes === null ? 'süre BİLİNMİYOR' : `${sel.plannedMinutes} dk`}${sel.operatorName ? ` · ${sel.operatorName}` : canSeeOps ? ' · operatör yok' : ''}` : E('span', { class: 'pk-unk' }, 'Planlanmadı')), E('div', { 'data-testid': 'pl-d-est' }, E('b', null, 'Süre tahmini: '), sel.estMinutes !== null ? `${sel.estMinutes} dk (${sel.estSource === 'OPERATIONS' ? 'rota operasyon hedeflerinden' : 'yalnız CAM çevrim süresi — kurulum yok'})` : E('span', { class: 'pk-unk' }, 'BİLİNMİYOR — rota/çevrim süresi tanımlı değil')), E('div', { 'data-testid': 'pl-d-actual' }, E('b', null, 'Planlanan–gerçekleşen: '), `iş emri oturumu ${sel.actualStartedAt ? `başladı ${hhmm(sel.actualStartedAt)}, çalışan ${sel.actualRunMinutes ?? 0} dk` : 'henüz başlamadı'}`, pva ? ` · vardiya: planlı ${pva.planned} dk, ${pva.state === 'MEASURED' ? `gerçekleşen ${pva.run} dk (${(pva.diff ?? 0) > 0 ? '+' : ''}${pva.diff})` : pva.state === 'FUTURE' ? 'henüz başlamadı' : 'gerçekleşen veri yok'}` : '', ` · kaynak: iş emri durum olayları${pva ? ' + OEE slotları' : ''}`), E('div', { class: 'pk-nav' }, E('a', { class: 'pk-btn sec', href: `#/is-emirleri?wo=${sel.workOrderId}`, 'data-testid': 'pl-d-open-wo' }, 'İş emrini aç →'), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => { st.wo = ''; formPre = null; draft = null; draw(); } }, 'Kapat')), canPlan && PLANNABLE.includes(sel.status) ? E('div', { 'data-testid': 'pl-form' }, E('h2', null, planned ? 'Yeniden planla (gerekçe zorunlu)' : 'Plana yerleştir'), E('div', { class: 'pk-form' }, E('label', null, 'Makine', mSel), E('label', null, 'Gün', dIn), E('label', null, 'Vardiya', shSel), E('label', null, 'Planlı süre (dk)', mins), E('label', null, 'Operatör', opSel), E('label', null, 'Gerekçe', why)), errBox, E('div', { class: 'pk-nav' }, E('button', { type: 'button', class: 'pk-btn', 'data-testid': 'pl-f-save', onClick: () => {
                    const v = read();
                    draft = { wo: sel.workOrderId, ...v };
                    if (!(v.plannedMinutes > 0)) {
                        showErr('Planlı süre (dk) girilmeli.');
                        return;
                    }
                    if (planned && (v.reason ?? '').length < 5) {
                        showErr('Plan zaten var: gerekçe (en az 5 karakter) zorunlu.');
                        return;
                    }
                    formPre = null;
                    void act(() => api.replan({ workOrderId: sel.workOrderId, ...v }), planned ? 'Plan gerekçeyle güncellendi.' : 'Plan kaydedildi.');
                } }, planned ? 'Yeniden planla (yetkili)' : 'Planı kaydet (yetkili)'), activeSc ? E('button', { type: 'button', class: 'pk-btn sec', 'data-testid': 'pl-f-to-scenario', onClick: () => {
                    const v = read();
                    draft = { wo: sel.workOrderId, ...v };
                    if (!(v.plannedMinutes > 0)) {
                        showErr('Planlı süre (dk) girilmeli.');
                        return;
                    }
                    formPre = null;
                    void act(() => api.scenarioSetMove({ scenarioId: activeSc.id, workOrderId: sel.workOrderId, ...v }), `Senaryoya eklendi: ${activeSc.name} (gerçek plan değişmedi).`);
                } }, `Senaryoya ekle: ${activeSc.name}`) : null), E('div', { class: 'pk-note' }, 'Kaydet gerçek planı değiştirir ve denetim kaydına yazılır; senaryoya ekleme gerçek planı değiştirmez.')) : null);
        }
        // ---------------- scenarios
        const scPanel = !canPlan ? null : E('div', { class: 'pk-panel', 'data-testid': 'pl-scenarios' }, E('h2', null, 'Alternatif senaryolar'), E('div', { class: 'pk-src' }, 'Taslak plan: gerçek planı DEĞİŞTİRMEZ. Değerlendir = sunucuda kuru çalıştırma (gerçek kurallarla, geri alınır). Uygula = yönetici onayı + gerekçe, hepsi ya da hiçbiri.'), scenarios === null ? E('div', { class: 'pk-note' }, scNote ? `Senaryolar okunamadı: ${scNote}` : 'Senaryolar yükleniyor…') : (() => {
            const drafts = scenarios.filter((x) => x.status === 'DRAFT');
            const cur = drafts.find((x) => x.id === st.sc) ?? null;
            const nameIn = E('input', { type: 'text', placeholder: 'Yeni senaryo adı', maxlength: '80', 'data-testid': 'pl-sc-name' });
            const pick = E('select', { 'data-testid': 'pl-sc-pick', onChange: (ev) => { st.sc = ev.target.value; evalResult = null; draw(); } }, E('option', { value: '' }, drafts.length ? '(senaryo seç)' : '(taslak senaryo yok)'), ...drafts.map((x) => E('option', { value: x.id, ...(x.id === st.sc ? { selected: 'selected' } : {}) }, `${x.name} · ${x.moves.length} hamle`)));
            const applyWhy = E('input', { type: 'text', placeholder: 'Onay gerekçesi (zorunlu)', maxlength: '300', 'data-testid': 'pl-sc-reason' });
            const ev = cur?.evaluation ?? evalResult;
            const diffs = ev ? ev.after.filter((a) => { const b = ev.before.find((x) => x.machineId === a.machineId && x.date === a.date && x.shift === a.shift); return !b || b.planned !== a.planned; }) : [];
            return E('div', null, E('div', { class: 'pk-fl' }, E('label', null, 'Senaryo', pick), E('label', null, 'Yeni', nameIn), E('button', { type: 'button', class: 'pk-btn sec', 'data-testid': 'pl-sc-create', onClick: () => {
                    const n = nameIn.value.trim();
                    if (n.length < 3) {
                        note = { kind: 'error', text: 'Senaryo adı en az 3 karakter olmalı.' };
                        draw();
                        return;
                    }
                    void (async () => { try {
                        const id = await api.scenarioCreate(n, null);
                        st.sc = id;
                        note = { kind: 'ok', text: 'Taslak senaryo oluşturuldu (gerçek plan değişmedi). Bir iş emrini seçip “Senaryoya ekle” ile hamle ekleyin.' };
                    }
                    catch (e) {
                        note = { kind: 'error', text: errorText(e) };
                    } await reload(); })();
                } }, 'Taslak oluştur')), cur ? E('div', { 'data-testid': 'pl-sc-active' }, cur.moves.length === 0 ? E('div', { class: 'pk-note' }, 'Henüz hamle yok. Bir iş emri seçin, yerleştirme alanından “Senaryoya ekle”yi kullanın.') : null, ...cur.moves.map((mv) => E('div', { class: 'pk-row', 'data-testid': 'pl-sc-move' }, E('span', { class: 'grow' }, `${shortId(mv.workOrderId)} ${open.find((b) => b.workOrderId === mv.workOrderId)?.productCode ?? ''} → ${codeOf(mv.machineId)} · ${dayLabel(mv.plannedDate)} · ${SHIFT_LABEL[mv.plannedShiftCode] ?? mv.plannedShiftCode} · ${mv.plannedMinutes} dk`), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => void act(() => api.scenarioRemoveMove(cur.id, mv.workOrderId), 'Hamle senaryodan çıkarıldı.') }, 'Çıkar'))), E('div', { class: 'pk-nav' }, E('button', { type: 'button', class: 'pk-btn', 'data-testid': 'pl-sc-eval', disabled: cur.moves.length === 0, onClick: () => void (async () => { try {
                    evalResult = await api.scenarioEvaluate(cur.id);
                    note = { kind: 'info', text: 'Değerlendirme tamamlandı (kuru çalıştırma; gerçek plan değişmedi).' };
                }
                catch (e) {
                    note = { kind: 'error', text: errorText(e) };
                } await reload(); })() }, 'Değerlendir (kuru çalıştırma)'), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => void act(() => api.scenarioDiscard(cur.id, null), 'Senaryo vazgeçildi; gerçek plan değişmedi.').then(() => { st.sc = ''; }) }, 'Vazgeç')), ev ? E('div', { 'data-testid': 'pl-sc-eval-result', 'data-ok': String(ev.ok) }, E('span', { class: `pk-pill ${ev.ok ? 'LOW' : 'HIGH'}` }, ev.ok ? 'Uygulanabilir' : 'Uygulanamaz'), ...ev.moves.map((m) => E('div', { class: 'pk-note', 'data-testid': 'pl-sc-eval-move', 'data-ok': String(m.ok) }, `${shortId(m.workOrderId)}: ${m.ok ? 'uygun' : `reddedildi — ${refusalText(m.refusal)}`}`)), diffs.length ? E('div', { class: 'pk-note' }, 'Yük değişimi (planlı dk): ', diffs.map((a) => { const b = ev.before.find((x) => x.machineId === a.machineId && x.date === a.date && x.shift === a.shift); return `${codeOf(a.machineId)} ${dayLabel(a.date)} ${SHIFT_LABEL[a.shift] ?? a.shift}: ${b ? b.planned : 0} → ${a.planned}/${a.capacity}`; }).join(' · ')) : null) : null, E('div', { class: 'pk-form' }, E('label', null, 'Yönetici onayı gerekçesi', applyWhy), E('button', { type: 'button', class: 'pk-btn', 'data-testid': 'pl-sc-apply', disabled: cur.moves.length === 0, onClick: () => {
                    const r = applyWhy.value.trim();
                    if (r.length < 5) {
                        note = { kind: 'error', text: 'Onay gerekçesi (en az 5 karakter) zorunlu.' };
                        draw();
                        return;
                    }
                    void act(() => api.scenarioApply(cur.id, r), 'Senaryo onaylandı ve uygulandı; gerçek plan değişti (denetim kaydı yazıldı).').then(() => { st.sc = ''; });
                } }, 'Onayla ve uygula'))) : null, scenarios.filter((x) => x.status !== 'DRAFT').length ? E('div', { class: 'pk-note' }, `Geçmiş: ${scenarios.filter((x) => x.status !== 'DRAFT').slice(0, 5).map((x) => `${x.name} (${x.status === 'APPLIED' ? 'uygulandı' : 'vazgeçildi'}${x.decisionReason ? `: ${x.decisionReason}` : ''})`).join(' · ')}`) : null);
        })());
        // ---------------- operators
        const opPanel = E('div', { class: 'pk-panel', 'data-testid': 'pl-operators' }, E('h2', null, 'Operatör dağılımı'), E('div', { class: 'pk-src' }, 'Kaynak: personel vardiya kaydı + iş emri atamaları + çoklu makine yetkisi (plan_operator_load) · bir operatör birden fazla makineyi yönetebilir (yetki sınırı içinde)'), !dd.ops ? E('div', { class: 'pk-note', 'data-testid': 'pl-ops-unknown' }, `Operatör verisi BİLİNMİYOR: ${dd.opsNote ?? 'yetki gerekir'}`) : (() => {
            const rows = dd.ops.filter((o) => o.slotDate !== null && o.slotShift !== null && o.slotDate >= st.s && o.slotDate <= dates[dates.length - 1] && o.machinesPlanned > 0);
            const shiftOps = [...new Map(dd.ops.filter((o) => o.shiftCode !== null).map((o) => [o.personnelId, o])).values()];
            const nos = operatorsWithoutShift(dd.ops);
            const conf = operatorConflicts(dd.ops).filter((c) => c.slotDate >= st.s && c.slotDate <= dates[dates.length - 1]);
            return E('div', null, nos.length ? E('div', { class: 'pk-msg', 'data-kind': 'info', 'data-testid': 'pl-ops-noshift' }, `Vardiyası tanımsız operatör: ${nos.map((o) => o.name).join(', ')} — uygunlukları BİLİNMİYOR${nos.some((o) => !o.hasLogin) ? ' (bazıları sisteme girişsiz)' : ''}.`) : null, ...conf.map((c) => E('div', { class: 'pk-msg', 'data-kind': 'error', 'data-testid': 'pl-op-conflict' }, `${c.name} · ${dayLabel(c.slotDate)} ${SHIFT_LABEL[c.slotShift] ?? c.slotShift}: ${c.reason}`)), E('div', { class: 'pk-note', 'data-testid': 'pl-ops-roster' }, `Vardiyası tanımlı operatör: ${shiftOps.length ? shiftOps.map((o) => `${o.name} (${SHIFT_LABEL[o.shiftCode] ?? o.shiftCode})`).join(', ') : 'yok'}`), rows.length === 0 ? E('div', { class: 'pk-note' }, 'Bu dönemde operatör ataması yapılmış iş emri yok.') : E('div', { class: 'pk-scroll' }, E('table', { class: 'pk-tbl' }, E('thead', null, E('tr', null, ...['Operatör', 'Gün', 'Vardiya', 'Makine', 'Planlı dk', 'Yetki (makine)', 'Giriş'].map((t) => E('th', null, t)))), E('tbody', null, ...rows.slice(0, 60).map((o) => E('tr', { 'data-testid': 'pl-op-row' }, E('td', null, o.name), E('td', null, dayLabel(o.slotDate)), E('td', null, `${SHIFT_LABEL[o.slotShift] ?? o.slotShift}${o.isOwnShift ? '' : ' (kendi vardiyası değil)'}`), E('td', null, String(o.machinesPlanned)), E('td', null, String(o.plannedMinutes)), E('td', null, String(o.maxMachines)), E('td', null, o.confirmed ? 'vardiya onaylı' : '—')))))));
        })());
        // ---------------- grid / list
        const gridCols = `150px repeat(${dates.length * shifts.length}, minmax(112px,1fr))`;
        const grid = E('div', { class: 'pk-scroll', 'data-testid': 'pl-grid' }, E('div', { class: 'pk-g', style: `grid-template-columns:${gridCols}`, role: 'table', 'aria-label': 'Makine, tarih ve vardiya bazlı plan' }, E('div', { class: 'pk-gh stick' }, 'Makine'), ...dates.flatMap((dt) => shifts.map((sh) => E('div', { class: 'pk-gh', 'data-testid': 'pl-head' }, E('b', null, dayLabel(dt)), E('small', null, SHIFT_LABEL[sh])))), ...shownMachines.flatMap((m) => [E('div', { class: 'pk-gm stick', 'data-testid': 'pl-machine', 'data-machine': m.code }, E('b', { style: 'display:inline-flex;align-items:center;gap:5px', 'data-testid': 'pl-machine-state' }, machineSpindle(mst, m.code, m.status, 20), m.code), m.status !== 'UP' ? E('small', null, m.status === 'HOLD' ? 'BEKLEME' : m.status === 'DOWN' ? 'ARIZA' : 'BAKIM') : null),
            ...dates.flatMap((dt) => shifts.map((sh) => cell(m, dt, sh)))])));
        const list = E('div', { 'data-testid': 'pl-list' }, ...dates.map((dt) => E('div', { class: 'pk-panel' }, E('h2', null, dayLabel(dt)), ...shifts.map((sh) => {
            const rows = shownMachines.flatMap((m) => placedIn(m.id, dt, sh).map((b) => ({ m, b })));
            const tot = shownMachines.reduce((a, m) => a + (idx.get(slotKey(m.id, dt, sh))?.plannedMinutes ?? 0), 0);
            const cap = shownMachines.reduce((a, m) => a + (idx.get(slotKey(m.id, dt, sh))?.capacityMinutes ?? 0), 0);
            return E('div', null, E('b', null, `${SHIFT_LABEL[sh]} · ${tot}/${cap} dk`), rows.length === 0 ? E('div', { class: 'pk-note' }, 'Yerleşim yok') : null, ...rows.map(({ m, b }) => E('div', { class: 'pk-row' }, E('b', { style: 'min-width:80px' }, m.code), blockBtn(b))));
        }))));
        const backlogPanel = E('div', { class: 'pk-panel', 'data-testid': 'pl-backlog' }, E('h2', null, `Plansız iş emirleri (${backlog.length})`), E('div', { class: 'pk-src' }, 'Kaynak: plan_blocks · tarihi/vardiyası olmayan açık iş emirleri'), backlog.length === 0 ? E('div', { class: 'pk-note' }, 'Plansız iş emri yok.') : null, ...backlog.slice(0, 40).map((b) => {
            const lv = lvl(b);
            return E('div', { class: 'pk-row', 'data-testid': 'pl-backlog-row', 'data-wo': b.workOrderId }, E('span', { class: `pk-pill ${lv}` }, `${RISK_GLYPH[lv]} ${RISK_NAME[lv]}`), E('span', { class: 'grow' }, `${b.productCode ?? shortId(b.workOrderId)} · ${b.qtyPlanned} adet · termin ${b.dueDate ?? 'BİLİNMİYOR'}${b.customerName ? ` · ${b.customerName}` : ''}`), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => { st.wo = b.workOrderId; draw(); } }, 'Detay'), canPlan && PLANNABLE.includes(b.status) ? E('button', { type: 'button', class: 'pk-btn', 'data-testid': 'pl-backlog-place', onClick: () => { st.placing = b.workOrderId; st.wo = ''; draw(); } }, 'Yerleştir') : null);
        }), outside > 0 ? E('div', { class: 'pk-note' }, `${outside} planlı iş emri bu pencerenin dışında (başka tarihte).`) : null);
        // ---------------- filters
        const inp = (label, key, ph) => E('label', null, label, E('input', { type: 'search', value: st[key], placeholder: ph, 'data-testid': `pl-flt-${key}`, onChange: (e) => { st[key] = e.target.value.trim(); draw(); } }));
        const filters = E('div', { class: 'pk-fl', 'data-testid': 'pl-filters' }, E('label', null, 'Başlangıç günü', E('input', { type: 'date', value: st.s, 'data-testid': 'pl-flt-date', onChange: (e) => { const v = e.target.value; if (v) {
                st.s = v;
                void reload();
            } } })), E('label', null, 'Gün sayısı', E('select', { 'data-testid': 'pl-flt-days', onChange: (e) => { st.days = Number(e.target.value) === 14 ? 14 : 7; void reload(); } }, E('option', { value: '7', ...(st.days === 7 ? { selected: 'selected' } : {}) }, '7 gün'), E('option', { value: '14', ...(st.days === 14 ? { selected: 'selected' } : {}) }, '14 gün'))), E('label', null, 'Makine', E('select', { 'data-testid': 'pl-flt-m', onChange: (e) => { st.m = e.target.value; draw(); } }, E('option', { value: '' }, 'Tümü'), ...machines.map((m) => E('option', { value: m.id, ...(st.m === m.id ? { selected: 'selected' } : {}) }, m.code)))), E('label', null, 'Vardiya', E('select', { 'data-testid': 'pl-flt-v', onChange: (e) => { st.v = e.target.value; draw(); } }, E('option', { value: '' }, 'İki vardiya'), ...PROD_SHIFTS.map((x) => E('option', { value: x, ...(st.v === x ? { selected: 'selected' } : {}) }, SHIFT_LABEL[x])))), inp('Müşteri', 'c', 'müşteri adı'), inp('İş emri / ürün', 'w', 'kod veya no'), E('label', null, 'Risk', E('select', { 'data-testid': 'pl-flt-r', onChange: (e) => { st.r = e.target.value; draw(); } }, ...[['', 'Tümü'], ['HIGH', 'Yüksek risk'], ['MEDIUM', 'Orta risk'], ['UNKNOWN', 'Veri eksik'], ['LOW', 'Risk görünmüyor'], ['UNPLANNED', 'Plansız']].map(([v, l]) => E('option', { value: v, ...(st.r === v ? { selected: 'selected' } : {}) }, l)))), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => { st.view = st.view === 'grid' ? 'list' : 'grid'; draw(); } }, st.view === 'grid' ? 'Liste görünümü' : 'Tablo görünümü'), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => { st.s = addDays(st.s, -st.days); void reload(); } }, '← Önceki'), E('button', { type: 'button', class: 'pk-btn sec', onClick: () => { st.s = addDays(st.s, st.days); void reload(); } }, 'Sonraki →'));
        const legend = E('div', { class: 'pk-legend', 'data-testid': 'pl-legend' }, ...[['PLANNED', 'Plana alındı'], ['MACHINE_ASSIGNED', 'Makine atandı'], ['IN_PROGRESS', 'Üretimde'], ['FIRST_PIECE_PENDING', 'İlk parça'], ['ON_HOLD', 'Bekletmede'], ['PRODUCTION_DONE', 'Üretim bitti · onay bekliyor'], ['COMPLETED', 'Tamamlandı']].map(([k, l]) => E('span', { 'data-status': k, title: k === 'PRODUCTION_DONE' ? 'Üretim (son operasyon / FINISH) bitti; nihai kalite onayı verilmeden iş emri TAMAMLANDI sayılmaz. Makine ve operatör boşa çıkar.' : k === 'PLANNED' ? 'Plana alındı ≠ üretime hazır: makine, operatör, malzeme, takım eksikleri iş emri akışında görünür.' : undefined }, E('i', { class: 'pk-sw', style: `background:${STATUS_COLOR[k]}` }), l)), E('span', null, '▲ yüksek risk'), E('span', null, '◆ orta risk'), E('span', null, '? veri eksik'), E('span', null, 'Çizgili hücre: makine kullanılamıyor'), E('span', { 'data-testid': 'pl-legend-note' }, 'Üretim bitti ≠ Tamamlandı (nihai kalite onayı beklenir) · Plana alındı ≠ üretime hazır'));
        const view = E('div', { class: 'pk', 'data-testid': 'pl-root' }, E('style', null, PLAN_CSS + PLANNER_CSS), E('h1', { class: 'pk-h1', 'data-testid': 'pl-heading' }, 'Shift Planner'), E('p', { class: 'pk-sub' }, 'Makine × tarih × vardiya. Blok rengi iş emri durumu; çerçeve ve işaret risk. Gerçek plan yalnız yetkili karar ve gerekçe ile değişir.'), E('div', { class: 'pk-nav' }, E('a', { class: 'pk-btn sec', href: '#/planlama-kokpit' }, '← Planlama Kokpiti'), E('a', { class: 'pk-btn sec', href: '#/planlama' }, 'Plan kararı listesi')), note ? E('div', { class: 'pk-msg', 'data-kind': note.kind, 'data-testid': 'pl-note' }, note.text) : null, ...dd.errors.map((e) => E('div', { class: 'pk-msg', 'data-kind': 'error', 'data-testid': 'pl-error' }, e)), placing ? E('div', { class: 'pk-msg', 'data-kind': 'info', 'data-testid': 'pl-placing' }, `${placing.productCode ?? shortId(placing.workOrderId)} için bir makine / gün / vardiya hücresinde “Buraya yerleştir”e basın. `, E('button', { type: 'button', class: 'pk-btn sec', onClick: () => { st.placing = ''; draw(); } }, 'Vazgeç')) : null, filters, legend, st.view === 'grid' ? grid : list, detail, backlogPanel, scPanel, opPanel, E('div', { class: 'pk-src', 'data-testid': 'pl-provenance' }, `Dönem ${st.s} → ${dates[dates.length - 1]} · veri anı ${hhmm(dd.loadedAt)} (İstanbul) · kaynak: plan_blocks, plan_slot_capacity, plan_operator_load · gösterilen blok ${open.filter((b) => b.plannedDate && passes(b)).length}`));
        note = null;
        mount(container, view);
    }
    let formPre = null;
    let draft = null; // the planner's own input survives a refusal
    mount(container, E('div', { class: 'pk' }, E('style', null, PLAN_CSS), E('div', { class: 'pk-sub' }, 'Shift Planner yükleniyor…')));
    await reload();
}
const PLANNER_CSS = `
.pk-g{display:grid;gap:1px;background:var(--kmi-line,#1e2d4a);border:1px solid var(--kmi-line,#1e2d4a);border-radius:12px;min-width:max-content}
.pk-g>div{background:var(--kmi-panel,#0f1a2e);padding:6px}
.pk-gh{display:flex;flex-direction:column;font-size:12px;min-height:44px}.pk-gh small{color:var(--kmi-mut,#94a3b8)}
.pk-gm{display:flex;flex-direction:column;justify-content:center}.pk-gm small{color:var(--kmi-warn,#fbbf24);font-weight:700}
.stick{position:sticky;left:0;z-index:2}
.pk-cell{display:flex;flex-direction:column;gap:4px;min-height:72px}.pk-ch{display:flex;justify-content:space-between;gap:4px;font-size:11px;color:var(--kmi-mut,#94a3b8)}.pk-ch b{color:var(--kmi-bad,#f87171)}
.pk-cell.s-BLOCKED{background:repeating-linear-gradient(45deg,#0f1a2e,#0f1a2e 8px,#1b2740 8px,#1b2740 16px)!important}.pk-cell.s-OVER{box-shadow:inset 0 0 0 2px var(--kmi-bad,#f87171)}.pk-cell.s-FULL{box-shadow:inset 0 0 0 2px var(--kmi-warn,#fbbf24)}
.pk-track{display:flex;flex-wrap:wrap;gap:3px}
.pk-blk{min-height:36px;padding:3px 7px;border-radius:8px;border:2px solid transparent;color:#07101f;font:inherit;font-size:12px;font-weight:700;text-align:left;cursor:pointer;overflow:hidden;line-height:1.15;white-space:normal;word-break:break-word}
.pk-blk.rk-HIGH{border-color:#ef4444;outline:2px solid #ef4444}.pk-blk.rk-MEDIUM{border-color:#f59e0b;border-style:dashed}.pk-blk.rk-UNKNOWN{border-color:#e2e8f0;border-style:dotted}.pk-blk.sel{box-shadow:0 0 0 3px #fff}
.pk-put{min-height:36px;border-radius:8px;border:1px dashed var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.1);color:inherit;font:inherit;font-size:12px;cursor:pointer}
`;
