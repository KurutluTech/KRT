// KMI-CARD-COMPLETION-001 — the ONE card face for registered entities (personnel, product, customer; machines keep the Machine Identity Card).
// Pure DOM, no data access: the caller passes already-permissioned facts. Unknown value → BİLİNMİYOR / "girilmemiş", never 0 or an invented value.
// A card is a single link (whole card clickable) to the passport / workspace. Photo: lazy, from the canonical KMI-010 document version (ASSET_PHOTO).
import { h } from '../../../packages/ui/src/h.js';
const KIND_TR = { PERSONNEL: 'PERSONEL', PRODUCT: 'ÜRÜN', CUSTOMER: 'MÜŞTERİ', MACHINE: 'MAKİNE', SUPPLIER: 'TEDARİKÇİ', TOOL: 'TAKIM', ASSET: 'VARLIK' };
const ACCENT = { PERSONNEL: '#f472b6', PRODUCT: '#a78bfa', CUSTOMER: '#fbbf24', MACHINE: '#38bdf8', SUPPLIER: '#34d399', TOOL: '#fb923c', ASSET: '#2dd4bf' };
const NUM = new Intl.NumberFormat('tr-TR');
export const textOf = (v) => (v === null || v === undefined || v === '' ? 'BİLİNMİYOR' : typeof v === 'number' ? NUM.format(v) : v);
export function initialsOf(name) { const w = name.trim().split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toLocaleUpperCase('tr-TR'); }
export const dateTr = (iso) => { if (typeof iso !== 'string')
    return null; const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : null; };
