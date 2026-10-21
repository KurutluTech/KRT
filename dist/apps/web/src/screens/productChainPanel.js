// Paket C / 0136 — "Operasyon zinciri": for every operation ONE canonical answer (NC · CAM kaydı · takım listesi · makine) with five words only:
// YOK · BELGE VAR · OPERASYONA BAĞLI DEĞİL · TEKNİK ONAY BEKLİYOR · YÜRÜRLÜKTE  (+ İŞ EMRİNE HAZIR for the whole operation).
// The panel never decides anything: it shows what op_technical_chain says and offers the next real action (link, register CAM from the existing NC, release, attach). Titles / file names never count as a relation.
import { h } from '../../../../packages/ui/src/h.js';
const gapText = (op) => { const t = chainGapText(op); return t ? E('div', { class: 'mut', style: 'margin-top:6px', 'data-testid': 'pw-chain-gap' }, t) : null; };
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
export const CHAIN_TONE = { 'YOK': 'bad', 'BELGE VAR': 'warn', 'OPERASYONA BAĞLI DEĞİL': 'warn', 'TEKNİK ONAY BEKLİYOR': 'warn', 'YÜRÜRLÜKTE': 'ok' };
const word = (label, it, testid) => E('span', { class: `chip ${CHAIN_TONE[it.status] ?? 'warn'}`, 'data-testid': testid, 'data-status': it.status, title: it.detail ?? '' }, `${label}: ${it.status}${it.docNo ? ` · ${it.docNo}` : ''}${it.programNo && label === 'CAM' ? ` · ${it.programNo}` : ''}`);
/** Compact NC · CAM · takım listesi chips for one operation (same words as the chain panel, same source). Pure DOM, no decisions. */
export function chainChips(op) {
    return [word('NC', op.nc, 'pw-op-nc'), word('CAM', op.cam, 'pw-op-cam'), word('Takım listesi', op.toolList, 'pw-op-tl')];
}
/** Plain-language reason for what is missing on ONE operation — the three records are different things: the NC DOCUMENT (a file under document control),
 *  the CAM RECORD (program record made from that NC) and the LINK of the CAM record to the operation. Pure — unit tested. Returns null when nothing is missing. */
