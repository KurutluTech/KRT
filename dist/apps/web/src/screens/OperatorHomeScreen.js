// KMI NEXT — Benim İşlerim (operatör ana ekranı, telefon önce). Operatör yalnız KENDİ işlerini görür (sunucu: operator_home);
// ekonomik / ticari veri yoktur. Makine terminaline geçiş, takım olayı ve gün sonu beyanı burada. Kayıt, sunucu kabul etmeden
// "başarılı" gösterilmez; çift dokunuş aynı istek kimliğiyle tek kayıt olur. Gün sonu beyanı üretim verisini DEĞİŞTİRMEZ.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { refusalText } from './TerminalScreen.js';
import { operatorNextStep } from '../../../../packages/domain/src/operatorNext.js';
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
.oh .job{border-left:6px solid #38bdf8}.oh .job.blocked{border-left-color:#ef4444}.oh .job.wait{border-left-color:#f59e0b}.oh .job.done{border-left-color:#22c55e}
.oh .jcode{font-size:30px;font-weight:900;line-height:1.05}.oh .jprod{font-size:17px;font-weight:700}
.oh .next{margin:8px 0;padding:10px 12px;border-radius:12px;font-size:16px;font-weight:700;background:rgba(56,189,248,.14);border:1px solid rgba(56,189,248,.4)}.oh .next.blocked{background:rgba(239,68,68,.16);border-color:rgba(239,68,68,.5)}.oh .next.wait{background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.5)}.oh .next.done{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.5)}
.oh .blockers{margin:10px 0;padding:10px 12px;border-radius:12px;background:rgba(239,68,68,.16);border:1px solid rgba(239,68,68,.5);font-weight:800}.oh .blockers div{font-size:15px;margin:2px 0}
.oh .switch{display:flex;gap:8px;overflow-x:auto;padding:4px 0}.oh .switch button{flex:0 0 auto;min-height:48px;background:#1e293b;color:#e2e8f0;border:1px solid #475569}
.oh .quick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.oh .quick a,.oh .quick button{min-height:64px;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:14px;font-size:17px;font-weight:800;text-decoration:none;background:#1e293b;color:#e2e8f0;border:1px solid #475569;padding:0 10px}
.oh .bigbtn{min-height:56px!important;font-size:18px!important}

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
        const nx = operatorNextStep(j);
        return h('div', { class: `card job ${nx.kind === 'BLOCKED' ? 'blocked' : nx.kind === 'WAIT' ? 'wait' : nx.kind === 'DONE' ? 'done' : ''}`, id: `oh-job-${j.workOrderId}`, 'data-testid': 'oh-active', 'data-wo': j.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('div', { class: 'jcode' }, j.machineCode ?? '—'), h('div', { class: 'jprod' }, j.productCode ?? 'ürün')), h('span', { class: 'chip ok' }, STATUS_TR[j.status] ?? j.status)), h('div', { class: `next ${nx.kind.toLowerCase()}`, 'data-testid': 'oh-next', 'data-kind': nx.kind }, `Sonraki adım: ${nx.text}`), h('div', {}, j.machineStatus && j.machineStatus !== 'UP' ? h('span', { class: 'chip bad', 'data-testid': 'oh-machine-stopped' }, `Makine: ${MACHINE_TR[j.machineStatus] ?? j.machineStatus}`) : null, j.openQualityHold ? h('span', { class: 'chip bad' }, 'KALİTE BEKLETMESİ') : null, j.firstPiece === 'PENDING' ? h('span', { class: 'chip warn' }, 'İlk parça onay bekliyor') : null, j.firstPiece === 'APPROVED' ? h('span', { class: 'chip ok' }, 'İlk parça onaylı') : null), h('div', { 'data-testid': 'oh-progress', style: 'margin:6px 0' }, `${j.qtyProduced} / ${j.qtyPlanned} sağlam · fire ${j.qtyScrap}`), h('div', { class: 'bar' }, h('div', { style: `width:${pct}%` })), h('div', { style: 'font-size:13px;color:#475569;margin:6px 0' }, `Son işlem: ${hhmm(j.lastEventAt)}`), h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary bigbtn', 'data-testid': 'oh-open-terminal', onClick: () => j.machineId && opts.openTerminal(j.machineId) }, 'Üretim bildir · terminali aç'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-tool-toggle', onClick: () => void go({ ...state, banner: undefined, toolFor: open ? null : j.workOrderId }) }, 'Takım olayı')), open && j.machineId
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
    mount(container, h('div', { class: 'oh', 'data-testid': 'oh-root' }, h('style', {}, CSS), h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('div', { style: 'font-size:22px;font-weight:900', 'data-testid': 'oh-name' }, home.person.name), h('div', { style: 'font-size:14px;color:#475569', 'data-testid': 'oh-shift' }, `Vardiya: ${home.person.shiftCode ?? home.person.currentShift ?? 'belirsiz'} · son işlem ${hhmm(home.lastActionAt)}`)), h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-refresh', onClick: () => void go({}) }, '↻')), state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'oh-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, h('div', {}, h('span', { class: 'chip info', 'data-testid': 'oh-machine-count' }, `${home.machineCount} makine`), h('button', { type: 'button', class: `chip ${home.lateTasks ? 'bad' : 'info'}`, style: 'min-height:44px;border:0;padding:0 14px', 'data-testid': 'oh-tasks', onClick: () => opts.goTasks() }, `${home.openTasks} görev${home.lateTasks ? ` · ${home.lateTasks} geç` : ''}`)), (() => { const bl = home.active.map((j) => ({ j, n: operatorNextStep(j) })).filter((x) => x.n.blocker); return bl.length ? h('div', { class: 'blockers', role: 'alert', 'data-testid': 'oh-blockers' }, ...bl.map((x) => h('div', {}, `${x.j.machineCode ?? '—'} · ${x.j.productCode ?? 'ürün'}: ${x.n.blocker}`))) : null; })(), home.active.length >= 2 ? h('div', { class: 'switch', 'data-testid': 'oh-switch', role: 'group', 'aria-label': 'Makineler arası geçiş' }, ...home.active.map((j) => h('button', { type: 'button', 'data-testid': 'oh-switch-item', onClick: () => document.getElementById(`oh-job-${j.workOrderId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, `${j.machineCode ?? '—'} · ${j.productCode ?? 'ürün'}`))) : null, h('h2', {}, 'Çalıştığım işler'), home.active.length ? h('div', {}, ...home.active.map(jobCard)) : h('div', { class: 'card', 'data-testid': 'oh-no-active' }, 'Şu an çalışan işiniz yok.'), h('div', { class: 'quick', 'data-testid': 'oh-quick' }, h('a', { href: '#/tara', 'data-testid': 'oh-scan' }, 'QR / Barkod okut'), h('button', { type: 'button', 'data-testid': 'oh-tasks-big', onClick: () => opts.goTasks() }, `Görevlerim${home.openTasks ? ` (${home.openTasks})` : ''}`)), h('h2', {}, 'Sıradaki işlerim'), home.assigned.length
        ? h('div', {}, ...home.assigned.map((a) => h('div', { class: 'card', 'data-testid': 'oh-assigned', 'data-wo': a.workOrderId }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', {}, `${a.machineCode ?? 'makine yok'} · ${a.productCode ?? 'ürün'}`), h('span', { class: 'chip warn' }, STATUS_TR[a.status] ?? a.status)), h('div', {}, `${a.qtyPlanned} adet${a.plannedDate ? ` · ${a.plannedDate}` : ''}`), a.openQualityHold ? h('span', { class: 'chip bad' }, 'KALİTE BEKLETMESİ') : null, a.startRefusal ? h('div', { 'data-testid': 'oh-refusal', style: 'color:#991b1b;margin:6px 0' }, `Başlatılamaz: ${refusalText(a.startRefusal)}`) : h('div', { class: 'chip ok' }, 'Başlatmaya hazır'), a.machineId ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-assigned-terminal', onClick: () => opts.openTerminal(a.machineId) }, 'Terminalde aç') : null)))
        : h('div', { class: 'card', 'data-testid': 'oh-no-assigned' }, 'Size atanmış bekleyen iş yok.'), h('h2', {}, 'Gün sonu'), summaryBlock ?? h('button', { type: 'button', class: 'ghost', 'data-testid': 'oh-summary-open', style: 'width:100%',
        onClick: () => void (async () => { try {
            await go({ summary: await api.daySummary() });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) } });
        } })() }, 'Gün sonu özetimi göster')));
}
