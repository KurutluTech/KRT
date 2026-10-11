// KMI NEXT — Golden Thread steps 3-4 screen: Production declaration + Quality Hold for a
// single work order. Same h()/JSX/full-re-render pattern as Orders/WorkOrders screens.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canDeclareProduction } from '../../../../packages/domain/src/productionDeclaration.js';
import { canOpenQualityHold } from '../../../../packages/domain/src/qualityHold.js';
import { canTransitionNcr } from '../../../../packages/domain/src/qualityNcr.js';
import { errorText as sharedErrorText } from '../errorText.js';
const NCR_ACTIONS = [
    { to: 'REWORK', label: 'Yeniden İşle (Rework)' },
    { to: 'SCRAPPED', label: 'Hurdaya Ayır' },
    { to: 'RECHECK_PENDING', label: 'Rework Bitti → Tekrar Kontrol' },
    { to: 'ACCEPTED', label: 'Tekrar Kontrol: KABUL' },
];
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderProductionScreen(container, workOrderId, deps, banner) {
    let wo = null;
    let holds = [];
    let ncrs = [];
    let loadError = null;
    try {
        wo = await deps.getWorkOrder();
        holds = await deps.api.listHoldsForWorkOrder(workOrderId);
        ncrs = await deps.api.listNcrs(workOrderId);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const goodInput = h('input', { type: 'number', min: '0', 'data-testid': 'decl-good-input' });
    const scrapInput = h('input', { type: 'number', min: '0', 'data-testid': 'decl-scrap-input' });
    const holdReasonInput = h('input', { type: 'text', 'data-testid': 'hold-reason-input', placeholder: 'Kalite hold nedeni' });
    const correctionGoodDeltaInput = h('input', { type: 'number', 'data-testid': 'correction-good-delta-input' });
    const correctionScrapDeltaInput = h('input', { type: 'number', 'data-testid': 'correction-scrap-delta-input' });
    const correctionReasonInput = h('input', { type: 'text', 'data-testid': 'correction-reason-input', placeholder: 'Düzeltme nedeni (zorunlu)' });
    async function handleDeclare(e) {
        e.preventDefault();
        const good = Number(goodInput.value) || 0;
        const scrap = Number(scrapInput.value) || 0;
        try {
            await deps.api.declareProduction(workOrderId, good, scrap, false);
            await renderProductionScreen(container, workOrderId, deps, { kind: 'info', text: 'Üretim bildirimi kaydedildi.' });
        }
        catch (err) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleOpenHold(e) {
        e.preventDefault();
        const reason = holdReasonInput.value.trim();
        if (!reason) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: 'Hold nedeni zorunludur.' });
            return;
        }
        try {
            await deps.api.openQualityHold(workOrderId, reason);
            await renderProductionScreen(container, workOrderId, deps, { kind: 'info', text: 'Kalite hold açıldı.' });
        }
        catch (err) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleCorrection(e) {
        e.preventDefault();
        const goodDelta = Number(correctionGoodDeltaInput.value) || 0;
        const scrapDelta = Number(correctionScrapDeltaInput.value) || 0;
        const reason = correctionReasonInput.value.trim();
        if (!reason) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: 'Düzeltme nedeni zorunludur.' });
            return;
        }
        try {
            await deps.api.createProductionCorrection(workOrderId, goodDelta, scrapDelta, reason);
            await renderProductionScreen(container, workOrderId, deps, { kind: 'info', text: 'Üretim düzeltmesi kaydedildi.' });
        }
        catch (err) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const rejectQtyInput = h('input', { type: 'number', min: '1', 'data-testid': 'reject-qty-input' });
    const rejectReasonInput = h('input', { type: 'text', 'data-testid': 'reject-reason-input', placeholder: 'Ret nedeni (zorunlu)' });
    async function handleReject(e) {
        e.preventDefault();
        const qty = Number(rejectQtyInput.value) || 0;
        const reason = rejectReasonInput.value.trim();
        if (!reason) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: 'Ret nedeni yazmadan reddedemezsiniz.' });
            return;
        }
        try {
            await deps.api.openNcr(workOrderId, qty, reason, `ui-ncr-${Date.now()}`);
            await renderProductionScreen(container, workOrderId, deps, { kind: 'info', text: 'Kalite reddi kaydedildi (NCR açıldı, iş emri HOLD).' });
        }
        catch (err) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleNcr(ncrId, to) {
        try {
            await deps.api.transitionNcr(ncrId, to, `KMI NEXT UI: ${to}`);
            await renderProductionScreen(container, workOrderId, deps, { kind: 'info', text: `NCR ${to} durumuna geçti.` });
        }
        catch (err) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleReleaseHold(holdId) {
        try {
            await deps.api.releaseQualityHold(holdId, 'KMI NEXT UI: released');
            await renderProductionScreen(container, workOrderId, deps, { kind: 'info', text: 'Kalite hold serbest bırakıldı.' });
        }
        catch (err) {
            await renderProductionScreen(container, workOrderId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = (h("div", { class: "production-screen" },
        h("h1", { "data-testid": "prod-heading" },
            "\u00DCretim / Kalite (\u0130\u015F Emri: ",
            workOrderId,
            ")"),
        banner ? (h("div", { "data-testid": "prod-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError || !wo ? (h("div", { "data-testid": "prod-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { "data-testid": "wo-snapshot" },
                h("span", { "data-testid": "snap-status" }, wo.status),
                h("span", { "data-testid": "snap-produced" }, String(wo.qtyProduced)),
                h("span", { "data-testid": "snap-scrap" }, String(wo.qtyScrap)),
                h("span", { "data-testid": "snap-planned" }, String(wo.qtyPlanned))),
            canDeclareProduction(wo.status) ? (h("form", { "data-testid": "declare-form", onSubmit: handleDeclare },
                goodInput,
                scrapInput,
                h("button", { type: "submit", "data-testid": "declare-btn" }, "\u00DCretim Bildir"))) : (h("div", { "data-testid": "declare-disabled" },
                "Bu durumda \u00FCretim bildirimi yap\u0131lamaz: ",
                wo.status)),
            canOpenQualityHold(wo.status) ? (h("form", { "data-testid": "open-hold-form", onSubmit: handleOpenHold },
                holdReasonInput,
                h("button", { type: "submit", "data-testid": "open-hold-btn" }, "Kalite Hold A\u00E7"))) : null,
            h("form", { "data-testid": "correction-form", onSubmit: handleCorrection },
                correctionGoodDeltaInput,
                correctionScrapDeltaInput,
                correctionReasonInput,
                h("button", { type: "submit", "data-testid": "correction-btn" }, "\u00DCretim D\u00FCzeltmesi Kaydet")),
            h("form", { "data-testid": "reject-form", onSubmit: handleReject },
                rejectQtyInput,
                rejectReasonInput,
                h("button", { type: "submit", "data-testid": "reject-btn" }, "Kalite Reddi (NCR)")),
            h("table", { "data-testid": "ncr-table" },
                h("tbody", null, ncrs.map((ncr) => (h("tr", { "data-testid": "ncr-row", "data-ncr-id": ncr.id },
                    h("td", { "data-testid": "ncr-qty" }, String(ncr.qty)),
                    h("td", { "data-testid": "ncr-reason" }, ncr.reason),
                    h("td", { "data-testid": "ncr-status" }, ncr.status),
                    h("td", null, NCR_ACTIONS.filter((a) => canTransitionNcr(ncr.status, a.to).ok).map((a) => h('button', { type: 'button', 'data-testid': `ncr-${a.to}`, onClick: () => handleNcr(ncr.id, a.to) }, a.label)))))))),
            h("table", { "data-testid": "holds-table" },
                h("tbody", { "data-testid": "holds-tbody" }, holds.map((hold) => (h("tr", { "data-testid": "hold-row", "data-hold-id": hold.id },
                    h("td", { "data-testid": "hold-reason" }, hold.reason),
                    h("td", { "data-testid": "hold-status" }, hold.status),
                    h("td", null, hold.status === 'OPEN'
                        ? h('button', { type: 'button', 'data-testid': 'release-hold-btn', 'data-hold-id': hold.id, onClick: () => handleReleaseHold(hold.id) }, 'Serbest Bırak')
                        : null))))))))));
    mount(container, screen);
}
