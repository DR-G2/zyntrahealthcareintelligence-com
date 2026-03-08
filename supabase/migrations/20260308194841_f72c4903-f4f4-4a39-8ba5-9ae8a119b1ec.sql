
-- Step 1: Delete garbage questions (generic template options)
-- First clean related tables, then delete questions
WITH garbage_ids AS (
  SELECT id FROM questions WHERE options::text ILIKE '%initiate immediate empiric treatment targeting the suspected pathology%'
),
del_bk AS (DELETE FROM bookmarks WHERE question_id IN (SELECT id FROM garbage_ids)),
del_un AS (DELETE FROM user_notes WHERE question_id IN (SELECT id FROM garbage_ids)),
del_ua AS (DELETE FROM user_attempts WHERE question_id IN (SELECT id FROM garbage_ids)),
del_qd AS (DELETE FROM question_difficulty_tiers WHERE question_id IN (SELECT id FROM garbage_ids))
DELETE FROM questions WHERE id IN (SELECT id FROM garbage_ids);

-- Step 2: Delete template vignette pattern 1
WITH template_ids AS (
  SELECT id FROM questions WHERE lower(question_text) LIKE '%a patient presents with a clinical scenario frequently reported in amc examination recalls%'
  OR lower(question_text) LIKE '%a patient presents with a clinical scenario commonly tested in amc%'
),
del_bk AS (DELETE FROM bookmarks WHERE question_id IN (SELECT id FROM template_ids)),
del_un AS (DELETE FROM user_notes WHERE question_id IN (SELECT id FROM template_ids)),
del_ua AS (DELETE FROM user_attempts WHERE question_id IN (SELECT id FROM template_ids)),
del_qd AS (DELETE FROM question_difficulty_tiers WHERE question_id IN (SELECT id FROM template_ids))
DELETE FROM questions WHERE id IN (SELECT id FROM template_ids);

-- Step 3: Deduplicate by question_text (keep oldest per unique text)
WITH dups AS (
  SELECT id FROM questions q WHERE EXISTS (
    SELECT 1 FROM questions q2 
    WHERE lower(trim(regexp_replace(q2.question_text, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(q.question_text, '\s+', ' ', 'g')))
    AND q2.created_at < q.created_at
  )
),
del_bk AS (DELETE FROM bookmarks WHERE question_id IN (SELECT id FROM dups)),
del_un AS (DELETE FROM user_notes WHERE question_id IN (SELECT id FROM dups)),
del_ua AS (DELETE FROM user_attempts WHERE question_id IN (SELECT id FROM dups)),
del_qd AS (DELETE FROM question_difficulty_tiers WHERE question_id IN (SELECT id FROM dups))
DELETE FROM questions WHERE id IN (SELECT id FROM dups);

-- Step 4: Normalize categories
UPDATE questions SET category = 'Cardiology' WHERE lower(trim(category)) IN ('cardiovascular', 'cardiovascular system', 'cardiac');
UPDATE questions SET category = 'Respiratory' WHERE lower(trim(category)) IN ('respiratory medicine', 'respiratory system', 'pulmonology');
UPDATE questions SET category = 'Gastrointestinal' WHERE lower(trim(category)) IN ('gastroenterology', 'gi', 'digestive');
UPDATE questions SET category = 'Haematology' WHERE lower(trim(category)) IN ('hematology', 'haematology/oncology', 'hematology/oncology', 'oncology');
UPDATE questions SET category = 'Psychiatry' WHERE lower(trim(category)) IN ('mental health', 'mood disorders', 'psychosis', 'anxiety/ocd/ptsd', 'anxiety disorders', 'substance use', 'substance use disorders', 'organic/psychogeriatric', 'child & adolescent psychiatry');
UPDATE questions SET category = 'Musculoskeletal' WHERE lower(trim(category)) IN ('orthopaedics', 'orthopedics', 'orthopedic', 'rheumatology');
UPDATE questions SET category = 'Emergency Medicine' WHERE lower(trim(category)) IN ('trauma', 'trauma & emergency');
UPDATE questions SET category = 'Surgery' WHERE lower(trim(category)) IN ('general surgery', 'vascular surgery', 'cardiothoracic surgery', 'neurosurgery', 'surgical');
UPDATE questions SET category = 'Paediatrics' WHERE lower(trim(category)) IN ('neonatology', 'pediatrics', 'common paediatric conditions', 'paediatric emergencies', 'paediatric medicine');
UPDATE questions SET category = 'Obstetrics & Gynaecology' WHERE lower(trim(category)) IN ('obstetrics', 'gynaecology', 'gynecology', 'o&g');
UPDATE questions SET category = 'Renal' WHERE lower(trim(category)) IN ('urology', 'nephrology', 'renal medicine');
UPDATE questions SET category = 'Infectious Diseases' WHERE lower(trim(category)) IN ('infectious disease', 'infection', 'microbiology');
UPDATE questions SET category = 'Population Health' WHERE lower(trim(category)) IN ('ethics/legal', 'ethics & law', 'ethics', 'epidemiology/screening', 'epidemiology', 'indigenous health', 'public health', 'public health/palliative', 'palliative care', 'preventive medicine');
UPDATE questions SET category = 'ENT' WHERE lower(trim(category)) IN ('ophthalmology');
UPDATE questions SET category = 'Endocrinology' WHERE lower(trim(category)) IN ('pharmacology');
