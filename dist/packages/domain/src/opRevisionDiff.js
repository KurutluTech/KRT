// Operasyon teknik pasaportu — REVİZYON FARKLARI (saf fonksiyonlar, kayıt yazmaz).
// Kural: veri eksikse uydurma yok → KARŞILAŞTIRILAMIYOR. Fark yoksa → DEĞİŞMEDİ.
export const ST = Object.freeze({ SAME: 'DEĞİŞMEDİ', CHANGED: 'DEĞİŞTİ', NA: 'KARŞILAŞTIRILAMIYOR' });
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = (x) => Math.round(x * 100) / 100;

/** Dosya alanının durumu — "yok / henüz yüklenmedi / artık geçerli değil / bu makine için gerekmiyor" ayrı durumlardır. */
export function fileSlotState({ required, versions = [], effectiveVersionNo = null, expired = false }) {
    if (required === false) return { code: 'GEREKMIYOR', label: 'Bu makine için gerekmiyor', tone: 'info' };
    if (!versions.length) return { code: 'YUKLENMEDI', label: 'Henüz yüklenmedi', tone: 'warn' };
    const latest = Math.max(...versions.map((v) => v.versionNo));
    if (expired) return { code: 'GECERSIZ', label: 'Artık geçerli değil (süresi doldu / geçersiz)', tone: 'bad' };
    if (effectiveVersionNo == null) return { code: 'TASLAK', label: `v${latest} yüklendi — henüz yürürlükte değil (onay bekliyor)`, tone: 'warn' };
    if (effectiveVersionNo < latest) return { code: 'YENI_TASLAK', label: `Yürürlükte v${effectiveVersionNo}; v${latest} taslak (onay bekliyor)`, tone: 'warn' };
    return { code: 'YURURLUKTE', label: `v${latest} yürürlükte`, tone: 'ok' };
}

/** İki dosya sürümü (meta). sha256 farklıysa içerik farklıdır; ad aynı olsa bile. */
export function diffVersions(a, b) {
    if (!a || !b) return { state: ST.NA, why: 'Karşılaştırılacak iki sürüm yok' };
    const same = a.sha256 && b.sha256 ? a.sha256 === b.sha256 : null;
    if (same === null) return { state: ST.NA, why: 'İçerik özeti (SHA-256) eksik' };
    return { state: same ? ST.SAME : ST.CHANGED, a: { versionNo: a.versionNo, fileName: a.fileName, sha256: a.sha256, size: a.size ?? null }, b: { versionNo: b.versionNo, fileName: b.fileName, sha256: b.sha256, size: b.size ?? null },
        nameChanged: (a.fileName ?? null) !== (b.fileName ?? null), sizeDelta: a.size != null && b.size != null ? b.size - a.size : null };
}

/** Metin dosyası (NC/CSV): gerçek satır farkı SAYILARI + ilk değişen satırlar. İkili/çözülemeyen içerikte sahte fark üretilmez. */
export function diffText(aText, bText, { max = 40 } = {}) {
    if (typeof aText !== 'string' || typeof bText !== 'string') return { state: ST.NA, why: 'İçerik metin olarak okunamadı' };
    if (/\u0000/.test(aText) || /\u0000/.test(bText)) return { state: ST.NA, why: 'İkili içerik — satır karşılaştırması yapılmaz; yalnız özet/sürüm farkı gösterilir' };
    const A = aText.replace(/\r\n/g, '\n').split('\n'), B = bText.replace(/\r\n/g, '\n').split('\n');
    if (A.length * B.length > 4e6) return { state: A.join('\n') === B.join('\n') ? ST.SAME : ST.CHANGED, lines: { a: A.length, b: B.length }, note: 'Dosya büyük: satır satır fark hesaplanmadı' };
    // LCS tabanlı gerçek fark
    const n = A.length, m = B.length; const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0, add = 0, del = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) { del += 1; if (out.length < max) out.push({ op: '-', line: A[i], no: i + 1 }); i += 1; } else { add += 1; if (out.length < max) out.push({ op: '+', line: B[j], no: j + 1 }); j += 1; } }
    while (i < n) { del += 1; if (out.length < max) out.push({ op: '-', line: A[i], no: i + 1 }); i += 1; }
    while (j < m) { add += 1; if (out.length < max) out.push({ op: '+', line: B[j], no: j + 1 }); j += 1; }
    return { state: add + del === 0 ? ST.SAME : ST.CHANGED, added: add, removed: del, lines: { a: n, b: m }, sample: out, truncated: add + del > out.length };
}

