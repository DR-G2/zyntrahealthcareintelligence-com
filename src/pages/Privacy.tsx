import { Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LEGAL_EMAIL } from '@/lib/legal';

const sectionClass = 'space-y-2';
const headingClass = 'text-[13px] font-semibold text-foreground';
const textClass = 'text-[11px] leading-[1.4] text-foreground/85';

export default function Privacy() {
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
          <h1 className="text-xl font-bold font-display">Privacy Policy</h1>
          <p className={textClass}>Last updated: March 2026</p>
        </div>

        <section className={sectionClass}>
          <h2 className={headingClass}>1. Introduction</h2>
          <p className={textClass}>
            Zyntra ("we", "our", "the Platform") is committed to protecting your personal information in accordance with the Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth) and applicable international privacy laws including the General Data Protection Regulation (GDPR). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>2. Information We Collect</h2>
          <p className={textClass}><strong>Personal Information:</strong> Name, email address, country of origin, country of graduation, medical college, graduation year, AMC candidate ID, exam stage, exam date, and exam location.</p>
          <p className={textClass}><strong>Usage Data:</strong> Practice session data, question responses, answer change patterns, time-per-question metrics, hesitation signals, composure and behavioral analytics, OSCE performance data, and study plan progress.</p>
          <p className={textClass}><strong>Payment Information:</strong> Payment details are processed securely by our third-party payment processor (Razorpay). We do not store full card numbers on our servers.</p>
          <p className={textClass}><strong>Technical Data:</strong> IP address, browser type, device information, referring URLs, and session cookies for authentication and security purposes.</p>
          <p className={textClass}><strong>Voice Data:</strong> If you use Voice Practice mode, audio is processed locally in your browser using the Web Speech API. No audio recordings are transmitted to or stored on our servers.</p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>3. How We Use Your Information</h2>
          <ul className={`${textClass} list-disc pl-5 space-y-1`}>
            <li>To provide, maintain, and improve the Platform and its features</li>
            <li>To generate personalized study plans, performance profiles, and behavioral analytics</li>
            <li>To power the Adaptive Performance & Preparation Engine (APPE)</li>
            <li>To process payments and manage subscriptions</li>
            <li>To communicate with you regarding your account, updates, and support</li>
            <li>To enforce our Terms of Service and anti-piracy policies</li>
            <li>To generate aggregate, de-identified analytics to improve question quality and AI training</li>
            <li>To detect and prevent fraud, abuse, and unauthorized access</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>4. Third-Party Sharing</h2>
          <p className={textClass}>We do not sell your personal information. We may share limited data with:</p>
          <ul className={`${textClass} list-disc pl-5 space-y-1`}>
            <li><strong>Payment Processor (Razorpay):</strong> To process subscription payments securely</li>
            <li><strong>Cloud Infrastructure:</strong> Our platform is hosted on secure cloud infrastructure with data encrypted at rest and in transit</li>
            <li><strong>AI Services:</strong> De-identified question and performance data may be used to improve AI-generated content quality. No personally identifiable information is shared with AI model providers.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by Australian law, court order, or regulatory request</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>5. Data Security</h2>
          <p className={textClass}>
            We implement industry-standard security measures including encrypted data transmission (TLS/SSL), secure authentication with session management, row-level security policies on all database tables, and regular security audits. Content is protected with dynamic watermarking technology tied to individual user accounts.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>6. Data Retention</h2>
          <p className={textClass}>
            We retain your personal information for as long as your account is active or as needed to provide you with our services. If you request account deletion, we will delete your personal data within 30 days, except where retention is required by law or for legitimate business purposes (e.g., fraud prevention, legal compliance). Aggregate, de-identified analytics data may be retained indefinitely.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>7. Your Privacy Rights</h2>
          <p className={textClass}>Under Australian Privacy Principles and applicable international privacy laws, you have the right to:</p>
          <ul className={`${textClass} list-disc pl-5 space-y-1`}>
            <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete personal information</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data (subject to legal retention requirements)</li>
            <li><strong>Data Portability:</strong> Export your learning data, performance history, and study progress via the Platform's data export feature</li>
            <li><strong>Withdraw Consent:</strong> Where processing is based on consent, you may withdraw consent at any time</li>
            <li><strong>Complaint:</strong> Lodge a complaint with the Office of the Australian Information Commissioner (OAIC) if you believe your privacy has been breached</li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>8. Cookies & Local Storage</h2>
          <p className={textClass}>
            Zyntra uses essential cookies and browser local storage for authentication session management, theme preferences, and exam session state persistence. We do not use third-party tracking cookies or advertising cookies. No personal data is shared with advertising networks.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>9. Children's Privacy</h2>
          <p className={textClass}>
            Zyntra is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that we have collected information from a person under 18, we will take steps to delete that information promptly.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>10. Changes to This Policy</h2>
          <p className={textClass}>
            We may update this Privacy Policy from time to time. Material changes will be communicated via email or an in-app notification. Continued use of the Platform after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>11. Contact</h2>
          <p className={textClass}>
            If you have questions about this Privacy Policy or wish to exercise your privacy rights, please contact us:
          </p>
          <p className={textClass}>
            Email:{' '}
            <a href={`mailto:${LEGAL_EMAIL}?subject=Privacy Inquiry`} className="text-primary underline">
              {LEGAL_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
