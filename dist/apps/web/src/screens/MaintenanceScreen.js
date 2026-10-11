// KMI NEXT — Maintenance screen. Same h()/JSX/full-re-render pattern as every other screen.
// Owner order #679 P0-B: BEKLEME (HOLD) and ARIZA/BAKIM (DOWN/MAINTENANCE) are separate paths.
// Eligibility and the allowed return path come from ONE canonical source
// (kmi_next.machine_eligibility / domain machineEligibility), never decided on the screen.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
function errorText(err) {
    return sharedErrorText(err);
}
export async function renderMaintenanceScreen(container, deps, banner) {
    let machines = [];
    let tickets = [];
    let eligibility = [];
    let loadError = null;
    try {
        [machines, tickets, eligibility] = await Promise.all([deps.api.listMachines(), deps.api.listTickets(), deps.api.listEligibility()]);
    }
    catch (err) {
        loadError = errorText(err);
    }
    const reasonInputs = new Map();
    function reasonInputFor(machineId) {
        let input = reasonInputs.get(machineId);
        if (!input) {
            input = h('input', { type: 'text', 'data-testid': 'reason-input', 'data-machine-id': machineId });
            reasonInputs.set(machineId, input);
        }
        return input;
    }
    async function handleSetDown(machineId) {
        const reason = reasonInputFor(machineId).value.trim();
        try {
            await deps.api.setDown(machineId, reason);
            await renderMaintenanceScreen(container, deps, { kind: 'info', text: 'Makine DURUŞ olarak işaretlendi.' });
        }
        catch (err) {
            await renderMaintenanceScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const holdCategorySelects = new Map();
    function holdCategoryFor(machineId) {
        let sel = holdCategorySelects.get(machineId);
        if (!sel) {
            sel = h('select', { 'data-testid': 'hold-category-select', 'data-machine-id': machineId }, h('option', { value: 'SETUP' }, 'Ayar / hazırlık'), h('option', { value: 'TOOL' }, 'Takım bekleme'), h('option', { value: 'MATERIAL_WAIT' }, 'Malzeme bekleme'), h('option', { value: 'OTHER', selected: 'selected' }, 'Diğer'));
            holdCategorySelects.set(machineId, sel);
        }
        return sel;
    }
    async function handleResumeFromHold(machineId) {
        const reason = reasonInputFor(machineId).value.trim();
        try {
            await deps.api.resumeFromHold(machineId, reason);
            await renderMaintenanceScreen(container, deps, { kind: 'info', text: 'Makine BEKLEMEDEN üretime döndü (bakım testi gerekmez).' });
        }
        catch (err) {
            await renderMaintenanceScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleEnterCondition(machineId, target) {
        const reason = reasonInputFor(machineId).value.trim();
        try {
            if (target === 'HOLD')
                await deps.api.setHold(machineId, reason, (holdCategoryFor(machineId).value || 'OTHER'));
            else
                await deps.api.setCondition(machineId, target, reason);
            const message = target === 'MAINTENANCE' ? "Makine BAKIM'a alındı." : 'Makine BEKLEMEYE alındı.';
            await renderMaintenanceScreen(container, deps, { kind: 'info', text: message });
        }
        catch (err) {
            await renderMaintenanceScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const testNotesInputs = new Map();
    function testNotesFor(ticketId) {
        let input = testNotesInputs.get(ticketId);
        if (!input) {
            input = h('input', { type: 'text', 'data-testid': 'test-notes-input', placeholder: 'Test notu (zorunlu)' });
            testNotesInputs.set(ticketId, input);
        }
        return input;
    }
    async function handleTicket(ticketId, to) {
        try {
            await deps.api.transitionTicket(ticketId, to);
            await renderMaintenanceScreen(container, deps, { kind: 'info', text: `Bakım kaydı ${to} durumuna geçti.` });
        }
        catch (err) {
            await renderMaintenanceScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    async function handleTest(ticketId, result) {
        try {
            await deps.api.recordTestResult(ticketId, result, testNotesFor(ticketId).value.trim());
            const text = result === 'PASS' ? 'Yetkili test GEÇTİ — makine servise döndürülebilir.' : 'Yetkili test KALDI — kayıt onarıma geri döndü.';
            await renderMaintenanceScreen(container, deps, { kind: 'info', text });
        }
        catch (err) {
            await renderMaintenanceScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    function ticketActions(t) {
        const btn = (testid, label, onClick) => h('button', { type: 'button', 'data-testid': testid, onClick }, label);
        if (t.status === 'OPEN')
            return [btn('ticket-start-btn', 'Bakıma Başla', () => handleTicket(t.id, 'IN_PROGRESS'))];
        if (t.status === 'IN_PROGRESS')
            return [btn('ticket-to-test-btn', 'Onarım Bitti → Yetkili Test', () => handleTicket(t.id, 'TEST_PENDING'))];
        if (t.status === 'TEST_PENDING') {
            return [
                testNotesFor(t.id),
                btn('test-pass-btn', 'Test GEÇTİ', () => handleTest(t.id, 'PASS')),
                btn('test-fail-btn', 'Test KALDI', () => handleTest(t.id, 'FAIL')),
            ];
        }
        if (t.status === 'RETURNED_TO_SERVICE')
            return [btn('ticket-close-btn', 'Kaydı Kapat', () => handleTicket(t.id, 'CLOSED'))];
        return [];
    }
    async function handleReturnToService(machineId) {
        const reason = reasonInputFor(machineId).value.trim();
        try {
            await deps.api.returnToService(machineId, reason);
            await renderMaintenanceScreen(container, deps, { kind: 'info', text: 'Makine SERVİSE DÖNDÜ (yetkili test geçti, makine kullanılabilir).' });
        }
        catch (err) {
            await renderMaintenanceScreen(container, deps, { kind: 'error', text: errorText(err) });
        }
    }
    const UNKNOWN_ELIGIBILITY = { eligible: false, label: 'BAKIM', returnPath: 'AUTHORIZED_TEST_REQUIRED', reason: 'ELIGIBILITY_UNKNOWN' };
    // Fail-closed: a machine missing from the canonical eligibility list is treated as NOT eligible.
    const eligibilityOf = (m) => eligibility.find((e) => e.machineId === m.id) ?? UNKNOWN_ELIGIBILITY;
    const screen = (h("div", { class: "maintenance-screen" },
        h("h1", { "data-testid": "maintenance-heading" }, "Bak\u0131m / Makine Sa\u011Fl\u0131\u011F\u0131"),
        banner ? (h("div", { "data-testid": "maintenance-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { "data-testid": "maintenance-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("table", { "data-testid": "machines-table" },
                h("tbody", { "data-testid": "machines-tbody" }, machines.map((m) => (h("tr", { "data-testid": "machine-row", "data-machine-id": m.id, "data-machine-code": m.code },
                    h("td", { "data-testid": "machine-code" }, m.code),
                    h("td", { "data-testid": "machine-name" }, m.name),
                    h("td", { "data-testid": "machine-status" }, m.status),
                    h("td", { "data-testid": "machine-down-minutes" }, String(m.totalDownMinutes)),
                    h("td", null, reasonInputFor(m.id)),
                    h("td", { "data-testid": "machine-eligibility", "data-eligible": String(eligibilityOf(m).eligible), "data-return-path": eligibilityOf(m).returnPath }, eligibilityOf(m).label),
                    h("td", null,
                        m.status === 'UP' || m.status === 'HOLD'
                            ? h('button', { type: 'button', 'data-testid': 'set-down-btn', 'data-machine-id': m.id, onClick: () => handleSetDown(m.id) }, 'ARIZA / DURUŞ Bildir')
                            : null,
                        eligibilityOf(m).returnPath === 'RESUME_FROM_HOLD'
                            ? h('button', { type: 'button', 'data-testid': 'resume-from-hold-btn', 'data-machine-id': m.id, onClick: () => handleResumeFromHold(m.id) }, 'Üretime Döndür (bakım testi gerekmez)')
                            : null,
                        eligibilityOf(m).returnPath === 'AUTHORIZED_TEST_REQUIRED'
                            ? h('button', {
                                type: 'button',
                                'data-testid': 'return-to-service-btn',
                                'data-machine-id': m.id,
                                onClick: () => handleReturnToService(m.id),
                            }, 'Servise Döndür (Yetkili Test)')
                            : null,
                        m.status !== 'MAINTENANCE'
                            ? h('button', {
                                type: 'button',
                                'data-testid': 'enter-maintenance-btn',
                                'data-machine-id': m.id,
                                onClick: () => handleEnterCondition(m.id, 'MAINTENANCE'),
                            }, 'BAKIM\'a Al')
                            : null,
                        m.status === 'UP' ? holdCategoryFor(m.id) : null,
                        m.status === 'UP'
                            ? h('button', {
                                type: 'button',
                                'data-testid': 'enter-hold-btn',
                                'data-machine-id': m.id,
                                onClick: () => handleEnterCondition(m.id, 'HOLD'),
                            }, 'BEKLEMEYE Al')
                            : null)))))),
            h("table", { "data-testid": "tickets-table" },
                h("tbody", { "data-testid": "tickets-tbody" }, tickets.map((t) => (h("tr", { "data-testid": "ticket-row", "data-ticket-id": t.id },
                    h("td", { "data-testid": "ticket-machine-id" }, t.machineId),
                    h("td", { "data-testid": "ticket-kind" }, t.kind),
                    h("td", { "data-testid": "ticket-severity" }, t.severity),
                    h("td", { "data-testid": "ticket-status" }, t.status),
                    h("td", { "data-testid": "ticket-reason" }, t.reason),
                    h("td", null, ticketActions(t)))))))))));
    mount(container, screen);
}
