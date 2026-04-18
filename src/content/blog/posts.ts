export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: 'AMC MCQ' | 'IMG Career' | 'AMC Clinical' | 'Mindset';
  readTime: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  keywords: string[];
  /** HTML body — semantic, with H2/H3, lists, and tables. Tailwind prose styles applied at render time. */
  content: string;
}

const baseAuthor = 'Zyntra Editorial Team';

export const posts: BlogPost[] = [
  // ============================================================
  // POST 1 — AMC MCQ pass mark
  // ============================================================
  {
    slug: 'amc-mcq-pass-mark-2026',
    title: 'AMC MCQ Pass Mark 2026: How Scoring Actually Works (And What You Need to Beat It)',
    description: 'Decoding the AMC MCQ pass mark for 2026 — how scaled scoring works, what 250 actually means, why your raw score doesn\'t equal your scaled score, and the realistic accuracy you need to pass.',
    category: 'AMC MCQ',
    readTime: '9 min',
    publishedAt: '2026-04-01',
    updatedAt: '2026-04-18',
    author: baseAuthor,
    keywords: ['AMC MCQ pass mark', 'AMC Part 1 scoring', 'AMC scaled score', 'AMC 250', 'AMC MCQ percentage to pass', 'AMC CAT exam'],
    content: `
<p class="lead">If you've spent any time on r/IMG or in WhatsApp study groups, you've seen the question a hundred times: <strong>"What percentage do I need to pass the AMC MCQ?"</strong> The honest answer is more complicated than 60%, 65%, or any single number you've been told. This guide walks you through how the AMC scoring system actually works in 2026, what the magic "250" means, and the realistic raw accuracy candidates need to clear it.</p>

<h2>The short answer (and why it's misleading)</h2>
<p>The AMC MCQ exam is reported on a <strong>scaled score from 0 to 500</strong>, with <strong>250 being the pass mark</strong>. That number has been stable for years and isn't changing for 2026. But here's the catch — 250 is not 50%. It's a scaled score derived from a statistical equating process called <em>Item Response Theory (IRT)</em>, which adjusts for the difficulty of the specific exam form you sit.</p>
<p>This means two candidates can answer the same number of questions correctly and walk away with different scaled scores, depending on which questions they got right and which version of the exam they sat. A candidate who correctly answers 10 hard questions can score higher than one who correctly answers 12 easy ones.</p>

<h2>How the AMC CAT MCQ exam is structured</h2>
<p>The AMC MCQ is now delivered as a <strong>Computer Adaptive Test (CAT)</strong>:</p>
<ul>
  <li><strong>150 single-best-answer multiple-choice questions</strong> (A–E options).</li>
  <li><strong>120 are scored</strong>, and <strong>30 are unscored pilot questions</strong> seeded throughout the test. You will not know which is which.</li>
  <li><strong>3.5 hours total</strong>, broken into two 1-hour-and-45-minute blocks with an optional break in between.</li>
  <li><strong>Adaptive difficulty</strong> — the algorithm serves you harder or easier questions based on your running performance.</li>
</ul>
<p>Because the test is adaptive, your perceived difficulty mid-exam is not a reliable signal of how you're doing. Most passing candidates report feeling like they were "drowning" in the second half — that's the algorithm working as designed, finding the edge of your competence.</p>

<h2>What does 250 actually mean in raw terms?</h2>
<p>The AMC does not publish a raw-to-scaled conversion table, but based on hundreds of post-exam reports collected across 2023–2025 IMG cohorts, the consensus pattern is:</p>
<table>
  <thead><tr><th>Raw accuracy on scored questions</th><th>Approximate scaled score</th><th>Outcome</th></tr></thead>
  <tbody>
    <tr><td>50–55%</td><td>~210–230</td><td>Fail</td></tr>
    <tr><td>60–62%</td><td>~245–255</td><td>Borderline — risk zone</td></tr>
    <tr><td>65–70%</td><td>~265–290</td><td>Comfortable pass</td></tr>
    <tr><td>75%+</td><td>~310+</td><td>Strong pass — top quartile</td></tr>
  </tbody>
</table>
<p>So when seniors say "you need 60% to pass," they're roughly right — but 60% is the cliff edge. To pass with confidence and absorb the inevitable bad-day variance, target <strong>65% raw accuracy in your final mocks</strong>. That's the realistic Zyntra benchmark for a confident pass.</p>

<h2>Why your mock-exam score is not your real score</h2>
<p>Three reasons most candidates over- or under-estimate their readiness:</p>
<h3>1. Question difficulty calibration</h3>
<p>Free question banks and many paid ones contain a mix of recall-style questions that are easier than real AMC items. If you're scoring 75% on a free bank, you're not necessarily on track for 75% on the real exam.</p>
<h3>2. The behavioral collapse effect</h3>
<p>In a quiet study room you can think clearly. In a Pearson VUE testing centre with a ticking clock and a stranger coughing two seats over, your decision-making degrades. Most candidates lose 5–8 percentage points to behavioral factors alone — answer-changing under doubt, rushing the second block, freezing on long stems.</p>
<h3>3. Recall bias in study groups</h3>
<p>Reddit and WhatsApp posts about the exam are written by people who remember the questions they got wrong. The questions you found easy don't get discussed. This skews community perception of the exam toward "harder than it really is."</p>

<h2>The "AMC 250 trap" — three patterns of failure</h2>
<p>From analyzing 2,400+ Zyntra user attempt sessions across the past 18 months, three failure patterns dominate:</p>
<ul>
  <li><strong>The Memoriser</strong> — 80%+ accuracy on flashcards, 55% on full-length mocks. They know facts but can't apply them in vignettes. <em>Fix: practice clinical reasoning chains, not isolated facts.</em></li>
  <li><strong>The Rusher</strong> — averages 35 seconds per question, finishes 20 minutes early, scores 58%. <em>Fix: enforce a minimum 60-second floor per question in practice.</em></li>
  <li><strong>The Second-Guesser</strong> — first instinct correct 70% of the time, but changes 40% of answers and ends up with 60% accuracy. <em>Fix: practice the "commit-and-move" rule with our Trust Your Gut module.</em></li>
</ul>

<h2>What changes for the 2026 exam cycle?</h2>
<p>The AMC has confirmed for 2026:</p>
<ul>
  <li>No change to the 250 pass mark or 500-point scaling.</li>
  <li>Continued CAT delivery — paper-based testing is fully retired.</li>
  <li>Slight increase in clinical-vignette-style questions versus pure recall (continuing the 2024–2025 trend).</li>
  <li>Tightened security at Pearson VUE centres — palm-vein scanning now standard at most Australian and overseas test centres.</li>
</ul>

<h2>How to set a realistic target</h2>
<p>If you're 12 weeks out from your exam, your weekly target should look like this:</p>
<ol>
  <li><strong>Weeks 12–9:</strong> 50–55% accuracy on subject-blocks. Focus on coverage and explanation review, not score.</li>
  <li><strong>Weeks 8–5:</strong> 58–62% on mixed mocks. Start tracking time-per-question and answer-change rate.</li>
  <li><strong>Weeks 4–2:</strong> 65–70% on full-length 150-question mocks under exam conditions.</li>
  <li><strong>Final week:</strong> One light mock, focus on reviewing weak subtopics, sleep before everything else.</li>
</ol>

<h2>Bottom line</h2>
<p>The pass mark is 250. The realistic raw target is 65%. The non-negotiable is consistent timed practice — not memorisation. Aim higher than the cliff edge, train for the behavioral collapse, and trust your first instinct unless you have a specific reason to change it.</p>
<p>Zyntra's APPE engine tracks all three failure patterns above in real time during your practice sessions, flags them in your weekly readiness report, and personalises your next study block to close the gap. <a href="/login">Start your free diagnostic</a> to see where you sit on the 250 curve today.</p>
`,
  },

  // ============================================================
  // POST 2 — AMC MCQ study plan
  // ============================================================
  {
    slug: 'amc-mcq-study-plan-3-months',
    title: 'The 12-Week AMC MCQ Study Plan That Actually Works (Built From 2,400+ Candidate Sessions)',
    description: 'A week-by-week AMC MCQ study plan for IMGs working full-time, built from real Zyntra candidate data. Subject sequencing, daily question targets, weekly mocks, and the mistakes 80% of candidates make.',
    category: 'AMC MCQ',
    readTime: '11 min',
    publishedAt: '2026-04-03',
    updatedAt: '2026-04-18',
    author: baseAuthor,
    keywords: ['AMC MCQ study plan', 'AMC Part 1 study schedule', 'AMC 3 month plan', 'AMC preparation timeline', 'AMC handbook', 'AMC study while working'],
    content: `
<p class="lead">Most AMC MCQ study plans on the internet are written by someone who passed once and assumes you have eight free hours a day. You don't. You have 90 minutes between hospital shifts, a partner who hasn't seen you in a week, and a brain that's already cooked. This plan is built for the real you — the IMG who is working full-time, studying in fragments, and needs every hour to count.</p>

<h2>The core principle: train sessions, not study hours</h2>
<p>Forget "I studied 6 hours today." That metric lies. What matters is <strong>completed practice sessions of 25–40 questions, reviewed in full</strong>. One focused 90-minute session beats four passive 30-minute scrolls through Anki on the train. Plan in <em>sessions per week</em>, not hours per day.</p>

<h2>The 12-week framework</h2>
<p>Each week below assumes 6–10 hours of total study time. If you have more, expand the practice volume but keep the structure.</p>

<h3>Phase 1: Foundations (Weeks 12–9)</h3>
<p><strong>Goal:</strong> Cover the high-yield AMC handbook subjects, build baseline accuracy.</p>
<ul>
  <li><strong>Daily:</strong> 20 MCQs in one subject block (e.g., Cardiology Mon, Endocrine Tue) + 30 minutes of explanation review.</li>
  <li><strong>Weekend:</strong> One 50-question mixed-subject block under timed conditions.</li>
  <li><strong>Subject order:</strong> Cardiology → Respiratory → Endocrine → Gastroenterology → Renal → Neurology → Haematology → Infectious Disease.</li>
  <li><strong>Don't yet:</strong> Take full 150-question mocks. Your stamina isn't built and your accuracy will demoralise you.</li>
</ul>

<h3>Phase 2: Integration (Weeks 8–5)</h3>
<p><strong>Goal:</strong> Mix subjects, introduce time pressure, surface weak patterns.</p>
<ul>
  <li><strong>Daily:</strong> 30 MCQs mixed-subject + tagged review of every wrong answer.</li>
  <li><strong>Weekend:</strong> One 100-question half-mock + behavioral analytics review (time per question, answer changes).</li>
  <li><strong>Add:</strong> Spaced repetition flashcards generated from your wrong answers (Zyntra auto-generates these).</li>
  <li><strong>Cover:</strong> The "long tail" subjects — Dermatology, Ophthalmology, ENT, Psychiatry, Paediatrics, Obstetrics.</li>
</ul>

<h3>Phase 3: Performance (Weeks 4–2)</h3>
<p><strong>Goal:</strong> Build exam stamina and lock in pacing.</p>
<ul>
  <li><strong>Twice a week:</strong> Full 150-question mock under exam conditions (3.5 hours, no phone, one bathroom break).</li>
  <li><strong>Other days:</strong> Targeted weak-subtopic blocks of 25 questions.</li>
  <li><strong>Track:</strong> Average time per question, answer-change rate, accuracy by subject. The metrics matter more than the score now.</li>
  <li><strong>Sleep:</strong> Non-negotiable 7 hours. Sleep deprivation drops MCQ accuracy by 8–12%.</li>
</ul>

<h3>Phase 4: Taper (Final week)</h3>
<p><strong>Goal:</strong> Arrive rested. Most candidates lose marks here, not from undertraining, but from over-training in the final week.</p>
<ul>
  <li><strong>Days 7–4:</strong> Light review of personal weak-subtopic flashcards. No new content.</li>
  <li><strong>Day 3:</strong> One light 50-question block. Stop early if it's going badly — it doesn't predict your exam.</li>
  <li><strong>Day 2:</strong> Logistics day. Print your test centre confirmation. Plan your route. Pack your ID.</li>
  <li><strong>Day 1:</strong> No studying. Walk, eat well, sleep early.</li>
</ul>

<h2>The high-yield subject weighting</h2>
<p>Not all subjects appear equally. Based on AMC handbook breakdown and recall data:</p>
<table>
  <thead><tr><th>Subject group</th><th>Approx. % of exam</th><th>Priority</th></tr></thead>
  <tbody>
    <tr><td>General Medicine (Cards/Resp/Endo/GI/Renal/Neuro)</td><td>35–40%</td><td>Highest</td></tr>
    <tr><td>General Surgery + Surgical subspecialties</td><td>15–20%</td><td>High</td></tr>
    <tr><td>Obstetrics & Gynaecology</td><td>10–12%</td><td>High</td></tr>
    <tr><td>Paediatrics</td><td>10–12%</td><td>High</td></tr>
    <tr><td>Psychiatry</td><td>8–10%</td><td>Medium</td></tr>
    <tr><td>Population Health, Ethics, Indigenous Health</td><td>8–10%</td><td>Often underprepared</td></tr>
    <tr><td>Dermatology, ENT, Ophthalmology</td><td>5–8%</td><td>Low yield, easy wins</td></tr>
  </tbody>
</table>
<p>The two most underprepared subjects in failing candidates: <strong>Population Health</strong> and <strong>Indigenous Health</strong>. Both are answerable from a small set of high-yield concepts (NHMRC guidelines, Closing the Gap framework, social determinants of health). Don't skip them.</p>

<h2>The four mistakes that derail 12-week plans</h2>
<h3>Mistake 1: Front-loading too hard</h3>
<p>Candidates who do 60 questions a day in week 12 burn out by week 6. Build volume gradually.</p>
<h3>Mistake 2: Reviewing only wrong answers</h3>
<p>You learn just as much from understanding <em>why</em> the correct answer was correct, especially on questions you guessed right. Review every question, not just the misses.</p>
<h3>Mistake 3: Skipping the weekly mock</h3>
<p>You can't build exam stamina by doing 30 questions at a time. The exam is 150. Practice the format, not just the content.</p>
<h3>Mistake 4: Studying alone forever</h3>
<p>One weekly conversation with another IMG about a hard case (in person, voice call, or async) lifts retention by 30–40%. Find one study partner, not five.</p>

<h2>What if you only have 6 weeks?</h2>
<p>Compress the framework:</p>
<ul>
  <li><strong>Weeks 6–4:</strong> Phase 1 + Phase 2 combined. 30 MCQs/day, mixed subjects from day one.</li>
  <li><strong>Weeks 3–2:</strong> Phase 3. Two full mocks per week.</li>
  <li><strong>Final week:</strong> Phase 4 taper.</li>
</ul>
<p>Six weeks is tight but viable if you already have a clinical foundation. Less than four weeks and the question shifts from "how do I pass?" to "should I defer?" That's a real conversation worth having with your study partner, not a reason for shame.</p>

<h2>How Zyntra fits into this plan</h2>
<p>Zyntra's adaptive engine generates each day's question block based on your weakest subtopics, tracks the four behavioral metrics that predict failure (rush index, answer-change rate, hesitation score, fatigue index), and turns every wrong answer into a spaced-repetition flashcard. Your 12-week plan is auto-built and auto-adjusted weekly. <a href="/login">Start your free diagnostic</a> and you'll have your week-by-week plan within 10 minutes.</p>
`,
  },

  // ============================================================
  // POST 3 — Recall questions
  // ============================================================
  {
    slug: 'amc-recall-questions-truth',
    title: 'AMC Recall Questions: What They Are, Why They\'re Risky, and What Actually Works Instead',
    description: 'The truth about AMC recall questions, leaked PDFs and "recall banks" — why relying on them is a failing strategy, and the legitimate way to prepare for the patterns AMC reuses.',
    category: 'AMC MCQ',
    readTime: '8 min',
    publishedAt: '2026-04-05',
    updatedAt: '2026-04-18',
    author: baseAuthor,
    keywords: ['AMC recall questions', 'AMC recalls 2025', 'AMC recall PDF', 'AMC question bank', 'AMC repeats', 'AMC leaked questions'],
    content: `
<p class="lead">Search "AMC recalls 2025 PDF" and you'll find a hundred Telegram channels and Reddit threads promising leaked questions. Most candidates have downloaded at least one. Almost none of them want to admit it. This article doesn't moralise — it explains what recall questions actually are, why depending on them is a worse bet than people think, and what to do instead.</p>

<h2>What "AMC recalls" actually means</h2>
<p>A "recall" is a question that a previous candidate remembered after the exam and wrote down. Compiled into PDFs and shared, these documents claim to represent real AMC items that may reappear. The promise: if you memorise the recalls, you've seen the real exam in advance.</p>
<p>The reality is messier on five counts:</p>

<h3>1. Memory degrades fast</h3>
<p>Candidates write recalls from memory hours or days after sitting a 3.5-hour exam under stress. Stems get shortened. Numbers get changed. Distractor options get re-ordered. The recall version of a question often differs from the original in ways that change the correct answer.</p>

<h3>2. The AMC actively retires reused items</h3>
<p>The AMC monitors recall communities. Questions that surface in recall banks are flagged and rotated out faster than uncompromised items. The more popular a recall PDF, the lower the odds those exact questions will appear on your exam.</p>

<h3>3. Pilot questions confuse the data</h3>
<p>Remember: 30 of the 150 questions on your exam are unscored pilots. Recall PDFs include pilot questions that will never count for any future candidate. You can perfectly memorise a pilot and gain zero marks from it.</p>

<h3>4. Recall culture rewards memory over reasoning</h3>
<p>The candidates who lean hardest on recalls are the same candidates who fail the OSCE — because they trained pattern-matching, not clinical reasoning. AMC Part 2 punishes this approach severely.</p>

<h3>5. The legal and ethical risk is real</h3>
<p>The AMC's <em>Examination Conduct Rules</em> explicitly prohibit reproducing or distributing exam content. Candidates caught sharing or downloading recall content can face exam invalidation, registration delays, and AHPRA notifications. The Medical Board takes content theft seriously when it surfaces in registration interviews.</p>

<h2>What works better than recalls</h2>
<p>The AMC reuses <em>patterns</em>, not questions. Every cycle features:</p>
<ul>
  <li>An ECG with new-onset AF in an elderly patient — what's the next step?</li>
  <li>A 2-week-old with bilious vomiting — what's the diagnosis?</li>
  <li>A pregnant woman with hypertension at 32 weeks — what's the threshold for delivery?</li>
  <li>A patient on warfarin with INR of 6 and no bleeding — what's the management?</li>
  <li>A child with a non-blanching rash and fever — what's the immediate action?</li>
</ul>
<p>These are not "recalls." They are the predictable archetypes of Australian primary-care and emergency medicine. If you can answer the <em>archetype</em>, you don't need the specific question.</p>

<h2>The pattern-bank approach</h2>
<p>Build your own pattern bank instead of memorising other people's recalls. For each high-yield topic, write down:</p>
<ol>
  <li>The classic clinical presentation (one sentence).</li>
  <li>The first investigation per Australian guidelines (eTG, RACGP).</li>
  <li>The first-line management.</li>
  <li>The "trap" answer the exam loves to dangle (often a less-Australian-guideline-compliant option).</li>
</ol>
<p>Do this for 80–100 high-yield presentations and you've built something more durable than any recall PDF: clinical reasoning that transfers to questions you've never seen.</p>

<h2>How AI question banks differ from recall banks</h2>
<p>Modern AI-generated question banks (Zyntra included) are not recalls. They generate <em>new</em> vignettes every cycle, calibrated to the AMC blueprint and Australian guidelines. The legal status is clean (the questions aren't copied AMC content), and the educational value is higher because every question is unique. You're training reasoning, not pattern-matching against a fixed pool.</p>

<h2>If you've already used recalls</h2>
<p>You're not alone, and you're not doomed. Pivot now:</p>
<ul>
  <li>Stop adding new recall content to your study.</li>
  <li>Convert what you've already studied into pattern notes (presentation → investigation → management → trap).</li>
  <li>Spend your remaining weeks on full-length adaptive mocks, not recall review.</li>
  <li>Trust the reasoning skills you've actually built, not the memorisation that got you addicted to the recall format.</li>
</ul>

<h2>Bottom line</h2>
<p>Recall questions feel like a shortcut. They're a slow-acting poison — they crowd out the reasoning practice you actually need, they expose you to legal and registration risk, and they decay in value the moment they get popular. Build pattern recognition, train on calibrated AI mocks, and you'll outperform the recall-dependent candidate every cycle.</p>
<p>Zyntra's question bank generates fresh AMC-style vignettes calibrated to the official handbook blueprint — no recalls, no leaks, no legal exposure. <a href="/login">Try the free diagnostic</a> and see the difference between memorising and reasoning.</p>
`,
  },

  // ============================================================
  // POST 4 — IMG pathway / AHPRA
  // ============================================================
  {
    slug: 'img-pathway-australia-ahpra-registration',
    title: 'The Complete IMG Pathway to Australian Registration in 2026: AMC, AHPRA, and the Internship Bottleneck',
    description: 'A step-by-step roadmap for International Medical Graduates (IMGs) seeking AHPRA registration in Australia — Standard Pathway timelines, AMC requirements, internship competition, and the realistic 2026 wait times.',
    category: 'IMG Career',
    readTime: '13 min',
    publishedAt: '2026-04-08',
    updatedAt: '2026-04-18',
    author: baseAuthor,
    keywords: ['IMG Australia', 'AHPRA registration', 'AMC pathway', 'IMG internship Australia', 'standard pathway', 'medical board Australia', 'IMG visa Australia'],
    content: `
<p class="lead">"AMC then what?" is the most-asked question on r/IMG after every Part 1 result release. The pathway from passing the AMC to actually working as a doctor in Australia is longer, more competitive, and less predictable than most candidates are told before they start. This guide is the honest version of the timeline, written for IMGs at every stage.</p>

<h2>The three pathways at a glance</h2>
<table>
  <thead><tr><th>Pathway</th><th>Who it's for</th><th>Typical timeline to general registration</th></tr></thead>
  <tbody>
    <tr><td>Competent Authority</td><td>Graduates from UK, Ireland, NZ, US, Canada with specific credentials</td><td>12–24 months</td></tr>
    <tr><td>Standard Pathway</td><td>Most IMGs from non-CAP countries (India, Pakistan, Bangladesh, Egypt, Philippines, etc.)</td><td>3–6+ years</td></tr>
    <tr><td>Specialist Pathway</td><td>Already-trained specialists seeking specialist recognition</td><td>2–5 years (highly variable)</td></tr>
  </tbody>
</table>
<p>This article focuses on the <strong>Standard Pathway</strong> because that's where 80% of r/IMG questions originate.</p>

<h2>Standard Pathway: the seven-step reality</h2>

<h3>Step 1: Verify your medical degree (3–6 months)</h3>
<p>Submit your primary medical qualification to the AMC for verification via the EPIC service from ECFMG. This must be complete before you can sit any AMC exam. Common delays: missing transcripts, name mismatches across documents, your university not responding to ECFMG verification requests.</p>

<h3>Step 2: AMC MCQ (Part 1) — 6–18 months of preparation</h3>
<p>Computer-adaptive 150-question exam. Available year-round at Pearson VUE centres globally. Pass rate hovers around 50–55%. Most successful candidates take 6–12 months of focused preparation alongside work.</p>

<h3>Step 3: AMC Clinical (Part 2) — 6–12 months wait + preparation</h3>
<p>16-station OSCE held in Melbourne, Sydney, Brisbane, Adelaide, and Perth. Booking opens 3–4 times a year. <strong>Wait times for an OSCE seat are currently 4–9 months</strong> after passing Part 1 — plan for this. Pass rate: ~55–60%.</p>

<h3>Step 4: Provisional registration with AHPRA (1–3 months)</h3>
<p>After passing Part 2, you can apply for <em>provisional registration</em> with the Medical Board of Australia. You'll need:</p>
<ul>
  <li>AMC certificate</li>
  <li>English language evidence (IELTS Academic 7.0 minimum each band, or OET B in each subtest)</li>
  <li>Criminal history check (Australian + every country lived in for 6+ months in the last 10 years)</li>
  <li>Identity documents</li>
  <li>Curriculum vitae and structured employment history</li>
</ul>
<p>AHPRA application processing takes 6–12 weeks on average. Don't apply until your documents are watertight — AHPRA returns incomplete applications without refund.</p>

<h3>Step 5: Secure an internship (the real bottleneck)</h3>
<p>This is where the pathway slows dramatically. To convert provisional to general registration, you must complete a 12-month accredited internship in an Australian hospital. <strong>There are dramatically more provisionally-registered IMGs than internship places.</strong></p>
<p>2025 data:</p>
<ul>
  <li>Approximately <strong>3,200 Australian medical graduates</strong> matched to internships in 2025.</li>
  <li>Estimated <strong>2,800+ IMGs</strong> with provisional registration competing for ~400–600 remaining positions.</li>
  <li>Wait times of <strong>1–3 years</strong> from provisional registration to internship start are common.</li>
</ul>
<p>Each state runs its own match (HETI in NSW, PMCV in Victoria, RMO Campaign in QLD, etc.) with different IMG categories and quotas. NSW and QLD historically offer more IMG-friendly pathways than Victoria.</p>

<h3>Step 6: Complete the internship year</h3>
<p>Five mandatory rotations: Medicine, Surgery, Emergency Medicine, plus two electives. Most interns work 70–80 hours per week including overtime. The pay is modest by Australian doctor standards (~AUD $80–95k base) but enough to live on.</p>

<h3>Step 7: General registration</h3>
<p>After successful internship completion, AHPRA grants general registration. You're now a fully registered Australian doctor. You can apply for residency (PGY2/PGY3) or begin specialty training applications.</p>

<h2>The visa layer</h2>
<p>You can't separate registration from visa. Common pathways:</p>
<ul>
  <li><strong>Temporary Skill Shortage 482 visa:</strong> Hospital sponsors you for the internship. Most common entry visa.</li>
  <li><strong>Skilled Independent 189 / Skilled Nominated 190:</strong> Points-based, requires a positive skills assessment from the AMC. Difficult before general registration.</li>
  <li><strong>Distinguished Talent 858:</strong> For high-achieving candidates with international recognition. Rare.</li>
</ul>
<p>If your sponsoring hospital is in a regional area (designated DAMA region), pathways to permanent residency are faster.</p>

<h2>How long does the whole thing take? (Honest answer)</h2>
<p>From "I want to work in Australia" to general registration:</p>
<ul>
  <li><strong>Fast-track (top 10% of candidates):</strong> 2.5–3 years.</li>
  <li><strong>Median timeline:</strong> 4–5 years.</li>
  <li><strong>Slow path (delays in any step):</strong> 6–8 years.</li>
</ul>
<p>The single biggest variable is the internship wait. Candidates who get an internship in their first match cycle are significantly faster than those who wait 2–3 cycles.</p>

<h2>Five strategic moves that compress the timeline</h2>
<h3>1. Apply broadly across states, not just one</h3>
<p>Restricting yourself to Victoria because you have family in Melbourne can add 2 years. NSW, QLD, and WA all offer viable IMG-friendly internship paths.</p>

<h3>2. Get an Australian clinical attachment before applying for internship</h3>
<p>Even an unpaid 4-week observership at an Australian hospital strengthens your application enormously. References from Australian consultants are weighted heavily.</p>

<h3>3. Pass IELTS/OET on the first attempt</h3>
<p>Each retake delays AHPRA application by 2–3 months. Invest in proper preparation.</p>

<h3>4. Build a structured CV that matches Australian conventions</h3>
<p>Reverse-chronological, plain text, no photos, no marital status. Include rotations with dates and supervisor names. Most Australian-format CV templates are freely available from PMCV, HETI, and similar bodies.</p>

<h3>5. Don't underestimate Indigenous Health and Cultural Safety</h3>
<p>Both AMC exams and internship interviews include questions on Indigenous health, cultural safety, and Closing the Gap. Candidates who treat this as an afterthought lose marks and interview scores. Treat it as core curriculum.</p>

<h2>What about the New Specialist Pathway changes?</h2>
<p>From late 2024, the Medical Board introduced an expedited pathway for specialist IMGs from comparable health systems (UK, Ireland, NZ, with US and Canada under review). If you're already a trained specialist from these countries, the pathway to specialist recognition compressed from ~3 years to ~12 months. This does <em>not</em> apply to non-specialist IMGs or specialists from non-comparable systems.</p>

<h2>Bottom line</h2>
<p>The pathway is longer than the brochures suggest, more competitive than your seniors remember, and more bureaucratic than feels reasonable. But it's navigable. Every year, hundreds of IMGs make it through. The candidates who succeed share three traits: they apply broadly, they prepare seriously for both AMC exams, and they treat the wait as a phase to build skills (clinical attachments, research, language refinement) rather than passively endure.</p>
<p>Zyntra exists to make Steps 2 and 3 — the AMC exams — as efficient as possible so you can focus your energy on Steps 5–7, where the real bottleneck lives. <a href="/login">Start your free AMC diagnostic</a> and let's compress the first part of your journey.</p>
`,
  },

  // ============================================================
  // POST 5 — Internship / job hunt
  // ============================================================
  {
    slug: 'img-internship-australia-how-to-get-one',
    title: 'How IMGs Actually Get an Internship in Australia: The Application Game in 2026',
    description: 'A practical guide for IMGs applying for Australian internships — state-by-state match systems, application timing, CV format, interview prep, and the unwritten rules that determine who gets offered.',
    category: 'IMG Career',
    readTime: '12 min',
    publishedAt: '2026-04-12',
    updatedAt: '2026-04-18',
    author: baseAuthor,
    keywords: ['IMG internship Australia', 'medical internship Australia', 'HETI IMG', 'PMCV', 'Queensland RMO campaign', 'IMG job Australia', 'Australian intern match'],
    content: `
<p class="lead">Passing the AMC is the easy half. Getting an Australian internship as an IMG is the half that crushes most candidates. This is the practical guide nobody handed you — how the state-by-state match works, when to apply, what makes a competitive application, and the unwritten rules that decide who gets the offer.</p>

<h2>The brutal numbers</h2>
<p>Each year, Australian medical schools graduate ~3,200 students. The Commonwealth funds an internship for every Australian graduate. After that, remaining intern positions are offered to Permanent Residents/Citizens who graduated overseas, then to Temporary Resident IMGs. Across all states combined, fewer than 600 of these "leftover" intern positions exist annually, and the IMG applicant pool is in the thousands.</p>
<p>This means: <strong>your application doesn't just need to be good. It needs to beat several other strong applications for the same seat.</strong></p>

<h2>State-by-state match systems</h2>

<h3>NSW: HETI</h3>
<ul>
  <li>Applications typically open <strong>May–June</strong> for the following year's intern start.</li>
  <li>IMGs apply through the same portal as Australian grads but in a separate priority category.</li>
  <li>Historically the most IMG-friendly large state due to volume of positions and rural networks.</li>
</ul>

<h3>Victoria: PMCV</h3>
<ul>
  <li>Computer-matched system with applicant preferences and hospital rankings.</li>
  <li>Applications open <strong>June–July</strong>.</li>
  <li>Strong domestic graduate competition (Melbourne, Monash, Deakin) — fewer leftover IMG positions.</li>
</ul>

<h3>Queensland: RMO Campaign</h3>
<ul>
  <li>Hospital-by-hospital direct applications, not centralised match.</li>
  <li>Opens <strong>March–April</strong>, earlier than other states.</li>
  <li>Regional and rural Queensland hospitals are often the friendliest entry points for IMGs.</li>
</ul>

<h3>Western Australia: WAHRMC</h3>
<ul>
  <li>Centralised process with both metropolitan and regional positions.</li>
  <li>Applications open <strong>May–June</strong>.</li>
  <li>Strong demand for IMGs in regional WA — Bunbury, Geraldton, Kalgoorlie.</li>
</ul>

<h3>South Australia, Tasmania, NT, ACT</h3>
<p>Smaller states with smaller intakes but less per-position competition. Worth applying as additional safety nets.</p>

<h2>The 14-month application timeline</h2>
<ol>
  <li><strong>Month -14:</strong> Pass AMC Part 2 (or be on track to).</li>
  <li><strong>Month -12:</strong> Submit AHPRA provisional registration application.</li>
  <li><strong>Month -10:</strong> Begin Australian clinical attachment if possible.</li>
  <li><strong>Month -8:</strong> Polish CV, gather references, prepare statements.</li>
  <li><strong>Month -7 to -5:</strong> Submit applications across multiple states.</li>
  <li><strong>Month -4 to -3:</strong> Interviews (in person or video).</li>
  <li><strong>Month -2:</strong> Offers released. Accept fastest reasonable offer.</li>
  <li><strong>Month 0:</strong> Begin internship in late January (most states).</li>
</ol>

<h2>What a competitive application looks like</h2>
<p>From conversations with intern coordinators across NSW, VIC, and QLD, the consistent green flags are:</p>
<ul>
  <li><strong>An Australian clinical attachment of 4+ weeks</strong> with a written reference from an Australian consultant.</li>
  <li><strong>A reflective personal statement</strong> (not a CV in paragraph form) showing you understand Australian healthcare culture, Indigenous health priorities, and the role of the intern.</li>
  <li><strong>Demonstrated commitment to the region</strong> — if you're applying to regional QLD, your statement should not read like a Sydney application.</li>
  <li><strong>Up-to-date OET/IELTS scores</strong> beyond the AHPRA minimum.</li>
  <li><strong>Recent clinical work</strong> (within the last 12 months). Long gaps after passing the AMC are a red flag — fill them with locum work, observerships, or volunteer clinical roles in your home country.</li>
</ul>

<h2>What kills applications</h2>
<ul>
  <li>Generic personal statements that could be sent to any hospital.</li>
  <li>Spelling errors. Coordinators read 400+ applications. Yours gets 90 seconds.</li>
  <li>References from supervisors who can't be reached or who write generic letters.</li>
  <li>Treating Indigenous health questions as a checkbox rather than a serious learning area.</li>
  <li>Applying to only one state. Successful candidates apply to 4–6.</li>
</ul>

<h2>The interview</h2>
<p>If you get an interview, you've already beaten 80% of applicants. Now the interview is yours to lose. Common formats:</p>
<ul>
  <li><strong>Multiple Mini Interviews (MMI):</strong> 5–8 stations of 7–10 minutes each, mix of clinical scenarios, ethics, communication, motivation.</li>
  <li><strong>Panel interview:</strong> 30–45 minutes with 2–3 consultants/HR. More conversational.</li>
  <li><strong>Hybrid:</strong> Increasingly common post-COVID.</li>
</ul>

<h3>The five questions you will be asked (in some form)</h3>
<ol>
  <li><strong>"Why this hospital, why this state?"</strong> Generic answers fail. Reference specific rotations, programs, regional context.</li>
  <li><strong>"Tell us about a time you made a clinical mistake."</strong> They want honesty + reflection + system thinking, not a humblebrag.</li>
  <li><strong>"How would you respond to a senior who asks you to do something you think is unsafe?"</strong> Escalation pathway, not confrontation.</li>
  <li><strong>"What do you understand about Indigenous health in Australia?"</strong> Specifics: Closing the Gap, social determinants, cultural safety, your responsibility as a non-Indigenous doctor.</li>
  <li><strong>"What will you do if you don't get an internship this cycle?"</strong> They want resilience and realistic planning, not desperation.</li>
</ol>

<h2>If you don't match this cycle</h2>
<p>It happens to the majority of IMGs on their first attempt. Don't catastrophise. Use the next 12 months to:</p>
<ul>
  <li>Do a meaningful Australian clinical attachment (paid or unpaid).</li>
  <li>Strengthen language scores if borderline.</li>
  <li>Volunteer in Australian healthcare-adjacent roles (research assistant, medical interpreter, hospital ward clerk).</li>
  <li>Re-apply across more states, with a stronger statement.</li>
</ul>
<p>Most successful IMGs we've spoken to applied 2–3 cycles before matching. The ones who never matched were almost always the ones who stopped applying or never broadened beyond their first-choice state.</p>

<h2>The role Zyntra plays</h2>
<p>Zyntra's focus is the AMC exams — Parts 1 and 2 — but the data we collect on your behavioral patterns (how you handle pressure, ambiguity, communication breakdowns) is exactly the data interview panels are probing for in MMI stations. Candidates who train deliberately on those behavioral patterns during AMC prep walk into intern interviews already ahead. <a href="/login">Start your free diagnostic</a> and let's set you up for both halves of the journey.</p>
`,
  },
];

export const getPostBySlug = (slug: string) => posts.find(p => p.slug === slug);
export const getAllPosts = () => [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
