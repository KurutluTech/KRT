// KMI — Puantaj & Prim Havuzu (yönetici). Hesap V47 portudur (packages/domain); bu ekran girdileri toplar, eksikleri adıyla gösterir ve
// ASLA eksik veriden puan/prim üretmez. Havuz tutarı ekonomik veridir (yalnız ekonomik yetkili görür/girer). Dönem kapanışı geri alınamaz.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { DEFAULT_PUANTAJ_CONFIG } from '../../../../packages/domain/src/puantaj.js';
import { computeMonth, distributePool, DERIVATION_RULE_TR, MULTI_MACHINE_NOT_APPLIED_TR } from '../../../../packages/domain/src/puantajMonth.js';
import { errorText, isSetupPending } from '../errorText.js';
import { setupPending } from '../ds.js';
const CSS = `.pz{display:flex;flex-direction:column;gap:14px}.pz h1{font-size:20px;margin:0}.pz h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:0 0 8px}
.pz .panel{background:linear-gradient(180deg,#111c2e,#0f172a);border:1px solid #1e293b;border-radius:14px;padding:14px;min-width:0}
.pz .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.pz .kpi{border:1px solid #1e293b;border-radius:12px;padding:10px;background:rgba(2,6,23,.45)}
.pz .kpi .n{font-size:24px;font-weight:800}.pz .kpi .l{font-size:11px;color:#94a3b8}
.pz .pill{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:#1e293b;color:#e6edf7;white-space:nowrap}.pz .pill.ok{background:#14532d;color:#bbf7d0}.pz .pill.warn{background:#78350f;color:#fde68a}.pz .pill.bad{background:#7f1d1d;color:#fecaca}.pz .pill.info{background:#1e3a8a;color:#dbeafe}
.pz .person{border-top:1px solid #1e293b;padding:10px 0}.pz .person:first-of-type{border-top:0}.pz .prow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pz .grow{flex:1;min-width:140px}.pz .pts{font-size:20px;font-weight:800;min-width:70px;text-align:right}.pz .mut{color:#94a3b8;font-size:12px}
.pz .form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:10px}.pz label{font-size:12px;color:#cbd5e1;display:flex;flex-direction:column;gap:4px}
.pz input,.pz select{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;padding:0 10px;box-sizing:border-box;width:100%}
.pz button{min-height:44px;font-size:15px;font-weight:700;border-radius:10px;border:0;padding:0 14px;cursor:pointer}.pz .primary{background:#1d4ed8;color:#fff}.pz .ghost{background:#1e293b;color:#e2e8f0}.pz .danger{background:#7f1d1d;color:#fff}
.pz .banner{padding:10px 14px;border-radius:10px;font-weight:700}.pz .banner.error{background:#7f1d1d;color:#fecaca}.pz .banner.info{background:#14532d;color:#bbf7d0}.pz .note{font-size:12px;color:#94a3b8;margin:4px 0 0}`;
const STATUS = { COMPUTED: ['Hesaplandı', 'ok'], EXCLUDED: ['Hariç', 'info'], INCOMPLETE: ['EKSİK VERİ', 'warn'] };
const CARE = [['', '— girilmedi —'], ['0', 'Uygun değil (0)'], ['1', 'Normal (1.00)'], ['1.05', 'Temiz (1.05)'], ['1.2', 'Çok temiz (1.20)']];
const RANK = [['', 'Yok'], ['FIRST_TIME_NO1', 'İlk kez 1. (1.25)'], ['TOP3_STREAK', 'Üst üste ilk 3 (1.20)']];
const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const money = (n) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY`;
export const thisMonth = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export async function renderPuantajScreen(container, api, state = {}) {
    const month = state.month ?? thisMonth();
    const go = (s) => renderPuantajScreen(container, api, { month, ...s });
    let facts;
    try {
        facts = await api.facts(month);
    }
    catch (e) {
        mount(container, h('div', { class: 'pz', 'data-testid': 'pz-root' }, h('style', {}, CSS), isSetupPending(e) ? setupPending('Puantaj ve Prim Havuzu') : h('div', { class: 'panel', 'data-testid': 'pz-error' }, `Yüklenemedi: ${errorText(e)}`)));
        return;
    }
    let busy = false;
    const act = async (fn, ok, open) => {
        if (busy)
            return;
        busy = true;
        container.querySelectorAll('.pz button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ banner: { kind: 'info', text: ok }, open: open ?? null });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) }, open: open ?? null });
        }
    };
    const locked = facts.locked && facts.lock;
    const results = locked ? facts.lock.results : computeMonth(facts.people, DEFAULT_PUANTAJ_CONFIG);
    const byId = new Map(facts.people.map((p) => [p.personnelId, p]));
    const count = (s) => results.filter((r) => r.status === s).length;
    const totalPoints = results.reduce((s, r) => s + (r.status === 'COMPUTED' ? r.result?.finalPoints ?? 0 : 0), 0);
    const dist = locked ? null : distributePool(facts.poolVisible ? facts.poolAmount : null, results);
    const shareOf = (id) => (locked ? facts.lock.distribution : dist && dist.ok ? dist.rows : null)?.find((r) => r.personnelId === id);
    const poolLabel = !facts.poolVisible ? 'Ekonomik yetki gerekli' : facts.poolAmount == null ? 'Girilmedi' : money(facts.poolAmount);
    const kpis = h('div', { class: 'kpis', 'data-testid': 'pz-kpis' }, ...[['Katılımcı', String(results.length), 'pz-k-total'], ['Hesaplandı', String(count('COMPUTED')), 'pz-k-computed'], ['Eksik veri', String(count('INCOMPLETE')), 'pz-k-incomplete'],
        ['Hariç', String(count('EXCLUDED')), 'pz-k-excluded'], ['Toplam puan', count('INCOMPLETE') > 0 ? 'UNKNOWN' : fmt(totalPoints), 'pz-k-points']]
        .map(([l, n, t]) => h('div', { class: 'kpi', 'data-testid': t }, h('div', { class: 'n' }, n), h('div', { class: 'l' }, l))), h('div', { class: 'kpi', 'data-testid': 'pz-k-pool' }, h('div', { class: 'n', style: 'font-size:16px' }, poolLabel), h('div', { class: 'l' }, 'Aylık prim havuzu')));
    const form = (r, f) => {
        const m = f.manual;
        const abs = h('input', { type: 'number', min: '0', max: '31', step: '0.5', value: m?.absenceDays != null ? String(m.absenceDays) : '', 'data-testid': 'pz-abs' });
        const care = h('select', { 'data-testid': 'pz-care' }, ...CARE.map(([v, t]) => h('option', { value: v, selected: (m?.careFactor != null ? String(m.careFactor) : '') === v ? 'selected' : undefined }, t)));
        const adj = h('input', { type: 'number', min: '-50', max: '50', step: '1', value: m?.managementAdjustmentPercent != null ? String(m.managementAdjustmentPercent) : '', placeholder: '0', 'data-testid': 'pz-adj' });
        const rank = h('select', { 'data-testid': 'pz-rank' }, ...RANK.map(([v, t]) => h('option', { value: v, selected: (m?.rankKind && m.rankKind !== 'NONE' ? m.rankKind : '') === v ? 'selected' : undefined }, t)));
        const win = h('input', { type: 'checkbox', checked: m?.isWinningShift ? 'checked' : undefined, 'data-testid': 'pz-win', style: 'min-height:24px;width:24px' });
        const exc = h('input', { type: 'checkbox', checked: m?.isExcluded ? 'checked' : undefined, 'data-testid': 'pz-exc', style: 'min-height:24px;width:24px' });
        const why = h('input', { type: 'text', placeholder: 'Gerekçe / kanıt (zorunlu, en az 5 karakter)', 'data-testid': 'pz-reason' });
        return h('div', { 'data-testid': 'pz-form' }, h('div', { class: 'form' }, h('label', {}, 'Devamsızlık (gün)', abs), h('label', {}, 'Makine teslim temizliği', care), h('label', {}, 'Yönetici değerlendirmesi (%, ±50)', adj), h('label', {}, 'Sıralama', rank), h('label', {}, 'Kazanan vardiya (1.20)', win), h('label', {}, 'Bu ay hariç tut', exc), h('label', { style: 'grid-column:1/-1' }, 'Gerekçe', why)), h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pz-save', onClick: () => {
                const reason = why.value.trim();
                if (reason.length < 5) {
                    void go({ banner: { kind: 'error', text: 'Gerekçe zorunlu (en az 5 karakter).' }, open: f.personnelId });
                    return;
                }
                const patch = {
                    absence_days: abs.value === '' ? null : Number(abs.value), care_factor: care.value === '' ? null : Number(care.value),
                    management_adjustment_percent: adj.value === '' ? null : Number(adj.value), rank_kind: rank.value === '' ? 'NONE' : rank.value,
                    is_winning_shift: win.checked, is_excluded: exc.checked,
                };
                void act(() => api.setInput(month, f.personnelId, patch, reason), 'Girdi kaydedildi.', f.personnelId);
            } }, 'Kaydet')));
    };
    const personRow = (r) => {
        const f = byId.get(r.personnelId);
        const open = state.open === r.personnelId;
        const [stLabel, stCls] = STATUS[r.status] ?? [r.status, ''];
        const share = shareOf(r.personnelId);
        return h('div', { class: 'person', 'data-testid': 'pz-person', 'data-id': r.personnelId, 'data-status': r.status }, h('div', { class: 'prow' }, h('div', { class: 'grow' }, h('strong', {}, r.name), h('div', { class: 'mut' }, `${r.employeeNo ? `sicil ${r.employeeNo} · ` : ''}${r.department}`)), h('span', { class: `pill ${stCls}`, 'data-testid': 'pz-status' }, stLabel), r.multiMachineLevel ? h('span', { class: 'pill', title: MULTI_MACHINE_NOT_APPLIED_TR, 'data-testid': 'pz-mm' }, `${r.multiMachineLevel} makine yetkisi · katsayıya katılmaz`) : null, h('div', { class: 'pts', 'data-testid': 'pz-points' }, r.status === 'COMPUTED' ? fmt(r.result.finalPoints) : r.status === 'EXCLUDED' ? '—' : 'UNKNOWN'), share && facts.poolVisible ? h('span', { class: 'pill ok', 'data-testid': 'pz-bonus' }, money(share.bonus)) : null, !locked && f ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'pz-toggle', onClick: () => void go({ open: open ? null : r.personnelId }) }, open ? 'Kapat' : 'Girdiler') : null), r.missing.length ? h('div', { class: 'note', 'data-testid': 'pz-missing' }, 'Eksik: ' + r.missing.join(' · ')) : null, r.result?.exclusionReason ? h('div', { class: 'note' }, `Hariç nedeni: ${{ BONUS_POOL_ONLY_PERSON: 'yalnız havuz sahibi', MONTHLY_EXCLUSION: 'aylık hariç tutma', ABSENCE_DISQUALIFIED: '5+ gün devamsızlık' }[r.result.exclusionReason] ?? r.result.exclusionReason}`) : null, r.notes.length ? h('div', { class: 'note' }, r.notes.join(' ')) : null, f && r.status !== 'EXCLUDED' && !locked ? h('div', { class: 'note' }, `Üretim: ${f.production.operations} operasyon · ${fmt(f.production.good)} iyi / ${fmt(f.production.scrap)} hurda · ${fmt(f.production.minutes)} dk · ${f.skillCount} yetkinlik · kişisel katsayı ${f.personalMultiplier}`) : null, open && f && !locked ? form(r, f) : null);
    };
    const poolIn = h('input', { type: 'number', min: '0', step: '0.01', placeholder: 'Havuz tutarı (TRY)', 'data-testid': 'pz-pool-amount' });
    const poolWhy = h('input', { type: 'text', placeholder: 'Gerekçe (örn. Ekim karı payı)', 'data-testid': 'pz-pool-reason' });
    const poolPanel = !facts.poolVisible
        ? h('div', { class: 'note', 'data-testid': 'pz-pool-locked' }, 'Havuz tutarı ve kişi bazlı prim tutarları ekonomik veridir; yalnız sahibin açıkça yetkilendirdiği kişiler görür. Puanlar bu ekranda görünür.')
        : locked ? h('div', { class: 'note' }, 'Dönem kapalı; havuz değiştirilemez.')
            : h('div', {}, h('div', { class: 'form' }, h('label', {}, 'Aylık prim havuzu', poolIn), h('label', {}, 'Gerekçe', poolWhy)), h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'primary', 'data-testid': 'pz-pool-save', onClick: () => {
                    const amount = Number(poolIn.value);
                    const reason = poolWhy.value.trim();
                    if (poolIn.value === '' || !(amount >= 0) || reason.length < 5) {
                        void go({ banner: { kind: 'error', text: 'Tutar ve gerekçe (en az 5 karakter) gerekli.' } });
                        return;
                    }
                    void act(() => api.setPool(month, amount, reason), 'Havuz tutarı kaydedildi.');
                } }, 'Havuzu kaydet')));
    const distPanel = locked
        ? h('div', { class: 'note', 'data-testid': 'pz-dist' }, facts.lock.distribution ? `Kapanışta dağıtım dondurulmuştur (${facts.lock.distribution.length} kişi).` : 'Kapanışta prim dağıtılmadı (eksik veri veya havuz yok).')
        : h('div', { 'data-testid': 'pz-dist' }, dist && dist.ok
            ? h('div', { class: 'note' }, `Dağıtım hazır: ${dist.rows.length} katılımcı · toplam ${money(dist.rows.reduce((s, r) => s + r.bonus, 0))} (toplam puan ${fmt(totalPoints)}).`)
            : h('div', { class: 'banner error', 'data-testid': 'pz-dist-refused' }, dist ? `DAĞITIM YAPILAMAZ — ${dist.detail}` : ''));
    const canClose = !locked;
    const closeBtn = canClose ? h('button', { type: 'button', class: 'danger', 'data-testid': 'pz-close', onClick: () => {
            if (!container.querySelector('[data-testid="pz-close-confirm"]')) {
                const ok = h('div', { class: 'banner error', 'data-testid': 'pz-close-confirm' }, 'Dönem kapatılırsa girdiler, yapılandırma ve sonuçlar değiştirilemez şekilde dondurulur. Emin misiniz?', h('div', { style: 'margin-top:8px' }, h('button', { type: 'button', class: 'danger', 'data-testid': 'pz-close-yes', onClick: () => {
                        const distribution = dist && dist.ok ? dist.rows.map((r) => ({ personnelId: r.personnelId, points: r.points, bonus: r.bonus })) : null;
                        void act(() => api.close(month, DEFAULT_PUANTAJ_CONFIG, results, distribution), 'Dönem kapatıldı.');
                    } }, 'Evet, kapat')));
                container.querySelector('[data-testid="pz-close-slot"]').appendChild(ok);
            }
        } }, 'Dönemi kapat') : null;
    const monthIn = h('input', { type: 'month', value: month, 'data-testid': 'pz-month', style: 'max-width:200px' });
    monthIn.addEventListener('change', () => { if (/^\d{4}-\d{2}$/.test(monthIn.value))
        void go({ month: monthIn.value }); });
    mount(container, h('div', { class: 'pz', 'data-testid': 'pz-root' }, h('style', {}, CSS), h('div', { class: 'prow' }, h('h1', { class: 'grow' }, 'Puantaj & Prim Havuzu'), monthIn, h('span', { class: `pill ${locked ? 'info' : 'warn'}`, 'data-testid': 'pz-period' }, locked ? `KAPALI · ${new Date(facts.lock.lockedAt).toLocaleDateString('tr-TR')}` : 'AÇIK')), state.banner ? h('div', { class: `banner ${state.banner.kind}`, 'data-testid': 'pz-banner' }, state.banner.text) : null, kpis, h('section', { class: 'panel' }, h('h2', {}, 'Hesap kuralı'), h('div', { class: 'note', 'data-testid': 'pz-rule' }, 'V47 formülü değişmeden uygulanır. ' + DERIVATION_RULE_TR), h('div', { class: 'note', 'data-testid': 'pz-mm-note' }, MULTI_MACHINE_NOT_APPLIED_TR)), h('section', { class: 'panel' }, h('h2', {}, `Personel performansı (${results.length})`), results.length ? h('div', {}, ...results.map(personRow)) : h('div', { class: 'note' }, 'Aktif personel kaydı yok.')), h('section', { class: 'panel' }, h('h2', {}, 'Prim havuzu ve dağıtım'), poolPanel, distPanel), h('section', { class: 'panel' }, h('h2', {}, 'Dönem kapanışı'), h('div', { class: 'note' }, 'Kapanış girdileri, yapılandırmayı ve sonuçları değiştirilemez olarak saklar; kapalı ayda girdi ve havuz değişmez. Eksik veri varsa prim dağıtılmaz.'), h('div', { 'data-testid': 'pz-close-slot', style: 'margin-top:10px' }, closeBtn))));
}
