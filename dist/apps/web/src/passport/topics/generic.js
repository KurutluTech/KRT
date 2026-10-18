import { KINDS } from '../registry.js';
import { attrsPanel, docsPanel, photoPanel } from '../storePanels.js';
import { dt, day, nf, link, pill, orNA, inList, table, tabTopic, opt, renderSections } from './common.js';
export const PASSPORT_KINDS_SOURCE = ['WORK_ORDER', 'ORDER', 'SHIPMENT', 'STOCK_LOT', 'QUALITY_NCR', 'MAINTENANCE_TICKET', 'MACHINE', 'PRODUCT', 'CUSTOMER', 'SUPPLIER', 'TOOL', 'PERSONNEL', 'TASK'];
const TAB_ICON = { genel: 'clipboard', kisiler: 'users', sartlar: 'file', siparisler: 'cart', sevkiyat: 'truck', kalemler: 'layers', hareket: 'link', iz: 'link', kullanim: 'chart', omur: 'gauge', zaman: 'layers', belgeler: 'file', revizyonlar: 'chip', uretim: 'factory', kalite: 'shield' };
const TAB_GROUP = { genel: 'Kimlik', kisiler: 'Kimlik', sartlar: 'Ticari', siparisler: 'İlişkiler', sevkiyat: 'İlişkiler', kalemler: 'İlişkiler', hareket: 'Hareket', iz: 'İzlenebilirlik', kullanim: 'Kullanım', omur: 'Kullanım', zaman: 'Geçmiş', belgeler: 'Evrak' };
export function genericTopics(ctx) {
    const def = KINDS[ctx.kind];
    const store = ctx.store;
    const out = [];
    const T = (id, title, icon, group, extra = {}) => ({ id, title, icon, group, ...extra });
    // ---- store panels first (identity / media), per family
    if (store) {
        const attrTopic = (id, title, group, codes, icon = 'clipboard', summary) => out.push({ ...T(id, title, icon, group, { summary }), render: (host) => { host.replaceChildren(...(id === 'kimlik' ? [photoPanel(store, 'Fotoğraf / logo')] : []), attrsPanel(store, title, codes, { testid: `ps-${id}-attrs`, empty: 'Bu alanlar için değer girilmemiş' })); } });
        if (ctx.kind === 'CUSTOMER') {
            attrTopic('kimlik', 'Kimlik ve adres', 'Kimlik', ['LEGAL_NAME', 'ADDRESS'], 'user', 'Unvan, adres');
            attrTopic('iletisim', 'Yetkili kişiler', 'Kimlik', ['CONTACT_1', 'CONTACT_2', 'CONTACT_3'], 'users', 'İletişim (yetkiye bağlı)');
            attrTopic('ticari', 'Ticari şartlar', 'Ticari', ['CURRENCY', 'PAYMENT_TERMS_NOTE', 'DELIVERY_TERMS'], 'file', 'Para birimi, ödeme, teslim');
        }
        if (ctx.kind === 'SUPPLIER') {
            attrTopic('kimlik', 'Kimlik ve adres', 'Kimlik', ['LEGAL_NAME', 'ADDRESS', 'COUNTRY'], 'user', 'Unvan, ülke');
            attrTopic('iletisim', 'Yetkili kişiler', 'Kimlik', ['CONTACT_1', 'CONTACT_2'], 'users', 'İletişim');
            attrTopic('tedarik', 'Tedarik, sertifika, ödeme notu', 'Ticari', ['SUPPLIES', 'CERTIFICATIONS', 'PAYMENT_TERMS_NOTE'], 'cart', 'Ne tedarik ediyor');
        }
        if (ctx.kind === 'TOOL') {
            attrTopic('kimlik', 'Teknik kimlik ve ölçüler', 'Kimlik', null, 'wrench', 'Çap, boy, kaplama, tutucu');
        }
    }
    // ---- registered tabs → topics
    for (const tab of def.tabs) {
        if (tab.key === 'belgeler' && store)
            continue; // store families use the store document panel below (same documents, upload + versions)
        out.push(tabTopic(ctx, T(`t-${tab.key}`, tab.label, TAB_ICON[tab.key] ?? 'clipboard', TAB_GROUP[tab.key] ?? 'Bilgi'), tab.key));
    }
    if (store)
        out.push({ ...T('belgeler', 'Belgeler', 'file', 'Evrak', { summary: 'Yükle, aç, sürümle' }), render: (host) => { host.replaceChildren(docsPanel(store, 'Belgeler', null, { testid: 'ps-generic-docs' })); } });
    // ---- family specific relations
    if (ctx.kind === 'SUPPLIER')
        out.push({ ...T('satinalma', 'Satın alma siparişleri', 'cart', 'İlişkiler', { summary: 'Sipariş kayıtları' }), render: (host) => renderSections(ctx, host, async () => {
                const po = await ctx.sel('purchase_orders', 'id,status,created_at,currency', { supplier_id: `eq.${ctx.id}` }, 'created_at.desc', 80);
                return [table('Satın alma siparişleri', ['Sipariş', 'Durum', 'Açılış', 'Para birimi'], po.map((p) => [p.id.slice(0, 8), p.status, dt(p.createdAt), orNA(p.currency)]), 'Bu tedarikçiye sipariş yok')];
            }) });
    if (ctx.kind === 'TOOL')
        out.push({ ...T('cam', 'İlgili CAM programları', 'chip', 'İlişkiler', { summary: 'Bu takım türünü kullanan programlar' }), render: (host) => renderSections(ctx, host, async () => {
                const tool = (await ctx.sel('tools', 'tool_type', { id: `eq.${ctx.id}` }, undefined, 1))[0];
                if (!tool?.toolType)
                    return [{ title: 'CAM programları', note: 'Takım türü girilmemiş; ilişki kurulamaz (BİLİNMİYOR).' }];
                const use = await ctx.sel('cam_program_tools', 'cam_program_id,qty', { tool_type: `eq.${tool.toolType}` }, undefined, 200);
                const progs = use.length ? await opt(ctx.sel('cam_programs', 'id,program_no,revision,status', { id: inList(use.map((u) => u.camProgramId)) }, 'program_no', 200)) : [];
                return [table(`Takım türü ${tool.toolType} kullanan programlar`, ['Program', 'Revizyon', 'Durum', 'Adet'], (progs ?? []).map((p) => [p.programNo, p.revision, p.status, nf(use.find((u) => u.camProgramId === p.id)?.qty)]), 'Bu takım türünü kullanan program yok')];
            }) });
    void link;
    void pill;
    void day;
    return out;
}
export const GENERIC_KINDS = ['CUSTOMER', 'SUPPLIER', 'TOOL', 'STOCK_LOT', 'ORDER', 'SHIPMENT'];
