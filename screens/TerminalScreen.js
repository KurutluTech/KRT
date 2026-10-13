// KMI NEXT — Makine Terminali (operatör tableti / telefon, PWA). Dokunmatik öncelikli: büyük
// butonlar, tek makine, tek ekranda: aktif iş emri, üretim beyanı, ilk parça, bekleme, arıza.
// Bütün kurallar sunucuda (0029): başlatma butonunun yanındaki gerekçe sunucunun başlatma
// kapısı ÖNİZLEMESİdir (gerçek kapıyla aynı kurallar); beyan tekrarları tek kayıt sayılır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
// A declaration that failed on the network keeps its numbers AND its request id: the retry is the same declaration, so a
// server that had already accepted it cannot count it twice.
const lastSnapshot = new Map();
const err = (e) => sharedErrorText(e);
const rid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
];
export function refusalText(code) {
    const hit = REFUSAL_TR.find(([re]) => re.test(code));
    return hit ? `${hit[1]} (${code})` : code;
}
const CSS = `
.term{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:820px;margin:0 auto;box-sizing:border-box;background:#f4f6fa;min-height:100vh;color:#0f172a}
.term button{min-height:48px;font-size:16px;font-weight:700;border-radius:12px;border:0;padding:0 16px;cursor:pointer}
.term input,.term select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #cbd5e1;padding:0 10px;box-sizing:border-box}
.term .card{background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.term .chip{display:inline-block;padding:4px 10px;border-radius:999px;font-weight:800;font-size:13px}
.term .ok{background:#dcfce7;color:#166534}.term .warn{background:#fef3c7;color:#92400e}.term .bad{background:#fee2e2;color:#991b1b}
.term .primary{background:#1d4ed8;color:#fff}.term .danger{background:#dc2626;color:#fff}.term .ghost{background:#e2e8f0;color:#0f172a}
.term .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.term .bar{height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden}.term .bar>div{height:100%;background:#16a34a}
.term .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
`;
export async function renderTerminalScreen(container, api, state) {
    const go = (s) => renderTerminalScreen(container, api, s);
    if (!state.machineId) {
        let machines = [];
        let loadError = null;
        try {
            machines = await api.machines();
        }
        catch (e) {
            loadError = err(e);
        }
        mount(container, h('div', { class: 'term', 'data-testid': 'term-root' }, h('style', {}, CSS), h('h1', {}, 'Makine Terminali'), h('p', {}, 'Bu tablet hangi makinede? (makine QR etiketini okutarak da seçebilirsiniz)'), loadError ? h('div', { class: 'card bad', 'data-testid': 'term-error' }, loadError) : null, h('div', { class: 'grid', 'data-testid': 'term-machine-picker' }, ...machines.map((m) => h('button', { type: 'button', class: m.eligible ? 'ghost' : 'ghost', 'data-testid': 'term-pick', 'data-code': m.code,
            onClick: () => { remember(m.machineId); void go({ machineId: m.machineId }); } }, `${m.code}`, h('div', { style: 'font-size:11px;font-weight:600' }, m.label))))));
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
    const activeCard = (w) => {
        const pct = w.qtyPlanned > 0 ? Math.min(100, Math.round((w.qtyProduced / w.qtyPlanned) * 100)) : 0;
        return h('div', { class: 'card', 'data-testid': 'term-active', 'data-wo': w.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:20px' }, w.productCode ?? `İş emri ${w.workOrderId.slice(0, 8)}`), h('span', { class: 'chip ok', 'data-testid': 'term-active-status' }, w.status)), h('div', { 'data-testid': 'term-progress', style: 'margin:8px 0;font-size:18px' }, `${w.qtyProduced} / ${w.qtyPlanned} sağlam · fire ${w.qtyScrap ?? 0}`), h('div', { class: 'bar' }, h('div', { style: `width:${pct}%` })), h('div', { class: 'row', style: 'margin-top:12px' }, goodIn, scrapIn, h('button', { type: 'button', class: 'primary', 'data-testid': 'term-declare',
            onClick: () => void act(() => api.declare(w.workOrderId, Number(goodIn.value || 0), Number(scrapIn.value || 0), declareRequestId), 'Üretim kaydedildi.', { workOrderId: w.workOrderId, good: goodIn.value, scrap: scrapIn.value, requestId: declareRequestId }) }, 'Üretim Kaydet')), w.status === 'IN_PROGRESS'
            ? h('button', { type: 'button', class: 'ghost', style: 'margin-top:8px', 'data-testid': 'term-first-piece',
                onClick: () => void act(() => api.requestFirstPiece(w.workOrderId), 'İlk parça kalite onayına gönderildi.') }, 'İlk Parçayı Kaliteye Gönder')
            : null);
    };
    const queueRow = (w) => h('div', { class: 'card', 'data-testid': 'term-queue-row', 'data-wo': w.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, w.productCode ?? `İş emri ${w.workOrderId.slice(0, 8)}`), h('span', { class: 'chip warn' }, w.status)), h('div', {}, `${w.qtyPlanned} adet${w.plannedDate ? ` · ${w.plannedDate} ${w.plannedShiftCode === 'TeamK2' ? '2. Vardiya' : '1. Vardiya'}` : ''}`), w.openQualityHold ? h('div', { class: 'chip bad' }, 'KALİTE BEKLETMESİ') : null, w.startRefusal
        ? h('div', { 'data-testid': 'term-refusal', style: 'color:#991b1b;margin:6px 0' }, `Başlatılamaz: ${refusalText(w.startRefusal)}`)
        : null, h('button', { type: 'button', class: 'primary', 'data-testid': 'term-start', disabled: w.startRefusal ? true : undefined,
        onClick: () => void act(() => api.start(w.workOrderId), 'İş emri başlatıldı.') }, 'Başlat'));
    const screen = h('div', { class: 'term', 'data-testid': 'term-root' }, h('style', {}, CSS), h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('div', { style: 'font-size:22px;font-weight:900', 'data-testid': 'term-machine' }, `${m.code} · ${m.name}`), h('span', { class: `chip ${chipClass}`, 'data-testid': 'term-machine-label' }, m.label)), h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'term-refresh', onClick: () => void go({ machineId }) }, '↻'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'term-change', onClick: () => { remember(null); void go({ machineId: null }); } }, 'Makine değiştir'))), staleSince ? h('div', { class: 'card bad', 'data-testid': 'term-stale' }, `BAĞLANTI YOK — aşağıdaki bilgi SON BİLİNEN durumdur, bu işlem sunucuya ULAŞMADI. Girdiğiniz değerler korundu; bağlantı gelince aynı düğmeye tekrar basın (iki kez sayılmaz). (${staleSince})`) : null, state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'term-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, m.label === 'ARIZA' || m.label === 'BAKIM'
        ? h('div', { class: 'card bad', 'data-testid': 'term-stopped' }, `${m.label}: makine yetkili bakım testiyle açılacak. Üretim başlatılamaz.`)
        : null, snap.active ? activeCard(snap.active) : h('div', { class: 'card', 'data-testid': 'term-no-active' }, 'Bu makinede çalışan iş emri yok.'), h('h2', {}, 'Sıradaki işler'), snap.queue.length ? h('div', {}, ...snap.queue.map(queueRow)) : h('div', { class: 'card', 'data-testid': 'term-no-queue' }, 'Planlı iş yok.'), h('div', { class: 'card' }, h('div', { class: 'row' }, reasonIn), h('div', { class: 'row', style: 'margin-top:8px' }, m.label === 'BEKLEME' && m.returnPath === 'RESUME_FROM_HOLD'
        ? h('button', { type: 'button', class: 'primary', 'data-testid': 'term-resume', onClick: () => void act(() => api.resume(machineId, reasonIn.value.trim()), 'Makine üretime döndü.') }, 'Üretime Dön')
        : null, m.eligible ? catSel : null, m.eligible
        ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'term-hold', onClick: () => { const c = holdCall(); void act(() => api.hold(machineId, c.reason, c.cat), 'Makine BEKLEMEDE.'); } }, 'Beklemeye Al')
        : null, m.label === 'ARIZA' || m.label === 'BAKIM'
        ? null
        : h('button', { type: 'button', class: 'danger', 'data-testid': 'term-fault', onClick: () => void act(() => api.reportFault(machineId, reasonIn.value.trim()), 'Arıza bildirildi — bakım ekibi yetkili testle açacak.') }, 'ARIZA BİLDİR'))));
    mount(container, screen);
}
