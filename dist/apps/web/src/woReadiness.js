const tail = (code) => code.includes(':') ? code.slice(code.indexOf(':') + 1) : '';
const RULES = [
    [/^MACHINE_NOT_ASSIGNED/, () => ({ title: 'Makine atanmadı', detail: 'Üretim için bir makine seçilmeli.', fix: { type: 'focus', id: 'machine' }, fixLabel: 'Makine ata' })],
    [/^OPERATOR_NOT_ASSIGNED/, () => ({ title: 'Operatör atanmadı', detail: 'Üretimi yapacak operatör planlanmalı.', fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatör ata' })],
    [/^SHIFT_NOT_PLANNED/, () => ({ title: 'Vardiya planlanmadı', detail: 'İşin hangi vardiyada yapılacağı belli değil.', fix: { type: 'link', href: '#/planlama' }, fixLabel: 'Planlamaya git' })],
    [/^DATE_NOT_PLANNED/, () => ({ title: 'Plan tarihi yok', detail: 'İş henüz bir güne planlanmadı.', fix: { type: 'link', href: '#/planlama' }, fixLabel: 'Planlamaya git' })],
    [/^MACHINE_SKILL_REQUIREMENTS_UNKNOWN/, () => ({ title: 'Makinenin beceri gereksinimi tanımlı değil', detail: 'Eğitim/Akademi tarafında bu makine için gereksinim girilmeli ya da "gerekmiyor" diye işaretlenmeli.', fix: { type: 'link', href: '#/akademi' }, fixLabel: 'Akademiye git' })],
    [/^MACHINE_NOT_PRODUCTION_ELIGIBLE/, () => ({ title: 'Makine atanmadı ya da üretime uygun değil', detail: 'Makine yok, bakımda/arızalı ya da üretim için onaylı değil.', fix: { type: 'focus', id: 'machine' }, fixLabel: 'Makine ata' })],
    [/^MACHINE_BUSY/, () => ({ title: 'Makinede çalışan başka bir iş emri var', detail: 'Önce o iş emri tamamlanmalı, durdurulmalı ya da başka makine seçilmeli.', fix: { type: 'focus', id: 'machine' }, fixLabel: 'Makineyi değiştir' })],
    [/^MATERIAL_REQUIREMENT_UNKNOWN:NO_REVISION/, (_c, id) => ({ title: 'Ürün revizyonu bağlı değil', detail: 'Malzeme ihtiyacı revizyonun malzeme listesinden (BOM) hesaplanır.', fix: { type: 'focus', id: 'revision' }, fixLabel: 'Revizyon bağla' })],
    [/^MATERIAL_REQUIREMENT_UNKNOWN/, (_c, id) => ({ title: 'Malzeme ihtiyacı bilinmiyor (BOM boş)', detail: 'Revizyonun malzeme listesi girilmemiş; malzeme hazır sayılamaz.', fix: { type: 'link', href: '#/muhendislik' }, fixLabel: 'Mühendislikte BOM gir' })],
    [/^MATERIAL_SHORTAGE/, (c, id) => ({ title: 'Malzeme eksik', detail: tail(c) ? `Eksik malzeme: ${tail(c)}` : null, fix: { type: 'link', href: `#/malzeme?is=${id}` }, fixLabel: 'Malzeme durumuna git' })],
    [/^TOOL_REQUIREMENT_UNKNOWN:NO_CAM_PROGRAM/, () => ({ title: 'Yayınlanmış CAM programı bağlı değil', detail: 'Takım ihtiyacı CAM programının takım listesinden gelir.', fix: { type: 'focus', id: 'cam' }, fixLabel: 'CAM programı bağla' })],
    [/^TOOL_REQUIREMENT_UNKNOWN/, () => ({ title: 'CAM programında takım listesi yok', detail: 'Takım hazır sayılamaz; programın takım listesi tamamlanmalı.', fix: { type: 'link', href: '#/muhendislik' }, fixLabel: 'Mühendislikte tamamla' })],
    [/^TOOL_NOT_READY/, (c, id) => ({ title: 'Takım hazır değil', detail: tail(c) ? `Hazır olmayan takım türü: ${tail(c)}` : null, fix: { type: 'link', href: `#/takim-hazirlik?is=${id}` }, fixLabel: 'Takım hazırlığına git' })],
    [/^OPERATOR_REQUIRED_FOR_QUALIFIED_MACHINE/, () => ({ title: 'Bu makine için adı belli, yetkin bir operatör gerekli', detail: null, fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatör ata' })],
    [/^OPERATOR_NOT_TRAINED/, () => ({ title: 'Operatörün bu makine için eğitimi yok (Eğitimi var = Hayır)', detail: 'Eğitim kaydı işlenmeden bu operatör bu makinede başlatılamaz.', fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatörü değiştir' })],
    [/^OPERATOR_BLOCKED:/, (c) => ({ title: 'Atanmış operatör başlatma kapısından geçemiyor', detail: tail(c) || null, fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatörü değiştir' })],
    [/^WO_OP_NOT_IN_ROUTE/, () => ({ title: 'İş emrindeki operasyon güncel rotada yok', detail: 'Rota değişti; rota iş emrine yeniden uygulanmalı.', fix: { type: 'focus', id: 'route' }, fixLabel: 'Rotayı kontrol et' })],
    [/^OPERATOR_NOT_QUALIFIED/, () => ({ title: 'Seçili operatörün bu makine için yetkinliği yok', detail: null, fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatörü değiştir' })],
    [/^OPERATOR_QUALIFICATION_EXPIRED/, () => ({ title: 'Operatörün yetkinlik süresi dolmuş', detail: null, fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatörü değiştir' })],
    [/MULTI_MACHINE|HARD_CAP/, () => ({ title: 'Operatörün çok-makine yetkisi yetersiz', detail: 'Operatör aynı anda bu kadar makinede çalışamaz.', fix: { type: 'focus', id: 'operator' }, fixLabel: 'Operatörü değiştir' })],
];
export function describeBlocker(code, woId) {
    const hit = RULES.find(([re]) => re.test(code));
    return hit ? { code, ...hit[1](code, woId) } : { code, title: 'Bilinmeyen engel', detail: 'Sunucu başlatmaya izin vermiyor; neden bu ekranda tanımlı değil.', fix: null, fixLabel: null };
}
/** All blockers, de-duplicated. `rows` = work_order_readiness(); `refusal` = work_order_start_preview() (first server refusal, may repeat a row). EXEMPT counts as satisfied (written, revocable exemption). */
export function collectBlockers(woId, rows, refusal) {
    const codes = [];
    if (refusal)
        codes.push(refusal);
    for (const r of rows ?? [])
        if ((r.state === 'NOT_READY' || r.state === 'UNKNOWN') && r.reason)
            codes.push(r.reason);
    const seen = new Set();
    const out = [];
    for (const c of codes) {
        const b = describeBlocker(c, woId);
        const key = b.title + '|' + (b.detail ?? '');
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(b);
    }
    return out;
}
export const readinessHeadline = (n) => n === null ? { text: 'HAZIRLIK DURUMU BİLİNMİYOR', tone: 'mut' } : n === 0 ? { text: 'ÜRETİME HAZIR', tone: 'ok' } : { text: `ÜRETİME HAZIR DEĞİL — ${n} EKSİK`, tone: 'bad' };

const KIND_TR = { SOFTWARE: 'yazılım eksik', DATA: 'veri girişi', PHYSICAL: 'fiziksel hazırlık' };
const FIX = { REVISION_NOT_LINKED: { type: 'focus', id: 'revision' }, MACHINE_NOT_PRODUCTION_ELIGIBLE: { type: 'focus', id: 'machine' }, OPERATOR_NOT_ASSIGNED: { type: 'focus', id: 'operator' }, CAM_NOT_LINKED: { type: 'focus', id: 'cam' }, DATE_NOT_PLANNED: { type: 'link', href: '#/planlama' }, SHIFT_NOT_PLANNED: { type: 'link', href: '#/planlama' } };
const FIXL = { REVISION_NOT_LINKED: 'Revizyonu bağla', MACHINE_NOT_PRODUCTION_ELIGIBLE: 'Makine ata', OPERATOR_NOT_ASSIGNED: 'Operatör ata', CAM_NOT_LINKED: 'Programı bağla', DATE_NOT_PLANNED: 'Planlamaya git', SHIFT_NOT_PLANNED: 'Planlamaya git' };
// Eksik → gerçek giriş ekranı (aynı bilgi tek yerde girilir): rota/CUT-PREP/kesim/operasyon → Rota hazırlık; operatör eşleşmesi → Personel–Makine eşleştirme
const ROUTE_CODES = /^(ROUTE_|ROUTING_|CUT_PREP|CUT_SPEC|OP_NOT_DEFINED|OP_SETUP|OP_MACHINE|OP_TOOL|OP_FIXTURE|OP_SAW|OP_CUT_PARAMS|CAM_NOT_LINKED|CONTROL_PLAN)/;
const PAIR_CODES = /^(OPERATOR_NOT_PAIRED|NO_ELIGIBLE_OPERATOR|OPERATOR_)/;
function entryLink(code, ctx) {
    if (code === 'OPERATOR_NOT_ASSIGNED') return null;
    if (PAIR_CODES.test(code)) return { href: '#/personel-makine', label: 'Eşleştirmeye git' };
    if (code === 'CAM_NOT_LINKED') return null;   // WO üzerindeki “Programı bağla” (odak) yeterli
    if (ROUTE_CODES.test(code) && ctx?.revisionId) return { href: `#/rota-hazirlik?rev=${ctx.revisionId}`, label: 'Rota hazırlığa git' };
    return null;
}
/** m0196: tek canonical START kontrol listesi (work_order_start_checklist) → panel satırları. Yalnız BLOCKED satırlar eksik sayılır. */
export function checklistBlockers(rows, ctx = {}) {
    return (rows ?? []).filter((r) => r.state === 'BLOCKED').map((r) => {
        const l = entryLink(r.code, ctx);
        const notPaired = r.code === 'OPERATOR_NOT_PAIRED' || /OPERATOR_NOT_PAIRED/.test(r.detail ?? '');
        const noEligible = r.code === 'NO_ELIGIBLE_OPERATOR' || /NO_ELIGIBLE_OPERATOR/.test(r.detail ?? '');
        // teknik kod yerine açıklama; operatör sabit değil: yönetici ya operatörü değiştirir ya eşleştirmeye gider
        const human = notPaired ? 'Bu iş emrinin atanmış operatörü, ilgili makineyle eşleştirilmemiş.' : noEligible ? 'Bu operasyonun makinesiyle eşleştirilmiş uygun personel yok.' : null;
        return { code: r.code + (r.opLabel ? `@${r.opLabel}` : ''), title: `${r.area}${r.opLabel ? ` · ${r.opLabel}` : ''}`, detail: human ?? r.detail ?? null,
            fix2: (notPaired || noEligible) ? { type: 'focus', id: 'operator', label: 'Operatörü Değiştir' } : (r.code === 'RESPONSIBLE_NOT_ASSIGNED' ? { type: 'focus', id: 'responsible', label: 'Sorumlu ata' } : null),
            fix: r.code === 'WO_OP_ROUTE_OUT_OF_SYNC' ? { type: 'resync' } : (FIX[r.code] ?? (l ? { type: 'link', href: l.href } : null)), fixLabel: (notPaired || noEligible) ? 'Personel–Makine Eşleştirmesine Git' : (r.code === 'WO_OP_ROUTE_OUT_OF_SYNC' ? 'Rotayı iş emriyle eşitle' : (FIXL[r.code] ?? l?.label ?? null)), screen: r.resolveScreen, who: r.who, kind: KIND_TR[r.gapKind] ?? r.gapKind, pass: r.passCheck };
    });
}
