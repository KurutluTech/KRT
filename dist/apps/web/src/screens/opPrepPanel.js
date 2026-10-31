// KMI-013 Teknik operasyon hazırlık formu (m0183: op_prep_list / op_prep_save / op_prep_set_status / op_prep_history).
// Rotada henüz olmayan operasyonlar (CUT/PREP, OP10, OP20, OP40 …) için tek, doldurulabilir hazırlık taslağı.
// Taslak; rota operasyonu, iş emri veya üretim kaydı DEĞİLDİR. Yetki, eksik hesabı, geçmiş ve belge ilişkileri sunucuda.
import { h } from '../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../errorText.js';
import { camRevText } from '../../../../packages/domain/src/camRevision.js';
import { DEFAULT_SLOTS, DOC_TYPE_TR, REF_TYPES, buildPayload, docsOfType, historyActionText, historyChanges, linkedNote, missingText, slotLabel, slotValid, slotsToShow, statusView } from '../../../../packages/domain/src/opPrep.js';
export { DEFAULT_SLOTS };
const CSS = '.opp{border:1px solid var(--line,#334155);border-radius:10px;padding:10px 12px;margin:10px 0}.opp .hd{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}.opp .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 14px;margin-top:10px}.opp label.f{display:flex;flex-direction:column;gap:4px}.opp label.f>span.l{font-size:12px;color:var(--mut,#94a3b8)}.opp input,.opp select,.opp textarea{width:100%;box-sizing:border-box}.opp .hint{font-size:12px;color:var(--warn,#d97706)}.opp .wide{grid-column:1/-1}.opp .ck{display:flex;flex-wrap:wrap;gap:4px 14px}.opp .ck label{display:flex;gap:6px;align-items:center}.opp .act{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.opp .stat{font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid currentColor}.opp .stat.ok{color:var(--ok,#16a34a)}.opp .stat.warn{color:var(--warn,#d97706)}.opp .stat.bad{color:var(--bad,#dc2626)}.opp .miss{color:var(--bad,#dc2626);font-size:13px;margin-top:4px}';
const dtf = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const when = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
const opt = (value, label, sel) => h('option', { value, ...(sel ? { selected: 'selected' } : {}) }, label);
function fld(label, input, hint, wide) { return h('label', { class: `f${wide ? ' wide' : ''}` }, h('span', { class: 'l' }, label), input, hint ? h('span', { class: 'hint' }, hint) : null); }

