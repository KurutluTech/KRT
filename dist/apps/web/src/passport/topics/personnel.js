import { attrsPanel, docsPanel, photoPanel } from '../storePanels.js';
import { h } from '../../../../../packages/ui/src/h.js';
import { NA, dt, day, nf, link, pill, orNA, inList, kv, table, note, tabTopic, linkTopic, opt, pilotIdSet, MACHINE_TR, WO_TR, TASK_TR, floorTasks, canManageTasks } from './common.js';
import { ymNow } from './util.js';
import { pilotText } from '../../pilotMark.js';
export const PERSON_COLS = 'id,name,roles,department,active,skills,shift_code,auth_user_id,employee_no,created_at,updated_at';
const ROLE_TR = { ADMIN: 'Yönetici (sistem)', MANAGEMENT: 'Yönetim', OPERATOR: 'Operatör', CAM: 'CAM', QUALITY: 'Kalite', MAINTENANCE: 'Bakım', PURCHASING: 'Satın alma', ACCOUNTING: 'Muhasebe', WAREHOUSE: 'Depo', SHIPPING: 'Sevkiyat', SALES: 'Satış' };
/** Private personnel file: the data subject, the system OWNER, management/accounting and PERSONNEL_MANAGE holders. The server enforces the same; this only keeps the UI honest. */
export const canSeePrivate = (ctx) => ctx.own || ctx.access.owner || ctx.access.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT' || r === 'ACCOUNTING') || ctx.access.actions.includes('PERSONNEL_MANAGE');
const isManager = (ctx) => ctx.access.owner || ctx.access.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT') || ctx.access.actions.includes('PERSONNEL_MANAGE');
export function personnelTopics(ctx, p) {
    const priv = canSeePrivate(ctx);
    const mgr = isManager(ctx);
    const store = ctx.store;
    const authId = p.authUserId;
    const T = (id, title, icon, group, extra = {}) => ({ id, title, icon, group, ...extra });
    return [
        // ---- Kimlik & iş
        { ...T('kimlik', 'Kimlik ve iş bilgisi', 'user', 'Kimlik', { summary: 'Unvan, sicil, sistem rolü' }), render: (host) => {
                host.replaceChildren(sectionHost(ctx, [kv('Kayıt', [['Ad Soyad', p.name], ['Sicil no', orNA(p.employeeNo)], ['Sistem rolü (yetki)', (p.roles ?? []).map((r) => ROLE_TR[r] ?? r).join(', ') || NA], ['Durum', pill(p.active ? 'Aktif' : 'Pasif', p.active ? 'ok' : 'bad')]], 'Sistem rolü bir yetki kümesidir; İŞ UNVANI değildir. Doğrulanmış unvan aşağıdaki kayıttan gelir.')]), attrsPanel(store, 'İş unvanı ve eğitim özeti', ['JOB_TITLE', 'EDUCATION_NOTE'], { testid: 'ps-person-attrs' }));
            } },
        { ...T('bolum', 'Bölüm, görev, vardiya', 'clock', 'Kimlik', { summary: p.department ? `${p.department}${p.shiftCode ? ` · vardiya ${p.shiftCode}` : ''}` : 'Bölüm girilmemiş' }),
            render: (host) => renderS(ctx, host, async () => {
                const shifts = await opt(ctx.sel('shift_definitions', 'code,label,start_time,end_label,minutes', {}, 'code'));
                const mine = shifts?.find((s) => s.code === p.shiftCode);
                return [kv('Bölüm ve vardiya', [['Bölüm', orNA(p.department)], ['Vardiya kodu', orNA(p.shiftCode)], ['Vardiya', mine ? `${mine.label} · ${mine.startTime}${mine.endLabel ? ` – ${mine.endLabel}` : ''} · ${mine.minutes} dk` : NA]]),
                    table('Tanımlı vardiyalar', ['Kod', 'Ad', 'Başlangıç', 'Süre'], (shifts ?? []).map((s) => [s.code, s.label, s.startTime, `${s.minutes} dk`]), 'Vardiya tanımı yok')];
            }) },
        // ---- Yetki
        { ...T('yetki', 'Yetki ve erişim yönetimi', 'shield', 'Yetki', { visible: priv, summary: 'Rol, makine yetkileri, çoklu makine' }),
            render: (host) => renderS(ctx, host, async () => {
                const [cl, multi, grants] = await Promise.all([
                    opt(ctx.sel('operator_machine_clearances', 'machine_id,reason,granted_at,valid_until,revoked_at', { personnel_id: `eq.${p.id}` }, 'granted_at.desc')),
                    opt(ctx.sel('operator_multi_machine_authorizations', 'max_concurrent_machines,reason,granted_at,revoked_at', { person_id: `eq.${p.id}` }, 'granted_at.desc')),
                    authId && mgr ? opt(ctx.sel('permission_grants', 'module,verb,record_scope,reason,granted_at,revoked_at', { user_id: `eq.${authId}` }, 'granted_at.desc')) : Promise.resolve(null),
                ]);
                const ms = await machineNames(ctx, (cl ?? []).map((c) => c.machineId));
                const now = ctx.nowIso();
                return [kv('Rol', [['Sistem rolü', (p.roles ?? []).map((r) => ROLE_TR[r] ?? r).join(', ') || NA], ['Hesap bağlı mı', authId ? pill('Bağlı', 'ok') : pill('Hesap yok', 'warn')]]),
                    table('Makine yetkileri', ['Makine', 'Veriliş', 'Geçerlilik', 'Durum', 'Gerekçe'], (cl ?? []).map((c) => [link('MACHINE', c.machineId, ms[c.machineId]), dt(c.grantedAt), c.validUntil ? day(c.validUntil) : 'Süresiz', c.revokedAt ? pill('İptal', 'bad') : c.validUntil && c.validUntil < now ? pill('Süresi doldu', 'warn') : pill('Geçerli', 'ok'), orNA(c.reason)]), cl === null ? 'Bu kayıt okunamadı' : 'Makine yetkisi yok'),
                    table('Çoklu makine yetkisi', ['En çok eşzamanlı makine', 'Veriliş', 'Durum', 'Gerekçe'], (multi ?? []).map((m) => [m.maxConcurrentMachines, dt(m.grantedAt), m.revokedAt ? pill('İptal', 'bad') : pill('Geçerli', 'ok'), orNA(m.reason)]), 'Çoklu makine yetkisi yok (varsayılan: tek makine)'),
                    ...(grants ? [table('Modül yetkileri', ['Modül', 'Eylem', 'Kapsam', 'Veriliş', 'Durum'], grants.map((g) => [g.module, g.verb, orNA(g.recordScope), dt(g.grantedAt), g.revokedAt ? pill('İptal', 'bad') : pill('Geçerli', 'ok')]), 'Modül yetkisi kaydı yok')] : [])];
            }) },
        { ...T('yetki-gecmis', 'Yetki atama ve değişiklik geçmişi', 'layers', 'Yetki', { visible: priv, summary: 'Kim, ne zaman, neden' }),
            render: (host) => renderS(ctx, host, async () => {
                const rows = await ctx.sel('audit_log', 'at,action,reason,entity_type,actor_user_id', { entity_id: `eq.${p.id}`, entity_type: 'in.(PERSONNEL,OPERATOR_CLEARANCE,PERMISSION_GRANT,MULTI_MACHINE_AUTH)' }, 'at.desc', 100);
                const who = await actorNames(ctx, rows.map((r) => r.actorUserId));
                return [table('Yetki ve kayıt değişiklikleri', ['Zaman', 'İşlem', 'Yapan', 'Gerekçe'], rows.map((r) => [dt(r.at), r.action, r.actorUserId ? (who[r.actorUserId] ?? 'Kullanıcı') : NA, orNA(r.reason)]), 'Kayıtlı yetki değişikliği yok')];
            }) },
        // ---- Çalışma
        { ...T('is-emirleri', 'İş emirleri ve makine atamaları', 'factory', 'Çalışma', { summary: 'Atanmış iş emirleri' }),
            render: (host) => renderS(ctx, host, async () => {
                const wos = await ctx.sel('work_orders', 'id,status,machine_id,qty_planned,qty_produced,planned_date,planned_shift_code', { operator_id: `eq.${p.id}` }, 'updated_at.desc', 60);
                const ms = await machineNames(ctx, wos.map((w) => w.machineId));
                const pil = await pilotIdSet(ctx, wos.map((w) => w.id));
                return [table('Bu kişiye atanmış iş emirleri', ['İş emri', 'Durum', 'Makine', 'Plan', 'Üretilen / planlanan'], wos.map((w) => [link('WORK_ORDER', w.id, pilotText(`İE ${w.id.slice(0, 8)}`, pil.has(w.id))), WO_TR[w.status] ?? w.status, link('MACHINE', w.machineId, w.machineId ? ms[w.machineId] : null), w.plannedDate ? `${day(w.plannedDate)}${w.plannedShiftCode ? ` · ${w.plannedShiftCode}` : ''}` : NA, `${nf(w.qtyProduced)} / ${nf(w.qtyPlanned)}`]), 'Atanmış iş emri yok')];
            }) },
        { ...T('gorevler', 'Görev emirleri ve değişiklikleri', 'tasks', 'Çalışma', { summary: 'Atanmış görevler' }),
            render: (host) => renderS(ctx, host, async () => {
                if (!ctx.own && !canManageTasks(ctx.access))
                    return [note('Görevler', 'Başka bir kişinin görev listesini görmek için görev yönetimi yetkisi gerekir.')];
                const all = await floorTasks(ctx);
                if (all === null)
                    return [note('Görevler', 'Görev listesi okunamadı (Görev Zemini RPC).')];
                const mine = ctx.own ? all.filter((t) => t.assignedToMe) : all.filter((t) => t.assigneeLabel === p.name);
                return [table('Atanmış görevler', ['Görev', 'Durum', 'Hedef bitiş', 'Gecikme'], mine.map((t) => [link('TASK', t.id, t.title), TASK_TR[t.status] ?? t.status, dt(t.dueAt), t.dueAt ? (t.isLate ? pill('Gecikti', 'bad') : pill('Zamanında', 'ok')) : NA]), 'Atanmış görev yok'),
                    note('Kapsam', 'Görev Zemini penceresi: açık/sürüyor/tamamlanan ve son 7 günde değişen görevler (en çok 200). Olay ve değişiklikler her görevin kendi pasaportundadır.')];
            }) },
        // ---- Gelişim
        { ...T('yetkinlik', 'Yetkinlik matrisi ve seviyeler', 'cap', 'Gelişim', { summary: 'Beceri seviyeleri ve geçmişi' }),
            render: (host) => renderS(ctx, host, async () => {
                const [sk, ev] = await Promise.all([
                    ctx.sel('personnel_skills', 'skill_code,level,valid_until,source,granted_at', { personnel_id: `eq.${p.id}` }, 'skill_code'),
                    opt(ctx.sel('competency_events', 'skill_code,from_level,to_level,source,reason,at', { personnel_id: `eq.${p.id}` }, 'at.desc', 60)),
                ]);
                const now = ctx.nowIso().slice(0, 10);
                return [table('Beceriler', ['Beceri', 'Seviye', 'Geçerlilik', 'Kaynak'], sk.map((s) => [s.skillCode, `${s.level}`, s.validUntil ? (s.validUntil < now ? pill(`Süresi doldu · ${day(s.validUntil)}`, 'bad') : day(s.validUntil)) : 'Süresiz', orNA(s.source)]), 'Kayıtlı beceri yok'),
                    table('Seviye değişiklikleri', ['Zaman', 'Beceri', 'Önce → sonra', 'Kaynak', 'Gerekçe'], (ev ?? []).map((e) => [dt(e.at), e.skillCode, `${e.fromLevel ?? '—'} → ${e.toLevel ?? '—'}`, orNA(e.source), orNA(e.reason)]), 'Seviye değişikliği yok')];
            }) },
        tabTopic(ctx, T('rozetler', 'Rozetler ve kazanma koşulları', 'badge', 'Gelişim', { summary: 'Rozet profili' }), 'rozetler'),
        { ...T('egitim', 'Eğitimler ve sertifikalar', 'book', 'Gelişim', { summary: 'Akademi kayıtları' }),
            render: (host) => renderS(ctx, host, async () => {
                const en = await ctx.sel('academy_enrollments', 'id,module_id,status,enrolled_at', { personnel_id: `eq.${p.id}` }, 'enrolled_at.desc', 60);
                const mods = en.length ? await opt(ctx.sel('academy_modules', 'id,code,title,validity_months', { id: inList(en.map((e) => e.moduleId)) })) : [];
                const asm = en.length ? await opt(ctx.sel('academy_assessments', 'enrollment_id,result,score,assessed_at', { enrollment_id: inList(en.map((e) => e.id)) }, 'assessed_at.desc')) : [];
                const mm = new Map((mods ?? []).map((m) => [m.id, m]));
                const am = new Map();
                for (const a of asm ?? [])
                    if (!am.has(a.enrollmentId))
                        am.set(a.enrollmentId, a);
                return [table('Eğitim kayıtları', ['Modül', 'Durum', 'Kayıt', 'Son değerlendirme'], en.map((e) => { const m = mm.get(e.moduleId); const a = am.get(e.id); return [m ? `${m.code} · ${m.title}` : NA, e.status, dt(e.enrolledAt), a ? `${a.result}${a.score !== null ? ` (${a.score})` : ''} · ${dt(a.assessedAt)}` : 'Değerlendirme yok']; }), 'Eğitim kaydı yok'),
                    note('Sertifika belgeleri', 'Yüklenen sertifika/eğitim belgeleri "Belgeler" konusunda tutulur.')];
            }) },
        // ---- Devam & bordro (özel)
        { ...T('izin', 'İzin ve devamsızlık', 'clock', 'Devam ve bordro', { visible: priv, summary: 'Puantaj girdisinden' }),
            render: (host) => renderS(ctx, host, async () => {
                const may = ctx.access.owner || ctx.access.actions.includes('PUANTAJ_MANAGE') || ctx.access.roles.some((r) => r === 'ADMIN' || r === 'MANAGEMENT');
                const out = [];
                if (may) {
                    const cur = ymNow(ctx.nowIso());
                    const d = new Date(`${cur}-01T00:00:00Z`);
                    d.setUTCMonth(d.getUTCMonth() - 1);
                    const prev = d.toISOString().slice(0, 7);
                    const rows = [];
                    for (const m of [cur, prev]) {
                        const f = await opt(ctx.rpc('puantaj_month_facts', { p_month: m }));
                        const me = f?.people.find((x) => x.personnelId === p.id);
                        rows.push([m, f === null ? NA : me?.manual ? (me.manual.absenceDays === null ? NA : nf(me.manual.absenceDays)) : 'Girdi yok', me?.manual?.isExcluded ? 'Evet' : 'Hayır']);
                    }
                    out.push(table('Aylık devamsızlık günü (puantaj girdisi)', ['Ay', 'Devamsızlık günü', 'Prim dışı'], rows, 'Puantaj girdisi yok'));
                }
                else
                    out.push(note('Devamsızlık', 'Devamsızlık günleri yönetim tarafından puantaj girdisi olarak girilir; bu sayfada yetkiniz kapsamında gösterilecek kayıt yok.'));
                out.push(note('Kapsam', 'Sistemde ayrı bir izin (yıllık/mazeret izni) modülü yoktur; burada yalnız puantaj girdisindeki devamsızlık günü gösterilir. İzin başvurusu ve onay akışı bu görevde oluşturulmadı (EKSİK KAYNAK).'));
                return out;
            }) },
        linkTopic(ctx, T('puantaj', 'Puantaj, vardiya, giriş-çıkış', 'calc', 'Devam ve bordro', { visible: priv && (mgr || ctx.access.roles.includes('ACCOUNTING')), summary: `Ay: ${ymNow(ctx.nowIso())}` }), [{ label: 'Puantaj ve prim havuzu', href: '#/puantaj', note: 'Hesap ve onay kuralları bu modülde; burada kopya tutulmaz.' }, { label: 'Vardiya planı', href: '#/planlama', note: 'Planlanan vardiya ve makine yükü' }]),
        { ...T('performans', 'Performans, hedef ve prim', 'chart', 'Devam ve bordro', { visible: priv && (mgr || ctx.own), summary: 'OEE ve kanıtlı üretim' }),
            render: (host) => renderS(ctx, host, async () => {
                const to = ctx.nowIso().slice(0, 10);
                const from = `${to.slice(0, 7)}-01`;
                const r = await opt(ctx.rpc('oee_rollup', { p_from: from, p_to: to, p_group: 'OPERATOR' }));
                const mine = r?.find((x) => x.groupKey === p.name);
                const pct = (v) => (v === null || v === undefined ? NA : `% ${nf(v * 100)}`);
                return [kv(`Bu ay (${from} – ${to}) · OEE`, mine ? [['Kullanılabilirlik', pct(mine.availability)], ['Performans', pct(mine.performance)], ['Kalite', pct(mine.quality)], ['OEE', pct(mine.oee)], ['İyi / toplam adet', `${nf(mine.goodCount)} / ${nf(mine.totalCount)}`], ['Eksik girdi', mine.missing?.length ? mine.missing.join(', ') : 'Yok']] : [['Durum', 'Bu kişi için bu ay planlı/kanıtlı üretim kaydı yok — OEE hesaplanmaz (sıfır gösterilmez).']], 'Kaynak: oee_rollup (tek canonical OEE hesabı). Hedef ve prim hesabı Puantaj modülündedir.')];
            }) },
        // ---- Evrak
        { ...T('belgeler', 'Personel belgeleri', 'file', 'Evrak', { visible: priv, summary: 'Özlük ve kimlik belgeleri' }), render: (host) => { host.replaceChildren(docsPanel(store, 'Personel belgeleri', ['PERSONNEL_FILE', 'PERSONNEL_ID'], { testid: 'ps-person-docs', empty: 'Belge yok' })); } },
        { ...T('medya', 'Fotoğraf ve kimlik medyası', 'upload', 'Evrak', { summary: 'Profil fotoğrafı' }), render: (host) => { host.replaceChildren(photoPanel(store, 'Profil fotoğrafı'), attrsPanel(store, 'İletişim ve acil durum', ['PHONE', 'ADDRESS', 'EMERGENCY_CONTACT'], { testid: 'ps-person-contact', empty: 'Bu alanlar için yetkiniz yok ya da değer girilmemiş' })); } },
        // ---- Geçmiş
        { ...T('istihdam', 'İşe giriş, çıkış, aktiflik', 'users', 'Geçmiş', { visible: priv, summary: 'İstihdam olayları' }),
            render: (host) => renderS(ctx, host, async () => {
                const ev = await ctx.sel('personnel_employment_events', 'event_type,reason,at,login_revoked', { personnel_id: `eq.${p.id}` }, 'at.desc', 60);
                return [kv('Durum', [['Aktiflik', pill(p.active ? 'Aktif' : 'Pasif', p.active ? 'ok' : 'bad')], ['Kayıt açılışı', dt(p.createdAt)]]), table('İstihdam olayları', ['Zaman', 'Olay', 'Gerekçe', 'Giriş kapatıldı'], ev.map((e) => [dt(e.at), e.eventType, orNA(e.reason), e.loginRevoked ? 'Evet' : 'Hayır']), 'İstihdam olayı yok')];
            }) },
        tabTopic(ctx, T('denetim', 'Denetim ve değişiklik geçmişi', 'layers', 'Geçmiş', { visible: priv, summary: 'Zaman çizelgesi' }), 'zaman'),
    ];
}
function sectionHost(ctx, secs) { const d = document.createElement('div'); d.className = 'ps-page'; renderSecs(ctx, secs, d); return d; }
import { sectionNode } from '../sections.js';
function renderSecs(ctx, secs, host) { host.replaceChildren(...secs.map((s) => sectionNode(s, ctx.hrefOf))); }
import { renderSections } from './common.js';
const renderS = renderSections;
async function machineNames(ctx, ids) {
    const u = [...new Set(ids.filter((x) => !!x))];
    if (!u.length)
        return {};
    const rows = await opt(ctx.sel('machines', 'id,code,name', { id: inList(u) }, undefined, 300));
    return Object.fromEntries((rows ?? []).map((m) => [m.id, `${m.code} · ${m.name}`]));
}
async function actorNames(ctx, ids) {
    const u = [...new Set(ids.filter((x) => !!x))];
    if (!u.length)
        return {};
    const rows = await opt(ctx.sel('personnel', 'auth_user_id,name', { auth_user_id: inList(u) }, undefined, 300));
    return Object.fromEntries((rows ?? []).filter((r) => r.authUserId).map((r) => [r.authUserId, r.name]));
}
export { machineNames, actorNames };
void h;
void MACHINE_TR;
