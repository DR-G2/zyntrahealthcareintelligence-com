import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import Home from '@/pages/Home';
import Features from '@/pages/Features';
import About from '@/pages/About';
import FAQ from '@/pages/FAQ';
import HowItWorks from '@/pages/HowItWorks';
import Pricing from '@/pages/PublicPricing';
import AmcPart1Mcq from '@/pages/AmcPart1Mcq';
import AmcClinicalOsce from '@/pages/AmcClinicalOsce';
import AmcExamPreparation from '@/pages/AmcExamPreparation';
import AmcPreparationForImgs from '@/pages/AmcPreparationForImgs';
import Blog from '@/pages/Blog';
import BlogArticle from '@/pages/BlogArticle';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';

export function renderPublicPage(route: string, metadata?: { title: string; description: string }) {
  const context: { helmet?: { title: { toString(): string }; meta: { toString(): string }; link: { toString(): string }; script: { toString(): string } } } = {};
  const body = renderToString(
    <HelmetProvider context={context}>
      <MemoryRouter initialEntries={[route]}>
        {metadata && <SEO {...metadata} path={route} />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/amc-part-1-mcq" element={<AmcPart1Mcq />} />
          <Route path="/amc-clinical-osce" element={<AmcClinicalOsce />} />
          <Route path="/amc-exam-preparation" element={<AmcExamPreparation />} />
          <Route path="/amc-preparation-for-imgs" element={<AmcPreparationForImgs />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogArticle />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
  const helmet = context.helmet;
  if (!helmet) throw new Error(`Missing metadata for ${route}`);
  return { body, head: helmet.title.toString() + helmet.meta.toString() + helmet.link.toString() + helmet.script.toString() };
}