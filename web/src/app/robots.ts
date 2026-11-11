import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api/',
        '/account',
        '/my-bookings',
        '/notifications',
        '/book',
        '/uploads/_',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
