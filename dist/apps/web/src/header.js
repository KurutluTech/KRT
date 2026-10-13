// Global Header 2.0 — brand, KMI LIVE / PULSE entry points, compact search (⌘K / Ctrl+K), live Turkey-time clock with seconds,
// real person (name · department · role) and an avatar menu with ONLY the shortcuts this user may open.
// The clock is a DISPLAY clock (device time). It is never used as a record time: every seal/stamp comes from the server.
import { h } from '../../../packages/ui/src/h.js';
import { formatStamp } from '../../../packages/domain/src/temporal.js';
import { productionShiftAt } from '../../../packages/domain/src/homeLayout.js';
import { DEPT_TR, ROLE_TR, initials } from './ds.js';
/** Pure: the avatar-menu shortcuts = featured paths this user may open, capped, never including what they cannot open. */
export function pickShortcuts(candidates, canOpen, max = 6) {
    const seen = new Set();
    return candidates.filter((c) => c.path !== '/' && canOpen(c.path) && !seen.has(c.path) && (seen.add(c.path), true)).slice(0, max);
}
/** Pure: "Ad Soyad · Departman · Rol" line parts, Turkish labels, nothing invented when a part is unknown. */
export function identityLine(id) {
    const dept = id.department ? (DEPT_TR[id.department] ?? id.department) : '';
    const roles = (id.roles ?? []).map((r) => ROLE_TR[r] ?? r).join(', ');
    return [dept, roles].filter(Boolean).join(' · ');
}
export function createHeader(o) {
    const now = o.now ?? (() => new Date());
    const clock = h('time', { class: 'clock', 'data-testid': 'app-clock', title: 'Ekran saati (Türkiye). Kayıt damgaları sunucudan gelir.' });
    const shiftChip = h('span', { class: 'chip shift', 'data-testid': 'app-shift', title: 'Üretim vardiyası (tanımlı vardiya saatlerine göre; gece vardiyası tanımlı değildir)' });
    const tick = () => {
        clock.textContent = formatStamp(now().toISOString(), true);
        clock.setAttribute('datetime', now().toISOString());
        const sh = productionShiftAt(now().toISOString());
        shiftChip.textContent = sh ? sh.label : 'Vardiya tanımsız';
        shiftChip.setAttribute('data-shift', sh ? sh.code : 'NONE');
    };
    tick();
    const timer = setInterval(tick, 1000);
    const nameEl = h('b', { 'data-testid': 'app-user' }, o.initialName);
    const lineEl = h('small', { 'data-testid': 'app-user-line' }, '');
    const avatar = h('span', { class: 'av', 'aria-hidden': 'true' }, initials(o.initialName) || '·');
    const menuName = h('div', { class: 'mn' }, o.initialName);
    const menuLine = h('div', { class: 'ml' }, '');
    const shortcutsHost = h('div', { class: 'sc', 'data-testid': 'app-shortcuts' });
    const menu = h('div', { class: 'kmi-usermenu', role: 'menu', 'data-testid': 'app-usermenu', hidden: true }, menuName, menuLine, shortcutsHost, h('button', { type: 'button', class: 'out', role: 'menuitem', 'data-testid': 'app-usermenu-logout', onClick: o.onLogout }, 'Çıkış yap'));
    const toggle = (open) => {
        const next = open ?? menu.hidden;
        menu.hidden = !next;
        trigger.setAttribute('aria-expanded', String(next));
    };
    const trigger = h('button', { type: 'button', class: 'kmi-user-btn', 'data-testid': 'app-user-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Kullanıcı menüsü', onClick: () => toggle() }, avatar, h('span', { class: 'who' }, nameEl, lineEl));
    const wrap = h('div', { class: 'kmi-user' }, trigger, menu);
    const onDocClick = (e) => { if (!wrap.contains(e.target))
        toggle(false); };
    const onKey = (e) => {
        if (e.key === 'Escape' && !menu.hidden) {
            toggle(false);
            trigger.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            search.focus();
            search.select();
        }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    const search = h('input', { type: 'search', 'data-testid': 'app-search', 'aria-label': 'Ara', placeholder: 'Ara…  (Ctrl/⌘ K)', value: o.searchValue });
    const form = h('form', { 'data-testid': 'app-search-form', role: 'search', onSubmit: (e) => { e.preventDefault(); const v = search.value.trim(); if (v)
            location.hash = `#/ara?q=${encodeURIComponent(v)}`; } }, search);
    const el = h('header', { class: 'kmi-top' }, h('a', { class: 'brand', href: '#/', 'data-testid': 'app-home', title: o.brandTitle }, h('img', { src: './assets/kurutlu-k-symbol-white.png', alt: '' }), h('span', {}, 'KURUTLU', h('small', {}, 'PERFORMANCE CENTER'))), h('span', { class: 'kmi-chips', 'data-testid': 'app-header-chips' }), form, shiftChip, clock, o.menuBtn, wrap, h('button', { type: 'button', class: 'btn', 'data-testid': 'app-logout', 'aria-label': 'Çıkış', onClick: o.onLogout }, 'Çıkış'));
    return {
        el,
        setChips(live, pulse) {
            const host = el.querySelector('[data-testid="app-header-chips"]');
            host.replaceChildren(...(live ? [h('a', { class: 'chip live', href: '#/canli', 'data-testid': 'app-live-link' }, h('i', {}), 'KMI LIVE')] : []), ...(pulse ? [h('a', { class: 'chip pulse', href: '#/komuta', 'data-testid': 'app-pulse-link' }, 'Performans')] : []));
        },
        setIdentity(id) {
            const name = id.name || o.initialName;
            nameEl.textContent = name;
            menuName.textContent = name;
            avatar.textContent = initials(name) || '·';
            const line = identityLine(id);
            lineEl.textContent = line;
            menuLine.textContent = line;
        },
        setShortcuts(items) {
            shortcutsHost.replaceChildren(...items.map((s) => h('a', { href: `#${s.path}`, role: 'menuitem', 'data-testid': 'app-shortcut', onClick: () => toggle(false) }, s.label)));
            shortcutsHost.hidden = items.length === 0;
        },
        dispose() { clearInterval(timer); document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey); },
    };
}
