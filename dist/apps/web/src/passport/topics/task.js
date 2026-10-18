import { NA, dt, nf, link, pill, orNA, kv, table, note, linkTopic, opt, renderSections, TASK_TR } from './common.js';
import { PASSPORT_KINDS_SOURCE } from './generic.js';
/** completion / approval facts come from the append-only task events (the table itself is not readable directly) */
export function withEvents(t, ev) {
    const last = (name) => [...(ev ?? [])].reverse().find((e) => e.event === name) ?? null;
    const c = t.status === 'COMPLETED' || t.status === 'APPROVED' ? last('COMPLETED') : null;
    const a = t.status === 'APPROVED' ? last('APPROVED') : null;
    const st = last('STARTED');
    const cx = t.status === 'CANCELLED' ? last('CANCELLED') : null;
    return { ...t, startedAt: st?.at ?? null, completedAt: c?.at ?? null, completedBy: c?.actorLabel ?? null, approvedAt: a?.at ?? null, approvedBy: a?.actorLabel ?? null, cancelledReason: cx?.note ?? null };
}
const DONE = ['DONE', 'COMPLETED', 'APPROVED'];
export const TASK_COLS = '';
/** One definition of "late": completed after due, or still open past due. Unknown due date → no verdict. */
export function delayOf(t, nowIso) {
    if (!t.dueAt)
        return { state: 'UNKNOWN', minutes: null };
    if (t.status === 'CANCELLED')
        return { state: 'UNKNOWN', minutes: null };
    const due = Date.parse(t.dueAt);
    if (t.completedAt) {
        const d = (Date.parse(t.completedAt) - due) / 60000;
        return { state: d > 0 ? 'LATE' : d < -60 ? 'EARLY' : 'ON_TIME', minutes: Math.round(d) };
    }
    const d = (Date.parse(nowIso) - due) / 60000;
    return d > 0 ? { state: 'LATE', minutes: Math.round(d) } : { state: 'OPEN', minutes: Math.round(d) };
}
export const mins = (m) => { if (m === null)
    return NA; const a = Math.abs(m); const t = a >= 1440 ? `${Math.floor(a / 1440)} gün ${Math.floor((a % 1440) / 60)} sa` : a >= 60 ? `${Math.floor(a / 60)} sa ${a % 60} dk` : `${a} dk`; return t; };
