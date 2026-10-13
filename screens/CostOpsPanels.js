// Release 005 §5 — live cost-operations panels (Gider Yönetimi, Maliyet Merkezleri, Dönem Kapanışı & Denetim, Mutabakat, Canlı pano). Real records only (draft 0078/0084): when the DB package is not applied
// every panel says "Kurulum bekleniyor"; an empty ledger says "Kayıt yok" — never a zero total. Writes go through guarded RPCs; the server (economic RLS + ACCOUNTING_MUTATION / owner) is the authority.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { allocatedByCenter, expensesToCsv, importTemplateCsv, monthlyTrend, netByCategory, netByCurrency, reversedIds, unallocatedOf } from '../../../../packages/domain/src/costOps.js';
import { pill, provenance, stateBox } from '../ds.js';
import { errorText } from '../errorText.js';
import { areaIn, bannerEl, field, formBox, guarded, loadTab, needText, selectIn, textIn, fmtDate, fmtDateTime, num, kpi, setKpiContext } from './management/kit.js';
const money = (m) => (Object.keys(m).length ? Object.entries(m).map(([c, v]) => num(v, c, 2)).join(' · ') : 'KAYIT YOK');
const KIND_TR = { ENTRY: 'GİDER', ADJUSTMENT: 'DÜZELTME', REVERSAL: 'İPTAL' };
const monthOf = (iso) => iso.slice(0, 7);
const lastMonths = (today, n) => { const out = []; const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCMonth(x.getUTCMonth() - i);
    out.push(x.toISOString().slice(0, 7));
} return out; };
const defaultDownload = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const mutate = (d) => d.access.actions.includes('ACCOUNTING_MUTATION') && d.access.economics;
const ctxFor = (d) => ({ access: { linked: true, roles: [], actions: d.access.actions, economics: d.access.economics, owner: d.access.owner } });
/* ------------------------------------------------------------------------------------------- Gider Yönetimi */
export async function renderExpensePanel(panel, d, st = { month: d.today.slice(0, 7) }) {
    const again = (b) => renderExpensePanel(panel, d, { ...st, banner: b });
    await loadTab(panel, 'Gider kayıtları', 'co-ex', async () => {
        const [cats, centers, rows, periods] = await Promise.all([d.api.categories(), d.api.centers(), d.api.expenses(st.month, st.month), d.api.periods()]);
        const allocs = await d.api.allocations(rows.map((r) => r.id));
        return { cats, centers, rows, allocs, period: periods.find((p) => p.period === st.month) };
    }, ({ cats, centers, rows, allocs, period }) => {
        setKpiContext(ctxFor(d), new Date(d.nowMs).toISOString());
        const catName = (c) => cats.find((x) => x.code === c)?.nameTr ?? c;
        const centerCode = (id) => (id ? centers.find((c) => c.id === id)?.code ?? 'BİLİNMİYOR' : '');
        const shown = st.category ? rows.filter((r) => r.categoryCode === st.category) : rows;
        const rev = reversedIds(rows);
        const run = guarded(panel, again);
        const canWrite = mutate(d);
        const closed = period?.status === 'CLOSED';
        const month = textIn('co-ex-month', 'Dönem', 'month');
        month.value = st.month;
        month.addEventListener('change', () => { if (month.value)
            void renderExpensePanel(panel, d, { month: month.value }); });
        const f = { cat: selectIn('co-ex-cat', [['', 'Kategori seçin'], ...cats.filter((c) => c.active).map((c) => [c.code, `${c.nameTr}${c.capital ? ' (sermaye)' : ''}`])]), amt: textIn('co-ex-amount', 'Tutar', 'text'), cur: selectIn('co-ex-cur', ['TRY', 'EUR', 'USD', 'GBP'].map((c) => [c, c])),
            s: textIn('co-ex-start', 'Hizmet başı', 'date'), e: textIn('co-ex-end', 'Hizmet sonu', 'date'), doc: textIn('co-ex-doc', 'Belge / fatura no'), desc: textIn('co-ex-desc', 'Açıklama'),
            center: selectIn('co-ex-center', [['', 'Merkez yok'], ...centers.filter((c) => c.active).map((c) => [c.id, `${c.code} · ${c.name}`])]) };
        let requestId = crypto.randomUUID(); // one id per form fill: a double click / retry cannot create two expenses
        const add = () => {
            const a = Number(f.amt.value.trim().replace(/\./g, '').replace(',', '.'));
            const bad = !f.cat.value ? 'Kategori seçin' : !Number.isFinite(a) || a <= 0 ? 'Tutar pozitif bir sayı olmalı' : !f.s.value || !f.e.value ? 'Hizmet dönemi zorunlu' : f.e.value < f.s.value ? 'Hizmet sonu başlangıçtan önce olamaz' : null;
            if (bad) {
                void again({ kind: 'error', text: bad });
                return;
            }
            void run(() => d.api.recordExpense({ category: f.cat.value, amount: a, currency: f.cur.value, start: f.s.value, end: f.e.value, payment: null, tax: 'EXCLUSIVE', centerId: f.center.value || null, documentRef: f.doc.value.trim(), description: f.desc.value.trim() }, requestId), 'Gider kaydedildi (denetim kaydına yazıldı).').then(() => { requestId = crypto.randomUUID(); });
        };
        const exportCsv = async () => {
            try {
                await d.api.logExport(`gider listesi ${st.month}${st.category ? ` / ${st.category}` : ''}`, 'CSV', shown.length);
            }
            catch (e) {
                await again({ kind: 'error', text: `Dışa aktarma denetim kaydı yazılamadı, dosya oluşturulmadı: ${errorText(e)}` });
                return;
            }
            (d.download ?? defaultDownload)(`gider-${st.month}.csv`, expensesToCsv(shown, catName, centerCode));
            await again({ kind: 'info', text: `${shown.length} satır dışa aktarıldı; dışa aktarma denetim kaydına yazıldı.` });
        };
        const card = (x) => {
            const reason = textIn(`co-ex-reason`, 'Gerekçe (en az 5 karakter)');
            const delta = textIn('co-ex-delta', 'Fark (+/−)', 'text');
            const alc = allocs.filter((a) => a.expenseId === x.id);
            const un = unallocatedOf(x, alc, rev);
            const isRev = rev.has(x.id);
            const cSel = selectIn('co-al-center', centers.filter((c) => c.active).map((c) => [c.id, `${c.code} · ${c.name}`]));
            const aAmt = textIn('co-al-amount', 'Tutar');
            const drv = textIn('co-al-driver', 'Dağıtım dayanağı (örn. MANUEL: sayaç okuması)');
            const needReason = () => needText(reason.value, 5, 'Gerekçe');
            return h('div', { class: 'item', 'data-testid': 'co-ex-row', 'data-id': x.id, 'data-kind': x.kind, style: 'align-items:flex-start' }, h('div', { class: 'grow', style: 'min-width:220px' }, h('div', {}, pill(KIND_TR[x.kind], x.kind === 'ENTRY' ? 'info' : x.kind === 'REVERSAL' ? 'bad' : 'warn'), ' ', isRev ? pill('İPTAL EDİLDİ', 'bad', 'co-ex-reversed') : null, ' ', pill(catName(x.categoryCode), '')), h('b', { style: 'display:block;margin-top:4px', 'data-testid': 'co-ex-amt' }, num(x.amount, x.currency, 2)), h('div', { class: 'mut' }, `Hizmet: ${fmtDate(x.serviceStart)} – ${fmtDate(x.serviceEnd)} · Belge: ${x.documentRef ?? 'YOK'} · Merkez: ${centerCode(x.costCenterId) || '—'}`), x.description ? h('div', { class: 'mut' }, x.description) : null, un !== null ? h('div', { class: 'mut', 'data-testid': 'co-ex-unalloc' }, alc.length ? `Dağıtılan: ${num(x.amount - un, x.currency, 2)} · Dağıtılmayan: ${num(un, x.currency, 2)}` : 'Henüz dağıtılmadı (dağıtım sahibin tanımladığı dayanakla elle yapılır)') : null), canWrite && x.kind !== 'REVERSAL' && !isRev ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1;min-width:240px' }, reason, h('button', { type: 'button', class: 'danger', 'data-testid': 'co-ex-reverse', onClick: () => { const b = needReason(); if (b)
                    return void again({ kind: 'error', text: b }); void run(() => d.api.reverseExpense(x.id, reason.value.trim()), 'Gider iptal edildi (ters kayıt eklendi; asıl kayıt silinmedi).'); } }, 'İptal et (ters kayıt)'), delta, h('button', { type: 'button', 'data-testid': 'co-ex-adjust', onClick: () => { const n = Number(delta.value.trim().replace(',', '.')); const b = needReason() ?? (!Number.isFinite(n) || n === 0 ? 'Fark sıfırdan farklı bir sayı olmalı' : null); if (b)
                    return void again({ kind: 'error', text: b }); void run(() => d.api.adjustExpense(x.id, n, reason.value.trim()), 'Düzeltme kaydı eklendi.'); } }, 'Düzeltme ekle'), x.amount > 0 && !closed ? h('details', { style: 'flex-basis:100%' }, h('summary', { class: 'mut', style: 'cursor:pointer;min-height:36px;display:flex;align-items:center' }, 'Maliyet merkezine dağıt (elle)'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, cSel, aAmt, drv, h('button', { type: 'button', class: 'primary', 'data-testid': 'co-al-save', onClick: () => { const n = Number(aAmt.value.trim().replace(',', '.')); const b = needText(drv.value, 5, 'Dağıtım dayanağı') ?? (!Number.isFinite(n) || n <= 0 ? 'Dağıtım tutarı pozitif olmalı' : null); if (b)
                    return void again({ kind: 'error', text: b }); void run(() => d.api.allocate(x.id, [{ costCenterId: cSel.value, amount: n }], drv.value.trim()), 'Dağıtım kaydedildi.'); } }, 'Dağıt'))) : null) : null);
        };
        const totalNet = netByCurrency(shown);
        return h('div', { class: 'kd', 'data-testid': 'co-ex-root' }, bannerEl(st.banner, 'co-ex-banner'), h('div', { class: 'head' }, field('Dönem', month), closed ? pill('DÖNEM KAPALI — yeni gider girilemez; düzeltme/iptal serbest', 'warn', 'co-ex-closed') : pill('Dönem açık', 'ok'), st.category ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'co-ex-clear', onClick: () => void renderExpensePanel(panel, d, { month: st.month }) }, `Süzgeci kaldır (${catName(st.category)})`) : null, h('button', { type: 'button', class: 'ghost', 'data-testid': 'co-ex-export', disabled: shown.length === 0, onClick: () => void exportCsv() }, 'CSV olarak dışa aktar (denetim kaydıyla)'), h('button', { type: 'button', class: 'ghost', 'data-testid': 'co-ex-template', onClick: () => (d.download ?? defaultDownload)('gider-sablon.csv', importTemplateCsv()) }, 'İçe aktarma şablonu (CSV)')), h('div', { class: 'kpis' }, kpi('Net gider (para birimi ayrı)', rows.length ? money(totalNet) : 'KAYIT YOK', 'co-ex-total'), kpi('Kayıt', String(shown.length), 'co-ex-count')), canWrite && !closed ? formBox('Gider ekle', 'co-ex-form', field('Kategori', f.cat), field('Tutar', f.amt), field('Para birimi', f.cur), field('Hizmet başı', f.s), field('Hizmet sonu', f.e), field('Belge no', f.doc), field('Maliyet merkezi', f.center), field('Açıklama', f.desc), h('button', { type: 'button', class: 'primary', 'data-testid': 'co-ex-save', onClick: add }, 'Kaydet')) : (canWrite ? null : h('div', { class: 'mut', 'data-testid': 'co-ex-readonly' }, 'Gider girişi için muhasebe yetkisi ve ekonomik erişim gerekir; bu ekran sizin için salt okunurdur.')), h('div', { class: 'panel', 'data-testid': 'co-ex-list' }, h('h2', {}, `Kayıtlar (${shown.length})`), ...(shown.length ? shown.map(card) : [h('div', { class: 'empty', 'data-testid': 'co-ex-empty' }, 'Bu dönemde gider kaydı yok. (0 TL değil: henüz hiç kayıt girilmemiş.)')])), provenance('cost_expenses · cost_allocations (0078/0084)', fmtDateTime(new Date(d.nowMs).toISOString())));
    });
    void areaIn;
}
/* ------------------------------------------------------------------------------------------- Maliyet Merkezleri */
export async function renderCentersPanel(panel, d, banner) {
    const again = (b) => renderCentersPanel(panel, d, b);
    await loadTab(panel, 'Maliyet merkezleri', 'co-ce', async () => ({ centers: await d.api.centers(), month: d.today.slice(0, 7) }), ({ centers }) => {
        const run = guarded(panel, again);
        const f = { code: textIn('co-ce-code', 'Kod'), name: textIn('co-ce-name', 'Ad'), kind: selectIn('co-ce-kind', [['FACTORY', 'Fabrika'], ['DEPARTMENT', 'Bölüm'], ['WORKSTATION', 'İstasyon']]), parent: selectIn('co-ce-parent', [['', 'Üst merkez yok'], ...centers.map((c) => [c.id, `${c.code} · ${c.name}`])]) };
        const KIND_C = { FACTORY: 'Fabrika', DEPARTMENT: 'Bölüm', MACHINE: 'Makine', WORKSTATION: 'İstasyon' };
        return h('div', { class: 'kd', 'data-testid': 'co-ce-root' }, bannerEl(banner, 'co-ce-banner'), mutate(d) ? formBox('Maliyet merkezi ekle', 'co-ce-form', field('Kod', f.code), field('Ad', f.name), field('Tür', f.kind), field('Üst merkez', f.parent), h('button', { type: 'button', class: 'primary', 'data-testid': 'co-ce-save', onClick: () => { const b = needText(f.code.value, 2, 'Kod') ?? needText(f.name.value, 2, 'Ad'); if (b)
                return void again({ kind: 'error', text: b }); void run(() => d.api.createCenter({ code: f.code.value.trim(), name: f.name.value.trim(), kind: f.kind.value, parentId: f.parent.value || null, machineId: null }), 'Maliyet merkezi kaydedildi.'); } }, 'Kaydet')) : null, h('div', { class: 'panel', 'data-testid': 'co-ce-list' }, h('h2', {}, `Merkezler (${centers.length})`), ...(centers.length ? centers.map((c) => h('div', { class: 'item', 'data-testid': 'co-ce-row' }, h('b', {}, c.code), h('span', { class: 'grow' }, c.name), pill(KIND_C[c.kind] ?? c.kind, 'info'), c.parentId ? h('span', { class: 'mut' }, `üst: ${centers.find((x) => x.id === c.parentId)?.code ?? '?'}`) : null))
            : [h('div', { class: 'empty', 'data-testid': 'co-ce-empty' }, 'Maliyet merkezi tanımlı değil. Makine merkezleri (ayrı varlıklar: 111 ve 113) makine kaydına bağlı olarak sonraki adımda eklenir.')])), h('div', { class: 'mut' }, 'Dağıtım dayanağı (m², makine saati, sayaç…) sahibin politikasıdır; sistem bir dayanak SEÇMEZ. Dağıtım, Gider Yönetimi ekranında elle ve dayanak etiketiyle yapılır.'), provenance('cost_centers (0078/0084)', fmtDateTime(new Date(d.nowMs).toISOString())));
    });
}
/* ------------------------------------------------------------------------------------------- Dönem kapanışı, anlık görüntü, onay bekleyen içe aktarmalar */
export async function renderClosePanel(panel, d, st = { period: d.today.slice(0, 7) }) {
    const again = (b) => renderClosePanel(panel, d, { ...st, banner: b });
    await loadTab(panel, 'Dönem kapanışı', 'co-cl', async () => {
        const [periods, snaps, batches] = await Promise.all([d.api.periods(), d.api.snapshots(st.period), d.api.importBatches()]);
        const verdicts = {};
        for (const s of snaps.slice(0, 5)) {
            try {
                verdicts[s.id] = await d.api.verifySnapshot(s.id);
            }
            catch { /* shown as unverifiable below */ }
        }
        return { periods, snaps, batches, verdicts };
    }, ({ periods, snaps, batches, verdicts }) => {
        const run = guarded(panel, again);
        const cur = periods.find((p) => p.period === st.period);
        const closed = cur?.status === 'CLOSED';
        const per = textIn('co-cl-period', 'Dönem', 'month');
        per.value = st.period;
        per.addEventListener('change', () => { if (per.value)
            void renderClosePanel(panel, d, { period: per.value }); });
        const note = textIn('co-cl-note', 'Gerekçe / not (en az 5 karakter)');
        const need = () => needText(note.value, 5, 'Not');
        return h('div', { class: 'kd', 'data-testid': 'co-cl-root' }, bannerEl(st.banner, 'co-cl-banner'), h('div', { class: 'head' }, field('Dönem', per), closed ? pill(`KAPALI ${cur?.closedAt ? fmtDateTime(cur.closedAt) : ''}`, 'warn', 'co-cl-status') : pill('AÇIK', 'ok', 'co-cl-status')), h('div', { class: 'panel', 'data-testid': 'co-cl-actions' }, h('h2', {}, 'Kapanış işlemleri'), field('Not', note), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' }, h('button', { type: 'button', 'data-testid': 'co-cl-snapshot', disabled: !mutate(d), title: mutate(d) ? '' : 'Muhasebe yetkisi + ekonomik erişim gerekir', onClick: () => { const b = need(); if (b)
                return void again({ kind: 'error', text: b }); void run(() => d.api.takeSnapshot(st.period, note.value.trim()), 'Anlık görüntü alındı (değiştirilemez).'); } }, 'Anlık görüntü al'), h('button', { type: 'button', class: 'danger', 'data-testid': 'co-cl-close', disabled: !d.access.owner || closed, title: d.access.owner ? '' : 'Dönemi yalnız ekonomik sahip kapatır', onClick: () => { const b = need(); if (b)
                return void again({ kind: 'error', text: b }); void run(() => d.api.closePeriod(st.period, note.value.trim()), 'Dönem kapatıldı.'); } }, 'Dönemi kapat (sahip)'), h('button', { type: 'button', 'data-testid': 'co-cl-reopen', disabled: !d.access.owner || !closed, title: d.access.owner ? '' : 'Dönemi yalnız ekonomik sahip yeniden açar', onClick: () => { const b = need(); if (b)
                return void again({ kind: 'error', text: b }); void run(() => d.api.reopenPeriod(st.period, note.value.trim()), 'Dönem yeniden açıldı (önceki kapanış denetim kaydında).'); } }, 'Yeniden aç (sahip)')), h('div', { class: 'mut' }, 'Kapalı dönemde yeni gider girilemez ve maliyet yeniden dağıtılamaz; düzeltme ve iptal ters/ek kayıtla yapılır. Kapanışı geri açmak yalnız sahibin gerekçeli işlemidir.')), h('div', { class: 'panel', 'data-testid': 'co-cl-snaps' }, h('h2', {}, `Anlık görüntüler — ${st.period}`), ...(snaps.length ? snaps.map((s) => {
            const v = verdicts[s.id];
            return h('div', { class: 'item', 'data-testid': 'co-cl-snap', 'data-id': s.id, style: 'align-items:flex-start' }, h('div', { class: 'grow' }, h('b', {}, fmtDateTime(s.takenAt)), h('div', { class: 'mut' }, `${s.expenseCount} kayıt · hesap sürümü ${s.calcVersion} · dönem durumu ${s.periodStatus} · özet ${s.contentHash.slice(0, 8)}`), s.note ? h('div', { class: 'mut' }, s.note) : null, h('div', { class: 'mut' }, s.payload.byCategory.map((c) => `${c.category} ${num(c.amount, c.currency, 2)}`).join(' · ') || '—'), h('div', { class: 'mut' }, `Dağıtılmayan: ${s.payload.unallocated.map((u) => num(u.amount, u.currency, 2)).join(' · ') || 'yok'}`)), v ? (v.unchanged ? pill('Bugünkü veriyle AYNI', 'ok', 'co-cl-verdict') : pill(`DEĞİŞTİ: ${v.laterEntries} sonraki kayıt`, 'warn', 'co-cl-verdict')) : pill('doğrulanamadı', 'unknown', 'co-cl-verdict'));
        })
            : [h('div', { class: 'empty', 'data-testid': 'co-cl-snap-empty' }, 'Bu dönem için anlık görüntü yok.')])), h('div', { class: 'panel', 'data-testid': 'co-cl-imports' }, h('h2', {}, `İçe aktarma partileri (${batches.length})`), ...(batches.length ? batches.map((b) => {
            const bn = textIn('co-im-note', 'Karar notu (en az 5 karakter)');
            return h('div', { class: 'item', 'data-testid': 'co-im-batch', 'data-status': b.status, style: 'align-items:flex-start' }, h('div', { class: 'grow' }, h('b', {}, b.sourceName), h('div', { class: 'mut' }, `${b.rowCount} satır · ${b.okCount} geçerli · ${b.errorCount} hatalı · ${fmtDateTime(b.stagedAt)}`), b.decisionNote ? h('div', { class: 'mut' }, b.decisionNote) : null), pill(b.status === 'STAGED' ? 'ONAY BEKLİYOR' : b.status === 'APPROVED' ? 'ONAYLANDI' : 'REDDEDİLDİ', b.status === 'APPROVED' ? 'ok' : b.status === 'REJECTED' ? 'bad' : 'warn'), b.status === 'STAGED' ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, bn, h('button', { type: 'button', class: 'okb', 'data-testid': 'co-im-approve', disabled: !d.access.owner, title: d.access.owner ? '' : 'Yalnız ekonomik sahip onaylar; hazırlayan kendi partisini onaylayamaz', onClick: () => { const e = needText(bn.value, 5, 'Not'); if (e)
                    return void again({ kind: 'error', text: e }); void run(() => d.api.decideImport(b.id, true, bn.value.trim()), 'Parti onaylandı; yalnız geçerli satırlar gider olarak yazıldı.'); } }, 'Onayla'), h('button', { type: 'button', class: 'danger', 'data-testid': 'co-im-reject', disabled: !d.access.owner, onClick: () => { const e = needText(bn.value, 5, 'Not'); if (e)
                    return void again({ kind: 'error', text: e }); void run(() => d.api.decideImport(b.id, false, bn.value.trim()), 'Parti reddedildi; hiçbir gider yazılmadı.'); } }, 'Reddet')) : null);
        }) : [h('div', { class: 'empty', 'data-testid': 'co-im-empty' }, 'Hazırlanmış içe aktarma partisi yok.')])), provenance('cost_periods · cost_snapshots · cost_import_batches', fmtDateTime(new Date(d.nowMs).toISOString())));
    });
}
/* ------------------------------------------------------------------------------------------- Mutabakat */
export async function renderReconPanel(panel, d, period = d.today.slice(0, 7)) {
    await loadTab(panel, 'Muhasebe mutabakatı', 'co-rc', () => d.api.reconciliation(period), (r) => {
        const per = textIn('co-rc-period', 'Dönem', 'month');
        per.value = period;
        per.addEventListener('change', () => { if (per.value)
            void renderReconPanel(panel, d, per.value); });
        const none = r.matchedDifferent.length + r.expenseWithoutInvoice.length + r.invoiceWithoutExpense.length === 0 && r.matchedEqual === 0;
        const sec = (title, tid, rows, empty) => h('div', { class: 'panel', 'data-testid': tid }, h('h2', {}, `${title} (${rows.length})`), ...(rows.length ? rows : [h('div', { class: 'empty' }, empty)]));
        return h('div', { class: 'kd', 'data-testid': 'co-rc-root' }, h('div', { class: 'head' }, field('Dönem', per)), none ? stateBox('empty', 'Bu dönemde karşılaştırılacak gider/fatura kaydı yok', 'Mutabakat kayıt olmadan "eşit" sayılmaz.', 'co-rc-empty') : null, h('div', { class: 'kpis' }, kpi('Eşleşen ve eşit', String(r.matchedEqual), 'co-rc-equal'), kpi('Eşleşen, tutar farklı', String(r.matchedDifferent.length), 'co-rc-diff'), kpi('Faturasız gider', String(r.expenseWithoutInvoice.length), 'co-rc-noinv'), kpi('Gideri olmayan fatura', String(r.invoiceWithoutExpense.length), 'co-rc-noexp')), sec('Tutar farkı olanlar', 'co-rc-different', r.matchedDifferent.map((x) => h('div', { class: 'item', 'data-testid': 'co-rc-diff-row' }, h('b', {}, x.documentRef), h('span', { class: 'grow mut' }, `Gider ${num(x.expenseAmount, x.currency, 2)} · Fatura ${num(x.invoiceAmount, x.currency, 2)}`), pill(`Fark ${num(x.difference, x.currency, 2)}`, 'warn'), h('a', { href: '#/tedarikci-fatura' }, 'Faturayı aç'))), 'Tutar farkı yok.'), sec('Faturası bulunamayan giderler', 'co-rc-expenses', r.expenseWithoutInvoice.map((x) => h('div', { class: 'item', 'data-testid': 'co-rc-noinv-row' }, h('b', {}, x.documentRef), h('span', { class: 'grow mut' }, num(x.amount, x.currency, 2)), pill('Faturasız', 'warn'))), 'Her gider bir faturayla eşleşti.'), sec('Gideri girilmemiş faturalar', 'co-rc-invoices', r.invoiceWithoutExpense.map((x) => h('div', { class: 'item', 'data-testid': 'co-rc-noexp-row' }, h('b', {}, x.documentRef), h('span', { class: 'grow mut' }, num(x.amount, x.currency, 2)), pill('Gider yok', 'warn'), h('a', { href: '#/tedarikci-fatura' }, 'Faturayı aç'))), 'Her fatura bir giderle eşleşti.'), h('div', { class: 'mut', 'data-testid': 'co-rc-note' }, `${r.note} Belge numarası olmayan gider: ${r.expensesWithoutDocumentRef}.`), provenance('cost_reconciliation (supplier_invoices ↔ cost_expenses)', fmtDateTime(new Date(d.nowMs).toISOString())));
    });
}
/* ------------------------------------------------------------------------------------------- Canlı pano (CI-108/109): her çubuk kaynak listesine iner */
export async function renderLiveBoard(panel, d) {
    const months = lastMonths(d.today, 6);
    await loadTab(panel, 'Fabrika ekonomisi panosu', 'co-lv', async () => {
        const [cats, centers, rows] = await Promise.all([d.api.categories(), d.api.centers(), d.api.expenses(months[0], months[months.length - 1])]);
        const allocs = await d.api.allocations(rows.map((r) => r.id));
        let recon = null;
        let reconErr = null;
        try {
            recon = await d.api.reconciliation(d.today.slice(0, 7));
        }
        catch (e) {
            reconErr = errorText(e);
        }
        return { cats, centers, rows, allocs, recon, reconErr };
    }, ({ cats, centers, rows, allocs, recon, reconErr }) => {
        setKpiContext(ctxFor(d), new Date(d.nowMs).toISOString());
        const cur = rows.filter((r) => monthOf(r.serviceStart) === months[months.length - 1]);
        const trend = monthlyTrend(rows, months);
        const byCat = netByCategory(cur);
        const centerRows = allocatedByCenter(allocs, (id) => rows.find((r) => r.id === id)?.currency);
        const rev = reversedIds(rows);
        const unalloc = {};
        for (const r of cur) {
            const u = unallocatedOf(r, allocs, rev);
            if (u !== null && u > 0)
                unalloc[r.currency] = Math.round(((unalloc[r.currency] ?? 0) + u) * 100) / 100;
        }
        const catName = (c) => cats.find((x) => x.code === c)?.nameTr ?? c;
        const centerName = (id) => centers.find((c) => c.id === id)?.code ?? 'BİLİNMİYOR';
        const maxTry = Math.max(1, ...byCat.map((c) => Math.abs(c.amount)));
        const bar = (label, value, pct, tid, onClick) => h('div', { class: 'item', 'data-testid': tid, role: onClick ? 'button' : undefined, tabindex: onClick ? '0' : undefined, style: onClick ? 'cursor:pointer' : '', onClick }, h('span', { style: 'width:150px' }, label), h('div', { class: 'bar grow' }, h('i', { style: `width:${Math.max(2, Math.min(100, pct))}%` })), h('b', {}, value));
        return h('div', { class: 'kd', 'data-testid': 'co-lv-root' }, h('div', { class: 'kpis' }, kpi('Bu ay net gider', cur.length ? money(netByCurrency(cur)) : 'KAYIT YOK', 'co-lv-month'), kpi('Dağıtılmayan', cur.length ? money(unalloc) : 'KAYIT YOK', 'co-lv-unalloc'), kpi('Mutabakat farkı', recon ? String(recon.matchedDifferent.length + recon.expenseWithoutInvoice.length + recon.invoiceWithoutExpense.length) : 'OKUNAMADI', 'co-lv-recon')), reconErr ? stateBox('error', 'Mutabakat okunamadı', reconErr, 'co-lv-recon-error') : null, h('div', { class: 'panel', 'data-testid': 'co-lv-trend' }, h('h2', {}, 'Son 6 ay (hizmet dönemine göre)'), ...months.map((m) => { const v = trend.byMonth[m]; return h('div', { class: 'item', 'data-testid': 'co-lv-trend-row', 'data-month': m }, h('b', { style: 'width:80px' }, m), h('span', { class: 'grow' }, v ? money(v) : 'KAYIT YOK'), v ? h('a', { href: '#/maliyet?sekme=expense', 'data-testid': 'co-lv-trend-drill', onClick: () => d.openTab?.('expense') }, 'Kayıtlar →') : pill('veri yok', 'unknown')); })), h('div', { class: 'panel', 'data-testid': 'co-lv-cat' }, h('h2', {}, 'Bu ay kategoriye göre (para birimi ayrı)'), ...(byCat.length ? byCat.map((c) => bar(`${catName(c.category)} (${c.currency})`, num(c.amount, c.currency, 2), (Math.abs(c.amount) / maxTry) * 100, 'co-lv-cat-row', () => d.openTab?.('expense', { category: c.category }))) : [h('div', { class: 'empty' }, 'Bu ay gider kaydı yok.')])), h('div', { class: 'panel', 'data-testid': 'co-lv-center' }, h('h2', {}, 'Maliyet merkezine dağıtılan (elle dağıtımlar)'), ...(centerRows.length ? centerRows.map((c) => bar(`${centerName(c.costCenterId)} (${c.currency})`, num(c.amount, c.currency, 2), 100, 'co-lv-center-row')) : [h('div', { class: 'empty' }, 'Dağıtım yapılmamış; dağıtım dayanağı sahibin politikasını bekler (VERİ GEREKLİ).')])), h('div', { class: 'mut' }, 'Her çubuğa tıklamak ilgili kayıt listesini açar. Tutarlar yalnız kayıtlı giderlerdir: eksik kayıt "0" gösterilmez, kur çevrimi yapılmaz, canlı üretim maliyeti için değerleme/işçilik/dağıtım politikası gerekir.'), provenance('cost_expenses · cost_allocations · cost_reconciliation', fmtDateTime(new Date(d.nowMs).toISOString())));
    });
    void mount;
    void h;
}
