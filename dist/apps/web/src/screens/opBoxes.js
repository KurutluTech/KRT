// Rota operasyonlarını kutu kutu gösteren görünüm. Yeni veri/kaynak YOK: ProductWorkspaceScreen'in zaten yüklediği ws.routing ve teknik zincir
// (NC/CAM/takım) verisinden çizilir. Sürükleme/okla taşıma yalnız ÖNİZLEMEDİR; kayıt, açık gerekçeyle tek `routing_reorder` çağrısıdır
// (sunucu OP10/20/30'u yeniden hesaplar, kalıcı operasyon kimliği, belge ve kalite planı bağlarını taşır; CUT/PREP sabit kalır).
import { h } from '../../../../packages/ui/src/h.js';

// Sunucu product_workspace çıktısı CUT/PREP için op_code'u 'OP1' verir ve op_kind göndermez; op_no=1 CUT/PREP'e AYRILMIŞTIR (routing_cut_prep_save / routing_reorder). Yanlış sürükleme riskine karşı üçü de kontrol edilir.
export const isCutPrep = (o) => o.opKind === 'CUT_PREP' || o.opCode === 'CUT/PREP' || o.opNo === 1;
/** Görünen ad: CUT/PREP numaralı CNC operasyonu değildir — hayalet "OP1" gösterilmez. Kimlik (id) değişmez; ön koşullar kalıcı operasyon kimliğiyle tutulur. */
export const opLabel = (o) => (o && isCutPrep(o) ? 'CUT/PREP' : (o?.opCode ?? ''));
/** Geçmiş/olay metinlerinde "OP1" → CUT/PREP (yalnız tam kelime). */
export const fixCutPrepText = (t) => (typeof t === 'string' ? t.replace(/\bOP0?1\b/g, 'CUT/PREP') : t);
/** Sürüklenebilir (CUT/PREP dışı, aktif) operasyonlar — mevcut sırayla. */
export const movableOps = (ops) => ops.filter((o) => o.active && !isCutPrep(o)).slice().sort((a, b) => a.opNo - b.opNo);
/** from → to taşıma; yeni dizi döner (girdi değişmez). */
export function moveInOrder(order, from, to) {
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order.slice();
    const a = order.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a;
}
/** Sıralamanın sunucuda alacağı kodlar: sıra*10 → OP10, OP20 … (sunucudaki routing_reorder ile aynı kural). */
export const previewCode = (index) => `OP${(index + 1) * 10}`;
export const sameOrder = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export const BOX_CSS = `.pw .obx{display:flex;flex-wrap:wrap;align-items:stretch;gap:6px;margin:6px 0}
.pw .obx .bx{flex:1 1 190px;max-width:260px;border:1px solid #334155;border-radius:10px;padding:8px 10px;cursor:pointer;display:flex;flex-direction:column;gap:4px;background:rgba(148,163,184,.06);text-align:left;color:inherit;font:inherit}
.pw .obx .bx:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}.pw .obx .bx.sel{border-color:#60a5fa;background:rgba(96,165,250,.12)}.pw .obx .bx.drag{opacity:.45}.pw .obx .bx.over{border-color:#f59e0b}.pw .obx .bx.fixed{cursor:pointer;border-style:dashed}
.pw .obx .bh{display:flex;justify-content:space-between;gap:6px;align-items:baseline}.pw .obx .bc{font-weight:700}.pw .obx .bn{font-size:13px;overflow-wrap:anywhere}.pw .obx .bm{font-size:12px;color:#94a3b8}
.pw .obx .bchips{display:flex;flex-wrap:wrap;gap:3px}.pw .obx .bchips .chip{white-space:normal;line-height:1.25}.pw .obx .mv{display:flex;gap:4px}.pw .obx .mv button{min-width:34px;min-height:30px}
.pw .obx .plus{align-self:center;min-width:34px;min-height:34px;border-radius:50%;border:1px dashed #64748b;background:transparent;color:inherit;cursor:pointer;font-size:18px;line-height:1}
.pw .obar{border:1px solid #f59e0b;border-radius:10px;padding:8px 10px;margin:6px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pw .opsbox .oph{display:none}.pw .opsbox .opc:not(.open){display:none}`;

