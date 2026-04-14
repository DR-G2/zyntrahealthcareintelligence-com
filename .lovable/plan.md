

## Competitive Gap Analysis: AMC PrepBlitz vs Zyntra

### What PrepBlitz Has (from live site review)

| Feature | PrepBlitz | Zyntra |
|---------|-----------|--------|
| Station topic cards on landing (Chest Pain, Diabetes, etc.) | Visual grid with specialty tags | Missing |
| Trust badges near CTA (No credit card, 2 free sessions/day, Cancel anytime) | Prominent below hero | Missing |
| "Works on Your Phone" explicit messaging | Feature card | Missing |
| Refund Policy page | Dedicated /refund page | Missing |
| "Practise. Score. Improve. Repeat." style tagline in How It Works | Punchy tagline | Generic subtitle |
| Emotional CTA banner ("Your next station is waiting") | Full-width blue banner before footer | Missing |
| Footer with Quick Links + Resources + Legal sections | 3-column organized footer | Basic legal footer |

### What Zyntra Already Beats Them On
- MCQ system (PrepBlitz has zero MCQ)
- APPE behavioral engine
- Readiness DNA + psychograph analytics
- Feed system (paste content, generate questions)
- Study buddy / companion chat
- Flashcard auto-generation from mistakes
- Admin intelligence dashboard
- Clinical Thinking mode (existing data fields)

### Plan: 5 Targeted Additions

---

**1. Landing Page: Station Showcase Grid**

Add a visual grid of 6 station topic cards between "How It Works" and FAQ sections. Each card shows station name + specialty tag (e.g., "Chest Pain" / Cardiology). Cards link to `/stations?demo=true`. This matches PrepBlitz's strongest visual element.

File: `src/pages/Landing.tsx`

---

**2. Landing Page: Trust Badges + Emotional CTA Banner**

- Add trust badges below the hero CTA buttons: "No credit card required", "Free diagnostic assessment", "Cancel anytime"
- Add a full-width colored CTA banner before the footer: "Your training starts now." with a "Start Preparing" button

File: `src/pages/Landing.tsx`

---

**3. Landing Page: "Works on Your Phone" Feature Card**

Add a 6th feature card to the APPE Advantage grid: "Mobile Ready" - "Train on the bus, in the break room, or on the couch. Full functionality on any device."

File: `src/pages/Landing.tsx`

---

**4. Refund Policy Page**

Create a `/refund` page with a clear, fair refund policy. Add link in the legal footer and landing footer. PrepBlitz has this; Zyntra should too for trust.

Files: Create `src/pages/RefundPolicy.tsx`, update `src/App.tsx` (add route), update `src/components/LegalFooter.tsx`

---

**5. Enhanced Footer on Landing Page**

Replace the minimal legal footer on the landing page with a 3-column footer: Quick Links (About, Pricing, How It Works), Resources (AMC Info link, FAQ), Legal (Privacy, Terms, Refund). Include the Zyntra tagline and disclaimer.

File: `src/pages/Landing.tsx`

---

### Technical Details

- No database changes required
- No new edge functions needed
- All changes are frontend-only (4 files modified, 1 new file)
- Station showcase uses hardcoded curated list of 6 topics
- Trust badges use simple check-circle icons
- CTA banner uses gradient-primary styling consistent with existing design system

