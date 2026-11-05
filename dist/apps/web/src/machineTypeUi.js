// KMI — MAKİNE TİPİ / SINIFLANDIRMA arayüzü (m0219). Yeni paralel sistem YOK: katalog = machine_type_profiles, yazma = machine_type_set / machine_profile_set / machine_create (sunucuda yetki + denetim).
// Düğmenin görünmesi yalnız kolaylıktır; yetkiyi SUNUCU karar verir (FORBIDDEN: MACHINE_TYPE_SET / MACHINE_CREATE). Serbest metin tip yoktur: seçenekler katalogdan gelir.
import { h } from '../../../packages/ui/src/h.js';
import { errorText } from './errorText.js';
export const MT_CSS = `
.mt{display:grid;gap:12px;max-width:900px}
.mt-card{padding:12px 14px;border-radius:14px;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a);min-width:0}
.mt-card h3{margin:0 0 6px;font-size:16px}
.mt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.mt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.mt label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--kmi-mut,#94a3b8);min-width:0}
.mt input,.mt select,.mt textarea{min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit;min-width:0;width:100%;box-sizing:border-box}
.mt textarea{min-height:64px}
.mt-btn{min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.12);color:inherit;font:inherit;font-weight:600;cursor:pointer}
.mt-btn.sec{border-color:var(--kmi-line,#1e2d4a);background:none}.mt-btn[disabled]{opacity:.5;cursor:not-allowed}
.mt-btn:focus-visible,.mt input:focus-visible,.mt select:focus-visible,.mt textarea:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.mt-chip{display:inline-block;padding:3px 10px;border-radius:999px;border:1px solid var(--kmi-line,#1e2d4a);font-size:12.5px;font-weight:600}
.mt-chip.ok{border-color:#22c55e;color:#86efac}.mt-chip.warn{border-color:#fbbf24;color:#fcd34d}.mt-chip.bad{border-color:#f87171;color:#fca5a5}
.mt-msg{font-size:13px;margin-top:6px}.mt-msg.bad{color:#f87171}.mt-msg.ok{color:#86efac}
.mt-caps{display:flex;gap:8px 14px;flex-wrap:wrap}.mt-caps label{flex-direction:row;align-items:center;gap:6px;color:inherit;font-size:14px}.mt-caps input{width:auto;min-height:24px}
.mt-tbl{width:100%;border-collapse:collapse;font-size:13px}.mt-tbl th,.mt-tbl td{padding:6px 8px;border-bottom:1px solid var(--kmi-line,#1e2d4a);text-align:left;vertical-align:top}
.mt-scroll{overflow-x:auto}
.mt-tbl{min-width:620px}.mt-tbl .mt-chip{display:inline-block;border-radius:10px;white-space:normal}.mt-tbl td:nth-child(4){min-width:200px}
@media (max-width:520px){.mt-btn{width:100%}}`;
export const UNCLASSIFIED = 'Henüz Sınıflandırılmadı';
const yn = (b) => (b ? 'Gerekli' : 'Gerekmez');
/** Gereksinim özeti — yalnız katalog satırından okunur (karar sunucuda). Tanımsız tip: SIKI. */
export function reqSummary(t) {
    if (!t) return { text: 'Tip bilinmiyor → eski SIKI kural: NC, CAM, takım listesi, süreler zorunlu', tone: 'warn' };
    if (!t.requirementsDefined) return { text: 'Bu tip için gereksinim profili henüz tanımlanmadı → SIKI kural (NC, CAM, takım listesi zorunlu) uygulanır', tone: 'warn' };
    return { text: `NC: ${yn(t.reqNc)} · CAM: ${yn(t.reqCam)} · Takım listesi: ${yn(t.reqCncToolList)} · Hazırlık süresi: ${yn(t.reqSetupTime)} · Çevrim/kesme süresi: ${yn(t.reqCutTime)}`, tone: 'ok' };
}
export const canTypeEdit = (access) => !!(access?.owner || access?.roles?.includes('ADMIN') || access?.actions?.includes('MACHINE_TYPE_SET'));
export const canUpdateMachine = (access) => !!(access?.owner || access?.roles?.includes('ADMIN') || access?.actions?.includes('MACHINE_UPDATE'));
export const canArchiveMachine = (access) => !!(access?.owner || access?.roles?.includes('ADMIN') || access?.actions?.includes('MACHINE_ARCHIVE'));
export const canManageCatalog = (access) => !!(access?.owner || access?.roles?.includes('ADMIN') || access?.actions?.includes('MACHINE_CATALOG_MANAGE'));
export const canCreateMachine = (access) => !!(access?.owner || access?.roles?.includes('ADMIN') || access?.actions?.includes('MACHINE_CREATE'));
export async function loadCatalog(sel) {
    const rows = await sel('machine_type_profiles', 'machine_type,label,req_nc,req_cam,req_cnc_tool_list,req_setup_time,req_cut_time,cutting_tool_type,requirement_profile,machine_class,subtypes,capability_options,sort_order,requirements_defined,active', { active: 'eq.true' }, 'sort_order.asc', 100);
    return rows ?? [];
}
const fld = (label, el, testid) => h('label', {}, label, el);
function typeSelect(catalog, value, testid) {
    const s = h('select', { 'data-testid': testid }, h('option', { value: '' }, UNCLASSIFIED), ...catalog.map((t) => h('option', { value: t.machineType }, t.label)));
    s.value = value ?? '';
    return s;
}
function capsBox(t, selected, testid) {
    const box = h('div', { class: 'mt-caps', 'data-testid': testid });
    const set = new Set(selected ?? []);
    for (const c of t?.capabilityOptions ?? []) { const cb = h('input', { type: 'checkbox', value: c }); cb.checked = set.has(c); box.append(h('label', {}, cb, c.replace(/_/g, ' '))); }
    box.value = () => [...box.querySelectorAll('input:checked')].map((x) => x.value);
    return box;
}
function subSelect(t, value, testid) {
    const s = h('select', { 'data-testid': testid }, h('option', { value: '' }, '— seçilmedi —'), ...(t?.subtypes ?? []).map((x) => h('option', { value: x }, x.replace(/_/g, ' '))));
    s.value = value ?? '';
    return s;
}
function impactView(imp) {
    const rows = imp.routeOps ?? [];
    const parts = [];
    const b = imp.blocking ?? {};
    if (b.blocked) parts.push(h('div', { class: 'mt-msg bad', 'data-testid': 'mt-blocked' }, `ENGELLİ: ${(b.runningOps ?? []).length} devam eden operasyon${b.qualityHoldOps ? `, ${b.qualityHoldOps} açık kalite yeniden kontrolü` : ''} var. Bunlar bitmeden/kapanmadan tip değişmez.`));
    else parts.push(h('div', { class: 'mt-msg ok', 'data-testid': 'mt-notblocked' }, 'Engel yok: değişiklik yapılabilir.'));
    if ((imp.pendingOps ?? []).length) parts.push(h('div', { class: 'mt-msg', 'data-testid': 'mt-pending' }, `Bu makinede bekleyen ${(imp.pendingOps).length} iş emri operasyonu yeni tipe göre yeniden değerlendirilir (kayıtları değişmez).`));
    if (imp.profileConflicts) parts.push(h('div', { class: 'mt-msg bad', 'data-testid': 'mt-conflict' }, `ÇELİŞKİ: ${imp.profileConflicts} operasyonun onaylı profili bu makine tipinin profiliyle uyuşmuyor. Sessizce biri seçilmez; ilgili operasyonları inceleyin.`));
    if (imp.toRequirementsDefined === false && imp.to) parts.push(h('div', { class: 'mt-msg', 'data-testid': 'mt-undefined' }, 'Seçilen tip için gereksinim profili tanımlı değil: SIKI kural uygulanır.'));
    const f = (a) => (Array.isArray(a) ? `${yn(a[0])} → ${yn(a[1])}` : '—');
    parts.push(h('div', { class: 'mt-scroll' }, h('table', { class: 'mt-tbl', 'data-testid': 'mt-impact-tbl' }, h('thead', {}, h('tr', {}, ...['OP', 'Ad', 'NC', 'CAM', 'Takım listesi', 'Profil', 'CAM belgesi'].map((x) => h('th', {}, x)))),
        h('tbody', {}, ...(rows.length ? rows.map((r) => h('tr', {}, h('td', {}, String(r.opNo)), h('td', {}, r.name), h('td', {}, f(r.ncRequired)), h('td', {}, f(r.camRequired)), h('td', {}, f(r.toolListRequired)), h('td', {}, r.profileConflict ? `ÇELİŞKİ (${r.opProfile} ≠ ${r.typeProfile})` : (r.opProfile ?? '—')), h('td', {}, r.camDocumentKept ? 'Korunur' : '—'))) : [h('tr', {}, h('td', { colspan: 7 }, 'Bu makineyi kullanan aktif rota operasyonu yok'))])))));
    parts.push(h('div', { class: 'mt-msg' }, imp.note));
    return h('div', { 'data-testid': 'mt-impact' }, ...parts);
}
/** Makine pasaportu: MAKİNE TİPİ / SINIFLANDIRMA bölümü. io = { sel, rpc }. */
export async function renderMachineTypePanel(host, io, machine, access, onChanged = () => {}) {
    host.replaceChildren(h('div', {}, 'Yükleniyor…'));
    let catalog; let row;
    try {
        catalog = await loadCatalog(io.sel);
        row = (await io.sel('machines', 'id,code,name,machine_type,machine_subtype,capabilities,manufacturer,model,machine_class,archived_at,archive_reason', { id: `eq.${machine.id}` }, undefined, 1))?.[0];
    } catch (e) { host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'mt-error' }, errorText(e))); return; }
    const cur = catalog.find((t) => t.machineType === row?.machineType) ?? null;
    const rs = reqSummary(cur);
    const may = canTypeEdit(access);
    const root = h('div', { class: 'mt', 'data-testid': 'mt-root' }, h('style', {}, MT_CSS));
    root.append(h('div', { class: 'mt-card' }, h('h3', {}, 'Makine tipi / sınıflandırma'),
        h('div', { class: 'mt-row' }, h('span', { class: `mt-chip ${cur ? 'ok' : 'warn'}`, 'data-testid': 'mt-current' }, cur ? cur.label : UNCLASSIFIED), h('span', { 'data-testid': 'mt-current-code' }, row?.machineType ?? ''), row?.machineSubtype ? h('span', { class: 'mt-chip' }, `Alt tip: ${row.machineSubtype.replace(/_/g, ' ')}`) : null, ...(row?.capabilities ?? []).map((c) => h('span', { class: 'mt-chip' }, c.replace(/_/g, ' ')))),
        h('div', { class: `mt-msg ${rs.tone === 'warn' ? '' : 'ok'}`, 'data-testid': 'mt-req' }, rs.text),
        h('div', { class: 'mt-msg' }, `Üretici / model: ${[row?.manufacturer, row?.model].filter(Boolean).join(' / ') || 'girilmemiş'}`)));
    if (row?.archivedAt) { root.append(h('div', { class: 'mt-card', 'data-testid': 'mt-archived' }, h('span', { class: 'mt-chip bad' }, 'ARŞİVLİ'), ' Arşivli makinede tip/alt tip değiştirilmez; önce arşivden çıkarın.')); host.replaceChildren(root); return; }
    if (!may) { root.append(h('div', { class: 'mt-card', 'data-testid': 'mt-readonly' }, 'Makine tipini değiştirme yetkiniz yok (MACHINE_TYPE_SET). Yetki, Yetki Yönetimi’nden kişiye verilir; kontrol sunucudadır.')); host.replaceChildren(root); return; }
    // --- tip değiştir
    const sel = typeSelect(catalog, row?.machineType, 'mt-type'); const reason = h('textarea', { 'data-testid': 'mt-reason', placeholder: 'Gerekçe (en az 20 karakter) — denetim kaydına yazılır' });
    const out = h('div', { 'data-testid': 'mt-out' }); const msg = h('div', { class: 'mt-msg', 'data-testid': 'mt-msg' });
    const prev = h('button', { type: 'button', class: 'mt-btn sec', 'data-testid': 'mt-preview' }, 'Etkiyi göster'); const save = h('button', { type: 'button', class: 'mt-btn', 'data-testid': 'mt-save', disabled: true }, 'Tipi kaydet');
    let lastImpact = null;
    const target = () => (sel.value === '' ? null : sel.value);
    sel.addEventListener('change', () => { save.disabled = true; lastImpact = null; out.replaceChildren(); });
    prev.addEventListener('click', async () => {
        prev.disabled = true; msg.textContent = ''; msg.className = 'mt-msg';
        try { lastImpact = await io.rpc('machine_type_impact', { p_machine: machine.id, p_type: target() }); out.replaceChildren(impactView(lastImpact)); save.disabled = !!(lastImpact.blocking?.blocked || lastImpact.noChange); if (lastImpact.noChange) { msg.textContent = 'Seçilen tip zaten kayıtlı.'; } }
        catch (e) { msg.textContent = errorText(e); msg.className = 'mt-msg bad'; }
        prev.disabled = false;
    });
    save.addEventListener('click', async () => {
        if ((reason.value ?? '').trim().length < 20) { msg.textContent = 'Gerekçe en az 20 karakter olmalı.'; msg.className = 'mt-msg bad'; return; }
        if (!lastImpact) { msg.textContent = 'Önce "Etkiyi göster" ile etkilenen operasyonları görün.'; msg.className = 'mt-msg bad'; return; }
        save.disabled = true;
        try { const r = await io.rpc('machine_type_set', { p_machine: machine.id, p_type: target(), p_reason: reason.value.trim() }); msg.textContent = `Kaydedildi: ${r.from ?? 'tipsiz'} → ${r.to ?? 'tipsiz'}. Operasyon gereksinimleri otomatik yeniden hesaplanır; eski NC/CAM/takım belgeleri silinmedi.`; msg.className = 'mt-msg ok'; onChanged(); await renderMachineTypePanel(host, io, machine, access, onChanged); }
        catch (e) { msg.textContent = errorText(e); msg.className = 'mt-msg bad'; save.disabled = false; }
    });
    root.append(h('div', { class: 'mt-card', 'data-testid': 'mt-edit' }, h('h3', {}, 'Tipi değiştir'), h('div', { class: 'mt-grid' }, fld('Makine tipi (katalogdan)', sel), fld('Gerekçe', reason)), h('div', { class: 'mt-row', style: 'margin-top:8px' }, prev, save), msg, out));
    // --- alt tip + kabiliyet
    if (cur) {
        const ss = subSelect(cur, row.machineSubtype, 'mt-subtype'); const caps = capsBox(cur, row.capabilities, 'mt-caps'); const r2 = h('textarea', { 'data-testid': 'mt-reason2', placeholder: 'Gerekçe (en az 20 karakter)' }); const m2 = h('div', { class: 'mt-msg', 'data-testid': 'mt-msg2' });
        const sv2 = h('button', { type: 'button', class: 'mt-btn', 'data-testid': 'mt-save2' }, 'Alt tip ve kabiliyetleri kaydet');
        sv2.addEventListener('click', async () => { sv2.disabled = true; try { await io.rpc('machine_profile_set', { p_machine: machine.id, p_subtype: ss.value || null, p_capabilities: caps.value(), p_reason: r2.value.trim() }); m2.textContent = 'Kaydedildi.'; m2.className = 'mt-msg ok'; await renderMachineTypePanel(host, io, machine, access, onChanged); } catch (e) { m2.textContent = errorText(e); m2.className = 'mt-msg bad'; sv2.disabled = false; } });
        root.append(h('div', { class: 'mt-card', 'data-testid': 'mt-profile' }, h('h3', {}, 'Alt tip ve teknik kabiliyetler'), h('div', { class: 'mt-grid' }, fld('Alt tip', ss), fld('Gerekçe', r2)), h('div', { style: 'margin-top:8px' }, caps), h('div', { class: 'mt-row', style: 'margin-top:8px' }, sv2), m2));
        // mevcut tipin rota çelişkileri (sessizce çözülmez)
    }
    host.replaceChildren(root);
    if (cur) { try { const imp = await io.rpc('machine_type_impact', { p_machine: machine.id, p_type: row.machineType }); if (imp.profileConflicts) root.append(h('div', { class: 'mt-card', 'data-testid': 'mt-current-conflicts' }, h('h3', {}, 'Rota çelişkileri'), impactView(imp))); } catch { /* önizleme okunamazsa panel çalışır */ } }
}
/** Yeni makine ekle formu. io = { sel, rpc }. */
export async function renderMachineCreateForm(host, io, access, onDone = () => {}) {
    host.replaceChildren(h('div', {}, 'Yükleniyor…'));
    let catalog; try { catalog = await loadCatalog(io.sel); } catch (e) { host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'mc-error' }, errorText(e))); return; }
    const root = h('div', { class: 'mt', 'data-testid': 'mc-root' }, h('style', {}, MT_CSS), h('h1', { style: 'margin:6px 0;font-size:24px' }, 'Yeni makine ekle'));
    if (!canCreateMachine(access)) { root.append(h('div', { class: 'mt-card', 'data-testid': 'mc-readonly' }, 'Makine ekleme yetkiniz yok (MACHINE_CREATE). Kontrol sunucudadır; yetki Yetki Yönetimi’nden verilir.')); host.replaceChildren(root); return; }
    const code = h('input', { type: 'text', 'data-testid': 'mc-code', maxlength: 30, autocomplete: 'off' }); const name = h('input', { type: 'text', 'data-testid': 'mc-name', autocomplete: 'off' });
    const man = h('input', { type: 'text', 'data-testid': 'mc-man', autocomplete: 'off' }); const mod = h('input', { type: 'text', 'data-testid': 'mc-model', autocomplete: 'off' });
    const type = typeSelect(catalog, '', 'mc-type'); const subHost = h('div'); const capHost = h('div'); const reason = h('textarea', { 'data-testid': 'mc-reason', placeholder: 'Gerekçe (en az 20 karakter) — denetim kaydına yazılır' });
    let sub = subSelect(null, '', 'mc-subtype'); let caps = capsBox(null, [], 'mc-caps'); const info = h('div', { class: 'mt-msg', 'data-testid': 'mc-req' }, reqSummary(null).text);
    const redraw = () => { const t = catalog.find((x) => x.machineType === type.value) ?? null; sub = subSelect(t, '', 'mc-subtype'); caps = capsBox(t, [], 'mc-caps'); subHost.replaceChildren(fld('Alt tip', sub)); capHost.replaceChildren(fld('Teknik kabiliyetler', caps)); info.textContent = reqSummary(t).text; };
    type.addEventListener('change', redraw); redraw();
    const msg = h('div', { class: 'mt-msg', 'data-testid': 'mc-msg' }); const go = h('button', { type: 'button', class: 'mt-btn', 'data-testid': 'mc-save' }, 'Makineyi kaydet');
    go.addEventListener('click', async () => {
        go.disabled = true; msg.textContent = ''; msg.className = 'mt-msg';
        try { const r = await io.rpc('machine_create', { p_code: code.value, p_name: name.value, p_manufacturer: man.value || null, p_model: mod.value || null, p_type: type.value || null, p_subtype: sub.value || null, p_capabilities: caps.value(), p_reason: reason.value.trim() }); msg.textContent = `Makine kaydedildi: ${r.code}. Varlık kaydına bağlandı. Operasyon gereksinimleri makine tipinden otomatik türetilir.`; msg.className = 'mt-msg ok'; onDone(r); }
        catch (e) { msg.textContent = errorText(e); msg.className = 'mt-msg bad'; }
        go.disabled = false;
    });
    root.append(h('div', { class: 'mt-card' }, h('div', { class: 'mt-grid' }, fld('Makine kodu', code), fld('Makine adı', name), fld('Üretici', man), fld('Model', mod), fld('Ana makine tipi (katalogdan)', type), subHost), h('div', { style: 'margin-top:8px' }, capHost), info, h('div', { class: 'mt-grid', style: 'margin-top:8px' }, fld('Gerekçe', reason)), h('div', { class: 'mt-row', style: 'margin-top:8px' }, go, h('a', { class: 'mt-btn sec', href: '#/makineler', style: 'text-decoration:none;display:inline-flex;align-items:center' }, 'Makine kartlarına dön')), msg));
    host.replaceChildren(root);
}

