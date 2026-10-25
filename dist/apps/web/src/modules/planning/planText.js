// Planlama Merkezi — metinler ve tarih yardımcıları (saf, DOM yok).
export const SHIFT_TR = { TeamK1: '1. Vardiya (08–16)', TeamK2: '2. Vardiya (16–24)', TeamOfis: 'Ofis' };
export const SHIFT_SHORT = { TeamK1: 'V1', TeamK2: 'V2' };
export const STATUS_TR = { PLANNED: 'Planlandı', STARTED: 'Üretimde', DONE: 'Kapandı', CANCELLED: 'İptal' };
export const OP_STATUS_TR = { PENDING: 'Bekliyor', FIRST_PIECE_PENDING: 'İlk parça onayı bekliyor', RUNNING: 'Çalışıyor', QC_PENDING: 'Kalite onayı bekliyor', DONE: 'Tamamlandı' };
export const WARN_TR = {
  OVER_CAPACITY: 'Vardiya kapasitesi aşılıyor', NO_TIME_DATA: 'Süre verisi yok (tahmin yapılmadı)', DATE_BEFORE_UPSTREAM: 'Önceki operasyondan önce tarihlendi',
};
// Bekleme nedenleri: operation_start_refusal çıktısı (kod[:ayrıntı]) ve plan uyarıları
export const WAIT_TR = {
  OPERATION_NOT_PENDING: null, SLICE_NOT_PLANNED: null, OTHER_SLICE_ACTIVE: 'Aynı operasyonun başka dilimi üretimde (aynı anda tek dilim çalışır)', OPERATION_DONE: 'Operasyon tamamlanmış', PREVIOUS_OPERATION_NOT_DONE: 'Önceki operasyondan kalitece serbest parça bekleniyor', NO_INPUT_QUANTITY: 'Kalitece serbest girdi yok (önceki operasyondan parça bekleniyor)',
  MACHINE_REQUIRED: 'Makine atanmadı', MACHINE_NOT_ALLOWED_FOR_OPERATION: 'Makine bu operasyon için izinli değil', MACHINE_NOT_ELIGIBLE: 'Makine devre dışı / arızalı', MACHINE_BUSY: 'Makine şu an başka işte; o iş bitince/dilimi kapanınca başlar',
  OPERATOR_REQUIRED: null, CAM_PROGRAM_NOT_RELEASED: 'CAM programı yayınlanmamış', CAM_PROGRAM_WRONG_REVISION: 'CAM programı yanlış revizyon', QUALITY_HOLD_OPEN: 'Kalite blokajı açık',
  MATERIAL_NOT_READY: 'Malzeme hazır değil', TOOLS_NOT_READY: 'Takımlar hazır değil', WORK_ORDER_ON_HOLD: 'İş emri BEKLETMEDE (ON_HOLD)', WORK_ORDER_COMPLETED: 'İş emri tamamlanmış', WORK_ORDER_CANCELLED: 'İş emri iptal',
  REQUIRED_NC_MISSING: 'Zorunlu NC belgesi eksik', CUT_SPEC_MISSING: 'Kesim ölçüsü / uç kaybı tanımsız', MACHINE_SKILL_REQUIREMENTS_UNKNOWN: 'Makine yetkinlik gereksinimi bilinmiyor',
};
const DETAIL_TR = { DOWN: 'arızalı', HOLD: 'beklemede', MAINT: 'bakımda', MAINTENANCE: 'bakımda', OFFLINE: 'devre dışı' };
export function waitText(code) {
  if (!code) return null; const [k, rest0] = String(code).split(':'); const rest = rest0 === undefined ? '' : (DETAIL_TR[rest0] ?? (/^\d+$/.test(rest0) ? `OP${rest0}` : rest0));
  if (k in WAIT_TR) return WAIT_TR[k] === null ? null : WAIT_TR[k] + (rest ? ` (${rest})` : '');
  if (k.startsWith('REQUIRED_DOCUMENT_MISSING')) return 'Zorunlu belge eksik' + (rest ? ` (${rest})` : '');
  return k + (rest ? ` (${rest})` : '');
}
const ERR = [
  [/SLICE_NOT_READY: ([A-Z_]+(?::\w+)?)/, (m) => 'Dilim başlatılamadı: ' + (waitText(m[1]) ?? m[1])],
  [/PGRST202|Could not find the function|schema cache|42883|42703|42P01|does not exist|PLAN_BACKEND_MISSING/, () => 'Planlama altyapısı (m0155/m0156) bu veritabanında kurulu değil. Kurulum tamamlanınca ekran çalışır.'],
  [/OPERATION_DONE/, () => 'Operasyon tamamlanmış; yeni dilim başlatılamaz.'],
  [/OVER_PLANNED: planlanan (\d+) > hedef (\d+)/, (m) => `Toplam planlama hedefi aşıyor: ${m[1]} > ${m[2]} adet.`],
  [/SLICE_VERSION_CONFLICT|QUEUE_VERSION_CONFLICT/, () => 'Bu kayıt başka bir kullanıcı tarafından değiştirildi. Güncel veriyi yükleyip tekrar deneyin.'],
  [/FORBIDDEN/, () => 'Plan değiştirme yetkiniz yok.'], [/REASON_REQUIRED/, () => 'Gerekçe en az 3 karakter olmalı.'],
  [/SLICE_STARTED_IMMUTABLE|SLICE_TERMINAL/, () => 'Başlamış veya kapanmış dilim değiştirilemez.'], [/SLICE_STARTED_CANNOT_CANCEL/, () => 'Başlamış dilim iptal edilemez; kapatılır.'],
  [/MACHINE_NOT_ALLOWED_FOR_OPERATION/, () => 'Bu makine bu operasyon için rotada izinli değil.'], [/MACHINE_NOT_ELIGIBLE/, () => 'Hedef makine devre dışı (arızalı).'],
  [/SHIFT_NOT_PRODUCTION/, () => 'Bu vardiya üretim vardiyası değil.'], [/BAD_SPLIT_QTY/, () => 'Bölme miktarı geçersiz.'],
  [/ONLY_UNSTARTED_SLICES_CAN_BE_MERGED/, () => 'Yalnız başlamamış dilimler birleştirilebilir.'], [/MERGE_REQUIRES_SAME_OPERATION_AND_MACHINE/, () => 'Birleştirme için aynı operasyon ve makine gerekir.'],
  [/ORDER_MUST_CONTAIN_ALL_PLANNED_SLICES_ONCE/, () => 'Sıralama listesi güncel değil; yenileyin.'], [/duplicate key|one_started/, () => 'Bu operasyonda zaten başlamış bir dilim var.'],
  [/SLICE_ALREADY_STARTED_OR_CLOSED/, () => 'Dilim zaten başlatılmış veya kapanmış.'], [/UNAUTHENTICATED|JWT/, () => 'Oturum süresi dolmuş; yeniden giriş yapın.'],
];
export function errText(e) { const msg = `${e?.code ?? ''} ${e?.message ?? e ?? ''}`.trim(); for (const [re, f] of ERR) { const m = re.exec(msg); if (m) return f(m); } return msg ? `İşlem başarısız: ${msg.slice(0, 160)}` : 'İşlem başarısız.'; }
export const isBackendMissing = (e) => /PGRST202|Could not find the function|schema cache|42883|42703|42P01|does not exist|PLAN_BACKEND_MISSING/.test(`${e?.code ?? ''} ${e?.message ?? e ?? ''}`);
export const isConflict = (e) => /VERSION_CONFLICT/.test(String(e?.message ?? ''));
// ---- tarih (yerel saat dilimi bağımsız; 'YYYY-MM-DD' metni üzerinde) ----
const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (s, n) => { const d = fromIso(s); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
const MONTH = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const dayLong = (s) => { const d = fromIso(s); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
export const SHIFT_NAME = { TeamK1: '1. vardiya', TeamK2: '2. vardiya' };
export const weekStart = (s) => { const d = fromIso(s); const wd = (d.getUTCDay() + 6) % 7; return addDays(s, -wd); };
const DOW = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const dayLabel = (s) => { const d = fromIso(s); return `${DOW[(d.getUTCDay() + 6) % 7]} ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`; };
export const fmtQty = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('tr-TR').format(Number(n)));
export const fmtMin = (n) => (n === null || n === undefined ? 'bilinmiyor' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(n))} dk`);
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }) : null);
