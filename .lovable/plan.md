

## Plan: Enhanced Practice Results with Detailed Explanations

### What Changes

**1. Expand the results review section (Practice.tsx, lines 225-245)**

Replace the current inline explanation snippet with a clickable card that navigates to a full-page explanation view. Each question card in results will show:
- Question text, your answer vs correct answer, correct/incorrect badge
- A "Read Full Explanation" button that opens a detailed view

**2. Create a full-page explanation view within the results phase**

Add a new sub-phase `'explanation'` to the drill session. When a user clicks a question, the view transitions to a full-page layout containing:
- The question and all options (highlighted correct/incorrect)
- A detailed explanation section
- **Reference notes** organized by source book:
  - **AMC Handbook** — key clinical points relevant to the question topic
  - **John Murtagh's General Practice** — diagnostic approach and management
  - **Tally O'Connor's Clinical Examination** — examination findings and signs
- A "Back to Results" button

**3. Store reference notes in the question explanation field**

Since the `questions` table already has an `explanation` column, the detailed explanations with book references will be structured within that field. For now, the UI will parse and display the explanation, and add styled reference sections with book attribution headers even if the current explanation text is brief. The textbook reference sections will be rendered as distinct styled blocks.

### Technical Approach

- Add state: `reviewQuestionIndex: number | null` to track which question is being viewed in detail
- When set, render a full-page explanation component instead of the results list
- Structure the explanation page with:
  - Question card with all options color-coded
  - Explanation text (from DB)
  - Three reference cards (AMC Handbook, Murtagh's, Tally O'Connor) with topic-relevant headers derived from the question's category
- Use `framer-motion` for page transitions
- All changes are in `src/pages/Practice.tsx` only — no new files needed

### Files Modified
- `src/pages/Practice.tsx` — refactor results phase to add clickable detail view with book reference sections

