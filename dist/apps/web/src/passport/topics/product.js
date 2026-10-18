import { docsPanel, photoPanel, attrsPanel } from '../storePanels.js';
import { NA, dt, nf, link, pill, orNA, inList, kv, table, note, tabTopic, linkTopic, productCardsTopic, opt, renderSections, WO_TR } from './common.js';
const OPEN_ROLES = ['ADMIN', 'MANAGEMENT', 'CAM', 'QUALITY'];
export function productTopics(ctx, p) {
    const store = ctx.store;
    const T = (id, title, icon, group, extra = {}) => ({ id, title, icon, group, ...extra });
    const R = (id, title, icon, group, summary, load, extra = {}) => ({ ...T(id, title, icon, group, { summary, ...extra }), render: (host) => renderSections(ctx, host, load) });
    const eng = ctx.access.owner || ctx.access.roles.some((r) => OPEN_ROLES.includes(r)) || ctx.access.actions.includes('ROUTING_MANAGE');
    const econ = ctx.access.owner || ctx.access.economics || ctx.access.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT');
    const pc = (id, title, icon, group, summary, only, extra = {}) => productCardsTopic(ctx, T(id, title, icon, group, { summary, ...extra }), only);
    const rev = async () => {
        const r = await opt(ctx.sel('product_revisions', 'id,revision,status,released_at', { product_id: `eq.${p.id}` }, 'created_at.desc', 20));
        return r ?? [];
    };
    const openWork = () => opt(ctx.rpc('product_open_work', { p_product: p.id }));
    const out = [
        pc('kimlik', 'Kimlik ve revizyon', 'box', 'Kimlik', 'Revizyon, hazırlık özeti', ['ready', 'identity']),
        { ...T('gorsel', 'Teknik resim ve önizleme', 'file', 'Teknik', { summary: 'Resim ve ürün görseli' }), render: async (host) => {
                host.replaceChildren(photoPanel(store, 'Ürün görseli'));
                const d = document.createElement('div');
                host.append(d);
                if (ctx.productWs)
                    await productCardsTopic(ctx, T('x', 'x', 'file', 'x'), ['drawing']).render(d);
            } },
        pc('cad', 'CAD / STEP', 'layers', 'Teknik', 'Model dosyaları', ['cad']),
        pc('cam', 'CAM / NC programları', 'chip', 'Teknik', 'Program ve revizyonları', ['cam']),
        pc('takim', 'Takım listesi', 'wrench', 'Teknik', 'Takım listesi dokümanı', ['tools']),
        pc('bom', 'BOM', 'clipboard', 'Teknik', 'Malzeme listesi', ['bom']),
        pc('rota', 'Operasyon rotası', 'factory', 'Üretim', 'Operasyonlar, makineler', ['routing']),
        R('fikstur', 'Bağlama ve hazırlık', 'gear', 'Üretim', 'Fikstür / takım / mastar kaynakları', async () => {
            const r = await rev();
            const cur = r.find((x) => x.status === 'RELEASED') ?? r[0];
            if (!cur)
                return [note('Bağlama ve hazırlık', 'Bu ürün için revizyon yok.')];
            const ops = await ctx.sel('routing_operations', 'id,op_no,name', { product_revision_id: `eq.${cur.id}`, active: 'eq.true' }, 'op_no', 80);
            const res = ops.length ? await ctx.sel('routing_op_resources', 'routing_operation_id,kind,code,label,qty,note', { routing_operation_id: inList(ops.map((o) => o.id)), active: 'eq.true' }, undefined, 300) : [];
            const on = new Map(ops.map((o) => [o.id, o]));
            return [table(`Rev ${cur.revision} · operasyon kaynakları`, ['Op', 'Tür', 'Kod', 'Ad', 'Adet', 'Not'], res.map((x) => [`OP${on.get(x.routingOperationId)?.opNo ?? '?'}`, x.kind, orNA(x.code), orNA(x.label), x.qty === null ? NA : nf(x.qty), orNA(x.note)]), 'Bağlama/hazırlık kaynağı tanımlanmamış')];
        }),
        pc('kesme', 'Kesme parametreleri', 'gauge', 'Üretim', 'Operasyon bazlı parametreler', ['params']),
        R('sureler', 'Çevrim ve hazırlık süreleri', 'clock', 'Üretim', 'Rota hedefleri', async () => {
            const r = await rev();
            const cur = r.find((x) => x.status === 'RELEASED') ?? r[0];
            if (!cur)
                return [note('Süreler', 'Bu ürün için revizyon yok.')];
            const ops = await ctx.sel('routing_operations', 'op_no,name,cycle_seconds_target,setup_minutes_target', { product_revision_id: `eq.${cur.id}`, active: 'eq.true' }, 'op_no', 80);
            return [table(`Rev ${cur.revision} (${cur.status}) · rota süre hedefleri`, ['Op', 'Ad', 'Çevrim (sn)', 'Hazırlık (dk)'], ops.map((o) => [`OP${o.opNo}`, o.name, o.cycleSecondsTarget === null ? NA : nf(o.cycleSecondsTarget), o.setupMinutesTarget === null ? NA : nf(o.setupMinutesTarget)]), 'Operasyon tanımlı değil'), note('Kaynak', 'Değerler rotadan okunur; eksik süre 0 sayılmaz. Gerçek ölçülen süreler üretim kayıtlarından gelir ve buradan değiştirilemez.')];
        }),
        pc('kalite', 'Kalite planı ve toleranslar', 'shield', 'Kalite', 'Kontrol planı', ['quality']),
        R('olcum', 'Ölçüm ve ilk parça kayıtları', 'scan', 'Kalite', 'İlk parça ve kalite sonuçları', async () => {
            const hist = await opt(ctx.rpc('product_history', { p_product: p.id, p_limit: 200 }));
            const rows = hist ?? [];
            const q = rows.filter((x) => x.kind === 'QUALITY');
            return [table('Kalite olayları (NCR / HOLD)', ['Zaman', 'Olay', 'Ayrıntı'], q.map((x) => [dt(x.at), x.code, x.detail]), hist === null ? 'Bu geçmiş bu rol için açık değil' : 'Kalite olayı yok'), note('İlk parça', 'İlk parça onayı iş emri operasyonunda tutulur; ilgili iş emri pasaportundan açılır.')];
        }),
        { ...T('maliyet', 'Maliyet ve kapasite hesabı', 'calc', 'Ekonomi', { visible: !!ctx.productWs && (econ || eng), summary: 'Süre hesabı (yetkili)' }), render: (host) => productCardsTopic(ctx, T('x', 'x', 'calc', 'x'), ['calc']).render(host) },
        R('iliskili', 'İlişkili sipariş ve iş emirleri', 'link', 'İlişkiler', 'Açık iş', async () => {
            const w = await openWork();
            if (!w)
                return [note('İlişkili iş', 'Bu bilgi bu rol için açık değil.')];
            return [kv('Yürürlükteki revizyon', [['Revizyon', orNA(w.currentRevision)]]),
                table('Açık iş emirleri', ['İş emri', 'Durum', 'Adet', 'Revizyon'], w.workOrders.map((x) => [link('WORK_ORDER', x.id, `İE ${x.id.slice(0, 8)}`), WO_TR[x.status] ?? x.status, nf(x.qtyPlanned), orNA(x.revision)]), 'Açık iş emri yok'),
                ...(w.orderItems ? [table('Açık sipariş kalemleri', ['Sipariş', 'Kalem', 'Adet', 'Durum', 'Revizyon bağı'], w.orderItems.map((x) => [orNA(x.orderNo), orNA(x.lineNo), nf(x.qty), x.orderStatus, x.state === 'CURRENT' ? pill('Güncel', 'ok') : x.state === 'OLD_REVISION' ? pill('Eski revizyon', 'warn') : pill('Bağlı değil', 'warn')]), 'Açık sipariş kalemi yok')] : [])];
        }),
        R('uretim-gecmisi', 'Üretim ve kalite geçmişi', 'chart', 'İlişkiler', 'product_history', async () => {
            const hist = await opt(ctx.rpc('product_history', { p_product: p.id, p_limit: 120 }));
            const rows = hist ?? [];
            return [table('Ürün olay geçmişi', ['Zaman', 'Tür', 'Olay', 'Ayrıntı'], rows.map((x) => [dt(x.at), x.kind, x.code, x.detail]), hist === null ? 'Bu geçmiş bu rol için açık değil' : 'Kayıt yok')];
        }),
        { ...T('belgeler', 'Belgeler ve sürümler', 'file', 'Evrak', { summary: 'Yürürlük, sürüm ve onay' }), render: (host) => {
                host.replaceChildren(docsPanel(store, 'Ürün belgeleri', ['TECH_DOC', 'ASSET_PHOTO'], { testid: 'ps-prod-docs' }));
                const a = document.createElement('div');
                host.append(a);
                void linkTopic(ctx, T('l', 'Doküman kontrol', 'file', 'x'), [{ label: 'Doküman Kontrol (sürüm, onay, geçerlilik)', href: '#/dokuman-kontrol' }, { label: 'Ürün Master / Digital DNA', href: `#/urun-master?urun=${p.id}` }]).render(a);
            } },
        { ...T('degisiklik', 'Değişiklik ve denetim geçmişi', 'layers', 'Geçmiş', { summary: 'Revizyon, parametre, denetim' }), render: async (host) => {
                const a = document.createElement('div');
                const b = document.createElement('div');
                host.replaceChildren(a, b);
                if (ctx.productWs)
                    await productCardsTopic(ctx, T('x', 'x', 'layers', 'x'), ['history']).render(a);
                await tabTopic(ctx, T('y', 'y', 'layers', 'y'), 'zaman').render(b);
            } },
    ];
    return out;
}
void attrsPanel;
