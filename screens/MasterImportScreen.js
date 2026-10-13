// KMI NEXT — Ana veri aktarımı (migration 0057). Eski KMI'nin gerçek ana verisi sunucuda değil tarayıcı deposundadır
// (kurutluV61MasterData); eski sistemle aynı adresten açıldığında buradan okunur, değilse JSON yapıştırılır. Okuma salt-okunurdur.
// Aktarım: listele → önizle → (başka bir yetkili) onayla. Eski sistemin yerleşik DEMO örnek kayıtları “gerçek” diye açıkça
// işaretlenmedikçe aktarılmaz. Rota/BOM/çevrim süresi aktarılmaz (kaynakta doğrulanmış değer yok); yalnız referans gösterilir.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
export const OLD_STORE_KEY = 'kurutluV61MasterData';
const STATUS_TR = { NEW: 'Aktarılabilir', NEEDS_DECISION: 'Karar gerekli', ALREADY_IMPORTED: 'Zaten var', POSSIBLE_DEMO_SEED: 'Eski sistemin örnek kaydı olabilir', DUPLICATE_IN_SOURCE: 'Kaynakta çift kayıt' };
const CLASS_TR = { VERIFIED_REAL: 'Doğrulanmış gerçek', DEMO: 'Örnek (demo)', UNKNOWN: 'Bilinmiyor — onay bekliyor', DUPLICATE: 'Çift kayıt', CONFLICT: 'Çakışma (aynı kod başka kayıtta)' };
const KIND_TR = { CUSTOMER: 'Müşteri', PRODUCT: 'Ürün', SUPPLIER: 'Tedarikçi' };
const ISSUE_TR = { SOURCE_ID_MISSING: 'kaynak kimliği yok', CODE_OR_NAME_MISSING: 'kod/ad eksik', INACTIVE_IN_SOURCE: 'kaynakta pasif' };
const RESULT_TR = { APPLIED: 'aktarıldı', REJECTED: 'aktarılmadı', ALREADY_DECIDED: 'zaten karar verilmiş', ALREADY_IMPORTED: 'zaten var', DEMO_SEED_CONFIRMATION_REQUIRED: 'örnek kayıt — “gerçek” onayı yok', REAL_CONFIRMATION_REQUIRED: '“bu kayıt gerçek” onayı yok',
    NAME_REQUIRED: 'ad eksik', CODE_REQUIRED: 'kod eksik', DUPLICATE_IN_SOURCE: 'çift kayıt', ROW_NOT_IN_BATCH: 'satır bulunamadı' };
