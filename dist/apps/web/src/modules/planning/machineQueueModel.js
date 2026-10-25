// Pure view-model helpers (no DOM, no network): reorder moves + reason gating for the queue UI.
export function moveItem(ids, from, to) {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids.slice();
  const a = ids.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a;
}
export const changed = (before, after) => before.length !== after.length || before.some((v, i) => v !== after[i]);
export const canSubmit = ({ canReorder, before, after, reason }) => !!canReorder && changed(before, after) && String(reason ?? '').trim().length >= 3;
