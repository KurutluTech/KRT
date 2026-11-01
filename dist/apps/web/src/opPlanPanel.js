// KMI NEXT — İş emri ana makinesi ile OPERASYON bazlı makineleri ayıran salt-okunur panel (op_prep_matrix).
// Rota tanımlı olmayan slotlardaki makine "ÖNERİ"dir; owner kesinleştirmeden gerçek rota sayılmaz.
import { h } from '../../../packages/ui/src/h.js';
const RS = { IN_ROUTE_ACTIVE: 'Rotada (aktif)', NOT_DEFINED: 'Rotada TANIMSIZ' };
export function renderOpPlanPanel(root, wo, matrix, machineName) {
    const slots = matrix?.slots ?? [];
    const rows = slots.map((s) => {
        const defined = s.routeStatus === 'IN_ROUTE_ACTIVE';
        // aynı eksik iki yerde sayılmasın: "rota iş emrine uygulanmadı" ve "kontrol planı" zaten iş emri seviyesinde / ayrı satırda; fixture yalnız bilgi
        const dupBlock = (b) => b === 'ROUTE_NOT_APPLIED_TO_WORK_ORDER' || /^QC_PASS_WILL_BLOCK:/.test(b);
        const miss = (s.blockReasons ?? []).filter((b) => !dupBlock(b)).length + (s.missing ?? []).filter((m) => !['fixture', 'eligible_operator', 'machine_skill_requirements', 'material_stock'].includes(m)).length;
        const notApplied = (s.blockReasons ?? []).includes('ROUTE_NOT_APPLIED_TO_WORK_ORDER');
        const draftSlot = !defined && s.slot !== 'CUT_PREP';   // onaysız OP10/20/40: zorunluluk değil, öneri
        return h('tr', { 'data-testid': 'opplan-row', 'data-slot': s.slot },
            h('td', {}, s.slot === 'CUT_PREP' ? 'CUT/PREP (OP numarası dışı)' : s.slot),
            h('td', {}, RS[s.routeStatus] ?? s.routeStatus ?? '—'),
            h('td', {}, `${s.expectedMachine ?? '—'}${defined ? '' : ' (ÖNERİ — kesinleşmedi)'}`),
            h('td', {}, s.camProgram ? 'Bağlı' : (s.slot === 'CUT_PREP' ? 'Gerekmiyor' : 'Bağlı değil')),
            h('td', {}, String(s.eligibleOperators ?? 0)),
            h('td', {}, draftSlot ? 'Onaysız öneri — rota tanımlanınca denetlenir' : miss ? `${miss} eksik` : (notApplied ? 'Tamam (rota iş emrine uygulanmadı)' : 'Tamam')));
    });
    root.replaceChildren(h('section', { 'data-testid': 'opplan', class: 'woc-panel' },
        h('h3', {}, 'Rota ve operasyon makineleri'),
        h('div', { class: 'woc-meta', 'data-testid': 'opplan-note' }, `İş emri kartındaki makine (${machineName ?? '—'}) yalnızca ana atamadır; her operasyonun makinesi ayrıdır.`),
        h('div', { style: 'overflow-x:auto' }, h('table', { class: 'woc-meta', style: 'width:100%;border-collapse:collapse' },
            h('thead', {}, h('tr', {}, ...['Operasyon', 'Rota', 'Makine', 'CAM', 'Uygun operatör', 'Hazırlık'].map((t) => h('th', { style: 'text-align:left;padding:4px 8px' }, t)))),
            h('tbody', {}, ...rows)))));
}
