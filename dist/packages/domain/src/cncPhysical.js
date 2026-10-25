// KANONİK fiziksel CNC durumu değerlendiricisi — Komuta, ana sayfa, Üretim Masası, KMI LIVE ve Makine Detayı AYNI fonksiyonu kullanır (saf, DOM yok).
// KAVRAMLAR AYRI: (1) makine kullanılabilirliği = kayıt (machines.status), (2) fiziksel CNC durumu = denetleyici verisi (cnc_live_states),
// (3) planlama meşguliyeti = operasyon/dilim. Biri ötekinden TÜRETİLMEZ. CNC kanıtı yoksa fiziksel durum "bilinmiyor"dur.

export const PHYS_STATES = {
  ALARM_ESTOP: { label: 'ALARM / E-STOP', kind: 'bad' },
  RUNNING: { label: 'ÇALIŞIYOR', kind: 'ok' },
  IDLE_STOPPED: { label: 'BOŞTA / DURUYOR', kind: 'info' },
  OFFLINE: { label: 'ÇEVRİMDIŞI (CNC verisi bayat)', kind: 'warn' },
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

/** cnc = cnc_live_states satırı (camelCase: link, state, ageS, lastSourceTs, estop, alarm …) ya da null/undefined. */
export function physicalState(cnc) {
  if (!cnc || typeof cnc !== 'object') return { key: 'UNKNOWN', ...PHYS_STATES.UNKNOWN, reason: 'CNC bağlantısı / canlı veri yok' };
  const link = safeText(cnc.link); const state = safeText(cnc.state);
  if (link !== 'UP') return { key: 'OFFLINE', ...PHYS_STATES.OFFLINE, reason: 'CNC verisi güncel değil — son durum geçerli sayılmaz' };
  const hasTsKeys = Object.prototype.hasOwnProperty.call(cnc, 'lastSourceTs') || Object.prototype.hasOwnProperty.call(cnc, 'ageS'); // gerçek satırda anahtarlar vardır; boşsa kanıt yok
  if (hasTsKeys && !ts(cnc.lastSourceTs) && num(cnc.ageS) === null) return { key: 'UNKNOWN', ...PHYS_STATES.UNKNOWN, reason: 'CNC verisinin zaman damgası yok' };
  if (state === 'CNC_ALARM' || safeText(cnc.estop) === 'TRIGGERED') return { key: 'ALARM_ESTOP', ...PHYS_STATES.ALARM_ESTOP, reason: 'CNC alarm veya acil stop bildiriyor' };
  if (state === 'CNC_ACTIVE') return { key: 'RUNNING', ...PHYS_STATES.RUNNING, reason: 'CNC program koşuyor (denetleyici bildiriyor)' };
  if (state === 'CNC_STOPPED' || state === 'CNC_INTERRUPTED' || state === 'CNC_FEED_HOLD') return { key: 'IDLE_STOPPED', ...PHYS_STATES.IDLE_STOPPED, reason: CNC_STATE_TR[state] };
  return { key: 'UNKNOWN', ...PHYS_STATES.UNKNOWN, reason: 'CNC durumu tanınmıyor' };
}

export function ageText(sec) {
  const s = num(sec); if (s === null || s < 0) return null;
  if (s < 90) return `${Math.round(s)} sn önce`; if (s < 5400) return `${Math.round(s / 60)} dk önce`; if (s < 172800) return `${Math.round(s / 3600)} sa önce`; return `${Math.round(s / 86400)} gün önce`;
}

/** Okunur satırlar [{k, v}] — yalnız güvenle metne çevrilebilen alanlar; eksik alan satır üretmez. */
export function cncLines(cnc, now = new Date()) {
  const p = physicalState(cnc); const rows = [];
  rows.push({ k: 'Durum', v: p.label, kind: p.kind });
  if (!cnc || typeof cnc !== 'object') return { phys: p, rows };
  const link = safeText(cnc.link); rows.push({ k: 'Bağlantı', v: link === 'UP' ? 'Bağlı (güncel)' : 'Bağlantı yok / bayat' });
  const last = ts(cnc.lastSourceTs); const age = num(cnc.ageS) ?? (last ? Math.max(0, (now.getTime() - last.getTime()) / 1000) : null);
  if (last || age !== null) rows.push({ k: 'Son veri', v: `${last ? last.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }) : '—'}${ageText(age) ? ` (${ageText(age)})` : ''}` });
  const st = safeText(cnc.state); if (st) rows.push({ k: 'Denetleyici durumu', v: CNC_STATE_TR[st] ?? st });
  const mode = safeText(cnc.mode); if (mode) rows.push({ k: 'Mod', v: mode });
  const prog = safeText(cnc.program); if (prog) rows.push({ k: 'Program', v: prog });
  const rpm = num(cnc.spindleRpm); if (rpm !== null) rows.push({ k: 'Mil devri', v: `${Math.round(rpm)} dev/dk` });
  const alarm = safeText(cnc.alarm); if (alarm) rows.push({ k: 'Alarm', v: alarm, kind: 'bad' });
  const estop = safeText(cnc.estop); if (estop) rows.push({ k: 'E-STOP', v: estop });
  return { phys: p, rows };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** m parametresi: UUID veya makine kodu (101, 102…). machines = [{id, code}]. → {machine} | {error: 'MISSING'|'NOT_FOUND'|'AMBIGUOUS'} */
export function resolveMachine(machines, param) {
  const p = safeText(param); if (!p) return { error: 'MISSING' };
  const list = Array.isArray(machines) ? machines : [];
  if (UUID.test(p)) { const m = list.find((x) => String(x.id).toLowerCase() === p.toLowerCase()); return m ? { machine: m } : { error: 'NOT_FOUND' }; }
  const hits = list.filter((x) => safeText(x.code) !== null && String(x.code).trim().toLowerCase() === p.toLowerCase());
  if (hits.length === 1) return { machine: hits[0] };
  return { error: hits.length > 1 ? 'AMBIGUOUS' : 'NOT_FOUND' };
}