/** Süre farkları: önceki/yeni standart çevrim + setup + toplam üretim süresine etkisi (adet verilmişse). */
export function diffTimes(prev, next, { qty = null } = {}) {
    const pc = num(prev?.cycleSeconds), nc = num(next?.cycleSeconds), ps = num(prev?.setupMinutes), ns = num(next?.setupMinutes);
    const cycle = pc == null || nc == null ? { state: ST.NA, prev: pc, next: nc } : { state: pc === nc ? ST.SAME : ST.CHANGED, prev: pc, next: nc, deltaSec: r2(nc - pc), pct: pc === 0 ? null : r2(((nc - pc) / pc) * 100) };
    const setup = ps == null || ns == null ? { state: ST.NA, prev: ps, next: ns } : { state: ps === ns ? ST.SAME : ST.CHANGED, prev: ps, next: ns, deltaMin: r2(ns - ps), pct: ps === 0 ? null : r2(((ns - ps) / ps) * 100) };
    const q = num(qty);
    let total;
    if (cycle.state === ST.NA || setup.state === ST.NA || q == null) total = { state: ST.NA, why: q == null ? 'İş emri adedi verilmedi' : 'Süre verisi eksik' };
    else { const prevSec = pc * q + ps * 60, nextSec = nc * q + ns * 60; total = { state: prevSec === nextSec ? ST.SAME : ST.CHANGED, qty: q, prevSec: r2(prevSec), nextSec: r2(nextSec), deltaSec: r2(nextSec - prevSec), deltaHours: r2((nextSec - prevSec) / 3600) }; }
    return { cycle, setup, total, capacity: { state: ST.NA, why: 'Kapasite/termin etkisi bu ekrandan KANITLANAMAZ; planlama ekranında ayrıca hesaplanır' } };
}

/** Takım listesi farkı (T numarasına göre). Satırlar rowsFromCsv çıktısıdır: {t, desc, dia, len, holder, offset, type, code}. */
export function diffTools(prevRows, nextRows) {
    if (!Array.isArray(prevRows) || !Array.isArray(nextRows)) return { state: ST.NA, why: 'Takım listesi içeriği okunamadı' };
    const key = (r) => [r.desc, r.dia, r.len, r.holder, r.offset, r.type, r.code].map((x) => String(x ?? '').trim()).join('|');
    const pm = new Map(prevRows.map((r) => [String(r.t), r])), nm = new Map(nextRows.map((r) => [String(r.t), r]));
    const added = [...nm.keys()].filter((t) => !pm.has(t)).map((t) => nm.get(t));
    const removed = [...pm.keys()].filter((t) => !nm.has(t)).map((t) => pm.get(t));
    const FIELDS = [['desc', 'açıklama'], ['dia', 'çap'], ['len', 'boy'], ['holder', 'tutucu/montaj'], ['offset', 'offset'], ['type', 'tip'], ['code', 'kod']];
    const changed = [...nm.keys()].filter((t) => pm.has(t) && key(pm.get(t)) !== key(nm.get(t))).map((t) => ({ t, before: pm.get(t), after: nm.get(t), fields: FIELDS.filter(([f]) => String(pm.get(t)[f] ?? '').trim() !== String(nm.get(t)[f] ?? '').trim()).map(([, l]) => l) }));
    const state = added.length + removed.length + changed.length === 0 ? ST.SAME : ST.CHANGED;
    return { state, prevCount: prevRows.length, nextCount: nextRows.length, countDelta: nextRows.length - prevRows.length, added, removed, changed,
        prepImpact: state === ST.SAME ? 'Takım hazırlığı etkilenmez' : `Takım hazırlığı yeniden doğrulanmalı (${added.length} eklenen, ${removed.length} çıkarılan, ${changed.length} değişen)` };
}

/** Düz alan farkı (talimat, bağlama/fikstür metni, kontrol planı noktaları vb.). */
export function diffField(prev, next) {
    if (prev === undefined || next === undefined) return { state: ST.NA };
    const a = JSON.stringify(prev ?? null), b = JSON.stringify(next ?? null);
    return { state: a === b ? ST.SAME : ST.CHANGED, prev: prev ?? null, next: next ?? null };
}

/** İki operasyon revizyonu (routing_op_history satırları) arasında tam fark. rows: yeni → eski sıralı. */
export function diffOpVersions(rows, { qty = null, pick = null } = {}) {
    const vs = [...(rows ?? [])].sort((x, y) => y.versionNo - x.versionNo);
    const valid = vs.filter((v) => v.kind !== 'REORDERED' && v.kind !== 'DEPENDENCY');
    const next = pick ? vs.find((v) => v.versionNo === pick.next) : valid[0];
    const prev = pick ? vs.find((v) => v.versionNo === pick.prev) : valid[1];
    if (!next || !prev) return { state: ST.NA, why: 'Karşılaştırılacak iki geçerli revizyon yok', next: next?.versionNo ?? null, prev: prev?.versionNo ?? null };
    return { state: ST.CHANGED, prevNo: prev.versionNo, nextNo: next.versionNo, prevAt: prev.at ?? null, nextAt: next.at ?? null, by: next.by ?? null, reason: next.reason ?? null, kind: next.kind ?? null,
        times: diffTimes(prev, next, { qty }), machines: diffField(prev.machines, next.machines), qcPlan: diffField(prev.qcPoints, next.qcPoints), resources: diffField(prev.resources, next.resources), instructions: diffField(prev.instructions, next.instructions), name: diffField(prev.name, next.name) };
}
