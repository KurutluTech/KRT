// KMI-HOME-001 — role cockpit on HOME. Composition comes from the pure `homeLayout` module; every number comes from the canonical
// command_center snapshot (or the commercial_approvals queue for accounting). Nothing is computed here, nothing is invented: a missing value
// is BİLİNMİYOR, a stale snapshot says BAYAT, every card names its source and links to the screen that owns the record.
import { h } from '../../../packages/ui/src/index.js';
import { homeCardsFor, homeDomainsFor, cardValue, cardTone, freshness } from '../../../packages/domain/src/homeLayout.js';
import { passportHref } from './passport/registry.js';
import { formatStamp } from '../../../packages/domain/src/temporal.js';
const TONE_TR = { ok: 'TAMAM', warn: 'DİKKAT', bad: 'KRİTİK', info: 'BİLGİ', unknown: 'BİLİNMİYOR' };
const GLYPH = { ok: '✓', warn: '!', bad: '✕', info: 'i', unknown: '?' };
const PASSPORT_ENTITY = { MACHINE: 'MACHINE', WORK_ORDER: 'WORK_ORDER', STOCK_LOT: 'STOCK_LOT' };
/** Plain-language reason shown instead of a technical source name (the raw origin stays in the data-source attribute for support, never on screen). */
const UNKNOWN_WHY = 'veri alınamadı';
export function renderCockpit(host, input) {
    const { snapshot, extras, access, nowMs } = input;
    const cards = homeCardsFor(access);
    host.replaceChildren();
    if (cards.length === 0) {
        host.hidden = true;
        return;
    } // e.g. operator: own work screen, no cockpit
    const fr = freshness(snapshot?.generatedAt, nowMs);
    const rows = cards.map((c) => {
        const raw = c.source.kind === 'counter' ? snapshot?.counters?.[c.source.key] : c.source.kind === 'extra' ? extras[c.source.key] : undefined;
        const noSource = c.source.kind === 'none';
        const v = cardValue(raw);
        const tone = cardTone(c.rule, v);
        return { c, v, tone, noSource };
    });
    const row = (r) => {
        const { c, v, tone, noSource } = r;
        return h('a', { href: c.href, class: `cp-row ${tone}`, 'data-testid': 'cockpit-card', 'data-key': c.key, 'data-tone': tone, 'data-known': String(v.state === 'KNOWN'),
            'data-source': c.source.kind === 'none' ? `none:${c.source.reason}` : c.source.origin,
            'aria-label': `${c.label}: ${v.state === 'KNOWN' ? `${v.value} ${c.unit}` : 'bilinmiyor'} — ${TONE_TR[tone]}` }, h('i', { class: 'dot', 'aria-hidden': 'true' }, GLYPH[tone]), h('span', { class: 'rl' }, c.label), h('span', { class: 'rv' }, v.state === 'KNOWN' ? h('b', { class: 'cp-n' }, String(v.value)) : h('em', { class: 'cp-n' }, noSource ? 'VERİ GEREKLİ' : 'BİLİNMİYOR'), v.state === 'KNOWN' && c.unit ? h('small', {}, ` ${c.unit}`) : null));
    };
    const attention = rows.filter((r) => r.v.state === 'KNOWN' && (r.tone === 'bad' || r.tone === 'warn')).sort((a, b) => (a.tone === 'bad' ? 0 : 1) - (b.tone === 'bad' ? 0 : 1));
    const flow = rows.filter((r) => r.v.state === 'KNOWN' && (r.tone === 'ok' || r.tone === 'info'));
    const waiting = rows.filter((r) => r.v.state !== 'KNOWN');
    const doms = homeDomainsFor(access);
    const inScope = (d) => doms === 'ALL' || doms.includes(d);
    const alerts = (snapshot?.alerts ?? []).filter((a) => inScope(a.domain)).sort((a, b) => (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1)).slice(0, 6);
    const head = h('div', { class: 'cp-head' }, h('div', { class: 'kmi-section' }, 'ŞİMDİ'), h('span', { class: `cp-fresh ${fr.state.toLowerCase()}`, 'data-testid': 'cockpit-fresh', 'data-state': fr.state }, fr.state === 'FRESH' ? `GÜNCEL · ${fr.ageMin} dk önce` : fr.state === 'STALE' ? `BAYAT · ${fr.ageMin} dk önce` : 'VERİ ANI BİLİNMİYOR'), h('span', { class: 'kmi-mut' }, snapshot ? formatStamp(snapshot.generatedAt) : 'komuta merkezine ulaşılamadı'));
    const signalRows = alerts.map((a) => h('div', { class: `cp-sig ${a.severity === 'CRITICAL' ? 'bad' : 'warn'}`, 'data-testid': 'cockpit-signal' }, h('b', {}, a.severity === 'CRITICAL' ? '✕ KRİTİK' : '! UYARI'), h('span', {}, ` ${a.title}`), a.detail ? h('span', { class: 'kmi-mut' }, ` — ${a.detail}`) : null, PASSPORT_ENTITY[a.entityType] && a.entityId ? h('a', { href: passportHref(PASSPORT_ENTITY[a.entityType], a.entityId), 'data-testid': 'cockpit-signal-passport' }, ' Pasaport →') : null));
    const priority = h('section', { class: 'cp-block cp-priority', 'data-testid': 'cockpit-signals' }, h('div', { class: 'cp-title' }, 'ÖNCE BUNLARA BAKIN'), signalRows.length || attention.length
        ? h('div', {}, ...signalRows, h('div', { class: 'cp-rows' }, ...attention.map(row)))
        : h('div', { class: 'kmi-mut', 'data-testid': 'cockpit-signals-empty' }, snapshot ? 'Bu rol için açık uyarı veya bekleyen sorun yok (komuta merkezi kayıtlarına göre).' : 'Uyarılar alınamadı — "uyarı yok" anlamına gelmez.'));
    const flowBlock = flow.length ? h('section', { class: 'cp-block', 'data-testid': 'cockpit-cards' }, h('div', { class: 'cp-title' }, 'AKIŞ'), h('div', { class: 'cp-rows' }, ...flow.map(row))) : h('div', { 'data-testid': 'cockpit-cards', hidden: true });
    const waitBlock = waiting.length ? h('details', { class: 'cp-block cp-wait', 'data-testid': 'cockpit-unknown' }, h('summary', {}, `${waiting.length} gösterge için veri yok`), h('p', { class: 'kmi-mut' }, '"Veri yok", "sorun yok" demek değildir. Kaynak bağlandığında bu göstergeler otomatik dolar.'), h('div', { class: 'cp-rows' }, ...waiting.map(row))) : null;
    host.append(head, ...(input.failed ? [h('div', { class: 'kmi-banner warn', 'data-testid': 'cockpit-failed' }, 'Komuta merkezi verisi alınamadı. Aşağıdaki değerler "veri alınamadı" olarak gösterilir; "0" anlamına gelmez.')] : []), priority, flowBlock, ...(waitBlock ? [waitBlock] : []));
    host.hidden = false;
}
