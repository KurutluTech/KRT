// KMI NEXT — Makine Terminali (operatör tableti / telefon, PWA). Dokunmatik öncelikli: büyük
// butonlar, tek makine, tek ekranda: aktif iş emri, üretim beyanı, ilk parça, bekleme, arıza.
// Bütün kurallar sunucuda (0029): başlatma butonunun yanındaki gerekçe sunucunun başlatma
// kapısı ÖNİZLEMESİdir (gerçek kapıyla aynı kurallar); beyan tekrarları tek kayıt sayılır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { OPERATOR_CSS, operatorButton } from '../operatorControls.js';
import { machineStateOf, HEADLINE_TR } from '../../../../packages/domain/src/machineState.js';
import { spindleForState } from '../spindle.js';
import { WO_STATUS_TR } from './WorkOrderHubScreen.js';
import { pilotBanner, pilotChip, PILOT_CSS } from '../pilotMark.js';
import { tashihPanel, TASHIH_CSS } from '../tashihPanel.js';
import { tashihCauseForm } from '../tashihCauseForm.js';
// A declaration that failed on the network keeps its numbers AND its request id: the retry is the same declaration, so a
// server that had already accepted it cannot count it twice.
const lastSnapshot = new Map();
const err = (e) => sharedErrorText(e);
const rid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
// KMI-013: ONE request id per START / FINISH attempt, kept across a failed attempt (retry = the same request, counted once by the server); dropped once the server confirmed.
const startIds = new Map();
const startRid = (wo) => { let r = startIds.get(wo); if (!r) {
    r = rid('term-start');
    startIds.set(wo, r);
} return r; };
const finishIds = new Map();
const finishRid = (wo) => { let r = finishIds.get(wo); if (!r) {
    r = rid('term-finish');
    finishIds.set(wo, r);
} return r; };
const opIds = new Map();
const opRid = (kind, op) => { const k = `${kind}:${op}`; let r = opIds.get(k); if (!r) {
    r = rid(`term-op-${kind}`);
    opIds.set(k, r);
} return r; };
export const STALE_REASON_SHORT = { NO_ACTIVITY: 'hiç hareket kaydı yok', INACTIVITY: 'uzun süredir hareket yok', SHIFT_HANDOVER: 'vardiya devri sonrası hareket yok' };
const STORE_KEY = 'kmi-next.terminal.machine';
export function remember(id) {
    try {
        if (id)
            localStorage.setItem(STORE_KEY, id);
        else
            localStorage.removeItem(STORE_KEY);
    }
    catch {
        /* storage unavailable — terminal still works, just forgets the machine */
    }
}
export function rememberedMachine() {
    try {
        return localStorage.getItem(STORE_KEY);
    }
    catch {
        return null;
    }
}
const REFUSAL_TR = [
    [/^MACHINE_BUSY/, 'Makinede çalışan başka iş var'],
    [/^MACHINE_NOT_PRODUCTION_ELIGIBLE/, 'Makine üretime uygun değil'],
    [/^MATERIAL_REQUIREMENT_UNKNOWN/, 'BOM / malzeme verisi gerekli'],
    [/^TOOL_REQUIREMENT_UNKNOWN/, 'CAM takım listesi gerekli'],
    [/^MATERIAL_SHORTAGE/, 'Malzeme eksik'],
    [/^TOOL_NOT_READY/, 'Takım bağlı değil'],
    [/MULTI_MACHINE|HARD_CAP/, 'Operatör çok-makine yetkisi yetersiz'],
    [/^OPERATOR_REQUIRED_FOR_QUALIFIED_MACHINE/, 'Bu makinede adı belli, yetkin operatör atanmalı'],
    [/^OPERATOR_NOT_QUALIFIED/, 'Operatörün bu makine için yetkinliği yok'],
    [/^OPERATOR_QUALIFICATION_EXPIRED/, 'Operatörün yetkinlik süresi dolmuş'],
    [/^PREVIOUS_OPERATION_NOT_DONE/, 'Önceki operasyon bitmedi'],
    [/^MACHINE_NOT_ALLOWED_FOR_OPERATION/, 'Bu operasyon bu makinede yapılamaz'],
    [/^NO_INPUT_QUANTITY/, 'Operasyona girecek adet yok'],
    [/^MACHINE_SKILL_REQUIREMENTS_UNKNOWN/, 'Makinenin beceri gereksinimi tanımlı değil'],
    [/^DOCUMENT_NOT_EFFECTIVE/, 'Çizim / doküman yürürlükte değil'],
    [/^OPERATION_NOT_PENDING/, 'Operasyon zaten başlamış'],
    [/^WORK_ORDER_ON_HOLD/, 'İş emri bekletmede'],
    [/^MACHINE_NOT_ELIGIBLE/, 'Makine üretime uygun değil'],
    [/^OPERATOR_REQUIRED/, 'Operatör gerekli'],
];
export function refusalText(code) {
    const hit = REFUSAL_TR.find(([re]) => re.test(code));
    return hit ? hit[1] : 'Sunucu başlatmaya izin vermiyor'; // never the raw code on screen; it stays in data-code for support
}
/** Work-order status in Turkish; an unknown status is humanised, never shown as a raw code. */
export const woStatusText = (st) => WO_STATUS_TR[st] ?? st.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'));
const CSS = `
.term{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:4px 0;max-width:980px;margin:0 auto;box-sizing:border-box;color:#e8eefc}
.term h1,.term h2{color:#fff}.term h2{font-size:14px;letter-spacing:.14em;color:#9fb0cf;margin:18px 0 6px}
.term button:not(.opb){min-height:56px;font-size:16px;font-weight:700;border-radius:12px;border:1px solid #334155;padding:0 18px;cursor:pointer;touch-action:manipulation}
.term input,.term select{min-height:56px;font-size:18px;border-radius:12px;border:1px solid #475569;background:#0f172a;color:#fff;padding:0 12px;box-sizing:border-box}
.term .card{background:linear-gradient(180deg,#111c33,#0d1527);border:1px solid #243452;border-radius:16px;padding:16px;margin:12px 0}
.term .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-weight:800;font-size:13px;letter-spacing:.04em}
.term .ok{background:#052e1a;color:#86efac;border:1px solid #166534}.term .warn{background:#2d1f03;color:#fcd34d;border:1px solid #92400e}.term .bad{background:#3a0a0a;color:#fecaca;border:1px solid #991b1b}
.term .card.ok,.term .card.bad{font-weight:700}
.term .primary{background:#1d4ed8;color:#fff}.term .ghost{background:#1e293b;color:#e2e8f0}
.term .row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.term .bar{height:14px;background:#1e293b;border-radius:7px;overflow:hidden}.term .bar>div{height:100%;background:linear-gradient(90deg,#16a34a,#4ade80)}
.term .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.term .big{font-size:34px;font-weight:900;font-variant-numeric:tabular-nums}.term .mut{color:#9fb0cf;font-size:13px}
.term .ctl{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}
${OPERATOR_CSS}
${TASHIH_CSS}
.term .ctl3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.term .ctl3 .opb,.term .ctl3 .opb-wrap{flex:none;width:100%;min-width:0}
.term .stopblk{margin-top:14px;padding:12px;border-radius:14px;border:1px solid #7f1d1d;background:rgba(127,29,29,.14)}
.term .stopblk .row{margin-bottom:10px}
@media (max-width:560px){.term .ctl3{grid-template-columns:repeat(2,minmax(0,1fr))}.term .ctl3>:first-child{grid-column:1/-1}}
`;
export async function renderTerminalScreen(container, api, state, opts = {}) {
    const go = (s) => renderTerminalScreen(container, api, s, opts);
    const icon = opts.icon ?? (() => document.createElement('span'));
    if (!state.machineId) {
        let machines = [];
        let loadError = null;
        try {
            machines = await api.machines();
        }
        catch (e) {
            loadError = err(e);
        }
        mount(container, h('div', { class: 'term', 'data-testid': 'term-root' }, h('style', {}, CSS + PILOT_CSS), h('h1', {}, 'Makine Terminali'), h('p', {}, 'Bu tablet hangi makinede? (makine QR etiketini okutarak da seçebilirsiniz)'), loadError ? h('div', { class: 'card bad', 'data-testid': 'term-error' }, loadError) : null, h('div', { class: 'grid', 'data-testid': 'term-machine-picker' }, ...machines.map((m) => h('button', { type: 'button', class: m.eligible ? 'ghost' : 'ghost', 'data-testid': 'term-pick', 'data-code': m.code,
            onClick: () => { remember(m.machineId); void go({ machineId: m.machineId }); } }, ...(m.isPilot ? [pilotChip()] : []), `${m.code}`, h('div', { style: 'font-size:11px;font-weight:600' }, m.label))))));
        return;
    }
    let snap = null;
    let loadError = null;
    let staleSince = null;
    try {
        snap = await api.terminal(state.machineId);
        lastSnapshot.set(state.machineId, snap);
    }
    catch (e) {
        loadError = err(e);
        // OFFLINE POLICY (CONTINUATION-005 §6): no offline queue. If the server cannot be reached AFTER an action, keep showing the last known state,
        // clearly marked as stale, with the typed values and request id kept — never an empty error screen and never a fake "saved".
        const cached = lastSnapshot.get(state.machineId);
        if (cached && state.banner) {
            snap = cached;
            staleSince = loadError;
        }
    }
    const machineId = state.machineId;
    let busy = false; // a second tap while the first is in flight is ignored (double tap / slow network)
    const act = async (fn, ok, keep) => {
        if (busy)
            return;
        busy = true;
        container.querySelectorAll('.term button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ machineId, banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await go({ machineId, banner: { kind: 'error', text: err(e) }, pending: keep ?? null });
        }
    };
    if (!snap) {
        mount(container, h('div', { class: 'term', 'data-testid': 'term-root' }, h('style', {}, CSS), h('div', { class: 'card bad', 'data-testid': 'term-error' }, `Yüklenemedi: ${loadError}`), h('button', { type: 'button', class: 'ghost', onClick: () => { remember(null); void go({ machineId: null }); } }, 'Makine değiştir')));
        return;
    }
    const m = snap.machine;
    let cncV = null;
    try {
        cncV = opts.cncOf ? await opts.cncOf(m.code) : null;
    }
    catch {
        cncV = null;
    }
    const chipClass = m.eligible ? 'ok' : m.label === 'BEKLEME' ? 'warn' : 'bad';
    const declareRequestId = state.pending?.requestId ?? rid('term-decl'); // kept across a failed attempt: retry = the same declaration
    const goodIn = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'data-testid': 'term-good', placeholder: 'Sağlam', style: 'width:110px', value: state.pending?.good ?? '' });
    const scrapIn = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'data-testid': 'term-scrap', placeholder: 'Fire', style: 'width:110px', value: state.pending?.scrap ?? '' });
    const reasonIn = h('input', { type: 'text', 'data-testid': 'term-reason', placeholder: 'Sebep (zorunlu)', style: 'flex:1;min-width:160px' });
    const catSel = h('select', { 'data-testid': 'term-hold-category' }, h('option', { value: 'SETUP' }, 'Ayar / hazırlık'), h('option', { value: 'TOOL' }, 'Takım bekleme'), h('option', { value: 'MATERIAL_WAIT' }, 'Malzeme bekleme'), h('option', { value: 'OTHER', selected: 'selected' }, 'Diğer'), 
    // Migration 0065: real canonical categories (formerly OTHER + a label in the reason). OEE numbers are unchanged.
    h('option', { value: 'QUALITY_WAIT' }, 'Kalite bekleme'), h('option', { value: 'OPERATOR_CAUSED' }, 'Operatör kaynaklı'), h('option', { value: 'PLANNED_STOP' }, 'Planlı duruş'));
    const holdCall = () => {
        return { cat: catSel.value, reason: reasonIn.value.trim() };
    };
    const toolCodeIn = h('input', { type: 'text', 'data-testid': 'term-tool-code', placeholder: 'Takım kodu (T…)', style: 'width:170px' });
    const toolWired = api.toolChange ? { state: 'WIRED' } : { state: 'NOT_WIRED', why: 'takım olayı bu cihazda açık değil' };
    const increment = (inp) => () => { inp.value = String((Number(inp.value || 0) || 0) + 1); inp.dispatchEvent(new Event('input')); };
    const stopBlock = h('div', { class: 'stopblk', 'data-testid': 'term-stop-block' }, h('div', { class: 'mut', style: 'margin-bottom:8px' }, 'DURUŞ üretim duruş olayını kaydeder; fiziksel acil stop değildir. Sebep zorunludur.'), h('div', { class: 'row' }, reasonIn, m.eligible ? catSel : null), h('div', { class: 'ctl' }, m.label === 'BEKLEME' && m.returnPath === 'RESUME_FROM_HOLD'
        ? operatorButton({ action: 'RESUME', icon, testid: 'term-resume', run: () => act(() => api.resume(machineId, reasonIn.value.trim()), 'Makine üretime döndü.') })
        : null, m.eligible
        ? operatorButton({ action: 'STOP', icon, testid: 'term-hold', run: () => { const c = holdCall(); return act(() => api.hold(machineId, c.reason, c.cat), 'Makine BEKLEMEDE.'); } })
        : null));
    const tashihEl = snap.active ? tashihPanel({ machineId, workOrderId: snap.active.workOrderId, productCode: snap.active.productCode, shift: null, operatorName: snap.active.operatorName ?? null,
        remainingQty: Math.max(0, snap.active.qtyPlanned - snap.active.qtyProduced - (snap.active.qtyScrap ?? 0)), initialQty: 1, errorText: err,
        submit: api.declareTashih ? (text, q, reqId) => api.declareTashih(snap.active.workOrderId, q, text, reqId) : null, onSaved: () => undefined }) : h('span', {});
    // KMI-013 FINISH: the values in SAĞLAM / FİRE become the last declaration, tashih is declared here, the session closes and the machine is free again.
    const tashihFin = h('input', { type: 'number', min: '0', inputmode: 'numeric', value: '0', 'data-testid': 'term-finish-tashih', style: 'width:110px' });
    const noteFin = h('input', { type: 'text', placeholder: 'Not (isteğe bağlı)', 'data-testid': 'term-finish-note', style: 'flex:1 1 220px' });
    const finishBlock = (w) => {
        const wired = !api.finish ? { state: 'NOT_WIRED', why: 'bitirme bu cihazda açık değil' }
            : w.status === 'IN_PROGRESS' ? { state: 'WIRED' } : { state: 'NOT_WIRED', why: 'yalnız üretimde olan iş bitirilebilir (ilk parça onayından sonra)' };
        return h('div', { class: 'card', 'data-testid': 'term-finish-block', style: 'margin-top:14px' }, h('div', { class: 'mut', style: 'margin-bottom:8px' }, 'İŞİ BİTİR: yukarıdaki SAĞLAM / FİRE değerleri son beyan olarak kaydedilir, oturum kapanır, makine boşa çıkar. Geri alınamaz. Bitiş zamanı sunucu saatiyle mühürlenir.'), h('div', { class: 'row' }, h('label', { class: 'mut' }, 'TASHİH ', tashihFin), noteFin), tashihCauseForm({ workOrderId: w.workOrderId, declared: () => Number(tashihFin.value || 0), errorText: err, newRequestId: () => rid('term-tc'),
            submit: api.reportTashihCause ? (c, reqId) => api.reportTashihCause(w.workOrderId, c, reqId) : null }), h('div', { class: 'ctl' }, operatorButton({ action: 'FINISH', icon, availability: wired,
            run: () => act(async () => { await api.finish(w.workOrderId, Number(goodIn.value || 0), Number(scrapIn.value || 0), Number(tashihFin.value || 0), noteFin.value.trim(), finishRid(w.workOrderId)); finishIds.delete(w.workOrderId); }, 'İş bitirildi — sonraki departman onayı bekleniyor.') })));
    };
    const activeCard = (w) => {
        const pct = w.qtyPlanned > 0 ? Math.min(100, Math.round((w.qtyProduced / w.qtyPlanned) * 100)) : 0;
        return h('div', { class: 'card', 'data-testid': 'term-active', 'data-wo': w.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:22px' }, ...(w.isPilot ? [pilotChip()] : []), w.productCode ?? `İş emri ${w.workOrderId.slice(0, 8)}`), h('span', { class: 'chip ok', 'data-testid': 'term-active-status', 'data-status': w.status }, icon('cnc', 16), woStatusText(w.status))), h('div', { 'data-testid': 'term-progress', class: 'big', style: 'margin:8px 0' }, `${w.qtyProduced} / ${w.qtyPlanned} sağlam · fire ${w.qtyScrap ?? 0}`), h('div', { class: 'bar' }, h('div', { style: `width:${pct}%` })), h('div', { class: 'mut', style: 'margin-top:6px' }, w.operatorName ? `Sorumlu: ${w.operatorName}` : 'Sorumlu operatör atanmamış'), h('div', { class: 'row', style: 'margin-top:12px' }, h('label', { class: 'mut' }, 'SAĞLAM ', goodIn), h('label', { class: 'mut' }, 'FİRE ', scrapIn)), h('div', { class: 'ctl3', 'data-testid': 'term-counters' }, operatorButton({ action: 'GOOD_PLUS', icon, testid: 'term-good-plus', run: increment(goodIn) }), operatorButton({ action: 'TAHSIS_PLUS', icon, testid: 'term-tashih', run: () => { tashihEl.hidden = !tashihEl.hidden; if (!tashihEl.hidden)
                tashihEl.scrollIntoView({ block: 'nearest' }); } }), operatorButton({ action: 'SCRAP_PLUS', icon, testid: 'term-scrap-plus', run: increment(scrapIn) })), tashihEl, h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'primary', style: 'min-height:64px;flex:1 1 220px;font-size:18px', 'data-testid': 'term-declare',
            onClick: () => void act(() => api.declare(w.workOrderId, Number(goodIn.value || 0), Number(scrapIn.value || 0), declareRequestId), 'Üretim kaydedildi.', { workOrderId: w.workOrderId, good: goodIn.value, scrap: scrapIn.value, requestId: declareRequestId }) }, 'ÜRETİM KAYDET'), w.status === 'IN_PROGRESS'
            ? operatorButton({ action: 'CALL_QUALITY', icon, testid: 'term-first-piece', label: 'İLK PARÇA · KALİTE ÇAĞIR', run: () => act(() => api.requestFirstPiece(w.workOrderId), 'İlk parça kalite onayına gönderildi.') })
            : null), finishBlock(w), stopBlock, h('details', { class: 'term-more', 'data-testid': 'term-more' }, h('summary', {}, 'Diğer işlemler: takım değişimi, operasyon bitir'), h('div', { class: 'ctl' }, h('div', { class: 'row' }, toolCodeIn, operatorButton({ action: 'TOOL_CHANGE', icon, availability: toolWired, testid: 'term-tool-change', run: () => act(() => api.toolChange(machineId, w.workOrderId, toolCodeIn.value.trim(), rid('term-tool')), 'Takım değişimi kaydedildi.') })))));
    };
    // ---- KMI-013 (0122): routed work orders — START / output / FINISH per OPERATION (explicit, idempotent, one session per machine)
    const opActiveCard = (o) => {
        const gIn = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'data-testid': 'term-op-good', placeholder: 'Sağlam (bu tur)', style: 'width:130px' });
        const sIn = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'data-testid': 'term-op-scrap', placeholder: 'Fire (bu tur)', style: 'width:130px' });
        const tIn = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', 'data-testid': 'term-op-tashih', placeholder: 'Tashih (bu tur)', style: 'width:130px' });
        const waitingFp = o.status === 'FIRST_PIECE_PENDING';
        const running = o.status === 'RUNNING' && !o.held;
        return h('div', { class: 'card', 'data-testid': 'term-op-active', 'data-op': o.operationId, 'data-status': o.status }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:20px' }, ...(o.isPilot ? [pilotChip()] : []), `${o.productCode ?? `İş emri ${o.workOrderId.slice(0, 8)}`} · Op ${o.opNo} ${o.name}`), h('span', { class: `chip ${o.held ? 'warn' : 'ok'}` }, icon('cnc', 16), o.held ? 'İŞ EMRİ BEKLETMEDE' : waitingFp ? 'İLK PARÇA ONAYI BEKLİYOR' : 'ÜRETİMDE')), h('div', { class: 'big', style: 'margin:8px 0', 'data-testid': 'term-op-progress' }, `${o.qtyGood ?? 0} sağlam · fire ${o.qtyScrap ?? 0} / giren ${o.qtyIn}`), h('div', { class: 'mut' }, `Başladı: ${o.startedAt ? new Date(o.startedAt).toLocaleString('tr-TR') : '—'} · son hareket: ${o.lastActivityAt ? new Date(o.lastActivityAt).toLocaleString('tr-TR') : '—'}${o.operatorName ? ` · ${o.operatorName}` : ''}`), o.staleReason ? h('div', { class: 'chip warn', style: 'margin-top:6px', 'data-testid': 'term-op-stale', 'data-reason': o.staleReason }, `BAYAT OTURUM: ${STALE_REASON_SHORT[o.staleReason] ?? o.staleReason} — otomatik bitirilmez; durumu siz bildirin`) : null, waitingFp ? h('div', { class: 'mut', style: 'margin-top:8px' }, 'Kalite ilk parçayı onaylayana kadar üretim beyanı ve bitirme kapalıdır.') : null, (o.qtyTashih ?? 0) > 0 || (o.ncrOpen ?? 0) > 0 ? h('div', { class: 'chip warn', style: 'margin-top:6px', 'data-testid': 'term-op-tashih-open' }, `TASHİH: ${o.qtyTashih ?? 0} adet kalite kararı bekliyor${(o.ncrOpen ?? 0) > 0 ? ` · vakada ${o.ncrOpen} adet` : ''} — karar verilmeden operasyon bitmez`) : null, h('div', { class: 'row', style: 'margin-top:12px' }, gIn, sIn, tIn), running && api.opReportTashihCause ? tashihCauseForm({ workOrderId: o.workOrderId, declared: () => Number(tIn.value || 0), errorText: err, newRequestId: () => rid('term-optc'),
            submit: (c, reqId) => api.opReportTashihCause(o.operationId, c, reqId) }) : null, h('div', { class: 'ctl' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'term-op-declare', disabled: !running || !api.opDeclare, style: 'min-height:64px;flex:1 1 220px;font-size:18px',
            onClick: () => void act(async () => { await api.opDeclare(o.operationId, Number(gIn.value || 0), Number(sIn.value || 0), opRid(`decl-${gIn.value}-${sIn.value}-${tIn.value || 0}`, o.operationId), Number(tIn.value || 0)); opIds.clear(); }, 'Operasyon beyanı kaydedildi.') }, 'ÜRETİM KAYDET (bu turu ekle)'), operatorButton({ action: 'FINISH', icon, testid: 'term-op-finish', label: 'OPERASYONU BİTİR', availability: api.opFinish && running ? { state: 'WIRED' } : { state: 'NOT_WIRED', why: waitingFp ? 'ilk parça onayı bekleniyor' : 'bitirme şu an açık değil' },
            run: () => act(async () => { await api.opFinish(o.operationId, opRid('fin', o.operationId)); opIds.delete(`fin:${o.operationId}`); }, 'Operasyon üretimi bitti — makine boşa çıktı.') })));
    };
    const opQueueRow = (o) => h('div', { class: 'card', 'data-testid': 'term-op-queue-row', 'data-op': o.operationId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:18px' }, ...(o.isPilot ? [pilotChip()] : []), `${o.productCode ?? `İş emri ${o.workOrderId.slice(0, 8)}`} · Op ${o.opNo} ${o.name}`), h('span', { class: 'chip warn' }, 'SIRADA')), h('div', { class: 'mut' }, `${o.qtyIn} adet girecek${o.plannedDate ? ` · ${o.plannedDate} ${o.plannedShiftCode === 'TeamK2' ? '2. Vardiya' : '1. Vardiya'}` : ''}`), o.startRefusal ? h('div', { 'data-testid': 'term-op-refusal', 'data-code': o.startRefusal, style: 'color:#fecaca;margin:8px 0;font-weight:700' }, `Başlatılamaz: ${refusalText(o.startRefusal)}`) : null, !snap.mePersonnelId ? h('div', { class: 'mut', style: 'margin:6px 0' }, 'Operasyonu başlatmak için personel kaydınız gerekli.') : null, h('div', { class: 'ctl' }, operatorButton({ action: 'START', icon, testid: 'term-op-start', disabled: !!o.startRefusal || !snap.mePersonnelId || !api.opStart,
        run: () => act(async () => { await api.opStart(o.operationId, machineId, snap.mePersonnelId, opRid('start', o.operationId)); opIds.delete(`start:${o.operationId}`); }, 'Operasyon başladı.') })));
    const queueRow = (w) => h('div', { class: 'card', 'data-testid': 'term-queue-row', 'data-wo': w.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:18px' }, ...(w.isPilot ? [pilotChip()] : []), w.productCode ?? `İş emri ${w.workOrderId.slice(0, 8)}`), h('span', { class: 'chip warn' }, woStatusText(w.status))), h('div', { class: 'mut' }, `${w.qtyPlanned} adet${w.plannedDate ? ` · ${w.plannedDate} ${w.plannedShiftCode === 'TeamK2' ? '2. Vardiya' : '1. Vardiya'}` : ''}`), w.openQualityHold ? h('div', { class: 'chip bad', style: 'margin-top:6px' }, icon('shield', 16), 'KALİTE BEKLETMESİ') : null, w.startRefusal
        ? h('div', { 'data-testid': 'term-refusal', 'data-code': w.startRefusal, style: 'color:#fecaca;margin:8px 0;font-weight:700' }, `Başlatılamaz: ${refusalText(w.startRefusal)}`)
        : null, h('div', { class: 'ctl' }, operatorButton({ action: 'START', icon, testid: 'term-start', disabled: !!w.startRefusal, run: () => act(async () => { await api.start(w.workOrderId, startRid(w.workOrderId)); startIds.delete(w.workOrderId); }, 'İş emri başlatıldı.') })));
    const stopped = m.label === 'ARIZA' || m.label === 'BAKIM';
    const screen = h('div', { class: 'term', 'data-testid': 'term-root' }, h('style', {}, CSS + PILOT_CSS), m.isPilot || snap.active?.isPilot ? pilotBanner() : null, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', { style: 'display:flex;align-items:center;gap:12px' }, h('span', { 'data-testid': 'term-spindle' }, spindleForState(machineStateOf({ cnc: cncV, status: m.status, active: [...(snap.active ? [{ runStatus: snap.active.status, stale: !!snap.active.staleReason }] : []), ...(snap.routedActive ?? []).map((o) => ({ runStatus: o.status ?? 'RUNNING', stale: !!o.staleReason }))] }), 48)), h('div', {}, h('div', { style: 'font-size:22px;font-weight:900', 'data-testid': 'term-machine' }, `${m.code} · ${m.name}`), h('span', { class: `chip ${chipClass}`, 'data-testid': 'term-machine-label' }, icon(m.eligible ? 'cnc' : 'gauge', 16), m.label), cncV ? h('div', { 'data-testid': 'term-cnc', style: 'font-size:12px;margin-top:4px;color:#64748b' }, `Fiziksel CNC (kontrol bildiriyor): ${HEADLINE_TR[machineStateOf({ status: 'UP', active: [], cnc: cncV }).headline]} · operatör oturumundan ayrı bir bilgidir`) : null)), h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'term-refresh', onClick: () => void go({ machineId }) }, '↻'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'term-change', onClick: () => { remember(null); void go({ machineId: null }); } }, 'Makine değiştir'))), staleSince ? h('div', { class: 'card bad', 'data-testid': 'term-stale' }, `BAĞLANTI YOK — aşağıdaki bilgi SON BİLİNEN durumdur, bu işlem sunucuya ULAŞMADI. Girdiğiniz değerler korundu; bağlantı gelince aynı düğmeye tekrar basın (iki kez sayılmaz). (${staleSince})`) : null, state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'term-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, stopped
        ? h('div', { class: 'card bad', 'data-testid': 'term-stopped' }, `${m.label}: makine yetkili bakım testiyle açılacak. Üretim başlatılamaz.`)
        : null, ...(snap.routedActive ?? []).map(opActiveCard), snap.active ? activeCard(snap.active) : (snap.routedActive?.length ? null : h('div', { class: 'card', 'data-testid': 'term-no-active' }, 'Bu makinede çalışan iş emri yok.')), snap.active?.staleReason ? h('div', { class: 'card warn', 'data-testid': 'term-stale-reason', 'data-reason': snap.active.staleReason }, `BAYAT OTURUM: ${STALE_REASON_SHORT[snap.active.staleReason] ?? snap.active.staleReason} — otomatik bitirilmez; durumu siz bildirin (FINISH / duruş).`) : null, h('h2', {}, 'Sıradaki işler'), ...(snap.routedQueue ?? []).map(opQueueRow), snap.queue.length || snap.routedQueue?.length ? (snap.queue.length ? h('div', {}, ...snap.queue.map(queueRow)) : null) : h('div', { class: 'card', 'data-testid': 'term-no-queue' }, 'Planlı iş yok.'), h('div', { class: 'card', 'data-testid': 'term-machine-controls' }, snap.active ? null : stopBlock, h('div', { class: 'ctl' }, stopped
        ? null
        : operatorButton({ action: 'REPORT_FAULT', icon, testid: 'term-fault', run: () => act(() => api.reportFault(machineId, reasonIn.value.trim()), 'Arıza bildirildi — bakım ekibi yetkili testle açacak.') }))));
    mount(container, screen);
}
