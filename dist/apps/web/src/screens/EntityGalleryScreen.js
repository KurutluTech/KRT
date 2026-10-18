// KMI-CARD-COMPLETION-001 — card gallery for registered entities (machines, personnel, products, customers).
// DEFAULT view of the screen is the card grid; every card is one link to the passport / workspace. A state filter only narrows the view — the
// full count and "all" are always one click away, and a machine is NEVER dropped because of its status (BAKIMDA, ARIZA, BEKLETME…).
import { h, mount } from '../../../../packages/ui/src/h.js';
import { machineState, HEADLINE_TR, MACHINE_CLASS_TR } from '../../../../packages/domain/src/machineState.js';
import { ENTITY_CARD_CSS, dateTr, entityCard, initialsOf, photoSlot } from '../cardKit.js';
import { MACHINE_CARD_CSS, machineIdentityCard, sinceText } from '../machineCard.js';
import { errorText } from '../errorText.js';
import { DEPT_TR, ROLE_TR } from '../ds.js';
const TITLE = { SUPPLIER: ['Tedarikçi kartları', 'Her kart tedarikçinin dijital kartına açılır (yalnız satınalma / muhasebe / yönetim).'], TOOL: ['Takım kartları', 'Her kart takımın pasaportuna ve hareket geçmişine açılır. Kayıtlar elle girilendir; LockCell bağlı değildir.'],
    MEASUREMENT: ['Ölçüm ekipmanı', 'Kayıtlı ölçüm cihazları. Kalibrasyon tarihi yalnız yüklenmiş sertifikadan okunur; sertifika yoksa “VERİ YOK” yazar.'], MACHINE: ['Makineler', 'Kayıtlı tüm makine ve ekipman — durum kartı gizlemez.'], PERSONNEL: ['Personel kartları', 'Her kart personelin dijital pasaportuna açılır.'],
    PRODUCT: ['Ürün kartları', 'Her kart ürün çalışma alanına açılır (çizim, CAD/CAM, takım, BOM, rota, kalite planı).'], CUSTOMER: ['Müşteri kartları', 'Her kart müşterinin dijital kartına açılır.'] };
const REV_TR = { DRAFT: 'Taslak', SUBMITTED: 'Onayda', APPROVED: 'Onaylı', RELEASED: 'Yayında', SUPERSEDED: 'Geçersiz', OBSOLETE: 'Geçersiz', NO_REVISION: 'Revizyon yok' };
const faceVal = (f, code) => f.face.find((x) => x.code === code)?.value ?? null;
const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
/** The data client camelizes every RPC key (machine_class → machineClass); the card code reads the server's snake_case names, so both spellings are made available once, here. */
const withSnake = (o) => { const out = { ...o }; for (const [k, v] of Object.entries(o))
    out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v; return out; };
