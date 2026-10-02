import { Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LEGAL_EMAIL } from '@/lib/legal';
import { SEO } from '@/components/SEO';
import { PublicFooter } from '@/components/PublicFooter';

const sectionClass = 'space-y-3';
const headingClass = 'text-base font-semibold text-foreground';
const textClass = 'text-sm leading-6 text-foreground/85';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Privacy & Data Governance Policy — Zyntra" description="How Zyntra collects, uses, protects, transfers, retains and deletes personal information." path="/privacy" />
      <nav className="border-b border-border/50 bg-background">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
          <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-md gradient-primary"><Zap className="h-3 w-3 text-primary-foreground" /></div><span className="font-display font-semibold text-sm">Zyntra</span></div>
        </div>
      </nav>
      <main className="container max-w-3xl py-12 space-y-8">
        <header><h1 className="text-3xl font-bold font-display">Privacy &amp; Data Governance Policy</h1><p className="mt-2 text-sm leading-6 text-foreground/85">Effective date: October 2026</p></header>

        <section className={sectionClass}><h2 className={headingClass}>1. Scope, Controller and Contact</h2>
          <p className={textClass}>This Policy explains how [Company Legal Entity Name] trading as Zyntra Healthcare Intelligence (“Zyntra”, “we”, “us”, “our”) processes personal information through the Platform. Depending on the applicable law and processing activity, Zyntra may act as a controller, business or APP entity, or as a processor/service provider for an Institutional / Enterprise customer. Contact: <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">{LEGAL_EMAIL}</a>.</p>
          <p className={textClass}>Applicable privacy law depends on the person, transaction and jurisdiction. Where GDPR, the Australian Privacy Act 1988 (Cth), Australian Privacy Principles, CCPA/CPRA or another mandatory regime applies, this Policy is intended to operate consistently with it and the mandatory rule prevails where there is conflict.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>2. Personal Information We Collect</h2>
          <p className={textClass}><strong>Account and profile data:</strong> name, email, authentication identifiers, country, medical education details, graduation year, exam stage, exam date and related profile information.</p>
          <p className={textClass}><strong>Learning and diagnostic data:</strong> question responses, selected answers, correctness, response time, answer changes, confidence signals, hesitation/rush indicators, session history, simulation responses, readiness and diagnostic scores, study-plan activity, bookmarks and notes.</p>
          <p className={textClass}><strong>Technical and security data:</strong> IP address, browser/device information, referring URLs, authentication/session data, security events and service logs.</p>
          <p className={textClass}><strong>Payment data:</strong> payment tokens and transaction metadata supplied by PCI-DSS compliant payment processors. Zyntra does not intentionally store full payment-card numbers.</p>
          <p className={textClass}><strong>Support and communications:</strong> messages, support requests, feedback and preference information.</p>
          <p className={textClass}><strong>Voice practice:</strong> where browser-native speech functionality is used, speech processing may occur locally in the browser. Unless the feature explicitly states otherwise, Zyntra does not store raw microphone recordings.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>3. Prohibited Patient Information and Medical Data Governance</h2>
          <p className={textClass}>The Platform is not designed to receive, store or process real patient records. Do not upload PHI, medical records, identifiable patient histories, photographs, hospital documents or other live-patient information. Where educational datasets are permitted, they must be synthetic, lawfully obtained and appropriately de-identified. Zyntra may reject, quarantine, restrict or delete data that appears to contain prohibited patient information, subject to applicable law and contractual obligations.</p>
          <p className={textClass}>Zyntra does not represent that its Platform is a HIPAA-covered service or business associate. Users and organisations must not use the Platform to process regulated patient information unless Zyntra has expressly agreed in a separate written arrangement and all required safeguards are in place.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>4. Purposes and Lawful Bases</h2>
          <p className={textClass}>We process personal information to provide and secure the Platform; authenticate accounts; record learning activity; calculate performance and behavioural signals; generate personalised study plans; maintain diagnostics; process payments; provide support and communications; prevent fraud, piracy and abuse; improve service quality; and comply with legal obligations.</p>
          <p className={textClass}>Where GDPR applies, processing may rely on contract, consent, legitimate interests, legal obligations or another lawful basis appropriate to the specific activity. Where consent is the basis, withdrawal does not affect processing lawfully completed before withdrawal.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>5. AI and Large Language Model Processing</h2>
          <p className={textClass}>Zyntra may use third-party AI compute and model providers to generate educational content, analyse learning signals and operate features. We apply contractual and technical controls intended to segregate customer/user data from provider training pipelines. Unless expressly disclosed and agreed otherwise, user prompts, responses and enterprise/customer data supplied for Zyntra services are not used by external foundational-model providers to train their general-purpose models.</p>
          <p className={textClass}>AI providers may process submitted data only as necessary to provide contracted services, maintain security, comply with law and apply their documented service controls. Current providers may include [AI Provider Name(s)]. Provider lists may change; material changes will be reflected in this Policy where required.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>6. Service Providers and Disclosures</h2>
          <p className={textClass}>We may disclose limited information to hosting/infrastructure providers, authentication services, payment processors such as Razorpay and/or Stripe, communications providers, analytics/security providers and AI compute providers. We may also disclose information where necessary to comply with law, protect rights or safety, investigate fraud or security incidents, enforce agreements, or support a corporate transaction.</p>
          <p className={textClass}>We do not sell personal information for monetary consideration. Where a jurisdiction treats certain advertising or analytics practices as “sale” or “sharing”, Zyntra will apply the relevant rights and controls required by law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>7. International Transfers</h2>
          <p className={textClass}>Personal information may be processed in countries outside the country where you reside. Where GDPR applies, transfers outside the EEA will use an applicable adequacy mechanism, Standard Contractual Clauses or another lawful transfer mechanism, together with supplementary safeguards where required. For Australian users, Zyntra will take reasonable steps required by APP 8 for overseas disclosures and will identify overseas recipients where required by applicable law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>8. Security</h2>
          <p className={textClass}>Zyntra uses reasonable technical and organisational safeguards appropriate to the risks, including encryption at rest targeted at AES-256 or equivalent, TLS 1.3 or current industry-standard transport encryption where supported, access controls, row-level database security where applicable, authentication protections, logging, backups and security monitoring. No online service can guarantee absolute security.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>9. Retention</h2>
          <p className={textClass}>We retain personal information only for as long as reasonably necessary for the purposes described in this Policy, contractual administration, legitimate business needs, security, dispute handling and legal obligations. Unless a longer period is required by law or a contractual arrangement, inactive accounts and associated personal information may be deleted or anonymised after [24 months] of inactivity. Transaction and legal records may be retained for the period required by applicable law. Aggregated, appropriately de-identified information may be retained longer where it no longer identifies an individual.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>10. Your Rights</h2>
          <p className={textClass}>Subject to applicable law and legitimate exceptions, you may request access, correction, deletion, portability and information about processing; withdraw consent where consent is the legal basis; object to or restrict certain processing; and lodge a complaint with the competent privacy regulator. California residents may have additional CCPA/CPRA rights, including rights relating to sensitive personal information and certain disclosures, subject to applicable thresholds and exceptions.</p>
          <p className={textClass}>To exercise rights, contact <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">{LEGAL_EMAIL}</a>. We may verify identity before completing a request. We will respond within the time required by applicable law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>11. Cookies, Local Storage and Telemetry</h2>
          <p className={textClass}>Zyntra may use essential cookies and browser storage for authentication, security, theme preferences, session continuity and feature operation. Product telemetry may record interaction and performance events necessary to operate analytics and improve the Platform. Where consent is legally required for non-essential cookies or tracking, Zyntra will obtain it before such processing.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>12. Automated Profiling</h2>
          <p className={textClass}>Zyntra may generate behavioural and performance profiles from learning activity. These profiles are designed to personalise educational content and identify training patterns. They are not intended to make decisions about medical fitness, professional licensure, employment eligibility or access to healthcare.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>13. Data Breaches</h2>
          <p className={textClass}>Zyntra maintains incident-response procedures. Where a breach triggers a legal notification obligation, Zyntra will notify affected individuals, customers and/or regulators within the period required by applicable law. Where no fixed statutory period applies, we will act without undue delay after determining that notification is required. We will not promise a universal “72-hour” deadline because notification rules differ by jurisdiction and breach type.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>14. Children</h2>
          <p className={textClass}>The Platform is intended for adults and is not knowingly directed to children. If applicable law imposes a different age or consent standard, Zyntra will follow that mandatory standard.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>15. Policy Changes</h2>
          <p className={textClass}>We may update this Policy for legal, regulatory, security, product or operational reasons. Material changes will be communicated through the Platform or by email where required. The effective date will be updated when changes become effective.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>16. Contact and Complaints</h2>
          <p className={textClass}>Privacy requests and complaints may be sent to <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">{LEGAL_EMAIL}</a>. Depending on your location, you may also complain to your applicable supervisory or privacy authority, including the OAIC in Australia or the relevant EU supervisory authority.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
