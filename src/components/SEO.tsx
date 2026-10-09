import { Helmet } from 'react-helmet-async';

function getSiteUrl() {
  if (typeof window === 'undefined') return 'https://www.zyntrahealthcareintelligence.org';
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'zyntrahealthcareintelligence.com' || hostname === 'www.zyntrahealthcareintelligence.com') {
    return 'https://www.zyntrahealthcareintelligence.com';
  }
  // The .org domain is the production launch target. Preview deployments should
  // advertise the production URL rather than their temporary vercel.app hostname.
  return 'https://www.zyntrahealthcareintelligence.org';
}

interface SEOProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

export function SEO({ title, description, path, jsonLd, noindex }: SEOProps) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}${path === '/' ? '/' : path}`;
  const ogImage = `${siteUrl}/og.png`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content="Zyntra Healthcare Intelligence" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
