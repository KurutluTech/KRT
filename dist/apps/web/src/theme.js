// KMI — visual identity (restored from the old KMI: dark slate palette #0b1220/#0f172a/#334155, cyan accent, gold #b88718, spinning K
// watermark `kurutluKSpin` 34 s, collapsible 260/64 px sidebar). Presentation only: nothing here grants or hides a permission.
// The "reconcile" block at the end maps the light inline colours that older screens were written with onto this palette, so every screen
// stays readable on the dark surface without rewriting each one.
import { SEMANTIC, BRAND, SURFACES, TEXT, SEMANTIC_LIGHT, BRAND_LIGHT, SURFACES_LIGHT, TEXT_LIGHT } from '../../../packages/domain/src/semanticColors.js';
export const THEME_CSS = `
:root{--kmi-bg:${SURFACES.bg};--kmi-bg2:${SURFACES.bg2};--kmi-panel:${SURFACES.panel};--kmi-panel2:${SURFACES.panel2};--kmi-line:${SURFACES.line};--kmi-line2:${SURFACES.line2};--kmi-text:${TEXT.primary};--kmi-text2:${TEXT.secondary};--kmi-mut:${TEXT.muted};--kmi-cyan:${BRAND.accent};--kmi-cyan2:${BRAND.link};--kmi-focus:${BRAND.focus};--kmi-brand:${BRAND.accent};--kmi-gold:#8fa3c8;--kmi-gold2:#c3cfe6;--kmi-blue:#2f5fd0;--kmi-side-w:260px
;--kmi-ok:${SEMANTIC.ok.fg};--kmi-ok-soft:${SEMANTIC.ok.soft};--kmi-bad:${SEMANTIC.bad.fg};--kmi-bad-soft:${SEMANTIC.bad.soft};--kmi-warn:${SEMANTIC.warn.fg};--kmi-warn-soft:${SEMANTIC.warn.soft};--kmi-info:${SEMANTIC.info.fg};--kmi-info-soft:${SEMANTIC.info.soft};--kmi-hold:${SEMANTIC.hold.fg};--kmi-hold-soft:${SEMANTIC.hold.soft};--kmi-unknown:${SEMANTIC.unknown.fg};--kmi-unknown-soft:${SEMANTIC.unknown.soft};--kmi-stale:${SEMANTIC.stale.fg};--kmi-stale-soft:${SEMANTIC.stale.soft}}
:root[data-kmi-theme="light"]{color-scheme:light;--kmi-bg:${SURFACES_LIGHT.bg};--kmi-bg2:${SURFACES_LIGHT.bg2};--kmi-panel:${SURFACES_LIGHT.panel};--kmi-panel2:${SURFACES_LIGHT.panel2};--kmi-line:${SURFACES_LIGHT.line};--kmi-line2:${SURFACES_LIGHT.line2};--kmi-text:${TEXT_LIGHT.primary};--kmi-text2:${TEXT_LIGHT.secondary};--kmi-mut:${TEXT_LIGHT.muted};--kmi-cyan:${BRAND_LIGHT.accent};--kmi-cyan2:${BRAND_LIGHT.link};--kmi-focus:${BRAND_LIGHT.focus};--kmi-brand:${BRAND_LIGHT.accent}
;--kmi-ok:${SEMANTIC_LIGHT.ok.fg};--kmi-ok-soft:${SEMANTIC_LIGHT.ok.soft};--kmi-bad:${SEMANTIC_LIGHT.bad.fg};--kmi-bad-soft:${SEMANTIC_LIGHT.bad.soft};--kmi-warn:${SEMANTIC_LIGHT.warn.fg};--kmi-warn-soft:${SEMANTIC_LIGHT.warn.soft};--kmi-info:${SEMANTIC_LIGHT.info.fg};--kmi-info-soft:${SEMANTIC_LIGHT.info.soft};--kmi-hold:${SEMANTIC_LIGHT.hold.fg};--kmi-hold-soft:${SEMANTIC_LIGHT.hold.soft};--kmi-unknown:${SEMANTIC_LIGHT.unknown.fg};--kmi-unknown-soft:${SEMANTIC_LIGHT.unknown.soft};--kmi-stale:${SEMANTIC_LIGHT.stale.fg};--kmi-stale-soft:${SEMANTIC_LIGHT.stale.soft}}
*{box-sizing:border-box}
html{color-scheme:dark}
body{margin:0;background:var(--kmi-bg);color:var(--kmi-text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
a{color:var(--kmi-cyan2)}
:focus-visible{outline:3px solid var(--kmi-focus);outline-offset:2px}
.kmi-skip{position:absolute;left:-999px;top:0;background:var(--kmi-cyan);color:#06202a;padding:10px 14px;font-weight:800;z-index:100;border-radius:0 0 10px 0}
.kmi-skip:focus{left:0}
.ic{display:inline-flex;align-items:center;justify-content:center;flex:none}
/* ---------- login (old KMI: spinning K watermark, 34 s, brand title) ---------- */
.kmi-login{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(8px,2.4vh,22px);padding:16px;background:radial-gradient(ellipse at 50% 18%,rgba(56,189,248,.14),transparent 46%),radial-gradient(circle at 85% 100%,rgba(30,64,175,.22),transparent 48%),linear-gradient(180deg,#071122,#050b17);overflow:auto}
/* KMI signature K (R2): a large brushed-metal K that is part of the BACKGROUND, behind the card. It turns slowly and continuously about its vertical axis (transform-only animation = compositor work, no repaint, no JS). Decorative (aria-hidden), clipped to its own fixed layer so it can never overflow the page, never takes pointer events and is dimmed so the form stays readable. */
.kmi-login-bg{position:fixed;inset:0;z-index:0;overflow:hidden;display:grid;place-items:center;pointer-events:none;contain:strict}
.kmi-login-k{position:relative;flex:none;height:clamp(300px,min(88vh,150vw),900px);aspect-ratio:600/761;perspective:1400px;pointer-events:none;opacity:.34;filter:drop-shadow(0 10px 40px rgba(56,189,248,.18))}
.kmi-login-k .kbody{position:absolute;inset:0;-webkit-mask:url(./assets/kurutlu-k-symbol-white.png) center/contain no-repeat;mask:url(./assets/kurutlu-k-symbol-white.png) center/contain no-repeat;background:linear-gradient(128deg,#ffffff 0%,#d5dde8 20%,#8693a6 42%,#f6f9fc 58%,#a3afc0 78%,#e9eff6 100%);transform-style:preserve-3d;will-change:transform;animation:kmiKSpin 36s linear infinite}
@keyframes kmiKSpin{from{transform:rotateY(0deg)}to{transform:rotateY(360deg)}}
@media (prefers-reduced-motion:reduce){.kmi-login-k .kbody{animation:none;transform:rotateY(-14deg)}}
.kmi-login[data-lowpower] .kmi-login-k .kbody{animation:none;transform:rotateY(-14deg);will-change:auto}
.kmi-login > :not(.kmi-login-bg){position:relative;z-index:1}
.kmi-login-note{margin-top:12px;padding:10px;border-radius:8px;background:rgba(56,189,248,.10);border:1px solid rgba(56,189,248,.28);color:#bae6fd;font-size:14px}
.kmi-login-db{display:flex;align-items:center;gap:8px;margin:14px 0 0;padding:8px 10px;border-radius:10px;background:rgba(15,23,42,.8);border:1px solid var(--kmi-line2);font-size:12px;color:#cbd5e1}
.kmi-login-db i{width:10px;height:10px;border-radius:50%;background:#64748b;flex:none}
.kmi-login-db[data-state=ok]{border-color:#15803d;color:#bbf7d0}.kmi-login-db[data-state=ok] i{background:#22c55e;box-shadow:0 0 8px #22c55e}
.kmi-login-db[data-state=checking] i{background:#f59e0b}.kmi-login-db[data-state=fail]{border-color:#b91c1c;color:#fecaca}.kmi-login-db[data-state=fail] i{background:#ef4444}
.kmi-login-card{position:relative;z-index:1;width:100%;max-width:420px;background:rgba(12,22,42,.94);border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:28px 24px;box-shadow:0 20px 60px rgba(2,6,23,.6);backdrop-filter:blur(4px)}
.kmi-login-card .brand{text-align:center;margin-bottom:18px}
.kmi-login-card .brand img{height:52px;width:auto;filter:drop-shadow(0 0 6px rgba(184,135,24,.35))}
.kmi-login-card h1{margin:8px 0 2px;font-size:20px;letter-spacing:.04em;color:#fff;font-weight:800;line-height:1.25}
.kmi-login-card .sub{margin:0;font-size:12px;color:var(--kmi-mut)}
.kmi-login-card .rule{height:2px;width:56px;margin:12px auto 0;background:var(--kmi-gold);border-radius:2px}
.kmi-login-tabs{display:flex;gap:6px;margin:6px 0 4px}.kmi-login-card .kmi-login-tab{flex:1;min-height:44px;border-radius:10px;border:1px solid var(--kmi-line2);background:#0f172a;color:#cbd5e1;font-weight:700;font-size:13px;cursor:pointer;margin:0;width:auto}.kmi-login-card .kmi-login-tab.on{background:var(--kmi-blue,#1d4ed8);color:#fff;border-color:#3b82f6}.kmi-login-hint{font-size:12px;color:var(--kmi-mut);margin:10px 0 0}
.kmi-login-card label{display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin:12px 0 4px}
.kmi-login-card input{width:100%;min-height:48px;font-size:16px;border-radius:10px;border:1px solid var(--kmi-line2);background:#0f172a;color:#fff;padding:0 12px}
.kmi-login-card button{width:100%;min-height:48px;margin-top:16px;font-size:16px;border:0;border-radius:10px;background:var(--kmi-blue);color:#fff;font-weight:800;cursor:pointer}
.kmi-login-card button:hover{background:#2563eb}
.kmi-login-err{margin-top:12px;padding:10px;border-radius:8px;background:rgba(239,68,68,.16);color:#fecaca;font-size:14px}
/* ---------- shell ---------- */
.kmi-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--kmi-bg);border-bottom:1px solid rgba(148,163,184,.14);box-shadow:0 6px 18px rgba(2,6,23,.35)}
.kmi-top .brand{display:flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.04em;white-space:nowrap}
.kmi-top .brand img{height:30px;width:auto;filter:drop-shadow(0 0 6px rgba(184,135,24,.35))}
.kmi-top .brand .bt{display:flex;flex-direction:column;gap:2px;min-width:0;line-height:1.1}.kmi-top .brand .bt b{font-size:13px;font-weight:800;letter-spacing:.07em;color:#f8fafc}.kmi-top .brand small{display:block;font-size:10.5px;font-weight:600;letter-spacing:.1em;color:var(--kmi-cyan2);text-transform:none}.kmi-top .brand .bs{display:none;font-size:15px;font-weight:800;letter-spacing:.14em}.kmi-top .brand .bt{display:none}
.kmi-top form{flex:1 1 140px;display:flex;min-width:0}
.kmi-top input[type=search]{flex:1;min-width:0;min-height:40px;font-size:16px;border-radius:10px;border:1px solid var(--kmi-line2);background:#0f172a;color:#fff;padding:0 12px}
.kmi-top input[type=search]::placeholder{color:#64748b}
.kmi-top .kmi-chips{display:flex;gap:6px}.kmi-top .chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.08em;text-decoration:none;border:1px solid var(--kmi-line2);color:#e2e8f0;background:#0f172a}
.kmi-top .chip.live{color:#bbf7d0;border-color:#166534}.kmi-top .chip.live i{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e}.kmi-top .chip.pulse{color:#fecaca;border-color:#7f1d1d}
.kmi-top .clock{font-variant-numeric:tabular-nums;font-size:12px;color:var(--kmi-cyan2);white-space:nowrap;font-weight:700}
.kmi-user{position:relative}.kmi-user-btn{display:flex;align-items:center;gap:8px;min-height:40px;border:1px solid var(--kmi-line2);background:#1e293b;color:#e2e8f0;border-radius:10px;padding:0 8px;cursor:pointer;text-align:left}
.kmi-user-btn .av{width:28px;height:28px;border-radius:50%;background:#0f172a;border:1px solid #334155;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#67e8f9;flex:none}
.kmi-user-btn .who{display:flex;flex-direction:column;min-width:0;max-width:170px}.kmi-user-btn .who b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kmi-user-btn .who small{font-size:10px;color:var(--kmi-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kmi-usermenu{position:absolute;right:0;top:calc(100% + 6px);z-index:60;width:min(300px,86vw);background:#0b1220;border:1px solid var(--kmi-line2);border-radius:12px;padding:12px;box-shadow:0 18px 50px rgba(2,6,23,.7)}
.kmi-usermenu[hidden]{display:none}.kmi-usermenu .mn{font-weight:800;color:#fff}.kmi-usermenu .ml{font-size:12px;color:var(--kmi-mut);margin-bottom:8px}
.kmi-usermenu .sc{display:flex;flex-direction:column;border-top:1px solid var(--kmi-line);padding-top:6px}.kmi-usermenu .sc a{padding:10px 6px;color:#e2e8f0;text-decoration:none;border-radius:8px;font-size:14px;min-height:20px}.kmi-usermenu .sc a:hover{background:#1e293b}
.kmi-usermenu .out{width:100%;margin-top:8px;min-height:44px;border:0;border-radius:10px;background:#7f1d1d;color:#fff;font-weight:700;cursor:pointer}
.kmi-top .user{font-size:12px;color:var(--kmi-mut);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kmi-top .btn{min-height:40px;border-radius:10px;border:1px solid var(--kmi-line2);background:#1e293b;color:#e2e8f0;padding:0 12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.kmi-top .btn:hover{background:#334155}
.kmi-menu-btn{display:inline-flex}
.kmi-side{display:none;position:fixed;top:0;left:0;bottom:0;z-index:40;width:var(--kmi-side-w);flex-direction:column;background:#0b1220;border-right:1px solid rgba(8,145,178,.3);transition:width .15s ease}
.kmi-side-head{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:12px;border-bottom:1px solid var(--kmi-line)}
.kmi-side-head .b{display:flex;align-items:center;gap:8px;min-width:0;color:#fff;text-decoration:none}
.kmi-side-head .b img{height:32px;width:auto;flex:none;filter:drop-shadow(0 0 6px rgba(184,135,24,.35))}
.kmi-side-head .t{min-width:0;overflow:hidden;white-space:nowrap}
.kmi-side-head .t i{display:block;font-style:normal;font-size:9px;letter-spacing:.2em;font-weight:800;color:var(--kmi-cyan2)}
.kmi-side-head .t b{display:block;font-size:12px}
.kmi-side-collapse{flex:none;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--kmi-mut);cursor:pointer}
.kmi-side-collapse:hover{background:#1e293b}
.kmi-nav{flex:1;overflow-y:auto;padding:8px}
.kmi-nav .lbl{font-size:9px;font-weight:800;letter-spacing:.14em;color:#64748b;margin:12px 8px 4px}
.kmi-nav .grp-head{display:block;width:calc(100% - 16px);text-align:left;background:none;border:0;cursor:pointer;font-family:inherit}
.kmi-nav .grp-head::after{content:'▾';float:right;opacity:.6;transition:transform .12s}
.kmi-nav .grp-head[aria-expanded=false]::after{transform:rotate(-90deg)}
.kmi-nav .grp-head:hover{color:#94a3b8}
.kmi-side.collapsed .grp-body{display:block!important}
.kmi-nav hr{border:0;border-top:1px solid rgba(30,41,59,.7);margin:6px 0}
.kmi-nav .nrow{display:flex;align-items:center;gap:2px}.kmi-nav .nrow a{flex:1;min-width:0}.kmi-nav .nfav{flex:none;width:32px;min-height:40px;border:0;background:none;color:#64748b;cursor:pointer;font-size:15px;border-radius:8px;opacity:.55}.kmi-nav .nrow:hover .nfav,.kmi-nav .nfav[aria-pressed=true],.kmi-nav .nfav:focus-visible{opacity:1}.kmi-nav .nfav[aria-pressed=true]{color:var(--kmi-gold2)}.kmi-side.collapsed:not(.peek) .nfav{display:none}
.kmi-nav a{display:flex;align-items:center;gap:10px;min-height:40px;padding:6px 10px;border-radius:10px;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:600;border-left:3px solid transparent}
.kmi-nav a .ic{color:var(--kmi-cyan)}
.kmi-nav a:hover{background:#1e293b}
.kmi-nav a[aria-current=page]{background:linear-gradient(90deg,rgba(34,211,238,.16),rgba(34,211,238,.04));border-left-color:var(--kmi-gold2);color:#fff}
.kmi-nav a[aria-current=page] .ic{color:var(--kmi-gold2)}
.kmi-side.collapsed{width:84px}
.kmi-side.collapsed .kmi-panel{display:none}.kmi-side.collapsed.peek{width:340px;z-index:55;box-shadow:12px 0 40px rgba(0,0,0,.5)}.kmi-side.collapsed.peek .kmi-panel{display:block}
.kmi-side.collapsed .t,.kmi-side.collapsed .lbl,.kmi-side.collapsed .nl{display:none}
.kmi-side.collapsed .kmi-side-head{flex-direction:column;padding:10px 6px}
.kmi-side.collapsed .kmi-nav a{justify-content:center;padding:6px}
.kmi-main{min-height:100vh}
.kmi-content{padding:16px;max-width:1500px;margin:0 auto}
.kmi-content>*{max-width:100%}
.kmi-bottom{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;background:var(--kmi-bg);border-top:1px solid rgba(8,145,178,.3);padding-bottom:env(safe-area-inset-bottom)}
.kmi-bottom a,.kmi-bottom button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:56px;padding:6px 2px;background:transparent;border:0;color:var(--kmi-mut);font-size:11px;font-weight:700;text-decoration:none;cursor:pointer}
.kmi-bottom a .ic,.kmi-bottom button .ic{color:var(--kmi-cyan)}
.kmi-bottom a[aria-current=page]{color:#fff;box-shadow:inset 0 3px 0 var(--kmi-gold2)}
.kmi-has-bottom .kmi-content{padding-bottom:calc(96px + env(safe-area-inset-bottom))}
.kmi-drawer-back{position:fixed;inset:0;z-index:60;background:rgba(2,6,23,.65);display:none}
.kmi-drawer-back.open{display:block}
.kmi-drawer{position:absolute;top:0;left:0;bottom:0;width:min(86vw,320px);background:#0b1220;border-right:1px solid rgba(8,145,178,.3);display:flex;flex-direction:column;box-shadow:0 0 40px rgba(0,0,0,.6)}
.kmi-drawer .kmi-nav a{min-height:48px;font-size:15px}
@media (min-width:1024px){
  .kmi-side{display:flex}
  .kmi-main{margin-left:var(--kmi-side-w);transition:margin-left .15s ease}
  .kmi-menu-btn,.kmi-bottom,.kmi-drawer-back{display:none!important}
  .kmi-top .brand img,.kmi-top .brand .bs{display:none}.kmi-top .brand .bt{display:flex}.kmi-top .brand{margin-right:6px}
  .kmi-content{padding:20px 28px}
}
@media (min-width:1024px) and (max-width:1359px){.kmi-top .brand .bt b{font-size:12px;letter-spacing:.05em}.kmi-top .brand small{font-size:10px;letter-spacing:.06em}.kmi-top .clock{display:none}.kmi-top{gap:8px}.kmi-user-btn .who{max-width:96px;overflow:hidden;text-overflow:ellipsis}.kmi-top form{flex:1 1 90px}}
@media (max-width:359px){.kmi-top [data-testid=app-shift-chip],.kmi-top .shift{display:none}}
@media (min-width:640px) and (max-width:1023px){.kmi-top .clock{display:none}.kmi-top .brand .bs{display:inline}.kmi-top{gap:8px}.kmi-user-btn .who{max-width:96px;overflow:hidden;text-overflow:ellipsis}.kmi-top form{flex:1 1 90px}}
@media (max-width:639px){.kmi-top .kmi-chips .chip.pulse{display:none}.kmi-top .clock{display:none}.kmi-top [data-testid=app-logout]{display:none}.kmi-top{gap:6px;padding:8px}.kmi-top .brand .bs{display:inline;font-size:13px}.kmi-top form{flex:1 1 60px}.kmi-user-btn .who{display:none}.kmi-top .kmi-chips .chip{padding:0 8px}.kmi-top .user{display:none}.kmi-top .btn .nl{display:none}}
/* ---------- KMI-001 device experience: identity strip for shared/tablet devices, touch targets from --kmi-target ---------- */
.kmi-device{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:8px 16px;background:linear-gradient(90deg,#3a2a05,#1b1405);border-bottom:1px solid var(--kmi-gold2);color:#fde7b0;font-size:14px}.kmi-device[hidden]{display:none}
.kmi-device .dv-mode{letter-spacing:.14em;font-size:12px;color:var(--kmi-gold2)}.kmi-device .dv-who{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:#fff}.kmi-device .dv-note{opacity:.85;flex:1 1 220px}
.kmi-device .dv-mode,.kmi-device .dv-note{min-width:0}@media (max-width:639px){.kmi-device{flex-wrap:wrap;gap:4px 8px;padding:6px 10px}.kmi-device .dv-mode{display:none}.kmi-device .dv-note{order:3;flex:1 1 100%;font-size:12px}.kmi-device .dv-who{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kmi-device .dv-out{flex:none;padding:0 14px;font-size:14px;min-height:48px}}
.kmi-device .dv-out{display:inline-flex;align-items:center;gap:8px;min-height:var(--kmi-target,48px);padding:0 22px;border-radius:12px;border:2px solid #fca5a5;background:#7f1d1d;color:#fff;font-weight:800;font-size:15px;letter-spacing:.06em;cursor:pointer}
html[data-kmi-touch="1"] .kmi-rail .ri,html[data-kmi-touch="1"] .kmi-panel a,html[data-kmi-touch="1"] .kmi-bottom a,html[data-kmi-touch="1"] .kmi-bottom button{min-height:var(--kmi-target,48px)}
html[data-kmi-touch="1"] .kmi-panel .nfav{min-height:var(--kmi-target,48px);width:var(--kmi-target,48px)}
/* ---------- home ---------- */
.kmi-hero{display:flex;align-items:center;gap:14px;padding:10px 16px;border-radius:16px;border:1px solid var(--kmi-line2);background:radial-gradient(circle at 92% 0%,rgba(56,189,248,.14),transparent 38%),linear-gradient(135deg,#0f172a 0%,#131d2e 58%,#1b283d 100%);box-shadow:0 14px 40px rgba(2,6,23,.4)}
.kmi-hero img{height:36px;width:auto;filter:drop-shadow(0 0 8px rgba(184,135,24,.4))}
.kmi-hero h1{margin:0;font-size:16px;letter-spacing:.04em;font-weight:800;color:#fff;line-height:1.2}
.kmi-hero p{margin:2px 0 0;font-size:12px;color:var(--kmi-mut)}
.kmi-hero .chips{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
.kmi-chip{display:inline-block;padding:2px 9px;border-radius:99px;border:1px solid var(--kmi-line2);background:#0f172a;color:var(--kmi-cyan2);font-size:11px;font-weight:700}
.kmi-section{margin:22px 0 8px;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.14em;color:var(--kmi-mut)}
.kmi-section:after{content:"";flex:1;height:1px;background:var(--kmi-line)}
.kmi-section.gold{color:var(--kmi-gold2)}
.kmi-pulse[hidden]{display:none}.kmi-pulse .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kmi-stat{display:flex;align-items:baseline;gap:10px;padding:12px 14px;border-radius:14px;border:1px solid var(--kmi-line2);background:linear-gradient(145deg,#0f172a,#111c2e);color:#e2e8f0;text-decoration:none}
.kmi-stat b{font-size:28px;font-variant-numeric:tabular-nums}.kmi-stat span{font-size:12px;color:var(--kmi-mut)}.kmi-stat.bad{border-color:#7f1d1d;background:linear-gradient(145deg,#2a0f14,#111c2e)}.kmi-stat.bad b{color:#fca5a5}.kmi-stat.warn{border-color:#78350f}.kmi-stat.warn b{color:#fcd34d}
.kmi-mut{font-size:12px;color:var(--kmi-mut);margin-top:6px}
.kmi-dept{margin-top:4px}.kmi-links{display:flex;flex-wrap:wrap;gap:8px}
.kmi-content a.kmi-link{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid var(--kmi-line2);background:#0f172a;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:600}
.kmi-link:hover{border-color:var(--kmi-cyan)}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.kmi-content a.kmi-tile,.kmi-tile{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px;border-radius:14px;border:1px solid var(--kmi-line2);background:linear-gradient(145deg,#0f172a,#111c2e);color:#e2e8f0;text-decoration:none;font-weight:700;font-size:14px;box-shadow:0 6px 18px rgba(2,6,23,.3);transition:border-color .12s,transform .12s}
.kmi-content a.kmi-tile{color:#e2e8f0;text-decoration:none}
.kmi-tile:hover{border-color:var(--kmi-cyan);transform:translateY(-1px)}
.kmi-tile .ic{width:38px;height:38px;border-radius:10px;background:rgba(34,211,238,.10);color:var(--kmi-cyan)}
.kmi-tile small{display:block;font-weight:500;font-size:11px;color:var(--kmi-mut);margin-top:2px}
.kmi-tile.featured{border-color:rgba(184,135,24,.55);background:linear-gradient(145deg,#1a160a,#0f172a 60%,#111c2e)}
.kmi-tile.featured .ic{background:rgba(212,175,55,.12);color:var(--kmi-gold2)}
.kmi-home details>summary{min-height:48px;display:flex;align-items:center;cursor:pointer;font-weight:800;color:#cbd5e1}
.kmi-banner{padding:10px 14px;border-radius:10px;margin:10px 0;font-weight:700}
.kmi-banner.warn{background:rgba(245,158,11,.16);color:#fcd34d}
.kmi-banner.off{background:rgba(245,158,11,.16);color:#fcd34d;position:sticky;top:0;z-index:50;border-radius:0;margin:0;padding:8px 16px}
.kmi-closed{max-width:560px;margin:8vh auto;padding:22px;border-radius:14px;border:1px solid var(--kmi-line2);background:var(--kmi-panel)}
/* ---------- screens reconcile: bare elements and legacy inline light colours become the KMI palette ---------- */
.kmi-content h1{font-size:22px;line-height:1.25;margin:4px 0 12px;color:#fff;font-weight:800;letter-spacing:.01em}
.kmi-content h2{font-size:15px;margin:20px 0 8px;color:#e2e8f0;font-weight:800;padding-left:10px;border-left:3px solid var(--kmi-gold)}
.kmi-content h3{font-size:14px;margin:14px 0 6px;color:#cbd5e1;font-weight:800}
.kmi-content p,.kmi-content li,.kmi-content label,.kmi-content td,.kmi-content th,.kmi-content summary{color:inherit}
.kmi-content table{border-collapse:collapse}
.kmi-content th{background:#131d2e;color:var(--kmi-mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.kmi-content td,.kmi-content th{border-bottom:1px solid var(--kmi-line);padding:6px 8px;text-align:left}
.kmi-content tbody tr:hover{background:#131d2e}
.kmi-content input:not([type=checkbox]):not([type=radio]):not([type=file]),.kmi-content select,.kmi-content textarea{background:#0f172a;color:#e2e8f0;border:1px solid var(--kmi-line2);border-radius:10px;padding:8px 10px;font-size:16px;min-height:40px;max-width:100%}
.kmi-content input::placeholder,.kmi-content textarea::placeholder{color:#64748b}
.kmi-content button{font:inherit;font-weight:700;color:#fff;background:var(--kmi-blue);border:0;border-radius:10px;min-height:40px;padding:0 14px;cursor:pointer}
.kmi-content button:hover:not(:disabled){filter:brightness(1.12)}
.kmi-content button:disabled{opacity:.45;cursor:not-allowed}
.kmi-content code{background:#1e293b;color:#e2e8f0;border-radius:6px;padding:1px 6px}
.kmi-content details{border-radius:10px}
.kmi-content hr{border:0;border-top:1px solid var(--kmi-line)}
.kmi-content a{color:var(--kmi-cyan2)}
.kmi-content [style*="background:#fee2e2"]{background:rgba(239,68,68,.16)!important}
.kmi-content [style*="background:#fef3c7"]{background:rgba(245,158,11,.16)!important}
.kmi-content [style*="background:#fef9c3"]{background:rgba(245,158,11,.16)!important}
.kmi-content [style*="background:#dcfce7"]{background:rgba(34,197,94,.16)!important}
.kmi-content [style*="background:#fff"]{background:#111c2e!important}
.kmi-content [style*="background:#f8fafc"]{background:#111c2e!important}
.kmi-content [style*="background:#f1f5f9"]{background:#111c2e!important}
.kmi-content [style*="background:#f4f6fa"]{background:#111c2e!important}
.kmi-content [style*="background:#e2e8f0"]{background:#1e293b!important}
.kmi-content [style*="background:#e0e7ff"]{background:rgba(99,102,241,.18)!important}
.kmi-content [style*="background:#e0f2fe"]{background:rgba(56,189,248,.16)!important}
.kmi-content [style*="background:#ede9fe"]{background:rgba(139,92,246,.18)!important}
.kmi-content [style*="background:#faf5ff"]{background:rgba(139,92,246,.12)!important}
.kmi-content [style*="color:#64748b"]{color:#94a3b8!important}
.kmi-content [style*="color:#475569"]{color:#a3b1c6!important}
.kmi-content [style*="color:#555"]{color:#94a3b8!important}
.kmi-content [style*="color:#666"]{color:#94a3b8!important}
.kmi-content [style*="color:#888"]{color:#94a3b8!important}
.kmi-content [style*="color:#0f172a"]{color:#e2e8f0!important}
.kmi-content [style*="color:#000"]{color:#e2e8f0!important}
.kmi-content [style*="color:#b45309"]{color:#fbbf24!important}
.kmi-content [style*="color:#92400e"]{color:#fbbf24!important}
.kmi-content [style*="color:#78350f"]{color:#fbbf24!important}
.kmi-content [style*="color:#a60"]{color:#fbbf24!important}
.kmi-content [style*="color:#854d0e"]{color:#fbbf24!important}
.kmi-content [style*="color:#b91c1c"]{color:#fca5a5!important}
.kmi-content [style*="color:#991b1b"]{color:#fca5a5!important}
.kmi-content [style*="color:#7f1d1d"]{color:#fca5a5!important}
.kmi-content [style*="color:#b00"]{color:#fca5a5!important}
.kmi-content [style*="color:#166534"]{color:#86efac!important}
.kmi-content [style*="color:#15803d"]{color:#86efac!important}
.kmi-content [style*="color:#1d4ed8"]{color:#7db3ff!important}
.kmi-content [style*="color:#3730a3"]{color:#a5b4fc!important}
.kmi-content [style*="color:#7c3aed"]{color:#c4b5fd!important}
.kmi-content [style*="color:#6d28d9"]{color:#c4b5fd!important}
.kmi-content [style*="solid #e2e8f0"]{border-color:#334155!important}
.kmi-content [style*="solid #cbd5e1"]{border-color:#334155!important}
.kmi-content [style*="solid #f1f5f9"]{border-color:#334155!important}
/* component skins: screens that ship their own light class-based CSS (operator home, machine terminal, live board) */
.kmi-content .oh,.kmi-content .term{background:transparent;color:#e2e8f0;min-height:0}
.kmi-content .oh .card,.kmi-content .term .card{background:#111c2e;border:1px solid #334155;box-shadow:0 6px 18px rgba(2,6,23,.3)}
.kmi-content .oh .ok,.kmi-content .term .ok{background:rgba(34,197,94,.18);color:#86efac}
.kmi-content .oh .warn,.kmi-content .term .warn{background:rgba(245,158,11,.18);color:#fcd34d}
.kmi-content .oh .bad,.kmi-content .term .bad{background:rgba(239,68,68,.18);color:#fca5a5}
.kmi-content .oh .info{background:rgba(99,102,241,.2);color:#c7d2fe}
.kmi-content .oh .ghost,.kmi-content .term .ghost{background:#1e293b;color:#e2e8f0}
.kmi-content .oh .bar,.kmi-content .term .bar{background:#1e293b}
.kmi-content .live .chip{background:#1e293b;color:#e2e8f0}
.kmi-content .live .m{background:#111c2e;border-color:#334155;border-top-color:#94a3b8}
.kmi-content .live .m[data-status="UP"]{border-top-color:#16a34a}.kmi-content .live .m[data-status="DOWN"]{border-top-color:#dc2626}
.kmi-content .live .m[data-status="MAINTENANCE"]{border-top-color:#f59e0b}.kmi-content .live .m[data-status="HOLD"]{border-top-color:#7c3aed}
.kmi-content [style*="background:#fdd"]{background:rgba(239,68,68,.24)!important}
.kmi-content [style*="background:#fec"]{background:rgba(245,158,11,.24)!important}
.kmi-content [style*="background:#efe"]{background:rgba(34,197,94,.18)!important}
.chip.shift{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#0f2a4a;color:#bae6fd;border:1px solid #1d4ed8;white-space:nowrap}
.chip.shift[data-shift=OFF_HOURS]{background:#334155;color:#e2e8f0;border:1px dashed #94a3b8}
@media (max-width:640px){.chip.shift{display:none}}
.cp-head{min-width:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.cp-fresh{font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;background:#14532d;color:#bbf7d0}
.cp-fresh.stale{background:#78350f;color:#fde68a}.cp-fresh.unknown{background:#334155;color:#e2e8f0;border:1px dashed #94a3b8}
.cp-signals,.cp-pulse{margin-top:14px}.cp-sig{padding:8px 12px;border-radius:10px;border:1px solid var(--kmi-line2);margin-bottom:6px;font-size:13px}
.cp-sig.bad{border-color:#b91c1c;background:rgba(127,29,29,.25)}.cp-sig.warn{border-color:#b45309;background:rgba(120,53,15,.25)}.cp-sig a{color:var(--kmi-cyan2);white-space:nowrap}
.cp-lights{display:flex;flex-wrap:wrap;gap:8px}.cp-light{font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:#334155;color:#e2e8f0}
.cp-light.green{background:#14532d;color:#bbf7d0}.cp-light.amber{background:#78350f;color:#fde68a}.cp-light.red{background:#7f1d1d;color:#fecaca}
@media (max-width:640px){.cp-n{font-size:24px}}
.fp-sec{margin-top:18px;display:flex;flex-direction:column;gap:8px}
.fp-group{border:1px solid var(--kmi-line2);border-radius:14px;padding:10px;background:#0f172a}
.fp-gh{font-weight:800;display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
.fp-count{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--kmi-line2)}
.fp-count.bad{border-color:#dc2626;color:#fca5a5}.fp-count.warn{border-color:#d97706;color:#fcd34d}.fp-count.ok{border-color:#16a34a;color:#86efac}.fp-count.info{border-color:#38bdf8;color:#7dd3fc}.fp-count.unknown{border-style:dashed;color:#cbd5e1}
.fp-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}
.fp-tile{min-width:0;overflow-wrap:anywhere;display:flex;flex-direction:column;gap:2px;padding:10px;border-radius:12px;border:1px solid var(--kmi-line2);background:#111c2e;color:var(--kmi-text);text-decoration:none}
.fp-tile.bad{border-color:#dc2626}.fp-tile.warn{border-color:#d97706}.fp-tile.ok{border-color:#16a34a}.fp-tile.info{border-color:#38bdf8}.fp-tile.unknown{border-style:dashed}
.fp-st{font-size:12px}.fp-sub{font-size:12px;color:#94a3b8;overflow-wrap:anywhere}.fp-sub.warn{color:#fcd34d}
.fp-scroll{overflow-x:auto;max-width:100%}.fp-table{border-collapse:collapse;font-size:12px;min-width:480px}.fp-table th,.fp-table td{border-bottom:1px solid var(--kmi-line2);padding:4px 8px;text-align:left}
.fp-unknown{padding:10px;border-radius:12px;border:1px dashed #64748b;background:#1e293b}
.fp-nba{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;border:1px solid var(--kmi-line2);background:#111c2e;color:var(--kmi-text);text-decoration:none;min-width:0;overflow-wrap:anywhere}
.fp-nba.bad{border-left:4px solid #dc2626}.fp-nba.warn{border-left:4px solid #d97706}.fp-nba.info{border-left:4px solid #38bdf8}

/* ---------- two-level navigation (Release 007): rail of workspaces + panel of the selected workspace ---------- */
.kmi-nav2{flex:1;display:flex;min-height:0;min-width:0}
.kmi-rail{flex:none;width:84px;display:flex;flex-direction:column;gap:2px;padding:8px 6px;overflow-y:auto;border-right:1px solid var(--kmi-line);background:#080e1b}
.kmi-rail hr{border:0;border-top:1px solid rgba(51,65,85,.55);margin:6px 8px;width:auto}
.kmi-rail .ri{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:58px;padding:7px 2px;border:0;border-radius:12px;background:transparent;color:#cbd5e1;text-decoration:none;cursor:pointer;font-family:inherit;border-left:3px solid transparent}
.kmi-rail .ri .ic{color:var(--kmi-cyan)}
.kmi-rail .ri .rl{font-size:11px;font-weight:700;letter-spacing:0;line-height:1.1;text-align:center;max-width:78px;overflow-wrap:normal;word-break:keep-all}
.kmi-rail .ri:hover{background:#13203a}.kmi-rail .ri:focus-visible{outline:2px solid var(--kmi-cyan);outline-offset:-2px}.kmi-panel .ph-link{color:inherit;text-decoration:none;display:inline-block;padding:6px 0;min-height:32px}.kmi-panel .ph-link:hover{color:#fff}
.kmi-rail .ri[aria-pressed=true],.kmi-rail .ri[aria-current=page]{background:linear-gradient(180deg,rgba(34,211,238,.16),rgba(34,211,238,.04));border-left-color:var(--kmi-gold2);color:#fff}
.kmi-rail .ri[aria-pressed=true] .ic,.kmi-rail .ri[aria-current=page] .ic{color:var(--kmi-gold2)}
.kmi-panel{flex:1;min-width:0;overflow-y:auto;padding:12px 10px;background:linear-gradient(180deg,#0b1220,#0a101c)}
.kmi-panel .ph{font-size:10px;font-weight:800;letter-spacing:.16em;color:var(--kmi-gold2);margin:4px 8px 10px}
.kmi-panel .nfn{margin:6px 0 4px;padding:8px 0 2px;border-top:1px dashed #243452}.kmi-panel .nfh{font-size:10.5px;letter-spacing:.18em;color:#c9a24a;font-weight:700;margin:0 0 4px 4px}.kmi-panel .nfi{display:flex;align-items:center;gap:10px;min-height:var(--kmi-target,40px);padding:4px 8px;border-radius:8px;color:#e2e8f0;text-decoration:none;font-size:14px}.kmi-panel a.nfi:hover,.kmi-panel a.nfi:focus-visible{background:#10203a}.kmi-panel .nfi small{display:block;font-size:11px;color:#8da0bd}.kmi-panel .nfi.off{color:#9fb0cf;cursor:default}.kmi-panel .fd{flex:none;width:10px;height:10px;border-radius:50%;border:2px solid}.kmi-panel .fd-available{background:#22c55e;border-color:#22c55e}.kmi-panel .fd-partial{background:#f59e0b;border-color:#f59e0b}.kmi-panel .fd-planned{background:transparent;border-color:#94a3b8;border-style:dashed}.kmi-panel .fd-blocked{background:#ef4444;border-color:#ef4444}
.kmi-panel .nsec{margin:0 0 10px;border-top:1px solid #1e2b45;padding-top:6px}.kmi-panel .nsec:first-of-type{border-top:0}.kmi-panel .nsh{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:2px 8px 4px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#9fb0cf}.kmi-panel .nsh .ph-link{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0;color:#cfe0ff}.kmi-panel .nsh .ph-link:hover{color:#fff}.kmi-panel .nexp{width:40px;min-height:40px;font-size:14px;color:#9fb0cf}.kmi-dw .dsub{font-size:11px;font-weight:800;letter-spacing:.12em;color:#9fb0cf;margin:12px 6px 4px}.kmi-dw .dsub a{color:inherit;text-decoration:none}.kmi-panel .nrow{display:flex;align-items:center;gap:2px}.kmi-panel .nrow a{flex:1;min-width:0}
.kmi-panel .nfav{flex:none;width:32px;min-height:40px;border:0;background:none;color:#64748b;cursor:pointer;font-size:15px;border-radius:8px}.kmi-panel .nfav:hover{color:var(--kmi-gold2);background:#1e293b}.kmi-panel .nfav[aria-pressed=true]{color:var(--kmi-gold2)}
.kmi-panel a,.kmi-dw a{display:flex;align-items:center;gap:10px;min-height:42px;padding:6px 10px;border-radius:10px;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:600;border-left:3px solid transparent}
.kmi-panel a .ic,.kmi-dw a .ic{color:var(--kmi-cyan)}
.kmi-panel a:hover,.kmi-dw a:hover{background:#1e293b}
.kmi-panel a[aria-current=page],.kmi-dw a[aria-current=page]{background:linear-gradient(90deg,rgba(34,211,238,.16),rgba(34,211,238,.04));border-left-color:var(--kmi-gold2);color:#fff}
.kmi-side.collapsed .kmi-panel{display:none}
.kmi-side.collapsed .kmi-rail{width:100%}.kmi-side.collapsed.peek .kmi-rail{width:84px}
.kmi-dw{display:block;overflow-y:auto;padding:10px}
.kmi-dw .dh{font-size:10px;font-weight:800;letter-spacing:.16em;color:var(--kmi-gold2);margin:12px 6px 8px}
.kmi-dw .dpages{display:flex;flex-direction:column;gap:2px}
.kmi-dw .dpages a,.kmi-dw .dquick a{min-height:52px;font-size:16px}
.kmi-dw .dgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.kmi-dw .dws{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:64px;padding:6px 2px;border:1px solid var(--kmi-line2);border-radius:12px;background:#0f172a;color:#cbd5e1;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700}
.kmi-dw .dws .ic{color:var(--kmi-cyan)}.kmi-dw .dws span{max-width:100%;overflow-wrap:anywhere;text-align:center}
.kmi-dw .dws[aria-pressed=true]{border-color:var(--kmi-gold2);background:linear-gradient(180deg,rgba(34,211,238,.16),rgba(34,211,238,.04));color:#fff}
.kmi-dw .dquick{margin-top:14px;padding-top:10px;border-top:1px solid var(--kmi-line);display:flex;flex-direction:column;gap:2px}
.kmi-crumb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:12px;color:var(--kmi-mut)}
.kmi-crumb a{color:var(--kmi-cyan);text-decoration:none}.kmi-crumb a:hover{text-decoration:underline}.kmi-crumb b{color:#e2e8f0;font-weight:700}
@media (min-width:1024px) and (max-width:1279px){.kmi-panel{padding:10px 6px}.kmi-panel a{font-size:12.5px;padding:6px 8px}}

/* ---------- home: operational priority (Release 007) ---------- */
.cp-block{margin:0 0 14px;padding:12px 14px;border-radius:14px;border:1px solid var(--kmi-line2);background:linear-gradient(180deg,#0e1a2e,#0b1424)}
.cp-priority{border-color:rgba(245,185,66,.35)}
.cp-title{font-size:10px;font-weight:800;letter-spacing:.16em;color:var(--kmi-gold2);margin:0 0 8px}
.cp-rows{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:2px 18px}
.cp-row{display:flex;align-items:center;gap:10px;min-width:0;padding:8px 6px;border-radius:8px;border-bottom:1px solid rgba(51,65,85,.4);color:#e2e8f0;text-decoration:none}
.cp-row:hover{background:#13203a}
.cp-row .dot{flex:none;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:800 11px system-ui;font-style:normal;background:#334155;color:#cbd5e1}
.cp-row.ok .dot{background:#14532d;color:#86efac}.cp-row.warn .dot{background:#78350f;color:#fde68a}.cp-row.bad .dot{background:#7f1d1d;color:#fecaca}.cp-row.info .dot{background:#1e3a5f;color:#93c5fd}
.cp-row .rl{flex:1;min-width:0;font-size:13px;font-weight:600;overflow-wrap:anywhere}
.cp-row .rv{flex:none;text-align:right;font-variant-numeric:tabular-nums}
.cp-row .rv b{font-size:20px;color:#fff}.cp-row .rv small{color:var(--kmi-mut);font-size:11px}.cp-row .rv em{font-style:normal;font-size:12px;color:#94a3b8}
.cp-row.bad .rv b{color:#fca5a5}.cp-row.warn .rv b{color:#fcd34d}
.cp-wait summary{cursor:pointer;font-weight:700;font-size:13px;color:#cbd5e1}.cp-wait p{margin:8px 0}
.cp-wait .cp-row{opacity:.8}
@media (max-width:700px){.kmi-hero{padding:8px 12px;gap:10px}.kmi-hero p,.kmi-hero .chips{display:none}.kmi-hero h1{font-size:13px;letter-spacing:.03em}.kmi-hero img{height:26px}}
/* R2 §1.6 navigation density: pointer devices get tighter rows (touch keeps the 48 px targets); long names wrap instead of being cut */
.kmi-panel a,.kmi-dw a{line-height:1.25;overflow-wrap:anywhere}
html:not([data-kmi-touch="1"]) .kmi-panel a{min-height:36px;padding:4px 10px}
html:not([data-kmi-touch="1"]) .kmi-panel .nsec{margin:0 0 6px;padding-top:4px}
`;
