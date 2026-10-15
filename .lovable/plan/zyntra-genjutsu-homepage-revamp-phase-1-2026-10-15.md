# Zyntra Genjutsu — Homepage Revamp (Phase 1)

Scope: homepage only. Planning only until approved.

## 1. Current-state findings (revision 9a20a33, clean working tree)

- `src/pages/Home.tsx` (230 lines) is the only homepage. It holds header, hero, signal cards, About, How it works, Blog teasers (`#trains`), Pricing (`#pricing`), FAQ (`#faq`), footer and a Get Started dialog.
- `src/components/home/NeuralScene.tsx` does **not exist**. No `src/components/home/` folder.
- **three, @react-three/fiber and @react-three/drei are not installed.** Only Framer Motion is available. The brief says to use 3D only where it's already installed and not to add another 3D library, so the hero is specified as layered SVG plus Framer Motion (see Decision A).
- **The approved reference image was not attached** to this request, and no upload is present. The spec below follows the written description. Please attach the image if exact proportions matter.
- Existing claims that must go (they are fabricated): "94.2% FIT", "High (0.88)", "42.4s", "Live Telemetry" and decorative bar heights on the signal cards.
- Routes to preserve: `/login`, `/check` (redirects to `/login`), `/amc-part-1-mcq`, `/blog`, `/terms`, `/privacy`. Anchors: `#top`, `#trains`, `#pricing`, `#faq`. Add `#about`, because `/about` already redirects to `/#about` but the anchor is missing today.
- Pricing copy comes from `COPY_CARD_CHECK` / `COPY_CANCEL` in `src/lib/billing.ts`. Reuse it unchanged.
- Many colours are hard-coded in the current file. The revamp moves them to page-scoped CSS tokens.

## Decision A — hero rendering (needs your confirmation)

