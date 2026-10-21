import { h } from '../../../../../packages/ui/src/h.js';
import { cncDisplay, cncNotes, CNC_TONE_CSS } from '../../../../../packages/domain/src/cncTelemetry.js';
import { machineStateOf } from '../../../../../packages/domain/src/machineState.js';
import { SEG_KINDS, SEG_TR, SEG_COLOR, INSUFFICIENT_TR, aiStatus, fmtDur, fmtPct, layoutTimeline, pct, } from '../../../../../packages/domain/src/cncActivity.js';
import { isDenied } from './common.js';
import { renderActivityCenter } from './cncActivityCenter.js';
const TR_OFFSET = '+03:00'; // Türkiye: sabit UTC+3 (yaz/kış saati yok)
const NUM = new Intl.NumberFormat('tr-TR');
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmt = (iso) => (iso ? dtf.format(new Date(iso)) : 'BİLİNMİYOR');
const trDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(iso)); // YYYY-MM-DD in Istanbul
const dayStart = (ymd) => `${ymd}T00:00:00${TR_OFFSET}`;
const addDays = (ymd, n) => trDay(new Date(Date.parse(`${ymd}T12:00:00${TR_OFFSET}`) + n * 86400000).toISOString());
const panel = (title, testid, ...kids) => h('section', { class: 'ps-panel', 'data-testid': testid }, h('div', { class: 'ps-panel-h' }, h('h2', {}, title)), ...kids.filter(Boolean));
const small = (t, testid, extra = '') => h('div', { class: 'ps-ts', style: `margin:4px 0;${extra}`, ...(testid ? { 'data-testid': testid } : {}) }, t);
const kvTable = (rows) => h('table', { style: 'width:100%;border-collapse:collapse;font-size:13px' }, ...rows.map(([k, v, tid]) => h('tr', {}, h('td', { style: 'padding:3px 8px 3px 0;color:#94a3b8;white-space:nowrap;vertical-align:top' }, k), h('td', { style: 'padding:3px 0;font-weight:600', ...(tid ? { 'data-testid': tid } : {}) }, v))));
/** Is this machine a CNC machine for passport purposes: classified MACHINING, or it has a bound device. */
export const isCncMachine = (m, row) => m.machineClass === 'MACHINING' || !!row;
async function liveRow(ctx, code) {
    try {
        const rows = await ctx.rpc('cnc_live_states', {});
        return { row: rows.find((r) => r.machineCode === code) ?? null, denied: false };
    }
    catch (e) {
        if (isDenied(e))
            return { row: null, denied: true };
        throw e;
    }
}
/** Section "CNC Canlı İzleme": the standard block of every CNC machine passport. Unsupported fields say BİLGİ YOK; an unconnected machine says so. */
export function liveBlock(m, row, denied, activeWo) {
    if (denied)
        return panel('CNC Canlı İzleme', 'cnc-live', small('CNC canlı verisini görme yetkiniz yok.', 'cnc-live-denied'));
    if (!row)
        return panel('CNC Canlı İzleme', 'cnc-live', small('CNC bağlantısı kurulmadı', 'cnc-live-none', 'font-weight:800;color:#fbbf24'), small('Bu makinede doğrulanmış bir CNC cihaz eşlemesi yok; durum elle girilen kayıttır, fiziksel çalışma doğrulanmaz.'));
    const d = cncDisplay(row);
    const col = CNC_TONE_CSS[d.tone];
    const ms = machineStateOf({ status: m.status, active: Array.from({ length: activeWo }, () => ({ runStatus: 'IN_PROGRESS' })), cnc: row });
    const notes = cncNotes(ms, d);
    const up = d.link === 'UP';
    const NI = 'BİLGİ YOK';
    return panel('CNC Canlı İzleme', 'cnc-live', h('div', { style: `border-left:3px solid ${col};padding:2px 10px` }, h('div', { 'data-testid': 'cnc-live-link', style: `font-weight:800;color:${up ? '#34d399' : '#fbbf24'}` }, d.linkTr), h('div', { 'data-testid': 'cnc-live-state', style: `font-weight:800;color:${col};margin:2px 0` }, `Gerçek durum: ${d.stateTr}`)), d.staleWarning ? small(d.staleWarning, 'cnc-live-stale', 'color:#fbbf24;font-weight:700') : null, kvTable([
        ['Execution', up ? (row.state ? String(row.state).replace('CNC_', '') : NI) : 'güncel değil', 'cnc-f-exec'],
        ['Mil devri', up ? (d.spindleRpm === null ? NI : `${NUM.format(Math.round(d.spindleRpm))} dev/dk`) : 'güncel değil', 'cnc-f-rpm'],
        ['Çalışan NC programı', up ? d.program ?? NI : 'güncel değil', 'cnc-f-program'],
        ['Kontrol modu', up ? row.mode ?? NI : 'güncel değil', 'cnc-f-mode'],
        ['Availability', up ? row.availability ?? NI : 'güncel değil', 'cnc-f-avail'],
        ['Son çevrim süresi', up ? (d.lastCycleS === null ? NI : `${NUM.format(d.lastCycleS)} sn`) : 'güncel değil', 'cnc-f-cycle'],
        ['M30 sayacı', up ? (d.m30Count === null ? NI : `${NUM.format(d.m30Count)} (program çevrimi bitti sayacı — sağlam parça değildir)`) : 'güncel değil', 'cnc-f-m30'],
        ['Acil stop / alarm', up ? d.safetyLine : 'güncel değil', 'cnc-f-safety'],
        ['Besleme hızı / override\'lar', 'Veri yok — bu CNC bağlantısı iletmiyor', 'cnc-f-feed'],
        ['Güç / enerji', 'Veri yok — ölçülmüyor, tahmin edilmez', 'cnc-f-power'],
        ['Talaş kaldırma', 'Doğrulanmadı — mil devri veya program koşması talaş kaldırma kanıtı değildir', 'cnc-f-chip'],
        ['Son veri zamanı', fmt(row.lastSourceTs), 'cnc-f-lastdata'],
        ['Alım zamanı (sunucu)', fmt(row.lastIngestedAt)],
        ['Veri kaynağı', `CNC — operatör beyanı değil · cihaz ${row.deviceSerial}${row.collectorCode ? ` · toplayıcı ${row.collectorCode}` : ''}`, 'cnc-f-source'],
    ]), ...notes.map((n) => small(n, 'cnc-live-note', 'color:#fbbf24')));
}
const rangeFor = (key, nowIso, customFrom, customTo) => {
    const today = trDay(nowIso);
    if (key === 'DAY')
        return { key, day: today, from: dayStart(today), to: nowIso };
    if (key === 'WEEK')
        return { key, from: dayStart(addDays(today, -6)), to: nowIso };
    if (key === 'MONTH')
        return { key, from: dayStart(addDays(today, -29)), to: nowIso };
    const f = customFrom ?? addDays(today, -1), t = customTo ?? today;
    const end = t >= today ? nowIso : dayStart(addDays(t, 1));
    return { key, from: dayStart(f), to: end };
};
export function timelineBar(segs, from, to, onPick) {
    const bar = h('div', { 'data-testid': 'cnc-timeline', role: 'img', 'aria-label': 'CNC faaliyet zaman çizelgesi', style: 'display:flex;height:34px;border-radius:6px;overflow:hidden;background:#1e293b;border:1px solid #334155' });
    for (const b of layoutTimeline(segs, from, to)) {
        const el = h('button', { type: 'button', 'data-testid': 'cnc-seg', 'data-kind': b.kind, title: `${SEG_TR[b.kind]} · ${fmt(new Date(b.startMs).toISOString())} – ${fmt(new Date(b.endMs).toISOString())} · ${fmtDur((b.endMs - b.startMs) / 1000)}`,
            style: `flex:0 0 ${b.widthPct}%;width:${b.widthPct}%;border:0;padding:0;margin:0;background:${SEG_COLOR[b.kind]};opacity:${b.kind === 'NO_DATA' ? '.55' : '1'};cursor:pointer;min-width:1px`, onClick: () => onPick(b.seg, b.kind) });
        bar.append(el);
    }
    return bar;
}
const legend = () => h('div', { 'data-testid': 'cnc-legend', style: 'display:flex;gap:10px;flex-wrap:wrap;margin:6px 0;font-size:12px' }, ...SEG_KINDS.filter((k) => k !== 'UNKNOWN').map((k) => h('span', { style: 'display:inline-flex;align-items:center;gap:4px' }, h('i', { style: `width:10px;height:10px;border-radius:2px;background:${SEG_COLOR[k]};display:inline-block` }), SEG_TR[k])));
function shiftTable(analysis) {
    const th = (t) => h('th', { style: 'text-align:left;padding:4px 8px;color:#94a3b8;font-weight:600;white-space:nowrap' }, t);
    const td = (t, extra = '') => h('td', { style: `padding:4px 8px;white-space:nowrap;${extra}` }, t);
    const rows = analysis.rows.map((r) => h('tr', { 'data-testid': 'cnc-shift-row', 'data-shift': r.shiftCode, 'data-sufficient': String(r.sufficient) }, td(`${r.label} · ${fmt(r.windowFrom).slice(0, 5)}`), td(fmtDur(r.plannedSeconds)), td(fmtPct(r.coveragePct), r.sufficient ? '' : 'color:#fbbf24;font-weight:700'), td(r.sufficient ? fmtDur(r.activeSeconds) : '—'), td(r.sufficient ? fmtPct(r.stoppedPct) : '—'), td(r.sufficient ? fmtDur(r.feedHoldSeconds) : '—'), td(fmtDur(r.noDataSeconds)), td(r.programChanges === null ? 'BİLİNMİYOR' : String(r.programChanges)), td(r.m30Delta === null ? 'BİLİNMİYOR' : String(r.m30Delta)), td(r.cycleMedianS === null ? 'BİLİNMİYOR' : `${NUM.format(r.cycleMedianS)} sn (${r.cycleN})`), td(r.woMatchedActiveSeconds === null ? 'BİLİNMİYOR' : fmtDur(r.woMatchedActiveSeconds)), td(r.woUnmatchedActiveSeconds === null ? 'BİLİNMİYOR' : fmtDur(r.woUnmatchedActiveSeconds))));
    return h('div', { style: 'overflow-x:auto' }, h('table', { style: 'border-collapse:collapse;font-size:12.5px;width:100%' }, h('tr', {}, th('Vardiya'), th('Planlanan'), th('Veri kapsamı'), th('Program aktif'), th('Durmuş %'), th('FEED HOLD'), th('Veri yok'), th('Program değ.'), th('M30 farkı'), th('Çevrim (ortanca, adet)'), th('İş emriyle eşleşen aktif'), th('Eşleşmeyen aktif')), ...rows));
}
function aiSection(analysis) {
    const ai = aiStatus(analysis, 'NONE');
    const body = [h('div', { 'data-testid': 'cnc-ai-status', 'data-status': ai.status, style: `font-weight:800;color:${ai.status === 'INSUFFICIENT_DATA' ? '#fbbf24' : '#94a3b8'};margin:4px 0` }, ai.status === 'INSUFFICIENT_DATA' ? INSUFFICIENT_TR : 'KMI AI yorumu: entegrasyon bekliyor'), small(ai.text, 'cnc-ai-text')];
    if (analysis.status === 'READY') {
        body.push(h('div', { style: 'font-weight:700;margin-top:8px' }, 'Hesaplanan bulgular (yapay zekâ değil — kural tabanlı)'));
        body.push(small(analysis.headline, 'cnc-ai-headline'));
        for (const o of analysis.observations)
            body.push(h('div', { 'data-testid': 'cnc-obs', 'data-id': o.id, style: 'margin:4px 0;font-size:13px' }, `• ${o.text} `, h('span', { style: 'color:#94a3b8' }, `[${o.evidence}]`)));
    }
    if (analysis.recommendations.length) {
        body.push(h('div', { style: 'font-weight:700;margin-top:8px' }, 'Öncelikli öneriler (otomatik görev / bakım emri / üretim kararı oluşturmaz — yetkili kullanıcı onayı gerekir)'));
        for (const r of analysis.recommendations)
            body.push(h('div', { 'data-testid': 'cnc-rec', 'data-id': r.id, style: 'margin:6px 0;padding:6px 8px;border:1px solid #334155;border-radius:6px;font-size:13px' }, h('div', { style: 'font-weight:700' }, `${r.priority}. ${r.finding}`), h('div', {}, `Ölçüm: ${r.measurement}`), h('div', {}, `Vardiya / aralık: ${r.shifts.join(', ') || '—'}`), h('div', {}, `Önerilen kontrol: ${r.action}`), h('div', { style: 'color:#94a3b8' }, `Güven düzeyi: ${r.confidence}`)));
    }
    body.push(small('Operatörleri kişisel olarak sıralamaz, eksik veriden kusur atfetmez. Değerler OEE, verimlilik, sağlam üretim veya prim/puantaj hesabı değildir.', 'cnc-ai-guard'));
    return panel('KMI AI — Son 5 Vardiya Analizi', 'cnc-ai', ...body);
}
export function historyTopic(ctx, m) {
    return {
        id: 'cnc-gecmis', title: 'CNC Faaliyet Geçmişi', icon: 'chart', group: 'CNC', summary: 'Vardiyalar · zaman çizelgesi · olaylar', focus: true,
        async render(host) {
            const lv = await liveRow(ctx, m.code);
            if (lv.denied) {
                host.replaceChildren(h('div', { 'data-testid': 'cnc-history' }, panel('CNC Faaliyet Geçmişi', 'cnc-history-denied', small('CNC verisini görme yetkiniz yok.'))));
                return;
            }
            if (!lv.row) {
                host.replaceChildren(h('div', { 'data-testid': 'cnc-history' }, panel('CNC Faaliyet Geçmişi', 'cnc-history-none', small('CNC bağlantısı kurulmadı', 'cnc-history-none-text', 'font-weight:800;color:#fbbf24'), small('Bu makinede doğrulanmış CNC cihaz eşlemesi yok; faaliyet geçmişi oluşmaz.'))));
                return;
            }
            const wo = await ctx.sel('work_orders', 'id', { machine_id: `eq.${m.id}`, status: 'in.(IN_PROGRESS,FIRST_PIECE_PENDING,FIRST_PIECE_APPROVED)' }, undefined, 10).catch(() => []);
            await renderActivityCenter(ctx, m, host, lv.row.deviceSerial, liveBlock(m, lv.row, false, wo.length));
        },
    };
}
export function liveTopic(ctx, m) {
    return {
        id: 'cnc-canli', title: 'CNC Canlı İzleme', icon: 'cnc', group: 'CNC', summary: 'Bağlantı · durum · mil · program',
        async render(host) {
            const lv = await liveRow(ctx, m.code);
            const wo = await ctx.sel('work_orders', 'id', { machine_id: `eq.${m.id}`, status: 'in.(IN_PROGRESS,FIRST_PIECE_PENDING,FIRST_PIECE_APPROVED)' }, undefined, 10).catch(() => []);
            host.replaceChildren(liveBlock(m, lv.row, lv.denied, wo.length));
        },
    };
}
export const cncTopics = (ctx, m) => (m.machineClass === 'MACHINING' ? [liveTopic(ctx, m), historyTopic(ctx, m)] : []);
void pct;
