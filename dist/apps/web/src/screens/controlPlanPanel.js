// 0142 — Kontrol planı: “Excel Yükle ve Onayla” · “Taslak Kaydet” · “Onayla” AYNI ekranda. Ayrı modül / çok aşamalı zincir yok.
// Eksik/belirsiz ölçüler açıkça listelenir ve onayı engeller; sistem hiçbir ölçüyü uydurmaz.
import { h } from '../../../../packages/ui/src/h.js';
import { bytesToHex } from '../../../../packages/domain/src/documents.js';
import { readXlsx } from '../../../../packages/domain/src/xlsxRead.js';
import { parseControlPlanGrid } from '../../../../packages/domain/src/controlPlanSheet.js';
import { readCsvGrid } from '../../../../packages/domain/src/toolListSheet.js';
import { chip } from '../kx.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids.filter((k) => k !== null));
const inflateRaw = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
const dt = (s) => (s ? new Date(s).toLocaleString('tr-TR') : '—');
const STATUS_TR = { DRAFT: 'Taslak', REVIEWED: 'Taslak', RELEASED: 'YÜRÜRLÜKTE', OBSOLETE: 'Eski sürüm' };
export async function drawControlPlan(host, api, o) {
    host.replaceChildren();
    if (!api.controlPlanList || !api.controlPlanSave || !api.controlPlanApprove)
        return;
    let data;
    try {
        data = await api.controlPlanList(o.revisionId);
    }
    catch {
        return; /* 0142 yok / yetki yok: eski görünüm kalır */
    }
    const can = data.canManage && data.revisionStatus !== 'OBSOLETE';
    const open = data.plans.filter((p) => p.status === 'DRAFT' || p.status === 'REVIEWED');
    const draft = open[0] ?? null;
    const released = data.plans.filter((p) => p.status === 'RELEASED');
    // ---- liste: sürüm · durum · yükleyen · onaylayan · tarih · kaynak
    host.append(E('div', { 'data-testid': 'cp-plans' }, ...data.plans.map((p) => E('div', { class: 'r', 'data-testid': 'cp-plan', 'data-status': p.status, style: 'display:block;margin:6px 0' }, E('b', {}, `OP${p.opNo ?? '—'} · v${p.version}`), ' ', chip(STATUS_TR[p.status] ?? p.status, p.status === 'RELEASED' ? 'ok' : p.status === 'OBSOLETE' ? 'off' : 'warn'), E('div', { class: 'mut' }, `${p.rows.length} karakteristik · Yükleyen: ${p.uploadedBy ?? '—'} (${dt(p.uploadedAt)})${p.releasedAt ? ` · Onaylayan: ${p.releasedBy ?? '—'} (${dt(p.releasedAt)})` : ''}${p.sourceFile ? ` · Kaynak: ${p.sourceFile}` : ''}`), p.approvalNote ? E('div', { class: 'mut' }, `Onay notu: ${p.approvalNote}`) : null, p.openItems.length ? E('div', { class: 'banner', 'data-testid': 'cp-open-items' }, E('b', {}, `Eksik / belirsiz ölçüler (${p.openItems.length}): `), p.openItems.map((i) => `${i.code} — ${i.text}`).join(' · ')) : null))));
    if (!can) {
        if (!data.canManage)
            host.append(E('div', { class: 'mut', 'data-testid': 'cp-nomanage' }, 'Kontrol planını yönetici ve yetkili kalite personeli yükler / onaylar.'));
        return;
    }
    // ---- yükleme alanı
    const opSel = E('select', { 'data-testid': 'cp-op', 'aria-label': 'Operasyon' }, ...o.opNos.map((n) => E('option', { value: String(n), ...(n === 30 ? { selected: true } : {}) }, `OP${n}`)));
    if (!o.opNos.includes(30))
        opSel.selectedIndex = 0;
    const file = E('input', { type: 'file', accept: '.xlsx,.csv', 'data-testid': 'cp-file' });
    const out = E('div', { 'data-testid': 'cp-preview' });
    const note = E('input', { type: 'text', placeholder: 'Onay notu (isteğe bağlı)', 'data-testid': 'cp-note', style: 'width:100%' });
    const verify = E('input', { type: 'checkbox', 'data-testid': 'cp-verified' });
    let parsed = null;
    let src = null;
    const saveRows = async () => {
        const op = Number(opSel.value);
        const r = parsed ? await api.controlPlanSave(o.revisionId, op, parsed.rows, parsed.openItems, src) : null;
        return r?.plan_id ?? '';
    };
    const bSave = E('button', { class: 'ghost sm', type: 'button', 'data-testid': 'cp-save', disabled: true }, 'Taslak Kaydet');
    const bUpApprove = E('button', { class: 'primary sm', type: 'button', 'data-testid': 'cp-upload-approve', disabled: true }, 'Excel Yükle ve Onayla');
    const bApprove = E('button', { class: 'primary sm', type: 'button', 'data-testid': 'cp-approve', ...(draft ? {} : { disabled: true }) }, draft ? `Onayla (v${draft.version})` : 'Onayla');
    const sync = () => {
        const ok = !!parsed && parsed.rows.length > 0;
        bSave.disabled = !ok;
        bUpApprove.disabled = !(ok && parsed.openItems.length === 0 && verify.checked);
        bApprove.disabled = !(draft && draft.openItems.length === 0 && verify.checked) || (!!parsed && ok);
    };
    const run = async (fn) => { [bSave, bUpApprove, bApprove].forEach((b) => { b.disabled = true; }); try {
        const m = await fn();
        await o.onChanged(m);
    }
    catch (e) {
        o.showErr(e);
        sync();
    } };
    file.addEventListener('change', async () => {
        parsed = null;
        src = null;
        out.replaceChildren();
        sync();
        const f = file.files?.[0];
        if (!f)
            return;
        try {
            const bytes = new Uint8Array(await f.arrayBuffer());
            src = { name: f.name, sha256: bytesToHex(await crypto.subtle.digest('SHA-256', bytes)) };
            let grid;
            if (/\.xlsx$/i.test(f.name)) {
                const sheets = await readXlsx(bytes, inflateRaw);
                grid = (sheets.find((x) => parseControlPlanGrid(x.rows).headerFound) ?? sheets[0])?.rows ?? [];
            }
            else
                grid = readCsvGrid(new TextDecoder().decode(bytes));
            parsed = parseControlPlanGrid(grid);
            if (!parsed.headerFound) {
                out.append(E('div', { class: 'banner', 'data-testid': 'cp-noheader' }, 'Başlık satırı bulunamadı. Beklenen sütunlar: Karakteristik kodu · Nominal · Alt tol. · Üst tol.'));
                return;
            }
            out.append(...[E('div', { 'data-testid': 'cp-summary' }, chip(`${parsed.rows.length} satır okundu`, 'ok'), ' ', parsed.openItems.length ? chip(`${parsed.openItems.length} eksik / belirsiz`, 'warn') : chip('eksik ölçü yok', 'ok')),
                parsed.openItems.length ? E('div', { class: 'banner', 'data-testid': 'cp-open-new' }, E('b', {}, 'Bu ölçüler yetkili kişi tarafından tamamlanmadan onay verilemez (uydurulmaz): '), parsed.openItems.map((i) => `${i.code} — ${i.text}`).join(' · ')) : null,
                parsed.toVerify.length ? E('div', { class: 'banner', 'data-testid': 'cp-toverify' }, `Dosya şu satırların NC/resim eşleşmesini “doğrulanmadı” olarak işaretlemiş: ${parsed.toVerify.join(', ')} — resimle karşılaştırmadan onaylamayın.`) : null,
                E('table', { class: 'kx-tbl' }, E('thead', {}, E('tr', {}, ...['Kod', 'Tanım', 'Nominal', 'Alt', 'Üst', 'Birim'].map((x) => E('th', {}, x)))), E('tbody', {}, ...parsed.rows.map((r) => E('tr', {}, E('td', {}, r.code), E('td', {}, r.description ?? ''), E('td', {}, String(r.nominal)), E('td', {}, String(r.tol_lower)), E('td', {}, String(r.tol_upper)), E('td', {}, r.unit)))))].filter((x) => x !== null));
        }
        catch (e) {
            o.showErr(e);
        }
        sync();
    });
    verify.addEventListener('change', sync);
    bSave.addEventListener('click', () => void run(async () => { await saveRows(); return 'Kontrol planı taslağı kaydedildi — onay bekliyor.'; }));
    bUpApprove.addEventListener('click', () => void run(async () => { const id = await saveRows(); await api.controlPlanApprove(id, true, note.value.trim() || null); return 'Kontrol planı onaylandı ve yürürlüğe girdi.'; }));
    bApprove.addEventListener('click', () => void run(async () => { await api.controlPlanApprove(draft.id, true, note.value.trim() || null); return 'Kontrol planı onaylandı ve yürürlüğe girdi.'; }));
    host.append(E('div', { class: 'kx-sub', 'data-testid': 'cp-form', style: 'margin-top:10px' }, E('div', { class: 'row' }, E('b', {}, 'Excel ile yükle'), ' ', opSel, ' ', file), out, E('label', { class: 'row', style: 'gap:6px;align-items:center' }, verify, E('span', {}, 'Ölçüleri teknik resimle karşılaştırıp doğruladım.')), note, E('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, bSave, bUpApprove, bApprove), E('div', { class: 'mut' }, released.length ? 'Yeni onay, mevcut yürürlükteki planı “eski sürüm” yapar; yeni plan hemen yürürlüğe girer.' : 'Onaylanan plan doğrudan yürürlüğe girer ve OP kontrol noktası hazırlığında görünür.')));
    sync();
}
