// KMI NEXT — Rota / Operasyonlar + Makine–yetkinlik matrisi (migration 0039, D-012).
// ORDER → WORK ORDER → ROUTING → OPERATION 10/20/30 → MACHINE → OPERATOR → FIRST PIECE → QUALITY → NEXT → FINAL.
// The screen only asks; every gate is the server's (operation_start_refusal etc.) and its refusal is
// shown in Turkish. Unknown machine requirements are shown as BİLİNMİYOR — never "everybody qualified".
import { h, mount } from '../../../../packages/ui/src/h.js';
import { OPERATION_STATUS_TR, SKILL_REVIEW_TR, startRefusalText } from '../../../../packages/domain/src/routing.js';
import { FACTOR_TR } from '../../../../packages/domain/src/assignment.js';
import { errorText as sharedErrorText } from '../errorText.js';
import { pilotBanner, pilotText } from '../pilotMark.js';
const errText = (e) => sharedErrorText(e);
const STATUS_COLOR = { PENDING: '#64748b', FIRST_PIECE_PENDING: '#b45309', RUNNING: '#1d4ed8', QC_PENDING: '#7c3aed', DONE: '#15803d' };
const REVIEW_COLOR = { UNKNOWN: '#b45309', DEFINED: '#15803d', NONE_REQUIRED: '#0f766e' };
let reqSeq = 0;
const requestId = () => `op-${Date.now().toString(36)}-${(reqSeq += 1)}-${Math.random().toString(36).slice(2, 8)}`;
/** Same canonical product operations (Ürün Çalışma Alanı) embedded here so ONE record is shown/edited in every screen (no second routing UI, no copy). */
import { chooseProduct, rememberProduct } from '../lastProduct.js';
export async function renderRoutingScreen(container, api, state = {}) {
    const emb = state.embed ?? null;
    const tab = state.tab ?? (emb ? 'PRODUCT' : 'OPS');
    const go = (next) => void renderRoutingScreen(container, api, { ...state, message: null, ...next });
    const act = async (fn, ok) => {
        try {
            await fn();
            go({ message: { kind: 'ok', text: ok } });
        }
        catch (e) {
            go({ message: { kind: 'error', text: startRefusalText(errText(e)) } });
        }
    };
    let loadError = null;
    let people = [];
    let woIds = [];
    let pf = null;
    let routing = null;
    let matrix = [];
    let suggestion = null;
    let suggestError = null;
    let revisions = [];
    let defs = [];
    let products = [];
    try {
        if (emb) {
            try {
                products = await emb.list();
            }
            catch {
                products = [];
            }
        }
        people = await api.people();
        if (tab === 'PRODUCT') { /* the embedded canonical card loads itself */ }
        else if (tab === 'OPS') {
            woIds = await api.routedWorkOrders();
            try {
                pf = api.pilotFlags ? await api.pilotFlags(woIds) : null;
            }
            catch {
                pf = null;
            }
            const wid = state.workOrderId ?? woIds[0] ?? null;
            if (wid)
                routing = await api.workOrderRouting(wid);
            if (state.suggestFor) {
                try {
                    suggestion = await api.suggestAssignment(state.suggestFor);
                }
                catch (e) {
                    suggestError = errText(e);
                }
            }
        }
        else if (tab === 'MATRIX') {
            matrix = await api.matrix();
        }
        else {
            matrix = await api.matrix();
            revisions = await api.revisions();
            const rid = state.revisionId ?? revisions[0]?.id ?? null;
            if (rid)
                defs = await api.routingDefs(rid);
        }
    }
    catch (e) {
        loadError = errText(e);
    }
    const active = people.filter((p) => p.active);
    const opCard = (o, wid) => {
        const machineSel = h('select', { 'data-testid': 'op-machine' }, ...o.allowedMachines.map((m) => h('option', { value: m.id }, m.code)));
        const opSel = h('select', { 'data-testid': 'op-operator' }, h('option', { value: '' }, '— operatör —'), ...active.map((p) => h('option', { value: p.id }, p.name)));
        const note = h('input', { type: 'text', 'data-testid': 'op-note', placeholder: 'Not', style: 'flex:1 1 120px;min-width:0' });
        const good = h('input', { type: 'number', min: '0', 'data-testid': 'op-good', placeholder: 'sağlam', style: 'width:5em' });
        const scrap = h('input', { type: 'number', min: '0', 'data-testid': 'op-scrap', placeholder: 'fire', style: 'width:5em' });
        const stay = { workOrderId: wid };
        const controls = [];
        if (o.status === 'PENDING')
            controls.push(machineSel, opSel, h('button', { type: 'button', 'data-testid': 'op-check', onClick: async () => {
                    try {
                        const r = await api.startRefusal(o.id, machineSel.value || null, opSel.value || null);
                        go({ ...stay, message: { kind: r ? 'error' : 'ok', text: startRefusalText(r) } });
                    }
                    catch (e) {
                        go({ ...stay, message: { kind: 'error', text: errText(e) } });
                    }
                } }, 'Kontrol et'), h('button', { type: 'button', 'data-testid': 'op-start', onClick: () => void act(() => api.start(o.id, machineSel.value, opSel.value), `Operasyon ${o.opNo} başladı`).then(() => undefined) }, 'Başlat'), h('button', { type: 'button', 'data-testid': 'op-suggest', onClick: () => go({ ...stay, suggestFor: o.id }) }, 'Akıllı öneri'));
        if (o.status === 'FIRST_PIECE_PENDING')
            controls.push(note, h('button', { type: 'button', 'data-testid': 'op-fp-approve', onClick: () => void act(() => api.firstPiece(o.id, true, note.value.trim()), 'İlk parça onaylandı') }, 'İlk parça uygun'), h('button', { type: 'button', 'data-testid': 'op-fp-reject', onClick: () => void act(() => api.firstPiece(o.id, false, note.value.trim()), 'İlk parça reddedildi') }, 'Uygun değil'));
        if (o.status === 'RUNNING')
            controls.push(good, scrap, h('button', { type: 'button', 'data-testid': 'op-declare', onClick: () => void act(() => api.declare(o.id, Number(good.value || 0), Number(scrap.value || 0), requestId()), 'Bildirildi') }, 'Bildir'), h('button', { type: 'button', 'data-testid': 'op-finish', onClick: () => void act(() => api.finish(o.id), 'Operasyon bitti') }, 'Bitir'));
        if (o.status === 'QC_PENDING')
            controls.push(note, h('button', { type: 'button', 'data-testid': 'op-qc-pass', onClick: () => void act(() => api.qc(o.id, 'PASS', note.value.trim()), 'Kalite: uygun') }, 'Kalite uygun'), h('button', { type: 'button', 'data-testid': 'op-qc-fail', onClick: () => void act(() => api.qc(o.id, 'FAIL', note.value.trim()), 'Kalite: uygun değil — bekletme açıldı') }, 'Uygun değil'));
        return h('div', { 'data-testid': 'op-card', 'data-op': String(o.opNo), 'data-status': o.status,
            style: `border:1px solid #e2e8f0;border-left:4px solid ${STATUS_COLOR[o.status]};border-radius:10px;padding:8px 10px;margin:6px 0;font-size:13px` }, h('div', {}, h('b', {}, `${o.opNo} · ${o.name}`), ' ', h('span', { 'data-testid': 'op-status', style: `font-weight:700;color:${STATUS_COLOR[o.status]}` }, OPERATION_STATUS_TR[o.status])), h('div', { style: 'color:#475569;overflow-wrap:anywhere' }, `Makine: ${o.machineCode ?? o.allowedMachines.map((m) => m.code).join(' / ')}` + (o.operatorName ? ` · Operatör: ${o.operatorName}` : '')
            + (o.requiredSkillCode ? ` · Şart: ${o.requiredSkillCode} ≥ ${o.requiredSkillLevel}` : ' · Operasyon yetkinlik şartı yok')
            + (o.camProgramNo ? ` · CAM ${o.camProgramNo}` : '') + (o.firstPieceRequired ? ' · ilk parça' : '') + (o.qcRequired ? ' · kalite kontrol' : '')), h('div', { 'data-testid': 'op-qty' }, `Giriş ${o.qtyIn} · Sağlam ${o.qtyGood} · Fire ${o.qtyScrap}`), controls.length ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px' }, ...controls) : null, state.suggestFor === o.id ? suggestionPanel(o, wid) : null);
    };
    const suggestionPanel = (o, wid) => {
        if (suggestError)
            return h('div', { 'data-testid': 'as-error', style: 'color:#b91c1c' }, startRefusalText(suggestError));
        if (!suggestion)
            return null;
        const reason = h('input', { type: 'text', 'data-testid': 'as-reason', placeholder: 'Öneriden farklı seçersen gerekçe', style: 'width:100%;box-sizing:border-box' });
        const f = (k) => FACTOR_TR[k] ?? k;
        return h('div', { 'data-testid': 'as-panel', style: 'margin-top:8px;padding:8px;border-radius:8px;background:#f8fafc;border:1px dashed #cbd5e1' }, h('div', { style: 'font-size:12px;color:#475569' }, `Öneri yalnız öneridir — atamayı siz yaparsınız. Vardiya: ${suggestion.currentShift ?? 'BİLİNMİYOR'} · CAM: ${f(suggestion.operation.cam)} · Takım: ${f(suggestion.operation.tools)}`
            + (suggestion.presenceAvailable ? '' : ' · Giriş-çıkış bilgisi: BİLİNMİYOR')), reason, ...suggestion.candidates.slice(0, 8).map((c) => h('div', { 'data-testid': 'as-cand', 'data-rank': String(c.rank), 'data-eligible': String(c.eligible),
            style: `display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-top:1px solid #e2e8f0;padding:4px 0;font-size:12px;${c.eligible ? '' : 'opacity:.6'}` }, h('b', {}, `${c.rank}. ${c.machineCode} · ${c.operatorName}`), h('span', { style: 'overflow-wrap:anywhere' }, c.eligible
            ? `aynı adım ${c.factors.sameStepExperience} · seviye ${c.factors.skillLevel ?? '—'} · fire ${c.factors.scrapRatePct === null ? 'BİLİNMİYOR' : `%${c.factors.scrapRatePct}`} · ayar ${c.factors.estimatedSetupMinutes === null ? 'BİLİNMİYOR' : `${c.factors.estimatedSetupMinutes} dk`} · kuyruk ${c.factors.machineQueue} · ${f(c.factors.shift)} · ${f(c.factors.presence)}`
            : startRefusalText(c.refusal)), c.eligible ? h('button', { type: 'button', 'data-testid': 'as-choose', onClick: async () => {
                try {
                    const r = await api.recordAssignment(o.id, c.machineId, c.operatorId, reason.value.trim() || null);
                    go({ workOrderId: wid, suggestFor: null, message: { kind: 'ok', text: r.followed ? 'Karar kaydedildi (öneriye uyuldu).' : 'Karar kaydedildi (öneriden farklı, gerekçeli).' } });
                }
                catch (e) {
                    go({ workOrderId: wid, suggestFor: o.id, message: { kind: 'error', text: startRefusalText(errText(e)) } });
                }
            } }, 'Bunu seç') : null)));
    };
    const matrixRow = (m) => {
        const note = h('input', { type: 'text', 'data-testid': 'mx-note', placeholder: 'Gerekçe', style: 'flex:1 1 140px;min-width:0' });
        const person = h('select', { 'data-testid': 'mx-person' }, h('option', { value: '' }, '— kişi —'), ...active.map((p) => h('option', { value: p.id }, p.name)));
        return h('div', { 'data-testid': 'mx-row', 'data-code': m.code, 'data-review': m.skillReview,
            style: 'border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:6px 0;font-size:13px' }, h('div', {}, h('b', {}, `${m.code} · ${m.name}`), ' ', h('span', { 'data-testid': 'mx-review', style: `font-weight:700;color:${REVIEW_COLOR[m.skillReview]}` }, SKILL_REVIEW_TR[m.skillReview])), h('div', { 'data-testid': 'mx-reqs', style: 'color:#475569' }, m.requirements.length ? m.requirements.map((r) => `${r.skillCode} ≥ ${r.minLevel}`).join(' · ') + ` · uygun operatör: ${m.qualifiedOperators}` : 'Şart girilmemiş'), m.clearances ? h('div', { 'data-testid': 'mx-clearances' }, `Geçici yetkili doğrulama: ${m.clearances} kişi`) : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, note, h('button', { type: 'button', 'data-testid': 'mx-defined', onClick: () => void act(() => api.setReview(m.machineId, 'DEFINED', note.value.trim()), `${m.code}: şartlar tanımlı`).then(() => undefined) }, 'Şartlar tamam'), h('button', { type: 'button', 'data-testid': 'mx-none', onClick: () => void act(() => api.setReview(m.machineId, 'NONE_REQUIRED', note.value.trim()), `${m.code}: şart gerekmiyor`) }, 'Şart gerekmiyor'), person, h('button', { type: 'button', 'data-testid': 'mx-clear', onClick: () => void act(() => api.grantClearance(person.value, m.machineId, 30, note.value.trim()), `${m.code}: 30 günlük doğrulama verildi`) }, '30 gün doğrula')));
    };
    const wid = routing?.workOrderId ?? null;
    const rid = state.revisionId ?? revisions[0]?.id ?? null;
    const defForm = () => {
        const opNo = h('input', { type: 'number', 'data-testid': 'def-opno', placeholder: 'Op no (10, 20…)', style: 'width:7em' });
        const name = h('input', { type: 'text', 'data-testid': 'def-name', placeholder: 'Operasyon adı', style: 'flex:1 1 140px;min-width:0' });
        const skill = h('input', { type: 'text', 'data-testid': 'def-skill', placeholder: 'Yetkinlik kodu (boş = yok)', style: 'width:12em' });
        const level = h('input', { type: 'number', min: '1', max: '4', 'data-testid': 'def-level', placeholder: 'seviye', style: 'width:5em' });
        const fp = h('input', { type: 'checkbox', 'data-testid': 'def-fp', checked: 'checked' });
        const qc = h('input', { type: 'checkbox', 'data-testid': 'def-qc', checked: 'checked' });
        const reason = h('input', { type: 'text', 'data-testid': 'def-reason', placeholder: 'Gerekçe', style: 'flex:1 1 140px;min-width:0' });
        const woIn = h('input', { type: 'text', 'data-testid': 'def-wo', placeholder: 'İş emri kimliği', style: 'flex:1 1 200px;min-width:0' });
        const boxes = matrix.map((m) => h('label', { style: 'font-size:12px;white-space:nowrap' }, h('input', { type: 'checkbox', 'data-testid': 'def-machine', value: m.machineId }), ` ${m.code}`));
        const save = () => act(() => api.setRoutingOperation({ revisionId: rid, opNo: Number(opNo.value), name: name.value, skillCode: skill.value.trim() || null,
            skillLevel: skill.value.trim() ? Number(level.value) : null, firstPiece: fp.checked, qc: qc.checked, reason: reason.value,
            machineIds: [...container.querySelectorAll('[data-testid="def-machine"]:checked')].map((c) => c.value) }), 'Rota operasyonu kaydedildi');
        return h('section', {}, revisions.length ? h('select', { 'data-testid': 'def-revision', onChange: (e) => go({ tab: 'DEF', revisionId: e.target.value }) }, ...revisions.map((r) => h('option', { value: r.id, ...(r.id === rid ? { selected: 'selected' } : {}) }, `${products.find((x) => x.id === r.productId)?.code ?? r.productId.slice(0, 8)} · Revizyon ${r.revision} (${r.status})`)))
            : h('div', { 'data-testid': 'def-no-revision' }, 'Ürün revizyonu yok — önce ürün/revizyon tanımlanmalı.'), ...defs.map((d) => h('div', { 'data-testid': 'def-row', 'data-op': String(d.opNo), style: 'font-size:13px;border-top:1px solid #f1f5f9;padding:4px 0;overflow-wrap:anywhere' }, `${d.opNo} · ${d.name} · makine: ${d.allowedMachineIds.map((id) => matrix.find((m) => m.machineId === id)?.code ?? '?').join(' / ')}`
            + (d.requiredSkillCode ? ` · ${d.requiredSkillCode} ≥ ${d.requiredSkillLevel}` : '') + (d.firstPieceRequired ? ' · ilk parça' : '') + (d.qcRequired ? ' · kalite' : ''))), rid ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px' }, opNo, name, skill, level, h('label', {}, fp, ' ilk parça'), h('label', {}, qc, ' kalite kontrol'), reason) : null, rid ? h('div', { 'data-testid': 'def-machines', style: 'display:flex;gap:8px;flex-wrap:wrap;margin:6px 0' }, ...boxes) : null, rid ? h('button', { type: 'button', 'data-testid': 'def-save', onClick: () => void save() }, 'Operasyonu kaydet') : null, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px' }, woIn, h('button', { type: 'button', 'data-testid': 'def-apply', onClick: () => void act(() => api.applyRouting(woIn.value.trim()), 'Rota iş emrine uygulandı') }, 'İş emrine uygula')));
    };
    const productTab = () => {
        const pid = chooseProduct(products.map((x) => x.id), state.productId);
        if (pid)
            rememberProduct(pid);
        if (pid)
            queueMicrotask(() => { const host = container.querySelector('[data-testid="rt-product-host"]'); if (host && emb)
                void emb.render(host, pid); });
        return h('section', {}, h('p', { class: 'rt-note' }, 'Ürünün rota tanımı: operasyonlar, makine, süreler, NC · CAM · takım listesi durumu. Ürün Çalışma Alanı ile AYNI kayıt ve AYNI düzenleme ekranıdır; yeni kopya yoktur.'), products.length ? h('select', { 'data-testid': 'rt-product', 'aria-label': 'Ürün', onChange: (e) => { const v = e.target.value; rememberProduct(v); go({ tab: 'PRODUCT', productId: v || null }); } }, ...(pid ? [] : [h('option', { value: '', selected: 'selected' }, '— ürün seçin —')]), ...products.map((x) => h('option', { value: x.id, ...(x.id === pid ? { selected: 'selected' } : {}) }, `${x.code} — ${x.name}`))) : h('div', { 'data-testid': 'rt-no-product' }, 'Ürün bulunamadı.'), !pid && products.length ? h('div', { class: 'rt-note', 'data-testid': 'rt-pick' }, 'Operasyonlarını görmek için bir ürün seçin. Bir üründen geliyorsanız o ürün otomatik açılır.') : null, h('div', { 'data-testid': 'rt-product-host', style: 'margin-top:10px' }));
    };
    mount(container, h('div', { class: 'routing-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'rt-heading' }, 'Rota / Operasyonlar'), h('style', {}, '.routing-screen .rt-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}.routing-screen .rt-tabs button{min-height:36px;font-weight:700;background:#1e293b;color:#cbd5e1}.routing-screen .rt-tabs button[aria-pressed="true"]{background:#1d4ed8;color:#fff}@media (max-width:640px){.routing-screen .rt-tabs{gap:6px}.routing-screen .rt-tabs button{min-height:36px;padding:6px 12px;font-size:14px}}.routing-screen .rt-note{color:#94a3b8;font-size:13px;line-height:1.45;max-width:70ch;margin:6px 0}'), h('div', { class: 'rt-tabs' }, ...(emb ? [h('button', { type: 'button', 'data-testid': 'rt-tab-product', 'aria-pressed': String(tab === 'PRODUCT'), onClick: () => go({ tab: 'PRODUCT' }) }, 'Ürün operasyonları (rota)')] : []), h('button', { type: 'button', 'data-testid': 'rt-tab-ops', 'aria-pressed': String(tab === 'OPS'), onClick: () => go({ tab: 'OPS' }) }, emb ? 'İş emri operasyonları' : 'Operasyonlar'), h('button', { type: 'button', 'data-testid': 'rt-tab-def', 'aria-pressed': String(tab === 'DEF'), onClick: () => go({ tab: 'DEF' }) }, emb ? 'Hızlı rota formu' : 'Rota tanımı'), h('button', { type: 'button', 'data-testid': 'rt-tab-matrix', 'aria-pressed': String(tab === 'MATRIX'), onClick: () => go({ tab: 'MATRIX' }) }, 'Makine–yetkinlik matrisi')), state.message ? h('div', { 'data-testid': 'rt-message', 'data-kind': state.message.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${state.message.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.message.text) : null, loadError ? h('div', { 'data-testid': 'rt-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, `Yüklenemedi: ${loadError}`) : null, tab === 'PRODUCT' && emb && !loadError ? productTab() : null, tab === 'OPS' && !loadError
        ? h('section', {}, emb ? h('p', { class: 'rt-note', 'data-testid': 'rt-ops-hint' }, 'Bu sekme iş emirlerine UYGULANMIŞ operasyonları gösterir (üretim akışı). Ürünün rota tanımı (OP10, OP30 …) “Ürün operasyonları (rota)” sekmesindedir.') : null, routing && pf?.has(routing.workOrderId) ? pilotBanner(pf.retired(routing.workOrderId)) : null, woIds.length
            ? h('select', { 'data-testid': 'rt-wo', onChange: (e) => go({ tab: 'OPS', workOrderId: e.target.value }) }, ...woIds.map((id) => h('option', { value: id, ...(id === wid ? { selected: 'selected' } : {}) }, pilotText(`İş emri ${id.slice(0, 8)}`, pf?.has(id) === true))))
            : h('div', { 'data-testid': 'rt-no-routed' }, 'Rotası uygulanmış iş emri yok.'), routing ? h('div', { 'data-testid': 'rt-final', 'data-ready': String(routing.finalReleaseReady), style: 'margin:6px 0;font-weight:700' }, routing.finalReleaseReady ? 'Tüm operasyonlar tamam — final serbest bırakma yapılabilir.' : 'Final serbest bırakma için tüm operasyonlar TAMAM olmalı.') : null, ...(routing ? routing.operations.map((o) => opCard(o, routing.workOrderId)) : []))
        : null, tab === 'DEF' && !loadError ? defForm() : null, tab === 'MATRIX' && !loadError
        ? h('section', {}, h('p', { style: 'font-size:12px;color:#555' }, 'BİLİNMİYOR = makinenin yetkinlik şartı henüz incelenmedi; bu "herkes yetkili" demek değildir. Rotalı operasyonlarda yetkili doğrulama gerekir.'), h('div', { 'data-testid': 'mx-summary' }, `İncelenmemiş makine: ${matrix.filter((m) => m.skillReview === 'UNKNOWN').length} / ${matrix.length}`), ...matrix.map(matrixRow))
        : null));
}
