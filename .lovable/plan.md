

## Plan: Terms of Service, Legal Consent, Anti-Piracy & Contact System

### Database Changes

**New table: `user_legal_acceptance`**
- `id` (uuid PK), `user_id` (uuid, FK → auth.users), `terms_version` (text, e.g. "v1.0"), `accepted_at` (timestamptz, default now()), `ip_address` (text, nullable), `user_agent` (text, nullable)
- RLS: users can read/insert their own rows
- A trigger on `profiles` or a check in AuthContext will verify acceptance of the current terms version

### New Files

| File | Purpose |
|------|---------|
| `src/pages/Terms.tsx` | Full Terms of Service page at `/terms` with all 10 sections (intro, usage rules, IP, anti-piracy, 3-strike system, suspension, billing, liability, governing law, contact). Legal text styled at 11px/0.85 opacity, headings 13px/600 weight. Includes piracy reporting mailto link and contact section with `appe@zyntr.website`. |
| `src/components/LegalFooter.tsx` | Global footer component: "© 2026 Zyntra · Terms · Privacy · Contact" at 10px/0.7 opacity. Contact opens `mailto:appe@zyntr.website?subject=Zyntra Support Request`. |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Add a mandatory checkbox to the signup form: "I agree to the Terms of Service and Copyright Policy" with link to `/terms`. Disable submit until checked. Add small support notice below: "Questions? Contact appe@zyntr.website" at 11px/0.8 opacity. On signup success, insert a row into `user_legal_acceptance` with version "v1.0". |
| `src/pages/Onboarding.tsx` | No change needed — consent is captured at signup, not onboarding. |
| `src/pages/Settings.tsx` | Add a "Legal & Policies" card with links to Terms, anti-piracy notice summary, and clickable `mailto:appe@zyntr.website`. |
| `src/components/AppLayout.tsx` | Add `<LegalFooter />` at the bottom of the main content area. |
| `src/pages/Landing.tsx` | Replace the existing simple footer with `<LegalFooter />`. |
| `src/App.tsx` | Add `/terms` route (public, no auth required). |
| `src/contexts/AuthContext.tsx` | Fetch user's latest `user_legal_acceptance` record. Expose `termsAccepted: boolean` and `termsVersion: string | null`. If terms version is outdated on login, redirect to a re-acceptance prompt. |
| `src/components/ProtectedRoute.tsx` | If user has not accepted the current terms version (v1.0), show an inline consent modal before allowing access. |

### Terms Versioning Logic

- Current version stored as a constant: `CURRENT_TERMS_VERSION = "v1.0"`
- On each protected route load, if user's latest accepted version !== current version, a modal prompts re-acceptance
- Accepting inserts a new row into `user_legal_acceptance`

### Copyright Banner

The `LegalFooter` component includes the copyright notice: "All Zyntra content is protected under the Copyright Act 1968 (Cth). Unauthorized copying, redistribution, scraping, or sharing of content is prohibited." at 10px/0.75 opacity.

