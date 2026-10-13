export function createPassportApi(client, session) {
    return {
        resolve: (input) => client.rpc('passport_resolve', { p_input: input }, session),
        lot: (id) => client.rpc('lot_passport', { p_lot_id: id }, session),
        workOrder: (id) => client.rpc('work_order_passport', { p_work_order_id: id }, session),
        product: (id) => client.rpc('product_dna', { p_product_id: id }, session),
    };
}