export function taskTopics(ctx, t) {
    const T = (id, title, icon, group, extra = {}) => ({ id, title, icon, group, ...extra });
    const R = (id, title, icon, group, summary, load, extra = {}) => ({ ...T(id, title, icon, group, { summary, ...extra }), render: (host) => renderSections(ctx, host, load) });
    const dl = delayOf(t, ctx.nowIso());
    const srcKind = t.sourceType && PASSPORT_KINDS_SOURCE.includes(t.sourceType) ? t.sourceType : null;
    return [
        R('tanim', 'Görev tanımı', 'clipboard', 'Görev', TASK_TR[t.status] ?? t.status, async () => [kv('Tanım', [['Kod', t.id.slice(0, 8).toUpperCase()], ['Başlık', t.title], ['Açıklama', orNA(t.description)], ['Durum', pill(TASK_TR[t.status] ?? t.status, DONE.includes(t.status) ? 'ok' : t.status === 'CANCELLED' ? '' : 'info')], ['Açılış', dt(t.createdAt)], ['İptal nedeni', t.cancelledReason ?? '—']])]),
        R('sorumlu', 'Sorumlu ve atananlar', 'users', 'Görev', t.assigneeLabel ?? t.assigneeRole ?? 'Atanmamış', async () => [kv('Sorumluluk', [['Atanan', orNA(t.assigneeLabel)], ['Atanan rol / ekip', orNA(t.assigneeRole)], ['Görevi açan', orNA(t.ownerLabel)], ['Bana atanmış mı', t.assignedToMe ? 'Evet' : 'Hayır']])]),
        R('zaman', 'Başlangıç, hedef bitiş, gecikme', 'clock', 'Zaman', dl.state === 'LATE' ? `Gecikti · ${mins(dl.minutes)}` : dl.state === 'EARLY' ? `Erken bitti · ${mins(dl.minutes)}` : dl.state === 'UNKNOWN' ? 'Hedef bitiş girilmemiş' : dl.state === 'OPEN' ? `Kalan ${mins(dl.minutes)}` : 'Zamanında', async () => [
            kv('Zaman', [['Başlangıç', dt(t.startsAt)], ['Hedef bitiş', dt(t.dueAt)], ['Tamamlanma', t.completedAt ? dt(t.completedAt) : 'Tamamlanmadı'],
                ['Gecikme durumu', dl.state === 'LATE' ? pill(`Gecikti · ${mins(dl.minutes)}`, 'bad') : dl.state === 'EARLY' ? pill(`Erken · ${mins(dl.minutes)}`, 'ok') : dl.state === 'ON_TIME' ? pill('Zamanında', 'ok') : dl.state === 'OPEN' ? pill(`Kalan ${mins(dl.minutes)}`, 'info') : NA],
                ['Gerçekleşen süre', t.completedAt && t.startsAt ? mins(Math.round((Date.parse(t.completedAt) - Date.parse(t.startsAt)) / 60000)) : NA]], 'Gecikme gerçek zaman ve kayıtlardan hesaplanır; saklanmaz.')
        ], { tone: dl.state === 'LATE' ? 'bad' : dl.state === 'EARLY' ? 'ok' : undefined }),
        R('sonuc', 'Beklenen sonuç ve kanıt', 'check', 'Sonuç', t.requiresEvidence ? 'Kanıt zorunlu' : 'Kanıt zorunlu değil', async () => {
            const ev = await opt(ctx.rpc('task_evidence_list', { p_task_id: t.id }));
            return [kv('Sonuç', [['Kanıt gerekli mi', t.requiresEvidence ? 'Evet' : 'Hayır'], ['Tamamlama notu', orNA(t.completionNote)]]),
                table('Fotoğraf / belge kanıtı', ['Dosya', 'Tür', 'Boyut', 'Yükleyen', 'Zaman'], (ev ?? []).map((e) => [e.fileName, e.mimeType, `${nf(Math.round(e.sizeBytes / 1024))} KB`, e.uploaderLabel, dt(e.uploadedAt)]), ev === null ? 'Kanıt listesi bu rol için açık değil' : t.requiresEvidence ? 'Kanıt henüz yüklenmedi' : 'Kanıt yok'),
                note('Kontrol listesi', 'Görev modelinde ayrı bir kontrol listesi kaydı yoktur (EKSİK KAYNAK); uydurulmadı. Kanıt ve tamamlama notu yukarıdadır.')];
        }),
        R('iliskili', 'İlgili iş emri, ürün, makine', 'link', 'İlişkiler', t.sourceType ?? 'Bağımsız görev', async () => [kv('Kaynak kayıt', [['Tür', orNA(t.sourceType)], ['Kayıt', srcKind && t.sourceId ? link(srcKind, t.sourceId, t.sourceType) : (t.sourceId ? t.sourceId.slice(0, 8) : 'Bağımsız görev')]])]),
        R('onay', 'Onay akışı', 'shield', 'Sonuç', t.approvedAt ? 'Onaylandı' : t.completedAt ? 'Onay bekliyor' : 'Henüz tamamlanmadı', async () => [kv('Tamamlama ve onay', [['Tamamlayan', orNA(t.completedBy)], ['Tamamlanma', t.completedAt ? dt(t.completedAt) : NA], ['Onaylayan', orNA(t.approvedBy)], ['Onay zamanı', t.approvedAt ? dt(t.approvedAt) : NA], ['Onay notu', orNA(t.approvalNote)]])]),
        linkTopic(ctx, T('islem', 'İşlemler (başlat, tamamla, onayla)', 'tasks', 'İşlem', { summary: 'Görevlerim ekranında' }), [{ label: 'Bu görevi Görevlerim ekranında aç', href: `#/gorevler?t=${t.id}`, note: 'Başlatma, kanıt yükleme, tamamlama ve onay mevcut akışta yapılır; durum makinesi değişmedi.' }]),
        R('gecmis', 'Olay ve değişiklik geçmişi', 'layers', 'Geçmiş', 'Görev olayları', async () => {
            const h = await ctx.rpc('task_history', { p_task_id: t.id });
            return [table('Görev olayları', ['Zaman', 'Olay', 'Yapan', 'Not'], h.map((e) => [dt(e.at), e.event, e.actorLabel, orNA(e.note)]), 'Olay yok')];
        }),
    ];
}
