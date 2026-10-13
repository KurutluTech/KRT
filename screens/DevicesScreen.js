// KMI NEXT — Cihaz entegrasyonları (madde 40–42, migration 0048). Durum: ENGELLİ — CİHAZ KANITI GEREKLİ.
// Nikken, LockCell ve CNC için protokol / adres / kimlik bilgisi doğrulanmadığından hiçbir bağlantı yoktur;
// bu ekran neyin eksik olduğunu, kayıtlı cihazları ve karantinadaki mesaj sayılarını gösterir. Simülatör
// mesajı canlı veri sayılmaz; hiçbir cihaz mesajı KMI kayıtlarına uygulanmaz.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { humanError } from '../errorText.js';
const REFUSAL_TR = { 'FORBIDDEN: DEVICE_MANAGE': 'Cihaz kaydı yalnız ADMIN yetkisiyle yapılır.', MACHINE_REQUIRED: 'CNC kontrol ünitesi bir tezgâha bağlanmalı.',
    MACHINE_NOT_FOUND: 'Bu makine kodu kayıtlı değil.', NAME_REQUIRED: 'Cihaz adı en az 3 karakter olmalı.' };
const errText = (e) => { const m = e instanceof Error ? e.message : String(e); return REFUSAL_TR[m] ?? humanError(m); };
export async function renderDevicesScreen(container, api, state = {}) {
    let hl = null;
    let loadError = null;
    try {
        hl = await api.health();
    }
    catch (e) {
        loadError = errText(e);
    }
    const go = (p) => void renderDevicesScreen(container, api, p);
    const kind = h('select', { 'data-testid': 'dev-kind' }, ...(hl?.integrations ?? []).map((k) => h('option', { value: k.code }, k.titleTr)));
    const name = h('input', { type: 'text', 'data-testid': 'dev-name', placeholder: 'Cihaz adı', style: 'flex:1 1 140px;min-width:0' });
    const machine = h('input', { type: 'text', 'data-testid': 'dev-machine', placeholder: 'Makine kodu (CNC için zorunlu)', style: 'width:12em' });
    const reg = async () => { try {
        await api.register(kind.value, name.value, machine.value.trim() || null, null);
        go({ notice: 'Cihaz kaydedildi (bağlantı yok, durum: kanıt bekliyor).' });
    }
    catch (e) {
        go({ error: errText(e) });
    } };
    mount(container, h('div', { style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'dev-heading' }, 'Cihaz entegrasyonları'), h('div', { 'data-testid': 'dev-banner', style: 'padding:10px;border-radius:10px;background:#fef3c7;color:#78350f;font-weight:700' }, 'ENGELLİ — CİHAZ KANITI GEREKLİ. Doğrulanmış cihaz belgesi olmadan hiçbir protokol, adres veya veri eşlemesi yazılmadı; cihaz mesajları karantinada tutulur ve KMI kayıtlarına uygulanmaz.'), loadError ? h('div', { 'data-testid': 'dev-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, loadError) : null, state.error ? h('div', { 'data-testid': 'dev-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, state.error) : null, state.notice ? h('div', { 'data-testid': 'dev-notice', style: 'padding:10px;border-radius:8px;background:#dcfce7' }, state.notice) : null, ...(hl?.integrations ?? []).map((k) => h('section', { 'data-testid': 'dev-integration', 'data-code': k.code, 'data-status': k.status, style: 'border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;margin:8px 0' }, h('b', {}, `${k.titleTr} (madde ${k.matrixItem})`), h('div', { style: 'font-size:12px;font-weight:700;color:#b45309' }, k.status === 'BLOCKED_DEVICE_EVIDENCE' ? 'Kanıt bekliyor' : `Kanıt kaydedildi: ${k.evidenceRef}`), h('div', { style: 'font-size:12px;margin-top:4px' }, 'Gereken:'), ...k.evidenceNeeded.map((x) => h('div', { 'data-testid': 'dev-needed', style: 'font-size:12px;overflow-wrap:anywhere' }, `• ${x}`)), h('div', { style: 'font-size:11px;color:#64748b' }, `Kayıtlı cihaz: ${k.devices}`))), hl && hl.devices.length ? h('section', {}, h('h2', { style: 'font-size:16px' }, 'Kayıtlı cihazlar'), ...hl.devices.map((d) => h('div', { 'data-testid': 'dev-device', style: 'font-size:12px;border-top:1px solid #f1f5f9;padding:4px 0;overflow-wrap:anywhere' }, `${d.name}${d.machine ? ` · makine ${d.machine}` : ''} · seri no: ${d.serialNo ?? 'cihazdan okunmadı'} · karantinada ${d.messages} mesaj · simülatör ${d.simulatedMessages} (canlı değil)`))) : null, h('details', { 'data-testid': 'dev-register', style: 'margin:10px 0' }, h('summary', {}, 'Cihaz kaydet (ADMIN)'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px' }, kind, name, machine, h('button', { type: 'button', 'data-testid': 'dev-save', onClick: () => void reg() }, 'Kaydet'))), hl ? h('p', { style: 'font-size:11px;color:#64748b' }, hl.note) : null));
}
