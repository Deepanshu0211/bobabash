import type {MetadataRoute} from 'next';
import {siteUrl} from '@/lib/site';

// Public pages are indexable; the signed-in portal, admin desk and API are not.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{
      userAgent: '*',
      allow: ['/', '/event-rules'],
      disallow: ['/api/', '/admin', '/dashboard', '/projects', '/submission', '/voting', '/results', '/reviewer', '/auth', '/login']
    }],
    sitemap: new URL('/sitemap.xml', base).toString(),
    host: base.origin
  };
}
