// KMI NEXT — Ekonomi & Yönetim Kararları (matrix 36, 48). Migration 0036.
// Para kuralı (#679): yalnız Ender Kurutlu ve açıkça yetkilendirdiği kişiler. Sunucu herkesi reddeder
// (FORBIDDEN: ECONOMIC_OWNER_ONLY); bu ekran o cevabı "kilitli" olarak gösterir — ekranda gizleme değil,
// veri hiç gelmez. Para birimleri toplanmaz; işçilik / makine saati / genel gider / takım aşınması /
// kur modellenmez ve bu her zaman yazılır. Karar motoru yalnız ÖNERİR (kanıtıyla); kararı sahip verir
// ve karar değiştirilemez kayıttır.
// 0044: sahip bağlama (D-007 — tek kullanımlık kod; isimden/e-postadan asla), maliyet modeli (D-013 —
// tarihli parametreler, eksik bileşen varsa "TAM MALİYET HESAPLANAMADI", kâr gösterilmez), vade / gerçek
// gecikme ve fire eşikleri (D-016), yanlış karar için yeni düzeltici karar (eski kayıt değişmez).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { AGE_BUCKET_TR, DECISION_TR, DUE_BUCKET_TR, canRecordDecision, round2, } from '../../../../packages/domain/src/economics.js';
import { canRecordCorrection } from '../../../../packages/domain/src/economics.js';
import { humanError } from '../errorText.js';
const NUM = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const moneyText = (m) => `${NUM.format(m.amount)} ${m.currency}`;
const linesText = (l) => (l.length ? l.map(moneyText).join(' · ') : '—');
const errText = (e) => (e instanceof Error ? e.message : String(e)); // raw; refusalText maps it
const SEVERITY_TR = { CRITICAL: 'KRİTİK', HIGH: 'YÜKSEK', MEDIUM: 'ORTA', INFO: 'BİLGİ' };
const SEVERITY_COLOR = { CRITICAL: '#b91c1c', HIGH: '#c2410c', MEDIUM: '#a16207', INFO: '#475569' };
const NOT_MODELLED_TR = { LABOUR: 'işçilik', MACHINE_TIME: 'makine saati', OVERHEAD: 'genel gider', TOOL_WEAR: 'takım aşınması', EXCHANGE_RATES: 'döviz kuru' };
const REFUSAL_TR = {
    PROPOSAL_NOT_FOUND: 'Bu öneri artık geçerli değil (veri değişmiş olabilir).',
    INVALID_DECISION: 'Geçersiz karar.',
    NOTE_REQUIRED: 'Karar notu en az 5 karakter olmalı.',
    POSTPONE_DATE_REQUIRED: 'Erteleme için tarih seçin.',
    POSTPONE_DATE_NOT_IN_FUTURE: 'Erteleme tarihi bugünden sonra olmalı.',
    POSTPONE_DATE_ONLY_FOR_POSTPONED: 'Tarih yalnız ertelemede girilir.',
    INVALID_THRESHOLDS: 'Eşik değerleri izin verilen aralıkta değil.',
    'FORBIDDEN: ECONOMIC_OWNER_ONLY': 'Bu işlem yalnız sahibe açıktır.',
    BINDING_CODE_INVALID: 'Kod yanlış.',
    BINDING_CODE_LOCKED: 'Kod 5 yanlış denemeden sonra kilitlendi; yeni kod gerekir.',
    NO_ACTIVE_BINDING_CODE: 'Geçerli bir bağlama kodu yok (süresi dolmuş veya hiç verilmemiş).',
    OWNER_ALREADY_BOUND: 'Sahip hesabı zaten bağlı.',
    ACCOUNT_NOT_ELIGIBLE: 'Bu hesap sahip olarak bağlanamaz (hesap bulunamadı, silinmiş veya engellenmiş).',
    EMAIL_NOT_CONFIRMED: 'Bu hesabın e-posta adresi doğrulanmamış; önce e-posta doğrulaması gerekir.',
    NO_PENDING_REQUEST: 'Bekleyen bir talep yok.',
    REASON_REQUIRED: 'Gerekçe yazın (en az 10 karakter).',
    'FORBIDDEN: OWNER_ONLY': 'Bu işlem yalnız sahibe açıktır.',
    INVALID_COST_PARAMETER: 'Parametre geçersiz (kur için kaynak ve tarih zorunlu; işçilik/takım/genel gider yalnız TESİS için).',
    MACHINE_NOT_FOUND: 'Bu makine kodu kayıtlı değil.',
    VALID_FROM_REQUIRED: 'Geçerlilik başlangıç tarihi gerekli.',
    CORRECTION_REASON_REQUIRED: 'Düzeltme gerekçesi en az 10 karakter olmalı.',
    NOT_LATEST_DECISION: 'Yalnız en son karar düzeltilebilir.',
};
const MISSING_COST_TR = { LABOUR: 'işçilik saat ücreti', TOOL_WEAR: 'takım aşınma kuralı', OVERHEAD: 'genel gider yüzdesi', RUN_TIME: 'çalışma süresi kaydı',
    MATERIAL_PRICE: 'malzeme PO fiyatı', MATERIAL_ISSUE: 'malzeme çıkışı (veya muafiyet)' };
