// Üçlü perspektif kartı (iş emri operasyonu) + kanonik çevrim özeti (rota/makine). Yalnız gösterir; sunucu hesabını yeniden hesaplamaz.
import { h } from '../../../../../packages/ui/src/h.js';
import { tripleView, canonicalCycleView, camStateView } from '../../../../../packages/domain/src/opTriple.js';
const TONE = { ok: '#34d399', warn: '#fbbf24', bad: '#f87171' };
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const fmt = (iso) => (iso ? dtf.format(new Date(iso)) : '');
export function tripleCard(raw, title = '') {
    const v = tripleView(raw);
    if (!v) return h('div', { 'data-testid': 'tri-none', class: 'ps-ts' }, 'Veri yok');
    const col = (c) => h('div', { 'data-testid': `tri-col-${c.id}`, style: 'flex:1 1 260px;min-width:240px;border:1px solid #334155;border-radius:8px;padding:8px' },
        h('div', { style: 'font-weight:800' }, c.title), h('div', { class: 'ps-ts', style: 'margin-bottom:6px' }, c.sub),
        ...c.rows.map((r) => h('div', { 'data-testid': 'tri-row', 'data-key': r.key, 'data-known': String(r.known), style: `border-left:3px solid ${TONE[r.tone]};padding:2px 8px;margin:4px 0` },
            h('div', {}, h('span', { style: 'color:#94a3b8' }, `${r.label}: `), h('b', { 'data-testid': 'tri-val' }, r.valueText), r.known ? h('span', { class: 'ps-ts' }, ` · ${r.reliability}`) : null),
            h('div', { class: 'ps-ts' }, r.known ? `${r.source}${r.at ? ` · ${fmt(r.at)}` : ''}` : r.missing))));
    return h('div', { 'data-testid': 'tri-card' }, title ? h('div', { style: 'font-weight:800;margin:6px 0' }, title) : null,
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' }, ...v.columns.map(col)),
        h('table', { 'data-testid': 'tri-cmp', style: 'margin-top:8px;border-collapse:collapse;width:100%' }, ...v.comparisons.map((c) =>
            h('tr', { 'data-key': c.key, 'data-status': c.status }, h('td', { style: 'padding:2px 8px 2px 0;color:#94a3b8' }, c.label),
                h('td', { style: `color:${TONE[c.tone]};font-weight:700;white-space:nowrap` }, c.statusText), h('td', { class: 'ps-ts' }, c.diffText ?? c.reason ?? '', c.note ? ` — ${c.note}` : '')))),
        v.flags.length ? h('div', { 'data-testid': 'tri-flags', class: 'ps-ts', style: 'margin-top:6px' }, `İnceleme gerektiren sapma: ${v.flags.length} (aynı olay için tek kayıt anahtarı)`) : null);
}
export function canonicalCycleBox(raw) {
    const v = canonicalCycleView(raw);
    if (!v) return h('div', { 'data-testid': 'cc-none', class: 'ps-ts' }, 'Kanonik çevrim verisi yok');
    const row = (k, val, tid) => h('div', { 'data-testid': tid }, h('span', { style: 'color:#94a3b8' }, `${k}: `), val);
    return h('div', { 'data-testid': 'cc-box', 'data-status': v.status },
        row('Onaylı standart', v.standard.seconds == null ? 'girilmemiş' : `${v.standard.seconds} sn (${v.standard.source})`, 'cc-std'),
        row('Son ölçülen', v.lastValid ? `${v.lastValid.seconds} sn · ${fmt(v.lastValid.at)}${v.lastValid.stale ? ' · ESKİ VERİ (bağlantı yok/eski)' : ''}` : 'BİLİNMİYOR', 'cc-last'),
        v.lastCycle?.anomaly ? row('Son çevrim', `${v.lastCycle.seconds} sn · ${fmt(v.lastCycle.at)} · ANOMALİ — tipik çevrimden %${Math.abs(v.lastCycle.deviationPct ?? 0)} ${((v.lastCycle.deviationPct ?? 0) < 0) ? 'kısa' : 'uzun'} (silinmedi; tipik hesaba ve öneriye girmez; eşik %${v.anomalyPct})`, 'cc-anomaly') : null,
        row('Tipik (medyan)', v.median == null ? 'BİLİNMİYOR' : `${v.median} sn (${v.samples} geçerli örnek)`, 'cc-median'),
        row('Öneri', v.suggestion ? `${v.suggestion.seconds} sn — onay bekliyor, standart değişmedi` : 'yok', 'cc-sugg'),
        row('Eşleşme kanıtı', `${v.identityBasis}${v.autoEligible ? '' : ' · otomatik öneri için yetersiz'}`, 'cc-id'),
        v.reasons.length ? h('div', { class: 'ps-ts', 'data-testid': 'cc-reasons' }, v.reasons.join(' · ')) : null);
}

