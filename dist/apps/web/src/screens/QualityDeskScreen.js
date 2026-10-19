// KMI Quality Desk (/kalite) — the quality department's working screen: ONE queue of decisions (HOLD release, first piece, incoming QC, NCR/TAHSİS steps,
// in-process QC, final release), each with the right contextual action and a mandatory written reason where the decision needs one. Every action goes
// through the existing canonical RPCs; the server authorises and audits it. A source that failed is shown as VERİ YOK, never as an empty queue.
import { passportHref } from '../passport/registry.js';
import { h, mount } from '../../../../packages/ui/src/h.js';
import { buildQualityDesk, QKIND_TR, QKIND_ACTION, NCR_MOVE_TR, reasonOk, QD_MIN_REASON } from '../../../../packages/domain/src/qualityDesk.js';
import { waitLabel } from '../../../../packages/domain/src/approvalsInbox.js';
import { errorText } from '../errorText.js';
const CSS = `
.qd{display:flex;flex-direction:column;gap:14px;max-width:1200px}.qd *{box-sizing:border-box}.qd h1{margin:0;font-size:22px}.qd .eb{font-size:10.5px;letter-spacing:.2em;color:#c9a24a;font-weight:700}
.qd .chips{display:flex;gap:8px;flex-wrap:wrap}.qd .chip{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #1a2a46;background:rgba(11,22,42,.6);color:#cbd5e1;cursor:pointer;font:inherit;font-size:13px;display:inline-flex;gap:8px;align-items:center}
.qd .chip[aria-pressed=true]{border-color:#c9a24a;color:#fff;background:rgba(201,162,74,.12)}.qd .chip b{font-variant-numeric:tabular-nums;font-size:16px}.qd .chip .u{color:#8da0bd;font-size:11px}
.qd .item{border:1px solid #1a2a46;border-left:4px solid #5cc8e6;border-radius:12px;padding:12px 14px;background:rgba(11,22,42,.6);display:flex;flex-direction:column;gap:8px;min-width:0}
.qd .item.red{border-left-color:#f0645a}.qd .item.amber{border-left-color:#e8b04a}.qd .item .k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#8da0bd;font-weight:700}
.qd .item .t a{color:#e9eef7;font-weight:700;text-decoration:none;font-size:15px}.qd .item .t a:hover{text-decoration:underline}.qd .d{color:#b6c3d8;font-size:13px;overflow-wrap:anywhere}.qd .age{color:#8da0bd;font-size:12px}
.qd .act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.qd input[type=text],.qd input[type=search],.qd input[type=number],.qd select{min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid #26385a;background:#0b162a;color:inherit;font:inherit;font-size:14px;min-width:0}
.qd .act input[type=text]{flex:1 1 220px}.qd button.b{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #26385a;background:#12203a;color:#e9eef7;font:inherit;font-weight:600;cursor:pointer}
.qd button.b.ok{border-color:#2f7d5e;background:#123a2c}.qd button.b.bad{border-color:#8a3a35;background:#3a1614}.qd button.b:disabled{opacity:.45;cursor:not-allowed}
.qd .banner{padding:10px 14px;border-radius:10px;font-size:14px}.qd .banner.ok{background:#123a2c;border:1px solid #2f7d5e}.qd .banner.error{background:#3a1614;border:1px solid #8a3a35}
.qd .card{border:1px solid #1a2a46;border-radius:12px;padding:12px 14px;background:rgba(11,22,42,.6)}.qd .card h2{margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8da0bd}.qd .mu{color:#8da0bd;font-size:12.5px}
.qd .forms{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:12px}.qd .frm{display:flex;flex-direction:column;gap:8px}
.qd .hist div{padding:6px 0;border-bottom:1px solid #1a2a46;font-size:13px;color:#b6c3d8}.qd .unk{border:1px dashed #26385a;border-radius:10px;padding:8px 12px;color:#8da0bd;font-size:13px}
`;
const KINDS = ['HOLD', 'FIRST_PIECE', 'INCOMING', 'NCR', 'QC', 'FINAL'];
const NOACT = 'Bu işlem için yetkiniz yok. (Yetkiyi sunucu da denetler.)';
export async function renderQualityDesk(container, api, o) {
    let data = null;
    let filter = Object.keys(QKIND_TR).find((x) => x === o.initialKind) ?? 'ALL';
    let q = '';
    let banner = null;
    let armed = null;
    const host = h('div', { class: 'qd', 'data-testid': 'qd-root' });
    mount(container, host);
    const now = () => (o.nowIso ? o.nowIso() : new Date().toISOString());
    const reload = async () => { data = await api.load(); draw(); };
    const act = async (fn, okText) => {
        try {
            await fn();
            banner = { kind: 'ok', text: okText };
            armed = null;
        }
        catch (e) {
            banner = { kind: 'error', text: errorText(e) };
        }
        await reload();
    };
    const refuse = (text) => { banner = { kind: 'error', text }; draw(); };
    const btn = (label, cls, kind, fn, testid, enabled = true) => {
        const allowed = o.can(QKIND_ACTION[kind]);
        return h('button', { type: 'button', class: `b ${cls}`, disabled: !allowed || !enabled, title: allowed ? '' : NOACT, 'data-testid': testid, onClick: fn }, label);
    };
    const wolink = (id, text) => (id ? h('a', { href: passportHref('WORK_ORDER', id), 'data-testid': 'qd-passport' }, text) : text);
    const actions = (it) => {
        const note = h('input', { type: 'text', placeholder: `Gerekçe / not (en az ${QD_MIN_REASON} karakter gerekirse zorunlu)`, 'aria-label': 'Gerekçe', 'data-testid': 'qd-note' });
        const n = () => note.value.trim();
        switch (it.kind) {
            case 'HOLD': return [note, btn('HOLD\'u serbest bırak', 'ok', 'HOLD', () => { if (!reasonOk(n()))
                    return refuse(`Serbest bırakma gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.releaseHold(it.ref.holdId, n()), 'HOLD serbest bırakıldı (karar kaydedildi).'); }, 'qd-hold-release')];
            case 'FIRST_PIECE': return [note, btn('İlk parça uygun', 'ok', 'FIRST_PIECE', () => void act(() => api.firstPiece(it.ref.opId, true, n()), 'İlk parça onaylandı — operasyon üretime geçti.'), 'qd-fp-approve'),
                btn('Uygun değil', 'bad', 'FIRST_PIECE', () => { if (!reasonOk(n()))
                    return refuse(`Red gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.firstPiece(it.ref.opId, false, n()), 'İlk parça reddedildi.'); }, 'qd-fp-reject')];
            case 'QC': return [note, btn('Kalite uygun', 'ok', 'QC', () => void act(() => api.qc(it.ref.opId, 'PASS', n()), 'Kalite kontrol: uygun.'), 'qd-qc-pass'),
                btn('Uygun değil (HOLD açılır)', 'bad', 'QC', () => { if (!reasonOk(n()))
                    return refuse(`Uygunsuzluk gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.qc(it.ref.opId, 'FAIL', n()), 'Kalite kontrol: uygun değil — bekletme açıldı.'); }, 'qd-qc-fail')];
            case 'NCR': return [note, ...(it.canSplit ? splitControl(it, n, note) : []), ...(it.ncrNext ?? []).map((to) => btn(NCR_MOVE_TR[to], to === 'SCRAPPED' ? 'bad' : to === 'ACCEPTED' ? 'ok' : '', 'NCR', () => { if (!reasonOk(n()))
                    return refuse(`Karar gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.moveNcr(it.ref.ncrId, to, n()), `NCR: ${NCR_MOVE_TR[to].toLowerCase()}.`); }, `qd-ncr-${to}`))];
            case 'INCOMING': return [note, btn('Kabul (stoğa al)', 'ok', 'INCOMING', () => void act(() => api.incomingDecision(it.ref.stockLotId, 'ACCEPT', n()), 'Giriş kalite: kabul edildi — lot kullanılabilir.'), 'qd-in-accept'),
                h('button', { type: 'button', class: 'b bad', disabled: !o.can('QUALITY_REJECT'), title: o.can('QUALITY_REJECT') ? '' : NOACT, 'data-testid': 'qd-in-reject', onClick: () => { if (!reasonOk(n()))
                        return refuse(`Red gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.incomingDecision(it.ref.stockLotId, 'REJECT', n()), 'Giriş kalite: reddedildi — lot hurdaya ayrıldı.'); } }, 'Reddet (hurda)')];
            case 'FINAL': return [note, btn(armed === it.key ? 'Emin misiniz? Onayla ve tamamla' : 'Final üretim serbest bırak', armed === it.key ? 'ok' : '', 'FINAL', () => {
                    if (armed !== it.key) {
                        armed = it.key;
                        draw();
                        return;
                    }
                    void act(() => api.finalRelease(it.workOrderId, n() || 'Final kalite serbest bırakma'), 'İş emri tamamlandı (final üretim serbest bırakma).');
                }, 'qd-final')];
        }
    };
    // partial decision: split pieces off the case, then decide each part on its own (accept / scrap / rework). The server checks QUALITY_REJECT, the reason, and 0 < part < case.
    const splitControl = (it, n, _note) => {
        const q = h('input', { type: 'number', min: '1', max: String((it.qty ?? 2) - 1), step: '1', placeholder: 'ayrılacak adet', 'aria-label': 'Ayrılacak adet', style: 'width:8em', 'data-testid': 'qd-split-qty' });
        const allowed = o.can('QUALITY_REJECT');
        return [q, h('button', { type: 'button', class: 'b', disabled: !allowed, title: allowed ? '' : NOACT, 'data-testid': 'qd-split', onClick: () => {
                    const k = Number(q.value);
                    if (!Number.isInteger(k) || k < 1 || k >= (it.qty ?? 0))
                        return refuse(`Ayrılacak adet 1 ile ${(it.qty ?? 1) - 1} arasında tam sayı olmalı.`);
                    if (!reasonOk(n()))
                        return refuse(`Bölme gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`);
                    void act(() => api.splitNcr(it.ref.ncrId, k, n()), `Vaka bölündü: ${k} adetlik yeni parça ayrıldı — her parça ayrı karar alır.`);
                } }, 'Böl (kısmi karar)')];
    };
    // operation tashih queue (0125): unresolved tashih per operation — Quality opens the case; a missing queue (SQL not installed) is said, not hidden.
    const opCases = () => {
        if (!data)
            return null;
        if (data.opTashih === null)
            return h('div', { class: 'unk', 'data-testid': 'qd-optashih-unknown' }, 'Operasyon tashih kuyruğu okunamadı (veri yok) — bu "bekleyen tashih yok" demek değildir.');
        if (!data.opTashih.length)
            return null;
        return h('section', { class: 'card', 'data-testid': 'qd-optashih' }, h('h2', {}, 'Operasyon tashih kuyruğu'), ...data.opTashih.map((r) => {
            const qty = h('input', { type: 'number', min: '1', max: String(r.qtyTashih), step: '1', value: String(r.qtyTashih), 'aria-label': 'Adet', style: 'width:6em', 'data-testid': 'qd-opcase-qty' });
            const why = h('input', { type: 'text', placeholder: 'Vaka gerekçesi', 'aria-label': 'Vaka gerekçesi', 'data-testid': 'qd-opcase-reason' });
            const allowed = o.can('QUALITY_REJECT');
            return h('div', { class: 'item amber', 'data-testid': 'qd-optashih-row', 'data-op': r.operationId }, h('div', { class: 't' }, wolink(r.workOrderId, `${r.productCode ?? ''} · OP ${r.opNo} ${r.opName}`)), h('div', { class: 'd' }, `${r.qtyTashih} adet tashih bekliyor · makine ${r.machineCode ?? '—'} · operatör ${r.operator ?? '—'} · iyi ${r.qtyGood} · hurda ${r.qtyScrap}`, r.causes.length ? ` · neden: ${r.causes.map((c) => `${c.characteristicCode ?? c.kind}${c.feature ? ' ' + c.feature : ''} (${c.qty})`).join(', ')}` : ' · neden bildirilmemiş'), h('div', { class: 'act' }, qty, why, h('button', { type: 'button', class: 'b bad', disabled: !allowed, title: allowed ? '' : NOACT, 'data-testid': 'qd-opcase', onClick: () => {
                    const k = Number(qty.value);
                    if (!Number.isInteger(k) || k < 1 || k > r.qtyTashih)
                        return refuse(`Adet 1 ile ${r.qtyTashih} arasında tam sayı olmalı.`);
                    if (!reasonOk(why.value))
                        return refuse(`Vaka gerekçesi en az ${QD_MIN_REASON} karakter olmalı.`);
                    void act(() => api.openOperationCase(r.operationId, k, why.value.trim(), 'OPERATOR_SELF_DECLARED'), 'Operasyon vakası açıldı (iş emri kalite bekletmesinde).');
                } }, 'Vaka aç')));
        }));
    };
    const itemEl = (it) => h('article', { class: `item ${it.tone}`, 'data-testid': 'qd-item', 'data-kind': it.kind, 'data-key': it.key }, h('div', { class: 'k' }, QKIND_TR[it.kind], it.ageHours !== null ? h('span', { class: 'age', 'data-testid': 'qd-age' }, ` · bekleme ${waitLabel(it.ageHours)}`) : null), h('div', { class: 't' }, wolink(it.workOrderId, it.title)), h('div', { class: 'd' }, it.detail), h('div', { class: 'act' }, ...actions(it)));
    const woOptions = () => (data?.workOrders ?? []).filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED');
    const newForms = () => {
        const wos = woOptions();
        const sel = () => h('select', { 'aria-label': 'İş emri', 'data-testid': 'qd-wo-select' }, h('option', { value: '' }, '(iş emri seçin)'), ...wos.map((w) => h('option', { value: w.id }, `${w.productCode} · ${w.customerPo}`)));
        const s1 = sel(), r1 = h('input', { type: 'text', placeholder: 'HOLD nedeni', 'aria-label': 'HOLD nedeni', 'data-testid': 'qd-newhold-reason' });
        const s2 = sel(), qty = h('input', { type: 'number', min: '1', placeholder: 'adet', 'aria-label': 'Adet', style: 'width:6em', 'data-testid': 'qd-newncr-qty' }), r2 = h('input', { type: 'text', placeholder: 'Uygunsuzluk nedeni', 'aria-label': 'Uygunsuzluk nedeni', 'data-testid': 'qd-newncr-reason' });
        return h('div', { class: 'forms' }, h('div', { class: 'card frm' }, h('h2', {}, 'Yeni kalite bekletmesi (HOLD)'), s1, r1, h('div', {}, h('button', { type: 'button', class: 'b bad', 'data-testid': 'qd-newhold', onClick: () => { if (!s1.value)
                return refuse('İş emri seçin.'); if (!reasonOk(r1.value))
                return refuse(`HOLD nedeni en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.openHold(s1.value, r1.value.trim()), 'HOLD açıldı — iş emri bekletmede.'); } }, 'HOLD aç'))), h('div', { class: 'card frm' }, h('h2', {}, 'Yeni uygunsuzluk (NCR)'), s2, h('div', { class: 'act' }, qty, r2), h('div', {}, h('button', { type: 'button', class: 'b bad', disabled: !o.can('QUALITY_REJECT'), title: o.can('QUALITY_REJECT') ? '' : NOACT, 'data-testid': 'qd-newncr', onClick: () => { const n = Number(qty.value); if (!s2.value)
                return refuse('İş emri seçin.'); if (!(n > 0))
                return refuse('Adet 0\'dan büyük olmalı.'); if (!reasonOk(r2.value))
                return refuse(`Neden en az ${QD_MIN_REASON} karakter olmalı.`); void act(() => api.openNcr(s2.value, n, r2.value.trim(), crypto.randomUUID()), 'Uygunsuzluk kaydı açıldı.'); } }, 'NCR aç'))));
    };
    function draw() {
        if (!data) {
            host.replaceChildren(h('style', {}, CSS), h('div', { class: 'mu' }, 'Kalite kayıtları okunuyor…'));
            return;
        }
        const desk = buildQualityDesk({ nowIso: now(), workOrders: data.workOrders, ops: data.ops, holds: data.holds, ncrs: data.ncrs, incoming: data.incoming,
            names: { machine: (id) => (id ? data.machines.get(id) ?? id.slice(0, 8) : '—'), person: (id) => (id ? data.people.get(id) ?? id.slice(0, 8) : '—') } });
        const list = desk.items.filter((x) => (filter === 'ALL' || x.kind === filter) && (!q || `${x.title} ${x.detail}`.toLocaleLowerCase('tr-TR').includes(q)));
        const chip = (k, label, n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === k), 'data-testid': `qd-chip-${k}`, onClick: () => { filter = k; draw(); } }, label, n === null ? h('span', { class: 'u' }, 'veri yok') : h('b', {}, String(n)));
        const parts = [h('style', {}, CSS),
            h('div', {}, h('div', { class: 'eb' }, 'KALİTE & METROLOJİ'), h('h1', { 'data-testid': 'qd-title' }, 'Kalite Masası')),
            banner ? h('div', { class: `banner ${banner.kind}`, role: banner.kind === 'error' ? 'alert' : 'status', 'data-testid': 'qd-banner', 'data-kind': banner.kind }, banner.text) : null,
            h('div', { class: 'chips', 'data-testid': 'qd-chips' }, chip('ALL', 'Tümü', desk.items.length), ...KINDS.map((k) => chip(k, QKIND_TR[k], desk.counts[k]))),
            desk.unknown.length ? h('div', { class: 'unk', 'data-testid': 'qd-unknown' }, `Okunamayan kaynak: ${desk.unknown.map((k) => QKIND_TR[k]).join(', ')} — bu başlıklar "bekleyen yok" demek değildir (VERİ YOK).`) : null,
            h('input', { type: 'search', placeholder: 'Karar kuyruğunda ara (ürün, müşteri PO, neden…)', 'aria-label': 'Ara', value: q, 'data-testid': 'qd-search', onInput: (e) => { q = e.target.value.trim().toLocaleLowerCase('tr-TR'); draw(); } }),
            (list.length ? h('div', { style: 'display:flex;flex-direction:column;gap:10px', 'data-testid': 'qd-list' }, ...list.map(itemEl))
                : h('div', { class: 'card mu', 'data-testid': 'qd-empty' }, desk.unknown.length ? 'Gösterilecek kayıt yok (bazı kaynaklar okunamadı).' : 'Kayıtlara göre karar bekleyen kalite işi yok. (Bu, her şeyin yolunda olduğunun kanıtı değildir.)')),
            opCases(),
            newForms(),
            h('section', { class: 'card', 'data-testid': 'qd-history' }, h('h2', {}, 'Son kararlar (geçmiş)'), desk.history.length ? h('div', { class: 'hist' }, ...desk.history.map((x) => h('div', {}, x.text, x.at ? h('span', { class: 'mu' }, ` · ${x.at.slice(0, 10)}`) : null))) : h('div', { class: 'mu' }, 'Kapanmış HOLD / NCR kaydı yok.')),
            h('div', { class: 'mu' }, 'Bağlantılar: ', h('a', { href: '#/tahsis', style: 'color:#5cc8e6' }, 'TAHSİS'), ' · ', h('a', { href: '#/rota', style: 'color:#5cc8e6' }, 'Rota / Operasyonlar'), ' · ', h('a', { href: '#/sevkiyat', style: 'color:#5cc8e6' }, 'Sevkiyat'), ' · ', h('a', { href: '#/gecmis', style: 'color:#5cc8e6' }, 'Olay geçmişi'))];
        host.replaceChildren(...parts.filter((x) => x !== null));
    }
    draw();
    await reload();
}
