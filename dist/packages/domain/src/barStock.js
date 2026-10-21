const r = (v, d) => { const f = 10 ** d; return Math.round(v * f) / f; };
export const DEFAULT_KERF_MM = 0.9;
export const DEFAULT_STEEL_DENSITY = 7.85;
export function barPlanPreview(x) {
    const vals = [x.barMm, x.cutMm, x.diaMm, x.densityGCm3];
    if (vals.some((v) => !Number.isFinite(v) || v <= 0) || !Number.isFinite(x.kerfMm) || x.kerfMm < 0 || !Number.isFinite(x.qty))
        return null;
    const pitch = x.cutMm + x.kerfMm;
    // floating point guard: 6000 / 160.9 is not an integer, but e.g. 960 / 160.0 must not become 5.999999
    const per = Math.floor(x.barMm / pitch + 1e-9);
    const area = Math.PI * (x.diaMm / 2) ** 2;
    const pieceG = (area * x.cutMm / 1000) * x.densityGCm3;
    const barKg = (area * x.barMm / 1000) * x.densityGCm3 / 1000;
    const bars = per >= 1 && x.qty > 0 ? Math.ceil(x.qty / per) : null;
    return {
        piecesPerBar: per, barsNeeded: bars, sparePieces: bars === null ? null : bars * per - Math.ceil(x.qty),
        remainderMmPerBar: r(x.barMm - per * pitch, 3), pieceMassG: r(pieceG, 1), barMassKg: r(barKg, 3), blankTotalKg: bars === null ? null : r(bars * barKg, 3),
        usedMm: bars === null ? null : r(Math.ceil(x.qty) * pitch, 3), leftoverMmTotal: bars === null ? null : r(bars * x.barMm - Math.ceil(x.qty) * pitch, 3),
    };
}
