

## Plan: Rip Missing Features from AMC PrepBlitz

After analyzing amcprepblitz.com in detail, the three core product features (SRS Flashcards, Voice Practice, Gold-Standard Coaching) were already implemented in the last round. What remains are **policy pages, administrative features, and structural gaps**.

### Gap Analysis

| Feature | PrepBlitz | Zyntra |
|---------|-----------|--------|
| Privacy Policy page | Full GDPR/APP-compliant page | Missing entirely |
| Contact form | Embedded on landing page | No contact form anywhere |
| Free trial with daily limits | 5-day trial, 2 sessions/day | Free trial end date exists but no daily session cap |
| Competitive intelligence clauses | Detailed anti-competitor sections in ToS | Missing |
| AMC independence disclaimer | Formal disclaimer section | Missing |
| Voice/audio consent in ToS | Dedicated section | Missing |
| AI content feeding prohibition | Explicit clause | Missing |
| Beta access confidentiality | Dedicated section | Missing |
| FAQ on landing page | Expandable FAQ section | Only on Pricing page |

---

### Task 1: Create Privacy Policy Page

New page at `/privacy` with comprehensive sections mirroring PrepBlitz but branded for Zyntra:
- Information collected (personal, usage, payment, cookies)
- How information is used
- Third-party sharing (Razorpay, analytics, error tracking)
- Data security measures
- Data retention policy
- User privacy rights (access, correction, deletion)
- Australian Privacy Principles compliance
- Contact information

**Files:** `src/pages/Privacy.tsx` (new), `src/App.tsx` (add route), `src/components/LegalFooter.tsx` (add Privacy link)

### Task 2: Expand Terms of Service

Add missing sections to `src/pages/Terms.tsx`:
- **Competitive intelligence prohibition** (anti-competitor access clause)
- **AI content feeding prohibition** (no feeding content to LLMs/ML pipelines)
- **Voice/audio processing consent** (Web Speech API usage disclosure)
- **Beta access confidentiality** clause
- **AMC independence disclaimer** (formal independence notice)
- **Identity and eligibility** requirements (real identity, no competitor access)
- **Original content notice** (scenarios are original, not recalled)

### Task 3: Add Contact Form to Landing Page

Add an embedded contact section at the bottom of the Landing page:
- Name, email, message fields
- Category selector (General / Support / Feedback)
- Stores submissions in a new `contact_submissions` database table
- Sends admin notification via existing admin messaging system
- Success toast on submission

**Database:** New `contact_submissions` table (id, name, email, category, message, created_at) with public insert RLS policy

**Files:** `src/pages/Landing.tsx` (add contact section), migration for table

### Task 4: Implement Free Trial Daily Session Limits

PrepBlitz limits free users to 2 AI practice sessions per day and 6 free stations.
- Track daily session count in `user_attempts` for MCQ and `station_attempts` for OSCE
- Check count before starting a new session
- Show upgrade prompt when limit reached
- Free trial: 2 MCQ sessions + 2 OSCE sessions per day
- Display remaining sessions on Dashboard

**Files:** `src/pages/Practice.tsx` (add limit check), `src/pages/Stations.tsx` (add limit check), `src/pages/Dashboard.tsx` (show remaining), new utility hook `src/hooks/useDailyLimits.ts`

---

### Technical Details

- Privacy page follows same minimal styling as existing Terms page
- Contact form uses anonymous insert RLS (no auth required for public contact)
- Daily limits query `user_attempts` with `created_at >= today` filter
- All new ToS sections use existing `sectionClass`/`textClass` patterns
- No new edge functions needed -- contact form inserts directly via Supabase client

