// KMI — TAHSİS: bir veya birden fazla ÖLÇÜ KARAKTERİSTİĞİNDE büyük çıkan (oversize) parçanın yetkili ek işleme ile boyutsal düzeltilmesi. STOK TAHSİSİ DEĞİLDİR.
// Mevcut kalite NCR'ı kullanılır (ikinci durum makinesi YOK): Tespit/Ayrıldı = OPEN (HOLD) → Ek işleme = REWORK → Yeniden ölçüm = RECHECK_PENDING → Kabul / Ret.
// Ek işleme üretim sayılmaz: adet NCR açılırken üretimden düşer, kabulde BİR kez geri döner (çift sayım yok).
// Yetkilendirme kuralları (kontrol planını kim girer, ek işlemi kim yetkilendirir, operatör kendi bildirimi, fiziksel ayırma) SAHİP KARARI BEKLİYOR.
import { h, mount } from '../../../../packages/ui/src/h.js';
import { errorText, isSetupPending } from '../errorText.js';
import { DS_CSS, setupPending } from '../ds.js';
import { pilotChip } from '../pilotMark.js';
export const STAGE_TR = { OPEN: 'TESPİT EDİLDİ · AYRILDI (HOLD)', REWORK: 'YETKİLİ EK İŞLEME', RECHECK_PENDING: 'YENİDEN ÖLÇÜM BEKLİYOR', ACCEPTED: 'KABUL EDİLDİ', SCRAPPED: 'RET / HURDA' };
const SRC_TR = { OPERATOR_SELF_DECLARED: 'Operatör bildirimi', QUALITY_DETECTED: 'Kalite tespiti' };
const fmt = (iso) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export async function renderTahsisScreen(container, api, state = {}) {
    const go = (s) => renderTahsisScreen(container, api, s);
    let cases;
    try {
        cases = await api.cases();
    }
    catch (e) {
        mount(container, h('div', { class: 'kd', 'data-testid': 'th-root' }, h('style', {}, DS_CSS), h('h1', {}, 'TAHSİS'), isSetupPending(e) ? setupPending('TAHSİS', 'TAHSİS veri modeli henüz kurulmadı (DB paketi 0076). Mevcut NCR kayıtlarınız etkilenmedi.') : h('div', { class: 'banner error', 'data-testid': 'th-error' }, `Yüklenemedi: ${errorText(e)}`)));
        return;
    }
    const open = cases.find((c) => c.id === state.openId) ?? null;
    let chars = [];
    let machines = [];
    let tools = [];
    let people = [];
    if (open) {
        try {
            [chars, machines, tools, people] = await Promise.all([api.characteristics(open.id), api.machines(), api.tools(), api.people()]);
        }
        catch { /* shown below as empty */ }
    }
    let wos = [];
    try {
        wos = await api.workOrders();
    }
    catch {
        wos = [];
    }
    let busy = false;
    const act = async (fn, ok, keep) => {
        if (busy)
            return;
        busy = true;
        container.querySelectorAll('.kd button').forEach((b) => (b.disabled = true));
        try {
            await fn();
            await go({ banner: { kind: 'info', text: ok }, openId: keep ?? state.openId });
        }
        catch (e) {
            await go({ banner: { kind: 'error', text: errorText(e) }, openId: state.openId });
        }
    };
    const num = (el) => Number(el.value.trim().replace(',', '.'));
    const woSel = h('select', { 'data-testid': 'th-wo' }, ...wos.map((w) => h('option', { value: w.id }, w.label)));
    const qty = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Adet', 'data-testid': 'th-qty', style: 'width:90px' });
    const why = h('input', { type: 'text', placeholder: 'Neden / hangi ölçü büyük (zorunlu)', 'data-testid': 'th-why', class: 'grow' });
    const src = h('select', { 'data-testid': 'th-source' }, h('option', { value: 'QUALITY_DETECTED' }, 'Kalite tespiti'), h('option', { value: 'OPERATOR_SELF_DECLARED' }, 'Operatör bildirimi'));
    const openForm = h('div', { class: 'panel', 'data-testid': 'th-open-form' }, h('h2', {}, 'Yeni TAHSİS kaydı'), h('div', { class: 'row', style: 'display:flex;gap:6px;flex-wrap:wrap' }, woSel, qty, src, why, h('button', { type: 'button', class: 'primary', 'data-testid': 'th-open', onClick: () => {
            if (why.value.trim().length < 5)
                return void go({ banner: { kind: 'error', text: 'Neden zorunlu (en az 5 karakter).' } });
            if (!(num(qty) > 0))
                return void go({ banner: { kind: 'error', text: 'Adet pozitif olmalı.' } });
            void act(() => api.open(woSel.value, num(qty), why.value.trim(), src.value), 'TAHSİS kaydı açıldı; parti ayrıldı (HOLD).');
        } }, 'Aç')), h('div', { class: 'mut' }, 'Sunucu yetkisi ister (Kalite/Yönetici). Operatör kendi bildirimini kayıt altına alma kuralı sahip kararını bekliyor.'));
    const transitions = { OPEN: [['Yetkili ek işleme başlat', 'REWORK', 'primary'], ['Hurda / ret', 'SCRAPPED', 'danger']], REWORK: [['Ek işleme bitti → yeniden ölçüm', 'RECHECK_PENDING', 'primary']], RECHECK_PENDING: [['Ölçü uygun → kabul', 'ACCEPTED', 'primary'], ['Hâlâ uygun değil → hurda', 'SCRAPPED', 'danger']], ACCEPTED: [], SCRAPPED: [] };
    const detail = (c) => {
        const note = h('input', { type: 'text', placeholder: 'Karar notu (en az 5 karakter)', 'data-testid': 'th-note', class: 'grow' });
        const f = (id, ph, w = 90) => h('input', { type: 'text', inputmode: 'decimal', placeholder: ph, 'data-testid': id, style: `width:${w}px;min-width:0` });
        const op = f('th-c-op', 'Op no', 70), code = f('th-c-code', 'Karakteristik (ör. D1)', 130), feat = f('th-c-feature', 'Yüzey/özellik', 130), nom = f('th-c-nominal', 'Nominal'), tl = f('th-c-tl', 'Alt tol. (−)'), tu = f('th-c-tu', 'Üst tol. (+)'), me = f('th-c-measured', 'Ölçülen'), q = f('th-c-qty', 'Adet', 70), ev = f('th-c-evidence', 'Kanıt (foto/rapor no)', 150), ins = f('th-c-instructions', 'Ek işleme talimatı', 200);
        const sel = (id, label, items) => h('select', { 'data-testid': id, 'aria-label': label }, h('option', { value: '' }, `${label}: seçilmedi`), ...items.map((i) => h('option', { value: i.id }, i.label)));
        const mSel = sel('th-c-machine', 'Makine', machines), tSel = sel('th-c-tool', 'Takım', tools), pSel = sel('th-c-person', 'Operatör', people);
        return h('div', { class: 'panel', 'data-testid': 'th-detail', 'data-id': c.id }, h('h2', {}, ...(c.isPilot ? [pilotChip()] : []), `TAHSİS · İE ${c.workOrderId.slice(0, 8)} · ${c.qty} adet`), h('div', { class: 'mut' }, `${STAGE_TR[c.status]} · ${SRC_TR[c.detectionSource]} · ${fmt(c.openedAt)} · ${c.reason}`), h('table', { class: 'fp-table', 'data-testid': 'th-chars' }, h('thead', {}, h('tr', {}, ...['Op', 'Karakt.', 'Özellik', 'Nominal', 'Tol.', 'Ölçülen', 'Fazla', 'Adet', 'Kanıt'].map((t) => h('th', {}, t)))), h('tbody', {}, ...(chars.length ? chars.map((x) => h('tr', { 'data-testid': 'th-char' }, h('td', {}, String(x.operationNo)), h('td', {}, x.characteristicCode), h('td', {}, x.feature ?? '—'), h('td', {}, String(x.nominal)), h('td', {}, `${x.tolLower}/+${x.tolUpper}`), h('td', {}, String(x.measured)), h('td', {}, `+${x.oversizeExcess} ${x.unit}`), h('td', {}, String(x.qty)), h('td', {}, x.evidenceRef ?? '—')))
            : [h('tr', {}, h('td', { colSpan: 9, 'data-testid': 'th-no-chars' }, 'Boyut kaydı yok — ek işleme yetkisi için ölçü kaydı gerekir.'))]))), c.status === 'OPEN' || c.status === 'REWORK' ? h('div', { 'data-testid': 'th-char-form' }, h('h3', {}, 'Boyut kaydı ekle (değiştirilemez)'), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, op, code, feat, nom, tl, tu, me, q, mSel, tSel, pSel, ev, ins, h('button', { type: 'button', 'data-testid': 'th-c-add', onClick: () => {
                const rev = api.revisionOf(c.workOrderId);
                void act(async () => { const r = await rev; if (!r)
                    throw new Error('Bu iş emrinin ürün revizyonu yok; boyut kaydı bağlanamaz.'); await api.addCharacteristic(c.id, r, { operationNo: num(op), code: code.value.trim(), feature: feat.value.trim(), nominal: num(nom), tolLower: num(tl), tolUpper: num(tu), measured: num(me), qty: num(q), machineId: mSel.value || null, toolId: tSel.value || null, operatorId: pSel.value || null, evidenceRef: ev.value.trim(), instructions: ins.value.trim() }); }, 'Boyut kaydı eklendi.');
            } }, 'Kaydı ekle')), h('div', { class: 'mut' }, 'Yalnız ÜST toleransın üstündeki (oversize) ölçüler kabul edilir; tolerans içi/alt ölçü TAHSİS kaydı olmaz.')) : null, transitions[c.status].length ? h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px' }, note, ...transitions[c.status].map(([label, to, cls]) => h('button', { type: 'button', class: cls, 'data-testid': `th-to-${to}`, onClick: () => { if (note.value.trim().length < 5)
                return void go({ banner: { kind: 'error', text: 'Karar notu zorunlu (en az 5 karakter).' }, openId: c.id }); void act(() => api.transition(c.id, to, note.value.trim()), `Durum: ${STAGE_TR[to]}`); } }, label))) : h('div', { class: 'mut' }, 'Kapanmış kayıt.'), h('div', { class: 'mut' }, 'Ek işleme üretim beyanı değildir: iyi/hurda/OEE/stok/puantaj/maliyette yeni üretim sayılmaz.'));
    };
    mount(container, h('div', { class: 'kd', 'data-testid': 'th-root' }, h('style', {}, DS_CSS), h('h1', { 'data-testid': 'th-heading' }, 'TAHSİS — ölçü düzeltme'), h('p', { class: 'mut' }, 'Büyük çıkan ölçünün yetkili ek işleme ile düzeltilmesi (stok tahsisi değildir). Mevcut kalite NCR akışı kullanılır.'), state.banner ? h('div', { class: `banner ${state.banner.kind}`, 'data-testid': 'th-banner', role: state.banner.kind === 'error' ? 'alert' : 'status' }, state.banner.text) : null, openForm, h('div', { 'data-testid': 'th-list' }, ...(cases.length ? cases.map((c) => h('div', { class: 'item', 'data-testid': 'th-case', 'data-status': c.status, 'data-id': c.id, 'data-wo': c.workOrderId }, h('div', { class: 'grow' }, h('b', {}, ...(c.isPilot ? [pilotChip()] : []), `İE ${c.workOrderId.slice(0, 8)} · ${c.qty} adet`), h('div', { class: 'mut' }, `${STAGE_TR[c.status]} · ${SRC_TR[c.detectionSource]} · ${fmt(c.openedAt)}`)), h('button', { type: 'button', 'data-testid': 'th-open-case', onClick: () => void go({ openId: c.id }) }, 'Aç'))) : [h('div', { class: 'mut', 'data-testid': 'th-empty' }, 'Açık TAHSİS kaydı yok.')])), open ? detail(open) : null));
}
