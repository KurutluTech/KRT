// KMI-010.08 — Doküman revizyon geçmişi ve denetim izi: saf (DOM'suz) okuma kuralları.
// Sürümler değiştirilemez ve silinmez (sunucu kuralı). Bu modül yalnız ekrandaki lifecycle yanıtının bunu gerçekten
// gösterip göstermediğini denetler: v1…vN kesintisiz mi, her sürümün mührü (SHA-256) ve yükleme izi var mı.
// Hiçbir şeyi düzeltmez / üretmez; eksikse ekranda GÖRÜNÜR uyarı verir.
/** versions: lifecycle.versions; events: lifecycle.events. */
export function versionRetention(versions, events = []) {
    const vs = Array.isArray(versions) ? versions : [];
    const nos = vs.map((v) => Number(v.versionNo)).filter((n) => Number.isInteger(n) && n > 0);
    const latest = nos.length ? Math.max(...nos) : 0;
    const have = new Set(nos);
    const missing = [];
    for (let n = 1; n <= latest; n++)
        if (!have.has(n))
            missing.push(n);
    const duplicate = nos.filter((n, i) => nos.indexOf(n) !== i);
    const unsealed = vs.filter((v) => !/^[0-9a-f]{64}$/i.test(String(v.sha256 ?? ''))).map((v) => v.versionNo);
    const traced = new Set((events ?? []).filter((e) => e.versionNo != null && /^(UPLOADED|LEGACY_UNREVIEWED)$/.test(e.event)).map((e) => Number(e.versionNo)));
    const untraced = nos.filter((n) => !traced.has(n));
    const ok = latest > 0 && !missing.length && !duplicate.length && !unsealed.length;
    let text;
    if (!latest)
        text = 'Sürüm kaydı yok.';
    else if (ok)
        text = `Tüm sürümler korunuyor: v1…v${latest} (${latest} sürüm, her biri SHA-256 ile mühürlü; eski sürümler silinmez, yalnız GEÇERSİZ olur).`;
    else
        text = `SÜRÜM GEÇMİŞİ EKSİK: ${[missing.length ? `kayıp sürüm ${missing.map((n) => `v${n}`).join(', ')}` : null, duplicate.length ? `çift sürüm no ${[...new Set(duplicate)].map((n) => `v${n}`).join(', ')}` : null, unsealed.length ? `mühürsüz ${unsealed.map((n) => `v${n}`).join(', ')}` : null].filter(Boolean).join(' · ')} — kalite/doküman sorumlusuna bildirin.`;
    // 010.08: yükleme izi olmayan sürüm ayrı uyarıdır (denetim izi kapsaması). Sürüm koruması (ok) değişmez; ekranda görünür olur.
    const auditGap = latest > 0 && untraced.length > 0;
    if (auditGap)
        text += ` DENETİM İZİ EKSİK: ${untraced.map((n) => `v${n}`).join(', ')} için yükleme kaydı (kim/ne zaman) görünmüyor — doküman sorumlusuna bildirin.`;
    return { ok, auditGap, latest, count: nos.length, missing, duplicate: [...new Set(duplicate)], unsealed, untraced, text };
}
