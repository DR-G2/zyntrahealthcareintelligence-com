

## Create Pricing Page (Anonymous Founder Version)

Build a full `/pricing` page with all provided copy, matching the Landing page's design system.

### New File: `src/pages/Pricing.tsx`

A large page with these sections, using `framer-motion` animations and existing UI components:

1. **Shared Nav** -- same nav bar as Landing (Zyntra logo, ThemeToggle, "Get Started" button) with added "Pricing" link
2. **Hero** -- Founder's anonymous story (blockquote-style, centered, personal tone)
3. **The Real Math** -- Timeline + cost breakdown in a styled card/table
4. **Pricing Tiers** -- 4 cards in a responsive grid:
   - Free Forever ($0) -- outlined/default style
   - Core ($29/mo) -- standard card
   - Pro ($49/mo) -- highlighted/primary border (recommended)
   - Lifetime ($299) -- accent style
   - Each card includes all bullet points, personal quotes, and CTA buttons linking to `/dashboard` or `/login`
5. **Comparison Table** -- Using the `Table` component with check/x marks
6. **FAQ** -- Using `Accordion` component, grouped by category (About Founder, Pricing & Money, Product & Features, Specific Situations, Hard Questions)
7. **Founder Footer** -- Personal footer block + standard copyright footer

### Updated File: `src/App.tsx`
- Import `Pricing` from `./pages/Pricing`
- Add route: `<Route path="/pricing" element={<Pricing />} />`

### Updated File: `src/pages/Landing.tsx`
- Add a "Pricing" `Link` in the nav bar between ThemeToggle and "Get Started" button

### Design Details
- Cards use `Card`/`CardHeader`/`CardContent` components
- Pro tier gets a `border-primary` highlight and a "Most Popular" badge
- FAQ uses `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`
- Comparison table uses `Table`/`TableHeader`/`TableRow`/`TableCell` with `Check`/`X` icons from lucide-react
- All copy taken verbatim from the provided text
- Responsive: single column on mobile, multi-column grid on desktop

