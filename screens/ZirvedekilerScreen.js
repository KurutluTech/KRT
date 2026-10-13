// KMI — Zirvedekiler (Top Performers). Reads the SAME canonical facts as Puantaj and ranks by the V47 final points (packages/domain,
// untouched). A ranking is shown ONLY when every participant of the month is computable — never a ranking from partial data. No bonus /
// pool amount ever appears here. There is no photo storage yet: the profile image slot shows initials (honest placeholder).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { DEFAULT_PUANTAJ_CONFIG } from '../../../../packages/domain/src/puantaj.js';
import { computeMonth } from '../../../../packages/domain/src/puantajMonth.js';
import { errorText, isSetupPending } from '../errorText.js';
import { DS_CSS, initials, setupPending } from '../ds.js';
import { ladderBadgeSvg, LADDER_TIER_NAME } from '../../../../packages/ui/src/badgeLadder.js';
const CSS = DS_CSS + `.kd .zv-top{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.kd .zv-card{position:relative;border:1px solid #1e293b;border-radius:16px;padding:16px;background:linear-gradient(180deg,#12213a,#0b1426);display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.kd .zv-card.r1{border-color:#facc15;box-shadow:0 0 0 1px rgba(250,204,21,.35),0 12px 30px rgba(250,204,21,.08)}.kd .zv-card.r2{border-color:#cbd5e1}.kd .zv-card.r3{border-color:#d97706}
.kd .zv-rank{position:absolute;top:10px;left:12px;font-weight:900;font-size:22px;color:#facc15}.kd .zv-card.r2 .zv-rank{color:#cbd5e1}.kd .zv-card.r3 .zv-rank{color:#f59e0b}
.kd .zv-photo{width:84px;height:84px;border-radius:50%;background:#1e293b;border:2px solid #22d3ee;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#67e8f9}
.kd .zv-name{font-size:18px;font-weight:800;color:#fff}.kd .zv-pts{font-size:30px;font-weight:900;color:#67e8f9}
.kd .zv-nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.kd .zv-nav input{max-width:190px}`;
const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const thisMonth = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shift = (m, d) => { const [y, mo] = m.split('-').map(Number); return thisMonth(new Date(y, mo - 1 + d, 1)); };
async function renderEmployeeView(container, deps) {
    const shell = (...body) => mount(container, h('div', { class: 'kd', 'data-testid': 'zv-root', 'data-view': 'EMPLOYEE' }, h('style', {}, CSS), h('h1', {}, 'Zirvedekiler — Benim başarılarım'), ...body));
    let profile = null;
    let err = null;
    try {
        const pid = deps.badges?.myPersonnelId ? await deps.badges.myPersonnelId() : null;
        if (!pid)
            err = 'Giriş hesabınız bir personel kaydına bağlı değil; başarılarınız gösterilemiyor. Yöneticinize başvurun.';
        else
            profile = await deps.badges.profile(pid);
    }
    catch (e) {
        err = isSetupPending(e) ? 'Kurulum bekleniyor: rozet verileri henüz hazır değil.' : errorText(e);
    }
    const blocked = h('div', { class: 'panel', 'data-testid': 'zv-ranking-blocked', style: 'border-left:4px solid #64748b' }, h('h2', {}, 'Genel başarı sıralaması — BLOCKED'), h('div', { class: 'mut' }, 'Çalışanlara açık, prim ve ücret içermeyen sunucu taraflı güvenli bir görünüm henüz yok. Sıralama istemcide süzülerek gösterilmez (güvenlik sınırı değildir); sunucu görünümü kurulunca bu bölüm açılır.'));
    if (!profile) {
        shell(h('div', { class: 'panel', 'data-testid': 'zv-me-error' }, h('h2', {}, 'Başarılarım'), h('div', {}, err ?? 'Veri okunamadı.')), blocked);
        return;
    }
    const earned = profile.families.map((f) => ({ f, top: [...f.tiers].reverse().find((t) => t.award && !t.award.withdrawn) ?? null, next: f.tiers.find((t) => !t.award) ?? null })).filter((x) => x.top);
    const total = profile.history.filter((x) => !x.withdrawn).length;
    const level = earned.length ? Math.max(...earned.map((x) => x.top.tier)) : 0;
    shell(h('div', { class: 'kpis', 'data-testid': 'zv-me-kpis' }, h('div', { class: 'kpi' }, h('div', { class: 'n', 'data-testid': 'zv-me-count' }, String(total)), h('div', { class: 'l' }, 'KAZANILMIŞ ROZET')), h('div', { class: 'kpi' }, h('div', { class: 'n', style: 'font-size:18px', 'data-testid': 'zv-me-level' }, level ? (LADDER_TIER_NAME[level] ?? `Seviye ${level}`) : 'Henüz rozet yok'), h('div', { class: 'l' }, 'EN YÜKSEK SEVİYE'))), h('div', { class: 'panel', 'data-testid': 'zv-me-badges' }, h('h2', {}, 'Rozetlerim'), ...(earned.length ? earned.map(({ f, top, next }) => {
        const med = h('span', { 'aria-hidden': 'true' });
        med.innerHTML = ladderBadgeSvg(f.track, top.tier, 'EARNED', 48, f.nameTr);
        return h('div', { class: 'item', 'data-testid': 'zv-me-family', 'data-code': f.code }, med, h('div', { class: 'grow' }, h('b', {}, f.nameTr), h('div', { class: 'mut' }, `${LADDER_TIER_NAME[top.tier] ?? 'Seviye ' + top.tier}${next ? ` · sıradaki: ${LADDER_TIER_NAME[next.tier] ?? 'Seviye ' + next.tier}` : ' · son seviye'}`)));
    }) : [h('div', { class: 'empty', 'data-testid': 'zv-me-empty' }, 'Henüz kazanılmış rozet yok. Kriterler ve ilerlemeniz Rozetlerim ekranında.')]), h('a', { class: 'btn ghost', href: '#/rozetlerim', style: 'margin-top:8px', 'data-testid': 'zv-me-link' }, 'Rozetlerim ve gelişim yolu')), blocked);
}
export async function renderZirvedekilerScreen(container, deps, state = {}) {
    if (deps.view === 'EMPLOYEE')
        return renderEmployeeView(container, deps);
    const month = state.month ?? thisMonth();
    const go = (m) => renderZirvedekilerScreen(container, deps, { month: m });
    const picker = h('div', { class: 'zv-nav' }, h('button', { type: 'button', class: 'ghost', 'data-testid': 'zv-prev', onClick: () => go(shift(month, -1)) }, '‹ Önceki'), h('input', { type: 'month', value: month, 'data-testid': 'zv-month', 'aria-label': 'Dönem', onChange: (e) => { const v = e.target.value; if (/^\d{4}-\d{2}$/.test(v))
            void go(v); } }), h('button', { type: 'button', class: 'ghost', 'data-testid': 'zv-next', onClick: () => go(shift(month, 1)) }, 'Sonraki ›'));
    const shell = (...body) => mount(container, h('div', { class: 'kd', 'data-testid': 'zv-root', 'data-view': 'MANAGEMENT' }, h('style', {}, CSS), h('h1', {}, 'Zirvedekiler'), picker, ...body));
    let facts;
    try {
        facts = await deps.facts(month);
    }
    catch (e) {
        if (isSetupPending(e)) {
            shell(setupPending('Zirvedekiler — Migration 0073 gerekli', 'Kurulum bekleniyor — Migration 0073 gerekli. Sıralama, Puantaj verisinden hesaplanır; kurulum yapılana kadar sıralama üretilmez.'));
            return;
        }
        const msg = errorText(e);
        shell(h('div', { class: 'panel', 'data-testid': 'zv-error' }, h('h2', {}, 'Açılamadı'), h('div', {}, msg)));
        return;
    }
    const results = facts.locked && facts.lock ? facts.lock.results : computeMonth(facts.people, DEFAULT_PUANTAJ_CONFIG);
    const incomplete = results.filter((r) => r.status === 'INCOMPLETE').length;
    const ranked = results.filter((r) => r.status === 'COMPUTED' && r.result).sort((a, b) => (b.result.finalPoints - a.result.finalPoints) || a.name.localeCompare(b.name, 'tr'));
    if (results.length === 0 || incomplete > 0 || ranked.length === 0) {
        const why = results.length === 0 ? 'Bu dönem için katılımcı kaydı yok.' : incomplete > 0 ? `${incomplete} kişinin puantaj girdisi eksik; eksik veriyle sıralama yapılmaz.` : 'Hesaplanabilir katılımcı yok.';
        shell(h('div', { class: 'panel', 'data-testid': 'zv-waiting', style: 'border-left:4px solid #d97706' }, h('h2', {}, 'Hesaplama için veri bekleniyor'), h('div', { style: 'font-weight:700;color:#fff' }, why), h('div', { class: 'mut', style: 'margin-top:6px' }, 'Girdileri Puantaj ekranından tamamlayın; sıralama otomatik oluşur.'), h('a', { class: 'btn primary', href: '#/puantaj', style: 'margin-top:10px;align-self:flex-start', 'data-testid': 'zv-to-puantaj' }, 'Puantaj ekranına git')));
        return;
    }
    const top = ranked.slice(0, 3);
    const excluded = results.filter((r) => r.status === 'EXCLUDED').length;
    const byId = new Map(facts.people.map((p) => [p.personnelId, p]));
    const badgeCount = {};
    if (deps.badges)
        await Promise.all(top.map(async (r) => { try {
            const p = await deps.badges.profile(r.personnelId);
            badgeCount[r.personnelId] = p.history.filter((x) => !x.withdrawn).length;
        }
        catch {
            badgeCount[r.personnelId] = null;
        } }));
    const card = (r, i) => {
        const f = byId.get(r.personnelId);
        const bc = badgeCount[r.personnelId];
        return h('div', { class: `zv-card r${i + 1}`, 'data-testid': 'zv-card', 'data-rank': String(i + 1) }, h('div', { class: 'zv-rank' }, String(i + 1)), h('div', { class: 'zv-photo', 'aria-hidden': 'true', title: 'Fotoğraf henüz yüklenmedi' }, initials(r.name)), h('div', { class: 'zv-name' }, r.name), h('div', { class: 'mut' }, `${f?.shiftCode ? 'Vardiya ' + f.shiftCode : 'Vardiya —'} · Sicil ${r.employeeNo ?? '—'}`), h('div', { class: 'zv-pts', 'data-testid': 'zv-points' }, fmt(r.result.finalPoints)), h('div', { class: 'mut' }, 'V47 nihai puan'), f ? h('div', { class: 'mut' }, `İyi parça ${fmt(f.production.good)} · Fire ${fmt(f.production.scrap)} · ${fmt(f.production.minutes / 60)} saat`) : null, h('a', { class: 'pill info', href: `#/rozetlerim?kisi=${encodeURIComponent(r.personnelId)}`, 'data-testid': 'zv-badges' }, bc == null ? 'Rozetler' : `${bc} rozet`));
    };
    shell(h('div', { class: 'zv-top', 'data-testid': 'zv-top' }, ...top.map(card)), h('div', { class: 'panel' }, h('h2', {}, 'Dönem bilgisi'), h('div', { class: 'kpis', 'data-testid': 'zv-sufficiency', style: 'margin-bottom:8px' }, ...[['Katılımcı', results.length], ['Hesaplandı', ranked.length], ['Eksik veri', incomplete], ['Hariç', excluded]].map(([l, n]) => h('div', { class: 'kpi' }, h('div', { class: 'n' }, String(n)), h('div', { class: 'l' }, String(l))))), h('div', { class: 'mut' }, `${month} · ${results.length} katılımcı değerlendirildi · ${facts.locked ? 'Dönem kapatıldı' : 'Dönem açık (anlık hesap)'}`), h('div', { class: 'mut', style: 'margin-top:4px' }, 'Prim tutarları bu ekranda gösterilmez. Hesap: Puantaj ekranındaki V47 kuralı.'), h('a', { class: 'btn ghost', href: '#/puantaj', style: 'margin-top:8px', 'data-testid': 'zv-to-puantaj' }, 'Puantaj & Prim Havuzu')));
}
