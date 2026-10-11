function appendChild(parent, child) {
    if (child === null || child === undefined || child === false)
        return;
    if (Array.isArray(child)) {
        child.forEach((c) => appendChild(parent, c));
        return;
    }
    if (typeof child === 'string' || typeof child === 'number') {
        parent.appendChild(document.createTextNode(String(child)));
        return;
    }
    parent.appendChild(child);
}
/**
 * Classic JSX factory. `tag` is either a plain HTML tag name (string) or a "function
 * component" `(props) => Node`. Props starting with `on` (e.g. `onClick`) are wired as real
 * DOM event listeners; `class`/`className` both work; everything else is set as an attribute,
 * except `value`/`checked`/`disabled` which are set as DOM properties (so they behave
 * correctly for form controls).
 */
export function h(tag, props, ...children) {
    if (typeof tag === 'function') {
        return tag(props, ...children);
    }
    const el = document.createElement(tag);
    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (value === null || value === undefined || value === false)
                continue;
            if (key === 'className' || key === 'class') {
                el.setAttribute('class', String(value));
            }
            else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.slice(2).toLowerCase(), value);
            }
            else if (key === 'value' || key === 'checked' || key === 'disabled') {
                el[key] = value;
            }
            else if (key === 'dataset' && typeof value === 'object') {
                Object.assign(el.dataset, value);
            }
            else {
                el.setAttribute(key, String(value));
            }
        }
    }
    children.forEach((c) => appendChild(el, c));
    return el;
}
/**
 * JSX fragment support (`<>...</>`). Props is typed `unknown` rather than `HProps` on
 * purpose: TypeScript's classic-JSX-pragma elaboration synthesizes a bare `{}` type (not an
 * indexed type) for a fragment's attributes, which fails assignability against any indexed
 * parameter type even though fragments never actually carry attributes.
 */
export function Fragment(_props, ...children) {
    const frag = document.createDocumentFragment();
    children.forEach((c) => appendChild(frag, c));
    return frag;
}
/** Mounts a node into a container, replacing its previous contents. */
export function mount(container, node) {
    container.replaceChildren();
    container.appendChild(node);
}
