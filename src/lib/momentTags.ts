// Internal/system tags that are plumbing only — never shown to the user as
// evidence labels. Keeps meaningful category tags (e.g. "thought", "study").
const HIDDEN_MOMENT_TAGS = new Set([
  'focus-session',
  'capture-note',
  'daily-reflection',
  '__recap_daily__',
]);

function isHiddenMomentTag(tag: string): boolean {
  return (
    HIDDEN_MOMENT_TAGS.has(tag) ||
    tag.startsWith('todo-session:') ||
    tag.startsWith('mood:')
  );
}

/** Meaningful category tags for a moment, used to render small "evidence" chips. */
export function getMomentDisplayTags(tags?: string[] | null): string[] {
  if (!tags) return [];
  return tags.filter(tag => !isHiddenMomentTag(tag));
}
