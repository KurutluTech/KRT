export const KIND_LABEL = {
    COMMERCIAL_MGMT_RELEASE: 'Ticari onay · yönetim serbest bırakma',
    COMMERCIAL_DECISION: 'Ticari onay · karar',
    PURCHASE_REQUEST: 'Satınalma talebi',
    PURCHASE_ORDER: 'Satınalma siparişi',
    TASK_COMPLETION: 'Görev tamamlama onayı',
    MAINTENANCE_TEST: 'Bakım · yetkili test sonucu',
    MAINTENANCE_RELEASE: 'Bakım · üretime dönüş (serbest bırakma)',
};
/** Which critical action the SERVER checks for each step (display + pre-check only; the RPC is the authority). */
export const KIND_ACTION = {
    COMMERCIAL_MGMT_RELEASE: 'MANAGEMENT_RELEASE',
    COMMERCIAL_DECISION: 'COMMERCIAL_RELEASE',
    PURCHASE_REQUEST: 'PURCHASING_APPROVE',
    PURCHASE_ORDER: 'PURCHASING_APPROVE',
    TASK_COMPLETION: 'TASK_MANAGE',
    MAINTENANCE_TEST: 'MAINTENANCE_TEST_RELEASE',
    MAINTENANCE_RELEASE: 'MAINTENANCE_TEST_RELEASE',
};
/** Canonical RPC per kind+decision. `null` = that decision does not exist in the canonical workflow (the button is not offered). */
export const KIND_RPC = {
    COMMERCIAL_MGMT_RELEASE: { APPROVE: 'grant_management_release', REJECT: 'decide_commercial_approval' },
    COMMERCIAL_DECISION: { APPROVE: 'decide_commercial_approval', REJECT: 'decide_commercial_approval' },
    PURCHASE_REQUEST: { APPROVE: 'decide_purchase_request', REJECT: 'decide_purchase_request' },
    PURCHASE_ORDER: { APPROVE: 'approve_purchase_order', REJECT: 'reject_purchase_order' }, // reject = the decision door of draft 0092 (reason required on the server); the generic cancel is closed for SUBMITTED orders
    TASK_COMPLETION: { APPROVE: 'approve_task', REJECT: 'reopen_task' },
    // KMI-HOTFIX-109: the maintenance test is decided by the EXISTING canonical RPCs (they re-check MAINTENANCE_TEST_RELEASE, TEST_PENDING and write the audit row).
    MAINTENANCE_TEST: { APPROVE: 'record_maintenance_test_result', REJECT: 'record_maintenance_test_result' },
    MAINTENANCE_RELEASE: { APPROVE: 'return_machine_to_service', REJECT: null },
};
export const REJECT_LABEL = {
    COMMERCIAL_MGMT_RELEASE: 'Reddet', COMMERCIAL_DECISION: 'Reddet', PURCHASE_REQUEST: 'Reddet', PURCHASE_ORDER: 'Reddet (iptal)', TASK_COMPLETION: 'Geri aç', MAINTENANCE_TEST: 'Test KALDI', MAINTENANCE_RELEASE: 'Reddet',
};
export const PRIORITY_RANK = { KRITIK: 0, YUKSEK: 1, NORMAL: 2, BILINMIYOR: 3 };
export const PRIORITY_LABEL = { KRITIK: 'KRİTİK', YUKSEK: 'YÜKSEK', NORMAL: 'NORMAL', BILINMIYOR: 'BİLİNMİYOR' };
/** Rule (stated on screen): ≥72 h waiting or a needed-by date already passed → KRİTİK; ≥24 h or needed-by within 3 days → YÜKSEK; otherwise NORMAL. No timestamp → BİLİNMİYOR (never guessed). */
export const CRITICAL_HOURS = 72;
export const HIGH_HOURS = 24;
export function waitingHours(requestedAt, nowMs) {
    if (!requestedAt)
        return null;
    const t = Date.parse(requestedAt);
    if (!Number.isFinite(t))
        return null;
    return Math.max(0, (nowMs - t) / 3_600_000);
}
export function priorityOf(hours, neededBy, nowMs) {
    const needMs = neededBy ? Date.parse(`${neededBy}T23:59:59+03:00`) : NaN;
    if (Number.isFinite(needMs) && needMs < nowMs)
        return { priority: 'KRITIK', why: `İstenen tarih (${neededBy}) geçti` };
    if (hours === null)
        return { priority: 'BILINMIYOR', why: 'Talep zamanı kayıtta yok' };
    if (hours >= CRITICAL_HOURS)
        return { priority: 'KRITIK', why: `${waitLabel(hours)} bekliyor (≥ ${CRITICAL_HOURS} sa)` };
    if (Number.isFinite(needMs) && needMs - nowMs <= 3 * 86_400_000)
        return { priority: 'YUKSEK', why: `İstenen tarih (${neededBy}) 3 gün içinde` };
    if (hours >= HIGH_HOURS)
        return { priority: 'YUKSEK', why: `${waitLabel(hours)} bekliyor (≥ ${HIGH_HOURS} sa)` };
    return { priority: 'NORMAL', why: `${waitLabel(hours)} bekliyor` };
}
export function waitLabel(hours) {
    if (hours === null)
        return 'bilinmiyor';
    if (hours < 1)
        return `${Math.max(1, Math.round(hours * 60))} dk`;
    if (hours < 48)
        return `${Math.floor(hours)} sa`;
    return `${Math.floor(hours / 24)} gün`;
}
const shortId = (id) => id.slice(0, 8);
function build(kind, recordId, record, ownerUserId, ownerLabel, requestedAt, neededBy, completedByMe, link, nowMs, userLabel, related = []) {
    const hours = waitingHours(requestedAt, nowMs);
    const p = priorityOf(hours, neededBy, nowMs);
    return { key: `${kind}:${recordId}`, kind, recordId, record, owner: ownerLabel ?? (ownerUserId ? (userLabel?.(ownerUserId) ?? `Kullanıcı …${ownerUserId.slice(-6)}`) : null), ownerUserId, requestedAt, waitingHours: hours, priority: p.priority, priorityWhy: p.why, neededBy, completedByMe, link, overdue: p.priority === 'KRITIK', related };
}
/** Only rows that are STILL waiting for exactly that step are listed: commercial PENDING (step 1 until management release exists, then step 2), purchase request SUBMITTED, PO SUBMITTED, task COMPLETED (not yet APPROVED). */
export function buildInbox(src, nowMs) {
    const out = [];
    for (const c of src.commercial) {
        if (c.status !== 'PENDING')
            continue;
        const lot = src.lotLabel?.(c.stockLotId) ?? `Stok lotu ${shortId(c.stockLotId)}`;
        out.push({ ...build(c.managementReleasedAt ? 'COMMERCIAL_DECISION' : 'COMMERCIAL_MGMT_RELEASE', c.id, lot, c.requestedBy ?? null, null, c.requestedAt, null, false, `#/onay-kuyrugu`, nowMs, src.userLabel, src.relatedLinks?.('COMMERCIAL_DECISION', c.id) ?? []),
            facts: [{ label: 'Parti', value: lot }, { label: 'Adım', value: c.managementReleasedAt ? '2/2 · ticari karar (muhasebe)' : '1/2 · yönetim serbest bırakma' }, ...(c.managementReleasedAt ? [{ label: 'Yönetim serbest bıraktı', value: c.managementReleasedAt }] : [])] });
    }
    for (const r of src.purchaseRequests) {
        if (r.status !== 'SUBMITTED')
            continue;
        out.push({ ...build('PURCHASE_REQUEST', r.id, `${r.materialCode} × ${r.qty} · ${r.reason}`, r.requestedBy ?? null, null, r.requestedAt, r.neededBy, false, `#/talepler`, nowMs, src.userLabel, src.relatedLinks?.('PURCHASE_REQUEST', r.id) ?? []),
            facts: [{ label: 'Malzeme', value: r.materialCode }, { label: 'Miktar', value: String(r.qty) }, { label: 'Gerekçe (talep eden)', value: r.reason }, ...(r.neededBy ? [{ label: 'İstenen tarih', value: r.neededBy }] : [])] });
    }
    for (const o of src.purchaseOrders) {
        if (o.status !== 'SUBMITTED')
            continue;
        out.push(build('PURCHASE_ORDER', o.id, `Sipariş ${shortId(o.id)} · ${src.supplierLabel?.(o.supplierId) ?? `tedarikçi ${shortId(o.supplierId)}`}`, o.createdBy ?? null, null, o.updatedAt ?? o.createdAt, null, false, `#/satinalma`, nowMs, src.userLabel, src.relatedLinks?.('PURCHASE_ORDER', o.id) ?? []));
    }
    for (const t of src.tasks) {
        if (t.status !== 'COMPLETED')
            continue;
        out.push({ ...build('TASK_COMPLETION', t.id, t.title, null, t.ownerLabel, t.completedAt, t.dueAt ? t.dueAt.slice(0, 10) : null, t.completedByMe, `#/gorevler`, nowMs, src.userLabel),
            facts: [...(t.completedByLabel ? [{ label: 'Tamamlayan', value: t.completedByLabel }] : []), ...(t.completionNote ? [{ label: 'Tamamlama notu', value: t.completionNote }] : [])] });
    }
    for (const m of src.maintenance ?? []) {
        if (m.status !== 'TEST_PENDING')
            continue;
        const mc = m.machineCode ? `Makine ${m.machineCode}` : `Makine ${shortId(m.machineId)}`;
        const passed = m.lastResult === 'PASS';
        // one ticket is exactly ONE open step: no PASS yet -> the test decision; PASS recorded -> the release (never both, never twice)
        out.push({ ...build(passed ? 'MAINTENANCE_RELEASE' : 'MAINTENANCE_TEST', m.id, `${mc} · ${m.reason}`, null, null, m.updatedAt ?? m.createdAt, null, false, `#/bakim`, nowMs, src.userLabel, src.relatedLinks?.(passed ? 'MAINTENANCE_RELEASE' : 'MAINTENANCE_TEST', m.id) ?? []), machineId: m.machineId,
            facts: [{ label: 'Makine', value: mc }, { label: 'Bakım kaydı', value: `${shortId(m.id)} · ${m.kind === 'FAULT' ? 'Arıza' : m.kind === 'PLANNED' ? 'Planlı bakım' : m.kind}` }, { label: 'Neden', value: m.reason }, { label: 'Adım', value: passed ? 'Test GEÇTİ · makineyi üretime döndür' : 'Yetkili test sonucu bekleniyor (GEÇTİ / KALDI)' }, ...(m.machineStatus ? [{ label: 'Makine durumu', value: m.machineStatus }] : [])] });
    }
    return out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (b.waitingHours ?? -1) - (a.waitingHours ?? -1) || a.key.localeCompare(b.key));
}
/** Pre-check for the buttons. The server re-checks everything; this only avoids offering an action that is certain to be refused. */
export function actionState(item, decision, held) {
    const rpc = KIND_RPC[item.kind][decision];
    if (!rpc)
        return { visible: false, enabled: false, why: null };
    // Commercial step 1: the only legal ways forward are management release (MANAGEMENT_RELEASE) or a rejection (COMMERCIAL_RELEASE); approval of the decision itself is not offered before release.
    const need = item.kind === 'COMMERCIAL_MGMT_RELEASE' && decision === 'REJECT' ? 'COMMERCIAL_RELEASE' : KIND_ACTION[item.kind];
    if (!held.has(need))
        return { visible: true, enabled: false, why: `Bu adım için yetkiniz yok (${need})` };
    if (item.kind === 'TASK_COMPLETION' && decision === 'APPROVE' && item.completedByMe)
        return { visible: true, enabled: false, why: 'Kendi tamamladığınız görevi onaylayamazsınız' };
    return { visible: true, enabled: true, why: null };
}
export const MIN_REASON = 5;
/** the reason as the server sees it (draft 0092 require_reject_reason): trimmed incl. NBSP / zero-width characters. Blank-looking text is NOT a reason. */
export const normalizeReason = (reason) => reason.replace(/^[\s\u00a0\u200b\u2060\ufeff]+|[\s\u00a0\u200b\u2060\ufeff]+$/g, '');
export function reasonError(reason) {
    return normalizeReason(reason).length >= MIN_REASON ? null : `Gerekçe en az ${MIN_REASON} karakter olmalı`;
}
/** Exact RPC call (name + params) for a decision — one place so UI and tests cannot drift. */
export function rpcCall(item, decision, reason) {
    const fn = KIND_RPC[item.kind][decision];
    const r = normalizeReason(reason);
    switch (item.kind) {
        case 'COMMERCIAL_MGMT_RELEASE': return decision === 'APPROVE' ? { fn, params: { p_approval_id: item.recordId, p_reason: r } } : { fn, params: { p_approval_id: item.recordId, p_decision: 'REJECTED', p_reason: r } };
        case 'COMMERCIAL_DECISION': return { fn, params: { p_approval_id: item.recordId, p_decision: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', p_reason: r } };
        case 'PURCHASE_REQUEST': return { fn, params: { p_request_id: item.recordId, p_decision: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', p_reason: r } };
        case 'PURCHASE_ORDER': return decision === 'APPROVE' ? { fn, params: { p_purchase_order_id: item.recordId } } : { fn, params: { p_purchase_order_id: item.recordId, p_reason: r } };
        case 'TASK_COMPLETION': return decision === 'APPROVE' ? { fn, params: { p_task_id: item.recordId, p_note: r } } : { fn, params: { p_task_id: item.recordId, p_reason: r } };
        case 'MAINTENANCE_TEST': return { fn, params: { p_ticket_id: item.recordId, p_result: decision === 'APPROVE' ? 'PASS' : 'FAIL', p_notes: r } };
        case 'MAINTENANCE_RELEASE': return { fn, params: { p_machine_id: item.machineId ?? '', p_reason: r } };
    }
}
/** Turkish summary of what the canonical process does NEXT after this step (shown to the approver before they click). */
export function nextStepText(item, decision) {
    switch (item.kind) {
        case 'COMMERCIAL_MGMT_RELEASE': return decision === 'APPROVE' ? 'Yönetim serbest bırakması kaydedilir; ticari karar (muhasebe) adımı açılır. Lot henüz sevkiyata hazırlanmış olmaz.' : 'Ticari onay talebi REDDEDİLİR; lot sevkiyata hazırlanamaz.';
        case 'COMMERCIAL_DECISION': return decision === 'APPROVE' ? 'Ticari onay verilir; lot "Sevkiyata hazırla" adımına geçebilir (kalite HOLD / zorunlu serbest bırakmalar ayrıca denetlenir).' : 'Ticari onay reddedilir; lot sevkiyata hazırlanamaz.';
        case 'PURCHASE_REQUEST': return decision === 'APPROVE' ? 'Talep ONAYLANIR; satınalma bunu fiyatlı siparişe çevirebilir.' : 'Talep REDDEDİLİR; siparişe çevrilemez.';
        case 'PURCHASE_ORDER': return decision === 'APPROVE' ? 'Sipariş ONAYLANIR; tedarikçiye gönderilebilir.' : 'Sipariş İPTAL edilir (CANCELLED).';
        case 'TASK_COMPLETION': return decision === 'APPROVE' ? 'Görev ONAYLANIR ve kapanır.' : 'Görev yeniden açılır (devam ediyor); tamamlayan kişiye döner.';
        case 'MAINTENANCE_TEST': return decision === 'APPROVE' ? 'Test GEÇTİ olarak kaydedilir. Makine HENÜZ üretime dönmez; bir sonraki adım olarak “üretime dönüş” onayı açılır.' : 'Test KALDI olarak kaydedilir; bakım kaydı onarıma geri döner, makine üretime dönemez.';
        case 'MAINTENANCE_RELEASE': return 'Makine SERVİSE DÖNER (kullanılabilir); bakım kaydı “servise döndü” olur. Üretim bundan sonra normal kurallarla başlar.';
    }
}
export const OUTCOME_LABEL = { APPROVED: 'ONAYLANDI', REJECTED: 'REDDEDİLDİ' };
export function buildHistory(src) {
    const out = [];
    const who = (u) => (u ? (src.userLabel?.(u) ?? `Kullanıcı …${u.slice(-6)}`) : null);
    for (const c of src.commercial) {
        if (c.status !== 'APPROVED' && c.status !== 'REJECTED')
            continue;
        out.push({ key: `COMMERCIAL_DECISION:${c.id}`, kind: 'COMMERCIAL_DECISION', record: src.lotLabel?.(c.stockLotId) ?? `Stok lotu ${shortId(c.stockLotId)}`, outcome: c.status, decidedAt: c.decidedAt, decidedBy: who(c.decidedBy), reason: c.decisionReason, reasonNote: null, related: src.relatedLinks?.('COMMERCIAL_DECISION', c.id) ?? [] });
    }
    for (const r of src.purchaseRequests) {
        if (r.status !== 'APPROVED' && r.status !== 'REJECTED')
            continue;
        out.push({ key: `PURCHASE_REQUEST:${r.id}`, kind: 'PURCHASE_REQUEST', record: `${r.materialCode} × ${r.qty}`, outcome: r.status, decidedAt: r.decidedAt, decidedBy: who(r.decidedBy), reason: r.decisionReason, reasonNote: null, related: src.relatedLinks?.('PURCHASE_REQUEST', r.id) ?? [] });
    }
    for (const o of src.purchaseOrders) {
        if (o.status === 'CANCELLED' && o.rejectionReason) {
            out.push({ key: `PURCHASE_ORDER:${o.id}`, kind: 'PURCHASE_ORDER', record: `Sipariş ${shortId(o.id)} · ${src.supplierLabel?.(o.supplierId) ?? `tedarikçi ${shortId(o.supplierId)}`}`, outcome: 'REJECTED', decidedAt: o.rejectedAt ?? o.updatedAt, decidedBy: who(o.rejectedBy ?? null), reason: o.rejectionReason, reasonNote: null, related: src.relatedLinks?.('PURCHASE_ORDER', o.id) ?? [] });
            continue;
        }
        if (o.status !== 'APPROVED')
            continue;
        out.push({ key: `PURCHASE_ORDER:${o.id}`, kind: 'PURCHASE_ORDER', record: `Sipariş ${shortId(o.id)} · ${src.supplierLabel?.(o.supplierId) ?? `tedarikçi ${shortId(o.supplierId)}`}`, outcome: 'APPROVED', decidedAt: o.updatedAt, decidedBy: null, reason: null, reasonNote: 'Sipariş tablosunda karar veren/gerekçe sütunu yok; ayrıntı denetim kaydında. Zaman = son güncelleme.', related: src.relatedLinks?.('PURCHASE_ORDER', o.id) ?? [] });
    }
    return out.sort((a, b) => (Date.parse(b.decidedAt ?? '') || 0) - (Date.parse(a.decidedAt ?? '') || 0) || a.key.localeCompare(b.key));
}
