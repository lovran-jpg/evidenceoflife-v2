const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatCroatianDate(dateKey: string): string {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return dateKey;

  const [, year, month, day] = match;
  return `${Number(day)}. ${Number(month)}. ${year}.`;
}
