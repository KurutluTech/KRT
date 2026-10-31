// Rota değişiklik geçmişi (eski → yeni) ve açık iş emirlerine etki raporu — m0181 (routing_change_history / routing_change_impact). Yalnız OKUR.
import { h } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { KEY_TR, camel, changedLabels, diffRows, rawIds } from '../../../../packages/domain/src/routeChangeFormat.js';
export { KEY_TR, camel, changedLabels };
export const DECISION_TR = {
    IN_SYNC: 'iş emriyle aynı',
    SYNC_ELIGIBLE: 'başlamamış — kontrollü eşitlemeyle güncellenebilir',
    FROZEN_STARTED: 'başlamış — DEĞİŞMEZ (dondurulur)',
    ADD_NEW: 'yeni operasyon — iş emrine eklenebilir',
    REMOVED_NOT_APPLIED: 'rotadan çıkmış — iş emrinde dokunulmaz',
    ORDER_CHANGED_NOT_APPLIED: 'sıra/numara farkı — uygulanmaz',
    ADD_BEFORE_FIRST_NOT_APPLIED: 'ilk operasyondan önce — uygulanmaz',
};
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const when = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
const REV_TR = { RELEASED: 'yayında', DRAFT: 'taslak' };
const CSS = '.rcc{border:1px solid var(--line,#334155);border-radius:10px;padding:10px 12px;margin:8px 0}.rcc .hd{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}.rcc .ch{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:2px 12px;margin:6px 0}.rcc .ch .l{color:var(--mut,#94a3b8)}.rcc .ch .v{overflow-wrap:anywhere}@media (max-width:640px){.rcc .ch{grid-template-columns:1fr}.rcc .ch .l{margin-top:4px}}';
/** Makine adı ve CAM program adı/sürümü çözümleme bağlamı; okunamazsa ham kimlik yerine açık "okunamadı" metni gösterilir. */
async function loadCtx(api, revisionId) {
    const ctx = { machines: new Map(), cams: new Map(), ops: new Map() };
    const [ms, cs] = await Promise.all([api.machines ? api.machines().catch(() => []) : [], api.camPrograms ? api.camPrograms(revisionId).catch(() => []) : []]);
    for (const m of ms ?? []) ctx.machines.set(m.id, m);
    for (const c of cs ?? []) ctx.cams.set(c.id, c);
    return ctx;
}
export function drawRouteChanges(host, api, { revisionId, status }) {
    const body = h('div', { 'data-testid': 'rc-body' });
    let loaded = false;
    const load = async () => {
        body.replaceChildren(h('div', { class: 'mut' }, 'Yükleniyor…'));
        try {
            const [hist, impact, ctx] = await Promise.all([api.changeHistory(revisionId), api.changeImpact(revisionId), loadCtx(api, revisionId)]);
            const rows = (hist ?? []).filter((r) => changedLabels(r.changedKeys).length || r.versionNo > 1);
            const histT = rows.length ? h('div', { 'data-testid': 'rc-hist' }, ...rows.map((r) => {
                const dr = diffRows(r, ctx);
                const ids = rawIds(r);
                return h('div', { class: 'rcc', 'data-testid': 'rc-hist-row' },
                    h('div', { class: 'hd' }, h('b', {}, `OP${r.opNo}`), h('span', {}, `sürüm ${r.versionNo}`), h('span', { class: 'mut' }, `${when(r.changedAt)}`), r.effectiveFrom ? h('span', { class: 'mut' }, `yürürlük ${when(r.effectiveFrom)}`) : null, r.revStatus ? h('span', { class: 'mut' }, `revizyon ${REV_TR[r.revStatus] ?? r.revStatus}`) : null),
                    dr.length ? h('div', { class: 'ch' }, ...dr.flatMap((x) => [h('div', { class: 'l' }, x.label), h('div', { class: 'v' }, `${x.from} → ${x.to}`)])) : h('div', { class: 'mut' }, r.versionNo === 1 ? 'İlk kayıt' : 'Alan değişikliği yok'),
                    r.reason ? h('div', {}, h('span', { class: 'mut' }, 'Gerekçe: '), r.reason) : null,
                    h('details', { class: 'mut', style: 'margin-top:4px' }, h('summary', {}, 'Ayrıntı (kayıt kimlikleri)'), h('div', { style: 'overflow-wrap:anywhere' }, `Değiştiren kullanıcı: ${r.changedBy ?? '—'}`), ...ids.map((x) => h('div', { style: 'overflow-wrap:anywhere' }, x))));
            })) : h('div', { class: 'mut', 'data-testid': 'rc-hist-empty' }, 'Bu revizyonda kayıtlı rota değişikliği yok.');
            const wos = impact?.workOrders ?? [];
            const impT = wos.length ? wos.map((w) => h('div', { 'data-testid': 'rc-wo', 'data-wo': w.workOrderId, style: 'border:1px solid var(--line,#334155);border-radius:8px;padding:8px;margin:6px 0' },
                h('div', { style: 'font-weight:700' }, `İş emri ${String(w.workOrderId).slice(0, 8)} · ${w.status}${w.onHold ? ' · HOLD (kaldırılmaz)' : ''} · rota ${w.state === 'APPLIED' ? 'iş emrine uygulanmış' : 'iş emrine henüz uygulanmamış'}`),
                h('table', {}, h('tbody', {}, ...(w.operations ?? []).filter((o) => o.decision !== 'IN_SYNC').map((o) => h('tr', { 'data-decision': o.decision }, h('td', {}, `OP${o.opNo}`), h('td', {}, DECISION_TR[o.decision] ?? o.decision), h('td', {}, changedLabels(o.changed ? o.changed.map((x) => x) : []).join(', ') || ''), h('td', {}, o.processChanged ? 'proses değişti' : '')))),
                    (w.operations ?? []).every((o) => o.decision === 'IN_SYNC') ? h('tbody', {}, h('tr', {}, h('td', {}, 'Rota iş emriyle aynı — etkilenen operasyon yok.'))) : null)))
                : h('div', { class: 'mut', 'data-testid': 'rc-imp-empty' }, 'Bu revizyonda açık iş emri yok.');
            body.replaceChildren(h('div', { style: 'font-weight:700;margin:6px 0' }, 'Değişiklik geçmişi'), histT, h('div', { style: 'font-weight:700;margin:12px 0 6px' }, 'Açık iş emirlerine etki'), ...(Array.isArray(impT) ? impT : [impT]),
                h('div', { class: 'mut', style: 'margin-top:8px' }, 'Rapor yalnız okur: iş emirleri, HOLD ve başlamış operasyonlar bu ekrandan değişmez. Başlamamış operasyonların iş emrine yansıtılması ayrı, gerekçeli ve yetkili bir işlemdir.'));
        }
        catch (e) { body.replaceChildren(h('div', { class: 'banner bad', 'data-testid': 'rc-err' }, errorText(e))); }
    };
    const det = h('details', { 'data-testid': 'rc-panel', style: 'margin-top:12px' }, h('style', {}, CSS), h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Rota değişiklik geçmişi ve açık iş emrine etki'),
        status === 'RELEASED' ? h('div', { class: 'banner', 'data-testid': 'rc-released-note', style: 'margin:8px 0' }, 'Bu revizyon yayında (RELEASED). Üretim rotası burada gerekçeyle değiştirilebilir; her değişiklik eski/yeni değer, kullanıcı ve yürürlük zamanıyla kaydedilir, geçmiş üretim kayıtları değişmez. Ürünün teknik tanımı (BOM) için revizyon mekanizması geçerlidir.') : null, body);
    if (/[?&]gecmis=1/.test(globalThis.location?.hash ?? '')) { det.open = true; loaded = true; void load(); setTimeout(() => det.scrollIntoView?.({ block: 'start' }), 300); }
    det.addEventListener('toggle', () => { if (det.open && !loaded) { loaded = true; void load(); } });
    return det;
}
