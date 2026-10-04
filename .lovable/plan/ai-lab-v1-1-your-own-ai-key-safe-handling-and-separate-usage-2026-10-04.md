# AI Lab V1.1: your own AI key, safe handling, and separate usage tracking

## What I found
- The AI Lab page, its `/practice/ai-lab` address and its server function already exist.
- The two AI Lab tables (connections and sessions) are **not in the live database**: the migration file is in the repo but was never applied. It also lacks the access grants the database requires, so even once applied the server could not reach the tables.
- The encryption secret `AI_LAB_ENCRYPTION_SECRET` is **not set**, so every AI Lab request currently fails.
- The "status" check reports a fixed model list instead of the models the candidate's key can actually use.
- Replies are read from a field (`output_text`) that only the OpenAI SDK fills in, not the raw HTTP reply, so successful calls can be reported as "empty response".
- The "Use Performance Intelligence" toggle already defaults to OFF. The database default for sessions says ON; I will change it to OFF.

## What I will change

### 1. Database (one new migration; the existing V1 file stays untouched)
- Apply the existing `20261003173000_ai_lab_v1.sql` exactly as written.
- New migration `ai_lab_v1_1`:
  - Grants: the server role gets full access to all AI Lab tables. Signed-in users can only **read** their own sessions and events, and can never read connections, so stored keys are never readable from the browser.
  - Sessions: default `use_intelligence` to OFF; add `total_tokens`, `subject`, `error_code` and `context_attached`.
  - New `ai_lab_events` table: user, session, event type (the 8 types from your spec, checked by the database), provider, model, mode, subject, duration, confidence, answer-change count, tokens, estimated cost, safe extra details, time. Indexed by user and time.
  - The table is **not** connected to the triggers that update the four core analytics tables (readiness, question, subject, behaviour), so AI Lab data cannot change them.

### 2. Encryption secret
- Generate `AI_LAB_ENCRYPTION_SECRET` automatically (a random 64-character value). Nobody types it in, and it is unrelated to any candidate key.

### 3. Server function (`ai-lab`), restructured in place
- **Provider adapter:** a small `providers/openai.ts` module that checks a key, lists models and generates replies, plus cost estimates (returned as "not available" when there is no trusted price table; no invented prices). The main file chooses an adapter by provider name, so adding a provider later is one new file.
- **Key handling:** keep the current AES-GCM encryption. The key is never logged, never sent back to the browser, and is decrypted only for that candidate's own request.
- **Models:** the list comes from the provider for that key, both on connect and on status. If none is supported, the reply is "No supported model is available for this API credential." There is no silent fallback, and choosing a model the key cannot use is rejected.
- **Reading replies:** read the text from the raw reply's `output` content, keeping the current endpoint and question-format rules.
- **Errors:** every error comes back as `{ error, code, details }` using your 10 error codes. OpenAI 401 becomes INVALID_PROVIDER_KEY, 403 PROVIDER_ACCESS_DENIED, 429 PROVIDER_RATE_LIMIT (with retry time), 5xx PROVIDER_ERROR. Raw provider headers and stack traces are never returned.
- **No billing claims:** a successful connect means the key works and models are available. It does not say the account is paid.
- **Training context (only when the toggle is ON):** readiness summary, weakest subjects, behaviour indices, plus a suggested training goal worked out by simple rules. Subject names are cleaned and the data is labelled as reference data, not instructions. No question text, scoring weights, personal details or other candidates' data are sent.
- **Recording:** each session row is saved as "running" and updated to "completed" or "error". Events (`session_started`, `question_generated`, `session_completed`) are written by the server. A new `log_event` action records the candidate's in-browser actions (question started, answer submitted or changed, hint or explanation asked) after checking the type and that the session belongs to them.
- **AI replies are only displayed:** nothing in them runs or changes the database. Generated questions are checked against the schema and stored only in AI Lab tables.
- **New `history` action:** returns the candidate's own recent sessions.

### 4. AI Lab page (no redesign)
- Show the new error messages instead of "Something went wrong".
- Add the disclosure text you supplied next to the connect step.
- One line under the toggle explaining exactly what OFF and ON send.
- Recent sessions list, using the existing card style.
- For generated questions: log question started, answer chosen or changed, and explanation shown. The page only records these; scores are not computed in the browser.
- Model choice uses only the list returned by the server.

### 5. Privacy and Terms
- Add one short paragraph to the Privacy page about AI Lab: your own provider, routed through Zyntra's server, sessions and usage stored, billing stays with you. I'll check it matches the existing wording and avoid any legal claims that haven't been verified.

## Not touched
Practice, the MCQ engine, OSCE, Flashcards, Performance Intelligence calculations, Study Plan, sign-in, admin, homepage, blog and routing (the `/practice/ai-lab` route already exists). There are no intervention-effectiveness scores yet: the event data supports them later.

## Checks after building
- Typecheck and production build, plus the existing tests.
- Confirm the migration applied and the tables, grants and access rules exist.
- Deploy the function, then call it directly to check: no sign-in (rejected with AUTH_REQUIRED), invalid key (INVALID_PROVIDER_KEY, a real rejection from OpenAI), missing secret (checked in the code, because removing the live secret would break production), and another user's sessions (cross-user isolation tested by querying as a second test user).
- Load `/practice/ai-lab` signed in, in a test browser.

## Blocker: a real OpenAI key
Tests 4 to 13 and 15 to 16 (valid key, model list, the three modes, toggle ON/OFF, saving, history, disconnect, provider failure, rate limit) need a **real OpenAI API key**. I have none, and fake success responses aren't allowed. Unless you give me one through the secure form or test it yourself, I'll report those tests as not verified rather than done.

## Final report
Your 8 headings, stating only what was actually verified and deployed.
