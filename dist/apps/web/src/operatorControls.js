// KMI-001 §001.4 — operator button (DOM). Touch-first, never colour-only (icon + Turkish text), wrong-tap and double-submit protection from the pure rules in
// packages/domain/src/operatorControls.ts. The caller passes the icon factory of the app shell (no innerHTML here) and the async action.
import { h } from '../../../packages/ui/src/h.js';
import { OPERATOR_ACTIONS, createPressGuard } from '../../../packages/domain/src/operatorControls.js';
export const OPERATOR_CSS = `
.opb{display:inline-flex;align-items:center;justify-content:center;gap:12px;border-radius:16px;border:2px solid transparent;font-weight:900;letter-spacing:.06em;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-tap-highlight-color:transparent;font-family:inherit;transition:transform .06s ease,filter .12s ease}
.opb:active:not(:disabled){transform:scale(.97)}.opb:focus-visible{outline:3px solid #fff;outline-offset:3px}
.opb.xl{min-height:80px;min-width:min(100%,220px);font-size:24px;flex:1 1 200px}.opb.lg{min-height:64px;font-size:18px;padding:0 18px;flex:1 1 140px}.opb.md{min-height:52px;font-size:14px;padding:0 16px}
.opb.green{background-color:#15803d;background-image:linear-gradient(180deg,#16a34a,#15803d);border-color:#86efac;color:#fff}.opb.red{background-color:#b91c1c;background-image:linear-gradient(180deg,#dc2626,#b91c1c);border-color:#fca5a5;color:#fff}
.opb.amber{background-color:#d97706;background-image:linear-gradient(180deg,#fbbf24,#d97706);border-color:#fcd34d;color:#1c1203}.opb.blue{background-color:#1d4ed8;background-image:linear-gradient(180deg,#2563eb,#1d4ed8);border-color:#93c5fd;color:#fff}
.opb.rose{background-color:#9f1239;background-image:linear-gradient(180deg,#be123c,#9f1239);border-color:#fda4af;color:#fff}
.opb:disabled{filter:grayscale(.85) brightness(.55);cursor:not-allowed;border-style:dashed}
.opb.armed{animation:opb-pulse .7s ease-in-out infinite alternate;border-color:#fff}
@keyframes opb-pulse{from{box-shadow:0 0 0 0 rgba(255,255,255,.55)}to{box-shadow:0 0 0 10px rgba(255,255,255,0)}}
@media (prefers-reduced-motion:reduce){.opb.armed{animation:none;outline:3px solid #fff}}
.opb-wrap{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 150px}.opb-wrap>.opb{flex:none;width:100%}.opb-wrap .opb-why{font-size:12px;color:#fbbf24;font-weight:700}
`;
export function operatorButton(o) {
    const spec = OPERATOR_ACTIONS[o.action];
    const now = o.now ?? (() => Date.now());
    const notWired = o.availability && o.availability.state === 'NOT_WIRED' ? o.availability : null;
    const guard = createPressGuard(spec.confirm, undefined, undefined, spec.rapid === true);
    const label = h('span', { class: 'opb-t' }, o.label ?? spec.label);
    const btn = h('button', { type: 'button', class: `opb ${spec.size} ${spec.tone}`, 'data-testid': o.testid ?? `op-${o.action.toLowerCase()}`, 'data-action': o.action, 'data-wired': notWired ? '0' : '1', title: notWired ? notWired.why : spec.audit, 'aria-disabled': notWired || o.disabled ? 'true' : 'false' }, o.icon(spec.icon, spec.size === 'xl' ? 34 : 26), label);
    if (notWired || o.disabled)
        btn.disabled = true;
    let armTimer = null;
    const disarm = () => { btn.classList.remove('armed'); label.textContent = o.label ?? spec.label; if (armTimer) {
        clearTimeout(armTimer);
        armTimer = null;
    } };
    btn.addEventListener('click', () => {
        if (btn.disabled)
            return;
        const d = guard.press(now());
        if (d === 'IGNORE')
            return;
        if (d === 'ARM') {
            btn.classList.add('armed');
            label.textContent = 'EMİN MİSİNİZ? TEKRAR DOKUNUN';
            armTimer = setTimeout(disarm, 4000);
            return;
        }
        disarm();
        void (async () => { try {
            await o.run();
        }
        finally {
            guard.settle();
        } })();
    });
    if (!notWired)
        return btn;
    return h('div', { class: 'opb-wrap', 'data-testid': `${o.testid ?? `op-${o.action.toLowerCase()}`}-wrap` }, btn, h('span', { class: 'opb-why', 'data-testid': 'op-not-wired' }, `Henüz bağlı değil: ${notWired.why}`));
}
