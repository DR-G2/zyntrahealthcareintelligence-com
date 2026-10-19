-- Restore AMC_CAT_MCQ blueprint eligibility for the currently mapped active Population Health bank.
-- Only existing active objectives with primary mappings to active questions are included.
-- Does not fabricate mappings for active Adult Medicine, Adult Surgery, or Women's Health content.
with active_blueprint as (
  select b.id
  from amc.amc_blueprint b
  where b.blueprint_key = 'AMC_CAT_MCQ'
    and (b.effective_from is null or b.effective_from <= now())
    and (b.effective_to is null or b.effective_to > now())
  order by b.effective_from desc nulls last, b.id
  limit 1
),
eligible_objectives as (
  select distinct lo.id
  from pie.learning_objective lo
  join pie.concept c on c.id = lo.concept_id
  join pie.question_lo ql on ql.lo_id = lo.id and ql.is_primary
  join public.questions q on q.id = ql.question_id and q.status = 'active'
  join public.subjects s on s.id = q.subject_id and s.slug = 'population-health-ethics'
  where lo.status = 'active'
    and c.concept_key = 'SUBJ_POPULATION_HEALTH_ETHICS'
),
denominator as (
  select count(*)::numeric as n from eligible_objectives
)
insert into amc.amc_blueprint_lo(blueprint_id, lo_id, eligible, coverage_target, tie_break_rank)
select b.id, e.id, true, 0.125 / nullif(d.n, 0), null
from active_blueprint b
cross join eligible_objectives e
cross join denominator d
where d.n > 0
on conflict (blueprint_id, lo_id) do nothing;
