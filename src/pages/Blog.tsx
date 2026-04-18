import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LegalFooter } from '@/components/LegalFooter';
import { getAllPosts } from '@/content/blog/posts';

const SITE_URL = 'https://zyntrahealthcareintelligence.com';

export default function Blog() {
  const posts = getAllPosts();

  useEffect(() => {
    document.title = 'AMC Exam Prep Blog — IMG Guides, MCQ Strategy & AHPRA Pathway | Zyntra';

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        if (selector.startsWith('link')) {
          el = document.createElement('link');
          (el as HTMLLinkElement).rel = 'canonical';
        } else {
          el = document.createElement('meta');
          const name = selector.match(/\[(name|property)="([^"]+)"\]/);
          if (name) (el as HTMLMetaElement).setAttribute(name[1], name[2]);
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', 'In-depth guides for IMGs preparing for the AMC exam: MCQ pass marks, study plans, AHPRA registration, Australian internship strategy, and OSCE preparation.');
    setMeta('link[rel="canonical"]', 'href', `${SITE_URL}/blog`);

    // Blog-listing JSON-LD
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Zyntra AMC Prep Blog',
      url: `${SITE_URL}/blog`,
      blogPost: posts.map(p => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description,
        datePublished: p.publishedAt,
        dateModified: p.updatedAt,
        author: { '@type': 'Organization', name: p.author },
        url: `${SITE_URL}/blog/${p.slug}`,
      })),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'blog-list-jsonld';
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => { document.getElementById('blog-list-jsonld')?.remove(); };
  }, [posts]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container max-w-5xl py-16 flex-1">
        <Button variant="ghost" asChild className="mb-8 gap-2">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Home</Link>
        </Button>

        <header className="mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold font-display mb-4 tracking-tight">AMC Exam Preparation Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            In-depth guides for IMGs — AMC MCQ strategy, OSCE preparation, AHPRA registration, and the Australian internship pathway. Written by clinicians, updated for 2026.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {posts.map(post => (
            <Card key={post.slug} className="flex flex-col hover:border-primary/40 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{post.category}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {post.readTime}
                  </span>
                </div>
                <CardTitle className="text-xl leading-snug font-display">
                  <Link to={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
                    {post.title}
                  </Link>
                </CardTitle>
                <CardDescription className="leading-relaxed">{post.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(post.publishedAt).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <Link to={`/blog/${post.slug}`} className="text-primary hover:underline font-medium">Read →</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
