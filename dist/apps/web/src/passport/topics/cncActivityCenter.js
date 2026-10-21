// KMI CNC FAALİYET MERKEZİ — ONE component for every CNC machine passport (not 109-specific). Data comes only from the database read models:
// cnc_shift_board (0141; falls back to cnc_shift_summaries of 0129), cnc_activity, cnc_activity_summary, cnc_events. Nothing here measures a duration or decides a state.
// MTConnect/CNC signal and operator declarations are never mixed: every number on this page is the controller signal; a missing signal is shown as "Veri yok", never as a stop.
import { h } from '../../../../../packages/ui/src/h.js';
import { SEG_COLOR, SEG_TR, EVENT_TR, MIN_COVERAGE_PCT, analyseShifts, durationTiles, fmtDur, fmtPct } from '../../../../../packages/domain/src/cncActivity.js';
import { axisTicks, boardRows, clusterSegments, compareSameElapsed, scopeOf } from '../../../../../packages/domain/src/cncShiftBoard.js';
import { isDenied } from './common.js';
const el = (tag, props = null, ...kids) => h(tag, props, ...kids.filter((k) => k !== null && k !== false));
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const hm = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtHm = (iso) => hm.format(new Date(iso));
const fmt = (iso) => (iso === null || iso === undefined ? 'BİLİNMİYOR' : dtf.format(new Date(iso)));
const small = (t, testid, extra = '') => el('div', { class: 'cac-note', style: extra, ...(testid ? { 'data-testid': testid } : {}) }, t);
const panel = (title, testid, ...kids) => el('section', { class: 'cac-panel', 'data-testid': testid }, el('h2', { class: 'cac-h' }, title), ...kids);
export const CAC_CSS = `
.cac{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;min-width:0}.cac *{box-sizing:border-box}
.cac-panel{border:1px solid #334155;border-radius:12px;padding:12px 14px;background:rgba(15,23,42,.55);min-width:0}.cac-h{margin:0 0 8px;font-size:15px;font-weight:800;color:#f1f5f9}
.cac-note{font-size:13px;line-height:1.45;color:#a8b5c8;margin:4px 0;overflow-wrap:anywhere}
.cac-scope{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.cac-btn{min-height:40px;padding:6px 12px;border-radius:8px;border:1px solid #475569;background:transparent;color:#e2e8f0;font-size:14px;font-weight:600;cursor:pointer}
.cac-btn[aria-pressed=true]{background:#0e7490;border-color:#22d3ee;color:#fff}.cac-btn:hover{border-color:#94a3b8}.cac-btn.sm{min-height:34px;padding:4px 10px;font-size:13px}
.cac-scope input[type=date]{min-height:40px;border:1px solid #475569;border-radius:8px;background:#0f172a;color:#e2e8f0;padding:4px 8px;color-scheme:dark}
.cac-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.cac-kpi{border:1px solid #334155;border-left:4px solid var(--c,#64748b);border-radius:8px;padding:8px 10px;min-width:0}.cac-kpi .l{font-size:12.5px;color:#a8b5c8}.cac-kpi .v{font-size:20px;font-weight:800;color:#f8fafc;margin:2px 0}.cac-kpi .n{font-size:12px;color:#94a3b8}
.cac-cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.cac-cmp>div{border:1px dashed #475569;border-radius:8px;padding:6px 10px;font-size:13px}.cac-cmp b{display:block;font-size:15px}
.cac-tl-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.cac-row{margin:8px 0}.cac-row-h{font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:2px;display:flex;gap:8px;flex-wrap:wrap}.cac-row-h span{font-weight:500;color:#94a3b8}
.cac-axis{position:relative;height:22px;border-bottom:1px solid #475569;margin-bottom:2px;overflow:hidden}.cac-tick{position:absolute;top:0;bottom:0;border-left:1px solid #475569;padding-left:3px;font-size:11.5px;color:#cbd5e1;white-space:nowrap;transform:translateX(0)}.cac-tick.major{border-left-color:#94a3b8;font-weight:700}
.cac-track{position:relative;height:44px;border-radius:6px;overflow:hidden;background:#1e293b;border:1px solid #334155;touch-action:pan-y;user-select:none}
.cac-seg{position:absolute;top:0;bottom:0;border:0;padding:0;margin:0;cursor:pointer;min-width:4px}.cac-seg:focus-visible{outline:2px solid #fff;outline-offset:-2px}
.cac-seg.cl{background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.35) 0 3px,transparent 3px 6px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.55)}
.cac-seg.nd{opacity:.6}.cac-brush{position:absolute;top:0;bottom:0;background:rgba(255,255,255,.18);border-left:2px solid #fff;border-right:2px solid #fff;pointer-events:none}
.cac-legend{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0;font-size:13px}.cac-legend span{display:inline-flex;align-items:center;gap:5px}.cac-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
.cac-detail{margin:8px 0;padding:8px 10px;border:1px dashed #475569;border-radius:8px;font-size:13.5px}
.cac-tip{position:fixed;z-index:50;pointer-events:none;background:#0b1220;border:1px solid #64748b;border-radius:8px;padding:6px 9px;font-size:12.5px;line-height:1.4;color:#f1f5f9;max-width:260px;box-shadow:0 6px 20px rgba(0,0,0,.5)}
.cac-wrap{overflow-x:auto;max-width:100%}.cac-t{border-collapse:collapse;width:100%;font-size:13.5px}.cac-t th{text-align:left;padding:6px 8px;color:#a8b5c8;font-weight:700;white-space:nowrap;border-bottom:1px solid #334155}.cac-t td{padding:7px 8px;border-top:1px solid #1e293b;vertical-align:top}
.cac-t tr.emph td{background:rgba(14,116,144,.16)}.cac-t tr.live td:first-child{border-left:4px solid #34d399}.cac-t tr.sel td{outline:1px solid #22d3ee}.cac-t tr[data-clickable]{cursor:pointer}.cac-t tr[data-clickable]:hover td{background:rgba(148,163,184,.08)}
.cac-chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:800}.cac-chip.live{background:#064e3b;color:#6ee7b7;border:1px solid #34d399}.cac-chip.done{background:#1e293b;color:#cbd5e1;border:1px solid #475569}.cac-chip.warn{background:#422006;color:#fcd34d;border:1px solid #f59e0b}
.cac-cards{display:none;gap:8px}.cac-card{border:1px solid #334155;border-radius:10px;padding:10px;min-width:0}.cac-card.emph{border-color:#22d3ee}.cac-card .g{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:13px;margin-top:6px}
@media (max-width:760px){.cac-t.board{display:none}.cac-cards{display:grid}.cac-kpi .v{font-size:18px}.cac-btn{min-height:44px}}
.cac details>summary{cursor:pointer;font-weight:700;color:#cbd5e1;min-height:36px;display:flex;align-items:center}
`;
export async function renderActivityCenter(ctx, m, host, deviceSerial, liveNode) {
    const code = m.code;
    const now = ctx.nowIso();
    const root = el('div', { class: 'cac', 'data-testid': 'cnc-history' });
    host.replaceChildren(el('style', {}, CAC_CSS), root);
    const st = { scope: null, custom: { f: '', t: '' }, board: [], boardMode: 'BOARD', view: { z: 1, pos: 0 }, brush: null, mode: 'PAN' };
    const scopeBar = el('div', { class: 'cac-scope', 'data-testid': 'cnc-scope-bar', role: 'group', 'aria-label': 'Kapsam' });
    const info = el('div', {});
    const kpiHost = el('div', {});
    const cmpHost = el('div', {});
    const tlHost = el('div', {});
    const evHost = el('div', {});
    const boardHost = el('div', {});
    const aiHost = el('div', {});
    const tip = el('div', { class: 'cac-tip', 'data-testid': 'cnc-tip', style: 'display:none' });
    root.append(panel('Kapsam', 'cnc-scope-panel', scopeBar, info), kpiHost, cmpHost, tlHost, boardHost, evHost, aiHost, tip);
    if (liveNode)
        root.append(el('details', { 'data-testid': 'cnc-live-fold' }, el('summary', {}, 'Canlı durum ayrıntısı (anlık değerler)'), liveNode));
    // ───────── data
    const argsOf = (from, to) => ({ p_machine_code: code, p_from: from, p_to: to });
    const loadBoard = async () => {
        try {
            const b = await ctx.rpc('cnc_shift_board', { p_machine_code: code, p_completed: 10, p_now: now });
            st.board = Array.isArray(b) ? b : [];
            st.boardMode = 'BOARD';
        }
        catch (e) {
            if (isDenied(e))
                throw e;
            // 0141 not installed yet: completed shifts only — the running shift is NOT invented
            const old = await ctx.rpc('cnc_shift_summaries', { p_machine_code: code, p_last: 10, p_now: now });
            st.board = (Array.isArray(old) ? old : []).map((s) => ({ ...s, shiftDate: (s.windowFrom ?? '').slice(0, 10), isActive: false, elapsedSeconds: s.windowSeconds, previousSameElapsed: null }));
            st.boardMode = 'COMPLETED_ONLY';
        }
    };
    const selectScope = (key, shiftIndex) => { st.scope = scopeOf(key, now, st.board, st.custom, shiftIndex); st.view = { z: 1, pos: 0 }; st.brush = null; void loadScope(); };
    // ───────── scope bar
    const drawScope = () => {
        const hasActive = st.board.some((s) => s.isActive);
        const k = st.scope?.key;
        const btn = (key, label, tid, disabled = false) => el('button', { type: 'button', class: 'cac-btn', 'data-testid': tid, 'aria-pressed': String(k === key), ...(disabled ? { disabled: 'disabled', title: 'Bu kapsam için vardiya verisi yok' } : {}), onClick: () => selectScope(key) }, label);
        const f = el('input', { type: 'date', 'data-testid': 'cnc-range-from', value: st.custom.f, 'aria-label': 'Başlangıç', onChange: (e) => { st.custom.f = e.target.value; } });
        const t = el('input', { type: 'date', 'data-testid': 'cnc-range-to', value: st.custom.t, 'aria-label': 'Bitiş', onChange: (e) => { st.custom.t = e.target.value; } });
        scopeBar.replaceChildren(btn('ACTIVE', 'Aktif Vardiya', 'cnc-scope-active', !hasActive), btn('PREV', 'Önceki Vardiya', 'cnc-scope-prev', st.board.length === 0), btn('DAY', 'Gün', 'cnc-range-day'), btn('WEEK', 'Hafta', 'cnc-range-week'), btn('MONTH', 'Ay', 'cnc-range-month'), el('span', { class: 'cac-note', style: 'margin:0 2px' }, 'Özel:'), f, t, el('button', { type: 'button', class: 'cac-btn', 'data-testid': 'cnc-range-custom', 'aria-pressed': String(k === 'CUSTOM'), onClick: () => selectScope('CUSTOM') }, 'Uygula'));
    };
    // ───────── KPI + comparison
    const kpiTile = (key, label, value, color, note) => el('div', { class: 'cac-kpi', 'data-testid': 'cnc-tile', 'data-key': key, style: `--c:${color}` }, el('div', { class: 'l' }, label), el('div', { class: 'v' }, value), note ? el('div', { class: 'n' }, note) : null);
    const drawKpis = (sum, label) => {
        if (!sum) {
            kpiHost.replaceChildren(panel('Faaliyet özeti', 'cnc-summary', small('Özet okunamadı. Süre uydurulmaz.')));
            return;
        }
        const t = durationTiles(sum);
        const alarm = sum.seconds.ALARM ?? 0;
        kpiHost.replaceChildren(panel(`Faaliyet özeti — ${label}`, 'cnc-summary', el('div', { class: 'cac-kpis' }, ...t.map((x) => kpiTile(x.key, x.label, fmtDur(x.seconds), SEG_COLOR[x.key === 'COVERAGE' ? 'UNKNOWN' : x.key], `${fmtPct(x.pctOfWindow)}${x.note ? ` · ${x.note}` : ''}`)), kpiTile('ALARM', 'Alarm / acil duruş', fmtDur(alarm), SEG_COLOR.ALARM, fmtPct(sum.windowSeconds > 0 ? (alarm / sum.windowSeconds) * 100 : null)), kpiTile('COVERAGE', 'Veri kapsamı', fmtPct(sum.coveragePct), '#94a3b8', (sum.coveragePct ?? 0) < MIN_COVERAGE_PCT ? `%${MIN_COVERAGE_PCT} altı — yorumlanmaz` : 'CNC kontrolünden gelen veri'), kpiTile('CYCLES', 'Doğrulanabilir çevrim olayı', sum.cycleEvents === null ? 'BİLİNMİYOR' : String(sum.cycleEvents), '#a78bfa', `M30 sayacı farkı: ${sum.m30Delta ?? 'BİLİNMİYOR'}`), kpiTile('PROGRAMS', 'Program değişimi', sum.programChanges === null ? 'BİLİNMİYOR' : String(sum.programChanges), '#38bdf8')), small(`Pencere: ${fmt(sum.from)} – ${fmt(sum.to)} · ${fmtDur(sum.windowSeconds)}. Program aktif süresi, CNC kontrolünün “program koşuyor” bildirdiği süredir; talaş kaldırma veya gerçek spindle çalışma süresi değildir. “Veri yok” otomatik duruş sayılmaz.`, 'cnc-summary-note')));
    };
    const drawCompare = () => {
        const a = st.board.find((s) => s.isActive);
        const c = compareSameElapsed(a);
        if (!a) {
            cmpHost.replaceChildren();
            return;
        }
        cmpHost.replaceChildren(panel(`Aynı geçen süre karşılaştırması — ${fmtDur(a.elapsedSeconds)}`, 'cnc-compare', c ? el('div', { class: 'cac-cmp' }, ...c.items.map((i) => el('div', { 'data-testid': 'cnc-cmp-item', 'data-key': i.key }, el('span', { class: 'cac-note' }, i.label), el('b', {}, fmtDur(i.now)), el('span', { class: 'cac-note', style: 'margin:0' }, `${c.prevLabel}: ${fmtDur(i.prev)} (${i.delta >= 0 ? '+' : '−'}${fmtDur(Math.abs(i.delta))})`))))
            : small(a.previousSameElapsed ? `Karşılaştırma yapılamıyor: iki vardiyadan birinde CNC veri kapsamı %${MIN_COVERAGE_PCT} altında. Eksik veriden başarı/başarısızlık yüzdesi üretilmez.` : 'Önceki vardiya verisi bulunamadı.', 'cnc-compare-none'), small('Aktif vardiya, tamamlanmış sekiz saatlik vardiya gibi hesaplanmaz: yalnız geçen süre karşılaştırılır.')));
    };
    // ───────── timeline
    const trackWidth = () => Math.max(260, Math.floor((tlHost.clientWidth || root.clientWidth || 900) - 36));
    let rows = [];
    let rowSum = null;
    let selectedEv = null;
    const detail = el('div', { class: 'cac-detail', 'data-testid': 'cnc-seg-detail' }, 'Ayrıntı için çizelgede bir aralığa tıklayın.');
    const showTip = (e, html) => { tip.replaceChildren(...html.map((t, i) => el('div', i === 0 ? { style: 'font-weight:800' } : {}, t))); tip.style.display = 'block'; tip.style.left = `${Math.min(window.innerWidth - 270, e.clientX + 12)}px`; tip.style.top = `${Math.min(window.innerHeight - 110, e.clientY + 14)}px`; };
    const hideTip = () => { tip.style.display = 'none'; };
    const kv = (rowsKv) => el('table', { style: 'width:100%;border-collapse:collapse;font-size:13.5px' }, ...rowsKv.map(([k, v]) => el('tr', {}, el('td', { style: 'padding:2px 10px 2px 0;color:#94a3b8;white-space:nowrap;vertical-align:top' }, k), el('td', { style: 'padding:2px 0;font-weight:600;overflow-wrap:anywhere' }, v))));
    const drawTimeline = () => {
        const w = trackWidth();
        const tools = el('div', { class: 'cac-tl-tools' }, el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-zoom-in', onClick: () => zoom(2) }, '＋ Yakınlaştır'), el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-zoom-out', onClick: () => zoom(0.5) }, '－ Uzaklaştır'), el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-pan-left', onClick: () => pan(-0.5) }, '◀'), el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-pan-right', onClick: () => pan(0.5) }, '▶'), el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-zoom-reset', onClick: () => { st.view = { z: 1, pos: 0 }; drawTimeline(); } }, 'Tümü'), el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-mode-brush', 'aria-pressed': String(st.mode === 'BRUSH'), onClick: () => { st.mode = st.mode === 'BRUSH' ? 'PAN' : 'BRUSH'; drawTimeline(); } }, st.mode === 'BRUSH' ? 'Aralık seçiliyor — sürükleyin' : 'Aralık seç'), st.brush ? el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-brush-clear', onClick: () => { st.brush = null; selectedEv = null; void loadSelection(null); drawTimeline(); } }, 'Seçimi temizle') : null, el('span', { class: 'cac-note', style: 'margin:0' }, `Yakınlaştırma ×${st.view.z}`));
        const rowEls = rows.map((r) => {
            const fromMs = Date.parse(r.from), toMs = Date.parse(r.to), span = toMs - fromMs;
            const vf = fromMs + span * st.view.pos, vt = vf + span / st.view.z;
            const ticks = axisTicks(vf, vt, w);
            const items = clusterSegments(r.segs, vf, vt, w, 4);
            const track = el('div', { class: 'cac-track', 'data-testid': 'cnc-timeline', role: 'img', 'aria-label': `CNC faaliyet zaman çizelgesi — ${r.label}`, style: 'width:100%' });
            for (const it of items) {
                const seg = it.seg;
                const kindsTxt = Object.entries(it.kinds).map(([k, ms]) => `${SEG_TR[k]} ${fmtDur(ms / 1000)}`).join(' · ');
                const title = it.cluster ? `${it.count} kısa olay · ${fmt(it.startMs)} – ${fmt(it.endMs)} · ${kindsTxt}` : `${SEG_TR[it.kind]} · ${fmt(it.startMs)} – ${fmt(it.endMs)} · ${fmtDur((it.endMs - it.startMs) / 1000)}`;
                const b = el('button', { type: 'button', class: `cac-seg${it.cluster ? ' cl' : ''}${it.kind === 'NO_DATA' ? ' nd' : ''}`, 'data-testid': it.cluster ? 'cnc-cluster' : 'cnc-seg', 'data-kind': it.kind, 'data-count': String(it.count), title, 'aria-label': title,
                    style: `left:${it.leftPct}%;width:${it.widthPct}%;background:${SEG_COLOR[it.kind]}`,
                    onClick: () => {
                        if (st.mode === 'BRUSH')
                            return;
                        selectedEv = { from: it.startMs, to: it.endMs };
                        if (it.cluster) {
                            detail.replaceChildren(kv([['Küme', `${it.count} kısa olay`], ['Başlangıç', fmt(it.startMs)], ['Bitiş', fmt(it.endMs)], ['Dağılım', kindsTxt], ['Not', 'Yakınlaştırarak tek tek görebilirsiniz.']]), el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-cluster-zoom', onClick: () => zoomTo(r, it.startMs, it.endMs) }, 'Bu kümeye yakınlaş'));
                        }
                        else
                            detail.replaceChildren(kv([['Başlangıç', fmt(it.startMs)], ['Bitiş', fmt(it.endMs)], ['Süre', fmtDur((it.endMs - it.startMs) / 1000)], ['Durum', SEG_TR[it.kind]], ['Program', seg?.program ?? 'BİLGİ YOK'],
                                ['Veri kaynağı', it.kind === 'NO_DATA' ? 'Veri yok — bağlantı kaybı veya bilinmeyen (duruş sayılmaz)' : `CNC kontrolü (MTConnect) — cihaz ${deviceSerial}`]]));
                        void loadEventsFor(it.startMs, it.endMs);
                    } });
                b.addEventListener('pointerenter', (e) => showTip(e, [it.cluster ? `${it.count} kısa olay` : SEG_TR[it.kind], `${fmt(it.startMs)} – ${fmt(it.endMs)}`, it.cluster ? kindsTxt : fmtDur((it.endMs - it.startMs) / 1000), it.kind === 'NO_DATA' ? 'Kaynak: veri yok' : `Kaynak: CNC ${deviceSerial}${seg?.program ? ` · ${seg.program}` : ''}`]));
                b.addEventListener('pointermove', (e) => showTip(e, [it.cluster ? `${it.count} kısa olay` : SEG_TR[it.kind], `${fmt(it.startMs)} – ${fmt(it.endMs)}`, it.cluster ? kindsTxt : fmtDur((it.endMs - it.startMs) / 1000), it.kind === 'NO_DATA' ? 'Kaynak: veri yok' : `Kaynak: CNC ${deviceSerial}${seg?.program ? ` · ${seg.program}` : ''}`]));
                b.addEventListener('pointerleave', hideTip);
                track.append(b);
            }
            if (st.brush) {
                const l = Math.max(0, (st.brush.a - vf) / (vt - vf)), rr = Math.min(1, (st.brush.b - vf) / (vt - vf));
                if (rr > l && st.brush.a >= fromMs - 1 && st.brush.b <= toMs + 1)
                    track.append(el('div', { class: 'cac-brush', 'data-testid': 'cnc-brush', style: `left:${l * 100}%;width:${(rr - l) * 100}%` }));
            }
            // drag: pan (zoomed) or brush. Move/up are listened on the DOCUMENT so a redraw during the drag cannot lose the pointer.
            const msAt = (x) => { const bb = track.getBoundingClientRect(); return vf + ((x - bb.left) / Math.max(1, bb.width)) * (vt - vf); };
            track.addEventListener('pointerdown', (e) => {
                if (e.target.closest('button.cac-seg') && st.mode !== 'BRUSH' && st.view.z === 1)
                    return;
                const start = { x: e.clientX, pos: st.view.pos, a: msAt(e.clientX), wpx: Math.max(1, track.getBoundingClientRect().width) };
                let moved = false;
                const move = (ev) => {
                    if (st.mode === 'BRUSH') {
                        const a = Math.min(start.a, msAt(ev.clientX)), b = Math.max(start.a, msAt(ev.clientX));
                        st.brush = { a: Math.max(fromMs, a), b: Math.min(toMs, b) };
                        moved = true;
                        let br = track.querySelector('.cac-brush');
                        if (!br) {
                            br = el('div', { class: 'cac-brush', 'data-testid': 'cnc-brush' });
                            track.append(br);
                        }
                        const l = Math.max(0, (st.brush.a - vf) / (vt - vf)), rr = Math.min(1, (st.brush.b - vf) / (vt - vf));
                        br.style.left = `${l * 100}%`;
                        br.style.width = `${Math.max(0, rr - l) * 100}%`;
                    }
                    else if (st.view.z > 1) {
                        const dx = (ev.clientX - start.x) / start.wpx;
                        st.view.pos = Math.min(1 - 1 / st.view.z, Math.max(0, start.pos - dx / st.view.z));
                        moved = true;
                        drawTimelineSoft();
                    }
                };
                const up = () => {
                    document.removeEventListener('pointermove', move);
                    document.removeEventListener('pointerup', up);
                    if (moved && st.mode === 'BRUSH' && st.brush && st.brush.b - st.brush.a > 1000) {
                        selectedEv = { from: st.brush.a, to: st.brush.b };
                        void loadSelection(st.brush);
                        drawTimeline();
                    }
                };
                document.addEventListener('pointermove', move);
                document.addEventListener('pointerup', up);
            });
            track.addEventListener('wheel', (e) => { if (!e.ctrlKey)
                return; e.preventDefault(); zoom(e.deltaY < 0 ? 2 : 0.5); }, { passive: false });
            return el('div', { class: 'cac-row', 'data-testid': 'cnc-tl-row', 'data-row': r.key }, el('div', { class: 'cac-row-h' }, r.label, el('span', {}, r.sub)), el('div', { class: 'cac-axis', 'data-testid': 'cnc-axis', style: 'width:100%' }, ...ticks.map((t) => el('div', { class: `cac-tick${t.major ? ' major' : ''}`, style: t.leftPct > 88 ? `right:${100 - t.leftPct}%;border-left:0;border-right:1px solid #94a3b8;padding:0 3px 0 0` : `left:${t.leftPct}%` }, t.label))), track);
        });
        tlHost.replaceChildren(panel('Zaman çizelgesi', 'cnc-timeline-panel', tools, ...rowEls, legend(), detail, st.scope?.key === 'ACTIVE' || st.scope?.key === 'PREV' ? otherShifts() : null, small('Çok kısa olaylar kaybolmaz: yoğun alanlarda taralı küme olarak gösterilir; kümeye tıklayın veya yakınlaşın. Gri: veri yok/bilinmeyen (duruş sayılmaz).')));
    };
    let softPending = false;
    const drawTimelineSoft = () => { if (softPending)
        return; softPending = true; requestAnimationFrame(() => { softPending = false; drawTimeline(); }); };
    const zoom = (f) => { const z = Math.max(1, Math.min(64, st.view.z * f)); const center = st.view.pos + 0.5 / st.view.z; st.view.z = z; st.view.pos = Math.min(1 - 1 / z, Math.max(0, center - 0.5 / z)); drawTimeline(); };
    const pan = (d) => { st.view.pos = Math.min(1 - 1 / st.view.z, Math.max(0, st.view.pos + d / st.view.z)); drawTimeline(); };
    const zoomTo = (r, a, b) => { const f = Date.parse(r.from), span = Date.parse(r.to) - f; const z = Math.max(1, Math.min(64, span / Math.max(60000, (b - a) * 1.6))); st.view.z = z; st.view.pos = Math.min(1 - 1 / z, Math.max(0, (a - f) / span - (0.5 / z - (b - a) / (2 * span)))); drawTimeline(); };
    const legend = () => el('div', { class: 'cac-legend', 'data-testid': 'cnc-legend' }, ...[['ACTIVE', 'Program aktif'], ['STOPPED', 'CNC durmuş'], ['FEED_HOLD', 'FEED HOLD'], ['ALARM', 'Alarm / acil duruş'], ['INTERRUPTED', 'Kesinti / bekleme (kanıtlıysa)'], ['NO_DATA', 'Veri yok / bilinmeyen']].map(([k, t]) => el('span', {}, el('i', { style: `background:${SEG_COLOR[k]}` }), t)));
    const otherShifts = () => el('details', { 'data-testid': 'cnc-other-shifts' }, el('summary', {}, 'Diğer vardiyaları çizelgeye ekle'), el('div', { class: 'cac-scope' }, ...st.board.map((s, i) => ({ s, i })).filter(({ s, i }) => i >= 2 && !rows.some((r) => r.key === `s${i}`)).map(({ s, i }) => el('button', { type: 'button', class: 'cac-btn sm', 'data-testid': 'cnc-add-shift', 'data-index': String(i), onClick: () => void addRow(i) }, `${s.label} · ${s.shiftDate}`))));
    const addRow = async (i) => { const s = st.board[i]; if (!s)
        return; try {
        const segs = await ctx.rpc('cnc_activity', argsOf(s.windowFrom, s.isActive ? now : s.windowTo));
        rows.push({ key: `s${i}`, label: `${s.label} · ${s.shiftDate}`, sub: s.isActive ? 'devam ediyor' : 'tamamlandı', from: s.windowFrom, to: s.isActive ? now : s.windowTo, segs });
        drawTimeline();
    }
    catch {
        tlHost.append(small('Bu vardiyanın çizelgesi okunamadı.'));
    } };
    // ───────── events (filtered by scope / clicked segment / brush)
    const drawEvents = (ev, label, err) => {
        evHost.replaceChildren(panel(`Olay geçmişi — ${label}`, 'cnc-events', err ? small(err, 'cnc-events-error', 'color:#fbbf24') : !ev || !ev.length ? small('Bu aralıkta olay yok.') :
            el('div', { style: 'max-height:340px;overflow:auto' }, el('table', { class: 'cac-t' }, ...ev.map((e) => el('tr', { 'data-testid': 'cnc-event', 'data-kind': e.kind }, el('td', { style: 'white-space:nowrap;color:#a8b5c8' }, fmt(e.at)), el('td', {}, EVENT_TR[e.kind] ?? e.kind), el('td', { class: 'cac-note', style: 'margin:0' }, e.detail ? Object.entries(e.detail).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') : '')))))));
    };
    const loadEventsFor = async (a, b) => { try {
        const ev = await ctx.rpc('cnc_events', { ...argsOf(new Date(a).toISOString(), new Date(Math.max(b, a + 1000)).toISOString()), p_limit: 300 });
        drawEvents(ev, `${fmt(a)} – ${fmt(b)}`);
    }
    catch (e) {
        drawEvents(null, '', isDenied(e) ? 'Bu bölümü görme yetkiniz yok.' : 'Olaylar okunamadı.');
    } };
    const loadSelection = async (br) => {
        if (!br) {
            await loadScope(true);
            return;
        }
        const from = new Date(br.a).toISOString(), to = new Date(br.b).toISOString();
        try {
            const [sum, ev] = await Promise.all([ctx.rpc('cnc_activity_summary', argsOf(from, to)), ctx.rpc('cnc_events', { ...argsOf(from, to), p_limit: 300 })]);
            drawKpis(sum, `seçili aralık ${fmt(br.a)} – ${fmt(br.b)}`);
            drawEvents(ev, 'seçili aralık');
        }
        catch {
            kpiHost.replaceChildren(panel('Faaliyet özeti', 'cnc-summary', small('Seçili aralık özeti okunamadı.')));
        }
    };
    // ───────── shift board
    const drawBoard = () => {
        const rowsB = boardRows(st.board, fmtDur);
        const done = st.board.filter((s) => !s.isActive);
        const cells = (r) => [
            r.sufficient ? fmtDur(r.activeSeconds) : 'yetersiz veri', r.sufficient ? fmtDur(r.stoppedSeconds) : 'yetersiz veri', fmtDur(r.alarmSeconds), fmtDur(r.noDataSeconds), r.cycleEvents === null ? 'BİLİNMİYOR' : String(r.cycleEvents)
        ];
        const chipOf = (r) => el('span', { class: `cac-chip ${r.isActive ? 'live' : 'done'}` }, r.statusTr);
        const table = el('div', { class: 'cac-wrap' }, el('table', { class: 'cac-t board', 'data-testid': 'cnc-shift-table' }, el('thead', {}, el('tr', {}, ...['Vardiya', 'Durum', 'Veri kapsamı', 'Program aktif', 'CNC durmuş', 'Alarm', 'Veri yok', 'Çevrim'].map((x) => el('th', {}, x)))), el('tbody', {}, ...rowsB.flatMap((r) => {
            const sel = st.scope?.shiftIndex === r.index;
            const c = cells(r);
            const main = el('tr', { 'data-testid': 'cnc-shift-row', 'data-shift': r.shiftCode, 'data-index': String(r.index), 'data-active': String(r.isActive), 'data-sufficient': String(r.sufficient), 'data-clickable': '1', class: `${r.emphasised ? 'emph' : ''}${r.isActive ? ' live' : ''}${sel ? ' sel' : ''}`, tabindex: '0',
                onClick: () => selectScope('SHIFT', r.index), onKeydown: (e) => { if (e.key === 'Enter')
                    selectScope('SHIFT', r.index); } }, el('td', {}, el('b', {}, `${r.label}`), el('div', { class: 'cac-note', style: 'margin:0' }, `${r.shiftDate} · ${fmtHm(r.windowFrom)}–${r.isActive ? 'şimdi' : fmtHm(r.windowTo)}`)), el('td', {}, chipOf(r), el('div', { class: 'cac-note', style: 'margin:2px 0 0' }, r.scopeText)), el('td', { style: r.sufficient ? '' : 'color:#fbbf24;font-weight:700' }, fmtPct(r.coveragePct), r.sufficient ? '' : el('div', { class: 'cac-note', style: 'margin:0;color:#fbbf24' }, 'veri yetersiz')), ...c.map((x) => el('td', { style: x === 'yetersiz veri' ? 'color:#fbbf24' : '' }, x)));
            const more = el('tr', {}, el('td', { colspan: '8', style: 'padding:0 8px 6px' }, el('details', {}, el('summary', { class: 'cac-note', style: 'margin:0' }, 'Ayrıntılar'), el('div', { class: 'cac-note' }, `FEED HOLD: ${r.sufficient ? fmtDur(r.feedHoldSeconds) : 'yetersiz veri'} · Program değişimi: ${r.programChanges ?? 'BİLİNMİYOR'} · M30 sayacı farkı: ${r.m30Delta ?? 'BİLİNMİYOR'} · İş emriyle eşleşen program aktif: ${r.woMatchedActiveSeconds === null ? 'BİLİNMİYOR' : fmtDur(r.woMatchedActiveSeconds)}`))));
            return [main, more];
        }))));
        const cards = el('div', { class: 'cac-cards', 'data-testid': 'cnc-shift-cards' }, ...rowsB.map((r) => {
            const c = cells(r);
            return el('div', { class: `cac-card${r.emphasised ? ' emph' : ''}`, 'data-testid': 'cnc-shift-card', 'data-shift': r.shiftCode, 'data-index': String(r.index), onClick: () => selectScope('SHIFT', r.index) }, el('div', { style: 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap' }, el('b', {}, `${r.label} · ${r.shiftDate}`), chipOf(r)), el('div', { class: 'cac-note' }, r.scopeText), el('div', { class: 'g' }, ...['Veri kapsamı', 'Program aktif', 'CNC durmuş', 'Alarm', 'Veri yok', 'Çevrim'].flatMap((k, i) => [el('span', { style: 'color:#94a3b8' }, k), el('b', {}, i === 0 ? fmtPct(r.coveragePct) : c[i - 1])])));
        }));
        boardHost.replaceChildren(panel(`Vardiya karşılaştırması — güncel + önceki ${done.length} vardiya (${st.board.length})`, 'cnc-shifts', st.board.length ? el('div', {}, table, cards) : small('Vardiya verisi yok.', 'cnc-shifts-empty'), st.boardMode === 'COMPLETED_ONLY' ? small('Güncel (devam eden) vardiya bu sunucu sürümünde hesaplanamıyor; yalnız tamamlanmış vardiyalar listelenir. Sunucu güncellemesi (SQL 0141) bekleniyor.', 'cnc-board-fallback', 'color:#fbbf24') : null, small(`Vardiya sınırları KMI vardiya takviminden alınır (gece yarısını aşan vardiya başladığı tarihe bağlanır). Devam eden vardiya yalnız geçen süre kadar hesaplanır. Veri kapsamı %${MIN_COVERAGE_PCT} altındaki vardiyada performans değeri gösterilmez. Satıra tıklayınca çizelge ve özet o vardiyaya geçer.`, 'cnc-shifts-note')));
        const completed = done.filter((s) => s.dataSufficient !== undefined);
        aiHost.replaceChildren(aiBlock(analyseShifts(completed)));
    };
    // ───────── load a scope
    const loadScope = async (keepBrush = false) => {
        const sc = st.scope;
        if (!sc)
            return;
        if (!keepBrush)
            st.brush = null;
        drawScope();
        info.replaceChildren(small(`${sc.label} · ${fmt(sc.from)} – ${sc.key === 'ACTIVE' || (sc.key === 'SHIFT' && st.board[sc.shiftIndex ?? -1]?.isActive) ? 'şimdi (kısmi vardiya)' : fmt(sc.to)}`, 'cnc-scope-info', 'font-weight:700;color:#e2e8f0'));
        kpiHost.replaceChildren(panel('Faaliyet özeti', 'cnc-summary', small('Yükleniyor…')));
        tlHost.replaceChildren(panel('Zaman çizelgesi', 'cnc-timeline-panel', small('Yükleniyor…')));
        try {
            const a = argsOf(sc.from, sc.to);
            const [segs, sum, ev] = await Promise.all([ctx.rpc('cnc_activity', a), ctx.rpc('cnc_activity_summary', a), ctx.rpc('cnc_events', { ...a, p_limit: 300 })]);
            rows = [{ key: 'main', label: sc.label, sub: `${fmt(sc.from)} – ${fmt(sc.to)}`, from: sc.from, to: sc.to, segs }];
            if (sc.key === 'ACTIVE') {
                const p = scopeOf('PREV', now, st.board, st.custom);
                if (p) {
                    try {
                        const ps = await ctx.rpc('cnc_activity', argsOf(p.from, p.to));
                        rows.push({ key: 'prev', label: p.label, sub: 'önceki vardiya', from: p.from, to: p.to, segs: ps });
                    }
                    catch { /* previous row optional */ }
                }
            }
            rowSum = sum;
            drawKpis(sum, sc.label);
            drawEvents(ev, sc.label);
            drawTimeline();
            drawBoard();
            drawCompare();
            drawScope();
            detail.replaceChildren('Ayrıntı için çizelgede bir aralığa tıklayın.');
        }
        catch (e) {
            const msg = isDenied(e) ? 'Bu bölümü görme yetkiniz yok (sunucu reddetti).' : 'CNC faaliyet verisi okunamadı (kaynak yanıt vermedi). Süre uydurulmaz.';
            kpiHost.replaceChildren(panel('Faaliyet özeti', 'cnc-summary', small(msg, 'cnc-history-error', 'color:#fbbf24')));
            tlHost.replaceChildren();
        }
        void rowSum;
    };
    // ───────── start
    try {
        await loadBoard();
    }
    catch (e) {
        root.append(small(isDenied(e) ? 'Bu bölümü görme yetkiniz yok (sunucu reddetti).' : 'Vardiya verisi okunamadı. Sayı uydurulmaz.', 'cnc-shifts-error', 'color:#fbbf24'));
    }
    st.scope = scopeOf(st.board.some((s) => s.isActive) ? 'ACTIVE' : st.board.length ? 'PREV' : 'DAY', now, st.board, st.custom);
    drawScope();
    drawBoard();
    drawCompare();
    await loadScope();
    window.addEventListener('resize', () => { if (root.isConnected)
        drawTimelineSoft(); });
}
function aiBlock(analysis) {
    const body = [];
    if (analysis.status !== 'READY')
        body.push(el('div', { 'data-testid': 'cnc-ai-status', 'data-status': 'INSUFFICIENT_DATA', style: 'font-weight:800;color:#fbbf24' }, 'GÜVENİLİR ANALİZ İÇİN VERİ YETERSİZ'), small('Yeterli veri kapsamına sahip tamamlanmış vardiya sayısı az. Neden uydurulmaz.', 'cnc-ai-text'));
    else {
        body.push(el('div', { 'data-testid': 'cnc-ai-status', 'data-status': 'READY', style: 'font-weight:700;color:#94a3b8' }, 'Kural tabanlı istatistiksel analiz (KMI yapay zekâ servisi gerekmez; servis yokken de çalışır)'), small(analysis.headline, 'cnc-ai-headline'));
        for (const o of analysis.observations)
            body.push(el('div', { 'data-testid': 'cnc-obs', 'data-id': o.id, class: 'cac-note' }, `• ${o.text} `, el('span', { style: 'color:#7f8da3' }, `[${o.evidence}]`)));
    }
    if (analysis.recommendations.length) {
        body.push(el('div', { style: 'font-weight:700;margin-top:8px' }, 'Doğrulanabilir iyileştirme fırsatları (otomatik görev/bakım emri oluşturmaz; yetkili onayı gerekir)'));
        for (const r of analysis.recommendations)
            body.push(el('div', { 'data-testid': 'cnc-rec', 'data-id': r.id, class: 'cac-detail' }, el('b', {}, `${r.priority}. ${r.finding}`), el('div', {}, `Ölçüm: ${r.measurement}`), el('div', {}, `Vardiya / aralık: ${r.shifts.join(', ') || '—'}`), el('div', {}, `Önerilen kontrol: ${r.action}`), el('div', { class: 'cac-note' }, `Güven düzeyi: ${r.confidence}`)));
    }
    body.push(small('Operatörleri kişisel olarak sıralamaz; eksik veriden kusur atfetmez. Değerler OEE, verimlilik veya sağlam üretim değildir.', 'cnc-ai-guard'));
    return panel('Vardiya Zekâsı — son tamamlanmış vardiyalar', 'cnc-ai', ...body);
}
