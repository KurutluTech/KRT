// KMI — Ekonomik sahiplik BAŞVURUSU (D-007). Bu ekran yalnız "başvuru" içindir: ekonomik veri çağırmaz,
// ekonomik veri göstermez, yetki vermez. Başvuru, giriş yapmış hesabın kimliğiyle sunucuda kaydedilir
// (request_owner_binding); onay ayrıca ve yalnız veritabanı düzeyinde, sahibin açık ifadesiyle verilir.
// Ekranın görünmesi ekonomik erişim anlamına gelmez; gerçek ekonomik ekran (/ekonomi) sunucu kararıyla açılır.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { humanError } from '../errorText.js';
const REFUSAL_TR = {
    OWNER_ALREADY_BOUND: 'Sahip hesabı zaten bağlı.',
    ACCOUNT_NOT_ELIGIBLE: 'Bu hesap sahip olarak bağlanamaz (hesap bulunamadı, silinmiş veya engellenmiş).',
    EMAIL_NOT_CONFIRMED: 'Bu hesabın e-posta adresi doğrulanmamış; önce e-posta doğrulaması gerekir.',
    NO_PENDING_REQUEST: 'Bekleyen bir talep yok.',
};
const errText = (e) => (e instanceof Error ? e.message : String(e));
const refusalText = (msg) => REFUSAL_TR[msg] ?? humanError(msg);
const STATE_TR = { EXPIRED: 'süresi doldu', REJECTED: 'reddedildi', VOIDED_CONFLICT: 'çakışma nedeniyle iptal edildi', CANCELLED: 'geri çekildi', APPROVED: 'onaylandı' };
const fmt = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
/** Only `bindingStatus`, `requestOwnerBinding` and `cancelOwnerBindingRequest` are ever called here — never an economic read. */
export async function renderOwnerApplicationScreen(container, api, state = {}) {
    let binding = null;
    let statusFailed = false;
    try {
        binding = await api.bindingStatus();
    }
    catch {
        statusFailed = true;
    }
    const go = (patch) => void renderOwnerApplicationScreen(container, api, patch);
    const shell = (...children) => mount(container, h('div', { class: 'owner-application-screen', style: 'padding:0 16px;box-sizing:border-box;max-width:100%' }, h('h1', { 'data-testid': 'ownapp-heading' }, 'Ekonomik sahiplik başvurusu'), ...children));
    const ask = async () => {
        try {
            const r = await api.requestOwnerBinding();
            if (r.status === 'VOIDED_CONFLICT')
                return go({ error: 'Aynı anda başka bir hesaptan da sahip talebi geldi. Güvenlik için iki talep de iptal edildi; kimse bağlanmadı. Birkaç dakika sonra yalnız kendi hesabınızdan tekrar deneyin.' });
            go({ notice: 'Talebiniz alındı.' });
        }
        catch (err) {
            go({ error: refusalText(errText(err)) });
        }
    };
    const cancel = async () => {
        try {
            await api.cancelOwnerBindingRequest();
            go({ notice: 'Talep geri çekildi.' });
        }
        catch (err) {
            go({ error: refusalText(errText(err)) });
        }
    };
    const banner = [
        h('div', { 'data-testid': 'ownapp-note', style: 'margin:12px 0;padding:14px;border-radius:12px;background:#f1f5f9;border:1px solid #cbd5e1' }, h('b', {}, 'Bu ekran ekonomik veri göstermez'), h('p', { style: 'margin:6px 0 0' }, 'Maliyet, kârlılık ve ekonomik analizler yalnız onaylanmış ekonomik sahibe açıktır. Başvuru yapmak veya bu ekranı görmek erişim vermez; rolünüz (admin, yönetim, muhasebe, IT) bu erişimi otomatik vermez.')),
        state.error ? h('div', { 'data-testid': 'ownapp-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, state.error) : null,
        state.notice ? h('div', { 'data-testid': 'ownapp-notice', style: 'padding:10px;border-radius:8px;background:#dcfce7' }, state.notice) : null,
    ];
    if (statusFailed || !binding) {
        shell(...banner, h('div', { 'data-testid': 'ownapp-load-error', style: 'padding:10px;border-radius:8px;background:#fee2e2' }, 'Durum alınamadı. Sayfayı yenileyin.'));
        return;
    }
    if (binding.bound) {
        shell(...banner, h('div', { 'data-testid': 'ownapp-bound', style: 'margin:12px 0;padding:12px;border-radius:12px;border:1px solid #cbd5e1' }, h('b', {}, 'Ekonomik sahip hesabı zaten bağlı'), h('p', { style: 'margin:6px 0 0;font-size:13px' }, 'Yeni başvuru açılamaz.')));
        return;
    }
    const req = binding.myRequest ?? null;
    shell(...banner, h('div', { 'data-testid': 'ownapp-bind', style: 'margin:12px 0;padding:12px;border-radius:12px;border:1px dashed #94a3b8' }, h('b', {}, 'Sahip hesabı henüz bağlanmadı'), req && req.state === 'PENDING'
        ? h('div', { 'data-testid': 'ownapp-pending' }, h('p', { style: 'margin:6px 0;font-size:14px' }, 'Talebiniz bu hesap için alındı. Son adım: sohbette "Onaylıyorum: <referans> / <e-posta>" yazmanız. Yalnız bu talep, e-posta birebir eşleşirse onaylanır.'), h('div', { 'data-testid': 'ownapp-request', style: 'font-size:13px;line-height:1.6;padding:8px;border-radius:8px;background:#f8fafc' }, h('div', {}, 'Hesap: ', h('b', {}, req.email)), h('div', {}, 'Talep: ', fmt(req.requestedAt), ' · geçerlilik: ', fmt(req.expiresAt), ' (30 dk)'), h('div', {}, 'Referans: ', h('code', {}, req.reference))), h('button', { type: 'button', 'data-testid': 'ownapp-cancel', style: 'margin-top:8px', onClick: () => void cancel() }, 'Talebi geri çek'))
        : h('div', {}, h('p', { style: 'margin:6px 0;font-size:13px' }, 'Ender Kurutlu iseniz, kendi hesabınızla giriş yapmışken aşağıdaki düğmeye basın. Başvuru yalnız şu an giriş yapmış olan hesaba kaydedilir; isimden veya e-postadan asla tahmin edilmez.'), req ? h('div', { 'data-testid': 'ownapp-last', style: 'font-size:12px;color:#64748b;margin-bottom:6px' }, `Son talebiniz (${fmt(req.requestedAt)}): ${STATE_TR[req.state] ?? req.state}.`) : null, h('button', { type: 'button', 'data-testid': 'ownapp-request-btn', onClick: () => void ask() }, 'Bu hesap için ekonomik sahiplik başvurusu yap'))));
}