function slotCard(slot, draft, L, api, revisionId, reload) {
    const st = statusView(draft);
    const can = L.can ?? {};
    const ro = !can.edit;
    const d = draft ?? {};
    const msg = h('div', { 'data-testid': `opp-msg-${slot}` });
    const say = (text, bad) => msg.replaceChildren(h('div', { class: bad ? 'banner bad' : 'banner', style: 'margin-top:8px' }, text));
    // --- alanlar
    const inp = {};
    inp.opName = h('input', { value: d.opName ?? '', placeholder: slot === 'CUT_PREP' ? 'örn. Testere kesim + alın tornalama' : 'örn. ön tornalama', disabled: ro, 'data-testid': `opp-${slot}-name` });
    inp.machineId = h('select', { disabled: ro, 'data-testid': `opp-${slot}-machine` }, opt('', '— seçilmedi —', !d.machineId), ...(L.machines ?? []).map((m) => opt(m.id, m.name && m.name !== m.code ? `${m.code} · ${m.name}` : m.code, m.id === d.machineId)));
    const ncDocs = docsOfType(L.documents, ['NC_PROGRAM']);
    const ncHint = h('span', { class: 'hint' });
    inp.ncDocumentId = h('select', { disabled: ro, 'data-testid': `opp-${slot}-nc`, onChange: () => { ncHint.textContent = linkedNote(ncDocs.find((x) => x.id === inp.ncDocumentId.value)?.linkedOps); } },
        opt('', '— seçilmedi —', !d.ncDocumentId), ...ncDocs.map((x) => opt(x.id, `${x.title}${x.fileName ? ` · ${x.fileName}` : ''}${x.versionNo ? ` · v${x.versionNo}` : ''}`, x.id === d.ncDocumentId)));
    ncHint.textContent = linkedNote(ncDocs.find((x) => x.id === d.ncDocumentId)?.linkedOps);
    const camHint = h('span', { class: 'hint' });
    inp.camProgramId = h('select', { disabled: ro, 'data-testid': `opp-${slot}-cam`, onChange: () => { camHint.textContent = linkedNote((L.camPrograms ?? []).find((x) => x.id === inp.camProgramId.value)?.linkedOps); } },
        opt('', '— seçilmedi —', !d.camProgramId), ...(L.camPrograms ?? []).map((c) => opt(c.id, `${c.programNo} · ${camRevText(c.revision)} · ${c.status}`, c.id === d.camProgramId)));
    camHint.textContent = linkedNote((L.camPrograms ?? []).find((x) => x.id === d.camProgramId)?.linkedOps);
    const tlDocs = docsOfType(L.documents, ['TOOL_LIST']);
    const tlHint = h('span', { class: 'hint' });
    inp.toolListDocumentId = h('select', { disabled: ro, 'data-testid': `opp-${slot}-tl`, onChange: () => { tlHint.textContent = linkedNote(tlDocs.find((x) => x.id === inp.toolListDocumentId.value)?.linkedOps); } },
        opt('', '— seçilmedi —', !d.toolListDocumentId), ...tlDocs.map((x) => opt(x.id, `${x.title}${x.fileName ? ` · ${x.fileName}` : ''}`, x.id === d.toolListDocumentId)));
    tlHint.textContent = linkedNote(tlDocs.find((x) => x.id === d.toolListDocumentId)?.linkedOps);
    inp.fixture = h('textarea', { rows: 2, disabled: ro, placeholder: 'örn. Ø37 pens, 45 mm dışarıda', 'data-testid': `opp-${slot}-fixture` }, d.fixture ?? '');
    inp.setupMinutes = h('input', { inputmode: 'decimal', value: d.setupMinutes ?? '', disabled: ro, 'data-testid': `opp-${slot}-setup` });
    inp.cycleSeconds = h('input', { inputmode: 'decimal', value: d.cycleSeconds ?? '', disabled: ro, 'data-testid': `opp-${slot}-cycle` });
    inp.controlPlanNote = h('textarea', { rows: 2, disabled: ro, placeholder: 'Kontrol edilecek ölçüler, yöntem, sıklık', 'data-testid': `opp-${slot}-cp` }, d.controlPlanNote ?? '');
    inp.firstPieceRequired = h('select', { disabled: ro, 'data-testid': `opp-${slot}-fp` }, opt('', '— karar verilmedi —', d.firstPieceRequired == null), opt('true', 'Evet, ilk parça onayı gerekli', d.firstPieceRequired === true), opt('false', 'Hayır', d.firstPieceRequired === false));
    inp.firstPieceNote = h('input', { value: d.firstPieceNote ?? '', disabled: ro, placeholder: 'örn. kalite ölçüm cihazında tam ölçüm', 'data-testid': `opp-${slot}-fpnote` });
    const skillBoxes = (L.skills ?? []).map((s) => h('label', {}, h('input', { type: 'checkbox', value: s.code, checked: (d.skillCodes ?? []).includes(s.code), disabled: ro }), `${s.name}`));
    const refDocs = docsOfType(L.documents, REF_TYPES);
    const refBoxes = refDocs.map((x) => h('label', {}, h('input', { type: 'checkbox', value: x.id, checked: (d.referenceDocumentIds ?? []).includes(x.id), disabled: ro }), `${DOC_TYPE_TR[x.docType] ?? x.docType}: ${x.title}`));
    inp.note = h('textarea', { rows: 2, disabled: ro, 'data-testid': `opp-${slot}-note` }, d.note ?? '');
    const formValues = () => ({
        opName: inp.opName.value, machineId: inp.machineId.value, ncDocumentId: inp.ncDocumentId.value, camProgramId: inp.camProgramId.value, toolListDocumentId: inp.toolListDocumentId.value,
        fixture: inp.fixture.value, setupMinutes: inp.setupMinutes.value, cycleSeconds: inp.cycleSeconds.value, controlPlanNote: inp.controlPlanNote.value,
        firstPieceRequired: inp.firstPieceRequired.value === '' ? null : inp.firstPieceRequired.value, firstPieceNote: inp.firstPieceNote.value,
        skillCodes: skillBoxes.map((l) => l.querySelector('input')).filter((x) => x.checked).map((x) => x.value),
        referenceDocumentIds: refBoxes.map((l) => l.querySelector('input')).filter((x) => x.checked).map((x) => x.value), note: inp.note.value,
    });
    const busy = (on) => card.querySelectorAll('button').forEach((b) => { b.disabled = on; });
    const save = async () => {
        const { payload, errors, changed } = buildPayload(formValues(), draft);
        if (errors.length) return say(errors.join(' · '), true);
        if (!changed) return say('Değişiklik yok.');
        busy(true);
        try { await api.opPrepSave(revisionId, slot, payload, draft ? draft.rowVersion : null); await reload(slot, 'Kaydedildi.'); }
        catch (e) { busy(false); say(errorText(e), true); }
    };
    const setStatus = async (status) => {
        busy(true);
        try { await api.opPrepSetStatus(revisionId, slot, status, draft.rowVersion, null); await reload(slot, status === 'APPROVED' ? 'Teknik olarak onaylandı (rota RELEASE / üretim GO değildir).' : 'Durum güncellendi.'); }
        catch (e) { busy(false); say(errorText(e), true); }
    };
    const pending = () => buildPayload(formValues(), draft).changed;
    const actions = h('div', { class: 'act' },
        can.edit ? h('button', { class: 'pbtn', type: 'button', 'data-testid': `opp-${slot}-save`, onClick: () => void save() }, draft ? 'Kaydet' : 'Taslağı başlat / kaydet') : null,
        can.edit && draft && st.code === 'DRAFT' ? h('button', { class: 'pbtn ghost', type: 'button', 'data-testid': `opp-${slot}-submit`, onClick: () => (pending() ? say('Önce değişiklikleri kaydedin.', true) : void setStatus('READY_FOR_REVIEW')) }, 'Teknik incelemeye gönder') : null,
        can.approve && draft && st.code === 'READY' ? h('button', { class: 'pbtn', type: 'button', 'data-testid': `opp-${slot}-approve`, onClick: () => (pending() ? say('Kaydedilmemiş değişiklik var.', true) : void setStatus('APPROVED')) }, 'Teknik olarak onayla') : null,
        can.edit && draft && (st.code === 'READY' || st.code === 'APPROVED') ? h('button', { class: 'pbtn ghost', type: 'button', 'data-testid': `opp-${slot}-back`, onClick: () => void setStatus('DRAFT') }, 'Taslağa geri al') : null);
    const hist = draft ? h('details', { class: 'mut', style: 'margin-top:8px', 'data-testid': `opp-${slot}-history` }, h('summary', {}, 'Değişiklik geçmişi')) : null;
    if (hist) hist.addEventListener('toggle', async () => {
        if (!hist.open || hist.dataset.loaded) return; hist.dataset.loaded = '1';
        try {
            const rows = await api.opPrepHistory(revisionId, slot);
            hist.append(...(rows ?? []).slice().reverse().map((r) => { const ch = historyChanges(r); return h('div', { style: 'margin:4px 0' }, `${when(r.at)} · ${historyActionText(r.action)}${ch.length ? ` · ${ch.join(', ')}` : ''}${r.reason ? ` · ${r.reason}` : ''}`); }));
            if (!(rows ?? []).length) hist.append(h('div', {}, 'Kayıt yok.'));
        } catch (e) { hist.append(h('div', { class: 'banner bad' }, errorText(e))); }
    });
    const card = h('div', { class: 'opp', 'data-testid': `opp-slot-${slot}`, 'data-status': st.code },
        h('div', { class: 'hd' }, h('b', {}, slotLabel(slot)), h('span', { class: `stat ${st.tone}`, 'data-testid': `opp-${slot}-status` }, st.label),
            draft ? h('span', { class: 'mut' }, `sürüm ${draft.rowVersion} · son kayıt ${when(draft.updatedAt)}`) : null),
        h('div', { class: st.code === 'INCOMPLETE' ? 'miss' : 'mut', style: 'margin-top:4px' }, st.note),
        h('div', { class: 'grid' },
            fld('Operasyon adı', inp.opName), fld('Makine', inp.machineId),
            slot === 'CUT_PREP' ? null : fld('NC programı', inp.ncDocumentId, ncHint), slot === 'CUT_PREP' ? null : fld('CAM kaydı', inp.camProgramId, camHint),
            slot === 'CUT_PREP' ? null : fld('Takım listesi', inp.toolListDocumentId, tlHint), fld('Fikstür / bağlama', inp.fixture),
            fld('Hazırlık süresi (dk)', inp.setupMinutes), fld('Çevrim süresi (sn/parça)', inp.cycleSeconds),
            fld('Kalite kontrol planı', inp.controlPlanNote, null, true), fld('İlk parça (First Piece)', inp.firstPieceRequired), fld('İlk parça notu', inp.firstPieceNote),
            fld('Gerekli operatör yetkinlikleri', h('div', { class: 'ck', 'data-testid': `opp-${slot}-skills` }, ...(skillBoxes.length ? skillBoxes : [h('span', { class: 'mut' }, 'Yetkinlik kataloğu boş')])), null, true),
            fld('Referans belgeler (KMI\'de kayıtlı)', h('div', { class: 'ck', 'data-testid': `opp-${slot}-refs` }, ...(refBoxes.length ? refBoxes : [h('span', { class: 'mut' }, 'Bu ürüne kayıtlı teknik resim/STEP/fotoğraf yok')])), 'Belgeler tekrar yüklenmez; KMI\'deki kayıtlardan seçilir.', true),
            fld('Not', inp.note, null, true)),
        actions, msg, hist);
    return card;
}

