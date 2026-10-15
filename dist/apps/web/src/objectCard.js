// KMI-001 final — operational card faces for non-machine objects. Same visual frame as the Machine Identity Card (accent bar, big identity, 3–5 key facts,
// one quick action → passport) but each kind has ITS OWN face: nothing is forced into the machine template. Detail lives in the passport.
// A fact whose value is unknown is shown as BİLİNMİYOR — never as 0 or an invented value.
import { h } from '../../../packages/ui/src/h.js';
import { passportHref } from './passport/registry.js';
const KIND_TR = { WORK_ORDER: 'İŞ EMRİ', PRODUCT: 'ÜRÜN', CUSTOMER: 'MÜŞTERİ', TOOL: 'TAKIM', PERSONNEL: 'PERSONEL', ORDER: 'SİPARİŞ', STOCK_LOT: 'PARTİ' };
const ACCENT = { WORK_ORDER: '#38bdf8', PRODUCT: '#a78bfa', CUSTOMER: '#fbbf24', TOOL: '#f59e0b', PERSONNEL: '#f472b6', ORDER: '#60a5fa', STOCK_LOT: '#a3e635' };
const NUM = new Intl.NumberFormat('tr-TR');
export const factText = (v) => (v === null || v === undefined || v === '' ? 'BİLİNMİYOR' : typeof v === 'number' ? NUM.format(v) : v);
/** The 3–5 facts each kind puts on its face (documentation + test anchor; the caller fills the values from its canonical source). */
export const FACE_FIELDS = {
    WORK_ORDER: ['Ürün', 'Makine', 'Operatör', 'İlerleme', 'Termin'],
    PRODUCT: ['Revizyon', 'Açık iş emri', 'Stok', 'Son sevk'],
    CUSTOMER: ['Açık sipariş', 'Geciken kalem', 'Sıradaki termin'],
    TOOL: ['Durum', 'Konum', 'Kalan ömür', 'Atanmış makine'],
    PERSONNEL: ['Görev', 'Vardiya', 'Bugünkü durum', 'Yetkinlik'],
};
export function objectCard(i) {
    const accent = ACCENT[i.kind] ?? '#94a3b8';
    const facts = i.facts.slice(0, 5);
    const body = [
        h('div', { class: 'oc-top' }, h('div', { class: 'oc-kind' }, KIND_TR[i.kind] ?? i.kind), i.badge ? h('span', { class: `oc-badge ${i.badge.tone}`, 'data-testid': 'oc-badge' }, i.badge.text) : null),
        h('div', { class: 'oc-title', 'data-testid': 'oc-title' }, i.title),
        i.subtitle ? h('div', { class: 'oc-sub' }, i.subtitle) : null,
        h('div', { class: 'oc-facts' }, ...facts.map((f) => h('div', { class: `oc-f ${f.tone ?? ''}${f.value === null || f.value === undefined || f.value === '' ? ' unk' : ''}`, 'data-testid': 'oc-fact' }, h('span', { class: 'oc-fl' }, f.label.toLocaleUpperCase('tr-TR')), h('span', { class: 'oc-fv' }, factText(f.value))))),
        typeof i.progressPct === 'number' ? h('div', { class: 'oc-prog', 'data-testid': 'oc-progress' }, h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(i.progressPct), 'aria-label': 'İlerleme' }, h('i', { style: `width:${i.progressPct}%` })), h('b', {}, `%${i.progressPct}`)) : null,
        i.alert ? h('div', { class: 'oc-alert', 'data-testid': 'oc-alert' }, '! ', i.alert) : null,
        i.id ? h('span', { class: 'oc-go' }, i.actionLabel ?? 'Pasaport →') : null,
    ];
    const attrs = { class: 'oc', 'data-testid': i.testid ?? 'object-card', 'data-kind': i.kind, style: `--oc:${accent}`, 'aria-label': `${KIND_TR[i.kind] ?? i.kind}: ${i.title}` };
    return (i.id ? h('a', { ...attrs, href: passportHref(i.kind, i.id) }, ...body) : h('div', attrs, ...body));
}
export const OBJECT_CARD_CSS = `
.oc{display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:16px;min-width:0;color:var(--kmi-text);text-decoration:none;background:linear-gradient(180deg,var(--kmi-panel2),var(--kmi-panel));border:1px solid var(--kmi-line);box-shadow:0 6px 18px rgba(2,6,23,.28);transition:transform .15s,border-color .15s}
a.oc:hover{border-color:var(--kmi-line2);transform:translateY(-1px)}a.oc:focus-visible{outline:3px solid var(--kmi-focus);outline-offset:2px}
.oc-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.oc-kind{font-size:11px;letter-spacing:.16em;font-weight:800;color:var(--kmi-mut)}
.oc-badge{font-size:12px;font-weight:800;letter-spacing:.06em;padding:3px 10px;border-radius:999px;border:1px solid currentColor}.oc-badge.ok{color:var(--kmi-ok)}.oc-badge.warn{color:var(--kmi-warn)}.oc-badge.bad{color:var(--kmi-bad)}.oc-badge.info{color:var(--kmi-info)}.oc-badge.mut{color:var(--kmi-unknown)}
.oc-title{font-size:24px;line-height:1.1;font-weight:800;color:var(--kmi-text);overflow-wrap:anywhere}.oc-sub{font-size:14px;color:var(--kmi-text2)}
.oc-facts{display:flex;flex-wrap:wrap;gap:8px 22px}.oc-f{display:flex;flex-direction:column;gap:1px;min-width:0}.oc-fl{font-size:11px;letter-spacing:.12em;font-weight:700;color:var(--kmi-mut)}.oc-fv{font-size:15px;font-weight:600;color:var(--kmi-text);overflow-wrap:anywhere}.oc-f.unk .oc-fv{color:var(--kmi-mut);font-weight:500}.oc-f.warn .oc-fv{color:var(--kmi-warn)}.oc-f.bad .oc-fv{color:var(--kmi-bad)}.oc-f.ok .oc-fv{color:var(--kmi-ok)}
.oc-prog{display:flex;align-items:center;gap:10px}.oc-prog .bar{flex:1;height:10px;border-radius:99px;background:rgba(148,163,184,.22);overflow:hidden}.oc-prog .bar i{display:block;height:100%;border-radius:99px;background:var(--kmi-info)}.oc-prog b{font-size:20px;font-variant-numeric:tabular-nums}
.oc-alert{font-size:14px;font-weight:700;color:var(--kmi-bad);background:var(--kmi-bad-soft);border-radius:10px;padding:9px 12px;border:1px solid rgba(248,113,113,.4)}
.oc-go{align-self:flex-start;font-size:13px;font-weight:700;color:var(--kmi-cyan2);padding:4px 0}
`;
