import { Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CURRENT_TERMS_VERSION, LEGAL_EMAIL } from '@/lib/legal';

const sectionClass = 'space-y-2';
const headingClass = 'text-[13px] font-semibold text-foreground';
const textClass = 'text-[11px] leading-[1.4] text-foreground/85';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md gradient-primary">
              <Zap className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-sm">Zyntra</span>
          </div>
        </div>
      </nav>

      <div className="container max-w-2xl py-10 space-y-6">
        <div>
          <h1 className="text-xl font-bold font-display">Terms of Service</h1>
          <p className={textClass}>Version: {CURRENT_TERMS_VERSION} · Last updated: March 2026</p>
        </div>

        {/* 1 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>1. Introduction</h2>
          <p className={textClass}>
            Welcome to Zyntra ("the Platform"), an AI-powered exam preparation service for the Australian Medical Council (AMC) examinations. By accessing or using Zyntra, you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you must not use the Platform.
          </p>
        </section>

        {/* 2 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>2. Platform Usage Rules</h2>
          <p className={textClass}>
            You must be at least 18 years old to use Zyntra. You are responsible for maintaining the confidentiality of your account credentials. Each account is for individual use only — sharing login credentials is prohibited. You agree to use the Platform solely for personal exam preparation and not for any commercial purpose.
          </p>
        </section>

        {/* 3 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>3. Intellectual Property Protection</h2>
          <p className={textClass}>
            All content on Zyntra — including but not limited to questions, explanations, OSCE scenarios, AI-generated study plans, clinical vignettes, and analytical tools — is the proprietary intellectual property of Zyntra and is protected under the Copyright Act 1968 (Cth) and applicable international copyright treaties. You are granted a limited, non-exclusive, non-transferable licence to access this content solely for personal study purposes.
          </p>
        </section>

        {/* 4 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>4. Anti-Piracy Policy</h2>
          <p className={textClass}>
            Zyntra content is protected under the Copyright Act 1968 (Cth). The following actions are strictly prohibited:
          </p>
          <ul className={`${textClass} list-disc pl-5 space-y-1`}>
            <li>Copying, reproducing, or screenshotting platform questions or explanations</li>
            <li>Redistributing OSCE cases, scenarios, or clinical content</li>
            <li>Scraping, crawling, or automated extraction of platform data</li>
            <li>Sharing account credentials with third parties</li>
            <li>Posting content to Telegram groups, recall groups, or any external platform</li>
            <li>Reselling, sublicensing, or commercially distributing Zyntra material</li>
          </ul>
          <p className={textClass}>
            Violations may result in immediate account suspension, permanent ban, and/or legal action under Australian law including claims for damages and injunctive relief.
          </p>
        </section>

        {/* 5 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>5. Three-Strike Enforcement System</h2>
          <p className={textClass}>
            Zyntra operates a graduated enforcement system for intellectual property violations:
          </p>
          <ul className={`${textClass} list-disc pl-5 space-y-1`}>
            <li><strong>Strike 1:</strong> Written warning and increased content watermarking.</li>
            <li><strong>Strike 2:</strong> Further increased watermarking and final warning.</li>
            <li><strong>Strike 3:</strong> Immediate and permanent account suspension with no refund.</li>
          </ul>
          <p className={textClass}>
            Zyntra reserves the right to bypass the graduated system and immediately suspend accounts in cases of severe or egregious violations.
          </p>
        </section>

        {/* 6 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>6. Account Suspension Policy</h2>
          <p className={textClass}>
            Zyntra may suspend or terminate your account at any time for breach of these Terms, including but not limited to intellectual property violations, fraudulent activity, or abuse of the Platform. Suspended accounts forfeit access to all content and data. Refunds are not provided for suspended accounts.
          </p>
        </section>

        {/* 7 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>7. Subscription & Billing</h2>
          <p className={textClass}>
            Zyntra offers subscription-based access. By subscribing, you authorise recurring payments. You may cancel at any time; access continues until the end of the current billing period. Zyntra reserves the right to modify pricing with reasonable notice. Refunds are provided only in accordance with Australian Consumer Law.
          </p>
        </section>

        {/* 8 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>8. Limitation of Liability</h2>
          <p className={textClass}>
            Zyntra provides educational tools and practice materials. The Platform does not guarantee exam success. To the maximum extent permitted by law, Zyntra disclaims all warranties, express or implied, and shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform. Nothing in these Terms excludes or limits liability that cannot be excluded under Australian Consumer Law.
          </p>
        </section>

        {/* 9 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>9. Governing Law</h2>
          <p className={textClass}>
            These Terms are governed by and construed in accordance with the laws of Australia. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Australia.
          </p>
        </section>

        {/* 10 */}
        <section className={sectionClass}>
          <h2 className={headingClass}>10. Piracy Reporting</h2>
          <p className={textClass}>
            If you believe Zyntra content has been copied, redistributed, or used without permission, please report it immediately.
          </p>
          <p className={textClass}>
            Email:{' '}
            <a href={`mailto:${LEGAL_EMAIL}?subject=Piracy Report`} className="text-primary underline">
              {LEGAL_EMAIL}
            </a>
          </p>
        </section>

        {/* 11 - Contact */}
        <section className={sectionClass}>
          <h2 className={headingClass}>11. Contact & Legal Notices</h2>
          <p className={textClass}>
            If you have questions regarding these Terms of Service, intellectual property rights, or copyright concerns related to Zyntra content, you may contact the platform administrator.
          </p>
          <p className={textClass}>
            Email:{' '}
            <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">
              {LEGAL_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
