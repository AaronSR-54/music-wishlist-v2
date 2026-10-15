type RelativeDateTranslations = {
  justNow: string;
  yesterday: string;
  hoursAgo: string;
};

export function formatRelativeDate(
  date: Date | string | number,
  t: RelativeDateTranslations,
  locale: 'es' | 'en' = 'en',
): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) {
    return diffHours === 0
      ? t.justNow
      : t.hoursAgo.replace('{h}', String(diffHours));
  }

  if (diffDays === 1) {
    return t.yesterday;
  }

  const month = d.toLocaleString(locale, { month: 'short' });
  const day = d.getDate();
  return `${day} ${month}`;
}
