// KMI-002 (002.10) — decisions made IN PLACE on Home. No new decision logic and no new writer: this reads the canonical approvals inbox and calls
// the same ApprovalsInboxApi.decide() the Onaylar screen uses (server re-checks permission, state, double decision and writes the audit row).
// Buttons appear only when the existing rule (actionState) says the user holds the critical action; a reason is mandatory. Loaded on demand (one extra read set, only when opened).
import { h } from '../../../packages/ui/src/index.js';
import { KIND_LABEL, REJECT_LABEL, actionState, reasonError, waitLabel } from '../../../packages/domain/src/approvalsInbox.js';
import { errorText } from './errorText.js';
const inFlight = new Set();
export function decisionPanel(d) {
    const held = new Set(d.held);
    const max = d.max ?? 3;
    const root = h('div', { class: 'hd', 'data-testid': 'home-decide' });
    let banner = null;
    const draw = (body) => { root.replaceChildren(...(banner ? [h('div', { class: `hd-b ${banner.kind}`, role: banner.kind === 'error' ? 'alert' : 'status', 'data-testid': 'home-decide-banner' }, banner.text)] : []), ...body); };
    const load = async () => {
        draw([h('div', { class: 'hs-skel', role: 'status', 'data-testid': 'home-decide-loading' }, 'Karar listesi yükleniyor…')]);
        let items;
        try {
            items = (await d.api.load()).items;
        }
        catch (e) {
            draw([h('div', { class: 'hs-unk', 'data-testid': 'home-decide-error' }, `Karar listesi okunamadı: ${errorText(e)}. "Bekleyen yok" anlamına gelmez.`), h('button', { type: 'button', class: 'hs-btn', onClick: () => void load() }, 'Yeniden dene')]);
            return;
        }
        const mine = items.filter((i) => actionState(i, 'APPROVE', held).enabled || actionState(i, 'REJECT', held).enabled);
        if (!mine.length) {
            draw([h('div', { class: 'mut hd-n', 'data-testid': 'home-decide-none' }, items.length ? `${items.length} bekleyen onay var; bunlar için sizin kararınız gerekmiyor veya yetkiniz yok.` : 'Bekleyen onay yok.')]);
            return;
        }
        const row = (item) => {
            const reason = h('input', { type: 'text', class: 'hd-in', placeholder: 'Gerekçe (en az 5 karakter)', 'aria-label': `Gerekçe — ${item.record}`, 'data-testid': 'home-decide-reason' });
            const go = async (dec) => {
                const bad = reasonError(reason.value);
                if (bad) {
                    banner = { kind: 'error', text: bad };
                    void redraw();
                    return;
                }
                if (inFlight.has(item.key))
                    return;
                inFlight.add(item.key);
                root.querySelectorAll('button').forEach((b) => (b.disabled = true));
                try {
                    await d.api.decide(item, dec, reason.value);
                    inFlight.delete(item.key);
                    banner = { kind: 'info', text: `${KIND_LABEL[item.kind]} · ${item.record}: ${dec === 'APPROVE' ? 'onay' : 'ret/iade'} kaydedildi.` };
                    d.onDone();
                    await load();
                }
                catch (e) {
                    inFlight.delete(item.key);
                    banner = { kind: 'error', text: errorText(e) };
                    await load();
                }
            };
            const ap = actionState(item, 'APPROVE', held), rj = actionState(item, 'REJECT', held);
            return h('div', { class: 'hd-row', 'data-testid': 'home-decide-item', 'data-kind': item.kind }, h('div', { class: 'hd-t' }, h('b', {}, KIND_LABEL[item.kind]), h('span', { class: 'mut' }, ` · ${item.record}`)), h('div', { class: 'hd-m mut' }, `Talep eden: ${item.owner ?? 'BİLİNMİYOR'} · bekleme ${waitLabel(item.waitingHours)}`), reason, h('div', { class: 'hd-a' }, ap.enabled ? h('button', { type: 'button', class: 'hs-btn hd-ok', 'data-testid': 'home-decide-approve', onClick: () => void go('APPROVE') }, 'Onayla') : null, rj.enabled ? h('button', { type: 'button', class: 'hs-btn', 'data-testid': 'home-decide-reject', onClick: () => void go('REJECT') }, REJECT_LABEL[item.kind] ?? 'Reddet') : null));
        };
        const more = mine.length - max;
        draw([h('div', { class: 'hd-list' }, ...mine.slice(0, max).map(row)),
            more > 0 ? h('a', { class: 'hs-foot', href: '#/onaylar', 'data-testid': 'home-decide-more' }, `${more} karar daha — Onaylar →`) : null].filter(Boolean));
    };
    const redraw = load;
    draw([h('button', { type: 'button', class: 'hs-btn hd-open', 'data-testid': 'home-decide-open', onClick: () => { banner = null; void load(); } }, 'Kararları burada ver')]);
    return root;
}
export const DECIDE_CSS = `
.hd{display:flex;flex-direction:column;gap:8px;margin-top:6px}.hd-list{display:grid;gap:8px}.hd-row{display:grid;gap:6px;padding:10px;border-radius:10px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.2)}
.hd-t{font-size:14px;color:#f8fafc;overflow-wrap:anywhere}.hd-m,.hd-n{font-size:12px}.hd-in{min-height:40px;border-radius:8px;border:1px solid rgba(148,163,184,.4);background:rgba(2,6,23,.6);color:#f1f5f9;padding:0 10px;font:14px system-ui;width:100%;box-sizing:border-box}
.hd-a{display:flex;gap:8px;flex-wrap:wrap}.hd-a .hs-btn{min-height:44px;flex:1 1 120px}.hd-ok{border-color:#34d399!important}.hd-b{padding:8px 10px;border-radius:8px;font-size:13px}.hd-b.error{background:rgba(127,29,29,.45);color:#fecaca}.hd-b.info{background:rgba(20,83,45,.4);color:#bbf7d0}
`;
