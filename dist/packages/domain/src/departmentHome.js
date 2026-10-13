/** workspace id (nav.ts) → cockpit id. Workspaces without an entry have no record source yet (home still shows sub-pages and links). */
export const COCKPIT_OF_WORKSPACE = {
    prod: 'PRODUCTION', plan: 'PLANNING', cam: 'CAM', qc: 'QUALITY', tool: 'TOOLROOM', maint: 'MAINTENANCE', wh: 'WAREHOUSE', buy: 'PURCHASING', ship: 'SHIPPING', fin: 'ACCOUNTING', hr: 'PERSONNEL',
};
const TR = {
    DRAFT: 'Taslak', RELEASED: 'Yayında', PLANNED: 'Planlandı', ASSIGNED: 'Atandı', WAITING: 'Bekliyor', READY: 'Hazır', RUNNING: 'Çalışıyor', IN_PROGRESS: 'Devam ediyor', ON_HOLD: 'HOLD',
    FIRST_PIECE_PENDING: 'İlk parça bekliyor', FIRST_PIECE_APPROVED: 'İlk parça onaylı', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal', OPEN: 'Açık', CLOSED: 'Kapandı',
    AVAILABLE: 'Kullanılabilir', HOLD: 'HOLD', SCRAP: 'Hurda', STAGED: 'Sevke hazır', SHIPPED: 'Sevk edildi', SUBMITTED: 'Onay bekliyor', APPROVED: 'Onaylı', REJECTED: 'Reddedildi',
    CABINET: 'Dolapta', MOUNTED: 'Makinede', ISSUED: 'Kişide', TEST_PENDING: 'Test bekliyor', REPAIR: 'Onarımda', RETURNED_TO_SERVICE: 'Servise döndü', CRITICAL: 'Kritik', HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük',
    NOT_READY: 'Hazır değil', UNKNOWN: 'Bilinmiyor', PARTIAL: 'Kısmi', ORDERED: 'Sipariş verildi', RECEIVED: 'Teslim alındı', UNASSIGNED: 'Bölümü belirsiz',
};
/** Never show a raw status code: known codes get a Turkish word, anything else is humanised (UPPER_SNAKE → Title case). */
export function statusTr(code) {
    if (!code)
        return '—';
    if (TR[code])
        return TR[code];
    return code.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'));
}
const toneOf = (code) => (['ON_HOLD', 'HOLD', 'SCRAP', 'CRITICAL', 'REJECTED', 'NOT_READY'].includes(code) ? 'red' : ['FIRST_PIECE_PENDING', 'TEST_PENDING', 'SUBMITTED', 'DRAFT', 'WAITING', 'HIGH', 'PARTIAL'].includes(code) ? 'amber' : ['RUNNING', 'IN_PROGRESS', 'MOUNTED', 'ASSIGNED'].includes(code) ? 'blue' : ['COMPLETED', 'READY', 'AVAILABLE', 'RELEASED', 'APPROVED', 'CLOSED', 'RETURNED_TO_SERVICE'].includes(code) ? 'green' : 'gray');
const count = (xs, key) => {
    const m = new Map();
    for (const x of xs) {
        const k = key(x);
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: statusTr(k), value: v, tone: toneOf(k) }));
};
const OPEN = (s) => s !== 'COMPLETED' && s !== 'CANCELLED';
const wolink = (id) => `#/nesne?t=WORK_ORDER&id=${encodeURIComponent(id)}`;
const rec = (id, cells, href, tone) => ({ id, cells, href, tone, search: cells.join(' ').toLocaleLowerCase('tr-TR') });
export function dueBuckets(rows, todayIso) {
    const today = todayIso.slice(0, 10), plus7 = new Date(Date.parse(today) + 7 * 864e5).toISOString().slice(0, 10);
    const b = { late: 0, week: 0, later: 0, none: 0 };
    for (const r of rows) {
        if (!r.dueDate)
            b.none++;
        else if (r.dueDate < today)
            b.late++;
        else if (r.dueDate <= plus7)
            b.week++;
        else
            b.later++;
    }
    return [{ label: 'Termini geçmiş', value: b.late, tone: 'red' }, { label: 'Bu hafta teslim', value: b.week, tone: 'amber' }, { label: 'Sonraki haftalar', value: b.later, tone: 'green' }, { label: 'Termini yok', value: b.none, tone: 'gray' }];
}
const NONE = (wsId, cockpit, recordsTitle = 'Kayıtlar') => ({ wsId, cockpit, analyticsTitle: 'Analitik', bars: null, barsReason: 'Bu departman için kayıt kaynağı henüz bağlı değil', secondTitle: null, second: null, recordsTitle, columns: [], records: null, recordsReason: 'Kayıt kaynağı bağlı değil — alt sayfalardan çalışın', exceptions: [] });
export function buildDepartmentHome(wsId, i) {
    const cockpit = COCKPIT_OF_WORKSPACE[wsId] ?? null;
    const today = i.nowIso.slice(0, 10);
    const wo = i.workOrders ?? null;
    const base = (over) => ({ ...NONE(wsId, cockpit), ...over });
    switch (cockpit) {
        case 'PRODUCTION': {
            const open = wo ? wo.filter((w) => OPEN(w.status)) : null;
            return base({ analyticsTitle: 'Açık iş emirleri — durum', bars: open ? count(open, (w) => w.status) : null, barsReason: open ? null : 'iş emri listesi okunamadı — veri yok',
                secondTitle: 'Teslim termini', second: open ? dueBuckets(open, today) : null,
                recordsTitle: 'Açık iş emirleri', columns: ['Ürün', 'Müşteri PO', 'Durum', 'Termin', 'Üretilen / plan'],
                records: open ? open.slice().sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')).map((w) => rec(w.id, [w.productCode, w.customerPo, statusTr(w.status), w.dueDate ?? 'yok', `${w.qtyProduced} / ${w.qtyPlanned}`], wolink(w.id), toneOf(w.status))) : null, recordsReason: open ? null : 'iş emri listesi okunamadı — veri yok',
                exceptions: open ? [...open.filter((w) => w.dueDate && w.dueDate < today).slice(0, 5).map((w) => ({ text: `${w.productCode} · ${w.customerPo}: termin ${w.dueDate} geçti`, href: wolink(w.id), tone: 'red' })),
                    ...open.filter((w) => w.status === 'ON_HOLD').slice(0, 5).map((w) => ({ text: `${w.productCode}: HOLD'da`, href: wolink(w.id), tone: 'red' })), ...open.filter((w) => w.qtyScrap > 0).slice(0, 4).map((w) => ({ text: `${w.productCode}: ${w.qtyScrap} adet fire`, href: wolink(w.id), tone: 'amber' }))] : [] });
        }
        case 'PLANNING': {
            const b = i.board ? i.board.filter((r) => OPEN(r.status)) : null;
            const ready = b ? [{ label: 'Malzeme + takım hazır', value: b.filter((r) => r.materialState === 'READY' && r.toolState === 'READY').length, tone: 'green' }, { label: 'Malzeme eksik', value: b.filter((r) => r.materialState !== 'READY').length, tone: 'amber' }, { label: 'Takım eksik', value: b.filter((r) => r.toolState !== 'READY').length, tone: 'amber' }, { label: 'Kalite HOLD', value: b.filter((r) => r.openQualityHold).length, tone: 'red' }, { label: 'Makine/tarih atanmamış', value: b.filter((r) => !r.machineId || !r.plannedDate).length, tone: 'blue' }] : null;
            return base({ analyticsTitle: 'Plan hazırlığı (açık iş emirleri)', bars: ready, barsReason: b ? null : 'planlama panosu okunamadı — veri yok', secondTitle: 'Teslim termini', second: b ? dueBuckets(b, today) : null,
                recordsTitle: 'Plan panosu', columns: ['Ürün', 'Termin', 'Malzeme', 'Takım', 'Plan tarihi'],
                records: b ? b.slice().sort((a, c) => (a.dueDate ?? '9999').localeCompare(c.dueDate ?? '9999')).map((r) => rec(r.workOrderId, [r.productCode ?? '—', r.dueDate ?? 'yok', statusTr(r.materialState), statusTr(r.toolState), r.plannedDate ?? 'atanmadı'], wolink(r.workOrderId), r.openQualityHold ? 'red' : r.materialState === 'READY' && r.toolState === 'READY' ? 'green' : 'amber')) : null, recordsReason: b ? null : 'planlama panosu okunamadı — veri yok',
                exceptions: b ? b.filter((r) => r.openQualityHold || (r.dueDate && r.dueDate < today)).slice(0, 8).map((r) => ({ text: `${r.productCode ?? '—'}: ${r.openQualityHold ? 'kalite HOLD' : `termin ${r.dueDate} geçti`}`, href: wolink(r.workOrderId), tone: 'red' })) : [] });
        }
        case 'QUALITY': {
            const q = wo ? wo.filter((w) => OPEN(w.status) && (w.status === 'FIRST_PIECE_PENDING' || w.status === 'ON_HOLD' || w.qtyScrap > 0)) : null;
            const scrap = wo ? Array.from(wo.filter((w) => w.qtyScrap > 0).reduce((m, w) => m.set(w.productCode, (m.get(w.productCode) ?? 0) + w.qtyScrap), new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v, tone: 'amber' })) : null;
            return base({ analyticsTitle: 'Kalite kararı bekleyen / sorunlu iş emirleri', bars: q ? count(q, (w) => (w.status === 'FIRST_PIECE_PENDING' || w.status === 'ON_HOLD' ? w.status : 'SCRAP')) : null, barsReason: q ? null : 'iş emri listesi okunamadı — veri yok',
                secondTitle: 'Ürüne göre fire (adet)', second: scrap,
                recordsTitle: 'Kalite kayıtları', columns: ['Ürün', 'Müşteri PO', 'Durum', 'Fire', 'Üretilen'],
                records: q ? q.map((w) => rec(w.id, [w.productCode, w.customerPo, statusTr(w.status), String(w.qtyScrap), String(w.qtyProduced)], wolink(w.id), toneOf(w.status))) : null, recordsReason: q ? null : 'iş emri listesi okunamadı — veri yok',
                exceptions: q ? q.filter((w) => w.status === 'ON_HOLD').slice(0, 6).map((w) => ({ text: `${w.productCode}: HOLD — serbest bırakma kararı bekliyor`, href: wolink(w.id), tone: 'red' })) : [] });
        }
        case 'CAM': {
            const e = i.eng ?? null;
            return base({ analyticsTitle: 'CAM programları — durum', bars: e ? count(e.programs, (p) => p.status) : null, barsReason: e ? null : 'mühendislik verisi okunamadı — veri yok', secondTitle: 'Revizyonlar — durum', second: e ? count(e.revisions, (r) => r.status) : null,
                recordsTitle: 'CAM programları', columns: ['Program', 'Durum', 'İdeal çevrim'], records: e ? e.programs.map((p) => rec(p.id, [p.programNo, statusTr(p.status), p.idealCycleSeconds === null ? 'girilmemiş' : `${p.idealCycleSeconds} sn`], '#/muhendislik', p.status === 'RELEASED' && p.idealCycleSeconds === null ? 'red' : toneOf(p.status))) : null, recordsReason: e ? null : 'mühendislik verisi okunamadı — veri yok',
                exceptions: e ? e.programs.filter((p) => p.status === 'RELEASED' && p.idealCycleSeconds === null).slice(0, 8).map((p) => ({ text: `Program ${p.programNo}: ideal çevrim yok → OEE performansı hesaplanamaz`, href: '#/muhendislik', tone: 'red' })) : [] });
        }
        case 'TOOLROOM': {
            const t = i.tools ?? null;
            const wear = t ? t.filter((x) => x.location !== 'SCRAP' && x.lifeMinutesRated > 0) : null;
            const b = (lo, hi) => wear.filter((x) => { const r = x.lifeMinutesUsed / x.lifeMinutesRated; return r >= lo && r < hi; }).length;
            return base({ analyticsTitle: 'Takımlar — konum', bars: t ? count(t, (x) => x.location) : null, barsReason: t ? null : 'takım listesi okunamadı — veri yok',
                secondTitle: 'Ömür kullanımı (hurdadakiler hariç)', second: wear ? [{ label: '%0–50', value: b(0, 0.5), tone: 'green' }, { label: '%50–80', value: b(0.5, 0.8), tone: 'amber' }, { label: '%80 ve üstü', value: b(0.8, 1e9), tone: 'red' }] : null,
                recordsTitle: 'Takım envanteri', columns: ['Kod', 'Konum', 'Ömür'], records: t ? t.map((x) => rec(x.id, [x.code, statusTr(x.location), x.lifeMinutesRated > 0 ? `%${Math.round((x.lifeMinutesUsed / x.lifeMinutesRated) * 100)}` : 'tanımsız'], '#/takimhane', x.lifeMinutesRated > 0 && x.lifeMinutesUsed / x.lifeMinutesRated >= 0.8 ? 'red' : toneOf(x.location))) : null, recordsReason: t ? null : 'takım listesi okunamadı — veri yok',
                exceptions: wear ? wear.filter((x) => x.lifeMinutesUsed / x.lifeMinutesRated >= 0.8).slice(0, 8).map((x) => ({ text: `Takım ${x.code}: ömrünün %${Math.round((x.lifeMinutesUsed / x.lifeMinutesRated) * 100)}'ı doldu`, href: '#/takimhane', tone: 'red' })) : [] });
        }
        case 'MAINTENANCE': {
            const tk = i.tickets ?? null;
            return base({ analyticsTitle: 'Bakım emirleri — durum', bars: tk ? count(tk, (x) => x.status) : null, barsReason: tk ? null : 'bakım emirleri okunamadı — veri yok', secondTitle: 'Önem derecesi', second: tk ? count(tk.filter((x) => x.status !== 'CLOSED' && x.status !== 'RETURNED_TO_SERVICE'), (x) => x.severity) : null,
                recordsTitle: 'Bakım emirleri', columns: ['Neden', 'Önem', 'Durum', 'Açılış'], records: tk ? tk.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((x) => rec(x.id, [x.reason, statusTr(x.severity), statusTr(x.status), x.createdAt.slice(0, 10)], '#/bakim', x.status === 'CLOSED' || x.status === 'RETURNED_TO_SERVICE' ? 'green' : toneOf(x.severity))) : null, recordsReason: tk ? null : 'bakım emirleri okunamadı — veri yok',
                exceptions: tk ? tk.filter((x) => (x.severity === 'CRITICAL' || x.severity === 'HIGH') && x.status !== 'CLOSED' && x.status !== 'RETURNED_TO_SERVICE').slice(0, 8).map((x) => ({ text: `${x.reason} (${statusTr(x.severity)}, ${statusTr(x.status)})`, href: '#/bakim', tone: 'red' })) : [] });
        }
        case 'WAREHOUSE':
        case 'SHIPPING': {
            const l = i.lots ?? null;
            const rows = l ? (cockpit === 'SHIPPING' ? l.filter((x) => x.state === 'STAGED' || x.state === 'AVAILABLE' || x.state === 'SHIPPED') : l) : null;
            return base({ analyticsTitle: cockpit === 'SHIPPING' ? 'Sevkiyat lotları — durum' : 'Stok lotları — durum', bars: rows ? count(rows, (x) => x.state) : null, barsReason: rows ? null : 'stok lotları okunamadı — veri yok',
                recordsTitle: cockpit === 'SHIPPING' ? 'Sevkiyat lotları' : 'Stok lotları', columns: ['Lot', 'Durum', 'Adet'], records: rows ? rows.map((x) => rec(x.id, [x.id.slice(0, 8), statusTr(x.state), String(x.qty)], wolink(x.workOrderId), toneOf(x.state))) : null, recordsReason: rows ? null : 'stok lotları okunamadı — veri yok',
                exceptions: rows ? rows.filter((x) => x.state === 'HOLD' || x.state === 'SCRAP').slice(0, 8).map((x) => ({ text: `Lot ${x.id.slice(0, 8)}: ${statusTr(x.state)} (${x.qty} adet)`, href: wolink(x.workOrderId), tone: 'red' })) : [] });
        }
        case 'PURCHASING': {
            const p = i.pos ?? null, ln = i.poLines ?? null;
            const open = ln ? ln.filter((x) => x.qtyReceived < x.qtyOrdered) : null;
            return base({ analyticsTitle: 'Satınalma siparişleri — durum', bars: p ? count(p, (x) => x.status) : null, barsReason: p ? null : 'sipariş listesi okunamadı — veri yok', secondTitle: 'Kalem teslim durumu', second: ln ? [{ label: 'Tam teslim', value: ln.length - (open?.length ?? 0), tone: 'green' }, { label: 'Eksik teslim', value: open?.length ?? 0, tone: 'amber' }] : null,
                recordsTitle: 'Satınalma siparişleri', columns: ['Sipariş', 'Durum'], records: p ? p.map((x) => rec(x.id, [x.id.slice(0, 8), statusTr(x.status)], '#/satinalma', toneOf(x.status))) : null, recordsReason: p ? null : 'sipariş listesi okunamadı — veri yok',
                exceptions: open && open.length ? [{ text: `${open.length} sipariş kaleminde eksik teslim var`, href: '#/satinalma', tone: 'amber' }] : [] });
        }
        case 'PERSONNEL': {
            const pe = i.personnel ?? null;
            return base({ analyticsTitle: 'Personel — bölüme göre', bars: pe ? count(pe.filter((x) => x.active), (x) => x.department) : null, barsReason: pe ? null : 'personel listesi okunamadı — veri yok',
                recordsTitle: 'Personel', columns: ['Ad', 'Bölüm', 'Durum'], records: pe ? pe.map((x) => rec(x.id, [x.name, statusTr(x.department), x.active ? 'Aktif' : 'Pasif'], '#/personel', x.active ? 'green' : 'gray')) : null, recordsReason: pe ? null : 'personel listesi okunamadı — veri yok',
                exceptions: pe ? pe.filter((x) => x.active && x.department === 'UNASSIGNED').slice(0, 8).map((x) => ({ text: `${x.name}: bölümü belirsiz`, href: '#/personel', tone: 'amber' })) : [] });
        }
        case 'ACCOUNTING': return base({ analyticsTitle: 'Muhasebe', barsReason: 'Bu merkezde tutar gösterilmez; ekonomik ekranlar kendi yetki kapısıyla açılır', recordsReason: 'Kayıtlar Muhasebe / Muhasebe Kuyruğu ekranlarında' });
        default: return NONE(wsId, null);
    }
}
