// KMI SIGNATURE HOME — "show ekranı" (KMI-001 final revision). The first screen answers five questions before any KPI list:
//   1 Fabrika nasıl?  2 Makineler?  3 Hedefe göre neredeyiz?  4 Önce neye müdahale?  5 Benim işim?
// Everything comes from the canonical sources the caller already loaded (command_center snapshot, live_board, machines master data).
// Nothing is invented: a missing source says BİLİNMİYOR / VERİ GEREKLİ, a stale snapshot is announced in words (never shown as live).
import { h } from '../../../packages/ui/src/index.js';
import { freshness, homeDomainsFor, productionShiftAt } from '../../../packages/domain/src/homeLayout.js';
import { buildPriorityQueue, buildAttention, openTaskCount, quickAccess, applyOrder, TIER_LABEL_TR } from '../../../packages/domain/src/smartHome.js';
import { NAV_ITEM_BY_PATH } from './nav.js';
import { WO_STATUS_TR } from './screens/WorkOrderHubScreen.js';
import { machineStateOf, AVAILABILITY_TR, MACHINE_CLASS_TR } from '../../../packages/domain/src/machineState.js';
import { formatStamp } from '../../../packages/domain/src/temporal.js';
import { machineIdentityCard, progressPct, sinceText } from './machineCard.js';
import { bulletBar, shiftColumns, distributionBar, trendBadge, chartUnknown, CHART_CSS } from './charts.js';
import { evaluateKpi } from '../../../packages/domain/src/kpiTrend.js';
import { STATE_VISUAL } from './spindle.js';
import { passportHref } from './passport/registry.js';
import { buildPulse, splitPulse, fleetPriority } from '../../../packages/domain/src/homePulse.js';
import { decisionPanel, DECIDE_CSS } from './homeDecide.js';
const SECTION_TITLE = { fleet: 'Canlı fabrika', perf: 'Üretim ve vardiya performansı', wos: 'İnsan ve iş akışı', flow: 'Günlük akış ve yaklaşanlar', quick: 'Hızlı erişim' };
const PASSPORT_ENTITY = { MACHINE: 'MACHINE', WORK_ORDER: 'WORK_ORDER', STOCK_LOT: 'STOCK_LOT' };
const NUM = new Intl.NumberFormat('tr-TR');
const SHIFT_SHORT = { TeamK1: 'V1', TeamK2: 'V2', OUT_OF_SHIFT: 'vardiya dışı' };
const TONE_GLYPH = { bad: '✕', warn: '!', ok: '✓', info: '●', unknown: '?' };
const UI = new WeakMap();
const COLLAPSED_MACHINES = 6, MAX_MACHINES = 24;
/** Who should see the machine park on Home: only roles whose scope touches the shop floor. */
export function showsFleet(a) {
    const d = homeDomainsFor(a);
    return d === 'ALL' || d.some((x) => x === 'PRODUCTION' || x === 'MAINTENANCE' || x === 'QUALITY');
}
/** Plain-language age ("33 sa 14 dk"); null when unknown. */
export function ageText(ageMin) {
    if (ageMin === null)
        return null;
    if (ageMin === 0)
        return 'şimdi';
    if (ageMin < 60)
        return `${ageMin} dk`;
    const hh = Math.floor(ageMin / 60);
    return hh < 48 ? (ageMin % 60 ? `${hh} sa ${ageMin % 60} dk` : `${hh} sa`) : `${Math.floor(hh / 24)} gün`;
}
/** Minutes until the current defined production shift ends (TeamK1 16:00, TeamK2 24:00, Istanbul); null outside a defined shift. */
export function shiftEndsInMin(nowMs) {
    const sh = productionShiftAt(new Date(nowMs).toISOString());
    if (!sh)
        return null;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(nowMs));
    const hh = Number(parts.find((x) => x.type === 'hour').value), mm = Number(parts.find((x) => x.type === 'minute').value);
    return (sh.code === 'TeamK1' ? 16 : 24) * 60 - (hh * 60 + mm);
}
const initials = (name) => { const w = (name ?? '').trim().split(/\s+/).filter(Boolean); return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toLocaleUpperCase('tr-TR') : '?'; };
export function renderHomeShow(host, i) {
    let ui = UI.get(host);
    if (!ui) {
        ui = { filter: null, expanded: false, decide: null, pending: null, wired: false };
        UI.set(host, ui);
    }
    const U = ui;
    // never repaint under the user's hands: while a text field inside Home has focus, the newest data waits and is painted when the field loses focus
    const ae = typeof document !== 'undefined' ? document.activeElement : null;
    if (ae && host.contains(ae) && ae.tagName === 'INPUT') {
        U.pending = i;
        if (!U.wired) {
            U.wired = true;
            host.addEventListener('focusout', () => { setTimeout(() => { const a = document.activeElement; if (U.pending && !(a && host.contains(a) && a.tagName === 'INPUT')) {
                const p = U.pending;
                U.pending = null;
                renderHomeShow(host, p);
            } }, 0); });
        }
        return;
    }
    U.pending = null;
    const again = () => renderHomeShow(host, i);
    const fr = freshness(i.snapshot?.generatedAt, i.nowMs);
    const loadingSnap = i.sources?.snapshot.state === 'LOADING';
    const stale = fr.state !== 'FRESH' && !loadingSnap;
    const nowIso = new Date(i.nowMs).toISOString();
    const age = ageText(fr.ageMin);
    const sh = showsFleet(i.access);
    const src = i.sources ?? { snapshot: { state: i.snapshot ? 'OK' : 'FAILED', at: null }, board: { state: !sh ? 'NOT_APPLICABLE' : i.board ? 'OK' : 'FAILED', at: null }, tasks: { state: i.tasks ? 'OK' : 'NOT_APPLICABLE', at: null }, approvals: { state: i.approvalsPending === null ? 'NOT_APPLICABLE' : 'OK', at: null } };
    const loadingBox = (title, tid) => h('section', { class: 'hs-sec', 'data-testid': tid, 'aria-busy': 'true' }, h('div', { class: 'cp-title hs-t2' }, title), h('div', { class: 'hs-skel', role: 'status' }, 'Yükleniyor…'));
    const why = (s) => (s.state === 'TIMEOUT' ? 'zamanında yanıt vermedi' : 'okunamadı');
    const fresh = h('div', { class: `hs-fresh ${fr.state.toLowerCase()}`, 'data-testid': 'cockpit-fresh', 'data-state': fr.state, role: 'status' }, h('i', { 'aria-hidden': 'true' }), h('b', {}, loadingSnap ? 'YÜKLENİYOR' : fr.state === 'FRESH' ? 'CANLI' : fr.state === 'STALE' ? 'BAYAT VERİ' : 'VERİ ZAMANI BİLİNMİYOR'), h('span', {}, loadingSnap ? 'komuta merkezi okunuyor' : fr.state === 'FRESH' ? `${age === 'şimdi' ? 'şimdi' : `${age} önce`} güncellendi` : fr.state === 'STALE' ? `Son kayıt ${age} önce` : 'komuta merkezi okunamadı'), i.snapshot ? h('span', { class: 'mut' }, formatStamp(i.snapshot.generatedAt)) : null);
    const staleBanner = stale ? h('div', { class: 'hs-stale', 'data-testid': 'home-stale-banner', role: 'alert' }, h('b', {}, fr.state === 'STALE' ? `Bu ekrandaki durum canlı değil — son kayıt ${age} önce.` : 'Bu ekrandaki durum doğrulanamadı.'), h('span', {}, ' Aşağıdaki makine ve iş durumları son kayıtlı bilgidir; şu an farklı olabilir. Güncel durum için Yenile veya KMI LIVE.')) : null;
    const moveBtns = (id) => i.onMove ? [
        h('button', { type: 'button', class: 'hs-mv', 'aria-label': `${SECTION_TITLE[id]} bölümünü yukarı taşı`, title: 'Yukarı taşı', 'data-testid': `home-move-up-${id}`, onClick: () => i.onMove(id, -1) }, '↑'),
        h('button', { type: 'button', class: 'hs-mv', 'aria-label': `${SECTION_TITLE[id]} bölümünü aşağı taşı`, title: 'Aşağı taşı', 'data-testid': `home-move-down-${id}`, onClick: () => i.onMove(id, 1) }, '↓')
    ] : [];
    const secHead = (id, extra, title) => h('div', { class: 'hs-sec-h' }, h('div', { class: 'cp-title hs-t2' }, title ?? SECTION_TITLE[id]), h('div', { class: 'hs-tools' }, extra ?? null, ...moveBtns(id)));
    const alertsIn = i.snapshot?.alerts ?? null;
    const counters = i.snapshot?.counters ?? null;
    const ctr = (k) => { const v = counters?.[k]; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
    const live = i.snapshot?.liveWorkOrders ?? [];
    // ── Fabrika nabzı: 5–7 compact KPIs from the canonical sources already loaded (no extra request) ─────────────────────────────
    const pulseWaiting = (src.snapshot.state === 'LOADING' && !i.snapshot) || (sh && src.board.state === 'LOADING' && !i.board);
    const tiles = pulseWaiting ? [] : buildPulse({ board: i.board, boardApplicable: sh, counters, canOpen: i.canOpen, access: i.access });
    const tile = (t) => {
        const inner = [h('div', { class: 'hs-pt-l' }, t.tone !== 'info' ? h('span', { class: 'hs-pt-g', 'aria-hidden': 'true' }, `${TONE_GLYPH[t.tone]} `) : null, t.label), t.value !== null ? h('div', { class: 'hs-pt-v' }, t.value) : h('div', { class: 'hs-pt-v unk' }, 'BİLİNMİYOR'), h('div', { class: 'hs-pt-s' }, t.sub)];
        return (t.href ? h('a', { class: `hs-pt ${t.tone}`, href: t.href, 'data-testid': `home-pulse-${t.id}`, 'data-known': String(t.value !== null), 'data-tone': t.tone }, ...inner)
            : h('div', { class: `hs-pt ${t.tone}`, 'data-testid': `home-pulse-${t.id}`, 'data-known': String(t.value !== null), 'data-tone': t.tone }, ...inner));
    };
    const pulseStrip = pulseWaiting ? h('section', { class: 'hs-pulse', 'data-testid': 'home-pulse', 'aria-busy': 'true', 'aria-label': 'Fabrika nabzı' }, ...Array.from({ length: sh ? 6 : 3 }, () => h('div', { class: 'hs-pt skel', 'data-testid': 'home-pulse-loading' }, h('div', { class: 'hs-pt-l' }, 'Yükleniyor…'), h('div', { class: 'hs-pt-v' }, ' '), h('div', { class: 'hs-pt-s' }, ' '))))
        : tiles.length ? (() => {
            const { lead, rest } = splitPulse(tiles);
            return h('section', { class: `hs-pulse-wrap${stale ? ' is-stale' : ''}`, 'data-testid': 'home-pulse', 'aria-label': 'Fabrika nabzı' }, h('div', { class: 'hs-pulse hs-pulse-lead', style: `--n:${lead.length}`, 'data-testid': 'home-hier-lead' }, ...lead.map(tile)), rest.length ? h('div', { class: 'hs-pulse hs-pulse-rest', 'data-testid': 'home-hier-rest' }, ...rest.map(tile)) : null);
        })() : null;
    // ── Canlı fabrika (makine parkı): gerçek makine kartları + durum filtresi; dağılım çubuğu kartların yerine geçmez ─────────────────────
    const HEAD = fleetPriority(i.access);
    let fleet = null;
    if (sh) {
        if (!i.board && src.board.state === 'LOADING')
            fleet = loadingBox('Canlı fabrika', 'home-fleet');
        else if (!i.board)
            fleet = h('section', { class: 'hs-sec', 'data-testid': 'home-fleet' }, secHead('fleet'), h('div', { class: 'hs-unk', 'data-testid': 'home-fleet-unknown' }, `Makine parkı: BİLİNMİYOR — canlı pano ${why(src.board)}. "Makine yok" anlamına gelmez.`));
        else {
            const b = i.board;
            const details = i.snapshot?.liveWorkOrders ?? [];
            const rows = b.machines.map((m) => ({ m, ms: machineStateOf(m) }))
                .sort((a, c) => HEAD.indexOf(a.ms.headline) - HEAD.indexOf(c.ms.headline) || a.m.code.localeCompare(c.m.code));
            const counts = {};
            rows.forEach((r) => { counts[r.ms.headline] = (counts[r.ms.headline] ?? 0) + 1; });
            if (U.filter && !counts[U.filter])
                U.filter = null;
            const shown = U.filter ? rows.filter((r) => r.ms.headline === U.filter) : rows;
            const cap = U.expanded ? MAX_MACHINES : COLLAPSED_MACHINES;
            const chips = HEAD.filter((k) => counts[k]).map((k) => h('button', { type: 'button', class: `sv-chip hs-filter${U.filter === k ? ' on' : ''}`, style: `--c:${STATE_VISUAL[k].color}`, 'aria-pressed': String(U.filter === k), 'data-testid': 'home-fleet-count', 'data-headline': k, title: U.filter === k ? 'Filtreyi kaldır' : `Yalnız "${STATE_VISUAL[k].label}" makineleri göster`, onClick: () => { U.filter = U.filter === k ? null : k; U.expanded = false; again(); } }, h('i', {}), `${STATE_VISUAL[k].label} ${counts[k]}`));
            const cards = shown.slice(0, cap).map(({ m, ms }) => {
                const mi = i.info.get(m.code);
                const a = m.active[0];
                const d = a ? details.find((x) => x.machineCode === m.code && (x.productCode ?? null) === (a.productCode ?? null)) ?? null : null;
                const cls = mi?.machineClass && mi.machineClass in MACHINE_CLASS_TR ? MACHINE_CLASS_TR[mi.machineClass] : null;
                const alert = m.openHolds > 0 ? `${m.openHolds} kalite bekletmesi açık` : m.openMaintenance > 0 ? `${m.openMaintenance} açık bakım kaydı` : null;
                return machineIdentityCard({
                    code: m.code, name: mi?.name ?? null, classTr: cls, headline: ms.headline, stale: ms.stale, sinceLabel: sinceText(m.since, b.generatedAt) ? `${sinceText(m.since, b.generatedAt)} süredir` : null,
                    conflictNote: ms.conflict ? `Kayıt: ${AVAILABILITY_TR[ms.availability]} — ama aktif iş emri var` : null, shift: b.shift,
                    wo: a ? { no: a.wo, product: a.productCode, operator: a.operator !== undefined ? a.operator : d ? d.operatorName : undefined, planned: d ? d.qtyPlanned : null, produced: d ? d.qtyProduced : null, scrap: d ? d.qtyScrap : null } : null,
                    woCount: m.active.length, alert, passportHref: mi?.id ? passportHref('MACHINE', mi.id) : null, size: 'compact', fresh: !stale
                });
            });
            const hidden = shown.length - cards.length;
            fleet = h('section', { class: `hs-sec hs-fleet${stale ? ' is-stale' : ''}`, 'data-testid': 'home-fleet' }, h('div', { class: 'hs-sec-h' }, h('div', { class: 'cp-title hs-t2' }, `Canlı fabrika · ${b.machines.length} ekipman`), h('div', { class: 'hs-tools' }, ...moveBtns('fleet'))), h('div', { class: 'hs-chips', 'data-testid': 'home-fleet-filters' }, ...chips), h('div', { class: 'hs-machines', 'data-testid': 'home-machines' }, ...cards), hidden > 0 || U.expanded ? h('button', { type: 'button', class: 'hs-btn hs-more', 'data-testid': 'home-fleet-expand', 'aria-expanded': String(U.expanded), onClick: () => { U.expanded = !U.expanded; again(); } }, U.expanded ? 'Daha az göster' : `${hidden} makine daha göster`) : null, distributionBar({ title: 'Makine durum dağılımı', unit: 'makine', period: 'şu an (elle girilen durum kaydı)', source: 'Canlı pano · makine durum kaydı', asOf: b.generatedAt, stale }, HEAD.filter((k) => counts[k]).map((k) => ({ label: STATE_VISUAL[k].label, value: counts[k], meaning: 'info', color: STATE_VISUAL[k].color, icon: '●' }))), h('div', { class: 'hs-foot' }, i.canOpen('/canli') ? h('a', { href: '#/canli' }, 'KMI LIVE: tüm makineler →') : null, h('span', { class: 'mut', 'data-testid': 'home-physical-note' }, ' Durum elle girilen kayıttır; fiziksel çalışma CNC bağlantısı olmadığından doğrulanmaz. Dönen kesici = "aktif iş emri kayıtlı".')));
        }
    }
    // ── Karar ve risk merkezi: aynı altı kademeli motor, ilk ekranda en kritik 4; olay tekrarlanmaz ───────────────────────────────────
    const tasksIn = i.tasks ? { manual: i.tasks.manual, derived: i.tasks.derived } : null;
    const canApprovals = i.canOpen('/onaylar');
    const full = buildPriorityQueue({ alerts: alertsIn, tasks: tasksIn, approvalsPending: i.approvalsInQueue !== undefined ? i.approvalsInQueue : i.approvalsPending, canOpenApprovals: canApprovals, access: i.access, nowMs: i.nowMs }, 200);
    const SHOW = 4;
    const queue = { items: full.items.slice(0, SHOW), rest: full.items.slice(SHOW), more: Math.max(0, full.total - SHOW), total: full.total };
    const shownKeys = new Set(queue.items.flatMap((x) => [x.key, x.objectKey ?? '']));
    const attention = buildAttention({ alerts: alertsIn, access: i.access, shownKeys, sources: src, snapshotStale: stale && !!i.snapshot, snapshotAgeMin: fr.ageMin, nowMs: i.nowMs }, 4);
    const hrefOf = (t) => (t.type === 'ROUTE' ? t.href : (PASSPORT_ENTITY[t.entityType] ? passportHref(PASSPORT_ENTITY[t.entityType], t.entityId) : '#/'));
    const hasHref = (t) => t.type === 'ROUTE' || !!PASSPORT_ENTITY[t.entityType];
    const waitText = (m) => { const a = ageText(m); return a ? `${a === 'şimdi' ? 'şimdi başladı' : `${a} bekliyor`}` : null; };
    const dueText = (iso) => { if (!iso)
        return null; const m = Math.round((Date.parse(iso) - i.nowMs) / 60000); if (!Number.isFinite(m))
        return null; const a = ageText(Math.abs(m)); return m < 0 ? `${a} gecikti` : `${a} içinde`; };
    const loadedAny = src.snapshot.state !== 'LOADING' || src.tasks.state !== 'LOADING';
    const GLY = { 1: '✕', 2: '◆', 3: '!', 4: '◷', 5: '▶', 6: 'i' };
    const priCard = (it) => {
        const crit = it.tier === 1;
        const isAlert = it.kind === 'ALERT';
        const when = waitText(it.waitingMin) ?? dueText(it.dueIso);
        return h('div', { class: `cp-sig hs-card hs-pi t${it.tier} ${crit ? 'bad' : it.tier <= 3 ? 'warn' : ''}`, 'data-testid': isAlert ? 'cockpit-signal' : 'home-priority-item', 'data-kind': it.kind, 'data-tier': String(it.tier), ...(isAlert ? { 'data-severity': it.severity ?? '' } : {}) }, h('div', { class: 'hs-card-h' }, h('b', { class: 'sev' }, `${GLY[it.tier]} ${(it.label ?? TIER_LABEL_TR[it.tier]).toLocaleUpperCase('tr-TR')}`), it.objectLabel ? h('span', { class: 'hs-oid mut' }, it.objectLabel) : null, when ? h('span', { class: 'hs-when' }, when) : null), h('div', { class: 'hs-card-t' }, it.title), h('div', { class: 'hs-meta' }, h('span', {}, `Durum: ${it.status}`), h('span', {}, `Sorumlu: ${it.owner}`), isAlert && it.context ? h('span', { class: 'hs-why-i' }, h('b', {}, 'Neden önemli: '), it.context) : !isAlert && it.context ? h('span', { class: 'mut' }, `Kaynak kayıt: ${it.context}`) : null), hasHref(it.target) ? h('a', { class: 'hs-act hs-stretch', href: hrefOf(it.target), ...(isAlert ? { 'data-testid': 'cockpit-signal-passport' } : { 'data-testid': 'home-priority-open' }) }, `${it.actionLabel} →`) : h('span', { class: 'hs-act mut' }, 'Doğrudan kayıt bağlantısı yok'), it.kind === 'APPROVAL' && i.decideApi ? (U.decide ??= decisionPanel({ api: i.decideApi, held: i.access.actions ?? [], onDone: () => i.onRefresh?.() })) : null);
    };
    const partial = ['snapshot', 'tasks', 'approvals'].filter((k) => src[k].state === 'FAILED' || src[k].state === 'TIMEOUT');
    const SRC_SHORT = { snapshot: 'komuta merkezi', tasks: 'görev listesi', approvals: 'onay kuyruğu' };
    const empty = !loadedAny ? h('div', { class: 'hs-skel', role: 'status', 'data-testid': 'home-priority-loading' }, 'Önceliklerin yükleniyor…')
        : partial.length ? h('div', { class: 'hs-unk', 'data-testid': 'home-priority-partial' }, `Öncelik listesi eksik olabilir: ${partial.map((k) => SRC_SHORT[k]).join(', ')} ${partial.some((k) => src[k].state === 'TIMEOUT') ? 'yanıt vermedi' : 'okunamadı'}. Boş görünmesi iş olmadığı anlamına gelmez.`)
            : h('div', { class: 'kmi-mut', 'data-testid': 'home-priority-empty' }, `Şu an senin için öncelikli iş veya karar görünmüyor (kaynaklar okundu${stale ? '; veri bayat olduğundan güncel olmayabilir' : ''}).`);
    const decisions = h('section', { class: 'hs-sec hs-decide cp-priority', 'data-testid': 'cockpit-signals', 'data-section': 'priority' }, h('div', { class: 'hs-sec-h' }, h('div', { class: 'cp-title hs-t2' }, 'Öncelikli işlerim'), queue.total ? h('span', { class: 'hs-count', 'data-testid': 'home-priority-count' }, `${queue.total} iş`) : null), queue.items.length ? h('div', { class: 'hs-dec' }, ...queue.items.map(priCard)) : empty, queue.more ? h('a', { class: 'hs-foot', href: '#/gorevler', 'data-testid': 'home-priority-more' }, `${queue.more} iş daha →`) : null, i.canOpen('/gorevler') && i.tasks ? h('a', { class: 'hs-foot', href: '#/gorevler', 'data-testid': 'home-tasks-link', 'data-count': String(openTaskCount(i.tasks, i.nowMs) ?? '') }, `Görevlerim · ${openTaskCount(i.tasks, i.nowMs)} iş sizi bekliyor →`) : null, partial.length && queue.items.length ? h('div', { class: 'hs-unk', 'data-testid': 'home-priority-partial' }, `Liste eksik olabilir: ${partial.map((k) => SRC_SHORT[k]).join(', ')} ${partial.some((k) => src[k].state === 'TIMEOUT') ? 'yanıt vermedi' : 'okunamadı'}.`) : null, i.canOpen('/bildirimler') ? h('a', { class: 'hs-foot', href: '#/bildirimler', 'data-testid': 'home-notices-link' }, 'Tüm bildirimler (uyarı · onay · görev) →') : null);
    const SEV_LABEL = { CRITICAL: '✕ KRİTİK', HIGH: '! YÜKSEK', WARN: '? VERİ SORUNU', INFO: 'i BİLGİ' };
    const attCard = (a) => h('div', { class: `hs-card hs-att ${a.severity === 'CRITICAL' ? 'bad' : 'warn'}`, 'data-testid': 'home-attention-item', 'data-kind': a.kind, 'data-severity': a.severity }, h('div', { class: 'hs-card-h' }, h('b', { class: 'sev' }, SEV_LABEL[a.severity]), a.sinceMin !== null && ageText(a.sinceMin) ? h('span', { class: 'hs-when' }, `${ageText(a.sinceMin)} süredir`) : null), h('dl', { class: 'hs-4' }, h('div', { class: 'hs-4-what' }, h('dt', {}, 'Ne oldu'), h('dd', {}, a.what)), h('div', {}, h('dt', {}, 'Neden önemli'), h('dd', {}, a.why)), h('div', {}, h('dt', {}, 'Kim ilgilenmeli'), h('dd', {}, a.who)), h('div', {}, h('dt', {}, 'Nereye'), h('dd', {}, a.where.target && hasHref(a.where.target) ? h('a', { class: 'hs-act', href: hrefOf(a.where.target), 'data-testid': 'home-attention-open' }, `${a.where.label} →`) : h('button', { type: 'button', class: 'hs-act hs-btn', 'data-testid': 'home-attention-refresh', onClick: () => i.onRefresh?.() }, 'Yenile →')))));
    const attentionSec = h('section', { class: 'hs-sec', 'data-testid': 'home-attention', 'data-section': 'attention' }, h('div', { class: 'hs-sec-h' }, h('div', { class: 'cp-title hs-t2' }, 'Dikkat gerektirenler')), attention.items.length ? h('div', { class: 'hs-dec' }, ...attention.items.map(attCard)) : !loadedAny ? h('div', { class: 'hs-skel', role: 'status' }, 'Yükleniyor…') : h('div', { class: 'kmi-mut', 'data-testid': 'home-attention-empty' }, 'Dikkat gerektiren başka bir durum yok (okunabilen kaynaklara göre).'), attention.more ? h('div', { class: 'hs-foot mut' }, `${attention.more} durum daha var — Performance Center'da.`) : null);
    // ── Üretim ve vardiya performansı ───────────────────────────────────────────────────────────────────────────────────────────────
    const sumP = live.reduce((s, x) => s + (x.qtyPlanned || 0), 0), sumG = live.reduce((s, x) => s + (x.qtyProduced || 0), 0);
    const overall = live.length ? progressPct(sumG, sumP) : null;
    const oee = i.snapshot?.oeeToday?.oee ?? null;
    const stampAt = i.snapshot?.generatedAt ?? null;
    const oc = i.snapshot?.oeeToday ?? null;
    const oeeV = evaluateKpi({ id: 'oee', value: oee !== null ? Math.round(oee * 100) : null, reference: null, asOf: stampAt, nowMs: i.nowMs }); // no reference period is delivered by the snapshot → honest "KARŞILAŞTIRMA YOK"
    const shiftGroups = (i.board?.shiftCompare ?? []).slice().sort((a, c) => a.day.localeCompare(c.day) || a.shift.localeCompare(c.shift)).slice(-4).map((x) => ({ label: `${x.day.slice(8, 10)}.${x.day.slice(5, 7)} ${SHIFT_SHORT[x.shift] ?? x.shift}`, good: x.good, scrap: x.scrap }));
    const perfFull = h('section', { class: 'hs-sec', 'data-testid': 'home-perf', 'data-section': 'perf' }, secHead('perf', h('span', { class: 'mut hs-stamp', 'data-testid': 'home-perf-stamp' }, stampAt ? `Veri zamanı: ${formatStamp(stampAt)}${stale ? ' · bayat' : ''}` : 'Veri zamanı: BİLİNMİYOR')), h('div', { class: 'hs-bigs hs-charts' }, 
    // target vs actual: the "operational target" is the planned quantity of the running work orders (no shift-plan source exists — see K2-05)
    h('div', { 'data-testid': 'home-big-progress', 'data-known': String(overall !== null) }, bulletBar({ title: 'Hedefe göre üretim', unit: 'adet', period: 'çalışan iş emirleri', source: 'Komuta merkezi · iş emri ilerlemesi', asOf: stampAt, stale, reference: 'planlanan adet' }, { actual: live.length ? sumG : null, target: live.length ? sumP : null, verdict: overall !== null && overall >= 100 ? 'ok' : 'info' })), sh ? (shiftGroups.length >= 2 ? shiftColumns({ title: 'Vardiya karşılaştırması', unit: 'adet', period: 'V1 = 1. vardiya, V2 = 2. vardiya', source: 'Canlı pano · vardiya karşılaştırması', asOf: i.board?.generatedAt ?? null, stale }, { groups: shiftGroups })
        : chartUnknown({ title: 'Vardiya karşılaştırması', source: 'Canlı pano · vardiya karşılaştırması', why: 'En az iki vardiya kaydı gerekli.', action: i.canOpen('/oee') ? { label: 'Eğilim · OEE', href: '#/oee' } : undefined }, 'home-trend-unknown')) : null, h('div', { class: 'ch ch-oee', 'data-testid': 'home-oee-trend' }, h('div', { class: 'ch-h' }, h('b', {}, 'OEE · bugün'), h('span', { class: 'ch-m' }, '% · bugün')), oee !== null ? h('div', { class: 'hs-oee-v', 'data-testid': 'home-big-oee' }, `%${Math.round(oee * 100)} `, trendBadge(oeeV)) : h('div', { class: 'ch-sum', 'data-testid': 'home-big-oee', 'data-known': 'false' }, 'VERİ GEREKLİ — OEE bu gün için hesaplanamadı.'), oc && oee !== null ? h('div', { class: 'ch-leg2' }, `Kullanılabilirlik ${oc.availability !== null ? '%' + Math.round(oc.availability * 100) : 'BİLİNMİYOR'} · Performans ${oc.performance !== null ? '%' + Math.round(oc.performance * 100) : 'BİLİNMİYOR'} · Kalite ${oc.quality !== null ? '%' + Math.round(oc.quality * 100) : 'BİLİNMİYOR'}`) : oc && oc.missing?.length ? h('div', { class: 'ch-leg2' }, `Eksik girdi: ${oc.missing.length} kalem (ideal çevrim, planlı süre…)`) : null, h('div', { class: 'ch-f' }, 'Kaynak: oee rollup · karşılaştırma dönemi verisi yoksa ok/yüzde gösterilmez'))));
    const perf = !i.snapshot && src.snapshot.state === 'LOADING' ? loadingBox('Üretim ve vardiya performansı', 'home-perf') : perfFull;
    // ── İnsan ve iş akışı: kim hangi makinede hangi işte (atama kaydı; "sahada" iddiası yok) ─────────────────────────────────────────────
    const woRows = live.slice(0, 6).map((w) => {
        const pct = progressPct(w.qtyProduced, w.qtyPlanned);
        return h('a', { class: 'hs-wo', href: passportHref('WORK_ORDER', w.workOrderId), 'data-testid': 'home-wo-card', 'data-wo': w.workOrderId }, h('span', { class: 'hs-av', 'aria-hidden': 'true' }, initials(w.operatorName)), h('span', { class: 'hs-wo-b' }, h('b', {}, w.operatorName ?? 'Operatör: BİLİNMİYOR'), h('span', { class: 'mut' }, `${w.machineCode ?? 'makine yok'} · ${w.productCode ?? 'ürün: BİLİNMİYOR'} · ${WO_STATUS_TR[w.status] ?? 'açık kayıt'}`)), h('span', { class: 'hs-wo-p' }, h('b', {}, pct !== null ? `%${pct}` : '—'), h('span', { class: 'mut' }, `${NUM.format(w.qtyProduced ?? 0)} / ${NUM.format(w.qtyPlanned ?? 0)}`), w.qtyScrap ? h('span', { class: 'hs-scrap' }, `hurda ${NUM.format(w.qtyScrap)}`) : null));
    });
    const woSec = sh && woRows.length ? h('section', { class: 'hs-sec', 'data-testid': 'home-wos' }, secHead('wos', h('span', { class: 'mut hs-stamp' }, `${live.length} çalışan iş emri · atama kaydı`)), h('div', { class: 'hs-wolist' }, ...woRows), h('div', { class: 'hs-foot mut' }, 'Operatör, iş emrine atanmış kişidir; sahada olduğu GEÇKO girişiyle burada doğrulanmaz.')) : null;
    // ── Günlük akış: yalnız gerçek kaynaklar (görev, onay, vardiya takvimi, açık teslim yükümlülüğü) — takvim/toplantı kaynağı yok, üretilmez ─────────────
    const endMin = shiftEndsInMin(i.nowMs);
    const upcoming = full.items.slice(SHOW).filter((x) => x.kind === 'TASK' || x.kind === 'DERIVED').filter((x) => x.tier <= 4).slice(0, 3);
    const canDelivery = sh && (i.canOpen('/siparisler') || i.canOpen('/sevkiyat'));
    const DUE_TR = { LATE: 'Gecikmiş', DUE_SOON: 'Yaklaşıyor', ON_TRACK: 'Zamanında' };
    const dateTr = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit' }) : '—'; };
    const deliveries = canDelivery && i.board ? [...i.board.orders].sort((a, c) => (a.state === 'LATE' ? 0 : a.state === 'DUE_SOON' ? 1 : 2) - (c.state === 'LATE' ? 0 : c.state === 'DUE_SOON' ? 1 : 2) || a.dueDate.localeCompare(c.dueDate)).slice(0, 4) : [];
    const flowBlocks = [];
    flowBlocks.push(h('div', { class: 'hs-fl', 'data-testid': 'home-flow-shift' }, h('b', {}, 'Vardiya devri'), h('span', {}, endMin === null ? 'Tanımlı vardiya dışı' : `${productionShiftAt(nowIso).label} bitimine ${ageText(endMin)}`)));
    if (canApprovals && typeof i.approvalsPending === 'number')
        flowBlocks.push(h('div', { class: 'hs-fl', 'data-testid': 'home-flow-decisions' }, h('b', {}, 'Bekleyen kararlar'), h('span', {}, i.approvalsPending > 0 ? `${i.approvalsPending} onay` : 'bekleyen onay yok'), h('a', { href: '#/onaylar' }, 'Onaylar →')));
    if (upcoming.length)
        flowBlocks.push(h('div', { class: 'hs-fl col', 'data-testid': 'home-flow-tasks' }, h('b', {}, 'Yaklaşan işler'), ...upcoming.map((x) => h('a', { class: 'hs-fl-i', href: hrefOf(x.target) }, h('span', {}, x.title), h('span', { class: 'mut' }, dueText(x.dueIso) ?? x.status)))));
    if (deliveries.length)
        flowBlocks.push(h('div', { class: 'hs-fl col wide', 'data-testid': 'home-flow-deliveries' }, h('b', {}, 'Teslim yükümlülüğü'), h('div', { class: 'hs-fl-rows' }, ...deliveries.map((o) => h('div', { class: `hs-fl-i d-${o.state.toLowerCase()}`, 'data-testid': 'home-delivery-item', 'data-state': o.state }, h('span', {}, `${o.productCode ?? 'ürün'} · ${NUM.format(Math.max(0, o.qty - o.shipped))} adet kaldı`), h('span', { class: 'mut' }, `${dateTr(o.dueDate)} · ${DUE_TR[o.state] ?? o.state}`)))), h('div', { class: 'mut hs-foot' }, 'Kalan = sipariş − sevk edilen. Sevkiyata hazır miktar bu ekranda iddia edilmez.')));
    const flowSec = h('section', { class: 'hs-sec', 'data-testid': 'home-flow' }, secHead('flow'), h('div', { class: 'hs-flow' }, ...flowBlocks));
    // ── Hızlı erişim: role defaults; "son kullandıklarım" only from a real per-user history ─────────────────────────────
    const qa = quickAccess(i.quickDefaults ?? [], i.recent ?? [], (p) => i.canOpen(p) && p in NAV_ITEM_BY_PATH);
    const quick = qa.entries.length ? h('section', { class: 'hs-sec', 'data-testid': 'home-quick', 'data-personalised': String(qa.personalised) }, secHead('quick', h('span', { class: 'mut hs-stamp', 'data-testid': 'home-quick-note' }, qa.personalised ? 'son kullandıklarınız + rol varsayılanları' : 'rolünüze göre varsayılan')), h('div', { class: 'hs-mes' }, ...qa.entries.map((e) => h('a', { class: 'hs-me', href: `#${e.path}`, 'data-testid': 'home-quick-item', 'data-path': e.path, 'data-personal': String(e.personal) }, h('span', {}, h('b', {}, NAV_ITEM_BY_PATH[e.path].label), h('small', {}, e.personal ? 'son kullandığınız' : 'rol varsayılanı')))))) : null;
    // ── kompakt üst bant: kısa karşılama + vardiya bağlamı + rol + bekleyen iş + veri tazeliği ───────────────────────────
    const shiftNow = productionShiftAt(nowIso);
    const when = new Date(i.nowMs).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const pendingKnown = partial.length === 0 && loadedAny;
    const band = h('div', { class: 'hs-band', 'data-testid': 'home-band' }, h('div', { class: 'hs-hello' }, h('h1', { 'data-testid': 'home-hello', class: 'hs-h1' }, `Merhaba${i.userName && !i.userName.includes('@') ? `, ${i.userName}` : ''}`), h('span', { class: 'mut', 'data-testid': 'home-context' }, `${shiftNow ? shiftNow.label : 'Tanımlı vardiya dışı'} · ${when}`)), i.access.roles.length ? h('span', { class: 'hs-role', 'data-testid': 'app-roles' }, `Rol: ${i.access.roles.join(', ')}`) : null, h('div', { class: 'hs-pend', 'data-testid': 'home-pending', 'data-known': String(pendingKnown) }, loadedAny ? h('b', {}, String(queue.total)) : h('b', {}, '…'), h('span', {}, loadedAny ? (pendingKnown ? 'bekleyen iş' : 'bekleyen iş · liste eksik olabilir') : 'yükleniyor')), h('div', { class: 'hs-bandr' }, fresh, i.onRefresh ? h('button', { type: 'button', class: 'hs-btn hs-refresh', 'data-testid': 'home-refresh', 'aria-label': 'Verileri yenile', onClick: () => i.onRefresh?.() }, '↻ Yenile') : null));
    const sections = { fleet, perf, wos: woSec, flow: flowSec, quick };
    const present = Object.keys(sections).filter((k) => sections[k]);
    const ord = applyOrder(present, i.order ?? null);
    ord.forEach((id, n) => { const el = sections[id]; el.setAttribute('data-section', id); el.setAttribute('data-pos', String(n)); });
    host.setAttribute('data-order', ord.join(','));
    const side = h('div', { class: 'hs-side', 'data-testid': 'home-side' }, decisions, attentionSec);
    const main = h('div', { class: 'hs-main', 'data-testid': 'home-main' }, ...ord.map((id) => sections[id]));
    host.replaceChildren(...[band, staleBanner, pulseStrip, h('div', { class: 'hs-grid' }, side, main),
        i.customOrder && i.onResetOrder ? h('button', { type: 'button', class: 'hs-btn hs-reset', 'data-testid': 'home-order-reset', onClick: () => i.onResetOrder?.() }, 'Düzeni varsayılana döndür') : null].filter(Boolean));
    host.hidden = false;
}
export const HOME_SHOW_CSS = CHART_CSS + DECIDE_CSS + `
.hs-charts{margin-top:12px;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))}.hs-oee-v{font-size:30px;font-weight:800;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ch-leg2{font-size:12px;color:var(--kmi-text2)}

#home-show-host{margin-top:6px;display:flex;flex-direction:column;gap:12px}
.cp-title.hs-t2{font-size:14px;font-weight:800;letter-spacing:.01em;color:var(--kmi-text,#f8fafc);text-transform:none}
#home-show-host .hs-mv,#home-show-host .hs-btn{background:rgba(15,23,42,.8);color:#e2e8f0;border:1px solid rgba(148,163,184,.35);box-shadow:none}#home-show-host .hs-btn.hs-act{border:0;background:none;color:#67e8f9}
.hs-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hs-mv{min-width:32px;min-height:32px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);color:#cbd5e1;font-size:15px;line-height:1;cursor:pointer}.hs-mv:hover,.hs-mv:focus-visible{border-color:#67e8f9;color:#fff;outline:2px solid transparent}
.hs-stamp{font-size:12px}.hs-count{font-size:12px;font-weight:800;padding:2px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.3);color:#e2e8f0}
.hs-skel{padding:14px;border-radius:10px;border:1px dashed rgba(148,163,184,.35);color:#cbd5e1;font-size:14px}
.hs-hello{display:flex;flex-direction:column;gap:2px;min-width:0}.hs-hello b,.hs-hello .hs-h1{margin:0;font-size:18px;color:#f8fafc;font-weight:800}.hs-hello .mut{font-size:13px;color:#cbd5e1}
.hs-pend{display:flex;align-items:baseline;gap:8px}.hs-pend b{font-size:28px;font-weight:800;color:#f8fafc;font-variant-numeric:tabular-nums}.hs-pend span{font-size:13px;color:#cbd5e1}
.hs-bandr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hs-btn{min-height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.8);color:#e2e8f0;font:700 13px system-ui;cursor:pointer}.hs-btn:hover,.hs-btn:focus-visible{border-color:#67e8f9;color:#fff}
.hs-act.hs-btn{border:0;background:none;padding:0;min-height:0;color:#67e8f9;font-weight:800}
.hs-pi{position:relative}.hs-pi .hd{position:relative;z-index:2}.hs-pi .hs-stretch::after{content:"";position:absolute;inset:0;border-radius:inherit}.hs-pi:hover{border-color:#67e8f9}.hs-pi:focus-within{outline:2px solid #67e8f9;outline-offset:2px}
.hs-pi.t1{border-left:5px solid #ef4444}.hs-pi.t2{border-left:5px solid #a78bfa}.hs-pi.t3{border-left:5px solid #f59e0b}.hs-pi.t4,.hs-pi.t5{border-left:5px solid #38bdf8}.hs-pi.t6{border-left:5px solid #64748b}
.hs-oid{font-size:12px}.hs-meta{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:13px;color:#cbd5e1}
.hs-att{border-left:5px solid #f59e0b}.hs-att.bad{border-left-color:#ef4444}.hs-4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;margin:0}.hs-4 dt{font-size:12px;font-weight:700;color:#94a3b8}.hs-4 dd{margin:0;font-size:14px;color:#e2e8f0;overflow-wrap:anywhere}
@media (max-width:700px){.hs-4{grid-template-columns:1fr}.hs-band{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 12px}.hs-bandr{grid-column:1/-1;flex-wrap:nowrap;justify-content:space-between}.hs-bandr .hs-fresh .mut{display:none}.hs-bandr .hs-fresh{font-size:11px;padding:4px 10px}.hs-pend{flex-direction:column;align-items:flex-end;gap:0}.hs-pend b{font-size:24px}.hs-hello b{font-size:16px}}
.hs-reset{align-self:flex-start}
.hs-band{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.hs-k{font-size:13px;font-weight:800;letter-spacing:.2em;color:var(--kmi-gold2)}.hs-t{display:none}.hs-s{font-size:12px;color:#94a3b8}
.hs-fresh{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-size:12px;border:1px solid #166534;background:rgba(20,83,45,.35);color:#bbf7d0}.hs-fresh i{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e}.hs-fresh b{letter-spacing:.1em}.hs-fresh .mut{color:#94a3b8}
.hs-fresh.stale{border:1px dashed var(--kmi-stale);background:var(--kmi-stale-soft);color:var(--kmi-stale)}.hs-fresh.stale i{background:var(--kmi-stale);box-shadow:none}.hs-fresh.unknown{border:1px dashed #94a3b8;background:rgba(51,65,85,.4);color:#e2e8f0}.hs-fresh.unknown i{background:#94a3b8;box-shadow:none}
.hs-stale{padding:12px 14px;border-radius:12px;border:1px solid #b45309;background:rgba(120,53,15,.28);color:#fde68a;font-size:14px;line-height:1.45}.hs-stale b{color:#fff}
.hs-sec{padding:14px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:linear-gradient(180deg,rgba(17,28,46,.9),rgba(11,18,32,.9));box-shadow:0 10px 30px rgba(2,6,23,.3)}
.hs-sec-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}.hs-sec-h .cp-title{margin:0}.hs-chips{display:flex;gap:6px;flex-wrap:wrap}
.hs-machines{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:12px}.hs-fleet.is-stale .mc{opacity:.78}
.hs-foot{margin-top:10px;font-size:12px;color:#cbd5e1}.hs-foot .mut,.hs-sig .mut,.mut{color:#94a3b8}.hs-unk{padding:12px;border:1px dashed #64748b;border-radius:10px;color:#cbd5e1}
.hs-dec{display:grid;gap:8px}.hs-card{padding:10px 12px;display:flex;flex-direction:column;gap:5px}.hs-card-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.hs-card-t{font-size:15px;font-weight:700;color:#f8fafc}.hs-why{font-size:13px;color:#cbd5e1}.hs-act{font-size:13px;font-weight:800;align-self:flex-start;color:#67e8f9}
.hs-bigs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px}.hs-big{padding:14px;border-radius:14px;background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.14)}
.hs-big-l{font-size:11px;font-weight:800;letter-spacing:.1em;color:#94a3b8;text-transform:uppercase}.hs-big-v{font-size:36px;font-weight:800;color:#f8fafc;line-height:1.15;font-variant-numeric:tabular-nums}.hs-big-v.unk{font-size:15px;color:#94a3b8;letter-spacing:.06em;padding:10px 0}.hs-big-s{font-size:12px;color:#cbd5e1}.hs-big.ok .hs-big-v{color:#34d399}.hs-big.warn .hs-big-v{color:#fbbf24}
.hs-trend{display:flex;align-items:flex-end;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(148,163,184,.12)}.hs-tb{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:#94a3b8;min-width:38px}.hs-tb i{display:block;width:22px;border-radius:5px 5px 0 0;background:linear-gradient(180deg,#34d399,#0f766e)}.hs-tb span{color:#e2e8f0;font-weight:700;font-size:11px}.hs-trend-n{margin-left:auto;font-size:11px;align-self:center}
.hs-mes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px}.hs-me{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.14);text-decoration:none;color:#e2e8f0;min-height:60px}.hs-me:hover{border-color:#67e8f9}
.hs-me-n{font-size:26px;min-width:34px;text-align:center;color:#67e8f9}.hs-me span{display:flex;flex-direction:column;min-width:0}.hs-me small{font-size:12px;color:#94a3b8}
.hs-catalog{margin-top:4px}.hs-catalog>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:800;letter-spacing:.08em;font-size:12px;color:#cbd5e1;padding:0 4px}
@media (max-width:640px){.hs-t{font-size:22px}.hs-big-v{font-size:30px}}
/* KMI-002 final: executive layout = compact band → Fabrika nabzı → [decision column | live factory + analytics] */
.hs-grid{display:flex;flex-direction:column;gap:12px}.hs-side,.hs-main{display:flex;flex-direction:column;gap:12px;min-width:0}
@media (min-width:1100px){.hs-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,370px);align-items:start;gap:14px}.hs-side{grid-column:2;grid-row:1}.hs-main{grid-column:1;grid-row:1}}
@media (min-width:1700px){.hs-grid{grid-template-columns:minmax(0,1fr) 440px}}
.hs-role{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.3);color:#cbd5e1;white-space:nowrap}
.hs-band{padding:2px 2px 0}.hs-pend b{font-size:22px}
.hs-pulse-wrap{display:grid;gap:8px}.hs-pulse-lead{grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))!important}.hs-pulse-lead .hs-pt{min-height:104px;padding:12px 14px}.hs-pulse-lead .hs-pt-v{font-size:30px;line-height:1.1}
.hs-pulse-rest{grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))!important;gap:6px}.hs-pulse-rest .hs-pt{min-height:0;padding:6px 10px;border-radius:10px;border-left-width:3px;flex-direction:row;flex-wrap:wrap;align-items:baseline;gap:2px 8px}.hs-pulse-rest .hs-pt-l{font-size:11px;flex-basis:100%}.hs-pulse-rest .hs-pt-v{font-size:16px}.hs-pulse-rest .hs-pt-s{font-size:11px;flex:1 1 100%;opacity:.85}
@media (max-width:700px){.hs-pulse-lead .hs-pt{min-height:84px}.hs-pulse-lead .hs-pt-v{font-size:24px}.hs-pulse-rest .hs-pt{min-height:0}.hs-pulse-rest .hs-pt-s{display:none}.hs-pulse-rest .hs-pt-l{flex-basis:auto}}
.hs-pulse{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}@media (min-width:1100px){.hs-pulse{grid-template-columns:repeat(var(--n,6),minmax(0,1fr))}}.hs-pulse.is-stale .hs-pt{opacity:.8}
.hs-pt{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(17,28,46,.95),rgba(11,18,32,.95));border:1px solid rgba(148,163,184,.16);border-left:4px solid #64748b;text-decoration:none;color:#e2e8f0;min-width:0;min-height:92px}
a.hs-pt:hover,a.hs-pt:focus-visible{border-color:#67e8f9;outline:2px solid transparent}
.hs-pt.bad{border-left-color:#ef4444}.hs-pt.warn{border-left-color:#f59e0b}.hs-pt.ok{border-left-color:#22c55e}.hs-pt.info{border-left-color:#38bdf8}.hs-pt.unknown,.hs-pt.skel{border-left-color:#64748b;border-style:dashed;border-left-style:solid}
.hs-pt-l{font-size:12px;font-weight:700;color:#cbd5e1;line-height:1.25}.hs-pt-v{font-size:28px;font-weight:800;line-height:1.1;color:#f8fafc;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:6px}.hs-pt-v.unk{font-size:14px;letter-spacing:.06em;color:#94a3b8;padding:7px 0}.hs-pt-g{font-weight:800}.hs-fleet .chart-k-dist .ch-leg{display:none}a.hs-foot{display:block}.hs-pt-s{font-size:11px;color:#94a3b8;line-height:1.3}
.hs-pt.skel .hs-pt-l{color:#94a3b8}
#home-show-host button.hs-filter{cursor:pointer;background:rgba(15,23,42,.8);color:var(--c,#e2e8f0);border:1px solid var(--c,#94a3b8);min-height:34px;padding:0 12px;border-radius:999px;font:700 12px system-ui;letter-spacing:0;text-transform:none;box-shadow:none}#home-show-host button.hs-filter.on{background:rgba(103,232,249,.16);box-shadow:inset 0 0 0 1px var(--c,#94a3b8)}#home-show-host button.hs-filter i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--c,#94a3b8);margin-right:6px}#home-show-host button.hs-filter:focus-visible{outline:2px solid #67e8f9;outline-offset:2px}
.hs-fleet .hs-chips{margin-bottom:10px}.hs-more{margin:10px 0 4px;min-height:40px}.hs-fleet .chart-k-dist{margin-top:10px}
.hs-decide .hs-dec,.hs-sec .hs-dec{gap:8px}.hs-pi .hs-card-t{font-size:14px;line-height:1.3}.hs-pi{padding:9px 12px}.hs-when{font-size:12px;font-weight:700;color:#fbbf24;margin-left:auto}.hs-why-i{flex-basis:100%}
.hs-4{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px}.hs-4-what{grid-column:1/-1}.hs-4-what dd{font-weight:700;color:#f8fafc}
.hs-wolist{display:grid;gap:8px}.hs-wo{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.14);text-decoration:none;color:#e2e8f0;min-height:52px}.hs-wo:hover,.hs-wo:focus-visible{border-color:#67e8f9;outline:2px solid transparent}
.hs-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;background:linear-gradient(135deg,#1e3a5f,#0f766e);color:#f8fafc;border:1px solid rgba(148,163,184,.35)}
.hs-wo-b{display:flex;flex-direction:column;min-width:0}.hs-wo-b b{font-size:14px;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hs-wo-b .mut{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hs-wo-p{display:flex;flex-direction:column;align-items:flex-end;font-size:12px}.hs-wo-p b{font-size:16px;color:#f8fafc}.hs-scrap{color:#fbbf24;font-weight:700}
.hs-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:10px;align-items:start}.hs-fl{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;padding:10px 12px;border-radius:12px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.14);font-size:13px;color:#e2e8f0}.hs-fl b{font-size:12px;color:#94a3b8;flex-basis:100%;letter-spacing:.02em}.hs-fl.col{flex-direction:column;align-items:stretch}.hs-fl.col b{flex-basis:auto}.hs-fl.wide{grid-column:1/-1}.hs-fl-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:6px 18px}.hs-fl-rows .hs-fl-i{flex-direction:column;gap:0;padding:6px 8px;border-radius:8px;background:rgba(2,6,23,.35)}.hs-charts{align-items:start}
.hs-fl-i{display:flex;justify-content:space-between;gap:10px;color:#e2e8f0;text-decoration:none;font-size:13px;padding:3px 0}.hs-fl-i.d-late span:first-child{color:#fca5a5;font-weight:700}.hs-fl-i.d-due_soon span:first-child{color:#fde68a}
.hs-wo:focus-visible,.hs-filter:focus-visible,.hs-more:focus-visible{outline:2px solid #67e8f9;outline-offset:2px}
@media (max-width:700px){
  .hs-pulse{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(150px,44%);grid-template-columns:none;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:4px;-webkit-overflow-scrolling:touch}.hs-pt{scroll-snap-align:start;min-height:84px}.hs-pt-v{font-size:24px}
  .hs-role{display:none}.hs-machines{grid-template-columns:1fr}.hs-wo{grid-template-columns:36px minmax(0,1fr) auto}.hs-flow{grid-template-columns:1fr}
}
`;
