export function createCustomersApi(client, session) {
    const rpc = (fn, args) => client.rpc(fn, args, session);
    return {
        list: () => rpc('customer_list_overview', {}),
        profile: (id) => rpc('customer_profile', { p_customer_id: id }),
        updateCustomer: async (id, name, country, reason) => { await rpc('update_customer', { p_customer_id: id, p_name: name, p_country: country, p_reason: reason }); },
        saveContact: async (id, c) => { await rpc('upsert_customer_contact', { p_customer_id: id, p_contact_id: c.contactId, p_full_name: c.fullName, p_role_title: c.roleTitle, p_phone: c.phone, p_email: c.email, p_is_primary: c.isPrimary, p_note: c.note }); },
        setContactActive: async (id, active, reason) => { await rpc('set_customer_contact_active', { p_contact_id: id, p_active: active, p_reason: reason }); },
        saveTerms: async (id, t) => { await rpc('set_customer_terms', { p_customer_id: id, p_payment: t.payment, p_delivery: t.delivery, p_quality: t.quality, p_note: t.note }); },
        printCard: (id) => rpc('customer_card_print', { p_customer_id: id }),
    };
}
