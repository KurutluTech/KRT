// KMI NEXT — Global history search (KMI-RECOVERY-004 F). Time presets on Istanbul day boundaries, object/action/text/basis filters, every result opens its passport.
// Searching never invents history: only rows that exist in the single audit source are shown, and the screen says what it cannot know.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { TIME_PRESETS, resolveRange, filterEvents, formatStamp, actionTr, lateReportMinutes } from '../../../../packages/domain/src/temporal.js';
import { DS_CSS, pill } from '../ds.js';
import { errorText } from '../errorText.js';
import { KINDS, passportHref, canOpenPassport } from '../passport/registry.js';
const KIND_OF_TYPE = {};
for (const k of Object.values(KINDS))
    for (const t of k.auditTypes)
        KIND_OF_TYPE[t] = k.kind;
const LATE_WINDOW_DAYS = 14;
const TYPE_TR = { PRODUCT: 'Ürün', PRODUCT_REVISION: 'Ürün revizyonu', CAM_PROGRAM: 'CAM programı' };
const ENTITY_OPTIONS = Object.keys(KIND_OF_TYPE).sort();
export async function renderHistorySearchScreen(container, api, opts) {
    const st = { preset: 'TODAY', basis: 'RECORDED', ...opts.state };
    const host = h('div', { 'data-testid': 'hs-results' });
    const input = (type, v, tid, ph = '') => h('input', { type, value: v ?? '', 'data-testid': tid, placeholder: ph });
    const from = input('date', st.from, 'hs-from'), to = input('date', st.to, 'hs-to');
    const text = input('search', st.text, 'hs-text', 'Ara: işlem, kişi, gerekçe, kayıt…');
    const action = input('text', st.action, 'hs-action', 'İşlem kodu (ör. TRANSITION_STATUS)');
    const entity = h('select', { 'data-testid': 'hs-entity' }, h('option', { value: '' }, 'Tüm nesneler'), ...ENTITY_OPTIONS.map((t) => h('option', { value: t, ...(t === st.entityType ? { selected: true } : {}) }, TYPE_TR[t] ?? KINDS[KIND_OF_TYPE[t]].tr)));
    const basis = h('select', { 'data-testid': 'hs-basis' }, h('option', { value: 'RECORDED' }, 'Kayıt zamanına göre'), h('option', { value: 'OCCURRED', ...(st.basis === 'OCCURRED' ? { selected: true } : {}) }, 'Olay zamanına göre (varsa)'));
    const presetBtns = h('div', { class: 'tabs', 'data-testid': 'hs-presets' }, ...TIME_PRESETS.map((p) => h('button', { type: 'button', class: p.code === st.preset ? 'on' : '', 'data-testid': `hs-preset-${p.code}`, onClick: () => { st.preset = p.code; void run(); } }, p.tr)));
    const rowEl = (e) => {
        const kind = KIND_OF_TYPE[e.entityType];
        const open = kind && canOpenPassport(kind, opts.access) ? passportHref(kind, e.entityId) : null;
        const late = lateReportMinutes(e);
        return h('div', { class: 'item', 'data-testid': 'hs-event', 'data-action': e.action, 'data-entity': e.entityType }, h('div', { style: 'min-width:150px;font-variant-numeric:tabular-nums' }, h('b', { 'data-testid': 'hs-stamp' }, formatStamp(e.at)), late ? h('div', { class: 'mut', 'data-testid': 'hs-late' }, `Geç bildirim: olay ${formatStamp(e.occurredAt)} (${late} dk önce yaşandı)`) : null), h('div', { class: 'grow' }, h('div', {}, h('b', {}, actionTr(e.action)), ' ', pill(kind ? KINDS[kind].tr : e.entityType, 'info')), h('div', { class: 'mut' }, [e.actorName ?? (e.actorId ? `kullanıcı ${e.actorId.slice(0, 8)}` : 'sistem'), e.fromState || e.toState ? `${e.fromState ?? '—'} → ${e.toState ?? '—'}` : null, e.reason].filter(Boolean).join(' · '))), open ? h('a', { class: 'btn ghost', href: open, 'data-testid': 'hs-open' }, 'Pasaport →') : null);
    };
    async function run() {
        st.from = from.value || undefined;
        st.to = to.value || undefined;
        st.text = text.value;
        st.action = action.value.trim() || undefined;
        st.entityType = entity.value || undefined;
        st.basis = basis.value;
        for (const b of Array.from(presetBtns.children))
            b.classList.toggle('on', b.dataset['testid'] === `hs-preset-${st.preset}`);
        const range = resolveRange(st.preset, opts.nowIso, st.preset === 'CUSTOM' && st.from && st.to ? { from: st.from, to: st.to } : undefined);
        if (!range) {
            host.replaceChildren(h('div', { class: 'banner error', 'data-testid': 'hs-badrange' }, st.preset === 'CUSTOM' ? 'Özel aralık için başlangıç ve bitiş tarihini seçin.' : 'Geçersiz aralık.'));
            return;
        }
        host.replaceChildren(h('div', { class: 'mut' }, 'Aranıyor…'));
        try {
            // OCCURRED basis: a late report is recorded AFTER the window it belongs to, so the server fetch is widened by LATE_WINDOW_DAYS past the window end and the window itself is applied client-side on the event time.
            const fetchRange = st.basis === 'OCCURRED' ? { from: range.from, to: new Date(Date.parse(range.to) + LATE_WINDOW_DAYS * 86400000).toISOString() } : range;
            const r = await api.search({ range: fetchRange, ...(st.entityType ? { entityType: st.entityType } : {}), ...(st.action ? { action: st.action } : {}) });
            // the basis may re-date late reports: the server query used the record time, so OCCURRED is applied on top of an already time-bounded fetch
            const shown = filterEvents(r.events, { range, ...(st.text ? { text: st.text } : {}), basis: st.basis });
            const kids = [
                h('div', { class: 'mut', 'data-testid': 'hs-count' }, `${shown.length} olay · aralık ${formatStamp(range.from)} – ${formatStamp(range.to)} (İstanbul)${st.basis === 'OCCURRED' ? ` · olay zamanı tabanı: en fazla ${LATE_WINDOW_DAYS} gün geç bildirilenler bulunur` : ''}`),
                r.truncated ? h('div', { class: 'banner error', 'data-testid': 'hs-truncated' }, 'Sonuç sınırına ulaşıldı: daha eski kayıtlar listelenmedi. Aralığı daraltın.') : null,
                shown.length ? h('div', { class: 'panel' }, ...shown.map(rowEl)) : h('div', { class: 'empty', 'data-testid': 'hs-empty' }, 'Bu filtrelerle denetim kaydında olay yok. (Kaydı olmayan geçmiş uydurulmaz; “olay yok” ile “kayıt tutulmamış” aynı şey olmayabilir.)')
            ];
            host.replaceChildren(...kids.filter((k) => k !== null));
        }
        catch (e) {
            host.replaceChildren(h('div', { class: 'banner error', 'data-testid': 'hs-error' }, errorText(e)));
        }
    }
    mount(container, h('div', { class: 'kd', 'data-testid': 'hs-root' }, h('style', {}, DS_CSS), h('h1', {}, 'Olay geçmişi · zaman araması'), h('div', { class: 'mut' }, 'Tek denetim kaynağı: kmi_next.audit_log. Zaman damgaları sunucudan gelir (Türkiye saati, saniyeli). Bu KMI’nin dahili operasyonel mührüdür; nitelikli elektronik zaman damgası değildir.'), presetBtns, h('div', { class: 'head' }, h('label', {}, 'Başlangıç ', from), h('label', {}, 'Bitiş ', to)), h('div', { class: 'head' }, entity, action, basis, text, h('button', { type: 'button', class: 'primary', 'data-testid': 'hs-go', onClick: () => void run() }, 'Ara')), host));
    await run();
}