- **Recommended:** SVG hero built from vector paths (hemispheres, cord, funnel). Framer Motion handles float, cursor parallax, signal pulse and ring hover. It needs no new dependency, works without WebGL (so there's nothing to fall back from), is light on phones and fully reduced-motion controllable.
- Alternative: add three, R3F 8.18 and drei 9.122 for a real 3D scene, plus the SVG as a no-WebGL fallback. This adds about 600 KB and contradicts "do not add another 3D library". Only choose this if you explicitly approve the dependency.

## 2. Section order and copy

1. **Header** (existing): Z mark, ZYNTRA, Blog, Get Started → `/login`.
2. **Hero** `#top`
   - Eyebrow: AMC preparation intelligence
   - H1: **From Questions to Readiness.**
3. **Positioning line:** "Zyntra is an AI-powered AMC exam preparation platform for international medical graduates. It learns how you approach questions — timing, confidence and answer changes — and turns those signals into your next best training action." (Existing claims only. Footer note: "Independent of the AMC.")
   - CTAs: Get Started → `/login`; Read about AMC MCQ preparation → `/amc-part-1-mcq`.
4. **Hero assembly** (section 3 of this plan), right column on desktop, under the copy on mobile.
5. **Four signal cards** (no numbers): Confidence — Observed; Timing — Measured; Answer changes — Tracked; Consistency — Analysed. Each has one line explaining what is captured.
6. **The loop** `#how`: Observe → Diagnose → Intervene → Measure → Adapt. Five short steps, connected by the same cyan nerve line.
7. **Why Zyntra** `#about`: three points from the existing About copy (a bank marks the option; Zyntra also keeps timing, confidence and answer changes; those feed Performance Intelligence and the Study Plan). Not affiliated with the AMC.
8. **Representative MCQ preview:** one static AMC-style stem with five options, plus a "What Zyntra records" side panel naming the signals with no values. Labelled "Example question".
9. **Pricing** `#pricing`: existing Free / Full Access copy and billing constants, unchanged.
10. **Final CTA:** "Start training with evidence." → `/login`. The existing FAQ `#faq` and footer stay. Blog teasers `#trains` stay above pricing.

## 3. Hero composition and animation

```text
   (  left hemisphere )( right hemisphere )   folded gyri strokes, cyan emissive glow
                    \  |  /
                     cord                     tapering path, faint vertebral ticks
                      |   . signal pulse travels top -> bottom (3.2s loop)
                   \_______/                  glass funnel: 4 elliptical rings
                    \_____/                   translucent fill, inner highlight
                     NEXT BEST ACTION         label at funnel mouth
```

- One SVG `viewBox`, one group, everything moves together. No detached cards around it.
- Float: ±6px on Y over 6s, ease in/out.
- Cursor: ±8px translate and ±3° tilt, spring-damped (stiffness 60, damping 18). Pointer-fine devices only; disabled on touch.
- Signal: small radial-glow dot following the cord path (`offset-path` / motion along path), soft trail, 3.2s loop with a 1.2s pause.
- Funnel rings: on hover or focus of the assembly, rings brighten and spread 4% in sequence (60ms stagger).
- Reduced motion: no float, no signal, no parallax. Static brightened state only.
- Accessibility: `role="img"` with label "Brain connected by a spinal cord to a funnel labelled Next Best Action". Decorative strokes are `aria-hidden`.

## 4. Visual system (page-scoped)

- Tokens added under a `.home-genjutsu` scope in `src/index.css`: `--gj-base` (≈ #04101D), `--gj-cyan`, `--gj-teal`, `--gj-glass`, `--gj-line`, `--gj-glow`. All HSL.
- Typography: Space Grotesk headings, Plus Jakarta Sans body (already loaded). H1 clamps 2.5–4.5rem.
- Glass is restrained: one blur level, 1px luminous borders, no particle fields.

## 5. Responsive and accessibility

- Mobile (<768): single column. H1 → copy → CTAs → hero (max 320px tall) → cards in a 1-column stack; loop is vertical.
- Tablet (768–1023): hero beside copy at 45% width; cards 2×2; loop is a 5-step horizontal scroll replaced by wrap (no overflow).
- Desktop (≥1024): 7/5 grid; cards 4-up; loop is horizontal with a connecting line.
- `overflow-x: clip` on the page root; every section `min-w-0`; test at 360, 390, 768, 1024, 1440.
- Keyboard: all CTAs are real links; visible focus rings; skip-to-content link; dialog keeps focus trap (existing shadcn Dialog) or is removed in favour of a direct `/login` link.
- Contrast: body text ≥ 4.5:1 on the base colour; muted text ≥ 4.5:1.

## 6. File-change map

- `src/pages/Home.tsx` — restructure sections, remove fabricated values, use tokens.
- `src/components/home/NeuralHero.tsx` — **new**, SVG and motion hero assembly.
- `src/index.css` — add a `.home-genjutsu` token and style block only.
- `mem://style/intelligence-genjutsu` — extend to name the homepage as the canonical source.
- No changes to routes, auth, Practice, PIE, backend, question bank, other pages or deployment.

## 7. Risks and regression checklist

- `/about` → `#about`, `/pricing` → `#pricing`, `/check` → `/login` still land correctly.
- SEO: H1 text changes. The crawler shell in `index.html` is left unchanged in this phase; flag that it should be updated in a follow-up if you want them in sync.
- The blog test (`src/test/blog.test.tsx`) and any Home tests still pass.
- No horizontal overflow; no layout shift from the hero (fixed aspect ratio).
- No numbers or outcomes appear that aren't sourced.
- Reduced motion verified via emulated media.

## 8. Implementation and test sequence

1. Add tokens to `src/index.css`.
2. Build `NeuralHero.tsx`, static first, then add motion.
3. Restructure `Home.tsx` section by section, keeping existing anchors and copy.
4. Run the build and the full test suite; fix any failure this work causes. If the build fails for another reason, stop and report.
5. Run browser checks at 390, 768 and 1440: overflow, anchors, keyboard tab order, reduced-motion screenshot, hover state on the funnel rings.
6. Report the exact results. No commit, merge or deploy.
