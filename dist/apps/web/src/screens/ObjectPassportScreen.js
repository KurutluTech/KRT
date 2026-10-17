// KMI NEXT — Universal object passport screen (KMI-RECOVERY-004). Card (the one-glance face) + tabs + timeline + as-of + contextual canonical actions.
// Every value comes from the adapter (canonical tables / RPCs); every action calls the object's existing canonical writer; the server decides.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { TIME_PRESETS, UNVERIFIABLE_TR, actionTr, filterEvents, formatStamp, lateReportMinutes, parseIstanbulLocal, resolveRange, stateAsOf } from '../../../../packages/domain/src/temporal.js';
import { DS_CSS, pill } from '../ds.js';
import { errorText } from '../errorText.js';
import { isLink, isPill } from '../passport/model.js';
import { KINDS, canOpenPassport, isKind, passportHref } from '../passport/registry.js';
import { passportHeader, PASSPORT_HEADER_CSS } from '../passport/passportHeader.js';
const CSS = DS_CSS + PASSPORT_HEADER_CSS + `
.kd .pp-head{display:flex;flex-direction:column;gap:10px}
.kd .pp-kind{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9;font-weight:800}
.kd .pp-title{font-size:22px;font-weight:900;color:#fff;overflow-wrap:anywhere}
.kd .pp-sub{color:#94a3b8;overflow-wrap:anywhere}
.kd .pp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.kd .pp-kpi{border:1px solid #1e293b;border-radius:12px;padding:8px 10px;background:rgba(2,6,23,.45);min-width:0}
.kd .pp-kpi b{display:block;font-size:15px;color:#fff;overflow-wrap:anywhere}.kd .pp-kpi span{font-size:11px;color:#94a3b8}
.kd .pp-links{display:flex;gap:6px;flex-wrap:wrap}
.kd a.pp-chip{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:999px;background:#0f172a;border:1px solid #334155;color:#bae6fd;text-decoration:none;font-size:13px;font-weight:700}
.kd .pp-link{color:#7dd3fc}
.kd .pp-wrap{overflow-x:auto;max-width:100%}.kd table.pp-t{border-collapse:collapse;width:100%;font-size:13px}.kd .pp-t th{text-align:left;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.08em;padding:6px 8px;border-bottom:1px solid #334155;white-space:nowrap}
.kd .pp-t td{padding:7px 8px;border-top:1px solid #1e293b;vertical-align:top;overflow-wrap:anywhere}
.kd .pp-kv{display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:6px 12px;font-size:14px}.kd .pp-kv dt{color:#94a3b8}.kd .pp-kv dd{margin:0;overflow-wrap:anywhere;color:#e2e8f0}
.kd .pp-note{margin-top:8px;font-size:12px;color:#fbbf24;line-height:1.5}
.kd .pp-filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.kd .pp-filters button{min-height:36px;font-size:13px}
.kd .pp-ev{border-top:1px solid #1e293b;padding:10px 0;display:grid;grid-template-columns:150px 1fr;gap:4px 12px}
.kd .pp-ev .t{font-variant-numeric:tabular-nums;color:#e2e8f0;font-weight:700;font-size:13px}.kd .pp-ev .a{font-weight:800;color:#fff}.kd .pp-ev .m{color:#94a3b8;font-size:12px}
.kd .pp-ev details{grid-column:2}.kd .pp-ev summary{cursor:pointer;color:#7dd3fc;font-size:12px}
.kd .pp-cols{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media(min-width:1000px){.kd .pp-cols.has-actions{grid-template-columns:minmax(0,1fr) 320px}}
@media(max-width:600px){.kd .pp-ev{grid-template-columns:1fr}.kd .pp-ev details{grid-column:1}.kd .pp-kv{grid-template-columns:1fr}}
.kd textarea{min-height:70px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:8px;box-sizing:border-box;width:100%}
.kd .pp-form{display:flex;flex-direction:column;gap:8px;margin-top:8px}`;
const SOURCE_TR = { AUDIT: 'Denetim kaydı', STATE: 'Durum kaydı', WORK_ORDER: 'İş emri kaydı', TASK: 'Görev kaydı', QUALITY: 'Kalite kaydı', TOOL: 'Takım kaydı', STOCK: 'Stok kaydı', OTHER: 'Kayıt' };
function cell(c) {
    if (c === null || c === undefined || c === '')
        return '—';
    if (isLink(c))
        return h('a', { class: 'pp-link', href: passportHref(c.kind, c.id), 'data-testid': 'pp-rel', 'data-kind': c.kind, 'data-id': c.id }, c.label);
    if (isPill(c))
        return pill(c.pill, c.tone);
    return String(c);
}
function sectionNode(s) {
    return h('div', { class: 'panel', 'data-testid': 'pp-section' }, h('h2', {}, s.title), s.kv ? h('dl', { class: 'pp-kv' }, ...s.kv.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, cell(v))])) : null, s.table ? (s.table.rows.length ? h('div', { class: 'pp-wrap' }, h('table', { class: 'pp-t' }, h('thead', {}, h('tr', {}, ...s.table.columns.map((c) => h('th', {}, c)))), h('tbody', {}, ...s.table.rows.map((r) => h('tr', { 'data-testid': 'pp-row' }, ...r.map((c) => h('td', {}, cell(c)))))))) : h('div', { class: 'empty', 'data-testid': 'pp-empty' }, s.table.empty)) : null, s.note ? h('div', { class: 'pp-note', 'data-testid': 'pp-note' }, s.note) : null);
}
export async function renderObjectPassportScreen(container, api, state, ctx) {
    const def = KINDS[state.kind];
    const now = () => (ctx.nowIso ? ctx.nowIso() : new Date().toISOString());
    const go = (patch) => { const next = { ...state, ...patch }; if (ctx.replaceUrl !== false) {
        try {
            history.replaceState(null, '', passportHref(next.kind, next.id, next.tab));
        }
        catch { /* fixture */ }
    } void renderObjectPassportScreen(container, api, next, ctx); };
    const shell = (...children) => mount(container, h('div', { class: 'kd', 'data-testid': 'pp-root', 'data-kind': state.kind }, h('style', {}, CSS), ...children));
    if (!isKind(state.kind) || !canOpenPassport(state.kind, ctx.access)) {
        // a person may always open their OWN personnel passport — decided after the card loads (the adapter knows the owner); here only clearly closed kinds stop early
        if (!(def?.personal)) {
            shell(h('h1', {}, 'Pasaport'), h('div', { class: 'panel', 'data-testid': 'pp-closed' }, 'Bu nesne türü rolünüze açık değil.'));
            return;
        }
    }
    let cardData;
    try {
        cardData = await api.card(state.kind, state.id);
    }
    catch (e) {
        const msg = e instanceof Error && e.message === 'KAYIT_BULUNAMADI' ? 'Kayıt bulunamadı (silinmiş olabilir veya görme yetkiniz yok).' : errorText(e);
        shell(h('h1', {}, `${def.tr} pasaportu`), h('div', { class: 'banner error', 'data-testid': 'pp-error' }, msg));
        return;
    }
    const tabKey = def.tabs.some((t) => t.key === state.tab) ? state.tab : def.tabs[0].key;
    const head = passportHeader(cardData, { onTab: (t) => go({ tab: t }), activeTab: tabKey, firstTab: def.tabs[0].key });
    const tabs = h('div', { class: 'tabs', role: 'tablist' }, ...def.tabs.map((t) => h('button', { type: 'button', role: 'tab', class: t.key === tabKey ? 'on' : '', 'aria-selected': String(t.key === tabKey), 'data-testid': `pp-tab-${t.key}`, onClick: () => go({ tab: t.key }) }, t.label)));
    const body = h('div', { 'data-testid': 'pp-body', style: 'display:flex;flex-direction:column;gap:12px' });
    const actions = actionsPanel();
    shell(h('div', { class: 'head' }, h('a', { class: 'btn ghost', href: '#/ara', 'data-testid': 'pp-search' }, '← Arama'), ['MACHINE', 'PRODUCT', 'PERSONNEL', 'CUSTOMER'].includes(state.kind) ? h('a', { class: 'btn ghost', href: `#/pasaport-calisma?tur=${state.kind}&id=${state.id}`, 'data-testid': 'pp-card-link' }, 'Dijital kart: belgeler, fotoğraf, veri') : null), head, tabs, h('div', { class: `pp-cols${actions ? ' has-actions' : ''}` }, body, actions));
    if (tabKey === 'zaman')
        await renderTimeline(body);
    else if (tabKey === 'iz') {
        if (!ctx.trace)
            body.appendChild(h('div', { class: 'panel', 'data-testid': 'setup-pending' }, 'İzlenebilirlik zinciri bu oturumda bağlı değil.'));
        else {
            const host = h('div', { class: 'panel', 'data-testid': 'pp-trace-host', style: 'background:#fff;color:#0f172a;border-radius:12px;padding:8px 4px' });
            body.appendChild(host);
            try {
                await ctx.trace(host, state.kind, state.id);
            }
            catch (e) {
                host.appendChild(h('div', { class: 'banner error', 'data-testid': 'pp-error' }, errorText(e)));
            }
        }
    }
    else {
        let res;
        try {
            res = await api.tab(state.kind, state.id, tabKey);
        }
        catch (e) {
            res = { denied: '' };
            body.appendChild(h('div', { class: 'banner error', 'data-testid': 'pp-error' }, errorText(e)));
        }
        if ('sections' in res)
            for (const s of res.sections)
                body.appendChild(sectionNode(s));
        else if ('pending' in res)
            body.appendChild(h('div', { class: 'panel', 'data-testid': 'setup-pending', style: 'border-left:4px solid #d97706' }, h('h2', {}, 'Kurulum bekleniyor'), h('div', { class: 'mut' }, res.pending)));
        else if (res.denied)
            body.appendChild(h('div', { class: 'panel', 'data-testid': 'pp-denied' }, res.denied));
    }
    async function renderTimeline(host) {
        let events = [];
        let notes = [];
        try {
            const t = await api.timeline(state.kind, state.id);
            events = t.events;
            notes = t.notes;
        }
        catch (e) {
            host.appendChild(h('div', { class: 'banner error', 'data-testid': 'pp-error' }, errorText(e)));
        }
        const preset = state.preset;
        const range = preset ? resolveRange(preset, now(), preset === 'CUSTOM' && state.from && state.to ? { from: state.from, to: state.to } : undefined) : null;
        const actionsSeen = [...new Set(events.map((e) => e.action))].sort();
        const shown = filterEvents(events, { range, action: state.action || undefined, text: state.text, basis: state.basis });
        const from = h('input', { type: 'date', value: state.from ?? '', 'aria-label': 'Başlangıç', 'data-testid': 'pp-from' });
        const to = h('input', { type: 'date', value: state.to ?? '', 'aria-label': 'Bitiş', 'data-testid': 'pp-to' });
        const action = h('select', { 'aria-label': 'İşlem türü', 'data-testid': 'pp-action' }, h('option', { value: '' }, 'Tüm işlemler'), ...actionsSeen.map((a) => h('option', { value: a, selected: a === state.action }, actionTr(a))));
        const text = h('input', { type: 'search', placeholder: 'Ara (işlem, gerekçe, kişi)', value: state.text ?? '', 'data-testid': 'pp-text' });
        const basis = h('select', { 'aria-label': 'Gün esası', 'data-testid': 'pp-basis' }, h('option', { value: 'RECORDED', selected: state.basis !== 'OCCURRED' }, 'Kayıt zamanına göre'), h('option', { value: 'OCCURRED', selected: state.basis === 'OCCURRED' }, 'Bildirilen olay zamanına göre'));
        const apply = () => go({ action: action.value || undefined, text: text.value || undefined, basis: basis.value, from: from.value || undefined, to: to.value || undefined, preset: from.value && to.value && state.preset === 'CUSTOM' ? 'CUSTOM' : state.preset });
        const filters = h('div', { class: 'panel', 'data-testid': 'pp-filters' }, h('h2', {}, 'Zaman filtreleri'), h('div', { class: 'pp-filters' }, h('button', { type: 'button', class: !state.preset ? 'primary' : 'ghost', 'data-testid': 'pp-preset-ALL', onClick: () => go({ preset: undefined }) }, 'Tümü'), ...TIME_PRESETS.filter((p) => p.code !== 'CUSTOM').map((p) => h('button', { type: 'button', class: state.preset === p.code ? 'primary' : 'ghost', 'data-testid': `pp-preset-${p.code}`, onClick: () => go({ preset: p.code }) }, p.tr))), h('div', { class: 'pp-filters', style: 'margin-top:8px' }, from, to, h('button', { type: 'button', class: 'ghost', 'data-testid': 'pp-custom', onClick: () => go({ preset: 'CUSTOM', from: from.value || undefined, to: to.value || undefined }) }, 'Özel aralık'), action, text, basis, h('button', { type: 'button', class: 'ghost', 'data-testid': 'pp-apply', onClick: apply }, 'Uygula')), range ? h('div', { class: 'mut', style: 'margin-top:6px', 'data-testid': 'pp-range' }, `Aralık: ${formatStamp(range.from, false)} – ${formatStamp(range.to, false)} (bitiş hariç)`) : preset === 'CUSTOM' ? h('div', { class: 'pp-note', 'data-testid': 'pp-range-bad' }, 'Geçerli bir başlangıç ve bitiş tarihi girin (bitiş başlangıçtan sonra olmalı).') : null);
        host.appendChild(filters);
        const asOfBox = await asOfPanel();
        if (asOfBox)
            host.appendChild(asOfBox);
        const list = h('div', { class: 'panel', 'data-testid': 'pp-timeline' }, h('h2', {}, `Olay geçmişi · ${shown.length}${shown.length !== events.length ? ` / ${events.length}` : ''}`), shown.length ? null : h('div', { class: 'empty', 'data-testid': 'pp-empty' }, events.length ? 'Seçilen filtrelerde olay yok.' : 'Bu nesne için kayıtlı olay yok. (Geçmiş uydurulmaz: olay kaydı yoksa burada görünmez.)'), ...shown.map((e) => {
            const late = lateReportMinutes(e);
            return h('div', { class: 'pp-ev', 'data-testid': 'pp-event', 'data-source': e.source, 'data-action': e.action }, h('div', { class: 't', 'data-testid': 'pp-event-time' }, formatStamp(e.at)), h('div', {}, h('div', { class: 'a' }, actionTr(e.action), ' ', pill(SOURCE_TR[e.source] ?? e.source, e.source === 'AUDIT' ? 'info' : '')), h('div', { class: 'm' }, `${e.actorName ?? (e.actorId ? 'kullanıcı ' + e.actorId.slice(0, 8) : 'aktör kaydı yok')}${e.fromState || e.toState ? ` · ${e.fromState ?? '—'} → ${e.toState ?? '—'}` : ''}${e.reason ? ` · gerekçe: ${e.reason}` : ''}`), e.occurredAt ? h('div', { class: 'm', 'data-testid': 'pp-occurred' }, `Bildirilen olay zamanı: ${formatStamp(e.occurredAt)}${late ? ` · ${late} dk geç bildirildi` : ''}`) : null), e.changes.length ? h('details', {}, h('summary', {}, `Değişiklik geçmişi (${e.changes.length} alan)`), h('div', { class: 'pp-wrap' }, h('table', { class: 'pp-t' }, h('thead', {}, h('tr', {}, h('th', {}, 'Alan'), h('th', {}, 'Eski'), h('th', {}, 'Yeni'))), h('tbody', {}, ...e.changes.map((c) => h('tr', {}, h('td', {}, c.field), h('td', {}, c.from), h('td', {}, c.to))))))) : null);
        }));
        host.appendChild(list);
        for (const n of notes)
            host.appendChild(h('div', { class: 'pp-note', 'data-testid': 'pp-timeline-note' }, n));
    }
    async function asOfPanel() {
        let hist = null;
        try {
            hist = await api.stateHistory(state.kind, state.id);
        }
        catch {
            hist = null;
        }
        if (!hist)
            return h('div', { class: 'panel', 'data-testid': 'pp-asof-na' }, h('h2', {}, 'Geçmiş tarihteki durum'), h('div', { class: 'mut' }, 'Bu nesne türü için durum geçiş kayıtları tutulmadığından geçmiş durum hesaplanamaz: TARİHSEL DURUM DOĞRULANAMIYOR.'));
        const input = h('input', { type: 'datetime-local', value: state.asOf ?? '', 'aria-label': 'Hangi tarih ve saat', 'data-testid': 'pp-asof-input' });
        let out = null;
        if (state.asOf) {
            const iso = parseIstanbulLocal(state.asOf);
            if (!iso)
                out = h('div', { class: 'pp-note', 'data-testid': 'pp-asof-bad' }, 'Geçerli bir tarih ve saat girin.');
            else {
                const r = stateAsOf(hist.events, iso, { createdAt: hist.createdAt, basis: state.basis ?? 'RECORDED' });
                const label = formatStamp(iso, false);
                out = r.kind === 'KNOWN' ? h('div', { 'data-testid': 'pp-asof-result', 'data-kind': 'KNOWN' }, h('b', {}, `${label} itibarıyla ${hist.label}: ${r.state}`), h('div', { class: 'mut' }, `Bu durum ${formatStamp(r.since)} kaydından beri geçerliydi.${r.revised ? ' Not: sonradan girilen/düzeltilen kayıt bu geçmişi değiştirdi (bildirilen olay zamanı esası).' : ''}`))
                    : r.kind === 'NOT_EXISTING' ? h('div', { 'data-testid': 'pp-asof-result', 'data-kind': 'NOT_EXISTING' }, `${label} tarihinde bu nesne henüz kayıtlı değildi.`)
                        : h('div', { 'data-testid': 'pp-asof-result', 'data-kind': 'UNVERIFIABLE', class: 'banner error' }, `${label} itibarıyla: `, UNVERIFIABLE_TR, h('div', { class: 'mut', style: 'color:inherit;font-weight:400' }, r.reason === 'NO_EVENTS' ? 'Bu nesne için hiç durum geçişi kaydı yok; geçmiş durum bilinemez.' : r.reason === 'BROKEN_CHAIN' ? 'Durum kayıtlarında kopukluk var (bir geçiş eksik).' : 'Başlangıç durumu kayıtlı değil.'));
            }
        }
        return h('div', { class: 'panel', 'data-testid': 'pp-asof' }, h('h2', {}, 'Geçmiş tarihteki durum (as-of)'), h('div', { class: 'pp-filters' }, input, h('button', { type: 'button', class: 'primary', 'data-testid': 'pp-asof-go', onClick: () => go({ asOf: input.value || undefined }) }, 'Durumu göster')), h('div', { class: 'mut', style: 'margin-top:6px' }, 'Yalnızca o ana kadar kaydedilmiş olaylardan hesaplanır; kayıt yoksa durum uydurulmaz.'), out);
    }
    function actionsPanel() {
        const items = [];
        const note = (txt) => h('div', { class: 'mut', style: 'margin-top:8px' }, txt);
        const banner = h('div', { 'data-testid': 'pp-action-msg', 'aria-live': 'polite' });
        const say = (ok, msg) => { banner.className = `banner ${ok ? 'info' : 'error'}`; banner.textContent = msg; };
        // one in-flight action at a time; a retry of the SAME form reuses its request id (the server de-duplicates), a new form gets a new one
        let busy = false;
        const run = (fn, okMsg) => async () => { if (busy)
            return; busy = true; try {
            await fn();
            say(true, okMsg);
            setTimeout(() => go({}), 600);
        }
        catch (e) {
            say(false, errorText(e));
        }
        finally {
            busy = false;
        } };
        const taskRequestId = `pp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        if (def.taskSource) {
            const title = h('input', { placeholder: 'Görev başlığı (en az 3 karakter)', 'data-testid': 'pp-task-title' });
            const desc = h('textarea', { placeholder: 'Açıklama', 'data-testid': 'pp-task-desc' });
            const role = h('select', { 'data-testid': 'pp-task-role', 'aria-label': 'Atanacak rol' }, ...['QUALITY', 'MAINTENANCE', 'OPERATOR', 'MANAGEMENT', 'PURCHASING', 'SHIPPING', 'ACCOUNTING', 'CAM'].map((r) => h('option', { value: r }, r)));
            items.push(h('div', {}, h('h2', {}, 'Görev / aksiyon aç'), h('div', { class: 'pp-form' }, title, desc, role, h('button', { type: 'button', class: 'primary', 'data-testid': 'pp-task-create', onClick: run(() => api.createTask(state.kind, state.id, { title: title.value, description: desc.value, role: role.value, requestId: taskRequestId }), 'Görev açıldı; zaman çizelgesine işlendi.') }, 'Görev aç'))));
        }
        else
            items.push(note(`Görev bağlama: ${def.tr} için görev kaynağı tanımlı değil (görevler iş emri, sipariş, NCR, kalite HOLD, bakım kaydı, satınalma talebi ve sevkiyata bağlanır) — BLOCKED.`));
        if (state.kind === 'MACHINE') {
            const reason = h('textarea', { placeholder: 'Arıza / durum nedeni', 'data-testid': 'pp-fault-reason' });
            const sev = h('select', { 'data-testid': 'pp-fault-sev', 'aria-label': 'Önem' }, ...['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => h('option', { value: s, selected: s === 'MEDIUM' }, s)));
            items.push(h('div', {}, h('h2', {}, 'Arıza işlemleri'), h('div', { class: 'pp-form' }, reason, sev, h('button', { type: 'button', class: 'warnb', 'data-testid': 'pp-fault-report', onClick: run(() => api.reportMachineFault(state.id, reason.value, sev.value), 'Arıza bildirimi kaydedildi.') }, 'Arıza bildir'), ctx.access.actions.includes('MAINTENANCE_TEST_RELEASE') ? h('button', { type: 'button', class: 'danger', 'data-testid': 'pp-set-down', onClick: run(() => api.setMachineDown(state.id, reason.value, sev.value), 'Makine DOWN yapıldı; bakım kaydı açıldı.') }, 'Makineyi DOWN yap (yetkili)') : null, h('div', { class: 'mut' }, 'DOWN yalnız yetkili yönetim/bakım personelinde görünür; yetkiyi sunucu denetler.'))));
        }
        if (state.kind === 'MAINTENANCE_TICKET' && ctx.access.actions.includes('MAINTENANCE_TEST_RELEASE')) {
            items.push(h('div', {}, h('h2', {}, 'Bakım adımı'), h('div', { class: 'pp-form' }, ...[['IN_PROGRESS', 'Müdahaleye başla'], ['TEST_PENDING', 'Teste gönder']].map(([to, label]) => h('button', { type: 'button', class: 'ghost', 'data-testid': `pp-ticket-${to}`, onClick: run(() => api.transitionTicket(state.id, to), 'Bakım kaydı ilerledi.') }, label)), h('div', { class: 'mut' }, 'Servise dönüş test sonucu ve yetkili onayla Bakım ekranından yapılır (kapı atlanmaz).'))));
        }
        if (def.docEntity)
            items.push(h('div', {}, h('h2', {}, 'Belge'), h('a', { class: 'btn ghost', href: `#/dokumanlar?tip=${def.docEntity}&id=${encodeURIComponent(state.id)}`, 'data-testid': 'pp-doc-add' }, 'Belge ekle / incele')));
        items.push(note('Serbest not alanı: bu veritabanında nesne notu tablosu yok (BLOCKED, migration taslağı sahip onayı bekler). Not yerine görev açılabilir.'));
        if (!items.length)
            return null;
        return h('div', { class: 'panel', 'data-testid': 'pp-actions', style: 'align-self:start' }, h('h2', {}, 'Yetkili işlemler'), banner, ...items);
    }
}
