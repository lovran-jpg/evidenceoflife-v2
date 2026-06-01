/**
 * Lightly tidy a task title without changing the user's words.
 *
 * This is intentionally conservative: it only fixes formatting noise
 * (surrounding/duplicate whitespace) and capitalizes the very first letter.
 * It never rewrites, translates, reorders, or merges words — the list must
 * still reflect what the user actually typed.
 */
export function tidyTaskTitle(raw: string): string {
  if (typeof raw !== 'string') return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  // Capitalize the first character only when it's a lowercase ASCII letter,
  // so CJK, emoji, numbers and already-capitalized input are left untouched.
  const first = collapsed[0];
  if (first >= 'a' && first <= 'z') {
    return first.toUpperCase() + collapsed.slice(1);
  }
  return collapsed;
}
