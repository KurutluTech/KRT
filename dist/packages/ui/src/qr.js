// KMI NEXT — dependency-free QR Code encoder (ISO/IEC 18004, byte mode, versions 1–10).
//
// Why hand-written: this sandbox has no npm registry access, and labels must be printable
// without a CDN. Correctness is NOT taken on faith: packages/ui/test/qr.test.ts compares every
// module of the produced symbol with an independent encoder (reportlab's QR encoder, golden
// vectors in test/fixtures/qr-golden.json across ECC levels, all 8 masks and versions 1–10),
// checks the Reed–Solomon output against the published ISO worked example, and the generated
// SVG is decoded back by an independent decoder (OpenCV QRCodeDetector, see
// test/qr-decode.check.py — run when OpenCV is available).
//
// Output: a square boolean matrix (true = dark), quiet zone NOT included (renderers add 4).
const ECC_ORDINAL = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
// Index [ecc][version], version 0 unused.
const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
];
export const QR_MAX_VERSION = 10;
function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
}
export function numRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7)
            result -= 36;
    }
    return result;
}
export function numDataCodewords(ver, ecc) {
    const e = ECC_ORDINAL[ecc];
    return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
}
// ---- Reed–Solomon over GF(2^8), primitive polynomial 0x11D ----
function rsMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
}
export function rsComputeDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
            result[j] = rsMultiply(result[j], root);
            if (j + 1 < result.length)
                result[j] = result[j] ^ result[j + 1];
        }
        root = rsMultiply(root, 0x02);
    }
    return result;
}
export function rsComputeRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => {
            result[i] = result[i] ^ rsMultiply(coef, factor);
        });
    }
    return result;
}
export function utf8Bytes(text) {
    return Array.from(new TextEncoder().encode(text));
}
/** Data codewords (mode, count, payload, terminator, padding) for byte mode. */
export function encodeDataCodewords(bytes, ver, ecc) {
    const bits = [];
    const push = (val, len) => {
        for (let i = len - 1; i >= 0; i--)
            bits.push((val >>> i) & 1);
    };
    push(0b0100, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes)
        push(b, 8);
    const capacityBits = numDataCodewords(ver, ecc) * 8;
    if (bits.length > capacityBits)
        throw new Error('QR_DATA_TOO_LONG');
    push(0, Math.min(4, capacityBits - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11)
        push(pad, 8);
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++)
            v = (v << 1) | bits[i + j];
        out.push(v);
    }
    return out;
}
export function addEccAndInterleave(data, ver, ecc) {
    const e = ECC_ORDINAL[ecc];
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const blocks = [];
    const divisor = rsComputeDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
        k += dat.length;
        const eccBytes = rsComputeRemainder(dat, divisor);
        if (i < numShortBlocks)
            dat.push(0);
        blocks.push(dat.concat(eccBytes));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
            if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
                result.push(block[i]);
        });
    }
    return result;
}
function alignmentPositions(ver, size) {
    if (ver === 1)
        return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
    return result;
}
export function formatBits(ecc, mask) {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
        rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
}
export function versionBits(ver) {
    let rem = ver;
    for (let i = 0; i < 12; i++)
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (ver << 12) | rem;
}
const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
class QrMatrix {
    ver;
    ecc;
    size;
    modules;
    isFunction;
    constructor(ver, ecc) {
        this.ver = ver;
        this.ecc = ecc;
        this.size = ver * 4 + 17;
        this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
        this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    }
    setF(x, y, dark) {
        this.modules[y][x] = dark;
        this.isFunction[y][x] = true;
    }
    drawFunctionPatterns() {
        for (let i = 0; i < this.size; i++) {
            this.setF(6, i, i % 2 === 0);
            this.setF(i, 6, i % 2 === 0);
        }
        this.drawFinder(3, 3);
        this.drawFinder(this.size - 4, 3);
        this.drawFinder(3, this.size - 4);
        const pos = alignmentPositions(this.ver, this.size);
        const n = pos.length;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))
                    continue;
                for (let dy = -2; dy <= 2; dy++)
                    for (let dx = -2; dx <= 2; dx++)
                        this.setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        }
        this.drawFormat(0);
        if (this.ver >= 7) {
            const bits = versionBits(this.ver);
            for (let i = 0; i < 18; i++) {
                const bit = getBit(bits, i);
                const a = this.size - 11 + (i % 3);
                const b = Math.floor(i / 3);
                this.setF(a, b, bit);
                this.setF(b, a, bit);
            }
        }
    }
    drawFinder(x, y) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                const xx = x + dx;
                const yy = y + dy;
                if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
                    this.setF(xx, yy, dist !== 2 && dist !== 4);
            }
        }
    }
    drawFormat(mask) {
        const bits = formatBits(this.ecc, mask);
        for (let i = 0; i <= 5; i++)
            this.setF(8, i, getBit(bits, i));
        this.setF(8, 7, getBit(bits, 6));
        this.setF(8, 8, getBit(bits, 7));
        this.setF(7, 8, getBit(bits, 8));
        for (let i = 9; i < 15; i++)
            this.setF(14 - i, 8, getBit(bits, i));
        for (let i = 0; i < 8; i++)
            this.setF(this.size - 1 - i, 8, getBit(bits, i));
        for (let i = 8; i < 15; i++)
            this.setF(8, this.size - 15 + i, getBit(bits, i));
        this.setF(8, this.size - 8, true);
    }
    drawCodewords(data) {
        let i = 0;
        for (let right = this.size - 1; right >= 1; right -= 2) {
            if (right === 6)
                right = 5;
            for (let vert = 0; vert < this.size; vert++) {
                for (let j = 0; j < 2; j++) {
                    const x = right - j;
                    const upward = ((right + 1) & 2) === 0;
                    const y = upward ? this.size - 1 - vert : vert;
                    if (!this.isFunction[y][x] && i < data.length * 8) {
                        this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                        i++;
                    }
                }
            }
        }
    }
    applyMask(mask) {
        const f = MASKS[mask];
        for (let y = 0; y < this.size; y++)
            for (let x = 0; x < this.size; x++)
                if (!this.isFunction[y][x] && f(x, y))
                    this.modules[y][x] = !this.modules[y][x];
    }
    penalty() {
        const n = this.size;
        const m = this.modules;
        let result = 0;
        const lineScore = (get) => {
            let s = 0;
            let run = 1;
            for (let i = 1; i < n; i++) {
                if (get(i) === get(i - 1))
                    run++;
                else {
                    if (run >= 5)
                        s += 3 + (run - 5);
                    run = 1;
                }
            }
            if (run >= 5)
                s += 3 + (run - 5);
            // finder-like 1:1:3:1:1 with 4 light modules on one side
            const pat = [true, false, true, true, true, false, true];
            for (let i = 0; i + 7 <= n; i++) {
                if (!pat.every((p, k) => get(i + k) === p))
                    continue;
                const before = i >= 4 && [1, 2, 3, 4].every((k) => !get(i - k));
                const after = i + 11 <= n && [7, 8, 9, 10].every((k) => !get(i + k));
                if (before || after)
                    s += 40;
            }
            return s;
        };
        for (let y = 0; y < n; y++)
            result += lineScore((i) => m[y][i]);
        for (let x = 0; x < n; x++)
            result += lineScore((i) => m[i][x]);
        for (let y = 0; y < n - 1; y++)
            for (let x = 0; x < n - 1; x++) {
                const c = m[y][x];
                if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1])
                    result += 3;
            }
        let dark = 0;
        for (const row of m)
            for (const c of row)
                if (c)
                    dark++;
        const total = n * n;
        result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
        return result;
    }
}
/** Encodes text (UTF-8, byte mode). `forceMask` is for conformance tests only. */
export function encodeQr(text, ecc = 'M', forceMask) {
    const bytes = utf8Bytes(text);
    let ver = 1;
    for (; ver <= QR_MAX_VERSION; ver++) {
        const usedBits = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
        if (usedBits <= numDataCodewords(ver, ecc) * 8)
            break;
    }
    if (ver > QR_MAX_VERSION)
        throw new Error('QR_DATA_TOO_LONG');
    const codewords = addEccAndInterleave(encodeDataCodewords(bytes, ver, ecc), ver, ecc);
    const build = (mask) => {
        const s = new QrMatrix(ver, ecc);
        s.drawFunctionPatterns();
        s.drawCodewords(codewords);
        s.applyMask(mask);
        s.drawFormat(mask);
        return s;
    };
    let bestMask = forceMask ?? 0;
    if (forceMask === undefined) {
        let best = Infinity;
        for (let mask = 0; mask < 8; mask++) {
            const p = build(mask).penalty();
            if (p < best) {
                best = p;
                bestMask = mask;
            }
        }
    }
    const s = build(bestMask);
    return { version: ver, ecc, mask: bestMask, size: s.size, modules: s.modules };
}
/** Crisp, printer-friendly SVG (one rect path, 4-module quiet zone). */
export function qrToSvg(symbol, sizeMm) {
    const border = 4;
    const dim = symbol.size + border * 2;
    let path = '';
    symbol.modules.forEach((row, y) => row.forEach((dark, x) => {
        if (dark)
            path += `M${x + border},${y + border}h1v1h-1z`;
    }));
    const sizeAttr = sizeMm ? ` width="${sizeMm}mm" height="${sizeMm}mm"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}"${sizeAttr} shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
