// KMI NEXT — Yetkinlik geçmişi aktarımı (D-011, migration 0038). The old KMI kept skills only in a
// browser; nothing is moved by guessing. A verifiable source is pasted, every row is checked by the
// server (person ONLY by id — a name is never matched; known skill; level 1–4; evidence; not expired)
// and waits as DOĞRULAMA BEKLİYOR until a second approver (not the one who loaded it, not the person)
// verifies or rejects — in bulk, with a note. Rows with problems stay ÇÖZÜLEMEDİ.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { IMPORT_PROBLEM_TR, parseCompetencyImport } from '../../../../packages/domain/src/competencyImport.js';
import { errorText as sharedErrorText } from '../errorText.js';
const STATUS_TR = { PENDING_VERIFICATION: 'DOĞRULAMA BEKLİYOR', UNRESOLVED: 'ÇÖZÜLEMEDİ', VERIFIED: 'DOĞRULANDI', REJECTED: 'REDDEDİLDİ' };
const RESULT_TR = { FOUR_EYES_REQUIRED: 'Yükleyen kişi doğrulayamaz (dört göz)', SELF_APPROVAL_NOT_ALLOWED: 'Kişi kendi yetkinliğini doğrulayamaz', VERIFIED: 'DOĞRULANDI', REJECTED: 'REDDEDİLDİ' };
const KIND_TR = { LEGACY_EXPORT: 'Eski KMI dışa aktarımı', PAPER_RECORD: 'Kâğıt kayıt', CERTIFICATE: 'Sertifika', OTHER: 'Diğer' };
const errText = (e) => sharedErrorText(e);
export async function renderCompetencyImportScreen(container, api, state = {}) {
    let loadError = null;
    let batches = [];
    try {
        batches = await api.batches();
    }
    catch (e) {
        loadError = errText(e);
    }
    const go = (next) => void renderCompetencyImportScreen(container, api, next);
    const label = h('input', { type: 'text', 'data-testid': 'ci-label', placeholder: 'Kaynak adı (ör. 2026-03 ustabaşı formları)', style: 'flex:1 1 200px;min-width:0' });
    const kind = h('select', { 'data-testid': 'ci-kind' }, ...Object.keys(KIND_TR).map((k) => h('option', { value: k }, KIND_TR[k])));
    const text = h('textarea', { 'data-testid': 'ci-text', rows: '5', style: 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px',
        placeholder: 'personnelId;skill;level;validUntil;evidence;personName' });
    const stage = async () => {
        const rows = parseCompetencyImport(text.value);
        if (!rows.length)
            return go({ message: { kind: 'error', text: 'Satır yok.' } });
        try {
            go({ preview: await api.stage(label.value.trim(), kind.value, '', rows), message: { kind: 'ok', text: `${rows.length} satır yüklendi — doğrulama bekliyor.` } });
        }
        catch (e) {
            go({ message: { kind: 'error', text: errText(e) } });
        }
    };
    const pv = state.preview ?? null;
    const note = h('input', { type: 'text', 'data-testid': 'ci-note', placeholder: 'Doğrulama notu (en az 10 karakter)', style: 'flex:1 1 200px;min-width:0' });
    const decide = async (decision) => {
        if (!pv)
            return;
        const ids = [...container.querySelectorAll('[data-testid="ci-pick"]:checked')].map((c) => c.value);
        if (!ids.length)
            return go({ preview: pv, message: { kind: 'error', text: 'Satır seçin.' } });
        try {
            const res = await api.verify(ids, decision, note.value.trim());
            const summary = res.map((r) => RESULT_TR[r.result] ?? r.result).join(' · ');
            go({ preview: await api.preview(pv.batchId), message: { kind: 'ok', text: summary } });
        }
        catch (e) {
            go({ preview: pv, message: { kind: 'error', text: errText(e) } });
        }
    };
    mount(container, h('div', { class: 'ci-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'ci-heading' }, 'Yetkinlik geçmişi aktarımı'), h('p', { style: 'font-size:12px;color:#555' }, 'Eski yetkinlikler tahminle taşınmaz. Kişi yalnız personel kimliğiyle tanınır; isimle eşleştirme yapılmaz. Her satır ikinci bir yetkili tarafından doğrulanana kadar DOĞRULAMA BEKLİYOR kalır.'), loadError ? h('div', { 'data-testid': 'ci-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, `Yüklenemedi: ${loadError}`) : null, state.message ? h('div', { 'data-testid': 'ci-message', 'data-kind': state.message.kind, style: `padding:10px;border-radius:8px;margin:6px 0;background:${state.message.kind === 'ok' ? '#dcfce7' : '#fee2e2'}` }, state.message.text) : null, loadError ? null : h('section', { style: 'margin:10px 0' }, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, label, kind), text, h('button', { type: 'button', 'data-testid': 'ci-stage', onClick: () => void stage() }, 'Yükle ve kontrol et')), pv ? h('section', { 'data-testid': 'ci-preview', style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px' }, `${pv.sourceLabel} · ${Object.entries(pv.counts ?? {}).map(([k, v]) => `${STATUS_TR[k] ?? k}: ${v}`).join(' · ')}`), pv.stagedByMe ? h('div', { 'data-testid': 'ci-four-eyes', style: 'color:#b45309;font-size:13px' }, 'Bu listeyi siz yüklediniz — doğrulamayı başka bir yetkili yapmalı.') : null, ...pv.rows.map((r) => h('div', { 'data-testid': 'ci-row', 'data-row': String(r.rowNo), 'data-status': r.status,
        style: 'border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin:4px 0;font-size:13px;overflow-wrap:anywhere' }, r.status === 'PENDING_VERIFICATION' ? h('input', { type: 'checkbox', 'data-testid': 'ci-pick', value: r.id }) : null, h('b', {}, ` ${r.rowNo}. ${r.personName ?? r.personNameRaw ?? '—'}`), ` · ${r.skillCode ?? r.skillRaw ?? '—'} · seviye ${r.level ?? '—'}`, r.validUntil ? ` · geçerlilik ${r.validUntil}` : '', r.currentLevel !== null ? ` · şu anki seviye ${r.currentLevel}` : '', h('span', { 'data-testid': 'ci-status', style: 'font-weight:700;margin-left:6px' }, STATUS_TR[r.status] ?? r.status), r.problems.length ? h('div', { 'data-testid': 'ci-problems', style: 'color:#b91c1c' }, r.problems.map((p) => IMPORT_PROBLEM_TR[p] ?? p).join(' · ')) : null, r.evidence ? h('div', { style: 'color:#64748b' }, `Kanıt: ${r.evidence}`) : null)), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, note, h('button', { type: 'button', 'data-testid': 'ci-verify', onClick: () => void decide('VERIFIED') }, 'Seçilenleri doğrula'), h('button', { type: 'button', 'data-testid': 'ci-reject', onClick: () => void decide('REJECTED') }, 'Seçilenleri reddet'))) : null, batches.length ? h('section', { style: 'margin:10px 0' }, h('h2', { style: 'font-size:16px' }, 'Son yüklemeler'), ...batches.map((b) => h('button', { type: 'button', 'data-testid': 'ci-batch', style: 'display:block;background:none;border:0;color:#1d4ed8;text-decoration:underline;padding:2px 0;cursor:pointer;font:inherit;text-align:left',
        onClick: async () => { try {
            go({ preview: await api.preview(b.id) });
        }
        catch (e) {
            go({ message: { kind: 'error', text: errText(e) } });
        } } }, `${b.stagedAt.slice(0, 10)} · ${b.sourceLabel} (${KIND_TR[b.sourceKind] ?? b.sourceKind})`))) : null));
}
