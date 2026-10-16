// KMI-007 — Teklif ve Talep Yönetimi: talep (RFQ) → teknik fizibilite → teklif (miktar kademeleri) → revizyon → onay → müşteri yanıtı → siparişe dönüşüm → yazdırma.
// Yetki ve ekonomik görünürlük SUNUCUDA belirlenir; ekran yalnız sunucunun döndürdüğü yetkilerin düğmelerini gösterir.
// Bilinmeyen veri "VERİ YOK" + nedeniyle gösterilir; hiçbir boş değer 0 olarak yazılmaz. Gerçekleşen maliyet/kârlılık KMI-070 olmadan üretilmez.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../errorText.js';
const CSS = `
.qt{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:1100px;margin:0 auto;box-sizing:border-box;color:#e2e8f0}
.qt h1{color:#fff;font-size:20px;margin:6px 0}.qt h2{color:#fff;font-size:16px;margin:0 0 6px}.qt h3{color:#fff;font-size:14px;margin:8px 0 4px}
.qt button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}
.qt input,.qt select,.qt textarea{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.qt textarea{padding:8px 10px;min-height:70px}
.qt .card{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;margin:10px 0}
.qt .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.qt .grid{display:grid;gap:8px;margin-top:8px}
.qt .g2{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.qt .primary{background:#1d4ed8;color:#fff}.qt .ghost{background:#1e293b;color:#e2e8f0}.qt .danger{background:#7f1d1d;color:#fecaca}.qt .good{background:#166534;color:#dcfce7}
.qt .chip{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:11px;background:#1e293b;color:#e6edf7}
.qt .ok{background:#14532d;color:#bbf7d0}.qt .warn{background:#78350f;color:#fde68a}.qt .bad{background:#7f1d1d;color:#fecaca}.qt .info{background:#1e3a8a;color:#dbeafe}
.qt .card.warn,.qt .card.bad,.qt .card.info{background:#0f172a}
.qt .card.warn{border-color:#b45309}.qt .card.bad{border-color:#b91c1c}.qt .card.info{border-color:#1d4ed8}
.qt .mut{color:#94a3b8;font-size:12px}.qt .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.qt .kpi{border:1px solid #1e293b;border-radius:12px;padding:10px;background:#0b1220}.qt .kpi b{display:block;font-size:20px;color:#fff}
.qt .item{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:8px 0;border-top:1px solid #1e293b}
.qt .tabs{display:flex;gap:6px;flex-wrap:wrap}.qt .tabs button{background:#1e293b;color:#cbd5e1}.qt .tabs button.on{background:#1d4ed8;color:#fff}
.qt .tw{overflow-x:auto}.qt table{border-collapse:collapse;width:100%;font-size:13px}.qt th,.qt td{border-bottom:1px solid #1e293b;padding:6px 8px;text-align:left;white-space:nowrap}.qt th{color:#94a3b8;font-weight:700}
.qt .na{color:#fbbf24;font-weight:700}.qt label{font-size:12px;color:#94a3b8;display:block}
.qt-print{display:none}
@media print{body *{visibility:hidden}.qt-print,.qt-print *{visibility:visible}.qt-print{display:block;position:absolute;inset:0;background:#fff;color:#000;padding:28px;font-family:system-ui,sans-serif}}
.qt-print table{border-collapse:collapse;width:100%;font-size:13px}.qt-print th,.qt-print td{border:1px solid #999;padding:6px 8px;text-align:left}
.qt-print .wm{font-size:44px;color:#c00;opacity:.25;transform:rotate(-12deg);margin:10px 0;font-weight:900}
@media (max-width:640px){.qt{padding:8px}.qt .card{padding:10px}}
`;
const NA = 'VERİ YOK';
const RFQ_TR = { NEW: 'Yeni', FEASIBILITY: 'Fizibilitede', QUOTING: 'Teklif hazırlanıyor', QUOTED: 'Teklif verildi', WON: 'Kazanıldı', LOST: 'Kaybedildi', CANCELLED: 'İptal' };
const Q_TR = { DRAFT: 'Taslak', PENDING_APPROVAL: 'Onay bekliyor', APPROVED: 'Onaylandı', SENT: 'Müşteriye gönderildi', ACCEPTED: 'Müşteri kabul etti', CONVERTED: 'Siparişe dönüştü', REJECTED: 'Reddedildi', LOST: 'Kaybedildi', CANCELLED: 'İptal', EXPIRED: 'Süresi doldu', SUBMITTED: 'Gönderildi', SUPERSEDED: 'Yeni revizyonla değişti' };
const V_TR = { FEASIBLE: 'Üretilebilir', CONDITIONAL: 'Şartlı', NOT_FEASIBLE: 'Üretilemez' };
const CONF_TR = { HIGH: 'Güvenilirlik yüksek', MEDIUM: 'Güvenilirlik orta', LOW: 'Güvenilirlik düşük', UNKNOWN: 'Güvenilirlik bilinmiyor' };
const MISS_TR = { ops: 'operasyon planı', machine: 'makine', setup: 'hazırlık süresi', cycle: 'çevrim süresi', material_cost: 'malzeme maliyeti', quality_minutes: 'kalite süresi', external_cost: 'dış operasyon maliyeti', material_lead_days: 'malzeme temin süresi', has_external_ops: 'dış operasyon var/yok bilgisi', external_lead_days: 'dış operasyon süresi', production_shift: 'üretim vardiyası', FX_RATE: 'döviz kuru', LABOUR_HOUR: 'işçilik saat ücreti', MACHINE_HOUR: 'makine saat ücreti', TOOL_MINUTE: 'takım dakika ücreti', OVERHEAD_PCT: 'genel gider oranı' };
const missOne = (m) => { const [k, scope] = m.split(':'); const base = MISS_TR[k ?? ''] ?? m; return scope ? `${base} (${scope.replace(/^op/, 'op ')})` : base; };
const missTr = (m) => (m ?? []).map(missOne).join(', ');
const chipFor = (s) => (['APPROVED', 'ACCEPTED', 'CONVERTED', 'WON', 'SENT'].includes(s) ? 'ok' : ['REJECTED', 'LOST', 'CANCELLED', 'EXPIRED'].includes(s) ? 'bad' : ['PENDING_APPROVAL', 'FEASIBILITY', 'QUOTING'].includes(s) ? 'warn' : 'info');
const money = (v, cur) => (v === null || v === undefined ? NA : `${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${cur}`);
const num = (s) => { const t = s.trim().replace(',', '.'); if (t === '')
    return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const ask = (msg) => { const r = (window.prompt(msg) ?? '').trim(); return r.length >= 5 ? r : null; };
export async function renderQuotesScreen(container, api, state = {}) {
    const go = (s) => renderQuotesScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'qt', 'data-testid': 'qt-root' }, h('style', {}, CSS), ...kids));
    const banner = state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'info'}`, 'data-testid': 'qt-banner', 'data-kind': state.banner.kind }, state.banner.text) : null;
    // A refused action must NOT redraw the screen: the typed form (prices, quantities, PO, reasons) stays exactly as the person left it; only the message appears at the top.
    const fail = async (e, _back) => {
        const text = errorText(e);
        const root = container.querySelector('[data-testid="qt-root"]');
        let b = container.querySelector('[data-testid="qt-banner"]');
        if (!b && root) {
            b = h('div', { class: 'card bad', 'data-testid': 'qt-banner', 'data-kind': 'error' }, text);
            const first = [...root.children].find((c) => c.tagName !== 'STYLE');
            root.insertBefore(b, first?.nextSibling ?? null);
        }
        else if (b) {
            b.textContent = text;
            b.className = 'card bad';
            b.setAttribute('data-kind', 'error');
        }
        try {
            b?.scrollIntoView?.({ block: 'nearest' });
        }
        catch { /* headless */ }
    };
    const setupOrError = (e) => shell(h('h1', {}, 'Teklifler'), isSetupPending(e)
        ? h('div', { class: 'card warn', 'data-testid': 'qt-setup' }, 'Kurulum bekleniyor: teklif ve talep yönetimi için sunucu güncellemesi (0103) henüz uygulanmadı. Mevcut kayıtlarınız etkilenmedi.')
        : h('div', { class: 'card bad', 'data-testid': 'qt-error' }, `Yüklenemedi: ${errorText(e)}`));
    if (state.quote && state.quote !== 'new')
        return renderQuote(state.quote);
    if (state.quote === 'new')
        return renderNewQuote();
    if (state.rfq === 'new')
        return renderNewRfq();
    if (state.rfq)
        return renderRfq(state.rfq);
    return renderHome();
    // ───────────────────────── ana sayfa ─────────────────────────
    async function renderHome() {
        // Each part loads on its own: a technical user (CAM / kalite) may read requests but not quotes; the server decides, the screen shows only what it returned.
        const soft = async (p, fb) => { try {
            return { v: await p, denied: false };
        }
        catch (e) {
            if (/FORBIDDEN/.test(e instanceof Error ? e.message : String(e)))
                return { v: fb, denied: true };
            throw e;
        } };
        let dashR, rfqR, quoteR;
        try {
            [dashR, rfqR, quoteR] = await Promise.all([soft(api.dashboard(), null), soft(api.rfqList(), []), soft(api.quoteList(), [])]);
        }
        catch (e) {
            setupOrError(e);
            return;
        }
        const dash = dashR.v ?? { rfqWaitingFeasibility: null, rfqOverdue: null, pendingApproval: null, expiring: null, incompleteDrafts: null };
        const rfqs = rfqR.v, quotes = quoteR.v;
        const tab = state.tab ?? (dashR.denied ? (rfqR.denied ? 'teklifler' : 'talepler') : 'ozet');
        const tabDefs = [['ozet', 'Özet'], ['talepler', `Talepler (${rfqs.length})`], ['teklifler', `Teklifler (${quotes.length})`]].filter(([k]) => !(k === 'ozet' && dashR.denied) && !(k === 'talepler' && rfqR.denied) && !(k === 'teklifler' && quoteR.denied));
        const tabs = h('div', { class: 'tabs', 'data-testid': 'qt-tabs' }, ...tabDefs.map(([k, l]) => h('button', { type: 'button', class: tab === k ? 'on' : '', 'data-testid': `qt-tab-${k}`, onClick: () => void go({ tab: k }) }, l)));
        const bucket = (title, tid, items) => h('div', { class: 'kpi', 'data-testid': tid }, h('span', { class: 'mut' }, title), items === null ? h('b', { class: 'na' }, 'Yetkiniz yok') : h('b', {}, String(items.length)), ...(items ?? []).slice(0, 5).map((i) => h('a', { href: '#', class: 'mut', style: 'display:block;padding:4px 0', onClick: (ev) => { ev.preventDefault(); i.open(); } }, i.label)));
        const body = [];
        if (tab === 'ozet') {
            body.push(h('div', { class: 'kpis', 'data-testid': 'qt-kpis' }, bucket('Fizibilite bekleyen talepler', 'qt-k-feas', dash.rfqWaitingFeasibility && dash.rfqWaitingFeasibility.map((r) => ({ label: `${r.rfqNo} · ${r.title}`, open: () => void go({ rfq: r.id }) }))), bucket('Cevap süresi geçen talepler', 'qt-k-overdue', dash.rfqOverdue && dash.rfqOverdue.map((r) => ({ label: `${r.rfqNo} · ${r.respondBy}`, open: () => void go({ rfq: r.id }) }))), bucket('Onay bekleyen teklifler', 'qt-k-pending', dash.pendingApproval && dash.pendingApproval.map((r) => ({ label: r.quoteNo, open: () => void go({ quote: r.id }) }))), bucket('Süresi dolmak üzere', 'qt-k-expiring', dash.expiring && dash.expiring.map((r) => ({ label: `${r.quoteNo} · ${r.validUntil}`, open: () => void go({ quote: r.id }) }))), bucket('Eksik bilgili taslaklar', 'qt-k-incomplete', dash.incompleteDrafts && dash.incompleteDrafts.map((r) => ({ label: r.quoteNo, open: () => void go({ quote: r.id }) })))), h('div', { class: 'card info', 'data-testid': 'qt-kmi070' }, 'Teklif–gerçekleşen maliyet karşılaştırması KMI-070 (gerçekleşen maliyet) tamamlanınca açılır. Bugün gerçekleşmiş maliyet veya kârlılık gösterilmez.'));
        }
        if (tab === 'talepler') {
            body.push(h('div', { class: 'card', 'data-testid': 'qt-rfq-list' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, `${rfqs.length} talep`), (quoteR.denied ? null : h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-rfq-new', onClick: () => void go({ rfq: 'new', tab }) }, 'Yeni talep'))), ...(rfqs.length ? rfqs.map((r) => h('div', { class: 'item', 'data-testid': 'qt-rfq-row', 'data-id': r.id }, h('div', {}, h('b', {}, `${r.rfqNo} · ${r.title}`), h('div', { class: 'mut' }, `${r.customer} · alındı ${r.receivedOn}${r.respondBy ? ` · cevap ${r.respondBy}` : ''} · fizibilite ${r.assessedLines}/${r.lines}${r.quoteNo ? ` · ${r.quoteNo}` : ''}`)), h('div', { class: 'row' }, r.overdue ? h('span', { class: 'chip bad' }, 'Süre geçti') : null, h('span', { class: `chip ${chipFor(r.status)}` }, RFQ_TR[r.status] ?? r.status), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-rfq-open', onClick: () => void go({ rfq: r.id }) }, 'Aç'))))
                : [h('div', { class: 'mut', 'data-testid': 'qt-rfq-empty' }, 'Talep kaydı yok.')])));
        }
        if (tab === 'teklifler') {
            body.push(h('div', { class: 'card', 'data-testid': 'qt-quote-list' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, `${quotes.length} teklif`), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-quote-new', onClick: () => void go({ quote: 'new', tab }) }, 'Yeni teklif')), ...(quotes.length ? quotes.map((q) => h('div', { class: 'item', 'data-testid': 'qt-quote-row', 'data-id': q.id }, h('div', {}, h('b', {}, `${q.quoteNo} · Rev ${q.revisionNo}`), h('div', { class: 'mut' }, `${q.customer} · ${q.lines} kalem · ${q.currency}${q.validUntil ? ` · geçerlilik ${q.validUntil}` : ''}${q.rfqNo ? ` · ${q.rfqNo}` : ''}`)), h('div', { class: 'row' }, h('span', { class: `chip ${chipFor(q.effectiveStatus)}` }, Q_TR[q.effectiveStatus] ?? q.effectiveStatus), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-quote-open', onClick: () => void go({ quote: q.id }) }, 'Aç'))))
                : [h('div', { class: 'mut', 'data-testid': 'qt-quote-empty' }, 'Teklif kaydı yok.')])));
        }
        shell(h('div', { class: 'row', style: 'justify-content:space-between' }, h('h1', { 'data-testid': 'qt-heading' }, 'Teklifler ve Talepler'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-policy-btn', onClick: () => void go({ policy: true }) }, 'Teklif kuralları')), banner, tabs, ...body, state.policy ? await policyCard() : null);
    }
    async function policyCard() {
        let d = null;
        void d;
        const mm = h('input', { type: 'text', placeholder: 'Asgari marj % (boş = tanımsız)', 'data-testid': 'qt-pol-margin' });
        const vd = h('input', { type: 'text', value: '30', 'data-testid': 'qt-pol-validity' });
        const sa = h('input', { type: 'checkbox', checked: true, 'data-testid': 'qt-pol-second' });
        sa.checked = true;
        const la = h('input', { type: 'text', value: '85', 'data-testid': 'qt-pol-attendance' });
        const wd = h('input', { type: 'text', value: '5', 'data-testid': 'qt-pol-days' });
        const rs = h('input', { type: 'text', placeholder: 'Gerekçe (en az 5 karakter)', 'data-testid': 'qt-pol-reason' });
        return h('div', { class: 'card', 'data-testid': 'qt-policy' }, h('h2', {}, 'Teklif kuralları (yönetici)'), h('div', { class: 'grid g2' }, h('div', {}, h('label', {}, 'Asgari marj %'), mm), h('div', {}, h('label', {}, 'Varsayılan geçerlilik (gün)'), vd), h('div', {}, h('label', {}, 'Vardiyada fiili çalışma %'), la), h('div', {}, h('label', {}, 'Haftalık çalışma günü'), wd), h('label', {}, sa, ' Onay için ikinci kişi şart'), rs), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-pol-save', onClick: async () => {
                try {
                    await api.setPolicy({ minMarginPct: num(mm.value), validityDays: num(vd.value) ?? 30, secondApprover: sa.checked, labourAttendancePct: num(la.value) ?? 85, workingDays: num(wd.value) ?? 5 }, rs.value);
                    await go({ banner: { kind: 'info', text: 'Teklif kuralları kaydedildi.' } });
                }
                catch (e) {
                    await fail(e, { policy: true });
                }
            } }, 'Kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({}) }, 'Kapat')));
    }
    // ───────────────────────── yeni talep ─────────────────────────
    async function renderNewRfq() {
        let lk;
        try {
            lk = await api.lookups();
        }
        catch (e) {
            setupOrError(e);
            return;
        }
        const cust = h('select', { 'data-testid': 'qt-n-customer' }, h('option', { value: '' }, 'Müşteri seçin'), ...lk.customers.map((c) => h('option', { value: c.id }, `${c.name} (${c.code})`)));
        const title = h('input', { type: 'text', placeholder: 'Talep başlığı', 'data-testid': 'qt-n-title' });
        const ref = h('input', { type: 'text', placeholder: 'Müşteri talep no', 'data-testid': 'qt-n-ref' });
        const rec = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10), 'data-testid': 'qt-n-received' });
        const resp = h('input', { type: 'date', 'data-testid': 'qt-n-respond' });
        const note = h('textarea', { placeholder: 'Not', 'data-testid': 'qt-n-note' });
        const linesBox = h('div', { 'data-testid': 'qt-n-lines' });
        const rows = [];
        const addRow = () => {
            const part = h('input', { type: 'text', placeholder: 'Parça adı', 'data-testid': 'qt-n-part' });
            const qty = h('input', { type: 'text', placeholder: 'Miktarlar (örn. 10, 100, 500)', 'data-testid': 'qt-n-qty' });
            const prod = h('select', { 'data-testid': 'qt-n-prod' }, h('option', { value: '' }, 'Ürün (sonra bağlanabilir)'), ...lk.products.map((p) => h('option', { value: p.id }, `${p.code} · ${p.name}`)));
            const req = h('input', { type: 'date', 'data-testid': 'qt-n-req' });
            rows.push({ part, qty, prod, req });
            linesBox.appendChild(h('div', { class: 'card' }, h('div', { class: 'grid g2' }, part, qty, prod, h('div', {}, h('label', {}, 'İstenen termin'), req))));
        };
        addRow();
        shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({ tab: 'talepler' }) }, '← Talepler'), h('h1', {}, 'Yeni talep'), banner, h('div', { class: 'card' }, h('div', { class: 'grid g2' }, cust, title, ref, h('div', {}, h('label', {}, 'Alındığı tarih'), rec), h('div', {}, h('label', {}, 'Cevap verilecek tarih'), resp)), note), h('h3', {}, 'Kalemler'), linesBox, h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-n-addline', onClick: addRow }, 'Kalem ekle'), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-n-save', onClick: async () => {
                const lines = rows.map((r) => ({ partName: r.part.value, qtyTiers: r.qty.value.split(/[,;\s]+/).map(num).filter((n) => n !== null), productId: r.prod.value || null, productRevisionId: lk.products.find((x) => x.id === r.prod.value)?.revisions[0]?.id ?? null, requiredBy: r.req.value || null }));
                try {
                    const id = await api.rfqCreate(cust.value, ref.value, title.value, rec.value, resp.value || null, note.value, lines, newId());
                    await go({ rfq: id, banner: { kind: 'info', text: 'Talep kaydedildi.' } });
                }
                catch (e) {
                    await fail(e, { rfq: 'new' });
                }
            } }, 'Talebi kaydet')));
    }
    // ───────────────────────── talep detayı ─────────────────────────
    async function renderRfq(id) {
        let d, lk;
        try {
            [d, lk] = await Promise.all([api.rfqDetail(id), api.lookups().catch(() => ({ customers: [], products: [], machines: [] }))]);
        }
        catch (e) {
            shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({ tab: 'talepler' }) }, '← Talepler'), h('div', { class: 'card bad', 'data-testid': 'qt-error' }, `Yüklenemedi: ${errorText(e)}`));
            return;
        }
        const closed = ['WON', 'LOST', 'CANCELLED'].includes(d.rfq.status);
        const act = async (fn, ok) => { try {
            await fn();
            await go({ rfq: id, banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await fail(e, { rfq: id });
        } };
        const lineCard = (l) => {
            const f = l.feasibility;
            const assessing = state.assess === l.id && d.canTech && !closed;
            const form = () => {
                const verdict = h('select', { 'data-testid': 'qt-f-verdict' }, ...['FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE'].map((v) => h('option', { value: v }, V_TR[v])));
                const summary = h('textarea', { placeholder: 'Özet: hangi operasyonlar, hangi makineler (zorunlu)', 'data-testid': 'qt-f-summary' });
                const risks = h('textarea', { placeholder: 'Riskler (şartlı/üretilemez için zorunlu)', 'data-testid': 'qt-f-risks' });
                const tool = h('input', { type: 'text', placeholder: 'Takım / aparat notu', 'data-testid': 'qt-f-tool' });
                const qual = h('input', { type: 'text', placeholder: 'Kalite / ölçüm notu', 'data-testid': 'qt-f-quality' });
                const ext = h('input', { type: 'text', placeholder: 'Dış operasyon notu', 'data-testid': 'qt-f-external' });
                const mach = h('select', { multiple: 'multiple', 'data-testid': 'qt-f-machines', style: 'min-height:90px' }, ...lk.machines.map((m) => h('option', { value: m.id }, `${m.code} · ${m.name}`)));
                return h('div', { class: 'card', 'data-testid': 'qt-f-form' }, h('div', { class: 'grid' }, verdict, summary, risks, tool, qual, ext, h('div', {}, h('label', {}, 'Uygun makineler'), mach)), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-f-save', onClick: () => { const input = { verdict: verdict.value, machineIds: [...mach.selectedOptions].map((o) => o.value), summary: summary.value, risks: risks.value, tooling: tool.value, quality: qual.value, external: ext.value }; void act(() => api.rfqAssess(l.id, input), 'Fizibilite kaydedildi.'); } }, 'Değerlendirmeyi kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ rfq: id }) }, 'Vazgeç')));
            };
            const linkBox = () => {
                if (l.product || closed || !d.canPrepare)
                    return null;
                const sel = h('select', { 'data-testid': 'qt-l-prod' }, h('option', { value: '' }, 'Mevcut ürüne bağla'), ...lk.products.map((p) => h('option', { value: p.id }, `${p.code} · ${p.name}`)));
                const code = h('input', { type: 'text', placeholder: 'Yeni ürün kodu', 'data-testid': 'qt-l-ncode' });
                const name = h('input', { type: 'text', placeholder: 'Yeni ürün adı', 'data-testid': 'qt-l-nname' });
                const rev = h('input', { type: 'text', value: 'A', placeholder: 'Revizyon', 'data-testid': 'qt-l-nrev' });
                return h('div', { class: 'grid g2' }, h('div', { class: 'row' }, sel, h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-l-link', onClick: () => { const p = lk.products.find((x) => x.id === sel.value); if (p)
                        void act(() => api.rfqLinkProduct(l.id, p.id, p.revisions[0]?.id ?? null), 'Ürüne bağlandı.'); } }, 'Bağla')), h('div', { class: 'row' }, code, name, rev, h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-l-create', onClick: () => void act(() => api.rfqCreateProduct(l.id, code.value, name.value, rev.value), 'Ürün oluşturuldu ve bağlandı.') }, 'Yeni ürün aç')));
            };
            return h('div', { class: 'card', 'data-testid': 'qt-rfq-line', 'data-id': l.id }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('b', {}, `${l.lineNo}. ${l.partName}`), h('div', { class: 'mut' }, `Miktar: ${l.qtyTiers.join(' / ')}${l.requiredBy ? ` · istenen termin ${l.requiredBy}` : ''}${l.documents ? ` · ${l.documents} teknik dosya` : ''}`)), h('div', { class: 'row' }, f ? h('span', { class: `chip ${f.verdict === 'FEASIBLE' ? 'ok' : f.verdict === 'CONDITIONAL' ? 'warn' : 'bad'}`, 'data-testid': 'qt-verdict' }, V_TR[f.verdict]) : h('span', { class: 'chip warn', 'data-testid': 'qt-verdict' }, 'Fizibilite yok'), d.canTech && !closed ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-f-open', onClick: () => void go({ rfq: id, assess: l.id }) }, f ? 'Yeniden değerlendir' : 'Değerlendir') : null)), h('div', { class: 'mut', 'data-testid': 'qt-l-product' }, l.product ? `Ürün: ${l.product.code} · ${l.product.name}${l.productRevision ? ` · Rev ${l.productRevision.revision}` : ''}` : 'Ürün bağlı değil (siparişe dönüşümden önce bağlanmalı).'), f ? h('div', { class: 'mut', 'data-testid': 'qt-f-info' }, `${f.summary}${f.risks ? ` · Risk: ${f.risks}` : ''}${f.toolingNote ? ` · Takım: ${f.toolingNote}` : ''}${f.qualityNote ? ` · Kalite: ${f.qualityNote}` : ''}${f.externalNote ? ` · Dış op.: ${f.externalNote}` : ''}`) : null, linkBox(), assessing ? form() : null);
        };
        const allAssessed = d.lines.length > 0 && d.lines.every((l) => l.feasibility);
        shell(h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-back', onClick: () => void go({ tab: 'talepler' }) }, '← Talepler'), banner, h('div', { class: 'card', 'data-testid': 'qt-rfq-head' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('h1', { 'data-testid': 'qt-rfq-title' }, `${d.rfq.rfqNo} · ${d.rfq.title}`), h('div', { class: 'mut' }, `${d.rfq.customer}${d.rfq.customerRef ? ` · talep no ${d.rfq.customerRef}` : ''} · alındı ${d.rfq.receivedOn}${d.rfq.respondBy ? ` · cevap ${d.rfq.respondBy}` : ''}`)), h('div', { class: 'row' }, d.rfq.overdue ? h('span', { class: 'chip bad' }, 'Süre geçti') : null, h('span', { class: `chip ${chipFor(d.rfq.status)}`, 'data-testid': 'qt-rfq-status' }, RFQ_TR[d.rfq.status] ?? d.rfq.status))), d.rfq.note ? h('div', { class: 'mut' }, d.rfq.note) : null, d.rfq.statusReason ? h('div', { class: 'mut' }, `Durum gerekçesi: ${d.rfq.statusReason}`) : null), ...d.lines.map(lineCard), d.quotes && d.quotes.length ? h('div', { class: 'card', 'data-testid': 'qt-rfq-quotes' }, h('h2', {}, 'Bu talepten hazırlanan teklifler'), ...d.quotes.map((q) => h('div', { class: 'item' }, h('b', {}, q.quoteNo), h('div', { class: 'row' }, h('span', { class: `chip ${chipFor(q.status)}` }, Q_TR[q.status] ?? q.status), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-rfq-quote-open', onClick: () => void go({ quote: q.id }) }, 'Teklifi aç'))))) : null, !closed ? h('div', { class: 'card' }, h('div', { class: 'row' }, d.canPrepare ? h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-rfq-mkquote', disabled: !allAssessed || (d.quotes ?? []).some((q) => !['REJECTED', 'LOST', 'CANCELLED'].includes(q.status)), onClick: async () => { try {
                const qid = await api.quoteCreateFromRfq(id, 'EUR', newId());
                await go({ quote: qid, banner: { kind: 'info', text: 'Teklif taslağı talepten oluşturuldu.' } });
            }
            catch (e) {
                await fail(e, { rfq: id });
            } } }, 'Tekliflendir') : null, !allAssessed ? h('span', { class: 'mut', 'data-testid': 'qt-rfq-hint' }, 'Tekliflendirmek için tüm kalemlerin teknik fizibilitesi yapılmalı.') : null, d.canPrepare ? h('button', { type: 'button', class: 'danger', 'data-testid': 'qt-rfq-lost', onClick: () => { const r = ask('Kaybedildi gerekçesi (en az 5 karakter)'); if (r)
                void act(() => api.rfqSetStatus(id, 'LOST', r), 'Talep kaybedildi olarak kapatıldı.'); } }, 'Kaybedildi') : null, d.canPrepare ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-rfq-cancel', onClick: () => { const r = ask('İptal gerekçesi (en az 5 karakter)'); if (r)
                void act(() => api.rfqSetStatus(id, 'CANCELLED', r), 'Talep iptal edildi.'); } }, 'İptal et') : null)) : null);
    }
    // ───────────────────────── yeni (boş) teklif ─────────────────────────
    async function renderNewQuote() {
        let lk;
        try {
            lk = await api.lookups();
        }
        catch (e) {
            setupOrError(e);
            return;
        }
        const cust = h('select', { 'data-testid': 'qt-nq-customer' }, h('option', { value: '' }, 'Müşteri seçin'), ...lk.customers.map((c) => h('option', { value: c.id }, `${c.name} (${c.code})`)));
        const cur = h('select', { 'data-testid': 'qt-nq-currency' }, ...['EUR', 'TRY', 'USD'].map((c) => h('option', { value: c }, c)));
        const ref = h('input', { type: 'text', placeholder: 'Müşteri talep no (varsa)', 'data-testid': 'qt-nq-ref' });
        shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({ tab: 'teklifler' }) }, '← Teklifler'), h('h1', {}, 'Yeni teklif (talep olmadan)'), banner, h('div', { class: 'card' }, h('div', { class: 'grid g2' }, cust, cur, ref), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-nq-save', onClick: async () => { try {
                const id = await api.quoteCreateBlank(cust.value, cur.value, ref.value, newId());
                await go({ quote: id, banner: { kind: 'info', text: 'Teklif taslağı açıldı.' } });
            }
            catch (e) {
                await fail(e, { quote: 'new' });
            } } }, 'Taslak aç'))));
    }
    // ───────────────────────── teklif detayı ─────────────────────────
    async function renderQuote(id) {
        let d, lk;
        try {
            [d, lk] = await Promise.all([api.quoteDetail(id), api.lookups().catch(() => ({ customers: [], products: [], machines: [] }))]);
        }
        catch (e) {
            shell(h('button', { type: 'button', class: 'ghost', onClick: () => void go({ tab: 'teklifler' }) }, '← Teklifler'), h('div', { class: 'card bad', 'data-testid': 'qt-error' }, `Yüklenemedi: ${errorText(e)}`));
            return;
        }
        const q = d.quote, r = d.revision, p = d.permissions, cur = q.currency;
        const draft = r.status === 'DRAFT' && p.canPrepare;
        const act = async (fn, ok, keep = {}) => { try {
            await fn();
            await go({ quote: id, banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await fail(e, { quote: id, ...keep });
        } };
        const st = q.effectiveStatus;
        // eksik bilgi paneli
        const miss = [];
        if (d.flags.lines === 0)
            miss.push('Teklifte kalem yok');
        if (d.flags.missingProduct)
            miss.push('Ürüne bağlanmamış kalem var (siparişe dönüşüm için gerekli)');
        if (d.flags.missingPrice)
            miss.push('Fiyatı girilmemiş miktar kademesi var');
        if (d.flags.unknownCost)
            miss.push(d.flags.costVisible ? 'Maliyeti bilinmeyen kademe var' : 'Maliyeti bilinmeyen kademe var (ayrıntı için ekonomik yetki gerekir)');
        if (d.flags.unknownLead)
            miss.push('Termin tahmini yapılamayan kademe var');
        if (d.flags.belowMargin)
            miss.push(`Asgari marjın (%${d.flags.minMarginPct ?? '?'}) altında fiyat var`);
        const missBox = miss.length ? h('div', { class: 'card warn', 'data-testid': 'qt-missing' }, h('h2', {}, 'Eksik / dikkat'), ...miss.map((m) => h('div', { class: 'mut', 'data-testid': 'qt-missing-item' }, `• ${m}`))) : h('div', { class: 'card ok', 'data-testid': 'qt-missing-none' }, 'Eksik bilgi yok.');
        // başlık formu
        const headerCard = () => {
            if (!draft)
                return h('div', { class: 'card', 'data-testid': 'qt-header' }, h('div', { class: 'grid g2' }, ...[['Geçerlilik', r.validUntil], ['Ödeme', r.paymentTerms], ['Teslimat şartı', r.deliveryTerms], ['Not (müşteriye görünür)', r.note], ['Müşteri talep no', q.customerRef], ...(r.changeReason ? [['Revizyon nedeni', r.changeReason]] : []), ...(r.internalNote ? [['İç not', r.internalNote]] : [])].map(([k, v]) => h('div', {}, h('span', { class: 'mut' }, `${k}: `), v || '—'))));
            const vu = h('input', { type: 'date', value: r.validUntil ?? '', 'data-testid': 'qt-h-valid' });
            const pay = h('input', { type: 'text', value: r.paymentTerms ?? '', placeholder: 'Ödeme şartı', 'data-testid': 'qt-h-pay' });
            const del = h('input', { type: 'text', value: r.deliveryTerms ?? '', placeholder: 'Teslimat şartı', 'data-testid': 'qt-h-del' });
            const note = h('input', { type: 'text', value: r.note ?? '', placeholder: 'Müşteriye görünen not', 'data-testid': 'qt-h-note' });
            const ref = h('input', { type: 'text', value: q.customerRef ?? '', placeholder: 'Müşteri talep no', 'data-testid': 'qt-h-ref' });
            const inote = h('input', { type: 'text', value: r.internalNote ?? '', placeholder: 'İç not (baskıya girmez)', 'data-testid': 'qt-h-inote' });
            return h('div', { class: 'card', 'data-testid': 'qt-header' }, h('div', { class: 'grid g2' }, h('div', {}, h('label', {}, 'Geçerlilik tarihi'), vu), pay, del, note, ref, inote), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-h-save', onClick: () => void act(() => api.headerSave(id, { validUntil: vu.value, payment: pay.value, delivery: del.value, note: note.value, customerRef: ref.value, internalNote: inote.value }), 'Başlık kaydedildi.') }, 'Başlığı kaydet')));
        };
        // kalem kartı
        const lineCard = (l) => {
            const inp = l.inputs;
            const ed = draft;
            const tableRows = l.tiers.map((t) => h('tr', { 'data-testid': 'qt-tier', 'data-id': t.id }, h('td', { 'data-testid': 'qt-t-qty' }, String(t.qty)), p.canSeeCost ? h('td', { 'data-testid': 'qt-t-cost', class: t.unitCost === null ? 'na' : '' }, t.unitCost === null ? `${NA}${t.costMissing?.length ? ` (eksik: ${missTr(t.costMissing)})` : ''}` : money(t.unitCost, cur)) : null, h('td', { 'data-testid': 'qt-t-price', class: t.unitPrice === null ? 'na' : '' }, t.unitPrice === null ? 'Fiyat girilmedi' : `${money(t.unitPrice, cur)}${t.priceBasis === 'COST_PLUS' ? ' (maliyet+marj)' : ''}`), p.canSeeCost ? h('td', { 'data-testid': 'qt-t-margin' }, t.marginPct === null ? NA : `%${t.marginPct}`) : null, h('td', { 'data-testid': 'qt-t-total' }, money(t.lineTotal, cur)), h('td', { 'data-testid': 'qt-t-lead', class: t.leadTimeDays === null ? 'na' : '' }, t.leadTimeDays === null ? `${NA}${t.leadMissing.length ? ` (eksik: ${missTr(t.leadMissing)})` : ''}` : `${t.leadTimeDays} iş günü`), h('td', {}, h('span', { class: `chip ${t.leadConfidence === 'HIGH' ? 'ok' : t.leadConfidence === 'UNKNOWN' ? 'bad' : 'warn'}`, 'data-testid': 'qt-t-conf' }, CONF_TR[t.leadConfidence] ?? t.leadConfidence)), p.canSeeCost ? h('td', {}, t.costConfidence ? h('span', { class: 'chip info' }, `Maliyet: ${CONF_TR[t.costConfidence] ?? t.costConfidence}`) : null) : null, ed && p.canPrepare ? h('td', {}, h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-t-price-edit', onClick: () => priceDialog(t.id, t.qty, t.unitPrice, t.marginPct, t.unitCost !== null) }, 'Fiyat')) : null));
            const head = ['Adet', ...(p.canSeeCost ? ['Birim maliyet'] : []), 'Birim fiyat', ...(p.canSeeCost ? ['Marj'] : []), 'Kalem toplamı', 'Termin', 'Termin güveni', ...(p.canSeeCost ? ['Maliyet güveni'] : []), ...(ed && p.canPrepare ? [''] : [])];
            const opsView = l.ops.length ? h('div', { class: 'mut', 'data-testid': 'qt-ops' }, `Operasyonlar: ${l.ops.map((o) => `${o.opNo}. ${o.name}${o.machine ? ` (${o.machine})` : ''} — hazırlık ${o.setupMinutes ?? NA} dk, çevrim ${o.cycleSeconds ?? NA} sn${o.source === 'ROUTING' ? ' [rota]' : ''}`).join(' · ')}`) : h('div', { class: 'mut na', 'data-testid': 'qt-ops-empty' }, 'Operasyon planı yok (maliyet ve termin hesaplanamaz).');
            const cost = (t) => t.costBreakdown;
            const bd = p.canSeeCost && l.tiers.some((t) => cost(t)) ? h('details', { 'data-testid': 'qt-breakdown' }, h('summary', { class: 'mut' }, 'Maliyet dağılımı (adet başına)'), h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['Adet', 'Hazırlık', 'İşleme', 'Takım', 'Malzeme', 'Kalite', 'Dış op.', 'Fire %', 'Genel gider'].map((x) => h('th', {}, x))), ...l.tiers.map((t) => { const c = t.costBreakdown; return h('tr', {}, h('td', {}, String(t.qty)), ...(c ? [c.setup, c.run, c.tool, c.material, c.quality, c.external].map((v) => h('td', { class: v === null ? 'na' : '' }, v === null ? NA : v.toLocaleString('tr-TR', { maximumFractionDigits: 4 }))) : Array.from({ length: 6 }, () => h('td', { class: 'na' }, NA))), h('td', {}, c ? String(c.scrapPct) : NA), h('td', {}, c?.overhead === undefined || c?.overhead === null ? NA : c.overhead.toLocaleString('tr-TR', { maximumFractionDigits: 4 }))); })))) : null;
            return h('div', { class: 'card', 'data-testid': 'qt-line', 'data-id': l.id }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('b', {}, `${l.lineNo}. ${l.description}`), h('div', { class: 'mut', 'data-testid': 'qt-line-product' }, l.product ? `${l.product.code} · ${l.product.name}${l.productRevision ? ` · Rev ${l.productRevision.revision}` : ''}` : 'Ürün bağlı değil')), ed ? h('div', { class: 'row' }, p.canTech ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-ops-edit', onClick: () => void go({ quote: id, opsLine: l.id }) }, 'Operasyonlar') : null, h('button', { type: 'button', class: 'danger', 'data-testid': 'qt-line-del', onClick: () => void act(() => api.lineDelete(id, l.id), 'Kalem silindi.') }, 'Kalemi sil')) : null), opsView, h('div', { class: 'tw' }, h('table', { 'data-testid': 'qt-tiers' }, h('thead', {}, h('tr', {}, ...head.map((x) => h('th', {}, x)))), h('tbody', {}, ...tableRows))), bd, ed && p.canSeeCost ? inputsForm(l) : null, state.opsLine === l.id && ed && p.canTech ? opsForm(l) : null);
        };
        const inputsForm = (l) => {
            const i = l.inputs;
            const mk = (tid, label, v) => { const el = h('input', { type: 'text', value: v === null || v === undefined ? '' : String(v), placeholder: 'bilinmiyor', 'data-testid': tid }); return { el, box: h('div', {}, h('label', {}, label), el) }; };
            const mat = mk('qt-i-material', `Malzeme / adet (${cur})`, i?.materialCostPerPart), tool = mk('qt-i-tool', `Takım / adet (${cur}) — boş: takım dakikasından`, i?.toolCostOverride), qual = mk('qt-i-quality', 'Kalite süresi / adet (dk)', i?.qualityMinutesPerPart), ext = mk('qt-i-external', `Dış operasyon / adet (${cur})`, i?.externalCostPerPart), scrap = mk('qt-i-scrap', 'Fire %', l.scrapPct), ml = mk('qt-i-matlead', 'Malzeme temin süresi (gün)', l.materialLeadDays), el = mk('qt-i-extlead', 'Dış operasyon süresi (gün)', l.externalLeadDays);
            return h('details', { 'data-testid': 'qt-inputs' }, h('summary', { class: 'mut' }, 'Maliyet girdileri (ekonomik)'), h('div', { class: 'grid g2' }, mat.box, tool.box, qual.box, ext.box, scrap.box, ml.box, el.box), h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-i-save', onClick: () => {
                    const patch = { materialCostPerPart: num(mat.el.value), toolCostOverride: num(tool.el.value), qualityMinutesPerPart: num(qual.el.value), externalCostPerPart: num(ext.el.value), scrapPct: num(scrap.el.value) ?? 0, materialLeadDays: num(ml.el.value), externalLeadDays: num(el.el.value) };
                    void act(() => api.lineSave(id, l.id, l.description, l.product?.id ?? null, l.productRevision?.id ?? null, patch, null), 'Girdiler kaydedildi. Maliyeti yeniden hesaplayın.');
                } }, 'Girdileri kaydet')));
        };
        const opsForm = (l) => {
            const rows = [];
            const box = h('div', { 'data-testid': 'qt-ops-form' });
            const add = (o) => {
                const name = h('input', { type: 'text', value: o?.name ?? '', placeholder: 'Operasyon', 'data-testid': 'qt-o-name' });
                const mach = h('select', { 'data-testid': 'qt-o-machine' }, h('option', { value: '' }, 'Makine seçin'), ...lk.machines.map((m) => h('option', { value: m.id, ...(o?.machineId === m.id ? { selected: 'selected' } : {}) }, `${m.code} · ${m.name}`)));
                const setup = h('input', { type: 'text', value: o?.setupMinutes ?? '', placeholder: 'Hazırlık dk', 'data-testid': 'qt-o-setup' });
                const cyc = h('input', { type: 'text', value: o?.cycleSeconds ?? '', placeholder: 'Çevrim sn / adet', 'data-testid': 'qt-o-cycle' });
                rows.push({ name, mach, setup, cyc });
                box.appendChild(h('div', { class: 'grid g2', style: 'border-top:1px solid #1e293b;padding-top:6px' }, name, mach, setup, cyc));
            };
            (l.ops.length ? l.ops : [undefined]).forEach(add);
            return h('div', { class: 'card info' }, h('h3', {}, 'Operasyon planı (teknik)'), box, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-o-add', onClick: () => add() }, 'Operasyon ekle'), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-o-save', onClick: () => { const ops = rows.map((x) => ({ name: x.name.value, machineId: x.mach.value || null, setupMinutes: num(x.setup.value), cycleSeconds: num(x.cyc.value), source: 'MANUAL' })); void act(() => api.opsSave(id, l.id, ops), 'Operasyon planı kaydedildi. Maliyet ve termini yeniden hesaplayın.'); } }, 'Planı kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ quote: id }) }, 'Vazgeç')));
        };
        function priceDialog(tierId, qty, price, margin, costKnown) {
            const basis = h('select', { 'data-testid': 'qt-p-basis' }, h('option', { value: 'MANUAL' }, 'Elle birim fiyat'), ...(p.canSeeCost ? [h('option', { value: 'COST_PLUS' }, 'Maliyet + marj')] : []));
            const pr = h('input', { type: 'text', value: price ?? '', placeholder: `Birim fiyat (${cur})`, 'data-testid': 'qt-p-price' });
            const mg = h('input', { type: 'text', value: margin ?? '', placeholder: 'Marj % (fiyat üzerinden)', 'data-testid': 'qt-p-margin' });
            const rs = h('input', { type: 'text', placeholder: 'Fiyat değişikliği gerekçesi (en az 5 karakter)', 'data-testid': 'qt-p-reason' });
            const host = container.querySelector('[data-testid="qt-price-host"]');
            if (!host)
                return;
            host.replaceChildren(h('div', { class: 'card info', 'data-testid': 'qt-price-form' }, h('h3', {}, `Adet ${qty} için fiyat`), h('div', { class: 'grid g2' }, basis, pr, mg, rs), !costKnown ? h('div', { class: 'mut na' }, 'Maliyet bilinmiyor: maliyet+marj kullanılamaz; elle fiyat girilebilir.') : null, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-p-save', onClick: () => { const b = basis.value; void act(() => api.setPrice(tierId, b, b === 'MANUAL' ? num(pr.value) : null, b === 'COST_PLUS' ? num(mg.value) : null, rs.value), 'Fiyat kaydedildi.'); } }, 'Fiyatı kaydet'), h('button', { type: 'button', class: 'ghost', onClick: () => host.replaceChildren() }, 'Vazgeç'))));
        }
        // eylemler
        const actions = [];
        if (draft) {
            actions.push(h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-a-addline', onClick: () => { const dsc = (window.prompt('Kalem açıklaması') ?? '').trim(); if (dsc)
                    void act(() => api.lineSave(id, null, dsc, null, null, {}, [1]), 'Kalem eklendi. Adet kademelerini düzenleyin.'); } }, 'Kalem ekle'), p.canSeeCost ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-a-cost', onClick: async () => { try {
                    const r2 = await api.recomputeCosts(id);
                    await go({ quote: id, banner: r2.unknown ? { kind: 'error', text: `Maliyet hesaplandı: ${r2.costed} kademe tamam, ${r2.unknown} kademe BİLİNMİYOR (eksik veri; kademe satırında yazıyor). Eksikleri tamamlayıp yeniden hesaplayın.` } : { kind: 'info', text: `Maliyet hesaplandı (${r2.costed} kademe).` } });
                }
                catch (e) {
                    await fail(e, { quote: id });
                } } }, 'Maliyeti hesapla') : null, h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-a-lead', onClick: async () => { try {
                    const r2 = await api.estimateLead(id);
                    await go({ quote: id, banner: r2.unknown ? { kind: 'error', text: `Termin hesaplandı: ${r2.estimated} kademe tamam, ${r2.unknown} kademe BİLİNMİYOR (kapasite / operasyon / malzeme verisi eksik).` } : { kind: 'info', text: `Termin hesaplandı (${r2.estimated} kademe).` } });
                }
                catch (e) {
                    await fail(e, { quote: id });
                } } }, 'Termini hesapla'), h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-a-submit', onClick: () => void act(() => api.submit(id), 'Teklif onaya gönderildi; bu revizyon artık değiştirilemez.') }, 'Onaya gönder'));
        }
        let ack = null;
        if (r.status === 'SUBMITTED' && st === 'PENDING_APPROVAL' && p.canApprove) {
            ack = h('input', { type: 'checkbox', 'data-testid': 'qt-a-ack' });
            const ackBox = ack;
            actions.push(d.flags.unknownCost ? h('label', { class: 'mut', 'data-testid': 'qt-a-ack-label' }, ackBox, ' Maliyeti BİLİNMEYEN kalemler var; bunu bilerek onaylıyorum') : null, h('button', { type: 'button', class: 'good', 'data-testid': 'qt-a-approve', onClick: () => { const rs = window.prompt('Onay notu (en az 5 karakter)') ?? ''; if (rs.trim().length >= 5)
                    void act(() => api.decide(id, 'APPROVE', rs, ackBox.checked), 'Teklif onaylandı.'); } }, 'Onayla'), h('button', { type: 'button', class: 'danger', 'data-testid': 'qt-a-reject', onClick: () => { const rs = ask('Ret gerekçesi (en az 5 karakter)'); if (rs)
                    void act(() => api.decide(id, 'REJECT', rs, false), 'Teklif reddedildi. Yeni revizyonla düzeltilebilir.'); } }, 'Reddet'));
        }
        if (['APPROVED', 'REJECTED', 'SENT', 'ACCEPTED', 'EXPIRED', 'PENDING_APPROVAL'].includes(st) && p.canPrepare && st !== 'CONVERTED')
            actions.push(h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-a-newrev', onClick: () => { const rs = ask('Yeni revizyon nedeni (en az 5 karakter)'); if (rs)
                    void act(() => api.newRevision(id, rs), 'Yeni revizyon açıldı; önceki revizyon aynen saklandı.'); } }, 'Yeni revizyon'));
        if (st === 'APPROVED' && p.canPrepare)
            actions.push(h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-a-sent', onClick: () => void act(() => api.customerResponse(id, 'SENT', ''), 'Teklif müşteriye gönderildi olarak kaydedildi.') }, 'Müşteriye gönderildi'));
        if (st === 'SENT' && p.canPrepare)
            actions.push(h('button', { type: 'button', class: 'good', 'data-testid': 'qt-a-accepted', onClick: () => void act(() => api.customerResponse(id, 'ACCEPTED', ''), 'Müşteri kabulü kaydedildi.') }, 'Müşteri kabul etti'), h('button', { type: 'button', class: 'danger', 'data-testid': 'qt-a-declined', onClick: () => { const rs = ask('Müşteri red nedeni'); if (rs)
                    void act(() => api.customerResponse(id, 'DECLINED', rs), 'Müşteri ret kaydedildi.'); } }, 'Müşteri reddetti'));
        if (st === 'ACCEPTED' && p.canConvert)
            actions.push(h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-a-convert', onClick: () => void go({ quote: id, convertId: state.convertId ?? newId() }) }, 'Siparişe dönüştür'));
        if (!['CONVERTED', 'CANCELLED', 'LOST'].includes(st) && p.canPrepare)
            actions.push(h('button', { type: 'button', class: 'danger', 'data-testid': 'qt-a-cancel', onClick: () => { const rs = ask('İptal gerekçesi (en az 5 karakter)'); if (rs)
                    void act(() => api.cancel(id, rs), 'Teklif iptal edildi.'); } }, 'İptal et'));
        if (['APPROVED', 'SENT', 'ACCEPTED', 'CONVERTED'].includes(st))
            actions.push(h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-a-print', onClick: async () => { try {
                    const pr = await api.print(id);
                    await go({ quote: id, print: pr });
                    try {
                        window.print();
                    }
                    catch { /* headless */ }
                }
                catch (e) {
                    await fail(e, { quote: id });
                } } }, 'Müşteri teklifini yazdır'));
        // dönüşüm paneli
        const convertCard = () => {
            if (!state.convertId || st !== 'ACCEPTED' || !p.canConvert)
                return null;
            const po = h('input', { type: 'text', placeholder: 'Müşteri sipariş no (PO) — zorunlu', 'data-testid': 'qt-c-po' });
            const sel = [];
            const rows = d.lines.map((l) => {
                const chk = h('input', { type: 'checkbox', 'data-testid': 'qt-c-line' });
                chk.checked = true;
                const qty = h('select', { 'data-testid': 'qt-c-qty' }, ...l.tiers.map((t) => h('option', { value: String(t.qty) }, `${t.qty} adet — ${money(t.unitPrice, cur)}`)));
                const due = h('input', { type: 'date', 'data-testid': 'qt-c-due', title: 'Termin tahmini yoksa zorunlu' });
                sel.push({ lineId: l.id, chk, qty, due });
                return h('div', { class: 'item' }, h('label', {}, chk, ` ${l.lineNo}. ${l.description}${l.product ? '' : ' (ürün bağlı değil!)'}`), h('div', { class: 'row' }, qty, due));
            });
            return h('div', { class: 'card info', 'data-testid': 'qt-convert' }, h('h2', {}, 'Siparişe dönüştür (taslak sipariş açılır)'), po, ...rows, h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'qt-c-go', onClick: async () => {
                    const chosen = sel.filter((x) => x.chk.checked).map((x) => ({ lineId: x.lineId, qty: Number(x.qty.value), dueDate: x.due.value || undefined }));
                    try {
                        const res = await api.convert(id, po.value, chosen, state.convertId);
                        await go({ quote: id, banner: { kind: 'info', text: res.alreadyConverted ? 'Bu teklif zaten dönüştürülmüştü; mevcut sipariş gösteriliyor, ikinci sipariş açılmadı.' : 'Taslak sipariş oluşturuldu. Siparişler ekranından onaylayabilirsiniz.' } });
                    }
                    catch (e) {
                        await fail(e, { quote: id, convertId: state.convertId });
                    }
                } }, 'Dönüştür'), h('button', { type: 'button', class: 'ghost', onClick: () => void go({ quote: id }) }, 'Vazgeç')));
        };
        // geçmiş + fark
        const histCard = () => h('div', { class: 'card', 'data-testid': 'qt-history' }, h('h2', {}, 'Revizyon geçmişi'), ...d.history.map((x) => h('div', { class: 'item', 'data-testid': 'qt-hist-row' }, h('div', {}, h('b', {}, `Rev ${x.revisionNo}`), h('div', { class: 'mut' }, `${Q_TR[x.status] ?? x.status}${x.changeReason ? ` · ${x.changeReason}` : ''}${x.decisionReason ? ` · karar: ${x.decisionReason}` : ''}`)), x.revisionNo > 1 ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-hist-diff', onClick: () => void go({ quote: id, diff: { from: x.revisionNo - 1, to: x.revisionNo } }) }, `Rev ${x.revisionNo - 1} ↔ ${x.revisionNo}`) : null)), d.events.length ? h('details', {}, h('summary', { class: 'mut' }, `Olay izi (${d.events.length})`), ...d.events.map((e) => h('div', { class: 'mut' }, `${e.at.slice(0, 16).replace('T', ' ')} · ${e.kind}${e.revisionNo ? ` · Rev ${e.revisionNo}` : ''}`))) : null);
        const diffHost = h('div', { 'data-testid': 'qt-diff-host' });
        if (state.diff) {
            try {
                const rows = await api.diff(id, state.diff.from, state.diff.to);
                diffHost.appendChild(h('div', { class: 'card info', 'data-testid': 'qt-diff' }, h('h2', {}, `Rev ${state.diff.from} ↔ Rev ${state.diff.to}`), h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['Kalem', 'Adet', 'Önceki fiyat', 'Yeni fiyat', 'Durum'].map((x) => h('th', {}, x))), ...rows.map((x) => h('tr', { 'data-testid': 'qt-diff-row', 'data-change': x.change }, h('td', {}, String(x.lineNo)), h('td', {}, String(x.qty)), h('td', {}, money(x.priceFrom, cur)), h('td', {}, money(x.priceTo, cur)), h('td', {}, { SAME: 'Aynı', CHANGED: 'Değişti', ADDED: 'Eklendi', REMOVED: 'Çıkarıldı' }[x.change])))))));
            }
            catch (e) {
                diffHost.appendChild(h('div', { class: 'card bad' }, errorText(e)));
            }
        }
        const pr = state.print;
        const printSheet = pr ? h('div', { class: 'qt-print', 'data-testid': 'qt-print' }, h('h1', {}, pr.title), pr.watermark ? h('div', { class: 'wm', 'data-testid': 'qt-print-wm' }, pr.watermark) : null, h('div', {}, h('b', {}, `${pr.quoteNo} · Revizyon ${pr.revisionNo}`)), h('div', {}, `Müşteri: ${pr.customer.name}${pr.customerRef ? ` · Talep no: ${pr.customerRef}` : ''}`), h('div', {}, `Tarih: ${pr.issuedOn}${pr.validUntil ? ` · Geçerlilik: ${pr.validUntil}` : ''} · Para birimi: ${pr.currency}`), ...pr.lines.map((l) => h('div', { style: 'margin-top:12px' }, h('b', {}, `${l.lineNo}. ${l.description}${l.productCode ? ` (${l.productCode}${l.revision ? ` Rev ${l.revision}` : ''})` : ''}`), h('table', {}, h('tr', {}, ...['Adet', 'Birim fiyat', 'Toplam', 'Termin'].map((x) => h('th', {}, x))), ...l.tiers.map((t) => h('tr', {}, h('td', {}, String(t.qty)), h('td', {}, money(t.unitPrice, pr.currency)), h('td', {}, money(t.lineTotal, pr.currency)), h('td', {}, t.leadTimeDays === null ? 'Teyit edilecek' : `${t.leadTimeDays} iş günü`)))))), pr.paymentTerms ? h('div', { style: 'margin-top:12px' }, `Ödeme: ${pr.paymentTerms}`) : null, pr.deliveryTerms ? h('div', {}, `Teslimat: ${pr.deliveryTerms}`) : null, pr.note ? h('div', {}, pr.note) : null, h('div', { style: 'margin-top:16px;font-size:11px' }, `Yazdırma zamanı: ${pr.printedAt.slice(0, 16).replace('T', ' ')}`)) : null;
        shell(h('button', { type: 'button', class: 'ghost', 'data-testid': 'qt-back', onClick: () => void go({ tab: 'teklifler' }) }, '← Teklifler'), banner, h('div', { class: 'card', 'data-testid': 'qt-qhead' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('h1', { 'data-testid': 'qt-qtitle' }, `${q.quoteNo} · Rev ${q.currentRevision}`), h('div', { class: 'mut' }, `${q.customer} (${q.customerCode}) · ${cur}${q.rfqNo ? ` · talep ${q.rfqNo}` : ''}${r.submittedBy ? ` · gönderen ${r.submittedBy}` : ''}`)), h('span', { class: `chip ${chipFor(st)}`, 'data-testid': 'qt-qstatus' }, Q_TR[st] ?? st)), r.decisionReason ? h('div', { class: 'mut', 'data-testid': 'qt-decision' }, `Karar notu: ${r.decisionReason}`) : null, d.conversion ? h('div', { class: 'mut', 'data-testid': 'qt-converted' }, `Siparişe dönüştürüldü (${d.conversion.convertedAt.slice(0, 10)}) · sipariş no: ${d.conversion.orderId}`) : null, h('div', { class: 'mut', 'data-testid': 'qt-kmi070' }, 'Gerçekleşen maliyet ve kârlılık: KMI-070 tamamlanınca gösterilir (şu an hesaplanmaz).')), missBox, headerCard(), h('div', { 'data-testid': 'qt-price-host' }), ...d.lines.map(lineCard), h('div', { class: 'card', 'data-testid': 'qt-actions' }, h('div', { class: 'row' }, ...actions, !actions.length ? h('span', { class: 'mut' }, 'Bu teklif için yapabileceğiniz işlem yok.') : null)), convertCard(), histCard(), diffHost, printSheet);
    }
}
