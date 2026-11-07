// KMI NEXT — İK Merkezi (çalışan görünümü + yönetim görünümü). Veri yalnız hrApi RPC'lerinden gelir; hata metni sunucudan aynen (errorText) gösterilir.
// Çalışan sekmeleri: Pasaportum, Puantajım, Performansım & Prim, Zirvedekiler. Yönetim sekmeleri yalnız yetkiliye görünür (sunucu yine kontrol eder).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { learnBody } from './HrLearnScreen.js';
const CSS = `.hrh{padding:0 16px;box-sizing:border-box;max-width:100%;color:#e2e8f0}.hrh h1{color:#fff;font-size:20px}.hrh .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.hrh button{min-height:44px;border-radius:10px;border:0;background:#1e293b;color:#e2e8f0;font-weight:700;padding:0 14px}.hrh button.on{background:#1d4ed8;color:#fff}.hrh .card{border:1px solid #1e293b;border-radius:14px;padding:12px 14px;margin:10px 0;background:#0f172a;overflow-wrap:anywhere}.hrh table{width:100%;border-collapse:collapse;font-size:13px}.hrh td,.hrh th{padding:6px 4px;border-bottom:1px solid #1e293b;text-align:left}.hrh .err{color:#fca5a5;font-weight:700}.hrh .mut{color:#94a3b8;font-size:12px}.hrh input,.hrh select{min-height:44px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;padding:0 8px;max-width:100%;box-sizing:border-box}.hrh .pod{display:flex;gap:8px;align-items:flex-end;justify-content:center;margin:10px 0}.hrh .pod>div{flex:1 1 0;min-width:0;text-align:center;border-radius:10px 10px 0 0;padding:8px 4px;background:#1e293b}.hrh .pod .p1{background:linear-gradient(180deg,#facc15,#a16207);color:#111;min-height:90px}.hrh .pod .p2{background:linear-gradient(180deg,#cbd5e1,#64748b);color:#111;min-height:70px}.hrh .pod .p3{background:linear-gradient(180deg,#d97706,#78350f);min-height:56px}`;
const monthNow = () => new Date().toISOString().slice(0, 7);
const prevMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const errText = (e) => (e && (e.message || e.error || String(e))) || 'Hata';
const fmtMin = (m) => `${Math.floor((m || 0) / 60)} sa ${(m || 0) % 60} dk`;
export async function renderHrHubScreen(container, api, state = {}) {
    const tab = state.tab || 'pasaport';
    const month = state.month || prevMonth();
    const mgmt = !!state.mgmt;
    let pid = state.personnelId ?? null, body = null, msg = state.message || null;
    const go = (next) => void renderHrHubScreen(container, api, { ...state, personnelId: pid, ...next });
    try { if (!pid) pid = await api.myPersonnelId(); } catch (e) { msg = errText(e); }
    const tabs = [['pasaport', 'Pasaportum'], ['puantaj', 'Puantajım'], ['performans', 'Performansım'], ['akademi', 'Academy'], ['beceri', 'Becerilerim'], ['rozet', 'Rozetler'], ['istasyon', 'QR Eğitim'], ['zirve', 'Zirvedekiler']];
    let payOk = false; try { const a = await api.payAccess(); payOk = !!(a && a.can_view); } catch { payOk = false; }
    if (payOk) tabs.splice(1, 0, ['ucret', 'Maaş ve Ücretler']);
    if (mgmt) tabs.push(['yonetim', 'Yönetim']);
    try {
        if (!pid && tab !== 'yonetim') body = h('div', { class: 'card', 'data-testid': 'hr-unlinked' }, 'Hesabınız bir personel kaydına bağlı değil. Yöneticinizden Personel ekranından bağlantı kurmasını isteyin.');
        else if (tab === 'pasaport') {
            const p = await api.passport(pid), l = await api.linkStatus(pid);
            body = h('div', { 'data-testid': 'hr-passport' }, h('div', { class: 'card' }, h('b', {}, p.name), h('div', { class: 'mut' }, `Bağlantılar: hesap ${l.auth_linked ? '✔' : '✘'} · GEÇKO ${l.gecko_linked ? '✔' : '✘'} · açık istihdam ${l.open_employment ? '✔' : '✘'}`)),
                h('div', { class: 'card' }, h('b', {}, 'İstihdam geçmişi'), h('table', {}, h('tr', {}, h('th', {}, 'Başlangıç'), h('th', {}, 'Bitiş'), h('th', {}, 'Unvan'), h('th', {}, 'Departman'), h('th', {}, 'Vardiya')), ...p.employment.map((e) => h('tr', {}, h('td', {}, e.start), h('td', {}, e.end || 'devam'), h('td', {}, e.title || '—'), h('td', {}, e.department || '—'), h('td', {}, e.shift || '—'))))),
                h('div', { class: 'card' }, h('b', {}, 'Becerilerim'), ...(p.skills.length ? p.skills.map((s) => h('div', {}, `${s.skill}: seviye ${s.level}`)) : [h('div', { class: 'mut' }, 'Henüz doğrulanmış beceri kaydı yok.')])),
                h('div', { class: 'card' }, h('b', {}, 'Sorumluluklarım'), ...(p.responsibilities.length ? p.responsibilities.map((r) => h('div', {}, `${r.kind}: ${r.ref}`)) : [h('div', { class: 'mut' }, 'Atanmış sorumluluk yok.')])));
        } else if (tab === 'ucret') {
            const d = await api.payPassport(pid, month), pe = d.paid_to_employee || {}, ec = d.employer_cost, ND = 'Veri yok';
            const tl = (v) => (v === null || v === undefined) ? ND : `${Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
            const sc = (t, v, id) => h('div', { class: 'card', 'data-testid': `pay-card-${id}` }, h('div', { class: 'mut' }, t), h('b', {}, tl(v)));
            body = h('div', { 'data-testid': 'hr-ucret' }, h('h2', { 'data-testid': 'pay-title' }, `Maaş ve Ücretler — ${d.period}`),
                h('div', { class: 'mut' }, 'Veriler Cost Intelligence’tan salt-okunur gösterilir; burada değiştirilemez.'),
                sc('Maaş (net)', pe.salary_net, 'maas'), sc('Fazla Mesai', pe.overtime_amount, 'mesai'), sc('Ek Ücretler', pe.extra_amount, 'ek'), sc('Kesinleşmiş Prim', pe.prim_final, 'prim'), sc('Toplam Hakediş', pe.total_entitlement, 'toplam'),
                h('div', { class: 'mut' }, pe.note || ''),
                h('div', { class: 'card', 'data-testid': 'pay-current' }, h('b', {}, 'Güncel ücret'), d.wage_current ? h('div', {}, `Net ${tl(d.wage_current.net)} · Brüt ${tl(d.wage_current.gross)} · ${d.wage_current.valid_from} → ${d.wage_current.valid_to || 'devam'}`) : h('div', { class: 'mut' }, ND), d.last_wage_change ? h('div', { class: 'mut' }, `Son ücret değişikliği: ${d.last_wage_change.valid_from}`) : null),
                h('div', { class: 'card', 'data-testid': 'pay-employer' }, h('b', {}, 'İşveren maliyeti (çalışana ödenen ücret değildir)'), ec ? h('div', {}, `${tl(ec.total)} · ${ec.basis === 'ACTUAL' ? 'kesin bordro' : 'tahmini'}${ec.confidence === 'LOW' ? ' (düşük güven)' : ''}`) : h('div', { class: 'mut' }, ND)),
                h('div', { class: 'card', 'data-testid': 'pay-prim' }, h('b', {}, 'Prim (yalnız kesinleşmiş)'), ...((d.prim && d.prim.finalized.length) ? d.prim.finalized.map((x) => h('div', {}, `${x.period}: ${tl(x.amount)} · finansal kayıt ${x.cost_recorded ? 'Cost Intelligence’ta var' : 'henüz yok'}`)) : [h('div', { class: 'mut' }, ND)])),
                h('div', { class: 'card', 'data-testid': 'pay-history' }, h('b', {}, 'Aylık geçmiş'), ...(d.history.length ? [h('div', { class: 'tw' }, h('table', {}, h('tr', {}, h('th', {}, 'Dönem'), h('th', {}, 'Net'), h('th', {}, 'Mesai'), h('th', {}, 'Ek'), h('th', {}, 'Kaynak')), ...d.history.map((x) => h('tr', {}, h('td', {}, x.period), h('td', {}, tl(x.net)), h('td', {}, tl(x.overtime)), h('td', {}, tl((x.extra_benefit == null && x.extra_payment == null) ? null : (Number(x.extra_benefit || 0) + Number(x.extra_payment || 0)))), h('td', {}, x.source_file || '—')))))] : [h('div', { class: 'mut' }, ND)])),
                h('div', { class: 'card', 'data-testid': 'pay-changes' }, h('b', {}, 'Ücret değişiklikleri'), ...(d.wage_changes.length ? d.wage_changes.map((x) => h('div', {}, `${x.valid_from} → ${x.valid_to || 'devam'}: net ${tl(x.net)}${x.superseded ? ' (yerine yenisi girildi)' : ''}`)) : [h('div', { class: 'mut' }, ND)])),
                h('div', { class: 'card' }, h('b', {}, 'Cost Intelligence kayıtları'), ...(d.canonical_records.length ? d.canonical_records.map((x) => h('button', { 'data-testid': 'pay-open-cost', onClick: () => (state.openCost ? state.openCost(x.expense_id) : (location.hash = `#/cost/expense/${x.expense_id}`)) }, `${x.category} kaydını aç`)) : [h('div', { class: 'mut' }, 'Bu dönem için aktarılmış kayıt yok.')])));
        } else if (tab === 'puantaj') {
            const rows = await api.attendance(pid, month);
            body = h('div', { 'data-testid': 'hr-puantaj' }, h('div', { class: 'card' }, h('b', {}, `${month} fiili çalışma`), h('table', {}, h('tr', {}, h('th', {}, 'Gün'), h('th', {}, 'Süre'), h('th', {}, 'Durum')), ...rows.map((r) => h('tr', {}, h('td', {}, r.date), h('td', {}, fmtMin(r.worked_minutes)), h('td', {}, r.missing_punch ? 'Eksik geçiş' : r.status))))), h('div', { class: 'mut' }, 'Süreler GEÇKO geçişlerinden hesaplanır. Hata görürseniz yöneticinize düzeltme talep ettirin.'));
        } else if (tab === 'performans') {
            const [perf, prim] = await Promise.all([api.perfOwn(month), api.primMyLine(month).catch(() => null)]);
            body = h('div', { 'data-testid': 'hr-perf' }, h('div', { class: 'card' }, h('b', {}, `${month} performans puanım`), ...(perf.length ? [h('div', { style: 'font-size:28px;font-weight:800' }, String(perf[0].total)), h('table', {}, ...Object.entries(perf[0].breakdown).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, `${v.capped} × %${v.weight} = ${v.points}`))))] : [h('div', { class: 'mut' }, 'Bu ay için resmi puan henüz yayınlanmadı.')])),
                h('div', { class: 'card' }, h('b', {}, 'Prim'), prim ? h('div', {}, `${prim.amount} (pay %${prim.share_pct})`) : h('div', { class: 'mut' }, 'Prim kesinleşmediyse veya katılımcı değilseniz burada görünmez.')));
        } else if (tab === 'akademi' || tab === 'beceri' || tab === 'rozet' || tab === 'istasyon') {
            body = await (state.personnelId = pid, learnBody(api, tab, state, go));
        } else if (tab === 'zirve') {
            const league = state.league || 'ALL';
            const [b, l3, imp, card] = await Promise.all([api.zirveBoard(month, league), api.zirveLast3(month), api.zirveImproved(month), api.zirveCard(pid)]);
            const cls = ['p2', 'p1', 'p3'];
            const pod = [b.podium[1], b.podium[0], b.podium[2]].filter(Boolean);
            body = h('div', { 'data-testid': 'hr-zirve' }, h('div', { class: 'tabs' }, ...[['ALL', 'Genel'], ['SHIFT:TeamK1', '1. Vardiya'], ['SHIFT:TeamK2', '2. Vardiya'], ['DEPARTMENT:URETIM', 'Üretim']].map(([k, t]) => h('button', { class: league === k ? 'on' : '', onClick: () => go({ league: k }) }, t))),
                b.rows.length ? h('div', { class: 'pod', 'data-testid': 'hr-podium' }, ...pod.map((x, i) => h('div', { class: cls[i] }, h('div', { style: 'font-size:22px;font-weight:800' }, String(x.rank)), h('div', { style: 'font-weight:700' }, x.name), h('div', {}, String(x.score))))) : h('div', { class: 'card mut' }, `${month} için kapatılmış sıralama yok.`),
                h('div', { class: 'card' }, h('table', {}, ...b.rows.map((r) => h('tr', {}, h('td', {}, String(r.rank)), h('td', {}, r.name), h('td', {}, String(r.score)), h('td', {}, r.tier || ''))))),
                b.formula ? h('div', { class: 'mut', 'data-testid': 'hr-formula' }, `Puan formülü (sürüm ${b.formula.policy_version}): ` + Object.entries(b.formula.weights).map(([k, v]) => `${k} %${v}`).join(' · ')) : null,
                h('div', { class: 'card' }, h('b', {}, 'Son 3 ay ortalaması'), ...l3.slice(0, 5).map((x) => h('div', {}, `${x.rank}. ${x.name} — ${x.avg_score}`))),
                h('div', { class: 'card' }, h('b', {}, 'En çok gelişenler'), ...imp.map((x) => h('div', {}, `${x.rank}. ${x.name} +${x.delta}`))),
                h('div', { class: 'card' }, h('b', {}, 'Kişisel hedefim'), h('div', { class: 'mut' }, 'Hedefiniz yalnız size görünür.'), (() => { const t = h('input', { type: 'number', min: 0, max: 100, placeholder: 'Hedef puan', 'data-testid': 'hr-goal-input' }); return h('div', {}, t, h('button', { onClick: async () => { try { await api.goalSet(monthNow(), Number(t.value), null); go({ message: 'Hedef kaydedildi.' }); } catch (e) { go({ message: errText(e) }); } } }, 'Kaydet')); })(), ...((card.my_goals || []).map((g) => h('div', {}, `${g.month}: hedef ${g.target}`)))));
        } else if (tab === 'yonetim') {
            const f = (ph) => h('input', { placeholder: ph });
            const eP = f('Personel ID'), eD = f('Etkin tarih YYYY-AA-GG'), eT = f('Unvan kodu'), eS = f('Vardiya kodu'), eR = f('Gerekçe (en az 5 harf)');
            const aF = f('Başlangıç'), aT = f('Bitiş'), aR = f('Gerekçe');
            body = h('div', { 'data-testid': 'hr-yonetim' },
                h('div', { class: 'card' }, h('b', {}, 'Unvan / vardiya değişimi'), h('div', { class: 'mut' }, 'Açık dönem bir gün önce kapanır, yenisi açılır; geçmiş silinmez.'), eP, eD, eT, eS, eR, h('button', { onClick: async () => { try { await api.employmentChange({ personnel: eP.value, effective: eD.value, title: eT.value, shift: eS.value, reason: eR.value }); go({ message: 'Değişim kaydedildi.' }); } catch (e) { go({ message: errText(e) }); } } }, 'Uygula')),
                h('div', { class: 'card' }, h('b', {}, 'Fiili puantaj hesapla (GEÇKO)'), aF, aT, aR, h('button', { onClick: async () => { try { const n = await api.attendanceCompute(aF.value, aT.value, aR.value); go({ message: `${n} gün hesaplandı.` }); } catch (e) { go({ message: errText(e) }); } } }, 'Hesapla')),
                h('a', { href: '#/ik-yonetim', 'data-testid': 'hr-to-admin' }, 'Tüm İK yönetim ekranları → İK Yönetimi'));
        }
    } catch (e) { msg = errText(e); }
    mount(container, h('div', { class: 'hrh' }, h('style', {}, CSS), h('h1', { 'data-testid': 'hr-heading' }, 'İK Merkezi'),
        h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map(([k, t]) => h('button', { role: 'tab', class: tab === k ? 'on' : '', 'data-testid': `hr-tab-${k}`, onClick: () => go({ tab: k, message: null }) }, t))),
        h('div', { class: 'tabs' }, h('label', { class: 'mut' }, 'Ay '), (() => { const i = h('input', { type: 'month', value: month, 'data-testid': 'hr-month' }); i.addEventListener('change', () => go({ month: i.value })); return i; })()),
        msg ? h('div', { class: 'err', role: 'alert', 'data-testid': 'hr-msg' }, msg) : null, body));
}
