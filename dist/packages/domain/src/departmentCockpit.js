import { NEEDS_DATA } from './performanceCenter.js';
const WEAR_LIMIT = 0.8;
const OPEN_WO = (s) => s !== 'COMPLETED' && s !== 'CANCELLED';
const k = (key, label, value, reason, tone, href = null) => value === null ? { key, label, value: null, reason: `${reason} — ${NEEDS_DATA}`, tone: 'gray', href } : { key, label, value, reason: null, tone: tone(value), href };
const hot = (t) => (n) => (n > 0 ? t : 'green');
const flat = (n) => (n > 0 ? 'blue' : 'gray');
const cnt = (xs, f) => (xs ? xs.filter(f).length : null);
const c = (s, key) => (s && typeof s.counters[key] === 'number' ? s.counters[key] : null);
const alertsOf = (s, kind) => (s ? s.alerts.filter((a) => a.kind === kind).length : null);
const dueOrder = (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
const wolink = (id) => `#/nesne?t=WORK_ORDER&id=${encodeURIComponent(id)}`;
export function buildCockpit(id, i) {
    const s = i.snapshot, wo = i.workOrders ?? null;
    switch (id) {
        case 'PRODUCTION': {
            const run = c(s, 'workOrdersRunning'), wait = c(s, 'workOrdersWaiting'), hold = c(s, 'workOrdersOnHold');
            const live = s ? s.liveWorkOrders : null;
            return { id, title: 'Üretim kokpiti', owner: 'Üretim sorumlusu', actions: ['İş emri ata / başlat', 'Üretim bildir', 'Hold koy / kaldır'],
                kpis: [k('running', 'Çalışan iş emri', run, 'komuta anlık görüntüsü yok', flat, '#/is-emirleri'), k('waiting', 'Bekleyen iş emri', wait, 'komuta anlık görüntüsü yok', flat, '#/is-emirleri'),
                    k('hold', 'Duran iş emri', hold, 'komuta anlık görüntüsü yok', hot('amber'), '#/is-emirleri'), k('down', 'Arızalı makine', c(s, 'machinesDown'), 'komuta anlık görüntüsü yok', hot('red'), '#/bakim'),
                    k('late', 'Termini geçen kalem', c(s, 'orderItemsOverdue'), 'komuta anlık görüntüsü yok', hot('red'), '#/siparisler')],
                queueTitle: 'Şu an üretimde', queue: live ? live.map((w) => ({ label: `${w.machineCode ?? '—'} · ${w.productCode ?? '—'}`, detail: `${w.qtyProduced}/${w.qtyPlanned} adet · fire ${w.qtyScrap}${w.operatorName ? ` · ${w.operatorName}` : ''}`, href: wolink(w.workOrderId), tone: w.status === 'IN_PROGRESS' ? 'blue' : 'amber' })) : null, queueReason: live ? null : 'komuta anlık görüntüsü okunamadı',
                workflow: [{ step: 'Bekliyor', count: wait }, { step: 'İlk parça', count: live ? live.filter((w) => w.status === 'FIRST_PIECE_PENDING').length : null }, { step: 'Üretimde', count: run }, { step: 'Duruyor', count: hold }],
                risks: (s?.alerts ?? []).filter((a) => a.domain === 'PRODUCTION').map((a) => ({ text: a.title, href: null })),
                crossLinks: [{ label: 'Planlama', href: '#/planlama', why: 'başlamayan işleri sırala' }, { label: 'Kalite', href: '#/kalite', why: 'ilk parça / hold' }, { label: 'Bakım', href: '#/bakim', why: 'arızalı makine' }] };
        }
        case 'PLANNING': {
            const b = i.board ?? null;
            const unplanned = b ? b.filter((r) => OPEN_WO(r.status) && (!r.machineId || !r.plannedDate)) : null;
            return { id, title: 'Planlama kokpiti', owner: 'Planlama (üretim planlama yetkisi olanlar)', actions: ['Sırala', 'Makine ata', 'Operatör öner/ata'],
                kpis: [k('unplanned', 'Makine/tarih atanmamış iş emri', unplanned ? unplanned.length : null, 'planlama panosu okunamadı', hot('amber'), '#/planlama'),
                    k('matNot', 'Malzeme hazır değil', cnt(b, (r) => OPEN_WO(r.status) && r.materialState !== 'READY'), 'planlama panosu okunamadı', hot('amber'), '#/planlama'),
                    k('toolNot', 'Takım hazır değil', cnt(b, (r) => OPEN_WO(r.status) && r.toolState !== 'READY'), 'planlama panosu okunamadı', hot('amber'), '#/planlama'),
                    k('hold', 'Kalite hold altında', cnt(b, (r) => r.openQualityHold), 'planlama panosu okunamadı', hot('red'), '#/kalite'),
                    k('lateStart', 'Planlanan başlangıcı geçen', alertsOf(s, 'WORK_ORDER_LATE_START'), 'komuta anlık görüntüsü yok', hot('red'), '#/is-emirleri')],
                queueTitle: 'Atanmamış işler (termine göre)', queue: unplanned ? unplanned.slice().sort(dueOrder).slice(0, 8).map((r) => ({ label: r.productCode ?? '—', detail: `termin ${r.dueDate ?? 'yok'} · malzeme ${r.materialState} · takım ${r.toolState}`, href: wolink(r.workOrderId), tone: r.dueDate && r.dueDate < i.nowIso.slice(0, 10) ? 'red' : 'amber' })) : null, queueReason: unplanned ? null : 'planlama panosu okunamadı',
                workflow: [{ step: 'Açık', count: cnt(b, (r) => OPEN_WO(r.status)) }, { step: 'Hazır (malzeme+takım)', count: cnt(b, (r) => OPEN_WO(r.status) && r.materialState === 'READY' && r.toolState === 'READY') }, { step: 'Atandı', count: cnt(b, (r) => OPEN_WO(r.status) && !!r.machineId && !!r.plannedDate) }],
                risks: [], crossLinks: [{ label: 'CAM / Programlama', href: '#/muhendislik', why: 'program yoksa başlatılamaz' }, { label: 'Depo', href: '#/depo', why: 'malzeme durumu' }, { label: 'Takımhane', href: '#/takimhane', why: 'takım hazırlığı' }] };
        }
        case 'CAM': {
            const e = i.eng ?? null;
            const draftRev = e ? e.revisions.filter((r) => r.status === 'DRAFT') : null;
            const draftProg = e ? e.programs.filter((p) => p.status === 'DRAFT') : null;
            const noCycle = e ? e.programs.filter((p) => p.status === 'RELEASED' && p.idealCycleSeconds === null) : null;
            const relRevNoProg = e ? e.revisions.filter((r) => r.status === 'RELEASED' && !e.programs.some((p) => p.productRevisionId === r.id && p.status === 'RELEASED')) : null;
            return { id, title: 'CAM & Mühendislik kokpiti', owner: 'CAM / Mühendislik (yetkili kullanıcılar)', actions: ['Revizyon / BOM yayınla', 'CAM programı yayınla', 'Çevrim süresi gir'],
                kpis: [k('draftRev', 'Taslak revizyon', draftRev ? draftRev.length : null, 'mühendislik verisi okunamadı', hot('amber'), '#/muhendislik'), k('draftProg', 'Taslak CAM programı', draftProg ? draftProg.length : null, 'mühendislik verisi okunamadı', hot('amber'), '#/muhendislik'),
                    k('noCycle', 'İdeal çevrimi olmayan yayınlı program (OEE performansı hesaplanamaz)', noCycle ? noCycle.length : null, 'mühendislik verisi okunamadı', hot('red'), '#/muhendislik'), k('revNoProg', 'Yayınlı revizyon, yayınlı programı yok', relRevNoProg ? relRevNoProg.length : null, 'mühendislik verisi okunamadı', hot('red'), '#/muhendislik'),
                    k('readinessSoon', 'Yakın planda BOM/CAM verisi eksik iş', alertsOf(s, 'READINESS_UNKNOWN_SOON'), 'komuta anlık görüntüsü yok', hot('amber'), '#/is-emirleri')],
                queueTitle: 'Eksik veri kuyruğu', queue: e ? [...(noCycle ?? []).map((p) => ({ label: `Program ${p.programNo}`, detail: 'ideal çevrim süresi yok → OEE performansı hesaplanamaz', href: '#/muhendislik', tone: 'red' })), ...(draftProg ?? []).map((p) => ({ label: `Program ${p.programNo}`, detail: 'taslak — yayınlanmadan iş emrine bağlanmaz', href: '#/muhendislik', tone: 'amber' }))].slice(0, 8) : null, queueReason: e ? null : 'mühendislik verisi okunamadı',
                workflow: [{ step: 'Taslak revizyon', count: draftRev ? draftRev.length : null }, { step: 'Yayınlı revizyon', count: e ? e.revisions.filter((r) => r.status === 'RELEASED').length : null }, { step: 'Yayınlı program', count: e ? e.programs.filter((p) => p.status === 'RELEASED').length : null }],
                risks: [], crossLinks: [{ label: 'Rota / Operasyon', href: '#/rota', why: 'rotayı iş emrine uygula' }, { label: 'Planlama', href: '#/planlama', why: 'hazır olmayan işler' }, { label: 'OEE', href: '#/oee', why: 'çevrim süresi OEE\'yi etkiler' }] };
        }
        case 'QUALITY': {
            return { id, title: 'Kalite & Metroloji kokpiti', owner: 'Kalite (ilk parça / hold / NCR yetkileri)', actions: ['İlk parça onayı', 'Hold bırak', 'NCR / ret'],
                kpis: [k('holds', 'Açık HOLD', c(s, 'qualityHoldsOpen'), 'komuta anlık görüntüsü yok', hot('red'), '#/kalite'), k('ncr', 'Açık NCR', c(s, 'ncrsOpen'), 'komuta anlık görüntüsü yok', hot('amber'), '#/kalite'),
                    k('fp', 'İlk parça onayı bekleyen', cnt(wo, (w) => w.status === 'FIRST_PIECE_PENDING'), 'iş emri listesi okunamadı', hot('amber'), '#/kalite'), k('incoming', 'Giriş kalite bekleyen', c(s, 'incomingQcWaiting'), 'komuta anlık görüntüsü yok', hot('amber'), '#/satinalma'),
                    k('scrap', 'Fireli açık iş emri', cnt(wo, (w) => OPEN_WO(w.status) && w.qtyScrap > 0), 'iş emri listesi okunamadı', hot('amber'), '#/is-emirleri')],
                queueTitle: 'Karar bekleyenler', queue: wo ? wo.filter((w) => w.status === 'FIRST_PIECE_PENDING' || w.status === 'ON_HOLD').slice(0, 8).map((w) => ({ label: `${w.productCode} · ${w.customerPo}`, detail: w.status === 'ON_HOLD' ? 'HOLD — serbest bırakma kararı' : 'ilk parça onayı bekliyor', href: wolink(w.id), tone: w.status === 'ON_HOLD' ? 'red' : 'amber' })) : null, queueReason: wo ? null : 'iş emri listesi okunamadı',
                workflow: [{ step: 'İlk parça bekliyor', count: cnt(wo, (w) => w.status === 'FIRST_PIECE_PENDING') }, { step: 'İlk parça onaylı', count: cnt(wo, (w) => w.status === 'FIRST_PIECE_APPROVED') }, { step: 'Hold', count: cnt(wo, (w) => w.status === 'ON_HOLD') }],
                risks: (s?.alerts ?? []).filter((a) => a.domain === 'QUALITY').map((a) => ({ text: a.title, href: null })),
                crossLinks: [{ label: 'TAHSİS', href: '#/tahsis', why: 'ölçü düzeltme kaydı' }, { label: 'Depo', href: '#/depo', why: 'HOLD lotlar' }, { label: 'Sevkiyat', href: '#/sevkiyat', why: 'sevk öncesi kalite kapısı' }] };
        }
        case 'TOOLROOM': {
            const t = i.tools ?? null;
            const worn = t ? t.filter((x) => x.location !== 'SCRAP' && x.lifeMinutesRated > 0 && x.lifeMinutesUsed / x.lifeMinutesRated >= WEAR_LIMIT) : null;
            return { id, title: 'Takımhane kokpiti', owner: 'Takımhane (yetkili kullanıcılar)', actions: ['Takım ver / geri al', 'Makineye tak / çıkar', 'Aşınma kaydı / hurda'],
                kpis: [k('cabinet', 'Dolapta', cnt(t, (x) => x.location === 'CABINET'), 'takım listesi okunamadı', flat, '#/takimhane'), k('mounted', 'Makinede', cnt(t, (x) => x.location === 'MOUNTED'), 'takım listesi okunamadı', flat, '#/takimhane'),
                    k('issued', 'Kişide (zimmetli)', cnt(t, (x) => x.location === 'ISSUED'), 'takım listesi okunamadı', flat, '#/takimhane'), k('worn', `Ömrü %${WEAR_LIMIT * 100}+ dolmuş`, worn ? worn.length : null, 'takım listesi okunamadı', hot('amber'), '#/takimhane'),
                    k('scrap', 'Hurdaya ayrılmış', cnt(t, (x) => x.location === 'SCRAP'), 'takım listesi okunamadı', flat, '#/takimhane')],
                queueTitle: 'Ömrü dolmak üzere takımlar', queue: worn ? worn.slice().sort((a, b) => b.lifeMinutesUsed / b.lifeMinutesRated - a.lifeMinutesUsed / a.lifeMinutesRated).slice(0, 8).map((x) => ({ label: x.code, detail: `%${Math.round((x.lifeMinutesUsed / x.lifeMinutesRated) * 100)} kullanıldı · ${x.location === 'MOUNTED' ? 'makinede' : x.location === 'ISSUED' ? 'zimmetli' : 'dolapta'}`, href: '#/takimhane', tone: 'amber' })) : null, queueReason: worn ? null : 'takım listesi okunamadı',
                workflow: [{ step: 'Dolap', count: cnt(t, (x) => x.location === 'CABINET') }, { step: 'Zimmet', count: cnt(t, (x) => x.location === 'ISSUED') }, { step: 'Makine', count: cnt(t, (x) => x.location === 'MOUNTED') }],
                risks: [], crossLinks: [{ label: 'Planlama', href: '#/planlama', why: 'takım hazır değilse iş başlamaz' }, { label: 'CAM', href: '#/muhendislik', why: 'program takım listesi' }, { label: 'Satınalma', href: '#/talepler', why: 'takım talebi' }] };
        }
        case 'MAINTENANCE': {
            const tk = i.tickets ?? null;
            const open = tk ? tk.filter((x) => x.status !== 'CLOSED' && x.status !== 'RETURNED_TO_SERVICE') : null;
            const oldest = open && open.length ? open.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] : null;
            return { id, title: 'Bakım kokpiti', owner: 'Bakım (arıza / test+serbest bırakma yetkileri)', actions: ['Arıza kaydı', 'Bakım emri ilerlet', 'Test sonucu + servise dön'],
                kpis: [k('down', 'Arızalı makine', c(s, 'machinesDown'), 'komuta anlık görüntüsü yok', hot('red'), '#/bakim'), k('maint', 'Bakımdaki makine', c(s, 'machinesMaintenance'), 'komuta anlık görüntüsü yok', hot('amber'), '#/bakim'),
                    k('open', 'Açık bakım emri', open ? open.length : null, 'bakım emirleri okunamadı', hot('amber'), '#/bakim'), k('crit', 'Kritik/yüksek öncelikli açık', open ? open.filter((x) => x.severity === 'CRITICAL' || x.severity === 'HIGH').length : null, 'bakım emirleri okunamadı', hot('red'), '#/bakim'),
                    k('testWait', 'Test bekleyen', cnt(tk, (x) => x.status === 'TEST_PENDING'), 'bakım emirleri okunamadı', hot('amber'), '#/bakim')],
                queueTitle: 'Açık bakım emirleri (en eski önce)', queue: open ? open.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 8).map((x) => ({ label: `${x.severity} · ${x.reason}`, detail: `${x.status} · açılış ${x.createdAt.slice(0, 10)}`, href: '#/bakim', tone: x.severity === 'CRITICAL' || x.severity === 'HIGH' ? 'red' : 'amber' })) : null, queueReason: open ? null : 'bakım emirleri okunamadı',
                workflow: [{ step: 'Açık', count: cnt(tk, (x) => x.status === 'OPEN') }, { step: 'Devam', count: cnt(tk, (x) => x.status === 'IN_PROGRESS') }, { step: 'Test', count: cnt(tk, (x) => x.status === 'TEST_PENDING') }, { step: 'Servise döndü', count: cnt(tk, (x) => x.status === 'RETURNED_TO_SERVICE') }],
                risks: oldest ? [{ text: `En eski açık bakım emri ${oldest.createdAt.slice(0, 10)} tarihinden beri açık`, href: '#/bakim' }] : [], crossLinks: [{ label: 'Üretim', href: '#/is-emirleri', why: 'arızalı makinedeki iş' }, { label: 'OEE kayıpları', href: '#/oee', why: 'arıza süresi' }, { label: 'Planlama', href: '#/planlama', why: 'alternatif makine' }] };
        }
        case 'WAREHOUSE': {
            const l = i.lots ?? null;
            return { id, title: 'Depo & Stok kokpiti', owner: 'Depo (yetkili kullanıcılar)', actions: ['Lot oluştur', 'Lot durumunu ilerlet', 'Mal kabul'],
                kpis: [k('wip', 'Üretimde (WIP) lot', cnt(l, (x) => x.state === 'WIP'), 'stok lotları okunamadı', flat, '#/depo'), k('fg', 'Mamul (FG) lot', cnt(l, (x) => x.state === 'FG'), 'stok lotları okunamadı', flat, '#/depo'),
                    k('hold', 'HOLD lot', cnt(l, (x) => x.state === 'HOLD'), 'stok lotları okunamadı', hot('red'), '#/depo'), k('staged', 'Sevkiyata hazır lot', cnt(l, (x) => x.state === 'STAGED'), 'stok lotları okunamadı', flat, '#/sevkiyat'),
                    k('incoming', 'Giriş kalite bekleyen', c(s, 'incomingQcWaiting'), 'komuta anlık görüntüsü yok', hot('amber'), '#/satinalma'), k('shortage', 'Yakın planda malzeme eksiği', alertsOf(s, 'MATERIAL_SHORTAGE_SOON'), 'komuta anlık görüntüsü yok', hot('red'), '#/depo')],
                queueTitle: 'HOLD / hurda lotlar', queue: l ? l.filter((x) => x.state === 'HOLD' || x.state === 'SCRAP').slice(0, 8).map((x) => ({ label: `Lot ${x.id.slice(0, 8)}`, detail: `${x.qty} adet · ${x.state}`, href: `#/nesne?t=STOCK_LOT&id=${encodeURIComponent(x.id)}`, tone: 'red' })) : null, queueReason: l ? null : 'stok lotları okunamadı',
                workflow: [{ step: 'WIP', count: cnt(l, (x) => x.state === 'WIP') }, { step: 'FG', count: cnt(l, (x) => x.state === 'FG') }, { step: 'Hazır', count: cnt(l, (x) => x.state === 'STAGED') }, { step: 'Sevk edildi', count: cnt(l, (x) => x.state === 'SHIPPED') }],
                risks: (s?.alerts ?? []).filter((a) => a.domain === 'MATERIAL').map((a) => ({ text: a.title, href: null })), crossLinks: [{ label: 'Satınalma', href: '#/satinalma', why: 'mal kabul' }, { label: 'Kalite', href: '#/kalite', why: 'HOLD lotlar' }, { label: 'Sevkiyat', href: '#/sevkiyat', why: 'hazır lotlar' }] };
        }
        case 'PURCHASING': {
            const p = i.pos ?? null;
            const lines = i.poLines ?? null;
            return { id, title: 'Satınalma kokpiti', owner: 'Satınalma (PO yönetimi / onay yetkileri)', actions: ['Talep → PO', 'PO onayı', 'Mal kabul'],
                kpis: [k('req', 'Onay bekleyen talep', c(s, 'purchaseRequestsWaiting'), 'komuta anlık görüntüsü yok', hot('amber'), '#/talepler'), k('draft', 'Taslak/gönderilmiş PO', cnt(p, (x) => x.status === 'DRAFT' || x.status === 'SUBMITTED'), 'PO listesi okunamadı', hot('amber'), '#/satinalma'),
                    k('approved', 'Onaylı, teslim bekleyen PO', cnt(p, (x) => x.status === 'APPROVED'), 'PO listesi okunamadı', flat, '#/satinalma'), k('openLines', 'Eksik teslim satırı', lines ? lines.filter((x) => x.qtyReceived < x.qtyOrdered).length : null, 'PO satırları okunamadı', hot('amber'), '#/satinalma'),
                    k('incoming', 'Giriş kalite bekleyen', c(s, 'incomingQcWaiting'), 'komuta anlık görüntüsü yok', hot('amber'), '#/satinalma')],
                queueTitle: 'Teslim bekleyen satırlar', queue: lines ? [{ label: 'Eksik teslim', detail: `${lines.filter((x) => x.qtyReceived < x.qtyOrdered).length} satır · ${lines.reduce((a, x) => a + Math.max(0, x.qtyOrdered - x.qtyReceived), 0)} adet`, href: '#/satinalma', tone: 'amber' }] : null, queueReason: lines ? null : 'PO satırları okunamadı',
                workflow: [{ step: 'Talep', count: c(s, 'purchaseRequestsWaiting') }, { step: 'PO taslak/gönderildi', count: cnt(p, (x) => x.status === 'DRAFT' || x.status === 'SUBMITTED') }, { step: 'Onaylı', count: cnt(p, (x) => x.status === 'APPROVED') }],
                risks: (s?.alerts ?? []).filter((a) => a.domain === 'PURCHASING').map((a) => ({ text: a.title, href: null })), crossLinks: [{ label: 'Depo', href: '#/depo', why: 'mal kabul lotu' }, { label: 'Kalite', href: '#/kalite', why: 'giriş kalite kararı' }, { label: 'Tedarikçi faturası', href: '#/tedarikci-fatura', why: 'fatura eşleştirme (yetkili)' }] };
        }
        case 'SHIPPING': {
            const l = i.lots ?? null;
            return { id, title: 'Sevkiyat & Lojistik kokpiti', owner: 'Sevkiyat (yetkili kullanıcılar)', actions: ['Sevkiyat hazırla', 'Sevk et', 'Ticari onay kapısı'],
                kpis: [k('staged', 'Sevkiyata hazır lot', cnt(l, (x) => x.state === 'STAGED' || x.state === 'AVAILABLE'), 'stok lotları okunamadı', flat, '#/sevkiyat'), k('draft', 'Hazırlanan sevkiyat', c(s, 'shipmentsDraft'), 'komuta anlık görüntüsü yok', flat, '#/sevkiyat'),
                    k('late', 'Termini geçen kalem', c(s, 'orderItemsOverdue'), 'komuta anlık görüntüsü yok', hot('red'), '#/siparisler'), k('shipped', 'Sevk edilmiş lot', cnt(l, (x) => x.state === 'SHIPPED'), 'stok lotları okunamadı', flat, '#/sevkiyat'),
                    k('hold', 'HOLD lot (sevk edilemez)', cnt(l, (x) => x.state === 'HOLD'), 'stok lotları okunamadı', hot('red'), '#/depo')],
                queueTitle: 'Sevkiyata hazır lotlar', queue: l ? l.filter((x) => x.state === 'STAGED' || x.state === 'AVAILABLE').slice(0, 8).map((x) => ({ label: `Lot ${x.id.slice(0, 8)}`, detail: `${x.qty} adet · ${x.state}`, href: `#/nesne?t=STOCK_LOT&id=${encodeURIComponent(x.id)}`, tone: 'blue' })) : null, queueReason: l ? null : 'stok lotları okunamadı',
                workflow: [{ step: 'FG', count: cnt(l, (x) => x.state === 'FG') }, { step: 'Hazır', count: cnt(l, (x) => x.state === 'STAGED') }, { step: 'Taslak sevkiyat', count: c(s, 'shipmentsDraft') }, { step: 'Sevk edildi', count: cnt(l, (x) => x.state === 'SHIPPED') }],
                risks: (s?.alerts ?? []).filter((a) => a.domain === 'SHIPMENT').map((a) => ({ text: a.title, href: null })), crossLinks: [{ label: 'Muhasebe kuyruğu', href: '#/onay-kuyrugu', why: 'ticari onay' }, { label: 'Siparişler', href: '#/siparisler', why: 'termin' }, { label: 'Kalite', href: '#/kalite', why: 'sevk öncesi kapı' }] };
        }
        case 'ACCOUNTING': {
            return { id, title: 'Muhasebe & Finans kokpiti', owner: 'Muhasebe (muhasebe ve ekonomik erişim yetkisi)', actions: ['Ticari onay', 'Fatura', 'Tahsilat'],
                kpis: [k('draft', 'Fatura/onay öncesi sevkiyat taslağı', c(s, 'shipmentsDraft'), 'komuta anlık görüntüsü yok', flat, '#/onay-kuyrugu'), k('late', 'Termini geçen kalem', c(s, 'orderItemsOverdue'), 'komuta anlık görüntüsü yok', hot('amber'), '#/siparisler'),
                    { key: 'money', label: 'Tutarlar, alacak ve maliyet', value: null, reason: `Bu merkezde para gösterilmez; yalnız ekonomik erişimi olanlar Maliyet/Ekonomi ekranlarında görür — ${NEEDS_DATA} (yetki)`, tone: 'gray', href: '#/maliyet' }],
                queueTitle: 'Ticari onay kuyruğu', queue: null, queueReason: 'Kuyruk kayıtları Muhasebe Kuyruğu ekranında; tutarlı olduğu için burada listelenmez', workflow: [{ step: 'Sevkiyat taslağı', count: c(s, 'shipmentsDraft') }, { step: 'Ticari onay', count: null }, { step: 'Fatura', count: null }, { step: 'Tahsilat', count: null }],
                risks: [], crossLinks: [{ label: 'Sevkiyat', href: '#/sevkiyat', why: 'onay sonrası sevk' }, { label: 'Maliyet Zekâsı', href: '#/maliyet', why: 'yalnız ekonomik erişim' }, { label: 'Satınalma', href: '#/satinalma', why: 'tedarikçi faturaları' }] };
        }
        case 'PERSONNEL': {
            const p = i.personnel ?? null;
            const act = p ? p.filter((x) => x.active) : null;
            return { id, title: 'İnsan Kaynakları kokpiti', owner: 'Personel / İK (yetkili kullanıcılar) — ayrı İK rolü yoktur', actions: ['Personel kaydı', 'Hesap bağla / PIN', 'Çoklu makine ataması'],
                kpis: [k('active', 'Aktif personel', act ? act.length : null, 'personel listesi okunamadı', flat, '#/personel'), k('inactive', 'Pasif personel', p ? p.length - (act?.length ?? 0) : null, 'personel listesi okunamadı', flat, '#/personel'),
                    k('unassigned', 'Bölümü belirsiz (UNASSIGNED) aktif kişi', cnt(act, (x) => x.department === 'UNASSIGNED'), 'personel listesi okunamadı', hot('amber'), '#/personel'), k('production', 'Üretim bölümü aktif', cnt(act, (x) => x.department === 'URETIM'), 'personel listesi okunamadı', flat, '#/personel')],
                queueTitle: 'Bölümü belirsiz kişiler', queue: act ? act.filter((x) => x.department === 'UNASSIGNED').slice(0, 8).map((x) => ({ label: x.name, detail: 'bölüm atanmamış — yetki vermez', href: `#/nesne?t=PERSONNEL&id=${encodeURIComponent(x.id)}`, tone: 'amber' })) : null, queueReason: act ? null : 'personel listesi okunamadı',
                workflow: [{ step: 'Kayıt', count: p ? p.length : null }, { step: 'Aktif', count: act ? act.length : null }], risks: [], crossLinks: [{ label: 'Puantaj & Prim', href: '#/puantaj', why: 'ay gerçekleri (V47 değişmez)' }, { label: 'Personel Erişimi', href: '#/personel-yetki', why: 'hesap/PIN' }, { label: 'Rozetler / Akademi', href: '#/akademi', why: 'yetkinlik' }] };
        }
    }
}
export const COCKPIT_OF_PATH = {
    '/is-emirleri': 'PRODUCTION', '/planlama': 'PLANNING', '/muhendislik': 'CAM', '/kalite': 'QUALITY', '/takimhane': 'TOOLROOM', '/bakim': 'MAINTENANCE',
    '/depo': 'WAREHOUSE', '/satinalma': 'PURCHASING', '/sevkiyat': 'SHIPPING', '/alacaklar': 'ACCOUNTING', '/personel': 'PERSONNEL',
};
