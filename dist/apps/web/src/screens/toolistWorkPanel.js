// Paket C4 / 0140 — Takım listesi: ELLE DÜZENLE + EXCEL YÜKLE / GÜNCELLE, ikisi de AYNI kanonik çalışma kaydına yazar.
// The approved original file stays read-only. Nothing is guessed: empty cells stay empty and are reported; NC offsets are only proposals the user applies.
import { h } from '../../../../packages/ui/src/h.js';
import { bytesToHex } from '../../../../packages/domain/src/documents.js';
import { readXlsx } from '../../../../packages/domain/src/xlsxRead.js';
import { guessMapping, ncDeclaredDiameters, ncToolOffsets, normalizeSheet, readCsvGrid, unmappedColumns } from '../../../../packages/domain/src/toolListSheet.js';
import { diffExcel, isValidValue, missingCells, normToolNo, normValue, sortedTools, TOOL_FIELDS } from '../../../../packages/domain/src/toolListDiff.js';
import { chip, fold, fromBase64 } from '../kx.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids.filter((k) => k !== null));
const inflateRaw = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
const FIELD_TR = { desc: 'Tanım', type: 'Tür', dia: 'Çap', len: 'Boy', holder: 'Tutucu', offset: 'Offset (H)' };
const COLS = ['type', 'dia', 'len', 'holder', 'offset'];
const SOURCE_TR = { KMI: 'KMI', EXCEL: 'Excel' };
const HINT = 'Bilmediğiniz değeri boş bırakın; sistem uydurmaz, o alan “eksik” kalır.';
export async function drawToolistWork(host, api, o) {
    host.replaceChildren();
    if (!api.toolistWorkGet || !api.toolistWorkApply) {
        host.append(E('div', { class: 'banner', 'data-testid': 'tw-unavailable' }, 'Takım verisi düzenleme bu sunucuda henüz etkin değil.'));
        return;
    }
    try {
        const work = await api.toolistWorkGet(o.versionId);
        const server = (work.draft?.rows ?? work.published?.rows ?? {});
        const readOnlyState = !work.canEdit;
        // ---- the original file (read-only source) — shown as the starting table when no working record exists yet
        let fileRows = [];
        let fileSha = '';
        const isSheet = /\.(xlsx|csv)$/i.test(o.fileName);
        const readFile = async (name, bytes, mapping) => {
            let grid;
            if (/\.xlsx$/i.test(name)) {
                const sheets = await readXlsx(bytes, inflateRaw);
                const s = sheets.find((x) => x.rows.length > 0);
                if (!s)
                    throw new Error('Excel dosyasında okunabilir sayfa yok');
                grid = s.rows;
            }
            else if (/\.csv$/i.test(name))
                grid = readCsvGrid(new TextDecoder().decode(bytes));
            else
                throw new Error('Yalnız .xlsx ve .csv okunabilir');
            const m = mapping ?? guessMapping(grid);
            return { rows: normalizeSheet(grid, m).rows, grid, m };
        };
        const hasServer = Object.keys(server).length > 0;
        if (!hasServer && isSheet) {
            try {
                const f = await api.toolistFile(o.versionId);
                const bytes = fromBase64(f.contentBase64);
                fileSha = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
                if (fileSha !== f.sha256)
                    throw new Error('BÜTÜNLÜK HATASI: dosya SHA-256 değeri kayıtla uyuşmuyor');
                fileRows = (await readFile(o.fileName, bytes)).rows;
            }
            catch (e) {
                o.showErr(e);
            }
        }
        // ---- the table the person edits: server rows, or the rows read from the original file (EXCEL source until the first save)
        const table = {};
        const fromFile = new Set(); // "T7|dia" cells that come from the file, untouched
        for (const [t, r] of Object.entries(server))
            table[t] = { ...r, src: { ...(r.src ?? {}) } };
        for (const r of fileRows) {
            const t = normToolNo(r.t);
            if (!t || table[t])
                continue;
            table[t] = { t, desc: r.desc, type: normValue('type', r.type), dia: normValue('dia', r.dia), len: normValue('len', r.len), holder: r.holder, offset: normValue('offset', r.offset), src: {} };
            for (const f of TOOL_FIELDS)
                if (table[t][f])
                    fromFile.add(`${t}|${f}`);
        }
        const inputs = new Map();
        let dirty = false;
        const ncSugg = new Map();
        const ncDia = new Map();
        let ncLoaded = false;
        const loadNc = async () => { if (ncLoaded || !o.ncTexts)
            return; ncLoaded = true; try {
            for (const tx of await o.ncTexts()) {
                for (const [k, v] of ncDeclaredDiameters(tx))
                    if (!ncDia.has(k))
                        ncDia.set(k, v);
                for (const x of ncToolOffsets(tx)) {
                    const t = normToolNo(x.t);
                    if (t && x.suggestion && !ncSugg.has(t))
                        ncSugg.set(t, x.suggestion);
                }
            }
        }
        catch { /* no NC text: no proposal */ } };
        await loadNc();
        const summary = E('div', { class: 'mut', 'data-testid': 'tw-missing' });
        const missBox = E('div', { class: 'banner', 'data-testid': 'tw-approve-missing' });
        const tbody = E('tbody');
        const reasonIn = E('input', { 'data-testid': 'tw-reason', placeholder: 'Değişiklik notu (ör. tezgâhta ölçüldü)', value: '' });
        const msg = E('div', { role: 'status', 'data-testid': 'tw-msg' });
        const recount = () => {
            const m = missingCells(table);
            const c = (f) => m.filter((x) => x.field === f).length;
            const n = Object.keys(table).length;
            summary.textContent = n === 0 ? 'Henüz takım satırı yok. Excel yükleyin veya “+ Takım ekle” ile ekleyin.' : `${n} takım · eksik: çap ${c('dia')} · boy ${c('len')} · tutucu ${c('holder')} · offset ${c('offset')}. ${HINT}`;
            missBox.textContent = m.length ? `Yürürlüğe almadan önce tamamlanmalı: çap ${c('dia')} · boy ${c('len')} · tutucu ${c('holder')} · offset ${c('offset')} eksik. Eksik değer tahmin edilmez; Excel’den, NC önerisinden veya elle doldurun.` : '';
            missBox.style.display = m.length ? '' : 'none';
            for (const [k, el] of inputs) {
                const [t, f] = k.split('|');
                el.classList.toggle('tw-missing', (table[t]?.[f] ?? '') === '' && ['dia', 'len', 'holder', 'offset'].includes(f));
            }
        };
        const cell = (t, f) => {
            const el = E('input', { 'data-testid': `tw-${f}-${t}`, value: table[t][f] ?? '', inputmode: f === 'dia' || f === 'len' || f === 'offset' ? 'decimal' : 'text', 'aria-label': `${t} ${FIELD_TR[f]}`, ...(readOnlyState ? { disabled: 'disabled' } : {}) });
            el.addEventListener('input', () => { table[t][f] = el.value; fromFile.delete(`${t}|${f}`); dirty = true; el.classList.toggle('tw-bad', !isValidValue(f, el.value)); recount(); });
            inputs.set(`${t}|${f}`, el);
            return el;
        };
        const drawRows = () => {
            inputs.clear();
            tbody.replaceChildren(...sortedTools(table).map((r) => E('tr', { 'data-testid': 'tw-row', 'data-t': r.t }, E('td', {}, E('b', {}, r.t)), E('td', { class: 'tw-desc', title: r.desc }, r.desc || '—'), ...COLS.map((f) => E('td', {}, cell(r.t, f))), E('td', { 'data-testid': `tw-sug-${r.t}` }, ncSugg.has(r.t) ? `H${ncSugg.get(r.t)}` : '—'), E('td', {}, [...new Set(Object.values(r.src ?? {}))].map((s) => SOURCE_TR[s] ?? s).join(', ') || (fromFile.size ? 'Excel (kayıtsız)' : '—')))));
            recount();
        };
        // ---- collect the edits into server changes (source decided per cell: untouched file values are EXCEL, everything typed is KMI)
        const collect = () => {
            const excel = [];
            const kmi = [];
            const bad = [];
            for (const r of Object.values(table)) {
                const base = server[r.t];
                if (!base)
                    excel.push({ t: r.t, field: '', value: '' }); // makes the row exist
                for (const f of TOOL_FIELDS) {
                    const cur = (r[f] ?? '').trim();
                    const old = base?.[f] ?? '';
                    if (!isValidValue(f, cur)) {
                        bad.push(`${r.t} ${FIELD_TR[f]}`);
                        continue;
                    }
                    const nv = normValue(f, cur);
                    if (nv === old)
                        continue;
                    if (nv === '') {
                        if (old !== '')
                            kmi.push({ t: r.t, field: f, value: '', clear: true });
                        continue;
                    }
                    (fromFile.has(`${r.t}|${f}`) ? excel : kmi).push({ t: r.t, field: f, value: nv });
                }
            }
            return { excel, kmi, bad };
        };
        const saveDraft = async () => {
            const c = collect();
            if (c.bad.length) {
                o.showErr(new Error(`Geçersiz değer: ${c.bad.join(', ')} (çap/boy 0’dan büyük sayı, offset rakam olmalı).`));
                return false;
            }
            const note = reasonIn.value.trim() || 'KMI takım tablosu düzenlemesi';
            if (!c.excel.length && !c.kmi.length) {
                msg.textContent = 'Kaydedilecek değişiklik yok.';
                return true;
            }
            if (c.excel.length)
                await api.toolistWorkApply(o.versionId, c.excel, 'EXCEL', reasonIn.value.trim() || `Excel: ${o.fileName}`, fileSha ? { name: o.fileName, sha256: fileSha } : null);
            if (c.kmi.length)
                await api.toolistWorkApply(o.versionId, c.kmi, 'KMI', note);
            dirty = false;
            return true;
        };
        const run = (fn) => () => void (async () => { try {
            await fn();
        }
        catch (e) {
            o.showErr(e);
        } })();
        // ---- Excel Yükle / Güncelle: read → match by T → show new / changed / unmatched → the user chooses → one call
        const diffHost = E('div', { 'data-testid': 'tw-diff' });
        const fileIn = E('input', { type: 'file', accept: '.xlsx,.csv', style: 'display:none', 'data-testid': 'tw-file' });
        const showDiff = async (name, bytes) => {
            const sha = bytesToHex(await crypto.subtle.digest('SHA-256', bytes));
            let rd = await readFile(name, bytes);
            const draw = () => {
                const noMap = rd.m.cols.no === null;
                const d = diffExcel(table, rd.rows, ncDia);
                const sel = d.changes.map((c) => ({ c, on: c.selected }));
                const boxes = [];
                const picker = E('div', { class: 'row', 'data-testid': 'tw-colmap' }, E('span', { class: 'mut' }, noMap ? 'Takım no sütunu bulunamadı — seçin:' : 'Sütunlar otomatik tanındı.'), ...['no', 'dia', 'len', 'holder', 'offset', 'type'].map((k) => {
                    const s = E('select', { 'data-testid': `tw-map-${k}`, 'aria-label': k });
                    s.append(E('option', { value: '' }, `— ${{ no: 'T no', dia: 'çap', len: 'boy', holder: 'tutucu', offset: 'offset', type: 'tür' }[k]} yok —`));
                    const width = Math.max(0, ...rd.grid.map((r) => r.length));
                    for (let i = 0; i < width; i++) {
                        const head = (rd.grid[rd.m.headerRow]?.[i] ?? '').replace(/\s+/g, ' ').trim();
                        const op = E('option', { value: String(i) }, `${String.fromCharCode(65 + (i % 26))} · ${head.slice(0, 18)}`);
                        if (rd.m.cols[k] === i)
                            op.selected = true;
                        s.append(op);
                    }
                    s.addEventListener('change', () => { const cols = { ...rd.m.cols }; for (const kk of ['no', 'dia', 'len', 'holder', 'offset', 'type']) {
                        const el = diffHost.querySelector(`[data-testid="tw-map-${kk}"]`);
                        cols[kk] = el.value === '' ? null : Number(el.value);
                    } const m2 = { ...rd.m, cols }; rd = { ...rd, m: m2, rows: normalizeSheet(rd.grid, m2).rows }; draw(); });
                    return s;
                }));
                const pickRow = (x) => {
                    const b = E('input', { type: 'checkbox', 'data-testid': 'tw-diff-pick', 'data-t': x.c.t, 'data-field': x.c.field });
                    b.checked = x.on;
                    b.addEventListener('change', () => { x.on = b.checked; });
                    boxes.push(b);
                    return E('label', { class: 'r', style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap', 'data-testid': 'tw-diff-row', 'data-t': x.c.t, 'data-kind': x.c.newTool ? 'new' : x.c.conflict ? 'conflict' : 'fill' }, b, E('b', {}, x.c.t), E('span', {}, FIELD_TR[x.c.field]), E('span', { class: 'mut' }, x.c.conflict ? `${x.c.old} → ${x.c.next}` : `boş → ${x.c.next}`), x.c.protectedByKmi ? chip('KMI’de elle girilmişti', 'warn') : x.c.conflict ? chip('mevcut değerle çelişiyor', 'warn') : chip('boşu doldurur', 'ok'), x.c.ncDia !== undefined ? chip(`NC başlığı Ø${x.c.ncDia} diyor — çelişiyor`, 'bad') : null);
                };
                const needsCheck = (x) => x.c.conflict || x.c.ncDia !== undefined;
                const fills = sel.filter((x) => !x.c.newTool && !needsCheck(x));
                const checks = sel.filter((x) => !x.c.newTool && needsCheck(x));
                const news = sel.filter((x) => x.c.newTool);
                const newByTool = [...new Set(news.map((x) => x.c.t))].map((t) => {
                    const mine = news.filter((x) => x.c.t === t);
                    const b = E('input', { type: 'checkbox', 'data-testid': 'tw-diff-newtool', 'data-t': t });
                    b.checked = mine.every((x) => x.on);
                    b.addEventListener('change', () => { for (const x of mine)
                        x.on = b.checked; });
                    const g = (f) => mine.find((x) => x.c.field === f)?.c.next ?? '';
                    return E('label', { class: 'r', style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap', 'data-testid': 'tw-diff-newrow', 'data-t': t }, b, E('b', {}, t), E('span', { class: 'mut' }, [g('type'), g('dia') ? `Ø${g('dia')}` : '', g('holder')].filter(Boolean).join(' · ') || '—'));
                });
                const grp = (title, testid, hint, rows) => rows.length ? E('div', { 'data-testid': testid, style: 'margin-top:8px' }, E('b', {}, `${title} (${rows.length})`), E('div', { class: 'mut' }, hint), E('div', { class: 'rows' }, ...rows)) : null;
                const list = d.changes.length ? E('div', { 'data-testid': 'tw-diff-list' }, grp('Boş alanları doldurulacak', 'tw-grp-fill', 'Mevcut kayıtta boş olan alanlar; varsayılan seçili.', fills.map(pickRow)), grp('Kontrol gerektiren alanlar', 'tw-grp-check', 'Dolu bir değeri değiştirir veya NC ile çelişir. Varsayılan seçili DEĞİL; yalnız doğruladıklarınızı işaretleyin.', checks.map(pickRow)), newByTool.length ? E('div', { 'data-testid': 'tw-grp-new', style: 'margin-top:8px' }, E('b', {}, `OP30 listesinde olmayan Excel takımları (${newByTool.length})`), E('div', { class: 'mut' }, 'Otomatik eklenmez; bu operasyonda kullanılan takımı siz işaretleyin.'), fold('Takımları göster', [E('div', { class: 'rows' }, ...newByTool)], false)) : null)
                    : E('div', { class: 'banner ok', 'data-testid': 'tw-diff-none' }, 'Bu Excel mevcut kayıtla aynı: uygulanacak değişiklik yok (yeni revizyon oluşmaz).');
                const unm = unmappedColumns(rd.grid, rd.m);
                diffHost.replaceChildren(E('div', { class: 'formbox' }, E('b', {}, `Excel karşılaştırması: ${name}`), E('div', { class: 'mut', 'data-testid': 'tw-diff-sum' }, `${rd.rows.length} Excel takımı okundu · listeyle eşleşen ${rd.rows.length - d.newTools.length} · OP30’da olmayan ${d.newTools.length} · doldurulacak alan ${fills.length} · kontrol gerektiren ${checks.length} · değişmeyen alan ${d.same} · listede olup Excel’de olmayan ${d.unmatched.length} (korunur, silinmez). Excel’deki boş hücreler mevcut veriyi silmez.`), unm.length ? E('div', { class: 'mut', 'data-testid': 'tw-unmapped' }, `Tanınmayan sütunlar (kullanılmadı, kaybolmadı): ${unm.join(' · ')}`) : null, fold('Sütun eşlemesi', [picker], noMap), list, E('div', { class: 'row' }, d.changes.length ? E('button', { class: 'primary', type: 'button', 'data-testid': 'tw-diff-apply', onClick: run(async () => {
                        // first Excel update on a tool list that has no working record yet: persist the original file's own values first (source Excel), so the later comparison still sees them and nothing is silently "filled" over them
                        if ((dirty || !hasServer) && !(await saveDraft()))
                            return;
                        const pick = sel.filter((x) => x.on).map((x) => x.c);
                        if (!pick.length) {
                            o.showErr(new Error('Uygulanacak değişiklik seçilmedi.'));
                            return;
                        }
                        const r = await api.toolistWorkApply(o.versionId, pick.map((c) => ({ t: c.t, field: c.field, value: c.next })), 'EXCEL', reasonIn.value.trim() || `Excel: ${name}`, { name, sha256: sha });
                        await o.onChanged(`Excel uygulandı: ${r.changed} alan, ${r.added} yeni takım. Orijinal belge değişmedi.`);
                    }) }, 'Seçilenleri uygula') : null, E('button', { class: 'ghost', type: 'button', onClick: () => diffHost.replaceChildren() }, 'Vazgeç'))));
            };
            draw();
        };
        fileIn.addEventListener('change', run(async () => { const f = fileIn.files?.[0]; if (!f)
            return; await showDiff(f.name, new Uint8Array(await f.arrayBuffer())); fileIn.value = ''; }));
        // ---- add a tool by hand
        const addIn = E('input', { 'data-testid': 'tw-add-no', placeholder: 'T no (ör. T14)', size: 8, 'aria-label': 'Yeni takım no' });
        const addBtn = E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'tw-add', onClick: () => { const t = normToolNo(addIn.value); if (!t) {
                o.showErr(new Error('Takım no “T” ve rakam olmalı (ör. T14).'));
                return;
            } if (table[t]) {
                o.showErr(new Error(`${t} zaten listede.`));
                return;
            } table[t] = { t, desc: '', type: '', dia: '', len: '', holder: '', offset: '', src: {} }; dirty = true; addIn.value = ''; drawRows(); } }, '+ Takım ekle');
        const nc = E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'tw-apply-nc', onClick: () => { let n = 0; for (const r of Object.values(table))
                if ((r.offset ?? '') === '' && ncSugg.has(r.t)) {
                    r.offset = ncSugg.get(r.t);
                    fromFile.delete(`${r.t}|offset`);
                    n += 1;
                } if (n) {
                dirty = true;
                if (!reasonIn.value.trim())
                    reasonIn.value = 'NC programındaki H önerileri uygulandı';
                drawRows();
            } } }, 'NC H önerilerini boş offsetlere yaz');
        if (![...ncSugg.keys()].length)
            nc.style.display = 'none';
        // ---- send to technical approval / technical approval / discard
        const d = work.draft;
        const act = [];
        if (!readOnlyState)
            act.push(E('button', { class: 'primary', type: 'button', 'data-testid': 'tw-save', onClick: run(async () => { if (await saveDraft())
                    await o.onChanged('Taslak kaydedildi. Teknik onaya gönderilene kadar üretimde geçerli sayılmaz.'); }) }, 'Taslağı kaydet'));
        if (!readOnlyState && d && d.state === 'DRAFT')
            act.push(E('button', { class: 'ghost', type: 'button', 'data-testid': 'tw-submit', onClick: run(async () => { if (dirty && !(await saveDraft()))
                    return; await api.toolistWorkSubmit(d.id, reasonIn.value.trim() || 'Teknik onaya gönderildi'); await o.onChanged('Teknik onaya gönderildi.'); }) }, 'Teknik onaya gönder'));
        if (!readOnlyState && d)
            act.push(E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'tw-discard', onClick: run(async () => { await api.toolistWorkDiscard(d.id, reasonIn.value.trim() || 'Taslak atıldı'); await o.onChanged('Taslak atıldı; onaylı revizyon aynen duruyor.'); }) }, 'Taslağı at'));
        const approve = (() => {
            if (!d || !work.canApprove || (d.state !== 'IN_REVIEW' && d.state !== 'DRAFT'))
                return null;
            const all = E('input', { type: 'checkbox', 'data-testid': 'tw-approve-all' });
            const note = E('input', { 'data-testid': 'tw-approve-note', placeholder: 'Neye göre doğruladınız? (ör. takım ayar föyü, ölçüm)' });
            return E('div', { class: 'formbox', 'data-testid': 'tw-approve' }, missBox, E('b', {}, d.state === 'DRAFT' ? 'Yürürlüğe al (aynı ekranda kaydet + onayla)' : 'Teknik onay'), E('label', { class: 'row', style: 'gap:6px' }, all, 'Takım no, çap, boy, tutucu, offset, CAM/NC uyumu ve tezgâh yapılandırmasını kontrol ettim'), E('div', { class: 'mut' }, note), E('button', { class: 'primary', type: 'button', 'data-testid': 'tw-approve-do', onClick: run(async () => {
                    if (!all.checked) {
                        o.showErr(new Error('Onaylamak için kutuyu işaretleyin.'));
                        return;
                    }
                    if (d.state === 'DRAFT') {
                        if (note.value.trim().length < 5) {
                            o.showErr(new Error('Yürürlüğe almak için kısa bir not yazın (en az 5 karakter): neye göre doğruladınız?'));
                            return;
                        }
                        if (dirty && !(await saveDraft()))
                            return;
                        await api.toolistWorkSubmit(d.id, note.value.trim());
                    }
                    await api.toolistWorkPublish(d.id, { tool_numbers: true, diameters: true, lengths: true, holders: true, offsets: true, cam_nc_match: true, machine_config: true }, note.value.trim());
                    await o.onChanged('Teknik onay kaydedildi: bu revizyon artık üretimde geçerli veridir. Belgenin yürürlüğe alınması Doküman Kontrol’dedir.');
                }) }, d.state === 'DRAFT' ? 'Yürürlüğe Al' : 'Teknik onayı ver'));
        })();
        const state = d ? (d.state === 'DRAFT' ? `Taslak r${d.revNo} (üretimde geçerli değil)` : `Teknik onayda r${d.revNo}`) : work.published ? `Teknik onaylı r${work.published.revNo}` : 'Çalışma kaydı yok';
        const todo = (work.draftChecks?.checks ?? []).filter((c) => c.status !== 'OK');
        const hist = work.history.slice(0, 40);
        drawRows();
        host.append(E('div', { class: 'formbox', 'data-testid': 'tw' }, E('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, E('b', {}, 'Takım verisi (KMI)'), chip(state, d ? 'warn' : work.published ? 'ok' : 'info', { 'data-testid': 'tw-state' }), E('span', { class: 'mut' }, o.versionState === 'APPROVED' || o.versionState === 'EFFECTIVE' ? 'Onaylı orijinal belge salt-okunur; değişiklikler ayrı çalışma revizyonunda tutulur.' : 'Orijinal dosya değişmez.')), summary, E('div', { class: 'tw-wrap' }, E('table', { class: 'tw-t' }, E('thead', {}, E('tr', {}, ...['T', 'Tanım', ...COLS.map((f) => FIELD_TR[f]), 'NC önerisi', 'Kaynak'].map((x) => E('th', {}, x)))), tbody)), readOnlyState ? E('div', { class: 'mut', 'data-testid': 'tw-ro' }, 'Bu tabloyu düzenleme yetkiniz yok (yalnız görüntüleme).') : E('div', { class: 'stack', style: 'gap:8px' }, E('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, addIn, addBtn, nc, E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'tw-excel', onClick: () => fileIn.click() }, 'Excel Yükle / Güncelle'), fileIn), E('div', { class: 'row' }, reasonIn), diffHost, E('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, ...act)), msg, approve, todo.length ? E('div', { 'data-testid': 'tw-todo' }, E('b', {}, `Taslakta yapılacaklar (${todo.length})`), ...todo.map((c) => E('div', { class: 'mut', 'data-code': c.code, 'data-status': c.status }, `${c.status === 'FAIL' ? 'HATA' : c.status === 'WARN' ? 'UYARI' : 'Sistem doğrulayamadı'} · ${c.label}: ${c.detail}`))) : null, hist.length ? fold(`Değişiklik geçmişi (${hist.length})`, hist.map((x) => E('div', { class: 'mut', 'data-testid': 'tw-hist' }, `r${x.revNo} · ${x.toolNo} ${FIELD_TR[x.field] ?? x.field}: ${x.old || 'boş'} → ${x.new || 'boş'} · ${SOURCE_TR[x.source] ?? x.source}${x.file ? ` (${x.file})` : ''} · ${new Date(x.at).toLocaleString('tr-TR')}`))) : null, E('button', { class: 'ghost sm', type: 'button', onClick: () => host.replaceChildren() }, 'Kapat')));
    }
    catch (e) {
        o.showErr(e);
    }
}
