import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { sitemapPaths, MAX_PRERENDER_PAGES } from '../../scripts/seo-prerender-plugin';

describe('public prerender boundaries', () => {
  it('refuses external origins', () => {
    expect(() => sitemapPaths('<loc>https://example.com/admin</loc>')).toThrow();
  });
  it('caps emitted pages below hosting limits', () => {
    const xml = Array.from({ length: MAX_PRERENDER_PAGES + 1 }, (_, i) => `<loc>https://www.zyntrahealthcareintelligence.com/page-${i}</loc>`).join('');
    expect(() => sitemapPaths(xml)).toThrow();
  });
  it('emits unique complete HTML for every existing indexable route, excluding private routes', async () => {
    const routes = sitemapPaths(readFileSync('public/sitemap.xml', 'utf8'));
    expect(routes).not.toContain('/practice');
    expect(routes).not.toContain('/admin');
    // A clean Node process proves rendering works without jsdom/browser globals.
    const output = execFileSync('node', ['--import', 'tsx', '--input-type=module', '-e', `
      import {readFileSync} from 'node:fs';
      import {seoPrerender} from './scripts/seo-prerender-plugin.ts';
      const index={type:'asset',fileName:'index.html',source:readFileSync('index.html','utf8')};
      const emitted=[];
      await seoPrerender().generateBundle.call({emitFile:a=>emitted.push(a),info:()=>{}},{},{'index.html':index},false);
      console.log('SEO_RESULT:'+JSON.stringify({index,emitted}));
    `], { encoding: 'utf8', timeout: 110_000, maxBuffer: 8_000_000 });
    const result = output.split('\n').find((line) => line.startsWith('SEO_RESULT:'));
    if (!result) throw new Error('Prerender result missing');
    const { index, emitted } = JSON.parse(result.slice('SEO_RESULT:'.length)) as { index: { source: string }; emitted: { fileName: string; source: string }[] };
    const headings = new Set<string>();
    for (const route of routes) {
      const html = route === '/' ? String(index.source) : emitted.find((asset) => asset.fileName === `${route.slice(1)}/index.html`)?.source;
      expect(html, route).toBeDefined();
      const h1 = html?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
      expect(h1, route).toBeTruthy();
      headings.add(h1 ?? '');
      expect(html).toContain(`href="https://www.zyntrahealthcareintelligence.com${route}"`);
      expect(html?.match(/<title\b/g)).toHaveLength(1);
      expect(html).not.toContain('id="crawler-shell"');
      expect(html).toContain('src="/src/main.tsx"');
    }
    expect(headings.size).toBe(routes.length);
    expect(emitted).toHaveLength(routes.length);
  }, 120_000);
});