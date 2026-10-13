/** Real implementation: calls the live kmi_next maintenance RPCs/tables through the data-client. */
export function createMaintenanceApi(client, session) {
    return {
        async listMachines() {
            return client.select('machines', { columns: 'id,code,name,category,status,down_since,total_down_minutes', order: 'code.asc' }, session);
        },
        async listEligibility() {
            return client.rpc('machine_eligibility', {}, session);
        },
        async setHold(machineId, reason, category = 'OTHER') {
            return client.rpc('set_machine_hold_categorized', { p_machine_id: machineId, p_reason: reason, p_category: category }, session);
        },
        async resumeFromHold(machineId, reason) {
            return client.rpc('resume_machine_from_hold', { p_machine_id: machineId, p_reason: reason }, session);
        },
        async listTickets() {
            return client.select('maintenance_tickets', { columns: 'id,machine_id,kind,severity,status,reason,created_at', order: 'created_at.desc' }, session);
        },
        async setDown(machineId, reason, ticketSeverity = 'MEDIUM') {
            return client.rpc('set_machine_down', { p_machine_id: machineId, p_reason: reason, p_ticket_severity: ticketSeverity }, session);
        },
        async setCondition(machineId, target, reason, ticketKind = 'PLANNED', ticketSeverity = 'MEDIUM') {
            return client.rpc('set_machine_condition', { p_machine_id: machineId, p_target_status: target, p_reason: reason, p_ticket_kind: ticketKind, p_ticket_severity: ticketSeverity }, session);
        },
        async returnToService(machineId, reason) {
            return client.rpc('return_machine_to_service', { p_machine_id: machineId, p_reason: reason }, session);
        },
        async transitionTicket(ticketId, toStatus) {
            return client.rpc('transition_maintenance_ticket', { p_ticket_id: ticketId, p_to_status: toStatus }, session);
        },
        async recordTestResult(ticketId, result, notes) {
            await client.rpc('record_maintenance_test_result', { p_ticket_id: ticketId, p_result: result, p_notes: notes }, session);
        },
    };
}
