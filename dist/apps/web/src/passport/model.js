export const isLink = (c) => typeof c === 'object' && c !== null && 'kind' in c;
export const isPill = (c) => typeof c === 'object' && c !== null && 'pill' in c;
