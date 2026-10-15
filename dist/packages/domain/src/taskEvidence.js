// KMI-003 · 003.03 — file / photo evidence for a task. Pure rules (browser pre-check + the twin of the draft migration 0090 task_evidence_add).
// The SERVER decides (type, size, signature, assignee, status, count, duplicate); this module only lets the screen refuse early with the same codes and Turkish texts.
import { MAX_DOCUMENT_BYTES, signatureMatches } from './documents.js';
export const EVIDENCE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];
export const EVIDENCE_ACCEPT = EVIDENCE_MIME.join(',');
export const MAX_EVIDENCE_FILES = 10;
export const MAX_EVIDENCE_BYTES = MAX_DOCUMENT_BYTES;
export const EVIDENCE_REFUSAL_TR = {
    FILE_REQUIRED: 'Dosya seçin.', MIME_NOT_ALLOWED: 'Bu dosya türü kanıt olarak kabul edilmez (fotoğraf JPG/PNG/WEBP, PDF veya düz metin).',
    FILE_TOO_LARGE: 'Dosya 8 MB sınırını aşıyor.', CONTENT_REQUIRED: 'Dosya boş.', CONTENT_TYPE_MISMATCH: 'Dosya içeriği türüyle uyuşmuyor.',
    TOO_MANY_FILES: `Bir göreve en fazla ${MAX_EVIDENCE_FILES} kanıt dosyası eklenir.`, DUPLICATE_CONTENT: 'Bu dosya bu göreve zaten eklenmiş.', TASK_NOT_OPEN: 'Kanıt yalnız açık / devam eden göreve eklenir.',
};
/** Browser-side pre-check (same order as the server). `mime` is the browser's claim; the signature check proves it. */
export function checkEvidenceFile(f, existingCount) {
    if (!f || !f.name.trim())
        return { ok: false, reason: 'FILE_REQUIRED' };
    if (f.size <= 0)
        return { ok: false, reason: 'CONTENT_REQUIRED' };
    if (!EVIDENCE_MIME.includes(f.mime))
        return { ok: false, reason: 'MIME_NOT_ALLOWED' };
    if (f.size > MAX_EVIDENCE_BYTES)
        return { ok: false, reason: 'FILE_TOO_LARGE' };
    if (!signatureMatches(f.mime, f.head))
        return { ok: false, reason: 'CONTENT_TYPE_MISMATCH' };
    if (existingCount >= MAX_EVIDENCE_FILES)
        return { ok: false, reason: 'TOO_MANY_FILES' };
    return { ok: true };
}
/** The text the task stores as `evidence_ref`: what the person typed, plus the attached file names. Never empty when something was given. */
export function evidenceRefText(typed, fileNames) {
    const t = typed.trim();
    const files = fileNames.map((n) => n.trim()).filter(Boolean);
    return [t, files.length ? `Dosya: ${files.join(', ')}` : ''].filter(Boolean).join(' · ');
}
/** Evidence gate for completion (the server enforces the same: ≥ 5 characters of reference). A file alone satisfies it. */
export function evidenceSatisfied(requires, typed, fileNames) {
    return !requires || evidenceRefText(typed, fileNames).length >= 5;
}
