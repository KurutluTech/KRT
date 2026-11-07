// KMI NEXT — Ücret Yönetimi: Maaş Excel Yükle sihirbazı. Excel TARAYICIDA okunur; dosya sunucuya gönderilmez.
// Sunucuya yalnız KULLANICININ EŞLEDİĞİ sütunlar gider (TC no, IBAN, adres vb. okunmaz). Yetki/RLS sunucuda; arayüz gizlemesi ek önlemdir.
import { h } from '../../../../packages/ui/src/h.js';
import { openXlsx, sha256Hex } from '../xlsxReader.js';
import { IDENT, COMPONENTS, detectHeaderRow, periodFromSheetName, suggestMapping, buildRows, errorReportCsv } from '../costPayLib.js';
const errText = (e) => (e && (e.message || e.error || String(e))) || 'Hata';
const STATUS_TR = { MATCHED: 'Eşleşti', MANUAL: 'Elle onaylandı', NEEDS_REVIEW: 'Onay bekliyor', AMBIGUOUS: 'Birden fazla kişiye uyuyor', UNMATCHED: 'Eşleşmedi', SKIPPED: 'Atlandı' };
const ISSUE_TR = { EMPNO_NOT_FOUND: 'Sicil no sistemde yok', EMPNO_NAME_MISMATCH: 'Sicil no ile ad uyuşmuyor', EMPNO_NOT_UNIQUE: 'Sicil no birden çok kişide', NAME_ONLY_NEEDS_CONFIRM: 'Yalnız ad eşleşti: onay gerekli', NAME_NOT_UNIQUE: 'Aynı isimde birden çok personel', NO_MATCH: 'Ad hiçbir personelle eşleşmedi', NO_IDENTITY: 'Sicil ve ad yok', DUPLICATE_IN_FILE: 'Aynı kişi dosyada birden çok satırda', NEGATIVE_AMOUNT: 'Negatif tutar', INVALID_AMOUNT: 'Tutar okunamadı', AMOUNT_IMPLAUSIBLE: 'Tutar makul aralığın dışında', NO_PAY_AMOUNT: 'Net/brüt/işveren maliyeti yok', UNKNOWN_COMPONENT: 'Bilinmeyen alan', MISSING_AMOUNT: 'Boş tutar', MANUAL_CONFIRMED: 'Elle onaylandı' };
const money = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 }));
export async function renderPayWizard(api, opts = {}) {
    const root = h('div', { 'data-testid': 'pay-wizard' }); const S = { step: 1, msg: null, ok: null, sel: {}, people: null };
    const colLetter = (i) => { let n = i + 1, s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    const people = async () => { if (!S.people) { try { const x = await api.adminList('pay_wages'); S.people = Array.isArray(x) ? x.map((p) => ({ id: p.personnel_id, name: p.name, employee_no: p.employee_no })) : []; } catch { S.people = []; } } return S.people; };
    const draw = async () => {
        const kids = [];
        if (S.access && !S.access.can_view) { root.replaceChildren(h('div', { class: 'card', 'data-testid': 'pay-noaccess' }, 'Ücret bilgileri için ekonomik erişim yetkiniz yok. Yetkiyi yalnız Ender veya Hakan verebilir; genel ADMIN rolü tek başına yetmez.')); return; }
        if (S.msg) kids.push(h('div', { class: 'err', role: 'alert', 'data-testid': 'pay-msg' }, S.msg)); if (S.ok) kids.push(h('div', { class: 'ok', 'data-testid': 'pay-ok' }, S.ok));
        kids.push(h('div', { class: 'mut' }, `Adım ${S.step}/4 · Excel seç → Kolonları eşleştir → Personelleri eşleştir ve önizle → Doğrula ve kaydet`));
        if (S.step === 1) {
            const fi = h('input', { type: 'file', accept: '.xlsx', 'data-testid': 'pay-file' });
            fi.addEventListener('change', async () => {
                const f = fi.files && fi.files[0]; if (!f) return; S.msg = null;
                try { const buf = await f.arrayBuffer(); S.sha = await sha256Hex(buf); S.fileName = f.name; S.wb = await openXlsx(buf); S.sheet = S.wb.sheetNames[S.wb.sheetNames.length - 1]; await loadSheet(); S.step = 1.5; } catch (e) { S.msg = errText(e); }
                draw();
            });
            kids.push(h('div', { class: 'card' }, h('b', {}, 'Maaş Excel dosyasını seç (.xlsx)'), h('div', { class: 'mut' }, 'Dosya yalnız bu tarayıcıda açılır; sunucuya gönderilmez. Sadece bir sonraki adımda eşleştirdiğiniz sütunlar okunur. Kimlik numarası, banka hesabı, adres gibi sütunlar hiçbir zaman okunmaz.'), fi));
            if (S.wb) kids.push(sheetCard());
        } else if (S.step === 1.5) kids.push(sheetCard());
        else if (S.step === 2) kids.push(await mappingCard());
        else if (S.step === 3) kids.push(await reviewCard());
        else if (S.step === 4) kids.push(h('div', { class: 'card', 'data-testid': 'pay-done' }, h('b', {}, 'Kayıt tamamlandı'), h('pre', {}, JSON.stringify(S.result || {}, null, 1)), h('button', { onClick: () => { Object.assign(S, { step: 1, wb: null, rows: null, importId: null, preview: null, ok: null, result: null }); draw(); } }, 'Yeni dosya yükle')));
        kids.push(await recent());
        root.replaceChildren(...kids);
    };
    async function loadSheet() { S.rows = await S.wb.readSheet(S.sheet); S.headerRow = detectHeaderRow(S.rows); S.period = periodFromSheetName(S.sheet) || S.period || ''; const hd = S.rows[S.headerRow] || []; S.mapping = suggestMapping(hd); S.otAdd = false; }
    function sheetCard() {
        const sel = h('select', { 'data-testid': 'pay-sheet' }, ...S.wb.sheetNames.map((n) => h('option', { value: n, ...(n === S.sheet ? { selected: 'selected' } : {}) }, n)));
        sel.addEventListener('change', async () => { S.sheet = sel.value; try { await loadSheet(); } catch (e) { S.msg = errText(e); } draw(); });
        const hr = h('input', { type: 'number', min: 1, max: 30, value: String(S.headerRow + 1), 'data-testid': 'pay-headerrow' });
        hr.addEventListener('change', () => { S.headerRow = Math.max(0, Number(hr.value) - 1); S.mapping = suggestMapping(S.rows[S.headerRow] || []); });
        const pe = h('input', { type: 'month', value: S.period || '', 'data-testid': 'pay-period' }); pe.addEventListener('change', () => { S.period = pe.value; });
        return h('div', { class: 'card' }, h('b', {}, `Dosya: ${S.fileName}`), h('div', { class: 'mut' }, `${S.wb.sheetNames.length} sayfa. Hangi sayfa (ay) yüklenecek?`), sel,
            h('div', { class: 'row' }, h('label', { class: 'mut' }, 'Başlık satırı (otomatik bulundu; gerekirse değiştirin)'), hr), h('div', { class: 'row' }, h('label', { class: 'mut' }, 'Bu sayfanın dönemi (ücret ayı)'), pe),
            h('button', { 'data-testid': 'pay-next1', onClick: () => { if (!S.period) { S.msg = 'Dönem seçin'; } else { S.msg = null; S.step = 2; } draw(); } }, 'Kolonları eşleştir →'));
    }
    async function mappingCard() {
        const hd = S.rows[S.headerRow] || []; const mapped = new Set(Object.values(S.mapping).filter((v) => v !== '' && v !== undefined && v !== null).map(Number));
        const opts = (cur) => [h('option', { value: '' }, '— yok / eşleme —'), ...hd.map((t, i) => (t === undefined || t === null || String(t).trim() === '' ? null : h('option', { value: String(i), ...(String(cur) === String(i) ? { selected: 'selected' } : {}) }, `${colLetter(i)} · ${String(t).replace(/\s+/g, ' ').slice(0, 40)}`))).filter(Boolean)];
        const row = (key, label, optional, hint) => { const s = h('select', { 'data-testid': `pay-map-${key}` }, ...opts(S.mapping[key])); s.addEventListener('change', () => { if (s.value === '') delete S.mapping[key]; else S.mapping[key] = Number(s.value); }); return h('div', { class: 'row' }, h('label', { class: 'mut' }, label + (optional ? ' (isteğe bağlı)' : '')), hint ? h('div', { class: 'mut' }, hint) : null, s); };
        const ot = h('input', { type: 'checkbox', 'data-testid': 'pay-otadd' }); ot.checked = !!S.otAdd; ot.addEventListener('change', () => { S.otAdd = ot.checked; });
        return h('div', { class: 'card' }, h('b', {}, 'Sütunları eşleştir'), h('div', { class: 'mut' }, `Excel sütun adları sabit varsayılmaz. Öneriler otomatik bulundu; doğru olduğundan emin olun. Eşleştirilmeyen ${Math.max(0, hd.filter((x) => x !== undefined && x !== null && String(x).trim() !== '').length - mapped.size)} sütun hiç okunmaz.`),
            h('div', { class: 'mut' }, 'Kimlik'), ...IDENT.map((f) => row(f.key, f.label, f.optional, f.key === 'employee_no' ? 'Sicil no yoksa/boşsa ad kullanılır; ad tek başına kesin kimlik sayılmaz, onayınız istenir.' : null)),
            h('div', { class: 'mut' }, 'Tutarlar'), ...COMPONENTS.map((c) => row(c.code, c.label, true, c.code === 'OVERTIME' ? 'Brüt toplamınız fazla mesaiyi zaten içeriyorsa BURAYA DEĞİL, "Brüt içindeki fazla mesai (bilgi)" alanına eşleyin.' : c.code === 'GROSS' ? 'Brüt, SGK ve işveren payı varsa maliyet KESİN bordro olarak; yalnız net varsa TAHMİNİ olarak hesaplanır.' : null)),
            h('div', { class: 'row' }, h('label', { class: 'mut' }, ot, ' Fazla mesai, brüt toplamın DIŞINDA ayrıca ödenen tutardır (maliyete eklenir). Yalnız fazla mesai sütunu eşlediyseniz işaretleyin.')),
            h('button', { onClick: () => { S.step = 1.5; draw(); } }, '← Geri'), h('button', { 'data-testid': 'pay-stage', onClick: stage }, 'Önizle (satırlar sunucuda eşleştirilir) →'));
    }
    async function stage() {
        const m = S.mapping; if (m.GROSS === undefined && m.NET === undefined && m.EMPLOYER_COST_TOTAL === undefined) { S.msg = 'En az Net, Brüt veya Toplam işveren maliyeti sütunu eşleyin'; return draw(); }
        if (m.employee_no === undefined && m.name === undefined) { S.msg = 'Sicil no veya ad-soyad sütunu eşleyin'; return draw(); }
        if (m.OVERTIME !== undefined && m.GROSS !== undefined && !S.otAdd) { S.msg = 'Fazla mesai ve brüt birlikte eşlendi: mesai brüt DIŞINDA ayrı ödeme ise kutuyu işaretleyin; brüte dahilse mesaiyi "Brüt içindeki fazla mesai (bilgi)" alanına taşıyın'; return draw(); }
        const hd = S.rows[S.headerRow] || []; const mp = {}; for (const [k, i] of Object.entries(m)) mp[k] = String(hd[i] ?? '').replace(/\s+/g, ' ').slice(0, 60);
        const rows = buildRows(S.rows, S.headerRow, m); if (!rows.length) { S.msg = 'Veri satırı bulunamadı'; return draw(); }
        try {
            const r = await api.call('cost_pay_import_stage', { p_file_name: S.fileName, p_sha256: S.sha, p_sheet: S.sheet, p_period: S.period, p_mapping: mp, p_rows: rows });
            S.importId = r.import_id; S.msg = null; if (r.duplicate) S.ok = r.status === 'COMMITTED' ? 'Bu dosya/sayfa/dönem daha önce kaydedilmiş; mükerrer kayıt oluşturulmadı.' : 'Bu dosya daha önce hazırlanmış; kaldığınız yerden devam ediliyor.';
            else S.ok = null;
            if (r.duplicate && r.status === 'COMMITTED') { S.step = 1; return draw(); }
            S.step = 3;
        } catch (e) { S.msg = errText(e); }
        draw();
    }
    async function reviewCard() {
        let pv; try { pv = await api.call('cost_pay_import_preview', { p_import: S.importId }); } catch (e) { return h('div', { class: 'err' }, errText(e)); } S.preview = pv; const ps = await people();
        const why = h('input', { placeholder: 'Eşleştirme/atlama gerekçesi (en az 5 harf)', 'data-testid': 'pay-rowreason' }); const rows = pv.rows || [];
        const need = rows.filter((r) => ['NEEDS_REVIEW', 'AMBIGUOUS', 'UNMATCHED'].includes(r.match_status) || (['MATCHED', 'MANUAL'].includes(r.match_status) && !r.row_ok));
        const doRow = async (fn, a) => { try { await api.call(fn, a); S.msg = null; } catch (e) { S.msg = errText(e); } draw(); };
        const nameOf = (id) => (ps.find((p) => p.id === id) || {}).name;
        const trs = rows.map((r) => { const sel = h('select', {}, h('option', { value: '' }, '— kişi seç —'), ...ps.map((p) => h('option', { value: p.id, ...(r.personnel_id === p.id || (r.candidates || []).includes(p.id) ? { selected: 'selected' } : {}) }, `${p.name}${p.employee_no ? ' · ' + p.employee_no : ''}`)));
            const open = ['NEEDS_REVIEW', 'AMBIGUOUS', 'UNMATCHED'].includes(r.match_status) || !r.row_ok;
            return h('tr', { 'data-testid': 'pay-row', 'data-status': r.match_status }, h('td', {}, String(r.row_no)), h('td', {}, `${r.name || ''}${r.employee_no ? ' · ' + r.employee_no : ''}`), h('td', {}, STATUS_TR[r.match_status] || r.match_status), h('td', {}, r.personnel_name || nameOf(r.personnel_id) || ''),
                h('td', {}, (r.issues || []).map((x) => ISSUE_TR[x.code] || x.code).join('; ')), h('td', {}, money((r.amounts || {}).NET), ' / ', money((r.amounts || {}).GROSS)), h('td', {}, r.diff === 'CHANGED' ? `DEĞİŞTİ (önceki ${money(r.previous_employer_cost)} ${r.previous_basis === 'ACTUAL' ? 'kesin' : 'tahmini'})` : r.diff === 'NEW' ? 'Yeni' : 'Aynı'),
                h('td', {}, open ? h('div', {}, sel, h('button', { onClick: () => doRow('cost_pay_import_match_set', { p_import: S.importId, p_row_no: r.row_no, p_personnel: sel.value, p_reason: why.value, p_remember: true }) }, 'Eşleştir'), h('button', { onClick: () => doRow('cost_pay_import_skip', { p_import: S.importId, p_row_no: r.row_no, p_reason: why.value }) }, 'Atla')) : ''));
        });
        const skip = h('input', { type: 'checkbox', 'data-testid': 'pay-skip' }); const reason = h('input', { placeholder: 'Kayıt gerekçesi (ör. Eylül 2026 bordro)', 'data-testid': 'pay-commit-reason' });
        const dl = () => { const blob = new Blob(['﻿' + errorReportCsv(pv)], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ucret_hata_raporu_${pv.import.period}.csv`; a.click(); };
        return h('div', { class: 'card' }, h('b', {}, `Önizleme · ${pv.import.file_name} · ${pv.import.sheet} · dönem ${pv.import.period}`),
            h('div', { class: 'mut', 'data-testid': 'pay-summary' }, `Satır ${pv.import.summary.rows} · hazır ${pv.import.summary.ready} · onay bekleyen ${pv.import.summary.needs_review} · eşleşmeyen/belirsiz ${pv.import.summary.unmatched} · hatalı ${pv.import.summary.row_errors}. Çözülmesi gereken: ${need.length}`),
            h('div', { class: 'row' }, why), h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['Satır', 'Dosyadaki kişi', 'Durum', 'Personel', 'Sorun', 'Net / Brüt', 'Önceki kayıtla fark', ''].map((c) => h('th', {}, c))), ...trs)),
            h('div', { class: 'row' }, h('label', { class: 'mut' }, skip, ' Çözülmemiş / hatalı satırları ATLAYARAK kaydet (atlananlar kaydedilmez)')), h('div', { class: 'row' }, reason),
            h('button', { onClick: () => { S.step = 2; draw(); } }, '← Sütunlar'), h('button', { onClick: dl, 'data-testid': 'pay-errcsv' }, 'Hata raporunu indir (CSV, tutarsız)'),
            h('button', { 'data-testid': 'pay-commit', onClick: async () => { try { S.result = await api.call('cost_pay_import_commit', { p_import: S.importId, p_skip_unresolved: !!skip.checked, p_reason: reason.value }); S.step = 4; S.msg = null; S.ok = 'Ücret kayıtları doğrulandı ve kaydedildi'; } catch (e) { S.msg = errText(e); } draw(); } }, 'Doğrula ve Kaydet'),
            h('button', { onClick: async () => { try { await api.call('cost_pay_import_reject', { p_import: S.importId, p_reason: reason.value }); S.step = 1; S.ok = 'Yükleme reddedildi; hiçbir kayıt yazılmadı'; S.msg = null; } catch (e) { S.msg = errText(e); } draw(); } }, 'Bu yüklemeyi reddet'));
    }
    async function recent() {
        let list = []; try { list = await api.adminList('pay_imports'); if (!Array.isArray(list)) list = []; } catch { list = []; }
        return h('div', { class: 'card', 'data-testid': 'pay-recent' }, h('b', {}, 'Son yüklemeler (geri izlenebilir)'), h('div', { class: 'tw' }, h('table', {}, h('tr', {}, ...['Dosya', 'Sayfa', 'Dönem', 'Durum', 'Satır', 'Kayıt'].map((c) => h('th', {}, c))), ...list.slice(0, 15).map((i) => h('tr', {}, h('td', {}, i.file_name), h('td', {}, i.sheet), h('td', {}, i.period), h('td', {}, i.status), h('td', {}, String(i.rows)), h('td', {}, String(i.committed_at || '').slice(0, 16)), i.status === 'STAGED' ? h('td', {}, h('button', { onClick: () => { S.importId = i.id; S.step = 3; draw(); } }, 'Devam et')) : null)))));
    }
    try { S.access = await api.call('cost_pay_access', {}); } catch { S.access = { can_view: false }; }
    await draw(); return root;
}
