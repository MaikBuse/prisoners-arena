import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://prisoners-arena.com';
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'always', priority: 1 },
    { url: `${base}/participate`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/history`, lastModified: new Date(), changeFrequency: 'always', priority: 0.8 },
  ];
}
