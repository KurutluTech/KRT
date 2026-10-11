export const OLD_KMI_DEPARTMENT_MAP = {
    'üretim': 'URETIM', 'kalite': 'KALITE', 'cam': 'CAM', 'bakım': 'BAKIM', 'mutfak': 'ASCI',
    'yönetim': 'OFIS', 'muhasebe': 'OFIS', 'satınalma': 'OFIS', 'sevkiyat': 'OFIS',
};
export const OLD_KMI_ROLE_MAP = {
    OPERATOR: 'OPERATOR', KALITE: 'QUALITY', BAKIM: 'MAINTENANCE', CAM: 'CAM', MUHASEBE: 'ACCOUNTING', SEVKIYAT: 'SHIPPING', ADMIN: 'ADMIN',
};
export const mapOldDepartment = (name) => name === null ? null : OLD_KMI_DEPARTMENT_MAP[name.trim().toLocaleLowerCase('tr-TR')] ?? null;
export const mapOldRoles = (legacy) => [...new Set(legacy.map((r) => OLD_KMI_ROLE_MAP[r.trim().toUpperCase()]).filter((r) => r !== undefined))].sort();
/** Same order as kmi_next.stage_personnel_import. */
export function importRowStatus(p, ctx) {
    const dep = mapOldDepartment(p.department);
    const roles = mapOldRoles(p.legacyRoles);
    const issues = [
        p.department === null ? 'SOURCE_HAS_NO_DEPARTMENT' : dep === null ? `DEPARTMENT_NOT_MAPPED:${p.department}` : null,
        roles.length === 0 ? `NO_MAPPABLE_ROLE:${p.legacyRoles.length ? [...p.legacyRoles].sort().join('+') : '-'}` : null,
        ctx.loginUsedByAnother ? 'AUTH_LINK_ALREADY_USED_IN_KMI_NEXT' : null,
        p.authUserId === null ? 'NO_LOGIN_IN_SOURCE' : null,
    ].filter((x) => x !== null);
    const status = ctx.alreadyImported ? 'ALREADY_IMPORTED' : !p.active ? 'INACTIVE_IN_SOURCE'
        : dep === null || roles.length === 0 || ctx.loginUsedByAnother ? 'NEEDS_DECISION' : 'NEW';
    return { status, issues };
}
export const IMPORT_ISSUE_TR = {
    SOURCE_HAS_NO_DEPARTMENT: 'Kaynakta bölüm yok — bölüm seçin',
    DEPARTMENT_NOT_MAPPED: 'Bölüm adı eşleşmiyor — bölüm seçin',
    NO_MAPPABLE_ROLE: 'Eski rolü KMI rolüne karşılık gelmiyor — rol seçin',
    AUTH_LINK_ALREADY_USED_IN_KMI_NEXT: 'Bu giriş hesabı KMI\'de başka bir kişiye bağlı',
    NO_LOGIN_IN_SOURCE: 'Giriş hesabı yok (kayıt aktarılır, giriş yapamaz)',
};
export const issueText = (code) => {
    const [k, rest] = code.split(/:(.*)/s);
    const base = IMPORT_ISSUE_TR[k ?? code] ?? code;
    return rest ? `${base} (${rest})` : base;
};
