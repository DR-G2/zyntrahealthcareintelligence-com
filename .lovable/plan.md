
# Zyntra — AI-Powered AMC Exam Prep Platform

## Overview
A medical exam preparation platform that goes beyond knowledge testing to train composure, time management, and answer finality using the APPE (Adaptive Performance & Preparation Engine). Built with React + Vite, Supabase (auth, database, edge functions), and Lovable AI.

---

## Phase 1: Foundation

### 1.1 Design System & Layout
- Medical-professional color palette: deep blues, whites, soft greens with dark mode support
- Responsive app shell with sidebar navigation (Dashboard, Practice, Analytics, Study Plan, Settings)
- Branded landing/marketing page with Zyntra logo and value proposition

### 1.2 Authentication & Onboarding
- Supabase Auth with email/password and Google sign-in
- Multi-step onboarding flow after first login:
  - Step 1: Name, exam date
  - Step 2: User type (first-timer, repeat candidate, IMG)
  - Step 3: Self-assessed weak areas (select from medical categories)
- User profiles table storing all onboarding data

### 1.3 Database Schema
- **profiles**: id, email, name, user_type, exam_date, weak_areas, onboarding_complete
- **questions**: id, question_text, options (JSONB), correct_answer, explanation, category, difficulty, tags, avg_time_seconds
- **user_attempts**: id, user_id, question_id, selected_answer, time_taken_seconds, answer_changes_count, is_correct, session_id, created_at
- **performance_profiles**: user_id, stability_score, time_sensitivity, confidence_gap, clinical_accuracy, readiness_score, updated_at
- **study_plans**: id, user_id, tasks (JSONB), focus_areas, generated_at
- **user_progress**: user_id, streak_days, total_questions, accuracy_rate, last_active
- **bookmarks**: user_id, question_id
- **user_notes**: user_id, question_id, note_text

---

## Phase 2: APPE Engine (Core Feature)

### Stage 1 — ASSESS: Diagnostic Test
- Timed diagnostic session of 20-30 AI-generated MCQs
- Real-time tracking: time per question, answer change count, final answer
- Timer bar showing remaining time with color changes (green → yellow → red)
- "Lock In" button with ability to change answer (tracked as hesitation)
- All behavioral data stored per attempt

### Stage 2 — IDENTIFY: Performance Profile
- After diagnostic, call Lovable AI edge function to analyze attempt data
- Generate Performance Profile with four scores:
  - **Answer Stability Score** — frequency of answer changes
  - **Time Pressure Sensitivity** — accuracy drop when time is low
  - **Confidence Gap** — self-reported vs actual performance
  - **Clinical Accuracy** — raw knowledge score by category
- Visual dashboard with gauges/progress rings for each metric
- Overall "Readiness Score" percentage

### Stage 3 — ADAPT: Personalized Plan
- AI generates study plan based on identified weaknesses
- If high time sensitivity → prescribe Speed Rounds
- If low stability → prescribe Commitment Drills
- If category weakness → prescribe focused topic sessions
- Display as a daily/weekly task list with checkboxes

### Stage 4 — BUILD: Drill Sessions
- **Speed Rounds**: 10 questions in 10 minutes, strict timer
- **Commitment Drills**: Answer locks immediately on selection, no going back
- **Pressure Tests**: Full simulated exam conditions (timer, question count, no pauses)
- Progress tracking with streaks and session history

---

## Phase 3: Question Bank

### AI-Generated Questions
- Edge function using Lovable AI to generate AMC-style MCQs on demand
- Generated with: question text, 5 options (A-E), correct answer, detailed explanation, category, difficulty
- Store generated questions in database for reuse
- Seed initial set of ~30 questions across key medical categories

### Question Bank UI
- Browse/search questions by category, difficulty, tags
- Bookmark questions and add personal notes
- Filter: all, bookmarked, incorrect, unattempted
- Question detail view with explanation and user's attempt history

---

## Phase 4: Analytics Dashboard

### Visual Charts (using Recharts)
- **Progress Over Time**: Line chart of accuracy across sessions
- **Subject Performance**: Radar chart across medical categories
- **Time Distribution**: Histogram of time per question
- **Stability Trend**: Line chart of answer stability score over time
- **Readiness Score**: Large gauge/progress ring as hero metric

### Insights
- Weak area highlights with recommended actions
- Session-by-session breakdown
- Exam countdown widget with days remaining

---

## Phase 5: Study Planner
- AI-generated daily/weekly schedule based on weak areas and exam date
- Task list with checkboxes and completion tracking
- Browser notification reminders for study sessions
- Exam countdown timer on dashboard

---

## Pages Structure
- `/` — Landing page (marketing)
- `/login` — Auth page
- `/onboarding` — Multi-step onboarding
- `/dashboard` — Main hub with readiness score, streaks, exam countdown
- `/assess` — Diagnostic test
- `/profile` — Performance profile results
- `/practice` — Drill session selection (Speed, Commitment, Pressure)
- `/practice/:type` — Active drill session
- `/questions` — Question bank browser
- `/analytics` — Full analytics dashboard
- `/plan` — Study planner
- `/settings` — User settings, dark mode toggle
