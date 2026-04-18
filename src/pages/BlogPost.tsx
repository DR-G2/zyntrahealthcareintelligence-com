import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LegalFooter } from '@/components/LegalFooter';
import { getPostBySlug, getAllPosts } from '@/content/blog/posts';

const SITE_URL = 'https://zyntrahealthcareintelligence.com';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const allPosts = getAllPosts();
  const related = allPosts.filter(p => p.slug !== slug).slice(0, 3);

  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} | Zyntra`;

    const upsertMeta = (selector: string, attr: string, value: string, create?: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el && create) { el = create(); document.head.appendChild(el); }
      if (el) el.setAttribute(attr, value);
    };

    upsertMeta('meta[name="description"]', 'content', post.description, () => {
      const m = document.createElement('meta'); m.setAttribute('name', 'description'); return m;
    });
    upsertMeta('meta[name="keywords"]', 'content', post.keywords.join(', '), () => {
      const m = document.createElement('meta'); m.setAttribute('name', 'keywords'); return m;
    });
    upsertMeta('link[rel="canonical"]', 'href', `${SITE_URL}/blog/${post.slug}`, () => {
      const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l;
    });
    upsertMeta('meta[property="og:title"]', 'content', post.title, () => {
      const m = document.createElement('meta'); m.setAttribute('property', 'og:title'); return m;
    });
    upsertMeta('meta[property="og:description"]', 'content', post.description, () => {
      const m = document.createElement('meta'); m.setAttribute('property', 'og:description'); return m;
    });
    upsertMeta('meta[property="og:type"]', 'content', 'article', () => {
      const m = document.createElement('meta'); m.setAttribute('property', 'og:type'); return m;
    });
    upsertMeta('meta[property="og:url"]', 'content', `${SITE_URL}/blog/${post.slug}`, () => {
      const m = document.createElement('meta'); m.setAttribute('property', 'og:url'); return m;
    });

    // Article JSON-LD
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: { '@type': 'Organization', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: 'Zyntra Healthcare Intelligence',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
      keywords: post.keywords.join(', '),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'post-jsonld';
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => { document.getElementById('post-jsonld')?.remove(); };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container max-w-3xl py-12 flex-1">
        <Button variant="ghost" asChild className="mb-6 gap-2">
          <Link to="/blog"><ArrowLeft className="h-4 w-4" /> All articles</Link>
        </Button>

        <article>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary">{post.category}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {post.readTime}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(post.publishedAt).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold font-display mb-4 tracking-tight leading-tight">{post.title}</h1>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed">{post.description}</p>

          <div
            className="prose prose-sm sm:prose-base dark:prose-invert max-w-none
                       prose-headings:font-display prose-headings:tracking-tight
                       prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                       prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
                       prose-p:leading-relaxed prose-li:leading-relaxed
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                       prose-strong:text-foreground
                       prose-table:text-sm prose-th:bg-muted prose-th:px-3 prose-th:py-2
                       prose-td:px-3 prose-td:py-2 prose-td:border-border
                       [&_.lead]:text-base [&_.lead]:text-muted-foreground [&_.lead]:leading-relaxed [&_.lead]:mb-8"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        {related.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border">
            <h2 className="text-xl font-bold font-display mb-6">Continue reading</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map(r => (
                <Link
                  key={r.slug}
                  to={`/blog/${r.slug}`}
                  className="group rounded-lg border border-border p-4 hover:border-primary/40 transition-colors"
                >
                  <Badge variant="secondary" className="mb-2">{r.category}</Badge>
                  <h3 className="font-display font-semibold text-sm mb-2 group-hover:text-primary transition-colors leading-snug">
                    {r.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    Read <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <LegalFooter />
    </div>
  );
}