const norm = (s) => s.toLocaleLowerCase('tr-TR');
export async function renderEntityGalleryScreen(container, deps, opts) {
    const { kind } = opts;
    const [title, sub] = TITLE[kind];
    const dataKind = kind === 'MEASUREMENT' ? 'MACHINE' : kind;
    const root = h('div', { class: 'kx eg', 'data-testid': 'eg-root', 'data-kind': kind }, h('style', {}, ENTITY_CARD_CSS + MACHINE_CARD_CSS), h('h1', { class: 'eg-h1' }, title), h('p', { class: 'eg-note' }, 'Yükleniyor…'));
    mount(container, root);
    let faces;
    let board = null;
    try {
        faces = (await deps.faces(dataKind)).map((f) => ({ ...f, extra: withSnake(f.extra ?? {}) }));
        if (kind === 'MEASUREMENT')
            faces = faces.filter((f) => f.extra.machine_class === 'MEASUREMENT');
    }
    catch (e) {
        const denied = /FORBIDDEN|42501|403/.test(String(e instanceof Error ? e.message : e));
        const msg = denied && kind === 'CUSTOMER' ? 'Müşteri kartlarını görme yetkiniz yok. Müşteri yönetimi veya müşteri iletişim görüntüleme yetkisi gerekir; gerekliyse sistem sahibine başvurun.' : denied && kind === 'SUPPLIER' ? 'Tedarikçi kartlarını görme yetkiniz yok. Satınalma, muhasebe veya yönetim yetkisi gerekir.' : errorText(e);
        mount(container, h('div', { class: 'kx eg', 'data-testid': 'eg-root', 'data-kind': kind }, h('h1', { class: 'eg-h1' }, title), h('div', { class: denied ? 'banner' : 'banner bad', role: 'alert', 'data-testid': 'eg-error', 'data-denied': String(denied) }, msg)));
        return;
    }
    if (kind === 'MACHINE' && deps.board) {
        try {
            board = await deps.board();
        }
        catch {
            board = null;
        }
    }
    const nowIso = board?.generatedAt ?? new Date().toISOString();
    const hrefOf = (f) => (kind === 'PRODUCT' ? `#/urun-calisma?urun=${f.id}` : `#/pasaport-calisma?tur=${dataKind}&id=${f.id}`);
    const build = (f) => {
        const x = f.extra;
        let node;
        let slot = null;
        let fill = null;
        let stateKey = f.state;
        if (kind === 'MACHINE') {
            const live = board?.machines.find((m) => m.code === f.code);
            const ms = machineState({ status: f.state, active: live?.active ?? [] });
            stateKey = ms.headline;
            const a = live?.active[0];
            const cls = str(x.machine_class) && x.machine_class in MACHINE_CLASS_TR ? MACHINE_CLASS_TR[x.machine_class] : null;
            const open = Number(x.open_tickets ?? 0);
            node = machineIdentityCard({ code: f.code ?? '—', name: f.title, classTr: cls, headline: ms.headline, size: 'compact', passportHref: hrefOf(f), testid: 'eg-card', fresh: !!board,
                sinceLabel: sinceText(str(x.down_since) ?? live?.since ?? null, nowIso) ? `${sinceText(str(x.down_since) ?? live?.since ?? null, nowIso)} süredir` : null,
                conflictNote: ms.conflict ? 'Kayıt: kullanılamaz — ama aktif iş emri var' : null, shift: board?.shift ?? null,
                wo: a ? { no: a.wo, product: a.productCode, operator: a.operator, planned: null, produced: null, scrap: null } : null, woCount: live?.active.length ?? 0,
                alert: open > 0 ? `${open} açık bakım / arıza kaydı` : null });
            fill = (src) => { const ico = node.querySelector('.mc-ico'); if (!ico)
                return; ico.replaceChildren(h('img', { src, alt: f.title, loading: 'lazy', style: 'width:100%;height:100%;object-fit:cover;border-radius:10px;display:block', 'data-testid': 'ec-photo-img' })); ico.setAttribute('data-has-photo', 'true'); };
            node.setAttribute('data-id', f.id);
            node.setAttribute('data-headline', ms.headline);
            node.setAttribute('data-registered-status', f.state);
        }
        else if (kind === 'PERSONNEL') {
            const ph = photoSlot(initialsOf(f.title), 'round');
            slot = ph;
            const skills = arr(x.skills);
            const roles = arr(x.roles);
            const facts = [{ label: 'BÖLÜM', value: str(x.department) ? DEPT_TR[x.department] ?? x.department : null }, { label: 'GÖREV / ROL', value: roles.length ? roles.map((r) => ROLE_TR[r] ?? r).join(', ') : null }, { label: 'VARDİYA', value: str(x.shift_code) },
                { label: 'YETKİNLİK', value: skills.length ? `${skills.length} kayıtlı` : null }];
            node = entityCard({ kind, id: f.id, href: hrefOf(f), title: f.title, subtitle: faceVal(f, 'JOB_TITLE'), code: f.code, initials: initialsOf(f.title), shape: 'round', badge: f.active ? { text: 'AKTİF', tone: 'ok' } : { text: 'PASİF', tone: 'mut' },
                facts, chips: skills.slice(0, 3), updated: dateTr(x.updated_at), testid: 'eg-card' }, ph);
        }
        else if (kind === 'PRODUCT') {
            const ph = photoSlot(initialsOf(f.code ?? f.title), 'square');
            slot = ph;
            const rev = str(x.revision);
            const missing = [];
            if (!str(x.family_code))
                missing.push('aile');
            if (!str(x.material))
                missing.push('malzeme');
            if (f.state === 'NO_REVISION')
                missing.push('revizyon');
            const released = f.state === 'RELEASED' || f.state === 'APPROVED';
            node = entityCard({ kind, id: f.id, href: hrefOf(f), title: f.title, subtitle: str(x.customer_part_no) ? `Müşteri parça no: ${x.customer_part_no}` : null, code: f.code, initials: initialsOf(f.code ?? f.title), shape: 'square',
                badge: { text: (REV_TR[f.state] ?? f.state).toLocaleUpperCase('tr-TR'), tone: released ? 'ok' : f.state === 'NO_REVISION' ? 'bad' : 'warn' },
                facts: [{ label: 'REVİZYON', value: rev ? `Rev ${rev}` : null }, { label: 'AİLE', value: str(x.family_code) }, { label: 'MALZEME', value: str(x.material) }, { label: 'REVİZYON SAYISI', value: Number(x.revisions ?? 0) }],
                alert: !released ? `Üretime serbest değil (${REV_TR[f.state] ?? f.state})${missing.length ? ` · eksik: ${missing.join(', ')}` : ''}` : missing.length ? `Eksik: ${missing.join(', ')}` : null,
                updated: dateTr(x.created_at), action: 'Çalışma alanını aç →', testid: 'eg-card' }, ph);
        }
        else if (kind === 'MEASUREMENT') {
            const ph = photoSlot(initialsOf(f.code ?? f.title), 'square');
            slot = ph;
            const until = str(x.calibration_valid_until);
            const docs = Number(x.calibration_docs ?? 0);
            const days = until ? Math.floor((Date.parse(until) - Date.parse(nowIso.slice(0, 10))) / 86400000) : null;
            const cal = docs === 0 ? { k: 'NO_CERT', t: 'KALİBRASYON VERİ YOK', tone: 'warn' } : days === null ? { k: 'NO_DATE', t: 'GEÇERLİLİK TARİHİ YOK', tone: 'warn' }
                : days < 0 ? { k: 'EXPIRED', t: 'SÜRESİ GEÇMİŞ', tone: 'bad' } : days <= 30 ? { k: 'SOON', t: `${days} GÜN KALDI`, tone: 'warn' } : { k: 'VALID', t: 'KALİBRASYON GEÇERLİ', tone: 'ok' };
            stateKey = cal.k;
            node = entityCard({ kind: 'MACHINE', id: f.id, href: hrefOf(f), title: f.title, subtitle: 'Ölçüm ekipmanı', code: f.code, initials: initialsOf(f.code ?? f.title), shape: 'square', badge: { text: cal.t, tone: cal.tone },
                facts: [{ label: 'KAYITLI DURUM', value: f.state }, { label: 'KALİBRASYON GEÇERLİLİK', value: until ? dateTr(until) : null }, { label: 'SERTİFİKA', value: docs }],
                alert: docs === 0 ? 'Yüklenmiş kalibrasyon sertifikası yok — geçerlilik doğrulanamaz' : null, testid: 'eg-card' }, ph);
        }
        else if (kind === 'SUPPLIER') {
            const ph = photoSlot(initialsOf(f.title), 'square');
            slot = ph;
            node = entityCard({ kind, id: f.id, href: hrefOf(f), title: f.title, subtitle: faceVal(f, 'LEGAL_NAME'), code: f.code, initials: initialsOf(f.title), shape: 'square', badge: f.active ? { text: 'AKTİF', tone: 'ok' } : { text: 'PASİF', tone: 'mut' },
                facts: [{ label: 'ÜLKE', value: faceVal(f, 'COUNTRY') }, { label: 'TEDARİK', value: faceVal(f, 'SUPPLIES') }, { label: 'İLETİŞİM', value: x.has_contact ? 'Kayıtlı' : null }, { label: 'SERTİFİKA', value: faceVal(f, 'CERTIFICATIONS') }],
                updated: dateTr(x.created_at), testid: 'eg-card' }, ph);
        }
        else if (kind === 'TOOL') {
            const ph = photoSlot(initialsOf(f.code ?? f.title), 'square');
            slot = ph;
            const LOC = { CABINET: 'Takım dolabı', MOUNTED: 'Makinede', ISSUED: 'Zimmetli', SCRAP: 'Hurda' };
            const used = Number(x.life_used ?? 0), rated = Number(x.life_rated ?? 0);
            const worn = rated > 0 && used >= rated * 0.9;
            stateKey = f.state;
            node = entityCard({ kind, id: f.id, href: hrefOf(f), title: f.title, subtitle: faceVal(f, 'MANUFACTURER'), code: f.code, initials: initialsOf(f.code ?? f.title), shape: 'square',
                badge: { text: (LOC[f.state] ?? f.state).toLocaleUpperCase('tr-TR'), tone: f.state === 'SCRAP' ? 'bad' : f.state === 'CABINET' ? 'mut' : 'info' },
                facts: [{ label: 'ÇAP', value: faceVal(f, 'DIAMETER') ? `${faceVal(f, 'DIAMETER')} mm` : null }, { label: 'MAKİNE', value: str(x.machine_code) }, { label: 'ZİMMET', value: str(x.issued_to) }, { label: 'ÖMÜR (dk)', value: rated > 0 ? `${used} / ${rated}` : null }],
                alert: worn ? 'Ömrün %90’ı veya fazlası kullanıldı' : null, updated: dateTr(x.last_moved_at ?? x.updated_at), testid: 'eg-card' }, ph);
        }
        else {
            const ph = photoSlot(initialsOf(f.title), 'square');
            slot = ph;
            node = entityCard({ kind: 'CUSTOMER', id: f.id, href: hrefOf(f), title: f.title, subtitle: str(x.country), code: f.code, initials: initialsOf(f.title), shape: 'square', badge: f.active ? { text: 'AKTİF', tone: 'ok' } : { text: 'PASİF', tone: 'mut' },
                facts: [{ label: 'ÜLKE', value: str(x.country) }, ...f.face.slice(0, 3).map((a) => ({ label: a.label.toLocaleUpperCase('tr-TR'), value: a.value }))], testid: 'eg-card' }, ph);
        }
        return { state: stateKey, built: { key: f.id, haystack: norm([f.code, f.title, ...f.face.map((a) => a.value)].filter(Boolean).join(' ')), node, fill: fill ?? (slot ? (src) => slot.fill(src, 'fotoğraf') : null), photo: f.photoVersionId, mime: f.photoMime } };
    };
    const rows = faces.map(build);
    const CAL_TR = { NO_CERT: 'Sertifika yok', NO_DATE: 'Tarih yok', EXPIRED: 'Süresi geçmiş', SOON: '30 gün içinde', VALID: 'Geçerli' };
    const LOCT = { CABINET: 'Takım dolabı', MOUNTED: 'Makinede', ISSUED: 'Zimmetli', SCRAP: 'Hurda' };
    const STATE_LABEL = (k) => (kind === 'MEASUREMENT' ? CAL_TR[k] ?? k : kind === 'TOOL' ? LOCT[k] ?? k : kind === 'MACHINE' ? HEADLINE_TR[k] ?? k : kind === 'PRODUCT' ? REV_TR[k] ?? k : k === 'ACTIVE' ? 'Aktif' : k === 'PASSIVE' ? 'Pasif' : k);
    const counts = new Map();
    rows.forEach((r) => counts.set(r.state, (counts.get(r.state) ?? 0) + 1));
    let filter = null;
    let q = '';
    const grid = h('div', { class: 'eg-grid', 'data-testid': 'eg-grid' });
    const count = h('div', { class: 'eg-note', 'data-testid': 'eg-count' });
    const chipRow = h('div', { class: 'eg-bar', 'data-testid': 'eg-filters' });
    const paint = () => {
        const shown = rows.filter((r) => (!filter || r.state === filter) && (!q || r.built.haystack.includes(q)));
        grid.replaceChildren(...(shown.length ? shown.map((r) => r.built.node) : [h('div', { class: 'eg-empty', 'data-testid': 'eg-empty' }, faces.length ? 'Bu süzgeçte kart yok. "Tümü"ne basın.' : 'Henüz kayıtlı kart yok.')]));
        count.textContent = `${shown.length} / ${rows.length} kart gösteriliyor${filter ? ` · süzgeç: ${STATE_LABEL(filter)}` : ' · süzgeç yok'}`;
        count.setAttribute('data-shown', String(shown.length));
        count.setAttribute('data-total', String(rows.length));
        chipRow.querySelectorAll('button.eg-chip').forEach((b) => b.setAttribute('aria-pressed', String((b.getAttribute('data-f') || null) === filter)));
    };
    const chip = (label, f, n) => h('button', { type: 'button', class: 'eg-chip', 'data-f': f ?? '', 'data-testid': `eg-filter-${f ?? 'ALL'}`, 'aria-pressed': 'false', onClick: () => { filter = f; paint(); } }, `${label} (${n})`);
    const search = h('input', { type: 'search', placeholder: 'Ara: kod, ad…', 'aria-label': 'Kart ara', 'data-testid': 'eg-search', onInput: (e) => { q = norm(e.target.value.trim()); paint(); } });
    chipRow.append(search, chip('Tümü', null, rows.length), ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => chip(STATE_LABEL(k), k, n)));
    mount(container, h('div', { class: 'kx eg', 'data-testid': 'eg-root', 'data-kind': kind }, h('style', {}, ENTITY_CARD_CSS + MACHINE_CARD_CSS), h('h1', { class: 'eg-h1' }, title), h('p', { class: 'eg-note' }, sub, opts.listHref ? [' ', h('a', { href: opts.listHref, 'data-testid': 'eg-list-link' }, opts.listLabel ?? 'Liste görünümü')] : null), chipRow, count, kind === 'MACHINE' ? h('p', { class: 'eg-note', 'data-testid': 'eg-physical-note' }, 'Durum kayıtlı (elle girilen) durumdur; CNC bağlantısı olmadığından fiziksel çalışma doğrulanmaz.') : null, grid));
    paint();
    // photos: after first paint, 4 at a time; a failure leaves the initials (never a broken image)
    const queue = rows.filter((r) => r.built.photo && r.built.fill);
    let next = 0;
    const worker = async () => { while (next < queue.length) {
        const r = queue[next++];
        try {
            const c = await deps.content(r.built.photo);
            r.built.fill(`data:${c.mimeType};base64,${c.contentBase64}`);
        }
        catch { /* keep initials */ }
    } };
    void Promise.all([worker(), worker(), worker(), worker()]);
}