export function chainGapText(op) {
    const nc = op.nc.status, cam = op.cam.status, tl = op.toolList.status;
    const doc = op.nc.docNo ?? 'NC belgesi';
    if (nc === 'YOK')
        return 'NC programı yok: bu operasyon için bir NC dosyası yüklenip yürürlüğe alınmalı.';
    if (nc === 'BELGE VAR' || (nc === 'TEKNİK ONAY BEKLİYOR'))
        return `${doc} var ama henüz yürürlükte değil (belge kontrolünden onaylanıp yürürlüğe alınmalı).`;
    if (cam === 'YOK')
        return `${doc} yürürlükte, ancak CAM kaydı yok. NC belgesi (dosya) ile CAM kaydı (program kaydı) ayrı kayıtlardır: CAM kaydı bu NC'den oluşturulmalı.`;
    if (cam === 'TEKNİK ONAY BEKLİYOR')
        return 'CAM kaydı oluşturuldu ama taslak durumda: teknik yayın verilmeli ("CAM kaydını yayınla").';
    if (cam === 'OPERASYONA BAĞLI DEĞİL')
        return 'CAM kaydı yayında ama bu operasyona bağlı değil: "CAM kaydını operasyona bağla".';
    if (nc === 'OPERASYONA BAĞLI DEĞİL')
        return `${doc} bu operasyona bağlı değil.`;
    if (tl === 'YOK')
        return 'Takım listesi yok: bu operasyon için takım listesi yüklenip onaylanmalı.';
    if (tl === 'OPERASYONA BAĞLI DEĞİL')
        return 'Takım listesi var ama bu operasyona bağlı değil.';
    if (tl === 'TEKNİK ONAY BEKLİYOR' || tl === 'BELGE VAR')
        return 'Takım listesi henüz yürürlükte değil: kritik takım bilgileri yetkili kişi tarafından doğrulanıp yürürlüğe alınmalı.';
    return null;
}
/** The next real action for an operation, or null. Pure — unit tested. */
export function nextChainAction(op) {
    if (op.nc.status === 'OPERASYONA BAĞLI DEĞİL' && op.nc.controlState === 'EFFECTIVE' && op.cam.status === 'YOK')
        return { kind: 'REGISTER_CAM', label: `CAM kaydını mevcut NC'den oluştur (${op.nc.docNo ?? 'NC'})` };
    if (op.nc.status === 'YÜRÜRLÜKTE' && op.cam.status === 'YOK')
        return { kind: 'REGISTER_CAM', label: `CAM kaydını mevcut NC'den oluştur (${op.nc.docNo ?? 'NC'})` };
    if (op.cam.status === 'TEKNİK ONAY BEKLİYOR')
        return { kind: 'RELEASE_CAM', label: 'CAM kaydını yayınla' };
    if (op.cam.status === 'OPERASYONA BAĞLI DEĞİL')
        return { kind: 'ATTACH_CAM', label: 'CAM kaydını operasyona bağla' };
    if (op.toolList.status === 'OPERASYONA BAĞLI DEĞİL' && op.toolList.documentId)
        return { kind: 'LINK_TOOL_LIST', label: `Takım listesini bu operasyona bağla (${op.toolList.docNo ?? ''})` };
    return null;
}
export async function drawChainPanel(host, api, ws, can, reload, showErr, onChain, onlyOpNo) {
    host.replaceChildren();
    if (!ws.revision)
        return;
    let chain;
    try {
        chain = await api.techChain(ws.revision.id);
    }
    catch {
        onChain?.(null);
        return;
    } // 0136 not installed / no access: no panel, nothing invented
    onChain?.(chain);
    const shown = onlyOpNo == null ? chain.operations : chain.operations.filter((x) => x.opNo === onlyOpNo);
    if (!shown.length)
        return;
    const rows = shown.map((op) => {
        const act = can.act ? nextChainAction(op) : null;
        let busy = false; // one click = one record: a second click (or a slow network) never creates a second CAM record for the same NC
        const run = async (ev) => {
            if (!act || busy)
                return;
            const btn = (ev?.currentTarget ?? null);
            busy = true;
            if (btn)
                btn.disabled = true;
            try {
                if (act.kind === 'REGISTER_CAM') {
                    const now = (await api.techChain(ws.revision.id)).operations.find((x) => x.routingOperationId === op.routingOperationId); // re-read the real record right before writing
                    if (now && now.cam.status !== 'YOK') {
                        await reload(`CAM kaydı zaten var (${now.cam.status}); yeni kayıt oluşturulmadı.`);
                        return;
                    }
                    if (!op.nc.versionId)
                        throw new Error('NC_VERSION_NOT_FOUND');
                    await api.camFromNc(op.routingOperationId, op.nc.versionId, null);
                    await reload('CAM kaydı mevcut NC sürümünden oluşturuldu (TASLAK). Takımlar NC başlığından türetildi — yayınlamadan önce kontrol edin.');
                }
                else if (act.kind === 'RELEASE_CAM') {
                    await api.releaseCam(op.cam.camProgramId);
                    await reload('CAM kaydı yayınlandı.');
                }
                else if (act.kind === 'ATTACH_CAM') {
                    const o = ws.routing.find((x) => x.id === op.routingOperationId);
                    if (!o || !ws.revision)
                        throw new Error('OPERATION_NOT_FOUND');
                    await api.saveOperation({ revisionId: ws.revision.id, opNo: o.opNo, name: o.name, machineIds: o.machines.map((m) => m.id), primaryId: o.machines.find((m) => m.primary)?.id ?? null, skillCode: o.skillCode, skillLevel: o.skillLevel, camId: op.cam.camProgramId,
                        setup: o.setupMinutes, cycle: o.cycleSeconds, firstPiece: o.firstPieceRequired, qc: o.qcRequired, instructions: o.instructions, reason: 'CAM kaydı operasyona bağlandı' });
                    await reload('CAM kaydı operasyona bağlandı.');
                }
                else if (act.kind === 'LINK_TOOL_LIST') {
                    await api.linkDocumentToOp(op.toolList.documentId, op.opNo);
                    await reload('Takım listesi operasyona bağlandı.');
                }
            }
            catch (e) {
                busy = false;
                if (btn)
                    btn.disabled = false;
                showErr(e);
            }
        };
        return E('div', { class: 'r', 'data-testid': 'pw-chain-op', 'data-op': String(op.opNo), 'data-ready': String(op.workOrderReady) }, E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, E('b', {}, `OP${op.opNo}`), E('span', {}, op.name), word('NC', op.nc, 'pw-chain-nc'), word('CAM', op.cam, 'pw-chain-cam'), word('Takım listesi', op.toolList, 'pw-chain-tl'), E('span', { class: `chip ${op.workOrderReady ? 'ok' : 'warn'}`, 'data-testid': 'pw-chain-ready' }, op.workOrderReady ? 'İŞ EMRİNE HAZIR' : 'İŞ EMRİNE HAZIR DEĞİL')), gapText(op), act ? E('div', { class: 'row', style: 'margin-top:6px' }, E('button', { class: 'btn primary sm', type: 'button', 'data-testid': 'pw-chain-act', 'data-kind': act.kind, onClick: (ev) => void run(ev) }, act.label)) : null);
    });
    host.append(E('div', { class: 'formbox', 'data-testid': 'pw-chain', style: 'margin-bottom:10px' }, E('b', {}, 'Operasyon zinciri (NC · CAM · takım listesi)'), E('div', { class: 'mut' }, 'Üç ayrı kayıt vardır: NC belgesi (dosya) · CAM kaydı (o NC\'den oluşan program kaydı) · CAM kaydının operasyona bağlantısı. Belge başlığı veya dosya adı ilişki sayılmaz; her şey gerçek kayıttan okunur. “Yürürlükte” = onaylı ve yürürlüğe alınmış. CNC tezgâhına program gönderilmez.'), E('div', { class: 'rows' }, ...rows)));
}
/** Program NAME vs CONTENT — two levels, never merged. */
export function cncMatchText(m) {
    return { name: m.nameLevel === 'PROGRAM ADI EŞLEŞTİ' ? 'PROGRAM ADI EŞLEŞTİ' : m.nameLevel === 'PROGRAM ADI FARKLI' ? 'PROGRAM ADI FARKLI' : 'CNC PROGRAM ADI BİLİNMİYOR',
        content: m.contentLabel || 'CNC DOSYA İÇERİĞİ DOĞRULANMADI', tone: m.nameLevel === 'PROGRAM ADI EŞLEŞTİ' ? 'warn' : m.nameLevel === 'PROGRAM ADI FARKLI' ? 'bad' : 'warn' }; // never 'ok': a name match alone is not verification
}
/** ONE answer for "siparişe hazır": the server's revision_readiness (revision, BOM, routing, CAM, control plan, documents) AND every operation's technical chain. Pure — unit tested.
 *  Unknown is never ready: if the chain could not be read the answer says so instead of guessing. */
export function orderReadiness(overall, chain, bomLines) {
    const reasons = [];
    if (overall !== 'READY')
        reasons.push(overall === 'NOT_READY' ? 'Revizyon hazırlık kontrolü eksik' : 'Revizyon hazırlık kontrolü okunamadı');
    if (bomLines === 0)
        reasons.push('BOM yok');
    if (!chain)
        reasons.push('Operasyon zinciri okunamadı (0136 kurulu değil veya yetki yok)');
    else if (!chain.operations.length)
        reasons.push('Rota yok');
    else
        for (const o of chain.operations)
            if (!o.workOrderReady)
                reasons.push(`OP${o.opNo}: ${o.status || 'HAZIR DEĞİL'}`);
    return { ready: reasons.length === 0 ? true : (!chain || overall === undefined || overall === null) ? null : false, reasons };
}
