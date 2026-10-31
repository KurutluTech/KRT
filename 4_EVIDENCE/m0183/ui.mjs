// Hazırlık formu UI testi: gerçek panel kodu (jsdom) + gerçek m0183 SQL (yerel PG). İstemci, canlıdaki gibi yanıt anahtarlarını camelCase'e çevirir.
import { JSDOM } from 'jsdom';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://flow.kurutlu.com/#/rota?urun=x' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
const DIST = '/home/claude/krt/dist/';
const { drawOpPrep } = await import(DIST + 'apps/web/src/screens/opPrepPanel.js');
const { camelizeKeys } = await import(DIST + 'packages/data-client/src/client.js');
const db = new PGlite();
await db.exec(fs.readFileSync(new URL('./stub.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync('/home/claude/krt/2_DB/m0183_op_prep_drafts.sql', 'utf8'));
const REV = '20000000-0000-0000-0000-00000000000a', E = 'e0000000-0000-0000-0000-00000000000e', A = 'a0000000-0000-0000-0000-00000000000a', V = 'b0000000-0000-0000-0000-00000000000b';
const M109 = '30000000-0000-0000-0000-000000000109', NC = '50000000-0000-0000-0000-000000000004', TL = '50000000-0000-0000-0000-000000000005', DRW = '50000000-0000-0000-0000-000000000001';
let calls = [];
const sqlRpc = (uid) => async (fn, args) => {
  calls.push({ fn, args });
  const keys = Object.keys(args); const vals = keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
  await db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role authenticated;`);
  try { const r = await db.query(`select kmi_next.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) r`, vals); return camelizeKeys(r.rows[0].r); }
  catch (e) { throw Object.assign(new Error(e.message), { code: e.code }); } finally { await db.exec('reset role;'); }
};
const apiFor = (uid) => { const rpc = sqlRpc(uid); return {
  opPrepList: (rev) => rpc('op_prep_list', { p_revision: rev }), opPrepSave: (rev, slot, data, ver) => rpc('op_prep_save', { p_revision: rev, p_slot: slot, p_data: data, p_expected_version: ver }),
  opPrepSetStatus: (rev, slot, st, ver, note) => rpc('op_prep_set_status', { p_revision: rev, p_slot: slot, p_status: st, p_expected_version: ver, p_note: note }), opPrepHistory: (rev, slot) => rpc('op_prep_history', { p_revision: rev, p_slot: slot }) }; };
const tick = () => new Promise((r) => setTimeout(r, 30));
const settle = async () => { for (let i = 0; i < 15; i++) await tick(); };
let pass = 0, fail = 0; const ok = (c, m) => { if (!c) throw new Error(m ?? 'koşul sağlanmadı'); };
async function t(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '—', e.message); } }
async function mount(api) { document.body.replaceChildren(); const p = drawOpPrep(document.createElement('div'), api, { revisionId: REV }); document.body.append(p); p.open = true; p.dispatchEvent(new dom.window.Event('toggle')); await settle(); return p; }
const $ = (tid) => document.querySelector(`[data-testid="${tid}"]`);
const setVal = (el, v) => { el.value = v; el.dispatchEvent(new dom.window.Event('change')); };
const click = async (tid) => { $(tid).click(); await settle(); };

await t('açılışta CUT/PREP, OP10, OP20, OP40 görünür; rotadaki OP30 forma girmez', async () => {
  await mount(apiFor(E)); const slots = [...document.querySelectorAll('[data-testid^="opp-slot-"]')].map((x) => x.dataset.testid.replace('opp-slot-', ''));
  ok(JSON.stringify(slots) === JSON.stringify(['CUT_PREP', 'OP10', 'OP20', 'OP40']), slots.join(',')); ok(/OP30/.test($('opp-scope-note').textContent));
  ok([...document.querySelectorAll('[data-testid$="-status"]')].every((x) => x.textContent === 'BAŞLANMADI')); });
await t('kapsam notu: rota/iş emri/üretim oluşturmaz, ONAYLI ≠ RELEASE/GO', async () => { const n = $('opp-scope-note').textContent; ok(/rotaya operasyon eklemez/.test(n) && /RELEASE/.test(n) && /GO değildir/.test(n)); });
await t('CUT/PREP kartında NC/CAM/takım listesi alanı yok', async () => { ok(!$('opp-CUT_PREP-nc') && !$('opp-CUT_PREP-cam') && !$('opp-CUT_PREP-tl') && $('opp-OP10-nc')); });
await t('OP10\'da OP30 belgeleri otomatik seçili DEĞİL; seçilince "OP30\'a bağlı" uyarısı', async () => {
  ok($('opp-OP10-nc').value === '' && $('opp-OP10-cam').value === '' && $('opp-OP10-tl').value === '');
  setVal($('opp-OP10-nc'), NC); ok(/OP30/.test($('opp-OP10-nc').parentElement.querySelector('.hint').textContent)); setVal($('opp-OP10-nc'), ''); });
await t('referans belgeler KMI kayıtlarından seçilebilir (başka ürün/geri çekilmiş yok)', async () => { const t = $('opp-OP10-refs').textContent; ok(/Teknik resim/.test(t) && /STEP/.test(t) && /Foto/.test(t) && !/Başka ürün/.test(t) && !/Geri çekilmiş/.test(t)); });
await t('kısmi kayıt: yalnız doldurulan alanlar gönderilir → EKSİK', async () => {
  calls = []; $('opp-OP10-name').value = 'OP10 ön tornalama'; setVal($('opp-OP10-machine'), M109); await click('opp-OP10-save');
  const c = calls.find((x) => x.fn === 'op_prep_save'); ok(c && JSON.stringify(Object.keys(c.args.p_data).sort()) === '["machine_id","op_name"]' && c.args.p_expected_version === null, JSON.stringify(c));
  ok($('opp-OP10-status').textContent === 'EKSİK', $('opp-OP10-status').textContent); ok(/takım listesi/.test($('opp-slot-OP10').textContent)); });
await t('hatalı sayı sunucuya gitmez', async () => { calls = []; $('opp-OP10-cycle').value = 'abc'; await click('opp-OP10-save'); ok(!calls.some((x) => x.fn === 'op_prep_save') && /sayı olmalı/.test($('opp-msg-OP10').textContent)); });
await t('tüm alanlar → TASLAK, incelemeye gönder → TEKNİK İNCELEMEYE HAZIR', async () => {
  await mount(apiFor(E));
  setVal($('opp-OP10-nc'), NC); setVal($('opp-OP10-tl'), TL); $('opp-OP10-fixture').value = 'Ø37 pens'; $('opp-OP10-setup').value = '40'; $('opp-OP10-cycle').value = '120,5';
  $('opp-OP10-cp').value = 'Ø ve boy'; setVal($('opp-OP10-fp'), 'true');
  $('opp-OP10-skills').querySelector('input[value="CNC_MILL"]').checked = true; $('opp-OP10-refs').querySelector(`input[value="${DRW}"]`).checked = true;
  await click('opp-OP10-save'); ok($('opp-OP10-status').textContent === 'TASLAK', $('opp-OP10-status').textContent + ' ' + $('opp-msg-OP10')?.textContent);
  ok(!$('opp-OP10-approve'), 'editörde onay düğmesi olmamalı'); await click('opp-OP10-submit'); ok($('opp-OP10-status').textContent === 'TEKNİK İNCELEMEYE HAZIR'); });
await t('virgüllü çevrim süresi doğru kaydedildi (120,5 → 120.5)', async () => { const r = (await db.query(`select cycle_seconds from kmi_next.op_prep_drafts where slot = 'OP10'`)).rows[0]; ok(Number(r.cycle_seconds) === 120.5); });
await t('onaylayıcı → ONAYLI, notta "RELEASE değildir"', async () => {
  await mount(apiFor(A)); ok($('opp-readonly'), 'onaylayıcı düzenleyemez (salt okunur)'); await click('opp-OP10-approve');
  ok($('opp-OP10-status').textContent === 'ONAYLI' && /RELEASE/.test($('opp-slot-OP10').textContent)); });
await t('salt okunur kullanıcı: alanlar kilitli, kaydet/onay yok', async () => { await mount(apiFor(V)); ok($('opp-OP10-name').disabled && !$('opp-OP10-save') && !$('opp-OP10-approve') && $('opp-readonly')); });
await t('değişiklik geçmişi panelde görünür', async () => { await mount(apiFor(V)); const h = $('opp-OP10-history'); h.open = true; h.dispatchEvent(new dom.window.Event('toggle')); await settle(); ok(/teknik olarak onaylandı/.test(h.textContent) && /incelemeye gönderildi/.test(h.textContent) && /Çevrim/.test(h.textContent), h.textContent); });
await t('başka operasyon ekle (OP50) ve rotadaki OP30 eklenemez', async () => { await mount(apiFor(E)); $('opp-add-slot').value = 'op50'; await click('opp-add-btn'); ok($('opp-slot-OP50')); $('opp-add-slot').value = 'OP30'; await click('opp-add-btn'); ok(!$('opp-slot-OP30')); });
await t('veritabanı güncellemesi yoksa sakin uyarı (hata değil)', async () => { await mount({ opPrepList: async () => { throw Object.assign(new Error('Could not find the function kmi_next.op_prep_list'), { code: 'PGRST202' }); } }); ok($('opp-not-enabled') && !$('opp-err')); });
await t('sunucu hatası kullanıcıya gösterilir', async () => { await mount({ opPrepList: async () => { throw Object.assign(new Error('FORBIDDEN: ROUTING_MANAGE'), { code: '42501' }); } }); ok($('opp-err')); });
console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
