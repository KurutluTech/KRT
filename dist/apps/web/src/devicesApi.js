export function createDevicesApi(client, session) {
    return {
        health: () => client.rpc('device_health', {}, session),
        register: async (kind, name, machineCode, notes) => { await client.rpc('register_device', { p_kind: kind, p_name: name, p_machine_code: machineCode, p_notes: notes }, session); },
    };
}
