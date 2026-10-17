// Yetki Yönetimi — yalnız sistem SAHİPLERİ (OWNER). Sahipler eşit ve tam yetkilidir; ADMIN rolü sahiplik DEĞİLDİR.
// Modül · işlem · kayıt · alan düzeyinde izin verilir/geri alınır; her değişiklik gerekçelidir ve denetim kaydına yazılır. Karar sunucudadır:
// son sahip kaldırılamaz, yetki yükseltme yoktur, sahip olmayan bu veriyi hiç göremez.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
import { KX_CSS, card, chip, emptyState, when } from '../kx.js';
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const btn = (cls, testid, text, fn) => E('button', { class: cls, type: 'button', 'data-testid': testid, onClick: fn }, text);
const MODULES = ['COST', 'PRICING', 'PROFITABILITY', 'PURCHASING', 'ACCOUNTING', 'PERSONNEL', 'BONUS', 'PRODUCT_MASTER', 'DOCUMENTS', 'ORDERS'];
const MODULE_TR = { COST: 'Maliyet', PRICING: 'Fiyatlama', PROFITABILITY: 'Kârlılık', PURCHASING: 'Satınalma', ACCOUNTING: 'Muhasebe', PERSONNEL: 'Personel', BONUS: 'Prim', PRODUCT_MASTER: 'Ürün ana verisi', DOCUMENTS: 'Belgeler', ORDERS: 'Siparişler' };
const CSS = `.pa .g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}.pa .rowx{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;border:1px solid #1e293b;border-radius:10px;padding:8px 10px;margin-top:6px}`;
const ERR_TR = { OWNER_ONLY: 'Bu ekran yalnız sistem sahiplerine açıktır.', REASON_REQUIRED: 'Gerekçe en az 10 karakter olmalı.', LAST_OWNER: 'Son sahip kaldırılamaz.', USER_NOT_FOUND: 'Kullanıcı bulunamadı veya pasif.', NO_ACTIVE_GRANT: 'Bu izin zaten geri alınmış.' };
const trErr = (e) => { const t = errorText(e); const k = Object.keys(ERR_TR).find((x) => t.includes(x)); return k ? `${ERR_TR[k]} (${k})` : t; };
export async function renderPermissionAdminScreen(container, api, state = {}) {
    const go = (s) => renderPermissionAdminScreen(container, api, s);
    const shell = (...kids) => mount(container, h('div', { class: 'kx pa', 'data-testid': 'pa-root' }, h('style', {}, KX_CSS + CSS), ...kids));
    const head = E('div', { class: 'page-head' }, E('div', { class: 'ttl' }, h('h1', {}, 'Yetki Yönetimi'), E('div', { class: 'mut' }, 'Sistem sahipleri eşittir ve tam yetkilidir. İzinler modül · işlem · kayıt · alan düzeyinde, gerekçeyle verilir ve geri alınır; her adım denetim kaydına yazılır.')));
    const banner = state.banner ? E('div', { class: `banner ${state.banner.kind === 'error' ? 'bad' : state.banner.kind === 'ok' ? 'ok' : ''}`, 'data-testid': 'pa-banner', 'data-kind': state.banner.kind, role: state.banner.kind === 'error' ? 'alert' : 'status' }, state.banner.text) : null;
    let ov;
    try {
        ov = await api.overview();
    }
    catch (e) {
        shell(head, E('div', { class: 'banner bad', role: 'alert', 'data-testid': 'pa-closed' }, trErr(e)));
        return;
    }
    const name = (id) => ov.users.find((u) => u.user_id === id)?.display_name ?? ov.owners.find((o) => o.user_id === id)?.display_name ?? id.slice(0, 8);
    const reasonBox = (tid) => h('input', { 'data-testid': tid, placeholder: 'Gerekçe (en az 10 karakter)', maxlength: 400, style: 'min-width:220px' });
    const act = (fn, okText) => async () => { try {
        await fn();
        await go({ banner: { kind: 'ok', text: okText } });
    }
    catch (e) {
        await go({ banner: { kind: 'error', text: trErr(e) } });
    } };
    const activeOwners = ov.owners.filter((o) => o.active);
    const ownerRows = activeOwners.map((o) => { const r = reasonBox('pa-owner-reason'); return E('div', { class: 'rowx', 'data-testid': 'pa-owner', 'data-user': o.user_id }, E('div', {}, E('b', {}, o.display_name ?? o.user_id.slice(0, 8)), ` · ${when(o.designated_at)} `, chip('SAHİP', 'ok')), E('div', { class: 'row' }, r, btn('ghost sm', 'pa-owner-remove', 'Sahipliği kaldır', act(() => api.removeOwner(o.user_id, r.value), 'Sahiplik kaldırıldı (kayıt geçmişte kalır).')))); });
    const candidates = ov.users.filter((u) => !u.is_owner);
    const userSel = (tid) => h('select', { 'data-testid': tid, 'aria-label': 'Kullanıcı' }, ...candidates.map((u) => h('option', { value: u.user_id }, `${u.display_name ?? u.user_id.slice(0, 8)} (${u.roles.join(', ') || 'rol yok'})`)));
    const ownSel = userSel('pa-owner-user');
    const ownReason = reasonBox('pa-owner-add-reason');
    const gUser = userSel('pa-g-user');
    const gModule = h('input', { 'data-testid': 'pa-g-module', list: 'pa-modules', placeholder: 'Modül (ör. COST)', maxlength: 40 });
    const gVerb = h('select', { 'data-testid': 'pa-g-verb', 'aria-label': 'İşlem' }, ...ov.verbs.map((v) => h('option', { value: v.code }, `${v.label} (${v.code})`)));
    const gRec = h('input', { 'data-testid': 'pa-g-record', placeholder: 'Kayıt kapsamı (boş = tümü)', maxlength: 80 });
    const gField = h('input', { 'data-testid': 'pa-g-field', placeholder: 'Hassas alan (ör. SALARY; boş = hassas olmayan)', maxlength: 40 });
    const gReason = reasonBox('pa-g-reason');
    const grantRows = ov.grants.map((g) => { const r = reasonBox('pa-revoke-reason'); return E('div', { class: 'rowx', 'data-testid': 'pa-grant', 'data-grant': g.id }, E('div', {}, E('b', {}, name(g.user_id)), ` · ${MODULE_TR[g.module] ?? g.module} · ${g.verb}`, g.record_scope ? ` · kayıt: ${g.record_scope}` : '', g.field_scope ? ` · alan: ${g.field_scope}` : '', E('div', { class: 'mut' }, `${g.reason} · ${name(g.granted_by)} · ${when(g.granted_at)}`)), E('div', { class: 'row' }, r, btn('ghost sm', 'pa-revoke', 'Geri al', act(() => api.revoke(g.id, r.value), 'İzin geri alındı (denetim kaydında kalır).')))); });
    shell(head, banner, card({ title: 'Sistem sahipleri', span: 12 }, ...(ownerRows.length ? ownerRows : [emptyState('Sahip tanımlı değil', 'Sahip ataması veritabanı düzeyinde, kimlik onayıyla yapılır.', 'pa-no-owner')]), candidates.length ? E('div', { class: 'rowx' }, E('div', { class: 'row' }, ownSel, ownReason), btn('primary', 'pa-owner-add', 'Sahip yap', act(() => api.designateOwner(ownSel.value, ownReason.value), 'Yeni sahip eklendi.'))) : null), card({ title: 'İzin ver (modül · işlem · kayıt · alan)', span: 12 }, h('datalist', { id: 'pa-modules' }, ...MODULES.map((m) => h('option', { value: m }, MODULE_TR[m]))), candidates.length ? E('div', {}, E('div', { class: 'g2' }, gUser, gModule, gVerb, gRec, gField), E('div', { class: 'row', style: 'margin-top:8px' }, gReason, btn('primary', 'pa-g-go', 'İzin ver', act(() => api.grant(gUser.value, gModule.value, gVerb.value, gReason.value, gRec.value.trim() || null, gField.value.trim() || null), 'İzin verildi.')))) : emptyState('Kullanıcı yok', 'İzin verilecek aktif kullanıcı bulunamadı.', 'pa-no-user')), card({ title: `Aktif izinler (${ov.grants.length})`, span: 12 }, ...(grantRows.length ? grantRows : [emptyState('Verilmiş özel izin yok', 'Varsayılan: yalnız sahipler tüm ekonomik ve hassas alanları görür.', 'pa-no-grant')])));
}
