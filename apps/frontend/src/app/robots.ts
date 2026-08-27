import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/auth', '/auth/login', '/open-source-notices'],
      disallow: ['/', '/settings', '/launches', '/analytics', '/media', '/agents'],
    },
    sitemap: 'https://social.codestra.co/sitemap.xml',
  };
}
