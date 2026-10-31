// m0183 güvenlik + davranış testleri (yerel PG 17, canlı yardımcı fonksiyon kopyalarıyla)
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const MIG = process.argv[2], RB = process.argv[3];
const db = new PGlite();
await db.exec(fs.readFileSync(new URL('./stub.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(MIG, 'utf8'));
const REV = '20000000-0000-0000-0000-00000000000a', OTHER = '20000000-0000-0000-0000-00000000000b', OBS = '20000000-0000-0000-0000-00000000000c';
const E = 'e0000000-0000-0000-0000-00000000000e', A = 'a0000000-0000-0000-0000-00000000000a', V = 'b0000000-0000-0000-0000-00000000000b';
const M109 = '30000000-0000-0000-0000-000000000109', PILOT = '30000000-0000-0000-0000-000000000999';
const DOC = { drawing: '50000000-0000-0000-0000-000000000001', step: '50000000-0000-0000-0000-000000000002', photo: '50000000-0000-0000-0000-000000000003', nc: '50000000-0000-0000-0000-000000000004', tl: '50000000-0000-0000-0000-000000000005', otherDrawing: '50000000-0000-0000-0000-000000000006', withdrawn: '50000000-0000-0000-0000-000000000007' };
const CAM2 = '40000000-0000-0000-0000-000000000002', CAM_OTHER = '40000000-0000-0000-0000-000000000003';
let pass = 0, fail = 0;
async function as(uid, role, sql, params = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ''}', false); set role ${role};`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role;'); }
}
const rpc = async (uid, fn, args) => { const ph = args.map((_, i) => `$${i + 1}`).join(','); const r = await as(uid, 'authenticated', `select kmi_next.${fn}(${ph}) as r`, args); return r[0].r; };
async function t(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '—', e.message); } }
async function rejects(p, re) { try { await p; } catch (e) { if (!re.test(e.message)) throw new Error(`beklenmeyen hata: ${e.message}`); return; } throw new Error('hata bekleniyordu, geçti'); }
const ok = (c, m) => { if (!c) throw new Error(m ?? 'koşul sağlanmadı'); };
const snap = async () => JSON.stringify(await db.query(`select (select json_agg(r order by op_no) from kmi_next.routing_operations r) ro, (select json_agg(w) from kmi_next.work_orders w) wo, (select json_agg(p order by id) from kmi_next.product_revisions p) pr, (select json_agg(d order by id) from kmi_next.documents d) docs, (select json_agg(c order by id) from kmi_next.cam_programs c) cams, (select json_agg(l) from kmi_next.document_op_links l) links`).then((r) => r.rows[0]));
const before = await snap();
const full = { op_name: 'OP10 ön tornalama', machine_id: M109, nc_document_id: DOC.nc, tool_list_document_id: DOC.tl, fixture: 'Ø37 pens', setup_minutes: 40, cycle_seconds: 120, control_plan_note: 'Ø ve boy kontrolü', first_piece_required: true, skill_codes: ['CNC_MILL'], reference_document_ids: [DOC.drawing, DOC.step, DOC.photo] };

