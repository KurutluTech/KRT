// KANONİK fiziksel CNC durumu değerlendiricisi — Komuta, ana sayfa, Üretim Masası, KMI LIVE ve Makine Detayı AYNI fonksiyonu kullanır (saf, DOM yok).
// KAVRAMLAR AYRI: (1) makine kullanılabilirliği = kayıt (machines.status), (2) fiziksel CNC durumu = denetleyici verisi (cnc_live_states),
// (3) planlama meşguliyeti = operasyon/dilim. Biri ötekinden TÜRETİLMEZ. CNC kanıtı yoksa fiziksel durum "bilinmiyor"dur.

import { adjustCnc, cncDisplay, hasCncReceiptEvidence, cncClock } from './cncTelemetry.js';

export const PHYS_STATES = {
  ALARM_ESTOP: { label: 'ALARM / E-STOP', kind: 'bad' },
  RUNNING: { label: 'ÇALIŞIYOR', kind: 'ok' },
  IDLE_STOPPED: { label: 'BOŞTA / DURUYOR', kind: 'info' },
  OFFLINE: { label: 'BİLİNMİYOR · CNC verisi BAYAT', kind: 'warn' },
  UNKNOWN: { label: 'Fiziksel durum bilinmiyor', kind: 'unknown' },
};
const CNC_STATE_TR = { CNC_ACTIVE: 'Program koşuyor', CNC_STOPPED: 'Duruyor', CNC_FEED_HOLD: 'Feed hold (ilerleme durdu)', CNC_INTERRUPTED: 'Kesinti', CNC_ALARM: 'Alarm / acil stop' };

// metin güvenliği: nesne/dizi asla "[object Object]" olmaz; boş/geçersiz → null
export function safeText(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; }
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  if (typeof v === 'boolean') return v ? 'evet' : 'hayır';
  return null;
}
const num = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n; };
const ts = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// 2N-1: stale / unreachable / never-received are NOT "no CNC record": the key stays OFFLINE (physical state UNKNOWN, last values only as history) and the label says WHY; "no record at all" stays UNKNOWN.
const OFFLINE_LABEL = { STALE: 'BİLİNMİYOR · CNC verisi BAYAT', CNC_DOWN: 'BİLİNMİYOR · CNC\'ye ulaşılamıyor', NEVER: 'BİLİNMİYOR · henüz CNC verisi yok' };
const OFFLINE_REASON = { STALE: 'CNC verisi güncel değil — son durum geçerli sayılmaz', CNC_DOWN: 'Toplayıcı çalışıyor ama CNC\'ye ulaşamıyor — son durum geçerli sayılmaz', NEVER: 'Bu cihazdan henüz veri gelmedi' };
const hasReceiptEvidence = hasCncReceiptEvidence;   // ONE definition (cncTelemetry): server receipt only, never the CNC device clock

/** cnc = cnc_live_states satırı (camelCase: link, state, ageS, lastIngestedAt, estop, alarm …) ya da null/undefined.
 *  Evaluated through the ONE canonical freshness calculation (adjustCnc; idempotent — a raw row, an evaluated row or the same row evaluated again give the same result). `at` = optional explicit reference time {mono, wall}. */
export function physicalState(cnc0, at) {
  if (!cnc0 || typeof cnc0 !== 'object') return { key: 'UNKNOWN', ...PHYS_STATES.UNKNOWN, reason: 'CNC kaydı / bağlantısı yok' };
  const cnc = adjustCnc(cnc0, at ?? cncClock());
  const link = safeText(cnc.link); const state = safeText(cnc.state);
  if (link !== 'UP') return { key: 'OFFLINE', ...PHYS_STATES.OFFLINE, label: OFFLINE_LABEL[link] ?? PHYS_STATES.OFFLINE.label, reason: OFFLINE_REASON[link] ?? OFFLINE_REASON.STALE };
  if (!hasReceiptEvidence(cnc)) return { key: 'UNKNOWN', ...PHYS_STATES.UNKNOWN, reason: 'CNC verisinin sunucuya ulaşma zamanı / yaşı yok — güncelliği kanıtlanamıyor' };
  if (state === 'CNC_ALARM' || safeText(cnc.estop) === 'TRIGGERED') return { key: 'ALARM_ESTOP', ...PHYS_STATES.ALARM_ESTOP, reason: 'CNC alarm veya acil stop bildiriyor' };
  if (state === 'CNC_ACTIVE') return { key: 'RUNNING', ...PHYS_STATES.RUNNING, reason: 'CNC program koşuyor (denetleyici bildiriyor)' };
  if (state === 'CNC_STOPPED' || state === 'CNC_INTERRUPTED' || state === 'CNC_FEED_HOLD') return { key: 'IDLE_STOPPED', ...PHYS_STATES.IDLE_STOPPED, reason: CNC_STATE_TR[state] };
  return { key: 'UNKNOWN', ...PHYS_STATES.UNKNOWN, reason: 'CNC durumu tanınmıyor' };
}

const alarmish = (r) => safeText(r.state) === 'CNC_ALARM' || safeText(r.estop) === 'TRIGGERED';
/** 2N-1 (güvenlik revizyonu) — OPERASYONEL ENGEL, görüntülenen fiziksel durumdan AYRI.
 *  physicalState = "bu an ne biliyoruz" (bayatta BİLİNMİYOR). cncOperationalHold = "bir engel kalkmış sayılabilir mi" — fiziksel durumun bilinmemesi uygunluk kanıtı DEĞİLDİR.
 *  Seviye, 2N-1 öncesi davranışla BİREBİR korunur (yeni engel de eklenmez, mevcut engel de gevşetilmez):
 *   LIVE            = bağlantı UP ve alarm / E-STOP basılı — güncellik kanıtı olsun olmasın (gerçek alarm zaman damgası eksik diye gizlenmez).
 *   LATCHED_EXPIRED = satır alarm / E-STOP ile CANLI çekildi, sonra 45 sn aşıldı: yeni veri gelip temizlemedikçe engel KALKMAZ.
 *   (sunucu tarafında zaten bayat/kesik/hiç gelmemiş satırdaki son bilinen alarm: önceki gibi engel DEĞİL — `lastKnownAlarm` yalnız bilgi.) */
