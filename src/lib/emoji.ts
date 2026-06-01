/** Extract a leading emoji from a title string, if present. */
export function extractLeadingEmoji(title: string): string | undefined {
  const match = title.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
  return match ? match[0] : undefined;
}
