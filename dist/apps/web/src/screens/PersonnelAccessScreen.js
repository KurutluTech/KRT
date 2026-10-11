// KMI NEXT — Personel Erişimi: kim hangi hesapla giriyor, hangi vardiyada, kaç makineyi birlikte kullanabilir.
// Bu ekran gerçek kullanıcıya geçişin yönetim yoludur (hesap bağlama elle SQL gerektirmesin). Hiçbir şey ad benzerliğiyle EŞLEŞTİRİLMEZ:
// hesabı yönetici açıkça seçer ve seçtiği hesabın rolleri yanında görünür. Yetki sunucuda (PERSONNEL_LOGIN_LINK / WORK_ORDER_ASSIGN_MACHINE /
// WORK_ORDER_MULTI_MACHINE_ASSIGN); burada olmayan yetkinin düğmeleri hiç gösterilmez. Maaş / prim katsayısı bu ekranda yoktur.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText } from '../errorText.js';
const CSS = `
.pa{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;max-width:760px;margin:0 auto;box-sizing:border-box;color:#0f172a}
.pa button{min-height:44px;font-size:16px;font-weight:700;border-radius:12px;border:0;padding:0 14px;cursor:pointer}
.pa select,.pa input{min-height:44px;font-size:16px;border-radius:10px;border:1px solid #cbd5e1;padding:0 10px;box-sizing:border-box;width:100%}
.pa .card{background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.pa .chip{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:800;font-size:12px;margin:2px 4px 2px 0}
.pa .ok{background:#dcfce7;color:#166534}.pa .warn{background:#fef3c7;color:#92400e}.pa .bad{background:#fee2e2;color:#991b1b}.pa .info{background:#e0e7ff;color:#3730a3}
.pa .primary{background:#1d4ed8;color:#fff}.pa .ghost{background:#e2e8f0;color:#0f172a}
.pa .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.pa .grid{display:grid;gap:8px;margin-top:8px}
`;
const rid = () => Math.random().toString(36).slice(2);
export async function renderPersonnelAccessScreen(container, api, state = {}) {
    const go = (s) => renderPersonnelAccessScreen(container, api, s);
    let ov;
    let accounts = [];
    try {
        ov = await api.overview();
        if (ov.canLink)
            accounts = await api.accounts();
    }
    catch (e) {
        mount(container, h('div', { class: 'pa', 'data-testid': 'pa-root' }, h('style', {}, CSS), h('div', { class: 'card bad', 'data-testid': 'pa-error' }, `Yüklenemedi: ${errorText(e)}`)));
        return;
    }
    let busy = false;
    const act = async (fn, ok, keepOpen) => {
        if (busy)
            return;
        busy = true;
        container.querySelectorAll('.pa button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ banner: { kind: 'info', text: ok } });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) }, open: keepOpen });
        }
    };
    const roleMismatch = (p) => p.linked && p.roles.length > 0 && !p.roles.some((r) => p.accountRoles.includes(r));
    const card = (p) => {
        const open = state.open === p.id;
        const accSel = h('select', { 'data-testid': 'pa-account' }, h('option', { value: '' }, '— hesap seçin —'), ...accounts.map((a) => h('option', { value: a.userId }, `${a.name} · ${a.roles.join(', ') || 'rol yok'}`)));
        const shiftSel = h('select', { 'data-testid': 'pa-shift' }, h('option', { value: '' }, '— vardiya yok —'), ...ov.shifts.map((s) => h('option', { value: s.code, selected: p.shiftCode === s.code ? 'selected' : undefined }, `${s.code}${s.production ? '' : ' (ofis)'}`)));
        const lvlSel = h('select', { 'data-testid': 'pa-multi-level' }, h('option', { value: '' }, 'Tek makine (yetki yok)'), h('option', { value: '2' }, 'En çok 2 makine'), h('option', { value: '3' }, 'En çok 3 makine'));
        const reasonIn = h('input', { type: 'text', 'data-testid': 'pa-multi-reason', placeholder: 'Gerekçe (zorunlu)' });
        return h('div', { class: 'card', 'data-testid': 'pa-person', 'data-person': p.id }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('strong', { style: 'font-size:18px' }, p.name), h('span', { class: `chip ${p.active ? 'ok' : 'warn'}` }, p.active ? 'aktif' : 'pasif')), h('div', {}, h('span', { class: 'chip info' }, p.roles.join(', ') || 'rol yok'), p.employeeNo ? h('span', { class: 'chip info' }, `sicil ${p.employeeNo}`) : null, h('span', { class: `chip ${p.shiftCode ? 'ok' : 'warn'}`, 'data-testid': 'pa-shift-chip' }, p.shiftCode ?? 'vardiya yok'), h('span', { class: `chip ${p.multiMachineLevel ? 'ok' : 'info'}`, 'data-testid': 'pa-multi-chip' }, p.multiMachineLevel ? `${p.multiMachineLevel} makine yetkisi` : '1 makine')), p.linked
            ? h('div', {}, h('span', { class: 'chip ok', 'data-testid': 'pa-linked' }, `Hesap: ${p.accountName ?? '—'}`), p.accountRoles.map((r) => h('span', { class: 'chip info' }, r)), roleMismatch(p) ? h('div', { class: 'chip bad', 'data-testid': 'pa-role-mismatch' }, 'Hesabın rolleri personelin rolüyle uyuşmuyor') : null)
            : h('div', { class: 'chip warn', 'data-testid': 'pa-unlinked' }, p.active ? 'Hesap bağlı değil — giriş yapamaz' : 'Hesap bağlı değil'), h('button', { type: 'button', class: 'ghost', style: 'margin-top:6px', 'data-testid': 'pa-toggle', onClick: () => void go({ open: open ? null : p.id }) }, open ? 'Kapat' : 'Düzenle'), open
            ? h('div', { class: 'grid', 'data-testid': 'pa-edit' }, ov.canLink
                ? (p.linked
                    ? h('button', { type: 'button', class: 'ghost', 'data-testid': 'pa-unlink', onClick: () => void act(() => api.link(p.id, null), 'Hesap bağlantısı kaldırıldı.', p.id) }, 'Hesap bağlantısını kaldır')
                    : h('div', { class: 'grid' }, accSel, h('button', { type: 'button', class: 'primary', 'data-testid': 'pa-link', onClick: () => {
                            if (!accSel.value) {
                                void go({ banner: { kind: 'error', text: 'Önce bir hesap seçin.' }, open: p.id });
                                return;
                            }
                            void act(() => api.link(p.id, accSel.value), 'Hesap bağlandı.', p.id);
                        } }, 'Seçili hesabı bağla')))
                : h('div', { class: 'chip warn' }, 'Hesap bağlama yetkiniz yok'), ov.canShift
                ? h('div', { class: 'grid' }, shiftSel, h('button', { type: 'button', class: 'primary', 'data-testid': 'pa-shift-save', onClick: () => void act(() => api.setShift(p.id, shiftSel.value || null), 'Vardiya kaydedildi.', p.id) }, 'Vardiyayı kaydet'))
                : h('div', { class: 'chip warn' }, 'Vardiya atama yetkiniz yok'), ov.canMulti && p.roles.includes('OPERATOR')
                ? h('div', { class: 'grid' }, lvlSel, reasonIn, h('button', { type: 'button', class: 'primary', 'data-testid': 'pa-multi-save', onClick: () => {
                        const reason = reasonIn.value.trim();
                        if (!reason) {
                            void go({ banner: { kind: 'error', text: 'Gerekçe zorunlu.' }, open: p.id });
                            return;
                        }
                        if (!lvlSel.value)
                            void act(() => api.revokeMulti(p.id, reason), 'Çoklu makine yetkisi kaldırıldı.', p.id);
                        else
                            void act(() => api.grantMulti(p.id, Number(lvlSel.value), reason), 'Çoklu makine yetkisi verildi.', p.id);
                    } }, 'Çoklu makine yetkisini kaydet'))
                : null)
            : null);
    };
    const people = ov.people;
    mount(container, h('div', { class: 'pa', 'data-testid': 'pa-root' }, h('style', {}, CSS), h('h1', {}, 'Personel Erişimi'), h('p', { style: 'color:#475569' }, 'Hesap bağlama, vardiya ve çoklu makine yetkisi. Eşleştirme ad benzerliğiyle yapılmaz; hesabı siz seçersiniz.'), state.banner ? h('div', { class: `card ${state.banner.kind === 'error' ? 'bad' : 'ok'}`, 'data-testid': 'pa-banner', 'data-kind': state.banner.kind }, state.banner.text) : null, h('div', { 'data-testid': 'pa-summary' }, `${people.filter((p) => p.active).length} aktif · ${people.filter((p) => p.active && !p.linked).length} hesabı bağlı değil`), ...people.map(card)));
}
