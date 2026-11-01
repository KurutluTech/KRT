// m0198 — PERSONEL–MAKİNE/EKİPMAN eşleştirme (tek canonical kayıt: personnel_machine_pairs). Yetki/audit sunucuda.
export function createPairingApi(client, session) {
    return {
        people: () => client.select('personnel', { columns: 'id,name,active', order: 'name.asc' }, session),
        machines: () => client.select('machines', { columns: 'id,code,name', order: 'code.asc' }, session),
        pairs: () => client.select('personnel_machine_pairs', { columns: 'personnel_id,machine_id,trained' }, session),
        setForPerson: (personId, pairs) => client.rpc('set_personnel_machine_pairs', { p_personnel_id: personId, p_pairs: pairs.map((x) => ({ machine_id: x.machineId, trained: !!x.trained })) }, session),
        setForMachine: (machineId, pairs) => client.rpc('set_machine_personnel_pairs', { p_machine_id: machineId, p_pairs: pairs.map((x) => ({ personnel_id: x.personnelId, trained: !!x.trained })) }, session),
    };
}
