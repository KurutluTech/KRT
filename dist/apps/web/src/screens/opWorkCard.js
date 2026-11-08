// m0211 — OPERASYON ÇALIŞMA KARTI: bir operasyonun A Operasyon · B Üretim · C Teknik kaynaklar · D Kalite bilgisi TEK kartta, TEK "Değişiklikleri kaydet" ile.
// Kurallar: (1) normal veri girişinde gerekçe kutusu YOK; sunucu gerekçe isterse ekran, YAPILAN İŞİN gerçek tanımıyla "Otomatik: …" notu üretir (taslak ve yürürlükteki revizyonda aynı; denetim izine yazılır).
// (2) Kayıt, mevcut RPC'lerin sıralı çağrısıdır: başarısız adım adıyla gösterilir, kaydedilmemiş değişiklik formda KALIR, tüm adımlar bitmeden "başarılı" denmez.
// (3) NC/CAM/takım listesi belge onayı, kalite planı onayı, revizyon geri çekme vb. ayrı kapılardır: bu kart onlara dokunmaz. Yeterlilik tanımsızsa "gerekmiyor" DENMEZ.
import { h } from '../../../../packages/ui/src/h.js';
import { changeText } from '../../../../packages/domain/src/parameters.js';
import { field, invalid, isChecked, val } from '../kx.js';
import { errorText } from '../errorText.js';
import { opLabel } from './opBoxes.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const num = (s) => { const t = String(s).trim().replace(',', '.'); if (t === '')
    return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
/** İşlemin gerçek tanımıyla otomatik audit notu — her zaman ≥10 karakter, boş/uydurma gerekçe değil. */
export const autoWhy = (what) => `Otomatik: ${String(what || 'rota düzenleme')}`.slice(0, 400);
const WARN_TR = { ALT_NOT_PRODUCTION_ELIGIBLE: 'alternatif makine şu an üretime uygun değil', ALT_MACHINE_CLASS_DIFFERS: 'alternatif makine sınıfı ana makineden farklı', ALT_SKILL_REQUIREMENTS_UNKNOWN: 'alternatif makinenin beceri şartı tanımsız', ALT_NO_CAM_FOR_MACHINE: 'alternatif makine için CAM/NC kaydı yok' };
const KIND_TR = { FIXTURE: 'Fikstür', TOOL: 'Takım', GAUGE: 'Mastar/Ölçü', RESOURCE: 'Kaynak', ROBOT: 'Robot', FIRST_PIECE: 'İlk parça', IN_PROCESS: 'Proses içi', FINAL: 'Son kontrol' };
const COOLANT_TR = { BOR_YAGI: 'Bor yağı', EMULSIYON: 'Emülsiyon', KURU: 'Kuru', HAVA: 'Hava', MQL: 'MQL' };
const fnum = (x) => String(x).replace('.', ',');
const cutText = (p) => `${p.material} · Hız ${fnum(p.speed)} ${p.speedUnit} · İlerleme ${fnum(p.feed)} ${p.feedUnit} · ${COOLANT_TR[p.coolant] ?? p.coolant}`;
const MISS_TR = { machine: 'Makine', nc_cam: 'NC / CAM programı', setup_minutes: 'Hazırlık süresi', cycle_seconds: 'Çevrim süresi', control_plan: 'Onaylı kontrol planı (Kalite)', first_piece_decision: 'İlk parça kararı', eligible_operator: 'Yeterli operatör yok (Yönetim)', material_definition: 'Malzeme tanımı', material_stock: 'Malzeme stoğu' };
const ADV_TR = { fixture: 'Aparat / bağlama bilgisi', saw_blade: 'Testere bıçağı', cut_parameters: 'Kesme parametreleri', tool_list: 'Takım listesi' };
const MISS_TAB = { machine: 'genel', nc_cam: 'dosya', setup_minutes: 'sure', cycle_seconds: 'sure', control_plan: 'kalite', first_piece_decision: 'genel', eligible_operator: 'genel' };
const ADV_TAB = { fixture: 'kaynak', saw_blade: 'kaynak', cut_parameters: 'kaynak', tool_list: 'dosya' };
const TAG = { calc: ['HESAPLAR', 'Bu veri süre / kapasite hesabına girer'], gate: ['ENGELLER', 'Eksikse iş emri başlatılamaz'], info: ['KAYIT', 'Sadece kayıt/izlenebilirlik: hesaba girmez, iş emrini engellemez'] };
const tag = (k) => h('span', { class: `owc-tag owc-tag-${k}`, title: TAG[k][1], 'data-tag': k }, TAG[k][0]);
const OWC_CSS = `.owc-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.4px;padding:1px 6px;border-radius:8px;margin-left:6px;vertical-align:middle}.owc-tag-calc{background:#1d4ed8;color:#fff}.owc-tag-gate{background:#b91c1c;color:#fff}.owc-tag-info{background:#475569;color:#e2e8f0}
.owc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.owc-tabs button{padding:6px 12px}.owc-tabs button[aria-selected=true]{outline:2px solid #3b82f6}.owc-pane[hidden]{display:none}
.owc-sum{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.owc-leg{font-size:12px;opacity:.85;margin:4px 0}.owc-bar{position:sticky;bottom:0;padding:8px 0;background:inherit}`;
const section = (id, title, open, ...kids) => h('details', { class: 'fsec owc-sec', 'data-testid': `owc-${id}`, open }, h('summary', {}, title), E('div', { class: 'owc-body' }, ...kids));
/** Başka operasyona bağlı belge adayı: bu operasyonla BAĞLANAMAZ. Mevcut backend, ortak kullanım için yetkili doğrulaması / uygunluk kanıtı / özel audit sağlamıyor (document_link_operation yalnız bağlar);
 *  bu korumalar ekranda taklit edilmez → istisna bağlantısı KAPALI. Salt okunur bilgi: hangi operasyona/makineye ait olduğu gösterilir. */
