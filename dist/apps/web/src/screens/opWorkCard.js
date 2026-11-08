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
    const pend = { res: [], qc: [], dep: [] };
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
    const dirtyCount = () => (opDirty() ? 1 : 0) + (inspDirty() ? 1 : 0) + pend.res.length + pend.qc.length + pend.dep.length;
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
    // ---- C: teknik kaynaklar
    const chainHost = E('div', { 'data-testid': 'pw-op-chain-host', 'data-op-chain': String(o.opNo) });
    const candHost = E('div', { 'data-testid': 'owc-doc-candidates' });
    const drawCandidates = () => {
        // kaynak: ürün çalışma alanındaki GERÇEK belge-operasyon bağları (ws.routing[].documents); zincir cevabına güvenilmez
        const myMachines = o.machines.map((m) => m.code);
        const own = new Set((o.documents ?? []).map((d) => d.docNo));
        const rows = [];
        for (const x of ws.routing) {
            if (x.opNo === o.opNo || x.active === false)
                continue;
            const from = { fromOpNo: x.opNo, fromOpCode: x.opCode ?? `OP${x.opNo}`, fromMachines: (x.machines ?? []).map((m) => m.code) };
            for (const d of x.documents ?? [])
                if (d.docNo && !own.has(d.docNo))
                    rows.push({ d, from, verdict: docVerdict(from, o, myMachines) });
        }
        candHost.replaceChildren(...(rows.length ? [E('div', { class: 'mut' }, 'Aynı ürünün başka operasyonlara ait belgeleri (bilgi amaçlı; bu operasyona bağlanamaz):'),
                ...rows.map((r) => E('div', { class: 'row owc-cand', style: 'align-items:center;gap:8px;flex-wrap:wrap' }, E('b', {}, r.d.docNo), E('span', { class: 'mut' }, `${r.d.docType ?? ''} · ${r.d.controlState ?? ''}`), E('span', { class: `chip ${r.verdict.tone}`, 'data-testid': 'owc-blocked' }, r.verdict.text)))]
            : [E('div', { class: 'mut' }, 'Başka operasyonlara ait belge yok. NC için “yükle” satırını kullanın.')]));
    };
    queueMicrotask(() => setTimeout(drawCandidates, 400));
    const gapMachines = !base.skill && ctx.machineReqs ? o.machines.filter((m) => !ctx.machineReqs.some((r) => r.machineId === m.id)).map((m) => m.code) : [];
    const undefinedSkillNote = !base.skill ? E('div', { class: 'banner warn', 'data-testid': 'owc-skill-note' }, `Yeterlilik şartı TANIMSIZ${gapMachines.length ? ` (makine ${gapMachines.join(', ')})` : ''} — “gerekmiyor” anlamına gelmez. START öncesi şart sahip kararıyla tanımlanmalı; bu ekran yeterlilik uydurmaz.`) : null;
    return E('div', { class: 'owc', 'data-testid': 'pw-op-edit' },
        section('A', 'A — Operasyon', true, E('div', { class: 'fgrid' }, field('Operasyon', h('input', { value: `${o.opCode}`, disabled: true, 'aria-label': 'Operasyon numarası otomatik' })), field('Ad', name), field('Ana makine', primary)),
            h('details', { class: 'owc-alt', 'data-testid': 'pw-op-alt', open: alt.some((x) => isChecked(x.box)) }, h('summary', {}, 'Alternatif makine ekle (isteğe bağlı)'), E('div', { class: 'row', style: 'gap:4px 16px;margin-top:6px' }, ...alt.map((x) => h('label', { class: 'chk' }, x.box, x.m.code))), E('div', { class: 'mut' }, 'Alternatif makine START izni vermez: yeterlilik, clearance, NC/CAM ve aparat kapıları o makine için ayrıca doğrulanır.'))),
        section('B', 'B — Üretim', true, E('div', { class: 'fgrid' }, field('Hazırlık (dk)', setup), field('Çevrim (sn/adet)', cycle), field('Muayene (sn/adet)', insp), field('Yeterlilik', skill), field('Seviye (1-10)', level)), undefinedSkillNote,
            E('div', { class: 'row', style: 'gap:4px 20px' }, h('label', { class: 'chk' }, fp, 'İlk parça kontrolü şart'), h('label', { class: 'chk' }, qc, 'Kalite kontrolü şart')), field('Operatör talimatı', ins),
            E('div', { class: 'row', style: 'align-items:flex-end' }, field('Ön koşul operasyon', depSel), addBtn('Listeye ekle', 'pw-dep-add', addDep)), existingDep),
        section('C', 'C — Teknik kaynaklar (NC · CAM · takım listesi · fikstür)', true, chainHost, candHost,
            E('div', { class: 'row', style: 'align-items:flex-end;gap:8px;flex-wrap:wrap' }, field('Fikstür / takım / mastar / robot', resKind), field('Kod / robot', E('span', {}, resCode, resRobot)), addBtn('Listeye ekle', 'pw-res-add', addRes)), existingRes,
            E('div', { class: 'mut' }, 'CAD ve teknik resim ürün düzeyinde ortak kütüphanededir (Dosyalar bölümü); burada tekrar yüklenmez.')),
        section('D', 'D — Kalite', true, E('div', { class: 'fgrid' }, field('No', qcNo), field('Kontrol', qcLabel), field('Tür', qcKind), field('Kontrol planı', qcPlan)), addBtn('Listeye ekle', 'pw-qc-add', addQc), exQc,
            E('div', { class: 'mut' }, 'Kalite planı onayı ayrı kalite kapısıdır; bu kart planı onaylamaz.')),
        pendHost, statusHost, E('div', { class: 'row owc-bar' }, saveBtn));
}