export function drawOpPrep(host, api, { revisionId }) {
    const body = h('div', { 'data-testid': 'opp-body' });
    let loaded = false;
    const load = async (focusSlot, notice) => {
        if (!focusSlot) body.replaceChildren(h('div', { class: 'mut' }, 'Yükleniyor…'));
        try {
            const L = await api.opPrepList(revisionId);
            const drafts = new Map((L.drafts ?? []).map((d) => [d.slot, d]));
            const slots = slotsToShow(L.drafts, L.routingOps);
            const reload = (s, n) => load(s, n);
            const extra = h('input', { placeholder: 'örn. OP50', style: 'width:110px', 'data-testid': 'opp-add-slot' });
            const addRow = L.can?.edit ? h('div', { class: 'act' }, extra, h('button', { class: 'pbtn ghost', type: 'button', 'data-testid': 'opp-add-btn', onClick: () => {
                const s = extra.value.trim().toUpperCase();
                if (!slotValid(s)) { extra.setCustomValidity?.('OP10 biçiminde yazın'); extra.reportValidity?.(); return; }
                if (slots.includes(s) || (L.routingOps ?? []).some((o) => `OP${o.opNo}` === s)) { extra.value = ''; return; }
                body.querySelector('[data-testid="opp-cards"]')?.append(slotCard(s, null, L, api, revisionId, reload));
                extra.value = '';
            } }, 'Başka operasyon ekle')) : null;
            const routeNote = (L.routingOps ?? []).length ? `Rotada olan operasyonlar (${L.routingOps.map((o) => `OP${o.opNo}`).join(', ')}) bu formda değil, rota ekranında yönetilir.` : '';
            body.replaceChildren(
                h('div', { class: 'banner', style: 'margin:8px 0', 'data-testid': 'opp-scope-note' }, 'Bu form rotada henüz olmayan operasyonların teknik hazırlık taslağıdır. Kaydetmek veya onaylamak rotaya operasyon eklemez, iş emri, stok veya üretim kaydı oluşturmaz. ONAYLI = teknik inceleme tamam; rota RELEASE veya üretim GO değildir. ', routeNote),
                L.can?.edit ? null : h('div', { class: 'mut', 'data-testid': 'opp-readonly' }, 'Salt okunur: düzenleme için rota tanımlama yetkisi gerekir.'),
                notice ? h('div', { class: 'banner', 'data-testid': 'opp-notice' }, notice) : null,
                h('div', { 'data-testid': 'opp-cards' }, ...slots.map((s) => slotCard(s, drafts.get(s) ?? null, L, api, revisionId, reload))), addRow);
            if (focusSlot) body.querySelector(`[data-testid="opp-slot-${focusSlot}"]`)?.scrollIntoView?.({ block: 'nearest' });
        }
        catch (e) {
            body.replaceChildren(isSetupPending(e)
                ? h('div', { class: 'mut', 'data-testid': 'opp-not-enabled' }, 'Hazırlık formu bu ortamda henüz etkin değil (veritabanı güncellemesi bekliyor).')
                : h('div', { class: 'banner bad', 'data-testid': 'opp-err' }, errorText(e)));
        }
    };
    const det = h('details', { 'data-testid': 'opp-panel', style: 'margin-top:12px' }, h('style', {}, CSS),
        h('summary', { style: 'cursor:pointer;font-weight:700' }, 'Operasyon hazırlık formu — rotada olmayan operasyonlar (CUT/PREP, OP10, OP20, OP40)'), body);
    if (/[?&]hazirlik=1/.test(globalThis.location?.hash ?? '')) { det.open = true; loaded = true; void load(); }
    det.addEventListener('toggle', () => { if (det.open && !loaded) { loaded = true; void load(); } });
    return det;
}
export { missingText };
