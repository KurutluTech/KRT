// KMI NEXT — İş emri ana makinesi ile OPERASYON bazlı makineleri ayıran salt-okunur panel (op_prep_matrix).
// Rota tanımlı olmayan slotlardaki makine "ÖNERİ"dir; owner kesinleştirmeden gerçek rota sayılmaz.
import { h } from '../../../packages/ui/src/h.js';
/** m0219: bıçak kanıt durumu — kayıt yoksa 'doğrulanmadı' yazılır, uydurulmaz. */
export const BLADE_TR = { NOT_DEFINED: 'Bıçak tanımsız', DEFINED_NO_TOOLROOM_RECORD: 'Bıçak tanımlı — takımhane kaydı yok (doğrulanmadı)', TOOLROOM_RECORD_FOUND: 'Takımhane kaydı var', LIFE_EXHAUSTED: 'Bıçak ömrü doldu' };
export const reqCell = (s) => s.machineType === 'BANDSAW' ? 'Gerekmiyor (şerit testere)' : null;
export const timeCell = (s) => (s.setupMinutes != null || s.cycleSeconds != null) ? `${s.setupMinutes ?? '—'} dk / ${s.cycleSeconds ?? '—'} sn` : 'Süre girilmemiş';
const RS = { IN_ROUTE_ACTIVE: 'Rotada (aktif)', NOT_DEFINED: 'Rotada TANIMSIZ' };
const routeText = (s) => (s.routeStatus ?? '').startsWith('DRAFT_UNLINKED') ? 'Rotada değil — bağsız taslak (bilgi)' : (s.routeStatus ?? '').startsWith('DRAFT_OP_INACTIVE') ? 'Operasyon pasif — taslak (bilgi)' : (RS[s.routeStatus] ?? s.routeStatus ?? '—');
export function renderOpPlanPanel(root, wo, matrix, machineName, onTransfer) {
    const slots = matrix?.slots ?? [];
    const rows = slots.map((s) => {
        const defined = s.routeStatus === 'IN_ROUTE_ACTIVE';
        const info = s.informational === true;   // m0206: rotada olmayan/bağsız taslak; START'ı engellemez, hazır sayılmaz
        // aynı eksik iki yerde sayılmasın: "rota iş emrine uygulanmadı" ve "kontrol planı" zaten iş emri seviyesinde / ayrı satırda; fixture yalnız bilgi
        const dupBlock = (b) => b === 'ROUTE_NOT_APPLIED_TO_WORK_ORDER' || /^QC_PASS_WILL_BLOCK:/.test(b);
        const miss = (s.blockReasons ?? []).filter((b) => !dupBlock(b)).length + (s.missing ?? []).filter((m) => !['fixture', 'eligible_operator', 'machine_skill_requirements', 'material_stock'].includes(m)).length;
        const notApplied = (s.blockReasons ?? []).includes('ROUTE_NOT_APPLIED_TO_WORK_ORDER');
        const draftSlot = info;   // m0206: yalnız bilgilendirme satırı
        return h('tr', { 'data-testid': 'opplan-row', 'data-slot': s.slot },
            h('td', {}, s.slot === 'CUT_PREP' ? 'CUT/PREP (OP numarası dışı)' : s.slot),
            h('td', {}, routeText(s)),
            h('td', {}, `${s.expectedMachine ?? (s.machineAmbiguous ? 'BELİRSİZ' : '—')}${defined || info ? '' : ' (ÖNERİ — kesinleşmedi)'}`),
            h('td', {}, s.camProgram ? 'Bağlı' : (s.slot === 'CUT_PREP' ? 'Gerekmiyor' : (reqCell(s) ?? 'Bağlı değil'))),
            h('td', { 'data-testid': 'opplan-time' }, timeCell(s)),
            h('td', { 'data-testid': 'opplan-blade' }, s.blade ? (BLADE_TR[s.blade.status] ?? s.blade.status) : '—'),
            h('td', {}, String(s.eligibleOperators ?? 0)),
            h('td', {}, draftSlot ? 'Bilgilendirme — rota operasyonu değil, hazır sayılmaz' : miss ? `${miss} eksik` : (notApplied ? 'Tamam (rota iş emrine uygulanmadı)' : 'Tamam')));
    });
    root.replaceChildren(h('section', { 'data-testid': 'opplan', class: 'woc-panel' },
        h('h3', {}, 'Rota ve operasyon makineleri'),
        h('div', { class: 'woc-meta', 'data-testid': 'opplan-note' }, `İş emri kartındaki makine (${machineName ?? '—'}) yalnızca ana atamadır; her operasyonun makinesi ayrıdır.`),
        typeof onTransfer === 'function' ? h('div', { class: 'woc-row', style: 'margin:6px 0' }, h('button', { type: 'button', 'data-testid': 'opplan-transfer', onClick: onTransfer }, 'Rota makinelerini ve ayarlarını iş emrine aktar (tüm operasyonlar, sırayla)'), h('span', { class: 'woc-meta' }, 'Rotadaki makine, CAM, süre ve yeterlilik bilgileri iş emrindeki operasyonlara tek seferde kopyalanır. Başlamış operasyonlara dokunulmaz.')) : null,
        (matrix?.staleWorkOrderOps ?? []).length ? h('div', { class: 'woc-meta', 'data-testid': 'opplan-stale', style: 'color:#b00020' }, `Uyarı: iş emrinde güncel rotada karşılığı olmayan operasyon var (${matrix.staleWorkOrderOps.map((o) => `OP${o.opNo ?? o.op_no}`).join(', ')}) — rota değişti, iş emri operasyonları yeniden uygulanmalı.`) : null,
        h('div', { style: 'overflow-x:auto' }, h('table', { class: 'woc-meta', style: 'width:100%;border-collapse:collapse' },
            h('thead', {}, h('tr', {}, ...['Operasyon', 'Rota', 'Makine', 'CAM', 'Bağlama / kesme', 'Şerit bıçağı', 'Uygun operatör', 'Hazırlık'].map((t) => h('th', { style: 'text-align:left;padding:4px 8px' }, t)))),
            h('tbody', {}, ...rows)))));
}
