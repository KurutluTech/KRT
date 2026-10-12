// KMI NEXT — Rozetlerim (Badge Ladder, matrix item 33, migration 0040). Recognition, not authority:
// a badge never opens a machine. Every tier shows exactly which real records earned it (or what is still
// missing); a family without a data source says so instead of pretending. A newly earned badge gets a
// short celebration (respects prefers-reduced-motion).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { ladderBadgeSvg, LADDER_TIER_NAME } from '../../../../packages/ui/src/badgeLadder.js';
import { METRIC_TR, criterionProgress } from '../../../../packages/domain/src/badges.js';
import { camelKey } from '../../../../packages/domain/src/reports.js';
import { errorText as sharedErrorText } from '../errorText.js';
const CSS = `
.bdg{padding:0 16px;box-sizing:border-box;max-width:100%;color:#e2e8f0}.bdg h1{color:#fff;font-size:20px}.bdg b{color:#fff}.bdg button{min-height:44px;border-radius:10px;border:0;background:#1d4ed8;color:#fff;font-weight:700;padding:0 14px;cursor:pointer}
.bdg .fam{border:1px solid #1e293b;border-radius:14px;padding:12px 14px;margin:10px 0;background:linear-gradient(180deg,#111c2e,#0f172a)}
.bdg .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.bdg .bar{height:8px;border-radius:99px;background:#1e293b;overflow:hidden;flex:1 1 120px;min-width:80px}
.bdg .bar>i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#6366f1)}
.bdg .crit{display:flex;gap:8px;align-items:center;font-size:12px;margin:3px 0}
.bdg .crit span{flex:0 1 auto;min-width:0;overflow-wrap:anywhere}
.cele{position:fixed;inset:0;background:rgba(2,6,23,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:50;color:#fff;text-align:center;overflow:hidden}
.cele .medal{animation:kmiPop 900ms cubic-bezier(.2,1.4,.4,1) both, kmiGlow 1.6s ease-in-out 900ms infinite alternate;filter:drop-shadow(0 0 18px rgba(250,204,21,.55))}
.cele h2{font-size:26px;letter-spacing:.08em;margin:14px 0 4px;animation:kmiUp 600ms 300ms both}
.cele p{margin:0;opacity:.9;animation:kmiUp 600ms 450ms both}
.cele i.cf{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;animation:kmiFall 2.4s linear forwards}
@keyframes kmiPop{0%{transform:scale(.2) rotateY(180deg);opacity:0}100%{transform:scale(1) rotateY(0);opacity:1}}
@keyframes kmiGlow{from{filter:drop-shadow(0 0 10px rgba(250,204,21,.35))}to{filter:drop-shadow(0 0 28px rgba(167,139,250,.8))}}
@keyframes kmiUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
@keyframes kmiFall{to{transform:translateY(110vh) rotate(540deg)}}
@media (prefers-reduced-motion: reduce){.cele .medal,.cele h2,.cele p,.cele i.cf{animation:none}}
`;
const errText = (e) => sharedErrorText(e);
const metricOf = (p, m) => {
    const v = p.metrics[camelKey(m)];
    return v === undefined || v === null ? null : Number(v);
};
export async function renderBadgesScreen(container, api, state = {}) {
    let pid = state.personnelId ?? null;
    let profile = null;
    let loadError = null;
    try {
        if (!pid)
            pid = await api.myPersonnelId();
        if (pid)
            profile = await api.profile(pid);
    }
    catch (e) {
        loadError = errText(e);
    }
    const go = (next) => void renderBadgesScreen(container, api, { personnelId: pid, ...next });
    const familyCard = (p, f) => {
        const next = f.tiers.find((t) => !t.award);
        return h('section', { class: 'fam', 'data-testid': 'bdg-family', 'data-code': f.code }, h('div', { style: 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap' }, h('b', {}, f.nameTr), h('span', { style: 'font-size:12px;color:#94a3b8' }, f.descriptionTr)), h('div', { class: 'row', style: 'margin:8px 0' }, ...f.tiers.map((t) => {
            const st = t.award ? (t.award.withdrawn ? 'WITHDRAWN' : 'EARNED') : 'LOCKED';
            const el = h('span', { 'data-testid': 'bdg-medal', 'data-tier': String(t.tier), 'data-state': st, title: LADDER_TIER_NAME[t.tier] });
            el.innerHTML = ladderBadgeSvg(f.track, t.tier, st, 52, f.nameTr);
            return el;
        })), !f.dataSourceAvailable
            ? h('div', { 'data-testid': 'bdg-no-source', style: 'font-size:12px;color:#fbbf24;font-weight:700' }, 'VERİ KAYNAĞI YOK — KMI bu alanda henüz kayıt tutmuyor; bu rozet şimdilik kazanılamaz.')
            : next
                ? h('div', { 'data-testid': 'bdg-next', 'data-tier': String(next.tier) }, h('div', { style: 'font-size:12px;font-weight:700;margin-bottom:2px' }, `Sıradaki: ${LADDER_TIER_NAME[next.tier]}`), ...next.criteria.map((c) => {
                    const v = metricOf(p, c.metric);
                    const pr = criterionProgress(c, v);
                    return h('div', { class: 'crit', 'data-testid': 'bdg-crit', 'data-metric': c.metric }, h('span', {}, `${METRIC_TR[c.metric]} ${c.op === '>=' ? '≥' : '≤'} ${c.value}`), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(pr.ratio * 100)}%` })), h('span', { 'data-testid': 'bdg-crit-value' }, pr.unknown ? 'VERİ YOK' : String(v)));
                }), next.requiresSkillCategory ? h('div', { style: 'font-size:12px;color:#94a3b8' }, `Ayrıca: doğrulanmış ${next.requiresSkillCategory} yetkinliği ≥ ${next.requiresSkillLevel}`) : null)
                : h('div', { 'data-testid': 'bdg-complete', style: 'font-size:12px;color:#4ade80;font-weight:700' }, 'Tüm basamaklar tamam.'));
    };
    const celebrate = state.celebrate && state.celebrate.length && profile
        ? (() => {
            const a = state.celebrate[0];
            const fam = profile.families.find((f) => f.code === a.familyCode);
            const medal = h('div', { class: 'medal' });
            medal.innerHTML = ladderBadgeSvg(fam?.track ?? 'QUALITY', a.tier, 'EARNED', 150, a.nameTr);
            const colors = ['#facc15', '#22d3ee', '#a78bfa', '#f472b6', '#34d399'];
            const confetti = Array.from({ length: 24 }, (_, i) => h('i', { class: 'cf', style: `left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${(i % 8) * 90}ms` }));
            const overlay = h('div', { class: 'cele', 'data-testid': 'bdg-celebrate', role: 'dialog', 'aria-label': 'Yeni rozet', onClick: () => go({}) }, ...confetti, medal, h('h2', {}, 'YENİ ROZET!'), h('p', { 'data-testid': 'bdg-celebrate-text' }, `${a.nameTr} — ${LADDER_TIER_NAME[a.tier]}`), state.celebrate.length > 1 ? h('p', { style: 'font-size:13px' }, `+${state.celebrate.length - 1} rozet daha`) : null, h('p', { style: 'font-size:12px;margin-top:14px;opacity:.7' }, 'Kapatmak için dokunun'));
            setTimeout(() => { if (overlay.isConnected)
                go({}); }, 4500);
            return overlay;
        })()
        : null;
    const evaluate = async () => {
        if (!pid)
            return;
        try {
            const n = await api.evaluate(pid);
            go(n.length ? { celebrate: n } : { message: 'Yeni rozet yok — sıradaki basamağa ne kaldığı aşağıda.' });
        }
        catch (e) {
            go({ message: errText(e) });
        }
    };
    mount(container, h('div', { class: 'bdg' }, h('style', {}, CSS), h('h1', { 'data-testid': 'bdg-heading' }, 'Rozetlerim'), h('p', { style: 'font-size:12px;color:#94a3b8' }, 'Rozet bir takdirdir, yetki değildir: hiçbir rozet tek başına makine yetkisi vermez. Her basamak gerçek kayıtlarla ölçülür.'), loadError ? h('div', { 'data-testid': 'bdg-error', style: 'padding:10px;border-radius:8px;background:#7f1d1d;color:#fecaca' }, `Yüklenemedi: ${loadError}`) : null, !loadError && !pid ? h('div', { 'data-testid': 'bdg-not-linked', style: 'padding:10px;border-radius:8px;background:#78350f;color:#fde68a' }, 'Giriş hesabınız bir personel kaydına bağlı değil.') : null, state.message ? h('div', { 'data-testid': 'bdg-message', style: 'padding:10px;border-radius:8px;background:#1e3a8a;color:#dbeafe;margin:6px 0' }, state.message) : null, profile ? h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0' }, h('b', { 'data-testid': 'bdg-name' }, profile.name), h('span', { 'data-testid': 'bdg-count', style: 'font-size:12px;color:#94a3b8' }, `Kazanılan: ${profile.history.filter((x) => !x.withdrawn).length}`), h('button', { type: 'button', 'data-testid': 'bdg-evaluate', onClick: () => void evaluate() }, 'Rozetlerimi kontrol et')) : null, ...(profile ? profile.families.map((f) => familyCard(profile, f)) : []), profile && profile.history.length ? h('section', { 'data-testid': 'bdg-history', style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px' }, 'Başarı geçmişi'), ...profile.history.map((x) => h('div', { 'data-testid': 'bdg-history-item', style: 'font-size:12px;border-top:1px solid #f1f5f9;padding:3px 0' }, `${x.awardedAt.slice(0, 10)} · ${profile.families.find((f) => f.code === x.familyCode)?.nameTr ?? x.familyCode} — ${LADDER_TIER_NAME[x.tier]}${x.withdrawn ? ' (geri alındı)' : ''}`))) : null, celebrate));
}