/** Makine bilgisi (ad / üretici / model) düzenleme + arşivleme. Kod DEĞİŞMEZ (kimliktir). Yetki: MACHINE_UPDATE, MACHINE_ARCHIVE (sunucuda zorunlu). */
export async function renderMachineInfoPanel(host, io, machine, access, onChanged = () => {}) {
    host.replaceChildren(h('div', {}, 'Yükleniyor…'));
    let row; try { row = (await io.sel('machines', 'id,code,name,manufacturer,model,archived_at,archive_reason', { id: `eq.${machine.id}` }, undefined, 1))?.[0]; } catch (e) { host.replaceChildren(h('div', { class: 'ps-banner', 'data-testid': 'mi-error' }, errorText(e))); return; }
    const root = h('div', { class: 'mt', 'data-testid': 'mi-root' }, h('style', {}, MT_CSS));
    const archived = !!row?.archivedAt;
    root.append(h('div', { class: 'mt-card' }, h('h3', {}, 'Makine bilgisi'), h('div', { class: 'mt-row' }, h('span', { class: 'mt-chip' }, `Kod: ${row?.code ?? machine.code}`), archived ? h('span', { class: 'mt-chip bad', 'data-testid': 'mi-archived' }, 'ARŞİVLİ') : h('span', { class: 'mt-chip ok' }, 'Aktif')), archived && row.archiveReason ? h('div', { class: 'mt-msg' }, `Arşiv gerekçesi: ${row.archiveReason}`) : null,
        h('div', { class: 'mt-msg' }, 'Makine kodu kimliktir ve değiştirilemez.')));
    if (canUpdateMachine(access) && !archived) {
        const name = h('input', { type: 'text', 'data-testid': 'mi-name', value: row?.name ?? '' }); const man = h('input', { type: 'text', 'data-testid': 'mi-man', value: row?.manufacturer ?? '' }); const mod = h('input', { type: 'text', 'data-testid': 'mi-model', value: row?.model ?? '' });
        const reason = h('textarea', { 'data-testid': 'mi-reason', placeholder: 'Gerekçe (en az 20 karakter)' }); const msg = h('div', { class: 'mt-msg', 'data-testid': 'mi-msg' }); const go = h('button', { type: 'button', class: 'mt-btn', 'data-testid': 'mi-save' }, 'Bilgiyi kaydet');
        go.addEventListener('click', async () => { go.disabled = true; msg.textContent = ''; try { await io.rpc('machine_update', { p_machine: machine.id, p_name: name.value, p_manufacturer: man.value || null, p_model: mod.value || null, p_reason: reason.value.trim() }); onChanged(); await renderMachineInfoPanel(host, io, machine, access, onChanged); } catch (e) { msg.textContent = errorText(e); msg.className = 'mt-msg bad'; go.disabled = false; } });
        root.append(h('div', { class: 'mt-card', 'data-testid': 'mi-edit' }, h('h3', {}, 'Bilgiyi düzenle'), h('div', { class: 'mt-grid' }, fld('Makine adı', name), fld('Üretici', man), fld('Model', mod), fld('Gerekçe', reason)), h('div', { class: 'mt-row', style: 'margin-top:8px' }, go), msg));
    }
    if (canArchiveMachine(access)) {
        const reason = h('textarea', { 'data-testid': 'ma-reason', placeholder: 'Gerekçe (en az 20 karakter)' }); const msg = h('div', { class: 'mt-msg', 'data-testid': 'ma-msg' });
        const go = h('button', { type: 'button', class: 'mt-btn sec', 'data-testid': 'ma-go' }, archived ? 'Arşivden çıkar' : 'Makineyi arşivle');
        go.addEventListener('click', async () => { go.disabled = true; msg.textContent = ''; try { await io.rpc('machine_archive', { p_machine: machine.id, p_archive: !archived, p_reason: reason.value.trim() }); onChanged(); await renderMachineInfoPanel(host, io, machine, access, onChanged); } catch (e) { msg.textContent = errorText(e); msg.className = 'mt-msg bad'; go.disabled = false; } });
        root.append(h('div', { class: 'mt-card', 'data-testid': 'ma-card' }, h('h3', {}, archived ? 'Arşivden çıkar' : 'Arşivle'), h('div', { class: 'mt-msg' }, archived ? 'Makine yeniden kullanıma alınır; varlık kaydı ACTIVE olur.' : 'Silinmez; geçmiş korunur. Aktif rota operasyonu veya açık iş emri operasyonu varken arşivlenemez.'), h('div', { class: 'mt-grid', style: 'margin-top:6px' }, fld('Gerekçe', reason)), h('div', { class: 'mt-row', style: 'margin-top:8px' }, go), msg));
    }
    host.replaceChildren(root);
}
const codes = (v) => (v ?? '').split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
/** Katalog genişletme (MACHINE_CATALOG_MANAGE): yeni tip / mevcut tipe alt tip ve kabiliyet ekleme. Yeni tip SIKI doğar (sunucu zorlar). */
export async function renderCatalogPanel(host, io, access, onDone = () => {}) {
    host.replaceChildren();
    if (!canManageCatalog(access)) return;
    let catalog = []; try { catalog = await loadCatalog(io.sel); } catch { catalog = []; }
    const code = h('input', { type: 'text', 'data-testid': 'cat-code', placeholder: 'Örn. LASER (mevcut tip kodu = ekleme)', maxlength: 40 }); const label = h('input', { type: 'text', 'data-testid': 'cat-label', placeholder: 'Ad (yeni tip için zorunlu)' });
    const cls = h('select', { 'data-testid': 'cat-class' }, h('option', { value: '' }, '— sınıf (isteğe bağlı) —'), ...[['MACHINING', 'İşleme'], ['MEASUREMENT', 'Ölçüm'], ['MATERIAL_HANDLING', 'Malzeme taşıma'], ['AUXILIARY', 'Yardımcı']].map(([v, t]) => h('option', { value: v }, t)));
    const st = h('input', { type: 'text', 'data-testid': 'cat-sub', placeholder: 'Alt tip kodları (virgülle): FIBER, CO2' }); const cp = h('input', { type: 'text', 'data-testid': 'cat-cap', placeholder: 'Kabiliyet kodları (virgülle)' });
    const reason = h('textarea', { 'data-testid': 'cat-reason', placeholder: 'Gerekçe (en az 20 karakter)' }); const msg = h('div', { class: 'mt-msg', 'data-testid': 'cat-msg' }); const go = h('button', { type: 'button', class: 'mt-btn', 'data-testid': 'cat-save' }, 'Kataloğa ekle');
    go.addEventListener('click', async () => { go.disabled = true; msg.textContent = ''; msg.className = 'mt-msg'; try { const r = await io.rpc('machine_type_catalog_set', { p_type: code.value, p_label: label.value || null, p_machine_class: cls.value || null, p_add_subtypes: codes(st.value), p_add_capabilities: codes(cp.value), p_reason: reason.value.trim() }); msg.textContent = r.note; msg.className = 'mt-msg ok'; onDone(r); } catch (e) { msg.textContent = errorText(e); msg.className = 'mt-msg bad'; } go.disabled = false; });
    host.append(h('div', { class: 'mt', 'data-testid': 'cat-root' }, h('style', {}, MT_CSS), h('div', { class: 'mt-card' }, h('h3', {}, 'Tip kataloğunu genişlet'),
        h('div', { class: 'mt-msg' }, `Mevcut tipler: ${catalog.map((t) => t.machineType).join(', ') || '—'}. Yeni tip gereksinimleri SIKI başlar (NC, CAM, takım listesi, süreler zorunlu); gevşetme owner kararıdır ve bu ekrandan yapılamaz.`),
        h('div', { class: 'mt-grid', style: 'margin-top:8px' }, fld('Tip kodu', code), fld('Ad', label), fld('Makine sınıfı', cls), fld('Eklenecek alt tipler', st), fld('Eklenecek kabiliyetler', cp), fld('Gerekçe', reason)), h('div', { class: 'mt-row', style: 'margin-top:8px' }, go), msg)));
}
/** OPERASYON PASAPORTU: makine tipi / profil uyumluluğu. Salt okunur bilgi; START kararı sunucu kapılarından gelir (taklit edilmez). */
export async function renderOpMachineCompat(host, fetchCompat, opId) {
    host.replaceChildren();
    let c; try { c = await fetchCompat(opId); } catch { host.append(h('div', { class: 'mut', 'data-testid': 'omc-na' }, 'Makine uyumluluğu okunamadı (kurulum bekleniyor olabilir).')); return; }
    if (!c) return;
    const f = (b) => (b ? 'Gerekli' : 'Gerekmez');
    const rows = (c.machines ?? []).map((m) => h('tr', { 'data-testid': 'omc-row', 'data-code': m.code },
        h('td', {}, `${m.code}${m.primary ? ' (birincil)' : ''}`), h('td', {}, m.typed ? `${m.typeLabel}${m.subtype ? ` · ${m.subtype.replace(/_/g, ' ')}` : ''}` : 'Tip girilmemiş → SIKI'),
        h('td', {}, `${f(m.reqNc)} / ${f(m.reqCam)} / ${f(m.reqToolList)}`),
        h('td', {}, m.profileConflict ? h('span', { class: 'mt-chip bad', 'data-testid': 'omc-conflict' }, `ÇELİŞKİ: operasyon ${c.opProfile} ≠ makine tipi ${m.typeProfile}`) : m.profileUnverifiable ? h('span', { class: 'mt-chip warn' }, 'Doğrulanamaz (tip profili tanımsız)') : h('span', { class: 'mt-chip ok' }, 'Uyumlu')),
        h('td', {}, m.archived ? h('span', { class: 'mt-chip bad' }, 'ARŞİVLİ') : ''), h('td', {}, (m.capabilities ?? []).join(', ') || '—')));
    host.append(h('div', { class: 'mt', 'data-testid': 'omc-root', style: 'margin-bottom:10px' }, h('style', {}, MT_CSS), h('div', { class: 'mt-card' }, h('h3', {}, 'Makine tipi ve uyumluluk'),
        h('div', { class: 'mt-msg' }, `Operasyon gereksinim profili: ${c.opProfile ?? 'beyan edilmemiş'} · Hazırlık: ${c.setupMinutes ?? '—'} dk · Çevrim: ${c.cycleSeconds ?? '—'} sn · İlk parça: ${c.firstPieceRequired ? 'zorunlu' : 'değil'} · Kalite kontrolü: ${c.qcRequired ? 'zorunlu' : 'değil'}`),
        c.profileConflicts ? h('div', { class: 'mt-msg bad', 'data-testid': 'omc-conflict-banner' }, `${c.profileConflicts} makinede profil ÇELİŞKİSİ var: sessizce biri seçilmez; operasyon profili veya makine tipi gözden geçirilmeli.`) : null,
        c.primaryInAllowed === false ? h('div', { class: 'mt-msg bad' }, 'Birincil makine izinli makineler arasında değil.') : null,
        c.anyUntyped ? h('div', { class: 'mt-msg' }, 'Tipi girilmemiş makine var: gereksinimler SIKI uygulanır (makine pasaportundan tip seçilir).') : null,
        h('div', { class: 'mt-scroll' }, h('table', { class: 'mt-tbl' }, h('thead', {}, h('tr', {}, ...['Makine', 'Tip / alt tip', 'NC / CAM / Takım listesi', 'Uyum', '', 'Kabiliyet'].map((x) => h('th', {}, x)))), h('tbody', {}, ...rows))),
        h('div', { class: 'mt-msg' }, 'START ve iş emri hazırlık kararı bu görünümden alınmaz; aşağıdaki durum çipleri sunucu kapılarının sonucudur.'))));
}
