// KMI NEXT — Cost Intelligence: Maaş ve Ücretler API sarmalayıcısı (m0249, kanonik sahip). Yalnız cost_pay_* RPC'leri; tablo erişimi YOK.
// Kişi listesi (ad/sicil/departman, ücret değil) mevcut İK referans RPC'sinden alınır.
export function createCostPayApi(client, session) {
    const r = (name, args = {}) => client.rpc(name, args, session);
    return {
        call: (name, args = {}) => { if (!/^cost_pay_/.test(name)) throw new Error('İzinsiz RPC: ' + name); return r(name, args); },
        adminList: (kind) => kind === 'pay_wages' ? r('cost_pay_wages_list', {}) : kind === 'pay_imports' ? r('cost_pay_imports_list', {}) : kind === 'pay_aliases' ? r('cost_pay_alias_list', {}) : kind === 'personnel' ? r('hr_admin_list', { p_kind: 'personnel', p_arg: null }) : Promise.resolve([]),
    };
}