/** host: kutuların çizileceği eleman. s: { ops, chainOf, chainChips, stateChip, canEdit, canAdd, openId, pending, setPending, onOpen, onSave, onInsert, chip } */
export function drawOpBoxes(host, s) {
    const movable = movableOps(s.ops);
    const baseIds = movable.map((o) => o.id);
    let order = s.pending && s.pending.length === baseIds.length && [...s.pending].sort().join() === [...baseIds].sort().join() ? s.pending.slice() : baseIds.slice();
    const byId = new Map(movable.map((o) => [o.id, o]));
    const cut = s.ops.find((o) => o.active && isCutPrep(o));
    const dirty = () => !sameOrder(order, baseIds);
    let dragFrom = -1;
    const set = (o2) => { order = o2; s.setPending?.(dirty() ? order.slice() : null); draw(); };
    const prepWord = (o) => { const c = s.chainOf?.(o); return c ? s.chainChips(c) : []; };
    const box = (o, idx, fixed) => {
        const code = fixed ? 'CUT/PREP' : (dirty() ? previewCode(idx) : o.opCode);
        const moved = !fixed && dirty() && previewCode(idx) !== o.opCode;
        const kids = [
            h('div', { class: 'bh' }, h('span', { class: 'bc' }, code, moved ? h('span', { class: 'bm' }, ` (şu an ${o.opCode})`) : null), s.stateChip(o.state)),
            h('div', { class: 'bn' }, o.name),
            h('div', { class: 'bm' }, `Makine: ${o.machines?.length ? o.machines.map((m) => (m.primary ? `★${m.code}` : m.code)).join(', ') : 'tanımsız'}`),
            h('div', { class: 'bchips' }, ...(fixed ? [] : prepWord(o)), o.firstPieceRequired ? s.chip('İlk parça', 'warn') : null, o.qcRequired ? s.chip('Kalite', 'warn') : null),
        ];
        if (fixed) kids.push(h('div', { class: 'bm' }, 'Sabit: Makine 101, OP numarasına girmez'));
        else if (s.canEdit) kids.push(h('div', { class: 'mv' },
            h('button', { type: 'button', class: 'ghost sm', 'aria-label': `${code} sola taşı`, 'data-testid': `ob-left-${o.id}`, disabled: idx === 0, onClick: (e) => { e.stopPropagation(); set(moveInOrder(order, idx, idx - 1)); } }, '◀'),
            h('button', { type: 'button', class: 'ghost sm', 'aria-label': `${code} sağa taşı`, 'data-testid': `ob-right-${o.id}`, disabled: idx === order.length - 1, onClick: (e) => { e.stopPropagation(); set(moveInOrder(order, idx, idx + 1)); } }, '▶')));
        const el = h('div', { class: `bx ${fixed ? 'fixed' : ''} ${s.openId === o.id ? 'sel' : ''}`, role: 'button', tabindex: 0, 'data-testid': 'ob-box', 'data-op-id': o.id, 'data-code': code, 'aria-label': `${code} ${o.name} — hazırlığı aç`,
            ...(s.canEdit && !fixed ? { draggable: 'true' } : {}),
            onClick: () => s.onOpen(o.id),
            onKeydown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') { if (e.target === el) { e.preventDefault(); s.onOpen(o.id); } return; }
                if (!fixed && s.canEdit && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); set(moveInOrder(order, idx, idx + (e.key === 'ArrowLeft' ? -1 : 1))); queueMicrotask(() => host.querySelector(`[data-op-id="${o.id}"]`)?.focus?.()); }
            },
            onDragstart: (e) => { dragFrom = idx; el.classList.add('drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', o.id); } catch { /* headless */ } },
            onDragend: () => { dragFrom = -1; el.classList.remove('drag'); },
            onDragover: (e) => { if (dragFrom >= 0 && !fixed) { e.preventDefault(); el.classList.add('over'); } },
            onDragleave: () => el.classList.remove('over'),
            onDrop: (e) => { e.preventDefault(); el.classList.remove('over'); if (dragFrom >= 0 && !fixed) set(moveInOrder(order, dragFrom, idx)); dragFrom = -1; },
        }, ...kids);
        return el;
    };
    const plus = (pos, label) => (s.canAdd && !dirty() ? h('button', { type: 'button', class: 'plus', title: label, 'aria-label': label, 'data-testid': `ob-add-${pos}`, onClick: () => s.onInsert(pos) }, '+') : null);
    function draw() {
        const items = [];
        if (cut) items.push(box(cut, -1, true));
        items.push(plus(0, cut ? '+ Operasyon Ekle (CUT/PREP’ten sonra)' : '+ Operasyon Ekle (başa)'));
        order.forEach((id, i) => { items.push(box(byId.get(id), i, false)); items.push(plus(i + 1, i === order.length - 1 ? '+ Operasyon Ekle (sona)' : `+ Operasyon Ekle (${previewCode(i)} ile ${previewCode(i + 1)} arasına)`)); });
        const reason = h('input', { placeholder: 'Gerekçe (en az 10 karakter)', maxlength: 400, 'data-testid': 'ob-reason', style: 'min-width:240px;flex:1' });
        const bar = dirty() ? h('div', { class: 'obar', 'data-testid': 'ob-bar', role: 'status' },
            h('b', {}, 'Önizleme — henüz kaydedilmedi.'), h('span', { class: 'bm' }, `Yeni sıra: ${order.map((id, i) => `${previewCode(i)} ${byId.get(id).name}`).join(' → ')}. Kayıtta OP numaraları yeniden hesaplanır; NC, CAM, takım listesi, kalite planı ve geçmiş aynı kalıcı operasyona bağlı kalır. Açık iş emirleri otomatik değişmez.`),
            reason,
            h('button', { type: 'button', class: 'primary', 'data-testid': 'ob-save', onClick: () => { const why = reason.value.trim(); if (why.length < 10) { reason.setAttribute('aria-invalid', 'true'); reason.focus(); return; } void s.onSave(order.slice(), why); } }, 'Sıralamayı kaydet'),
            h('button', { type: 'button', class: 'ghost', 'data-testid': 'ob-cancel', onClick: () => set(baseIds.slice()) }, 'Vazgeç')) : null;
        host.replaceChildren(...[h('style', {}, BOX_CSS), h('div', { class: 'obx', 'data-testid': 'ob-row', role: 'list' }, ...items.filter(Boolean)), bar].filter(Boolean));
    }
    draw();
}
