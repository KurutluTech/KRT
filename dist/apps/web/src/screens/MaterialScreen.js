// KMI NEXT — Hammadde / BOM screen for one work order: requirement vs reserved / issued /
// consumed, shortage, and warehouse movements on the canonical raw-material stock lots.
import { pilotBanner, pilotChip } from '../pilotMark.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { readinessLabel } from '../../../../packages/domain/src/readiness.js';
import { readinessPanel } from './readinessPanel.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
const KINDS = [
    { kind: 'RESERVE', label: 'Rezerve Et' },
    { kind: 'UNRESERVE', label: 'Rezervi Bırak' },
    { kind: 'ISSUE', label: 'Üretime Çıkış' },
    { kind: 'CONSUME', label: 'Tüketim Kaydet' },
    { kind: 'RETURN', label: 'Depoya İade' },
];
export async function renderMaterialScreen(container, workOrderId, api, banner) {
    let rows = [];
    let readiness = [];
    let loadError = null;
    let isPilot = false;
    try {
        isPilot = api.isPilot ? await api.isPilot(workOrderId) : false;
    }
    catch {
        isPilot = false;
    }
    try {
        [rows, readiness] = await Promise.all([api.getStatus(workOrderId), api.readiness(workOrderId)]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    let chain = null;
    if (!loadError && api.chain) {
        try {
            chain = await api.chain(workOrderId);
        }
        catch {
            chain = null;
        }
    }
    async function handleAutoReserve() {
        try {
            const r = await api.autoReserve(workOrderId);
            const done = r.reserved.length ? `Ayrıldı: ${r.reserved.map((x) => `${x.materialCode} ${x.qty} (lot ${x.stockLotId})`).join(', ')}.` : 'Yeni ayırma gerekmedi (eksik yok).';
            const miss = r.shortage.length ? ` ELDE YETERLİ STOK YOK, eksik: ${r.shortage.map((x) => `${x.materialCode} ${x.missing}`).join(', ')}.` : '';
            await rerender({ kind: r.complete ? 'info' : 'error', text: done + miss });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    const lotInput = h('input', { type: 'text', 'data-testid': 'lot-input', placeholder: 'Hammadde lot ID' });
    const qtyInput = h('input', { type: 'number', step: '0.001', 'data-testid': 'mat-qty-input' });
    const rerender = (b) => renderMaterialScreen(container, workOrderId, api, b);
    async function handleMove(kind) {
        try {
            await api.move(workOrderId, lotInput.value.trim(), kind, Number(qtyInput.value), `ui-mat-${Date.now()}`);
            await rerender({ kind: 'info', text: `${kind} kaydedildi.` });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    // Fail-closed (0021): the gate comes from the server's canonical readiness, never from an
    // empty local BOM list (an empty list is UNKNOWN / VERİ GEREKLİ, not "nothing needed").
    const material = readiness.find((r) => r.kind === 'MATERIAL');
    async function handleExempt(reason) {
        try {
            await api.grantExemption(workOrderId, 'MATERIAL', reason);
            await rerender({ kind: 'info', text: 'Malzeme muafiyeti kaydedildi (audit).' });
        }
        catch (err) {
            await rerender({ kind: 'error', text: errorText(err) });
        }
    }
    const screen = h('div', { class: 'material-screen' }, h('h1', { 'data-testid': 'mat-heading' }, ...(isPilot ? [pilotChip()] : []), `Hammadde / BOM (İş Emri: ${workOrderId})`), isPilot ? pilotBanner() : null, banner ? h('div', { 'data-testid': 'mat-banner', 'data-kind': banner.kind }, banner.text) : null, loadError
        ? h('div', { 'data-testid': 'mat-load-error' }, `Yüklenemedi: ${loadError}`)
        : h('div', {}, h('div', { 'data-testid': 'start-gate', 'data-state': material?.state ?? 'UNKNOWN' }, material ? readinessLabel(material) : 'UNKNOWN / VERİ GEREKLİ — MATERIAL_REQUIREMENT_UNKNOWN:NOT_EVALUATED'), readinessPanel('MATERIAL', material, (reason) => void handleExempt(reason)), h('table', { 'data-testid': 'mat-table' }, h('tbody', {}, ...rows.map((r) => h('tr', { 'data-testid': 'mat-row', 'data-material': r.materialCode }, h('td', { 'data-testid': 'mat-code' }, r.materialCode), h('td', { 'data-testid': 'mat-required' }, String(r.required)), h('td', { 'data-testid': 'mat-reserved' }, String(r.reserved)), h('td', { 'data-testid': 'mat-issued' }, String(r.issued)), h('td', { 'data-testid': 'mat-consumed' }, String(r.consumed)), h('td', { 'data-testid': 'mat-shortage' }, String(r.shortage)))))), api.autoReserve ? h('button', { type: 'button', 'data-testid': 'mat-auto-reserve', onClick: () => void handleAutoReserve() }, 'Stoktan otomatik ayır') : null, chain
            ? h('div', { 'data-testid': 'mat-chain' }, h('h2', {}, 'Malzeme zinciri'), h('div', { 'data-testid': 'mat-chain-parts' }, `Parça: planlanan ${chain.qtyPlanned} · son operasyon sağlam ${chain.qtyGoodLastOp} · tüm operasyon hurda ${chain.qtyScrapAllOps}`), ...chain.materials.map((m) => h('div', { 'data-testid': 'mat-chain-row', 'data-material': m.materialCode, 'data-exceeds': String(m.exceedsCutCapacity === true) }, `${m.materialCode}: gereken ${m.barsRequired} → rezerve ${m.barsReserved} → elde ${m.barsInHand} → kesilen ${m.barsCut}`, m.cutCapacityPieces !== null ? ` · kesilenlerden en çok ${m.cutCapacityPieces} parça çıkar` : '', m.exceedsCutCapacity === true ? ' · UYARI: beyan edilen parça sayısı kesilen çubukların verebileceğinden fazla (veri hatası)' : '')), h('div', {}, chain.note))
            : null, lotInput, qtyInput, ...KINDS.map((k) => h('button', { type: 'button', 'data-testid': `mat-${k.kind}`, onClick: () => handleMove(k.kind) }, k.label))));
    mount(container, screen);
}
