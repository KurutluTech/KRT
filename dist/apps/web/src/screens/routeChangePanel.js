// Rota değişiklik geçmişi (eski → yeni) ve açık iş emirlerine etki raporu — m0181 (routing_change_history / routing_change_impact). Yalnız OKUR.
import { h } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
export const DECISION_TR = {
    IN_SYNC: 'iş emriyle aynı',
    SYNC_ELIGIBLE: 'başlamamış — kontrollü eşitlemeyle güncellenebilir',
    FROZEN_STARTED: 'başlamış — DEĞİŞMEZ (dondurulur)',
    ADD_NEW: 'yeni operasyon — iş emrine eklenebilir',
    REMOVED_NOT_APPLIED: 'rotadan çıkmış — iş emrinde dokunulmaz',
    ORDER_CHANGED_NOT_APPLIED: 'sıra/numara farkı — uygulanmaz',
    ADD_BEFORE_FIRST_NOT_APPLIED: 'ilk operasyondan önce — uygulanmaz',
};
export const KEY_TR = { name: 'ad', allowed_machine_ids: 'makine', primary_machine_id: 'birincil makine', cam_program_id: 'CAM', cycle_seconds_target: 'çevrim (sn)', setup_minutes_target: 'hazırlık (dk)',
    first_piece_required: 'ilk parça', qc_required: 'kalite', instructions: 'talimat', required_skill_code: 'yeterlilik', required_skill_level: 'yeterlilik seviyesi', active: 'etkin', op_no: 'sıra no' };
const NOISE = new Set(['id', 'set_at', 'set_by', 'product_revision_id', 'deactivated_at', 'deactivated_by', 'deactivate_reason']);
/** changed_keys -> okunur Türkçe etiket listesi (gürültü alanları gizlenir). */
export { camel };
export const changedLabels = (keys) => (keys ?? []).filter((k) => !NOISE.has(k)).map((k) => KEY_TR[k] ?? k);
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const when = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
const camel = (k) => k.replace(/_([a-z0-9])/g, (_m, c) => c.toUpperCase()); // veri istemcisi jsonb anahtarlarını camelCase'e çevirir; changed_keys değerleri snake kalır
const val = (v) => (v === null || v === undefined ? '—' : Array.isArray(v) ? `${v.length} kayıt` : String(v).slice(0, 60));
export function drawRouteChanges(host, api, { revisionId, status }) {
    const body = h('div', { 'data-testid': 'rc-body' });
    let loaded = false;
    const load = async () => {
        body.replaceChildren(h('div', { class: 'mut' }, 'Yükleniyor…'));
        try {
            const [hist, impact] = await Promise.all([api.changeHistory(revisionId), api.changeImpact(revisionId)]);
            const rows = (hist ?? []).filter((r) => changedLabels(r.changedKeys).length || r.versionNo > 1);
            const histT = rows.length ? h('div', { class: 'tw' }, h('table', { 'data-testid': 'rc-hist' }, h('thead', {}, h('tr', {}, ...['OP', 'Sürüm', 'Ne değişti (eski → yeni)', 'Kim / ne zaman', 'Yürürlük', 'Revizyon', 'Gerekçe'].map((c) => h('th', {}, c)))),
                h('tbody', {}, ...rows.map((r) => {
                    const labels = changedLabels(r.changedKeys);
                    const diff = labels.length ? (r.changedKeys ?? []).filter((k) => !NOISE.has(k)).map((k) => `${KEY_TR[k] ?? k}: ${val(r.beforeState?.[camel(k)])} → ${val(r.afterState?.[camel(k)])}`).join('; ') : (r.versionNo === 1 ? 'ilk kayıt' : '—');
                    return h('tr', { 'data-testid': 'rc-hist-row' }, h('td', {}, `OP${r.opNo}`), h('td', {}, `v${r.versionNo}`), h('td', {}, diff), h('td', {}, `${String(r.changedBy ?? '—').slice(0, 8)} · ${when(r.changedAt)}`), h('td', {}, when(r.effectiveFrom)), h('td', {}, r.revStatus ?? '—'), h('td', {}, r.reason ?? '—'));
                })))) : h('div', { class: 'mut', 'data-testid': 'rc-hist-empty' }, 'Bu revizyonda kayıtlı rota değişikliği yok.');
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
    const det = h('details', { 'data-testid': 'rc-panel', style: 'margin-top:12px' }, h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Rota değişiklik geçmişi ve açık iş emrine etki'),
        status === 'RELEASED' ? h('div', { class: 'banner', 'data-testid': 'rc-released-note', style: 'margin:8px 0' }, 'Bu revizyon yayında (RELEASED). Üretim rotası burada gerekçeyle değiştirilebilir; her değişiklik eski/yeni değer, kullanıcı ve yürürlük zamanıyla kaydedilir, geçmiş üretim kayıtları değişmez. Ürünün teknik tanımı (BOM) için revizyon mekanizması geçerlidir.') : null, body);
    det.addEventListener('toggle', () => { if (det.open && !loaded) { loaded = true; void load(); } });
    return det;
}
