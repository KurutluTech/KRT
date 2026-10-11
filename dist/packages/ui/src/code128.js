// KMI NEXT — dependency-free Code 128 (code set B) encoder for 1-D barcode labels read by
// keyboard-wedge / handheld laser scanners. The pattern table is cross-checked symbol by symbol
// against an independent implementation (reportlab, test/fixtures/code128-golden.json) and the
// rendered bars are decoded back with OpenCV's barcode detector when available.
// Bar/space widths for symbol values 0..106 (106 = STOP, 7 elements, 13 modules).
export const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;
export function encodeCode128B(text) {
    if (text.length === 0)
        throw new Error('CODE128_EMPTY');
    const data = [];
    for (const ch of text) {
        const c = ch.codePointAt(0);
        if (c < 32 || c > 126)
            throw new Error(`CODE128_UNSUPPORTED_CHAR:${ch}`);
        data.push(c - 32);
    }
    const checksum = data.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
    const values = [START_B, ...data, checksum, STOP];
    const widths = values.flatMap((v) => CODE128_PATTERNS[v].split('').map(Number));
    return { values, widths, modules: widths.reduce((a, b) => a + b, 0) };
}
/** SVG with a 10-module quiet zone on both sides; `heightMm`/`moduleMm` for print scaling. */
export function code128ToSvg(symbol, moduleMm = 0.25, heightMm = 10) {
    const quiet = 10;
    const total = symbol.modules + quiet * 2;
    let x = quiet;
    let path = '';
    symbol.widths.forEach((w, i) => {
        if (i % 2 === 0)
            path += `M${x},0h${w}v1h-${w}z`;
        x += w;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 1" preserveAspectRatio="none" width="${(total * moduleMm).toFixed(2)}mm" height="${heightMm}mm" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
