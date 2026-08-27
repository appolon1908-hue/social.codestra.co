import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://social.codestra.co/auth',
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://social.codestra.co/auth/login',
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://social.codestra.co/open-source-notices',
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
