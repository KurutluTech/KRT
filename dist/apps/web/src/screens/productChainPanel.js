// Paket C / 0136 — "Operasyon zinciri": for every operation ONE canonical answer (NC · CAM kaydı · takım listesi · makine) with five words only:
// YOK · BELGE VAR · OPERASYONA BAĞLI DEĞİL · TEKNİK ONAY BEKLİYOR · YÜRÜRLÜKTE  (+ İŞ EMRİNE HAZIR for the whole operation).
// The panel never decides anything: it shows what op_technical_chain says and offers the next real action (link, register CAM from the existing NC, release, attach). Titles / file names never count as a relation.
import { h } from '../../../../packages/ui/src/h.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
export const CHAIN_TONE = { 'YOK': 'bad', 'BELGE VAR': 'warn', 'OPERASYONA BAĞLI DEĞİL': 'warn', 'TEKNİK ONAY BEKLİYOR': 'warn', 'YÜRÜRLÜKTE': 'ok' };
const word = (label, it, testid) => E('span', { class: `chip ${CHAIN_TONE[it.status] ?? 'warn'}`, 'data-testid': testid, 'data-status': it.status, title: it.detail ?? '' }, `${label}: ${it.status}${it.docNo ? ` · ${it.docNo}` : ''}${it.programNo && label === 'CAM' ? ` · ${it.programNo}` : ''}`);
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
export async function drawChainPanel(host, api, ws, can, reload, showErr, onChain) {
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
    if (!chain.operations.length)
        return;
    const rows = chain.operations.map((op) => {
        const act = can.act ? nextChainAction(op) : null;
        const run = async () => {
            if (!act)
                return;
            try {
                if (act.kind === 'REGISTER_CAM') {
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
                showErr(e);
            }
        };
        return E('div', { class: 'r', 'data-testid': 'pw-chain-op', 'data-op': String(op.opNo), 'data-ready': String(op.workOrderReady) }, E('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, E('b', {}, `OP${op.opNo}`), E('span', {}, op.name), word('NC', op.nc, 'pw-chain-nc'), word('CAM', op.cam, 'pw-chain-cam'), word('Takım listesi', op.toolList, 'pw-chain-tl'), E('span', { class: `chip ${op.workOrderReady ? 'ok' : 'warn'}`, 'data-testid': 'pw-chain-ready' }, op.workOrderReady ? 'İŞ EMRİNE HAZIR' : 'İŞ EMRİNE HAZIR DEĞİL')), act ? E('div', { class: 'row', style: 'margin-top:6px' }, E('button', { class: 'btn primary sm', type: 'button', 'data-testid': 'pw-chain-act', 'data-kind': act.kind, onClick: () => void run() }, act.label)) : null);
    });
    host.append(E('div', { class: 'formbox', 'data-testid': 'pw-chain', style: 'margin-bottom:10px' }, E('b', {}, 'Operasyon zinciri (NC · CAM · takım listesi)'), E('div', { class: 'mut' }, 'Belge başlığı veya dosya adı ilişki sayılmaz: bağlantı gerçek kayıttan okunur. “Yürürlükte” = onaylı ve yürürlüğe alınmış.'), E('div', { class: 'rows' }, ...rows)));
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
