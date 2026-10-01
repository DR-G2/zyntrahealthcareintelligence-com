# Zyntra Healthcare Intelligence 

BUILD A FULL-STACK MEDICAL EXAM PREP PLATFORM CALLED "ZYNTRA"



PROJECT OVERVIEW:

Create Zyntra - an AI-powered AMC (Australian Medical Council) exam preparation platform that trains medical graduates not just on knowledge recall, but on "performance under pressure." The platform uses an adaptive learning engine called "APPE" (Adaptive Performance & Preparation Engine) to identify and correct behavioral patterns that cause exam failure.



CORE VALUE PROPOSITION:

Traditional question banks test medical knowledge. Zyntra trains time management, answer finality, and composure under observation - the actual reasons candidates fail the AMC.



TECH STACK:

- Frontend: Next.js 14 with App Router, TypeScript, Tailwind CSS, shadcn/ui components

- Backend: Next.js API Routes

- Database: PostgreSQL (use Supabase)

- Authentication: Clerk

- AI: OpenAI GPT-4 API with Vercel AI SDK

- State Management: Zustand

- Charts: Recharts for analytics



FEATURES TO IMPLEMENT:



1. AUTHENTICATION & ONBOARDING

   - Clerk-based auth (email, Google, Apple)

   - Multi-step onboarding: collect exam date, user type (first-timer/repeat/OSCE/IMG), weak subject areas

   - Create user profile in database



2. THE APPE ENGINE (CORE FEATURE)

   Implement a 4-stage adaptive system:

   

   STAGE 1 - ASSESS:

   - Timed diagnostic test (20-30 MCQs)

   - Track: time per question, answer changes (hesitation), accuracy

   - Store all behavioral metrics

   

   STAGE 2 - IDENTIFY:

   - AI analysis generates "Performance Profile" with:

     * Answer Stability Score (how often they change answers)

     * Time Pressure Sensitivity (performance degradation under time pressure)

     * Confidence Gap (difference between perceived and actual knowledge)

     * Clinical Accuracy baseline

   - Visual dashboard showing these metrics

   

   STAGE 3 - ADAPT:

   - AI generates personalized study plan based on identified weaknesses

   - Adaptive difficulty: if user struggles with time, give more timed drills; if unstable answers, give "commitment exercises"

   - Target specific AMC failure patterns

   

   STAGE 4 - BUILD:

   - Structured drill sessions:

     * "Speed Rounds" - 10 questions in 10 minutes (time management)

     * "Commitment Drills" - can't change answer once selected (answer finality)

     * "Pressure Tests" - simulated exam conditions with timer

   - Progress tracking with streaks and milestones



3. QUESTION BANK MODULE

   - Database of 500+ AMC-style MCQs with:

     * Question text with 5 options (A-E)

     * Correct answer with detailed explanation

     * Subject category, difficulty level, tags

     * Average time to solve

   - Search and filter by category, difficulty, topic

   - Bookmark questions for review

   - User notes on each question



4. PERFORMANCE ANALYTICS DASHBOARD

   - Visual charts showing:

     * Progress over time (line chart)

     * Subject-wise performance (radar chart)

     * Time distribution per question (histogram)

     * Answer stability trend

     * Confidence vs Accuracy scatter plot

   - "Readiness Score" - overall exam readiness percentage

   - Weak area heatmap

   - Comparison with average user performance



5. STUDY PLANNER

   - AI-generated daily/weekly study schedule

   - Tasks based on weak areas identified

   - Progress tracking with checkboxes

   - Exam countdown widget

   - Push notifications for study reminders (use browser notifications)



6. UI/UX REQUIREMENTS

   - Clean, professional medical aesthetic (blues, whites, subtle greens)

   - Dark mode support

   - Fully responsive (mobile-first)

   - Loading states and skeleton screens

   - Smooth animations with Framer Motion

   - Toast notifications for user feedback



7. DATABASE SCHEMA TO CREATE:

   - users: id, email, name, user_type, exam_date, created_at

   - questions: id, question_text, options[], correct_answer, explanation, category, difficulty, tags, avg_time

   - user_attempts: id, user_id, question_id, selected_answer, time_taken, answer_changes, is_correct, created_at

   - performance_profiles: user_id, stability_score, time_sensitivity, confidence_gap, clinical_accuracy, readiness_score, updated_at

   - study_plans: user_id, daily_tasks, focus_areas, generated_at

   - user_progress: user_id, streak_days, total_questions, accuracy_rate, study_hours



8. AI PROMPTS TO IMPLEMENT:

   - Performance analysis prompt: Analyze user's attempt history and generate behavioral insights

   - Study plan generation prompt: Create personalized study schedule based on weaknesses

   - Question explanation prompt: Generate additional context/explanations for difficult questions



IMPLEMENTATION NOTES:

- Use shadcn/ui for all UI components (Button, Card, Dialog, Progress, Tabs, etc.)

- Implement proper error handling and loading states

- Add rate limiting for AI API calls

- Ensure data privacy (medical data sensitivity)

- Add export functionality for study progress (PDF)

- Include keyboard shortcuts for quick navigation during practice



DELIVERABLES:

- Fully functional Next.js application

- Database setup with migrations

- Environment variable template

- README with setup instructions

- Deployed version on Vercel



Start by setting up the project structure, authentication, and database schema. Then build the question bank and ASSESS module. Finally, implement the AI-powered ADAPT and analytics features.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://zyntrahealthcareintelligence-com.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ac44dc8-fe0a-4032-b431-157c5b421031).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
