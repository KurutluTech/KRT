// KMI-ASSET-001 — Dijital Varlık Pasaportu. One canonical identity, sections for identity / location & responsibility / custody / machine & calibration relations / history.
// Specialist passports are linked, never copied. Everything shown comes from asset_get (server-scoped); unknown → BİLİNMİYOR. Calibration is never shown as "onaylı".
import { h, mount } from '../../../../packages/ui/src/h.js';
import { encodeQr, qrToSvg } from '../../../../packages/ui/src/qr.js';
import { dateTr } from '../cardKit.js';
import { errorText } from '../errorText.js';
import { transferResultText, ASSET_FROM_KEY } from './AssetCenterScreen.js';
import { CLASS_TR, DEPARTMENTS, EVENT_TR, KIND_TR, LIFECYCLE_TR, OPS_TR, TRANSFER_STATUS_TR, deptTr } from '../assetApi.js';
const CSS = `
.ap{max-width:1000px;margin:0 auto;padding:0 4px 28px}.ap h1{margin:6px 0 2px;font-size:26px}.ap-code{color:var(--kmi-mut,#94a3b8);font-size:14px}
.ap-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 12px}
.ap-badge{padding:4px 12px;border-radius:999px;font-weight:700;font-size:13px;border:1px solid var(--kmi-line,#1e2d4a)}.ap-badge[data-tone=ok]{background:rgba(34,197,94,.16)}.ap-badge[data-tone=warn]{background:rgba(251,191,36,.18)}.ap-badge[data-tone=bad]{background:rgba(239,68,68,.2)}
.ap-sec{padding:12px 14px;margin-bottom:12px;border-radius:14px;background:var(--kmi-panel,#0f1a2e);border:1px solid var(--kmi-line,#1e2d4a)}.ap-sec h2{margin:0 0 8px;font-size:17px}
.ap-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;margin:0}.ap-dl div{min-width:0}.ap-dl dt{font-size:12px;color:var(--kmi-mut,#94a3b8)}.ap-dl dd{margin:0;overflow-wrap:anywhere}.ap-dl dd.unk{color:var(--kmi-warn,#fbbf24)}
.ap-btn{min-height:44px;padding:8px 16px;border-radius:12px;border:1px solid var(--kmi-focus,#38bdf8);background:rgba(56,189,248,.12);color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}.ap-btn.sec{border-color:var(--kmi-line,#1e2d4a);background:none}.ap-btn:focus-visible{outline:3px solid var(--kmi-focus,#38bdf8);outline-offset:2px}
.ap-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:8px}.ap-row label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--kmi-mut,#94a3b8);min-width:0;flex:1 1 180px}
.ap-row input,.ap-row select{min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--kmi-line,#1e2d4a);background:#0b1220;color:inherit;font:inherit;min-width:0}
.ap-msg{padding:10px 12px;border-radius:10px;margin:6px 0 10px;font-size:14px}.ap-msg[data-kind=ok]{background:rgba(34,197,94,.16)}.ap-msg[data-kind=error]{background:rgba(239,68,68,.18)}.ap-msg[data-kind=info]{background:rgba(56,189,248,.14)}
.ap-ev{list-style:none;margin:0;padding:0}.ap-ev li{padding:8px 0;border-top:1px solid var(--kmi-line,#1e2d4a);display:flex;gap:6px 12px;flex-wrap:wrap}.ap-ev li:first-child{border-top:0}.ap-ev small{color:var(--kmi-mut,#94a3b8)}
.ap-qr{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.ap-qr svg{width:140px;height:140px;background:#fff;border-radius:8px}
`;
const E = (tag, props = null, ...kids) => h(tag, props, ...kids);
const dl = (items) => E('dl', { class: 'ap-dl' }, ...items.map(([k, v, tid]) => E('div', {}, E('dt', {}, k), E('dd', { class: v ? '' : 'unk', ...(tid ? { 'data-testid': tid } : {}) }, v || 'BİLİNMİYOR'))));
export function calibrationText(c) {
    if (!c)
        return null;
    return c.state === 'VALID' ? `Geçerli sertifika kaydı var (bitiş ${dateTr(c.valid_until) ?? '—'}). Bu ekran sertifikayı onaylamaz; belge için makine pasaportuna bakın.`
        : c.state === 'EXPIRED' ? `SÜRESİ DOLMUŞ — sertifika bitişi ${dateTr(c.valid_until) ?? '—'}. Kullanılmadan önce yeniden kalibrasyon gerekir.` : 'BİLİNMİYOR — geçerli sertifika veya bitiş tarihi kayıtlı değil.';
}
export async function renderAssetPassportScreen(container, id, deps) {
    const root = E('div', { class: 'kx ap', 'data-testid': 'ap-root' }, E('style', {}, CSS));
    const body = E('div', {});
    const msg = E('div', { 'aria-live': 'polite' });
    let flash = null;
    const say = (kind, text) => { flash = { kind, text }; };
    mount(container, root);
    root.append(E('a', { href: '#/varliklar', class: 'ap-btn sec', 'data-testid': 'ap-back', onClick: (ev) => { let from = null; try {
            from = sessionStorage.getItem(ASSET_FROM_KEY);
        }
        catch { /* ignore */ } if (from) {
            ev.preventDefault();
            location.hash = from;
        } } }, '← Dijital Varlık Merkezi'), msg, body);
    const load = async () => {
        let d;
        try {
            d = await deps.api.get(id);
        }
        catch (e) {
            body.replaceChildren(E('div', { class: 'ap-msg', 'data-kind': 'error', role: 'alert', 'data-testid': 'ap-error' }, /NOT_FOUND|ASSET_NOT_FOUND/.test(String(e.message)) ? 'Varlık bulunamadı veya bu kaydı görme yetkiniz yok.' : errorText(e)));
            return;
        }
        msg.replaceChildren(...(flash ? [E('div', { class: 'ap-msg', 'data-kind': flash.kind, 'data-testid': 'ap-message', role: flash.kind === 'error' ? 'alert' : 'status' }, flash.text)] : []));
        if (d.restricted) {
            body.replaceChildren(E('h1', { 'data-testid': 'ap-title' }, d.name ?? 'BİLİNMİYOR'), E('div', { class: 'ap-code' }, `${d.code} · ${CLASS_TR[d.class].full}`), E('div', { class: 'ap-msg', 'data-kind': 'info', 'data-testid': 'ap-restricted' }, 'Bu varlığın ayrıntıları yetkiniz dışında. Yalnız kimliği görünür; zimmet, konum ve geçmiş gösterilmez.'));
            return;
        }
        const a = d.asset;
        const sections = [];
        const tone = a.lifecycle === 'ACTIVE' ? (a.ops_state && a.ops_state !== 'UP' ? 'warn' : 'ok') : a.lifecycle === 'OUT_OF_SERVICE' ? 'bad' : 'warn';
        const badgeText = a.lifecycle === 'ACTIVE' ? (a.ops_state ? OPS_TR[a.ops_state] ?? a.ops_state : LIFECYCLE_TR.ACTIVE) : LIFECYCLE_TR[a.lifecycle];
        const holderText = a.holder ? `${a.holder.kind === 'DEPARTMENT' ? deptTr(a.holder.name) : a.holder.name}${a.holder.active === false ? ' (pasif personel!)' : ''}` : a.has_holder ? 'Zimmetli (ayrıntı yetkiniz dışında)' : 'Zimmetsiz';
        const last = d.events[0];
        // header
        sections.push(E('div', {}, E('h1', { 'data-testid': 'ap-title' }, a.name ?? 'BİLİNMİYOR'), E('div', { class: 'ap-code', 'data-testid': 'ap-code' }, `${a.code} · ${CLASS_TR[a.class].full}${a.subcategory ? ` · ${a.subcategory}` : ''}`), E('div', { class: 'ap-top' }, E('span', { class: 'ap-badge', 'data-tone': tone, 'data-testid': 'ap-status' }, badgeText), E('span', {}, `Zimmet: ${holderText}`), E('span', {}, `Son olay: ${last ? `${EVENT_TR[last.type] ?? last.type} (${dateTr(last.at) ?? '—'})` : 'BİLİNMİYOR'}`)), ...(a.review_required ? [E('div', { class: 'ap-msg', 'data-kind': 'info', 'data-testid': 'ap-review' }, `Sınıf doğrulanmalı: ${a.review_note ?? 'otomatik atandı, yönetici onaylamalı.'}`)] : []), ...(a.holder_inactive ? [E('div', { class: 'ap-msg', 'data-kind': 'error', 'data-testid': 'ap-holder-inactive' }, 'Zimmet sahibi pasif personel. Zimmet otomatik devredilmez; yönetici gerekçeyle kapatmalı veya yeni talep açılmalı.')] : [])));
        // identity
        sections.push(E('section', { class: 'ap-sec', 'data-testid': 'ap-identity' }, E('h2', {}, 'Kimlik ve teknik bilgi'), dl([['Varlık kodu', a.code], ['Sınıf', CLASS_TR[a.class].full], ['Alt kategori', a.subcategory], ['Marka / model', a.brand_model], ['Üretici', a.manufacturer], ['Seri no', a.serial_no, 'ap-serial'],
            ['Edinim tarihi', dateTr(a.acquired_on)], ['Devreye alma', dateTr(a.commissioned_on)], ['Kayıt kaynağı', a.source_type === 'MACHINE' ? `Makine kaydı (${a.machine_code ?? '—'})` : 'Doğrudan varlık kaydı']]), ...(a.source_type === 'MACHINE' && a.source_id ? [E('p', {}, E('a', { class: 'ap-btn sec', href: `#/kart?t=MACHINE&id=${a.source_id}`, 'data-testid': 'ap-machine-link' }, 'Makine pasaportunu aç (teknik/OEE/bakım ayrıntısı orada)'))] : [])));
        // location & responsibility
        const locBox = E('div', {});
        sections.push(E('section', { class: 'ap-sec', 'data-testid': 'ap-location' }, E('h2', {}, 'Konum ve sorumluluk'), dl([['Fiziksel konum', a.location], ['Bağlı birim', deptTr(a.department)], ['Sorumlu birim', a.responsible_unit], ['Zimmetli', holderText], ['Zimmet başlangıcı', dateTr(a.custody_since)], ['Son konum değişimi', dateTr(a.last_moved_at)]]), E('p', { class: 'mut' }, 'Konum değişimi zimmet devri değildir; zimmet yalnız iki taraflı onayla değişir.'), locBox));
        if (d.can.manage && a.lifecycle !== 'ARCHIVED') {
            const loc = E('input', { type: 'text', value: a.location ?? '', 'data-testid': 'ap-loc-input', maxlength: 120 });
            const dep = E('select', { 'data-testid': 'ap-loc-dept' }, E('option', { value: '' }, 'Birim yok / tanımsız'), ...DEPARTMENTS.map((x) => E('option', { value: x.code, selected: x.code === a.department }, x.tr)));
            const unit = E('input', { type: 'text', value: a.responsible_unit ?? '', 'data-testid': 'ap-loc-unit', maxlength: 120 });
            const why = E('input', { type: 'text', placeholder: 'Gerekçe (zorunlu)', 'data-testid': 'ap-loc-reason', maxlength: 200 });
            locBox.append(E('div', { class: 'ap-row' }, E('label', {}, 'Konum', loc), E('label', {}, 'Birim', dep), E('label', {}, 'Sorumlu birim', unit), E('label', {}, 'Gerekçe', why), E('button', { type: 'button', class: 'ap-btn', 'data-testid': 'ap-loc-save', onClick: () => void run(() => deps.api.setLocation(id, loc.value.trim(), dep.value || null, unit.value.trim(), why.value.trim()), 'Konum kaydedildi.') }, 'Konumu kaydet')));
        }
        // custody + transfer
        const custody = E('section', { class: 'ap-sec', 'data-testid': 'ap-custody' }, E('h2', {}, 'Zimmet ve teslim talepleri'));
        const pend = d.transfers.filter((t) => t.status === 'PENDING');
        for (const t of d.transfers) {
            const reason = E('input', { type: 'text', placeholder: 'Gerekçe', maxlength: 200, 'aria-label': 'Gerekçe', 'data-testid': `ap-tr-reason-${t.id}` });
            const acts = [];
            if (t.status === 'PENDING' && t.i_am_receiver)
                acts.push(E('button', { type: 'button', class: 'ap-btn', 'data-testid': `ap-tr-accept-${t.id}`, onClick: () => void runT(() => deps.api.accept(t.id)) }, 'Teslim aldım (kabul)'), reason, E('button', { type: 'button', class: 'ap-btn sec', 'data-testid': `ap-tr-reject-${t.id}`, onClick: () => void runT(() => deps.api.reject(t.id, reason.value.trim())) }, 'Reddet'));
            else if (t.status === 'PENDING' && (t.i_am_requester || d.can.manage))
                acts.push(reason, E('button', { type: 'button', class: 'ap-btn sec', 'data-testid': `ap-tr-cancel-${t.id}`, onClick: () => void runT(() => deps.api.cancel(t.id, reason.value.trim() || 'İptal edildi')) }, 'Talebi iptal et'));
            custody.append(E('div', { class: 'ap-row', 'data-testid': 'ap-tr', 'data-status': t.status }, E('div', { style: 'flex:1 1 280px' }, E('b', {}, `${KIND_TR[t.kind]}: ${t.from ?? 'zimmetsiz'} → ${t.to ?? '—'}`), E('div', { class: 'mut' }, `${TRANSFER_STATUS_TR[t.status] ?? t.status} · açan ${t.requested_by ?? 'BİLİNMİYOR'} · ${dateTr(t.requested_at) ?? ''}${t.status === 'PENDING' ? ` · son tarih ${dateTr(t.expires_at) ?? ''}` : ''}${t.decided_by ? ` · karar: ${t.decided_by}` : ''}${t.decision_note ? ` · ${t.decision_note}` : ''}`)), ...acts));
        }
        if (!d.transfers.length)
            custody.append(E('p', { class: 'mut', 'data-testid': 'ap-no-transfers' }, 'Bu varlık için görünür zimmet talebi yok.'));
        if (d.can.request_transfer && a.lifecycle !== 'ARCHIVED' && !pend.length) {
            const form = E('div', { 'data-testid': 'ap-transfer-form' });
            custody.append(form);
            const open = E('button', { type: 'button', class: 'ap-btn', 'data-testid': 'ap-transfer-open', onClick: () => void openForm() }, a.has_holder ? 'Zimmet devri / iade talebi aç' : 'İlk zimmet talebi aç');
            custody.append(open);
            const openForm = async () => {
                let targets = [];
                try {
                    targets = await deps.api.targets();
                }
                catch (e) {
                    say('error', errorText(e));
                    paintMsg();
                    return;
                }
                const kind = E('select', { 'data-testid': 'ap-tf-kind' }, ...(a.has_holder ? [['TRANSFER', 'Devir'], ['RETURN', 'İade (zimmetsiz yap / birime)'], ['SERVICE_HANDOVER', 'Bakıma teslim'], ['SERVICE_RETURN', 'Bakımdan iade']] : [['ASSIGN', 'İlk zimmet']]).map(([v, t]) => E('option', { value: v }, t)));
                const person = E('select', { 'data-testid': 'ap-tf-person' }, E('option', { value: '' }, 'Kişi seç…'), ...targets.map((t) => E('option', { value: t.id, disabled: !t.can_receive }, `${t.name} (${deptTr(t.department) ?? t.department})${t.can_receive ? '' : ' — giriş hesabı yok, alıcı olamaz'}`)));
                const dept = E('select', { 'data-testid': 'ap-tf-dept' }, E('option', { value: '' }, 'veya birim…'), ...DEPARTMENTS.map((x) => E('option', { value: x.code }, x.tr)));
                const note = E('input', { type: 'text', placeholder: 'Not', maxlength: 200, 'data-testid': 'ap-tf-note' });
                const rid = crypto.randomUUID();
                form.replaceChildren(E('div', { class: 'ap-row' }, E('label', {}, 'Tür', kind), E('label', {}, 'Alıcı kişi', person), E('label', {}, 'Alıcı birim', dept), E('label', {}, 'Not', note), E('button', { type: 'button', class: 'ap-btn', 'data-testid': 'ap-tf-send', onClick: () => void run(async () => {
                        if (!person.value && !dept.value)
                            throw new Error('Alıcı kişi veya birim seçin.');
                        if (person.value && dept.value)
                            throw new Error('Yalnız birini seçin: kişi veya birim.');
                        await deps.api.transferCreate(id, kind.value, person.value || null, dept.value || null, note.value.trim(), rid);
                    }, 'Talep açıldı. Alıcı kendi hesabıyla kabul edene kadar zimmet değişmez.') }, 'Talep gönder')), E('p', { class: 'mut' }, 'Alıcı teslimi kendi girişiyle kabul eder. Yönetici bile alıcı adına kabul veremez.'));
                open.remove();
            };
        }
        if (d.can.manage && a.has_holder) {
            const why = E('input', { type: 'text', placeholder: 'Zimmet kapatma gerekçesi (zorunlu)', maxlength: 200, 'data-testid': 'ap-release-reason' });
            custody.append(E('div', { class: 'ap-row' }, E('label', {}, 'Yönetici zimmet kapatma (alıcısız; denetim kaydıyla)', why), E('button', { type: 'button', class: 'ap-btn sec', 'data-testid': 'ap-release', onClick: () => void run(() => deps.api.release(id, why.value.trim()), 'Zimmet kapatıldı; varlık zimmetsiz.') }, 'Zimmeti kapat')));
        }
        sections.push(custody);
        // machine / maintenance / calibration relations
        const rel = [];
        if (a.source_type === 'MACHINE') {
            rel.push(['Makine kayıtlı durumu', a.ops_state ? OPS_TR[a.ops_state] ?? a.ops_state : null], ['Açık bakım/arıza kaydı', String(a.open_tickets)]);
        }
        rel.push(['Kalibrasyon', a.calibration ? calibrationText(a.calibration) : a.class === 'MEASUREMENT_QUALITY' ? 'BİLİNMİYOR — bu ölçüm varlığı için sertifika kaydı yok' : 'Bu sınıf için kalibrasyon izlenmez']);
        sections.push(E('section', { class: 'ap-sec', 'data-testid': 'ap-relations' }, E('h2', {}, 'Bakım, kalibrasyon ve belgeler'), dl(rel.map(([k, v]) => [k, v ?? undefined])), E('p', { class: 'mut', 'data-testid': 'ap-docs-note' }, a.source_type === 'MACHINE' ? 'Belgeler, bakım ve iş emri geçmişi makine pasaportunda tutulur; burada kopyalanmaz.' : 'Bu kayıt için belge/fotoğraf yükleme bu sürümde yok (kısmi). Belgesi olan varlıklar makine kaydı üzerinden izlenir.')));
        // lifecycle
        if (d.can.manage) {
            const next = [['ACTIVE', 'Aktif yap'], ['INACTIVE', 'Pasife al'], ['OUT_OF_SERVICE', 'Hizmet dışı bırak'], ['ARCHIVED', 'Arşivle (kimlik ve geçmiş kalır)']].filter(([s]) => s !== a.lifecycle);
            const why = E('input', { type: 'text', placeholder: 'Gerekçe (zorunlu)', maxlength: 200, 'data-testid': 'ap-life-reason' });
            sections.push(E('section', { class: 'ap-sec', 'data-testid': 'ap-lifecycle' }, E('h2', {}, 'Yaşam döngüsü'), E('p', { class: 'mut' }, 'Varlık silinmez. Makine kaydının bakım/arıza durumu buradan değiştirilmez; o akış makine pasaportundadır.'), E('div', { class: 'ap-row' }, E('label', {}, 'Gerekçe', why), ...next.map(([s, t]) => E('button', { type: 'button', class: 'ap-btn sec', 'data-testid': `ap-life-${s}`, onClick: () => void run(() => deps.api.setStatus(id, s, why.value.trim()), 'Durum kaydedildi.') }, t)))));
        }
        // QR
        const qrBox = E('div', { class: 'ap-qr-img', 'data-testid': 'ap-qr' });
        qrBox.innerHTML = qrToSvg(encodeQr(d.qr.payload, 'M'), 40);
        sections.push(E('section', { class: 'ap-sec', 'data-testid': 'ap-qr-sec' }, E('h2', {}, 'QR kimliği'), E('div', { class: 'ap-qr' }, qrBox, E('div', {}, E('div', {}, `Etiket kodu: ${d.qr.label_code ?? 'henüz basılmadı'}`), E('div', { class: 'mut', 'data-testid': 'ap-qr-payload' }, d.qr.payload), E('p', { class: 'mut' }, 'QR yalnız sabit kimlik taşır; okutunca oturum ve yetki kontrol edilir.'), ...(deps.canLabel ? [E('a', { class: 'ap-btn sec', href: `#/etiket?tip=ASSET&id=${a.id}&baslik=${encodeURIComponent(a.name ?? a.code)}`, 'data-testid': 'ap-label-link' }, 'Etiket bas')] : [])))));
        // history
        sections.push(E('section', { class: 'ap-sec', 'data-testid': 'ap-history' }, E('h2', {}, 'Hareket ve denetim geçmişi'), d.events.length ? E('ul', { class: 'ap-ev' }, ...d.events.map((ev) => E('li', { 'data-testid': 'ap-event', 'data-type': ev.type }, E('b', {}, EVENT_TR[ev.type] ?? ev.type), E('small', {}, `${dateTr(ev.at) ?? ''} · ${ev.actor ?? 'sistem'}${ev.reason ? ` · ${ev.reason}` : ''}`)))) : E('p', { class: 'mut' }, 'Görünür olay yok.')));
        body.replaceChildren(...sections);
    };
    const paintMsg = () => { msg.replaceChildren(...(flash ? [E('div', { class: 'ap-msg', 'data-kind': flash.kind, 'data-testid': 'ap-message', role: flash.kind === 'error' ? 'alert' : 'status' }, flash.text)] : [])); };
    async function run(fn, ok) { try {
        await fn();
        say('ok', ok);
    }
    catch (e) {
        say('error', e.message && !/[A-Z_]{6,}/.test(e.message) ? e.message : errorText(e));
    } await load(); }
    async function runT(fn) { try {
        const r = transferResultText(await fn());
        say(r.kind, r.text);
    }
    catch (e) {
        say('error', errorText(e));
    } await load(); }
    await load();
}
