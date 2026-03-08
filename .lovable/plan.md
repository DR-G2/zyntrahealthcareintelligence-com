

## Plan: Split into About + Pricing Pages

The user wants the long content from the provided text split into two separate pages with proper routing.

### Page 1: About (`/about`)
New file `src/pages/About.tsx` containing the founder's story sections:
- Hero: "Built by an IMG who struggled through the same AMC journey"
- "I didn't pass because I'm unusually smart" intro
- "The Turning Point" section (fixing foundation + fixing exam behaviour)
- "The Result" section (AMC MCQ 321/500)
- "Why Zyntra Exists" section
- Founder footer (IMG, AMC MCQ 321/500, currently preparing for Clinical)
- Shared nav bar with links to both About and Pricing

### Page 2: Pricing (`/pricing`)
Update existing `src/pages/Pricing.tsx`:
- Remove the current founder story hero and "Real Math" cost breakdown sections
- Replace hero with the new copy: "Choose Your Plan — Simple pricing designed for IMGs"
- Keep the 5 pricing tier cards (Free, MCQ Only, OSCE Only, Full Access, Lifetime) with all checkout logic intact
- Keep comparison table and FAQ sections
- Update nav to include About link

### Routing & Navigation
- Add `/about` route in `App.tsx` (public, no auth required)
- Update nav bar on both pages to include "About" and "Pricing" links
- Update Landing page nav to include "About" link

### Files

| File | Action |
|------|--------|
| `src/pages/About.tsx` | New — founder story page |
| `src/pages/Pricing.tsx` | Update — remove story sections, clean pricing-only page |
| `src/App.tsx` | Update — add `/about` route |
| `src/pages/Landing.tsx` | Update — add "About" nav link |

