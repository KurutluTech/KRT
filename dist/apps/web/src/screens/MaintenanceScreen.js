// KMI NEXT — Maintenance screen. Same h()/JSX/full-re-render pattern as every other screen.
// Owner order #679 P0-B: BEKLEME (HOLD) and ARIZA/BAKIM (DOWN/MAINTENANCE) are separate paths.
// Eligibility and the allowed return path come from ONE canonical source
// (kmi_next.machine_eligibility / domain machineEligibility), never decided on the screen.
import { h, Fragment, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { DS_CSS } from '../ds.js';
import { formatStamp } from '../../../../packages/domain/src/temporal.js';
import { passportHref } from '../passport/registry.js';
import { machineStateOf, HEADLINE_TR } from '../../../../packages/domain/src/machineState.js';
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
    const cncBy = new Map();
    if (deps.cncStates) {
        try {
            for (const r of await deps.cncStates())
                if (r.machineCode)
                    cncBy.set(r.machineCode, r);
        }
        catch { /* no telemetry permission / not installed: administrative view only */ }
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
        const btn = (testid, label, onClick) => h('button', { type: 'button', class: testid === 'test-fail-btn' ? 'danger' : testid === 'test-pass-btn' || testid === 'ticket-close-btn' ? 'okb' : 'primary', 'data-testid': testid, onClick }, label);
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
    const MACHINE_TR = {
        UP: ['Üretimde / Hazır', 'ok'], HOLD: ['Beklemede', 'warn'], DOWN: ['Arıza / Duruş', 'bad'], MAINTENANCE: ['Bakımda', 'info'],
    };
    const TICKET_TR = {
        OPEN: ['Açık', 'bad'], IN_PROGRESS: ['Onarımda', 'warn'], TEST_PENDING: ['Yetkili test bekliyor', 'info'], RETURNED_TO_SERVICE: ['Servise döndü', 'ok'], CLOSED: ['Kapalı', ''],
    };
    const KIND_TR = { FAULT: 'Arıza', PLANNED: 'Planlı bakım', INSPECTION: 'Muayene' };
    const SEV_TR = { LOW: ['Düşük', ''], MEDIUM: ['Orta', 'warn'], HIGH: ['Yüksek', 'bad'], CRITICAL: ['Kritik', 'bad'] };
    const machineName = (id) => machines.find((m) => m.id === id)?.code ?? 'Makine';
    const n = (st) => machines.filter((m) => m.status === st).length;
    const openTickets = tickets.filter((t) => t.status !== 'CLOSED').length;
    const mkBtn = (cls, testid, machineId, label, onClick) => h('button', { type: 'button', class: cls, 'data-testid': testid, 'data-machine-id': machineId, onClick }, label);
    const screen = (h("div", { class: "maintenance-screen kd" },
        h("style", null, DS_CSS + '.kd .mrow{display:grid;grid-template-columns:minmax(150px,1fr) minmax(200px,2fr);gap:12px;align-items:center}.kd .mrow .acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.kd .mrow.down{border-left:4px solid #dc2626;padding-left:10px}.kd .mrow.maint{border-left:4px solid #3b82f6;padding-left:10px}.kd .mrow.hold{border-left:4px solid #d97706;padding-left:10px}.kd .mrow.up{border-left:4px solid #16a34a;padding-left:10px}@media(max-width:700px){.kd .mrow{grid-template-columns:1fr}}'),
        h("h1", { "data-testid": "maintenance-heading" }, "Bak\u0131m / Makine Sa\u011Fl\u0131\u011F\u0131"),
        banner ? (h("div", { class: `banner ${banner.kind}`, "data-testid": "maintenance-banner", "data-kind": banner.kind }, banner.text)) : null,
        loadError ? (h("div", { class: "banner error", "data-testid": "maintenance-load-error" },
            "Y\u00FCklenemedi: ",
            loadError)) : (h(Fragment, null,
            h("div", { class: "panel", "data-testid": "machines-table" },
                h("h2", null, "Makineler"),
                h("div", { "data-testid": "machines-tbody" },
                    machines.length === 0 ? h("div", { class: "empty" }, "Kay\u0131tl\u0131 makine yok.") : null,
                    machines.map((m) => {
                        const st = MACHINE_TR[m.status] ?? [m.status, ''];
                        const el = eligibilityOf(m);
                        const cls = m.status === 'DOWN' ? 'down' : m.status === 'MAINTENANCE' ? 'maint' : m.status === 'HOLD' ? 'hold' : 'up';
                        return (h("div", { class: `item mrow ${cls}`, "data-testid": "machine-row", "data-machine-id": m.id, "data-machine-code": m.code },
                            h("div", null,
                                h("div", null,
                                    h("b", { "data-testid": "machine-code" }, m.code),
                                    " ",
                                    h("span", { class: "mut", "data-testid": "machine-name" }, m.name)),
                                h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center" },
                                    h("span", { class: "mut", style: "font-size:11px" }, "Kay\u0131tl\u0131 (idari) durum:"),
                                    h("span", { class: `pill ${st[1]}`, "data-testid": "machine-status", "data-code": m.status }, st[0]),
                                    h("span", { class: `pill ${el.eligible ? 'ok' : 'warn'}`, "data-testid": "machine-eligibility", "data-eligible": String(el.eligible), "data-return-path": el.returnPath }, el.label),
                                    cncBy.has(m.code) ? h("span", { class: "mut", "data-testid": "machine-cnc", "data-cnc-headline": machineStateOf({ status: 'UP', active: [], cnc: cncBy.get(m.code) }).headline },
                                        "Fiziksel CNC (kontrol bildiriyor): ",
                                        h("b", null, HEADLINE_TR[machineStateOf({ status: 'UP', active: [], cnc: cncBy.get(m.code) }).headline]),
                                        " \u2014 bak\u0131m kayd\u0131ndan ayr\u0131 bir bilgidir, bak\u0131m kap\u0131lar\u0131n\u0131 de\u011Fi\u015Ftirmez") : null,
                                    h("span", { class: "mut" },
                                        "Toplam duru\u015F: ",
                                        h("span", { "data-testid": "machine-down-minutes" }, String(m.totalDownMinutes)),
                                        " dk")),
                                h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;align-items:center;font-size:12px", class: "mut" },
                                    h("span", { "data-testid": "machine-open-tickets", "data-count": String(tickets.filter((t) => t.machineId === m.id && t.status !== 'CLOSED').length) },
                                        "A\u00E7\u0131k bak\u0131m kayd\u0131: ",
                                        String(tickets.filter((t) => t.machineId === m.id && t.status !== 'CLOSED').length)),
                                    m.downSince ? h("span", { "data-testid": "machine-down-since" },
                                        "Duru\u015F ba\u015Flang\u0131c\u0131: ",
                                        formatStamp(m.downSince)) : null,
                                    h("a", { href: passportHref('MACHINE', m.id), "data-testid": "machine-passport", style: "color:#67e8f9;font-weight:700;text-decoration:none" }, "Pasaport \u2192"))),
                            h("div", { class: "acts" },
                                reasonInputFor(m.id),
                                m.status === 'UP' || m.status === 'HOLD' ? mkBtn('danger', 'set-down-btn', m.id, 'ARIZA / DURUŞ Bildir', () => handleSetDown(m.id)) : null,
                                el.returnPath === 'RESUME_FROM_HOLD' ? mkBtn('okb', 'resume-from-hold-btn', m.id, 'Üretime Döndür (bakım testi gerekmez)', () => handleResumeFromHold(m.id)) : null,
                                el.returnPath === 'AUTHORIZED_TEST_REQUIRED' ? mkBtn('okb', 'return-to-service-btn', m.id, 'Servise Döndür (Yetkili Test)', () => handleReturnToService(m.id)) : null,
                                m.status !== 'MAINTENANCE' ? mkBtn('primary', 'enter-maintenance-btn', m.id, "BAKIM'a Al", () => handleEnterCondition(m.id, 'MAINTENANCE')) : null,
                                m.status === 'UP' ? holdCategoryFor(m.id) : null,
                                m.status === 'UP' ? mkBtn('warnb', 'enter-hold-btn', m.id, 'BEKLEMEYE Al', () => handleEnterCondition(m.id, 'HOLD')) : null)));
                    }))),
            h("div", { class: "panel", "data-testid": "tickets-table" },
                h("h2", null, "Bak\u0131m kay\u0131tlar\u0131"),
                h("div", { "data-testid": "tickets-tbody" },
                    tickets.length === 0 ? h("div", { class: "empty" }, "A\u00E7\u0131k bak\u0131m kayd\u0131 yok.") : null,
                    tickets.map((t) => {
                        const ts = TICKET_TR[t.status] ?? [t.status, ''];
                        const sv = SEV_TR[t.severity] ?? [t.severity, ''];
                        return (h("div", { class: "item", "data-testid": "ticket-row", "data-ticket-id": t.id },
                            h("b", { "data-testid": "ticket-machine-id", "data-code": t.machineId }, machineName(t.machineId)),
                            h("span", { class: "pill", "data-testid": "ticket-kind", "data-code": t.kind }, KIND_TR[t.kind] ?? t.kind),
                            h("span", { class: `pill ${sv[1]}`, "data-testid": "ticket-severity", "data-code": t.severity }, sv[0]),
                            h("span", { class: `pill ${ts[1]}`, "data-testid": "ticket-status", "data-code": t.status }, ts[0]),
                            h("span", { class: "mut grow", "data-testid": "ticket-reason" }, t.reason),
                            h("span", { class: "mut", "data-testid": "ticket-created", style: "font-size:12px" }, formatStamp(t.createdAt)),
                            h("a", { href: passportHref('MAINTENANCE_TICKET', t.id), "data-testid": "ticket-passport", style: "color:#67e8f9;font-weight:700;text-decoration:none;font-size:12px" }, "Pasaport \u2192"),
                            h("div", { class: "acts", style: "display:flex;gap:8px;flex-wrap:wrap" }, ticketActions(t))));
                    })))))));
    mount(container, screen);
}
