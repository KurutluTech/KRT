// KMI NEXT — Frozen Master Item 30: Puantaj / Prim (timekeeping + fairness bonus) engine.
//
// Owner's explicit, binding constraint (REQUIREMENTS_MATRIX.md Item 30): "V47 one live engine
// korunur, formula kanıtsız değiştirilmez" — the OLD system's V47 "canonical puantaj/prim
// engine" formula must be carried into KMI NEXT UNCHANGED, never altered without owner proof.
// This module is therefore a FAITHFUL PORT of V47 as it was discovered and documented
// (read-only discovery, never executed against production) in the old KMI repo at
// /home/claude/kmi/docs/KMI_PUANTAJ_CALCULATION_TRUTH.md — not a redesign, not a fix of the
// known gaps that document itself flags.
//
// V47 formula (old doc §2), reproduced exactly:
//   Pson = Ptemel × Kdevam × Kişemri × Ktemizlik × Kkişisel × Kvardiya × Kkabiliyet × Kbakım
//          × Kyönetici × Ksıralama
//   Ptemel = [Kmakine×machine + SağlamÜrün×goodProduct + AzHurda×lowScrap + Devam×attendance
//             + Süre×productionTime] / Σweight × 100   (weights sum to 100 by default, so this
//             reduces to the weighted sum itself — ported exactly as documented, not simplified)
//
// Default weights/multipliers below are copied VERBATIM from the old doc's evidence table
// (§2) and from `defaultPuantajConfig()` as the doc quotes it in §3 — never invented here.
//
// DELIBERATELY NOT YET PORTED (open questions for the owner, not silent fixes — see
// docs/REQUIREMENTS_MATRIX.md Item 30 and the old doc's own §17/§18 P0/P1 list):
//   - P0-1 (KMI-PUANTAJ-RUNTIME-LINK): old system's manual declaration form + machine-transfer
//     flow could record produced qty with zero link to real machine/session state. KMI NEXT's
//     own Golden Thread (packages/domain/src/productionDeclaration.ts) already requires a real
//     work order in IN_PROGRESS/FIRST_PIECE_PENDING status to declare production, which is a
//     stronger guarantee than the old system had — but whether puantaj's `goodProduct`/
//     `lowScrap`/`productionTime` inputs should be wired to KMI NEXT's
//     production_declarations (recommended) or kept identical to the old free-form inputs is
//     an explicit decision for the owner, not assumed here.
//   - P0-2 (KMI-PUANTAJ-PERIOD-LOCK): the old system never snapshotted which config/weights/
//     declaration ids were used when a month was locked — only the final TL amount was frozen.
//     This module's `PuantajPeriodLock` type below includes a snapshot field precisely so KMI
//     NEXT *can* close this gap, but closing it is a formula/behavior change, not a pure port,
//     so it is modeled but not wired into any RPC yet pending owner sign-off.
//   - P1-1..P1-6: customBoxes-not-wired, CNC-only role coverage, name-based operator linking,
//     leaderboard population mismatch, UI-only visibility, hardcoded owner-name exclusion — all
//     carried forward AS-IS (see isBonusPoolOnlyPerson below, which deliberately keeps the old
//     system's hardcoded substring match rather than inventing a role flag).
export const DEFAULT_PUANTAJ_CONFIG = {
    machineWeight: 20,
    goodProductWeight: 30,
    lowScrapWeight: 15,
    attendanceWeight: 20,
    productionTimeWeight: 15,
    attendanceMultiplier: 1.2,
    production10Multiplier: 1.05,
    production20Multiplier: 1.1,
    production25Multiplier: 1.15,
    cleanHandoverMultiplier: 1.05,
    veryCleanHandoverMultiplier: 1.2,
    earlyDeliveryMultiplier: 1.25,
    winningShiftMultiplier: 1.2,
    skill8Multiplier: 1.1,
    skill10Multiplier: 1.2,
    maintenance24hMultiplier: 1.1,
    absenceDisqualifyDays: 5,
    managementAdjustmentCapPercent: 50,
    rankFirstTimeMultiplier: 1.25,
    rankTop3StreakMultiplier: 1.2,
};
/** The owner-name hardcoded exclusion, ported AS-IS from `isBonusPoolOnlyPerson()` (P1-6: known
 * structural gap — a role/flag would be better, but changing this IS a formula change, so it
 * is carried forward unchanged, not fixed here). */