const missingCostText = (m) => m.startsWith('MACHINE_TIME:') ? `makine ${m.slice(13)} saat ücreti` : m.startsWith('EXCHANGE_RATE:') ? `${m.slice(14)}/TRY kuru` : MISSING_COST_TR[m] ?? m;
const COST_KIND_TR = { MACHINE_HOUR: 'Makine saat ücreti', LABOUR_HOUR: 'İşçilik saat ücreti', TOOL_MINUTE: 'Takım aşınması (dakika başı)', OVERHEAD_PCT: 'Genel gider %', FX_RATE: 'Döviz kuru' };
const COMPONENT_TR = { MACHINE_TIME: 'Makine', LABOUR: 'İşçilik', TOOL_WEAR: 'Takım', MATERIAL: 'Malzeme', OVERHEAD: 'Genel gider' };
const refusalText = (msg) => REFUSAL_TR[msg] ?? humanError(msg);
const EVIDENCE_TR = {
    open: 'Açık bakiye', currency: 'Para birimi', dueDate: 'Vade', invoiceAgeDays: 'Fatura yaşı (gün)', invoiced: 'Fatura', materialCost: 'Malzeme maliyeti',
    materialMargin: 'Malzeme marjı', scrapMaterialCost: 'Fireye giden malzeme', sharePct: 'Pay %', previous: 'Önceki fiyat', latest: 'Son fiyat',
    changePct: 'Değişim %', receivableCurrencies: 'Alacak para birimleri', payableCurrencies: 'Borç para birimleri',
};
function evidenceValue(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'currency' in v && 'amount' in v)
        return moneyText({ currency: String(v.currency), amount: Number(v.amount) });
    if (Array.isArray(v))
        return v.join(', ');
    return v === null || v === undefined ? '—' : String(v);
}
/** Material margin only when invoice and material are each in ONE and the SAME currency. */
export function materialMarginText(invoiced, material) {
    if (!invoiced.length || !material.length)
        return 'eksik veri';
    if (invoiced.length !== 1 || material.length !== 1 || invoiced[0].currency !== material[0].currency)
        return 'farklı para birimi — hesaplanmaz';
    return moneyText({ currency: invoiced[0].currency, amount: round2(invoiced[0].amount - material[0].amount) });
}
export async function renderEconomicsScreen(container, api, state) {
    let ov = null;
    let board = null;
    let loadError = null;
    try {
        [ov, board] = await Promise.all([api.overview(state.from, state.to), api.board()]);
    }
    catch (err) {
        loadError = errText(err);
    }
    const go = (patch) => void renderEconomicsScreen(container, api, { ...state, error: null, notice: null, unbindOpen: false, ...patch });
    const shell = (...children) => mount(container, h('div', { class: 'economics-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'eco-heading' }, 'Ekonomi & Yönetim Kararları'), ...children));
    let binding = null;
    try {
        binding = await api.bindingStatus();
    }
    catch {
        binding = null;
    }
    if (loadError && loadError.includes('ECONOMIC_OWNER_ONLY')) {
        const ask = async () => {
            try {
                const r = await api.requestOwnerBinding();
                if (r.status === 'VOIDED_CONFLICT')
                    return go({ error: 'Aynı anda başka bir hesaptan da sahip talebi geldi. Güvenlik için iki talep de iptal edildi; kimse bağlanmadı. Birkaç dakika sonra yalnız kendi hesabınızdan tekrar deneyin.' });
                go({ notice: 'Talebiniz alındı.' });
            }
            catch (err) {
                go({ error: refusalText(errText(err)) });
            }
        };
        const cancel = async () => {
            try {
                await api.cancelOwnerBindingRequest();
                go({ notice: 'Talep geri çekildi.' });
            }
            catch (err) {
                go({ error: refusalText(errText(err)) });
            }
        };
        const req = binding?.myRequest ?? null;
        const fmt = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const stateTr = { EXPIRED: 'süresi doldu', REJECTED: 'reddedildi', VOIDED_CONFLICT: 'çakışma nedeniyle iptal edildi', CANCELLED: 'geri çekildi', APPROVED: 'onaylandı' };
        shell(h('div', { 'data-testid': 'eco-locked', style: 'margin:12px 0;padding:14px;border-radius:12px;background:#f1f5f9;border:1px solid #cbd5e1' }, h('b', {}, '🔒 Kilitli'), h('p', { style: 'margin:6px 0 0' }, 'Maliyet, kârlılık ve ekonomik analizler yalnız Ender Kurutlu ve onun açıkça yetkilendirdiği kişilere açıktır. Rolünüz (yönetim, muhasebe, IT, admin) bu erişimi otomatik vermez.'), h('p', { style: 'margin:6px 0 0;font-size:12px;color:#64748b' }, 'Bu karar sunucuda verildi; ekrana hiçbir ekonomik veri gönderilmedi.')), state.error ? h('div', { 'data-testid': 'eco-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, state.error) : null, state.notice ? h('div', { 'data-testid': 'eco-notice', style: 'padding:10px;border-radius:8px;background:#dcfce7' }, state.notice) : null, binding && !binding.bound
            ? h('div', { 'data-testid': 'eco-bind', style: 'margin:12px 0;padding:12px;border-radius:12px;border:1px dashed #94a3b8' }, h('b', {}, 'Sahip hesabı henüz bağlanmadı'), req && req.state === 'PENDING'
                ? h('div', { 'data-testid': 'eco-bind-pending' }, h('p', { style: 'margin:6px 0;font-size:14px' }, 'Talebiniz bu hesap için alındı. Son adım: Claude\'a "sahip talebini onaylıyorum" yazmanız yeterli. Claude talebin saatini ve e-posta adresini sizinle teyit edip yalnız bu talebi onaylar.'), h('div', { 'data-testid': 'eco-bind-request', style: 'font-size:13px;line-height:1.6;padding:8px;border-radius:8px;background:#f8fafc' }, h('div', {}, 'Hesap: ', h('b', {}, req.email)), h('div', {}, 'Talep: ', fmt(req.requestedAt), ' · geçerlilik: ', fmt(req.expiresAt), ' (30 dk)'), h('div', {}, 'Referans: ', h('code', {}, req.reference))), h('button', { type: 'button', 'data-testid': 'eco-bind-cancel', style: 'margin-top:8px', onClick: () => void cancel() }, 'Talebi geri çek'))
                : h('div', {}, h('p', { style: 'margin:6px 0;font-size:13px' }, 'Ender Kurutlu iseniz, kendi hesabınızla giriş yapmışken aşağıdaki düğmeye basın. Bağlama yalnız şu an giriş yapmış olan hesaba yapılır; isimden veya e-postadan asla tahmin edilmez. Kod girmeniz gerekmez.'), req ? h('div', { 'data-testid': 'eco-bind-last', style: 'font-size:12px;color:#64748b;margin-bottom:6px' }, `Son talebiniz (${fmt(req.requestedAt)}): ${stateTr[req.state] ?? req.state}.`) : null, h('button', { type: 'button', 'data-testid': 'eco-bind-request-btn', onClick: () => void ask() }, 'Bu hesabı ekonomik sahip olarak bağla')))
            : null);
        return;
    }
    if (loadError || !ov || !board) {
        shell(h('div', { 'data-testid': 'eco-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, `Yüklenemedi: ${refusalText(loadError ?? 'boş cevap')}`));
        return;
    }
    const o = ov;
    const b = board;
    const isOwner = binding?.isOwner ?? false;
    let params = [];
    let wos = [];
    try {
        [params, wos] = await Promise.all([api.costParameters(), api.recentWorkOrders()]);
    }
    catch { /* sections show empty */ }
    const fromIn = h('input', { type: 'date', 'data-testid': 'eco-from', value: state.from });
    const toIn = h('input', { type: 'date', 'data-testid': 'eco-to', value: state.to });
    const metric = (key, label, lines) => h('div', { 'data-testid': 'eco-metric', 'data-key': key, style: 'border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;flex:1 1 150px;min-width:0' }, h('div', { style: 'font-size:12px;color:#64748b' }, label), h('div', { 'data-testid': 'eco-metric-value', style: 'font-weight:700;overflow-wrap:anywhere' }, linesText(lines)));
    const table = (testid, head, rows) => rows.length
        ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': testid, style: 'border-collapse:collapse;font-size:13px' }, h('thead', {}, h('tr', {}, ...head.map((x) => h('th', { style: 'text-align:left;padding:2px 6px' }, x)))), h('tbody', {}, ...rows.map((r) => h('tr', { 'data-testid': `${testid}-row` }, ...r.map((c) => h('td', { style: 'padding:2px 6px' }, c)))))))
        : h('div', { 'data-testid': `${testid}-empty`, style: 'color:#64748b' }, 'Kayıt yok.');
    const proposalCard = (p) => {
        const note = h('input', { type: 'text', 'data-testid': 'eco-note', placeholder: 'Karar notu (zorunlu)', style: 'flex:1 1 160px;min-width:0' });
        const until = h('input', { type: 'date', 'data-testid': 'eco-postpone-until' });
        const decide = async (d) => {
            const pu = d === 'POSTPONED' ? until.value || null : null;
            const chk = canRecordDecision({ proposalExists: true, decision: d, note: note.value, postponeUntil: pu, today: b.today });
            if (!chk.ok)
                return go({ error: refusalText(chk.reason) });
            try {
                await api.decide(p.key, d, note.value.trim(), pu);
                go({ notice: `Karar kaydedildi: ${DECISION_TR[d]}` });
            }
            catch (err) {
                go({ error: refusalText(errText(err)) });
            }
        };
        return h('div', { 'data-testid': 'eco-proposal', 'data-key': p.key, 'data-code': p.code, 'data-severity': p.severity, 'data-open': String(p.open),
            style: `border:1px solid #e2e8f0;border-left:4px solid ${SEVERITY_COLOR[p.severity] ?? '#475569'};border-radius:10px;padding:8px 10px;margin:6px 0;${p.open ? '' : 'opacity:.7'}` }, h('div', {}, h('span', { style: `font-size:11px;font-weight:700;color:${SEVERITY_COLOR[p.severity]}` }, SEVERITY_TR[p.severity] ?? p.severity), ' ', h('b', { style: 'overflow-wrap:anywhere' }, p.titleTr)), h('div', { 'data-testid': 'eco-action', style: 'font-size:13px' }, `Öneri: ${p.actionTr}`), h('div', { 'data-testid': 'eco-evidence', style: 'font-size:12px;color:#475569;overflow-wrap:anywhere' }, 'Kanıt: ', Object.entries(p.evidence).map(([k, v]) => `${EVIDENCE_TR[k] ?? k}: ${evidenceValue(v)}`).join(' · ')), p.latest ? h('div', { 'data-testid': 'eco-latest', style: 'font-size:12px;margin-top:2px' }, `Son karar: ${DECISION_TR[p.latest.decision]}${p.latest.postponedUntil ? ` (${p.latest.postponedUntil} tarihine kadar)` : ''} — ${p.latest.note}`) : null, p.open ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px' }, note, h('button', { type: 'button', 'data-testid': 'eco-accept', onClick: () => void decide('ACCEPTED') }, 'Kabul'), h('button', { type: 'button', 'data-testid': 'eco-reject', onClick: () => void decide('REJECTED') }, 'Ret'), h('label', { style: 'font-size:12px' }, 'Ertele: ', until), h('button', { type: 'button', 'data-testid': 'eco-postpone', onClick: () => void decide('POSTPONED') }, 'Ertele')) : null);
    };
    // 0066: per-threshold record (value, unit, scope, active, previous value, reason, who/when). Owner-only server side.
    let thOverview = null;
    if (api.thresholdOverview) {
        try {
            thOverview = await api.thresholdOverview();
        }
        catch {
            thOverview = null;
        }
    }
    const thresholdRecord = (ov) => {
        const rows = ov.items.map((it) => {
            const val = h('input', { type: 'number', 'data-testid': `eco-th-value-${it.key}`, value: String(it.value), style: 'width:5em', step: 'any' });
            const act = h('input', { type: 'checkbox', 'data-testid': `eco-th-active-${it.key}`, ...(it.active ? { checked: true } : {}) });
            const why = h('input', { type: 'text', 'data-testid': `eco-th-reason-${it.key}`, placeholder: 'Gerekçe (en az 5 karakter)', style: 'flex:1;min-width:140px' });
            const save = async () => {
                try {
                    const r = await api.setThreshold(it.key, Number(val.value), act.checked, why.value);
                    go({ notice: r.changed ? `${it.label} kaydedildi.` : 'Değişiklik yok.' });
                }
                catch (err) {
                    go({ error: refusalText(errText(err)) });
                }
            };
            return h('div', { 'data-testid': 'eco-th-row', 'data-key': it.key, style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0;font-size:13px' }, h('b', { style: 'min-width:11em' }, it.label), val, h('span', {}, `${it.unit} · kapsam ${it.scope}`), h('label', {}, act, ' aktif'), why, h('button', { type: 'button', 'data-testid': `eco-th-save-${it.key}`, onClick: () => void save() }, 'Kaydet'));
        });
        const hist = ov.history.slice(0, 10).map((x) => h('div', { 'data-testid': 'eco-th-history', style: 'font-size:12px' }, `${x.changedAt.slice(0, 16).replace('T', ' ')} · ${x.key}: ${x.previousValue}${x.unit}${x.previousActive ? '' : ' (pasif)'} → ${x.newValue}${x.unit}${x.newActive ? '' : ' (pasif)'} · ${x.reason}`));
        return h('section', { 'data-testid': 'eco-th-record', style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Eşik kaydı (değer · birim · kapsam · aktif/pasif · geçmiş)'), h('div', { style: 'font-size:12px;color:#64748b' }, ov.proposalNote), ...rows, hist.length ? h('div', { style: 'margin-top:6px' }, h('b', { style: 'font-size:13px' }, 'Son değişiklikler'), ...hist) : h('div', { style: 'font-size:12px;color:#64748b' }, 'Henüz değişiklik kaydı yok (başlangıç önerileri geçerli).'));
    };
    const th = o.thresholds;
    const tIn = (testid, v, min, max) => h('input', { type: 'number', 'data-testid': testid, value: String(v), min, max, style: 'width:5em' });
    const tAge = tIn('eco-t-age', th.receivableAgeDays, '1', '365');
    const tDue = tIn('eco-t-due', th.payableDueSoonDays, '1', '90');
    const tPrice = tIn('eco-t-price', th.priceIncreasePct, '0', '500');
    const tScrap = tIn('eco-t-scrap', th.scrapSharePct, '0', '100');
    const saveThresholds = async () => {
        const t = { receivableAgeDays: Number(tAge.value), payableDueSoonDays: Number(tDue.value), priceIncreasePct: Number(tPrice.value), scrapSharePct: Number(tScrap.value) };
        try {
            await api.setThresholds(t);
            go({ notice: 'Eşikler kaydedildi.' });
        }
        catch (err) {
            go({ error: refusalText(errText(err)) });
        }
    };
    // ---- D-013 cost model ----
    const pKind = h('select', { 'data-testid': 'eco-p-kind' }, ...Object.entries(COST_KIND_TR).map(([k, t]) => h('option', { value: k }, t)));
    const pScope = h('input', { type: 'text', 'data-testid': 'eco-p-scope', placeholder: 'Makine kodu / PLANT / EUR/TRY', style: 'width:11em' });
    const pValue = h('input', { type: 'number', 'data-testid': 'eco-p-value', step: 'any', style: 'width:7em' });
    const pCur = h('select', { 'data-testid': 'eco-p-currency' }, h('option', { value: '' }, '—'), ...['TRY', 'EUR', 'USD', 'GBP'].map((c) => h('option', { value: c }, c)));
    const pFrom = h('input', { type: 'date', 'data-testid': 'eco-p-from', value: state.today });
    const pSource = h('input', { type: 'text', 'data-testid': 'eco-p-source', placeholder: 'Kur kaynağı (ör. TCMB)', style: 'width:10em' });
    const pSourceDate = h('input', { type: 'date', 'data-testid': 'eco-p-source-date' });
    const pReason = h('input', { type: 'text', 'data-testid': 'eco-p-reason', placeholder: 'Gerekçe', style: 'flex:1 1 140px;min-width:0' });
    const saveParam = async () => {
        try {
            await api.setCostParameter({ kind: pKind.value, scopeKey: pScope.value.trim(), value: Number(pValue.value), currency: pCur.value || null, validFrom: pFrom.value,
                source: pSource.value.trim() || null, sourceDate: pSourceDate.value || null, reason: pReason.value.trim() });
            go({ notice: 'Parametre kaydedildi (yeni sürüm; eskisi değişmedi).' });
        }
        catch (err) {
            go({ error: refusalText(errText(err)) });
        }
    };
    const woSel = h('select', { 'data-testid': 'eco-wo' }, ...wos.map((w) => h('option', { value: w.id }, `İE ${w.id.slice(0, 8)} · ${w.status} · ${w.createdAt.slice(0, 10)}`)));
    const calcCost = async () => {
        try {
            go({ cost: await api.workOrderCost(woSel.value) });
        }
        catch (err) {
            go({ error: refusalText(errText(err)) });
        }
    };
    const costView = (c) => h('div', { 'data-testid': 'eco-cost', 'data-status': c.status, style: 'border:2px solid #1d4ed8;border-radius:12px;padding:8px 10px;margin:8px 0' }, c.status === 'INCOMPLETE'
        ? h('div', { 'data-testid': 'eco-cost-incomplete', style: 'padding:8px;border-radius:8px;background:#fef3c7;color:#92400e;font-weight:700' }, `TAM MALİYET HESAPLANAMADI — eksik: ${c.missing.map(missingCostText).join(', ')}. Kâr/zarar gösterilmez.`)
        : h('div', { 'data-testid': 'eco-cost-total', style: 'font-weight:700' }, `Tam maliyet: ${NUM.format(c.totalTry)} TRY · birim: ${c.unitCostTry === null ? '—' : NUM.format(c.unitCostTry)} TRY · fire payı: ${c.scrapCostTry === null ? '—' : NUM.format(c.scrapCostTry)} TRY`), c.status === 'COMPLETE' ? h('div', { 'data-testid': 'eco-cost-margin', style: 'font-size:13px' }, c.marginTry === null ? 'Marj: fatura yok veya kuru yok — hesaplanmaz.' : `Marj: ${NUM.format(c.marginTry)} TRY (gelir ${NUM.format(c.revenueTry)} TRY)`) : null, h('div', { style: 'font-size:12px;color:#475569' }, `Çalışma: ${c.runMinutes} dk · sağlam ${c.good} · fire ${c.scrap}`), c.components.length ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'eco-cost-components', style: 'border-collapse:collapse;font-size:12px' }, h('tbody', {}, ...c.components.map((x) => h('tr', { 'data-testid': 'eco-cost-component' }, h('td', { style: 'padding:2px 6px' }, `${COMPONENT_TR[x.component] ?? x.component}${x.machine ? ` ${x.machine}` : ''}`), h('td', { style: 'padding:2px 6px;text-align:right' }, `${NUM.format(x.try)} TRY`)))))) : null, h('details', {}, h('summary', { style: 'font-size:12px' }, 'Hesap kuralları'), ...c.rulesTr.map((r) => h('div', { style: 'font-size:11px;color:#64748b' }, r))));
    // ---- corrective decisions: only the latest decision of a proposal can be corrected, by a NEW record ----
    const latestIds = new Set();
    {
        const seen = new Set();
        for (const x of b.history) {
            if (!seen.has(x.proposalKey)) {
                seen.add(x.proposalKey);
                if (x.id)
                    latestIds.add(x.id);
            }
        }
    }
    const correction = (x) => {
        if (!x.id || !latestIds.has(x.id))
            return null;
        const sel = h('select', { 'data-testid': 'eco-corr-decision' }, ...['ACCEPTED', 'REJECTED', 'POSTPONED'].map((d) => h('option', { value: d }, DECISION_TR[d])));
        const note = h('input', { type: 'text', 'data-testid': 'eco-corr-note', placeholder: 'Düzeltme gerekçesi (en az 10 karakter)', style: 'flex:1 1 160px;min-width:0' });
        const until = h('input', { type: 'date', 'data-testid': 'eco-corr-until' });
        const send = async () => {
            const d = sel.value;
            const pu = d === 'POSTPONED' ? until.value || null : null;
            const chk = canRecordCorrection({ isLatestForProposal: true, decision: d, note: note.value, postponeUntil: pu, today: b.today });
            if (!chk.ok)
                return go({ error: refusalText(chk.reason) });
            try {
                await api.correctDecision(x.id, d, note.value.trim(), pu);
                go({ notice: 'Düzeltici karar kaydedildi; önceki karar olduğu gibi duruyor.' });
            }
            catch (err) {
                go({ error: refusalText(errText(err)) });
            }
        };
        return h('details', { 'data-testid': 'eco-corr' }, h('summary', { style: 'font-size:12px' }, 'Düzelt'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, sel, note, h('label', { style: 'font-size:12px' }, 'Ertele: ', until), h('button', { type: 'button', 'data-testid': 'eco-corr-save', onClick: () => void send() }, 'Düzeltici karar kaydet')));
    };
    const open = b.proposals.filter((p) => p.open);
    const closed = b.proposals.filter((p) => !p.open);
    shell(h('p', { style: 'font-size:12px;color:#555' }, 'Yalnız sahip ve yetkilendirdiği kişiler görür. Para birimleri asla toplanmaz. Sayılar gerçek kayıtlardan gelir.'), state.error ? h('div', { 'data-testid': 'eco-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, state.error) : null, state.notice ? h('div', { 'data-testid': 'eco-notice', style: 'padding:10px;border-radius:8px;background:#dcfce7' }, state.notice) : null, h('div', { 'data-testid': 'eco-not-modelled', style: 'margin:8px 0;padding:8px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:13px' }, `Dönem özetine katılmayan maliyet kalemleri: ${o.notModelled.map((x) => NOT_MODELLED_TR[x] ?? x).join(', ')} (iş emri tam maliyeti aşağıdaki maliyet modelinden). `, ...o.notes.map((n) => h('div', {}, n))), h('section', { 'data-testid': 'eco-board', style: 'margin:10px 0' }, h('h2', { style: 'font-size:17px;margin:6px 0' }, `Karar önerileri (${open.length} açık)`), open.length ? null : h('div', { 'data-testid': 'eco-no-open', style: 'color:#64748b' }, 'Açık öneri yok.'), ...open.map(proposalCard), closed.length ? h('details', { 'data-testid': 'eco-closed' }, h('summary', {}, `Karara bağlanmış (${closed.length})`), ...closed.map(proposalCard)) : null), h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:17px;margin:6px 0' }, 'Dönem'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, fromIn, toIn, h('button', { type: 'button', 'data-testid': 'eco-period-apply', onClick: () => go({ from: fromIn.value, to: toIn.value }) }, 'Göster')), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, metric('revenue', 'Kesilen fatura', o.revenue), metric('collections', 'Tahsilat', o.collections), metric('supplier_invoiced', 'Tedarikçi faturası', o.supplierInvoiced), metric('supplier_paid', 'Tedarikçiye ödeme', o.supplierPaid), metric('material_issued', 'Üretime verilen malzeme', o.materialIssued))), h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Açık alacaklar (fatura yaşına göre — yalnız yaş uyarısı; gerçek gecikme vadeden)'), table('eco-aging', ['Para', 'Yaş', 'Tutar', 'Adet'], o.receivablesAging.map((x) => [x.currency, AGE_BUCKET_TR[x.bucket] ?? x.bucket, NUM.format(x.amount), String(x.count)]))), h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Açık tedarikçi borçları (vadeye göre)'), table('eco-payables', ['Para', 'Vade', 'Tutar', 'Adet'], o.payablesDue.map((x) => [x.currency, DUE_BUCKET_TR[x.bucket] ?? x.bucket, NUM.format(x.amount), String(x.count)]))), h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Ürün bazında malzeme marjı'), table('eco-products', ['Ürün', 'Fatura', 'Malzeme', 'Malzeme marjı', 'Fireye giden'], o.products.map((p) => [p.productCode, linesText(p.invoiced), linesText(p.materialCost), materialMarginText(p.invoiced, p.materialCost), linesText(p.scrapMaterialCost)])), h('div', { style: 'font-size:11px;color:#64748b' }, 'Malzeme marjı = fatura − verilen malzeme (PO fiyatıyla). Fireye giden = malzeme × fire / (sağlam + fire) — dağıtım kuralıdır.')), h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Malzeme fiyat değişimi (son iki sipariş)'), table('eco-prices', ['Malzeme', 'Önceki', 'Son', 'Değişim'], o.priceChanges.map((c) => [c.materialCode, moneyText({ currency: c.currency, amount: c.previous }), moneyText({ currency: c.currency, amount: c.latest }),
        c.previous > 0 ? `%${NUM.format(round2(((c.latest - c.previous) / c.previous) * 100))}` : '—']))), h('section', { 'data-testid': 'eco-thresholds', style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Öneri eşikleri (yalnız sahip değiştirir)'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px' }, h('label', {}, 'Alacak yaşı > ', tAge, ' gün'), h('label', {}, 'Ödeme yaklaşıyor ≤ ', tDue, ' gün'), h('label', {}, 'Fiyat artışı ≥ %', tPrice), h('label', {}, 'Fire payı ≥ %', tScrap), h('button', { type: 'button', 'data-testid': 'eco-t-save', onClick: () => void saveThresholds() }, 'Kaydet'))), thOverview ? thresholdRecord(thOverview) : null, h('section', { 'data-testid': 'eco-cost-model', style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Maliyet modeli (tarihli parametreler)'), params.length
        ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'eco-params', style: 'border-collapse:collapse;font-size:12px' }, h('tbody', {}, ...params.map((x) => h('tr', { 'data-testid': 'eco-param-row' }, h('td', { style: 'padding:2px 6px' }, COST_KIND_TR[x.kind] ?? x.kind), h('td', { style: 'padding:2px 6px' }, x.scopeKey), h('td', { style: 'padding:2px 6px' }, `${NUM.format(x.value)}${x.currency ? ` ${x.currency}` : ' %'}`), h('td', { style: 'padding:2px 6px' }, `${x.validFrom}'den`), h('td', { style: 'padding:2px 6px' }, x.source ? `${x.source} (${x.sourceDate})` : ''))))))
        : h('div', { 'data-testid': 'eco-params-empty', style: 'color:#b45309;font-size:13px' }, 'Hiç maliyet parametresi girilmedi — tam maliyet hesaplanamaz.'), isOwner ? h('div', { 'data-testid': 'eco-param-form', style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;font-size:12px' }, pKind, pScope, pValue, pCur, h('label', {}, 'Geçerlilik: ', pFrom), pSource, h('label', {}, 'Kur tarihi: ', pSourceDate), pReason, h('button', { type: 'button', 'data-testid': 'eco-p-save', onClick: () => void saveParam() }, 'Yeni sürüm kaydet'))
        : h('div', { style: 'font-size:11px;color:#64748b' }, 'Parametreleri yalnız sahip girer.'), h('h3', { style: 'font-size:15px;margin:10px 0 4px' }, 'İş emri tam maliyeti'), wos.length ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, woSel, h('button', { type: 'button', 'data-testid': 'eco-cost-calc', onClick: () => void calcCost() }, 'Hesapla'))
        : h('div', { style: 'color:#64748b' }, 'İş emri yok.'), state.cost ? costView(state.cost) : null), h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px;margin:6px 0' }, 'Karar geçmişi (değiştirilemez)'), b.history.length ? h('div', {}, ...b.history.map((x) => h('div', { 'data-testid': 'eco-history-item', 'data-id': x.id ?? '', style: 'font-size:12px;border-top:1px solid #f1f5f9;padding:3px 0;overflow-wrap:anywhere' }, `${x.decidedAt.slice(0, 10)} · ${x.code} · ${DECISION_TR[x.decision]}${x.postponedUntil ? ` → ${x.postponedUntil}` : ''} — ${x.note}${x.correctsDecisionId ? ' (düzeltme)' : ''}`, correction(x))))
        : h('div', { 'data-testid': 'eco-history-empty', style: 'color:#64748b' }, 'Henüz karar yok.')), isOwner ? ownerUnbind() : null);
    function ownerUnbind() {
        const reason = h('input', { type: 'text', 'data-testid': 'eco-unbind-reason', placeholder: 'Gerekçe (en az 10 karakter)', style: 'flex:1 1 200px;min-width:0' });
        const run = async () => {
            try {
                await api.revokeOwnerBinding(reason.value);
                go({ notice: 'Sahip bağlantısı kaldırıldı. Verdiğiniz bütün ekonomik erişimler de geçersiz oldu.' });
            }
            catch (err) {
                go({ error: refusalText(errText(err)), unbindOpen: true });
            }
        };
        return h('details', { 'data-testid': 'eco-unbind', style: 'margin:14px 0;font-size:13px', ...(state.unbindOpen ? { open: true } : {}) }, h('summary', {}, 'Sahip bağlantısını kaldır'), h('p', { style: 'margin:6px 0;color:#64748b' }, 'Hesap değişikliği gibi durumlar içindir. Kaldırınca ekonomik ekran herkese (size dahil) kapanır ve verdiğiniz erişimler biter; yeniden bağlamak için yeni talep gerekir. Kayıt silinmez, geçmişte kalır.'), state.unbindOpen && state.error ? h('div', { 'data-testid': 'eco-unbind-error', style: 'padding:8px;border-radius:8px;background:#fee2e2;margin-bottom:6px' }, state.error) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, reason, h('button', { type: 'button', 'data-testid': 'eco-unbind-btn', onClick: () => void run() }, 'Kaldır')));
    }
}
