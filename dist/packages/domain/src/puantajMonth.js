// KMI NEXT — Puantaj aylık hesap katmanı (Recovery step 4). V47 FORMÜLÜNE DOKUNMAZ: tek hesap `calculatePuantajScore` (puantaj.ts, V47 portu).
// Bu dosya yalnız (1) kanonik olgulardan V47 girdilerini TÜRETİR (kural açık ve görünür, D-001'e tabidir), (2) eksik girdi varsa kişiyi
// "INCOMPLETE" bırakır (hiçbir zaman varsayımla puan/prim üretmez), (3) havuzu yalnız tüm katılımcılar hesaplanabilirse dağıtır.
import { calculatePuantajScore, DEFAULT_PUANTAJ_CONFIG } from './puantaj.js';
/** Çok makine katsayısı (1.00/1.10/1.20) V47'de YOKTUR (eski doküman §5: "hiçbir yeni çarpan uygulanmadı"); bu yüzden hesaba KATILMAZ. */
export const MULTI_MACHINE_NOT_APPLIED_TR = 'Çok makine katsayısı V47 formülünde tanımlı değil — uygulanmadı (D-001, owner kararı bekliyor).';
export const DERIVATION_RULE_TR = 'Türetme kuralı v1 (D-001): sağlam oran = iyi/(iyi+hurda); hurda oranı = hurda/(iyi+hurda); süre = operasyon başlangıç–bitiş dakikası; ' +
    'hedef oranı = iyi adet / planlanan adet; iş uygun = kayıt var, kalite RED yok, hedef oranı ≥ 1. Devamsızlık ve makine teslim temizliği elle girilir (kaynak yok).';
export function derivePersonInputs(f) {
    const m = f.manual;
    const missing = [];
    const notes = [];
    if (m?.absenceDays == null)
        missing.push('Devamsızlık günü girilmedi');
    if (m?.careFactor == null)
        missing.push('Makine teslim temizlik katsayısı girilmedi');
    if (missing.length > 0)
        return { inputs: null, missing, notes };
    const p = f.production;
    const total = p.good + p.scrap;
    const targetRate = p.plannedQty > 0 ? p.good / p.plannedQty : 0;
    if (p.operations === 0)
        notes.push('Bu ay tamamlanmış üretim kaydı yok (üretim bileşenleri 0).');
    if (f.department === 'BAKIM' && m?.maintenanceClosed24h == null)
        notes.push('Bakım 24 saat çarpanı girilmedi (1.00 sayıldı).');
    return {
        missing,
        notes,
        inputs: {
            personName: f.name,
            careFactor: m.careFactor,
            goodProductRate: total > 0 ? p.good / total : 0,
            scrapRate: total > 0 ? p.scrap / total : 0,
            absenceDays: m.absenceDays,
            productionMinutes: p.minutes,
            productionTargetRate: targetRate,
            isJobEligible: p.operations > 0 && p.qcFail === 0 && targetRate >= 1,
            personalMultiplier: f.personalMultiplier,
            skillCount: f.skillCount,
            isMaintenanceDept: f.department === 'BAKIM',
            maintenanceClosedWithin24h: f.department === 'BAKIM' ? (m?.maintenanceClosed24h ?? false) : null,
            isWinningShift: m?.isWinningShift ?? false,
            isEarlyDelivery30Percent: m?.earlyDelivery30 ?? false,
            managementAdjustmentPercent: m?.managementAdjustmentPercent ?? 0,
            isExcludedThisMonth: m?.isExcluded ?? false,
            rank: m?.rankKind ?? 'NONE',
        },
    };
}
export function computeMonth(people, config = DEFAULT_PUANTAJ_CONFIG) {
    return people.map((f) => {
        const base = { personnelId: f.personnelId, name: f.name, employeeNo: f.employeeNo, department: f.department, multiMachineLevel: f.multiMachineLevel };
        if (f.manual?.isExcluded)
            return { ...base, status: 'EXCLUDED', missing: [], notes: ['Bu ay için hariç tutuldu (gerekçeli kayıt).'], inputs: null, result: { baseScore: 0, finalPoints: 0, excluded: true, exclusionReason: 'MONTHLY_EXCLUSION' } };
        const d = derivePersonInputs(f);
        if (!d.inputs)
            return { ...base, status: 'INCOMPLETE', missing: d.missing, notes: d.notes, inputs: null, result: null };
        const result = calculatePuantajScore(d.inputs, config);
        return { ...base, status: result.excluded ? 'EXCLUDED' : 'COMPUTED', missing: [], notes: d.notes, inputs: d.inputs, result };
    });
}
/** Havuz yalnız TÜM katılımcılar hesaplanabilirse ve tutar girilmişse dağıtılır; kuruş farkı en yüksek puanlıya eklenir. */
export function distributePool(pool, people) {
    if (pool == null)
        return { ok: false, reason: 'POOL_NOT_SET', detail: 'Havuz tutarı girilmedi.' };
    const inc = people.filter((p) => p.status === 'INCOMPLETE').length;
    if (inc > 0)
        return { ok: false, reason: 'INCOMPLETE_DATA', detail: `${inc} kişide eksik veri var — dağıtım yapılmaz.` };
    const part = people.filter((p) => p.status === 'COMPUTED' && (p.result?.finalPoints ?? 0) > 0);
    const total = part.reduce((s, p) => s + (p.result?.finalPoints ?? 0), 0);
    if (part.length === 0 || total <= 0)
        return { ok: false, reason: 'NO_POINTS', detail: 'Puan alan katılımcı yok.' };
    const cents = Math.round(pool * 100);
    const raw = part.map((p) => ({ personnelId: p.personnelId, points: p.result.finalPoints, c: Math.floor((cents * p.result.finalPoints) / total) }));
    let rem = cents - raw.reduce((s, r) => s + r.c, 0);
    raw.sort((a, b) => b.points - a.points);
    for (let i = 0; rem > 0; i = (i + 1) % raw.length, rem -= 1)
        raw[i].c += 1;
    return { ok: true, rows: raw.map((r) => ({ personnelId: r.personnelId, points: r.points, bonus: r.c / 100 })) };
}
