// KMI-MANAGEMENT-001 · Yönetim Toplantıları ve Karar Geçmişi — toplantı kaydı değiştirilemez; kararlar sorumlu / vade / bağlantı ile izlenir, kapanışta takip notu zorunludur, her geçiş geçmişte kalır.
import { h } from '../../../../../packages/ui/src/h.js';
import { isOverdue } from '../../../../../packages/domain/src/managementIntel.js';
import { pill, provenance } from '../../ds.js';
import { kpi, setKpiContext, areaIn, bannerEl, field, fmtDate, fmtDateTime, formBox, guarded, loadTab, needText, selectIn, textIn } from './kit.js';
const KIND = [['HAFTALIK', 'Haftalık yönetim'], ['AYLIK', 'Aylık değerlendirme'], ['YONETIM_KURULU', 'Yönetim kurulu'], ['OLAGANUSTU', 'Olağanüstü'], ['DIGER', 'Diğer']];
const LINK = [['NONE', 'Bağlantı yok'], ['OBJECTIVE', 'Hedef (kimlik)'], ['RISK', 'Risk (kimlik)'], ['APPROVAL', 'Ticari onay (kimlik)']];
export async function renderMeetingsTab(panel, ctx, banner) {
    const redraw = (b) => renderMeetingsTab(panel, ctx, b);
    const run = guarded(panel, redraw);
    setKpiContext(ctx, new Date(ctx.nowMs).toISOString());
    await loadTab(panel, 'Yönetim Toplantıları ve Karar Geçmişi', 'mt', async () => ({ data: await ctx.api.meetings(), owners: await ctx.api.owners() }), ({ data, owners }) => {
        const canWrite = ctx.held.has('MEETING_MANAGE');
        const ownerOpts = () => owners.map((o) => [o.id, o.name]);
        const decisions = data.meetings.flatMap((m) => m.decisions);
        const openDec = decisions.filter((d) => d.status === 'OPEN');
        const card = (m) => {
            const dText = textIn('mt-dec-text', 'Karar metni');
            const dOwner = selectIn('mt-dec-owner', ownerOpts());
            const dDue = textIn('mt-dec-due', 'Vade (isteğe bağlı)', 'date');
            const dLink = selectIn('mt-dec-linktype', LINK);
            const dLinkId = textIn('mt-dec-linkid', 'Bağlı kayıt kimliği');
            return h('div', { class: 'panel', 'data-testid': 'mt-meeting', 'data-meeting-id': m.id, style: 'margin-top:8px' }, h('div', { class: 'head' }, h('b', { class: 'grow' }, m.title), pill(KIND.find(([v]) => v === m.kind)?.[1] ?? m.kind, 'info'), h('span', { class: 'mut' }, fmtDateTime(m.heldAt))), h('div', { class: 'mut' }, `Katılımcılar: ${m.attendees.length ? m.attendees.join(', ') : 'kayıt yok'}${m.agenda ? ` · Gündem: ${m.agenda}` : ''}`), m.minutes ? h('div', { class: 'mut' }, `Notlar: ${m.minutes}`) : null, ...m.decisions.map((d) => {
                const note = textIn('mt-dec-note', 'Takip notu (kapatmak için zorunlu)');
                const late = isOverdue(d.dueDate, d.status, data.today);
                return h('div', { class: 'item', 'data-testid': 'mt-decision', 'data-decision-id': d.id, 'data-status': d.status, style: 'align-items:flex-start' }, h('div', { class: 'grow', style: 'min-width:200px' }, h('b', {}, d.text), h('div', { class: 'mut' }, `Sorumlu: ${d.ownerName ?? 'BİLİNMİYOR'} · Vade: ${fmtDate(d.dueDate)}${d.linkedType !== 'NONE' ? ` · Bağlı: ${d.linkedType} ${d.linkedId?.slice(0, 8)}` : ''}${d.followUpNote ? ` · Takip: ${d.followUpNote}` : ''}`), d.history.length ? h('div', { class: 'mut', 'data-testid': 'mt-dec-history' }, d.history.map((e) => `${fmtDateTime(e.at)} ${e.event}`).join(' → ')) : null), pill(d.status === 'OPEN' ? 'Açık' : d.status === 'DONE' ? 'Tamamlandı' : 'İptal', d.status === 'DONE' ? 'ok' : d.status === 'CANCELLED' ? '' : 'info', 'mt-dec-status'), late ? pill('GECİKTİ', 'bad', 'mt-dec-late') : null, canWrite && d.status === 'OPEN' ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;flex-basis:100%' }, note, h('button', { type: 'button', class: 'okb', 'data-testid': 'mt-dec-done', onClick: () => { const bad = needText(note.value, 5, 'Takip notu'); if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    } void run(() => ctx.api.setDecisionStatus(d.id, 'DONE', note.value.trim()), 'Karar tamamlandı olarak kapatıldı.'); } }, 'Tamamlandı'), h('button', { type: 'button', class: 'danger', 'data-testid': 'mt-dec-cancel', onClick: () => { const bad = needText(note.value, 5, 'İptal gerekçesi'); if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    } void run(() => ctx.api.setDecisionStatus(d.id, 'CANCELLED', note.value.trim()), 'Karar iptal edildi.'); } }, 'İptal')) : null);
            }), m.decisions.length === 0 ? h('div', { class: 'empty' }, 'Bu toplantıda kayıtlı karar yok.') : null, canWrite ? formBox('Karar ekle', 'mt-dec-form', field('Karar', dText), field('Sorumlu', dOwner), field('Vade', dDue), field('Bağlantı türü', dLink), field('Bağlı kayıt kimliği', dLinkId), h('button', { type: 'button', class: 'primary', 'data-testid': 'mt-dec-save', onClick: () => {
                    const bad = needText(dText.value, 5, 'Karar metni') ?? (dLink.value !== 'NONE' && !dLinkId.value.trim() ? 'Bağlı kayıt kimliği zorunlu' : null);
                    if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    }
                    void run(() => ctx.api.addDecision({ meetingId: m.id, text: dText.value.trim(), ownerId: dOwner.value, due: dDue.value || null, linkedType: dLink.value, linkedId: dLink.value === 'NONE' ? null : dLinkId.value.trim() }), 'Karar kaydedildi.');
                } }, 'Kararı kaydet')) : null);
        };
        const title = textIn('mt-title', 'Toplantı başlığı');
        const kind = selectIn('mt-kind', KIND);
        const when = textIn('mt-when', 'Tarih-saat', 'datetime-local');
        const agenda = areaIn('mt-agenda', 'Gündem');
        const minutes = areaIn('mt-minutes', 'Toplantı notları');
        const att = h('select', { multiple: 'true', 'data-testid': 'mt-attendees', 'aria-label': 'Katılımcılar', size: '4', style: 'min-height:96px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff' }, ...owners.map((o) => h('option', { value: o.id }, o.name)));
        return h('div', { class: 'kd', 'data-testid': 'mt-root' }, bannerEl(banner, 'mt-banner'), h('div', { class: 'kpis' }, kpi('Toplantı', String(data.meetings.length), 'mt-kpi-meetings'), kpi('Açık karar', String(openDec.length), 'mt-kpi-open'), kpi('Geciken karar', String(openDec.filter((d) => isOverdue(d.dueDate, d.status, data.today)).length), 'mt-kpi-late')), h('div', { class: 'panel', 'data-testid': 'mt-list' }, h('h2', {}, `Toplantılar (${data.meetings.length})`), ...(data.meetings.length ? data.meetings.map(card) : [h('div', { class: 'empty', 'data-testid': 'mt-empty' }, 'Kayıtlı toplantı yok.')])), canWrite ? formBox('Yeni toplantı kaydı', 'mt-form', field('Başlık', title), field('Tür', kind), field('Tarih-saat', when), field('Katılımcılar', att, 'Ctrl/⌘ ile çoklu seçim'), field('Gündem', agenda), field('Notlar', minutes), h('button', { type: 'button', class: 'primary', 'data-testid': 'mt-save', onClick: () => {
                const bad = needText(title.value, 3, 'Başlık') ?? (when.value ? null : 'Tarih-saat zorunlu');
                if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                }
                const ids = [...att.selectedOptions].map((o) => o.value);
                void run(() => ctx.api.createMeeting({ heldAt: new Date(when.value).toISOString(), title: title.value.trim(), kind: kind.value, attendeeIds: ids, agenda: agenda.value, minutes: minutes.value }), 'Toplantı kaydedildi (toplantı kaydı sonradan değiştirilemez; düzeltme yeni karar olarak eklenir).');
            } }, 'Toplantıyı kaydet')) : null, provenance('mgmt_meetings · mgmt_decisions · mgmt_events', fmtDateTime(data.generatedAt)));
    });
}
