// Public site identity used by metadata, the sitemap, robots and structured data.
export const SITE = {
  name: 'Boba Bash Lucknow',
  shortName: 'Boba Bash',
  tagline: 'make a website, hang out with friends, get free boba!',
  description: 'Boba Bash Lucknow is a one-day Hack Club build event at Chandigarh University, Lucknow. Build a project, get reviewed by volunteers, vote for your three favourites and celebrate the winners.',
  keywords: ['Boba Bash', 'Hack Club', 'hackathon', 'Lucknow', 'Chandigarh University', 'student hackathon', 'build event', 'project voting', 'makers'],
  locale: 'en_IN'
};

/** Absolute origin for canonical URLs and share cards; falls back to localhost in development. */
export function siteUrl() {
  try { return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'); } catch { return new URL('http://localhost:3000'); }
}
