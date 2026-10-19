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
