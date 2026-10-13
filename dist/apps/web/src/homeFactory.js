// KMI-HOME-001 — management panels on HOME: schematic factory map, machine × shift matrix, KMI Zekâ summary. Everything comes from canonical reads that already exist
// (live_board, machines, command_center, next_best_actions). A failed read renders BİLİNMİYOR for that panel only. Nothing is computed beyond display grouping.
import { h } from '../../../packages/ui/src/index.js';
import { buildFactoryMap, planVsActual, shiftTable } from '../../../packages/domain/src/factoryMap.js';
import { HEADLINE_TR, PHYSICAL_TR } from '../../../packages/domain/src/machineState.js';
import { createLiveApi } from './liveApi.js';
import { createIntelligenceApi } from './intelligenceApi.js';
import { passportHref } from './passport/registry.js';
import { formatStamp } from '../../../packages/domain/src/temporal.js';
export async function loadFactoryData(client, session) {
    const live = createLiveApi(client, session);
    const intel = createIntelligenceApi(client, session);
    const [board, info, work, nba] = await Promise.all([
        live.board('OFFICE').catch(() => null), live.machineInfo().catch(() => []), live.workDetail().catch(() => null), intel.nextActions().catch(() => null)
    ]);
    return { board, info, work, nba };
}
const TONE = { DOWN: 'bad', MAINTENANCE: 'warn', HOLD: 'warn', ACTIVE_WORK_ORDER: 'ok', FIRST_PIECE: 'info', READY_IDLE: 'info', UNKNOWN: 'unknown' };
const GLYPH = { ok: '✓', warn: '!', bad: '✕', info: 'i', unknown: '?' };
const RISK_TR = { HIGH: 'YÜKSEK', MEDIUM: 'ORTA', LOW: 'DÜŞÜK' };
const RISK_TONE = { HIGH: 'bad', MEDIUM: 'warn', LOW: 'info' };
const H = (...a) => h(...a);
const unknownBox = (title, detail, testid) => h('div', { class: 'fp-unknown', 'data-testid': testid }, h('b', {}, `${title}: BİLİNMİYOR`), h('span', {}, ` ${detail}`));
export function renderFactoryPanels(host, d) {
    host.replaceChildren();
    // 1 — schematic factory map
    const mapSec = H('section', { class: 'fp-sec', 'data-testid': 'factory-map' }, h('div', { class: 'kmi-section' }, 'FABRİKA HARİTASI (ŞEMATİK)'));
    if (!d.board)
        mapSec.append(unknownBox('Makine durumları', 'canlı pano okunamadı; hiçbir makine "hazır" varsayılmadı.', 'factory-map-unknown'));
    else {
        const machines = d.board.machines.map((m) => ({ code: m.code, status: m.status, since: m.since, active: m.active, shiftGood: m.shiftGood, shiftScrap: m.shiftScrap, openHolds: m.openHolds, openMaintenance: m.openMaintenance }));
        const map = buildFactoryMap(machines, d.info);
        mapSec.append(h('div', { class: 'kmi-mut', 'data-testid': 'factory-map-note' }, `Gerçek makine kaydından ${map.total} makine · kat planı koordinatı yok, bu yüzden şematik gruplama · "Hazır" ≠ "çalışıyor" · ${PHYSICAL_TR}`));
        for (const g of map.groups) {
            mapSec.append(h('div', { class: 'fp-group', 'data-testid': 'factory-group', 'data-class': g.klass }, h('div', { class: 'fp-gh' }, `${g.label} · ${g.tiles.length}`, ...Object.entries(g.counts).filter(([, n]) => n > 0).map(([k, n]) => h('span', { class: `fp-count ${TONE[k]}` }, `${HEADLINE_TR[k]} ${n}`))), h('div', { class: 'fp-tiles' }, ...g.tiles.map((t) => {
                const tone = TONE[t.headline];
                return h('a', { class: `fp-tile ${tone}`, href: t.id ? passportHref('MACHINE', t.id) : '#/canli', 'data-testid': 'factory-tile', 'data-code': t.code, 'data-headline': t.headline, 'data-conflict': String(t.state.conflict),
                    'aria-label': `Makine ${t.code}: ${HEADLINE_TR[t.headline]}` }, h('b', {}, t.code), h('span', { class: 'fp-st' }, h('i', { 'aria-hidden': 'true' }, GLYPH[tone]), ` ${HEADLINE_TR[t.headline]}`), t.activeWo ? h('span', { class: 'fp-sub' }, `İE ${t.activeWo}`) : null, t.state.conflict ? h('span', { class: 'fp-sub warn' }, 'KAYIT ÇELİŞKİSİ') : null);
            }))));
        }
        if (map.missingFromRegistry.length)
            mapSec.append(h('div', { class: 'kmi-mut', 'data-testid': 'factory-map-missing' }, `Kayıtlı ama canlı panoda olmayan: ${map.missingFromRegistry.join(', ')}`));
        mapSec.append(h('div', { class: 'kmi-mut' }, `Veri anı: ${formatStamp(d.board.generatedAt)} · kaynak: live_board (elle girilen makine durumu; CNC bağlantısı yok)`));
    }
    host.append(mapSec);
    // 2 — machine × shift matrix, plan vs actual
    const mx = H('section', { class: 'fp-sec', 'data-testid': 'machine-matrix' }, h('div', { class: 'kmi-section' }, 'MAKİNE × VARDİYA · PLAN-GERÇEK'));
    if (!d.board)
        mx.append(unknownBox('Matris', 'canlı pano okunamadı.', 'machine-matrix-unknown'));
    else {
        const shift = d.board.shift ?? 'vardiya bilinmiyor';
        mx.append(h('div', { class: 'fp-scroll' }, h('table', { class: 'fp-table' }, h('thead', {}, h('tr', {}, ...['Makine', 'Durum', 'Aktif iş', `Mevcut vardiya (${shift}) iyi / hurda`, 'Açık HOLD / bakım'].map((t) => h('th', {}, t)))), h('tbody', {}, ...d.board.machines.map((m) => h('tr', { 'data-testid': 'matrix-row', 'data-code': m.code }, h('td', {}, m.code), h('td', {}, m.status), h('td', {}, m.active.length ? m.active.map((a) => `${a.wo}${a.operator ? ` (${a.operator})` : ''}`).join(', ') : '—'), h('td', {}, Number.isFinite(m.shiftGood) ? `${m.shiftGood} / ${m.shiftScrap}` : 'BİLİNMİYOR'), h('td', {}, `${m.openHolds} / ${m.openMaintenance}`)))))));
        const st = shiftTable(d.board.shiftCompare ?? []);
        mx.append(h('div', { class: 'fp-scroll' }, h('table', { class: 'fp-table', 'data-testid': 'shift-compare' }, h('thead', {}, h('tr', {}, h('th', {}, 'Gün'), h('th', {}, 'Vardiya 1 (08–16) iyi / hurda'), h('th', {}, 'Vardiya 2 (16–24) iyi / hurda'))), h('tbody', {}, ...st.slice(0, 5).map((r) => h('tr', {}, h('td', {}, r.day), ...['TeamK1', 'TeamK2'].map((k) => h('td', {}, r.shifts[k] ? `${r.shifts[k].good} / ${r.shifts[k].scrap}` : 'KAYIT YOK'))))))));
        mx.append(h('div', { class: 'kmi-mut' }, 'Gece vardiyası tanımsız (00–08) — verisi gösterilmez. Makine bazında planlı adet kaydı yoktur; plan-gerçek iş emri düzeyindedir:'));
        if (d.work === null)
            mx.append(unknownBox('Plan-gerçek', 'komuta merkezi iş emri ayrıntısı okunamadı.', 'plan-actual-unknown'));
        else
            mx.append(h('div', { class: 'fp-scroll' }, h('table', { class: 'fp-table', 'data-testid': 'plan-actual' }, h('thead', {}, h('tr', {}, ...['Makine', 'Ürün', 'Plan', 'Üretilen', 'Hurda', 'Gerçekleşme'].map((t) => h('th', {}, t)))), h('tbody', {}, ...(d.work.length ? d.work.map((w) => { const p = planVsActual(w.qtyPlanned, w.qtyProduced); return h('tr', { 'data-testid': 'plan-actual-row' }, h('td', {}, w.machineCode ?? '—'), h('td', {}, w.productCode ?? '—'), h('td', {}, String(w.qtyPlanned)), h('td', {}, String(w.qtyProduced)), h('td', {}, String(w.qtyScrap)), h('td', {}, p.pct === null ? 'BİLİNMİYOR' : `%${p.pct}`)); })
                : [h('tr', {}, h('td', { colSpan: 6 }, 'Çalışan iş emri yok'))])))));
    }
    host.append(mx);
    // 3 — KMI Zekâ summary (rule-based, evidence classified)
    const ai = H('section', { class: 'fp-sec', 'data-testid': 'intel-summary' }, h('div', { class: 'kmi-section' }, 'KMI ZEKÂ ÖZETİ'));
    if (d.nba === null)
        ai.append(unknownBox('Öneriler', 'next_best_actions okunamadı.', 'intel-unknown'));
    else if (!d.nba.length)
        ai.append(h('div', { class: 'kmi-mut', 'data-testid': 'intel-empty' }, 'Şu an kayıtlara dayalı öneri yok. (Boş liste "her şey yolunda" demek değildir; yalnız kuralların tetiklenmediğini gösterir.)'));
    else {
        ai.append(h('div', { class: 'kmi-mut' }, 'Kural tabanlı, kayıtlardan; dış yapay zekâ yok. Öneri hiçbir işlemi kendisi yapmaz.'));
        for (const n of d.nba.slice(0, 5))
            ai.append(h('a', { class: `fp-nba ${RISK_TONE[n.risk]}`, href: `#${n.source.route}`.replace('##', '#'), 'data-testid': 'intel-item', 'data-risk': n.risk }, h('b', {}, n.titleTr), h('span', { class: `fp-count ${RISK_TONE[n.risk]}` }, RISK_TR[n.risk] ?? n.risk), h('span', { class: 'fp-sub' }, n.reasonTr), h('span', { class: 'fp-sub' }, `Kanıt sınıfı: KAYIT ÜZERİNDEN KURAL · Etki: ${n.effectTr}`)));
        if (d.nba.length > 5)
            ai.append(h('a', { href: '#/zeka', class: 'kmi-link' }, `Tümü (${d.nba.length}) →`));
    }
    host.append(ai);
}