/** Photo/avatar slot. Starts as initials (or an icon); `fill(src)` swaps in the real image. */
export function photoSlot(initials, shape, testid = 'ec-photo') {
    const el = h('div', { class: `ec-ph ${shape}`, 'data-testid': testid, 'data-has-photo': 'false', 'aria-hidden': 'true' }, initials);
    return { el, fill(src, alt) { el.replaceChildren(h('img', { src, alt, loading: 'lazy', 'data-testid': 'ec-photo-img' })); el.setAttribute('data-has-photo', 'true'); el.removeAttribute('aria-hidden'); } };
}
export function entityCard(i, slot) {
    const facts = i.facts.slice(0, 6);
    return h('a', { class: 'ec', href: i.href, 'data-testid': i.testid ?? 'entity-card', 'data-kind': i.kind, 'data-id': i.id, 'data-state': i.badge?.text ?? '', style: `--ec:${ACCENT[i.kind]}`,
        'aria-label': `${KIND_TR[i.kind]}: ${i.title}${i.badge ? ` — ${i.badge.text}` : ''} — pasaportu aç` }, h('div', { class: 'ec-head' }, slot.el, h('div', { class: 'ec-id' }, h('div', { class: 'ec-kind' }, KIND_TR[i.kind], i.code ? h('span', { class: 'ec-code', 'data-testid': 'ec-code' }, ` · ${i.code}`) : null), h('div', { class: 'ec-title', 'data-testid': 'ec-title' }, i.title), h('div', { class: `ec-sub${i.subtitle ? '' : ' unk'}`, 'data-testid': 'ec-sub' }, i.subtitle ?? i.subtitleUnknown ?? 'Girilmemiş'))), i.badge ? h('span', { class: `ec-badge ${i.badge.tone}`, 'data-testid': 'ec-badge' }, i.badge.text) : null, h('div', { class: 'ec-facts' }, ...facts.map((f) => h('div', { class: `ec-f ${f.tone ?? ''}${f.value === null || f.value === undefined || f.value === '' ? ' unk' : ''}`, 'data-testid': 'ec-fact' }, h('span', { class: 'ec-fl' }, f.label), h('span', { class: 'ec-fv' }, textOf(f.value))))), i.chips && i.chips.length ? h('div', { class: 'ec-chips', 'data-testid': 'ec-chips' }, ...i.chips.map((c) => h('span', { class: 'ec-chip' }, c))) : null, i.alert ? h('div', { class: 'ec-alert', 'data-testid': 'ec-alert' }, '! ', i.alert) : null, h('div', { class: 'ec-foot' }, h('span', { class: 'ec-up' }, i.updated ? `Güncelleme ${i.updated}` : ''), h('span', { class: 'ec-go' }, i.action ?? 'Pasaportu aç →')));
}
export const ENTITY_CARD_CSS = `
.eg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;align-items:stretch}
@media (max-width:520px){.eg-grid{grid-template-columns:1fr;gap:12px}}
.ec{position:relative;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:16px;min-width:0;color:var(--kmi-text,#e2e8f0);text-decoration:none;background:linear-gradient(180deg,var(--kmi-panel2,#14213a),var(--kmi-panel,#0f1a30));
  border:1px solid var(--kmi-line,#1e2d4a);border-top:3px solid var(--ec);box-shadow:0 6px 18px rgba(2,6,23,.28);transition:transform .15s,border-color .15s}
a.ec:hover{border-color:var(--ec);transform:translateY(-1px)}a.ec:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.ec-head{display:flex;gap:14px;align-items:center;min-width:0}
.ec-ph{flex:0 0 auto;width:72px;height:72px;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:24px;font-weight:800;letter-spacing:.02em;color:var(--ec);background:rgba(148,163,184,.12);border:1px solid var(--kmi-line,#1e2d4a)}
.ec-ph.round{border-radius:50%}.ec-ph.square{border-radius:14px}.ec-ph img{width:100%;height:100%;object-fit:cover;display:block}
.ec-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.ec-kind{font-size:11px;letter-spacing:.14em;font-weight:800;color:var(--kmi-mut,#94a3b8)}.ec-code{letter-spacing:.04em}
.ec-title{font-size:19px;line-height:1.15;font-weight:800;color:var(--kmi-text,#fff);overflow-wrap:anywhere}.ec-sub{font-size:14px;font-weight:600;color:var(--kmi-text2,#cbd5e1);overflow-wrap:anywhere}.ec-sub.unk{color:var(--kmi-mut,#64748b);font-weight:500;font-style:italic}
.ec-badge{align-self:flex-start;font-size:12px;font-weight:800;letter-spacing:.05em;padding:3px 10px;border-radius:999px;border:1px solid currentColor}
.ec-badge.ok{color:var(--kmi-ok,#4ade80)}.ec-badge.warn{color:var(--kmi-warn,#fbbf24)}.ec-badge.bad{color:var(--kmi-bad,#f87171)}.ec-badge.info{color:var(--kmi-info,#38bdf8)}.ec-badge.mut{color:var(--kmi-mut,#94a3b8)}
.ec-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}.ec-f{display:flex;flex-direction:column;gap:1px;min-width:0}.ec-fl{font-size:11px;letter-spacing:.1em;font-weight:700;color:var(--kmi-mut,#94a3b8)}
.ec-fv{font-size:14px;font-weight:600;color:var(--kmi-text,#fff);overflow-wrap:anywhere}.ec-f.unk .ec-fv{color:var(--kmi-mut,#64748b);font-weight:500}.ec-f.warn .ec-fv{color:var(--kmi-warn,#fbbf24)}.ec-f.bad .ec-fv{color:var(--kmi-bad,#f87171)}
.ec-chips{display:flex;flex-wrap:wrap;gap:6px}.ec-chip{font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(148,163,184,.14);color:var(--kmi-text2,#cbd5e1)}
.ec-alert{font-size:13px;font-weight:700;color:var(--kmi-bad,#f87171);background:var(--kmi-bad-soft,rgba(248,113,113,.12));border-radius:10px;padding:8px 11px;border:1px solid rgba(248,113,113,.4)}
.ec-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:4px}.ec-up{font-size:12px;color:var(--kmi-mut,#64748b)}.ec-go{font-size:13px;font-weight:700;color:var(--kmi-cyan2,#67e8f9)}
.eg-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:12px 0 16px}.eg-bar input[type=search]{flex:1 1 220px;min-width:0;max-width:360px;padding:9px 12px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:rgba(2,6,23,.4);color:inherit;font-size:15px}
.eg-chip{font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;border:1px solid var(--kmi-line,#1e2d4a);background:transparent;color:var(--kmi-text2,#cbd5e1);cursor:pointer;min-height:36px}.eg-chip[aria-pressed=true]{background:rgba(56,189,248,.16);border-color:var(--kmi-info,#38bdf8);color:#fff}
.eg-note{font-size:13px;color:var(--kmi-mut,#94a3b8);margin:6px 0 14px}.eg-empty{padding:28px;text-align:center;color:var(--kmi-mut,#94a3b8);border:1px dashed var(--kmi-line,#1e2d4a);border-radius:14px}
`;