/** CAM teknik iyileştirme: eski/yeni standart, ölçüm, CAM revizyonu, doğrulama, onay, ilk parça, üretime geçiş. Yalnız gösterir; onay sunucu RPC'sine gider. */
export function camImprovementBox(raw, onApprove, onApply) {
    const v = camStateView(raw);
    if (!v) return h('div', { 'data-testid': 'cam-none', class: 'ps-ts' }, 'CAM durumu okunamadı veya yetki yok');
    const sel = h('select', { 'data-testid': 'cam-new', 'aria-label': 'Yeni CAM revizyonu' }, h('option', { value: '' }, v.currentCam ? `Mevcut CAM kalsın (${v.currentCam.text})` : 'CAM seçin'), ...v.candidates.map((c) => h('option', { value: c.id }, c.text)));
    const cyc = h('input', { type: 'number', min: '0.1', step: '0.1', 'data-testid': 'cam-cycle', placeholder: 'Yeni çevrim standardı (sn)', 'aria-label': 'Yeni çevrim standardı' });
    const why = h('textarea', { 'data-testid': 'cam-reason', rows: '2', placeholder: 'Teknik değişiklik nedeni (en az 20 karakter)', 'aria-label': 'Teknik değişiklik nedeni' });
    const msg = h('div', { 'data-testid': 'cam-msg', class: 'ps-ts' });
    const btn = h('button', { type: 'button', 'data-testid': 'cam-approve', onClick: async () => {
        msg.textContent = ''; btn.disabled = true;
        try { const r = await onApprove({ cam: sel.value || null, cycle: cyc.value === '' ? null : Number(cyc.value), reason: why.value, expectedVersion: v.expectedVersion });
            msg.textContent = r?.alreadyApplied ? 'Zaten uygulanmış — değişiklik yapılmadı.' : `CAM teknik onayı kaydedildi (rota sürümü ${r?.versionNo}). İlk parça kalite onayı ayrıdır; CAM onayı yerine geçmez.`; }
        catch (e) { msg.textContent = `Kaydedilemedi: ${e?.message ?? e}`; } finally { btn.disabled = false; } } }, 'CAM teknik onayı ver');
    const waiting = v.wo.filter((w) => w.stage === 'RESYNC_BEKLIYOR').length;
    const applyMsg = h('div', { 'data-testid': 'cam-apply-msg', class: 'ps-ts' });
    const applyBtn = (onApply && waiting > 0) ? h('button', { type: 'button', 'data-testid': 'cam-apply', onClick: async () => {
        applyMsg.textContent = ''; applyBtn.disabled = true;
        try { const r = await onApply(why.value); applyMsg.textContent = r?.alreadyApplied ? 'Uygulanacak değişiklik yok.' : `${r?.applied ?? 0} iş emri operasyonu yeni CAM revizyonuna alındı; başlamış ${r?.frozenStarted ?? 0} operasyon donuk kaldı. Makine, operatör, kalite ve HOLD değişmedi.`; }
        catch (e) { applyMsg.textContent = `Uygulanamadı: ${e?.message ?? e}`; } finally { applyBtn.disabled = false; } } }, `Onaylı CAM'i başlamamış ${waiting} iş emri operasyonuna uygula`) : null;
    return h('div', { 'data-testid': 'cam-box' },
        h('div', {}, h('span', { style: 'color:#94a3b8' }, 'Mevcut onaylı standart: '), `${v.standard.seconds == null ? 'girilmemiş' : `${v.standard.seconds} sn`} (${v.standard.source})`),
        v.currentCam ? h('div', {}, h('span', { style: 'color:#94a3b8' }, 'Bağlı CAM: '), `${v.currentCam.text}${v.currentCam.technicalCycle != null ? ` · teknik hedef ${v.currentCam.technicalCycle} sn (onaylı standart değildir)` : ''}`) : null,
        v.measured ? h('div', {}, h('span', { style: 'color:#94a3b8' }, 'MTConnect: '), `tipik ${v.measured.median ?? 'BİLİNMİYOR'} sn${v.measured.last ? ` · son ${v.measured.last.seconds} sn${v.measured.last.anomaly ? ' (ANOMALİ)' : ''}` : ''} · kimlik: ${v.measured.basis}`) : null,
        ...v.steps.map((x) => h('div', { 'data-testid': 'cam-step', 'data-step': String(x.no), 'data-state': x.state, style: `border-left:3px solid ${TONE[x.tone]};padding:2px 8px;margin:4px 0` },
            h('b', {}, x.label), ' — ', x.stateText, x.detail ? h('div', { class: 'ps-ts' }, x.detail) : null,
            ...x.checks.map((k) => h('div', { class: 'ps-ts', style: `color:${TONE[k.tone]}`, 'data-state': k.state }, `${k.label}: ${k.stateText}${k.detail ? ` — ${k.detail}` : ''}`)))),
        v.wo.length ? h('div', { class: 'ps-ts', 'data-testid': 'cam-wo' }, ...v.wo.map((w) => h('div', { 'data-stage': w.stage, style: `color:${TONE[w.tone]}` }, `İş emri operasyonu: ${w.stageText}`))) : null,
        h('div', { class: 'acts', style: 'display:flex;flex-direction:column;gap:6px;margin-top:8px' }, sel, cyc, why, btn, msg, applyBtn, applyMsg));
}
