// KMI NEXT — Golden Thread step 6 screen: Commercial Approval (Muhasebe/Ticari Onay) for a
// single stock lot. Same h()/JSX/full-re-render pattern as the other Golden Thread screens.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { canRequestCommercialApproval, canDecideCommercialApproval, canStageForShipment, canGrantManagementRelease } from '../../../../packages/domain/src/commercialApproval.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
function latestApproval(approvals) {
    return approvals[0] ?? null;
}
export async function renderCommercialApprovalScreen(container, stockLotId, deps, banner) {
    let lotState = null;
    let approvals = [];
    let loadError = null;
    try {
        lotState = await deps.getStockLotState();
        approvals = await deps.api.listForStockLot(stockLotId);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const latest = latestApproval(approvals);
    const latestStatus = latest ? latest.status : null;
    async function handleRequest() {
        try {
            await deps.api.request(stockLotId);
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'info', text: 'Ticari onay talebi oluşturuldu.' });
        }
        catch (err) {
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleDecide(approvalId, decision) {
        try {
            await deps.api.decide(approvalId, decision, `KMI NEXT UI: ${decision}`);
            await renderCommercialApprovalScreen(container, stockLotId, deps, {
                kind: 'info',
                text: decision === 'APPROVED' ? 'Ticari onay verildi.' : 'Ticari onay reddedildi.',
            });
        }
        catch (err) {
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleManagementRelease(approvalId) {
        try {
            await deps.api.grantManagementRelease(approvalId, 'KMI NEXT UI: yönetim serbest bırakması');
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'info', text: 'Yönetim onayı verildi.' });
        }
        catch (err) {
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleStage(approvalId) {
        try {
            await deps.api.stageForShipment(stockLotId, approvalId);
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'info', text: 'Lot sevkiyata hazırlandı (STAGED).' });
        }
        catch (err) {
            await renderCommercialApprovalScreen(container, stockLotId, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const screen = (h("div", { class: "commercial-approval-screen" },
        h("h1", { "data-testid": "capp-heading" },
            "Ticari Onay (Stok Lotu: ",
            stockLotId,
            ")"),
        banner ? (h("div", { "data-testid": "capp-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError || !lotState ? (h("div", { "data-testid": "capp-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("span", { "data-testid": "lot-state" }, lotState),
            canRequestCommercialApproval(lotState) && !(latestStatus === 'PENDING') ? (h('button', { type: 'button', 'data-testid': 'request-approval-btn', onClick: handleRequest }, 'Ticari Onay Talep Et')) : null,
            h("table", { "data-testid": "approvals-table" },
                h("tbody", { "data-testid": "approvals-tbody" }, approvals.map((approval) => (h("tr", { "data-testid": "approval-row", "data-approval-id": approval.id },
                    h("td", { "data-testid": "approval-status" }, approval.status),
                    h("td", { "data-testid": "management-release" }, approval.managementReleasedAt ? 'YÖNETİM ONAYLI' : 'YÖNETİM ONAYI BEKLİYOR'),
                    h("td", { "data-testid": "approval-actions" },
                        canGrantManagementRelease(approval.status, !!approval.managementReleasedAt).ok
                            ? h('button', { type: 'button', 'data-testid': 'management-release-btn', 'data-approval-id': approval.id, onClick: () => handleManagementRelease(approval.id) }, 'Yönetim Onayı Ver')
                            : null,
                        canDecideCommercialApproval(approval.status).ok
                            ? h(Fragment, {}, h('button', { type: 'button', 'data-testid': 'approve-btn', 'data-approval-id': approval.id, onClick: () => handleDecide(approval.id, 'APPROVED') }, 'Onayla'), h('button', { type: 'button', 'data-testid': 'reject-btn', 'data-approval-id': approval.id, onClick: () => handleDecide(approval.id, 'REJECTED') }, 'Reddet'))
                            : null,
                        canStageForShipment(lotState, approval.status).ok
                            ? h('button', { type: 'button', 'data-testid': 'stage-btn', 'data-approval-id': approval.id, onClick: () => handleStage(approval.id) }, 'Sevkiyata Hazırla (STAGED)')
                            : null))))))))));
    mount(container, screen);
}
