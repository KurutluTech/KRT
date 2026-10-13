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
export function renderCockpit(host, input) {
    const { snapshot, extras, access, nowMs } = input;
    const cards = homeCardsFor(access);
    host.replaceChildren();
    if (cards.length === 0) {
        host.hidden = true;
        return;
    } // e.g. operator: own work screen, no cockpit
    const fr = freshness(snapshot?.generatedAt, nowMs);
    const head = h('div', { class: 'cp-head' }, h('div', { class: 'kmi-section' }, 'KOKPİT'), h('span', { class: `cp-fresh ${fr.state.toLowerCase()}`, 'data-testid': 'cockpit-fresh', 'data-state': fr.state }, fr.state === 'FRESH' ? `GÜNCEL · ${fr.ageMin} dk önce` : fr.state === 'STALE' ? `BAYAT · ${fr.ageMin} dk önce` : 'VERİ ANI BİLİNMİYOR'), h('span', { class: 'kmi-mut' }, snapshot ? `Kaynak: komuta merkezi · ${formatStamp(snapshot.generatedAt)}` : 'Kaynak: komuta merkezi · ulaşılamadı'));
    const grid = h('div', { class: 'cp-grid', 'data-testid': 'cockpit-cards' }, ...cards.map((c) => {
        const raw = c.source.kind === 'counter' ? snapshot?.counters?.[c.source.key] : c.source.kind === 'extra' ? extras[c.source.key] : undefined;
        const noSource = c.source.kind === 'none';
        const v = cardValue(raw);
        const tone = cardTone(c.rule, v);
        return h('a', { href: c.href, class: `cp-card ${tone}`, 'data-testid': 'cockpit-card', 'data-key': c.key, 'data-tone': tone, 'data-known': String(v.state === 'KNOWN'),
            'aria-label': `${c.label}: ${v.state === 'KNOWN' ? `${v.value} ${c.unit}` : 'bilinmiyor'} — ${TONE_TR[tone]}` }, h('span', { class: 'cp-n' }, v.state === 'KNOWN' ? String(v.value) : noSource ? 'VERİ GEREKLİ' : 'BİLİNMİYOR'), h('span', { class: 'cp-l' }, c.label), h('span', { class: 'cp-s' }, h('i', { 'aria-hidden': 'true' }, GLYPH[tone]), ` ${noSource ? 'DATA REQUIRED' : TONE_TR[tone]}${c.unit ? ` · ${c.unit}` : ''}`), h('span', { class: 'cp-o' }, c.source.kind === 'none' ? `Kaynak yok: ${c.source.reason}` : c.source.origin));
    }));
    const doms = homeDomainsFor(access);
    const inScope = (d) => doms === 'ALL' || doms.includes(d);
    const alerts = (snapshot?.alerts ?? []).filter((a) => inScope(a.domain)).sort((a, b) => (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1)).slice(0, 6);
    const signals = h('div', { class: 'cp-signals', 'data-testid': 'cockpit-signals' }, h('div', { class: 'kmi-section' }, 'KRİTİK SİNYALLER'), alerts.length === 0
        ? h('div', { class: 'kmi-mut', 'data-testid': 'cockpit-signals-empty' }, snapshot ? 'Bu rol için açık uyarı yok (komuta merkezi kayıtlarına göre).' : 'Uyarılar alınamadı — "uyarı yok" anlamına gelmez.')
        : h('div', {}, ...alerts.map((a) => h('div', { class: `cp-sig ${a.severity === 'CRITICAL' ? 'bad' : 'warn'}`, 'data-testid': 'cockpit-signal' }, h('b', {}, a.severity === 'CRITICAL' ? '✕ KRİTİK' : '! UYARI'), h('span', {}, ` ${a.title}`), a.detail ? h('span', { class: 'kmi-mut' }, ` — ${a.detail}`) : null, PASSPORT_ENTITY[a.entityType] && a.entityId ? h('a', { href: passportHref(PASSPORT_ENTITY[a.entityType], a.entityId), 'data-testid': 'cockpit-signal-passport' }, ' Pasaport →') : null))));
    host.append(head, ...(input.failed ? [h('div', { class: 'kmi-banner warn', 'data-testid': 'cockpit-failed' }, 'Komuta merkezi verisi alınamadı. Aşağıdaki değerler BİLİNMİYOR olarak gösterilir; "0" anlamına gelmez.')] : []), grid, signals);
    host.hidden = false;
}
