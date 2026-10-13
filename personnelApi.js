/** Real implementation: calls the live kmi_next personnel RPCs/table through the data-client. */
export function createPersonnelApi(client, session) {
    return {
        async list() {
            return client.select('personnel', { columns: 'id,name,roles,department,active,skills', order: 'name.asc' }, session);
        },
        async create(name, roles, department, puantajMultiplier) {
            return client.rpc('create_personnel', { p_name: name, p_roles: roles, p_department: department, p_puantaj_multiplier: puantajMultiplier }, session);
        },
        async setActive(personnelId, active) {
            return client.rpc('set_personnel_active', { p_personnel_id: personnelId, p_active: active }, session);
        },
        async updatePuantajMultiplier(personnelId, multiplier) {
            return client.rpc('update_personnel_puantaj_multiplier', { p_personnel_id: personnelId, p_puantaj_multiplier: multiplier }, session);
        },
    };
}
