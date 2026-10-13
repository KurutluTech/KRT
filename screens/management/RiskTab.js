// KMI-MANAGEMENT-001 · Risk ve İyileştirme — risk kaydı (olasılık × etki), sorumlu, durum, gözden geçirme tarihi, aksiyon planı ve sonuçlar; her değişiklik gerekçeli ve geçmişlidir.
import { h } from '../../../../../packages/ui/src/h.js';
import { RISK_BAND_TR, isOverdue, riskBand } from '../../../../../packages/domain/src/managementIntel.js';
import { pill, provenance } from '../../ds.js';
import { kpi, setKpiContext, areaIn, bannerEl, field, fmtDate, fmtDateTime, formBox, guarded, loadTab, needText, selectIn, textIn } from './kit.js';
const BAND_PILL = { KRITIK: 'bad', YUKSEK: 'warn', ORTA: 'info', DUSUK: 'ok' };
const CAT = [['URETIM', 'Üretim'], ['KALITE', 'Kalite'], ['TEDARIK', 'Tedarik'], ['FINANS', 'Finans'], ['INSAN', 'İnsan'], ['GUVENLIK', 'İSG / güvenlik'], ['TESLIMAT', 'Teslimat'], ['BT', 'BT / veri'], ['DIGER', 'Diğer']];
const STATUS_TR = { IDENTIFIED: 'Tanımlandı', MITIGATING: 'Azaltılıyor', ACCEPTED: 'Kabul edildi', CLOSED: 'Kapandı' };
const scale = (testid, v) => selectIn(testid, [1, 2, 3, 4, 5].map((n) => [String(n), String(n)]), String(v));
export async function renderRiskTab(panel, ctx, banner) {
    const redraw = (b) => renderRiskTab(panel, ctx, b);
    const run = guarded(panel, redraw);
    setKpiContext(ctx, new Date(ctx.nowMs).toISOString());
    await loadTab(panel, 'Risk ve İyileştirme', 'rk', async () => ({ reg: await ctx.api.risks(), owners: await ctx.api.owners() }), ({ reg, owners }) => {
        const canWrite = ctx.held.has('RISK_MANAGE');
        const ownerOpts = () => owners.map((o) => [o.id, o.name]);
        const open = reg.risks.filter((r) => r.status !== 'CLOSED');
        const card = (r) => {
            const band = riskBand(r.score);
            const lateReview = isOverdue(r.reviewDate, r.status, reg.today);
            const l = scale('rk-l', r.likelihood);
            const i = scale('rk-i', r.impact);
            const st = selectIn('rk-status', Object.entries(STATUS_TR), r.status);
            const rv = textIn('rk-review', 'Gözden geçirme', 'date');
            rv.value = r.reviewDate ?? '';
            const why = textIn('rk-reason', 'Gerekçe (en az 5 karakter)');
            const aTitle = textIn('rk-act-title', 'Aksiyon başlığı');
            const aOwner = selectIn('rk-act-owner', ownerOpts());
            const aDue = textIn('rk-act-due', 'Vade', 'date');
            return h('div', { class: 'panel', 'data-testid': 'rk-risk', 'data-risk-id': r.id, 'data-band': band, style: 'margin-top:8px' }, h('div', { class: 'head' }, h('b', { class: 'grow' }, r.title), pill(`${RISK_BAND_TR[band]} · ${r.score}`, BAND_PILL[band], 'rk-band'), pill(STATUS_TR[r.status] ?? r.status, r.status === 'CLOSED' ? 'ok' : ''), lateReview ? pill('GÖZDEN GEÇİRME GECİKTİ', 'bad', 'rk-review-late') : null), h('div', { class: 'mut' }, `${CAT.find(([v]) => v === r.category)?.[1] ?? r.category} · olasılık ${r.likelihood} × etki ${r.impact} · sorumlu: ${r.ownerName ?? 'BİLİNMİYOR'} · gözden geçirme: ${fmtDate(r.reviewDate)}${r.description ? ` · ${r.description}` : ''}`), ...r.actions.map((a) => {
                const note = textIn('rk-act-note', 'Sonuç notu (kapatmak için zorunlu)');
                const late = isOverdue(a.dueDate, a.status, reg.today);
                return h('div', { class: 'item', 'data-testid': 'rk-action', 'data-action-id': a.id }, h('div', { class: 'grow' }, h('b', {}, a.title), h('div', { class: 'mut' }, `Sorumlu: ${a.ownerName ?? 'BİLİNMİYOR'} · Vade: ${fmtDate(a.dueDate)}${a.resultNote ? ` · Sonuç: ${a.resultNote}` : ''}`)), pill(a.status === 'DONE' ? 'Tamamlandı' : a.status === 'CANCELLED' ? 'İptal' : a.status === 'IN_PROGRESS' ? 'Devam ediyor' : 'Açık', a.status === 'DONE' ? 'ok' : 'info'), late ? pill('GECİKTİ', 'bad', 'rk-action-late') : null, canWrite && (a.status === 'OPEN' || a.status === 'IN_PROGRESS') ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;flex-basis:100%' }, note, a.status === 'OPEN' ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'rk-act-start', onClick: () => void run(() => ctx.api.setActionStatus(a.id, 'IN_PROGRESS', ''), 'Aksiyon başlatıldı.') }, 'Başlat') : null, h('button', { type: 'button', class: 'okb', 'data-testid': 'rk-act-done', onClick: () => { const bad = needText(note.value, 5, 'Sonuç notu'); if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    } void run(() => ctx.api.setActionStatus(a.id, 'DONE', note.value.trim()), 'Aksiyon tamamlandı.'); } }, 'Tamamla'), h('button', { type: 'button', class: 'danger', 'data-testid': 'rk-act-cancel', onClick: () => { const bad = needText(note.value, 5, 'İptal gerekçesi'); if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    } void run(() => ctx.api.setActionStatus(a.id, 'CANCELLED', note.value.trim()), 'Aksiyon iptal edildi.'); } }, 'İptal')) : null);
            }), r.actions.length === 0 && r.status !== 'CLOSED' ? h('div', { class: 'empty', 'data-testid': 'rk-no-action' }, 'Bu risk için aksiyon planı yok.') : null, canWrite && r.status !== 'CLOSED' ? h('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:8px' }, formBox('Aksiyon ekle', 'rk-act-form', field('Başlık', aTitle), field('Sorumlu', aOwner), field('Vade', aDue), h('button', { type: 'button', class: 'primary', 'data-testid': 'rk-act-save', onClick: () => {
                    const bad = needText(aTitle.value, 3, 'Başlık') ?? (aDue.value ? null : 'Vade zorunlu');
                    if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    }
                    void run(() => ctx.api.createAction({ objectiveId: null, riskId: r.id, title: aTitle.value.trim(), ownerId: aOwner.value, due: aDue.value }), 'Aksiyon eklendi.');
                } }, 'Aksiyon kaydet')), formBox('Yeniden değerlendir', 'rk-reassess-form', field('Olasılık (1-5)', l), field('Etki (1-5)', i), field('Durum', st), field('Gözden geçirme', rv), field('Gerekçe', why), h('button', { type: 'button', class: 'warnb', 'data-testid': 'rk-reassess-save', onClick: () => {
                    const bad = needText(why.value, 5, 'Gerekçe');
                    if (bad) {
                        void redraw({ kind: 'error', text: bad });
                        return;
                    }
                    void run(() => ctx.api.reassessRisk({ id: r.id, likelihood: Number(l.value), impact: Number(i.value), status: st.value, reviewDate: rv.value || null, reason: why.value.trim() }), 'Risk yeniden değerlendirildi (önceki değerler geçmişte saklanır).');
                } }, 'Kaydet'))) : null, r.history.length ? h('details', { 'data-testid': 'rk-history' }, h('summary', { class: 'mut', style: 'cursor:pointer;min-height:36px;display:flex;align-items:center' }, `Geçmiş (${r.history.length})`), ...r.history.map((e) => h('div', { class: 'mut', 'data-testid': 'rk-history-row' }, `${fmtDateTime(e.at)} · ${e.event}${e.reason ? ` · ${e.reason}` : ''}`))) : null);
        };
        const t = textIn('rk-title', 'Risk başlığı');
        const c = selectIn('rk-category', CAT);
        const d = areaIn('rk-desc', 'Açıklama (isteğe bağlı)');
        const l = scale('rk-new-l', 3);
        const i = scale('rk-new-i', 3);
        const o = selectIn('rk-owner', ownerOpts());
        const rv = textIn('rk-new-review', 'Gözden geçirme', 'date');
        return h('div', { class: 'kd', 'data-testid': 'rk-root' }, bannerEl(banner, 'rk-banner'), h('div', { class: 'kpis' }, kpi('Açık risk', String(open.length), 'rk-kpi-open'), kpi('Kritik (≥15)', String(open.filter((r) => r.score >= 15).length), 'rk-kpi-critical'), kpi('Aksiyonsuz açık risk', String(open.filter((r) => r.actions.every((a) => a.status === 'DONE' || a.status === 'CANCELLED')).length), 'rk-kpi-noaction'), kpi('Gözden geçirmesi geçen', String(open.filter((r) => isOverdue(r.reviewDate, r.status, reg.today)).length), 'rk-kpi-late')), h('div', { class: 'panel', 'data-testid': 'rk-list' }, h('h2', {}, `Risk kaydı (${reg.risks.length})`), ...(reg.risks.length ? reg.risks.map(card) : [h('div', { class: 'empty', 'data-testid': 'rk-empty' }, 'Kayıtlı risk yok. "Yeni risk" ile başlayın — sistem risk uydurmaz.')])), canWrite ? formBox('Yeni risk', 'rk-form', field('Başlık', t), field('Kategori', c), field('Olasılık (1-5)', l), field('Etki (1-5)', i), field('Sorumlu', o), field('Gözden geçirme', rv), field('Açıklama', d), h('button', { type: 'button', class: 'primary', 'data-testid': 'rk-save', onClick: () => {
                const bad = needText(t.value, 3, 'Başlık');
                if (bad) {
                    void redraw({ kind: 'error', text: bad });
                    return;
                }
                void run(() => ctx.api.createRisk({ title: t.value.trim(), category: c.value, description: d.value, likelihood: Number(l.value), impact: Number(i.value), ownerId: o.value, reviewDate: rv.value || null }), 'Risk kaydedildi.');
            } }, 'Riski kaydet')) : null, h('div', { class: 'mut' }, 'Skor = olasılık × etki (1-25): ≥15 KRİTİK, ≥10 YÜKSEK, ≥5 ORTA, altı DÜŞÜK. Açık aksiyonu olan risk kapatılamaz.'), provenance('mgmt_risks · mgmt_actions · mgmt_events', fmtDateTime(reg.generatedAt)));
    });
}
