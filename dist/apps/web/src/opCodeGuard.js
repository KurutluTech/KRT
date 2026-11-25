// r19 guard: CUT/PREP (internal op_no 1 / server code 'OP1') must never be shown to users as OP1/OP0.
// Rewrites DISPLAY text only (text nodes and title/placeholder/aria-label). Internal ids, data-* attributes,
// routing links and server codes are untouched.
const RE = /\bOP0?1\b|\bOP0\b/g;
const ATTRS = ['title', 'placeholder', 'aria-label'];
const fix = (s) => (typeof s === 'string' && s.indexOf('OP') >= 0 ? s.replace(RE, 'CUT/PREP') : s);
function sweep(root) {
    if (!root) return;
    if (root.nodeType === 3) { const v = fix(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1) return;
    const tag = root.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' && root.type !== 'button' && root.type !== 'submit') { /* user-typed values are never rewritten */ }
    for (const a of ATTRS) { const v = root.getAttribute?.(a); if (v) { const f = fix(v); if (f !== v) root.setAttribute(a, f); } }
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
    const w = document.createTreeWalker(root, 4 /* SHOW_TEXT */);
    let n; while ((n = w.nextNode())) { const p = n.parentNode; if (p && (p.tagName === 'TEXTAREA' || p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue; const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    root.querySelectorAll?.('[title],[placeholder],[aria-label]').forEach((el) => { for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const f = fix(v); if (f !== v) el.setAttribute(a, f); } } });
}
export function installOpCodeGuard(doc = document) {
    if (doc.__kmiOpGuard) return; doc.__kmiOpGuard = true;
    let queued = false; const pending = new Set();
    const flush = () => { queued = false; const items = [...pending]; pending.clear(); for (const x of items) sweep(x); };
    const mo = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === 'childList') m.addedNodes.forEach((n) => pending.add(n));
            else if (m.type === 'characterData') pending.add(m.target);
            else if (m.type === 'attributes') pending.add(m.target);
        }
        if (!queued) { queued = true; (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(flush); }
    });
    mo.observe(doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    sweep(doc.body);
    return mo;
}
export const _fix = fix; export const _sweep = sweep;
