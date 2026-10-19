-- 0094: Restore approved clinical qbank LO mappings and AMC_CAT_MCQ eligibility.
-- Owner confirmed on 2026-10-19 that all 1,044 imported clinical questions have been reviewed and approved.
-- The draft/review flags in their provenance are stale. This migration reconciles them to the confirmed review state.
-- LO identity is derived deterministically from lo_key, not the conflicting legacy lo_id metadata.
-- P12 inference tables/functions are not modified.

begin;

-- 1. Restore concept rows from the imported questions' trusted concept metadata.
with source_concepts as (
  select distinct on (q.provenance->>'concept_key')
    q.provenance->>'concept_key' as concept_key,
    (q.provenance->>'concept_id')::uuid as concept_id,
    initcap(replace(split_part(q.provenance->>'concept_key', '.', 2), '_', ' ')) as title
  from public.questions q
  where q.zyntra_id like 'ZQ-IMP-%'
    and q.status = 'active'
    and q.provenance ? 'concept_key'
    and q.provenance ? 'concept_id'
  order by q.provenance->>'concept_key', q.zyntra_id
)
insert into pie.concept (id, concept_key, title, description, status)
select concept_id, concept_key, title, 'Imported clinical qbank concept; owner-confirmed approved 2026-10-19', 'active'
from source_concepts
on conflict (concept_key) do update
set status = 'active',
    updated_at = now();

-- 2. Restore objectives by stable lo_key. The old provenance lo_id collision is intentionally ignored.
with source_los as (
  select distinct on (q.provenance->>'lo_key')
    q.provenance->>'lo_key' as lo_key,
    q.provenance->>'concept_key' as concept_key,
    coalesce(nullif(q.provenance->>'lo_title', ''), q.provenance->>'lo_key') as title
  from public.questions q
  where q.zyntra_id like 'ZQ-IMP-%'
    and q.status = 'active'
    and q.provenance ? 'lo_key'
    and q.provenance ? 'concept_key'
  order by q.provenance->>'lo_key', q.zyntra_id
)
insert into pie.learning_objective (id, lo_key, concept_id, title, description, status)
select
  md5('zyntra-pie-lo-v1:' || sl.lo_key)::uuid,
  sl.lo_key,
  c.id,
  sl.title,
  'Imported clinical qbank learning objective; owner-confirmed approved 2026-10-19',
  'active'
from source_los sl
join pie.concept c on c.concept_key = sl.concept_key
on conflict (lo_key) do update
set concept_id = excluded.concept_id,
    title = excluded.title,
    status = 'active',
    updated_at = now();

-- 3. Map every active imported question to its declared LO. Existing IDs are resolved by lo_key.
insert into pie.question_lo (question_id, lo_id, is_primary, weight, mapping_source)
select q.id, lo.id, true, 1, 'import'
from public.questions q
join pie.learning_objective lo on lo.lo_key = q.provenance->>'lo_key'
where q.zyntra_id like 'ZQ-IMP-%'
  and q.status = 'active'
  and q.provenance ? 'lo_key'
on conflict (question_id, lo_id) do update
set is_primary = true,
    weight = 1,
    mapping_source = 'import';

-- 4. Restore active AMC_CAT_MCQ blueprint eligibility. Coverage targets sum to each subject's declared share.
with active_blueprint as (
  select id
  from amc.amc_blueprint
  where blueprint_key = 'AMC_CAT_MCQ'
    and (effective_from is null or effective_from <= now())
    and (effective_to is null or effective_to > now())
  order by effective_from desc nulls last, id
  limit 1
),
eligible_los as (
  select distinct lo.id, lo.lo_key,
    case split_part(lo.lo_key, '.', 1)
      when 'ADULT_MEDICINE' then 0.30::numeric
      when 'ADULT_SURGERY' then 0.20::numeric
      when 'WOMENS_HEALTH' then 0.125::numeric
    end as subject_share,
    split_part(lo.lo_key, '.', 1) as subject_key
  from pie.learning_objective lo
  join pie.concept c on c.id = lo.concept_id
  join pie.question_lo ql on ql.lo_id = lo.id and ql.is_primary
  join public.questions q on q.id = ql.question_id and q.status = 'active'
  where q.zyntra_id like 'ZQ-IMP-%'
    and lo.status = 'active'
    and split_part(lo.lo_key, '.', 1) in ('ADULT_MEDICINE', 'ADULT_SURGERY', 'WOMENS_HEALTH')
),
denominators as (
  select subject_key, count(distinct lo_key)::numeric as n
  from eligible_los
  group by subject_key
)
insert into amc.amc_blueprint_lo (blueprint_id, lo_id, eligible, coverage_target, tie_break_rank)
select b.id, e.id, true, e.subject_share / nullif(d.n, 0), null
from active_blueprint b
cross join eligible_los e
join denominators d on d.subject_key = e.subject_key
where e.subject_share is not null and d.n > 0
on conflict (blueprint_id, lo_id) do update
set eligible = true,
    coverage_target = excluded.coverage_target;

-- 5. Align the imported records' stale lifecycle/review metadata with the owner-confirmed approval.
update public.questions q
set provenance = q.provenance || jsonb_build_object(
  'review_status', 'owner_approved_2026_10_19',
  'lifecycle_status', 'approved',
  'source_status', 'approved',
  'clinical_review_required', false,
  'lo_id', lo.id::text,
  'concept_id', c.id::text,
  'mapping_repaired_by', '0094_clinical_lo_mapping_restore',
  'owner_approval_confirmed_at', now()
),
updated_at = now()
from pie.learning_objective lo
join pie.concept c on c.id = lo.concept_id
where q.zyntra_id like 'ZQ-IMP-%'
  and q.status = 'active'
  and lo.lo_key = q.provenance->>'lo_key'
  and c.concept_key = q.provenance->>'concept_key';

commit;
