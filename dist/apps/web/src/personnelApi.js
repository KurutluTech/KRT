/** Real implementation: calls the live kmi_next personnel RPCs/table through the data-client. */
export function createPersonnelApi(client, session) {
    return {
        async list() {
            return client.select('personnel', { columns: 'id,name,roles,department,active,skills,employee_no,shift_code', order: 'name.asc' }, session);
        },
        async create(name, roles, department, puantajMultiplier) {
            return client.rpc('create_personnel', { p_name: name, p_roles: roles, p_department: department, p_puantaj_multiplier: puantajMultiplier }, session);
        },
        async setActive(personnelId, active) {
            return client.rpc('set_personnel_active', { p_personnel_id: personnelId, p_active: active }, session);
        },
        suggestEmployeeNo: () => client.rpc('suggest_employee_no', {}, session),
        createFull: (name, roles, department, employeeNo, shiftCode) => client.rpc('create_personnel_full', { p_name: name, p_roles: roles, p_department: department, p_employee_no: employeeNo, p_shift_code: shiftCode }, session),
        updateProfile: (id, i) => client.rpc('update_personnel_profile', { p_personnel_id: id, p_name: i.name, p_roles: i.roles, p_department: i.department, p_shift_code: i.shiftCode, p_employee_no: i.employeeNo, p_reason: i.reason }, session),
        offboardingPreview: (id) => client.rpc('personnel_offboarding_preview', { p_personnel_id: id }, session),
        terminate: (id, reason, ack) => client.rpc('terminate_personnel', { p_personnel_id: id, p_reason: reason, p_acknowledge_open_items: ack }, session),
        reactivate: (id, reason) => client.rpc('reactivate_personnel', { p_personnel_id: id, p_reason: reason }, session),
        async updatePuantajMultiplier(personnelId, multiplier) {
            return client.rpc('update_personnel_puantaj_multiplier', { p_personnel_id: personnelId, p_puantaj_multiplier: multiplier }, session);
        },
    };
}
