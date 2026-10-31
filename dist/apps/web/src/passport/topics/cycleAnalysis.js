// Makine pasaportu → "MTConnect Çevrim Analizi". Sunucu (op_cycle_estimate, m0182) karar verir; bu ekran yalnız gösterir ve eşleme kaydını yetkili kullanıcıya sunar.
import { h } from '../../../../../packages/ui/src/h.js';
import { classifyCycle, estimateView, EXCL_TR } from '../../../../../packages/domain/src/cycleAnalysis.js';
import { isDenied } from './common.js';
const NUM = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmt = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
const TONE_CSS = { ok: '#34d399', warn: '#fbbf24', bad: '#f87171' };
const panel = (title, testid, ...kids) => h('section', { class: 'ps-panel', 'data-testid': testid }, h('div', { class: 'ps-panel-h' }, h('h2', {}, title)), ...kids.filter(Boolean));
const small = (t, testid, extra = '') => h('div', { class: 'ps-ts', style: `margin:4px 0;${extra}`, ...(testid ? { 'data-testid': testid } : {}) }, t);
const errMsg = (e) => String(e?.message ?? e).replace(/^[\s\S]*?(FORBIDDEN|EVIDENCE_REQUIRED|MACHINE_NOT_IN_OPERATION|CAM_PROGRAM_REQUIRED|CNC_DEVICE_NOT_BOUND|REASON_REQUIRED)/, '$1').slice(0, 220);
export function cycleTopic(ctx, m) {
    return {
        id: 'cnc-cevrim', title: 'MTConnect Çevrim Analizi', icon: 'chart', group: 'CNC', summary: 'Medyan tahmin · örnek · güven · eşleme',
        async render(host) {
            const draw = async () => {
                let ops, maps, dev;
                try {
                    ops = await ctx.sel('routing_operations', 'id,product_revision_id,op_no,name,cam_program_id,cycle_seconds_target', { active: 'eq.true', primary_machine_id: `eq.${m.id}` }, 'op_no.asc', 40);
                    maps = await ctx.sel('op_cycle_mapping', 'routing_operation_id,cnc_program,name_match,content_verified,active,evidence,proven_at', { machine_id: `eq.${m.id}` }, undefined, 40);
                    dev = await ctx.sel('cnc_devices', 'id,serial_no', { machine_id: `eq.${m.id}`, active: 'eq.true' }, undefined, 1);
                }
                catch (e) {
                    host.replaceChildren(panel('MTConnect Çevrim Analizi', 'cyc-denied', small(isDenied(e) ? 'Çevrim telemetrisini görme yetkiniz yok.' : `Veri okunamadı: ${errMsg(e)}`, 'cyc-denied-msg')));
                    return;
                }
                if (!dev.length) {
                    host.replaceChildren(panel('MTConnect Çevrim Analizi', 'cyc-none', small('Bu makineye bağlı etkin CNC cihazı yok — çevrim ölçümü yapılamaz.', 'cyc-none-msg', 'font-weight:800;color:#fbbf24')));
                    return;
                }
                const mapOf = new Map(maps.filter((x) => x.active).map((x) => [x.routingOperationId, x]));
                const parts = [small('Kaynak: makine telemetrisi (MTConnect). Operatör beyanı bu hesaba girmez; plan süresi otomatik değişmez. Eşleme kanıtlanmadan hiçbir ölçüm bir operasyona bağlanmaz.', 'cyc-rule')];
                if (!ops.length)
                    parts.push(small('Bu makine birincil makine olan etkin rota operasyonu yok.', 'cyc-noops'));
                for (const o of ops) {
                    const mp = mapOf.get(o.id);
                    const box = h('div', { 'data-testid': 'cyc-op', 'data-op': String(o.opNo), style: 'border:1px solid #334155;border-radius:8px;padding:10px;margin:10px 0' });
                    box.append(h('div', { style: 'font-weight:800' }, `OP${o.opNo} — ${o.name}`), small(`Plan süresi: ${o.cycleSecondsTarget ?? 'BİLGİ YOK'} sn · CAM: ${o.camProgramId ? 'bağlı' : 'BAĞLI DEĞİL'}`));
                    if (!mp) {
                        box.append(small('Program/operasyon/makine eşlemesi YOK — telemetri bu operasyona bağlanmadı; plan süresi geçerli.', 'cyc-nomap', 'color:#fbbf24;font-weight:700'));
                        box.append(mapForm(o));
                        parts.push(box);
                        continue;
                    }
                    box.append(small(`Eşleme: CNC programı ${mp.cncProgram} · ${mp.nameMatch ? 'ad CAM kaydıyla aynı' : 'ad CAM kaydından FARKLI (yalnız kanıta dayalı)'} · içerik ${mp.contentVerified ? 'doğrulandı' : 'DOĞRULANAMADI'} · ${fmt(mp.provenAt)}`, 'cyc-map'));
                    try {
                        const est = await ctx.rpc('op_cycle_estimate', { p_op: o.id });
                        const v = estimateView(est);
                        const col = TONE_CSS[v.tone] ?? '#94a3b8';
                        box.append(h('div', { 'data-testid': 'cyc-est', 'data-status': v.state, style: `border-left:3px solid ${col};padding:2px 10px;margin:6px 0` }, h('div', { style: `font-weight:800;color:${col}` }, v.headline), h('table', { style: 'font-size:13px;border-collapse:collapse' }, ...[
                            ['Medyan tahmin (son 20 geçerli)', v.medianSeconds === null ? 'yok' : `${NUM.format(v.medianSeconds)} sn`, 'cyc-median'],
                            ['Kullanılan süre', `${v.usedSeconds === null ? '—' : NUM.format(v.usedSeconds)} sn — ${v.usedSource}`, 'cyc-used'],
                            ['Plan süresi', `${v.planSeconds === null ? '—' : NUM.format(v.planSeconds)} sn`, 'cyc-plan'],
                            ['Geçerli örnek / kullanılan', `${v.validSamples} / ${v.usedSamples}`, 'cyc-samples'],
                            ['Güven düzeyi', v.confidence, 'cyc-conf'],
                            ['Aktif ölçüm serisi başlangıcı', fmt(est.seriesStartedAt), 'cyc-series'],
                            ['Dışlananlar', v.excluded.length ? v.excluded.join(' · ') : 'yok', 'cyc-excl'],
                        ].map(([k, val, tid]) => h('tr', {}, h('td', { style: 'padding:2px 10px 2px 0;color:#94a3b8;white-space:nowrap' }, k), h('td', { 'data-testid': tid }, String(val)))))));
                        if (est.status !== 'ESLEME_YOK' && est.status !== 'YENI_SERI_BEKLIYOR') {
                            const evs = await ctx.sel('cnc_cycle_events', 'source_ts,m30_before,m30_after,program,last_cycle_s', { device_id: `eq.${dev[0].id}` }, 'source_ts.desc', 25);
                            const cx = { seriesStartedAt: est.seriesStartedAt, program: mp.cncProgram, plan: est.planSeconds, minPct: est.settings?.minPct ?? 30, maxPct: est.settings?.maxPct ?? 200 };
                            box.append(h('div', { style: 'font-weight:700;margin-top:6px' }, 'Son çevrimler'), h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'cyc-events', style: 'font-size:12.5px;border-collapse:collapse;width:100%' },
                                h('tr', {}, ...['Zaman', 'Program', 'Süre (sn)', 'Durum'].map((t) => h('th', { style: 'text-align:left;padding:3px 8px;color:#94a3b8' }, t))),
                                ...evs.map((ev) => { const c = classifyCycle(ev, cx); return h('tr', { 'data-class': c }, h('td', { style: 'padding:3px 8px' }, fmt(ev.sourceTs)), h('td', { style: 'padding:3px 8px' }, ev.program ?? '—'), h('td', { style: 'padding:3px 8px' }, ev.lastCycleS === null ? '—' : NUM.format(ev.lastCycleS)), h('td', { style: `padding:3px 8px;color:${c === 'GECERLI' ? '#34d399' : '#fbbf24'}` }, c === 'GECERLI' ? 'geçerli' : `dışlandı: ${EXCL_TR[c] ?? c}`)); }))));
                        }
                    }
                    catch (e) {
                        box.append(small(isDenied(e) ? 'Tahmini görme yetkiniz yok.' : `Tahmin okunamadı: ${errMsg(e)}`, 'cyc-est-err', 'color:#f87171'));
                    }
                    parts.push(box);
                }
                host.replaceChildren(panel('MTConnect Çevrim Analizi', 'cyc-panel', ...parts));
            };
            const mapForm = (o) => {
                const msg = h('div', { 'data-testid': 'cyc-map-msg', style: 'font-size:12.5px;margin-top:4px' });
                const prog = h('input', { type: 'text', 'data-testid': 'cyc-map-prog', placeholder: 'CNC’de çalışan program adı (örn. 1453.nc)', style: 'width:100%;margin:4px 0' });
                const ev = h('textarea', { 'data-testid': 'cyc-map-ev', rows: 2, placeholder: 'Kanıt (en az 20 karakter): bu programın bu operasyonun programı olduğunu neyle doğruladınız?', style: 'width:100%;margin:4px 0' });
                const go = h('button', { type: 'button', class: 'btn', 'data-testid': 'cyc-map-go' }, 'Eşlemeyi kaydet');
                go.addEventListener('click', async () => {
                    if (!window.confirm?.(`OP${o.opNo} için "${prog.value.trim()}" programı bu makineyle eşleştirilecek. Kanıt metni denetim kaydına yazılır. Devam?`)) return;
                    go.disabled = true;
                    try { const r = await ctx.rpc('op_cycle_map_set', { p_op: o.id, p_machine: m.id, p_cnc_program: prog.value, p_evidence: ev.value }); msg.textContent = r.note; await draw(); }
                    catch (e) { msg.textContent = errMsg(e); msg.style.color = '#f87171'; go.disabled = false; }
                });
                return h('details', { style: 'margin-top:6px' }, h('summary', {}, 'Eşleme kanıtla (yetkili)'), prog, ev, go, msg);
            };
            await draw();
        },
    };
}
