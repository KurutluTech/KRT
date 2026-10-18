// KMI PRE-012 — operator work-order card: pure view model (no I/O). ONE evaluator for readiness (woReadiness.collectBlockers over the server's
// start-preview refusal / readiness rows); unknown stays BİLİNMİYOR; the card never carries a price, customer or purchase-order field.
import { collectBlockers, readinessHeadline } from './woReadiness.js';
const RUNNING = ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED'];
const STARTABLE = ['PLANNED', 'MACHINE_ASSIGNED'];
export function buildOperatorWoCard(r) {
    const good = Math.max(0, r.qtyProduced);
    const scrap = Math.max(0, r.qtyScrap);
    const remaining = Math.max(0, r.qtyPlanned - good - scrap);
    const preStart = STARTABLE.includes(r.status);
    // readiness is only meaningful before the start; once running, the server already let it start
    // the DEFINER start-preview is authoritative (same call the terminal uses). The invoker readiness rows are RLS-scoped: for an operator the stock/PO joins
    // are invisible, which would report a phantom shortage — so rows are only a fallback when the preview could not be asked.
    const rows = r.refusalKnown ? null : r.readinessRows;
    const blockers = preStart ? collectBlockers(r.workOrderId, rows, r.refusal) : [];
    const known = !preStart || r.refusalKnown || (rows !== null && rows.length > 0);
    const head = !preStart ? { text: r.status === 'COMPLETED' ? 'TAMAMLANDI' : r.status === 'ON_HOLD' ? 'BEKLETİLİYOR' : 'ÜRETİMDE', tone: (r.status === 'ON_HOLD' ? 'bad' : 'ok') }
        : readinessHeadline(known ? blockers.length : null);
    const running = RUNNING.includes(r.status);
    const hold = r.openQualityHold || r.status === 'ON_HOLD';
    const machineOk = !!r.machine && (r.machine.status === null || r.machine.status === 'UP');
    const terminalOk = !!r.machine && !hold && (running || (preStart && blockers.length === 0 && known));
    const actions = [
        { id: 'terminal', label: running ? 'Üretim bildir · terminali aç' : 'Başlat · terminali aç', enabled: terminalOk && machineOk,
            why: !r.machine ? 'Makine atanmamış — yöneticinize bildirin.' : hold ? 'Kalite bekletmesi açık; kalite kararı bekleniyor.' : !machineOk ? 'Makine çalışır durumda değil.'
                : preStart && !known ? 'Hazırlık durumu bilinmiyor; başlatma yapılamaz.' : preStart && blockers.length ? 'Önce hazırlık eksikleri giderilmeli.' : null },
        { id: 'tool', label: 'Takım olayı bildir', enabled: !!r.machine, why: r.machine ? null : 'Makine atanmamış.' },
        { id: 'scan', label: 'QR / barkod okut', enabled: true, why: null },
        { id: 'task', label: 'Görevlerim', enabled: true, why: null },
    ];
    const currentOp = r.operations.find((o) => !['COMPLETED', 'DONE', 'SKIPPED', 'CANCELLED'].includes(o.status)) ?? r.operations[r.operations.length - 1] ?? null;
    return { qty: { planned: r.qtyPlanned, good, scrap, remaining, reserved: r.reservedMaterial, overrun: good + scrap > r.qtyPlanned },
        readiness: { text: head.text, tone: head.tone, blockers, known }, actions, startable: preStart && known && blockers.length === 0, currentOp };
}
