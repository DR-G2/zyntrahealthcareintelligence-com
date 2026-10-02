import { Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CURRENT_TERMS_VERSION, LEGAL_EMAIL } from '@/lib/legal';
import { SEO } from '@/components/SEO';
import { PublicFooter } from '@/components/PublicFooter';

const sectionClass = 'space-y-3';
const headingClass = 'text-base font-semibold text-foreground';
const textClass = 'text-sm leading-6 text-foreground/85';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <SEO title="Terms of Service — Zyntra" description="Terms governing use of the Zyntra Healthcare Intelligence educational SaaS platform." path="/terms" />
      <nav className="border-b border-border/50 bg-background">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
          <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-md gradient-primary"><Zap className="h-3 w-3 text-primary-foreground" /></div><span className="font-display font-semibold text-sm">Zyntra</span></div>
        </div>
      </nav>
      <main className="container max-w-3xl py-12 space-y-8">
        <header><h1 className="text-3xl font-bold font-display">Terms of Service</h1><p className="mt-2 text-sm leading-6 text-foreground/85">Version: {CURRENT_TERMS_VERSION} · Effective date: October 2026</p></header>

        <section className={sectionClass}><h2 className={headingClass}>1. Agreement and Definitions</h2>
          <p className={textClass}>These Terms of Service (the “Terms”) are a binding agreement between you (“you”, “your” or “User”) and [Company Legal Entity Name] trading as Zyntra Healthcare Intelligence (“Zyntra”, “we”, “us” or “our”). “Platform” means Zyntra websites, applications, software, APIs, databases and related services. “Authorized User” means an individual authorised to use a subscription. “Proprietary Content” means Zyntra questions, explanations, simulations, prompts, scoring systems, models, interfaces, documentation, analytics and datasets. “Simulated Outputs” means AI-generated or algorithmically generated questions, scenarios, feedback, recommendations, scores or other outputs.</p>
          <p className={textClass}>By creating an account, purchasing a subscription, clicking acceptance or accessing the Platform, you agree to these Terms and the Privacy &amp; Data Governance Policy. If you do not agree, do not use the Platform. Organisational users represent that they have authority to bind the relevant organisation.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>2. Educational Purpose; No Medical Advice or Clinical Relationship</h2>
          <p className={textClass}>Zyntra is an educational and examination-preparation service. It does not provide medical advice, diagnosis, treatment, triage, prescribing, patient-specific clinical recommendations or patient care. Platform materials are educational simulations and training tools only. Use of the Platform creates no doctor-patient, clinician-patient, fiduciary, employment or professional relationship with Zyntra.</p>
          <p className={textClass}>You must not rely on Platform content or Simulated Outputs as a substitute for professional judgement, supervision, local law, institutional protocols, official examination materials or advice from a qualified professional. Do not upload live-patient information or Protected Health Information (“PHI”).</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>3. Examination, Accreditation and Employment Disclaimer</h2>
          <p className={textClass}>Zyntra does not warrant or guarantee that use of the Platform will result in passing AMC, USMLE, PLAB, NMC or any other licensing, registration, accreditation or qualifying examination. Zyntra does not guarantee scores, rank, registration, internship placement, employment, visa outcomes, promotion or other professional outcomes. Examination formats and eligibility requirements may change independently of Zyntra. Third-party examination names are descriptive only and do not imply affiliation or endorsement.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>4. Accounts and Security</h2>
          <p className={textClass}>You must provide accurate registration information, maintain credential confidentiality and promptly report unauthorised access. Accounts are personal unless an Institutional / Enterprise agreement expressly provides otherwise. Credential sharing, account lending, resale and circumvention of seat controls are prohibited.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>5. Acceptable Use and Anti-Extraction Controls</h2>
          <p className={textClass}>You must not reverse engineer, decompile, disassemble or attempt to derive source code, model weights or proprietary logic; scrape, crawl, spider, bulk-download or automate extraction; bypass access controls, rate limits, paywalls, watermarking or security measures; use prompt injection, model extraction, jailbreaks or adversarial techniques to obtain restricted Proprietary Content; reproduce, publish, distribute, sell, sublicense or commercially exploit Proprietary Content; use Zyntra data to train, fine-tune, benchmark or evaluate a downstream machine-learning or generative-AI model except with Zyntra’s written authorisation; falsely represent Zyntra material as official examination content; or use the Platform to build or improve a competing service.</p>
          <p className={textClass}>Nothing in this section removes a right that applicable law expressly protects, including a legally mandated interoperability or security-research exception.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>6. Intellectual Property</h2>
          <p className={textClass}>Zyntra and its licensors retain all right, title and interest in the Platform and Proprietary Content. Except for the limited, revocable, non-exclusive, non-transferable licence to use the Platform during an applicable subscription term, no rights are granted. Feedback may be used by Zyntra to improve the Platform, subject to applicable privacy law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>7. AI and Simulated Outputs</h2>
          <p className={textClass}>The Platform may use machine-learning and generative-AI systems. Simulated Outputs may contain omissions, outdated information, ambiguity, hallucinations, incorrect reasoning, synthetic data or other errors. Outputs are not authoritative medical, legal, regulatory or examination advice. You are responsible for independently evaluating outputs before relying on them for study. Zyntra does not warrant that AI-generated material is complete, accurate, current, original, unbiased or error-free except to the extent a non-excludable law provides otherwise.</p>
          <p className={textClass}>Automated analysis is used for educational personalisation and platform functionality, not to determine professional licensure, medical fitness or employment eligibility.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>8. Third-Party Services</h2>
          <p className={textClass}>The Platform may depend on third-party hosting, authentication, payment, communications, analytics and AI providers. Third-party outages or policy changes may affect availability. Your use of third-party services may be subject to their terms. Zyntra remains responsible for obligations that applicable law places on Zyntra.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>9. Subscription, Billing and Cancellation</h2>
          <p className={textClass}>Subscription fees, billing periods, renewals, taxes, plan features, refunds and plan changes are governed by the SaaS Pricing Architecture &amp; Commercial Billing Policy, which forms part of these Terms. Unless stated otherwise at checkout, recurring subscriptions renew automatically for the same billing period until cancelled. Cancellation ordinarily prevents future renewal and does not reverse a completed billing period.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>10. Refunds and Mandatory Consumer Rights</h2>
          <p className={textClass}>Except where applicable law requires otherwise, charges for digital services and digital content are non-refundable after the relevant service or Proprietary Content has been accessed. Nothing in these Terms excludes, restricts or modifies a statutory consumer guarantee, cooling-off right, cancellation right or other mandatory remedy that cannot lawfully be excluded or modified.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>11. Suspension and Termination</h2>
          <p className={textClass}>Zyntra may suspend or terminate access immediately where reasonably necessary to protect the Platform, users, Proprietary Content, security or legal interests, including for fraud, credential sharing, scraping, content extraction, security attacks, payment abuse, unlawful conduct or material breach. Where practicable for curable non-urgent breaches, Zyntra may provide notice and an opportunity to cure. Termination does not waive accrued obligations or surviving provisions.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>12. Indemnification</h2>
          <p className={textClass}>To the maximum extent permitted by law, you agree to indemnify Zyntra and its officers, employees, contractors and licensors against third-party claims, losses, liabilities, damages, costs and reasonable legal fees arising from your unlawful use of the Platform, breach of these Terms, infringement of another person’s rights, or prohibited patient information you submit. This indemnity does not apply to the extent caused by Zyntra’s own unlawful conduct or where prohibited by law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>13. Disclaimer of Warranties and Availability</h2>
          <p className={textClass}>Except for warranties that cannot lawfully be excluded, the Platform is provided “as is” and “as available”. Zyntra does not warrant uninterrupted or error-free operation, compatibility with every device, or that the Platform will meet every individual study objective. Maintenance, security events, third-party failures and product changes may affect availability.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>14. Limitation of Liability</h2>
          <p className={textClass}>To the maximum extent permitted by law, Zyntra will not be liable for indirect, incidental, special, punitive or consequential losses, or loss of profits, revenue, business, goodwill, opportunity or data. Zyntra’s aggregate liability for claims arising from or relating to the Platform will not exceed the lesser of (a) the subscription fees actually paid by you to Zyntra during the 12 months before the event giving rise to the claim and (b) US$100.</p>
          <p className={textClass}>These limitations do not apply where liability cannot legally be limited, including mandatory consumer rights or other non-excludable liabilities.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>15. Disputes and Individual Proceedings</h2>
          <p className={textClass}>Before formal proceedings, parties should attempt in good faith to resolve a dispute by written notice to [Designated Contact Email]. Where mandatory law gives a consumer or other protected person access to a court, tribunal, regulator, small-claims forum or collective procedure, those rights prevail. Where legally permitted and separately agreed, disputes may be referred to binding individual arbitration under [Arbitration Rules / Institution], seated in [Jurisdiction / Governing Law State]. To the maximum extent permitted by law, claims will be brought individually rather than as a class, representative or collective action. Nothing prevents urgent injunctive relief for intellectual property, confidentiality or security.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>16. Governing Law and Jurisdiction</h2>
          <p className={textClass}>These Terms are governed by the laws of [Jurisdiction / Governing Law State], subject to mandatory consumer, privacy and data-protection laws applicable to you. Courts in [Jurisdiction / Governing Law State] have jurisdiction except where mandatory law provides otherwise.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>17. Changes</h2>
          <p className={textClass}>Zyntra may update these Terms for legal, security, product or commercial reasons. Material changes will be notified through the Platform or by email where required. Changes do not retroactively alter accrued rights unless permitted by law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>18. General</h2>
          <p className={textClass}>If a provision is invalid or unenforceable, it will be modified or severed only to the minimum extent necessary and the remainder will continue. No waiver is effective unless written. These Terms, the Privacy &amp; Data Governance Policy and the applicable checkout or order document form the agreement concerning the Platform. Electronic records and acceptance are valid to the extent permitted by law.</p>
        </section>

        <section className={sectionClass}><h2 className={headingClass}>19. Contact and Notices</h2>
          <p className={textClass}>Legal notices and questions may be sent to <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">{LEGAL_EMAIL}</a>.</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
