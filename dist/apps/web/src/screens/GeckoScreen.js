// KMI NEXT — Giriş-Çıkış (GEÇKO). Migration 0030. Shows KMI NEXT's own immutable ledger, mirrored
// from old KMI's REAL GEÇKO feed (SELECT-only). Feed health is always on top so a stale or broken
// feed is never mistaken for "nobody is inside". A card counts for a person only after an
// explicit, audited verification — the old name-based AUTO_MATCHED is not trusted.
// This screen never feeds the puantaj formula (D-001).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { GECKO_FEED_STATE_TR, canSetGeckoIdentifierLink, insideNowText } from '../../../../packages/domain/src/gecko.js';
import { errorText as sharedErrorText } from '../errorText.js';
const STATE_TR = { INSIDE: 'İÇERİDE', OUTSIDE: 'DIŞARIDA', UNKNOWN: 'BİLİNMİYOR' };
const MAPPING_TR = { VERIFIED: 'DOĞRULANDI', DISABLED: 'DEVRE DIŞI', UNMATCHED: 'EŞLENMEMİŞ' };
const FEED_COLOR = { OK: '#15803d', STALE: '#b45309', FAILING: '#b91c1c', NOT_CONNECTED: '#64748b' };
const SOURCE_TR = { LEGACY_MIRROR: 'eski KMI GEÇKO kaydından ayna', DIRECT_API: 'doğrudan GEÇKO API' };
export function istanbulToday(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function hm(iso) {
    if (!iso)
        return '—';
    return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function stamp(iso) {
    if (!iso)
        return '—';
    return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export async function renderGeckoScreen(container, api, state = {}) {
    const date = state.date ?? istanbulToday();
    let health = null;
    let rows = [];
    let idents = [];
    let people = [];
    let loadError = null;
    try {
        [health, rows, idents, people] = await Promise.all([api.health(), api.attendance(date), api.identifiers(), api.people()]);
    }
    catch (err) {
        loadError = sharedErrorText(err);
    }
    const rerender = (next) => void renderGeckoScreen(container, api, { date, ...next });
    const fail = (err) => rerender({ banner: { kind: 'error', text: sharedErrorText(err) } });
    const dateIn = h('input', { type: 'date', 'data-testid': 'gecko-date', value: date, onChange: () => rerender({ date: dateIn.value, banner: null }) });
    const syncNow = async () => {
        try {
            const r = await api.syncNow();
            rerender({ banner: r.status === 'SUCCESS'
                    ? { kind: 'ok', text: `Eşitlendi: ${r.eventsInserted} yeni hareket (${r.eventsAlready} zaten vardı${r.eventsRejected ? `, ${r.eventsRejected} hatalı satır reddedildi` : ''}).` }
                    : { kind: 'error', text: `Eşitleme başarısız: ${r.error ?? r.status}` } });
        }
        catch (err) {
            fail(err);
        }
    };
    const banner = state.banner
        ? h('div', { 'data-testid': 'gecko-banner', 'data-kind': state.banner.kind, style: `padding:10px;border-radius:8px;margin:8px 0;background:${state.banner.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.banner.text)
        : null;
    const healthBox = health
        ? h('div', { 'data-testid': 'gecko-health', style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px;border:1px solid #e2e8f0;border-radius:12px' }, h('span', { 'data-testid': 'gecko-feed-state', 'data-state': health.feedState, style: `font-weight:800;color:#fff;background:${FEED_COLOR[health.feedState]};padding:4px 10px;border-radius:999px` }, `Akış: ${GECKO_FEED_STATE_TR[health.feedState]}`), h('span', { 'data-testid': 'gecko-source' }, health.source ? `Kaynak: ${SOURCE_TR[health.source] ?? health.source}` : 'Kaynak: henüz eşitleme yok'), h('span', {}, `Son başarılı eşitleme: ${stamp(health.lastSuccessAt)}`), h('span', {}, `Son hareket: ${stamp(health.lastEventAt)}`), h('span', { 'data-testid': 'gecko-pending', 'data-count': String(health.legacyNotMirrored) }, `Aktarılmamış: ${health.legacyNotMirrored}`), h('span', { 'data-testid': 'gecko-inside', 'data-count': health.insideNow === null ? '' : String(health.insideNow) }, `Şu an içeride: ${insideNowText({ value: health.insideNow, reason: health.insideNowReason })}`), h('span', { 'data-testid': 'gecko-unmatched-count', 'data-count': String(health.identifiersUnmatched) }, `Eşlenmemiş kart: ${health.identifiersUnmatched}`), h('button', { type: 'button', 'data-testid': 'gecko-sync', onClick: () => void syncNow() }, 'Şimdi eşitle'), health.feedState !== 'OK'
            ? h('div', { 'data-testid': 'gecko-feed-warning', style: 'flex-basis:100%;color:#b45309;font-weight:700' }, health.feedState === 'NOT_CONNECTED' ? 'GEÇKO akışı bu sisteme henüz bağlanmadı — aşağıdaki liste boşsa bu "kimse yok" demek DEĞİLDİR.'
                : health.feedState === 'FAILING' ? `Son eşitleme hata verdi: ${health.lastRunError ?? '—'} — liste eski olabilir.`
                    : 'Akış gecikmiş — liste güncel değil; "içeride" sayısı yanıltıcı olabilir.')
            : null)
        : null;
    let grants = null;
    try {
        grants = loadError ? null : await api.grants();
    }
    catch {
        grants = null; /* no GECKO_VIEW_GRANT: panel hidden */
    }
    const schedReason = h('input', { type: 'text', 'data-testid': 'gecko-schedule-reason', placeholder: 'Gerekçe' });
    const toggleSchedule = async (enabled) => {
        try {
            await api.setSchedule(enabled, schedReason.value.trim());
            rerender({ banner: { kind: 'ok', text: enabled ? 'Otomatik eşitleme anahtarı açıldı.' : 'Otomatik eşitleme anahtarı kapatıldı.' } });
        }
        catch (err) {
            fail(err);
        }
    };
    const schedulePanel = health
        ? h('div', { 'data-testid': 'gecko-schedule', 'data-enabled': String(health.schedule.enabled), 'data-installed': String(health.schedule.installed),
            style: 'margin:10px 0;padding:10px;border:1px dashed #cbd5e1;border-radius:10px;font-size:13px' }, h('b', {}, `Otomatik eşitleme (${health.schedule.intervalMinutes} dk): ${health.schedule.enabled ? 'AÇIK' : 'KAPALI'}`), h('div', { 'data-testid': 'gecko-schedule-install' }, health.schedule.installed
            ? `Zamanlayıcı kurulu · son tetik ${stamp(health.schedule.lastTickAt)} (${health.schedule.lastTickOutcome ?? '—'})`
            : 'Zamanlayıcı KURULU DEĞİL — paylaşılan veritabanı zamanlayıcısına iş eklemek owner onayı bekliyor (D-009). Şimdilik "Şimdi eşitle" ile elle.'), health.consecutiveFailures > 0 ? h('div', { 'data-testid': 'gecko-failures', style: 'color:#b91c1c' }, `Art arda başarısız eşitleme: ${health.consecutiveFailures}`) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, schedReason, h('button', { type: 'button', 'data-testid': 'gecko-schedule-toggle', onClick: () => void toggleSchedule(!health.schedule.enabled) }, health.schedule.enabled ? 'Kapat' : 'Aç')))
        : null;
    const grantUser = h('input', { type: 'text', 'data-testid': 'gecko-grant-user', placeholder: 'Kullanıcı kimliği (giriş hesabı)' });
    const grantReason = h('input', { type: 'text', 'data-testid': 'gecko-grant-reason', placeholder: 'Gerekçe (ör. İK puantaj kontrolü)' });
    const grantsPanel = grants
        ? h('div', { 'data-testid': 'gecko-grants', style: 'margin:10px 0;font-size:13px' }, h('h2', { style: 'font-size:16px' }, 'Giriş-çıkışı görebilecek kişiler (İK / idari)'), h('div', { style: 'color:#64748b' }, 'Yönetim rolü dışında yalnız burada adıyla yetki verilenler görür. Herkes yalnız kendi kayıtlarını görür.'), ...grants.map((g) => h('div', { 'data-testid': 'gecko-grant', 'data-user': g.userId, style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px solid #f1f5f9;padding:4px 0' }, h('span', { style: 'overflow-wrap:anywhere' }, `${g.userId} — ${g.reason}`), h('button', { type: 'button', 'data-testid': 'gecko-grant-revoke', onClick: async () => {
                try {
                    await api.revokeView(g.userId, grantReason.value.trim() || 'yetki kaldırıldı');
                    rerender({ banner: { kind: 'ok', text: 'Yetki kaldırıldı.' } });
                }
                catch (err) {
                    fail(err);
                }
            } }, 'Kaldır'))), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, grantUser, grantReason, h('button', { type: 'button', 'data-testid': 'gecko-grant-add', onClick: async () => {
                try {
                    await api.grantView(grantUser.value.trim(), grantReason.value.trim());
                    rerender({ banner: { kind: 'ok', text: 'Görme yetkisi verildi.' } });
                }
                catch (err) {
                    fail(err);
                }
            } }, 'Yetki ver')))
        : null;
    const table = h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'gecko-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Personel'), h('th', {}, 'Kart'), h('th', {}, 'İlk giriş'), h('th', {}, 'Son çıkış'), h('th', {}, 'Son hareket'), h('th', {}, 'Durum'), h('th', {}, 'Not'))), h('tbody', {}, ...rows.map((r) => h('tr', { 'data-testid': 'gecko-row', 'data-ident': r.identifierNumber, 'data-state': r.state, 'data-mapping': r.mapping }, h('td', { 'data-testid': 'gecko-name' }, r.personName ?? `${r.fullNameRaw ?? '?'} (${MAPPING_TR[r.mapping].toLocaleLowerCase('tr-TR')})`), h('td', {}, r.identifierNumber), h('td', { 'data-testid': 'gecko-first-in' }, hm(r.firstIn)), h('td', { 'data-testid': 'gecko-last-out' }, hm(r.lastOut)), h('td', {}, `${hm(r.lastEventAt)} ${r.lastDirection === 'IN' ? 'İçeri' : r.lastDirection === 'OUT' ? 'Dışarı' : ''}`), h('td', { 'data-testid': 'gecko-state' }, STATE_TR[r.state] + (r.openSession ? ' (açık oturum)' : '')), h('td', { 'data-testid': 'gecko-note' }, [
        r.deniedEvents ? `${r.deniedEvents} reddedilen geçiş` : '',
        r.unknownDirectionEvents ? `${r.unknownDirectionEvents} yönsüz kayıt` : '',
    ].filter(Boolean).join(' · ') || '—'))))));
    const linkRow = (r) => {
        const personSel = h('select', { 'data-testid': 'gecko-link-person' }, h('option', { value: '' }, '— personel seç —'), ...people.filter((p) => p.active).map((p) => h('option', { value: p.id, ...(p.id === r.personnelId ? { selected: 'selected' } : {}) }, p.name)));
        const reasonIn = h('input', { type: 'text', 'data-testid': 'gecko-link-reason', placeholder: 'Gerekçe (ör. kart sahibi yüz yüze doğrulandı)' });
        const submit = async (status) => {
            const personnelId = status === 'VERIFIED' ? personSel.value || null : null;
            const person = people.find((p) => p.id === personnelId) ?? null;
            const pre = canSetGeckoIdentifierLink({ status, personnelId, reason: reasonIn.value, identifierSeen: true, person });
            if (!pre.ok)
                return rerender({ banner: { kind: 'error', text: pre.reason ?? 'REFUSED' } });
            try {
                await api.setLink(r.identifierNumber, personnelId, status, reasonIn.value.trim());
                rerender({ banner: { kind: 'ok', text: `${r.identifierNumber}: ${MAPPING_TR[status]}` } });
            }
            catch (err) {
                fail(err);
            }
        };
        return h('tr', { 'data-testid': 'gecko-ident', 'data-ident': r.identifierNumber, 'data-mapping': r.mapping }, h('td', {}, r.fullNameRaw ?? '?'), h('td', {}, r.identifierNumber), h('td', { 'data-testid': 'gecko-ident-mapping' }, MAPPING_TR[r.mapping] + (r.personName ? ` → ${r.personName}` : '')), h('td', {}, `${r.events} hareket · son ${stamp(r.lastSeen)}`), h('td', {}, personSel, reasonIn, h('button', { type: 'button', 'data-testid': 'gecko-link-verify', onClick: () => void submit('VERIFIED') }, 'Doğrula'), h('button', { type: 'button', 'data-testid': 'gecko-link-disable', onClick: () => void submit('DISABLED') }, 'Devre dışı')));
    };
    const screen = h('div', { class: 'gecko-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'gecko-heading' }, 'Giriş-Çıkış (GEÇKO)'), h('p', { style: 'font-size:12px;color:#555' }, 'Turnike hareketleri değiştirilemez kayıttan okunur. Reddedilen geçiş ve yönü belli olmayan kayıt kişiyi içeri/dışarı almaz. Bu ekran puantaj hesabına girmez.'), banner, loadError ? h('div', { 'data-testid': 'gecko-load-error' }, `Yüklenemedi: ${loadError}`) : null, healthBox, schedulePanel, h('div', { style: 'margin:12px 0;display:flex;gap:8px;align-items:center' }, h('label', {}, 'Gün: '), dateIn), loadError ? null : rows.length === 0
        ? h('div', { 'data-testid': 'gecko-empty' }, health && health.feedState !== 'OK' ? 'Bu gün için kayıt yok — akış güncel olmadığı için bu "kimse gelmedi" anlamına gelmez.' : 'Bu gün için turnike hareketi yok.')
        : table, loadError ? null : h('h2', {}, 'Kart eşleştirme'), loadError ? null : people.length === 0
        ? h('div', { 'data-testid': 'gecko-no-people', style: 'color:#b45309' }, 'KMI personel listesi boş — kartlar personele bağlanamaz (önce personel kaydı gerekir).')
        : null, loadError ? null : h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'gecko-ident-table' }, h('tbody', {}, ...idents.map(linkRow)))), grantsPanel);
    mount(container, screen);
}
