// KMI-HOME-001 — role cockpit on HOME. (KMI-001 final revision: this module now renders the detailed KPI CATALOG only — the show screen, freshness badge and priority alerts live in homeShow.ts.) Composition comes from the pure `homeLayout` module; every number comes from the canonical
// command_center snapshot (or the commercial_approvals queue for accounting). Nothing is computed here, nothing is invented: a missing value
// is BİLİNMİYOR, a stale snapshot says BAYAT, every card names its source and links to the screen that owns the record.
import { h } from '../../../packages/ui/src/index.js';
import { homeCardsFor, cardValue, cardTone } from '../../../packages/domain/src/homeLayout.js';
const TONE_TR = { ok: 'TAMAM', warn: 'DİKKAT', bad: 'KRİTİK', info: 'BİLGİ', unknown: 'BİLİNMİYOR' };
const GLYPH = { ok: '✓', warn: '!', bad: '✕', info: 'i', unknown: '?' };
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
    const flowBlock = flow.length ? h('section', { class: 'cp-block', 'data-testid': 'cockpit-cards' }, h('div', { class: 'cp-title' }, 'AKIŞ'), h('div', { class: 'cp-rows' }, ...flow.map(row))) : h('div', { 'data-testid': 'cockpit-cards', hidden: true });
    const waitBlock = waiting.length ? h('details', { class: 'cp-block cp-wait', 'data-testid': 'cockpit-unknown' }, h('summary', {}, `${waiting.length} gösterge için veri yok`), h('p', { class: 'kmi-mut' }, '"Veri yok", "sorun yok" demek değildir. Kaynak bağlandığında bu göstergeler otomatik dolar.'), h('div', { class: 'cp-rows' }, ...waiting.map(row))) : null;
    const attentionBlock = attention.length ? h('section', { class: 'cp-block cp-priority', 'data-testid': 'cockpit-attention' }, h('div', { class: 'cp-title' }, 'DİKKAT GEREKTİREN GÖSTERGELER'), h('div', { class: 'cp-rows' }, ...attention.map(row))) : null;
    host.append(...(input.failed ? [h('div', { class: 'kmi-banner warn', 'data-testid': 'cockpit-failed' }, 'Komuta merkezi verisi alınamadı. Aşağıdaki değerler "veri alınamadı" olarak gösterilir; "0" anlamına gelmez.')] : []), ...(attentionBlock ? [attentionBlock] : []), flowBlock, ...(waitBlock ? [waitBlock] : []));
    host.hidden = false;
}
