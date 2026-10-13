// KMI NEXT — Giriş-çıkışlarım (D-010, migration 0038). Everyone sees ONLY their own turnstile passes:
// the server resolves the signed-in login → personnel → that person's VERIFIED cards; nobody else's
// record can be asked for. Not a puantaj figure (D-001): it only shows passes.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText as sharedErrorText } from '../errorText.js';
const hm = (iso) => (iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export async function renderMyAttendanceScreen(container, api, opts) {
    const from = addDays(opts.today, -(opts.days ?? 30));
    let data = null;
    let err = null;
    try {
        data = await api.myAttendance(from, opts.today);
    }
    catch (e) {
        err = sharedErrorText(e);
    }
    mount(container, h('div', { class: 'my-attendance', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'my-heading' }, 'Giriş-çıkışlarım'), h('p', { style: 'font-size:12px;color:#555' }, `Son ${opts.days ?? 30} gün. Yalnız size bağlı, doğrulanmış kartların hareketleri. Puantaj hesabı değildir.`), err ? h('div', { 'data-testid': 'my-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, `Yüklenemedi: ${err}`) : null, data && !data.linked ? h('div', { 'data-testid': 'my-not-linked', style: 'padding:10px;border-radius:8px;background:#fef3c7' }, 'Giriş hesabınız henüz bir personel kaydına bağlı değil. Yöneticiniz bağladığında kendi kayıtlarınızı burada görürsünüz.') : null, data && data.linked && data.cards === 0 ? h('div', { 'data-testid': 'my-no-card', style: 'padding:10px;border-radius:8px;background:#fef3c7' }, 'Size doğrulanmış bir turnike kartı bağlı değil — kart doğrulanana kadar liste boş görünür; bu "hiç gelmedi" demek değildir.') : null, data && data.linked && data.cards > 0 && data.days.length === 0 ? h('div', { 'data-testid': 'my-empty' }, 'Bu dönemde kayıtlı geçiş yok.') : null, data && data.days.length ? h('div', { style: 'overflow-x:auto' }, h('table', { 'data-testid': 'my-table' }, h('thead', {}, h('tr', {}, ...['Gün', 'İlk giriş', 'Son çıkış', 'Geçiş', 'Reddedilen'].map((t) => h('th', {}, t)))), h('tbody', {}, ...data.days.slice().reverse().map((d) => h('tr', { 'data-testid': 'my-row', 'data-day': d.day }, h('td', {}, d.day), h('td', {}, hm(d.firstIn)), h('td', {}, hm(d.lastOut)), h('td', {}, String(d.events)), h('td', {}, d.denied ? String(d.denied) : '—')))))) : null));
}