const REFUSAL_TR = { FOUR_EYES_REQUIRED: 'Listeyi getiren kişi aktaramaz — başka bir yetkili onaylamalı (dört göz).', NOTE_REQUIRED: 'Not yazın (en az 5 karakter).',
    DECISIONS_REQUIRED: 'En az bir satır seçin.', BACKUP_EXPORT_REQUIRED: 'Önce yedek dosyası (dışa aktarım) alınmalı.', PAYLOAD_HAS_NO_ROWS: 'Veride müşteri, ürün veya tedarikçi bulunamadı.' };
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); return REFUSAL_TR[m] ?? errorText(e); };
export const readOldStore = () => { try {
    const t = localStorage.getItem(OLD_STORE_KEY);
    return t ? JSON.parse(t) : null;
}
catch {
    return null;
} };
/** The old store keeps customers/products/suppliers either at the top level or under a nested `masterData`. */
export function extractPayload(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const src = (o.customers || o.products || o.suppliers ? o : (o.masterData ?? o.data ?? o));
    const arr = (v) => (Array.isArray(v) ? v : []);
    const out = { customers: arr(src.customers), products: arr(src.products), suppliers: arr(src.suppliers) };
    return out.customers.length + out.products.length + out.suppliers.length ? out : null;
}
/** Downloads the export as a JSON file and returns the SHA-256 of the FILE bytes (so the owner can verify the saved file later). */
async function downloadExport(batchId, ex) {
    const text = JSON.stringify({ serverExportSha256: ex.exportSha256, content: ex.content }, null, 2);
    const bytes = new TextEncoder().encode(text);
    let sha = ex.exportSha256;
    try {
        const d = await crypto.subtle.digest('SHA-256', bytes);
        sha = Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    catch { /* insecure context: keep the server fingerprint */ }
    try {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `kmi-ana-veri-aktarim-yedek-${batchId.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    catch { /* the server-side export audit row still exists */ }
    return sha;
}
export async function renderMasterImportScreen(container, api, readStore = readOldStore, state = {}) {
    const go = (next) => void renderMasterImportScreen(container, api, readStore, next);
    let loadError = null;
    let batches = [];
    let pv = null;
    try {
        batches = await api.batches();
        const id = state.batchId ?? batches[0]?.id ?? null;
        if (id)
            pv = await api.preview(id);
    }
    catch (e) {
        loadError = errText(e);
    }
    const paste = h('textarea', { 'data-testid': 'mi-paste', rows: '3', placeholder: 'veya JSON yapıştırın: {"customers":[…],"products":[…],"suppliers":[…]}', style: 'width:100%;box-sizing:border-box;font-size:12px' });
    const label = h('input', { type: 'text', 'data-testid': 'mi-label', value: 'Eski KMI ana veri aktarımı', style: 'flex:1 1 200px;min-width:0' });
    const stage = async (source) => {
        let payload = null;
        if (source === 'OLD_KMI_BROWSER_STORE')
            payload = extractPayload(readStore());
        else {
            try {
                payload = extractPayload(JSON.parse(paste.value));
            }
            catch {
                payload = null;
            }
        }
        if (!payload)
            return go({ ...state, message: { kind: 'error', text: source === 'OLD_KMI_BROWSER_STORE' ? 'Bu tarayıcıda eski KMI ana verisi bulunamadı. Eski sistemin açıldığı adresten deneyin veya JSON yapıştırın.' : 'Yapıştırılan veri okunamadı veya içi boş.' } });
        try {
            const r = await api.stage(label.value.trim(), source, payload);
            go({ batchId: r.batchId, message: { kind: 'ok', text: `${r.rows} kayıt listelendi (müşteri ${payload.customers.length}, ürün ${payload.products.length}, tedarikçi ${payload.suppliers.length}). Aktarım için başka bir yetkilinin onayı gerekir.` } });
        }
        catch (e) {
            go({ ...state, message: { kind: 'error', text: errText(e) } });
        }
    };
    const head = [
        h('h1', { 'data-testid': 'mi-heading' }, 'Ana veri aktarımı (müşteri · ürün · tedarikçi)'),
        h('p', { style: 'font-size:13px;color:#475569' }, 'Kaynak eski KMI’nin kayıtlarıdır; okuma salt-okunurdur, eski sistemde hiçbir şey değişmez. Kayıtlar yalnız kaynak kimliğiyle tanınır, isimle eşleştirme yapılmaz. Rota, malzeme listesi ve çevrim süresi aktarılmaz — bunlar doğrulanmış değer olarak Rota ekranından girilir. Listeyi getiren kişi aktaramaz.'),
        state.message ? h('div', { 'data-testid': 'mi-message', 'data-kind': state.message.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${state.message.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.message.text) : null,
    ];
    if (loadError) {
        mount(container, h('div', { style: 'padding:0 16px' }, ...head, h('div', { 'data-testid': 'mi-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, loadError)));
        return;
    }
    const body = [h('section', { style: 'margin:10px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center' }, label, h('button', { type: 'button', 'data-testid': 'mi-stage-store', onClick: () => void stage('OLD_KMI_BROWSER_STORE') }, 'Bu tarayıcıdaki eski KMI verisini getir'), h('div', { style: 'flex-basis:100%' }, paste), h('button', { type: 'button', 'data-testid': 'mi-stage-paste', onClick: () => void stage('PASTED_JSON') }, 'Yapıştırılan veriyi getir')),
        batches.length > 1 ? h('div', { style: 'font-size:12px' }, 'Önceki listeler: ', ...batches.map((b) => h('button', { type: 'button', 'data-testid': 'mi-batch', style: 'margin:2px;font-size:12px', onClick: () => go({ batchId: b.id }) }, new Date(b.stagedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })))) : null];
    if (!pv)
        body.push(h('div', { 'data-testid': 'mi-empty', style: 'color:#64748b' }, 'Henüz liste getirilmedi.'));
    else {
        const p = pv;
        const open = p.rows.filter((r) => r.decision === null && (r.status === 'NEW' || r.status === 'NEEDS_DECISION' || r.status === 'POSSIBLE_DEMO_SEED'));
        const note = h('input', { type: 'text', 'data-testid': 'mi-note', placeholder: 'Onay notu (ör. kaynak liste ile karşılaştırıldı)', style: 'flex:1 1 220px;min-width:0' });
        const q = (id, t) => container.querySelector(`[data-testid="${t}"][data-row="${id}"]`);
        const apply = async () => {
            const decisions = [];
            for (const r of open) {
                const pick = q(r.id, 'mi-pick')?.value ?? 'SKIP';
                if (pick === 'SKIP')
                    continue;
                if (pick === 'REJECT') {
                    decisions.push({ rowId: r.id, decision: 'REJECT' });
                    continue;
                }
                const code = q(r.id, 'mi-code')?.value.trim();
                const name = q(r.id, 'mi-name')?.value.trim();
                decisions.push({ rowId: r.id, decision: 'APPLY', ...(q(r.id, 'mi-real')?.checked ? { confirmReal: true } : {}), ...(code ? { code } : {}), ...(name ? { name } : {}) });
            }
            if (!decisions.length)
                return go({ batchId: p.batch.id, message: { kind: 'error', text: REFUSAL_TR.DECISIONS_REQUIRED } });
            try {
                // 0068: the checksummed export is the backup point. The file is downloaded here; its SHA-256 is shown so it can be checked later.
                let sha = '';
                if (api.exportBatch) {
                    const ex = await api.exportBatch(p.batch.id);
                    sha = await downloadExport(p.batch.id, ex);
                }
                const res = await api.apply(p.batch.id, decisions, note.value.trim());
                const counts = new Map();
                for (const r of res.results)
                    counts.set(r.result, (counts.get(r.result) ?? 0) + 1);
                go({ batchId: p.batch.id, message: { kind: res.applied + res.rejected > 0 ? 'ok' : 'error', text: [...counts].map(([k, n]) => `${n} ${RESULT_TR[k] ?? k}`).join(' · ') + (sha ? ` · yedek dosyası indirildi (SHA-256 ${sha.slice(0, 16)}…)` : '') } });
            }
            catch (e) {
                go({ batchId: p.batch.id, message: { kind: 'error', text: errText(e) } });
            }
        };
        const rc = p.reconcile;
        body.push(h('section', { 'data-testid': 'mi-preview', style: 'margin:10px 0' }, h('h2', { style: 'font-size:15px;margin:6px 0' }, Object.entries(p.counts).map(([k, n]) => { const [kind, st] = k.split(':'); return `${KIND_TR[kind] ?? kind} ${STATUS_TR[st] ?? st}: ${n}`; }).join(' · ')), h('div', { 'data-testid': 'mi-reconcile', style: 'font-size:12px;color:#475569;margin:2px 0' }, `Mutabakat: kaynak ${rc.sourceRows} · aktarılan ${rc.applied} (veritabanında doğrulanan ${rc.appliedEntitiesFound}) · reddedilen ${rc.rejected} · karar bekleyen ${rc.undecided}`), p.batch.stagedByMe ? h('div', { 'data-testid': 'mi-four-eyes', style: 'color:#b45309;font-size:13px;margin:4px 0' }, 'Bu listeyi siz getirdiniz — aktarımı başka bir yetkili onaylamalı.') : null, ...p.rows.map((r) => {
            const isOpen = open.includes(r);
            const demo = r.status === 'POSSIBLE_DEMO_SEED';
            const needs = r.status === 'NEEDS_DECISION';
            return h('div', { 'data-testid': 'mi-row', 'data-status': r.status, 'data-row': r.id, style: `border:1px solid ${(needs || demo) && isOpen ? '#f59e0b' : '#e2e8f0'};border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px;overflow-wrap:anywhere` }, h('div', { style: 'display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap' }, h('b', {}, `${KIND_TR[r.kind]} · ${r.name ?? '—'}${r.code ? ` · ${r.code}` : ''}`), h('span', { 'data-testid': 'mi-state', 'data-class': r.class ?? '' }, r.decision === 'APPLIED' ? 'Aktarıldı' : r.decision === 'REJECTED' ? 'Aktarılmadı' : STATUS_TR[r.status] ?? r.status, r.class ? ` · ${CLASS_TR[r.class] ?? r.class}` : '')), r.kind === 'PRODUCT' ? h('div', { style: 'color:#475569' }, `Revizyon ${String(r.info.revision ?? 'A')} (taslak olarak açılır)${r.info.material ? ` · malzeme (referans): ${String(r.info.material)}` : ''}`) : null, r.issues.length ? h('div', { 'data-testid': 'mi-issues', style: 'color:#b45309' }, r.issues.map((i) => ISSUE_TR[i] ?? i).join(' · ')) : null, isOpen && !p.batch.stagedByMe ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px' }, h('select', { 'data-testid': 'mi-pick', 'data-row': r.id }, h('option', { value: needs || demo ? 'SKIP' : 'APPLY' }, needs || demo ? 'Şimdilik bekle' : 'Aktar'), h('option', { value: needs || demo ? 'APPLY' : 'SKIP' }, needs || demo ? 'Aktar' : 'Şimdilik bekle'), h('option', { value: 'REJECT' }, 'Aktarma')), h('label', { style: 'font-size:12px' }, h('input', { type: 'checkbox', 'data-testid': 'mi-real', 'data-row': r.id }), demo ? ' Bu gerçek bir kayıt (örnek değil)' : ' Bu kaydın gerçek olduğunu doğruluyorum'), needs ? h('input', { type: 'text', 'data-testid': 'mi-code', 'data-row': r.id, placeholder: 'Kod', value: r.code ?? '', style: 'width:90px' }) : null, needs ? h('input', { type: 'text', 'data-testid': 'mi-name', 'data-row': r.id, placeholder: 'Ad', value: r.name ?? '', style: 'flex:1 1 140px;min-width:0' }) : null) : null);
        }), open.length && !p.batch.stagedByMe ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px' }, note, h('button', { type: 'button', 'data-testid': 'mi-apply', onClick: () => void apply() }, 'Seçilenleri onayla')) : null));
    }
    if (pv && api.rollbackPlan && pv.reconcile.applied > 0) {
        try {
            const plan = await api.rollbackPlan(pv.batch.id);
            body.push(h('section', { 'data-testid': 'mi-plan', style: 'margin:10px 0;font-size:13px' }, h('h2', { style: 'font-size:15px;margin:6px 0' }, 'Geri alma planı'), h('div', { style: 'color:#475569' }, 'Hiçbir şey silinmez. Müşteriler pasife alınabilir; kullanılan kayıt geçmişini korur.'), ...plan.entities.map((e) => h('div', { 'data-testid': 'mi-plan-row' }, `${KIND_TR[e.kind] ?? e.kind} · ${e.name ?? e.code ?? e.entityId} · kullanıldığı yer: ${e.referencedBy} · ${e.rollback === 'DEACTIVATE_VIA_set_customer_active' ? 'pasife alınabilir' : e.rollback === 'NO_DEACTIVATE_FUNCTION_YET_P2' ? 'pasife alma henüz yok' : 'taslak, kullanılmıyorsa etkisiz'}`))));
        }
        catch { /* plan is informational */ }
    }
    mount(container, h('div', { class: 'mi-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, ...head, ...body));
}
