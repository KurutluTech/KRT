import { attrsPanel, docsPanel, photoPanel } from '../storePanels.js';
import { NA, dt, day, nf, link, pill, orNA, inList, kv, table, note, tabTopic, actionsTopic, opt, renderSections, MACHINE_TR, WO_TR } from './common.js';
import { actorNames } from './personnel.js';
import { pctOf } from './util.js';
import { h } from '../../../../../packages/ui/src/h.js';
export const MACHINE_COLS = 'id,code,name,category,status,down_since,total_down_minutes,machine_class,updated_at';
const ACTIVE = ['IN_PROGRESS', 'FIRST_PIECE_PENDING', 'FIRST_PIECE_APPROVED'];
export function machineTopics(ctx, m) {
    const store = ctx.store;
    const T = (id, title, icon, group, extra = {}) => ({ id, title, icon, group, ...extra });
    const R = (id, title, icon, group, summary, load, extra = {}) => ({ ...T(id, title, icon, group, { summary, ...extra }), render: (host) => renderSections(ctx, host, load) });
    const A = (id, title, icon, group, summary, codes, docs = null) => ({
        ...T(id, title, icon, group, { summary }), render: (host) => { host.replaceChildren(attrsPanel(store, title, codes, { testid: `ps-${id}-attrs`, empty: 'Bu alanlar için değer girilmemiş' }), ...(docs ? [docsPanel(store, 'İlgili belgeler', docs, { testid: `ps-${id}-docs` })] : [])); }
    });
    const rollup = async () => {
        const to = ctx.nowIso().slice(0, 10);
        const from = `${to.slice(0, 7)}-01`;
        const r = await opt(ctx.rpc('oee_rollup', { p_from: from, p_to: to, p_group: 'MACHINE' }));
        return { from, to, row: r?.find((x) => x.groupKey === m.code) ?? null };
    };
    return [
        A('teknik', 'Teknik kimlik', 'cnc', 'Kimlik', 'Üretici, model, seri no', ['MANUFACTURER', 'MODEL', 'SERIAL_NO', 'MODEL_YEAR']),
        R('kapasite', 'Kapasite ve limitler', 'gauge', 'Kimlik', 'Strok, mil, magazin', async () => {
            const today = ctx.nowIso().slice(0, 10);
            const end = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10);
            const load = await opt(ctx.rpc('machine_shift_load', { p_from: today, p_to: end }));
            const mine = (load ?? []).filter((x) => x.machineId === m.id);
            return [kv('Sınıf', [['Makine sınıfı', orNA(m.machineClass)], ['Kategori', orNA(m.category)]]),
                table('Önümüzdeki 7 gün planlı yük (machine_shift_load)', ['Gün', 'Vardiya', 'Planlı dk', 'Kapasite dk', 'Doluluk'], mine.map((x) => [day(x.plannedDate), x.plannedShiftCode, nf(x.plannedMinutes), nf(x.capacityMinutes), x.capacityMinutes > 0 ? pctOf(x.plannedMinutes / x.capacityMinutes) ?? NA : NA]), load === null ? 'Yük okunamadı' : 'Planlı yük yok')];
        }, {}),
        A('kontrol', 'Kontrol ünitesi, eksenler, strok', 'chip', 'Kimlik', 'Kontrol, eksen, strok değerleri', ['CONTROLLER', 'AXES', 'TRAVEL_X', 'TRAVEL_Y', 'TRAVEL_Z', 'SPINDLE_RPM_MAX', 'SPINDLE_POWER_KW', 'TOOL_CAPACITY']),
        A('ekipman', 'Takılı ekipman: bölücü, prob', 'layers', 'Kimlik', 'Bölücü / prob / aksesuar', ['DIVIDER_TYPE', 'PROBE_TYPE', 'MOUNTED_EQUIPMENT_NOTE']),
        R('aktif-is', 'Aktif iş ve iş emri kuyruğu', 'factory', 'Operasyon', 'Aktif ve bekleyen iş emirleri', async () => {
            const wos = await ctx.sel('work_orders', 'id,status,operator_id,qty_planned,qty_produced,planned_date,planned_shift_code,planned_minutes', { machine_id: `eq.${m.id}`, status: 'not.in.(COMPLETED,CANCELLED,CLOSED)' }, 'planned_date.asc.nullslast', 60);
            const ops = await opNames(ctx, wos.map((w) => w.operatorId));
            const row = (w) => [link('WORK_ORDER', w.id, `İE ${w.id.slice(0, 8)}`), WO_TR[w.status] ?? w.status, link('PERSONNEL', w.operatorId, w.operatorId ? ops[w.operatorId] : null), w.plannedDate ? `${day(w.plannedDate)}${w.plannedShiftCode ? ` · ${w.plannedShiftCode}` : ''}` : NA, `${nf(w.qtyProduced)} / ${nf(w.qtyPlanned)}`];
            return [table('Üretimdeki iş emirleri', ['İş emri', 'Durum', 'Operatör', 'Plan', 'Üretilen / planlanan'], wos.filter((w) => ACTIVE.includes(w.status)).map(row), 'Şu an üretimde iş emri yok'),
                table('Planlı / bekleyen kuyruk', ['İş emri', 'Durum', 'Operatör', 'Plan', 'Üretilen / planlanan'], wos.filter((w) => !ACTIVE.includes(w.status)).map(row), 'Bekleyen iş emri yok')];
        }),
        R('atamalar', 'Personel ve vardiya atamaları', 'users', 'Operasyon', 'Yetkili operatörler', async () => {
            const [cl, wos] = await Promise.all([
                ctx.sel('operator_machine_clearances', 'personnel_id,granted_at,valid_until,revoked_at', { machine_id: `eq.${m.id}`, revoked_at: 'is.null' }, 'granted_at.desc', 100),
                opt(ctx.sel('work_orders', 'operator_id,planned_shift_code,planned_date', { machine_id: `eq.${m.id}`, status: `in.(${ACTIVE.join(',')})` }, undefined, 50)),
            ]);
            const names = await opNames(ctx, [...cl.map((c) => c.personnelId), ...(wos ?? []).map((w) => w.operatorId)]);
            return [table('Bu makinede yetkili operatörler', ['Operatör', 'Veriliş', 'Geçerlilik'], cl.map((c) => [link('PERSONNEL', c.personnelId, names[c.personnelId]), dt(c.grantedAt), c.validUntil ? day(c.validUntil) : 'Süresiz']), 'Makineye özel operatör yetkisi kaydı yok'),
                table('Şu an çalışan atamalar', ['Operatör', 'Vardiya', 'Gün'], (wos ?? []).map((w) => [link('PERSONNEL', w.operatorId, w.operatorId ? names[w.operatorId] : null), orNA(w.plannedShiftCode), w.plannedDate ? day(w.plannedDate) : NA]), 'Aktif atama yok'),
                note('Kural', 'Bir makinede aynı anda tek aktif üretim oturumu olur; bir operatör birden çok makineyi yönetebilir (çoklu makine yetkisi gerekir).')];
        }),
        R('cam', 'CAM programları ve operasyonlar', 'chip', 'Operasyon', 'Bu makinede koşan operasyonlar', async () => {
            const ops = await ctx.sel('routing_operations', 'id,product_revision_id,op_no,name,cam_program_id,cycle_seconds_target,setup_minutes_target,primary_machine_id', { active: 'eq.true', or: `(primary_machine_id.eq.${m.id},allowed_machine_ids.cs.{${m.id}})` }, 'op_no', 100);
            const progs = ops.some((o) => o.camProgramId) ? await opt(ctx.sel('cam_programs', 'id,program_no,revision,status', { id: inList(ops.map((o) => o.camProgramId).filter((x) => !!x)) })) : [];
            const pm = new Map((progs ?? []).map((p) => [p.id, p]));
            return [table('Operasyonlar', ['Op', 'Ad', 'CAM programı', 'Çevrim (sn)', 'Hazırlık (dk)', 'Birincil makine'], ops.map((o) => { const p = o.camProgramId ? pm.get(o.camProgramId) : undefined; return [`${o.opNo}`, o.name, p ? `${p.programNo} rev ${p.revision} · ${p.status}` : NA, o.cycleSecondsTarget === null ? NA : nf(o.cycleSecondsTarget), o.setupMinutesTarget === null ? NA : nf(o.setupMinutesTarget), o.primaryMachineId === m.id ? pill('Evet', 'ok') : 'Hayır']; }), 'Bu makineye tanımlı operasyon yok')];
        }),
        { ...T('bakim', 'Bakım, arıza ve müdahaleler', 'wrench', 'Bakım ve test', { summary: MACHINE_TR[m.status] ?? m.status, tone: m.status === 'DOWN' ? 'bad' : m.status === 'MAINTENANCE' ? 'info' : m.status === 'HOLD' ? 'warn' : 'ok' }),
            render: async (host) => {
                const a = document.createElement('div');
                const b = document.createElement('div');
                host.replaceChildren(a, b);
                await tabTopic(ctx, T('x', 'x', 'wrench', 'x'), 'ariza').render(a);
                await actionsTopic(ctx, T('y', 'y', 'wrench', 'y')).render(b);
            } },
        R('test-servis', 'Test ve servise dönüş', 'check', 'Bakım ve test', 'Test bekleyen / dönen kayıtlar', async () => {
            const t = await ctx.sel('maintenance_tickets', 'id,kind,status,reason,updated_at', { machine_id: `eq.${m.id}`, status: 'in.(TEST_PENDING,RETURNED_TO_SERVICE,CLOSED)' }, 'updated_at.desc', 40);
            return [table('Test aşaması ve servise dönüş kayıtları', ['Kayıt', 'Durum', 'Neden', 'Güncelleme'], t.map((x) => [link('MAINTENANCE_TICKET', x.id, `${x.kind} ${x.id.slice(0, 8)}`), x.status, x.reason, dt(x.updatedAt)]), 'Test/servise dönüş kaydı yok'), note('Süreç', 'Servise dönüş: bakım kaydı TEST_BEKLİYOR → test sonucu → SERVİSE DÖNDÜ. Eylemler "Bakım, arıza ve müdahaleler" sayfasındadır.')];
        }),
        { ...T('kalibrasyon', 'Kalibrasyon', 'scan', 'Bakım ve test', { summary: 'Sertifikalar ve geçerlilik' }), render: (host) => { host.replaceChildren(docsPanel(store, 'Kalibrasyon sertifikaları', ['CALIBRATION_CERTIFICATE'], { testid: 'ps-calib-docs', empty: 'Kalibrasyon sertifikası yok' })); } },
        R('oee', 'OEE ve üretim performansı', 'chart', 'Performans', 'Bu ay · oee_rollup', async () => {
            const { from, to, row } = await rollup();
            return [kv(`Bu ay (${from} – ${to})`, row ? [['Kullanılabilirlik', pctOf(row.availability) ?? NA], ['Performans', pctOf(row.performance) ?? NA], ['Kalite', pctOf(row.quality) ?? NA], ['OEE', pctOf(row.oee) ?? NA], ['İyi / toplam adet', `${nf(row.goodCount)} / ${nf(row.totalCount)}`], ['Eksik girdi', row.missing?.length ? row.missing.join(', ') : 'Yok']] : [['Durum', 'Bu makine için bu ay planlı/kanıtlı üretim kaydı yok — OEE hesaplanmaz.']], 'Kaynak: oee_rollup (tek canonical OEE hesabı). CNC bağlantısı olmadığından fiziksel çalışma süresi doğrulanmaz.')];
        }),
        R('durus', 'Duruşlar ve kayıp nedenleri', 'stop', 'Performans', `Toplam duruş: ${nf(m.totalDownMinutes, 'dk')}`, async () => {
            const { row } = await rollup();
            return [kv('Kayıtlı toplam duruş', [['Toplam duruş', m.totalDownMinutes === null ? NA : nf(m.totalDownMinutes, 'dk')], ['Kayıtlı durum', pill(MACHINE_TR[m.status] ?? m.status, m.status === 'UP' ? 'ok' : m.status === 'DOWN' ? 'bad' : 'info')], ['DOWN başlangıcı', m.status === 'DOWN' ? dt(m.downSince) : '—']]),
                kv('Bu ay kayıp dakikaları (oee_rollup)', row ? [['Hazırlık', nf(row.lossSetup)], ['Takım', nf(row.lossTool)], ['Arıza', nf(row.lossFault)], ['Malzeme bekleme', nf(row.lossMaterialWait)], ['Bakım', nf(row.lossMaintenance)], ['Diğer', nf(row.lossOther)]] : [['Durum', 'Bu ay kayıp kaydı yok']])];
        }),
        R('takimlar', 'Takım ilişkileri', 'wrench', 'Operasyon', 'Makinede takılı takımlar', async () => {
            const t = await opt(ctx.sel('tools', 'id,code,tool_type,location', { machine_id: `eq.${m.id}` }, 'code', 100));
            return [table('Bu makinede takılı/ilişkili takımlar', ['Takım', 'Tip', 'Konum'], (t ?? []).map((x) => [link('TOOL', x.id, x.code), orNA(x.toolType), x.location]), t === null ? 'Takım listesi bu rol için açık değil' : 'Makinede takılı takım kaydı yok')];
        }),
        { ...T('medya', 'Fotoğraf, katalog, belgeler', 'file', 'Evrak', { summary: 'Fotoğraf ve teknik dokümanlar' }), render: (host) => { host.replaceChildren(photoPanel(store, 'Makine fotoğrafı'), docsPanel(store, 'Katalog ve belgeler', ['CATALOG', 'SERVICE_DOC', 'TECH_DOC'], { testid: 'ps-mach-docs' })); } },
        A('parametreler', 'Parametreler ve hesap girdileri', 'calc', 'Evrak', 'Tüm pasaport alanları (düzenlenebilir)', null),
        tabTopic(ctx, T('gecmis', 'Değişiklik geçmişi', 'layers', 'Geçmiş', { summary: 'Zaman çizelgesi' }), 'zaman'),
    ];
}
async function opNames(ctx, ids) {
    const u = [...new Set(ids.filter((x) => !!x))];
    if (!u.length)
        return {};
    const rows = await opt(ctx.sel('personnel', 'id,name', { id: inList(u) }, undefined, 300));
    return Object.fromEntries((rows ?? []).map((r) => [r.id, r.name]));
}
void h;
void actorNames;
