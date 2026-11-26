// KMI MASTER 002.02/002.06/002.11 — Akıllı uyarılar: gerçek kaynaklı (task_floor MINE derived + bekleyen onay sayısı) uyarı özeti.
// Saf fonksiyon; ağ yok. Her uyarı doğrudan ilgili işe/ekrana gider (uyarıdan işe geçiş). Kaynak yoksa uyarı üretmez.
const CATS = [
    { key: 'HOLD', label: 'Kalite HOLD', tone: 'bad', blocks: true, test: (d) => d.sourceType === 'QUALITY_HOLD' },
    { key: 'NCR', label: 'Uygunsuzluk (NCR)', tone: 'bad', blocks: true, test: (d) => d.sourceType === 'QUALITY_NCR' },
    { key: 'FP', label: 'İlk parça onayı bekliyor', tone: 'warn', blocks: true, test: (d) => /İlk parça onayı/.test(d.title ?? '') },
    { key: 'WOHOLD', label: 'İş emri bekletmede', tone: 'warn', blocks: true, test: (d) => d.sourceType === 'WORK_ORDER' && /bekletmede/i.test(d.title ?? '') },
    { key: 'LATE', label: 'Planlı tarihi geçmiş iş emri', tone: 'bad', blocks: false, test: (d) => d.sourceType === 'WORK_ORDER' && /tarihi geçmiş/i.test(d.title ?? '') },
    { key: 'CAM', label: 'CAM programı atanmamış iş emri', tone: 'warn', blocks: true, test: (d) => d.sourceType === 'WORK_ORDER' && /CAM programı atanmamış/.test(d.title ?? '') },
    { key: 'MAINT', label: 'Açık bakım işi', tone: 'warn', blocks: false, test: (d) => d.sourceType === 'MAINTENANCE_TICKET' },
    { key: 'PR', label: 'Bekleyen satınalma talebi', tone: 'info', blocks: false, test: (d) => d.sourceType === 'PURCHASE_REQUEST' },
    { key: 'SHIP', label: 'Hazırlanacak sevkiyat', tone: 'info', blocks: false, test: (d) => d.sourceType === 'SHIPMENT' },
];
const g = (o, a, b) => (o?.[a] !== undefined ? o[a] : o?.[b]);
export function buildAlerts(tasks, opts = {}) {
    if (tasks === null || tasks === undefined) return [];
    const derived = (tasks.derived ?? []).map((d) => ({ sourceType: g(d, 'sourceType', 'source_type'), sourceId: g(d, 'sourceId', 'source_id'), title: d.title, route: d.route ?? null }));
    const out = [];
    for (const c of CATS) {
        const hits = derived.filter(c.test);
        if (hits.length) out.push({ key: c.key, label: c.label, tone: c.tone, blocks: c.blocks, count: hits.length, href: hits.length === 1 && hits[0].route ? `#${hits[0].route}` : (hits[0].route ? `#${hits[0].route.split('?')[0]}` : '#/gorevler'), sample: hits[0].title });
    }
    if (Number.isFinite(opts.approvalsPending) && opts.approvalsPending > 0) out.push({ key: 'APPR', label: 'Bekleyen onay', tone: 'warn', blocks: false, count: opts.approvalsPending, href: '#/onaylar', sample: '' });
    const lateManual = (tasks.manual ?? []).filter((t) => (g(t, 'isLate', 'is_late')) === true && ['OPEN', 'IN_PROGRESS'].includes(t.status));
    if (lateManual.length) out.push({ key: 'TLATE', label: 'Geciken görev', tone: 'bad', blocks: false, count: lateManual.length, href: '#/gorevler', sample: lateManual[0].title });
    const rank = { bad: 0, warn: 1, info: 2 };
    return out.sort((a, b) => (b.blocks - a.blocks) || (rank[a.tone] - rank[b.tone]) || (b.count - a.count));
}
/** Veri tazeliği: kaynak durumu + yüklenme zamanı → {label, stale}. Yüklenmemişse bilinmiyor (uydurma yok). */
export function freshness(loadedAt, sources, nowMs = Date.now()) {
    const bad = Object.values(sources ?? {}).filter((s) => s && ['FAILED', 'TIMEOUT'].includes(s.state)).length;
    if (!loadedAt) return { label: 'Veri zamanı bilinmiyor', stale: true };
    const min = Math.max(0, Math.floor((nowMs - loadedAt) / 60000));
    return { label: bad ? `${min} dk önce · ${bad} kaynak okunamadı` : min < 1 ? 'Az önce güncellendi' : `${min} dk önce güncellendi`, stale: bad > 0 || min >= 5 };
}
