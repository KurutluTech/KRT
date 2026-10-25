// İş Emri Aç — ön kontrol modeli (saf fonksiyonlar, DOM yok). Veriyi sunucudan okunan satırlardan KURAR; hiçbir değer uydurmaz.
// Üç işlem AYRI kapılardır: (1) yeni ana iş emri aç  (2) mevcut iş emrine rota uygula  (3) üretim START. Bu ekran yalnız (1) ve (2)'yi yapar; START burada YAPILMAZ.
import { physicalState } from '../../../../../packages/domain/src/cncPhysical.js';

export const OWNER = {
  revision: 'Mühendislik / CAM', bom: 'Mühendislik', material: 'Planlama / Teknik', route: 'CAM / Planlama', cam: 'CAM', tools: 'Takımhane / CAM',
  quality: 'Kalite', machine: 'Bakım / Üretim yönetimi', operator: 'Yönetim / Planlama', hold: 'Yönetim / Kalite',
};
const ST = { OK: 'Hazır', MISSING: 'Eksik', WARN: 'Uyarı', BLOCKED: 'Engelli', UNKNOWN: 'Doğrulanamadı' };
export const STATUS_LABEL = ST;
const C = (key, title, status, detail, owner, action) => ({ key, title, status, label: ST[status], detail, owner: status === 'OK' ? null : owner, action: status === 'OK' ? null : action });
const num = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n; };
export const ACTIVE_WO = (s) => s && !['COMPLETED', 'CANCELLED'].includes(s);
export const opLabel = (o) => (o.opKind === 'CUT_PREP' ? 'CUT/PREP' : `OP${o.opNo}`);

/** Çubuk başına adet — sunucudaki cutprep_pieces_per_bar ile AYNI formül; end_trim/kerf boşsa hesap YOK (null). */
export function piecesPerBar(bar) {
  if (!bar) return null; const L = num(bar.barLengthMm), c = num(bar.cutLengthMm), k = num(bar.kerfMm), t = num(bar.endTrimMm);
  if (!(L > 0) || !(c > 0) || k === null || k < 0 || t === null || t < 0 || !(L - t > 0)) return null;
  const n = Math.floor((L - t) / (c + k)); return n >= 1 ? n : null;
}