// --- güvenlik
await t('anon RPC çağıramaz', () => rejects(as(null, 'anon', `select kmi_next.op_prep_list('${REV}')`), /permission denied/));
await t('authenticated tabloyu doğrudan OKUYAMAZ', () => rejects(as(E, 'authenticated', 'select * from kmi_next.op_prep_drafts'), /permission denied/));
await t('authenticated tabloya doğrudan YAZAMAZ', () => rejects(as(E, 'authenticated', `insert into kmi_next.op_prep_drafts (product_revision_id, slot, created_by, updated_by) values ('${REV}','OP10','${E}','${E}')`), /permission denied/));
await t('yardımcı fonksiyonlar dışarı kapalı', () => rejects(as(E, 'authenticated', `select kmi_next.opp_gate('${REV}','OP10',true)`), /permission denied/));
await t('oturumsuz çağrı reddedilir', () => rejects(rpc(null, 'op_prep_list', [REV]), /UNAUTHENTICATED/));
await t('yetkisiz kullanıcı okuyabilir ama düzenleyemez', async () => { const l = await rpc(V, 'op_prep_list', [REV]); ok(l.can.edit === false && l.can.approve === false); await rejects(rpc(V, 'op_prep_save', [REV, 'OP10', { op_name: 'x' }, null]), /FORBIDDEN: ROUTING_MANAGE/); });
await t('OBSOLETE revizyona yazılamaz', () => rejects(rpc(E, 'op_prep_save', [OBS, 'OP10', { op_name: 'x' }, null]), /REVISION_OBSOLETE/));
await t('rotadaki OP30 için taslak açılamaz', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP30', { op_name: 'x' }, null]), /OPP_SLOT_IN_ROUTING/));
await t('geçersiz slot reddedilir', async () => { await rejects(rpc(E, 'op_prep_save', [REV, 'OP5', {}, null]), /OPP_SLOT_INVALID/); await rejects(rpc(E, 'op_prep_save', [REV, 'XX', {}, null]), /OPP_SLOT_INVALID/); });
await t('bilinmeyen alan reddedilir (status/approved_by istemciden yazılamaz)', async () => { await rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { status: 'APPROVED' }, null]), /OPP_FIELD_UNKNOWN/); await rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { approved_by: E }, null]), /OPP_FIELD_UNKNOWN/); });
await t('başka ürünün belgesi seçilemez', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { reference_document_ids: [DOC.otherDrawing] }, null]), /OPP_DOCUMENT_NOT_ALLOWED/));
await t('geri çekilmiş belge seçilemez', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { reference_document_ids: [DOC.withdrawn] }, null]), /OPP_DOCUMENT_NOT_ALLOWED/));
await t('yanlış tür belge seçilemez (takım listesi NC yerine)', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { nc_document_id: DOC.tl }, null]), /OPP_DOCUMENT_NOT_ALLOWED/));
await t('başka revizyonun CAM kaydı seçilemez', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { cam_program_id: CAM_OTHER }, null]), /OPP_CAM_NOT_ALLOWED/));
await t('pilot makine / bilinmeyen yetkinlik reddedilir', async () => { await rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { machine_id: PILOT }, null]), /OPP_MACHINE_NOT_FOUND/); await rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { skill_codes: ['OLD'] }, null]), /OPP_SKILL_UNKNOWN/); });
await t('negatif/sıfır süre reddedilir', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { cycle_seconds: 0 }, null]), /sıfırdan büyük/));

