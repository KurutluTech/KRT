// Paket C / 0137 — "Excel'i oku ve eşle": the browser reads the tool list file, shows what it found, the user confirms the columns, the server compares with the NC.
// Nothing is guessed silently: a column that is not found is listed as MISSING and the server keeps the list at FAIL for production until it exists.
import { h } from '../../../../packages/ui/src/h.js';
import { bytesToHex } from '../../../../packages/domain/src/documents.js';
import { readXlsx } from '../../../../packages/domain/src/xlsxRead.js';
import { csvFromRows, guessMapping, ncToolOffsets, normalizeSheet, readCsvGrid } from '../../../../packages/domain/src/toolListSheet.js';
import { fromBase64 } from '../kx.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const FIELDS = [['no', 'Takım no (T)'], ['dia', 'Çap'], ['len', 'Boy'], ['holder', 'Tutucu'], ['offset', 'Offset (H)'], ['type', 'Takım türü']];
const inflateRaw = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
const letter = (i) => { let s = '', n = i + 1; while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
} return s; };
export async function drawToolistMap(host, api, versionId, fileName, done, showErr, ncTexts, readOnly = false) {
    host.replaceChildren();
    try {
        const f = await api.toolistFile(versionId);
        const bytes = fromBase64(f.contentBase64);
        if (bytesToHex(await crypto.subtle.digest('SHA-256', bytes)) !== f.sha256)
            throw new Error('BÜTÜNLÜK HATASI: dosya SHA-256 değeri kayıtla uyuşmuyor');
        let grid;
        if (/\.xlsx$/i.test(fileName)) {
            const sheets = await readXlsx(bytes, inflateRaw);
            const s = sheets.find((x) => x.rows.length > 0);
            if (!s)
                throw new Error('Excel dosyasında okunabilir sayfa yok');
            grid = s.rows;
        }
        else if (/\.csv$/i.test(fileName))
            grid = readCsvGrid(new TextDecoder().decode(bytes));
        else {
            host.append(E('div', { class: 'banner', 'data-testid': 'pw-map-unsupported' }, 'Bu dosya türünün içeriği okunamaz (yalnız .xlsx ve .csv). İçerik elle doğrulanmalıdır.'));
            return;
        }
        let restored = 0;
        const m = guessMapping(grid);
        const width = Math.max(0, ...grid.map((r) => r.length));
        const sel = (key) => {
            const s = E('select', { 'data-testid': `pw-map-${key}` });
            s.append(E('option', { value: '' }, '— yok —'));
            for (let c = 0; c < width; c++) {
                const head = (grid[m.headerRow]?.[c] ?? '').replace(/\s+/g, ' ').trim();
                const o = E('option', { value: String(c) }, `${letter(c)}${head ? ' · ' + head.slice(0, 24) : ''}`);
                if (m.cols[key] === c)
                    o.selected = true;
                s.append(o);
            }
            return s;
        };
        const sels = new Map(FIELDS.map(([k]) => [k, sel(k)]));
        const dfd = E('input', { type: 'checkbox', 'data-testid': 'pw-map-dia-desc' });
        dfd.checked = m.diaFromDesc;
        const prev = E('div', { 'data-testid': 'pw-map-preview' });
        const warn = E('div', { class: 'mut', 'data-testid': 'pw-map-missing' });
        const current = () => {
            const cols = { ...m.cols };
            for (const [k] of FIELDS) {
                const v = sels.get(k).value;
                cols[k] = v === '' ? null : Number(v);
            }
            return { headerRow: m.headerRow, cols, diaFromDesc: dfd.checked && cols.dia === null };
        };
        const redraw = () => {
            const n = normalizeSheet(grid, current());
            prev.replaceChildren(E('div', { class: 'mut' }, `${n.rows.length} takım satırı okundu`), E('div', { class: 'pp-wrap' }, E('table', { class: 'pp-t' }, E('thead', {}, E('tr', {}, ...['T', 'Çap', 'Boy', 'Tutucu', 'Offset', 'Tip', 'Tanım'].map((x) => E('th', {}, x)))), E('tbody', {}, ...n.rows.slice(0, 20).map((r) => E('tr', { 'data-testid': 'pw-map-row' }, ...[r.t, r.dia, r.len, r.holder, r.offset, r.type, r.desc.slice(0, 40)].map((x) => E('td', {}, x || '—'))))))));
            warn.textContent = n.missing.length ? `Dosyada bulunamayan kritik sütun: ${n.missing.join(', ')}. Eksik sütun uydurulmaz; liste üretime verilemez ve sistem bu alanları doğrulayamaz.` : 'Tüm kritik sütunlar eşlendi.';
            save.disabled = n.rows.length === 0;
            void drawFill();
        };
        const edits = new Map();
        const fillHost = E('div', { 'data-testid': 'pw-fill' });
        let ncSugg = new Map();
        let ncLoaded = false;
        const applied = { offset: new Set() };
        const TYPES = ['FREZE', 'PARMAK FREZE', 'YÜZEY FREZESİ', 'MATKAP', 'KILAVUZ', 'RAYBA', 'TORNA UCU', 'DİĞER'];
        if (api.toolistContentGet) { // earlier completion of the SAME file bytes comes back, so a half-finished list is never lost
            try {
                const sv = await api.toolistContentGet(versionId);
                if (sv.saved && sv.csv) {
                    const g = readCsvGrid(sv.csv);
                    const head = (g[0] ?? []).map((x) => x.toLowerCase());
                    const ix = (n) => head.indexOf(n);
                    for (const r of g.slice(1)) {
                        const t = (r[0] ?? '').toUpperCase();
                        if (!t)
                            continue;
                        const gv = (n) => (ix(n) >= 0 ? r[ix(n)] ?? '' : '');
                        edits.set(t, { dia: gv('cap'), len: gv('boy'), holder: gv('tutucu'), offset: gv('offset'), type: gv('tip') });
                        restored++;
                    }
                }
            }
            catch { /* kayıt okunamadı: dosyanın kendisinden başlanır */ }
        }
        const loadNc = async () => {
            if (ncLoaded || !ncTexts)
                return;
            ncLoaded = true;
            try {
                for (const tx of await ncTexts())
                    for (const o of ncToolOffsets(tx))
                        if (o.suggestion && !ncSugg.has(o.t))
                            ncSugg.set(o.t, o.suggestion);
            }
            catch { /* NC okunamadı: öneri yok, hiçbir şey uydurulmaz */ }
        };
        const merged = () => normalizeSheet(grid, current()).rows.map((r) => { const e = edits.get(r.t); return e ? { ...r, dia: e.dia || r.dia, len: e.len || r.len, holder: e.holder, offset: e.offset, type: e.type } : r; });
        const drawFill = async () => {
            await loadNc();
            const rows = merged();
            if (!rows.length) {
                fillHost.replaceChildren();
                return;
            }
            const inp = (r, k) => {
                const el = (k === 'type' ? E('input', { list: 'pw-fill-types', 'data-testid': `pw-fill-${k}-${r.t}`, value: r[k] }) : E('input', { 'data-testid': `pw-fill-${k}-${r.t}`, value: r[k], inputmode: k === 'offset' || k === 'dia' || k === 'len' ? 'decimal' : 'text' }));
                el.addEventListener('input', () => { const cur = merged().find((x) => x.t === r.t); edits.set(r.t, { dia: cur.dia, len: cur.len, holder: cur.holder, offset: cur.offset, type: cur.type, [k]: el.value }); sum(); });
                if (readOnly)
                    el.disabled = true;
                return el;
            };
            const sumEl = E('div', { class: 'mut', 'data-testid': 'pw-fill-missing' });
            const sum = () => { const m2 = merged(); const c = (k) => m2.filter((r) => r[k].trim() === '').length; sumEl.textContent = `Eksik: çap ${c('dia')} · boy ${c('len')} · tutucu ${c('holder')} · offset ${c('offset')} · takım türü ${c('type')} (toplam ${m2.length} takım). Bilinmeyen değeri boş bırakın; sistem uydurmaz, o alan “doğrulanamadı” kalır.`; };
            const sugCount = rows.filter((r) => r.offset.trim() === '' && ncSugg.has(r.t)).length;
            fillHost.replaceChildren(E('b', {}, 'Eksik alanları tamamla'), E('div', { class: 'mut', 'data-testid': 'pw-fill-restored' }, restored ? `Daha önce kaydettiğiniz tamamlama (${restored} takım) yüklendi.` : ''), sumEl, E('datalist', { id: 'pw-fill-types' }, ...TYPES.map((t) => E('option', { value: t }))), E('div', { class: 'pp-wrap' }, E('table', { class: 'pp-t' }, E('thead', {}, E('tr', {}, ...['T', 'Tanım', 'Çap', 'Boy', 'Tutucu', 'Offset (H)', 'NC önerisi', 'Takım türü'].map((x) => E('th', {}, x)))), E('tbody', {}, ...rows.map((r) => E('tr', { 'data-testid': 'pw-fill-row' }, E('td', {}, r.t), E('td', {}, r.desc.slice(0, 36) || '—'), E('td', {}, inp(r, 'dia')), E('td', {}, inp(r, 'len')), E('td', {}, inp(r, 'holder')), E('td', {}, inp(r, 'offset')), E('td', { 'data-testid': `pw-fill-sug-${r.t}` }, ncSugg.has(r.t) ? `H${ncSugg.get(r.t)}` : ncLoaded && ncTexts ? 'NC kesin söylemiyor' : '—'), E('td', {}, inp(r, 'type'))))))), readOnly ? E('div', { class: 'banner', 'data-testid': 'pw-fill-readonly' }, 'Bu sürüm onaylı olduğu için tablo yalnız görüntülenir. Eksikleri tamamlamak için yeni (düzeltilmiş) sürüm yüklenmelidir; orijinal Excel değişmez.') : E('div', { class: 'row' }, sugCount > 0 ? E('button', { class: 'ghost', type: 'button', 'data-testid': 'pw-fill-apply-nc', onClick: () => { for (const r of merged())
                    if (r.offset.trim() === '' && ncSugg.has(r.t)) {
                        edits.set(r.t, { dia: r.dia, len: r.len, holder: r.holder, offset: ncSugg.get(r.t), type: r.type });
                        applied.offset.add(r.t);
                    } void drawFill(); } }, `NC önerilerini boş offset alanlarına uygula (${sugCount})`) : null, E('button', { class: 'primary', type: 'button', 'data-testid': 'pw-fill-save', onClick: () => void (async () => {
                    try {
                        const all = merged();
                        const cur = current();
                        const out = csvFromRows(all);
                        const typed = (k) => all.filter((r) => r[k].trim() !== '' && !normalizeSheet(grid, cur).rows.some((o) => o.t === r.t && o[k] === r[k])).map((r) => r.t);
                        await api.toolistContentSave(versionId, out.csv, { headerRow: cur.headerRow, cols: cur.cols, diaFromDesc: cur.diaFromDesc, source: 'browser+completion', rows: all.length,
                            completion: { enteredByUser: { dia: typed('dia'), len: typed('len'), holder: typed('holder'), offset: typed('offset').filter((t) => !applied.offset.has(t)), type: typed('type') }, offsetFromNc: [...applied.offset].filter((t) => all.find((r) => r.t === t)?.offset === ncSugg.get(t)) } });
                        await done('Tamamlanan liste içeriği kaydedildi; otomatik kontroller güncellendi. Dosyanın kendisi değişmedi.');
                    }
                    catch (e) {
                        showErr(e);
                    }
                })() }, 'Tamamlananı kaydet ve NC ile karşılaştır')));
            sum();
        };
        const save = E('button', { class: 'primary', type: 'button', 'data-testid': 'pw-map-save' }, 'Kaydet ve NC ile karşılaştır');
        if (readOnly)
            save.style.display = 'none';
        save.addEventListener('click', () => void (async () => {
            try {
                const cur = current();
                const n = normalizeSheet(grid, cur);
                await api.toolistContentSave(versionId, n.csv, { headerRow: cur.headerRow, cols: cur.cols, diaFromDesc: cur.diaFromDesc, source: 'browser', rows: n.rows.length });
                await done('Liste içeriği kaydedildi; otomatik kontroller güncellendi.');
            }
            catch (e) {
                showErr(e);
            }
        })());
        for (const s of sels.values())
            s.addEventListener('change', redraw);
        dfd.addEventListener('change', redraw);
        host.append(E('div', { class: 'formbox', 'data-testid': 'pw-map' }, E('b', {}, 'Excel içeriğini oku ve sütunları eşle'), E('div', { class: 'mut' }, `Sayfa başlığı ${m.headerRow + 1}. satırda bulundu. Sistem yalnız burada eşlediğiniz sütunları okur; dosya SHA-256 değerine bağlı kaydedilir.`), E('div', { class: 'fgrid w2' }, ...FIELDS.map(([k, t]) => E('label', {}, t, sels.get(k)))), E('label', { class: 'row', style: 'gap:6px' }, dfd, 'Çap sütunu yoksa tanımdaki “Ø12” biçiminden oku (türetilmiş değer)'), prev, warn, fillHost, E('div', { class: 'row' }, save, E('button', { class: 'ghost', type: 'button', onClick: () => host.replaceChildren() }, 'Vazgeç'))));
        redraw();
    }
    catch (e) {
        showErr(e);
    }
}
