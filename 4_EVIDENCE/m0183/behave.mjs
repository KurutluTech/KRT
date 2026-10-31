import assert from 'assert/strict';
const D = '/home/claude/krt/dist/packages/domain/src/';
const { diffRows, camText, camRevText } = await import(D + 'routeChangeFormat.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS', name); };
const P = (v) => ({ unit: 'sn/parça', value: v, valid_from: '2026-10-20', version_no: 1 });
const cams = new Map([['c1', { programNo: '1453.nc', revision: 'v1' }], ['c2', { programNo: '1453_EXCELE_GORE_BASLIK_ASCII.nc', revision: 'v2' }]]);
const ctx = { machines: new Map(), cams, ops: new Map() };
t('camRevText: v2 → v2', () => assert.equal(camRevText('v2'), 'v2'));
t('camRevText: 2 → v2', () => assert.equal(camRevText('2'), 'v2'));
t('camRevText: "rev v2" / "r2" / "V2" / "vv2" → v2', () => { for (const x of ['rev v2', 'r2', 'V2', 'vv2', 'Rev 2']) assert.equal(camRevText(x), 'v2', x); });
t('camRevText: boş/null → boş', () => { assert.equal(camRevText(null), ''); assert.equal(camRevText(''), ''); });
t('camText canlı CAM v2: tek v', () => { const s = camText('c2', ctx); assert.equal(s, '1453_EXCELE_GORE_BASLIK_ASCII.nc · v2'); assert.ok(!/v\s*v|sürüm v/i.test(s)); });
// canlı sürüm 3 (OP30): çevrim 288 hem sütunda hem parametrede
const v3 = { changedKeys: ['cycle_seconds_target', 'params', 'primary_machine_id', 'set_at', 'setup_minutes_target'],
  beforeState: { cycle_seconds_target: null, setup_minutes_target: null, params: {}, primary_machine_id: null },
  afterState: { cycle_seconds_target: 288, setup_minutes_target: 45, params: { OP_CYCLE_SEC: P(288), OP_SETUP_MIN: { unit: 'dk', value: 45 } }, primary_machine_id: null } };
t('sürüm 3: çevrim tek satır (birimli)', () => { const r = diffRows(v3, ctx); const c = r.filter((x) => /Çevrim/.test(x.label)); assert.equal(c.length, 1, JSON.stringify(r)); assert.match(c[0].to, /288 sn\/parça/); });
t('sürüm 3: hazırlık tek satır', () => { const r = diffRows(v3, ctx); assert.equal(r.filter((x) => /Hazırlık/.test(x.label)).length, 1, JSON.stringify(r)); });
t('farklı değerler: iki satır KORUNUR (gerçek tutarsızlık gizlenmez)', () => {
  const r = diffRows({ ...v3, afterState: { ...v3.afterState, cycle_seconds_target: 300 } }, ctx); assert.equal(r.filter((x) => /Çevrim/.test(x.label)).length, 2); });
t('yalnız sütun değiştiyse satır görünür', () => {
  const r = diffRows({ changedKeys: ['cycle_seconds_target'], beforeState: { cycle_seconds_target: 280, params: { OP_CYCLE_SEC: P(288) } }, afterState: { cycle_seconds_target: 288, params: { OP_CYCLE_SEC: P(288) } } }, ctx);
  assert.equal(r.length, 1); assert.equal(r[0].label, 'Çevrim (sn)'); });
t('yalnız parametre değiştiyse satır görünür', () => {
  const r = diffRows({ changedKeys: ['params'], beforeState: { params: {} }, afterState: { params: { OP_INSPECTION_SEC: P(30) } } }, ctx); assert.equal(r.length, 1); assert.equal(r[0].label, 'Muayene'); });
t('sürüm 5: CAM v1 → v2, tek v', () => {
  const r = diffRows({ changedKeys: ['cam_program_id', 'set_at'], beforeState: { cam_program_id: 'c1' }, afterState: { cam_program_id: 'c2' } }, ctx);
  assert.equal(r.length, 1); assert.equal(r[0].from, '1453.nc · v1'); assert.equal(r[0].to, '1453_EXCELE_GORE_BASLIK_ASCII.nc · v2'); });
t('girdi nesneleri değiştirilmez (geçmiş salt okunur)', () => { const s = JSON.stringify(v3); diffRows(v3, ctx); assert.equal(JSON.stringify(v3), s); });
console.log(`${n}/${n} PASS`);