export function docVerdict(candidate, op, machineCodesOfOp) {
    const diffMachine = candidate.fromMachines.length && machineCodesOfOp.length && !candidate.fromMachines.some((c) => machineCodesOfOp.includes(c));
    return { tone: 'bad', blocked: true, text: `${candidate.fromOpCode} (${candidate.fromMachines.join('/') || 'makine ?'}) operasyonuna ait — ${op.opCode ?? 'bu operasyon'} için BAĞLANAMAZ${diffMachine ? ' (farklı makine)' : ''}. Bu operasyona özel NC/takım listesi yükleyin.` };
}
/** ctx: { api, ws, rev, machines, skills, activeOps, can, fail, reload, chainNow(), mkChainHost? } */
export function buildOpWorkCard(ctx, o) {
    const { api, ws, rev, machines, skills, activeOps, fail, reload } = ctx;
    const robots = ctx.robots ?? [];
    const curPrimary = o.machines.find((x) => x.primary)?.id ?? (o.machines.length === 1 ? o.machines[0].id : '');
    const baseAlts = o.machines.filter((x) => x.id !== curPrimary).map((x) => x.id);
    const base = { name: o.name ?? '', primary: curPrimary, alts: new Set(baseAlts), skill: o.skillCode ?? '', level: o.skillLevel != null ? String(o.skillLevel) : '',
        setup: o.setupMinutes != null ? String(o.setupMinutes) : '', cycle: o.cycleSeconds != null ? String(o.cycleSeconds) : '', fp: !!(o.firstPieceRequired ?? true), qc: !!o.qcRequired,
        ins: o.instructions ?? '', insp: o.inspectionSeconds != null ? String(o.inspectionSeconds) : '' };
    // ---- A / B alanları
    const name = h('input', { 'data-testid': 'pw-op-name', value: base.name });
    const primary = h('select', { 'data-testid': 'pw-op-primary' }, h('option', { value: '' }, '— ana makine seçin —'), ...machines.map((m) => h('option', { value: m.id, selected: m.id === curPrimary }, m.code)));
    const alt = machines.map((m) => ({ m, box: h('input', { type: 'checkbox', 'data-testid': `pw-op-m-${m.code}`, checked: base.alts.has(m.id) }) }));
    const syncAlt = () => { for (const x of alt) {
        const same = x.m.id === val(primary);
        if (same)
            x.box.checked = false;
        x.box.disabled = same;
    } };
    primary.addEventListener('change', syncAlt);
    syncAlt();
    const skill = skills.length ? h('select', { 'data-testid': 'pw-op-skill' }, h('option', { value: '' }, '— yeterlilik tanımsız —'),
        ...(base.skill && !skills.some((x) => x.code === base.skill) ? [h('option', { value: base.skill, selected: true }, `${base.skill} (listede yok / pasif)`)] : []),
        ...skills.map((x) => h('option', { value: x.code, selected: x.code === base.skill }, `${x.name} (${x.code})`)))
        : h('input', { 'data-testid': 'pw-op-skill', value: base.skill, placeholder: 'Yeterlilik kodu' });
    const level = h('select', { 'data-testid': 'pw-op-level' }, h('option', { value: '' }, '— seviye —'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => h('option', { value: String(n), selected: o.skillLevel === n }, `Seviye ${n}`)));
    const setup = h('input', { 'data-testid': 'pw-op-setup', inputmode: 'decimal', value: base.setup });
    const cycle = h('input', { 'data-testid': 'pw-op-cycle', inputmode: 'decimal', value: base.cycle });
    const insp = h('input', { 'data-testid': 'pw-insp-value', inputmode: 'decimal', placeholder: 'sn/adet', value: base.insp });
    const fp = h('input', { type: 'checkbox', 'data-testid': 'pw-op-fp', checked: base.fp });
    const qc = h('input', { type: 'checkbox', 'data-testid': 'pw-op-qc', checked: base.qc });
    const ins = h('textarea', { 'data-testid': 'pw-op-instr', placeholder: 'Operatör talimatı' });
    ins.value = base.ins;
    // ---- bekleyen (henüz kaydedilmemiş) listeler: kaynak, kalite noktası, ön koşul
    const pend = { res: [], qc: [], dep: [], cut: [] };
    const pendHost = E('div', { class: 'owc-pend', 'data-testid': 'owc-pending' });
    const resKind = h('select', { 'data-testid': 'pw-res-kind' }, ...['FIXTURE', 'TOOL', 'GAUGE', 'RESOURCE', 'ROBOT'].map((k) => h('option', { value: k }, KIND_TR[k])));
    const resCode = h('input', { 'data-testid': 'pw-res-code', placeholder: 'Kod (ör. T12, FX-01)' });
    // ROBOT seçilince kod alanı yerine KAYITLI, arşivsiz robotların listesi (Yeni makine ekle → Robot / Otomasyon). Robot yetkinlik/başlatma kapısı değildir; yalnız operasyonda kullanılan kaynağı kaydeder.
    const resRobot = h('select', { 'data-testid': 'pw-res-robot', hidden: true }, h('option', { value: '' }, robots.length ? '— robot seçin —' : '— kayıtlı robot yok (Yeni makine ekle → Robot / Otomasyon) —'), ...robots.map((r) => h('option', { value: r.code }, r.name ? `${r.code} · ${r.name}` : r.code)));
    const syncResKind = () => { const isRobot = val(resKind) === 'ROBOT'; resRobot.hidden = !isRobot; resCode.hidden = isRobot; };
    resKind.addEventListener('change', syncResKind);
    const qcNo = h('input', { 'data-testid': 'pw-qc-no', type: 'number', min: 1, placeholder: 'No' });
    const qcLabel = h('input', { 'data-testid': 'pw-qc-label', placeholder: 'Kontrol (ör. Çap Ø20 H7)' });
    const plans = ws.quality.filter((q) => q.operationNo === null || q.operationNo === o.opNo);
    const qcPlan = h('select', { 'data-testid': 'pw-qc-plan' }, h('option', { value: '' }, '— kontrol planı seçilmedi —'), ...plans.map((q) => h('option', { value: q.id }, `${q.operationNo != null ? 'OP' + q.operationNo : 'Genel'} v${q.version} (${q.status}) · ${q.characteristics} karakteristik`)));
    const qcKind = h('select', { 'data-testid': 'pw-qc-kind' }, ...['FIRST_PIECE', 'IN_PROCESS', 'FINAL'].map((k) => h('option', { value: k }, KIND_TR[k])));
    const depSel = h('select', { 'data-testid': 'pw-dep-sel' }, h('option', { value: '' }, '— ön koşul operasyon —'), ...activeOps.filter((x) => x.opNo < o.opNo && !o.dependsOn.some((d) => d.operationId === x.id)).map((x) => h('option', { value: x.id }, opLabel(x))));
    const statusHost = E('div', { 'data-testid': 'owc-status', role: 'status', 'aria-live': 'polite' });
    const drawPend = () => {
        const chip = (txt, rm) => E('span', { class: 'chip warn owc-chip' }, txt, ' ', h('button', { type: 'button', class: 'ghost sm', 'aria-label': 'Vazgeç', onClick: rm }, '✕'));
        const items = [
            ...pend.res.map((p, i) => chip(`${p.on ? '＋' : '−'} ${KIND_TR[p.kind] ?? p.kind} ${p.code}`, () => { pend.res.splice(i, 1); drawPend(); })),
            ...pend.qc.map((p, i) => chip(`＋ KN${p.no} ${p.label}`, () => { pend.qc.splice(i, 1); drawPend(); })),
            ...pend.dep.map((p, i) => chip(`${p.on ? '＋' : '−'} Ön koşul ${p.code}`, () => { pend.dep.splice(i, 1); drawPend(); })),
            ...pend.cut.map((p, i) => chip(`＋ Kesme: ${cutText(p)}`, () => { pend.cut.splice(i, 1); drawAll(); })),
        ];
        pendHost.replaceChildren(...(items.length ? [E('div', { class: 'mut' }, 'Kaydedilmeyi bekleyen:'), E('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' }, ...items)] : []));
    };
    const existingRes = E('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px;margin-top:6px' }, ...o.resources.map((r) => h('button', { type: 'button', class: 'ghost sm', 'data-testid': `pw-res-del-${r.code}`, onClick: () => { if (!pend.res.some((p) => p.code === r.code && !p.on)) {
            pend.res.push({ kind: r.kind, code: r.code, label: r.label, qty: r.qty, note: r.note, on: false });
            drawPend();
        } } }, `✕ ${KIND_TR[r.kind] ?? r.kind} ${r.code}`)));
    const existingDep = E('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px;margin-top:6px' }, ...o.dependsOn.map((d) => h('button', { type: 'button', class: 'ghost sm', onClick: () => { if (!pend.dep.some((p) => p.id === d.operationId)) {
            pend.dep.push({ id: d.operationId, code: opLabel(activeOps.find((a) => a.id === d.operationId) ?? d), on: false });
            drawPend();
        } } }, `✕ ${opLabel(activeOps.find((a) => a.id === d.operationId) ?? d)}`)));
    const exQc = o.qcPoints.length ? E('div', { class: 'mut' }, `Kayıtlı: ${o.qcPoints.map((q) => `KN${q.pointNo} ${q.label}`).join('; ')}`) : null;
    const addBtn = (label, testid, fn) => h('button', { type: 'button', class: 'ghost', 'data-testid': testid, onClick: fn }, label);
    // ---- değişiklik tespiti
    const cur = () => ({ name: val(name).trim(), primary: val(primary), alts: new Set(alt.filter((x) => isChecked(x.box) && x.m.id !== val(primary)).map((x) => x.m.id)), skill: val(skill).trim(), level: val(level).trim(),
        setup: val(setup).trim(), cycle: val(cycle).trim(), fp: isChecked(fp), qc: isChecked(qc), ins: val(ins).trim(), insp: val(insp).trim() });
    const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    const opDirty = () => { const c = cur(); return c.name !== base.name.trim() || c.primary !== base.primary || !eqSet(c.alts, base.alts) || c.skill !== base.skill || c.level !== base.level || c.setup !== base.setup || c.cycle !== base.cycle || c.fp !== base.fp || c.qc !== base.qc || c.ins !== base.ins.trim(); };
    const inspDirty = () => cur().insp !== base.insp;
    const dirtyCount = () => (opDirty() ? 1 : 0) + (inspDirty() ? 1 : 0) + pend.res.length + pend.qc.length + pend.dep.length + pend.cut.length;
    const saveBtn = h('button', { type: 'button', class: 'primary', 'data-testid': 'owc-save' }, 'Değişiklikleri kaydet');
    const refreshBtn = () => { const n = dirtyCount(); saveBtn.disabled = n === 0; saveBtn.textContent = n ? `Değişiklikleri kaydet (${n})` : 'Değişiklik yok'; };
    const wire = (...els) => { for (const e of els) {
        e.addEventListener('input', refreshBtn);
        e.addEventListener('change', refreshBtn);
    } };
    wire(name, primary, ...alt.map((x) => x.box), skill, level, setup, cycle, insp, fp, qc, ins);
    const oldDraw = drawPend;
    const drawAll = () => { oldDraw(); refreshBtn(); };
    // eklemeler (yerel; kayıt tek düğmeyle)
    const addRes = () => { const isRobot = val(resKind) === 'ROBOT'; const code = (isRobot ? val(resRobot) : val(resCode)).trim(); const box = isRobot ? resRobot : resCode; if (!code) {
        invalid(box, true);
        return;
    } if (pend.res.some((p) => p.on && p.kind === val(resKind) && p.code === code)) {
        return;
    } invalid(box, false); const rb = isRobot ? robots.find((r) => r.code === code) : null; pend.res.push({ kind: val(resKind), code, label: rb?.name ?? null, qty: null, note: null, on: true }); resCode.value = ''; resRobot.value = ''; drawAll(); };
    const addQc = () => { const no = Number(val(qcNo)); const label = val(qcLabel).trim(); if (!(no >= 1) || !label) {
        invalid(!(no >= 1) ? qcNo : qcLabel, true);
        return;
    } invalid(qcNo, false); invalid(qcLabel, false); pend.qc.push({ no, label, kind: val(qcKind), plan: val(qcPlan) || null }); qcNo.value = ''; qcLabel.value = ''; drawAll(); };
    const addDep = () => { const id = val(depSel); if (!id)
        return; const x = activeOps.find((a) => a.id === id); pend.dep.push({ id, code: x ? opLabel(x) : id, on: true }); depSel.value = ''; drawAll(); };
    // ---- tek kayıt akışı
    let saving = false;
    const save = async () => {
        if (saving)
            return;
        const c = cur();
        if (opDirty()) {
            if (!c.primary) {
                invalid(primary, true);
                return fail(new Error('Eksik alan: ana makine seçilmeli'));
            }
            invalid(primary, false);
            if (!c.name) {
                invalid(name, true);
                return fail(new Error('Eksik alan: operasyon adı'));
            }
            invalid(name, false);
            if (!!c.skill !== !!c.level)
                return fail(new Error('Yeterlilik ve seviye birlikte seçilmeli (ya da ikisi de boş bırakılmalı).'));
        }
        if (inspDirty() && c.insp !== '' && num(c.insp) === null) {
            invalid(insp, true);
            return fail(new Error('VALUE_OUT_OF_RANGE'));
        }
        invalid(insp, false);
        saving = true;
        saveBtn.disabled = true;
        // Her adım: run (RPC), verify(freshOp) = sunucudaki GERÇEK kayıtta bu adımın sonucu var mı, deps = önce başarılı olması gereken adım kimlikleri, commit() = yerel taban/bekleyen listeyi günceller.
        const steps = [];
        const cc0 = cur();
        const same = (a, b) => (a ?? null) === (b ?? null);
        if (opDirty()) {
            const want = { ...cc0, alts: new Set(cc0.alts) };
            steps.push({ id: 'op', label: 'Operasyon bilgileri', run: async () => {
                    const diffs = [];
                    if (want.setup !== base.setup)
                        diffs.push(`Hazırlık ${changeText(num(base.setup), num(want.setup), 'dk')}`);
                    if (want.cycle !== base.cycle)
                        diffs.push(`Çevrim ${changeText(num(base.cycle), num(want.cycle), 'sn')}`);
                    if (want.name !== base.name.trim())
                        diffs.push(`Ad ${changeText(base.name, want.name)}`);
                    if (want.primary !== base.primary || !eqSet(want.alts, base.alts))
                        diffs.push('makine tanımı');
                    await api.saveOperation({ revisionId: rev.id, opNo: o.opNo, name: want.name, machineIds: [want.primary, ...want.alts], primaryId: want.primary, skillCode: want.skill || null, skillLevel: num(want.level),
                        camId: o.camProgramId ?? null, setup: num(want.setup), cycle: num(want.cycle), firstPiece: want.fp, qc: want.qc, instructions: want.ins || null, reason: autoWhy(`${o.opCode} ${diffs.length ? diffs.join('; ') : 'düzenleme'}`) });
                }, verify: (f) => {
                    const prim = f.machines.find((x) => x.primary)?.id ?? (f.machines.length === 1 ? f.machines[0].id : '');
                    const alts = new Set(f.machines.filter((x) => x.id !== prim).map((x) => x.id));
                    return f.name === want.name && prim === want.primary && eqSet(alts, want.alts) && (f.skillCode ?? '') === want.skill && String(f.skillLevel ?? '') === want.level
                        && String(f.setupMinutes ?? '') === want.setup && String(f.cycleSeconds ?? '') === want.cycle && !!f.firstPieceRequired === want.fp && !!f.qcRequired === want.qc && (f.instructions ?? '') === want.ins;
                }, commit: () => Object.assign(base, { name: want.name, primary: want.primary, alts: want.alts, skill: want.skill, level: want.level, setup: want.setup, cycle: want.cycle, fp: want.fp, qc: want.qc, ins: want.ins }) });
            if (want.alts.size)
                steps.push({ id: 'warn', label: 'Alternatif makine uyarıları', deps: ['op'], informational: true, run: async () => {
                        const warn = await api.machineWarnings(o.id, want.primary, [...want.alts]);
                        if (warn.length)
                            steps.warnings = [...new Set(warn.map((w) => WARN_TR[w.code] ?? w.code))];
                    }, verify: () => true, commit: () => { } });
        }
        if (inspDirty()) {
            const v = num(cc0.insp);
            if (v === null) {
                saving = false;
                refreshBtn();
                invalid(insp, true);
                return fail(new Error('VALUE_OUT_OF_RANGE'));
            }
            steps.push({ id: 'insp', label: 'Muayene süresi', run: async () => { await api.setParameter('OP_INSPECTION_SEC', o.id, v, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }), null, autoWhy(`${o.opCode} muayene süresi ${changeText(num(base.insp), v, 'sn')}`)); },
                verify: (f) => Number(f.inspectionSeconds) === v, commit: () => { base.insp = cc0.insp; } });
        }
        for (const p of [...pend.res])
            steps.push({ id: `res:${p.code}`, label: `${p.on ? 'Kaynak ekle' : 'Kaynak kaldır'}: ${p.code}`, run: async () => { await api.setResource(o.id, p.kind, p.code, p.label, p.qty, p.note, p.on, autoWhy(`${o.opCode} ${p.on ? 'kaynak eklendi' : 'kaynak kaldırıldı'} ${p.code}`)); },
                verify: (f) => f.resources.some((r) => r.code === p.code && r.kind === p.kind) === p.on, commit: () => { const i = pend.res.indexOf(p); if (i >= 0) pend.res.splice(i, 1); } });
        for (const p of [...pend.cut])
            steps.push({ id: `cut:${p.material}`, label: `Kesme parametresi: ${p.material}`, run: async () => { await api.setCutParams(o.id, p.material, p.speed, p.speedUnit, p.feed, p.feedUnit, p.coolant, autoWhy(`${o.opCode} kesme parametresi ${p.material}`)); },
                verify: (f) => f.resources.some((r) => r.kind === 'RESOURCE' && String(r.code).startsWith('CUT-') && r.label === p.material), commit: () => { const i = pend.cut.indexOf(p); if (i >= 0) pend.cut.splice(i, 1); } });
        for (const p of [...pend.qc])
            steps.push({ id: `qc:${p.no}`, label: `Kalite noktası: KN${p.no}`, run: async () => { await api.setQcPoint(o.id, p.no, p.label, p.kind, p.plan, null, true, autoWhy(`${o.opCode} kalite noktası KN${p.no}`)); },
                verify: (f) => f.qcPoints.some((q) => Number(q.pointNo) === p.no && same(q.label, p.label)), commit: () => { const i = pend.qc.indexOf(p); if (i >= 0) pend.qc.splice(i, 1); } });
        for (const p of [...pend.dep])
            steps.push({ id: `dep:${p.id}`, label: `Ön koşul: ${p.code}`, run: async () => { await api.setDependency(o.id, p.id, p.on, autoWhy(`${o.opCode} ön koşul ${p.on ? 'eklendi' : 'kaldırıldı'} ${p.code}`)); },
                verify: (f) => f.dependsOn.some((d) => d.operationId === p.id) === p.on, commit: () => { const i = pend.dep.indexOf(p); if (i >= 0) pend.dep.splice(i, 1); } });
        // 1) sırayla gönder; bağımlı adımın öncülü başarısızsa GÖNDERME (atlanır)
        const outcome = new Map();
        for (const s of steps) {
            if ((s.deps ?? []).some((d) => outcome.get(d) !== 'ok')) {
                outcome.set(s.id, 'skipped');
                continue;
            }
            try {
                await s.run();
                outcome.set(s.id, 'ok');
            }
            catch (e) {
                outcome.set(s.id, { error: errorText(e) });
            }
        }
        // 2) sunucudaki GERÇEK kaydı yeniden oku (hata sonrası kullanıcıya iyimser sayım gösterilmez)
        const anyBad = steps.some((s) => outcome.get(s.id) !== 'ok');
        let fresh = null;
        if (anyBad) {
            try {
                const w = await ctx.loadFresh();
                fresh = (w.routing ?? []).find((x) => x.id === o.id) ?? null;
            }
            catch { fresh = null; }
        }
        const saved = [], notSaved = [];
        for (const s of steps) {
            const oc = outcome.get(s.id);
            const persisted = oc === 'ok' ? (fresh && !s.informational ? s.verify(fresh) !== false : true) : (fresh && !s.informational ? s.verify(fresh) === true && oc !== 'skipped' : false);
            if (persisted) {
                s.commit();
                if (!s.informational)
                    saved.push(s.label + (oc === 'ok' ? '' : ' (hata yanıtına rağmen sunucuda kayıtlı)'));
            }
            else if (!s.informational || oc !== 'ok')
                notSaved.push({ label: s.label, text: oc === 'skipped' ? 'ATLANDI — önceki adım kaydedilemedi (bağımlı adım gönderilmedi)' : oc?.error ?? 'sunucuda kayıt doğrulanamadı' });
        }
        saving = false;
        drawAll();
        if (!anyBad) {
            const w = steps.warnings?.length ? ` Uyarı: ${steps.warnings.join('; ')}.` : '';
            await reload(`${o.opCode}: ${saved.length} değişiklik kaydedildi.${w}`, 'ok', { openOp: o.id });
            return;
        }
        if (!fresh)
            notSaved.push({ label: 'Sunucu durumu', text: 'kayıtlar yeniden okunamadı; kaydedildi sayılmadı — sayfayı yenileyip kontrol edin' });
        if (!notSaved.length) {
            await reload(`${o.opCode}: ${saved.length} değişiklik sunucuda doğrulandı.`, 'ok', { openOp: o.id });
            return;
        }
        statusHost.replaceChildren(E('div', { class: 'banner bad', 'data-testid': 'owc-partial' }, E('b', {}, `${fresh ? 'Sunucuda doğrulanan' : 'Sunucu yanıtıyla kaydedilen (yeniden okunamadı)'}: ${saved.length} adım. KAYDEDİLEMEYEN: ${notSaved.length} adım — formda duruyor, tekrar deneyebilirsiniz.`),
            saved.length ? E('div', { class: 'mut' }, `Kayıtlı: ${saved.join('; ')}`) : null, E('ul', {}, ...notSaved.map((f) => E('li', {}, E('b', {}, f.label), ': ', f.text)))));
    };
    saveBtn.addEventListener('click', () => void save());
    drawAll();
    // ---- v2 düzen: sekmeli kart, makine tipine göre sadeleşir, her alanda HESAPLAR / ENGELLER / KAYIT rozeti
    const L = (t, ...tags) => h('span', {}, t, ...tags.map(tag));
    const g = (x, a, b) => (x ? x[a] ?? x[b] : undefined);
    const slotRef = { v: null };
    const stripHost = E('div', { 'data-testid': 'owc-strip' });
    const tabs = [['genel', 'Genel'], ['sure', 'Süre'], ['kaynak', 'Kaynaklar'], ['kalite', 'Kalite'], ['dosya', 'Dosyalar']];
    const panes = {}, tabBtns = {};
    const showTab = (id) => { for (const [k] of tabs) { panes[k].hidden = k !== id; tabBtns[k].setAttribute('aria-selected', String(k === id)); } if (id === 'dosya') mountFiles(); };
    // ---- Süre sekmesi: Hesapla
    const qtyIn = h('input', { type: 'number', min: 1, 'data-testid': 'owc-calc-qty', placeholder: 'adet', value: ctx.qty ? String(ctx.qty) : '' });
    const calcOut = E('div', { 'data-testid': 'owc-calc-out', role: 'status', 'aria-live': 'polite' });
    const calcLine = (a, b) => E('div', { class: 'row', style: 'gap:8px' }, E('span', { class: 'mut', style: 'min-width:210px' }, a), E('b', {}, b));
    const doCalc = async () => {
        const q = Number(val(qtyIn));
        if (!(q > 0)) { invalid(qtyIn, true); return; }
        invalid(qtyIn, false);
        const c = cur();
        const timeDirty = c.setup !== base.setup || c.cycle !== base.cycle || c.insp !== base.insp;
        const f2 = (x) => (x === null || x === undefined ? 'VERİ YOK' : x.toLocaleString('tr-TR', { maximumFractionDigits: 2 }));
        let s0, cy, ins, mins, source;
        if (!timeDirty && api.estimate && rev?.id) {
            try { const e = await api.estimate(rev.id, q); const x = (e.operations ?? []).find((y) => y.opNo === o.opNo); s0 = x?.setupMin ?? null; cy = x?.cycleSec ?? null; ins = x?.inspectionSec ?? null; mins = x?.state === 'MISSING' ? null : x?.minutes ?? null; source = 'Sunucu hesabı (kayıtlı değerlerle)'; }
            catch (e) { return fail(e); }
        }
        else { s0 = num(c.setup); cy = num(c.cycle); ins = num(c.insp); mins = s0 !== null && cy !== null ? s0 + (q * cy) / 60 : null; source = 'Önizleme — henüz kaydedilmedi (kaydedince sunucu hesabı yapılır)'; }
        calcOut.replaceChildren(E('div', { class: 'mut' }, source),
            calcLine('Hazırlık (parti başına bir kez)', s0 === null ? 'VERİ YOK' : `${f2(s0)} dk`),
            calcLine(`CNC/makine çevrimi (${q} adet × ${cy === null ? '?' : f2(cy)} sn)`, cy === null ? 'VERİ YOK' : `${f2((q * cy) / 60)} dk`),
            calcLine('Kalite muayenesi (paralel, makineye eklenmez)', ins === null ? 'VERİ YOK' : `${f2((q * ins) / 60)} dk`),
            calcLine('Makine süresi toplamı', mins === null ? 'HESAPLANAMADI — hazırlık veya çevrim girilmemiş' : `${f2(mins)} dk ≈ ${f2(mins / 60)} saat`),
            cy ? calcLine('Çevrim hızı', `≈ ${f2(3600 / cy)} adet/saat`) : null,
            E('div', { class: 'mut' }, 'Formül: hazırlık + adet × çevrim ÷ 60. Eksik veri 0 sayılmaz.'));
    };
    // ---- Kaynaklar sekmesi
    const hasBlade = () => { const sl = slotRef.v; return !sl || g(g(sl, 'requirements'), 'cuttingToolType', 'cutting_tool_type') != null; };
    const defHost = E('div', { 'data-testid': 'owc-machine-defaults' });
    const defBlade = h('input', { 'data-testid': 'owc-def-blade', placeholder: 'ör. Simonds 27×0,9 Z-5/8 3660' });
    const defFixture = h('input', { 'data-testid': 'owc-def-fixture', placeholder: 'ör. Makine mengenesi' });
    const defState = { id: curPrimary || null, blade: null, fixture: null, robot: null, loaded: false };
    const defRobot = h('select', { 'data-testid': 'owc-def-robot' }, h('option', { value: '' }, '— robot yok —'), ...(ctx.robots ?? []).map((r) => h('option', { value: r.code }, r.name ? `${r.code} · ${r.name}` : r.code)));
    const drawDefaults = () => {
        if (!defState.id || !api.machineDefaults) { defHost.replaceChildren(); return; }
        const m = machines.find((x) => x.id === defState.id);
        const useFx = h('button', { type: 'button', class: 'ghost sm', 'data-testid': 'owc-use-default-fixture', disabled: !defState.fixture, onClick: () => { const code = defState.fixture; if (code && !pend.res.some((p) => p.on && p.kind === 'FIXTURE' && p.code === code)) { pend.res.push({ kind: 'FIXTURE', code, label: 'Makine varsayılanı', qty: null, note: null, on: true }); drawAll(); } } }, 'Varsayılan aparatı bu operasyona yaz');
        const saveDef = h('button', { type: 'button', class: 'ghost', 'data-testid': 'owc-def-save', onClick: async () => { try { await api.setMachineDefaults(defState.id, val(defBlade).trim() || null, val(defFixture).trim() || null); defState.blade = val(defBlade).trim() || null; defState.fixture = val(defFixture).trim() || null; drawDefaults(); statusHost.replaceChildren(E('div', { class: 'banner ok' }, `Makine ${m?.code ?? ''} varsayılanı kaydedildi.`)); } catch (e) { fail(e); } } }, 'Makineye kaydet');
        const saveRobot = h('button', { type: 'button', class: 'ghost', 'data-testid': 'owc-def-robot-save', onClick: async () => { try { const code = val(defRobot) || null; await api.setMachineRobot(defState.id, code); defState.robot = code; drawDefaults(); statusHost.replaceChildren(E('div', { class: 'banner ok' }, code ? `Makine ${m?.code ?? ''} ← robot ${code} bağlandı.` : `Makine ${m?.code ?? ''} robot bağlantısı kaldırıldı.`)); } catch (e) { fail(e); } } }, 'Robotu makineye kaydet');
        defRobot.value = defState.robot ?? '';
        defBlade.value = defState.blade ?? ''; defFixture.value = defState.fixture ?? '';
        defHost.replaceChildren(E('div', { class: 'owc-leg' }, L(`Makine ${m?.code ?? ''} varsayılanları — bir kez girilir, her üründe geçerlidir`, 'info')),
            E('div', { class: 'fgrid' }, field('Varsayılan testere bıçağı', defBlade), field('Varsayılan aparat / bağlama', defFixture)),
            E('div', { class: 'row', style: 'gap:8px' }, saveDef, useFx),
            (ctx.robots ?? []).length && api.setMachineRobot ? E('div', { 'data-testid': 'owc-def-robot-box' }, E('div', { class: 'fgrid' }, field('Makineye bağlı robot (sabit)', defRobot)), E('div', { class: 'row', style: 'gap:8px' }, saveRobot), E('div', { class: 'mut' }, defState.robot ? `Bu makinede robot: ${(ctx.robots ?? []).find((r) => r.code === defState.robot)?.name ?? defState.robot} — operasyona ayrıca eklemek gerekmez. Robotla çalışan operatör için Robot operatörü yetkinliği, Akademi & Yetkinlik → Makine yetkinlik şartları ekranından şart olarak tanımlanabilir.` : 'Robot sabit duruyorsa (ör. torna yükleme) bir kez bağlayın; operasyonlarda otomatik görünür.')) : null,
            E('div', { class: 'mut' }, defState.blade ? `Bu makinede bıçak: ${defState.blade} (operasyona ayrıca yazmaya gerek yok)` : ''));
    };
    const cutMat = h('input', { 'data-testid': 'owc-cut-mat', placeholder: 'Malzeme (ör. 4140 Ø37)', list: 'owc-mat-list' });
    const cutSpeed = h('input', { 'data-testid': 'owc-cut-speed', inputmode: 'decimal', placeholder: 'Hız' });
    const cutSpeedU = h('select', { 'data-testid': 'owc-cut-speed-u' }, ...['dev/dk', 'm/dk'].map((u) => h('option', { value: u }, u)));
    const cutFeed = h('input', { 'data-testid': 'owc-cut-feed', inputmode: 'decimal', placeholder: 'İlerleme' });
    const cutFeedU = h('select', { 'data-testid': 'owc-cut-feed-u' }, ...['mm/dk', 'mm/dev', 'mm/diş'].map((u) => h('option', { value: u }, u)));
    const cutCool = h('select', { 'data-testid': 'owc-cut-cool' }, h('option', { value: '' }, '— soğutma —'), ...Object.entries(COOLANT_TR).map(([k, v]) => h('option', { value: k }, v)));
    const matList = h('datalist', { id: 'owc-mat-list' }, ...[...new Set([ws?.product?.material, ...(ws?.bom ?? []).map((b) => b.materialCode)].filter(Boolean))].map((m) => h('option', { value: m })));
    const addCut = () => {
        const sp = num(val(cutSpeed)), fd = num(val(cutFeed)), mat = val(cutMat).trim();
        let bad = false;
        for (const [ok, el] of [[mat.length >= 2, cutMat], [sp !== null && sp > 0, cutSpeed], [fd !== null && fd > 0, cutFeed], [!!val(cutCool), cutCool]]) { invalid(el, !ok); if (!ok) bad = true; }
        if (bad) return;
        if (pend.cut.some((p) => p.material === mat)) return;
        pend.cut.push({ material: mat, speed: sp, speedUnit: val(cutSpeedU), feed: fd, feedUnit: val(cutFeedU), coolant: val(cutCool) });
        cutMat.value = ''; cutSpeed.value = ''; cutFeed.value = ''; cutCool.value = ''; drawAll();
    };
    const cutHost = E('div', { 'data-testid': 'owc-cut-existing', class: 'row', style: 'flex-wrap:wrap;gap:6px;margin-top:6px' });
    const cutRows = { v: [] };
    const drawCutExisting = () => {
        const rows = o.resources.filter((r) => r.kind === 'RESOURCE');
        cutHost.replaceChildren(...rows.map((r) => { const pr = cutRows.v.find((x) => x.code === r.code)?.params; const txt = pr ? cutText({ material: pr.material, speed: pr.speed, speedUnit: g(pr, 'speedUnit', 'speed_unit'), feed: pr.feed, feedUnit: g(pr, 'feedUnit', 'feed_unit'), coolant: pr.coolant }) : (r.label ? `${r.label} · ${r.note ?? r.code}` : r.code);
            return h('button', { type: 'button', class: 'ghost sm', title: 'Kaldırmak için tıklayın', onClick: () => { if (!pend.res.some((p) => p.code === r.code && !p.on)) { pend.res.push({ kind: r.kind, code: r.code, label: r.label, qty: r.qty, note: r.note, on: false }); drawAll(); } } }, `✕ ${txt}`); }));
    };
    const otherRes = o.resources.filter((r) => r.kind !== 'RESOURCE');
    const otherHost = E('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px;margin-top:6px' }, ...otherRes.map((r) => h('button', { type: 'button', class: 'ghost sm', 'data-testid': `pw-res-del-${r.code}`, onClick: () => { if (!pend.res.some((p) => p.code === r.code && !p.on)) { pend.res.push({ kind: r.kind, code: r.code, label: r.label, qty: r.qty, note: r.note, on: false }); drawAll(); } } }, `✕ ${KIND_TR[r.kind] ?? r.kind} ${r.code}`)));
    // ---- Dosyalar sekmesi (NC/CAM/takım listesi yalnız gerektiren makine tipinde)
    const chainHost = E('div', { 'data-testid': 'pw-op-chain-host', 'data-op-chain': String(o.opNo) });
    const candHost = E('div', { 'data-testid': 'owc-doc-candidates' });
    const engHost = E('div', { 'data-testid': 'owc-engineering' });
    const filesNote = E('div', { class: 'mut', 'data-testid': 'owc-files-note' });
    const needsFiles = () => { const sl = slotRef.v; if (!sl) return true; const r = g(sl, 'requirements') ?? {}; return !!(r.nc || r.cam || r.tool_list || r.toolList); };
    let filesMounted = false;
    const mountFiles = () => {
        if (!needsFiles()) { filesNote.textContent = 'Bu makine tipinde NC / CAM / CNC takım listesi gerekmiyor. Gerekli ise makine tipi “Makine tipi ve uyumluluk” bölümünden değişir.'; chainHost.hidden = true; candHost.hidden = true; filesLeg.hidden = true; engHost.replaceChildren(); return; }
        filesNote.textContent = ''; filesLeg.hidden = false; chainHost.hidden = false; candHost.hidden = false;
        if (filesMounted) return; filesMounted = true;
        if (ctx.buildEngineering) engHost.replaceChildren(ctx.buildEngineering());
        drawCandidates();
        if (ctx.mountChain) ctx.mountChain(chainHost, o);
    };
    const drawCandidates = () => {
        const myMachines = o.machines.map((m) => m.code);
        const own = new Set((o.documents ?? []).map((d) => d.docNo));
        const rows = [];
        for (const x of ws.routing) {
            if (x.opNo === o.opNo || x.active === false) continue;
            const from = { fromOpNo: x.opNo, fromOpCode: x.opCode ?? `OP${x.opNo}`, fromMachines: (x.machines ?? []).map((m) => m.code) };
            for (const d of x.documents ?? []) if (d.docNo && !own.has(d.docNo)) rows.push({ d, from, verdict: docVerdict(from, o, myMachines) });
        }
        candHost.replaceChildren(rows.length ? h('details', { class: 'owc-alt' }, h('summary', {}, `Diğer operasyonlara ait belgeler (${rows.length}) — sadece bilgi, işlem gerekmez`),
            ...rows.map((r) => E('div', { class: 'row owc-cand mut', style: 'gap:8px;flex-wrap:wrap' }, E('b', {}, r.d.docNo), E('span', {}, `${r.d.docType ?? ''} · ${r.d.controlState ?? ''}`), E('span', { 'data-testid': 'owc-blocked' }, `${r.from.fromOpCode} (${r.from.fromMachines.join('/') || '?'}) operasyonuna ait; bu operasyona bağlanamaz`)))) : null);
    };
    // ---- üst özet
    const drawStrip = () => {
        const sl = slotRef.v;
        if (!sl) { stripHost.replaceChildren(E('div', { class: 'mut' }, 'Hazırlık durumu okunamadı; eksikler burada gösterilemiyor (kayıt alanları yine çalışır).')); return; }
        const miss = sl.missing ?? [], adv = sl.advisories ?? [], blk = (g(sl, 'blockReasons', 'block_reasons') ?? []).filter((b) => /^(MACHINE_|CAM_PROGRAM_|BLADE_LIFE)/.test(b));
        const chips = [...miss.map((m) => h('button', { type: 'button', class: 'chip bad', 'data-testid': 'owc-miss', title: 'İş emrini engeller. Tıklayın: ilgili sekme', onClick: () => showTab(MISS_TAB[m] ?? 'genel') }, `⛔ ${MISS_TR[m] ?? m}`)),
            ...blk.map((b) => E('span', { class: 'chip bad', 'data-testid': 'owc-blk' }, `⛔ ${b}`)),
            ...adv.map((a) => h('button', { type: 'button', class: 'chip', 'data-testid': 'owc-adv', title: 'Uyarı: iş emrini engellemez. Tıklayın: ilgili sekme', onClick: () => showTab(ADV_TAB[a] ?? 'kaynak') }, `ℹ ${ADV_TR[a] ?? a} (uyarı)`))];
        stripHost.replaceChildren(E('div', { class: 'owc-sum' }, miss.length || blk.length ? E('b', {}, `Bu operasyonda ${miss.length + blk.length} engel var:`) : E('b', { 'data-testid': 'owc-ready' }, 'Bu operasyon hazır (engel yok)'), ...chips),
            E('div', { class: 'owc-leg' }, 'Rozetler: ', tag('calc'), ' süre/kapasite hesabına girer · ', tag('gate'), ' eksikse iş başlamaz · ', tag('info'), ' sadece kayıt'));
    };
    const applyVisibility = () => { const saw = hasBlade(); sawBox.hidden = !saw; drawStrip(); drawDefaults(); if (!panes.dosya.hidden) { filesMounted = false; mountFiles(); } };
    const sawBox = E('div', { 'data-testid': 'owc-saw-box' },
        E('div', { class: 'owc-leg' }, L('Kesme parametreleri (şerit testere)', 'info'), ' — malzeme seçilir, sayılar ayrı girilir; metin yazılmaz'),
        E('div', { class: 'row', style: 'align-items:flex-end;gap:8px;flex-wrap:wrap' }, field('Malzeme', cutMat), matList, field('Hız', E('span', {}, cutSpeed, cutSpeedU)), field('İlerleme', E('span', {}, cutFeed, cutFeedU)), field('Soğutma', cutCool), addBtn('Listeye ekle', 'owc-cut-add', addCut)), cutHost);
    const fxCode = h('input', { 'data-testid': 'pw-res-code-extra', placeholder: 'Kod / ad' });
    queueMicrotask(() => { if (api.opPrepMatrix && rev?.id) api.opPrepMatrix(rev.id).then((m) => { const slots = m?.slots ?? []; slotRef.v = slots.find((x) => (g(x, 'routingOperationId', 'routing_operation_id')) === o.id) ?? null; applyVisibility(); }).catch(() => { slotRef.v = null; applyVisibility(); }); else drawStrip();
        if (api.machineDefaults && curPrimary) api.machineDefaults(curPrimary).then((r) => { const x = Array.isArray(r) ? r[0] : r; defState.blade = g(x, 'defaultBlade', 'default_blade') ?? null; defState.fixture = g(x, 'defaultFixture', 'default_fixture') ?? null; drawDefaults(); }).catch(() => { drawDefaults(); });
        if (api.machineRobot && curPrimary) api.machineRobot(curPrimary).then((r) => { const x = Array.isArray(r) ? r[0] : r; defState.robot = g(x, 'defaultRobot', 'default_robot') ?? null; drawDefaults(); }).catch(() => { });
        if (api.resourceParams) api.resourceParams(o.id).then((r) => { cutRows.v = r ?? []; drawCutExisting(); }).catch(() => { }); });
    drawStrip(); drawCutExisting(); drawDefaults();
    const gapMachines = !base.skill && ctx.machineReqs ? o.machines.filter((m) => !ctx.machineReqs.some((r) => r.machineId === m.id)).map((m) => m.code) : [];
    const undefinedSkillNote = !base.skill ? E('div', { class: 'banner warn', 'data-testid': 'owc-skill-note' }, `Yeterlilik şartı TANIMSIZ${gapMachines.length ? ` (makine ${gapMachines.join(', ')})` : ''} — “gerekmiyor” anlamına gelmez; şart sahip kararıyla tanımlanır.`) : null;
    panes.genel = E('div', { class: 'owc-pane', 'data-testid': 'owc-pane-genel' },
        E('div', { class: 'fgrid' }, field(L('Operasyon'), h('input', { value: `${o.opCode}`, disabled: true, 'aria-label': 'Operasyon numarası otomatik' })), field(L('Ad', 'info'), name), field(L('Ana makine', 'calc', 'gate'), primary)),
        h('details', { class: 'owc-alt', 'data-testid': 'pw-op-alt', open: alt.some((x) => isChecked(x.box)) }, h('summary', {}, 'Alternatif makine ekle (isteğe bağlı)'), E('div', { class: 'row', style: 'gap:4px 16px;margin-top:6px' }, ...alt.map((x) => h('label', { class: 'chk' }, x.box, x.m.code))), E('div', { class: 'mut' }, 'Alternatif makine iş başlatma izni vermez; yeterlilik ve kapılar o makine için ayrıca doğrulanır.')),
        E('div', { class: 'fgrid' }, field(L('Yeterlilik', 'gate'), skill), field(L('Seviye (1-10)', 'gate'), level)), undefinedSkillNote,
        E('div', { class: 'row', style: 'gap:4px 20px' }, h('label', { class: 'chk' }, fp, 'İlk parça kontrolü şart', tag('gate')), h('label', { class: 'chk' }, qc, 'Kalite kontrolü şart', tag('gate'))),
        field(L('Operatör talimatı', 'info'), ins),
        E('div', { class: 'row', style: 'align-items:flex-end' }, field(L('Ön koşul operasyon', 'info'), depSel), addBtn('Listeye ekle', 'pw-dep-add', addDep)), existingDep);
    panes.sure = E('div', { class: 'owc-pane', hidden: true, 'data-testid': 'owc-pane-sure' },
        E('div', { class: 'fgrid' }, field(L('Hazırlık (dk)', 'calc', 'gate'), setup), field(L('Çevrim (sn/adet)', 'calc', 'gate'), cycle), field(L('Muayene (sn/adet)', 'calc'), insp)),
        E('div', { class: 'row', style: 'align-items:flex-end;gap:8px' }, field('Adet', qtyIn), h('button', { type: 'button', class: 'primary', 'data-testid': 'owc-calc-run', onClick: () => void doCalc() }, 'Hesapla')), calcOut);
    panes.kaynak = E('div', { class: 'owc-pane', hidden: true, 'data-testid': 'owc-pane-kaynak' }, defHost, sawBox,
        E('div', { class: 'owc-leg' }, L('Aparat / takım / mastar / robot', 'info'), ' — uyarıdır, iş emrini engellemez'),
        E('div', { class: 'row', style: 'align-items:flex-end;gap:8px;flex-wrap:wrap' }, field('Tür', resKind), field('Kod / robot', E('span', {}, resCode, resRobot)), addBtn('Listeye ekle', 'pw-res-add', addRes)), otherHost);
    panes.kalite = E('div', { class: 'owc-pane', hidden: true, 'data-testid': 'owc-pane-kalite' },
        E('div', { class: 'owc-leg' }, L('Kontrol planı onayı Kalite kapısıdır', 'gate'), ' — bu kart planı onaylamaz; seçili plana bağlar.'),
        E('div', { class: 'fgrid' }, field(L('Kontrol planı', 'gate'), qcPlan), field(L('No', 'info'), qcNo), field(L('Kontrol', 'info'), qcLabel), field(L('Tür', 'info'), qcKind)), addBtn('Listeye ekle', 'pw-qc-add', addQc), exQc);
    const filesLeg = E('div', { class: 'owc-leg' }, L('NC / CAM / takım listesi', 'gate'), ' — yalnız gerektiren makine tipinde görünür');
    panes.dosya = E('div', { class: 'owc-pane', hidden: true, 'data-testid': 'owc-pane-dosya' }, filesNote, filesLeg, engHost, chainHost, candHost,
        E('div', { class: 'mut' }, 'CAD ve teknik resim ürün düzeyinde ortak kütüphanededir (Dosyalar bölümü); burada tekrar yüklenmez.'));
    const tabBar = E('div', { class: 'owc-tabs', role: 'tablist' }, ...tabs.map(([k, t]) => { const b = h('button', { type: 'button', class: 'ghost', role: 'tab', 'data-testid': `owc-tab-${k}`, 'aria-selected': String(k === 'genel'), onClick: () => showTab(k) }, t); tabBtns[k] = b; return b; }));
    return E('div', { class: 'owc', 'data-testid': 'pw-op-edit' }, h('style', {}, OWC_CSS), stripHost, tabBar, ...tabs.map(([k]) => panes[k]), pendHost, statusHost, E('div', { class: 'row owc-bar' }, saveBtn));
}
