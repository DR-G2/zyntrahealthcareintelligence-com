

## Plan: Delete All Questions/Subjects + Add JSON Format Reference

### What We're Doing
1. Delete all existing questions and subject headings from the database
2. Add a JSON format reference card in the MCQ tab showing the Zyntra Standard Explanation Format

### Changes

**1. Delete existing data (via insert tool — data operations)**
- `DELETE FROM questions;` — removes all MCQ questions
- `DELETE FROM subjects;` — removes all subject headings
- Also clean up orphaned data: `question_difficulty_tiers`, `question_dna`, `bookmarks`, `user_notes`, `user_attempts`

**2. Update `src/pages/AdminDashboard.tsx` — MCQTab**

Add a "Required JSON Format" reference card between the Import JSON card and the Question Bank. This card will show a collapsible example JSON object matching the Zyntra Standard Explanation Format with all fields:

```json
{
  "question_text": "A 54-year-old man presents with...",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text", "Option E text"],
  "correct_answer": "A",
  "category": "Toxicology",
  "difficulty": "moderate",
  "explanation": "CORRECT ANSWER: DMPS...",
  "diagnosis_explanation": "ACUTE MERCURY VAPOUR TOXICITY...",
  "first_line_investigation": "...",
  "gold_standard_investigation": "...",
  "best_treatment": "DMPS (Dimercaptopropane Sulfonate)",
  "differential_diagnoses": [
    {"diagnosis": "Iron poisoning", "reasoning": "...", "management": "Deferoxamine"}
  ],
  "incorrect_answer_explanations": {
    "B": "Deferoxamine is for iron toxicity...",
    "C": "Penicillamine is for copper toxicity...",
    "D": "NAC is for paracetamol overdose...",
    "E": "Penicillin is an antibiotic..."
  },
  "key_takeaways": [
    "Heating dental amalgam releases mercury vapour",
    "DMPS is the preferred chelating agent for mercury toxicity"
  ],
  "subtopic": "Mercury Poisoning",
  "clinical_vignette": true,
  "guideline_reference": "eTG Toxicology",
  "system_category": "Toxicology"
}
```

The card will include:
- A header "Required JSON Format"
- A collapsible section with the full example
- A "Copy Template" button to copy a blank template to clipboard
- Field descriptions noting which are required vs optional

| File | Action |
|------|--------|
| Database | DELETE all rows from `questions`, `subjects`, and related tables |
| `src/pages/AdminDashboard.tsx` | Add JSON format reference card in MCQTab |