/** blockers: 'REQ_UNDECLARED:OP10' | 'REQ_MISSING:OP10:TOOL_LIST' | 'CUT_SPEC_MISSING:CUT/PREP' (sunucu: routing_readiness_blockers) */
export function buildPrecheck(i) {
  const checks = []; const wo = (i.wos ?? []).find((w) => ACTIVE_WO(w.status)) ?? null; const rev = i.revision ?? null;
  const routing = (i.routing ?? []).filter((r) => r.active !== false); const woOps = i.woOps ?? [];
  // 1 Revizyon
  if (!rev) checks.push(C('revision', 'Revizyon', 'MISSING', 'Ürüne bağlı revizyon bulunamadı.', OWNER.revision, 'Revizyonu oluştur ve yayınla'));
  else if (rev.status !== 'RELEASED') checks.push(C('revision', 'Revizyon', 'BLOCKED', `Rev ${rev.revision ?? ''} durumu ${rev.status}; yalnız YAYINLANMIŞ revizyon kullanılır.`, OWNER.revision, 'Revizyonu yetkili akışla yayınla'));
  else checks.push(C('revision', 'Revizyon', 'OK', `Rev ${rev.revision ?? ''} yayınlanmış.${wo && wo.productRevisionId && wo.productRevisionId !== rev.id ? ' UYARI: iş emri farklı revizyona bağlı.' : ''}`));
  // 2 BOM
  const badBom = (i.bom ?? []).filter((l) => !String(l.materialCode ?? '').trim() || !(num(l.qtyPerUnit) > 0));
  if (!(i.bom ?? []).length) checks.push(C('bom', 'BOM', 'MISSING', 'BOM satırı yok.', OWNER.bom, 'Hammaddeyi BOM\'a ekle'));
  else if (badBom.length) checks.push(C('bom', 'BOM', 'MISSING', `${badBom.length} satırda malzeme veya miktar eksik.`, OWNER.bom, 'BOM satırını düzelt'));
  else checks.push(C('bom', 'BOM', 'OK', `${i.bom.length} satır: ${i.bom.map((l) => l.materialCode).join(', ')}`));
  // 3 Hammadde ve kesim parametreleri
  const b = i.bar ?? null; const ppb = piecesPerBar(b);
  if (!b) checks.push(C('material', 'Hammadde ve kesim parametreleri', 'MISSING', 'Çubuk/kesim kaydı yok.', OWNER.material, 'Çap, boy, kesim boyu, kerf ve uç payı gir'));
  else if (num(b.endTrimMm) === null) checks.push(C('material', 'Hammadde ve kesim parametreleri', 'BLOCKED', `Ø${b.diaMm ?? '?'} × ${b.barLengthMm ?? '?'} mm, kesim ${b.cutLengthMm ?? '?'} mm, kerf ${b.kerfMm ?? '?'} mm; end_trim_mm BOŞ — çubuk başına adet hesaplanamaz.`, OWNER.material, 'end_trim_mm değerini ölçüm/onayla gir (yetkili GO ile)'));
  else if (ppb === null) checks.push(C('material', 'Hammadde ve kesim parametreleri', 'BLOCKED', 'Parametrelerle çubuk başına en az 1 parça çıkmıyor.', OWNER.material, 'Parametreleri düzelt'));
  else { const need = num(wo?.qtyPlanned ?? i.item?.qty); checks.push(C('material', 'Hammadde ve kesim parametreleri', 'OK', `Ø${b.diaMm} × ${b.barLengthMm} mm, kesim ${b.cutLengthMm} mm, kerf ${b.kerfMm} mm, uç payı ${b.endTrimMm} mm → ${ppb} adet/çubuk${need ? `; ${need} adet için ${Math.ceil(need / ppb)} çubuk` : ''}.`)); }
  // 4 Rota
  const rb = i.routeBlockers; const applied = woOps.length > 0;
  if (rb === null || rb === undefined) checks.push(C('route', 'Rota', 'UNKNOWN', 'Rota doğrulaması okunamadı.', OWNER.route, 'Yeniden dene'));
  else if (!routing.length) checks.push(C('route', 'Rota', 'MISSING', 'Aktif rota operasyonu yok.', OWNER.route, 'Rotayı tanımla'));
  else if (rb.length) checks.push(C('route', 'Rota', 'BLOCKED', `Rota geçersiz: ${rb.join(', ')}. Mevcut: ${routing.map(opLabel).join(' → ')}.`, OWNER.route, 'Rev A rotasını yetkili revizyon değişikliği akışıyla tamamla (CUT/PREP 101 + OP10…)'));
  else checks.push(C('route', 'Rota', 'OK', `${routing.map(opLabel).join(' → ')}${applied ? ` · iş emrine ${woOps.length} operasyon uygulanmış` : ' · henüz iş emrine uygulanmadı'}`));
  // 5 CAM
  const camBy = new Map((i.cam ?? []).map((c) => [c.routingOperationId, c]));
  const noCam = routing.filter((r) => r.opKind !== 'CUT_PREP' && !camBy.get(r.id));
  if (!routing.length) checks.push(C('cam', 'CAM programı', 'UNKNOWN', 'Rota yok; CAM kontrol edilemedi.', OWNER.cam, 'Önce rotayı tamamla'));
  else if (noCam.length) checks.push(C('cam', 'CAM programı', 'MISSING', `CAM programı olmayan: ${noCam.map(opLabel).join(', ')}.`, OWNER.cam, 'Operasyona CAM programı bağla ve onayla'));
  else { const unrel = [...camBy.values()].filter((c) => c.status && c.status !== 'RELEASED'); checks.push(unrel.length ? C('cam', 'CAM programı', 'WARN', `${unrel.length} programın durumu RELEASED değil.`, OWNER.cam, 'Programı yayınla') : C('cam', 'CAM programı', 'OK', 'Tüm programlar bağlı ve yayınlı.')); }
  // 6 Takımlar ve fikstürler (sunucu readiness: REQ_*)
  const rd = i.readinessBlockers;
  if (rd === null || rd === undefined) checks.push(C('tools', 'Takımlar ve fikstürler', 'UNKNOWN', 'Hazırlık şartları okunamadı.', OWNER.tools, 'Yeniden dene'));
  else { const req = rd.filter((x) => x.startsWith('REQ_')); checks.push(req.length ? C('tools', 'Takımlar ve fikstürler', 'MISSING', `Şart beyanı/eksik belge: ${req.map((x) => x.replace('REQ_UNDECLARED:', 'beyan yok ').replace('REQ_MISSING:', 'eksik ')).join(', ')}.`, OWNER.tools, 'Operasyon şartlarını (takım listesi, fikstür) beyan et ve belgeyi ekle') : C('tools', 'Takımlar ve fikstürler', 'OK', 'Tüm operasyon şartları beyan edilmiş ve belgeleri mevcut.')); }
  // 7 Kalite / ilk parça
  const qcOps = routing.filter((r) => r.firstPieceRequired || r.qcRequired);
  checks.push(routing.length ? C('quality', 'Kalite / ilk parça kontrolü', qcOps.length ? 'WARN' : 'OK', qcOps.length ? `${qcOps.map(opLabel).join(', ')}: ilk parça/kalite onayı üretimde ZORUNLU (START sonrası kalite onayı gerekir).` : 'Kalite zorunluluğu tanımlı değil.', OWNER.quality, 'Kalite kontrol noktalarını ve ilk parça kriterini doğrula') : C('quality', 'Kalite / ilk parça kontrolü', 'UNKNOWN', 'Rota yok.', OWNER.quality, 'Önce rotayı tamamla'));
  // 8 Makine uygunluğu (kayıt + fiziksel CNC; ayrı kavramlar)
  const mById = new Map((i.machines ?? []).map((m) => [m.id, m])); const ids = [...new Set((applied ? woOps.map((o) => o.plannedMachineId) : routing.map((r) => r.primaryMachineId ?? (r.allowedMachineIds?.length === 1 ? r.allowedMachineIds[0] : null))).filter(Boolean))];
  const mrows = ids.map((id) => { const m = mById.get(id); const phys = physicalState(i.cnc?.[m?.code] ?? null); return { id, code: m?.code ?? id.slice(0, 8), status: m?.status ?? null, phys }; });
  const alarm = mrows.filter((m) => m.phys.key === 'ALARM_ESTOP'); const down = mrows.filter((m) => m.status && m.status !== 'UP');
  if (!mrows.length) checks.push(C('machine', 'Makine uygunluğu', 'UNKNOWN', 'Operasyonlara atanmış makine yok.', OWNER.machine, 'Rotada makine ata'));
  else if (alarm.length) checks.push({ ...C('machine', 'Makine uygunluğu', 'BLOCKED', `${alarm.map((m) => m.code).join(', ')}: gerçek ALARM / E-STOP — giderilmeden START YOK.`, OWNER.machine, 'Bakım: alarmı gider, test et, yetkili RELEASE ver'), machines: mrows });
  else if (down.length) checks.push({ ...C('machine', 'Makine uygunluğu', 'BLOCKED', `Kayıtta kullanılamaz: ${down.map((m) => `${m.code} (${m.status})`).join(', ')}.`, OWNER.machine, 'Makine kaydını güncelle / bakımı bitir'), machines: mrows });
  else checks.push({ ...C('machine', 'Makine uygunluğu', mrows.some((m) => m.phys.key !== 'RUNNING' && m.phys.key !== 'IDLE_STOPPED') ? 'WARN' : 'OK', mrows.map((m) => `${m.code}: kayıt ${m.status ?? '?'}, ${m.phys.key === 'UNKNOWN' ? 'fiziksel durum bilinmiyor' : 'fiziksel ' + m.phys.label}`).join(' · '), OWNER.machine, 'Fiziksel durumu doğrula (CNC verisi olmayan makine "bilinmiyor" kalır)'), machines: mrows });
  // 9 Operatör ve vardiya
  const ops = applied ? woOps : [];
  const unassigned = ops.filter((o) => !o.assignedOperatorId);
  if (!applied) checks.push(C('operator', 'Operatör ve vardiya', 'UNKNOWN', 'Operasyonlar henüz oluşmadı; atama rota uygulandıktan sonra operasyon düzeyinde yapılır.', OWNER.operator, 'Önce rotayı uygula'));
  else if (unassigned.length) checks.push(C('operator', 'Operatör ve vardiya', 'MISSING', `Operatörü atanmamış: ${unassigned.map(opLabel).join(', ')}. Gerçek personel seçimini yetkili yönetici onaylar.`, OWNER.operator, 'Operasyon başına yetkinlik/vardiya uygun operatörü ata'));
  else checks.push(C('operator', 'Operatör ve vardiya', 'OK', 'Tüm operasyonlara operatör atanmış.'));
  // 10 HOLD
  if (wo && wo.status === 'ON_HOLD') checks.push(C('hold', 'ON_HOLD gerekçesi', 'BLOCKED', i.hold?.reason && !/^İş emri merkezi: ON_HOLD$/.test(i.hold.reason) ? `Gerekçe: ${i.hold.reason}` : 'İş emri ON_HOLD; kayıtlı gerekçe yalnızca genel bir durum geçişi — gerçek bekletme nedeni DOĞRULANMADI.', OWNER.hold, 'Gerekçeyi yetkili kişiden doğrula; release yalnız yetkili GO ile'));
  else checks.push(C('hold', 'ON_HOLD gerekçesi', 'OK', wo ? `İş emri durumu ${wo.status}; bekletme yok.` : 'İş emri yok.'));

  // ---- kapılar (ayrı yetki + durum) ----
  const need = num(i.item?.qty) !== null ? Math.max(0, num(i.item.qty) - (num(i.item.qtyProduced) ?? 0)) : null;
  const activeQty = (i.wos ?? []).filter((w) => ACTIVE_WO(w.status)).reduce((s, w) => s + (num(w.qtyPlanned) ?? 0) - (num(w.qtyProduced) ?? 0) - (num(w.qtyScrap) ?? 0), 0);
  const openNeed = need === null ? null : Math.max(0, need - activeQty);
  const gates = {};
  gates.create = wo ? { allowed: false, code: 'EXISTING_WO', reason: `Bu kalemde açık ana iş emri var (${wo.status}). "Mevcut iş emrine devam et" kullanılır; ikinci ana iş emri açılmaz.` }
    : !i.canCreate ? { allowed: false, code: 'NO_PERMISSION', reason: 'İş emri açma yetkisi yok (yönetici).' }
      : openNeed !== null && openNeed <= 0 ? { allowed: false, code: 'NO_OPEN_NEED', reason: 'Açık üretim ihtiyacı yok.' } : { allowed: true, maxQty: openNeed };
  const revOk = rev?.status === 'RELEASED';
  gates.applyRoute = !wo ? { allowed: false, code: 'NO_WO', reason: 'Önce ana iş emri gerekir.' }
    : applied ? { allowed: false, code: 'ALREADY_APPLIED', reason: `Rota zaten uygulanmış (${woOps.length} operasyon); tekrar uygulamak değişiklik yapmaz.`, idempotent: true }
      : !i.canAssign ? { allowed: false, code: 'NO_PERMISSION', reason: 'Rota uygulama yetkisi yok (yönetici).' }
        : !['PLANNED', 'MACHINE_ASSIGNED', 'ON_HOLD'].includes(wo.status) ? { allowed: false, code: 'STATUS', reason: `İş emri ${wo.status} durumunda; rota uygulanamaz.` }
          : !revOk ? { allowed: false, code: 'REVISION', reason: 'Revizyon yayınlanmış değil.' }
            : (rb?.length || rb == null) ? { allowed: false, code: 'ROUTE', reason: rb == null ? 'Rota doğrulanamadı.' : `Rota geçersiz: ${rb.join(', ')}` } : { allowed: true, onHold: wo.status === 'ON_HOLD' };
  const startBlock = [];
  if (!wo) startBlock.push('İş emri yok'); else if (wo.status === 'ON_HOLD') startBlock.push('İş emri ON_HOLD (gerekçe + yetkili release gerekir)');
  if (wo && !applied) startBlock.push('Rota uygulanmadı');
  for (const c of checks) if (['BLOCKED', 'MISSING'].includes(c.status) && !['hold'].includes(c.key)) startBlock.push(`${c.title}: ${c.label}`);
  for (const c of checks) if (c.status === 'UNKNOWN' && ['route', 'tools', 'machine'].includes(c.key)) startBlock.push(`${c.title}: doğrulanamadı`);
  gates.start = { allowed: false, performedHere: false, reasons: [...new Set(startBlock)], note: 'START bu ekranda yapılmaz; yetkili release sonrası atanmış operatör kendi operasyonunda başlatır.' };
  if (!startBlock.length && wo) gates.start.note = 'Tüm kapılar açık görünüyor; START yine bu ekranda değil, operasyon ekranından, atanmış operatörle yapılır.';
  return { checks, gates, existing: wo, openNeed, applied, ppb, summary: { total: checks.length, ok: checks.filter((c) => c.status === 'OK').length, blocked: checks.filter((c) => c.status === 'BLOCKED').length, missing: checks.filter((c) => c.status === 'MISSING').length } };
}

/** Operatör adayı: yalnız gerçek, aktif, OPERATOR rolü + ÜRETİM bölümü; test hesapları dışarıda; yetkinlik/vardiya verisi yoksa AÇIKÇA "doğrulanmadı". Otomatik atama YOK. */
export function operatorCandidates(personnel, skillsByPerson = {}, clearances = {}) {
  return (personnel ?? []).filter((p) => p.active !== false && (p.roles ?? []).includes('OPERATOR') && !/^test\b/i.test(String(p.name ?? '')) && p.department === 'URETIM')
    .map((p) => ({ id: p.id, name: p.name, shiftCode: p.shiftCode ?? null, shiftKnown: !!p.shiftCode, skills: skillsByPerson[p.id] ?? [], hasClearance: !!clearances[p.id],
      verified: !!p.shiftCode && (skillsByPerson[p.id] ?? []).length > 0 })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