const BONUS_POOL_EXCLUDED_NAME_SUBSTRINGS = ['ENDER KURUTLU', 'HAKAN KURUTLU'];
export function isBonusPoolOnlyPerson(personName) {
    const upper = personName.toLocaleUpperCase('tr-TR');
    return BONUS_POOL_EXCLUDED_NAME_SUBSTRINGS.some((name) => upper.includes(name));
}
function clampPercent(pct, cap) {
    return Math.max(-cap, Math.min(cap, pct));
}
/**
 * Faithful port of V47's `getPuantajMetrics`/`metrics()`. Pure function — no localStorage, no
 * Date.now(), no DOM — the old system's own determinism proof (old doc §10) showed the real
 * engine has none of those either; this keeps that property intentionally.
 */
export function calculatePuantajScore(input, config = DEFAULT_PUANTAJ_CONFIG) {
    if (isBonusPoolOnlyPerson(input.personName)) {
        return { baseScore: 0, finalPoints: 0, excluded: true, exclusionReason: 'BONUS_POOL_ONLY_PERSON' };
    }
    if (input.isExcludedThisMonth) {
        return { baseScore: 0, finalPoints: 0, excluded: true, exclusionReason: 'MONTHLY_EXCLUSION' };
    }
    if (input.absenceDays >= config.absenceDisqualifyDays) {
        return { baseScore: 0, finalPoints: 0, excluded: true, exclusionReason: 'ABSENCE_DISQUALIFIED' };
    }
    const totalWeight = config.machineWeight + config.goodProductWeight + config.lowScrapWeight + config.attendanceWeight + config.productionTimeWeight;
    const goodProduct = input.isJobEligible ? input.goodProductRate : 0;
    const lowScrap = input.isJobEligible ? 1 - input.scrapRate : 0;
    const attendanceScore = Math.max(0, 1 - input.absenceDays / 26);
    const productionTimeScore = Math.max(0, input.productionMinutes / (26 * 480));
    const baseScore = ((config.machineWeight * input.careFactor +
        config.goodProductWeight * goodProduct +
        config.lowScrapWeight * lowScrap +
        config.attendanceWeight * attendanceScore +
        config.productionTimeWeight * productionTimeScore) /
        totalWeight) *
        100;
    const kDevam = input.absenceDays === 0 ? config.attendanceMultiplier : 1;
    let kIsEmri = 1;
    if (input.isJobEligible) {
        if (input.productionTargetRate >= 1.25)
            kIsEmri = config.production25Multiplier;
        else if (input.productionTargetRate >= 1.2)
            kIsEmri = config.production20Multiplier;
        else if (input.productionTargetRate >= 1.1)
            kIsEmri = config.production10Multiplier;
    }
    let kTemizlik = 1;
    if (input.careFactor === 1.2)
        kTemizlik = config.veryCleanHandoverMultiplier;
    else if (input.careFactor === 1.05)
        kTemizlik = config.cleanHandoverMultiplier;
    const kKisisel = input.personalMultiplier;
    const kVardiya = input.isWinningShift ? config.winningShiftMultiplier : 1;
    let kKabiliyet = 1;
    if (input.skillCount >= 10)
        kKabiliyet = config.skill10Multiplier;
    else if (input.skillCount >= 8)
        kKabiliyet = config.skill8Multiplier;
    const kBakim = input.isMaintenanceDept && input.maintenanceClosedWithin24h ? config.maintenance24hMultiplier : 1;
    const kYonetici = 1 + clampPercent(input.managementAdjustmentPercent, config.managementAdjustmentCapPercent) / 100;
    let kSiralama = 1;
    if (input.rank === 'FIRST_TIME_NO1')
        kSiralama = config.rankFirstTimeMultiplier;
    else if (input.rank === 'TOP3_STREAK')
        kSiralama = config.rankTop3StreakMultiplier;
    // Early-delivery multiplier is job-order-scoped in the old system (applied once per
    // qualifying job, not a flat personal multiplier) — ported here as a simple personal
    // multiplier for the single-job case this port's inputs model; a full multi-job rollup is
    // an explicit open question (see module header) once wired to real work orders.
    const kErkenTeslim = input.isEarlyDelivery30Percent ? config.earlyDeliveryMultiplier : 1;
    const finalPoints = baseScore * kDevam * kIsEmri * kTemizlik * kKisisel * kVardiya * kKabiliyet * kBakim * kYonetici * kSiralama * kErkenTeslim;
    return { baseScore, finalPoints, excluded: false, exclusionReason: null };
}
