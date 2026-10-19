// KMI NEXT — Planlama (#679 C). Sipariş → iş emri → makine → operatör → vardiya.
// ÖNERİ (suggestPlan, saf/advisory) ile KARAR (commit_work_order_plan, yetkili yönetici) ayrı
// gösterilir: öneri asla kendiliğinden yazılmaz. Kapasite, makine uygunluğu (tek canonical
// kaynak: machine_eligibility), malzeme/takım hazırlığı ve kalite durumu her satırda görünür.
// Operatör önerisi sunucudan gelir (Akıllı Atama, suggest_operators — yetkinlik, aynı üründeki
// tecrübe, geçmiş fire, yük); yöneticinin öneriye uyup uymadığını SUNUCU hesaplar ve kaydeder.
import { machineSpindle } from '../machineStateLoader.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { SHIFTS, planningWarnings, suggestPlan } from '../../../../packages/domain/src/planning.js';
import { readinessLabel } from '../../../../packages/domain/src/readiness.js';
import { refusalLabelTr } from '../../../../packages/domain/src/smartAssignment.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
import { WO_STATUS_TR } from './WorkOrderHubScreen.js';
const REASON_TR = {
    PLANNED_MINUTES_REQUIRED: 'Tahmini çalışma süresi girilmeli', ASSIGNED_MACHINE_NOT_PLANNABLE: 'Atanmış makine şu an planlanamaz (arıza/bakım)', CAPACITY_EXCEEDED: 'Vardiya kapasitesi aşılıyor',
    MACHINE_BUSY: 'Makine dolu', NO_FREE_OPERATOR_IN_SHIFT: 'Vardiyada boş operatör yok', SHIFT_NOT_PRODUCTION: 'Üretim vardiyası değil', NO_SLOT: 'Uygun makine/vardiya bulunamadı', NO_PLANNABLE_MACHINE: 'Planlanabilir makine yok',
};
const reasonTr = (r) => (r ? (REASON_TR[r] ?? (r.startsWith('MACHINE_NOT_PLANNABLE') ? 'Makine planlanamaz (arıza/bakım)' : r)) : '—');
function errorText(err) {
    return sharedErrorText(err);
}
function addDays(iso, n) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
const SHIFT_LABEL = Object.fromEntries(SHIFTS.map((s) => [s.code, s.label]));
const PRODUCTION_SHIFTS = SHIFTS.filter((s) => s.production);
export async function renderPlanningScreen(container, api, opts, banner, typedMinutes = {}) {
    const days = opts.days ?? 5;
    const dates = Array.from({ length: days }, (_, i) => addDays(opts.today, i));
    let board = [];
    let load = [];
    let machines = [];
    let operators = [];
    let loadError = null;
    try {
        [board, load, machines, operators] = await Promise.all([api.board(), api.load(dates[0], dates[dates.length - 1]), api.machines(), api.operators()]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const rerender = (b) => renderPlanningScreen(container, api, opts, b);
    const withMinutes = (woId, v) => renderPlanningScreen(container, api, opts, undefined, { ...typedMinutes, [woId]: v });
    // ---- inputs for the pure suggestion engine (from the server read models only) ----
    const pMachines = machines.map((m) => ({
        id: m.machineId,
        code: m.code,
        status: m.status,
        plannedMinutes: Object.fromEntries(load.filter((l) => l.machineId === m.machineId).map((l) => [`${l.plannedDate}|${l.plannedShiftCode}`, l.plannedMinutes])),
    }));
    const plannedMachinesFor = (opId) => {
        const out = {};
        for (const b of board) {
            if (b.operatorId !== opId || !b.plannedDate || !b.plannedShiftCode || !b.machineId)
                continue;
            (out[`${b.plannedDate}|${b.plannedShiftCode}`] ??= []).push(b.machineId);
        }
        return out;
    };
    const pOperators = operators.map((o) => ({ ...o, plannedMachines: plannedMachinesFor(o.id) }));
    const machineCode = (id) => machines.find((m) => m.machineId === id)?.code ?? '—';
    const opName = (id) => operators.find((o) => o.id === id)?.name ?? '—';
    const minutesOf = (b) => typedMinutes[b.workOrderId] ?? b.plannedMinutes;
    const toPlanningWo = (b) => {
        return {
            id: b.workOrderId,
            dueDate: b.dueDate,
            plannedMinutes: minutesOf(b),
            currentMachineId: b.machineId,
            readiness: [
                { kind: 'MATERIAL', state: b.materialState, reason: b.materialReason },
                { kind: 'TOOL', state: b.toolState, reason: b.toolReason },
            ],
            openQualityHold: b.openQualityHold,
            openNcrQty: b.openNcrQty,
        };
    };
    async function commit(b, plan) {
        try {
            await api.commit({ workOrderId: b.workOrderId, machineId: plan.machineId, operatorId: plan.operatorId, plannedDate: plan.date, shiftCode: plan.shift, plannedMinutes: plan.minutes, followedSuggestion: plan.followed, reason: plan.reason });
            await rerender({ kind: 'info', text: `Plan kaydedildi (${plan.followed ? 'öneri uygulandı' : 'yönetici kararı'}).` });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    function rowFor(b) {
        const m0 = minutesOf(b);
        // Changing the estimated run time re-computes the (advisory) suggestion; nothing is saved.
        const minutes = h('input', {
            type: 'number', min: '1', step: '1', 'data-testid': 'plan-minutes-input', value: m0 === null ? '' : String(m0), style: 'width:6em',
            onChange: (e) => void withMinutes(b.workOrderId, Number(e.target.value)),
        });
        const sug = suggestPlan(toPlanningWo(b), pMachines, pOperators, dates);
        // operator of the slot suggestion = the server's Smart Assignment top candidate (not the client's guess)
        const sugOp = h('span', { 'data-testid': 'plan-suggestion-operator', 'data-state': 'loading' }, '…');
        const serverTop = async (machineId, date, shift) => (await api.suggestOperators(b.workOrderId, machineId, date, shift)).find((r) => r.eligible) ?? null;
        if (sug.machineId) {
            serverTop(sug.machineId, sug.date, sug.shiftCode).then((top) => {
                sugOp.textContent = top ? top.name : 'uygun operatör yok';
                sugOp.dataset.state = 'ready';
                sugOp.dataset.person = top?.personnelId ?? '';
            }).catch((err) => {
                sugOp.textContent = `operatör önerisi alınamadı (${errorText(err)})`;
                sugOp.dataset.state = 'error';
            });
        }
        const acceptSuggestion = async () => {
            let operatorId;
            try {
                operatorId = sugOp.dataset.state === 'ready' ? sugOp.dataset.person || null : (await serverTop(sug.machineId, sug.date, sug.shiftCode))?.personnelId ?? null;
            }
            catch (err) {
                return rerender({ kind: 'error', text: errorText(err) });
            }
            await commit(b, { machineId: sug.machineId, operatorId, date: sug.date, shift: sug.shiftCode, minutes: Number(minutes.value), followed: true, reason: null });
        };
        // Akıllı Atama panel for the slot chosen in the manual editor
        const saBox = h('div', { 'data-testid': 'plan-sa-box' });
        const showSmartAssignment = async () => {
            saBox.textContent = 'Akıllı Atama hesaplanıyor…';
            try {
                const rows = await api.suggestOperators(b.workOrderId, machineSel.value, dateIn.value, shiftSel.value);
                saBox.replaceChildren(h('div', { class: 'mut', style: 'font-size:10px;text-transform:uppercase' }, 'Akıllı Atama — öneri, karar yöneticinin'), ...rows.map((r) => h('div', { 'data-testid': 'plan-sa-cand', 'data-person': r.personnelId, 'data-rank': String(r.rank), 'data-eligible': String(r.eligible),
                    style: `padding:2px 0;${r.eligible ? '' : 'opacity:.6'}` }, `${r.rank}. ${r.name} — `, r.eligible
                    ? `yetkinlik ${r.skillScore}${r.qualification === 'NO_REQUIREMENT_DEFINED' ? ' (makinede şart tanımlı değil)' : ''} · ${r.productExperience} iş · fire ${r.scrapRate === null ? 'geçmiş yok' : `%${(r.scrapRate * 100).toFixed(1)}`} · yük ${r.loadMinutes} dk${r.presence === 'UNKNOWN' ? '' : ` · ${r.presence === 'INSIDE' ? 'içeride' : 'dışarıda'}`}`
                    : h('span', { 'data-testid': 'plan-sa-refusal' }, refusalLabelTr(r.refusal ?? '')), r.eligible ? h('button', { type: 'button', 'data-testid': 'plan-sa-pick', class: 'ghost', style: 'margin-left:6px', onClick: () => { opSel.value = r.personnelId; } }, 'Seç') : null)));
            }
            catch (err) {
                saBox.textContent = `Akıllı Atama: ${errorText(err)}`;
            }
        };
        const machineSel = h('select', { 'data-testid': 'plan-machine-select' }, ...machines.map((m) => h('option', { value: m.machineId, ...(m.machineId === (b.machineId ?? sug.machineId) ? { selected: 'selected' } : {}) }, `${m.code} — ${m.label}`)));
        const opSel = h('select', { 'data-testid': 'plan-operator-select' }, h('option', { value: '' }, '(operatör yok)'), ...operators.filter((o) => o.active && o.roles.includes('OPERATOR')).map((o) => h('option', { value: o.id, ...(o.id === (b.operatorId ?? sug.operatorId) ? { selected: 'selected' } : {}) }, `${o.name} (${SHIFT_LABEL[o.shiftCode ?? ''] ?? 'VARDİYA ATANMADI'})`)));
        const dateIn = h('input', { type: 'date', 'data-testid': 'plan-date-input', value: b.plannedDate ?? sug.date ?? dates[0] });
        const shiftSel = h('select', { 'data-testid': 'plan-shift-select' }, ...PRODUCTION_SHIFTS.map((s) => h('option', { value: s.code, ...(s.code === (b.plannedShiftCode ?? sug.shiftCode) ? { selected: 'selected' } : {}) }, s.label)));
        const reasonIn = h('input', { type: 'text', 'data-testid': 'plan-reason-input', placeholder: 'Karar notu (isteğe bağlı)' });
        const warnings = planningWarnings(toPlanningWo(b));
        return h('tr', { 'data-testid': 'plan-row', 'data-wo': b.workOrderId }, h('td', {}, h('div', { style: 'font-weight:bold' }, b.productCode ?? '—'), h('div', {}, `${b.qtyPlanned} adet · termin ${b.dueDate ?? '—'}`), h('div', { 'data-testid': 'plan-status', class: 'pill info', 'data-code': b.status }, WO_STATUS_TR[b.status] ?? b.status)), h('td', { 'data-testid': 'plan-current' }, b.plannedDate ? `${machineCode(b.machineId)} · ${b.plannedDate} ${SHIFT_LABEL[b.plannedShiftCode ?? ''] ?? ''} · ${opName(b.operatorId)} · ${b.plannedMinutes} dk` : 'PLANLANMADI'), h('td', { 'data-testid': 'plan-readiness' }, h('div', {}, `Malzeme: ${readinessLabel({ kind: 'MATERIAL', state: b.materialState, reason: b.materialReason })}`), h('div', {}, `Takım: ${readinessLabel({ kind: 'TOOL', state: b.toolState, reason: b.toolReason })}`), b.openQualityHold ? h('div', { 'data-testid': 'plan-quality-hold', class: 'pill bad' }, 'KALİTE BEKLETMESİ AÇIK') : null), h('td', { 'data-testid': 'plan-suggestion', 'data-has': String(sug.machineId !== null) }, h('div', { class: 'mut', style: 'font-size:10px;text-transform:uppercase' }, 'Öneri — atama değil'), sug.machineId
            ? h('div', {}, `${machineCode(sug.machineId)} · ${sug.date} ${SHIFT_LABEL[sug.shiftCode ?? '']} · `, sugOp)
            : h('div', { 'data-testid': 'plan-suggestion-none' }, `Öneri yok: ${reasonTr(sug.reason)}`), warnings.length ? h('div', { 'data-testid': 'plan-warnings', class: 'pill warn' }, `Uyarı: ${warnings.map(reasonTr).join(', ')}`) : null, sug.machineId
            ? h('button', { type: 'button', 'data-testid': 'plan-accept-btn', class: 'okb', onClick: () => void acceptSuggestion() }, 'Öneriyi Uygula (yetkili)')
            : null), h('td', {}, h('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' }, minutes, machineSel, opSel, dateIn, shiftSel, reasonIn, h('button', { type: 'button', 'data-testid': 'plan-sa-btn', class: 'ghost', onClick: () => void showSmartAssignment() }, 'Akıllı Atama'), h('button', { type: 'button', 'data-testid': 'plan-commit-btn', class: 'primary', onClick: () => void commit(b, { machineId: machineSel.value, operatorId: opSel.value || null, date: dateIn.value, shift: shiftSel.value, minutes: Number(minutes.value), followed: false, reason: reasonIn.value.trim() || null }) }, 'Planı Kaydet (yetkili)')), saBox));
    }
    const capacityTable = h('table', { 'data-testid': 'plan-capacity-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Makine'), ...dates.flatMap((d) => PRODUCTION_SHIFTS.map((s) => h('th', {}, `${d.slice(5)} ${s.label.replace('. Vardiya', 'V')}`))))), h('tbody', {}, ...machines.map((m) => h('tr', { 'data-testid': 'plan-capacity-row', 'data-machine': m.code }, h('td', {}, machineSpindle(null, m.code, m.status, 16), ` ${m.code} — ${m.label}`), ...dates.flatMap((d) => PRODUCTION_SHIFTS.map((s) => {
        const used = load.find((l) => l.machineId === m.machineId && l.plannedDate === d && l.plannedShiftCode === s.code)?.plannedMinutes ?? 0;
        const full = used >= s.minutes;
        return h('td', { 'data-testid': 'plan-capacity-cell', 'data-slot': `${d}|${s.code}`, class: !m.eligible && m.label !== 'BEKLEME' ? 'cap bad' : full ? 'cap warn' : 'cap ok' }, `${used}/${s.minutes}`);
    }))))));
    const screen = h('div', { class: 'planning-screen kd', style: 'max-width:100%;padding:0 16px;box-sizing:border-box' }, h('style', {}, DS_CSS + PL_CSS), h('h1', { 'data-testid': 'plan-heading' }, 'Üretim Planlama'), banner ? h('div', { class: `banner ${banner.kind}`, 'data-testid': 'plan-banner', 'data-kind': banner.kind }, banner.text) : null, loadError
        ? h('div', { class: 'banner error', 'data-testid': 'plan-load-error' }, `Yüklenemedi: ${loadError}`)
        : h('div', {}, h('h2', {}, 'Makine × vardiya kapasitesi (planlı / kapasite, dk)'), h('div', { class: 'panel', style: 'overflow-x:auto' }, capacityTable), h('h2', {}, 'Açık iş emirleri'), h('div', { class: 'panel', style: 'overflow-x:auto' }, h('table', { 'data-testid': 'plan-table' }, h('thead', {}, h('tr', {}, ...['İş emri', 'Mevcut plan', 'Hazırlık / kalite', 'Öneri', 'Karar'].map((t) => h('th', {}, t)))), h('tbody', {}, ...board.map(rowFor))))));
    mount(container, screen);
}
const PL_CSS = `.kd table{border-collapse:collapse;width:100%;font-size:13px}.kd th{text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;border-bottom:1px solid #1e293b}.kd td{padding:8px;border-top:1px solid #1e293b;vertical-align:top}.kd td.cap{text-align:center;font-weight:700}.kd td.cap.ok{background:#14532d;color:#bbf7d0}.kd td.cap.warn{background:#78350f;color:#fde68a}.kd td.cap.bad{background:#7f1d1d;color:#fecaca}.kd button{min-height:36px;font-size:13px}`;