export function cncOperationalHold(cnc0, at0) {
  if (!cnc0 || typeof cnc0 !== 'object') return { hold: false, basis: null, lastKnownAlarm: false };
  const c = adjustCnc(cnc0, at0 ?? cncClock()); const link = safeText(c.link); const al = alarmish(c);
  if (link === 'UP' && al) return { hold: true, basis: 'LIVE', lastKnownAlarm: false };
  if (c.expiredLocally === true && c.cncBase?.link === 'UP' && al) return { hold: true, basis: 'LATCHED_EXPIRED', lastKnownAlarm: true };
  return { hold: false, basis: null, lastKnownAlarm: link !== 'UP' && link !== 'NEVER' && al };
}

export function ageText(sec) {
  const s = num(sec); if (s === null || s < 0) return null;
  if (s < 90) return `${Math.round(s)} sn önce`; if (s < 5400) return `${Math.round(s / 60)} dk önce`; if (s < 172800) return `${Math.round(s / 3600)} sa önce`; return `${Math.round(s / 86400)} gün önce`;
}

/** Okunur satırlar [{k, v}] — yalnız güvenle metne çevrilebilen alanlar; eksik alan satır üretmez.
 *  2N-1: aynı kanonik değerlendirme (physicalState/adjustCnc). Güncellik = sunucuya ulaşma yaşı; CNC cihaz örnek saati AYRI ve "güncellik ölçüsü değildir" etiketiyle.
 *  CANLI olmayan satırda durum/mod/mil/alarm/E-STOP güncel gibi gösterilmez: yalnız tek "SON BİLİNEN — GÜNCEL DEĞİL" satırı. */
export function cncLines(cnc0, now = new Date(), at0) {
  const at = at0 ?? cncClock();   // one instant for the status, the rows and the last-known line
  const p = physicalState(cnc0, at); const rows = [];
  rows.push({ k: 'Durum', v: p.label, kind: p.kind });
  if (!cnc0 || typeof cnc0 !== 'object') return { phys: p, rows };
  const cnc = adjustCnc(cnc0, at);
  const link = safeText(cnc.link); const live = link === 'UP' && hasReceiptEvidence(cnc);
  rows.push({ k: 'Bağlantı', v: link === 'UP' ? (live ? 'Bağlı (güncel)' : 'Bağlı — güncelliği kanıtlanamıyor') : link === 'CNC_DOWN' ? 'CNC\'ye ulaşılamıyor' : link === 'NEVER' ? 'Henüz veri yok' : 'Bağlantı yok / bayat' });
  const recv = ts(cnc.lastIngestedAt); const age = num(cnc.ageS);
  if (recv || age !== null) rows.push({ k: 'Son veri (sunucuya ulaşma)', v: `${recv ? recv.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }) : '—'}${ageText(age) ? ` (${ageText(age)})` : ''}` });
  const dev = ts(cnc.lastSourceTs); if (dev) rows.push({ k: 'CNC cihaz örnek saati (güncellik ölçüsü değildir)', v: dev.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }) });
  if (live) {
    const st = safeText(cnc.state); if (st) rows.push({ k: 'Denetleyici durumu', v: CNC_STATE_TR[st] ?? st });
    const mode = safeText(cnc.mode); if (mode) rows.push({ k: 'Mod', v: mode });
    const prog = safeText(cnc.program); if (prog) rows.push({ k: 'Program', v: prog });
    const rpm = num(cnc.spindleRpm); if (rpm !== null) rows.push({ k: 'Mil devri', v: `${Math.round(rpm)} dev/dk` });
    const alarm = safeText(cnc.alarm); if (alarm) rows.push({ k: 'Alarm', v: alarm, kind: 'bad' });
    const estop = safeText(cnc.estop); if (estop) rows.push({ k: 'E-STOP', v: estop, ...(estop === 'TRIGGERED' ? { kind: 'bad' } : {}) });
  } else if (link !== 'NEVER') {
    const lk = cncDisplay(cnc, at).lastKnown;   // never hidden, never current: history only
    const prog = safeText(lk.program); const when = ts(lk.receivedAt);
    rows.push({ k: 'SON BİLİNEN — GÜNCEL DEĞİL', v: `${lk.safetyLine}${prog ? ` · program ${prog}` : ''}${when ? ` · ${when.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false })} (sunucuya ulaşma)` : ''}`, kind: 'warn' });
  }
  return { phys: p, rows };
}

export function resolveMachine(machines, param) {
  const p = safeText(param); if (!p) return { error: 'MISSING' };
  const list = Array.isArray(machines) ? machines : [];
  if (UUID.test(p)) { const m = list.find((x) => String(x.id).toLowerCase() === p.toLowerCase()); return m ? { machine: m } : { error: 'NOT_FOUND' }; }
  const hits = list.filter((x) => safeText(x.code) !== null && String(x.code).trim().toLowerCase() === p.toLowerCase());
  if (hits.length === 1) return { machine: hits[0] };
  return { error: hits.length > 1 ? 'AMBIGUOUS' : 'NOT_FOUND' };
}
