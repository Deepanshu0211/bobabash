import type {MetadataRoute} from 'next';
import {siteUrl} from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    {url: new URL('/', base).toString(), changeFrequency: 'daily', priority: 1},
    {url: new URL('/event-rules', base).toString(), changeFrequency: 'weekly', priority: 0.8}
  ];
}
