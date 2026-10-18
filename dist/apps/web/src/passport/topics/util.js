export const ymNow = (iso) => iso.slice(0, 7);
export const pctOf = (v) => (v === null || v === undefined ? null : `% ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(v * 100)}`);