// --- davranış
let d10;
await t('OP10 kısmi taslak: DRAFT + eksik listesi (otomatik belge ataması YOK)', async () => {
  d10 = await rpc(E, 'op_prep_save', [REV, 'OP10', { op_name: 'OP10 ön tornalama', machine_id: M109 }, null]);
  ok(d10.status === 'DRAFT' && d10.row_version === 1, JSON.stringify(d10));
  ok(d10.nc_document_id === null && d10.cam_program_id === null && d10.tool_list_document_id === null, 'OP30 belgeleri otomatik atanmış!');
  for (const m of ['nc_cam', 'tool_list', 'fixture', 'setup_minutes', 'cycle_seconds', 'control_plan', 'first_piece', 'skills']) ok(d10.missing.includes(m), 'eksik yok: ' + m);
  ok(!d10.missing.includes('op_name') && !d10.missing.includes('machine'));
});
await t('CUT_PREP için NC/CAM ve takım listesi aranmaz', async () => { const c = await rpc(E, 'op_prep_save', [REV, 'CUT_PREP', { op_name: 'Testere kesim' }, null]); ok(!c.missing.includes('nc_cam') && !c.missing.includes('tool_list')); });
await t('eksik varken TEKNİK İNCELEMEYE HAZIR yapılamaz', () => rejects(rpc(E, 'op_prep_set_status', [REV, 'OP10', 'READY_FOR_REVIEW', 1, null]), /OPP_INCOMPLETE/));
await t('eşzamanlı düzenleme koruması (eski sürüm reddedilir)', () => rejects(rpc(E, 'op_prep_save', [REV, 'OP10', { fixture: 'x' }, 99]), /OPP_CONFLICT/));
await t('tüm alanlar dolu: eksik 0', async () => { d10 = await rpc(E, 'op_prep_save', [REV, 'OP10', full, 1]); ok(d10.missing.length === 0 && d10.row_version === 2, JSON.stringify(d10.missing)); ok(d10.reference_document_ids.length === 3); });
await t('değişiklik yoksa sürüm artmaz, geçmişe yazılmaz', async () => { const n0 = (await db.query(`select count(*)::int n from kmi_next.audit_log`)).rows[0].n; const r = await rpc(E, 'op_prep_save', [REV, 'OP10', full, 2]); ok(r.unchanged === true && r.row_version === 2); const n1 = (await db.query(`select count(*)::int n from kmi_next.audit_log`)).rows[0].n; ok(n0 === n1); });
await t('editör ONAYLAYAMAZ (PRODUCT_REV_APPROVE yok)', async () => { await rpc(E, 'op_prep_set_status', [REV, 'OP10', 'READY_FOR_REVIEW', 2, null]); await rejects(rpc(E, 'op_prep_set_status', [REV, 'OP10', 'APPROVED', 3, null]), /FORBIDDEN: PRODUCT_REV_APPROVE/); });
await t('onaylayıcı TEKNİK İNCELEMEYE HAZIR taslağı onaylar', async () => { const r = await rpc(A, 'op_prep_set_status', [REV, 'OP10', 'APPROVED', 3, 'teknik inceleme tamam']); ok(r.status === 'APPROVED' && r.approved_by === A && r.row_version === 4); });
await t('TASLAK doğrudan onaylanamaz', async () => { await rejects(rpc(A, 'op_prep_set_status', [REV, 'CUT_PREP', 'APPROVED', 1, null]), /OPP_STATUS_TRANSITION/); });
await t('onaylı taslak düzenlenince TASLAK\'a döner, onay silinir', async () => { const r = await rpc(E, 'op_prep_save', [REV, 'OP10', { cycle_seconds: 125 }, 4]); ok(r.status === 'DRAFT' && r.approved_by === null && r.approved_at === null && r.row_version === 5); });
await t('ONAYLI rotaya operasyon EKLEMEZ, iş emri/stok/belge/revizyon değişmez', async () => { await rpc(E, 'op_prep_set_status', [REV, 'OP10', 'READY_FOR_REVIEW', 5, null]); await rpc(A, 'op_prep_set_status', [REV, 'OP10', 'APPROVED', 6, null]); ok((await snap()) === before, 'kaynak tablolar değişti!'); });
await t('değişiklik geçmişi sunucuda: eski/yeni değer + kullanıcı', async () => { const h = await rpc(V, 'op_prep_history', [REV, 'OP10']); ok(h.length >= 7, 'kayıt sayısı ' + h.length); const sv = h.find((x) => x.action === 'OP_PREP_SAVED' && x.before?.cycle_seconds === 120 && x.after?.cycle_seconds === 125); ok(sv && sv.actor === E, 'eski→yeni kaydı yok'); ok(h.some((x) => x.action === 'OP_PREP_STATUS_APPROVED' && x.actor === A)); });
await t('geçmiş değiştirilemez (audit_log append-only)', () => rejects(db.query(`update kmi_next.audit_log set reason = 'x'`), /append-only/));
await t('ürün zaman çizelgesine olay yazılır; APPROVED "rota RELEASE değildir" ibaresiyle', async () => { const r = await db.query(`select reason from kmi_next.product_events where event = 'OP_PREP_STATUS' and after_state->>'to' = 'APPROVED' limit 1`); ok(/RELEASE/.test(r.rows[0].reason)); });
await t('liste: taslaklar + seçilebilir belgeler + OP30 bağlantı bilgisi', async () => { const l = await rpc(E, 'op_prep_list', [REV]); ok(l.drafts.length === 2 && l.drafts[0].slot === 'CUT_PREP'); const nc = l.documents.find((x) => x.id === DOC.nc); ok(nc.linkedOps.includes(30) && nc.versionNo === 2); ok(!l.documents.some((x) => x.id === DOC.otherDrawing || x.id === DOC.withdrawn)); ok(l.camPrograms.find((c) => c.id === CAM2).linkedOps.includes(30)); ok(!l.machines.some((m) => m.id === PILOT)); ok(l.can.edit && !l.can.approve); });
await t('OP30 belgesi AÇIKÇA seçilirse kabul edilir (otomatik değil, kullanıcı kararı)', async () => { const r = await rpc(E, 'op_prep_save', [REV, 'OP20', { cam_program_id: CAM2 }, null]); ok(r.cam_program_id === CAM2); });
// --- geri dönüş
await t('geri dönüş: tablo/fonksiyonlar kalkar, son hal audit_log\'da kalır, kaynaklar değişmez', async () => {
  await db.exec(fs.readFileSync(RB, 'utf8'));
  ok((await db.query(`select to_regclass('kmi_next.op_prep_drafts') r`)).rows[0].r === null);
  ok((await db.query(`select count(*)::int n from pg_proc where proname like 'op_prep%' or proname like 'opp\\_%'`)).rows[0].n === 0);
  ok((await db.query(`select count(*)::int n from kmi_next.audit_log where action = 'OP_PREP_ROLLBACK_SNAPSHOT'`)).rows[0].n === 3);
  ok((await snap()) === before);
});
await t('geri dönüşten sonra migration yeniden uygulanabilir', async () => { await db.exec(fs.readFileSync(MIG, 'utf8')); const l = await rpc(E, 'op_prep_list', [REV]); ok(l.drafts.length === 0); });
console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
