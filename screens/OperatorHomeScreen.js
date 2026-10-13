// KMI NEXT — Benim İşlerim (operatör ana ekranı, telefon önce). Operatör yalnız KENDİ işlerini görür (sunucu: operator_home);
// ekonomik / ticari veri yoktur. Makine terminaline geçiş, takım olayı ve gün sonu beyanı burada. Kayıt, sunucu kabul etmeden
// "başarılı" gösterilmez; çift dokunuş aynı istek kimliğiyle tek kayıt olur. Gün sonu beyanı üretim verisini DEĞİŞTİRMEZ.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { refusalText } from './TerminalScreen.js';
const rid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const CSS = `
.oh{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:640px;margin:0 auto;box-sizing:border-box;color:#0f172a}
.oh button{min-height:48px;font-size:16px;font-weight:700;border-radius:12px;border:0;padding:0 14px;cursor:pointer}
.oh button[disabled]{opacity:.5;cursor:not-allowed}
.oh input,.oh select,.oh textarea{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #cbd5e1;padding:6px 10px;box-sizing:border-box;width:100%}
.oh .card{background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.oh .chip{display:inline-block;padding:4px 10px;border-radius:999px;font-weight:800;font-size:13px;margin:2px 4px 2px 0}
.oh .ok{background:#dcfce7;color:#166534}.oh .warn{background:#fef3c7;color:#92400e}.oh .bad{background:#fee2e2;color:#991b1b}.oh .info{background:#e0e7ff;color:#3730a3}
.oh .primary{background:#1d4ed8;color:#fff}.oh .ghost{background:#e2e8f0;color:#0f172a}
.oh .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.oh .bar{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}.oh .bar>div{height:100%;background:#16a34a}
.oh h2{font-size:18px;margin:16px 0 4px}
`;
const KIND_TR = { CHANGE: 'Takım değişimi', BREAK: 'Takım kırıldı', WORN: 'Takım aşındı' };
const MACHINE_TR = { DOWN: 'ARIZA', HOLD: 'BEKLEME', MAINTENANCE: 'BAKIM', UP: 'ÇALIŞIYOR' };
const STATUS_TR = { IN_PROGRESS: 'ÜRETİMDE', FIRST_PIECE_PENDING: 'İLK PARÇA KALİTEDE', FIRST_PIECE_APPROVED: 'İLK PARÇA ONAYLI', PLANNED: 'PLANLI', MACHINE_ASSIGNED: 'MAKİNE ATANDI', ON_HOLD: 'BEKLETİLİYOR' };
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) : '—');
export async function renderOperatorHomeScreen(container, api, opts, state = {}) {
    const go = (s) => renderOperatorHomeScreen(container, api, opts, s);
    let home;
    try {
        home = await api.home();
    }
    catch (e) {
        mount(container, h('div', { class: 'oh', 'data-testid': 'oh-root' }, h('style', {}, CSS), h('div', { class: 'card bad', 'data-testid': 'oh-error' }, `Yüklenemedi: ${errorText(e)}`), h('button', { type: 'button', class: 'ghost', onClick: () => void go({}) }, 'Tekrar dene')));
        return;
    }
    if (!home.linked) {
        mount(container, h('div', { class: 'oh', 'data-testid': 'oh-root' }, h('style', {}, CSS), h('div', { class: 'card warn', 'data-testid': 'oh-unlinked' }, 'Giriş hesabınız bir personel kaydına bağlı değil. Yöneticinize başvurun; bağlanınca işleriniz burada görünür.')));
        return;
    }
    const busy = { v: false };
    const act = async (fn, ok, keep) => {
        if (busy.v)
            return;
        busy.v = true;
        container.querySelectorAll('.oh button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) }, ...keep });
        }
    };
    const jobCard = (j) => {
        const pct = j.qtyPlanned > 0 ? Math.min(100, Math.round((j.qtyProduced / j.qtyPlanned) * 100)) : 0;
        const open = state.toolFor === j.workOrderId;
        const kindSel = h('select', { 'data-testid': 'oh-tool-kind' }, ...Object.keys(KIND_TR).map((k) => h('option', { value: k, selected: state.draft?.kind === k ? 'selected' : undefined }, KIND_TR[k])));
        const codeIn = h('input', { type: 'text', 'data-testid': 'oh-tool-code', placeholder: 'Takım kodu / barkod', value: state.draft?.code ?? '' });
        const noteIn = h('input', { type: 'text', 'data-testid': 'oh-tool-note', placeholder: 'Not (isteğe bağlı)', value: state.draft?.note ?? '' });
        const toolRid = state.draft?.rid ?? rid('oh-tool'); // kept across a failed attempt: a retry is the same event
        return h('div', { class: 'card', 'data-testid': 'oh-active', 'data-wo': j.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:19px' }, `${j.machineCode ?? '—'} · ${j.productCode ?? 'ürün'}`), h('span', { class: 'chip ok' }, STATUS_TR[j.status] ?? j.status)), h('div', {}, j.machineStatus && j.machineStatus !== 'UP' ? h('span', { class: 'chip bad', 'data-testid': 'oh-machine-stopped' }, `Makine: ${MACHINE_TR[j.machineStatus] ?? j.machineStatus}`) : null, j.openQualityHold ? h('span', { class: 'chip bad' }, 'KALİTE BEKLETMESİ') : null, j.firstPiece === 'PENDING' ? h('span', { class: 'chip warn' }, 'İlk parça onay bekliyor') : null, j.firstPiece === 'APPROVED' ? h('span', { class: 'chip ok' }, 'İlk parça onaylı') : null), h('div', { 'data-testid': 'oh-progress', style: 'margin:6px 0' }, `${j.qtyProduced} / ${j.qtyPlanned} sağlam · fire ${j.qtyScrap}`), h('div', { class: 'bar' }, h('div', { style: `width:${pct}%` })), h('div', { style: 'font-size:13px;color:#475569;margin:6px 0' }, `Son işlem: ${hhmm(j.lastEventAt)}`), h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'oh-open-terminal', onClick: () => j.machineId && opts.openTerminal(j.machineId) }, 'Terminali aç'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-tool-toggle', onClick: () => void go({ ...state, banner: undefined, toolFor: open ? null : j.workOrderId }) }, 'Takım olayı')), open && j.machineId
            ? h('div', { 'data-testid': 'oh-tool-form', style: 'margin-top:10px;display:grid;gap:8px' }, kindSel, codeIn, noteIn, h('button', { type: 'button', class: 'primary', 'data-testid': 'oh-tool-save', onClick: () => void act(() => api.toolEvent(j.machineId, j.workOrderId, kindSel.value, codeIn.value.trim(), noteIn.value.trim(), toolRid), 'Takım olayı kaydedildi (takımhane görür).', { toolFor: j.workOrderId, draft: { kind: kindSel.value, code: codeIn.value, note: noteIn.value, rid: toolRid } }) }, 'Kaydet'), h('div', { style: 'font-size:12px;color:#475569' }, 'Bu kayıt takımhaneye bildirimdir; takım ömrünü / yerini takımhane işler.'))
            : null);
    };
    const sum = state.summary;
    const summaryBlock = sum
        ? h('div', { class: 'card', 'data-testid': 'oh-summary' }, h('strong', {}, `Gün sonu — ${sum.date} · ${sum.shiftCode ?? 'vardiya belirsiz'}`), h('div', { 'data-testid': 'oh-summary-decl' }, `Beyan: ${sum.declarations.reduce((a, d) => a + d.good, 0)} sağlam · ${sum.declarations.reduce((a, d) => a + d.scrap, 0)} fire (${sum.declarations.length} kayıt)`), h('div', {}, `Duruş/makine olayı: ${sum.machineEvents.length} · Takım olayı: ${sum.toolEvents.length}`), sum.qualityPending.length ? h('div', { class: 'chip warn' }, `Kalite bekleyen: ${sum.qualityPending.length}`) : null, sum.openIssues.length ? h('div', { class: 'chip bad' }, `Açık sorun: ${sum.openIssues.map((i) => `${i.machineCode} ${MACHINE_TR[i.status] ?? i.status}`).join(', ')}`) : null, ...sum.openWork.filter((w) => !w.declaredToday).map((w) => h('div', { class: 'chip warn', 'data-testid': 'oh-missing-decl' }, `Bugün beyan yok: ${w.machineCode ?? ''} ${w.productCode ?? ''}`)), sum.confirmedAt
            ? h('div', { class: 'chip ok', 'data-testid': 'oh-confirmed' }, `Vardiya doğrulandı ${hhmm(sum.confirmedAt)}`)
            : h('div', { style: 'display:grid;gap:8px;margin-top:8px' }, h('textarea', { 'data-testid': 'oh-shift-note', rows: '2', placeholder: 'Not (isteğe bağlı): açık sorun, devir bilgisi', value: state.draft?.shiftNote ?? '' }), h('button', { type: 'button', class: 'primary', 'data-testid': 'oh-confirm',
                onClick: () => void act(() => api.confirmShiftEnd(container.querySelector('[data-testid="oh-shift-note"]').value.trim()), 'Vardiyanız doğrulandı. Üretim kayıtları değişmedi.') }, 'Vardiyamı doğrula'), h('div', { style: 'font-size:12px;color:#475569' }, 'Doğrulama yalnız “bu özet doğru” demektir; üretim kayıtlarını değiştirmez. Eksik beyan varsa önce terminalden kaydedin.')))
        : null;
    mount(container, h('div', { class: 'oh', 'data-testid': 'oh-root' }, h('style', {}, CSS), h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('div', { style: 'font-size:22px;font-weight:900', 'data-testid': 'oh-name' }, home.person.name), h('div', { style: 'font-size:14px;color:#475569', 'data-testid': 'oh-shift' }, `Vardiya: ${home.person.shiftCode ?? home.person.currentShift ?? 'belirsiz'} · son işlem ${hhmm(home.lastActionAt)}`)), h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-refresh', onClick: () => void go({}) }, '↻')), state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'oh-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, h('div', {}, h('span', { class: 'chip info', 'data-testid': 'oh-machine-count' }, `${home.machineCount} makine`), h('button', { type: 'button', class: `chip ${home.lateTasks ? 'bad' : 'info'}`, style: 'min-height:0;border:0', 'data-testid': 'oh-tasks', onClick: () => opts.goTasks() }, `${home.openTasks} görev${home.lateTasks ? ` · ${home.lateTasks} geç` : ''}`)), h('h2', {}, 'Çalıştığım işler'), home.active.length ? h('div', {}, ...home.active.map(jobCard)) : h('div', { class: 'card', 'data-testid': 'oh-no-active' }, 'Şu an çalışan işiniz yok.'), h('h2', {}, 'Sıradaki işlerim'), home.assigned.length
        ? h('div', {}, ...home.assigned.map((a) => h('div', { class: 'card', 'data-testid': 'oh-assigned', 'data-wo': a.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, `${a.machineCode ?? 'makine yok'} · ${a.productCode ?? 'ürün'}`), h('span', { class: 'chip warn' }, STATUS_TR[a.status] ?? a.status)), h('div', {}, `${a.qtyPlanned} adet${a.plannedDate ? ` · ${a.plannedDate}` : ''}`), a.openQualityHold ? h('span', { class: 'chip bad' }, 'KALİTE BEKLETMESİ') : null, a.startRefusal ? h('div', { 'data-testid': 'oh-refusal', style: 'color:#991b1b;margin:6px 0' }, `Başlatılamaz: ${refusalText(a.startRefusal)}`) : h('div', { class: 'chip ok' }, 'Başlatmaya hazır'), a.machineId ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-assigned-terminal', onClick: () => opts.openTerminal(a.machineId) }, 'Terminalde aç') : null)))
        : h('div', { class: 'card', 'data-testid': 'oh-no-assigned' }, 'Size atanmış bekleyen iş yok.'), h('h2', {}, 'Gün sonu'), summaryBlock ?? h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-summary-open', style: 'width:100%',
        onClick: () => void (async () => { try {
            await go({ summary: await api.daySummary() });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) } });
        } })() }, 'Gün sonu özetimi göster')));
}
