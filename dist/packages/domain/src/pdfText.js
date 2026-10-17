const latin1 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 8192)
    s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const toBytes = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++)
    b[i] = s.charCodeAt(i) & 0xff; return b; };
async function inflate(data) {
    const DS = globalThis.DecompressionStream;
    if (!DS)
        throw new Error('NO_INFLATE');
    const ds = new DS('deflate');
    const w = ds.writable.getWriter();
    void w.write(data).catch(() => undefined);
    void w.close().catch(() => undefined);
    const chunks = [];
    const r = ds.readable.getReader();
    for (;;) {
        const { done, value } = await r.read();
        if (done)
            break;
        chunks.push(value);
    }
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
        out.set(c, o);
        o += c.length;
    }
    return out;
}
function parseObjects(src, bytes) {
    const objs = new Map();
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = re.exec(src))) {
        const id = Number(m[1]);
        const start = re.lastIndex;
        const si = src.indexOf('stream', start);
        const ei = src.indexOf('endobj', start);
        const end = ei < 0 ? src.length : ei;
        if (si >= 0 && si < end && /^\s*>>\s*$|>>\s*$/.test(src.slice(start, si).trimEnd() + ' ')) {
            let ds = si + 6;
            if (src[ds] === '\r')
                ds++;
            if (src[ds] === '\n')
                ds++;
            const dict = src.slice(start, si);
            const lenM = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
            let de = lenM ? ds + Number(lenM[1]) : -1;
            if (de < 0 || src.slice(de, de + 12).replace(/\s/g, '').slice(0, 9) !== 'endstream') {
                const es = src.indexOf('endstream', ds);
                de = es < 0 ? end : es;
                while (de > ds && (src[de - 1] === '\n' || src[de - 1] === '\r'))
                    de--;
            }
            objs.set(id, { id, dict, stream: bytes.subarray(ds, de) });
            re.lastIndex = Math.max(re.lastIndex, src.indexOf('endstream', de) + 9 || re.lastIndex);
        }
        else
            objs.set(id, { id, dict: src.slice(start, end) });
    }
    return objs;
}
async function decodeStream(o, warnings) {
    if (!o.stream)
        return null;
    const f = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(o.dict)?.[1] ?? '';
    const filters = f.match(/\/\w+/g) ?? [];
    let data = o.stream;
    for (const fl of filters) {
        if (fl === '/FlateDecode' || fl === '/Fl') {
            try {
                data = await inflate(data);
            }
            catch {
                warnings.push(`stream ${o.id}: inflate failed`);
                return null;
            }
        }
        else {
            warnings.push(`stream ${o.id}: filter ${fl} not supported`);
            return null;
        }
    }
    return data;
}
async function expandObjectStreams(objs, warnings) {
    for (const o of [...objs.values()]) {
        if (!/\/Type\s*\/ObjStm/.test(o.dict))
            continue;
        const data = await decodeStream(o, warnings);
        if (!data)
            continue;
        const n = Number(/\/N\s+(\d+)/.exec(o.dict)?.[1] ?? 0);
        const first = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1] ?? 0);
        const s = latin1(data);
        const head = s.slice(0, first).trim().split(/\s+/).map(Number);
        for (let i = 0; i < n; i++) {
            const id = head[i * 2];
            const off = head[i * 2 + 1];
            const next = i + 1 < n ? head[(i + 1) * 2 + 1] : s.length - first;
            if (!objs.has(id))
                objs.set(id, { id, dict: s.slice(first + off, first + next) });
        }
    }
}
const refOf = (s) => { const m = s ? /(\d+)\s+\d+\s+R/.exec(s) : null; return m ? Number(m[1]) : null; };
const refsOf = (s) => [...s.matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));
function dictValue(dict, key) {
    const i = dict.indexOf(key);
    if (i < 0)
        return undefined;
    const rest = dict.slice(i + key.length).trimStart();
    if (rest.startsWith('<<')) {
        let depth = 0;
        for (let k = 0; k < rest.length - 1; k++) {
            if (rest.startsWith('<<', k)) {
                depth++;
                k++;
            }
            else if (rest.startsWith('>>', k)) {
                depth--;
                k++;
                if (depth === 0)
                    return rest.slice(0, k + 1);
            }
        }
        return rest;
    }
    if (rest.startsWith('['))
        return rest.slice(0, rest.indexOf(']') + 1);
    return /^[^/\s>]+(?:\s+\d+\s+R)?/.exec(rest)?.[0] ?? rest.split(/[\s/>]/)[0];
}
// ---- CMaps (ToUnicode)
function parseCMap(text) {
    const map = new Map();
    const hexToStr = (h) => { let s = ''; for (let i = 0; i + 3 < h.length + 1; i += 4)
        s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return s; };
    for (const blk of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
        for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g))
            map.set(parseInt(m[1], 16), hexToStr(m[2].padEnd(Math.ceil(m[2].length / 4) * 4, '0')));
    for (const blk of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
        for (const m of blk[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g)) {
            const lo = parseInt(m[1], 16);
            const hi = parseInt(m[2], 16);
            const dst = m[3];
            if (dst.startsWith('[')) {
                const arr = [...dst.matchAll(/<([0-9A-Fa-f]+)>/g)];
                for (let c = lo; c <= hi && c - lo < arr.length; c++)
                    map.set(c, hexToStr(arr[c - lo][1]));
            }
            else {
                const base = parseInt(dst.slice(1, -1), 16);
                for (let c = lo; c <= hi && c - lo < 65536; c++)
                    map.set(c, String.fromCharCode(base + (c - lo)));
            }
        }
    }
    return map;
}
const WIN1252 = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ' };
function tokenize(s) {
    const out = [];
    let i = 0;
    const stack = [];
    const push = (t) => { (stack.length ? stack[stack.length - 1] : out).push(t); };
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        if (c === '%') {
            while (i < s.length && s[i] !== '\n' && s[i] !== '\r')
                i++;
            continue;
        }
        if (c === '[') {
            stack.push([]);
            i++;
            continue;
        }
        if (c === ']') {
            const a = stack.pop() ?? [];
            push({ t: 'arr', v: a });
            i++;
            continue;
        }
        if (c === '(') {
            let depth = 1;
            i++;
            const bytes = [];
            while (i < s.length && depth > 0) {
                const ch = s[i];
                if (ch === '\\') {
                    const n = s[i + 1];
                    i += 2;
                    if (n === 'n')
                        bytes.push(10);
                    else if (n === 'r')
                        bytes.push(13);
                    else if (n === 't')
                        bytes.push(9);
                    else if (n === 'b')
                        bytes.push(8);
                    else if (n === 'f')
                        bytes.push(12);
                    else if (/[0-7]/.test(n)) {
                        let o = n;
                        while (o.length < 3 && /[0-7]/.test(s[i] ?? '')) {
                            o += s[i];
                            i++;
                        }
                        bytes.push(parseInt(o, 8) & 0xff);
                    }
                    else if (n === '\n' || n === '\r') {
                        if (n === '\r' && s[i] === '\n')
                            i++;
                    }
                    else
                        bytes.push(n.charCodeAt(0) & 0xff);
                    continue;
                }
                if (ch === '(')
                    depth++;
                if (ch === ')') {
                    depth--;
                    if (depth === 0) {
                        i++;
                        break;
                    }
                }
                bytes.push(ch.charCodeAt(0) & 0xff);
                i++;
            }
            push({ t: 'str', v: Uint8Array.from(bytes) });
            continue;
        }
        if (c === '<' && s[i + 1] !== '<') {
            const e = s.indexOf('>', i);
            const hex = s.slice(i + 1, e).replace(/\s/g, '');
            const b = [];
            for (let k = 0; k < hex.length; k += 2)
                b.push(parseInt(hex.slice(k, k + 2).padEnd(2, '0'), 16));
            push({ t: 'str', v: Uint8Array.from(b) });
            i = e + 1;
            continue;
        }
        if (c === '<' || c === '>') {
            i += 2;
            continue;
        }
        if (c === '/') {
            let j = i + 1;
            while (j < s.length && !/[\s/\[\]()<>]/.test(s[j]))
                j++;
            push({ t: 'name', v: s.slice(i + 1, j) });
            i = j;
            continue;
        }
        let j = i;
        while (j < s.length && !/[\s/\[\]()<>%]/.test(s[j]))
            j++;
        const w = s.slice(i, j);
        i = j;
        if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w))
            push({ t: 'num', v: Number(w) });
        else
            push({ t: 'op', v: w });
    }
    return out;
}
function interpret(tokens, fonts) {
    const runs = [];
    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = [1, 0, 0, 1, 0, 0];
    let font = null;
    let size = 10;
    let leading = 0;
    const nums = [];
    let last = null;
    const decode = (b) => {
        if (font?.wide) {
            let s = '';
            for (let k = 0; k + 1 < b.length; k += 2) {
                const code = (b[k] << 8) | b[k + 1];
                s += font.cmap?.get(code) ?? '';
            }
            return s;
        }
        let s = '';
        for (const code of b)
            s += font?.cmap?.get(code) ?? (code >= 0x80 && code <= 0x9f ? (WIN1252[code] ?? '') : String.fromCharCode(code));
        return s;
    };
    const show = (b) => { const t = decode(b); if (t)
        runs.push({ x: tm[4], y: tm[5], size, text: t }); tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + t.length * size * 0.5, tm[5]]; };
    const move = (tx, ty) => { tlm = [tlm[0], tlm[1], tlm[2], tlm[3], tlm[4] + tx * tlm[0] + ty * tlm[2], tlm[5] + tx * tlm[1] + ty * tlm[3]]; tm = [...tlm]; };
    for (const t of tokens) {
        if (t.t === 'num') {
            nums.push(t.v);
            last = t;
            continue;
        }
        if (t.t === 'name') {
            last = t;
            continue;
        }
        if (t.t === 'str' || t.t === 'arr') {
            last = t;
            continue;
        }
        const op = t.v;
        if (op === 'BT') {
            tm = [1, 0, 0, 1, 0, 0];
            tlm = [1, 0, 0, 1, 0, 0];
        }
        else if (op === 'Tf') {
            const nm = tokens[tokens.indexOf(t) - 2];
            size = nums[nums.length - 1] ?? size;
            font = nm && nm.t === 'name' ? fonts.get(nm.v) ?? null : null;
        }
        else if (op === 'Tm' && nums.length >= 6) {
            tm = nums.slice(-6);
            tlm = [...tm];
        }
        else if (op === 'Td' && nums.length >= 2)
            move(nums[nums.length - 2], nums[nums.length - 1]);
        else if (op === 'TD' && nums.length >= 2) {
            leading = -nums[nums.length - 1];
            move(nums[nums.length - 2], nums[nums.length - 1]);
        }
        else if (op === 'TL' && nums.length >= 1)
            leading = nums[nums.length - 1];
        else if (op === 'T*')
            move(0, -leading);
        else if (op === 'Tj' && last?.t === 'str')
            show(last.v);
        else if (op === "'" && last?.t === 'str') {
            move(0, -leading);
            show(last.v);
        }
        else if (op === '"' && last?.t === 'str') {
            move(0, -leading);
            show(last.v);
        }
        else if (op === 'TJ' && last?.t === 'arr') {
            for (const e of last.v) {
                if (e.t === 'str')
                    show(e.v);
                else if (e.t === 'num' && e.v < -200)
                    tm = [tm[0], tm[1], tm[2], tm[3], tm[4] + (-e.v / 1000) * size, tm[5]];
            }
        }
        nums.length = 0;
        last = null;
    }
    return runs;
}
function groupLines(runs) {
    const rows = [];
    for (const r of runs) {
        const row = rows.find((q) => Math.abs(q.y - r.y) <= Math.max(1.5, r.size * 0.45));
        if (row)
            row.items.push({ x: r.x, text: r.text, size: r.size });
        else
            rows.push({ y: r.y, size: r.size, items: [{ x: r.x, text: r.text, size: r.size }] });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map((row) => {
        row.items.sort((a, b) => a.x - b.x);
        let text = '';
        let prevEnd = null;
        for (const it of row.items) {
            const gap = prevEnd === null ? 0 : it.x - prevEnd;
            if (prevEnd !== null)
                text += gap > it.size * 1.4 ? '  ' : gap > it.size * 0.15 && !text.endsWith(' ') && !it.text.startsWith(' ') ? ' ' : '';
            text += it.text;
            prevEnd = it.x + it.text.length * it.size * 0.5;
        }
        return { y: Math.round(row.y * 10) / 10, text: text.replace(/[ \t]+$/g, ''), items: row.items.map((i) => ({ x: i.x, text: i.text })) };
    }).filter((l) => l.text.trim() !== '');
}
export async function extractPdfText(bytes) {
    const warnings = [];
    if (bytes.length < 8 || latin1(bytes.subarray(0, 5)) !== '%PDF-')
        return { source: 'NO_TEXT_LAYER', pages: [], chars: 0, warnings: ['not a PDF'] };
    if (/\/Encrypt\b/.test(latin1(bytes.subarray(Math.max(0, bytes.length - 2048)))))
        return { source: 'NO_TEXT_LAYER', pages: [], chars: 0, warnings: ['PDF is encrypted'] };
    const src = latin1(bytes);
    const objs = parseObjects(src, bytes);
    await expandObjectStreams(objs, warnings);
    // page order: walk the page tree from the Catalog; fall back to object order
    const pages = [];
    const root = [...objs.values()].find((o) => /\/Type\s*\/Catalog/.test(o.dict));
    const walk = (id, seen = new Set()) => {
        const o = id === null ? undefined : objs.get(id);
        if (!o || seen.has(o.id))
            return;
        seen.add(o.id);
        if (/\/Type\s*\/Pages/.test(o.dict)) {
            for (const k of refsOf(dictValue(o.dict, '/Kids') ?? ''))
                walk(k, seen);
        }
        else if (/\/Type\s*\/Page\b/.test(o.dict))
            pages.push(o);
    };
    walk(refOf(root ? dictValue(root.dict, '/Pages') : undefined));
    if (!pages.length)
        for (const o of [...objs.values()].sort((a, b) => a.id - b.id))
            if (/\/Type\s*\/Page\b/.test(o.dict))
                pages.push(o);
    const fontCache = new Map();
    const loadFont = async (id) => {
        const hit = fontCache.get(id);
        if (hit)
            return hit;
        const fo = objs.get(id);
        const font = { wide: false, cmap: null };
        if (fo) {
            font.wide = /\/Subtype\s*\/Type0/.test(fo.dict);
            const tu = refOf(dictValue(fo.dict, '/ToUnicode'));
            const tuo = tu === null ? undefined : objs.get(tu);
            if (tuo) {
                const d = await decodeStream(tuo, warnings);
                if (d)
                    font.cmap = parseCMap(latin1(d));
            }
        }
        fontCache.set(id, font);
        return font;
    };
    const out = [];
    let chars = 0;
    for (let pi = 0; pi < pages.length; pi++) {
        const po = pages[pi];
        let res = dictValue(po.dict, '/Resources');
        if (res && !res.startsWith('<<')) {
            const r = refOf(res);
            res = r === null ? undefined : objs.get(r)?.dict;
        }
        let fdict = res ? dictValue(res, '/Font') : undefined;
        if (fdict && !fdict.startsWith('<<')) {
            const r = refOf(fdict);
            fdict = r === null ? undefined : objs.get(r)?.dict;
        }
        const fonts = new Map();
        if (fdict)
            for (const m of fdict.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g))
                fonts.set(m[1], await loadFont(Number(m[2])));
        const cont = dictValue(po.dict, '/Contents') ?? '';
        const parts = [];
        for (const id of refsOf(cont)) {
            const co = objs.get(id);
            const d = co ? await decodeStream(co, warnings) : null;
            if (d)
                parts.push(latin1(d));
        }
        const lines = groupLines(interpret(tokenize(parts.join('\n')), fonts));
        chars += lines.reduce((n, l) => n + l.text.replace(/\s/g, '').length, 0);
        out.push({ page: pi + 1, lines });
    }
    if (chars < 20)
        return { source: 'NO_TEXT_LAYER', pages: out, chars, warnings };
    return { source: 'TEXT_LAYER', pages: out, chars, warnings };
}
void toBytes;
export function extractPdfImages(bytes) {
    const objs = parseObjects(latin1(bytes), bytes);
    const images = [];
    const unsupported = [];
    for (const o of objs.values()) {
        if (!o.stream || !/\/Subtype\s*\/Image/.test(o.dict))
            continue;
        const filters = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(o.dict)?.[1]?.match(/\/\w+/g) ?? [];
        const dim = (k) => { const m = new RegExp(`/${k}\\s+(\\d+)`).exec(o.dict); return m ? Number(m[1]) : null; };
        if (filters.length === 1 && filters[0] === '/DCTDecode' && o.stream[0] === 0xff && o.stream[1] === 0xd8)
            images.push({ objectId: o.id, width: dim('Width'), height: dim('Height'), mime: 'image/jpeg', bytes: o.stream });
        else
            unsupported.push(`image ${o.id}: ${filters.join('+') || 'raw'}`);
    }
    images.sort((a, b) => (b.bytes.length - a.bytes.length));
    return { images, unsupported };
}
