import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const MAX_PRERENDER_PAGES = 64;
export const SITE = 'https://www.zyntrahealthcareintelligence.com';

export function sitemapPaths(xml: string): string[] {
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    const url = new URL(match[1]);
    if (url.origin !== SITE || url.search || url.hash || !/^\/(?:[a-z0-9-]+\/?)*$/.test(url.pathname)) {
      throw new Error('Invalid prerender URL in sitemap');
    }
    return url.pathname;
  });
  if (!paths.length || paths.length > MAX_PRERENDER_PAGES || new Set(paths).size !== paths.length) {
    throw new Error('Invalid or oversized prerender route set');
  }
  return paths;
}

/** Render the actual public React pages, never an authenticated application or a browser snapshot. */
export function seoPrerender(): Plugin {
  return {
    name: 'zyntra-public-prerender',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const { createServer } = await import('vite');
      const { default: react } = await import('@vitejs/plugin-react-swc');
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') throw new Error('Build HTML unavailable');
      const template = String(index.source);
      const routes = sitemapPaths(readFileSync('public/sitemap.xml', 'utf8'));
      // Keep wrapper metadata aligned with the existing router rather than inventing another catalogue.
      const appSource = readFileSync('src/App.tsx', 'utf8');
      const metadata = Object.fromEntries([...appSource.matchAll(/<SEO title="([^"]+)" description="([^"]+)" path="([^"]+)"/g)]
        .map((match) => [match[3], { title: match[1], description: match[2] }]));
      const server = await createServer({
        configFile: false, plugins: [react()],
        resolve: { alias: { '@': path.resolve('src') } },
        server: { middlewareMode: true, watch: null }, appType: 'custom',
      });
      try {
        const renderer = await server.ssrLoadModule('/src/seo/prerender.tsx');
        for (const route of routes) {
          const { body, head } = renderer.renderPublicPage(route, metadata[route]);
          if (!body.includes('<h1') || !head.includes('rel="canonical"')) {
            throw new Error(`Incomplete public prerender: ${route}`);
          }
          const html = template
            .replace(/<title>[\s\S]*?<\/title>/g, '')
            .replace(/<meta\b[^>]*(?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g, '')
            .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '')
            .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
            .replace('</head>', `${head}</head>`)
            .replace(/<div id="root">[\s\S]*?<script type="module"/, `<div id="root">${body}</div>\n    <script type="module"`);
          if (route === '/') index.source = html;
          else this.emitFile({ type: 'asset', fileName: `${route.slice(1)}/index.html`, source: html });
        }
        this.emitFile({ type: 'asset', fileName: 'prerender-manifest.json', source: JSON.stringify({ routes, maxPages: MAX_PRERENDER_PAGES }) });
        this.info(`Prerendered ${routes.length} public pages without authentication or network reads`);
      } finally {
        await server.close();
      }
    },
  };
}